'use client';

/**
 * /code/solvers — 求解器舰队看板.
 * 进度 (覆盖率) + 快照日期: 实时 fetch /stats/scramble/distribution.json 自动维护
 *   (管道每次被手动跑时重发布该文件 → 看板自动刷新, 无定时调度). fetch 失败回退到 curated 常量.
 * 吞吐 / 内存 / 浏览器端: curated 常量 (不在 distribution.json 里, 且为稳定特征).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Cpu, Database, Gauge, HardDrive, Globe, CircleCheck, CircleDashed, CircleDot } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './solvers.css';

// fetch 失败时的回退 (last-known 2026-05-30).
const FB_SNAPSHOT = '2026-05-30';
const FB_TARGET = 1_289_663;

type Status = 'complete' | 'partial' | 'seed';

interface NativeSolver {
  key: string;
  stages: number;
  fbRows: number; // 回退行数 (fetch 失败时用)
  rate: number; // tasks/sec, native, 16 核 (curated, 2026-05-30 实测)
  tier: 'huge' | 'small';
  zhWhy: string; enWhy: string;
}

// 原生分析器 (solver-rust/target/release/*_analyzer.exe). rate 为 2026-05-30 实测.
const NATIVE: NativeSolver[] = [
  { key: 'std', stages: 5, fbRows: 1_289_663, rate: 115, tier: 'huge', zhWhy: '联合大表剪枝最强, 全 5 阶段', enWhy: 'strongest joint-table pruning, full 5 stages' },
  { key: 'eo', stages: 5, fbRows: 1_240_119, rate: 0.9, tier: 'huge', zhWhy: 'xxxxcross 全枚举 ~13M 节点每条, 唯一长极', enWhy: 'xxxxcross full enumeration ~13M nodes/case — the long pole' },
  { key: 'pseudo', stages: 4, fbRows: 1_289_663, rate: 390, tier: 'huge', zhWhy: '槽解耦 + 强剪枝, 最快', enWhy: 'slot-decoupled + strong pruning, fastest' },
  { key: 'pseudo_pair', stages: 4, fbRows: 1_289_663, rate: 47, tier: 'huge', zhWhy: '角槽棱槽耦合, 搜索较重', enWhy: 'corner/edge slot coupling, heavier search' },
  { key: 'pair', stages: 4, fbRows: 112_841, rate: 2, tier: 'huge', zhWhy: '不在默认补缺, 全量回填 ~165h', enWhy: 'off the default run, full backfill ~165h' },
  { key: 'f2leo', stages: 4, fbRows: 252, rate: 7.4, tier: 'small', zhWhy: '深阶段弱剪枝, 不碰 huge 表; 仅 2 场种子', enWhy: 'weak deep-stage pruning, no huge tables; 2 seed comps only' },
  { key: 'pseudo_f2leo', stages: 4, fbRows: 252, rate: 7.4, tier: 'small', zhWhy: '同 f2leo, 仅 2 场种子', enWhy: 'same as f2leo, 2 seed comps only' },
];

interface BrowserSolver { key: string; zhEngine: string; enEngine: string; zhLatency: string; enLatency: string; }

// 浏览器端 WASM (gen 页现算). 定性, 非精确遥测.
const BROWSER: BrowserSolver[] = [
  { key: 'std cross-step', zhEngine: 'pt_cross_C4E0 (52MB/worker)', enEngine: 'pt_cross_C4E0 (52MB/worker)', zhLatency: 'cross 秒出', enLatency: 'cross instant' },
  { key: 'pair', zhEngine: 'VariantSolverWasm', enEngine: 'VariantSolverWasm', zhLatency: '全 4 阶段 ~0.04s', enLatency: 'all 4 stages ~0.04s' },
  { key: 'eo', zhEngine: 'VariantSolverWasm', enEngine: 'VariantSolverWasm', zhLatency: '深阶段 数十秒', enLatency: 'deep stages tens of seconds' },
  { key: 'pseudo', zhEngine: 'VariantSolverWasm', enEngine: 'VariantSolverWasm', zhLatency: '~5s', enLatency: '~5s' },
  { key: 'pseudo_pair', zhEngine: 'VariantSolverWasm', enEngine: 'VariantSolverWasm', zhLatency: '深阶段 数十秒', enLatency: 'deep stages tens of seconds' },
  { key: 'f2leo / pseudo_f2leo', zhEngine: '小表 ~40MB/worker', enEngine: 'small tables ~40MB/worker', zhLatency: 'cross ~2.8s', enLatency: 'cross ~2.8s' },
];

interface Coverage { generatedAt: string; target: number; counts: Record<string, number>; }

function deriveStatus(rows: number, target: number): Status {
  const pct = (rows / target) * 100;
  if (pct >= 99.9) return 'complete';
  if (pct < 1) return 'seed';
  return 'partial';
}

// rate 跨度 0.9–390/s, 线性条会让慢的看不见 → log 缩放.
function rateBarPct(rate: number): number {
  const lo = Math.log10(0.5);
  const hi = Math.log10(500);
  return Math.max(4, Math.min(100, ((Math.log10(rate) - lo) / (hi - lo)) * 100));
}

function fmtInt(n: number): string {
  return n.toLocaleString('en-US');
}

const STATUS_ICON = { complete: CircleCheck, partial: CircleDot, seed: CircleDashed } as const;

export default function SolversPage() {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith('zh');
  useDocumentTitle('求解器', 'Solvers');

  const [cov, setCov] = useState<Coverage | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/stats/scramble/distribution.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        const wca = j?.sets?.wca;
        if (!wca?.variants) return;
        const counts: Record<string, number> = {};
        for (const [k, v] of Object.entries(wca.variants)) {
          const c = (v as { sample_count?: number })?.sample_count;
          if (typeof c === 'number') counts[k] = c;
        }
        if (!cancelled) {
          setCov({
            generatedAt: typeof j?.meta?.generated_at === 'string' ? j.meta.generated_at : FB_SNAPSHOT,
            target: typeof wca.sample_count === 'number' ? wca.sample_count : FB_TARGET,
            counts,
          });
        }
      })
      .catch(() => { /* 保留回退常量 */ });
    return () => { cancelled = true; };
  }, []);

  const target = cov?.target ?? FB_TARGET;
  const snapshot = cov?.generatedAt ?? FB_SNAPSHOT;
  const live = !!cov;
  const rowsOf = (s: NativeSolver) => cov?.counts[s.key] ?? s.fbRows;

  const completeN = NATIVE.filter((s) => deriveStatus(rowsOf(s), target) === 'complete').length;

  return (
    <div className="solv-page">
      <div className="solv-bg" aria-hidden="true" />

      <div className="solv-shell">
        <div className="solv-topbar">
          <Link href="/code" className="solv-back">← /code</Link>
          <span className="solv-snapshot" title={live ? (zh ? '覆盖率实时取自 distribution.json' : 'coverage live from distribution.json') : (zh ? '回退到内置快照' : 'fallback to built-in snapshot')}>
            {zh ? '数据' : 'data'} {snapshot}{live ? ' ↻' : ''}
          </span>
        </div>

        <header className="solv-hero">
          <h1 className="solv-title">solvers<span className="solv-cursor">_</span></h1>
          <p className="solv-sub">
            {zh
              ? '魔方分阶段求解器舰队:本机原生分析器(喂打乱分布 + 比赛预计算)与浏览器端 WASM(gen 页现算)的进度、吞吐、内存。'
              : 'The staged cube-solver fleet: native analyzers (feeding the scramble distribution + per-comp precompute) and browser WASM (live solve on the gen page) — coverage, throughput, memory.'}
          </p>
          <div className="solv-herostats">
            <div className="solv-stat"><span className="solv-stat-num">7</span><span className="solv-stat-label">{zh ? '原生分析器' : 'native analyzers'}</span></div>
            <div className="solv-stat"><span className="solv-stat-num">~34<small>GB</small></span><span className="solv-stat-label">{zh ? '剪枝表' : 'pruning tables'}</span></div>
            <div className="solv-stat"><span className="solv-stat-num">{completeN}<small>/7</small></span><span className="solv-stat-label">{zh ? '已补齐' : 'fully covered'}</span></div>
            <div className="solv-stat"><span className="solv-stat-num">0.9–390<small>/s</small></span><span className="solv-stat-label">{zh ? '吞吐跨度' : 'throughput span'}</span></div>
          </div>
        </header>

        {/* 回填进度 (实时) */}
        <section className="solv-section">
          <header className="solv-sec-head">
            <Database size={15} strokeWidth={2} />
            <h2>{zh ? '回填进度' : 'Backfill coverage'}</h2>
            <span className="solv-sec-note">
              {zh ? `目标 ${fmtInt(target)} 条` : `target ${fmtInt(target)}`}{live ? (zh ? ' · 实时' : ' · live') : ''}
            </span>
          </header>
          <div className="solv-rows">
            {NATIVE.map((s) => {
              const rows = rowsOf(s);
              const status = deriveStatus(rows, target);
              const pct = Math.min(100, (rows / target) * 100);
              const SIcon = STATUS_ICON[status];
              return (
                <div className="solv-row" key={s.key}>
                  <div className="solv-row-head">
                    <span className="solv-row-name">{s.key}</span>
                    <span className={`solv-badge solv-badge-${status}`}>
                      <SIcon size={12} strokeWidth={2.2} />
                      {status === 'complete' ? (zh ? '已补齐' : 'complete') : status === 'partial' ? (zh ? '回填中' : 'partial') : (zh ? '仅种子' : 'seed')}
                    </span>
                    <span className="solv-row-stages">{s.stages} {zh ? '阶段' : 'stages'}</span>
                  </div>
                  <div className="solv-bar">
                    <div className={`solv-bar-fill solv-fill-${status}`} style={{ width: `${Math.max(0.4, pct)}%` }} />
                  </div>
                  <div className="solv-row-foot">
                    <span className="solv-row-rows">{fmtInt(rows)} <span className="solv-dim">/ {fmtInt(target)}</span></span>
                    <span className="solv-row-pct">{pct >= 99.95 ? '100' : pct < 0.1 ? pct.toFixed(2) : pct.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 吞吐 */}
        <section className="solv-section">
          <header className="solv-sec-head">
            <Gauge size={15} strokeWidth={2} />
            <h2>{zh ? '吞吐' : 'Throughput'}</h2>
            <span className="solv-sec-note">{zh ? '本机 16 核, huge 表全模式 (log 缩放)' : '16-core, full huge-table mode (log scale)'}</span>
          </header>
          <div className="solv-rows">
            {[...NATIVE].sort((a, b) => b.rate - a.rate).map((s) => (
              <div className="solv-perf" key={s.key}>
                <div className="solv-perf-top">
                  <span className="solv-row-name">{s.key}</span>
                  <span className="solv-perf-rate">{s.rate}<small> /s</small></span>
                </div>
                <div className="solv-bar">
                  <div className="solv-bar-fill solv-fill-rate" style={{ width: `${rateBarPct(s.rate)}%` }} />
                </div>
                <p className="solv-perf-why">{zh ? s.zhWhy : s.enWhy}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 内存与剪枝表 */}
        <section className="solv-section">
          <header className="solv-sec-head">
            <HardDrive size={15} strokeWidth={2} />
            <h2>{zh ? '内存与剪枝表' : 'Memory & tables'}</h2>
            <span className="solv-sec-note">{zh ? '本机 31.8GB 物理内存' : '31.8GB physical RAM on the build host'}</span>
          </header>
          <div className="solv-mem">
            <article className="solv-mem-card">
              <div className="solv-mem-tier"><Cpu size={13} strokeWidth={2} /> huge</div>
              <div className="solv-mem-list">std / eo / pseudo / pseudo_pair / pair</div>
              <p>{zh
                ? 'mmap GB 级联合剪枝表 (CEE/CCE/C4C5C6 等)。eo 工作集峰值 ~24GB, 但 private 仅 ~0.1GB — 表是只读共享 mmap。'
                : 'GB-scale joint prune tables (CEE/CCE/C4C5C6) via mmap. eo peaks ~24GB working set but only ~0.1GB private — tables are read-only shared mmap.'}</p>
            </article>
            <article className="solv-mem-card">
              <div className="solv-mem-tier"><Cpu size={13} strokeWidth={2} /> small</div>
              <div className="solv-mem-list">f2leo / pseudo_f2leo</div>
              <p>{zh
                ? '~40MB: mt_edge2/4 + corn + edge + pt_cross + 现场 BFS 建 xcross 剪枝。不碰 huge 表, 因此深阶段慢。'
                : '~40MB: mt_edge2/4 + corn + edge + pt_cross + on-the-fly BFS xcross pruning. No huge tables, so deep stages are slow.'}</p>
            </article>
            <article className="solv-mem-card solv-mem-wide">
              <div className="solv-mem-tier"><Cpu size={13} strokeWidth={2} /> {zh ? '并行' : 'parallelism'}</div>
              <p>{zh
                ? '每个分析器对整块任务跑 rayon par_iter 铺满 16 核; 表只读 mmap 跨进程共享。跨变体并发会各装一套不同的 GB 表 → 撞爆 32GB, 故串行。'
                : 'Each analyzer runs rayon par_iter over a whole chunk across all 16 cores; tables shared read-only via mmap. Running variants concurrently loads distinct GB-scale tables → blows past 32GB, so they run serially.'}</p>
            </article>
          </div>
        </section>

        {/* 浏览器端 */}
        <section className="solv-section">
          <header className="solv-sec-head">
            <Globe size={15} strokeWidth={2} />
            <h2>{zh ? '浏览器端 WASM' : 'Browser WASM'}</h2>
            <span className="solv-sec-note">{zh ? 'gen 页现算, 每 worker 自带小表 (手机 2 / 桌面 4)' : 'live on gen page, per-worker small tables (mobile 2 / desktop 4)'}</span>
          </header>
          <div className="solv-browser">
            {BROWSER.map((b) => (
              <div className="solv-brow-row" key={b.key}>
                <span className="solv-brow-name">{b.key}</span>
                <span className="solv-brow-engine">{zh ? b.zhEngine : b.enEngine}</span>
                <span className="solv-brow-lat">{zh ? b.zhLatency : b.enLatency}</span>
              </div>
            ))}
          </div>
          <p className="solv-browser-note">
            {zh
              ? '浏览器装不下 GB 级 huge 表, 故深阶段 (xxxxcross) 比原生慢几个量级; 无 SharedArrayBuffer, worker 之间不共享表。常见比赛已由 comp_steps 预计算秒出, 现算只在未收录比赛兜底。'
              : 'Browsers cannot hold GB-scale huge tables, so deep stages (xxxxcross) are orders of magnitude slower than native; no SharedArrayBuffer means workers do not share tables. Common comps are served instantly from comp_steps precompute — live solve is only a fallback for uncovered comps.'}
          </p>
        </section>

        <footer className="solv-foot">
          <span>{zh
            ? `进度与日期实时取自 distribution.json (每次手动跑管道才刷新, 无定时); 吞吐/内存为 2026-05-30 实测常量。`
            : `Coverage & date are live from distribution.json (refreshes only when the pipeline is run by hand — no schedule); throughput/memory are measured constants from 2026-05-30.`}</span>
          <Link href="/code" className="solv-foot-link">/code</Link>
        </footer>
      </div>
    </div>
  );
}
