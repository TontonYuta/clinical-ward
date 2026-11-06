# Backend business logic audit — 2026-11-05

Reviewed the CPOE, patients, inventory, debts, equipment, assets, coldchain,
audit, and SMS routers, their schemas/models/services, and server authentication
middleware. Findings describe runtime behavior, not legal compliance conclusions.
The audit used isolated in-memory or temporary SQLite databases; it did not
write to the running development database or contact an SMS provider.

## Deeper cross-feature verification

The follow-up audit traced actual dispatch through cabinet quarantine and
authenticated audit attribution, rather than checking isolated flags alone.

| Severity | Confirmed scenario before the follow-up fix | Current behavior |
| --- | --- | --- |
| High | Vaxigrip inventory (`b-8`, registration `300310033526`, explicit cold-storage location) remained dispatchable while the cabinet state was quarantined. The database has no inherent batch-to-cabinet relation. | `inventory_coldchain_policy.py` requires an explicit administrative link from exact batch ID to existing cabinet state. Cold stock without a valid link is held; no cabinet is guessed from a name. Linked cabinet outage, quarantine, unsafe temperature/VVM/MKT, and missing state block dispatch. A SQL predicate rechecks cabinet eligibility inside the stock decrement. |
| High | Empty `GET /coldchain/status` created healthy 4.5°C state and 1,250 doses. An existing state with no telemetry returned six invented measurements. | Missing state returns 409 without creating rows. Empty telemetry remains `[]`. Responses expose the persisted cabinet `id`. Multiple states return 409 because the existing screen cannot select which cabinet an operation targets. |
| High | Inventory dispatch wrote a hardcoded pharmacist; proposal/release accepted a forged payload signer. Release asserted the claimed second person as an actual witness. | Audit actor comes from the authenticated server account (`account:<username>`, `AUTHENTICATED_SESSION`). Supplied names remain explicitly claimed metadata. A second witness is not recorded as authenticated; `dual_witness_verified:false`. Local unauthenticated demo operations explicitly use `UNVERIFIED_LOCAL`, without a fabricated professional certificate. |
| Medium | Restoring power when no outage existed added fabricated normal samples repeatedly, which could wash MKT down. Starting a new simulation reset VVM 4 to 1; repeating an ongoing outage replaced its exposure duration. | Restore requires an actual recorded outage and uses a conditional transition. An ongoing outage cannot be overwritten. Existing VVM damage is preserved; each separate simulated incident adds its simulated 12 minutes. |
| Medium | Cabinet history/MKT mixed samples from unrelated sensor IDs. Inserting newer `OTHER-SENSOR` readings at 99°C replaced the monitored cabinet's 4.5°C graph. | Both history and MKT filter the existing monitored simulation sensor `VAX-LOG-04`; unrelated sensor rows are excluded. This remains a single-cabinet simulator, not a hardware discovery mechanism. |
| Medium | Authenticated clinical users received 403 at active `/prescriptions/audit` and MCP POST endpoints because they were absent from the role allowlist. Pharmacist/director patient-workspace reads were also denied despite allowed CPOE reads. Equipment engineers could read clinical chat history. | Doctor/nurse/pharmacist/director can call existing clinical analysis/MCP endpoints and read CPOE/patient/advice workspaces. Engineer clinical-history reads are denied. Existing clinical write restrictions remain; patient/advice writes are still doctor/nurse operations. |
| Medium | Cabinet quantity 1,250 was unrelated to explicitly linked inventory stock (for example b-8 has 200 units). | Quantity is explicitly marked `quantity_basis:"recorded_cabinet_aggregate"`, `inventory_reconciled:false`; release audit labels it as an unreconciled cabinet record. No stock/unit conversion or reconciliation is invented. |

Administrative configuration is optional and defaults to no links:

```sh
COLDCHAIN_INVENTORY_LINKS_JSON='{"b-8":1}'
```

Only use a link after verifying the actual batch/cabinet assignment. The audit
configured this example only in isolated fixtures. Invalid JSON, non-object
values, booleans, nonpositive state IDs, absent cabinet state, and missing links
keep identified refrigerated stock held. `cold_storage_link_verified` means an
explicit configured link resolves to an existing logical state; it does not
prove a physical sensor connection or product viability. Cold-storage policy
uses explicit refrigerated category/location metadata and the repository's
verified exact Vaxigrip registration; it does not infer identity from fuzzy
drug names or establish storage rules for every national-catalog product.

Inventory responses add `cold_storage_required`, `cold_chain_state_id`,
`cold_storage_link_verified`, `cold_storage_unknown_reason`, `is_dispatchable`,
and `dispatch_hold_reason`. Reads do not alter physical batch quarantine.
Releasing a cabinet does not release an independent batch hold. Unrelated
room-temperature stock remains usable during a cold-cabinet incident.

An isolated authenticated API sequence verified these persisted outcomes:

| Step | Observed result |
| --- | --- |
| Dispatch cold stock without a link | 409, stock unchanged at 10 |
| Configure exact link; dispatch with healthy recorded cabinet | 200, stock 9 |
| Simulate outage; attempt cold dispatch | 409, stock remains 9 |
| Dispatch unrelated room-temperature stock during outage | 200, stock 10 → 9 |
| Restore power | Quarantine remains true |
| Release using actual recorded VVM/MKT confirmation | 200 |
| Dispatch linked cold stock after release | 200, stock 9 → 8 |
| Dispatch independently quarantined batch after cabinet release | 409, stock remains 10 and physical hold remains true |
| Inspect audit actors | Every event identifies `real.pharmacist`, not the forged payload actor |
| Delete cabinet; read status and attempt cold dispatch | Both 409; no state is synthesized |

Follow-up regressions were observed failing before their respective fixes:
5 missing-state/history/actor cases, 13 coldstock linkage cases, 5 clinical
endpoint/history authorization cases, 1 cabinet-identity case, 7 transition/
ambiguity cases, 3 role/quantity-basis cases, and 1 mixed-sensor case. The
latest focused command below passes **69 tests** (65 business cases plus 4
existing authentication cases). No full suite was run during the follow-up,
as requested by the main implementer.

## Fixed in this audit's inventory/coldchain/auth changes

| Severity | Finding and reproduction before the fix | Resolution and source |
| --- | --- | --- |
| High | A batch with stock 10 accepted dispatch `quantity:-4`, resulting in stock 14. Zero, booleans, and integer strings also entered the dispatch path. | Strict positive integer validation in `backend/app/schemas/inventory.py:4`. |
| High | Dispatch succeeded for an expired year-2000 batch and a quarantined batch. | Dispatch checks real calendar expiry and quarantine, and the conditional database update repeats eligibility conditions in `backend/app/routers/inventory.py`. |
| High | Two sessions loaded stock 10, each dispatched 7, and both succeeded while the database recorded only one decrement. | Availability check and decrement now occur in one conditional SQL update. Regression holds a stale object in the second session and confirms the second dispatch is rejected with only 3 units remaining. |
| High | Creating a restock proposal immediately changed stock 10 to 100 without receiving goods. At stock 150 / maximum 100, it silently destroyed 50 units. | Proposal records an audit event and requested quantities without changing stock. Response distinguishes `proposed_count` and `total_units_requested` from zero actual replenishment. Unknown selected batch IDs reject the whole proposal. |
| Medium | Stored `days_left` and expiry/stock flags became stale, so near-expiry filtering and badges disagreed with expiry dates/current stock. | Inventory response derives days remaining and near-expiry/low-stock flags at read time; no read changes stored inventory. |
| High | Quarantine release accepted an active 11°C outage with VVM 4 and caller confirmations VVM 4 / MKT 99; it cleared quarantine anyway. | Release requires quarantined state, restored power, current 2–8°C, recorded VVM 1, recorded MKT 2–<8°C, finite measurements, and confirmations matching the recorded values. Conditional update rejects state changed during review. See `backend/app/routers/coldchain.py:129`. |
| Medium | Release audit always stated 1,250 doses even when the state held 123. Coldchain mutations before status initialization crashed on `None`. | Audit uses actual recorded dose count; absent state returns 409. |
| Medium | Outage MKT selected the oldest unordered 20 readings and appended a new reading separately; restore left MKT stale. | Flush the new reading, then calculate from the latest 20 rows exactly once on both outage and restoration (`backend/app/routers/coldchain.py:14`). With old 1°C readings then twenty recent 7°C readings, outage now produces 7.25°C and restoration 6.89°C. |
| High | An authenticated equipment engineer could call `PUT /assets/a/liquidate`, despite the application's director-only liquidation policy. | Endpoint-specific director role check in `backend/app/security/auth.py:160`; engineer asset transfer remains allowed. |
| High | Equipment engineers could read full CPOE patient identifiers and SMS patient names/phones/content through default GET authorization. | CPOE and SMS logs restrict reads to doctor, nurse, pharmacist, and director in `backend/app/security/auth.py:136`. |
| High | Dispatch/release committed physical state before audit insertion; audit failure left the action committed while the HTTP request failed. | Inventory dispatch and quarantine release leave state pending for the existing audit service's common commit. Broader router transaction changes are owned by the main audit implementer. |

These coldchain checks enforce the application's existing simplified policy.
They do not establish vaccine viability, verify actual dual signatures, or
replace product-specific stability assessment. MKT uses equally weighted samples
because the existing telemetry model does not provide a complete elapsed-time
exposure history.

## Findings passed to the main audit implementer

These refer to the observed source during the audit. The main implementer is
changing these files concurrently; its final verification/report determines
their final disposition.

| Severity | Finding, location, evidence | Minimum correction / remaining limit |
| --- | --- | --- |
| High | `backend/app/services/audit_service.py`: three sequential events in the same second originally caused event 3 to link back to event 1 because `created_at DESC` had no tie-breaker. Integrity verification failed at `AUD-2026-0003`. | Main implementer added precise timestamps, deterministic ordering, UUID IDs, and metadata hashing. Existing already-forked historical chains require separate reconciliation; no development data was repaired. |
| High | Audit append remains a read-previous-hash then insert sequence. Recheck after the timestamp/UUID changes using three concurrent calls, each in a separate session against a temporary file SQLite database, still returned `is_valid:false` for three records. | Serialize append across selecting predecessor, inserting, and committing. A process-local lock alone does not protect multiple workers. This concurrency finding was sent directly to the main implementer. |
| High | `backend/app/routers/patients.py:76`: upsert loops over `payload.model_dump()`, including default values for omitted fields. A demographic update `{id,fullName,email}` replaced existing Penicillin allergy with “Không ghi nhận dị ứng” and eGFR 20 with 90 in an isolated reproduction. | Update only explicitly supplied fields (`exclude_unset=True`) or provide a separate explicit full-replacement contract. |
| High | Original patient detail fallback used `%query%` and selected the first match; requesting unknown ID `%` returned patient A. Ambiguous surnames could open the wrong record. | Main implementer changed fallback to exact normalized name and an ambiguity conflict. |
| High | CPOE POST accepted arbitrary `patientId` with unrelated patient name/CCCD because it did not read the patient profile. | Main implementer added profile existence and demographic matching. Drafts with an empty ID remain an explicit unlinked-draft case. |
| Medium | `backend/app/schemas/cpoe.py:62` originally skipped outpatient duration checking when `daysPrescribed` was negative, and arbitrary `prescriptionType` bypassed both branches. Item `durationDays` also accepted negative values. | Main implementer added prescription-type enum and duration bounds. |
| High | Original SMS code reported `delivered` for unsupported Twilio/SpeedSMS providers, missing eSMS credentials, and sandbox execution; actual delivery was never established. Credentials were posted to HTTP. | Main implementer changed unsupported/unconfigured providers to explicit errors, distinguished simulated/sent, and uses HTTPS. Provider accepted/sent status still requires a delivery callback before claiming handset delivery. |
| Medium | `backend/app/schemas/debt.py:8`: negative borrowing quantity is accepted; isolated schema construction with quantity -5 succeeded. | Require positive strict integers and nonempty essential identifiers. |
| Medium | `backend/app/routers/debts.py:42` and `backend/app/routers/equipment.py:42`: unique business codes use table row count + fixed offset. Concurrent requests can select the same count; noncontiguous/imported codes can also collide. | Use collision-safe identifier allocation or a database sequence with transaction-safe retries. |
| Medium | Debt settlement and equipment handover have no transition guard; repeated calls overwrite settled/resolved timestamps and actors and append new audit entries. | Explicit transition rules or idempotent replay preserving original completion data. |

## Verification

Regression file: `backend/tests/test_inventory_coldchain_invariants.py`.

1. First regression run: **23 failed, 1 passed**, demonstrating invalid quantity,
   unusable stock dispatch, stale stock consumption, proposal stock changes,
   unsafe release, missing state, incorrect dose audit, and liquidation permission.
2. CPOE read authorization regression: **1 failed** before the policy change.
3. Expiry/telemetry/SMS read regressions: **4 failed** before their changes.
4. Final focused command:

   ```sh
   /home/ubuntu/.venv/bin/python -m pytest backend/tests/test_inventory_coldchain_invariants.py backend/tests/test_auth_security.py -q --tb=short
   ```

   Initial pass: **33 passed** (29 business regressions and 4 existing authentication tests).
   After deeper follow-up: **69 passed** (65 business regressions and 4 existing authentication tests).
   Existing pytest-asyncio fixture-scope and Starlette/httpx deprecation warnings
   are unrelated to these fixes.

The main implementer owns final full-suite verification after all concurrent
changes finish. A separate full run was interrupted at its request after
**8 failed / 62 passed**; it used its own temporary SQLite DB. Failures observed:

- `test_api.py::test_inventory_fefo_and_restock`
- `test_api.py::test_cold_chain_outage_and_quarantine`
- `test_backend_security_guardrails.py::test_coldchain_telemetry_vs_emergency_intent`
- `test_backend_security_guardrails.py::test_out_of_database_knowledge_boundary`
- `test_backend_security_guardrails.py::test_chatbot_provenance_metadata_contract`
- `test_backend_security_guardrails.py::test_self_symptom_prompt_without_case_context_asks_for_clinical_case`
- `test_backend_security_guardrails.py::test_patient_fever_query_is_framed_as_clinician_reference`
- `test_chatbot_evaluation.py::test_chatbot_evaluation_fails_regression_instead_of_reporting_metrics_only`

The first two asserted the old workflow semantics and are assigned to the main
implementer for updates. Chatbot behavior is handled in the broader audit.

## Scope limits

No production provider, browser-to-backend end-to-end flow, PostgreSQL deployment,
multiworker load test, actual signing service, or real telemetry sensor was
exercised. Authentication remains deployment-configurable; the audit does not
claim role enforcement when `AUTH_REQUIRED` is disabled. Clinical dose decisions,
real drug availability, vaccine release criteria, and regulatory assertions
were not medically or legally validated by these software checks.

## Final integration disposition

Root implemented `AuditAppendLock` durable database serialization and verified six concurrent sessions without a fork. Patient updates now preserve omitted safety fields, CPOE validates linked identity and duplicate IDs, advice checks ownership before sending, and SMS distinguishes simulated/sent from delivery. Root also fixed registry seeding to honor a new explicit destination outside `/tmp`; the previous resolver silently chose the environment DB when the requested file did not yet exist. See the consolidated report for final suite counts; the pending-main table above records findings at discovery time.
