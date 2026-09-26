import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import * as opentype from 'opentype.js';
import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { COMPETITION_ACCESS_COOKIE, COMPETITION_ACCESS_TTL, createCompetitionProof } from '@cuberoot/shared/competition-access';
import monoTtf from '../platform/card-assets/jetbrains-mono-500.ttf?inline';

const TTL = 120_000;
const MAX_CHALLENGES = 5000;
const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const digest = (value: string) => createHash('sha256').update(value).digest();
interface Challenge { answer: Buffer; browser: string; expires: number; attempts: number }

/** Single API process owns one-use challenges. Restart expires outstanding images. */
export class CompetitionCaptchaStore {
  private challenges = new Map<string, Challenge>();
  private limits = new Map<string, { expires: number; count: number }>();
  private sweep(now: number) {
    for (const [key, item] of this.challenges) if (item.expires <= now) this.challenges.delete(key);
    for (const [key, item] of this.limits) if (item.expires <= now) this.limits.delete(key);
  }
  allow(key: string, max: number, now = Date.now()) {
    this.sweep(now);
    let item = this.limits.get(key);
    if (!item) {
      if (this.limits.size >= 10_000) return false;
      item = { expires: now + 60_000, count: 0 }; this.limits.set(key, item);
    }
    return ++item.count <= max;
  }
  issue(browser: string, now = Date.now()) {
    this.sweep(now);
    if (this.challenges.size >= MAX_CHALLENGES) return null;
    const id = randomBytes(24).toString('hex');
    const answer = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
    this.challenges.set(id, { answer: digest(answer), browser, expires: now + TTL, attempts: 0 });
    return { id, answer }; // Answer goes only to the image renderer, never the response JSON.
  }
  consume(id: string, answer: string, browser: string, now = Date.now()) {
    const item = this.challenges.get(id);
    if (!item || item.expires <= now) { this.challenges.delete(id); return false; }
    if (item.browser !== browser) return false;
    item.attempts++;
    const correct = timingSafeEqual(item.answer, digest(answer.trim().toUpperCase()));
    if (correct || item.attempts >= 3) this.challenges.delete(id);
    return correct;
  }
}
const store = new CompetitionCaptchaStore();
let font: opentype.Font | undefined;
export function renderCompetitionCaptcha(answer: string) {
  if (!font) {
    const bytes = Buffer.from(monoTtf.slice(monoTtf.indexOf(',') + 1), 'base64');
    font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  }
  // Outlines, never <text>, metadata or an answer embedded in the image source.
  // Fixed high-contrast image ink/paper are intentional, independent of page theme.
  const paths = [...answer].map((letter, i) => {
    const x = 18 + i * 35; const y = randomInt(47, 59);
    return `<path transform="rotate(${randomInt(-18, 19)} ${x + 12} 38)" d="${font!.getPath(letter, x, y, randomInt(37, 45)).toPathData(2)}"/>`;
  }).join('');
  const noise = Array.from({ length: 5 }, () => `<path d="M0 ${randomInt(10, 65)} Q120 ${randomInt(0, 76)} 240 ${randomInt(10, 65)}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="76" viewBox="0 0 240 76"><rect width="240" height="76" fill="white"/><g fill="navy">${paths}</g><g fill="none" stroke="slategray" stroke-width="1" opacity="0.5">${noise}</g></svg>`;
}
function identity(c: Context) {
  let peer = 'unknown';
  try { peer = getConnInfo(c).remote.address ?? peer; } catch { /* test request */ }
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer);
  const ip = local ? c.req.header('x-real-ip') ?? peer : peer;
  return { ip, browser: digest(ip + '\n' + (c.req.header('user-agent') ?? '')).toString('hex') };
}
function ready(c: Context) {
  c.header('Cache-Control', 'private, no-store');
  return (process.env.COMPETITION_ACCESS_SECRET?.length ?? 0) >= 32;
}
export function issueCompetitionCaptcha(c: Context) {
  if (!ready(c)) return c.json({ code: 'verification_unavailable' }, 503);
  const { ip, browser } = identity(c);
  if (!store.allow('issue:' + ip, 6)) { c.header('Retry-After', '60'); return c.json({ code: 'captcha_rate_limited' }, 429); }
  const challenge = store.issue(browser);
  if (!challenge) return c.json({ code: 'verification_unavailable' }, 503);
  return c.json({ id: challenge.id, image: 'data:image/svg+xml;base64,' + Buffer.from(renderCompetitionCaptcha(challenge.answer)).toString('base64'), expiresIn: TTL / 1000 });
}
export async function submitCompetitionCaptcha(c: Context) {
  if (!ready(c)) return c.json({ code: 'verification_unavailable' }, 503);
  // Same-site browser POST only. A third-party site cannot silently grant access.
  const origin = c.req.header('origin') ?? '';
  if (!/^https:\/\/(?:[a-z0-9-]+\.)?cuberoot\.me$/.test(origin)
    && !(process.env.NODE_ENV !== 'production' && /^http:\/\/(?:localhost|127\.0\.0\.1):3000$/.test(origin))) return c.json({ code: 'invalid_origin' }, 403);
  const { ip, browser } = identity(c);
  if (!store.allow('verify:' + ip, 10)) { c.header('Retry-After', '60'); return c.json({ code: 'captcha_rate_limited' }, 429); }
  let body: { id?: unknown; answer?: unknown };
  try {
    const raw = await c.req.text();
    if (raw.length > 512) return c.json({ code: 'invalid_challenge' }, 400);
    body = JSON.parse(raw);
  } catch { return c.json({ code: 'invalid_challenge' }, 400); }
  if (!body || typeof body.id !== 'string' || !/^[a-f0-9]{48}$/.test(body.id)
    || typeof body.answer !== 'string' || body.answer.length > 12
    || !store.consume(body.id, body.answer, browser)) return c.json({ code: 'captcha_incorrect_or_expired' }, 400);
  const proof = await createCompetitionProof(process.env.COMPETITION_ACCESS_SECRET!, 'browser', c.req.header('user-agent') ?? '');
  c.header('Set-Cookie', `${COMPETITION_ACCESS_COOKIE}=${proof}; Domain=cuberoot.me; Path=/; Max-Age=${COMPETITION_ACCESS_TTL}; HttpOnly; Secure; SameSite=Lax`);
  return c.json({ expiresIn: COMPETITION_ACCESS_TTL });
}
