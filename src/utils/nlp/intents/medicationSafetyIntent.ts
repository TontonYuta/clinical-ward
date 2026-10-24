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
    'chỉ định', 'chi dinh', 'tác dụng của', 'tac dung cua', 'công dụng', 'cong dung',
    'chữa bệnh gì', 'chua benh gi', 'dùng trong trường hợp nào', 'khi nào dùng'
  ]);

  // 2. Nhóm từ khóa hỏi về Thành phần & Dị ứng
  const hasAllergyOrComponentQuery = anyKeyword(lower, [
    'thành phần', 'thanh phan', 'gồm những gì', 'chứa chất gì', 'tá dược', 'ta duoc',
    'dạng bào chế', 'hoạt chất', 'dị ứng', 'di ung', 'ai không được dùng', 'ai khong duoc dung',
    'ai dị ứng', 'ai di ung', 'dị ứng chéo', 'di ung cheo', 'phản vệ', 'quá mẫn'
  ]);

  // 3. Nhóm từ khóa Dược thư & 5 Đúng chuẩn
  const hasSafetyKeyword = anyKeyword(lower, [
    '5 đúng', 'năm đúng', 'quy chuẩn 5 đúng', 'tiêu chuẩn 5 đúng',
    'thông tin thuốc', 'dược thư', 'phù hợp với ai', 'chống chỉ định',
    'liều tối đa', 'thuốc giải độc', 'antidote', 'tác dụng phụ', 'hướng dẫn dùng liều'
  ]);

  // Loại trừ hành động cấp phát / mượn thuốc trực tiếp
  const hasExplicitDispenseAction = anyKeyword(lower, [
    'cho 1 lọ', 'cho 1 ống', 'lấy gấp 1', 'tiêm gấp', 'mượn khẩn', 'xuất khẩn', 'tiêm tĩnh mạch 1'
  ]);

  return (hasIndicationQuery || hasAllergyOrComponentQuery || hasSafetyKeyword) && !hasExplicitDispenseAction;
}

export function handleMedicationSafetyIntent(
  text: string,
  lower: string,
  nowStr: string
): ProcessedQueryResult {
  const matched = findMatchedMed(lower) || MED_CATALOG[0];
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

  const replyText = `### Dược Thư Lâm Sàng & Cảnh Báo An Toàn: **${profile.tallManLASA || matched.name}**
*(Theo QĐ 2147/QĐ-BYT, Dược điển Việt Nam V & Thông tư 51/2017/TT-BYT)*

${compBlock}

🎯 **Chỉ định điều trị ("Dùng để làm gì?")**:
${indicationsText}
${profile.pharmacologyMechanism ? `   *(Cơ chế: ${profile.pharmacologyMechanism})*\n` : ''}
${allergyWarningText}

🛡️ **Quy Chuẩn 5 Đúng & Kiểm Soát Nguy Cơ Cao**:
   • **Đúng Liều**: ${profile.standardDosing} (Liều trần 24h: **${profile.maxDailyDose}**)
   • **Đúng Đường dùng**: ${profile.administrationRouteDetails}
   ${profile.routeWarning ? `• **Cảnh báo nguy kịch**: ${profile.routeWarning}` : ''}
   • **Đúng Thời gian**: ${profile.timingAndFrequency}
${profile.antidote ? `\n🧪 **Thuốc giải độc đặc hiệu (Antidote)**: **${profile.antidote}**` : ''}
${profile.blackBoxWarning ? `\n⛔ **${profile.blackBoxWarning}**` : ''}

👉 Bấm nút bên dưới để mở toàn bộ Hồ sơ Dược thư lâm sàng & bảng checklist đối soát điều dưỡng.`;

  const card: AgentActionCard = {
    cardType: 'medication_safety',
    title: `Dược Thư & Thành Phần: ${matched.name}`,
    summary: 'Thành phần công thức, Chỉ định ("Dùng để làm gì") & Cảnh báo dị ứng',
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
    },
    primaryActionLabel: 'Mở Dược Thư & Thành Phần Chi Tiết',
    primaryActionType: 'OPEN_MEDICATION_SAFETY',
    status: 'pending',
  };

  const replyMessage: ChatMessage = {
    id: `msg-agent-${Date.now()}`,
    sender: 'agent',
    text: replyText,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'DĐVN V & QĐ 2147/QĐ-BYT & TT 51/2017',
      title: 'Dược điển Việt Nam V & Dược lâm sàng',
      clause: 'Thành phần công thức, an toàn dùng thuốc & phản vệ',
    },
    card,
  };

  return { replyMessage };
}
