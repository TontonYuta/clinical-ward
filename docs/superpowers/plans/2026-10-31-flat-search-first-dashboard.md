# Flat Search-First Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace rounded dashboard cards with a flat, search-first overview and expose app text-size/session controls in Settings.

**Architecture:** Add existing-flow patient and drug lookup controls to the overview. Use root rem font scaling persisted by existing helpers. Replace role footer logout-only interaction with a Settings dialog that owns scale selection and reports demo/auth session state. Preserve module navigation and permissions.

**Tech Stack:** React, TypeScript, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-10-31-flat-search-first-dashboard-design.md`

## Global Constraints
- Reuse existing patient detail and medication safety/monograph flows.
- Patient search is shown only to doctor and nurse roles.
- Demo mode must not be represented as authenticated.
- Font scale values are compact=14px, standard=16px, large=18px; default remains large.

## Review Focus
- Patient search doesn't expose patient workflow to unauthorized roles.
- Empty and unmatched searches provide understandable feedback without false results.
- Text size is persisted and applies to the full app.
- Settings can close by button and Escape and has accessible labels.
- Mobile search rows and flat alert lists fit narrow viewports.

---

### Task 1: Search-first flat overview

**Files:** `src/components/RightPane/OperationsOverview.tsx`, `src/components/RightPane/Dashboard.tsx`, `src/App.tsx`, tests under `tests/`.

- [ ] Add failing tests for patient role visibility and search normalization/empty query.
- [ ] Add patient and medication lookup fields before alert list; patient opens existing patient detail event, medication calls existing safety modal.
- [ ] Replace rounded cards with square-edged, rule-separated summary and alert rows.
- [ ] Run targeted tests and lint.

### Task 2: Settings and application text scale

**Files:** Create `src/components/Settings/SettingsModal.tsx`; modify `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/Sidebar/SidebarFooter.tsx`, `src/utils/storage/appStatePersistence.ts`; tests under `tests/`.

- [ ] Add tests for scale persistence/default values and accessible Settings visibility behavior.
- [ ] Add compact/standard/large controls wired to `getInitialFontScale` and `saveFontScale`; set root font size to 14/16/18px.
- [ ] Add a sidebar Settings control, expose authenticated/demo state, and route authenticated logout through existing callback.
- [ ] Remove role switch from authenticated UI while preserving demo role switching when auth is disabled.
- [ ] Run targeted tests and lint.

### Task 3: Verification

- [ ] Run `npm test`, `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Inspect desktop/mobile layout and role conditions in code; record any visual check limitation.
