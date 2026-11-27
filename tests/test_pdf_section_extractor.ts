import assert from 'node:assert/strict';
import { extractHighlightTargets } from '../src/utils/pdfSectionExtractor';

// 1. Extract drug anchor + colon headings from excerpt
{
  const targets = extractHighlightTargets({
    title: 'Dược thư QG: Paracetamol',
    section: 'organ_adjustment',
    excerpt: 'Suy gan: Dùng thận trọng, dùng liều thấp. Tránh dùng kéo dài.',
  });
  assert.equal(targets.drugAnchor, 'paracetamol');
  assert.ok(targets.sectionHeadings.includes('Suy thận'));
  assert.ok(targets.sectionHeadings.includes('Suy gan'));
  assert.ok(targets.sectionHeadings.some((h) => h.replace(/:$/, '') === 'Suy gan'));
}

// 2. Extract legal circular headings
{
  const targets = extractHighlightTargets({
    title: 'Thông tư 22/2011/TT-BYT',
    excerpt: 'Điều 5. Tủ thuốc trực cấp cứu tại khoa lâm sàng phải đảm bảo cơ số.',
  });
  assert.ok(targets.sectionHeadings.some((h) => h.toLowerCase() === 'điều 5'));
}

// 3. Plain unstructured prose retains fallback snippet
{
  const targets = extractHighlightTargets({
    title: 'Ghi chú lâm sàng',
    excerpt: 'Kháng sinh ban đầu cần dùng sớm trong vòng 1 giờ.',
  });
  assert.equal(targets.fallbackSnippets.length, 1);
}

// 4. Monograph index headings + drugAnchor from query, no prose fallback
{
  const targets = extractHighlightTargets({
    title: 'Dược thư Quốc gia Việt Nam (Trang 955)',
    query: 'Chống chỉ định và chỉnh liều Metformin ở bệnh nhân suy thận',
    excerpt: 'Không dùng cho người bệnh suy thận nặng.',
  });
  assert.equal(targets.drugAnchor, 'metformin');
  assert.ok(targets.sectionHeadings.includes('Chống chỉ định'));
  assert.ok(targets.sectionHeadings.includes('Suy thận'));
  assert.equal(targets.fallbackSnippets.length, 0);
}

// 5. Asking "Chỉ định" must NOT highlight "Chống chỉ định" even if excerpt contains both;
// and asking "Chống chỉ định" must NOT highlight "Chỉ định" (substring collision guard)
{
  const t1 = extractHighlightTargets({
    title: 'Dược thư QG: Ciprofloxacin',
    query: 'Chỉ định của Ciprofloxacin',
    excerpt: 'Chỉ định: Nhiễm khuẩn đường tiết niệu. Chống chỉ định: Quá mẫn.',
  });
  assert.deepEqual(t1.sectionHeadings, ['Chỉ định']);

  const t2 = extractHighlightTargets({
    title: 'Dược thư QG: Amoxicillin',
    query: 'Chống chỉ định của Amoxicillin',
    excerpt: 'Chỉ định: Nhiễm khuẩn hô hấp. Chống chỉ định: Dị ứng penicilin.',
  });
  assert.deepEqual(t2.sectionHeadings, ['Chống chỉ định']);

  const t3 = extractHighlightTargets({
    title: 'Dược thư Quốc gia Việt Nam',
    query: 'Amoxicillin có dùng cho phụ nữ có thai được không',
    excerpt: 'Sử dụng an toàn trong thai kỳ chưa được xác định rõ.',
  });
  assert.equal(t3.drugAnchor, 'amoxicillin');
  assert.ok(t3.sectionHeadings.includes('Thời kỳ mang thai'));
}

console.log('test_pdf_section_extractor passed');
