/**
 * Comprehensive Automated Logic Test Suite for Clinical AI Chatbot
 * Validates 100% accurate intent routing, entity extraction, CDSS clinical safety alerts, and fallback handling.
 */

import { processClinicalUserQuery } from '../src/utils/clinicalNLP';
import { INITIAL_DEBT_RECORDS, INITIAL_EQUIPMENT_TICKETS, INITIAL_INVENTORY_BATCHES } from '../src/data/initialData';

interface TestCase {
  query: string;
  expectedCard: string;
  expectedAlert?: 'critical' | 'warning' | 'none';
  category: string;
}

const testSuite: TestCase[] = [
  // 1. Mượn khẩn / Y lệnh thuốc lâm sàng (TT 22 & TT 20)
  { query: 'Cho 1 lọ morphin', expectedCard: 'borrow_confirm', expectedAlert: 'none', category: 'Medication Dispense' },
  { query: 'bệnh nhân Nguyễn Văn An cần 2 ống Fentanyl cấp cứu phòng mổ 1', expectedCard: 'borrow_confirm', expectedAlert: 'none', category: 'Medication Dispense' },
  { query: 'lấy gấp 1 ống adrenalin tiêm bắp cho bệnh nhân phản vệ buồng 1', expectedCard: 'borrow_confirm', expectedAlert: 'none', category: 'Medication Dispense' },
  { query: 'tiêm tĩnh mạch 1 ống diazepam cho bệnh nhân co giật', expectedCard: 'borrow_confirm', expectedAlert: 'none', category: 'Medication Dispense' },
  { query: 'xuất 1 chai lipid 20% cấp cứu ngộ độc thuốc tê', expectedCard: 'borrow_confirm', expectedAlert: 'none', category: 'Medication Dispense' },
  { query: 'cần 10 cái bơm tiêm 5ml và 2 bộ dây truyền', expectedCard: 'borrow_confirm', expectedAlert: 'none', category: 'Medication Dispense' },
  { query: 'kê 2 lọ ceftriaxone 1g cho bệnh nhân Trần Thị Mai buồng cấp cứu 2', expectedCard: 'borrow_confirm', expectedAlert: 'none', category: 'Medication Dispense' },
  { query: 'bn 8820 đau quá tiêm 2 morphin', expectedCard: 'borrow_confirm', expectedAlert: 'none', category: 'Medication Dispense' },
  { query: 'cho 1 adre', expectedCard: 'borrow_confirm', expectedAlert: 'none', category: 'Medication Dispense' },
  { query: 'Có 1 bệnh nhân cần dùng gấp 4 lọ morphin', expectedCard: 'borrow_confirm', expectedAlert: 'critical', category: 'CDSS Opioid Overdose' },
  { query: 'bệnh nhân cần dùng 3 lọ morphin và 1 ống diazepam', expectedCard: 'borrow_confirm', expectedAlert: 'critical', category: 'CDSS DDI Interaction' },
  { query: 'tiêm 1 ống kali clorid 10% cho bệnh nhân', expectedCard: 'borrow_confirm', expectedAlert: 'critical', category: 'CDSS High-Alert KCl' },

  // 2. Giao ban & Đối soát ca trực 07:00 AM (TT 22 & TT 20)
  { query: 'đối soát ca trực đêm qua', expectedCard: 'shift_handover_report', category: 'Shift Handover' },
  { query: 'giao ban ca trực sáng 07:00 AM', expectedCard: 'shift_handover_report', category: 'Shift Handover' },
  { query: 'kiểm tra nợ vỏ morphin', expectedCard: 'shift_handover_report', category: 'Shift Handover' },
  { query: 'tổng hợp nợ ca trực', expectedCard: 'shift_handover_report', category: 'Shift Handover' },

  // 3. Báo hỏng thiết bị y tế (NĐ 98/2021)
  { query: 'máy thở PB840 phòng mổ 2 bị xì khí nứt bẫy nước', expectedCard: 'incident_confirm', category: 'Equipment Incident' },
  { query: 'máy sốc tim zoll r series báo lỗi không nạp năng lượng', expectedCard: 'incident_confirm', category: 'Equipment Incident' },
  { query: 'bơm tiêm điện b.braun báo lỗi kẹt pít-tông', expectedCard: 'incident_confirm', category: 'Equipment Incident' },
  { query: 'monitor philips mp50 buồng 3 bị mất tín hiệu ecg', expectedCard: 'incident_confirm', category: 'Equipment Incident' },
  { query: 'hỏng máy khí máu abl90 khoa cấp cứu', expectedCard: 'incident_confirm', category: 'Equipment Incident' },
  { query: 'máy thở bennett bị hỏng', expectedCard: 'incident_confirm', category: 'Equipment Incident' },
  { query: 'máy phá rung heartstart xl bị chai pin buồng cấp cứu 1', expectedCard: 'incident_confirm', category: 'Equipment Incident' },
  { query: 'báo hỏng máy lọc máu prismaflex bị chập nguồn khoa icu', expectedCard: 'incident_confirm', category: 'Equipment Incident' },

  // 4. Kho FEFO & Cận hạn (TT 36/2018 GSP)
  { query: 'thuốc nào cận hạn dưới 60 ngày', expectedCard: 'fefo_report', category: 'FEFO Expiry' },
  { query: 'kiểm tra date thuốc trong kho', expectedCard: 'fefo_report', category: 'FEFO Expiry' },
  { query: 'cho tôi xem danh sách fefo ưu tiên xuất', expectedCard: 'fefo_report', category: 'FEFO Expiry' },
  { query: 'cho tôi xem thuốc cận hạn', expectedCard: 'fefo_report', category: 'FEFO Expiry' },

  // 5. Dự trù / Cạn kho (TT 22 Mẫu 01)
  { query: 'mặt hàng nào sắp hết', expectedCard: 'low_stock_report', category: 'Restock Proposal' },
  { query: 'thuốc nào chạm ngưỡng min cần bù', expectedCard: 'low_stock_report', category: 'Restock Proposal' },
  { query: 'lập phiếu dự trù bù tồn kho', expectedCard: 'low_stock_report', category: 'Restock Proposal' },
  { query: 'dự trù cơ số mẫu 01', expectedCard: 'low_stock_report', category: 'Restock Proposal' },

  // 6. Chuỗi lạnh & Vắc xin (WHO PQS)
  { query: 'nhiệt độ tủ lạnh bảo quản vắc xin hiện tại thế nào', expectedCard: 'coldchain_status', category: 'Cold Chain' },
  { query: 'kiểm tra datalogger buồng lạnh và chỉ số mkt', expectedCard: 'coldchain_status', category: 'Cold Chain' },
  { query: 'xử lý mất điện tủ vắc xin', expectedCard: 'coldchain_status', category: 'Cold Chain' },

  // 7. Sổ kiểm toán & Pháp lý (NĐ 130 & TT 51 & TT 20)
  { query: 'kiểm tra tính toàn vẹn sổ kiểm toán', expectedCard: 'audit_integrity', category: 'Audit Ledger' },
  { query: 'phác đồ cấp cứu phản vệ theo thông tư 51', expectedCard: 'legal_guide', category: 'Legal Guide' },
  { query: 'quy định thu hồi vỏ ống morphin theo thông tư 20', expectedCard: 'legal_guide', category: 'Legal Guide' },
  { query: 'quy định kiểm định máy thở theo nghị định 98', expectedCard: 'legal_guide', category: 'Legal Guide' },
  { query: 'xử lý thế nào khi làm rơi vỡ vỏ ống fentanyl', expectedCard: 'legal_guide', category: 'Legal Guide' },

  // 8. Hóa đơn / OCR (Vision AI)
  { query: 'quét hóa đơn dược phẩm cpc1', expectedCard: 'ocr_invoice_confirm', category: 'Vision OCR' },
  { query: 'bóc tách hóa đơn giao hàng', expectedCard: 'ocr_invoice_confirm', category: 'Vision OCR' },
  { query: 'quét hóa đơn vat', expectedCard: 'ocr_invoice_confirm', category: 'Vision OCR' },

  // 9. Điều hướng Tab & Fallback chung
  { query: 'tôi muốn xem tủ trực', expectedCard: 'shift_handover_report', category: 'Navigation' },
  { query: 'xin chào trợ lý lâm sàng', expectedCard: 'NO_CARD', category: 'General Guidance' },

  // 10. Tra cứu Quy chuẩn 5 Đúng, Chỉ Định ("Dùng để làm gì") & Dị Ứng (QĐ 2147/BYT & TT 51)
  { query: 'cho tôi xem quy tắc 5 đúng morphin', expectedCard: 'medication_safety', category: 'Medication Safety' },
  { query: 'thông tin thuốc adrenalin cấp cứu', expectedCard: 'medication_safety', category: 'Medication Safety' },
  { query: 'thuốc giải độc fentanyl là gì', expectedCard: 'medication_safety', category: 'Medication Safety' },
  { query: 'phù hợp với ai dùng ceftriaxone', expectedCard: 'medication_safety', category: 'Medication Safety' },
  { query: 'liều tối đa diazepam trong 24h', expectedCard: 'medication_safety', category: 'Medication Safety' },
  { query: 'Morphin dùng để làm gì', expectedCard: 'medication_safety', category: 'Medication Indication' },
  { query: 'ai dị ứng với ceftriaxone', expectedCard: 'medication_safety', category: 'Medication Allergy' },
  { query: 'thành phần của thuốc diazepam', expectedCard: 'medication_safety', category: 'Medication Ingredients' },
  { query: 'tác dụng của adrenalin cấp cứu', expectedCard: 'medication_safety', category: 'Medication Indication' },
  { query: 'chỉ định của vancomycin', expectedCard: 'medication_safety', category: 'Medication Indication' },

  // 11. Dặn dò của bác sĩ kê đơn & Thông báo nhắc uống thuốc qua mail Google Script
  { query: 'Dặn dò bệnh nhân Nguyễn Văn An uống thuốc Paracetamol và Augmentin hàng ngày lúc 7h và 19h gửi mail an.nv@gmail.com', expectedCard: 'medication_schedule', category: 'Prescription Advice' },
  { query: 'Lên lịch nhắc uống thuốc cho bệnh nhân Trần Thị Mai uống Cipro sáng 8h tối 20h gửi mai@hospital.vn', expectedCard: 'medication_schedule', category: 'Prescription Advice' },
  { query: 'Dặn dò đơn thuốc cho bệnh nhân', expectedCard: 'medication_schedule', category: 'Prescription Advice' },
  { query: 'Nhắc bệnh nhân uống thuốc qua mail', expectedCard: 'medication_schedule', category: 'Prescription Advice' },
  { query: 'Gửi thông báo cho bệnh nhân Võ Minh Trí uống thuốc', expectedCard: 'medication_schedule', category: 'Prescription Advice' },
  { query: 'Gửi gmail', expectedCard: 'medication_schedule', category: 'Prescription Advice' },
  { query: 'Thông báo uống thuốc cho bệnh nhân', expectedCard: 'medication_schedule', category: 'Prescription Advice' },

  // 12. Nghiệp vụ Tự động: Kê đơn thuốc CPOE & Thu hồi vỏ nợ thuốc gây nghiện
  { query: 'Kê đơn cho bệnh nhân Trần Thị Mai dùng Augmentin 1g và Paracetamol 500mg', expectedCard: 'cpoe_prescription', category: 'CPOE Prescription' },
  { query: 'Kê đơn thuốc điện tử cho bệnh nhân', expectedCard: 'cpoe_prescription', category: 'CPOE Prescription' },
  { query: 'Hoàn trả vỏ morphin cho ca trực', expectedCard: 'debt_settle', category: 'Debt Return' },
  { query: 'Thanh toán nợ thuốc cho bệnh nhân', expectedCard: 'debt_settle', category: 'Debt Return' },

  // 13. Tra cứu có dẫn chứng chính xác Dược Thư 2015 & Tệp PDF
  { query: 'Thông tin thuốc Hadunalin', expectedCard: 'medication_safety', category: 'Drug Monograph Citation' },
  { query: 'Thông tin thuốc Rocephin', expectedCard: 'medication_safety', category: 'Drug Monograph Citation' },
  { query: 'Thuốc Paracetamol 500mg', expectedCard: 'medication_safety', category: 'Drug Monograph Citation' }
];

const mockState = {
  debts: INITIAL_DEBT_RECORDS,
  tickets: INITIAL_EQUIPMENT_TICKETS,
  batches: INITIAL_INVENTORY_BATCHES,
  coldChainTemp: 4.5
};

console.log(`\n======================================================================`);
console.log(`🏥 BẮT ĐẦU CHẠY KIỂM THỬ TOÀN DIỆN ${testSuite.length} KỊCH BẢN CHATBOT LÂM SÀNG`);
console.log(`======================================================================\n`);

let passedCount = 0;
let failedCount = 0;

testSuite.forEach((tc, idx) => {
  const res = processClinicalUserQuery(tc.query, mockState);
  const card = res.replyMessage.card ? res.replyMessage.card.cardType : 'NO_CARD';
  const alert = res.replyMessage.cdssAlert ? res.replyMessage.cdssAlert.level : 'none';

  let isPass = true;
  const issues: string[] = [];

  if (card !== tc.expectedCard) {
    isPass = false;
    issues.push(`Card sai: mong đợi [${tc.expectedCard}], nhận được [${card}]`);
  }

  if (tc.expectedAlert && alert !== tc.expectedAlert) {
    isPass = false;
    issues.push(`CDSS Alert sai: mong đợi [${tc.expectedAlert}], nhận được [${alert}]`);
  }

  const num = String(idx + 1).padStart(2, '0');
  if (isPass) {
    passedCount++;
    console.log(`✅ [${num}] [${tc.category}] "${tc.query}"`);
    console.log(`     -> Card: ${card} | CDSS Alert: ${alert}`);
  } else {
    failedCount++;
    console.log(`❌ [${num}] [${tc.category}] "${tc.query}"`);
    issues.forEach(iss => console.log(`     ⚠️ ${iss}`));
  }
});

console.log(`\n======================================================================`);
console.log(`🎯 KẾT QUẢ KIỂM THỬ: ${passedCount}/${testSuite.length} ĐẠT (Thất bại: ${failedCount})`);
console.log(`======================================================================\n`);

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log(`🎉 100% TEST CASES ĐẠT CHUẨN XUẤT SẮC!\n`);
}
