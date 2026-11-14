import assert from 'node:assert/strict';
import fs from 'node:fs';

const sidebar = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
assert.ok(!sidebar.includes('<SidebarLegalLinks'), 'Khu vực Tiện ích & Pháp lý không được render trên FE');
assert.ok(sidebar.includes('SidebarNavLinks'), 'Sidebar dùng điều hướng tab chung');
assert.ok(!sidebar.includes('onOpenDocuments'), 'Sidebar không dùng callback overlay riêng cho Tài liệu');
console.log('sidebar utility/legal section hidden checks passed');
