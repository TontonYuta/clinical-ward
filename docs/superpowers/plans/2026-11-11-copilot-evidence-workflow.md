# Copilot Evidence Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Unify clinical Copilot request routing, evidence provenance, validation, and tracing while retaining specialized executors; run benchmarks only after all workflow logic is improved.

**Architecture:** Introduce one typed request context and route decision, preserve task-specific executors behind a shared interface, then converge their evidence/result contract and response validation. Move domain policy and tuning data into validated managed configuration/data. Migrate incrementally with compatibility tests.

**Tech Stack:** Python, FastAPI, Pydantic, existing SQLite/data packages, pytest.

**Spec:** `docs/superpowers/specs/2026-11-11-copilot-evidence-workflow-design.md`

## Global Constraints

- No hardcoded domain data, clinical rules, routing phrase lists, sample facts, or operational tunables in application logic.
- Preserve guardrails, authorization, patient context boundaries, specialized services, and existing API contracts.
- Missing/invalid clinical policy or evidence configuration fails closed; do not silently substitute embedded clinical defaults.
- Do not run the benchmark until every logic task below is complete. Focused correctness tests are required per task.
- Do not mutate the two pre-existing untracked report files.

## Review Focus

- Ambiguous/failed NLU must not fall through to an unsupported clinical answer: test clarify/abstain behavior.
- Explicit medication names must take precedence over session context: test follow-up decontextualization.
- Missing evidence, missing sources, and invalid managed config must not receive a verified status: test fail-closed behavior.
- Multi-intent, image, DDI, operational and multihop routes must preserve their behavior and authorization: test each route boundary.
- Retry/fallback must not repeat retrieval or use evidence from a different rewritten query: test evidence/query identity and reuse.

## File map

- Modify `backend/app/services/chatbot/copilot_orchestrator.py`: replace scattered decision stages with one request preparation/routing handoff; retain specialized executor calls.
- Create `backend/app/services/chatbot/workflow_models.py`: typed request context, route decision, evidence, executor result and trace metadata.
- Create `backend/app/services/chatbot/workflow_router.py`: consume one NLU decision plus validated managed routing policy and select executor.
- Create `backend/app/services/chatbot/clinical_workflow.py`: execute selected clinical executor, normalize result and invoke common clinical evidence validation.
- Modify `backend/app/services/rag/rag_pipeline.py`: accept prepared request/reused retrieval result, return structured evidence status and provenance; remove hidden duplicate work.
- Modify `backend/app/services/chatbot/pure_rag_handler.py`: remove top-1 preflight retrieval and map common result without duplicate checks.
- Modify specialized result adapters in `conversational_clinical_engine.py`, `sandwich_pipeline.py`, `multihop_clinical_agent.py`, and `hospital_business_dispatcher.py` as inventory confirms; avoid moving business algorithms.
- Modify `backend/app/schemas/copilot.py` only additively if API response needs trace/evidence status fields.
- Create a validated managed policy/data package under `backend/data/knowledge_base/workflow/` (schema and policy files); exact format selected after inspecting repo data conventions.
- Modify `backend/app/config.py` only to configure managed policy location/version, without embedding clinical defaults.
- Add focused tests in `backend/tests/test_copilot_workflow_*.py`; modify existing route/RAG tests as needed.
- Do not change retrieval benchmark data/thresholds during logic refactor; benchmark is a later phase.

## Task 1: Complete workflow inventory and route contract tests

**Files:**
- Create: `docs/superpowers/specs/2026-11-11-copilot-route-inventory.md`
- Create: `backend/tests/test_copilot_workflow_route_inventory.py`
- Inspect: `backend/app/services/chatbot/copilot_orchestrator.py`, `backend/app/services/chatbot/hospital_business_dispatcher.py`, `backend/app/services/chatbot/pure_rag_handler.py`, `backend/app/services/chatbot/conversational_clinical_engine.py`, `backend/app/services/chatbot/sandwich_pipeline.py`, `backend/app/services/rag/multihop_clinical_agent.py`

- [x] Enumerate each terminal route, its triggering decision source, evidence source, validator, and response type in the inventory. (Ordered branch table plus all live NLU intents and fallthrough rules recorded.)
- [x] Add route contract tests for representative intents and assert selected executor/result classification without invoking paid external generation. (Security/image, conversation, multi-intent, DDI, counseling, specialty, patient-dose, fallback and evidence gates covered.)
- [x] Run focused tests; expected baseline captures current route behavior and exposes conflicting/double classification where present. (105 passed; compound-facet fallback split corrected and API contract aligned with composite fail-closed behavior.)
- [x] Record unresolved route policy and any behavior with no authoritative evidence source. (Ordered branch map and unresolved source-linkage gaps recorded.)

## Task 2: Add typed workflow and evidence contracts

**Files:**
- Create: `backend/app/services/chatbot/workflow_models.py`
- Test: `backend/tests/test_copilot_workflow_models.py`

**Interfaces:**
- `ClinicalRequestContext`: original query, normalized query, optional rewritten query, history/context reference, user role and patient-context reference.
- `RouteDecision`: intent, executor key, reason code, required entities and evidence requirement.
- `EvidenceRecord`: stable source/chunk identifier, source/version, section, excerpt/reference and retrieval metadata.
- `ExecutorResult`: response payload, evidence records, evidence status, warnings, validation status, abstention/clarification reason, trace metadata.

- [x] Test schema validation: clinical factual result without evidence cannot be marked verified; operational and conversational outcomes can represent evidence-not-applicable.
- [x] Test original and rewritten queries remain distinct and evidence records retain source identifiers.
- [x] Implement only schema invariants, no domain values or phrase lists.
- [x] Run focused tests and relevant import/compile checks. (7 tests pass.)

## Task 3: Load and validate managed routing policy

**Files:**
- Create: `backend/data/knowledge_base/workflow/routing_policy.json` (or repository-established format selected in Task 1)
- Create: `backend/app/services/chatbot/workflow_policy.py`
- Test: `backend/tests/test_copilot_workflow_policy.py`
- Modify: `backend/app/config.py`

- [x] Store intent-to-executor mappings, evidence requirements, and tunable budgets externally with schema version and provenance. (All 12 live NLU intents are covered and startup enforces coverage; routing remains stateful and ordered.)
- [x] Test unknown intent, duplicate mapping, missing executor, invalid budget, absent file, and unsupported schema version; clinical configuration must fail closed with actionable diagnostics.
- [x] Implement validated loading and explicit policy path configuration; do not include fallback clinical policy literals in Python.
- [x] Run policy tests and confirm startup loads the policy and fails closed on invalid/missing required configuration.

## Task 4: Resolve query context and route exactly once

**Files:**
- Create: `backend/app/services/chatbot/workflow_router.py`
- Modify: `backend/app/services/chatbot/copilot_orchestrator.py`
- Test: `backend/tests/test_copilot_workflow_routing.py`

**Interfaces:** `prepare_request(...) -> ClinicalRequestContext`; `decide_route(context, nlu_result, policy) -> RouteDecision`.

- [x] Test explicit current-turn entity wins over session entity; deictic follow-up uses session context only when reference resolution is unambiguous. (Request preparation tests explicit vs. deictic; orchestrator test verifies explicit current-turn entity updates active medication.)
- [x] Test NLU multi-intent is decomposed once, ambiguous intent requests clarification, and NLU outage uses only managed deterministic fallback policy. (Tests cover all three; the deterministic precedence and fallback decisions are loaded from validated managed policy.)
- [x] Integrate one normalization/context stage and one route decision in orchestrator; preserve authentication, guardrails, image route, multi-intent and operational authorization. (Managed NLU decision now owns configured precedence and dispatch for ambiguity, prescription blocks and multi-intent; later stateful specialized routes remain ordered pending executor parity/adaptation.)
- [x] Remove repeated independent classification for early NLU routes: orchestrator consumes one validated `RouteDecision` for ambiguous, prescription-block, and multi-intent dispatch; downstream stateful detectors remain ordered pending executor parity/adaptation in Tasks 5–8.
- [x] Run route tests and existing focused router tests. (`.venv/bin/python -m pytest -q backend/tests/test_copilot_workflow_routing.py backend/tests/test_copilot_workflow_policy.py backend/tests/test_copilot_workflow_route_inventory.py backend/tests/test_gemini_nlu_router.py backend/tests/test_sandwich_pipeline.py backend/tests/test_self_rag_verification.py` → 65 passed; `compileall` and `git diff --check` passed.)

## Task 5: Adapt specialized executors to the common result contract

**Files:**
- Create: `backend/app/services/chatbot/clinical_workflow.py`
- Modify as required: `backend/app/services/rag/rag_pipeline.py`, `pure_rag_handler.py`, `conversational_clinical_engine.py`, `sandwich_pipeline.py`, `multihop_clinical_agent.py`, `hospital_business_dispatcher.py`
- Test: `backend/tests/test_copilot_workflow_executors.py`

- [ ] Test each clinical executor returns structured evidence/status and each non-clinical executor declares evidence not applicable.
- [ ] Test RAG retrieval preflight evidence is reused by the full execution and is not fetched twice.
- [ ] Pass original and rewritten query identity into retrieval metadata; do not attach evidence to a query it did not retrieve for.
- [ ] Normalize executor results at adapter boundary while preserving existing executor algorithms and response schema.
- [ ] Run focused executor tests and relevant existing RAG/DDI/medication lookup tests.

## Task 6: Centralize evidence validation and response adaptation

**Files:**
- Modify: `backend/app/services/chatbot/clinical_workflow.py`, `backend/app/services/chatbot/copilot_orchestrator.py`, `backend/app/services/chatbot/citation_standardizer.py`, `backend/app/schemas/copilot.py` if needed
- Test: `backend/tests/test_copilot_workflow_evidence.py`

- [ ] Test missing/empty/stale evidence, unsupported factual response, validator failure and explicit safety contradiction produce accurate statuses and abstention behavior.
- [ ] Test citation presence alone never implies validation pass; every evidence record resolves to a source.
- [ ] Apply authorization/output guardrails once at shared boundary and evidence validation only to clinical factual routes.
- [ ] Map common result to API response once, add compatible evidence and trace metadata, and retain legacy fields during migration.
- [ ] Run focused tests and existing citations/guardrail tests.

## Task 7: Move inline domain policies and tunables to managed data

**Files:**
- Modify inline policy owners identified in Task 1: `adaptive_retriever.py`, `hybrid_retriever.py`, `knowledge_graph.py`, `self_rag_verifier.py`, `copilot_orchestrator.py`, `pure_rag_handler.py`, and any additional inventoried files
- Create/update data files under `backend/data/knowledge_base/workflow/` or domain-specific managed packages with source/version metadata
- Test: `backend/tests/test_copilot_managed_policy_migration.py`

- [ ] Test policy/data is externally loaded, schema validated and provenance/version retained; missing/invalid clinical rule data fails closed.
- [ ] Move phrase sets, clinical exception rules, graph values, recommendation strings and tunable thresholds/budgets out of application branches without changing their reviewed meaning.
- [ ] Replace inline safe clinical recommendations with data-driven records; no fabricated generic medication/dose fallback.
- [ ] Add a static audit test that rejects domain policy literals in the migrated modules while allowing generic control logic.
- [ ] Run focused policy, graph, verifier and routing tests.

## Task 8: Remove duplicate work and finalize shared workflow

**Files:**
- Modify: `backend/app/services/chatbot/pure_rag_handler.py`, `backend/app/services/rag/rag_pipeline.py`, `backend/app/services/chatbot/copilot_orchestrator.py`
- Test: `backend/tests/test_copilot_workflow_integration.py`

- [ ] Test one retrieval invocation per selected retrieval executor, consistent evidence metadata across cache miss and cache hit, and explicit cached-result provenance.
- [ ] Remove redundant top-1 preflight retrieval and repeated citation/guardrail transformations where shared boundary owns them.
- [ ] Ensure SSE response adapter consumes the common completed result while accurately representing that generation is non-streaming; do not claim lower TTFT.
- [ ] Run workflow integration correctness tests plus existing focused endpoint tests.

## Task 9: Pre-benchmark logic completion gate

**Files:**
- Modify: `docs/superpowers/specs/2026-11-11-copilot-route-inventory.md`
- Modify: `docs/superpowers/plans/2026-11-11-copilot-evidence-workflow.md`

- [ ] Confirm every Copilot terminal route maps to an executor and shared result contract.
- [ ] Confirm each clinical executor has source provenance and accurate validation/abstention behavior.
- [ ] Confirm no migrated module embeds managed clinical policy or tunable defaults.
- [ ] Run correctness test suites for routing, RAG, guardrails, DDI, medication lookup and API compatibility. Do not run retrieval/chatbot benchmark in this task.
- [ ] Record benchmark as a subsequent phase, with expert review of evaluation labels required before interpreting clinical quality.

## Task 10: Deferred benchmark phase (not part of this execution)

After Task 9 is complete and evaluation labels have been reviewed, run the existing retrieval benchmark and an end-to-end route/evidence benchmark, report per-intent metrics and failures, and compare against a recorded pre-change run if available. Do not begin this task until the human explicitly starts the post-improvement benchmark phase.
