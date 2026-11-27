/**
 * Generic PDF TextLayer matcher + DOM Range normalized highlight calculator.
 * Prioritizes monograph-anchored section headings (e.g., "Suy gan:", "Chống chỉ định:")
 * and falls back to exact/anchor snippet matching.
 */

import type { HighlightTargets } from './pdfSectionExtractor';

export interface NormalizedMapping {
  normalized: string;
  charToItem: number[];
  itemCharRanges: Array<{ start: number; end: number }>;
}

export interface SectionMatchGroup {
  itemIndices: number[];
  label: string;
  matchKind: 'heading' | 'snippet';
}

export interface NormalizedHighlightBox {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  groupIndex: number;
  label: string;
}

export function buildNormalizedPageText(itemStrings: string[]): NormalizedMapping {
  let normalized = '';
  const charToItem: number[] = [];
  const itemCharRanges: Array<{ start: number; end: number }> = [];
  let prevWasSpace = true;

  for (let itemIdx = 0; itemIdx < itemStrings.length; itemIdx++) {
    const startOffset = normalized.length;
    const raw = (itemStrings[itemIdx] || '').normalize('NFC').toLowerCase();
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (/\s/.test(ch)) {
        if (!prevWasSpace) {
          normalized += ' ';
          charToItem.push(itemIdx);
          prevWasSpace = true;
        }
      } else {
        normalized += ch;
        charToItem.push(itemIdx);
        prevWasSpace = false;
      }
    }
    const endOffset = normalized.length;
    itemCharRanges.push({ start: startOffset, end: endOffset });

    if (!prevWasSpace && !normalized.endsWith('-')) {
      normalized += ' ';
      charToItem.push(itemIdx);
      prevWasSpace = true;
    } else if (normalized.endsWith('-')) {
      normalized = normalized.slice(0, -1);
      charToItem.pop();
    }
  }

  return { normalized: normalized.trimEnd(), charToItem, itemCharRanges };
}

export function normalizeQuerySnippet(text: string): string {
  return (text || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[*_`#•]+/g, ' ')
    .replace(/-\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectItemsInRange(start: number, length: number, charToItem: number[]): number[] {
  const seen = new Set<number>();
  const end = Math.min(charToItem.length, start + length);
  for (let i = Math.max(0, start); i < end; i++) {
    seen.add(charToItem[i]);
  }
  return Array.from(seen).sort((a, b) => a - b);
}

function isHeadingBoundaryMatch(
  normalized: string,
  idx: number,
  needle: string,
  charToItem: number[],
  itemCharRanges: Array<{ start: number; end: number }>
): boolean {
  const startItem = charToItem[idx];
  const endItem = charToItem[idx + needle.length - 1];
  const itemStart = itemCharRanges[startItem]?.start ?? 0;
  const itemEnd = itemCharRanges[endItem]?.end ?? normalized.length;

  const before = idx > 0 ? normalized[idx - 1] : ' ';
  const startsAtItem = idx <= itemStart + 1 || /[:.\n]/.test(before);

  const afterIdx = idx + needle.length;
  const after = afterIdx < normalized.length ? normalized[afterIdx] : ' ';
  const endsAtItem = afterIdx >= itemEnd || needle.endsWith(':') || after === ':';

  return startsAtItem && endsAtItem && /[\s:.;,\n]/.test(after);
}

function findDrugAnchorStartOffset(normalized: string, drugAnchor?: string): number {
  if (!drugAnchor) return 0;
  const cleanAnchor = normalizeQuerySnippet(drugAnchor);
  if (cleanAnchor.length < 4) return 0;
  const idx = normalized.indexOf(cleanAnchor);
  return idx !== -1 ? idx : 0;
}

/**
 * Find heading matches first (anchored to monograph drug if present),
 * falling back to snippet matching if no headings match.
 */
export function findSectionMatches(
  itemStrings: string[],
  targets: HighlightTargets
): SectionMatchGroup[] {
  if (!itemStrings.length) return [];
  const { normalized, charToItem, itemCharRanges } = buildNormalizedPageText(itemStrings);
  if (!normalized) return [];

  const anchorStart = findDrugAnchorStartOffset(normalized, targets.drugAnchor);
  const groups: SectionMatchGroup[] = [];
  const matchedKeySet = new Set<string>();

  // 1. Prefer section headings (e.g. "Suy gan:", "Chống chỉ định:")
  for (const heading of targets.sectionHeadings) {
    const cleanH = normalizeQuerySnippet(heading).replace(/:$/, '');
    if (cleanH.length < 4) continue;

    // Prefer exact heading with colon first, then bare heading at boundary
    const needles = [`${cleanH}:`, cleanH];
    let foundIdx = -1;
    let foundLen = 0;

    for (const needle of needles) {
      let pos = anchorStart;
      while (pos < normalized.length) {
        const idx = normalized.indexOf(needle, pos);
        if (idx === -1) break;
        if (isHeadingBoundaryMatch(normalized, idx, needle, charToItem, itemCharRanges)) {
          foundIdx = idx;
          foundLen = needle.length;
          break;
        }
        pos = idx + needle.length;
      }
      if (foundIdx !== -1) break;
    }

    if (foundIdx !== -1) {
      const itemIndices = collectItemsInRange(foundIdx, foundLen, charToItem);
      const sig = itemIndices.join(',');
      if (itemIndices.length > 0 && !matchedKeySet.has(sig)) {
        matchedKeySet.add(sig);
        groups.push({ itemIndices, label: heading.replace(/:$/, ''), matchKind: 'heading' });
      }
    }
  }

  if (groups.length > 0) return groups;

  // 2. Fallback to snippet matching for plain-prose documents
  for (const snippet of targets.fallbackSnippets) {
    const matched = findMatchedTextItemIndices(itemStrings, snippet);
    if (matched.size > 0) {
      groups.push({
        itemIndices: Array.from(matched).sort((a, b) => a - b),
        label: 'Đoạn trích dẫn',
        matchKind: 'snippet',
      });
    }
  }

  return groups;
}

function splitCandidateSegments(excerpt: string): string[] {
  const clean = normalizeQuerySnippet(excerpt);
  if (!clean) return [];
  const parts = clean
    .split(/(?<=[.;!?])\s+|\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 10 || p.split(' ').length >= 3);
  return parts.length > 0 ? parts : [clean];
}

export function findMatchedTextItemIndices(
  itemStrings: string[],
  excerpt: string
): Set<number> {
  const matched = new Set<number>();
  if (!itemStrings.length || !excerpt || !excerpt.trim()) return matched;

  const { normalized, charToItem } = buildNormalizedPageText(itemStrings);
  if (!normalized) return matched;

  const segments = splitCandidateSegments(excerpt);

  for (const seg of segments) {
    let searchFrom = 0;
    while (searchFrom < normalized.length) {
      const idx = normalized.indexOf(seg, searchFrom);
      if (idx === -1) break;
      for (const itemIdx of collectItemsInRange(idx, seg.length, charToItem)) {
        matched.add(itemIdx);
      }
      searchFrom = idx + seg.length;
    }
  }

  if (matched.size > 0) return matched;

  const words = normalizeQuerySnippet(excerpt)
    .replace(/[.,;:!?()[\]"]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  const windowSize = words.length >= 4 ? 4 : Math.min(3, words.length);
  if (windowSize < 2) return matched;

  for (let i = 0; i <= words.length - windowSize; i++) {
    const ngram = words.slice(i, i + windowSize).join(' ');
    if (ngram.length < 8) continue;
    const idx = normalized.indexOf(ngram);
    if (idx !== -1) {
      for (const itemIdx of collectItemsInRange(idx, ngram.length, charToItem)) {
        matched.add(itemIdx);
      }
    }
  }

  return matched;
}

/**
 * Compute smooth, zoom-invariant normalized [0..100%] highlight rectangles
 * using DOM Range.getClientRects() over the rendered pdfjs-dist TextLayer.
 */
export function computeNormalizedHighlightBoxes(
  textLayerEl: HTMLElement,
  itemStrings: string[],
  targets: HighlightTargets
): { boxes: NormalizedHighlightBox[]; matchCount: number; matchKind: 'heading' | 'snippet' | 'none' } {
  const groups = findSectionMatches(itemStrings, targets);
  if (groups.length === 0) {
    return { boxes: [], matchCount: 0, matchKind: 'none' };
  }

  const layerRect = textLayerEl.getBoundingClientRect();
  if (layerRect.width <= 0 || layerRect.height <= 0) {
    return { boxes: [], matchCount: 0, matchKind: 'none' };
  }

  const spans = Array.from(textLayerEl.querySelectorAll('span'));
  const nonEmptyItemIndices: number[] = [];
  for (let i = 0; i < itemStrings.length; i++) {
    if ((itemStrings[i] || '').length > 0) {
      nonEmptyItemIndices.push(i);
    }
  }
  const itemToSpan = new Map<number, HTMLElement>();
  spans.forEach((spanEl, spanIdx) => {
    const itemIdx = nonEmptyItemIndices[spanIdx];
    if (itemIdx !== undefined) itemToSpan.set(itemIdx, spanEl);
  });

  const boxes: NormalizedHighlightBox[] = [];
  groups.forEach((group, groupIndex) => {
    const matchedSpans = group.itemIndices
      .map((idx) => itemToSpan.get(idx))
      .filter((el): el is HTMLElement => Boolean(el));
    if (matchedSpans.length === 0) return;

    const firstSpan = matchedSpans[0];
    const lastSpan = matchedSpans[matchedSpans.length - 1];
    try {
      const range = document.createRange();
      range.setStartBefore(firstSpan);
      range.setEndAfter(lastSpan);
      const clientRects = Array.from(range.getClientRects());
      const validRects = clientRects.filter((r) => {
        if (r.width < 4 || r.height < 4) return false;
        // Prevent any box from crossing between left and right columns on 2-column pages
        if (group.matchKind === 'heading' && r.width > layerRect.width * 0.48) return false;
        if (r.width > layerRect.width * 0.72 && matchedSpans.length <= 3) return false;
        return true;
      });
      if (validRects.length > 0) {
        for (const r of validRects) {
          boxes.push({
            xPct: ((r.left - layerRect.left) / layerRect.width) * 100,
            yPct: ((r.top - layerRect.top) / layerRect.height) * 100,
            wPct: (r.width / layerRect.width) * 100,
            hPct: (r.height / layerRect.height) * 100,
            groupIndex,
            label: group.label,
          });
        }
      } else {
        throw new Error('Range spanned across columns');
      }
    } catch {
      // Fallback per-span rect
      for (const sp of matchedSpans) {
        const r = sp.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        boxes.push({
          xPct: ((r.left - layerRect.left) / layerRect.width) * 100,
          yPct: ((r.top - layerRect.top) / layerRect.height) * 100,
          wPct: (r.width / layerRect.width) * 100,
          hPct: (r.height / layerRect.height) * 100,
          groupIndex,
          label: group.label,
        });
      }
    }
  });

  return {
    boxes,
    matchCount: groups.length,
    matchKind: groups[0].matchKind,
  };
}
