// Local preview of prepare-music.ps1 output; media stays outside the repository.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

const MIME: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.lrc': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.flac': 'audio/flac', '.wav': 'audio/wav',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};

type Context = { params: Promise<{ slug: string[] }> };

export async function GET(request: Request, { params }: Context) {
  if (process.env.NODE_ENV !== 'development') return new Response(null, { status: 404 });
  const { slug } = await params;
  const relative = slug.join('/');
  // Only generated manifest and content-addressed assets; no inventory or source files.
  if (relative !== 'manifest.v1.json'
    && !/^(tracks\/[a-f0-9]{64}\.(mp3|m4a|flac|wav)|covers\/[a-f0-9]{64}\.(jpg|jpeg|png|webp)|lyrics\/[a-f0-9]{64}\.lrc)$/.test(relative)) {
    return new Response(null, { status: 404 });
  }
  const root = process.env.MUSIC_LIBRARY_ROOT || 'Z:/cuberoot-music-staging/library';
  const file = path.join(root, relative);
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return new Response(null, { status: 404 });
  const headers = new Headers({
    'Content-Type': MIME[path.extname(relative)],
    'Cache-Control': 'no-store',
    'Accept-Ranges': 'bytes',
  });
  let start = 0;
  let end = info.size - 1;
  const range = request.headers.get('range');
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match && (match[1] || match[2])) {
      start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
    }
    if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start)
      || !Number.isSafeInteger(end) || start > end || start >= info.size) {
      headers.set('Content-Range', `bytes */${info.size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set('Content-Range', `bytes ${start}-${end}/${info.size}`);
  }
  headers.set('Content-Length', String(Math.max(0, end - start + 1)));
  const body = request.method === 'HEAD' || info.size === 0 ? null
    : Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(body, { status: range ? 206 : 200, headers });
}

export const HEAD = GET;
