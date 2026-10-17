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
  AlertCircle
} from 'lucide-react';

interface LegalDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LegalDocsModal: React.FC<LegalDocsModalProps> = ({ isOpen, onClose }) => {
  const [selectedLaw, setSelectedLaw] = useState<string>('nd98');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-teal-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600/40 border border-teal-400/30 flex items-center justify-center">
              <Scale className="w-4 h-4 text-teal-200" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Căn Cứ Pháp Lý &amp; Quy Chế Vận Hành Kho Y Tế</h2>
              <p className="text-[11px] text-teal-200">
                Toàn bộ quy trình vận hành lâm sàng được chuẩn hóa dựa trên các văn bản quy phạm pháp luật hiện hành
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Sidebar + Detail Pane */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Sidebar selector */}
          <div className="w-full md:w-72 bg-slate-50 border-r border-slate-200 p-3 space-y-1.5 overflow-y-auto shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">
              Danh mục văn bản chính
            </span>

            <button
              onClick={() => setSelectedLaw('nd98')}
              className={`w-full text-left p-2.5 rounded-lg text-xs transition border ${
                selectedLaw === 'nd98'
                  ? 'bg-white border-teal-600 shadow-xs font-semibold text-teal-900'
                  : 'border-transparent text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="font-bold block">NĐ 98/2021 &amp; NĐ 07/2023</span>
              <span className="text-[11px] text-slate-500 line-clamp-1">Quản lý trang thiết bị, phụ kiện &amp; kiểm định</span>
            </button>

            <button
              onClick={() => setSelectedLaw('tt22')}
              className={`w-full text-left p-2.5 rounded-lg text-xs transition border ${
                selectedLaw === 'tt22'
                  ? 'bg-white border-teal-600 shadow-xs font-semibold text-teal-900'
                  : 'border-transparent text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="font-bold block">Thông tư 22/2011 &amp; TT 23/2011</span>
              <span className="text-[11px] text-slate-500 line-clamp-1">Tủ trực cấp cứu &amp; Xóa nợ phiếu bù</span>
            </button>

            <button
              onClick={() => setSelectedLaw('tt20')}
              className={`w-full text-left p-2.5 rounded-lg text-xs transition border ${
                selectedLaw === 'tt20'
                  ? 'bg-white border-teal-600 shadow-xs font-semibold text-teal-900'
                  : 'border-transparent text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="font-bold block">Thông tư 20/2017/TT-BYT</span>
              <span className="text-[11px] text-slate-500 line-clamp-1">Thuốc gây nghiện &amp; Quản lý vỏ ống Morphin</span>
            </button>

            <button
              onClick={() => setSelectedLaw('tt36')}
              className={`w-full text-left p-2.5 rounded-lg text-xs transition border ${
                selectedLaw === 'tt36'
                  ? 'bg-white border-teal-600 shadow-xs font-semibold text-teal-900'
                  : 'border-transparent text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="font-bold block">Thông tư 36/2018 &amp; NĐ 96/2023</span>
              <span className="text-[11px] text-slate-500 line-clamp-1">Tiêu chuẩn GSP: Hạn dùng FEFO &amp; Kho lạnh 2-8°C</span>
            </button>

            <button
              onClick={() => setSelectedLaw('nd151')}
              className={`w-full text-left p-2.5 rounded-lg text-xs transition border ${
                selectedLaw === 'nd151'
                  ? 'bg-white border-teal-600 shadow-xs font-semibold text-teal-900'
                  : 'border-transparent text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="font-bold block">NĐ 151/2017 &amp; NĐ 114/2024</span>
              <span className="text-[11px] text-slate-500 line-clamp-1">Kiểm kê 31/12 &amp; Đề xuất thanh lý tài sản</span>
            </button>
          </div>

          {/* Main detail view */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {selectedLaw === 'nd98' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Nghị định 98/2021/NĐ-CP &amp; Nghị định 07/2023/NĐ-CP
                    </h3>
                    <p className="text-xs text-slate-500">Chính phủ ban hành về quản lý trang thiết bị y tế</p>
                  </div>
                  <a
                    href="https://vanban.chinhphu.vn/?pageid=27160&docid=204442"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline font-semibold"
                  >
                    <span>Cổng Chính Phủ</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <strong className="text-slate-900 block mb-1">1. Sổ lý lịch máy y tế (Điều 58):</strong>
                    Bệnh viện bắt buộc phải lập và lưu trữ hồ sơ theo dõi cho từng thiết bị: năm đưa vào sử dụng, phân loại rủi ro (A, B, C, D), quá trình vận hành, nhật ký sự cố và linh kiện, phụ kiện thay thế (dây thở, sensor, đầu dò).
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <strong className="text-slate-900 block mb-1">2. Trách nhiệm bảo dưỡng định kỳ (Điều 59):</strong>
                    Cơ sở khám bệnh phải thực hiện bảo trì, bảo dưỡng định kỳ theo đúng quy trình khuyến cáo của nhà sản xuất. Không được để máy hỏng mới sửa.
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <strong className="text-slate-900 block mb-1">3. Kiểm định an toàn kỹ thuật (Điều 54 - 56 &amp; TT 05/2022/TT-BYT):</strong>
                    Các máy can thiệp sự sống (máy thở, máy sốc tim, monitor, dao mổ điện) bắt buộc phải được đơn vị đo lường độc lập kiểm định định kỳ và dán tem kiểm định an toàn trước khi dùng cho bệnh nhân.
                  </div>
                </div>
              </div>
            )}

            {selectedLaw === 'tt22' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Thông tư 22/2011/TT-BYT &amp; Thông tư 23/2011/TT-BYT
                    </h3>
                    <p className="text-xs text-slate-500">Quy định tổ chức hoạt động Khoa Dược &amp; Sử dụng thuốc buồng bệnh</p>
                  </div>
                  <a
                    href="https://congbao.chinhphu.vn/van-ban/thong-tu-so-22-2011-tt-byt-11565.htm"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline font-semibold"
                  >
                    <span>Công Báo</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <strong className="text-slate-900 block mb-1">1. Định mức cơ số tủ trực buồng bệnh (Điều 9, 10 TT 22):</strong>
                    Mỗi khoa lâm sàng được cấp một lượng thuốc và vật tư tiêu hao thiết yếu dự trữ tại buồng trực theo danh mục đã được Giám đốc phê duyệt để phục vụ cấp cứu bệnh nhân ban đêm khi Kho Dược đóng cửa.
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <strong className="text-slate-900 block mb-1">2. Quy định bù cơ số trong 24 giờ (Chống nợ phiếu):</strong>
                    Khi lấy thuốc/vật tư cấp cứu khẩn cấp ban đêm, điều dưỡng phải ghi sổ. Đầu ca sáng hôm sau, kíp trực phải mang đơn thuốc/bệnh án lên Kho Dược để lập phiếu lĩnh bù, hoàn trả đủ số lượng về tủ trực trước khi bệnh nhân xuất viện.
                  </div>
                </div>
              </div>
            )}

            {selectedLaw === 'tt20' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Thông tư 20/2017/TT-BYT
                    </h3>
                    <p className="text-xs text-slate-500">Quy định quản lý thuốc và nguyên liệu làm thuốc phải kiểm soát đặc biệt</p>
                  </div>
                  <a
                    href="https://congbao.chinhphu.vn/van-ban/thong-tu-so-20-2017-tt-byt-24490.htm"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline font-semibold"
                  >
                    <span>Công Báo</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <strong className="text-slate-900 block mb-1">1. Quản lý két sắt riêng (Điều 18):</strong>
                    Thuốc gây nghiện (Morphin, Fentanyl) bắt buộc cất giữ trong tủ sắt hoặc két sắt chắc chắn có khóa riêng, chỉ người được phân công trực giữ chìa khóa.
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <strong className="text-slate-900 block mb-1">2. Bắt buộc thu hồi vỏ ống thủy tinh rỗng (Điều 19, 20):</strong>
                    Sau khi tiêm cho người bệnh, điều dưỡng bắt buộc phải giữ lại toàn bộ vỏ ống thuốc rỗng nộp về Khoa Dược. Cơ sở y tế phải thành lập Hội đồng tiêu hủy vỏ ống thuốc gây nghiện theo biên bản quy định.
                  </div>
                </div>
              </div>
            )}

            {selectedLaw === 'tt36' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Thông tư 36/2018/TT-BYT (GSP) &amp; Nghị định 96/2023/NĐ-CP
                    </h3>
                    <p className="text-xs text-slate-500">Thực hành tốt bảo quản thuốc và điều kiện bảo đảm an toàn điều trị</p>
                  </div>
                  <a
                    href="https://congbao.chinhphu.vn/van-ban/thong-tu-so-36-2018-tt-byt-28018.htm"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline font-semibold"
                  >
                    <span>Công Báo</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <strong className="text-slate-900 block mb-1">1. Nguyên tắc xuất kho FEFO (Phụ lục I, Mục 12):</strong>
                    Thuốc hoặc vật tư có hạn dùng ngắn hơn bắt buộc phải xếp ở vị trí ưu tiên để xuất dùng trước (First Expired, First Out) nhằm tránh tình trạng thuốc cũ để quên dưới góc kệ bị hết hạn phải tiêu hủy.
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <strong className="text-slate-900 block mb-1">2. Kiểm soát nhiệt độ kho mát và tủ vaccine (2°C - 8°C):</strong>
                    Vaccine, sinh phẩm, dịch truyền đạm bắt buộc duy trì liên tục ở dải nhiệt độ 2°C - 8°C. Bệnh viện phải có giải pháp giám sát và cảnh báo từ xa khi xảy ra sự cố mất điện lưới để kịp thời chuyển thuốc sang thùng đá gel dự phòng.
                  </div>
                </div>
              </div>
            )}

            {selectedLaw === 'nd151' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Nghị định 151/2017/NĐ-CP &amp; Nghị định 114/2024/NĐ-CP
                    </h3>
                    <p className="text-xs text-slate-500">Quy định chi tiết thi hành Luật Quản lý, sử dụng tài sản công trong cơ sở y tế</p>
                  </div>
                  <a
                    href="https://vanban.chinhphu.vn/?pageid=27160&docid=192534"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline font-semibold"
                  >
                    <span>Cổng Chính Phủ</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <strong className="text-slate-900 block mb-1">1. Quản lý điều chuyển tài sản công (Điều 39):</strong>
                    Việc di chuyển máy móc thiết bị y tế giữa các khoa phòng phải có hồ sơ theo dõi chính thức, tránh hiện tượng mượn miệng làm sai lệch sổ sách kế toán.
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <strong className="text-slate-900 block mb-1">2. Bắt buộc kiểm kê ngày 31/12 hàng năm (Điều 40):</strong>
                    Hàng năm vào ngày 31/12, bệnh viện phải lập Hội đồng kiểm kê toàn bộ máy móc thiết bị thực tế, đánh giá tỷ lệ hao mòn tài sản công để đối chiếu với sổ cái kế toán.
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <strong className="text-slate-900 block mb-1">3. Thanh lý tài sản công hư hỏng (Điều 44 - 46):</strong>
                    Đối với máy móc đã ngưng hoạt động lâu năm, hư hỏng không thể phục hồi hoặc chi phí sửa chữa vượt quá giá trị tài sản, bệnh viện phải lập hồ sơ kiến nghị thanh lý tài sản nhà nước theo đúng biểu mẫu pháp luật.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Hệ thống quản lý lâm sàng tuân thủ 100% các tiêu chuẩn pháp lý y tế Việt Nam</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-slate-800 hover:bg-slate-900 text-white font-medium transition"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};
