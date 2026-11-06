# Whole-repository logic audit and stabilization

Goal: audit each exposed feature across UI, API, persistence and permissions; fix confirmed high-impact defects; publish all authorized workspace work on a new branch.

Scope: overview/patient identity, CPOE and prescription documents, inventory/FEFO/restock, cold chain, administrative forms, notifications, authentication/audit, assistant/DDI/registry; inspect disabled debt/equipment/assets separately.

Constraints: preserve existing redesign; use isolated test databases; never infer legal compliance from a passing test; never send real notifications; do not publish secrets or local clinical databases.

- [x] Restart UI/API and verify direct/proxied health.
- [x] Establish full frontend/backend test baselines and inventory feature routes.
- [x] Review independent UI, backend and assistant domains; reproduce findings with file/line evidence.
- [x] Add failing regression tests before confirmed fixes; prioritize incorrect stock, wrong patient, false success, unsafe transitions and privilege bypass.
- [x] Run regressions, lint, build, existing suites and an independent final review.
- [x] Save Vietnamese audit report with feature matrix, severity, reproduction, fixed/open status and explicit limits.
- [x] Commit reviewed files, push the already created branch to origin and verify remote commit.

Review focus: negative/zero quantities; stale/empty API responses; repeated or concurrent writes; active cold-chain alarms/quarantine; role mismatch; assistant unknown/ambiguous patient or drug; error paths that claim success.

## Additional user direction: hands-on depth over speed

The user explicitly requested per-feature manual verification with certainty. Continue the existing audit before committing/pushing.

- [x] Use an isolated full-stack copy (UI3001/API8001), with original server3000/API8000 kept running.
- [x] Sanitize snapshot contacts; external providers disabled. A localhost HTTP notification sink is used only to inspect actual request payloads.
- [x] Patient/CPOE: choose actual API patients, save draft, inspect database/API, reload, verify notes/route/unit/identity and print.
- [x] Inventory/coldchain: explicit cabinet/batch mapping, actual API writes, rejected invalid transitions, reload and stock conservation.
- [x] Forms: inspect all eight previews and printed content, source selection, no invented identity/facts/legal defaults.
- [x] Advice/notifications: inspect actual payload, failed-provider and partial-send paths, no duplicate side effects on retry.
- [x] Assistant/registry: manually probe named drug, symptom and follow-up context; inspect exact sources and abstention behavior.
- [x] Auth/audit: full enabled-role API matrix, identity attribution, cancel/retry, ledger transaction consistency.
- [x] Capture screenshots and per-scenario report; run final frontend/fullbackend checks and post-review regression subsets.
- [x] Record final counts/limits and scoped final context-review delta.

Final validation must report known failing clinical-source/legacy-contract checks explicitly; an audit branch is not certification of deployment readiness.
