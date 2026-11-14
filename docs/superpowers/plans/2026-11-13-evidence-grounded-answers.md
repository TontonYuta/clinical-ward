# Evidence-Grounded Answers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every clinical answer is composed from the retrieved or authoritative database evidence, and any inference is explicitly limited to and traceable to that evidence.

**Architecture:** Keep the current specialized lookup and RAG routes, but normalize their factual content into answer claims with source evidence references. Validate the final answer against only evidence actually used; direct lookup must match source facts, inferred conclusions must expose their supporting premises, and unsupported or incomplete claims must be removed or cause safe abstention. User-facing citations remain available for checking but do not themselves count as proof of support.

**Tech Stack:** Python, FastAPI, Pydantic, existing SQLite/managed knowledge base, Gemini structured generation, pytest, TypeScript UI contracts where needed.

**Spec:** `docs/superpowers/specs/2026-11-11-copilot-evidence-workflow-design.md`, narrowed by the user's requirement that answers may state database facts or cautious inference from those facts, while citations serve user verification.

## Global Constraints

- Do not add hardcoded medication facts, disease facts, phrase inventories, or clinical exception rules to application code.
- Do not present a clinical assertion as supported merely because a citation or source link exists.
- Direct lookup is limited to facts present in the authoritative record/evidence; synthesis and patient-specific inference are marked “Chỉ mang tính tham khảo”.
- Inference must use only the retrieved evidence and clearly identify when that evidence does not support a requested conclusion.
- Unsupported, contradictory, incomplete, stale, or provenance-free clinical claims fail closed; no filling gaps from model knowledge.
- Keep existing response/API compatibility additive; do not change production during implementation.
- Do not run performance benchmarks until logic and correctness work is complete.

## Review Focus

- A fluent answer with one unsupported extra claim must not be accepted as grounded; test mixed supported and unsupported claims.
- A claim with a correct medication name but unsupported dose/unit must be rejected; test numeric/unit mismatch.
- A multi-source comparison must not use evidence about one entity to make a claim about another; test entity coverage by claim.
- A cautious inference must cite supporting premises and must not become a direct source fact; test distinction in response metadata and text.
- Missing, stale, malformed, or mismatched evidence must not be silently repaired by query terms or model supplied source IDs; test abstention and preserve evidence provenance.

## File Map

- Modify `backend/app/schemas/copilot.py`: add typed answer claims, support links, and operation metadata while retaining current response fields.
- Modify `backend/app/schemas/clinical_nlu.py` and `backend/app/services/chatbot/answer_operation.py`: retain and normalize direct lookup, evidence synthesis, and patient-specific inference classification.
- Modify `backend/app/services/rag/rag_pipeline.py`: ask generation for structured claim objects referencing only supplied evidence IDs; never rely on generated citations.
- Modify `backend/app/services/rag/self_rag_verifier.py`: replace keyword-overlap-as-proof behavior with generic evidence-reference, entity, quantity, and support-status validation; remove embedded clinical exception rules.
- Modify `backend/app/services/rag/citation_grounder.py`: render only validated answer claims and associate their cited evidence; preserve current source/link data.
- Modify `backend/app/services/chatbot/copilot_orchestrator.py`: apply the shared validation gate before marking a clinical response grounded; preserve clarification, operational, conversational, and safe-abstention paths.
- Modify `backend/app/services/chatbot/copilot_drug_lookup.py` and the authoritative lookup adapter identified by route tests: carry database record provenance into claims rather than treating formatted text as self-evidencing.
- Add tests under `backend/tests/test_evidence_grounded_answer_contract.py`, `backend/tests/test_rag_claim_support.py`, and focused route tests.
- Modify `docs/superpowers/specs/2026-11-11-copilot-route-inventory.md` only after implementation to record actual route coverage and known gaps.

## Task 1: Define a typed claim and evidence-support contract

**Files:**
- Modify: `backend/app/schemas/copilot.py`
- Create: `backend/tests/test_evidence_grounded_answer_contract.py`

**Interfaces:**
- `AnswerClaim`: `claim_id`, `text`, `claim_type` (`source_fact` or `evidence_inference`), `evidence_ids`, and `support_status`.
- `CopilotResponse`: additive `claims` and `evidence_claim_map` fields already exist; tighten their types without removing serialized compatibility.

- [x] Write failing schema tests for a source fact linked to evidence, an inference linked to two evidence records, and an unsupported claim that cannot be marked verified.
- [ ] Run `cd backend && ../.venv/bin/python -m pytest -q tests/test_evidence_grounded_answer_contract.py`; confirm the expected missing-schema/type failure.
- [ ] Add the typed models and validation invariants; no medical or domain values belong in these schemas.
- [ ] Re-run the focused tests and existing `test_structured_copilot_response_schema.py`.

## Task 2: Generate evidence-linked claims from the exact prompt evidence

**Files:**
- Modify: `backend/app/services/rag/rag_pipeline.py`
- Test: `backend/tests/test_clinical_rag.py`

**Interfaces:**
- Internal generation result: structured answer text plus `AnswerClaim[]`; every claim carries evidence IDs selected from the prompt's backend-created evidence records.

- [x] Add failing tests proving the prompt includes stable IDs for all evidence blocks actually supplied and excludes truncated/unselected evidence.
- [ ] Add failing tests for direct lookup versus inference generation instructions and empty/malformed structured output.
- [ ] Generate a structured response with claim-level support references; treat model-generated source labels or unknown IDs as invalid.
- [ ] Preserve usage accounting and avoid a second model call in this task. If the provider cannot return a valid structured payload, return no verified claims and use the existing safe fallback.
- [ ] Run RAG tests with mocked provider responses and confirm existing token accounting remains unchanged.

## Task 3: Validate claims generically against source evidence

**Files:**
- Modify: `backend/app/services/rag/self_rag_verifier.py`
- Modify: `backend/app/services/rag/types.py` if an internal verification result type is needed
- Test: `backend/tests/test_rag_claim_support.py`

**Interfaces:**
- `verify_answer_claims(claims, evidence_records) -> ClaimVerificationResult`; statuses: `supported`, `unsupported`, `contradicted`, `insufficient_evidence`.

- [x] Add failing tests for missing evidence IDs, wrong entity/source pairing, missing or altered quantities/units, contradictory evidence, and claims that are only lexically similar.
- [ ] Ensure partial support is not treated as supported and an answer with any unsupported clinical claim cannot receive a verified status.
- [ ] Remove domain-specific contradiction branches and word-overlap thresholds used as proof; rely on generic validation plus managed evidence references.
- [ ] Where semantic entailment cannot be decided reliably by deterministic validation, return `insufficient_evidence`; do not add an unconfigured external model dependency. A separately approved semantic critic can be considered later if this abstention rate proves unacceptable.
- [ ] Run verifier and existing Self-RAG tests; update assertions only where they encode the old unsafe “partial equals supported” behavior.

## Task 4: Render only validated factual and inferred claims

**Files:**
- Modify: `backend/app/services/rag/citation_grounder.py`
- Modify: `backend/app/services/rag/rag_pipeline.py`
- Test: `backend/tests/test_clinical_rag.py`, `backend/tests/test_chat_evidence_alignment.py`

- [x] Add failing tests that unsupported claims are omitted, a supported subset is clearly identified as incomplete, and no supported claim yields safe abstention.
- [ ] Add failing tests that inference claims receive “Chỉ mang tính tham khảo” while direct source facts do not.
- [ ] Build reply text from validated claims only; backend maps evidence IDs to citation records and never accepts citation metadata authored by the model.
- [ ] Ensure all claim-linked evidence is in the response evidence list, and no unrelated evidence is attached to a claim.
- [ ] Run focused RAG and evidence-alignment tests.

## Task 5: Apply the same evidence gate to authoritative database lookup routes

**Files:**
- Inspect and modify: `backend/app/services/chatbot/copilot_drug_lookup.py`, `backend/app/services/copilot_drug_lookup.py`, and the actual lookup formatter selected by route inventory
- Modify: `backend/app/services/chatbot/copilot_orchestrator.py` only at the common response boundary
- Test: `backend/tests/test_drug_profile_hierarchy.py`, `backend/tests/test_evidence_grounded_answer_contract.py`

- [x] Add failing tests that each rendered field (dose, indication, contraindication, adverse effect) traces to the database record field and source provenance used to produce it.
- [ ] Add failing tests that absent database fields remain absent or are reported unavailable, never filled with generic text or LLM knowledge.
- [ ] Normalize database field values into source-fact claims; preserve direct lookup as unlabeled and mark only separately inferred conclusions as reference-only.
- [ ] Ensure invalid/missing provenance cannot set `rag_grounded=True`; keep intentional conversational and operational paths outside the clinical evidence gate.
- [ ] Run focused drug lookup, API schema, route, and evidence contract tests.

## Task 6: Integrate one final validation gate across clinical routes

**Files:**
- Modify: `backend/app/services/chatbot/copilot_orchestrator.py`
- Modify as needed: `backend/app/services/chatbot/multi_intent_handler.py`, `backend/app/services/chatbot/pure_rag_handler.py`, `backend/app/services/chatbot/sandwich_pipeline.py`, `backend/app/services/rag/multihop_clinical_agent.py`
- Test: `backend/tests/test_copilot_workflow_deep_rag.py`, `backend/tests/test_chat_evidence_alignment.py`, route inventory tests

- [x] Add route tests for direct lookup, RAG inference, multi-intent, DDI, specialty, and multihop, proving each clinical factual answer passes the same contract or safely abstains.
- [ ] Apply validation after each selected executor returns but before standardization/serialization; avoid rerunning retrieval or adding a second critic call.
- [ ] Do not allow citation standardization, cached responses, CDSS alerts, or a non-empty answer string to upgrade an unsupported response to grounded.
- [ ] Preserve answer-operation labels, source links, role/auth checks, and current response API fields.
- [ ] Run focused route, guardrail, RAG, DDI, and API schema suites.

## Task 7: Logic completion review (benchmarks remain deferred)

**Files:**
- Modify: `docs/superpowers/specs/2026-11-11-copilot-route-inventory.md`
- Modify: this plan to record completed checks and unresolved limits

- [x] Enumerate clinical route families and show factual source, evidence linkage, validation point, and abstention behavior; exact route combinations remain unexhausted as noted in inventory.
- [ ] Search the mapped implementation files for claim support based only on citation presence, lexical overlap alone, fixed example claims, or domain-specific inline exception logic; resolve remaining cases in scope.
- [x] Run focused correctness tests for migrated routes and Python compile checks; `git diff --check` on scoped files reports only pre-existing trailing whitespace in unrelated adaptive files. No performance benchmark run.
- [x] Report known limits plainly: deterministic checks cannot prove arbitrary semantic entailment; unresolved semantic claims abstain until a separately selected semantic verifier is integrated.

