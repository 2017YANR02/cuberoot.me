'use client';

import { useState } from 'react';
import { useLang } from '../../_lib/Lang';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

type Variant = 'fork' | 'swimlane';

// ── Fork-merge (Option B) ────────────────────────

interface ForkStep {
  id: string;
  zh: string;
  en: string;
  tag?: string;
  color?: 'accent' | 'hot' | 'green';
    zhHant?: string;
}

const SHARED_TOP: ForkStep[] = [
  { id: 'dns',  zh: 'DNS 解析',    en: 'DNS Lookup',  tag: '0 ms',   color: 'accent' },
];
const VERCEL_STEPS: ForkStep[] = [
  { id: 've-edge', zh: 'Vercel Edge PoP',  en: 'Vercel Edge PoP',  tag: '~5 ms',   color: 'accent' },
  { id: 've-cache',zh: 'Edge 缓存检查',     en: 'Edge Cache Check', tag: '~8 ms',
      zhHant: "Edge 快取檢查"
},
  { id: 've-fn',   zh: 'Serverless 函数',   en: 'Serverless Fn',    tag: '~30 ms',
      zhHant: "Serverless 函式"
},
  { id: 've-ssr',  zh: 'Next SSR stream',   en: 'Next SSR stream',  tag: '~80 ms', color: 'hot' },
];
const VM_STEPS: ForkStep[] = [
  { id: 'vm-nginx',  zh: 'nginx :443',         en: 'nginx :443',          tag: '~3 ms',  color: 'accent' },
  { id: 'vm-files',  zh: 'try_files 静态',      en: 'try_files static',    tag: '~5 ms',
      zhHant: "try_files 靜態"
},
  { id: 'vm-proxy',  zh: 'proxy_pass :3002',    en: 'proxy_pass :3002',    tag: '~8 ms'  },
  { id: 'vm-ssr',    zh: 'Next standalone SSR', en: 'Next standalone SSR', tag: '~20 ms', color: 'hot' },
];
const SHARED_BOT: ForkStep[] = [
  { id: 'html',    zh: 'HTML + JS chunks',    en: 'HTML + JS chunks',   tag: '~150 ms', color: 'accent' },
  { id: 'hydrate', zh: 'React Hydrate',       en: 'React Hydrate',      tag: '~200 ms', color: 'hot' },
  { id: 'api',     zh: 'apiUrl() → API',      en: 'apiUrl() → API',     tag: '~250 ms', color: 'green' },
  { id: 'dom',     zh: 'DOM 可交互',           en: 'DOM Interactive',    tag: '~300 ms', color: 'green',
      zhHant: "DOM 可互動"
},
];

function ForkStep({ step }: { step: ForkStep }) {
  const lang = useLang();
  const label = (i18n.language === 'zh-Hant' ? (step.zhHant ?? step.zh) : (i18n.language.startsWith('zh') ? step.zh : step.en));
  return (
    <div className={`plf-step${step.color ? ` plf-step-${step.color}` : ''}`}>
      <span className="plf-step-label">{label}</span>
      {step.tag && <span className="plf-step-tag">{step.tag}</span>}
    </div>
  );
}

function ForkDiagram() {
  const lang = useLang();
  return (
    <div className="plf-fork">
      {/* Shared top */}
      <div className="plf-fork-top">
        {SHARED_TOP.map(s => <ForkStep key={s.id} step={s} />)}
      </div>
      {/* DNS split label */}
      <div className="plf-fork-split-label">
        <span className="plf-split-badge">{tr({ zh: 'DNS 分线路', en: 'DNS Split',
            zhHant: "DNS 分線路"
        })}</span>
      </div>
      {/* Two tracks */}
      <div className="plf-fork-tracks">
        <div className="plf-track plf-track-vercel">
          <div className="plf-track-head plf-track-head-vercel">
            <span className="plf-track-icon">▲</span>
            <span>{lang === 'zh' ? 'Vercel Edge' : 'Vercel Edge'}</span>
          </div>
          {VERCEL_STEPS.map(s => <ForkStep key={s.id} step={s} />)}
        </div>
        <div className="plf-fork-connector" aria-hidden>
          <div className="plf-fork-line" />
          <div className="plf-fork-merge" />
        </div>
        <div className="plf-track plf-track-vm">
          <div className="plf-track-head plf-track-head-vm">
            <span className="plf-track-icon">⬡</span>
            <span>{tr({ zh: '自有 VM', en: 'Self-hosted VM' })}</span>
          </div>
          {VM_STEPS.map(s => <ForkStep key={s.id} step={s} />)}
        </div>
      </div>
      {/* Shared bottom */}
      <div className="plf-fork-bot">
        {SHARED_BOT.map(s => <ForkStep key={s.id} step={s} />)}
      </div>
    </div>
  );
}

// ── Swimlane (Option A) ────────────────────────

interface SwimlaneRow {
  label: { zh: string; en: string
    zhHant?: string;
 };
  cells: Array<{ col: number; span?: number; zh: string; en: string; tone?: 'accent' | 'hot' | 'green' | 'dim'
          zhHant?: string;
 }>;
}

const SWIMLANE_COLS = [
  { zh: '时序', en: 'Time',
      zhHant: "時序"
},
  { zh: '浏览器', en: 'Browser',
      zhHant: "瀏覽器"
},
  { zh: 'Vercel/nginx', en: 'Vercel/nginx' },
  { zh: 'Next.js', en: 'Next.js' },
  { zh: 'API + PG', en: 'API + PG' },
];

const SWIMLANE_ROWS: SwimlaneRow[] = [
  {
    label: { zh: '0ms', en: '0ms' },
    cells: [
      { col: 1, zh: '输入 URL / 点击链接', en: 'Enter URL / click link', tone: 'accent',
          zhHant: "輸入 URL / 點選連結"
    },
      { col: 2, zh: 'DNS 解析 → IP', en: 'DNS Lookup → IP', tone: 'dim' },
    ],
  },
  {
    label: { zh: '5ms', en: '5ms' },
    cells: [
      { col: 1, zh: 'TCP 握手 · TLS 1.3', en: 'TCP handshake · TLS 1.3', tone: 'dim' },
      { col: 2, zh: '连接建立', en: 'Connection established', tone: 'dim',
          zhHant: "連線建立"
    },
    ],
  },
  {
    label: { zh: '10ms', en: '10ms' },
    cells: [
      { col: 1, zh: 'GET /[lang]/page', en: 'GET /[lang]/page', tone: 'accent' },
      { col: 2, zh: 'Vercel: edge fn invoke\nnginx: proxy_pass :3002', en: 'Vercel: edge fn invoke\nnginx: proxy_pass :3002', tone: 'accent' },
    ],
  },
  {
    label: { zh: '20–80ms', en: '20–80ms' },
    cells: [
      { col: 3, zh: 'App Router SSR\nstream HTML', en: 'App Router SSR\nstream HTML', tone: 'hot' },
    ],
  },
  {
    label: { zh: '80ms+', en: '80ms+' },
    cells: [
      { col: 1, zh: '首字节到达\n开始渲染', en: 'TTFB\nStart render', tone: 'green',
          zhHant: "首位元組到達\n\
開始渲染"
    },
    ],
  },
  {
    label: { zh: '100–200ms', en: '100–200ms' },
    cells: [
      { col: 1, zh: 'JS chunks 并发拉取', en: 'JS chunks fetched', tone: 'dim',
          zhHant: "JS chunks 併發拉取"
    },
      { col: 2, zh: 'CDN / nginx serve\nimmutable cache', en: 'CDN / nginx serve\nimmutable cache', tone: 'dim' },
    ],
  },
  {
    label: { zh: '200ms', en: '200ms' },
    cells: [
      { col: 1, zh: 'React Hydrate\n可交互', en: 'React Hydrate\nInteractive', tone: 'green',
          zhHant: "React Hydrate\n\
可互動"
    },
      { col: 3, zh: 'Client component\nmount', en: 'Client component\nmount', tone: 'hot' },
    ],
  },
  {
    label: { zh: '250ms', en: '250ms' },
    cells: [
      { col: 1, zh: 'apiUrl() fetch()', en: 'apiUrl() fetch()', tone: 'accent' },
      { col: 2, zh: 'nginx proxy_cache\nhit / miss', en: 'nginx proxy_cache\nhit / miss', tone: 'accent' },
      { col: 4, zh: 'Hono route\nPG query', en: 'Hono route\nPG query', tone: 'green' },
    ],
  },
  {
    label: { zh: '300ms', en: '300ms' },
    cells: [
      { col: 1, zh: 'JSON → setState\nDOM 更新', en: 'JSON → setState\nDOM update', tone: 'green' },
    ],
  },
];

function SwimlaneCell({ tone, zh, en }: { tone?: string; zh: string; en: string
    zhHant?: string;
 }) {
  const lang = useLang();
  return (
    <div className={`plf-cell${tone ? ` plf-cell-${tone}` : ''}`}>
      {(lang === 'zh' ? zh : en).split('\n').map((line, i) => (
        <span key={i}>{line}</span>
      ))}
    </div>
  );
}

function SwimlaneDiagram() {
  const lang = useLang();
  return (
    <div className="plf-swimlane-wrap">
      <div className="plf-swimlane">
        {/* Header */}
        <div className="plf-sw-header">
          {SWIMLANE_COLS.map((col, i) => (
            <div key={i} className={`plf-sw-col-head${i === 0 ? ' plf-sw-time' : ''}`}>
              {(i18n.language === 'zh-Hant' ? (col.zhHant ?? col.zh) : (i18n.language.startsWith('zh') ? col.zh : col.en))}
            </div>
          ))}
        </div>
        {/* Rows */}
        {SWIMLANE_ROWS.map((row, ri) => (
          <div key={ri} className="plf-sw-row">
            <div className="plf-sw-time-cell">{(i18n.language === 'zh-Hant' ? (row.label.zhHant ?? row.label.zh) : (i18n.language.startsWith('zh') ? row.label.zh : row.label.en))}</div>
            {[1, 2, 3, 4].map(col => {
              const cell = row.cells.find(c => c.col === col);
              if (!cell) return <div key={col} className="plf-sw-empty" />;
              return <SwimlaneCell key={col} tone={cell.tone} zh={cell.zh} en={cell.en} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Public component ────────────────────────────

export default function PageLoadFlow() {
  const lang = useLang();
  const [variant, setVariant] = useState<Variant>('fork');

  return (
    <div className="plf-root">
      <div className="plf-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={variant === 'fork'}
          className={`plf-tab${variant === 'fork' ? ' active' : ''}`}
          onClick={() => setVariant('fork')}
        >
          {tr({ zh: '方案 A  ·  双轨对比', en: 'Option A  ·  Fork-Merge',
              zhHant: "方案 A  ·  雙軌對比"
        })}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={variant === 'swimlane'}
          className={`plf-tab${variant === 'swimlane' ? ' active' : ''}`}
          onClick={() => setVariant('swimlane')}
        >
          {tr({ zh: '方案 B  ·  时序泳道', en: 'Option B  ·  Swimlane',
              zhHant: "方案 B  ·  時序泳道"
        })}
        </button>
      </div>
      <div className="plf-body">
        {variant === 'fork' ? <ForkDiagram /> : <SwimlaneDiagram />}
      </div>
      <p className="plf-caption">
        {tr({ zh: '完整首次加载约 200–300ms · 重复访问 JS chunks 从 CDN/nginx 即时返回 · API 缓存命中 < 10ms', en: 'Full first load ~200–300ms · Repeat visits serve JS chunks from CDN/nginx instantly · API cache hits < 10ms',
            zhHant: "完整首次載入約 200–300ms · 重複訪問 JS chunks 從 CDN/nginx 即時返回 · API 快取命中 < 10ms"
        })}
      </p>
    </div>
  );
}
