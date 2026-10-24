/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Xử lý Ý định: Chỉ Định Thuốc ("Dùng để làm gì"), Cảnh Báo Dị Ứng & 5 Đúng (QĐ 2147/BYT & TT 51/2017) (<=200 LOC)
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

  // 2. Nhóm từ khóa hỏi về Dị ứng & Thành phần
  const hasAllergyQuery = anyKeyword(lower, [
    'dị ứng', 'di ung', 'thành phần', 'thanh phan', 'tá dược', 'ta duoc',
    'ai không được dùng', 'ai khong duoc dung', 'ai dị ứng', 'ai di ung',
    'dị ứng chéo', 'di ung cheo', 'phản vệ', 'phan ve', 'quá mẫn', 'qua man'
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

  return (hasIndicationQuery || hasAllergyQuery || hasSafetyKeyword) && !hasExplicitDispenseAction;
}

export function handleMedicationSafetyIntent(
  text: string,
  lower: string,
  nowStr: string
): ProcessedQueryResult {
  const matched = findMatchedMed(lower) || MED_CATALOG[0];
  const profile = getMedicationClinicalProfile(matched.name);
  const allergy = profile.allergyProfile;

  const indicationsText = (profile.indications || [profile.targetPopulation])
    .map((ind) => `   • ${ind}`)
    .join('\n');

  const allergyWarningText = allergy
    ? `⚠️ **CẢNH BÁO DỊ ỨNG & THÀNH PHẦN (${allergy.allergyClass})**:
   • **Hoạt chất & Tá dược**: ${(profile.activeIngredients || [matched.name]).join(', ')} | Tá dược: ${(allergy.excipientAllergens || []).slice(0, 2).join(', ')}
   • **Chống chỉ định tiền sử dị ứng**: ${(allergy.contraindicatedAllergies || profile.contraindications).slice(0, 2).join('; ')}
   ${allergy.crossReactivities?.length ? `• **Nguy cơ dị ứng chéo**: ${allergy.crossReactivities.join(', ')}` : ''}
   • **Xử trí khi nghi ngờ phản vệ**: ${allergy.emergencyManagement}`
    : `⚠️ **CẢNH BÁO DỊ ỨNG**: Chống chỉ định người có tiền sử mẫn cảm với hoạt chất hoặc tá dược. Xử trí Adrenalin nếu phản vệ theo TT 51/2017/TT-BYT.`;

  const replyText = `### Dược Thư Lâm Sàng & Cảnh Báo An Toàn: **${profile.tallManLASA || matched.name}**
*(Theo Quyết định 2147/QĐ-BYT, Thông tư 31/2021/TT-BYT & Thông tư 51/2017/TT-BYT)*

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
    title: `Dược Thư & Cảnh Báo Dị Ứng: ${matched.name}`,
    summary: 'Chỉ định điều trị, Cảnh báo dị ứng thành phần & Quy chuẩn 5 Đúng',
    data: {
      medName: matched.name,
      tallMan: profile.tallManLASA,
      indications: profile.indications,
      allergyClass: allergy?.allergyClass,
      allergyWarning: allergy?.contraindicatedAllergies?.[0] || 'Kiểm tra tiền sử dị ứng trước khi dùng',
      crossReactivities: allergy?.crossReactivities,
      antidote: profile.antidote,
      standardDosing: profile.standardDosing,
    },
    primaryActionLabel: 'Mở Dược Thư & Cảnh Báo Dị Ứng Chi Tiết',
    primaryActionType: 'OPEN_MEDICATION_SAFETY',
    status: 'pending',
  };

  const replyMessage: ChatMessage = {
    id: `msg-agent-${Date.now()}`,
    sender: 'agent',
    text: replyText,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'QĐ 2147/QĐ-BYT & TT 51/2017/TT-BYT',
      title: 'Hướng dẫn Thực hành Dược lâm sàng & Xử trí Sốc Phản vệ',
      clause: 'An toàn dùng thuốc & Cảnh báo dị ứng thành phần',
    },
    card,
  };

  return { replyMessage };
}
