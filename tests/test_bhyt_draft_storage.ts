/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Unit Test cho Quản lý Lưu trữ & Phục hồi Bản nháp BHYT (BHYT Draft Persistence)
 */

import assert from 'node:assert/strict';
import {
  saveBhytDraft,
  getBhytDraft,
  clearBhytDraft,
  BhytDraftSession
} from '../src/utils/storage/bhytDraftStorage';
import { BhytPrescriptionPayload } from '../src/types/bhyt';

// Thiết lập môi trường window & sessionStorage mock cho Node.js runner
const sessionStore = new Map<string, string>();
(globalThis as any).window = {
  sessionStorage: {
    getItem: (key: string) => sessionStore.get(key) || null,
    setItem: (key: string, val: string) => sessionStore.set(key, val),
    removeItem: (key: string) => sessionStore.delete(key),
    clear: () => sessionStore.clear()
  }
};

async function runTests() {
  console.log('🧪 Bắt đầu kiểm thử BHYT Draft Persistence (Lưu trữ ảnh & đơn BHYT)...\n');

  // 1. Kiểm tra trạng thái rỗng ban đầu
  await clearBhytDraft();
  const initial = await getBhytDraft();
  assert.equal(initial, null, 'Ban đầu getBhytDraft phải trả về null');
  console.log('✅ PASSED: Trạng thái ban đầu rỗng');

  // 2. Lưu bản nháp đơn thuốc có ảnh và dữ liệu bóc tách
  const mockPayload: BhytPrescriptionPayload = {
    prescriptionId: 'RX-TEST-2026',
    patientName: 'Trần Thị B',
    patientAge: 45,
    insuranceCardNumber: 'DN4010999999999',
    hospitalRank: 'HANG_II',
    treatmentType: 'NGOAI_TRU',
    primaryIcd10: 'I10',
    primaryDiagnosis: 'Tăng huyết áp vô căn',
    items: [
      {
        id: 'ITEM-1',
        drugName: 'Amlodipin 5mg',
        quantity: 30,
        unit: 'Viên',
        dosage: '1 viên/ngày',
        daysSupply: 30,
        unitPrice: 0,
        activeIngredient: 'Amlodipin',
        drugCode: 'AMLO-5',
        route: 'Uống'
      }
    ]
  };

  const sampleDraft: BhytDraftSession = {
    documentFile: {
      name: 'don_thuoc_benh_nhan_b.jpg',
      type: 'image',
      url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD...',
      sizeKb: 145,
      originalSizeKb: 1850,
      compressionRatio: 92
    },
    activePayload: mockPayload,
    hospitalRank: 'HANG_II',
    treatmentType: 'NGOAI_TRU',
    resolutionMap: {},
    timestamp: Date.now()
  };

  await saveBhytDraft(sampleDraft);
  console.log('✅ PASSED: Gọi saveBhytDraft thành công không ném lỗi');

  // 3. Khôi phục bản nháp
  const restored = await getBhytDraft();
  assert.ok(restored !== null, 'Bản nháp phải khôi phục thành công');
  assert.equal(restored?.documentFile?.name, 'don_thuoc_benh_nhan_b.jpg', 'Tên file ảnh phải bảo toàn chính xác');
  assert.equal(restored?.documentFile?.type, 'image', 'Định dạng tệp phải là image');
  assert.equal(restored?.documentFile?.sizeKb, 145, 'Dung lượng nén ảnh phải chính xác');
  assert.equal(restored?.activePayload.patientName, 'Trần Thị B', 'Tên bệnh nhân phải bảo toàn');
  assert.equal(restored?.activePayload.items.length, 1, 'Danh sách thuốc phải có 1 mục');
  assert.equal(restored?.hospitalRank, 'HANG_II', 'Tuyến bệnh viện phải được bảo toàn');
  console.log('✅ PASSED: Khôi phục trọn vẹn tệp ảnh, metadata và danh mục thuốc');

  // 4. Kiểm tra sao lưu sessionStorage
  const backupRaw = (globalThis as any).window.sessionStorage.getItem('clinical_bhyt_draft_meta_backup');
  assert.ok(backupRaw !== null, 'SessionStorage phải có bản sao lưu');
  const backup = JSON.parse(backupRaw);
  assert.equal(backup.hasDocument, true, 'hasDocument trong backup phải là true');
  assert.equal(backup.fileName, 'don_thuoc_benh_nhan_b.jpg');
  console.log('✅ PASSED: Backup sessionStorage hoạt động độc lập và an toàn');

  // 5. Xóa bản nháp khi bắt đầu đơn mới
  await clearBhytDraft();
  const afterClear = await getBhytDraft();
  assert.equal(afterClear, null, 'Sau khi clearBhytDraft, dữ liệu phải được làm sạch');
  const backupAfterClear = (globalThis as any).window.sessionStorage.getItem('clinical_bhyt_draft_meta_backup');
  assert.equal(backupAfterClear, null, 'SessionStorage backup cũng phải được xóa sạch');
  console.log('✅ PASSED: Xóa sạch bản nháp khi bấm Tạo đơn mới');

  console.log('\n🎉 TOÀN BỘ CÁC TEST CASES BHYT DRAFT PERSISTENCE ĐÃ ĐẠT 100% GREEN!');
}

runTests().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
