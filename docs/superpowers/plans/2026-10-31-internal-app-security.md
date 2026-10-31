# Internal App Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a production-only DevTools deterrent and establish boundaries for safely securing APIs.

**Architecture:** Load disable-devtool dynamically only in browser production builds. Preserve text selection and form editing, do not close or redirect pages. Use opt-in server-side PBKDF2 account verification with expiring HMAC sessions and a role policy; enable it after real account provisioning.

**Tech Stack:** React, Vite, TypeScript, FastAPI, pytest.

**Spec:** docs/superpowers/specs/2026-10-31-internal-app-security-design.md

## Global Constraints
- Never use seeded demo PINs as production credentials.
- Never place shared API secrets in frontend bundles.
- DevTools deterrence is not an authentication boundary.

## Review Focus
- Non-browser imports do not crash.
- Local development and tests do not trigger anti-debug behavior.
- Selection and paste remain available.
- Existing prompt-injection rails still work.
- Do not claim production auth readiness without account provisioning and server authorization.

---

### Task 1: Integrate production-only DevTools deterrent

**Files:**
- Modify: src/main.tsx
- Modify: package.json, package-lock.json

**Interfaces:** Dynamic-load only in a browser production build; standard detectors/context menu restriction; preserve selection/copy/paste; no redirect/close action.

- [ ] Add a focused test proving it is not loaded outside production/browser contexts.
- [ ] Run the test and verify the missing gate is detected.
- [ ] Implement loader and graceful error handling.
- [ ] Run targeted test, lint, and production build.

### Task 2: Server authentication boundary

**Files:** Review backend/app/main.py, backend/app/routers/*.py, backend/app/config.py, frontend API client.

- [x] Add PBKDF2 password verification, expiring signed sessions, origin checks, and role policy.
- [x] Add login UI and send credentials on same-origin API calls.
- [x] Run backend and frontend security checks.

### Task 3: Deployment readiness

- [x] Confirm no browser-bundled Gemini key is introduced.
- [x] Document production credential provisioning and environment setup.
- [ ] Enable and verify production auth after real accounts and secrets are provisioned.
