import type { KnowledgeDocument } from '../../types/documents';

export function isPdfFile(file: Pick<File, 'name' | 'type'>): boolean {
  const hasPdfExtension = file.name.trim().toLocaleLowerCase('en').endsWith('.pdf');
  const hasKnownMimeType = file.type.trim() !== '';
  return hasPdfExtension && (!hasKnownMimeType || file.type.trim().toLocaleLowerCase('en') === 'application/pdf');
}

export function formatDocumentFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function filterKnowledgeDocuments(
  documents: KnowledgeDocument[], query: string, category: string,
): KnowledgeDocument[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('vi');
  return documents.filter((document) => {
    const categoryMatches = category === 'Tất cả' || document.category === category;
    const searchText = `${document.title} ${document.legal_basis} ${document.filename}`.toLocaleLowerCase('vi');
    return categoryMatches && (!normalizedQuery || searchText.includes(normalizedQuery));
  });
}
