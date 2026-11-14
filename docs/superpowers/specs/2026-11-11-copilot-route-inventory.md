# Copilot Route Inventory (In progress)

Source inspection of copilot_orchestrator.py shows ordered terminal route branches below. Conditional handlers that return `None` fall through to subsequent branches; the first non-None result terminates the request. This is a source-derived map, not a claim that every input combination has a parity fixture.

## Ordered terminal branches in `_handle_copilot_chat_core`

| Order | Trigger / condition | Executor / data | Classification and validation boundary |
|---:|---|---|---|
| 1 | Input guardrail blocks | `validate_input_guardrail` | Security response; outer evidence gate exempts blocked intent |
| 2 | Image payload | Gemini multimodal provider | Requires returned evidence + citations + grounded flag; outer evidence gate |
| 3 | NLU prescription block | `handle_prescription_block_audit` | Rule catalog and timing output lacked linked provenance; now returns safe abstention until source-linked data exists |
| 4 | NLU has 2+ subqueries | `handle_multi_intent_chat`, recursively invokes core | Composite; each factual child must survive shared evidence gate |
| 5 | Multihop case (pre-NLU branch) | `execute_multihop_clinical_evaluation` | Synthetic internal draft cannot be surfaced; API abstains pending retrieved versioned evidence |
| 6 | NLU `MEDICATION_LOOKUP_GUIDE` | Inline portal guidance | Informational capability/availability claims; currently authored text, not data-derived |
| 7 | NLU `CAPABILITY_OPENING` | `handle_capability_opening` | Capability response |
| 8 | NLU feedback / greeting | conversational handlers | Conversational |
| 9 | NLU `OUT_OF_SCOPE` | steering/out-of-scope handlers | Conversational/out of scope |
| 10 | NLU interaction clarification | examples/session then `handle_interaction_clarification` | May clarify or delegate to DDI response |
| 11 | NLU interaction check with 2+ drugs | `format_multi_ddi_response` | Returns safe abstention while source-version links are missing |
| 12 | NLU medication lookup deictic referent | updates session only; falls through | Non-terminal |
| 13 | NLU patient counseling | `execute_clinical_sandwich_pipeline` | DB synthesis returns citation but no evidence; outer evidence gate abstains |
| 14 | NLU specialty protocol | operational subflow, then registry specialty synthesis | Handler-specific source gate; specialty artifact can carry runtime hash |
| 15 | No recognized medication and conversational/out-of-scope match | conversational handler | Conversational |
| 16 | Patient dose rule + complete patient slots | `evaluate_patient_dose_reasoning` | Verifies Dược thư PDF checksum and emits citation-linked artifact evidence; the inline rule's claim-level alignment remains unverified |
| 17 | Renal adjustment phrase handler | `check_renal_adjustment_request` | Handler-specific response; requires provenance review |
| 18 | Self-symptom without patient context | clarification | Clarification |
| 19 | Active medication deep-facet follow-up | DB slicer + adaptive synthesizer | Emits evidence only from versioned rows; status-sensitive |
| 20 | Active-drug/session resolution | `resolve_active_drug_and_terms` | May return early response; handler-specific |
| 21 | FSM context | `route_fsm_context` | May return conversational/operational response |
| 22 | Exact portal query | Inline portal guidance | Same informational guidance class as branch 6 |
| 23 | Multihop case (post-rewrite branch) | multihop agent | Safe abstention pending source-backed claims |
| 24 | Clinical subflow | `dispatch_clinical_subflows` | Includes operational and clinical subflows; each subtype needs own validation |
| 25 | Specialty pre-match | specialty registry synth | Registry artifact evidence if available |
| 26 | Interaction clarification / drug comparison / field inquiry | field/DDI/comparison handlers | DDI ungrounded pending provenance; field lookup uses source gate |
| 27 | Specialty phrase match / missing clinical subject | specialty registry or clarification | Registry source hash or clarification |
| 28 | Deictic/unanchored question without active medication | clarification | Clarification |
| 29 | Named drug indication lookup | `lookup_drug_authoritative` | DB/RAG source contract; shared gate |
| 30 | Gemini clinical scenario match | scenario handler | Requires source evidence; shared gate |
| 31 | Specialty match after scenario | specialty registry synth | Registry artifact evidence if available |
| 32 | Therapeutic alternative | deep RAG | Hybrid chunks/graph; outer evidence gate |
| 33 | Personalized named-medication inquiry | sandwich then authoritative lookup | Sandwich source gate; fallback authoritative lookup |
| 34 | Contextual follow-up | contextual RAG | Hybrid chunks/graph; outer evidence gate |
| 35 | Operational business match | authorized dispatcher | Operational result; authorization/business validation, evidence not applicable |
| 36 | Drug/SĐK lookup fallback | sandwich then authoritative lookup | Shared evidence gate |
| 37 | Specialty direct match | specialty registry synth | Registry artifact evidence if available |
| 38 | Generic deep-RAG qualification | deep RAG | Hybrid chunks/graph; outer evidence gate |
| 39 | No branch matched | clarification response | Evidence-neutral request for a better specified medication, document or operation |

## NLU intent contract

`ClinicalNluExtraction.intent` is a 12-value Literal in `backend/app/schemas/clinical_nlu.py`; startup policy validation derives the required coverage set from this type. Every value has an explicit entry in `routing_policy.json`. Current executor mapping records the pre-policy handler classification; it does not yet replace the ordered route chain because response can depend on entities, conversation state, permissions, and handler `None` fallthrough.

| NLU intent | Current dispatch boundary | Terminal / fallthrough rule | Evidence class |
|---|---|---|---|
| `GREETING_WELLBEING` | greeting handler | Return if handler recognizes it; otherwise continue | Conversational |
| `CAPABILITY_OPENING` | capability steering | Terminal | Capability text |
| `CONVERSATIONAL_FEEDBACK` | greeting/acknowledgment handler | Return if recognized; otherwise continue | Conversational |
| `MEDICATION_LOOKUP` | deictic slot update; later DB/field lookup | Slot update falls through; factual output passes shared evidence gate | Clinical factual |
| `MEDICATION_LOOKUP_GUIDE` | live catalog counts + portal guidance | Terminal | Operational catalog counts + authored navigation guidance |
| `MEDICATION_INTERACTION_CHECK` | DDI matrix if two named drugs | Terminal if formatter returns result; otherwise clarification/fallthrough | Clinical factual; currently abstains without source-linked rules |
| `MEDICATION_INTERACTION_CLARIFICATION` | prior example lookup, then clarification handler | Return if recognized; otherwise continue | Clarification |
| `PATIENT_CASE_REASONING` | patient dose reasoner after rewrite | Terminal if reasoner returns result; otherwise continue through renal/general routes | Clinical factual or clarification |
| `PATIENT_MEDICATION_COUNSELING` | sandwich pipeline when target medicine resolved | Terminal if executor returns result; otherwise later medication routes | Clinical factual |
| `SPECIALTY_CLINICAL_PROTOCOL` | clinical subflow, then specialty registry synthesis | First non-None result terminates | Operational or source-backed clinical |
| `CLINICAL_CASE_CLARIFICATION` | later deterministic routing and final clarification | No dedicated immediate return for every input | Clarification / later clinical route |
| `OUT_OF_SCOPE` | chitchat/out-of-scope steering | Terminal | Conversational |

## Route parity fixtures in current suite

Direct orchestration fixtures cover input guardrail before image/NLU; image before text NLU; prescription block before multi-intent; capability, greeting, feedback, out-of-scope and multi-intent paths; interaction check and clarification; counseling handoff; specialty subflow result and `None` fallback; patient dose reasoner early return; and NLU outage leading to symptom clarification. Existing route/RAG tests additionally cover evidence gates, multi-intent abstention, deep-RAG retrieval reuse, and API response behavior.

Precedence is significant: early NLU returns (prescription, multi-intent, DDI, patient counseling, specialty) bypass later lookup/RAG branches. Rewrites occur before patient-dose handling and affect downstream detectors; original and rewritten query identity is not yet preserved across every executor.

| Route group | Decision/source | Evidence/source | Validation | Response |
|---|---|---|---|---|
| Input guardrail block | validate_input_guardrail before routes | Guardrail policy | Sanitized/block status; no clinical evidence expected | CopilotResponse (security intent) |
| Image input | payload.image_base64 before text NLU | Gemini vision response may provide evidence/citations | Local gate requires evidence + citations + grounded; outer provenance gate | CopilotResponse (multimodal) |
| NLU prescription block | NLU `is_prescription_block` | Prescription audit handler / DB | Handler-specific; shared provenance gate required | CopilotResponse |
| NLU multi-intent | NLU `sub_queries >= 2`, gather child core routes | Merged child citations/evidence | Composite requires each factual child grounded; shared provenance gate | CopilotResponse (composite) |
| NLU multihop (first intercept) | NLU available, `is_multihop_clinical_case` | Current executor builds synthetic findings/chunks and citations | No source retrieval/provenance; now API deliberately abstains | CopilotResponse (safe_abstention) |
| NLU medication lookup guide | NLU intent `MEDICATION_LOOKUP_GUIDE` | Inline descriptive portal instructions | No factual grounding currently; contract classification needs review | CopilotResponse |
| NLU downstream routes | Primary intent branches, medication/field handlers, DDI, specialty, operational | DB/catalog/registry/RAG depending on handler | Handler-specific + outer `validate_response_evidence_contract` | CopilotResponse |
| Fallback when NLU unavailable or unmatched | Later ordered routing checks and final authored fallback | RAG, operational DB, or inline text depending on branch | Outer provenance gate except explicitly exempted intents/types | CopilotResponse |
| Deep clinical RAG | `handle_deep_rag_consultation` qualification + caller ordering | Hybrid RAG chunks/graph | Output guardrail, query overlap, outer provenance contract | CopilotResponse |
| Contextual clinical RAG | Follow-up/session context checks | Hybrid RAG chunks/graph | Handler check + outer provenance contract | CopilotResponse |
| Specialty consultation | Specialty registry match | Specialty JSON file, hashed at runtime | Citation/evidence share synthetic specialty chunk ID; provenance only if file readable | CopilotResponse |
| Medication profile | DAV/monograph lookup then profile builder | Monograph, DAV row, optionally RAG chunks | Only source-linked RAG chunk evidence or versioned monograph can ground; DB fallback has partial gaps | CopilotResponse |
| Medication field / summary | Ranked field intent; formatter | Monograph/DAV field data | Currently emits source citation but evidence attachment is incomplete; shared gate may abstain | CopilotResponse |
| DDI matrix | Pairwise and polypharmacy detector | Rule catalog + graph data | Emits regulatory citations without linked source evidence; shared gate abstains factual text | CopilotResponse |
| Operational business | Authorized dispatcher | Operational DB | Authorization and transaction/business validation | CopilotResponse (operational result) |
| Direct `/api/copilot/rag` | Route invokes `execute_clinical_rag` | Hybrid chunks / curated graph | RAG grounder and verifier, response schema | RagResponse |
| `/api/copilot/chat/stream` | SSE wrapper around chat endpoint | Same chat result; streams events after result is complete | Chat response validation; generation itself remains non-streaming | SSE events |

## Confirmed concerns

- Deep RAG does a top-1 HybridRetriever request then invokes execute_clinical_rag, which retrieves again.
- rag_pipeline selects HybridRetriever directly; dynamic retriever is not selected there.
- Graph evidence and document chunks are mixed in answer/verifier evidence without explicit provenance typing.
- Clinical branches have different evidence and validator handling; citation standardization is applied at the outer orchestrator boundary only.
- RagResult defaults previously marked an unvalidated result grounded/PASS; defaults changed to fail-safe in current work.
- Clinical handlers use phrase/role checks and embedded policy; managed-policy migration is required before claiming no hardcoded domain policy.

## Not yet established

- Exhaustive route-trigger conditions and parity fixtures for every terminal branch.
- Evidence source/version completeness for every specialized executor.
- Evidence identity preservation under all cache paths.
- Corrective retrieval quality policy and bounded retry semantics.

## Evidence-based follow-up (2026-11-12)

- Multi-hop output still depends on fabricated inline chunks/citations and hardcoded treatment text. The route now returns a safe abstention with no citations/evidence, confidence 0, and `NOT_RUN` critique; its internal draft remains available only to unit-level algorithm tests. The authoritative replacement is retrieval from versioned source chunks, with each emitted claim attributed before enabling the route.
- Medication profile responses now resolve provenance against the extracted monograph artifact or versioned retrieved chunks. A DAV row alone is not accepted as evidence for doses or safety claims. Specialty synthesis binds citation/evidence IDs to its registry artifact hash.
- DDI matrix responses no longer claim verified grounding because the rule catalog has not yet been linked to a versioned authoritative source record.
- DAV curated enrichment now records the curated artifact checksum for enriched rows. Monograph records created from curated DAV values carry that artifact identity; pre-existing mixed rows are not relabeled wholesale. No production DB migration or seeding was run.
- Verification on 2026-11-12: compileall and `git diff --check` passed; focused provenance/multihop/medication-profile/route/DDI/citation/cache tests → 47 passed. No benchmark run.
- Exact terminal route order and every primary NLU intent handler. The inventory above is route-family level and not exhaustive.
- Whether DB field provenance remains valid after every enrichment/update path; DAV curated enrichment now carries curated artifact metadata, and monograph backfill no longer relabels mixed records with one file hash.

## Evidence-based follow-up (2026-11-12, continued)

- Expanded the ordered terminal branch table from `_handle_copilot_chat_core`; early NLU returns and later RAG/lookup fallbacks are enumerated. Individual route trigger predicates still require parity fixtures.
- Prescription-block audit now returns a safe abstention without synthetic citations or rule-generated clinical content because its DDI and administration-time rules do not carry linked source versions. Internal draft logic remains in place pending governed source ingestion.
- The DDI matrix now returns a safe abstention for both positive findings and no-finding outcomes until catalog rules are connected to a verified source/version. It no longer emits unlinked alerts, cards, substitutions, or purported official citations.
- The unmatched pediatric-guide branch has been converted to a request for medicine, age, and weight; it no longer returns inline dosing rules without sources.
- The generic unmatched route now asks for a topic without embedding legal regulations or named DDI examples.
- Patient renal-dosing output verifies the Dược thư manifest PDF bytes against its SHA-256 and attaches a citation-linked evidence record. The calculation still uses inline renal dosing rules; PDF integrity establishes document identity, not claim-level support. A governed rule-to-source mapping / extraction is still required before claiming every dose rule is proven by that PDF.
- The sandwich medication pipeline attaches source identity/version and evidence from provenance-bearing DB rows, requires a source artifact represented in the manifest, and otherwise abstains. It preserves the selected record's own artifact hash, including extracted monograph JSON, rather than inheriting a generic source version.
- Adaptive DB synthesis now includes its evidence records and only keeps citations whose chunk IDs occur in those records; it no longer marks unversioned DB output grounded.
- Portal inventory counts are read from the live DB instead of claiming fixed 771 / 54,885 records.
- Two previous route expectations were changed to fail-closed because their factual result lacked attached source evidence: multi-intent child synthesis and a pediatric drug answer. This avoids returning draft factual prose in the absence of evidence.
- Correctness verification: focused route / DDI / prescription / sandwich / renal / adaptive / provenance / SSE / image set → 84 passed, 1 Starlette deprecation warning. No benchmark run.

## Route parity follow-up (2026-11-12)

- Added async contract fixtures against `_handle_copilot_chat_core` using mocked executors and NLU; no paid generation or DB is invoked.
- Confirmed image payload dispatches directly to the multimodal executor before text NLU; a non-clinical image result is classified as a safe abstention.
- Confirmed prescription-block detection takes precedence over multi-intent decomposition when both flags are present.
- Task 1 inventory and parity contract complete at route-family/NLU-intent level; finer combinations remain covered by executor-owned tests. Policy is not wired into route selection because current routing is an ordered, stateful chain rather than an intent-only dispatch table.

## Route parity follow-up (2026-11-12, continued)

- Added fixtures for capability/greeting/feedback NLU routes, multi-intent precedence, NLU-unavailable deterministic fallback, interaction clarification/check, patient counseling dispatch, and specialty subflow/registry ordering.
- Verified fallback NLU can clarify a symptom-only query without emitting a factual answer, while a named drug remains subject to the shared evidence gate.
- Specialty routing is explicitly a chain: a non-None clinical subflow terminates; a `None` result falls through to the specialty registry and synthesis.
- Tests exercise executor handoff/terminal behavior with mocks at module boundaries; existing focused executor and RAG tests cover detailed predicates and evidence behavior.

## Managed NLU routing follow-up (2026-11-12)

- `routing_policy.json` now owns the ordered precedence signals for prescription-block and multi-intent NLU results; policy loading validates duplicate signals and references to unmapped intents.
- `decide_route` evaluates those configured signals and returns the selected executor/reason; the orchestrator uses the resulting decision for ambiguous, prescription-block, and multi-intent dispatch. The precedence order matches the prior behavior (prescription block before multi-intent).
- Parity verification: workflow routing, policy, route inventory, Gemini NLU, sandwich, and Self-RAG tests → 65 passed; compileall and `git diff --check` passed.
- Remaining repeated classifications are downstream stateful predicates that depend on post-rewrite query text, resolved medication/session state, patient slots, authorization, or executor `None` fallthrough. Moving these into a single policy dispatch without route-specific adapter parity would change route behavior; this remains part of executor migration in Tasks 5–8.

## Evidence-grounded claim contract follow-up (2026-11-13)

The implementation now distinguishes source claims from inference claims. The common chat boundary requires versioned evidence, a supported source claim, an evidence claim map, and claim text present in the final reply. Citations alone do not prove support. Invalid or unverified factual responses are replaced with safe abstention before serialization.

| Route family | Source | Claim/evidence linkage | Validation / behavior |
|---|---|---|---|
| Hybrid RAG via chat | Retrieved chunks or versioned graph records included in prompt | Backend creates evidence IDs; model references are accepted only from that exact set; source facts are checked against evidence | RAG renders validated claims; inference abstains without semantic verification |
| Direct medication field lookup | Requested monograph/DAV field with record provenance | Exact field evidence is converted to source claims linked to its evidence ID | Shared boundary checks support, provenance, evidence map, and reply alignment |
| Profile/adaptive medication synthesis | Versioned monograph or evidence slices | Some formatters attach evidence but do not preserve claim text verbatim | Shared boundary abstains where exact claim alignment is absent |
| Multi-intent composite | Child executor responses | Composite does not yet preserve a complete claim map | Shared boundary abstains unless claims and links are preserved |
| DDI, prescription, specialty, sandwich, patient reasoning | Executor-specific catalogs, registry, DB, or retrieval | Claim contracts are incomplete across these executors | Noncompliant factual results abstain |
| Conversation, clarification, operational result | User input or operational database | Excluded from clinical factual gate by response class | Existing conversational and authorization paths continue separately |

Known limit: deterministic text and provenance checks establish source-string presence, not arbitrary semantic entailment. Evidence inference claims are rejected until a semantic verifier is selected. Legacy formatted routes may therefore return more abstentions until their formatters emit claim-preserving output. No benchmark was run.

Additional claim-gate review (2026-11-13): Clinical response classes and historical clinical intent allowlists no longer bypass the common validator. Legacy heuristic Self-RAG can no longer pass claims by overlap, and its fixed Metformin/macrolide/statin/ACEi-ARB contradiction exceptions were removed. The RAG pipeline no longer fabricates a CDSS substitute recommendation from named drug checks; unverified multihop remains abstention. Direct DB lookup renders its claim strings verbatim with source sections so the displayed factual text matches the records. The focused CDSS test now asserts safe abstention for the ungrounded multihop case; other source-linked alert routes remain covered by their separate provenance contract.
