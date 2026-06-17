// ★★★ 新增一个可复用 hook / 工具函数后,在这里登记一条 ★★★
// /code/utils 这页直接读这份 CATALOG 渲染。让下一个人 / 下一个 AI 写新代码前
// 翻一眼就知道「这个轮子已经有了」。签名照源码抄准,别 paraphrase。

export type UtilCat = 'hook' | 'i18n' | 'api' | 'format' | 'wca' | 'cube' | 'util';

export interface UtilEntry {
  name: string;
  /** TS 签名,照源码抄 */
  sig: string;
  /** import 行 */
  imp: string;
  /** 一行调用示例(可选) */
  usage?: string;
  category: UtilCat;
  zh: string;
  en: string;
}

export const UCATS: { id: UtilCat; zh: string; en: string }[] = [
  { id: 'hook', zh: 'React Hooks', en: 'React Hooks' },
  { id: 'i18n', zh: '国际化 / 文案', en: 'i18n / Text' },
  { id: 'api', zh: 'API 地址', en: 'API URLs' },
  { id: 'format', zh: '格式化 / 显示', en: 'Formatting' },
  { id: 'wca', zh: 'WCA 领域', en: 'WCA Domain' },
  { id: 'cube', zh: '魔方常量', en: 'Cube Constants' },
  { id: 'util', zh: '通用工具', en: 'General Utils' },
];

export const CATALOG: UtilEntry[] = [
  // ── hooks ─────────────────────────────────
  {
    name: 'useDocumentTitle',
    sig: 'useDocumentTitle(zh: string, en: string): void',
    imp: "import { useDocumentTitle } from '@/hooks/useDocumentTitle';",
    usage: "useDocumentTitle('组件库', 'Components');",
    category: 'hook',
    zh: '设置浏览器标签标题(带 CubeRoot 后缀,卸载时复位),SSR 安全。',
    en: 'Sets the document title (CubeRoot suffix, resets on unmount), SSR-safe.',
  },
  {
    name: 'useT',
    sig: 'useT(): (zh: string, en: string) => string',
    imp: "import { useT } from '@/hooks/useT';",
    usage: "const t = useT(); t('图案集', 'Patterns');",
    category: 'hook',
    zh: '共享双语翻译器:isZh ? zh : en。取代各组件手抄的私有 t(zh, en)。',
    en: 'Shared bilingual translator: isZh ? zh : en. Replaces per-component private t(zh, en).',
  },
  {
    name: 'useIsMobile',
    sig: 'useIsMobile(maxWidth = 768): boolean',
    imp: "import { useIsMobile } from '@/hooks/useIsMobile';",
    usage: 'const isMobile = useIsMobile(640);',
    category: 'hook',
    zh: '窄屏检测(matchMedia),SSR 安全,自动监听断点变化。',
    en: 'Viewport-width detection (matchMedia), SSR-safe with a live listener.',
  },
  {
    name: 'useMembership',
    sig: 'useMembership(): { membership: Membership | null; isMember: boolean; loading: boolean; refresh: () => void }',
    imp: "import { useMembership } from '@/hooks/useMembership';",
    usage: 'const { isMember } = useMembership();',
    category: 'hook',
    zh: '读取当前登录用户的会员状态(/v1/membership/me),未登录返回 null。门控会员专属 UI 用。',
    en: "Reads the signed-in user's membership status; null when logged out. Gate member-only UI.",
  },
  {
    name: 'useSpaceHoldTimer',
    sig: 'useSpaceHoldTimer(opts: SpaceHoldTimerOptions): SpaceHoldTimerHandlers',
    imp: "import { useSpaceHoldTimer } from '@/hooks/useSpaceHoldTimer';",
    category: 'hook',
    zh: '空格 / 触摸长按计时状态机(就绪 → 运行 → 停止),Solo 与 Battle 共用。',
    en: 'Space-bar / touch-hold timer state machine, shared by Solo and Battle.',
  },
  {
    name: 'useGestureWheel',
    sig: 'useGestureWheel(opts: UseGestureWheelOptions): { wheelRef }',
    imp: "import { useGestureWheel } from '@/hooks/useGestureWheel';",
    usage: 'const { wheelRef } = useGestureWheel({ surfaceRef, canGesture, enabledFor, fireAction, onPressDown, onPressUp, onArmCancel });',
    category: 'hook',
    zh: 'cstimer 式按住拖动径向轮盘:绑定计时面板,普通按压照常计时,拖过死区切手势模式并触发对应方向。配 <GestureWheel>,/timer 与 /trainer 共用。',
    en: 'cstimer-style press-and-drag radial dial on a timing surface: a hold still times, a drag fires the nearest direction. Pairs with <GestureWheel>; shared by /timer and /trainer.',
  },
  {
    name: 'useSpeechToText',
    sig: 'useSpeechToText({ lang, onResult }): { supported; listening; start; stop }',
    imp: "import { useSpeechToText } from '@/hooks/useSpeechToText';",
    category: 'hook',
    zh: 'Web Speech API 语音转文字封装(Chrome / Edge / Safari,Firefox 不支持)。',
    en: 'Web Speech API speech-to-text wrapper (Chrome/Edge/Safari; not Firefox).',
  },
  {
    name: 'useLiveStream',
    sig: 'useLiveStream({ compId, applyPatch }): WsStatus',
    imp: "import { useLiveStream } from '@/hooks/useLiveStream';",
    category: 'hook',
    zh: 'cubing.com WebSocket 实时成绩流(指数退避重连 + ping 保活)。',
    en: 'cubing.com WebSocket live-results stream (backoff reconnect + ping).',
  },
  {
    name: 'useWcaLiveStream',
    sig: 'useWcaLiveStream({ rounds, numByWcaId, onRoundUpdate }): WsStatus',
    imp: "import { useWcaLiveStream } from '@/hooks/useWcaLiveStream';",
    category: 'hook',
    zh: 'WCA Live GraphQL 订阅(Phoenix / Absinthe,重型模块按需懒加载)。',
    en: 'WCA Live GraphQL subscription (Phoenix/Absinthe, lazy-loaded modules).',
  },

  // ── i18n ──────────────────────────────────
  {
    name: 'tr',
    sig: "tr(m: { en: string; zh: string }): string",
    imp: "import { tr } from '@/i18n/tr';",
    usage: "tr({ zh: '复原', en: 'Solve' })",
    category: 'i18n',
    zh: '取当前语言的纯字符串文案(props / aria-label / 计算值)。别写 isZh 三元。',
    en: 'Resolve bilingual text to a plain string (props, aria-label). No isZh ternaries.',
  },
  {
    name: 'T',
    sig: '<T en="Save" zh="保存" />',
    imp: "import { T } from '@/i18n/tr';",
    category: 'i18n',
    zh: 'JSX 双语文本节点,切换语言自动重渲染。',
    en: 'JSX bilingual text node; re-renders on language toggle.',
  },
  {
    name: 'useLang',
    sig: "useLang(): 'en' | 'zh'",
    imp: "import { useLang } from '@/i18n/tr';",
    usage: 'const lang = useLang();',
    category: 'i18n',
    zh: '订阅语言变化,拿到当前规范化 locale。',
    en: 'Subscribe to language changes; returns the current normalized locale.',
  },

  // ── api ───────────────────────────────────
  {
    name: 'apiUrl',
    sig: 'apiUrl(path: string): string',
    imp: "import { apiUrl } from '@/lib/api-base';",
    usage: "fetch(apiUrl('/v1/wca/person/2009ZEMD01'))",
    category: 'api',
    zh: '拼后端 API 地址(prod 绝对域 / dev 相对走 rewrite)。禁硬编码 origin。',
    en: 'Build the API URL (absolute in prod, relative in dev). Never hardcode the origin.',
  },
  {
    name: 'statsUrl',
    sig: 'statsUrl(path: string): string',
    imp: "import { statsUrl } from '@/lib/stats-base';",
    usage: "fetch(statsUrl('/stats/person_countries.json'))",
    category: 'api',
    zh: '拼 /stats/*.json 静态资源地址,Vercel 上直指 static 域,少一跳 307。',
    en: 'Build the /stats/*.json URL; points at the static host on Vercel to skip a 307.',
  },

  // ── format ────────────────────────────────
  {
    name: 'formatWcaResult',
    sig: "formatWcaResult(value: number, eventId: string, kind: 'single' | 'average', opts?): string",
    imp: "import { formatWcaResult } from '@/lib/wca-format-result';",
    usage: "formatWcaResult(1234, '333', 'single') // \"12.34\"",
    category: 'format',
    zh: 'WCA 成绩值 → 显示串,处理 DNF / DNS / MBLD / FMC。成绩永远别自己格式化。',
    en: 'WCA value → display string (DNF/DNS/MBLD/FMC). Never format results by hand.',
  },
  {
    name: 'displayCuberName',
    sig: 'displayCuberName(rawName: string, isZh: boolean): string',
    imp: "import { displayCuberName } from '@/lib/cuber-name-display';",
    usage: "displayCuberName('Zhang San (张三)', true) // \"张三\"",
    category: 'format',
    zh: '选手名显示:中文环境取中文名,否则去掉括号部分。',
    en: 'Cuber name: pick the Chinese name in zh, else strip the parenthetical.',
  },
  {
    name: 'displayCity',
    sig: 'displayCity(city: string | null | undefined, isZh: boolean): string',
    imp: "import { displayCity } from '@/lib/city-display';",
    category: 'format',
    zh: '城市名:中文原样,英文转拼音。',
    en: 'City name: keep Chinese as-is, romanize to pinyin for English.',
  },
  {
    name: 'formatDateRangeIso',
    sig: 'formatDateRangeIso(startISO: string, endISO?: string | null): string',
    imp: "import { formatDateRangeIso } from '@/lib/wca-date';",
    usage: "formatDateRangeIso('2024-01-05', '2024-01-12') // \"2024-01-05~12\"",
    category: 'format',
    zh: '紧凑日期区间,同月只显示尾日。',
    en: 'Compact date range; same-month collapses to the end day.',
  },

  // ── wca ───────────────────────────────────
  {
    name: 'toWcaEventId',
    sig: 'toWcaEventId(input: string | null | undefined): string',
    imp: "import { toWcaEventId } from '@/lib/wca-events';",
    usage: "toWcaEventId('3x3') // \"333\"",
    category: 'wca',
    zh: '各种项目简写归一到标准 WCA id(recon "3x3" / upcoming "3" → "333")。',
    en: 'Normalize any event shorthand to the canonical WCA id.',
  },
  {
    name: 'eventDisplayName',
    sig: 'eventDisplayName(input: string, isZh: boolean): string',
    imp: "import { eventDisplayName } from '@/lib/wca-events';",
    usage: "eventDisplayName('333', false) // \"3×3\"",
    category: 'wca',
    zh: '项目 id → 显示名。',
    en: 'Event id → display name.',
  },
  {
    name: 'roundLabel',
    sig: 'roundLabel(rt: string): string',
    imp: "import { roundLabel } from '@/lib/wca-round-meta';",
    usage: "roundLabel('f') // \"Fi\"",
    category: 'wca',
    zh: 'round_type_id → 简短轮次标签。',
    en: 'round_type_id → short round label.',
  },
  {
    name: 'localizeCompName',
    sig: 'localizeCompName(id: string, name: string, isZh: boolean, opts?): string',
    imp: "import { localizeCompName } from '@/lib/comp-localize';",
    category: 'wca',
    zh: '比赛名:去 WCA 前缀 + 中文名回退(走 cubing.com)。',
    en: 'Competition name: strip the WCA prefix and fall back to the Chinese name.',
  },

  // ── cube ──────────────────────────────────
  {
    name: 'CUBE_FILL / CUBE_ON_FILL',
    sig: 'CUBE_FILL: Record<CubeFace, string>   // U D L R F B',
    imp: "import { CUBE_FILL, CUBE_ON_FILL } from '@/lib/cube-colors';",
    usage: "CUBE_FILL.U // \"#FFFFFF\"",
    category: 'cube',
    zh: '三阶 6 面标准配色的单一来源(贴纸 / 3D / 徽章 / 求解器都用它)。',
    en: 'Single source for the 6 cube-face colors (stickers, 3D, badges, solvers).',
  },
  {
    name: 'sq1MoveCounts',
    sig: 'sq1MoveCounts(alg: string): { twist; wca; face; slices; turns; nonIdentityTurns; doubleTurns }',
    imp: "import { sq1MoveCounts } from '@/lib/sq1-metrics';",
    usage: "sq1MoveCounts('(3,3)/') // { twist:1, wca:2, face:3, ... }",
    category: 'cube',
    zh: 'SQ1 序列三套计步口径:扭转(只数 /)/ WCA 12c4 / 面转(双层=2),复用 parseSq1Tokens。详见 /math/god?event=sq1。',
    en: "Counts a Square-1 (x,y)/ sequence under all 3 metrics (twist / WCA 12c4 / face-turn). See /math/god?event=sq1.",
  },

  // ── util ──────────────────────────────────
  {
    name: 'countryName',
    sig: 'countryName(iso2: string, isZh: boolean): string',
    imp: "import { countryName } from '@/lib/country-name';",
    usage: "countryName('cn', true) // \"中国\"",
    category: 'util',
    zh: 'ISO alpha-2 → 国家名(中英,带 curated 覆盖)。',
    en: 'ISO alpha-2 → country name (zh/en, with curated overrides).',
  },
  {
    name: 'prewarmScramble / pooledScramble',
    sig: 'prewarmScramble(...events: string[]): void\npooledScramble(event: string): Promise<string | null>',
    imp: "import { prewarmScramble, pooledScramble } from '@/lib/cubing-scramble';",
    usage: "prewarmScramble('333'); const s = await pooledScramble('333');",
    category: 'util',
    zh: '打乱池:路由挂载时 prewarm 预热,用时 pooled 秒取(cubing.js 现算太慢)。',
    en: 'Scramble pool: prewarm on mount, pop instantly with pooled (raw gen is slow).',
  },
];
