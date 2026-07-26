'use client';

/**
 * /scramble/solver?event=222 —— 二阶求解器。
 *
 * 打乱框那条路子还是 PuzzleOptimalSolver(Rust WASM 全空间精确表);本文件在它上面加了
 * 三阶那套「画状态求解」:
 *   ?view=cube  可转的立体画板(默认,/sim 引擎 order=2)
 *   ?view=net   平面展开图画板(同一份 facelet,24 格)
 *   ?view=scramble 打乱框(PuzzleOptimalSolver 自己那套,含批量)
 *
 * 与三阶的差别:二阶最优解**纯 TS 本地即时算**(lib/pocket-facelet:整体旋转归一化 +
 * pocket-scramble 的 3,674,160 态精确表),所以不用「求解法」按钮 —— 涂满即出解;
 * 只留一个「求打乱」把状态写进打乱框(URL 也就带上了,可分享 / 交给批量求解)。
 * 二阶没有中心块,整体朝向自由:给出的解是**照着所画那个姿势**的(可能含 D/L/B),
 * 反推的打乱则精确复现所画状态(见 derivePocketScramble 的旋转前缀)。
 */

import { useEffect, useMemo, useState } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { tr } from '@/i18n/tr';
import { useT } from '@/hooks/useT';
import { ListSelect } from '@/components/ListSelect';
import {
  EMPTY_POCKET_FACELET, derivePocketScramble, pocketFaceletFromMoves, solvePocketFacelet,
} from '@/lib/pocket-facelet';
import { PuzzleOptimalSolver } from '../_components/PuzzleOptimalSolver';
import { SPEC_BY_EVENT } from './_puzzle-specs';
import InteractiveCubeNet from './_InteractiveCubeNet';
import Interactive3DCube, { useIdlePreloadPaintEngine } from './_Interactive3DCube';
import { CUBE2_PAINT } from './_paint-spec-222';
import type { PaintColor } from './_paint-shared';

type View = 'net' | 'cube' | 'scramble';

export default function Cube2Solver() {
  const t = useT();
  const spec = SPEC_BY_EVENT['222'];

  // 打乱串与 PuzzleOptimalSolver 共用同一个 nuqs key(同 key 的 hook 之间自动同步)。
  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  // 带 ?scramble= 进来的旧链接(SolveTabs / /scramble 中心 / 分享)不该被画板挡住 → 那种情况
  // 默认落在打乱视图。只看首屏那一次,免得用户之后填了打乱又被弹走。
  const [scrambleFirst] = useState(() => scramble.trim().length > 0);
  const [view, setView] = useQueryState(
    'view',
    parseAsStringEnum<View>(['net', 'cube', 'scramble']).withDefault(scrambleFirst ? 'scramble' : 'cube'),
  );

  // 立体是默认视图,组件自己会加载引擎;从别的视图进来时空闲预热,切过去不等。
  useIdlePreloadPaintEngine(view !== 'cube');

  const [facelet, setFacelet] = useState(EMPTY_POCKET_FACELET);
  const [color, setColor] = useState<PaintColor>('U');
  // 与三阶画板同一口径:上限 360px(2×2 网格 9 单位宽 → 每格 40px),窄屏收到屏宽内。
  const [canvasSize, setCanvasSize] = useState(360);
  useEffect(() => {
    const upd = () => setCanvasSize(Math.min(360, Math.max(180, window.innerWidth - 64)));
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);

  // 打乱框第一行 → 画板:施加到还原态就是要解的那个状态,所以画板顺便当打乱的预览,
  // 三个视图看的是同一个方块。求打乱写回的那条打乱精确复现所画状态(derivePocketScramble
  // 带整体旋转前缀),所以这条回流不会让画板跳一下。半截 / 非法的打乱保持画板不动。
  useEffect(() => {
    const first = scramble.split('\n').map((s) => s.trim()).find(Boolean);
    if (!first) return;
    try {
      setFacelet(pocketFaceletFromMoves(first));
    } catch { /* 记号还没打完 / 不认识 —— 保持当前画板 */ }
  }, [scramble]);

  // 涂满且合法 → 本地即时最优解(建表毫秒级,查表更快,故不做防抖)。
  const result = useMemo(() => {
    if (facelet.includes('X')) return null;
    try {
      return solvePocketFacelet(facelet);
    } catch {
      return null; // 非法状态由画板自己报(PaintActions 的 validErr)
    }
  }, [facelet]);

  const [wrote, setWrote] = useState<string | null>(null);
  useEffect(() => { setWrote(null); }, [facelet]);

  const deriveScramble = (fc: string) => {
    let scr: string;
    try {
      scr = derivePocketScramble(fc);
    } catch {
      return; // 非法状态,画板已经在报错
    }
    if (!scr) { setWrote(''); return; } // 已还原:没有打乱可写
    void setScramble(scr);
    setWrote(scr);
  };

  const painterProps = {
    spec: CUBE2_PAINT,
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

  const painting = view !== 'scramble';

  return (
    <PuzzleOptimalSolver
      spec={spec}
      hidePanel={painting}
      topSlot={(
        <section className="pocket-paint">
          <style>{INLINE_CSS}</style>
          <div className="pocket-paint-view">
            <ListSelect
              clearable={false}
              value={view}
              onChange={(v) => void setView(v as View)}
              allLabel=""
              items={[
                { value: 'cube', label: t('立体', '3D') },
                { value: 'net', label: t('平面', '2D') },
                { value: 'scramble', label: t('打乱', 'Scramble') },
              ]}
            />
          </div>

          {painting && (
            <>
              <div className="pocket-paint-canvas">
                {view === 'cube'
                  ? <Interactive3DCube {...painterProps} />
                  : <InteractiveCubeNet {...painterProps} />}
              </div>

              <div className="pocket-paint-out" aria-live="polite">
                {facelet.includes('X') ? (
                  <p className="pocket-paint-hint">
                    {t('把 24 格都涂上颜色,立刻给出最优解(照着所画的姿势,可含 D / L / B)。',
                      'Fill all 24 stickers to get the optimal solution instantly (in the orientation you painted, so D / L / B may appear).')}
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
                      <span className="pocket-paint-badge">{t('最优解', 'optimal')}</span>
                    </div>
                    <p className="pos-result-sol">{result.solution}</p>
                  </>
                )}
                {wrote !== null && (
                  <p className="pocket-paint-wrote">
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
.pocket-paint {
  display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
  margin-bottom: 1rem;
}
.pocket-paint-view { width: fit-content; max-width: 100%; }
/* 视图切换器:下拉贴合内容(默认 min-width 是给带搜索的长列表的,这里 3 个短项不需要) */
.pocket-paint-view .list-select-popup { min-width: 0; width: max-content; right: auto; }
.pocket-paint-canvas { display: flex; justify-content: center; width: 100%; }
.pocket-paint-out {
  display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
  text-align: center;
}
.pocket-paint-hint {
  font-size: 0.82rem; color: var(--text-muted); max-width: 30rem; line-height: 1.5;
}
.pocket-paint-badge {
  font-size: 0.72rem; color: var(--text-muted);
  border: 1px solid var(--border); border-radius: 4px; padding: 0.05rem 0.3rem;
}
.pocket-paint-wrote {
  font-size: 0.8rem; color: var(--text-muted);
}
.pocket-paint-wrote code {
  font-family: var(--font-mono); color: var(--text);
}
`;
