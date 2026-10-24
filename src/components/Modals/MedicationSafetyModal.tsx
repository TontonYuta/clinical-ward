/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Cẩm Nang Dược Thư Lâm Sàng & Quy Chuẩn 5 Đúng (QĐ 2147/QĐ-BYT) (<=200 LOC)
 * Giao diện hiện đại, tối ưu không gian hiển thị, loại bỏ icon rác
 */

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ALL_MASTER_MEDICATIONS } from '../../data/medicationMasterData';
import { getMedicationClinicalProfile } from '../../data/clinicalProfiles';
import { MedicationFiveRightsView } from './MedicationSafety/MedicationFiveRightsView';
import { MedicationClinicalSafetyView } from './MedicationSafety/MedicationClinicalSafetyView';
import { MedicationAllergyView } from './MedicationSafety/MedicationAllergyView';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface MedicationSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMedicationId?: string;
  initialMedicationName?: string;
  defaultTab?: 'allergy' | 'five_rights' | 'clinical_safety';
}

const COMMON_DRUG_SHORTCUTS = [
  { label: 'Morphin', id: 'med-ctrl-01' }, { label: 'Fentanyl', id: 'med-ctrl-02' },
  { label: 'Adrenalin', id: 'med-em-01' }, { label: 'Noradrenalin', id: 'med-em-02' },
  { label: 'Diazepam', id: 'med-em-07' }, { label: 'Kali Clorid', id: 'med-em-09' },
  { label: 'Ceftriaxone', id: 'med-ab-01' },
];

export const MedicationSafetyModal: React.FC<MedicationSafetyModalProps> = ({
  isOpen,
  onClose,
  initialMedicationId,
  initialMedicationName,
  defaultTab = 'allergy',
}) => {
  useModalDismiss(isOpen, onClose);
  const [selectedMedId, setSelectedMedId] = useState<string>('med-ctrl-01');
  const [activeTab, setActiveTab] = useState<'allergy' | 'five_rights' | 'clinical_safety'>('allergy');

  useEffect(() => {
    if (defaultTab) setActiveTab(defaultTab);
    if (initialMedicationId) setSelectedMedId(initialMedicationId);
    else if (initialMedicationName) {
      const q = initialMedicationName.toLowerCase();
      const found = ALL_MASTER_MEDICATIONS.find((m) =>
        m.brandName.toLowerCase().includes(q) || m.activeIngredient.toLowerCase().includes(q)
      );
      if (found) setSelectedMedId(found.id);
    }
  }, [defaultTab, initialMedicationId, initialMedicationName, isOpen]);

  if (!isOpen) return null;

  const currentMed = ALL_MASTER_MEDICATIONS.find((m) => m.id === selectedMedId) || ALL_MASTER_MEDICATIONS[0];
  const profile = getMedicationClinicalProfile(currentMed.id, currentMed);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Thông Tin Thuốc & Hướng Dẫn Sử Dụng An Toàn"
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

        {/* Quick Shortcut Drug Strip */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none shrink-0 text-xs">
          <span className="text-xs text-slate-500 font-semibold shrink-0">Tra nhanh:</span>
          {COMMON_DRUG_SHORTCUTS.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setSelectedMedId(chip.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                selectedMedId === chip.id
                  ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Medication Header Banner */}
        <div className="px-6 py-3.5 bg-white border-b border-slate-200/80 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {currentMed.tallManName || currentMed.brandName}
                </h3>
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

          {/* Segmented Tab Controls (Text-only, clean modern styling) */}
          <div className="flex items-center gap-2 mt-3.5 border-t border-slate-100 pt-3 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('allergy')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                activeTab === 'allergy'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Chỉ định, Thành phần &amp; Dị ứng
            </button>
            <button
              onClick={() => setActiveTab('five_rights')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                activeTab === 'five_rights'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Liều dùng &amp; Hướng dẫn an toàn
            </button>
            <button
              onClick={() => setActiveTab('clinical_safety')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                activeTab === 'clinical_safety'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Dược lý, Giải độc &amp; Giám sát lâm sàng
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/40">
          {activeTab === 'allergy' && <MedicationAllergyView profile={profile} medName={currentMed.brandName} />}
          {activeTab === 'five_rights' && <MedicationFiveRightsView profile={profile} />}
          {activeTab === 'clinical_safety' && <MedicationClinicalSafetyView profile={profile} />}
        </div>

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
