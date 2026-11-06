import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mockDemoAuth } from './helpers/mockDemoAuth.mjs';
import { mockClinicalReads } from './helpers/mockClinicalReads.mjs';

// UI integration only: record the actual request IDs; clinical replies are fixtures.
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  await mockDemoAuth(context);
  await mockClinicalReads(context);
  const requests = [];
  let release;
  await context.route('**/api/v1/copilot/chat', async route => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 2) await new Promise(resolve => { release = resolve; });
    await route.fulfill({ json: { intent: 'TEST_REPLY', reply_text: 'Test reply for session isolation.',
      answer_type: 'clarification', source_status: 'test_fixture', session_id: requests.at(-1).session_id } });
  });
  const page = await context.newPage();
  await page.goto(process.env.CHAT_TEST_URL || 'http://localhost:3000');
  await page.getByRole('button', { name: /Trợ lý AI/ }).click();
  const input = page.getByTestId('chat-input-field');
  const reset = page.getByTestId('chat-clear-btn');
  async function send(text) {
    await input.fill(text);
    const response = page.waitForResponse(r => r.url().endsWith('/copilot/chat') && r.request().method() === 'POST');
    await input.press('Enter');
    await response;
    await page.waitForFunction(() => !document.querySelector('[data-testid="chat-input-field"]').disabled);
    await page.getByTestId('chat-message-agent').filter({ hasText: 'Test reply for session isolation.' }).last().waitFor();
  }
  await send('Thông tin thuốc Concor');
  const firstSession = requests[0].session_id;
  assert.ok(firstSession);
  await reset.click();
  // Same text immediately after reset must be accepted, not swallowed by dedup.
  await input.fill('Thông tin thuốc Concor');
  const secondRequest = page.waitForRequest(r => r.url().endsWith('/copilot/chat') && r.method() === 'POST');
  await input.press('Enter');
  await secondRequest;
  await page.waitForFunction(() => document.querySelector('[data-testid="chat-input-field"]').disabled);
  assert.equal(requests.length, 2);
  assert.notEqual(requests[1].session_id, firstSession, 'new conversation must not inherit old server medication context');
  assert.equal(await reset.isDisabled(), true, 'cannot reset while an old response is in flight');
  release();
  await page.waitForFunction(() => !document.querySelector('[data-testid="chat-input-field"]').disabled);
  await send('Thuốc này có tương tác với Ibuprofen không?');
  assert.equal(requests[2].session_id, requests[1].session_id, 'follow-up keeps the new session');
  console.log('Chat session reset UI checks passed (mocked auth, reads and chat replies).');
} finally {
  await browser.close();
}
