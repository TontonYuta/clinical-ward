import assert from 'node:assert/strict';
import { buildSourceIntroduction, removeLegacySourceText } from '../src/utils/chatAnswerPresentation';
import type { RagCitationItem } from '../src/types/chat';

const dtqgCitation: RagCitationItem = {
  source: 'Dược thư Quốc gia Việt Nam, lần xuất bản II',
  legal_basis: 'QĐ 2033/QĐ-BYT, trang 1118',
  section: 'Paracetamol',
  document_id: 'dtqg-v2-2015',
  page: 1118,
  url: '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=1118',
};

assert.equal(buildSourceIntroduction([dtqgCitation]), 'Theo Dược thư Quốc gia Việt Nam, lần xuất bản II (trang 1118).');
assert.equal(
  removeLegacySourceText('### Chỉ định\n\nGiảm đau, hạ sốt.\n\n**Nguồn:** dữ liệu cũ\n📄 Tệp PDF Dược Thư: old.pdf\n📚 **Tài liệu đối chứng chính thức:** old.pdf'),
  '### Chỉ định\n\nGiảm đau, hạ sốt.'
);
assert.equal(removeLegacySourceText('Nguồn: DAV'), '');
console.log('Chat answer presentation tests passed.');
