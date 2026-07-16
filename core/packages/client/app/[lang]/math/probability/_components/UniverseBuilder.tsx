'use client';

/**
 * 面板 1 — 顶层全集有多大:四个自由度(CO / EO / CP / EP)可开关,
 * 数字现算;预设一键切到 1LLL / ZBLL / PLL / ELL 的全集。
 */
import { useState } from 'react';
import { TeX } from '@/components/math/Tex';
import { useT } from '@/hooks/useT';

interface Free { co: boolean; eo: boolean; cp: boolean; ep: boolean }

const PRESETS: ReadonlyArray<{ id: string; label: string; free: Free }> = [
  { id: '1lll', label: '1LLL', free: { co: true, eo: true, cp: true, ep: true } },
  { id: 'zbll', label: 'ZBLL', free: { co: true, eo: false, cp: true, ep: true } },
  { id: 'pll', label: 'PLL', free: { co: false, eo: false, cp: true, ep: true } },
  { id: 'ell', label: 'ELL', free: { co: false, eo: true, cp: false, ep: true } },
];

const FACTORS = [
  { key: 'co' as const, n: 27, zh: '角朝向', en: 'Corner ori.', tex: String.raw`3^4/3 = 27` },
  { key: 'eo' as const, n: 8, zh: '棱朝向', en: 'Edge ori.', tex: String.raw`2^4/2 = 8` },
  { key: 'cp' as const, n: 24, zh: '角排列', en: 'Corner perm.', tex: String.raw`4! = 24` },
  { key: 'ep' as const, n: 24, zh: '棱排列', en: 'Edge perm.', tex: String.raw`4! = 24` },
];

const PALETTE = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B'];

export default function UniverseBuilder() {
  const t = useT();
  const [free, setFree] = useState<Free>({ co: true, eo: true, cp: true, ep: true });

  const permFree = (free.cp ? 24 : 1) * (free.ep ? 24 : 1);
  const parity = permFree > 1 ? 2 : 1;   // 有排列自由度才有奇偶约束可除
  const total = (free.co ? 27 : 1) * (free.eo ? 8 : 1) * permFree / parity;

  const preset = PRESETS.find(p =>
    p.free.co === free.co && p.free.eo === free.eo && p.free.cp === free.cp && p.free.ep === free.ep);

  // 因子条:宽度 ∝ log(factor),直观展示乘法结构
  const active = FACTORS.filter(f => free[f.key]);
  const widths = active.map(f => Math.log(f.n));
  const wSum = widths.reduce((a, b) => a + b, 0) || 1;
  const BAR_W = 480;
  const BAR_H = 46;

  return (
    <div className="prob-panel">
      <div className="prob-panel-title">{t('这层顶面一共有多少个状态?', 'How many last-layer states are there?')}</div>
      <div className="prob-panel-sub">
        {t('底两层已还原时,顶层的自由度只剩四个。点开 / 关掉它们,数一数。',
          'With F2L done, only four degrees of freedom remain. Toggle them and count.')}
      </div>

      <div className="prob-chip-row">
        {FACTORS.map(f => (
          <button
            key={f.key}
            type="button"
            className={`prob-chip${free[f.key] ? ' is-active' : ''}`}
            onClick={() => setFree(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
          >
            {t(f.zh, f.en)} {free[f.key] ? `× ${f.n}` : t('已解决', 'solved')}
          </button>
        ))}
      </div>

      <div className="prob-chip-row" style={{ marginTop: 6 }}>
        <span className="prob-chip-row-label">{t('预设', 'Presets')}</span>
        {PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            className={`prob-chip is-ghost${preset?.id === p.id ? ' is-active' : ''}`}
            onClick={() => setFree(p.free)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {total > 1 ? (
        <svg viewBox={`0 0 ${BAR_W} ${BAR_H + 26}`} width="100%" style={{ maxWidth: BAR_W, marginTop: 14 }}>
          {(() => {
            let x = 0;
            const parts = active.map(f => {
              const w = (Math.log(f.n) / wSum) * (BAR_W - (parity === 2 ? 64 : 0));
              const el = (
                <g key={f.key}>
                  <rect x={x} y={0} width={Math.max(w - 3, 2)} height={BAR_H} rx={6} fill={PALETTE[FACTORS.indexOf(f)]} opacity={0.85} />
                  <text x={x + w / 2 - 1.5} y={BAR_H / 2 + 5} textAnchor="middle" fontSize={15} fontWeight={700} fill="#fff">{f.n}</text>
                  <text x={x + w / 2 - 1.5} y={BAR_H + 18} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">{t(f.zh, f.en)}</text>
                </g>
              );
              x += w;
              return el;
            });
            if (parity === 2) {
              parts.push(
                <g key="parity">
                  <rect x={x} y={0} width={61} height={BAR_H} rx={6} fill="none" stroke="var(--border-strong)" strokeDasharray="4 3" />
                  <text x={x + 30.5} y={BAR_H / 2 + 5} textAnchor="middle" fontSize={15} fontWeight={700} fill="var(--foreground)">÷ 2</text>
                  <text x={x + 30.5} y={BAR_H + 18} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">{t('奇偶', 'parity')}</text>
                </g>,
              );
            }
            return parts;
          })()}
        </svg>
      ) : null}

      <div className="prob-result">
        <span className="prob-result-num">{total.toLocaleString('en-US')}</span>
        <span className="prob-result-label">
          {preset
            ? t(`个状态 —— 这就是 ${preset.label} 的全集`, `states — the ${preset.label} universe`)
            : t('个状态', 'states')}
        </span>
      </div>

      {preset?.id === 'ell' && (
        <div className="prob-note">
          {t('ELL 的 96 个「角块严格还原」状态在 AUF 下不封闭:打乱前转一下顶层,角块就整体偏一格。把 4 个 AUF 相位都算进来,case 计数用的全集是 96 × 4 = 384。两种口径给出的概率完全一致(见下方轨道面板)。',
            'The 96 corners-strictly-solved ELL states are not closed under AUF: a pre-turn offsets the corner block. Including all 4 AUF phases, the case-counting universe is 96 × 4 = 384. Both conventions give identical probabilities (see the orbit panel below).')}
        </div>
      )}

      <div className="prob-formula">
        <TeX src={String.raw`27 \times 8 \times 24 \times 24 \,/\, 2 = 62208`} />
        <span className="prob-formula-note">
          {t('全开就是完整的 1LLL 全集;÷2 来自角棱排列奇偶必须一致(只转外层做不出单个二循环)。',
            'Everything free gives the full 1LLL universe; the ÷2 is the parity constraint linking corner and edge permutations (outer turns cannot make a lone swap).')}
        </span>
      </div>
    </div>
  );
}
