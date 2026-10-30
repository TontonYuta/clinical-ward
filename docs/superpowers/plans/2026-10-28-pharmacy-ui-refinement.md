# Pharmacy UI Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the hospital pharmacy and national drug registry calmer and easier to scan without removing lookup features.

**Architecture:** Refine existing React/Tailwind components only. Keep filtering and registry behavior intact; alter copy hierarchy, control surfaces, colors, spacing, and typography.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vite, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-28-pharmacy-ui-refinement-design.md`

## Global Constraints
- Preserve existing data, filters, counts, verification, refresh, detail views, and navigation behavior.
- Use neutral surfaces and restrained selection/action colors; reserve saturated colors for meaningful alerts.
- Maintain responsive desktop and mobile behavior.

## Review Focus
- Registry group filters remain selectable and preserve their query behavior.
- Search remains usable at narrow widths without horizontal page overflow.
- Warehouse scope switch preserves count and data behavior.
- Verification and refresh remain visible and operable.
- Modal result table and pagination remain accessible after reducing header height.

---

### Task 1: Simplify hospital pharmacy heading and controls

**Files:**
- Modify: `src/components/RightPane/Tabs/Pharmacy/PharmacyHeaderRibbon.tsx`

- [x] Remove repeated eyebrow and explanatory subtitle; keep one “Kho dược bệnh viện” heading.
- [x] Keep national registry and drug monograph actions, but use restrained neutral action styling.
- [x] Run build and Playwright at 1440px and 390px; save screenshots under `artifacts/ui/`.

### Task 2: Refine national registry modal hierarchy

**Files:**
- Modify: `src/components/Modals/NationalDrugRegistryModal.tsx`
- Modify: `src/components/Modals/NationalDrugRegistry/NationalDrugTabs.tsx`

- [x] Remove duplicate descriptive copy and reduce decorative colored/count badges in the title area.
- [x] Reorganize controls as a restrained search row and compact scope/category controls while preserving test IDs.
- [x] Use neutral tab states; keep meaningful alert colors in drug data rows only.
- [x] Run build and Playwright at desktop/mobile widths; verify search, scope, group filter, refresh, verification toggle, rows, pagination; save screenshots.

### Task 3: Final verification

**Files:** none

- [x] Review screenshots for text clipping, overflow, and visual hierarchy.
- [x] Run `npm run build`; report results and screenshots.
