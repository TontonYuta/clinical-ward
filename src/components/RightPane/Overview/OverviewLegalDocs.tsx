/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phần Tài Liệu Đính Kèm & Căn Cứ Pháp Lý Lâm Sàng (<=200 LOC)
 */

import React from 'react';
import { FileText, BookOpen, ShieldCheck, Download, ExternalLink, Scale, AlertTriangle, Layers } from 'lucide-react';

interface OverviewLegalDocsProps {
  onOpenLegalDocs?: () => void;
}

export const OverviewLegalDocs: React.FC<OverviewLegalDocsProps> = ({
  onOpenLegalDocs
}) => {
  const documents = [
    {
      id: 'tt26',
      code: 'Thông tư 26/2025/TT-BYT',
      title: 'Kê đơn thuốc ngoại trú, nội trú và đơn thuốc điện tử',
      category: 'Kê Đơn Thuốc CPOE',
      authority: 'Bộ Y Tế (Hiệu lực: 01/07/2025)',
      description: 'Quy chuẩn 4 mẫu đơn (PL I, PL II Đơn N 3 đợt, PL III Đơn H, PL VII 90 ngày). Căn cứ định dạng mã đơn điện tử 14 ký tự.',
      pdfUrl: '/pdf/Thong_Tu_26_2025_TT_BYT_Ke_Don_Thuoc.pdf',
      color: 'teal'
    },
    {
      id: 'dtqg',
      code: 'Dược Thư Quốc Gia Việt Nam',
      title: 'Chuyên luận hoạt chất, liều tối đa, đường dùng & chống chỉ định',
      category: 'Dược Điển & Thực Hành',
      authority: 'Hội đồng Dược thư Quốc gia (Lần xuất bản II - QĐ 2033/BYT)',
      description: 'Nguồn chứng cứ lâm sàng gốc cho 20 thuốc tủ trực cấp cứu và cơ sở dữ liệu tra cứu tương tác của trợ lý AI.',
      pdfUrl: '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf',
      color: 'blue'
    },
    {
      id: 'qd5948',
      code: 'Quyết định 5948/QĐ-BYT',
      title: 'Danh mục tương tác thuốc chống chỉ định trong cơ sở khám chữa bệnh',
      category: 'An Toàn & CDSS',
      authority: 'Bộ Y Tế (Hiện hành toàn diện)',
      description: 'Khóa cứng các cặp thuốc tương tác tối nguy hiểm (Clopidogrel + PPI, Nitroglycerin + PDE5i, Morphin + Benzodiazepin).',
      pdfUrl: '/pdf/Quyet_Dinh_5948_QD_BYT_Danh_Muc_Tuong_Tac_Chong_Chi_Dinh.pdf',
      color: 'rose'
    },
    {
      id: 'tt51',
      code: 'Thông tư 51/2017/TT-BYT',
      title: 'Hướng dẫn phòng, chẩn đoán và xử trí phản vệ cấp cứu',
      category: 'Cấp Cứu Tối Khẩn',
      authority: 'Bộ Y Tế',
      description: 'Phác đồ tiêm bắp Adrenalin ngay lập tức từ phản vệ Độ II; cơ số hộp chống sốc bắt buộc tại mọi buồng tiêm và xe tiêm.',
      pdfUrl: '/pdf/Thong_Tu_51_2017_TT_BYT_Huong_Dan_Phong_Chan_Doan_Xu_Tri_Phan_Ve.pdf',
      color: 'rose'
    },
    {
      id: 'tt20',
      code: 'Thông tư 20/2017/TT-BYT',
      title: 'Quản lý thuốc kiểm soát đặc biệt (Gây nghiện, hướng thần, tiền chất)',
      category: 'Kiểm Soát Đặc Biệt',
      authority: 'Bộ Y Tế (và TT 18/2026/TT-BYT)',
      description: 'Quy trình giao nhận từng ống Morphin/Fentanyl, khóa nợ vỏ rỗng sau tiêm và biên bản tiêu hủy có hội đồng giám sát.',
      pdfUrl: '/pdf/Thong_Tu_20_2017_TT_BYT_Thuoc_Kiem_Soat_Dac_Biet.pdf',
      color: 'purple'
    },
    {
      id: 'tt22',
      code: 'Thông tư 22/2011/TT-BYT',
      title: 'Tổ chức và hoạt động của Khoa Dược bệnh viện & Sử dụng thuốc',
      category: 'Quản Trị Kho Dược',
      authority: 'Bộ Y Tế',
      description: 'Quy định hạn mức Min - Max cơ số tủ trực buồng bệnh và nguyên tắc cấp phát thuốc FEFO (hạn ngắn dùng trước).',
      pdfUrl: '/pdf/Thong_Tu_22_2011_TT_BYT_Khoa_Duoc_Benh_Vien.pdf',
      color: 'amber'
    }
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700">
              <Scale className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Tài Liệu Đính Kèm &amp; Căn Cứ Pháp Lý Lâm Sàng
            </h3>
            <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
              6 Văn Bản Gốc
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Các văn bản quy phạm pháp luật và Dược thư quốc gia được tích hợp trực tiếp làm nguồn dữ liệu cho hệ thống.
          </p>
        </div>

        {onOpenLegalDocs && (
          <button
            type="button"
            onClick={onOpenLegalDocs}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition cursor-pointer border border-slate-300 shadow-2xs self-start sm:self-auto shrink-0"
          >
            <Layers className="w-3.5 h-3.5 text-slate-600" />
            <span>Mở Cẩm Nang Pháp Quy Đầy Đủ</span>
          </button>
        )}
      </div>

      {/* 2. Lưới 6 tài liệu đính kèm kèm liên kết tải/mở PDF */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-teal-300 hover:shadow-xs transition flex flex-col justify-between space-y-2.5"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-1.5">
                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded border ${
                  doc.color === 'rose' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                  doc.color === 'purple' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                  doc.color === 'amber' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                  doc.color === 'blue' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                  'bg-teal-50 text-teal-800 border-teal-200'
                }`}>
                  {doc.category}
                </span>
                <span className="text-[10px] font-mono text-slate-400">PDF Bản Gốc</span>
              </div>

              <h4 className="font-bold text-xs text-slate-950 leading-snug">
                {doc.code}
              </h4>
              <p className="text-[11px] font-medium text-slate-700 leading-snug">
                {doc.title}
              </p>
              <p className="text-2xs text-slate-500 leading-relaxed pt-1 border-t border-slate-100">
                {doc.description}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
              <a
                href={doc.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-2xs font-bold text-teal-800 hover:text-teal-950 hover:underline cursor-pointer"
                title={`Mở tệp PDF gốc: ${doc.code}`}
              >
                <Download className="w-3 h-3 text-teal-700" />
                <span>Mở PDF gốc</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </a>

              {onOpenLegalDocs && (
                <button
                  type="button"
                  onClick={onOpenLegalDocs}
                  className="text-2xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Điều khoản &rarr;
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
