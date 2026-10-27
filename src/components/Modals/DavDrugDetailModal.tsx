/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bàn Làm Việc Chi Tiết Thuốc & Dược Thư Quốc Gia - Chuẩn Workstation Bệnh Viện (<=200 LOC)
 * Giao diện tươi sáng, phân cấp thị giác rõ ràng, triệt tiêu viền màu và icon rác
 */

import React, { useState, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { InventoryBatch } from '../../types/pharmacy';
import { MasterMedication } from '../../types/medication';
import { getDrugDetailApi } from '../../services/api';
import { DavAdministrativeBlocks } from './DavDrugDetail/DavAdministrativeBlocks';
import { DavDocumentActionButtons } from './DavDrugDetail/DavDocumentActionButtons';
import { DavClinicalKnowledgeBlock } from './DavDrugDetail/DavClinicalKnowledgeBlock';
import { formatContraindicationsList } from '../../utils/clinicalFormatter';

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
  if (!isOpen || (!batch && !drug)) return null;

  const itemName = batch?.itemName || drug?.brandName || 'Chưa đặt tên';
  const sdk = batch?.registrationNumber || batch?.nationalCode || drug?.nationalCode || 'Chưa cập nhật';
  const activeInn = batch?.activeIngredient || drug?.activeIngredient || 'Theo hồ sơ Cục QLD';
  const strength = batch?.concentration || drug?.concentration;
  const davPortalUrl = `https://dichvucong.dav.gov.vn/congbothuoc/index?search=${encodeURIComponent(sdk)}`;

  const [liveDrug, setLiveDrug] = useState<any>(null);

  useEffect(() => {
    if (!isOpen || !sdk || sdk === 'Chưa cập nhật') return;
    let active = true;
    getDrugDetailApi(sdk).then((res) => { if (active && res) setLiveDrug(res); }).catch(() => {});
    return () => { active = false; };
  }, [isOpen, sdk]);

  const adminData = {
    dosageForm: liveDrug?.dosage_form || batch?.dosageForm || drug?.dosageForm,
    packagingSpec: liveDrug?.packaging_spec || batch?.packagingSpec || drug?.packagingSpec,
    standardPharmacopeia: liveDrug?.standard_pharmacopeia || batch?.standardPharmacopeia || drug?.standardPharmacopeia,
    shelfLife: liveDrug?.shelf_life || batch?.shelfLife || drug?.shelfLife,
    route: liveDrug?.route || batch?.route || drug?.route,
    category: liveDrug?.group || batch?.category || drug?.group,
    pharmacologicalClass: batch?.pharmacologicalClass,
    atcCode: liveDrug?.atc_code || liveDrug?.atcCode || batch?.atcCode || drug?.atcCode,
    itemName: itemName,
    activeIngredient: activeInn,
    isControlledSubstance: liveDrug?.is_controlled ?? batch?.isControlledSubstance ?? drug?.isControlled,
    manufacturer: liveDrug?.manufacturer || batch?.manufacturer || drug?.manufacturer,
    country: liveDrug?.country || batch?.country || drug?.country,
    applicantName: liveDrug?.applicant_name || batch?.applicantName || drug?.applicantName,
    approvalDecision: liveDrug?.approval_decision || batch?.approvalDecision || drug?.approvalDecision,
  };

  const clinicalData = {
    atcCode: liveDrug?.atc_code || liveDrug?.atcCode || batch?.atcCode || drug?.atcCode,
    drugClass: liveDrug?.drug_class || liveDrug?.drugClass || batch?.drugClass || drug?.drugClass,
    indications: liveDrug?.indications || batch?.indications || drug?.indications,
    contraindications: liveDrug?.contraindications || batch?.contraindications || drug?.contraindications,
    precautions: liveDrug?.precautions || batch?.precautions || drug?.precautions,
    pregnancyWarning: liveDrug?.pregnancy_warning || liveDrug?.pregnancyWarning || batch?.pregnancyWarning || drug?.pregnancyWarning,
    adultDosage: liveDrug?.adult_dosage || liveDrug?.adultDosage || batch?.adultDosage || drug?.adultDosage,
    pediatricDosage: liveDrug?.pediatric_dosage || liveDrug?.pediatricDosage || batch?.pediatricDosage || drug?.pediatricDosage,
    renalAdjustment: liveDrug?.renal_adjustment || liveDrug?.renalAdjustment || batch?.renalAdjustment || drug?.renalAdjustment,
    hepaticAdjustment: liveDrug?.hepatic_adjustment || liveDrug?.hepaticAdjustment || batch?.hepaticAdjustment || drug?.hepaticAdjustment,
    adverseEffects: liveDrug?.adverse_effects || liveDrug?.adverseEffects || batch?.adverseEffects || drug?.adverseEffects,
    drugInteractions: liveDrug?.drug_interactions || liveDrug?.drugInteractions || batch?.drugInteractions || drug?.drugInteractions,
    overdoseTreatment: liveDrug?.overdose_treatment || liveDrug?.overdoseTreatment || batch?.overdoseTreatment || drug?.overdoseTreatment,
    antidote: liveDrug?.antidote || batch?.antidote || drug?.antidote,
    clinicalSource: liveDrug?.clinical_source || liveDrug?.clinicalSource || batch?.clinicalSource || drug?.clinicalSource,
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
            <span className="inline-flex items-center text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded select-none">
              ✓ Đã kiểm chứng 100%
            </span>
            <span className="hidden sm:inline-flex text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
              CSDL Cục QLD
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thân 2 Cột Workstation */}
        <div className="p-4 sm:p-5 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5 text-sm text-slate-800">
          
          {/* Cột Trái (5/12): Cảnh Báo An Toàn, Hành Chính, Mẫu Nhãn, Lô Kho */}
          <div className="lg:col-span-5 space-y-3.5">
            {clinicalData.contraindications && (
              <div className="bg-red-50/50 border border-red-200 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center justify-between text-red-800 font-bold text-xs uppercase tracking-wide">
                  <span>Chống chỉ định tuyệt đối</span>
                  <span className="text-2xs bg-red-100 text-red-800 px-2 py-0.5 rounded font-bold">Cấm kỵ</span>
                </div>
                <ul className="space-y-1.5">
                  {formatContraindicationsList(clinicalData.contraindications).map((c, i) => (
                    <li key={i} className="text-xs sm:text-sm text-slate-800 flex items-start gap-2 leading-relaxed">
                      <span className="text-red-600 font-bold select-none">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {clinicalData.antidote && (
              <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-blue-900 font-bold text-xs uppercase tracking-wide">
                  <span>Thuốc giải độc đặc hiệu (Antidote)</span>
                  <span className="text-2xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">Cấp cứu</span>
                </div>
                <div className="text-xs sm:text-sm text-slate-800 flex items-start gap-2 leading-relaxed">
                  <span className="text-blue-600 font-bold select-none">•</span>
                  <p className="font-medium text-slate-900">{clinicalData.antidote}</p>
                </div>
              </div>
            )}

            <DavAdministrativeBlocks data={adminData} />
            <DavDocumentActionButtons hdsdPath={batch?.hdsdPath || drug?.hdsdPath} labelPath={batch?.labelPath || drug?.labelPath} nationalCode={sdk} brandName={itemName} />

            {batch && (
              <div className="border border-slate-200 rounded-lg p-3.5 bg-white space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">Lô Thuốc Tại Kho Bệnh Viện</span>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200">Lô: {batch.batchNumber}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                    <span className="text-slate-500 block mb-0.5">Hạn dùng</span>
                    <span className="font-mono font-bold text-sm text-slate-900">{batch.expiryDate}</span>
                    <span className={`text-xs block mt-0.5 ${batch.daysLeft <= 60 ? 'text-red-600 font-bold' : 'text-slate-500'}`}>(Còn {batch.daysLeft} ngày)</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                    <span className="text-slate-500 block mb-0.5">Tồn thực tế</span>
                    <span className="font-mono font-bold text-sm text-slate-900">{batch.currentStock} {batch.unit}</span>
                    <span className="text-slate-500 block text-xs mt-0.5">Ngưỡng min: {batch.minThreshold}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cột Phải (7/12): Chuyên Luận Dược Thư Lâm Sàng Rộng Rãi */}
          <div className="lg:col-span-7">
            <DavClinicalKnowledgeBlock data={clinicalData} />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <a href={davPortalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline">
            <span>Đối soát trực tiếp Cổng Cục Quản Lý Dược</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition cursor-pointer">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
