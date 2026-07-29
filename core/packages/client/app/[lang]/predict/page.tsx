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
 *   - 六面浮 U/D/L/R/F/B 字母作参照,而不是把字母印在中心贴纸上;
 *   - 公式除了随机 / 随机 F2L,还可以自己输入(原站只有前两档),练自己那条。
 *
 * 出题与判定全在 _lib/challenge.ts(纯函数,tests/predict_challenge.test.ts 锁),
 * 本文件只管交互与呈现。
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQueryState, parseAsStringEnum, parseAsInteger, parseAsString } from 'nuqs';
import { RefreshCw, Check, X, Eye, ArrowRight, ExternalLink } from 'lucide-react';
import AlgInput from '@/components/AlgInput';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import LiquidGlassChips from '@/components/LiquidGlassChips';
import PlaybackBar from '@/components/PlaybackBar';
import { tr } from '@/i18n/tr';
import { CUBE_FILL, CUBE_ON_FILL, type CubeFace } from '@/lib/cube-colors';
import { CUBE_ORIENTATIONS, orientedFaceColors } from '@/lib/cube-orientation';
import CubeOrientationSelect from '@/components/CubeOrientationSelect';
import {
  generateChallenge, parseMoveInput, FACE_LETTERS, faceletFace,
  MOVE_COUNT_MIN, MOVE_COUNT_MAX, CROSS_EDGES_MIN, CROSS_EDGES_MAX, CUSTOM_MOVES_MAX,
  type PredictChallenge, type PredictMode, type PieceKind, type ScrambleSource, type MoveInputError,
} from './_lib/challenge';
import './predict.css';

/** 还没出题时:空标签 = 用块自己的颜色(还原态),遮罩为空 = 不压暗。 */
const EMPTY_LABELS: readonly string[] = Array<string>(54).fill('');
const EMPTY_FACELETS: readonly number[] = [];

const PredictBoard = dynamic(() => import('./_components/PredictBoard'), {
  ssr: false,
  loading: () => <div className="predict-board" aria-hidden="true" />,
});

/** 站内那块公式键盘。只有「自己输入」这一档用得上,所以别让它进首包 —— 手机上
 *  AlgInput 会把系统键盘关掉(inputMode='none'),没有它就没法打字。 */
const CubeKeyboardSection = dynamic(() => import('@/components/CubeKeyboardSection'), { ssr: false });

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

const SOURCES: ScrambleSource[] = ['random', 'f2lAlg', 'custom'];
const SOURCE_LABELS: Record<ScrambleSource, { zh: string; en: string }> = {
  random: { zh: '随机公式', en: 'Random moves' },
  f2lAlg: { zh: '随机 F2L 公式', en: 'Random F2L algs' },
  custom: { zh: '自己输入', en: 'Your own' },
};

/** 自己输入的公式没通过检查时说人话 —— 光说「无效」等于让人自己猜哪个词写错了。 */
function algErrorText(e: MoveInputError): { zh: string; en: string } {
  switch (e.kind) {
    case 'empty':
      return { zh: '写一条公式,回车出题。', en: 'Type an algorithm, then press Enter.' };
    case 'token':
      return {
        zh: `不认识「${e.token}」:只收 U R F D L B(可加 ' 或 2);宽转 r / Rw、中层 M E S、转体 x y z 都追不了。`,
        en: `Cannot read “${e.token}”: only U R F D L B (each with an optional ' or 2) — no wide turns, slices or rotations.`,
      };
    case 'parens':
      return {
        zh: '括号没配对。(输入框打「(」会自动补上「)」,再打一个就多了。)',
        en: 'Unbalanced parentheses. (Typing “(” already closes itself, so typing “)” adds a spare one.)',
      };
    case 'tooLong':
      return {
        zh: `${e.count} 步太长了,最多 ${CUSTOM_MOVES_MAX} 步。`,
        en: `${e.count} moves is too long — ${CUSTOM_MOVES_MAX} max.`,
      };
  }
}

/** 面 → 颜色名(按站内标准配色:U 白 D 黄 F 绿 B 蓝 L 橙 R 红)。 */
const COLOR_NAMES: Record<CubeFace, { zh: string; en: string }> = {
  U: { zh: '白', en: 'white' },
  D: { zh: '黄', en: 'yellow' },
  F: { zh: '绿', en: 'green' },
  B: { zh: '蓝', en: 'blue' },
  L: { zh: '橙', en: 'orange' },
  R: { zh: '红', en: 'red' },
};

/** 色块标签:中文「黄格」这样一个词说完(不写「黄色贴纸」),英文仍是颜色词,后面的句子接 sticker。 */
const colorChipLabel = (c: CubeFace): string => tr({ zh: `${COLOR_NAMES[c].zh}格`, en: COLOR_NAMES[c].en });

const FACE_NAMES: Record<CubeFace, { zh: string; en: string }> = {
  U: { zh: '顶', en: 'Up' },
  D: { zh: '底', en: 'Down' },
  F: { zh: '前', en: 'Front' },
  B: { zh: '后', en: 'Back' },
  L: { zh: '左', en: 'Left' },
  R: { zh: '右', en: 'Right' },
};

const LEGEND_FACES: CubeFace[] = ['U', 'D', 'F', 'B', 'L', 'R'];

/** 六个中心的 facelet(URFDLB 每面第 5 格)。中心不动,拿来当方位锚。 */
const CENTER_FACELETS: readonly number[] = [4, 13, 22, 31, 40, 49];

/** 被复刻的原站(见 /about 致谢),页面底部给个链接。 */
const ORIGIN_URL = 'https://app--cube-lookahead-24bc12e4.base44.app/';

/** 复盘时两步之间的间隔;留一点余量,别在上一步的转动还没落地就催下一步。 */
const PLAY_STEP_MS = 340;

const clock = (seconds: number): string => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

function PredictPageInner() {

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
  const [alg, setAlg] = useQueryState('alg',
    parseAsString.withDefault('').withOptions({ history: 'replace', scroll: false }));

  const [challenge, setChallenge] = useState<PredictChallenge | null>(null);
  const [algError, setAlgError] = useState<MoveInputError | null>(null);
  const [found, setFound] = useState<boolean[]>([]);
  const [wrong, setWrong] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [focus, setFocus] = useState<{ faces: CubeFace[]; nonce: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const startedAt = useRef(0);
  const algElRef = useRef<HTMLTextAreaElement | null>(null);
  /** 出题时读的是 ref 而不是 state:公式每敲一个字都在变,不能每个字换一题。 */
  const algRef = useRef(alg);
  useEffect(() => { algRef.current = alg; }, [alg]);

  const shown = useMemo(() => orientedFaceColors(orientation), [orientation]);
  const solved = challenge != null && found.length > 0 && found.every(Boolean);
  /** 这题结束了(答完 or 认输)—— 结束就自动复盘一遍。 */
  const over = challenge != null && (solved || revealed);
  const totalSteps = challenge?.moves.length ?? 0;

  /**
   * 跳到第 n 步(= 已做 n 招后的盘面)。口径和 /recon 详情页点解法、/sim 播放条一致:
   * `step` 是已做步数,`step - 1` 是「当前这一招」。题板自己判断这是「往前一步」
   * (放动画)还是「跳过去」(瞬时重放),这里只管改数。
   *
   * 答题中也能跳:答案本来就有「显示答案」一键可看,把复盘锁死只是让想核对某一步的人
   * 没处下手。跳过去不算认输,计时照走。
   */
  const seek = useCallback((n: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(n, totalSteps)));
  }, [totalSteps]);

  /** 播放条:默认不占地方,一旦复盘开始(自动或手点某一招)就出来 —— 否则跳到第 3 步后没法回起点。 */
  const showPlayback = over || step > 0;

  /** 把视角转到能看见这些 facelet 的角度 —— 目标块常常就在背面,不转的话玩家面前是一片灰。 */
  const focusOn = useCallback((facelets: readonly number[]) => {
    const faces = [...new Set(facelets.map((f) => FACE_LETTERS[faceletFace(f)]))];
    setFocus((f) => ({ faces, nonce: (f?.nonce ?? 0) + 1 }));
  }, []);

  /**
   * 出一题。`algText` 给「自己输入」那档用:回车时直接把输入框里的原文递进来,
   * 不经过 state 一轮,免得刚敲完的那个字还没落到 ref 上。
   */
  const deal = useCallback((algText?: string) => {
    let customMoves: readonly string[] = [];
    if (source === 'custom') {
      const parsed = parseMoveInput(algText ?? algRef.current);
      setAlgError(parsed.error);
      // 公式不合法就不出题:硬出一道等于把「我看不懂你写的」变成一道答案随机的题。
      if (parsed.error) { setChallenge(null); return; }
      customMoves = parsed.moves;
    } else {
      setAlgError(null);
    }
    const next = generateChallenge({ mode, kind, source, moveCount, crossEdges, orientation, customMoves });
    setChallenge(next);
    focusOn(next.targets.map((t) => t.startFacelet));
    setWrong(false);
    setRevealed(false);
    setStep(0);
    setPlaying(false);
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

  // 这题一结束就自动复盘一遍 —— 看着目标块被转过去,比看一张静态答案图有用得多。
  // 从头播:答题中可能已经手点到某一招了,不回零就会从半截接着往下播。
  useEffect(() => { if (over) { setStep(0); setPlaying(true); } }, [over]);

  // 一步一格往前推;题板收到「比上一步多 1」就放一步动画,推到头就停。
  useEffect(() => {
    if (!playing) return;
    if (step >= totalSteps) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => s + 1), PLAY_STEP_MS);
    return () => clearTimeout(id);
  }, [playing, step, totalSteps]);

  // 题板通过 ref 拿最新的这个闭包,所以直接读 state 就行 —— 别把 setWrong 塞进
  // setFound 的 updater 里,那是 reducer 里做副作用,StrictMode 双调用会把它吞掉。
  const onSticker = useCallback((facelet: number) => {
    if (!challenge || revealed || found.length === 0 || found.every(Boolean)) return;
    const hit = challenge.targets.findIndex((t, i) => !found[i] && t.answerFacelet === facelet);
    if (hit < 0) { setWrong(true); return; }
    setFound(found.map((v, i) => (i === hit ? true : v)));
  }, [challenge, revealed, found]);

  /**
   * 54 个引擎色标签 = **起点盘面的真实颜色**(按朝向翻译)。
   *
   * 只画起点:落点是题板自己把那串公式真转过去得到的(复盘动画),另算一套落点盘面
   * 就成了第二个真源。这份只跟题 + 朝向有关,答对与否不进来 —— labels 一变题板就得
   * 整盘重贴,播到一半改它会把那一步的动画吃掉。
   */
  const labels = useMemo(() => {
    if (!challenge) return EMPTY_LABELS;
    return [...challenge.startColors].map((ch) => shown[ch as CubeFace]);
  }, [challenge, shown]);

  /**
   * 满色的 facelet:题面点名的那几枚贴纸 + 已经答对的落点(当记号,这题一结束就撤)。
   *
   * 走题板的阶段遮罩而不是改色,所以它怎么变都不会打断复盘动画。
   */
  const bright = useMemo(() => {
    if (!challenge) return EMPTY_FACELETS;
    const out = challenge.targets.map((t) => t.startFacelet);
    if (!over) challenge.targets.forEach((t, i) => { if (found[i]) out.push(t.answerFacelet); });
    return out;
  }, [challenge, found, over]);

  /**
   * 压暗的 facelet = 目标块剩下的贴纸 + 六个中心。
   *
   * 前者:问的是「白色那枚落在哪」,同块的绿橙两枚只用来认出这是同一个角块,不该跟它一样亮。
   * 后者:中心不动,是读方位的锚(哪面是绿面);压暗才不跟目标抢眼 —— 满色中心在灰底上
   * 比目标还显眼,这题就变成「找那个不是中心的彩格」了。
   */
  const dim = useMemo(() => {
    if (!challenge) return EMPTY_FACELETS;
    const asked = new Set(challenge.targets.map((t) => t.startFacelet));
    const out = CENTER_FACELETS.filter((f) => !asked.has(f));
    [...challenge.startFacelets].forEach((ch, i) => { if (ch !== '.' && !asked.has(i)) out.push(i); });
    return out;
  }, [challenge]);

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
          zh: '在脑子里把公式做完,点出高亮贴纸最终停在哪一格。',
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
          <span>{tr({ zh: '公式', en: 'Moves' })}</span>
          <LiquidGlassChips<ScrambleSource>
            items={SOURCES} value={source} onChange={(v) => void setSource(v)}
            getLabel={(s) => tr(SOURCE_LABELS[s])}
            ariaLabel={tr({ zh: '公式来源', en: 'Move source' })}
          />
        </div>

        {source === 'custom' && (
          <div className="predict-control predict-control--alg">
            <span>{tr({ zh: '你的公式', en: 'Your algorithm' })}</span>
            <AlgInput
              elementRef={algElRef as React.RefObject<HTMLTextAreaElement | HTMLDivElement | null>}
              initialText={alg}
              className="predict-alg-input"
              rows={1}
              autoSpace
              autoResize
              placeholder="R U R' U'"
              onChange={(text) => void setAlg(text)}
              onKeyDown={(e) => {
                // 回车 = 出题(而不是在单行框里换行)。组字中的回车是输入法在选词,别抢。
                if (e.key !== 'Enter' || (e.nativeEvent as KeyboardEvent).isComposing) return;
                e.preventDefault();
                deal((e.currentTarget as HTMLTextAreaElement).value);
              }}
            />
            <CubeKeyboardSection
              target={algElRef as React.RefObject<HTMLTextAreaElement | HTMLDivElement | null>}
              onInput={() => { if (algElRef.current) void setAlg(algElRef.current.value); }}
            />
            <p className={algError ? 'predict-alg-error' : 'predict-hint'}>
              {algError
                ? tr(algErrorText(algError))
                : tr({ zh: '回车出题;换一题 = 同一条公式换个起点。', en: 'Enter deals; New challenge re-rolls the start position.' })}
            </p>
          </div>
        )}

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
          <span>{tr({ zh: '朝向', en: 'Holding' })}</span>
          <CubeOrientationSelect
            className="predict-select"
            value={orientation}
            onChange={(v) => void setOrientation(v)}
          />
        </label>
      </div>

      <div className="predict-stage">
        <PredictBoard
          labels={labels}
          bright={bright}
          dim={dim}
          onSticker={onSticker}
          focusFaces={focus?.faces}
          focusNonce={focus?.nonce ?? 0}
          moves={challenge?.moves}
          step={step}
        />
        <div className="predict-clock" aria-live="off">{clock(elapsed)}</div>
        {wrong && (
          <div className="predict-wrong" role="alert">
            <X size={120} strokeWidth={3} aria-hidden="true" />
            <span className="predict-sr">{tr({ zh: '点错了', en: 'Wrong square' })}</span>
          </div>
        )}
      </div>

      {showPlayback && (
        <div className="predict-replay">
          <PlaybackBar
            step={step}
            total={totalSteps}
            playing={playing}
            onScrub={seek}
            onSkipStart={() => { setPlaying(false); setStep(0); }}
            onStepBack={() => { setPlaying(false); setStep((s) => Math.max(0, s - 1)); }}
            onTogglePlay={() => {
              if (playing) { setPlaying(false); return; }
              if (step >= totalSteps) setStep(0); // 播完了再按 = 重播
              setPlaying(true);
            }}
            onStepForward={() => { setPlaying(false); setStep((s) => Math.min(totalSteps, s + 1)); }}
            onSkipEnd={() => { setPlaying(false); setStep(totalSteps); }}
            labels={{
              skipStart: tr({ zh: '回到起点', en: 'Skip to start' }),
              stepBack: tr({ zh: '退一步', en: 'Step back' }),
              play: tr({ zh: '播放复盘', en: 'Play' }),
              pause: tr({ zh: '暂停', en: 'Pause' }),
              stepForward: tr({ zh: '进一步', en: 'Step forward' }),
              skipEnd: tr({ zh: '跳到落点', en: 'Skip to end' }),
              scrub: tr({ zh: '拖动到第几步', en: 'Scrub' }),
            }}
          />
        </div>
      )}

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
                {colorChipLabel(color)}
              </b>
              {tr({
                // 逗号紧跟在色块徽章后面会浮在半空(徽章自带内边距),中文这里不要它也读得通。
                zh: g.total > 1 ? '分别落在哪一格?(顺序不限)' : '最终落在哪一格?',
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
                    {colorChipLabel(color)}
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
        <button type="button" className="predict-deal" onClick={() => deal()}>
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
        <h2>{tr({ zh: '要做的公式', en: 'Execute these moves' })}</h2>
        <ol className="predict-move-list">
          {challenge?.moves.map((m, i) => {
            const face = shown[m[0] as CubeFace];
            // 已经转过的压暗,刚做完的那一招描一圈(= step - 1,与 /recon、/sim 同一口径)。
            const state = step === 0 ? '' : i === step - 1 ? 'is-current' : i < step ? 'is-done' : '';
            return (
              <li key={`${i}-${m}`}>
                <button
                  type="button"
                  className={`predict-move${state ? ` ${state}` : ''}`}
                  style={{ background: CUBE_FILL[face], color: CUBE_ON_FILL[face] }}
                  aria-current={i === step - 1 ? 'step' : undefined}
                  title={tr({ zh: `同步到第 ${i + 1} 步`, en: `Jump to move ${i + 1}` })}
                  onClick={() => seek(i + 1)}
                >
                  {m}
                </button>
              </li>
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
      </section>

      <p className="predict-origin">
        {tr({ zh: '复刻自 Dan Boharon 的 Cube Lookahead Challenge:', en: 'Ported from Dan Boharon’s Cube Lookahead Challenge:' })}
        {' '}
        <a href={ORIGIN_URL} target="_blank" rel="noreferrer">
          {ORIGIN_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </p>
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
