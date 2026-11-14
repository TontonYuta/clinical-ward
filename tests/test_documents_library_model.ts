import assert from 'node:assert/strict';
import { filterKnowledgeDocuments, isPdfFile, formatDocumentFileSize } from '../src/components/Documents/documentsLibraryModel';
import type { KnowledgeDocument } from '../src/types/documents';

const docs: KnowledgeDocument[] = [
  { id: 'a', title: 'Nghị định mẫu', legal_basis: 'NĐ 10/2026', category: 'Nghị định', edition_year: 2026, filename: 'nd10.pdf', public_url: '/api/v1/pdf/nd10.pdf', sha256: 'a', bytes: 100 },
  { id: 'b', title: 'Dược thư Quốc gia', legal_basis: 'Ấn bản 2025', category: 'Dược thư', edition_year: 2025, filename: 'dtqg.pdf', public_url: '/api/v1/pdf/dtqg.pdf', sha256: 'b', bytes: 200 },
];

assert.deepEqual(filterKnowledgeDocuments(docs, 'dược thư', 'Tất cả').map((doc) => doc.id), ['b']);
assert.deepEqual(filterKnowledgeDocuments(docs, '', 'Nghị định').map((doc) => doc.id), ['a']);
assert.equal(isPdfFile({ name: 'quy-dinh.PDF', type: 'application/pdf' }), true);
assert.equal(isPdfFile({ name: 'scan.pdf', type: '' }), true);
assert.equal(isPdfFile({ name: 'notes.txt', type: 'text/plain' }), false);
assert.equal(isPdfFile({ name: 'scan.pdf.exe', type: 'application/octet-stream' }), false);
assert.equal(formatDocumentFileSize(0), '0 B');
assert.equal(formatDocumentFileSize(1536), '1.5 KB');
assert.equal(formatDocumentFileSize(5242880), '5.0 MB');
console.log('documents library filtering passed');
