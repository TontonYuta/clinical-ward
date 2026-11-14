import assert from 'node:assert/strict';
import { renderFormattedText } from '../src/components/LeftPane/ChatMarkdown';

const report = [
  '## Kết quả đọc ảnh',
  '',
  '**Loại tài liệu:** Đơn thuốc ngoại trú',
  '',
  '### Dữ kiện nhận diện',
  '',
  '• Paracetamol 500 mg',
  '',
  '### Trường chưa đọc rõ',
  '',
  'Số thẻ BHYT',
  '',
  '### Trạng thái đối chiếu',
  '',
  '> Trích xuất từ ảnh, chưa xác minh với cơ sở dữ liệu.',
].join('\n');

const nodes = renderFormattedText(report) as any[];
assert.ok(nodes.some((node) => String(node?.key || '').startsWith('h2-')), 'report title renders as a heading');
assert.equal(nodes.filter((node) => String(node?.key || '').startsWith('h3-')).length, 3, 'each report section renders as a heading');
assert.ok(nodes.some((node) => String(node?.key || '').startsWith('bullet-')), 'recognized image data renders as a list item');
assert.ok(nodes.some((node) => String(node?.key || '').startsWith('quote-') || String(node?.key || '').startsWith('alert-')), 'verification note renders as a callout');
console.log('structured image report renders with clear sections');
