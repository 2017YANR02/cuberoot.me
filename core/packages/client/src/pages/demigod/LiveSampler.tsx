/**
 * Live demigod sampler — 让用户在浏览器内重现论文实验。
 *
 * 走 cubing.js 的 `randomScrambleForEvent('333')`:它内部生成一个 uniform
 * random state 然后 Kociemba 求解(深度优先,带 prune table),最后反转输出
 * 作为 scramble。把 scramble 的 HTM 数当作 d(s) 上界 — 跟论文用 rob-twophase
 * 的 setup 完全一致(只是 cubing.js 把解长度截在 [18, ∞),所以这里偏右,
 * 但收敛形状一样)。
 *
 * 状态:
 *   - histogram counts per d ∈ {11..30}
 *   - running mean μ̂
 *   - running Hoeffding probability of |μ̂ - μ| ≥ 0.1 (C=20)
 * 启动 1k / 5k / 自定义,Stop/Reset 可控。
 */
import { useCallback, useRef, useState } from 'react';
import { randomScrambleForEvent } from 'cubing/scramble';
import { TeX } from '../god/Tex';

interface Props {
  isZh: boolean;
  onSamples?: (counts: Map<number, number>, mean: number, total: number) => void;
}

function countHTM(scramble: string): number {
  // Each whitespace-separated token in the cubing.js Alg toString is one HTM move
  // (cubing.js outputs in HTM by default for 333). Filter empty tokens.
  return scramble.trim().split(/\s+/).filter(Boolean).length;
}

export default function LiveSampler({ isZh, onSamples }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [running, setRunning] = useState(false);
  const [target, setTarget] = useState(500);
  const [counts, setCounts] = useState<Map<number, number>>(() => new Map());
  const [total, setTotal] = useState(0);
  const [sum, setSum] = useState(0);
  const [latest, setLatest] = useState<{ d: number; scramble: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runningRef = useRef(false);

  // Hoeffding fail prob with C=20, t=0.1:
  //   2 exp(-2 |S| · 0.01 / 400) = 2 exp(-|S| / 20000)
  const hoeffFail = (n: number) => 2 * Math.exp(-n / 20_000);

  const mean = total > 0 ? sum / total : 0;

  // Stable ref to onSamples so we can call it from the worker loop without
  // depending on it (avoids re-creating start() every render, which would
  // also recreate the button's onClick handler).
  const onSamplesRef = useRef(onSamples);
  onSamplesRef.current = onSamples;

  const start = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setError(null);

    const localCounts = new Map<number, number>(counts);
    let localTotal = total;
    let localSum = sum;
    const tgt = localTotal + target;

    try {
      while (runningRef.current && localTotal < tgt) {
        const batch = await Promise.all(
          Array.from({ length: 4 }, () => randomScrambleForEvent('333').then((a) => a.toString())),
        );
        for (const sc of batch) {
          const d = countHTM(sc);
          localCounts.set(d, (localCounts.get(d) ?? 0) + 1);
          localTotal++;
          localSum += d;
          if (localTotal >= tgt) {
            setLatest({ d, scramble: sc });
            break;
          }
        }
        // Throttle UI update: setState every batch (4 samples) is plenty.
        setCounts(new Map(localCounts));
        setTotal(localTotal);
        setSum(localSum);
        setLatest({ d: countHTM(batch[batch.length - 1]), scramble: batch[batch.length - 1] });
        // Push to parent without taking a dependency on the prop — avoids
        // re-creating start() on every parent re-render (which would also
        // recreate the click handler and break "Stop").
        if (onSamplesRef.current) {
          onSamplesRef.current(new Map(localCounts), localTotal > 0 ? localSum / localTotal : 0, localTotal);
        }
        // Yield to UI thread
        await new Promise((r) => setTimeout(r, 0));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [counts, sum, target, total]);

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    setCounts(new Map());
    setTotal(0);
    setSum(0);
    setLatest(null);
    setError(null);
  }, []);

  const fail = hoeffFail(total);

  return (
    <div className="dg-interactive">
      <div className="dg-sampler-controls">
        <button
          type="button"
          className={`dg-sampler-btn ${!running ? 'is-primary' : ''}`}
          onClick={running ? stop : start}
        >
          {running ? t('停止', 'Stop') : t(`再采样 ${target} 个`, `Sample +${target}`)}
        </button>
        <button type="button" className="dg-sampler-btn" onClick={reset} disabled={total === 0}>
          {t('重置', 'Reset')}
        </button>
        <div className="dg-radio-row">
          {[100, 500, 2000].map((n) => (
            <button key={n}
                    type="button"
                    className={target === n ? 'is-active' : ''}
                    onClick={() => setTarget(n)}>
              +{n}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="dg-callout is-warn" style={{ marginTop: 0 }}>
          <span className="dg-callout-h">{t('错误', 'Error')}</span>
          {error}
        </div>
      )}

      <div className="dg-sampler-stats">
        <div>
          <div className="dg-sampler-stat-label">{t('样本量 |S|', 'Samples |S|')}</div>
          <div className="dg-sampler-stat-val">{total.toLocaleString('en-US')}</div>
        </div>
        <div>
          <div className="dg-sampler-stat-label">{t('经验均值 μ̂', 'Running μ̂')}</div>
          <div className={`dg-sampler-stat-val ${total >= 200 && Math.abs(mean - 18.32) < 0.2 ? 'is-conv' : ''}`}>
            {total > 0 ? mean.toFixed(4) : '—'}
          </div>
        </div>
        <div>
          <div className="dg-sampler-stat-label">{t('推出 D ≤ (D < 2μ̂+0.36)', 'Implied D ≤ (D < 2μ̂+0.36)')}</div>
          <div className="dg-sampler-stat-val">
            {total > 0 ? `${Math.floor(2 * mean + 0.36)} HTM` : '—'}
          </div>
        </div>
        <div>
          <div className="dg-sampler-stat-label">{t('Hoeffding fail (t=0.1, C=20)', 'Hoeffding fail (t=0.1, C=20)')}</div>
          <div className="dg-sampler-stat-val">
            {total > 0
              ? (fail >= 1 ? t('> 1 (界还无效)', '> 1 (vacuous)')
                : fail < 1e-6 ? fail.toExponential(2) : fail.toFixed(4))
              : '—'}
          </div>
        </div>
      </div>

      {latest && (
        <div style={{ marginTop: '0.8rem', fontSize: '0.84rem', fontFamily: 'var(--dg-mono)' }}>
          <span style={{ color: 'var(--dg-text-mute)' }}>{t('最新样本: ', 'Latest: ')}</span>
          <span style={{ color: 'var(--dg-text)' }}>d = {latest.d}</span>
          {' · '}
          <span style={{ color: 'var(--dg-text-sub)', wordBreak: 'break-all' }}>{latest.scramble}</span>
        </div>
      )}

      <p className="dg-sampler-note">
        {isZh ? (
          <>实现细节:每个 sample 走 cubing.js 的 <code>randomScrambleForEvent('333')</code> —— 在 worker 内挑 uniform 随机态并跑 Kociemba 求解,把解长度当 <TeX src="d(s)" /> 上界。注意 cubing.js 把 WCA scramble 截到 <TeX src="\ge 18" /> 步,故经验均值会略偏高;真实 <TeX src="\mu" /> 约 18.32。每个 sample ~50–300 ms。</>
        ) : (
          <>How it works: each sample calls cubing.js's <code>randomScrambleForEvent('333')</code> — picks a uniformly random state in a worker, solves it with Kociemba, returns the solution length as a bound on <TeX src="d(s)" />. cubing.js clamps WCA scrambles to <TeX src="\ge 18" /> moves so the running mean here biases slightly upward; the true <TeX src="\mu" /> is ≈ 18.32. ~50–300 ms per sample.</>
        )}
      </p>
    </div>
  );
}
