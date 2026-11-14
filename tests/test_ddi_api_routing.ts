import { strict as assert } from 'node:assert';
import { processClinicalAgentQueryAsync } from '../src/utils/nlp/agentAsync';

const state = { debts: [], tickets: [], batches: [], coldChainState: { currentTemp: 4.5 }, assets: [] } as any;
const originalFetch = globalThis.fetch;

async function run() {
  try {
    globalThis.fetch = async () => { throw new Error('offline'); };
    for (const query of ['Plavix tương tác với Nexium thế nào?', 'Tra cứu tương tác thuốc']) {
      const response = await processClinicalAgentQueryAsync(query, state);
      assert.match(response.replyMessage.text, /chưa được xử lý/);
      assert.equal(response.replyMessage.ragGrounded, false);
      assert.equal(response.replyMessage.answerType, 'unavailable');
      assert.equal(response.replyMessage.evidence?.length || 0, 0);
    }
    console.log('Offline chatbot behavior is safe: no clinical fallback or unsupported conclusion.');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
