'use client';
/**
 * GroupTheoryPanel — the visible half of the "群论内核" render mode. Our Three.js engine
 * (PyraCube …) still draws the pixels; this panel runs the *real* vendored cubing.js
 * group theory on top of it, live:
 *
 *   • static invariants — |G| via Schreier-Sims, the Zₒ≀Sₙ orbit structure, the
 *     unconstrained reassembly count and the constraint index;
 *   • live state — the current group element's order + a group-theoretic solved test,
 *     mirrored from the engine's own moves (faithful: group-solved ⇔ geometry-solved);
 *   • actions — 群论打乱 = a uniform random STATE via the BSGS (a true random state,
 *     not a random-move shuffle) and 群论还原 = a BSGS factorisation solve.
 *
 * Everything is computed in-browser by the vendored puzzle-geometry, lazy-loaded so its
 * ~3.4k-line compiler never lands in the default bundle.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Sigma, Shuffle, Wand2 } from 'lucide-react';
import type { PgGroupFacts } from './engine/pgBackbone';
import type { PgEngineBinding } from './engine/pgBinding';
import { nxnHasPgKernel } from './engine/nxn/nxnPgBridge';
import './group-theory-panel.css';

/** Minimal structural view of an engine cube (PyraCube …, or the NxN Cube) the panel
 *  drives. The fixed-puzzle engines expose `history.moves: string[]`; the NxN engine
 *  instead exposes `history.exp: string` (its `moves` is a count) — both carry `init`. */
export interface SimEngineCube {
  history: { init: string; moves?: string[]; exp?: string };
  callbacks: (() => void)[];
  complete: boolean;
  twister: { setup(s: string): void; push(s: string): void };
}

/** Full move string from either history shape (fixed puzzles: moves[]; NxN: exp). */
function historyString(c: SimEngineCube): string {
  const init = c.history.init ?? '';
  const body = Array.isArray(c.history.moves) ? c.history.moves.join(' ') : (c.history.exp ?? '');
  return `${init} ${body}`.trim();
}
/** Minimal view of the sim World the panel reads (to confirm the active cube is the
 *  expected engine puzzle before driving it). */
export interface SimWorldView {
  puzzleKind: string | number;
  cube: SimEngineCube;
}

/** Fixed engine puzzle kinds wired to a PG kernel (kept in sync with pgBindings). NxN
 *  cubes (numeric puzzle string) are detected via nxnHasPgKernel. */
const PG_BOUND: Record<string, true> = { pyraminx: true, dino: true, skewb: true, heli: true, megaminx: true, fto: true };
const isBound = (puzzle: string): boolean => !!PG_BOUND[puzzle] || nxnHasPgKernel(parseInt(puzzle, 10));

const SUBS = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number): string => String(n).split('').map((d) => SUBS[+d]).join('');
const grp = (b: bigint): string => b.toLocaleString('en-US');
/** Zₒ≀Sₙ for an oriented orbit, Sₙ for an unoriented one. */
const wreath = (pieces: number, oriMod: number): string =>
  (oriMod > 1 ? `ℤ${sub(oriMod)}≀S${sub(pieces)}` : `S${sub(pieces)}`);

interface LiveState { solved: boolean; order: number; solveLen: number; }

export default function GroupTheoryPanel({
  puzzle, getWorld,
}: { puzzle: string; getWorld: () => SimWorldView | null }) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string): string => (isZh ? zh : en);

  const bound = isBound(puzzle);
  const bindingRef = useRef<PgEngineBinding<unknown> | null>(null);
  const [facts, setFacts] = useState<PgGroupFacts | null>(null);
  const [live, setLive] = useState<LiveState | null>(null);
  // Whether the BSGS solve/scramble are available (false for groups too large to
  // factor in-browser, e.g. the helicopter cube — facts + live state still show).
  const [solvable, setSolvable] = useState(true);

  // The active engine cube, but only once the World has actually switched to this
  // puzzle (avoids grabbing the default NxN cube — whose history shape differs — in
  // the brief window before setPuzzle runs).
  const activeCube = useCallback((): SimEngineCube | null => {
    const w = getWorld();
    if (!w || String(w.puzzleKind) !== puzzle) return null;
    const c = w.cube;
    const h = c?.history;
    // Accept either history shape: fixed puzzles (moves[]) or NxN (exp string) — both init.
    return h && typeof h.init === 'string' && (Array.isArray(h.moves) || typeof h.exp === 'string') ? c : null;
  }, [getWorld, puzzle]);

  useEffect(() => {
    if (!bound) return;
    let alive = true;
    let cube: SimEngineCube | null = null;
    let cb: (() => void) | null = null;
    let raf = 0;
    setFacts(null);
    setLive(null);

    void import('./engine/pgBindings').then(({ createBinding }) => {
      if (!alive) return;
      const binding = createBinding(puzzle) as PgEngineBinding<unknown> | null;
      if (!binding) return;
      bindingRef.current = binding;
      setSolvable(binding.solvable);
      const f = binding.facts();
      if (!alive) return;
      setFacts(f);

      const refresh = () => {
        if (!cube) return;
        binding.rebuildFromString(historyString(cube));
        // The badge follows the engine's own geometry (faithful to what's on screen);
        // PG's fixed-in-space group can be a multiple of the engine's, so state==id is
        // stricter than visually-solved — use cube.complete instead.
        const complete = cube.complete;
        const ss = binding.solvable && !complete ? binding.solveString() : '';
        const solveLen = ss ? ss.trim().split(/\s+/).length : 0;
        setLive({ solved: complete, order: complete ? 1 : binding.currentOrder(), solveLen });
      };
      const attach = () => {
        if (!alive) return;
        const c = activeCube();
        if (c) {
          cube = c;
          cb = refresh;
          c.callbacks.push(cb);
          refresh();
        } else {
          raf = requestAnimationFrame(attach);
        }
      };
      attach();
    });

    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      if (cube && cb) {
        const i = cube.callbacks.indexOf(cb);
        if (i >= 0) cube.callbacks.splice(i, 1);
      }
      bindingRef.current = null;
    };
  }, [puzzle, bound, activeCube]);

  const onScramble = useCallback(() => {
    const c = activeCube();
    const b = bindingRef.current;
    if (!c || !b) return;
    const s = b.scrambleString();
    // Apply instantly as the base state: a uniform random STATE needs a long BSGS
    // word to reach, which would animate for ~30s — so jump there (like the main
    // scramble button's non-animated path) rather than play every turn.
    c.twister.setup(s);
  }, [activeCube]);

  const onSolve = useCallback(() => {
    const c = activeCube();
    const b = bindingRef.current;
    if (!c || !b) return;
    b.rebuildFromString(historyString(c));
    const s = b.solveString();
    if (s) c.twister.push(s); // animate the BSGS solution
  }, [activeCube]);

  if (!bound) return null;

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

          <div className="gt-live">
            <div className={`gt-live-state ${live?.solved ? 'is-solved' : 'is-scrambled'}`}>
              {live?.solved ? t('已还原', 'Solved') : t('打乱中', 'Scrambled')}
            </div>
            <div className="gt-live-facts">
              <span>
                {t('当前元素阶', 'element order')} <b className="gt-mono">{live ? live.order : '—'}</b>
              </span>
              {solvable && (
                <span>
                  {t('群论解', 'BSGS solution')} <b className="gt-mono">{live ? `${live.solveLen}` : '—'}</b>
                  {live ? t(' 步', ' moves') : ''}
                </span>
              )}
            </div>
          </div>

          {solvable ? (
            <>
              <div className="gt-actions">
                <button type="button" className="gt-btn" onClick={onScramble}>
                  <Shuffle size={14} aria-hidden /> {t('群论打乱', 'Random-state scramble')}
                </button>
                <button type="button" className="gt-btn" onClick={onSolve} disabled={!!live?.solved}>
                  <Wand2 size={14} aria-hidden /> {t('群论还原', 'BSGS solve')}
                </button>
              </div>
              <div className="gt-actions-note">
                {t('打乱 = BSGS 均匀采样的随机态;还原 = 强生成集分解',
                  'scramble = uniform random state via BSGS · solve = strong-generating-set factorisation')}
              </div>
            </>
          ) : (
            <div className="gt-actions-note">
              {t('群过大,BSGS 构造性求解不可用;仅展示群结构 + 实时状态',
                'group too large for in-browser BSGS factorisation — structure + live state only')}
            </div>
          )}

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

            <div className="gt-row gt-row-block">
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
            {t('Schreier-Sims 预计算(离线烘焙)', 'precomputed via Schreier-Sims (baked offline)')}
          </footer>
        </>
      )}
    </section>
  );
}
