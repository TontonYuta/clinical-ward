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

  console.log('🎉 ALL CHAT MARKDOWN TESTS PASSED 100%!');
}

testChatMarkdown();
