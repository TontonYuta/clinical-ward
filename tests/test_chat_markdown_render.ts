import React from 'react';
import { renderFormattedText } from '../src/components/LeftPane/ChatMarkdown';

function testChatMarkdown() {
  console.log('=== TEST CHAT MARKDOWN RENDERING ===');

  // 1. Test Markdown Table
  const tableMarkdown = `
| Đường dùng | Liều lượng | Tần suất |
| :--- | :--- | :--- |
| **Đường uống** | 0,5 - 1 g | Mỗi 4 - 6 giờ |
| **Tiêm truyền IV** | 1 g | Truyền 15 phút |
`;
  const tableNodes = renderFormattedText(tableMarkdown) as any[];
  if (!Array.isArray(tableNodes) || tableNodes.length === 0) {
    throw new Error('Table parsing failed to return nodes');
  }
  const hasTable = tableNodes.some(node => node && node.props && node.props.children && node.props.children.type === 'table');
  if (!hasTable) {
    throw new Error('Table element was not generated from markdown table string!');
  }
  console.log('✅ 1. Markdown Table parsing passed!');

  // 2. Test Metadata Badges Grid
  const metaLine = `• **Hoạt chất chính:** **Paracetamol** | **Số đăng ký (DAV):** \`VD-10405-10\` | **Dạng bào chế:** Dung dịch tiêm`;
  const metaNodes = renderFormattedText(metaLine) as any[];
  const hasPillGrid = metaNodes.some(node => node && node.key && String(node.key).startsWith('meta-pills'));
  if (!hasPillGrid) {
    throw new Error('Metadata Pill Grid was not generated from pipe-delimited specs!');
  }
  console.log('✅ 2. Metadata Pill Grid parsing passed!');

  // 3. Test Callout Alerts
  const alertMarkdown = `
> [!WARNING] CẢNH BÁO ĐỘC TÍNH GAN
> • Suy gan nặng chống chỉ định tuyệt đối.
> • Tối đa 3g/ngày ở người nghiện rượu.
`;
  const alertNodes = renderFormattedText(alertMarkdown) as any[];
  const hasAlert = alertNodes.some(node => node && node.key && String(node.key).startsWith('alert'));
  if (!hasAlert) {
    throw new Error('Alert Callout Box was not generated from [!WARNING]!');
  }
  console.log('✅ 3. Callout Alerts parsing passed!');

  // 4. Test Inline Citation Badges & Markdown PDF Links (Tier 1 Grounding)
  let clickedCitation: any = null;
  const citationMarkdown = `Liều dùng khuyến cáo là 10 - 15 mg/kg/lần [DTQG tr.1118], khoảng cách liều 4 - 6 giờ [QĐ 5948] hoặc xem [Chuyên Luận](/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=1118).`;
  const citationNodes = renderFormattedText(citationMarkdown, {
    citations: [
      {
        source: 'Dược thư Quốc gia Việt Nam',
        legal_basis: 'DTQG 2015',
        section: 'Liều dùng',
        page: 1118,
        excerpt: 'Trẻ em: 10 - 15 mg/kg/lần',
      },
    ],
    onCitationClick: (cit) => {
      clickedCitation = cit;
    },
  }) as any[];

  if (!Array.isArray(citationNodes) || citationNodes.length === 0) {
    throw new Error('Citation parsing failed to return nodes');
  }
  console.log('✅ 4. Inline Citation Badges parsed successfully!');

  // 5. Test Blockquote Grouping
  const blockquoteMarkdown = `> Căn cứ Dược thư Quốc gia Việt Nam 2015\n> Liều dùng trẻ em điều chỉnh theo cân nặng`;
  const quoteNodes = renderFormattedText(blockquoteMarkdown) as any[];
  const hasBlockquote = quoteNodes.some(node => node && node.type === 'blockquote');
  if (!hasBlockquote) {
    throw new Error('Consecutive > lines were not grouped into a semantic blockquote!');
  }
  console.log('✅ 5. Blockquote grouping parsed successfully!');

  // 6. Test Excerpt Markdown with Bullets, Bold, and Compact Mode
  const excerptMarkdown = `• **Trẻ sơ sinh 28 - 32 tuần:** 20 mg/kg một liều duy nhất.\n• **Liều duy trì:** 10 - 15 mg/kg cách 8 - 12 giờ nếu cần thiết.`;
  const excerptNodes = renderFormattedText(excerptMarkdown, { compact: true }) as any[];
  if (!Array.isArray(excerptNodes) || excerptNodes.length < 2) {
    throw new Error('Excerpt bullet lines were not parsed into structured items!');
  }
  const hasCompactBullet = excerptNodes.some(node => node && node.key && String(node.key).startsWith('bullet') && String(node.props.className).includes('text-xs'));
  if (!hasCompactBullet) {
    throw new Error('Excerpt bullets did not apply compact text-xs layout!');
  }
  console.log('✅ 6. Excerpt Markdown with Bullets & Compact Mode passed!');

  // 7. Test Auto-healing of Unclosed Markdown Markers
  const truncatedWithBrokenTokens = `**Liều dùng khuyến cáo**: Trẻ em 10 - 15 mg/kg. **Thận trọng…`;
  const healedNodes = renderFormattedText(truncatedWithBrokenTokens) as any[];
  if (!Array.isArray(healedNodes) || healedNodes.length === 0) {
    throw new Error('Auto-healed markdown failed to render nodes');
  }
  console.log('✅ 7. Auto-healing of unclosed markdown markers passed!');

  // 8. Test Nested Bullet Indentation (2 spaces)
  const nestedMarkdown = `- **Đường uống:**\n  * **Liều mỗi lần:** 500 mg/lần\n    * **Ghi chú thêm:** Uống sau ăn`;
  const nestedNodes = renderFormattedText(nestedMarkdown) as any[];
  const hasSubBullet = nestedNodes.some(node => node && node.props && String(node.props.className).includes('pl-3.5'));
  const hasDoubleSubBullet = nestedNodes.some(node => node && node.props && String(node.props.className).includes('pl-7'));
  if (!hasSubBullet || !hasDoubleSubBullet) {
    throw new Error('Nested bullets with 2 and 4 spaces failed to receive hierarchical indentation!');
  }
  console.log('✅ 8. Nested Bullet Indentation passed!');

  // 9. Test Bracket Section Header
  const bracketHdr = `[Liều dùng khuyến cáo cho trẻ 12 tuổi]:`;
  const bracketNodes = renderFormattedText(bracketHdr) as any[];
  const hasBracketHdr = bracketNodes.some(node => node && node.key && String(node.key).startsWith('bracket-hdr'));
  if (!hasBracketHdr) {
    throw new Error('Bracket section header failed to render structured badge!');
  }
  console.log('✅ 9. Bracket Section Header passed!');

  // 10. Test Paragraph Grouping
  const multiLinePara = `Dòng 1 của đoạn văn bản lâm sàng.\nDòng 2 tiếp tục ý trên trong cùng một đoạn.`;
  const paraNodes = renderFormattedText(multiLinePara) as any[];
  const pCount = paraNodes.filter(node => node && node.type === 'p').length;
  if (pCount !== 1) {
    throw new Error(`Consecutive regular lines should form 1 paragraph, got ${pCount}`);
  }
  console.log('✅ 10. Paragraph Grouping passed!');

  // 11. Test Suppression of Duplicate Source Line when Citations exist
  const textWithSource = `Liều dùng: 500mg.\nNguồn: [DTQG tr.1118]`;
  const nodesWithCitations = renderFormattedText(textWithSource, {
    citations: [{ source: 'Dược thư Quốc gia', legal_basis: 'DTQG 2015', page: 1118 }]
  }) as any[];
  const hasDuplicateSource = nodesWithCitations.some(node => node && node.key && String(node.key).startsWith('source-line'));
  if (hasDuplicateSource) {
    throw new Error('Duplicate source line should NOT be rendered when citations are provided!');
  }
  console.log('✅ 11. Suppression of duplicate source line with citations passed!');

  console.log('🎉 ALL CHAT MARKDOWN TESTS PASSED 100%!');

  const imageReport = `## Kết quả đọc ảnh\n\n**Loại tài liệu:** PRESCRIPTION\n\n### Dữ kiện nhận diện\n\n• Paracetamol 500 mg\n\n### Trường chưa đọc rõ\n\nSố thẻ BHYT\n\n### Trạng thái đối chiếu\n\n> Trích xuất từ ảnh, chưa xác minh với cơ sở dữ liệu.`;
  const imageNodes = renderFormattedText(imageReport) as any[];
  const imageHeaderKeys = imageNodes.map((node) => String(node?.key || ''));
  if (!imageHeaderKeys.some((key) => key.startsWith('h2-')) || imageHeaderKeys.filter((key) => key.startsWith('h3-')).length < 3) {
    throw new Error('Structured image report headings failed to render as headings');
  }
  console.log('✅ Structured image report headings passed!');
}

testChatMarkdown();
