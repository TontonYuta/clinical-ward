import {
  TelemetryOverviewResponse,
  ApiKeyItem,
  BudgetCapResponse,
  BudgetCapConfig,
  TestKeyResponse,
  EsmsStatusResponse,
  GasStatusResponse,
  BhytAuditLogItem,
  PaginatedTelemetryResponse,
  FeatureFlagResponse,
  KnowledgeDocumentItem,
  IngestPdfResponse,
  PdfInspectResponse,
  DocumentQueryResponse,
  CleanlinessAuditResponse,
  KnowledgeChatTestResponse
} from '../types/admin';
import { getAdminToken } from './authApi';

const BASE_URL = '/api/v1/admin';

export class AdminApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'AdminApiError';
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(options.headers || {});
  const token = getAdminToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: options.credentials ?? 'include',
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

export async function fetchTelemetryOverview(): Promise<TelemetryOverviewResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/monitoring/overview`, {}, 8000);
  if (!res.ok) throw new Error(`Lỗi tải dữ liệu giám sát: HTTP ${res.status}`);
  return res.json();
}

export async function fetchFeatureFlags(): Promise<FeatureFlagResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/feature-flags`, {}, 8000);
  if (!res.ok) throw new Error(`Lỗi tải cấu hình tab: HTTP ${res.status}`);
  return res.json();
}

export async function updateFeatureFlags(payload: FeatureFlagResponse): Promise<FeatureFlagResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/feature-flags`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }, 8000);
  if (!res.ok) throw new AdminApiError(`Lỗi lưu cấu hình tab: HTTP ${res.status}`, res.status);
  return res.json();
}

export async function fetchPaginatedTelemetry(params: {
  page?: number;
  pageSize?: number;
  eventType?: string;
  modelName?: string;
  userRole?: string;
  q?: string;
} = {}): Promise<PaginatedTelemetryResponse> {
  const qp = new URLSearchParams();
  if (params.page) qp.set('page', String(params.page));
  if (params.pageSize) qp.set('page_size', String(params.pageSize));
  if (params.eventType && params.eventType !== 'all' && params.eventType !== 'ALL') qp.set('event_type', params.eventType);
  if (params.modelName && params.modelName !== 'all' && params.modelName !== 'ALL') qp.set('model_name', params.modelName);
  if (params.userRole && params.userRole !== 'all' && params.userRole !== 'ALL') qp.set('user_role', params.userRole);
  if (params.q && params.q.trim()) qp.set('q', params.q.trim());

  const res = await fetchWithTimeout(`${BASE_URL}/monitoring/telemetry-logs?${qp.toString()}`, {}, 8000);
  if (!res.ok) throw new Error(`Lỗi tải nhật ký telemetry: HTTP ${res.status}`);
  return res.json();
}

export async function fetchBhytAuditLogs(limit: number = 50, status?: string, q?: string): Promise<BhytAuditLogItem[]> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (status && status !== 'ALL') params.set('status', status);
  if (q && q.trim()) params.set('q', q.trim());
  const res = await fetchWithTimeout(`${BASE_URL}/monitoring/bhyt-logs?${params.toString()}`, {}, 8000);
  if (!res.ok) throw new Error(`Lỗi tải nhật ký giám định BHYT: HTTP ${res.status}`);
  return res.json();
}

export async function fetchApiKeys(): Promise<ApiKeyItem[]> {
  const res = await fetchWithTimeout(`${BASE_URL}/keys`, {}, 8000);
  if (!res.ok) throw new Error(`Lỗi tải danh sách API Key: HTTP ${res.status}`);
  return res.json();
}

export async function addApiKey(name: string, apiKey: string, provider: string = 'gemini'): Promise<ApiKeyItem> {
  const res = await fetchWithTimeout(`${BASE_URL}/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, api_key: apiKey, provider }),
  }, 8000);
  if (!res.ok) throw new Error(`Lỗi thêm khóa API: HTTP ${res.status}`);
  return res.json();
}

export async function deleteApiKey(keyId: string): Promise<boolean> {
  const res = await fetchWithTimeout(`${BASE_URL}/keys/${keyId}`, { method: 'DELETE' }, 8000);
  return res.ok;
}

export async function triggerAutoHeartbeat(): Promise<ApiKeyItem[]> {
  const res = await fetchWithTimeout(`${BASE_URL}/keys/auto-heartbeat`, { method: 'POST' }, 8000);
  if (!res.ok) throw new Error(`Lỗi tự động quét API Key: HTTP ${res.status}`);
  return res.json();
}

export async function testApiKey(keyId?: string, apiKey?: string, provider?: string): Promise<TestKeyResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/keys/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key_id: keyId, api_key: apiKey, provider }),
  }, 10000);
  if (!res.ok) throw new Error(`Lỗi kiểm tra kết nối API Key: HTTP ${res.status}`);
  return res.json();
}

export async function fetchBudgetStatus(): Promise<BudgetCapResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/budget`, {}, 8000);
  if (!res.ok) throw new Error(`Lỗi tải thông tin ngân sách Token: HTTP ${res.status}`);
  return res.json();
}

export async function updateBudgetConfig(cfg: BudgetCapConfig): Promise<BudgetCapConfig> {
  const res = await fetchWithTimeout(`${BASE_URL}/budget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  }, 8000);
  if (!res.ok) throw new Error(`Lỗi cập nhật ngân sách Token: HTTP ${res.status}`);
  return res.json();
}

// === CỔNG VIỄN THÔNG eSMS.vn & GOOGLE APPS SCRIPT ===

export async function fetchEsmsStatus(): Promise<EsmsStatusResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/integrations/esms/status`, {}, 8000);
  if (!res.ok) throw new Error(`Lỗi tải trạng thái eSMS: HTTP ${res.status}`);
  return res.json();
}

export async function pingEsms(apiKey?: string, secretKey?: string) {
  const res = await fetchWithTimeout(`${BASE_URL}/integrations/esms/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, secret_key: secretKey }),
  }, 10000);
  if (!res.ok) throw new Error(`Lỗi ping eSMS: HTTP ${res.status}`);
  return res.json();
}

export async function updateEsmsConfig(payload: { api_key?: string; secret_key?: string; brandname?: string; is_sandbox?: boolean }): Promise<EsmsStatusResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/integrations/esms/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, 8000);
  if (!res.ok) throw new Error(`Lỗi cập nhật cấu hình eSMS: HTTP ${res.status}`);
  return res.json();
}

export async function fetchGasStatus(): Promise<GasStatusResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/integrations/gas/status`, {}, 8000);
  if (!res.ok) throw new Error(`Lỗi tải trạng thái GAS: HTTP ${res.status}`);
  return res.json();
}

export async function pingGas(webhookUrl?: string) {
  const payload = webhookUrl ? { webhook_url: webhookUrl } : {};
  const res = await fetchWithTimeout(`${BASE_URL}/integrations/gas/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, 10000);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.detail) detail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
    } catch {}
    throw new Error(`Lỗi ping GAS: ${detail}`);
  }
  return res.json();
}

export async function updateGasConfig(webhookUrl: string): Promise<GasStatusResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/integrations/gas/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhook_url: webhookUrl }),
  }, 8000);
  if (!res.ok) throw new Error(`Lỗi cập nhật cấu hình GAS: HTTP ${res.status}`);
  return res.json();
}

export async function fetchKnowledgeDocuments(): Promise<KnowledgeDocumentItem[]> {
  const res = await fetchWithTimeout(`${BASE_URL}/knowledge/documents`, {}, 8000);
  if (!res.ok) throw new Error(`Lỗi tải danh mục tài liệu: HTTP ${res.status}`);
  const data = await res.json();
  return data.documents || [];
}

export async function inspectKnowledgePdf(file: File): Promise<PdfInspectResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetchWithTimeout(`${BASE_URL}/knowledge/inspect-pdf`, {
    method: 'POST',
    body: formData,
  }, 20000);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.detail) detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } catch {}
    throw new Error(`Không thể kiểm tra tệp PDF: ${detail}`);
  }
  return res.json();
}

export async function uploadKnowledgePdf(formData: FormData): Promise<IngestPdfResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/knowledge/upload-pdf`, {
    method: 'POST',
    body: formData,
  }, 120000);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.detail) detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } catch {}
    throw new Error(`Lỗi nạp tài liệu: ${detail}`);
  }
  return res.json();
}

export async function queryKnowledgeDocuments(query: string, docId?: string, topK: number = 5): Promise<DocumentQueryResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/knowledge/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, doc_id: docId || null, top_k: topK }),
  }, 15000);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.detail) detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } catch {}
    throw new Error(`Lỗi truy vấn tài liệu: ${detail}`);
  }
  return res.json();
}

export async function deleteKnowledgeDocument(docId: string): Promise<{ status: string; deleted_doc_id: string }> {
  const res = await fetchWithTimeout(`${BASE_URL}/knowledge/documents/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
  }, 15000);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.detail) detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } catch {}
    throw new Error(`Lỗi xóa tài liệu: ${detail}`);
  }
  return res.json();
}

export async function auditDocumentCleanliness(file?: File, docId?: string): Promise<CleanlinessAuditResponse> {
  const formData = new FormData();
  if (file) formData.append('file', file);
  if (docId) formData.append('doc_id', docId);

  const res = await fetchWithTimeout(`${BASE_URL}/knowledge/audit-cleanliness`, {
    method: 'POST',
    body: formData,
  }, 30000);

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.detail) detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } catch {}
    throw new Error(`Lỗi kiểm định độ sạch: ${detail}`);
  }
  return res.json();
}

export async function chatTestKnowledge(
  query: string,
  docId?: string,
  userRole: string = 'doctor',
  userName: string = 'BS. Quản Trị Viên'
): Promise<KnowledgeChatTestResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/knowledge/chat-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      doc_id: docId || null,
      user_role: userRole,
      user_name: userName
    }),
  }, 35000);

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.detail) detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } catch {}
    throw new Error(`Lỗi kiểm thử Chatbot: ${detail}`);
  }
  return res.json();
}

export async function chatTestKnowledgeStream(
  query: string,
  docId?: string,
  userRole: string = 'doctor',
  userName: string = 'BS. Quản Trị Viên',
  onToken?: (token: string, currentFullText: string) => void
): Promise<KnowledgeChatTestResponse> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/knowledge/chat-test/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        doc_id: docId || null,
        user_role: userRole,
        user_name: userName
      }),
    });
  } catch {
    return chatTestKnowledge(query, docId, userRole, userName);
  }

  if (!res.ok || !res.body) {
    return chatTestKnowledge(query, docId, userRole, userName);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulated = '';
  let finalResponse: KnowledgeChatTestResponse | null = null;
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const part of parts) {
        const line = part.trim();
        if (line.startsWith('data: ')) {
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'token' && typeof evt.content === 'string') {
              accumulated += evt.content;
              onToken?.(evt.content, accumulated);
            } else if (evt.type === 'done' && evt.response) {
              finalResponse = evt.response;
            }
          } catch {}
        }
      }
    }
  } catch {
    // If stream aborted or errored, rely on accumulated
  } finally {
    reader.releaseLock();
  }

  if (finalResponse) return finalResponse;
  return {
    reply_text: accumulated || 'Không nhận được phản hồi từ hệ thống.',
    citations: [],
    rag_grounded: Boolean(accumulated),
    confidence: 0.95,
    provider: 'gemini',
    model_name: 'gemini-2.5-flash',
    suggested_chips: []
  };
}

export async function updateKnowledgeDocumentStatus(
  docId: string,
  newStatus: 'staged' | 'active' | 'superseded',
  verified?: boolean
): Promise<{ status: string; document: any }> {
  const res = await fetchWithTimeout(`${BASE_URL}/knowledge/documents/${encodeURIComponent(docId)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus, verified }),
  }, 15000);

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.detail) detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}



