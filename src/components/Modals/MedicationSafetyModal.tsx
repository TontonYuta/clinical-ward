/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Cẩm Nang Dược Thư Lâm Sàng & Quy Chuẩn 5 Đúng (QĐ 2147/QĐ-BYT) (<=200 LOC)
 */

import React, { useState, useEffect } from 'react';
import { X, BookOpen, Stethoscope, ShieldCheck, LifeBuoy, AlertCircle } from 'lucide-react';
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
  { label: 'Morphin', id: 'med-ctrl-01' },
  { label: 'Fentanyl', id: 'med-ctrl-02' },
  { label: 'Adrenalin', id: 'med-em-01' },
  { label: 'Noradrenalin', id: 'med-em-02' },
  { label: 'Diazepam', id: 'med-em-07' },
  { label: 'Kali Clorid', id: 'med-em-09' },
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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Pinned Header */}
        <div className="h-14 px-4 bg-teal-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-800 flex items-center justify-center text-teal-200 border border-teal-700/60">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
                Dược thư Lâm sàng &amp; Quy chuẩn 5 Đúng
                <span className="text-[10px] bg-teal-800 text-teal-200 px-1.5 py-0.2 rounded border border-teal-700">QĐ 2147/BYT</span>
              </h2>
              <span className="text-[11px] text-teal-300 font-mono">Bản tin An toàn Dược &amp; Cảnh báo Nguy cơ Cao</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-teal-300 hover:text-white hover:bg-teal-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Shortcut Drug Strip */}
        <div className="px-3.5 py-2 bg-slate-100/90 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none shrink-0 text-xs">
          <span className="text-[10.5px] text-slate-500 font-semibold shrink-0">Tra nhanh:</span>
          {COMMON_DRUG_SHORTCUTS.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setSelectedMedId(chip.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer shrink-0 ${
                selectedMedId === chip.id
                  ? 'bg-teal-800 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-teal-50'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Medication Header Banner */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                {currentMed.tallManName || currentMed.brandName}
                <span className="text-xs font-mono font-normal text-slate-500">({currentMed.nationalCode})</span>
              </h3>
              <div className="text-xs text-slate-600 mt-0.5">
                Hoạt chất: <strong className="text-slate-800">{currentMed.activeIngredient}</strong> ({currentMed.concentration}) • {currentMed.route}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {currentMed.isControlled && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                  Thuốc gây nghiện (TT 18/2026)
                </span>
              )}
              {currentMed.isHighAlert && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                  High-Alert ISMP
                </span>
              )}
              {currentMed.isCrashCart && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                  Tủ trực cấp cứu
                </span>
              )}
            </div>
          </div>

          {/* Segmented Tab Controls */}
          <div className="flex items-center gap-1.5 mt-2.5 border-t border-slate-200/80 pt-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('allergy')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === 'allergy'
                  ? 'bg-rose-700 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Chỉ định &amp; Dị ứng</span>
            </button>
            <button
              onClick={() => setActiveTab('five_rights')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === 'five_rights'
                  ? 'bg-teal-800 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Quy chuẩn 5 Đúng</span>
            </button>
            <button
              onClick={() => setActiveTab('clinical_safety')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === 'clinical_safety'
                  ? 'bg-teal-800 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              <span>Dược lý &amp; Giải độc</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 overflow-y-auto flex-1">
          {activeTab === 'allergy' && <MedicationAllergyView profile={profile} medName={currentMed.brandName} />}
          {activeTab === 'five_rights' && <MedicationFiveRightsView profile={profile} />}
          {activeTab === 'clinical_safety' && <MedicationClinicalSafetyView profile={profile} />}
        </div>

        {/* Pinned Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-slate-500 text-[11px] hidden sm:flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-teal-700" />
            Tra cứu theo Dược thư Quốc gia Việt Nam &amp; Thông tư 31/2021/TT-BYT
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
