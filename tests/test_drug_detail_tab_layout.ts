import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/components/Modals/DavDrugDetailModal.tsx', import.meta.url), 'utf8');
for (const tab of ['Tổng quan', 'An toàn', 'Liều dùng', 'Thông tin đăng ký', 'Lô bệnh viện']) assert.ok(source.includes(tab), `missing tab ${tab}`);
assert.match(source, /useState<DrugDetailTab>\('overview'\)/);
for (const panel of ['overview', 'safety', 'dosage', 'registration', 'hospital-batch']) assert.ok(source.includes(`activeTab === '${panel}'`), `missing panel ${panel}`);
assert.doesNotMatch(source, /Cập nhật lại|DTQG 2015 &amp; SmPC|DTQG 2015 &amp; SmPC|CSDL Cục QLD/);
