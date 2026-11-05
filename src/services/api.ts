import type { RegistryPageResponse } from '../types/registry';
import { loadOfflineRegistry, getOfflineCachedDrug } from '../components/Modals/NationalDrugRegistry/offlineRegistry';
import { SmoothStreamBuffer } from '../utils/nlp/streamBuffer';

import { getApiBaseUrl } from '../config/apiConfig';

/**
 * API Service connecting Frontend to Backend (Render / Local)
 * Adheres to Thông tư 22/2011, TT 20/2017, TT 36/2018, NĐ 98/2021, NĐ 151/2017, NĐ 130/2018
 */

export const API_BASE_URL = getApiBaseUrl();
const ROOT_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, { ...init, credentials: 'include' });
}

export async function checkBackendHealth(): Promise<{ status: string; system: string; legal_compliance: string[] } | null> {
  try {
    const res = await apiFetch(`${ROOT_URL}/`, { method: 'GET' });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

// 1. Debts (Sổ nợ tủ trực lâm sàng)
export async function getDebtsApi(params?: { status?: string; search?: string }) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  const res = await apiFetch(`${API_BASE_URL}/debts?${query.toString()}`);
  if (!res.ok) throw new Error('Không thể tải sổ nợ từ máy chủ');
  return res.json();
}

export async function borrowEmergencyItemApi(payload: {
  item_name: string;
  item_type: string;
  quantity: number;
  patient_name: string;
  patient_room: string;
  borrower: string;
  clinical_reason: string;
  pin_code?: string;
  auth_method?: string;
}) {
  const res = await apiFetch(`${API_BASE_URL}/debts/borrow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Lỗi lập phiếu mượn khẩn');
  return res.json();
}

export async function returnAmpouleApi(debtId: string) {
  const res = await apiFetch(`${API_BASE_URL}/debts/${debtId}/return-ampoule`, {
    method: 'PUT'
  });
  if (!res.ok) throw new Error('Lỗi ghi nhận thu hồi vỏ ống');
  return res.json();
}

export async function settleDebtApi(debtId: string, payload: { settler: string; pin_code?: string; auth_method?: string }) {
  const res = await apiFetch(`${API_BASE_URL}/debts/${debtId}/settle`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (res.status === 409) {
    const errData = await res.json();
    throw new Error(errData.detail || 'Bắt buộc thu hồi vỏ ống trước khi duyệt hoàn bù');
  }
  if (!res.ok) throw new Error('Lỗi duyệt hoàn bù phiếu nợ');
  return res.json();
}

export async function destroyAmpoulesApi(payload: {
  pharmacist_name: string;
  nurse_name: string;
  doctor_witness?: string;
  method: string;
}) {
  const res = await apiFetch(`${API_BASE_URL}/debts/destroy-ampoules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Lỗi tiêu hủy vỏ ống gây nghiện');
  return res.json();
}

// 2. Equipment (Sự cố & Thiết bị y tế)
export async function getEquipmentTicketsApi(params?: { urgency?: string; status?: string; search?: string }) {
  const query = new URLSearchParams();
  if (params?.urgency) query.set('urgency', params.urgency);
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  const res = await apiFetch(`${API_BASE_URL}/equipment?${query.toString()}`);
  if (!res.ok) throw new Error('Không thể tải danh sách thiết bị');
  return res.json();
}

export async function reportIncidentApi(payload: {
  device_name: string;
  device_model: string;
  serial_number: string;
  risk_class: string;
  location: string;
  accessory_issue: string;
  urgency?: string;
  assigned_engineer?: string;
}) {
  const res = await apiFetch(`${API_BASE_URL}/equipment/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Lỗi lập phiếu báo hỏng thiết bị');
  return res.json();
}

export async function handoverEquipmentApi(ticketId: string, payload: {
  assigned_engineer: string;
  clinical_receiver: string;
  test_result: string;
  pin_code?: string;
  auth_method?: string;
}) {
  const res = await apiFetch(`${API_BASE_URL}/equipment/${ticketId}/handover`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Lỗi ký biên bản nghiệm thu bàn giao');
  return res.json();
}

// 3. Inventory & FEFO (Kho dược & Hạn dùng)
export async function getInventoryBatchesApi(params?: { near_expiry?: boolean; low_stock?: boolean; search?: string }) {
  const query = new URLSearchParams();
  if (params?.near_expiry !== undefined) query.set('near_expiry', String(params.near_expiry));
  if (params?.low_stock !== undefined) query.set('low_stock', String(params.low_stock));
  if (params?.search) query.set('search', params.search);
  const res = await apiFetch(`${API_BASE_URL}/inventory/batches?${query.toString()}`);
  if (!res.ok) throw new Error('Không thể tải dữ liệu kho dược');
  return res.json();
}

export async function dispatchFefoBatchApi(batchId: string, payload: { quantity: number; reason?: string }) {
  const res = await apiFetch(`${API_BASE_URL}/inventory/batches/${batchId}/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'Lỗi xuất kho FEFO');
  }
  return res.json();
}

export async function createRestockProposalApi(payload: {
  batch_ids: string[];
  pharmacist_name: string;
  urgency_reason: string;
}) {
  const res = await apiFetch(`${API_BASE_URL}/inventory/restock-proposal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Lỗi lập phiếu dự trù Mẫu 01/TT22');
  return res.json();
}

// 4. Cold Chain & Datalogger
export async function getColdChainStatusApi() {
  const res = await apiFetch(`${API_BASE_URL}/coldchain/status`);
  if (!res.ok) throw new Error('Không thể tải trạng thái chuỗi lạnh');
  return res.json();
}

export async function simulateOutageApi() {
  const res = await apiFetch(`${API_BASE_URL}/coldchain/simulate-outage`, { method: 'POST' });
  if (!res.ok) throw new Error('Lỗi mô phỏng mất điện chuỗi lạnh');
  return res.json();
}

export async function restorePowerApi() {
  const res = await apiFetch(`${API_BASE_URL}/coldchain/restore-power`, { method: 'POST' });
  if (!res.ok) throw new Error('Lỗi khôi phục điện lưới buồng lạnh');
  return res.json();
}

export async function releaseQuarantineApi(payload: {
  signer_name: string;
  pharmacist_name: string;
  vvm_level_confirmed: number;
  mkt_confirmed: number;
  clinical_notes?: string;
}) {
  const res = await apiFetch(`${API_BASE_URL}/coldchain/release-quarantine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Lỗi giải phóng lô vắc xin biệt trữ');
  return res.json();
}

// 5. Assets (Tài sản công NĐ 151)
export async function getAssetsApi(params?: { misallocated?: boolean; liquidation?: boolean; search?: string }) {
  const query = new URLSearchParams();
  if (params?.misallocated !== undefined) query.set('misallocated', String(params.misallocated));
  if (params?.liquidation !== undefined) query.set('liquidation', String(params.liquidation));
  if (params?.search) query.set('search', params.search);
  const res = await apiFetch(`${API_BASE_URL}/assets?${query.toString()}`);
  if (!res.ok) throw new Error('Không thể tải danh mục tài sản');
  return res.json();
}

export async function scanQrAssetApi(assetId: string) {
  const res = await apiFetch(`${API_BASE_URL}/assets/${assetId}/scan-qr`, { method: 'POST' });
  if (!res.ok) throw new Error('Lỗi quét mã QR tài sản');
  return res.json();
}

export async function transferAssetApi(assetId: string, payload: {
  new_department: string;
  engineer_name: string;
  receiver_name: string;
  transfer_reason: string;
}) {
  const res = await apiFetch(`${API_BASE_URL}/assets/${assetId}/transfer`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Lỗi ký biên bản điều chuyển tài sản Mẫu 01/TSC-ĐC');
  return res.json();
}

export async function liquidateAssetApi(assetId: string, payload: {
  director_name: string;
  reason: string;
}) {
  const res = await apiFetch(`${API_BASE_URL}/assets/${assetId}/liquidate`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Lỗi lập tờ trình thanh lý tài sản NĐ 151');
  return res.json();
}

// 6. Audit Ledger & Cryptographic Integrity
export async function getAuditLedgerApi() {
  const res = await apiFetch(`${API_BASE_URL}/audit/ledger`);
  if (!res.ok) throw new Error('Không thể tải sổ kiểm toán lâm sàng');
  return res.json();
}

export async function verifyAuditIntegrityApi(): Promise<{
  is_valid: boolean;
  total_records: number;
  broken_at_id: string | null;
  message: string;
}> {
  const res = await apiFetch(`${API_BASE_URL}/audit/verify-integrity`);
  if (!res.ok) throw new Error('Lỗi kiểm tra tính toàn vẹn chuỗi băm');
  return res.json();
}

// 7. Copilot AI Assistant (Hỗ trợ AMIE Multi-turn Context Session & Pure RAG)
export async function chatCopilotApi(query: string, userRole: string, userName: string, sessionId?: string) {
  const res = await apiFetch(`${API_BASE_URL}/copilot/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, user_role: userRole, user_name: userName, session_id: sessionId })
  });
  if (!res.ok) throw new Error('Lỗi gửi tin nhắn đến Trợ lý AI');
  return res.json();
}

/**
 * Server-Sent Events (SSE) Token Streaming cho Copilot AI Assistant.
 * Giảm Time-to-First-Token (TTFT) xuống < 200ms với hiệu ứng Typewriter mượt mà.
 */
export async function chatCopilotApiStream(
  query: string,
  userRole: string,
  userName: string,
  sessionId?: string,
  onToken?: (token: string, currentFullText: string) => void
): Promise<any> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/copilot/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, user_role: userRole, user_name: userName, session_id: sessionId })
    });
  } catch {
    // Fallback nếu mạng hoặc server không hỗ trợ SSE stream
    return chatCopilotApi(query, userRole, userName, sessionId);
  }

  if (!response.ok || !response.body) {
    return chatCopilotApi(query, userRole, userName, sessionId);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulatedText = '';
  let finalResponseData: any = null;
  let buffer = '';
  const streamBuffer = onToken ? new SmoothStreamBuffer(onToken) : null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.type === 'token') {
            accumulatedText += parsed.content;
            if (streamBuffer) {
              streamBuffer.push(parsed.content);
            } else {
              onToken?.(parsed.content, accumulatedText);
            }
          } else if (parsed.type === 'done') {
            finalResponseData = parsed.response;
          }
        } catch {
          // bỏ qua chunk JSON chưa hoàn chỉnh
        }
      }
    }

    if (streamBuffer) {
      await streamBuffer.finish();
    }
  } finally {
    streamBuffer?.stop();
  }

  if (finalResponseData) {
    if (!finalResponseData.reply_text && accumulatedText) {
      finalResponseData.reply_text = accumulatedText;
    }
    return finalResponseData;
  }

  return { reply_text: accumulatedText };
}

export type DdiPairApiResponse = {
  has_interaction: boolean;
  source_status?: 'indexed_match' | 'not_indexed' | 'backend_error';
  source?: string;
  coverage_note?: string;
  alert: null | {
    rule_id: string; severity: string; title: string; drug_a: string; drug_b: string;
    mechanism: string; consequence: string; action: string; source: string;
    escalated?: boolean; escalation_reason?: string | null;
  };
};

/** Tra cứu DDI từ cùng engine FastAPI dùng cho kiểm kê lâm sàng. */
export async function checkPairDdiApi(drugA: string, drugB: string): Promise<DdiPairApiResponse> {
  const res = await apiFetch(`${API_BASE_URL}/clinical-ddi/check-pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drug_a: drugA, drug_b: drugB })
  });
  if (!res.ok) throw new Error(`DDI backend error: ${res.status}`);
  return res.json();
}

export async function auditPrescriptionDdiApi(drugs: string[]) {
  const res = await apiFetch(`${API_BASE_URL}/clinical-ddi/audit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drugs })
  });
  if (!res.ok) throw new Error(`DDI audit backend error: ${res.status}`);
  return res.json() as Promise<{ pair_alerts: Array<{ severity: string; title: string; consequence: string; action: string; source: string }>; has_contraindication: boolean; analyzed_pairs_count: number; normalized_drugs: Array<{ raw: string; inn: string; display: string }> }>;
}

export async function queryPureRagApi(query: string, userRole: string = 'nurse', userName: string = 'ĐD. Lê Thị Thu', patientInfo?: any) {
  const res = await apiFetch(`${API_BASE_URL}/copilot/rag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, user_role: userRole, user_name: userName, patient_info: patientInfo })
  });
  if (!res.ok) throw new Error('Lỗi gửi truy vấn RAG y tế');
  return res.json();
}

// 8. National Drug Registry (55.000 SĐK)

export async function getNationalDrugRegistryApi(params?: {
  search?: string;
  group?: string;
  pharmGroup?: string;
  page?: number;
  pageSize?: number;
  onlyInWarehouse?: boolean;
}): Promise<RegistryPageResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.group && params.group !== 'all') query.set('group', params.group);
  if (params?.pharmGroup && params.pharmGroup !== 'all') query.set('pharm_group', params.pharmGroup);
  if (params?.page) query.set('page', params.page.toString());
  if (params?.pageSize) query.set('page_size', (params.pageSize || 50).toString());
  if (params?.onlyInWarehouse) query.set('only_in_warehouse', 'true');

  const res = await apiFetch(`${API_BASE_URL}/registry/catalog?${query.toString()}`);
  if (!res.ok) throw new Error('Không thể nạp danh mục dược quốc gia từ máy chủ');
  return res.json();
}

export async function getDrugDocumentsApi(nationalCode: string) {
  const res = await apiFetch(`${API_BASE_URL}/registry/${encodeURIComponent(nationalCode)}/documents`);
  if (!res.ok) throw new Error('Không thể tra cứu tài liệu số hóa của thuốc từ máy chủ');
  return res.json();
}

const drugDetailCache = new Map<string, any>();

export function getCachedDrugDetail(nationalCode?: string | null): any | null {
  if (!nationalCode) return null;
  const norm = nationalCode.trim().toLowerCase();
  if (drugDetailCache.has(norm)) {
    return drugDetailCache.get(norm);
  }
  const fromOffline = getOfflineCachedDrug(norm);
  if (fromOffline) {
    drugDetailCache.set(norm, fromOffline);
    return fromOffline;
  }
  return null;
}

export function setCachedDrugDetail(nationalCode: string, data: any): void {
  if (!nationalCode || !data) return;
  const norm = nationalCode.trim().toLowerCase();
  drugDetailCache.set(norm, data);
}

export async function getDrugDetailApi(nationalCode: string, refresh = false) {
  if (!nationalCode) return null;
  const norm = nationalCode.trim().toLowerCase();
  if (!refresh && drugDetailCache.has(norm)) {
    return drugDetailCache.get(norm);
  }

  const url = `${API_BASE_URL}/registry/${encodeURIComponent(nationalCode)}${refresh ? '?refresh=true' : ''}`;
  try {
    const res = await apiFetch(url, refresh ? { cache: 'no-store' } : undefined);
    if (res.ok) {
      const data = await res.json();
      if (data) {
        drugDetailCache.set(norm, data);
        return data;
      }
    }
  } catch {}
  try {
    const list = await loadOfflineRegistry();
    const match = list.find((d: any) => [d.national_code,d.nationalCode,d.id,d.registrationNumber].some((value) => typeof value === 'string' && value.trim().toLowerCase() === norm));
    if (match) {
      drugDetailCache.set(norm, match);
      return match;
    }
  } catch {}
  return null;
}

