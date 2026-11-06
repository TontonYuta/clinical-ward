# Clinical workspace implementation

Spec: ../specs/2026-11-05-clinical-workspace-design.md

1. Replace typography tokens, background and shared workspace primitives; rebuild shell/navigation with responsive geometry. Files: index.css, styles/workspace.css, components/ui, Sidebar*, MobileBottomNav, App, font scale model. Verify font model and browser layout (RED then GREEN).
2. Rebuild overview around actionable counts and concise lookup. Rebuild all three operational page headers, progressive filters, compact tables and mobile cards. Keep underlying records and detail callbacks. Verify four pages at 1440,1366,768,390,375px and search/navigation.
3. Unify dialog and assistant presentation, remove false audit success and unsafe patient fallback where surfaced. Verify real fail states and complete clinical detail/form access.
4. Run TypeScript, production build, existing suite and browser smoke; inspect screenshots. Fresh reviewer checks final diff. Fix important findings and reverify. No commit/push/deploy requested.

Baseline: lint/build pass. npm test fails at missing public/pdf/Thong_Tu_26_2025_TT_BYT_Ke_Don_Thuoc.pdf; unrelated missing bundled documents predate changes. Branch feat/clinical-workspace-redesign created to keep main untouched. Work stays in the shared checkout.

## Completion record

All four active pages rebuilt. Added shared workspace controls/tokens, original local SVG contour background and orbital CSS art, responsive navigation, compact list/table/card views, progressive filters, three prescription-detail groups, responsive drug lookup cards, and source-linked legal library. Unified dialog/assistant/loading presentation. Kept official A4 print styles and full prescription medication details.

Integrity repairs: unknown patient lookup no longer selects a different patient; overview lookup uses the App patient collection and stable IDs; unavailable audit shows an unavailable state; notification history no longer seeds another person's delivered messages; missing signature does not display signed; MAR starts unrecorded and explicitly identifies its session-only simulation. Expired vaccine lots are labeled expired instead of ready. These UI changes do not certify backend security, electronic signatures or regulatory compliance.

Fresh read-only review found three Important regressions: mobile log clipping, unsigned labels, and inaccessible clinical notes/batch schedules. All three were reproduced in failing tests, repaired in one pass, and verified. No Critical findings. Excluded existing backend behavior, missing bundled PDFs and unreachable restock flow from redesign scope.

Final verification on 2026-11-05:
- `npm run lint`: PASS.
- `npm run build`: PASS, main JS 770.36kB minified / 199.52kB gzip (baseline 843.34 / 210.56).
- `npm run test:workspace`: PASS (expiry/signature/temperature status and persisted font scale).
- `npm run test:ui`: PASS: four pages at 1440,1366,768,390,375px; mobile navigation and final temperature log reachability; search/detail; unavailable audit; patient identity; no fabricated MAR/history; full record notes/schedules/IDs; mobile composer validation, offline registry and legal library.
- Additional eight cases at large font18px, mobile375 and desktop1440: PASS.
- `npm test`: existing checks pass up to missing `public/pdf/Thong_Tu_26_2025_TT_BYT_Ke_Don_Thuoc.pdf`; the missing PDF failure is unchanged from baseline. The final voice/UI test was run separately and passed.
- `git diff --check`: PASS.

Preview: `npm run dev:web`, http://localhost:3000. Browser tests require that server and Playwright Chromium. Tests mock unavailable API responses and do not send real notifications or create server records. Screenshots and logs: `/tmp/clinical-workspace-redesign/`.

No commit, push, merge or deploy performed. Existing font scale choices remain persisted; compact/standard/large now map to15/16/18px, with standard as the default.

## User-directed follow-up

User subsequently authorized a second structure pass and requested UI UX Pro Max installation. Skill installed at /home/ubuntu/.codex/skills/ui-ux-pro-max, pinned upstream commit ccce51cba388476d4f403091ddb91636d5cd9fed. Follow-up delivered: one shared page header with portal actions, semantic severity colors, source-aware wide forms workspace and script-based duplicate-heading audit/report. See docs/audits/2026-11-05-ui-structure-review.md and design-system/clinical-ward/MASTER.md for final decisions and verification. Eight original document contents retained by fixed-time hash tests; no backend record writes during tests. Final lint/build/workspace/structure/UI checks pass. Full suite retains the preexisting missing-PDF failure.
