/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Xử lý Ý định Tra cứu Quy chuẩn 5 Đúng & Thông tin Dược Lâm sàng (QĐ 2147/BYT) (<=200 LOC)
 */

import { AgentActionCard, ChatMessage } from '../../../types/clinical';
import { anyKeyword, ProcessedQueryResult } from '../types';
import { findMatchedMed, MED_CATALOG } from '../entityCatalog';
import { getMedicationClinicalProfile } from '../../../data/clinicalProfiles';

export function matchMedicationSafetyIntent(lower: string): boolean {
  const hasSafetyKeyword = anyKeyword(lower, [
    '5 đúng', 'năm đúng', 'quy chuẩn 5 đúng', 'tiêu chuẩn 5 đúng',
    'thông tin thuốc', 'dược thư', 'phù hợp với ai', 'chống chỉ định',
    'liều tối đa', 'thuốc giải độc', 'antidote', 'tác dụng phụ', 'hướng dẫn dùng liều'
  ]);

  // Không phải là hành động xuất/mượn thuốc khẩn
  const hasExplicitDispenseAction = anyKeyword(lower, [
    'cho 1 lọ', 'cho 1 ống', 'lấy gấp 1', 'tiêm gấp', 'mượn khẩn', 'xuất khẩn', 'tiêm tĩnh mạch 1'
  ]);

  return hasSafetyKeyword && !hasExplicitDispenseAction;
}

export function handleMedicationSafetyIntent(
  text: string,
  lower: string,
  nowStr: string
): ProcessedQueryResult {
  const matched = findMatchedMed(lower) || MED_CATALOG[0];
  const profile = getMedicationClinicalProfile(matched.name);

  const replyText = `### Dược Thư Lâm Sàng & Quy Chuẩn 5 Đúng: **${profile.tallManLASA || matched.name}**
*(Theo Quyết định 2147/QĐ-BYT & Hướng dẫn Dược lâm sàng Bộ Y Tế)*

1. **Đúng Người Bệnh**: ${profile.targetPopulation}
   • *Chống chỉ định*: ${profile.contraindications.slice(0, 2).join('; ')}
2. **Đúng Thuốc**: ${profile.tallManLASA || matched.name}. ${profile.highAlertRiskNote || ''}
3. **Đúng Liều**: ${profile.standardDosing}
   • *Liều tối đa 24h*: **${profile.maxDailyDose}**
4. **Đúng Đường Dùng**: ${profile.administrationRouteDetails}
   ${profile.routeWarning ? `• *Cảnh báo nguy kịch*: **${profile.routeWarning}**` : ''}
5. **Đúng Thời Gian**: ${profile.timingAndFrequency} (${profile.mealRelation})
${profile.antidote ? `\n🛡️ **Thuốc giải độc đặc hiệu (Antidote)**: ${profile.antidote}` : ''}
${profile.blackBoxWarning ? `\n⚠️ **Cảnh báo an toàn**: ${profile.blackBoxWarning}` : ''}

Bạn có thể nhấn nút bên dưới để mở toàn bộ Cẩm nang Dược thư và bảng checklist đối soát điều dưỡng.`;

  const card: AgentActionCard = {
    cardType: 'medication_safety',
    title: `Quy Chuẩn 5 Đúng: ${matched.name}`,
    summary: 'Chi tiết đối tượng phù hợp, chống chỉ định, liều dùng, đường dùng & antidote',
    data: {
      medName: matched.name,
      tallMan: profile.tallManLASA,
      antidote: profile.antidote,
      standardDosing: profile.standardDosing,
    },
    primaryActionLabel: 'Mở Cẩm Nang 5 Đúng Chi Tiết',
    primaryActionType: 'OPEN_MEDICATION_SAFETY',
    status: 'pending',
  };

  const replyMessage: ChatMessage = {
    id: `msg-agent-${Date.now()}`,
    sender: 'agent',
    text: replyText,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'Quyết định 2147/QĐ-BYT',
      title: 'Hướng dẫn Thực hành Dược lâm sàng Bệnh viện',
      clause: 'Quy tắc 5 Đúng & Quản lý Thuốc Nguy cơ Cao',
    },
    card,
  };

  return { replyMessage };
}
