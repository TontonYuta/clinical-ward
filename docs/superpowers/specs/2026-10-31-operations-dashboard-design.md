# Operations Dashboard Design

## Intent
Help doctors and other hospital staff understand the most important current work as soon as they enter Clinical Ward, then open the correct existing workflow quickly.

## Goals
- Add an overview page as the default landing page.
- Put urgent items and actionable warnings before routine totals.
- Show summary cards for outstanding ward debts, near-expiry/low-stock batches, unresolved urgent equipment incidents, cold-chain state, prescription/DDI review, and recent audit activity when that data is available.
- Provide role-filtered quick actions that navigate to existing workflows.
- Preserve all current clinical modules and their access rules.
- Make the source and freshness of displayed data clear; do not imply simulated/local data is live hospital telemetry.

## Non-goals
- Replace existing module screens or alter clinical decision rules.
- Create new operational actions directly on the overview beyond navigation into existing workflows.
- Claim server freshness for data currently backed by fixtures or local state.

## Approaches
1. Add an overview tab using existing app state and navigate into existing modules — selected. This is the smallest coherent change and avoids duplicating workflow logic.
2. Build a new cross-module API endpoint. This would improve aggregation later, but the app has mixed local, fixture, and API data sources today and would enlarge backend scope.
3. Add a separate analytics/reporting dashboard. This would not help users find immediate tasks and would duplicate the existing modules.

## Layout and behavior
- The page opens with a concise greeting and a data freshness/status note.
- A prioritized action list appears first; critical temperature excursions, urgent unresolved tickets, pending medication debts, and low-stock/near-expiry items link to the relevant module.
- Summary cards follow, showing counts and status labels.
- A role-specific quick-action row only shows actions whose corresponding module is allowed for that role.
- A recent activity area shows audit records only where they are available to the current role; otherwise omit it.
- Desktop sidebar and mobile navigation both provide a clear “Tổng quan” destination.
- Existing tabs remain accessible and work unchanged.

## Constraints and builder calls
- The new tab must be included in existing URL/local-storage tab persistence and role access definitions.
- Counts come from current in-memory app state. Since some state is seeded or local-only, the interface must label it as demo/local unless the current source explicitly confirms a successful backend fetch.
- The DDI summary can only represent alerts produced by an existing prescription review flow; do not invent an aggregate DDI count from the drug catalog.

## Acceptance criteria
- First-time users without a saved tab or URL hash land on the overview.
- Existing deep links and saved module tabs continue to work.
- Users can reach their allowed modules from overview cards and quick actions.
- Role restrictions remain in force in the overview and module screens.
- On small screens, primary warnings and quick actions remain readable without horizontal scrolling.
