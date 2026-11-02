# Chatbot Evidence and Bounded Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make citations inspectable and preserve useful multi-turn context under a strict session-scoped context budget.

**Architecture:** Add bounded turn memory to existing owner-scoped server sessions and pass its compact rendering only into follow-up/RAG context. Expand citation excerpts in the existing UI and keep source PDFs clickable. Extend backend contract and behavior tests.

**Tech Stack:** Python/FastAPI, existing in-memory session state and RAG pipeline; React/TypeScript chat presentation; pytest and Playwright.

**Spec:** docs/superpowers/specs/2026-11-02-chatbot-evidence-and-bounded-context-design.md

## Global Constraints
- Context window: at most 8 completed turns and 12,000 characters.
- Each individual user or assistant history text: at most 2,000 characters.
- Session isolation uses existing normalized owner namespace and 30-minute TTL.
- History is context only, never a clinical evidence source.
- Explicit current-turn medication entities take precedence over session context.
- Clinical evidence excerpts are bounded to 240 characters and only shown from returned citations.

## Review Focus
- Follow-up without active medicine must clarify: test missing-entity follow-up.
- Explicit new medicine overrides old context: test entity switch.
- Session IDs shared across users remain isolated: test owner namespace.
- Long history drops oldest turns and stays within cap: test bounded rendering.
- Citation with missing excerpt/page does not invent text/page: test metadata fallback.

---

### Task 1: Bounded conversation memory
**Files:** modify backend/app/services/session_context.py; test backend/tests/test_copilot_session_isolation.py.
**Interfaces:** Add ConversationTurn(user_text, assistant_text), SessionState.append_conversation_turn(...), and SessionState.render_recent_history(max_turns=8, max_chars=12000) -> str.
- [ ] Test truncation, oldest-first eviction, order, owner isolation.
- [ ] Run focused pytest and confirm expected failures.
- [ ] Implement bounded storage/rendering and run tests.

### Task 2: Safe follow-up resolution and history recording
**Files:** modify backend/app/routers/copilot.py, backend/app/services/rag/rag_pipeline.py; test backend/tests/test_backend_security_guardrails.py and backend/tests/test_clinical_rag.py.
**Interfaces:** Extend execute_clinical_rag(..., conversation_context: str = ""); label history separately from evidence. Resolve medication follow-ups only when an active medicine exists and current query names no other medicine. Append one completed user/assistant turn; omit attachments.
- [ ] Test Paracetamol lookup followed by “còn chống chỉ định?”, explicit switch to Metformin, missing-context clarification, and session isolation.
- [ ] Verify expected failures, implement, and run focused API tests; DDI routes remain deterministic.

### Task 3: Evidence excerpts on citations
**Files:** modify backend/app/services/rag/citation_grounder.py, backend/app/services/copilot_drug_formatter.py, src/components/LeftPane/ChatWindow.tsx; test backend RAG/security suites and tests/chat_answer_presentation.test.ts.
**Interfaces:** Citation excerpts are trimmed to 240 characters. UI shows expandable evidence and metadata; PDF link remains available when URL exists.
- [ ] Test excerpt presence/length and missing-excerpt fallback.
- [ ] Implement disclosure and run focused tests/build.

### Task 4: Evaluation coverage and release verification
**Files:** modify backend/data/knowledge_base/evaluation/chatbot_cases.json and backend/tests/test_chatbot_evaluation.py.
- [ ] Add multi-turn medication, DDI clarification, source excerpt, explicit entity override cases.
- [ ] Run chatbot evaluation, RAG and guardrail suites with canonical local DB.
- [ ] Run npm run lint, npm run build, presentation tests, git diff --check.
- [ ] Playwright-check citation expansion/PDF link and multi-turn follow-up at desktop viewport.
