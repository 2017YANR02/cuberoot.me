'use client';

/**
 * 在 cycle C_{2n} 上把 D < 2μ 的证明视觉化。
 * 用户拖滑条选 n;两端 u, v (antipode) 用对比色标出;另一个 x 可移动看 d(u,x) + d(v,x) ≥ d(u,v) = D。
 * Lemma 4 在这里直观:从任意 fixed vertex 平均 = 整体 μ。
 */
import { useMemo, useState } from 'react';
import { TeX } from '../../god/_components/Tex';

interface Props { isZh: boolean }

export default function VertexTransitiveProof({ isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [n, setN] = useState(8); // cycle has 2n vertices
  const [xIdx, setXIdx] = useState(3); // 0..2n-1; u=0, v=n

  const V = 2 * n;
  const u = 0;
  const v = n;
  const x = xIdx % V;

  // Distance in C_{2n}: min(|a-b|, V-|a-b|)
  const dist = (a: number, b: number) => {
    const ad = Math.abs(a - b);
    return Math.min(ad, V - ad);
  };

  const D = dist(u, v); // = n
  const dux = dist(u, x);
  const dvx = dist(v, x);

  // Path-traversal sum
  const sum = dux + dvx;

  // 计算精确 μ:cycle 上从 fixed vertex (say u=0) 的平均距离
  // μ = sum_{k=1}^{V-1} dist(0,k) / (V-1)
  const mu = useMemo(() => {
    let s = 0;
    for (let k = 1; k < V; k++) s += dist(0, k);
    return s / (V - 1);
  }, [V]);

  // SVG 几何
  const W = 320, H = 320, cx = W / 2, cy = H / 2, R = 120;
  const pos = (i: number) => ({
    x: cx + R * Math.cos((-Math.PI / 2) + (2 * Math.PI * i) / V),
    y: cy + R * Math.sin((-Math.PI / 2) + (2 * Math.PI * i) / V),
  });

  // 标出 path: u → x (shorter direction)
  const pathUX = useMemo(() => {
    const ad = Math.abs(u - x);
    const dir = ad <= V - ad ? 1 : -1;
    const seq = [u];
    let cur = u;
    while (cur !== x) {
      cur = (cur + dir + V) % V;
      seq.push(cur);
    }
    return seq;
  }, [u, x, V]);

  const pathVX = useMemo(() => {
    const ad = Math.abs(v - x);
    const dir = ad <= V - ad ? 1 : -1;
    const seq = [v];
    let cur = v;
    while (cur !== x) {
      cur = (cur + dir + V) % V;
      seq.push(cur);
    }
    return seq;
  }, [v, x, V]);

  const edgeStyle = (a: number, b: number) => {
    // a,b are consecutive on the cycle if (a-b mod V) == ±1
    const onPath = (path: number[]) => {
      for (let i = 0; i < path.length - 1; i++) {
        const p = path[i], q = path[i + 1];
        if ((p === a && q === b) || (p === b && q === a)) return true;
      }
      return false;
    };
    return onPath(pathUX) || onPath(pathVX) ? 'is-path' : '';
  };

  return (
    <div className="dg-interactive">
      <div className="dg-controls">
        <div className="dg-ctrl">
          <div className="dg-ctrl-label">
            <span>{t('环上节点数 ', 'Cycle size ')}<TeX src="|V| = 2n" /></span>
            <span className="dg-ctrl-value">{V}</span>
          </div>
          <input type="range" min={3} max={20} value={n} onChange={(e) => {
            const nn = parseInt(e.target.value, 10);
            setN(nn);
            setXIdx((p) => p % (2 * nn));
          }} />
        </div>
        <div className="dg-ctrl">
          <div className="dg-ctrl-label">
            <span>{t('第三个顶点 ', 'Third vertex ')}<TeX src="x" /></span>
            <span className="dg-ctrl-value">x = {x}</span>
          </div>
          <input type="range" min={1} max={V - 1} value={x === 0 ? 1 : x}
                 onChange={(e) => setXIdx(parseInt(e.target.value, 10))} />
        </div>
      </div>

      <div className="dg-vt-stage">
        <div className="dg-vt-graph">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={W} aria-hidden="true">
            {/* edges */}
            {Array.from({ length: V }).map((_, i) => {
              const a = i, b = (i + 1) % V;
              const pa = pos(a), pb = pos(b);
              return (
                <line key={`e${i}`} className={`dg-vt-edge ${edgeStyle(a, b)}`}
                      x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} />
              );
            })}
            {/* nodes */}
            {Array.from({ length: V }).map((_, i) => {
              const p = pos(i);
              let cls = 'dg-vt-node';
              if (i === u) cls += ' is-u';
              else if (i === v) cls += ' is-v';
              else if (i === x) cls += ' is-x';
              return (
                <g key={`n${i}`}>
                  <circle className={cls} cx={p.x} cy={p.y}
                          r={i === u || i === v || i === x ? 8 : 4} />
                  {(i === u || i === v || i === x) && (
                    <text className="dg-vt-label"
                          x={p.x + (p.x > cx ? 16 : p.x < cx ? -16 : 0)}
                          y={p.y + (p.y > cy ? 18 : p.y < cy ? -10 : 4)}>
                      {i === u ? 'u' : i === v ? 'v' : 'x'}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="dg-vt-readout">
          <div><TeX src={`D \\;=\\; d(u, v) \\;=\\; ${D}`} /></div>
          <div><TeX src={`d(u, x) \\;=\\; ${dux}`} /></div>
          <div><TeX src={`d(v, x) \\;=\\; ${dvx}`} /></div>
          <div><TeX src={`d(u, x) + d(v, x) \\;=\\; ${sum} \\;\\ge\\; ${D} \\;=\\; D`} /></div>
          <hr style={{ border: 0, borderTop: '1px solid var(--dg-border)', margin: '8px 0' }} />
          <div style={{ fontSize: '0.86rem' }}>
            <span className="is-key">{t('精确均值', 'Exact mean')}</span> <TeX src={`\\mu \\;=\\; \\frac{1}{2n-1}\\sum_{k=1}^{2n-1} \\min(k, 2n-k) \\;=\\; ${mu.toFixed(4)}`} />
          </div>
          <div style={{ fontSize: '0.86rem' }}>
            <span className="is-key">{t('对比', 'Compare')}</span> <TeX src={`2\\mu \\;=\\; ${(2 * mu).toFixed(4)} \\;>\\; ${D} \\;=\\; D`} /> &nbsp; <span style={{ color: 'var(--dg-ok)' }}>✓</span>
          </div>
        </div>
      </div>

      <p className="dg-sampler-note">
        {(isZh ? (
                        <>把 <TeX src="x" /> 拖一圈,每个位置都满足 <TeX src="d(u,x) + d(v,x) \ge D" />(三角不等式)。把所有 <TeX src="x" /> 求和除以 <TeX src="|V|-1" /> 就得 <TeX src="2\mu \ge |V|\,D/(|V|-1) > D" />,Theorem 2 在 <TeX src="C_{2n}" /> 上就这么干净。</>
                      ) : (
                        <>Drag <TeX src="x" /> around the cycle: every position satisfies <TeX src="d(u,x) + d(v,x) \ge D" /> (triangle inequality). Summing over all <TeX src="x" /> and dividing by <TeX src="|V|-1" /> gives <TeX src="2\mu \ge |V|\,D/(|V|-1) > D" /> — that's Theorem 2 on <TeX src="C_{2n}" />, on a single page.</>
                      ))}
      </p>
    </div>
  );
}
