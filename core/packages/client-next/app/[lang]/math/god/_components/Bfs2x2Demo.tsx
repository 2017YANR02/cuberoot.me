'use client';

/**
 * 2x2 现场 BFS 演示组件。
 *
 * 用户点 Start → 起一个 worker, 流式接收 { type:'progress' }, 实时画距离分布柱状图,
 * 完成后展示 11 step 直径 + 2644 antipode 数 + 耗时。
 *
 * 不依赖 cubing.js;BFS 用手写 perm rank + 编码 (见 bfs2x2.worker.ts)。
 */
import { useEffect, useRef, useState } from 'react';
import { MathText } from './Tex';
import i18n from "@/i18n/i18n-client";

interface Props { isZh: boolean; }

interface ProgressEvent {
  type: 'progress';
  depth: number;
  count: number;
  elapsedMs: number;
  totalSoFar: number;
}
interface DoneEvent {
  type: 'done';
  distribution: number[];
  diameter: number;
  elapsedMs: number;
  antipodes: number[];
}

export default function Bfs2x2Demo({ isZh }: Props) {
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [dist, setDist] = useState<number[]>([1]);
  const [elapsed, setElapsed] = useState(0);
  const [totalSoFar, setTotalSoFar] = useState(1);
  const [diameter, setDiameter] = useState<number | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const start = () => {
    if (running) return;
    setRunning(true);
    setDone(false);
    setDist([1]);
    setElapsed(0);
    setTotalSoFar(1);
    setDiameter(null);
    const w = new Worker(new URL('./bfs2x2.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;
    w.onmessage = (ev) => {
      const data = ev.data as ProgressEvent | DoneEvent;
      if (data.type === 'progress') {
        setDist((d) => {
          const nd = d.slice();
          nd[data.depth] = data.count;
          return nd;
        });
        setElapsed(data.elapsedMs);
        setTotalSoFar(data.totalSoFar);
      } else if (data.type === 'done') {
        setDist(data.distribution);
        setElapsed(data.elapsedMs);
        setDiameter(data.diameter);
        setTotalSoFar(data.distribution.reduce((a, b) => a + b, 0));
        setRunning(false);
        setDone(true);
      }
    };
    w.postMessage({ type: 'start' });
  };

  const stop = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
  };

  const KNOWN: number[] = [1, 9, 54, 321, 1847, 9992, 50136, 227536, 870072, 1887748, 623800, 2644];
  const TOTAL = 3_674_160;
  // Scale to the largest of (live data, published distribution) so the chart axis is stable from t=0.
  const maxBar = Math.max(...dist, ...KNOWN);

  return (
    <div className="god-bfs-wrap">
      <div className="god-bfs-controls">
        {!running && !done && (
          <button className="god-btn-primary" onClick={start}>
            {t('开始 BFS', 'Start BFS', "開始 BFS")}
          </button>
        )}
        {running && (
          <button className="god-btn-secondary" onClick={stop}>
            {t('停止', 'Stop')}
          </button>
        )}
        {done && (
          <button className="god-btn-secondary" onClick={start}>
            {t('再来一次', 'Run again', "再來一次")}
          </button>
        )}
        <span className="god-bfs-stat">
          {t('已枚举', 'Visited', "已列舉")}: <b>{totalSoFar.toLocaleString()}</b>
          {' / '}
          <span style={{ color: 'var(--god-text-mute)' }}>{TOTAL.toLocaleString()}</span>
        </span>
        <span className="god-bfs-stat">
          {t('耗时', 'Time', "耗時")}: <b>{(elapsed / 1000).toFixed(2)}s</b>
        </span>
        {diameter != null && (
          <span className="god-bfs-stat god-bfs-result">
            {t('上帝之数', 'God\'s number', "上帝之數")} = <b>{diameter}</b> HTM
          </span>
        )}
      </div>

      <div className="god-bfs-chart" role="img" aria-label={t('距离分布柱状图', 'Distance distribution bar chart', "距離分佈柱狀圖")}>
        {Array.from({ length: 12 }).map((_, d) => {
          const v = dist[d] ?? 0;
          const known = KNOWN[d];
          const h = v > 0 ? Math.max(2, (v / maxBar) * 140) : 0;
          const knownH = (known / maxBar) * 140;
          return (
            <div key={d} className="god-bfs-col">
              <div className="god-bfs-bar-cell" style={{ height: 150 }}>
                <div className="god-bfs-bar-known" style={{ height: `${knownH}px` }} title={t(`已知值 ${known.toLocaleString()}`, `known ${known.toLocaleString()}`)} />
                <div className="god-bfs-bar-live" style={{ height: `${h}px` }} title={`${v.toLocaleString()}`} />
              </div>
              <div className="god-bfs-bar-num">{v > 0 ? v.toLocaleString() : ''}</div>
              <div className="god-bfs-bar-label">{d}</div>
            </div>
          );
        })}
      </div>

      <p className="god-bfs-caption">
        <MathText>{t(
          '横轴 = 距离还原态的最少步数(HTM)。彩色 = 你这次 BFS 的结果,灰色虚影 = 已知精确分布。两个吻合 ⇒ 你刚刚在浏览器里从零证明了 "2×2 上帝之数 = 11"。',
          'X-axis = minimum HTM distance from solved. Coloured bars = your live BFS; pale ghost = published distribution. Match ⇒ you just re-proved "2×2 God\'s number = 11" in the browser.', "橫軸 = 距離還原態的最少步數(HTM)。彩色 = 你這次 BFS 的結果,灰色虛影 = 已知精確分佈。兩個吻合 ⇒ 你剛剛在瀏覽器裡從零證明了 \"2×2 上帝之數 = 11\"。"
        )}</MathText>
      </p>
    </div>
  );
}
