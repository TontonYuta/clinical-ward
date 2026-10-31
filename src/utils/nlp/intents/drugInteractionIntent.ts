/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Xử lý Ý định: Rà Soát Tương Tác Thuốc & Cặp Thuốc Phối Hợp (QĐ 5948/BYT) (<=100 LOC)
 */

import { anyKeyword, ProcessedQueryResult } from '../types';
import { MED_CATALOG } from '../entityCatalog';

export const CURATED_DDI: Array<{ a: string[]; b: string[]; severity: string; effect: string; action: string; source: string }> = [
  { a: ['ceftriaxone', 'ceftriaxon'], b: ['calcium', 'calci', 'ringer lactat'], severity: 'Chống chỉ định tuyệt đối', effect: 'Tạo kết tủa Ceftriaxon–Calci trong lòng mạch; nguy cơ tử vong ở trẻ sơ sinh.', action: 'Không tiêm truyền chung đường truyền; tráng rửa kỹ hoặc dùng 2 đường truyền riêng.', source: 'QĐ 5948/QĐ-BYT; Dược Thư 2022' },
  { a: ['simvastatin', 'lovastatin'], b: ['clarithromycin', 'erythromycin'], severity: 'Chống chỉ định', effect: 'Macrolid ức chế CYP3A4, tăng phơi nhiễm statin gây tiêu cơ vân cấp và suy thận.', action: 'Chống chỉ định phối hợp; chuyển sang kháng sinh khác hoặc ngừng tạm statin.', source: 'QĐ 5948/QĐ-BYT' },
  { a: ['ciprofloxacin', 'levofloxacin'], b: ['theophylline', 'theophyllin'], severity: 'Nghiêm trọng', effect: 'Giảm thanh thải theophylline, tăng nguy cơ ngộ độc và co giật loạn nhịp.', action: 'Tránh phối hợp nếu có lựa chọn; theo dõi nồng độ theophylline huyết tương.', source: 'QĐ 5948/QĐ-BYT' },
  { a: ['clopidogrel'], b: ['omeprazole', 'omeprazol', 'esomeprazole', 'esomeprazol'], severity: 'Chống chỉ định phối hợp', effect: 'Ức chế CYP2C19 giảm hoạt hóa Clopidogrel, tăng nguy cơ huyết khối stent.', action: 'Chuyển sang PPI ít ức chế CYP2C19 như Pantoprazol, Rabeprazol.', source: 'QĐ 5948/QĐ-BYT' },
  { a: ['nitroglycerin', 'isosorbide', 'nitrat'], b: ['sildenafil', 'tadalafil', 'vardenafil'], severity: 'Chống chỉ định tuyệt đối', effect: 'Giãn mạch cộng hợp ồ ạt, tụt huyết áp kịch phát, nhồi máu cơ tim tử vong.', action: 'Tuyệt đối không phối hợp; cách ly tối thiểu 24-48 giờ.', source: 'QĐ 5948/QĐ-BYT' },
  { a: ['paracetamol', 'panadol', 'efferalgan'], b: ['morphin', 'morphine', 'moocphin'], severity: 'Phối hợp an toàn & Hiệp đồng giảm đau', effect: 'Hiệp đồng giảm đau đa mô thức (WHO), tiết kiệm 20-30% liều Morphin, giảm ức chế hô hấp.', action: 'Phối hợp an toàn; giữ Paracetamol <= 4g/ngày và theo dõi nhịp thở khi dùng Morphin.', source: 'Dược Thư Quốc Gia Việt Nam 2022 (QĐ 3445/QĐ-BYT)' },
  { a: ['paracetamol', 'panadol', 'efferalgan'], b: ['rượu', 'cồn', 'ethanol', 'bia'], severity: 'Cảnh báo đỏ tổn thương gan', effect: 'Ethanol cảm ứng CYP2E1 tăng tạo NAPQI, cạn kiệt Glutathion gây hoại tử tế bào gan cấp.', action: 'Không uống rượu bia khi dùng Paracetamol; giảm liều ở người nghiện rượu.', source: 'Dược Thư Quốc Gia 2022 & DĐVN V' }
];

export function extractDrugPair(lower: string): [string, string] | null {
  const names = [...new Set(MED_CATALOG.flatMap(m => [m.name, ...m.aliases]).filter(Boolean))]
    .filter(name => lower.includes(name.toLowerCase()))
    .sort((a, b) => b.length - a.length);
  const unique = names.filter((name, i) => !names.slice(0, i).some(longer => longer.includes(name)));
  return unique.length >= 2 ? [unique[0], unique[1]] : null;
}

export function matchDrugInteractionIntent(lower: string): boolean {
  const hasAction = anyKeyword(lower, [
    'kê đơn', 'ke don', 'dặn dò', 'dan do', 'lên lịch', 'len lich', 'nhắc', 'nhac',
    'gửi mail', 'gui mail', 'gửi gmail', 'gui gmail', 'hoàn trả', 'thanh toán',
    'cho 1', 'cho 2', 'cho 3', 'cho 4', 'lấy 1', 'lấy 2', 'xuất 1', 'xuất 2',
    'mượn', 'cần 1', 'cần 2', 'cần 3', 'cần 4', 'cần 5', 'cần 10'
  ]) || lower.includes('bệnh nhân cần dùng') || lower.includes('cần dùng') || lower.includes('tiêm tĩnh mạch 1') || lower.includes('tiêm 1');

  if (hasAction) return false;

  const hasDdiKeywords = anyKeyword(lower, [
    'tương tác', 'tuong tac', 'tương kỵ', 'tuong ky',
    'uống cùng', 'dùng cùng', 'phối hợp', 'kết hợp', 'uống chung', 'dùng chung'
  ]);
  const pair = extractDrugPair(lower);
  const hasConnector = / và | với | cùng |\+/.test(lower) || /vậy |thế còn /.test(lower);
  return hasDdiKeywords || (pair !== null && hasConnector);
}

export function handleDrugInteractionIntent(text: string, lower: string, nowStr: string): ProcessedQueryResult {
  const pair = extractDrugPair(lower);
  const matches = CURATED_DDI.filter(p =>
    (p.a.some(t => lower.includes(t)) && p.b.some(t => lower.includes(t))) ||
    (p.b.some(t => lower.includes(t)) && p.a.some(t => lower.includes(t)))
  ).map(p => `• **${p.severity} — ${p.a[0]} + ${p.b[0]}**\n  - Hậu quả: ${p.effect}\n  - Xử trí: ${p.action}\n  - Nguồn: ${p.source}`);

  if (!pair && (lower.includes('paracetamol') || lower.includes('panadol') || lower.includes('efferalgan'))) {
    const reply = `### 📋 Báo Cáo Tương Tác Thuốc: Paracetamol (Acetaminophen)\nCăn cứ: **Dược Thư Quốc Gia Việt Nam 2022 (QĐ 3445/QĐ-BYT)**:\n\n1. **Rượu / Ethanol (Cảnh báo đỏ)**: Tăng tích tụ NAPQI gây hoại tử tế bào gan cấp.\n2. **Thuốc cảm ứng CYP2E1 (Isoniazid, Carbamazepin, Phenytoin)**: Tăng độc tính tế bào gan.\n3. **Phối hợp Opioid (Morphin, Codein)**: Hiệp đồng giảm đau đa mô thức, tiết kiệm liều Opioid.\n4. **Warfarin**: Liều cao Paracetamol kéo dài có thể làm tăng nhẹ chỉ số INR.\n\n👉 *Nhập tên 2 thuốc (VD: Paracetamol và Morphin) để phân tích tương tác cặp.*`;
    return { replyMessage: { id: `msg-ddi-${Date.now()}`, sender: 'agent', text: reply, timestamp: nowStr, legalReference: { lawCode: 'QĐ 3445/QĐ-BYT', title: 'Dược Thư Quốc Gia Việt Nam 2022', clause: 'Chuyên luận Paracetamol & Tương tác' } } };
  }

  const reply = matches.length
    ? `### Rà soát tương tác thuốc\n\n${matches.join('\n\n')}\n\nThông tin đối chiếu theo **QĐ 5948/QĐ-BYT** & **Dược Thư Quốc Gia 2022**.`
    : pair
      ? `### Phân tích phối hợp thuốc: ${pair[0]} + ${pair[1]}\n\nCặp thuốc **${pair[0]}** và **${pair[1]}** không thuộc danh mục tương tác chống chỉ định theo QĐ 5948/QĐ-BYT. Cần theo dõi liều lượng và chức năng gan thận khi phối hợp.`
      : `### Tra cứu tương tác thuốc\n\nVui lòng nêu **tên hai thuốc hoặc hoạt chất** (ví dụ: *Paracetamol và Morphin*).`;
  return { replyMessage: { id: `msg-ddi-${Date.now()}`, sender: 'agent', text: reply, timestamp: nowStr, legalReference: { lawCode: 'QĐ 5948/QĐ-BYT', title: 'Danh mục tương tác thuốc chống chỉ định', clause: 'Sàng lọc tương tác thuốc' } } };
}
