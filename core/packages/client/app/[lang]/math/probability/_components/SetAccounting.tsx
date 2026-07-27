'use client';

/**
 * 面板 4 — 与公式库对账 + 训练概率速查 + 顶层最优步数分布。
 * 62,208 个顶层状态被本站四个公式集(1LLL / ZBLL / PLL / ELL)+ 还原态严格瓜分;
 * 点「对账」现场拉公式库,把每个 case 的轨道大小(16 / cn)加总,验证分毫不差。
 * 同一次拉取顺带把每个 case 的最优步数按轨道加权,给出「按状态计」的步数分布 ——
 * 与「按 case 计」并排,对称 case 被高估的那一截一眼可见。
 */
import { useState } from 'react';
import type { AlgCase } from '@cuberoot/shared';
import Link from '@/components/AppLink';
import { loadAlg } from '@cuberoot/shared';
import {
  ALG_SET_UNIVERSE, LL_UNIVERSE_TOTAL, caseOrbit, llMeanLength, llOptimalBins, probabilityFraction,
  type LlLengthBins, type OptimalMetric,
} from '@/lib/alg_probability';
import { groupDigits } from '@/lib/group-digits';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';

/** 分块(与现场枚举一致的期望值,对账时逐项核):label / DB set / 状态数 */
const PARTS = [
  { set: '1lll', zh: '纯 1LLL case', en: 'pure 1LLL cases', states: 54096, color: '#2A4D69' },
  { set: 'zbll', zh: 'ZBLL case', en: 'ZBLL cases', states: 7488, color: '#3F7050' },
  { set: 'ell', zh: 'ELL case', en: 'ELL cases', states: 336, color: '#B8860B' },
  { set: 'pll', zh: 'PLL case', en: 'PLL cases', states: 284, color: '#8B2E3C' },
  { set: null, zh: '还原(LL 跳过)', en: 'solved (LL skip)', states: 4, color: '#6B4E9C' },
] as const;

type AuditState =
  | { phase: 'idle' }
  | { phase: 'loading'; done: number }
  | {
    phase: 'done';
    rows: Array<{ set: string; cases: number; sum: number; expected: number; ok: boolean }>;
    /** 四套度量各自的步数分布,拉一次算全 —— 切换度量不再联网 */
    bins: Record<OptimalMetric, LlLengthBins>;
  }
  | { phase: 'error'; message: string };

const METRICS: { key: OptimalMetric; label: string }[] = [
  { key: 'htm', label: 'HTM' },
  { key: 'qtm', label: 'QTM' },
  { key: 'stm', label: 'STM' },
  { key: 'sqtm', label: 'SQTM' },
];

const CN_OPTIONS = [
  { cn: 1, zh: '无对称 (C1)', en: 'no symmetry (C1)' },
  { cn: 2, zh: '二重对称 (C2)', en: 'two-fold (C2)' },
  { cn: 4, zh: '四重对称 (C4)', en: 'four-fold (C4)' },
] as const;

/**
 * 顶层最优步数分布:同一批 case 两种数法并排 —— 按 case 数 vs 按状态数(轨道加权)。
 * 还原态那 4 个状态由 `llOptimalBins` 补进 0 步档,所以状态列合计必然是 62,208。
 */
function LengthDist({ bins }: { bins: Record<OptimalMetric, LlLengthBins> }) {
  const t = useT();
  const [metric, setMetric] = useState<OptimalMetric>('htm');
  const cur = bins[metric];
  const lens = Object.keys(cur.byState).map(Number).sort((a, b) => a - b);
  const maxState = Math.max(...lens.map((d) => cur.byState[d]));
  const mean = llMeanLength(cur);

  return (
    <>
      <div className="prob-divider" />
      <div className="prob-panel-title" style={{ fontSize: '1rem' }}>
        {t('顺带:顶层最优步数分布', 'While we are here: the last layer’s optimal-length distribution')}
      </div>
      <div className="prob-panel-sub">
        {t(
          '每个 case 的元数据带着四套度量下的最优步数。按 case 数与按状态数(轨道加权)分别统计 —— 对称 case 只覆盖 4 或 8 个状态,两列因此并不成比例。',
          'Every case carries its optimal length under four metrics. Counting by case and by state (orbit-weighted) gives two different pictures, because a symmetric case covers only 4 or 8 states.',
        )}
      </div>
      <div className="prob-chip-row">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`prob-chip${metric === m.key ? ' is-active' : ''}`}
            onClick={() => setMetric(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <table className="prob-skip-table prob-mini-table">
        <thead>
          <tr>
            <th scope="col">{t('步数', 'Moves')}</th>
            <th scope="col">{t('case 数', 'Cases')}</th>
            <th scope="col">{t('状态数', 'States')}</th>
            <th scope="col">{t('占比', 'Share')}</th>
          </tr>
        </thead>
        <tbody>
          {lens.map((d) => (
            <tr key={d}>
              <th scope="row">{d}</th>
              <td className="prob-skip-num">{groupDigits(String(cur.byCase[d]))}</td>
              <td className="prob-cell-bar">
                <i style={{ width: `${(cur.byState[d] / maxState) * 100}%` }} />
                <span>{groupDigits(String(cur.byState[d]))}</span>
              </td>
              <td className="prob-skip-num">
                {`${Number(((100 * cur.byState[d]) / cur.states).toPrecision(3))}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="prob-audit-total">
        {t(
          `${groupDigits(String(cur.cases))} 个 case、${groupDigits(String(cur.states))} 个状态(含还原态那 4 个),平均 ${mean.toFixed(3)} 步`,
          `${groupDigits(String(cur.cases))} cases over ${groupDigits(String(cur.states))} states (including the four solved ones), mean ${mean.toFixed(3)} moves`,
        )}
        {cur.missing > 0 && t(
          `;另有 ${cur.missing} 个 case 在该度量下没有最优步数`,
          `; ${cur.missing} cases carry no optimal length under this metric`,
        )}
      </div>
    </>
  );
}

export default function SetAccounting() {
  const t = useT();
  const [audit, setAudit] = useState<AuditState>({ phase: 'idle' });
  const [cn, setCn] = useState<1 | 2 | 4>(1);
  const [uniKey, setUniKey] = useState<'zbll' | 'pll' | 'ell' | '1lll'>('zbll');

  const runAudit = async () => {
    setAudit({ phase: 'loading', done: 0 });
    try {
      const rows: Array<{ set: string; cases: number; sum: number; expected: number; ok: boolean }> = [];
      const lists: AlgCase[][] = [];
      let done = 0;
      for (const part of PARTS) {
        if (!part.set) continue;
        const file = await loadAlg('3x3', part.set);
        const sum = file.cases.reduce((acc, c) => acc + (caseOrbit(c) ?? 0), 0);
        rows.push({ set: part.set, cases: file.cases.length, sum, expected: part.states, ok: sum === part.states });
        lists.push(file.cases);
        done += 1;
        setAudit({ phase: 'loading', done });
      }
      const bins = Object.fromEntries(
        METRICS.map((m) => [m.key, llOptimalBins(lists, m.key)]),
      ) as Record<OptimalMetric, LlLengthBins>;
      setAudit({ phase: 'done', rows, bins });
    } catch (e) {
      setAudit({ phase: 'error', message: String(e) });
    }
  };

  const BAR_W = 520;
  const orbit = 16 / cn;
  const uni = ALG_SET_UNIVERSE[uniKey];

  return (
    <div className="prob-panel">
      <div className="prob-panel-title">{t('62,208 个状态,一个不多一个不少', '62,208 states, none missing, none counted twice')}</div>
      <div className="prob-panel-sub">
        {t('本站公式库把顶层 case 分进四个集合。每个 case 的元数据带着对称阶 cn,轨道大小 = 16 / cn;把所有轨道加起来,应当恰好铺满整个全集。',
          'The alg database splits last-layer cases into four sets. Each case’s metadata carries its symmetry order cn, so its orbit has 16 / cn states; summed over all cases the orbits must tile the whole universe exactly.')}
      </div>

      <svg viewBox={`0 0 ${BAR_W} 96`} width="100%" style={{ maxWidth: BAR_W }}>
        {(() => {
          // 主条(线性):1LLL 占 87%,小块在条下方引出标注
          let x = 0;
          return PARTS.map((p, i) => {
            const w = (p.states / LL_UNIVERSE_TOTAL) * BAR_W;
            const drawW = Math.max(w, 2);
            const cx = x + drawW / 2;
            const lx = 55 + i * ((BAR_W - 110) / 4);   // 标签均匀铺开,首尾留边不出 viewBox
            const label = (
              <g key={`l${i}`}>
                <line x1={cx} y1={34} x2={lx} y2={54} stroke="var(--border-strong)" strokeWidth={1} />
                <text x={lx} y={70} textAnchor="middle" fontSize={11.5} fill="var(--muted-foreground)">
                  {t(p.zh, p.en)}
                </text>
                <text x={lx} y={86} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--foreground)">
                  {p.states.toLocaleString('en-US')}
                </text>
              </g>
            );
            const rect = <rect key={`r${i}`} x={x} y={4} width={Math.max(drawW - 1.5, 1.5)} height={30} rx={3} fill={p.color} opacity={0.85} />;
            x += drawW;
            return <g key={i}>{rect}{label}</g>;
          });
        })()}
      </svg>

      <div className="prob-chip-row" style={{ marginTop: 10 }}>
        <button type="button" className="prob-btn" onClick={runAudit} disabled={audit.phase === 'loading'}>
          {audit.phase === 'loading'
            ? t(`对账中…(${audit.done}/4 个集合)`, `Auditing… (${audit.done}/4 sets)`)
            : t('拉取公式库现场对账', 'Fetch the alg DB and audit live')}
        </button>
      </div>

      {audit.phase === 'done' && (
        <div className="prob-audit">
          {audit.rows.map(r => (
            <div key={r.set} className={`prob-audit-row${r.ok ? ' is-ok' : ' is-bad'}`}>
              <span className="prob-audit-set">{r.set.toUpperCase()}</span>
              <span>{t(`${r.cases} 个 case`, `${r.cases} cases`)}</span>
              <span>{t('轨道合计', 'orbit sum')} {r.sum.toLocaleString('en-US')}</span>
              <span>{r.ok ? t('= 期望值,对上了', '= expected, checks out') : t(`≠ 期望 ${r.expected}`, `≠ expected ${r.expected}`)}</span>
            </div>
          ))}
          <div className="prob-audit-total">
            {t(
              `合计 ${audit.rows.reduce((a, r) => a + r.sum, 0).toLocaleString('en-US')} + 4(还原)= ${(audit.rows.reduce((a, r) => a + r.sum, 0) + 4).toLocaleString('en-US')}`,
              `total ${audit.rows.reduce((a, r) => a + r.sum, 0).toLocaleString('en-US')} + 4 (solved) = ${(audit.rows.reduce((a, r) => a + r.sum, 0) + 4).toLocaleString('en-US')}`,
            )}
          </div>
        </div>
      )}

      {audit.phase === 'done' && <LengthDist bins={audit.bins} />}
      {audit.phase === 'error' && (
        <div className="prob-note">{t('公式库拉取失败:', 'Failed to fetch the alg DB: ')}{audit.message}</div>
      )}

      <div className="prob-divider" />

      <div className="prob-panel-title" style={{ fontSize: '1rem' }}>{t('概率速查', 'Probability lookup')}</div>
      <div className="prob-chip-row">
        {CN_OPTIONS.map(o => (
          <button key={o.cn} type="button" className={`prob-chip${cn === o.cn ? ' is-active' : ''}`} onClick={() => setCn(o.cn)}>
            {t(o.zh, o.en)}
          </button>
        ))}
        {(['zbll', 'pll', 'ell', '1lll'] as const).map(k => (
          <button key={k} type="button" className={`prob-chip is-ghost${uniKey === k ? ' is-active' : ''}`} onClick={() => setUniKey(k)}>
            {ALG_SET_UNIVERSE[k].label}
          </button>
        ))}
      </div>
      <div className="prob-result">
        <span className="prob-result-num">{probabilityFraction(orbit, uni.total)}</span>
        <span className="prob-result-label">
          {t(
            `${uni.label} 全集 ${uni.total.toLocaleString('en-US')} 态中占 ${orbit} 态 ≈ ${Number((100 * orbit / uni.total).toPrecision(2))}%`,
            `${orbit} of ${uni.total.toLocaleString('en-US')} states in the ${uni.label} universe ≈ ${Number((100 * orbit / uni.total).toPrecision(2))}%`,
          )}
        </span>
      </div>

      <div className="prob-note">
        {tr({
          zh: '这套权重直接驱动本站训练器的「真实概率」出题模式;每个 case 的弹窗里也标了它的两个概率。',
          en: 'These weights drive the trainer’s “real odds” drill mode, and every case’s metadata popup shows its two probabilities.',
        })}
        {' '}
        <Link href="/alg/3x3/zbll" className="prob-link">{t('去 ZBLL 公式库', 'Open the ZBLL library')}</Link>
        {' '}
        <Link href="/alg/3x3/zbll/select" className="prob-link">{t('去训练器', 'Open the trainer')}</Link>
      </div>
    </div>
  );
}
