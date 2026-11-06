/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phần Tài Liệu Đính Kèm & Tệp PDF Gốc Tối Giản (<=200 LOC)
 */

import React from 'react';
import { ExternalLink } from 'lucide-react';

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
      tag: 'Kê đơn điện tử (PL I - VII)',
      pdfUrl: '/pdf/Thong_Tu_26_2025_TT_BYT_Ke_Don_Thuoc.pdf'
    },
    {
      id: 'dtqg',
      code: 'Dược Thư Quốc Gia Việt Nam',
      tag: 'Chuyên luận Dược thư Lần II',
      pdfUrl: '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf'
    },
    {
      id: 'qd5948',
      code: 'Quyết định 5948/QĐ-BYT',
      tag: 'Tương tác chống chỉ định',
      pdfUrl: '/pdf/Quyet_Dinh_5948_QD_BYT_Danh_Muc_Tuong_Tac_Chong_Chi_Dinh.pdf'
    },
    {
      id: 'tt51',
      code: 'Thông tư 51/2017/TT-BYT',
      tag: 'Phác đồ cấp cứu phản vệ',
      pdfUrl: '/pdf/Thong_Tu_51_2017_TT_BYT_Huong_Dan_Phong_Chan_Doan_Xu_Tri_Phan_Ve.pdf'
    },
    {
      id: 'tt20',
      code: 'Thông tư 20/2017/TT-BYT',
      tag: 'Thuốc kiểm soát đặc biệt',
      pdfUrl: '/pdf/Thong_Tu_20_2017_TT_BYT_Thuoc_Kiem_Soat_Dac_Biet.pdf'
    },
    {
      id: 'tt22',
      code: 'Thông tư 22/2011/TT-BYT',
      tag: 'Khoa Dược & Cơ số tủ trực',
      pdfUrl: '/pdf/Thong_Tu_22_2011_TT_BYT_Khoa_Duoc_Benh_Vien.pdf'
    }
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4">
      {/* 1. Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <h3 className="text-lg font-bold text-slate-900 tracking-tight">
          Tài Liệu Đính Kèm
        </h3>

        {onOpenLegalDocs && (
          <button
            type="button"
            onClick={onOpenLegalDocs}
            className="text-sm font-semibold text-teal-800 hover:text-teal-950 hover:underline cursor-pointer"
          >
            Cẩm nang quy định &rarr;
          </button>
        )}
      </div>

      {/* 2. Danh mục tài liệu tinh gọn với cỡ chữ rộng */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition flex items-center justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                {doc.code}
              </h4>
              <div className="text-xs sm:text-sm text-slate-600 truncate mt-0.5">{doc.tag}</div>
            </div>

            <a
              href={doc.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-teal-800 hover:text-teal-950 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 shrink-0 transition"
              title={`Mở PDF: ${doc.code}`}
            >
              <span>PDF Gốc</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};
