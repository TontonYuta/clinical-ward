import assert from 'node:assert/strict';
import { normalizeHeading, redundantHeadingPair } from '../scripts/ui-header-audit/rules.mjs';
assert.equal(normalizeHeading('02  Điều trị & KÊ ĐƠN'), 'dieu tri ke don');
assert.equal(
  redundantHeadingPair(
    { kind: 'shell-title', text: 'Trạm lâm sàng / Đơn thuốc' },
    { kind: 'page-title', text: 'Đơn thuốc' },
  ).rule,
  'contained-heading',
);
assert.equal(
  redundantHeadingPair(
    { kind: 'eyebrow', text: 'Điều trị & kê đơn' },
    { kind: 'page-title', text: 'Đơn thuốc' },
  ).rule,
  'same-ui-topic',
);
assert.equal(
  redundantHeadingPair(
    { kind: 'selected-tab', text: 'Nhật ký nhiệt độ 6' },
    { kind: 'list-title', text: 'Nhật ký nhiệt độ' },
  ).rule,
  'exact-heading',
);
assert.equal(
  redundantHeadingPair(
    { kind: 'section-title', text: 'Tồn kho' },
    { kind: 'section-title', text: 'Tồn thấp' },
  ),
  null,
);
assert.equal(
  redundantHeadingPair(
    { kind: 'navigation', text: 'Đơn thuốc' },
    { kind: 'page-title', text: 'Đơn thuốc' },
  ),
  null,
);
assert.equal(
  redundantHeadingPair(
    { kind: 'print-title', text: 'Phiếu xuất thuốc' },
    { kind: 'dialog-title', text: 'Phiếu xuất thuốc' },
  ),
  null,
);
assert.equal(
  redundantHeadingPair(
    { kind: 'data', text: 'Nguyễn Văn A' },
    { kind: 'dialog-title', text: 'Nguyễn Văn A' },
  ),
  null,
);
console.log('Header audit rules passed');
