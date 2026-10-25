/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh tìm kiếm Dược lâm sàng & Autocomplete chuẩn Dược điển (<=200 LOC)
 */

import React, { useRef, useState, useEffect } from 'react';
import { Search, X, Check } from 'lucide-react';
import { MasterMedication } from '../../../types/medication';
import { searchMasterMedications } from '../../../data/medicationMasterData';

interface MedicationSafetySearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectMedication: (med: MasterMedication) => void;
  selectedMedicationId?: string;
  className?: string;
}

export const MedicationSafetySearchBar: React.FC<MedicationSafetySearchBarProps> = ({
  searchQuery,
  onSearchChange,
  onSelectMedication,
  selectedMedicationId,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = searchQuery.trim();
  const searchResults = trimmed ? searchMasterMedications(trimmed, { limit: 8 }) : [];

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelect = (med: MasterMedication) => {
    onSelectMedication(med);
    onSearchChange('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (trimmed) setIsOpen(true);
          }}
          placeholder="Nhập tên thuốc, biệt dược hoặc hoạt chất (vd: Morphin, Paracetamol, Diazepam...)"
          className="w-full pl-10 pr-9 py-2 bg-white text-xs sm:text-sm border border-slate-300 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 transition shadow-2xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              setIsOpen(false);
            }}
            className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer transition"
            title="Xóa tìm kiếm"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Floating Dropdown Results */}
      {isOpen && trimmed.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-xl border border-slate-200 max-h-72 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
          {searchResults.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              Không tìm thấy thuốc khớp với "{searchQuery}".
            </div>
          ) : (
            searchResults.map((med) => {
              const isCurrent = med.id === selectedMedicationId;
              return (
                <button
                  key={med.id}
                  type="button"
                  onClick={() => handleSelect(med)}
                  className={`w-full text-left p-3 transition cursor-pointer flex items-center justify-between gap-3 ${
                    isCurrent ? 'bg-teal-50/80 hover:bg-teal-100/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-slate-900">
                        {med.brandName}
                      </span>
                      {med.tallManName && (
                        <span className="text-2xs text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded font-mono font-medium border border-teal-200/60">
                          {med.tallManName}
                        </span>
                      )}
                      <span className="font-mono text-2xs text-slate-500 font-semibold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {med.nationalCode}
                      </span>
                      {med.isControlled && (
                        <span className="px-1.5 py-0.2 rounded text-2xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                          KSĐB
                        </span>
                      )}
                      {med.isHighAlert && !med.isControlled && (
                        <span className="px-1.5 py-0.2 rounded text-2xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          Nguy cơ cao
                        </span>
                      )}
                    </div>
                    <div className="text-2xs sm:text-xs text-slate-500 mt-1 truncate">
                      Hoạt chất: <strong className="text-slate-700">{med.activeIngredient}</strong> ({med.concentration}) • {med.route}
                    </div>
                  </div>
                  {isCurrent && (
                    <span className="text-teal-700 font-semibold text-xs shrink-0 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Đang xem
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
