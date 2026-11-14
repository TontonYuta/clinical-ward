# Copilot Evidence Workflow Design

## Intent

Make clinical Copilot routing, evidence collection, validation, and response metadata consistent across its clinical answer paths. Keep task-specific engines for authoritative medication lookup, structured DDI checks, operational workflows, and complex case analysis; consistency means shared contracts and controls, not forcing every task through one retrieval algorithm. Benchmarking is explicitly deferred until the logic changes are complete.

## Goals

- Define one explicit request lifecycle: input safety, normalization/context resolution, intent decision, specialized execution, evidence/result normalization, applicable validation, response and trace metadata.
- Ensure clinical factual answers identify their evidence and evidence status, or clearly abstain/clarify when adequate evidence is unavailable.
- Make routing decisions inspectable and avoid duplicate intent classification or repeated retrieval where the same evidence can be reused.
- Keep domain facts, clinical rules, routing policy and tunable budgets out of inline application code; load them from managed data/configuration with validation and provenance.
- Preserve specialized deterministic services and existing API response compatibility during migration.
- Complete logic changes and focused correctness checks before running the retrieval/chatbot benchmark.

## Non-goals

- Replacing every branch with one generic RAG flow.
- Changing clinical recommendations or curating new medical content as part of the orchestration refactor.
- Adding a cross-encoder, NLI model, new embedding model, vector database, or streaming generation in this project.
- Using benchmark scores to tune logic before the workflow and evaluation inputs are reviewed.

## Constraints

- Project constraint: no hardcoded domain data, clinical rules, routing phrase lists, sample facts, or operational tunables in application logic. Runtime logic may implement generic algorithms and schemas; domain-specific values must be managed data/configuration and validated at load time.
- Preserve input/output guardrails, authorization, patient context boundaries, existing specialized clinical engines, and API compatibility.
- Do not claim clinical accuracy from unreviewed evaluation data.
- Do not run the benchmark until all planned logic work is complete.

## Current workflow findings

- `/api/copilot/chat/stream` checks clinical cache, then runs the large Copilot orchestrator, then emits the already-completed answer in SSE word groups.
- The orchestrator sanitizes and classifies intent, has multiple early returns for NLU, DDI, medication lookup, protocol, business, and multihop routes, and later rewrites/reclassifies clinical queries through additional rules. There are duplicated/multiple intent decisions and branch-specific behavior.
- Clinical answers come from several paths: structured medication lookup, multi-drug DDI engine, sandwich/adaptive evidence flow, specialty consultation, multihop, and `rag_pipeline`. Not all return through the same evidence validation.
- `rag_pipeline` uses adaptive `top_k`, graph expansion, hybrid retrieval, character-truncated evidence context, Gemini generation, a heuristic Self-RAG verifier, and CDSS alert construction.
- The main pipeline directly calls `HybridRetriever`; `DynamicHybridRetriever` exists but is not used there.
- `handle_deep_rag_consultation` performs a separate top-1 retrieval preflight then calls the full pipeline, duplicating retrieval.
- Response citation standardization is applied at orchestrator exit, but evidence/grounding fields are generated and validated differently across branches.
- Domain policy and content are embedded in Python across phrase lists, graph data, validators, branch responses, budgets, and special-case recommendations, conflicting with the project constraint.
- The current retrieval benchmark directly exercises synchronous `HybridRetriever`, with all cases marked unreviewed; it does not represent end-to-end routing. Benchmark is deferred until workflow logic is complete.

## Approaches considered

1. **Replace all routes with one RAG pipeline:** rejected because exact catalog lookup, deterministic DDI calculations, and operational actions have different authoritative sources and safety semantics.
2. **Keep branches independent and only improve retrieval:** rejected because branch-specific evidence contracts and validation remain inconsistent, and duplicate routing/retrieval remains.
3. **Shared orchestration lifecycle and evidence contract with specialized executors:** selected. It centralizes lifecycle, traceability, evidence status and applicable validation while preserving specialized engines.

## Proposed architecture

1. **Request preparation:** one validated input guard and one normalization/context resolution stage. Keep original query immutable; carry normalized/reformulated query and provenance separately. Resolve multi-turn references once.
2. **Intent decision:** one routing result with intent, selected executor, required entities/context, and reason. NLU output is consumed once; deterministic policy resolves ambiguity without performing a second unrelated classification pass. Routing policy is managed configuration/data, not inline phrase collections.
3. **Specialized executors:** medication catalog, DDI, protocol/evidence RAG, complex case, operational workflow, clarification/out-of-scope. Executors own task-specific source access and algorithms.
4. **Common result contract:** each executor returns answer payload plus evidence records, source identifiers/provenance, evidence status, warnings, validation status, and abstention/clarification reason. Non-clinical operational responses can declare evidence not applicable.
5. **Common response validation:** schema/authorization/output safety always applies; evidence support validation applies to clinical factual claims and cannot be represented as verified merely because a branch returned a citation. Preserve deterministic safety rules as managed, versioned data.
6. **Single response adaptation:** map the common result to the existing API response once; standardize citations and trace metadata at this boundary.
7. **Observability:** record selected intent/executor, retrieval source IDs, rewrite decision, fallback/error status, validation verdict and timings without recording unnecessary sensitive patient details.

## Migration stages

1. Inventory and freeze current behavior contracts per route/intent; identify all executor paths and duplicate logic.
2. Define typed routing decision, evidence record, executor result, and trace schemas; validate external policy/data files and version them.
3. Extract current branches behind specialized executor interfaces without changing their behavior; consolidate request preparation and use one NLU/routing decision.
4. Consolidate evidence provenance and result validation at the shared boundary; make evidence-required clinical paths abstain/clarify consistently.
5. Remove redundant retrieval preflight and pass/reuse retrieval results where needed; route main retrieval through one configured retrieval policy (including explicit dynamic/fixed selection).
6. Move domain-specific route phrases, graph/policy values, thresholds, context budgets, and clinical special cases to managed data/configuration. Add startup validation, source/version metadata, and fail-safe handling for missing/invalid configuration. No silent embedded defaults for clinical values.
7. Add focused unit/integration tests for routing, evidence contract, failure/fallback, and API compatibility. These are correctness tests, not benchmark runs. Run the benchmark only after all logic stages are complete and evaluation labels are reviewed.

## Risks and mitigations

- **Routing regressions:** preserve explicit intent-to-executor fixtures and test old and new decisions before switching traffic.
- **Unsafe missing configuration:** fail closed for evidence-required clinical paths; surface a configuration error/abstention rather than silently using code defaults.
- **Over-centralized validation:** validation policies are selected by task type and evidence requirements; do not apply clinical evidence rules to greetings or operational actions.
- **Migration scope:** do this in backward-compatible slices; retain response schemas while internals converge.
- **Sensitive trace data:** persist identifiers/status/timing with existing privacy controls; avoid duplicating full patient context in traces.

## Acceptance criteria

- Every Copilot intent path is registered to one executor and documented; unregistered/ambiguous intents cannot silently enter a generic clinical answer path.
- Every clinical factual response has structured provenance and an explicit evidence/validation status, or returns a clarification/abstention.
- NLU/routing and query rewrite do not independently classify the same request multiple times; original and rewritten queries remain distinguishable.
- Retrieval is not repeated for preflight when its results can be reused.
- Domain-specific policy/data and tunable budgets are loaded and validated externally; no application branch embeds clinical facts or phrase-driven policy values.
- Existing API contracts and specialized DDI/catalog/operational workflows remain functional.
- Focused logic tests pass before the deferred benchmark is run.

## Open implementation details

- Choose the repository's established managed source for routing policy and safe operational settings; keep clinical graph/content in reviewed data packages with provenance/versioning.
- Define the exact evidence-supported claim granularity for structured lookup versus generated synthesis.
- Determine migration order from a complete route inventory and existing tests; do not remove a legacy path until parity is covered.
