'use client';

/**
 * /scramble/solver?event=pyram —— 金字塔求解器。
 *
 * 结构与 `_SkewbSolver` / `_Cube2Solver` 同构:打乱框走 PuzzleOptimalSolver(Rust WASM 精确表),
 * 本文件在它上面加三个视图:
 *   ?view=net      2D 展开图画板(默认):点格涂色,涂满 36 格立刻出最优解
 *   ?view=scramble 打乱框(含批量)
 *   ?view=recon    复盘:输入一段解法,取逆同步到画板
 *
 * 解**纯 TS 本地即时算**(lib/pyraminx-solver:核心 933,120 态精确表 + 尖块真最优 DP),含尖上限
 * 15 步。金字塔没有固定中心参照(4 个轴块只自转),所以 36 格全可涂、取色只能点色板。
 */

import { useEffect, useMemo, useState } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { ListSelect } from '@/components/ListSelect';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import {
  EMPTY_PYRA_FACELET, derivePyraScramble, invertPyraAlg, prewarmPyraGraph,
  pyraFaceletFromMoves, solvePyraFacelet, validatePyraFacelet,
} from '@/lib/pyraminx-solver';
import { PuzzleOptimalSolver } from '../_components/PuzzleOptimalSolver';
import { SPEC_BY_EVENT } from './_puzzle-specs';
import InteractivePyraNet from './_InteractivePyraNet';
import { PYRA_PAINT } from './_paint-spec-pyra';
import type { PaintColor } from './_paint-shared';

type View = 'net' | 'scramble' | 'recon';

export default function PyraSolver() {
  const t = useT();
  const spec = SPEC_BY_EVENT.pyram;

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const [scrambleFirst] = useState(() => scramble.trim().length > 0);
  const [view, setView] = useQueryState(
    'view',
    parseAsStringEnum<View>(['net', 'scramble', 'recon']).withDefault(scrambleFirst ? 'scramble' : 'net'),
  );

  const [facelet, setFacelet] = useState(EMPTY_PYRA_FACELET);
  const [color, setColor] = useState<PaintColor>('F');
  const [reconInput, setReconInput] = useState('');
  const [wrote, setWrote] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState(340);

  useEffect(() => {
    const upd = () => setCanvasSize(Math.min(360, Math.max(200, window.innerWidth - 64)));
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);

  // 核心距离表建一次 ~0.2s,趁空闲先建好。
  useEffect(() => {
    const idle = (cb: () => void) => (typeof requestIdleCallback === 'function'
      ? requestIdleCallback(cb, { timeout: 3000 })
      : window.setTimeout(cb, 300));
    const id = idle(() => prewarmPyraGraph());
    return () => {
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(id as number);
      else clearTimeout(id as number);
    };
  }, []);

  // 打乱框第一行 → 画板(tnoodle 解析器,与打乱预览图逐格一致)。
  useEffect(() => {
    const first = scramble.split('\n').map((s) => s.trim()).find(Boolean);
    if (!first) return;
    try {
      setFacelet(pyraFaceletFromMoves(first));
    } catch { /* 记号还没打完 */ }
  }, [scramble]);

  useEffect(() => { setWrote(null); }, [facelet]);

  const recon = useMemo(() => {
    const raw = reconInput.trim();
    if (!raw) return { facelet: null as string | null, moves: 0 };
    const inv = invertPyraAlg(raw);
    return { facelet: pyraFaceletFromMoves(inv), moves: inv ? inv.split(' ').length : 0 };
  }, [reconInput]);

  useEffect(() => {
    if (view === 'recon' && recon.facelet) setFacelet(recon.facelet);
  }, [view, recon.facelet]);

  const result = useMemo(() => {
    if (facelet.includes('X')) return null;
    if (validatePyraFacelet(facelet)) return null;
    return solvePyraFacelet(facelet);
  }, [facelet]);

  const deriveScramble = (fc: string) => {
    if (validatePyraFacelet(fc)) return;
    const scr = derivePyraScramble(fc);
    if (!scr) { setWrote(''); return; }
    void setScramble(scr);
    setWrote(scr);
  };

  const painting = view !== 'scramble';

  return (
    <PuzzleOptimalSolver
      spec={spec}
      hidePanel={painting}
      topSlot={(
        <section className="pyra-paint">
          <style>{INLINE_CSS}</style>
          <div className="pyra-paint-view">
            <ListSelect
              clearable={false}
              value={view}
              onChange={(v) => void setView(v as View)}
              allLabel=""
              items={[
                { value: 'net', label: t('平面', '2D') },
                { value: 'scramble', label: t('打乱', 'Scramble') },
                { value: 'recon', label: t('复盘', 'Reconstruction') },
              ]}
            />
          </div>

          {painting && (
            <>
              {view === 'recon' && (
                <div className="pyra-paint-recon">
                  <textarea
                    className="pyra-paint-recon-input"
                    value={reconInput}
                    onChange={(e) => setReconInput(e.target.value)}
                    rows={2}
                    spellCheck={false}
                    placeholder={t("输入一段复盘(解法,即打乱的逆),如 U L' R b",
                      "Type a reconstruction (the solution — inverse of the scramble), e.g. U L' R b")}
                  />
                  {recon.moves > 0 && (
                    <div className="pyra-paint-recon-ok">
                      {t(`${recon.moves} 步复盘 → 打乱取逆,已同步到画板`,
                        `${recon.moves}-move reconstruction → the scramble is its inverse, synced to the board`)}
                    </div>
                  )}
                </div>
              )}

              <div className="pyra-paint-canvas">
                <InteractivePyraNet
                  spec={PYRA_PAINT}
                  facelet={facelet}
                  onChange={setFacelet}
                  activeColor={color}
                  onActiveColorChange={setColor}
                  pixelSize={canvasSize}
                  onSolve={deriveScramble}
                  solveLabel={{ zh: '求打乱', en: 'Scramble' }}
                  solveTitle={{
                    zh: '反推一条到达所画状态的打乱,填进打乱框(状态逐格一致)',
                    en: 'Derive a scramble that reaches the painted state and put it in the scramble box (sticker-for-sticker identical)',
                  }}
                  plainSolve
                />
              </div>

              <div className="pyra-paint-out" aria-live="polite">
                {facelet.includes('X') ? (
                  <p className="pyra-paint-hint">
                    {t('把 36 格都涂上颜色,立刻给出最优解(含 4 个尖,最多 15 步)。',
                      'Fill all 36 stickers to get the optimal solution instantly (tips included, at most 15 moves).')}
                  </p>
                ) : result === null ? null : result.length === 0 ? (
                  <p className="pos-result-solved">{tr({ zh: '已是还原态', en: 'Already solved' })}</p>
                ) : (
                  <>
                    <div className="pos-result-len">
                      <span className="pos-result-num">{result.length}</span>
                      <span className="pos-result-metric">
                        {tr({ zh: '步', en: result.length === 1 ? 'move' : 'moves' })} ({spec.metric})
                      </span>
                      <span className="pyra-paint-badge">{t('最优解', 'optimal')}</span>
                    </div>
                    <p className="pos-result-sol">{result.solution}</p>
                    {result.tipLength > 0 && (
                      <p className="pyra-paint-split">
                        {t(`核心 ${result.coreLength} 步 + 尖 ${result.tipLength} 步`,
                          `${result.coreLength} core + ${result.tipLength} tip`)}
                      </p>
                    )}
                  </>
                )}
                {wrote !== null && (
                  <p className="pyra-paint-wrote">
                    {wrote
                      ? <>{t('已写入打乱框 ', 'Written to the scramble box: ')}<code>{wrote}</code></>
                      : t('已是还原态,没有打乱可写。', 'Already solved — no scramble to write.')}
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      )}
    />
  );
}

const INLINE_CSS = `
.pyra-paint {
  display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
  margin-bottom: 1rem;
}
.pyra-paint-view { width: fit-content; max-width: 100%; }
.pyra-paint-view .list-select-popup { min-width: 0; width: max-content; right: auto; }
.pyra-paint-canvas { display: flex; justify-content: center; width: 100%; }
.pyra-paint-recon {
  display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
  width: 100%; max-width: 30rem;
}
.pyra-paint-recon-input {
  width: 100%; font-family: var(--font-mono); font-size: 0.85rem;
  background: var(--card); color: var(--foreground);
  border: 1px solid var(--input); border-radius: 5px; padding: 0.45rem 0.6rem;
  resize: vertical;
}
.pyra-paint-recon-ok { font-size: 0.8rem; color: var(--muted-foreground); }
.pyra-paint-out {
  display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
  text-align: center;
}
.pyra-paint-hint {
  font-size: 0.82rem; color: var(--muted-foreground); max-width: 30rem; line-height: 1.5;
}
.pyra-paint-badge {
  font-size: 0.72rem; color: var(--muted-foreground);
  border: 1px solid var(--border-default); border-radius: 4px; padding: 0.05rem 0.3rem;
}
.pyra-paint-split { font-size: 0.8rem; color: var(--muted-foreground); }
.pyra-paint-wrote { font-size: 0.8rem; color: var(--muted-foreground); }
.pyra-paint-wrote code { font-family: var(--font-mono); color: var(--foreground); }
`;
