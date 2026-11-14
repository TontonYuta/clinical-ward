# Chatbot workflow, embedded knowledge, and cost inventory

**Scope:** Static source inspection of the production checkout on 2026-11-11. This traced first pass is not a claim that every domain literal across all 86 chatbot/RAG/reasoning/DDI Python files has been individually reviewed. Data files, seed scripts, UI copy, tests, and operational handlers remain to be audited in the migration task.

## Summary

The chat is not yet one evidence-gated workflow. Frontend first calls FastAPI SSE, but on connection failure it calls a local intent router with phrase rules and direct clinical/operational responses. The backend orchestrator runs structured Gemini NLU, then branches into multihop, interaction matrix, patient dosing, specialty/scenario handlers, catalog output, operational dispatch and deep RAG, with many early returns. Some responses have citations; others return content directly. A successful HTTP backend response prevents frontend fallback, but backend early responses may bypass PDF/document retrieval.

Admin has API key vault/monitoring; backend /health reports basic server health, not provider or index readiness. Response/embedding caches and token telemetry exist. Token values sometimes come from provider metadata but sometimes are estimates/fallback constants. The route reads global last-execution usage, so per-request attribution under concurrency needs correction.

## Frontend request/response paths

1. src/App.tsx calls processClinicalAgentQueryAsync on submit (around line 1717), renders callback updates and final reply (around 1786); thrown errors show a generic backend error (around 1842).
2. src/utils/nlp/agentAsync.ts:90-154 calls chatCopilotApiStream. If a response with reply_text arrives, it maps citations/evidence/grounding and returns.
3. If stream throws or no usable reply returns, agentAsync.ts:157-170 calls local processClinicalUserQuery. src/utils/nlp/queryProcessor.ts routes through src/utils/nlp/intents/* and has phrase vocabularies, direct response templates and actions. This is not evidence-grounded offline clinical RAG.
4. Code after unconditional return localResult at agentAsync.ts:170 includes Gemini scenarios and askGeminiClinicalCopilot (roughly lines 174-205); these appear unreachable in current flow and require explicit audit/cleanup.
5. A legacy DDI frontend interceptor is commented out at top of agentAsync.ts; contains example drug pairs/canned outcomes but is inactive.
6. Chat launcher is src/App.tsx around line 2027; no availability badge there. src/services/api.ts:21 checks root health only; provider status is not represented.

## Backend request/response paths

### Endpoints

- backend/app/routers/copilot.py:31, POST /copilot/chat: session/cache, handle_copilot_chat, history/cache writes, token estimate fallback, chat log and telemetry.
- backend/app/routers/copilot.py:178, POST /copilot/chat/stream: SSE wrapper. It generates and validates the full response before emitting it as a token event; this is not LLM token streaming. Also logs usage.
- backend/app/routers/copilot.py:310, POST /copilot/rag: direct pure RAG endpoint with input guardrail then execute_clinical_rag.
- backend/app/routers/copilot.py:330, entity autocomplete via trie/fuzzy/SDK; not answer generation.
- Cache and history endpoints are supporting routes.

### Orchestrator

backend/app/services/chatbot/copilot_orchestrator.py:75 is the core; public wrapper begins around line 670 and standardizes citations after return. Core flow:

1. Input guardrail early return.
2. Image input calls multimodal LLM and constructs response directly (around 86-135); defaults for legal basis/card/suggestions/token/model/image values. Does not use text-document RAG.
3. Text sanitation then parse_clinical_nlu (Gemini NLU with heuristic fallback).
4. NLU branches to prescription audit, recursive multi-intent, topic shift, multihop, lookup guide, capability/conversation/out-of-scope, interaction, patient counseling, specialty consultation. Many direct returns.
5. Further routing may call query rewrite, patient dose reasoning, renal adjustment, symptom clarification, active-med schema/data slicer, session FSM, hardcoded guide, another multihop branch, clinical subflow, specialty response, DDI matrix, field routing, scenario generation, authoritative lookup, context RAG, operational dispatch or generic final response.
6. Branches depend on phrase lists, regexes, exact strings, registries and deterministic handlers. NLU has not replaced all domain routing.

### Evidence/generation

- backend/app/services/rag/rag_pipeline.py:21: complexity classification → curated graph expansion → hybrid retrieval → context build → Gemini synthesis → format/ground → heuristic Self-RAG audit.
- backend/app/services/chatbot/pure_rag_handler.py:89: deep RAG calls execute_clinical_rag, guardrail, resolves target drugs and validates reply/citations.
- backend/app/services/chatbot/sandwich_pipeline.py: independent trie/keyword NLU, DAV/monograph/inventory DB read, context construction and LLM synthesis; on failure returns a template from DB fields. Missing clinical fields have factual fallback strings and fallback location values needing provenance review.
- backend/app/services/rag/multihop_clinical_agent.py: special-case clinical pathways and curated graph/context/answer content; separate generation/audit path.
- conversational_clinical_engine.py, adaptive_clinical_synthesizer.py, clinical_db_resolver.py, drug_comparison.py, session_routing.py, agentic_tools.py, scenarios and DDI matrix can build direct response text or synthesize from structured records. Later migration needs trace of each source/citation.
- citation_grounder.py builds citations from retrieved chunks, but support filtering partly relies on token overlap/entity strings.
- self_rag_verifier.py uses claim segmentation, overlap thresholds, numeric matching and three named contradiction cases; this is not general semantic proof.

## Model and embedding calls

| Callsite | Purpose | Limits | Accounting caveat |
|---|---|---|---|
| chatbot/gemini_nlu_router.py → query_clinical_llm | Main intent/entity schema | output cap 350 | Separate call from later generation; heuristic fallback |
| chatbot/clinical_schema_extractor.py → query_clinical_llm | Structured schema extraction | output cap 600 | May duplicate NLU/schema work |
| chatbot/agentic_router.py → query_clinical_llm | Agent intent classification | output cap 400 | Additional classifier path |
| rag/query_rewriter.py → query_clinical_llm | Rewrite/decontextualize | output cap 100 | Independent from primary NLU |
| rag/rag_pipeline.py → query_gemini_models | Evidence synthesis | inherited 800 output cap from copilot_gemini.py | Prompt contains conversation, evidence, graph alerts, query |
| chatbot/sandwich_pipeline.py → query_gemini_models | DB context synthesis | inherited 800 cap | Separate generation path |
| rag/paperqa_synthesizer.py → query_clinical_llm | PaperQA synthesis | output cap 600 | Active path must be traced per request |
| copilot_gemini.py:53 → query_clinical_llm | Common text-generation wrapper | default output 800, temperature 0.2, 12s deadline | Cache key includes prompt/version |
| llm_provider.py | Gemini/OpenAI-compatible/vision providers | provider-specific | Some usage comes from response metadata; OpenAI-compatible estimates by text length if missing; _LAST_EXECUTION is module-global |
| rag/embeddings/provider.py | Gemini embedding and mock provider | configured model/dimension defaults; query cache and batch API | Ingestion embedding spend separately tracked unclear |
| cache/clinical_cache.py | Semantic cache vector lookup | shared embedding provider | Cache lookup may itself invoke paid query embedding |

## Cost controls and gaps

- Present: exact/semantic clinical response cache, query embedding cache, vector cache, adaptive top-k/context character limits, history truncation, output limits on some calls, telemetry/admin dashboards.
- Gaps: complexity classifier uses phrase lists; characters are not tokens; route can call NLU + rewrite + generation or separate pipeline calls; system instructions overlap; provider usage is not always actual; endpoint estimates missing usage and reads a global last-call value; frontend fallback has no common evidence/cost trace; semantic cache may incur embedding cost.
- No cost savings percentage should be claimed before fixed evaluation and provider-reported baseline.

## Confirmed high-priority hardcoded domain logic

Prioritized but not exhaustive across all source files:

1. backend/app/services/chatbot/copilot_orchestrator.py: many clinical phrase lists, exact routes, hardcoded guidance/chips, symptom regex and pharmacology phrase detection; early response branches.
2. chatbot/session_routing.py: contextless/pediatric/renal/regulatory phrase tests, interaction examples/catalog behavior and templates.
3. chatbot/pure_rag_handler.py: clinical gate phrases and role-name heuristics.
4. rag/adaptive_retriever.py: fixed complex/single-attribute vocabulary controls top-k/context budget.
5. rag/hybrid_retriever.py: interaction vocabulary, DDI gating and class heuristics.
6. rag/lightrag_data.py and lightrag_graph_builder.py: manually curated taxonomy, aliases, mechanisms, members and graph edges in Python.
7. clinical_reasoning/renal_dosage_rules.py: dose tiers, drug aliases, source pages/titles and PDF URLs in Python constants.
8. clinical_reasoning/pediatric_dosage_reasoner.py: drug pathways, dosage formulas/text, age/weight cutoffs and safety claims.
9. clinical_ddi_engine/rules_data.py, drug_registry.py, polypharmacy.py: interaction knowledge, class rules and medication taxonomy coexist with JSON/DB catalogs; reconcile source authority/provenance.
10. rag/self_rag_verifier.py: fixed stopwords/clinical vocabulary and three named contradiction cases.
11. chatbot/gemini_nlu_router.py, semantic_fallback.py, intent_feature_matrix.py, clinical_schema_extractor.py: schema prompt plus deterministic lexicons/regex/exact cues.
12. chatbot/sandwich_pipeline.py: style/intent phrases and hardcoded fallback clinical text when fields absent.
13. Frontend src/utils/nlp/queryProcessor.ts and src/utils/nlp/intents/*: extensive domain phrase matchers and direct responses/actions; active after backend stream failure.
14. Frontend src/services/geminiService.ts and src/services/gemini/clinicalScenarios.ts: separate prompts/scenarios; inspect activation and ensure no evidence bypass.
15. More candidates needing line review: smart_chip_engine.py, multiturn_handler.py, fsm_router.py, field_routing.py, conversational_clinical_engine.py, agentic_tools.py, specialty knowledge and scenario files/security guardrails.

## Availability/offline

- backend/app/main.py:247 root/health endpoints return static healthy plus commit/system/compliance, not DB/index/provider health.
- backend/app/services/admin_key_vault.py manages masked keys and ping tests; chat UI has no combined runtime capability status. Never expose vault contents in status API.
- src/services/api.ts:21 checkBackendHealth calls root only; does not model provider or index.
- Frontend local fallback is phrase routing/templates, not local RAG and unsafe to label as offline clinical reasoning.
- Backend settings support provider=offline/openai-compatible and embedding module has a mock provider. This does not establish offline answer quality or index readiness.
- src/App.tsx:2027 launcher styling is static, no slow glow/status badge.

## Limitations and follow-up audit

- 86 Python files are in chatbot/RAG/clinical_reasoning/clinical_ddi_engine folders alone. Search was cross-checked with active routes/calls but not every clinical literal individually.
- Audit every CopilotResponse early return and frontend ChatMessage builder for citations/evidence.
- Confirm durable deployment storage and admin knowledge-upload surface. PDF support in backend/app/routers/bhyt.py is for audit/OCR input, not a published chatbot knowledge lifecycle.
- Next plan tasks establish response/telemetry contract, availability, offline safe boundary, evidence-gated routing, then migrate data/code and build PDF lifecycle.
