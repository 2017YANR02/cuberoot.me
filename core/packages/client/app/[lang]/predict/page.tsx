'use client';

/**
 * /predict —— 预判训练(Lookahead Challenge)。
 *
 * 复刻 Dan Boharon 的 Rubik's Cube Lookahead Challenge(见 /about 致谢):
 * 一个几乎全灰的魔方上只亮着目标块,给你一串招式,你在脑子里做完,直接点出那枚
 * 贴纸最终落在哪一格。点对了那格就把颜色贴上去(看着它"落位"),点错弹红叉。
 *
 * 本站版本的差异:
 *   - 配色走站内单一源(白上绿前红右),另给 24 个拿方朝向可切 —— 与 /timer 的
 *     「预打乱朝向」共用 lib/cube-orientation 那张表;
 *   - 视角可自由旋转到背面(原站锁死正面),否则落在背面的答案点不到;
 *   - 六面浮 U/D/L/R/F/B 字母作参照,而不是把字母印在中心贴纸上。
 *
 * 出题与判定全在 _lib/challenge.ts(纯函数,tests/predict_challenge.test.ts 锁),
 * 本文件只管交互与呈现。
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQueryState, parseAsStringEnum, parseAsInteger } from 'nuqs';
import { RefreshCw, Check, X, Eye, ArrowRight, ExternalLink } from 'lucide-react';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import LiquidGlassChips from '@/components/LiquidGlassChips';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { CUBE_FILL, CUBE_ON_FILL, type CubeFace } from '@/lib/cube-colors';
import { CUBE_ORIENTATIONS, orientedFaceColors } from '@/lib/cube-orientation';
import {
  generateChallenge, FACE_LETTERS, faceletFace,
  MOVE_COUNT_MIN, MOVE_COUNT_MAX, CROSS_EDGES_MIN, CROSS_EDGES_MAX,
  type PredictChallenge, type PredictMode, type PieceKind, type ScrambleSource,
} from './_lib/challenge';
import './predict.css';

const PredictBoard = dynamic(() => import('./_components/PredictBoard'), {
  ssr: false,
  loading: () => <div className="predict-board" aria-hidden="true" />,
});

const MODES: PredictMode[] = ['normal', 'cross', 'twoLayers', 'f2l'];
const MODE_LABELS: Record<PredictMode, { zh: string; en: string }> = {
  normal: { zh: '常规', en: 'Normal' },
  cross: { zh: '十字', en: 'Cross' },
  twoLayers: { zh: '前两层', en: 'Two layers' },
  f2l: { zh: 'F2L 对', en: 'F2L pair' },
};

const KINDS: PieceKind[] = ['edge', 'corner', 'pair'];
const KIND_LABELS: Record<PieceKind, { zh: string; en: string }> = {
  edge: { zh: '棱块', en: 'Edge' },
  corner: { zh: '角块', en: 'Corner' },
  pair: { zh: '一对', en: 'Pair' },
};

const SOURCES: ScrambleSource[] = ['random', 'f2lAlg'];
const SOURCE_LABELS: Record<ScrambleSource, { zh: string; en: string }> = {
  random: { zh: '随机招式', en: 'Random moves' },
  f2lAlg: { zh: '随机 F2L 公式', en: 'Random F2L algs' },
};

/** 面 → 颜色名(按站内标准配色:U 白 D 黄 F 绿 B 蓝 L 橙 R 红)。 */
const COLOR_NAMES: Record<CubeFace, { zh: string; en: string }> = {
  U: { zh: '白', en: 'white' },
  D: { zh: '黄', en: 'yellow' },
  F: { zh: '绿', en: 'green' },
  B: { zh: '蓝', en: 'blue' },
  L: { zh: '橙', en: 'orange' },
  R: { zh: '红', en: 'red' },
};

const FACE_NAMES: Record<CubeFace, { zh: string; en: string }> = {
  U: { zh: '顶', en: 'Up' },
  D: { zh: '底', en: 'Down' },
  F: { zh: '前', en: 'Front' },
  B: { zh: '后', en: 'Back' },
  L: { zh: '左', en: 'Left' },
  R: { zh: '右', en: 'Right' },
};

const LEGEND_FACES: CubeFace[] = ['U', 'D', 'F', 'B', 'L', 'R'];

/** 被复刻的原站(见 /about 致谢),嵌在页面底部可以直接对着玩。 */
const ORIGIN_URL = 'https://app--cube-lookahead-24bc12e4.base44.app/';

const clock = (seconds: number): string => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

function PredictPageInner() {
  useDocumentTitle('预判训练', 'Lookahead Challenge');

  const [mode, setMode] = useQueryState('mode',
    parseAsStringEnum<PredictMode>(MODES).withDefault('normal').withOptions({ history: 'replace', scroll: false }));
  const [kind, setKind] = useQueryState('piece',
    parseAsStringEnum<PieceKind>(KINDS).withDefault('pair').withOptions({ history: 'replace', scroll: false }));
  const [source, setSource] = useQueryState('src',
    parseAsStringEnum<ScrambleSource>(SOURCES).withDefault('random').withOptions({ history: 'replace', scroll: false }));
  const [moveCount, setMoveCount] = useQueryState('moves',
    parseAsInteger.withDefault(6).withOptions({ history: 'replace', scroll: false }));
  const [crossEdges, setCrossEdges] = useQueryState('edges',
    parseAsInteger.withDefault(1).withOptions({ history: 'replace', scroll: false }));
  const [orientation, setOrientation] = useQueryState('ori',
    parseAsStringEnum<string>(CUBE_ORIENTATIONS.map((o) => o.value)).withDefault('').withOptions({ history: 'replace', scroll: false }));

  const [challenge, setChallenge] = useState<PredictChallenge | null>(null);
  const [found, setFound] = useState<boolean[]>([]);
  const [wrong, setWrong] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [focus, setFocus] = useState<{ faces: CubeFace[]; nonce: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  const shown = useMemo(() => orientedFaceColors(orientation), [orientation]);
  const solved = challenge != null && found.length > 0 && found.every(Boolean);

  /** 把视角转到能看见这些 facelet 的角度 —— 目标块常常就在背面,不转的话玩家面前是一片灰。 */
  const focusOn = useCallback((facelets: readonly number[]) => {
    const faces = [...new Set(facelets.map((f) => FACE_LETTERS[faceletFace(f)]))];
    setFocus((f) => ({ faces, nonce: (f?.nonce ?? 0) + 1 }));
  }, []);

  const deal = useCallback(() => {
    const next = generateChallenge({ mode, kind, source, moveCount, crossEdges, orientation });
    setChallenge(next);
    focusOn(next.targets.map((t) => t.startFacelet));
    setWrong(false);
    setRevealed(false);
    setElapsed(0);
    startedAt.current = Date.now();
  }, [mode, kind, source, moveCount, crossEdges, orientation, focusOn]);

  /** 认输:切到「答案盘面」(目标块整块画在落点上),并把落点转到镜头前。 */
  const reveal = useCallback(() => {
    if (!challenge) return;
    focusOn(challenge.targets.map((t) => t.answerFacelet));
    setRevealed(true);
  }, [challenge, focusOn]);

  useEffect(() => { deal(); }, [deal]);
  useEffect(() => { setFound(challenge ? challenge.targets.map(() => false) : []); }, [challenge]);

  // 计时到答完(或认输看答案)为止;只按秒刷新,免得每帧重渲染整页。
  useEffect(() => {
    if (!challenge || solved || revealed) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
    return () => clearInterval(id);
  }, [challenge, solved, revealed]);

  useEffect(() => {
    if (!wrong) return;
    const id = setTimeout(() => setWrong(false), 1200);
    return () => clearTimeout(id);
  }, [wrong]);

  // 题板通过 ref 拿最新的这个闭包,所以直接读 state 就行 —— 别把 setWrong 塞进
  // setFound 的 updater 里,那是 reducer 里做副作用,StrictMode 双调用会把它吞掉。
  const onSticker = useCallback((facelet: number) => {
    if (!challenge || revealed || found.length === 0 || found.every(Boolean)) return;
    const hit = challenge.targets.findIndex((t, i) => !found[i] && t.answerFacelet === facelet);
    if (hit < 0) { setWrong(true); return; }
    setFound(found.map((v, i) => (i === hit ? true : v)));
  }, [challenge, revealed, found]);

  /** 54 个引擎色标签:灰底 + 目标块起点上色 + 已答对的落点补上色。
   *  看了答案就整盘切到 endFacelets —— 目标块整块出现在落点上,朝向也一眼看得出。 */
  const labels = useMemo(() => {
    if (!challenge) return Array<string>(54).fill('Gray');
    const base = revealed ? challenge.endFacelets : challenge.startFacelets;
    const out = [...base].map((ch) => (ch === '.' ? 'Gray' : shown[ch as CubeFace]));
    if (!revealed) {
      challenge.targets.forEach((t, i) => {
        if (found[i]) out[t.answerFacelet] = shown[FACE_LETTERS[t.colorFace]];
      });
    }
    return out;
  }, [challenge, found, revealed, shown]);

  // 十字模式恒为「找棱」,追踪选择器换成「找几条」。
  const kindDisabled = mode === 'cross';

  /** 十字模式那 N 条棱同类同色,合成一行 —— 否则就是 N 句一模一样的话在刷屏。 */
  const promptGroups = useMemo(() => {
    if (!challenge || found.length !== challenge.targets.length) return [];
    const first = challenge.targets[0];
    const uniform = challenge.targets.length > 1
      && challenge.targets.every((t) => t.kind === first.kind && t.colorFace === first.colorFace);
    if (uniform) {
      return [{
        key: 'all', kind: first.kind, colorFace: first.colorFace,
        total: challenge.targets.length, done: found.filter(Boolean).length,
      }];
    }
    return challenge.targets.map((t, i) => ({
      key: `${t.kind}-${t.piece}-${t.sticker}`, kind: t.kind, colorFace: t.colorFace,
      total: 1, done: found[i] ? 1 : 0,
    }));
  }, [challenge, found]);

  return (
    <div className="predict-page">
      <div className="predict-topbar">
        <BackHome />
        <HeaderToggles />
      </div>

      <header className="predict-header">
        <h1>{tr({ zh: '预判训练', en: 'Lookahead Challenge' })}</h1>
        <p>{tr({
          zh: '在脑子里把招式做完,点出高亮贴纸最终停在哪一格。',
          en: 'Run the moves in your head, then click the square the highlighted sticker lands on.',
        })}</p>
      </header>

      <div className="predict-controls">
        <div className="predict-control">
          <span>{tr({ zh: '模式', en: 'Mode' })}</span>
          <LiquidGlassChips<PredictMode>
            items={MODES} value={mode} onChange={(v) => void setMode(v)}
            getLabel={(m) => tr(MODE_LABELS[m])}
            ariaLabel={tr({ zh: '模式', en: 'Mode' })}
          />
        </div>

        {kindDisabled ? (
          <div className="predict-control">
            <span>{tr({ zh: '找几条', en: 'Edges' })}</span>
            <LiquidGlassChips<number>
              items={[1, 2, 3, 4]}
              value={Math.min(Math.max(crossEdges, CROSS_EDGES_MIN), CROSS_EDGES_MAX)}
              onChange={(v) => void setCrossEdges(v)}
              getLabel={(n) => String(n)}
              ariaLabel={tr({ zh: '要找的十字棱条数', en: 'Cross edges to find' })}
            />
          </div>
        ) : (
          <div className="predict-control">
            <span>{tr({ zh: '追踪', en: 'Track' })}</span>
            <LiquidGlassChips<PieceKind>
              items={KINDS} value={kind} onChange={(v) => void setKind(v)}
              getLabel={(k) => tr(KIND_LABELS[k])}
              ariaLabel={tr({ zh: '追踪对象', en: 'Piece to track' })}
            />
          </div>
        )}

        <div className="predict-control">
          <span>{tr({ zh: '招式', en: 'Moves' })}</span>
          <LiquidGlassChips<ScrambleSource>
            items={SOURCES} value={source} onChange={(v) => void setSource(v)}
            getLabel={(s) => tr(SOURCE_LABELS[s])}
            ariaLabel={tr({ zh: '招式来源', en: 'Move source' })}
          />
        </div>

        {source === 'random' && (
          <label className="predict-control">
            <span>{tr({ zh: '步数', en: 'Length' })}</span>
            <select
              className="predict-select"
              value={Math.min(Math.max(moveCount, MOVE_COUNT_MIN), MOVE_COUNT_MAX)}
              onChange={(e) => void setMoveCount(Number(e.target.value))}
            >
              {Array.from({ length: MOVE_COUNT_MAX }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}

        <label className="predict-control">
          <span>{tr({ zh: '拿方朝向', en: 'Holding' })}</span>
          <select
            className="predict-select"
            value={orientation}
            onChange={(e) => void setOrientation(e.target.value)}
          >
            {CUBE_ORIENTATIONS.map((o) => <option key={o.label} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      <div className="predict-stage">
        <PredictBoard
          labels={labels}
          onSticker={onSticker}
          focusFaces={focus?.faces}
          focusNonce={focus?.nonce ?? 0}
        />
        <div className="predict-clock" aria-live="off">{clock(elapsed)}</div>
        {wrong && (
          <div className="predict-wrong" role="alert">
            <X size={120} strokeWidth={3} aria-hidden="true" />
            <span className="predict-sr">{tr({ zh: '点错了', en: 'Wrong square' })}</span>
          </div>
        )}
      </div>

      <div className="predict-prompt">
        {promptGroups.map((g) => {
          const color = shown[FACE_LETTERS[g.colorFace]];
          const piece = KIND_LABELS[g.kind];
          const done = g.done === g.total;
          return (
            <p key={g.key} className={done ? 'is-found' : undefined}>
              {done && <Check size={15} aria-hidden="true" />}
              {tr({
                zh: g.total > 1 ? `${g.total} 条高亮${piece.zh}上的` : `高亮${piece.zh}上的`,
                en: g.total > 1 ? `Where do the ${g.total} highlighted ${piece.en.toLowerCase()}s' ` : 'Where does the ',
              })}
              <b className="predict-color" style={{ background: CUBE_FILL[color], color: CUBE_ON_FILL[color] }}>
                {tr(COLOR_NAMES[color])}
              </b>
              {tr({
                zh: g.total > 1 ? '色贴纸,分别落在哪一格?(顺序不限)' : '色贴纸,最终落在哪一格?',
                en: g.total > 1
                  ? ' stickers end up? (any order)'
                  : ` sticker of the highlighted ${piece.en.toLowerCase()} end up?`,
              })}
            </p>
          );
        })}
        {solved && (
          <p className="predict-done">
            {tr({ zh: `全对!用时 ${clock(elapsed)}`, en: `Solved in ${clock(elapsed)}` })}
          </p>
        )}
        {revealed && challenge && (
          <div className="predict-answer">
            <span className="predict-answer-tag">{tr({ zh: '答案', en: 'Answer' })}</span>
            {challenge.targets.map((t) => {
              const color = shown[FACE_LETTERS[t.colorFace]];
              const face = FACE_LETTERS[faceletFace(t.answerFacelet)];
              return (
                <span key={`${t.kind}-${t.piece}-${t.sticker}`} className="predict-answer-item">
                  <b className="predict-color" style={{ background: CUBE_FILL[color], color: CUBE_ON_FILL[color] }}>
                    {tr(COLOR_NAMES[color])}
                  </b>
                  <ArrowRight size={13} aria-hidden="true" />
                  {face} {tr(FACE_NAMES[face])}
                  {tr({ zh: '面', en: ' face' })}
                </span>
              );
            })}
          </div>
        )}
        {revealed && (
          <p className="predict-hint">
            {tr({
              zh: '目标块已整块画在它的落点上,题面问的那个颜色就是要点的那一格。',
              en: 'The tracked pieces are now painted in full at where they landed — the asked colour marks the square.',
            })}
          </p>
        )}
      </div>

      <div className="predict-actions">
        <button type="button" className="predict-deal" onClick={deal}>
          <RefreshCw size={16} aria-hidden="true" />
          {tr({ zh: '换一题', en: 'New challenge' })}
        </button>
        <button
          type="button"
          className="predict-reveal"
          onClick={reveal}
          disabled={!challenge || solved || revealed}
        >
          <Eye size={15} aria-hidden="true" />
          {tr({ zh: '显示答案', en: 'Show answer' })}
        </button>
        <div className="predict-progress">
          {promptGroups.map((g) => (
            <span
              key={`${g.key}-chip`}
              className={`predict-chip${g.done === g.total ? ' is-found' : ''}${revealed ? ' is-revealed' : ''}`}
            >
              {g.done === g.total && !revealed && <Check size={13} aria-hidden="true" />}
              {tr(KIND_LABELS[g.kind])}
              {g.total > 1 && <span className="predict-chip-count">{g.done}/{g.total}</span>}
            </span>
          ))}
        </div>
      </div>

      <section className="predict-moves">
        <h2>{tr({ zh: '要做的招式', en: 'Execute these moves' })}</h2>
        <ol className="predict-move-list">
          {challenge?.moves.map((m, i) => {
            const face = shown[m[0] as CubeFace];
            return (
              <li key={`${i}-${m}`} style={{ background: CUBE_FILL[face], color: CUBE_ON_FILL[face] }}>{m}</li>
            );
          })}
        </ol>
        <ul className="predict-legend">
          {LEGEND_FACES.map((f) => (
            <li key={f}>
              <i style={{ background: CUBE_FILL[shown[f]] }} aria-hidden="true" />
              {f}: {tr(FACE_NAMES[f])}
              {tr({ zh: `（${COLOR_NAMES[shown[f]].zh}）`, en: ` (${COLOR_NAMES[shown[f]].en})` })}
            </li>
          ))}
        </ul>
        <p className="predict-hint">
          {tr({
            zh: '拖动可以把魔方转到任意角度,答案有可能落在背面。',
            en: 'Drag to spin the cube — the answer can land on a face you cannot see yet.',
          })}
        </p>
      </section>

      <section className="predict-origin">
        <h2>{tr({ zh: '玩法原型', en: 'The original' })}</h2>
        <p>
          {tr({
            zh: '本页复刻自 Dan Boharon 的 Cube Lookahead Challenge。原站嵌在下面,可以直接对着玩。',
            en: "This page is a port of Dan Boharon's Cube Lookahead Challenge. The original is embedded below.",
          })}
          {' '}
          <a href={ORIGIN_URL} target="_blank" rel="noreferrer">
            {tr({ zh: '新标签打开', en: 'Open in a new tab' })}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        </p>
        {/* loading=lazy:它是个完整的 React 应用,滚到这儿才让它加载,别拖累本页首屏。 */}
        <iframe
          className="predict-origin-frame"
          src={ORIGIN_URL}
          title="Cube Lookahead Challenge — Dan Boharon"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </section>
    </div>
  );
}

export default function PredictPage() {
  return (
    <Suspense fallback={<div className="predict-page" />}>
      <PredictPageInner />
    </Suspense>
  );
}
