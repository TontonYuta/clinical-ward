/** UI wording heuristics: findings are review candidates, never automatic deletion rules. */
export function normalizeHeading(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\b\d+\b/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const excluded = new Set(['navigation', 'data', 'print-title', 'action', 'status-title']);
const topics = [
  ['prescription', /\b(don thuoc|ke don|dieu tri ke don|danh sach don thuoc)\b/],
  ['pharmacy', /\b(kho duoc|ton kho han dung|danh muc lo thuoc)\b/],
  ['coldchain', /\b(chuoi lanh|bao quan giam sat)\b/],
  ['logs', /\b(nhat ky nhiet do|nhat ky theo doi nhiet do)\b/],
  ['forms', /\b(bieu mau hanh chinh y te|bieu mau hanh chinh)\b/],
];
export function redundantHeadingPair(a, b) {
  if (excluded.has(a.kind) || excluded.has(b.kind)) return null;
  const x = normalizeHeading(a.text),
    y = normalizeHeading(b.text);
  if (!x || !y || x.split(' ').length < 2 || y.split(' ').length < 2) return null;
  if (x === y) return { rule: 'exact-heading', confidence: 'high' };
  if (` ${x} `.includes(` ${y} `) || ` ${y} `.includes(` ${x} `))
    return { rule: 'contained-heading', confidence: 'review' };
  // Semantic matches are only hints at the page title/eyebrow level, not clinical section names.
  const pageKinds = new Set(['shell-title', 'page-title', 'eyebrow']);
  if (pageKinds.has(a.kind) && pageKinds.has(b.kind)) {
    const topic = topics.find(([, re]) => re.test(x) && re.test(y));
    if (topic) return { rule: 'same-ui-topic', topic: topic[0], confidence: 'review' };
  }
  return null;
}
