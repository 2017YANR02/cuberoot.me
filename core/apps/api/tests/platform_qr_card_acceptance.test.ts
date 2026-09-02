import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PlatformApiError } from '../src/platform/errors.js';
import {
  parseQrCardDesign,
  parseQrCardRenderOptions,
  resolveQrCardContent,
  renderQrCardSvg,
} from '../src/platform/qr-card.js';
import { parseQrLinks } from '../src/platform/qr-landing.js';
import { platformQrRoutes } from '../src/routes/platform_qr.js';

const routesSource = readFileSync(new URL('../src/routes/platform_qr.ts', import.meta.url), 'utf8');

function routeBlock(method: 'get' | 'post' | 'patch', path: string): string {
  const marker = `platformQrRoutes.${method}('${path}'`;
  const start = routesSource.indexOf(marker);
  expect(start, `${method.toUpperCase()} ${path} must exist`).toBeGreaterThanOrEqual(0);
  const next = routesSource.indexOf('\nplatformQrRoutes.', start + marker.length);
  return routesSource.slice(start, next < 0 ? undefined : next);
}

function sourceBlock(startMarker: string, endMarker: string): string {
  const start = routesSource.indexOf(startMarker);
  expect(start, `${startMarker} must exist`).toBeGreaterThanOrEqual(0);
  const end = routesSource.indexOf(endMarker, start + startMarker.length);
  expect(end, `${endMarker} must follow ${startMarker}`).toBeGreaterThan(start);
  return routesSource.slice(start, end);
}

const completeCard = {
  intro: 'Scan for the lesson',
  term: 'OLL',
  quote: 'Keep turning',
  brand: 'CubeRoot',
  frontArt: 'data:image/png;base64,iVBORw0KGgo=',
  backArt: 'data:image/png;base64,iVBORw0KGgo=',
  frontArtPrompt: 'A precise cube illustration',
  alg: { name: 'OLL 1', moves: "R U R'", url: '/alg/333/oll/1' },
  layout: {
    quote: { x: 1, y: -2 },
    qr: { x: 0, y: 1, s: 1.2 },
    front: { x: 0, y: 0, s: 1.1, fit: 'cover' },
  },
  textStyles: {
    quote: { font: 'serif', color: '#123456', size: 1.2 },
    brand: { hidden: true },
  },
  customTexts: [{
    id: 'note', side: 'front', text: 'Custom', x: 2, y: 3,
    style: { font: 'mono', color: '#abcdef', size: 0.8 },
  }],
} as const;

describe('Platform QR card acceptance', () => {
  it('accepts structured landing links and rejects unsafe or ambiguous values', () => {
    expect(parseQrLinks([
      { label: 'Lesson', href: '/learn/card-one', note: 'Start here' },
      { label: 'External', href: 'https://example.com/lesson' },
    ])).toEqual([
      { label: 'Lesson', href: '/learn/card-one', note: 'Start here' },
      { label: 'External', href: 'https://example.com/lesson' },
    ]);

    for (const links of [
      [{}],
      [{ label: 'Unsafe', href: 'javascript:alert(1)' }],
      [{ label: 'Protocol relative', href: '//example.com/path' }],
      [{ label: 'Unknown field', href: '/', extra: true }],
      Array.from({ length: 21 }, (_, index) => ({ label: String(index), href: '/' })),
    ]) {
      expect(() => parseQrLinks(links)).toThrow(PlatformApiError);
    }
  });

  it('accepts every editable field and rejects data outside the card contract', () => {
    expect(parseQrCardDesign(completeCard)).toMatchObject({
      ...completeCard,
      customTexts: [{
        ...completeCard.customTexts[0],
        style: { ...completeCard.customTexts[0].style, color: '#ABCDEF' },
      }],
    });

    expect(() => parseQrCardDesign({ ...completeCard, unsupported: true }))
      .toThrow(PlatformApiError);
    expect(() => parseQrCardDesign({ ...completeCard, alg: { moves: 'R', unsupported: true } }))
      .toThrow(PlatformApiError);
    expect(() => parseQrCardDesign({ ...completeCard, frontArt: 'https://example.com/art.png' }))
      .toThrow(PlatformApiError);
  });

  it('bounds physical render options and keeps the documented defaults', () => {
    expect(parseQrCardRenderOptions(new URLSearchParams())).toMatchObject({
      bleed: 3,
      cropMarks: true,
      idx: 0,
    });
    expect(parseQrCardRenderOptions(new URLSearchParams('bleed=99&crop=0&idx=1000001')))
      .toMatchObject({ bleed: 6, cropMarks: false, idx: 1_000_000 });
  });

  it('resolves the old visible-copy rules before SVG layout', () => {
    const entry = {
      code: 'card-one',
      title: ' Card One ',
      targetKind: 'internal_path' as const,
      targetValue: '/learn/card-one',
      card: parseQrCardDesign({
        intro: ' Introduction ',
        term: 'must be hidden',
        alg: { name: 'must not be printed', moves: "R U R'" },
      }),
    };
    expect(resolveQrCardContent(entry, 0)).toEqual({
      quote: '慢就是快\n一次打乱 一次成长',
      quoteMain: '慢就是快',
      quoteSubs: ['一次打乱 一次成长'],
      brand: '魔方开放社群',
      backMain: 'Card One',
      backSub: 'Introduction',
      term: '',
      hasAlgorithm: true,
      algorithmMoves: "R U R'",
    });
  });

  it('renders a self-contained, vector, print-size SVG with fold and crop marks', () => {
    const svg = renderQrCardSvg({
      code: 'card-one',
      title: 'Card One',
      targetKind: 'internal_path',
      targetValue: '/learn/card-one',
      card: parseQrCardDesign({ quote: 'Keep turning', brand: 'CubeRoot' }),
    }, 'https://cuberoot.me/platform/qr/card-one', {
      bleed: 3,
      cropMarks: true,
      pattern: false,
      noArt: false,
      download: true,
      idx: 0,
    });

    expect(svg).toContain('width="46mm" height="46mm" viewBox="0 0 46 46"');
    expect(svg).toContain('data-qr-ecc="H"');
    expect(svg).toContain('stroke-dasharray="0.8 0.8"');
    expect(svg.match(/<line\b/g)).toHaveLength(17);
    expect(svg).toContain('<image href="data:image/webp;base64,');
    expect(svg).not.toMatch(/(?:href|src)="https?:/);

    const noArt = renderQrCardSvg({
      code: 'card-one',
      title: 'Card One',
      targetKind: 'internal_path',
      targetValue: '/learn/card-one',
      card: parseQrCardDesign({ frontArt: completeCard.frontArt }),
    }, 'https://cuberoot.me/platform/qr/card-one', {
      bleed: 0,
      cropMarks: false,
      pattern: false,
      noArt: true,
      download: false,
      idx: 0,
    });
    expect(noArt).toContain('width="40mm" height="40mm" viewBox="0 0 40 40"');
    expect(noArt).not.toContain('<image');
  });

  it('renders an algorithm case and outlined moves without leaking its name, term, or landing URL', () => {
    const svg = renderQrCardSvg({
      code: 'algorithm-card',
      title: 'Algorithm card',
      targetKind: 'internal_path',
      targetValue: '/alg/333/pll',
      card: parseQrCardDesign({
        term: 'must be hidden',
        alg: { name: 'must not be printed', moves: "R U R' U'" },
      }),
    }, 'https://cuberoot.me/platform/qr/algorithm-card', parseQrCardRenderOptions(new URLSearchParams()));

    expect(svg).toContain('<path transform="translate(');
    expect(svg).toMatch(/<svg[^>]+viewBox="-0\.9 -0\.9 1\.8 1\.8"[^>]+width="6" height="6">/);
    expect(svg).not.toContain('must not be printed');
    expect(svg).not.toContain('must be hidden');
    expect(svg).not.toContain('cuberoot.me/platform/qr/algorithm-card');
  });

  it('rejects unauthenticated card reads and writes through the real router', async () => {
    const read = await platformQrRoutes.request('/admin/qr/card-one/card');
    expect(read.status).toBe(401);
    await expect(read.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } });

    const write = await platformQrRoutes.request('/admin/qr/card-one/card', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ card: {} }),
    });
    expect(write.status).toBe(401);
    await expect(write.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } });

    const createQr = await platformQrRoutes.request('/admin/qr', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetValue: '/' }),
    });
    expect(createQr.status).toBe(401);

    const updateQr = await platformQrRoutes.request('/admin/qr/00000000-0000-0000-0000-000000000000', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'Private label' }),
    });
    expect(updateQr.status).toBe(401);
  });

  it('exposes authenticated card editing and public SVG delivery on real routes', () => {
    const read = routeBlock('get', '/admin/qr/:id/card');
    expect(read).toContain('await requirePlatformAdmin(c)');
    expect(read).toContain('findLatestQrCard(');

    const write = routeBlock('patch', '/admin/qr/:id/card');
    expect(write).toContain('await requirePlatformAdmin(c)');
    expect(write).toContain("key !== 'card'");
    expect(write).toContain('parseQrCardDesign(');

    const publicSvg = routeBlock('get', '/qr/:code/card');
    expect(publicSvg).toContain('findQr(resourceId(c.req.param(\'code\'), \'code\'), true)');
    expect(publicSvg).toContain("c.header('Content-Type', 'image/svg+xml; charset=utf-8')");
    expect(publicSvg).toContain("c.header('Content-Disposition'");
    expect(publicSvg).toContain('renderQrCardSvg(');
  });

  it('keeps landing lifecycle, revision fields and scan accounting on the real routes', () => {
    const publicRead = routeBlock('get', '/qr/:code');
    expect(publicRead).toContain("findQr(resourceId(c.req.param('code'), 'code'), 'public')");
    expect(publicRead).toContain('await recordScan(c, qr)');
    expect(publicRead).toContain('publicQr(qr)');

    const publicRedirect = routeBlock('get', '/qr/:code/redirect');
    expect(publicRedirect).toContain("qr.type !== 'redirect'");
    expect(publicRedirect).toContain('await recordScan(c, qr)');

    const create = routeBlock('post', '/admin/qr');
    expect(create).toContain('parseRevision(body)');
    expect(create).toContain('parseQrLabel(body)');
    expect(create).toContain('insertRevision(');

    const update = routeBlock('patch', '/admin/qr/:id');
    expect(update).toContain('parseQrLabel(body)');
    expect(update).toContain('QR_REVISION_FIELDS.some');
    expect(update).toContain('parseRevision(body, current)');
    expect(update).toContain('label = COALESCE');

    const duplicate = routeBlock('post', '/admin/qr/:id/duplicate');
    expect(duplicate).toContain('q.label');
    expect(duplicate).toContain('r.qr_type');
    expect(duplicate).toContain('r.links');
    expect(duplicate).toContain('platform_qr_card_designs');
  });

  it('keeps the admin label private and resolves every admin QR reference by UUID or code', () => {
    const findQr = sourceBlock('async function findQr(', 'function publicQr(');
    const publicQr = sourceBlock('function publicQr(', 'function scanSecret(');
    expect(findQr).toContain('visibility === false');
    expect(findQr).toContain("NULLIF(qr.label, '')");
    expect(findQr).toContain("NULLIF(revision.title_en, ''), qr.code");
    expect(publicQr).not.toMatch(/\blabel\s*:/);

    for (const [method, path] of [
      ['patch', '/admin/qr/:id/card'],
      ['post', '/admin/qr/:id/duplicate'],
      ['patch', '/admin/qr/:id/disabled'],
      ['patch', '/admin/qr/:id'],
    ] as const) {
      expect(routeBlock(method, path)).toContain('resolveQrRef(db, id');
    }
    expect(routesSource).toMatch(/platformQrRoutes\.delete\('\/admin\/qr\/:id'[\s\S]*?resolveQrRef\(db, id, true\)/);
  });
});
