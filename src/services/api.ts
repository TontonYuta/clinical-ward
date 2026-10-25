/**
 * API Service connecting Frontend to FastAPI Backend (port 8000)
 * Adheres to Thông tư 22/2011, TT 20/2017, TT 36/2018, NĐ 98/2021, NĐ 151/2017, NĐ 130/2018
 */

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const defaultBaseUrl = (typeof window === 'undefined') ? 'http://localhost:8000/api/v1' : (isLocalhost ? 'http://localhost:8000/api/v1' : '/api/v1');
const API_BASE_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || defaultBaseUrl;
const ROOT_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '') || (isLocalhost ? 'http://localhost:8000' : '');

export async function checkBackendHealth(): Promise<{ status: string; system: string; legal_compliance: string[] } | null> {
  try {
    const res = await fetch(`${ROOT_URL}/`, { method: 'GET' });
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
  const res = await fetch(`${API_BASE_URL}/debts?${query.toString()}`);
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
  const res = await fetch(`${API_BASE_URL}/debts/borrow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Lỗi lập phiếu mượn khẩn');
  return res.json();
}

export async function returnAmpouleApi(debtId: string) {
  const res = await fetch(`${API_BASE_URL}/debts/${debtId}/return-ampoule`, {
    method: 'PUT'
  });
  if (!res.ok) throw new Error('Lỗi ghi nhận thu hồi vỏ ống');
  return res.json();
}

export async function settleDebtApi(debtId: string, payload: { settler: string; pin_code?: string; auth_method?: string }) {
  const res = await fetch(`${API_BASE_URL}/debts/${debtId}/settle`, {
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
  const res = await fetch(`${API_BASE_URL}/debts/destroy-ampoules`, {
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
  const res = await fetch(`${API_BASE_URL}/equipment?${query.toString()}`);
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
  const res = await fetch(`${API_BASE_URL}/equipment/incidents`, {
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
  const res = await fetch(`${API_BASE_URL}/equipment/${ticketId}/handover`, {
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
  const res = await fetch(`${API_BASE_URL}/inventory/batches?${query.toString()}`);
  if (!res.ok) throw new Error('Không thể tải dữ liệu kho dược');
  return res.json();
}

export async function dispatchFefoBatchApi(batchId: string, payload: { quantity: number; reason?: string }) {
  const res = await fetch(`${API_BASE_URL}/inventory/batches/${batchId}/dispatch`, {
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
  const res = await fetch(`${API_BASE_URL}/inventory/restock-proposal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Lỗi lập phiếu dự trù Mẫu 01/TT22');
  return res.json();
}

// 4. Cold Chain & Datalogger
export async function getColdChainStatusApi() {
  const res = await fetch(`${API_BASE_URL}/coldchain/status`);
  if (!res.ok) throw new Error('Không thể tải trạng thái chuỗi lạnh');
  return res.json();
}

export async function simulateOutageApi() {
  const res = await fetch(`${API_BASE_URL}/coldchain/simulate-outage`, { method: 'POST' });
  if (!res.ok) throw new Error('Lỗi mô phỏng mất điện chuỗi lạnh');
  return res.json();
}

export async function restorePowerApi() {
  const res = await fetch(`${API_BASE_URL}/coldchain/restore-power`, { method: 'POST' });
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
  const res = await fetch(`${API_BASE_URL}/coldchain/release-quarantine`, {
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
  const res = await fetch(`${API_BASE_URL}/assets?${query.toString()}`);
  if (!res.ok) throw new Error('Không thể tải danh mục tài sản');
  return res.json();
}

export async function scanQrAssetApi(assetId: string) {
  const res = await fetch(`${API_BASE_URL}/assets/${assetId}/scan-qr`, { method: 'POST' });
  if (!res.ok) throw new Error('Lỗi quét mã QR tài sản');
  return res.json();
}

export async function transferAssetApi(assetId: string, payload: {
  new_department: string;
  engineer_name: string;
  receiver_name: string;
  transfer_reason: string;
}) {
  const res = await fetch(`${API_BASE_URL}/assets/${assetId}/transfer`, {
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
  const res = await fetch(`${API_BASE_URL}/assets/${assetId}/liquidate`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Lỗi lập tờ trình thanh lý tài sản NĐ 151');
  return res.json();
}

// 6. Audit Ledger & Cryptographic Integrity
export async function getAuditLedgerApi() {
  const res = await fetch(`${API_BASE_URL}/audit/ledger`);
  if (!res.ok) throw new Error('Không thể tải sổ kiểm toán lâm sàng');
  return res.json();
}

export async function verifyAuditIntegrityApi(): Promise<{
  is_valid: boolean;
  total_records: number;
  broken_at_id: string | null;
  message: string;
}> {
  const res = await fetch(`${API_BASE_URL}/audit/verify-integrity`);
  if (!res.ok) throw new Error('Lỗi kiểm tra tính toàn vẹn chuỗi băm');
  return res.json();
}

// 7. Copilot AI Assistant
export async function chatCopilotApi(query: string, userRole: string, userName: string) {
  const res = await fetch(`${API_BASE_URL}/copilot/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, user_role: userRole, user_name: userName })
  });
  if (!res.ok) throw new Error('Lỗi gửi tin nhắn đến Trợ lý AI');
  return res.json();
}

// 8. National Drug Registry (55.000 SĐK)
export async function getNationalDrugRegistryApi(params?: {
  search?: string;
  group?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.group && params.group !== 'all') query.set('group', params.group);
  if (params?.page) query.set('page', params.page.toString());
  if (params?.pageSize) query.set('page_size', (params.pageSize || 50).toString());

  const res = await fetch(`${API_BASE_URL}/registry?${query.toString()}`);
  if (!res.ok) throw new Error('Không thể nạp danh mục dược quốc gia từ máy chủ');
  return res.json();
}
