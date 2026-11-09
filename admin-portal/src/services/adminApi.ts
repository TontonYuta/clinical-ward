import {
  TelemetryOverviewResponse,
  ApiKeyItem,
  BudgetCapResponse,
  BudgetCapConfig,
  TestKeyResponse,
  EsmsStatusResponse,
  GasStatusResponse,
  BhytAuditLogItem
} from '../types/admin';

const BASE_URL = '/api/v1/admin';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
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

export async function testApiKey(keyId?: string, apiKey?: string): Promise<TestKeyResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/keys/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key_id: keyId, api_key: apiKey }),
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
