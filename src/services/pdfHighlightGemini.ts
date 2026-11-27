import { API_BASE_URL, apiFetch } from './api';

export interface GeminiHighlightResult {
  drug_anchor?: string | null;
  selected_headings: string[];
  cached?: boolean;
}

export async function selectPdfHighlightHeadingsWithGemini(
  query: string,
  pageCandidates: string[],
  drugAnchor?: string,
  signal?: AbortSignal
): Promise<GeminiHighlightResult> {
  if (!query.trim() || pageCandidates.length === 0) {
    return { selected_headings: [] };
  }
  try {
    const res = await apiFetch(`${API_BASE_URL}/copilot/highlight-headings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal,
      body: JSON.stringify({
        query: query.slice(0, 400),
        page_candidates: pageCandidates.slice(0, 60),
        drug_anchor: drugAnchor || undefined,
      }),
    });
    if (!res.ok) return { selected_headings: [] };
    const data = await res.json();
    return {
      drug_anchor: typeof data?.drug_anchor === 'string' ? data.drug_anchor : null,
      selected_headings: Array.isArray(data?.selected_headings) ? data.selected_headings : [],
      cached: Boolean(data?.cached),
    };
  } catch {
    return { selected_headings: [] };
  }
}
