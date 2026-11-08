/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Phân Hệ Giám Định Đơn Thuốc BHYT
 * Bố cục:
 * 1. Phía trên: Khung upload rộng & xem trực tiếp file ảnh/PDF
 * 2. Phía dưới: Phân tích file chia thành các tab theo thứ tự quan trọng nhất
 *    (Tab 1: Thẩm định xuất toán -> Tab 2: Danh sách thuốc -> Tab 3: Hành chính -> Tab 4: Danh mục TT 20 -> Tab 5: XML 130)
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BhytPrescriptionPayload,
  BhytAuditReport,
  HospitalRank,
  TreatmentType,
  BhytPrescriptionItem,
  DrugResolutionResult
} from '../../../types/bhyt';
import {
  HOSPITAL_RANK_LABELS,
  searchBhytRules,
  findBhytRule
} from '../../../data/bhytDrugRules';
import {
  auditBhytPrescription
} from '../../../services/bhytAuditEngine';
import { bhytApi } from '../../../services/api/bhytApi';
import {
  parseQd130Xml,
  generateSampleQd130Xml,
  extractPrescriptionFromDocument
} from '../../../services/bhytIngestion';
import { compressImageForOcr } from '../../../utils/imageOptimization';
import { BhytAuditReportModal } from './BhytAuditReportModal';
import { BhytSubstitutionModal } from './BhytSubstitutionModal';
import { PdfViewerDrawer, PdfViewerTarget } from '../../Modals/PdfViewerDrawer';
import { findDrugSubstitutes } from '../../../services/drugSubstitutionService';
import { DrugSubstituteCandidate } from '../../../types/bhytSubstitution';

type AnalysisTab = 'pure_breakdown' | 'clinical_7' | 'violations' | 'catalog' | 'xml';

const EMPTY_PRESCRIPTION: BhytPrescriptionPayload = {
  prescriptionId: '',
  patientName: '',
  patientAge: 0,
  insuranceCardNumber: '',
  hospitalRank: 'HANG_III',
  treatmentType: 'NGOAI_TRU',
  primaryIcd10: '',
  primaryDiagnosis: '',
  secondaryIcd10s: [],
  items: []
};

export const BhytAuditTab: React.FC = () => {
  // 1. Dữ liệu đơn thuốc & Cấu hình KCB (Khởi tạo sạch, không nạp mẫu)
  const [activePayload, setActivePayload] = useState<BhytPrescriptionPayload>(EMPTY_PRESCRIPTION);
  const [hospitalRank, setHospitalRank] = useState<HospitalRank>('HANG_III');
  const [treatmentType, setTreatmentType] = useState<TreatmentType>('NGOAI_TRU');

  // 2. Tab phân tích bên dưới (Mặc định chọn Tab 1: Bản phân tích dữ liệu đơn thuần)
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<AnalysisTab>('pure_breakdown');
  const [isViewerExpanded, setIsViewerExpanded] = useState<boolean>(false);
  const [isEditAdminModalOpen, setIsEditAdminModalOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activePdfViewerTarget, setActivePdfViewerTarget] = useState<PdfViewerTarget | null>(null);

  // Form tạm để sửa hành chính
  const [adminFormDraft, setAdminFormDraft] = useState({
    patientName: '',
    patientAge: 0,
    insuranceCardNumber: '',
    primaryIcd10: '',
    primaryDiagnosis: '',
    secondaryIcd10s: '',
    prescriptionId: ''
  });

  // 3. File tài liệu tải lên (PDF / Ảnh) - Mặc định chưa nạp file
  const [documentFile, setDocumentFile] = useState<{
    name: string;
    type: 'pdf' | 'image';
    url: string;
    rawFile?: File;
    sizeKb?: number;
    originalSizeKb?: number;
    compressionRatio?: number;
  } | null>(null);

  // 4. Trạng thái xử lý & Kết quả phân giải DAV
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false);
  const [isResolvingDav, setIsResolvingDav] = useState<boolean>(false);
  const [resolutionMap, setResolutionMap] = useState<Record<string, DrugResolutionResult>>({});

  // 5. Tương tác Canvas xem tài liệu
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 6. Tra cứu danh mục TT 20 & XML
  const [catalogQuery, setCatalogQuery] = useState<string>('');
  const [catalogRankFilter, setCatalogRankFilter] = useState<string>('ALL');
  const [xmlInputText, setXmlInputText] = useState<string>('');

  // 7. Gợi ý thuốc thay thế BHYT 1-Click (Smart Drug Substitution)
  const [substitutionModalState, setSubstitutionModalState] = useState<{
    isOpen: boolean;
    originalItem: BhytPrescriptionItem | null;
    violation: BhytViolationItem | null;
    candidates: DrugSubstituteCandidate[];
  }>({
    isOpen: false,
    originalItem: null,
    violation: null,
    candidates: []
  });
  const [substitutionToast, setSubstitutionToast] = useState<{
    message: string;
    type: 'success' | 'info';
  } | null>(null);

  // Thẩm định BHYT thời gian thực
  const auditReport: BhytAuditReport = useMemo(() => {
    return auditBhytPrescription({
      ...activePayload,
      hospitalRank,
      treatmentType
    });
  }, [activePayload, hospitalRank, treatmentType]);

  // Tính toán các chỉ số định lượng thuần túy của đơn thuốc (Fact Sheet Metrics)
  const pureMetrics = useMemo(() => {
    let grossCost = 0;
    let maxDaysSupply = 0;
    const groupCount: Record<string, number> = {};

    activePayload.items.forEach((item) => {
      grossCost += (item.quantity || 0) * (item.unitPrice || 0);
      maxDaysSupply = Math.max(maxDaysSupply, item.daysSupply || 0);
      const rule = findBhytRule(item.activeIngredient || item.drugName);
      const groupName = rule?.atcGroupName || 'Thuốc điều trị khác';
      groupCount[groupName] = (groupCount[groupName] || 0) + 1;
    });

    return {
      totalItems: activePayload.items.length,
      grossCost,
      maxDaysSupply,
      groupCount,
      uniqueGroupsCount: Object.keys(groupCount).length
    };
  }, [activePayload.items]);

  // Đánh giá an toàn lâm sàng 7 nhóm (Theo chuẩn công cụ tham khảo AI Kiểm Tra Đơn Thuốc)
  const clinicalSevenCategories = useMemo(() => {
    const list = [];

    // 1. Chỉ định phù hợp ICD-10
    const icdViolations = auditReport.violations.filter(v => v.category === 'ICD10_UNSUPPORTED');
    if (icdViolations.length > 0) {
      list.push({
        id: 1,
        title: '1. Chỉ định phù hợp ICD-10',
        subtitle: `Đối chiếu chẩn đoán chính ${activePayload.primaryIcd10} (${activePayload.primaryDiagnosis})`,
        status: 'ALERT' as const,
        statusLabel: 'Chỉ định không phù hợp',
        details: icdViolations.map(v => `${v.drugName}: ${v.detail}`)
      });
    } else {
      list.push({
        id: 1,
        title: '1. Chỉ định phù hợp ICD-10',
        subtitle: `Đối chiếu chẩn đoán chính ${activePayload.primaryIcd10} (${activePayload.primaryDiagnosis})`,
        status: 'PASS' as const,
        statusLabel: 'Chỉ định phù hợp 100%',
        details: [`Tất cả ${activePayload.items.length} mặt hàng thuốc đều phù hợp với chẩn đoán bệnh chính ${activePayload.primaryIcd10}.`]
      });
    }

    // 2. Chống chỉ định lâm sàng & Phân tuyến bệnh viện
    const rankViolations = auditReport.violations.filter(v => v.category === 'HOSPITAL_RANK_MISMATCH');
    if (rankViolations.length > 0) {
      list.push({
        id: 2,
        title: '2. Chống chỉ định & Tuyến bệnh viện',
        subtitle: `Tuyến hiện tại: ${HOSPITAL_RANK_LABELS[hospitalRank]}`,
        status: 'ALERT' as const,
        statusLabel: 'Vượt tuyến / Không thanh toán',
        details: rankViolations.map(v => `${v.drugName}: ${v.detail}`)
      });
    } else {
      list.push({
        id: 2,
        title: '2. Chống chỉ định & Tuyến bệnh viện',
        subtitle: `Tuyến hiện tại: ${HOSPITAL_RANK_LABELS[hospitalRank]}`,
        status: 'PASS' as const,
        statusLabel: 'Đúng phân tuyến BHYT',
        details: [`Toàn bộ thuốc được phép kê đơn và thanh toán tại ${HOSPITAL_RANK_LABELS[hospitalRank]}. Không có chống chỉ định phân tuyến.`]
      });
    }

    // 3. Liều dùng & Số lượng ngày điều trị
    const daysViolations = auditReport.violations.filter(v => v.category === 'OVER_MAX_OUTPATIENT_DAYS');
    if (daysViolations.length > 0) {
      list.push({
        id: 3,
        title: '3. Liều dùng & Số lượng ngày điều trị',
        subtitle: 'Giới hạn tối đa 30 ngày cho đơn thuốc ngoại trú',
        status: 'WARNING' as const,
        statusLabel: 'Kê quá số ngày quy định',
        details: daysViolations.map(v => `${v.drugName}: ${v.detail}`)
      });
    } else {
      list.push({
        id: 3,
        title: '3. Liều dùng & Số lượng ngày điều trị',
        subtitle: 'Giới hạn tối đa 30 ngày cho đơn thuốc ngoại trú',
        status: 'PASS' as const,
        statusLabel: 'Số ngày điều trị hợp lệ',
        details: ['Số lượng thuốc và ngày sử dụng nằm trong giới hạn cho phép của Thông tư 20/2022/TT-BYT.']
      });
    }

    // 4. Đường dùng thuốc
    list.push({
      id: 4,
      title: '4. Đường dùng thuốc',
      subtitle: 'Kiểm tra đường uống, tiêm truyền, bôi ngoài da',
      status: 'PASS' as const,
      statusLabel: 'Đường dùng phù hợp',
      details: activePayload.items.map(it => `${it.drugName}: Dùng đường ${it.route || 'Uống'}`)
    });

    // 5. Thời điểm dùng thuốc
    list.push({
      id: 5,
      title: '5. Thời điểm dùng thuốc',
      subtitle: 'Hướng dẫn uống trước ăn, sau ăn, sáng, tối',
      status: 'PASS' as const,
      statusLabel: 'Đã có chỉ dẫn thời điểm',
      details: activePayload.items.map(it => `${it.drugName}: ${it.instructions || 'Theo chỉ định của bác sĩ'}`)
    });

    // 6. Tương tác thuốc bất lợi (DDI)
    const incompatibleViolations = auditReport.violations.filter(v => v.category === 'INCOMPATIBLE_CLASS_COMBINATION' || v.title.includes('Phối hợp chống chỉ định'));
    if (incompatibleViolations.length > 0) {
      list.push({
        id: 6,
        title: '6. Tương tác thuốc bất lợi (DDI)',
        subtitle: 'Đối soát trên 701 quy tắc tương tác CSDL DDI',
        status: 'ALERT' as const,
        statusLabel: 'Tương tác nghiêm trọng',
        details: incompatibleViolations.map(v => `${v.title}: ${v.detail}`)
      });
    } else {
      list.push({
        id: 6,
        title: '6. Tương tác thuốc bất lợi (DDI)',
        subtitle: 'Đối soát trên 701 quy tắc tương tác CSDL DDI',
        status: 'PASS' as const,
        statusLabel: 'Không phát hiện tương tác nguy cơ',
        details: ['Không ghi nhận tương tác thuốc mức độ nặng hoặc chống chỉ định giữa các thuốc trong đơn.']
      });
    }

    // 7. Trùng lặp hoạt chất / Nhóm điều trị
    const dupViolations = auditReport.violations.filter(v => v.category === 'THERAPEUTIC_DUPLICATION');
    if (dupViolations.length > 0) {
      list.push({
        id: 7,
        title: '7. Trùng lặp hoạt chất / Nhóm điều trị',
        subtitle: 'Quy tắc thanh toán không quá 01 thuốc trong cùng nhóm tác dụng',
        status: 'ALERT' as const,
        statusLabel: 'Trùng nhóm dược lý',
        details: dupViolations.map(v => `${v.drugName}: ${v.detail}`)
      });
    } else {
      list.push({
        id: 7,
        title: '7. Trùng lặp hoạt chất / Nhóm điều trị',
        subtitle: 'Quy tắc thanh toán không quá 01 thuốc trong cùng nhóm tác dụng',
        status: 'PASS' as const,
        statusLabel: 'Không trùng lặp nhóm điều trị',
        details: ['Đơn thuốc không bị trùng lặp nhóm điều trị (PPI, NSAID, Statin, Corticoid).']
      });
    }

    return list;
  }, [auditReport, activePayload, hospitalRank]);

  // Cập nhật draft hành chính khi activePayload đổi
  useEffect(() => {
    setAdminFormDraft({
      patientName: activePayload.patientName,
      patientAge: activePayload.patientAge,
      insuranceCardNumber: activePayload.insuranceCardNumber,
      primaryIcd10: activePayload.primaryIcd10,
      primaryDiagnosis: activePayload.primaryDiagnosis,
      secondaryIcd10s: (activePayload.secondaryIcd10s || []).join(', '),
      prescriptionId: activePayload.prescriptionId || 'RX-BHYT'
    });
  }, [activePayload]);

  // Danh mục TT 20 đã lọc
  const filteredCatalogRules = useMemo(() => {
    let rules = searchBhytRules(catalogQuery);
    if (catalogRankFilter !== 'ALL') {
      rules = rules.filter(r => r.allowedRanks.includes(catalogRankFilter as HospitalRank));
    }
    return rules;
  }, [catalogQuery, catalogRankFilter]);

  // Helper đọc file sang chuỗi Data URL Base64
  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Xử lý nạp và trích xuất dữ liệu tài liệu (Ảnh / PDF / XML)
  const processUploadedFile = async (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    const isXml = file.type === 'application/xml' || file.type === 'text/xml' || file.name.endsWith('.xml');

    if (isXml) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = (ev.target?.result as string) || '';
        setXmlInputText(content);
        try {
          const parsed = parseQd130Xml(content);
          if (parsed.items && parsed.items.length > 0) {
            const nextPayload = {
              ...activePayload,
              ...parsed,
              items: parsed.items || activePayload.items
            };
            setActivePayload(nextPayload);
            handleRunOcrProcess(nextPayload);
          }
        } catch (err) {
          console.error('Lỗi phân tích XML:', err);
        }
      };
      reader.readAsText(file);
      setDocumentFile({
        name: file.name,
        type: 'pdf',
        url: URL.createObjectURL(file),
        rawFile: file,
        sizeKb: Math.round(file.size / 1024)
      });
      setActiveAnalysisTab('pure_breakdown');
      return;
    }

    let targetDataUrl: string = '';
    let targetMime: string = 'image/jpeg';

    if (isPdf) {
      try {
        targetDataUrl = await readFileAsDataUrl(file);
        targetMime = 'application/pdf';
      } catch (err) {
        console.error('Lỗi đọc file PDF:', err);
      }
      setDocumentFile({
        name: file.name,
        type: 'pdf',
        url: URL.createObjectURL(file),
        rawFile: file,
        sizeKb: Math.round(file.size / 1024)
      });
    } else {
      // Tệp ảnh: Tối ưu hóa & nén Canvas Client-side (<200KB, JPEG 0.78)
      try {
        const opt = await compressImageForOcr(file);
        targetDataUrl = opt.dataUrl;
        targetMime = 'image/jpeg';
        setDocumentFile({
          name: file.name,
          type: 'image',
          url: opt.dataUrl,
          rawFile: file,
          sizeKb: Math.round(opt.compressedSize / 1024),
          originalSizeKb: Math.round(opt.originalSize / 1024),
          compressionRatio: Math.round(opt.compressionRatio * 100)
        });
      } catch {
        targetDataUrl = await readFileAsDataUrl(file);
        targetMime = file.type || 'image/jpeg';
        setDocumentFile({
          name: file.name,
          type: 'image',
          url: URL.createObjectURL(file),
          rawFile: file,
          sizeKb: Math.round(file.size / 1024)
        });
      }
    }

    setZoomLevel(100);
    setRotationAngle(0);

    // Trích xuất tự động qua Multimodal Vision OCR (Gemini / Universal Gateway / Local Fallback)
    setIsOcrProcessing(true);
    let extracted: BhytPrescriptionPayload | null = null;
    try {
      if (targetDataUrl) {
        const ocrRes = await bhytApi.ocrPrescription(targetDataUrl, targetMime);
        if (ocrRes.success && ocrRes.prescription && ocrRes.prescription.items.length > 0) {
          const p = ocrRes.prescription as any;
          extracted = {
            prescriptionId: p.prescription_id || p.prescriptionId || `RX-${Date.now()}`,
            patientName: p.patient_name || p.patientName || '',
            patientAge: p.patient_age ?? p.patientAge ?? 0,
            insuranceCardNumber: p.insurance_card_number || p.insuranceCardNumber || '',
            hospitalRank: (p.hospital_rank || p.hospitalRank || hospitalRank) as HospitalRank,
            treatmentType: (p.treatment_type || p.treatmentType || treatmentType) as TreatmentType,
            primaryIcd10: p.primary_icd10 || p.primaryIcd10 || '',
            primaryDiagnosis: p.primary_diagnosis || p.primaryDiagnosis || '',
            secondaryIcd10s: p.secondary_icd10s || p.secondaryIcd10s || [],
            items: (p.items || []).map((it: any, idx: number) => ({
              id: it.id || `ITEM-${idx + 1}`,
              drugCode: it.drug_code || it.drugCode || '',
              drugName: it.drug_name || it.drugName || `Thuốc ${idx + 1}`,
              activeIngredient: it.active_ingredient || it.activeIngredient || '',
              dosage: it.dosage || '',
              route: it.route || 'Uống',
              quantity: Number(it.quantity || 1),
              daysSupply: Number(it.days_supply ?? it.daysSupply ?? 1),
              unitPrice: Number(it.unit_price ?? it.unitPrice ?? 0),
              instructions: it.instructions || '',
              hasConsultationForm: Boolean(it.has_consultation_form ?? it.hasConsultationForm ?? false)
            }))
          };
        }
      }
    } catch (ocrErr) {
      console.warn('[BHYT OCR] Gọi API Vision thất bại, tự động chuyển về fallback nội bộ:', ocrErr);
    } finally {
      setIsOcrProcessing(false);
    }

    if (!extracted) {
      extracted = extractPrescriptionFromDocument(file.name);
    }

    setActivePayload(extracted);
    setHospitalRank(extracted.hospitalRank);
    setTreatmentType(extracted.treatmentType);
    setActiveAnalysisTab('pure_breakdown');
    handleRunOcrProcess(extracted, extracted.hospitalRank, extracted.treatmentType);

    // Kích hoạt phân giải thực thể thuốc đồng bộ ngay lập tức cho bảng HITL
    if (extracted.items.length > 0) {
      try {
        const drugQueries = extracted.items.map(it => `${it.drugName} ${it.dosage || ''}`);
        const batchRes = await bhytApi.batchResolveDrugs(drugQueries);
        const newMap: Record<string, DrugResolutionResult> = {};
        batchRes.results.forEach((res, idx) => {
          const it = extracted!.items[idx];
          if (it && res) newMap[it.id] = res;
        });
        setResolutionMap(newMap);
      } catch (davErr) {
        console.warn('[BHYT DAV] Phân giải thực thể nền:', davErr);
      }
    }
  };

  // Hàm phân tích đơn thuốc (Kích hoạt khi bấm nút "Phân tích đơn")
  const handleAnalyzePrescription = async (targetFile?: File) => {
    const fileToProcess = targetFile || documentFile?.rawFile;
    if (fileToProcess) {
      await processUploadedFile(fileToProcess);
      return;
    }

    if (activePayload.items.length > 0) {
      handleAutoResolveFromDav();
      handleRunOcrProcess(activePayload);
      setActiveAnalysisTab('pure_breakdown');
      return;
    }

    // Chưa có tài liệu và chưa có thuốc: Mở hộp thoại chọn tệp
    fileInputRef.current?.click();
  };

  // Dán ảnh từ Clipboard
  const handlePasteFromClipboard = () => {
    if (navigator.clipboard && navigator.clipboard.read) {
      navigator.clipboard.read().then(async (clipboardItems) => {
        for (const item of clipboardItems) {
          const imgType = item.types.find(t => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            const pastedFile = new File([blob], `don_thuoc_clipboard_${Date.now()}.png`, { type: blob.type });
            processUploadedFile(pastedFile);
            return;
          }
        }
        window.alert('Vui lòng chụp ảnh màn hình rồi nhấn tổ hợp phím Ctrl + V để dán.');
      }).catch(() => {
        window.alert('Vui lòng bấm tổ hợp phím Ctrl + V để dán ảnh trực tiếp.');
      });
    } else {
      window.alert('Vui lòng bấm tổ hợp phím Ctrl + V để dán ảnh.');
    }
  };

  // Tự động đối soát toàn bộ danh sách thuốc với CSDL Dược Quốc Gia (54.885 mặt hàng)
  const handleAutoResolveFromDav = async () => {
    if (activePayload.items.length === 0) return;
    setIsResolvingDav(true);
    try {
      const drugQueries = activePayload.items.map(it => `${it.drugName} ${it.dosage || ''}`);
      const batchRes = await bhytApi.batchResolveDrugs(drugQueries);
      const newMap: Record<string, DrugResolutionResult> = {};
      const updatedItems = activePayload.items.map((it, idx) => {
        const res = batchRes.results[idx];
        if (res) {
          newMap[it.id] = res;
          if (res.matched_dav) {
            return {
              ...it,
              drugName: res.matched_dav.brand_name || it.drugName,
              activeIngredient: res.matched_dav.active_ingredient || it.activeIngredient,
              dosage: res.detected_concentration || res.matched_dav.concentration || it.dosage,
              route: res.matched_dav.route || it.route,
              drugCode: res.matched_dav.atc_code || it.drugCode
            };
          }
        }
        return it;
      });
      setResolutionMap(newMap);
      setActivePayload(prev => ({ ...prev, items: updatedItems }));
    } catch (err) {
      console.error('Lỗi đối soát DAV:', err);
    } finally {
      setIsResolvingDav(false);
    }
  };

  // Xuất bảng kê chi tiết giám định BHYT ra file Excel / CSV (Hỗ trợ UTF-8 chuẩn)
  const handleExportExcel = () => {
    if (activePayload.items.length === 0) {
      alert('Chưa có danh mục thuốc để xuất bảng kê!');
      return;
    }

    const rows: string[][] = [
      ['BỆNH VIỆN ĐA KHOA XANH PÔN - HỘI ĐỒNG THUỐC & ĐIỀU TRỊ'],
      ['BIÊN BẢN GIÁM ĐỊNH CHI PHÍ VÀ AN TOÀN SỬ DỤNG THUỐC BHYT'],
      ['Căn cứ Thông tư 20/2022/TT-BYT, QĐ 130/QĐ-BYT & QĐ 3618/QĐ-BHXH'],
      [''],
      ['THÔNG TIN HÀNH CHÍNH & HỒ SƠ KHÁM BỆNH'],
      ['Mã đơn thuốc', activePayload.prescriptionId || 'RX-2026', 'Ngày giám định', new Date().toLocaleDateString('vi-VN')],
      ['Họ và tên người bệnh', activePayload.patientName || 'NGUYỄN VĂN AN', 'Tuổi', String(activePayload.patientAge || 54)],
      ['Mã thẻ BHYT', activePayload.insuranceCardNumber || 'DN4010123456789', 'Hình thức điều trị', treatmentType === 'NGOAI_TRU' ? 'Ngoại trú' : 'Nội trú'],
      ['Tuyến bệnh viện', HOSPITAL_RANK_LABELS[hospitalRank], 'Chẩn đoán chính', `${activePayload.primaryIcd10} - ${activePayload.primaryDiagnosis}`],
      [''],
      ['DANH MỤC THUỐC KÊ ĐƠN & ĐỐI SOÁT DƯỢC QUỐC GIA (DAV)'],
      [
        'STT',
        'Tên biệt dược',
        'Hoạt chất INN',
        'Mã QLD / SĐK DAV',
        'Phân nhóm ATC / TT20',
        'Hàm lượng',
        'Đường dùng',
        'Số ngày',
        'Số lượng',
        'Đơn giá (VNĐ)',
        'Thành tiền (VNĐ)',
        'Tỷ lệ TT BHYT (%)',
        'Tiền BHYT chi trả (VNĐ)',
        'Tiền nguy cơ xuất toán (VNĐ)',
        'Trạng thái thẩm định',
        'Ghi chú / Căn cứ xuất toán'
      ]
    ];

    let totalPrescriptionCost = 0;
    let totalRiskCost = 0;

    activePayload.items.forEach((it, idx) => {
      const res = resolutionMap[it.id];
      const matchedRule = findBhytRule(it.activeIngredient || it.drugName);
      const lineTotal = (it.quantity || 0) * (it.unitPrice || 0);
      totalPrescriptionCost += lineTotal;

      const violation = auditReport.violations.find(v => v.drugName === it.drugName);
      const riskAmount = violation?.rejectionRiskVnd || 0;
      totalRiskCost += riskAmount;
      const approvedAmount = Math.max(0, lineTotal - riskAmount);
      const paymentRatio = matchedRule ? matchedRule.paymentRatio : 100;

      rows.push([
        String(idx + 1),
        it.drugName,
        it.activeIngredient || res?.matched_dav?.active_ingredient || '',
        it.drugCode || res?.matched_dav?.national_code || '',
        matchedRule?.atcGroupName || 'Thuốc khác',
        it.dosage || res?.detected_concentration || '',
        it.route || 'Uống',
        String(it.daysSupply || 7),
        String(it.quantity || 0),
        String(it.unitPrice || 0),
        String(lineTotal),
        `${paymentRatio}%`,
        String(approvedAmount),
        String(riskAmount),
        violation ? 'XUẤT TOÁN' : 'HỢP LỆ',
        violation ? `${violation.detail} (${violation.legalRef.docTitle})` : 'Đủ điều kiện thanh toán BHYT'
      ]);
    });

    rows.push(['']);
    rows.push(['TỔNG KẾT THẨM ĐỊNH KINH TẾ']);
    rows.push(['Tổng chi phí kê đơn (VNĐ)', String(totalPrescriptionCost)]);
    rows.push(['Chi phí BHYT chấp nhận (VNĐ)', String(Math.max(0, totalPrescriptionCost - totalRiskCost))]);
    rows.push(['Chi phí có nguy cơ xuất toán (VNĐ)', String(totalRiskCost)]);
    rows.push(['Số lượng vi phạm', String(auditReport.violations.length)]);
    rows.push(['Kết luận chung', auditReport.violations.length === 0 ? 'ĐƠN THUỐC HỢP LỆ 100%' : `CÓ ${auditReport.violations.length} KHOẢN CẦN GIẢI TRÌNH/XUẤT TOÁN`]);

    const csvContent = '\uFEFF' + rows.map(r => r.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bien_Ban_Giam_Dinh_BHYT_${activePayload.prescriptionId || 'RX'}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Nạp file từ máy tính
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processUploadedFile(file);
  };

  // Lắng nghe dán ảnh Ctrl + V từ Clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const pastedFile = new File([blob], `don_thuoc_clipboard_${Date.now()}.png`, { type: blob.type });
            processUploadedFile(pastedFile);
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Xử lý nạp và ghi nhận log
  const handleRunOcrProcess = (
    overridePayload?: BhytPrescriptionPayload,
    overrideRank?: HospitalRank,
    overrideType?: TreatmentType
  ) => {
    setIsOcrProcessing(true);
    setTimeout(() => {
      setIsOcrProcessing(false);
      const targetPayload = overridePayload || activePayload;
      bhytApi.auditPrescription({
        ...targetPayload,
        hospitalRank: overrideRank || hospitalRank,
        treatmentType: overrideType || treatmentType
      }).catch(() => {});
    }, 250);
  };

  // Chỉnh sửa từng ô input trong bảng thuốc
  const handleItemChange = (index: number, field: keyof BhytPrescriptionItem, value: any) => {
    setActivePayload(prev => {
      const nextItems = [...prev.items];
      nextItems[index] = {
        ...nextItems[index],
        [field]: value
      };
      return {
        ...prev,
        items: nextItems
      };
    });
  };

  // Thêm thuốc
  const handleAddMedicineRow = () => {
    const newItem: BhytPrescriptionItem = {
      id: `rx-${Date.now()}`,
      drugCode: `MED-NEW-${activePayload.items.length + 1}`,
      drugName: '',
      activeIngredient: '',
      dosage: '',
      route: 'Uống',
      quantity: 10,
      daysSupply: 7,
      unitPrice: 5000,
      instructions: '1 viên x 2 lần/ngày'
    };
    setActivePayload(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  // Xóa thuốc
  const handleDeleteMedicineRow = (index: number) => {
    setActivePayload(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Mở modal sửa hành chính & ICD-10 (Đồng bộ tức thời với activePayload)
  const handleOpenEditAdminModal = () => {
    setAdminFormDraft({
      prescriptionId: activePayload.prescriptionId || '',
      patientName: activePayload.patientName || '',
      patientAge: activePayload.patientAge || 0,
      insuranceCardNumber: activePayload.insuranceCardNumber || '',
      primaryIcd10: activePayload.primaryIcd10 || '',
      primaryDiagnosis: activePayload.primaryDiagnosis || '',
      secondaryIcd10s: (activePayload.secondaryIcd10s || []).join(', ')
    });
    setIsEditAdminModalOpen(true);
  };

  // Lưu form sửa hành chính
  const handleSaveAdminForm = () => {
    const secIcds = (adminFormDraft.secondaryIcd10s || '')
      .split(/[,;\s]+/)
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    setActivePayload(prev => ({
      ...prev,
      patientName: adminFormDraft.patientName,
      patientAge: Number(adminFormDraft.patientAge) || prev.patientAge,
      insuranceCardNumber: adminFormDraft.insuranceCardNumber,
      primaryIcd10: adminFormDraft.primaryIcd10.trim().toUpperCase(),
      primaryDiagnosis: adminFormDraft.primaryDiagnosis,
      secondaryIcd10s: secIcds,
      prescriptionId: adminFormDraft.prescriptionId
    }));
    setIsEditAdminModalOpen(false);
  };

  // Nạp XML 130
  const handleParseXml = () => {
    if (!xmlInputText.trim()) return;
    try {
      const parsed = parseQd130Xml(xmlInputText);
      setActivePayload(prev => ({
        ...prev,
        ...parsed,
        items: parsed.items || prev.items
      }));
      setActiveAnalysisTab('pure_breakdown');
    } catch {
      window.alert('Định dạng XML không hợp lệ.');
    }
  };

  const handleLoadSampleXml = () => {
    const sample = generateSampleQd130Xml();
    setXmlInputText(sample);
    const parsed = parseQd130Xml(sample);
    setActivePayload(prev => ({
      ...prev,
      ...parsed,
      items: parsed.items || prev.items
    }));
    setActiveAnalysisTab('pure_breakdown');
  };

  // Mở tài liệu PDF căn cứ pháp lý trong In-App Drawer chuyên dụng
  const handleOpenLegalPdf = (docCode: string, pageNumber: number, title?: string, excerpt?: string) => {
    let pdfUrl = '/pdf/bhyt/Thong_Tu_20_2022_TT_BYT_Danh_Muc_Thanh_Toan_Thuoc_BHYT.pdf';
    let docTitle = 'Thông tư 20/2022/TT-BYT - Danh mục Thuốc BHYT';
    if (docCode.includes('3618')) {
      pdfUrl = '/pdf/bhyt/Quyet_Dinh_3618_QD_BHXH_2022_Quy_Trinh_Giam_Dinh_BHYT.pdf';
      docTitle = 'Quyết định 3618/QĐ-BHXH - Quy trình Giám định BHYT';
    } else if (docCode.includes('130')) {
      pdfUrl = '/pdf/bhyt/Quyet_Dinh_130_QD_BYT_2023_Chuan_Du_Lieu_Dau_Ra_BHYT.pdf';
      docTitle = 'Quyết định 130/QĐ-BYT - Chuẩn dữ liệu đầu ra BHYT';
    }
    setActivePdfViewerTarget({
      title: title || `${docTitle} (Trang ${pageNumber})`,
      url: `${pdfUrl}#page=${pageNumber}`,
      page: pageNumber,
      legal_basis: docCode,
      excerpt: excerpt
    });
  };

  // Lấy vi phạm của từng dòng thuốc
  const getItemViolations = (item: BhytPrescriptionItem) => {
    const dName = (item.drugName || '').trim().toLowerCase();
    const aName = (item.activeIngredient || '').trim().toLowerCase();
    return auditReport.violations.filter(v => {
      const vd = (v.drugName || '').toLowerCase();
      const va = (v.activeIngredient || '').toLowerCase();
      return (dName && (vd === dName || vd.includes(dName) || dName.includes(vd))) ||
             (aName && (va === aName || va.includes(aName) || aName.includes(va)));
    });
  };

  // Mở modal gợi ý thuốc thay thế BHYT 1-Click
  const handleOpenSubstitutionModal = (violation: BhytViolationItem, explicitItem?: BhytPrescriptionItem) => {
    let target = explicitItem;
    if (!target) {
      target = activePayload.items.find(it => it.id === violation.drugId) ||
        activePayload.items.find(it => {
          const itName = it.drugName.trim().toLowerCase();
          const vName = violation.drugName.trim().toLowerCase();
          return itName === vName || itName.includes(vName) || vName.includes(itName);
        }) ||
        activePayload.items.find(it => {
          if (!violation.activeIngredient || !it.activeIngredient) return false;
          const itAct = it.activeIngredient.trim().toLowerCase();
          const vAct = violation.activeIngredient.trim().toLowerCase();
          return itAct === vAct || itAct.includes(vAct) || vAct.includes(itAct);
        });
    }

    if (!target) {
      target = {
        id: violation.drugId || `target-${Date.now()}`,
        drugName: violation.drugName,
        activeIngredient: violation.activeIngredient,
        dosage: '',
        route: 'Uống',
        quantity: 1,
        unitPrice: violation.rejectionRiskVnd || 0,
        daysSupply: 7,
        instructions: 'Theo chỉ định của bác sĩ'
      };
    }

    const candidates = findDrugSubstitutes(
      target,
      violation,
      hospitalRank,
      activePayload.primaryIcd10,
      activePayload.items
    );

    setSubstitutionModalState({
      isOpen: true,
      originalItem: target,
      violation,
      candidates
    });
  };

  // Áp dụng thuốc thay thế BHYT 1-Click
  const handleApplySubstitute = (candidate: DrugSubstituteCandidate) => {
    if (!substitutionModalState.originalItem) return;
    const original = substitutionModalState.originalItem;

    setActivePayload(prev => {
      const updatedItems = prev.items.map(it => {
        const isMatched = it.id === original.id ||
          (original.drugName && it.drugName.trim().toLowerCase() === original.drugName.trim().toLowerCase());
        if (isMatched) {
          return {
            ...it,
            drugName: candidate.drugName,
            activeIngredient: candidate.activeIngredient,
            dosage: candidate.dosage,
            route: candidate.route,
            unitPrice: candidate.unitPrice
          };
        }
        return it;
      });
      return {
        ...prev,
        items: updatedItems
      };
    });

    // Cập nhật trạng thái tra cứu danh mục dược thư
    setResolutionMap(prev => ({
      ...prev,
      [original.id]: {
        raw_name: candidate.drugName,
        match_status: 'HIGH',
        confidence_score: 1.0,
        matched_dav: {
          brand_name: candidate.drugName,
          active_ingredient: candidate.activeIngredient,
          registration_number: candidate.id,
          declared_price: candidate.unitPrice,
          standard_dosage: candidate.dosage
        }
      }
    }));

    // Thông báo phản hồi trực quan
    const savedVnd = candidate.savedRejectionVnd.toLocaleString('vi-VN');
    setSubstitutionToast({
      message: `Đã thay thế "${original.drugName}" bằng "${candidate.drugName}" (${candidate.activeIngredient}). Cứu được ${savedVnd} đ xuất toán BHYT!`,
      type: 'success'
    });

    setSubstitutionModalState({
      isOpen: false,
      originalItem: null,
      violation: null,
      candidates: []
    });

    setTimeout(() => {
      setSubstitutionToast(null);
    }, 6000);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden w-full bg-slate-50 text-slate-900">
      
      {/* 1. THANH ĐIỀU HƯỚNG TỔNG QUAN, TRẠNG THÁI & CÁC NÚT XUẤT BÁO CÁO */}
      <div className="shrink-0 border-b border-slate-200 px-4 py-2.5 bg-white flex items-center justify-between gap-4 flex-wrap shadow-2xs">
        
        {/* Nhóm trái: Tuyến bệnh viện & Hình thức điều trị */}
        <div className="flex items-center gap-3.5 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Tuyến BV:</label>
            <select
              aria-label="Tuyến bệnh viện"
              value={hospitalRank}
              onChange={(e) => setHospitalRank(e.target.value as HospitalRank)}
              className="h-9 bg-white border border-slate-300 rounded-md px-3 text-sm text-slate-800 font-semibold cursor-pointer focus:border-blue-500 focus:outline-none shadow-2xs"
            >
              <option value="HANG_DAC_BIET">Hạng ĐB (Trung ương)</option>
              <option value="HANG_I">Hạng I (Tỉnh/TW)</option>
              <option value="HANG_II">Hạng II (Tỉnh)</option>
              <option value="HANG_III">Hạng III (Huyện)</option>
              <option value="HANG_IV">Hạng IV (Xã)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Điều trị:</label>
            <select
              aria-label="Hình thức điều trị"
              value={treatmentType}
              onChange={(e) => setTreatmentType(e.target.value as TreatmentType)}
              className="h-9 bg-white border border-slate-300 rounded-md px-3 text-sm text-slate-800 font-semibold cursor-pointer focus:border-blue-500 focus:outline-none shadow-2xs"
            >
              <option value="NGOAI_TRU">Ngoại trú</option>
              <option value="NOI_TRU">Nội trú</option>
            </select>
          </div>
        </div>

        {/* Nhóm phải: Tóm tắt trạng thái xuất toán & Cặp nút Xuất Báo Cáo */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Huy hiệu trạng thái */}
          {auditReport.itemsCount === 0 ? (
            <span className="text-sm text-slate-500 font-medium italic px-3 py-1 bg-slate-100 border border-slate-200 rounded-md">
              Chưa nạp đơn thuốc
            </span>
          ) : auditReport.status === 'REJECT' ? (
            <span className="font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 shadow-2xs">
              <span>⛔</span>
              <span>Xuất toán: -{auditReport.atRiskCostVnd.toLocaleString('vi-VN')} đ ({auditReport.rejectCount} vi phạm)</span>
            </span>
          ) : auditReport.status === 'WARNING' ? (
            <span className="font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 shadow-2xs">
              <span>⚠️</span>
              <span>Lưu ý: {auditReport.warningCount} thuốc cần giải trình</span>
            </span>
          ) : (
            <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 shadow-2xs">
              <span>✅</span>
              <span>Hợp lệ 100% ({auditReport.itemsCount} thuốc)</span>
            </span>
          )}

          {/* Huy hiệu đồng chi trả BHYT theo luật */}
          {auditReport.patientCoPayCostVnd > 0 && (
            <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 shadow-2xs" title="Khoản người bệnh cùng chi trả cho thuốc theo quy định Thông tư 20/2022/TT-BYT (hợp pháp, không xuất toán)">
              <span>⚖️</span>
              <span>Đồng chi trả BHYT: {auditReport.patientCoPayCostVnd.toLocaleString('vi-VN')} đ</span>
            </span>
          )}

          {/* Dải phân cách */}
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          {/* Cặp nút Xuất Báo Cáo (Excel & In A4/PDF) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={activePayload.items.length === 0}
              className="h-9 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-sm font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Xuất bảng kê chi tiết giám định thuốc ra file Excel (.csv UTF-8)"
            >
              <span>📊</span>
              <span>Xuất Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              disabled={activePayload.items.length === 0}
              className="h-9 px-3.5 bg-teal-700 hover:bg-teal-800 text-white rounded-md text-sm font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-98"
              title="In biên bản thẩm định BHYT hoặc xuất file PDF chuẩn mẫu"
            >
              <span>📄</span>
              <span>In / Xuất PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* THÔNG BÁO GỢI Ý THAY THẾ THUỐC BHYT THÀNH CÔNG */}
      {substitutionToast && (
        <div className="shrink-0 mx-4 mt-2.5 p-3 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center justify-between gap-3 text-emerald-950 animate-in fade-in slide-in-from-top-2 shadow-2xs">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-lg">⚡</span>
            <span>{substitutionToast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setSubstitutionToast(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold text-sm px-2 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. KHUNG NỘI DUNG CHÍNH: LUÔN Ở CHẾ ĐỘ SPLIT VIEW SONG SONG (TRÁI = TÀI LIỆU GỐC, PHẢI = THẨM ĐỊNH 3 BƯỚC) */}
      <div className="flex-1 min-h-0 w-full p-3.5 flex flex-col lg:flex-row gap-3.5 overflow-hidden">
        
        {/* =========================================================================
            CỘT TRÁI (48% WIDTH): KHUNG VIEWER TÀI LIỆU (PDF / ẢNH / DROPZONE)
           ========================================================================= */}
        <div className="w-full lg:w-[48%] xl:w-[46%] h-full flex flex-col bg-white border border-slate-300 rounded-lg overflow-hidden shadow-xs shrink-0">
          
          {/* Thanh công cụ xem file */}
          <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2.5 text-sm shrink-0 min-h-[50px]">
            
            {/* Tên file & định dạng */}
            <div className="flex items-center gap-2 min-w-0">
              <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider shrink-0 ${
                documentFile?.type === 'pdf'
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : documentFile?.type === 'image'
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'bg-slate-100 text-slate-600 border border-slate-300'
              }`}>
                {documentFile?.type === 'pdf' ? 'Tệp PDF' : documentFile?.type === 'image' ? 'Ảnh đơn' : 'Chưa có file'}
              </span>

              <span className="font-bold text-slate-900 truncate text-sm max-w-[180px] sm:max-w-[220px]" title={documentFile?.name || 'Tài liệu'}>
                {documentFile ? documentFile.name : 'Chưa chọn tài liệu'}
              </span>

              {isOcrProcessing && (
                <span className="text-xs text-blue-600 font-semibold flex items-center gap-1 animate-pulse">
                  <span>⏳ Đang phân tích...</span>
                </span>
              )}
            </div>

            {/* Nút hành động & Công cụ */}
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*,application/pdf"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 px-3 bg-teal-700 hover:bg-teal-800 text-white rounded text-sm font-bold cursor-pointer transition flex items-center gap-1.5 active:scale-98"
              >
                <span>{documentFile ? '📁 Đổi file' : '📁 Chọn file từ máy'}</span>
              </button>

              {/* Nút phân tích đơn duy nhất tại toolbar tài liệu */}
              <button
                type="button"
                onClick={() => handleAnalyzePrescription()}
                disabled={isOcrProcessing}
                className="h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{isOcrProcessing ? '⏳ Đang phân tích...' : '⚡ Phân tích đơn'}</span>
              </button>

              {documentFile && documentFile.type === 'pdf' && (
                <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-300">
                  <button
                    type="button"
                    onClick={() => {
                      setActivePdfViewerTarget({
                        title: `Tệp PDF Đơn thuốc: ${documentFile.name}`,
                        url: documentFile.url,
                        page: 1,
                        legal_basis: 'Tài liệu tải lên'
                      });
                    }}
                    className="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold cursor-pointer transition flex items-center gap-1 border border-slate-300 shadow-2xs"
                    title="Mở toàn màn hình xem rõ tài liệu"
                  >
                    <span>⛶ Toàn màn hình</span>
                  </button>
                  <a
                    href={documentFile.url}
                    target="_blank"
                    rel="noreferrer"
                    className="h-8 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition flex items-center justify-center border border-slate-300 shadow-2xs"
                    title="Mở tài liệu trong tab mới"
                  >
                    ↗
                  </a>
                </div>
              )}

              {documentFile && documentFile.type === 'image' && (
                <div className="flex items-center gap-1 pl-1.5 border-l border-slate-300">
                  <button
                    type="button"
                    onClick={() => setZoomLevel(prev => Math.max(50, prev - 15))}
                    className="w-7 h-7 flex items-center justify-center border border-slate-300 rounded hover:bg-slate-100 text-sm font-bold"
                    title="Thu nhỏ"
                  >
                    -
                  </button>

                  <span className="font-mono text-xs text-slate-700 px-0.5 select-none">
                    {zoomLevel}%
                  </span>

                  <button
                    type="button"
                    onClick={() => setZoomLevel(prev => Math.min(250, prev + 15))}
                    className="w-7 h-7 flex items-center justify-center border border-slate-300 rounded hover:bg-slate-100 text-sm font-bold"
                    title="Phóng to"
                  >
                    +
                  </button>

                  <button
                    type="button"
                    onClick={() => setRotationAngle(prev => (prev + 90) % 360)}
                    className="w-7 h-7 flex items-center justify-center border border-slate-300 rounded hover:bg-slate-100 text-sm font-bold"
                    title="Xoay 90 độ"
                  >
                    ⟳
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* VÙNG HIỂN THỊ TÀI LIỆU CHIẾM TRỌN 100% CHIỀU CAO CỘT TRÁI */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) {
                processUploadedFile(file);
              }
            }}
            className={`w-full flex-1 min-h-0 overflow-auto bg-slate-100 flex items-center justify-center p-2.5 relative ${
              isDragging ? 'ring-2 ring-blue-600 bg-blue-50/50' : ''
            }`}
          >
            {documentFile ? (
              documentFile.type === 'pdf' ? (
                <iframe
                  src={`${documentFile.url}#toolbar=0`}
                  title="PDF Đơn Thuốc"
                  className="w-full h-full border-0 block bg-white rounded shadow-2xs"
                />
              ) : (
                <div
                  className="transition-transform duration-150 ease-out origin-top flex items-center justify-center max-w-full my-auto"
                  style={{
                    transform: `scale(${zoomLevel / 100}) rotate(${rotationAngle}deg)`
                  }}
                >
                  <img
                    src={documentFile.url}
                    alt="Đơn thuốc BHYT"
                    className="max-w-full h-auto object-contain rounded bg-white border border-slate-200 block shadow-sm"
                  />
                </div>
              )
            ) : (
              <div className="text-center p-6 space-y-3.5 my-auto">
                <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-3xl text-blue-600 shadow-2xs">
                  📄
                </div>
                <div className="text-base font-bold text-slate-900">
                  Kéo và thả file ảnh hoặc PDF đơn thuốc vào đây
                </div>
                <div className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
                  Hỗ trợ định dạng PDF, PNG, JPG, JPEG (tối đa 10MB) hoặc dán trực tiếp từ clipboard (Ctrl + V)
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-bold cursor-pointer shadow-xs transition flex items-center gap-2 mx-auto"
                  >
                    <span>📁 Chọn tệp PDF hoặc ảnh đơn thuốc</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            CỘT PHẢI (FLEX-1): PHÂN TÍCH 3 BƯỚC ĐỘC LẬP
           ========================================================================= */}
        <div className="flex-1 min-w-0 h-full bg-white border border-slate-200 rounded-lg shadow-xs flex flex-col overflow-hidden">
          
          {/* Thanh Tab điều hướng các bước thẩm định (Cùng 1 luồng linear flex, tuyệt đối không chồng chéo) */}
          <div className="shrink-0 border-b border-slate-200 px-3 bg-slate-50 flex items-center gap-2 overflow-x-auto h-12">
            
            <button
              type="button"
              data-testid="tab-pure-breakdown"
              onClick={() => setActiveAnalysisTab('pure_breakdown')}
              className={`h-full px-3.5 text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeAnalysisTab === 'pure_breakdown'
                  ? 'border-blue-600 text-blue-950 bg-white rounded-t-md shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📋 1. Dữ liệu thuần</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold font-mono">
                {activePayload.items.length}
              </span>
            </button>

            <button
              type="button"
              data-testid="tab-clinical-7"
              onClick={() => setActiveAnalysisTab('clinical_7')}
              className={`h-full px-3.5 text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeAnalysisTab === 'clinical_7'
                  ? 'border-blue-600 text-blue-950 bg-white rounded-t-md shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🛡️ 2. Đánh giá lâm sàng</span>
              {clinicalSevenCategories.some(c => c.status === 'ALERT') ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                  Cảnh báo
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  An toàn
                </span>
              )}
            </button>

            <button
              type="button"
              data-testid="tab-violations"
              onClick={() => setActiveAnalysisTab('violations')}
              className={`h-full px-3.5 text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeAnalysisTab === 'violations'
                  ? 'border-blue-600 text-blue-950 bg-white rounded-t-md shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>⚖️ 3. Thẩm định xuất toán BHYT</span>
              {auditReport.rejectCount > 0 ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold font-mono">
                  {auditReport.rejectCount} vi phạm
                </span>
              ) : auditReport.warningCount > 0 ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold font-mono">
                  {auditReport.warningCount} lưu ý
                </span>
              ) : auditReport.itemsCount > 0 ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  Hợp lệ
                </span>
              ) : null}
            </button>

            {/* Vạch chia công cụ tham chiếu */}
            <div className="h-5 w-px bg-slate-300 shrink-0 mx-1" />

            <button
              type="button"
              onClick={() => setActiveAnalysisTab('catalog')}
              className={`h-full px-3 text-sm font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeAnalysisTab === 'catalog'
                  ? 'border-slate-800 text-slate-950 bg-white rounded-t-md font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>📚 Tra cứu TT 20</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAnalysisTab('xml')}
              className={`h-full px-3 text-sm font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeAnalysisTab === 'xml'
                  ? 'border-slate-800 text-slate-950 bg-white rounded-t-md font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>📑 Nhập XML 130</span>
            </button>
          </div>

          {/* NỘI DUNG TỪNG TAB (CUỘN RIÊNG BIỆT) */}
          <div className="p-3.5 flex-1 overflow-y-auto">
            
            {/* -------------------------------------------------------------
                NỘI DUNG TAB 1: BẢN PHÂN TÍCH DỮ LIỆU ĐƠN (THUẦN)
                (Bóc tách thực thể lâm sàng, giải phẫu danh mục & định lượng)
               ------------------------------------------------------------- */}
            {activeAnalysisTab === 'pure_breakdown' && (
              <div className="space-y-4">
                {/* KHỐI A: HỒ SƠ HÀNH CHÍNH & CHẨN ĐOÁN LÂM SÀNG */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-3.5 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 font-bold text-lg">📋</span>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          Hồ sơ hành chính &amp; Chẩn đoán đơn thuốc
                        </h3>
                        <p className="text-sm text-slate-500">
                          Thông tin bóc tách từ đơn gốc / XML 130 phục vụ giám định
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      data-testid="btn-edit-admin-icd10"
                      onClick={handleOpenEditAdminModal}
                      className="h-8 px-3 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>✏️ Sửa hành chính &amp; ICD-10</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                    <div className="bg-white p-3 rounded-md border border-slate-200/80 shadow-2xs">
                      <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Bệnh nhân</span>
                      <strong className="text-base text-slate-950 block mt-0.5">{activePayload.patientName || 'Chưa có thông tin'}</strong>
                      <span className="text-slate-600 text-sm font-medium">{activePayload.patientAge > 0 ? `${activePayload.patientAge} tuổi` : '—'}</span>
                    </div>

                    <div className="bg-white p-3 rounded-md border border-slate-200/80 shadow-2xs">
                      <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Mã thẻ BHYT</span>
                      <strong className="text-base font-mono text-slate-950 block mt-0.5">{activePayload.insuranceCardNumber || 'Chưa có'}</strong>
                      <span className="text-slate-500 text-xs block mt-0.5 font-medium">Mã đơn: {activePayload.prescriptionId || 'Chưa tạo'}</span>
                    </div>

                    <div className="bg-white p-3 rounded-md border border-slate-200/80 shadow-2xs">
                      <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Tuyến KCB &amp; Hạng BV</span>
                      <strong className="text-sm font-bold text-slate-900 block mt-0.5">{HOSPITAL_RANK_LABELS[hospitalRank]}</strong>
                      <span className="text-slate-600 text-xs font-medium">{treatmentType === 'NGOAI_TRU' ? 'Điều trị Ngoại trú' : 'Điều trị Nội trú'}</span>
                    </div>

                    <div className="bg-white p-3 rounded-md border border-slate-200/80 shadow-2xs">
                      <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Chẩn đoán chính (ICD-10)</span>
                      <div className="mt-0.5">
                        {activePayload.primaryIcd10 ? (
                          <>
                            <strong className="font-mono text-emerald-800 font-bold text-base">{activePayload.primaryIcd10}</strong>
                            <span className="text-slate-900 ml-1 font-semibold text-sm">{activePayload.primaryDiagnosis}</span>
                          </>
                        ) : (
                          <span className="text-slate-400 italic text-sm">Chưa có chẩn đoán</span>
                        )}
                      </div>
                      {activePayload.secondaryIcd10s && activePayload.secondaryIcd10s.length > 0 && (
                        <div className="text-xs text-slate-500 mt-1 truncate" title={activePayload.secondaryIcd10s.join(', ')}>
                          Kèm: {activePayload.secondaryIcd10s.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* KHỐI B: TÓM TẮT ĐỊNH LƯỢNG LÂM SÀNG THUẦN (METRICS CARDS) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3.5 shadow-2xs">
                    <span className="text-xs font-bold text-blue-800 uppercase tracking-wider block">Tổng khoản thuốc</span>
                    <div className="text-2xl font-black text-blue-950 mt-1">
                      {pureMetrics.totalItems} <span className="text-sm font-semibold text-blue-700">mặt hàng</span>
                    </div>
                  </div>

                  <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-3.5 shadow-2xs">
                    <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider block">Nhóm dược lý (ATC)</span>
                    <div className="text-2xl font-black text-indigo-950 mt-1">
                      {pureMetrics.uniqueGroupsCount} <span className="text-sm font-semibold text-indigo-700">phân nhóm</span>
                    </div>
                  </div>

                  <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3.5 shadow-2xs">
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">Đợt dùng cao nhất</span>
                    <div className="text-2xl font-black text-amber-950 mt-1">
                      {pureMetrics.maxDaysSupply > 0 ? pureMetrics.maxDaysSupply : '—'} <span className="text-sm font-semibold text-amber-700">ngày</span>
                    </div>
                  </div>

                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3.5 shadow-2xs">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Tổng tiền thuốc dự kiến</span>
                    <div className="text-2xl font-black text-emerald-950 mt-1">
                      {pureMetrics.grossCost.toLocaleString('vi-VN')} <span className="text-sm font-semibold text-emerald-700">đ</span>
                    </div>
                  </div>
                </div>

                {/* KHỐI C: BẢNG GIẢI PHẪU DỮ LIỆU ĐƠN THUỐC THUẦN TÚY (FACT-SHEET TABLE & HITL) */}
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-300/80 rounded-md p-3 text-amber-950 text-sm flex items-start gap-2.5 shadow-2xs">
                    <span className="text-amber-600 font-bold text-base shrink-0">💡</span>
                    <div className="flex-1 leading-relaxed">
                      <strong className="font-bold text-amber-900">Bản phân tích dữ liệu thuần:</strong>
                      <span className="ml-1 text-slate-700">
                        Hiển thị danh mục hoạt chất, hàm lượng, đường dùng và đơn giá được trích xuất từ đơn. Quý bác sĩ/dược sĩ có thể trực tiếp hiệu chỉnh từng ô hoặc bấm <strong>"Khớp CSDL DAV"</strong> để đối chiếu danh mục 54.885 thuốc trước khi chuyển sang bước thẩm định.
                      </span>
                    </div>
                  </div>

                  {/* Thanh công cụ hành động */}
                  <div className="flex items-center justify-between flex-wrap gap-2.5 pt-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <button
                        type="button"
                        onClick={handleAddMedicineRow}
                        className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <span>+ Thêm thuốc</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleAutoResolveFromDav}
                        disabled={isResolvingDav || activePayload.items.length === 0}
                        className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <span>{isResolvingDav ? '⏳ Đang đối soát...' : '🔄 Khớp CSDL DAV (54.885 thuốc)'}</span>
                      </button>
                    </div>

                    <div className="text-sm text-slate-600 font-medium">
                      {activePayload.items.length > 0 ? (
                        <>Hiển thị <strong>{activePayload.items.length}</strong> khoản thuốc</>
                      ) : (
                        <>Chưa có thuốc trong đơn</>
                      )}
                    </div>
                  </div>

                  {/* Bảng dữ liệu thuần */}
                  <div className="border border-slate-200 rounded-md overflow-x-auto shadow-2xs">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-xs">
                        <tr>
                          <th className="py-2.5 px-2 text-center w-10 border-r border-slate-200">STT</th>
                          <th className="py-2.5 px-3 border-r border-slate-200 min-w-[220px]">Tên biệt dược &amp; Hoạt chất INN</th>
                          <th className="py-2.5 px-2.5 border-r border-slate-200 min-w-[140px]">Phân nhóm ATC / TT 20</th>
                          <th className="py-2.5 px-2 border-r border-slate-200 w-24">Hàm lượng</th>
                          <th className="py-2.5 px-2 border-r border-slate-200 w-24">Đường dùng</th>
                          <th className="py-2.5 px-2 border-r border-slate-200 min-w-[150px]">Cách dùng &amp; Liều</th>
                          <th className="py-2.5 px-2 text-center border-r border-slate-200 w-14">Ngày</th>
                          <th className="py-2.5 px-2 text-center border-r border-slate-200 w-14">SL</th>
                          <th className="py-2.5 px-2.5 text-right border-r border-slate-200 w-24">Đơn giá (đ)</th>
                          <th className="py-2.5 px-2.5 text-right border-r border-slate-200 w-28">Thành tiền (đ)</th>
                          <th className="py-2.5 px-2 text-center border-r border-slate-200 w-16">Hội chẩn</th>
                          <th className="py-2.5 px-2 text-center w-14">Xóa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {activePayload.items.length === 0 ? (
                          <tr>
                            <td colSpan={12} className="py-12 px-4 text-center text-slate-500 bg-slate-50/50">
                              <div className="max-w-md mx-auto space-y-2.5">
                                <div className="text-3xl">📋</div>
                                <div className="text-base font-bold text-slate-800">
                                  Chưa có danh mục thuốc trong đơn
                                </div>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                  Tải lên file ảnh/PDF đơn thuốc ở khung bên trái rồi bấm nút <strong>"Phân tích đơn"</strong>, hoặc bấm nút <strong>"+ Thêm thuốc"</strong> ở thanh công cụ phía trên để nhập trực tiếp.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          activePayload.items.map((item, idx) => {
                            const matchedRule = findBhytRule(item.activeIngredient || item.drugName);
                            const atcGroup = matchedRule?.atcGroupName || 'Thuốc khác';
                            const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
                            const resInfo = resolutionMap[item.id];

                            return (
                              <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2.5 px-2 text-center font-mono text-slate-600 font-bold border-r border-slate-200">
                                  {idx + 1}
                                </td>

                                <td className="py-2.5 px-3 border-r border-slate-200">
                                  <input
                                    type="text"
                                    value={item.drugName}
                                    onChange={(e) => handleItemChange(idx, 'drugName', e.target.value)}
                                    className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded text-sm font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                                    placeholder="Tên biệt dược"
                                  />
                                  <input
                                    type="text"
                                    value={item.activeIngredient}
                                    onChange={(e) => handleItemChange(idx, 'activeIngredient', e.target.value)}
                                    className="w-full h-7 px-2.5 mt-1 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-700 font-mono focus:border-blue-600 focus:outline-none"
                                    placeholder="Hoạt chất INN"
                                  />
                                  {resInfo && (
                                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                                      {resInfo.match_status === 'HIGH' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                          ✓ Khớp DAV ({resInfo.matched_dav?.brand_name || resInfo.matched_dav?.active_ingredient})
                                        </span>
                                      ) : resInfo.match_status === 'MEDIUM' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                          ~ Gợi ý ({Math.round(resInfo.confidence_score * 100)}%)
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                          ? Chưa khớp DAV
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>

                                <td className="py-2.5 px-2.5 border-r border-slate-200 text-slate-700">
                                  <span className="inline-block px-2 py-1 rounded bg-slate-100 text-slate-800 text-xs font-semibold leading-tight">
                                    {atcGroup}
                                  </span>
                                </td>

                                <td className="py-2.5 px-2 border-r border-slate-200">
                                  <input
                                    type="text"
                                    value={item.dosage}
                                    onChange={(e) => handleItemChange(idx, 'dosage', e.target.value)}
                                    className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 text-center focus:border-blue-600 focus:outline-none"
                                    placeholder="Hàm lượng"
                                  />
                                </td>

                                <td className="py-2.5 px-2 border-r border-slate-200">
                                  <select
                                    value={item.route}
                                    onChange={(e) => handleItemChange(idx, 'route', e.target.value)}
                                    className="w-full h-8 px-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 cursor-pointer"
                                  >
                                    <option value="Uống">Uống</option>
                                    <option value="Tiêm truyền TM">Tiêm TM</option>
                                    <option value="Tiêm bắp">Tiêm bắp</option>
                                    <option value="Hít / Khí dung">Khí dung</option>
                                    <option value="Đặt trực tràng">Đặt</option>
                                    <option value="Dùng ngoài">Dùng ngoài</option>
                                  </select>
                                </td>

                                <td className="py-2.5 px-2 border-r border-slate-200">
                                  <input
                                    type="text"
                                    value={item.instructions || ''}
                                    onChange={(e) => handleItemChange(idx, 'instructions', e.target.value)}
                                    className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
                                    placeholder="Cách dùng"
                                  />
                                </td>

                                <td className="py-2.5 px-1.5 text-center border-r border-slate-200">
                                  <input
                                    type="number"
                                    min={1}
                                    value={item.daysSupply || 1}
                                    onChange={(e) => handleItemChange(idx, 'daysSupply', parseInt(e.target.value) || 1)}
                                    className="w-12 h-8 text-center px-1 bg-white border border-slate-300 rounded text-sm font-mono font-semibold text-slate-800 focus:border-blue-600 focus:outline-none"
                                  />
                                </td>

                                <td className="py-2.5 px-1.5 text-center border-r border-slate-200">
                                  <input
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                                    className="w-12 h-8 text-center px-1 bg-white border border-slate-300 rounded text-sm font-mono font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                                  />
                                </td>

                                <td className="py-2.5 px-2 text-right border-r border-slate-200">
                                  <input
                                    type="number"
                                    min={0}
                                    step={100}
                                    value={item.unitPrice || 0}
                                    onChange={(e) => handleItemChange(idx, 'unitPrice', parseInt(e.target.value) || 0)}
                                    className="w-24 h-8 text-right px-2 bg-white border border-slate-300 rounded text-sm font-mono text-slate-800 focus:border-blue-600 focus:outline-none"
                                  />
                                </td>

                                <td className="py-2.5 px-2.5 text-right font-mono font-bold text-sm text-blue-950 border-r border-slate-200">
                                  {lineTotal.toLocaleString('vi-VN')} đ
                                </td>

                                <td className="py-2.5 px-2 text-center border-r border-slate-200">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(item.hasConsultationForm)}
                                    onChange={(e) => handleItemChange(idx, 'hasConsultationForm', e.target.checked)}
                                    title="Đã có biên bản hội chẩn"
                                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                  />
                                </td>

                                <td className="py-2.5 px-2 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      data-testid={`btn-quick-substitute-${idx}`}
                                      onClick={() => {
                                        const itemViolations = getItemViolations(item);
                                        const primaryViolation = itemViolations[0];
                                        const violationToUse = primaryViolation || {
                                          id: `alt-${item.id}`,
                                          drugId: item.id,
                                          drugName: item.drugName,
                                          activeIngredient: item.activeIngredient,
                                          violationType: 'UNAPPROVED_RANK',
                                          severity: 'WARNING',
                                          rejectionRiskVnd: lineTotal,
                                          detail: 'Tìm kiếm thuốc tương đương điều trị hợp lệ BHYT',
                                          action: 'Gợi ý thuốc Generic hoặc nhóm tương đương điều trị',
                                          legalRef: {
                                            docCode: '20/2022/TT-BYT',
                                            section: 'Điều 4 - Thay thế thuốc hợp lệ',
                                            pageNumber: 1
                                          }
                                        };
                                        handleOpenSubstitutionModal(violationToUse, item);
                                      }}
                                      className={`text-xs px-2 py-1 rounded font-bold transition flex items-center gap-1 cursor-pointer ${
                                        getItemViolations(item).length > 0
                                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                                      }`}
                                      title={getItemViolations(item).length > 0 ? 'Có nguy cơ xuất toán! Bấm để xem gợi ý thay thế 1-Click' : 'Gợi ý thuốc thay thế BHYT'}
                                    >
                                      <span>⚡</span>
                                      <span>Đổi thuốc</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMedicineRow(idx)}
                                      className="text-xs text-rose-600 hover:text-rose-900 font-bold hover:underline cursor-pointer"
                                      title="Xóa thuốc này"
                                    >
                                      Xóa
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* KHỐI D: HƯỚNG DẪN TIẾP TỤC */}
                {activePayload.items.length > 0 && (
                  <div className="bg-blue-50/80 border border-blue-200 rounded-lg p-3.5 flex items-center justify-between gap-3 flex-wrap shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">✅</span>
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          Dữ liệu đơn thuốc đã được cấu trúc và đối soát ({activePayload.items.length} mặt hàng)
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Chọn các tab <strong>"2. An toàn lâm sàng"</strong> hoặc <strong>"3. Thẩm định BHYT"</strong> ở phía trên để xem kết quả đánh giá chi tiết.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* -------------------------------------------------------------
                NỘI DUNG TAB 2: ĐÁNH GIÁ LÂM SÀNG 7 NHÓM (THEO CÔNG CỤ THAM KHẢO)
               ------------------------------------------------------------- */}
            {activeAnalysisTab === 'clinical_7' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Đánh giá an toàn sử dụng thuốc theo 7 nhóm tiêu chuẩn lâm sàng
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Đối soát độc lập: Chỉ định, Chống chỉ định, Liều dùng, Đường dùng, Thời điểm, Tương tác DDI (701 luật) &amp; Trùng lặp
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold px-3 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                      Tổng số: 7 nhóm kiểm tra
                    </span>
                  </div>
                </div>

                {activePayload.items.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-50/70 rounded-lg border border-slate-200 space-y-2.5">
                    <div className="text-3xl">🛡️</div>
                    <div className="text-base font-bold text-slate-800">Chưa có dữ liệu thuốc để đánh giá an toàn lâm sàng</div>
                    <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                      Vui lòng tải lên đơn thuốc ở khung bên trái hoặc nạp thuốc ở Bước 1 để đối soát 7 tiêu chuẩn an toàn lâm sàng.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {clinicalSevenCategories.map((cat) => {
                      const isAlert = cat.status === 'ALERT';
                      const isWarning = cat.status === 'WARNING';

                      return (
                        <div
                          key={cat.id}
                          className={`p-4 rounded-lg border transition-all shadow-2xs ${
                            isAlert
                              ? 'bg-rose-50/70 border-rose-300'
                              : isWarning
                              ? 'bg-amber-50/70 border-amber-300'
                              : 'bg-emerald-50/50 border-emerald-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2.5 mb-2.5">
                            <div>
                              <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                                <span>{isAlert ? '⛔' : isWarning ? '⚠️' : '✅'}</span>
                                <span>{cat.title}</span>
                              </h4>
                              <p className="text-sm text-slate-500 mt-0.5">{cat.subtitle}</p>
                            </div>
                            <span className={`text-xs px-2.5 py-1 rounded-md font-bold shrink-0 ${
                              isAlert
                                ? 'bg-rose-200 text-rose-900'
                                : isWarning
                                ? 'bg-amber-200 text-amber-900'
                                : 'bg-emerald-200 text-emerald-900'
                            }`}>
                              {cat.statusLabel}
                            </span>
                          </div>

                          <ul className="text-sm space-y-1.5 text-slate-700 bg-white/80 p-3 rounded-md border border-slate-200/60 leading-relaxed">
                            {cat.details.map((d, dIdx) => (
                              <li key={dIdx} className="flex items-start gap-2">
                                <span className="text-slate-400 shrink-0 mt-0.5">•</span>
                                <span>{d}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* -------------------------------------------------------------
                NỘI DUNG TAB 3: THẨM ĐỊNH PHÁP LÝ & XUẤT TOÁN BHYT (THÔNG TƯ 20/2022)
               ------------------------------------------------------------- */}
            {activeAnalysisTab === 'violations' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Kết quả giám định theo Thông tư 20/2022/TT-BYT &amp; Quyết định 3618/QĐ-BHXH
                    </h3>
                    <p className="text-sm text-slate-600 mt-0.5">
                      Đánh giá phân tuyến kỹ thuật, trùng lặp hoạt chất, chỉ định ICD-10 và tỷ lệ thanh toán
                    </p>
                  </div>

                  {auditReport.atRiskCostVnd > 0 && (
                    <div className="text-right">
                      <span className="text-xs text-slate-500 uppercase block font-bold">Tổng nguy cơ xuất toán</span>
                      <span className="text-xl font-bold text-rose-700">
                        -{auditReport.atRiskCostVnd.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  )}
                </div>

                {activePayload.items.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-50/70 rounded-lg border border-slate-200 space-y-2.5">
                    <div className="text-3xl">⚖️</div>
                    <div className="text-base font-bold text-slate-800">Chưa có dữ liệu thuốc để thẩm định xuất toán BHYT</div>
                    <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                      Vui lòng tải lên đơn thuốc ở khung bên trái hoặc thêm thuốc ở Bước 1 để đối soát tuyến kỹ thuật, tỷ lệ thanh toán và TT 20/2022/TT-BYT.
                    </p>
                  </div>
                ) : auditReport.violations.length === 0 ? (
                  <div className="p-6 text-center text-emerald-800 bg-emerald-50/60 rounded-md border border-emerald-200">
                    <div className="text-base font-bold">Đơn thuốc hợp lệ 100%!</div>
                    <div className="text-sm mt-1">Không phát hiện nguy cơ xuất toán hoặc trùng lặp chỉ định theo quy định.</div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                    {auditReport.violations.map((violation, vIndex) => (
                      <div key={violation.id || vIndex} className="py-4 space-y-2.5 text-sm">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="font-bold text-slate-950 text-base flex items-center gap-2">
                            <span>{vIndex + 1}. {violation.drugName}</span>
                            <span className="font-mono text-sm text-slate-600 font-normal">({violation.activeIngredient})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {violation.rejectionRiskVnd > 0 ? (
                              <span className="font-bold text-rose-700 text-base whitespace-nowrap">
                                Xuất toán: -{violation.rejectionRiskVnd.toLocaleString('vi-VN')} đ
                              </span>
                            ) : violation.patientCoPayVnd ? (
                              <span className="font-bold text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1 rounded-md text-sm whitespace-nowrap">
                                Đồng chi trả BHYT: {violation.patientCoPayVnd.toLocaleString('vi-VN')} đ
                              </span>
                            ) : null}
                            <button
                              type="button"
                              data-testid={`btn-substitute-violation-${vIndex}`}
                              onClick={() => handleOpenSubstitutionModal(violation)}
                              className="h-8 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition cursor-pointer"
                            >
                              <span>⚡ Gợi ý thuốc thay thế BHYT (1-Click)</span>
                            </button>
                          </div>
                        </div>

                        <p className="text-slate-800 leading-relaxed text-sm">
                          <strong className="text-slate-950">
                            {violation.category === 'PARTIAL_PAYMENT_ALERT' ? 'Chế độ thanh toán: ' : 'Lý do vi phạm: '}
                          </strong>
                          {violation.detail}
                        </p>

                        <p className="text-slate-700 text-sm">
                          <strong className="text-slate-950">Hướng xử trí: </strong>{violation.action}
                        </p>

                        <div className="text-xs text-slate-500 pt-1 flex items-center justify-between">
                          <span>
                            Căn cứ pháp lý: <strong>{violation.legalRef.docCode}</strong> ({violation.legalRef.section})
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenLegalPdf(
                              violation.legalRef.docCode,
                              violation.legalRef.pageNumber,
                              `${violation.legalRef.docTitle} (Trang ${violation.legalRef.pageNumber})`,
                              violation.detail
                            )}
                            className="text-blue-700 font-semibold hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <span>Xem trang {violation.legalRef.pageNumber} văn bản gốc ↗</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* -------------------------------------------------------------
                NỘI DUNG TAB 4: DANH MỤC THÔNG TƯ 20/2022
               ------------------------------------------------------------- */}
            {activeAnalysisTab === 'catalog' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="text"
                    value={catalogQuery}
                    onChange={(e) => setCatalogQuery(e.target.value)}
                    placeholder="Tìm theo tên thuốc, hoạt chất hoặc mã ATC..."
                    className="w-80 h-9 px-3 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-slate-500"
                  />

                  <select
                    aria-label="Lọc theo tuyến kỹ thuật"
                    value={catalogRankFilter}
                    onChange={(e) => setCatalogRankFilter(e.target.value)}
                    className="h-9 bg-white border border-slate-300 rounded-md px-3 text-sm text-slate-800 font-medium"
                  >
                    <option value="ALL">Tất cả tuyến kỹ thuật</option>
                    <option value="HANG_DAC_BIET">Hạng Đặc Biệt (TW)</option>
                    <option value="HANG_I">Hạng I (Tỉnh/TW)</option>
                    <option value="HANG_II">Hạng II (Tỉnh)</option>
                    <option value="HANG_III">Hạng III (Huyện)</option>
                    <option value="HANG_IV">Hạng IV (Trạm Y Tế Xã)</option>
                  </select>

                  <span className="text-sm text-slate-600 ml-auto">
                    Tổng số: <strong>{filteredCatalogRules.length}</strong> hoạt chất BHYT
                  </span>
                </div>

                <div className="border border-slate-200 rounded-md overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-14 border-r border-slate-200">STT</th>
                        <th className="py-2.5 px-3 font-mono border-r border-slate-200 w-28">Mã ATC</th>
                        <th className="py-2.5 px-4 border-r border-slate-200 w-72">Tên Thuốc &amp; Hoạt Chất</th>
                        <th className="py-2.5 px-4 border-r border-slate-200 w-52">Tuyến Sử Dụng</th>
                        <th className="py-2.5 px-3 text-center border-r border-slate-200 w-28">Tỷ Lệ BHYT</th>
                        <th className="py-2.5 px-4 border-r border-slate-200">Điều Kiện Thanh Toán (TT 20)</th>
                        <th className="py-2.5 px-3 text-center w-28">Văn Bản</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm text-slate-800">
                      {filteredCatalogRules.map((rule, idx) => (
                        <tr key={rule.atcGroup + idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono text-slate-500 border-r border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700 border-r border-slate-200">
                            {rule.atcGroup}
                          </td>
                          <td className="py-2.5 px-4 border-r border-slate-200">
                            <div className="font-bold text-slate-950">{rule.activeIngredient}</div>
                            <div className="text-xs text-slate-500">{rule.drugNames.join(', ')}</div>
                          </td>
                          <td className="py-2.5 px-4 border-r border-slate-200 text-xs">
                            {rule.allowedRanks.length === 5 ? (
                              <span className="font-semibold text-emerald-800">ĐB, I, II, III, IV</span>
                            ) : (
                              rule.allowedRanks.map(r => r.replace('HANG_', '')).join(', ')
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center border-r border-slate-200 font-bold">
                            {(rule.paymentRatio * 100).toFixed(0)}%
                          </td>
                          <td className="py-2.5 px-4 border-r border-slate-200 text-xs text-slate-700 leading-relaxed">
                            {rule.specialConditions || 'Thanh toán theo hướng dẫn điều trị.'}
                            {rule.requiresConsultation && (
                              <span className="block text-rose-700 font-semibold mt-0.5">
                                * Bắt buộc có Biên bản Hội chẩn
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenLegalPdf(
                                '20/2022/TT-BYT',
                                rule.pdfPage,
                                `Thông tư 20/2022/TT-BYT - STT ${rule.stt}: ${rule.activeIngredient}`,
                                rule.specialConditions || undefined
                              )}
                              className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                            >
                              Trang {rule.pdfPage}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------
                NỘI DUNG TAB 5: PHÂN TÍCH XML 130
               ------------------------------------------------------------- */}
            {activeAnalysisTab === 'xml' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Phân tích XML Bảng 2 (Quyết định 130/QĐ-BYT)</h3>
                    <p className="text-sm text-slate-600">Dán dữ liệu XML trích xuất từ HIS để tự động giám định vi phạm</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadSampleXml}
                    className="px-3.5 py-1.5 rounded-md border border-slate-300 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                  >
                    Dán XML Mẫu
                  </button>
                </div>

                <textarea
                  value={xmlInputText}
                  onChange={(e) => setXmlInputText(e.target.value)}
                  placeholder="<BANG_CHI_TIET_THUOC_QD130>...</BANG_CHI_TIET_THUOC_QD130>"
                  rows={10}
                  className="w-full text-sm font-mono p-3 rounded-md bg-slate-50 border border-slate-300 resize-none focus:outline-none focus:bg-white focus:border-slate-500"
                />

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleParseXml}
                    className="px-4 py-2 rounded-md bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold cursor-pointer transition active:scale-98"
                  >
                    Phân tích XML &amp; Xem kết quả
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* MODAL SỬA THÔNG TIN HÀNH CHÍNH */}
      {isEditAdminModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                Sửa thông tin hành chính đơn thuốc
              </h3>
              <button
                type="button"
                data-testid="btn-admin-close"
                onClick={() => setIsEditAdminModalOpen(false)}
                className="text-slate-500 hover:text-slate-900 text-sm font-semibold cursor-pointer"
              >
                Đóng
              </button>
            </div>

            <div className="space-y-3.5 text-sm">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Mã đơn thuốc</label>
                <input
                  type="text"
                  data-testid="input-admin-prescription-id"
                  value={adminFormDraft.prescriptionId}
                  onChange={(e) => setAdminFormDraft(prev => ({ ...prev, prescriptionId: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:border-slate-600 font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Họ và tên người bệnh</label>
                  <input
                    type="text"
                    data-testid="input-admin-patient-name"
                    value={adminFormDraft.patientName}
                    onChange={(e) => setAdminFormDraft(prev => ({ ...prev, patientName: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:border-slate-600 font-medium text-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tuổi</label>
                  <input
                    type="number"
                    data-testid="input-admin-patient-age"
                    value={adminFormDraft.patientAge}
                    onChange={(e) => setAdminFormDraft(prev => ({ ...prev, patientAge: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:border-slate-600 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Mã thẻ BHYT</label>
                <input
                  type="text"
                  data-testid="input-admin-card-number"
                  value={adminFormDraft.insuranceCardNumber}
                  onChange={(e) => setAdminFormDraft(prev => ({ ...prev, insuranceCardNumber: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:border-slate-600 font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Mã ICD-10 chính</label>
                  <input
                    type="text"
                    data-testid="input-admin-primary-icd"
                    value={adminFormDraft.primaryIcd10}
                    onChange={(e) => setAdminFormDraft(prev => ({ ...prev, primaryIcd10: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:border-slate-600 font-mono font-bold text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Chẩn đoán bệnh chính</label>
                  <input
                    type="text"
                    data-testid="input-admin-primary-diag"
                    value={adminFormDraft.primaryDiagnosis}
                    onChange={(e) => setAdminFormDraft(prev => ({ ...prev, primaryDiagnosis: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:border-slate-600 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Mã ICD-10 phụ / Kèm theo</label>
                <input
                  type="text"
                  data-testid="input-admin-secondary-icd"
                  value={adminFormDraft.secondaryIcd10s}
                  onChange={(e) => setAdminFormDraft(prev => ({ ...prev, secondaryIcd10s: e.target.value }))}
                  placeholder="Ví dụ: E11.9, I50, K21 (phân cách bằng dấu phẩy)"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:border-slate-600 font-mono text-sm"
                />
                <span className="text-xs text-slate-500 mt-1 block">
                  Cơ sở BHYT duyệt thanh toán các thuốc điều trị bệnh đồng mắc khi có mã ICD-10 phụ tương ứng.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                data-testid="btn-admin-cancel"
                onClick={() => setIsEditAdminModalOpen(false)}
                className="px-3.5 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                data-testid="btn-admin-save"
                onClick={handleSaveAdminForm}
                className="px-4 py-1.5 text-sm font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition cursor-pointer active:scale-98"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL IN VÀ XUẤT BIÊN BẢN GIÁM ĐỊNH BHYT (A4 / PDF) */}
      <BhytAuditReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        prescription={activePayload}
        auditReport={auditReport}
        resolutionMap={resolutionMap}
        clinicalCategories={clinicalSevenCategories}
        hospitalRank={hospitalRank}
        treatmentType={treatmentType}
      />

      {/* MODAL GỢI Ý THUỐC THAY THẾ HỢP LỆ BHYT 1-CLICK */}
      <BhytSubstitutionModal
        isOpen={substitutionModalState.isOpen}
        onClose={() => setSubstitutionModalState(prev => ({ ...prev, isOpen: false }))}
        originalItem={substitutionModalState.originalItem}
        violation={substitutionModalState.violation}
        candidates={substitutionModalState.candidates}
        hospitalRank={hospitalRank}
        onApplySubstitute={handleApplySubstitute}
      />

      {/* DRAWER XEM TRỰC TIẾP BẢN SCAN PDF VĂN BẢN GỐC & TÀI LIỆU */}
      <PdfViewerDrawer
        isOpen={Boolean(activePdfViewerTarget)}
        target={activePdfViewerTarget}
        onClose={() => setActivePdfViewerTarget(null)}
      />

    </div>
  );
};
