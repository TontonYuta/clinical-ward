/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Xử lý Ý định: Thành Phần Thuốc, Chỉ Định ("Dùng để làm gì"), Cảnh Báo Dị Ứng & 5 Đúng (<=200 LOC)
 */

import { AgentActionCard, ChatMessage } from '../../../types/clinical';
import { anyKeyword, ProcessedQueryResult } from '../types';
import { findMatchedMed, MED_CATALOG } from '../entityCatalog';
import { getMedicationClinicalProfile } from '../../../data/clinicalProfiles';

const CURATED_DDI: Array<{ a: string[]; b: string[]; severity: string; effect: string; action: string; source: string }> = [
  { a: ['ceftriaxone', 'ceftriaxon'], b: ['calcium', 'calci', 'ringer lactat'], severity: 'Nghiêm trọng', effect: 'Có thể tạo kết tủa ceftriaxon–calci trong đường truyền; trẻ sơ sinh có nguy cơ đặc biệt.', action: 'Không pha/truyền đồng thời cùng đường. Tuân thủ hướng dẫn sản phẩm và phác đồ cơ sở; trẻ sơ sinh cần đánh giá chống chỉ định.', source: 'QĐ 5948/QĐ-BYT; nhãn thuốc ceftriaxon' },
  { a: ['simvastatin', 'lovastatin'], b: ['clarithromycin', 'erythromycin'], severity: 'Nghiêm trọng', effect: 'Macrolid ức chế CYP3A4, làm tăng phơi nhiễm statin và nguy cơ bệnh cơ/tiêu cơ vân.', action: 'Cần bác sĩ/dược sĩ rà soát lựa chọn kháng sinh hoặc xử trí statin; không tự ngừng thuốc.', source: 'QĐ 5948/QĐ-BYT; nhãn thuốc statin/macrolid' },
  { a: ['ciprofloxacin', 'levofloxacin'], b: ['theophylline', 'theophyllin'], severity: 'Nghiêm trọng', effect: 'Có thể làm giảm thanh thải theophylline, tăng nguy cơ ngộ độc và co giật/loạn nhịp.', action: 'Tránh phối hợp nếu có lựa chọn; nếu bắt buộc, bác sĩ cần đánh giá liều và theo dõi nồng độ/độc tính.', source: 'QĐ 5948/QĐ-BYT; thông tin kê toa' },
  { a: ['clopidogrel'], b: ['omeprazole', 'omeprazol', 'esomeprazole', 'esomeprazol'], severity: 'Cần rà soát', effect: 'Ức chế CYP2C19 có thể giảm hoạt hóa clopidogrel và hiệu lực kháng tiểu cầu.', action: 'Bác sĩ cân nhắc PPI thay thế phù hợp; không tự thay đổi thuốc chống kết tập tiểu cầu.', source: 'QĐ 5948/QĐ-BYT; nhãn thuốc clopidogrel' },
  { a: ['nitroglycerin', 'nitroglycerine', 'isosorbide', 'isosorbid', 'nitrat'], b: ['sildenafil', 'tadalafil', 'vardenafil'], severity: 'Chống chỉ định', effect: 'Giãn mạch cộng hợp có thể gây tụt huyết áp nặng, ngất hoặc thiếu máu cơ tim.', action: 'Không phối hợp; cần cấp cứu/đánh giá y tế nếu đã dùng cùng hoặc xuất hiện chóng mặt, ngất, đau ngực.', source: 'QĐ 5948/QĐ-BYT; nhãn thuốc nitrat/PDE-5' },
  { a: ['amiodarone', 'amiodaron'], b: ['moxifloxacin', 'levofloxacin', 'erythromycin', 'clarithromycin', 'domperidone', 'domperidon', 'ondansetron', 'haloperidol'], severity: 'Nghiêm trọng', effect: 'Có thể cộng hợp kéo dài QT, tăng nguy cơ xoắn đỉnh và loạn nhịp thất.', action: 'Cần rà soát ECG, điện giải và lựa chọn thuốc bởi bác sĩ; không tự phối hợp.', source: 'QĐ 5948/QĐ-BYT; nhãn thuốc' },
  { a: ['aceclofenac'], b: ['ketorolac'], severity: 'Chống chỉ định', effect: 'Phối hợp NSAID làm tăng độc tính tiêu hóa và nguy cơ xuất huyết.', action: 'Tránh phối hợp; hỏi bác sĩ/dược sĩ về lựa chọn giảm đau khác.', source: 'QĐ 5948/QĐ-BYT' },
  { a: ['tramadol'], b: ['linezolid', 'moclobemide', 'moclobemid', 'selegiline', 'selegilin'], severity: 'Chống chỉ định', effect: 'Tăng nguy cơ hội chứng serotonin và độc tính thần kinh nghiêm trọng.', action: 'Không phối hợp nếu chưa có chỉ định chuyên môn; cần đánh giá khẩn nếu kích động, sốt, run/co giật.', source: 'QĐ 5948/QĐ-BYT; nhãn thuốc' },
];

function checkCuratedInteractions(lower: string): string[] {
  return CURATED_DDI.filter(pair =>
    pair.a.some(term => lower.includes(term)) && pair.b.some(term => lower.includes(term)) ||
    pair.b.some(term => lower.includes(term)) && pair.a.some(term => lower.includes(term))
  ).map(pair => `• **${pair.severity} — ${pair.a[0]} + ${pair.b[0]}**\n  - Hậu quả: ${pair.effect}\n  - Xử trí: ${pair.action}\n  - Nguồn: ${pair.source}`);
}

function extractDrugPair(lower: string): [string, string] | null {
  const names = [...new Set(MED_CATALOG.flatMap(m => [m.name, ...m.aliases]).filter(Boolean))]
    .filter(name => lower.includes(name.toLowerCase()))
    .sort((a, b) => b.length - a.length);
  const unique = names.filter((name, i) => !names.slice(0, i).some(longer => longer.includes(name)));
  return unique.length >= 2 ? [unique[0], unique[1]] : null;
}

export function matchDrugInteractionIntent(lower: string): boolean {
  return anyKeyword(lower, ['tương tác', 'uống cùng', 'dùng cùng', 'phối hợp thuốc', 'kết hợp thuốc']) &&
    (anyKeyword(lower, ['thuốc', 'uống', 'dùng', 'phối hợp', 'kết hợp']));
}

export function handleDrugInteractionIntent(text: string, lower: string, nowStr: string): ProcessedQueryResult {
  const pair = extractDrugPair(lower);
  const matches = checkCuratedInteractions(lower);
  const reply = matches.length
    ? `### Rà soát tương tác thuốc\n\n${matches.join('\n\n')}\n\nThông tin này chỉ sàng lọc các cặp đã có trong nguồn được dẫn; không phát hiện tương tác **không đồng nghĩa** phối hợp an toàn. Cần dược sĩ/bác sĩ kiểm tra liều, bệnh nền và toàn bộ thuốc đang dùng.`
    : pair
      ? `### Chưa tìm thấy cảnh báo cho cặp thuốc đã hỏi\n\nĐã nhận diện: **${pair[0]} + ${pair[1]}**. Kho dữ liệu tương tác cục bộ hiện chưa bao phủ đầy đủ cặp này nên không thể kết luận là an toàn. Vui lòng nhờ dược sĩ/bác sĩ kiểm tra nguồn chuyên môn và toàn bộ thuốc, liều dùng, bệnh nền trước khi phối hợp.`
      : `### Tra cứu tương tác thuốc\n\nVui lòng nêu **tên hai thuốc hoặc hoạt chất** (ví dụ: *clopidogrel uống cùng omeprazole có sao không?*). CSDL hiện tại mới bao phủ một số cặp nguy cơ cao; kết quả âm tính không loại trừ tương tác.`;
  return { replyMessage: { id: `msg-ddi-${Date.now()}`, sender: 'agent', text: reply, timestamp: nowStr, legalReference: { lawCode: 'QĐ 5948/QĐ-BYT', title: 'Danh mục tương tác thuốc chống chỉ định', clause: 'Sàng lọc cặp thuốc có trong nguồn cục bộ' } } };
}

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
