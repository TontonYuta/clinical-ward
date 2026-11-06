import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSource, sourceMatches } from './ui-header-audit/source.mjs';
import { collectRuntime } from './ui-header-audit/runtime.mjs';
import { redundantHeadingPair } from './ui-header-audit/rules.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = (key, fallback) => (args.includes(key) ? args[args.indexOf(key) + 1] : fallback);
const label = value('--label', 'current');
const out = path.resolve(root, value('--out-dir', `artifacts/ui-header-audit/${label}`));
await mkdir(out, { recursive: true });
const source = await scanSource(root);
const runtime = args.includes('--static-only')
  ? { snapshots: [], errors: [] }
  : await collectRuntime({
      baseUrl: value('--base-url', 'http://localhost:3000'),
      screenshotDir: path.join(out, 'screenshots'),
      allowFullCatalog: args.includes('--full-catalog'),
      onSnapshot: (s) => console.log(`${s.width}: ${s.id}`),
    });
const findings = [];
for (const snapshot of runtime.snapshots) {
  for (const heading of snapshot.headings) heading.sources = sourceMatches(heading.text, source);
  if (snapshot.id.startsWith('page-') && snapshot.bands.length > 1)
    findings.push({
      rule: 'multiple-page-header-bands',
      confidence: 'high',
      scenario: snapshot.id,
      width: snapshot.width,
      headings: snapshot.headings.filter((h) =>
        ['shell-title', 'page-title', 'eyebrow'].includes(h.kind),
      ),
      recommendation:
        'Giữ một header tên trang và thao tác chính; gỡ PageHeading/eyebrow đánh số trùng vai trò.',
    });
  for (let i = 0; i < snapshot.headings.length; i++)
    for (let j = i + 1; j < snapshot.headings.length; j++) {
      const a = snapshot.headings[i],
        b = snapshot.headings[j];
      const match = redundantHeadingPair(a, b);
      if (match)
        findings.push({
          ...match,
          scenario: snapshot.id,
          width: snapshot.width,
          headings: [a, b],
          recommendation:
            match.confidence === 'high'
              ? 'Kiểm tra và giữ nhãn ở cấp điều hướng phù hợp; thay nhãn lặp bằng thông tin bổ sung.'
              : 'Cần rà soát ý nghĩa và phạm vi trước khi gộp; không tự động xóa.',
        });
    }
}
const report = {
  generatedAt: new Date().toISOString(),
  label,
  scope: {
    files: source.files.length,
    reachableFiles: source.files.filter((f) => f.reachable).length,
    staticHeadingNodes: source.nodes.length,
    runtimeScenarios: runtime.snapshots.length,
    viewports: [1440, 375],
    note: 'Các cặp tương đồng là ứng viên rà soát. Loại trừ tiêu đề bản in, dữ liệu nhận diện và nhãn điều hướng lặp có chủ đích. Không suy ra toàn bộ trạng thái động từ phân tích tĩnh.',
    catalogMode: args.includes('--full-catalog')
      ? 'full'
      : 'essential fallback from repository; heavy gzip responses aborted',
  },
  source,
  ...runtime,
  findings,
};
await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const escape = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const unique = new Map();
for (const f of findings) {
  const key = [f.scenario, f.rule, ...f.headings.map((h) => h.text)].join('|');
  const old = unique.get(key);
  if (old) old.widths.push(f.width);
  else unique.set(key, { ...f, widths: [f.width] });
}
const lines = [
  '# Rà soát tiêu đề UI lặp',
  '',
  `Chụp ${report.scope.runtimeScenarios} trạng thái ở 1440px và 375px; quét ${source.files.length} tệp TSX, ${source.nodes.length} nút tiêu đề.`,
  '',
  report.scope.note,
  '',
  '## Các trường hợp cần rà soát',
  '',
  '| Màn hình | Quy tắc | Nội dung | Vị trí nguồn | Độ rộng |',
  '|---|---|---|---|---|',
  ...Array.from(unique.values()).map(
    (f) =>
      `| ${escape(f.scenario)} | ${f.rule} / ${f.confidence} | ${f.headings.map((h) => escape(h.text)).join(' ↔ ')} | ${[...new Set(f.headings.flatMap((h) => (h.sources || []).map((s) => `${s.file}:${s.line}`)))].join('; ')} | ${[...new Set(f.widths)].join(', ')} |`,
  ),
  '',
  '## Trạng thái chưa thu thập được',
  '',
  ...(runtime.errors.length
    ? runtime.errors.map((e) => `- ${e.scenario}: ${e.error}`)
    : ['Không có lỗi thu thập.']),
  '',
  '## Thành phần không nằm trên cây JSX hiện tại',
  '',
  'Các tệp sau chỉ được kiểm kê tĩnh; không kết luận rằng tiêu đề của chúng đang xuất hiện trên UI:',
  '',
  ...source.files
    .filter((f) => !f.reachable && f.headings)
    .map((f) => `- ${f.file}: ${f.headings} nút tiêu đề.`),
  '',
];
await writeFile(path.join(out, 'report.md'), lines.join('\n'));
console.log(
  JSON.stringify({
    out,
    ...report.scope,
    findings: findings.length,
    uniqueCandidates: unique.size,
    errors: runtime.errors.length,
  }),
);
if (runtime.errors.length) process.exitCode = 2;
else if (args.includes('--check') && findings.some((f) => f.confidence === 'high'))
  process.exitCode = 1;
