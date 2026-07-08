// Font manifest for /code/fonts — single reference for every self-hosted font on
// the site. Mirrors app/fonts.css (@font-face) + the page-local @font-face blocks
// (battle.css, scramble/gen/gen.css, wca_about.css). When you add or drop a font,
// update this list so the catalog stays the source of truth for humans and AIs.
//
// `family` is the exact CSS font-family name; `cssVar` is the design-system token
// to prefer (var(--font-sans)/var(--font-mono)) — empty when the font is only
// reached via a page-local family name (no global token).

export interface FontFile { name: string; weight: string; kb: number; }

export interface FontSpec {
  /** Exact CSS font-family string. */
  family: string;
  /** Generic CSS fallback class, for the specimen's font-family. */
  fallback: string;
  /** Design-system token to prefer, or '' if page-local only. */
  cssVar: string;
  /** Big specimen text shown rendered in the actual font. */
  specimen: string;
  /** Whether the specimen line is mostly numeric (tabular look). */
  numeric?: boolean;
  weights: string;
  /** Latin-only, CJK, or both. */
  coverage: { zh: string; en: string };
  files: FontFile[];
  source: string;
  license: string;
  roleZh: string;
  roleEn: string;
  usageZh: string;
  usageEn: string;
}

export interface FontGroup {
  id: string;
  zh: string;
  en: string;
  noteZh: string;
  noteEn: string;
  fonts: FontSpec[];
}

export const FONT_GROUPS: FontGroup[] = [
  {
    id: 'core',
    zh: '核心排版',
    en: 'Core typography',
    noteZh: '在 app/fonts.css 注册、由设计令牌 --font-sans(正文)/ --font-mono(等宽)/ --font-serif(衬线标题,拉丁 Fraunces + 中文 LXGW)暴露,全站绝大多数文字走这几款。写 UI 取字体一律用令牌,别裸写 font-family。',
    noteEn: 'Registered in app/fonts.css and exposed via the design tokens --font-sans (body) / --font-mono (mono) / --font-serif (serif headings: Fraunces for Latin + LXGW for CJK). Almost all text on the site uses these. Always reach for the token in UI CSS — never hand-write a raw font-family.',
    fonts: [
      {
        family: 'Inter',
        fallback: 'sans-serif',
        cssVar: '--font-sans',
        specimen: 'The quick brown fox 0123456789',
        weights: '300 / 400 / 500 / 600 / 700',
        coverage: { zh: '仅拉丁(中文回退系统黑体)', en: 'Latin only (CJK falls back to system)' },
        files: [
          { name: 'inter-latin-300-normal.woff2', weight: '300', kb: 23 },
          { name: 'inter-latin-400-normal.woff2', weight: '400', kb: 23 },
          { name: 'inter-latin-500-normal.woff2', weight: '500', kb: 24 },
          { name: 'inter-latin-600-normal.woff2', weight: '600', kb: 24 },
          { name: 'inter-latin-700-normal.woff2', weight: '700', kb: 24 },
        ],
        source: 'rsms.me/inter (Google Fonts)',
        license: 'SIL OFL 1.1',
        roleZh: '正文无衬线',
        roleEn: 'Body sans-serif',
        usageZh: '全站正文、标题、按钮、表格、统计数字 —— body 默认字体。',
        usageEn: 'Site-wide body, headings, buttons, tables, stat numbers — the default body font.',
      },
      {
        family: 'Roboto Mono',
        fallback: 'monospace',
        cssVar: '--font-mono',
        specimen: '9.08  R U R′ U′  0xCAFE',
        numeric: true,
        weights: '400 / 500',
        coverage: { zh: '仅拉丁(CJK 回退系统黑体,不落宋体)', en: 'Latin only (CJK falls back to system sans, not serif)' },
        files: [
          { name: 'roboto-mono-latin-400-normal.woff2', weight: '400', kb: 12 },
          { name: 'roboto-mono-latin-500-normal.woff2', weight: '500', kb: 13 },
        ],
        source: 'Google Fonts',
        license: 'Apache 2.0',
        roleZh: '全站唯一等宽',
        roleEn: 'The one monospace',
        usageZh: 'recon 成绩列、代码块、十六进制、需要对齐的数字。对标 Anthropic 自托管思路,跨设备一致。',
        usageEn: 'recon result columns, code blocks, hex, any digits that must align. Self-hosted for cross-device consistency.',
      },
      {
        family: 'Fraunces',
        fallback: 'serif',
        cssVar: '--font-serif',
        specimen: 'CubeRoot',
        weights: '400–600 (variable)',
        coverage: { zh: '仅拉丁', en: 'Latin only' },
        files: [
          { name: 'fraunces-latin-wght-normal.woff2', weight: '400–600 var', kb: 36 },
        ],
        source: 'Undercase Type (Google Fonts)',
        license: 'SIL OFL 1.1',
        roleZh: '衬线展示标题',
        roleEn: 'Serif display',
        usageZh: '落地页与 /about 的大标题(拉丁部分)。可变字重,一个文件覆盖 400/500/600。',
        usageEn: 'Hero titles on the landing page and /about (Latin part). Variable weight — one file covers 400/500/600.',
      },
      {
        family: 'LXGW WenKai',
        fallback: 'serif',
        cssVar: '--font-serif',
        specimen: '解法 训练 分析',
        weights: '400 / 500(600 由 500 近似)',
        coverage: { zh: '中文(标题字静态子集 ~557 字)', en: 'CJK (static heading subset, ~557 glyphs)' },
        files: [
          { name: 'lxgw-wenkai-heading.woff2', weight: '400', kb: 127 },
          { name: 'lxgw-wenkai-heading-500.woff2', weight: '500', kb: 127 },
        ],
        source: 'lxgw/LxgwWenKai v1.522',
        license: 'SIL OFL 1.1',
        roleZh: '中文标题(配 Fraunces)',
        roleEn: 'CJK headings (pairs with Fraunces)',
        usageZh: '全站衬线标题(var(--font-serif))里的中文:拉丁走 Fraunces、中文落 LXGW 楷体。静态子集只含构建期收集的标题字(subset-cjk-heading.py 自动扫 useDocumentTitle + 所有用 --font-serif 的类),缺字优雅回退系统宋体。用 unicode-range 锁 CJK,纯拉丁标题不下载。',
        usageEn: 'The CJK part of every serif heading (var(--font-serif)): Latin uses Fraunces, CJK falls to LXGW WenKai 楷体. The static subset only carries build-time-collected heading glyphs (subset-cjk-heading.py auto-scans useDocumentTitle + every class using --font-serif); missing glyphs fall back to system serif. unicode-range scopes it to CJK so Latin-only headings never fetch it.',
      },
    ],
  },
  {
    id: 'display',
    zh: '专用显示字体',
    en: 'Special-purpose display',
    noteZh: '页面局部 @font-face,只服务一个场景,不进设计令牌。',
    noteEn: 'Page-local @font-face serving a single context — not part of the design tokens.',
    fonts: [
      {
        family: 'Segment7Standard',
        fallback: 'monospace',
        cssVar: '',
        specimen: '12.34',
        numeric: true,
        weights: '700',
        coverage: { zh: '数字 + 部分符号', en: 'Digits + some symbols' },
        files: [
          { name: 'Segment7Standard.otf', weight: '700', kb: 10 },
        ],
        source: 'Cedric Knight (SIL)',
        license: 'SIL OFL',
        roleZh: '七段数码管',
        roleEn: 'Seven-segment LCD',
        usageZh: '/timer 与 /battle 的计时器读数,模拟实体计时器 LCD。',
        usageEn: 'Timer readout on /timer and /battle — mimics a physical stackmat LCD.',
      },
    ],
  },
  {
    id: 'pdf',
    zh: '打乱 / PDF 还原',
    en: 'Scramble / PDF parity',
    noteZh: '/scramble/gen 要把打乱表渲染得与 TNoodle 官方 PDF 像素级一致,三款字体合用:拉丁等宽走 LiberationMono,拉丁无衬线走 NotoSans,CJK 表头走文泉驿微米黑。/battle 与 /wca/about 的打乱记号也复用 LiberationMono。',
    noteEn: 'For pixel-parity with TNoodle’s official PDF, /scramble/gen uses three fonts together: LiberationMono for Latin mono, NotoSans for Latin sans, and WenQuanYi Micro Hei for CJK headers. /battle and /wca/about reuse LiberationMono for scramble notation.',
    fonts: [
      {
        family: 'LiberationMono',
        fallback: 'monospace',
        cssVar: '',
        specimen: "R U R' U' F2 L D2 B'",
        numeric: true,
        weights: '400',
        coverage: { zh: '仅拉丁', en: 'Latin only' },
        files: [
          { name: 'LiberationMono-Regular.ttf', weight: '400', kb: 106 },
        ],
        source: 'Red Hat Liberation Fonts',
        license: 'SIL OFL 1.1',
        roleZh: '打乱记号等宽',
        roleEn: 'Scramble notation mono',
        usageZh: '/scramble/gen 表格、/battle 打乱行、/wca/about 复盘 —— 度量与 TNoodle PDF 一致。',
        usageEn: '/scramble/gen tables, /battle scramble rows, /wca/about reconstructions — metrics match the TNoodle PDF.',
      },
      {
        family: 'NotoSans',
        fallback: 'sans-serif',
        cssVar: '',
        specimen: '3x3x3 · Round 1 · Ao5',
        weights: '400',
        coverage: { zh: '仅拉丁', en: 'Latin only' },
        files: [
          { name: 'NotoSans-Regular.ttf', weight: '400', kb: 445 },
        ],
        source: 'Google Noto',
        license: 'SIL OFL 1.1',
        roleZh: 'PDF 拉丁无衬线',
        roleEn: 'PDF Latin sans',
        usageZh: '/scramble/gen 打乱表的拉丁标题文字,与 TNoodle PDF 一致。',
        usageEn: 'Latin header text on /scramble/gen sheets, matching the TNoodle PDF.',
      },
      {
        family: 'WQYMicroHei',
        fallback: 'sans-serif',
        cssVar: '',
        specimen: '三阶 · 第1轮 · Ao5',
        weights: '400',
        coverage: { zh: '中文 + 拉丁', en: 'CJK + Latin' },
        files: [
          { name: 'wqy-microhei.ttf', weight: '400', kb: 3955 },
        ],
        source: '文泉驿 WenQuanYi',
        license: 'GPLv3 + font exception / Apache 2.0',
        roleZh: 'PDF 中文表头',
        roleEn: 'PDF CJK headers',
        usageZh: '/scramble/gen 打乱表的中文表头(如「三阶 第1轮 Ao5」),补 NotoSans/LiberationMono 不覆盖的 CJK。',
        usageEn: 'CJK sheet headers on /scramble/gen, covering CJK that NotoSans / LiberationMono lack.',
      },
    ],
  },
];
