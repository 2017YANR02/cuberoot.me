import { RECON_VIDEO_MAX_BYTES } from './recon-api';

const platformHosts = ['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'bilibili.com', 'b23.tv', 'douyin.com', 'tiktok.com'];

export class ReconVideoLinkError extends Error {
  constructor(readonly reason: 'invalid' | 'page' | 'type' | 'size') {
    super(reason);
  }
}

export async function readReconVideoLink(value: string, signal: AbortSignal): Promise<File> {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ReconVideoLinkError('invalid');
  }
  if (url.username || url.password ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && location.protocol === 'http:'))) {
    throw new ReconVideoLinkError('invalid');
  }
  if (platformHosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host))) {
    throw new ReconVideoLinkError('page');
  }

  const response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  const body = response.body;
  try {
    if (!response.ok || !body) throw new Error('Video unavailable');
    const type = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() ?? '';
    if (type === 'text/html' || type === 'application/xhtml+xml') throw new ReconVideoLinkError('page');
    if (type && type !== 'application/octet-stream' && !type.startsWith('video/')) {
      throw new ReconVideoLinkError('type');
    }
    if (Number(response.headers.get('Content-Length')) > RECON_VIDEO_MAX_BYTES) {
      throw new ReconVideoLinkError('size');
    }

    // Bound the actual bytes too, including chunked responses and compressed transfers.
    let received = 0;
    const limited = body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, stream) {
        received += chunk.byteLength;
        if (received > RECON_VIDEO_MAX_BYTES) throw new ReconVideoLinkError('size');
        stream.enqueue(chunk);
      },
    }));
    const blob = await new Response(limited).blob();
    if (!blob.size) throw new ReconVideoLinkError('type');
    const filename = new URL(response.url || url.href).pathname.split('/').pop() || 'video';
    return new File([blob], filename, { type: type.startsWith('video/') ? type : '' });
  } finally {
    if (body && !body.locked) void body.cancel().catch(() => {});
  }
}
