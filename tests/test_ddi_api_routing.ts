import { processClinicalAgentQueryAsync } from '../src/utils/nlp/agentAsync';

const state = { debts: [], tickets: [], batches: [], coldChainState: { currentTemp: 4.5 }, assets: [] } as any;
const originalFetch = globalThis.fetch;

async function run() {
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      has_interaction: true,
      alert: {
        rule_id: 'catalog-1', severity: 'MAJOR', title: 'Backend DDI result',
        drug_a: 'Plavix', drug_b: 'Nexium', mechanism: 'mechanism',
        consequence: 'consequence', action: 'action', source: 'source'
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const hit = await processClinicalAgentQueryAsync('Plavix tương tác với Nexium thế nào?', state);
    if (!hit.replyMessage.text.includes('Backend DDI result')) throw new Error('Does not use backend DDI result');

    globalThis.fetch = async () => new Response(JSON.stringify({ has_interaction: false, alert: null }), { status: 200 });
    const clear = await processClinicalAgentQueryAsync('Plavix tương tác với Nexium thế nào?', state);
    if (!clear.replyMessage.text.includes('không khẳng định phối hợp an toàn')) throw new Error('Missing uncertainty wording');

    globalThis.fetch = async () => { throw new Error('offline'); };
    const offline = await processClinicalAgentQueryAsync('Plavix tương tác với Nexium thế nào?', state);
    if (!offline.replyMessage.text.includes('Chưa thể kết luận')) throw new Error('Network error was not distinguished');

    const underspecified = await processClinicalAgentQueryAsync('Tra cứu tương tác thuốc', state);
    if (!underspecified.replyMessage.text.includes('nêu rõ tên hai thuốc')) throw new Error('Missing pair prompt');

    console.log('DDI API routing tests passed (backend result, no-match disclaimer, network failure, missing pair).');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
