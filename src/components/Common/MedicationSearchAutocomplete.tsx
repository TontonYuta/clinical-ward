/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Component Tìm Kiếm Dược Lâm Sàng Đa Vector & Autocomplete (Chuẩn An Toàn LASA)
 */

import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ShieldAlert, Sparkles, AlertTriangle } from 'lucide-react';
import { MasterMedication } from '../../types/medication';
import { searchMasterMedications } from '../../data/medicationMasterData';

interface MedicationSearchAutocompleteProps {
  onSelect: (medication: MasterMedication) => void;
  selectedMedicationName?: string;
  defaultOnlyCrashCart?: boolean;
  placeholder?: string;
}

export const MedicationSearchAutocomplete: React.FC<MedicationSearchAutocompleteProps> = ({
  onSelect,
  selectedMedicationName = '',
  defaultOnlyCrashCart = true,
  placeholder = 'Tìm tên thuốc, hoạt chất (adre, mor, ceftri, kcl)...',
}) => {
  const [searchTerm, setSearchTerm] = useState(selectedMedicationName);
  const [isOpen, setIsOpen] = useState(false);
  const [onlyCrashCart, setOnlyCrashCart] = useState(defaultOnlyCrashCart);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = searchMasterMedications(searchTerm, {
    onlyCrashCart,
    limit: 7,
  });

  useEffect(() => {
    setSearchTerm(selectedMedicationName);
  }, [selectedMedicationName]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelectMed = (med: MasterMedication) => {
    setSearchTerm(med.brandName);
    setIsOpen(false);
    onSelect(med);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setIsOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[highlightedIndex]) handleSelectMed(results[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full text-xs">
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => { setSearchTerm(''); setIsOpen(true); }}
            className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Scope Filter Chips */}
      <div className="flex items-center justify-between mt-1.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOnlyCrashCart(true)}
            className={`px-2 py-0.5 rounded-md font-semibold text-[10.5px] border transition cursor-pointer ${
              onlyCrashCart ? 'bg-blue-600 text-white border-blue-700 shadow-2xs' : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            Cơ số tủ trực cấp cứu
          </button>
          <button
            type="button"
            onClick={() => setOnlyCrashCart(false)}
            className={`px-2 py-0.5 rounded-md font-semibold text-[10.5px] border transition cursor-pointer ${
              !onlyCrashCart ? 'bg-blue-600 text-white border-blue-700 shadow-2xs' : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            Toàn bệnh viện
          </button>
        </div>
        <span className="text-[10px] text-slate-500 font-sans font-medium">Chuẩn QĐ 2147/BYT</span>
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-xl border border-slate-200 max-h-64 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-150">
          {results.length === 0 ? (
            <div className="p-4 text-center text-slate-500">
              <p className="font-medium">Không tìm thấy thuốc khớp từ khóa "{searchTerm}"</p>
              <button
                type="button"
                onClick={() => setOnlyCrashCart(false)}
                className="mt-1 text-blue-600 font-semibold hover:underline"
              >
                Mở rộng tìm kiếm trong toàn bộ kho dược bệnh viện
              </button>
            </div>
          ) : (
            results.map((med, idx) => {
              const isSelected = idx === highlightedIndex;
              return (
                <div
                  key={med.id}
                  onClick={() => handleSelectMed(med)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`p-2.5 transition cursor-pointer ${isSelected ? 'bg-blue-50/80 text-blue-950' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      {med.tallManName || med.brandName}
                      {med.isControlled && (
                        <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                          Gây nghiện (TT 18/2026)
                        </span>
                      )}
                      {med.isHighAlert && !med.isControlled && (
                        <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                          High-Alert
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] font-sans tabular-nums font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60">
                      Tủ: {med.wardStockCount} {med.standardUnit}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate">
                      Hoạt chất: <strong className="text-slate-700">{med.activeIngredient}</strong> ({med.concentration}) • {med.route}
                    </span>
                    <span className="font-sans tabular-nums text-slate-500 font-medium shrink-0 ml-2">Kho: {med.hospitalStockCount}</span>
                  </div>

                  {med.note && (
                    <div className="mt-1 text-[10px] text-slate-500 italic truncate flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                      <span>{med.note}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
