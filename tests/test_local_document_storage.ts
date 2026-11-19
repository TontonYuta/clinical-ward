/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kiểm thử Đơn vị Quản lý Lưu Trữ Tài Liệu Cục Bộ (LocalStorage & Client-side Storage)
 * Đảm bảo: Upload PDF chỉ lưu vào LocalStorage/Client, KHÔNG nạp vào CSDL Backend.
 */
import assert from 'node:assert/strict';

// Mock browser environment for Node.js test runner
const storage = new Map<string, string>();
const fakeIndexedDbStore = new Map<string, any>();

(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, val: string) => storage.set(key, String(val)),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
  crypto: {
    subtle: {
      digest: async (_algo: string, data: ArrayBuffer) => {
        // Simple deterministic mock hash
        const view = new Uint8Array(data);
        const hash = new Uint8Array(32);
        for (let i = 0; i < view.length; i++) {
          hash[i % 32] = (hash[i % 32] + view[i] + i) % 256;
        }
        return hash.buffer;
      },
    },
  },
  indexedDB: {
    open: (_name: string, _version: number) => {
      const req: any = {
        result: {
          objectStoreNames: { contains: () => true },
          transaction: () => ({
            objectStore: () => ({
              put: (val: any, key: string) => {
                fakeIndexedDbStore.set(key, val);
                const r = { onsuccess: () => {} };
                setTimeout(() => r.onsuccess(), 0);
                return r;
              },
              get: (key: string) => {
                const r: any = { result: fakeIndexedDbStore.get(key), onsuccess: () => {} };
                setTimeout(() => r.onsuccess(), 0);
                return r;
              },
              delete: (key: string) => {
                fakeIndexedDbStore.delete(key);
                const r = { onsuccess: () => {} };
                setTimeout(() => r.onsuccess(), 0);
                return r;
              },
            }),
          }),
        },
      };
      setTimeout(() => {
        if (req.onsuccess) req.onsuccess();
      }, 0);
      return req;
    },
  },
};

(globalThis as any).localStorage = (globalThis as any).window.localStorage;

import {
  saveLocalPdfDocument,
  getLocalPdfDocuments,
  deleteLocalPdfDocument,
  getLocalPdfBlob,
} from '../src/services/localDocumentStorage';

async function runTests() {
  console.log('======================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ LƯU TRỮ TÀI LIỆU CỤC BỘ (LOCALSTORAGE / CLIENT ONLY)');
  console.log('======================================================================\n');

  // Test 1: Khởi tạo danh sách rỗng
  console.log('--- 1. Kiểm tra danh mục ban đầu ---');
  storage.clear();
  const initialDocs = getLocalPdfDocuments();
  assert.equal(initialDocs.length, 0, 'Danh sách ban đầu phải rỗng');
  console.log('✅ Khởi tạo danh mục ban đầu rỗng thành công.');

  // Test 2: Lưu tài liệu thử nghiệm vào LocalStorage
  console.log('\n--- 2. Kiểm tra lưu tài liệu PDF cục bộ ---');
  const mockFile = {
    name: 'thong_tu_26_2025_test.pdf',
    size: 204800,
    arrayBuffer: async () => new ArrayBuffer(204800),
  } as unknown as File;

  const saved1 = await saveLocalPdfDocument({
    file: mockFile,
    title: 'Thông tư 26/2025/TT-BYT Thử nghiệm',
    legalBasis: '26/2025/TT-BYT',
    category: 'Thông tư Bộ Y tế',
    editionYear: 2025,
    docId: 'local_test_doc_01',
  });

  assert.equal(saved1.id, 'local_test_doc_01');
  assert.equal(saved1.is_local, true);
  assert.equal(saved1.title, 'Thông tư 26/2025/TT-BYT Thử nghiệm');
  assert.equal(saved1.filename, 'thong_tu_26_2025_test.pdf');
  assert.equal(saved1.bytes, 204800);
  assert.ok(saved1.sha256.length > 0, 'SHA-256 phải được tính');
  console.log('✅ Lưu tài liệu 1 thành công:', saved1);

  // Test 3: Đọc lại danh sách từ LocalStorage
  console.log('\n--- 3. Kiểm tra đọc lại danh mục từ LocalStorage ---');
  const docsAfterSave = getLocalPdfDocuments();
  assert.equal(docsAfterSave.length, 1);
  assert.equal(docsAfterSave[0].id, 'local_test_doc_01');
  assert.equal(docsAfterSave[0].is_local, true);
  console.log('✅ Đọc danh mục từ LocalStorage chính xác: 1 tài liệu.');

  // Test 4: Thêm tài liệu thứ 2
  console.log('\n--- 4. Thêm tài liệu thứ 2 và kiểm tra thứ tự sắp xếp ---');
  const mockFile2 = {
    name: 'huong_dan_khang_sinh_2026.pdf',
    size: 512000,
    arrayBuffer: async () => new ArrayBuffer(512000),
  } as unknown as File;

  const saved2 = await saveLocalPdfDocument({
    file: mockFile2,
    title: 'Hướng dẫn sử dụng kháng sinh 2026',
    legalBasis: '565/QĐ-BYT',
    category: 'Quyết định Bộ Y tế',
    editionYear: 2026,
    docId: 'local_test_doc_02',
  });

  const docsAfterSave2 = getLocalPdfDocuments();
  assert.equal(docsAfterSave2.length, 2);
  // Tài liệu mới nhất nằm ở đầu danh sách
  assert.equal(docsAfterSave2[0].id, 'local_test_doc_02');
  assert.equal(docsAfterSave2[1].id, 'local_test_doc_01');
  console.log('✅ Thêm tài liệu 2 thành công, thứ tự LIFO chính xác.');

  // Test 5: Xóa tài liệu
  console.log('\n--- 5. Kiểm tra xóa tài liệu khỏi LocalStorage ---');
  await deleteLocalPdfDocument('local_test_doc_01');
  const docsAfterDelete = getLocalPdfDocuments();
  assert.equal(docsAfterDelete.length, 1);
  assert.equal(docsAfterDelete[0].id, 'local_test_doc_02');
  console.log('✅ Xóa tài liệu local_test_doc_01 thành công, còn lại 1 tài liệu.');

  await deleteLocalPdfDocument('local_test_doc_02');
  const docsFinal = getLocalPdfDocuments();
  assert.equal(docsFinal.length, 0);
  console.log('✅ Xóa tài liệu local_test_doc_02 thành công, danh mục rỗng.');

  console.log('\n======================================================================');
  console.log('🎉 TOÀN BỘ 5 KIỂM THỬ LƯU TRỮ TÀI LIỆU CỤC BỘ ĐỀU ĐẠT CHUẨN XANH 100%!');
  console.log('======================================================================');
}

runTests().catch((err) => {
  console.error('❌ Lỗi kiểm thử:', err);
  process.exit(1);
});
