// NOTE: WR 历史折线图组件——Canvas 渲染
// 从 legacy wr_history_chart.js 移植为 React 组件
// 改进：直接从 JSON rows 数据读取（不解析 DOM）
import React, { useRef, useEffect, useCallback, useMemo } from 'react';

interface DataPoint {
  x: number;     // NOTE: 年份小数（如 2024.5）
  y: number;     // NOTE: 秒数
  person: string;
  imp: string;    // NOTE: Improvement 百分比
  label: string;  // NOTE: 格式化成绩字符串
}

interface Props {
  rows: unknown[][];
  header: { key: string; label: string }[];
  isZh?: boolean;
}

const PAD = { top: 20, right: 16, bottom: 32, left: 50 };

/**
 * NOTE: 成绩解析 — 支持 "3.84", "1:23.45", DNF 返回 NaN
 */
function parseResult(s: string): number {
  s = s.trim();
  if (!s || s === 'DNF' || s === 'DNS') return NaN;
  const m = s.match(/^(\d+):(\d+\.\d+)$/);
  if (m) return parseInt(m[1], 10) * 60 + parseFloat(m[2]);
  const v = parseFloat(s);
  return isNaN(v) ? NaN : v;
}

/**
 * NOTE: 日期解析 → 年份小数
 */
function parseDate(s: string): number {
  s = s.trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return NaN;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const dt = new Date(y, mo, d);
  const start = new Date(y, 0, 1);
  const end = new Date(y + 1, 0, 1);
  return y + (dt.getTime() - start.getTime()) / (end.getTime() - start.getTime());
}

/**
 * NOTE: 从 Markdown 链接提取纯文本 — [text](url) → text
 */
function stripMdLink(s: string): string {
  const m = s.match(/^\[([^\]]+)\]\([^)]+\)$/);
  return m ? m[1] : s;
}

/**
 * NOTE: 从 JSON rows + header 自动提取图表数据点
 * 通过表头 key 定位 Result / Date / Person / Improvement 列
 */
function extractPoints(rows: unknown[][], header: { key: string; label: string }[]): DataPoint[] {
  let rIdx = -1, dIdx = -1, pIdx = -1, impIdx = -1;
  let isCount = false;
  header.forEach((h, i) => {
    const k = h.key;
    if (k === 'result' && rIdx === -1) rIdx = i;
    if ((k === 'count') && rIdx === -1) { rIdx = i; isCount = true; }
    // NOTE: ⚠️ 优先用 'date'（达成日期）而非 'start_date'（窗口起点）
    // average_of 的 History 表头同时有 start_date 和 date，
    // 同一选手多条 PB 共享 start_date 但 end date 不同，用 start_date 会导致
    // 多个不同 y 值映射到同一 x 坐标，折线图非单调
    if (k === 'date') dIdx = i;
    if (k === 'start_date' && dIdx === -1) dIdx = i;
    if (k === 'person') pIdx = i;
    if (k === 'improvement') impIdx = i;
  });

  if (rIdx === -1 || dIdx === -1) return [];

  const points: DataPoint[] = [];
  for (const row of rows) {
    const resultRaw = String(row[rIdx] ?? '');
    const result = isCount ? parseInt(stripMdLink(resultRaw), 10) : parseResult(stripMdLink(resultRaw));
    const dateStr = String(row[dIdx] ?? '');
    const date = parseDate(dateStr);
    if (isNaN(result) || result <= 0 || isNaN(date)) continue;
    const person = pIdx >= 0 ? stripMdLink(String(row[pIdx] ?? '')) : '';
    const imp = impIdx >= 0 ? String(row[impIdx] ?? '') : '';
    points.push({ x: date, y: result, person, imp, label: stripMdLink(resultRaw) });
  }
  // NOTE: rows 可能是降序（最新在上）→ 反转为时间正序
  points.sort((a, b) => a.x - b.x);

  // NOTE: 强制单调性——WR history 可能含同日期多条记录（如同场赛事连续破 WR）
  // 问题根源：running min 先处理同日最好成绩，会把同日其他台阶夹死。
  // 修复：对同日期分组内的点按"最差优先"排序，再做 running min/max。
  if (points.length >= 2) {
    const firstY = points[0].y;
    const lastY  = points[points.length - 1].y;
    const decreasing = lastY < firstY;
    const increasing = lastY > firstY;

    if (decreasing || increasing) {
      // --- Step 1: 同日期分组，组内按"最差优先"重排 ---
      const result: DataPoint[] = [];
      let i = 0;
      while (i < points.length) {
        let j = i + 1;
        while (j < points.length && points[j].x === points[i].x) j++;
        const group = points.slice(i, j);
        if (group.length > 1) {
          // 递减：同日 y 从大（差）到小（好）；递增：从小（差）到大（好）
          group.sort((a, b) => decreasing ? b.y - a.y : a.y - b.y);
        }
        result.push(...group);
        i = j;
      }

      // --- Step 2: 全局 running min / max ---
      for (let k = 1; k < result.length; k++) {
        if (decreasing && result[k].y > result[k - 1].y) result[k].y = result[k - 1].y;
        if (increasing && result[k].y < result[k - 1].y) result[k].y = result[k - 1].y;
      }
      return result;
    }
  }

  return points;
}

export default function WrHistoryChart({ rows, header, isZh: _isZh }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const points = useMemo(() => extractPoints(rows, header), [rows, header]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || points.length < 2) return;

    const CHART_H = window.innerWidth < 600 ? 140 : 180;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    if (w <= 0) return;

    canvas.width = w * dpr;
    canvas.height = CHART_H * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = CHART_H + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let xMin = points[0].x, xMax = points[points.length - 1].x;
    let yMin = Infinity, yMax = -Infinity;
    for (const p of points) {
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    xMin -= xRange * 0.03; xMax += xRange * 0.03;
    yMin -= yRange * 0.08; yMax += yRange * 0.08;
    yMin = Math.max(0, yMin);

    const plotW = w - PAD.left - PAD.right;
    const plotH = CHART_H - PAD.top - PAD.bottom;
    const xPx = (v: number) => PAD.left + (v - xMin) / (xMax - xMin) * plotW;
    const yPx = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    const yStep = yRange > 60 ? 20 : yRange > 20 ? 10 : yRange > 8 ? 2 : yRange > 3 ? 1 : 0.5;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) {
      const py = yPx(v);
      ctx.beginPath(); ctx.moveTo(PAD.left, py); ctx.lineTo(PAD.left + plotW, py); ctx.stroke();
      ctx.fillText(yStep < 1 ? v.toFixed(1) : Math.round(v).toString(), PAD.left - 5, py + 3);
    }
    const yearStart = Math.ceil(xMin);
    const yearEnd = Math.floor(xMax);
    const xStep = (yearEnd - yearStart) > 15 ? 5 : (yearEnd - yearStart) > 8 ? 2 : 1;
    ctx.textAlign = 'center';
    for (let yr = yearStart; yr <= yearEnd; yr += xStep) {
      const px = xPx(yr);
      ctx.beginPath(); ctx.moveTo(px, PAD.top); ctx.lineTo(px, PAD.top + plotH); ctx.stroke();
      ctx.fillText(yr.toString(), px, CHART_H - 4);
    }

    // Area fill
    ctx.beginPath();
    ctx.moveTo(xPx(points[0].x), yPx(points[0].y));
    for (let i = 1; i < points.length; i++) ctx.lineTo(xPx(points[i].x), yPx(points[i].y));
    ctx.lineTo(xPx(points[points.length - 1].x), PAD.top + plotH);
    ctx.lineTo(xPx(points[0].x), PAD.top + plotH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
    grad.addColorStop(0, 'rgba(110,231,183,0.15)');
    grad.addColorStop(1, 'rgba(110,231,183,0.01)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(xPx(points[0].x), yPx(points[0].y));
    for (let i = 1; i < points.length; i++) ctx.lineTo(xPx(points[i].x), yPx(points[i].y));
    ctx.stroke();

    // Data points
    ctx.fillStyle = '#ef4444';
    for (const p of points) {
      ctx.beginPath(); ctx.arc(xPx(p.x), yPx(p.y), 2.5, 0, Math.PI * 2); ctx.fill();
    }

    // Store scale functions for tooltip
    (canvas as any)._chartScale = { xPx, yPx, w, points };
  }, [points]);

  useEffect(() => {
    render();
    const onResize = () => { clearTimeout((window as any)._wrChartResize); (window as any)._wrChartResize = window.setTimeout(render, 200); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [render]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const tipEl = tipRef.current;
    if (!canvas || !tipEl) return;
    const scale = (canvas as any)._chartScale;
    if (!scale) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (mx < PAD.left || mx > scale.w - PAD.right) {
      tipEl.style.display = 'none';
      return;
    }

    // Step 1: 找最近 x 的点（确定悬停在哪个日期）
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < scale.points.length; i++) {
      const d = Math.abs(scale.xPx(scale.points[i].x) - mx);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    if (bestDist > 30) { tipEl.style.display = 'none'; return; }

    // Step 2: 同 x 候选里（1px 误差内），按 y 距离最近选最终点
    // 解决同日期多个不同成绩（如 19 和 18 同在 2018-10-26）时的歧义
    let bestY = best;
    let bestYDist = Math.abs(scale.yPx(scale.points[best].y) - my);
    for (let i = 0; i < scale.points.length; i++) {
      if (i === best) continue;
      if (Math.abs(scale.xPx(scale.points[i].x) - mx) > bestDist + 1) continue;
      const dy = Math.abs(scale.yPx(scale.points[i].y) - my);
      if (dy < bestYDist) { bestYDist = dy; bestY = i; }
    }
    const p = scale.points[bestY];

    // NOTE: 收集同日期同成绩的所有点（如同场并列 WR：Szymon + Anonymous 都是 19）
    const sameGroup = (scale.points as DataPoint[]).filter(
      (pt: DataPoint) => pt.x === p.x && pt.y === p.y
    );
    let html = `<b>${p.label}</b> `;
    html += sameGroup
      .map((pt: DataPoint) => {
        let line = pt.person || '';
        if (pt.imp) line += ` <span style="color:#6ee7b7">↓${pt.imp}</span>`;
        return line;
      })
      .filter(Boolean)
      .join('<br>');
    tipEl.innerHTML = html;
    tipEl.style.display = 'block';
    const tipW = tipEl.offsetWidth || 100;
    let left = mx + 8;
    if (left + tipW > scale.w - 4) left = mx - tipW - 8;
    tipEl.style.left = Math.max(4, left) + 'px';
    tipEl.style.top = (scale.yPx(p.y) - 28) + 'px';
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (tipRef.current) tipRef.current.style.display = 'none';
  }, []);

  if (points.length < 2) return null;

  return (
    <div ref={wrapRef} className="wr-chart-wrap" style={{ position: 'relative', marginBottom: 16 }}>
      <canvas ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={e => {
          const touch = e.touches[0];
          const canvas = canvasRef.current;
          if (!canvas) return;
          handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY, target: canvas } as any);
          e.preventDefault();
        }}
      />
      <div ref={tipRef} className="wr-chart-tooltip" style={{
        position: 'absolute', background: 'rgba(0,0,0,0.85)', color: '#fff',
        padding: '4px 8px', borderRadius: 4, fontSize: 11, pointerEvents: 'none',
        display: 'none', whiteSpace: 'nowrap', zIndex: 10,
      }} />
    </div>
  );
}
