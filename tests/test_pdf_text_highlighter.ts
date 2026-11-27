import assert from 'node:assert/strict';
import { findMatchedTextItemIndices, findSectionMatches } from '../src/utils/pdfTextHighlighter';
import { extractHighlightTargets } from '../src/utils/pdfSectionExtractor';

// 1. Section heading match anchored to drug monograph (avoids previous drug on 2-column page)
{
  const items = [
    'PAPAVERIN',
    'Suy gan:',
    'Không dùng cho bệnh nhân suy gan nặng.',
    'PARACETAMOL',
    'Chỉ định:',
    'Giảm đau, hạ sốt.',
    'Suy gan:',
    'Dùng thận trọng, dùng liều thấp.',
  ];
  const targets = extractHighlightTargets({
    title: 'Dược thư QG: Paracetamol',
    section: 'organ_adjustment',
    excerpt: 'Suy gan: Dùng thận trọng, dùng liều thấp.',
  });
  const groups = findSectionMatches(items, targets);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].matchKind, 'heading');
  assert.deepEqual(groups[0].itemIndices, [6], 'Must highlight Suy gan: under PARACETAMOL, not PAPAVERIN');
}

// 2. Fallback snippet match for plain prose
{
  const items = ['Kháng sinh ban đầu', 'cần dùng sớm trong vòng 1 giờ.'];
  const targets = extractHighlightTargets({
    title: 'Ghi chú lâm sàng',
    excerpt: 'Kháng sinh ban đầu cần dùng sớm trong vòng 1 giờ.',
  });
  const groups = findSectionMatches(items, targets);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].matchKind, 'snippet');
}

// 3. Direct findMatchedTextItemIndices backward compatibility
{
  const items = ['Chống chỉ định với para-', 'cetamol ở bệnh nhân suy gan nặng.'];
  const matched = findMatchedTextItemIndices(items, 'paracetamol ở bệnh nhân suy gan nặng');
  assert.ok(matched.has(0));
  assert.ok(matched.has(1));
  assert.equal(findMatchedTextItemIndices([], 'Paracetamol').size, 0);
}

// 4. Never match previous drug's heading above drugAnchor on a 2-drug transition page
{
  const items = [
    'MESNA',
    'Thời kỳ mang thai',
    'Có thể dùng mesna cho người mang thai.',
    'METFORMIN',
    'Tên chung quốc tế:',
    'Metformin.',
    'Mã ATC:',
    'A10BA02.',
  ];
  const targets = extractHighlightTargets({
    title: 'Dược thư Quốc gia Việt Nam (Trang 955)',
    query: 'Thời kỳ mang thai và Mã ATC của Metformin',
    excerpt: 'Mã ATC: A10BA02.',
  });
  const groups = findSectionMatches(items, targets);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].itemIndices, [6], 'Must only match Mã ATC: under METFORMIN, never Thời kỳ mang thai under MESNA');
}

console.log('test_pdf_text_highlighter passed');
