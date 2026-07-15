'use client';

/**
 * /scramble/solver?event=cm3 — Cmetrick(全尺寸,3×3 球阵)在线求解器。
 *
 * 纯 TS,无 worker、无下载表:Cmetrick 可达状态 165,112,971,264(= 24⁹/24 ≈ 1.65×10¹¹,
 * jaapsch.net),远超整图 BFS / 打包表的规模 —— 故求解核心是从零构造式约简(cm2 的 3×3 放大):
 * 先用线翻转把 9 个符号位(G/H=Z2)解掉,再用单球对易子 gadget 逐球归位。这给出**有效 + 有界**的解
 *(非最优),硬上界 CM3_MAX_LENGTH。打乱来源复用 /scramble/gen 的 cstimer 桥(cstimerScramble('cm3')),
 * 记号与 cstimer 完全一致(U< U> U2 E< E> E2 D< D> D2 R^ Rv R2 M^ Mv M2 L^ Lv L2),保证它生成的打乱被
 * 正确求解。
 */
import { useEffect, useMemo } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveCm3, CM3_MAX_LENGTH } from '@/lib/cm3-solver';
import SolveTabs from '../_components/SolveTabs';
import { SolvePanel, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

const CM3_TOKEN_RE = /^(U<|U>|U2|E<|E>|E2|D<|D>|D2|R\^|Rv|R2|M\^|Mv|M2|L\^|Lv|L2)$/;
const CM3_NOTE = 'U< U> U2 E< E> E2 D< D> D2 R^ Rv R2 M^ Mv M2 L^ Lv L2';

export default function Cm3SolverPage() {
  useDocumentTitle('Cmetrick 求解器', 'Cmetrick Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));

  const lines = useMemo(() => scramble.split('\n').map((s) => s.trim()).filter(Boolean), [scramble]);
  const lineCount = lines.length;
  const trimmed = lines[0] ?? '';

  const result = useMemo(() => {
    if (!trimmed || lineCount > 1) return null;
    try {
      const out = solveCm3(trimmed);
      return { ...out, error: null as string | null };
    } catch (e) {
      return { solution: '', length: 0, error: String((e as Error)?.message ?? e) };
    }
  }, [trimmed, lineCount]);

  useEffect(() => {
    const id = window.setTimeout(() => { try { solveCm3(''); } catch { /* noop */ } }, 200);
    return () => window.clearTimeout(id);
  }, []);

  const batchSpec: BatchSpec = useMemo(() => ({
    event: 'cm3',
    metricLabel: 'turns',
    placeholder: {
      zh: '每行一条打乱,如 U< R^ E2 M^ D<',
      en: 'one scramble per line, e.g. U< R^ E2 M^ D<',
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !CM3_TOKEN_RE.test(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = solveCm3(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => cstimerScramble('cm3'),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="cm3" mode="solve" />

      <SolvePanel
        spec={batchSpec}
        scramble={scramble}
        onScrambleChange={(v) => void setScramble(v)}
        renderSingle={() => (
          <>
            <p className="pos-lead">
              {tr({
                zh: `Cmetrick 在线求解:任意打乱的有效解(从零构造式约简,有界,非最优;硬上界 ${CM3_MAX_LENGTH} 步)。记号 ${CM3_NOTE},与 cstimer 一致。`,
                en: `Cmetrick online solver: a valid solution for any scramble (from-scratch constructive reduction; bounded, not optimal; hard cap ${CM3_MAX_LENGTH} moves). Notation ${CM3_NOTE}, matching cstimer.`,
              })}
            </p>

            {trimmed && result && (
              <div className="pos-result" aria-live="polite">
                {!result.error && (
                  <div className="ivy-preview">
                    <ScramblePreview2D event="cm3" scramble={trimmed} size={64} />
                  </div>
                )}
                {result.error ? (
                  <p className="pos-error">
                    {tr({ zh: `打乱记号无法识别(应为 ${CM3_NOTE})`, en: `Unrecognized notation (expected ${CM3_NOTE})` })}: <code>{result.error}</code>
                  </p>
                ) : result.length === 0 ? (
                  <p className="pos-result-solved">{tr({ zh: '已是还原态', en: 'Already solved' })}</p>
                ) : (
                  <>
                    <div className="ivy-metric">
                      <span className="ivy-metric-num">{result.length}</span>
                      <span className="ivy-metric-label">
                        {tr({ zh: '步 (有界, 非最优)', en: result.length === 1 ? 'move (bounded, not optimal)' : 'moves (bounded, not optimal)' })}
                      </span>
                      <span className="ivy-metric-god">{tr({ zh: `上界 ${CM3_MAX_LENGTH}`, en: `cap ${CM3_MAX_LENGTH}` })}</span>
                    </div>
                    <div className="ivy-solbox">{result.solution}</div>
                  </>
                )}
              </div>
            )}

            <div className="ivy-caveat">
              <strong>{tr({ zh: '关于「有界」', en: 'About "bounded"' })}</strong>{' '}
              {tr({
                zh: `Cmetrick 有 165,112,971,264 个状态(= 24⁹/24 ≈ 1.65×10¹¹,jaapsch.net),太大无法整图枚举,所以这里不是最优解,而是一条从零构造式约简给出的有效解:先用线翻转解 9 个球的符号位(旋转群的偶子群 H=A4,商 G/H=Z2),再用只动单个球的对易子 gadget(保持其余球不变)逐球归位。任何打乱都能在 ${CM3_MAX_LENGTH} 步内还原(实测约 33 步)。上帝之数为 15 个四分之一转(jaapsch.net),本解按 cstimer 计步(一个 token=1 步)。`,
                en: `The Cmetrick has 165,112,971,264 states (= 24⁹/24 ≈ 1.65×10¹¹, jaapsch.net), far too many to enumerate, so this is not an optimal solution but a valid one from a from-scratch constructive reduction: line-flips first solve the 9 balls' sign bits (the rotation group's even subgroup H=A4, quotient G/H=Z2), then single-ball commutator gadgets (which leave every other ball fixed) fix each ball in turn. Any scramble solves within ${CM3_MAX_LENGTH} moves (~33 in practice). God's number is 15 quarter-turns (jaapsch.net); this solution is counted in cstimer's metric (one token = one move).`,
              })}
            </div>
          </>
        )}
      />
    </div>
  );
}
