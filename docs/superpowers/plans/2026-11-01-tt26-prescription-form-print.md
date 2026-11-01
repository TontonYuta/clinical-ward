# TT26 Prescription Form and Print Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make outpatient prescription entry and A4 printing follow TT26 Appendix I, avoid fabricated patient/signature data, and render only the selected prescription when printing.

**Architecture:** Keep the existing CPOE modal and order type, extract testable validation and printable-document helpers, then make the detail modal render a dedicated print surface. Use the supplied TT26 PDF as primary authority and record only verifiable official Vietnamese references as supplementary layout evidence.

**Tech Stack:** React, TypeScript, existing CSS print rules, current test tooling.

**Spec:** `docs/superpowers/specs/2026-11-01-tt26-complete-prescribing-chatbot-reliability-design.md`

## Global Constraints

- Form is concise and structured; special N/H/oncology fields appear only when applicable.
- No fabricated patient, diagnosis, dosage, signature, national code, or integration status.
- A4 output follows TT26 Appendix I and excludes dashboard controls.
- Print does not imply approval or issue of a prescription.

## Review Focus

- Missing patient or prescription details: cannot save an apparently complete order. Test empty and partial forms.
- Multiple medications and long text: print all items without clipping. Test page-break and escaping behavior.
- Draft order: visible draft status and no fake signature. Test draft print content.
- Modal on non-overview tab: only the selected prescription prints. Test print surface isolation.
- Real official reference differs from supplied extraction: legal PDF remains authoritative. Document source provenance and avoid deriving extra legal constraints from hospital examples.

---

### Task 1: Record verified Vietnamese reference forms

**Files:**
- Create: `docs/references/prescription-forms-vietnam/README.md`
- Create: sourced documents only when public download and provenance are verifiable

- [ ] Search official Ministry/Department of Health and public hospital pages for outpatient prescription samples. Record URL, issuer, access date, and role (legal source vs layout reference).
- [ ] Compare samples against supplied TT26 Appendix I–III; explicitly state TT26 controls where samples differ.
- [ ] Run `git diff --check` on references and README.

### Task 2: Validate prescription draft data before save

**Files:**
- Create: `src/services/prescriptionValidation.ts`
- Modify: `src/components/RightPane/Tabs/CPOE/CpoeOrderModal.tsx`
- Test: `tests/prescription_validation.test.ts`

**Interfaces:** `validatePrescriptionDraft(draft): { errors: string[] }`; require patient name, diagnosis, at least one medication, medication name, dose, frequency, route, positive quantity, duration, and required outpatient identity/address fields when applicable.

- [ ] Add tests for valid draft and each missing essential field; confirm failing behavior.
- [ ] Run targeted test; observe expected failure.
- [ ] Implement pure validation and connect form errors to submit/inline messages.
- [ ] Remove hardcoded patient/date/diagnosis/medication/dose/signature fallbacks and fabricated ID values from this modal; use empty initial values.
- [ ] Run targeted tests and TypeScript check.

### Task 3: Build an isolated A4 prescription print surface

**Files:**
- Create: `src/components/RightPane/Tabs/CPOE/PrescriptionPrintDocument.tsx`
- Modify: `src/components/RightPane/Tabs/CPOE/CpoeOrderDetailModal.tsx`
- Modify: `src/index.css`
- Test: `tests/prescription_print_document.test.ts`

**Interfaces:** `PrescriptionPrintDocument({ order }): JSX.Element`; `formatPrescriptionQuantity(quantity, isNarcotic): string`.

- [ ] Test that print document contains Appendix I identity, diagnosis, every medication, directions, issue date, advice, contact/representative where present, and honest draft/signed state.
- [ ] Test quantities below 10 receive leading zero and N prescription quantity includes numeric plus words only where applicable.
- [ ] Implement a semantic A4 document with safe text rendering, page-break-safe medication rows, and draft watermark/label.
- [ ] Add print-only CSS to hide all app content except the dedicated document and reset modal transforms/overflow.
- [ ] Change print action to print selected order document only; keep browser print dialog and handle missing print target gracefully.
- [ ] Run targeted tests and print-preview/manual browser check if the app can be launched.

### Task 4: Verify whole feature and reconcile documentation

**Files:**
- Modify: tests for CPOE UI/print if existing harness supports it
- Modify: design/spec as needed to record implementation choices and known environment limits

- [ ] Run relevant prescription, CPOE, and print suites plus project build/typecheck.
- [ ] Run `git diff --check`; review all changed files for false claims and fabricated workflow state.
- [ ] Record unrelated/environment failures separately; do not claim unverified legal compliance.
