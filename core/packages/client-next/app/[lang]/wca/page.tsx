'use client';

/**
 * /wca — WCA Stats index. Simplified port of
 * packages/client/src/pages/wca_stats/WcaStatsIndex.tsx.
 *
 * NOTE: The full Vite version uses utils/site_search.ts for cross-cutting
 * search (persons / comps / recons / glossary / alg sets / etc.) — those
 * data sources haven't been ported yet, so this version drops the search
 * box and renders only the curated category cards + Tools tab.
 * TODO: port useSiteSearch + SEARCH_CARDS once LandingPage is migrated.
 */
import { useEffect, useRef, useState } from 'react';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import {
  Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin, Wrench,
  LineChart, TrendingDown, Radio, Target, Calculator, Search,
  ListOrdered, Users, Percent, LayoutGrid, Crown, History, Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { statsUrl } from '@/lib/stats-base';
import { STAT_ICONS } from './wca-stat-icons';
import '../wca/_wca_stats.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

const ICON_MAP: Record<string, LucideIcon> = {
  Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin,
};

interface StatItem { id: string; titleEn: string; titleZh: string
    titleZhHant?: string;
 }
interface StatCategory { nameEn: string; nameZh: string; iconName?: string; stats: StatItem[]
    nameZhHant?: string;
 }
interface IndexData { categories: StatCategory[] }

const TOOLS = '__tools__';
const LOOKUP = '__lookup__';

const WCA_TOOLS: { path: string; zh: string; en: string; Icon: LucideIcon
    zhHant?: string;
 }[] = [
  { path: '/wca/comp',       zh: '比赛',     en: 'Comp',         Icon: Radio,
      zhHant: "比賽"
},
  { path: '/wca/viz',        zh: '分布',     en: 'Distribution', Icon: LineChart,
      zhHant: "分佈"
},
  { path: '/wca/prediction', zh: '预测',     en: 'Prediction',   Icon: TrendingDown,
      zhHant: "預測"
},
  { path: '/nemesizer',      zh: '宿敌',     en: 'Nemesizer',    Icon: Target,
      zhHant: "宿敵"
},
  { path: '/calc',           zh: '计算器',   en: 'Calculator',   Icon: Calculator,
      zhHant: "計算器"
},
];

const LOOKUP_ITEMS: { path: string; zh: string; en: string; Icon: LucideIcon; extraQuery?: string
    zhHant?: string;
 }[] = [
  { path: '/wca/records',         zh: '纪录',         en: 'Records',         Icon: Trophy,
      zhHant: "紀錄"
},
  { path: '/wca/all-results',     zh: '排名',         en: 'Rankings',        Icon: ListOrdered },
  { path: '/wca/cohort-ranks',    zh: '届别排名',     en: 'Cohort Ranks',    Icon: Users,
      zhHant: "屆別排名"
},
  { path: '/wca/success-rate',    zh: '完成率',       en: 'Success Rate',    Icon: Percent },
  { path: '/wca/all-events-done', zh: '全项目达成',   en: 'All Events Done', Icon: LayoutGrid,
      zhHant: "全項目達成"
},
  { path: '/wca/grand-slam',      zh: '大满贯',       en: 'Grand Slam',      Icon: Crown,
      zhHant: "大滿貫"
},
  { path: '/wca/historical',      zh: '历史排名',     en: 'Historical Ranks', Icon: History,
      zhHant: "歷史排名"
},
  { path: '/wca/fun-stats',       zh: '趣味统计',     en: 'Fun Stats',       Icon: Sparkles,
      zhHant: "趣味統計"
},
];

export default function WcaStatsIndex() {
  const { i18n } = useTranslation();
  useDocumentTitle('WCA 统计', 'WCA Statistics', "WCA 統計");
  const [data, setData] = useState<IndexData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<string>(TOOLS);
  const sectionEls = useRef<Map<string, HTMLElement>>(new Map());
  const tabsRef = useRef<HTMLDivElement>(null);
  const lockUntil = useRef(0); // 点 chip 后短暂锁定高亮,别被平滑滚动途中的 scroll-spy 改掉

  const isZh = i18n.language === 'zh';

  useEffect(() => {
    const ac = new AbortController();
    fetch(statsUrl('/stats/index.json'), { signal: ac.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: IndexData) => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
      });
    return () => ac.abort();
  }, []);

  // scroll-spy:分区顶部进入判定线(距视口顶 LINE)即高亮,到页底则兜底最后一个。LINE 取得比最矮
  // 分区还小,保证点 chip 跳转(分区置顶到 84)后判定仍落在该分区、不回弹;footer 自然高度,底部零空白。
  useEffect(() => {
    if (!data) return;
    const els = sectionEls.current;
    if (!els.size) return;
    const LINE = 300; // 判定线距视口顶 300px(须 < 84 + 最矮分区高度 ≈ 313,否则跳转后落到下个分区)
    let raf = 0;
    const compute = () => {
      raf = 0;
      if (Date.now() < lockUntil.current) return; // 跳转动画期间不抢高亮
      const keys = [...els.keys()];
      // 末尾分区到底也滚不到判定线,故到页底时直接锁定最后一个
      if (Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 2) {
        setActiveKey(keys[keys.length - 1]);
        return;
      }
      let current = keys[0];
      els.forEach((el, key) => {
        if (el.getBoundingClientRect().top <= LINE) current = key;
      });
      setActiveKey(current);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(compute); };
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [data]);

  // active chip 跟随横向滚动到可见区(窄屏 tabs 横向溢出时;宽屏 wrap 模式 scrollWidth=clientWidth 无副作用)
  useEffect(() => {
    const container = tabsRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>('.wca-stats-index-tab.active');
    if (!el) return;
    const elRect = el.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const delta = (elRect.left + elRect.width / 2) - (cRect.left + cRect.width / 2);
    if (Math.abs(delta) < 1) return;
    container.scrollTo({ left: container.scrollLeft + delta, behavior: 'smooth' });
  }, [activeKey]);

  const jumpTo = (key: string) => {
    lockUntil.current = Date.now() + 800; // 锁住高亮到平滑滚动结束
    setActiveKey(key);
    sectionEls.current.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="wca-stats-index">
        <div className="wca-stats-index-status">{tr({ zh: '加载中...', en: 'Loading...',
            zhHant: "載入中..."
        })}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="wca-stats-index">
        <div className="wca-stats-index-status wca-stats-index-status-error">
          <h2>{tr({ zh: '加载失败', en: 'Failed to load',
              zhHant: "載入失敗"
        })}</h2>
          <p>{error || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  type Section ={ key: string; zh: string; en: string; Icon?: LucideIcon; cat?: StatCategory
      zhHant?: string;
 };
  const sections: Section[] = [
    { key: TOOLS, zh: '工具', en: 'Tools', Icon: Wrench },
    { key: LOOKUP, zh: '查询', en: 'Lookup', Icon: Search,
        zhHant: "查詢"
    },
    ...data.categories.map(cat => ({
      key: cat.nameEn, zh: cat.nameZh, en: cat.nameEn, Icon: ICON_MAP[cat.iconName || ''], cat,
    })),
  ];

  const registerSection = (key: string) => (el: HTMLElement | null) => {
    if (el) sectionEls.current.set(key, el);
    else sectionEls.current.delete(key);
  };

  return (
    <div className="wca-stats-index">
      <header className="wca-stats-index-hero">
        <div>
          <div className="wca-stats-index-eyebrow">WCA Statistics</div>
          <h1 className="wca-stats-index-title">
            {tr({ zh: 'WCA 统计', en: 'WCA Statistics',
                zhHant: "WCA 統計"
            })}
          </h1>
        </div>
      </header>

      <div className="wca-stats-index-toolbar">
        <div className="wca-stats-index-tabs" ref={tabsRef}>
          {sections.map(sec => (
            <button
              key={sec.key}
              className={`wca-stats-index-tab ${activeKey === sec.key ? 'active' : ''}`}
              onClick={() => jumpTo(sec.key)}
              title={(i18n.language === 'zh-Hant' ? (sec.zhHant ?? sec.zh) : (i18n.language.startsWith('zh') ? sec.zh : sec.en))}
            >
              {sec.Icon && <sec.Icon size={14} strokeWidth={1.75} />}
              <span>{(i18n.language === 'zh-Hant' ? (sec.zhHant ?? sec.zh) : (i18n.language.startsWith('zh') ? sec.zh : sec.en))}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="wca-stats-index-body">
        {sections.map(sec => (
          <section
            key={sec.key}
            id={`wca-sec-${sec.key}`}
            data-key={sec.key}
            ref={registerSection(sec.key)}
            className="wca-stats-index-section"
          >
            <div className="wca-stats-index-section-header">
              {sec.Icon && <sec.Icon size={18} strokeWidth={1.75} />}
              <h2>{(i18n.language === 'zh-Hant' ? (sec.zhHant ?? sec.zh) : (i18n.language.startsWith('zh') ? sec.zh : sec.en))}</h2>
            </div>

            {sec.key === TOOLS && (
              <div className="wca-tools-grid">
                {WCA_TOOLS.map(it => (
                  <Link key={it.path} href={it.path} className="wca-tool-card">
                    <it.Icon size={28} strokeWidth={1.5} />
                    <span>{(i18n.language === 'zh-Hant' ? (it.zhHant ?? it.zh) : (i18n.language.startsWith('zh') ? it.zh : it.en))}</span>
                  </Link>
                ))}
              </div>
            )}

            {sec.key === LOOKUP && (
              <div className="wca-tools-grid">
                {LOOKUP_ITEMS.map(it => {
                  const to = it.extraQuery ? `${it.path}?${it.extraQuery}` : it.path;
                  return (
                    <Link key={`${it.path}|${it.extraQuery ?? ''}`} href={to} className="wca-tool-card">
                      <it.Icon size={28} strokeWidth={1.5} />
                      <span>{(i18n.language === 'zh-Hant' ? (it.zhHant ?? it.zh) : (i18n.language.startsWith('zh') ? it.zh : it.en))}</span>
                    </Link>
                  );
                })}
              </div>
            )}

            {sec.cat && (
              <div className="wca-stats-index-grid">
                {sec.cat.stats.map(s => {
                  const StatIcon = STAT_ICONS[s.id] || sec.Icon;
                  return (
                    <Link
                      key={s.id}
                      href={`/wca/${s.id}`}
                      className="wca-stat-card"
                    >
                      {StatIcon && <StatIcon size={18} strokeWidth={1.5} />}
                      <span>{i18n.language === 'zh-Hant' ? (s.titleZhHant ?? s.titleZh) : (isZh ? s.titleZh : s.titleEn)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        ))}
        <footer className="wca-stats-index-footer">
          <span>
            {tr({ zh: '数据来源 ', en: 'Data from ',
                zhHant: "資料來源 "
            })}
            <a href="https://www.worldcubeassociation.org/" target="_blank" rel="noopener noreferrer">WCA</a>
          </span>
          <Link href="/about" prefetch={false}>{tr({ zh: '关于', en: 'About',
              zhHant: "關於"
        })}</Link>
          <a href="https://github.com/RuiminYan/cuberoot.me" target="_blank" rel="noopener noreferrer">GitHub</a>
        </footer>
      </div>
    </div>
  );
}
