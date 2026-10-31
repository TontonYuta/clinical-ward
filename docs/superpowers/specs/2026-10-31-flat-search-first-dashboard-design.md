# Flat Search-First Dashboard Design

## Intent
Make the app's first screen easier for clinicians to scan by removing the rounded card-heavy look and placing patient and medication search before operational alerts. Provide a single settings entry for text size and the current sign-in/session controls.

## Goals
- Use a flat, square-corner layout with clear separators and restrained color for important states.
- Put patient lookup and medication lookup at the top of the overview.
- Keep patient lookup restricted to roles allowed to access patient records; medication lookup remains available to clinical roles.
- Move adjustable font size to a visible Settings panel and apply it consistently throughout the app.
- Surface whether the app is in trial/demo mode or has an authenticated session, with logout when authenticated.
- Preserve existing module flows, role permissions, and auth behavior.

## Non-goals
- Change clinical or DDI algorithms, backend auth policy, or deployment settings.
- Add a new patient/medication search backend. Use the existing patient detail and medication safety/monograph flows.
- Remove all visual grouping; use square-edged sections and thin rules where needed for readability.

## Approaches
1. Keep rounded cards and only reorder sections: minimal change, but conflicts with the user's visual preference. Rejected.
2. Flat search-first overview with thin borders, dividers, and severity labels: selected because it reduces visual noise while keeping scan order clear.
3. Dense table-only landing page: compact but hides quick actions on mobile and is harder to scan. Rejected.

## Layout and behavior
- Header: title, role greeting, and trial/session status in plain inline text.
- First row: patient search and medication search, each with keyboard submit and clear label/helper text. Patient search opens existing patient detail; medication search opens existing medication safety/monograph view.
- Next: prioritized alerts as flat rows with severity marker, count, and action to open the existing module.
- Then: compact operational metrics and quick actions, all square-cornered or border-bottom separated.
- Settings: gear entry in the sidebar opens a panel with compact/standard/large text controls, current role/session state, and logout where authenticated. Demo mode clearly indicates role selection is simulated.

## Constraints and builder calls
- Reuse `getInitialFontScale` and `saveFontScale`; default to `large` as current helper specifies. Set root font size to 14/16/18px for compact/standard/large so rem-based app text scales consistently.
- Patient search is displayed only to doctor/nurse roles because patient endpoints are role restricted.
- Do not turn demo role selection into authentication. When auth is disabled, settings must label the session as trial mode.
- Keep existing deep links and operation dashboard behavior intact.

## Acceptance criteria
- Overview shows patient and medication search before warnings and metrics.
- The overview no longer uses rounded cards as its primary visual pattern.
- Search submits open existing patient or medication screens with the entered query.
- Settings changes persist across reload and visibly change application text size.
- Authenticated users can log out from Settings; demo mode is accurately labeled.
- Mobile layout remains readable without page-level horizontal overflow.
