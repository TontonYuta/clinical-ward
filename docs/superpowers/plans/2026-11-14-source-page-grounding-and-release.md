# Source Page Grounding and Release Readiness Implementation Plan

> **For agentic workers:** Execute inline in this session. Run each task's tests before moving on.

**Goal:** Correct source page attribution, resolve release-blocking regressions, and deploy the verified FE and BE to production.

**Architecture:** Derive page metadata from the PDF during monograph extraction, persist it through JSON and SQLite, and use the existing section page resolver. Verify prompt/evidence provenance and fix root causes of failing backend tests before release.

**Tech Stack:** Python, FastAPI, SQLite, pytest, TypeScript, Vite, GitHub Actions, Render, Vercel.

**Spec:** docs/superpowers/specs/2026-11-14-source-page-grounding-design.md

## Global Constraints

- No drug-specific or manually curated medical knowledge.
- Section text and page numbers must be sourced from the PDF.
- Do not overwrite unrelated workspace changes.
- Do not deploy until backend tests, frontend checks, and production verification pass.

## Review Focus

- Multiple monographs on one page must not share the wrong section page.
- A requested section may start on a continuation page after the monograph heading.
- PDF column order can place another monograph's heading beside the target section.
- Updated source JSON must refresh the database on backend startup.
- Citation page must locate the requested section in the PDF.

---

### Task 1: Persist exact section page maps

**Files:**
- Modify: scripts/extract_all_dtqg_monographs.py
- Modify: backend/app/seed_monographs.py
- Test: tests/test_dtqg_pdf_sync.py
- Test: backend/tests/test_source_page_grounding.py (create if needed)

- [ ] Add failing tests proving Paracetamol drug_interactions maps to page 1120 and that a monograph's continuation section maps to the page containing its heading.
- [ ] Run the tests and verify they fail because section_pages is absent or falls back to the monograph start page.
- [ ] Derive section_pages from source PDF headings across the monograph's bounded page range, and persist it in extracted JSON and the SQLite row.
- [ ] Run source-page tests and confirm the requested-field resolver returns the PDF page with the heading.

### Task 2: Align RAG evidence verification tests and fix backend regressions

**Files:**
- Modify: backend/tests/test_rag_evidence_provenance.py
- Modify only implementation files demonstrated by failing tests.

- [ ] Update the evidence provenance regression to assert current verify_answer_claims inputs/outputs, while keeping evidence-to-prompt alignment assertions.
- [ ] Run that test red, then correct the test or production behavior according to the current evidence contract.
- [ ] Capture and classify the full backend suite failures, fix root causes with one failing test per behavior, and rerun affected tests.
- [ ] Run the full backend suite and require zero failures.

### Task 3: Full-stack verification and deployment

**Files:**
- Modify only release blockers identified by verification.

- [ ] Run frontend tests, npm run lint, and npm run build; resolve failures.
- [ ] Re-run extraction, seed the local database, and verify chatbot API reply and citation target the section page.
- [ ] Verify deployment workflow targets FE and BE and production health checks.
- [ ] Push the scoped, reviewed changes to the configured production branch only after all gates pass; wait for FE/BE deployments and run live health plus chatbot citation checks.

## Completion criteria

- Full backend suite passes.
- Frontend tests, typecheck, and production build pass.
- API response preserves the source statement and its citation opens the page containing the relevant section.
- Production FE and BE deployment workflows complete and live checks pass.
