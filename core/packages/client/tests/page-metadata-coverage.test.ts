// 页面标题守卫:每个路由都必须有自己的 metadata 来源。
//
// WHY: 全站 180 个页面是 'use client',client 组件不能 export metadata,标题历史上
// 全靠 useDocumentTitle 在 hydration 之后设 —— 爬虫拿到的 HTML 里 202 个 URL 一个
// <title> 都没有。修法是同目录建 server layout.tsx(见 AGENTS.md「页面标题 / SEO
// metadata」)。
//
// 但漏配是**静默**的:新页面会被 app/sitemap.ts 自动扫进站点地图(等于主动请爬虫来
// 看),标题却不会自动有,结果是"招来爬虫看一个没标题的页" —— 比不做还差。当初全站
// 0 个 title 就是这么攒出来的,靠约定文档防它等于用已经失败过一次的机制再防一次。
//
// 本测试因此硬红:
//   1. 每个含 page.tsx 的路由,必须在**它自己的目录**里有 metadata 来源 ——
//      layout.tsx 调 pageMetadata('<route>')、layout.tsx 自带 generateMetadata、
//      或 page.tsx 自己 export generateMetadata。祖先 layout 不算(否则人人都能
//      "继承"到站级默认,守卫就废了)。
//   2. pageMetadata('<key>') 的 key 必须真的在 PAGE_META 里 —— 拼错同样静默失效。
//   3. PAGE_META 里的条目必须有人引用 —— 路由改名/删除后留下的孤儿条目。
//
// 真正拿不到 param 的哨兵壳走 ALLOWLIST(每条带理由)。
//
// Fix when red: 给该路由建 3 行 layout.tsx 调 pageMetadata('<route>'),并在
// lib/page-meta.ts 加一条双语 title;参数化路由照 app/[lang]/math/group/[slug]/layout.tsx
// 写 generateMetadata。
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const APP = join(ROOT, 'app', '[lang]');

// 路由(相对 [lang] 的 posix 路径)→ 豁免理由。
//
// 前 7 条是**哨兵壳**:dynamicParams=false + generateStaticParams 返回 '_',真实
// URL 被 rewrite 到 /_,服务端根本拿不到参数值。要给它们真标题只能改成动态渲染,
// 而那是唯一会撞 Vercel 配额的改动(见 AGENTS.md「省 Vercel 配额」②)。这些页的
// tab 标题仍由客户端 hook 提供 —— 用户看得对,爬虫看不到,是刻意的取舍。
// 后 2 条是 dev/poc 页,app/sitemap.ts 的 EXCLUDE 也把它们排除在站点地图外。
const ALLOWLIST = new Map<string, string>([
  ['alg/[puzzle]/[set]/[subgroup]', '哨兵壳:ZBLL 等 umbrella 集的 subgroup,服务端拿不到 puzzle/set/subgroup'],
  ['calendar/s/[token]', '哨兵壳:分享 token 服务端不可见,且本就 noindex(拿到链接才能看)'],
  ['forum/f/[slug]', '哨兵壳:板块 slug 服务端不可见'],
  ['memo/colpi/[pair]', '哨兵壳:字母对服务端不可见'],
  ['recon/person/[wcaId]', '哨兵壳:WCA ID 服务端不可见'],
  ['recon/submit/[editId]', '哨兵壳:提交表单,且本就 noindex'],
  ['wca/comp/[slug]', '哨兵壳:~17k 比赛页,robots.txt 同样 Disallow'],
  ['wca/persons/[wcaId]', '哨兵壳:~200k 选手页,robots.txt 同样 Disallow'],
  ['ffmpeg-poc', 'dev/poc 页,不进站点地图(app/sitemap.ts EXCLUDE)'],
  ['jsonEditor', 'dev/poc 页,不进站点地图(app/sitemap.ts EXCLUDE)'],
]);

const HAS_GENERATE_METADATA = /export\s+(?:async\s+)?(?:function|const)\s+generateMetadata\b/;

/** app/[lang]/** 里每个含 page.tsx 的目录 = 一个路由。跳过 _private 与 (group)。 */
function scanRoutes(): { route: string; dir: string }[] {
  const out: { route: string; dir: string }[] = [];
  const walk = (dir: string, rel: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.isFile() && e.name === 'page.tsx')) out.push({ route: rel, dir });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const c = e.name[0];
      if (c === '_' || c === '(') continue;
      walk(join(dir, e.name), rel ? `${rel}/${e.name}` : e.name);
    }
  };
  walk(APP, '');
  return out;
}

/** lib/page-meta.ts 的顶层 key(不解析 TS,只认这一种写法:行首两空格 + 引号 key)。 */
function pageMetaKeys(): Set<string> {
  const src = readFileSync(join(ROOT, 'lib', 'page-meta.ts'), 'utf8');
  return new Set([...src.matchAll(/^ {2}'((?:[^'\\]|\\.)*)':\s*\{/gm)].map((m) => m[1]));
}

interface Source { kind: 'pageMetadata' | 'generateMetadata'; key?: string }

/** 只看**该路由自己目录**里的 layout.tsx / page.tsx —— 祖先的不算。
 *  layout 优先;首页是唯一把 pageMetadata 写在 page.tsx 里的路由(它那一层的
 *  layout 包着全站,不能用来放首页 metadata),所以两个文件都要认。 */
function ownSource(dir: string): Source | null {
  for (const file of ['layout.tsx', 'page.tsx']) {
    const p = join(dir, file);
    if (!existsSync(p)) continue;
    const s = readFileSync(p, 'utf8');
    const m = s.match(/pageMetadata\('([^']*)'\)/);
    if (m) return { kind: 'pageMetadata', key: m[1] };
    if (HAS_GENERATE_METADATA.test(s)) return { kind: 'generateMetadata' };
  }
  return null;
}

const ROUTES = scanRoutes();
const KEYS = pageMetaKeys();
const SOURCES = new Map(ROUTES.map((r) => [r.route, ownSource(r.dir)]));

describe('every route owns its page metadata', () => {
  it('scans a plausible number of routes (guard against a broken walk)', () => {
    expect(ROUTES.length).toBeGreaterThan(200);
    expect(KEYS.size).toBeGreaterThan(150);
  });

  it('no route is missing a title source', () => {
    const missing = ROUTES
      .filter((r) => !SOURCES.get(r.route) && !ALLOWLIST.has(r.route))
      .map((r) => r.route);
    expect(
      missing,
      `这些路由没有自己的 metadata:给每个建 3 行 layout.tsx 调 pageMetadata('<route>')\n` +
        `+ 在 lib/page-meta.ts 加双语 title。真拿不到 param 的哨兵壳才加进本文件 ALLOWLIST(带理由)。\n` +
        missing.map((r) => `  - ${r}`).join('\n'),
    ).toEqual([]);
  });

  it("no pageMetadata('key') points at a missing PAGE_META entry", () => {
    const bad: string[] = [];
    for (const [route, src] of SOURCES) {
      if (src?.kind === 'pageMetadata' && src.key && !KEYS.has(src.key)) {
        bad.push(`${route} -> pageMetadata('${src.key}')`);
      }
    }
    expect(
      bad,
      `key 拼错时 pageMetadata 静默返回 {},页面无声地退回站级默认标题:\n` +
        bad.map((b) => `  - ${b}`).join('\n'),
    ).toEqual([]);
  });

  it('no orphan PAGE_META entries', () => {
    const used = new Set(
      [...SOURCES.values()].filter((s) => s?.kind === 'pageMetadata').map((s) => s!.key!),
    );
    const orphans = [...KEYS].filter((k) => !used.has(k));
    expect(
      orphans,
      `PAGE_META 里有条目没有任何 layout 引用 —— 多半是路由改名/删除后留下的:\n` +
        orphans.map((o) => `  - '${o}'`).join('\n'),
    ).toEqual([]);
  });

  it('every ALLOWLIST entry is still a real route (no stale exemptions)', () => {
    const routes = new Set(ROUTES.map((r) => r.route));
    const stale = [...ALLOWLIST.keys()].filter((r) => !routes.has(r));
    expect(stale, `ALLOWLIST 里的路由已不存在,删掉:\n${stale.join('\n')}`).toEqual([]);
  });

  it('no ALLOWLIST entry has quietly gained its own metadata', () => {
    const nowCovered = [...ALLOWLIST.keys()].filter((r) => SOURCES.get(r));
    expect(
      nowCovered,
      `这些路由已经有自己的 metadata 了,从 ALLOWLIST 里删掉:\n${nowCovered.join('\n')}`,
    ).toEqual([]);
  });
});
