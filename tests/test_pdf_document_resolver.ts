import assert from 'node:assert/strict';
import { resolvePdfDocumentTarget } from '../src/utils/pdfDocumentResolver';

const dtqgUrl = '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=1118';
const resolved = resolvePdfDocumentTarget(dtqgUrl, 1118);

assert.equal(resolved.pdfUrl, '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf');
assert.equal(resolved.pageNumber, 1118);
assert.equal(resolved.exactHashUrl, dtqgUrl);

const labelOnly = resolvePdfDocumentTarget('Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015)');
assert.equal(labelOnly.pdfUrl, '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf');

const conflict = resolvePdfDocumentTarget({
  url: dtqgUrl,
  title: 'Dược thư Quốc gia Việt Nam (2015)',
  legal_basis: 'QĐ 2033/QĐ-BYT',
  page: 1118,
});
assert.equal(conflict.pdfUrl, '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf');
assert.equal(conflict.exactHashUrl, dtqgUrl);

console.log('PDF source identity resolution passed');
