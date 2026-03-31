// NOTE: Pretext Demo — 独立演示页
// 用 @chenglou/pretext 在 Canvas 上渲染表格，自适应列宽，完全绕过 DOM 表格
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { prepareWithSegments, walkLineRanges } from '@chenglou/pretext';
import { Link } from 'react-router-dom';
import './pretext_demo.css';

// ─── 常量 ────────────────────────────────────────────
const FONT = '14px Inter, system-ui, sans-serif';
const HEADER_FONT = 'bold 14px Inter, system-ui, sans-serif';
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 40;
const CELL_PAD_X = 12;   // 单元格水平内边距
const MIN_COL_WIDTH = 40;
const MAX_COL_WIDTH = 320;

// ─── 颜色主题（暗色） ────────────────────────────────
const COLORS = {
  bg: '#1a1a2e',
  headerBg: '#16213e',
  headerText: '#e2e8f0',
  rowBg1: '#1a1a2e',
  rowBg2: '#16213e',
  rowHoverBg: '#1e3a5f',
  cellText: '#cbd5e1',
  gridLine: '#2d3748',
  accent: '#4fc3f7',
  scrollbar: '#4a5568',
  scrollbarTrack: '#2d3748',
};

// ─── 数据接口 ────────────────────────────────────────
interface StatHeader {
  key: string;
  label: string;
  labelZh: string;
  align: 'left' | 'right' | 'center';
}

interface StatSection {
  title: string;
  titleZh?: string;
  rows: unknown[][];
}

interface StatPanel {
  id: string;
  labelEn: string;
  labelZh: string;
  header: StatHeader[];
  sections: StatSection[];
}

interface MetricPanel {
  id: string;
  labelEn: string;
  labelZh: string;
  panels?: StatPanel[];
}

interface StatData {
  id: string;
  title: string;
  titleZh: string;
  metricPanels?: MetricPanel[];
}

// ─── 工具：从 Markdown 链接中提取纯文本 ────────────────
function stripMd(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object' && (value as Record<string, unknown>)._type === 'solves') {
    return (value as { csv: string }).csv.replace(/,/g, ', ');
  }
  const s = String(value);
  // [text](url) → text
  return s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ');
}

// ─── Pretext 列宽计算 ────────────────────────────────
function measureColumnWidths(
  headers: StatHeader[],
  rows: unknown[][],
): number[] {
  const colCount = headers.length;
  const widths = new Array(colCount).fill(0);

  // 1. 测量表头宽
  for (let c = 0; c < colCount; c++) {
    const text = headers[c].label;
    const prepared = prepareWithSegments(text, HEADER_FONT);
    let maxW = 0;
    walkLineRanges(prepared, 9999, line => {
      if (line.width > maxW) maxW = line.width;
    });
    widths[c] = Math.max(widths[c], maxW);
  }

  // 2. 测量每列每行的文本宽度（取最大值）
  for (const row of rows) {
    for (let c = 0; c < colCount; c++) {
      const text = stripMd(row[c]);
      if (!text) continue;
      const prepared = prepareWithSegments(text, FONT);
      let maxW = 0;
      walkLineRanges(prepared, 9999, line => {
        if (line.width > maxW) maxW = line.width;
      });
      widths[c] = Math.max(widths[c], maxW);
    }
  }

  // 3. 加上内边距并限制范围
  return widths.map(w =>
    Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, Math.ceil(w) + CELL_PAD_X * 2))
  );
}

// ─── Canvas 表格渲染 ────────────────────────────────
function drawTable(
  ctx: CanvasRenderingContext2D,
  headers: StatHeader[],
  rows: unknown[][],
  colWidths: number[],
  scrollY: number,
  canvasWidth: number,
  canvasHeight: number,
  hoveredRow: number,
  dpr: number,
) {
  ctx.save();
  ctx.scale(dpr, dpr);

  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const drawWidth = Math.max(totalWidth, canvasWidth);

  // 清空
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, drawWidth, canvasHeight);

  // ─── 数据行 ─────────────────────────────────────
  const visibleStartRow = Math.max(0, Math.floor(scrollY / ROW_HEIGHT));
  const visibleEndRow = Math.min(rows.length, Math.ceil((scrollY + canvasHeight - HEADER_HEIGHT) / ROW_HEIGHT) + 1);

  ctx.textBaseline = 'middle';

  for (let r = visibleStartRow; r < visibleEndRow; r++) {
    const y = HEADER_HEIGHT + r * ROW_HEIGHT - scrollY;
    if (y + ROW_HEIGHT < HEADER_HEIGHT || y > canvasHeight) continue;

    // 行背景
    ctx.fillStyle = r === hoveredRow ? COLORS.rowHoverBg : (r % 2 === 0 ? COLORS.rowBg1 : COLORS.rowBg2);
    ctx.fillRect(0, y, drawWidth, ROW_HEIGHT);

    // 网格线
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y + ROW_HEIGHT);
    ctx.lineTo(drawWidth, y + ROW_HEIGHT);
    ctx.stroke();

    // 单元格文本
    let x = 0;
    for (let c = 0; c < headers.length; c++) {
      const w = colWidths[c];
      const text = stripMd(rows[r][c]);
      const align = headers[c].align;

      ctx.font = FONT;
      ctx.fillStyle = COLORS.cellText;

      let textX: number;
      if (align === 'right') {
        textX = x + w - CELL_PAD_X;
        ctx.textAlign = 'right';
      } else if (align === 'center') {
        textX = x + w / 2;
        ctx.textAlign = 'center';
      } else {
        textX = x + CELL_PAD_X;
        ctx.textAlign = 'left';
      }

      // 截断文本（超出列宽时）
      const maxTextW = w - CELL_PAD_X * 2;
      let displayText = text;
      const measured = ctx.measureText(text);
      if (measured.width > maxTextW && maxTextW > 0) {
        // 二分截断
        let lo = 0, hi = text.length;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (ctx.measureText(text.slice(0, mid) + '…').width <= maxTextW) {
            lo = mid;
          } else {
            hi = mid - 1;
          }
        }
        displayText = text.slice(0, lo) + '…';
      }

      ctx.fillText(displayText, textX, y + ROW_HEIGHT / 2);

      // 列分隔线
      ctx.strokeStyle = COLORS.gridLine;
      ctx.beginPath();
      ctx.moveTo(x + w, y);
      ctx.lineTo(x + w, y + ROW_HEIGHT);
      ctx.stroke();

      x += w;
    }
  }

  // ─── 表头（固定在顶部，覆盖数据行） ────────────
  ctx.fillStyle = COLORS.headerBg;
  ctx.fillRect(0, 0, drawWidth, HEADER_HEIGHT);

  // 表头底线
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_HEIGHT);
  ctx.lineTo(drawWidth, HEADER_HEIGHT);
  ctx.stroke();

  let hx = 0;
  ctx.textBaseline = 'middle';
  for (let c = 0; c < headers.length; c++) {
    const w = colWidths[c];
    const text = headers[c].label;
    const align = headers[c].align;

    ctx.font = HEADER_FONT;
    ctx.fillStyle = COLORS.headerText;

    let textX: number;
    if (align === 'right') {
      textX = hx + w - CELL_PAD_X;
      ctx.textAlign = 'right';
    } else if (align === 'center') {
      textX = hx + w / 2;
      ctx.textAlign = 'center';
    } else {
      textX = hx + CELL_PAD_X;
      ctx.textAlign = 'left';
    }

    ctx.fillText(text, textX, HEADER_HEIGHT / 2);

    // 列分隔线
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(hx + w, 0);
    ctx.lineTo(hx + w, HEADER_HEIGHT);
    ctx.stroke();

    hx += w;
  }

  // ─── 滚动条 ────────────────────────────────────
  const totalContentHeight = HEADER_HEIGHT + rows.length * ROW_HEIGHT;
  if (totalContentHeight > canvasHeight) {
    const scrollbarHeight = Math.max(30, (canvasHeight / totalContentHeight) * canvasHeight);
    const scrollbarY = (scrollY / (totalContentHeight - canvasHeight)) * (canvasHeight - scrollbarHeight);
    const sbX = canvasWidth - 8;

    ctx.fillStyle = COLORS.scrollbarTrack;
    ctx.fillRect(sbX, 0, 6, canvasHeight);

    ctx.fillStyle = COLORS.scrollbar;
    ctx.beginPath();
    ctx.roundRect(sbX, scrollbarY, 6, scrollbarHeight, 3);
    ctx.fill();
  }

  ctx.restore();
}

// ─── 性能统计面板 ────────────────────────────────────
interface PerfStats {
  prepareMs: number;
  measureMs: number;
  drawMs: number;
  rowCount: number;
  colCount: number;
}

function PerfPanel({ stats }: { stats: PerfStats | null }) {
  if (!stats) return null;
  return (
    <div className="pretext-perf-panel">
      <h3>⚡ Pretext 性能统计</h3>
      <div className="perf-grid">
        <span className="perf-label">prepare + measure:</span>
        <span className="perf-value">{stats.prepareMs.toFixed(2)}ms</span>
        <span className="perf-label">Canvas draw:</span>
        <span className="perf-value">{stats.drawMs.toFixed(2)}ms</span>
        <span className="perf-label">Rows:</span>
        <span className="perf-value">{stats.rowCount}</span>
        <span className="perf-label">Columns:</span>
        <span className="perf-value">{stats.colCount}</span>
      </div>
      <p className="perf-note">
        列宽由 pretext <code>walkLineRanges()</code> 纯算术计算，零 DOM reflow
      </p>
    </div>
  );
}

// ─── 主组件 ──────────────────────────────────────────
export default function PretextDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<StatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [perf, setPerf] = useState<PerfStats | null>(null);

  // 滚动和交互状态
  const scrollYRef = useRef(0);
  const hoveredRowRef = useRef(-1);
  const animFrameRef = useRef(0);

  // 预计算结果缓存
  const colWidthsRef = useRef<number[]>([]);
  const headersRef = useRef<StatHeader[]>([]);
  const rowsRef = useRef<unknown[][]>([]);

  // 加载数据
  useEffect(() => {
    fetch('/stats/data/average_of.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json: StatData) => { setData(json); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  // 当数据到达 → 用 pretext 测量列宽
  useEffect(() => {
    if (!data?.metricPanels) return;

    // 取第一个 metric 的 ranking panel
    const mp = data.metricPanels[0];
    const panel = mp.panels?.find(p => p.id === 'ranking') || mp.panels?.[0];
    if (!panel) return;

    // 合并所有 sections 的 rows（取前 200 行做 demo）
    const allRows = panel.sections.flatMap(s => s.rows).slice(0, 200);
    const headers = panel.header;

    headersRef.current = headers;
    rowsRef.current = allRows;

    // ─── Pretext 测量 ─────────────────────────────
    const t0 = performance.now();
    const colWidths = measureColumnWidths(headers, allRows);
    const t1 = performance.now();

    colWidthsRef.current = colWidths;
    setPerf(prev => ({
      prepareMs: t1 - t0,
      measureMs: 0,
      drawMs: prev?.drawMs ?? 0,
      rowCount: allRows.length,
      colCount: headers.length,
    }));

    // 初始渲染
    requestRedraw();
  }, [data]);

  // 渲染循环
  const requestRedraw = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const t0 = performance.now();
      drawTable(
        ctx,
        headersRef.current,
        rowsRef.current,
        colWidthsRef.current,
        scrollYRef.current,
        w,
        h,
        hoveredRowRef.current,
        dpr,
      );
      const t1 = performance.now();

      setPerf(prev => prev ? { ...prev, drawMs: t1 - t0 } : null);
    });
  }, []);

  // 滚动处理
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const maxScroll = Math.max(0, HEADER_HEIGHT + rowsRef.current.length * ROW_HEIGHT - container.getBoundingClientRect().height);
    scrollYRef.current = Math.max(0, Math.min(maxScroll, scrollYRef.current + e.deltaY));
    requestRedraw();
  }, [requestRedraw]);

  // 鼠标悬停行高亮
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const dataY = y - HEADER_HEIGHT + scrollYRef.current;
    const row = dataY >= 0 ? Math.floor(dataY / ROW_HEIGHT) : -1;
    if (row !== hoveredRowRef.current) {
      hoveredRowRef.current = row < rowsRef.current.length ? row : -1;
      requestRedraw();
    }
  }, [requestRedraw]);

  const handleMouseLeave = useCallback(() => {
    hoveredRowRef.current = -1;
    requestRedraw();
  }, [requestRedraw]);

  // 窗口 resize
  useEffect(() => {
    const onResize = () => requestRedraw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [requestRedraw]);

  if (loading) {
    return (
      <div className="pretext-demo-page">
        <div className="pretext-demo-loading">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pretext-demo-page">
        <div className="pretext-demo-error">加载失败: {error}</div>
      </div>
    );
  }

  return (
    <div className="pretext-demo-page">
      <div className="pretext-demo-header">
        <Link to="/wca-stats" className="pretext-demo-back">← 返回</Link>
        <h1>Pretext Canvas Table Demo</h1>
        <p className="pretext-demo-subtitle">
          用 <code>@chenglou/pretext</code> 的 <code>walkLineRanges()</code> 计算列宽，
          然后在 Canvas 上直接渲染表格 — 零 DOM 表格元素，零 layout reflow
        </p>
      </div>
      <PerfPanel stats={perf} />
      <div
        ref={containerRef}
        className="pretext-demo-canvas-container"
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ display: 'block' }}
        />
      </div>
    </div>
  );
}
