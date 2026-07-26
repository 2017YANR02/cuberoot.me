'use client';

/**
 * /scramble/solver?event=skewb —— 斜转求解器。
 *
 * 打乱框那条路子还是 PuzzleOptimalSolver(Rust WASM 全空间精确表);本文件在它上面加了三阶 / 二阶
 * 那套「画状态求解」:
 *   ?view=cube     可转的立体画板(默认,/sim 的斜转引擎;点贴纸涂色、拖动转视角)
 *   ?view=net      2D 展开图画板(同一份 facelet,30 格)
 *   ?view=scramble 打乱框(PuzzleOptimalSolver 自己那套,含批量)
 *   ?view=recon    复盘:输入一段解法,取逆同步到画板
 *
 * 与二阶画板同一口径:解**纯 TS 本地即时算**(lib/skewb-solver 的全空间 3,149,280 态精确距离表),
 * 所以不用「求解法」按钮 —— 涂满即出解;只留一个「求打乱」把状态写进打乱框(URL 也就带上了,
 * 可分享 / 交给批量求解)。斜转的中心块会动、没有固定参照,所以 30 格全可涂,取色只能点色板。
 */

import { useEffect, useMemo, useState } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { ListSelect } from '@/components/ListSelect';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import {
  EMPTY_SKEWB_FACELET, deriveSkewbScramble, invertSkewbAlg, prewarmSkewbGraph,
  skewbFaceletFromMoves, solveSkewbFacelet, validateSkewbFacelet,
} from '@/lib/skewb-solver';
import { PuzzleOptimalSolver } from '../_components/PuzzleOptimalSolver';
import { SPEC_BY_EVENT } from './_puzzle-specs';
import InteractiveSkewbNet from './_InteractiveSkewbNet';
import Interactive3DPuzzle from './_Interactive3DPuzzle';
import { SKEWB_PAINT } from './_paint-spec-skewb';
import type { PaintColor } from './_paint-shared';

type View = 'cube' | 'net' | 'scramble' | 'recon';

export default function SkewbSolver() {
  const t = useT();
  const spec = SPEC_BY_EVENT.skewb;

  // 打乱串与 PuzzleOptimalSolver 共用同一个 nuqs key(同 key 的 hook 之间自动同步)。
  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  // 带 ?scramble= 进来的旧链接(SolveTabs / /scramble 中心 / 分享)不该被画板挡住。
  const [scrambleFirst] = useState(() => scramble.trim().length > 0);
  const [view, setView] = useQueryState(
    'view',
    parseAsStringEnum<View>(['cube', 'net', 'scramble', 'recon']).withDefault(scrambleFirst ? 'scramble' : 'cube'),
  );

  const [facelet, setFacelet] = useState(EMPTY_SKEWB_FACELET);
  const [color, setColor] = useState<PaintColor>('U');
  const [reconInput, setReconInput] = useState('');
  const [wrote, setWrote] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState(340);

  useEffect(() => {
    const upd = () => setCanvasSize(Math.min(360, Math.max(200, window.innerWidth - 64)));
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);

  // 距离表建一次 ~0.5s。趁空闲先建好 —— 用户涂完 30 格通常要好几秒,到时候查表是瞬时的,
  // 不会在最后一格上卡一下。
  useEffect(() => {
    const idle = (cb: () => void) => (typeof requestIdleCallback === 'function'
      ? requestIdleCallback(cb, { timeout: 3000 })
      : window.setTimeout(cb, 300));
    const id = idle(() => prewarmSkewbGraph());
    return () => {
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(id as number);
      else clearTimeout(id as number);
    };
  }, []);

  // 打乱框第一行 → 画板:施加到还原态就是要解的那个状态,三个视图看的是同一个魔方。
  // 语义走 tnoodle 自己的解析器,所以画板与打乱预览图逐格一致。半截 / 非法的打乱保持画板不动。
  useEffect(() => {
    const first = scramble.split('\n').map((s) => s.trim()).find(Boolean);
    if (!first) return;
    try {
      setFacelet(skewbFaceletFromMoves(first));
    } catch { /* 记号还没打完 —— 保持当前画板 */ }
  }, [scramble]);

  useEffect(() => { setWrote(null); }, [facelet]);

  // 复盘:输入的是解法,状态 = 对还原态施加它的逆。
  const recon = useMemo(() => {
    const raw = reconInput.trim();
    if (!raw) return { facelet: null as string | null, moves: 0 };
    const inv = invertSkewbAlg(raw);
    const tokens = inv ? inv.split(' ').length : 0;
    return { facelet: skewbFaceletFromMoves(inv), moves: tokens };
  }, [reconInput]);

  useEffect(() => {
    if (view === 'recon' && recon.facelet) setFacelet(recon.facelet);
  }, [view, recon.facelet]);

  // 涂满且合法 → 本地即时最优解(查表,故不做防抖)。
  const result = useMemo(() => {
    if (facelet.includes('X')) return null;
    if (validateSkewbFacelet(facelet)) return null;   // 非法状态由画板自己报
    return solveSkewbFacelet(facelet);
  }, [facelet]);

  const deriveScramble = (fc: string) => {
    if (validateSkewbFacelet(fc)) return;
    const scr = deriveSkewbScramble(fc);
    if (!scr) { setWrote(''); return; }   // 已还原:没有打乱可写
    void setScramble(scr);
    setWrote(scr);
  };

  const painting = view !== 'scramble';

  const painterProps = {
    spec: SKEWB_PAINT,
    facelet,
    onChange: setFacelet,
    activeColor: color,
    onActiveColorChange: setColor,
    pixelSize: canvasSize,
    onSolve: deriveScramble,
    solveLabel: { zh: '求打乱', en: 'Scramble' },
    solveTitle: {
      zh: '反推一条到达所画状态的打乱,填进打乱框(状态逐格一致)',
      en: 'Derive a scramble that reaches the painted state and put it in the scramble box (sticker-for-sticker identical)',
    },
    plainSolve: true,
  };

  const painter = view === 'cube'
    ? <Interactive3DPuzzle puzzle="skewb" {...painterProps} />
    : <InteractiveSkewbNet {...painterProps} />;

  return (
    <PuzzleOptimalSolver
      spec={spec}
      hidePanel={painting}
      topSlot={(
        <section className="skewb-paint">
          <style>{INLINE_CSS}</style>
          <div className="skewb-paint-view">
            <ListSelect
              clearable={false}
              value={view}
              onChange={(v) => void setView(v as View)}
              allLabel=""
              items={[
                { value: 'cube', label: t('立体', '3D') },
                { value: 'net', label: t('平面', '2D') },
                { value: 'scramble', label: t('打乱', 'Scramble') },
                { value: 'recon', label: t('复盘', 'Reconstruction') },
              ]}
            />
          </div>

          {painting && (
            <>
              {view === 'recon' && (
                <div className="skewb-paint-recon">
                  <textarea
                    className="skewb-paint-recon-input"
                    value={reconInput}
                    onChange={(e) => setReconInput(e.target.value)}
                    rows={2}
                    spellCheck={false}
                    placeholder={t("输入一段复盘(解法,即打乱的逆),如 R U' L B'",
                      "Type a reconstruction (the solution — inverse of the scramble), e.g. R U' L B'")}
                  />
                  {recon.moves > 0 && (
                    <div className="skewb-paint-recon-ok">
                      {t(`${recon.moves} 步复盘 → 打乱取逆,已同步到画板`,
                        `${recon.moves}-move reconstruction → the scramble is its inverse, synced to the board`)}
                    </div>
                  )}
                </div>
              )}

              <div className="skewb-paint-canvas">{painter}</div>

              <div className="skewb-paint-out" aria-live="polite">
                {facelet.includes('X') ? (
                  <p className="skewb-paint-hint">
                    {t('把 30 格都涂上颜色,立刻给出最优解(每 120° 转一步,最多 11 步)。',
                      "Fill all 30 stickers to get the optimal solution instantly (one move per 120° turn, at most 11).")}
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
                      <span className="skewb-paint-badge">{t('最优解', 'optimal')}</span>
                    </div>
                    <p className="pos-result-sol">{result.solution}</p>
                  </>
                )}
                {wrote !== null && (
                  <p className="skewb-paint-wrote">
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
.skewb-paint {
  display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
  margin-bottom: 1rem;
}
.skewb-paint-view { width: fit-content; max-width: 100%; }
/* 视图切换器:下拉贴合内容(默认 min-width 是给带搜索的长列表的,这里 3 个短项不需要) */
.skewb-paint-view .list-select-popup { min-width: 0; width: max-content; right: auto; }
.skewb-paint-canvas { display: flex; justify-content: center; width: 100%; }
.skewb-paint-recon {
  display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
  width: 100%; max-width: 30rem;
}
.skewb-paint-recon-input {
  width: 100%; font-family: var(--font-mono); font-size: 0.85rem;
  background: var(--card); color: var(--foreground);
  border: 1px solid var(--input); border-radius: 5px; padding: 0.45rem 0.6rem;
  resize: vertical;
}
.skewb-paint-recon-ok { font-size: 0.8rem; color: var(--muted-foreground); }
.skewb-paint-out {
  display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
  text-align: center;
}
.skewb-paint-hint {
  font-size: 0.82rem; color: var(--muted-foreground); max-width: 30rem; line-height: 1.5;
}
.skewb-paint-badge {
  font-size: 0.72rem; color: var(--muted-foreground);
  border: 1px solid var(--border-default); border-radius: 4px; padding: 0.05rem 0.3rem;
}
.skewb-paint-wrote { font-size: 0.8rem; color: var(--muted-foreground); }
.skewb-paint-wrote code { font-family: var(--font-mono); color: var(--foreground); }
`;
