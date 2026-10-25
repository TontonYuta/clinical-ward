/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Thông Tin Thuốc & Hướng Dẫn Sử Dụng An Toàn Chuẩn BYT (<=200 LOC)
 */

import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { ALL_MASTER_MEDICATIONS, removeVietnameseTones } from '../../data/medicationMasterData';
import { getMedicationClinicalProfile } from '../../data/clinicalProfiles';
import { MedicationFiveRightsView } from './MedicationSafety/MedicationFiveRightsView';
import { MedicationClinicalSafetyView } from './MedicationSafety/MedicationClinicalSafetyView';
import { MedicationAllergyView } from './MedicationSafety/MedicationAllergyView';
import { MedicationSafetySearchBar } from './MedicationSafety/MedicationSafetySearchBar';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface MedicationSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMedicationId?: string;
  initialMedicationName?: string;
  defaultTab?: 'allergy' | 'five_rights' | 'clinical_safety';
}

const TABS = [
  { id: 'allergy', label: 'Chỉ định, Thành phần & Dị ứng' },
  { id: 'five_rights', label: 'Liều dùng & Hướng dẫn an toàn' },
  { id: 'clinical_safety', label: 'Dược lý, Giải độc & Giám sát lâm sàng' },
] as const;

export const MedicationSafetyModal: React.FC<MedicationSafetyModalProps> = ({
  isOpen, onClose, initialMedicationId, initialMedicationName, defaultTab = 'allergy',
}) => {
  useModalDismiss(isOpen, onClose);
  const [selectedMedId, setSelectedMedId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'allergy' | 'five_rights' | 'clinical_safety'>('allergy');

  useEffect(() => {
    if (defaultTab) setActiveTab(defaultTab);
    if (initialMedicationId) {
      setSelectedMedId(initialMedicationId);
      setSearchQuery('');
    } else if (initialMedicationName) {
      const q = removeVietnameseTones(initialMedicationName);
      const cleanQ = q.replace(/sulfate|sulfat|hydroclorid|hydrochloride/g, '').trim();
      const found = ALL_MASTER_MEDICATIONS.find((m) => {
        const brand = removeVietnameseTones(m.brandName);
        const active = removeVietnameseTones(m.activeIngredient);
        const aliases = (m.searchAliases || []).map(removeVietnameseTones);
        return brand.includes(q) || q.includes(brand) ||
               active.includes(q) || q.includes(active) ||
               aliases.some(a => a.includes(q) || q.includes(a)) ||
               (cleanQ.length > 2 && (brand.includes(cleanQ) || active.includes(cleanQ)));
      });
      setSelectedMedId(found?.id);
      setSearchQuery(found ? '' : initialMedicationName);
    } else {
      setSelectedMedId(undefined);
      setSearchQuery('');
    }
  }, [defaultTab, initialMedicationId, initialMedicationName, isOpen]);

  if (!isOpen) return null;
  const currentMed = selectedMedId ? ALL_MASTER_MEDICATIONS.find((m) => m.id === selectedMedId) : undefined;
  const profile = currentMed ? getMedicationClinicalProfile(currentMed.id, currentMed) : null;

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Thông Tin Thuốc & Hướng Dẫn Sử Dụng An Toàn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-[95vw] max-w-5xl lg:max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Pinned Header */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight">Thông Tin Thuốc &amp; Hướng Dẫn Sử Dụng An Toàn</h2>
            <p className="text-xs text-slate-300 font-normal mt-0.5">Tiêu chuẩn Dược điển &amp; Cục Quản lý Dược - Bộ Y Tế</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Search Bar Header */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200/80 shrink-0">
          <MedicationSafetySearchBar
            searchQuery={searchQuery} onSearchChange={setSearchQuery}
            onSelectMedication={(med) => setSelectedMedId(med.id)} selectedMedicationId={selectedMedId}
          />
        </div>

        {currentMed && profile ? (
          <>
            {/* Medication Header Banner */}
            <div className="px-6 py-3.5 bg-white border-b border-slate-200/80 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      {currentMed.brandName}
                    </h3>
                    {currentMed.tallManName && (
                      <span className="font-mono text-xs text-teal-800 font-semibold px-2 py-0.5 rounded bg-teal-50 border border-teal-200">
                        {currentMed.tallManName}
                      </span>
                    )}
                    <span className="font-mono text-xs text-slate-500 font-semibold px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                      {currentMed.nationalCode}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600 mt-1">
                    Hoạt chất: <strong className="text-slate-900">{currentMed.activeIngredient}</strong> ({currentMed.concentration}) • {currentMed.route}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(profile.atcCode || currentMed.atcCode) && (
                    <span className="px-2 py-1 rounded text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                      ATC: {profile.atcCode || currentMed.atcCode}
                    </span>
                  )}
                  {currentMed.isControlled && (
                    <span className="px-2.5 py-1 rounded text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                      Thuốc KSĐB
                    </span>
                  )}
                  {currentMed.isHighAlert && (
                    <span className="px-2.5 py-1 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      Nguy cơ cao
                    </span>
                  )}
                  {currentMed.isCrashCart && (
                    <span className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Cơ số cấp cứu
                    </span>
                  )}
                </div>
              </div>

              {/* Segmented Tab Controls */}
              <div className="flex items-center gap-2 mt-3.5 border-t border-slate-100 pt-3 overflow-x-auto scrollbar-none">
                {TABS.map((tab) => (
                  <button
                    key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                      activeTab === tab.id ? 'bg-slate-900 text-white shadow-2xs' : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/40">
              {activeTab === 'allergy' && <MedicationAllergyView profile={profile} medName={currentMed.brandName} />}
              {activeTab === 'five_rights' && <MedicationFiveRightsView profile={profile} />}
              {activeTab === 'clinical_safety' && <MedicationClinicalSafetyView profile={profile} />}
            </div>
          </>
        ) : (
          /* Empty State: Prompt user to type into search bar */
          <div className="p-8 sm:p-12 flex-1 flex flex-col items-center justify-center text-center bg-slate-50/50">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shadow-2xs mb-4">
              <Search className="w-7 h-7" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Tra cứu thông tin thuốc &amp; chuẩn Bộ Y Tế
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mt-1.5 leading-relaxed">
              Vui lòng nhập tên thuốc, biệt dược hoặc hoạt chất vào ô tìm kiếm phía trên để tra cứu hồ sơ dược lâm sàng, liều dùng và hướng dẫn an toàn.
            </p>
          </div>
        )}

        {/* Pinned Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-slate-500 text-xs hidden sm:inline">
            Đối soát tiêu chuẩn Dược điển &amp; Hướng dẫn sử dụng thuốc Bộ Y Tế
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs cursor-pointer transition shadow-2xs ml-auto"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
