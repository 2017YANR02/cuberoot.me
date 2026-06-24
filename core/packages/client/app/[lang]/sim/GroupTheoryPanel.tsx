'use client';
/**
 * GroupTheoryPanel — the visible half of the "group-theory kernel" render mode. The
 * puzzle is still drawn by our Three.js engine (PyraCube …); this panel surfaces what
 * the geometry can't show: the exact group order via Schreier-Sims, the Z_o ≀ S_n
 * orbit structure, the unconstrained reassembly count and the constraint index — all
 * computed live in-browser by the vendored cubing.js puzzle-geometry (lazy-loaded so
 * its ~3.4k-line compiler never lands in the default bundle).
 *
 * Every number here is a group invariant (independent of how our move notation maps
 * onto PG's), so the panel is rigorous without a geometric move bridge.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sigma } from 'lucide-react';
import type { PgGroupFacts } from './engine/pgBackbone';
import './group-theory-panel.css';

/** Sim puzzle kind → vendored PG puzzle name (a `pgPuzzle` key). Extend as engine
 *  puzzles gain a PG kernel. */
const PG_NAME: Record<string, string> = {
  pyraminx: 'pyraminx',
};

const SUBS = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number): string => String(n).split('').map((d) => SUBS[+d]).join('');
const grp = (b: bigint): string => b.toLocaleString('en-US');
/** Z_o ≀ S_n for an oriented orbit, S_n for an unoriented one. */
const wreath = (pieces: number, oriMod: number): string =>
  (oriMod > 1 ? `ℤ${sub(oriMod)}≀S${sub(pieces)}` : `S${sub(pieces)}`);

export default function GroupTheoryPanel({ puzzle }: { puzzle: string }) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string): string => (isZh ? zh : en);

  const pgName = PG_NAME[puzzle];
  const [facts, setFacts] = useState<PgGroupFacts | null>(null);
  const [ms, setMs] = useState(0);

  useEffect(() => {
    if (!pgName) return;
    let alive = true;
    setFacts(null);
    void import('./engine/pgBackbone').then(({ PgBackbone }) => {
      const t0 = performance.now();
      const f = new PgBackbone(pgName).facts();
      const dt = performance.now() - t0;
      if (!alive) return;
      setFacts(f);
      setMs(dt);
    });
    return () => { alive = false; };
  }, [pgName]);

  if (!pgName) return null;

  return (
    <section className="gt-panel">
      <header className="gt-head">
        <Sigma size={15} aria-hidden />
        <span className="gt-title">{t('群论内核', 'Group-theory kernel')}</span>
        <span className="gt-src">cubing.js puzzle-geometry</span>
      </header>

      {!facts ? (
        <div className="gt-loading">{t('计算群结构…', 'Computing group…')}</div>
      ) : (
        <>
          <div className="gt-order">
            <div className="gt-order-num">{grp(facts.order)}</div>
            <div className="gt-order-lbl">{t('状态数(固定于空间)', 'states (fixed in space)')}</div>
            {facts.reorientations > 1n && (
              <div className="gt-order-sub">
                = {grp(facts.turningOrder)} × {facts.reorientations.toString()}
                <span className="gt-dim">
                  {'  '}({t('整体重定向', 'whole-puzzle reorientations')} |A
                  {sub(Number(facts.reorientations) === 12 ? 4 : 0)}|)
                </span>
              </div>
            )}
          </div>

          <dl className="gt-rows">
            <div className="gt-row">
              <dt>{t('群嵌入', 'Group embeds in')}</dt>
              <dd className="gt-mono">
                G ≤ {facts.orbits.map((o) => wreath(o.pieces, o.oriMod)).join(' × ')}
              </dd>
            </div>

            <div className="gt-row gt-row-block">
              <dt>{t('轨道', 'Orbits')}</dt>
              <dd>
                <ul className="gt-orbits">
                  {facts.orbits.map((o) => (
                    <li key={o.name}>
                      <span className="gt-orbit-name">{o.name}</span>
                      <span className="gt-dim">
                        {o.pieces} {t('块', 'pieces')}
                        {o.oriMod > 1
                          ? ` · ${t('取向', 'orient')} ℤ${sub(o.oriMod)}`
                          : ` · ${t('无取向', 'no orient')}`}
                      </span>
                      <span className="gt-mono gt-dim">{wreath(o.pieces, o.oriMod)}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>

            <div className="gt-row">
              <dt>{t('无约束总数', 'Reassembly')}</dt>
              <dd className="gt-mono">{grp(facts.reassembly)}</dd>
            </div>
            <div className="gt-row">
              <dt>{t('约束指数', 'Constraint index')}</dt>
              <dd className="gt-mono">
                {facts.index.toString()}
                <span className="gt-dim">  = {t('无约束', 'reassembly')} / |G|</span>
              </dd>
            </div>

            <div className="gt-row gt-row-block">
              <dt>{t('生成元', 'Generators')} ({facts.moveNames.length})</dt>
              <dd>
                <div className="gt-gens">
                  {facts.moveNames.map((m) => (
                    <code key={m} className="gt-gen">{m}</code>
                  ))}
                </div>
              </dd>
            </div>
          </dl>

          <footer className="gt-foot">
            {t('Schreier-Sims 实时计算', 'computed live by Schreier-Sims')} · {ms.toFixed(0)}ms
          </footer>
        </>
      )}
    </section>
  );
}
