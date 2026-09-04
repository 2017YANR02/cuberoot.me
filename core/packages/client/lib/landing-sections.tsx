// Landing-page visuals enrich the runtime-neutral directory shared by the
// website and Mini Program. Destinations, order and copy stay in one catalog.

import {
  Film, ScanSearch, BookOpen, Shuffle, Library, BookA,
  Compass, Grid2x2, Trophy, Timer as TimerIcon, Code as CodeIcon,
  Brain, Box, Sigma, Scale, Sprout, Brush, MessageCircle, MessagesSquare, Shapes, Blocks, Eye, Palette,
  CircleQuestionMark, Globe2, CalendarDays, Video, GraduationCap, School, Building2,
  FileText, Table2, Award, Radio, PanelsTopLeft, UserRound, UsersRound, HardDrive, ListOrdered,
  Images, Music2,
  type LucideIcon,
} from 'lucide-react';
import {
  SITE_DIRECTORY_GROUPS,
  SITE_DIRECTORY_TEXTS,
  type SiteDirectoryEntry,
} from '@cuberoot/shared/site-directory';
import { type LandingSearchCard } from '@/components/LandingSearch';

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

export function applyLandingCardOrder(cards: CardConfig[], savedIds: readonly string[]): CardConfig[] {
  const remaining = new Map(cards.map((card) => [card.id, card]));
  const ordered = savedIds.flatMap((id) => {
    const card = remaining.get(id);
    if (!card) return [];
    remaining.delete(id);
    return [card];
  });
  return [...ordered, ...remaining.values()];
}

interface CardVisual {
  Icon?: LucideIcon;
  iconImg?: string;
}

const CARD_VISUALS: Partial<Record<SiteDirectoryEntry['id'], CardVisual>> = {
  timer: { Icon: TimerIcon },
  algdb: { Icon: Blocks },
  sim: { Icon: Box },
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
export const SEARCH_CARDS: LandingSearchCard[] = [
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

export function isLandingSearchCardVisible(card: LandingSearchCard, isAdmin: boolean): boolean {
  return isAdmin || (!card.adminOnly && !card.lockedForNonAdmin);
}
