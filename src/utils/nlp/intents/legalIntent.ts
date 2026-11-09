/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentActionCard, ChatMessage } from '../../../types/clinical';
import { anyKeyword, ProcessedQueryResult } from '../types';

export function matchLegalIntent(lower: string): boolean {
  const isLegalInquiry = anyKeyword(lower, [
    'thông tư', 'nghị định', 'văn bản pháp lý', 'luật dược', 'điều khoản luật',
    'quy định theo thông tư', 'chu kỳ kiểm định', 'nghi ngờ rò điện', 'tiêu hủy vỏ ống'
  ]) || ((lower.includes('vỡ') || lower.includes('làm mất')) && (lower.includes('vỏ') || lower.includes('ống')));

  const hasExplicitActionCommand = anyKeyword(lower, [
    'báo hỏng ngay', 'lập phiếu báo hỏng', 'xuất khẩn', 'tiêm khẩn', 'tiêm ngay', 'rút khẩn', 'mượn khẩn', 'lập phiếu dự trù'
  ]);

  return isLegalInquiry && !hasExplicitActionCommand;
}

export function handleLegalIntent(lower: string, nowStr: string): ProcessedQueryResult {
  let topic = 'Tổng quan Khung Pháp lý Y tế Bệnh viện';
  let explanation = 'Hệ thống vận hành đồng bộ theo 6 trụ cột pháp lý: TT 22/2011 (Tủ trực), TT 20/2017 (Gây nghiện & Vỏ ống), TT 51/2017 (Cấp cứu phản vệ), TT 36/2018 (FEFO & GSP), NĐ 98/2021 (Thiết bị y tế loại D), và NĐ 151/2017 (Tài sản công).';
  let legalDoc = 'Văn bản quy phạm pháp luật Y tế Việt Nam';

  if (lower.includes('phản vệ') || lower.includes('51') || lower.includes('adrenalin') || lower.includes('sốc phản vệ')) {
    topic = 'Thông tư 51/2017/TT-BYT - Phác đồ Cấp cứu Sốc Phản Vệ';
    explanation = 'Thông tư 51 quy định **Adrenalin 1mg/1ml** là thuốc thiết yếu cấp cứu sốc phản vệ hàng đầu, phải có sẵn tại tất cả các buồng tiêm và tủ trực cấp cứu. Tiêm bắp ngay lập tức khi xuất hiện triệu chứng phản vệ từ độ II trở lên (khó thở, tụt huyết áp, nổi mề đay toàn thân, phù Quincke). Liều người lớn: 1/2 - 1 ống (0.5 - 1mg); trẻ em: 1/5 - 1/2 ống tùy cân nặng. Tiêm bắp mặt trước ngoài đùi, nhắc lại sau mỗi 3 - 5 phút nếu huyết áp chưa cải thiện. Tuyệt đối không chờ hội chẩn làm lỡ thời gian vàng cứu sống người bệnh.';
    legalDoc = 'Thông tư 51/2017/TT-BYT';
  } else if (lower.includes('vỡ') || lower.includes('làm mất') || lower.includes('hỏng vỏ')) {
    topic = 'Quy trình xử lý vỡ/mất vỏ ống thuốc gây nghiện (TT 20/2017)';
    explanation = 'Theo Điều 15 Thông tư 20/2017/TT-BYT, trường hợp vỏ ống thuốc gây nghiện bị rơi vỡ ngoài ý muốn trong quá trình bẻ ống hoặc tiêm cho người bệnh, điều dưỡng không được tự ý xóa nợ. Bắt buộc: (1) Thu gom toàn bộ các mảnh vỡ thủy tinh còn lại; (2) Lập **Biên bản giải trình vỡ ống thuốc gây nghiện** có chữ ký xác nhận của Bác sĩ trực buồng bệnh làm chứng; (3) Mang biên bản kèm mảnh vỡ sang Kho Dược nộp cho Dược sĩ để được mở khóa xác nhận và duyệt cấp bù cơ số tủ trực.';
    legalDoc = 'Điều 15 Thông tư 20/2017/TT-BYT';
  } else if (lower.includes('20') || lower.includes('vỏ ống') || lower.includes('gây nghiện') || (lower.includes('morphin') && lower.includes('quy định'))) {
    topic = 'Thông tư 20/2017/TT-BYT - Quản lý thuốc kiểm soát đặc biệt';
    explanation = 'Quy định thuốc gây nghiện (Morphin, Fentanyl) bắt buộc phải bảo quản trong tủ sắt có 2 lớp khóa. **Điều 15** quy định phải thu hồi 100% vỏ ống đã tiêm vào khay kiểm soát trước khi cấp bù ống mới. **Điều 16** quy định Hội đồng 3 bên (Dược sĩ, Điều dưỡng, Bác sĩ/Lãnh đạo) tổ chức nghiền nát tiêu hủy vỏ ống định kỳ.';
    legalDoc = 'Thông tư 20/2017/TT-BYT';
  } else if (lower.includes('98') || lower.includes('thiết bị') || lower.includes('loại d') || lower.includes('kiểm định') || lower.includes('máy thở')) {
    topic = 'Nghị định 98/2021/NĐ-CP & TT 05/2022/TT-BYT - Quản lý TBYT';
    explanation = 'Phân loại trang thiết bị y tế theo mức độ rủi ro: Loại A (bông gạc), Loại B (máy điện tim), Loại C (bơm tiêm điện, monitor), Loại D (máy thở, máy sốc tim can thiệp trực tiếp tính mạng). Thiết bị loại D bắt buộc kiểm định an toàn điện lực (dòng rò < 100µA) và dán tem chu kỳ hằng năm bởi các tổ chức được Bộ Y tế cấp phép (Quatest 1, NIEMET).';
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
    legalReference: { lawCode: legalDoc, title: topic, clause: 'Quy chuẩn bắt buộc' },
    card,
    suggestedChips: ['Quy định vỏ ống Morphin TT 20', 'Phác đồ Adrenalin phản vệ TT 51', 'Đối soát ca trực 07:00 AM']
  };

  return { replyMessage };
}
