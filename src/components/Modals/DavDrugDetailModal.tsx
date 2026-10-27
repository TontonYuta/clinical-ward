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

  const itemName = batch?.itemName || drug?.brandName || 'Chưa đặt tên';
  const sdk = batch?.registrationNumber || batch?.nationalCode || drug?.nationalCode || 'Chưa cập nhật';
  const activeInn = batch?.activeIngredient || drug?.activeIngredient || 'Theo hồ sơ Cục QLD';
  const strength = batch?.concentration || drug?.concentration;
  const davPortalUrl = `https://dichvucong.dav.gov.vn/congbothuoc/index?search=${encodeURIComponent(sdk)}`;

  const loadDetails = (isManual = false) => {
    if (!isOpen || !sdk || sdk === 'Chưa cập nhật') { setLoadingDetail(false); return; }
    if (isManual) setLiveDrug(null);
    setLoadingDetail(true);
    getDrugDetailApi(sdk, isManual)
      .then((res) => { if (res) setLiveDrug(res); setLoadingDetail(false); })
      .catch(() => { setLoadingDetail(false); });
  };

  useEffect(() => {
    if (isOpen && sdk && sdk !== 'Chưa cập nhật') {
      setLiveDrug(null);
      loadDetails(false);
    }
  }, [isOpen, sdk]);

  if (!isOpen || (!batch && !drug)) return null;

  const c = (k: string) => liveDrug?.[k] || (batch as any)?.[k] || (drug as any)?.[k];
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

  const clinicalData = {
    atcCode: c('atc_code') || c('atcCode') || profile?.officialSource?.atcCode,
    drugClass: c('drug_class') || c('drugClass') || profile?.allergyProfile?.allergyClass,
    indications: c('indications') || profile?.indications?.join('\n'),
    contraindications: c('contraindications') || profile?.usageGuidance?.blackBoxWarning,
    precautions: c('precautions') || profile?.usageGuidance?.monitoringParameters?.join('\n'),
    pregnancyWarning: c('pregnancy_warning') || c('pregnancyWarning') || profile?.usageGuidance?.pregnancyLactation,
    adultDosage: c('adult_dosage') || c('adultDosage') || (profile?.usageGuidance?.standardDosage ? `${profile.usageGuidance.standardDosage}. ${profile.usageGuidance.dilutionStandard || ''}` : undefined),
    pediatricDosage: c('pediatric_dosage') || c('pediatricDosage'),
    renalAdjustment: c('renal_adjustment') || c('renalAdjustment') || profile?.usageGuidance?.doseAdjustmentRenal,
    hepaticAdjustment: c('hepatic_adjustment') || c('hepaticAdjustment') || profile?.usageGuidance?.doseAdjustmentHepatic,
    adverseEffects: c('adverse_effects') || c('adverseEffects'), drugInteractions: c('drug_interactions') || c('drugInteractions'),
    overdoseTreatment: c('overdose_treatment') || c('overdoseTreatment'),
    antidote: c('antidote') || profile?.emergencyAntidote?.antidoteName,
    clinicalSource: resolvedSource,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-6xl xl:max-w-7xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in duration-100">
        
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
                {clinicalData.drugClass && <span className="ml-2 text-slate-400">• {clinicalData.drugClass}</span>}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button" onClick={() => loadDetails(true)} disabled={loadingDetail}
              data-testid="drug-detail-reload-btn"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 transition cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
              title="Tải lại và cập nhật đối soát từ CSDL Dược Quốc Gia & Dược Thư"
            >
              <RotateCw className={`w-3.5 h-3.5 text-blue-600 ${loadingDetail ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Cập nhật lại</span>
            </button>
            {loadingDetail ? (
              <span className="inline-flex items-center text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded select-none animate-pulse">Đang nạp hồ sơ...</span>
            ) : clinicalData.clinicalSource ? (
              <span className="inline-flex items-center text-xs font-semibold text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded select-none">DTQG 2015 &amp; SmPC</span>
            ) : (
              <span className="inline-flex items-center text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded select-none">Chưa có chuyên luận đối chiếu</span>
            )}
            <span className="hidden sm:inline-flex text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">CSDL Cục QLD</span>
            <button onClick={onClose} data-testid="btn-close-dav-detail" className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Thân 2 Cột Workstation */}
        <div className="p-4 sm:p-5 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5 text-sm text-slate-800">
          {/* Cột Trái (5/12): Cảnh Báo An Toàn, Hành Chính, Mẫu Nhãn, Lô Kho */}
          <div className="lg:col-span-5 space-y-3">
            {clinicalData.contraindications && (
              <div className="bg-red-50/50 border border-red-200 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between text-red-800 font-bold text-xs uppercase tracking-wide">
                  <span>Chống chỉ định tuyệt đối</span>
                  <span className="text-2xs bg-red-100 text-red-800 px-2 py-0.5 rounded font-bold">Cấm kỵ</span>
                </div>
                <ul className="space-y-1">
                  {formatContraindicationsList(clinicalData.contraindications).map((c, i) => (
                    <li key={i} className="text-xs sm:text-sm text-slate-800 flex items-start gap-1.5 leading-relaxed">
                      <span className="text-red-600 font-bold select-none">•</span><span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {clinicalData.antidote && (
              <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between text-blue-900 font-bold text-xs uppercase tracking-wide">
                  <span>Thuốc giải độc đặc hiệu (Antidote)</span>
                  <span className="text-2xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">Cấp cứu</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-800 font-medium">• {clinicalData.antidote}</p>
              </div>
            )}

            <DavAdministrativeBlocks data={adminData} />
            <DavDocumentActionButtons hdsdPath={batch?.hdsdPath || drug?.hdsdPath} labelPath={batch?.labelPath || drug?.labelPath} nationalCode={sdk} brandName={itemName} />

            {batch && (
              <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-1.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">Lô Thuốc Tại Kho Bệnh Viện</span>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200">Lô: {batch.batchNumber}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2 rounded border border-slate-100">
                    <span className="text-slate-500 block">Hạn dùng: <strong className="font-mono text-slate-900">{batch.expiryDate}</strong></span>
                    <span className={`text-xs block ${batch.daysLeft <= 60 ? 'text-red-600 font-bold' : 'text-slate-500'}`}>(Còn {batch.daysLeft} ngày)</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-100">
                    <span className="text-slate-500 block">Tồn: <strong className="font-mono text-slate-900">{batch.currentStock} {batch.unit}</strong></span>
                    <span className="text-slate-500 block text-xs">Min: {batch.minThreshold}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cột Phải (7/12): Chuyên Luận Dược Thư Lâm Sàng Rộng Rãi */}
          <div className="lg:col-span-7">
            <DavClinicalKnowledgeBlock data={clinicalData} isLoading={loadingDetail} />
          </div>
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
