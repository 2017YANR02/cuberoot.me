'use client';

/**
 * /scramble/solver?event=heli — Helicopter Cube(直升机)在线求解器。
 *
 * 纯 TS,无 worker、无下载表:heli 可达状态 ≈ 1.18×10¹⁹(= 8!·3⁷·(6!)⁴/2,Schreier-Sims 验证),
 * 远超整图 BFS / 打包表的规模 —— 故求解核心是从零对易子约简:先用奇偶前缀把角置换 + 4 个棱翼轨道
 * 的置换奇偶清零,再用角 3-循环 / 角扭转 / 按轨道分组的棱翼缓冲 3-循环逐件归位。这给出**有效 + 有界**
 * 的解(非最优),硬上界 HELI_MAX_LENGTH。打乱来源复用 /scramble/gen 的 cstimer 桥
 * (cstimerScramble('heli')),记号与 cstimer 完全一致(12 个棱名 UF UR UB UL FR BR BL FL DF DR DB DL,
 * 每个 = 一次 180° 棱转),保证它生成的打乱被正确求解。
 */
import { useEffect, useMemo, useState } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { Dices, LoaderCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { SearchInput } from '@/components/SearchInput';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveHeli, HELI_MAX_LENGTH, HELI_MOVE_NAMES } from '@/lib/heli-solver';
import SolveTabs from '../_components/SolveTabs';
import { BatchSolvePanel, SolveModeToggle, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

const HELI_NOTE = HELI_MOVE_NAMES.join(' ');
const HELI_TOKEN_SET = new Set(HELI_MOVE_NAMES);

export default function HeliSolverPage() {
  useDocumentTitle('直升机魔方求解器', 'Helicopter Cube Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const [mode, setMode] = useQueryState(
    'mode',
    parseAsStringEnum(['single', 'batch'] as const).withDefault('single'),
  );
  const [generating, setGenerating] = useState(false);

  const trimmed = scramble.trim();

  const result = useMemo(() => {
    if (!trimmed) return null;
    try {
      const out = solveHeli(trimmed);
      return { ...out, error: null as string | null };
    } catch (e) {
      return { solution: '', length: 0, error: String((e as Error)?.message ?? e) };
    }
  }, [trimmed]);

  useEffect(() => {
    const id = window.setTimeout(() => { try { solveHeli(''); } catch { /* noop */ } }, 200);
    return () => window.clearTimeout(id);
  }, []);

  const randomScramble = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const s = await cstimerScramble('heli');
      if (s) void setScramble(s.trim());
    } finally {
      setGenerating(false);
    }
  };

  const batchSpec: BatchSpec = useMemo(() => ({
    event: 'heli',
    metricLabel: 'moves',
    placeholder: {
      zh: '每行一条打乱,如 UF DR BL UR FL',
      en: 'one scramble per line, e.g. UF DR BL UR FL',
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !HELI_TOKEN_SET.has(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = solveHeli(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => cstimerScramble('heli'),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="heli" mode="solve" />
      <SolveModeToggle value={mode} onChange={(v) => void setMode(v)} />

      {mode === 'batch' ? (
        <BatchSolvePanel spec={batchSpec} />
      ) : (
        <>
          <p className="pos-lead">
            {tr({
              zh: `直升机魔方在线求解:任意打乱的有效解(从零对易子约简,有界,非最优;硬上界 ${HELI_MAX_LENGTH} 步)。记号 ${HELI_NOTE},与 cstimer 一致。`,
              en: `Helicopter Cube online solver: a valid solution for any scramble (from-scratch commutator reduction; bounded, not optimal; hard cap ${HELI_MAX_LENGTH} moves). Notation ${HELI_NOTE}, matching cstimer.`,
            })}
          </p>

          <div className="pos-input-row">
            <SearchInput
              className="pos-input-wrap"
              inputClassName="pos-input"
              value={scramble}
              onChange={(v) => void setScramble(v)}
              placeholder={tr({ zh: '输入打乱,如 UF DR BL UR FL', en: 'Enter a scramble, e.g. UF DR BL UR FL' })}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
            />
            <button type="button" className="pos-random-btn" onClick={() => void randomScramble()} disabled={generating}>
              {generating ? <LoaderCircle size={16} className="pos-spin" aria-hidden /> : <Dices size={16} aria-hidden />}
              {tr({ zh: '随机打乱', en: 'Random' })}
            </button>
          </div>

          {trimmed && result && (
            <div className="pos-result" aria-live="polite">
              {!result.error && (
                <div className="ivy-preview">
                  <ScramblePreview2D event="heli" scramble={trimmed} size={96} />
                </div>
              )}
              {result.error ? (
                <p className="pos-error">
                  {tr({ zh: `打乱记号无法识别(应为 ${HELI_NOTE})`, en: `Unrecognized notation (expected ${HELI_NOTE})` })}: <code>{result.error}</code>
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
                    <span className="ivy-metric-god">{tr({ zh: `上界 ${HELI_MAX_LENGTH}`, en: `cap ${HELI_MAX_LENGTH}` })}</span>
                  </div>
                  <div className="ivy-solbox">{result.solution}</div>
                </>
              )}
            </div>
          )}

          <div className="ivy-caveat">
            <strong>{tr({ zh: '关于「有界」', en: 'About "bounded"' })}</strong>{' '}
            {tr({
              zh: `直升机魔方有约 1.18×10¹⁹ 个状态(= 8!·3⁷·(6!)⁴/2,Schreier-Sims 验证),太大无法整图枚举,所以这里不是最优解,而是一条从零对易子约简给出的有效解:8 个角是单一轨道(可证 3-循环归位 + 角扭转),24 个棱翼分成 4 个各 6 件的轨道(棱翼只在本轨道内移动);先用一段奇偶前缀把角置换与 4 个轨道的置换奇偶清零,再用角 3-循环 / 角扭转 / 按轨道缓冲的棱翼 3-循环逐件归位。任何打乱都能在 ${HELI_MAX_LENGTH} 步内还原(实测约 210 步)。移动语义与打乱镜像 cstimer,几何与校验用 cstimer 的 poly3dlib;计步按 cstimer(一个 token = 1 步)。`,
              en: `The Helicopter Cube has ~1.18×10¹⁹ states (= 8!·3⁷·(6!)⁴/2, Schreier-Sims verified), far too many to enumerate, so this is not an optimal solution but a valid one from a from-scratch commutator reduction: the 8 corners form a single orbit (3-cycles + twists), while the 24 wings split into 4 orbits of 6 (a wing only moves within its orbit). A parity prefix first clears the corner-permutation parity and the 4 orbit parities, then corner 3-cycles, corner twists, and per-orbit buffer wing 3-cycles fix each piece in turn. Any scramble solves within ${HELI_MAX_LENGTH} moves (~210 in practice). Move semantics and scrambler mirror cstimer; geometry and verification use cstimer's poly3dlib; counted in cstimer's metric (one token = one move).`,
            })}
          </div>
        </>
      )}
    </div>
  );
}
