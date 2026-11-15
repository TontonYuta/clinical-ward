import type { DashboardTab, UserRole } from '../types/clinical';
import { USER_PROFILES } from '../data/initialData';

export interface FeatureFlag {
  key: DashboardTab;
  label: string;
  description: string;
  enabled: boolean;
}

export interface FeatureFlagPayload {
  version: number;
  flags: FeatureFlag[];
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlag[] = [
  ['overview', 'Tổng quan', 'Màn hình tổng quan vận hành'],
  ['cpoe', 'Kê đơn thuốc', 'Kê đơn và hồ sơ CPOE'],
  ['debt', 'Sổ nợ vỏ', 'Theo dõi mượn và hoàn trả thuốc kiểm soát đặc biệt'],
  ['equipment', 'Sự cố thiết bị', 'Báo hỏng và theo dõi thiết bị y tế'],
  ['fefo', 'Kho dược', 'Tồn kho, FEFO và dự trù'],
  ['coldchain', 'Chuỗi lạnh', 'Theo dõi nhiệt độ và trạng thái bảo quản lạnh'],
  ['asset_audit', 'Kiểm kê tài sản', 'Kiểm kê và điều chuyển tài sản'],
  ['bhyt_audit', 'Giám định BHYT', 'Rà soát thanh toán và cảnh báo xuất toán'],
  ['documents', 'Tài liệu', 'Thư viện văn bản y tế'],
].map(([key, label, description]) => ({
  key: key as DashboardTab, label, description, enabled: ['overview', 'cpoe', 'bhyt_audit', 'fefo', 'documents'].includes(key),
}));

const CACHE_KEY = 'clinical_feature_flags_v1';

export function normalizeFeatureFlags(payload: unknown): FeatureFlagPayload {
  const candidate = payload as Partial<FeatureFlagPayload> | null;
  const incoming = Array.isArray(candidate?.flags) ? candidate.flags : [];
  const byKey = new Map(incoming.map((flag) => [flag.key, flag]));
  const flags = DEFAULT_FEATURE_FLAGS.map((fallback) => {
    const value = byKey.get(fallback.key);
    return value ? { ...fallback, ...value, enabled: fallback.key === 'overview' ? true : Boolean(value.enabled) } : fallback;
  });
  return { version: typeof candidate?.version === 'number' ? candidate.version : 1, flags };
}

export function isValidFeatureFlagPayload(payload: unknown): payload is FeatureFlagPayload {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as Partial<FeatureFlagPayload>;
  if (!Number.isInteger(candidate.version) || !Array.isArray(candidate.flags)) return false;
  const keys = new Set(candidate.flags.map((flag) => flag?.key));
  return DEFAULT_FEATURE_FLAGS.every((flag) => keys.has(flag.key)) && candidate.flags.every((flag) => typeof flag?.enabled === 'boolean');
}

export function getEffectiveAllowedTabs(role: UserRole, payload: FeatureFlagPayload | null): DashboardTab[] {
  const enabled = new Set((payload ? normalizeFeatureFlags(payload) : { version: 1, flags: DEFAULT_FEATURE_FLAGS }).flags.filter((flag) => flag.enabled).map((flag) => flag.key));
  const allowed = USER_PROFILES[role]?.allowedTabs || ['overview'];
  return allowed.filter((tab) => enabled.has(tab));
}

export function readCachedFeatureFlags(): FeatureFlagPayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    return isValidFeatureFlagPayload(payload) ? normalizeFeatureFlags(payload) : null;
  } catch { return null; }
}

export function cacheFeatureFlags(payload: FeatureFlagPayload): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(normalizeFeatureFlags(payload))); } catch {}
}

export async function loadFeatureFlags(): Promise<FeatureFlagPayload> {
  try {
    const response = await fetch('/api/v1/admin/feature-flags');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.json();
    if (!isValidFeatureFlagPayload(raw)) throw new Error('Cấu hình tab không hợp lệ');
    const payload = normalizeFeatureFlags(raw);
    cacheFeatureFlags(payload);
    return payload;
  } catch {
    return readCachedFeatureFlags() || { version: 1, flags: DEFAULT_FEATURE_FLAGS };
  }
}
