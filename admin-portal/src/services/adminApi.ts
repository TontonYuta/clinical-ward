import {
  TelemetryOverviewResponse,
  ApiKeyItem,
  BudgetCapResponse,
  BudgetCapConfig,
  TestKeyResponse
} from '../types/admin';

const BASE_URL = '/api/v1/admin';

export async function fetchTelemetryOverview(): Promise<TelemetryOverviewResponse> {
  const res = await fetch(`${BASE_URL}/monitoring/overview`);
  if (!res.ok) {
    throw new Error(`Lỗi tải dữ liệu giám sát: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchApiKeys(): Promise<ApiKeyItem[]> {
  const res = await fetch(`${BASE_URL}/keys`);
  if (!res.ok) {
    throw new Error(`Lỗi tải danh sách API Key: HTTP ${res.status}`);
  }
  return res.json();
}

export async function addApiKey(name: string, apiKey: string, provider: string = 'gemini'): Promise<ApiKeyItem> {
  const res = await fetch(`${BASE_URL}/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, api_key: apiKey, provider }),
  });
  if (!res.ok) {
    throw new Error(`Lỗi thêm khóa API: HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteApiKey(keyId: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/keys/${keyId}`, { method: 'DELETE' });
  return res.ok;
}

export async function triggerAutoHeartbeat(): Promise<ApiKeyItem[]> {
  const res = await fetch(`${BASE_URL}/keys/auto-heartbeat`, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Lỗi tự động quét API Key: HTTP ${res.status}`);
  }
  return res.json();
}

export async function testApiKey(keyId?: string, apiKey?: string): Promise<TestKeyResponse> {
  const res = await fetch(`${BASE_URL}/keys/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key_id: keyId, api_key: apiKey }),
  });
  if (!res.ok) {
    throw new Error(`Lỗi kiểm tra kết nối API Key: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchBudgetStatus(): Promise<BudgetCapResponse> {
  const res = await fetch(`${BASE_URL}/budget`);
  if (!res.ok) {
    throw new Error(`Lỗi tải thông tin ngân sách Token: HTTP ${res.status}`);
  }
  return res.json();
}

export async function updateBudgetConfig(cfg: BudgetCapConfig): Promise<BudgetCapConfig> {
  const res = await fetch(`${BASE_URL}/budget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  });
  if (!res.ok) {
    throw new Error(`Lỗi cập nhật ngân sách Token: HTTP ${res.status}`);
  }
  return res.json();
}

function jsonStringify(obj: any): string {
  return JSON.stringify(obj);
}
