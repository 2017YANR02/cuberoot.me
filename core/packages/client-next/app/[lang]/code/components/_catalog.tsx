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

import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import PillToggle from '@/components/PillToggle/PillToggle';
import { ClearButton } from '@/components/ClearButton';
import { ListSelect } from '@/components/ListSelect';
import NumberCommitInput from '@/components/NumberCommitInput';
import { RecordBadge } from '@/components/RecordBadge/RecordBadge';
import { Flag } from '@/components/Flag';
import { ContinentIcon } from '@/components/ContinentIcon';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import WcaEventSelector from '@/components/WcaEventSelector';
import HeaderToggles from '@/components/HeaderToggles';
import Link from '@/components/AppLink';

export type GalleryCategory = 'toggle' | 'button' | 'input' | 'badge' | 'nav' | 'more';

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
  { id: 'nav', zh: '导航与链接', en: 'Navigation & links' },
  { id: 'more', zh: '更多组件(数据驱动 / 需上下文,无内联演示)', en: 'More (data-driven / context-bound, no inline demo)' },
];

function useIsZh() {
  const { i18n } = useTranslation();
  return i18n.language.startsWith('zh');
}

/* ── demos (self-contained, render on a neutral stage) ──────────────────── */

function PillToggleDemo() {
  const isZh = useIsZh();
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  return (
    <div className="cg-row">
      <PillToggle value={a} onChange={setA} ariaLabel="switch" />
      <PillToggle value={b} onChange={setB} onLabel={isZh ? '开' : 'On'} offLabel={isZh ? '关' : 'Off'} />
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

function NumberCommitDemo() {
  const [n, setN] = useState(5);
  return <NumberCommitInput value={n} min={1} max={20} onCommit={setN} className="cg-input cg-num" aria-label="count" />;
}

function ListSelectDemo() {
  const isZh = useIsZh();
  const [v, setV] = useState('');
  const items = [
    { value: '333', label: '3x3x3' },
    { value: 'us', label: isZh ? '美国' : 'United States', country: 'us' },
    { value: 'jp', label: isZh ? '日本' : 'Japan', country: 'jp' },
    { value: 'tw', label: isZh ? '中华台北' : 'Chinese Taipei', country: 'tw' },
  ];
  return <ListSelect items={items} value={v} onChange={setV} allLabel={isZh ? '全部' : 'All'} searchable />;
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
    name: 'NumberCommitInput',
    import: "import NumberCommitInput from '@/components/NumberCommitInput';",
    category: 'input',
    zh: '数字输入框,允许清空自由输入,只在 blur / Enter 时提交 clamp 后的值,避免每次按键被 Math.max 弹回。',
    en: 'A number input that lets you clear and type freely, committing the clamped value only on blur / Enter — no per-keystroke snap-back.',
    usage: '<NumberCommitInput value={n} min={1} max={20} onCommit={setN} />',
    Demo: NumberCommitDemo,
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
    name: 'VisualCube',
    import: 'components/VisualCube.tsx',
    category: 'more',
    zh: 'NxN 魔方状态图(facelets → SVG),唯一入口。手写 <rect> 拼魔方 = bug。',
    en: 'NxN cube state image (facelets → SVG), single entry point. Hand-rolling a cube out of <rect> is a bug.',
  },
  {
    name: 'ScramblePreview2D',
    import: 'components/ScramblePreview2D.tsx',
    category: 'more',
    zh: '打乱的 2D 平面展开图(WCA net)。"打乱图"统一用它,不是 3D iso。',
    en: 'The 2D unfolded scramble net (WCA net). "Scramble image" means this, not a 3D iso view.',
  },
];
