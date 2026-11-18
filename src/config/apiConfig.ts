/**
 * Dynamic API Base URL resolution for Clinical Ward:
 * - When running in Tauri desktop environment: defaults to Render production API
 * - When VITE_API_BASE_URL or VITE_API_URL is set: uses explicit environment variable
 * - Fallback for Web/Vercel: /api/v1 (reverse-proxied to Render backend)
 */
export function getApiBaseUrl(): string {
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

  const envUrl = typeof import.meta !== 'undefined'
    ? (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL
    : undefined;
  const processUrl = typeof process !== 'undefined' ? process.env?.VITE_API_BASE_URL : undefined;
  return resolveWebApiBaseUrl(envUrl || processUrl);
}

export function resolveWebApiBaseUrl(_configuredUrl?: string): string {
  // Browser clients must use the Vercel same-origin proxy so browsers persist
  // and send the HttpOnly session cookie as a first-party cookie.
  return '/api/v1';
}

export const API_BASE_URL = getApiBaseUrl();
