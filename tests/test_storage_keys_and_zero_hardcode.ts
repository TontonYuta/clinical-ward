/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Unit test xác thực ngăn chặn tái phát Hardcode & Xung đột Storage Keys
 */

import assert from 'node:assert/strict';
import { STORAGE_KEYS } from '../src/constants/storageKeys';
import { FACILITY_CONFIG } from '../src/config/facilityConfig';
import { inventoryApi } from '../src/services/api/inventoryApi';

console.log('=== TEST STORAGE KEYS & ZERO-HARDCODE STANDARDIZATION ===');

// 1. Kiểm tra Centralized Storage Keys
assert.equal(STORAGE_KEYS.CLINICAL_CACHED_CPOE, 'clinical_cached_cpoe');
assert.equal(STORAGE_KEYS.LEGACY_CPOE_PRESCRIPTIONS_V2, 'cpoe_prescriptions_cache_v2');
assert.equal(STORAGE_KEYS.CLINICAL_CHAT_MESSAGES, 'clinical_chat_messages');
console.log('✅ Storage Keys: Tập trung hóa và nhất quán giữa CPOE & Chat');

// 2. Kiểm tra Facility Config
assert.ok(FACILITY_CONFIG.HOSPITAL_NAME.length > 0);
assert.ok(FACILITY_CONFIG.HOTLINE.length > 0);
assert.ok(FACILITY_CONFIG.DEFAULT_DOCTOR_NAME.length > 0);
console.log('✅ Facility Config: Đã cấu hình tập trung thông tin cơ sở khám chữa bệnh');

// 3. Kiểm tra Inventory API không tự ghép mảng tĩnh khi mock fetch thành công
const originalFetch = globalThis.fetch;
try {
  const mockApiBatches = [
    {
      id: 'BATCH-LIVE-01',
      item_name: 'Kháng sinh Paracetamol 500mg',
      batch_number: 'LOT-2026-X1',
      expiry_date: '2027-12-31',
      days_left: 400,
      is_near_expiry: false,
      current_stock: 500,
      min_threshold: 50,
      max_threshold: 1000,
      is_low_stock: false,
      unit: 'Viên',
      warehouse_location: 'Kho Chẵn Trung Tâm',
      category: 'Thuốc Tân Dược Kháng Sinh'
    }
  ];

  globalThis.fetch = async (url: any) => {
    return new Response(JSON.stringify(mockApiBatches), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const batches = await inventoryApi.fetchInventoryBatches();
  assert.equal(batches.length, 1, 'Khi API thành công, chỉ lấy 100% dữ liệu thực từ backend, không ghép mảng tĩnh');
  assert.equal(batches[0].id, 'BATCH-LIVE-01');
  console.log('✅ Inventory API: Phản ánh 100% dữ liệu kho thực từ Backend, không chèn lô thuốc tĩnh');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('🎉 TOÀN BỘ KIỂM THỬ CHUẨN HÓA ZERO-HARDCODE ĐÃ ĐẠT 100% GREEN!');
