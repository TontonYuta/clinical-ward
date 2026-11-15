# Pharmacy Inventory and Cold Chain Domain Separation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Separate pharmacy inventory and cold-chain behavior into independent domains so each can evolve and integrate with external systems without changing the other.

**Architecture:** Add \`backend/app/domains/pharmacy_inventory\` and \`backend/app/domains/cold_chain\` with domain-owned schemas, repositories, services, and chatbot tools. Existing routers and workflow dispatchers remain compatibility adapters and delegate to those APIs. Reuse current SQLAlchemy models and tables; no schema migration is in this refactor.

**Tech Stack:** Python, FastAPI, Pydantic, SQLAlchemy async, pytest.

**Spec:** User approved full domain separation (approach 2) on 2026-11-15. Pharmacy inventory and cold-chain responsibilities must be independent, future linking must use explicit identifiers, and missing data must not be fabricated.

## Global Constraints

- Medication and operational claims must come from database records or be reported unavailable.
- Never synthesize sensor readings, stock, batch, location, thresholds, or status when source records are absent.
- Preserve existing API paths and response contracts during this refactor.
- Do not modify deployment configuration or deploy.
- Preserve existing SQLAlchemy schema and seed data; migrations and sample-data cleanup are separate work.
- Link cold-chain \`sensor_id\` to inventory \`batch_id\` only through an explicit persisted relationship; never infer it from names.

## Review Focus

- Missing cold-chain state → unavailable, with no normal-status card; test in Task 2.
- Partial cold-chain state → do not make overall safety claims; test in Task 2.
- Missing inventory match → unavailable, not zero stock or a guessed batch; test in Task 3.
- Same product in multiple batches/locations → preserve distinct identities; test in Task 3.
- Cross-domain query → route only to the selected domain; test in Task 5.

---

## Planned File Structure

\`\`\`text
backend/app/domains/
├── cold_chain/
│   ├── __init__.py
│   ├── schemas.py       # Typed cold-chain query/result contracts
│   ├── repository.py    # Queries over ColdChainCurrentState/Telemetry
│   ├── service.py       # Cold-chain status and incident rules
│   └── tools.py         # Copilot response adapters
└── pharmacy_inventory/
    ├── __init__.py
    ├── schemas.py       # Typed batch/stock result contracts
    ├── repository.py    # Queries over InventoryBatch and related models
    ├── service.py       # Inventory, FEFO, restock and batch selection
    └── tools.py         # Copilot response adapters
\`\`\`

## Task 1: Cold-chain data contracts and repository

**Files:** Create \`backend/app/domains/__init__.py\`, \`backend/app/domains/cold_chain/{__init__,schemas,repository}.py\`; test \`backend/tests/test_cold_chain_domain.py\`.

**Interfaces:** \`ColdChainSnapshot\` has optional persisted measurement/status fields and source identifiers. \`ColdChainRepository.get_current_snapshot(db: AsyncSession) -> ColdChainSnapshot | None\`. \`list_recent_telemetry(db, limit: int) -> list[ColdChainTelemetryRecord]\`.

- [ ] Write tests with real isolated DB records: missing state returns None; existing state maps persisted values; telemetry is newest-first and respects limit.
- [ ] Run \`.venv/bin/pytest -q backend/tests/test_cold_chain_domain.py\`; verify expected failures because module/API is absent.
- [ ] Implement schemas and repository using current SQLAlchemy models, without fallbacks.
- [ ] Run the focused test; expect all pass.

## Task 2: Cold-chain service and adapters

**Files:** Create \`backend/app/domains/cold_chain/{service,tools}.py\`; modify \`backend/app/services/scenarios/case_coldchain_telemetry.py\`, \`backend/app/services/chatbot/agentic_tools.py\`, \`backend/app/services/copilot_intents_info.py\`, \`backend/app/routers/coldchain.py\`, and \`backend/app/security/output_guardrail.py\`; extend cold-chain and API tests.

**Interfaces:** \`ColdChainService.get_status(db) -> ColdChainStatusResult\`; \`get_recent_telemetry(db, limit) -> list[ColdChainTelemetryRecord]\`; \`ColdChainTools.status_response(db) -> CopilotResponse\`. Legacy routes/functions keep their public signatures and delegate.

- [ ] Add tests for missing, partial, normal, outage, and quarantined records; only return an overall normal status when required stored fields support it.
- [ ] Run focused tests and verify missing/partial cases fail under current behavior.
- [ ] Move reads and status mapping to the cold-chain domain; leave thin adapters at old entrypoints.
- [ ] Remove guardrail response substitution containing sample readings.
- [ ] Run cold-chain domain, guardrail, and API tests.

## Task 3: Pharmacy-inventory data contracts and repository/service

**Files:** Create \`backend/app/domains/pharmacy_inventory/{__init__,schemas,repository,service}.py\`; test \`backend/tests/test_pharmacy_inventory_domain.py\`.

**Interfaces:** \`InventoryBatchRecord\` carries persisted item, batch, location, quantity, unit, expiry, and source identifiers. \`PharmacyInventoryRepository.find_batches(db, *, item_id: str | None, query: str | None) -> list[InventoryBatchRecord]\`. \`PharmacyInventoryService.get_stock(item_id, db) -> InventoryStockResult\`. \`get_fefo_candidates(db, *, within_days: int) -> list[InventoryBatchRecord]\`.

- [ ] Add tests with multiple batches/locations/expiry dates and missing matches; assert rows remain distinct and missing data is not coerced to zero.
- [ ] Run the focused test and verify expected failures because the domain APIs are absent.
- [ ] Move existing inventory query/filter rules into repository/service without changing their meaning.
- [ ] Run focused domain tests.

## Task 4: Inventory tools and routing adapters

**Files:** Create \`backend/app/domains/pharmacy_inventory/tools.py\`; modify \`backend/app/services/chatbot/agentic_tools.py\`, \`backend/app/services/chatbot/hospital_business_dispatcher.py\`, and inventory scenarios/callers located by call-site search; test domain tools, \`test_agentic_tools_db.py\`, and \`test_hospital_inventory_audit.py\`.

**Interfaces:** \`PharmacyInventoryTools.execute_stock_lookup(...) -> CopilotResponse\`, \`execute_fefo(...) -> CopilotResponse\`, and \`execute_restock(...) -> CopilotResponse\`. Existing public function names remain thin wrappers until callers migrate.

- [ ] Add response tests asserting inventory results come from selected batch rows and include no cold-chain fields.
- [ ] Run focused tests and verify new entrypoints fail before implementation.
- [ ] Move inventory response assembly/dispatch into the domain; keep shared dispatcher limited to domain selection.
- [ ] Run inventory tool, audit, and route inventory tests.

## Task 5: Cross-domain isolation and compatibility verification

**Files:** Migrate remaining legacy call sites found by \`rg\`; modify \`backend/app/services/copilot_gemini.py\` to load cold-chain context only for relevant queries and never synthesize a reading; add tests to \`test_copilot_workflow_route_inventory.py\`, \`test_backend_security_guardrails.py\`, and \`test_api.py\`.

- [ ] Add routing tests proving inventory calls inventory only, cold-chain calls cold-chain only, unrelated prompts load neither operational context.
- [ ] Run tests and verify current coupled code fails these assertions.
- [ ] Remove domain reads from general chatbot paths; retain explicit compatibility adapters only.
- [ ] Run full backend tests, frontend lint/build, and \`git diff --check\`; document pre-existing unrelated failures by name without weakening domain assertions.
- [ ] Inspect diff for fabricated operational values, unintended schema changes, and deployment edits.

## Completion Criteria

- Each domain owns its schemas, repository, service, and copilot adapters.
- Shared workflow code only selects a domain and forwards requests.
- Missing or incomplete records never produce fabricated values or unsupported status conclusions.
- Existing routes and response shapes remain compatible.
- Focused tests pass; full-suite status is recorded; no deployment occurs.

