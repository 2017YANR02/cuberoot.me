export type SiteDirectoryPlacement = 'primary' | 'wca' | 'section' | 'footer';
export type SiteDirectoryTier = 'medium' | 'standard' | 'utility';

export interface SiteDirectoryText {
  en: string;
  zh: string;
}

// Public names and homepage copy live here so the website and Mini Program do
// not maintain two destination catalogs that can silently drift apart.
export const SITE_DIRECTORY_TEXTS = {
  brand: { en: 'CubeRoot', zh: 'CubeRoot' },
  solver: { en: 'or18 Solver', zh: 'or18 求解器' },
  wcaStats: { en: 'WCA', zh: 'WCA' },
  recon: { en: 'Recon', zh: '复盘' },
  algTrainer: { en: 'mihlefeld Trainer', zh: 'mihlefeld 训练器' },
  blddb: { en: 'BLDDB', zh: 'BLDDB' },
  hthGrapher: { en: 'Calculator', zh: '计算器' },
  viz: { en: 'Distribution', zh: '分布' },
  upcoming: { en: 'Calendar', zh: '日历' },
  globe: { en: 'Globe', zh: '地球' },
  cstimer: { en: 'csTimer', zh: 'csTimer' },
  contests: { en: 'Contests', zh: '比赛系统' },
  timer: { en: 'Timer', zh: '计时' },
  predict: { en: 'Lookahead', zh: '预判' },
  colorTest: { en: 'Colour Tests', zh: '颜色测试' },
  frameCount: { en: 'Frame Count', zh: '数帧' },
  scramble: { en: 'Scramble', zh: '打乱' },
  alg: { en: 'Tutorial', zh: '教程' },
  teachingManagement: { en: 'Teaching', zh: '教学管理' },
  learningCenter: { en: 'Learning Center', zh: '学习中心' },
  teaching: { en: 'Courses', zh: '课程' },
  platform: { en: 'Platform', zh: 'Platform' },
  teachers: { en: 'Teachers & Schools', zh: '老师与机构' },
  liveScripts: { en: 'Live Scripts', zh: '直播话术' },
  documents: { en: 'Docs', zh: '文档' },
  spreadsheets: { en: 'Sheets', zh: '表格' },
  algdb: { en: 'Algorithms', zh: '公式' },
  wiki: { en: 'Wiki', zh: 'Wiki' },
  notation: { en: 'Notation', zh: '记号' },
  quiz: { en: 'Quiz', zh: '问答' },
  sitesDirectory: { en: 'Web', zh: '网站' },
  mosaic: { en: 'Mosaic', zh: '马赛克' },
  worldBests: { en: 'World Bests', zh: '非官方纪录' },
  blog: { en: 'Blog', zh: '博客' },
  prediction: { en: 'Prediction', zh: '预测' },
  paint: { en: 'Paint', zh: '绘制' },
  analyze: { en: 'Analyzer', zh: '打乱分析' },
  gen: { en: 'Scrambles', zh: '生成打乱' },
  memo: { en: 'Memo', zh: '记忆' },
  music: { en: 'Music', zh: '音乐' },
  gallery: { en: 'Gallery', zh: '图库' },
  dev: { en: 'Dev', zh: '开发' },
  timezone: { en: 'Time Zones', zh: '时区' },
  calendar: { en: 'Calendar', zh: '日历' },
  sim: { en: 'Sim', zh: '模拟' },
  space: { en: 'Cube space', zh: '魔方空间' },
  compSim: { en: 'Comp Sim', zh: '比赛模拟' },
  icon: { en: 'Icons', zh: '图标' },
  comp: { en: 'Comp', zh: '比赛' },
  theoryGroup: { en: 'Math', zh: '数学' },
  regulation: { en: 'Regulation', zh: '规则' },
  whyCube: { en: 'Why Cube', zh: '为何学魔方' },
  forum: { en: 'Forum', zh: '论坛' },
  contact: { en: 'Contact', zh: '联系' },
  feedback: { en: 'Feedback', zh: '反馈' },
  meet: { en: 'Meeting', zh: '会议' },
  achievements: { en: 'Achievements', zh: '成就' },
  drive: { en: 'Drive', zh: '网盘' },
  creator: { en: 'Ruimin Yan', zh: '颜瑞民' },
  competitions: { en: 'Competitions', zh: '比赛' },
  records: { en: 'Records', zh: '纪录' },
  rankings: { en: 'Rankings', zh: '排名' },
  statistics: { en: 'Statistics', zh: '统计' },
  about: { en: 'About', zh: '关于' },
  acknowledgments: { en: 'Acknowledgments', zh: '致谢' },
  github: { en: 'GitHub', zh: 'GitHub' },
  comingSoon: { en: 'Coming soon', zh: '即将上线' },
  creditsPrefix: { en: 'Inspired by', zh: '致谢' },
} as const satisfies Record<string, SiteDirectoryText>;

export type SiteDirectoryTextKey = keyof typeof SITE_DIRECTORY_TEXTS;

export const SITE_CREATOR_PROFILE = {
  href: '/about/ruimin',
  wcaId: '2017YANR02',
  nameZh: '颜瑞民',
  nameEn: 'Ruimin Yan',
} as const;

interface SiteDirectoryEntryShape {
  id: string;
  href: string;
  internal: boolean;
  tier: SiteDirectoryTier;
  nameKey: SiteDirectoryTextKey;
  lockedForNonAdmin?: boolean;
  miniProgramAction?: 'copy' | 'disabled';
  miniProgramNote?: SiteDirectoryText;
}

interface SiteDirectoryGroupShape {
  id: string;
  placement: SiteDirectoryPlacement;
  eyebrow: SiteDirectoryText;
  title: SiteDirectoryText;
  sub: SiteDirectoryText;
  entries: readonly SiteDirectoryEntryShape[];
}

export const SITE_DIRECTORY_GROUPS = [
  {
    id: 'main',
    placement: 'primary',
    eyebrow: { en: 'MAIN', zh: '常用' },
    title: { en: 'Core tools.', zh: '常用入口。' },
    sub: {
      en: 'Timer, algorithms, simulation, reconstructions and scrambles.',
      zh: '计时、公式、模拟、复盘与打乱。',
    },
    entries: [
      { id: 'timer', href: '/timer', internal: true, tier: 'medium', nameKey: 'timer' },
      { id: 'algdb', href: '/alg', internal: true, tier: 'medium', nameKey: 'algdb' },
      { id: 'sim', href: '/sim', internal: true, tier: 'medium', nameKey: 'sim' },
      { id: 'recon', href: '/recon', internal: true, tier: 'medium', nameKey: 'recon' },
      { id: 'scramble', href: '/scramble', internal: true, tier: 'medium', nameKey: 'scramble' },
    ],
  },
  {
    id: 'wca',
    placement: 'wca',
    eyebrow: { en: 'WCA', zh: 'WCA' },
    title: { en: 'Competitions, records, rankings.', zh: '比赛、纪录、排名。' },
    sub: {
      en: 'WCA competitions, records, rankings and statistics.',
      zh: 'WCA 比赛、纪录、排名与统计。',
    },
    entries: [
      { id: 'competitions', href: '/wca/comp', internal: true, tier: 'medium', nameKey: 'competitions' },
      { id: 'wca-records', href: '/wca/records', internal: true, tier: 'medium', nameKey: 'records' },
      { id: 'wca-results', href: '/wca/results', internal: true, tier: 'medium', nameKey: 'rankings' },
      { id: 'wca-stats', href: '/wca', internal: true, tier: 'medium', nameKey: 'statistics' },
    ],
  },
  {
    id: 'train',
    placement: 'section',
    eyebrow: { en: 'TRAIN', zh: '训练' },
    title: { en: 'Recall, look ahead, drill.', zh: '记忆、预判、背公式。' },
    sub: {
      en: 'Memory drills, lookahead practice and colour relationship and interference tests, plus the blindfolded algorithm database and two classic algorithm trainers. Head-to-head battles live inside the timer.',
      zh: '盲拧记忆、预判练习、颜色关系与色词干扰测试，外加盲拧公式库与两套经典公式训练器；双人对战在计时器里。',
    },
    entries: [
      { id: 'memo', href: '/memo', internal: true, tier: 'standard', nameKey: 'memo' },
      { id: 'predict', href: '/predict', internal: true, tier: 'standard', nameKey: 'predict' },
      { id: 'color-test', href: '/color-test', internal: true, tier: 'standard', nameKey: 'colorTest' },
      { id: 'blddb', href: '/blddb', internal: true, tier: 'standard', nameKey: 'blddb' },
      { id: 'trainer', href: '/alg-trainers', internal: true, tier: 'standard', nameKey: 'algTrainer' },
      { id: 'cstimer', href: '/cstimer', internal: true, tier: 'standard', nameKey: 'cstimer' },
    ],
  },
  {
    id: 'tool',
    placement: 'section',
    eyebrow: { en: 'TOOL', zh: '工具' },
    title: { en: 'Solve, count, make.', zh: '求解、数帧、创作。' },
    sub: {
      en: 'A solver for any scramble and frame-accurate timing, plus competition management, cube mosaics, vector drawings, event icons, time zone conversion and a shareable calendar.',
      zh: '把任意打乱交给求解器、逐帧核对成绩，也能管理比赛、拼马赛克、画矢量图、生成项目图标、换算时区和分享日历。',
    },
    entries: [
      { id: 'contests', href: '/contests', internal: true, tier: 'medium', nameKey: 'contests' },
      { id: 'comp-sim', href: '/comp-sim', internal: true, tier: 'medium', nameKey: 'compSim' },
      { id: 'frame-count', href: '/frame-count', internal: true, tier: 'medium', nameKey: 'frameCount' },
      { id: 'solver', href: '/solver', internal: true, tier: 'medium', nameKey: 'solver' },
      { id: 'mosaic', href: '/mosaic', internal: true, tier: 'medium', nameKey: 'mosaic' },
      { id: 'space', href: '/space', internal: true, tier: 'medium', nameKey: 'space' },
      { id: 'paint', href: '/paint', internal: true, tier: 'medium', nameKey: 'paint' },
      { id: 'icon', href: '/icon', internal: true, tier: 'medium', nameKey: 'icon' },
      { id: 'timezone', href: '/timezone', internal: true, tier: 'medium', nameKey: 'timezone' },
      { id: 'calendar', href: '/calendar', internal: true, tier: 'medium', nameKey: 'calendar' },
    ],
  },
  {
    id: 'learn',
    placement: 'section',
    eyebrow: { en: 'LEARN', zh: '学习' },
    title: { en: 'Tutorials, terms, rules.', zh: '教程、术语、规则。' },
    sub: {
      en: 'Find teachers and schools, browse their livestream scripts, course plans and illustrated tutorials, learn the terms, regulations and group theory, then use a quiz to check what stuck.',
      zh: '寻找魔方老师和培训机构，浏览直播话术、录播课方案与图文教程，学习术语、规则和群论，再用问答检验掌握程度。',
    },
    entries: [
      { id: 'platform', href: '/platform', internal: true, tier: 'medium', nameKey: 'platform' },
      { id: 'teaching-management', href: '/org', internal: true, tier: 'medium', nameKey: 'teachingManagement' },
      { id: 'learning-center', href: '/learn', internal: true, tier: 'medium', nameKey: 'learningCenter' },
      { id: 'teaching', href: '/courses', internal: true, tier: 'medium', nameKey: 'teaching' },
      { id: 'teachers', href: '/teachers', internal: true, tier: 'medium', nameKey: 'teachers' },
      { id: 'live-scripts', href: '/teachers/scripts', internal: true, tier: 'medium', nameKey: 'liveScripts' },
      { id: 'meet', href: '/meet', internal: true, tier: 'medium', nameKey: 'meet' },
      { id: 'documents', href: '/docs', internal: true, tier: 'medium', nameKey: 'documents' },
      { id: 'spreadsheets', href: '/sheets', internal: true, tier: 'medium', nameKey: 'spreadsheets' },
      {
        id: 'alg',
        href: '/tutorial',
        internal: true,
        tier: 'medium',
        nameKey: 'alg',
      },
      { id: 'quiz', href: '/quiz', internal: true, tier: 'medium', nameKey: 'quiz' },
      { id: 'wiki', href: '/wiki', internal: true, tier: 'medium', nameKey: 'wiki' },
      { id: 'regulation', href: '/regulation', internal: true, tier: 'medium', nameKey: 'regulation' },
      { id: 'notation', href: '/notation', internal: true, tier: 'medium', nameKey: 'notation' },
      { id: 'math-hub', href: '/math', internal: true, tier: 'medium', nameKey: 'theoryGroup' },
      { id: 'why-cube', href: '/why-cube', internal: true, tier: 'medium', nameKey: 'whyCube' },
    ],
  },
  {
    id: 'other',
    placement: 'section',
    eyebrow: { en: 'OTHER', zh: '其他' },
    title: { en: 'Read, build, explore.', zh: '阅读、开发、探索。' },
    sub: {
      en: 'Member photos, forum, contact details, public feedback, code notes, blog, link directory, unofficial world records and the person behind CubeRoot.',
      zh: '会员图库、论坛、联系方式、公开反馈、代码笔记、博客、站点导航、非官方纪录与 CubeRoot 的创作者。',
    },
    entries: [
      { id: 'gallery', href: '/gallery', internal: true, tier: 'medium', nameKey: 'gallery' },
      { id: 'music', href: '/music', internal: true, tier: 'medium', nameKey: 'music' },
      { id: 'forum', href: '/forum', internal: true, tier: 'medium', nameKey: 'forum' },
      { id: 'drive', href: '/drive', internal: true, tier: 'medium', nameKey: 'drive' },
      { id: 'feedback', href: '/feedback', internal: true, tier: 'medium', nameKey: 'feedback' },
      { id: 'dev', href: '/dev', internal: true, tier: 'medium', nameKey: 'dev' },
      { id: 'blog', href: '/blog/', internal: false, tier: 'medium', nameKey: 'blog' },
      { id: 'site', href: '/site', internal: true, tier: 'medium', nameKey: 'sitesDirectory' },
      { id: 'wb', href: '/wb', internal: true, tier: 'medium', nameKey: 'worldBests' },
      { id: 'achievements', href: '/achievements', internal: true, tier: 'medium', nameKey: 'achievements' },
      { id: 'contact', href: '/contact', internal: true, tier: 'medium', nameKey: 'contact' },
      { id: 'creator', href: SITE_CREATOR_PROFILE.href, internal: true, tier: 'medium', nameKey: 'creator' },
    ],
  },
  {
    id: 'footer',
    placement: 'footer',
    eyebrow: { en: 'ABOUT', zh: '关于' },
    title: { en: 'About CubeRoot.', zh: '了解 CubeRoot。' },
    sub: {
      en: 'Project introduction, acknowledgments and source code.',
      zh: '项目介绍、致谢与开源代码。',
    },
    entries: [
      { id: 'about', href: '/about', internal: true, tier: 'utility', nameKey: 'about' },
      { id: 'support', href: '/support', internal: true, tier: 'utility', nameKey: 'acknowledgments' },
      {
        id: 'github',
        href: 'https://github.com/RuiminYan/cuberoot.me',
        internal: false,
        tier: 'utility',
        nameKey: 'github',
        miniProgramAction: 'copy',
        miniProgramNote: { en: 'Copy link', zh: '点击复制链接' },
      },
    ],
  },
] as const satisfies readonly SiteDirectoryGroupShape[];

export type SiteDirectoryGroup = (typeof SITE_DIRECTORY_GROUPS)[number];
export type SiteDirectoryEntry = SiteDirectoryGroup['entries'][number];
export type SiteDirectoryEntryId = SiteDirectoryEntry['id'];

export function listSiteDirectoryEntries(): SiteDirectoryEntry[] {
  return SITE_DIRECTORY_GROUPS.flatMap((group) => [...group.entries]);
}
