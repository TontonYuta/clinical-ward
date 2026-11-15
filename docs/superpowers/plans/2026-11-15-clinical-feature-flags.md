# Clinical Feature Flags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add centrally managed feature flags so Monitor can show/hide Clinical Ward tabs safely online and offline.

**Architecture:** Persist tab flags in a backend table and expose versioned admin endpoints. Clinical Ward loads flags once, caches them, and intersects enabled tabs with role permissions across all navigation/deep-link paths. Monitor adds a dedicated feature configuration tab.

**Tech Stack:** FastAPI, SQLAlchemy async, Pydantic, React, TypeScript, Vitest-style existing TS tests.

**Spec:** `docs/superpowers/specs/2026-11-15-clinical-feature-flags-design.md`

## Global Constraints

- Backend/database is the source of truth when reachable.
- Offline fallback uses the last valid cache and never widens role permissions.
- `overview` cannot be disabled.
- No clinical facts or operational data are introduced by this feature.

## Review Focus

- Stale update version must be rejected; test backend API.
- Offline frontend must retain last valid flags; test flag client.
- Disabled tab must be absent from desktop and mobile navigation; test effective tab helper.
- Deep-link/action navigation must fall back to an allowed tab; test routing helper.
- Empty/invalid server payload must not widen permissions; test normalization.

### Task 1: Backend feature flag model and API

**Files:** Create `backend/app/models/feature_flag.py`, modify `backend/app/models/__init__.py`, `backend/app/main.py`, `backend/app/routers/admin_monitoring.py`, `backend/app/schemas/admin_monitoring_schema.py`; test `backend/tests/test_feature_flags_api.py`.

- [ ] Write failing tests for default flags, update, stale version rejection, and overview invariant.
- [ ] Run focused tests and observe failure.
- [ ] Implement table, startup creation, schemas, repository helpers and versioned GET/PUT endpoints.
- [ ] Run focused tests to green.

### Task 2: Frontend flag client and effective permissions

**Files:** Create `src/services/featureFlags.ts`, modify `src/types/auth.ts`, `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/Navigation/MobileBottomNav.tsx`, `src/components/RightPane/Dashboard.tsx`; test `tests/test_feature_flags.ts`.

- [ ] Write failing tests for normalization, cache fallback and role intersection.
- [ ] Run tests and observe failure.
- [ ] Implement client/cache/effective-tab helper and thread effective tabs through navigation and deep-link checks.
- [ ] Run focused tests, TypeScript and build.

### Task 3: Monitor configuration UI

**Files:** Modify `admin-portal/src/types/admin.ts`, `admin-portal/src/services/adminApi.ts`, `admin-portal/src/App.tsx`, `admin-portal/src/components/AdminSidebar.tsx`; create `admin-portal/src/components/Tabs/FeatureFlagsTab.tsx`; test `admin-portal/src/...` with existing type/build checks.

- [ ] Add API types/client and a monitor tab with per-feature switches, save state and error handling.
- [ ] Preserve current monitor tabs and refresh behavior.
- [ ] Run admin TypeScript/build.

### Task 4: Verification and release

- [ ] Run focused backend/frontend tests, TypeScript and builds.
- [ ] Run `git diff --check`.
- [ ] Review disabled-tab deep links and offline fallback.
- [ ] Commit feature-flag changes.
- [ ] Deploy only after verification succeeds and report live health/commit.
