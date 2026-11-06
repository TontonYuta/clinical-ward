/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Chi Tiết Hồ Sơ Bệnh Nhân Lâm Sàng Chuẩn TT 26/2025/TT-BYT (<=200 LOC)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { X, Send, Printer } from 'lucide-react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { PatientProfile } from '../../services/patientService';
import { SendSmsModal } from './SendSmsModal';
import { getCachedDebts } from '../../utils/storage/appStatePersistence';
import { PrescriptionOrder } from '../../types/cpoe';
import { PatientOverviewTab } from './PatientDetail/PatientOverviewTab';
import { PatientPrescriptionsTab } from './PatientDetail/PatientPrescriptionsTab';
import { PatientAdminTab } from './PatientDetail/PatientAdminTab';

export type PatientDetailTab = 'overview' | 'prescriptions' | 'administrative';

interface PatientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient?: PatientProfile | null;
  patientIdOrName?: string;
  patients?: PatientProfile[];
  onOpenPrescriptionOrder?: (patient: PatientProfile) => void;
}

export const PatientDetailModal: React.FC<PatientDetailModalProps> = ({
  isOpen,
  onClose,
  patient: initialPatient,
  patientIdOrName,
  patients = [],
  onOpenPrescriptionOrder,
}) => {
  useModalDismiss(isOpen,onClose);
  const [activeTab, setActiveTab] = useState<PatientDetailTab>('overview');
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [prescriptionRevision, setPrescriptionRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setPrescriptionRevision(value => value + 1);
    window.addEventListener('cpoe_order_created', refresh);
    return () => window.removeEventListener('cpoe_order_created', refresh);
  }, []);

  const patient = useMemo(() => {
    if (initialPatient) return initialPatient;
    if (!patientIdOrName?.trim()) return null;
    const q = patientIdOrName.trim().toLowerCase();
    return patients.find((p) => p.id.toLowerCase() === q) || (patients.filter(p=>p.fullName.toLowerCase()===q).length===1 ? patients.find(p=>p.fullName.toLowerCase()===q) : null) || null;
  }, [initialPatient, patientIdOrName, patients]);

  const relatedPrescriptions = useMemo(() => {
    if (!patient) return [];
    try {
      const stored = localStorage.getItem('clinical_cached_cpoe');
      const all: PrescriptionOrder[] = stored ? JSON.parse(stored) : [];
      const name = patient.fullName.trim().toLowerCase();
      const uniqueName = patients.filter(p => p.fullName.trim().toLowerCase() === name).length === 1;
      return all.filter((o) => o.patientId?.trim()
        ? o.patientId === patient.id
        : uniqueName && o.patientName?.trim().toLowerCase() === name);
    } catch { return []; }
  }, [patient, patients, isOpen, prescriptionRevision]);

  const relatedDebts = useMemo(() => {
    if (!patient) return [];
    try {
      const all = getCachedDebts();
      const uniqueName = patients.filter(p => p.fullName.trim().toLowerCase() === patient.fullName.trim().toLowerCase()).length === 1;
      return all.filter((d: any) => d.patientId
        ? d.patientId === patient.id
        : d.patientRoom?.toLowerCase()?.includes(patient.id?.toLowerCase()) || (uniqueName && d.patientName?.trim().toLowerCase() === patient.fullName.trim().toLowerCase()));
    } catch { return []; }
  }, [patient, patients, isOpen]);

  if (!isOpen) return null;
  if (!patient) return <div role="dialog" aria-modal="true" aria-label="Hồ sơ người bệnh" data-testid="patient-detail-modal" className="clinical-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"><div className="bg-white rounded-2xl p-8 max-w-md text-center"><h2 className="text-lg font-semibold">Không tìm thấy hồ sơ</h2><p className="text-sm text-slate-500 mt-3">Không có người bệnh khớp với định danh được chọn. Vui lòng kiểm tra lại mã hồ sơ.</p><button type="button" data-testid="btn-close-patient-detail" className="button-primary mt-5" onClick={onClose}>Đóng</button></div></div>;

  const tabs: [PatientDetailTab, string][] = [
    ['overview', 'Hồ sơ'],
    ['prescriptions', `Điều trị (${relatedPrescriptions.length})`],
    ['administrative', 'Hành chính'],
  ];

  return (
    <div role="dialog" aria-modal="true" data-testid="patient-detail-modal" className="clinical-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-none sm:rounded-xl shadow-2xl border-0 sm:border border-slate-300 w-full sm:max-w-6xl xl:max-w-7xl h-[100dvh] sm:h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-100">
        {/* Header Chuẩn Y Tế */}
        <div className="px-3 sm:px-5 py-2 sm:py-3.5 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
              <span className="font-mono text-2xs sm:text-xs font-bold text-slate-800 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">MÃ BN: {patient.id}</span>
              <h2 className="text-sm sm:text-xl font-bold text-slate-950 tracking-tight truncate">
                {patient.fullName} <span className="text-2xs sm:text-sm font-normal text-slate-500">({patient.gender}, {patient.age} tuổi)</span>
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 self-end sm:self-auto shrink-0">
            <button type="button" onClick={() => setIsSmsModalOpen(true)} data-testid="btn-open-sms-from-patient" title="Gửi thông báo y tế cho bệnh nhân (SMS / Email)" className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-2xs sm:text-xs font-semibold transition cursor-pointer shadow-2xs">
              <Send className="w-3.5 h-3.5 text-slate-600" /><span>Gửi thông báo cho BN</span>
            </button>
            <button onClick={() => window.print()} title="In tóm tắt hồ sơ bệnh án" aria-label="In tóm tắt hồ sơ" className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer">
              <Printer className="w-4 h-4" />
            </button>
            <button onClick={onClose} data-testid="btn-close-patient-detail" aria-label="Đóng hồ sơ bệnh nhân" className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thanh Tab gạch chân */}
        <div role="tablist" aria-label="Nhóm thông tin bệnh nhân" className="flex items-center gap-1 overflow-x-auto text-sm scrollbar-none border-b border-slate-200 px-5 bg-white shrink-0">
          {tabs.map(([tab, label]) => {
            const isSelected = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-2.5 border-b-2 shrink-0 font-medium cursor-pointer transition-colors text-sm whitespace-nowrap ${
                  isSelected
                    ? 'border-slate-900 text-slate-950 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-950'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Nội Dung Theo Từng Tab */}
        {activeTab === 'overview' && (
          <PatientOverviewTab
            patient={patient}
            relatedPrescriptions={relatedPrescriptions}
            relatedDebts={relatedDebts}
            onOpenPrescriptionOrder={onOpenPrescriptionOrder}
          />
        )}

        {activeTab === 'prescriptions' && (
          <PatientPrescriptionsTab
            relatedPrescriptions={relatedPrescriptions}
            relatedDebts={relatedDebts}
          />
        )}

        {activeTab === 'administrative' && (
          <PatientAdminTab patient={patient} />
        )}

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            Hồ sơ người bệnh nội trú bệnh viện · Mã đối soát: <span className="font-mono font-bold text-slate-800">{patient.id}</span>
          </div>
          <div className="flex items-center gap-2">
            {onOpenPrescriptionOrder && (
              <button
                type="button"
                onClick={() => { onClose(); onOpenPrescriptionOrder(patient); }}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer shadow-xs"
              >
                Kê đơn thuốc mới
              </button>
            )}
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>

      <SendSmsModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        patient={patient}
        diagnosis={patient?.diagnosis}
        initialMessageType="hospital_notice"
      />
    </div>
  );
};
