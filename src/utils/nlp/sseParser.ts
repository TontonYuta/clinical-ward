export type CopilotSseEvent =
  | { type: 'token'; content: string }
  | { type: 'done'; response: Record<string, any> }
  | { type: 'error'; message?: string };

export class CopilotSseError extends Error {
  constructor(message: string) { super(message); this.name = 'CopilotSseError'; }
}

function parseFrame(frame: string): CopilotSseEvent | null {
  const data = frame.split(String.fromCharCode(10)).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).replace(/^ /, '')).join(String.fromCharCode(10));
  if (!data) return null;
  let event: CopilotSseEvent;
  try { event = JSON.parse(data) as CopilotSseEvent; } catch { throw new CopilotSseError('Malformed SSE data event'); }
  if (!event || typeof event !== 'object' || !['token', 'done', 'error'].includes(event.type)) throw new CopilotSseError('Unsupported SSE event');
  if (event.type === 'token' && typeof event.content !== 'string') throw new CopilotSseError('Malformed SSE token event');
  if (event.type === 'done' && (!event.response || typeof event.response !== 'object')) throw new CopilotSseError('Malformed SSE done event');
  return event;
}

export async function consumeCopilotSse(stream: ReadableStream<Uint8Array>, onToken?: (token: string, currentFullText: string) => void): Promise<Record<string, any>> {
  const reader = stream.getReader(); const decoder = new TextDecoder('utf-8'); const lf = String.fromCharCode(10); const delimiterText = lf + lf;
  let buffer = ''; let accumulatedText = ''; let finalResponse: Record<string, any> | null = null; let terminalSeen = false;
  const processFrame = (frame: string) => {
    const event = parseFrame(frame); if (!event) return;
    if (terminalSeen) throw new CopilotSseError('SSE event received after terminal event');
    if (event.type === 'token') { accumulatedText += event.content; onToken?.(event.content, accumulatedText); }
    else if (event.type === 'done') { terminalSeen = true; finalResponse = event.response; }
    else { terminalSeen = true; throw new CopilotSseError(event.message || 'Copilot stream failed'); }
  };
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true }); let delimiter: number;
      while ((delimiter = buffer.indexOf(delimiterText)) >= 0) { processFrame(buffer.slice(0, delimiter)); buffer = buffer.slice(delimiter + delimiterText.length); }
    }
    buffer += decoder.decode(); if (buffer.trim()) processFrame(buffer);
    if (!terminalSeen || !finalResponse) throw new CopilotSseError('Copilot stream ended without a done event');
    if (!finalResponse.reply_text && accumulatedText) finalResponse.reply_text = accumulatedText;
    return finalResponse;
  } catch (error) { try { await reader.cancel(); } catch { /* stream may already be closed */ } throw error; }
  finally { reader.releaseLock(); }
}
