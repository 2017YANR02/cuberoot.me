// Landing-page section data — extracted from app/[lang]/page.tsx so both the
// home page and the global desk-pet search overlay can share SEARCH_CARDS
// without duplicating the card list.

import {
  Film, ScanSearch, BookOpen, Shuffle, Library, BookA,
  Compass, Grid2x2, Trophy, Timer as TimerIcon, ImagePlus, Code as CodeIcon,
  Brain, Box, Sigma, Scale, Sprout, Brush, MessagesSquare, type LucideIcon,
} from 'lucide-react';
import { type LandingSearchCard } from '@/components/LandingSearch';

// i18n text map — bilingual mirror of the Vite original's TEXTS table.
export const TEXTS: Record<string, { en: string; zh: string
 }> = {
  brand:           { en: 'CubeRoot', zh: 'CubeRoot' },
  tagline:         { en: 'Solve. Train. Analyze.', zh: '解法 · 训练 · 分析'
},
  solver:          { en: 'or18 Solver', zh: 'or18 求解器' },
  wcaStats:        { en: 'WCA', zh: 'WCA' },
  recon:           { en: 'Recon', zh: '复盘'
},
  algTrainer:      { en: 'mihlefeld Trainer', zh: 'mihlefeld 训练器'
},
  hthGrapher:      { en: 'Calculator', zh: '计算器'
},
  battle:          { en: 'Battle', zh: '对战'
},
  viz:             { en: 'Distribution', zh: '分布'
},
  upcoming:        { en: 'Calendar', zh: '日历'
},
  globe:           { en: 'Globe', zh: '地球' },
  cstimer:         { en: 'csTimer', zh: 'csTimer' },
  timer:           { en: 'Timer', zh: '计时器'
},
  frameCount:      { en: 'Frame Count', zh: '数帧'
},
  scramble:        { en: 'Scramble', zh: '打乱'
},
  alg:             { en: 'Tutorial',   zh: '教程' },
  algdb:           { en: 'Algorithms', zh: '公式' },
  wiki:            { en: 'Wiki', zh: 'Wiki' },
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
  visualcubeEditor:{ en: 'VisualCube', zh: '魔方可视化'
},
  paint:           { en: 'Paint', zh: '绘制'
},
  analyze:         { en: 'Analyzer', zh: '打乱分析'
},
  gen:             { en: 'Scrambles', zh: '生成打乱'
},
  memo:            { en: 'Memo', zh: '记忆'
},
  code:            { en: 'Code', zh: '编程'
},
  sim:             { en: 'Sim', zh: '模拟'
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
  comingSoon:      { en: 'Coming soon', zh: '即将上线'
},
  creditsPrefix:   { en: 'Inspired by', zh: '致谢'
},
};

export type Tier = 'hero' | 'hero-side' | 'medium' | 'standard' | 'utility';

export interface CardConfig {
  id: string;
  href: string;
  internal: boolean;
  tier: Tier;
  Icon?: LucideIcon;
  iconImg?: string;
  nameKey: keyof typeof TEXTS;
  comingSoon?: boolean;
}

type I18n = { en: string; zh: string; };
export interface Section {
  id: string;
  eyebrow: I18n;
  title: I18n;
  sub: I18n;
  cards: CardConfig[];
}

export const SECTIONS: Section[] = [
  {
    id: 'train',
    eyebrow: { en: 'TRAIN · 训练', zh: 'TRAIN · 训练'
    },
    title:   { en: 'Drill, time, refine.', zh: '练习、计时、复盘。'
    },
    sub:     { en: 'Drill algorithms, race the clock, battle head-to-head, recall image pairs.', zh: '背公式、计时、对战、记忆 — 把每一步打磨到肌肉记忆。'
    },
    cards: [
      { id: 'algdb',    href: '/alg',          internal: true, tier: 'hero',     nameKey: 'algdb' },
      { id: 'timer',    href: '/timer',        internal: true, tier: 'standard', Icon: TimerIcon, nameKey: 'timer' },
      { id: 'memo',     href: '/memo',         internal: true, tier: 'standard', Icon: Brain,     nameKey: 'memo' },
      { id: 'trainer',  href: '/alg-trainers', internal: true, tier: 'standard', iconImg: '/icons/upstream/algtrainer.png', nameKey: 'algTrainer' },
      { id: 'cstimer',  href: '/cstimer',      internal: true, tier: 'standard', nameKey: 'cstimer', iconImg: '/cstimer_logo.png' },
    ],
  },
  {
    id: 'learn',
    eyebrow: { en: 'LEARN · 学习', zh: 'LEARN · 学习'
    },
    title:   { en: 'Methods and algorithms.', zh: '方法与公式。'
    },
    sub:     { en: 'CFOP tutorials and the full algorithm library — beginner method to ZBLL.', zh: 'CFOP 教程 + 多阶公式库 — 从入门法到 ZBLL 全套查阅。'
    },
    cards: [
      { id: 'alg',      href: '/tutorial', internal: true, tier: 'medium', Icon: Library,    nameKey: 'alg', comingSoon: true },
      { id: 'wiki',     href: '/wiki',     internal: true, tier: 'medium', Icon: BookA,      nameKey: 'wiki' },
      { id: 'regulation', href: '/regulation', internal: true, tier: 'medium', Icon: Scale, nameKey: 'regulation' },
      { id: 'math-hub', href: '/math', internal: true, tier: 'medium', Icon: Sigma, nameKey: 'theoryGroup' },
      { id: 'why-cube', href: '/why-cube', internal: true, tier: 'medium', Icon: Sprout, nameKey: 'whyCube' },
    ],
  },
  {
    id: 'tool',
    eyebrow: { en: 'TOOL · 工具', zh: 'TOOL · 工具' },
    title:   { en: 'From scramble to solution.', zh: '从打乱到解法。'
    },
    sub:     { en: 'Recon, frame-count, visualizers, solvers — a tool for every step of the solve.', zh: '复盘、数帧、可视化、求解 — 每个解法环节都有专门工具。'
    },
    cards: [
      { id: 'recon',       href: '/recon',       internal: true, tier: 'medium', Icon: ScanSearch, nameKey: 'recon' },
      { id: 'frame-count', href: '/frame-count', internal: true, tier: 'medium', Icon: Film,       nameKey: 'frameCount' },
      { id: 'visualcube',  href: '/visualcube',  internal: true, tier: 'medium', Icon: ImagePlus,  nameKey: 'visualcubeEditor' },
      { id: 'scramble',    href: '/scramble',    internal: true, tier: 'medium', Icon: Shuffle,    nameKey: 'scramble' },
      { id: 'solver',      href: '/solver',      internal: true, tier: 'medium', iconImg: '/icons/upstream/solver.png', nameKey: 'solver' },
      { id: 'mosaic',      href: '/mosaic',      internal: true, tier: 'medium', Icon: Grid2x2,    nameKey: 'mosaic' },
      { id: 'paint',       href: '/paint',       internal: true, tier: 'medium', Icon: Brush,      nameKey: 'paint' },
      { id: 'sim',         href: '/sim',         internal: true, tier: 'medium', Icon: Box,        nameKey: 'sim' },
    ],
  },
  {
    id: 'other',
    eyebrow: { en: 'OTHER · 其他', zh: 'OTHER · 其他' },
    title:   { en: 'Read, code, explore.', zh: '阅读、编程、探索。'
    },
    sub:     { en: 'Code notes, blog, link directory, unofficial world records.', zh: '代码笔记、博客、链接导航、非官方纪录。'
    },
    cards: [
      { id: 'forum', href: '/forum', internal: true, tier: 'medium', Icon: MessagesSquare, nameKey: 'forum' },
      { id: 'code', href: '/code',  internal: true,  tier: 'medium', Icon: CodeIcon, nameKey: 'code' },
      { id: 'blog', href: '/blog/', internal: false, tier: 'medium', Icon: BookOpen, nameKey: 'blog' },
      { id: 'site', href: '/site',  internal: true,  tier: 'medium', Icon: Compass,  nameKey: 'sitesDirectory' },
      { id: 'wb',   href: '/wb',    internal: true,  tier: 'medium', Icon: Trophy,   nameKey: 'worldBests' },
    ],
  },
];

// All cards (incl. WCA hero, sans coming-soon) flattened for LandingSearch.
export const SEARCH_CARDS: LandingSearchCard[] = [
  { id: 'stats', href: '/wca', internal: true, nameEn: 'WCA', nameZh: 'WCA', sectionTitleEn: 'WCA', sectionTitleZh: 'WCA' },
  ...SECTIONS.flatMap(sec =>
    sec.cards
      .filter(c => !c.comingSoon)
      .map(c => ({
        id: c.id,
        href: c.href,
        internal: c.internal,
        nameEn: TEXTS[c.nameKey].en,
        nameZh: TEXTS[c.nameKey].zh,
        sectionTitleEn: sec.eyebrow.en,
        sectionTitleZh: sec.eyebrow.zh,
      })),
  ),
  // /code 子页,不在落地页网格上,单列于此让全站搜索仍能找到
  { id: 'code-llm', href: '/code/llm', internal: true, nameEn: 'Large Language Models', nameZh: '大模型', sectionTitleEn: 'Code', sectionTitleZh: '代码' },
  { id: 'fable', href: '/code/llm/fable', internal: true, nameEn: 'Claude Fable 5', nameZh: 'Claude Fable 5', sectionTitleEn: 'Code', sectionTitleZh: '代码' },
];
