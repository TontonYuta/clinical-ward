import type { DashboardTab } from '../../types/auth';

export function filterOverviewActions<T extends { tab: DashboardTab }>(actions: T[], allowedTabs: DashboardTab[]): T[] {
  return actions.filter((action) => allowedTabs.includes(action.tab));
}
