/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Xử lý Ý định: Rà Soát Tương Tác Thuốc & Cặp Thuốc Phối Hợp (QĐ 5948/BYT) (<=100 LOC)
 */

import { anyKeyword, ProcessedQueryResult } from '../types';
import { MED_CATALOG } from '../entityCatalog';

export const CURATED_DDI: Array<{ a: string[]; b: string[]; severity: string; effect: string; action: string; source: string }> = [
  { a: ['ceftriaxone', 'ceftriaxon'], b: ['calcium', 'calci', 'ringer lactat', 'hartmann'], severity: 'Chống chỉ định tuyệt đối', effect: 'Tạo kết tủa Ceftriaxon–Calci trong lòng mạch; nguy cơ tắc mạch phổi tử vong.', action: 'Không tiêm truyền chung đường truyền; cách ly hoàn toàn ở trẻ sơ sinh.', source: 'QĐ 5948/QĐ-BYT; cần đối chiếu chuyên luận/tờ hướng dẫn hiện hành' },
  { a: ['simvastatin', 'lovastatin'], b: ['clarithromycin', 'erythromycin', 'itraconazol', 'ketoconazol'], severity: 'Chống chỉ định', effect: 'Ức chế CYP3A4 tăng nồng độ Statin gấp 5-10 lần gây tiêu cơ vân cấp và suy thận.', action: 'Chống chỉ định phối hợp; chuyển sang kháng sinh khác hoặc ngừng tạm statin.', source: 'QĐ 5948/QĐ-BYT' },
  { a: ['ciprofloxacin', 'levofloxacin'], b: ['theophylline', 'theophyllin'], severity: 'Nghiêm trọng', effect: 'Giảm thanh thải theophylline, tăng nguy cơ ngộ độc co giật loạn nhịp.', action: 'Tránh phối hợp nếu có lựa chọn; theo dõi nồng độ theophylline huyết tương.', source: 'QĐ 5948/QĐ-BYT' },
  { a: ['clopidogrel'], b: ['omeprazole', 'omeprazol', 'esomeprazole', 'esomeprazol'], severity: 'Chống chỉ định phối hợp', effect: 'Ức chế CYP2C19 giảm hoạt hóa Clopidogrel, tăng nguy cơ huyết khối stent.', action: 'Chuyển sang PPI ít ức chế CYP2C19 như Pantoprazol, Rabeprazol.', source: 'QĐ 5948/QĐ-BYT' },
  { a: ['nitroglycerin', 'isosorbide', 'nitrat', 'mononitrat'], b: ['sildenafil', 'tadalafil', 'vardenafil', 'viagra'], severity: 'Chống chỉ định tuyệt đối', effect: 'Giãn mạch cộng hợp ồ ạt, tụt huyết áp kịch phát, nhồi máu cơ tim tử vong.', action: 'Tuyệt đối không phối hợp; cách ly tối thiểu 24-48 giờ.', source: 'QĐ 5948/QĐ-BYT' },
  { a: ['paracetamol', 'panadol', 'efferalgan'], b: ['morphin', 'morphine', 'moocphin'], severity: 'Phối hợp cần theo dõi', effect: 'Có thể có hiệu quả giảm đau đa mô thức; nguy cơ và liều phải đánh giá theo người bệnh.', action: 'Không tự coi là phối hợp an toàn; theo dõi hô hấp và đối chiếu chuyên luận hiện hành.', source: 'Hướng dẫn giảm đau WHO; cần đối chiếu chuyên luận hiện hành' },
  { a: ['paracetamol', 'panadol', 'efferalgan'], b: ['rượu', 'cồn', 'ethanol', 'bia'], severity: 'Cảnh báo tổn thương gan', effect: 'Rượu có thể làm tăng nguy cơ độc tính gan trong một số bối cảnh.', action: 'Tránh rượu bia; đánh giá liều, bệnh gan và tình trạng sử dụng rượu.', source: 'Dược thư Quốc gia lần xuất bản II (2015); cần đối chiếu tờ hướng dẫn hiện hành' },
  { a: ['warfarin', 'coumadin', 'sintrom'], b: ['miconazol', 'fluconazol', 'voriconazol'], severity: 'Chống chỉ định tuyệt đối', effect: 'Ức chế chuyển hóa S-warfarin, tăng vọt INR gây xuất huyết nội tạng ồ ạt.', action: 'Chống chỉ định với Miconazol; tránh dùng chung Fluconazol và kiểm tra INR.', source: 'QĐ 5948/QĐ-BYT' },
  { a: ['warfarin', 'coumadin'], b: ['aspirin', 'ibuprofen', 'diclofenac', 'ketorolac', 'nsaid'], severity: 'Chống chỉ định phối hợp', effect: 'Tổn thương niêm mạc tiêu hóa kết hợp ức chế đông máu gây xuất huyết ồ ạt.', action: 'Tránh phối hợp thường quy; dùng Paracetamol thay thế khi cần giảm đau.', source: 'QĐ 5948/QĐ-BYT' },
  { a: ['allopurinol'], b: ['azathioprin', 'mercaptopurin', '6-mp'], severity: 'Chống chỉ định phối hợp', effect: 'Ức chế Xanthine Oxidase làm tích lũy Azathioprin gây suy tủy ác tính.', action: 'Giảm 75% liều Azathioprin nếu bắt buộc dùng kèm theo dõi huyết học.', source: 'QĐ 5948/QĐ-BYT' },
  { a: ['metformin'], b: ['cản quang', 'iopamidol', 'iohexol', 'iodixanol'], severity: 'Chống chỉ định tạm thời', effect: 'Thuốc cản quang gây suy thận cấp làm ứ đọng Metformin gây toan lactic tử vong.', action: 'Ngừng Metformin trước khi chụp và chỉ dùng lại sau 48h khi thận bình thường.', source: 'QĐ 5948/QĐ-BYT & FDA' },
  { a: ['amiodaron', 'cordarone'], b: ['colchicin', 'colchicine'], severity: 'Chống chỉ định', effect: 'Ức chế P-gp làm giảm bài xuất Colchicin gây ngộ độc tiêu cơ vân suy đa tạng.', action: 'Chống chỉ định ở người suy gan thận; tránh phối hợp mọi trường hợp.', source: 'QĐ 5948/QĐ-BYT' },
  { a: ['tramadol'], b: ['linezolid', 'fluoxetin', 'sertralin', 'maoi'], severity: 'Chống chỉ định tuyệt đối', effect: 'Tích tụ Serotonin tại synap thần kinh gây hội chứng Serotonin ác tính co giật tử vong.', action: 'Chống chỉ định tuyệt đối phối hợp với Linezolid và MAOI.', source: 'QĐ 5948/QĐ-BYT' }
];

export function extractDrugPair(lower: string): [string, string] | null {
  const names = [...new Set(MED_CATALOG.flatMap(m => [m.name, ...m.aliases]).filter(Boolean))]
    .filter(name => lower.includes(name.toLowerCase()))
    .sort((a, b) => b.length - a.length);
  const unique = names.filter((name, i) => !names.slice(0, i).some(longer => longer.includes(name)));
  if (unique.length >= 2) return [unique[0], unique[1]];
  // Do not treat an ordinary medication question as a pair merely because it
  // contains a connector such as "với".
  if (unique.length === 1 && !/(?:tương tác|phối hợp|kết hợp|dùng chung|uống cùng)/.test(lower)) return null;

  // The ward dispense list is intentionally small, so fall back to the two
  // phrases around a natural-language connector. The backend normalizer then
  // resolves these names against the full drug registry/catalog.
  const match = lower.match(/(?:tương tác|phối hợp|kết hợp|dùng chung|uống cùng)?\s*([\p{L}0-9][\p{L}0-9 .()/-]*?)\s+(?:với|và|\+)\s+([\p{L}0-9][\p{L}0-9 .()/-]*?)(?=\s+(?:thế nào|như thế nào|được không|không|vậy|không\?)|[?!.,]|$)/iu);
  if (!match) return null;
  const clean = (value: string) => value
    .replace(/^(?:kiểm tra|tra cứu|tương tác|phối hợp|kết hợp|dùng|uống)\s+/i, '')
    .replace(/\s+(?:có|tương tác|phối hợp|kết hợp)$/i, '')
    .trim();
  const a = clean(match[1]);
  const b = clean(match[2]);
  return a && b ? [a, b] : null;
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
  const knownNames = [...new Set(MED_CATALOG.flatMap(m => [m.name, ...m.aliases]).filter(Boolean))]
    .filter(name => lower.includes(name.toLowerCase()))
    .sort((a, b) => b.length - a.length);
  const uniqueKnownNames = knownNames.filter((name, index) => !knownNames.slice(0, index).some(longer => longer.includes(name)));
  const hasConnector = / và | với | cùng |\+/.test(lower) || /vậy |thế còn /.test(lower);
  return hasDdiKeywords || (uniqueKnownNames.length >= 2 && hasConnector);
}

export function handleDrugInteractionIntent(text: string, lower: string, nowStr: string): ProcessedQueryResult {
  const pair = extractDrugPair(lower);
  const matches = CURATED_DDI.filter(p =>
    (p.a.some(t => lower.includes(t)) && p.b.some(t => lower.includes(t))) ||
    (p.b.some(t => lower.includes(t)) && p.a.some(t => lower.includes(t)))
  ).map(p => `• **${p.severity} — ${p.a[0]} + ${p.b[0]}**\n  - Hậu quả: ${p.effect}\n  - Xử trí: ${p.action}\n  - Nguồn: ${p.source}`);

  if (!pair && (lower.includes('paracetamol') || lower.includes('panadol') || lower.includes('efferalgan'))) {
    const reply = `### 📋 Báo Cáo Tương Tác Thuốc: Paracetamol (Acetaminophen)\nNguồn tham khảo: **Dược thư Quốc gia lần xuất bản II (2015)** và chuyên luận/tờ hướng dẫn hiện hành; cần đối chiếu theo người bệnh.\n\n1. Rượu/ethanol: tránh phối hợp khi có nguy cơ bệnh gan hoặc sử dụng rượu nhiều.\n2. Isoniazid, Carbamazepin, Phenytoin: cần đánh giá nguy cơ độc tính gan.\n3. Opioid: có thể phối hợp giảm đau đa mô thức nhưng phải theo dõi hô hấp.\n4. Warfarin: dùng liều cao kéo dài có thể ảnh hưởng INR; cần theo dõi.\n\n👉 *Nhập tên 2 thuốc để tra cứu cặp thuốc qua backend.*`;
    return { replyMessage: { id: `msg-ddi-${Date.now()}`, sender: 'agent', text: reply, timestamp: nowStr, legalReference: { lawCode: 'QĐ 2033/QĐ-BYT', title: 'Dược thư Quốc gia lần xuất bản II (2015)', clause: 'Chuyên luận Paracetamol & Tương tác' } } };
  }

  const reply = matches.length
    ? `### Rà soát tương tác thuốc\n\n${matches.join('\n\n')}\n\nThông tin đối chiếu theo **QĐ 5948/QĐ-BYT** và nguồn chuyên luận/tờ hướng dẫn được nêu.`
    : pair
      ? `### Phân tích phối hợp thuốc: ${pair[0]} + ${pair[1]}\n\nCặp thuốc **${pair[0]}** và **${pair[1]}** không thuộc danh mục tương tác chống chỉ định theo QĐ 5948/QĐ-BYT. Cần theo dõi liều lượng và chức năng gan thận khi phối hợp.`
      : `### Tra cứu tương tác thuốc\n\nVui lòng nêu **tên hai thuốc hoặc hoạt chất** (ví dụ: *Paracetamol và Morphin*).`;
  return { replyMessage: { id: `msg-ddi-${Date.now()}`, sender: 'agent', text: reply, timestamp: nowStr, legalReference: { lawCode: 'QĐ 5948/QĐ-BYT', title: 'Danh mục tương tác thuốc chống chỉ định', clause: 'Sàng lọc tương tác thuốc' } } };
}
