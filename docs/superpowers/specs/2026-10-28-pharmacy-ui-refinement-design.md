# Pharmacy UI refinement design

## Intent
Make the hospital pharmacy and national drug registry easier to scan by removing repeated copy and reducing competing colors and decorative badges, while preserving quick access to complete inventory and clinical lookup workflows.

## Goals
- Reduce the hospital pharmacy page heading to “Kho dược bệnh viện”.
- Give the registry modal a clear hierarchy: title and essential status, search, compact filters, result table, pagination.
- Use neutral surfaces and restrained selection/action colors; reserve saturated colors for meaningful alerts.
- Preserve existing data, filters, counts, verification, refresh, detail views, and navigation behavior.

## Non-goals
- No changes to registry data, search semantics, drug classification, or API behavior.
- No removal of useful group filters or inventory scope controls.

## Approach
Use selective simplification (chosen): retain quick lookup controls and group filters, but reduce repeated copy, nested surfaces, colorful chips, and decorative badges. Full simplification was considered but would hide commonly used filters behind extra steps.

## Implementation calls
- Keep the pharmacy heading concise; use no repeated subtitle there.
- In the registry modal, keep one title, a quiet source/count line, a single search row, neutral compact category tabs, and a restrained selected state.
- Keep verification, refresh, and hospital inventory scope accessible, but style them as secondary controls.
- Maintain responsive behavior and all existing test selectors where practical.

## Verification
Run the app build and use Playwright screenshots at desktop and mobile widths. Check that search, filters, scope toggle, verification, refresh, result list, and pagination remain available and functional.
