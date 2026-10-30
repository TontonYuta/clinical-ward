# Additive DAV Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the canonical DAV staging catalog into additive tables in a verified copy of the application SQLite DB, preserving legacy tables and data.

**Architecture:** A standalone migration/import script uses SQLite online backup, creates namespaced catalog tables, loads a new immutable run from canonical staging, checks integrity and cardinality, then emits a report. It never updates legacy registry rows or changes API routing.

**Tech Stack:** Python 3, sqlite3, SQLite FTS5, pytest.

**Spec:** `docs/superpowers/specs/2026-10-30-additive-dav-catalog-design.md`

## Global Constraints

- Do not modify legacy `dav_national_drugs` or clinical tables.
- Import only into a backup/copy unless the caller explicitly supplies another destination.
- Preserve unresolved duplicate source records and never publish them as canonical products.
- Do not infer `isDuocPhep` as legal active status.
- No endpoint cutover in this plan.

## Review Focus

- Existing destination content: refuse overwrite unless explicitly allowed; test existing file is unchanged.
- Duplicate SĐK candidates: preserve all raw records but only selected/unique canonical records; test unresolved group.
- Clinical data preservation: test legacy row count and representative linked fields unchanged.
- Re-run: a repeated run ID must fail without corrupting the prior destination.
- FTS and code search: verify exact SĐK and FTS return canonical products.

---

### Task 1: Define safe additive migration schema

**Files:**
- Create: `backend/app/services/dav_catalog_migration.py`
- Test: `backend/tests/test_dav_catalog_migration.py`

**Interfaces:**
- Produces `migrate_staging_catalog(*, source_db: Path, app_db: Path, output_db: Path, run_id: str) -> dict[str, Any]`
- Default `output_db` is chosen by the CLI, never by mutating `app_db`.

- [ ] Add tests for table creation on copied app DB; assert legacy row counts and clinical link IDs unchanged.
- [ ] Add test that existing output path refuses overwrite.
- [ ] Add test that FTS5 virtual table exists and schema has expected foreign keys/indexes.
- [ ] Implement additive schema and online backup into an output copy.
- [ ] Run focused tests and inspect SQLite integrity.

### Task 2: Import raw audit rows, resolution, canonical product and ingredient data

**Files:**
- Modify: `backend/app/services/dav_catalog_migration.py`
- Test: `backend/tests/test_dav_catalog_migration.py`

**Interfaces:**
- `migrate_staging_catalog` imports one immutable `run_id` and returns counts plus hashes.

- [ ] Add test proving source rows and unresolved duplicate candidates remain auditable while unresolved products are absent from canonical products.
- [ ] Add test for expected ingredient mapping counts and source IDs.
- [ ] Implement transactionally with parameterized SQL, load source metadata, raw JSON, resolution records and canonical product/ingredient rows.
- [ ] Verify `run_id` uniqueness and rollback on any validation failure.
- [ ] Run tests and compare imported counts with staging counts.

### Task 3: Add CLI, read-only verification report and practical benchmark

**Files:**
- Create: `scripts/migrate_dav_catalog_additive.py`
- Modify: `backend/tests/test_dav_catalog_migration.py`
- Create output: `artifacts/dav-catalog-migration-report.json`

- [ ] Test CLI target selection defaults to `artifacts/clinical_hospital-with-dav-catalog.sqlite`, not the live DB.
- [ ] Implement CLI flags for source, app DB, output and run ID.
- [ ] Report source counts, imported counts, legacy invariants, `integrity_check`, foreign key checks and sample query plans.
- [ ] Run import into a fresh output copy and confirm the live DB file hash/size and row counts remain unchanged.
- [ ] Run relevant tests and `git diff --check`.

### Task 4: Document rollback and import evidence

**Files:**
- Modify: `docs/superpowers/specs/2026-10-30-additive-dav-catalog-design.md`
- Create output: `artifacts/dav-catalog-migration-report.json`

- [ ] Record exact counts, hashes, invariant checks and rollback method in generated report.
- [ ] Confirm no API route or production DB was changed.
