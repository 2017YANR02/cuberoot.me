'use client';

// Claude Sonnet 5 intro — standalone page styled after anthropic.com's own
// design language (ivory / ink / book-cloth coral, serif display type),
// mirroring the sibling /code/llm/fable page. Route: /code/llm/sonnet-5
// Sources: anthropic.com/news/claude-sonnet-5 (2026-06-30), the Claude
// Platform models-overview doc, the Claude Sonnet 5 system card, and
// independent press coverage (TechCrunch, The Decoder) cross-checked for the
// benchmark table below.

import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ArrowUpRight, Code2, Terminal, Globe, Bot, ShieldCheck, Lock,
  Check, Minus, Scale, Sparkles, Rocket, Briefcase, Gauge,
} from 'lucide-react';
import Link from '@/components/AppLink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import './sonnet-5.css';

/* ── hero — Anthropic-style radiant burst, motion-streaked variant ──── */
function HeroArt() {
  const cx = 210, cy = 200, r0 = 62;
  const rays: React.ReactNode[] = [];
  const N = 48;
  // round to fixed precision so SSR/CSR Math.sin tail differences don't
  // trigger a hydration mismatch
  const q = (n: number) => Number(n.toFixed(2));
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    // motion-streak: lengths skew so one side of the burst trails longer
    const skew = 0.55 + 0.45 * Math.cos(a - 0.6);
    const len = (20 + 26 * Math.abs(Math.sin(i * 0.65))) * skew;
    const r1 = r0 + 14;
    const r2 = r1 + len;
    const coral = i % 5 === 0;
    rays.push(
      <line
        key={i}
        x1={q(cx + Math.cos(a) * r1)} y1={q(cy + Math.sin(a) * r1)}
        x2={q(cx + Math.cos(a) * r2)} y2={q(cy + Math.sin(a) * r2)}
        stroke={coral ? '#CC785C' : '#141413'}
        strokeWidth={i % 2 ? 1.3 : 2.4}
        strokeLinecap="round"
        opacity={coral ? 0.9 : 0.95}
      />,
    );
  }
  return (
    <svg className="s5-hero-art" viewBox="0 0 420 400" role="img" aria-hidden="true">
      <defs>
        <radialGradient id="s5Core" cx="42%" cy="38%" r="72%">
          <stop offset="0%" stopColor="#E8956F" />
          <stop offset="58%" stopColor="#D97757" />
          <stop offset="100%" stopColor="#C2624A" />
        </radialGradient>
      </defs>
      {rays}
      <circle cx={cx} cy={cy} r={r0 + 6} fill="none" stroke="#141413" strokeWidth="1" opacity="0.25" />
      <circle cx={cx} cy={cy} r={r0} fill="url(#s5Core)" stroke="#141413" strokeWidth="2.5" />
      <circle cx={cx} cy={cy} r={r0 - 13} fill="none" stroke="#FAF9F5" strokeWidth="1.4" opacity="0.5" />
      {/* abstract emblem inside core — two chevrons in forward motion, agent/exec glyph */}
      <path d={`M ${cx - 18} ${cy - 20} L ${cx + 2} ${cy} L ${cx - 18} ${cy + 20}`} fill="none" stroke="#FAF9F5" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.94" />
      <path d={`M ${cx} ${cy - 20} L ${cx + 20} ${cy} L ${cx} ${cy + 20}`} fill="none" stroke="#FAF9F5" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      {/* sparkle accents */}
      <path d="M 58 76 l 5 14 14 5 -14 5 -5 14 -5 -14 -14 -5 14 -5 z" fill="#CC785C" />
      <path d="M 362 290 l 4 11 11 4 -11 4 -4 11 -4 -11 -11 -4 11 -4 z" fill="#141413" />
      <path d="M 346 84 l 3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3 z" fill="#141413" opacity="0.5" />
    </svg>
  );
}

/* ── Claude family tier ladder ────────────────────────────────────── */
function TierLadder() {
  const tiers = [
    { name: 'Haiku 4.5', w: 28, sub: tr({ zh: '最快最省', en: 'fastest, cheapest' }) },
    { name: 'Sonnet 5', w: 55, sub: tr({ zh: '速度与智能的新平衡', en: 'new balance of speed × intelligence' }), self: true },
    { name: 'Opus 4.8', w: 80, sub: tr({ zh: '更强, 价格更高', en: 'more capable, costs more' }) },
    { name: 'Fable 5', w: 100, sub: tr({ zh: '当前能力天花板', en: 'current capability ceiling' }) },
  ];
  return (
    <div className="s5-ladder">
      {tiers.map((t) => (
        <div key={t.name} className={`s5-ladder-row${t.self ? ' is-self' : ''}`}>
          <div className="s5-ladder-name">{t.name}</div>
          <div className="s5-ladder-track">
            <div className="s5-ladder-fill" style={{ width: `${t.w}%` }} />
          </div>
          <div className="s5-ladder-sub">{t.sub}</div>
        </div>
      ))}
    </div>
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
    <div className="s5-bench-card">
      <div className="s5-bench-name">{name}</div>
      <div className="s5-bench-desc">{desc}</div>
      {rows.map((r) => (
        <div key={r.label} className={`s5-bench-row${r.self ? ' is-self' : ''}`}>
          <div className="s5-bench-meta">
            <span className="s5-bench-label">{r.label}</span>
            <span className="s5-bench-value">{f(r.value)}</span>
          </div>
          <div className="s5-bench-track">
            <div className="s5-bench-fill" style={{ width: `${((r.value - min) / (max - min)) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Sonnet5Page() {
  useTranslation(); // subscribe to language changes for tr()
  useDocumentTitle('Claude Sonnet 5', 'Claude Sonnet 5');

  return (
    <div className="s5-page">
      <div className="s5-shell">

        <div className="s5-top">
          <Link href="/code/llm" className="s5-top-home" prefetch={false}>
            <ArrowLeft size={15} strokeWidth={2} />
            /code/llm
          </Link>
          <span className="s5-top-mark">Claude <em>Sonnet 5</em></span>
        </div>

        {/* ── Hero ── */}
        <header className="s5-hero">
          <div>
            <div className="s5-eyebrow">{tr({ zh: '2026 年 6 月 30 日发布', en: 'Released June 30, 2026' })}</div>
            <h1>{tr({ zh: '最敏捷的 Sonnet,', en: 'The most agentic Sonnet yet,' })}<br /><em>{tr({ zh: '价格只是 Opus 的零头。', en: 'at a fraction of Opus pricing.' })}</em></h1>
            <p className="s5-lede">
              {tr({
                zh: 'Claude Sonnet 5 是迄今最具自主智能体能力的 Sonnet 模型 — 能自己制定计划、调用浏览器与终端这类工具, 并以几个月前还需要更大更贵模型才能达到的水平自主运行。',
                en: 'Claude Sonnet 5 is built to be the most agentic Sonnet model yet. It can make plans, use tools like browsers and terminals, and run autonomously at a level that, just a few months ago, required larger and more expensive models.'
              })}
            </p>
            <div className="s5-hero-ctas">
              <a className="s5-btn s5-btn-dark" href="https://www.anthropic.com/news/claude-sonnet-5" target="_blank" rel="noopener noreferrer">
                {tr({ zh: '官方公告', en: 'Official announcement' })}
                <ArrowUpRight size={15} />
              </a>
              <a className="s5-btn s5-btn-ghost" href="https://platform.claude.com/docs/en/about-claude/models/overview" target="_blank" rel="noopener noreferrer">
                {tr({ zh: '模型文档', en: 'Model docs' })}
                <ArrowUpRight size={15} />
              </a>
              <span className="s5-model-chip">claude-sonnet-5</span>
            </div>
          </div>
          <HeroArt />
        </header>

        {/* ── Stat band ── */}
        <div className="s5-stats">
          <div className="s5-stat">
            <div className="s5-stat-num">1<small>M</small></div>
            <div className="s5-stat-label">{tr({ zh: '上下文窗口(token), 最高输出 128K', en: 'context window (tokens), max output 128K' })}</div>
          </div>
          <div className="s5-stat">
            <div className="s5-stat-num">$2<small>/$10</small></div>
            <div className="s5-stat-label">{tr({ zh: '每百万输入/输出 token, 2026-08-31 前的开局价', en: 'per million input / output tokens, intro pricing through 2026-08-31' })}</div>
          </div>
          <div className="s5-stat">
            <div className="s5-stat-num">63.2<small>%</small></div>
            <div className="s5-stat-label">{tr({ zh: 'SWE-bench Pro, 真实仓库级软件工程', en: 'SWE-bench Pro, real repository-level engineering' })}</div>
          </div>
          <div className="s5-stat">
            <div className="s5-stat-num">80.4<small>%</small></div>
            <div className="s5-stat-label">{tr({ zh: 'Terminal-Bench 2.1, 终端自主操作', en: 'Terminal-Bench 2.1, autonomous terminal use' })}</div>
          </div>
        </div>

        {/* ── What is Sonnet 5 ── */}
        <section className="s5-section">
          <div className="s5-kicker">{tr({ zh: '它是什么', en: 'What it is' })}</div>
          <h2>{tr({ zh: 'Sonnet 一代的新旗手, 不是缩水版 Opus。', en: 'The new Sonnet flagship, not a watered-down Opus.' })}</h2>
          <div className="s5-duo">
            <div className="s5-prose">
              <p>
                {tr({
                  zh: 'Sonnet 5 接替 Sonnet 4.6, 继续坐在 Claude 家族 "速度与智能均衡" 的位置上 — Haiku 之上、Opus 之下。它的卖点不是单项跑分第一, 而是把代理式编码、工具调用、长链路任务自动化这几条线一次性拉到接近 Opus 4.8 的水平, 定价却只是 Opus 的一个零头。',
                  en: 'Sonnet 5 succeeds Sonnet 4.6 and keeps the family’s "speed × intelligence" seat — above Haiku, below Opus. Its pitch isn’t a single chart-topping score; it’s pulling agentic coding, tool use, and long-chain task automation up close to Opus 4.8 simultaneously, at a fraction of Opus pricing.'
                })}
              </p>
              <p>
                {tr({
                  zh: 'API 表面延续 Opus 4.7 起的世代: 只支持 adaptive thinking(自适应思考), 没有可显式开关的 extended thinking 参数; effort 这个思考强度旋钮在 API 与 Claude Code 里默认就是 high。',
                  en: 'The API surface continues the Opus 4.7-era generation: only adaptive thinking is supported, with no explicit extended-thinking toggle; the effort knob defaults to high on the API and in Claude Code.'
                })}
              </p>
              <p>
                {tr({
                  zh: '一个值得留意的细节: Sonnet 5 换了新分词器, 同样的文本现在大约多切出 1.0 - 1.35 倍的 token(具体倍数取决于内容类型), 不是 Opus 4.7 那次约 30% 的固定涨幅, 但升级计费时仍值得把这点算进预算。',
                  en: 'One detail worth flagging: Sonnet 5 ships an updated tokenizer that turns the same text into roughly 1.0–1.35× more tokens than before (the exact multiplier depends on content type) — not the flat ~30% jump Opus 4.7 took, but still worth budgeting for when you migrate.'
                })}
              </p>
            </div>
            <div className="s5-side-card">
              <TierLadder />
              <div className="s5-side-note">
                {tr({
                  zh: 'Claude 家族当前四档定位: Haiku 4.5 最快最省, Sonnet 5 速度与智能新平衡, Opus 4.8 更强但更贵, Fable 5 是 2026-06-09 上线的最高档。',
                  en: 'The current four-tier Claude lineup: Haiku 4.5 is fastest and cheapest, Sonnet 5 is the new speed × intelligence balance, Opus 4.8 is stronger but pricier, and Fable 5 (shipped 2026-06-09) sits at the top.'
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Benchmarks ── */}
        <section className="s5-section">
          <div className="s5-kicker">{tr({ zh: '基准测试', en: 'Benchmarks' })}</div>
          <h2>{tr({ zh: '逼近 Opus 4.8, 价格却不到一半。', en: 'Closing in on Opus 4.8, at less than half the price.' })}</h2>
          <p className="s5-section-sub">
            {tr({
              zh: '以下数字综合官方公告与独立报道(TechCrunch、The Decoder)交叉核实, 对比对象为 Sonnet 4.6 与当前 Opus 4.8。',
              en: 'The numbers below cross-check Anthropic’s announcement against independent coverage (TechCrunch, The Decoder), compared against Sonnet 4.6 and the current Opus 4.8.'
            })}
          </p>
          <div className="s5-bench-grid">
            <BenchCard
              name="SWE-bench Pro"
              desc={tr({ zh: '真实仓库级软件工程任务解决率', en: 'Real repository-level software engineering' })}
              max={100}
              rows={[
                { label: 'Claude Opus 4.8', value: 69.2 },
                { label: 'Claude Sonnet 5', value: 63.2, self: true },
                { label: 'Claude Sonnet 4.6', value: 58.1 },
              ]}
            />
            <BenchCard
              name="Terminal-Bench 2.1"
              desc={tr({ zh: '终端工具调用与自主操作', en: 'Terminal tool use and autonomous operation' })}
              max={100}
              rows={[
                { label: 'Claude Sonnet 5', value: 80.4, self: true },
                { label: 'Claude Sonnet 4.6', value: 67.0 },
              ]}
            />
            <BenchCard
              name="OSWorld-Verified"
              desc={tr({ zh: '计算机使用(屏幕操作)代理评测', en: 'Computer-use (screen operation) agent eval' })}
              max={100}
              rows={[
                { label: 'Claude Sonnet 5', value: 81.2, self: true },
                { label: 'Claude Sonnet 4.6', value: 78.5 },
              ]}
            />
            <BenchCard
              name="GDPval-AA v2"
              desc={tr({ zh: '跨行业真实知识工作, Elo 式评分', en: 'Real-world knowledge work across industries, Elo-style' })}
              min={1500}
              max={1700}
              fmt={(v) => `${v}`}
              rows={[
                { label: 'Claude Sonnet 5', value: 1618, self: true },
                { label: 'Claude Opus 4.8', value: 1615 },
              ]}
            />
          </div>
          <div className="s5-bench-foot">
            {tr({
              zh: '另: Humanity’s Last Exam 上 Sonnet 5 得分 57.4%, 已非常接近 Opus 4.8 的 57.9%(该基准本轮评分方法做了调整, 与更早版本的分数不可直接比较); GDPval-AA v2 是该基准的更新版本, 与此前 v1 的分数同样不可直接比较, 但 Sonnet 5 已经在知识工作这条线上反超 Opus 4.8。',
              en: 'Also: on Humanity’s Last Exam, Sonnet 5 scores 57.4%, nearly matching Opus 4.8’s 57.9% (this round’s scoring methodology was revised, so it isn’t directly comparable to older figures); GDPval-AA v2 is an updated benchmark version not directly comparable to v1 scores either, but Sonnet 5 has already overtaken Opus 4.8 on this knowledge-work line.'
            })}
          </div>
        </section>

        {/* ── Capabilities ── */}
        <section className="s5-section">
          <div className="s5-kicker">{tr({ zh: '能力', en: 'Capabilities' })}</div>
          <h2>{tr({ zh: '为代理式工作流而生。', en: 'Built for agentic workflows.' })}</h2>
          <div className="s5-cap-grid">
            <div className="s5-cap-card">
              <div className="s5-cap-icon"><Bot size={22} strokeWidth={1.8} /></div>
              <h3>{tr({ zh: '多步规划与自主执行', en: 'Multi-step planning and autonomous execution' })}</h3>
              <p>{tr({ zh: '自己拆解任务、排出步骤, 中途不需要逐步人工确认就能把多步工作流跑到底。', en: 'Breaks a task into steps on its own and carries a multi-step workflow through without step-by-step hand-holding.' })}</p>
            </div>
            <div className="s5-cap-card">
              <div className="s5-cap-icon"><Globe size={22} strokeWidth={1.8} /></div>
              <h3>{tr({ zh: '浏览器与终端工具调用', en: 'Browser and terminal tool use' })}</h3>
              <p>{tr({ zh: 'BrowseComp(代理式搜索)与 OSWorld-Verified(计算机使用)上较 Sonnet 4.6 全面提升, 在不同 effort 档位下都是。', en: 'Improves over Sonnet 4.6 across the board on BrowseComp (agentic search) and OSWorld-Verified (computer use), at every effort level.' })}</p>
            </div>
            <div className="s5-cap-card">
              <div className="s5-cap-icon"><Code2 size={22} strokeWidth={1.8} /></div>
              <h3>{tr({ zh: '持续编码与调试', en: 'Sustained coding and debugging' })}</h3>
              <p>{tr({ zh: '在复杂上下文里稳定地写代码、改 bug; 对 "棕地代码"(遗留系统里没人想碰的部分)尤其擅长。', en: 'Codes and debugs reliably across complex contexts, with a particular edge on "brownfield code" — the legacy parts nobody wants to touch.' })}</p>
            </div>
            <div className="s5-cap-card">
              <div className="s5-cap-icon"><Sparkles size={22} strokeWidth={1.8} /></div>
              <h3>{tr({ zh: '不提示也会自查', en: 'Self-checks without being asked' })}</h3>
              <p>{tr({ zh: '不需要专门提示, 完成任务后会自己核对输出是否正确, 复现 bug 时会先写一个能复现问题的测试。', en: 'Verifies its own output without an explicit prompt to do so, and writes a reproducing test before fixing a bug it investigates.' })}</p>
            </div>
            <div className="s5-cap-card">
              <div className="s5-cap-icon"><Briefcase size={22} strokeWidth={1.8} /></div>
              <h3>{tr({ zh: '专业知识工作', en: 'Professional knowledge work' })}</h3>
              <p>{tr({ zh: '法律研究与分析、保险工作流自动化(投保受理、出险登记、损失记录)、实时数据探查与洞察都在能力范围内。', en: 'Covers legal research and analysis, insurance workflow automation (submission intake, FNOL, loss runs), and real-time data exploration.' })}</p>
            </div>
            <div className="s5-cap-card">
              <div className="s5-cap-icon"><Gauge size={22} strokeWidth={1.8} /></div>
              <h3>{tr({ zh: '更少步骤办成更多事', en: 'More done in fewer steps' })}</h3>
              <p>{tr({ zh: '同样的产出质量, 用更少的中间步骤和更紧凑的推理链达到, 直接体现为响应更快、token 花费更省。', en: 'Reaches the same output quality through fewer intermediate steps and a tighter reasoning chain — which shows up directly as faster responses and lower token spend.' })}</p>
            </div>
          </div>
        </section>

        {/* ── Quotes ── */}
        <section className="s5-section">
          <div className="s5-kicker">{tr({ zh: '一线反馈', en: 'From the field' })}</div>
          <h2>{tr({ zh: '早期用户怎么说。', en: 'What early users are saying.' })}</h2>
          <div className="s5-quote-grid">
            <blockquote className="s5-quote">
              <p>{tr({ zh: '"agent 守得住计划, 遵循我们的代码规范, 干净地完成多步改动, 而且成本可控。"', en: '“Agents stay on plan, follow our conventions, and ship clean multi-step changes, all at an efficient cost.”' })}</p>
              <cite><strong>Sualeh Asif</strong> · Co-founder, Cursor</cite>
            </blockquote>
            <blockquote className="s5-quote">
              <p>{tr({ zh: '"把一个两段式任务交给它, 它端到端跑完了 — 这种活以前经常卡在一半。"', en: '“We handed Claude Sonnet 5 a two-part job… it finished end to end. That used to stall halfway.”' })}</p>
              <cite><strong>Daniel Shepard</strong> · Senior Engineer, Zapier</cite>
            </blockquote>
            <blockquote className="s5-quote">
              <p>{tr({ zh: '"用更少步骤办成更多事, 产出质量不变, 但到达终点的路径更短。"', en: '“Gets more done with less. Same output quality, fewer steps to get there.”' })}</p>
              <cite><strong>Fabian Hedin</strong> · Co-founder, Lovable</cite>
            </blockquote>
            <blockquote className="s5-quote">
              <p>{tr({ zh: '"在我们最棘手的一批真实 PR 上测试, 它把每一个都扛了下来。"', en: '“We ran Claude Sonnet 5 against dozens of our most challenging real pull requests, and it carried each one through.”' })}</p>
              <cite><strong>Yusuke Kaji</strong> · GM, AI for Business, Rakuten</cite>
            </blockquote>
            <blockquote className="s5-quote">
              <p>{tr({ zh: '"它在棕地代码上状态最好 — 竞态条件、隐藏测试, 那些没人愿意碰的部分。"', en: '“Claude Sonnet 5 is at its best on brownfield code — race conditions, hidden tests, the parts nobody wants to touch.”' })}</p>
              <cite><strong>Dominic Elm</strong> · Founding Engineer, bolt.new</cite>
            </blockquote>
            <blockquote className="s5-quote">
              <p>{tr({ zh: '"推理步骤更紧凑, 让我们的用户明显更快地拿到答案。"', en: '“Claude Sonnet 5 reasons in tighter steps and gets our users to answers noticeably faster.”' })}</p>
              <cite><strong>Ryadh Dahimene</strong> · Director PM AI/ML, ClickHouse</cite>
            </blockquote>
          </div>
        </section>

        {/* ── vs Sonnet 4.6 / Opus 4.8 ── */}
        <section className="s5-section">
          <div className="s5-kicker">{tr({ zh: '对比', en: 'Compared' })}</div>
          <h2>{tr({ zh: 'Sonnet 5 vs Sonnet 4.6 vs Opus 4.8。', en: 'Sonnet 5 vs Sonnet 4.6 vs Opus 4.8.' })}</h2>
          <div className="s5-table-wrap">
            <table className="s5-cmp-table">
              <thead>
                <tr>
                  <th>{tr({ zh: '维度', en: 'Dimension' })}</th>
                  <th className="is-self">Sonnet 5</th>
                  <th>Sonnet 4.6</th>
                  <th>Opus 4.8</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{tr({ zh: '模型 ID', en: 'Model ID' })}</td>
                  <td className="is-self num">claude-sonnet-5</td>
                  <td className="num">claude-sonnet-4-6</td>
                  <td className="num">claude-opus-4-8</td>
                </tr>
                <tr>
                  <td>{tr({ zh: '输入 / 输出价(每百万 token)', en: 'Input / output price (per MTok)' })}</td>
                  <td className="is-self num">$2 / $10<sup>*</sup></td>
                  <td className="num">$3 / $15</td>
                  <td className="num">$5 / $25</td>
                </tr>
                <tr>
                  <td>{tr({ zh: '上下文 / 最高输出', en: 'Context / max output' })}</td>
                  <td className="is-self num">1M / 128K</td>
                  <td className="num">1M / 128K</td>
                  <td className="num">1M / 128K</td>
                </tr>
                <tr>
                  <td>SWE-bench Pro</td>
                  <td className="is-self num">63.2%</td>
                  <td className="num">58.1%</td>
                  <td className="num">69.2%</td>
                </tr>
                <tr>
                  <td>Terminal-Bench 2.1</td>
                  <td className="is-self num">80.4%</td>
                  <td className="num">67.0%</td>
                  <td className="num"><Minus size={15} className="s5-cmp-na" /></td>
                </tr>
                <tr>
                  <td>{tr({ zh: 'extended thinking', en: 'Extended thinking' })}</td>
                  <td className="is-self">{tr({ zh: '不支持', en: 'Not supported' })}</td>
                  <td>{tr({ zh: '支持', en: 'Supported' })}</td>
                  <td>{tr({ zh: '不支持', en: 'Not supported' })}</td>
                </tr>
                <tr>
                  <td>{tr({ zh: 'effort 默认档位', en: 'Default effort' })}</td>
                  <td className="is-self">{tr({ zh: 'high(API / Claude Code)', en: 'high (API / Claude Code)' })}</td>
                  <td>{tr({ zh: '— ', en: '—' })}</td>
                  <td>{tr({ zh: 'high(全部界面)', en: 'high (all surfaces)' })}</td>
                </tr>
                <tr>
                  <td>{tr({ zh: '网络安全防护级别', en: 'Cyber safeguard level' })}</td>
                  <td className="is-self">{tr({ zh: '标准(同 Opus 4.7/4.8)', en: 'Standard (same as Opus 4.7/4.8)' })}</td>
                  <td>{tr({ zh: '标准', en: 'Standard' })}</td>
                  <td>{tr({ zh: '标准', en: 'Standard' })}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="s5-bench-foot">
            {tr({ zh: '* $2 / $10 为 2026-08-31 前的开局价, 此后回到标准价 $3 / $15。', en: '* $2 / $10 is introductory pricing through 2026-08-31; standard pricing of $3 / $15 applies after that.' })}
          </div>
          <div className="s5-bench-foot" style={{ marginTop: 6 }}>
            {tr({
              zh: '一句话: 预算有限、要跑大量 agent 任务 → Sonnet 5 性价比最高; 单次任务复杂度逼近极限、不在乎多花几倍钱 → Opus 4.8 仍然更强。',
              en: 'In short: budget-conscious, high-volume agent workloads → Sonnet 5 is the best value; pushing the ceiling on a single hard task and cost isn’t the constraint → Opus 4.8 is still stronger.'
            })}
          </div>
        </section>

        {/* ── Safety ── */}
        <section className="s5-section">
          <div className="s5-kicker">{tr({ zh: '安全', en: 'Safety' })}</div>
          <h2>{tr({ zh: '比上一代更安全, 但还没追上 Opus。', en: 'Safer than its predecessor, but not yet at Opus level.' })}</h2>
          <p className="s5-section-sub">
            {tr({
              zh: 'Sonnet 5 的系统卡显示, 不良行为发生率整体低于 Sonnet 4.6, 在代理式场景下也更安全; 但失准行为(misaligned behavior)的发生率仍高于 Opus 4.8 与 Claude Mythos Preview — 是相对自己上一代的进步, 还没到家族最高安全水平。',
              en: 'Sonnet 5’s system card shows an overall lower rate of undesirable behaviors than Sonnet 4.6 and is generally safer in agentic contexts; but its rate of misaligned behavior still runs higher than Opus 4.8 and Claude Mythos Preview — an improvement over its own predecessor, not yet the family’s safety ceiling.'
            })}
          </p>
          <div className="s5-safety-grid">
            <div className="s5-safety-card">
              <h3><ShieldCheck size={18} strokeWidth={1.9} />{tr({ zh: '网络安全', en: 'Cybersecurity' })}</h3>
              <p>{tr({ zh: '没有专门做攻击性网络安全训练, 在 Firefox 147 漏洞利用评测中无法开发出完整可用的漏洞利用代码(成功率 0.0%); 部分成功率比 Sonnet 4.6 略高(13.2%), 官方将其归因于通用智能的提升而非定向训练。需要更宽松防护做安全研究的场景建议改用 Opus 4.8。', en: 'Deliberately not trained on offensive cybersecurity tasks; on the Firefox 147 exploit-development eval it cannot produce a full working exploit (0.0% success). Its partial-success rate (13.2%) is slightly higher than Sonnet 4.6’s, which Anthropic attributes to general capability gains rather than targeted training. For security research needing lighter guardrails, Opus 4.8 is the recommended choice.' })}</p>
            </div>
            <div className="s5-safety-card">
              <h3><Scale size={18} strokeWidth={1.9} />{tr({ zh: '对齐', en: 'Alignment' })}</h3>
              <p>{tr({ zh: '自动化对齐评估中, 失准行为发生率较 Sonnet 4.6 下降, 但仍高于 Opus 4.8 与 Mythos Preview; 已在 Cyber Verification Program 注册的组织无需重新申请即自动获得访问权限。', en: 'Automated alignment evaluation shows lower misaligned-behavior rates than Sonnet 4.6, though still above Opus 4.8 and Mythos Preview; organizations already enrolled in the Cyber Verification Program get access automatically, with no reapplication needed.' })}</p>
            </div>
            <div className="s5-safety-card">
              <h3><Lock size={18} strokeWidth={1.9} />{tr({ zh: '日常防护', en: 'Everyday safety' })}</h3>
              <p>{tr({ zh: '比 Sonnet 4.6 更擅长拒绝恶意请求、更能抵御 prompt injection(提示注入)攻击, 幻觉率与谄媚倾向也更低。', en: 'Better than Sonnet 4.6 at refusing malicious requests and resisting prompt-injection attacks, with lower hallucination and sycophancy rates as well.' })}</p>
            </div>
          </div>
          <p className="s5-safety-foot">
            {tr({ zh: '完整的安全与能力评估见 Claude Sonnet 5 系统卡(System Card)。', en: 'Full safety and capability evaluations are reported in the Claude Sonnet 5 System Card.' })}
          </p>
        </section>

        {/* ── Pricing & availability ── */}
        <section className="s5-section">
          <div className="s5-kicker">{tr({ zh: '定价与可用性', en: 'Pricing & availability' })}</div>
          <h2>{tr({ zh: 'Sonnet 价位, 接近 Opus 的产出。', en: 'Sonnet pricing, Opus-class output.' })}</h2>
          <div className="s5-table-wrap">
            <table className="s5-price-table">
              <thead>
                <tr>
                  <th>{tr({ zh: '模型', en: 'Model' })}</th>
                  <th>{tr({ zh: '模型 ID', en: 'Model ID' })}</th>
                  <th>{tr({ zh: '上下文', en: 'Context' })}</th>
                  <th>{tr({ zh: '输入 $/百万', en: 'Input $/M' })}</th>
                  <th>{tr({ zh: '输出 $/百万', en: 'Output $/M' })}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="is-self">
                  <td>{tr({ zh: 'Claude Sonnet 5(开局价)', en: 'Claude Sonnet 5 (intro)' })}</td>
                  <td className="num">claude-sonnet-5</td>
                  <td className="num">1M</td>
                  <td className="num">$2.00</td>
                  <td className="num">$10.00</td>
                </tr>
                <tr className="is-self">
                  <td>{tr({ zh: 'Claude Sonnet 5(标准价)', en: 'Claude Sonnet 5 (standard)' })}</td>
                  <td className="num">claude-sonnet-5</td>
                  <td className="num">1M</td>
                  <td className="num">$3.00</td>
                  <td className="num">$15.00</td>
                </tr>
                <tr>
                  <td>Claude Opus 4.8</td>
                  <td className="num">claude-opus-4-8</td>
                  <td className="num">1M</td>
                  <td className="num">$5.00</td>
                  <td className="num">$25.00</td>
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
          <div className="s5-platforms">
            {[
              tr({ zh: 'Claude Platform(API)', en: 'Claude Platform (API)' }),
              'Claude Code',
              'claude.ai',
              tr({ zh: 'Claude Platform on AWS', en: 'Claude Platform on AWS' }),
              'Microsoft Foundry',
              tr({ zh: 'Google Vertex AI(即将上线)', en: 'Google Vertex AI (coming soon)' }),
              'GitHub Copilot',
            ].map((p) => <span key={p} className="s5-platform-chip">{p}</span>)}
          </div>
          <div className="s5-timeline">
            <div className="s5-tl-item is-hot">
              <div className="s5-tl-date">2026-06-30</div>
              <div className="s5-tl-title">{tr({ zh: '正式发布', en: 'General availability' })}</div>
              <div className="s5-tl-desc">{tr({ zh: 'Free / Pro 计划默认模型, Max / Team / Enterprise 可选用; Claude Code、Claude Platform、AWS、Microsoft Foundry 同步开放, Google Vertex AI 即将上线, GitHub Copilot 同日上线。', en: 'Default model on Free / Pro; selectable on Max, Team, Enterprise. Live on Claude Code, the Claude Platform, AWS, and Microsoft Foundry; Google Vertex AI coming soon. GitHub Copilot ships it the same day.' })}</div>
            </div>
            <div className="s5-tl-item is-hot">
              <div className="s5-tl-date">2026-06-30 ~ 08-31</div>
              <div className="s5-tl-title">{tr({ zh: '开局价窗口', en: 'Introductory pricing window' })}</div>
              <div className="s5-tl-desc">{tr({ zh: '$2 / $10 每百万输入 / 输出 token, 比标准价低三分之一左右。', en: '$2 / $10 per million input / output tokens — roughly a third below standard pricing.' })}</div>
            </div>
            <div className="s5-tl-item">
              <div className="s5-tl-date">{tr({ zh: '09-01 起', en: 'From Sep 1' })}</div>
              <div className="s5-tl-title">{tr({ zh: '转标准定价', en: 'Standard pricing' })}</div>
              <div className="s5-tl-desc">{tr({ zh: '$3 / $15 每百万输入 / 输出 token, 与 Sonnet 4.6 持平。', en: '$3 / $15 per million input / output tokens, matching Sonnet 4.6.' })}</div>
            </div>
          </div>
        </section>

        {/* ── Developers ── */}
        <section className="s5-section">
          <div className="s5-kicker">{tr({ zh: '面向开发者', en: 'For developers' })}</div>
          <h2>{tr({ zh: '同代 API 表面, 多了工具调用的默认姿势。', en: 'Same-generation API surface, tool use front and center.' })}</h2>
          <div className="s5-dev">
            <pre className="s5-code">{`import Anthropic from `}<span className="tok-s">{`'@anthropic-ai/sdk'`}</span>{`;

const client = new Anthropic();

const msg = await client.messages.create({
  model: `}<span className="tok-s">{`'claude-sonnet-5'`}</span>{`,
  max_tokens: 8192,
  effort: `}<span className="tok-s">{`'high'`}</span>{`,
  tools: [
    { type: `}<span className="tok-s">{`'bash_20250124'`}</span>{`, name: `}<span className="tok-s">{`'bash'`}</span>{` },
    { type: `}<span className="tok-s">{`'web_search_20250305'`}</span>{`, name: `}<span className="tok-s">{`'web_search'`}</span>{` },
  ],
  messages: [{
    role: `}<span className="tok-s">{`'user'`}</span>{`,
    content: `}<span className="tok-s">{`'Reproduce the failing test, fix it, verify.'`}</span>{`,
  }],
});`}</pre>
            <div className="s5-dev-notes">
              <div className="s5-dev-note">
                <Check size={16} strokeWidth={2.2} />
                <span>{tr({ zh: '只支持自适应思考: 没有可显式打开/关闭的 ', en: 'Adaptive thinking only — there is no explicit on/off ' })}<code>thinking</code>{tr({ zh: ' 参数; 模型自己判断什么时候要多想。', en: ' parameter; the model decides on its own when to think harder.' })}</span>
              </div>
              <div className="s5-dev-note">
                <Check size={16} strokeWidth={2.2} />
                <span>{tr({ zh: '思考强度走 ', en: 'Thinking depth is controlled by ' })}<code>effort</code>{tr({ zh: ', 在 Claude API 与 Claude Code 上默认 high, 其它界面需手动设置。', en: ', which defaults to high on the Claude API and in Claude Code; other surfaces need it set explicitly.' })}</span>
              </div>
              <div className="s5-dev-note">
                <Check size={16} strokeWidth={2.2} />
                <span>{tr({ zh: '同步推荐 ', en: 'Pair with ' })}<code>bash</code>{tr({ zh: ' / ', en: ' / ' })}<code>web_search</code>{tr({ zh: ' 这类原生工具, 这是本次发布主打的浏览器 + 终端代理能力。', en: ' native tools — this release leans hard on the browser + terminal agentic story.' })}</span>
              </div>
              <div className="s5-dev-note">
                <Check size={16} strokeWidth={2.2} />
                <span>{tr({ zh: '默认输出上限 128K token; 用 ', en: 'Default output cap is 128K tokens; with the ' })}<code>output-300k-2026-03-24</code>{tr({ zh: ' beta header 经 Message Batches API 可拉到 300K。', en: ' beta header on the Message Batches API, it goes up to 300K.' })}</span>
              </div>
              <div className="s5-dev-note">
                <Check size={16} strokeWidth={2.2} />
                <span>{tr({ zh: '新分词器同文本约多算 1.0 - 1.35 倍 token, 迁移时按这个区间重新估算成本, 不要直接套 Sonnet 4.6 的账单。', en: 'The new tokenizer counts roughly 1.0–1.35× more tokens for the same text — re-estimate cost in that range rather than reusing your Sonnet 4.6 bill.' })}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="s5-section">
          <div className="s5-kicker">{tr({ zh: '常见问题', en: 'FAQ' })}</div>
          <h2>{tr({ zh: '关于 Sonnet 5, 你大概想问的。', en: 'The questions you’re probably asking.' })}</h2>
          <div className="s5-faq">
            <details className="s5-faq-item">
              <summary><Sparkles size={16} strokeWidth={1.9} />{tr({ zh: '从 Sonnet 4.6 升过来值得吗?', en: 'Is it worth upgrading from Sonnet 4.6?' })}</summary>
              <p>{tr({ zh: '在代理式编码 / 工具调用 / 终端自主操作这几条线上都有明显提升(SWE-bench Pro +5.1pt, Terminal-Bench 2.1 +13.4pt), 标准价与 Sonnet 4.6 持平, 2026-08-31 前还更便宜, 基本没有不升级的理由。', en: 'Yes on agentic coding, tool use and terminal autonomy (SWE-bench Pro +5.1pt, Terminal-Bench 2.1 +13.4pt); standard pricing matches Sonnet 4.6 and it’s cheaper through 2026-08-31, so there’s little reason not to.' })}</p>
            </details>
            <details className="s5-faq-item">
              <summary><Rocket size={16} strokeWidth={1.9} />{tr({ zh: '什么时候该用 Opus 4.8 而不是 Sonnet 5?', en: 'When should I use Opus 4.8 instead?' })}</summary>
              <p>{tr({ zh: 'Opus 4.8 在 SWE-bench Pro 上仍领先约 6 个百分点, 单次任务复杂度逼近上限、或需要更宽松的网络安全防护做合法安全研究时选它; 大批量、成本敏感的 agent 工作流首选 Sonnet 5。', en: 'Opus 4.8 still leads SWE-bench Pro by about 6 points; reach for it when a single task is near the complexity ceiling, or when legitimate security research needs lighter cyber guardrails. For high-volume, cost-sensitive agent workloads, Sonnet 5 is the default pick.' })}</p>
            </details>
            <details className="s5-faq-item">
              <summary><Code2 size={16} strokeWidth={1.9} />{tr({ zh: '从 Sonnet 4.6 迁移要改代码吗?', en: 'Do I need code changes coming from Sonnet 4.6?' })}</summary>
              <p>{tr({ zh: '换 model 字符串即可。唯一要注意的是: extended thinking 参数没了(只剩 adaptive thinking), 新分词器会让同样文本的 token 数涨 1.0 - 1.35 倍, 长 prompt 场景值得重新测一下账单。', en: 'Swap the model string. The one catch: the extended-thinking parameter is gone (adaptive thinking only), and the new tokenizer counts 1.0–1.35× more tokens for the same text — worth re-checking your bill on long-prompt workloads.' })}</p>
            </details>
            <details className="s5-faq-item">
              <summary><Terminal size={16} strokeWidth={1.9} />{tr({ zh: 'Claude Code 里默认就是它吗?', en: 'Is it the Claude Code default?' })}</summary>
              <p>{tr({ zh: '对 Pro 用户是。Free / Pro 计划站内默认走 Sonnet 5, Max / Team / Enterprise 用户可以在模型选择里手动切到 Opus 4.8 或 Fable 5。', en: 'For Pro users, yes. Free / Pro plans default to Sonnet 5; Max, Team and Enterprise users can switch to Opus 4.8 or Fable 5 in the model picker.' })}</p>
            </details>
            <details className="s5-faq-item">
              <summary><ShieldCheck size={16} strokeWidth={1.9} />{tr({ zh: '网络安全防护会不会拦住正常的渗透测试工作?', en: 'Will the cyber safeguards block legitimate pentesting work?' })}</summary>
              <p>{tr({ zh: '已加入 Cyber Verification Program 的组织自动获得访问、无需重新申请; Sonnet 5 防护级别与 Opus 4.7/4.8 相同, 比 Fable 5 宽松。如果工作需要进一步放宽防护, 官方建议改用 Opus 4.8。', en: 'Organizations already in the Cyber Verification Program get access automatically, no reapplication needed; Sonnet 5’s safeguard level matches Opus 4.7/4.8 and is lighter than Fable 5’s. If your work needs even fewer guardrails, Anthropic’s recommendation is to use Opus 4.8 instead.' })}</p>
            </details>
          </div>
        </section>

        <footer className="s5-footer">
          <span>{tr({ zh: '数据来源: ', en: 'Sources: ' })}</span>
          <a href="https://www.anthropic.com/news/claude-sonnet-5" target="_blank" rel="noopener noreferrer">Anthropic — Introducing Claude Sonnet 5</a>
          <a href="https://www.anthropic.com/claude-sonnet-5-system-card" target="_blank" rel="noopener noreferrer">Anthropic — Claude Sonnet 5 System Card</a>
          <a href="https://platform.claude.com/docs/en/about-claude/models/overview" target="_blank" rel="noopener noreferrer">Claude Platform — Models overview</a>
          <a href="https://techcrunch.com/2026/06/30/anthropic-launches-claude-sonnet-5-as-a-cheaper-way-to-run-agents/" target="_blank" rel="noopener noreferrer">TechCrunch — Sonnet 5 coverage</a>
        </footer>

      </div>
    </div>
  );
}
