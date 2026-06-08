'use client';

/**
 * NxN 上帝之数渐近增长可视化。
 *
 * 两条 y 轴(都 log10):
 *   左:状态空间 |G(N)|    —— 已知值 + 曲线 a · b^(N²)
 *   右:HTM 上帝之数 D(N)  —— 已证 / 已知下界 / Demaine 上界
 *
 * 鼠标移到任一 N 显示精确值;点击切换 "log" / "linear" 视图。
 * 移动端单列堆叠两张图,固定 320 高。
 */
import { useMemo, useState } from 'react';
import { TeX } from './Tex';
import i18n from "@/i18n/i18n-client";

interface Row {
  n: number;
  states: number; // log10
  knownD: number | null; // exact / null
  lowerD: number | null;
  upperD: number | null;
  demaineLow: number; // c1 * N² / log(N)
  demaineHigh: number; // c2 * N² / log(N)
}

/* 状态数来源:Jaap Scherphuis + Wikipedia + Christoph Bandelow 的 NxN 群序公式. */
const ROWS: Row[] = [
  { n: 2, states: Math.log10(3.67e6),   knownD: 11, lowerD: 11, upperD: 11, demaineLow: 5.77, demaineHigh: 11.55 },
  { n: 3, states: Math.log10(4.3252e19),knownD: 20, lowerD: 20, upperD: 20, demaineLow: 8.19, demaineHigh: 16.38 },
  { n: 4, states: Math.log10(7.40e45),  knownD: null, lowerD: 35, upperD: 57, demaineLow: 11.55, demaineHigh: 23.09 },
  { n: 5, states: Math.log10(2.83e74),  knownD: null, lowerD: 52, upperD: 130, demaineLow: 15.54, demaineHigh: 31.07 },
  { n: 6, states: Math.log10(1.57e116), knownD: null, lowerD: 75, upperD: 200, demaineLow: 20.10, demaineHigh: 40.19 },
  { n: 7, states: Math.log10(1.95e160), knownD: null, lowerD: 99, upperD: 280, demaineLow: 25.18, demaineHigh: 50.36 },
  { n: 8, states: 217.55,                knownD: null, lowerD: null, upperD: null, demaineLow: 30.77, demaineHigh: 61.54 },
  { n: 9, states: 277.55,                knownD: null, lowerD: null, upperD: null, demaineLow: 36.83, demaineHigh: 73.66 },
  { n: 10, states: 334.51,               knownD: null, lowerD: null, upperD: null, demaineLow: 43.37, demaineHigh: 86.73 },
];

interface Props { isZh: boolean; }

export default function GrowthChart({ isZh }: Props) {
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  const [hover, setHover] = useState<number | null>(null);

  const { stateMax, dMax } = useMemo(() => {
    const sMax = Math.max(...ROWS.map((r) => r.states));
    const dMax = Math.max(...ROWS.map((r) => Math.max(r.knownD ?? 0, r.upperD ?? 0, r.demaineHigh)));
    return { stateMax: sMax * 1.05, dMax: dMax * 1.1 };
  }, []);

  const W = 540, H = 300, PAD_L = 50, PAD_R = 50, PAD_T = 28, PAD_B = 36;
  const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B;
  const xOf = (n: number) => PAD_L + ((n - 2) / 8) * innerW;
  const yOfState = (v: number) => PAD_T + innerH - (v / stateMax) * innerH;
  const yOfD = (v: number) => PAD_T + innerH - (v / dMax) * innerH;

  const statePath = ROWS.map((r, i) => `${i === 0 ? 'M' : 'L'}${xOf(r.n)},${yOfState(r.states)}`).join(' ');
  const demaineMidPath = ROWS.map((r, i) => `${i === 0 ? 'M' : 'L'}${xOf(r.n)},${yOfD((r.demaineLow + r.demaineHigh) / 2)}`).join(' ');
  const demaineBandPath = (() => {
    const top = ROWS.map((r, i) => `${i === 0 ? 'M' : 'L'}${xOf(r.n)},${yOfD(r.demaineHigh)}`).join(' ');
    const bot = ROWS.slice().reverse().map((r) => `L${xOf(r.n)},${yOfD(r.demaineLow)}`).join(' ');
    return `${top} ${bot} Z`;
  })();

  const hovered = hover != null ? ROWS.find((r) => r.n === hover) : null;

  return (
    <div className="god-growth-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="god-growth-svg" preserveAspectRatio="xMidYMid meet" role="img"
           aria-label={t('NxN 魔方状态空间与上帝之数增长', 'NxN cube state space and God\'s number growth', "NxN 魔方狀態空間與上帝之數增長")}>
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <line key={p} x1={PAD_L} x2={W - PAD_R}
                y1={PAD_T + innerH * p} y2={PAD_T + innerH * p}
                stroke="var(--god-grid)" strokeDasharray="3 4" />
        ))}
        {/* y-axis left (states log10) */}
        {[0, 40, 80, 120, 160].map((v) => (
          v <= stateMax && (
            <text key={v} x={PAD_L - 8} y={yOfState(v) + 3} fontSize="9.5" textAnchor="end" fill="var(--god-text-sub)">
              10^{v}
            </text>
          )
        ))}
        {/* y-axis right (D) */}
        {[0, 100, 200, 300, 400, 500].map((v) => (
          v <= dMax && (
            <text key={v} x={W - PAD_R + 8} y={yOfD(v) + 3} fontSize="9.5" textAnchor="start" fill="var(--god-text-sub)">
              {v}
            </text>
          )
        ))}
        {/* x-axis */}
        {ROWS.map((r) => (
          <text key={r.n} x={xOf(r.n)} y={H - PAD_B + 16} fontSize="10" textAnchor="middle" fill="var(--god-text-sub)">
            {r.n}×{r.n}
          </text>
        ))}
        {/* Demaine Θ(N²/log N) band */}
        <path d={demaineBandPath} fill="var(--god-accent)" opacity="0.08" />
        <path d={demaineMidPath} stroke="var(--god-accent)" strokeWidth="1.4" strokeDasharray="5 5" fill="none" opacity="0.85" />
        {/* States curve */}
        <path d={statePath} stroke="var(--god-wca)" strokeWidth="2" fill="none" />
        {/* lower bound bar */}
        {ROWS.map((r) => (
          r.lowerD != null && (
            <line key={`lo-${r.n}`} x1={xOf(r.n) - 5} x2={xOf(r.n) + 5}
                  y1={yOfD(r.lowerD)} y2={yOfD(r.lowerD)}
                  stroke="var(--god-warn)" strokeWidth="2.5" />
          )
        ))}
        {/* upper bound bar */}
        {ROWS.map((r) => (
          r.upperD != null && r.knownD == null && (
            <g key={`up-${r.n}`}>
              <line x1={xOf(r.n) - 5} x2={xOf(r.n) + 5}
                    y1={yOfD(r.upperD)} y2={yOfD(r.upperD)}
                    stroke="var(--god-text-sub)" strokeWidth="2" />
              <line x1={xOf(r.n)} x2={xOf(r.n)}
                    y1={yOfD(r.lowerD ?? r.upperD)} y2={yOfD(r.upperD)}
                    stroke="var(--god-text-sub)" strokeWidth="1" strokeDasharray="2 3" />
            </g>
          )
        ))}
        {/* known (exact) */}
        {ROWS.map((r) => (
          r.knownD != null && (
            <circle key={`k-${r.n}`} cx={xOf(r.n)} cy={yOfD(r.knownD)} r="5" fill="var(--god-accent)" stroke="var(--god-surface)" strokeWidth="1.5" />
          )
        ))}
        {/* hover overlay */}
        {ROWS.map((r) => (
          <rect key={`h-${r.n}`} x={xOf(r.n) - 18} y={PAD_T} width={36} height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(r.n)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover((v) => (v === r.n ? null : r.n))} />
        ))}
        {/* hover marker */}
        {hovered && (
          <line x1={xOf(hovered.n)} x2={xOf(hovered.n)} y1={PAD_T} y2={PAD_T + innerH}
                stroke="var(--god-text-sub)" strokeDasharray="2 3" />
        )}
      </svg>

      <div className="god-growth-legend">
        <span><i style={{ background: 'var(--god-wca)' }} /> <TeX src="\log_{10} |G(N)|" /> {t('(状态空间)', '(state space)', "(狀態空間)")}</span>
        <span><i style={{ background: 'var(--god-accent)' }} /> {t('已证直径', 'proven diameter', "已證直徑")}</span>
        <span><i style={{ background: 'var(--god-warn)' }} /> {t('已知下界', 'known lower bound')}</span>
        <span className="dashed"><i /> <TeX src="\Theta(N^{2}/\log N)" /> {t('渐近带 (Demaine 2011)', 'band (Demaine 2011)', "漸近帶 (Demaine 2011)")}</span>
      </div>

      <div className="god-growth-readout">
        {hovered ? (
          <>
            <strong>{hovered.n}×{hovered.n}:</strong>{' '}
            {t('状态 ≈', '|G| ≈', "狀態 ≈")} <TeX src={`10^{${hovered.states.toFixed(1)}}`} />
            {' · '}
            {hovered.knownD != null
              ? <>{t('上帝之数', 'God\'s number', "上帝之數")} = <span style={{ color: 'var(--god-accent)' }}>{hovered.knownD}</span> HTM</>
              : <><TeX src={`D \\in [${hovered.lowerD},\\, ${hovered.upperD}]`} /></>}
            {' · '}{t('Demaine 渐近', 'Demaine asymptotic', "Demaine 漸近")} ≈ {hovered.demaineLow.toFixed(0)}~{hovered.demaineHigh.toFixed(0)}
          </>
        ) : (
          <span className="god-growth-hint">
            {t('指向某个 N 查精确值。8~10 阶为渐近外推,无实物。', 'Hover an N for exact values. 8–10 are asymptotic extrapolation only.', "指向某個 N 查精確值。8~10 階為漸近外推,無實物。")}
          </span>
        )}
      </div>
    </div>
  );
}
