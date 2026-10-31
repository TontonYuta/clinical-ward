import assert from 'node:assert/strict';
import { filterOverviewActions } from '../src/components/RightPane/overviewModel';

const actions = [
  { tab: 'cpoe' as const, label: 'Kê đơn' },
  { tab: 'debt' as const, label: 'Sổ nợ' },
  { tab: 'fefo' as const, label: 'Kho dược' },
];
assert.deepEqual(filterOverviewActions(actions, ['overview', 'cpoe']), [actions[0]]);
console.log('operations overview role filtering checks passed');
