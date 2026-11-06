import ts from 'typescript';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { normalizeHeading } from './rules.mjs';
async function filesIn(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const parts = await Promise.all(
    entries.map((e) =>
      e.isDirectory() ? filesIn(path.join(dir, e.name)) : [path.join(dir, e.name)],
    ),
  );
  return parts.flat();
}
function attr(node, name) {
  const v = node.attributes.properties.find(
    (p) => ts.isJsxAttribute(p) && p.name.getText() === name,
  )?.initializer;
  if (!v) return '';
  if (ts.isStringLiteral(v)) return v.text;
  if (ts.isJsxExpression(v) && v.expression && ts.isStringLiteral(v.expression))
    return v.expression.text;
  return v.getText();
}
function jsxText(node) {
  if (ts.isJsxText(node)) return node.text.replace(/\s+/g, ' ');
  if (ts.isJsxExpression(node)) {
    if (!node.expression) return '';
    if (ts.isStringLiteral(node.expression)) return node.expression.text;
    return `{${node.expression.getText().slice(0, 90)}}`;
  }
  if (ts.isJsxElement(node) || ts.isJsxFragment(node)) return node.children.map(jsxText).join(' ');
  return '';
}
function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}
export async function scanSource(root) {
  const files = (await filesIn(path.join(root, 'src'))).filter((f) => f.endsWith('.tsx'));
  const sources = [];
  const allPaths = new Set(files);
  const nodes = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const ast = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const imports = new Map();
    const used = new Set();
    const headings = [];
    function add(node, kind, text) {
      const clean = decode(text).replace(/\s+/g, ' ').trim();
      if (!clean) return;
      const record = {
        file: path.relative(root, file),
        line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        kind,
        text: clean,
      };
      headings.push(record);
      nodes.push(record);
    }
    function visit(node) {
      if (
        ts.isImportDeclaration(node) &&
        node.importClause &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const spec = node.moduleSpecifier.text;
        if (node.importClause.name) imports.set(node.importClause.name.text, spec);
        const bindings = node.importClause.namedBindings;
        if (bindings && ts.isNamedImports(bindings))
          for (const entry of bindings.elements) imports.set(entry.name.text, spec);
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        function dynamic(n) {
          if (
            ts.isCallExpression(n) &&
            n.expression.kind === ts.SyntaxKind.ImportKeyword &&
            n.arguments[0] &&
            ts.isStringLiteral(n.arguments[0])
          )
            imports.set(node.name.text, n.arguments[0].text);
          ts.forEachChild(n, dynamic);
        }
        dynamic(node.initializer);
      }
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText();
        used.add(tag);
        if (tag === 'PageHeading')
          for (const prop of ['title', 'eyebrow', 'description'])
            add(node, `PageHeading.${prop}`, attr(node, prop));
        if (ts.isJsxOpeningElement(node)) {
          const text = jsxText(node.parent);
          if (/^h[1-6]$/.test(tag)) add(node, tag, text);
          else if (tag === 'p' && /eyebrow|section-kicker/.test(attr(node, 'className')))
            add(node, 'eyebrow', text);
          else if (
            tag === 'strong' &&
            ts.isJsxElement(node.parent.parent) &&
            /list-caption/.test(attr(node.parent.parent.openingElement, 'className'))
          )
            add(node, 'list-title', text);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    const edges = [];
    for (const name of used) {
      const spec = imports.get(name);
      if (!spec?.startsWith('.')) continue;
      const base = path.resolve(path.dirname(file), spec);
      const target = [base, `${base}.tsx`, path.join(base, 'index.tsx')].find((p) =>
        allPaths.has(p),
      );
      if (target) edges.push(path.relative(root, target));
    }
    sources.push({ file: path.relative(root, file), headings: headings.length, edges });
  }
  const graph = new Map(sources.map((s) => [s.file, s.edges]));
  const reachable = new Set();
  function walk(file) {
    if (reachable.has(file)) return;
    reachable.add(file);
    for (const edge of graph.get(file) || []) walk(edge);
  }
  walk('src/App.tsx');
  return {
    files: sources.map((s) => ({ ...s, reachable: reachable.has(s.file) })),
    nodes: nodes.map((n) => ({ ...n, reachable: reachable.has(n.file) })),
  };
}
export function sourceMatches(text, source) {
  const q = normalizeHeading(text);
  return source.nodes
    .filter((n) => {
      const raw = n.text.replace(/\{[^}]*\}/g, ' ');
      const norm = normalizeHeading(raw);
      return norm.length > 7 && (q === norm || q.startsWith(norm) || norm.startsWith(q));
    })
    .sort((a, b) => Number(b.reachable) - Number(a.reachable))
    .slice(0, 4);
}
