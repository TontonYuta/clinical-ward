/**
 * Pure extractor that derives generic section headings, drug anchors,
 * and fallback snippets from a RAG citation without hardcoding per-drug rules.
 */

export interface HighlightTargets {
  drugAnchor?: string;
  sectionHeadings: string[];
  fallbackSnippets: string[];
}

export interface CitationInput {
  title?: string;
  section?: string;
  excerpt?: string;
  legal_basis?: string;
  query?: string;
  drugAnchor?: string;
}

const STANDARD_MONOGRAPH_HEADINGS = [
  'Hướng dẫn cách xử trí ADR',
  'Dược lực và cơ chế tác dụng',
  'Dạng thuốc và hàm lượng',
  'Tác dụng không mong muốn',
  'Liều lượng và cách dùng',
  'Độ ổn định và bảo quản',
  'Thời kỳ cho con bú',
  'Tên chung quốc tế',
  'Thời kỳ mang thai',
  'Quá liều và xử trí',
  'Thông tin qui chế',
  'Chống chỉ định',
  'Tương tác thuốc',
  'Dược động học',
  'Thận trọng',
  'Loại thuốc',
  'Chỉ định',
  'Tương kỵ',
  'Suy thận',
  'Suy gan',
  'Người lớn',
  'Trẻ em',
  'Mã ATC',
];

const QUERY_SYNONYM_TO_HEADINGS: Array<[RegExp, string]> = [
  [/chống\s+chỉ\s+định/i, 'Chống chỉ định'],
  [/liều\s+(?:dùng|lượng)|cách\s+dùng/i, 'Liều lượng và cách dùng'],
  [/tác\s+dụng\s+(?:phụ|không\s+mong\s+muốn)|\badr\b/i, 'Tác dụng không mong muốn'],
  [/(?:mang|có)\s+thai|thai\s+kỳ/i, 'Thời kỳ mang thai'],
  [/cho\s+con\s+bú/i, 'Thời kỳ cho con bú'],
  [/quá\s+liều/i, 'Quá liều và xử trí'],
  [/tương\s+tác/i, 'Tương tác thuốc'],
];

function extractHeadingsFromText(source: string): string[] {
  if (!source) return [];
  const found: string[] = [];
  // Mask matched longer headings first so "Chống chỉ định" never triggers "Chỉ định"
  let masked = source.normalize('NFC').toLowerCase();
  const sorted = [...STANDARD_MONOGRAPH_HEADINGS].sort((a, b) => b.length - a.length);
  for (const h of sorted) {
    const escaped = h.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|[\\s.;:,(/])${escaped}(?=$|[\\s.:,;)/])`, 'gi');
    if (re.test(masked)) {
      found.push(h);
      masked = masked.replace(re, (m) => ' '.repeat(m.length));
    }
  }
  for (const [re, target] of QUERY_SYNONYM_TO_HEADINGS) {
    if (re.test(masked) && !found.includes(target)) {
      found.push(target);
      masked = masked.replace(re, (m) => ' '.repeat(m.length));
    }
  }
  return found;
}

const SECTION_KEY_TO_HEADINGS: Record<string, string[]> = {
  indications: ['Chỉ định'],
  contraindications: ['Chống chỉ định'],
  precautions: ['Thận trọng'],
  adult_dosage: ['Liều lượng và cách dùng', 'Người lớn'],
  pediatric_dosage: ['Trẻ em'],
  organ_adjustment: ['Suy thận', 'Suy gan'],
  adr: ['Tác dụng không mong muốn'],
  interactions: ['Tương tác thuốc'],
  overdose: ['Quá liều và xử trí'],
  pregnancy: ['Thời kỳ mang thai', 'Thời kỳ cho con bú'],
  pharmacodynamics: ['Dược lực học', 'Dược lực và cơ chế tác dụng'],
  pharmacokinetics: ['Dược động học'],
};

function cleanHeadingCandidate(raw: string): string {
  return raw
    .replace(/[*_`#•]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NON_DRUG_CAPITALIZED = new Set([
  'dược', 'thư', 'quốc', 'gia', 'việt', 'nam', 'thông', 'tư', 'quyết', 'định',
  'nghị', 'bệnh', 'nhân', 'suy', 'gan', 'thận', 'chỉ', 'định', 'chống', 'liều',
  'dùng', 'cách', 'thận', 'trọng', 'tương', 'tác', 'thuốc', 'theo', 'cho', 'người',
  'trẻ', 'lớn', 'phụ', 'nữ', 'mang', 'thai', 'lưu', 'chỉnh', 'trang', 'byt',
]);

function extractDrugAnchor(title?: string, section?: string, query?: string): string | undefined {
  for (const src of [title || '', section || '']) {
    if (src.includes(':')) {
      const after = src.split(':').slice(1).join(':').split('(')[0].trim();
      const lower = after.toLowerCase();
      if (lower.length >= 4 && lower.length <= 45 && !lower.includes('trang')) {
        return lower;
      }
    }
  }
  if (query) {
    // Match Latin INN drug names in query (e.g., Metformin, Ciprofloxacin, Amoxicillin)
    const matches = query.match(/\b[A-Z][a-z]{3,}(?:-[a-z]+)?\b/g) || [];
    for (const token of matches) {
      const lower = token.toLowerCase();
      if (!NON_DRUG_CAPITALIZED.has(lower)) {
        return lower;
      }
    }
  }
  return undefined;
}

export function extractHighlightTargets(citation: CitationInput): HighlightTargets {
  const headings: string[] = [];
  const seen = new Set<string>();

  const addHeading = (h: string) => {
    const cleaned = cleanHeadingCandidate(h);
    const key = cleaned.replace(/:$/, '').toLowerCase();
    if (cleaned.length >= 4 && cleaned.length <= 45 && !seen.has(key)) {
      seen.add(key);
      headings.push(cleaned);
    }
  };

  const section = (citation.section || '').trim();
  const excerpt = (citation.excerpt || '').trim();
  const query = (citation.query || '').trim();

  // 1. Prioritize explicit headings requested in user query and citation.section
  const queryHeadings = extractHeadingsFromText(query);
  for (const h of queryHeadings) {
    addHeading(h);
  }

  const sectionLower = section.toLowerCase();
  if (SECTION_KEY_TO_HEADINGS[sectionLower]) {
    for (const h of SECTION_KEY_TO_HEADINGS[sectionLower]) {
      addHeading(h);
    }
  } else if (section && section.length <= 45 && !/^(page|trang)\s*\d+$/i.test(section)) {
    for (const part of section.split(/[&,;/|]+/)) {
      addHeading(part);
    }
  }

  // 2. Only scan excerpt for monograph headings if neither query nor section specified any heading
  if (headings.length === 0 && excerpt) {
    for (const h of extractHeadingsFromText(excerpt)) {
      addHeading(h);
    }
  }

  // 3. Extract short structural headings ending with ":" from excerpt only when no heading was matched yet,
  // or sub-headings inside the same topic (e.g. "Suy gan:" for organ_adjustment)
  if (excerpt) {
    const cleanText = excerpt.replace(/[*_`#•]+/g, '');
    if (headings.length === 0) {
      const colonMatches = cleanText.matchAll(/(?:^|\n|[.;])\s*([A-ZÀ-Ỹa-zà-ỹ0-9\s/()-]{3,32}?)\s*:/g);
      for (const m of colonMatches) {
        const candidate = m[1]?.trim() || '';
        if (candidate.split(/\s+/).length <= 5) {
          addHeading(`${candidate}:`);
        }
      }
    }

    // 4. Legal/circular structural headings (Điều X, Khoản Y, Mục Z)
    const legalMatches = cleanText.matchAll(/(?:^|[\s.;,(\[])((?:Điều|Mục|Khoản|Phụ lục)\s+[0-9IVX]+)(?=$|[\s.:,;)\]])/gi);
    for (const m of legalMatches) {
      addHeading(m[1]);
    }
  }

  const isMonographOrLegal = /dược thư|thông tư|quyết định|nghị định|hướng dẫn/i.test(
    `${citation.title || ''} ${citation.legal_basis || ''}`
  );

  return {
    drugAnchor:
      (citation.drugAnchor && citation.drugAnchor.trim().toLowerCase()) ||
      extractDrugAnchor(citation.title, citation.section, citation.query),
    sectionHeadings: headings,
    // Strictly highlight index headings for monographs/circulars; keep snippet fallback only for unstructured prose with no headings
    fallbackSnippets: !isMonographOrLegal && headings.length === 0 && excerpt ? [excerpt] : [],
  };
}

/**
 * Extract short, candidate heading/label lines from a rendered PDF page's text items
 * for Gemini semantic heading selection.
 */
export function extractPageHeadingCandidates(itemStrings: string[]): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  for (const raw of itemStrings) {
    const cleaned = cleanHeadingCandidate(raw);
    if (cleaned.length < 3 || cleaned.length > 60) continue;
    if (cleaned.split(/\s+/).length > 8) continue;
    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(cleaned);
      if (candidates.length >= 60) break;
    }
  }
  return candidates;
}
