import type { RagCitationItem } from '../types/chat';

const LEGACY_SOURCE_LINE = /^\s*(?:(?:\*\*)?nguồn\b|(?:📚\s*)?\*{0,2}tài liệu đối chứng chính thức\b|(?:📄\s*)?(?:\*{0,2})?(?:tệp pdf(?: dược thư)?|mở tài liệu gốc)\b).*$/i;

export function removeLegacySourceText(rawText: string): string {
  return rawText
    .split('\n')
    .filter((line) => !LEGACY_SOURCE_LINE.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildSourceIntroduction(citations: RagCitationItem[] = []): string {
  const entries = Array.from(new Map(citations.map((citation) => {
    const documentName = citation.document_id === 'dtqg-v2-2015'
      ? 'Dược thư Quốc gia Việt Nam, lần xuất bản II'
      : citation.source;
    const location = citation.page ? `trang ${citation.page}` : citation.section;
    const label = location ? `${documentName} (${location})` : documentName;
    return [`${documentName}|${location}`, label];
  })).values()).filter(Boolean);

  if (entries.length === 0) return '';
  if (entries.length === 1) return `Theo ${entries[0]}.`;
  if (entries.length === 2) return `Theo ${entries[0]} và ${entries[1]}.`;
  return `Theo ${entries.slice(0, 2).join(', ')} và ${entries.length - 2} nguồn liên quan.`;
}
