# Chatbot Focused Medication Safety Design

## Intent
Make the clinical chatbot answer the medication detail the user asked for, guide useful follow-up questions, and present drug interaction findings with cautious, consistent wording.

## Goals
- Detect common requested medication fields (ingredient, indication, contraindication, dosage, adverse effects, interactions, and stock) and return only the requested field with drug identity and available source citation.
- For a general medication query, provide a concise summary and omit unrelated inventory counts and replenishment instructions.
- Offer contextual follow-up prompts after medication and DDI answers, visibly labeled as suggestions and sent as normal user queries when selected.
- Route DDI queries through the backend catalog; never describe a non-match as proof that a pair is safe, and never use curated client fallback data to make a definitive no-interaction claim. Distinguish indexed finding, not indexed, and service failure. Keep critical alerts visually prominent.
- Preserve deterministic operational action cards, existing guardrails, source metadata, and session medication context.

## Non-goals
- No changes to CPOE save/sign workflow or prescription API.
- No claim of complete interaction coverage or individualized prescribing.
- No source dataset replacement, new AI service, or changes to non-chat operational workflows.

## Approaches
- Keep broad profiles and rely on users to scan them: smallest change, but does not address the reported overload.
- Selective field response with contextual next-question suggestions and backend-only authoritative DDI results: chosen because it directly addresses the observed behavior while preserving the existing architecture.

## Architecture and constraints
- Keep FastAPI/SQLAlchemy and React/TypeScript. Add field-intent selection to the existing drug lookup/formatter path and keep response schema backward compatible.
- Keep backend DDI API as the chat authority. Client fallback may request the two drug names or explain that the source is unavailable; it must not claim a negative result from the smaller curated list.
- Suggestions remain ordinary chips in the existing chat message flow; they do not execute clinical or inventory actions without an explicit user query.
- Run focused regression tests, backend/frontend suites, lint and build where the repository supports them; report environmental or pre-existing failures separately.

## Acceptance criteria
- A query asking only for a specific field returns that field, drug identity and source when available, without unrelated profile sections or inventory actions.
- A general drug query is shorter than the current full profile and has contextual medication follow-up suggestions.
- DDI indexed findings retain severity, mechanism, action and source; not-indexed and backend-failure responses are explicitly distinct and do not state that the pair is safe.
- Chat suggestions are visible and selecting one submits its prompt through the existing chat handler.
- Existing operational action-card, prompt-security, and grounded-source behavior remains intact.
