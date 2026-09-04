'use client';

import { useState } from 'react';
import { tr } from '@/i18n/tr';

type Variant = 'fork' | 'swimlane';
type Tone = 'accent' | 'hot' | 'green' | 'dim';

const EDGE_STEPS = [
  { zh: '边缘入口', en: 'Edge entry', tone: 'accent' },
  { zh: '缓存或服务端渲染', en: 'Cache or server rendering', tone: 'hot' },
];
const HOSTED_STEPS = [
  { zh: '反向代理入口', en: 'Reverse proxy entry', tone: 'accent' },
  { zh: '静态文件或服务端渲染', en: 'Static files or server rendering', tone: 'hot' },
];
const SHARED_STEPS = [
  { zh: 'HTML 与脚本到达浏览器', en: 'HTML and scripts reach the browser', tone: 'accent' },
  { zh: 'React 接管交互', en: 'React attaches interaction', tone: 'hot' },
  { zh: '需要时通过 apiUrl() 请求数据', en: 'apiUrl() requests data when needed', tone: 'green' },
  { zh: '状态更新并刷新 DOM', en: 'State updates refresh the DOM', tone: 'green' },
];

function Step({ step }: { step: { zh: string; en: string; tone: string } }) {
  return <div className={`plf-step plf-step-${step.tone}`}><span className="plf-step-label">{tr(step)}</span></div>;
}

function ForkDiagram() {
  return (
    <div className="plf-fork">
      <div className="plf-fork-top"><Step step={{ zh: 'DNS 选择可用入口', en: 'DNS selects an available entry', tone: 'accent' }} /></div>
      <div className="plf-fork-split-label"><span className="plf-split-badge">{tr({ zh: '两条交付路径', en: 'Two delivery paths' })}</span></div>
      <div className="plf-fork-tracks">
        <div className="plf-track">
          <div className="plf-track-head plf-track-head-vercel"><span>{tr({ zh: '边缘托管', en: 'Edge hosting' })}</span></div>
          {EDGE_STEPS.map((step) => <Step key={step.en} step={step} />)}
        </div>
        <div className="plf-fork-connector" aria-hidden="true"><div className="plf-fork-line" /><div className="plf-fork-merge" /></div>
        <div className="plf-track">
          <div className="plf-track-head plf-track-head-vm"><span>{tr({ zh: '自有托管', en: 'Self hosting' })}</span></div>
          {HOSTED_STEPS.map((step) => <Step key={step.en} step={step} />)}
        </div>
      </div>
      <div className="plf-fork-bot">{SHARED_STEPS.map((step) => <Step key={step.en} step={step} />)}</div>
    </div>
  );
}

const SWIMLANE_COLS = [
  { zh: '阶段', en: 'Stage' },
  { zh: '浏览器', en: 'Browser' },
  { zh: '交付入口', en: 'Delivery' },
  { zh: 'Web 前端', en: 'Web frontend' },
  { zh: 'API 与数据', en: 'API and data' },
];

const SWIMLANE_ROWS: Array<{
  label: { zh: string; en: string };
  cells: Array<{ col: number; zh: string; en: string; tone: Tone }>;
}> = [
  { label: { zh: '入口', en: 'Entry' }, cells: [{ col: 1, zh: '输入 URL 或点击链接', en: 'Enter a URL or follow a link', tone: 'accent' }, { col: 2, zh: 'DNS 与连接', en: 'DNS and connection', tone: 'dim' }] },
  { label: { zh: '页面', en: 'Page' }, cells: [{ col: 2, zh: '静态响应或转发请求', en: 'Serve static content or forward', tone: 'accent' }, { col: 3, zh: '路由、渲染、输出 HTML', en: 'Route, render, output HTML', tone: 'hot' }] },
  { label: { zh: '交互', en: 'Interaction' }, cells: [{ col: 1, zh: '加载脚本并接管页面', en: 'Load scripts and attach interaction', tone: 'green' }, { col: 3, zh: '客户端组件开始工作', en: 'Client components start', tone: 'hot' }] },
  { label: { zh: '数据', en: 'Data' }, cells: [{ col: 1, zh: '通过 apiUrl() 请求', en: 'Request through apiUrl()', tone: 'accent' }, { col: 2, zh: '缓存命中或转发', en: 'Cache hit or forward', tone: 'accent' }, { col: 4, zh: 'Hono 路由与数据库查询', en: 'Hono route and database query', tone: 'green' }] },
  { label: { zh: '更新', en: 'Update' }, cells: [{ col: 1, zh: 'JSON 进入状态并更新 DOM', en: 'JSON enters state and updates the DOM', tone: 'green' }] },
];

function SwimlaneDiagram() {
  return (
    <div className="plf-swimlane-wrap">
      <div className="plf-swimlane">
        <div className="plf-sw-header">
          {SWIMLANE_COLS.map((column, index) => <div key={column.en} className={`plf-sw-col-head${index === 0 ? ' plf-sw-time' : ''}`}>{tr(column)}</div>)}
        </div>
        {SWIMLANE_ROWS.map((row) => (
          <div key={row.label.en} className="plf-sw-row">
            <div className="plf-sw-time-cell">{tr(row.label)}</div>
            {[1, 2, 3, 4].map((column) => {
              const cell = row.cells.find((candidate) => candidate.col === column);
              return cell
                ? <div key={column} className={`plf-cell plf-cell-${cell.tone}`}>{tr(cell)}</div>
                : <div key={column} className="plf-sw-empty" />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PageLoadFlow() {
  const [variant, setVariant] = useState<Variant>('fork');

  return (
    <div className="plf-root">
      <div className="plf-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={variant === 'fork'} className={`plf-tab${variant === 'fork' ? ' active' : ''}`} onClick={() => setVariant('fork')}>
          {tr({ zh: '双轨对比', en: 'Path comparison' })}
        </button>
        <button type="button" role="tab" aria-selected={variant === 'swimlane'} className={`plf-tab${variant === 'swimlane' ? ' active' : ''}`} onClick={() => setVariant('swimlane')}>
          {tr({ zh: '分层泳道', en: 'Layer swimlane' })}
        </button>
      </div>
      <div className="plf-body">{variant === 'fork' ? <ForkDiagram /> : <SwimlaneDiagram />}</div>
      <p className="plf-caption">{tr({ zh: '实际耗时取决于网络、缓存、页面与数据量，因此这里展示顺序而不是伪精确数字。', en: 'Actual timing depends on the network, cache, page, and data size, so this view shows order instead of false precision.' })}</p>
    </div>
  );
}
