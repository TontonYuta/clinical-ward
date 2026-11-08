/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bàn Làm Việc Chi Tiết Thuốc & Dược Thư Quốc Gia - Chuẩn Workstation Kho Dược
 * Bố cục Trái - Phải phẳng, sạch sẽ, triệt tiêu box lồng nhau, triệt tiêu dấu chấm đầu dòng
 */

import React, { useState, useEffect } from 'react';
import { X, ExternalLink, RotateCw, FileText, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { InventoryBatch } from '../../types/pharmacy';
import { MasterMedication } from '../../types/medication';
import { getDrugDetailApi, getCachedDrugDetail } from '../../services/api';
import { DavDocumentActionButtons } from './DavDrugDetail/DavDocumentActionButtons';
import {
  formatContraindicationsList,
  parseClinicalBullets,
  extractQuickDosageMetrics,
  stripLeadingBullets,
} from '../../utils/clinicalFormatter';
import { getMedicationClinicalProfile } from '../../data/clinicalProfiles';
import { useModalDismiss } from '../../hooks/useModalDismiss';

type DrugDetailTab = 'overview' | 'safety' | 'dosage' | 'pharmacology' | 'interactions' | 'registration' | 'hospital-batch';

interface DavDrugDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch?: InventoryBatch | null;
  drug?: MasterMedication | null;
  onQuickDispatch?: (batch: InventoryBatch) => void;
}

function parseSource(src?: string) {
  if (!src) return null;
  const pageMatch = src.match(/Trang\s*([\d\s–-]+)/i);
  const pageStr = pageMatch ? pageMatch[0].trim() : null;
  const pageNum = pageMatch ? parseInt(pageMatch[1].trim().split(/[-–\s]+/)[0], 10) : null;
  const pdfMatch = src.match(/([A-Za-z0-9_.-]+\.pdf)/i);
  const pdfFile = pdfMatch ? pdfMatch[1] : (src.includes('Dược thư') ? 'Duoc_Thu_Quoc_Gia_Viet_Nam.pdf' : null);
  const pdfUrl = pdfFile ? `/pdf/${pdfFile}${pageNum ? `#page=${pageNum}` : ''}` : null;
  const legalBasis = src.split('•')[0].replace(/,\s*Trang\s*[\d\s–-]+/i, '').trim();
  return { legalBasis, pdfFile, pageStr, pageNum, pdfUrl };
}

function extractQuickPkMetrics(pkText?: string | null) {
  if (!pkText) return null;
  const tHalfMatch = pkText.match(/(?:nửa đời|thời gian bán thải|t1\/2|t½)[^\d]*?(\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*(?:giờ|phút|ngày|h))/i);
  const bioavailabilityMatch = pkText.match(/(?:sinh khả dụng|hấp thu)[^\d%]*?(\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*%)/i);
  const proteinBindingMatch = pkText.match(/(?:liên kết|gắn)[^\d%]*?protein[^\d%]*?(\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*%)/i);
  const cmaxMatch = pkText.match(/(?:nồng độ đỉnh|cmax)[^\d]*?(\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*(?:microgam|mcg|mg|µg)\/ml)/i);
  return {
    tHalf: tHalfMatch ? tHalfMatch[1].trim() : null,
    bioavailability: bioavailabilityMatch ? bioavailabilityMatch[1].trim() : null,
    proteinBinding: proteinBindingMatch ? proteinBindingMatch[1].trim() : null,
    cmax: cmaxMatch ? cmaxMatch[1].trim() : null,
  };
}

const ClinicalExpandableBlock: React.FC<{
  title: string;
  content?: string | null;
  emptyText?: string;
  maxInitialChars?: number;
  highlightClass?: string;
  badge?: string;
}> = ({ title, content, emptyText = 'Chưa ghi nhận trong chuyên luận nguồn.', maxInitialChars = 650, highlightClass = '', badge }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!content) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">{title}</h3>
          {badge && <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">{badge}</span>}
        </div>
        <p className="text-sm text-slate-500">{emptyText}</p>
      </div>
    );
  }

  const isLong = content.length > maxInitialChars;
  const displayContent = isLong && !isExpanded ? content.slice(0, maxInitialChars) + '...' : content;
  const bullets = parseClinicalBullets(displayContent);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">{title}</h3>
          {badge && <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">{badge}</span>}
        </div>
        {isLong && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-indigo-700 hover:text-indigo-900 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            {isExpanded ? (
              <><span>Thu gọn</span><ChevronUp className="w-3.5 h-3.5" /></>
            ) : (
              <><span>Xem toàn văn ({content.length.toLocaleString()} ký tự)</span><ChevronDown className="w-3.5 h-3.5" /></>
            )}
          </button>
        )}
      </div>
      <div className={`space-y-1.5 text-sm text-slate-800 leading-relaxed ${highlightClass}`}>
        {bullets.map((b, idx) => (
          <div key={idx} className={b.isImportant ? 'text-amber-950 font-medium' : ''}>
            {b.label && <span className="font-semibold text-slate-900 mr-1.5">{b.label}:</span>}
            <span>{stripLeadingBullets(b.content)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const DavDrugDetailModal: React.FC<DavDrugDetailModalProps> = ({
  isOpen, onClose, batch, drug,
}) => {
  useModalDismiss(isOpen, onClose);

  const itemName = batch?.itemName || drug?.brandName || 'Chưa đặt tên';
  const sdk = batch?.registrationNumber || batch?.nationalCode || drug?.nationalCode || 'Chưa cập nhật';
  const activeInn = batch?.activeIngredient || drug?.activeIngredient || 'Theo hồ sơ Cục QLD';
  const strength = batch?.concentration || drug?.concentration;
  const davPortalUrl = `https://dichvucong.dav.gov.vn/congbothuoc/index?search=${encodeURIComponent(sdk)}`;

  // Đồng bộ tức thời: Khởi tạo dữ liệu thuốc ngay từ dòng được bấm (0ms - Triệt tiêu hoàn toàn loading skeleton)
  const initialCached = getCachedDrugDetail(sdk);
  const fallbackFromBatch = batch ? {
    id: batch.id,
    national_code: batch.registrationNumber || batch.nationalCode,
    nationalCode: batch.registrationNumber || batch.nationalCode,
    brand_name: batch.itemName,
    brandName: batch.itemName,
    active_ingredient: batch.activeIngredient,
    activeIngredient: batch.activeIngredient,
    dosage_form: batch.dosageForm,
    dosageForm: batch.dosageForm,
    concentration: batch.concentration,
    packaging_spec: batch.packagingSpec,
    packagingSpec: batch.packagingSpec,
    standard_pharmacopeia: batch.standardPharmacopeia,
    standardPharmacopeia: batch.standardPharmacopeia,
    shelf_life: batch.shelfLife,
    shelfLife: batch.shelfLife,
    route: batch.route,
    group: batch.category,
    manufacturer: batch.manufacturer,
    country: batch.country,
    applicant_name: batch.applicantName,
    approval_decision: batch.approvalDecision,
    hdsd_path: batch.hdsdPath,
    label_path: batch.labelPath,
    is_controlled: batch.isControlledSubstance,
  } : null;

  const initialHasFull = Boolean(
    (initialCached && (initialCached.pharmacodynamics || initialCached.indications || initialCached.clinical_monograph_id)) ||
    (drug && (drug.pharmacodynamics || drug.indications || drug.clinical_monograph_id))
  );

  const [currentSdk, setCurrentSdk] = useState(sdk);
  const [liveDrug, setLiveDrug] = useState<any>(initialCached || drug || fallbackFromBatch);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(() => !initialHasFull && sdk !== 'Chưa cập nhật' && isOpen);
  const [activeTab, setActiveTab] = useState<DrugDetailTab>('overview');

  // Khắc phục triệt để lỗi flash dữ liệu cũ: Khởi tạo ngay lập tức dữ liệu thuốc mới trong render phase (0ms)
  if (currentSdk !== sdk) {
    setCurrentSdk(sdk);
    const cached = getCachedDrugDetail(sdk);
    setLiveDrug(cached || drug || fallbackFromBatch || null);
    const hasFull = Boolean(
      (cached && (cached.pharmacodynamics || cached.indications || cached.clinical_monograph_id)) ||
      (drug && (drug.pharmacodynamics || drug.indications || drug.clinical_monograph_id))
    );
    setLoadingDetail(!hasFull && sdk !== 'Chưa cập nhật' && isOpen);
  }

  const loadDetails = (isManual = false) => {
    if (!isOpen || !sdk || sdk === 'Chưa cập nhật') {
      setLoadingDetail(false);
      return;
    }
    const cached = !isManual ? getCachedDrugDetail(sdk) : null;
    const hasFull = Boolean(cached && (cached.pharmacodynamics || cached.indications || cached.clinical_monograph_id));
    if (cached) {
      setLiveDrug(cached);
    }
    if (hasFull && !isManual) {
      setLoadingDetail(false);
      return;
    }
    setLoadingDetail(true);
    getDrugDetailApi(sdk, isManual)
      .then((res) => {
        if (res) setLiveDrug(res);
        setLoadingDetail(false);
      })
      .catch(() => {
        setLoadingDetail(false);
      });
  };

  useEffect(() => {
    if (isOpen && sdk && sdk !== 'Chưa cập nhật') {
      loadDetails(false);
    } else if (!isOpen) {
      setLiveDrug(null);
    }
  }, [isOpen, sdk]);

  useEffect(() => {
    if (isOpen) setActiveTab('overview');
  }, [isOpen, sdk]);

  if (!isOpen || (!batch && !drug)) return null;

  const c = (k: string) => liveDrug?.[k] ?? (batch as any)?.[k] ?? (drug as any)?.[k];
  const profile = getMedicationClinicalProfile(batch?.id || sdk || itemName || activeInn, (drug || batch) as any);
  const liveSource = liveDrug?.clinical_source || liveDrug?.clinicalSource;
  const hasLinkedMonograph = Boolean(
    liveDrug?.clinical_monograph_id ||
    liveDrug?.clinicalMonographId ||
    liveDrug?.pharmacodynamics ||
    liveDrug?.indications
  );
  const isVerified = Boolean(hasLinkedMonograph || (liveSource?.includes('Duoc_Thu_Quoc_Gia_Viet_Nam.pdf') && /Trang\s+\d+/.test(liveSource)))
    || (!loadingDetail && profile.isVerifiedMonograph === true);

  // TRIỆT TIÊU HOÀN TOÀN NHÁY DỮ LIỆU CŨ: Tuyệt đối không nạp fallback mock profile khi đang tải dữ liệu hoặc khi đã có dữ liệu chuyên luận thật từ máy chủ
  const allowFallback = !loadingDetail && !hasLinkedMonograph && profile.isVerifiedMonograph === true;

  let resolvedSource = c('clinical_source') || c('clinicalSource');
  if (!resolvedSource || !resolvedSource.includes('Trang')) {
    if (allowFallback && profile?.officialSource?.pdfPage) {
      resolvedSource = `${profile.officialSource.documentName}, Trang ${profile.officialSource.pdfPage} • Tệp: ${profile.officialSource.pdfDocument || 'Duoc_Thu_Quoc_Gia_Viet_Nam.pdf'}`;
    }
  }

  const adminData = {
    dosageForm: c('dosage_form') || c('dosageForm'),
    packagingSpec: c('packaging_spec') || c('packagingSpec'),
    standardPharmacopeia: c('standard_pharmacopeia') || c('standardPharmacopeia'),
    shelfLife: c('shelf_life') || c('shelfLife'),
    route: c('route'),
    category: c('group') || c('category'),
    pharmacologicalClass: batch?.pharmacologicalClass,
    atcCode: c('atc_code') || c('atcCode'),
    itemName,
    activeIngredient: activeInn,
    isControlledSubstance: liveDrug?.is_controlled ?? batch?.isControlledSubstance ?? drug?.isControlled,
    manufacturer: c('manufacturer'),
    country: c('country'),
    applicantName: c('applicant_name') || c('applicantName'),
    approvalDecision: c('approval_decision') || c('approvalDecision'),
  };

  const clinical = (key: string, camelKey?: string) =>
    (liveDrug?.[key] ?? (camelKey ? liveDrug?.[camelKey] : undefined) ?? (camelKey ? (drug as any)?.[camelKey] : undefined) ?? (drug as any)?.[key]);

  const clinicalData = {
    atcCode: clinical('atc_code', 'atcCode') || (isVerified ? (allowFallback ? profile?.atcCode : undefined) : undefined),
    drugClass: clinical('drug_class', 'drugClass') || (allowFallback ? profile?.allergyProfile?.allergyClass : undefined),
    pharmacodynamics: clinical('pharmacodynamics', 'pharmacodynamics'),
    pharmacokinetics: clinical('pharmacokinetics', 'pharmacokinetics'),
    indications: clinical('indications') || (allowFallback ? profile?.indications?.join('\n') : undefined),
    contraindications: clinical('contraindications') || (allowFallback ? profile?.contraindications?.join('\n') : undefined),
    precautions: clinical('precautions') || (allowFallback ? profile?.patientVerificationChecklist?.join('\n') : undefined),
    pregnancyWarning: clinical('pregnancy_warning', 'pregnancyWarning') || (allowFallback ? profile?.pregnancyLactation : undefined),
    lactationWarning: clinical('lactation_warning', 'lactationWarning'),
    adultDosage: clinical('adult_dosage', 'adultDosage') || (allowFallback ? profile?.standardDosing : undefined),
    pediatricDosage: clinical('pediatric_dosage', 'pediatricDosage'),
    renalAdjustment: clinical('renal_adjustment', 'renalAdjustment') || (allowFallback ? profile?.renalAdjustment : undefined),
    hepaticAdjustment: clinical('hepatic_adjustment', 'hepaticAdjustment') || (allowFallback ? profile?.hepaticAdjustment : undefined),
    adverseEffects: clinical('adverse_effects', 'adverseEffects') || (allowFallback ? profile?.adverseReactions?.join('\n') : undefined),
    adrManagement: clinical('adr_management', 'adrManagement'),
    drugInteractions: clinical('drug_interactions', 'drugInteractions') || (allowFallback ? profile?.ddiWarnings?.join('\n') : undefined),
    incompatibilities: clinical('incompatibilities', 'incompatibilities'),
    storageStability: clinical('storage_stability', 'storageStability'),
    overdoseTreatment: clinical('overdose_treatment', 'overdoseTreatment'),
    antidote: clinical('antidote') || (allowFallback ? profile?.antidote : undefined),
    clinicalSource: isVerified ? resolvedSource : (c('clinical_source') || c('clinicalSource') || `Hồ sơ cấp phép Cục Quản lý Dược (SĐK: ${sdk})`),
  };

  const dosageMetrics = extractQuickDosageMetrics(clinicalData.adultDosage);
  const pkMetrics = extractQuickPkMetrics(clinicalData.pharmacokinetics);
  const srcInfo = parseSource(clinicalData.clinicalSource);

  const tabs: [DrugDetailTab, string][] = [
    ['overview', 'Tổng quan'],
    ['safety', 'An toàn & Cảnh báo'],
    ['dosage', 'Liều & Cách dùng'],
    ['pharmacology', 'Dược lý & Dược động học'],
    ['interactions', 'Tác dụng phụ & Tương tác'],
    ['registration', 'Hồ sơ Cục QLD'],
    ...(batch ? [['hospital-batch', 'Lô kho bệnh viện'] as [DrugDetailTab, string]] : []),
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="dav-drug-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs"
    >
      <div className="bg-white rounded-none sm:rounded-xl shadow-2xl border-0 sm:border border-slate-300 w-full sm:max-w-6xl xl:max-w-7xl h-[100dvh] sm:h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-100">
        
        {/* Header Chuẩn Workstation */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded">
                SĐK: {sdk}
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-950 tracking-tight truncate">
                {itemName} {strength && <span className="text-sm font-normal text-slate-500">({strength})</span>}
              </h2>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              <span>Hoạt chất: <strong className="text-slate-800 font-semibold">{activeInn}</strong></span>
              {clinicalData.drugClass && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-600 font-medium">{clinicalData.drugClass}</span>
                </>
              )}
              {adminData.route && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-600">{adminData.route}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => loadDetails(true)}
              data-testid="drug-detail-reload-btn"
              title="Làm mới thông tin từ Cục Quản Lý Dược"
              aria-label="Làm mới thông tin"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              <RotateCw className={`w-4 h-4 ${loadingDetail ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              data-testid="btn-close-dav-detail"
              aria-label="Đóng"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thanh Tab gạch chân chuẩn Kho Dược */}
        <div role="tablist" aria-label="Nhóm thông tin chi tiết thuốc" className="flex items-center gap-1 overflow-x-auto text-sm scrollbar-none border-b border-slate-200 px-5 bg-white shrink-0">
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

        {/* Nội Dung Theo Từng Tab: Bố Cục Trái - Phải Chuẩn Y Tế (Zero-Box, Phẳng, Không Dấu Chấm) */}
        {loadingDetail && !hasLinkedMonograph ? (
          <div data-testid="dav-modal-loading-skeleton" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200 bg-white">
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 space-y-6 animate-pulse">
              <div className="space-y-3 pb-5 border-b border-slate-100">
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                <div className="h-3.5 bg-slate-100 rounded w-full"></div>
                <div className="h-3.5 bg-slate-100 rounded w-4/5"></div>
              </div>
              <div className="space-y-3 pb-5 border-b border-slate-100">
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                <div className="h-3.5 bg-slate-100 rounded w-full"></div>
                <div className="h-3.5 bg-slate-100 rounded w-5/6"></div>
                <div className="h-3.5 bg-slate-100 rounded w-2/3"></div>
              </div>
              <div className="space-y-3">
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                <div className="h-3.5 bg-slate-100 rounded w-full"></div>
                <div className="h-3.5 bg-slate-100 rounded w-3/4"></div>
              </div>
            </div>
            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 space-y-6 animate-pulse">
              <div className="space-y-3 pb-5 border-b border-slate-200">
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-8 bg-slate-200/60 rounded"></div>
                  <div className="h-8 bg-slate-200/60 rounded"></div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                <div className="space-y-2">
                  <div className="h-3.5 bg-slate-200/50 rounded w-full"></div>
                  <div className="h-3.5 bg-slate-200/50 rounded w-4/5"></div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* TAB 1: TỔNG QUAN */}
            {activeTab === 'overview' && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* Cột Trái: Lâm sàng quan trọng nhất */}
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
              {(clinicalData.contraindications || clinicalData.antidote || adminData.isControlledSubstance || drug?.isHighAlert || liveDrug?.is_high_alert) && (
                <div className="space-y-2.5 pb-5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700">
                      Cảnh Báo An Toàn &amp; Chống Chỉ Định Tuyệt Đối
                    </h3>
                    {adminData.isControlledSubstance && (
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                        KSĐB
                      </span>
                    )}
                  </div>
                  {clinicalData.contraindications && (
                    <div className="space-y-1 text-sm text-slate-900 font-medium leading-relaxed">
                      {formatContraindicationsList(clinicalData.contraindications).map((text, i) => (
                        <p key={i}>{stripLeadingBullets(text)}</p>
                      ))}
                    </div>
                  )}
                  {clinicalData.antidote && (
                    <p className="text-sm text-slate-900 pt-0.5">
                      <span className="font-semibold text-slate-700">Thuốc giải độc đặc hiệu (Antidote):</span>{' '}
                      <span className="font-bold text-slate-950">{stripLeadingBullets(clinicalData.antidote)}</span>
                    </p>
                  )}
                  {adminData.isControlledSubstance && (
                    <p className="text-xs text-rose-800 font-medium">
                      Quản lý tủ sắt 2 khóa, ký duyệt biên bản cấp phát và thu hồi vỏ ống theo Thông tư 20/2017/TT-BYT.
                    </p>
                  )}
                  {(drug?.isHighAlert || liveDrug?.is_high_alert) && (
                    <p className="text-xs text-rose-800 font-medium">
                      Thuốc nguy cơ cao (High-Alert): Kiểm tra độc lập 2 điều dưỡng trước khi đưa vào cơ thể người bệnh.
                    </p>
                  )}
                </div>
              )}

              {clinicalData.indications && (
                <div className="space-y-2 pb-5 border-b border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Chỉ Định Điều Trị Lâm Sàng
                  </h3>
                  <div className="space-y-1.5 text-sm text-slate-800 leading-relaxed">
                    {parseClinicalBullets(clinicalData.indications).map((b, idx) => (
                      <div key={idx}>
                        {b.label && <span className="font-semibold text-slate-900 mr-1.5">{b.label}:</span>}
                        <span>{stripLeadingBullets(b.content)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {clinicalData.adultDosage && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Liều Dùng &amp; Cách Dùng
                    </h3>
                    {dosageMetrics.maxDailyDose && (
                      <span className="text-xs font-semibold text-rose-700">
                        Trần liều: {dosageMetrics.maxDailyDose}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 flex-wrap text-xs text-slate-600 pb-0.5">
                    <div>
                      <span className="text-slate-400">Đường dùng: </span>
                      <strong className="text-slate-800">{adminData.route || dosageMetrics.routes.join(' · ') || 'Theo chỉ định'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Khoảng cách: </span>
                      <strong className="text-slate-800">{dosageMetrics.interval || 'Theo phác đồ'}</strong>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm text-slate-800 leading-relaxed">
                    {parseClinicalBullets(clinicalData.adultDosage).map((b, idx) => (
                      <div key={idx} className={b.isImportant ? 'text-amber-950 font-medium' : ''}>
                        {b.label && <span className="font-semibold text-slate-900 mr-1.5">{b.label}:</span>}
                        <span>{stripLeadingBullets(b.content)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cột Phải: Kho viện, Bào chế & Tài liệu */}
            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              {batch && (
                <div className="space-y-2.5 pb-5 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Lô Kho Viện</h3>
                    <span className="font-mono text-xs font-semibold text-slate-800 bg-white border border-slate-300 px-2 py-0.5 rounded">
                      Số lô: {batch.batchNumber}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-slate-500">Tồn kho hiện tại</dt>
                      <dd className="text-sm font-bold text-slate-900 font-mono tabular-nums mt-0.5">{batch.currentStock} {batch.unit}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Hạn dùng FEFO</dt>
                      <dd className={`text-sm font-bold font-mono mt-0.5 ${batch.daysLeft <= 60 ? 'text-rose-700' : 'text-slate-900'}`}>
                        {batch.expiryDate} <span className="text-2xs font-normal text-slate-500">({batch.daysLeft}d)</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Cơ số Min</dt>
                      <dd className="text-sm font-semibold text-slate-800 font-mono mt-0.5">{batch.minThreshold} {batch.unit}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Vị trí kệ</dt>
                      <dd className="text-sm font-semibold text-slate-800 mt-0.5">{batch.warehouseLocation || 'Chưa định vị'}</dd>
                    </div>
                  </dl>
                </div>
              )}

              <div className="space-y-2.5 pb-5 border-b border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Thông Tin Bào Chế &amp; Xuất Xứ
                </h3>
                <dl className="space-y-2 text-xs">
                  <div>
                    <dt className="text-slate-500">Dạng bào chế &amp; Quy cách</dt>
                    <dd className="text-sm font-medium text-slate-900 mt-0.5">
                      {adminData.dosageForm || 'Theo hồ sơ'}{adminData.packagingSpec ? ` · ${adminData.packagingSpec}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Cơ sở sản xuất &amp; Xuất xứ</dt>
                    <dd className="text-sm font-medium text-slate-900 mt-0.5">
                      {adminData.manufacturer || 'Theo hồ sơ cấp phép'} {adminData.country ? `(${adminData.country})` : ''}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Tài Liệu Gốc Cục QLD &amp; Dược Thư
                </h3>
                {srcInfo?.pdfUrl && (
                  <a
                    href={srcInfo.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-900 text-xs font-medium transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="truncate">Chuyên luận Dược Thư {srcInfo.pageStr ? `(${srcInfo.pageStr})` : ''}</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </a>
                )}
                <DavDocumentActionButtons
                  hdsdPath={batch?.hdsdPath || drug?.hdsdPath}
                  labelPath={batch?.labelPath || drug?.labelPath}
                  nationalCode={sdk}
                  brandName={itemName}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AN TOÀN & CẢNH BÁO */}
        {activeTab === 'safety' && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
              <div className="space-y-3 pb-5 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700">
                  Chống Chỉ Định Tuyệt Đối &amp; Cấm Kỵ
                </h3>
                {clinicalData.contraindications ? (
                  <div className="space-y-1.5 text-sm text-slate-900 font-medium leading-relaxed">
                    {formatContraindicationsList(clinicalData.contraindications).map((text, i) => (
                      <p key={i}>{stripLeadingBullets(text)}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Chưa ghi nhận chống chỉ định tuyệt đối trong chuyên luận nguồn.</p>
                )}
              </div>

              {(adminData.isControlledSubstance || drug?.isHighAlert || liveDrug?.is_high_alert) && (
                <div className="space-y-2 pb-5 border-b border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Quy Chế Kiểm Soát &amp; An Toàn Dùng Thuốc
                  </h3>
                  {adminData.isControlledSubstance && (
                    <p className="text-sm text-rose-800 font-medium">
                      Thuốc kiểm soát đặc biệt (KSĐB): Quản lý tủ sắt 2 khóa, ký biên bản giao nhận và thu hồi vỏ ống theo Thông tư 20/2017/TT-BYT.
                    </p>
                  )}
                  {(drug?.isHighAlert || liveDrug?.is_high_alert) && (
                    <p className="text-sm text-rose-800 font-medium">
                      Thuốc nguy cơ cao (High-Alert): Yêu cầu kiểm tra độc lập 2 điều dưỡng trước khi đưa vào cơ thể người bệnh.
                    </p>
                  )}
                </div>
              )}

              {clinicalData.antidote && (
                <div className="space-y-1 pb-5 border-b border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Thuốc Giải Độc Đặc Hiệu (Antidote) &amp; Xử Trí
                  </h3>
                  <p className="text-sm font-bold text-slate-950">
                    {stripLeadingBullets(clinicalData.antidote)}
                  </p>
                </div>
              )}

              {clinicalData.overdoseTreatment && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Triệu Chứng Quá Liều &amp; Xử Trí Cấp Cứu
                  </h3>
                  <div className="space-y-1 text-sm text-slate-800 leading-relaxed">
                    {parseClinicalBullets(clinicalData.overdoseTreatment).map((b, idx) => (
                      <div key={idx}>
                        {b.label && <span className="font-semibold text-slate-900 mr-1.5">{b.label}:</span>}
                        <span>{stripLeadingBullets(b.content)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              {clinicalData.precautions && (
                <div className="space-y-2 pb-5 border-b border-slate-200">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Thận Trọng Đặc Biệt
                  </h3>
                  <div className="space-y-1 text-xs sm:text-sm text-slate-800 leading-relaxed">
                    {parseClinicalBullets(clinicalData.precautions).map((b, idx) => (
                      <div key={idx}>
                        {b.label && <span className="font-semibold text-slate-900 mr-1.5">{b.label}:</span>}
                        <span>{stripLeadingBullets(b.content)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {clinicalData.pregnancyWarning && (
                <div className="space-y-2 pb-5 border-b border-slate-200">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Thời Kỳ Mang Thai
                  </h3>
                  <div className="space-y-1 text-xs sm:text-sm text-slate-800 leading-relaxed">
                    {parseClinicalBullets(clinicalData.pregnancyWarning).map((b, idx) => (
                      <div key={idx}>
                        {b.label && <span className="font-semibold text-slate-900 mr-1.5">{b.label}:</span>}
                        <span>{stripLeadingBullets(b.content)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(clinicalData.lactationWarning || (clinicalData.pregnancyWarning && clinicalData.pregnancyWarning.toLowerCase().includes('cho con bú'))) && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Thời Kỳ Cho Con Bú
                  </h3>
                  <div className="space-y-1 text-xs sm:text-sm text-slate-800 leading-relaxed">
                    {parseClinicalBullets(clinicalData.lactationWarning || 'Tham khảo kỹ khuyến cáo thận trọng trong mục thời kỳ mang thai và cho con bú.').map((b, idx) => (
                      <div key={idx}>
                        {b.label && <span className="font-semibold text-slate-900 mr-1.5">{b.label}:</span>}
                        <span>{stripLeadingBullets(b.content)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: LIỀU & CÁCH DÙNG */}
        {activeTab === 'dosage' && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
              <div className="space-y-3 pb-5 border-b border-slate-100">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Liều Dùng Người Lớn &amp; Đường Dùng
                  </h3>
                  {dosageMetrics.maxDailyDose && (
                    <span className="text-xs font-semibold text-rose-700">
                      Trần liều: {dosageMetrics.maxDailyDose}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 flex-wrap text-xs text-slate-600 pb-1">
                  <div>
                    <span className="text-slate-400">Đường dùng: </span>
                    <strong className="text-slate-800">{adminData.route || dosageMetrics.routes.join(' · ') || 'Theo chỉ định'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Khoảng cách: </span>
                    <strong className="text-slate-800">{dosageMetrics.interval || 'Theo phác đồ'}</strong>
                  </div>
                  {dosageMetrics.specialWarning && (
                    <div>
                      <span className="text-slate-400">Lưu ý: </span>
                      <strong className="text-slate-800">{dosageMetrics.specialWarning}</strong>
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm text-slate-800 leading-relaxed">
                  {parseClinicalBullets(clinicalData.adultDosage).map((b, idx) => (
                    <div key={idx} className={b.isImportant ? 'text-amber-950 font-medium' : ''}>
                      {b.label && <span className="font-semibold text-slate-900 mr-1.5">{b.label}:</span>}
                      <span>{stripLeadingBullets(b.content)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {clinicalData.pediatricDosage && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Liều Dùng Nhi Khoa
                  </h3>
                  <div className="space-y-1.5 text-sm text-slate-800 leading-relaxed">
                    {parseClinicalBullets(clinicalData.pediatricDosage).map((b, idx) => (
                      <div key={idx}>
                        {b.label && <span className="font-semibold text-slate-900 mr-1.5">{b.label}:</span>}
                        <span>{stripLeadingBullets(b.content)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              {(clinicalData.renalAdjustment || clinicalData.hepaticAdjustment) && (
                <div className="space-y-3 pb-5 border-b border-slate-200">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Hiệu Chỉnh Liều Đặc Biệt
                  </h3>
                  {clinicalData.renalAdjustment && (
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-slate-600 block">Suy thận (ClCr / eGFR):</span>
                      <div className="space-y-1 text-xs sm:text-sm text-slate-800 leading-relaxed">
                        {parseClinicalBullets(clinicalData.renalAdjustment).map((b, idx) => (
                          <div key={idx}>
                            {b.label && <span className="font-semibold text-slate-900 mr-1.5">{b.label}:</span>}
                            <span>{stripLeadingBullets(b.content)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {clinicalData.hepaticAdjustment && (
                    <div className="space-y-1 pt-1">
                      <span className="text-xs font-semibold text-slate-600 block">Suy gan:</span>
                      <div className="space-y-1 text-xs sm:text-sm text-slate-800 leading-relaxed">
                        {parseClinicalBullets(clinicalData.hepaticAdjustment).map((b, idx) => (
                          <div key={idx}>
                            {b.label && <span className="font-semibold text-slate-900 mr-1.5">{b.label}:</span>}
                            <span>{stripLeadingBullets(b.content)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Phân Loại Dược Lý &amp; ATC
                </h3>
                <dl className="space-y-2 text-xs">
                  <div>
                    <dt className="text-slate-500">Nhóm Dược lý</dt>
                    <dd className="text-sm font-medium text-slate-900 mt-0.5">{clinicalData.drugClass || adminData.category || 'Thuốc điều trị'}</dd>
                  </div>
                  {adminData.atcCode && (
                    <div>
                      <dt className="text-slate-500">Mã ATC</dt>
                      <dd className="text-sm font-mono font-bold text-slate-900 mt-0.5">{adminData.atcCode}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DƯỢC LÝ & DƯỢC ĐỘNG HỌC (TAB MỚI) */}
        {activeTab === 'pharmacology' && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-6 bg-white">
              <div className="pb-5 border-b border-slate-100">
                <ClinicalExpandableBlock
                  title="Dược Lực Học &amp; Cơ Chế Tác Dụng"
                  content={clinicalData.pharmacodynamics}
                  emptyText="Chưa ghi nhận nội dung dược lực học chi tiết trong Dược thư. Vui lòng tham khảo Tờ hướng dẫn sử dụng (HDSD) của Cục Quản Lý Dược."
                  badge={adminData.atcCode ? `ATC: ${adminData.atcCode}` : undefined}
                />
              </div>

              <div>
                <ClinicalExpandableBlock
                  title="Dược Động Học Lâm Sàng (ADME)"
                  content={clinicalData.pharmacokinetics}
                  emptyText="Chưa ghi nhận thông số dược động học chi tiết trong chuyên luận Dược thư nguồn."
                />
              </div>
            </div>

            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              <div className="space-y-3 pb-5 border-b border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Thông Số Dược Động Học Chính
                </h3>
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-slate-500">Bán thải (t½)</dt>
                    <dd className="text-sm font-semibold text-slate-900 mt-0.5">
                      {pkMetrics?.tHalf || 'Theo chuyển hóa'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Sinh khả dụng (F)</dt>
                    <dd className="text-sm font-semibold text-slate-900 mt-0.5">
                      {pkMetrics?.bioavailability || (dosageMetrics.routes.includes('Tiêm tĩnh mạch') || dosageMetrics.routes.includes('Truyền tĩnh mạch') ? '100% (IV)' : 'Theo đường dùng')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Gắn Protein</dt>
                    <dd className="text-sm font-semibold text-slate-900 mt-0.5">
                      {pkMetrics?.proteinBinding || 'Theo phân bố mô'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Nồng độ đỉnh (Cmax)</dt>
                    <dd className="text-sm font-semibold text-slate-900 mt-0.5">
                      {pkMetrics?.cmax || 'Theo liều chỉ định'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-2 pb-5 border-b border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Phân Loại Dược Lý &amp; ATC
                </h3>
                <dl className="space-y-2 text-xs">
                  <div>
                    <dt className="text-slate-500">Nhóm Tác Dụng</dt>
                    <dd className="text-sm font-medium text-slate-900 mt-0.5">
                      {clinicalData.drugClass || adminData.category || 'Thuốc điều trị chuyên khoa'}
                    </dd>
                  </div>
                  {adminData.atcCode && (
                    <div>
                      <dt className="text-slate-500">Mã ATC Quốc Tế</dt>
                      <dd className="text-sm font-mono font-bold text-slate-900 mt-0.5">{adminData.atcCode}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Tài Liệu Gốc Dược Thư &amp; Cục QLD
                </h3>
                {srcInfo?.pdfUrl && (
                  <a
                    href={srcInfo.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-900 text-xs font-medium transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="truncate">Chuyên luận Dược Thư {srcInfo.pageStr ? `(${srcInfo.pageStr})` : ''}</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </a>
                )}
                <DavDocumentActionButtons
                  hdsdPath={batch?.hdsdPath || drug?.hdsdPath}
                  labelPath={batch?.labelPath || drug?.labelPath}
                  nationalCode={sdk}
                  brandName={itemName}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: TÁC DỤNG PHỤ & TƯƠNG TÁC */}
        {activeTab === 'interactions' && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-6 bg-white">
              <div className="pb-5 border-b border-slate-100">
                <ClinicalExpandableBlock
                  title="Tác Dụng Không Mong Muốn (ADR)"
                  content={clinicalData.adverseEffects}
                  emptyText="Chưa ghi nhận ADR phổ biến trong chuyên luận nguồn."
                />
              </div>

              {clinicalData.adrManagement && (
                <div className="pb-5 border-b border-slate-100">
                  <ClinicalExpandableBlock
                    title="Hướng Dẫn Xử Trí Tác Dụng Phụ (ADR Management)"
                    content={clinicalData.adrManagement}
                    emptyText="Khi xảy ra ADR nghiêm trọng: Ngừng thuốc ngay lập tức và tiến hành điều trị hỗ trợ nâng đỡ triệu chứng."
                    highlightClass="text-slate-900 font-medium"
                  />
                </div>
              )}

              {clinicalData.incompatibilities && (
                <div className="pb-5 border-b border-slate-100">
                  <ClinicalExpandableBlock
                    title="Tương Kỵ &amp; Dung Môi Pha Tiêm Truyền"
                    content={clinicalData.incompatibilities}
                    emptyText="Chưa ghi nhận tương kỵ kết tủa nghiêm trọng với dung môi thông thường."
                  />
                </div>
              )}

              {clinicalData.overdoseTreatment && (
                <div>
                  <ClinicalExpandableBlock
                    title="Xử Trí Quá Liều Cấp Cứu"
                    content={clinicalData.overdoseTreatment}
                    emptyText="Chưa ghi nhận báo cáo quá liều đặc hiệu."
                  />
                </div>
              )}
            </div>

            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              <div className="pb-5 border-b border-slate-200">
                <ClinicalExpandableBlock
                  title="Tương Tác Thuốc Theo Chuyên Luận (DDI)"
                  content={clinicalData.drugInteractions}
                  emptyText="Chưa ghi nhận tương tác thuốc nghiêm trọng trong chuyên luận."
                />
              </div>

              {clinicalData.storageStability && (
                <div>
                  <ClinicalExpandableBlock
                    title="Độ Ổn Định &amp; Điều Kiện Bảo Quản"
                    content={clinicalData.storageStability}
                    emptyText="Bảo quản ở nhiệt độ phòng 15 - 30°C, tránh ánh sáng trực tiếp và tránh ẩm."
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: HỒ SƠ CỤC QLD */}
        {activeTab === 'registration' && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
              {!isVerified && (
                <div className="p-3.5 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Info className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Thuốc Lưu Hành Theo Hồ Sơ Cục Quản Lý Dược (SĐK: {sdk})</span>
                  </div>
                  <p className="text-amber-800 leading-relaxed">
                    Sản phẩm thuộc nhóm dược liệu, thuốc cổ truyền hoặc thuốc mới chưa có chuyên luận riêng trong Dược Thư Quốc Gia 2015. Toàn văn công dụng, chỉ định và mẫu nhãn đã được số hóa sẵn sàng trong cột tài liệu bên cạnh.
                  </p>
                </div>
              )}

              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Thông Tin Hành Chính &amp; Giấy Phép Lưu Hành
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <dt className="text-slate-500">Số Đăng Ký (SĐK)</dt>
                  <dd className="text-sm font-sans tabular-nums font-bold text-slate-900 mt-0.5">{sdk}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Quyết định cấp phép</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5">{adminData.approvalDecision || 'Theo hồ sơ Cục QLD'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Dạng bào chế &amp; Quy cách</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5">{adminData.dosageForm || '—'} {adminData.packagingSpec ? `· ${adminData.packagingSpec}` : ''}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Đường dùng chuẩn</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5">{adminData.route || 'Theo hồ sơ công bố'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Tiêu chuẩn Dược điển</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5">{adminData.standardPharmacopeia || 'Theo NSX / Dược điển'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Hạn lưu hành</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5">{adminData.shelfLife || 'Theo hồ sơ công bố'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Cơ sở sản xuất</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5">{adminData.manufacturer || 'Theo hồ sơ cấp phép'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Quốc gia xuất xứ</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5">{adminData.country || 'Việt Nam'}</dd>
                </div>
              </dl>
            </div>

            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Tài Liệu Gốc Cục QLD &amp; Dược Thư
                </h3>
                {srcInfo?.pdfUrl && (
                  <a
                    href={srcInfo.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-900 text-xs font-medium transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="truncate">Chuyên luận Dược Thư {srcInfo.pageStr ? `(${srcInfo.pageStr})` : ''}</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </a>
                )}
                <DavDocumentActionButtons
                  hdsdPath={batch?.hdsdPath || drug?.hdsdPath}
                  labelPath={batch?.labelPath || drug?.labelPath}
                  nationalCode={sdk}
                  brandName={itemName}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: LÔ THUỐC BỆNH VIỆN */}
        {activeTab === 'hospital-batch' && batch && (
          <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Thông Tin Lô Thuốc Bệnh Viện</h3>
                <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded">
                  Lô: {batch.batchNumber}
                </span>
              </div>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <dt className="text-slate-500">Tồn kho hiện tại</dt>
                  <dd className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">{batch.currentStock} {batch.unit}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Hạn dùng FEFO</dt>
                  <dd className={`text-base font-bold font-mono mt-0.5 ${batch.daysLeft <= 60 ? 'text-rose-700' : 'text-slate-900'}`}>
                    {batch.expiryDate} <span className="text-xs font-normal text-slate-500">({batch.daysLeft}d)</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Ngưỡng cơ số Min</dt>
                  <dd className="text-base font-semibold text-slate-800 font-mono mt-0.5">{batch.minThreshold} {batch.unit}</dd>
                </div>
              </dl>
            </div>

            <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Lưu Kho &amp; Quy Chế Cấp Phát</h3>
              <dl className="space-y-2 text-xs">
                <div>
                  <dt className="text-slate-500">Vị trí kệ / ô lưu kho</dt>
                  <dd className="text-sm font-semibold text-slate-900 mt-0.5">{batch.warehouseLocation || 'Chưa phân ô'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Nguyên tắc xuất kho</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-0.5">FEFO (First-Expired, First-Out)</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
          </>
        )}

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <a
            href={davPortalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-950 underline-offset-2 hover:underline"
          >
            <span>Đối soát trực tiếp Cổng Cục Quản Lý Dược (SĐK: {sdk})</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
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
  );
};
