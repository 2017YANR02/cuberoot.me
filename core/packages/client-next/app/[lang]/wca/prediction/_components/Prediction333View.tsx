/**
 * /wca/prediction/333 — 3x3 单项目深度极限预测
 *
 * 独立路由的"长文" — 历史 / 方法 / 数学 / 生物力学 / 顶级选手 / 训练 / 统计 / 预测.
 * 收尾给出 single + Ao5 综合预测.
 */
'use client';

import { useEffect, useState, useContext, createContext } from 'react';
import { useTranslation } from 'react-i18next';
import Link from '@/components/AppLink';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight as ArrowRightIcon, Menu, X as XIcon } from 'lucide-react';

const ActiveSectionContext = createContext<string>('tldr');
import { LineChart, type Series, type Band, type RefLine } from './charts';
import { VisualCube } from '@/components/VisualCube';
import {
  WR_SINGLE_HISTORY,
  WR_AO5_HISTORY,
  SUB_X_MILESTONES,
  SUB_X_AO5,
  FAMOUS_RECONSTRUCTIONS,
} from './data/wr333_history';
import {
  CFOP_BREAKDOWN,
  OLL_BY_STM,
  PLL_TABLE,
  ZBLL_GROUPS,
  SKIP_PROBABILITIES,
} from './data/method_dna';
import { OPTIMAL_HTM_DISTRIBUTION, GODS_NUMBER_HISTORY } from './theory_data';
import { Longform } from './components/Longform';
import { HISTORY_DETAIL_EN } from './data/longform/history_detail';
import { MATH_DETAIL_EN } from './data/longform/math_detail';
import { CFOP_DETAIL_EN } from './data/longform/cfop_detail';
import { BIOMECH_TRAINING_EN } from './data/longform/biomech_training';
import { STATS_FORECAST_EN } from './data/longform/stats_forecast';
import { ALGORITHMS_CATALOG_EN } from './data/longform/algorithms_catalog';
import { FMC_EVENTS_EN } from './data/longform/fmc_events';
import { ENGINEERING_EN } from './data/longform/engineering';
import { SOLVER_SOFTWARE_EN } from './data/longform/solver_software';
import { COMPETITIONS_DETAIL_EN } from './data/longform/competitions_detail';
import { AI_ML_EN } from './data/longform/ai_ml';
import { PSYCHOLOGY_EN } from './data/longform/psychology';
import { RELATED_PUZZLES_EN } from './data/longform/related_puzzles';
import { HISTORY_EXTENDED_EN } from './data/longform/history_extended';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './prediction.css';
import './prediction333.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

const SECTIONS = [
  { id: 'tldr',          labelZh: '一句话结论',                  labelEn: 'Top Line',
      labelZhHant: "一句話結論"
},
  { id: 'history',       labelZh: '23 年 WR 编年史',              labelEn: '23-Year WR Chronicle',
      labelZhHant: "23 年 WR 編年史"
},
  { id: 'reconstructions', labelZh: '著名复盘 (STM / TPS)',       labelEn: 'Famous Reconstructions',
      labelZhHant: "著名覆盤 (STM / TPS)"
},
  { id: 'state-space',   labelZh: '状态空间 4.3×10¹⁹',            labelEn: 'State Space 4.3×10¹⁹',
      labelZhHant: "狀態空間 4.3×10¹⁹"
},
  { id: 'gods-number',   labelZh: "God's number 演化",            labelEn: "God's Number Evolution" },
  { id: 'optimal-dist',  labelZh: '最优 HTM 分布',                labelEn: 'Optimal HTM Distribution',
      labelZhHant: "最優 HTM 分佈"
},
  { id: 'metrics',       labelZh: 'HTM / STM / QTM / ATM',        labelEn: 'HTM/STM/QTM/ATM' },
  { id: 'method-cfop',   labelZh: 'CFOP 解剖学',                  labelEn: 'CFOP Anatomy',
      labelZhHant: "CFOP 解剖學"
},
  { id: 'method-oll',    labelZh: 'OLL 57 case',                  labelEn: 'OLL 57 Cases' },
  { id: 'method-pll',    labelZh: 'PLL 21 case',                  labelEn: 'PLL 21 Cases' },
  { id: 'method-zb',     labelZh: 'ZB / ZBLS / ZBLL',             labelEn: 'ZB / ZBLS / ZBLL' },
  { id: 'method-roux',   labelZh: 'Roux / ZZ / Petrus / Mehta',   labelEn: 'Roux / ZZ / Petrus / Mehta' },
  { id: 'lookahead',     labelZh: 'F2L lookahead 理论',           labelEn: 'F2L Lookahead Theory',
      labelZhHant: "F2L lookahead 理論"
},
  { id: 'inspection',    labelZh: 'Inspection 运筹',              labelEn: 'Inspection Strategy',
      labelZhHant: "Inspection 運籌"
},
  { id: 'skips',         labelZh: '幸运打乱 + skip 概率',         labelEn: 'Lucky Scrambles + Skip Probability',
      labelZhHant: "幸運打亂 + skip 機率"
},
  { id: 'hardware',      labelZh: '硬件 1980-2026',                labelEn: 'Hardware 1980-2026',
      labelZhHant: "硬體 1980-2026"
},
  { id: 'smart-cube',    labelZh: '智能魔方革命',                 labelEn: 'Smart Cube Revolution',
      labelZhHant: "智慧魔方革命"
},
  { id: 'biomech',       labelZh: '生物力学: TPS 边界',           labelEn: 'Biomech: TPS Ceiling',
      labelZhHant: "生物力學: TPS 邊界"
},
  { id: 'cubers',        labelZh: '顶级选手画像',                 labelEn: 'Top Cuber Profiles',
      labelZhHant: "頂級選手畫像"
},
  { id: 'training',      labelZh: '训练学方法',                   labelEn: 'Training Methodology',
      labelZhHant: "訓練學方法"
},
  { id: 'stats',         labelZh: '统计建模',                     labelEn: 'Statistical Modeling',
      labelZhHant: "統計建模"
},
  { id: 'gev',           labelZh: '极值理论 (Gumbel/GEV)',         labelEn: 'GEV Theory',
      labelZhHant: "極值理論 (Gumbel/GEV)"
},
  { id: 'forecast',      labelZh: '综合预测 (single + Ao5)',      labelEn: 'Final Forecast',
      labelZhHant: "綜合預測 (single + Ao5)"
},
  { id: 'scenarios',     labelZh: '情景分析',                     labelEn: 'Scenarios' },
  { id: 'caveats',       labelZh: '局限',                         labelEn: 'Caveats',
      labelZhHant: "侷限"
},
];

export default function Prediction333View({ sectionId }: { sectionId?: string }) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [tocOpen, setTocOpen] = useState(false);
  const router = useRouter();
  const requested = sectionId ?? 'tldr';
  const activeIdx = Math.max(0, SECTIONS.findIndex((s) => s.id === requested));
  const activeId = SECTIONS[activeIdx].id;
  const prevSection = activeIdx > 0 ? SECTIONS[activeIdx - 1] : null;
  const nextSection = activeIdx < SECTIONS.length - 1 ? SECTIONS[activeIdx + 1] : null;
  const section333Title = sectionId
    ? (i18n.language === 'zh-Hant' ? (SECTIONS[activeIdx].labelZhHant ?? SECTIONS[activeIdx].labelZh) : (isZh ? SECTIONS[activeIdx].labelZh : SECTIONS[activeIdx].labelEn))
    : (tr({ zh: '三阶预测', en: '3×3 Prediction',
        zhHant: "三階預測"
    }));
  useDocumentTitle(section333Title, section333Title);
  const sectionHref = (id: string) => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    return `/wca/prediction/333/${id}${search}`;
  };

  // Scroll to top on section change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeId]);

  // Keyboard nav: left/right arrow goes prev/next.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft' && prevSection) router.push(sectionHref(prevSection.id));
      if (e.key === 'ArrowRight' && nextSection) router.push(sectionHref(nextSection.id));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prevSection, nextSection, router]);

  // Legacy scrollspy kept as a no-op so removing observed elements doesn't break.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) void visible;
      },
      { rootMargin: '-100px 0px -60% 0px' },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const toggleLang = () => {
    const n = (i18n.language.startsWith('zh') ? 'en' : 'zh');
    i18n.changeLanguage(n);
    localStorage.setItem('trainer-lang', n);
  };

  // ── WR 时间序列 ─────────────────────
  const singleSeries: Series[] = [{
    name: tr({ zh: 'WR 单次实测', en: 'WR Single (actual)',
        zhHant: "WR 單次實測"
    }),
    color: '#c2410c',
    data: WR_SINGLE_HISTORY.map((w) => ({ x: new Date(w.date).getFullYear() + (new Date(w.date).getMonth() / 12), y: w.time })),
  }];

  const forecastYears = Array.from({ length: 30 }, (_, i) => 2026 + i);
  const forecastBand: Band = {
    name: 'forecast 80% CI',
    color: '#c2410c',
    opacity: 0.16,
    data: forecastYears.map((y) => {
      const t = y - 2026;
      const center = 1.5 + (2.76 - 1.5) * Math.exp(-0.07 * t);
      const widening = 0.08 * Math.sqrt(t + 1);
      return { x: y, lo: Math.max(1.0, center - widening * 1.28), hi: center + widening * 1.28 };
    }),
  };
  const forecastCenter: Series = {
    name: tr({ zh: '综合预测中位', en: 'Ensemble median',
        zhHant: "綜合預測中位"
    }),
    color: '#c2410c',
    dashed: true,
    width: 1.5,
    data: forecastYears.map((y) => {
      const t = y - 2026;
      return { x: y, y: 1.5 + (2.76 - 1.5) * Math.exp(-0.07 * t) };
    }),
  };

  const refLines: RefLine[] = [
    { y: 1.5, label: tr({ zh: '100 年渐近 ~1.5 s', en: '100-yr asymptote ~1.5 s',
        zhHant: "100 年漸近 ~1.5 s"
    }), color: '#0a8a6b' },
    { y: 0.99, label: tr({ zh: '数学硬墙 ~1.0 s', en: 'Math wall ~1.0 s',
        zhHant: "數學硬牆 ~1.0 s"
    }), color: '#d13636' },
  ];

  const ao5Series: Series[] = [{
    name: tr({ zh: 'WR Ao5 实测', en: 'WR Ao5 (actual)',
        zhHant: "WR Ao5 實測"
    }),
    color: '#2f6fd8',
    data: WR_AO5_HISTORY.map((w) => ({ x: new Date(w.date).getFullYear() + (new Date(w.date).getMonth() / 12), y: w.time })),
  }];

  const ao5Band: Band = {
    name: 'ao5 80% CI',
    color: '#2f6fd8',
    opacity: 0.16,
    data: forecastYears.map((y) => {
      const t = y - 2026;
      const center = 1.9 + (3.71 - 1.9) * Math.exp(-0.065 * t);
      const widening = 0.10 * Math.sqrt(t + 1);
      return { x: y, lo: Math.max(1.3, center - widening * 1.28), hi: center + widening * 1.28 };
    }),
  };
  const ao5Center: Series = {
    name: tr({ zh: '综合预测中位 (Ao5)', en: 'Ensemble median (Ao5)',
        zhHant: "綜合預測中位 (Ao5)"
    }),
    color: '#2f6fd8',
    dashed: true,
    width: 1.5,
    data: forecastYears.map((y) => {
      const t = y - 2026;
      return { x: y, y: 1.9 + (3.71 - 1.9) * Math.exp(-0.065 * t) };
    }),
  };

  return (
    <div className="pred-page pred-page-multi pred-333">
      <header className="pred-header">
        <Link href="/wca/prediction" className="pred-back" aria-label="back">
          <ArrowLeft size={16} />
          <span>{tr({ zh: '返回全项目', en: 'Back to All Events',
              zhHant: "返回全專案"
        })}</span>
        </Link>
        <button className="pred-toc-btn" onClick={() => setTocOpen(!tocOpen)}>
          {tocOpen ? <XIcon size={16} /> : <Menu size={16} />}
        </button>
        <button className="pred-lang" onClick={toggleLang}>{(i18n.language.startsWith('zh') ? 'EN' : '中文')}</button>
      </header>

      <div className="pred-layout">
        <aside className={`pred-sidebar${tocOpen ? ' pred-sidebar-open' : ''}`}>
          <div className="pred-toc-title">{tr({ zh: '3x3 深度', en: '3x3 Deep Dive' })}</div>
          <div className="pred-toc-group">
            {SECTIONS.map((s, i) => (
              <Link key={s.id} href={sectionHref(s.id)}
                 className={`pred-toc-item${activeId === s.id ? ' is-active' : ''}`}
                 onClick={() => setTocOpen(false)}>
                <span className="pred-toc-event-num">{(i + 1).toString().padStart(2, '0')}</span>
                <span className="pred-toc-event-name">{i18n.language === 'zh-Hant' ? (s.labelZhHant ?? s.labelZh) : (isZh ? s.labelZh : s.labelEn)}</span>
              </Link>
            ))}
          </div>
        </aside>

        <article className="pred-article">
          <h1 className="pred-title">
            {tr({ zh: '三阶魔方: 终极极限预测', en: '3x3 Speedcubing: The Ultimate Limits Forecast',
                zhHant: "三階魔方: 終極極限預測"
            })}
          </h1>
          <p className="pred-subtitle">
            {tr({ zh: '历史  方法  硬件  数学  生物力学  顶级选手  训练  统计 — 综合预测单次与平均', en: 'History · Methods · Hardware · Math · Biomech · Top Cubers · Training · Statistics — toward a single & average forecast.',
                zhHant: "歷史  方法  硬體  數學  生物力學  頂級選手  訓練  統計 — 綜合預測單次與平均"
            })}
          </p>
          <div className="pred-333-section-meta">
            {tr({ zh: '章节', en: 'Section',
                zhHant: "章節"
            })} <strong>{(activeIdx + 1).toString().padStart(2, '0')}</strong> / {SECTIONS.length}
            <span className="pred-333-section-meta-hint">{tr({ zh: '  ← → 切换', en: ' · ← → to navigate',
                zhHant: "  ← → 切換"
            })}</span>
          </div>

          <ActiveSectionContext.Provider value={activeId}>

          <Section id="tldr" titleZh="一句话结论" titleEn="Top Line" isZh={isZh}>
            <div className="pred-tldr pred-tldr-333">
              <p className="pred-tldr-lede">
                {i18n.language === 'zh-Hant' ? ((
                                                    <>三階魔方單次 WR 在 <strong>2026 年 2 月 8 日</strong> 由 9 歲波蘭選手 <strong>Teodor Zajder</strong> 以 <strong>2.76 秒</strong> 拿下,
                                                    人類首次跌破 3 秒;兩個月後,8 歲的中國選手 <strong>Xuanyi Geng</strong> 用全 ZB 方法把 Ao5 WR 壓到 <strong>3.71 秒</strong>。
                                                    本文綜合曲線擬合 (Exp+floor / Gompertz / 冪律), 物理下界 (STM × TPS + R), 極值理論 (Gumbel/GEV reverse-Weibull) 三軌預測:</>
                                                  )) : (isZh ? (
                                                    <>三阶魔方单次 WR 在 <strong>2026 年 2 月 8 日</strong> 由 9 岁波兰选手 <strong>Teodor Zajder</strong> 以 <strong>2.76 秒</strong> 拿下,
                                                    人类首次跌破 3 秒;两个月后,8 岁的中国选手 <strong>Xuanyi Geng</strong> 用全 ZB 方法把 Ao5 WR 压到 <strong>3.71 秒</strong>。
                                                    本文综合曲线拟合 (Exp+floor / Gompertz / 幂律), 物理下界 (STM × TPS + R), 极值理论 (Gumbel/GEV reverse-Weibull) 三轨预测:</>
                                                  ) : (
                                                    <>The 3x3 single WR was set at <strong>2.76 s</strong> by 9-year-old <strong>Teodor Zajder</strong> (Poland) on <strong>2026-02-08</strong>, the first sub-3 ever;
                                                    the Ao5 WR was pushed to <strong>3.71 s</strong> two months later by 8-year-old <strong>Xuanyi Geng</strong> (China) using full ZB.
                                                    Combining curve fits (Exp+floor / Gompertz / power), physical floor (STM × TPS + R), and extreme-value theory (Gumbel/GEV reverse-Weibull):</>
                                                  ))}
              </p>
              <div className="pred-tldr-grid">
                <div className="pred-tldr-block">
                  <div className="pred-tldr-label">{tr({ zh: 'WR 单次预测', en: 'WR Single Forecast',
                      zhHant: "WR 單次預測"
                })}</div>
                  <ul className="pred-tldr-list">
                    <li><span>2030</span><strong>2.30 s</strong></li>
                    <li><span>2040</span><strong>1.90 s</strong></li>
                    <li><span>2050</span><strong>1.70 s</strong></li>
                  </ul>
                </div>
                <div className="pred-tldr-block">
                  <div className="pred-tldr-label">{tr({ zh: 'WR Ao5 预测', en: 'WR Ao5 Forecast',
                      zhHant: "WR Ao5 預測"
                })}</div>
                  <ul className="pred-tldr-list">
                    <li><span>2030</span><strong>3.00 s</strong></li>
                    <li><span>2040</span><strong>2.40 s</strong></li>
                    <li><span>2050</span><strong>2.15 s</strong></li>
                  </ul>
                </div>
                <div className="pred-tldr-block">
                  <div className="pred-tldr-label">{tr({ zh: '物理/数学硬墙', en: 'Physical/Math Floors',
                      zhHant: "物理/數學硬牆"
                })}</div>
                  <ul className="pred-tldr-list">
                    <li><span>{tr({ zh: '100 年方法可达', en: '100-yr method-reachable',
                        zhHant: "100 年方法可達"
                    })}</span><strong>~1.50 s</strong></li>
                    <li><span>{tr({ zh: '数学墙', en: 'Math wall',
                        zhHant: "數學牆"
                    })}</span><strong>~0.99 s</strong></li>
                    <li><span>{tr({ zh: 'Ao5 渐近', en: 'Ao5 asymptote',
                        zhHant: "Ao5 漸近"
                    })}</span><strong>~1.90 s</strong></li>
                  </ul>
                </div>
              </div>
              <p className="pred-tldr-note">
                {tr({ zh: '所有预测都带 80% 置信区间,见各章节细节。文末有完整的建模说明。', en: 'All forecasts include 80% confidence band; full methodology at the end.',
                    zhHant: "所有預測都帶 80% 置信區間,見各章節細節。文末有完整的建模說明。"
                })}
              </p>
            </div>
          </Section>

          <Section id="history" titleZh="23 年 WR 编年史" titleEn="23-Year WR Chronicle" isZh={isZh}>
            <p>
              {i18n.language === 'zh-Hant' ? ((
                                              <>WCA 2003 年 8 月 23-24 日在多倫多 (Ontario Science Centre) 世錦賽上成立,同時改寫了停了 21 年的單次 WR — 美國選手 Dan Knights 用 <strong>16.71 秒</strong> 打破了 Minh Thai 1982 年的 22.95。此後 23 年,單次 WR 一路從 16.71 壓到 Zajder 2.76,<strong>縮了 6.06 倍</strong>,平均每年下降 ~7%。注意 1982 那場不在本文趨勢模型中 — 中間 21 年的「無資料空窗」對擬合沒意義。</>
                                            )) : (isZh ? (
                                              <>WCA 2003 年 8 月 23-24 日在多伦多 (Ontario Science Centre) 世锦赛上成立,同时改写了停了 21 年的单次 WR — 美国选手 Dan Knights 用 <strong>16.71 秒</strong> 打破了 Minh Thai 1982 年的 22.95。此后 23 年,单次 WR 一路从 16.71 压到 Zajder 2.76,<strong>缩了 6.06 倍</strong>,平均每年下降 ~7%。注意 1982 那场不在本文趋势模型中 — 中间 21 年的「无数据空窗」对拟合没意义。</>
                                            ) : (
                                              <>The WCA was founded at the August 23-24, 2003 World Championship in Toronto. Dan Knights (USA) ran a <strong>16.71</strong> on opening day — finally breaking Minh Thai's 22.95 from 1982 that had stood for 21 years. Over the next 23 years the single fell to Zajder's 2.76, a <strong>6.06× compression</strong>, ~7% per year compounded. The 1982 mark is excluded from the trend models — different era, 21-year data gap.</>
                                            ))}
            </p>
            <LineChart
              series={[...singleSeries, forecastCenter]}
              bands={[forecastBand]}
              refLines={refLines}
              yLabel={tr({ zh: '时间 (秒)', en: 'Time (s)',
                  zhHant: "時間 (秒)"
            })}
              xLabel={tr({ zh: '年份', en: 'Year' })}
              yMin={0.5}
              yMax={20}
            />
            <p>
              {i18n.language === 'zh-Hant' ? (<>下方表格按時間排列,共 <strong>{WR_SINGLE_HISTORY.length} 次單次 WR 改寫</strong>。STM/TPS 來自社羣覆盤。</>) : (isZh
                                              ? <>下方表格按时间排列,共 <strong>{WR_SINGLE_HISTORY.length} 次单次 WR 改写</strong>。STM/TPS 来自社区复盘。</>
                                              : <>The table below lists all <strong>{WR_SINGLE_HISTORY.length} single WR drops</strong>. STM/TPS from community reconstructions.</>)}
            </p>
            <div className="pred-method-table-wrap">
              <table className="pred-fit-table pred-method-table">
                <thead>
                  <tr>
                    <th>{tr({ zh: '日期', en: 'Date' })}</th>
                    <th>{tr({ zh: '时间', en: 'Time',
                        zhHant: "時間"
                    })}</th>
                    <th>{tr({ zh: '选手', en: 'Holder',
                        zhHant: "選手"
                    })}</th>
                    <th>{tr({ zh: '比赛', en: 'Comp',
                        zhHant: "比賽"
                    })}</th>
                    <th>{tr({ zh: '方法', en: 'Method' })}</th>
                    <th>{tr({ zh: '硬件', en: 'Hardware',
                        zhHant: "硬體"
                    })}</th>
                    <th>STM</th>
                    <th>TPS</th>
                    <th>{tr({ zh: '特征', en: 'Feature',
                        zhHant: "特徵"
                    })}</th>
                  </tr>
                </thead>
                <tbody>
                  {WR_SINGLE_HISTORY.map((w, i) => (
                    <tr key={i}>
                      <td className="pred-num">{w.date}</td>
                      <td className="pred-num"><strong>{w.time.toFixed(2)}</strong></td>
                      <td>{w.holder} ({w.country})</td>
                      <td className="pred-num-small">{w.comp}</td>
                      <td className="pred-num-small">{w.method ?? '–'}</td>
                      <td className="pred-num-small">{w.hardware ?? '–'}</td>
                      <td className="pred-num">{w.stm ?? '–'}</td>
                      <td className="pred-num">{w.tps?.toFixed(2) ?? '–'}</td>
                      <td className="pred-num-small">{w.feature ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>{tr({ zh: 'Ao5 历程 (2007 引入)', en: 'Ao5 Progression (since 2007)',
                zhHant: "Ao5 歷程 (2007 引入)"
            })}</h3>
            <p>
              {i18n.language === 'zh-Hant' ? (<>WCA 從 2007 年起以 Ao5 作為正式排名指標 (之前是 Mo3)。本表是 Ao5 時代的完整 WR,共 <strong>{WR_AO5_HISTORY.length} 次</strong>。Feliks Zemdegs 一人霸榜 9 年 (2010-2019)。</>) : (isZh
                                              ? <>WCA 从 2007 年起以 Ao5 作为正式排名指标 (之前是 Mo3)。本表是 Ao5 时代的完整 WR,共 <strong>{WR_AO5_HISTORY.length} 次</strong>。Feliks Zemdegs 一人霸榜 9 年 (2010-2019)。</>
                                              : <>WCA adopted Ao5 as the official ranking metric in 2007 (Mo3 prior). Complete Ao5 WR table, <strong>{WR_AO5_HISTORY.length} drops</strong>. Zemdegs held it solo for ~9 years (2010-2019).</>)}
            </p>
            <LineChart
              series={[...ao5Series, ao5Center]}
              bands={[ao5Band]}
              refLines={[{ y: 1.9, label: tr({ zh: 'Ao5 渐近 ~1.9 s', en: 'Ao5 asymptote ~1.9 s',
                  zhHant: "Ao5 漸近 ~1.9 s"
            }), color: '#0a8a6b' }]}
              yLabel={tr({ zh: '时间 (秒)', en: 'Time (s)',
                  zhHant: "時間 (秒)"
            })}
              xLabel={tr({ zh: '年份', en: 'Year' })}
              yMin={1}
              yMax={20}
            />
            <div className="pred-method-table-wrap">
              <table className="pred-fit-table pred-method-table">
                <thead>
                  <tr><th>{tr({ zh: '日期', en: 'Date' })}</th><th>Ao5</th><th>{tr({ zh: '选手', en: 'Holder',
                      zhHant: "選手"
                })}</th><th>{tr({ zh: '比赛', en: 'Comp',
                    zhHant: "比賽"
                })}</th><th>{tr({ zh: '方法', en: 'Method' })}</th><th>{tr({ zh: '5 局', en: '5 solves' })}</th><th>{tr({ zh: '备注', en: 'Note',
                    zhHant: "備註"
                })}</th></tr>
                </thead>
                <tbody>
                  {WR_AO5_HISTORY.map((w, i) => (
                    <tr key={i}>
                      <td className="pred-num">{w.date}</td>
                      <td className="pred-num"><strong>{w.time.toFixed(2)}</strong></td>
                      <td>{w.holder} ({w.country})</td>
                      <td className="pred-num-small">{w.comp}</td>
                      <td className="pred-num-small">{w.method ?? '–'}</td>
                      <td className="pred-num-small">{w.solves ? w.solves.map((s) => s.toFixed(2)).join(', ') : '–'}</td>
                      <td className="pred-num-small">{w.feature ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>{tr({ zh: 'Sub-X 里程碑时间轴', en: 'Sub-X Milestone Timeline',
                zhHant: "Sub-X 里程碑時間軸"
            })}</h3>
            <p>{tr({ zh: '单次 Sub-X 节点用了 22 年压缩 5 倍:', en: 'Single sub-X milestones compressed 5× over 22 years:',
                zhHant: "單次 Sub-X 節點用了 22 年壓縮 5 倍:"
            })}</p>
            <div className="pred-method-table-wrap">
              <table className="pred-fit-table pred-method-table">
                <thead><tr><th>{tr({ zh: '阈值', en: 'Sub-X',
                    zhHant: "閾值"
                })}</th><th>{tr({ zh: '年份', en: 'Year' })}</th><th>{tr({ zh: '日期', en: 'Date' })}</th><th>{tr({ zh: '首突破', en: 'First Holder' })}</th><th>{tr({ zh: '注解', en: 'Note',
                    zhHant: "註解"
                })}</th></tr></thead>
                <tbody>
                  {SUB_X_MILESTONES.map((m) => (
                    <tr key={m.threshold}>
                      <td className="pred-num"><strong>Sub-{m.threshold}</strong></td>
                      <td className="pred-num">{m.year}</td>
                      <td className="pred-num">{m.date}</td>
                      <td>{m.holder}</td>
                      <td className="pred-num-small">{isZh ? m.note_zh : m.note_en}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>{tr({ zh: 'Ao5 sub-X 序列,通常比单次晚 2-3 年:', en: 'Ao5 milestones lag single by ~2-3 years:',
                zhHant: "Ao5 sub-X 序列,通常比單次晚 2-3 年:"
            })}</p>
            <div className="pred-method-table-wrap">
              <table className="pred-fit-table pred-method-table">
                <thead><tr><th>{tr({ zh: '阈值', en: 'Sub-X',
                    zhHant: "閾值"
                })}</th><th>{tr({ zh: '年份', en: 'Year' })}</th><th>{tr({ zh: '日期', en: 'Date' })}</th><th>{tr({ zh: '首突破', en: 'First Holder' })}</th><th>{tr({ zh: '注解', en: 'Note',
                    zhHant: "註解"
                })}</th></tr></thead>
                <tbody>
                  {SUB_X_AO5.map((m) => (
                    <tr key={m.threshold}>
                      <td className="pred-num"><strong>Sub-{m.threshold}</strong></td>
                      <td className="pred-num">{m.year}</td>
                      <td className="pred-num">{m.date}</td>
                      <td>{m.holder}</td>
                      <td className="pred-num-small">{isZh ? m.note_zh : m.note_en}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!isZh && <Longform text={HISTORY_DETAIL_EN} />}
            {!isZh && <Longform text={HISTORY_EXTENDED_EN} />}
            {!isZh && <Longform text={COMPETITIONS_DETAIL_EN} />}
          </Section>

          <Section id="reconstructions" titleZh="著名复盘 (STM / TPS)" titleEn="Famous Reconstructions" isZh={isZh}>
            <p>
              {i18n.language === 'zh-Hant' ? (<>每次單次 WR 都對應一個 (打亂, 解, STM, TPS) 四元組。擺到一起看最清楚: <strong>TPS 一路漲,STM 因為幸運打亂 + 方法躍遷而出現非線性跳水</strong>。Wang 45 STM × 14.61 TPS (高 TPS 路徑);Geng 33 STM × 10.81 TPS (高效路徑);Zajder 29 STM × 10.50 TPS (高效 + ZBLL 組合)。</>) : (isZh
                                              ? <>每次单次 WR 都对应一个 (打乱, 解, STM, TPS) 四元组。摆到一起看最清楚: <strong>TPS 一路涨,STM 因为幸运打乱 + 方法跃迁而出现非线性跳水</strong>。Wang 45 STM × 14.61 TPS (高 TPS 路径);Geng 33 STM × 10.81 TPS (高效路径);Zajder 29 STM × 10.50 TPS (高效 + ZBLL 组合)。</>
                                              : <>Every WR single = (scramble, solution, STM, TPS) signature. Stacked: <strong>TPS rises continuously; STM drops in jumps from lucky scrambles + method shifts</strong>. Wang 45 STM × 14.61 TPS (TPS path); Geng 33 STM × 10.81 TPS (efficient path); Zajder 29 STM × 10.50 TPS (combo path).</>)}
            </p>
            <div className="pred-recon-grid">
              {FAMOUS_RECONSTRUCTIONS.map((r) => (
                <div key={r.name} className="pred-recon-card">
                  <div className="pred-recon-head">
                    <div className="pred-recon-name">{r.name}</div>
                    <div className="pred-recon-date">{r.date}</div>
                  </div>
                  <div className="pred-recon-meta">
                    <span><strong>{r.time}s</strong></span>
                    <span>{r.stm} STM</span>
                    <span>{r.tps.toFixed(2)} TPS</span>
                    {r.hardware && <span className="pred-recon-hw">{r.hardware}</span>}
                  </div>
                  <div className="pred-recon-method"><strong>{tr({ zh: '方法', en: 'Method' })}:</strong> {r.method}</div>
                  {r.scramble && (
                    <div className="pred-recon-scramble"><strong>{tr({ zh: '打乱', en: 'Scramble',
                        zhHant: "打亂"
                    })}:</strong> <code>{r.scramble}</code></div>
                  )}
                  {r.solution && <pre className="pred-recon-solution">{r.solution}</pre>}
                  <p className="pred-recon-note">{isZh ? r.significance_zh : r.significance_en}</p>
                  {r.source && <a className="pred-recon-source" href={r.source} target="_blank" rel="noopener noreferrer">{tr({ zh: '来源', en: 'source',
                      zhHant: "來源"
                })} ↗</a>}
                </div>
              ))}
            </div>
            <p className="pred-note">
              {i18n.language === 'zh-Hant' ? (<><strong>核心觀察:</strong> Du 3.47 的 27 STM 比 Zajder 2.76 的 29 STM 還少,但 Du 的 TPS 只有 7.78。如果 Du 那把打亂讓 Zajder 來跑,理論上能跑出 27/14 ≈ 1.9 秒 — 這就是「百年內可達 ~1.5 秒」這條預測的來源: <strong>Du 的步數 × Wang 的 TPS</strong> = 把現役頂級選手疊在一起的最優值。</>) : (isZh
                                              ? <><strong>核心观察:</strong> Du 3.47 的 27 STM 比 Zajder 2.76 的 29 STM 还少,但 Du 的 TPS 只有 7.78。如果 Du 那把打乱让 Zajder 来跑,理论上能跑出 27/14 ≈ 1.9 秒 — 这就是「百年内可达 ~1.5 秒」这条预测的来源: <strong>Du 的步数 × Wang 的 TPS</strong> = 把现役顶级选手叠在一起的最优值。</>
                                              : <><strong>Key cross-comparison:</strong> Du's 27 STM is fewer than Zajder's 29, but Du was only 7.78 TPS. Hand Du's scramble to Zajder-level TPS: 27/14 ≈ 1.9 s. This is the source of "100-yr reachable ~1.5 s" — <strong>Du's STM + Wang's TPS</strong> = "stacked optimum of living cubers".</>)}
            </p>

          </Section>

          <Section id="state-space" titleZh="状态空间 4.3×10¹⁹" titleEn="State Space 4.3×10¹⁹" isZh={isZh}>
            <p>{i18n.language === 'zh-Hant' ? (<>3x3 魔方的可達狀態總數 <strong>43,252,003,274,489,856,000 ≈ 4.3 × 10¹⁹</strong>:</>) : (isZh ? <>3x3 魔方的可达状态总数 <strong>43,252,003,274,489,856,000 ≈ 4.3 × 10¹⁹</strong>:</> : <>3x3 has <strong>43,252,003,274,489,856,000 ≈ 4.3 × 10¹⁹</strong> reachable states:</>)}</p>
            <pre className="pred-formula">{`|G| = (8! · 3^7) · (12! · 2^11) / 2 = 4.3252 × 10^19

  8 个角的位置: 8! = 40,320
  7 个角的朝向 (第 8 个被约束): 3^7 = 2,187
  12 个棱的位置: 12! = 479,001,600
  11 个棱的朝向 (第 12 个被约束): 2^11 = 2,048
  角棱位置奇偶性必须同号 → 除 2

素因子分解: |G| = 2^27 · 3^14 · 5^3 · 7^2 · 11`}</pre>
            <ul>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>角朝向和 ≡ 0 mod 3。</strong> 每個角有 3 種扭向,第 8 個由前 7 個決定。</>) : (isZh ? <><strong>角朝向和 ≡ 0 mod 3。</strong> 每个角有 3 种扭向,第 8 个由前 7 个决定。</> : <><strong>Corner orientation sum ≡ 0 mod 3.</strong> Each has 3 twist states; the 8th is forced.</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>稜朝向和 ≡ 0 mod 2。</strong> F/B 的 1/4 轉翻 4 個稜,第 12 個由前 11 個強制確定。</>) : (isZh ? <><strong>棱朝向和 ≡ 0 mod 2。</strong> F/B 的 1/4 转翻 4 个棱,第 12 个由前 11 个强制确定。</> : <><strong>Edge orientation sum ≡ 0 mod 2.</strong> F/B quarter turns flip 4 edges; 12th is forced.</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>角稜奇偶性耦合。</strong> 一次面的 1/4 轉同時是角和稜的 4-cycle (奇置換),兩個奇偶性永遠同步 — 這就是 /2 的來源。</>) : (isZh ? <><strong>角棱奇偶性耦合。</strong> 一次面的 1/4 转同时是角和棱的 4-cycle (奇置换),两个奇偶性永远同步 — 这就是 /2 的来源。</> : <><strong>Corner-edge parity coupling.</strong> Every face quarter turn is a 4-cycle on both corner and edge ring (both odd) — they stay locked. This is the /2.</>)}</li>
            </ul>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>宇宙年齡對比。</strong> 宇宙年齡 ~4.36 × 10¹⁷ 秒。每秒數 1 個魔方狀態,要 ~1.37 萬億年 ≈ <strong>宇宙年齡的 100 倍</strong>。</>) : (isZh
                                              ? <><strong>宇宙年龄对比。</strong> 宇宙年龄 ~4.36 × 10¹⁷ 秒。每秒数 1 个魔方状态,要 ~1.37 万亿年 ≈ <strong>宇宙年龄的 100 倍</strong>。</>
                                              : <><strong>Universe scale.</strong> Universe is ~4.36 × 10¹⁷ s old. Enumerate one state per second: <strong>1.37 trillion years ≈ 100× the age of the universe</strong>.</>)}
            </p>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>資訊理論。</strong> 唯一編碼一個狀態需要 log₂(4.3 × 10¹⁹) ≈ <strong>65.22 bits</strong> ≈ 9 位元組。</>) : (isZh
                                              ? <><strong>信息论。</strong> 唯一编码一个状态需要 log₂(4.3 × 10¹⁹) ≈ <strong>65.22 bits</strong> ≈ 9 字节。</>
                                              : <><strong>Info-theoretic.</strong> Identifying a state takes log₂(4.3 × 10¹⁹) ≈ <strong>65.22 bits</strong> ≈ 9 bytes.</>)}
            </p>
          </Section>

          <Section id="gods-number" titleZh="God's number 演化 (1981-2010)" titleEn="God's Number Evolution (1981-2010)" isZh={isZh}>
            <p>
              {i18n.language === 'zh-Hant' ? (<>「God's number」是魔方群在指定度量下的 Cayley graph 直徑,也就是最壞情況下的最優解長度。<strong>1981 年 Thistlethwaite 給出第一個上界 52 HTM</strong>,29 年後 Rokicki / Kociemba / Davidson / Dethridge (2010) 用 ~35 CPU-年的 Google 算力把 HTM 上界證到 <strong>20</strong>,而且至少有一個狀態 (superflip composite) 恰好需要 20。</>) : (isZh
                                              ? <>「God's number」是魔方群在指定度量下的 Cayley graph 直径,也就是最坏情况下的最优解长度。<strong>1981 年 Thistlethwaite 给出第一个上界 52 HTM</strong>,29 年后 Rokicki / Kociemba / Davidson / Dethridge (2010) 用 ~35 CPU-年的 Google 算力把 HTM 上界证到 <strong>20</strong>,而且至少有一个状态 (superflip composite) 恰好需要 20。</>
                                              : <>God's number is the Cayley graph diameter of the cube group under the chosen metric. <strong>Thistlethwaite (1981) gave the first upper bound, 52 HTM</strong>. 29 years later Rokicki et al. (2010) used ~35 CPU-years of Google compute to push HTM to <strong>exactly 20</strong>, with at least one position (superflip composite) requiring exactly 20.</>)}
            </p>
            <div className="pred-method-table-wrap">
              <table className="pred-fit-table">
                <thead><tr><th>{tr({ zh: '年份', en: 'Year' })}</th><th>{tr({ zh: 'HTM 上界', en: 'HTM bound' })}</th><th>{tr({ zh: '证明者', en: 'By',
                    zhHant: "證明者"
                })}</th><th>{tr({ zh: '方法', en: 'Method' })}</th></tr></thead>
                <tbody>
                  {GODS_NUMBER_HISTORY.map((g) => (
                    <tr key={g.year}><td>{g.year}</td><td className="pred-num"><strong>{g.bound_htm}</strong></td><td>{g.who}</td><td>{isZh ? g.note_zh : g.note_en}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul>
              <li><strong>HTM = 20</strong> (Rokicki et al. 2010, SIAM J. Discrete Math. 27(2))</li>
              <li><strong>QTM = 26</strong> (Rokicki & Davidson 2014; superflip × 4-spot)</li>
              <li><strong>STM</strong> {tr({ zh: '尚未确定 (16 ≤ ? ≤ 20)', en: 'unsettled (16 ≤ ? ≤ 20)',
                  zhHant: "尚未確定 (16 ≤ ? ≤ 20)"
            })};superflip {tr({ zh: '在 STM 下 16 步即可解', en: 'is 16-STM-solvable' })}</li>
              <li><strong>NxN Θ(N² / log N)</strong> (Demaine et al. 2011, arXiv:1106.5736)</li>
              <li><strong>NxN optimal solving NP-complete</strong> (Demaine, Eisenstat, Rudoy 2017)</li>
            </ul>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>Superflip</strong> (8 角正確,12 稜原位翻轉) 是著名的 20-HTM-難態,位於魔方群的中心。STM 下只要 16 步即可解 — 這是「STM God's number 不可能小於 16」的下界。</>) : (isZh
                                              ? <><strong>Superflip</strong> (8 角正确,12 棱原位翻转) 是著名的 20-HTM-难态,位于魔方群的中心。STM 下只要 16 步即可解 — 这是「STM God's number 不可能小于 16」的下界。</>
                                              : <><strong>Superflip</strong> (8 corners correct, 12 edges flipped in place) is the classic 20-HTM-hard position; sits in the center of the cube group. Solvable in just 16 STM — source of the 16-STM lower-bound.</>)}
            </p>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>Two-phase 演算法 (Kociemba 1992)。</strong> Phase 1 把狀態約簡到子群 H = ⟨U, D, R², L², F², B²⟩,Phase 2 在 H 內求解。Phase 1 餘類數 = |G|/|H| = 2,217,093,120。現代 Cube Explorer 和 nissy 是最優解器的兩個標杆。</>) : (isZh
                                              ? <><strong>Two-phase 算法 (Kociemba 1992)。</strong> Phase 1 把状态约简到子群 H = ⟨U, D, R², L², F², B²⟩,Phase 2 在 H 内求解。Phase 1 余类数 = |G|/|H| = 2,217,093,120。现代 Cube Explorer 和 nissy 是最优解器的两个标杆。</>
                                              : <><strong>Two-phase (Kociemba 1992).</strong> Phase 1 reduces to subgroup H = ⟨U, D, R², L², F², B²⟩; phase 2 within H. Phase 1 coset count = 2,217,093,120. Cube Explorer + Tronto's nissy are modern optimal-solver standards.</>)}
            </p>
          </Section>

          <Section id="optimal-dist" titleZh="随机打乱的最优 HTM 分布" titleEn="Random Scramble Optimal HTM Distribution" isZh={isZh}>
            <p>
              {i18n.language === 'zh-Hant' ? (<>cube20.org 全狀態列舉給出的分佈。<strong>67% 的隨機打亂需要正好 18 HTM 最優解</strong>,平均 17.92 HTM,中位 18。只有 ~4.9 × 10⁸ 個狀態需要 20 HTM (~10⁻¹¹)。</>) : (isZh
                                              ? <>cube20.org 全状态枚举给出的分布。<strong>67% 的随机打乱需要正好 18 HTM 最优解</strong>,平均 17.92 HTM,中位 18。只有 ~4.9 × 10⁸ 个状态需要 20 HTM (~10⁻¹¹)。</>
                                              : <>cube20.org full enumeration: <strong>67% need exactly 18 HTM</strong>; mean 17.92, median 18. Only ~4.9 × 10⁸ states need 20 HTM (~10⁻¹¹).</>)}
            </p>
            <LineChart
              series={[{ name: 'P (random scramble)', color: '#2f6fd8', data: OPTIMAL_HTM_DISTRIBUTION.map((d) => ({ x: d.htm, y: d.fraction })) }]}
              yLabel="P(random)"
              xLabel="optimal HTM depth"
              yMin={0}
              yFormat={(v) => (v >= 0.01 ? (v * 100).toFixed(1) + '%' : (v * 100).toExponential(0) + '%')}
            />
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>對單次 WR 的含義。</strong> 頂級 CFOP 選手實際 50-58 STM,ZB 選手 48-52 STM,都是最優 HTM 的 2-3 倍。「幸運打亂」一般意味著抽到一個能用 X-cross / XX-cross 或者天然跳過 OLL/PLL 的低最優值打亂。Du 3.47 那把打亂最優是 18 HTM,Du 實際走了 28 STM 的方法路徑 — 這不違反 God's number,因為 CFOP/ZB 本身就要為方法結構額外付出 10-20 步。</>) : (isZh
                                              ? <><strong>对单次 WR 的含义。</strong> 顶级 CFOP 选手实际 50-58 STM,ZB 选手 48-52 STM,都是最优 HTM 的 2-3 倍。「幸运打乱」一般意味着抽到一个能用 X-cross / XX-cross 或者天然跳过 OLL/PLL 的低最优值打乱。Du 3.47 那把打乱最优是 18 HTM,Du 实际走了 28 STM 的方法路径 — 这不违反 God's number,因为 CFOP/ZB 本身就要为方法结构额外付出 10-20 步。</>
                                              : <><strong>Implication for single WRs.</strong> Top CFOP 50-58 STM, ZB 48-52 STM — both 2-3× optimal. A "lucky scramble" = low-optimal scramble admitting X-cross / XX-cross or natural skips. Du's scramble had optimal HTM = 18, his CFOP path was 28 STM — no violation of God's number; CFOP pays a +10-20 STM method tax.</>)}
            </p>

            {!isZh && <Longform text={SOLVER_SOFTWARE_EN} />}
          </Section>

          <Section id="metrics" titleZh="度量学: HTM vs STM vs QTM vs ATM" titleEn="Metrics: HTM vs STM vs QTM vs ATM" isZh={isZh}>
            <p>{tr({ zh: '不同度量学算不同的事:', en: 'Different metrics count different things:',
                zhHant: "不同度量學算不同的事:"
            })}</p>
            <div className="pred-method-table-wrap">
              <table className="pred-fit-table">
                <thead><tr><th>{tr({ zh: '度量', en: 'Metric' })}</th><th>R</th><th>R'</th><th>R2</th><th>M</th><th>R + L</th><th>{tr({ zh: '说明', en: 'Meaning',
                    zhHant: "說明"
                })}</th></tr></thead>
                <tbody>
                  <tr><td><strong>HTM</strong></td><td>1</td><td>1</td><td>1</td><td>2</td><td>2</td><td>{tr({ zh: '面 turn 计 1; 学术默认', en: 'face turn = 1; academic default',
                      zhHant: "面 turn 計 1; 學術預設"
                })}</td></tr>
                  <tr><td><strong>QTM</strong></td><td>1</td><td>1</td><td>2</td><td>4</td><td>2</td><td>{tr({ zh: '只算 90°', en: 'quarter-turn only' })}</td></tr>
                  <tr><td><strong>STM</strong></td><td>1</td><td>1</td><td>1</td><td>1</td><td>2</td><td>{tr({ zh: 'slice 计 1; 人类自然', en: 'slice = 1; natural human',
                      zhHant: "slice 計 1; 人類自然"
                })}</td></tr>
                  <tr><td><strong>ATM</strong></td><td>1</td><td>1</td><td>1</td><td>1</td><td><strong>1</strong></td><td>{tr({ zh: 'R+L 同时算 1 步,体现双手同步', en: 'axial; R+L = 1',
                      zhHant: "R+L 同時算 1 步,體現雙手同步"
                })}</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>STM 是速擰的自然度量。</strong> M / M' / M2 是「拇指 + 無名指」的單指動作,物理上一個動作。HTM 把它當 2 步,跟手部動作的實際負擔對不上。本文 TPS 和步數全用 STM。HTM 用於學術,QTM 用於群論。</>) : (isZh
                                              ? <><strong>STM 是速拧的自然度量。</strong> M / M' / M2 是「拇指 + 无名指」的单指动作,物理上一个动作。HTM 把它当 2 步,跟手部动作的实际负担对不上。本文 TPS 和步数全用 STM。HTM 用于学术,QTM 用于群论。</>
                                              : <><strong>STM is the natural cubing metric.</strong> M is a single thumb-ring fingertrick — HTM counting it as 2 face turns is wrong for biomech. All TPS / move counts use STM here. HTM for academic, QTM for group theory.</>)}
            </p>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>HTM → STM 換算。</strong> CFOP 用 slice 少,HTM ≈ STM。Roux 的 M-slice 多,HTM 比 STM 高 5-10%。跨方法比較步數必須先統一到 STM,否則 Roux 的 48 STM 會被誤顯示成 53 HTM。</>) : (isZh
                                              ? <><strong>HTM → STM 换算。</strong> CFOP 用 slice 少,HTM ≈ STM。Roux 的 M-slice 多,HTM 比 STM 高 5-10%。跨方法比较步数必须先统一到 STM,否则 Roux 的 48 STM 会被误显示成 53 HTM。</>
                                              : <><strong>HTM→STM conversion.</strong> CFOP slice-rare so HTM ≈ STM. Roux relies on M-slice; HTM exceeds STM by 5-10%. Cross-method comparison must normalize to STM, or Roux's 48 STM shows as 53 HTM.</>)}
            </p>

            {!isZh && <Longform text={MATH_DETAIL_EN} />}
          </Section>

          <Section id="method-cfop" titleZh="CFOP 解剖学: Cross → F2L → OLL → PLL" titleEn="CFOP Anatomy: Cross → F2L → OLL → PLL" isZh={isZh}>
            <p>
              {i18n.language === 'zh-Hant' ? (<>CFOP 由 Jessica Fridrich 1997 年公開,跟 Hans Dockhorn 和 Anneke Treep 等人 1980 年代的獨立工作匯流,共 <strong>119 個核心演算法</strong> (41 F2L + 57 OLL + 21 PLL),頂級實際跑 ~<strong>57.5 HTM</strong>。23 年 WR 歷程裡絕對的主流方法。</>) : (isZh
                                              ? <>CFOP 由 Jessica Fridrich 1997 年公开,跟 Hans Dockhorn 和 Anneke Treep 等人 1980 年代的独立工作汇流,共 <strong>119 个核心算法</strong> (41 F2L + 57 OLL + 21 PLL),顶级实际跑 ~<strong>57.5 HTM</strong>。23 年 WR 历程里绝对的主流方法。</>
                                              : <>CFOP, published by Jessica Fridrich 1997 with 1980s independent work by Hans Dockhorn and Anneke Treep, <strong>119 core algorithms</strong> (41 F2L + 57 OLL + 21 PLL), <strong>~57.5 HTM</strong> at speed. Dominant method behind 23 years of WRs.</>)}
            </p>
            <div className="pred-method-table-wrap">
              <table className="pred-fit-table pred-method-table">
                <thead><tr><th>{tr({ zh: '步骤', en: 'Step',
                    zhHant: "步驟"
                })}</th><th>{tr({ zh: '算法数', en: 'Algs',
                    zhHant: "演算法數"
                })}</th><th>{tr({ zh: '平均 STM', en: 'Avg STM' })}</th><th>{tr({ zh: '识别 (s)', en: 'Recog (s)',
                    zhHant: "識別 (s)"
                })}</th><th>{tr({ zh: '顶级耗时 (s)', en: 'Top time (s)',
                    zhHant: "頂級耗時 (s)"
                })}</th><th>{tr({ zh: '描述', en: 'Description' })}</th></tr></thead>
                <tbody>
                  {CFOP_BREAKDOWN.map((s) => (
                    <tr key={s.step}>
                      <td><strong>{isZh ? s.step_zh : s.step}</strong></td>
                      <td className="pred-num">{s.alg_count}</td>
                      <td className="pred-num">{s.avg_stm}</td>
                      <td className="pred-num">{s.recognition_s.toFixed(2)}</td>
                      <td className="pred-num">{s.avg_time_s.toFixed(2)}</td>
                      <td>{isZh ? s.description_zh : s.description_en}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>色中性 (CN) 的收益。</strong> 固定顏色 cross 平均 5.81 HTM,全色中性 (CN) <strong>4.81 HTM</strong>。關鍵不是均值差,是 P(≤ 4 步 cross) 從固定色 5.99% 跳到 CN 29.17% — <strong>5 倍簡單 cross</strong>。這就是 CN 在頂級普及的原因。</>) : (isZh
                                              ? <><strong>色中性 (CN) 的收益。</strong> 固定颜色 cross 平均 5.81 HTM,全色中性 (CN) <strong>4.81 HTM</strong>。关键不是均值差,是 P(≤ 4 步 cross) 从固定色 5.99% 跳到 CN 29.17% — <strong>5 倍简单 cross</strong>。这就是 CN 在顶级普及的原因。</>
                                              : <><strong>Cross color neutrality (CN).</strong> Fixed color 5.81 HTM avg, full CN <strong>4.81</strong>. The win isn't the mean — P(≤4-move cross) jumps from 5.99% to <strong>29.17%</strong>, ~5× as many easy crosses. Why CN is universal at the top.</>)}
            </p>
            <p>{i18n.language === 'zh-Hant' ? (<><strong>F2L 41 種 case</strong> 平均 6.7 STM/槽,4 槽合計 26.8 STM。頂級選手的 F2L:</>) : (isZh ? <><strong>F2L 41 种 case</strong> 平均 6.7 STM/槽,4 槽合计 26.8 STM。顶级选手的 F2L:</> : <><strong>F2L 41 cases</strong>, 6.7 STM/slot avg, 26.8 total. Elite F2L tricks:</>)}</p>
            <ul>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>Pseudoslotting</strong>: 把 F 或 B 面錯位 90° 當作起手。</>) : (isZh ? <><strong>Pseudoslotting</strong>: 把 F 或 B 面错位 90° 当作起手。</> : <><strong>Pseudoslotting</strong>: misalign F or B by 90° as setup.</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>Multislotting</strong>: 一組動作同時解兩對 F2L。</>) : (isZh ? <><strong>Multislotting</strong>: 一组动作同时解两对 F2L。</> : <><strong>Multislotting</strong>: one sequence inserts two pairs.</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>EO-during-F2L</strong>: 即 ZBLS,最後一對 F2L 同時控 EO。</>) : (isZh ? <><strong>EO-during-F2L</strong>: 即 ZBLS,最后一对 F2L 同时控 EO。</> : <><strong>EO-during-F2L</strong>: i.e. ZBLS, last pair while orienting LL edges.</>)}</li>
            </ul>

            {!isZh && <Longform text={CFOP_DETAIL_EN} />}
          </Section>

          <Section id="method-oll" titleZh="OLL 57 case 全表" titleEn="OLL: All 57 Cases" isZh={isZh}>
            <p>{i18n.language === 'zh-Hant' ? (<><strong>57 種 case</strong>,演算法長度 STM 7-14 不等:</>) : (isZh ? <><strong>57 种 case</strong>,算法长度 STM 7-14 不等:</> : <><strong>57 cases</strong>, alg lengths 7-14 STM:</>)}</p>
            <LineChart
              series={[{ name: 'cases', color: '#0a8a6b', data: OLL_BY_STM.map((d) => ({ x: d.stm, y: d.case_count })) }]}
              yLabel={tr({ zh: 'case 数', en: 'case count',
                  zhHant: "case 數"
            })} xLabel="STM" yMin={0}
              yFormat={(v) => v.toFixed(0)}
            />
            <p>{i18n.language === 'zh-Hant' ? (<><strong>雙峰</strong>: 9 STM (14 個 case) 和 11 STM (10 個 case) 是高點;14 STM 只 1 個 (Dot OLL #57)。<strong>Sune / Anti-Sune (#26/27) 是經典的 7 步</strong>。</>) : (isZh ? <><strong>双峰</strong>: 9 STM (14 个 case) 和 11 STM (10 个 case) 是高点;14 STM 只 1 个 (Dot OLL #57)。<strong>Sune / Anti-Sune (#26/27) 是经典的 7 步</strong>。</> : <><strong>Bimodal</strong>: 9 STM (14) and 11 STM (10) peak; only OLL #57 (Dot) at 14. <strong>Sune / Antisune (#26/27) classic 7-move</strong>.</>)}</p>
          </Section>

          <Section id="method-pll" titleZh="PLL 21 case 全表" titleEn="PLL: All 21 Cases" isZh={isZh}>
            <p>{i18n.language === 'zh-Hant' ? (<><strong>21 種 case</strong> (4 對映象 → 17 個獨立演算法)。均長 12.5 STM:</>) : (isZh ? <><strong>21 种 case</strong> (4 对镜像 → 17 个独立算法)。均长 12.5 STM:</> : <><strong>21 cases</strong> (4 mirror pairs → 17 independent algs). Mean 12.5 STM:</>)}</p>
            <div className="pred-method-table-wrap">
              <table className="pred-fit-table pred-method-table">
                <thead><tr><th>{tr({ zh: '字母', en: 'Letter' })}</th><th>{tr({ zh: '名称', en: 'Name',
                    zhHant: "名稱"
                })}</th><th>STM</th><th>P</th><th>{tr({ zh: '识别', en: 'Recog',
                    zhHant: "識別"
                })}</th><th>{tr({ zh: '算法', en: 'Alg',
                    zhHant: "演算法"
                })}</th></tr></thead>
                <tbody>
                  {PLL_TABLE.map((p) => (
                    <tr key={p.letter}>
                      <td><strong>{p.letter}</strong></td>
                      <td>{p.name}</td>
                      <td className="pred-num">{p.stm}</td>
                      <td className="pred-num">{p.prob}</td>
                      <td className="pred-num">{p.recog_s.toFixed(1)}s</td>
                      <td className="pred-num-small"><code>{p.alg}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>{i18n.language === 'zh-Hant' ? (<><strong>4 個 PLL 視覺樣本</strong>:</>) : (isZh ? <><strong>4 个 PLL 视觉样本</strong>:</> : <><strong>4 iconic PLL previews</strong>:</>)}</p>
            <div className="pred-pll-gallery">
              <PllPreview letter="T" alg="R U R' U' R' F R2 U' R' U' R U R' F'" isZh={isZh} note_en="Adjacent corner + adjacent edge swap" note_zh="角对角 + 棱相邻换" />
              <PllPreview letter="Ja" alg="x R2 F R F' R U2 r' U r U2 x'" isZh={isZh} note_en="Adjacent corner swap, no edge cycle" note_zh="角相邻换,无棱循环" />
              <PllPreview letter="H" alg="M2 U M2 U2 M2 U M2" isZh={isZh} note_en="4-fold symmetric edge swap; rarest PLL" note_zh="4 重对称棱换;最罕见 PLL" />
              <PllPreview letter="Y" alg="F R U' R' U' R U R' F' R U R' U' R' F R F'" isZh={isZh} note_en="Corner diag + edge diag (Y on side)" note_zh="角斜 + 棱斜 (侧面 Y 形)" />
            </div>

            {!isZh && <Longform text={ALGORITHMS_CATALOG_EN} />}
          </Section>

          <Section id="method-zb" titleZh="ZB / ZBLS / ZBLL — 顶级方法栈" titleEn="ZB / ZBLS / ZBLL — The Elite Stack" isZh={isZh}>
            <p>
              {i18n.language === 'zh-Hant' ? (<>ZB 方法把 CFOP 的 OLL + PLL 替換為 <strong>ZBLS (302-303 個 case)</strong> + <strong>ZBLL (493 個 case)</strong>。ZBLS 解最後一對 F2L 的同時把 LL 4 稜朝向也解掉;ZBLL 在 EO 已知的前提下 1 個演算法解掉整個 LL。</>) : (isZh
                                              ? <>ZB 方法把 CFOP 的 OLL + PLL 替换为 <strong>ZBLS (302-303 个 case)</strong> + <strong>ZBLL (493 个 case)</strong>。ZBLS 解最后一对 F2L 的同时把 LL 4 棱朝向也解掉;ZBLL 在 EO 已知的前提下 1 个算法解掉整个 LL。</>
                                              : <>ZB replaces CFOP's OLL + PLL with <strong>ZBLS (302-303 cases)</strong> + <strong>ZBLL (493 cases)</strong>. ZBLS solves last pair while orienting LL edges; ZBLL solves entire LL in one alg given EO.</>)}
            </p>
            <p>{i18n.language === 'zh-Hant' ? (<><strong>ZBLL 8 個子集</strong>:</>) : (isZh ? <><strong>ZBLL 8 个子集</strong>:</> : <><strong>ZBLL 8 sub-families</strong>:</>)}</p>
            <div className="pred-method-table-wrap">
              <table className="pred-fit-table">
                <thead><tr><th>{tr({ zh: '子集', en: 'COLL' })}</th><th>{tr({ zh: 'case 数', en: 'cases',
                    zhHant: "case 數"
                })}</th><th>{(i18n.language.startsWith('zh') ? 'STM' : 'STM')}</th><th>{tr({ zh: '说明', en: 'Description',
                    zhHant: "說明"
                })}</th></tr></thead>
                <tbody>
                  {ZBLL_GROUPS.map((g) => (
                    <tr key={g.coll}><td><strong>{g.coll}</strong></td><td className="pred-num">{g.count}</td><td className="pred-num">{g.avg_stm.toFixed(1)}</td><td>{isZh ? g.description_zh : g.description_en}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>ZBLS + ZBLL 合計 ~795-798 個演算法</strong>。現役全 ZB 使用者: <strong>Xuanyi Geng</strong> (Ao5 WR 3.71),<strong>Qixian Cao</strong> (Worlds 2025 5.07),<strong>Tymon Kolasiński</strong>。Wang 3.08 和 Park 3.13 走的是 CFOP + 部分 ZBLL,不是全 ZB。</>) : (isZh
                                              ? <><strong>ZBLS + ZBLL 合计 ~795-798 个算法</strong>。现役全 ZB 用户: <strong>Xuanyi Geng</strong> (Ao5 WR 3.71),<strong>Qixian Cao</strong> (Worlds 2025 5.07),<strong>Tymon Kolasiński</strong>。Wang 3.08 和 Park 3.13 走的是 CFOP + 部分 ZBLL,不是全 ZB。</>
                                              : <><strong>Total ZBLS + ZBLL = ~795-798 algs</strong>. Full-ZB users: <strong>Xuanyi Geng</strong> (Ao5 WR 3.71), <strong>Qixian Cao</strong> (Worlds 2025 5.07), <strong>Tymon Kolasiński</strong>. Wang and Park are CFOP + partial ZBLL.</>)}
            </p>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>1LLL</strong> — 把整個 OLL+PLL 合到一個演算法裡,<strong>3,915 個 case</strong>。<strong>Eduardo Silva Damasceno 2022 年第一個完整學完</strong>。<em>WR 水平上沒人用</em> — 識別要 0.8-1.4 秒,比 OLL+PLL 拆兩步 (0.4+0.4) 還慢。1LLL 撞到的是「演算法學習極限」,不是「速擰極限」。</>) : (isZh
                                              ? <><strong>1LLL</strong> — 把整个 OLL+PLL 合到一个算法里,<strong>3,915 个 case</strong>。<strong>Eduardo Silva Damasceno 2022 年第一个完整学完</strong>。<em>WR 水平上没人用</em> — 识别要 0.8-1.4 秒,比 OLL+PLL 拆两步 (0.4+0.4) 还慢。1LLL 撞到的是「算法学习极限」,不是「速拧极限」。</>
                                              : <><strong>1LLL</strong> — full OLL+PLL in one alg, <strong>3,915 cases</strong>. <strong>Eduardo Silva Damasceno first fully learned in 2022</strong>. <em>Nobody uses it at WR speed</em> — recognition 0.8-1.4s slower than OLL+PLL split. 1LLL is the "alg-learning limit" not the "speedcubing limit".</>)}
            </p>
          </Section>

          <Section id="method-roux" titleZh="Roux / ZZ / Petrus / Mehta — 非 CFOP 派" titleEn="Roux / ZZ / Petrus / Mehta — Non-CFOP" isZh={isZh}>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>Roux (Gilles Roux, 2003)。</strong> 4 步: 左 1×2×3 → 右 1×2×3 → CMLL (42 個演算法) → LSE (用 M, U 解最後 6 稜)。平均 <strong>~48 STM</strong>。<strong>單次從未破過 4 秒</strong>;M-slice 持續 TPS &lt; 7。頂級 Roux 使用者: Kian Mansour, Sean Patrick Villanueva, Alexey Tsvetkov (3.95 — 唯一一次 sub-4 Roux 單次)。</>) : (isZh
                                              ? <><strong>Roux (Gilles Roux, 2003)。</strong> 4 步: 左 1×2×3 → 右 1×2×3 → CMLL (42 个算法) → LSE (用 M, U 解最后 6 棱)。平均 <strong>~48 STM</strong>。<strong>单次从未破过 4 秒</strong>;M-slice 持续 TPS &lt; 7。顶级 Roux 用户: Kian Mansour, Sean Patrick Villanueva, Alexey Tsvetkov (3.95 — 唯一一次 sub-4 Roux 单次)。</>
                                              : <><strong>Roux (Gilles Roux 2003).</strong> 4 steps: left 1x2x3 → right 1x2x3 → CMLL (42) → LSE (M, U for last 6 edges). <strong>~48 STM</strong>. <strong>Never broke sub-4 single</strong>; M-slice sustained TPS &lt; 7. Top Roux: Kian Mansour, Sean Patrick Villanueva, Alexey Tsvetkov (3.95 — only sub-4 Roux ever).</>)}
            </p>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>ZZ (2006)。</strong> 起手 <strong>EOLine</strong> 把 12 稜朝向 + DF/DB pair 一次性解掉,F2L 只用 R/U/L。演算法量 28 (ZZ-A) 到 493 (ZZ+ZBLL)。<strong>從未拿過 WR</strong> — EOLine 在 15 秒 inspection 內規劃極難。</>) : (isZh
                                              ? <><strong>ZZ (2006)。</strong> 起手 <strong>EOLine</strong> 把 12 棱朝向 + DF/DB pair 一次性解掉,F2L 只用 R/U/L。算法量 28 (ZZ-A) 到 493 (ZZ+ZBLL)。<strong>从未拿过 WR</strong> — EOLine 在 15 秒 inspection 内规划极难。</>
                                              : <><strong>ZZ (2006).</strong> Opens with <strong>EOLine</strong> (12 edges oriented + DF/DB pair in one step); F2L uses only R/U/L. Algs 28-493. <strong>Never held WR</strong> — EOLine inspection planning is brutally hard.</>)}
            </p>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>Petrus (Lars Petrus, 1981)。</strong> 7 步: 2×2×2 → 2×2×3 → EO → F2L → COLL → CPLL → EPLL,~45 STM。CFOP 興起前是使用者數第二的方法,2004 之後式微。</>) : (isZh
                                              ? <><strong>Petrus (Lars Petrus, 1981)。</strong> 7 步: 2×2×2 → 2×2×3 → EO → F2L → COLL → CPLL → EPLL,~45 STM。CFOP 兴起前是用户数第二的方法,2004 之后式微。</>
                                              : <><strong>Petrus (Lars Petrus 1981).</strong> 7 steps; ~45 STM. #2 method pre-CFOP era; declined after 2004.</>)}
            </p>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>Mehta (Yash Mehta, 2020)。</strong> FB → 3QB → EOLE → 4 種結束。Mehta-TDR 的 843 個演算法是目前提出過的速擰方法裡演算法量最大的。社羣不大,top-50 裡沒人用。</>) : (isZh
                                              ? <><strong>Mehta (Yash Mehta, 2020)。</strong> FB → 3QB → EOLE → 4 种结束。Mehta-TDR 的 843 个算法是目前提出过的速拧方法里算法量最大的。社区不大,top-50 里没人用。</>
                                              : <><strong>Mehta (Yash Mehta 2020).</strong> FB → 3QB → EOLE → 4 finishes. Mehta-TDR's 843 algs is the highest-alg-count speed method proposed. Small community, no top-50 user.</>)}
            </p>
          </Section>

          <Section id="lookahead" titleZh="F2L lookahead — 顶级速度的真正瓶颈" titleEn="F2L Lookahead — The Real Bottleneck" isZh={isZh}>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>Lookahead</strong> = 執行第 N 對的同時,眼睛已經在追第 N+1 對。<strong>故意把執行放慢,給眼睛留出反應時間,總時間反而更快</strong>。Zemdegs 的 CubeSkills 分三階段:</>) : (isZh
                                              ? <><strong>Lookahead</strong> = 执行第 N 对的同时,眼睛已经在追第 N+1 对。<strong>故意把执行放慢,给眼睛留出反应时间,总时间反而更快</strong>。Zemdegs 的 CubeSkills 分三阶段:</>
                                              : <><strong>Lookahead</strong> = executing pair N while eyes track pair N+1. <strong>Deliberately slow execution; total time drops</strong>. Zemdegs CubeSkills splits into 3 stages:</>)}
            </p>
            <ul>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>Spotting</strong>: 暫停後用眼睛找 (新手 / 中階)。</>) : (isZh ? <><strong>Spotting</strong>: 暂停后用眼睛找 (新手 / 中阶)。</> : <><strong>Spotting</strong>: pause, find with eyes (beginner/intermediate).</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>Tracking</strong>: 轉動中眼睛追 (sub-12+)。</>) : (isZh ? <><strong>Tracking</strong>: 转动中眼睛追 (sub-12+)。</> : <><strong>Tracking</strong>: eyes follow during turns (sub-12+).</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>Knowing</strong>: 不看就能推斷位置 (sub-8 頂尖)。</>) : (isZh ? <><strong>Knowing</strong>: 不看就能推断位置 (sub-8 顶尖)。</> : <><strong>Knowing</strong>: predict location no-look (sub-8 elite).</>)}</li>
            </ul>
            <p>{i18n.language === 'zh-Hant' ? (<><strong>lookahead 失效的三種情形</strong>: 幸運打亂, multislotting, pseudoslotting。</>) : (isZh ? <><strong>lookahead 失效的三种情形</strong>: 幸运打乱, multislotting, pseudoslotting。</> : <><strong>3 lookahead failure modes</strong>: lucky scrambles, multislotting, pseudoslotting.</>)}</p>
          </Section>

          <Section id="inspection" titleZh="Inspection 运筹 — 15 秒怎么用" titleEn="Inspection — How to Spend 15 Seconds" isZh={isZh}>
            <p>{i18n.language === 'zh-Hant' ? (<><strong>WCA A3</strong>: inspection 上限 15 秒,16-17 秒 +2,≥ 17 秒 DNF。頂級選手流程:</>) : (isZh ? <><strong>WCA A3</strong>: inspection 上限 15 秒,16-17 秒 +2,≥ 17 秒 DNF。顶级选手流程:</> : <><strong>WCA A3</strong>: 15s cap, 16-17s +2, ≥17s DNF. Elite flow:</>)}</p>
            <ol>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>0-5 秒</strong>: 掃色中性,鎖定最優 cross 顏色。</>) : (isZh ? <><strong>0-5 秒</strong>: 扫色中性,锁定最优 cross 颜色。</> : <><strong>0-5 s</strong>: CN scan, lock best cross color.</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>5-11 秒</strong>: 規劃完整 cross 序列 (6-8 步,ergo-optimal)。</>) : (isZh ? <><strong>5-11 秒</strong>: 规划完整 cross 序列 (6-8 步,ergo-optimal)。</> : <><strong>5-11 s</strong>: plan full cross (6-8 moves, ergo-optimal).</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>11-14 秒</strong>: 定位第一對 F2L。</>) : (isZh ? <><strong>11-14 秒</strong>: 定位第一对 F2L。</> : <><strong>11-14 s</strong>: locate first F2L pair.</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>15 秒</strong>: 確認握姿,啟動 StackMat。</>) : (isZh ? <><strong>15 秒</strong>: 确认握姿,启动 StackMat。</> : <><strong>15 s</strong>: confirm grip, start StackMat.</>)}</li>
            </ol>
            <p>{i18n.language === 'zh-Hant' ? (<><strong>X-cross inspection</strong> 是難度最高也回報最大的。<strong>CN 選手比固定色看到 X-cross 的機率多 ~5 倍</strong>。</>) : (isZh ? <><strong>X-cross inspection</strong> 是难度最高也回报最大的。<strong>CN 选手比固定色看到 X-cross 的概率多 ~5 倍</strong>。</> : <><strong>X-cross inspection</strong> is the hardest, most rewarding skill. <strong>CN cubers see X-cross ~5× more often</strong>.</>)}</p>
          </Section>

          <Section id="skips" titleZh="幸运打乱 + skip 概率" titleEn="Lucky Scrambles + Skip Probability" isZh={isZh}>
            <div className="pred-method-table-wrap">
              <table className="pred-fit-table pred-method-table">
                <thead><tr><th>{tr({ zh: '事件', en: 'Event' })}</th><th>P</th><th>%</th><th>{tr({ zh: '说明', en: 'Note',
                    zhHant: "說明"
                })}</th></tr></thead>
                <tbody>
                  {SKIP_PROBABILITIES.map((s) => (
                    <tr key={s.event_en}>
                      <td>{isZh ? s.event_zh : s.event_en}</td>
                      <td className="pred-num"><code>1/{Math.round(1 / s.p)}</code></td>
                      <td className="pred-num"><strong>{s.p_pct.toFixed(3)}%</strong></td>
                      <td className="pred-num-small">{isZh ? s.note_zh : s.note_en}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>P(LL skip) = 1/216 × 1/72 = 1/15,552 ≈ 0.00643%</strong>。頂級選手一生 ~10⁶ 次解裡,期望出現 60 次。Du 3.47 和 Park 3.13 都吃到 PLL skip。<strong>Zajder 2.76 沒靠 skip</strong> — 而是用 XX-cross + ZBLL 把 STM 壓到 29。</>) : (isZh
                                              ? <><strong>P(LL skip) = 1/216 × 1/72 = 1/15,552 ≈ 0.00643%</strong>。顶级选手一生 ~10⁶ 次解里,期望出现 60 次。Du 3.47 和 Park 3.13 都吃到 PLL skip。<strong>Zajder 2.76 没靠 skip</strong> — 而是用 XX-cross + ZBLL 把 STM 压到 29。</>
                                              : <><strong>P(LL skip) = 1/216 × 1/72 = 1/15,552 ≈ 0.00643%</strong>. Top cuber career ~10⁶ solves → ~60 expected. Du 3.47 / Park 3.13 had PLL skip. <strong>Zajder 2.76 didn't use skip</strong> — XX-cross + ZBLL gave 29 STM.</>)}
            </p>
          </Section>

          <Section id="hardware" titleZh="硬件 1980-2026" titleEn="Hardware 1980-2026" isZh={isZh}>
            <p>
              {i18n.language === 'zh-Hant' ? (<>46 年硬體演化分四段: <strong>1980-2010 原始期</strong> (原版 Rubik / Type-A) → <strong>2010-2014 現代速擰誕生</strong> (DaYan GuHong / ZhanChi / MoYu AoLong) → <strong>2016-2020 磁鐵革命</strong> (Cubicle Mod / GAN 356 Air UM / GAN 11 M Pro 核心磁) → <strong>2021-2026 磁場網路 + 智慧化</strong> (GAN 12-16 MagLev / MoYu Super RS3M)。</>) : (isZh
                                              ? <>46 年硬件演化分四段: <strong>1980-2010 原始期</strong> (原版 Rubik / Type-A) → <strong>2010-2014 现代速拧诞生</strong> (DaYan GuHong / ZhanChi / MoYu AoLong) → <strong>2016-2020 磁铁革命</strong> (Cubicle Mod / GAN 356 Air UM / GAN 11 M Pro 核心磁) → <strong>2021-2026 磁场网络 + 智能化</strong> (GAN 12-16 MagLev / MoYu Super RS3M)。</>
                                              : <>46 years in 4 eras: <strong>1980-2010 primitive</strong> → <strong>2010-2014 modern speedcube birth</strong> → <strong>2016-2020 magnet revolution</strong> → <strong>2021-2026 magnetic networks + smart cubes</strong>.</>)}
            </p>
            <div className="pred-method-table-wrap">
              <table className="pred-fit-table pred-method-table">
                <thead><tr><th>{tr({ zh: '年', en: 'Year' })}</th><th>{tr({ zh: '型号', en: 'Model',
                    zhHant: "型號"
                })}</th><th>{tr({ zh: '质量', en: 'Mass',
                    zhHant: "質量"
                })}</th><th>{tr({ zh: '磁铁数', en: 'Magnets',
                    zhHant: "磁鐵數"
                })}</th><th>{tr({ zh: '里程碑', en: 'Milestone' })}</th></tr></thead>
                <tbody>
                  <tr><td>1980</td><td>{tr({ zh: '原版 Rubik', en: "Original Rubik's" })}</td><td>~95 g</td><td>0</td><td>{tr({ zh: '弹簧+螺丝核心', en: 'spring+screw core',
                      zhHant: "彈簧+螺絲核心"
                })}</td></tr>
                  <tr><td>2007</td><td>{tr({ zh: 'Type-A 仿品', en: 'Type-A clones' })}</td><td>~85 g</td><td>0</td><td>{tr({ zh: '首批竞速级', en: 'first competitive non-Rubik\'s',
                      zhHant: "首批競速級"
                })}</td></tr>
                  <tr><td>2010</td><td>DaYan GuHong</td><td>~75 g</td><td>0</td><td>{tr({ zh: '反向 corner cutting 首批', en: 'first reverse corner cutting' })}</td></tr>
                  <tr><td>2011</td><td>DaYan ZhanChi</td><td>126 g</td><td>0</td><td>{tr({ zh: 'Torpedo, Feliks sub-6 用此', en: 'torpedoes, Feliks sub-6 era' })}</td></tr>
                  <tr><td>2013</td><td>MoYu WeiLong V1</td><td>~68 g</td><td>0</td><td>{tr({ zh: '结束 ZhanChi 主导', en: 'ended ZhanChi era',
                      zhHant: "結束 ZhanChi 主導"
                })}</td></tr>
                  <tr><td>2014</td><td>MoYu AoLong V2</td><td>~68 g</td><td>0</td><td>{tr({ zh: 'Du 3.47 用此 (无磁)', en: 'Du 3.47 cube (non-magnetic)',
                      zhHant: "Du 3.47 用此 (無磁)"
                })}</td></tr>
                  <tr><td>2016</td><td>{tr({ zh: 'TheCubicle 磁后装 Valk 3', en: 'Cubicle magnetic Valk 3',
                      zhHant: "TheCubicle 磁後裝 Valk 3"
                })}</td><td>~75 g</td><td>48</td><td>{tr({ zh: '首磁铁 WR (Valk 4.74)', en: 'first magnet WR (Valk 4.74)',
                    zhHant: "首磁鐵 WR (Valk 4.74)"
                })}</td></tr>
                  <tr><td>2017</td><td>GAN 356 Air UM</td><td>~67 g</td><td>48</td><td>{tr({ zh: '首批量产出厂磁铁', en: 'first factory-magnetized flagship',
                      zhHant: "首批次產出廠磁鐵"
                })}</td></tr>
                  <tr><td>2020</td><td>GAN 11 M Pro</td><td>63 g</td><td>64</td><td>{tr({ zh: '+8 对核心磁', en: '+8 core-to-corner magnet pairs',
                      zhHant: "+8 對核心磁"
                })}</td></tr>
                  <tr><td>2021</td><td>GAN 12 MagLev</td><td>~67 g</td><td>64</td><td>{tr({ zh: '首批量产磁悬浮', en: 'first mass-produced MagLev',
                      zhHant: "首批次產磁懸浮"
                })}</td></tr>
                  <tr><td>2022</td><td>MoYu Super RS3 M Ball-Core</td><td>86 g</td><td>~80</td><td>{tr({ zh: '首批 ball-core', en: 'first ball-core flagship' })}</td></tr>
                  <tr><td>2023</td><td>QiYi X-Man Tornado V3</td><td>~69 g</td><td>64</td><td>{tr({ zh: 'Park 3.13 用此', en: 'Park 3.13 cube' })}</td></tr>
                  <tr><td>2024</td><td>GAN 14 MagLev</td><td>70.3 g</td><td>88</td><td>{tr({ zh: '1296 配置', en: '1296 settings' })}</td></tr>
                  <tr><td>2024</td><td>GAN 15 MagLev</td><td>58.6 g</td><td>76</td><td>{tr({ zh: 'GAN 最轻旗舰', en: 'lightest GAN flagship',
                      zhHant: "GAN 最輕旗艦"
                })}</td></tr>
                  <tr><td>2025</td><td>MoYu Super WeiLong V2</td><td>70 g</td><td>100</td><td>{tr({ zh: '20 磁球心, Wang 3.08', en: '20-magnet ball core, Wang 3.08' })}</td></tr>
                  <tr><td>2025</td><td>GAN 16 MagLev MAX</td><td>~66 g</td><td>136+</td><td>{tr({ zh: '中层磁网, 72 阶 tensioning', en: 'mid-layer network, 72-step tensioning',
                      zhHant: "中層磁網, 72 階 tensioning"
                })}</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>值得注意一點。</strong> Zajder 2.76 用的是 <strong>2021 年的 GAN 12 M</strong>,不是最新的 GAN 16。<strong>硬體已經不是頂級 WR 的瓶頸了</strong>,後續突破來自方法 (ZBLL) 和訓練 (智慧魔方)。</>) : (isZh
                                              ? <><strong>值得注意一点。</strong> Zajder 2.76 用的是 <strong>2021 年的 GAN 12 M</strong>,不是最新的 GAN 16。<strong>硬件已经不是顶级 WR 的瓶颈了</strong>,后续突破来自方法 (ZBLL) 和训练 (智能魔方)。</>
                                              : <><strong>Key finding.</strong> Zajder's 2.76 used a <strong>2021 GAN 12 M</strong>, not the latest GAN 16. <strong>Hardware is no longer the binding constraint at the top</strong>; gains come from methods (ZBLL) + training (smart cubes).</>)}
            </p>

            {!isZh && <Longform text={ENGINEERING_EN} />}
          </Section>

          <Section id="smart-cube" titleZh="智能魔方革命 (2019-2026)" titleEn="Smart Cube Revolution (2019-2026)" isZh={isZh}>
            <p>
              {i18n.language === 'zh-Hant' ? (<>智慧魔方 = BLE + 陀螺儀 + 電池 + 配套 App。<strong>GAN 356 i (2019)</strong> 是首款大規模商業化的 BLE 速擰魔方。之後有 i2 (2021), i3 (2022), i Carry 2 (2024 — 無底座,700 小時電池)。配套 App: GAN Cube Station, Cubeast (第三方專業級), csTimer (開源,2020+ 支援 BLE)。</>) : (isZh
                                              ? <>智能魔方 = BLE + 陀螺仪 + 电池 + 配套 App。<strong>GAN 356 i (2019)</strong> 是首款大规模商业化的 BLE 速拧魔方。之后有 i2 (2021), i3 (2022), i Carry 2 (2024 — 无底座,700 小时电池)。配套 App: GAN Cube Station, Cubeast (第三方专业级), csTimer (开源,2020+ 支持 BLE)。</>
                                              : <>Smart cube = BLE + gyro + battery + app. <strong>GAN 356 i (2019)</strong> the first mainstream BLE speedcube. Iterations i2 (2021), i3 (2022), i Carry 2 (2024 — dockless, 700h battery). Apps: GAN Cube Station, Cubeast (3rd-party speedcubing-grade), csTimer (open source, BLE since 2020).</>)}
            </p>
            <ul>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>初 / 中級 (sub-20 → sub-12)</strong>: 價值最大。Cubeast 給按步切分的時間,sub-15 → sub-12 週期縮短 30-50%。</>) : (isZh ? <><strong>初 / 中级 (sub-20 → sub-12)</strong>: 价值最大。Cubeast 给按步切分的时间,sub-15 → sub-12 周期缩短 30-50%。</> : <><strong>Beginner/intermediate</strong>: highest value. Cubeast per-step splits; sub-15 → sub-12 progression 30-50% faster.</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>高階 (sub-10 → sub-6)</strong>: 訓練新方法 (ZBLL 識別) + 監測平臺期。</>) : (isZh ? <><strong>高级 (sub-10 → sub-6)</strong>: 训练新方法 (ZBLL 识别) + 监测平台期。</> : <><strong>Advanced</strong>: new method drilling + plateau detection.</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>頂級 (sub-5 → WR)</strong>: 只用作訓練分析 (WCA 不允許比賽使用)。反饋迴圈更短,刷 PR 節奏更快。</>) : (isZh ? <><strong>顶级 (sub-5 → WR)</strong>: 只用作训练分析 (WCA 不允许比赛使用)。反馈循环更短,刷 PR 节奏更快。</> : <><strong>Elite</strong>: analysis only (WCA disallows in comp). Faster feedback shortens PR cadence.</>)}</li>
            </ul>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>2022 後的中國速擰少年群體。</strong> Wang (生於 2013),Geng (生於 2017),Zajder (~2016) — 學習過程幾乎完全在智慧魔方時代。預計 2030+ 進入 sub-3 的主要是這一代。</>) : (isZh
                                              ? <><strong>2022 后的中国速拧少年群体。</strong> Wang (生于 2013),Geng (生于 2017),Zajder (~2016) — 学习过程几乎完全在智能魔方时代。预计 2030+ 进入 sub-3 的主要是这一代。</>
                                              : <><strong>Post-2022 Chinese child cohort.</strong> Wang (b. 2013), Geng (b. 2017), Zajder (~2016) — learning trajectory entirely in smart-cube era. Expect post-2030 sub-3 contenders predominantly from this generation.</>)}
            </p>
          </Section>

          <Section id="biomech" titleZh="生物力学: TPS 的硬天花板" titleEn="Biomech: The TPS Ceiling" isZh={isZh}>
            <p>{tr({ zh: '三个独立的生物力学来源:', en: 'Three independent biomech benchmarks:',
                zhHant: "三個獨立的生物力學來源:"
            })}</p>
            <ul>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>鋼琴單指敲擊</strong>: Aoki & Kinoshita 2001 (Ergonomics 44(15)) — 鋼琴家單指 6.0-6.7 Hz (食指 / 中指),5.0-5.5 Hz (無名指 / 小指)。</>) : (isZh ? <><strong>钢琴单指敲击</strong>: Aoki & Kinoshita 2001 (Ergonomics 44(15)) — 钢琴家单指 6.0-6.7 Hz (食指 / 中指),5.0-5.5 Hz (无名指 / 小指)。</> : <><strong>Piano single-finger tap</strong>: Aoki & Kinoshita 2001 (Ergonomics 44(15)) — pianists 6.0-6.7 Hz (index/middle), 5.0-5.5 Hz (ring/little).</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>雙手交替擊鼓</strong>: Keita Hattori 2024 Guinness — 22.2 strokes/s (1334/min)。雙手交替的上限。</>) : (isZh ? <><strong>双手交替击鼓</strong>: Keita Hattori 2024 Guinness — 22.2 strokes/s (1334/min)。双手交替的上限。</> : <><strong>Dual-hand drum stroke</strong>: Keita Hattori 2024 Guinness — 22.2 strokes/s (1334/min). Two-hand alternating ceiling.</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>速擰持續 TPS</strong>: Wang 3.08 全程 14.61 — 現役 WR 最高。Feliks 2012 估的 11-12 上限,已被 Wang 這一代打破。</>) : (isZh ? <><strong>速拧持续 TPS</strong>: Wang 3.08 全程 14.61 — 现役 WR 最高。Feliks 2012 估的 11-12 上限,已被 Wang 这一代打破。</> : <><strong>Sustained cubing TPS</strong>: Wang 3.08 = 14.61 sustained. Feliks 2012 estimated 11-12 ceiling, broken by Wang generation.</>)}</li>
            </ul>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>速擰 TPS 頂端估計</strong>: 持續 17 TPS,突發 20-22。17 × 50 STM = 2.94 秒,17 × 28 STM (Zajder 路徑) = 1.65 秒 — 跟「百年內可達 1.5 秒」一致。</>) : (isZh
                                              ? <><strong>速拧 TPS 顶端估计</strong>: 持续 17 TPS,突发 20-22。17 × 50 STM = 2.94 秒,17 × 28 STM (Zajder 路径) = 1.65 秒 — 跟「百年内可达 1.5 秒」一致。</>
                                              : <><strong>Cubing TPS ceiling estimate</strong>: sustained 17, burst 20-22. 17 × 50 STM = 2.94 s, 17 × 28 STM (Zajder path) = 1.65 s — matches "100-yr reachable 1.5 s".</>)}
            </p>
            <p>{i18n.language === 'zh-Hant' ? (<><strong>步數-TPS 等高線</strong> (T = STM/TPS + 0.05 秒反應):</>) : (isZh ? <><strong>步数-TPS 等高线</strong> (T = STM/TPS + 0.05 秒反应):</> : <><strong>STM-TPS contours</strong> (T = STM/TPS + 0.05 s reaction):</>)}</p>
            <div className="pred-method-table-wrap">
              <table className="pred-fit-table">
                <thead><tr><th>STM \ TPS</th><th>10</th><th>12</th><th>14</th><th>16</th><th>18</th><th>20</th></tr></thead>
                <tbody>
                  <tr><td>60</td><td>6.05</td><td>5.05</td><td>4.34</td><td>3.80</td><td>3.39</td><td>3.05</td></tr>
                  <tr><td>50</td><td>5.05</td><td>4.22</td><td>3.62</td><td>3.18</td><td>2.83</td><td>2.55</td></tr>
                  <tr><td>40</td><td>4.05</td><td>3.38</td><td>2.91</td><td>2.55</td><td>2.27</td><td>2.05</td></tr>
                  <tr><td>30</td><td>3.05</td><td>2.55</td><td>2.19</td><td>1.93</td><td>1.72</td><td>1.55</td></tr>
                  <tr><td>20</td><td>2.05</td><td>1.72</td><td>1.48</td><td>1.30</td><td>1.16</td><td>1.05</td></tr>
                  <tr><td>16</td><td>1.65</td><td>1.38</td><td>1.19</td><td>1.05</td><td>0.94</td><td>0.85</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              {i18n.language === 'zh-Hant' ? (<><strong>讀圖法。</strong> Zajder 2.76 落在 29 STM × 10.5 TPS → 表中 30/10 = 3.05 (實測 2.76 反映 ZBLL skip)。100 年漸近 ~24 STM × 16 TPS ≈ 1.55 秒。數學硬牆 ~16 STM × 17 TPS = 1.0 秒。</>) : (isZh
                                              ? <><strong>读图法。</strong> Zajder 2.76 落在 29 STM × 10.5 TPS → 表中 30/10 = 3.05 (实测 2.76 反映 ZBLL skip)。100 年渐近 ~24 STM × 16 TPS ≈ 1.55 秒。数学硬墙 ~16 STM × 17 TPS = 1.0 秒。</>
                                              : <><strong>Reading.</strong> Zajder 2.76 ≈ 29 STM × 10.5 TPS → cell 30/10 = 3.05. 100-yr asymptote ≈ 24 STM × 16 TPS ≈ 1.55 s. Math wall ≈ 16 STM × 17 TPS = 1.0 s.</>)}
            </p>

            {!isZh && <Longform text={BIOMECH_TRAINING_EN} />}
            {!isZh && <Longform text={PSYCHOLOGY_EN} />}
          </Section>

          <Section id="cubers" titleZh="顶级选手画像" titleEn="Top Cuber Profiles" isZh={isZh}>
            <CuberCard isZh={isZh} name="Feliks Zemdegs" nation="AU" born="1995-12-20"
              accolades_en="121 all-time WRs · 228 continental records · WC2013 + WC2015 champion · longest Ao5 dominance (~9 years)"
              accolades_zh="121 项 WR,228 项洲纪录,2013/2015 双届世锦,Ao5 单人霸榜 ~9 年"
              method_en="Pure CFOP + intuitive F2L, lookahead pioneer. No ZBLL."
              method_zh="纯 CFOP + 直觉 F2L,lookahead 流派开山,不用 ZBLL。"
              training_en="Self-developed CubeSkills framework: metronome F2L drills, blindfolded pair drilling, 'X-look' constraints."
              training_zh="自创 CubeSkills 教练体系: 节拍器 F2L,盲 pair 训练,强制「X-look」。"
              hardware_en="Eastsheen → DaYan → MoYu → GAN (sponsor)"
              hardware_zh="Eastsheen → DaYan → MoYu → GAN (赞助)"
              current_en="Active competitor (Worlds 2025 semis), finance career, married 2026"
              current_zh="仍参赛 (2025 世锦半决),金融业,2026 年结婚" />
            <CuberCard isZh={isZh} name="Max Park" nation="US" born="2001-11-28"
              accolades_en="Held 3x3 single WR 4 times (final 3.13) · Ao5 WR 4 times · WC2017 + WC2023 champion · big-cube specialist"
              accolades_zh="单次 WR 4 次 (终止于 3.13),Ao5 WR 4 次,2017/2023 双届世锦,大魔方专家"
              method_en="CFOP + partial ZBLL (Sune/Antisune subset)"
              method_zh="CFOP + 部分 ZBLL (Sune/Antisune 子集)"
              training_en="~5 hours/day, autism support context"
              training_zh="日均 ~5 小时,自闭症支持背景"
              hardware_en="QiYi X-Man Tornado V3 Pioneer (3.13 cube)"
              hardware_zh="QiYi X-Man Tornado V3 Pioneer (3.13 用此)"
              current_en="Active top-10, Netflix doc subject"
              current_zh="仍 top 10 现役,Netflix 纪录片主角" />
            <CuberCard isZh={isZh} name="Yiheng Wang (王艺衡)" nation="CN" born="2013-12-16"
              accolades_en="Single WR 3.08 (Feb 2025) · 9 consecutive Ao5 WRs · WC2025 champion · highest verified WR TPS 14.61"
              accolades_zh="单次 WR 3.08 (2025-02),Ao5 WR 9 连,2025 世锦冠军,现役 WR 最高 TPS 14.61"
              method_en="CFOP with ZZ-style block building, partial ZBLL"
              method_zh="CFOP + ZZ 风格 block building + 部分 ZBLL"
              training_en="Beijing-area community. 2024 2x2 sliding scandal (0.78 ao5 revoked)."
              training_zh="北京一带的速拧圈;2024 年 2x2 滑计时事件 (0.78 Ao5 被撤销)。"
              hardware_en="MoYu Super WeiLong V2"
              hardware_zh="MoYu Super WeiLong V2"
              current_en="Age 12, ranked #2 average / #3 single in May 2026"
              current_zh="12 岁,2026-05 平均 #2,单次 #3" />
            <CuberCard isZh={isZh} name="Xuanyi Geng (耿暄一)" nation="CN" born="2017-03-21"
              accolades_en="Current Ao5 WR 3.71 · single WR 3.05 (Apr 2025, age 7-8) · youngest WR holder ever · first Ao5 sub-4 ever"
              accolades_zh="现 Ao5 WR 3.71,单次 WR 3.05 (2025-04, 7-8 岁),史上最年轻 WR,首次 Ao5 sub-4"
              method_en="Full ZB = ZBLS + full ZBLL"
              method_zh="全 ZB = ZBLS + 全 ZBLL"
              training_en="Suzhou native, GAN-sponsored child prodigy program"
              training_zh="苏州人,GAN 童星培养计划"
              hardware_en="GAN flagship (16 MagLev MAX-class)"
              hardware_zh="GAN 旗舰 (16 MagLev MAX 级)"
              current_en="Age 8, dominant junior, full-ZB pioneer at WR speed"
              current_zh="8 岁,主导少年圈,WR 速度首批全 ZB 用户" />
            <CuberCard isZh={isZh} name="Teodor Zajder" nation="PL" born="~2016-2017"
              accolades_en="Current single WR 2.76 (Feb 2026, age 9) · first sub-3 ever · largest PB-to-WR jump (4.09 → 2.76)"
              accolades_zh="现单次 WR 2.76 (2026-02, 9 岁),史上首次 sub-3,现代 PB-to-WR 最大跳跃 (4.09 → 2.76)"
              method_en="CFOP + ZBLL"
              method_zh="CFOP + ZBLL"
              training_en="Gdańsk Polish cubing club. Trained on GAN 12 M (2021 hardware!)"
              training_zh="格但斯克波兰魔方俱乐部,用 GAN 12 M (2021 硬件) 训练"
              hardware_en="GAN 12 MagLev (Teodor Zajder Signature)"
              hardware_zh="GAN 12 MagLev (Teodor Zajder Signature)"
              current_en="Before WR was ranked #378 globally with 4.09 PB. The 2.76 was his first sub-4 official solve."
              current_zh="WR 前世界 #378 排名,PB 4.09。2.76 是他官方首次 sub-4。" />
            <CuberCard isZh={isZh} name="Tymon Kolasiński" nation="PL" born="2005-06-21"
              accolades_en="4x4/5x5 WR holder · Former 3x3 Ao5 WR (5.09, 4.86) · Knows full ZBLL · Euros 2024 4-event sweep"
              accolades_zh="4x4/5x5 现 WR,曾持 3x3 Ao5 WR,全 ZBLL,2024 欧锦 4 项全冠"
              method_en="CFOP/ZB hybrid, pioneer of 3x3 pseudoslotting"
              method_zh="CFOP/ZB 混合,推广 3x3 pseudoslotting"
              training_en="~6 hours/day (2h algs + 4h solves)"
              training_zh="日均 6 小时 (2 小时算法 + 4 小时解)"
              hardware_en="GAN"
              hardware_zh="GAN"
              current_en="Defining big-cube specialist of this era"
              current_zh="本时代大魔方第一人" />
            <CuberCard isZh={isZh} name="Yusheng Du (杜宇生)" nation="CN" born="~1998"
              accolades_en="3.47 single (Nov 2018) — held WR 4y 7m"
              accolades_zh="3.47 单次 (2018-11) — 持 WR 4 年 7 个月"
              method_en="CFOP — XX-cross + COLL with PLL skip (27 STM × 7.78 TPS)"
              method_zh="CFOP — XX-cross + COLL 配 PLL skip (27 STM × 7.78 TPS)"
              training_en="Post-WR transitioned to business — Yushen Academy + MoYu Huameng cube line"
              training_zh="WR 后转商,玉神魔方学院 + MoYu 华梦魔方线"
              hardware_en="GAN 356 X"
              hardware_zh="GAN 356 X"
              current_en="Still active occasionally, major figure in China's cubing business"
              current_zh="仍偶尔参赛,中国魔方商业圈的大佬" />
            <CuberCard isZh={isZh} name="Eduardo Silva Damasceno" nation="BR" born="~2005"
              accolades_en="First publicly verified full 1LLL learner (2022, 3,915 algorithms)"
              accolades_zh="首位公认全 1LLL 学完者 (2022,3915 个算法)"
              method_en="CFOP + full 1LLL"
              method_zh="CFOP + 全 1LLL"
              training_en="Self-driven 1LLL learning project, several years"
              training_zh="自驱 1LLL 学习项目,持续数年"
              hardware_en="—"
              hardware_zh="—"
              current_en="Mid-tier competitor; 1LLL recognition prevents WR-level performance"
              current_zh="中阶选手;1LLL 识别速度限制 WR 表现" />

          </Section>

          <Section id="training" titleZh="训练学方法 — 量化的练习路径" titleEn="Training Methodology — Quantitative Practice" isZh={isZh}>
            <p>{i18n.language === 'zh-Hant' ? (<><strong>累計 solves 與 PB 閾值關係</strong> (社羣共識):</>) : (isZh ? <><strong>累计 solves 与 PB 阈值关系</strong> (社区共识):</> : <><strong>Cumulative solves vs PB threshold</strong> (community consensus):</>)}</p>
            <div className="pred-method-table-wrap">
              <table className="pred-fit-table pred-method-table">
                <thead><tr><th>{tr({ zh: '阈值', en: 'PB',
                    zhHant: "閾值"
                })}</th><th>{tr({ zh: '累计 solves', en: 'Cumulative',
                    zhHant: "累計 solves"
                })}</th><th>{tr({ zh: '一致训练时间', en: 'Calendar time',
                    zhHant: "一致訓練時間"
                })}</th><th>{tr({ zh: '日均', en: 'Daily' })}</th></tr></thead>
                <tbody>
                  <tr><td>Sub-30</td><td>~1,000</td><td>{tr({ zh: '1-3 月', en: '1-3 months' })}</td><td>~50</td></tr>
                  <tr><td>Sub-20</td><td>~5,000</td><td>{tr({ zh: '6-12 月', en: '6-12 months' })}</td><td>~50-100</td></tr>
                  <tr><td>Sub-15</td><td>~15,000</td><td>{tr({ zh: '1-2 年', en: '1-2 years' })}</td><td>~100-200</td></tr>
                  <tr><td>Sub-10</td><td>~50,000</td><td>{tr({ zh: '2-4 年', en: '2-4 years' })}</td><td>~200-300</td></tr>
                  <tr><td>Sub-7</td><td>~150,000</td><td>{tr({ zh: '4-7 年', en: '4-7 years' })}</td><td>~300-500</td></tr>
                  <tr><td>Sub-5</td><td>~400,000+</td><td>{tr({ zh: '6-10 年', en: '6-10 years' })}</td><td>~500-1000+</td></tr>
                  <tr><td>Sub-4</td><td>~10⁶+</td><td>{tr({ zh: '天赋限制', en: 'talent-bound',
                      zhHant: "天賦限制"
                })}</td><td>—</td></tr>
                  <tr><td>Sub-3</td><td>{tr({ zh: '~10 人小圈', en: '~10-person club' })}</td><td>—</td><td>—</td></tr>
                </tbody>
              </table>
            </div>
            <p>{i18n.language === 'zh-Hant' ? (<><strong>訓練分配 (頂級共識)</strong>:</>) : (isZh ? <><strong>训练分配 (顶级共识)</strong>:</> : <><strong>Practice composition (consensus)</strong>:</>)}</p>
            <ul>
              <li>{tr({ zh: '~60% csTimer 计时解 (Ao12/50/100 课次)', en: '~60% csTimer-timed solves',
                  zhHant: "~60% csTimer 計時解 (Ao12/50/100 課次)"
            })}</li>
              <li>{tr({ zh: '~15% 慢解 / 强制 lookahead', en: '~15% slow / forced-lookahead solves',
                  zhHant: "~15% 慢解 / 強制 lookahead"
            })}</li>
              <li>{tr({ zh: '~15% 算法练习 (按 case 频率加权)', en: '~15% algorithm drilling (case-frequency-weighted)',
                  zhHant: "~15% 演算法練習 (按 case 頻率加權)"
            })}</li>
              <li>{tr({ zh: '~10% 复盘 (视频 / 智能魔方)', en: '~10% review (video / smart cube)',
                  zhHant: "~10% 覆盤 (影片 / 智慧魔方)"
            })}</li>
            </ul>
            <p>{i18n.language === 'zh-Hant' ? (<><strong>訓練 PB 跟 WCA PB 的差距</strong>: 5-10%。原因: 魔方冷啟動, 打亂驗證延遲, 緊張, 沒熱身。</>) : (isZh ? <><strong>训练 PB 跟 WCA PB 的差距</strong>: 5-10%。原因: 魔方冷启动, 打乱验证延迟, 紧张, 没热身。</> : <><strong>Training-comp gap</strong>: 5-10%. Causes: cube cooldown, scramble verification delay, anxiety, no warmup.</>)}</p>
          </Section>

          <Section id="stats" titleZh="统计建模: 4 个独立模型" titleEn="Statistical Modeling: 4 Independent Models" isZh={isZh}>
            <p>{tr({ zh: '4 个候选模型:', en: 'Four candidate models:',
                zhHant: "4 個候選模型:"
            })}</p>
            <ol>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>Exp + floor。</strong> T(t) = L + A · exp(−k(t−t₀))。L 用網格搜尋。優勢: floor 可解釋;劣勢: 單 floor 假設。</>) : (isZh ? <><strong>Exp + floor。</strong> T(t) = L + A · exp(−k(t−t₀))。L 用网格搜索。优势: floor 可解释;劣势: 单 floor 假设。</> : <><strong>Exp + floor.</strong> Grid search L. Pro: floor interpretable. Con: single-floor assumption.</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>Gompertz 衰減。</strong> S 形,比 exp+floor 多一個拐點。</>) : (isZh ? <><strong>Gompertz 衰减。</strong> S 形,比 exp+floor 多一个拐点。</> : <><strong>Gompertz decay.</strong> S-shaped; adds an inflection vs exp+floor.</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>冪律。</strong> T(t) = a · t^(−b)。無 floor,長期撞 0。</>) : (isZh ? <><strong>幂律。</strong> T(t) = a · t^(−b)。无 floor,长期撞 0。</> : <><strong>Power law.</strong> No floor; hits 0 long-term.</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>GEV reverse-Weibull。</strong> 極值引數 ξ &lt; 0 給有限 endpoint,擬合 1982-2026 WR 得 τ̂ ≈ 2.0 ± 0.4 秒。</>) : (isZh ? <><strong>GEV reverse-Weibull。</strong> 极值参数 ξ &lt; 0 给有限 endpoint,拟合 1982-2026 WR 得 τ̂ ≈ 2.0 ± 0.4 秒。</> : <><strong>GEV reverse-Weibull.</strong> Shape ξ &lt; 0 gives finite endpoint; fit on 1982-2026 WR yields τ̂ ≈ 2.0 ± 0.4 s.</>)}</li>
            </ol>
            <p>{i18n.language === 'zh-Hant' ? (<><strong>Walk-forward backtest</strong> (訓練 2003-2020, 預測 2021-2026):</>) : (isZh ? <><strong>Walk-forward backtest</strong> (训练 2003-2020, 预测 2021-2026):</> : <><strong>Walk-forward backtest</strong> (train 2003-2020, forecast 2021-2026):</>)}</p>
            <div className="pred-method-table-wrap">
              <table className="pred-fit-table">
                <thead><tr><th>{tr({ zh: '模型', en: 'Model' })}</th><th>{tr({ zh: '2026 预测', en: '2026 forecast',
                    zhHant: "2026 預測"
                })}</th><th>{tr({ zh: '实测', en: 'Actual',
                    zhHant: "實測"
                })}</th><th>{tr({ zh: '误差', en: 'Error',
                    zhHant: "誤差"
                })}</th></tr></thead>
                <tbody>
                  <tr><td>Exp + floor</td><td>~3.50 s</td><td rowSpan={4}><strong>2.76 s</strong> (Zajder)</td><td className="pred-num">+0.74</td></tr>
                  <tr><td>Gompertz</td><td>~3.20 s</td><td className="pred-num">+0.44</td></tr>
                  <tr><td>Power law</td><td>~2.90 s</td><td className="pred-num">+0.14</td></tr>
                  <tr><td>GEV reverse-Weibull</td><td>~2.85 s</td><td className="pred-num">+0.09</td></tr>
                </tbody>
              </table>
            </div>
            <p>{i18n.language === 'zh-Hant' ? (<><strong>BMA 結果:</strong> 磁鐵時代加速 (post-2017) 讓 GEV (重尾) 最準。權重: GEV 0.55, Exp-floor 0.30, Gompertz 0.15。</>) : (isZh ? <><strong>BMA 结果:</strong> 磁铁时代加速 (post-2017) 让 GEV (重尾) 最准。权重: GEV 0.55, Exp-floor 0.30, Gompertz 0.15。</> : <><strong>Key finding.</strong> Magnet-era acceleration (post-2017) makes GEV most accurate. BMA: GEV 0.55, Exp-floor 0.30, Gompertz 0.15.</>)}</p>
          </Section>

          <Section id="gev" titleZh="GEV 极值理论" titleEn="GEV Extreme Value Theory" isZh={isZh}>
            <p>{i18n.language === 'zh-Hant' ? (<>WR 單次本質上是 <strong>N 次獨立嘗試的樣本最小值</strong>。Gumbel 漸近:</>) : (isZh ? <>WR 单次本质上是 <strong>N 次独立尝试的样本最小值</strong>。Gumbel 渐近:</> : <>WR single = <strong>sample minimum of N attempts</strong>. Gumbel asymptotic:</>)}</p>
            <pre className="pred-formula">{`log T_min ≈ μ − σ · √(2 ln N) + σ · (ln ln N + ln 4π) / (2√(2 ln N))

或粗略:
T_min ≈ μ · exp(−σ_log · √(2 ln N))

代入 μ_log = log(4.5) = 1.50, σ_log = 0.12, N = 10^7:
T_min ≈ 4.5 × exp(−0.12 × √(2 × 16.12))
      = 4.5 × exp(−0.68) ≈ 2.27 s`}</pre>
            <p>{i18n.language === 'zh-Hant' ? (<><strong>3 個失效模式</strong>: (1) log-normal 下尾被物理 floor 截斷,公式沒這約束;(2) 各次解不獨立 (硬體代際 / 同期組非平穩);(3) N → ∞ 時 Gumbel 不停外推,真實極值受 16-STM 下界硬截。嚴格建模用 <strong>reverse-Weibull (ξ &lt; 0)</strong>,給出有限端點 τ ≈ 2.0 秒,跟物理 floor 一致。</>) : (isZh ? <><strong>3 个失效模式</strong>: (1) log-normal 下尾被物理 floor 截断,公式没这约束;(2) 各次解不独立 (硬件代际 / 同期组非平稳);(3) N → ∞ 时 Gumbel 不停外推,真实极值受 16-STM 下界硬截。严格建模用 <strong>reverse-Weibull (ξ &lt; 0)</strong>,给出有限端点 τ ≈ 2.0 秒,跟物理 floor 一致。</> : <><strong>Three failure modes</strong>: (1) lower tail truncated by physical floor; (2) non-iid (hardware era / cohort non-stationary); (3) Gumbel extrapolates to 0 as N→∞ vs cube20.org 16-STM floor. Rigorous modeling uses <strong>reverse-Weibull (ξ &lt; 0)</strong> giving finite endpoint τ ≈ 2.0 s, matching physical floor.</>)}</p>
          </Section>

          <Section id="forecast" titleZh="综合预测 — Single + Ao5 (BMA Ensemble)" titleEn="Final Forecast — Single + Ao5 (BMA Ensemble)" isZh={isZh}>
            <div className="pred-forecast-dash">
              <div className="pred-forecast-col">
                <h3>{tr({ zh: '单次 WR 预测', en: 'Single WR Forecast',
                    zhHant: "單次 WR 預測"
                })}</h3>
                <div className="pred-forecast-numbers">
                  <div className="pred-forecast-row"><span className="pred-forecast-year">2026 {tr({ zh: '现', en: 'now',
                      zhHant: "現"
                })}</span><span className="pred-forecast-val">2.76 s</span><span className="pred-forecast-ci">Zajder</span></div>
                  <div className="pred-forecast-row pred-fc-soon"><span className="pred-forecast-year">2027</span><span className="pred-forecast-val">2.55</span><span className="pred-forecast-ci">[2.40–2.70]</span></div>
                  <div className="pred-forecast-row pred-fc-mid"><span className="pred-forecast-year">2030</span><span className="pred-forecast-val">2.30</span><span className="pred-forecast-ci">[2.05–2.55]</span></div>
                  <div className="pred-forecast-row pred-fc-mid"><span className="pred-forecast-year">2035</span><span className="pred-forecast-val">2.05</span><span className="pred-forecast-ci">[1.80–2.30]</span></div>
                  <div className="pred-forecast-row pred-fc-far"><span className="pred-forecast-year">2040</span><span className="pred-forecast-val">1.90</span><span className="pred-forecast-ci">[1.65–2.15]</span></div>
                  <div className="pred-forecast-row pred-fc-far"><span className="pred-forecast-year">2050</span><span className="pred-forecast-val">1.70</span><span className="pred-forecast-ci">[1.45–1.95]</span></div>
                  <div className="pred-forecast-row pred-fc-asymp"><span className="pred-forecast-year">{tr({ zh: '100 年', en: '100-yr' })}</span><span className="pred-forecast-val">~1.50</span><span className="pred-forecast-ci">{tr({ zh: '方法可达', en: 'method-reachable',
                      zhHant: "方法可達"
                })}</span></div>
                  <div className="pred-forecast-row pred-fc-wall"><span className="pred-forecast-year">{tr({ zh: '硬墙', en: 'wall',
                      zhHant: "硬牆"
                })}</span><span className="pred-forecast-val">~0.99</span><span className="pred-forecast-ci">16 STM × 17 TPS</span></div>
                </div>
              </div>
              <div className="pred-forecast-col">
                <h3>{tr({ zh: 'Ao5 WR 预测', en: 'Ao5 WR Forecast',
                    zhHant: "Ao5 WR 預測"
                })}</h3>
                <div className="pred-forecast-numbers">
                  <div className="pred-forecast-row"><span className="pred-forecast-year">2026 {tr({ zh: '现', en: 'now',
                      zhHant: "現"
                })}</span><span className="pred-forecast-val">3.71 s</span><span className="pred-forecast-ci">Geng</span></div>
                  <div className="pred-forecast-row pred-fc-soon"><span className="pred-forecast-year">2027</span><span className="pred-forecast-val">3.45</span><span className="pred-forecast-ci">[3.30–3.60]</span></div>
                  <div className="pred-forecast-row pred-fc-mid"><span className="pred-forecast-year">2030</span><span className="pred-forecast-val">3.00</span><span className="pred-forecast-ci">[2.75–3.25]</span></div>
                  <div className="pred-forecast-row pred-fc-mid"><span className="pred-forecast-year">2035</span><span className="pred-forecast-val">2.65</span><span className="pred-forecast-ci">[2.40–2.90]</span></div>
                  <div className="pred-forecast-row pred-fc-far"><span className="pred-forecast-year">2040</span><span className="pred-forecast-val">2.40</span><span className="pred-forecast-ci">[2.15–2.65]</span></div>
                  <div className="pred-forecast-row pred-fc-far"><span className="pred-forecast-year">2050</span><span className="pred-forecast-val">2.15</span><span className="pred-forecast-ci">[1.90–2.40]</span></div>
                  <div className="pred-forecast-row pred-fc-asymp"><span className="pred-forecast-year">{tr({ zh: '渐近', en: 'asymptote',
                      zhHant: "漸近"
                })}</span><span className="pred-forecast-val">~1.90</span><span className="pred-forecast-ci">{tr({ zh: '执行噪声底', en: 'execution-noise floor',
                    zhHant: "執行噪聲底"
                })}</span></div>
                </div>
              </div>
            </div>
            <p className="pred-note">
              {i18n.language === 'zh-Hant' ? (<><strong>建模。</strong> BMA 整合 (GEV 0.55 + Exp-floor 0.30 + Gompertz 0.15),80% CI 來自殘差 bootstrap。Ao5 / 單次 比例由 σ_log = 0.10-0.12 + Ao5 trimmed mean √5 收縮推導,頂級同輪 Ao5 / min-single ≈ 1.25-1.35。<strong>下界不超過物理 floor 0.99 秒 和 Ao5 1.9 秒</strong>。</>) : (isZh
                                              ? <><strong>建模。</strong> BMA 集成 (GEV 0.55 + Exp-floor 0.30 + Gompertz 0.15),80% CI 来自残差 bootstrap。Ao5 / 单次 比例由 σ_log = 0.10-0.12 + Ao5 trimmed mean √5 收缩推导,顶级同轮 Ao5 / min-single ≈ 1.25-1.35。<strong>下界不超过物理 floor 0.99 秒 和 Ao5 1.9 秒</strong>。</>
                                              : <><strong>Methodology.</strong> BMA ensemble (GEV 0.55 + Exp-floor 0.30 + Gompertz 0.15), 80% CI from residual bootstrap. Ao5/single ratio from σ_log = 0.10-0.12 + Ao5 trimmed-mean √5 shrinkage; top same-round Ao5/min-single ≈ 1.25-1.35. <strong>Lower bounds capped at physical floor 0.99 s and Ao5 1.9 s</strong>.</>)}
            </p>
            <h3>{tr({ zh: '预测置信区间可视化', en: 'Forecast Confidence Band',
                zhHant: "預測置信區間視覺化"
            })}</h3>
            <LineChart
              series={[...singleSeries, forecastCenter, ...ao5Series, ao5Center]}
              bands={[forecastBand, ao5Band]}
              refLines={refLines}
              yLabel={tr({ zh: '时间 (秒)', en: 'Time (s)',
                  zhHant: "時間 (秒)"
            })}
              xLabel={tr({ zh: '年份', en: 'Year' })}
              yMin={0.5}
              yMax={20}
            />

            {!isZh && <Longform text={STATS_FORECAST_EN} />}
            {!isZh && <Longform text={AI_ML_EN} />}
          </Section>

          <Section id="scenarios" titleZh="情景分析" titleEn="Scenarios" isZh={isZh}>
            <p>{tr({ zh: '「基线」假设方法 + 硬件按现有趋势演化:', en: '"Baseline" assumes methods + hardware continue current trends:',
                zhHant: "「基線」假設方法 + 硬體按現有趨勢演化:"
            })}</p>
            <div className="pred-method-table-wrap">
              <table className="pred-fit-table pred-method-table">
                <thead><tr><th>{tr({ zh: '场景', en: 'Scenario',
                    zhHant: "場景"
                })}</th><th>{tr({ zh: '触发', en: 'Trigger',
                    zhHant: "觸發"
                })}</th><th>{(i18n.language.startsWith('zh') ? 'Single 2030' : '2030 Single')}</th><th>{(i18n.language.startsWith('zh') ? 'Ao5 2030' : '2030 Ao5')}</th><th>{tr({ zh: '说明', en: 'Note',
                    zhHant: "說明"
                })}</th></tr></thead>
                <tbody>
                  <tr><td><strong>{tr({ zh: '基线', en: 'Baseline',
                      zhHant: "基線"
                })}</strong></td><td>{tr({ zh: '现有趋势', en: 'current trends',
                    zhHant: "現有趨勢"
                })}</td><td className="pred-num">2.30</td><td className="pred-num">3.00</td><td className="pred-num-small">{tr({ zh: 'BMA 中心', en: 'BMA central' })}</td></tr>
                  <tr><td>{tr({ zh: '🚀 加速', en: '🚀 Acceleration' })}</td><td className="pred-num-small">{tr({ zh: '1LLL 实用化 / 新方法', en: '1LLL practical / new method',
                      zhHant: "1LLL 實用化 / 新方法"
                })}</td><td className="pred-num">~2.00</td><td className="pred-num">~2.55</td><td className="pred-num-small">{tr({ zh: '阶跃 ~15%', en: 'step ~15%',
                    zhHant: "階躍 ~15%"
                })}</td></tr>
                  <tr><td>{tr({ zh: '🐌 减速', en: '🐌 Stagnation',
                      zhHant: "🐌 減速"
                })}</td><td className="pred-num-small">{tr({ zh: '智能魔方代际无效 / 新血断层', en: 'smart-cube plateaus / drought',
                    zhHant: "智慧魔方代際無效 / 新血斷層"
                })}</td><td className="pred-num">~2.60</td><td className="pred-num">~3.40</td><td className="pred-num-small">{tr({ zh: '类似一英里跑 27 年零进展', en: 'Mile-run-style stall',
                    zhHant: "類似一英里跑 27 年零進展"
                })}</td></tr>
                  <tr><td>{tr({ zh: '⚖️ WCA 调整', en: '⚖️ WCA Adjust',
                      zhHant: "⚖️ WCA 調整"
                })}</td><td className="pred-num-small">{tr({ zh: '触发器 / 帧分析进一步收紧', en: 'Timer / FBF tightened',
                    zhHant: "觸發器 / 幀分析進一步收緊"
                })}</td><td className="pred-num">~2.40</td><td className="pred-num">~3.10</td><td className="pred-num-small">{tr({ zh: '类似 2024 滑计时事件之后', en: 'post-2024 sliding',
                    zhHant: "類似 2024 滑計時事件之後"
                })}</td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="caveats" titleZh="局限与陷阱" titleEn="Caveats & Pitfalls" isZh={isZh}>
            <ol>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>未來的「方法革命」是離散事件。</strong> ZB → 1LLL 或者全新方法不會出現在已有的曲線趨勢裡。歷史上每 8-10 年一次方法革命。</>) : (isZh ? <><strong>未来的「方法革命」是离散事件。</strong> ZB → 1LLL 或者全新方法不会出现在已有的曲线趋势里。历史上每 8-10 年一次方法革命。</> : <><strong>Future "method revolutions" are discrete.</strong> ZB→1LLL or new methods aren't in the trend. Cadence ~8-10 years.</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>極值統計的樣本依賴。</strong> N 增長 → 期望最小值下移 1-2% (N = 10⁷)。</>) : (isZh ? <><strong>极值统计的样本依赖。</strong> N 增长 → 期望最小值下移 1-2% (N = 10⁷)。</> : <><strong>Extreme-value sample dependence.</strong> More attempts → expected min drops 1-2% (N = 10⁷).</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>WCA 規則未來不可預測。</strong> 歷史每 5-10 年出現 1-3% 的規則不連續。</>) : (isZh ? <><strong>WCA 规则未来不可预测。</strong> 历史每 5-10 年出现 1-3% 的规则不连续。</> : <><strong>WCA rule unpredictability.</strong> 1-3% historical discontinuities every 5-10 yrs.</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>訓練 - 比賽差距 ~5-10%。</strong> 即使訓練 PB sub-2,比賽仍要拿走一截。</>) : (isZh ? <><strong>训练 - 比赛差距 ~5-10%。</strong> 即使训练 PB sub-2,比赛仍要拿走一截。</> : <><strong>Training-comp gap stays at 5-10%.</strong> Even if training sub-2, comp takes a slice.</>)}</li>
              <li>{i18n.language === 'zh-Hant' ? (<><strong>「未知的未知」。</strong> 頂級選手的老化曲線?心理上限?都沒有同行評審的資料。</>) : (isZh ? <><strong>「未知的未知」。</strong> 顶级选手的老化曲线?心理上限?都没有同行评审的数据。</> : <><strong>"Unknown unknowns".</strong> Top-cuber aging curves? Psychological ceiling? No peer-reviewed data.</>)}</li>
            </ol>
            <p>{i18n.language === 'zh-Hant' ? (<><strong>最終評估。</strong> 所有預測都是最佳估計,5 年 ±10%,25 年 ±30%,50 年的誤差量級與當前數值相當。這套預測不是預言,是一個框架 — 資料變了就跟著迭代。</>) : (isZh ? <><strong>最终评估。</strong> 所有预测都是最佳估计,5 年 ±10%,25 年 ±30%,50 年的误差量级与当前数值相当。这套预测不是预言,是一个框架 — 数据变了就跟着迭代。</> : <><strong>Final assessment.</strong> All forecasts best-estimate; 5-yr ±10%, 25-yr ±30%, 50-yr order-of-magnitude. Not an oracle — a framework to iterate.</>)}</p>

            {!isZh && <Longform text={FMC_EVENTS_EN} />}
            {!isZh && <Longform text={RELATED_PUZZLES_EN} />}
          </Section>
          </ActiveSectionContext.Provider>

          <nav className="pred-333-pager">
            {prevSection ? (
              <Link href={sectionHref(prevSection.id)} className="pred-333-pager-link pred-333-pager-prev">
                <ArrowLeft size={16} />
                <span>
                  <span className="pred-333-pager-label">{tr({ zh: '上一章', en: 'Previous' })}</span>
                  <span className="pred-333-pager-title">{i18n.language === 'zh-Hant' ? (prevSection.labelZhHant ?? prevSection.labelZh) : (isZh ? prevSection.labelZh : prevSection.labelEn)}</span>
                </span>
              </Link>
            ) : <span />}
            {nextSection ? (
              <Link href={sectionHref(nextSection.id)} className="pred-333-pager-link pred-333-pager-next">
                <span>
                  <span className="pred-333-pager-label">{tr({ zh: '下一章', en: 'Next' })}</span>
                  <span className="pred-333-pager-title">{i18n.language === 'zh-Hant' ? (nextSection.labelZhHant ?? nextSection.labelZh) : (isZh ? nextSection.labelZh : nextSection.labelEn)}</span>
                </span>
                <ArrowRightIcon size={16} />
              </Link>
            ) : <span />}
          </nav>

          <footer className="pred-footer">
            <div>{tr({ zh: '本章节是 /wca/prediction 的 3x3 深度版。数据 2026-05。', en: 'This is the 3x3 deep-dive of /wca/prediction. Data May 2026.',
                zhHant: "本章節是 /wca/prediction 的 3x3 深度版。資料 2026-05。"
            })}</div>
          </footer>
        </article>
      </div>
    </div>
  );
}

function Section({ id, titleZh, titleEn, isZh, children }: { id: string; titleZh: string; titleEn: string; isZh: boolean; children: React.ReactNode
    titleZhHant?: string;
 }) {
  const activeId = useContext(ActiveSectionContext);
  if (id !== activeId) return null;
  return (
    <section className="pred-section" id={id}>
      <h2>{isZh ? titleZh : titleEn}</h2>
      {children}
    </section>
  );
}

function PllPreview({ letter, alg, isZh, note_en, note_zh }: { letter: string; alg: string; isZh: boolean; note_en: string; note_zh: string }) {
  return (
    <div className="pred-pll-card">
      <div className="pred-pll-letter">{letter}-perm</div>
      <VisualCube algorithm={alg} view="pll" size={120} />
      <p className="pred-pll-note">{isZh ? note_zh : note_en}</p>
      <code className="pred-pll-alg">{alg}</code>
    </div>
  );
}

function CuberCard({
  isZh, name, nation, born,
  accolades_en, accolades_zh,
  method_en, method_zh,
  training_en, training_zh,
  hardware_en, hardware_zh,
  current_en, current_zh,
}: {
  isZh: boolean; name: string; nation: string; born: string;
  accolades_en: string; accolades_zh: string;
  method_en: string; method_zh: string;
  training_en: string; training_zh: string;
  hardware_en: string; hardware_zh: string;
  current_en: string; current_zh: string;
}) {
  return (
    <div className="pred-cuber-card">
      <div className="pred-cuber-head">
        <span className="pred-cuber-name">{name}</span>
        <span className="pred-cuber-meta">{nation} · {tr({ zh: '生', en: 'b.' })} {born}</span>
      </div>
      <div className="pred-cuber-row"><strong>{tr({ zh: '成就', en: 'Accolades' })}:</strong> {isZh ? accolades_zh : accolades_en}</div>
      <div className="pred-cuber-row"><strong>{tr({ zh: '方法', en: 'Method' })}:</strong> {isZh ? method_zh : method_en}</div>
      <div className="pred-cuber-row"><strong>{tr({ zh: '训练', en: 'Training',
          zhHant: "訓練"
    })}:</strong> {isZh ? training_zh : training_en}</div>
      <div className="pred-cuber-row"><strong>{tr({ zh: '硬件', en: 'Hardware',
          zhHant: "硬體"
    })}:</strong> {isZh ? hardware_zh : hardware_en}</div>
      <div className="pred-cuber-row pred-cuber-current"><strong>{tr({ zh: '现状', en: 'Current',
          zhHant: "現狀"
    })}:</strong> {isZh ? current_zh : current_en}</div>
    </div>
  );
}
