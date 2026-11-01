# Physician Copilot Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the chatbot consistently serve doctors as a sourced lookup and manual workflow assistant, not as a patient-facing counselor.

**Architecture:** Preserve the current FastAPI intent routes and React shell. Tighten backend response framing and operational draft behavior, convert fever/headache responses into clinician references, and align welcome/system prompt text and regression tests.

**Tech Stack:** FastAPI, SQLAlchemy async, pytest, React/TypeScript, tsx.

**Spec:** `docs/superpowers/specs/2026-11-01-physician-copilot-scope-design.md`

## Global Constraints

- Do not invent a patient, encounter, prescription, medication schedule, dose plan, contact, or case context.
- Do not change signed/dispensed workflows or bypass explicit UI confirmation.
- General drug facts remain sourced lookup; patient-specific decisions require explicit case context.
- Keep current APIs and deterministic operational intent behavior compatible unless a test proves patient-facing behavior unsafe or contradictory.

## Review Focus

- “I have a fever/headache” without a patient or case must clarify instead of treating the doctor as patient.
- Explicit patient/case wording routes to clinician-facing reference and uses patient/case language.
- Generic drug monograph lookup remains available without requiring patient identity.
- Advice/email prompts lacking a selected order and complete source details must not produce synthetic patient advice cards.
- Prompt injection and operational actions still preserve existing security and confirmation gates.

---

### Task 1: Clinician role, greeting, and ambiguous symptom boundary

**Files:** Modify `backend/app/routers/copilot.py`, `backend/app/services/copilot_intents_prescription.py`; test `backend/tests/test_backend_security_guardrails.py`.

- [ ] Add endpoint regression tests: wellbeing greeting does not ask about user's health; “tôi bị sốt” without case context returns clarification/reference request with no patient-facing advice; “bệnh nhân X sốt” remains clinician workflow.
- [ ] Run those tests and confirm the existing behavior fails the new assertions.
- [ ] Use clinician-targeted wording; pass explicit case scope into symptom handling or stop unscoped self-symptom prompts before scenario/RAG dispatch.
- [ ] Replace fabricated prescription-advice drafts with clarifications and a route to the existing prescription/advice UI; allow only facts from explicitly supplied/selected data.
- [ ] Run focused backend tests and full `backend/tests`.

### Task 2: Clinician-facing clinical scenario output

**Files:** Modify `backend/app/services/scenarios/case_fever_triage.py`, `case_headache_pain.py`, `case_medication_deictic_followup.py`, `copilot_gemini.py`; tests `backend/tests/test_clinical_rag.py`, `backend/tests/test_backend_security_guardrails.py`.

- [ ] Add assertions for professional phrasing in fever, headache, and deictic medication follow-ups; assert patient symptom prompts are absent.
- [ ] Run focused tests and confirm they fail on current self-care phrasing.
- [ ] Rewrite responses as concise clinician reference/checklist language, clearly separate general evidence from patient-specific assessment, and replace first-person patient chips with clinician prompts.
- [ ] Add system prompt rules that the operator is a clinician and the patient is a separate case subject; require clarification for unidentified patient-specific decisions.
- [ ] Run scenario, RAG, and backend test suites.

### Task 3: UI welcome, examples, and final regression verification

**Files:** Modify `src/data/initialData.ts`, relevant assistant prompt/config and `src/components/Modals/UserGuideModal.tsx`; tests `scripts/test_chatbot_suite.ts` and focused UI/copy tests.

- [ ] Add tests for initial chatbot greeting and welcome/help copy audience.
- [ ] Run focused tests and observe expected failures.
- [ ] Update examples and quick prompts to “bệnh nhân/ca bệnh/đơn đang chọn”; remove self-symptom and patient-chat examples, retain doctor initiated patient notification actions behind existing forms.
- [ ] Run `npm test`, `npm run lint`, `npm run build`, and all `backend/tests`.
- [ ] Review changed prompts for direct patient address, synthetic records, clinical scope, and unchanged explicit operational confirmation.
