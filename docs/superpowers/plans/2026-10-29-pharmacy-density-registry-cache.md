# Kho Dược Density and Registry Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tighten spacing across clinical tabs, simplify the pharmacy list, and make registry hospital-stock values accurate and fast to revisit.

**Architecture:** Keep registry pagination, but have the backend return inventory aggregates matched by normalized registration number and apply the in-hospital filter before pagination. Cache pages in the frontend with explicit registry and inventory revisions; show cached pages immediately and revalidate before treating them as current. Keep UI spacing changes selective so text size remains readable.

**Tech Stack:** React, TypeScript, Tailwind CSS, FastAPI, SQLAlchemy async, SQLite, Playwright.

**Spec:** docs/superpowers/specs/2026-10-29-pharmacy-density-and-registry-cache-design.md

## Global Constraints
- Match hospital inventory to registry drugs only by normalized registration number.
- Never infer a registration number from drug name or fuzzy text matching.
- Inventory totals may only be summed when units match; different units remain separate and visible.
- The backend database is authoritative; a cached page is current only after its revisions match the database.
- Keep default typography at the existing readable scale.

## Review Focus
- Registration number formatting variations: normalize before matching.
- Duplicate batches: aggregate same-unit quantities across the entire inventory.
- Same SĐK with incompatible units: preserve separate totals and avoid invalid arithmetic.
- Inventory changes while modal is open: revision changes and cache revalidation.
- Empty/filter result: counts and pagination remain valid.

---

## File Map
- backend/app/routers/registry.py: registry pagination, inventory aggregation, filter counts, revisions.
- backend/app/routers/inventory.py: exact inventory revision strategy for stock mutations.
- backend/app/models/inventory.py: revision support only if needed.
- backend/app/schemas/registry.py: typed stock aggregate and revision fields.
- src/services/api.ts: API query and response contract.
- src/components/Modals/NationalDrugRegistryModal.tsx: revision-aware cache, remove frontend-only stock joining.
- src/components/Modals/NationalDrugRegistry/NationalDrugTableRow.tsx: render unit-specific stock totals.
- Pharmacy row/card/header/table components and Dashboard/tab/card components: spacing and requested UI simplification.
- tests/ and backend/tests/: regression coverage.

## Task 1: Exact Inventory and Registry Revisions

**Files:** backend/app/routers/registry.py, backend/app/routers/inventory.py, backend/app/schemas/registry.py, backend/tests/test_registry_inventory.py.

**Interfaces:** Registry response adds inventory_revision, registry_revision, hospital_stock_drug_count, and per-item hospital_stock_by_unit list of unit/quantity/batch_count. Query accepts only_in_warehouse.

- [x] Add tests for normalized SĐK matching, same-unit aggregation, incompatible-unit separation, filter-before-pagination, and inventory revision changes.
- [x] Added backend regression cases; runtime collection is unavailable because pytest-asyncio is missing.
- [x] Compute deterministic content revisions from canonical data, not second-resolution timestamps alone.
- [x] Aggregate on normalized registration number and apply warehouse filtering before pagination; retain per-unit values without adding unlike units.
- [x] Static review completed; runtime backend check needs pytest-asyncio.

## Task 2: Accurate Backend Stock in Registry UI

**Files:** src/services/api.ts, src/components/Modals/NationalDrugRegistryModal.tsx, src/components/Modals/NationalDrugRegistry/NationalDrugTableRow.tsx, tests/test_national_registry_stock.ts.

**Interfaces:** API accepts onlyInWarehouse and returns revisions and stock aggregates; modal consumes aggregates and no longer joins current-page inventory locally.

- [x] Add regression assertions for warehouse-only filtering, unit-separated rows, exact registration matching, and offline behavior.
- [x] Review confirms filter is applied to all registry rows before pagination.
- [x] Wire backend response and render unit-separated totals/counts.
- [x] Mark offline fallback clearly and do not claim exact/current inventory when backend is unavailable; do not mix offline registry rows with unverified stock.
- [x] API query wiring and pagination reviewed; backend runtime check needs pytest-asyncio.

## Task 3: Revision-Aware Immediate Cache

**Files:** create src/utils/storage/registryPageCache.ts; modify src/components/Modals/NationalDrugRegistryModal.tsx; test tests/test_registry_page_cache.ts.

**Interfaces:** Key contains normalized search, group, pharmacological group, page, page size, and warehouse-only state. Value contains response payload and registry/inventory revisions.

- [x] Test immediate read, matching/mismatching revisions, and query separation.
- [x] Cache tests cover canonicalized search and query separation.
- [x] Show matching query cache immediately and revalidate; replace if revision changed; label validation pending.
- [x] On connection failure, keep cached content visible and clearly report that fresh data could not be loaded; never claim freshness without a database revision check.
- [x] Added backend revision-change regression case; runtime collection is unavailable because pytest-asyncio is missing.

## Task 4: Compact Pharmacy UI

**Files:** pharmacy row/card/header/table components, Dashboard.tsx, tab/card components with excessive padding/gaps.
- [ ] Capture desktop/mobile baseline and identify largest repeated gaps.
- [ ] Reduce container padding, table row padding, card padding, and gaps one step without reducing typography.
- [x] Split stock and location into separate pharmacy columns; remove Xuất actions from list rows/cards; keep detail selection.
- [x] Dược thư header action removed; medication name retains detail selection.
- [x] Desktop/mobile components reviewed; location shown separately from stock.

## Task 5: Final Verification
- [x] Frontend cache, registry, and drug-detail regression scripts pass; Python modules compile. Backend API tests need pytest-asyncio.
- [x] npm run lint, npm run build, and git diff --check pass.
- [ ] Inspect fresh desktop/mobile screenshots.
- [ ] Compare totals with a direct database aggregate and run revision mutation test after installing pytest-asyncio.
