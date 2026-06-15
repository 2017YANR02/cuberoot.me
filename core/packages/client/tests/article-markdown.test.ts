/**
 * article-markdown.test.ts — SECURE pipeline regression baseline.
 *
 * The XSS assertions are LOCKED baselines: each asserts a known attack vector is stripped by
 * the rehype-sanitize schema (raw HTML is never re-enabled). Do not relax these to make a
 * future change pass — a failure here means the untrusted-author boundary regressed.
 *
 * node env, no DOM: we render the pipeline output to a static HTML string with
 * react-dom/server's renderToStaticMarkup and assert on the string.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderArticleMarkdown } from '@/lib/article-markdown';

function render(md: string): string {
  return renderToStaticMarkup(renderArticleMarkdown(md));
}

describe('article-markdown directives → whitelisted elements', () => {
  it(':red[...] → span.article-hl-red', () => {
    const html = render(':red[重点]');
    expect(html).toContain('article-hl-red');
    expect(html).toMatch(/<span[^>]*class="article-hl-red"[^>]*>重点<\/span>/);
  });

  it(':blue[...] without href → span.article-hl-blue', () => {
    const html = render(':blue[背景知识]');
    expect(html).toContain('article-hl-blue');
    expect(html).toMatch(/<span[^>]*class="article-hl-blue"[^>]*>背景知识<\/span>/);
    expect(html).not.toContain('<a');
  });

  it(':blue[...]{href=/article/x} → a.article-hl-blue with safe href', () => {
    const html = render(':blue[see]{href=/article/foo}');
    expect(html).toContain('article-hl-blue');
    expect(html).toMatch(/<a[^>]*href="\/article\/foo"[^>]*>/);
    expect(html).toContain('article-hl-blue');
  });

  it(':::figrow → div.article-figrow wrapping figure/img/figcaption', () => {
    const html = render(':::figrow\n![图1](/v1/article/img/1)\n:::');
    expect(html).toContain('article-figrow');
    expect(html).toContain('<figure');
    expect(html).toContain('<img');
    expect(html).toContain('src="/v1/article/img/1"');
    expect(html).toContain('<figcaption');
    expect(html).toContain('图1');
    expect(html).toContain('loading="lazy"');
  });

  it(':::figrow figures are NOT nested in <p> (invalid HTML → hydration mismatch #418)', () => {
    // Markdown wraps the images in a paragraph inside the container; wrapFigrow must lift the
    // figures to be direct children of div.article-figrow. A block <figure> inside <p> is invalid
    // and the browser re-parents it, diverging from the SSR tree (React #418). Multi-image grid.
    const html = render(':::figrow\n![图1](/v1/article/img/1)\n![图2](/v1/article/img/2)\n:::');
    expect(html).not.toMatch(/<p>\s*<figure/);
    expect(html).toMatch(/<div class="article-figrow">\s*<figure/);
    // both images survive as figures, in order, no <p> wrappers
    expect(html).toContain('src="/v1/article/img/1"');
    expect(html).toContain('src="/v1/article/img/2"');
    expect(html).not.toContain('<p>');
  });

  it('single markdown image survives with src + alt', () => {
    const html = render('![图注](/v1/article/img/9)');
    expect(html).toContain('src="/v1/article/img/9"');
    expect(html).toContain('alt="图注"');
  });

  it(':cube[...]{view=oll size=120} → cube-embed component receives validated props', () => {
    // ArticleCubeEmbed renders an <img> to the visualcube endpoint; assert the directive
    // attributes actually reach the component (view=oll, not the iso fallback).
    const html = render(':cube[R U]{view=oll size=120}');
    expect(html).toContain('article-cube-embed');
    expect(html).toContain('view=oll');
    expect(html).toContain('size=120');
    expect(html).not.toContain('view=iso');
  });

  it(':alg[...] maps to the alg-embed client leaf (no crash server-side)', () => {
    // ArticleAlgEmbed is a next/dynamic({ssr:false}) leaf — it renders nothing during SSR/SSG
    // and mounts client-side. The pipeline must not throw and must not emit any raw markup.
    const html = render(":alg[R U R']{puzzle=3x3x3}");
    // The directive maps to ArticleAlgEmbed (wrapper span.article-alg-embed). The raw sentinel
    // custom element and its data-* attrs must NOT leak to the DOM; the player mounts client-side.
    expect(html).not.toContain('<alg-embed');
    expect(html).not.toContain('data-alg=');
    expect(html).toContain('article-alg-embed');
    expect(typeof html).toBe('string');
  });

  it('legal formatting (bold/italic/link) survives', () => {
    const html = render('**bold** and *italic* and [link](https://example.com)');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toMatch(/<a[^>]*href="https:\/\/example.com"[^>]*>link<\/a>/);
  });

  it('GFM heading + list survive', () => {
    const html = render('## Title\n\n- one\n- two');
    expect(html).toContain('<h2');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>one</li>');
  });
});

describe('article-markdown SECURITY — XSS vectors are STRIPPED (locked baseline)', () => {
  it('raw <script> is dropped (no executable element; tag becomes inert text)', () => {
    const html = render('hello <script>alert(1)</script> world');
    // Real invariant: raw HTML is disabled, so NO <script> element is ever emitted. Whatever
    // the author typed survives only as inert escaped text, never as an executing element.
    expect(html).not.toContain('<script');
    expect(html).not.toContain('</script');
  });

  it('script payload wrapped in a tag is not turned into an element', () => {
    // The closing angle of a <script> sentinel must never reconstitute into a live tag.
    const html = render('<script src="https://evil.example/x.js"></script>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('evil.example');
  });

  it('onerror= attribute is dropped', () => {
    const html = render('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('alert(1)');
  });

  it('javascript: href is stripped', () => {
    const html = render('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('alert(1)');
  });

  it('javascript: href via :blue directive is stripped', () => {
    const html = render(':blue[x]{href=javascript:alert(1)}');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('alert(1)');
  });

  it('raw <iframe> is dropped', () => {
    const html = render('text <iframe src="https://evil.example"></iframe> text');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('evil.example');
  });

  it('data: image src is stripped', () => {
    const html = render('![x](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)');
    expect(html).not.toContain('data:image');
    expect(html).not.toContain('base64');
  });

  it('raw <svg onload=...> is dropped', () => {
    const html = render('a <svg onload="alert(1)"><circle r="10"/></svg> b');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('onload');
    expect(html).not.toContain('alert(1)');
  });

  it('arbitrary className on a span is stripped (closed allowlist)', () => {
    // The directive only ever emits the closed set; a raw HTML span with a hostile class
    // is dropped entirely (raw HTML disabled), so the class can never reach the DOM.
    const html = render('<span class="evil-class">x</span>');
    expect(html).not.toContain('evil-class');
  });

  it('event-handler attributes on links are dropped', () => {
    const html = render('<a href="https://x.example" onclick="alert(1)">x</a>');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('alert(1)');
  });

  it('data: URL via :blue href is stripped', () => {
    const html = render(':blue[x]{href="data:text/html,evilpayload"}');
    expect(html).not.toContain('data:text/html');
    expect(html).not.toContain('evilpayload');
  });

  it('HTML-entity-encoded javascript: in a markdown link is neutralized', () => {
    const html = render('[x](&#106;avascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('alert(1)');
  });

  it(':alg label with an embedded handler fails notation validation (no embed, no leak)', () => {
    const html = render(':alg[R U onclick=alert(1)]{puzzle=3x3x3}');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('alert');
    expect(html).not.toContain('<alg-embed');
  });

  it('figrow image with a javascript: src is stripped (manually-built figure goes through sanitize)', () => {
    const html = render(':::figrow\n![x](javascript:alert(1))\n:::');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('alert(1)');
  });
});
