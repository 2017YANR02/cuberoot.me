import { ASSISTANT_OPENAI_RELAY_PATH, ASSISTANT_OPENAI_RESPONSES_PATH, ASSISTANT_OPENAI_BODY_BYTES, ASSISTANT_OPENAI_MAX_TOKENS, ASSISTANT_OPENAI_MODEL, verifyAssistantOpenAI } from '@cuberoot/shared/site-assistant-openai';

const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const fail = (status: number) => Response.json({ error: 'OpenAI relay unavailable' }, { status, headers: privateHeaders });

/** Only the authenticated, quota-limited API can sign model calls for eligible visitors. */
export async function relayAssistantOpenAI(request: Request, protocol: 'chat/completions' | 'responses'): Promise<Response> {
  const secret = process.env.SITE_ASSISTANT_OPENAI_RELAY_SECRET ?? '';
  const apiKey = process.env.OPENAI_API_KEY;
  // The standalone build is also deployed in Hangzhou: never call OpenAI there.
  if (process.env.VERCEL !== '1' || process.env.VERCEL_REGION !== 'iad1' || secret.length < 32 || !apiKey) return fail(503);
  const proof = request.headers.get('x-assistant-proof') ?? '';
  const country = request.headers.get('x-assistant-country') ?? '';
  if (!/^\d{10}\.[a-f0-9]{64}$/.test(proof)) return fail(403);
  if (Number(request.headers.get('content-length')) > ASSISTANT_OPENAI_BODY_BYTES) return fail(413);
  if (!request.body) return fail(400);
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let body = '', bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > ASSISTANT_OPENAI_BODY_BYTES) return fail(413);
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } catch { return fail(400); }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (!await verifyAssistantOpenAI(secret, country, body, proof, Date.now(), protocol === 'responses' ? ASSISTANT_OPENAI_RESPONSES_PATH : ASSISTANT_OPENAI_RELAY_PATH)) return fail(403);
  try {
    const input = JSON.parse(body);
    const tokens = protocol === 'responses' ? input.max_output_tokens : input.max_completion_tokens ?? input.max_tokens;
    if (input.model !== ASSISTANT_OPENAI_MODEL || input.store !== false || !Array.isArray(protocol === 'responses' ? input.input : input.messages)
      || !Number.isSafeInteger(tokens) || tokens < 1 || tokens > ASSISTANT_OPENAI_MAX_TOKENS) return fail(400);
    const response = await fetch(`https://api.openai.com/v1/${protocol}`, {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body, redirect: 'error', cache: 'no-store',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(170_000)]),
    });
    if (!response.ok) {
      // Log metadata only: never upstream messages, prompts, headers or credentials.
      console.warn(JSON.stringify({ event: 'assistant_openai_upstream_error', protocol, status: response.status, requestId: response.headers.get('x-request-id') }));
      await response.body?.cancel();
      return fail(response.status === 429 ? 429 : 502);
    }
    return new Response(response.body, { headers: { ...privateHeaders, 'Content-Type': response.headers.get('content-type') ?? 'application/json' } });
  } catch { return fail(502); }
}
