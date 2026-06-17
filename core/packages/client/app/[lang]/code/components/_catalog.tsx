'use client';

/* ──────────────────────────────────────────────────────────────────────────
 * cuberoot.me 自有组件库目录 —— /code/components 的唯一数据源。
 *
 *  ★ 新建一个可复用组件后,在这里登记一条 ENTRY(顺手写个实时 Demo)。★
 *    这样下一个人 / 下一个 AI 打开 /code/components 就能查到它,不必翻 components/。
 *
 *  登记规范:name + import(可照抄的整行)+ category + zh/en 一句话描述,
 *  可选 usage 代码、可选 Demo(只给自包含、能在中性背景上独立渲染的组件写)、
 *  可选 note(关联 skill / 约束)。复杂、需要后端数据或上下文的组件放 'more' 组,
 *  只登记路径 + 描述,不写 Demo。
 * ────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '@/i18n/tr';
import PillToggle from '@/components/PillToggle/PillToggle';
import { ClearButton } from '@/components/ClearButton';
import { SearchInput } from '@/components/SearchInput';
import { ListSelect } from '@/components/ListSelect';
import { VariantSelect } from '@/components/VariantSelect';
import { RangeSlider } from '@/components/RangeSlider/RangeSlider';
import { VARIANT_ORDER } from '@/lib/scramble-variants';
import NumberCommitInput from '@/components/NumberCommitInput';
import { RecordBadge } from '@/components/RecordBadge/RecordBadge';
import MembershipBadge from '@/components/MembershipBadge';
import { Flag } from '@/components/Flag';
import { ContinentIcon } from '@/components/ContinentIcon';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import WcaEventSelector from '@/components/WcaEventSelector';
import HeaderToggles from '@/components/HeaderToggles';
import CubeShorthand from '@/components/CubeShorthand';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { VisualCube } from '@/components/VisualCube';
import { AttemptsList } from '@/components/persons/sections/results/AttemptsList';
import '@/components/wca-results/attempts-grid.css';
import Link from '@/components/AppLink';

export type GalleryCategory = 'toggle' | 'button' | 'input' | 'badge' | 'display' | 'nav' | 'more';

export interface ComponentEntry {
  name: string;
  /** 展示用代码:demoed 组件给整行 import;'more' 组给 components/ 下路径 */
  import: string;
  category: GalleryCategory;
  zh: string;
  en: string;
  usage?: string;
  Demo?: () => ReactNode;
  note?: { zh: string; en: string };
}

export const CATEGORIES: { id: GalleryCategory; zh: string; en: string }[] = [
  { id: 'toggle', zh: '开关与切换', en: 'Toggles & switches' },
  { id: 'button', zh: '按钮', en: 'Buttons' },
  { id: 'input', zh: '输入与选择', en: 'Inputs & selects' },
  { id: 'badge', zh: '徽章与图标', en: 'Badges & icons' },
  { id: 'display', zh: '展示与可视化', en: 'Display & visualization' },
  { id: 'nav', zh: '导航与链接', en: 'Navigation & links' },
  { id: 'more', zh: '更多组件(数据驱动 / 需上下文,无内联演示)', en: 'More (data-driven / context-bound, no inline demo)' },
];

function useIsZh() {
  const { i18n } = useTranslation();
  return i18n.language.startsWith('zh');
}

/* ── demos (self-contained, render on a neutral stage) ──────────────────── */

function PillToggleDemo() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  return (
    <div className="cg-row">
      <PillToggle value={a} onChange={setA} ariaLabel="switch" />
      <PillToggle value={b} onChange={setB} onLabel={tr({ zh: '开', en: 'On'
    })} offLabel={tr({ zh: '关', en: 'Off'
    })} />
    </div>
  );
}

function ClearButtonDemo() {
  const isZh = useIsZh();
  const [hits, setHits] = useState(0);
  return (
    <div className="cg-row">
      <ClearButton onClick={() => setHits((h) => h + 1)} variant="standalone" isZh={isZh} />
      <span className="cg-hint">{isZh ? `点了 ${hits} 次` : `clicked ${hits}×`}</span>
    </div>
  );
}

function RangeSliderDemo() {
  const [v, setV] = useState<[number, number]>([4, 6]);
  const span = v[0] === v[1] ? `${v[0]}` : `${v[0]}–${v[1]}`;
  return (
    <div style={{ width: 240, maxWidth: '100%' }}>
      <div className="cg-hint" style={{ marginBottom: 4 }}>{span} {tr({ zh: '步', en: 'moves' })}</div>
      <RangeSlider
        min={0}
        max={14}
        value={v}
        onChange={setV}
        marks={[0, 7, 14]}
        ariaLabel={tr({ zh: '步数范围', en: 'Step range' })}
      />
    </div>
  );
}

function NumberCommitDemo() {
  const [n, setN] = useState(5);
  return <NumberCommitInput value={n} min={1} max={20} onCommit={setN} className="cg-input cg-num" aria-label="count" />;
}

function SearchInputDemo() {
  const [q, setQ] = useState('');
  return (
    <div className="cg-row">
      <SearchInput
        value={q}
        onChange={setQ}
        placeholder={tr({ zh: '试试中文输入法', en: 'Try an IME' })}
        inputClassName="cg-input"
      />
      <span style={{ fontFamily: 'var(--cg-mono)', color: 'var(--muted-foreground)' }}>{q || '—'}</span>
    </div>
  );
}

function ListSelectDemo() {
  const isZh = useIsZh();
  const [v, setV] = useState('');
  const items = [
    { value: '333', label: '3x3x3' },
    { value: 'us', label: tr({ zh: '美国', en: 'United States'
    }), country: 'us' },
    { value: 'jp', label: tr({ zh: '日本', en: 'Japan' }), country: 'jp' },
    { value: 'tw', label: tr({ zh: '中华台北', en: 'Chinese Taipei'
    }), country: 'tw' },
  ];
  return <ListSelect items={items} value={v} onChange={setV} allLabel={isZh ? '全部' : 'All'} searchable />;
}

function VariantSelectDemo() {
  const isZh = useIsZh();
  const [v, setV] = useState('std');
  return <VariantSelect value={v} options={VARIANT_ORDER} onChange={setV} isZh={isZh} />;
}

function EventSelectorDemo() {
  const isZh = useIsZh();
  const [ev, setEv] = useState('333');
  const avail = new Set(['333', '222', '444', '555', '333oh', 'pyram', 'skewb', 'sq1', 'clock', 'minx', '333bf']);
  return <WcaEventSelector availableEvents={avail} onlyAvailable isZh={isZh} selectedEvent={ev} onSelect={setEv} />;
}

function RecordBadgeDemo() {
  return (
    <div className="cg-row">
      <RecordBadge record="WR" />
      <RecordBadge record="NR" />
      <RecordBadge record="AsR" />
      <RecordBadge record="PR2" />
    </div>
  );
}

function MembershipBadgeDemo() {
  return (
    <div className="cg-row">
      <MembershipBadge />
      <MembershipBadge lifetime />
    </div>
  );
}

function FlagDemo() {
  return (
    <div className="cg-row cg-flag-row">
      <Flag iso2="us" className="cg-flag" />
      <Flag iso2="jp" className="cg-flag" />
      <Flag iso2="cn" className="cg-flag" />
      <Flag iso2="de" className="cg-flag" />
      <Flag iso2="tw" className="cg-flag" />
    </div>
  );
}

function ContinentIconDemo() {
  return (
    <div className="cg-row cg-icon-row">
      <ContinentIcon slug="asia" />
      <ContinentIcon slug="europe" />
      <ContinentIcon slug="northAmerica" />
      <ContinentIcon slug="oceania" />
    </div>
  );
}

function EventIconDemo() {
  return (
    <div className="cg-row cg-icon-row">
      <EventIcon event="333" />
      <EventIcon event="444" />
      <EventIcon event="pyram" />
      <EventIcon event="skewb" />
      <EventIcon event="minx" />
      <EventIcon event="clock" />
    </div>
  );
}

function HeaderTogglesDemo() {
  // right-aligned in the stage so the right-anchored lang dropdown has room
  return (
    <div className="cg-demo-end">
      <HeaderToggles />
    </div>
  );
}

function AppLinkDemo() {
  return (
    <div className="cg-row">
      <Link href="/wca" className="cg-link">/wca</Link>
      <Link href="/scramble/stats" className="cg-link">/scramble/stats</Link>
    </div>
  );
}

/* ── catalog ────────────────────────────────────────────────────────────── */

function CubeShorthandDemo() {
  return <CubeShorthand alg="R U R' U' F R2 x" size={40} showLabels />;
}

function ScramblePreview2DDemo() {
  return (
    <div className="cg-row">
      <ScramblePreview2D event="333" scramble="R U R' U' R' F R2 U' R' U' R U R' F'" size={84} />
      <ScramblePreview2D event="pyram" scramble="U L R' B U' L R U' L' R B'" size={84} />
      <ScramblePreview2D event="skewb" scramble="R U L B R L U R B" size={84} />
    </div>
  );
}

// VisualCube fetches its SVG from the backend via apiUrl(), which resolves to a
// relative path on SSR but an absolute prod URL on the client → hydration mismatch.
// Gate the demo to client-only so server and client both render an empty placeholder first.
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function VisualCubeDemo() {
  const mounted = useMounted();
  if (!mounted) return <div className="cg-row" style={{ minHeight: 84 }} aria-hidden />;
  return (
    <div className="cg-row">
      <VisualCube view="iso" setup="R U R' U R U2 R'" size={84} alt="OLL state" />
      <VisualCube view="pll" algorithm="R U R' U' R' F R2 U' R' U' R U R' F'" size={84} alt="T perm" />
    </div>
  );
}

function AttemptsListDemo() {
  const isZh = useIsZh();
  // 三行不同量级(全 sub-min / 含 1 分多 / 全 1-2 分),展示跨行同列右对齐 + ao5 去括号占位。
  const rows: { attempts: number[]; best: number }[] = [
    { attempts: [5023, 4712, 6636, 5341, 4878], best: 4712 },
    { attempts: [5412, 5382, 9740, 5067, 4423], best: 4423 },
    { attempts: [15389, 11874, 8152, 11587, 8876], best: 8152 },
  ];
  return (
    <div className="cg-attempts-demo">
      {rows.map((r, i) => (
        <AttemptsList
          key={i}
          attempts={r.attempts}
          best={r.best}
          eventId="333"
          compId="DemoOpen2024"
          roundTypeId="f"
          reconLookup={null}
          isZh={isZh}
          personId="2017DEMO01"
          personName="Demo Cuber"
          compName="Demo Open 2024"
        />
      ))}
    </div>
  );
}

export const CATALOG: ComponentEntry[] = [
  {
    name: 'PillToggle',
    import: "import PillToggle from '@/components/PillToggle/PillToggle';",
    category: 'toggle',
    zh: 'iOS 风格布尔开关。可点击,也能拖动滑钮横向滑过中线切换;不传 on/off 文字 = 纯滑轨开关。',
    en: 'iOS-style boolean switch. Click it, or drag the knob past the midline; omit the on/off labels for a plain track switch.',
    usage: '<PillToggle value={on} onChange={setOn} ariaLabel="dark mode" />',
    Demo: PillToggleDemo,
    note: { zh: 'page-scope 默认 min-width:0 贴合文字;on/off 文案差很多才保留 min-width。', en: 'Page-scope min-width:0 hugs the text by default; keep min-width only when on/off labels differ a lot.' },
  },
  {
    name: 'HeaderToggles',
    import: "import HeaderToggles from '@/components/HeaderToggles';",
    category: 'toggle',
    zh: '右上角语言 + 主题切换二连组件。新页面别手写一对 <LangToggle/> <ThemeToggle/>,直接用它。',
    en: 'The top-right language + theme toggle pair. Don’t hand-write a <LangToggle/> <ThemeToggle/> couple on new pages — use this.',
    usage: '<HeaderToggles />',
    Demo: HeaderTogglesDemo,
    note: { zh: '这是真实控件,点击会切换全站语言 / 主题。', en: 'Live control — clicking actually flips the whole site’s language / theme.' },
  },
  {
    name: 'ClearButton',
    import: "import { ClearButton } from '@/components/ClearButton';",
    category: 'button',
    zh: '统一的 × 清除按钮。选择 / 搜索框非空时显示;variant="inline" 浮在 input 内,"standalone" 是独立圆钮。',
    en: 'The canonical × clear button. Show it when a select / search box is non-empty; variant="inline" floats inside the input, "standalone" is a free round button.',
    usage: "{value && <ClearButton onClick={() => setValue('')} variant=\"inline\" />}",
    Demo: ClearButtonDemo,
    note: { zh: '别再写一份局部 .xxx-clear CSS,全站统一走这个。', en: 'Don’t write another local .xxx-clear CSS — everything routes through this.' },
  },
  {
    name: 'ListSelect',
    import: "import { ListSelect } from '@/components/ListSelect';",
    category: 'input',
    zh: '通用筛选下拉:button + 浮层,支持国旗、搜索、× 清除、(空)桶。caller 预格式化 label,组件不做本地化。',
    en: 'Generic filter dropdown: button + popup with flags, search, × clear and an (empty) bucket. The caller pre-formats labels; the component does no i18n.',
    usage: '<ListSelect items={items} value={v} onChange={setV} allLabel="All" searchable />',
    Demo: ListSelectDemo,
  },
  {
    name: 'VariantSelect',
    import: "import { VariantSelect } from '@/components/VariantSelect';",
    category: 'input',
    zh: '打乱方法 / 阶段下拉:首页近期打乱与 /scramble/stats 共用。默认 label=variantLabel(方法),传 label={stageLabel} 即阶段下拉。纯展示,onChange 各页自理。',
    en: 'Scramble method / stage dropdown shared by the landing Recent Scrambles and /scramble/stats. Default label=variantLabel (method); pass label={stageLabel} for the stage dropdown. Presentational; each page owns onChange.',
    usage: '<VariantSelect value={v} options={opts} onChange={setV} isZh={isZh} label={stageLabel} />',
    Demo: VariantSelectDemo,
    note: { zh: '两页的方法 / 阶段下拉都走它,别再各写一份 <select>。', en: 'Both pages’ method / stage dropdowns route through it — don’t hand-roll another <select>.' },
  },
  {
    name: 'NumberCommitInput',
    import: "import NumberCommitInput from '@/components/NumberCommitInput';",
    category: 'input',
    zh: '数字输入框,允许清空自由输入,只在 blur / Enter 时提交 clamp 后的值,避免每次按键被 Math.max 弹回。',
    en: 'A number input that lets you clear and type freely, committing the clamped value only on blur / Enter — no per-keystroke snap-back.',
    usage: '<NumberCommitInput value={n} min={1} max={20} onCommit={setN} />',
    Demo: NumberCommitDemo,
  },
  {
    name: 'SearchInput',
    import: "import { SearchInput } from '@/components/SearchInput';",
    category: 'input',
    zh: 'IME 安全的受控文本搜索框:中文 / 日文输入法合成途中不写回外部 store,合成结束才提交,避免 nuqs / 节流 store 的重渲染打断拼音(把 bei 拼成乱码)。内置行内清除 ×。',
    en: 'IME-safe controlled text search box: during CJK composition it holds value locally and only commits on compositionend, so a nuqs / throttled-store re-render can’t corrupt the in-progress pinyin. Built-in inline clear ×.',
    usage: '<SearchInput value={q} onChange={setQ} placeholder="搜索" />',
    Demo: SearchInputDemo,
    note: { zh: '任何写 nuqs / 节流 store 的自由文本输入都走它,别裸写 <input value onChange=setQuery>。CI 守卫 tests/ime-safe-search-input。', en: 'Use it for any free-text input that writes to nuqs / a throttled store — never hand-roll <input value onChange=setQuery>. Guarded by tests/ime-safe-search-input.' },
  },
  {
    name: 'RangeSlider',
    import: "import { RangeSlider } from '@/components/RangeSlider/RangeSlider';",
    category: 'input',
    zh: '双圆点 min–max 区间滑块:两个原生 range 输入叠在一条轨道上(输入透传指针、只有圆点可拖),区间填充走 --accent。键盘 / 触摸可用,coarse 指针自动放大圆点;颜色经 --rs-* 变量可在非 token 上下文覆写。',
    en: 'Dual-thumb min–max range slider: two native range inputs stacked on one rail (inputs are pointer-transparent, only the thumbs drag), fill painted with --accent. Keyboard- and touch-accessible, thumbs enlarge on coarse pointers; colors overridable via --rs-* vars for non-token contexts.',
    usage: '<RangeSlider min={0} max={14} value={[lo, hi]} onChange={setRange} marks={[0, 7, 14]} />',
    Demo: RangeSliderDemo,
    note: { zh: '需要 min–max 双端选择就用它,别再叠两个 <input type=range> 手撸。', en: 'Use it for any min–max dual selection — don’t hand-stack two <input type=range> again.' },
  },
  {
    name: 'WcaEventSelector',
    import: "import WcaEventSelector from '@/components/WcaEventSelector';",
    category: 'input',
    zh: 'WCA 21 项目图标选择器(绿色 active)。/wca 子页选项目统一用它,不要下拉。支持单选 / 多选 / 徽章 / 折叠废止项。',
    en: 'The 21-event WCA icon picker (green active). Use it for event selection across /wca pages instead of a dropdown. Single / multi / badges / collapsible cancelled events.',
    usage: '<WcaEventSelector availableEvents={set} isZh={isZh} selectedEvent={ev} onSelect={setEv} />',
    Demo: EventSelectorDemo,
    note: { zh: '项目选择器必须绿色 active,只走这个组件,禁 per-page 覆写。', en: 'Event pickers must be green-active — only this component, no per-page overrides.' },
  },
  {
    name: 'RecordBadge',
    import: "import { RecordBadge } from '@/components/RecordBadge/RecordBadge';",
    category: 'badge',
    zh: 'WCA 纪录标志(WR / CR / NR / AsR / ER / PR 名次 等)的唯一入口。传 iso2 可把大洲纪录展开成具体洲。',
    en: 'The single entry point for WCA record badges (WR / CR / NR / AsR / ER / PR-rank …). Pass iso2 to expand a continental record to the right continent.',
    usage: '<RecordBadge record="WR" />',
    Demo: RecordBadgeDemo,
  },
  {
    name: 'MembershipBadge',
    import: "import MembershipBadge from '@/components/MembershipBadge';",
    category: 'badge',
    zh: 'CubeRoot 会员标记(小药丸,Crown 图标)。lifetime 显示「永久会员」并用实心强调色。',
    en: 'CubeRoot membership pill (Crown icon). With lifetime it reads “Lifetime” in solid accent.',
    usage: '<MembershipBadge lifetime />',
    Demo: MembershipBadgeDemo,
  },
  {
    name: 'Flag',
    import: "import { Flag } from '@/components/Flag';",
    category: 'badge',
    zh: '国旗渲染(flag-icons + 中华台北特判 SVG)。多地 / 超国家代码渲染成空描边占位。必须带 className 控制尺寸。',
    en: 'Country flag (flag-icons + a Chinese-Taipei special-case SVG). Multi-region codes render as an outlined placeholder. Always pass className to size it.',
    usage: '<Flag iso2="jp" className="my-flag" />',
    Demo: FlagDemo,
    note: { zh: 'TW 用 WCA 的 Chinese Taipei SVG,已在组件内处理,别手写。', en: 'TW uses WCA’s Chinese Taipei SVG, handled inside — don’t hand-roll it.' },
  },
  {
    name: 'CubeShorthand',
    import: "import CubeShorthand from '@/components/CubeShorthand';",
    category: 'badge',
    zh: '把一条公式画成一行「一个转动一个符号」的可视化速记:三竖条=三列(箭头那条=R/L/M)、三横条=三行(U/D/E)、叠放方块=面转动 F/B/S、双箭头=180°。移动解析复用 lib/pll-fingertricks。',
    en: 'Renders an alg as a row of discrete shorthand glyphs, one per move: three vertical bars = the 3 columns (the arrowed one = R/L/M), three horizontal bars = the rows (U/D/E), stacked squares = a face turn F/B/S, double-head = 180°. Move parsing reuses lib/pll-fingertricks.',
    usage: "<CubeShorthand alg=\"R U R' U'\" size={44} showLabels />",
    Demo: CubeShorthandDemo,
    note: { zh: '在「绘制」编辑器(/paint)的「魔方速记」面板可把整条公式插成可编辑的矢量符号;箭头=该层从正面看的可见移动方向(自动消歧顺/逆)。', en: 'The Cube Shorthand panel in the Paint editor (/paint) inserts a whole alg as editable vector glyphs; the arrow shows that layer’s visible motion from the front (auto-resolves CW/CCW).' },
  },
  {
    name: 'EventIcon / CubingIcon',
    import: "import { EventIcon } from '@/components/EventIcon/EventIcon';",
    category: 'badge',
    zh: 'WCA / cubing 项目图标(内联 SVG)。传 event id 即可,高阶 NxN 统一退回 7x7。需要原始 cubing-icons key 用 <CubingIcon icon=...>。',
    en: 'WCA / cubing event icon (inline SVG). Pass an event id; high-order NxN falls back to 7×7. For a raw cubing-icons key use <CubingIcon icon=...>.',
    usage: '<EventIcon event="333" />',
    Demo: EventIconDemo,
    note: { zh: '禁用空 <span className="cubing-icon">,那是空白。', en: 'Don’t use an empty <span className="cubing-icon"> — it renders blank.' },
  },
  {
    name: 'ContinentIcon',
    import: "import { ContinentIcon } from '@/components/ContinentIcon';",
    category: 'badge',
    zh: '大洲地球图标(正射投影小图,栅格化 webp)。RegionPicker 筛选、洲纪录标记在用。',
    en: 'Continent globe icon (orthographic mini render, rasterized webp). Used by the RegionPicker filter and continental-record markers.',
    usage: '<ContinentIcon slug="asia" />',
    Demo: ContinentIconDemo,
  },
  {
    name: 'AppLink',
    import: "import Link from '@/components/AppLink';",
    category: 'nav',
    zh: '语言感知内部链接:英文出裸地址、中文补 /zh 前缀。所有站内跳转用它,禁裸 next/link、禁手拼 lang 前缀。',
    en: 'Language-aware internal link: a bare URL for English, a /zh prefix for Chinese. Use it for all in-site navigation — never bare next/link, never hand-built lang prefixes.',
    usage: '<Link href="/wca/comp">…</Link>',
    Demo: AppLinkDemo,
  },
  {
    name: 'HomeLink',
    import: "import HomeLink from '@/components/HomeLink';",
    category: 'nav',
    zh: '回首页链接(带正确 lang 前缀)。/code 等顶层页的"回首页"统一用它。',
    en: 'Back-to-home link (with the correct lang prefix). Used for "home" on top-level pages like /code.',
    usage: '<HomeLink>← Home</HomeLink>',
  },
  {
    name: 'CompPicker',
    import: 'components/CompPicker.tsx',
    category: 'more',
    zh: 'WCA 比赛搜索 / 选择输入框。任何输入或搜索比赛的 UI 必须用它。',
    en: 'WCA competition search / picker input. Required for any comp-input or comp-search UI.',
  },
  {
    name: 'WcaPersonPicker',
    import: 'components/WcaPersonPicker.tsx',
    category: 'more',
    zh: '选手搜索选择器。默认本地索引最快,别传 searchFn(后端代理对中文 / 单字符返空)。',
    en: 'Cuber search / picker. The default local index is fastest — don’t pass searchFn (the backend proxy returns empty for Chinese / single chars).',
  },
  {
    name: 'GestureWheel',
    import: "import GestureWheel from '@/components/GestureWheel';",
    category: 'more',
    zh: 'cstimer 式按住拖动径向轮盘(8 方向,ref 命令式驱动)。配 useGestureWheel hook 用,/timer 与 /trainer 计时面板共用;labels 可定制,空字符串隐藏槽位。',
    en: 'cstimer-style press-and-drag radial dial (8 directions, ref-driven). Pairs with the useGestureWheel hook; shared by /timer and /trainer timing surfaces. Labels are customizable; an empty string hides a slot.',
  },
  {
    name: 'VisualCube',
    import: "import { VisualCube } from '@/components/VisualCube';",
    category: 'display',
    zh: 'NxN 魔方状态图(facelets → SVG,服务端渲染),唯一入口。手写 <rect> 拼魔方 = bug。view=iso/pll/oll/f2l…,setup= 正向打乱,或 algorithm= 当解法(渲染其逆)。',
    en: 'NxN cube state image (facelets → SVG, server-rendered), single entry point. Hand-rolling a cube out of <rect> is a bug. view=iso/pll/oll/f2l…, setup= a forward scramble, or algorithm= treated as a solution (renders its inverse).',
    usage: '<VisualCube view="pll" algorithm="R U R\' U\' …" size={88} />',
    Demo: VisualCubeDemo,
    note: { zh: '图从后端 /v1/visualcube.svg 取(数据驱动),后端挂时不显示。', en: 'The image is fetched from the backend /v1/visualcube.svg (data-driven); it won’t render if the backend is down.' },
  },
  {
    name: 'ScramblePreview2D',
    import: "import { ScramblePreview2D } from '@/components/ScramblePreview2D';",
    category: 'display',
    zh: '打乱的 2D 平面展开图(WCA net),纯前端 SVG 渲染(无后端)。"打乱图"统一用它,不是 3D iso。覆盖 2-7 阶 / 金字塔 / 斜转 / SQ1 / 五魔 / 时钟 / 镜面。',
    en: 'The 2D unfolded scramble net (WCA net), pure client-side SVG (no backend). "Scramble image" means this, not a 3D iso view. Covers 2–7×7 / pyraminx / skewb / SQ1 / megaminx / clock / mirror.',
    usage: '<ScramblePreview2D event="333" scramble={scr} size={60} />',
    Demo: ScramblePreview2DDemo,
  },
  {
    name: 'ChainExplorer',
    import: 'components/ChainExplorer.tsx',
    category: 'more',
    zh: 'mallard 式 FMC 分步还原链浏览器(EO→DR→HTR→FR→收尾)。Rust→WASM 链式求解,逐阶段轴 / 步数窗口 / 排除控制 + 单个共享 3D 播放器。需 WASM 求解器池,/scramble/analyzer 底部在用。',
    en: 'Mallard-style FMC step-chain explorer (EO→DR→HTR→FR→Finish). Rust→WASM chained solving with per-stage axis / length-window / exclude controls and one shared 3D player. Needs the WASM solver pool; mounted at the bottom of /scramble/analyzer.',
  },
  {
    name: 'AttemptsList',
    import: "import { AttemptsList } from '@/components/persons/sections/results/AttemptsList';",
    category: 'display',
    zh: 'WCA 成绩的「详细成绩」单元(选手页 ByCompList / ByEventView 与复盘页同构)。每把右对齐 + ao5 去括号占位 + 跨行同列对齐(布局走共享 wca-results/attempts-grid.css)。已复盘的把点击跳复盘,管理员编辑模式行内改值,没复盘的把跳 /recon/submit 预填。',
    en: 'The WCA "Attempts" cell (shared by the person page ByCompList / ByEventView and the recon page). Right-aligned solves + ao5 bracket placeholders + cross-row column alignment (layout from the shared wca-results/attempts-grid.css). A reconstructed solve links to its recon, admin edit-mode edits inline, a no-recon solve links to /recon/submit prefilled.',
    Demo: AttemptsListDemo,
    note: { zh: '点击行为需 reconLookup + 选手 / 比赛上下文;Demo 用 mock 数据,只展示对齐 + 括号占位。', en: 'Click behavior needs reconLookup + person / comp context; the demo uses mock data to show alignment + bracket placeholders only.' },
  },
];
