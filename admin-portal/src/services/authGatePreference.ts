const STORAGE_KEY = 'clinical-monitor-auth-gate-v1';
const PRIVATE_CACHE_KEYS = ['clinical_ai_monitor_telemetry_cache_v2', 'clinical_ai_monitor_budget_cache_v2'];

export function readAuthGatePreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveAuthGatePreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // The preference remains active for this page session if storage is unavailable.
  }
}

export function clearMonitorPrivateCache(): void {
  try {
    PRIVATE_CACHE_KEYS.forEach(key => window.localStorage.removeItem(key));
  } catch {
    // The server remains the authority; never prevent logout because storage is unavailable.
  }
}
