/** A byte limit must be enforced while reading, including chunked requests. */
export class SessionRequestBodyError extends Error {
  constructor(readonly status: 400 | 413) {
    super(status === 413 ? 'body too large' : 'invalid JSON body');
  }
}

export async function readSessionJson(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new SessionRequestBodyError(413);
  const reader = request.body?.getReader();
  if (!reader) throw new SessionRequestBodyError(400);
  let bytes = 0;
  let text = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new SessionRequestBodyError(413);
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  try { return JSON.parse(text); }
  catch { throw new SessionRequestBodyError(400); }
}
