// Landing-page section data — extracted from app/[lang]/page.tsx so both the
// home page and the global desk-pet search overlay can share SEARCH_CARDS
// without duplicating the card list.

import {
  Film, ScanSearch, BookOpen, Shuffle, Library, BookA,
  Compass, Grid2x2, Trophy, Timer as TimerIcon, Code as CodeIcon,
  Brain, Box, Sigma, Scale, Sprout, Brush, MessageCircle, MessagesSquare, Shapes, Blocks, Eye, Palette,
  CircleQuestionMark, Globe2, CalendarDays, Video, GraduationCap, School, Building2,
  FileText, Table2, Award, Radio, PanelsTopLeft, UserRound, UsersRound, HardDrive,
  type LucideIcon,
} from 'lucide-react';
import { type LandingSearchCard } from '@/components/LandingSearch';
import { CREATOR_PROFILE } from '@/lib/creator-profile';

// i18n text map — bilingual mirror of the Vite original's TEXTS table.
export const TEXTS: Record<string, { en: string; zh: string
 }> = {
  brand:           { en: 'CubeRoot', zh: 'CubeRoot' },
  solver:          { en: 'or18 Solver', zh: 'or18 求解器' },
  wcaStats:        { en: 'WCA', zh: 'WCA' },
  recon:           { en: 'Recon', zh: '复盘'
},
  algTrainer:      { en: 'mihlefeld Trainer', zh: 'mihlefeld 训练器'
},
  blddb:           { en: 'BLDDB', zh: 'BLDDB' },
  hthGrapher:      { en: 'Calculator', zh: '计算器'
},
  viz:             { en: 'Distribution', zh: '分布'
},
  upcoming:        { en: 'Calendar', zh: '日历'
},
  globe:           { en: 'Globe', zh: '地球' },
  cstimer:         { en: 'csTimer', zh: 'csTimer' },
  contests:        { en: 'Contests', zh: '比赛系统' },
  timer:           { en: 'Timer', zh: '计时'
},
  predict:         { en: 'Lookahead', zh: '预判'
},
  colorTest:       { en: 'Colour Tests', zh: '颜色测试'
},
  frameCount:      { en: 'Frame Count', zh: '数帧'
},
  scramble:        { en: 'Scramble', zh: '打乱'
},
  alg:             { en: 'Tutorial',   zh: '教程' },
  teachingManagement: { en: 'Teaching', zh: '教学管理' },
  learningCenter:  { en: 'Learning Center', zh: '学习中心' },
  teaching:        { en: 'Courses', zh: '课程' },
  platform:        { en: 'Platform', zh: 'Platform' },
  teachers:        { en: 'Teachers & Schools', zh: '老师与机构' },
  liveScripts:     { en: 'Live Scripts', zh: '直播话术' },
  documents:       { en: 'Docs', zh: '文档' },
  spreadsheets:    { en: 'Sheets', zh: '表格' },
  algdb:           { en: 'Algorithms', zh: '公式' },
  wiki:            { en: 'Wiki', zh: 'Wiki' },
  notation:        { en: 'Notation', zh: '记号' },
  quiz:            { en: 'Quiz', zh: '问答' },
  sitesDirectory:  { en: 'Web', zh: '网站'
},
  mosaic:          { en: 'Mosaic', zh: '马赛克'
},
  worldBests:      { en: 'World Bests', zh: '非官方纪录'
},
  blog:            { en: 'Blog', zh: '博客'
},
  prediction:      { en: 'Prediction', zh: '预测'
},
  paint:           { en: 'Paint', zh: '绘制'
},
  analyze:         { en: 'Analyzer', zh: '打乱分析'
},
  gen:             { en: 'Scrambles', zh: '生成打乱'
},
  memo:            { en: 'Memo', zh: '记忆'
},
  dev:             { en: 'Dev', zh: '开发'
},
  timezone:        { en: 'Time Zones', zh: '时区'
},
  calendar:        { en: 'Calendar', zh: '日历'
},
  sim:             { en: 'Sim', zh: '模拟'
},
  compSim:         { en: 'Comp Sim', zh: '比赛模拟' },
  icon:            { en: 'Icons', zh: '图标'
},
  comp:            { en: 'Comp', zh: '比赛'
},
  theoryGroup:     { en: 'Math', zh: '数学'
},
  regulation:      { en: 'Regulation', zh: '规则'
},
  whyCube:         { en: 'Why Cube', zh: '为何学魔方'
},
  forum:           { en: 'Forum', zh: '论坛' },
  contact:         { en: 'Contact', zh: '联系' },
  feedback:        { en: 'Feedback', zh: '反馈' },
  meet:            { en: 'Meeting', zh: '会议' },
  achievements:    { en: 'Achievements', zh: '成就' },
  drive:           { en: 'Drive', zh: '网盘' },
  creator:         { en: 'Ruimin Yan', zh: '颜瑞民' },
  comingSoon:      { en: 'Coming soon', zh: '即将上线'
},
  creditsPrefix:   { en: 'Inspired by', zh: '致谢'
},
};

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

// 主入口 — 搜索框正下方的整行直达卡,从 train / tool 分组里提上来,分组里不再重复出现。
export const PRIMARY_CARDS: CardConfig[] = [
  { id: 'timer',    href: '/timer',    internal: true, tier: 'medium', Icon: TimerIcon,  nameKey: 'timer' },
  { id: 'algdb',    href: '/alg',      internal: true, tier: 'medium', Icon: Blocks,     nameKey: 'algdb' },
  { id: 'sim',      href: '/sim',      internal: true, tier: 'medium', Icon: Box,        nameKey: 'sim' },
  { id: 'recon',    href: '/recon',    internal: true, tier: 'medium', Icon: ScanSearch, nameKey: 'recon' },
  { id: 'scramble', href: '/scramble', internal: true, tier: 'medium', Icon: Shuffle,    nameKey: 'scramble' },
];

export const SECTIONS: Section[] = [
  {
    id: 'train',
    eyebrow: { en: 'TRAIN', zh: '训练' },
    title:   { en: 'Recall, look ahead, drill.', zh: '记忆、预判、背公式。'
    },
    sub:     { en: 'Memory drills, lookahead practice and colour relationship and interference tests, plus the blindfolded algorithm database and two classic algorithm trainers. Head-to-head battles live inside the timer.', zh: '盲拧记忆、预判练习、颜色关系与色词干扰测试,外加盲拧公式库与两套经典公式训练器;双人对战在计时器里。'
    },
    cards: [
      { id: 'memo',     href: '/memo',         internal: true, tier: 'standard', Icon: Brain,     nameKey: 'memo' },
      { id: 'predict',  href: '/predict',      internal: true, tier: 'standard', Icon: Eye,       nameKey: 'predict' },
      { id: 'color-test', href: '/color-test',  internal: true, tier: 'standard', Icon: Palette,   nameKey: 'colorTest' },
      { id: 'blddb',    href: '/blddb',        internal: true, tier: 'standard', iconImg: '/icons/upstream/blddb.png', nameKey: 'blddb' },
      { id: 'trainer',  href: '/alg-trainers', internal: true, tier: 'standard', iconImg: '/icons/upstream/algtrainer.png', nameKey: 'algTrainer' },
      { id: 'cstimer',  href: '/cstimer',      internal: true, tier: 'standard', nameKey: 'cstimer', iconImg: '/cstimer_logo.png' },
    ],
  },
  {
    id: 'tool',
    eyebrow: { en: 'TOOL', zh: '工具' },
    title:   { en: 'Solve, count, make.', zh: '求解、数帧、创作。'
    },
    sub:     { en: 'A solver for any scramble and frame-accurate timing, plus competition management, cube mosaics, vector drawings, event icons, time zone conversion and a shareable calendar.', zh: '把任意打乱交给求解器、逐帧核对成绩,也能管理比赛、拼马赛克、画矢量图、生成项目图标、换算时区和分享日历。'
    },
    cards: [
      { id: 'contests',     href: '/contests',    internal: true, tier: 'medium', iconImg: '/icons/upstream/recordranks.png', nameKey: 'contests' },
      { id: 'comp-sim',    href: '/comp-sim',    internal: true, tier: 'medium', Icon: Radio,      nameKey: 'compSim' },
      { id: 'frame-count', href: '/frame-count', internal: true, tier: 'medium', Icon: Film,       nameKey: 'frameCount' },
      { id: 'solver',      href: '/solver',      internal: true, tier: 'medium', iconImg: '/icons/upstream/solver.png', nameKey: 'solver' },
      { id: 'mosaic',      href: '/mosaic',      internal: true, tier: 'medium', Icon: Grid2x2,    nameKey: 'mosaic' },
      { id: 'paint',       href: '/paint',       internal: true, tier: 'medium', Icon: Brush,      nameKey: 'paint' },
      { id: 'icon',        href: '/icon',        internal: true, tier: 'medium', Icon: Shapes,     nameKey: 'icon' },
      { id: 'timezone',    href: '/timezone',    internal: true, tier: 'medium', Icon: Globe2,     nameKey: 'timezone' },
      { id: 'calendar',    href: '/calendar',    internal: true, tier: 'medium', Icon: CalendarDays, nameKey: 'calendar' },
    ],
  },
  {
    id: 'learn',
    eyebrow: { en: 'LEARN', zh: '学习' },
    title:   { en: 'Tutorials, terms, rules.', zh: '教程、术语、规则。'
    },
    sub:     { en: 'Find teachers and schools, browse their livestream scripts, course plans and illustrated tutorials, learn the terms, regulations and group theory, then use a quiz to check what stuck.', zh: '寻找魔方老师和培训机构,浏览直播话术、录播课方案与图文教程,学习术语、规则和群论,再用问答检验掌握程度。'
    },
    cards: [
      { id: 'platform', href: '/platform', internal: true, tier: 'medium', Icon: PanelsTopLeft, nameKey: 'platform' },
      { id: 'teaching-management', href: '/org', internal: true, tier: 'medium', Icon: Building2, nameKey: 'teachingManagement' },
      { id: 'learning-center', href: '/learn', internal: true, tier: 'medium', Icon: BookOpen, nameKey: 'learningCenter' },
      { id: 'teaching', href: '/courses', internal: true, tier: 'medium', Icon: GraduationCap, nameKey: 'teaching' },
      { id: 'teachers', href: '/teachers', internal: true, tier: 'medium', Icon: School, nameKey: 'teachers' },
      { id: 'live-scripts', href: '/teachers/scripts', internal: true, tier: 'medium', Icon: Radio, nameKey: 'liveScripts' },
      { id: 'meet', href: '/meet', internal: true, tier: 'medium', Icon: Video, nameKey: 'meet' },
      { id: 'documents', href: '/docs', internal: true, tier: 'medium', Icon: FileText, nameKey: 'documents' },
      { id: 'spreadsheets', href: '/sheets', internal: true, tier: 'medium', Icon: Table2, nameKey: 'spreadsheets' },
      { id: 'alg',      href: '/tutorial', internal: true, tier: 'medium', Icon: Library,    nameKey: 'alg', lockedForNonAdmin: true },
      { id: 'quiz',     href: '/quiz',     internal: true, tier: 'medium', Icon: CircleQuestionMark, nameKey: 'quiz' },
      { id: 'wiki',     href: '/wiki',     internal: true, tier: 'medium', Icon: BookA,      nameKey: 'wiki' },
      { id: 'regulation', href: '/regulation', internal: true, tier: 'medium', Icon: Scale, nameKey: 'regulation' },
      { id: 'notation', href: '/notation', internal: true, tier: 'medium', Icon: FileText, nameKey: 'notation' },
      { id: 'math-hub', href: '/math', internal: true, tier: 'medium', Icon: Sigma, nameKey: 'theoryGroup' },
      { id: 'why-cube', href: '/why-cube', internal: true, tier: 'medium', Icon: Sprout, nameKey: 'whyCube' },
    ],
  },
  {
    id: 'other',
    eyebrow: { en: 'OTHER', zh: '其他' },
    title:   { en: 'Read, build, explore.', zh: '阅读、开发、探索。'
    },
    sub:     { en: 'Forum, contact details, public feedback, code notes, blog, link directory, unofficial world records and the person behind CubeRoot.', zh: '论坛、联系方式、公开反馈、代码笔记、博客、站点导航、非官方纪录与 CubeRoot 的创作者。'
    },
    cards: [
      { id: 'forum', href: '/forum', internal: true, tier: 'medium', Icon: MessagesSquare, nameKey: 'forum' },
      { id: 'drive', href: '/drive', internal: true, tier: 'medium', Icon: HardDrive, nameKey: 'drive' },
      { id: 'contact', href: '/contact', internal: true, tier: 'medium', Icon: UsersRound, nameKey: 'contact' },
      { id: 'feedback', href: '/feedback', internal: true, tier: 'medium', Icon: MessageCircle, nameKey: 'feedback' },
      { id: 'dev', href: '/dev', internal: true, tier: 'medium', Icon: CodeIcon, nameKey: 'dev' },
      { id: 'blog', href: '/blog/', internal: false, tier: 'medium', Icon: BookOpen, nameKey: 'blog' },
      { id: 'site', href: '/site',  internal: true,  tier: 'medium', Icon: Compass,  nameKey: 'sitesDirectory' },
      { id: 'wb',   href: '/wb',    internal: true,  tier: 'medium', Icon: Trophy,   nameKey: 'worldBests' },
      { id: 'achievements', href: '/achievements', internal: true, tier: 'medium', Icon: Award, nameKey: 'achievements' },
      { id: 'creator', href: CREATOR_PROFILE.href, internal: true, tier: 'medium', Icon: UserRound, nameKey: 'creator' },
    ],
  },
];

// All cards (incl. WCA hero, sans coming-soon) flattened for LandingSearch.
export const SEARCH_CARDS: LandingSearchCard[] = [
  { id: 'stats', href: '/wca', internal: true, nameEn: 'WCA', nameZh: 'WCA', sectionTitleEn: 'WCA', sectionTitleZh: 'WCA' },
  // 主入口卡不在 SECTIONS 里,单列于此,否则全站搜索会漏掉它们
  ...PRIMARY_CARDS.map(c => ({
    id: c.id,
    href: c.href,
    internal: c.internal,
    nameEn: TEXTS[c.nameKey].en,
    nameZh: TEXTS[c.nameKey].zh,
    sectionTitleEn: 'MAIN',
    sectionTitleZh: 'MAIN · 主要',
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
  // 颜色测试的两个子项收在入口页里,这里保留直达搜索。
  { id: 'color-relations', href: '/color-test/relations', internal: true, nameEn: 'Opposite or Adjacent?', nameZh: '对色与邻色', sectionTitleEn: 'Colour Tests', sectionTitleZh: '颜色测试' },
  { id: 'stroop', href: '/stroop', internal: true, nameEn: 'Stroop', nameZh: 'Stroop', sectionTitleEn: 'Colour Tests', sectionTitleZh: '颜色测试' },
  // /dev 子页,不在落地页网格上,单列于此让全站搜索仍能找到
  { id: 'dev-llm', href: '/dev/llm', internal: true, nameEn: 'Large Language Models', nameZh: '大模型', sectionTitleEn: 'Dev', sectionTitleZh: '开发' },
  { id: 'fable', href: '/dev/llm/fable', internal: true, nameEn: 'Claude Fable 5', nameZh: 'Claude Fable 5', sectionTitleEn: 'Dev', sectionTitleZh: '开发' },
];

export function isLandingSearchCardVisible(card: LandingSearchCard, isAdmin: boolean): boolean {
  return isAdmin || (!card.adminOnly && !card.lockedForNonAdmin);
}
