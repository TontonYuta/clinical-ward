/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BHYT Claims Adjudication API Client (Hybrid Local-First)
 * Tự động gọi FastAPI backend và fallback offline in-memory cache nếu mất mạng
 */

import { apiRequest } from './client';
import {
  BhytPrescriptionPayload,
  BhytAuditReport,
  HospitalRank,
  DrugResolutionResult,
  DrugBatchResolutionResponse
} from '../../types/bhyt';
import {
  searchBhytRules,
  BhytDrugRule,
  BHYT_DRUG_RULES
} from '../../data/bhytDrugRules';
import { auditBhytPrescription } from '../bhytAuditEngine';

export interface BhytCatalogResponse {
  total: number;
  items: Array<{
    id: string;
    stt_thong_tu_20?: number;
    atc_code: string;
    active_ingredient: string;
    brand_names: string[];
    route: string;
    allowed_ranks: HospitalRank[];
    payment_ratio: number;
    requires_consultation: boolean;
    max_outpatient_days: number;
    approved_icd10_prefixes?: string[];
    forbidden_icd10_prefixes?: string[];
    special_conditions?: string;
    pdf_page: number;
  }>;
}

export interface BhytOcrPrescriptionResponse {
  success: boolean;
  is_valid_document?: boolean;
  document_classification?: string;
  warning_code?: string;
  provider: string;
  model_used?: string;
  prescription: BhytPrescriptionPayload;
  resolved_count: number;
  total_items: number;
  message?: string;
}

export const bhytApi = {
  /**
   * Tra cứu danh mục quy tắc BHYT (Thông tư 20/2022/TT-BYT)
   */
  async getCatalog(params: {
    q?: string;
    rank?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<BhytCatalogResponse> {
    const { q = '', rank = 'ALL', limit = 100, offset = 0 } = params;
    const searchParams = new URLSearchParams({
      q,
      rank,
      limit: String(limit),
      offset: String(offset)
    });

    try {
      return await apiRequest<BhytCatalogResponse>(`/bhyt/catalog?${searchParams.toString()}`, {
        timeoutMs: 3000
      });
    } catch (err) {
      // Fallback Offline In-Memory
      let rules = searchBhytRules(q);
      if (rank !== 'ALL') {
        rules = rules.filter(r => r.allowedRanks.includes(rank as HospitalRank));
      }
      const total = rules.length;
      const paged = rules.slice(offset, offset + limit);

      return {
        total,
        items: paged.map((r, idx) => ({
          id: `BHYT-LOCAL-${idx + 1}`,
          atc_code: r.atcGroup,
          active_ingredient: r.activeIngredient,
          brand_names: r.drugNames,
          route: 'Uống',
          allowed_ranks: r.allowedRanks,
          payment_ratio: r.paymentRatio,
          requires_consultation: r.requiresConsultation,
          max_outpatient_days: 30,
          approved_icd10_prefixes: r.approvedIcd10Prefixes,
          forbidden_icd10_prefixes: r.forbiddenIcd10Prefixes,
          special_conditions: r.specialConditions,
          pdf_page: r.pdfPage
        }))
      };
    }
  },

  /**
   * Giám định đơn thuốc BHYT (Backend First với Fallback Offline <5ms)
   */
  async auditPrescription(payload: BhytPrescriptionPayload): Promise<BhytAuditReport> {
    try {
      const backendPayload = {
        prescription_id: payload.prescriptionId || 'RX-BHYT',
        patient_name: payload.patientName,
        patient_age: payload.patientAge,
        insurance_card_number: payload.insuranceCardNumber,
        hospital_rank: payload.hospitalRank,
        treatment_type: payload.treatmentType,
        primary_icd10: payload.primaryIcd10,
        primary_diagnosis: payload.primaryDiagnosis,
        secondary_icd10s: payload.secondaryIcd10s || [],
        items: payload.items.map(it => ({
          id: it.id,
          drug_code: it.drugCode || '',
          drug_name: it.drugName,
          active_ingredient: it.activeIngredient || '',
          dosage: it.dosage || '',
          route: it.route || 'Uống',
          quantity: it.quantity,
          days_supply: it.daysSupply,
          unit_price: it.unitPrice,
          instructions: it.instructions || '',
          has_consultation_form: Boolean(it.hasConsultationForm)
        }))
      };

      const res = await apiRequest<any>('/bhyt/audit', {
        method: 'POST',
        body: JSON.stringify(backendPayload),
        timeoutMs: 4000
      });

      return {
        status: res.status,
        evaluatedAt: res.evaluated_at,
        hospitalRank: res.hospital_rank,
        treatmentType: res.treatment_type,
        primaryIcd10: res.primary_icd10,
        primaryDiagnosis: res.primary_diagnosis,
        totalCostVnd: res.total_cost_vnd,
        atRiskCostVnd: res.at_risk_cost_vnd,
        itemsCount: res.items_count,
        passCount: res.pass_count,
        warningCount: res.warning_count,
        rejectCount: res.reject_count,
        violations: res.violations.map((v: any) => ({
          id: v.id,
          drugCode: v.drug_code,
          drugName: v.drug_name,
          activeIngredient: v.active_ingredient,
          severity: v.severity,
          category: v.category,
          title: v.title,
          detail: v.detail,
          rejectionRiskVnd: v.rejection_risk_vnd,
          action: v.action,
          legalRef: {
            docCode: v.legal_ref.doc_code,
            docTitle: v.legal_ref.doc_title,
            section: v.legal_ref.section,
            pageNumber: v.legal_ref.page_number,
            localPdfPath: v.legal_ref.local_pdf_path
          }
        }))
      };
    } catch (err: any) {
      // Ghi nhận log cảnh báo offline fallback lên backend để monitor theo dõi
      apiRequest('/bhyt/log', {
        method: 'POST',
        body: JSON.stringify({
          prescription_id: payload.prescriptionId || 'RX-BHYT',
          patient_name: payload.patientName,
          insurance_card_number: payload.insuranceCardNumber,
          hospital_rank: payload.hospitalRank,
          treatment_type: payload.treatmentType,
          primary_icd10: payload.primaryIcd10,
          status: 'WARNING',
          error_detail: `Offline fallback: ${err?.message || 'Yêu cầu mạng không phản hồi, đã tự động chuyển sang động cơ offline'}`
        })
      }).catch(() => {});

      // Offline fallback: Động cơ offline <5ms
      return auditBhytPrescription(payload);
    }
  },

  /**
   * Lấy lịch sử các ca giám định
   */
  async getAuditLogs(limit: number = 20): Promise<any[]> {
    try {
      return await apiRequest<any[]>(`/bhyt/logs?limit=${limit}`, { timeoutMs: 3000 });
    } catch {
      return [];
    }
  },

  /**
   * Phân giải một thực thể thuốc (Hybrid Entity Resolution)
   */
  async resolveDrug(rawQuery: string): Promise<DrugResolutionResult> {
    try {
      return await apiRequest<DrugResolutionResult>('/bhyt/resolve-drug', {
        method: 'POST',
        body: JSON.stringify({ raw_query: rawQuery }),
        timeoutMs: 4000
      });
    } catch {
      return {
        raw_query: rawQuery,
        cleaned_name: rawQuery,
        confidence_score: 0.5,
        match_status: 'LOW',
        match_strategy: 'OFFLINE_FALLBACK',
        alternatives: []
      };
    }
  },

  /**
   * Phân giải hàng loạt thực thể thuốc (cho OCR đơn thuốc và bảng HITL)
   */
  async batchResolveDrugs(rawDrugs: string[]): Promise<DrugBatchResolutionResponse> {
    try {
      return await apiRequest<DrugBatchResolutionResponse>('/bhyt/batch-resolve-drugs', {
        method: 'POST',
        body: JSON.stringify({ raw_drugs: rawDrugs }),
        timeoutMs: 8000
      });
    } catch {
      return {
        total: rawDrugs.length,
        resolved_count: 0,
        results: rawDrugs.map(r => ({
          raw_query: r,
          cleaned_name: r,
          confidence_score: 0.0,
          match_status: 'UNRESOLVED',
          match_strategy: 'OFFLINE_ERROR',
          alternatives: []
        }))
      };
    }
  },

  /**
   * Trích xuất đa phương thức (Vision OCR) đơn thuốc và tự động đối soát DAV
   * Hỗ trợ Gemini Multimodal hoặc nhà cung cấp bên thứ 3 (OpenAI/Qwen-VL)
   */
  async ocrPrescription(
    imageBase64: string,
    mimeType: string = 'image/jpeg',
    rawText?: string
  ): Promise<BhytOcrPrescriptionResponse> {
    try {
      return await apiRequest<BhytOcrPrescriptionResponse>('/bhyt/ocr-prescription', {
        method: 'POST',
        body: JSON.stringify({
          image_base64: imageBase64,
          mime_type: mimeType,
          raw_text: rawText
        }),
        timeoutMs: 30000
      });
    } catch (err) {
      console.warn('[BHYT OCR] Backend OCR failed or offline, fallback used:', err);
      return {
        success: false,
        provider: 'offline_fallback',
        model_used: 'client_spatial_parser',
        prescription: {
          prescription_id: 'RX-FALLBACK-OFFLINE',
          patient_name: 'Bệnh nhân BHYT',
          patient_age: 50,
          insurance_card_number: 'GD4790000000000',
          hospital_rank: 'HANG_I',
          treatment_type: 'NGOAI_TRU',
          primary_icd10: 'I10',
          primary_diagnosis: 'Tăng huyết áp',
          secondary_icd10s: [],
          items: []
        },
        resolved_count: 0,
        total_items: 0,
        message: 'Ngoại tuyến: Đã nạp cấu trúc đơn thuốc dự phòng'
      };
    }
  }
};
