# Document Upload UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the PDF upload dialog with drag/drop, clear file feedback, compact metadata form and explicit processing status.

**Architecture:** Keep upload state and existing ingestion API in `DocumentsLibrary`; isolate file selection validation in a small model helper. Render the dialog near full screen on small viewports and centered on desktop.

**Tech Stack:** React, TypeScript, lucide-react, existing FastAPI upload API.

**Spec:** `docs/superpowers/specs/2026-11-14-document-upload-ux-design.md`

## Global Constraints
- Accept PDF files only.
- Preserve existing metadata and backend ingestion contract.
- Preserve the user's selected file and explain invalid selections.

## Review Focus
- A dragged non-PDF file is rejected and the user sees why.
- A file input change and drop both produce the same selected-file state.
- Empty selection does not submit.
- Upload error keeps dialog and metadata available for retry.
- Mobile dialog fits viewport and its content scrolls independently.

### Task 1: File selection validation

**Files:** Modify `src/components/Documents/documentsLibraryModel.ts`; Test `tests/test_documents_library_model.ts`

- [ ] Add failing tests for PDF/non-PDF file names and MIME fallback.
- [ ] Run the model test and confirm the new test fails.
- [ ] Add `isPdfFile(file: Pick<File, 'name' | 'type'>): boolean`; accept `.pdf` extension and PDF MIME, reject other explicit extensions/types.
- [ ] Run the model test and confirm pass.

### Task 2: Upload dialog interaction and layout

**Files:** Modify `src/components/Documents/DocumentsLibrary.tsx`; Test `tests/test_documents_library_ui_contract.ts`

- [ ] Add failing checks for dropzone text, selected file info, remove action, validation state and progress state.
- [ ] Run the UI contract test and confirm it fails.
- [ ] Implement drag/drop and file-picker selection through the shared validator; display filename and formatted size; allow clearing selection.
- [ ] Present compact metadata in responsive two-column desktop layout and single-column mobile layout; make modal nearly full-screen on mobile.
- [ ] Disable submission until a valid PDF and required metadata are provided; retain form values when upload fails; close/clear after success.
- [ ] Run UI contract test, `tsc --noEmit`, and `npm run build`.
