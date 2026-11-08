/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Tra Cứu Căn Cứ Pháp Lý & Văn Bản Quy Phạm Y Tế Hiện Hành (<=200 LOC)
 */

import React, { useState } from 'react';
import { X, Scale, ChevronRight } from 'lucide-react';
import { LegalDocId } from '../../types/legal';
import { UPDATED_LEGAL_DOCS } from './LegalDocs/legalDocsData';
import { LegalDocDetailView } from './LegalDocs/LegalDocDetailView';

interface LegalDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LegalDocsModal: React.FC<LegalDocsModalProps> = ({ isOpen, onClose }) => {
  const [selectedLaw, setSelectedLaw] = useState<LegalDocId>('tt26_2025');

  if (!isOpen) return null;

  const currentDoc =
    UPDATED_LEGAL_DOCS.find((d) => d.id === selectedLaw) || UPDATED_LEGAL_DOCS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white sm:rounded-lg rounded-none shadow-xl border sm:border-slate-200 border-none w-full h-full sm:h-[88vh] sm:max-h-[88vh] sm:max-w-4xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 sm:h-16 px-4 sm:px-6 bg-white border-b border-slate-200 text-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 truncate">
                Căn Cứ Pháp Lý &amp; Quy Chế Y Tế Hiện Hành
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Bộ Y Tế &amp; Chính Phủ (Cập nhật chuẩn 2025 - 2026)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Horizontal Pill Bar */}
        <div className="flex md:hidden overflow-x-auto scrollbar-none px-3 py-2 bg-slate-100 border-b border-slate-200 gap-1.5 shrink-0">
          {UPDATED_LEGAL_DOCS.map((doc) => {
            const isActive = selectedLaw === doc.id;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedLaw(doc.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                <span>{doc.shortCode}</span>
              </button>
            );
          })}
        </div>

        {/* Main Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Desktop Sidebar Navigation */}
          <div className="hidden md:flex flex-col w-64 lg:w-72 bg-slate-50 border-r border-slate-200 shrink-0 overflow-y-auto p-3 space-y-1.5">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">
              Danh Mục Văn Bản
            </div>
            {UPDATED_LEGAL_DOCS.map((doc) => {
              const isActive = selectedLaw === doc.id;
              const IconComp = doc.icon || Scale;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedLaw(doc.id)}
                  className={`w-full text-left p-3 rounded-xl transition cursor-pointer flex items-center justify-between gap-2.5 ${
                    isActive
                      ? 'bg-teal-50 text-teal-900 border border-teal-300 font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <IconComp className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-700' : 'text-slate-400'}`} />
                    <div className="min-w-0">
                      <div className="text-xs truncate">{doc.shortCode}</div>
                      <div className="text-[11px] text-slate-400 truncate">{doc.category}</div>
                    </div>
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 text-teal-700 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Right Detail Panel */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white">
            <LegalDocDetailView doc={currentDoc} />
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 px-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Hệ thống quản lý dược &amp; thiết bị lâm sàng</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold transition cursor-pointer active:scale-98"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
