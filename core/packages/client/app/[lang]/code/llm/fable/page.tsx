'use client';

// Claude Fable 5 intro — standalone page styled after anthropic.com's own
// design language (ivory / ink / book-cloth coral, serif display type),
// deliberately NOT using site theme tokens. Route: /code/llm/fable
// Data source: anthropic.com/news/claude-fable-5-mythos-5 (2026-06-09).

import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ArrowUpRight, Code2, Eye, FlaskConical, Brain, BarChart3, Bot,
  ShieldCheck, Dna, Lock, Check, Minus, Gamepad2, Rocket, Microscope, GitBranch,
  Factory, Orbit, Sparkles,
} from 'lucide-react';
import Link from '@/components/AppLink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import './fable.css';

/* ── hero — precise Anthropic-style radiant burst (no face) ───────── */
function HeroArt() {
  const cx = 210, cy = 200, r0 = 66;
  const rays: React.ReactNode[] = [];
  const N = 56;
  // round to fixed precision so SSR/CSR Math.sin末位差异不触发 hydration mismatch
  const q = (n: number) => Number(n.toFixed(2));
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    // organic halo: two-frequency length modulation
    const len = 26 + 30 * Math.abs(Math.sin(i * 0.72)) + 10 * Math.sin(i * 0.27);
    const r1 = r0 + 16;
    const r2 = r1 + len;
    const coral = i % 4 === 0;
    rays.push(
      <line
        key={i}
        x1={q(cx + Math.cos(a) * r1)} y1={q(cy + Math.sin(a) * r1)}
        x2={q(cx + Math.cos(a) * r2)} y2={q(cy + Math.sin(a) * r2)}
        stroke={coral ? '#CC785C' : '#141413'}
        strokeWidth={i % 2 ? 1.4 : 2.6}
        strokeLinecap="round"
        opacity={coral ? 0.9 : 1}
      />,
    );
  }
  return (
    <svg className="fable-hero-art" viewBox="0 0 420 400" role="img" aria-hidden="true">
      <defs>
        <radialGradient id="fbCore" cx="42%" cy="38%" r="72%">
          <stop offset="0%" stopColor="#E8956F" />
          <stop offset="58%" stopColor="#D97757" />
          <stop offset="100%" stopColor="#C2624A" />
        </radialGradient>
      </defs>
      {rays}
      <circle cx={cx} cy={cy} r={r0 + 6} fill="none" stroke="#141413" strokeWidth="1" opacity="0.25" />
      <circle cx={cx} cy={cy} r={r0} fill="url(#fbCore)" stroke="#141413" strokeWidth="2.5" />
      <circle cx={cx} cy={cy} r={r0 - 13} fill="none" stroke="#FAF9F5" strokeWidth="1.4" opacity="0.5" />
      {/* abstract emblem inside core — bookmark/page glyph, no face */}
      <path d={`M ${cx} ${cy - 30} L ${cx + 26} ${cy + 22} L ${cx} ${cy + 8} L ${cx - 26} ${cy + 22} Z`} fill="#FAF9F5" opacity="0.92" />
      <path d={`M ${cx} ${cy - 30} L ${cx} ${cy + 8} L ${cx - 26} ${cy + 22} Z`} fill="#141413" opacity="0.14" />
      {/* sparkle accents */}
      <path d="M 60 70 l 5 14 14 5 -14 5 -5 14 -5 -14 -14 -5 14 -5 z" fill="#CC785C" />
      <path d="M 366 296 l 4 11 11 4 -11 4 -4 11 -4 -11 -11 -4 11 -4 z" fill="#141413" />
      <path d="M 350 78 l 3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3 z" fill="#141413" opacity="0.5" />
    </svg>
  );
}

/* ── Claude family tier ladder ────────────────────────────────────── */
function TierLadder() {
  const tiers = [
    { name: 'Haiku 4.5', w: 30, sub: tr({ zh: '最快最省', en: 'fastest, cheapest' }) },
    { name: 'Sonnet 4.6', w: 52, sub: tr({ zh: '速度与智能均衡', en: 'speed × intelligence'
    }) },
    { name: 'Opus 4.8', w: 78, sub: tr({ zh: '此前最强', en: 'prior flagship'
    }) },
    { name: 'Fable 5', w: 100, sub: tr({ zh: '全新最高档', en: 'new top tier'
    }), self: true },
  ];
  return (
    <div className="fable-ladder">
      {tiers.map((t) => (
        <div key={t.name} className={`fable-ladder-row${t.self ? ' is-self' : ''}`}>
          <div className="fable-ladder-name">{t.name}</div>
          <div className="fable-ladder-track">
            <div className="fable-ladder-fill" style={{ width: `${t.w}%` }} />
          </div>
          <div className="fable-ladder-sub">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Fable / Mythos twin diagram ──────────────────────────────────── */
function TwinArt() {
  return (
    <svg className="fable-twin-svg" viewBox="0 0 480 230" role="img" aria-hidden="true">
      <circle cx="170" cy="115" r="92" fill="#D97757" opacity="0.16" stroke="#CC785C" strokeWidth="2" />
      <circle cx="310" cy="115" r="92" fill="none" stroke="#141413" strokeWidth="2" strokeDasharray="6 5" />
      <circle cx="240" cy="115" r="34" fill="#D97757" stroke="#141413" strokeWidth="2.5" />
      <text x="240" y="120" textAnchor="middle" fontSize="13" fontWeight="600" fill="#141413">Mythos</text>
      <text x="124" y="110" textAnchor="middle" fontSize="15" fontWeight="600" fill="#CC785C">Fable 5</text>
      <text x="124" y="130" textAnchor="middle" fontSize="11" fill="#87827B">{tr({ zh: '安全防护开启', en: 'safeguards on'
    })}</text>
      <text x="358" y="110" textAnchor="middle" fontSize="15" fontWeight="600" fill="#141413">Mythos 5</text>
      <text x="358" y="130" textAnchor="middle" fontSize="11" fill="#87827B">{tr({ zh: '仅受信研究者', en: 'trusted access'
    })}</text>
    </svg>
  );
}

/* ── safety routing flow ──────────────────────────────────────────── */
function SafetyFlow() {
  return (
    <svg className="fable-safety-svg" viewBox="0 0 760 190" role="img" aria-hidden="true">
      <rect x="10" y="70" width="130" height="50" rx="14" fill="none" stroke="#CFC9BA" strokeWidth="1.5" />
      <text x="75" y="100" textAnchor="middle" fontSize="14" fill="#141413">{tr({ zh: '用户请求', en: 'Request'
    })}</text>

      <line x1="140" y1="95" x2="218" y2="95" stroke="#87827B" strokeWidth="1.5" />
      <path d="M 218 95 l -8 -4.5 v 9 z" fill="#87827B" />

      <rect x="226" y="62" width="170" height="66" rx="14" fill="#FAF9F5" stroke="#141413" strokeWidth="1.8" />
      <text x="311" y="90" textAnchor="middle" fontSize="14" fontWeight="600" fill="#141413">{tr({ zh: '安全分类器', en: 'Safety classifiers'
    })}</text>
      <text x="311" y="110" textAnchor="middle" fontSize="11.5" fill="#87827B">{tr({ zh: '独立 AI 系统实时检测', en: 'separate AI systems'
    })}</text>

      <line x1="396" y1="80" x2="500" y2="44" stroke="#CC785C" strokeWidth="2" />
      <path d="M 500 44 l -9.2 -1 4 8 z" fill="#CC785C" />
      <line x1="396" y1="112" x2="500" y2="148" stroke="#87827B" strokeWidth="1.5" strokeDasharray="5 4" />
      <path d="M 500 148 l -8.7 -3 1.6 8.8 z" fill="#87827B" />

      <rect x="508" y="14" width="240" height="58" rx="14" fill="#D97757" opacity="0.14" stroke="#CC785C" strokeWidth="1.8" />
      <text x="628" y="38" textAnchor="middle" fontSize="14" fontWeight="600" fill="#CC785C">Claude Fable 5</text>
      <text x="628" y="58" textAnchor="middle" fontSize="11.5" fill="#534F4A">{tr({ zh: '≥ 95% 的会话', en: '≥ 95% of sessions'
    })}</text>

      <rect x="508" y="118" width="240" height="58" rx="14" fill="none" stroke="#CFC9BA" strokeWidth="1.5" />
      <text x="628" y="142" textAnchor="middle" fontSize="14" fill="#141413">{tr({ zh: '回退 Claude Opus 4.8', en: 'Fallback to Opus 4.8' })}</text>
      <text x="628" y="162" textAnchor="middle" fontSize="11.5" fill="#87827B">{tr({ zh: '高风险命中,< 5% 的会话', en: 'flagged, < 5% of sessions'
    })}</text>
    </svg>
  );
}

/* ── benchmark bar chart ──────────────────────────────────────────── */
interface BenchRow { label: string; value: number; self?: boolean }
function BenchCard({ name, desc, rows, min = 0, max, fmt }: {
  name: string; desc: string; rows: BenchRow[]; min?: number; max: number;
  fmt?: (v: number) => string;
}) {
  const f = fmt ?? ((v: number) => `${v}%`);
  return (
    <div className="fable-bench-card">
      <div className="fable-bench-name">{name}</div>
      <div className="fable-bench-desc">{desc}</div>
      {rows.map((r) => (
        <div key={r.label} className={`fable-bench-row${r.self ? ' is-self' : ''}`}>
          <div className="fable-bench-meta">
            <span className="fable-bench-label">{r.label}</span>
            <span className="fable-bench-value">{f(r.value)}</span>
          </div>
          <div className="fable-bench-track">
            <div className="fable-bench-fill" style={{ width: `${((r.value - min) / (max - min)) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FablePage() {
  useTranslation(); // subscribe to language changes for tr()
  useDocumentTitle('Claude Fable 5', 'Claude Fable 5');

  return (
    <div className="fable-page">
      <div className="fable-shell">

        <div className="fable-top">
          <Link href="/code/llm" className="fable-top-home" prefetch={false}>
            <ArrowLeft size={15} strokeWidth={2} />
            /code/llm
          </Link>
          <span className="fable-top-mark">Claude <em>Fable 5</em></span>
        </div>

        {/* ── Hero ── */}
        <header className="fable-hero">
          <div>
            <div className="fable-eyebrow">{tr({ zh: 'Anthropic · 2026 年 6 月 9 日发布', en: 'Anthropic · Released June 9, 2026'
            })}</div>
            <h1>{tr({ zh: '迄今最强的 Claude,', en: 'The most capable Claude yet,'
            })}<br /><em>{tr({ zh: '首次面向所有人。', en: 'now for everyone.' })}</em></h1>
            <p className="fable-lede">
              {tr({
                zh: 'Claude Fable 5 是 Anthropic 首个公开可用的 Mythos 级模型 — 在软件工程、知识工作、视觉理解与科学研究上几乎全面刷新已发布模型的最高水平,同时以实时安全分类器护航。',
                en: 'Claude Fable 5 is Anthropic’s first generally available Mythos-class model — state-of-the-art on nearly every tested benchmark across software engineering, knowledge work, vision and scientific research, shipped behind real-time safety classifiers.'
            })}
            </p>
            <div className="fable-hero-ctas">
              <a className="fable-btn fable-btn-dark" href="https://www.anthropic.com/news/claude-fable-5-mythos-5" target="_blank" rel="noopener noreferrer">
                {tr({ zh: '官方公告', en: 'Official announcement' })}
                <ArrowUpRight size={15} />
              </a>
              <a className="fable-btn fable-btn-ghost" href="https://platform.claude.com/docs/en/about-claude/models/overview" target="_blank" rel="noopener noreferrer">
                {tr({ zh: '模型文档', en: 'Model docs'
                })}
                <ArrowUpRight size={15} />
              </a>
              <span className="fable-model-chip">claude-fable-5</span>
            </div>
          </div>
          <HeroArt />
        </header>

        {/* ── Stat band ── */}
        <div className="fable-stats">
          <div className="fable-stat">
            <div className="fable-stat-num">1M</div>
            <div className="fable-stat-label">{tr({ zh: '上下文窗口(token),标准定价无长上下文加价', en: 'context window (tokens), standard pricing'
            })}</div>
          </div>
          <div className="fable-stat">
            <div className="fable-stat-num">128K</div>
            <div className="fable-stat-label">{tr({ zh: '最大输出 token', en: 'max output tokens'
            })}</div>
          </div>
          <div className="fable-stat">
            <div className="fable-stat-num">$10<small>/$50</small></div>
            <div className="fable-stat-label">{tr({ zh: '每百万输入 / 输出 token,约为 Mythos Preview 一半', en: 'per million input / output tokens — about half of Mythos Preview'
            })}</div>
          </div>
          <div className="fable-stat">
            <div className="fable-stat-num">80.3<small>%</small></div>
            <div className="fable-stat-label">{tr({ zh: 'SWE-bench Pro,真实软件工程任务', en: 'SWE-bench Pro, real-world software engineering'
            })}</div>
          </div>
        </div>

        {/* ── What is Fable 5 ── */}
        <section className="fable-section">
          <div className="fable-kicker">{tr({ zh: '它是什么', en: 'What it is'
        })}</div>
          <h2>{tr({ zh: '一个模型,两种形态。', en: 'One model, two faces.'
        })}</h2>
          <div className="fable-duo">
            <div className="fable-prose">
              <p>
                {tr({
                  zh: 'Fable 5 与 Mythos 5 是同一个底层模型,差别只在安全层:Fable 5 启用全部防护,面向所有人开放;Mythos 5 解除部分防护,仅限网络安全专家与(即将开放的)生物医学研究者通过受信通道使用。',
                  en: 'Fable 5 and Mythos 5 share the exact same underlying model — the only difference is the safety layer. Fable 5 ships with all safeguards on and is open to everyone; Mythos 5 lifts some of them and is restricted to vetted cybersecurity professionals and, soon, biomedical researchers.'
                })}
              </p>
              <p>
                {tr({
                  zh: '在 Claude 产品线中,它是位于 Opus 之上的全新档位:专为复杂、长程的自主工作而生 — 通宵级代码重构、数周的自主科研、跨百万行代码库的迁移。',
                  en: 'Within the Claude lineup it is a new tier above Opus, built for complex, long-running autonomous work — overnight refactors, weeks-long independent research, migrations across codebases of tens of millions of lines.'
                })}
              </p>
              <p>
                {tr({
                  zh: '"Mythos" 是 Anthropic 内部的代号系列,代表其当下能力天花板。Fable 5 把这条天花板第一次以安全可控的方式交到每一个开发者手里。',
                  en: '“Mythos” is Anthropic’s internal codename for its current capability ceiling. Fable 5 is the first time that ceiling has been placed, safely, in the hands of every developer.'
                })}
              </p>
            </div>
            <div className="fable-twin-card">
              <TwinArt />
              <div className="fable-twin-note">
                {tr({
                  zh: '同一权重,不同防护。Fable 5 = Mythos 5 + 实时安全分类器;架构与能力完全一致。',
                  en: 'Same weights, different guardrails. Fable 5 = Mythos 5 + real-time safety classifiers; architecture and capability are identical.'
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Where it sits in the family ── */}
        <section className="fable-section">
          <div className="fable-kicker">{tr({ zh: '在 Claude 家族中的位置', en: 'Where it sits' })}</div>
          <h2>{tr({ zh: 'Opus 之上,全新一档。', en: 'A whole new step above Opus.'
        })}</h2>
          <p className="fable-section-sub">
            {tr({
              zh: '过去 Opus 是 Claude 智能的顶点。Fable 5 在它之上又叠了一层,专门接住那些"一个 Opus 跑不完"的长程任务。',
              en: 'Opus used to be the peak of Claude intelligence. Fable 5 stacks a new layer on top of it, built to catch the long-horizon tasks a single Opus couldn’t finish.'
            })}
          </p>
          <TierLadder />
        </section>

        {/* ── Benchmarks ── */}
        <section className="fable-section">
          <div className="fable-kicker">{tr({ zh: '基准测试', en: 'Benchmarks'
        })}</div>
          <h2>{tr({ zh: '几乎所有测试基准的新高。', en: 'State of the art, nearly across the board.'
        })}</h2>
          <p className="fable-section-sub">
            {tr({
              zh: '以下为 Anthropic 官方公布数字,对比对象为各家当前旗舰:Claude Opus 4.8、OpenAI GPT-5.5 与 Google Gemini 3.1 Pro。',
              en: 'Numbers below are Anthropic’s official figures, compared against current flagships: Claude Opus 4.8, OpenAI GPT-5.5 and Google Gemini 3.1 Pro.'
            })}
          </p>
          <div className="fable-bench-grid">
            <BenchCard
              name="SWE-bench Pro"
              desc={tr({ zh: '真实仓库级软件工程任务解决率', en: 'Real repository-level software engineering'
            })}
              max={100}
              rows={[
                { label: 'Claude Fable 5', value: 80.3, self: true },
                { label: 'GPT-5.5', value: 58.6 },
              ]}
            />
            <BenchCard
              name="FrontierCode Diamond"
              desc={tr({ zh: 'Cognition 出品,前沿难度编程基准', en: 'Cognition’s frontier-difficulty coding benchmark'
            })}
              max={35}
              rows={[
                { label: 'Claude Fable 5', value: 29.3, self: true },
                { label: 'Claude Opus 4.8', value: 13.4 },
                { label: 'GPT-5.5', value: 5.7 },
              ]}
            />
            <BenchCard
              name="GDPval-AA"
              desc={tr({ zh: '跨行业真实知识工作,Elo 式评分', en: 'Real-world knowledge work across industries, Elo-style'
            })}
              min={1200}
              max={2000}
              fmt={(v) => `${v}`}
              rows={[
                { label: 'Claude Fable 5', value: 1932, self: true },
                { label: 'Claude Opus 4.8', value: 1890 },
                { label: 'GPT-5.5', value: 1769 },
                { label: 'Gemini 3.1 Pro', value: 1314 },
              ]}
            />
            <BenchCard
              name="GDPpdf"
              desc={tr({ zh: '复杂文档视觉推理,无工具', en: 'Complex document visual reasoning, no tools'
            })}
              max={35}
              rows={[
                { label: 'Claude Fable 5', value: 29.8, self: true },
                { label: 'GPT-5.5', value: 24.9 },
                { label: 'Claude Opus 4.8', value: 22.5 },
                { label: 'Gemini 3.1 Pro', value: 16.7 },
              ]}
            />
          </div>
          <div className="fable-bench-foot">
            {tr({
              zh: '另:内部核心分析基准首破 90%(较 Opus +10 分);Hebbia 金融基准、CursorBench 均为全模型最高分。',
              en: 'Also: first model past 90% on the internal core analytics benchmark (+10 vs Opus); highest score of any model on the Hebbia finance benchmark and CursorBench.'
            })}
          </div>
        </section>

        {/* ── Capabilities ── */}
        <section className="fable-section">
          <div className="fable-kicker">{tr({ zh: '能力', en: 'Capabilities' })}</div>
          <h2>{tr({ zh: '为长程自主工作而生。', en: 'Built for long-horizon autonomy.'
        })}</h2>
          <div className="fable-cap-grid">
            <div className="fable-cap-card">
              <div className="fable-cap-icon"><Code2 size={22} strokeWidth={1.8} /></div>
              <h3>{tr({ zh: '软件工程', en: 'Software engineering'
            })}</h3>
              <p>{tr({ zh: '以更少轮次完成更复杂的工程;长程编码任务的自主性与可靠性超越此前所有基准。', en: 'More capable engineering in fewer turns; autonomy and reliability on long-horizon coding beyond all previous baselines.'
            })}</p>
              <div className="fable-cap-fact">{tr({ zh: 'Stripe:5000 万行 Ruby 迁移,两个月压缩到一天', en: 'Stripe: a 50M-line Ruby migration, two months → one day'
            })}</div>
            </div>
            <div className="fable-cap-card">
              <div className="fable-cap-icon"><Bot size={22} strokeWidth={1.8} /></div>
              <h3>{tr({ zh: '自主智能体', en: 'Agentic autonomy'
            })}</h3>
              <p>{tr({ zh: '比以往任何 Claude 工作更久:自主玩 Factorio 建厂、独立完成 CAD 建模、连续数周的自主基因组学研究。', en: 'Works autonomously longer than any prior Claude: self-directed Factorio factories, independent CAD modeling, weeks of unsupervised genomics research.'
            })}</p>
              <div className="fable-cap-fact">{tr({ zh: '从第一性原理推导轨道力学,自建太阳系模拟', en: 'Derived orbital mechanics from first principles for a solar-system sim'
            })}</div>
            </div>
            <div className="fable-cap-card">
              <div className="fable-cap-icon"><Eye size={22} strokeWidth={1.8} /></div>
              <h3>{tr({ zh: '视觉理解', en: 'Vision'
            })}</h3>
              <p>{tr({ zh: '从科学图表中提取精确数值、从截图重建网页应用源码,均为当前最高水平。', en: 'State of the art at extracting precise numbers from scientific figures and rebuilding web-app source code from screenshots.'
            })}</p>
              <div className="fable-cap-fact">{tr({ zh: '纯视觉通关《宝可梦 火红》,无需辅助脚手架', en: 'Beat Pokémon FireRed vision-only, no helper harness'
            })}</div>
            </div>
            <div className="fable-cap-card">
              <div className="fable-cap-icon"><Dna size={22} strokeWidth={1.8} /></div>
              <h3>{tr({ zh: '科学研究', en: 'Scientific research'
            })}</h3>
              <p>{tr({ zh: '蛋白质设计环节提速约十倍;盲测中分子生物学新假说约 80% 优于 Opus 级模型,其中一项已被独立验证。', en: 'Roughly 10× speed-up on parts of protein drug design; novel molecular-biology hypotheses preferred ~80% of the time over Opus-class models in blinded review — one independently corroborated.'
            })}</p>
              <div className="fable-cap-fact">{tr({ zh: '14 个蛋白靶点中 9 个产出强候选药物设计', en: '9 of 14 protein targets yielded strong drug-design candidates'
            })}</div>
            </div>
            <div className="fable-cap-card">
              <div className="fable-cap-icon"><BarChart3 size={22} strokeWidth={1.8} /></div>
              <h3>{tr({ zh: '知识工作', en: 'Knowledge work'
            })}</h3>
              <p>{tr({ zh: '文档推理、图表解读与求解全面增强;IMC 交易分析评测中"几乎全线满分"。', en: 'Substantial gains in document-based reasoning, chart and table interpretation and problem solving; “aced” IMC’s trading-analysis evaluations nearly across the board.'
            })}</p>
              <div className="fable-cap-fact">{tr({ zh: 'Hebbia 金融基准:全模型最高分', en: 'Hebbia finance benchmark: highest score of any model'
            })}</div>
            </div>
            <div className="fable-cap-card">
              <div className="fable-cap-icon"><Brain size={22} strokeWidth={1.8} /></div>
              <h3>{tr({ zh: '记忆', en: 'Memory'
            })}</h3>
              <p>{tr({ zh: '更擅长写下并利用基于文件的长期记忆,跨会话维持任务状态。', en: 'Markedly better at writing and using file-based memory to carry task state across sessions.'
            })}</p>
              <div className="fable-cap-fact">{tr({ zh: '《杀戮尖塔》:记忆带来的提升是 Opus 4.8 的 3 倍', en: 'Slay the Spire: memory helped 3× more than on Opus 4.8'
            })}</div>
            </div>
          </div>
        </section>

        {/* ── Real-world proof ── */}
        <section className="fable-section">
          <div className="fable-kicker">{tr({ zh: '真实战绩', en: 'In the wild'
        })}</div>
          <h2>{tr({ zh: '不是跑分,是干完了活。', en: 'Not benchmarks — finished work.'
        })}</h2>
          <p className="fable-section-sub">
            {tr({
              zh: 'Anthropic 与早期合作伙伴公布的一批真实任务,涵盖工程、游戏、科研与仿真。',
              en: 'A set of real tasks Anthropic and early partners ran — spanning engineering, games, science and simulation.'
            })}
          </p>
          <div className="fable-proof-grid">
            <div className="fable-proof-card">
              <div className="fable-proof-icon"><GitBranch size={20} strokeWidth={1.8} /></div>
              <div className="fable-proof-stat">2 {tr({ zh: '月', en: 'mo' })} → 1 {tr({ zh: '天', en: 'day' })}</div>
              <div className="fable-proof-title">{tr({ zh: 'Stripe 代码迁移', en: 'Stripe migration'
            })}</div>
              <div className="fable-proof-desc">{tr({ zh: '5000 万行 Ruby 代码库的迁移,团队预估两个月,Fable 5 一天跑完。', en: 'A 50-million-line Ruby codebase migration the team budgeted two months for — done in a day.'
            })}</div>
            </div>
            <div className="fable-proof-card">
              <div className="fable-proof-icon"><Gamepad2 size={20} strokeWidth={1.8} /></div>
              <div className="fable-proof-stat">{tr({ zh: '纯视觉', en: 'vision-only'
            })}</div>
              <div className="fable-proof-title">{tr({ zh: '通关《宝可梦 火红》', en: 'Beat Pokémon FireRed'
            })}</div>
              <div className="fable-proof-desc">{tr({ zh: '仅凭屏幕画面完成整局游戏,无需此前 Claude 需要的复杂辅助脚手架。', en: 'Played to the end from raw screen pixels — no helper harness earlier Claude models needed.'
            })}</div>
            </div>
            <div className="fable-proof-card">
              <div className="fable-proof-icon"><Microscope size={20} strokeWidth={1.8} /></div>
              <div className="fable-proof-stat">9 / 14</div>
              <div className="fable-proof-title">{tr({ zh: '蛋白质药物设计', en: 'Protein drug design'
            })}</div>
              <div className="fable-proof-desc">{tr({ zh: '14 个蛋白靶点中 9 个产出强候选;内部专家称药物设计环节提速约十倍。', en: '9 of 14 protein targets yielded strong candidates; experts saw ~10× speed-up on parts of drug design.'
            })}</div>
            </div>
            <div className="fable-proof-card">
              <div className="fable-proof-icon"><Dna size={20} strokeWidth={1.8} /></div>
              <div className="fable-proof-stat">138 {tr({ zh: '物种', en: 'species'
            })}</div>
              <div className="fable-proof-title">{tr({ zh: '自主基因组学', en: 'Autonomous genomics'
            })}</div>
              <div className="fable-proof-desc">{tr({ zh: '连续数周自主识别 138 个物种中功能相同的细胞;自训 ML 模型比体量大 100 倍的近期论文更强。', en: 'Weeks of unsupervised work matching cells with identical roles across 138 species; a custom model beat a recent Science paper at 1/100th the size.'
            })}</div>
            </div>
            <div className="fable-proof-card">
              <div className="fable-proof-icon"><Factory size={20} strokeWidth={1.8} /></div>
              <div className="fable-proof-stat">{tr({ zh: '自主建厂', en: 'self-built'
            })}</div>
              <div className="fable-proof-title">Factorio</div>
              <div className="fable-proof-desc">{tr({ zh: '在《异星工厂》里自主规划并搭建生产线,无需逐步人工指令。', en: 'Planned and built factory lines in Factorio on its own, without step-by-step human instructions.'
            })}</div>
            </div>
            <div className="fable-proof-card">
              <div className="fable-proof-icon"><Orbit size={20} strokeWidth={1.8} /></div>
              <div className="fable-proof-stat">{tr({ zh: '第一性原理', en: 'first principles' })}</div>
              <div className="fable-proof-title">{tr({ zh: '太阳系模拟', en: 'Solar-system sim'
            })}</div>
              <div className="fable-proof-desc">{tr({ zh: '从第一性原理推导轨道力学,自建包含日月食的太阳系仿真。', en: 'Derived orbital mechanics from first principles to build a solar-system simulation, eclipses and all.'
            })}</div>
            </div>
          </div>
        </section>

        {/* ── vs Opus 4.8 ── */}
        <section className="fable-section">
          <div className="fable-kicker">{tr({ zh: '对比', en: 'Compared'
        })}</div>
          <h2>{tr({ zh: 'Fable 5 vs Opus 4.8。', en: 'Fable 5 vs Opus 4.8.' })}</h2>
          <p className="fable-section-sub">
            {tr({
              zh: '何时该升到 Fable 5,何时 Opus 4.8 已经够用 — 一张表说清。',
              en: 'When to reach for Fable 5, and when Opus 4.8 is already enough.'
            })}
          </p>
          <div className="fable-price-wrap">
            <table className="fable-cmp-table">
              <thead>
                <tr>
                  <th>{tr({ zh: '维度', en: 'Dimension'
                })}</th>
                  <th className="is-self">Fable 5</th>
                  <th>Opus 4.8</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{tr({ zh: '定位', en: 'Positioning' })}</td>
                  <td className="is-self">{tr({ zh: '最强通用模型,新顶档', en: 'Most powerful, new top tier'
                })}</td>
                  <td>{tr({ zh: '此前旗舰 Opus', en: 'Prior Opus flagship'
                })}</td>
                </tr>
                <tr>
                  <td>{tr({ zh: '输入 / 输出价', en: 'Input / output price'
                })}</td>
                  <td className="is-self num">$10 / $50</td>
                  <td className="num">$5 / $25</td>
                </tr>
                <tr>
                  <td>{tr({ zh: '上下文 / 输出', en: 'Context / output'
                })}</td>
                  <td className="is-self num">1M / 128K</td>
                  <td className="num">1M / 128K</td>
                </tr>
                <tr>
                  <td>FrontierCode Diamond</td>
                  <td className="is-self num">29.3%</td>
                  <td className="num">13.4%</td>
                </tr>
                <tr>
                  <td>GDPval-AA</td>
                  <td className="is-self num">1932</td>
                  <td className="num">1890</td>
                </tr>
                <tr>
                  <td>{tr({ zh: '核心分析基准', en: 'Core analytics'
                })}</td>
                  <td className="is-self num">&gt; 90%</td>
                  <td className="num">~80%</td>
                </tr>
                <tr>
                  <td>{tr({ zh: '长程 / 记忆任务', en: 'Long-horizon / memory'
                })}</td>
                  <td className="is-self">{tr({ zh: '显著更强(记忆增益 3×)', en: 'Markedly stronger (3× memory gain)'
                })}</td>
                  <td>{tr({ zh: '强', en: 'Strong'
                })}</td>
                </tr>
                <tr>
                  <td>{tr({ zh: 'API 表面', en: 'API surface' })}</td>
                  <td className="is-self">{tr({ zh: '同 4.7/4.8 + 一处差异', en: 'Same as 4.7/4.8, one delta'
                })}</td>
                  <td>{tr({ zh: '自适应思考', en: 'Adaptive thinking'
                })}</td>
                </tr>
                <tr>
                  <td>{tr({ zh: '安全回退', en: 'Safety fallback' })}</td>
                  <td className="is-self">{tr({ zh: '高风险时回退 Opus 4.8', en: 'Falls back to Opus 4.8'
                })}</td>
                  <td><Minus size={15} className="fable-cmp-na" /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="fable-bench-foot">
            {tr({
              zh: '一句话:吃不准、要长程自主、要最高智能 → Fable 5;成本敏感、任务清晰可控 → Opus 4.8 仍是极佳选择。',
              en: 'In short: long-horizon autonomy and maximum intelligence → Fable 5; cost-sensitive, well-scoped work → Opus 4.8 is still an excellent pick.'
            })}
          </div>
        </section>

        {/* ── Quotes ── */}
        <section className="fable-section">
          <div className="fable-kicker">{tr({ zh: '一线反馈', en: 'From the field'
        })}</div>
          <h2>{tr({ zh: '先行团队怎么说。', en: 'What early teams are saying.'
        })}</h2>
          <div className="fable-quote-grid">
            <blockquote className="fable-quote">
              <p>{tr({ zh: '"把数月的工程压缩成了几天。"', en: '“Compressed months of engineering into days.”'
            })}</p>
              <cite>Stripe</cite>
            </blockquote>
            <blockquote className="fable-quote">
              <p>{tr({ zh: '"打开了一类此前模型够不着的长程问题。"', en: '“Opened up a class of long-horizon problems that were out of reach for earlier models.”'
            })}</p>
              <cite>Michael Truell · Cursor CEO</cite>
            </blockquote>
            <blockquote className="fable-quote">
              <p>{tr({ zh: '"长程推理出色,对陌生工具开箱即用地泛化。"', en: '“Excels at long-horizon reasoning and generalizes to unfamiliar tools out of the box.”'
            })}</p>
              <cite>Scott Wu · Cognition CEO</cite>
            </blockquote>
            <blockquote className="fable-quote">
              <p>{tr({ zh: '"开发者可以把越来越有野心的工作交给智能体,并信任贯穿软件生命周期的结果。"', en: '“Developers can hand increasingly ambitious work to agents and trust the results across the software lifecycle.”'
            })}</p>
              <cite>Mario Rodriguez · GitHub CPO</cite>
            </blockquote>
          </div>
        </section>

        {/* ── Safety ── */}
        <section className="fable-section">
          <div className="fable-kicker">{tr({ zh: '安全', en: 'Safety' })}</div>
          <h2>{tr({ zh: '前沿能力,实时护栏。', en: 'Frontier capability, live guardrails.'
        })}</h2>
          <p className="fable-section-sub">
            {tr({
              zh: '独立的安全分类器实时检测潜在滥用(包括越狱尝试)。命中时请求自动回退到 Claude Opus 4.8,而不是生成有害内容 — 触发率平均不到 5%。',
              en: 'Separate AI classifiers detect potential misuse in real time, including jailbreak attempts. Flagged requests automatically fall back to Claude Opus 4.8 instead of producing harmful content — triggering in under 5% of sessions on average.'
            })}
          </p>
          <div className="fable-safety-flow"><SafetyFlow /></div>
          <div className="fable-safety-grid">
            <div className="fable-safety-card">
              <h3><ShieldCheck size={18} strokeWidth={1.9} />{tr({ zh: '网络安全', en: 'Cybersecurity'
            })}</h3>
              <p>{tr({ zh: '覆盖漏洞利用与进攻性任务。外部漏洞赏金 1000+ 小时未产生任何通用越狱;30 种公开越狱技术 0 通过。', en: 'Covers exploitation and offensive tasks. 1,000+ external bug-bounty hours produced zero universal jailbreaks; zero compliance across 30 public jailbreak techniques.'
            })}</p>
            </div>
            <div className="fable-safety-card">
              <h3><FlaskConical size={18} strokeWidth={1.9} />{tr({ zh: '生物与化学', en: 'Biology & chemistry'
            })}</h3>
              <p>{tr({ zh: '防护范围比以往更宽:模型已能完成真实科研任务,先从严防护,再随研究推进逐步收窄。', en: 'Broader scope than before: the model can now do real scientific work, so safeguards start conservative and will narrow as research progresses.'
            })}</p>
            </div>
            <div className="fable-safety-card">
              <h3><Lock size={18} strokeWidth={1.9} />{tr({ zh: '反蒸馏', en: 'Anti-distillation'
            })}</h3>
              <p>{tr({ zh: '检测以训练竞争模型为目的的能力提取行为,命中即回退 Opus 4.8。', en: 'Detects attempts to extract Fable 5’s capabilities for training competing models, routing them to Opus 4.8.'
            })}</p>
            </div>
          </div>
          <p className="fable-safety-foot">
            {tr({
              zh: '所有 Mythos 级流量保留 30 天用于防御复杂攻击与降低误报,之后强制删除;数据不用于训练新模型,所有人工访问均有日志。自动对齐评估中,Fable 5 的失准行为水平与 Opus 4.8 同为"低"。',
              en: 'All Mythos-class traffic is retained for 30 days to defend against sophisticated attacks and reduce false positives, then deleted; it is never used to train new models, and every human access is logged. Automated alignment assessment rates Fable 5’s misaligned behavior “low”, on par with Opus 4.8.'
            })}
          </p>
        </section>

        {/* ── Pricing & availability ── */}
        <section className="fable-section">
          <div className="fable-kicker">{tr({ zh: '定价与可用性', en: 'Pricing & availability'
        })}</div>
          <h2>{tr({ zh: 'Opus 之上的新档位。', en: 'A new tier above Opus.'
        })}</h2>
          <div className="fable-price-wrap">
            <table className="fable-price-table">
              <thead>
                <tr>
                  <th>{tr({ zh: '模型', en: 'Model' })}</th>
                  <th>{tr({ zh: '模型 ID', en: 'Model ID' })}</th>
                  <th>{tr({ zh: '上下文', en: 'Context' })}</th>
                  <th>{tr({ zh: '输入 $/百万', en: 'Input $/M'
                })}</th>
                  <th>{tr({ zh: '输出 $/百万', en: 'Output $/M'
                })}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="is-self">
                  <td>Claude Fable 5</td>
                  <td className="num">claude-fable-5</td>
                  <td className="num">1M</td>
                  <td className="num">$10.00</td>
                  <td className="num">$50.00</td>
                </tr>
                <tr>
                  <td>Claude Opus 4.8</td>
                  <td className="num">claude-opus-4-8</td>
                  <td className="num">1M</td>
                  <td className="num">$5.00</td>
                  <td className="num">$25.00</td>
                </tr>
                <tr>
                  <td>Claude Sonnet 4.6</td>
                  <td className="num">claude-sonnet-4-6</td>
                  <td className="num">1M</td>
                  <td className="num">$3.00</td>
                  <td className="num">$15.00</td>
                </tr>
                <tr>
                  <td>Claude Haiku 4.5</td>
                  <td className="num">claude-haiku-4-5</td>
                  <td className="num">200K</td>
                  <td className="num">$1.00</td>
                  <td className="num">$5.00</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="fable-timeline">
            <div className="fable-tl-item is-hot">
              <div className="fable-tl-date">2026-06-09</div>
              <div className="fable-tl-title">{tr({ zh: '正式发布', en: 'General availability'
            })}</div>
              <div className="fable-tl-desc">{tr({ zh: 'API(claude-fable-5)、Claude Code、各端应用与企业按量通道同步开放;AWS / Vertex AI / Microsoft Foundry 三家云亦可部署。', en: 'Live on the API (claude-fable-5), Claude Code, the apps and consumption-based Enterprise; deployable on AWS, Vertex AI and Microsoft Foundry.'
            })}</div>
            </div>
            <div className="fable-tl-item is-hot">
              <div className="fable-tl-date">{tr({ zh: '06-09 ~ 06-22', en: 'Jun 9 – 22' })}</div>
              <div className="fable-tl-title">{tr({ zh: '订阅内免费体验', en: 'Included in plans'
            })}</div>
              <div className="fable-tl-desc">{tr({ zh: 'Pro / Max / Team / 席位制 Enterprise 套餐额度内直接使用,不额外收费。', en: 'Free within Pro, Max, Team and seat-based Enterprise plan limits at no extra cost.'
            })}</div>
            </div>
            <div className="fable-tl-item">
              <div className="fable-tl-date">{tr({ zh: '06-23 起', en: 'From Jun 23' })}</div>
              <div className="fable-tl-title">{tr({ zh: '转按量计费', en: 'Usage credits'
            })}</div>
              <div className="fable-tl-desc">{tr({ zh: '订阅内继续使用需消耗 usage credits;后续是否回归套餐取决于算力供给。', en: 'Continued use in subscriptions draws usage credits; return to plan inclusion depends on capacity.'
            })}</div>
            </div>
          </div>
        </section>

        {/* ── Developers ── */}
        <section className="fable-section">
          <div className="fable-kicker">{tr({ zh: '面向开发者', en: 'For developers'
        })}</div>
          <h2>{tr({ zh: '与 Opus 4.7/4.8 同一套 API 表面。', en: 'Same API surface as Opus 4.7/4.8.'
        })}</h2>
          <div className="fable-dev">
            <pre className="fable-code">{`import Anthropic from `}<span className="tok-s">{`'@anthropic-ai/sdk'`}</span>{`;

const client = new Anthropic();

const msg = await client.messages.create({
  model: `}<span className="tok-s">{`'claude-fable-5'`}</span>{`,
  max_tokens: 64000,
  thinking: { type: `}<span className="tok-s">{`'adaptive'`}</span>{` },
  output_config: { effort: `}<span className="tok-s">{`'high'`}</span>{` },
  messages: [{
    role: `}<span className="tok-s">{`'user'`}</span>{`,
    content: `}<span className="tok-s">{`'Plan and execute the full refactor.'`}</span>{`,
  }],
});`}</pre>
            <div className="fable-dev-notes">
              <div className="fable-dev-note">
                <Check size={16} strokeWidth={2.2} />
                <span>{tr({ zh: '仅支持自适应思考:', en: 'Adaptive thinking only: '
                })}<code>{'thinking: { type: "adaptive" }'}</code>{tr({ zh: ';显式 disabled 会返回 400,不需要时直接省略该参数。', en: '; an explicit disabled returns 400 — omit the param instead.'
                })}</span>
              </div>
              <div className="fable-dev-note">
                <Check size={16} strokeWidth={2.2} />
                <span><code>temperature</code> / <code>top_p</code> / <code>top_k</code> {tr({ zh: '已移除,传入即 400;行为引导一律走提示词。', en: 'are removed and 400 on sight — steer behavior with prompting.'
                })}</span>
              </div>
              <div className="fable-dev-note">
                <Check size={16} strokeWidth={2.2} />
                <span>{tr({ zh: '思考深度走 ', en: 'Control depth with ' })}<code>effort</code>{tr({ zh: ':low / medium / high / xhigh / max;编码与智能体任务推荐 high 或 xhigh。', en: ': low / medium / high / xhigh / max — high or xhigh recommended for coding and agentic work.'
                })}</span>
              </div>
              <div className="fable-dev-note">
                <Check size={16} strokeWidth={2.2} />
                <span>{tr({ zh: '128K 输出需走 streaming;1M 上下文为标准定价,无长上下文加价。', en: '128K output requires streaming; the 1M context window is standard pricing with no long-context premium.'
                })}</span>
              </div>
              <div className="fable-dev-note">
                <Check size={16} strokeWidth={2.2} />
                <span>{tr({ zh: '支持 compaction(beta)、Task Budgets(beta)与结构化输出;提示缓存最小前缀 2048 token。', en: 'Supports compaction (beta), Task Budgets (beta) and structured outputs; prompt-cache minimum prefix is 2048 tokens.'
                })}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="fable-section">
          <div className="fable-kicker">{tr({ zh: '常见问题', en: 'FAQ'
        })}</div>
          <h2>{tr({ zh: '关于 Fable 5,你大概想问的。', en: 'The questions you’re probably asking.'
        })}</h2>
          <div className="fable-faq">
            <details className="fable-faq-item">
              <summary><Sparkles size={16} strokeWidth={1.9} />{tr({ zh: 'Fable 5 和 Opus 比,值得升吗?', en: 'Is Fable 5 worth upgrading from Opus?'
            })}</summary>
              <p>{tr({ zh: '需要最高智能、长程自主、或一次跑通复杂多步任务时值得;它的输入/输出价是 Opus 4.8 的两倍,成本敏感且任务清晰的场景,Opus 4.8 仍很划算。', en: 'Yes when you need maximum intelligence, long-horizon autonomy, or to one-shot a complex multi-step task. It costs 2× Opus 4.8 on tokens, so for cost-sensitive, well-scoped work Opus 4.8 remains a great value.'
            })}</p>
            </details>
            <details className="fable-faq-item">
              <summary><Lock size={16} strokeWidth={1.9} />{tr({ zh: 'Fable 5 和 Mythos 5 到底什么关系?', en: 'How are Fable 5 and Mythos 5 related?'
            })}</summary>
              <p>{tr({ zh: '同一个底层模型。Fable 5 开启全部安全防护、面向所有人;Mythos 5 解除部分防护,仅限受信的网络安全 / 生物医学研究者。能力与架构完全一致。', en: 'Same underlying model. Fable 5 has all safeguards on and is open to everyone; Mythos 5 lifts some of them for vetted cybersecurity / biomedical researchers. Capability and architecture are identical.'
            })}</p>
            </details>
            <details className="fable-faq-item">
              <summary><ShieldCheck size={16} strokeWidth={1.9} />{tr({ zh: '安全回退会影响我的正常使用吗?', en: 'Will the safety fallback affect normal use?'
            })}</summary>
              <p>{tr({ zh: '基本不会。回退只在高风险查询命中分类器时触发,平均不到 5% 的会话;其余 95%+ 直接由 Fable 5 处理。', en: 'Rarely. Fallback only fires when a high-risk query trips the classifiers — under 5% of sessions on average; the other 95%+ run on Fable 5 directly.'
            })}</p>
            </details>
            <details className="fable-faq-item">
              <summary><Code2 size={16} strokeWidth={1.9} />{tr({ zh: '从 Opus 4.8 迁过来要改代码吗?', en: 'Do I need code changes coming from Opus 4.8?'
            })}</summary>
              <p>{tr({ zh: '几乎不用 — 改 model 字符串即可。唯一差异:显式 thinking:{type:"disabled"} 会 400,不需要思考时省略该参数;temperature / top_p / top_k 与 4.7/4.8 一样已移除。', en: 'Almost none — swap the model string. The one delta: an explicit thinking:{type:"disabled"} returns 400, so omit the param when you don’t want thinking; temperature / top_p / top_k are removed just like on 4.7/4.8.'
            })}</p>
            </details>
            <details className="fable-faq-item">
              <summary><Rocket size={16} strokeWidth={1.9} />{tr({ zh: '6 月 22 日之后还能免费用吗?', en: 'Can I still use it free after June 22?'
            })}</summary>
              <p>{tr({ zh: '6/9–6/22 在 Pro / Max / Team / 席位制 Enterprise 套餐内免费;6/23 起订阅内继续使用需消耗 usage credits,是否回归套餐取决于算力供给。API 一直按 $10/$50 计费。', en: 'Free within Pro / Max / Team / seat-based Enterprise from Jun 9–22; from Jun 23, continued subscription use draws usage credits, and return to plan inclusion depends on capacity. The API always bills at $10/$50.'
            })}</p>
            </details>
          </div>
        </section>

        <footer className="fable-footer">
          <span>{tr({ zh: '数据来源:', en: 'Sources: '
        })}</span>
          <a href="https://www.anthropic.com/news/claude-fable-5-mythos-5" target="_blank" rel="noopener noreferrer">Anthropic — Claude Fable 5 and Mythos 5</a>
          <a href="https://platform.claude.com/docs/en/about-claude/models/overview" target="_blank" rel="noopener noreferrer">Claude Platform — Models overview</a>
        </footer>

      </div>
    </div>
  );
}
