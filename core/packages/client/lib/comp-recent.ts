// 比赛「最近浏览」的 localStorage 读写(列表页 /wca/comp 与详情页 /wca/comp/[slug] 共用)。
//
// 从 app/[lang]/wca/comp/page.tsx 提取出来:详情页只需要 rememberRecent 这一个函数,
// 但从列表页模块 import 会把整张日历页(MonthGrid / OnThisDayModal / CompCuberPicker /
// comp-records + calendar_page.css 54KB)拖进详情页 bundle。
//
// issue #33:最近浏览只属于登录用户 —— 按 ownerKey 分桶存取,未登录不记录,列表区
// 显示登录入口。老共享桶('comp.recent')在该设备首个登录用户读取时迁移进用户桶后删除。
import { getOwnerKey } from '@/lib/auth-store';
import { persistItem } from '@/lib/safe-storage';

const RECENT_KEY_LEGACY = 'comp.recent';
const RECENT_MAX = 12;

export function recentKeyFor(ownerKey: string): string {
  return `comp.recent.${ownerKey}`;
}

export interface RecentEntry {
  slug: string;
  name: string;
  // 详情页查看时实时解析的中文名(cubing.com 原始全名,含 WCA/魔方),localizeCompName 会 stripWcaPrefix。
  // 持久化它,使最近浏览不必等 comp_names_zh.json 日更也能显示新比赛中文名。
  nameZh?: string;
  // 同理持久化国家 iso2(新比赛尚未进 comp_countries.json 时 compFlagIso2 查不到,用它兜底渲染国旗)。
  iso2?: string;
  viewedAt: number;
}

export function loadRecent(ownerKey: string): RecentEntry[] {
  if (typeof window === 'undefined' || !ownerKey) return [];
  try {
    let raw = localStorage.getItem(recentKeyFor(ownerKey));
    if (!raw) {
      // 老共享桶一次性迁移到当前用户桶(仅设备上第一个登录用户继承,随后删除)
      raw = localStorage.getItem(RECENT_KEY_LEGACY);
      if (!raw) return [];
      persistItem(recentKeyFor(ownerKey), raw);
      localStorage.removeItem(RECENT_KEY_LEGACY);
    }
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const valid = arr.filter((e): e is RecentEntry =>
      e && typeof e.slug === 'string' && typeof e.name === 'string' && typeof e.viewedAt === 'number'
      && (e.nameZh == null || typeof e.nameZh === 'string')
      && (e.iso2 == null || typeof e.iso2 === 'string'),
    );
    const dedup = new Map<string, RecentEntry>();
    for (const e of valid) {
      const norm = { ...e, slug: e.slug.replace(/-/g, '') };
      const existing = dedup.get(norm.slug);
      if (!existing || existing.viewedAt < norm.viewedAt) dedup.set(norm.slug, norm);
    }
    return [...dedup.values()].sort((a, b) => b.viewedAt - a.viewedAt);
  } catch { return []; }
}

export function rememberRecent(slug: string, name: string, nameZh?: string, iso2?: string) {
  if (typeof window === 'undefined') return;
  // 未登录不记录(issue #33:最近浏览是登录用户自己的浏览史)
  const ownerKey = getOwnerKey();
  if (!ownerKey) return;
  try {
    const norm = slug.replace(/-/g, '');
    const all = loadRecent(ownerKey);
    // nameZh / iso2 缺省时保留旧记录里已有的(例如 EN 模式再次访问不该抹掉之前解析到的中文 / 国旗)
    const prev = all.find(r => r.slug === norm);
    const cur = all.filter(r => r.slug !== norm);
    const entry: RecentEntry = { slug: norm, name, nameZh: nameZh ?? prev?.nameZh, iso2: iso2 ?? prev?.iso2, viewedAt: Date.now() };
    const next: RecentEntry[] = [entry, ...cur].slice(0, RECENT_MAX);
    persistItem(recentKeyFor(ownerKey), JSON.stringify(next));
  } catch { /* quota */ }
}
