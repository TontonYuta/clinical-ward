# CPOE Multi-Medication and DDI Safety Design

## Intent
Allow a prescription draft to contain multiple individually complete medications and prevent saving a prescription containing a pair marked contraindicated by the existing clinical DDI engine.

## Goals
- Add multiple medication rows with add/remove controls and per-row dose, route, frequency, quantity, unit, and duration.
- Run DDI review as medications are added and again on the backend before persistence.
- Display backend findings with severity, mechanism/consequence, action, and source.
- Reject persistence when the backend audit reports a contraindicated pair; do not rely on client checks.
- Preserve one-drug prescriptions as valid when clinically appropriate. Multi-drug capability must not imply every order requires two drugs.
- Update stale CPOE tests to assert current TT26 draft behavior accurately.

## Non-goals
- No digital signing or dispensing workflow.
- No automatic dose recommendations or substitution.
- No claim that an unindexed pair is safe; distinguish incomplete/unavailable DDI review from a negative lookup.

## Approaches
- Store each selected medicine immediately as a draft item, then edit it inline: enables review at each addition and keeps a clear order list; chosen.
- Keep one active editor and append on submit: simpler but risks losing/editing order data and makes per-item validation harder.
- Build a separate prescription builder service: unnecessary for this existing React/FastAPI shape.

## Architecture and constraints
Reuse the existing DDI engine. The frontend audits accumulated ingredient/name entries to guide the prescriber, while POST /cpoe repeats the audit and rejects contraindicated pairs before any DB write. Unknown/unindexed data is represented as uncertainty and never as a clean safety result. Drafts remain drafts.

## Acceptance criteria
- The form can hold and display multiple medication items, each with its own prescribing fields.
- A contraindicated combination surfaces a clear alert and cannot be saved through either UI or direct API.
- A complete single-medication order remains permitted.
- Existing TT26 CPOE draft behavior and tests describe required clarification and explicit unsigned draft status.
