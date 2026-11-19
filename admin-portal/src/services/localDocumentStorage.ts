/**
 * Quản lý lưu trữ tài liệu PDF cục bộ (Client-Side Storage: LocalStorage + IndexedDB) cho Admin Portal.
 * Tuân thủ yêu cầu: Chỉ nạp vào lưu trữ trình duyệt, KHÔNG ghi đè hay nạp thêm vào CSDL tại Backend.
 */
import type { KnowledgeDocumentItem } from '../types/admin';

const STORAGE_KEY = 'clinical_local_pdf_documents_meta';
const DB_NAME = 'clinical_local_pdf_store';
const STORE_NAME = 'pdf_blobs';
const DB_VERSION = 1;

export interface LocalDocumentMeta extends KnowledgeDocumentItem {
  is_local: true;
  uploaded_at: string;
}

/**
 * Mở IndexedDB cho lưu trữ nhị phân PDF (tránh giới hạn ~5MB của LocalStorage)
 */
function openPdfDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB không được hỗ trợ trong môi trường này'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Không thể mở IndexedDB'));
  });
}

/**
 * Tính mã SHA-256 của tệp để định danh và bảo toàn tính toàn vẹn
 */
async function computeFileSha256(file: File): Promise<string> {
  try {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const buffer = await file.arrayBuffer();
      const digest = await window.crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(digest));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (err) {
    console.warn('Không thể tính SHA256 qua crypto.subtle, sử dụng mã fallback', err);
  }
  return `local_${file.size}_${Date.now().toString(16)}`;
}

/**
 * Đọc toàn bộ danh sách tài liệu cục bộ từ LocalStorage
 */
export function getLocalPdfDocuments(): LocalDocumentMeta[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Lỗi khi đọc danh sách tài liệu từ LocalStorage:', err);
    return [];
  }
}

/**
 * Lưu tệp PDF vào IndexedDB và metadata vào LocalStorage
 */
export async function saveLocalPdfDocument(input: {
  file: File;
  title: string;
  legalBasis: string;
  category: string;
  editionYear: number;
  docId?: string;
}): Promise<LocalDocumentMeta> {
  const sha256 = await computeFileSha256(input.file);
  const docId = input.docId?.trim() || `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  // 1. Lưu blob nhị phân vào IndexedDB
  try {
    const db = await openPdfDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(input.file, docId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Không thể lưu file vào IndexedDB'));
      tx.onabort = () => reject(tx.error || new Error('Giao dịch IndexedDB bị hủy'));
    });
  } catch (dbErr) {
    console.warn('Lỗi lưu vào IndexedDB, fallback cơ chế tải trình duyệt:', dbErr);
  }

  // 2. Tạo đối tượng metadata
  const meta: LocalDocumentMeta = {
    id: docId,
    title: input.title.trim(),
    legal_basis: input.legalBasis.trim(),
    category: input.category.trim() || 'Văn bản y tế',
    edition_year: input.editionYear || new Date().getFullYear(),
    filename: input.file.name,
    public_url: `#local-pdf-${docId}`,
    sha256,
    bytes: input.file.size,
    is_local: true,
    uploaded_at: new Date().toISOString(),
  };

  // 3. Ghi vào LocalStorage
  try {
    const existing = getLocalPdfDocuments().filter((doc) => doc.id !== docId);
    existing.unshift(meta);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (lsErr) {
    console.error('Lỗi khi lưu metadata vào LocalStorage:', lsErr);
    throw new Error('Bộ nhớ LocalStorage của trình duyệt đã đầy hoặc bị chặn.');
  }

  return meta;
}

/**
 * Lấy Blob tệp PDF từ IndexedDB theo docId
 */
export async function getLocalPdfBlob(docId: string): Promise<Blob | null> {
  try {
    const db = await openPdfDatabase();
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(docId);
      req.onsuccess = () => resolve((req.result as Blob) || null);
      req.onerror = () => reject(req.error || new Error('Không thể đọc file từ IndexedDB'));
    });
  } catch (err) {
    console.error('Lỗi khi đọc file PDF cục bộ:', err);
    return null;
  }
}

/**
 * Xóa tài liệu PDF cục bộ (Xóa cả LocalStorage và IndexedDB)
 */
export async function deleteLocalPdfDocument(docId: string): Promise<boolean> {
  // 1. Xóa khỏi LocalStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const existing = getLocalPdfDocuments().filter((doc) => doc.id !== docId);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (err) {
      console.error('Lỗi khi xóa metadata khỏi LocalStorage:', err);
    }
  }

  // 2. Xóa khỏi IndexedDB
  try {
    const db = await openPdfDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(docId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Không thể xóa file khỏi IndexedDB'));
    });
    return true;
  } catch (err) {
    console.error('Lỗi khi xóa file khỏi IndexedDB:', err);
    return true;
  }
}

/**
 * Mở xem tệp PDF cục bộ trong tab mới qua Object URL
 */
export async function openLocalPdfDocument(docId: string): Promise<boolean> {
  const blob = await getLocalPdfBlob(docId);
  if (!blob) {
    alert('Không tìm thấy dữ liệu tệp PDF trong bộ nhớ cục bộ của trình duyệt.');
    return false;
  }
  const blobUrl = URL.createObjectURL(blob);
  const win = window.open(blobUrl, '_blank');
  if (!win) {
    alert('Trình duyệt đã chặn cửa sổ bật lên (popup). Vui lòng cho phép để xem PDF.');
    return false;
  }
  // Thu hồi Object URL sau 60s để tránh rò rỉ bộ nhớ
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  return true;
}
