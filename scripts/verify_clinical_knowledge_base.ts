import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KB_DIR = path.resolve(__dirname, '../backend/data/knowledge_base');
const DB_PATH = process.env.CLINICAL_KB_DB_PATH
  ? path.resolve(process.env.CLINICAL_KB_DB_PATH)
  : path.resolve(__dirname, '../backend/clinical_hospital.db');
const PYTHON = process.env.CLINICAL_KB_PYTHON || 'python3';
const READ_ONLY_INN_QUERY = `
import pathlib, sqlite3, sys
uri = pathlib.Path(sys.argv[1]).resolve().as_uri() + '?mode=ro'
with sqlite3.connect(uri, uri=True) as db:
    db.execute('PRAGMA query_only = ON')
    row = db.execute(
        'SELECT count(*) FROM dav_national_drugs WHERE active_ingredient LIKE ?',
        ('%' + sys.argv[2] + '%',),
    ).fetchone()
    print(row[0])
`;

const REQUIRED_FILES = [
  'README.md',
  'ddi_interactions/qd_5948_antibiotics_and_antiinflammatory.md',
  'ddi_interactions/qd_5948_cardiovascular_and_cns.md',
  'ddi_interactions/qd_5948_anticoagulants_and_hematology.md',
  'ddi_interactions/qd_5948_metabolic_and_gastrointestinal.md',
  'clinical_pharmacopoeia/core_inns_monographs.md',
  'regulatory_circulars/tt51_2017_anaphylaxis_protocol.md',
  'regulatory_circulars/tt20_2017_narcotics_management.md',
  'regulatory_circulars/tt22_2011_hospital_pharmacy_ward.md'
];

console.log('======================================================================');
console.log('🔬 KIỂM TRA CẤU TRÚC TÀI LIỆU, LIÊN KẾT NGUỒN VÀ MAPPING DAV');
console.log('======================================================================\n');

let allPassed = true;

// 1. Kiểm tra sự tồn tại và giới hạn dòng (<= 200 LOC)
for (const relPath of REQUIRED_FILES) {
  const fullPath = path.join(KB_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ THIẾU TỆP: ${relPath}`);
    allPassed = false;
    continue;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n').length;
  if (lines > 200) {
    console.error(`❌ VƯỢT QUÁ 200 LOC: ${relPath} (${lines} dòng)`);
    allPassed = false;
  } else {
    console.log(`✅ [TỆP ĐẠT CHUẨN] ${relPath.padEnd(55)} (${lines} LOC <= 200)`);
  }
}

// 2. Kiểm tra văn bản căn cứ pháp lý chính thức
const LEGAL_ANCHORS = [
  { file: 'ddi_interactions/qd_5948_antibiotics_and_antiinflammatory.md', term: '5948/QĐ-BYT' },
  { file: 'ddi_interactions/qd_5948_cardiovascular_and_cns.md', term: '5948/QĐ-BYT' },
  { file: 'ddi_interactions/qd_5948_anticoagulants_and_hematology.md', term: '5948/QĐ-BYT' },
  { file: 'ddi_interactions/qd_5948_metabolic_and_gastrointestinal.md', term: '5948/QĐ-BYT' },
  { file: 'clinical_pharmacopoeia/core_inns_monographs.md', term: 'dữ liệu dẫn xuất' },
  { file: 'regulatory_circulars/tt51_2017_anaphylaxis_protocol.md', term: '51/2017/TT-BYT' },
  { file: 'regulatory_circulars/tt20_2017_narcotics_management.md', term: '20/2017/TT-BYT' },
  { file: 'regulatory_circulars/tt22_2011_hospital_pharmacy_ward.md', term: '22/2011/TT-BYT' }
];

console.log('\n--- Kiểm tra căn cứ pháp lý (Legal Grounds) ---');
for (const anchor of LEGAL_ANCHORS) {
  const fullPath = path.join(KB_DIR, anchor.file);
  if (!fs.existsSync(fullPath)) continue; // Already reported by the required-files check.
  const text = fs.readFileSync(fullPath, 'utf8');
  if (text.includes(anchor.term)) {
    console.log(`✅ [PHÁP LÝ HỢP LỆ] ${anchor.term} được trích xuất chính thức trong ${anchor.file}`);
  } else {
    console.error(`❌ [THIẾU CĂN CỨ] Không tìm thấy ${anchor.term} trong ${anchor.file}`);
    allPassed = false;
  }
}

// 3. Khớp nối hoạt chất trong Kho Tri Thức với CSDL 54.885 thuốc DAV
if (fs.existsSync(DB_PATH)) {
  console.log('\n--- Kiểm tra đối chiếu Hoạt chất với CSDL 54.885 thuốc DAV ---');
  const checkINNs = ['Paracetamol', 'Ceftriaxon', 'Morphin', 'Diazepam', 'Adrenalin', 'Vancomycin'];
  
  for (const inn of checkINNs) {
    try {
      const result = execFileSync(PYTHON, ['-c', READ_ONLY_INN_QUERY, DB_PATH, inn], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
      if (!/^\d+$/.test(result)) throw new Error('Database query did not return a valid count');
      const cnt = Number(result);
      if (cnt > 0) {
        console.log(`✅ Hoạt chất "${inn}": Khớp với ${cnt} số đăng ký biệt dược trong dav_national_drugs`);
      } else {
        console.error(`❌ Hoạt chất "${inn}": Không tìm thấy trong CSDL DAV`);
        allPassed = false;
      }
    } catch (e) {
      console.error(`❌ Không thể kiểm tra CSDL DAV cho "${inn}": ${e}`);
      allPassed = false;
    }
  }
} else if (process.env.CLINICAL_KB_DB_PATH) {
  console.error(`❌ Không tìm thấy CSDL DAV được chỉ định: ${DB_PATH}`);
  allPassed = false;
} else {
  console.warn('⚠️ Không có CSDL cục bộ: chỉ kiểm tra tài liệu; chưa kiểm tra mapping DAV.');
}

console.log('\n======================================================================');
if (allPassed) {
  console.log('🎯 KẾT QUẢ: CÁC KIỂM TRA CẤU TRÚC VÀ LIÊN KẾT ĐÃ QUA; CHƯA THAY THẾ THẨM ĐỊNH LÂM SÀNG');
} else {
  console.error('❌ CÓ LỖI XẢY RA TRONG QUÁ TRÌNH KIỂM CHỨNG TÀI LIỆU!');
  process.exit(1);
}
console.log('======================================================================');
