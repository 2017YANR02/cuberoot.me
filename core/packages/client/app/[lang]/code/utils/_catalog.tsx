// ★★★ 新增一个可复用 hook / 工具函数后,在这里登记一条 ★★★
// /code/utils 这页直接读这份 CATALOG 渲染。让下一个人 / 下一个 AI 写新代码前
// 翻一眼就知道「这个轮子已经有了」。签名照源码抄准,别 paraphrase。

import {
  Type, Crown, Smartphone, Mic, Radio, Timer, Disc, Languages, Shuffle, Flag, MapPin, User,
  ListChecks, CalendarDays, Trophy, Palette, Box, Link2, Webhook, Wrench, type LucideIcon,
} from 'lucide-react';

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

// 每张速查卡配一个代表图标(关键词推断,兜底按分类),让纯代码卡也有图。
const U_ICON_RULES: [RegExp, LucideIcon][] = [
  [/title|document/, Type],
  [/membership|member/, Crown],
  [/mobile|viewport|width/, Smartphone],
  [/speech|voice/, Mic],
  [/stream|live|socket|websocket/, Radio],
  [/timer|hold/, Timer],
  [/gesture|wheel|dial/, Disc],
  [/translat|bilingual|locale|language/, Languages],
  [/scramble/, Shuffle],
  [/country|flag/, Flag],
  [/city/, MapPin],
  [/\bname\b|cuber/, User],
  [/color|palette/, Palette],
  [/cube|sq1|move/, Box],
  [/result|format/, ListChecks],
  [/\bdate/, CalendarDays],
  [/event|round|competition|\bwca/, Trophy],
  [/url|\bapi|fetch/, Link2],
];

const U_CATEGORY_ICON: Record<UtilCat, LucideIcon> = {
  hook: Webhook,
  i18n: Languages,
  api: Link2,
  format: Type,
  wca: Trophy,
  cube: Box,
  util: Wrench,
};

export function iconFor(e: UtilEntry): LucideIcon {
  const hay = `${e.name} ${e.en}`.toLowerCase();
  for (const [re, Icon] of U_ICON_RULES) if (re.test(hay)) return Icon;
  return U_CATEGORY_ICON[e.category];
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
    name: 'useAlgTextField',
    sig: 'useAlgTextField(setValue: (v: string) => void): { ref, lang, onChange, onCompositionEnd }',
    imp: "import { useAlgTextField } from '@/hooks/useAlgTextField';",
    usage: "const f = useAlgTextField(setDraftAlg);  // <textarea value={draftAlg} {...f} />",
    category: 'hook',
    zh: '受控公式输入框:中文输入法开着也只落半角招式(全角转半角、汉字直接删)。组字中不动 value(IME 缓冲区会错乱),洗掉字符后把光标补回原位(受控 textarea 改 value 会被 React 甩到行尾)。非受控的用 components/AlgInput。',
    en: 'Controlled alg <textarea>: only half-width moves land, even with a CJK IME on. Skips composition, restores the caret after stripping.',
  },
  {
    name: 'useCopy',
    sig: 'useCopy(resetMs?: number): { copied: boolean; copy: (text: string) => void }',
    imp: "import { useCopy } from '@/hooks/useCopy';",
    usage: "const { copied, copy } = useCopy();  // <button onClick={() => copy(alg)}>{copied ? <Check/> : <Copy/>}</button>",
    category: 'hook',
    zh: '「复制 → 打勾 → 复位」。卸载时清掉 timer(手写那几处都漏了,组件在 1.2s 内卸载会 setState 到已卸载组件)。',
    en: 'Copy-to-clipboard with a transient checkmark. Clears its timer on unmount (the hand-rolled copies all forgot to).',
  },
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
    name: 'useModalDismiss',
    sig: 'useModalDismiss(onClose: () => void, disabled?: boolean): void',
    imp: "import { useModalDismiss } from '@/hooks/useModalDismiss';",
    usage: "useModalDismiss(onClose);  // Escape 关闭 + 锁 body 滚动",
    category: 'hook',
    zh: '模态框标准关闭接线:挂载期 Escape 关闭 + 锁 body 滚动,卸载复位。disabled(如提交中)不响应 Escape。遮罩点击 / 关闭按钮各模态自己写(onClick vs onMouseDown、✕ vs 图标 不统一,抽进壳会过度抽象)。',
    en: 'Standard modal dismissal: Escape-to-close + body-scroll lock while mounted; disabled suppresses Escape (e.g. mid-submit). Backdrop/close-button stay per-modal.',
  },
  {
    name: 'useSingleLineSolve',
    sig: 'useSingleLineSolve<R>(trimmed: string, lineCount: number, gateOk: boolean, invocation: SolveInvocation<R>): SolveState<R>',
    imp: "import { useSingleLineSolve } from '@/hooks/useSingleLineSolve';",
    usage: "useSingleLineSolve(trimmed, lineCount, gateOk, { async: false, solve: solveBsq });",
    category: 'hook',
    zh: '/scramble/solver 15 个「拼图最优解」页共用的单行求解状态机:同步(setTimeout 让出主线程再求解)/异步(Promise + 取消标志)两种引擎统一成同一个 idle/solving/done/error 状态;tableErrorMode 把离线表 fetch 失败与记号解析失败(message 前缀 bad:)分成两种 error。',
    en: 'Shared single-line solve state machine for the 15 puzzle-optimal-solver pages: unifies sync (setTimeout-deferred) and async (cancellable Promise) engines into one idle/solving/done/error state; tableErrorMode splits offline-table fetch failures from notation-parse failures (message prefixed bad:).',
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
    name: 'usePanelClamp',
    sig: 'usePanelClamp(open: boolean, ref: RefObject<HTMLElement | null>): void',
    imp: "import { usePanelClamp } from '@/hooks/usePanelClamp';",
    usage: 'usePanelClamp(open, panelRef); // {open && <div ref={panelRef} className="x-panel">}',
    category: 'hook',
    zh: '锚定下拉面板防溢出:打开时实测面板矩形,右缘越出视口就整体左移(负 margin-left,不碰 transform)。锚在触发钮下方(absolute + top:100%)的浮层必用;CSS 规则注明 anchored-panel: clamped(CI ratchet 查)。',
    en: 'Viewport clamp for anchored dropdown panels: on open, measures the panel and shifts it left (negative margin-left, transform untouched) if its right edge crosses the viewport. Required for panels anchored below a trigger (absolute + top:100%); declare anchored-panel: clamped in the CSS rule (CI ratchet).',
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
    zh: 'cstimer 式按住拖动径向轮盘:绑定计时面板,普通按压照常计时,拖过死区切手势模式并触发对应方向。配 <GestureWheel>,/timer 与 /alg 训练页共用。',
    en: 'cstimer-style press-and-drag radial dial on a timing surface: a hold still times, a drag fires the nearest direction. Pairs with <GestureWheel>; shared by /timer and the /alg trainer pages.',
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
    name: 'pickReconCover',
    sig: 'videoCoverInfo(url): CoverRef | null;  pickReconCover(videoUrl, isZh): CoverRef | null;  loadBiliCover/loadDouyinCover(id): Promise<string|null>',
    imp: "import { videoCoverInfo, pickReconCover, coverSyncSrc, loadBiliCover, loadDouyinCover } from '@/lib/recon-video-cover';",
    usage: "videoCoverInfo('https://youtu.be/abc') // { kind: 'yt', id: 'abc' }",
    category: 'wca',
    zh: '视频链接 → 封面引用(yt 直链 / bili BV / 抖音原 URL);YouTube 走直链、B 站/抖音走后端代理(模块级缓存)。复盘卡片 ReconCard 与成绩弹窗 VideoCoverThumb 共用,b23 短链等无封面返回 null。',
    en: 'Video link → cover reference (YouTube direct / Bilibili BV / Douyin URL); YouTube uses a direct image, Bilibili/Douyin go through a cached backend proxy. Shared by the recon card and the solve-popup VideoCoverThumb; no-cover links (e.g. b23 short links) return null.',
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
  {
    name: 'unofficialAoN',
    sig: 'unofficialAoN(attempts: number[], opts?: { min?: number }): { value: number; n: number; trim: number } | null',
    imp: "import { unofficialAoN } from '@/lib/unofficial-average';",
    usage: 'unofficialAoN([575,657,/*…*/589]) // { value: 613, n: 26, trim: 2 }',
    category: 'wca',
    zh: 'cstimer 式非官方平均(AoN):给 WCA 不记平均的轮次(对阵决赛 / Bo-N)算参考平均;去最快 / 最慢各 ceil(N×5%),DNF 超额则整体 DNF,有效次数 <min 返回 null。',
    en: 'cstimer-style unofficial AoN for rounds WCA records no average for (H2H finals / Bo-N); trims ceil(N×5%) each end, DNF if too many fail.',
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
  {
    name: 'countQtm / supportsQtm',
    sig: 'countQtm(line: string): number\nsupportsQtm(eventId: string): boolean',
    imp: "import { countQtm, supportsQtm } from '@cuberoot/shared/scramble-length';",
    usage: "countQtm(\"R U2 R'\") // 4  (末位 2 的半转算 2,旋转 token 算 0)",
    category: 'cube',
    zh: '3x3 面转序列的 QTM 计数(180°=2),整体旋转 x/y/z 不计 — 打乱与求解解法通用的单一来源。HTM 相同时给解法排序的二级键就用它。',
    en: 'QTM count of a 3x3 face-turn sequence (180°=2; whole-cube rotations count 0). Single source for both scrambles and solver solutions.',
  },
  {
    name: 'applyScramble (puzzle-group)',
    sig: 'applyScramble(g: PuzzleGroup, scramble: string): PuzzleState',
    imp: "import { applyScramble, solvedState, type PuzzleGroup } from '@/lib/puzzle-group';",
    usage: "applyScramble(FTO_GROUP, 'R U F') // → per-orbit { pieces[], orient[] }",
    category: 'cube',
    zh: '把任意扭转魔方当置换群:轨道(块数+朝向)+ 生成元用循环记号定义,token 解析成生成元幂(X\'=逆/X2=平方/X--=(X++)⁻¹)作用到还原态。/scramble/gen 的非 WCA 打乱图(fto/baby_fto/master_tetraminx/kilominx/redi_cube)的渲染内核,群源在 _svg/_nets/*.ts,由 scripts/gen-net.mts 从 cubing.js 派生+校验。',
    en: 'Treats any twisty puzzle as an oriented permutation group (orbits + cycle-notation generators); resolves scramble tokens to generator powers and applies them. Renders the non-WCA 2D scramble nets; group sources in _svg/_nets/*.ts, derived from cubing.js by scripts/gen-net.mts.',
  },
  {
    name: 'ImageSpec / readSpecFromParams / specToParams',
    sig: 'readSpecFromParams(params: ParamsInput, prefix: string): ImageSpec\nspecToParams(s: ImageSpec, prefix: string): URLSearchParams\nimageQueryKeys(prefix: string): string[]',
    imp: "import { readSpecFromParams, specToParams, imageQueryKeys } from '@/lib/puzzle-image/codec';",
    usage: "readSpecFromParams('pzl=3&view=trans&stage=oll', '') // → ImageSpec",
    category: 'cube',
    zh: '魔方图片状态(ImageSpec)的 URL 编解码,单一来源。只写非默认值(干净页面就一个 ?pzl=3),prefix 给每个 key 加前缀,好让已经占了 puzzle/alg/view 的宿主(/sim)把图片状态挂到 img_* 下不撞车。prefix 为 \'\' 时与 /visualcube 历史 query 逐字节一致(含只读旧别名 puzzle=)。',
    en: 'Single source for the URL codec of a puzzle-image state (ImageSpec). Emits only non-default values (a pristine page is just ?pzl=3); `prefix` namespaces every key so a host that already owns puzzle/alg/view (/sim) can mount the image state under img_*. At prefix \'\' it reproduces /visualcube\'s historical query byte-for-byte, legacy read-only `puzzle=` alias included.',
  },
  {
    name: 'renderSpecSvg',
    sig: 'renderSpecSvg(s: ImageSpec, o?: SpecRenderOptions): string | null\ndomRenderKindOf(s: ImageSpec): DomRenderKind | null',
    imp: "import { renderSpecSvg, domRenderKindOf } from '@/lib/puzzle-image/render';",
    usage: 'renderSpecSvg(spec) ?? serializeTheDom()  // null = 该 spec 需要 DOM 渲染器',
    category: 'cube',
    zh: 'ImageSpec → SVG 字符串的纯渲染层(无 React / DOM,node 可跑):visualcube 立体/平面 + 全部 tnoodle 展开图。返回 null = 这个 spec 归 DOM 渲染器(sr-puzzlegen / 3x3 涂色板 / cubing.js 斜转展开),用 domRenderKindOf 问是哪个。导出 SVG/PNG 一律走它,别去 DOM 里刮 <svg>。',
    en: 'Pure ImageSpec → SVG-string render layer (no React / DOM, runs in node): the visualcube iso/plan path plus every tnoodle net. null means the spec belongs to a DOM-bound renderer (sr-puzzlegen / the 3x3 paint editor / the cubing.js skewb net) — ask domRenderKindOf which. SVG/PNG export goes through this, never by scraping <svg> out of the DOM.',
  },
  {
    name: 'useImageSpec',
    sig: 'useImageSpec(prefix: string): [ImageSpec, (patch: Partial<ImageSpec>) => void]',
    imp: "import { useImageSpec } from '@/components/puzzle-image/useImageSpec';",
    usage: "const [spec, setSpec] = useImageSpec('');  // /visualcube;/sim 用 'img_'",
    category: 'cube',
    zh: 'ImageSpec 的 nuqs 绑定(history: \'replace\')。只给页级宿主用 —— PuzzleImageStudio 是受控件,URL 归页面。URL 只做一次种子,之后 URL 是 spec 的派生视图。',
    en: "The nuqs binding for an ImageSpec (history: 'replace'). PAGE-LEVEL HOSTS ONLY — PuzzleImageStudio is controlled and the page owns the URL. The URL seeds the spec once; afterwards the URL is a derived view of the spec.",
  },
  {
    name: 'cloudOptimalScramble',
    sig: 'cloudOptimalScramble(scramble: string, onPhase?: (p: CloudOptimalScramblePhase) => void, signal?: AbortSignal): Promise<{ scramble: string; moves: number }>',
    imp: "import { cloudOptimalScramble, firstBadHtmToken } from '@/lib/cloud-optimal-scramble';",
    usage: "const { scramble, moves } = await cloudOptimalScramble('U R2 F …')  // fewest-move scramble reaching the same state",
    category: 'cube',
    zh: '3x3 云端最优打乱:POST /v1/scramble/optimal-solve(与 /scramble/solver 云端求解同一端点),流式拿最优解后取逆 —— 解开一个状态的最少步数 = 到达它的最少步数打乱。喂一个 tnoodleRandomScramble 打乱进去就能拿到该随机状态的最优打乱,/sim 的「最优打乱」按钮用它。3x3-only,登录门(服务端 requireAuth,401 时 reject 出服务器的错误信息)。',
    en: '3x3 cloud optimal scramble: POSTs /v1/scramble/optimal-solve (same endpoint /scramble/solver\'s cloud solve uses), streams the optimal solution, then inverts it — fewest moves to solve a state = fewest moves to scramble to it. Feed it a tnoodleRandomScramble output to get that random state\'s optimal scramble; used by /sim\'s "optimal scramble" button. 3x3-only, login-gated server-side.',
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
