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
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
      {/* 1. Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight">
          Tài Liệu Đính Kèm
        </h3>

        {onOpenLegalDocs && (
          <button
            type="button"
            onClick={onOpenLegalDocs}
            className="text-xs font-semibold text-teal-800 hover:text-teal-950 hover:underline cursor-pointer"
          >
            Cẩm nang quy định &rarr;
          </button>
        )}
      </div>

      {/* 2. Danh mục tài liệu tinh gọn */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2"
          >
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-xs text-slate-900 truncate">
                {doc.code}
              </h4>
              <div className="text-2xs text-slate-500 truncate">{doc.tag}</div>
            </div>

            <a
              href={doc.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-2xs font-semibold text-teal-800 hover:text-teal-950 px-2 py-1 rounded bg-white border border-slate-200 hover:border-teal-400 shrink-0"
              title={`Mở PDF: ${doc.code}`}
            >
              <span>PDF Gốc</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};
