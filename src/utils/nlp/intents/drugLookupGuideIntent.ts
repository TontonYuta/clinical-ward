/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Xử lý Ý định: Hướng dẫn Tra Cứu Dược Quốc Gia & Dược Thư Lâm Sàng (<=100 LOC)
 */

import { AgentActionCard, ChatMessage } from '../../../types/clinical';
import { anyKeyword, ProcessedQueryResult } from '../types';
import { findMatchedMed } from '../entityCatalog';

export function matchDrugLookupGuideIntent(lower: string): boolean {
  const isGenericAsk = anyKeyword(lower, [
    'tôi muốn tra cứu thông tin về thuốc', 'tôi muốn tra cứu thông tin thuốc',
    'tôi muốn tra cứu về thuốc', 'tôi muốn tra cứu thuốc', 'tôi muốn tìm thông tin về thuốc',
    'tôi muốn tìm thuốc', 'tôi muốn hỏi về thuốc', 'tôi muốn hỏi thông tin về thuốc',
    'hỏi thông tin về thuốc', 'tra cứu thông tin về thuốc', 'tra cứu thông tin thuốc',
    'tra cứu về thuốc', 'tra cứu thuốc', 'hướng dẫn tra cứu thuốc', 'hướng dẫn tra cứu',
    'xem danh mục thuốc', 'danh mục thuốc', 'danh sách thuốc', 'có những loại thuốc nào',
    'có những thuốc gì', 'tìm kiếm thuốc', 'cổng tra cứu thuốc', '54885 thuốc', '55000 thuốc',
    'hỏi về thuốc'
  ]);

  const hasSpecificMed = Boolean(findMatchedMed(lower));
  const hasSdk = /(?:vn|vd|gc|qlsp|vs)-[0-9]+-[0-9]+/i.test(lower);
  const hasOtherKeywords = anyKeyword(lower, ['rocephin', 'cefaclor', 'augmentin', 'panadol', 'paracetamol', 'fentanyl', 'morphin']);

  return isGenericAsk && !hasSpecificMed && !hasSdk && !hasOtherKeywords;
}

export function handleDrugLookupGuideIntent(nowStr: string): ProcessedQueryResult {
  const text = `### 🏥 CỔNG TRA CỨU DƯỢC QUỐC GIA & DƯỢC THƯ LÂM SÀNG (54.885 THUỐC)

Hệ thống tích hợp toàn diện cơ sở dữ liệu **Cục Quản lý Dược Việt Nam (DAV)** kết hợp **Dược thư Quốc gia DĐVN V** và **Tồn kho thực tế Bệnh viện**:

1. **Tra cứu theo Tên Biệt Dược hoặc Hoạt Chất (INN):**
   • *Ví dụ:* \`"Thông tin thuốc Rocephin"\`, \`"Augmentin 1g"\`, \`"Paracetamol"\`, \`"Adrenalin"\`...
2. **Tra cứu theo Số Đăng Ký Lưu Hành (SĐK) Cục QLD:**
   • *Ví dụ:* \`"SĐK VD-24757-16 là thuốc gì"\`, \`"Tra cứu SĐK VN-17037-13"\`...
3. **Tra cứu Chỉ Định, Tác Dụng & Liều Dùng Chuẩn DĐVN V:**
   • *Ví dụ:* \`"Paracetamol liều dùng thế nào"\`, \`"Morphin dùng để làm gì"\`, \`"Tác dụng của Diazepam"\`...
4. **Đối Soát Tồn Kho & Hạn Dùng FEFO Bệnh Viện:**
   • Tự động đối soát cơ số tủ trực cấp cứu, số lô và ngày hết hạn.

👉 *Vui lòng chọn gợi ý nhanh bên dưới hoặc nhập trực tiếp tên thuốc / số đăng ký cần tra cứu!*`;

  const card: AgentActionCard = {
    cardType: 'shift_handover_report',
    title: 'Cổng Tra Cứu Dược Quốc Gia 54.885 Thuốc',
    summary: 'Cơ sở dữ liệu Cục Quản lý Dược & Dược Thư Quốc Gia Việt Nam',
    data: { totalDrugs: 54885, status: 'ready' },
    primaryActionLabel: 'Mở Cổng 55k Dược Quốc Gia',
    primaryActionType: 'OPEN_REGISTRY_MODAL',
    targetTab: 'registry',
    status: 'pending'
  };

  const replyMessage: ChatMessage = {
    id: `msg-agent-drug-guide-${Date.now()}`,
    sender: 'agent',
    text,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'Cục Quản lý Dược Việt Nam (DAV)',
      title: 'Cơ sở dữ liệu Quốc gia 54.885 Thuốc lưu hành & DĐVN V',
      clause: 'Cổng tra cứu thông tin dược phẩm'
    },
    card,
    suggestedChips: [
      'Tra cứu thuốc Rocephin',
      'Tra cứu SĐK VD-24757-16',
      'Thông tin thuốc Augmentin',
      'Paracetamol liều dùng thế nào',
      'Quy tắc 5 đúng Morphin'
    ]
  };

  return { replyMessage };
}
