/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Loại bỏ thông tin mù/giả lập khỏi Cổng Dược Quốc Gia & Khóa cứng 100% dữ liệu chắc chắn (<=200 LOC)
 */

import * as fs from 'fs';
import * as path from 'path';
import { INPATIENT_CENTRAL_BATCHES } from '../src/data/pharmacy/inpatientCentralBatches';
import { WARD_EMERGENCY_BATCHES } from '../src/data/pharmacy/wardEmergencyBatches';
import { OUTPATIENT_INVENTORY_BATCHES } from '../src/data/pharmacy/outpatientBatches';
import { ALL_CLINICAL_PROFILES } from '../src/data/clinicalProfiles';

const allBatches = [
  ...INPATIENT_CENTRAL_BATCHES,
  ...WARD_EMERGENCY_BATCHES,
  ...OUTPATIENT_INVENTORY_BATCHES,
];

// Map tính tồn kho thực tế từ các lô bệnh viện
const actualStockMap = new Map<string, { stock: number; batches: number; unit: string }>();
allBatches.forEach(b => {
  const keys = [
    b.registrationNumber?.toLowerCase().trim(),
    b.nationalCode?.toLowerCase().trim(),
    b.itemCode?.toLowerCase().trim(),
  ].filter(Boolean) as string[];

  keys.forEach(k => {
    const cur = actualStockMap.get(k) || { stock: 0, batches: 0, unit: b.unit };
    actualStockMap.set(k, {
      stock: cur.stock + b.currentStock,
      batches: cur.batches + 1,
      unit: b.unit,
    });
  });
});

const files = [
  path.resolve(process.cwd(), 'public/data/vietnam_drug_registry/dav_essential_formulary.json'),
  path.resolve(process.cwd(), 'data/vietnam_drug_registry/dav_essential_formulary.json'),
];

files.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(`\n🧹 Xử lý tệp: ${filePath} (${rawData.length} thuốc)`);

  let purifiedCount = 0;
  let inWarehouseCount = 0;

  const purified = rawData.map((drug: any) => {
    const code = (drug.nationalCode || drug.id || '').toLowerCase().trim();
    const match = actualStockMap.get(code);

    if (match) {
      inWarehouseCount++;
      // Thuốc thực tế có trong kho viện: Giữ tồn kho thật
      drug.hospitalStockCount = match.stock;
      drug.batchCount = match.batches;
      drug.standardUnit = match.unit;
      return drug;
    } else {
      purifiedCount++;
      // Thuốc chỉ có trên Cục QLD (chưa nhập kho viện):
      // 1. Tồn kho viện bắt buộc là 0 (không bịa số tồn)
      drug.hospitalStockCount = 0;
      drug.wardStockCount = 0;
      drug.batchCount = 0;

      // 2. Loại bỏ clinicalProfile mù/giả lập nếu không có chuyên luận thật
      const hasRealProfile = Object.values(ALL_CLINICAL_PROFILES).some(
        p => p.officialSource?.registrationNumber?.toLowerCase() === code
      );
      if (!hasRealProfile) {
        delete drug.clinicalProfile;
      }

      // 3. Đường dùng chuẩn: không tự ý gán bừa "Đường uống"
      if (!drug.route || drug.route === 'Đường uống') {
        const form = (drug.dosageForm || '').toLowerCase();
        if (form.includes('tiêm')) drug.route = 'Đường tiêm';
        else if (form.includes('uống') || form.includes('viên') || form.includes('nang')) drug.route = 'Đường uống';
        else drug.route = 'Theo dạng bào chế';
      }

      return drug;
    }
  });

  fs.writeFileSync(filePath, JSON.stringify(purified, null, 2), 'utf8');
  console.log(`   ✅ Đã loại bỏ thông tin mù/giả lập cho ${purifiedCount} thuốc ngoài kho.`);
  console.log(`   ✅ Giữ nguyên tồn kho thực tế cho ${inWarehouseCount} thuốc trong Kho Bệnh Viện.`);
});

console.log('\n======================================================================');
console.log('🎉 TOÀN BỘ DATASET ĐÃ ĐƯỢC LÀM SẠCH VÀ KHÓA CỨNG THEO CỤC QLD!');
console.log('======================================================================\n');
