// 归属键 ≠ WCA id 守卫。站内一切「作者 / 贡献者 / 投稿者」字段存的都是 ownerKey
// (shared/account.ts):绑了 WCA 的账号 = 真 wca_id,没绑的 = 合成 `u<uid>`。
// 拿它当 WCA id 直接拼档案页链接 → 死链:issue #45 的 /recon 详情页把复盘者 `u144`
// 拼成 worldcubeassociation.org/persons/u144(WCA 官网 404),站内 /wca/persons/u144
// 同样查无此人(API 404)。
//
// 出链判定收敛在两个单一入口,它们内部用 isWcaIdFormat 判定、非 WCA id 降级成纯文本:
//   - components/PersonLink.tsx  → 站内 /wca/persons/:id
//   - components/Discussion.tsx 的 AuthorName → WCA 官网外链(评论 / 另解 / 复盘贡献者)
// 本测试锁两件事:(1) 两个入口确实还带着判定;(2) 没人再拿 ownerKey 形态的变量
// 手搓 person 链接绕过它们。
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative, sep } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const SCAN_DIRS = ['app', 'components', 'lib', 'hooks'];

// ownerKey 形态的变量名:authorId / addedById / reconerId / actorKey / myKey / ownerKey …
// (`s.authorId`、`alt.addedById` 这种成员访问也要吃到,故前面允许一段 `x.` 前缀)
const OWNER_KEY_EXPR = String.raw`[\w.]*\b(?:author|added|adder|reconer|owner|actor|submitter|my)\w*(?:Id|Key)\b`;

// 拿 ownerKey 手搓 person 链接的两种写法。变量名启发式只挡「一眼看得出是归属键」的,
// issue #45 那处偏偏叫 `id`(renderContributor(name, id)),名字上无从判断 —— 所以真正
// 兜底的是下面的 wcaPersonUrl 调用方白名单。
const FORBIDDEN: { re: RegExp; name: string }[] = [
  { re: new RegExp(String.raw`personHref\s*\(\s*${OWNER_KEY_EXPR}`), name: 'personHref(<ownerKey>)' },
  {
    re: new RegExp(String.raw`/(?:wca/)?persons/\$\{[^}]*${OWNER_KEY_EXPR}`),
    name: '`…/persons/${<ownerKey>}`',
  },
];

// wcaPersonUrl 直接拼 worldcubeassociation.org/persons/:id,不带任何判定 —— 只有
// 「id 一定是真 WCA id」的地方能调。新调用方必须先想清楚 id 属于哪个身份空间:
// 归属键走 AuthorName,WCA 数据才可以直调。
const WCA_PERSON_URL_CALLERS = new Set([
  'lib/recon-utils.ts',                         // 定义处
  'components/Discussion.tsx',                  // AuthorName:唯一带 isWcaIdFormat 判定的出链点
  'components/wca-stats/Top10HistoryPage.tsx',  // row.pid 来自 WCA 统计 JSON,恒为真 WCA id
  'components/wca-stats/SorRace.tsx',           // 同上
]);

function walk(dir: string): string[] {
  let out: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next') continue;
      out = out.concat(walk(join(dir, ent.name)));
    } else if (/\.tsx?$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) {
      out.push(join(dir, ent.name));
    }
  }
  return out;
}

describe('ownerKey is not a WCA id', () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

  it('scans a meaningful number of source files', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('PersonLink degrades non-WCA ids to plain text', () => {
    const src = readFileSync(join(ROOT, 'components', 'PersonLink.tsx'), 'utf8');
    expect(src).toMatch(/isWcaIdFormat/);
    expect(src, 'PersonLink 必须在非 WCA id 时返回纯文本,不渲染 /wca/persons/:id 链接')
      .toMatch(/if\s*\(\s*!\s*isWcaIdFormat\s*\(/);
  });

  it('AuthorName only links a real WCA id to the WCA site', () => {
    const src = readFileSync(join(ROOT, 'components', 'Discussion.tsx'), 'utf8');
    expect(src).toMatch(/export function AuthorName/);
    expect(src, 'AuthorName 的 WCA 外链必须由 isWcaIdFormat 把关')
      .toMatch(/isWcaIdFormat\s*\(\s*id\s*\)\s*\?/);
  });

  it('wcaPersonUrl is only called where the id is guaranteed to be a real WCA id', () => {
    const callers: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).split(sep).join('/');
      if (!/\bwcaPersonUrl\s*\(/.test(readFileSync(file, 'utf8'))) continue;
      if (!WCA_PERSON_URL_CALLERS.has(rel)) callers.push(rel);
    }
    expect(
      callers,
      'wcaPersonUrl() 不做任何判定,直接拼 WCA 官网档案页 —— 只有 id 恒为真 WCA id 的地方能调。\n' +
        '作者 / 贡献者名请用 <AuthorName id={…} name={…} />(components/Discussion.tsx),它按 isWcaIdFormat 决定出不出链。\n' +
        '确认新调用方的 id 来自 WCA 数据 → 把文件加进本测试的 WCA_PERSON_URL_CALLERS 并写明来源。\n' +
        '命中:\n' +
        callers.join('\n'),
    ).toEqual([]);
  });

  it('no source builds a person profile link straight from an ownerKey', () => {
    const violations: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).split(sep).join('/');
      const src = readFileSync(file, 'utf8');
      for (const f of FORBIDDEN) {
        if (f.re.test(src)) violations.push(`${rel} → ${f.name}`);
      }
    }
    expect(
      violations,
      '作者 / 贡献者字段是归属键 ownerKey(可能是合成 `u<uid>`),不能直接当 WCA id 拼档案页链接。\n' +
        '站内链接用 <PersonLink wcaId={…}>(非 WCA id 自动降级成纯文本),\n' +
        'WCA 官网外链用 <AuthorName id={…} name={…} />(components/Discussion.tsx)。\n' +
        '命中:\n' +
        violations.join('\n'),
    ).toEqual([]);
  });
});
