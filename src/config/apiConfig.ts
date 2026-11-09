/**
 * Dynamic API Base URL resolution for Clinical Ward:
 * - When running in Tauri desktop environment: defaults to Render production API
 * - When VITE_API_BASE_URL or VITE_API_URL is set: uses explicit environment variable
 * - Fallback for Web/Vercel: /api/v1 (reverse-proxied to Render backend)
 */
export function getApiBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) {
    return process.env.VITE_API_BASE_URL.replace(/\/+$/, '');
  }

  if (typeof import.meta !== 'undefined') {
    const envUrl = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL;
    if (envUrl && typeof envUrl === 'string') {
      return envUrl.replace(/\/+$/, '');
    }
  }

  if (typeof window !== 'undefined') {
    const isTauri = '__TAURI__' in window ||
      window.location.protocol === 'tauri:' ||
      window.location.protocol === 'asset:' ||
      (window.location.protocol === 'https:' && window.location.hostname === 'tauri.localhost');

    if (isTauri) {
      try {
        const customTauriUrl = localStorage.getItem('clinical_tauri_api_url');
        if (customTauriUrl && customTauriUrl.trim()) {
          return customTauriUrl.trim().replace(/\/+$/, '');
        }
      } catch {}
      return 'https://clinical-ward-api.onrender.com/api/v1';
    }
  }

  return '/api/v1';
}

export const API_BASE_URL = getApiBaseUrl();
