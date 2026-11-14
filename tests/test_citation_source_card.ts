import assert from 'node:assert/strict';
import { CitationSourceList } from '../src/components/LeftPane/CitationSourceList';

let clicked: any;
const element = CitationSourceList({
  citations: [{
    source: 'Dược thư Quốc gia Việt Nam',
    legal_basis: 'Dược thư Quốc gia Việt Nam, lần xuất bản II',
    title: 'Chuyên luận Paracetamol',
    section: 'Hiệu chỉnh liều khi suy gan',
    page: 1118,
    url: '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=1118',
  }],
  onCitationClick: (citation) => { clicked = citation; },
});
const sourceRow = (element as any)?.props?.children?.[1];
const buttons = sourceRow?.props?.children as any[];
assert.equal(buttons.length, 1, 'one source should render as one separate source card');
assert.equal(buttons[0].type, 'button', 'a source with a URL should be clickable');
buttons[0].props.onClick();
assert.equal(clicked.page, 1118);
assert.equal(clicked.url, '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=1118');
assert.equal(CitationSourceList({ citations: [] }), null, 'no citation should not create an unsupported source card');

console.log('Citation sources render separately and preserve document/page on click');
