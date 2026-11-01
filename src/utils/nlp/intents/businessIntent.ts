/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Xử lý Ý định: Bản Đồ 10 Đại Nghiệp Vụ Bệnh Viện & Quy Trình Lâm Sàng Chuẩn BYT (<=100 LOC)
 */

import { ChatMessage } from '../../../types/clinical';
import { anyKeyword, ProcessedQueryResult } from '../types';

export function matchBusinessIntent(lower: string): boolean {
  const clean = lower.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  const isGreeting = clean === 'hi' || clean === 'hello' || clean === 'alo' || clean === 'hey' ||
    clean === 'chào' || clean === 'xin chào' || clean === 'chào bạn' || clean === 'chào bot' ||
    clean === 'chào em' || clean === 'chào bác sĩ';
  return isGreeting || anyKeyword(lower, [
    'nghiệp vụ', 'nghiep vu', 'các nghiệp vụ', 'cac nghiep vu',
    'quy trình lâm sàng', 'quy trinh lam sang', 'bản đồ nghiệp vụ', 'ban do nghiep vu',
    'chức năng', 'chuc nang', 'tính năng', 'tinh nang',
    'hệ thống làm được gì', 'chatbot làm được gì', 'bạn làm được gì', 'bạn có thể làm',
    'bạn giúp được', 'bạn là ai', 'làm được gì', 'giúp được gì', 'hỗ trợ được gì', 'hỗ trợ những gì',
    'hướng dẫn sử dụng', 'danh mục nghiệp vụ', '10 nghiệp vụ', '10 đại nghiệp vụ'
  ]);
}

export function handleBusinessOverviewIntent(nowStr: string): ProcessedQueryResult {
  const text = `### 🏥 BẢN ĐỒ 10 ĐẠI NGHIỆP VỤ BỆNH VIỆN & TRỢ LÝ LÂM SÀNG TỰ ĐỘNG

Hệ thống Trợ lý Agent Lâm Sàng được thiết kế chuẩn mực theo đúng Thông tư & Nghị định của Bộ Y tế:

1. **Xuất nợ & Mượn khẩn tủ trực ca đêm** *(Thông tư 22/2011/TT-BYT & TT 20/2017/TT-BYT)*:
   • Xuất nợ ca đêm, phân tích CDSS cảnh báo tương tác thuốc nghiêm trọng và quá liều.
   • *Lệnh mẫu:* \`"Cho 2 lọ Morphin cấp cứu phòng 1"\`, \`"Kê 1 lọ Ceftriaxone"\`.

2. **Thu hồi vỏ ống & Tiêu hủy thuốc gây nghiện** *(Điều 15 & 16 Thông tư 20/2017/TT-BYT)*:
   • Bắt buộc thu hồi 100% vỏ ống sau tiêm; lập biên bản 3 bên khi rơi vỡ; hội đồng tiêu hủy vỏ ống.
   • *Lệnh mẫu:* \`"Kiểm tra nợ vỏ morphin"\`, \`"Quy định thu hồi vỏ ống morphin theo thông tư 20"\`.

3. **Giao ban & Đối soát ca trực 07:00 AM** *(Thông tư 22/2011/TT-BYT)*:
   • Tự động đối soát nợ ca đêm, phát hiện lệch số lượng sổ sách, tổng hợp cơ số tủ trực.
   • *Lệnh mẫu:* \`"Đối soát ca trực đêm qua"\`, \`"Giao ban ca trực sáng 07:00 AM"\`.

4. **Kho Dược GSP & Hạn dùng FEFO** *(Thông tư 36/2018/TT-BYT)*:
   • Xuất kho ưu tiên cận hạn trước (First Expired, First Out); quét thuốc hạn dưới 60 ngày.
   • *Lệnh mẫu:* \`"Thuốc nào cận hạn dưới 60 ngày"\`, \`"Kiểm tra date thuốc trong kho"\`.

5. **Lập phiếu dự trù bù thuốc Mẫu 01/TT22** *(Thông tư 22/2011/TT-BYT)*:
   • Quét các mặt hàng chạm ngưỡng Min; tự động tính số lượng bù về cơ số tủ trực tiêu chuẩn.
   • *Lệnh mẫu:* \`"Lập phiếu dự trù bù tồn kho"\`, \`"Dự trù cơ số mẫu 01"\`.

6. **Báo hỏng, bảo trì & Kiểm định TBYT** *(Nghị định 98/2021/NĐ-CP)*:
   • Tiếp nhận sự cố máy thở, máy sốc tim; phân loại rủi ro Loại A-B-C-D; an toàn điện IEC 60601-1.
   • *Lệnh mẫu:* \`"Máy thở PB840 phòng mổ 2 bị xì khí"\`, \`"Máy sốc tim Zoll lỗi pin"\`.

7. **Chuỗi lạnh Vắc xin & Nhiệt động học MKT** *(WHO PQS & Thông tư 36/2018)*:
   • Theo dõi dải nhiệt 2.0°C - 8.0°C; tính chỉ số Arrhenius MKT; quy trình biệt trữ khi mất điện.
   • *Lệnh mẫu:* \`"Nhiệt độ tủ lạnh bảo quản vắc xin thế nào"\`, \`"Kiểm tra datalogger buồng lạnh"\`.

8. **Sổ kiểm toán bất biến & Chống gian lận** *(Nghị định 130/2018/NĐ-CP)*:
   • Xác thực chuỗi băm mật mã HMAC-SHA256 liên kết từng giao dịch; chống chối bỏ trách nhiệm.
   • *Lệnh mẫu:* \`"Kiểm tra tính toàn vẹn sổ kiểm toán"\`.

9. **Thị giác AI bóc tách hóa đơn dược (Vision OCR)**:
   • Quét hóa đơn CPC1, hóa đơn VAT; tự động trích xuất số lô, hạn dùng, đơn giá vào kho.
   • *Lệnh mẫu:* \`"Quét hóa đơn dược phẩm cpc1"\`, \`"Bóc tách hóa đơn giao hàng"\`.

10. **Cổng Tra Cứu Dược Quốc Gia 54.885 SĐK** *(Cục Quản lý Dược)*:
    • Tra cứu chính xác 100/100 theo SĐK, biệt dược, hoạt chất; đối soát tồn kho bệnh viện.
    • *Lệnh mẫu:* \`"Thông tin thuốc Rocephin"\`, \`"SĐK VD-24757-16 là thuốc gì"\`.`;

  const replyMessage: ChatMessage = {
    id: `msg-agent-business-${Date.now()}`,
    sender: 'agent',
    text,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'Thông tư 22/2011, TT 20/2017, TT 51/2017 & Nghị định 98/2021',
      title: 'Hệ thống quản lý lâm sàng bệnh viện',
      clause: 'Căn cứ áp dụng'
    },
    suggestedChips: [
      'Đối soát ca trực 07:00 AM',
      'Tra cứu SĐK VD-24757-16',
      'Thuốc cận hạn FEFO',
      'Báo hỏng máy thở PB840'
    ]
  };

  return { replyMessage };
}
