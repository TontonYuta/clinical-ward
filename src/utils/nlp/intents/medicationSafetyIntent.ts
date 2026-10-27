/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Xử lý Ý định: Thành Phần Thuốc, Chỉ Định ("Dùng để làm gì"), Cảnh Báo Dị Ứng & 5 Đúng (<=200 LOC)
 */

import { AgentActionCard, ChatMessage } from '../../../types/clinical';
import { anyKeyword, ProcessedQueryResult } from '../types';
import { findMatchedMed, MED_CATALOG } from '../entityCatalog';
import { getMedicationClinicalProfile } from '../../../data/clinicalProfiles';

export function matchMedicationSafetyIntent(lower: string): boolean {
  // 1. Nhóm từ khóa hỏi về Chỉ định ("Dùng để làm gì", tác dụng, công dụng)
  const hasIndicationQuery = anyKeyword(lower, [
    'dùng để làm gì', 'dung de lam gi', 'dùng làm gì', 'dung lam gi',
    'chỉ định', 'chi dinh', 'tác dụng', 'tac dung', 'công dụng', 'cong dung',
    'chữa bệnh gì', 'chua benh gi', 'dùng trong trường hợp nào', 'khi nào dùng',
    'uống lúc nào', 'tiêm lúc nào'
  ]);

  // 2. Nhóm từ khóa hỏi về Thành phần & Dị ứng
  const hasAllergyOrComponentQuery = anyKeyword(lower, [
    'thành phần', 'thanh phan', 'gồm những gì', 'chứa chất gì', 'tá dược', 'ta duoc',
    'dạng bào chế', 'hoạt chất', 'dị ứng', 'di ung', 'ai không được dùng', 'ai khong duoc dung',
    'ai dị ứng', 'ai di ung', 'dị ứng chéo', 'di ung cheo', 'phản vệ', 'quá mẫn'
  ]);

  // 3. Nhóm từ khóa Dược thư & 5 Đúng chuẩn & Liều dùng
  const hasSafetyKeyword = anyKeyword(lower, [
    '5 đúng', 'năm đúng', 'quy chuẩn 5 đúng', 'tiêu chuẩn 5 đúng',
    'thông tin thuốc', 'dược thư', 'phù hợp với ai', 'chống chỉ định',
    'liều dùng', 'liều lượng', 'liều tối đa', 'dùng liều', 'thuốc giải độc', 'antidote',
    'tác dụng phụ', 'hướng dẫn dùng liều', 'dùng thế nào', 'dùng như thế nào', 'uống thế nào'
  ]);

  // 4. Nhóm từ khóa tra cứu thông tin chung
  const hasInfoKeyword = anyKeyword(lower, [
    'thông tin', 'thong tin', 'thuốc', 'thuoc', 'hỏi về', 'hoi ve', 'tra cứu', 'tra cuu',
    'là thuốc gì', 'la thuoc gi', 'là gì', 'la gi', 'tài liệu', 'đối chứng', 'pdf', 'nguồn'
  ]);

  // Loại trừ hành động cấp phát / mượn thuốc hoặc kê đơn trực tiếp
  const hasExplicitAction = anyKeyword(lower, [
    'cho 1', 'cho 2', 'cho 3', 'cho 4', 'lấy 1', 'lấy 2', 'xuất 1', 'xuất 2', 'xuất chai',
    'lấy gấp', 'tiêm gấp', 'mượn khẩn', 'xuất khẩn', 'tiêm tĩnh mạch 1', 'tiêm 1', 'tiêm 2',
    'kê 1', 'kê 2', 'cần 1', 'cần 2', 'kê đơn', 'dặn dò', 'nhắc thuốc', 'trả vỏ', 'thanh toán nợ'
  ]);

  const matched = findMatchedMed(lower);
  const isShortMedQuery = Boolean(matched) && lower.trim().split(/\s+/).length <= 4;

  return (hasIndicationQuery || hasAllergyOrComponentQuery || hasSafetyKeyword || hasInfoKeyword || isShortMedQuery) &&
    !hasExplicitAction &&
    Boolean(matched);
}

export function handleMedicationSafetyIntent(
  text: string,
  lower: string,
  nowStr: string
): ProcessedQueryResult {
  const matched = findMatchedMed(lower);
  if (!matched) {
    return {
      replyMessage: {
        id: `msg-agent-${Date.now()}`,
        sender: 'agent',
        text: 'Vui lòng cung cấp chính xác tên thuốc hoặc số đăng ký để tra cứu cơ sở dữ liệu quốc gia 54.885 thuốc.',
        timestamp: nowStr
      }
    };
  }
  const profile = getMedicationClinicalProfile(matched.name);
  const comp = profile.composition;
  const allergy = profile.allergyProfile;

  // 1. Xây dựng khối Thành phần công thức
  const activeStr = comp?.activeIngredients?.length
    ? comp.activeIngredients.map(a => `${a.innName} (${a.chemicalSalt}) - ${a.strength}`).join('; ')
    : (profile.activeIngredients || [matched.name]).join(', ');

  const excipientStr = comp?.excipients?.length
    ? comp.excipients.map(e => `${e.name} [${e.role}]`).join(', ')
    : (allergy?.excipientAllergens || ['Tá dược tiêu chuẩn']).join(', ');

  const compBlock = `🧪 **Thành Phần Công Thức & Dạng Bào Chế**:
   • **Dược chất chính (API)**: ${activeStr}
   • **Tá dược (Excipients)**: ${excipientStr}
   • **Dạng bào chế & Cảm quan**: ${comp?.dosageForm || 'Dung dịch tiêm'} (${comp?.appearance || 'Đạt tiêu chuẩn Dược điển'})
   ${comp?.phAndOsmolarity ? `• **pH & Áp lực thẩm thấu**: ${comp.phAndOsmolarity}` : ''}
   ${comp?.pharmacopeiaStandard ? `• **Tiêu chuẩn chất lượng**: ${comp.pharmacopeiaStandard}` : ''}`;

  // 2. Chỉ định điều trị
  const indicationsText = (profile.indications || [profile.targetPopulation])
    .map((ind) => `   • ${ind}`)
    .join('\n');

  // 3. Cảnh báo dị ứng
  const allergyWarningText = allergy
    ? `⚠️ **CẢNH BÁO DỊ ỨNG & THÀNH PHẦN (${allergy.allergyClass})**:
   • **Chống chỉ định tiền sử**: ${(allergy.contraindicatedAllergies || profile.contraindications).slice(0, 2).join('; ')}
   ${allergy.crossReactivities?.length ? `• **Nguy cơ dị ứng chéo**: ${allergy.crossReactivities.join(', ')}` : ''}
   • **Xử trí khi nghi ngờ phản vệ**: ${allergy.emergencyManagement}`
    : `⚠️ **CẢNH BÁO DỊ ỨNG**: Chống chỉ định người có tiền sử mẫn cảm với hoạt chất hoặc tá dược. Xử trí Adrenalin nếu phản vệ theo TT 51/2017/TT-BYT.`;

  const src = profile.officialSource;
  const pdfCitationLine = src?.pdfDocument
    ? `\n📚 **Tài liệu đối chứng chính thức:** ${src.documentName}\n` +
      `📄 **Tệp PDF & Trang:** \`${src.pdfDocument}\`${src.pdfPage ? ` (Trang ${src.pdfPage})` : ''}\n` +
      `🔗 **Mở tài liệu gốc:** [📖 Mở tệp PDF Dược Thư 2015 ${src.pdfPage ? `(Trang ${src.pdfPage})` : ''}](${src.citationUrl || `/pdf/${src.pdfDocument}`})\n`
    : (src ? `\n📚 **Nguồn trích xuất chính thức:** ${src.documentName} (SĐK: ${src.registrationNumber || 'Cục QLD'}, ${src.approvalAuthority || 'Bộ Y Tế'})\n` : '');

  const replyText = `### Dược Thư & Thông Tin Thuốc: **${profile.tallManLASA || matched.name}**
*(Theo QĐ 2033/QĐ-BYT, QĐ 2147/QĐ-BYT & Dược điển Việt Nam V)*

${pdfCitationLine}
${compBlock}

🎯 **Chỉ định điều trị ("Dùng để làm gì?")**:
${indicationsText}
${profile.pharmacologyMechanism ? `   *(Cơ chế: ${profile.pharmacologyMechanism})*\n` : ''}
${allergyWarningText}

🛡️ **Liều Dùng & Hướng Dẫn Sử Dụng An Toàn**:
   • **Liều chỉ định**: ${profile.standardDosing} (Liều trần 24h: **${profile.maxDailyDose}**)
   • **Đường dùng**: ${profile.administrationRouteDetails}
   ${profile.routeWarning ? `• **Cảnh báo nguy kịch**: ${profile.routeWarning}` : ''}
   • **Thời gian & Tần suất**: ${profile.timingAndFrequency}
${profile.antidote ? `\n🧪 **Thuốc giải độc đặc hiệu (Antidote)**: **${profile.antidote}**` : ''}
${profile.blackBoxWarning ? `\n⛔ **${profile.blackBoxWarning}**` : ''}

👉 Bấm nút bên dưới để mở toàn bộ Hồ sơ Dược Thư & Chuyên luận đối chứng gốc.`;

  const card: AgentActionCard = {
    cardType: 'medication_safety',
    title: `Thông Tin Thuốc: ${matched.name}`,
    summary: 'Chỉ định điều trị, thành phần công thức, liều dùng & căn cứ đối chứng Dược Thư 2015',
    data: {
      medName: matched.name,
      tallMan: profile.tallManLASA,
      activeIngredients: activeStr,
      indications: profile.indications,
      allergyClass: allergy?.allergyClass,
      allergyWarning: allergy?.contraindicatedAllergies?.[0] || 'Kiểm tra tiền sử dị ứng trước khi dùng',
      crossReactivities: allergy?.crossReactivities,
      antidote: profile.antidote,
      standardDosing: profile.standardDosing,
      officialSource: src ? `${src.documentName}${src.pdfPage ? ` • Trang ${src.pdfPage}` : ''}` : undefined,
      pdfDocument: src?.pdfDocument,
      pdfPage: src?.pdfPage,
      citationUrl: src?.citationUrl,
    },
    primaryActionLabel: src?.pdfPage ? `Mở PDF Dược Thư (Trang ${src.pdfPage.toString().split('-')[0].trim()})` : 'Xem Thông Tin Thuốc Chi Tiết',
    primaryActionType: 'OPEN_MEDICATION_SAFETY',
    status: 'pending',
  };

  const replyMessage: ChatMessage = {
    id: `msg-agent-${Date.now()}`,
    sender: 'agent',
    text: replyText,
    timestamp: nowStr,
    legalReference: {
      lawCode: src?.registrationNumber ? `SĐK: ${src.registrationNumber}` : 'DĐVN V & QĐ 2147/QĐ-BYT & TT 51/2017',
      title: src?.documentName || 'Dược điển Việt Nam V & Dược lâm sàng',
      clause: src?.approvalAuthority || 'Thành phần công thức, an toàn dùng thuốc & phản vệ',
    },
    card,
  };

  return { replyMessage };
}
