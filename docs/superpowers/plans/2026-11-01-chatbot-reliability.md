# Chatbot Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Improve chatbot identity isolation, deterministic routing, scoped scenario data access, DDI status semantics, and Gemini resilience.

**Architecture:** Keep the current FastAPI/React stack and no new mandatory service. Derive identity from authenticated middleware when enabled, namespace in-memory sessions per identity and caller session, then harden existing orchestration/data and Gemini paths with deterministic tests.

**Tech Stack:** FastAPI, SQLAlchemy async, pytest, React/TypeScript, tsx.

**Spec:** `docs/superpowers/specs/2026-10-31-chatbot-grounded-design.md` and `docs/superpowers/specs/2026-11-01-chatbot-focused-medication-safety-design.md`.

**Approach considered:** external Redis-backed sessions, full frontend/backend router replacement, or incremental hardening of existing in-memory/API flows. Chosen: incremental hardening because this repo has no Redis contract and existing deterministic handlers already encode clinical precedence. In-memory session state remains process-local and requires a shared store before multi-worker production use.

## Global Constraints
- Preserve existing API response compatibility.
- Do not state that missing DDI coverage means safe.
- Do not introduce a mandatory external service or dependency.
- Keep deterministic operational action handling and output guardrails.
- Avoid storing raw user content in telemetry or logs.

## Review Focus
- Payload user role/name spoofing with AUTH_REQUIRED enabled is overridden by authenticated identity.
- Same caller session ID from two users cannot share medication/patient context.
- DDI no-match, insufficient data, and source failure remain distinct.
- Scenario dispatch does not read unrelated database tables for drug-only intents.
- Gemini cache is bounded, versioned, and excludes cross-user context; fallback respects one total deadline.

---

### Task 1: Authenticated identity and session isolation
**Files:** Modify `backend/app/routers/copilot.py`, `backend/app/services/session_context.py`; Test `backend/tests/test_backend_security_guardrails.py` and a focused session test.
- [x] Regression tests for payload identity overrides and same-session cross-user isolation.
- [x] Ran the regression tests RED (missing identity resolver), then GREEN after identity/session changes.
- [x] Chat endpoint takes authenticated request identity and namespaces both authenticated and demo sessions by owner.
- [ ] Test role/name spoofing with authenticated `request.state.authenticated_user` and two-user same-session isolation.
- [ ] Run tests RED.
- [ ] Add identity extraction and per-owner session keys. Keep unauthenticated demo mode backward compatible but namespace by username and requested session ID.
- [ ] Verify focused tests GREEN.

### Task 2: Intent classification contract and greetings
**Files:** Modify `backend/app/routers/copilot.py`; add a small classifier module and focused backend tests.
- [x] Added and verified Vietnamese wellbeing greeting handling; test showed old route chose clinical RAG, now returns conversational greeting.
- [x] Kept existing intent precedence; classifier extraction deferred to avoid broad behavior changes.
- [ ] Add tests for greeting plus wellbeing prompts, ambiguous drug questions, single-field drug query, two-drug DDI, operational action precedence.
- [ ] Run tests RED.
- [ ] Extract deterministic classifier decisions from inline conditionals without changing existing handler semantics; route conversational greetings before medical retrieval and ask concise clarifying questions for ambiguous medication entities.
- [ ] Verify focused tests GREEN.

### Task 3: DDI status semantics end-to-end
**Files:** Existing backend DDI service/router and frontend DDI routing; tests in `backend/tests` and `tests/test_ddi_api_routing.ts`.
- [x] Added failing insufficient-input contract test; updated no-match status to `none_found_in_checked_source` and preserved explicit coverage caveat.
- [x] Backend DDI algorithm/API suite and frontend DDI routing script pass.
- [ ] Add tests for indexed match, indexed no-match, insufficient medication identity, backend unavailable.
- [ ] Run tests RED.
- [ ] Standardize statuses `found`, `none_found_in_checked_source`, `insufficient_data`, `source_unavailable`; retain severity/mechanism/action/source and keep non-match caveat explicit.
- [ ] Verify focused tests GREEN.

### Task 4: Intent-scoped scenario reads
**Files:** Modify `backend/app/services/scenarios/registry.py`; add dispatcher tests.
- [x] Added dispatch regression proving a greeting does not query clinical tables.
- [x] Reads now load patient, prescription, and inventory context only for related queries; narrow follow-up to prescriptions only when asked.
- [ ] Test drug-only dispatch does not query patient, prescription or batch tables unrelated to intent; test patient/inventory scenarios still receive their needed context.
- [ ] Run tests RED.
- [ ] Determine candidate scenario(s) before loading domain data; fetch only entities required by matched scenario, preserving explicit and deictic context behavior.
- [ ] Verify focused tests GREEN.

### Task 5: Gemini cache and deadline
**Files:** Modify `backend/app/services/copilot_gemini.py`; add unit tests.
- [x] Cache key is a SHA256 digest over cache version, system prompt, and request context; test confirms context changes produce distinct opaque keys.
- [x] Gemini model fallback has bounded per-attempt timeouts under a shared 12 second deadline.
- [ ] Test cache key includes prompt/system/model version; no cache reuse for context variants; bounded TTL and size; model fallback shares a single deadline.
- [ ] Run tests RED.
- [ ] Version cache keys, avoid raw prompt keys, cap total fallback time, avoid caching unsafe/empty replies.
- [ ] Verify focused tests GREEN.

### Task 6: Full verification and review
- [x] Frontend `npm test`, `npm run lint`, `npm run build` pass; backend full suite: 103 passed, 2 failed.
- [x] Failures are legacy CPOE assertions at `test_cpoe_chat_does_not_invent_a_prescription_for_incomplete_prompt` and `test_cpoe_chat_draft_does_not_claim_ddi_was_cleared`; they expect content removed by the prior TT26 draft flow.
- [x] Focused chatbot/DDI/session tests: 22 passed; API suite: 9 passed; frontend DDI routing passed; `git diff --check` clean.
- [x] Review confirmed owner-bound sessions, no definitive DDI negative claim, unchanged deterministic actions, and capped Gemini fallback. In-memory session state remains process-local; shared persistence is a production deployment requirement when running multiple workers.
- [x] No live external deployment smoke check or push performed in this task.
