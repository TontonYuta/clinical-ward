/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Chi tiết Nội dung Văn bản Pháp luật & Điểm Cốt Lõi Áp Dụng Phần Mềm
 */

import React, { useState } from 'react';
import { ExternalLink, ShieldCheck, CheckCircle2, BookOpen } from 'lucide-react';
import { LegalDocMeta } from '../../../types/legal';
import { PdfViewerModal } from '../PdfViewerModal';
import { resolvePdfDocumentTarget } from '../../../utils/pdfDocumentResolver';

interface LegalDocDetailViewProps {
  doc: LegalDocMeta;
}

export const LegalDocDetailView: React.FC<LegalDocDetailViewProps> = ({ doc }) => {
  const [isPdfOpen, setIsPdfOpen] = useState<boolean>(false);
  const IconComponent = doc.icon || ShieldCheck;
  const target = resolvePdfDocumentTarget({ docCode: doc.code, title: doc.title });

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-700 border border-teal-200 flex items-center justify-center shrink-0">
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 mb-1">
                {doc.category}
              </span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                {doc.code}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{doc.title}</p>
              {doc.replacesOrAmends && (
                <p className="text-xs text-amber-700 font-medium mt-1">
                  {doc.replacesOrAmends}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsPdfOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-teal-800 text-white hover:bg-teal-900 transition shadow-2xs cursor-pointer active:scale-98"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Xem bản PDF scan</span>
            </button>
            <a
              href={doc.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition shadow-xs"
              title="Mở cổng thông tin văn bản gốc ngoài trình duyệt"
            >
              <span>Web</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center gap-2 text-xs text-slate-500">
          <span>Cơ quan ban hành: <strong>{doc.authority}</strong></span>
        </div>
      </div>

      {/* In-App PDF Viewer Modal */}
      {isPdfOpen && (
        <PdfViewerModal
          isOpen={isPdfOpen}
          onClose={() => setIsPdfOpen(false)}
          pdfUrl={target.pdfUrl}
          title={doc.title}
          pageNumber={target.pageNumber}
        />
      )}

      {/* Key Articles List */}
      <div>
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Điều khoản trọng yếu tích hợp trong phần mềm
        </h4>
        <div className="grid gap-3">
          {doc.keyArticles.map((item, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-4 hover:border-teal-300 hover:shadow-xs transition"
            >
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                  {idx + 1}
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <h5 className="text-sm font-bold text-slate-900 leading-tight">
                    {item.article}
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {item.summary}
                  </p>
                  <div className="flex items-center gap-1.5 pt-1 text-xs font-medium text-teal-700">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Áp dụng trên hệ thống: <strong>{item.systemFeature}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
