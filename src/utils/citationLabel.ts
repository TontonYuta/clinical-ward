import { RagCitationItem } from '../types/chat';

export function isWebCitationItem(citation?: RagCitationItem | null): boolean {
  if (!citation?.url) return false;
  if (citation.document_id) return false;
  if (!(citation.url.startsWith('http://') || citation.url.startsWith('https://'))) {
    return false;
  }
  try {
    const parsed = new URL(citation.url);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract a concise, ChatGPT-style domain or source label for inline citation pills
 * and source tabs (e.g. "timmachhoc.vn", "canhgiacduoc.org.vn", "Dược thư · tr.718", "TT 51/2017").
 */
export function extractShortSourceLabel(
  citation?: RagCitationItem | null,
  fallbackIndex?: number
): string {
  if (!citation) {
    return fallbackIndex ? `Nguồn ${fallbackIndex}` : 'Nguồn';
  }

  if (isWebCitationItem(citation)) {
    let host = (citation.domain || '').trim();
    if (!host && citation.url) {
      try {
        host = new URL(citation.url).hostname;
      } catch {
        host = '';
      }
    }
    if (host) {
      const cleaned = host
        .toLowerCase()
        .replace(/^(?:www\.|m\.|mobile\.|amp\.|magazine\.)/i, '');
      return cleaned.length > 26 ? `${cleaned.slice(0, 24)}…` : cleaned;
    }
  }

  const rawSource = (citation.source || citation.legal_basis || citation.title || '').trim();
  const lower = rawSource.toLowerCase();

  if (lower.includes('dược thư') || lower.includes('duoc thu') || lower.includes('dtqg')) {
    return citation.page ? `Dược thư · tr.${citation.page}` : 'Dược thư QG';
  }
  const ttMatch = rawSource.match(/Thông tư\s+(\d+(?:\/\d+)?)/i);
  if (ttMatch) {
    return citation.page ? `TT ${ttMatch[1]} · tr.${citation.page}` : `TT ${ttMatch[1]}`;
  }
  const qdMatch = rawSource.match(/(?:Quyết định|QĐ)\s+(\d+(?:\/\d+)?)/i);
  if (qdMatch) {
    return `QĐ ${qdMatch[1]}`;
  }
  if (lower.includes('cục quản lý dược') || /\bdav\b/i.test(rawSource)) {
    return 'DAV';
  }
  if (lower.includes('luật dược')) {
    return 'Luật Dược';
  }
  if (lower.includes('tồn kho') || lower.includes('inventory')) {
    return 'Kho dược BV';
  }

  if (rawSource) {
    const base = rawSource.length > 22 ? `${rawSource.slice(0, 20)}…` : rawSource;
    return citation.page ? `${base} · tr.${citation.page}` : base;
  }

  return fallbackIndex ? `Nguồn ${fallbackIndex}` : 'Nguồn';
}

/**
 * Normalize inline citation tokens so clusters like "[3, 4]" or "[3] [4] ."
 * become clean, punctuation-first clusters: ". [3][4]" (ChatGPT style).
 */
export function normalizeInlineCitations(rawText: string): string {
  if (!rawText) return '';

  // 1. Expand comma-separated citation lists: [1, 2, 3] -> [1][2][3]
  let out = rawText.replace(
    /\[(\d+(?:\s*,\s*\d+)+)\](?!\()/g,
    (_, nums: string) => nums.split(',').map((n) => `[${n.trim()}]`).join('')
  );

  // 2. Collapse whitespace between adjacent footnote citations: [3] [4] -> [3][4]
  out = out.replace(/(\[\d+\])\s+(?=\[\d+\](?!\())/g, '$1');

  // 3. Move trailing punctuation (., ;, :) directly before the citation cluster so
  //    "người bệnh [3][4] ." -> "người bệnh. [3][4]" with zero orphan punctuation.
  out = out.replace(/\s*((?:\[\d+\])+)(?!\()\s*([.,;:])(?=\s|$|\))/g, '$2 $1');

  // 4. Clean stray space before citation cluster when already preceded by punctuation
  out = out.replace(/([.,;:])\s{2,}((?:\[\d+\])+)(?!\()/g, '$1 $2');

  return out;
}
