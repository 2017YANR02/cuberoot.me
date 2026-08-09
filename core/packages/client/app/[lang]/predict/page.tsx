'use client';

/**
 * /predict —— 预判训练(Lookahead Challenge)。
 *
 * 复刻 Dan Boharon 的 Rubik's Cube Lookahead Challenge(见 /about 致谢):
 * 一个几乎全灰的拼图上只亮着目标块,给你一串公式,你在脑子里做完,直接点出那枚
 * 贴纸最终落在哪一格。点对了那格就把颜色贴上去(看着它"落位"),点错弹红叉。
 *
 * 本站版本的差异:
 *   - 配色走站内单一源(白上绿前红右),另给 24 个拿方朝向可切 —— 与 /timer 的
 *     「预打乱朝向」共用 lib/cube-orientation 那张表;
 *   - 视角可自由旋转到背面(原站锁死正面),否则落在背面的答案点不到;默认把内核设为
 *     透明、直接读背贴纸,关闭透明时才用 /sim 的「提示贴片」补背面;
 *   - 六面浮 U/D/L/R/F/B 字母作参照,而不是把字母印在中心贴纸上;
 *   - 公式除了随机 / 随机 F2L,还可以自己输入(原站只有前两档),练自己那条;
 *   - 不止三阶:二 ~ 七阶、五魔方、金字塔、斜转、枫叶都能练(原站只有三阶)。
 *
 * 出题与判定全在 _lib/ 的两个纯函数引擎:三阶走 `challenge.ts`(它多带十字 / 前两层 /
 * F2L 三档按解法阶段出题的模式),其余拼图走 `puzzle_challenge.ts`(通用的「追一枚
 * 贴纸」)。两边输出形状对齐,**展示元数据一律从 `_lib/puzzles` 取**,所以本文件不为
 * 三阶另开一条分支 —— 只在「出题」那一步分派。
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQueryState, parseAsStringEnum, parseAsInteger, parseAsString, parseAsBoolean } from 'nuqs';
import { Check, X, Eye, ArrowRight, ExternalLink } from 'lucide-react';
import AlgInput from '@/components/AlgInput';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import LiquidGlassChips from '@/components/LiquidGlassChips';
import PlaybackBar from '@/components/PlaybackBar';
import BoolToggle from '@/components/BoolToggle';
import { tr } from '@/i18n/tr';
import { CUBE_ORIENTATIONS, orientedFaceColors } from '@/lib/cube-orientation';
import CubeOrientationSelect from '@/components/CubeOrientationSelect';
import {
  PREDICT_FILL, PREDICT_ON_FILL, PREDICT_COLOR_NAMES, IDENTITY_COLORS,
  type PredictColor,
} from './_lib/colors';
import {
  generateChallenge, parseMoveInput,
  MOVE_COUNT_MIN, CROSS_EDGES_MIN, CROSS_EDGES_MAX, CUSTOM_MOVES_MAX,
  type PredictMode, type PieceKind, type ScrambleSource, type MoveInputError,
} from './_lib/challenge';
import {
  generatePuzzleChallenge, trackOptions,
  type PredictBoardChallenge, type PredictTrack,
} from './_lib/puzzle_challenge';
import {
  getPuzzle, stickerCount, PREDICT_PUZZLE_IDS, PUZZLE_LABELS,
  type PredictPuzzle, type PredictPuzzleId,
} from './_lib/puzzles';
import './predict.css';

/** 还没出题时:遮罩为空 = 不压暗。 */
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
  f2l: { zh: 'F2L', en: 'F2L' },
};

/** 三阶那套追踪档(它的引擎只认这三档;中心在三阶上不动,追它没意义)。 */
const CUBE333_TRACKS: PredictTrack[] = ['edge', 'corner', 'pair'];
const ALL_TRACKS: PredictTrack[] = ['edge', 'corner', 'center', 'tip', 'pair'];

const TRACK_LABELS: Record<PredictTrack, { zh: string; en: string }> = {
  edge: { zh: '棱块', en: 'Edge' },
  corner: { zh: '角块', en: 'Corner' },
  center: { zh: '中心块', en: 'Center' },
  tip: { zh: '尖角', en: 'Tip' },
  pair: { zh: '一对', en: 'Pair' },
};

const SOURCES: ScrambleSource[] = ['random', 'f2lAlg', 'custom'];
/** F2L 公式是三阶专属,别的拼图只有随机 / 自己输入两档。 */
const PUZZLE_SOURCES: ScrambleSource[] = ['random', 'custom'];
const SOURCE_LABELS: Record<ScrambleSource, { zh: string; en: string }> = {
  random: { zh: '随机公式', en: 'Random moves' },
  f2lAlg: { zh: 'F2L 公式', en: 'F2L algs' },
  custom: { zh: '输入', en: 'Custom' },
};

/**
 * 自己输入的公式没通过检查时说人话 —— 光说「无效」等于让人自己猜哪个词写错了。
 * 收哪些记号各拼图不一样,所以由拼图自己报(`puzzle.notation`)。
 */
function algErrorText(e: MoveInputError, puzzle: PredictPuzzle): { zh: string; en: string } {
  switch (e.kind) {
    case 'empty':
      return { zh: '写一条公式,回车出题。', en: 'Type an algorithm, then press Enter.' };
    case 'token':
      return {
        zh: `不认识「${e.token}」:${puzzle.notation.zh}`,
        en: `Cannot read “${e.token}”: ${puzzle.notation.en}`,
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

/** 色块标签:中文「黄格」这样一个词说完(不写「黄色贴纸」),英文仍是颜色词,后面的句子接 sticker。 */
const colorChipLabel = (c: PredictColor): string =>
  tr({ zh: `${PREDICT_COLOR_NAMES[c].zh}格`, en: PREDICT_COLOR_NAMES[c].en });

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

  const [puzzleId, setPuzzleId] = useQueryState('puzzle',
    parseAsStringEnum<PredictPuzzleId>([...PREDICT_PUZZLE_IDS]).withDefault('3').withOptions({ history: 'replace', scroll: false }));
  const [mode, setMode] = useQueryState('mode',
    parseAsStringEnum<PredictMode>(MODES).withDefault('normal').withOptions({ history: 'replace', scroll: false }));
  const [rawTrack, setTrack] = useQueryState('piece',
    parseAsStringEnum<PredictTrack>(ALL_TRACKS).withDefault('pair').withOptions({ history: 'replace', scroll: false }));
  const [rawSource, setSource] = useQueryState('src',
    parseAsStringEnum<ScrambleSource>(SOURCES).withDefault('random').withOptions({ history: 'replace', scroll: false }));
  const [rawMoveCount, setMoveCount] = useQueryState('moves',
    parseAsInteger.withOptions({ history: 'replace', scroll: false }));
  const [crossEdges, setCrossEdges] = useQueryState('edges',
    parseAsInteger.withDefault(1).withOptions({ history: 'replace', scroll: false }));
  const [orientation, setOrientation] = useQueryState('ori',
    parseAsStringEnum<string>(CUBE_ORIENTATIONS.map((o) => o.value)).withDefault('').withOptions({ history: 'replace', scroll: false }));
  const [alg, setAlg] = useQueryState('alg',
    parseAsString.withDefault('').withOptions({ history: 'replace', scroll: false }));
  const [transparent, setTransparent] = useQueryState('transparent',
    parseAsBoolean.withDefault(true).withOptions({ history: 'replace', scroll: false }));

  const [challenge, setChallenge] = useState<PredictBoardChallenge | null>(null);
  const [algError, setAlgError] = useState<MoveInputError | null>(null);
  const [found, setFound] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<{ kind: 'correct' | 'wrong' } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [viewResetSeq, setViewResetSeq] = useState(0);
  const startedAt = useRef(0);
  const algElRef = useRef<HTMLTextAreaElement | null>(null);
  /** 出题时读的是 ref 而不是 state:公式每敲一个字都在变,不能每个字换一题。 */
  const algRef = useRef(alg);
  useEffect(() => { algRef.current = alg; }, [alg]);

  const puzzle = getPuzzle(puzzleId);
  /** 三阶走另一套引擎(多三档方法学模式),别的都走通用引擎。 */
  const is333 = puzzleId === '3';
  const total = stickerCount(puzzle);

  // URL 上可能留着别的拼图的档(换拼图不清参数),这里当场钳到本拼图有的那几档。
  const tracks = useMemo(() => (is333 ? CUBE333_TRACKS : trackOptions(puzzle)), [is333, puzzle]);
  const track = tracks.includes(rawTrack) ? rawTrack : tracks[0];
  const sources = is333 ? SOURCES : PUZZLE_SOURCES;
  const source = sources.includes(rawSource) ? rawSource : 'random';
  const moveCount = rawMoveCount ?? puzzle.defaultMoveCount;

  /** 色号 → 屏幕上的颜色。立方体族吃 24 档拿方朝向,金字塔 / 五魔方那种没有对面的不吃。 */
  const shown = useMemo(
    (): Record<string, PredictColor> => (
      puzzle.cubeLike ? orientedFaceColors(orientation) : IDENTITY_COLORS
    ),
    [puzzle, orientation],
  );
  /** 本位面序号 → 屏幕上的颜色。 */
  const faceColorOf = useCallback(
    (face: number): PredictColor => shown[puzzle.faceColor[puzzle.faces[face]]],
    [shown, puzzle],
  );

  /**
   * 换拼图那一帧 `challenge` 还是上一个拼图的(贴纸数都不一样),直接喂给题板会越界。
   * 出题的 effect 随后就会补上,这里先当作「还没出题」。
   */
  const ch = challenge && challenge.startColors.length === total ? challenge : null;

  const solved = ch != null && found.length > 0 && found.length === ch.targets.length && found.every(Boolean);
  /** 这题结束了(答完 or 认输)—— 结束就自动复盘一遍。 */
  const over = ch != null && (solved || revealed);
  const totalSteps = ch?.moves.length ?? 0;

  /**
   * 跳到第 n 步(= 已做 n 步后的盘面)。口径和 /recon 详情页点解法、/sim 播放条一致:
   * `step` 是已做步数,`step - 1` 是「当前这一步」。题板自己判断这是「往前一步」
   * (放动画)还是「跳过去」(瞬时重放),这里只管改数。
   *
   * 答题中也能跳:答案本来就有「显示答案」一键可看,把复盘锁死只是让想核对某一步的人
   * 没处下手。跳过去不算认输,计时照走。
   */
  const seek = useCallback((n: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(n, totalSteps)));
  }, [totalSteps]);

  /**
   * 出一题。`algText` 给「自己输入」那档用:回车时直接把输入框里的原文递进来,
   * 不经过 state 一轮,免得刚敲完的那个字还没落到 ref 上。
   */
  const deal = useCallback((algText?: string) => {
    let customMoves: readonly string[] = [];
    if (source === 'custom') {
      const text = algText ?? algRef.current;
      const parsed = is333 ? parseMoveInput(text) : puzzle.parse(text);
      setAlgError(parsed.error);
      // 公式不合法就不出题:硬出一道等于把「我看不懂你写的」变成一道答案随机的题。
      if (parsed.error) { setChallenge(null); return; }
      customMoves = parsed.moves;
    } else {
      setAlgError(null);
    }
    const next: PredictBoardChallenge = is333
      ? generateChallenge({
        mode, kind: track as PieceKind, source, moveCount, crossEdges, orientation, customMoves,
      })
      : generatePuzzleChallenge({
        puzzle, track, source: source === 'custom' ? 'custom' : 'random', moveCount, customMoves,
      });
    setChallenge(next);
    setFeedback(null);
    setRevealed(false);
    setStep(0);
    setPlaying(false);
    setElapsed(0);
    setViewResetSeq((seq) => seq + 1);
    startedAt.current = Date.now();
  }, [puzzle, is333, mode, track, source, moveCount, crossEdges, orientation]);

  /** 认输:切到「答案盘面」(目标块整块画在落点上)。透明模式能直接读背贴纸,关闭透明
   *  后提示贴片会把那三面的贴纸浮在方块外侧,所以这里不再替玩家转视角。 */
  const reveal = useCallback(() => {
    if (!ch) return;
    setRevealed(true);
  }, [ch]);

  useEffect(() => { deal(); }, [deal]);
  useEffect(() => { setFound(challenge ? challenge.targets.map(() => false) : []); }, [challenge]);

  // 计时到答完(或认输看答案)为止;只按秒刷新,免得每帧重渲染整页。
  useEffect(() => {
    if (!ch || solved || revealed) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
    return () => clearInterval(id);
  }, [ch, solved, revealed]);

  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => setFeedback(null), 1200);
    return () => clearTimeout(id);
  }, [feedback]);

  // 这题一结束就自动复盘一遍 —— 看着目标块被转过去,比看一张静态答案图有用得多。
  // 从头播:答题中可能已经手点到某一步了,不回零就会从半截接着往下播。
  useEffect(() => { if (over) { setStep(0); setPlaying(true); } }, [over]);

  // 一步一格往前推;题板收到「比上一步多 1」就放一步动画,推到头就停。
  useEffect(() => {
    if (!playing) return;
    if (step >= totalSteps) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => s + 1), PLAY_STEP_MS);
    return () => clearTimeout(id);
  }, [playing, step, totalSteps]);

  // 题板通过 ref 拿最新的这个闭包,所以直接读 state 就行 —— 别把 setFeedback 塞进
  // setFound 的 updater 里,那是 reducer 里做副作用,StrictMode 双调用会把它吞掉。
  const onSticker = useCallback((facelet: number) => {
    if (!ch || revealed || found.length === 0 || found.every(Boolean)) return;
    const hit = ch.targets.findIndex((t, i) => !found[i] && t.answerFacelet === facelet);
    if (hit < 0) { setFeedback({ kind: 'wrong' }); return; }
    // 每次都放一个新对象:连续点对多枚时也要从这一次点击重新计满 1.2 秒。
    setFeedback({ kind: 'correct' });
    setFound(found.map((v, i) => (i === hit ? true : v)));
  }, [ch, revealed, found]);

  /**
   * 每一格的引擎色标签 = **起点盘面的真实颜色**(按朝向翻译)。
   *
   * 只画起点:落点是题板自己把那串公式真转过去得到的(复盘动画),另算一套落点盘面
   * 就成了第二个真源。这份只跟题 + 朝向有关,答对与否不进来 —— labels 一变题板就得
   * 整盘重贴,播到一半改它会把那一步的动画吃掉。
   */
  const labels = useMemo(() => {
    if (!ch) return Array<string>(total).fill('');
    return ch.startColors.map((c) => shown[puzzle.faceColor[c]]);
  }, [ch, shown, puzzle, total]);

  /**
   * 满色的格:题面点名的那几枚贴纸 + 已经答对的落点(当记号,这题一结束就撤)。
   *
   * 走题板的阶段遮罩而不是改色,所以它怎么变都不会打断复盘动画。
   */
  const bright = useMemo(() => {
    if (!ch) return EMPTY_FACELETS;
    const out = ch.targets.map((t) => t.startFacelet);
    if (!over) ch.targets.forEach((t, i) => { if (found[i]) out.push(t.answerFacelet); });
    return out;
  }, [ch, found, over]);

  /**
   * 压暗的格 = 目标块剩下的贴纸 + 方位锚(奇数阶的六个中心)。
   *
   * 前者:问的是「白色那枚落在哪」,同块的绿橙两枚只用来认出这是同一个角块,不该跟它一样亮。
   * 后者:中心不动,是读方位的锚(哪面是绿面);压暗才不跟目标抢眼 —— 满色中心在灰底上
   * 比目标还显眼,这题就变成「找那个不是中心的彩格」了。没有固定块的拼图(斜转 / 枫叶 /
   * 金字塔 / 偶数阶)锚是空的,方位靠场景里的面字母读。
   */
  const dim = useMemo(() => {
    if (!ch) return EMPTY_FACELETS;
    const asked = new Set(ch.targets.map((t) => t.startFacelet));
    const out = puzzle.anchors.filter((f) => !asked.has(f));
    ch.startFacelets.forEach((c, i) => { if (c !== '.' && !asked.has(i)) out.push(i); });
    return out;
  }, [ch, puzzle]);

  // 十字模式恒为「找棱」,追踪选择器换成「找几条」。
  const crossMode = is333 && mode === 'cross';

  /** 十字模式那 N 条棱同类同色,合成一行 —— 否则就是 N 句一模一样的话在刷屏。 */
  const promptGroups = useMemo(() => {
    if (!ch || found.length !== ch.targets.length) return [];
    const first = ch.targets[0];
    if (!first) return [];
    const uniform = ch.targets.length > 1
      && ch.targets.every((t) => t.kind === first.kind && t.colorFace === first.colorFace);
    if (uniform) {
      return [{
        key: 'all', kind: first.kind as PredictTrack, colorFace: first.colorFace,
        total: ch.targets.length, done: found.filter(Boolean).length,
      }];
    }
    return ch.targets.map((t, i) => ({
      key: `${t.kind}-${t.startFacelet}`, kind: t.kind as PredictTrack, colorFace: t.colorFace,
      total: 1, done: found[i] ? 1 : 0,
    }));
  }, [ch, found]);

  return (
    <div className="predict-page">
      <div className="predict-topbar">
        <BackHome />
        <HeaderToggles />
      </div>

      {/* 桌面端两栏(左题板右其余)靠 .predict-page 的 grid-template-areas 摆位:题板 + 复盘条
          裹成 .predict-boardcol 占满左列,右边每一块自己就是一个格子。窄屏这层包裹不参与
          布局(纯块级),孩子按 DOM 顺序照旧竖着排,和改成两栏之前一模一样。 */}
      <header className="predict-header">
        <h1>{tr({ zh: '预判训练', en: 'Lookahead Challenge' })}</h1>
      </header>

      {/* 选项自己就说明了自己(拼图名 / 常规-十字-前两层 / 棱块-角块 / 随机-F2L-输入),
          那几档不写小标题;只有值本身读不出含义的(一个数字、一个朝向记号)才留标题。
          没标题的控件不进 .predict-control(那个类会把自己顶到行首对齐标题),直接当
          .predict-controls 的孩子,由容器的 align-items:flex-end 与有标题那几个的
          下沿对齐 —— 否则整行会高低错开。 */}
      <div className="predict-controls">
        <select
          className="predict-select"
          aria-label={tr({ zh: '拼图', en: 'Puzzle' })}
          value={puzzleId}
          onChange={(e) => void setPuzzleId(e.target.value as PredictPuzzleId)}
        >
          {PREDICT_PUZZLE_IDS.map((id) => (
            <option key={id} value={id}>{tr(PUZZLE_LABELS[id])}</option>
          ))}
        </select>

        {is333 && (
          <LiquidGlassChips<PredictMode>
            items={MODES} value={mode} onChange={(v) => void setMode(v)}
            getLabel={(m) => tr(MODE_LABELS[m])}
            ariaLabel={tr({ zh: '模式', en: 'Mode' })}
          />
        )}

        {crossMode ? (
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
        ) : tracks.length > 1 && (
          <LiquidGlassChips<PredictTrack>
            items={tracks} value={track} onChange={(v) => void setTrack(v)}
            getLabel={(k) => tr({
              zh: TRACK_LABELS[k].zh.replace(/块$/, ''),
              en: TRACK_LABELS[k].en,
            })}
            ariaLabel={tr({ zh: '追踪对象', en: 'Piece to track' })}
          />
        )}

        <LiquidGlassChips<ScrambleSource>
          items={sources} value={source} onChange={(v) => void setSource(v)}
          getLabel={(s) => tr(SOURCE_LABELS[s])}
          ariaLabel={tr({ zh: '公式来源', en: 'Move source' })}
        />

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
              placeholder={puzzle.placeholder}
              // 站内那块公式键盘只有立方体记号,金字塔 / 斜转 / 枫叶用不上;
              // 不放它就得把系统键盘放回来,否则手机上这个框根本打不了字。
              inputMode={puzzle.cubeLike ? undefined : 'text'}
              onChange={(text) => void setAlg(text)}
              onKeyDown={(e) => {
                // 回车 = 出题(而不是在单行框里换行)。组字中的回车是输入法在选词,别抢。
                if (e.key !== 'Enter' || (e.nativeEvent as KeyboardEvent).isComposing) return;
                e.preventDefault();
                deal((e.currentTarget as HTMLTextAreaElement).value);
              }}
            />
            {puzzle.cubeLike && (
              <CubeKeyboardSection
                target={algElRef as React.RefObject<HTMLTextAreaElement | HTMLDivElement | null>}
                onInput={() => { if (algElRef.current) void setAlg(algElRef.current.value); }}
              />
            )}
            <p className={algError ? 'predict-alg-error' : 'predict-hint'}>
              {algError
                ? tr(algErrorText(algError, puzzle))
                : tr({ zh: '回车出题;下一题 = 同一条公式换个起点。', en: 'Enter deals; Next challenge re-rolls the start position.' })}
            </p>
          </div>
        )}

        {source === 'random' && (
          <label className="predict-control">
            <span>{tr({ zh: '步数', en: 'Length' })}</span>
            <select
              className="predict-select"
              value={Math.min(Math.max(moveCount, MOVE_COUNT_MIN), puzzle.moveCountMax)}
              onChange={(e) => void setMoveCount(Number(e.target.value))}
            >
              {Array.from({ length: puzzle.moveCountMax }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}

        {puzzle.cubeLike && (
          <label className="predict-control">
            <span>{tr({ zh: '朝向', en: 'Holding' })}</span>
            <CubeOrientationSelect
              className="predict-select"
              value={orientation}
              onChange={(v) => void setOrientation(v)}
            />
          </label>
        )}

        <BoolToggle
          className="predict-transparent"
          value={transparent}
          onChange={(v) => void setTransparent(v)}
          label={tr({ zh: '透明', en: 'Transparent' })}
        />
      </div>

      <div className="predict-boardcol">
        <div className="predict-stage">
          <PredictBoard
            key={puzzleId}
            puzzle={puzzle}
            labels={labels}
            bright={bright}
            dim={dim}
            onSticker={onSticker}
            moves={ch?.moves}
            step={step}
            transparent={transparent}
            viewResetSeq={viewResetSeq}
          />
          <div className="predict-clock" aria-live="off">{clock(elapsed)}</div>
          {feedback?.kind === 'wrong' && (
            <div className="predict-feedback predict-wrong" role="alert">
              <X size={120} strokeWidth={3} aria-hidden="true" />
              <span className="predict-sr">{tr({ zh: '点错了', en: 'Wrong square' })}</span>
            </div>
          )}
          {feedback?.kind === 'correct' && (
            <div className="predict-feedback predict-correct" role="status">
              <Check size={120} strokeWidth={3} aria-hidden="true" />
              <span className="predict-sr">{tr({ zh: '点对了', en: 'Correct square' })}</span>
            </div>
          )}
        </div>

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
      </div>

      <section className="predict-moves">
        <ol className="predict-move-list">
          {ch?.moves.map((m, i) => {
            // 金字塔 / 斜转 / 枫叶的记号是顶点、不是面,给它上「面色」会误导 —— 那就不上色。
            const letter = puzzle.moveFace(m);
            const face = letter ? shown[puzzle.faceColor[letter]] : null;
            // 已经转过的压暗,刚做完的那一步描一圈(= step - 1,与 /recon、/sim 同一口径)。
            const state = step === 0 ? '' : i === step - 1 ? 'is-current' : i < step ? 'is-done' : '';
            return (
              <li key={`${i}-${m}`}>
                <button
                  type="button"
                  className={`predict-move${face ? '' : ' is-plain'}${state ? ` ${state}` : ''}`}
                  style={face ? { background: PREDICT_FILL[face], color: PREDICT_ON_FILL[face] } : undefined}
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
        {/* 这里原来还有一排「U: 上(白)…」的面色图例。场景里六个面各浮着自己的字母、
            公式按钮本身就是面色,图例只是把同一件事再写一遍,撤掉。 */}
      </section>

      <div className="predict-prompt">
        {promptGroups.map((g) => {
          const color = faceColorOf(g.colorFace);
          const piece = TRACK_LABELS[g.kind];
          const done = g.done === g.total;
          return (
            <p key={g.key} className={done ? 'is-found' : undefined}>
              {done && <Check size={15} aria-hidden="true" />}
              {tr({
                zh: g.total > 1 ? `点击${g.total}条高亮${piece.zh}上的` : `点击高亮${piece.zh}上的`,
                en: 'Click where the ',
              })}
              <b className="predict-color" style={{ background: PREDICT_FILL[color], color: PREDICT_ON_FILL[color] }}>
                {colorChipLabel(color)}
              </b>
              {tr({
                zh: g.total > 1 ? '最终落到的格子(顺序不限)。' : '最终落到的那一格。',
                en: g.total > 1
                  ? ` stickers on the ${g.total} highlighted ${piece.en.toLowerCase()}s end up (any order).`
                  : ` sticker of the highlighted ${piece.en.toLowerCase()} ends up.`,
              })}
            </p>
          );
        })}
        {solved && (
          <p className="predict-done">
            {tr({ zh: `全对!用时 ${clock(elapsed)}`, en: `Solved in ${clock(elapsed)}` })}
          </p>
        )}
        {revealed && ch && (
          <div className="predict-answer">
            <span className="predict-answer-tag">{tr({ zh: '答案', en: 'Answer' })}</span>
            {ch.targets.map((t) => {
              const color = faceColorOf(t.colorFace);
              const face = puzzle.faces[Math.floor(t.answerFacelet / puzzle.perFace)];
              return (
                <span key={`${t.kind}-${t.startFacelet}`} className="predict-answer-item">
                  <b className="predict-color" style={{ background: PREDICT_FILL[color], color: PREDICT_ON_FILL[color] }}>
                    {colorChipLabel(color)}
                  </b>
                  <ArrowRight size={13} aria-hidden="true" />
                  {face} {tr(puzzle.faceName[face])}
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
        <button
          type="button"
          className="predict-reveal"
          onClick={reveal}
          disabled={!ch || solved || revealed}
          aria-label={tr({ zh: '显示答案', en: 'Show answer' })}
          title={tr({ zh: '显示答案', en: 'Show answer' })}
        >
          <Eye size={15} aria-hidden="true" />
        </button>
        <button type="button" className="predict-deal" onClick={() => deal()}>
          {tr({ zh: '下一题', en: 'Next challenge' })}
        </button>
      </div>

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
