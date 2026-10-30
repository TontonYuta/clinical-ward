/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bàn Làm Việc Chi Tiết Thuốc & Dược Thư Quốc Gia - Chuẩn Workstation Bệnh Viện (<=200 LOC)
 * Giao diện tươi sáng, phân cấp thị giác rõ ràng, triệt tiêu viền màu và icon rác
 */

import React, { useState, useEffect } from 'react';
import { X, ExternalLink, RotateCw } from 'lucide-react';
import { InventoryBatch } from '../../types/pharmacy';
import { MasterMedication } from '../../types/medication';
import { getDrugDetailApi } from '../../services/api';
import { DavAdministrativeBlocks } from './DavDrugDetail/DavAdministrativeBlocks';
import { DavDocumentActionButtons } from './DavDrugDetail/DavDocumentActionButtons';
import { DavClinicalKnowledgeBlock } from './DavDrugDetail/DavClinicalKnowledgeBlock';
import { formatContraindicationsList } from '../../utils/clinicalFormatter';
import { getMedicationClinicalProfile } from '../../data/clinicalProfiles';
import { useModalDismiss } from '../../hooks/useModalDismiss';

type DrugDetailTab = 'overview' | 'safety' | 'dosage' | 'registration' | 'hospital-batch';

interface DavDrugDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch?: InventoryBatch | null;
  drug?: MasterMedication | null;
  onQuickDispatch?: (batch: InventoryBatch) => void;
}

export const DavDrugDetailModal: React.FC<DavDrugDetailModalProps> = ({
  isOpen, onClose, batch, drug,
}) => {
  useModalDismiss(isOpen, onClose);
  const [liveDrug, setLiveDrug] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refreshingDetail, setRefreshingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<DrugDetailTab>('overview');

  const itemName = batch?.itemName || drug?.brandName || 'Chưa đặt tên';
  const sdk = batch?.registrationNumber || batch?.nationalCode || drug?.nationalCode || 'Chưa cập nhật';
  const activeInn = batch?.activeIngredient || drug?.activeIngredient || 'Theo hồ sơ Cục QLD';
  const strength = batch?.concentration || drug?.concentration;
  const davPortalUrl = `https://dichvucong.dav.gov.vn/congbothuoc/index?search=${encodeURIComponent(sdk)}`;

  const loadDetails = (isManual = false) => {
    if (!isOpen || !sdk || sdk === 'Chưa cập nhật') { setLoadingDetail(false); return; }
    if (isManual) setRefreshingDetail(true);
    setLoadingDetail(true);
    getDrugDetailApi(sdk, isManual)
      .then((res) => { if (res) setLiveDrug(res); setLoadingDetail(false); setRefreshingDetail(false); })
      .catch(() => { setLoadingDetail(false); setRefreshingDetail(false); });
  };

  useEffect(() => {
    if (isOpen && sdk && sdk !== 'Chưa cập nhật') {
      setLiveDrug(null);
      loadDetails(false);
    }
  }, [isOpen, sdk]);

  useEffect(() => { if (isOpen) setActiveTab('overview'); }, [isOpen, sdk]);

  if (!isOpen || (!batch && !drug)) return null;

  const c = (k: string) => liveDrug?.[k] ?? (batch as any)?.[k] ?? (drug as any)?.[k];
  const profile = getMedicationClinicalProfile(itemName || activeInn);
  let resolvedSource = c('clinical_source') || c('clinicalSource');
  if (!resolvedSource || !resolvedSource.includes('Trang')) {
    if (profile?.officialSource?.pdfPage) {
      resolvedSource = `${profile.officialSource.documentName}, Trang ${profile.officialSource.pdfPage} • Tệp: ${profile.officialSource.pdfDocument || 'Duoc_Thu_Quoc_Gia_Viet_Nam.pdf'}`;
    }
  }

  const adminData = {
    dosageForm: c('dosage_form') || c('dosageForm'), packagingSpec: c('packaging_spec') || c('packagingSpec'),
    standardPharmacopeia: c('standard_pharmacopeia') || c('standardPharmacopeia'), shelfLife: c('shelf_life') || c('shelfLife'),
    route: c('route'), category: c('group') || c('category'), pharmacologicalClass: batch?.pharmacologicalClass,
    atcCode: c('atc_code') || c('atcCode'), itemName, activeIngredient: activeInn,
    isControlledSubstance: liveDrug?.is_controlled ?? batch?.isControlledSubstance ?? drug?.isControlled,
    manufacturer: c('manufacturer'), country: c('country'),
    applicantName: c('applicant_name') || c('applicantName'), approvalDecision: c('approval_decision') || c('approvalDecision'),
  };

  const liveSource = liveDrug?.clinical_source || liveDrug?.clinicalSource;
  const hasLinkedMonograph = Boolean(liveDrug?.clinical_monograph_id || liveDrug?.clinicalMonographId);
  const isVerified = Boolean(hasLinkedMonograph || (liveSource?.includes('Duoc_Thu_Quoc_Gia_Viet_Nam.pdf') && /Trang\s+\d+/.test(liveSource)))
    || profile.isVerifiedMonograph === true;
  // Clinical content is accepted only from a linked/traceable monograph or a
  // curated verified profile. Batch and registration records are administrative.
  const clinical = (key: string, camelKey?: string) => isVerified
    ? (liveDrug?.[key] ?? (camelKey ? liveDrug?.[camelKey] : undefined))
    : undefined;
  const clinicalData = {
    atcCode: clinical('atc_code', 'atcCode') || (isVerified ? profile?.atcCode : undefined),
    drugClass: clinical('drug_class', 'drugClass') || (profile.isVerifiedMonograph === true ? profile?.allergyProfile?.allergyClass : undefined),
    indications: clinical('indications') || (profile.isVerifiedMonograph === true ? profile?.indications?.join('\n') : undefined),
    contraindications: clinical('contraindications') || (profile.isVerifiedMonograph === true ? profile?.contraindications?.join('\n') : undefined),
    precautions: clinical('precautions') || (profile.isVerifiedMonograph === true ? profile?.patientVerificationChecklist?.join('\n') : undefined),
    pregnancyWarning: clinical('pregnancy_warning', 'pregnancyWarning') || (profile.isVerifiedMonograph === true ? profile?.pregnancyLactation : undefined),
    adultDosage: clinical('adult_dosage', 'adultDosage') || (profile.isVerifiedMonograph === true ? profile?.standardDosing : undefined),
    pediatricDosage: clinical('pediatric_dosage', 'pediatricDosage'),
    renalAdjustment: clinical('renal_adjustment', 'renalAdjustment') || (profile.isVerifiedMonograph === true ? profile?.renalAdjustment : undefined),
    hepaticAdjustment: clinical('hepatic_adjustment', 'hepaticAdjustment') || (profile.isVerifiedMonograph === true ? profile?.hepaticAdjustment : undefined),
    adverseEffects: clinical('adverse_effects', 'adverseEffects') || (profile.isVerifiedMonograph === true ? profile?.adverseReactions?.join('\n') : undefined),
    drugInteractions: clinical('drug_interactions', 'drugInteractions') || (profile.isVerifiedMonograph === true ? profile?.ddiWarnings?.join('\n') : undefined),
    overdoseTreatment: clinical('overdose_treatment', 'overdoseTreatment'),
    antidote: clinical('antidote') || (profile.isVerifiedMonograph === true ? profile?.antidote : undefined),
    clinicalSource: isVerified ? resolvedSource : (c('clinical_source') || c('clinicalSource') || `Hồ sơ cấp phép Cục Quản lý Dược (SĐK: ${sdk})`),
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="dav-drug-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-xs"
    >
      <div className="bg-white rounded-none sm:rounded-xl shadow-xl border-0 sm:border border-slate-200 w-full sm:max-w-6xl xl:max-w-7xl h-[100dvh] sm:h-auto sm:max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in duration-100">
        
        {/* Top Header Workstation (Trắng sáng tươi mới, phân cấp rõ) */}
        <div className="bg-white text-slate-900 px-6 py-4 flex items-center justify-between shrink-0 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded">
              SĐK: {sdk}
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                {itemName} {strength && <span className="text-xs font-medium text-slate-500">({strength})</span>}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                <span>Hoạt chất:</span> <strong className="text-slate-800">{activeInn}</strong>
                {clinicalData.drugClass && <span className="ml-2 text-slate-400">{clinicalData.drugClass}</span>}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={onClose} data-testid="btn-close-dav-detail" className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="shrink-0 border-b border-slate-200 bg-white px-3 sm:px-5 overflow-x-auto thin-scrollbar">
          <div role="tablist" aria-label="Nhóm thông tin thuốc" className="flex min-w-max items-center gap-1">
            {([['overview', 'Tổng quan'], ['safety', 'An toàn'], ['dosage', 'Liều dùng'], ['registration', 'Thông tin đăng ký'], ...(batch ? [['hospital-batch', 'Lô bệnh viện']] : [])] as [DrugDetailTab, string][]).map(([tab, label]) => (
              <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`min-h-11 border-b-2 px-3 sm:px-4 text-sm font-semibold whitespace-nowrap transition ${activeTab === tab ? 'border-blue-700 bg-blue-50/60 text-blue-800' : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>{label}</button>
            ))}
          </div>
        </div>
        <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden thin-scrollbar bg-slate-50/60 p-3 sm:p-5">
          {activeTab === 'overview' && <div className="mx-auto max-w-5xl space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><h3 className="mb-4 text-base font-bold text-slate-900">Nhận diện thuốc</h3><dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><dt className="text-xs font-medium text-slate-500">Dạng bào chế</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{adminData.dosageForm || 'Chưa có thông tin'}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Đường dùng</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{adminData.route || 'Chưa có thông tin'}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Phân loại dược lý</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{clinicalData.drugClass || adminData.category || 'Chưa phân loại'}</dd></div>
              {adminData.isControlledSubstance && <div><dt className="text-xs font-medium text-slate-500">Quy chế</dt><dd className="mt-1 inline-flex rounded-md bg-rose-50 px-2 py-1 text-sm font-semibold text-rose-800">Thuốc kiểm soát đặc biệt</dd></div>}
            </dl></section>
            {(clinicalData.contraindications || clinicalData.antidote || batch?.isControlledSubstance || drug?.isControlled || drug?.isHighAlert || liveDrug?.is_high_alert) && <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5"><h3 className="mb-3 text-base font-bold text-amber-950">Cảnh báo cần chú ý</h3>
              {clinicalData.contraindications && <div className="mb-3"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-800">Chống chỉ định</p><ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-800">{formatContraindicationsList(clinicalData.contraindications).map((text, i) => <li key={i}>{text}</li>)}</ul></div>}
              {clinicalData.antidote && <p className="text-sm text-slate-800"><strong>Thuốc giải độc:</strong> {clinicalData.antidote}</p>}
              {(batch?.isControlledSubstance || drug?.isControlled) && <p className="text-sm font-semibold text-rose-800">Thuốc kiểm soát đặc biệt; tuân thủ quy trình quản lý tương ứng.</p>}
              {(drug?.isHighAlert || liveDrug?.is_high_alert) && <p className="text-sm font-semibold text-rose-800">Thuốc nguy cơ cao; cần kiểm tra độc lập theo quy trình bệnh viện.</p>}
            </section>}
            {batch && <BatchSummary batch={batch} />}
          </div>}
          {activeTab === 'safety' && <div className="mx-auto max-w-5xl"><DavClinicalKnowledgeBlock data={clinicalData} isLoading={loadingDetail} activeTab="safety" showNavigation={false} /></div>}
          {activeTab === 'dosage' && <div className="mx-auto max-w-5xl"><DavClinicalKnowledgeBlock data={clinicalData} isLoading={loadingDetail} activeTab="dosage" showNavigation={false} /></div>}
          {activeTab === 'registration' && <div className="mx-auto max-w-5xl space-y-4"><DavAdministrativeBlocks data={adminData} /><DavDocumentActionButtons hdsdPath={batch?.hdsdPath || drug?.hdsdPath} labelPath={batch?.labelPath || drug?.labelPath} nationalCode={sdk} brandName={itemName} /></div>}
          {activeTab === 'hospital-batch' && batch && <div className="mx-auto max-w-5xl"><BatchSummary batch={batch} showLocation /></div>}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <a href={davPortalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline">
            <span>Đối soát trực tiếp Cổng Cục Quản Lý Dược</span><ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition cursor-pointer">Đóng</button>
        </div>
      </div>
    </div>
  );
};


const BatchSummary: React.FC<{ batch: InventoryBatch; showLocation?: boolean }> = ({ batch, showLocation }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-bold text-slate-900">Lô tại bệnh viện</h3><span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-sm font-semibold text-slate-800">{batch.batchNumber}</span></div>
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div><dt className="text-xs text-slate-500">Tồn kho</dt><dd className="mt-1 text-sm font-bold text-slate-900">{batch.currentStock} {batch.unit}</dd></div>
      <div><dt className="text-xs text-slate-500">Hạn dùng</dt><dd className={`mt-1 text-sm font-semibold ${batch.daysLeft <= 60 ? 'text-rose-700' : 'text-slate-900'}`}>{batch.expiryDate}<span className="ml-1 text-xs">({batch.daysLeft} ngày)</span></dd></div>
      <div><dt className="text-xs text-slate-500">Tồn tối thiểu</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{batch.minThreshold} {batch.unit}</dd></div>
      {showLocation && <div><dt className="text-xs text-slate-500">Vị trí kho</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{batch.warehouseLocation}</dd></div>}
    </dl>
  </section>
);
