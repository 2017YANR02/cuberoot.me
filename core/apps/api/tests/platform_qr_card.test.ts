import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { PlatformApiError } from '../src/platform/errors.js';
import {
  QR_CARD_FRONT_ARTS,
  parseQrCardDesign,
  parseQrCardRenderOptions,
  resolveQrCardArtwork,
  resolveQrCardContent,
  renderQrCardSvg,
} from '../src/platform/qr-card.js';
import { workspaceFixturePath } from './workspace-fixture-path';

const PNG_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('QR card design contract', () => {
  it('normalizes the complete supported design shape', () => {
    expect(parseQrCardDesign({
      intro: '  first\r\nsecond  ',
      term: 'PLL',
      quote: 'Keep turning',
      brand: 'CubeRoot',
      frontArt: PNG_DATA_URI,
      backArt: PNG_DATA_URI,
      frontArtPrompt: 'A clean cube illustration',
      alg: { name: 'T Perm', moves: "R U R'", url: '/alg/3x3/pll' },
      layout: {
        quote: { x: 1, y: -2 },
        qr: { x: 0, y: 1, s: 1.1 },
        front: { x: 2, y: 3, s: 1.2, fit: 'cover' },
      },
      textStyles: {
        quote: { font: 'kai', color: '#abcdef', size: 1.2, stroke: '#000000', strokeW: 0.2 },
        brand: { hidden: true },
      },
      customTexts: [{ id: 'serial_1', side: 'back', text: 'No. 001', x: 0, y: 8 }],
    })).toEqual({
      intro: 'first\nsecond',
      term: 'PLL',
      quote: 'Keep turning',
      brand: 'CubeRoot',
      frontArtPrompt: 'A clean cube illustration',
      frontArt: PNG_DATA_URI,
      backArt: PNG_DATA_URI,
      alg: { name: 'T Perm', moves: "R U R'", url: '/alg/3x3/pll' },
      layout: {
        quote: { x: 1, y: -2 },
        qr: { x: 0, y: 1, s: 1.1 },
        front: { x: 2, y: 3, s: 1.2, fit: 'cover' },
      },
      textStyles: {
        quote: { font: 'kai', color: '#ABCDEF', size: 1.2, stroke: '#000000', strokeW: 0.2 },
        brand: { hidden: true },
      },
      customTexts: [{ id: 'serial_1', side: 'back', text: 'No. 001', x: 0, y: 8 }],
    });
  });

  it('rejects unknown keys, unsafe art, unsupported transforms, and malformed text styles', () => {
    for (const input of [
      { surprise: true },
      { frontArt: 'https://example.com/art.png' },
      { frontArt: '/card/not-a-built-in.webp' },
      { frontArt: 'data:image/png;base64,AAAA' },
      { alg: { moves: "R U R'", url: 'javascript:alert(1)' } },
      { layout: { quote: { x: 0, y: 0, s: 2 } } },
      { textStyles: { quote: { stroke: '#000000' } } },
      { customTexts: [
        { id: 'same', side: 'front', text: 'a', x: 0, y: 0 },
        { id: 'same', side: 'back', text: 'b', x: 0, y: 0 },
      ] },
    ]) {
      expect(() => parseQrCardDesign(input), JSON.stringify(input)).toThrow(PlatformApiError);
    }
  });

  it('accepts only stable built-in artwork keys and resolves defaults deterministically', () => {
    expect(parseQrCardDesign({ frontArt: QR_CARD_FRONT_ARTS[0] })).toEqual({
      frontArt: '/card/front-ink.webp',
    });
    const first = resolveQrCardArtwork({}, { idx: 0, noArt: false });
    const second = resolveQrCardArtwork({}, { idx: 1, noArt: false });
    expect(first.frontArt).toMatch(/^data:image\/webp;base64,/);
    expect(second.frontArt).toMatch(/^data:image\/webp;base64,/);
    expect(first.frontArt).not.toBe(second.frontArt);
    expect(resolveQrCardArtwork({}, { idx: 2, noArt: false })).toEqual(first);
    expect(resolveQrCardArtwork({}, { idx: 0, noArt: true })).toEqual({});
  });

  it('shares the visible content decision used by the SVG renderer', () => {
    const base = {
      code: 'qr_content',
      title: '  精选课程  ',
      targetKind: 'internal_path' as const,
      targetValue: '/courses',
      card: parseQrCardDesign({ intro: '  课程简介  ', term: 'PLL', brand: '  ', alg: { name: 'PLL T', moves: "R U R'" } }),
    };
    expect(resolveQrCardContent(base, 0)).toEqual({
      quote: '慢就是快\n一次打乱 一次成长',
      quoteMain: '慢就是快',
      quoteSubs: ['一次打乱 一次成长'],
      brand: '魔方开放社群',
      backMain: '精选课程',
      backSub: '课程简介',
      term: '',
      hasAlgorithm: true,
      algorithmMoves: "R U R'",
    });
  });

  it('bounds legacy render query options and defaults to a 3 mm bleed', () => {
    expect(parseQrCardRenderOptions(new URLSearchParams())).toEqual({
      bleed: 3, cropMarks: true, pattern: true, noArt: false, download: false, idx: 0,
    });
    expect(parseQrCardRenderOptions(new URLSearchParams(
      'bleed=9&crop=0&bg=plain&noart=1&dl=1&idx=1000001',
    ))).toEqual({
      bleed: 6, cropMarks: false, pattern: false, noArt: true, download: true, idx: 1_000_000,
    });
    expect(parseQrCardRenderOptions(new URLSearchParams('bleed=invalid&idx=1.5')).bleed).toBe(3);
  });

  it('renders a self-contained 46 mm physical SVG with H correction and escaped text', () => {
    const options = parseQrCardRenderOptions(new URLSearchParams());
    const svg = renderQrCardSvg({
      code: 'qr_safe_code',
      title: '<unsafe & title>',
      targetKind: 'internal_path',
      targetValue: '/alg',
      card: parseQrCardDesign({ frontArt: PNG_DATA_URI, intro: '<script>alert(1)</script>' }),
    }, 'https://cuberoot.me/platform/qr/qr_safe_code', options);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('width="46mm" height="46mm" viewBox="0 0 46 46"');
    expect(svg).toContain('data-qr-ecc="H"');
    expect(svg).toContain(`href="${PNG_DATA_URI}"`);
    expect(svg).toContain("@font-face{font-family:'JetBrains Mono'");
    expect(svg).toContain('&lt;unsafe &amp; title&gt;');
    expect(svg).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(svg).not.toMatch(/<image[^>]+href="https?:/);
    expect(svg).not.toContain('<script>');

    const clean = renderQrCardSvg({
      code: 'qr_safe_code', title: 'Safe', targetKind: 'content', targetValue: 'text',
      card: parseQrCardDesign({}),
    }, 'https://cuberoot.me/platform/qr/qr_safe_code', {
      ...options, bleed: 0, cropMarks: false,
    });
    expect(clean).toContain('width="40mm" height="40mm" viewBox="0 0 40 40"');
    expect(clean).toContain('<image href="data:image/webp;base64,');
    expect(clean).not.toMatch(/<image[^>]+href="https?:/);

    const algorithm = renderQrCardSvg({
      code: 'qr_alg', title: 'Algorithm', targetKind: 'internal_path', targetValue: '/alg',
      card: parseQrCardDesign({ term: 'must be hidden', alg: { name: 'PLL T', moves: "R U R' U'" } }),
    }, 'https://cuberoot.me/platform/qr/qr_alg', options);
    expect(algorithm).toContain('<path transform="translate(');
    expect(algorithm).toMatch(/<svg[^>]+viewBox="-0\.9 -0\.9 1\.8 1\.8"[^>]+width="6" height="6">/);
    expect(algorithm).not.toContain('PLL T');
    expect(algorithm).not.toContain('must be hidden');
    expect(algorithm).not.toContain('cuberoot.me/platform/qr/qr_alg');

    const noArt = renderQrCardSvg({
      code: 'qr_safe_code', title: 'Safe', targetKind: 'content', targetValue: 'text',
      card: parseQrCardDesign({ frontArt: PNG_DATA_URI }),
    }, 'https://cuberoot.me/platform/qr/qr_safe_code', {
      ...options, noArt: true, cropMarks: false, pattern: false,
    });
    expect(noArt).not.toContain('<image');
  });

  it('keeps migration, canonical schema, ledger, and /dev/schema synchronized', async () => {
    const [migration, schema, readme, devSchema] = await Promise.all([
      readFile(new URL('../migrations/0202_qr_card_designs.sql', import.meta.url), 'utf8'),
      readFile(new URL('../src/db/schema.pg.sql', import.meta.url), 'utf8'),
      readFile(new URL('../migrations/README.md', import.meta.url), 'utf8'),
      readFile(workspaceFixturePath('@cuberoot/client', 'app/[lang]/dev/schema/page.tsx'), 'utf8'),
    ]);
    expect(migration).not.toMatch(/^(?:BEGIN|COMMIT)\s*;/im);
    for (const source of [migration, schema]) {
      expect(source).toContain('CREATE TABLE platform_qr_card_designs');
      expect(source).toContain('PRIMARY KEY (qr_code_id, version)');
      expect(source).toContain("JSONB_TYPEOF(card) = 'object'");
      expect(source).toContain('created_by_actor_key VARCHAR(160) NOT NULL');
      expect(source).toContain('idx_platform_qr_card_designs_latest');
    }
    expect(readme).toContain('0202_qr_card_designs.sql');
    expect(devSchema).toContain("{ name: 'platform_qr_card_designs'");
    expect(devSchema).toContain("{ n: 202, slug: 'qr_card_designs'");
  });
});
