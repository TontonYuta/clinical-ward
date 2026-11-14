import assert from 'node:assert/strict';
import fs from 'node:fs';

const modal = fs.readFileSync('src/components/Modals/NationalDrugRegistryModal.tsx', 'utf8');

assert.ok(!modal.includes("import { NationalDrugTabs }"), 'Kho Dược Quốc Gia không được tách nhóm bằng tabs');
assert.ok(!modal.includes('<NationalDrugTabs'), 'Kho Dược Quốc Gia phải hiển thị một danh sách thống nhất');
console.log('unified national registry UI checks passed');
