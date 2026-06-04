/**
 * 从 subscriptions.txt 批量匹配 WCA 选手,填充 channel_aliases.json —— 移植自退役
 * Python build_channel_aliases.py。只保存精确匹配(API 返回恰好 1 人且名字完全一致)。
 *
 * 跑法(从 core/):
 *   pnpm --filter @cuberoot/server exec tsx src/tools/build_channel_aliases.ts <subscriptions.txt 路径>
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ALIASES_PATH = join(SCRIPT_DIR, 'channel_aliases.json');
const WCA_API = 'https://www.worldcubeassociation.org/api/v0';

// 含这些关键词的频道名大概率不是个人选手,跳过省 API
const SKIP_KEYWORDS = [
  'music', 'studio', 'news', 'topic', 'gaming', 'records', 'official',
  'channel', 'productions', 'films', 'entertainment', 'network',
  'podcast', 'airline', 'aviation', 'tutorial', 'shorts',
  'beats', 'remix', 'royalty', 'copyright', 'relaxa', 'ambient',
  'piano', 'guitar', 'symphony', 'orchestra',
  'google', 'apple', 'microsoft', 'amazon', 'nvidia', 'amd', 'intel',
  'adobe', 'canon', 'dji', 'gopro', 'samsung',
  'cctv', 'bbc', 'cnn', 'fox', 'hbo', 'disney',
  'cubing', 'cube ', 'cuber', 'rubik', 'speedcub', // 社区频道,非个人
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 粗筛:频道名像不像一个人名 */
function looksLikePersonName(name: string): boolean {
  if (name.length < 4 || name.length > 50) return false;
  const lower = name.toLowerCase();
  for (const kw of SKIP_KEYWORDS) if (lower.includes(kw)) return false;
  // 跳过全大写(品牌/组织):isupper = 有 cased 字符且全大写
  if (name === name.toUpperCase() && name !== name.toLowerCase() && name.length > 5) return false;
  if (['/', '|', '©', '®', '™'].some((c) => name.includes(c))) return false;
  return true;
}

interface Sub { title: string; channel_id: string }

/** 加载 subscriptions.txt → [{title, channel_id}]。每行 `title,url,channel_id`。 */
function loadSubscriptions(path: string): Sub[] {
  const subs: Sub[] = [];
  for (const raw of readFileSync(path, 'utf-8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    // Python line.split(",", 2) = 最多 3 段,第三段保留剩余逗号
    const first = line.indexOf(',');
    if (first < 0) continue;
    const second = line.indexOf(',', first + 1);
    if (second < 0) continue;
    const title = line.slice(0, first);
    const chId = line.slice(second + 1);
    subs.push({ title, channel_id: chId });
  }
  return subs;
}

interface AliasEntry { wca_id: string; channel_id?: string }

/** WCA API 搜索,仅返回名字精确匹配的唯一结果。 */
async function searchWcaExact(name: string): Promise<{ wca_id: string; name: string; country_iso2: string } | null> {
  try {
    const u = new URL(`${WCA_API}/search/users`);
    u.searchParams.set('q', name);
    u.searchParams.set('persons_table', 'true');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    let results: { wca_id: string; name: string; country_iso2?: string }[];
    try {
      const r = await fetch(u, { signal: ctrl.signal });
      const j = (await r.json()) as { result?: typeof results };
      results = j.result ?? [];
    } finally {
      clearTimeout(t);
    }
    const exact = results.filter((p) => p.name === name);
    if (exact.length === 1) {
      const p = exact[0]!;
      return { wca_id: p.wca_id, name: p.name, country_iso2: p.country_iso2 ?? '' };
    }
    return null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const subPath = process.argv[2];
  if (!subPath) {
    console.error('用法: build_channel_aliases.ts <subscriptions.txt 路径>(每行 title,url,channel_id)');
    process.exit(1);
  }
  if (!existsSync(subPath)) {
    console.log(`文件不存在: ${subPath}`);
    process.exit(1);
  }

  let aliases: Record<string, AliasEntry> = {};
  if (existsSync(ALIASES_PATH)) {
    aliases = JSON.parse(readFileSync(ALIASES_PATH, 'utf-8')) as Record<string, AliasEntry>;
  }
  const existingCount = Object.keys(aliases).length;
  const existingChIds = new Set(
    Object.values(aliases).map((v) => v.channel_id).filter((x): x is string => !!x),
  );

  const subs = loadSubscriptions(subPath);
  console.log(`订阅列表: ${subs.length} 个频道`);
  console.log(`已有映射: ${existingCount} 条`);

  const candidates = subs.filter(
    (s) => !(s.title in aliases) && !existingChIds.has(s.channel_id) && looksLikePersonName(s.title),
  );
  console.log(`待查询候选: ${candidates.length} 个(已过滤非人名和已缓存)`);
  console.log();

  let matched = 0;
  for (let i = 0; i < candidates.length; i++) {
    const { title: name, channel_id: chId } = candidates[i]!;
    process.stdout.write(`\r  [${i + 1}/${candidates.length}] 查询: ${name.slice(0, 40).padEnd(40)}`);

    const person = await searchWcaExact(name);
    if (person) {
      matched++;
      aliases[name] = { wca_id: person.wca_id, channel_id: chId };
      process.stdout.write(`\r  ✅ ${name} → ${person.wca_id} (${person.country_iso2})${' '.repeat(20)}\n`);
    }
    await sleep(500); // WCA API 频率限制
  }

  process.stdout.write(`\r${' '.repeat(80)}\n`);
  console.log(`\n完成! 新增 ${matched} 条映射(总计 ${Object.keys(aliases).length} 条)`);

  writeFileSync(ALIASES_PATH, JSON.stringify(aliases, null, 2), 'utf-8');
  console.log(`已保存到 ${ALIASES_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
