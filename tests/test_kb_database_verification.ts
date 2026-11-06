import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'clinical-kb-verification-'));
const script = path.join(root, 'scripts/verify_clinical_knowledge_base.ts');
const tsx = path.join(root, 'node_modules/tsx/dist/cli.mjs');
const terms = ['Paracetamol', 'Ceftriaxon', 'Morphin', 'Diazepam', 'Adrenalin', 'Vancomycin'];
const dbPath = path.join(folder, "clinical ' reference.db");

function run(database: string, python = 'python3') {
  return spawnSync(process.execPath, [tsx, script], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CLINICAL_KB_DB_PATH: database, CLINICAL_KB_PYTHON: python },
  });
}

try {
  const missing = path.join(folder, 'missing.db');
  const missingResult = run(missing);
  assert.notEqual(missingResult.status, 0, 'An explicitly configured missing database must fail verification');
  assert.equal(fs.existsSync(missing), false, 'Verification must not create a missing database');

  const invalid = path.join(folder, 'invalid.db');
  fs.writeFileSync(invalid, 'This is not a SQLite database.');
  assert.notEqual(run(invalid).status, 0, 'Unreadable SQLite data must fail verification');

  execFileSync('python3', ['-c', `
import json, sqlite3, sys
with sqlite3.connect(sys.argv[1]) as db:
    db.execute('CREATE TABLE dav_national_drugs(active_ingredient TEXT)')
    db.executemany('INSERT INTO dav_national_drugs VALUES (?)', [(term,) for term in json.loads(sys.argv[2])])
`, dbPath, JSON.stringify(terms)]);
  const before = fs.readFileSync(dbPath);
  const success = run(dbPath);
  assert.equal(success.status, 0, success.stdout + success.stderr);
  assert.match(success.stdout, /Vancomycin.*1/);
  assert.deepEqual(fs.readFileSync(dbPath), before, 'Read-only verification must preserve database bytes');

  assert.notEqual(run(dbPath, path.join(folder, 'missing-python')).status, 0,
    'A missing query interpreter must not be reported as a passing database check');

  execFileSync('python3', ['-c', `
import sqlite3, sys
with sqlite3.connect(sys.argv[1]) as db:
    db.execute('DELETE FROM dav_national_drugs WHERE active_ingredient = ?', ('Vancomycin',))
`, dbPath]);
  assert.notEqual(run(dbPath).status, 0, 'Missing required ingredient coverage must fail verification');
  console.log('knowledge-base database verification regression checks passed');
} finally {
  fs.rmSync(folder, { recursive: true, force: true });
}
