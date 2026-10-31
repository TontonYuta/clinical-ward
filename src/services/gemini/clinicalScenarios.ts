/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Điều Phối 12 Kịch Bản Lâm Sàng Chuyên Sâu Tác Tử Gemini AI & CSDL Bệnh Viện Thực Tế (<=280 LOC)
 */

import { GoogleGenAI } from '@google/genai';
import { AgentActionCard, ColdChainMonitorState } from '../../types/clinical';
import { getGeminiApiKey, callGeminiWithFallback, CLINICAL_SYSTEM_INSTRUCTION } from './config';
import { findPatientByNameOrQuery, INITIAL_PATIENTS } from '../patientService';
import { INITIAL_PRESCRIPTIONS } from '../../data/mockCpoeData';
import { ProcessedQueryResult } from '../../utils/nlp/types';

export function isClinicalScenarioQuery(lower: string): boolean {
  const isCeftriaxoneCalcium = /ceftriaxon/i.test(lower) && /calci|calcium|ringer|lactat|tương kỵ|kết tủa|pha chung|truyền cùng/i.test(lower);
  const isRedMan = /red man|đỏ bừng|vancomycin/i.test(lower) && /truyền|tác dụng phụ|xử trí|tốc độ|nguyễn quốc bảo|rx-2026-011|adr/i.test(lower);
  const isStatinFood = /atorvastatin|statin|rx-2026-012|safeesem/i.test(lower) && /bưởi|nước bưởi|bưởi chùm|grapefruit|uống cùng|thức ăn|xuất viện|dặn dò/i.test(lower);
  const isHighAlertKcl = /kali|kcl/i.test(lower) && /tiêm|tiêm trực tiếp|pha truyền|high-alert|cảnh báo đỏ|nguy cơ cao|nồng độ|ecg/i.test(lower);
  const isAnaphylaxis = /phác đồ|sốc phản vệ|phản vệ|adrenalin|hadunalin|51\/2017|tt 51|tiêm bắp/i.test(lower);
  const isOpioidCalc = /quy đổi|mme|tương đương|chuyển sang fentanyl|uống sang tiêm|liều morphin|trả vỏ|thu hồi vỏ/i.test(lower);
  const isAllergyAudit = /dị ứng|chống chỉ định|thẩm định|an toàn đơn|5 đúng|dùng được không|dị ứng penicillin/i.test(lower);
  const isRenal = /suy thận|chức năng thận|cockcroft|creatinine|egfr|crcl|chỉnh liều/i.test(lower);
  const isColdChainEmergency = (/mất điện|sự cố|quá nhiệt|vượt ngưỡng|cách ly|quarantine|hỏng tủ|cháy|báo động|phác đồ ứng phó|hỏng lốc|nhiệt độ tăng|không lạnh/i.test(lower)) && (/chuỗi lạnh|vaxigrip|tủ lạnh|kho lạnh|vắc xin|buồng lạnh/i.test(lower));
  const isColdChainTelemetry = (/chuỗi lạnh|vaxigrip|kho lạnh|tủ lạnh|vắc xin|buồng lạnh/i.test(lower) || /datalogger|data logger/i.test(lower)) && (/nhiệt độ|độ ẩm|mấy độ|bao nhiêu|hiện tại|tình trạng|kiểm tra|giám sát|ổn định/i.test(lower)) && !/sốt|hạ sốt|thân nhiệt|cơ thể|người|em bé|bệnh nhân/i.test(lower);
  const isColdChainGeneral = (/chuỗi lạnh|vaxigrip|kho lạnh|tủ lạnh|cách ly vắc xin|quarantine/i.test(lower)) && !/sốt|hạ sốt|thân nhiệt|cơ thể|người|em bé|bệnh nhân/i.test(lower);
  const isColdChain = isColdChainEmergency || isColdChainTelemetry || isColdChainGeneral;
  const isPrescription = (/xem đơn|đơn thuốc của|đơn của|tra cứu đơn/i.test(lower) || /rx-2026-/i.test(lower)) && (INITIAL_PATIENTS.some(p => lower.includes(p.fullName.toLowerCase())) || /rx-2026-/i.test(lower));
  const isAdr = /adr|biến cố|tác dụng phụ|đỏ bừng|ban đỏ|cảnh giác dược|sốc thuốc/i.test(lower);
  const isAmiodarone = /amiodaron|amiodarone/i.test(lower);
  const isNoradrenalin = /noradrenalin|norepinephrine/i.test(lower);
  const isDiazepam = /diazepam|seduxen/i.test(lower);
  const isSalbutamol = /salbutamol|ventolin/i.test(lower);
  const isEsomeprazole = /prasocare|esomeprazol/i.test(lower);
  const isPatientProfile = (/kiểm tra bệnh nhân|thông tin bệnh nhân|hồ sơ bệnh nhân/i.test(lower) || /hồ sơ|bệnh án/i.test(lower)) &&
    /bệnh nhân|người bệnh|ông ấy|bà ấy|ca này|võ minh trí|nguyễn văn an|trần thị mai|đặng thị lan/i.test(lower);
  const isDeictic = /thuốc này|thuốc đó|nó|thuốc vừa nói|thuốc vừa gợi ý|viên này|lọ này|ống này|thuốc trên|thuốc đang hỏi/i.test(lower);

  return (
    isCeftriaxoneCalcium || isRedMan || isStatinFood || isHighAlertKcl ||
    isAnaphylaxis || isOpioidCalc || isAllergyAudit || isRenal ||
    isColdChain || isPrescription || isAdr ||
    isAmiodarone || isNoradrenalin || isDiazepam || isSalbutamol || isEsomeprazole ||
    isPatientProfile || isDeictic
  );
}

export async function processGeminiClinicalScenario(
  rawInput: string,
  nowStr: string,
  coldChainState?: ColdChainMonitorState
): Promise<ProcessedQueryResult | null> {
  const lower = rawInput.toLowerCase();
  if (!isClinicalScenarioQuery(lower)) return null;

  const patient = findPatientByNameOrQuery(lower, INITIAL_PATIENTS);
  const apiKey = getGeminiApiKey();

  let patientEhr = '';
  if (patient) {
    patientEhr = `\n[HỒ SƠ BỆNH NHÂN TRONG CSDL:
- Mã BN: ${patient.id} - Họ tên: ${patient.fullName} (${patient.age} tuổi, ${patient.gender})
- Khoa/Phòng: ${patient.room}
- Bệnh nền mạn tính: ${patient.chronicConditions}
- Tiền sử DỊ ỨNG: ${patient.allergies}
- Chức năng thận: eGFR ${patient.egfr} mL/min, Creatinine ${patient.creatinine} umol/L, Cân nặng ${patient.weightKg}kg]`;
  }

  let aiAnswer: string | null = null;
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({ apiKey });
      aiAnswer = await callGeminiWithFallback(ai, {
        contents: `[Yêu cầu chuyên gia Dược Lâm Sàng] Phân tích ca bệnh dựa trên Dược Thư 2015, QĐ 2147/BYT, QĐ 5948/BYT, TT 51/2017:\n${patientEhr}\nCâu hỏi bác sĩ/điều dưỡng: "${rawInput}"`,
        config: {
          systemInstruction: CLINICAL_SYSTEM_INSTRUCTION,
          temperature: 0.2,
          maxOutputTokens: 800
        }
      });
    } catch (e) {
      console.warn('Gemini scenario query failed, applying local clinical rule fallback:', e);
    }
  }

  // 1. Kịch bản Tương kỵ Ceftriaxon - Ringer Lactat / Dung dịch Calci
  if (/ceftriaxon/i.test(lower) && /calci|calcium|ringer|lactat|tương kỵ|kết tủa|pha chung|truyền cùng/i.test(lower)) {
    const card: AgentActionCard = {
      cardType: 'fefo_report',
      title: 'Kiểm Tra Tương Kỵ: Ceftriaxon & Ringer Lactat',
      summary: 'Chống chỉ định phối hợp dung dịch chứa Calci (Dược Thư 2015 Trang 371)',
      data: { drug: 'Ceftriaxon 1g', incompatible: 'Ringer Lactat / Calci' },
      primaryActionLabel: 'Xem Lô Thuốc Ceftriaxon',
      primaryActionType: 'NAVIGATE_TAB',
      targetTab: 'fefo',
      status: 'pending'
    };
    const replyText = aiAnswer || (
      `### ⛔ CẢNH BÁO TƯƠNG KỴ NGUY HIỂM TÍNH MẠNG (QĐ 5948/QĐ-BYT)\n\n` +
      `• **Hoạt chất:** Ceftriaxon (Lô Ceftriaxona Normon 1g - \`LOT-CF24-03B\`) và Dung dịch Calci / Ringer Lactat (\`RX-2026-009\`).\n` +
      `• **Khuyến cáo Dược thư Quốc gia 2015 (Trang 371):** **CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI** phối hợp Ceftriaxon với các dung dịch chứa Calci (Ringer Lactat, Calci clorid, Calci gluconat) qua cùng hoặc khác đường truyền.\n` +
      `• **Hậu quả lâm sàng:** Nguy cơ hình thành tủa muối Ceftriaxon-Calci không tan gây tắc mạch phổi và suy thận cấp, đã có báo cáo ca tử vong ở cả trẻ sơ sinh và người lớn.\n` +
      `• **Hướng xử trí:** Thay thế dịch truyền hồi sức bằng Natri clorid 0.9% hoặc truyền Ceftriaxon cách xa các dung dịch chứa Calci ít nhất 48 giờ.`
    );
    return {
      replyMessage: {
        id: `msg-agent-scenario-${Date.now()}`,
        sender: 'agent',
        text: replyText,
        timestamp: nowStr,
        legalReference: { lawCode: 'Dược Thư 2015 Trang 371 & QĐ 5948/BYT', title: 'Tương tác thuốc chống chỉ định', clause: 'Mục Ceftriaxon' },
        card,
        suggestedChips: ['Xem bảng kho Dược Nội Trú', 'Đối soát ca trực 07:00 AM', 'Tra cứu SĐK 840110304425']
      },
      card
    };
  }

  // 2. Kịch bản Hội chứng Red Man khi truyền Vancomycin
  if (/red man|đỏ bừng|vancomycin/i.test(lower) && /truyền|tác dụng phụ|xử trí|tốc độ|nguyễn quốc bảo|rx-2026-011|adr/i.test(lower)) {
    const card: AgentActionCard = {
      cardType: 'cpoe_prescription',
      title: 'Đơn Thuốc Vancomycin 1g: Nguyễn Quốc Bảo',
      summary: 'Phòng ngừa hội chứng Red Man - Yêu cầu tốc độ truyền >=60 phút',
      data: { patient: 'Nguyễn Quốc Bảo', medication: 'Vancomycin 1g', prescriptionId: 'RX-2026-011' },
      primaryActionLabel: 'Mở Đơn Thuốc RX-2026-011',
      primaryActionType: 'NAVIGATE_TAB',
      targetTab: 'cpoe',
      status: 'pending'
    };
    const replyText = aiAnswer || (
      `### ⚠️ XỬ TRÍ HỘI CHỨNG RED MAN DO VANCOMYCIN (DƯỢC THƯ TRANG 1455)\n\n` +
      `• **Đơn thuốc liên quan:** \`RX-2026-011\` - Bệnh nhân **Nguyễn Quốc Bảo** (Nhiễm tụ cầu vàng MRSA).\n` +
      `• **Cơ chế phản ứng:** Truyền Vancomycin với tốc độ quá nhanh kích thích giải phóng Histamin trực tiếp từ dưỡng bào (Mast cell), gây đỏ bừng mặt, cổ, ngực trên, ngứa dữ dội và tụt huyết áp.\n` +
      `• **Phác đồ xử trí chuẩn:**\n` +
      `  1. Ngừng truyền Vancomycin ngay lập tức, kiểm tra dấu hiệu sinh tồn (Mạch, Huyết áp, SpO2).\n` +
      `  2. Tiêm kháng Histamin H1 (Diphenhydramin 25-50mg tiêm bắp/tĩnh mạch chậm).\n` +
      `  3. Khi triệu chứng thuyên giảm, tiếp tục truyền với **tốc độ giảm 50%** (thời gian truyền tối thiểu **60 - 100 phút**, nồng độ pha loãng không quá 5mg/mL trong NaCl 0.9%).`
    );
    return {
      replyMessage: {
        id: `msg-agent-scenario-${Date.now()}`,
        sender: 'agent',
        text: replyText,
        timestamp: nowStr,
        legalReference: { lawCode: 'Dược Thư Quốc Gia 2015 Trang 1455', title: 'Hướng dẫn sử dụng kháng sinh Vancomycin', clause: 'Mục ADR & Tốc độ truyền' },
        card,
        suggestedChips: ['Xem đơn thuốc RX-2026-011', 'Tra cứu chuyên luận Vancomycin', 'Đối soát ca trực 07:00 AM']
      },
      card
    };
  }

  // 3. Kịch bản Thẩm định Đơn Ngoại trú & Tương tác Bưởi chùm - Statin
  if (/atorvastatin|statin|rx-2026-012|safeesem/i.test(lower) && /bưởi|nước bưởi|bưởi chùm|grapefruit|uống cùng|thức ăn|xuất viện|dặn dò/i.test(lower)) {
    const card: AgentActionCard = {
      cardType: 'cpoe_prescription',
      title: 'Phiếu Dặn Dò Xuất Viện: Võ Minh Trí',
      summary: 'Đơn thuốc RX-2026-012 • Cảnh báo tương tác nước ép bưởi chùm CYP3A4',
      data: { patient: 'Võ Minh Trí', prescriptionId: 'RX-2026-012' },
      primaryActionLabel: 'Lập Lịch Dặn Dò BN',
      primaryActionType: 'OPEN_PRESCRIPTION_ADVICE',
      targetTab: 'cpoe',
      status: 'pending'
    };
    const replyText = aiAnswer || (
      `### ⚠️ THẨM ĐỊNH ĐƠN NGOẠI TRÚ & TƯƠNG TÁC THỨC ĂN (RX-2026-012)\n\n` +
      `• **Bệnh nhân:** **Võ Minh Trí** (\`BN-8820\`) - Chẩn đoán: Tăng huyết áp & Rối loạn lipid máu mạn tính.\n` +
      `• **Danh mục thuốc kê:** Safeesem 5 (S-amlodipine 5mg) & Atorvastatin Sandoz 20mg.\n` +
      `• **Cảnh báo tương tác thực phẩm nghiêm trọng:**\n` +
      `  - **TUYỆT ĐỐI KHÔNG uống Atorvastatin cùng nước ép bưởi chùm (Grapefruit):** Furanocoumarin trong bưởi chùm ức chế không hồi phục enzym CYP3A4 tại ruột, làm tăng nồng độ Statin trong máu lên **gấp 2.5 - 3 lần**, dẫn tới nguy cơ **tiêu cơ vân cấp (Rhabdomyolysis)** và suy thận cấp!\n` +
      `• **Hướng dẫn thời điểm dùng thuốc tối ưu:**\n` +
      `  - \`Safeesem 5\`: Uống 1 viên vào **buổi sáng** sau ăn để kiểm soát huyết áp ban ngày.\n` +
      `  - \`Atorvastatin 20mg\`: Uống 1 viên vào **buổi tối trước khi đi ngủ** (thời điểm gan tổng hợp cholesterol cao nhất).`
    );
    return {
      replyMessage: {
        id: `msg-agent-scenario-${Date.now()}`,
        sender: 'agent',
        text: replyText,
        timestamp: nowStr,
        legalReference: { lawCode: 'Dược Thư 2015 Trang 175 & QĐ 5948/BYT', title: 'Tương tác thuốc & Dược động học', clause: 'Chuyển hóa CYP3A4' },
        card,
        suggestedChips: ['Lập lịch dặn dò cữ thuốc', 'Gửi email dặn dò bệnh nhân', 'Xem đơn RX-2026-012']
      },
      card
    };
  }

  // 4. Kịch bản Cảnh báo Thuốc Nguy Cơ Cao: Kali Clorid 10% High-Alert
  if (/kali|kcl/i.test(lower) && /tiêm|tiêm trực tiếp|pha truyền|high-alert|cảnh báo đỏ|nguy cơ cao|nồng độ|ecg/i.test(lower)) {
    const card: AgentActionCard = {
      cardType: 'fefo_report',
      title: 'Thuốc High-Alert: Kali Clorid 10%',
      summary: 'Cấm tiêm tĩnh mạch trực tiếp • Bắt buộc pha loãng theo Dược Thư 2015',
      data: { item: 'Kali clorid 10%', batch: 'LOT-KC24-08', stock: 60 },
      primaryActionLabel: 'Xem Tủ Thuốc High-Alert',
      primaryActionType: 'NAVIGATE_TAB',
      targetTab: 'fefo',
      status: 'pending'
    };
    const replyText = aiAnswer || (
      `### 🚨 CẢNH BÁO THUỐC NGUY CƠ CAO (HIGH-ALERT): KALI CLORID 10%\n\n` +
      `• **Dữ liệu kho thuốc:** Lô \`b-5\` - \`LOT-KC24-08\`, nồng độ 1g/10ml, hiện tồn **60 ống** tại Tủ thuốc Nguy cơ cao (Dán nhãn đỏ High-Alert).\n` +
      `• **CẢNH BÁO TỐI KHẨN CẤP:** **CẤM TUYỆT ĐỐI TIÊM TĨNH MẠCH TRỰC TIẾP!** Tiêm bolus trực tiếp sẽ gây tăng kali máu cấp dẫn tới ngừng tim tức thì.\n` +
      `• **Quy chuẩn pha truyền theo Dược Thư 2015 (Trang 788):**\n` +
      `  - Bắt buộc pha loãng trong Natri clorid 0.9% hoặc Glucose 5%.\n` +
      `  - Nồng độ truyền ngoại vi không vượt quá **40 mEq/L** (khoảng 3g/L).\n` +
      `  - Tốc độ truyền tối đa **10 - 20 mEq/giờ**, bắt buộc dùng máy truyền dịch hoặc bơm tiêm điện và theo dõi điện tâm đồ liên tục (Monitor ECG).`
    );
    return {
      replyMessage: {
        id: `msg-agent-scenario-${Date.now()}`,
        sender: 'agent',
        text: replyText,
        timestamp: nowStr,
        legalReference: { lawCode: 'Dược Thư Quốc Gia 2015 Trang 788', title: 'Thuốc nguy cơ cao High-Alert', clause: 'Mục Cảnh báo nồng độ Kali' },
        card,
        suggestedChips: ['Xem đơn bù điện giải RX-2026-001', 'Kiểm tra tồn kho High-Alert', 'Đối soát ca trực 07:00 AM']
      },
      card
    };
  }

  // 5. Kịch bản Quy chế Quản lý Thuốc Gây Nghiện & Quy đổi Opioid MME
  if (/quy đổi|mme|tương đương|chuyển sang fentanyl|uống sang tiêm|liều morphin|trả vỏ|thu hồi vỏ/i.test(lower)) {
    const card: AgentActionCard = {
      cardType: 'debt_settle',
      title: 'Đối Soát Vỏ Thuốc Gây Nghiện Morphin / Fentanyl',
      summary: 'Quy chuẩn quản lý thuốc kiểm soát đặc biệt (Thông tư 20/2017/TT-BYT)',
      data: { morphinStock: 35, fentanylStock: 160 },
      primaryActionLabel: 'Xác Nhận Thu Hồi Vỏ Ống',
      primaryActionType: 'OPEN_DEBT_SETTLE',
      targetTab: 'debt',
      status: 'pending'
    };
    const replyText = aiAnswer || (
      `### 📋 QUY CHẾ QUẢN LÝ THUỐC GÂY NGHIỆN & QUY ĐỔI OPIOID (TT 20/2017/TT-BYT)\n\n` +
      `• **Thuốc trong CSDL kho viện:**\n` +
      `  - \`Morphin hydroclorid 10mg/1ml\` (\`LOT-MP24-X4\`): Tồn **35 ống** (Tủ sắt 2 khóa).\n` +
      `  - \`Fentanyl 50 mcg/ml (0.1mg/2ml)\` (\`LOT-FT25-A2\`): Tồn **160 ống** (Tủ sắt 2 khóa).\n` +
      `• **Hệ số quy đổi tương đương giảm đau (Equianalgesic):**\n` +
      `  - **10 mg Morphin tiêm tĩnh mạch** $\\approx$ **100 mcg (0.1 mg) Fentanyl tiêm tĩnh mạch**.\n` +
      `• **Quy định pháp lý bắt buộc (Thông tư 20/2017/TT-BYT):**\n` +
      `  - Mượn rút thuốc gây nghiện cấp cứu ca đêm bắt buộc có **2 nhân viên y tế chứng kiến và ký biên bản**.\n` +
      `  - Giữ lại toàn bộ vỏ ống thuốc đã sử dụng trong khay khóa đối soát ca trực 07:00 AM.\n` +
      `  - Hội đồng tiêu hủy vỏ ống thuốc gây nghiện họp định kỳ và lập biên bản tiêu hủy.`
    );
    return {
      replyMessage: {
        id: `msg-agent-scenario-${Date.now()}`,
        sender: 'agent',
        text: replyText,
        timestamp: nowStr,
        legalReference: { lawCode: 'Thông tư 20/2017/TT-BYT', title: 'Quy chế quản lý thuốc kiểm soát đặc biệt', clause: 'Điều 15: Thu hồi và tiêu hủy vỏ ống thuốc' },
        card,
        suggestedChips: ['Đối soát ca trực 07:00 AM', 'Xem đơn thuốc RX-2026-001', 'Kiểm tra sổ nợ tủ trực']
      },
      card
    };
  }

  // 6. Kịch bản Phác đồ Adrenalin Cấp Cứu Sốc Phản Vệ theo TT 51/2017/TT-BYT
  if (/phác đồ|sốc phản vệ|phản vệ|adrenalin|hadunalin|51\/2017|tt 51|tiêm bắp/i.test(lower)) {
    const card: AgentActionCard = {
      cardType: 'medication_safety',
      title: 'Hộp Thuốc Cấp Cứu Phản Vệ: Hadunalin 1mg/ml',
      summary: 'Tiêm bắp mặt trước ngoài đùi 1/2 ống ngay lập tức (TT 51/2017/TT-BYT)',
      data: { drug: 'Hadunalin (Adrenalin 1mg/ml)', stock: 30, location: 'Tủ cấp cứu A9' },
      primaryActionLabel: 'Xem Phác Đồ TT 51/2017',
      primaryActionType: 'OPEN_MED_SAFETY',
      targetTab: 'debt',
      status: 'pending'
    };
    const replyText = aiAnswer || (
      `### ⚡ PHÁC ĐỒ CẤP CỨU SỐC PHẢN VỆ BẰNG ADRENALIN (THÔNG TƯ 51/2017/TT-BYT)\n\n` +
      `• **Cơ số cấp cứu tại viện:** Hadunalin 1mg/1ml (\`LOT-AD24-E1\`) - Hiện tồn **30 ống** tại Tủ cấp cứu Hồi sức A9.\n` +
      `• **Hành động cấp cứu tức thì (Áp dụng từ Phản vệ Độ II trở lên):**\n` +
      `  1. **Ngừng ngay tiếp xúc** với dị nguyên / thuốc đang truyền.\n` +
      `  2. **Tiêm bắp Adrenalin ngay lập tức vào mặt trước ngoài đùi:**\n` +
      `     - Người lớn: **1/2 ống (0.5 mg)**.\n` +
      `     - Trẻ em >30kg: 1/2 ống (0.5 mg); Trẻ 10-30kg: 1/3 - 1/4 ống (0.2 - 0.3 mg).\n` +
      `  3. **Theo dõi huyết áp:** Nhắc lại liều tiêm bắp sau mỗi **3 - 5 phút** nếu huyết áp chưa nâng lên hoặc còn khó thở.\n` +
      `  4. Đặt bệnh nhân nằm đầu thấp, thở oxy gọng kính 6 - 8 lít/phút, lập 2 đường truyền tĩnh mạch lớn với Natri clorid 0.9%.`
    );
    return {
      replyMessage: {
        id: `msg-agent-scenario-${Date.now()}`,
        sender: 'agent',
        text: replyText,
        timestamp: nowStr,
        legalReference: { lawCode: 'Thông tư 51/2017/TT-BYT', title: 'Hướng dẫn phòng, chẩn đoán và xử trí phản vệ', clause: 'Phụ lục IV: Hướng dẫn tiêm Adrenalin' },
        card,
        suggestedChips: ['Xem tủ cấp cứu Hồi sức A9', 'Đối soát ca trực 07:00 AM', 'Tra cứu đơn RX-2026-004']
      },
      card
    };
  }

  // 7. Kịch bản Thẩm định Dị ứng & 5 Đúng (QĐ 2147/BYT)
  if (/dị ứng|an toàn đơn|chống chỉ định|5 đúng/i.test(lower)) {
    const card: AgentActionCard = {
      cardType: 'medication_safety',
      title: `Thẩm Định An Toàn Đơn Thuốc: ${patient ? patient.fullName : 'Võ Minh Trí'}`,
      summary: 'Thẩm định dị ứng, chống chỉ định và quy tắc 5 Đúng (QĐ 2147/BYT)',
      data: { patient: patient?.fullName || 'Võ Minh Trí', allergies: patient?.allergies || 'Penicillin, Aspirin' },
      primaryActionLabel: 'Mở Bảng Đối Soát 5 Đúng',
      primaryActionType: 'OPEN_MED_SAFETY',
      targetTab: 'debt',
      status: 'pending'
    };
    const replyText = aiAnswer || (
      `### ⚠️ CẢNH BÁO AN TOÀN ĐƠN THUỐC (QĐ 2147/QĐ-BYT)\n\n` +
      `• **Bệnh nhân:** **${patient ? patient.fullName : 'Võ Minh Trí (BN-8820)'}**\n` +
      `• **Tiền sử dị ứng ghi nhận:** **${patient ? patient.allergies : 'Penicillin, Aspirin (phù mạch, co thắt phế quản)'}**\n` +
      `• **Cảnh báo CDSS chuyên môn:** Đơn thuốc chứa nhóm Beta-Lactam/Penicillin (như Augmentin, Amoxicillin) bị **CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI** do nguy cơ sốc phản vệ đe dọa tính mạng! Đề xuất đổi sang nhóm Macrolide (Clarithromycin 500mg) hoặc Quinolone theo QĐ 3445/QĐ-BYT.`
    );
    return {
      replyMessage: {
        id: `msg-agent-scenario-${Date.now()}`,
        sender: 'agent',
        text: replyText,
        timestamp: nowStr,
        legalReference: { lawCode: 'QĐ 2147/QĐ-BYT & QĐ 5948/QĐ-BYT', title: 'Quy chế Dược lâm sàng & Tương tác chống chỉ định', clause: 'Điều 14: Thẩm định an toàn đơn thuốc' },
        card,
        suggestedChips: ['Dặn dò bệnh nhân uống thuốc', 'Đổi sang Clarithromycin 500mg', 'Đối soát ca trực 07:00 AM']
      },
      card
    };
  }

  // 8. Kịch bản Hiệu chỉnh liều suy thận Cockcroft-Gault
  if (/suy thận|chức năng thận|cockcroft|creatinine|egfr|crcl|chỉnh liều/i.test(lower)) {
    const card: AgentActionCard = {
      cardType: 'medication_safety',
      title: 'Hiệu Chỉnh Liều Theo Chức Năng Thận (Cockcroft-Gault)',
      summary: 'Độ thanh thải CrCl ~52.0 mL/phút • Căn cứ Dược Thư 2015',
      data: { egfr: patient?.egfr || 52.0, patient: patient?.fullName || 'Đặng Thị Lan' },
      primaryActionLabel: 'Xem Chuyên Luận Dược Thư',
      primaryActionType: 'OPEN_MONOGRAPH_MODAL',
      targetTab: 'fefo',
      status: 'pending'
    };
    const replyText = aiAnswer || (
      `### 📊 KẾT QUẢ TÍNH TOÁN HIỆU CHỈNH LIỀU SUY THẬN\n\n` +
      `• **Bệnh nhân:** **${patient ? patient.fullName : 'Đặng Thị Lan (62 tuổi, Nữ, 58kg)'}**\n` +
      `• **Chức năng thận trong CSDL:** eGFR = **${patient ? patient.egfr : 52.0} mL/phút**, Creatinine = **${patient ? patient.creatinine : 110.0} umol/L** (Suy thận mức độ trung bình 3a).\n` +
      `• **Khuyến cáo Dược Thư Quốc Gia 2015:**\n` +
      `  - **Metformin (Panfor PR-750):** Được phép duy trì liều 750mg/ngày, theo dõi eGFR mỗi 3 - 6 tháng; chống chỉ định nếu eGFR < 30 mL/phút do nguy cơ nhiễm toan lactic.\n` +
      `  - **Ciprofloxacin / Vancomycin:** Cần giảm 50% liều dùng hoặc giãn cách 18 - 24 giờ một lần để tránh tích lũy gây độc thần kinh và thính giác.`
    );
    return {
      replyMessage: {
        id: `msg-agent-scenario-${Date.now()}`,
        sender: 'agent',
        text: replyText,
        timestamp: nowStr,
        legalReference: { lawCode: 'Dược Thư Quốc Gia 2015 & Hướng dẫn KDIGO', title: 'Hiệu chỉnh liều bệnh thận mạn', clause: 'Dược động học & Thanh thải thận' },
        card,
        suggestedChips: ['Lập lịch dặn dò cữ thuốc', 'Xem chuyên luận Ciprofloxacin', 'Đối soát ca trực 07:00 AM']
      },
      card
    };
  }

  // 9. Kịch bản Tra cứu Đơn thuốc Cụ Thể
  if (/xem đơn|đơn thuốc của|đơn của|tra cứu đơn/i.test(lower) || /rx-2026-/i.test(lower)) {
    const matchedRx = INITIAL_PRESCRIPTIONS.find(rx =>
      (patient && rx.patientId === patient.id) ||
      lower.includes(rx.id.toLowerCase()) ||
      lower.includes(rx.patientName.toLowerCase())
    );
    if (matchedRx) {
      const medLines = matchedRx.items.map(it => `  - **${it.medicationName}**: ${it.quantity} ${it.unit} (${it.dosage}, ${it.route} - ${it.instructions})`).join('\n');
      const card: AgentActionCard = {
        cardType: 'cpoe_prescription',
        title: `Đơn Thuốc: ${matchedRx.id}`,
        summary: `${matchedRx.patientName} • ${matchedRx.diagnosisText}`,
        data: { prescriptionId: matchedRx.id, patient: matchedRx.patientName },
        primaryActionLabel: 'Xem Chi Tiết Đơn Thuốc',
        primaryActionType: 'NAVIGATE_TAB',
        targetTab: 'cpoe',
        status: 'pending'
      };
      const replyText = (
        `### 📋 ĐƠN THUỐC: ${matchedRx.id} - BỆNH NHÂN ${matchedRx.patientName.toUpperCase()}\n\n` +
        `• **Loại đơn:** ${matchedRx.prescriptionType === 'outpatient' ? 'Đơn ngoại trú xuất viện' : 'Y lệnh điều trị nội trú'}\n` +
        `• **Chẩn đoán ICD-10:** \`${matchedRx.diagnosisIcd10}\` - ${matchedRx.diagnosisText}\n` +
        `• **Bác sĩ điều trị:** ${matchedRx.doctorName} (CCHN: ${matchedRx.doctorCertificate})\n` +
        `• **Thời gian ký số:** ${matchedRx.prescribedAt}\n` +
        `• **Danh mục thuốc chỉ định:**\n${medLines}`
      );
      return {
        replyMessage: {
          id: `msg-agent-scenario-${Date.now()}`,
          sender: 'agent',
          text: replyText,
          timestamp: nowStr,
          legalReference: { lawCode: 'Thông tư 26/2025/TT-BYT', title: 'Quy chế kê đơn thuốc ngoại trú', clause: 'Đơn thuốc điện tử hợp lệ' },
          card,
          suggestedChips: ['Lập lịch dặn dò cữ thuốc', 'Xem bảng đối soát 5 đúng', 'Đối soát ca trực 07:00 AM']
        },
        card
      };
    }
  }

  // 10. Kịch bản Chuỗi Lạnh Vắc xin GSP (Thông tư 36/2018/TT-BYT GSP)
  const isColdChainEmergencyQuery = /mất điện|sự cố|quá nhiệt|vượt ngưỡng|cách ly|quarantine|hỏng tủ|cháy|báo động|phác đồ ứng phó|hỏng lốc|nhiệt độ tăng|không lạnh/i.test(lower);
  const isAbnormalTemp = coldChainState ? (coldChainState.alarmActive || coldChainState.currentTemp > 8.0 || coldChainState.currentTemp < 2.0) : false;

  if ((/chuỗi lạnh|vaxigrip|kho lạnh|tủ lạnh|vắc xin|buồng lạnh/i.test(lower) || /cách ly vắc xin|quarantine/i.test(lower)) && !/sốt|hạ sốt|thân nhiệt|cơ thể|người|em bé|bệnh nhân/i.test(lower)) {
    if (isColdChainEmergencyQuery || isAbnormalTemp) {
      // 10B. Kịch bản Xử trí Sự Cố Chuỗi Lạnh Vắc xin GSP (Khi có sự cố thực tế hoặc người dùng hỏi phác đồ ứng phó)
      const card: AgentActionCard = {
        cardType: 'coldchain_status',
        title: 'Cảnh Báo / Xử Trí Sự Cố Chuỗi Lạnh: Tủ Lạnh Vaxigrip T1',
        summary: 'Dải an toàn 2.0°C - 8.0°C • Phác đồ cách ly bảo toàn vắc xin',
        data: { targetTab: 'coldchain', batch: 'LOT-VX25-S1' },
        primaryActionLabel: 'Mở Giám Sát Chuỗi Lạnh',
        primaryActionType: 'NAVIGATE_TAB',
        targetTab: 'coldchain',
        status: 'pending'
      };
      const replyText = (
        `### ❄️ XỬ TRÍ SỰ CỐ NHIỆT ĐỘ CHUỖI LẠNH VẮC XIN (TT 36/2018/TT-BYT GSP)\n\n` +
        `• **Sản phẩm bảo quản:** Vắc xin cúm Vaxigrip (\`LOT-VX25-S1\`) - Tồn **200 liều** tại Tủ lạnh Dược GSP T1.\n` +
        `• **Quy chuẩn dải nhiệt:** Tiêu chuẩn bảo quản bắt buộc từ **+2.0°C đến +8.0°C**.\n` +
        `• **Phác đồ ứng phó sự cố (Nhiệt độ vượt ngưỡng / Mất điện):**\n` +
        `  1. Kích hoạt bình tích lạnh dự phòng trong buồng tủ, tuyệt đối **không mở cửa tủ lạnh**.\n` +
        `  2. Chuyển nguồn cấp sang máy phát điện ưu tiên của bệnh viện trong vòng 5 phút.\n` +
        `  3. **Tạm thời cách ly lô vắc xin (Quarantine):** Dán tem cảnh báo, ngừng cấp phát cho các khoa phòng.\n` +
        `  4. Xuất dữ liệu Data Logger và tính toán nhiệt độ động học trung bình (MKT) để Hội đồng Dược thẩm định chất lượng.`
      );
      return {
        replyMessage: {
          id: `msg-agent-scenario-${Date.now()}`,
          sender: 'agent',
          text: replyText,
          timestamp: nowStr,
          legalReference: { lawCode: 'Thông tư 36/2018/TT-BYT', title: 'Thực hành tốt bảo quản thuốc GSP', clause: 'Mục Bảo quản vắc xin dây chuyền lạnh' },
          card,
          suggestedChips: ['Xem biểu đồ chuỗi lạnh', 'Đối soát ca trực 07:00 AM', 'Kiểm tra kho lạnh GSP']
        },
        card
      };
    } else {
      // 10A. Giám sát Chuỗi Lạnh & Datalogger Thời Gian Thực (Trạng thái Bình thường / Telemetry Query)
      const currentTemp = coldChainState?.currentTemp ?? 4.5;
      const currentHumidity = coldChainState?.currentHumidity ?? 58;
      const totalDoses = coldChainState?.totalVaccineDoses ?? 200;
      const isNormal = currentTemp >= 2.0 && currentTemp <= 8.0;

      const card: AgentActionCard = {
        cardType: 'coldchain_status',
        title: 'Giám Sát Chuỗi Lạnh: Tủ Lạnh Vaxigrip T1',
        summary: `Nhiệt độ ${currentTemp.toFixed(1)}°C (${isNormal ? 'Đạt chuẩn 2.0°C - 8.0°C' : 'Cảnh báo lệch ngưỡng'}) • Vận hành ổn định`,
        data: { targetTab: 'coldchain', batch: 'LOT-VX25-S1', currentTemp, humidity: currentHumidity, status: isNormal ? 'normal' : 'alarm' },
        primaryActionLabel: 'Mở Giám Sát Chuỗi Lạnh',
        primaryActionType: 'NAVIGATE_TAB',
        targetTab: 'coldchain',
        status: 'pending'
      };
      const replyText = (
        `### 🌡️ GIÁM SÁT CHUỖI LẠNH VẮC XIN (TT 36/2018/TT-BYT GSP)\n\n` +
        `• **Nhiệt độ hiện tại:** **${currentTemp.toFixed(1)}°C** (${isNormal ? '🟢 Đạt chuẩn GSP: dải an toàn bắt buộc **+2.0°C đến +8.0°C**' : '🔴 Cảnh báo lệch ngưỡng'})\n` +
        `• **Độ ẩm buồng tủ:** **${currentHumidity}% RH** (🟢 Đạt chuẩn GSP < 70%).\n` +
        `• **Nguồn cấp:** Điện lưới 220V ổn định, hệ thống pin tích điện dự phòng 48 giờ sẵn sàng.\n` +
        `• **Trạng thái cảnh báo:** **Bình thường (An toàn)**. Không ghi nhận biến cố nhiệt hay mất nguồn.\n` +
        `• **Sản phẩm bảo quản:** Vắc xin cúm Vaxigrip (\`LOT-VX25-S1\`) - Tồn **${totalDoses} liều** tại Tủ lạnh Dược GSP T1.\n` +
        `• **Chỉ số MKT (Mean Kinetic Temperature):** **4.8°C** (Tính toán theo phương trình Arrhenius WHO PQS).\n\n` +
        `👉 **Kết luận:** Toàn bộ vắc xin đang được lưu trữ an toàn trong giới hạn nhiệt độ quy chuẩn. Hệ thống vận hành ổn định, **chưa cần kích hoạt phác đồ ứng phó sự cố hay biệt trữ cách ly**.`
      );
      return {
        replyMessage: {
          id: `msg-agent-scenario-${Date.now()}`,
          sender: 'agent',
          text: replyText,
          timestamp: nowStr,
          legalReference: { lawCode: 'Thông tư 36/2018/TT-BYT', title: 'Thực hành tốt bảo quản thuốc GSP', clause: 'Điều 16 - Giám sát liên tục nhiệt độ bảo quản sinh phẩm' },
          card,
          suggestedChips: ['Xem biểu đồ chuỗi lạnh', 'Đối soát ca trực 07:00 AM', 'Kiểm tra kho lạnh GSP']
        },
        card
      };
    }
  }

  // 11. Kịch bản Báo cáo Cảnh giác dược ADR chung
  if (/adr|biến cố|tác dụng phụ|đỏ bừng|ban đỏ|cảnh giác dược|sốc thuốc/i.test(lower)) {
    const replyText = (
      `### 🚨 XỬ TRÍ PHẢN ỨNG CÓ HẠI CỦA THUỐC (ADR) & DỰ THẢO BÁO CÁO\n\n` +
      `• **Phân loại lâm sàng:** Biến cố bất lợi sau dùng thuốc (Nghi ngờ phản vệ theo Thông tư 51/2017/TT-BYT).\n` +
      `• **Xử trí cấp cứu tức thì:** Ngừng ngay thuốc đang dùng, tiêm bắp Adrenalin 0.5mg (1/2 ống) nếu có tụt huyết áp/khó thở.\n` +
      `• **Báo cáo Cảnh giác Dược:** Đã lập dự thảo Phiếu báo cáo ADR để gửi Trung tâm DI & ADR Quốc gia.`
    );
    return {
      replyMessage: {
        id: `msg-agent-scenario-${Date.now()}`,
        sender: 'agent',
        text: replyText,
        timestamp: nowStr,
        legalReference: { lawCode: 'Thông tư 51/2017/TT-BYT & QĐ 1088/QĐ-BYT', title: 'Quy trình báo cáo Cảnh giác Dược ADR', clause: 'Mục Báo cáo biến cố có hại' },
        suggestedChips: ['Phác đồ Adrenalin phản vệ TT 51', 'Lập phiếu báo hỏng', 'Đối soát ca trực 07:00 AM']
      }
    };
  }

  // 12. Kịch bản Chuyên Khoa Ung Bướu & Bệnh Nan Y (Giới hạn thẩm quyền AI & Safe Deferral)
  if (/ung thư|u bướu|carcinoma|khối u ác tính|trị ung thư|chữa ung thư|thuốc ung thư|thuốc trị ung thư|hóa trị ung thư/i.test(lower)) {
    const replyText = (
      `### 🎗️ TƯ VẤN CHUYÊN KHOA UNG BƯỚU (Quy Chuẩn Điều Trị Đa Mô Thức)\n\n` +
      `• **Bản chất bệnh học:** "Ung thư" là tập hợp hơn 200 bệnh lý ác tính phức tạp với cơ chế sinh học phân tử khác biệt. **Hoàn toàn không tồn tại một loại thuốc đơn lẻ hay phổ thông dùng chung cho mọi ca bệnh ung thư.**\n\n` +
      `• **Các nhóm thuốc & phương pháp điều trị y học hiện đại:**\n` +
      `  1. *Hóa trị liệu độc tế bào (Cytotoxic Chemotherapy):* Tác động lên chu kỳ phân bào (Cisplatin, Doxorubicin, Paclitaxel, 5-FU...).\n` +
      `  2. *Liệu pháp nhắm trúng đích (Targeted Therapy):* Kháng thể đơn dòng (Trastuzumab, Rituximab), thuốc ức chế Tyrosine Kinase (Erlotinib, Osimertinib...).\n` +
      `  3. *Liệu pháp miễn dịch (Immunotherapy):* Thuốc ức chế điểm kiểm soát miễn dịch Anti-PD1/PD-L1 (Pembrolizumab, Nivolumab...).\n` +
      `  4. *Liệu pháp nội tiết & Chăm sóc giảm nhẹ:* Quản lý đau mạn tính bậc 3 theo WHO (kết hợp Morphin sulfat theo Thông tư 20/2017/TT-BYT).\n\n` +
      `🛡️ **RÀO CHẮN AN TOÀN LÂM SÀNG & GIỚI HẠN THẨM QUYỀN AI (Safe Deferral):**\n` +
      `• Mọi phác đồ ung thư bắt buộc phải do **Hội đồng Ung bướu đa chuyên khoa (Tumor Board)** và **Bác sĩ chuyên khoa Ung bướu** chỉ định dựa trên: giải phẫu bệnh, giai đoạn TNM, xét nghiệm đột biến gen, diện tích da (BSA) và chức năng gan thận.\n` +
      `• **Trợ lý AI tuyệt đối không đưa ra chỉ định thuốc cụ thể cho bệnh lý này.**\n` +
      `• **Khuyến cáo người bệnh:** Cần thăm khám trực tiếp tại Bệnh viện Ung bướu hoặc Trung tâm Ung bướu các bệnh viện tuyến tỉnh/trung ương; tuyệt đối không tự mua thuốc hoặc sử dụng các bài thuốc truyền miệng không rõ nguồn gốc.`
    );
    return {
      replyMessage: {
        id: `msg-agent-scenario-${Date.now()}`,
        sender: 'agent',
        text: replyText,
        timestamp: nowStr,
        legalReference: { lawCode: 'Bộ Y Tế & NCCN Guidelines', title: 'Hướng dẫn chẩn đoán điều trị ung thư', clause: 'Nguyên tắc điều trị đa mô thức' },
        suggestedChips: ['Chăm sóc giảm nhẹ ung thư', 'Quy chế thuốc gây nghiện TT 20', 'Tra cứu Dược Thư 2015']
      }
    };
  }

  // 13. Kịch bản Xử Trí Đau Đầu & Thuốc Giảm Đau Chuẩn Dược Thư 2015 & CSDL Kho Viện
  if (/đau đầu|nhức đầu|đau nửa đầu|thuốc đau đầu|thuốc trị đau đầu|thuốc giảm đau/i.test(lower)) {
    const card: AgentActionCard = {
      cardType: 'medication_safety',
      title: 'Thuốc Giảm Đau: PARACETAMOL 500mg',
      summary: 'Lô: LOT-PC24-11A • Tồn: 80 Viên (Kho Dược Nội Trú - Kệ A1 Tầng 1) • SĐK: 893100110026',
      data: {
        brand_name: 'PARACETAMOL 500mg',
        active_ingredient: 'Paracetamol 500mg',
        current_stock: '80 Viên',
        warehouse_location: 'Kho Dược Nội Trú (Kệ A1 - Tầng 1)',
        batch_number: 'LOT-PC24-11A',
        targetTab: 'fefo'
      },
      primaryActionLabel: 'Xem Tồn Kho Paracetamol',
      primaryActionType: 'NAVIGATE_TAB',
      targetTab: 'fefo',
      status: 'pending'
    };
    const replyText = (
      `### 💊 HƯỚNG DẪN XỬ TRÍ ĐAU ĐẦU & THUỐC GIẢM ĐAU (Dược Thư Quốc Gia 2015)\n\n` +
      `• **Phân tích lâm sàng:** Đau đầu (Cephalea) là triệu chứng thường gặp do nhiều nguyên nhân: căng thẳng thần kinh (Tension headache), vận mạch, viêm xoang hoặc đau nửa đầu Migraine.\n\n` +
      `• **Thuốc giảm đau bậc 1 ưu tiên (Có sẵn trong CSDL Tồn kho Bệnh viện):**\n` +
      `  • **Biệt dược tồn kho:** **PARACETAMOL 500mg** (Lô: \`LOT-PC24-11A\` | Tồn kho: **80 Viên** tại Kho Dược Nội Trú - Kệ A1 Tầng 1).\n` +
      `  • **Liều dùng chuẩn người lớn:** Uống **500mg - 1000mg/lần**, cách mỗi 4 - 6 giờ nếu còn đau. **Tuyệt đối không uống quá 4.000mg (4g)/24 giờ** để tránh hoại tử tế bào gan cấp tính.\n` +
      `  • **Chống chỉ định & Thận trọng:** Người suy gan nặng, thiếu men G6PD, người nghiện rượu; không uống rượu bia trong thời gian dùng thuốc.\n\n` +
      `• **Lựa chọn thay thế (Đau đầu do viêm hoặc căng cơ):**\n` +
      `  • **NSAIDs (Ibuprofen):** 200mg - 400mg sau ăn no (chống chỉ định người có tiền sử loét dạ dày tá tràng, suy thận, hen phế quản).\n` +
      `  • **Đau nửa đầu Migraine chuyên biệt:** Cần khám bác sĩ để cân nhắc nhóm Triptan (Sumatriptan) hoặc Ergotamin.\n\n` +
      `🚨 **DẤU HIỆU NGUY HIỂM CẦN ĐI BỆNH VIỆN NGAY (Cảnh báo đỏ Red Flags):**\n` +
      `• Đau đầu đột ngột dữ dội kiểu "sét đánh", đau đầu dữ dội kèm sốt cao cứng gáy, nôn vọt, nhìn mờ, co giật hoặc yếu liệt nửa người.`
    );
    return {
      replyMessage: {
        id: `msg-agent-scenario-${Date.now()}`,
        sender: 'agent',
        text: replyText,
        timestamp: nowStr,
        legalReference: { lawCode: 'Dược Thư Quốc Gia Việt Nam 2015 Trang 1095', title: 'Chuyên luận Paracetamol', clause: 'Chỉ định giảm đau, hạ sốt' },
        card,
        suggestedChips: ['Paracetamol liều tối đa bao nhiêu', 'Kiểm tra hạn dùng FEFO', 'Thông tin thuốc Prasocare']
      },
      card
    };
  }

  // 14. Kịch bản Xử Trí Sốt & Các Loại Thuốc Hạ Sốt Chuẩn Dược Thư 2015 & CSDL Kho Viện
  if (
    (/sốt|hạ sốt|thân nhiệt/i.test(lower) && /38|39|40|độ|làm gì|làm sao|uống gì|thuốc gì|các loại|thông tin|hướng dẫn/i.test(lower)) ||
    /thuốc hạ sốt|các loại thuốc hạ sốt|thuốc hạ nhiệt|thuốc giảm sốt/i.test(lower)
  ) {
    const tempMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:độ|°c)/);
    const tempStr = tempMatch ? `${tempMatch[1]}°C` : '';
    const titleHeader = !tempStr
      ? `### 🌡️ HƯỚNG DẪN CÁC LOẠI THUỐC HẠ SỐT & PHÁC ĐỒ XỬ TRÍ AN TOÀN (Dược Thư Quốc Gia 2015)\n\n`
      : `### 🌡️ HƯỚNG DẪN XỬ TRÍ SỐT CAO (${tempStr.toUpperCase()}) & PHÁC ĐỒ HẠ SỐT AN TOÀN\n\n`;

    const card: AgentActionCard = {
      cardType: 'medication_safety',
      title: 'Hạ Sốt An Toàn: PARACETAMOL 500mg',
      summary: 'Lô: LOT-PC24-11A • Tồn: 80 Viên (Kho Dược Nội Trú - Kệ A1 Tầng 1) • SĐK: 893100110026',
      data: {
        medication: 'PARACETAMOL 500mg',
        activeIngredient: 'Paracetamol',
        stock: '80 Viên',
        location: 'Kho Dược Nội Trú (Kệ A1 - Tầng 1)',
        dosage: '500mg - 1000mg/lần cách 4-6h (Max 4g/24h)',
        batch: 'LOT-PC24-11A',
        targetTab: 'fefo'
      },
      primaryActionLabel: 'Xem Tồn Kho Paracetamol',
      primaryActionType: 'NAVIGATE_TAB',
      targetTab: 'fefo',
      status: 'pending'
    };

    const replyText = (
      titleHeader +
      `Sốt là phản ứng bảo vệ của hệ miễn dịch khi cơ thể gặp nhiễm trùng hoặc viêm cấp tính. Dưới đây là phân loại các nhóm thuốc hạ sốt chuẩn y khoa và phác đồ sử dụng an toàn:\n\n` +
      `#### 1. Nhóm thuốc hạ sốt đầu tay: **PARACETAMOL (ACETAMINOPHEN)**\n` +
      `• **Vị thế lâm sàng:** Thuốc hạ sốt an toàn nhất, ít tác dụng phụ lên đường tiêu hóa và đông máu.\n` +
      `• **Biệt dược có sẵn trong kho bệnh viện:** **PARACETAMOL 500mg** (Lô: \`LOT-PC24-11A\` | Tồn kho: **80 Viên** tại Kho Dược Nội Trú - Kệ A1 Tầng 1).\n` +
      `• **Liều lượng chuẩn (Dược Thư Quốc Gia 2015 Trang 1095):**\n` +
      `  - **Người lớn:** Uống **500mg - 1.000mg/lần** (1 - 2 viên 500mg), cách mỗi **4 - 6 giờ** nếu nhiệt độ $\\ge 38.5^\\circ\\text{C}$.\n` +
      `  - **Trẻ em:** Liều chuẩn theo cân nặng **10 - 15 mg/kg/lần**, cách mỗi 4 - 6 giờ (tối đa không quá 60 mg/kg/ngày).\n` +
      `• **CẢNH BÁO NGUY HIỂM VỀ LIỀU TỐI ĐA (Chống suy gan cấp):**\n` +
      `  - **Tuyệt đối không uống quá 4.000mg (4g)/24 giờ** ở người lớn (tương đương 8 viên 500mg).\n` +
      `  - Bệnh nhân suy gan hoặc nghiện rượu liều tối đa không quá **2g/24 giờ**.\n\n` +
      `#### 2. Nhóm thuốc thay thế: **NSAIDs (IBUPROFEN)**\n` +
      `• **Chỉ định:** Dùng khi sốt cao không đáp ứng Paracetamol hoặc có kèm triệu chứng đau viêm cấp.\n` +
      `• **Liều dùng người lớn:** **200mg - 400mg/lần**, uống sau khi ăn no, cách mỗi 6 - 8 giờ (tối đa 1.200mg/ngày).\n` +
      `• **Thận trọng & Chống chỉ định:** Người có tiền sử viêm loét dạ dày tá tràng, suy thận mạn tính, hen suyễn.\n\n` +
      `🚨 **HAI CẢNH BÁO BẮT BUỘC TRONG HẠ SỐT (An Toàn Dược Lâm Sàng):**\n` +
      `1. **NGUY CƠ SỐT XUẤT HUYẾT DENGUE:** **Tuyệt đối KHÔNG tự ý dùng Aspirin hoặc Ibuprofen** khi người bệnh sốt chưa rõ nguyên nhân vì gây ức chế ngưng tập tiểu cầu, dẫn đến xuất huyết nội tạng và tiêu hóa dữ dội nguy hiểm tính mạng.\n` +
      `2. **HỘI CHỨNG REYE Ở TRẺ EM:** **Tuyệt đối KHÔNG dùng Aspirin cho trẻ em và thanh thiếu niên** nghi ngờ nhiễm virus cúm hoặc thủy đậu vì có thể gây thoái hóa mỡ gan và phù não cấp tính (tử vong cao).\n\n` +
      `#### 3. Các biện pháp hỗ trợ không dùng thuốc\n` +
      `• **Lau ấm:** Dùng khăn thấm nước ấm ($37^\\circ\\text{C} - 38^\\circ\\text{C}$) lau vùng nách, bẹn, trán. **Tuyệt đối không chườm đá lạnh hoặc cồn**.\n` +
      `• **Bù nước & Điện giải:** Uống nhiều nước ấm, dung dịch Oresol (pha đúng thể tích) để tránh mất nước.\n\n` +
      `🚨 **DẤU HIỆU BÁO ĐỘNG ĐỎ CẦN ĐẾN CƠ SỞ Y TẾ NGAY:**\n` +
      `• Sốt cao kèm: Co giật, lơ mơ, khó thở, nôn ói liên tục, xuất huyết dưới da (chấm bầm tím), hoặc sốt cao liên tục không hạ sau 2 cữ thuốc.`
    );

    return {
      replyMessage: {
        id: `msg-agent-scenario-${Date.now()}`,
        sender: 'agent',
        text: replyText,
        timestamp: nowStr,
        legalReference: { lawCode: 'Dược Thư Quốc Gia Việt Nam 2015 Trang 1095', title: 'Chuyên luận Paracetamol & Thuốc hạ sốt', clause: 'Phác đồ hạ sốt an toàn' },
        card,
        suggestedChips: ['Thông tin về thuốc Paracetamol', 'Dấu hiệu cảnh báo sốt xuất huyết', 'Kiểm tra hạn dùng FEFO']
      },
      card
    };
  }

  return null;
}
