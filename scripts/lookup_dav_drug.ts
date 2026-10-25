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
              const cb = item.thongTinThuocCoBan || {};
              const dk = item.thongTinDangKyThuoc || {};
              const sx = item.congTySanXuat || {};
              const ctyDk = item.congTyDangKy || {};

              const hoatChat = cb.hoatChatChinh || item.hoatChatDangKy || item.hoatChatHamLuong || item.tenHoatChatChinh || 'Theo hồ sơ công bố';
              const hamLuong = cb.hamLuong || item.hamLuong || '';
              const hcHlStr = hamLuong && !hoatChat.includes(hamLuong) ? `${hoatChat} (${hamLuong})` : hoatChat;

              const dangBaoChe = cb.dangBaoChe || item.dangBaoChe || 'N/A';
              const quyCach = cb.dongGoi || item.dongGoi || 'N/A';
              const tieuChuan = cb.tieuChuan || item.tieuChuan || 'Tiêu chuẩn NSX';
              const tuoiTho = cb.tuoiTho || item.tuoiTho || 'N/A';

              const tenNsx = sx.tenCongTySanXuat || item.tenCongTySanXuat || 'N/A';
              const nuocNsx = sx.nuocSanXuat || item.nuocSanXuat || 'Việt Nam';
              const diaChiNsx = sx.diaChiSanXuat || item.diaChiSanXuat || '';
              const tenCtyDk = ctyDk.tenCongTyDangKy || item.tenCongTyDangKy || 'N/A';
              const soQd = dk.soQuyetDinh || item.soQuyetDinh || 'N/A';
              const dotCap = dk.dotCap || item.dotCap || '';

              const ngayCap = dk.ngayCapSoDangKy ? new Date(dk.ngayCapSoDangKy).toLocaleDateString('vi-VN') : 'N/A';
              const ngayHetHan = dk.ngayHetHanSoDangKy ? new Date(dk.ngayHetHanSoDangKy).toLocaleDateString('vi-VN') : 'Vô thời hạn / Đang gia hạn';

              console.log(`┌─ [${idx + 1}] ${item.tenThuoc || 'Chưa đặt tên'} [${statusStr}]`);
              console.log(`│  • Mã định danh (SĐK mới 12 số): ${item.soDangKy || 'N/A'}`);
              console.log(`│  • Số đăng ký cũ (VD/VN/QLSP):   ${item.soDangKyCu || item.soDangKy || 'N/A'}`);
              console.log(`│  • Hoạt chất & Hàm lượng:        ${hcHlStr}`);
              console.log(`│  • Dạng bào chế:                 ${dangBaoChe}`);
              console.log(`│  • Quy cách đóng gói:            ${quyCach}`);
              console.log(`│  • Tiêu chuẩn & Tuổi thọ:        ${tieuChuan} | Hạn dùng: ${tuoiTho}`);
              console.log(`│  • Cơ sở sản xuất:               ${tenNsx} (${nuocNsx})`);
              if (diaChiNsx) console.log(`│    └ Địa chỉ nhà máy:            ${diaChiNsx}`);
              console.log(`│  • Cơ sở đăng ký:                ${tenCtyDk}`);
              console.log(`│  • Quyết định cấp phép:          ${soQd}${dotCap ? ` (Đợt cấp: ${dotCap})` : ''}`);
              console.log(`│  • Thời hạn lưu hành:            ${ngayCap} -> ${ngayHetHan}`);
              if (item.maSoHoSoGiaHan) {
                console.log(`│  • Mã hồ sơ gia hạn (Bộ Y Tế):  ${item.maSoHoSoGiaHan} (Lưu trữ nội bộ Cục QLD, không có link tải công khai)`);
              }
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
