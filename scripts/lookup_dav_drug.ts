/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CLI Tra cứu trực tiếp 55.005 Thuốc trên Cục Quản lý Dược (dichvucong.dav.gov.vn) (<=200 LOC)
 * Usage: npx tsx scripts/lookup_dav_drug.ts <SĐK_hoặc_TênThuốc>
 */

import https from 'https';

const API_ENDPOINT = 'https://dichvucong.dav.gov.vn/api/services/app/soDangKy/GetAllPublicServerPaging';

export async function lookupDavDrug(query: string, maxCount = 5) {
  if (!query) {
    console.log('❌ Vui lòng nhập từ khóa tra cứu (Ví dụ: npx tsx scripts/lookup_dav_drug.ts VD-28087-17)');
    process.exit(1);
  }

  console.log('======================================================================');
  console.log(`🔍 TRA CỨU CƠ SỞ DỮ LIỆU DƯỢC QUỐC GIA (55.005 THUỐC) - CỤC QUẢN LÝ DƯỢC`);
  console.log(`🎯 Từ khóa: "${query}" | Cổng dữ liệu: dichvucong.dav.gov.vn`);
  console.log('======================================================================\n');

  const payload = JSON.stringify({
    skipCount: 0,
    maxResultCount: maxCount,
    filterText: query.trim(),
    SoDangKyThuoc: {},
    KichHoat: true,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      API_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Content-Length': Buffer.byteLength(payload),
        },
        rejectUnauthorized: false,
        timeout: 15000,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(rawData);
            const total = json?.result?.totalCount || 0;
            const items = json?.result?.items || [];

            console.log(`📊 Tìm thấy tổng cộng ${total} kết quả phù hợp:\n`);

            if (items.length === 0) {
              console.log('⚠️ Không tìm thấy thuốc nào khớp với từ khóa trên Cổng Cục QLD.');
              resolve({ total, items: [] });
              return;
            }

            items.forEach((item: any, idx: number) => {
              const statusStr = item.isHetHan ? '🔴 ĐÃ HẾT HẠN / THU HỒI' : '🟢 ĐANG HIỆU LỰC LƯU HÀNH';
              console.log(`┌─ [${idx + 1}] ${item.tenThuoc || 'Chưa đặt tên'} [${statusStr}]`);
              console.log(`│  • Mã định danh (SĐK mới): ${item.soDangKy || 'N/A'}`);
              console.log(`│  • Số đăng ký cũ (VD/VN):  ${item.soDangKyCu || item.soDangKy || 'N/A'}`);
              console.log(`│  • Hoạt chất & Hàm lượng:  ${item.hoatChatHamLuong || item.tenHoatChatChinh || 'Theo hồ sơ công bố'}`);
              console.log(`│  • Dạng bào chế & Đóng gói: ${item.dangBaoChe || 'N/A'} | ${item.dongGoi || 'N/A'}`);
              console.log(`│  • Tiêu chuẩn & Tuổi thọ:  ${item.tieuChuan || 'Tiêu chuẩn NSX'} | ${item.tuoiTho || 'N/A'} tháng`);
              console.log(`│  • Cơ sở sản xuất:         ${item.tenCongTySanXuat || 'N/A'} (${item.nuocSanXuat || 'Việt Nam'})`);
              console.log(`│  • Cơ sở đăng ký:          ${item.tenCongTyDangKy || 'N/A'}`);
              console.log(`│  • Quyết định cấp phép:    ${item.soQuyetDinh || item.thongTinDangKyThuoc?.soQuyetDinh || 'N/A'}`);
              console.log(`│  • Ngày cấp & Ngày hết hạn: ${item.thongTinDangKyThuoc?.ngayCapSoDangKy ? new Date(item.thongTinDangKyThuoc.ngayCapSoDangKy).toLocaleDateString('vi-VN') : 'N/A'} -> ${item.thongTinDangKyThuoc?.ngayHetHanSoDangKy ? new Date(item.thongTinDangKyThuoc.ngayHetHanSoDangKy).toLocaleDateString('vi-VN') : 'N/A'}`);
              console.log(`└─────────────────────────────────────────────────────────────\n`);
            });

            resolve({ total, items });
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.on('error', (err) => {
      console.error('❌ Lỗi kết nối Cổng Cục Quản lý Dược:', err.message);
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

const arg = process.argv.slice(2).join(' ');
if (arg) {
  lookupDavDrug(arg);
}
