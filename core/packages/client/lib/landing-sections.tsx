// Landing-page visuals enrich the runtime-neutral directory shared by the
// website and Mini Program. Destinations, order and copy stay in one catalog.

import {
  Film, ScanSearch, BookOpen, Shuffle, Library, BookA,
  Compass, Grid2x2, Trophy, Timer as TimerIcon, Code as CodeIcon,
  Brain, Box, Sigma, Scale, Sprout, Brush, MessageCircle, MessagesSquare, Shapes, Blocks, Eye, Palette,
  CircleQuestionMark, Globe2, CalendarDays, Video, GraduationCap, School, Building2,
  FileText, Table2, Award, Radio, PanelsTopLeft, UserRound, UsersRound, HardDrive, ListOrdered,
  Images, Music2, Gamepad2,
  type LucideIcon,
} from 'lucide-react';
import {
  SITE_DIRECTORY_GROUPS,
  SITE_DIRECTORY_TEXTS,
  type SiteDirectoryEntry,
} from '@cuberoot/shared/site-directory';
import { type LandingSearchCard } from '@/components/LandingSearch';
import { PAGE_META } from '@/lib/page-meta';
import { PLATFORM_ROUTES } from '@/lib/platform-routes';
import { TOC } from '@/app/[lang]/math/group/_data/toc';
import { REG_ARTICLES, regArticleHref } from '@/app/[lang]/regulation/_data/articles';
import { LLM_TOOLS_META } from '@/app/[lang]/dev/llm/_lib/llm_meta';

export const TEXTS = SITE_DIRECTORY_TEXTS;

export type Tier = 'medium' | 'standard' | 'utility';

export interface CardConfig {
  id: string;
  href: string;
  internal: boolean;
  tier: Tier;
  Icon?: LucideIcon;
  iconImg?: string;
  nameKey: keyof typeof TEXTS;
  comingSoon?: boolean;
  adminOnly?: boolean;
  lockedForNonAdmin?: boolean;
}

type I18n = { en: string; zh: string; };
export interface Section {
  id: string;
  eyebrow: I18n;
  title: I18n;
  sub: I18n;
  cards: CardConfig[];
}

export { applyCardOrder as applyLandingCardOrder } from './card-order';

interface CardVisual {
  Icon?: LucideIcon;
  iconImg?: string;
}

const CARD_VISUALS: Partial<Record<SiteDirectoryEntry['id'], CardVisual>> = {
  timer: { Icon: TimerIcon },
  algdb: { Icon: Blocks },
  sim: { Icon: Box },
  space: { Icon: Shapes },
  'paper-odyssey': { Icon: Gamepad2 },
  recon: { Icon: ScanSearch },
  scramble: { Icon: Shuffle },
  competitions: { Icon: Radio },
  'wca-records': { Icon: Trophy },
  'wca-results': { Icon: ListOrdered },
  'wca-stats': { iconImg: '/icons/wca.svg' },
  memo: { Icon: Brain },
  predict: { Icon: Eye },
  'color-test': { Icon: Palette },
  blddb: { iconImg: '/icons/upstream/blddb.png' },
  trainer: { iconImg: '/icons/upstream/algtrainer.png' },
  cstimer: { iconImg: '/cstimer_logo.png' },
  contests: { iconImg: '/icons/upstream/recordranks.png' },
  'online-competitions': { Icon: Trophy },
  'comp-sim': { Icon: Radio },
  'frame-count': { Icon: Film },
  solver: { iconImg: '/icons/upstream/solver.png' },
  mosaic: { Icon: Grid2x2 },
  paint: { Icon: Brush },
  icon: { Icon: Shapes },
  timezone: { Icon: Globe2 },
  calendar: { Icon: CalendarDays },
  platform: { Icon: PanelsTopLeft },
  'teaching-management': { Icon: Building2 },
  'learning-center': { Icon: BookOpen },
  teaching: { Icon: GraduationCap },
  teachers: { Icon: School },
  'live-scripts': { Icon: Radio },
  meet: { Icon: Video },
  documents: { Icon: FileText },
  interview: { Icon: MessagesSquare },
  partnership: { Icon: Sprout },
  spreadsheets: { Icon: Table2 },
  alg: { Icon: Library },
  quiz: { Icon: CircleQuestionMark },
  wiki: { Icon: BookA },
  regulation: { Icon: Scale },
  notation: { Icon: FileText },
  'math-hub': { Icon: Sigma },
  'why-cube': { Icon: Sprout },
  gallery: { Icon: Images },
  forum: { Icon: MessagesSquare },
  music: { Icon: Music2 },
  drive: { Icon: HardDrive },
  contact: { Icon: UsersRound },
  feedback: { Icon: MessageCircle },
  dev: { Icon: CodeIcon },
  blog: { Icon: BookOpen },
  site: { Icon: Compass },
  wb: { Icon: Trophy },
  achievements: { Icon: Award },
  creator: { Icon: UserRound },
};

function toCardConfig(entry: SiteDirectoryEntry): CardConfig {
  return {
    id: entry.id,
    href: entry.href,
    internal: entry.internal,
    tier: entry.tier,
    nameKey: entry.nameKey,
    ...CARD_VISUALS[entry.id],
    ...('adminOnly' in entry && entry.adminOnly ? { adminOnly: true } : {}),
    ...('lockedForNonAdmin' in entry && typeof entry.lockedForNonAdmin === 'boolean'
      ? { lockedForNonAdmin: entry.lockedForNonAdmin }
      : {}),
  };
}

// The website keeps its existing visual placements while consuming the same
// ordered entries that power the Mini Program directory.
export const PRIMARY_CARDS: CardConfig[] = SITE_DIRECTORY_GROUPS
  .filter((group) => group.placement === 'primary')
  .flatMap((group) => group.entries.map(toCardConfig));

export const WCA_CARDS: CardConfig[] = SITE_DIRECTORY_GROUPS
  .filter((group) => group.placement === 'wca')
  .flatMap((group) => group.entries.map(toCardConfig));

export const SECTIONS: Section[] = SITE_DIRECTORY_GROUPS
  .filter((group) => group.placement === 'section')
  .map((group) => ({
    id: group.id,
    eyebrow: group.eyebrow,
    title: group.title,
    sub: group.sub,
    cards: group.entries.map(toCardConfig),
  }));

export const FOOTER_ENTRIES = SITE_DIRECTORY_GROUPS
  .filter((group) => group.placement === 'footer')
  .flatMap((group) => group.entries);

// All cards (incl. WCA hero, sans coming-soon) flattened for LandingSearch.
const DIRECTORY_SEARCH_CARDS: LandingSearchCard[] = [
  { id: 'stats', href: '/wca', internal: true, nameEn: 'WCA', nameZh: 'WCA', sectionTitleEn: 'WCA', sectionTitleZh: 'WCA' },
  // 主入口卡不在 SECTIONS 里，单列于此，否则全站搜索会漏掉它们。
  ...PRIMARY_CARDS.map(c => ({
    id: c.id,
    href: c.href,
    internal: c.internal,
    nameEn: TEXTS[c.nameKey].en,
    nameZh: TEXTS[c.nameKey].zh,
    sectionTitleEn: 'MAIN',
    sectionTitleZh: 'MAIN 主要',
  })),
  ...SECTIONS.flatMap(sec =>
    sec.cards
      .filter(c => !c.comingSoon)
      .map(c => ({
        id: c.id,
        href: c.href,
        internal: c.internal,
        adminOnly: c.adminOnly,
        lockedForNonAdmin: c.lockedForNonAdmin,
        nameEn: TEXTS[c.nameKey].en,
        nameZh: TEXTS[c.nameKey].zh,
        sectionTitleEn: sec.eyebrow.en,
        sectionTitleZh: sec.eyebrow.zh,
      })),
  ),
  // 颜色测试的三个子项收在入口页里，这里保留直达搜索。
  { id: 'color-relations', href: '/color-test/relations', internal: true, nameEn: 'Opposite or Adjacent?', nameZh: '对色与邻色', sectionTitleEn: 'Colour Tests', sectionTitleZh: '颜色测试' },
  { id: 'color-positions', href: '/color-test/positions', internal: true, nameEn: 'Side Colour Order', nameZh: '侧面颜色顺序', sectionTitleEn: 'Colour Tests', sectionTitleZh: '颜色测试' },
  { id: 'stroop', href: '/stroop', internal: true, nameEn: 'Stroop', nameZh: 'Stroop', sectionTitleEn: 'Colour Tests', sectionTitleZh: '颜色测试' },
  // /dev 子页不在落地页网格上，单列于此让全站搜索仍能找到。
  { id: 'dev-llm', href: '/dev/llm', internal: true, nameEn: 'Large Language Models', nameZh: '大模型', sectionTitleEn: 'Dev', sectionTitleZh: '开发' },
  { id: 'fable', href: '/dev/llm/fable', internal: true, nameEn: 'Claude Fable 5', nameZh: 'Claude Fable 5', sectionTitleEn: 'Dev', sectionTitleZh: '开发' },
];

// The homepage directory is only a set of entry points, not the full site.
// Derive deep links from the same bilingual metadata/catalogs as their pages;
// adding a titled static page must not require another hand-written search row.
// These metadata keys describe contextual shells, internal tools or actions,
// rather than independently browsable content. Dynamic [param] keys are also
// excluded below; real dynamic content is enumerated from its own catalog.
const SEARCH_EXCLUDED_ROUTES = new Set([
  '', 'search', 'partnership', 'partnership/talking-points', 'vault',
  'teachers-edit', 'wca/persons/students', 'alg/lsll/case', 'alg/lsll/route',
  'recon/ground-truth', 'recon/submit', 'recon/submit-sketch',
]);

const PAGE_SEARCH_CARDS: LandingSearchCard[] = Object.entries(PAGE_META)
  .filter(([route]) => !route.includes('[')
    && !SEARCH_EXCLUDED_ROUTES.has(route)
    && !/(^|\/)(admin|edit|manage|review|new)(\/|$)/.test(route))
  .map(([route, meta]) => {
    const parent = route.includes('/') ? route.slice(0, route.lastIndexOf('/')) : null;
    const section = (parent ? PAGE_META[parent]?.title : undefined) ?? { zh: '页面', en: 'Pages' };
    return {
      id: `page:${route}`,
      href: `/${route}`,
      internal: true,
      nameEn: meta.title.en,
      nameZh: meta.title.zh,
      sectionTitleEn: section.en,
      sectionTitleZh: section.zh,
      keywords: `${meta.description?.en ?? ''}\n${meta.description?.zh ?? ''}`,
    };
  });

const CATALOG_SEARCH_CARDS: LandingSearchCard[] = [
  // WCA and footer entries also belong in search, even without a grid card.
  ...SITE_DIRECTORY_GROUPS.flatMap(group => group.entries.map(entry => ({
    id: entry.id,
    href: entry.href,
    internal: entry.internal,
    adminOnly: 'adminOnly' in entry && entry.adminOnly === true,
    lockedForNonAdmin: 'lockedForNonAdmin' in entry && entry.lockedForNonAdmin === true,
    nameEn: TEXTS[entry.nameKey].en,
    nameZh: TEXTS[entry.nameKey].zh,
    sectionTitleEn: group.eyebrow.en,
    sectionTitleZh: group.eyebrow.zh,
  }))),
  ...TOC.map(section => ({
    id: `group:${section.id}`,
    href: `/math/group/${section.id}`,
    internal: true,
    nameEn: section.en,
    nameZh: section.zh,
    sectionTitleEn: PAGE_META['math/group'].title.en,
    sectionTitleZh: PAGE_META['math/group'].title.zh,
  })),
  ...REG_ARTICLES.map(article => ({
    id: `regulation:${article.slug}`,
    href: regArticleHref(article),
    internal: true,
    nameEn: article.title.en,
    nameZh: article.title.zh,
    sectionTitleEn: PAGE_META.regulation.title.en,
    sectionTitleZh: PAGE_META.regulation.title.zh,
    keywords: `${article.num}\n${article.tagline.en}\n${article.tagline.zh}`,
  })),
  ...LLM_TOOLS_META.map(tool => ({
    id: `llm:${tool.slug}`,
    href: `/dev/llm/${tool.slug}`,
    internal: true,
    nameEn: tool.name,
    nameZh: tool.name,
    sectionTitleEn: PAGE_META['dev/llm'].title.en,
    sectionTitleZh: PAGE_META['dev/llm'].title.zh,
    keywords: `${tool.zh.tagline}\n${tool.en.tagline}\n${tool.zh.role}\n${tool.en.role}`,
  })),
  ...PLATFORM_ROUTES
    .filter(route => route.access === 'public' && route.pattern
      && !route.pattern.includes(':') && !route.canonicalHref
      && !['search', 'offline', 'login'].includes(route.id))
    .map(route => ({
      id: `platform:${route.id}`,
      href: `/platform/${route.pattern}`,
      internal: true,
      nameEn: route.title.en,
      nameZh: route.title.zh,
      sectionTitleEn: PAGE_META.platform.title.en,
      sectionTitleZh: PAGE_META.platform.title.zh,
      keywords: `${route.description.en}\n${route.description.zh}`,
    })),
];

// Keep the directory's names, IDs and visibility flags when the same URL also
// appears in metadata. Merge aliases so alternate names remain searchable.
export const SEARCH_CARDS: LandingSearchCard[] = (() => {
  const byHref = new Map<string, LandingSearchCard>();
  for (const card of [...DIRECTORY_SEARCH_CARDS, ...CATALOG_SEARCH_CARDS, ...PAGE_SEARCH_CARDS]) {
    const existing = byHref.get(card.href);
    if (existing) {
      existing.adminOnly ||= card.adminOnly;
      existing.lockedForNonAdmin ||= card.lockedForNonAdmin;
      existing.keywords = [existing.keywords, card.nameEn, card.nameZh, card.keywords]
        .filter(Boolean).join('\n');
    } else {
      byHref.set(card.href, { ...card });
    }
  }
  return [...byHref.values()];
})();

export function isLandingSearchCardVisible(card: Pick<LandingSearchCard, 'adminOnly' | 'lockedForNonAdmin'>, isAdmin: boolean): boolean {
  return isAdmin || (!card.adminOnly && !card.lockedForNonAdmin);
}
