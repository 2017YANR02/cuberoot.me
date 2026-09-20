'use client';

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { Maximize, Minimize, Minus, Plus, Scan } from 'lucide-react';
import SiteBackground from '@/components/SiteBackground';
import { salesScript as script } from './sales-script-data';

// 本篇按用户要求仅提供中文。导图提炼要点，完整内容仍由同一份讲稿提供。
const stageTopics = script.stages.map(stage => ({
  id: stage.id, title: stage.title.replace(/^第[一二三四五六七八九]段 /, ''), note: stage.goal,
}));
const branches = [
  { title: '开播准备', caption: '开播前', side: -1, row: -1, tone: 'amber', items: [
    { id: 'sales-setup', title: '首屏与演示道具', note: '标题、固定贴片、四个魔方、双机位' },
    { id: 'sales-checklist', title: '开播核对清单', note: '课程、价格、履历、服务逐项确认' },
    { id: 'sales-rundown', title: '三十分钟循环', note: '每轮走完留人、跟练、转化与收口' },
  ] },
  { title: '留住观众', caption: '第 1—3 段 / 0—8 分钟', side: -1, row: 0, tone: 'green', items: stageTopics.slice(0, 3) },
  { title: '跟练与信任', caption: '第 4—5 段 / 8—18 分钟', side: -1, row: 1, tone: 'blue', items: stageTopics.slice(3, 5) },
  { title: '课程与成交', caption: '第 6—9 段 / 18—30 分钟', side: 1, row: -1, tone: 'coral', items: stageTopics.slice(5) },
  { title: '现场调度', caption: '贯穿整场', side: 1, row: 0, tone: 'purple', items: [
    { id: 'sales-return', title: '新人六十秒回拉', note: '重述认知反差，接回当前进度' },
    { id: 'sales-rescue', title: '四种低互动救场', note: '二选一、找错、挑战、家长代入' },
    { id: 'sales-interaction', title: '互动密度与承接', note: '何时提问、让谁回答、如何接话' },
    { id: 'sales-crew', title: '助播和场控分工', note: '看信号、接评论、配合主播推进' },
  ] },
  { title: '下播复盘', caption: '每场结束后', side: 1, row: 1, tone: 'teal', items: [
    { id: 'sales-review', title: '留人效果', note: `${script.review[0].metric}、${script.review[2].metric}` },
    { id: 'sales-review', title: '互动与跟练', note: '评论率、跟练参与率、跟练完成率' },
    { id: 'sales-review', title: '课程转化', note: `${script.review[5].metric}、${script.review[6].metric}` },
    { id: 'sales-review', title: '售后与下一轮', note: '记录退款原因，每轮优先改一个问题' },
  ] },
];
type View = { x: number; y: number; scale: number };
type Point = { x: number; y: number };
const MIN_SCALE = 0.15;
const MAX_SCALE = 2.5;

export default function SalesMindMap() {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 800, height: 550 });
  const [view, setView] = useState<View>({ x: 400, y: 275, scale: 0.55 });
  const viewRef = useRef(view);
  const pointers = useRef(new Map<number, Point>());
  const origin = useRef<Point | null>(null);
  const dragged = useRef(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [notice, setNotice] = useState('');

  function update(next: View) {
    // 限制缩放与拖动边界，始终留有可找回的画布内容。
    const width = canvas.current?.clientWidth ?? 800;
    const height = canvas.current?.clientHeight ?? 550;
    const bounded = { ...next,
      x: Math.max(40 - 680 * next.scale, Math.min(width - 40 + 680 * next.scale, next.x)),
      y: Math.max(40 - 480 * next.scale, Math.min(height - 40 + 480 * next.scale, next.y)),
    };
    viewRef.current = bounded;
    setView(bounded);
  }

  function fit() {
    const el = canvas.current;
    if (!el) return;
    update({ x: el.clientWidth / 2, y: el.clientHeight / 2, scale: Math.max(MIN_SCALE, Math.min(el.clientWidth / 1400, el.clientHeight / 1000)) });
  }

  function zoom(factor: number, point = { x: size.width / 2, y: size.height / 2 }) {
    const current = viewRef.current;
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, current.scale * factor));
    const ratio = scale / current.scale;
    update({ scale, x: point.x - (point.x - current.x) * ratio, y: point.y - (point.y - current.y) * ratio });
  }

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
      fit();
    });
    observer.observe(el);
    setCanFullscreen(Boolean(document.fullscreenEnabled));
    const changed = () => setFullscreen(document.fullscreenElement === container.current);
    document.addEventListener('fullscreenchange', changed);
    // 普通滚轮继续滚页面；修饰键配合滚轮缩放，触控板捏合也走此入口。
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      zoom(Math.exp(-event.deltaY * 0.005), { x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      observer.disconnect();
      document.removeEventListener('fullscreenchange', changed);
      el.removeEventListener('wheel', wheel);
    };
    // fit/zoom read the live element and viewRef; no render-state subscription needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function point(event: PointerEvent<SVGSVGElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function move(event: PointerEvent<SVGSVGElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const next = point(event);
    const before = [...pointers.current.values()];
    pointers.current.set(event.pointerId, next);
    if (origin.current && Math.hypot(next.x - origin.current.x, next.y - origin.current.y) > 5) dragged.current = true;
    if (!dragged.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointers.current.size === 2) {
      const after = [...pointers.current.values()];
      const distance = (p: Point[]) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const center = (p: Point[]) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
      const oldCenter = center(before);
      const newCenter = center(after);
      if (distance(before) > 0) zoom(distance(after) / distance(before), oldCenter);
      update({ ...viewRef.current, x: viewRef.current.x + newCenter.x - oldCenter.x, y: viewRef.current.y + newCenter.y - oldCenter.y });
    } else {
      update({ ...viewRef.current, x: viewRef.current.x + next.x - previous.x, y: viewRef.current.y + next.y - previous.y });
    }
  }

  function release(event: PointerEvent<SVGSVGElement>) {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  async function openTopic(event: MouseEvent, id: string) {
    if (dragged.current && event.detail !== 0) { event.preventDefault(); return; }
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const target = document.getElementById(id);
    if (target instanceof HTMLDetailsElement) target.open = true;
    if (document.fullscreenElement === container.current) {
      await document.exitFullscreen();
      target?.scrollIntoView({ block: 'start' });
    }
  }

  return <div className="sales-mindmap" ref={container}>
    {fullscreen && <SiteBackground manageDocument={false} />}
    <div className="sales-mindmap-toolbar">
      <strong>直播成交思维导图</strong>
      <div className="sales-mindmap-tools" role="group" aria-label="导图视图">
        <button type="button" className="sales-mindmap-tool" aria-label="缩小导图" disabled={view.scale <= MIN_SCALE} onClick={() => zoom(1 / 1.25)}><Minus size={18} /></button>
        <output aria-label="导图缩放比例">{Math.round(view.scale * 100)}%</output>
        <button type="button" className="sales-mindmap-tool" aria-label="放大导图" disabled={view.scale >= MAX_SCALE} onClick={() => zoom(1.25)}><Plus size={18} /></button>
        <button type="button" className="sales-mindmap-tool" onClick={fit}><Scan size={17} /><span>适应画布</span></button>
        {canFullscreen && <button type="button" className="sales-mindmap-tool" onClick={async () => {
          try {
            if (fullscreen) await document.exitFullscreen();
            else await container.current?.requestFullscreen();
            setNotice('');
          } catch { setNotice('当前浏览器无法进入全屏，可以使用放大和拖动查看。'); }
        }}>{fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}<span>{fullscreen ? '退出全屏' : '全屏查看'}</span></button>}
      </div>
    </div>
    <p className="sales-mindmap-hint">拖动查看，双指缩放；点击节点打开完整讲稿。</p>
    {notice && <p role="status">{notice}</p>}
    <svg ref={canvas} className="sales-mindmap-canvas" viewBox={`0 0 ${size.width} ${size.height}`}
      role="group" aria-label="魔方课程直播思维导图，六个主题分支" tabIndex={0}
      onPointerDown={event => {
        if (event.button !== 0 || pointers.current.size >= 2) return;
        const p = point(event);
        if (pointers.current.size === 0) { origin.current = p; dragged.current = false; }
        pointers.current.set(event.pointerId, p);
        if (pointers.current.size === 2) dragged.current = true;
      }} onPointerMove={move} onPointerUp={release} onPointerCancel={release}
      onLostPointerCapture={event => pointers.current.delete(event.pointerId)}
      onPointerLeave={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) release(event); }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '0'].includes(event.key)) event.preventDefault();
        const current = viewRef.current;
        if (event.key === '+' || event.key === '=') zoom(1.25);
        if (event.key === '-') zoom(1 / 1.25);
        if (event.key === '0') fit();
        if (event.key === 'ArrowLeft') update({ ...current, x: current.x + 60 });
        if (event.key === 'ArrowRight') update({ ...current, x: current.x - 60 });
        if (event.key === 'ArrowUp') update({ ...current, y: current.y + 60 });
        if (event.key === 'ArrowDown') update({ ...current, y: current.y - 60 });
      }}>
      <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
        {branches.map(branch => {
          const side = branch.side;
          const y = branch.row * 320;
          return <g key={branch.title} className={`sales-mindmap-branch sales-mindmap-${branch.tone}`}>
            <path className="sales-mindmap-trunk" d={`M ${side * 120} 0 C ${side * 180} 0, ${side * 130} ${y}, ${side * 170} ${y}`} />
            <rect className="sales-mindmap-topic" x={side * 245 - 75} y={y - 25} width={150} height={50} rx={16} />
            <text className="sales-mindmap-topic-label" x={side * 245} y={y + 7} textAnchor="middle">{branch.title}</text>
            <text className="sales-mindmap-caption" x={side * 245} y={y + 48} textAnchor="middle">{branch.caption}</text>
            {branch.items.map((item, index) => {
              const leafY = y + (index - (branch.items.length - 1) / 2) * 80;
              const leafX = side === 1 ? 375 : -675;
              return <g key={item.title}>
                <path className="sales-mindmap-twig" d={`M ${side * 320} ${y} C ${side * 350} ${y}, ${side * 345} ${leafY + 14}, ${side * 375} ${leafY + 14} H ${side * 675}`} />
                <a href={`#${item.id}`} className="sales-mindmap-leaf" onClick={event => { void openTopic(event, item.id); }}
                  onFocus={event => {
                    if (!event.currentTarget.matches(':focus-visible')) return;
                    // 键盘逐项浏览时，把获得焦点的节点带回可见区域。
                    const current = viewRef.current;
                    const centerX = leafX + 150;
                    const px = current.x + centerX * current.scale;
                    const py = current.y + leafY * current.scale;
                    if (px < 100 || px > size.width - 100 || py < 40 || py > size.height - 40) update({ ...current, x: size.width / 2 - centerX * current.scale, y: size.height / 2 - leafY * current.scale });
                  }}>
                  <title>{`${item.title}：${item.note}。点击查看完整内容`}</title>
                  <rect className="sales-mindmap-hit" x={leafX} y={leafY - 25} width={300} height={66} rx={8} />
                  <text className="sales-mindmap-leaf-label" x={leafX + 12} y={leafY}>{item.title}</text>
                  <text className="sales-mindmap-note" x={leafX + 12} y={leafY + 34}>{item.note}</text>
                </a>
              </g>;
            })}
          </g>;
        })}
        <g className="sales-mindmap-center">
          <rect x={-120} y={-64} width={240} height={128} rx={24} />
          <text textAnchor="middle" y={-15}>魔方课程直播</text>
          <text className="sales-mindmap-center-sub" textAnchor="middle" y={17}>强节奏成交主线</text>
          <text className="sales-mindmap-center-note" textAnchor="middle" y={44}>留人 → 跟练 → 转化</text>
        </g>
      </g>
    </svg>
  </div>;
}
