import {
  TelemetryOverviewResponse,
  ApiKeyItem,
  BudgetCapResponse,
  BudgetCapConfig,
  TestKeyResponse,
  EsmsStatusResponse,
  GasStatusResponse
} from '../types/admin';

const BASE_URL = '/api/v1/admin';

export async function fetchTelemetryOverview(): Promise<TelemetryOverviewResponse> {
  const res = await fetch(`${BASE_URL}/monitoring/overview`);
  if (!res.ok) throw new Error(`Lỗi tải dữ liệu giám sát: HTTP ${res.status}`);
  return res.json();
}

export async function fetchApiKeys(): Promise<ApiKeyItem[]> {
  const res = await fetch(`${BASE_URL}/keys`);
  if (!res.ok) throw new Error(`Lỗi tải danh sách API Key: HTTP ${res.status}`);
  return res.json();
}

export async function addApiKey(name: string, apiKey: string, provider: string = 'gemini'): Promise<ApiKeyItem> {
  const res = await fetch(`${BASE_URL}/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, api_key: apiKey, provider }),
  });
  if (!res.ok) throw new Error(`Lỗi thêm khóa API: HTTP ${res.status}`);
  return res.json();
}

export async function deleteApiKey(keyId: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/keys/${keyId}`, { method: 'DELETE' });
  return res.ok;
}

export async function triggerAutoHeartbeat(): Promise<ApiKeyItem[]> {
  const res = await fetch(`${BASE_URL}/keys/auto-heartbeat`, { method: 'POST' });
  if (!res.ok) throw new Error(`Lỗi tự động quét API Key: HTTP ${res.status}`);
  return res.json();
}

export async function testApiKey(keyId?: string, apiKey?: string): Promise<TestKeyResponse> {
  const res = await fetch(`${BASE_URL}/keys/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key_id: keyId, api_key: apiKey }),
  });
  if (!res.ok) throw new Error(`Lỗi kiểm tra kết nối API Key: HTTP ${res.status}`);
  return res.json();
}

export async function fetchBudgetStatus(): Promise<BudgetCapResponse> {
  const res = await fetch(`${BASE_URL}/budget`);
  if (!res.ok) throw new Error(`Lỗi tải thông tin ngân sách Token: HTTP ${res.status}`);
  return res.json();
}

export async function updateBudgetConfig(cfg: BudgetCapConfig): Promise<BudgetCapConfig> {
  const res = await fetch(`${BASE_URL}/budget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  });
  if (!res.ok) throw new Error(`Lỗi cập nhật ngân sách Token: HTTP ${res.status}`);
  return res.json();
}

// === CỔNG VIỄN THÔNG eSMS.vn & GOOGLE APPS SCRIPT ===

export async function fetchEsmsStatus(): Promise<EsmsStatusResponse> {
  const res = await fetch(`${BASE_URL}/integrations/esms/status`);
  if (!res.ok) throw new Error(`Lỗi tải trạng thái eSMS: HTTP ${res.status}`);
  return res.json();
}

export async function pingEsms(apiKey?: string, secretKey?: string) {
  const res = await fetch(`${BASE_URL}/integrations/esms/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, secret_key: secretKey }),
  });
  if (!res.ok) throw new Error(`Lỗi ping eSMS: HTTP ${res.status}`);
  return res.json();
}

export async function updateEsmsConfig(payload: { api_key?: string; secret_key?: string; brandname?: string; is_sandbox?: boolean }): Promise<EsmsStatusResponse> {
  const res = await fetch(`${BASE_URL}/integrations/esms/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Lỗi cập nhật cấu hình eSMS: HTTP ${res.status}`);
  return res.json();
}

export async function fetchGasStatus(): Promise<GasStatusResponse> {
  const res = await fetch(`${BASE_URL}/integrations/gas/status`);
  if (!res.ok) throw new Error(`Lỗi tải trạng thái GAS: HTTP ${res.status}`);
  return res.json();
}

export async function pingGas(webhookUrl?: string) {
  const res = await fetch(`${BASE_URL}/integrations/gas/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhook_url: webhookUrl }),
  });
  if (!res.ok) throw new Error(`Lỗi ping GAS: HTTP ${res.status}`);
  return res.json();
}

export async function updateGasConfig(webhookUrl: string): Promise<GasStatusResponse> {
  const res = await fetch(`${BASE_URL}/integrations/gas/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhook_url: webhookUrl }),
  });
  if (!res.ok) throw new Error(`Lỗi cập nhật cấu hình GAS: HTTP ${res.status}`);
  return res.json();
}
