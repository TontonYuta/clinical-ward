import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_PDF_DIR = path.resolve(__dirname, '../public/pdf');

const REQUIRED_PDFS = [
  {
    name: 'Thông tư 26/2025/TT-BYT (Kê đơn điện tử)',
    filename: 'Thong_Tu_26_2025_TT_BYT_Ke_Don_Thuoc.pdf',
    minBytes: 2_000_000,
  },
  {
    name: 'Dược Thư Quốc Gia Việt Nam (Lần II)',
    filename: 'Duoc_Thu_Quoc_Gia_Viet_Nam.pdf',
    minBytes: 30_000_000,
  },
  {
    name: 'Quyết định 5948/QĐ-BYT (Tương tác chống chỉ định)',
    filename: 'Quyet_Dinh_5948_QD_BYT_Danh_Muc_Tuong_Tac_Chong_Chi_Dinh.pdf',
    minBytes: 4_000_000,
  },
  {
    name: 'Thông tư 51/2017/TT-BYT (Cấp cứu phản vệ)',
    filename: 'Thong_Tu_51_2017_TT_BYT_Huong_Dan_Phong_Chan_Doan_Xu_Tri_Phan_Ve.pdf',
    minBytes: 2_500_000,
  },
  {
    name: 'Thông tư 20/2017/TT-BYT (Kiểm soát đặc biệt)',
    filename: 'Thong_Tu_20_2017_TT_BYT_Thuoc_Kiem_Soat_Dac_Biet.pdf',
    minBytes: 500_000,
  },
  {
    name: 'Thông tư 22/2011/TT-BYT (Khoa Dược bệnh viện)',
    filename: 'Thong_Tu_22_2011_TT_BYT_Khoa_Duoc_Benh_Vien.pdf',
    minBytes: 500_000,
  },
];

for (const item of REQUIRED_PDFS) {
  const filePath = path.join(PUBLIC_PDF_DIR, item.filename);
  assert.ok(fs.existsSync(filePath), `Missing PDF file: ${item.filename}`);

  const stat = fs.statSync(filePath);
  assert.ok(stat.size >= item.minBytes, `File ${item.filename} is too small: ${stat.size} bytes`);

  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(5);
  fs.readSync(fd, buffer, 0, 5, 0);
  fs.closeSync(fd);

  assert.equal(buffer.toString('utf-8'), '%PDF-', `File ${item.filename} has invalid PDF magic bytes`);
}

console.log('pdf files integrity checks passed');
