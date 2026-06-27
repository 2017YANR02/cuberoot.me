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
import {
  Keyboard, Bot, MessageSquare, Gift, ShieldCheck, Shuffle, Trophy, Medal, User, Star,
  Globe, Flag as FlagIcon, CalendarDays, Search, BarChart3, Award, Table, Play, ScanSearch,
  FileText, FilePen, BookMarked, KeyRound, Link2, ListOrdered, LayoutGrid, ToggleLeft,
  ChevronsUpDown, Type, Tag, Component as ComponentIcon, PanelTop, Info, Sigma, Box, ListChecks,
  Palette, Disc, MousePointerClick, Image as ImageIcon, type LucideIcon,
} from 'lucide-react';
import { tr } from '@/i18n/tr';
import PillToggle from '@/components/PillToggle/PillToggle';
import { ClearButton } from '@/components/ClearButton';
import { SearchInput } from '@/components/SearchInput';
import { ListSelect } from '@/components/ListSelect';
import { VariantSelect } from '@/components/VariantSelect';
import { RangeSlider } from '@/components/RangeSlider/RangeSlider';
import StackedBar, { type StackedSeg } from '@/components/StackedBar/StackedBar';
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
import { AttemptsGrid } from '@/components/wca-results/AttemptsGrid';
import '@/components/wca-results/attempts-grid.css';
import Link from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { TeX } from '@/components/math/Tex';
import { UnofficialMark } from '@/components/UnofficialMark';
import CubeRootLogo from '@/components/CubeRootLogo';
import LiquidGlassChips from '@/components/LiquidGlassChips';
import ShowToggle from '@/components/wca-stats/ShowToggle';
import Paginator from '@/components/wca-stats/Paginator';
import { EventSelect } from '@/components/EventSelect/EventSelect';
import { RecordSelect } from '@/components/RecordSelect/RecordSelect';
import { CountryInput } from '@/components/CountryInput/CountryInput';
import { RegionPicker } from '@/components/RegionPicker/RegionPicker';
import { WheelPicker } from '@/components/WheelPicker/WheelPicker';
import MonthGrid from '@/components/MonthGrid';
import { SubsetColorPicker, useSubsetSelection } from '@/components/SubsetColorPicker/SubsetColorPicker';
import { useCallback } from 'react';

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

// 给每张卡一个可视化:demoable 的渲染实时 Demo,其余按名字 / 描述关键词推断一个
// 代表图标(下面 ICON_RULES,顺序从具体到一般),兜底按分类。新登记的条目无需手配,
// 关键词命中即得图标。
const ICON_RULES: [RegExp, LucideIcon][] = [
  [/desk-?pet|mascot|clawd/, Bot],
  [/feedback/, MessageSquare],
  [/donate/, Gift],
  [/scramble/, Shuffle],
  [/milestone/, Medal],
  [/chart|race|distribution|histogram/, BarChart3],
  [/\btable/, Table],
  [/registration|announced|competition|\bcomp\b/, Trophy],
  [/person|cuber|profile|\bhero/, User],
  [/follow|\bstar/, Star],
  [/region|continent/, Globe],
  [/flag|country/, FlagIcon],
  [/calendar|month|\bdate|\byear/, CalendarDays],
  [/search/, Search],
  [/record/, Award],
  [/recon/, ScanSearch],
  [/article/, FileText],
  [/player|playback|twisty/, Play],
  [/\beditor\b/, FilePen],
  [/algorithm|\balg\b|\bcase/, BookMarked],
  [/keyboard/, Keyboard],
  [/auth|login|account/, KeyRound],
  [/iframe|embed/, Link2],
  [/paginat/, ListOrdered],
  [/\btabs?\b/, LayoutGrid],
  [/tooltip/, Info],
  [/tex|latex|\bmath/, Sigma],
  [/\blogo/, ComponentIcon],
  [/modal|popover|overlay/, PanelTop],
  [/palette|color|subset/, Palette],
  [/wheel/, Disc],
  [/result|solve|attempt/, ListChecks],
  [/cube|puzzle/, Box],
  [/validation|\badmin/, ShieldCheck],
  [/toggle|switch|mode/, ToggleLeft],
  [/select|picker|dropdown/, ChevronsUpDown],
  [/input|field/, Type],
  [/badge|mark/, Tag],
];

const CATEGORY_ICON: Record<GalleryCategory, LucideIcon> = {
  toggle: ToggleLeft,
  button: MousePointerClick,
  input: Type,
  badge: Tag,
  display: ImageIcon,
  nav: Link2,
  more: ComponentIcon,
};

export function iconFor(e: ComponentEntry): LucideIcon {
  const hay = `${e.name} ${e.en}`.toLowerCase();
  for (const [re, Icon] of ICON_RULES) if (re.test(hay)) return Icon;
  return CATEGORY_ICON[e.category];
}

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
      <PillToggle value={b} onChange={setB} onLabel={tr({ zh: '平均', en: 'Average'
    })} offLabel={tr({ zh: '单次', en: 'Single'
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

function StackedBarDemo() {
  const data: [string, number, string][] = [
    ['A', 42, 'var(--accent)'],
    ['B', 28, 'color-mix(in srgb, var(--accent) 50%, var(--signal-success))'],
    ['C', 18, 'var(--signal-success)'],
    ['D', 12, 'color-mix(in srgb, var(--muted-foreground) 38%, transparent)'],
  ];
  const segs: StackedSeg[] = data.map(([k, w, color]) => ({
    key: k, weight: w, color, label: `${k} ${w}%`, title: `${k} · ${w}%`,
  }));
  return (
    <div style={{ width: 320, maxWidth: '100%' }}>
      <StackedBar segments={segs} minLabelFrac={0.08} ariaLabel="demo distribution" />
    </div>
  );
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

function AttemptsGridDemo() {
  // 同 AttemptsList,但只读静态版:跨行同列右对齐 + ao5 去尾括号占位,无点击 / 编辑。
  const rows: { attempts: number[]; eventId: string }[] = [
    { attempts: [5023, 4712, 6636, 5341, 4878], eventId: '333' },
    { attempts: [5412, 5382, 9740, 5067, 4423], eventId: '333' },
    { attempts: [15389, 11874, 8152, 11587, 8876], eventId: '333' },
  ];
  return (
    <div className="cg-attempts-demo">
      {rows.map((r, i) => (
        <AttemptsGrid key={i} attempts={r.attempts} eventId={r.eventId} />
      ))}
    </div>
  );
}

function MoreToggleDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="cg-row">
      <MoreToggle expanded={open} onToggle={() => setOpen((v) => !v)} />
      {open && <span className="cg-hint">{tr({ zh: '已展开的次要内容', en: 'expanded content' })}</span>}
    </div>
  );
}

function InfoTooltipDemo() {
  return (
    <div className="cg-row">
      <span className="cg-hint">{tr({ zh: '点 i 看说明', en: 'click the i' })}</span>
      <InfoTooltip content={tr({ zh: '第一行说明\n第二行说明', en: 'First line of help\nSecond line of help' })} />
    </div>
  );
}

function TeXDemo() {
  return (
    <div className="cg-row">
      <TeX src={'D_{\\mathrm{WCA}} \\le 27'} />
    </div>
  );
}

function UnofficialMarkDemo() {
  return (
    <div className="cg-row">
      <span className="cg-hint">Mo3 <UnofficialMark /></span>
    </div>
  );
}

function CubeRootLogoDemo() {
  return (
    <div className="cg-row">
      <CubeRootLogo height={32} />
    </div>
  );
}

function LiquidGlassChipsDemo() {
  const items = ['day', 'week', 'month'] as const;
  const [value, setValue] = useState<(typeof items)[number]>('week');
  const labels: Record<(typeof items)[number], { zh: string; en: string }> = {
    day: { zh: '日', en: 'Day' },
    week: { zh: '周', en: 'Week' },
    month: { zh: '月', en: 'Month' },
  };
  return (
    <div className="cg-row">
      <LiquidGlassChips
        items={items}
        value={value}
        onChange={setValue}
        getLabel={(it) => tr(labels[it])}
        ariaLabel={tr({ zh: '时间范围', en: 'Range' })}
      />
    </div>
  );
}

function ShowToggleDemo() {
  const isZh = useIsZh();
  const [value, setValue] = useState<'persons' | 'results'>('persons');
  return (
    <div className="cg-row">
      <ShowToggle value={value} onChange={setValue} isZh={isZh} />
    </div>
  );
}

function PaginatorDemo() {
  const isZh = useIsZh();
  const [page, setPage] = useState(3);
  const [size, setSize] = useState(25);
  return (
    <div className="cg-row">
      <Paginator
        page={page}
        totalPages={12}
        size={size}
        pageSizeOptions={[25, 50, 100]}
        isZh={isZh}
        onPageChange={setPage}
        onSizeChange={setSize}
      />
    </div>
  );
}

function EventSelectDemo() {
  const [value, setValue] = useState('333');
  return (
    <div className="cg-row">
      <EventSelect
        events={['333', '222', '444', '555', 'pyram', 'skewb']}
        value={value}
        onChange={setValue}
        allLabel={tr({ zh: '全部项目', en: 'All events' })}
      />
    </div>
  );
}

function RecordSelectDemo() {
  const [value, setValue] = useState('WR');
  return (
    <div className="cg-row">
      <RecordSelect
        value={value}
        onChange={setValue}
        placeholder={tr({ zh: '选纪录', en: 'Pick record' })}
      />
    </div>
  );
}

function CountryInputDemo() {
  const [value, setValue] = useState('cn');
  return (
    <div className="cg-row">
      <CountryInput
        value={value}
        onChange={setValue}
        placeholder={tr({ zh: '搜国家名', en: 'Search country' })}
      />
    </div>
  );
}

function RegionPickerDemo() {
  const isZh = useIsZh();
  const [value, setValue] = useState('world');
  return (
    <div className="cg-row">
      <RegionPicker
        isZh={isZh}
        value={value}
        onChange={setValue}
        restrictTo={['cn', 'us', 'jp', 'de', 'fr']}
        allLabel={tr({ zh: '全部区域', en: 'All regions' })}
      />
    </div>
  );
}

function WheelPickerDemo() {
  const [value, setValue] = useState(3);
  const renderSlot = useCallback((v: number) => (v >= 2 && v <= 7 ? String(v) : ''), []);
  return (
    <div className="cg-row">
      <WheelPicker
        value={value}
        minValue={2}
        maxValue={7}
        renderSlot={renderSlot}
        onChange={setValue}
        tick={false}
        ariaLabel={tr({ zh: '阶数', en: 'Size' })}
      />
    </div>
  );
}

function MonthGridDemo() {
  const weekdays = [
    tr({ zh: '一', en: 'Mo' }), tr({ zh: '二', en: 'Tu' }), tr({ zh: '三', en: 'We' }),
    tr({ zh: '四', en: 'Th' }), tr({ zh: '五', en: 'Fr' }), tr({ zh: '六', en: 'Sa' }),
    tr({ zh: '日', en: 'Su' }),
  ];
  return (
    <div className="cg-row" style={{ width: '100%', maxWidth: 320 }}>
      <MonthGrid
        year={2026}
        month={6}
        weekdays={weekdays}
        renderDay={(date, ctx) => (
          <span style={{ opacity: ctx.inView ? 1 : 0.35, fontWeight: ctx.isToday ? 700 : 400 }}>
            {date.getDate()}
          </span>
        )}
      />
    </div>
  );
}

function SubsetColorPickerDemo() {
  const isZh = useIsZh();
  const sel = useSubsetSelection('dual');
  return (
    <div className="cg-row">
      <SubsetColorPicker sel={sel} isZh={isZh} />
    </div>
  );
}

export const EXTRA_DEMOS: Partial<Record<string, () => ReactNode>> = {
  CubeRootLogo: CubeRootLogoDemo,
  LiquidGlassChips: LiquidGlassChipsDemo,
  ShowToggle: ShowToggleDemo,
  Paginator: PaginatorDemo,
  EventSelect: EventSelectDemo,
  RecordSelect: RecordSelectDemo,
  CountryInput: CountryInputDemo,
  RegionPicker: RegionPickerDemo,
  WheelPicker: WheelPickerDemo,
  MonthGrid: MonthGridDemo,
  SubsetColorPicker: SubsetColorPickerDemo,
};

export const CATALOG: ComponentEntry[] = [
  {
    name: 'PillToggle',
    import: "import PillToggle from '@/components/PillToggle/PillToggle';",
    category: 'toggle',
    zh: 'iOS 风格二选一开关(本项目主力用法,不是普通布尔开关):传 onLabel/offLabel = 两个互斥选项的标签(如 单次/平均、截至/当期),只显示并高亮当前选中那个。可点击,也能拖动滑钮横滑过中线切换;两个标签都不传 = 纯滑轨开关。新页面凡二选一切换优先用它,别另造 segmented 控件。',
    en: 'iOS-style two-choice toggle (the primary use in this project, NOT a plain boolean switch): pass onLabel/offLabel as the two mutually-exclusive option labels (e.g. Single/Average, Cumulative/Period) — only the selected one shows, highlighted. Click it, or drag the knob past the midline; omit both labels for a plain track switch. Prefer it for any two-option toggle on new pages instead of rolling a new segmented control.',
    usage: '<PillToggle value={type === "average"} onChange={v => setType(v ? "average" : "single")} onLabel="平均" offLabel="单次" />',
    Demo: PillToggleDemo,
    note: { zh: '默认就贴合文字、并自动按较长标签预留宽度(切换 on/off 不跳变),无需再 page-scope 覆盖 min-width。当过滤器跟 select 同行时给它跟 select 同高(看 /wca/results 的 .wse-filter pill,34px 上下居中)。锁:tests/pilltoggle-default-fit.test.ts。', en: 'Hugs the text by default and auto-reserves the longer label’s width (no jump on toggle) — no page-scope min-width override needed. When used as a filter alongside selects, match the select height (see /wca/results .wse-filter pill — 34px, vertically centered). Locked by tests/pilltoggle-default-fit.test.ts.' },
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
    name: 'CompCard',
    import: "import { CompCard } from '@/components/CompCard';",
    category: 'more',
    zh: '比赛卡片(旗 + 比赛名 + 日期/城市 + 报名状态 pill + 项目图标)。首页「报名」tab 与 /wca/comp 卡片视图共用同一份视觉。纯展示:报名 pill 由调用方按各自里程碑口径算好传入,卡片本身不碰时间逻辑。',
    en: 'Competition card (flag + name + date/city + registration-status pill + event icons). Shared by the landing "Registration" tab and the /wca/comp card view. Presentational only — the caller computes the reg pill (milestone semantics differ per page) and passes it in.',
  },
  {
    name: 'WcaPersonPicker',
    import: 'components/WcaPersonPicker.tsx',
    category: 'more',
    zh: '选手搜索选择器。默认本地索引最快,别传 searchFn(后端代理对中文 / 单字符返空)。',
    en: 'Cuber search / picker. The default local index is fastest — don’t pass searchFn (the backend proxy returns empty for Chinese / single chars).',
  },
  {
    name: 'NonWcaPuzzlePicker',
    import: "import NonWcaPuzzlePicker from '@/components/NonWcaPuzzlePicker/NonWcaPuzzlePicker';",
    category: 'more',
    zh: '非 WCA 魔方分组下拉(「更多魔方」),/scramble/solver 与 /scramble/stats 共用。按家族(长方体 / 异形扭转 / Square 系 / 滑块 / 联体 / 其他)分组,数据驱动:lib/cstimer-scramble 标 solvable 的 puzzle 自动出现。linkFor(求解页跨 COEP 硬导航)或 onSelect(分布页回调)二选一。',
    en: 'Grouped "More puzzles" dropdown for non-WCA puzzles, shared by /scramble/solver and /scramble/stats. Grouped by family (cuboids / twisty / square / sliding / siamese / other), data-driven: any puzzle flagged solvable in lib/cstimer-scramble shows up automatically. Pass linkFor (solver page, hard-nav across COEP) or onSelect (dist page callback).',
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
    name: 'StackedBar',
    import: "import StackedBar, { type StackedSeg } from '@/components/StackedBar/StackedBar';",
    category: 'display',
    zh: '单行堆叠比例条:每段 flexGrow ∝ weight,自定义底色 + 居中标签(段太窄自动隐藏,仅留 tooltip),可选 onClick/dim/selected。/scramble/gen 十字分布 + /wca 姓名分布国家占比共用。',
    en: 'Single-row stacked proportion bar: each segment flexGrow ∝ weight, custom color + centered label (hidden when too narrow, tooltip kept), optional onClick/dim/selected. Shared by /scramble/gen cross distribution and /wca name-distribution country breakdown.',
    usage: '<StackedBar segments={[{key,weight,color,label}]} minLabelFrac={0.08} />',
    Demo: StackedBarDemo,
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
  {
    name: 'AttemptsGrid',
    import: "import { AttemptsGrid } from '@/components/wca-results/AttemptsGrid';",
    category: 'display',
    zh: 'AttemptsList 的只读静态版 —— 同一份 wca-results/attempts-grid.css 网格(每把右对齐 + ao5 去尾括号占位 + 跨行同列小数点对齐),只传 attempts + eventId,无点击 / 编辑。不需要复盘跳转 / 行内编辑的地方(如 /wca/records 详细成绩列)用它,别再拼空格字符串。',
    en: 'Read-only static counterpart of AttemptsList — same wca-results/attempts-grid.css grid (right-aligned solves + ao5 bracket placeholders + cross-row decimal alignment), takes just attempts + eventId, no click / edit. Use it where recon links / inline edit are not needed (e.g. the /wca/records attempts column) instead of joining a space-separated string.',
    Demo: AttemptsGridDemo,
  },

  // ── 展开 / 切换 ─────────────────────────────────────────────────────────
  {
    name: 'MoreToggle',
    import: "import MoreToggle from '@/components/MoreToggle';",
    category: 'toggle',
    zh: `通用「更多 / 收起」展开开关(文字 + 旋转 chevron),折叠卡片次要内容统一用它,受控的 expanded / onToggle 由调用方管。`,
    en: `Generic More / Show-less expand toggle (label + rotating chevron) for collapsing secondary card content; controlled via expanded / onToggle.`,
    Demo: MoreToggleDemo,
    note: { zh: `折叠展开统一用它,别每处再写一份 *-more 按钮(首页近期打乱 / 今日复盘已共用)。`, en: `Use it for any collapse/expand affordance instead of hand-rolling a *-more button (shared by landing Recent Scrambles / Recon of the Day).` },
  },
  {
    name: 'AppearanceToggle',
    import: "import AppearanceToggle from '@/components/AppearanceToggle';",
    category: 'toggle',
    zh: `右上角统一的「外观」菜单,把明暗(浅 / 深)和中国色配色合并成一份互斥单选下拉,切换走 lib/theme 并持久化。`,
    en: `Unified top-bar Appearance menu merging light/dark and color palettes into one mutually-exclusive radio dropdown; persists via lib/theme.`,
    note: { zh: `全站外观入口,合并了旧的 ThemeToggle 和 PaletteToggle,新代码用它而非那两个。`, en: `Site-wide appearance entry; replaces the separate ThemeToggle + PaletteToggle — prefer this.` },
  },
  {
    name: 'LangToggle',
    import: "import LangToggle from '@/components/LangToggle';",
    category: 'toggle',
    zh: `中英双语一键互换按钮(英文裸 URL、中文 /zh),单击翻到另一语言并按 Pattern B 改写路径;soft 模式只换语言不导航。`,
    en: `One-click EN/ZH locale flip (English bare URL, Chinese /zh) with Pattern B path rewrite; soft mode swaps language in place without navigating.`,
  },
  {
    name: 'ThemeToggle',
    import: "import ThemeToggle from '@/components/ThemeToggle';",
    category: 'toggle',
    zh: `浅色 / 深色两态切换按钮,未选时跟随系统,点击在两个具体主题间翻转并退出配色。`,
    en: `Two-state Light/Dark toggle button; follows OS until clicked, then flips between the two concrete themes and clears any palette.`,
    note: { zh: `新代码优先用 AppearanceToggle(已合并明暗 + 配色);单用此件仅限只要明暗的场景。`, en: `Prefer AppearanceToggle (merges theme + palette) in new code; use this only for theme-only spots.` },
  },
  {
    name: 'PaletteToggle',
    import: "import PaletteToggle from '@/components/PaletteToggle';",
    category: 'toggle',
    zh: `中国传统色配色主题下拉选择器,第一项「经典」清掉配色回原赭陶明暗,其余切到各套中国色。`,
    en: `Dropdown picker for Chinese-color palette themes; the first 'Classic' item clears the palette back to default light/dark.`,
    note: { zh: `新代码优先用 AppearanceToggle;单用此件仅限只要配色的场景。`, en: `Prefer AppearanceToggle in new code; use this only for palette-only spots.` },
  },
  {
    name: 'LiquidGlassChips',
    import: "import LiquidGlassChips from '@/components/LiquidGlassChips';",
    category: 'toggle',
    zh: `iOS 分段控件风的胶囊切换器,active thumb 用 liquid-glass 渲染并跟手滑动,横滑过界即切,泛型单选。`,
    en: `iOS segmented-control-style chip switcher with a liquid-glass thumb that follows the finger and switches on drag-over; generic single-select.`,
    note: { zh: `Safari / iOS 自动退回 CSS frosted thumb;依赖 liquid-glass-react。`, en: `Falls back to a CSS frosted thumb on Safari/iOS; depends on liquid-glass-react.` },
  },
  {
    name: 'ShowToggle',
    import: "import ShowToggle from '@/components/wca-stats/ShowToggle';",
    category: 'toggle',
    zh: `「选手 / 成绩」两态切换按钮组(ShowMode = persons | results);WCA 排名页切换展示口径时用。`,
    en: `A two-state toggle button group for Persons / Results (ShowMode = persons | results); used to switch the display mode on WCA ranking pages.`,
    note: { zh: `受控,值与 onChange 由父级提供;样式靠 .wse-show-toggle。`, en: `Controlled; value and onChange come from the parent, styled via .wse-show-toggle.` },
  },
  {
    name: 'EditModeToggle',
    import: "import { EditModeToggle } from '@/components/persons/sections/results/EditModeToggle';",
    category: 'toggle',
    zh: `成绩表「全部成绩」标题旁的铅笔编辑模式开关,开则点成绩行内编辑 / 提议,关则点成绩去复盘;propose 时切到「提议模式」文案。`,
    en: `A pencil edit-mode toggle next to the All Results heading: on means click a solve to edit/propose, off means click to reconstruct; switches to propose-mode copy when propose is set.`,
  },
  {
    name: 'Scramble333ModePicker',
    import: "import Scramble333ModePicker from '@/components/Scramble333ModePicker';",
    category: 'toggle',
    zh: `3x3 打乱引擎切换(WCA cubing.js 与 min2phase-rust),仅当选中 3x3 时显示,选择持久化到 localStorage。`,
    en: `3x3 scramble-engine toggle (WCA cubing.js vs min2phase-rust), shown only when 3x3 is selected, with the choice persisted to localStorage.`,
  },
  {
    name: 'Scramble555ModePicker',
    import: "import Scramble555ModePicker from '@/components/Scramble555ModePicker';",
    category: 'toggle',
    zh: `5x5 打乱模式切换(随机状态与随机转动),仅当选中 5x5 时显示,带说明帮助链接,选择持久化到 localStorage。`,
    en: `5x5 scramble-mode toggle (random-state vs random-move), shown only when 5x5 is selected, with an about/help link, persisting the choice to localStorage.`,
  },
  {
    name: 'ScrambleModePickerRow',
    import: "import ScrambleModePickerRow from '@/components/ScrambleModePickerRow';",
    category: 'toggle',
    zh: `打乱引擎 / 模式切换的共享行布局,标签 + PillToggle + 可选帮助问号;被各项目专用 picker 包装复用。`,
    en: `Shared row layout for scramble engine/mode toggles, pairing a label with a PillToggle and optional help icon; wrapped by the per-event pickers.`,
    note: { zh: `底层复用 PillToggle,按需传 helpHref。`, en: `Built on PillToggle; pass helpHref to add a help link.` },
  },

  // ── 按钮 ────────────────────────────────────────────────────────────────
  {
    name: 'FollowStar',
    import: "import { FollowStar } from '@/components/CompFollow';",
    category: 'button',
    zh: `比赛关注「盯一下」星标按钮,三种形态(corner 卡片角标 / chip 行内小星 / inline 中号随文星),点击 onToggle 切换,未登录走 onRequireLogin。`,
    en: `Competition follow star button in three variants (corner overlay, inline chip, mid-size inline); clicking calls onToggle, and when logged out it routes to onRequireLogin.`,
    note: { zh: `比赛关注 UI 统一用此按钮 + 同文件 useCompFollows hook(server PG comp_follows 跨设备同步),别另写星标逻辑。`, en: `Use this button plus the same file's useCompFollows hook (server PG comp_follows, cross-device sync) for all comp-follow UI; don't reinvent star/follow logic.` },
  },

  // ── 输入与选择 ──────────────────────────────────────────────────────────
  {
    name: 'CountryInput',
    import: "import { CountryInput } from '@/components/CountryInput/CountryInput';",
    category: 'input',
    zh: `国家搜索 / 选择输入框,单选或多选(multi),带国旗、IME 安全、可限定范围、洲分组与计数,选中显示旗帜或 chip。`,
    en: `Country search/select input, single or multi-select, with flags, IME-safe typing, optional restrictTo, continent grouping and counts.`,
    note: { zh: `受控 value / onChange,multi 与 single 的 value 类型不同(string[] 对 string)。`, en: `Controlled value/onChange; value type differs between multi (string[]) and single (string).` },
  },
  {
    name: 'RegionPicker',
    import: "import { RegionPicker } from '@/components/RegionPicker/RegionPicker';",
    category: 'input',
    zh: `区域(全球 / 大洲 / 国家)选择器,单选或多选,带搜索框、洲图标和国旗;触发按钮显示当前选择。`,
    en: `Region picker (world / continent / country), single or multi-select, with search box, continent icons and flags; trigger shows current selection.`,
    note: { zh: `需传 isZh;restrictTo 给定可选国家列表,multi 与 single 的 value 类型不同。`, en: `Needs isZh; restrictTo supplies the selectable country list; value type differs between multi and single.` },
  },
  {
    name: 'EventSelect',
    import: "import { EventSelect } from '@/components/EventSelect/EventSelect';",
    category: 'input',
    zh: `WCA 项目下拉选择器,带项目图标和本地化名,可选「全部」项;从给定 events 列表里选单个项目。`,
    en: `WCA event dropdown selector with event icon and localized name, optional 'all' item; picks one event from a given events list.`,
    note: { zh: `/wca 子页选项目优先用 WcaEventSelector(21 图标行),此下拉用于空间紧凑或非 21 项场景。`, en: `For /wca subpages prefer WcaEventSelector (21-icon row); use this dropdown for compact or non-standard event lists.` },
  },
  {
    name: 'CountrySelect',
    import: "import CountrySelect from '@/components/wca-stats/CountrySelect';",
    category: 'input',
    zh: `国家下拉选择器,带搜索框、国旗、清除按钮和「全球」选项,点外面自动收起;WCA 统计页按国家筛选时用。`,
    en: `Country dropdown selector with a search box, flags, clear button and a 'Worldwide' option, auto-closing on outside click; used to filter WCA stats by country.`,
    note: { zh: `同文件还导出 useCountries() hook,从 historical-ranks/countries 端点拉国家列表。`, en: `The same file also exports the useCountries() hook, which fetches the country list from the historical-ranks/countries endpoint.` },
  },
  {
    name: 'RecordSelect',
    import: "import { RecordSelect } from '@/components/RecordSelect/RecordSelect';",
    category: 'input',
    zh: `WCA 纪录类型可编辑 combobox:格内键入过滤、静止显彩色 RecordBadge,提交值强制限定在选项列表内。`,
    en: `Editable combobox for WCA record types: type-to-filter, shows a colored RecordBadge at rest, commits only values from the option list.`,
  },
  {
    name: 'WheelPicker',
    import: "import { WheelPicker } from '@/components/WheelPicker/WheelPicker';",
    category: 'input',
    zh: `iOS 风格滚筒数字选择器,拖拽 / 惯性 / 滚轮选值,带 tick 音效震动、边界 clamp 与 onSettle 静止回调,业务无关。`,
    en: `iOS-style wheel/drum number picker with drag/inertia/scroll, tick sound + vibrate, boundary clamp and onSettle callback; business-agnostic.`,
    note: { zh: `renderSlot 要用 useCallback 稳定引用,否则每次 render 触发重填。`, en: `Wrap renderSlot in useCallback or every render refills the slots.` },
  },
  {
    name: 'SubsetColorPicker',
    import: "import { SubsetColorPicker } from '@/components/SubsetColorPicker/SubsetColorPicker';",
    category: 'input',
    zh: `打乱底色子集选择器:模式下拉(六 / 四 / 双 / 单色)+ 切扇形的方块色块;配套 useSubsetSelection hook 推导子集 key。`,
    en: `Scramble bottom-color subset picker: mode dropdown (six/quad/dual/single) plus pie-segment swatches; pairs with the useSubsetSelection hook that derives the subset key.`,
    note: { zh: `需配 useSubsetSelection 提供 sel 状态(两者同文件导出),选色逻辑别另写。`, en: `Requires useSubsetSelection (same file) for its sel state; don't reimplement the color logic.` },
  },
  {
    name: 'HighOrderNxNInput',
    import: "import HighOrderNxNInput from '@/components/HighOrderNxNInput';",
    category: 'input',
    zh: `高阶 NxN(8-300)数字输入框,合法值回调一次把 nxn<N> 加进事件列表,供打乱生成器两个模式共用。`,
    en: `High-order NxN (8-300) number input that fires onAdd(n) once a valid order is entered; shared by the scramble generator's two modes.`,
  },
  {
    name: 'AlgEditor',
    import: "import AlgEditor from '@/components/AlgEditor';",
    category: 'input',
    zh: `多条公式行编辑器,二维(朝向 x 条数)结构,每行 AlgInput + 共享虚拟键盘,支持增删行、聚焦行驱动外部预览,ref 的 getValue() 取回 AlgEntry[][]。`,
    en: `Multi-row algorithm editor over a 2D (orientation x lines) structure; each row is an AlgInput with a shared on-screen keyboard, supports add/remove rows, focused-row preview hooks, and ref getValue() returns AlgEntry[][].`,
    note: { zh: `forwardRef 暴露 AlgEditorHandle.getValue(),配合 AlgInput / CubeKeyboardSection,主要给 admin 公式编辑。`, en: `Exposes AlgEditorHandle.getValue() via forwardRef; pairs with AlgInput / CubeKeyboardSection, mainly for admin alg editing.` },
  },
  {
    name: 'AlgInput',
    import: "import AlgInput from '@/components/AlgInput';",
    category: 'input',
    zh: `单个公式输入框,markable=false 时是 textarea 纯文本、true 时是 contenteditable 支持手法标签,内置自动空格 / 标点规整,移动端屏蔽系统键盘改走站内键盘。`,
    en: `Single algorithm input: a plain textarea when markable=false, a contenteditable div with finger-trick marks when true; built-in auto-spacing/punctuation normalization, suppresses the system keyboard on mobile in favor of the in-site keyboard.`,
    note: { zh: `公式输入统一走它,别另写 textarea;forwardRef 暴露 AlgInputHandle(getText / getHtml / getCaretIndex 等)。`, en: `Single entry for alg input fields; don't roll your own textarea. Exposes AlgInputHandle (getText/getHtml/getCaretIndex...) via forwardRef.` },
  },
  {
    name: 'CubeVirtualKeyboard',
    import: "import CubeVirtualKeyboard from '@/components/CubeVirtualKeyboard';",
    category: 'input',
    zh: `魔方公式专用虚拟键盘:双页(符号 + QWERTY)、长按变体、滑动 / 双击手势、公式联想、可选记号弹层,通过 ref 写入外部编辑器。`,
    en: `Cube-notation virtual keyboard: two pages (symbols + QWERTY), long-press variants, swipe/double-tap gestures, alg suggestions, optional marks popup; writes to an external editor via ref.`,
    note: { zh: `必须传 target ref(textarea 或 contenteditable),否则键入无落点。`, en: `Requires a target ref (textarea/contenteditable) to receive input.` },
  },
  {
    name: 'CubeKeyboardSection',
    import: "import CubeKeyboardSection from '@/components/CubeKeyboardSection';",
    category: 'input',
    zh: `魔方虚拟键盘的包装层:桌面默认收起并给展开按钮,移动端强制打开,内部渲染 CubeVirtualKeyboard。`,
    en: `Wrapper for the cube virtual keyboard: collapsed with a toggle button on desktop, force-open on mobile; renders CubeVirtualKeyboard inside.`,
    note: { zh: `需传目标 textarea / contenteditable 的 ref 才能输入。`, en: `Needs a target textarea/contenteditable ref to type into.` },
  },
  {
    name: 'OnScreenKeyboard',
    import: "import OnScreenKeyboard from '@/components/OnScreenKeyboard';",
    category: 'input',
    zh: `PLL 识别训练的字母答题键盘(字母态 / 全称态两套),点击提交答案并给绿 / 红正误反馈。`,
    en: `PLL recognition answer keyboard (letter / full-name rows); tap submits an answer with green/red correctness feedback.`,
    note: { zh: `耦合 session-store(submitAnswer / gameState),非 playing 状态不渲染。`, en: `Coupled to session-store (submitAnswer/gameState); renders nothing unless playing.` },
  },
  {
    name: 'ReconAutofill',
    import: "import ReconAutofill from '@/components/ReconAutofill/ReconAutofill';",
    category: 'input',
    zh: `复盘解法 textarea 的 cubedb 式自动补全,Tab 弹出阶段注释 / 公式候选并基于打乱后魔方状态推断,挂在复盘提交表单上。`,
    en: `cubedb-style autofill for the recon solution textarea: Tab opens step-comment/alg suggestions derived from the cube state; attaches to the recon submit form.`,
    note: { zh: `需调用方传 textareaRef、value / setValue 与 scramble;依赖 alg 库与状态识别工具。`, en: `Caller must pass textareaRef, value/setValue and scramble; relies on the alg library and state-detection utils.` },
  },

  // ── 徽章与图标 ──────────────────────────────────────────────────────────
  {
    name: 'UnofficialMark',
    import: "import { UnofficialMark } from '@/components/UnofficialMark';",
    category: 'badge',
    zh: `跟在指标标签后的小上标「非官方」,带 tooltip,用于多盲平均(Mo3)等 WCA 不追踪的统计。`,
    en: `A small superscript 'unofficial' badge with tooltip, placed after a metric label for WCA-untracked stats like Multi-Blind average (Mo3).`,
    Demo: UnofficialMarkDemo,
  },

  // ── 展示与可视化 ────────────────────────────────────────────────────────
  {
    name: 'TeX',
    import: "import { TeX } from '@/components/math/Tex';",
    category: 'display',
    zh: `KaTeX 行内公式渲染,传 LaTeX 源字符串(src)即出;同文件还有块级 TeXBlock 和自动识别数学片段的 MathText。`,
    en: `Inline KaTeX renderer that takes a LaTeX source string (src); the file also exports block-level TeXBlock and the auto-detecting MathText.`,
    Demo: TeXDemo,
  },
  {
    name: 'InfoTooltip',
    import: "import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';",
    category: 'display',
    zh: `点击展开的小说明 popover:Info(或自定义)图标触发,content 按 \\n 逐行渲染,点外面 / Esc 关,兼桌面 + 移动。`,
    en: `Click-toggle info popover: Info (or custom) icon trigger, content rendered line-by-line on \\n, closes on outside-click/Esc; works on desktop and mobile.`,
    Demo: InfoTooltipDemo,
  },
  {
    name: 'PuzzleSVG',
    import: "import { PuzzleSVG } from '@/components/PuzzleSVG';",
    category: 'display',
    zh: `渲染 SQ1 / megaminx / pyraminx / skewb 的静态 2D 平面图或顶视图,可传 alg / case 打乱,用来展示某个状态。`,
    en: `Renders static 2D net / top-view SVGs for SQ1/megaminx/pyraminx/skewb from an alg or case; use to show a puzzle state.`,
    note: { zh: `依赖 sr-puzzlegen,运行时动态 import。`, en: `Lazy-imports sr-puzzlegen at runtime.` },
  },
  {
    name: 'CubingPreview',
    import: "import CubingPreview from '@/components/CubingPreview';",
    category: 'display',
    zh: `按事件 id 渲染打乱预览图,NxN / pyra / skewb / clock 走 cubing.js TwistyPlayer,SQ1 / megaminx 走自有 SVG,用在计时器 / 对战展示当前打乱。`,
    en: `Renders a scramble preview by event id (TwistyPlayer for NxN/pyra/skewb/clock, in-house SVG for SQ1/megaminx); use in timer/battle to show the current scramble.`,
    note: { zh: `未知事件渲染为空;cubing.js 按需懒加载。`, en: `Unknown events render nothing; cubing.js is lazy-loaded.` },
  },
  {
    name: 'CubeRootLogo',
    import: "import CubeRootLogo from '@/components/CubeRootLogo';",
    category: 'display',
    zh: `品牌 logo + 主页链接,随明暗主题切换深浅版本,用在 timer / battle 等顶栏。`,
    en: `Brand logo wrapped in a home link that swaps light/dark variants with the theme; use in top bars like timer/battle.`,
  },
  {
    name: 'NormalizedCrossBlock',
    import: "import NormalizedCrossBlock from '@/components/NormalizedCrossBlock';",
    category: 'display',
    zh: `复盘里检测到十字段含宽层转动时,展示一块标准化后的十字记号并带复制按钮;无宽层则不渲染。`,
    en: `In a recon, shows a normalized cross notation block with a copy button when the cross section contains wide moves; renders nothing otherwise.`,
  },
  {
    name: 'SolutionView',
    import: "import SolutionView from '@/components/SolutionView';",
    category: 'display',
    zh: `只读展示复盘解法文本,高亮阶段注释,点击或方向键移动虚拟光标并同步外部播放器进度,用在复盘详情 / 编辑页。`,
    en: `Read-only solution text view with highlighted step comments and a virtual caret that scrubs a linked player on click/arrow keys; use on recon detail/edit pages.`,
    note: { zh: `需调用方通过 playerRef 传入一个播放器实例。`, en: `Caller must pass a player instance via playerRef.` },
  },
  {
    name: 'TwistySection',
    import: "import TwistySection from '@/components/TwistySection';",
    category: 'display',
    zh: `cubing.js TwistyPlayer 封装,接 puzzle / scramble / alg 播放动画,支持点击转面、拖拽整体转、字母面提示,主力 3D 播放器。`,
    en: `cubing.js TwistyPlayer wrapper taking puzzle/scramble/alg with tap-to-twist, drag-to-rotate, and face-letter hints; the primary 3D player.`,
    note: { zh: `动态加载 cubing.js;依赖同目录 FaceOverlay 与 css。`, en: `Lazy-loads cubing.js; depends on sibling FaceOverlay + css.` },
  },
  {
    name: 'CuberReconPlayer',
    import: "import CuberReconPlayer from '@/components/CuberReconPlayer';",
    category: 'display',
    zh: `用 /sim 的 cuber WebGL 引擎做的只读 NxN 复盘播放器,常驻背视图 + 播放 / 步进 / 拖条,作为 TwistySection 的 NxN 替代。`,
    en: `Read-only NxN recon player on /sim's cuber WebGL engine with an always-on back view and play/step/scrub controls; an NxN alternative to TwistySection.`,
    note: { zh: `懒加载 three + /sim cuber World;可选 playerRef 暴露光标同步句柄。`, en: `Lazy-loads three + the /sim cuber World; optional playerRef exposes a caret-sync handle.` },
  },
  {
    name: 'Sq1ReconPlayer',
    import: "import Sq1ReconPlayer from '@/components/Sq1ReconPlayer';",
    category: 'display',
    zh: `用 cuber WebGL 引擎做的只读 Square-1 复盘播放器,带播放 / 步进 / 拖条和可选背视图,SQ1 专用(cubing.js 画 SQ1 不行)。`,
    en: `Read-only Square-1 recon player on the cuber WebGL engine with play/step/scrub and optional back view; for SQ1 (cubing.js renders SQ1 poorly).`,
    note: { zh: `懒加载 three + /sim cuber World;可选 playerRef 暴露光标同步句柄。`, en: `Lazy-loads three + the /sim cuber World; optional playerRef exposes a caret-sync handle.` },
  },
  {
    name: 'CaseThumb',
    import: "import { CaseThumb } from '@/components/CaseThumb';",
    category: 'display',
    zh: `任意 (puzzle, set, case) 的统一缩略图入口,按 puzzle 自动选渲染器(SQ1 走服务端 svg、金字塔 / 斜转 / 五魔走 PuzzleSVG、其余走 VisualCube)并按 set 选视图与遮罩。`,
    en: `Single entry for any (puzzle, set, case) thumbnail: auto-picks the renderer per puzzle (server SVG for SQ1, PuzzleSVG for pyraminx/skewb/megaminx, VisualCube otherwise) and chooses view/mask per set.`,
    note: { zh: `画公式案例缩略图统一用它,别手拼 VisualCube / PuzzleSVG 选择逻辑。`, en: `Use this for alg-case thumbnails; don't hand-wire the VisualCube/PuzzleSVG selection logic yourself.` },
  },
  {
    name: 'CompCell',
    import: "import { CompCell } from '@/components/CompCell/CompCell';",
    category: 'display',
    zh: `行内小单元:国旗 + 本地化比赛名,从 compId 推导国旗与中文名,适合在表格 / 列表里紧凑显示一场比赛(noFlag 可去旗)。`,
    en: `Inline cell showing a country flag plus localized competition name, deriving flag and Chinese name from compId; good for compactly showing one comp in tables/lists (noFlag drops the flag).`,
    note: { zh: `比赛名一律走 localizeCompName,别直接渲染原始 c.name。`, en: `Always localize via localizeCompName; don't render the raw c.name.` },
  },
  {
    name: 'MonthGrid',
    import: "import MonthGrid from '@/components/MonthGrid';",
    category: 'display',
    zh: `通用月历网格:给定年 / 月生成周行(可设周一 / 周日起始,前后跨月补满整周),通过 renderDay 等 render-prop 自定义每格内容,calendar / globe 等日历视图复用。`,
    en: `Generic month-grid calendar: builds week rows for a given year/month (Mon/Sun start, padding cross-month days to full weeks) and customizes each cell via renderDay render-props; reused by calendar/globe views.`,
    note: { zh: `纯展示骨架,需要日历布局时复用它(同文件还导出 getMonthWeeks 纯函数),别另写排周逻辑。`, en: `Pure layout skeleton; reuse it (and the exported getMonthWeeks helper) for calendar layouts instead of rewriting week-laying logic.` },
  },
  {
    name: 'ChangedResultValue',
    import: "import { ChangedResultValue } from '@/components/persons/sections/results/ChangedResultValue';",
    category: 'display',
    zh: `把一个被变更的旧成绩值渲染成划线 <s>(带提示),用在成绩表当前值之前;同文件 ResultChangeChain 依次划掉整条变更链的历次旧值。`,
    en: `Renders a single changed old result value as a struck-through <s> (with tooltip) before the current value in result tables; the sibling ResultChangeChain strikes through a whole chain of historical old values.`,
  },
  {
    name: 'SolveValue',
    import: "import { SolveValue } from '@/components/persons/sections/results/SolveValue';",
    category: 'display',
    zh: `渲染单次成绩值,有罚时则拆成 base + 上标小角标(如 1.00⁺²),否则原样输出;format 由调用方传入。`,
    en: `Renders a single solve value, splitting into base plus a superscript penalty badge (e.g. 1.00 plus 2) when a penalty is present, otherwise verbatim; the format function is passed by the caller.`,
  },
  {
    name: 'FeedbackConversation',
    import: "import FeedbackConversation from '@/components/FeedbackConversation';",
    category: 'display',
    zh: `反馈对话面板,按 GitHub issue 式来回渲染往来气泡并提供回复框,挂载即拉线程并标记已读;用在 /feedback 与 /feedback/admin。`,
    en: `Feedback conversation panel rendering a GitHub-issue-style back-and-forth thread with a reply box, fetching the thread and marking it read on mount; used on /feedback and /feedback/admin.`,
    note: { zh: `需传 feedbackId,可选 onActivity 回调。`, en: `Takes feedbackId, with an optional onActivity callback.` },
  },

  // ── 导航与链接 ──────────────────────────────────────────────────────────
  {
    name: 'WcaAuth',
    import: "import WcaAuth from '@/components/WcaAuth';",
    category: 'nav',
    zh: `全站 WCA 登录 / 账号控件:未登录显示钥匙图标登录按钮,已登录显示头像链到个人主页。`,
    en: `Global WCA login/account control: key-icon login button when logged out, avatar linking to the user hub when logged in.`,
    note: { zh: `依赖 auth-store(登录态)+ WCA OAuth,需页面 / 全局上下文。`, en: `Depends on auth-store + WCA OAuth, needs app context.` },
  },
  {
    name: 'IframePage',
    import: "import IframePage from '@/components/IframePage';",
    category: 'nav',
    zh: `通用 iframe 包装页,带标题栏全屏嵌入未迁移的上游模块(Solver / Alg Trainer / csTimer),并把内部 / 链接劫持到顶层路由。`,
    en: `Generic full-screen iframe wrapper page with a title bar for embedding un-ported upstream modules (Solver / Alg Trainer / csTimer), retargeting internal '/' links to the top frame.`,
  },
  {
    name: 'Paginator',
    import: "import Paginator from '@/components/wca-stats/Paginator';",
    category: 'nav',
    zh: `通用分页控件:上一页 / 下一页箭头、可输入跳转的页码框(带钳制)和每页条数下拉;长列表分页时用。`,
    en: `Generic pagination control with prev/next arrows, a typeable clamped page-number input, and a page-size dropdown; used to page through long lists.`,
    note: { zh: `受控组件,page / size 由父级持有,通过 onPageChange / onSizeChange 回报。`, en: `Controlled component; the parent owns page/size and receives onPageChange/onSizeChange callbacks.` },
  },

  // ── 更多:数据驱动 / 需上下文 ───────────────────────────────────────────
  {
    name: 'AlgCategoryView',
    import: "import AlgCategoryView from '@/components/AlgCategoryView';",
    category: 'more',
    zh: `公式库分类页主体,按 (puzzle, set, subgroup) 加载公式渲染分组案例卡片网格、朝向切换、点击展开 3D 动画、社区另解,管理员另有新增 / 编辑 / 校验 / 拖拽排序。`,
    en: `Algorithm-set category page body: loads alg data for a (puzzle, set, subgroup), renders grouped case cards with orientation tabs, click-to-expand 3D playback, community algs, plus admin add/edit/validate/drag-reorder.`,
    note: { zh: `页面级组件,需要后端公式数据和路由参数,无法独立渲染。`, en: `Page-level component; needs backend alg data and route params, not standalone.` },
  },
  {
    name: 'CommunityAlgs',
    import: "import CommunityAlgs from '@/components/CommunityAlgs';",
    category: 'more',
    zh: `单个案例下的社区投稿公式列表,登录用户可添加(保存前 cubing.js 校验),作者和管理员可编辑 / 删除,管理员还能改 caseName 把公式转到别的案例。`,
    en: `Community-submitted algs for one case: logged-in users can add (cubing.js-validated on save), authors and admins edit/delete, and admins can re-target the caseName to move an alg to another case.`,
    note: { zh: `需登录态、submissions 数据和 onPatch 回写,由 AlgCategoryView 按 case 切分喂入,无法独立渲染。`, en: `Needs auth login, submissions data and an onPatch writer; fed per-case by AlgCategoryView, not standalone.` },
  },
  {
    name: 'AlgPlayer',
    import: "import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';",
    category: 'more',
    zh: `内联 3D 魔方动画预览,懒加载 cubing.js TwistyPlayer 播放给定 (alg, puzzle, set, setup),支持固定尺寸或 fillPane 撑满父容器,SQ1 自动规整记号。`,
    en: `Inline animated 3D cube preview: lazy-loads the cubing.js TwistyPlayer to play a given (alg, puzzle, set, setup), supports fixed size or fillPane, with SQ1 notation auto-normalized.`,
    note: { zh: `客户端运行,懒加载 cubing.js(~150KB);forwardRef 暴露 getPlayer() 拿底层实例做光标 sync。`, en: `Client-only, lazy-loads cubing.js (~150KB); exposes getPlayer() via forwardRef for caret-sync.` },
  },
  {
    name: 'ArticleActions',
    import: "import ArticleActions from '@/components/article/ArticleActions';",
    category: 'more',
    zh: `文章阅读页底栏交互岛,owner / admin 显示编辑 + 删除,登录非作者显示举报内联面板,未登录渲染 null;mounted 门控避免 auth 水合不一致。`,
    en: `Article reader footer interaction island: owner/admin see edit+delete, logged-in non-authors get an inline report panel, logged-out renders null; mounted-gated to avoid auth hydration mismatch.`,
    note: { zh: `依赖 auth store、文章写接口、路由参数,必须客户端跑。`, en: `Depends on auth store, article write APIs and route params; client-only.` },
  },
  {
    name: 'ArticleAlgEmbed',
    import: "import ArticleAlgEmbed from '@/components/article/ArticleAlgEmbed';",
    category: 'more',
    zh: `文章正文里的内联公式动画嵌入,对不可信作者输入做保守记号白名单校验,通过后懒加载 TwistySection 播放,校验失败渲染 null。`,
    en: `Inline alg-animation embed for article bodies: validates untrusted author input against a conservative cube-notation whitelist, then lazy-loads TwistySection; renders null if validation fails.`,
    note: { zh: `供文章 markdown 的 :alg[] directive 用;不要把未校验字符串传进 player。`, en: `Used by the article markdown :alg[] directive; never pass an unvalidated string into the player.` },
  },
  {
    name: 'ArticleBody',
    import: "import { ArticleBody } from '@/components/article/ArticleBody';",
    category: 'more',
    zh: `文章正文服务端渲染包装,调用安全 markdown 管道把不可信社区 markdown 和 directive 渲染成 DOM,交互叶子(动画 / 魔方图)是内部 client dynamic import。`,
    en: `Server-renderable article body wrapper: runs the secure markdown pipeline to render untrusted community markdown + directives, with interactive leaves (player/cube image) as internal client dynamic imports.`,
    note: { zh: `可在 RSC 中安全使用;渲染走 renderArticleMarkdown 这个唯一 sanitizer。`, en: `Safe in an RSC; rendering goes through renderArticleMarkdown, the single sanitizer of record.` },
  },
  {
    name: 'ArticleCubeEmbed',
    import: "import ArticleCubeEmbed from '@/components/article/ArticleCubeEmbed';",
    category: 'more',
    zh: `文章正文里的静态魔方状态图嵌入,对作者传的 alg / setup / view / mask / size 做白名单校验和尺寸 clamp(32-512),非法记号退化成已解魔方。`,
    en: `Static cube-state image embed for article bodies: whitelist-validates author-supplied alg/setup/view/mask/size and clamps size (32-512), degrading bad notation to the solved cube.`,
    note: { zh: `供文章 markdown 的 :cube[] directive 用,底层是 VisualCube。`, en: `Used by the article markdown :cube[] directive; backed by VisualCube.` },
  },
  {
    name: 'ArticleEditor',
    import: "import ArticleEditor from '@/components/article/ArticleEditor';",
    category: 'more',
    zh: `浏览器内文章 markdown 编辑器,左 CodeMirror 源码右实时预览(复用同一 sanitizer),工具栏插入标红 / 标蓝 / 图网格 / 公式动画 / 魔方图 directive,图片走 base64 上传,支持存草稿 / 发布。`,
    en: `In-browser article markdown editor: CodeMirror source (left) + live preview (right) reusing the same sanitizer, toolbar inserts red/blue/figrow/alg/cube directives, images upload via base64, with save-draft/publish.`,
    note: { zh: `create / edit 两模式,调用 createArticle / updateArticle / uploadArticleImage 写接口,客户端专用。`, en: `create/edit modes; calls createArticle/updateArticle/uploadArticleImage write APIs, client-only.` },
  },
  {
    name: 'DiscussionComposer',
    import: "import { DiscussionComposer } from '@/components/Discussion';",
    category: 'more',
    zh: `评论 / 另解共用的 UI 原子集,导出 YouTube 风格提交框 DiscussionComposer、编辑框 DiscussionEditBox、作者元信息条 UserHeadline、三点菜单 ItemMenu、头像 fallback UserAvatarFallback。`,
    en: `Shared comment/alt-solution UI atoms: exports the YouTube-style composer DiscussionComposer, edit box DiscussionEditBox, author meta line UserHeadline, kebab menu ItemMenu, and avatar fallback UserAvatarFallback.`,
    note: { zh: `多组件原子集(无默认导出),按需具名引入;Composer / UserHeadline 依赖 auth store。`, en: `A multi-component atom set (no default export); import members by name. Composer/UserHeadline depend on the auth store.` },
  },
  {
    name: 'AnnouncedCard',
    import: "import { AnnouncedCard } from '@/components/AnnouncedComps';",
    category: 'more',
    zh: `渲染单场「公示」WCA 比赛卡片(国旗 / 名字 / 日期 / 城市 / 人数 / 报名状态 / 项目图标 / 轮次),配套 useAnnouncedComps hook 拉近 48 小时公示数据,用于首页比赛区的公示标签。`,
    en: `Renders one announced-competition card (flag, name, date, city, limit, registration status, event icons with round counts); pairs with the useAnnouncedComps hook fetching last-48h announced comps.`,
    note: { zh: `依赖后端 /v1/comp/announced 与 WCIF 懒拉,需真实 comp 数据,不能独立展示。`, en: `Depends on the /v1/comp/announced backend plus lazy WCIF fetch; needs real comp data.` },
  },
  {
    name: 'OngoingComps',
    import: "import OngoingComps from '@/components/OngoingComps';",
    category: 'more',
    zh: `首页比赛聚合面板:标签切换 当前 / 公示 / 报名 / 未来 / 往期 / 纪录 六类视图(进行中按国家分组,未来往期按日期分组),空类自动隐藏,登录用户每个比赛带关注星。`,
    en: `Landing-page competition hub with tabs for now/announced/register/upcoming/past/records (ongoing grouped by country, upcoming/past by date); empty tabs auto-hide and logged-in users get a follow star.`,
    note: { zh: `首页专用聚合器,内部拉 loadComps + 多个子 hook,需要真实数据。`, en: `Landing-only aggregator that loads comps plus several sub-hooks; needs live data.` },
  },
  {
    name: 'RegistrationView',
    import: "import { RegistrationView } from '@/components/RegistrationComps';",
    category: 'more',
    zh: `首页「报名」标签内容:把全球 upcoming 比赛按下一个报名里程碑(开放 / 截止)的本地日分组(今天 / 明天 / 后天 / 本周内 / 更晚),登录用户的关注比赛置顶,卡片显示报名状态彩色 pill。`,
    en: `Content of the landing Register tab: groups worldwide upcoming comps by their next registration milestone (open/close) into today/tomorrow/in-2-days/this-week/later, pins followed comps on top, with status pills.`,
    note: { zh: `需传入完整 comps 列表 + 关注状态(loggedIn / follows / toggle),由 OngoingComps 父级喂数据。`, en: `Requires the full comps list plus follow state (loggedIn/follows/toggle) fed by the OngoingComps parent.` },
  },
  {
    name: 'FollowedComps',
    import: "import FollowedComps from '@/components/FollowedComps';",
    category: 'more',
    zh: `选手主页上展示当前登录用户星标关注的比赛(分即将 / 进行中 / 已结束 / 其他),仅在用户看自己主页时出现,数据由关注集合 join loadComps + 实时 announced 得到。`,
    en: `On a person's profile, lists the comps the logged-in user has starred (grouped into upcoming/ongoing, finished, and other); only appears when viewing one's own profile.`,
    note: { zh: `需登录且页面 wcaId 等于自己 wcaId 才渲染,否则返回 null。`, en: `Only renders when logged in and the page wcaId matches the user's own; otherwise returns null.` },
  },
  {
    name: 'CompCuberPicker',
    import: "import { CompCuberPicker } from '@/components/CompCuberPicker';",
    category: 'more',
    zh: `/wca/comp 的统一搜索框:一个输入框里两段下拉,既能按比赛名实时过滤并选比赛(或粘贴 WCA / cubing.com 链接直达),又能选一名选手把日历过滤到他的比赛。`,
    en: `Unified search box for /wca/comp: one input with a two-section dropdown that both live-filters/picks competitions (or pastes a WCA/cubing.com URL) and picks a cuber to filter the calendar.`,
    note: { zh: `受控组件,需父级提供 query / onPickComp / cuber / onCuberChange 等回调,依赖 comp-search 与 persons-index 数据层。`, en: `Controlled component needing many parent callbacks and the comp-search + persons-index data layers.` },
  },
  {
    name: 'RecentRecordsList',
    import: "import { RecentRecordsList } from '@/components/RecentRecords';",
    category: 'more',
    zh: `近 10 天 WR / CR / NR 纪录列表(无头无滚动条,嵌在 OngoingComps 共享面板里),每行渲染服务端预格式化的纪录文案(国旗 / 纪录徽章 / 洲图标)并可一键复制,配套 useRecentRecords hook。`,
    en: `Headless last-10-days WR/CR/NR record list (embedded in the OngoingComps shared panel), each row rendering server-preformatted record text (flags, record badges, continent icons) with one-click copy.`,
    note: { zh: `靠 useRecentRecords 拉 /v1/wca/recent-records(60s 轮询),需真实数据。`, en: `Driven by useRecentRecords fetching /v1/wca/recent-records (60s poll); needs live data.` },
  },
  {
    name: 'LandingSearch',
    import: "import LandingSearch from '@/components/LandingSearch';",
    category: 'more',
    zh: `首页全站搜索框:一个下拉聚合 11 类结果(页面 / 工具 / 查询 / 统计 / 选手 / 比赛 / 复盘 / 术语 / 算法说明 / 技术栈 / 公式库),支持智能粘贴 WCA 链接 / 打乱、语音输入、回车跳首个结果、轮换占位提示。`,
    en: `Landing site-wide search box: one dropdown aggregating 11 result categories with smart-paste of WCA URLs/scrambles, voice input, Enter-to-first-result, and rotating placeholders.`,
    note: { zh: `需传 cards 数组,搜索逻辑全在 lib/site-search.ts 的 useSiteSearch,本组件只是下拉 UI 外壳。`, en: `Requires a cards array; all search logic lives in lib/site-search.ts (useSiteSearch) and this is just the dropdown shell.` },
  },
  {
    name: 'YearMonthPickerPopover',
    import: "import { YearMonthPickerPopover } from '@/components/YearMonthPickerPopover';",
    category: 'more',
    zh: `年 / 月双滚筒选择浮层:按 yearMonthsMap 跳过没有数据的空年 / 空月,锚定到按钮下方,关闭浮层时一次性 onCommit 提交所选年月,calendar / globe 复用。`,
    en: `Year/month dual wheel-picker popover: skips empty years/months via yearMonthsMap, positions anchored below a button, and commits the chosen year/month once on close via onCommit; reused by calendar/globe.`,
    note: { zh: `需传 anchor 矩形 + yearMonthsMap + onCommit,内部用 WheelPicker,是页面绑定浮层。`, en: `Needs an anchor rect, yearMonthsMap, and onCommit, and uses WheelPicker internally; a page-bound popover.` },
  },
  {
    name: 'RecentScrambles',
    import: "import RecentScrambles from '@/components/RecentScrambles';",
    category: 'more',
    zh: `首页「近期打乱」面板:顶部项目选择器,333 提供 变体 / 类型 / 底色 / 步数 富控件并显示该难度出现概率,其余项目按打乱长度(222 / 金字塔 / 斜转另有整解难度模式),每条带 2D 展开图与比赛来源。`,
    en: `Landing Recent Scrambles panel: an event picker where 333 offers a rich variant/type/bottom-color/move widget with difficulty probability, while other events bucket by scramble length (222/pyraminx/skewb also have a whole-solve difficulty mode).`,
    note: { zh: `靠 stats/scramble/*.json 数据,无可展示项目时返回 null。`, en: `Driven by stats/scramble/*.json; returns null when no event has data.` },
  },
  {
    name: 'TodayRecon',
    import: "import TodayRecon from '@/components/TodayRecon';",
    category: 'more',
    zh: `首页「今日复盘」面板:展示 /recon 最新录入那天的复盘,默认一条静态预览卡(2D 打乱图 + 成绩 / 选手 / 比赛 / 方法摘要),多条时可展开,点卡进 /recon/[id] 回放。`,
    en: `Landing Recon of the Day panel: shows recons from the latest day entered in /recon, defaulting to one static preview card, expandable when there are several, each linking into /recon/[id].`,
    note: { zh: `靠 getTodayRecons 拉后端,无数据返回 null。`, en: `Driven by getTodayRecons from the backend; returns null when empty.` },
  },
  {
    name: 'BarRaceChart',
    import: "import BarRaceChart from '@/components/wca-stats/BarRaceChart';",
    category: 'more',
    zh: `共享的横条竞速图渲染件,画 X 轴刻度 / 网格 / 0 锚定的横条(条长 = 值 / 轴上限),由上层算好 rows 和坐标轴喂进来;wr_metric Top10 和 SOR 演化共用。`,
    en: `Shared bar-chart-race renderer drawing X-axis ticks, grid and 0-anchored bars (length = value / axisMax); the caller supplies pre-sorted rows and the axis. Used by the Top10 wr_metric and SOR races.`,
    note: { zh: `纯展示件,不取数不播放;需配套 top10_history.css。`, en: `Pure display only, no fetching or playback; depends on top10_history.css.` },
  },
  {
    name: 'BestComboBody',
    import: "import { BestComboBody } from '@/components/wca-stats/BestComboBody';",
    category: 'more',
    zh: `渲染某选手名次和(SOR)的「最优项目组合」内容体:名次行 + 支柱 / 自由项 / 毒药剖析 + 组合列表 + 懒分页展开,排名页与选手页共用。`,
    en: `Renders one cuber's Sum-of-Ranks best event combos: rank line, pillar/flexible/poison anatomy, combo list, and lazy paginated expansion; shared by the rankings page and the person page.`,
    note: { zh: `只渲染内容,不含外框和头像;自带 player-combos 端点的加载更多状态。`, en: `Content only (no outer frame or avatar); has its own load-more state hitting the player-combos endpoint.` },
  },
  {
    name: 'DistributionChart',
    import: "import DistributionChart from '@/components/wca-stats/DistributionChart';",
    category: 'more',
    zh: `成绩时间分布的 SVG 图,直方图 / KDE / 箱线图三模式切换,支持最多 10 名选手对比并标均值线、图例和均值 / 标准差;比较选手成绩离散度时用。`,
    en: `SVG distribution chart of result times with histogram/KDE/box-plot modes, comparing up to 10 cubers with mean lines, legend and mean/sigma; used to compare spread of results.`,
    note: { zh: `每个数据集需至少 5 个点才渲染,times 为秒数数组。`, en: `Each dataset needs at least 5 points to render; times are arrays of seconds.` },
  },
  {
    name: 'NameStatsView',
    import: "import NameStatsView from '@/components/wca-stats/NameStatsView';",
    category: 'more',
    zh: `选手姓名统计的专属可视化:词数 / 字符长度双 tab + 姓名口径四态切换,每行显示键值、平方根占比条、国旗占比 chips 和带国旗的选手名(多人折叠)。`,
    en: `Bespoke visualization for cuber name stats: word-count/char-length tabs plus a four-way name-form switch, each row showing the key, a sqrt-scaled share bar, per-country flag chips and flagged cuber names.`,
    note: { zh: `tab 与口径走 nuqs URL 状态(queryKey 可定制);依赖 nameMode.tsx 的口径辅助件。`, en: `Tabs and name-form go into nuqs URL state (customizable queryKey); depends on the name-form helpers in nameMode.tsx.` },
  },
  {
    name: 'SorRace',
    import: "import SorRace from '@/components/wca-stats/SorRace';",
    category: 'more',
    zh: `名次和(SOR)排名逐年演化的 bar chart race 整页体:RegionPicker 选世界 / 大洲 / 国家 + 单次 / 平均切换 + 播放 / 拖拽 / 速度控制,复用 BarRaceChart。`,
    en: `Full bar-chart-race body for year-by-year Sum-of-Ranks rankings: RegionPicker scope (world/continent/country), single/average toggle, and play/scrub/speed controls, reusing BarRaceChart.`,
    note: { zh: `自取数,数据源 stats/sor_over_time.json + per-scope 分片懒加载。`, en: `Self-fetching from stats/sor_over_time.json plus lazily loaded per-scope shards.` },
  },
  {
    name: 'Top10HistoryPage',
    import: "import Top10HistoryPage from '@/components/wca-stats/Top10HistoryPage';",
    category: 'more',
    zh: `全历史 TOP 10 演化的 bar chart race 整页体:项目 / 单次平均选择、按天或按 PB 两种播放模式、时间轴拖拽、速度切换和 mp4 导出,复用 BarRaceChart。`,
    en: `Full bar-chart-race body for all-time top-10 evolution: event/metric selection, time-based or PB-based playback, timeline scrubbing, speed control and mp4 export, reusing BarRaceChart.`,
    note: { zh: `自取数(top10_history.json + per-event 分片);可受控嵌入(controlledEventId / Metric)。`, en: `Self-fetching (top10_history.json + per-event shards); can be embedded in controlled mode via controlledEventId/Metric.` },
  },
  {
    name: 'WrHistoryChart',
    import: "import WrHistoryChart from '@/components/wca-stats/WrHistoryChart';",
    category: 'more',
    zh: `世界纪录历史折线图(Canvas),从 stats 表的 rows + header 自动提列(成绩 / 日期 / 选手 / 提升)、强制单调并带悬停 tooltip;展示某纪录随时间下降时用。`,
    en: `World-record history line chart (Canvas) that auto-extracts result/date/person/improvement columns from stats rows + header, enforces monotonicity, and shows a hover tooltip.`,
    note: { zh: `点少于 2 个返回 null;触摸支持点按看 tooltip。`, en: `Returns null with fewer than 2 points; supports touch tap for the tooltip.` },
  },
  {
    name: 'nameMode / FormerNames',
    import: "import { NameMode, NAME_MODES, nameByMode, nameModeOptions, localPart, FormerNames } from '@/components/wca-stats/nameMode';",
    category: 'more',
    zh: `姓名口径(英文名 / 全名 / 本地名 / 含曾用名)工具集:类型 NameMode、取现名 nameByMode、切换选项 nameModeOptions、提取括号本地名 localPart,加一个渲染曾用名标签的小组件 FormerNames;姓名分布和排名名录共用。`,
    en: `Name-form toolkit (Latin/full/local/with-former-names): the NameMode type, nameByMode to pick the display name, nameModeOptions for the switcher, localPart to extract the parenthesized local name, plus the small FormerNames component; shared by name distribution and ranking rosters.`,
    note: { zh: `主要是工具 / 类型 + 一个组件 FormerNames,没有默认导出。`, en: `Mostly utils/types plus the one FormerNames component; no default export.` },
  },
  {
    name: 'StageSolver',
    import: "import StageSolver from '@/components/StageSolver';",
    category: 'more',
    zh: `逐阶段最优解浏览器,6 视角对比步数 + 可执行多解列表 + 共享 3D 播放,覆盖 cross / EO / DR / HTR 等方法,用在 analyzer 与 gen 行内。`,
    en: `Per-stage optimal-solve explorer: 6-view move counts + executable solution list + shared 3D player across cross/EO/DR/HTR methods; used in analyzer and gen.`,
    note: { zh: `需站内共享 Rust / WASM 求解器池,首次拉数 MB 级表。`, en: `Requires the shared Rust/WASM solver pool and downloads MB-scale tables on first use.` },
  },
  {
    name: 'PllPerformerOverlay',
    import: "import PllPerformerOverlay from '@/components/PllPerformerOverlay';",
    category: 'more',
    zh: `全屏弹层让桌宠 clawd 端着真 3D 魔方演示 21 个 PLL,可选 case、播放 / 速度,由 clawd:perform 事件驱动。`,
    en: `Full-screen overlay where the clawd mascot presents a real 3D cube running any of the 21 PLLs, with case picker and play/speed; driven by the clawd:perform event.`,
    note: { zh: `懒加载 three + /sim cuber 引擎,并从 alg 库 loadAlg 取 PLL 数据。`, en: `Lazy-loads three + the /sim cuber engine and pulls PLL data via loadAlg from the alg library.` },
  },
  {
    name: 'DeskPet',
    import: "import DeskPet from '@/components/DeskPet';",
    category: 'more',
    zh: `全站桌宠组件,渲染会跟随光标的螃蟹 / 猫 / 云宝形象,点击打开搜索浮层、可拖动贴边、显示反馈未读角标,挂在 root layout。`,
    en: `Site-wide desk-pet widget rendering a cursor-tracking crab/cat/cloud character; click to open the search overlay, draggable with edge-cling, shows the unread-feedback badge, mounted in the root layout.`,
    note: { zh: `通过 window.dispatchEvent('clawd:state') 或 window.clawdPet 驱动姿势;唯一的桌宠入口。`, en: `Drive poses via window.dispatchEvent('clawd:state') or window.clawdPet; the single desk-pet entry point.` },
  },
  {
    name: 'DeskPetGallery',
    import: "import DeskPetGallery from '@/components/DeskPetGallery';",
    category: 'more',
    zh: `桌宠动画图鉴浮层,按形象网格展示每个角色的全部动画帧,并提供 PLL 表演启动按钮;从桌宠搜索工具栏打开,admin 专用。`,
    en: `Desk-pet animation gallery overlay showing every character's animation frames in a grid plus a PLL-show launcher; opened from the desk-pet search toolbar, admin-only.`,
    note: { zh: `需传 lang 与 onClose。`, en: `Takes lang and onClose props.` },
  },
  {
    name: 'DeskPetSearch',
    import: "import DeskPetSearch from '@/components/DeskPetSearch';",
    category: 'more',
    zh: `桌宠搜索浮层,居中复用首页站内搜索框,下方横排工具栏放形象 / 大小 / 语言 / 主题 / 赞助 / 反馈 / 休息 / 隐藏等控制;由桌宠懒加载。`,
    en: `Desk-pet search overlay reusing the homepage site search in a centered modal, with a toolbar row of character/size/lang/theme/donate/feedback/rest/hide controls; lazy-loaded by DeskPet.`,
    note: { zh: `受控浮层,靠一组回调驱动桌宠状态;处理移动端键盘视口贴合。`, en: `Controlled overlay driven by callbacks into the pet; handles mobile keyboard viewport fitting.` },
  },
  {
    name: 'DonateModal',
    import: "import DonateModal from '@/components/DonateModal';",
    category: 'more',
    zh: `赞助弹窗,展示支付宝 / 微信收款码、会员入口、作者联系方式(可一键复制)和社媒外链;用户想支持站点时打开。`,
    en: `Donate modal showing Alipay/WeChat QR codes, a membership link, copyable author contacts, and social links; open it when a user wants to support the site.`,
    note: { zh: `需传 lang 与 onClose。`, en: `Takes lang and onClose props.` },
  },
  {
    name: 'FeedbackModal',
    import: "import FeedbackModal from '@/components/FeedbackModal';",
    category: 'more',
    zh: `反馈提交弹窗,登录后可写需求 / Bug 并粘贴 / 拖拽 / 选择截图(客户端转 webp)加一段短视频,自动捕获页面环境供复现;收集用户反馈时用。`,
    en: `Feedback submission modal where signed-in users write ideas/bugs and attach pasted/dragged screenshots (client-side webp) plus a short video, auto-capturing page context for repro.`,
    note: { zh: `需传 lang 与 onClose;未登录显示 WCA 登录引导。`, en: `Takes lang and onClose props; shows a WCA sign-in prompt when logged out.` },
  },
  {
    name: 'ValidationReportModal',
    import: "import ValidationReportModal from '@/components/ValidationReportModal';",
    category: 'more',
    zh: `公式库校验报告弹窗,扫描某个 set 或全库逐条验证 setup + alg 是否还原,列出失败项可点击跳到对应 case 修改;管理员维护 alg 库时用。`,
    en: `Alg-library validation report modal that scans one set or all sets, checks each setup+alg solves, and lists clickable failures jumping to the offending case; used by admins.`,
    note: { zh: `需传 scope / onClose / onPickCase,可选 refreshKey 触发重校验。`, en: `Takes scope/onClose/onPickCase, with an optional refreshKey to re-validate.` },
  },
  {
    name: 'AdminCaseEditor',
    import: "import AdminCaseEditor from '@/components/AdminCaseEditor';",
    category: 'more',
    zh: `管理员编辑 / 新增 / 删除单个公式 case 的全屏弹窗,含实时动画预览、公式编辑器、虚拟键盘和高级 JSON 区,保存前校验公式。`,
    en: `Full-screen admin modal to edit/add/delete a single alg case, with live animation preview, alg editor, virtual keyboard and an advanced JSON section, validating algs before save.`,
    note: { zh: `需传 puzzle / setSlug / state / onClose / onSaved。`, en: `Takes puzzle/setSlug/state/onClose/onSaved props.` },
  },
  {
    name: 'AdminSubmissionsPanel',
    import: "import AdminSubmissionsPanel from '@/components/AdminSubmissionsPanel';",
    category: 'more',
    zh: `管理员「新公式投稿」下拉面板,从桌宠角标点开,列出最近投稿并标记已读、每条链到对应 case 的 alg 页;admin 专用。`,
    en: `Admin new-alg-submission dropdown panel opened from the desk-pet badge, listing recent submissions, marking them read and linking each to its alg-set page; admin-only.`,
    note: { zh: `需传 lang 与 onClose;DeskPet 在 I18nProvider 外故靠 lang prop。`, en: `Takes lang and onClose props; uses lang prop since DeskPet lives outside I18nProvider.` },
  },
  {
    name: 'AuthTokenRefresher',
    import: "import AuthTokenRefresher from '@/components/AuthTokenRefresher';",
    category: 'more',
    zh: `无 UI:挂载时静默续签临近过期的登录 JWT(滑动过期),挂在 root layout 让任意页面加载都跑一次。`,
    en: `No UI: silently renews a near-expiry login JWT (sliding expiry) on mount, mounted in the root layout so it runs on any page load.`,
    note: { zh: `纯副作用组件,return null,无任何视觉输出。`, en: `Side-effect-only component that returns null with no visual output.` },
  },
  {
    name: 'ThemeColorSync',
    import: "import ThemeColorSync from '@/components/ThemeColorSync';",
    category: 'more',
    zh: `无 UI:把 <meta name="theme-color"> 同步成页面实际背景色,让 iOS Safari 顶 / 底栏配色匹配,路由或主题变化时更新。`,
    en: `No UI: keeps the theme-color meta tag in sync with the page's real background so iOS Safari's chrome matches, updating on route or theme changes.`,
    note: { zh: `纯副作用组件,return null,无任何视觉输出。`, en: `Side-effect-only component that returns null with no visual output.` },
  },
  {
    name: 'ColFilter',
    import: "import { ColFilter } from '@/components/ColFilter/ColFilter';",
    category: 'more',
    zh: `表头列筛选 popover:漏斗按钮触发,portal 弹层装任意 children,可选升降序排序条与清除按钮,支持受控开关。`,
    en: `Column-header filter popover: funnel button opens a portaled popup hosting arbitrary children, optional asc/desc sort row and clear button, supports controlled open state.`,
    note: { zh: `为表格列设计,需 children + active / onClear,放在 th 里才有意义。`, en: `Designed for table columns; needs children + active/onClear, meant inside a th.` },
  },
  {
    name: 'CompsTab',
    import: "import CompsTab from '@/components/persons/sections/CompsTab';",
    category: 'more',
    zh: `选手页「赛事」tab,把全部参赛比赛列成可排序表格(序号 / 日期 / 比赛名 / 项目图标条,参加过实色、未参灰色)。`,
    en: `The person page's Competitions tab: a sortable table of every competition entered (#/date/name/event-icon strip, colored for events entered, grey otherwise).`,
  },
  {
    name: 'EventStatsTab',
    import: "import EventStatsTab from '@/components/persons/sections/EventStatsTab';",
    category: 'more',
    zh: `选手页「项目统计」tab,每个项目一行汇总首次 / 最后参赛、比赛数、轮次、尝试、成功、失败,可按列排序。`,
    en: `The person page's Event Stats tab: one row per event aggregating first/last comp, comps, rounds, attempts, solves and fails, sortable by column.`,
  },
  {
    name: 'LitCitiesTab',
    import: "import LitCitiesTab from '@/components/persons/sections/LitCitiesTab';",
    category: 'more',
    zh: `选手页「点亮城市」tab,列出选手比赛足迹的国家 / 城市表并附跳转 /wca/comp 地球视图的入口。`,
    en: `The person page's Cities tab: lists the cuber's competition footprint by country/city and links out to the /wca/comp globe view.`,
  },
  {
    name: 'MilestonesTab',
    import: "import MilestonesTab from '@/components/persons/sections/MilestonesTab';",
    category: 'more',
    zh: `选手页「里程碑」tab,时间轴展示首次参赛、显著进步、首领奖台、破纪录等成就,带类型多选过滤、进步阈值滑杆和升降序。`,
    en: `The person page's Milestones tab: a timeline of achievements (first comp, big improvement, first podium, record breaker, etc.) with type filters, an improvement-threshold slider and sort order.`,
    note: { zh: `里程碑检测规则改写自 cubing.pro player_milestone.ts (GPL-3.0)。`, en: `Milestone detection rules are reimplemented from cubing.pro's player_milestone.ts (GPL-3.0).` },
  },
  {
    name: 'PersonBestCombos',
    import: "import PersonBestCombos from '@/components/persons/sections/PersonBestCombos';",
    category: 'more',
    zh: `选手页卡片,展示该选手名次和最低(世界排名最高)的最优项目组合(单次 + 平均两块),数据走 /v1/wca/sum-of-ranks/player-best。`,
    en: `Person-page card showing the cuber's best event combination (the subset minimizing their sum of ranks) for single and average, fed by /v1/wca/sum-of-ranks/player-best.`,
    note: { zh: `无数据时整块不渲染;「废止项」口径由 PR 表的开关受控,本卡只跟随。`, en: `Renders nothing when the cuber has no data; the cancelled-events toggle is owned by the PR table, this card only follows it.` },
  },
  {
    name: 'PersonHero',
    import: "import PersonHero from '@/components/persons/sections/PersonHero';",
    category: 'more',
    zh: `选手页顶部 hero,展示头像、国旗、完整 WCA 名(链 WCA 官网)、性别图标、WCA ID 和比赛 / 复原 / 尝试次数信息条。`,
    en: `The person page's top hero: avatar, flag, full WCA name (linking to worldcubeassociation.org), gender icon, WCA ID, and a comps/solves/attempts info bar.`,
  },
  {
    name: 'PersonPRTable',
    import: "import PersonPRTable from '@/components/persons/sections/PersonPRTable';",
    category: 'more',
    zh: `选手页 PR 大表,每项目单次 / 平均 x 世界 / 洲际 / 地区名次 + 领奖台计数,可切当前 / 历史最佳排名、按行多选项目算自选组合的名次和(SoWR / SoCR / SoNR)。`,
    en: `The person page's PR table: per-event single/average x world/continent/country ranks plus podium counts, with current vs historical-best toggle and row multi-select to compute a custom combo's sum of ranks (SoWR/SoCR/SoNR).`,
  },
  {
    name: 'PersonResultChanges',
    import: "import PersonResultChanges from '@/components/persons/sections/PersonResultChanges';",
    category: 'more',
    zh: `选手页「成绩变更」卡,列出该选手往期成绩被取消 / 修正(旧值划线、新值并存),数据走 /v1/wca/result-watch/changes,只收已批准的变更。`,
    en: `The person page's Result Changes card listing past results that were cancelled or corrected (old value struck through, new alongside), from /v1/wca/result-watch/changes, approved changes only.`,
    note: { zh: `无变更时整块隐藏;待审核提议不在此显示,只收 approved。`, en: `Hidden entirely when there are no changes; pending proposals are not shown here, only approved ones.` },
  },
  {
    name: 'PersonTabs',
    import: "import PersonTabs from '@/components/persons/sections/PersonTabs';",
    category: 'more',
    zh: `选手页 5-tab 容器(成绩 / 赛事 / 项目统计 / 里程碑 / 点亮城市),用 nuqs ?tab= 持久化并 lazy 加载各 tab。`,
    en: `The person page's 5-tab container (Results/Competitions/Event Stats/Milestones/Cities), persisted via nuqs ?tab= with each tab lazy-loaded.`,
  },
  {
    name: 'AttemptEditPopover',
    import: "import { AttemptEditPopover } from '@/components/persons/sections/results/AttemptEditPopover';",
    category: 'more',
    zh: `包裹单次成绩值的小浮层编辑器,管理员 / 登录用户可对该次填补更正前原始值、改判后新值或加罚时(每档 +2),通过 portal + fixed 逃出表格裁切。`,
    en: `A popover wrapping a single solve value letting admins/logged-in users set its pre-correction original value, post-correction new value or a penalty (+2 steps), rendered via portal+fixed to escape table clipping.`,
    note: { zh: `盒子定位与结构样式全内联(不依赖外部 CSS),规避 dev CSS HMR 滞后致浮层塌陷;format 由调用方传。`, en: `Box positioning and structural styles are fully inline (no external CSS) to survive dev CSS HMR lag; the format function is passed by the caller.` },
  },
  {
    name: 'ByCompList',
    import: "import ByCompList from '@/components/persons/sections/results/ByCompList';",
    category: 'more',
    zh: `成绩 tab「按比赛」视图,按比赛分组列出每轮的项目 / 轮次 / 排名 / 单次 / 平均 / 各次尝试,带 PB 染色、纪录标志、行锚点 hash 与成绩变更编辑入口。`,
    en: `The Results tab's By-Competition view: rows grouped per competition showing event/round/place/single/average/attempts, with PB coloring, record badges, hash anchors and result-change editing.`,
  },
  {
    name: 'ByEventView',
    import: "import ByEventView from '@/components/persons/sections/results/ByEventView';",
    category: 'more',
    zh: `成绩 tab「按项目」视图,单项目四块:最佳成绩折线、单次分布直方图、历史排名曲线(echarts)和按比赛倒序的全部成绩表。`,
    en: `The Results tab's By-Event view for a single event: best-times line chart, single-distribution histogram, rank-history curve (echarts) and a full results table in reverse-comp order.`,
    note: { zh: `排名折线图直接 fork 自 cubing.pro ResultWIthEventRankingTimers.tsx (GPL-3.0)。`, en: `The rank-history line chart is forked from cubing.pro's ResultWIthEventRankingTimers.tsx (GPL-3.0).` },
  },
  {
    name: 'PendingProposals',
    import: "import { PendingProposals } from '@/components/persons/sections/results/PendingProposals';",
    category: 'more',
    zh: `成绩行内「待审核」标记,点开浮层列出登录用户提议的未批准改动(旧到新),管理员可就地批准 / 驳回,数据走 result-watch-api。`,
    en: `A row-level Pending chip whose popover lists not-yet-approved proposed changes (old to new) submitted by logged-in users, with inline admin approve/reject via result-watch-api.`,
    note: { zh: `pending 为空时不渲染;浮层 portal 到 body + fixed,结构样式内联。`, en: `Renders nothing when there are no pending changes; popover is portaled to body with fixed positioning and inline structural styles.` },
  },
  {
    name: 'ResultChangeEditor',
    import: "import { ResultChangeEditor } from '@/components/persons/sections/results/ResultChangeEditor';",
    category: 'more',
    zh: `管理员成绩变更编辑器模态(选手页与 comp 直播页共用),管理一条成绩的整条变更链:增 / 删 / 改单次、平均、纪录标记、原始各次成绩(可自动重算)、日期与原因。`,
    en: `An admin result-change editor modal (shared by person and comp live pages) managing a result's whole change chain: add/edit/delete single, average, record markers, original attempts (with auto-recompute), effective date and reason.`,
    note: { zh: `仅管理员渲染(内部再防御一次 isAdminWcaId);写接口走 requireAdminOrApiKey。`, en: `Only renders for admins (re-guarded internally via isAdminWcaId); writes go through requireAdminOrApiKey.` },
  },
  {
    name: 'ResultsTab',
    import: "import ResultsTab from '@/components/persons/sections/results/ResultsTab';",
    category: 'more',
    zh: `选手页「成绩」tab 容器,按项目 / 按比赛子切换 + 项目图标条,合并官方与直播(非官方)成绩并 lazy 加载 ByEventView / ByCompList,子状态走 nuqs。`,
    en: `The person page's Results tab container: By-Event/By-Competition sub-toggle plus an event-icon strip, merging official and live (unofficial) results and lazy-loading ByEventView/ByCompList, sub-state via nuqs.`,
  },
];
