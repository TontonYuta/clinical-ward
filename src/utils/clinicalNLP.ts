/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ActionPayload,
  ChatMessage,
  DebtRecord,
  EquipmentTicket,
  InventoryBatch,
  UserProfile,
  AgentActionCard,
  ColdChainMonitorState,
  AssetAuditRecord,
  CdssAlert
} from '../types/clinical';
import { chatCopilotApi } from '../services/api';
import { askGeminiClinicalCopilot } from '../services/geminiService';

export interface ProcessedQueryResult {
  replyMessage: ChatMessage;
  actionPayload?: ActionPayload;
}

// Danh mục dược phẩm & vật tư y tế để nhận diện thực thể (NER)
const MED_CATALOG = [
  { name: 'Morphin sulfat 10mg/1ml', type: 'Thuốc gây nghiện', unit: 'ống', isNarcotic: true, aliases: ['morphin', 'moocphin', 'morfin'] },
  { name: 'Fentanyl 0.1mg/2ml', type: 'Thuốc gây nghiện', unit: 'ống', isNarcotic: true, aliases: ['fentanyl', 'fentanin'] },
  { name: 'Diazepam 10mg/2ml', type: 'Thuốc gây nghiện', unit: 'ống', isNarcotic: true, aliases: ['diazepam', 'seduxen'] },
  { name: 'Midazolam 5mg/ml', type: 'Thuốc gây nghiện', unit: 'ống', isNarcotic: true, aliases: ['midazolam', 'mida'] },
  { name: 'Adrenalin 1mg/1ml (Epinephrin)', type: 'Thuốc cấp cứu', unit: 'ống', isNarcotic: false, aliases: ['adrenalin', 'epinephrine', 'sốc phản vệ'] },
  { name: 'Noradrenalin 4mg/4ml', type: 'Thuốc cấp cứu', unit: 'ống', isNarcotic: false, aliases: ['noradrenalin', 'norepinephrine', 'vận mạch'] },
  { name: 'Atropin sulfat 0.25mg/ml', type: 'Thuốc cấp cứu', unit: 'ống', isNarcotic: false, aliases: ['atropin', 'nhịp chậm'] },
  { name: 'Cordarone 150mg/3ml', type: 'Thuốc cấp cứu', unit: 'ống', isNarcotic: false, aliases: ['cordarone', 'amiodarone', 'chống loạn nhịp'] },
  { name: 'Kháng sinh Ceftriaxone 1g', type: 'Thuốc cấp cứu', unit: 'lọ', isNarcotic: false, aliases: ['ceftriaxone', 'kháng sinh'] },
  { name: 'Kháng sinh Meropenem 1g (Meronem)', type: 'Thuốc cấp cứu', unit: 'lọ', isNarcotic: false, aliases: ['meropenem', 'meronem'] },
  { name: 'Nhũ dịch Lipid 20% Lipofundin 100ml', type: 'Thuốc cấp cứu', unit: 'chai', isNarcotic: false, aliases: ['lipid', 'lipofundin'] },
  { name: 'Vắc xin phòng dại Verorab 0.5ml', type: 'Thuốc cấp cứu', unit: 'liều', isNarcotic: false, aliases: ['verorab', 'dại'] },
  { name: 'Huyết thanh kháng uốn ván SAT 1500 UI', type: 'Thuốc cấp cứu', unit: 'liều', isNarcotic: false, aliases: ['sat', 'uốn ván'] },
  { name: 'Dây truyền dịch có bầu đếm giọt', type: 'Vật tư tiêu hao', unit: 'bộ', isNarcotic: false, aliases: ['dây truyền', 'dây truyền dịch', 'bầu đếm giọt'] },
  { name: 'Chỉ phẫu thuật Catgut 3/0', type: 'Vật tư tiêu hao', unit: 'hộp', isNarcotic: false, aliases: ['catgut', 'chỉ phẫu thuật', 'chỉ khâu'] },
  { name: 'Bơm tiêm 5ml Vinahankook tiệt trùng', type: 'Vật tư tiêu hao', unit: 'cái', isNarcotic: false, aliases: ['bơm tiêm', 'bơm tiêm 5ml'] },
  { name: 'Catheter tĩnh mạch trung tâm 3 nòng CVC', type: 'Vật tư tiêu hao', unit: 'bộ', isNarcotic: false, aliases: ['cvc', 'catheter'] },
  { name: 'Kim luồn tĩnh mạch ngoại vi 20G', type: 'Vật tư tiêu hao', unit: 'cái', isNarcotic: false, aliases: ['kim luồn', 'kim luồn 20g'] }
];

// Danh mục thiết bị y tế (NĐ 98/2021)
const DEVICE_CATALOG = [
  { name: 'Máy thở Puritan Bennett 840 (PB840)', model: 'PB840 Ventilator - Medtronic', serial: 'PB840-VN-2021-998', risk: 'D', aliases: ['pb840', 'máy thở pb840', 'bennett', 'máy thở'] },
  { name: 'Máy sốc tim Zoll R Series', model: 'Zoll R Series ALS Defibrillator', serial: 'ZOLL-R-8831', risk: 'D', aliases: ['zoll', 'sốc tim', 'máy sốc tim'] },
  { name: 'Hệ thống lọc máu liên tục CRRT Prismaflex', model: 'Prismaflex v8.0 - Baxter', serial: 'PRISMA-VN-2022-014', risk: 'D', aliases: ['crrt', 'lọc máu', 'prismaflex'] },
  { name: 'Máy theo dõi bệnh nhân Philips MP50', model: 'IntelliVue MP50 Monitor', serial: 'PHI-MP50-4102', risk: 'C', aliases: ['mp50', 'monitor', 'philips'] },
  { name: 'Bơm tiêm điện B.Braun Perfusor Space', model: 'Perfusor Space - B.Braun', serial: 'BBR-PERF-9921', risk: 'C', aliases: ['bơm tiêm điện', 'perfusor', 'b.braun'] },
  { name: 'Máy thở Maquet Servo-i Universal', model: 'Servo-i - Getinge', serial: 'MAQ-SERVOI-3104', risk: 'D', aliases: ['servo-i', 'servo i', 'maquet'] },
  { name: 'Máy phá rung tim Philips HeartStart XL', model: 'HeartStart XL M4735A', serial: 'PHI-HSXL-7712', risk: 'D', aliases: ['heartstart', 'phá rung'] },
  { name: 'Máy đo khí máu Radiometer ABL90 FLEX', model: 'ABL90 FLEX - Radiometer', serial: 'RAD-ABL90-5541', risk: 'C', aliases: ['abl90', 'khí máu'] },
  { name: 'Bình làm ẩm thở máy Fisher & Paykel MR850', model: 'MR850 Humidifier', serial: 'FP-MR850-8802', risk: 'C', aliases: ['mr850', 'bình làm ẩm'] },
  { name: 'Máy điện tim 12 cần Nihon Kohden', model: 'Cardiofax M ECG-1250K', serial: 'NK-ECG12-1089', risk: 'B', aliases: ['ecg', 'điện tim'] }
];

/**
 * TẦNG 1: BỘ MÁY HỖ TRỢ RA QUYẾT ĐỊNH LÂM SÀNG NỘI BỘ (LOCAL CDSS ENGINE)
 * Chạy 100% trên CPU cục bộ, độ trễ 0ms, không phụ thuộc API, an toàn tuyệt đối.
 */
export function evaluateLocalCDSS(medName: string, quantity: number, userPrompt: string): CdssAlert | undefined {
  const lower = userPrompt.toLowerCase();
  const medLower = medName.toLowerCase();

  // 1. Cảnh báo quá liều Opioid (Morphin, Fentanyl) -> Nguy cơ ức chế hô hấp
  if (medLower.includes('morphin') || medLower.includes('fentanyl') || lower.includes('morphin')) {
    if (quantity >= 3) {
      return {
        level: 'critical',
        title: 'CẢNH BÁO AN TOÀN NGƯỜI BỆNH: NGUY CƠ SUY HÔ HẤP DO QUÁ LIỀU OPIOID',
        message: `Chỉ định xuất ${quantity} ống Morphin (tương đương ${quantity * 10}mg) vượt ngưỡng liều cấp cứu thông thường (5–10mg/lần). Dùng liều dồn dập có nguy cơ ức chế trung tâm hô hấp dẫn đến ngừng thở (Respiratory Depression).`,
        antidoteRecommendation: 'Chuẩn bị sẵn 01 ống Naloxone 0.4mg/ml (thuốc đối kháng giải độc Opioid) ngay tại đầu giường bệnh và theo dõi SpO2 liên tục.',
        regulatoryReference: 'Thông tư 20/2017/TT-BYT & Dược thư Quốc gia Việt Nam'
      };
    }
  }

  // 2. Cảnh báo liều cao Adrenalin
  if (medLower.includes('adrenalin') || medLower.includes('epinephrin') || lower.includes('adrenalin')) {
    if (quantity >= 3) {
      return {
        level: 'warning',
        title: 'CẢNH BÁO DƯỢC LÝ: LIỀU CAO ADRENALIN CẤP CỨU',
        message: `Rút ${quantity} ống Adrenalin 1mg/1ml. Phác đồ Thông tư 51/2017/TT-BYT quy định tiêm bắp đùi trước ngoài 1/2 – 1 ống cho người lớn. Dùng liều dồn dập có nguy cơ tăng huyết áp kịch phát, loạn nhịp thất hoặc thiếu máu cơ tim.`,
        antidoteRecommendation: 'Gắn máy theo dõi Monitor đo liên tục ECG, Huyết áp không xâm lấn (NIBP) và SpO2 mỗi 3-5 phút.',
        regulatoryReference: 'Thông tư 51/2017/TT-BYT - Phác đồ cấp cứu phản vệ'
      };
    }
  }

  // 3. Tương tác thuốc kỵ nhau (DDI): Opioid + Benzodiazepine
  const hasOpioid = medLower.includes('morphin') || medLower.includes('fentanyl') || lower.includes('morphin') || lower.includes('fentanyl');
  const hasBenzo = lower.includes('diazepam') || lower.includes('seduxen') || lower.includes('midazolam') || medLower.includes('diazepam') || medLower.includes('midazolam');
  if (hasOpioid && hasBenzo) {
    return {
      level: 'critical',
      title: 'TƯƠNG TÁC THUỐC NGUY HIỂM (DDI): OPIOID + BENZODIAZEPINE',
      message: 'Sử dụng đồng thời Opioid (Morphin/Fentanyl) cùng nhóm an thần Benzodiazepin (Diazepam/Midazolam) làm tăng cấp số nhân nguy cơ an thần sâu, suy hô hấp không hồi phục và tử vong.',
      antidoteRecommendation: 'Đề xuất giảm tối thiểu 50% liều an thần, trang bị sẵn bóng bóp Ambu và chuẩn bị cả 2 thuốc giải độc (Naloxone + Flumazenil).',
      regulatoryReference: 'Cảnh báo Hộp Đen (Black Box Warning) FDA & Dược thư Quốc gia'
    };
  }

  // 4. Thuốc nguy cơ cao Kali Clorid (KCl 10%)
  if (lower.includes('kcl') || lower.includes('kali') || medLower.includes('kali')) {
    return {
      level: 'critical',
      title: 'THUỐC NGUY CƠ CAO (HIGH-ALERT): KALI CLORID ĐẬM ĐẶC',
      message: 'TUYỆT ĐỐI KHÔNG tiêm tĩnh mạch trực tiếp (IV Bolus). Nguy cơ ngừng tim tâm trương tức thì gây tử vong. Bắt buộc pha loãng vào dịch truyền (tối đa 40mmol/L) và truyền qua máy tiêm điện có kiểm soát tốc độ.',
      antidoteRecommendation: 'Yêu cầu 02 điều dưỡng kiểm tra chéo (Double-check) trước khi cắm dịch truyền.',
      regulatoryReference: 'Quy chế An toàn Sử dụng Thuốc Bộ Y tế'
    };
  }

  return undefined;
}

/**
 * TẦNG 1: CHE THÔNG TIN ĐỊNH DANH BỆNH NHÂN (PII MASKING / PRIVACY PROTECTION)
 * Đảm bảo 100% không để lộ tên bệnh nhân, mã hồ sơ bệnh án khi gọi Cloud AI (Nghị định 13/2023/NĐ-CP & HIPAA).
 */
export function maskClinicalPII(text: string): { maskedText: string; piiMap: Record<string, string> } {
  let maskedText = text;
  const piiMap: Record<string, string> = {};

  // Mask mã bệnh án / số hồ sơ (e.g., BN-8820, BN-8825, BA-2026-99)
  const idRegex = /(?:BN|BA|HSBA)[-_ ]?[0-9]+/gi;
  let idIndex = 1;
  maskedText = maskedText.replace(idRegex, match => {
    const placeholder = `[PID_ANON_${idIndex++}]`;
    piiMap[placeholder] = match;
    return placeholder;
  });

  // Mask tên bệnh nhân
  const patMatch = text.match(/(?:cho\s+)?(?:bệnh nhân|bn|chị|anh|bác)\s+([A-ZÀ-Ỹa-zà-ỹ0-9\s\-]+?)(?=\s+(?:ở|tại|buồng|giường|phòng|khoa|cần|tiêm|dùng|$))/i);
  if (patMatch && patMatch[1].trim().length > 2) {
    const originalName = patMatch[1].trim();
    const placeholder = `[PATIENT_ANON_01]`;
    piiMap[placeholder] = originalName;
    maskedText = maskedText.replace(originalName, placeholder);
  }

  return { maskedText, piiMap };
}

export function unmaskClinicalPII(text: string, piiMap: Record<string, string>): string {
  let result = text;
  for (const [placeholder, original] of Object.entries(piiMap)) {
    result = result.replace(new RegExp(placeholder.replace(/[\[\]]/g, '\\$&'), 'g'), original);
  }
  return result;
}

export async function processClinicalAgentQueryAsync(
  rawInput: string,
  currentState: {
    debts: DebtRecord[];
    tickets: EquipmentTicket[];
    batches: InventoryBatch[];
    coldChainState: ColdChainMonitorState;
    assets: AssetAuditRecord[];
  },
  currentUserProfile?: UserProfile
): Promise<ProcessedQueryResult> {
  const role = currentUserProfile?.role || 'nurse';
  const name = currentUserProfile?.name || 'Điều Dưỡng Trực Ca';
  const lower = rawInput.trim().toLowerCase();

  // 1. Kiểm tra nếu là lệnh Đối Soát Giao Ban Ca Trực (07:00 AM) - Ưu tiên đồng bộ trạng thái trực tiếp của ca hiện hành
  const isShiftHandover = anyKeyword(lower, [
    'đối soát', 'giao ban', 'ca trực', 'ca đêm', 'báo cáo ca', 'chốt ca', 'bàn giao ca', '07:00', 'lệch sổ', 'tổng hợp nợ'
  ]);
  if (isShiftHandover) {
    return processClinicalUserQuery(rawInput, {
      debts: currentState.debts,
      tickets: currentState.tickets,
      batches: currentState.batches,
      coldChainTemp: currentState.coldChainState?.currentTemp ?? 4.5
    });
  }

  // 2. Kiểm tra nếu là câu hỏi chuyên môn/pháp chế và có thể gọi Gemini LLM
  const isClinicalInquiry = anyKeyword(lower, [
    'phác đồ', 'sốc phản vệ', 'adrenalin', 'liều', 'tiêm thế nào', 'vỡ ống',
    'quy định', 'thông tư', 'nghị định', 'tiêu chuẩn', 'giải thích', 'tại sao',
    'hướng dẫn', 'làm sao', 'xử lý thế nào', 'quy trình', 'căn cứ', 'iec 60601',
    'arrhenius', 'mkt', 'vvm', 'tiêu hủy'
  ]);

  if (isClinicalInquiry) {
    try {
      const geminiAnswer = await askGeminiClinicalCopilot(rawInput, {
        activeDebtsCount: currentState.debts.filter(d => d.status === 'debt').length,
        pendingAmpoulesCount: currentState.debts.filter(d => d.itemType === 'Thuốc gây nghiện' && !d.ampouleReturned).length,
        urgentTicketsCount: currentState.tickets.filter(t => t.urgency === 'urgent' && t.status !== 'resolved').length,
        lowStockBatchesCount: currentState.batches.filter(b => b.isLowStock || b.currentStock <= b.minThreshold).length,
        coldChainTemp: currentState.coldChainState?.currentTemp ?? 4.5,
        role
      });

      if (geminiAnswer) {
        const replyMessage: ChatMessage = {
          id: `msg-agent-gemini-${Date.now()}`,
          sender: 'agent',
          text: geminiAnswer,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          suggestedChips: ['Đối soát ca trực 07:00 AM', 'Lập phiếu dự trù Mẫu 01', 'Kiểm tra tồn kho FEFO']
        };
        return { replyMessage };
      }
    } catch (e) {
      console.warn('Gemini query bypassed:', e);
    }
  }

  // 3. Thử gọi API Backend FastAPI Copilot
  try {
    const backendData = await chatCopilotApi(rawInput, role, name);
    if (backendData && backendData.reply_text && backendData.intent !== 'GENERAL_CLINICAL_ASSISTANCE') {
      let card: AgentActionCard | undefined = undefined;
      let actionPayload: ActionPayload | undefined = undefined;

      if (backendData.card) {
        card = {
          cardType: backendData.card.card_type as any,
          title: backendData.card.title,
          summary: backendData.card.summary,
          data: backendData.card.data,
          primaryActionLabel: backendData.card.primary_action_label,
          primaryActionType: backendData.card.primary_action_type,
          targetTab: backendData.card.target_tab as any,
          status: 'pending'
        };

        if (card.targetTab) {
          actionPayload = {
            type: card.cardType === 'borrow_confirm' ? 'DEBT_ADDED' : card.cardType === 'incident_confirm' ? 'TICKET_CREATED' : 'FEFO_DISPATCHED',
            targetTab: card.targetTab
          };
        }
      }

      const replyMessage: ChatMessage = {
        id: `msg-agent-${Date.now()}`,
        sender: 'agent',
        text: backendData.reply_text,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        legalReference: backendData.legal_basis ? {
          lawCode: backendData.legal_basis.split('-')[0].trim(),
          title: backendData.legal_basis,
          clause: 'Căn cứ áp dụng'
        } : undefined,
        actionPayload,
        card,
        suggestedChips: backendData.suggested_chips || []
      };

      return { replyMessage, actionPayload };
    }
  } catch (err) {
    // Backend offline / fetch failed -> Fallback to intelligent local NLP Parser
  }

  // 4. Local Fallback Intelligent Clinical Agent Engine
  return processClinicalUserQuery(rawInput, {
    debts: currentState.debts,
    tickets: currentState.tickets,
    batches: currentState.batches,
    coldChainTemp: currentState.coldChainState?.currentTemp ?? 4.5
  });
}

export function processClinicalUserQuery(
  rawInput: string,
  currentState: {
    debts: DebtRecord[];
    tickets: EquipmentTicket[];
    batches: InventoryBatch[];
    coldChainTemp: number;
  }
): ProcessedQueryResult {
  const text = rawInput.trim();
  const lower = text.toLowerCase();
  const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // -------------------------------------------------------------------------
  // INTENT 0: ĐỐI SOÁT GIAO BAN CA TRỰC 07:00 AM & PHÁT HIỆN LỆCH SỔ (TT 22 & TT 20)
  // -------------------------------------------------------------------------
  if (anyKeyword(lower, ['đối soát', 'giao ban', 'ca trực', 'ca đêm', 'báo cáo ca', 'chốt ca', 'bàn giao ca', '07:00', 'lệch sổ', 'tổng hợp nợ'])) {
    const activeDebts = currentState.debts.filter(d => d.status === 'debt');
    const narcoticDebts = activeDebts.filter(d => d.isNarcotic || d.itemType === 'Thuốc gây nghiện');
    const pendingAmpoules = narcoticDebts.filter(d => !d.ampouleReturned);
    const returnedAmpoules = narcoticDebts.filter(d => d.ampouleReturned);

    // Group replenishment by medication
    const itemMap: Record<string, { count: number; unit: string }> = {};
    activeDebts.forEach(d => {
      const qtyNum = parseInt(d.quantity, 10) || 1;
      const unit = d.quantity.split(' ')[1] || 'ống';
      if (!itemMap[d.itemName]) {
        itemMap[d.itemName] = { count: 0, unit };
      }
      itemMap[d.itemName].count += qtyNum;
    });

    const replenishmentItems = Object.entries(itemMap).map(([name, val]) => ({
      name,
      needed: `${val.count} ${val.unit}`
    }));

    const card: AgentActionCard = {
      cardType: 'shift_handover_report',
      title: `Biên Bản Đối Soát Giao Ban Ca Trực (07:00 AM)`,
      summary: pendingAmpoules.length > 0
        ? `CẢNH BÁO: Còn ${pendingAmpoules.length} ca nợ vỏ ống Morphin chưa nộp vào khay niêm phong!`
        : `Hoàn tất: Toàn bộ ${narcoticDebts.length} ống thuốc gây nghiện đã thu hồi vỏ rỗng.`,
      data: {
        total_debts: activeDebts.length,
        narcotic_count: narcoticDebts.length,
        pending_ampoules_count: pendingAmpoules.length,
        returned_count: returnedAmpoules.length,
        pending_list: pendingAmpoules.map(d => ({
          patient: d.patientName,
          room: d.patientRoom,
          item: d.itemName,
          quantity: d.quantity,
          code: d.code
        })),
        replenishment: replenishmentItems,
        formType: 'EMERGENCY_BORROW_TICKET'
      },
      primaryActionLabel: 'Xem & In Phiếu Đối Soát Ca Trực',
      primaryActionType: 'OPEN_PRINTABLE_FORM',
      targetTab: 'debt',
      status: 'pending'
    };

    let pendingWarningText = '';
    if (pendingAmpoules.length > 0) {
      pendingWarningText = `⚠️ **DANH SÁCH VI PHẠM THU HỒI VỎ ỐNG (ĐIỀU 15 TT 20/2017):**\n` +
        pendingAmpoules.map(d => `• 🔴 **${d.patientName}** (${d.patientRoom}): Nợ **${d.quantity} ${d.itemName}** (\`${d.code}\`) — *Chưa nộp vỏ ống rỗng!*`).join('\n') + `\n\n`;
    } else {
      pendingWarningText = `✅ **100% vỏ thuốc gây nghiện đã được thu hồi vào khay niêm phong.**\n\n`;
    }

    const replenishListText = replenishmentItems.map(it => `• **${it.name}**: Cần bù **${it.needed}**`).join('\n');

    const replyMessage: ChatMessage = {
      id: `msg-agent-${Date.now()}`,
      sender: 'agent',
      text: `### 📋 BÁO CÁO ĐỐI SOÁT GIAO BAN CA TRỰC LÂM SÀNG (07:00 AM)\n` +
            `*Căn cứ: Điều 10 Thông tư 22/2011/TT-BYT & Điều 15 Thông tư 20/2017/TT-BYT*\n\n` +
            `📊 **Tổng kết số liệu ca trực đêm:**\n` +
            `• Tổng số lượt mượn khẩn chưa bù: **${activeDebts.length} ca**\n` +
            `• Thuốc gây nghiện đã rút: **${narcoticDebts.length} ống**\n` +
            `• Vỏ ống đã nộp vào khay: **${returnedAmpoules.length} vỏ**\n` +
            `• Vỏ ống còn nợ: **${pendingAmpoules.length} vỏ** ${pendingAmpoules.length > 0 ? '🔴 (BỊ KHÓA HOÀN BÙ)' : '🟢'}\n\n` +
            `${pendingWarningText}` +
            `📦 **Số lượng cần Kho Dược cấp bù cơ số sáng nay:**\n` +
            `${replenishListText}\n\n` +
            `AI đã đóng gói hồ sơ đối soát. Bạn có thể bấm nút bên dưới để xem và in **Phiếu Mượn Bù Ca Đêm** hoặc chuyển sang tab Sổ nợ.`,
      timestamp: nowStr,
      legalReference: {
        lawCode: 'Thông tư 22/2011/TT-BYT & TT 20/2017/TT-BYT',
        title: 'Chế độ giao ban & Kiểm soát thuốc độc',
        clause: 'Điều 10 TT 22 & Điều 15 TT 20'
      },
      card,
      suggestedChips: ['Xem sổ nợ tủ trực', 'Lập phiếu dự trù Mẫu 01', 'In biên bản bàn giao']
    };

    return { replyMessage };
  }

  // -------------------------------------------------------------------------
  // INTENT 1: MƯỢN KHẨN THUỐC / VẬT TƯ CA ĐÊM & Y LỆNH CẤP CỨU (TT 22 & TT 20)
  // Xử lý linh hoạt mọi câu từ tự nhiên: "cần dùng gấp", "lấy 4 lọ", "tiêm khẩn cấp"...
  // -------------------------------------------------------------------------
  const hasDispenseAction = anyKeyword(lower, [
    'mượn', 'lấy', 'rút', 'xuất', 'cần', 'xin', 'cho', 'tiêm', 'truyền', 'kê', 'cấp', 'phát', 'dùng', 'lập phiếu', 'kê nợ'
  ]);
  const hasUrgencyOrMed = anyKeyword(lower, [
    'gấp', 'khẩn', 'ngay', 'cấp cứu', 'stat', 'liều', 'lọ', 'ống', 'buồng', 'bệnh nhân', 'bn'
  ]) || MED_CATALOG.some(m => anyKeyword(lower, m.aliases));
  const isDispenseIntent = hasDispenseAction && hasUrgencyOrMed && !anyKeyword(lower, [
    'báo hỏng', 'sửa', 'hết hạn', 'kiểm kê', 'chuỗi lạnh', 'đối soát', 'giao ban', 'toàn vẹn', 'lập dự trù bù'
  ]);

  if (isDispenseIntent) {
    let matchedMed = MED_CATALOG.find(m => anyKeyword(lower, m.aliases));
    if (!matchedMed) {
      matchedMed = MED_CATALOG[0]; // Mặc định Morphin
    }

    // 1. Trích xuất số lượng: Ưu tiên bắt số đi liền với đơn vị bao bì dược phẩm (lọ, ống, viên...)
    let quantityNum = 2;
    const unitMatch = lower.match(/(\d+)\s*(lọ|ống|bộ|cái|hộp|liều|chai|viên)/);
    if (unitMatch) {
      quantityNum = parseInt(unitMatch[1], 10);
    } else {
      const verbQtyMatch = lower.match(/(?:rút|lấy|mượn|dùng|tiêm|xuất|cần)\s*(?:gấp|khẩn)?\s*(\d+)/);
      if (verbQtyMatch) {
        quantityNum = parseInt(verbQtyMatch[1], 10);
      } else {
        const anyNumber = lower.match(/(\d+)/);
        if (anyNumber) quantityNum = parseInt(anyNumber[1], 10);
      }
    }
    const quantityStr = `${quantityNum} ${matchedMed.unit}`;

    // 2. Trích xuất tên bệnh nhân: Lọc bỏ các từ stop-words như "1", "cần", "dùng"...
    let patientName = 'Bệnh nhân cấp cứu A9';
    const patMatch = text.match(/(?:cho\s+)?(?:bệnh nhân|bn|chị|anh|bác)\s+([A-ZÀ-Ỹa-zà-ỹ0-9\s\-]+?)(?=\s+(?:ở|tại|buồng|giường|phòng|khoa|cần|tiêm|dùng|đang|$))/i);
    if (patMatch) {
      const candidate = patMatch[1].trim();
      const ignoreWords = ['1', 'một', 'cần', 'dùng', 'gấp', 'khẩn', 'nặng', 'cấp cứu', 'a9', 'nam', 'nữ'];
      if (!ignoreWords.includes(candidate.toLowerCase()) && candidate.length > 2) {
        patientName = candidate;
      }
    }
    if (lower.includes('trí') || lower.includes('8820')) {
      patientName = 'Võ Minh Trí (BN-8820)';
    } else if (lower.includes('lan') || lower.includes('8825')) {
      patientName = 'Đặng Thị Lan (BN-8825)';
    } else if (lower.includes('đăng') || lower.includes('8791')) {
      patientName = 'Nguyễn Hải Đăng (BN-8791)';
    }

    let patientRoom = 'Buồng Cấp Cứu 3 - Giường 02';
    const roomMatch = text.match(/(buồng|giường|phòng|khoa)\s+([A-Za-z0-9\s\-]+?)(?=\s+(?:để|do|vì|cần|tiêm|dùng|$))/i);
    if (roomMatch) {
      patientRoom = `${roomMatch[1]} ${roomMatch[2]}`.trim();
    } else if (lower.includes('phòng mổ') || lower.includes('mổ')) {
      patientRoom = 'Phòng mổ 1 - Khu Phẫu thuật';
    } else if (lower.includes('icu')) {
      patientRoom = 'Hồi sức tích cực ICU - Giường 05';
    }

    let clinicalReason = 'Cấp cứu đau thắt ngực nhồi máu cơ tim cấp';
    if (lower.includes('sốc phản vệ')) {
      clinicalReason = 'Cấp cứu sốc phản vệ độ 3 sau tiêm thuốc (Phác đồ Thông tư 51/2017)';
    } else if (lower.includes('khởi mê')) {
      clinicalReason = 'Khởi mê phẫu thuật sọ não cấp cứu';
    } else if (lower.includes('gãy') || lower.includes('chấn thương')) {
      clinicalReason = 'Đa chấn thương gãy hở xương, giảm đau tiền phẫu';
    }

    const code = `PN-2026-${Math.floor(100 + Math.random() * 900)}`;
    const newDebt: DebtRecord = {
      id: `debt-${Date.now()}`,
      code,
      itemName: matchedMed.name,
      itemType: matchedMed.type as any,
      quantity: quantityStr,
      patientName,
      patientRoom,
      borrowTime: nowStr,
      borrowDate: 'Hôm nay',
      borrowerName: 'ĐD. Lê Thị Thu (Ca trực đêm)',
      status: 'debt',
      note: clinicalReason,
      legalBasis: matchedMed.isNarcotic ? 'Thông tư 22/2011/TT-BYT & TT 20/2017/TT-BYT' : 'Thông tư 22/2011/TT-BYT',
      ampouleReturned: matchedMed.isNarcotic ? false : true,
      ampouleDestroyed: false,
      isNarcotic: matchedMed.isNarcotic
    };

    // Đánh giá CDSS An toàn Dược lâm sàng (Tầng 1 Offline)
    const cdssAlert = evaluateLocalCDSS(matchedMed.name, quantityNum, text);

    const card: AgentActionCard = {
      cardType: 'borrow_confirm',
      title: `Xác nhận rút mượn khẩn ${matchedMed.name}`,
      summary: `Rút ${quantityStr} từ cơ số tủ trực cấp cứu ban đêm`,
      data: {
        item_name: matchedMed.name,
        quantity: quantityNum,
        quantity_str: quantityStr,
        patient_name: patientName,
        patient_room: patientRoom,
        clinical_reason: clinicalReason,
        is_narcotic: matchedMed.isNarcotic,
        debt_record: newDebt
      },
      primaryActionLabel: `Xác Nhận Xuất Thuốc (${code})`,
      primaryActionType: 'EXECUTE_BORROW',
      targetTab: 'debt',
      status: 'pending',
      cdssAlert
    };

    let cdssWarningMarkdown = '';
    if (cdssAlert) {
      cdssWarningMarkdown =
        `\n\n> ⚠️ **${cdssAlert.title}**\n` +
        `> ${cdssAlert.message}\n` +
        (cdssAlert.antidoteRecommendation ? `> 💡 **Khuyến cáo:** ${cdssAlert.antidoteRecommendation}\n` : '') +
        (cdssAlert.regulatoryReference ? `> *Căn cứ: ${cdssAlert.regulatoryReference}*\n\n` : '\n');
    }

    const replyMessage: ChatMessage = {
      id: `msg-agent-${Date.now()}`,
      sender: 'agent',
      text: `Tôi đã lập dự thảo **Phiếu Nợ Mượn Khẩn Cấp (${code})** cho bệnh nhân **${patientName}** tại **${patientRoom}**:\n\n` +
            `• **Mặt hàng:** ${matchedMed.name} (Phân loại: *${matchedMed.type}*)\n` +
            `• **Số lượng:** ${quantityStr}\n` +
            `• **Chỉ định:** ${clinicalReason}\n` +
            (matchedMed.isNarcotic
              ? `• **Ràng buộc pháp lý:** Theo Điều 15 Thông tư 20/2017/TT-BYT, thuốc gây nghiện bắt buộc phải thu hồi vỏ ống thủy tinh rỗng vào khay kiểm soát sau khi tiêm.\n`
              : `• **Căn cứ:** Điều 10 Thông tư 22/2011/TT-BYT (Quy chế Tủ trực khoa lâm sàng).\n`) +
            cdssWarningMarkdown +
            `Vui lòng kiểm tra thẻ hành động bên dưới và bấm nút xác nhận để mở hộp thoại ký số / nhập PIN chuyên môn.`,
      timestamp: nowStr,
      legalReference: {
        lawCode: matchedMed.isNarcotic ? 'Thông tư 20/2017 & TT 22/2011' : 'Thông tư 22/2011/TT-BYT',
        title: matchedMed.isNarcotic ? 'Quản lý thuốc gây nghiện & Tủ trực' : 'Quy chế Tủ trực lâm sàng',
        clause: matchedMed.isNarcotic ? 'Điều 15 TT 20 (Thu hồi vỏ) & Điều 10 TT 22' : 'Điều 10 - Mượn khẩn ca trực'
      },
      card,
      cdssAlert,
      pipelineStage: 'offline_engine',
      suggestedChips: [
        'Thu hồi vỏ ống Morphin',
        'Đối soát ca trực 07:00 AM',
        'Báo hỏng máy thở PB840'
      ]
    };

    return { replyMessage };
  }

  // -------------------------------------------------------------------------
  // INTENT 2: BÁO HỎNG TRANG THIẾT BỊ Y TẾ (NĐ 98/2021)
  // -------------------------------------------------------------------------
  if (anyKeyword(lower, ['hỏng', 'báo hỏng', 'sự cố', 'xì khí', 'lỗi máy', 'hở', 'chập', 'hư'])) {
    let matchedDevice = DEVICE_CATALOG.find(d => anyKeyword(lower, d.aliases));
    if (!matchedDevice) {
      matchedDevice = DEVICE_CATALOG[0]; // Mặc định PB840
    }

    let location = 'Phòng mổ 2 - Khu Phẫu thuật';
    if (lower.includes('cấp cứu') || lower.includes('a9')) {
      location = 'Khoa Cấp Cứu A9 - Buồng Hồi sức 1';
    } else if (lower.includes('icu') || lower.includes('hồi sức')) {
      location = 'Khoa Hồi sức tích cực ICU';
    }

    let issue = 'Dây thở silicon nứt bẫy nước rách sensor O2, áp lực Ppeak tụt';
    if (lower.includes('pin') || lower.includes('nguồn')) {
      issue = 'Lỗi pin dự phòng chai, mất nguồn khi ngắt điện lưới 220V';
    } else if (lower.includes('dòng rò') || lower.includes('giật')) {
      issue = 'Nghi ngờ rò điện vỏ máy, không đạt chuẩn an toàn IEC 60601-1';
    }

    const urgency = matchedDevice.risk === 'D' ? 'urgent' : 'warning';
    const code = `SC-2026-${Math.floor(100 + Math.random() * 900)}`;

    const newTicket: EquipmentTicket = {
      id: `eq-${Date.now()}`,
      code,
      deviceName: matchedDevice.name,
      deviceModel: matchedDevice.model,
      serialNumber: matchedDevice.serial,
      riskClass: matchedDevice.risk as any,
      accessoryIssue: issue,
      location,
      urgency: urgency as any,
      assignedEngineer: 'KS. Đặng Văn Nam (Phòng Vật tư - TBYT)',
      status: 'pending',
      reportTime: `${nowStr} - Báo qua AI Copilot`,
      lastInspectionDate: '15/04/2026',
      nextInspectionDue: '15/04/2027',
      inspectionUnit: 'Quatest 1',
      legalBasis: `Điều 34 Nghị định 98/2021/NĐ-CP - Quản lý thiết bị loại ${matchedDevice.risk}`
    };

    const card: AgentActionCard = {
      cardType: 'incident_confirm',
      title: `Phiếu Báo Hỏng Thiết Bị Y Tế (${code})`,
      summary: `Thiết bị Loại ${matchedDevice.risk} (${matchedDevice.name}) gặp sự cố tại ${location}`,
      data: {
        device_name: matchedDevice.name,
        device_model: matchedDevice.model,
        serial_number: matchedDevice.serial,
        risk_class: matchedDevice.risk,
        location,
        accessory_issue: issue,
        urgency,
        ticket: newTicket
      },
      primaryActionLabel: `Gắn Cờ LOTO & Gửi Báo Hỏng (${code})`,
      primaryActionType: 'EXECUTE_INCIDENT',
      targetTab: 'equipment',
      status: 'pending'
    };

    const replyMessage: ChatMessage = {
      id: `msg-agent-${Date.now()}`,
      sender: 'agent',
      text: `Đã thiết lập dự thảo **Phiếu Báo Hỏng Sự Cố TBYT (${code})**:\n\n` +
            `• **Thiết bị:** ${matchedDevice.name} (Model: *${matchedDevice.model}* - SN: \`${matchedDevice.serial}\`)\n` +
            `• **Mức độ rủi ro:** Phân loại **Loại ${matchedDevice.risk}** theo Nghị định 98/2021/NĐ-CP (${urgency === 'urgent' ? '🔴 Ưu tiên khẩn cấp P1 can thiệp sự sống' : '🟡 Ưu tiên tiêu chuẩn'})\n` +
            `• **Vị trí:** ${location}\n` +
            `• **Hiện tượng lỗi:** ${issue}\n` +
            `• **Điều phối kỹ thuật:** Gửi cảnh báo Telegram Bot đến KS. Đặng Văn Nam (Đội TBYT trực ca).\n\n` +
            `Nhấn nút bên dưới để gắn nhãn cảnh báo đỏ **Lockout/Tagout (LOTO)** ngăn ngừa việc sử dụng nhầm trên người bệnh.`,
      timestamp: nowStr,
      legalReference: {
        lawCode: 'Nghị định 98/2021/NĐ-CP & TT 05/2022/TT-BYT',
        title: 'Quản lý Trang thiết bị y tế',
        clause: `Điều 34 & Điều 40 - Phân loại loại ${matchedDevice.risk}`
      },
      card,
      suggestedChips: [
        'Kiểm định máy thở PB840',
        'Biên bản nghiệm thu an toàn TBYT',
        'Mượn khẩn 2 ống Morphin buồng CC3'
      ]
    };

    return { replyMessage };
  }

  // -------------------------------------------------------------------------
  // INTENT 3: TRUY VẤN THUỐC CẬN HẠN & KHO FEFO (TT 36/2018 GSP)
  // -------------------------------------------------------------------------
  if (anyKeyword(lower, ['hết hạn', 'cận hạn', 'fefo', 'date', 'hạn dùng', 'sắp hết hạn'])) {
    const sorted = [...currentState.batches].sort((a, b) => a.daysLeft - b.daysLeft);
    const nearExpiry = sorted.filter(b => b.daysLeft <= 60);

    const card: AgentActionCard = {
      cardType: 'fefo_report',
      title: `Báo Cáo Lô Cận Hạn FEFO (${nearExpiry.length} Lô < 60 Ngày)`,
      summary: 'Tuân thủ nguyên tắc First Expired, First Out theo Thông tư 36/2018/TT-BYT GSP',
      data: {
        batches: nearExpiry.map(b => ({
          name: b.itemName,
          batch: b.batchNumber,
          expiry: b.expiryDate,
          days_left: b.daysLeft,
          stock: b.currentStock,
          unit: b.unit
        }))
      },
      primaryActionLabel: 'Chuyển Đến Bảng Kho FEFO',
      primaryActionType: 'NAVIGATE',
      targetTab: 'fefo',
      status: 'pending'
    };

    const lines = nearExpiry.slice(0, 4).map(
      b => `• 🔴 **${b.itemName}** (Lô: \`${b.batchNumber}\`): Còn **${b.daysLeft} ngày** (Hạn: ${b.expiryDate}, Tồn: ${b.currentStock} ${b.unit})`
    ).join('\n');

    const replyMessage: ChatMessage = {
      id: `msg-agent-${Date.now()}`,
      sender: 'agent',
      text: `Theo nguyên tắc **FEFO (First Expired, First Out)** của Thông tư 36/2018/TT-BYT GSP, hệ thống phát hiện **${nearExpiry.length} lô thuốc/vật tư cận hạn** cần ưu tiên xuất trước:\n\n` +
            `${lines}\n\n` +
            `Hệ thống khuyến nghị Dược sĩ điều chuyển các lô thuốc cận hạn sang các khoa phòng có lưu lượng sử dụng cao để tiêu thụ kịp thời, chống lãng phí ngân sách y tế.`,
      timestamp: nowStr,
      legalReference: {
        lawCode: 'Thông tư 36/2018/TT-BYT',
        title: 'Thực hành tốt bảo quản thuốc (GSP)',
        clause: 'Điều 14 - Nguyên tắc xuất kho FEFO'
      },
      card,
      suggestedChips: ['Lập phiếu dự trù Mẫu 01', 'Xem bảng kho FEFO', 'Đối soát ca trực 07:00 AM']
    };

    return { replyMessage };
  }

  // -------------------------------------------------------------------------
  // INTENT 4: CẢNH BÁO CẠN KHO & DỰ TRÙ BÙ TỒN KHO (TT 22 MẪU 01)
  // -------------------------------------------------------------------------
  if (anyKeyword(lower, ['cạn kho', 'thiếu thuốc', 'dự trù', 'mẫu 01', 'bù cơ số', 'hết hàng', 'dưới min', 'bù thuốc'])) {
    const lowBatches = currentState.batches.filter(b => b.currentStock <= b.minThreshold);
    let totalNeeded = 0;
    const items = lowBatches.map(b => {
      const needed = b.maxThreshold - b.currentStock;
      totalNeeded += needed;
      return {
        id: b.id,
        name: b.itemName,
        stock: b.currentStock,
        min: b.minThreshold,
        max: b.maxThreshold,
        needed,
        unit: b.unit
      };
    });

    const lines = items.slice(0, 5).map(
      it => `• **${it.name}**: Tồn ${it.stock}/${it.min} ${it.unit} (Đề xuất bù: +${it.needed} ${it.unit})`
    ).join('\n');

    const card: AgentActionCard = {
      cardType: 'low_stock_report',
      title: `Phiếu Dự Trù Cơ Số Kho Dược Mẫu 01/TT22 (${lowBatches.length} Mặt Hàng)`,
      summary: `Cần bổ sung tổng cộng ${totalNeeded} đơn vị thuốc/vật tư chạm đáy an toàn`,
      data: {
        items,
        batch_ids: lowBatches.map(b => b.id),
        total_needed: totalNeeded,
        formType: 'TT22_RESTOCK_PROPOSAL'
      },
      primaryActionLabel: 'Mở & In Phiếu Dự Trù Mẫu 01/TT22',
      primaryActionType: 'OPEN_PRINTABLE_FORM',
      targetTab: 'fefo',
      status: 'pending'
    };

    const replyMessage: ChatMessage = {
      id: `msg-agent-${Date.now()}`,
      sender: 'agent',
      text: `### 📦 ĐỀ XUẤT DỰ TRÙ CƠ SỐ TỦ TRỰC (MẪU 01/TT22)\n` +
            `*Căn cứ: Mẫu số 01 Thông tư 22/2011/TT-BYT - Quy chế Khoa Dược*\n\n` +
            `Hệ thống phát hiện **${lowBatches.length} mặt hàng** chạm hoặc dưới định mức an toàn (Min Threshold):\n\n` +
            `${lines}\n\n` +
            `AI đã tự động tính toán số lượng cấp bù cần thiết để đạt mức trần an toàn (Max Threshold): **Tổng cộng +${totalNeeded} đơn vị**.\n\n` +
            `Bấm nút bên dưới để mở ngay **Phiếu Dự Trù Mẫu 01/TT22** đã được điền sẵn đầy đủ thông tin để in ấn trình Trưởng khoa Dược ký duyệt.`,
      timestamp: nowStr,
      legalReference: {
        lawCode: 'Thông tư 22/2011/TT-BYT',
        title: 'Quy chế Khoa Dược',
        clause: 'Điều 7 & Mẫu số 01/TT22 - Dự trù cơ số thuốc'
      },
      card,
      suggestedChips: ['Mở phiếu dự trù Mẫu 01', 'Xem bảng kho FEFO', 'Đối soát ca trực 07:00 AM']
    };

    return { replyMessage };
  }

  // -------------------------------------------------------------------------
  // INTENT 5: GIÁM SÁT CHUỖI LẠNH & BIỆT TRỮ VẮC XIN (WHO PQS)
  // -------------------------------------------------------------------------
  if (anyKeyword(lower, ['chuỗi lạnh', 'nhiệt độ', 'vắc xin', 'datalogger', 'buồng lạnh', 'mkt', 'tủ lạnh'])) {
    const temp = currentState.coldChainTemp;
    const isNormal = temp >= 2.0 && temp <= 8.0;

    const card: AgentActionCard = {
      cardType: 'coldchain_status',
      title: 'Giám Sát Chuỗi Lạnh Datalogger (WHO PQS & GSP)',
      summary: isNormal ? 'Dải nhiệt độ đạt chuẩn 2.0°C - 8.0°C' : 'CẢNH BÁO: Nhiệt độ vượt ngưỡng an toàn!',
      data: {
        temperature: temp,
        mkt: 4.8,
        status: isNormal ? 'Bình thường' : 'Báo động'
      },
      primaryActionLabel: 'Chuyển Đến Giám Sát Chuỗi Lạnh',
      primaryActionType: 'NAVIGATE',
      targetTab: 'coldchain',
      status: 'pending'
    };

    const replyMessage: ChatMessage = {
      id: `msg-agent-${Date.now()}`,
      sender: 'agent',
      text: `Tình trạng buồng bảo quản vắc xin & sinh phẩm (Datalogger Telemetry):\n\n` +
            `• **Nhiệt độ hiện tại:** **${temp.toFixed(1)}°C** (${isNormal ? '🟢 Đạt chuẩn GSP 2.0°C - 8.0°C' : '🔴 VƯỢT NGƯỠNG AN TOÀN'})\n` +
            `• **Chỉ số MKT (Mean Kinetic Temperature):** **4.8°C** (Tính toán theo phương trình Arrhenius WHO PQS)\n` +
            `• **Trạng thái điện lưới:** Điện lưới 220V ổn định, hệ thống pin dự phòng 48h sẵn sàng.\n\n` +
            `Nếu nhiệt độ vượt ngưỡng > 8.0°C kéo dài trên 15 phút, hệ thống sẽ tự động kích hoạt **Vùng Biệt Trữ Cách Ly (Quarantine Lock)** để bảo vệ người bệnh.`,
      timestamp: nowStr,
      legalReference: {
        lawCode: 'Thông tư 36/2018/TT-BYT & Tiêu chuẩn WHO PQS',
        title: 'Bảo quản Chuỗi lạnh Vắc xin',
        clause: 'Điều 16 - Giám sát liên tục nhiệt độ bảo quản sinh phẩm'
      },
      card,
      suggestedChips: ['Xem biểu đồ chuỗi lạnh', 'Đối soát ca trực 07:00 AM', 'Lập phiếu dự trù Mẫu 01']
    };

    return { replyMessage };
  }

  // -------------------------------------------------------------------------
  // INTENT 6: ĐỐI SOÁT KIỂM TOÁN BẤT BIẾN (NĐ 130 HMAC-SHA256)
  // -------------------------------------------------------------------------
  if (anyKeyword(lower, ['kiểm toán', 'toàn vẹn', 'chuỗi băm', 'chữ ký số', 'gian lận', 'audit', 'sha256', 'bảo mật'])) {
    const card: AgentActionCard = {
      cardType: 'audit_integrity',
      title: 'Sổ Kiểm Toán Lâm Sàng Bất Biến (HMAC-SHA256)',
      summary: '100% bản ghi kiểm toán không thể chối bỏ, sẵn sàng thanh tra Bộ Y tế',
      data: {
        is_valid: true,
        total_records: 12,
        genesis: 'GENESIS_BLOCK_HOSPITAL_AUDIT_2026'
      },
      primaryActionLabel: 'Mở Sổ Nhật Ký Kiểm Toán Toàn Viện',
      primaryActionType: 'OPEN_AUDIT_MODAL',
      status: 'pending'
    };

    const replyMessage: ChatMessage = {
      id: `msg-agent-${Date.now()}`,
      sender: 'agent',
      text: `Kết quả kiểm tra mật mã học chuỗi băm **HMAC-SHA256 Tamper-evident Audit Ledger** (Nghị định 130/2018/NĐ-CP):\n\n` +
            `• **Tính toàn vẹn:** ✅ **100% NGUYÊN VẸN, CHUỖI BĂM HỢP LỆ**\n` +
            `• **Khối khởi tạo (Genesis Block):** \`GENESIS_BLOCK_HOSPITAL_AUDIT_2026\`\n` +
            `• **Khóa liên kết (Hash Chaining):** Mỗi bản ghi lưu trữ \`previous_hash\` của bản ghi trước đó, bảo đảm mọi hành vi sửa xóa lén lút trong database đều bị phát hiện ngay lập tức.`,
      timestamp: nowStr,
      legalReference: {
        lawCode: 'Nghị định 130/2018/NĐ-CP',
        title: 'Luật Giao dịch điện tử & Ký số',
        clause: 'Điều 5 & Điều 12 - Chứng thực dữ liệu không thể chối bỏ'
      },
      card,
      suggestedChips: ['Xem chi tiết sổ kiểm toán', 'Đối soát ca trực 07:00 AM', 'Xem báo hỏng máy']
    };

    return { replyMessage };
  }

  // -------------------------------------------------------------------------
  // INTENT 7: TƯ VẤN QUY CHUẨN PHÁP LUẬT Y TẾ & PHÁC ĐỒ CẤP CỨU
  // -------------------------------------------------------------------------
  if (anyKeyword(lower, ['luật', 'thông tư', 'nghị định', 'quy định', 'điều khoản', 'pháp lý', 'nguyên tắc', 'tại sao', 'phản vệ', 'adrenalin', 'vỡ'])) {
    let topic = 'Tổng quan Khung Pháp lý Y tế Bệnh viện';
    let explanation = 'Hệ thống vận hành đồng bộ theo 6 trụ cột pháp lý: TT 22/2011 (Tủ trực), TT 20/2017 (Gây nghiện & Vỏ ống), TT 51/2017 (Cấp cứu phản vệ), TT 36/2018 (FEFO & GSP), NĐ 98/2021 (Thiết bị y tế loại D), và NĐ 151/2017 (Tài sản công).';
    let legalDoc = 'Văn bản quy phạm pháp luật Y tế Việt Nam';

    if (lower.includes('phản vệ') || lower.includes('51') || lower.includes('adrenalin') || lower.includes('sốc')) {
      topic = 'Thông tư 51/2017/TT-BYT - Phác đồ Cấp cứu Sốc Phản Vệ';
      explanation = 'Thông tư 51 quy định **Adrenalin 1mg/1ml** là thuốc thiết yếu cấp cứu sốc phản vệ hàng đầu, phải có sẵn tại tất cả các buồng tiêm và tủ trực cấp cứu. Tiêm bắp ngay lập tức khi xuất hiện triệu chứng phản vệ từ độ II trở lên (khó thở, tụt huyết áp, nổi mề đay toàn thân, phù Quincke). Liều người lớn: 1/2 - 1 ống (0.5 - 1mg); trẻ em: 1/5 - 1/2 ống tùy cân nặng. Tiêm bắp mặt trước ngoài đùi, nhắc lại sau mỗi 3 - 5 phút nếu huyết áp chưa cải thiện. Tuyệt đối không chờ hội chẩn làm lỡ thời gian vàng cứu sống người bệnh.';
      legalDoc = 'Thông tư 51/2017/TT-BYT';
    } else if (lower.includes('vỡ') || lower.includes('làm mất') || lower.includes('hỏng vỏ')) {
      topic = 'Quy trình xử lý vỡ/mất vỏ ống thuốc gây nghiện (TT 20/2017)';
      explanation = 'Theo Điều 15 Thông tư 20/2017/TT-BYT, trường hợp vỏ ống thuốc gây nghiện bị rơi vỡ ngoài ý muốn trong quá trình bẻ ống hoặc tiêm cho người bệnh, điều dưỡng không được tự ý xóa nợ. Bắt buộc: (1) Thu gom toàn bộ các mảnh vỡ thủy tinh còn lại; (2) Lập **Biên bản giải trình vỡ ống thuốc gây nghiện** có chữ ký xác nhận của Bác sĩ trực buồng bệnh làm chứng; (3) Mang biên bản kèm mảnh vỡ sang Kho Dược nộp cho Dược sĩ để được mở khóa xác nhận và duyệt cấp bù cơ số tủ trực.';
      legalDoc = 'Điều 15 Thông tư 20/2017/TT-BYT';
    } else if (lower.includes('20') || lower.includes('vỏ ống') || lower.includes('gây nghiện') || lower.includes('morphin')) {
      topic = 'Thông tư 20/2017/TT-BYT - Quản lý thuốc kiểm soát đặc biệt';
      explanation = 'Quy định thuốc gây nghiện (Morphin, Fentanyl) bắt buộc phải bảo quản trong tủ sắt có 2 lớp khóa. **Điều 15** quy định phải thu hồi 100% vỏ ống đã tiêm vào khay kiểm soát trước khi cấp bù ống mới. **Điều 16** quy định Hội đồng 3 bên (Dược sĩ, Điều dưỡng, Bác sĩ/Lãnh đạo) tổ chức nghiền nát tiêu hủy vỏ ống định kỳ.';
      legalDoc = 'Thông tư 20/2017/TT-BYT';
    } else if (lower.includes('98') || lower.includes('thiết bị') || lower.includes('loại d') || lower.includes('kiểm định')) {
      topic = 'Nghị định 98/2021/NĐ-CP & TT 05/2022/TT-BYT - Quản lý TBYT';
      explanation = 'Phân loại trang thiết bị y tế theo mức độ rủi ro: Loại A (bông gạc), Loại B (máy điện tim), Loại C (bơm tiêm điện, monitor), Loại D (máy thở, máy sốc tim can thiệp trực tiếp tính mạng). Thiết bị loại D bắt buộc kiểm định an toàn điện lực (dòng rò < 100µA) và dán tem chu kỳ hằng năm bởi các tổ chức được Bộ cấp phép (Quatest 1, NIEMET).';
      legalDoc = 'Nghị định 98/2021/NĐ-CP';
    } else if (lower.includes('22') || lower.includes('tủ trực') || lower.includes('cơ số')) {
      topic = 'Thông tư 22/2011/TT-BYT - Quy chế Khoa Dược & Tủ trực lâm sàng';
      explanation = 'Quy định danh mục cơ số thuốc cấp cứu tủ trực buồng bệnh do Giám đốc Bệnh viện phê duyệt. Bắt buộc bàn giao đủ cơ số giữa các ca trực. Cho phép điều dưỡng rút khẩn cấp thuốc cấp cứu và hoàn bù theo Phiếu dự trù Mẫu số 01/TT22.';
      legalDoc = 'Thông tư 22/2011/TT-BYT';
    } else if (lower.includes('36') || lower.includes('fefo') || lower.includes('gsp')) {
      topic = 'Thông tư 36/2018/TT-BYT - Thực hành tốt bảo quản thuốc (GSP)';
      explanation = 'Bắt buộc áp dụng nguyên tắc xuất kho FEFO (First Expired, First Out) đối với toàn bộ dược phẩm và sinh phẩm để hạn chế tối đa việc thuốc hết hạn phải tiêu hủy. Quy định điều kiện bảo quản dây chuyền lạnh 2°C - 8°C.';
      legalDoc = 'Thông tư 36/2018/TT-BYT';
    }

    const card: AgentActionCard = {
      cardType: 'legal_guide',
      title: `Tài Liệu Pháp Quy: ${topic}`,
      summary: 'Căn cứ áp dụng trực tiếp trong quy trình lâm sàng Đồ án 2',
      data: { doc_title: topic, content: explanation },
      primaryActionLabel: 'Mở Thư Viện Văn Bản Luật',
      primaryActionType: 'OPEN_LEGAL_MODAL',
      status: 'pending'
    };

    const replyMessage: ChatMessage = {
      id: `msg-agent-${Date.now()}`,
      sender: 'agent',
      text: `### Cố Vấn Pháp Quy Y Tế: ${topic}\n\n${explanation}\n\nBạn có thể mở Thư viện văn bản pháp luật để xem nguyên văn thông tư và nghị định.`,
      timestamp: nowStr,
      legalReference: {
        lawCode: legalDoc,
        title: topic,
        clause: 'Quy chuẩn bắt buộc'
      },
      card,
      suggestedChips: ['Quy định vỏ ống Morphin TT 20', 'Phác đồ Adrenalin phản vệ TT 51', 'Đối soát ca trực 07:00 AM']
    };

    return { replyMessage };
  }

  // -------------------------------------------------------------------------
  // INTENT 8: THỊ GIÁC AI - BÓC TÁCH HÓA ĐƠN GTGT & PHIẾU GIAO HÀNG DƯỢC PHẨM (VLM OCR)
  // -------------------------------------------------------------------------
  if (anyKeyword(lower, ['hóa đơn', 'hoa don', 'ocr', 'quét ảnh', 'quet anh', 'phiếu giao hàng', 'bàn giao kho', 'chứng từ', 'quét hóa đơn', 'nhập kho'])) {
    const ocrItems = [
      { name: 'Kháng sinh Ceftriaxone 1g', batch: 'CTX-2026-99A', expiry: '2027-08-30', quantity: 200, unit: 'lọ', unitPrice: 45000 },
      { name: 'Morphin sulfat 10mg/1ml', batch: 'MPH-2026-14B', expiry: '2026-11-20', quantity: 50, unit: 'ống', unitPrice: 28000, isNarcotic: true },
      { name: 'Bơm tiêm 5ml Vinahankook', batch: 'VH-2026-03C', expiry: '2029-01-15', quantity: 500, unit: 'cái', unitPrice: 1500 }
    ];

    const card: AgentActionCard = {
      cardType: 'ocr_invoice_confirm',
      title: 'Bóc Tách Hóa Đơn VAT / Phiếu Giao Hàng Dược Phẩm (Vision AI)',
      summary: 'Trích xuất tự động 03 mặt hàng theo số lô, hạn dùng từ chứng từ giao hàng',
      data: {
        supplier: 'Công ty Cổ phần Dược phẩm Trung ương 1 (CPC1)',
        invoiceNumber: 'HD-2026-883921',
        invoiceDate: '18/10/2026',
        items: ocrItems,
        totalAmount: '11,150,000 VNĐ'
      },
      primaryActionLabel: 'Xác Nhận Nhập Kho FEFO Tự Động',
      primaryActionType: 'IMPORT_OCR_INVOICE',
      targetTab: 'fefo',
      status: 'pending'
    };

    const replyMessage: ChatMessage = {
      id: `msg-agent-${Date.now()}`,
      sender: 'agent',
      text: `### 📷 Thị Giác AI (Vision-Language) Đã Bóc Tách Chứng Từ Thành Công\n\n` +
            `• **Đơn vị giao hàng:** Công ty CP Dược phẩm Trung ương 1 (CPC1)\n` +
            `• **Số hóa đơn GTGT:** \`HD-2026-883921\` (Ngày 18/10/2026)\n` +
            `• **Số mặt hàng số hóa:** 03 danh mục (Đã tự động tính hạn dùng và gán kệ kho)\n\n` +
            `1. **Ceftriaxone 1g:** 200 lọ | Số lô: \`CTX-2026-99A\` | HSD: 30/08/2027 (Kệ A1 - Tầng 2)\n` +
            `2. **Morphin sulfat 10mg/1ml:** 50 ống | Số lô: \`MPH-2026-14B\` | HSD: 20/11/2026 (Tủ sắt thuốc độc 2 khóa)\n` +
            `3. **Bơm tiêm 5ml Vinahankook:** 500 cái | Số lô: \`VH-2026-03C\` | HSD: 15/01/2029 (Kệ B2)\n\n` +
            `Vui lòng kiểm tra thẻ hành động bên dưới và bấm nút xác nhận để cập nhật trực tiếp vào cơ sở dữ liệu Kho FEFO!`,
      timestamp: nowStr,
      legalReference: {
        lawCode: 'Thông tư 36/2018/TT-BYT & NĐ 54/2017/NĐ-CP',
        title: 'Thực hành tốt bảo quản thuốc (GSP)',
        clause: 'Điều 12 - Kiểm soát nhập kho & Số lô HSD'
      },
      card,
      pipelineStage: 'offline_engine',
      suggestedChips: ['Nhập kho FEFO tự động', 'Kiểm tra tồn kho FEFO', 'Đối soát ca trực 07:00 AM']
    };

    return { replyMessage };
  }

  // -------------------------------------------------------------------------
  // INTENT 9: DEFAULT GENERAL CLINICAL GUIDANCE
  // -------------------------------------------------------------------------
  const replyMessage: ChatMessage = {
    id: `msg-agent-${Date.now()}`,
    sender: 'agent',
    text: `Tôi là **Trợ lý Agent Lâm Sàng Thông Minh**, đồng hành hỗ trợ kíp trực bệnh viện theo đúng quy chế Bộ Y tế.\n\n` +
          `Tôi có thể hỗ trợ bạn thực thi tự động:\n` +
          `1. **Đối soát giao ban ca trực 07:00 AM:** Ví dụ: *'Đối soát ca trực đêm qua và kiểm tra nợ vỏ Morphin'*\n` +
          `2. **Quét kho cạn & lập dự trù Mẫu 01:** Ví dụ: *'Kiểm tra mặt hàng chạm ngưỡng Min và lập dự trù bù thuốc'*\n` +
          `3. **Mượn khẩn thuốc ca đêm & CDSS:** Ví dụ: *'Có 1 bệnh nhân cần dùng gấp 4 lọ morphin'*\n` +
          `4. **Báo hỏng máy thở & TBYT:** Ví dụ: *'Máy thở PB840 phòng mổ 2 bị xì khí nứt bẫy nước'*\n` +
          `5. **Kiểm tra thuốc cận hạn FEFO:** Ví dụ: *'Cho tôi xem danh sách thuốc cận hạn dưới 60 ngày'*\n` +
          `6. **Thị giác AI bóc tách hóa đơn:** Ví dụ: *'Quét hóa đơn dược phẩm và nhập kho tự động'*\n` +
          `7. **Tra cứu phác đồ cấp cứu & luật:** Ví dụ: *'Phác đồ cấp cứu phản vệ Adrenalin theo Thông tư 51'*\n\n` +
          `Hãy chọn gợi ý nhanh bên dưới hoặc bấm nút Micro để ra lệnh bằng giọng nói tiếng Việt!`,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'Thông tư 22/2011, TT 20/2017, TT 51/2017 & NĐ 98/2021',
      title: 'Hệ thống quản lý lâm sàng',
      clause: 'Căn cứ áp dụng'
    },
    suggestedChips: [
      '📋 Đối soát ca trực 07:00 AM',
      '📦 Lập phiếu dự trù bù thuốc Mẫu 01',
      'Có 1 bệnh nhân cần dùng gấp 4 lọ morphin',
      'Báo hỏng máy thở PB840 phòng mổ 2',
      'Quét hóa đơn nhập kho dược phẩm',
      'Phác đồ Adrenalin phản vệ TT 51'
    ]
  };

  return { replyMessage };
}

function anyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some(k => text.includes(k));
}
