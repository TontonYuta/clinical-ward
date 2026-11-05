import type { RagCitationItem } from '../types/chat';

const LEGACY_SOURCE_LINE = /^\s*[\*\(_\-]*\s*(?:(?:\*\*)?(?:nguồn|căn cứ pháp lý|tài liệu đối soát|tài liệu tham khảo|căn cứ y văn|tài liệu đối chứng|tệp pdf|mở tài liệu gốc)|(?:📚|📄|🔍)?\s*\*{0,2}(?:tài liệu đối chứng|căn cứ pháp lý|tài liệu đối soát|tệp pdf|mở tài liệu gốc))/i;

export function removeLegacySourceText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      // Giữ nguyên các dòng gắn nguồn trực tiếp dạng token badge [Dược thư tr.XXX], [QĐ 5948], v.v.
      if (/\[(?:DTQG|Dược thư|QĐ\s*5948|QĐ-BYT|TT\s*\d+)[\s\w.:,/–-]*\]/i.test(trimmed)) return true;
      if (LEGACY_SOURCE_LINE.test(trimmed)) return false;
      if (/tệp:\s*[A-Za-z0-9_.-]+\.pdf/i.test(trimmed)) return false;
      if (/tài liệu đối soát:\s*dược thư/i.test(trimmed)) return false;
      if (/căn cứ pháp lý.*dược thư/i.test(trimmed)) return false;
      if (/căn cứ pháp lý.*thông tư/i.test(trimmed)) return false;
      if (/tài liệu đối soát.*quyết định/i.test(trimmed)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatCitationLabel(citation: RagCitationItem): { title: string; subtitle?: string; pageTag?: string } {
  const rawBasis = (citation.legal_basis || citation.source || '').trim();
  const rawSource = (citation.source || '').trim();

  let title = 'Dược Thư Quốc Gia';
  let subtitle = citation.section || '';
  let pageTag = citation.page ? `tr. ${citation.page}` : undefined;

  if (/5948/i.test(rawBasis) || /5948/i.test(rawSource)) {
    title = 'QĐ 5948/QĐ-BYT';
    subtitle = subtitle || 'Tương tác chống chỉ định';
  } else if (/51\/2017/i.test(rawBasis) || /51\/2017/i.test(rawSource)) {
    title = 'Thông tư 51/2017/TT-BYT';
    subtitle = subtitle || 'Phác đồ cấp cứu phản vệ';
  } else if (/26\/2025/i.test(rawBasis) || /26\/2025/i.test(rawSource)) {
    title = 'Thông tư 26/2025/TT-BYT';
    subtitle = subtitle || 'Kê đơn thuốc điện tử';
  } else if (/20\/2017/i.test(rawBasis) || /20\/2017/i.test(rawSource)) {
    title = 'Thông tư 20/2017/TT-BYT';
    subtitle = subtitle || 'Thuốc kiểm soát đặc biệt';
  } else if (/22\/2011/i.test(rawBasis) || /22\/2011/i.test(rawSource)) {
    title = 'Thông tư 22/2011/TT-BYT';
    subtitle = subtitle || 'Khoa Dược bệnh viện';
  } else if (/dược thư/i.test(rawBasis) || /dược thư/i.test(rawSource) || /dtqg/i.test(rawBasis)) {
    title = 'Dược Thư Quốc Gia (2015)';
    if (!pageTag) {
      const pageMatch = (rawBasis + ' ' + rawSource).match(/trang\s*(\d+)/i);
      if (pageMatch) pageTag = `tr. ${pageMatch[1]}`;
    }
  } else {
    title = rawBasis.split('•')[0].replace(/\(Lần xuất bản[^)]*\)/i, '').replace(/,\s*Trang\s*\d+/i, '').trim();
    if (title.length > 35) title = title.slice(0, 32) + '...';
  }

  return { title, subtitle, pageTag };
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
