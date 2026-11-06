import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_PDF_DIR = path.resolve(__dirname, '../public/pdf');

const REQUIRED_PDFS = [
  {
    name: 'Thông tư 26/2025/TT-BYT (Kê đơn điện tử)',
    filename: 'Thong_Tu_26_2025_TT_BYT_Ke_Don_Thuoc.pdf',
    documentCode: '26/2025/TT-BYT',
  },
  {
    name: 'Dược Thư Quốc Gia Việt Nam (Lần II)',
    filename: 'Duoc_Thu_Quoc_Gia_Viet_Nam.pdf',
    documentCode: '2033/QĐ-BYT',
  },
  {
    name: 'Quyết định 5948/QĐ-BYT (Tương tác chống chỉ định)',
    filename: 'Quyet_Dinh_5948_QD_BYT_Danh_Muc_Tuong_Tac_Chong_Chi_Dinh.pdf',
    documentCode: '5948/QĐ-BYT',
  },
  {
    name: 'Thông tư 51/2017/TT-BYT (Cấp cứu phản vệ)',
    filename: 'Thong_Tu_51_2017_TT_BYT_Huong_Dan_Phong_Chan_Doan_Xu_Tri_Phan_Ve.pdf',
    documentCode: '51/2017/TT-BYT',
  },
  {
    name: 'Thông tư 20/2017/TT-BYT (Kiểm soát đặc biệt)',
    filename: 'Thong_Tu_20_2017_TT_BYT_Thuoc_Kiem_Soat_Dac_Biet.pdf',
    documentCode: '20/2017/TT-BYT',
  },
  {
    name: 'Thông tư 22/2011/TT-BYT (Khoa Dược bệnh viện)',
    filename: 'Thong_Tu_22_2011_TT_BYT_Khoa_Duoc_Benh_Vien.pdf',
    documentCode: '22/2011/TT-BYT',
  },
  {
    name: 'Thông tư 23/2011/TT-BYT (Sử dụng thuốc tại cơ sở có giường bệnh)',
    filename: 'Thong_Tu_23_2011_TT_BYT_Huong_Dan_Su_Dung_Thuoc.pdf',
    documentCode: '23/2011/TT-BYT',
  },
];

interface PdfProvenance {
  filename: string;
  document_code: string;
  issued_on: string;
  bytes: number;
  sha256: string;
  pages: number;
  source_url: string | null;
  identity_method: string;
  representation: string;
}

const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC_PDF_DIR, 'source-provenance.json'), 'utf8')) as {
  manifest_version: number;
  sources: PdfProvenance[];
};
assert.equal(manifest.manifest_version, 1, 'Unsupported PDF provenance manifest version');
assert.equal(new Set(manifest.sources.map(source => source.filename)).size, manifest.sources.length,
  'Provenance must not contain duplicate filenames');

for (const item of REQUIRED_PDFS) {
  const filePath = path.join(PUBLIC_PDF_DIR, item.filename);
  assert.ok(fs.existsSync(filePath), `Missing PDF file: ${item.filename}`);

  const source = manifest.sources.find(entry => entry.filename === item.filename);
  assert.ok(source, `Missing verified provenance for ${item.filename}`);
  assert.equal(source.document_code, item.documentCode, `Wrong document identity for ${item.filename}`);
  assert.match(source.issued_on, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Number.isInteger(source.pages) && source.pages > 0, `Missing parsed page count for ${item.filename}`);
  assert.ok(source.identity_method, `Missing identity verification method for ${item.filename}`);
  assert.equal(source.representation, 'source_pdf');
  if (item.documentCode !== '2033/QĐ-BYT') {
    assert.ok(source.source_url?.startsWith('https://'), `Missing authoritative download URL for ${item.filename}`);
  }

  // Exact verified bytes replace scan-specific minimum-size assumptions. A real
  // text Gazette PDF may be far smaller than a scan of the same circular.
  const bytes = fs.readFileSync(filePath);
  assert.equal(bytes.subarray(0, 5).toString('ascii'), '%PDF-', `Invalid PDF header: ${item.filename}`);
  assert.ok(bytes.subarray(-2048).includes(Buffer.from('%%EOF')), `Truncated PDF: ${item.filename}`);
  assert.equal(bytes.length, source.bytes, `PDF byte length changed: ${item.filename}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256,
    `PDF differs from the verified publisher artifact: ${item.filename}`);
}

console.log(`pdf integrity and provenance checks passed for ${REQUIRED_PDFS.length} verified source artifacts`);
