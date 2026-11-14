import { strict as assert } from 'node:assert';
import { CopilotSseError, consumeCopilotSse } from '../src/utils/nlp/sseParser';
function byteStream(parts: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({ start(controller) { parts.forEach((part) => controller.enqueue(part)); controller.close(); } });
}
async function expectFailure(stream: ReadableStream<Uint8Array>) { await assert.rejects(() => consumeCopilotSse(stream), CopilotSseError); }
async function main() {
  const encoder = new TextEncoder();
  const bytes = encoder.encode('data: {"type":"token","content":"Chào"}\n\ndata: {"type":"done","response":{"reply_text":"Chào"}}\n\n');
  const unicodeStart = bytes.findIndex((byte) => byte >= 0xc0); const seen: string[] = [];
  const result = await consumeCopilotSse(byteStream([bytes.slice(0, unicodeStart + 1), bytes.slice(unicodeStart + 1, unicodeStart + 2), bytes.slice(unicodeStart + 2)]), (token) => seen.push(token));
  assert.equal(result.reply_text, 'Chào'); assert.deepEqual(seen, ['Chào']);
  const combined = encoder.encode('data: {"type":"token","content":"A"}\n\ndata: {"type":"token","content":"B"}\n\ndata: {"type":"done","response":{}}');
  assert.equal((await consumeCopilotSse(byteStream([combined]))).reply_text, 'AB');
  await expectFailure(byteStream([encoder.encode('data: {"type":"error","message":"failed"}\n\n')]));
  await expectFailure(byteStream([encoder.encode('data: {"type":"token","content":"partial"}\n\n')]));
  await expectFailure(byteStream([encoder.encode('data: {invalid}\n\ndata: {"type":"done","response":{}}\n\n')]));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
