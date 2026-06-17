'use client';

/**
 * SQ1 计步对照器:粘贴/编辑一段 (x,y)/ 序列,实时算出三套口径的步数。
 *   - twist(扭转/slash):只数 "/"
 *   - WCA 12c4:非平凡 (x,y) 各 1 + "/" 各 1
 *   - face-turn(面转):(x,0)/(0,y) 各 1,双层 (x,y) = 2,"/" 各 1
 * 复用站内统一解析器 parseSq1Tokens,口径与 /scramble、recon 一致。
 */
import { useMemo, useState } from 'react';
import { canonicalSq1Alg } from '@/lib/sq1-svg';
import { sq1MoveCounts } from '@/lib/sq1-metrics';
import { METRICS } from './sq1_data';

interface Props { isZh: boolean; }

const PRESETS: { label: string; alg: string }[] = [
  { label: 'WCA scramble', alg: '(1,3)/(5,5)/(3,0)/(-5,-2)/(-4,5)/(-5,-5)/(-1,0)/(3,0)/(-5,0)/(-4,0)/(-2,0)/(-2,0)/' },
  { label: 'Adj swap', alg: '(1,0)/(-3,0)/(0,3)/(3,0)/(0,-3)/(3,0)/(0,-3)/(-1,0)' },
  { label: 'Cube shape', alg: '(3,0)/(0,3)/(3,0)/(3,3)/' },
  { label: 'Solved', alg: '' },
];

export default function MoveCountCalculator({ isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [alg, setAlg] = useState(PRESETS[0].alg);

  const { counts, valid } = useMemo(() => {
    const c = sq1MoveCounts(alg);
    // valid = 输入非空且能解析出 token(或干脆空 = solved)
    const stripped = alg.trim();
    const valid = stripped === '' || c.turns + c.slices > 0;
    return { counts: c, valid };
  }, [alg]);

  const { slices, turns, nonIdentityTurns: nonIdTurns, doubleTurns } = counts;

  const maxVal = Math.max(counts.twist, counts.wca, counts.face, 1);

  const cards: { key: 'twist' | 'wca' | 'face'; cls: string; val: number }[] = [
    { key: 'twist', cls: 'm-twist', val: counts.twist },
    { key: 'wca', cls: 'm-wca', val: counts.wca },
    { key: 'face', cls: 'm-face', val: counts.face },
  ];

  // SVG 对照条形图
  const W = 560, rowH = 34, gap = 12, padL = 96, padR = 60, padT = 8;
  const H = padT + cards.length * (rowH + gap);
  const barMax = W - padL - padR;
  const barColor: Record<string, string> = {
    twist: 'var(--sq1-proven)', wca: 'var(--sq1-open)', face: 'var(--sq1-info)',
  };

  return (
    <div className="sq1-panel">
      <div className="sq1-panel-title">{t('计步对照器', 'Move-count calculator')}</div>
      <div className="sq1-panel-sub">
        {t('粘贴一段 (x,y)/ 序列,三套口径实时计步。', 'Paste an (x,y)/ sequence — all three metrics counted live.')}
      </div>

      <input
        className={`sq1-input ${valid ? '' : 'is-error'}`}
        value={alg}
        spellCheck={false}
        onChange={(e) => setAlg(e.target.value)}
        placeholder={t('例:(1,0)/(-3,3)/…  空 = 已解', 'e.g. (1,0)/(-3,3)/…  empty = solved')}
        aria-label={t('SQ1 序列', 'SQ1 sequence')}
      />

      <div className="sq1-chips" style={{ marginTop: 10 }}>
        {PRESETS.map((p) => (
          <button key={p.label} className={`sq1-chip ${alg === p.alg ? 'is-on' : ''}`} onClick={() => setAlg(p.alg)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="sq1-metric-grid">
        {cards.map((c) => {
          const m = METRICS[c.key];
          return (
            <div key={c.key} className={`sq1-metric-card ${c.cls}`}>
              <div className="sq1-metric-name">{t(m.name.zh, m.name.en)}</div>
              <div className="sq1-metric-rule">{t(m.rule.zh, m.rule.en)}</div>
              <div className="sq1-metric-val">{valid ? c.val : '—'}</div>
              <div className="sq1-metric-god">
                {m.god != null
                  ? t(`上帝之数 ${m.god}(已证)`, `God's number ${m.god} (proven)`)
                  : t('上帝之数 未知', "God's number unknown")}
              </div>
            </div>
          );
        })}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="sq1-svg" style={{ maxWidth: W }} role="img"
           aria-label={t('三口径步数对照', 'three-metric move-count comparison')}>
        {cards.map((c, i) => {
          const y = padT + i * (rowH + gap);
          const w = (c.val / maxVal) * barMax;
          return (
            <g key={c.key}>
              <text x={padL - 8} y={y + rowH / 2 + 4} fontSize="12" textAnchor="end" fill="var(--sq1-text-sub)">
                {t(METRICS[c.key].name.zh, METRICS[c.key].name.en)}
              </text>
              <rect x={padL} y={y} width={barMax} height={rowH} rx={6} fill="var(--sq1-grid)" opacity={0.35} />
              <rect x={padL} y={y} width={valid ? Math.max(w, c.val > 0 ? 4 : 0) : 0} height={rowH} rx={6} fill={barColor[c.key]} opacity={0.85} />
              <text x={padL + (valid ? Math.max(w, 4) : 0) + 8} y={y + rowH / 2 + 5} fontSize="14" fontWeight={700}
                    fill={barColor[c.key]} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {valid ? c.val : '—'}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="sq1-readout">
        {valid ? (
          <>
            <strong>{canonicalSq1Alg(alg) || t('已解状态', 'solved state')}</strong>
            {' — '}
            {t(
              `${turns} 个层转(其中 ${nonIdTurns} 个非平凡、${doubleTurns} 个双层)+ ${slices} 个切片。`,
              `${turns} layer turns (${nonIdTurns} non-trivial, ${doubleTurns} double) + ${slices} slices.`,
            )}
            {doubleTurns > 0 && (
              <> {t(
                `面转比 WCA 多 ${doubleTurns} 步,正是因为这 ${doubleTurns} 个双层转各算 2。`,
                `Face-turn is ${doubleTurns} higher than WCA — exactly the ${doubleTurns} double turns counted twice.`,
              )}</>
            )}
          </>
        ) : (
          <span className="sq1-hint">{t('无法解析,请检查括号 / 数字格式。', 'Cannot parse — check parentheses / number format.')}</span>
        )}
      </div>

      <p className="sq1-caption">
        {t(
          '关键:"/" 切片在任何口径恒计 1,差异只在层转。双层 (x,y) 在面转里 = 2、在 WCA 12c4 里 = 1、在扭转口径里 = 0(免费)。所以同一段解,扭转步数 ≤ WCA 步数 ≤ 面转步数。',
          'Key: a "/" slice always counts 1 in every metric — the only divergence is layer turns. A double (x,y) is 2 in face-turn, 1 in WCA 12c4, and 0 (free) in the twist metric. So for any solution: twist count ≤ WCA count ≤ face-turn count.',
        )}
      </p>
    </div>
  );
}
