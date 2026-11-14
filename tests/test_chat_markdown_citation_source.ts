import assert from 'node:assert/strict';
import { formatInlineMarkdown, renderFormattedText } from '../src/components/LeftPane/ChatMarkdown';

const inline = formatInlineMarkdown(' [Dược thư tr. 20]', {
  hideInlineSources: true,
  citations: [{
    source: 'Dược thư Quốc gia Việt Nam',
    legal_basis: 'QĐ 2033/QĐ-BYT',
    title: 'Dược thư Quốc gia',
    section: 'Chuyên luận',
    document_id: 'dtqg-v2-2015',
    page: 20,
    url: '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=20',
  }],
});
assert.equal(
  (inline as any[]).some((node) => typeof node === 'string' && node.trim().length > 0),
  false,
  'source labels should not remain inside answer prose',
);
const legacyPdfLink = formatInlineMarkdown('[Dược thư](/pdf/Duoc_Thu.pdf#page=20)', { hideInlineSources: true });
assert.equal(
  (legacyPdfLink as any[]).some((node) => typeof node === 'string' && node.trim().length > 0),
  false,
  'legacy PDF links should not appear inline when structured citations are used',
);

const sourceLine = renderFormattedText('Thông tin đã tra cứu.\n\nNguồn: [Dược thư tr. 20]', { hideInlineSources: true, citations: [] });
assert.ok(!JSON.stringify(sourceLine).includes('Nguồn:'), 'unverified source lines should never render as chat prose');

console.log('Inline source text is hidden; structured citations render separately');
