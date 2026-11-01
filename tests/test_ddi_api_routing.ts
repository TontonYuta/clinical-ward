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

    globalThis.fetch = async () => new Response(JSON.stringify({ has_interaction: false, source_status: 'none_found_in_checked_source', coverage_note: 'Chưa được lập chỉ mục; không khẳng định an toàn.', alert: null }), { status: 200 });
    const clear = await processClinicalAgentQueryAsync('Plavix tương tác với Nexium thế nào?', state);
    if (!clear.replyMessage.text.includes('không khẳng định phối hợp an toàn') && !clear.replyMessage.text.includes('không khẳng định an toàn')) throw new Error('Missing uncertainty wording');
    if (clear.replyMessage.text.includes('không tìm thấy tương tác chống chỉ định')) throw new Error('Unindexed pair was presented as a negative clinical conclusion');

    globalThis.fetch = async () => { throw new Error('offline'); };
    const offline = await processClinicalAgentQueryAsync('Plavix tương tác với Nexium thế nào?', state);
    if (!offline.replyMessage.text.includes('Chưa thể kết luận')) throw new Error('Network error was not distinguished');
    if (offline.replyMessage.text.includes('không thuộc danh mục')) throw new Error('Local fallback claimed there was no interaction');

    const underspecified = await processClinicalAgentQueryAsync('Tra cứu tương tác thuốc', state);
    if (!underspecified.replyMessage.text.includes('nêu tên hai thuốc')) throw new Error('Missing pair prompt');

    // Single-drug interaction question should not be mangled as a pair with interrogative words
    globalThis.fetch = async () => new Response(JSON.stringify({
      intent: 'MEDICATION_SAFETY_PROFILE',
      reply_text: '### Tương tác thuốc: Paracetamol\n\nThuốc uống chống đông máu...',
      legal_basis: 'Dược thư Quốc gia Việt Nam',
      answer_type: 'medication_field'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const singleDrug = await processClinicalAgentQueryAsync('Paracetamol có tương tác với thuốc nào không', state);
    if (!singleDrug.replyMessage.text.includes('Paracetamol')) throw new Error('Failed to resolve single-drug interaction lookup');
    if (singleDrug.replyMessage.text.includes('thuốc nào')) throw new Error('Mangled interrogative word into drug name');

    console.log('DDI API routing tests passed (backend result, no-match disclaimer, network failure, missing pair, single-drug interaction).');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
