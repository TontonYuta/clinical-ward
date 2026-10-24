/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dữ Liệu Văn Bản Quy Phạm Pháp Luật Y Tế Việt Nam Hiện Hành (Cập nhật 2025 - 2026)
 */

import React from 'react';
import {
  Pill,
  ShieldCheck,
  AlertCircle,
  Wrench,
  Building2,
  FileText
} from 'lucide-react';
import { LegalDocMeta } from '../../../types/legal';

export const UPDATED_LEGAL_DOCS: LegalDocMeta[] = [
  {
    id: 'tt26_2025',
    code: 'Thông tư 26/2025/TT-BYT',
    shortCode: 'TT 26 (Kê đơn điện tử)',
    category: 'Chỉ Định & Kê Đơn CPOE',
    title: 'Quy định về đơn thuốc, kê đơn thuốc và đơn thuốc điện tử',
    authority: 'Bộ Y Tế (Hiệu lực: 01/07/2025)',
    replacesOrAmends: 'Thay thế hoàn toàn Thông tư 52/2017, TT 18/2018 và TT 04/2022',
    link: 'https://kcb.vn',
    icon: FileText,
    keyArticles: [
      {
        article: 'Điều 4 & 5 - Lộ trình Đơn thuốc điện tử',
        summary: 'Bắt buộc bệnh viện áp dụng trước 01/10/2025, cơ sở khác trước 01/01/2026. Đơn điện tử có giá trị pháp lý như đơn giấy.',
        systemFeature: 'Ký số điện tử và đồng bộ mã đơn thuốc quốc gia'
      },
      {
        article: 'Điều 7 - Nguyên tắc một đơn duy nhất',
        summary: 'Khám nhiều chuyên khoa trong 1 lần chỉ được cấp 01 đơn thuốc tích hợp, chống kê trùng hoạt chất và tương tác thuốc.',
        systemFeature: 'CDSS tự động chặn trùng lặp và tương tác thuốc chéo'
      },
      {
        article: 'Điều 8 & Phụ lục VII - Kê đơn mạn tính 90 ngày',
        summary: 'Cho phép kê đơn tối đa 90 ngày cho 252 bệnh mạn tính ổn định. Bắt buộc có số CCCD/định danh người bệnh.',
        systemFeature: 'Xác thực CCCD và tự động áp trần 90 ngày cho bệnh mạn tính'
      }
    ]
  },
  {
    id: 'tt18_2026',
    code: 'Thông tư 18/2026/TT-BYT',
    shortCode: 'TT 18 (Gây nghiện & Morphin)',
    category: 'Kiểm Soát Đặc Biệt',
    title: 'Quản lý thuốc gây nghiện, hướng thần, tiền chất & tiêu hủy vỏ ống',
    authority: 'Bộ Y Tế (Hiệu lực: 16/07/2026)',
    replacesOrAmends: 'Thay thế hoàn toàn Thông tư 20/2017 và TT 27/2024/TT-BYT',
    link: 'https://congbao.chinhphu.vn',
    icon: ShieldCheck,
    keyArticles: [
      {
        article: 'Điều 12 - Quản lý xuất phát thuốc gây nghiện',
        summary: 'Thuốc Morphin, Fentanyl phải quản lý đến từng ống, phiếu xuất ghi rõ tên bệnh nhân, buồng giường và chỉ định.',
        systemFeature: 'Sổ theo dõi nợ vỏ và xuất phát thuốc kiểm soát đặc biệt'
      },
      {
        article: 'Điều 14 - Bắt buộc thu hồi vỏ ống rỗng',
        summary: 'Điều dưỡng sau khi tiêm phải thu hồi vỏ ống rỗng giao nộp cho khoa Dược, không được vứt bỏ tùy tiện.',
        systemFeature: 'Xác thực hoàn trả vỏ ống trước khi bàn giao ca trực'
      },
      {
        article: 'Điều 16 - Tiêu hủy vỏ ống gây nghiện',
        summary: 'Tiêu hủy vỏ thuốc gây nghiện định kỳ có Hội đồng giám sát gồm Lãnh đạo, Trưởng khoa Dược, Điều dưỡng trưởng, Kế toán.',
        systemFeature: 'Biên bản tiêu hủy điện tử yêu cầu xác thực 2 bên'
      }
    ]
  },
  {
    id: 'vbhn07_2018',
    code: 'Văn bản hợp nhất 07/VBHN-BYT',
    shortCode: 'VBHN 07 (Tủ trực & Nội trú)',
    category: 'Dược Lâm Sàng Nội Trú',
    title: 'Quy định sử dụng thuốc trong cơ sở y tế có giường bệnh & Tủ trực',
    authority: 'Bộ Y Tế (Tích hợp TT 23/2011 & TT 50/2017)',
    link: 'https://vbpl.vn',
    icon: Pill,
    keyArticles: [
      {
        article: 'Điều 9 - Cơ số tủ trực buồng bệnh',
        summary: 'Giám đốc bệnh viện phê duyệt cơ số tủ trực cấp cứu. Thuốc dùng xong phải hoàn bù vào ngày làm việc tiếp theo.',
        systemFeature: 'Bảng theo dõi hạn mức Min - Max cơ số tủ trực cấp cứu'
      },
      {
        article: 'Điều 11 - Nguyên tắc cấp phát FEFO',
        summary: 'Cấp phát thuốc nội trú phải theo nguyên tắc hạn ngắn dùng trước, tránh tồn đọng thuốc hết hạn ở đáy tủ.',
        systemFeature: 'Tự động sắp xếp kho theo FEFO và cảnh báo cận hạn 60 ngày'
      }
    ]
  },
  {
    id: 'nd98_2021',
    code: 'Nghị định 98/2021 & NĐ 04/2025/NĐ-CP',
    shortCode: 'NĐ 98 & 04 (Thiết bị y tế)',
    category: 'Trang Thiết Bị & Kỹ Thuật',
    title: 'Quản lý thiết bị y tế loại A, B, C, D & kiểm định an toàn định kỳ',
    authority: 'Chính Phủ (Sửa đổi bởi NĐ 07/2023, NĐ 96/2023, NĐ 04/2025)',
    link: 'https://vanban.chinhphu.vn',
    icon: Wrench,
    keyArticles: [
      {
        article: 'Điều 4 - Phân loại rủi ro thiết bị',
        summary: 'Thiết bị y tế được phân thành Loại A (thấp), B (trung bình thấp), C (trung bình cao), D (cao: máy thở, sốc tim).',
        systemFeature: 'Phân loại rủi ro thiết bị và mã định danh tài sản'
      },
      {
        article: 'Điều 54 - Kiểm định an toàn bắt buộc',
        summary: 'Thiết bị loại C, D phải kiểm định định kỳ hàng năm. Quá hạn kiểm định bị khóa cấm sử dụng cho người bệnh.',
        systemFeature: 'Cảnh báo đỏ trước 30 ngày và khóa điều phối khi quá hạn kiểm định'
      }
    ]
  },
  {
    id: 'tt51_2017',
    code: 'Thông tư 51/2017/TT-BYT',
    shortCode: 'TT 51 (Cấp cứu phản vệ)',
    category: 'Cấp Cứu Tối Khẩn',
    title: 'Hướng dẫn phòng, chẩn đoán và xử trí phản vệ cấp cứu',
    authority: 'Bộ Y Tế (Hiện hành toàn diện)',
    link: 'https://congbao.chinhphu.vn',
    icon: AlertCircle,
    keyArticles: [
      {
        article: 'Điều 5 - Hộp thuốc cấp cứu phản vệ',
        summary: 'Tất cả buồng bệnh, xe tiêm bắt buộc có hộp thuốc phản vệ với cơ số tối thiểu Adrenalin 1mg/1ml (ít nhất 2 ống).',
        systemFeature: 'Kiểm soát cơ số hộp chống sốc phản vệ tại mọi buồng tiêm'
      },
      {
        article: 'Phụ lục IV - Phác đồ tiêm bắp Adrenalin',
        summary: 'Tiêm bắp Adrenalin ngay lập tức từ phản vệ độ II, không được trì hoãn.',
        systemFeature: 'CDSS tự động gợi ý liều Adrenalin theo cân nặng và phân độ'
      }
    ]
  },
  {
    id: 'nd151_2017',
    code: 'NĐ 151/2017 & NĐ 114/2024/NĐ-CP',
    shortCode: 'NĐ 151 (Tài sản công)',
    category: 'Quản Trị Tài Sản',
    title: 'Kiểm kê định kỳ 31/12 & thủ tục thanh lý tài sản nhà nước',
    authority: 'Chính Phủ',
    link: 'https://vanban.chinhphu.vn',
    icon: Building2,
    keyArticles: [
      {
        article: 'Điều 40 - Kiểm kê tài sản cố định',
        summary: 'Thực hiện kiểm kê đối soát thực tế định kỳ hàng năm, xử lý tài sản thất thoát hoặc bị điều chuyển sai khoa.',
        systemFeature: 'Quét mã QR đối soát vị trí thực tế vs sổ kế toán tài sản'
      }
    ]
  }
];
