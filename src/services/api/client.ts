/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Unified HTTP API Client with Error Guarding & Timeouts
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || (import.meta.env.VITE_API_URL as string) || '/api/v1';

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 8000, ...fetchOptions } = options;
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(fetchOptions.headers || {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`API ${response.status}: ${errorText || response.statusText}`);
    }

    return (await response.json()) as T;
  } catch (error: any) {
    clearTimeout(timer);
    console.warn(`[API Client] Error on ${url}:`, error?.message || error);
    throw error;
  }
}
