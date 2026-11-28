import assert from 'node:assert/strict';
import { extractShortSourceLabel, normalizeInlineCitations } from '../src/utils/citationLabel';
import type { RagCitationItem } from '../src/types/chat';

// 1. Web citations -> concise domain pill
const web1: RagCitationItem = {
  source: 'CẬP NHẬT HƯỚNG DẪN KDIGO 2024',
  legal_basis: 'Web Reference',
  title: 'CẬP NHẬT HƯỚNG DẪN KDIGO 2024',
  domain: 'magazine.canhgiacduoc.org.vn',
  url: 'https://magazine.canhgiacduoc.org.vn/article/kdigo-2024',
  index: 1,
};
assert.equal(extractShortSourceLabel(web1, 1), 'canhgiacduoc.org.vn');

const web2: RagCitationItem = {
  source: 'Empagliflozin: Bước tiến đột phá',
  legal_basis: 'Web Reference',
  url: 'https://www.timmachhoc.vn/empagliflozin',
  index: 3,
};
assert.equal(extractShortSourceLabel(web2, 3), 'timmachhoc.vn');

const webPdf: RagCitationItem = {
  source: 'CẬP NHẬT THÔNG TIN THUỐC Về việc cập nhật hướng dẫn kdigo 2024',
  legal_basis: 'Web Reference',
  url: 'https://ttytchauthanhag.vn/uploads/kdigo-2024.pdf',
  index: 1,
};
assert.equal(extractShortSourceLabel(webPdf, 1), 'ttytchauthanhag.vn');

// 2. Internal clinical PDF / monograph citations -> compact source + page
const dtqg: RagCitationItem = {
  source: 'Dược thư Quốc gia Việt Nam, lần xuất bản II',
  legal_basis: 'QĐ 2033/QĐ-BYT',
  document_id: 'dtqg-v2-2015',
  page: 718,
  url: '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=718',
};
assert.equal(extractShortSourceLabel(dtqg, 1), 'Dược thư · tr.718');

const tt51: RagCitationItem = {
  source: 'Thông tư 51/2017/TT-BYT hướng dẫn phòng, chẩn đoán và xử trí phản vệ',
  legal_basis: 'Thông tư 51/2017/TT-BYT',
  document_id: 'tt-51-2017',
  page: 4,
};
assert.equal(extractShortSourceLabel(tt51, 2), 'TT 51/2017 · tr.4');

const dav: RagCitationItem = {
  source: 'Cục Quản lý Dược (DAV) - Danh mục thuốc lưu hành',
  legal_basis: 'DAV Master Registry',
  document_id: 'dav-national-registry',
};
assert.equal(extractShortSourceLabel(dav, 1), 'DAV');

// 3. Inline citation normalization: clean clusters + move orphan punctuation before pill
assert.equal(
  normalizeInlineCitations('giảm nguy cơ tiến triển bệnh [2] .'),
  'giảm nguy cơ tiến triển bệnh. [2]'
);
assert.equal(
  normalizeInlineCitations('bệnh nhân mắc bệnh thận mạn [3] [4] .'),
  'bệnh nhân mắc bệnh thận mạn. [3][4]'
);
assert.equal(
  normalizeInlineCitations('khuyến cáo mới [1, 2, 3]. Tiếp theo là...'),
  'khuyến cáo mới. [1][2][3] Tiếp theo là...'
);
assert.equal(
  normalizeInlineCitations('theo [1] khuyến cáo nên dùng [2], đồng thời theo dõi.'),
  'theo [1] khuyến cáo nên dùng, [2] đồng thời theo dõi.'
);
// Markdown links must never be broken
assert.equal(
  normalizeInlineCitations('Xem [Dược thư](https://example.com) ngay.'),
  'Xem [Dược thư](https://example.com) ngay.'
);

console.log('Citation label & inline normalization tests passed.');
