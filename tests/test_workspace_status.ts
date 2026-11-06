import assert from 'node:assert/strict';
import {
  expiryState,
  vaccineState,
  temperatureAlarm,
  prescriptionState,
} from '../src/components/ui/workspaceStatus';
const today = new Date('2026-11-05T10:00:00Z');
assert.equal(expiryState('08/2026', today), 'expired');
assert.equal(expiryState('05/11/2026', today), 'near');
assert.equal(expiryState('11/2026', today), 'near');
assert.equal(expiryState('12/2027', today), 'valid');
assert.equal(expiryState('31/02/2027', today), 'unknown');
assert.equal(expiryState('', today), 'unknown');
assert.equal(
  vaccineState({ expiryDate: '08/2026', status: 'ready' }, false, today).label,
  'Hết hạn',
);
assert.equal(
  vaccineState({ expiryDate: '12/2027', status: 'ready' }, true, today).label,
  'Biệt trữ',
);
assert.equal(
  vaccineState({ expiryDate: '12/2027', status: 'ready' }, false, today).label,
  'Theo dõi',
);
assert.equal(temperatureAlarm({ currentTemp: 1.5, alarmActive: false }), true);
assert.equal(temperatureAlarm({ currentTemp: 4.5, alarmActive: false }), false);

assert.equal(prescriptionState({ status: 'signed' }).label, 'Chưa có chữ ký');
assert.equal(
  prescriptionState({ status: 'signed', digitalSignature: 'stored-digest' }).label,
  'Đã ghi nhận ký',
);

console.log('workspace status checks passed');
