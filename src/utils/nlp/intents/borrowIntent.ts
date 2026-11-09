/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentActionCard, ChatMessage, DebtRecord } from '../../../types/clinical';
import { anyKeyword, ProcessedQueryResult } from '../types';
import { MED_CATALOG, findMatchedMed } from '../entityCatalog';
import { evaluateLocalCDSS } from '../cdssEngine';

export function matchBorrowIntent(lower: string): boolean {
  // 1. Loại trừ nếu là câu hỏi lâm sàng, chỉ định, tác dụng, liều dùng, an toàn, hoặc tra cứu
  const isQuestionOrInquiry = lower.includes('?') || anyKeyword(lower, [
    'thế nào', 'như thế nào', 'làm gì', 'để làm gì', 'là gì', 'là thuốc gì',
    'tác dụng', 'công dụng', 'chỉ định', 'chống chỉ định', 'tương tác',
    'thành phần', 'dị ứng', 'thời gian bán thải', 'dược động học', 'cơ chế',
    'thông tin', 'hướng dẫn', 'hỏi', 'bao nhiêu', 'uống lúc nào', 'khi nào', 'giải độc',
    'có dùng được', 'có uống được', 'có tiêm được', 'có nên', 'dùng được không',
    'uống được không', 'tiêm được không', 'được không', 'được ko', 'hay không',
    'không?', 'sao không', 'an toàn', 'nguy cơ', 'nguy hiểm', 'lưu ý', 'thận trọng',
    'mang thai', 'có thai', 'thai kỳ', 'bà bầu', 'phụ nữ', 'cho con bú', 'suy gan', 'suy thận',
    'trẻ em', 'sơ sinh', 'người già', 'cao tuổi', 'bị sốt', 'đau đầu'
  ]);
  if (isQuestionOrInquiry) return false;

  // 2. Loại trừ dặn dò, gửi mail, nhắc uống thuốc
  const isAdviceOrReminder = anyKeyword(lower, [
    'dặn dò', 'dặn', 'nhắc', 'lịch uống', 'thông báo', 'gửi mail', 'email', 'gmail', 'uống thuốc'
  ]);
  if (isAdviceOrReminder) return false;

  // 3. Bắt buộc phải có thuốc hoặc vật tư cụ thể
  const matchedMed = findMatchedMed(lower);
  if (!matchedMed) return false;

  // 4. Có hành động xuất / rút / mượn rõ ràng từ tủ trực
  const hasDispenseAction = anyKeyword(lower, [
    'mượn', 'lập phiếu nợ', 'kê nợ', 'mượn tủ trực', 'mượn khẩn', 'phiếu nợ'
  ]) || (
    anyKeyword(lower, ['lấy', 'rút', 'xuất', 'cấp phát']) &&
    (anyKeyword(lower, ['lọ', 'ống', 'chai', 'viên', 'tủ trực', 'gấp', 'khẩn', 'stat', 'cấp cứu']) || /\d+/.test(lower))
  ) || (lower.includes('cho') && anyKeyword(lower, ['lọ', 'ống', 'chai', 'viên', 'liều']) && /\d+/.test(lower));

  const hasUrgencyOrMed = anyKeyword(lower, [
    'gấp', 'khẩn', 'ngay', 'cấp cứu', 'stat', 'liều', 'lọ', 'ống', 'buồng', 'phòng mổ', 'giường', 'tủ trực'
  ]);

  return hasDispenseAction && hasUrgencyOrMed;
}

export function handleBorrowIntent(text: string, lower: string, nowStr: string): ProcessedQueryResult {
  const matchedMed = findMatchedMed(lower);
  if (!matchedMed) {
    return {
      replyMessage: {
        id: `msg-agent-${Date.now()}`,
        sender: 'agent',
        text: 'Vui lòng cung cấp rõ tên thuốc hoặc vật tư y tế cần xuất/mượn (ví dụ: Morphin, Adrenalin, Ceftriaxone, Bơm tiêm...) kèm số lượng.',
        timestamp: nowStr,
        suggestedChips: ['Cho 1 lọ morphin', 'Lấy 1 ống adrenalin', 'Xuất 1 chai lipid 20%']
      }
    };
  }
  const medToUse = matchedMed;

  let quantityNum = 2;
  const unitMatch = lower.match(/(\d+)\s*(lọ|ống|bộ|cái|hộp|liều|chai|viên)/);
  if (unitMatch) {
    quantityNum = parseInt(unitMatch[1], 10);
  } else {
    const verbQtyMatch = lower.match(/(?:rút|lấy|mượn|dùng|tiêm|xuất|cần|cho)\s*(?:gấp|khẩn)?\s*(\d+)/);
    if (verbQtyMatch) {
      quantityNum = parseInt(verbQtyMatch[1], 10);
    } else {
      const anyNumber = lower.match(/(\d+)/);
      if (anyNumber) quantityNum = parseInt(anyNumber[1], 10);
    }
  }
  const quantityStr = `${quantityNum} ${medToUse.unit}`;

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
  if (lower.includes('sốc phản vệ') || lower.includes('phản vệ')) {
    clinicalReason = 'Cấp cứu sốc phản vệ độ 3 sau tiêm thuốc (Phác đồ Thông tư 51/2017)';
  } else if (lower.includes('khởi mê')) {
    clinicalReason = 'Khởi mê phẫu thuật sọ não cấp cứu';
  } else if (lower.includes('gãy') || lower.includes('chấn thương')) {
    clinicalReason = 'Đa chấn thương gãy hở xương, giảm đau tiền phẫu';
  } else if (lower.includes('co giật')) {
    clinicalReason = 'Cắt cơn co giật cấp cứu';
  } else if (lower.includes('thuốc tê')) {
    clinicalReason = 'Giải độc ngộ độc toàn thân do thuốc tê (LAST Protocol)';
  }

  const code = `PN-2026-${Math.floor(100 + Math.random() * 900)}`;
  const newDebt: DebtRecord = {
    id: `debt-${Date.now()}`,
    code,
    itemName: medToUse.name,
    itemType: medToUse.type as any,
    quantity: quantityStr,
    patientName,
    patientRoom,
    borrowTime: nowStr,
    borrowDate: 'Hôm nay',
    borrowerName: 'ĐD. Lê Thị Thu (Ca trực đêm)',
    status: 'debt',
    note: clinicalReason,
    legalBasis: medToUse.isNarcotic ? 'Thông tư 22/2011/TT-BYT & TT 20/2017/TT-BYT' : 'Thông tư 22/2011/TT-BYT',
    ampouleReturned: !medToUse.isNarcotic,
    ampouleDestroyed: false,
    isNarcotic: medToUse.isNarcotic
  };

  const cdssAlert = evaluateLocalCDSS(medToUse.name, quantityNum, text);

  const card: AgentActionCard = {
    cardType: 'borrow_confirm',
    title: `Xác nhận rút mượn khẩn ${medToUse.name}`,
    summary: `Rút ${quantityStr} từ cơ số tủ trực cấp cứu ban đêm`,
    data: {
      item_name: medToUse.name,
      quantity: quantityNum,
      quantity_str: quantityStr,
      patient_name: patientName,
      patient_room: patientRoom,
      clinical_reason: clinicalReason,
      is_narcotic: medToUse.isNarcotic,
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
          `• **Mặt hàng:** ${medToUse.name} (Phân loại: *${medToUse.type}*)\n` +
          `• **Số lượng:** ${quantityStr}\n` +
          `• **Chỉ định:** ${clinicalReason}\n` +
          (medToUse.isNarcotic
            ? `• **Ràng buộc pháp lý:** Theo Điều 15 Thông tư 20/2017/TT-BYT, thuốc gây nghiện bắt buộc phải thu hồi vỏ ống thủy tinh rỗng vào khay kiểm soát sau khi tiêm.\n`
            : `• **Căn cứ:** Điều 10 Thông tư 22/2011/TT-BYT (Quy chế Tủ trực khoa lâm sàng).\n`) +
          cdssWarningMarkdown +
          `Vui lòng kiểm tra thẻ hành động bên dưới và bấm nút xác nhận để mở hộp thoại ký số / nhập PIN chuyên môn.`,
    timestamp: nowStr,
    legalReference: {
      lawCode: medToUse.isNarcotic ? 'Thông tư 20/2017 & TT 22/2011' : 'Thông tư 22/2011/TT-BYT',
      title: medToUse.isNarcotic ? 'Quản lý thuốc gây nghiện & Tủ trực' : 'Quy chế Tủ trực lâm sàng',
      clause: medToUse.isNarcotic ? 'Điều 15 TT 20 (Thu hồi vỏ) & Điều 10 TT 22' : 'Điều 10 - Mượn khẩn ca trực'
    },
    card,
    cdssAlert,
    pipelineStage: 'offline_engine',
    suggestedChips: medToUse.isNarcotic
      ? ['Thu hồi vỏ ống Morphin', 'Xem sổ nợ thuốc tủ trực']
      : [`Thông tin thuốc ${medToUse.name}`, 'Xem tồn kho tủ trực', 'Đối soát ca trực']
  };

  return { replyMessage };
}
