import { RECON_CAPTURE_CHUNK_BYTES, RECON_CAPTURE_MAX_VIDEO_BYTES } from '@cuberoot/shared/recon-capture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const CAPTURE = new RegExp(`^recon-captures/${UUID}$`, 'i');
const CAPTURE_WRITE = new RegExp(`^recon-captures/${UUID}/(?:complete|sync)$`, 'i');
const CAPTURE_VIDEO = new RegExp(`^recon-captures/${UUID}/video$`, 'i');
const DRIVE_UPLOAD = new RegExp(`^drive/uploads/${UUID}$`, 'i');
const JSON_BODY_LIMIT = 2_000_000;
const JSON_RESPONSE_LIMIT = 32 * 1024 * 1024;
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', Vary: 'Authorization', 'X-Content-Type-Options': 'nosniff' };
const REQUEST_HEADERS = ['authorization', 'content-type', 'upload-offset', 'upload-checksum', 'range', 'if-range', 'if-match', 'if-none-match', 'if-modified-since'];
const RESPONSE_HEADERS = ['content-type', 'content-disposition', 'content-range', 'accept-ranges', 'etag', 'last-modified', 'upload-offset', 'upload-length', 'upload-expires'];

function allowed(method: string, path: string): boolean {
  if (method === 'GET') return path === 'recon-captures' || path === 'recon-captures/status'
    || CAPTURE.test(path) || CAPTURE_VIDEO.test(path) || path === 'drive';
  if (method === 'POST') return path === 'recon-captures' || CAPTURE_WRITE.test(path) || path === 'drive/uploads';
  if (method === 'PATCH') return DRIVE_UPLOAD.test(path);
  return method === 'HEAD' && (CAPTURE_VIDEO.test(path) || DRIVE_UPLOAD.test(path));
}

function allowedQuery(url: URL, path: string): boolean {
  if (url.search.length > 2048) return false;
  const keys = path === 'recon-captures' ? ['sourceSolveId', 'status', 'offset', 'limit']
    : path === 'drive' ? ['parent', 'trash', 'members', 'all'] : [];
  const seen = new Set<string>();
  for (const key of url.searchParams.keys()) {
    if (!keys.includes(key) || seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

const failure = (error: string, status: number) => Response.json({ error }, { status, headers: PRIVATE_HEADERS });

/** A fixed, development-only bridge. It never retries against the production API. */
async function captureLocal(request: Request, context: { params: Promise<{ path?: string[] }> }): Promise<Response> {
  if (process.env.NODE_ENV !== 'development') return failure('Not found', 404);
  const path = ((await context.params).path ?? []).join('/');
  const url = new URL(request.url);
  if (!allowed(request.method, path) || !allowedQuery(url, path)) return failure('Not found', 404);
  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer \S+$/i.test(authorization) || authorization.length > 16_384) {
    return failure('Sign in to use video capture', 401);
  }
  // The browser sends an explicit bearer token. Never forward browser cookies,
  // admin keys, user-selected hosts, or cross-site requests to the local helper.
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return failure('Forbidden', 403);
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== request.headers.get('host')) return failure('Forbidden', 403);
    } catch { return failure('Forbidden', 403); }
  }

  const chunkUpload = request.method === 'PATCH';
  const requestLimit = chunkUpload ? RECON_CAPTURE_CHUNK_BYTES : JSON_BODY_LIMIT;
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > requestLimit)) {
    return failure('Capture request is too large', 413);
  }
  if (request.body && !request.headers.get('content-type')?.startsWith(
    chunkUpload ? 'application/offset+octet-stream' : 'application/json',
  )) return failure('Unsupported capture request type', 415);

  const controller = new AbortController();
  let timedOut = false;
  let oversized = false;
  const cancel = () => controller.abort();
  request.signal.addEventListener('abort', cancel, { once: true });
  if (request.signal.aborted) cancel();
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, CAPTURE_VIDEO.test(path) ? 300_000 : 120_000);
  const cleanup = () => { clearTimeout(timeout); request.signal.removeEventListener('abort', cancel); };
  let requestBytes = 0;
  const body = request.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, stream) {
      requestBytes += chunk.byteLength;
      if (requestBytes > requestLimit) {
        oversized = true;
        stream.error(new Error('Capture request is too large'));
        controller.abort();
        return;
      }
      stream.enqueue(chunk);
    },
  }));
  const headers = new Headers({ 'Accept-Encoding': 'identity' });
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  // Keep the target literal. Path segments have already passed the allowlist.
  const upstreamUrl = `http://127.0.0.1:3011/v1/${path}${url.search}`;
  try {
    const init: RequestInit & { duplex?: 'half' } = {
      method: request.method, headers, cache: 'no-store', redirect: 'error', signal: controller.signal,
      ...(body ? { body, duplex: 'half' as const } : {}),
    };
    const upstream = await fetch(upstreamUrl, init);
    const responseHeaders = new Headers(PRIVATE_HEADERS);
    for (const name of RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value !== null) responseHeaders.set(name, value);
    }
    const responseLimit = CAPTURE_VIDEO.test(path) ? RECON_CAPTURE_MAX_VIDEO_BYTES : JSON_RESPONSE_LIMIT;
    const length = upstream.headers.get('content-length');
    if (length && Number(length) > responseLimit) {
      await upstream.body?.cancel(); cleanup();
      return failure('Local video capture response is too large', 502);
    }
    // Fetch decodes compressed responses; preserve Content-Length only for identity.
    if (length && (!upstream.headers.get('content-encoding') || upstream.headers.get('content-encoding') === 'identity')) {
      responseHeaders.set('content-length', length);
    }
    if (!upstream.body || request.method === 'HEAD') {
      await upstream.body?.cancel(); cleanup();
      return new Response(null, { status: upstream.status, headers: responseHeaders });
    }
    const reader = upstream.body.getReader();
    let responseBytes = 0;
    const stream = new ReadableStream<Uint8Array>({
      async pull(output) {
        try {
          const next = await reader.read();
          if (next.done) { cleanup(); output.close(); return; }
          responseBytes += next.value.byteLength;
          if (responseBytes > responseLimit) {
            controller.abort();
            throw new Error('Local video capture response is too large');
          }
          output.enqueue(next.value);
        } catch (error) { cleanup(); output.error(error); }
      },
      async cancel(reason) {
        controller.abort(); cleanup();
        await reader.cancel(reason).catch(() => undefined);
      },
    });
    return new Response(stream, { status: upstream.status, headers: responseHeaders });
  } catch {
    cleanup();
    return failure(oversized ? 'Capture request is too large'
      : timedOut ? '本地视频采集服务超时 / Local video capture service timed out'
        : '本地视频采集服务不可用 / Local video capture service unavailable', oversized ? 413 : timedOut ? 504 : 503);
  }
}

// Explicitly handle every method so production always responds with 404.
export { captureLocal as GET, captureLocal as HEAD, captureLocal as POST, captureLocal as PATCH,
  captureLocal as PUT, captureLocal as DELETE, captureLocal as OPTIONS };
