# Chatbot workflow and code-structure inventory

**Date:** 2026-11-13  
**Method:** Static source inspection and comparison with existing route and workflow inventories. No application code was changed and no performance benchmark was run. This is a bounded inventory of active chatbot paths and high-priority hardcode groups, not a claim that every domain literal in the repository has been exhaustively reviewed.

## Executive findings

- The repository already has workflow foundations (`workflow_models.py`, `workflow_policy.py`, `workflow_router.py`) and an existing ordered route inventory. It does not yet have a single executor-dispatch lifecycle: the orchestrator still owns many direct branches and later legacy fallthrough checks.
- `POST /copilot/chat` and `POST /copilot/chat/stream` independently implement cache eligibility, cache operations, conversation updates and usage/logging. The SSE endpoint emits the completed response as one `token` event; generation itself is not streamed.
- The frontend fallback in `src/utils/nlp/agentAsync.ts` invokes the local phrase-based query processor after SSE errors or unusable responses. That path is a separate response workflow and must be considered in any production evidence/hardcode audit.
- Several files are large by line count, but size alone is not the root issue. Responsibility overlaps across router, orchestrator, NLU, legacy route helpers, retrieval and formatter. The evidence of coupling is duplicate lifecycle logic and multiple independently authored routing/response branches.
- Repository package scripts expose frontend build/typecheck and a mixed frontend test suite. `backend/requirements.txt` includes pytest; the checked-in release workflow builds the Tauri desktop artifact and does not run backend tests or build/deploy the FastAPI service.
- No benchmark was run.

## Active request entrypoints and boundaries

| Entry | Path | Behavior and boundary |
|---|---|---|
| Main web chat | `src/App.tsx` → `src/utils/nlp/agentAsync.ts` → `chatCopilotApiStream` → `backend/app/routers/copilot.py:207` | Browser uses SSE API; response mapping includes evidence and citations. If request fails or no usable reply is returned, frontend invokes the local query processor. |
| Backend JSON chat | `POST /copilot/chat` (`backend/app/routers/copilot.py:42`) | Resets usage trace, resolves identity/session, applies phrase-based cache eligibility, validates cache, invokes `handle_copilot_chat`, stores conversation/cache/log and copies LLM usage into response. |
| Backend SSE chat | `POST /copilot/chat/stream` (`backend/app/routers/copilot.py:207`) | Duplicates cache/session/usage/log behavior. Computes full response before emitting one full-text `token` event and `done`; emits generic error event if response handling throws. |
| Direct RAG | `POST /copilot/rag` (`backend/app/routers/copilot.py:374`) | Applies input/output guardrails then calls `execute_clinical_rag`; separate from chat orchestrator and Copilot response contract. |
| Entity autocomplete | `GET /copilot/entities/search` | Uses lexical matcher/fuzzy lookup; it is a suggestion endpoint, not factual answer generation. |
| Supporting endpoints | chat history, cache stats | History returns stored logs; cache stats returns cache metrics. Authorization/data access should be audited in security task. |

## Backend data flow

1. Chat endpoint obtains `CopilotQuery`, user identity, role, session and image payload. JSON/SSE each perform their own cache/context checks. Cache eligibility uses inline language/clinical phrase lists and active-medication state.
2. On cache miss, `handle_copilot_chat` invokes `_handle_copilot_chat_core`, then applies shared response evidence validation and citation standardization on the outer path.
3. Core applies input guardrail. Image requests dispatch to multimodal provider before text NLU. Text requests sanitize then call `parse_clinical_nlu`.
4. Core loads `WorkflowPolicy`, prepares context and calls `decide_route`; managed policy currently handles configured intent routes and precedence signals.
5. The executor selection is not yet a single registry dispatch. The core continues through direct early returns and ordered route logic: medication lookup, multi-intent, DDI, counseling, specialty, multihop, patient reasoning, session/field routes, operations, direct RAG and fallback. Some checks use original query, others rewritten query and session state.
6. Specialized paths may call extra classifier/rewrite/synthesis modules. Their evidence comes from different sources: document retrieval, monograph/DAV records, graph data, curated registries, operational DB or authored response text. The outer evidence contract is an important safety boundary, but evidence shape/provenance is not uniform before that boundary.

### Notable control-flow and coupling facts

- `copilot_orchestrator.py` is about 914 lines and includes request normalization, identity, guidance text, many direct route branches, evidence validation and a wrapper.
- `gemini_nlu_router.py` is about 621 lines; it contains a long system prompt, cache, deterministic fast path and heuristic fallback as well as the provider call.
- `copilot_drug_formatter.py` is about 633 lines and combines field selection, monograph resolution, clinical special cases, response composition, citations and inventory data.
- `src/App.tsx` is about 2,206 lines, spanning application composition and several interaction flows.
- These counts indicate review/refactor risk; they do not alone establish that file length caused prior regressions. The concrete concerns are mixed responsibilities, ordered fallthrough and duplicate lifecycle implementation.

## Retrieval and evidence path

`execute_clinical_rag` (`backend/app/services/rag/rag_pipeline.py`) currently performs: query complexity classification → curated graph expansion → `HybridRetriever.retrieve_async` → context assembly using a character budget → Gemini generation when a usable key exists → citation formatting → rule-based Self-RAG audit → optional graph-derived alert. Evidence records are built for selected graph/document blocks.

Observed limitations to carry into later implementation tasks:

- `classify_query_complexity` in `rag/adaptive_retriever.py` uses domain phrase groups to determine retrieval budget.
- Context sizing is character-count based, not a provider tokenizer count.
- The citation grounder and Self-RAG checks use lexical/structural signals; these are not general semantic entailment proof.
- Graph content is curated and represented in Python data; version/provenance must be managed consistently before claims can rely on it.
- Existing route inventory reports duplicate retrieval in deep-RAG preflight and full pipeline; this remains a targeted integration item.
- Drug-profile/field responses use DB monographs and registry data; the formatter also contains inline branch-specific text. A database citation alone does not prove every emitted claim unless field provenance is linked.
- Admin PDF ingestion exists at `backend/app/services/rag/pdf_ingestion_service.py`, but current implementation writes files/manifest and updates FTS directly. It lacks a transactional staged publish/review/rollback boundary; hardcoded `STOPWORDS` are used for keyword extraction.

## Model, embedding, cache and telemetry boundaries

| Layer | Main source | Observed responsibility / risk |
|---|---|---|
| NLU | `backend/app/services/chatbot/gemini_nlu_router.py` | Structured Gemini extraction, cache, fast path and fallback heuristics; other schema/agent routers can be separate call paths. |
| Rewrite | `backend/app/services/rag/query_rewriter.py` | Separate rewrite/decontextualization call; potential call duplication with NLU/session resolution. |
| Generation | `backend/app/services/rag/rag_pipeline.py`, `sandwich_pipeline.py`, `paperqa_synthesizer.py`, `copilot_gemini.py` | Multiple specialized generation paths with separate prompts and output limits. Actual route call count needs request-trace tests. |
| Embedding | `backend/app/services/rag/embeddings/provider.py` | Provider abstraction, Gemini/mock providers, query and batch embedding; semantic cache can incur embedding before answering. |
| Model cache/trace | `backend/app/services/llm_provider.py` | Prompt response cache and `ContextVar` execution trace now exist. Endpoint telemetry still needs verification across all direct provider wrappers and cache layers. |
| Clinical response cache | `backend/app/services/cache/clinical_cache.py`, `routers/copilot.py` | JSON/SSE duplicate cache eligibility and response lifecycle; clinical eligibility uses phrase lists. |
| Persistence/monitor | `CopilotChatLog`, `telemetry_store.py`, `admin_monitoring_service.py` | Response fields include token/call/cache information; complete equality from every provider call through DB and UI requires a route-by-route test matrix. |

The existing inventory documents provider callsites and known accounting caveats. This pass confirms endpoint duplication and separates callsite inventory from call counts: precise per-route call counts are not inferable from static source alone and need focused instrumented tests in a later task.

## High-priority hardcode classification

The following are domain/behavior-specific values and should be migrated to governed data/configuration or removed where redundant. No new domain literal should be added while these migrations proceed.

| Category | Confirmed locations | Replacement target |
|---|---|---|
| Clinical facts, recommendations, dose rules, named drug exceptions | `clinical_reasoning/patient_dose_reasoner.py`, renal dosing modules, `copilot_drug_formatter.py`, `sandwich_pipeline.py`, `rag/rag_pipeline.py` alert handling, multimodal/other clinical engines | Source-linked records or retrieved evidence with version/hash and field-level provenance; generic algorithms remain code. |
| DDI graph/catalog, aliases, mechanisms, severity and class membership | `rag/ddi_graph_data.py`, `rag/lightrag_data.py`, `clinical_ddi_engine/rules_data.py`, `drug_registry.py`, `polypharmacy.py` | Reviewed, versioned clinical knowledge package/DB tables with authoritative source and effective date. |
| Clinical routing vocabulary/phrase triggers | `chatbot/intent_feature_matrix.py`, `turn_parser.py`, `session_routing.py`, `copilot_orchestrator.py`, `rag/adaptive_retriever.py`, `rag/hybrid_retriever.py`, `pure_rag_handler.py` | Structured NLU fields plus managed, schema-validated route policy; no clinical keyword fallback when NLU unavailable. |
| Domain examples/chips/canned answers | `copilot_orchestrator.py`, `conversational_handler.py`, `smart_chip_engine.py`, `specialty_knowledge_registry.py`, frontend `src/utils/nlp/intents/*`, `queryProcessor.ts` | Data-derived suggestions or generic non-factual UX copy; clinical answers must use retrieved source. |
| RAG verification lexicons and named contradictions | `rag/self_rag_verifier.py`, citation/output validators | Generic structural/provenance checks in code; clinical contradiction/safety records managed with sources. |
| Ingestion stopwords and extraction heuristics | `rag/pdf_ingestion_service.py` | Generic language processing/config or metadata; these must not encode clinical meaning. |
| Generic algorithms/schema/security limits | Pydantic schemas, arithmetic, hashing, auth boundaries, resource limits | May remain code/config if domain-neutral, documented, validated and not a hidden clinical recommendation/policy. |
| Tests, sample prompts, UI labels | test fixtures and UI text | Keep outside production clinical knowledge path; classify rather than blindly delete. |

This is a prioritized classification, not a completed exhaustive literal scan. The legacy frontend fallback is active on API failure and contains domain routing/response logic; it must not be overlooked when migrating hardcodes.

## Existing foundations and operational checks

- Existing contracts/policy: `workflow_models.py`, `workflow_policy.py`, `workflow_router.py`, managed `routing_policy.json`; coverage and route tests are present.
- Existing provenance/evidence work: `validate_response_evidence_contract`, `EvidenceRecord`, response schemas and route inventory tests. It is not proof that all claims across all executors are aligned.
- Existing PDF support: ingestion service and admin knowledge route exist; staging/publish lifecycle and rollback remain gaps.
- Existing availability: `backend/app/routers/availability.py` and UI status types/components exist; parity across local/cloud failure modes must remain in its dedicated acceptance tests.
- Root `package.json` scripts include `npm run lint` (TypeScript check), `npm run build`, `npm test`, `npm run build:admin` and source validation. `backend/requirements.txt` includes pytest.
- `.github/workflows/release.yml` builds a Windows Tauri desktop release on tags/manual dispatch; it does not run backend pytest or deploy the FastAPI production service. Production target and release pipeline therefore require an explicit operational readiness task.

## Required next audits before implementation tasks

1. Complete per-intent route mapping against `routing_policy.json`: NLU intent → actual function/executor → evidence source → validator → response type. Existing route inventory has broad branch families and mocks but explicitly notes incomplete fine-grained trigger/parity coverage.
2. Inventory every factual response builder in the 87 backend chatbot/RAG/reasoning/DDI Python modules, recording line/function, source of each fact, citation/evidence attachment and whether reached in production.
3. Inventory frontend active fallback modules and distinguish user-facing generic copy, operations logic and clinical response content.
4. Build a per-route provider-call test matrix for NLU, rewrite, embedding, retrieval, generation, verifier, retry and cache; static reading cannot establish actual calls under runtime conditions.
5. Trace token/latency/evidence fields from each provider wrapper to response schema, DB log, telemetry API and monitor UI for both `/chat` and `/chat/stream`.
6. Resolve deployment target and backend service release path separately from the checked-in Tauri desktop release workflow.

## Scope boundary

This inventory is a map for planning, not a declaration that the app is production-ready or 100% free of hardcoding. It does not modify code, execute test suites, run performance benchmarks, or certify medical content.
