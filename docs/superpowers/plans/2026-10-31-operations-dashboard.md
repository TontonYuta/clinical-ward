# Operations Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make a role-aware operational overview the default page of Clinical Ward.

**Architecture:** Add an `overview` tab rendered by a focused `OperationsOverview` component, driven only by existing props/state and navigation callbacks. Add it to role tab permissions, sidebar/mobile navigation, and URL/local-storage persistence. Keep module operations inside their existing screens.

**Tech Stack:** React, TypeScript, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-10-31-operations-dashboard-design.md`

## Global Constraints
- Counts use existing in-memory state and must be labeled as demo/local when source freshness cannot be proven.
- No new DDI aggregate is invented; display only existing active review alerts if available.
- Existing module permission rules remain in force.

## Review Focus
- First-time users land on overview; saved deep links still work.
- Each role sees only allowed quick actions.
- Missing or empty data renders a calm empty state, not a false healthy signal.
- Cold-chain warning reflects configured thresholds and alarm state.
- Mobile overview avoids horizontal overflow.

---

### Task 1: Add Overview tab and navigation

**Files:** `src/types/auth.ts`, `src/utils/storage/appStatePersistence.ts`, `src/data/initialData.ts`, `src/components/Sidebar/SidebarNavLinks.tsx`, `src/components/Navigation/MobileBottomNav.tsx`, `src/components/RightPane/Dashboard.tsx`.

- [ ] Add `overview` tab, icon and localized label to desktop/mobile navigation.
- [ ] Add `overview` to roles and update default role tabs.
- [ ] Change no-hash/no-saved-tab default to `overview`, preserving valid saved tabs/hash links.
- [ ] Render overview component when selected, retaining existing module components.

### Task 2: Build actionable overview

**Files:** Create `src/components/RightPane/OperationsOverview.tsx`; modify `src/components/RightPane/Dashboard.tsx`, `src/App.tsx`.

- [ ] Add header, demo/local freshness note, priority list, summary cards and role-filtered quick actions.
- [ ] Derive counts from existing debts, batches, tickets, cold-chain state, assets and available audit data.
- [ ] Wire cards and quick actions to allowed existing tabs; no direct writes from overview.
- [ ] Ensure responsive layout and explicit empty/loading/unknown states.

### Task 3: Verification and review

- [ ] Run TypeScript lint and production build.
- [ ] Manually inspect changed tab/default/role behavior and `git diff --check`.
- [ ] Record remaining limitations where current data is fixture/local-only.
