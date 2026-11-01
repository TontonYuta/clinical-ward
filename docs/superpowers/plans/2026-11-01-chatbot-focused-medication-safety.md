# Chatbot Focused Medication Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make medication lookup responses concise and field-specific, add contextual follow-up suggestions, and make DDI chat routing cautious and consistent.

**Architecture:** Preserve existing FastAPI/SQLAlchemy and React/TypeScript paths. Determine a requested drug field in the backend lookup/formatter, retain provenance, and use existing message suggestion chips for next questions. Keep backend DDI API authoritative; remove definitive no-match conclusions from client-only fallback paths.

**Tech Stack:** FastAPI, SQLAlchemy async, pytest, React, TypeScript, tsx.

**Spec:** `docs/superpowers/specs/2026-11-01-chatbot-focused-medication-safety-design.md`

## Global Constraints
- No CPOE save/sign/API workflow changes.
- Never present absence from the indexed interaction catalog as proof a drug pair is safe.
- Preserve input/output guardrails, provenance, session context and operational action behavior.
- No new service or dependency.

## Review Focus
- A targeted field query must not leak unrelated profile or inventory sections; backend copilot regression test.
- Ambiguous/unavailable field data must not be invented; backend test checks a clear unavailable-field response.
- Client DDI fallback must not call an unindexed pair safe; frontend routing test.
- Suggestions must be contextual, explicit and still use the normal query route; frontend type/UI tests or deterministic chip contract tests.
- DDI backend outage must remain distinct from an indexed non-match and must not silently become a local definitive answer; frontend routing test.

---

### Task 1: Backend field-specific medication answers

**Files:**
- Modify: `backend/app/services/copilot_drug_formatter.py`
- Modify: `backend/app/services/copilot_drug_lookup.py`
- Test: `backend/tests/test_backend_security_guardrails.py`

- [ ] Add failing integration assertions for queries asking only for ingredient, adverse effects, and interactions; assert requested value is present while unrelated dosage, inventory, stock and replenishment text are absent.
- [ ] Add a failing assertion for a missing requested field that asks the user to consult an available authoritative source or clarify, with no fabricated content.
- [ ] Run focused backend tests and confirm failures match current broad-profile behavior.
- [ ] Implement a deterministic Vietnamese field selector with precedence for interaction, adverse effects, contraindication, dosage, indication, ingredient, stock, and general query. Use the matched registry/monograph only; don't invoke inventory lookup for non-stock fields.
- [ ] For stock-only queries, return inventory quantity and location without unrelated clinical profile text. For general queries, return a short identity/ingredient/form summary.
- [ ] Include source citation and exact-match metadata on clinical answers, preserving session active medication.
- [ ] Run focused tests and confirm pass.

### Task 2: Contextual follow-up suggestions

**Files:**
- Modify: `backend/app/services/copilot_drug_formatter.py`
- Modify: `backend/app/routers/copilot.py` only if suggestions need normalization
- Modify: `src/components/LeftPane/ChatWindow.tsx`
- Modify: `src/data/initialData.ts`
- Test: `backend/tests/test_backend_security_guardrails.py` and an existing or new deterministic frontend chat suggestion test

- [ ] Add failing assertions that targeted medication and DDI results provide follow-ups using the resolved medication name, such as adverse effects, interactions and contraindications.
- [ ] Add failing UI assertion that suggestion chips are labeled as follow-up suggestions and selecting one passes its text into `onSendMessage`.
- [ ] Run focused checks and confirm expected failures.
- [ ] Replace generic inventory workflow chips on medication information answers with up to three relevant clinical follow-ups; avoid a suggested prompt that claims to prescribe.
- [ ] Label the chips section “Gợi ý hỏi tiếp” in chat messages and provide starter clinical query chips in the welcome message.
- [ ] Run focused tests/type checks.

### Task 3: Consistent safe DDI chat routing

**Files:**
- Modify: `src/utils/nlp/agentAsync.ts`
- Modify: `src/utils/nlp/intents/drugInteractionIntent.ts`
- Test: `tests/test_ddi_api_routing.ts` and relevant existing chatbot routing tests

- [ ] Add failing tests for backend no-match coverage wording and service outage, asserting the fallback never says “không có tương tác” or “an toàn”.
- [ ] Add a failing test confirming existing indexed backend alerts retain severity, mechanism, action, source, and visible critical alert.
- [ ] Run focused DDI routing test and confirm failures.
- [ ] Keep backend result path authoritative. Replace local curated non-match conclusions with an explicit “chưa thể kết luận qua danh mục hiện có” response; on backend outage state the check could not be completed and request retry/professional review. Never produce a positive clinical match from client-only rules.
- [ ] Ensure no local fallback bypasses that policy when pair extraction fails. Keep the prompt for two named medicines.
- [x] Run DDI routing tests (`npx tsx tests/test_ddi_api_routing.ts`).

### Task 4: Full verification and security/stability review

**Files:** all changed files above; no additional scope

- [ ] Run focused Python tests for drug lookup, security guardrails, and DDI. Python verification is currently blocked by missing `fastapi` and `pytest-asyncio` in the active environment.
- [x] Run focused TypeScript DDI routing suite (`npx tsx tests/test_ddi_api_routing.ts`).
- [x] Run repository `npm test`, `npm run lint`, and `npm run build`; backend pytest attempted but blocked by missing Python dependencies/plugins.
- [x] Review changed chatbot paths and run `git diff --check`; no uncommitted diff was present.
- [x] Report command results and environmental failures. No deployment, commit, or push performed.
