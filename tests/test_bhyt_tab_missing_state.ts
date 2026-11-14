import fs from 'node:fs';

const source = fs.readFileSync('src/components/RightPane/Tabs/BhytAuditTab.tsx', 'utf8');
if (!source.includes("status: 'REVIEW' as const")) throw new Error('Clinical categories need an explicit review state');
if (!source.includes("auditReport.status === 'NEEDS_REVIEW'")) throw new Error('BHYT tab must prioritize NEEDS_REVIEW');
if (!source.includes('Chưa đủ dữ liệu')) throw new Error('Missing data must be visible in the tab');
if (source.includes("HOSPITAL_RANK_LABELS.HANG_I || 'Hạng I'")) throw new Error('Missing hospital rank must not be displayed as Hạng I');
if (source.includes("it.route || 'Uống'")) throw new Error('Missing route must not be displayed as Uống');
if (source.includes("category.id === 6 && category.status !== 'ALERT'")) throw new Error('Missing BHYT fields must not force DDI review');
if (source.includes("category.id === 5 && activePayload.items.some")) throw new Error('Missing optional timing text must not force BHYT review');
console.log('BHYT tab missing-state checks passed');
