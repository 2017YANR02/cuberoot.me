import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  normalizeQrCard,
  QR_CARD_DEFAULT_BRAND,
  qrCardArtworkDownload,
  qrCardPublicUrl,
  resolveQrCardContent,
  snapQrCardPosition,
} from '@/lib/platform-qr-card';
import {
  composeQrArtPrompt,
  FALLBACK_QR_PROMPT_LIBRARY,
  QR_PROMPT_DIMENSIONS,
} from '@/lib/platform-qr-prompt';
import {
  isPlatformQrLinkHref,
  normalizePlatformQrLinks,
  platformQrCardStudioHref,
  resolvePlatformQrLanding,
} from '@/lib/platform-qr-landing';
import { matchPlatformRoute } from '@/lib/platform-routes';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');

function readClient(path: string): string {
  return readFileSync(join(CLIENT, path), 'utf8');
}

describe('Platform QR card main-site contract', () => {
  it('routes the real admin card URL to a dedicated main-site workspace', () => {
    expect(matchPlatformRoute(['admin', 'qr', 'cards'])?.definition).toMatchObject({
      id: 'admin-qr-cards',
      access: 'admin',
      kind: 'collection',
      resource: 'admin-qr',
    });

    const routeView = readClient('components/platform/PlatformRouteView.tsx');
    expect(routeView).toContain("definition.id === 'admin-qr-cards'");
    expect(routeView).toContain('<PlatformQrCardStudio');
  });

  it('keeps the public QR route as a real landing page with safe direct redirects', () => {
    expect(matchPlatformRoute(['qr', 'card-one'])?.definition).toMatchObject({
      id: 'qr',
      access: 'public',
      kind: 'detail',
      resource: 'qr',
    });

    expect(resolvePlatformQrLanding({
      status: 'active',
      type: 'redirect',
      targetKind: 'internal_path',
      targetValue: '/learn/card-one',
    }, {
      english: false,
      defaultTitle: '默认标题',
      defaultIntro: '默认介绍',
      defaultLinks: [],
    })).toMatchObject({ mode: 'redirect', target: '/learn/card-one' });

    expect(resolvePlatformQrLanding({
      status: 'disabled',
      type: 'redirect',
      targetKind: 'external_url',
      targetValue: 'https://example.com/course',
    }, {
      english: true,
      defaultTitle: 'Default title',
      defaultIntro: 'Default intro',
      defaultLinks: [],
    })).toMatchObject({ mode: 'disabled' });

    expect(resolvePlatformQrLanding({
      status: 'active',
      type: 'landing',
      titleZh: '中文标题',
      titleEn: 'English title',
      intro: 'Introduction',
      term: 'PLL',
      links: [{ label: 'Lesson', href: '/learn/card-one', note: 'Start here' }],
    }, {
      english: true,
      defaultTitle: 'Default title',
      defaultIntro: 'Default intro',
      defaultLinks: [],
    })).toEqual({
      mode: 'landing',
      target: '',
      title: 'English title',
      intro: 'Introduction',
      term: 'PLL',
      links: [{ label: 'Lesson', href: '/learn/card-one', note: 'Start here' }],
    });

    expect(isPlatformQrLinkHref('/community')).toBe(true);
    expect(isPlatformQrLinkHref('https://example.com/lesson')).toBe(true);
    expect(isPlatformQrLinkHref('//example.com/lesson')).toBe(false);
    expect(isPlatformQrLinkHref('javascript:alert(1)')).toBe(false);
    expect(normalizePlatformQrLinks([
      { label: 'Safe', href: '/community' },
      { label: 'Unsafe', href: 'data:text/html,unsafe' },
    ])).toEqual([{ label: 'Safe', href: '/community' }]);

    const landing = readClient('components/platform/PlatformQrLanding.tsx');
    const routeView = readClient('components/platform/PlatformRouteView.tsx');
    expect(landing).toContain('window.location.replace(landing.target)');
    expect(landing).not.toContain('/redirect');
    expect(landing).toContain('<AppLink');
    expect(landing).toContain('<a className={className}');
    expect(routeView).toMatch(/permissionDenied \|\| definition\.id === 'qr' \|\|/);
  });

  it('edits landing metadata as structured fields while keeping intro and term in the card contract', () => {
    const editor = readClient('components/platform/PlatformQrMetadataEditor.tsx');
    const actions = readClient('components/platform/PlatformDomainActions.tsx');
    expect(platformQrCardStudioHref(' card one ')).toBe('/platform/admin/qr/cards?codes=card%20one&edit=card%20one');
    expect(editor).toContain("type: 'redirect' | 'landing'");
    expect(editor).toContain("targetKind: 'internal_path' | 'external_url' | 'content'");
    expect(editor).toContain('label: string');
    expect(editor).toContain('links: PlatformQrLink[]');
    expect(editor).toContain("t('添加链接', 'Add link')");
    expect(editor).toContain("t('删除链接', 'Delete link')");
    expect(editor).toContain('getPlatformQrCard(entity.id)');
    expect(editor).toContain('savePlatformQrCard(entity.id, { ...current.card, intro: values.intro, term: values.term })');
    expect(editor).toContain('label: values.label.trim()');
    expect(editor).toContain('type: values.type');
    expect(editor).toContain('targetValue: values.targetValue.trim()');
    expect(editor).toContain('links: values.links.map');
    expect(editor).toContain("rows={values.targetKind === 'content' ? 4 : 2}");
    expect(editor).toContain('platformQrCardStudioHref(values.code || resourceId)');
    expect(actions).toContain("field('label', '内部名称', 'Internal label', { required: true, maxLength: 160 })");
  });

  it('keeps the internal QR label out of the public landing surface', () => {
    const landing = readClient('components/platform/PlatformQrLanding.tsx');
    const resolver = readClient('lib/platform-qr-landing.ts');
    expect(landing).not.toMatch(/\bdata\.label\b/);
    expect(resolver).not.toMatch(/\bdata\.label\b/);

    expect(resolvePlatformQrLanding({
      status: 'active',
      type: 'landing',
      code: 'public-code',
      title: 'public-code',
      label: 'private admin note',
    }, {
      english: false,
      defaultTitle: '默认标题',
      defaultIntro: '默认介绍',
      defaultLinks: [],
    }).title).toBe('public-code');
  });

  it('keeps every editable card field at the client boundary', () => {
    const card = normalizeQrCard({
      intro: 'Introduction',
      term: 'OLL',
      quote: 'Keep turning',
      brand: 'CubeRoot',
      frontArt: 'data:image/png;base64,AA==',
      backArt: 'data:image/webp;base64,AA==',
      frontArtPrompt: 'A precise cube illustration',
      alg: { name: 'OLL 1', moves: "R U R'", url: '/alg/333/oll/1' },
      layout: { quote: { x: 1, y: -2 }, qr: { x: 0, y: 1, s: 1.2 } },
      textStyles: { quote: { font: 'serif', color: '#123456', size: 1.2 } },
      customTexts: [{ id: 'note', side: 'front', text: 'Custom', x: 2, y: 3 }],
    });

    expect(Object.keys(card).sort()).toEqual([
      'alg',
      'backArt',
      'brand',
      'customTexts',
      'frontArt',
      'frontArtPrompt',
      'intro',
      'layout',
      'quote',
      'term',
      'textStyles',
    ]);
    expect(card).toMatchObject({
      intro: 'Introduction',
      term: 'OLL',
      quote: 'Keep turning',
      brand: 'CubeRoot',
      frontArt: 'data:image/png;base64,AA==',
      backArt: 'data:image/webp;base64,AA==',
      frontArtPrompt: 'A precise cube illustration',
      alg: { name: 'OLL 1', moves: "R U R'", url: '/alg/333/oll/1' },
      layout: { quote: { x: 1, y: -2 }, qr: { x: 0, y: 1, s: 1.2 } },
      textStyles: { quote: { font: 'serif', color: '#123456', size: 1.2 } },
      customTexts: [{ id: 'note', side: 'front', text: 'Custom', x: 2, y: 3 }],
    });
  });

  it('uses the old card content rules instead of inventing new visible copy', () => {
    const card = normalizeQrCard({
      intro: '课程简介',
      term: '不应同时显示',
      alg: { name: '不应印出的公式名', moves: "R U R'", url: '/alg/333/pll' },
    });
    expect(resolveQrCardContent(card, '精选课程', 0)).toEqual({
      quote: '慢就是快\n一次打乱 一次成长',
      quoteMain: '慢就是快',
      quoteSubs: ['一次打乱 一次成长'],
      brand: QR_CARD_DEFAULT_BRAND,
      backMain: '精选课程',
      backSub: '课程简介',
      term: '',
      hasAlgorithm: true,
      algorithmMoves: "R U R'",
    });

    const withoutAlgorithm = resolveQrCardContent(normalizeQrCard({ term: 'PLL' }), '卡片', 0);
    expect(withoutAlgorithm).toMatchObject({ term: 'PLL', hasAlgorithm: false, algorithmMoves: '' });
  });

  it('keeps client normalization inside the server limits and preserves built-in art keys', () => {
    const card = normalizeQrCard({
      intro: 'i'.repeat(1001),
      frontArtPrompt: 'p'.repeat(4001),
      frontArt: '/card/front-ink.webp',
      alg: { moves: 'R'.repeat(501) },
      textStyles: {
        quote: { stroke: '#123456' },
        brand: { stroke: '#654321', strokeW: 0.2 },
      },
    });
    expect(card.intro).toHaveLength(1000);
    expect(card.frontArtPrompt).toHaveLength(4000);
    expect(card.alg?.moves).toHaveLength(500);
    expect(card.frontArt).toBe('/card/front-ink.webp');
    expect(card.textStyles.quote).toEqual({});
    expect(card.textStyles.brand).toMatchObject({ stroke: '#654321', strokeW: 0.2 });
  });

  it('assembles the complete artwork prompt from the real dimension library', () => {
    const selected = Object.fromEntries(QR_PROMPT_DIMENSIONS.map(({ key }) => [
      key,
      FALLBACK_QR_PROMPT_LIBRARY.blocks.find((block) => block.dimension === key)?.id,
    ]));
    const prompt = composeQrArtPrompt(selected, FALLBACK_QR_PROMPT_LIBRARY.blocks);
    expect(prompt).toContain('标准 WCA 配色三阶魔方');
    expect(prompt).toContain('竖版构图 1:2');
    for (const { key } of QR_PROMPT_DIMENSIONS) {
      const block = FALLBACK_QR_PROMPT_LIBRARY.blocks.find((item) => item.id === selected[key]);
      expect(prompt).toContain(block!.body);
    }
    expect(prompt.length).toBeLessThanOrEqual(4000);
  });

  it('preserves magnetic alignment, the Alt bypass, and source-art download identity', () => {
    const input = {
      originX: 0,
      originY: 0,
      deltaX: 4.6,
      deltaY: 3,
      baseCenterX: 100,
      baseCenterY: 100,
      targetsX: [150],
      targetsY: [130],
      pxPerMm: 10,
      enabled: true,
      altKey: false,
    };
    expect(snapQrCardPosition(input)).toEqual({ x: 5, y: 3, guideX: 150, guideY: 130 });
    expect(snapQrCardPosition({ ...input, altKey: true })).toEqual({ x: 4.6, y: 3 });
    expect(snapQrCardPosition({ ...input, enabled: false })).toEqual({ x: 4.6, y: 3 });

    expect(qrCardArtworkDownload(normalizeQrCard({}), 'front', 'card-one', 0)).toEqual({
      source: '/card/front-ink.webp',
      filename: 'qr-card-card-one-front.png',
    });
    expect(qrCardArtworkDownload(normalizeQrCard({}), 'back', 'card-one', 0)).toBeNull();
  });

  it('keeps code selection, actionable empty state, printing and mobile layout in the workspace', () => {
    const studio = readClient('components/platform/PlatformQrCardStudio.tsx');
    const css = readClient('components/platform/PlatformQrCardStudio.module.css');

    expect(studio).toMatch(/useQueryState\(\s*['"]codes['"]/);
    expect(studio).toContain("codesParam === '-'");
    expect(studio).toContain('href="/platform/admin/qr"');
    expect(studio).toContain("'There are no QR codes to turn into cards yet.");
    expect(studio).toContain("'The print queue is empty.");
    expect(studio).toContain('<PromptComposer');
    expect(studio).toContain('qrCardArtworkDownload(');
    expect(studio).toContain('qrCodeSvgUrl(');
    expect(studio).toContain('snapQrCardPosition({');
    expect(studio).toContain('altKey: event.altKey');
    expect(studio).toContain('onDoubleClick: onInlineEdit');
    expect(studio).toContain('onPointerDown={beginGesture}');
    expect(studio).toContain('onPointerMove={moveGesture}');
    expect(studio).toContain('onWheel={zoomSelected}');
    expect(studio).toContain('addCustomText');
    expect(studio).toContain('deleteCustomText');
    expect(studio).toContain('href={`/platform/qr/${encodeURIComponent(activeCode)}?stay=1`}');
    expect(studio).toContain('window.print()');
    expect(studio).toContain('qrCardPublicUrl');
    expect(studio).toContain('useT()');
    expect(css).toMatch(/\.cardUnit\s*{[^}]*width:\s*40mm;[^}]*height:\s*40mm;/s);
    expect(css).toMatch(/\.cardFace\s*{[^}]*width:\s*20mm;[^}]*height:\s*40mm;/s);
    expect(css).toContain('touch-action: none');
    expect(css).toContain('@media print');
    expect(css).toMatch(/@page\s*{[^}]*size:\s*A4;[^}]*margin:\s*8mm;/s);
    expect(css).toContain('print-color-adjust: exact');
    expect(css).toContain('--card-scale: 1');
    expect(css).toContain('@media (max-width: 720px)');
  });

  it('builds explicit press-ready and clean SVG attachment URLs', () => {
    const press = new URL(qrCardPublicUrl('card one', 'press', 7), 'https://cuberoot.test');
    expect(press.pathname).toBe('/v1/platform/qr/card%20one/card');
    expect(Object.fromEntries(press.searchParams)).toMatchObject({
      idx: '7',
      bleed: '3',
      crop: '1',
      dl: '1',
    });

    const clean = new URL(qrCardPublicUrl('card one', 'clean'), 'https://cuberoot.test');
    expect(clean.pathname).toBe('/v1/platform/qr/card%20one/card');
    expect(Object.fromEntries(clean.searchParams)).toMatchObject({
      idx: '0',
      bleed: '0',
      crop: '0',
      dl: '1',
    });
  });
});
