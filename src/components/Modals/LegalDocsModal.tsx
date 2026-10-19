/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Scale,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  FileText,
  AlertCircle,
  ChevronRight,
  Shield,
  Pill,
  Wrench,
  Boxes,
  ThermometerSnowflake,
  Building2
} from 'lucide-react';

interface LegalDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type LegalDocId = 'nd98' | 'tt22' | 'tt20' | 'tt51' | 'tt36' | 'nd151';

interface LegalDocMeta {
  id: LegalDocId;
  code: string;
  shortCode: string;
  category: string;
  title: string;
  authority: string;
  link: string;
  icon: React.ComponentType<{ className?: string }>;
}

const LEGAL_DOCS: LegalDocMeta[] = [
  {
    id: 'tt22',
    code: 'Thông tư 22/2011/TT-BYT',
    shortCode: 'TT 22 (Tủ trực)',
    category: 'Dược Lâm Sàng',
    title: 'Quy chế tổ chức Khoa Dược & Cơ số tủ trực buồng bệnh',
    authority: 'Bộ Y Tế',
    link: 'https://congbao.chinhphu.vn/van-ban/thong-tu-so-22-2011-tt-byt-11565.htm',
    icon: Pill
  },
  {
    id: 'tt20',
    code: 'Thông tư 20/2017/TT-BYT',
    shortCode: 'TT 20 (Gây nghiện)',
    category: 'Kiểm Soát Đặc Biệt',
    title: 'Quản lý thuốc gây nghiện, hướng thần & thu hồi vỏ ống Morphin',
    authority: 'Bộ Y Tế',
    link: 'https://congbao.chinhphu.vn/van-ban/thong-tu-so-20-2017-tt-byt-24490.htm',
    icon: ShieldCheck
  },
  {
    id: 'tt51',
    code: 'Thông tư 51/2017/TT-BYT',
    shortCode: 'TT 51 (Phản vệ)',
    category: 'Cấp Cứu Tối Khẩn',
    title: 'Hướng dẫn phòng, chẩn đoán và xử trí phản vệ khẩn cấp',
    authority: 'Bộ Y Tế',
    link: 'https://congbao.chinhphu.vn/van-ban/thong-tu-so-51-2017-tt-byt-25418.htm',
    icon: AlertCircle
  },
  {
    id: 'nd98',
    code: 'Nghị định 98/2021 & NĐ 07/2023',
    shortCode: 'NĐ 98 (Thiết bị y tế)',
    category: 'Trang Thiết Bị',
    title: 'Quản lý trang thiết bị y tế loại D & kiểm định an toàn đo lường',
    authority: 'Chính Phủ',
    link: 'https://vanban.chinhphu.vn/?pageid=27160&docid=204442',
    icon: Wrench
  },
  {
    id: 'tt36',
    code: 'Thông tư 36/2018/TT-BYT',
    shortCode: 'TT 36 (FEFO & GSP)',
    category: 'Tiêu Chuẩn GSP',
    title: 'Thực hành tốt bảo quản thuốc (GSP), nguyên tắc FEFO & kho lạnh',
    authority: 'Bộ Y Tế',
    link: 'https://congbao.chinhphu.vn/van-ban/thong-tu-so-36-2018-tt-byt-28018.htm',
    icon: Boxes
  },
  {
    id: 'nd151',
    code: 'NĐ 151/2017 & NĐ 114/2024',
    shortCode: 'NĐ 151 (Tài sản công)',
    category: 'Quản Trị Tài Sản',
    title: 'Kiểm kê định kỳ 31/12 & thủ tục thanh lý tài sản nhà nước',
    authority: 'Chính Phủ',
    link: 'https://vanban.chinhphu.vn/?pageid=27160&docid=192534',
    icon: Building2
  }
];

export const LegalDocsModal: React.FC<LegalDocsModalProps> = ({ isOpen, onClose }) => {
  const [selectedLaw, setSelectedLaw] = useState<LegalDocId>('tt22');

  if (!isOpen) return null;

  const currentDoc = LEGAL_DOCS.find((d) => d.id === selectedLaw) || LEGAL_DOCS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white sm:rounded-2xl rounded-none shadow-2xl border sm:border-slate-200 border-none w-full h-full sm:h-[88vh] sm:max-h-[88vh] sm:max-w-4xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 sm:h-16 px-4 sm:px-6 bg-gradient-to-r from-teal-900 via-teal-950 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4 sm:w-5 sm:h-5 text-teal-200" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold tracking-tight truncate">
                <span className="hidden sm:inline">Căn Cứ Pháp Lý &amp; Quy Chế Vận Hành Bệnh Viện</span>
                <span className="sm:hidden">Căn Cứ Pháp Lý Y Tế</span>
              </h2>
              <p className="text-xs text-teal-200 truncate">
                Văn bản quy phạm pháp luật Bộ Y Tế &amp; Chính Phủ hiện hành
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Horizontal Pill Bar */}
        <div className="flex md:hidden overflow-x-auto scrollbar-none px-3 py-2 bg-slate-100 border-b border-slate-200 gap-1.5 shrink-0">
          {LEGAL_DOCS.map((doc) => {
            const isActive = selectedLaw === doc.id;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedLaw(doc.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-teal-800 text-white shadow-2xs font-bold'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-200/80 font-medium'
                }`}
              >
                <Scale className={`w-3.5 h-3.5 ${isActive ? 'text-teal-200' : 'text-slate-500'}`} />
                <span>{doc.shortCode}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body: Desktop Sidebar + Main Detail Pane */}
        <div className="flex-1 flex flex-row overflow-hidden min-h-0">
          {/* Desktop Sidebar selector */}
          <div className="hidden md:flex w-72 lg:w-80 bg-slate-50/80 border-r border-slate-200 p-3 space-y-1.5 overflow-y-auto shrink-0">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">
              Danh mục văn bản chính
            </span>

            {LEGAL_DOCS.map((doc) => {
              const Icon = doc.icon;
              const isActive = selectedLaw === doc.id;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedLaw(doc.id)}
                  className={`w-full text-left p-3 rounded-xl transition border cursor-pointer ${
                    isActive
                      ? 'bg-white border-teal-600 shadow-xs text-teal-950 font-semibold'
                      : 'border-transparent text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {doc.code}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold border border-slate-200">
                      {doc.authority}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 line-clamp-1 block">
                    {doc.title}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Main detail view */}
          <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto space-y-4 sm:space-y-5 text-sm leading-relaxed">
            {/* Document Header Banner */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-teal-800 text-white shadow-2xs">
                    {currentDoc.authority}
                  </span>
                  <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    {currentDoc.category}
                  </span>
                </div>
                <a
                  href={currentDoc.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-teal-800 hover:text-teal-950 hover:underline font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs transition active:scale-98"
                >
                  <span>Cổng Văn Bản Quốc Gia</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                {currentDoc.code}: {currentDoc.title}
              </h3>
            </div>

            {/* TT 22/2011 Content */}
            {selectedLaw === 'tt22' && (
              <div className="space-y-3 sm:space-y-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-900 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                    <strong className="text-slate-900 text-sm">Định mức cơ số tủ trực cấp cứu buồng bệnh (Điều 9, 10):</strong>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 pl-8">
                    Mỗi khoa lâm sàng được cấp một lượng thuốc và vật tư tiêu hao thiết yếu dự trữ tại buồng trực theo danh mục đã được Giám đốc phê duyệt để phục vụ cấp cứu bệnh nhân ban đêm khi Kho Dược đóng cửa. Cơ số tủ trực phải được kiểm kê đối soát khi giao nhận ca trực.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-900 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                    <strong className="text-slate-900 text-sm">Quy định hoàn bù cơ số trong 24 giờ (Khóa sổ trước 07:00 sáng):</strong>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 pl-8">
                    Khi lấy thuốc/vật tư cấp cứu khẩn cấp ban đêm, điều dưỡng phải lập phiếu nợ. Đầu ca sáng hôm sau trước 07:00 AM, kíp trực phải mang đơn thuốc bù lên Kho Dược để lập phiếu lĩnh bù, hoàn trả đủ số lượng về tủ trực để đảm bảo tủ trực luôn đủ cơ số thường trực 24/7.
                  </p>
                </div>

                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Ứng dụng trên phần mềm:</strong> Nút "Lập Phiếu Mượn Khẩn" tự động tạo bản ghi nợ; Hệ thống cảnh báo tự động lúc 07:00 sáng để Điều dưỡng và Bác sĩ hoàn bù trước khi giao ban.
                  </span>
                </div>
              </div>
            )}

            {/* TT 20/2017 Content */}
            {selectedLaw === 'tt20' && (
              <div className="space-y-3 sm:space-y-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-900 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                    <strong className="text-slate-900 text-sm">Quản lý tủ sắt riêng &amp; Bàn giao chìa khóa (Điều 18):</strong>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 pl-8">
                    Thuốc gây nghiện (Morphin, Fentanyl) bắt buộc cất giữ trong tủ sắt hoặc két sắt chắc chắn có khóa riêng, chỉ người được phân công trực giữ chìa khóa và phải bàn giao bằng sổ ký nhận.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-900 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                    <strong className="text-slate-900 text-sm">Bắt buộc thu hồi 100% vỏ ống thủy tinh sau tiêm (Điều 19, 20):</strong>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 pl-8">
                    Sau khi tiêm cho người bệnh, điều dưỡng bắt buộc phải giữ lại toàn bộ vỏ ống thuốc rỗng nguyên vẹn nộp vào khay niêm phong. Cơ sở khám bệnh phải thành lập Hội đồng tiêu hủy vỏ ống thuốc gây nghiện gồm ít nhất 03 thành viên độc lập, lập biên bản Mẫu số 10 và lưu trữ tối thiểu 02 năm.
                  </p>
                </div>

                <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-950 text-xs sm:text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Cơ chế khóa nợ vỏ ống:</strong> Phần mềm tự động khóa trạng thái phiếu nợ nếu vỏ ống Morphin chưa được xác nhận thu hồi, ngăn ngừa thất thoát hoặc lạm dụng chất gây nghiện.
                  </span>
                </div>
              </div>
            )}

            {/* TT 51/2017 Content */}
            {selectedLaw === 'tt51' && (
              <div className="space-y-3 sm:space-y-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-900 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                    <strong className="text-slate-900 text-sm">Hộp thuốc cấp cứu phản vệ thường trực (Điều 6):</strong>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 pl-8">
                    Hộp thuốc chống sốc phản vệ phải có sẵn tại mọi buồng tiêm, buồng khám và xe tiêm. Bắt buộc có tối thiểu <strong>02 ống Adrenalin 1mg/1ml</strong>, kim tiêm, dây truyền dịch và phác đồ xử trí treo tại chỗ.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-900 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                    <strong className="text-slate-900 text-sm">Adrenalin là thuốc thiết yếu đầu tay (Phụ lục III):</strong>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 pl-8">
                    Ngay khi phát hiện bệnh nhân phản vệ từ Độ 2 trở lên (mày đay kèm khó thở hoặc tụt huyết áp), điều dưỡng hoặc bác sĩ <strong>tiêm bắp Adrenalin ngay lập tức</strong> vào mặt trước ngoài đùi, không được chần chừ chờ đo huyết áp hay xin y lệnh.
                  </p>
                </div>

                <div className="p-3.5 bg-teal-50 rounded-xl border border-teal-200 text-teal-950 text-xs sm:text-sm flex items-start gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5 text-teal-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Tích hợp AI CDSS:</strong> Khi nhập từ khóa "PUV", "sốc phản vệ" hoặc "adrenalin", trợ lý lâm sàng tự động đưa phác đồ xử trí khẩn cấp và thẻ xuất Adrenalin tối ưu thời gian vàng.
                  </span>
                </div>
              </div>
            )}

            {/* ND 98/2021 Content */}
            {selectedLaw === 'nd98' && (
              <div className="space-y-3 sm:space-y-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-900 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                    <strong className="text-slate-900 text-sm">Sổ lý lịch máy y tế &amp; Nhật ký sự cố (Điều 58):</strong>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 pl-8">
                    Bệnh viện bắt buộc phải lập và lưu trữ hồ sơ theo dõi cho từng thiết bị: năm đưa vào sử dụng, phân loại rủi ro (A, B, C, D), quá trình vận hành, nhật ký sự cố và linh kiện phụ kiện thay thế (dây thở, sensor oxy, điện cực).
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-900 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                    <strong className="text-slate-900 text-sm">Kiểm định an toàn kỹ thuật đo lường (Điều 54 - 56 &amp; TT 05/2022/TT-BYT):</strong>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 pl-8">
                    Các máy can thiệp sự sống (máy thở, máy sốc tim, monitor) bắt buộc phải được đơn vị đo lường độc lập kiểm định định kỳ và dán tem an toàn trước khi dùng cho bệnh nhân. Thiết bị hết hạn tem kiểm định phải ngừng vận hành ngay lập tức.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-900 flex items-center justify-center font-bold text-xs shrink-0">3</span>
                    <strong className="text-slate-900 text-sm">Thử tải an toàn điện lực IEC 60601-1 &amp; Biên bản bàn giao (Điều 34):</strong>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 pl-8">
                    Sau khi sửa chữa, Kỹ sư TBYT phải đo dòng rò tiếp đất, thử tải áp lực khí thở và ký biên bản bàn giao 02 bên với Bác sĩ buồng bệnh trước khi đưa máy trở lại phục vụ cấp cứu.
                  </p>
                </div>
              </div>
            )}

            {/* TT 36/2018 Content */}
            {selectedLaw === 'tt36' && (
              <div className="space-y-3 sm:space-y-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-900 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                    <strong className="text-slate-900 text-sm">Nguyên tắc xuất kho FEFO (Phụ lục I, Mục 12):</strong>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 pl-8">
                    Thuốc có hạn dùng ngắn hơn bắt buộc phải xếp ở vị trí ưu tiên để xuất dùng trước (First Expired, First Out) nhằm ngăn ngừa tình trạng thuốc cận hạn bị bỏ quên dưới đáy kệ.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-900 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                    <strong className="text-slate-900 text-sm">Dây chuyền lạnh 2°C - 8°C &amp; Quy chế Biệt trữ GSP (Điều 12):</strong>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 pl-8">
                    Vắc xin và sinh phẩm bắt buộc duy trì liên tục ở nhiệt độ 2.0°C - 8.0°C. Khi xảy ra sự cố quá nhiệt trên 8.0°C, toàn bộ lô vắc xin phải chuyển vào chế độ Biệt trữ (Quarantine) và chỉ được xuất tiêm sau khi có Lệnh phóng thích lô của Hội đồng Dược.
                  </p>
                </div>
              </div>
            )}

            {/* ND 151/2017 Content */}
            {selectedLaw === 'nd151' && (
              <div className="space-y-3 sm:space-y-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-900 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                    <strong className="text-slate-900 text-sm">Kiểm kê định kỳ 31/12 hàng năm (Điều 40):</strong>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 pl-8">
                    Hàng năm vào ngày 31/12, bệnh viện thành lập Hội đồng kiểm kê toàn bộ máy móc thiết bị thực tế, đánh giá tỷ lệ hao mòn tài sản công để đối chiếu với sổ cái kế toán.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-900 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                    <strong className="text-slate-900 text-sm">Thanh lý tài sản nhà nước hư hỏng (Điều 44 - 46):</strong>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 pl-8">
                    Đối với máy móc hư hỏng ngưng sử dụng lâu năm hoặc chi phí sửa chữa vượt quá giá trị còn lại, Giám đốc bệnh viện ký Tờ trình đề xuất thanh lý tài sản nhà nước lên cơ quan chủ quản.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="py-3 px-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 text-center sm:text-left">
            <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
            <span>Quy trình vận hành tuân thủ 100% khung pháp lý y tế Việt Nam</span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto h-9 sm:h-9.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition cursor-pointer shadow-2xs active:scale-98 flex items-center justify-center"
          >
            Đóng Cửa Sổ
          </button>
        </div>
      </div>
    </div>
  );
};
