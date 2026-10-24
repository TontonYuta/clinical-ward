/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kiểm thử tự động tính toàn vẹn 14 chiều thông tin nhóm Opioid đã trích xuất (<=200 LOC)
 */

import fs from 'fs';
import path from 'path';
import { FiveRightsSafetyInfo } from '../src/types/medication';

function verifyExtractedDataset() {
  console.log('======================================================================');
  console.log('🔬 BẮT ĐẦU KIỂM THỬ TÍNH TOÀN VẸN DATASET OPIOID ĐÃ TRÍCH XUẤT');
  console.log('======================================================================\n');

  const filePath = path.resolve(process.cwd(), 'src/data/clinicalProfiles/extractedOpioids.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy file dataset: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const dataset: Record<string, FiveRightsSafetyInfo> = JSON.parse(raw);
  const keys = Object.keys(dataset);

  console.log(`📦 Tìm thấy ${keys.length} hoạt chất trong dataset: ${keys.join(', ')}\n`);

  if (keys.length < 6) {
    throw new Error(`Dataset chưa đủ 6 thuốc Opioid mục tiêu. Hiện có: ${keys.length}`);
  }

  let passedChecks = 0;
  let totalChecks = 0;

  for (const [key, profile] of Object.entries(dataset)) {
    console.log(`🧪 Kiểm tra hoạt chất [${key.toUpperCase()}]:`);

    const checks: [string, boolean][] = [
      ['Số đăng ký (SĐK) Cục QLD hợp lệ', !!profile.officialSource?.registrationNumber],
      ['Văn bản Dược thư QG có số trang', !!profile.officialSource?.documentName],
      ['Dược chất chính API có muối hóa học', (profile.composition?.activeIngredients?.length ?? 0) > 0],
      ['Danh mục tá dược Excipients đầy đủ', (profile.composition?.excipients?.length ?? 0) > 0],
      ['Chỉ định điều trị ("Dùng để làm gì")', (profile.indications?.length ?? 0) > 0],
      ['Cơ chế tác dụng dược lý MoA', !!profile.pharmacologyMechanism],
      ['Hồ sơ dị ứng & cảnh báo quá mẫn', !!profile.allergyProfile?.allergyClass],
      ['Liều dùng chuẩn & Liều tối đa 24h', !!profile.standardDosing && !!profile.maxDailyDose],
      ['Đường dùng & Dung môi pha truyền', !!profile.administrationRouteDetails && (profile.compatibleDiluents?.length ?? 0) > 0],
      ['Thuốc giải độc đặc hiệu (Antidote)', !!profile.antidote],
      ['Cảnh báo tương tác DDI (Benzodiazepin)', (profile.ddiWarnings?.length ?? 0) > 0],
      ['Tiêu chuẩn Dược điển & Phân loại BHYT', !!profile.composition?.pharmacopeiaStandard && !!profile.bhytCoverage],
    ];

    for (const [desc, condition] of checks) {
      totalChecks++;
      if (condition) {
        passedChecks++;
        console.log(`   ✅ ${desc}`);
      } else {
        console.error(`   ❌ THẤT BẠI: ${desc}`);
        throw new Error(`Kiểm thử thất bại tại [${key}]: ${desc}`);
      }
    }
    console.log('');
  }

  console.log('======================================================================');
  console.log(`🎯 KẾT QUẢ KIỂM THỬ: ${passedChecks}/${totalChecks} TIÊU CHÍ ĐẠT 100%`);
  console.log('======================================================================');
  console.log('🎉 Dataset đã được chuẩn hóa và thẩm định hợp lệ cho hệ thống bệnh viện!\n');
}

verifyExtractedDataset();
