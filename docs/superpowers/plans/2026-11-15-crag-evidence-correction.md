# CRAG Evidence Correction Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans and implement each task with TDD.

**Goal:** Add one bounded corrective retrieval pass when initial document evidence fails the current generic evidence relevance check.

**Architecture:** Expose the current chunk relevance predicate from citation_grounder.py. In rag_pipeline.py, filter initial candidates before building evidence context; if none qualify, retrieve a larger same-query candidate set once, deduplicate by chunk ID, and filter again. Keep graph evidence, provenance validation, context limits, and abstention intact.

**Tech Stack:** Python, pytest, existing hybrid retriever and SQLite/vector indexes.

**Spec:** docs/superpowers/specs/2026-11-15-crag-evidence-correction-design.md

## Global Constraints

- Add no hardcoded clinical facts or medication vocabulary.
- Make at most one additional retrieval call.
- Never treat RRF score as a probability or evidence verification.
- Keep citation/provenance/claim validation and context size enforcement.
- Do not deploy or overwrite unrelated local changes.

## Review Focus

- First-pass evidence already qualifies: do not issue another retrieval request.
- First-pass evidence fails but expanded retrieval has a qualifying chunk: only qualifying chunks reach generation.
- Both passes fail: preserve safe abstention.
- Duplicate chunk IDs across passes: include each chunk once.
- Retriever lacks corpus metadata: expansion remains bounded by a fixed multiplier of initial top_k.

---

### Task 1: Expose the existing relevance predicate

**Files:**
- Modify: backend/app/services/rag/citation_grounder.py
- Test: backend/tests/test_clinical_rag.py

**Interfaces:**
- Produces: is_evidence_relevant(query: str, chunk: RetrievedChunk) -> bool

- [ ] Add a focused test that the public predicate preserves current drug identity and generic overlap behavior.
- [ ] Run the new test and confirm failure because the function is absent.
- [ ] Add a thin public wrapper over the existing overlap check and use it from the chunk filter.
- [ ] Run the focused test and confirm pass.

### Task 2: Add single bounded corrective retrieval

**Files:**
- Modify: backend/app/services/rag/rag_pipeline.py
- Test: backend/tests/test_rag_evidence_provenance.py

**Interfaces:**
- Consumes: is_evidence_relevant(query, chunk).
- Internal helper: retrieve_with_correction(retriever, query, top_k) -> list[RetrievedChunk].

- [ ] Add tests proving no second call when initial evidence qualifies, one expanded call when all initial chunks fail, only qualifying evidence is retained, and duplicate IDs collapse.
- [ ] Run those tests to confirm failures before implementation.
- [ ] Implement one expanded retrieval pass using the same query and bounded top_k; preserve initially relevant chunks and deduplicate by chunk_id.
- [ ] Use corrected selected chunks before evidence prompt construction and citation creation.
- [ ] Run focused tests and provenance suite.

### Task 3: Regression verification

**Files:**
- Verify: backend/tests/test_clinical_rag.py
- Verify: backend/tests/test_rag_evidence_provenance.py
- Verify: backend/tests/test_self_rag_verification.py

- [ ] Run all listed suites.
- [ ] Run git diff --check and inspect the diff for unrelated edits.
