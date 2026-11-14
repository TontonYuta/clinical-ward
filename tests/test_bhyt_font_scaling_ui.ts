import assert from 'node:assert/strict';
import fs from 'node:fs';

const tab = fs.readFileSync('src/components/RightPane/Tabs/BhytAuditTab.tsx', 'utf8');
const css = fs.readFileSync('src/index.css', 'utf8');
assert.ok(tab.includes('bhyt-audit-tab'), 'tab có scope CSS độc lập');
assert.ok(css.includes('.bhyt-audit-tab button') && css.includes('height: auto !important'), 'nút và form không bị khóa chiều cao khi cỡ chữ tăng');
assert.ok(css.includes('.bhyt-audit-tab table') && css.includes('min-width: 72rem'), 'bảng giữ vùng đọc và có thể cuộn ngang ở cỡ chữ lớn');
assert.ok(css.includes('.bhyt-audit-tab th') && css.includes('line-height: 1.4'), 'dòng trong bảng có khoảng thở theo cỡ chữ');
console.log('BHYT font scaling layout checks passed');
