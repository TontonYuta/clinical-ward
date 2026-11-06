import assert from 'node:assert/strict';
import {handleCpoeIntent} from '../src/utils/nlp/intents/cpoeIntent';
for(const role of ['nurse','pharmacist','director','biomedical_engineer','unrecognized']) {
 for(const text of ['kê đơn','ke don','mo form ke don']) {
  const result=handleCpoeIntent(text,text,'',role);
  assert.ok(result.replyMessage?.text.includes('Từ chối quyền kê đơn'),`${role}/${text}: explicit doctor-only policy`);
  assert.equal(result.card,undefined);
 }
}
assert.ok(handleCpoeIntent('mở form kê đơn','mở form kê đơn','','doctor').card);
console.log('CPOE local intent role checks passed');
