# CRAG Evidence Correction Design

## Intent

Improve retrieval when the first RAG pass returns no document chunks that satisfy the application's existing evidence relevance filter. The correction should improve recall without generating unsupported clinical facts or adding a separate LLM call.

## Goals and non-goals

- Use the existing evidence relevance filter and retrieval index; add no clinical vocabulary or drug-specific rules.
- On a weak first pass, make one bounded retrieval pass with a larger candidate pool, then retain only chunks that pass the same relevance filter.
- Keep claim validation, citations, provenance, context budget, and final abstention behavior authoritative.
- Do not add an LLM grader, a second generation call, a new database, or deployment changes.

## Approaches

1. Add an LLM/NLI relevance grader and semantic query rewriting. This can judge paraphrases more deeply, but adds latency, cost, model availability requirements, and a separate validation contract.
2. Reuse the current generic evidence relevance filter, expand retrieval once only when the first pass has no accepted document chunks, and grade the expanded results with that same filter. This is the selected approach because the app already uses this filter to reject unsupported chunks and the second retrieval does not require a new model call.

## Design

The RAG coordinator will grade the initial retrieved document chunks before constructing the generation context. If at least one passes, the pipeline proceeds with accepted chunks. Otherwise, it will request one expanded candidate set from the retriever, combine it with the original results by chunk identity, and keep only chunks accepted by the existing relevance filter. Graph evidence remains governed by the existing graph path. If no document chunk passes after correction, the existing grounding and abstention behavior remains in force. The context character budget still caps content sent to generation.

The correction breadth will be configurable, bounded by the indexed corpus size, and will not introduce new clinical terms or values into the answer. Existing RRF scores will remain ranking signals only, not calibrated probabilities.

## Constraints

- Preserve current unrelated local changes.
- Do not modify UI or deploy.
- Validate with focused RAG tests and related evidence/provenance tests.

## Open implementation choices

- Use the existing evidence overlap logic as the evidence grader, with a public helper only if needed to avoid duplicating its semantics.
- The expanded retrieval must be bounded and deduplicate chunks by stable chunk ID.
