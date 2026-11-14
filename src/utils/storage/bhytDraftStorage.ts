/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * BHYT Draft Persistence Manager (IndexedDB + Memory/Session Fallback)
 * Đảm bảo lưu trữ ảnh/PDF và dữ liệu thẩm định BHYT bền vững qua các lần chuyển tab & F5 reload.
 */

import { BhytPrescriptionPayload, HospitalRank, TreatmentType } from '../../types/bhyt';
import { DrugResolutionResult } from '../../services/api/bhytApi';

export interface BhytDocumentFileDraft {
  name: string;
  type: 'pdf' | 'image';
  url: string; // Base64 dataUrl hoặc reconstructed ObjectURL
  blob?: Blob; // File blob nguyên bản được lưu trữ trong IndexedDB
  sizeKb?: number;
  originalSizeKb?: number;
  compressionRatio?: number;
}

export interface BhytDraftSession {
  documentFile: BhytDocumentFileDraft | null;
  activePayload: BhytPrescriptionPayload;
  hospitalRank: HospitalRank | '';
  treatmentType: TreatmentType | '';
  resolutionMap?: Record<string, DrugResolutionResult>;
  timestamp: number;
}

const DB_NAME = 'clinical_ward_bhyt_db';
const DB_VERSION = 1;
const STORE_NAME = 'bhyt_draft_store';
const DRAFT_KEY = 'active_bhyt_draft_v1';
const SESSION_BACKUP_KEY = 'clinical_bhyt_draft_meta_backup';

let memoryDraft: BhytDraftSession | null = null;

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(new Error('IndexedDB is not available'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Lưu phiên làm việc BHYT vào IndexedDB (Hỗ trợ lưu Blob lớn không giới hạn dung lượng)
 */
export async function saveBhytDraft(draft: BhytDraftSession): Promise<void> {
  memoryDraft = draft;

  // Lưu metadata gọn vào sessionStorage để làm lớp dự phòng tức thời
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const metaBackup = {
        hasDocument: !!draft.documentFile,
        fileName: draft.documentFile?.name || '',
        fileType: draft.documentFile?.type || '',
        activePayload: draft.activePayload,
        hospitalRank: draft.hospitalRank,
        treatmentType: draft.treatmentType,
        timestamp: draft.timestamp
      };
      window.sessionStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(metaBackup));
    }
  } catch (e) {
    // SessionStorage quota exceeded or private mode - bỏ qua an toàn
  }

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(draft, DRAFT_KEY);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        try { db.close(); } catch {}
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('[BHYT Draft] IndexedDB save warning:', err);
  }
}

/**
 * Khôi phục phiên làm việc BHYT từ IndexedDB hoặc bộ nhớ đệm
 */
export async function getBhytDraft(): Promise<BhytDraftSession | null> {
  if (memoryDraft) {
    return memoryDraft;
  }

  if (!isIndexedDBAvailable()) return null;

  try {
    const db = await openDatabase();
    const draft = await new Promise<BhytDraftSession | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(DRAFT_KEY);

      req.onsuccess = () => resolve((req.result as BhytDraftSession) || null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        try { db.close(); } catch {}
        reject(tx.error);
      };
    });

    if (!draft) return null;

    // Tái cấu trúc URL hợp lệ nếu file là Blob và URL cũ (blob:...) đã bị hết hạn
    if (draft.documentFile) {
      if (draft.documentFile.blob instanceof Blob) {
        // Tái sinh ObjectURL tươi mới từ Blob gốc lưu trong IndexedDB
        draft.documentFile.url = URL.createObjectURL(draft.documentFile.blob);
      }
    }

    memoryDraft = draft;
    return draft;
  } catch (err) {
    console.warn('[BHYT Draft] IndexedDB restore warning:', err);
    return null;
  }
}

/**
 * Xóa sạch bản nháp BHYT khi người dùng chủ động tải đơn mới hoặc ấn Xóa
 */
export async function clearBhytDraft(): Promise<void> {
  memoryDraft = null;

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(SESSION_BACKUP_KEY);
    }
  } catch {}

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(DRAFT_KEY);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        try { db.close(); } catch {}
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('[BHYT Draft] IndexedDB clear warning:', err);
  }
}
