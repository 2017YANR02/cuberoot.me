/**
 * article-markdown — SECURE markdown -> React render pipeline for /article.
 *
 * Community authors are UNTRUSTED. The hard security boundary is:
 *   remark-directive  → sentinel hast elements (only whitelisted class / data-*)
 *   rehype-sanitize   → closed-list tagNames + attributes (LAST rehype step, no rehype-raw)
 *   components map     → leaf components (ArticleAlgEmbed/ArticleCubeEmbed) that RE-validate
 *                        every prop (alg notation regex, view enum, size clamp, own URLs).
 *
 * Raw HTML in the source is dropped entirely (rehype-raw / allowDangerousHtml are NOT enabled),
 * so all rich features must go through directives. react-markdown's default urlTransform is
 * kept (it strips `javascript:` and `data:` URLs); the sanitize protocol allowlist is a second
 * independent gate (img src http/https only, a href http/https/mailto/... only).
 *
 * This module touches no window/document/DOM at module scope and is safe to import + execute
 * inside a React Server Component.
 */
import type { ReactElement } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { visit } from 'unist-util-visit';
import ArticleAlgEmbed from '@/components/article/ArticleAlgEmbed';
import ArticleCubeEmbed from '@/components/article/ArticleCubeEmbed';

// Derive the public types from the imported functions rather than importing `mdast` /
// `hast-util-sanitize` directly (both are transitive deps, not in this package's dependencies).
type UnistTree = Parameters<typeof visit>[0];
type SanitizeSchema = Exclude<Parameters<typeof rehypeSanitize>[0], undefined>;

// ── remark plugin: directive AST -> sentinel hast elements ─────────────────────
// remark-directive produces three node types:
//   textDirective       :red[label]          (inline)
//   leafDirective        ::alg[R U R']{...}   (block, single-line — also written :alg[...] inline)
//   containerDirective  :::figrow … :::       (block, fenced)
// We map each known directive to a sentinel element by setting node.data.hName +
// node.data.hProperties. Unknown directive names are left as-is — react-markdown will then
// render them as literal text (remark-directive's fromMarkdown leaves no hName), never as the
// raw `:foo` becoming an element, and sanitize would strip any stray tag regardless.

interface DirectiveNode {
  type: 'textDirective' | 'leafDirective' | 'containerDirective';
  name: string;
  attributes?: Record<string, string | null | undefined> | null;
  children: unknown[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

function setHast(node: DirectiveNode, hName: string, hProperties: Record<string, unknown>) {
  const data = node.data || (node.data = {});
  data.hName = hName;
  data.hProperties = hProperties;
}

function articleDirectives() {
  return (tree: UnistTree) => {
    visit(tree, (node: unknown) => {
      const n = node as DirectiveNode;
      if (
        n.type !== 'textDirective' &&
        n.type !== 'leafDirective' &&
        n.type !== 'containerDirective'
      ) {
        return;
      }
      const attrs = n.attributes || {};

      switch (n.name) {
        // :red[文字] — highlight (重点). Always a span; sentinel class only.
        case 'red':
          setHast(n, 'span', { className: ['article-hl-red'] });
          break;

        // :blue[文字] or :blue[文字]{href=/article/x} — background-knowledge highlight.
        // With an href it becomes an <a>; sanitize protocol allowlist + urlTransform still
        // police the href (javascript:/data: dropped). Without href, a span.
        case 'blue': {
          const href = typeof attrs.href === 'string' ? attrs.href : undefined;
          if (href) {
            setHast(n, 'a', { className: ['article-hl-blue'], href });
          } else {
            setHast(n, 'span', { className: ['article-hl-blue'] });
          }
          break;
        }

        // :::figrow … ::: — image grid. Wrap each inner image (paragraph children) in
        // <figure><img><figcaption>{alt}</figcaption></figure>. Markdown images inside become
        // hast <img>; we additionally rewrite them to figures here so figcaption carries alt.
        case 'figrow':
          if (n.type === 'containerDirective') {
            wrapFigrow(n);
            setHast(n, 'div', { className: ['article-figrow'] });
          }
          break;

        // :alg[R U R']{puzzle=3x3x3} — interactive cubing.js player leaf.
        // The label text is the alg; sentinel <alg-embed data-alg data-puzzle>.
        case 'alg': {
          const alg = directiveLabel(n);
          const puzzle = typeof attrs.puzzle === 'string' ? attrs.puzzle : '3x3x3';
          // Children are the label nodes; drop them so only the sentinel + data-* survives.
          // hProperties keys are camelCase (`dataAlg`) so they match the sanitize allowlist;
          // react-markdown then hands them to the component as `data-alg` props.
          n.children = [];
          setHast(n, 'alg-embed', { dataAlg: alg, dataPuzzle: puzzle });
          break;
        }

        // :cube[setup]{view=oll size=120 …} — static visualcube image leaf.
        // The component builds its own URL from these data-* props; raw src never accepted.
        case 'cube': {
          const label = directiveLabel(n);
          n.children = [];
          const props: Record<string, unknown> = {};
          // label (if any) is treated as the alg; attrs may also set alg explicitly.
          // camelCase keys to match the sanitize allowlist (see :alg note above).
          const alg = typeof attrs.alg === 'string' ? attrs.alg : label;
          if (alg) props.dataAlg = alg;
          if (typeof attrs.setup === 'string') props.dataSetup = attrs.setup;
          if (typeof attrs.view === 'string') props.dataView = attrs.view;
          if (typeof attrs.mask === 'string') props.dataMask = attrs.mask;
          if (typeof attrs.size === 'string') props.dataSize = attrs.size;
          setHast(n, 'cube-embed', props);
          break;
        }

        default:
          // Unknown directive: leave it. remark-directive leaves no hName, so react-markdown
          // renders its children as text. Nothing dangerous can be smuggled.
          break;
      }
    });
  };
}

// Extract the plaintext label of a text/leaf directive (its child text nodes concatenated).
function directiveLabel(n: DirectiveNode): string {
  let out = '';
  for (const child of n.children as Array<{ type?: string; value?: string }>) {
    if (child && child.type === 'text' && typeof child.value === 'string') out += child.value;
  }
  return out.trim();
}

// Rewrite the images inside a :::figrow container into <figure><img><figcaption>{alt}</figcaption>.
// The container's children are blocks (usually paragraphs holding the image nodes); we walk them
// and replace each `image` mdast node with a sentinel figure (via hName/hProperties + figcaption).
function wrapFigrow(container: DirectiveNode) {
  visit(container as unknown as UnistTree, 'image', (imageNode: unknown) => {
    const img = imageNode as {
      type: string;
      url?: string;
      alt?: string | null;
      data?: { hName?: string; hProperties?: Record<string, unknown>; hChildren?: unknown[] };
    };
    const alt = typeof img.alt === 'string' ? img.alt : '';
    const data = img.data || (img.data = {});
    data.hName = 'figure';
    data.hProperties = {};
    const hChildren: unknown[] = [
      {
        type: 'element',
        tagName: 'img',
        properties: { src: img.url || '', alt, loading: 'lazy', decoding: 'async' },
        children: [],
      },
    ];
    // 空 alt(图注已烤进图片本身)不生成空 figcaption,避免多余间距。
    if (alt) {
      hChildren.push({
        type: 'element',
        tagName: 'figcaption',
        properties: {},
        children: [{ type: 'text', value: alt }],
      });
    }
    data.hChildren = hChildren;
  });
}

// ── sanitize schema: defaultSchema extended EXACTLY per SPEC §4 ────────────────
// Closed-list tagNames + attributes. className is ONLY allowed via a closed regex; data-*
// only the documented alg/cube props; img keeps src/alt + fixed loading/decoding. The default
// `clobberPrefix: 'user-content-'` (id/name prefixing, anti DOM-clobber) is preserved.
const HL_CLASS_RE = /^article-(hl-red|hl-blue|figrow)$/;

type AttrRule = string | [string, ...Array<string | RegExp | boolean | number>];

// hast-util-sanitize honours a SINGLE className rule per tag (a second `['className', …]`
// tuple is ignored). So we strip any default className tuple and emit one merged rule that
// keeps the default permitted class values AND our closed regex.
function classNameRule(defaults: readonly AttrRule[] | undefined): AttrRule {
  const allowed: Array<string | RegExp> = [];
  for (const rule of defaults || []) {
    if (Array.isArray(rule) && rule[0] === 'className') {
      for (const v of rule.slice(1)) {
        if (typeof v === 'string' || v instanceof RegExp) allowed.push(v);
      }
    }
  }
  return ['className', ...allowed, HL_CLASS_RE];
}

// Other (non-className) default attribute rules, kept as-is.
function withoutClassName(defaults: readonly AttrRule[] | undefined): AttrRule[] {
  return (defaults || []).filter((r) => !(Array.isArray(r) && r[0] === 'className')) as AttrRule[];
}

const schema: SanitizeSchema = {
  ...defaultSchema,
  // Preserve default clobberPrefix / protocols / clobber etc. via the spread above.
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'alg-embed',
    'cube-embed',
    'figure',
    'figcaption',
    // span/a/img/div are already in defaultSchema.tagNames.
  ],
  attributes: {
    ...(defaultSchema.attributes || {}),
    'alg-embed': ['dataAlg', 'dataPuzzle'],
    'cube-embed': ['dataAlg', 'dataSetup', 'dataView', 'dataMask', 'dataSize'],
    // CLOSED className allowlist via regex — no wildcard. One merged className rule per tag.
    span: [
      ...withoutClassName(defaultSchema.attributes?.span as AttrRule[] | undefined),
      classNameRule(defaultSchema.attributes?.span as AttrRule[] | undefined),
    ],
    a: [
      ...withoutClassName(defaultSchema.attributes?.a as AttrRule[] | undefined),
      classNameRule(defaultSchema.attributes?.a as AttrRule[] | undefined),
    ],
    div: [
      ...withoutClassName(defaultSchema.attributes?.div as AttrRule[] | undefined),
      classNameRule(defaultSchema.attributes?.div as AttrRule[] | undefined),
    ],
    img: [
      ...(defaultSchema.attributes?.img || []), // src + aria-* by default
      'alt',
      ['loading', 'lazy'],
      ['decoding', 'async'],
    ],
    figure: [],
    figcaption: [],
  },
};

// ── components map: sentinel tags -> leaf components (which re-validate props) ──
// react-markdown lower-cases hast property names and passes them as React props, so the
// data-* attributes arrive as `data-alg` etc. on the props object. The wrappers below pull
// those and hand clean prop names to the components, which independently re-validate.
type EmbedProps = Record<string, unknown> & { node?: unknown; children?: unknown };

function pick(props: EmbedProps, key: string): string | undefined {
  const v = props[key];
  return typeof v === 'string' ? v : undefined;
}

const components = {
  'alg-embed': (props: EmbedProps) => (
    <ArticleAlgEmbed alg={pick(props, 'data-alg') ?? ''} puzzle={pick(props, 'data-puzzle')} />
  ),
  'cube-embed': (props: EmbedProps) => (
    <ArticleCubeEmbed
      alg={pick(props, 'data-alg')}
      setup={pick(props, 'data-setup')}
      view={pick(props, 'data-view')}
      mask={pick(props, 'data-mask')}
      size={pick(props, 'data-size')}
    />
  ),
  // figure / figcaption / img / span / a / div: default DOM rendering (class already locked
  // by the sanitize schema). No overrides needed.
} as const;

/**
 * renderArticleMarkdown — render untrusted community markdown to a safe React element.
 * Safe to call inside a React Server Component (no DOM access). The returned tree contains
 * 'use client' leaf components (ArticleAlgEmbed/ArticleCubeEmbed) only where directives appear.
 */
export function renderArticleMarkdown(body: string): ReactElement {
  return (
    <Markdown
      remarkPlugins={[remarkGfm, remarkDirective, articleDirectives]}
      rehypePlugins={[[rehypeSanitize, schema]]}
      // Keep react-markdown's default urlTransform (strips javascript:/data:). Do NOT enable
      // rehype-raw or allowDangerousHtml — raw HTML from untrusted authors is discarded.
      components={components as never}
    >
      {body}
    </Markdown>
  );
}
