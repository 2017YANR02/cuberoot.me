import { createHmac, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Context } from 'hono';
import { storedVideoResponse } from '../utils/video_upload.js';
import { PlatformApiError, notFound } from './errors.js';

const TOKEN_TTL_SECONDS = 5 * 60;

function signingSecret(): Buffer {
  const value = process.env.PLATFORM_MEDIA_SIGNING_SECRET?.trim();
  if (!value || Buffer.byteLength(value, 'utf8') < 32) {
    throw new PlatformApiError('SERVICE_UNAVAILABLE', 503, 'Platform media signing is not configured');
  }
  return Buffer.from(value, 'utf8');
}

function signature(message: string): string {
  return createHmac('sha256', signingSecret()).update(message, 'utf8').digest('base64url');
}

export function createPlatformMediaToken(input: {
  mediaId: string;
  binding: string;
  nowSeconds?: number;
}): { token: string; expiresAt: string } {
  const expires = Math.floor(input.nowSeconds ?? Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const message = `${input.mediaId}.${input.binding}.${expires}`;
  return {
    token: `${expires}.${signature(message)}`,
    expiresAt: new Date(expires * 1000).toISOString(),
  };
}

export function verifyPlatformMediaToken(input: {
  token: string;
  mediaId: string;
  binding: string;
  nowSeconds?: number;
}): boolean {
  const match = /^(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(input.token);
  if (!match) return false;
  const expires = Number(match[1]);
  const now = Math.floor(input.nowSeconds ?? Date.now() / 1000);
  if (!Number.isSafeInteger(expires) || expires < now || expires > now + TOKEN_TTL_SECONDS) return false;
  const expected = Buffer.from(signature(`${input.mediaId}.${input.binding}.${expires}`), 'base64url');
  const received = Buffer.from(match[2], 'base64url');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function mediaPath(storageKey: string): string {
  if (!storageKey || storageKey.includes('\0')) notFound('Media');
  const root = path.resolve(process.env.PLATFORM_MEDIA_DIR || path.join(process.cwd(), '.platform-media'));
  const resolved = path.resolve(root, storageKey);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) notFound('Media');
  return resolved;
}

export async function servePlatformMedia(c: Context, asset: {
  storageKey: string;
  mimeType: string;
  sizeBytes: number | string;
}, cacheControl: string): Promise<Response> {
  const filePath = mediaPath(asset.storageKey);
  const stat = await fs.stat(filePath).catch(() => null);
  const expectedSize = Number(asset.sizeBytes);
  if (!stat?.isFile()) notFound('Media');
  if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0 || stat.size !== expectedSize) {
    throw new PlatformApiError('PRIVATE_DATA_UNREADABLE', 500, 'Media storage metadata does not match the stored file');
  }
  const response = storedVideoResponse({
    filePath,
    mime: asset.mimeType,
    size: expectedSize,
    rangeHeader: c.req.header('range'),
    headOnly: c.req.method === 'HEAD',
  });
  response.headers.set('Cache-Control', cacheControl);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}
