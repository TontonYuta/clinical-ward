import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Tag, Check, ChevronRight, X, BookOpen, Stethoscope, Pill } from 'lucide-react';
import { CLINICAL_MACROS, ClinicalMacro, searchClinicalMacros } from '../../data/clinicalMacros';

interface ClinicalMacroAutocompleteProps {
  /** Text hiện tại trong ô input/textarea */
  currentText: string;
  /** Callback khi người dùng chọn một macro */
  onSelectMacro: (macro: ClinicalMacro, mode?: 'replace_word' | 'full_prompt' | 'append') => void;
  /** Vị trí hiển thị menu (mặc định nổi phía trên input) */
  placement?: 'top' | 'bottom';
  /** Có hiển thị thanh shortcut nhanh hay không */
  showQuickBar?: boolean;
  /** Nội dung bổ sung trong thanh công cụ (ví dụ: suggestion chips) */
  children?: React.ReactNode;
}

export const ClinicalMacroAutocomplete: React.FC<ClinicalMacroAutocompleteProps> = ({
  currentText,
  onSelectMacro,
  placement = 'top',
  showQuickBar = true,
  children
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [matchedMacros, setMatchedMacros] = useState<ClinicalMacro[]>([]);
  const [isInlineVisible, setIsInlineVisible] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Phát hiện từ đang gõ ở cuối chuỗi xem có khớp với macro nào không
  useEffect(() => {
    if (!currentText) {
      setMatchedMacros([]);
      setIsInlineVisible(false);
      return;
    }

    const words = currentText.trim().split(/\s+/);
    const lastWord = words[words.length - 1];

    // Kích hoạt khi gõ từ 2 ký tự hoặc bắt đầu bằng dấu gạch chéo '/' (VD: "th", "THA", "/nmct", "puv")
    if (lastWord && (lastWord.length >= 2 || lastWord.startsWith('/'))) {
      const cleanToken = lastWord.replace(/^\//, '');
      const results = searchClinicalMacros(cleanToken, 5);
      if (results.length > 0) {
        setMatchedMacros(results);
        setIsInlineVisible(true);
        setHighlightedIndex(0);
        return;
      }
    }

    setIsInlineVisible(false);
  }, [currentText]);

  // Đóng khi click ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsInlineVisible(false);
        setIsDrawerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const categories = ['Tất cả', 'Cấp cứu - Chống độc', 'Tim mạch', 'Hô hấp', 'Nội tiết - Chuyển hóa', 'Thuốc & Y lệnh'];

  const filteredDrawerMacros = selectedCategory === 'Tất cả'
    ? CLINICAL_MACROS
    : CLINICAL_MACROS.filter((m) => m.category === selectedCategory);

  return (
    <div ref={popoverRef} className="relative w-full">
      {/* 1. INLINE AUTOCOMPLETE DROPDOWN (Khi gõ phím) */}
      {isInlineVisible && matchedMacros.length > 0 && (
        <div
          className={`absolute left-0 right-0 z-50 bg-white rounded-xl shadow-xl border border-teal-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
            placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <div className="px-3 py-2 bg-slate-900 text-white flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '3s' }} />
              <span>Gợi ý gõ tắt lâm sàng &amp; ICD-10 (Smart Macros)</span>
            </div>
            <span className="text-slate-400 font-mono text-[11px]">Nhấn Tab / Enter hoặc click để chọn</span>
          </div>

          <div className="max-h-48 sm:max-h-56 overflow-y-auto divide-y divide-slate-100">
            {matchedMacros.map((macro, idx) => (
              <div
                key={macro.shortcut}
                onClick={() => {
                  onSelectMacro(macro, 'replace_word');
                  setIsInlineVisible(false);
                }}
                className={`p-2.5 flex items-start justify-between gap-3 cursor-pointer transition ${
                  idx === highlightedIndex ? 'bg-teal-50/90 text-teal-950 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-teal-800 text-white shadow-2xs">
                      {macro.shortcut}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold truncate text-slate-900">
                      {macro.expansion}
                    </span>
                    {macro.icd10 && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-mono font-bold">
                        ICD-10: {macro.icd10}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1">{macro.description}</p>
                </div>

                <div className="shrink-0 flex items-center gap-1">
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    {macro.fhirResource}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>

          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span>💡 Chuẩn hóa dữ liệu theo HL7 FHIR Condition &amp; Observation</span>
            <button
              type="button"
              onClick={() => setIsInlineVisible(false)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              Đóng (Esc)
            </button>
          </div>
        </div>
      )}

      {/* 2. QUICK MACROS DRAWER (Modal tra cứu toàn bộ danh mục) */}
      {isDrawerOpen && (
        <div
          className={`absolute left-0 right-0 z-50 bg-white rounded-xl shadow-2xl border border-slate-300 overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${
            placement === 'top' ? 'bottom-full mb-3' : 'top-full mt-3'
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-teal-900 to-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-teal-500/20 text-teal-300">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold">Thư viện Viết tắt Y khoa &amp; Chuẩn hóa ICD-10</h4>
                <p className="text-xs text-slate-300">Nhấp vào thẻ để tự động điền chẩn đoán hoặc gửi lệnh AI</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-200 overflow-x-auto scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-teal-800 text-white font-bold shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="max-h-56 sm:max-h-72 overflow-y-auto p-2.5 sm:p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredDrawerMacros.map((macro) => (
              <div
                key={macro.shortcut}
                className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-teal-500 hover:bg-teal-50/50 transition flex flex-col justify-between gap-2 shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-teal-800 text-white">
                      {macro.shortcut}
                    </span>
                    {macro.icd10 ? (
                      <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                        ICD-10: {macro.icd10}
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-purple-800 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                        {macro.fhirResource}
                      </span>
                    )}
                  </div>
                  <h5 className="text-xs font-bold text-slate-900 leading-snug">{macro.expansion}</h5>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{macro.description}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectMacro(macro, 'replace_word');
                      setIsDrawerOpen(false);
                    }}
                    className="flex-1 py-1 px-2 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-900 text-[11px] font-bold border border-teal-200 transition cursor-pointer text-center"
                    title="Chèn tên chẩn đoán chuẩn vào ô nhập"
                  >
                    + Chèn chẩn đoán
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectMacro(macro, 'full_prompt');
                      setIsDrawerOpen(false);
                    }}
                    className="py-1 px-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium border border-slate-200 transition cursor-pointer"
                    title="Điền câu lệnh AI đầy đủ"
                  >
                    Lệnh mẫu AI
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. QUICK CHIPS BAR (Thanh phím gõ nhanh tiện lợi - hợp nhất 1 dòng) */}
      {showQuickBar && (
        <div className="flex items-center gap-1.5 py-1.5 overflow-x-auto scrollbar-none text-xs shrink-0">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 border shadow-2xs ${
              isDrawerOpen
                ? 'bg-teal-800 text-white border-teal-800'
                : 'bg-teal-50 text-teal-900 border-teal-300 hover:bg-teal-100'
            }`}
            title="Mở thư viện gõ tắt Y khoa & ICD-10"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Macros ICD-10</span>
          </button>

          {children}
          {/* Frequent Macros Chips */}
          {[
            { key: 'PUV', label: '⚡ PUV (Phản vệ)' },
            { key: 'THA', label: 'THA (Huyết áp)' },
            { key: 'NMCT', label: 'NMCT (Nhồi máu)' },
            { key: 'COPD', label: 'COPD (Phổi mạn)' },
            { key: 'DTĐ2', label: 'DTĐ2 (Tiểu đường)' },
            { key: 'MOR', label: 'MOR (Morphin)' }
          ].map((item) => {
            const macroObj = CLINICAL_MACROS.find((m) => m.shortcut === item.key);
            if (!macroObj) return null;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectMacro(macroObj, 'replace_word')}
                className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium shrink-0 transition cursor-pointer hover:border-slate-300 shadow-2xs"
                title={`${macroObj.expansion} - ${macroObj.description}`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
