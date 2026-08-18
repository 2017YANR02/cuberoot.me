'use client';

// Ported from packages/client-vite/src/pages/trainer/TrainerRunPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from '@/components/AppLink';
import { useParams, useRouter } from 'next/navigation';
import { parseAsString, useQueryState } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Settings, Copy, Check, QrCode, RotateCcw, X } from 'lucide-react';
import { ALG_CATALOG, getAlgSetMeta, loadAlg, type AlgCase } from '@cuberoot/shared';
import {
  useTrainerStore, TimerState, trainerPool, trainerScramblesReady, mixSessionId,
  completedRecapCount, type TrainerMode,
} from '@/lib/trainer-store';
import TimerFontPicker from '@/components/TimerFontPicker';
import { useSpaceHoldTimer } from '@/hooks/useSpaceHoldTimer';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { useGestureWheel } from '@/hooks/useGestureWheel';
import { useCopy } from '@/hooks/useCopy';
import { shouldIgnoreTimerTarget } from '@/lib/timer-ignore-target';
import GestureWheel from '@/components/GestureWheel';
import BoolToggle from '@/components/BoolToggle';
import PillToggle from '@/components/PillToggle/PillToggle';
import AlgCaseMetaModal from '@/components/AlgCaseMetaModal';
import AlgPdfButton from '@/components/AlgPdfButton';
import { CaseThumb } from '@/components/CaseThumb';
import { caseKey, findCaseByKey } from '@/lib/trainer-case-key';
import { canonicalZbllSubgroupSlug } from '@/lib/alg_zbll_subgroups';
import { displayZbllToken } from '@/lib/alg_case_display';
import {
  availableKinds, purifyScramble, SCRAMBLE_KINDS, trainerSetScrambleFeatures,
  psf2lSlotPairsForSlots, replaceOuterDAdjustment,
  type F2LSlot, type ScrambleKind,
} from '@/lib/trainer-scramble';
import {
  preparePsf2lExtraScrambles,
  preparePsf2lSlotScrambles,
} from '@/lib/psf2l-extra-scramble';
import { MIX_SLUG, MIX_MIN_SETS, parseMixSets, mixTitle, mixHref, loadMixCases, setLabel } from '@/lib/alg-mix';
import { virtualAlgSet } from '@/lib/alg-virtual-sets';
import { useTrainerMarks, markStatus, type CaseMarkStatus } from '@/lib/trainer-marks';
import { ALG_SET_UNIVERSE } from '@/lib/alg_probability';
import {
  TimerDisplay, ScrambleHeader, SolveCard, StatsList, HistoryList, CaseMarkBar,
} from '@/app/[lang]/alg/_trainer/trainer-components';
import { RoomQrModal } from '@/components/RoomQrModal';
import { RoomCodeInput } from '@/components/RoomCodeInput';
import MemoryTrainer from '@/app/[lang]/alg/_trainer/MemoryTrainer';
import MixSetPicker from '@/app/[lang]/alg/_trainer/MixSetPicker';
import SmartCubeRow from '@/app/[lang]/alg/_trainer/SmartCubeRow';
import OrientationPicker from '@/app/[lang]/alg/_trainer/OrientationPicker';
import TrainerLiveCube from '@/app/[lang]/alg/_trainer/TrainerLiveCube';
import TrainerSplitScreen from './TrainerSplitScreen';
import { useTrainerCube } from '@/app/[lang]/alg/_trainer/useTrainerCube';
import { puzzleHasSmartCube } from '@/app/[lang]/alg/_trainer/smartcube';
import { resolveAlgPuzzle } from '@/app/[lang]/alg/_trainer/events';
import { useAlgSrs, autoMarkFromSrs } from '@/lib/alg-srs-store';
import { useAlgSweep } from '@/lib/alg-sweep-store';
import { gradeFromSolve } from '@/lib/alg-srs';
import { trainerSheetFromCases } from '@/lib/alg_pdf/from_trainer';
import {
  createTrainingEvidenceEventId,
  parseTrainingAssignmentDestination,
  startTrainingEvidenceOutbox,
  submitTrainingEvidence,
} from '@/lib/training-evidence';
import '@/app/[lang]/alg/_trainer/trainer.css';
import '@/app/[lang]/alg/_trainer/memory.css';
import '@/app/[lang]/alg/alg.css';
import { tr } from '@/i18n/tr';
import { Spinner } from '@/components/Spinner/Spinner';

/** 顶层只区分动作训练与间隔记忆;训练内部再选覆盖或随机抽题。 */
const PRIMARY_MODES: Array<{ id: 'train' | 'memo'; zh: string; en: string }> = [
  { id: 'train', zh: '训练', en: 'Train' },
  { id: 'memo', zh: '记忆', en: 'Memory' },
];

const TIMER_DELAY_MS = 0;

const SPLIT_SCREEN_QUERY = '(min-width: 768px) and (min-height: 600px)';
const splitScreenServerSnapshot = () => false;
const splitScreenSnapshot = () => window.matchMedia(SPLIT_SCREEN_QUERY).matches;
const subscribeSplitScreen = (onChange: () => void) => {
  const media = window.matchMedia(SPLIT_SCREEN_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

/** Split view deliberately excludes phones, including wide landscape phones. */
function useSplitScreenAvailable(): boolean {
  return useSyncExternalStore(subscribeSplitScreen, splitScreenSnapshot, splitScreenServerSnapshot);
}

const F2L_SLOT_GRID: readonly F2LSlot[] = ['BL', 'BR', 'FL', 'FR'];

function SlotChoicePicker<T extends string>({
  label,
  ariaLabel,
  choices,
  selected,
  minimumSelected,
  keepMinimumTitle,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  choices: readonly T[];
  selected: readonly T[];
  minimumSelected: number;
  keepMinimumTitle: string;
  onChange: (choices: readonly T[]) => void;
}) {
  return (
    <div className="trainer-opts-row">
      <span className="trainer-opts-label">{label}</span>
      <div
        className="trainer-ori-cells trainer-slot-cells"
        role="group"
        aria-label={ariaLabel}
      >
        {choices.map(choice => {
          const isSelected = selected.includes(choice);
          const atMinimum = isSelected && selected.length <= minimumSelected;
          return (
            <button
              key={choice}
              type="button"
              className={`trainer-ori-cell trainer-slot-cell${isSelected ? ' is-on' : ''}`}
              aria-pressed={isSelected}
              disabled={atMinimum}
              title={atMinimum ? keepMinimumTitle : undefined}
              onClick={() => onChange(
                isSelected
                  ? selected.filter(value => value !== choice)
                  : [...selected, choice],
              )}
            >
              {choice}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function F2LSlotPicker({
  slots,
  minimumSelected = 1,
  ariaLabel = tr({ zh: 'F2L 槽位', en: 'F2L slots' }),
  onChange,
}: {
  slots: readonly F2LSlot[];
  minimumSelected?: 1 | 2;
  ariaLabel?: string;
  onChange: (slots: readonly F2LSlot[]) => void;
}) {
  return (
    <SlotChoicePicker
      label={tr({ zh: '槽位', en: 'Slots' })}
      ariaLabel={ariaLabel}
      choices={F2L_SLOT_GRID}
      selected={slots}
      minimumSelected={minimumSelected}
      keepMinimumTitle={minimumSelected === 2
        ? tr({ zh: '至少保留两个槽位', en: 'Keep at least two slots' })
        : tr({ zh: '至少保留一个槽位', en: 'Keep at least one slot' })}
      onChange={onChange}
    />
  );
}

export default function TrainerRunClient() {
  const params = useParams<{ puzzle: string; set: string }>();
  const puzzleParam = (Array.isArray(params?.puzzle) ? params.puzzle[0] : params?.puzzle) ?? '';
  const setSlug = (Array.isArray(params?.set) ? params.set[0] : params?.set) ?? '';
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const router = useRouter();
  const splitScreenAvailable = useSplitScreenAvailable();

  // 训练范围:subgroup 页的训练按钮带 ?scope=<组slug> 进来,只练该组(筛选/默认 replace)
  const [scopeParam, setScopeParam] = useQueryState(
    'scope',
    parseAsString.withOptions({ history: 'push' }),
  );
  // 旧数字制子组 slug(u1 / pi 1 / as1 …)→ 新方向制(ur / pif / asf …),老 ?scope= 链接 / 书签不失效(migration 0081)
  // 合练没有子组范围可言(?scope= 是某一套内部的分组),一律忽略
  const scopeSlug = setSlug === MIX_SLUG
    ? null
    : canonicalZbllSubgroupSlug(setSlug, scopeParam?.trim().toLowerCase() || null);

  // 房间邀请码:创建/加入房间后写进 ?room=CODE,地址栏本身即分享链接;别人打开该链接
  // → session 载好后自动加入(见下方 effect)。离开房间清空。
  const [roomParam, setRoomParam] = useQueryState('room');
  const autoJoinRef = useRef(false);
  // 邀请链接携带创建者的视图偏好:?multi=1 = 三条一屏(依赖不计时)。进房间后应用一次。
  const [multiParam] = useQueryState('multi');
  const viewApplied = useRef(false);
  // 深链模式:进度总览页的「复习 N」直接带 ?mode=memo 进来。只应用一次,之后用户自己切不再被覆盖。
  const [modeParam] = useQueryState('mode');
  const modeApplied = useRef(false);
  // 单设备分屏是大视图状态,进历史栈；分享 URL 也能直接恢复同一视图。
  const [splitParam, setSplitParam] = useQueryState(
    'split',
    parseAsString.withOptions({ history: 'push' }),
  );

  const puzzle = resolveAlgPuzzle(puzzleParam);   // 接受 event code(333)或 legacy puzzle 名(3x3)

  /**
   * 虚拟集(LSLL):case 不在 alg 库里、由前端现算,但练法与库内集完全一致 —— 只把
   * 「case 从哪来 / 选 case 去哪 / 打乱怎么算」三处换成它自己的(见 lib/alg-virtual-sets)。
   */
  const virtual = useMemo(() => (puzzle ? virtualAlgSet(puzzle, setSlug) : undefined), [puzzle, setSlug]);
  const virtualScope = virtual ? (scopeParam?.trim().toLowerCase() || null) : null;

  // 分轮次的范围(LSLL 已收录:302 条一轮、494 轮):轮次名贴在复习进度前面,
  // 「本轮结束」的主按钮是**下一轮的 URL** —— 换 scope 就是换一场,那批 case 全换了
  // 新的收尾 ZBLL,不是重洗同一批。ref 给键盘用(弹窗里回车 = 点主按钮)。
  const roundLabel = virtual?.roundLabel?.(virtualScope) ?? null;
  const roundNumber = virtual?.roundNumber?.(virtualScope) ?? null;
  const totalRounds = virtual?.totalRounds ?? null;
  const [roundDraft, setRoundDraft] = useState('');
  // Escape 会主动 blur；用 ref 跳过紧随其后的 onBlur 提交，避免闭包仍读到
  // Escape 前的有效数字并意外跳到那一轮。
  const cancelRoundBlurRef = useRef(false);
  useEffect(() => {
    if (roundNumber != null) setRoundDraft(String(roundNumber));
  }, [roundNumber]);
  const commitRoundDraft = () => {
    if (cancelRoundBlurRef.current) {
      cancelRoundBlurRef.current = false;
      return;
    }
    if (!roundNumber || !totalRounds || !virtual?.scopeForRound) return;
    const nextRound = Number(roundDraft);
    if (!Number.isInteger(nextRound) || nextRound < 1 || nextRound > totalRounds) {
      setRoundDraft(String(roundNumber));
      return;
    }
    setRoundDraft(String(nextRound));
    if (nextRound !== roundNumber) void setScopeParam(virtual.scopeForRound(nextRound));
  };
  const nextRoundScope = virtual?.nextRoundScope?.(virtualScope) ?? null;
  const nextRoundHref = nextRoundScope
    ? `/alg/${puzzleParam}/${setSlug}/run?scope=${encodeURIComponent(nextRoundScope)}`
    : null;
  const nextRoundHrefRef = useRef<string | null>(null);
  nextRoundHrefRef.current = nextRoundHref;

  // 合练:`/alg/<puzzle>/mix/run?sets=pll,zbll` —— mix 是哨兵段,成员集合在 query 里
  const [setsParam] = useQueryState('sets');
  const isMix = setSlug === MIX_SLUG;
  const mixSets = useMemo(
    () => (isMix ? parseMixSets(puzzle ?? null, setsParam) : []),
    [isMix, puzzle, setsParam],
  );
  const mixReady = isMix && mixSets.length >= MIX_MIN_SETS;
  // 必须 memo:合练的 meta 是现造的字面量,身份每次 render 都变,而它进了下面装载
  // effect 的依赖 —— 不 memo 就是「effect → set state → 新 meta → effect」的死循环。
  const meta = useMemo(() => (
    puzzle
      ? (isMix
          ? (mixReady ? { zh: mixTitle(puzzle, mixSets), en: mixTitle(puzzle, mixSets) } : undefined)
          : (getAlgSetMeta(puzzle, setSlug) ?? virtual?.meta))
      : undefined
  ), [puzzle, isMix, mixReady, mixSets, setSlug, virtual]);

  const cases = useTrainerStore(s => s.cases);
  const selected = useTrainerStore(s => s.selected);
  const scope = useTrainerStore(s => s.scope);
  // 朝向分组只看本场真会出的 case(勾选 ∩ 范围)—— 没勾的形状不该出现在选项里。
  // 摆在这儿(而不是用到它的地方)是因为下面有几处提前 return,hook 不能落在它们后面。
  const poolCases = useMemo(() => {
    const keys = new Set(trainerPool(selected, scope));
    return cases.filter(c => keys.has(caseKey(c)));
  }, [cases, selected, scope]);
  const solves = useTrainerStore(s => s.solves);
  const currentName = useTrainerStore(s => s.currentName);
  const currentKey = useTrainerStore(s => s.currentKey);
  const currentScramble = useTrainerStore(s => s.currentScramble);
  const peek = useTrainerStore(s => s.peek);
  const peek2 = useTrainerStore(s => s.peek2);
  // 标记快捷键的目标 = 卡片当前显示的 case(pillCase),用 ref 让 keydown 闭包读到最新值
  const pillKeyRef = useRef<string | null>(null);
  const hist = useTrainerStore(s => s.hist);
  const timerState = useTrainerStore(s => s.timerState);
  const timerStarted = useTrainerStore(s => s.timerStarted);
  const trainingDestinationRef = useRef<ReturnType<typeof parseTrainingAssignmentDestination>>(null);
  const previousTrainingTimerStateRef = useRef(timerState);
  const previousTrainingSolveCountRef = useRef(solves.length);
  const observingIdx = useTrainerStore(s => s.observingIdx);
  const scrambleKind = useTrainerStore(s => s.scrambleKind);
  const setScrambleKind = useTrainerStore(s => s.setScrambleKind);
  const storePuzzle = useTrainerStore(s => s.puzzle);
  const storeSet = useTrainerStore(s => s.set);
  const loadSession = useTrainerStore(s => s.loadSession);
  const loadMixSession = useTrainerStore(s => s.loadMixSession);
  const resolveCase = useTrainerStore(s => s.resolveCase);
  const caseResolveErrors = useTrainerStore(s => s.caseResolveErrors);
  const setScope = useTrainerStore(s => s.setScope);
  const hydratePrefs = useTrainerStore(s => s.hydratePrefs);
  const preAuf = useTrainerStore(s => s.preAuf);
  const setPreAuf = useTrainerStore(s => s.setPreAuf);
  const postAuf = useTrainerStore(s => s.postAuf);
  const setPostAuf = useTrainerStore(s => s.setPostAuf);
  const randomInitialD = useTrainerStore(s => s.randomInitialD);
  const setRandomInitialD = useTrainerStore(s => s.setRandomInitialD);
  const psf2lExtraScramble = useTrainerStore(s => s.psf2lExtraScramble);
  const setPsf2lExtraScramble = useTrainerStore(s => s.setPsf2lExtraScramble);
  const psf2lSlots = useTrainerStore(s => s.psf2lSlots);
  const setPsf2lSlots = useTrainerStore(s => s.setPsf2lSlots);
  const refreshPsf2lExtraScrambles = useTrainerStore(s => s.refreshPsf2lExtraScrambles);
  const randomFinalAuf = useTrainerStore(s => s.randomFinalAuf);
  const setRandomFinalAuf = useTrainerStore(s => s.setRandomFinalAuf);
  const f2lSlots = useTrainerStore(s => s.f2lSlots);
  const setF2LSlots = useTrainerStore(s => s.setF2LSlots);
  const oriSel = useTrainerStore(s => s.oriSel);
  const setOriSel = useTrainerStore(s => s.setOriSel);
  const resetOriSel = useTrainerStore(s => s.resetOriSel);
  const timing = useTrainerStore(s => s.timing);
  const setTiming = useTrainerStore(s => s.setTiming);
  const mode = useTrainerStore(s => s.mode);
  const setMode = useTrainerStore(s => s.setMode);
  const lastTrainingMode = useRef<Exclude<TrainerMode, 'memo'>>(mode === 'train' ? 'train' : 'recap');
  if (mode !== 'memo') lastTrainingMode.current = mode;
  const probMode = useTrainerStore(s => s.probMode);
  const setProbMode = useTrainerStore(s => s.setProbMode);
  const recapOrder = useTrainerStore(s => s.recapOrder);
  const setRecapOrder = useTrainerStore(s => s.setRecapOrder);
  const showRecapRoundEnd = useTrainerStore(s => s.showRecapRoundEnd);
  const setShowRecapRoundEnd = useTrainerStore(s => s.setShowRecapRoundEnd);
  const roundEndPromptRequired = useTrainerStore(s => s.roundEndPromptRequired);
  const restartRecapRound = useTrainerStore(s => s.restartRecapRound);
  const srsNewLimit = useTrainerStore(s => s.srsNewLimit);
  const setSrsNewLimit = useTrainerStore(s => s.setSrsNewLimit);
  const srsSessionLimit = useTrainerStore(s => s.srsSessionLimit);
  const setSrsSessionLimit = useTrainerStore(s => s.setSrsSessionLimit);
  const srsFillExtra = useTrainerStore(s => s.srsFillExtra);
  const setSrsFillExtra = useTrainerStore(s => s.setSrsFillExtra);
  const srsAutoMark = useTrainerStore(s => s.srsAutoMark);
  const setSrsAutoMark = useTrainerStore(s => s.setSrsAutoMark);
  const srsFromSolves = useTrainerStore(s => s.srsFromSolves);
  const setSrsFromSolves = useTrainerStore(s => s.setSrsFromSolves);
  const room = useTrainerStore(s => s.room);
  const roomBusy = useTrainerStore(s => s.roomBusy);
  const roomError = useTrainerStore(s => s.roomError);
  const createRoom = useTrainerStore(s => s.createRoom);
  const joinRoom = useTrainerStore(s => s.joinRoom);
  const leaveRoom = useTrainerStore(s => s.leaveRoom);
  const { copied: codeCopied, copy: copyCode } = useCopy();
  const timerFont = useTrainerStore(s => s.timerFont);
  const setTimerFont = useTrainerStore(s => s.setTimerFont);
  const scrambleFont = useTrainerStore(s => s.scrambleFont);
  const setScrambleFont = useTrainerStore(s => s.setScrambleFont);
  const showPrevCard = useTrainerStore(s => s.showPrevCard);
  const setShowPrevCard = useTrainerStore(s => s.setShowPrevCard);
  const showStats = useTrainerStore(s => s.showStats);
  const setShowStats = useTrainerStore(s => s.setShowStats);
  const showStageThumb = useTrainerStore(s => s.showStageThumb);
  const setShowStageThumb = useTrainerStore(s => s.setShowStageThumb);
  const pureScramble = useTrainerStore(s => s.pureScramble);
  const setPureScramble = useTrainerStore(s => s.setPureScramble);
  const multiScramble = useTrainerStore(s => s.multiScramble);
  const setMultiScramble = useTrainerStore(s => s.setMultiScramble);
  const smartCube = useTrainerStore(s => s.smartCube);
  const setSmartCube = useTrainerStore(s => s.setSmartCube);
  const observingPinned = useTrainerStore(s => s.observingPinned);
  const pinObserving = useTrainerStore(s => s.pinObserving);
  const nextScramble = useTrainerStore(s => s.nextScramble);
  const prevScramble = useTrainerStore(s => s.prevScramble);
  const jumpToHist = useTrainerStore(s => s.jumpToHist);
  const recapRoundDone = useTrainerStore(s => s.recapRoundDone);
  const recapRoundAcked = useTrainerStore(s => s.recapRoundAcked);
  const continueRecapRound = useTrainerStore(s => s.continueRecapRound);
  const dismissRecapRound = useTrainerStore(s => s.dismissRecapRound);
  const getTimerReady = useTrainerStore(s => s.getTimerReady);
  const startTimer = useTrainerStore(s => s.startTimer);
  const stopTimer = useTrainerStore(s => s.stopTimer);
  const setTimerState = useTrainerStore(s => s.setTimerState);
  const setSolvePenalty = useTrainerStore(s => s.setSolvePenalty);
  const deleteSolve = useTrainerStore(s => s.deleteSolve);
  const clearSolves = useTrainerStore(s => s.clearSolves);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (timerState !== TimerState.RUNNING) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timerState]);

  useEffect(() => {
    const destination = parseTrainingAssignmentDestination(window.location.search);
    trainingDestinationRef.current = destination;
    return startTrainingEvidenceOutbox(destination);
  }, []);

  useEffect(() => {
    const previousTimerState = previousTrainingTimerStateRef.current;
    const previousSolveCount = previousTrainingSolveCountRef.current;
    previousTrainingTimerStateRef.current = timerState;
    previousTrainingSolveCountRef.current = solves.length;

    if (previousTimerState !== TimerState.RUNNING || timerState !== TimerState.STOPPING) return;
    if (solves.length !== previousSolveCount + 1) return;
    const solve = solves.at(-1);
    if (!puzzle || !solve || solve.i !== previousSolveCount || !Number.isFinite(solve.ms)) return;
    submitTrainingEvidence(trainingDestinationRef.current, {
      schemaVersion: 1,
      source: 'alg-trainer',
      sourceEventId: createTrainingEvidenceEventId('alg-trainer'),
      occurredAt: new Date().toISOString(),
      activity: 'algorithm_attempt',
      durationMs: Math.min(86_400_000, Math.max(0, Math.round(solve.ms))),
      metrics: { success: solve.penalty !== 'DNF' },
      payloadVersion: 1,
      payload: {
        puzzle,
        set: setSlug,
        caseKey: solve.caseKey,
        mode,
      },
    });
  }, [mode, puzzle, setSlug, solves, timerState]);

  // 偏好(pre-AUF / 计时 / 模式 / 字体)只在挂载后补水 —— SSG 壳渲染默认值,避免水合不一致
  useEffect(() => { hydratePrefs(); }, [hydratePrefs]);

  // SSG 壳里读不到 `?sets=`(静态 HTML 没有 query),挂载前别急着说「至少要选两套」
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // per-case 学习标记(pill / 轮盘掌握位 / M 键):本地 + 登录后云端合并。
  // 合练一次装齐全部成员集 —— 标记/记忆仍分别落各自 set,合练与单练是同一份进度。
  const loadMarks = useTrainerMarks(s => s.loadMarks);
  const loadMarksMulti = useTrainerMarks(s => s.loadMarksMulti);
  const loadSrs = useAlgSrs(s => s.loadSrs);
  const loadSrsMulti = useAlgSrs(s => s.loadSrsMulti);
  const mixKey = mixSets.join(',');   // effect 依赖用字符串,免得数组身份每次都变
  useEffect(() => {
    if (!puzzle || !meta) return;
    if (isMix) {
      const sets = mixKey.split(',').filter(Boolean);
      loadMarksMulti(puzzle, sets);
      loadSrsMulti(puzzle, sets);
      return;
    }
    loadMarks(puzzle, setSlug);
    // 记忆调度(间隔重复)与标记同源同步 —— 顶部进度条要显示「待复习」,不进记忆模式也得装
    loadSrs(puzzle, setSlug);
  }, [puzzle, setSlug, meta, isMix, mixKey, loadMarks, loadSrs, loadMarksMulti, loadSrsMulti]);

  // 虚拟集换范围(?scope=)= 换一整批 case,所以范围要进会话 id,否则装完一次就再也不重装
  const sessionId = isMix
    ? mixSessionId(mixKey.split(',').filter(Boolean))
    : (virtual && virtualScope ? `${setSlug}:${virtualScope}` : setSlug);
  useEffect(() => {
    if (!puzzle || !meta) return;
    if (storePuzzle === puzzle && storeSet === sessionId && cases.length > 0) return;
    if (isMix) {
      const sets = mixKey.split(',').filter(Boolean);
      loadMixCases(puzzle, sets)
        .then(all => loadMixSession(puzzle, sets, all))
        .catch(e => console.error('[trainer] loadMixCases failed', e));
      return;
    }
    if (virtual) {
      // 虚拟集没有 select 页可勾 —— 装进来的这一批就是本场
      virtual.loadCases(virtualScope)
        .then(cs => loadSession(puzzle, sessionId, cs, {
          defaultAll: true, caseResolver: virtual.resolveCase, noAufDefault: virtual.noAufDefault,
          roundEndPromptRequired: virtual.totalRounds != null,
        }))
        .catch(e => console.error('[trainer] virtual loadCases failed', e));
      return;
    }
    loadAlg(puzzle, setSlug)
      .then(async d => {
        if (puzzle === '3x3' && setSlug === 'psf2l') {
          await preparePsf2lSlotScrambles(d.cases, replaceOuterDAdjustment);
        }
        loadSession(puzzle, setSlug, d.cases);
      })
      .catch(e => console.error('[trainer] loadAlg failed', e));
  }, [puzzle, setSlug, sessionId, meta, isMix, mixKey, virtual, virtualScope,
      storePuzzle, storeSet, cases.length, loadSession, loadMixSession]);

  // 双槽位基态在 loadSession 前已准备；增强 PSF2L 的后缀还要按真实魔方状态筛选,
  // 放到后台继续准备。候选到位后立即重出当前题。
  useEffect(() => {
    if (puzzle !== '3x3' || setSlug !== 'psf2l' || isMix) return;
    if (storePuzzle !== puzzle || storeSet !== setSlug || cases.length === 0) return;
    let cancelled = false;
    loadAlg('3x3', 'f2l')
      .then(f2l => preparePsf2lExtraScrambles(cases, f2l.cases, replaceOuterDAdjustment))
      .then(() => {
        if (!cancelled) refreshPsf2lExtraScrambles();
      })
      .catch(e => console.error('[trainer] prepare PSF2L extra scrambles failed', e));
    return () => { cancelled = true; };
  }, [puzzle, setSlug, isMix, storePuzzle, storeSet, cases, refreshPsf2lExtraScrambles]);

  // 分享链接 ?room=CODE:本集 session 载好后自动加入该房间(仅一次;已在房间/正忙/无码则跳过)。
  // joinRoom 要求 store 已 loadSession 到对应 puzzle/set,故等 cases 到位再试;失败(房间不存在/
  // 过期/集不匹配)则清掉 URL 里的码并由 roomError 提示。
  useEffect(() => {
    if (!roomParam || room || roomBusy || autoJoinRef.current) return;
    if (storePuzzle !== puzzle || storeSet !== sessionId || cases.length === 0) return;
    autoJoinRef.current = true;
    // 失败(房间不存在/过期/集不匹配)不清 ?room —— 保留链接,由下方 landing 显示 roomError 并给出「去选择」出口。
    void joinRoom(roomParam);
  }, [roomParam, room, roomBusy, storePuzzle, storeSet, puzzle, sessionId, cases.length, joinRoom]);

  // 邀请链接的 ?multi=1:套用创建者的「三条一屏」视图(依赖不计时,一并关计时)。gate 在 roomParam
  // 而非已建立的 room —— 必须在自动 join 的 roomAdvance 领题之前就把视图就绪,否则会先按单条领题、
  // 切成三条一屏后 peek/peek2 为空只剩一条。只应用一次(viewApplied),之后用户自己改不再被覆盖。
  useEffect(() => {
    if (viewApplied.current || multiParam !== '1' || !roomParam) return;
    viewApplied.current = true;
    setTiming(false);
    setMultiScramble(true);
  }, [multiParam, roomParam, setTiming, setMultiScramble]);

  useEffect(() => {
    if (modeApplied.current) return;
    if (modeParam !== 'memo' && modeParam !== 'train' && modeParam !== 'recap') return;
    modeApplied.current = true;
    setMode(modeParam);
  }, [modeParam, setMode]);

  // scope slug → 该组全部 case key(与 AlgCategoryView 的 top/sub 两级匹配同一套约定)
  const scopedKeys = useMemo(() => {
    // 虚拟集的 ?scope= 决定的是「装哪一批 case」,装进来的整批就是范围,不用再筛一次
    if (virtual || !scopeSlug || cases.length === 0) return null;
    const parts = (c: AlgCase) => (c.subgroup || '').toLowerCase().split('/');
    const isTop = cases.some(c => parts(c)[0] === scopeSlug);
    const hit = cases.filter(c => (isTop ? parts(c)[0] : parts(c)[1]) === scopeSlug);
    return hit.length > 0 ? hit.map(caseKey) : null;
  }, [cases, scopeSlug, virtual]);

  useEffect(() => {
    setScope(scopedKeys);
  }, [scopedKeys, setScope]);

  // 记忆模式没勾选 case 时回落到本页可见的整套(有 scope 就是该组)。
  const allKeys = useMemo(() => cases.map(caseKey), [cases]);
  const memoScopeKeys = scopedKeys ?? allKeys;

  const pool = useMemo(() => trainerPool(selected, scope), [selected, scope]);

  /**
   * 选中的这批 case 一共支持哪几种打乱(并集)。只有一种(全是 `inv`)就不渲染选择器。
   * 不是每个 case 都有全套 —— 表里验不过轨道判据的打乱没入库,generateScramble 会退回 `inv`。
   * (必须在下面的 early return 之前 —— hooks 不能因「尚未选 case」而少跑。)
   */
  const kinds = useMemo(() => {
    const seen = new Set<ScrambleKind>();
    for (const k of pool) {
      const c = findCaseByKey(cases, k);
      if (c) for (const kind of availableKinds(c)) seen.add(kind);
    }
    // cstimer 风格 = 求解器现算随机态打乱,不依赖表 meta,3x3 一律可用(issue #30)。
    // 虚拟集的打乱本来就是求解器现算的随机态序列,再求一次解只是换个等价写法 —— 不给这个选项。
    if (puzzle === '3x3' && !virtual) seen.add('cstimer');
    // 金字塔:同状态的随机长打乱 + 随机顶层朝向(issue #64),本地求解器现算,一律可用。
    if (puzzle === 'pyraminx') seen.add('rand');
    return SCRAMBLE_KINDS.filter(k => seen.has(k.id));
  }, [pool, cases, puzzle, virtual]);

  // 分屏两条题道各自现算打乱；偏好与普通训练题面完全同源。
  const splitScrambleOpts = useMemo(() => {
    const features = trainerSetScrambleFeatures(puzzle, isMix ? null : setSlug);
    return {
      preAuf,
      postAuf,
      randomInitialD: features.randomInitialD && randomInitialD,
      psf2lExtraScramble: features.psf2lExtraScramble && psf2lExtraScramble,
      psf2lSlotPairs: features.psf2lSlots ? psf2lSlotPairsForSlots(psf2lSlots) : undefined,
      psf2lFaceTurnsOnly: features.psf2lExtraScramble,
      randomFinalAuf: features.randomFinalAuf && randomFinalAuf,
      f2lSlots: features.f2lSlots ? f2lSlots : undefined,
      orientation: oriSel,
      orientationSet: isMix ? null : setSlug,
    };
  }, [puzzle, isMix, setSlug, preAuf, postAuf, randomInitialD, psf2lExtraScramble,
      psf2lSlots,
      randomFinalAuf, f2lSlots, oriSel]);

  // 改了选中的 case 之后,原先选的那种打乱可能一个 case 都不再支持 —— 此时 <select> 的
  // value 落空、显示成一片空白。退回 `inv`(它永远支持)。
  // pool 为空(还没选 case / cases 未加载)时 kinds 只是过渡态(仅 cstimer),此时 htm 尚未
  // 「入列」不代表不被支持 —— 据此重置会把默认 htm 误打回 inv,且之后 htm 可用也不再扶回。
  // 金字塔的默认是 `rand`(setup 原文太短,念一遍等于背答案 —— issue #64),不是 `inv`。
  useEffect(() => {
    if (pool.length === 0) return;
    if (kinds.length && !kinds.some(k => k.id === scrambleKind)) {
      setScrambleKind(puzzle === 'pyraminx' ? 'rand' : 'inv');
    }
  }, [kinds, scrambleKind, setScrambleKind, pool.length, puzzle]);

  useEffect(() => {
    // 读 live 状态而不是闭包值:setScope 的 effect 可能在同一个 commit 里已经出过题了,
    // 闭包里的 currentName 还是 null —— 直接再出一题会在历史开头塞进一条幽灵记录。
    const st = useTrainerStore.getState();
    // 房间模式的出题由 store 自己驱动(建房 / 加入 / 开下一轮各自领题),而领取是异步的:
    // 建房那一刻 current 被清空、claim 还在飞,这里若插一脚就会白领一格 —— 那一格谁也不做,
    // 全队这一轮凭空少一题。(旧代码靠 roomBusy 把这次误触吞掉,现在连点不再丢,得从源头拦。)
    if (st.room) return;
    if (cases.length > 0 && pool.length > 0 && st.currentName === null) {
      nextScramble();
    }
  }, [cases.length, pool.length, currentName, nextScramble]);

  // 三条一屏(仅不计时模式):屏上第 2、3 条就是 store 预抽的 peek / peek2,所以「切下一屏」
  // = 连推 3 格 —— 新一屏是全新的三条,每条照常进历史(← 仍能逐条回看)。
  // 监听器常驻不重订阅,用 ref 读当次最新值。
  const multiRef = useRef(false);
  multiRef.current = multiScramble && !timing;
  // 「换到下一题」= 这题做完了:还没打过任何标记的,默认落成「已掌握」。只动「未学」——
  // 手动标过的一律不覆盖,做炸了由 SRS 的自动降级打回「不熟」。
  // 挂在前进这一个出口上(← 回看、进页首次出题都不经过这里,所以不会误标)。
  const autoMasterRef = useRef(false);
  autoMasterRef.current = mode !== 'memo';
  const markPassedAsMastered = useCallback((keys: Array<string | null | undefined>) => {
    if (!autoMasterRef.current) return;
    const mk = useTrainerMarks.getState();
    const fresh = [...new Set(keys.filter((k): k is string => !!k))]
      .filter(k => !markStatus(mk.marks, k));
    if (fresh.length > 0) mk.applyMarks(fresh, { s: 'mastered' });
  }, []);
  const advanceScramble = useCallback(() => {
    const n = multiRef.current ? 3 : 1;
    const st = useTrainerStore.getState();
    // 三条一屏必须三条全部就绪才整屏推进;单条只等当前题。先拦再自动标记,
    // 否则点加载中的空白也会被误记成「已掌握」。store.nextScramble 另有单题兜底。
    if (!trainerScramblesReady(st, n)) return;
    {
      // 三条一屏:走掉的是屏上那三条(当前 + 预抽的 peek / peek2),三条一起标。
      markPassedAsMastered(multiRef.current
        ? [st.currentKey, st.peek?.key, st.peek2?.key]
        : [st.currentKey]);
    }
    // 房间协同:领取是异步网络往返,连调 nextScramble 会被 roomBusy 串行化吞掉后两次 ——
    // 交给单一 roomAdvance(n) 内部按序 await 领 n 步(三条一屏 = 切下一屏三条)。
    if (st.room) { void st.roomAdvance(n); return; }
    for (let i = 0; i < n; i++) nextScramble();
  }, [nextScramble]);

  /** 邀请二维码弹窗(建房后自动弹一次)。 */
  const [qrOpen, setQrOpen] = useState(false);
  /** case 详情弹窗(卡片的图 / 名字 / 历史条目点开)。 */
  const [metaCase, setMetaCase] = useState<AlgCase | null>(null);
  /**
   * 有弹层盖着:计时和全局按键一律让位 —— 空格别在背后起表,←/→ 别在背后翻题。
   * 声明在计时 / 键盘之前,它俩要读它。
   */
  const overlayOpen = qrOpen || metaCase != null;
  const overlayOpenRef = useRef(false);
  overlayOpenRef.current = overlayOpen;

  // Space-bar timing (keyboard). Touch/mouse press-to-time is handled by the
  // gesture-wheel hook below so a press can also drive the radial dial.
  // 记忆模式自己接管全部键盘/指针(空格 = 揭示公式,1-4 = 评分),这里的计时与手势一律让位。
  const isMemo = mode === 'memo';
  const isMemoRef = useRef(false);
  isMemoRef.current = isMemo;
  const splitEligible = splitParam === '1' && splitScreenAvailable && !room && pool.length >= 2;
  const splitActive = splitEligible && !isMemo;
  const splitActiveRef = useRef(false);
  splitActiveRef.current = splitActive;

  // 直接打开 / 分享 ?split=1 也必须落到与手动开关相同的稳定配置，不能只靠点击事件校正。
  useEffect(() => {
    if (!splitEligible) return;
    if (mode !== 'recap') {
      lastTrainingMode.current = 'recap';
      setMode('recap');
    }
    if (timing) setTiming(false);
    if (smartCube) setSmartCube(false);
  }, [splitEligible, mode, timing, smartCube,
      setMode, setTiming, setSmartCube]);

  useSpaceHoldTimer({
    state: timerState,
    delayMs: TIMER_DELAY_MS,
    // 「本轮结束」/ 二维码 / case 详情弹窗开着时别让空格误起表
    enabled: timing && !recapRoundDone && !isMemo && !splitActive && !overlayOpen,
    getTimerReady,
    startTimer,
    stopTimer,
    setNotRunning: () => setTimerState(TimerState.NOT_RUNNING),
  });

  // ←/→ 打乱历史(同 /timer);不计时模式下空格也直接切下一个打乱。
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isMemoRef.current) return;   // 记忆模式的键盘在 MemoryTrainer 里
      if (splitActiveRef.current) return; // 分屏两边各用自己的「完成」按钮,全局快捷键不抢题
      if (overlayOpenRef.current) return;   // 弹窗盖着,空格/方向键别在背后翻题(Esc 归弹窗)
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT' || target.isContentEditable)) return;
      // 「本轮结束」弹窗开着时:回车/空格/→ 进下一轮,其余键一律吞掉(别打标记/翻历史)
      const st0 = useTrainerStore.getState();
      if (st0.recapRoundDone) {
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'ArrowRight') {
          e.preventDefault();
          // 分轮次的范围:「下一轮」是换一批 case(换 URL),不是重洗本轮
          if (nextRoundHrefRef.current) router.push(nextRoundHrefRef.current);
          else st0.continueRecapRound();
        } else if (e.code === 'Escape') {
          // 单机:Esc = 「先不了」,停在最后这题;房间没这个选项,仍等同「继续下一轮」
          e.preventDefault();
          if (st0.room) st0.continueRecapRound(); else st0.dismissRecapRound();
        }
        return;
      }
      if (e.code === 'ArrowLeft') { e.preventDefault(); prevScramble(); return; }
      if (e.code === 'ArrowRight') { e.preventDefault(); advanceScramble(); return; }
      // 1、2:直接给卡片当前 case 打标记(1 不熟 / 2 已掌握);再按同键取消。
      // 卡片上不摆「已掌握」按钮(过了就自动算,见 CaseMarkBar),但 2 仍然有效 ——
      // 那是把已标「不熟」的 case 直接提成「已掌握」的快捷路径。
      if (!e.repeat && (e.code === 'Digit1' || e.code === 'Digit2')) {
        const st = useTrainerStore.getState();
        if (st.timerState !== TimerState.NOT_RUNNING && st.timerState !== TimerState.STOPPING) return;
        const k = pillKeyRef.current;
        if (!k) return;
        e.preventDefault();
        const mk = useTrainerMarks.getState();
        const target: CaseMarkStatus = e.code === 'Digit1' ? 'learning' : 'mastered';
        mk.applyMarks([k], { s: markStatus(mk.marks, k) === target ? null : target });
        return;
      }
      if (e.code === 'Space' && !useTrainerStore.getState().timing) {
        e.preventDefault();
        if (!e.repeat) advanceScramble();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [prevScramble, advanceScramble]);

  // ── Radial gesture wheel (shared with /timer) ───────────────────
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  // 邀请链接 = 当前页 URL + ?room=CODE(队友粘到浏览器 / 扫码打开即自动加入本房间)。
  // 当前在用三条一屏(不计时)时带上 ?multi=1,让队友打开也套用同一视图。复制与二维码同一份。
  const roomInviteUrl = useCallback((): string | null => {
    if (typeof window === 'undefined' || !room) return null;
    const u = new URL(window.location.href);
    u.searchParams.set('room', room.code);
    if (multiScramble && !timing) u.searchParams.set('multi', '1');
    else u.searchParams.delete('multi');
    return u.toString();
  }, [room, multiScramble, timing]);
  const copyRoomLink = useCallback(() => {
    const url = roomInviteUrl();
    if (url) copyCode(url);
  }, [roomInviteUrl, copyCode]);

  // 房间码输满即加入;成功后清输入框并把码写进 ?room=,使地址栏成为可分享链接。
  const joinWithCode = useCallback((rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (code.length !== 5 || roomBusy) return;
    void joinRoom(code).then(r => { if (r.ok) { setJoinCode(''); void setRoomParam(code.toUpperCase()); } });
  }, [joinRoom, roomBusy, setRoomParam]);

  // 齿轮设置弹出面板(训练选项全收在里面),点外部关闭。
  // 监听 pointerdown 而非 mousedown:stage 手势层在 pointerdown 里 preventDefault,
  // 会抑制后续的兼容性 mousedown —— 挂 mousedown 的话点 stage 空白永远关不上。
  const optsRef = useRef<HTMLDivElement | null>(null);
  const optsPanelRef = useRef<HTMLDivElement | null>(null);
  const [optsOpen, setOptsOpen] = useState(false);
  // 空白按压处理器(下方)是常驻监听、不随 optsOpen 重订阅 —— 用 ref 让它读到当次最新值。
  const optsOpenRef = useRef(false);
  optsOpenRef.current = optsOpen;
  usePanelClamp(optsOpen, optsPanelRef);
  useEffect(() => {
    if (!optsOpen) return;
    const handler = (e: PointerEvent) => {
      if (optsRef.current && !optsRef.current.contains(e.target as Node)) setOptsOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [optsOpen]);
  // 房间模式题面由服务端队列领取,本机 selected 可空(经邀请链接进来的新设备)—— 不算「未选」。
  const stageMounted = !!(puzzle && meta) && !isMemo && !splitActive
    && !(pool.length === 0 && cases.length > 0 && !room);

  /** meta.no → case:元数据弹窗里的镜像 / 逆链接用(同 AlgCategoryView) */
  const byNo = useMemo(() => {
    const m = new Map<number, AlgCase>();
    for (const c of cases) if (c.meta?.no != null) m.set(c.meta.no, c);
    return m;
  }, [cases]);

  // index: 0 next · 1 OK · 2 +2 · 3 DNF · 4 prev · 5 掌握 · 6 del · 7 copy
  // 4/5 原是「看上次/看下次」(翻成绩) —— 与 /timer 对齐改为「上一个」= 上一条打乱
  //(同 ← 键),「看下次」与「下一个」语义重复,删(issue #30)。
  // 5 = 当前 case 标「已掌握」(已掌握则降回不熟),计时流程中手不离开就能标。
  const wheelLabels = [
    tr({ zh: '下一个', en: 'Next' }),
    'OK', '+2', 'DNF',
    tr({ zh: '上一个', en: 'Prev' }),
    tr({ zh: '掌握', en: 'Got it' }),
    tr({ zh: '删除', en: 'Del' }),
    tr({ zh: '复制', en: 'Copy' }),
  ];

  const { wheelRef } = useGestureWheel({
    surfaceRef: stageRef,
    active: stageMounted,
    // 计时面板内也有按钮(标记条等)— 按它们不应触发按压计时(否则点了直接开始计时)。
    // 设置面板开着时整个 stage 也一并跳过:面板外那一下只该关面板,不该切打乱 / 起表。
    ignoreTarget: (t) => optsOpenRef.current || shouldIgnoreTimerTarget(t),
    canGesture: () => {
      const st = useTrainerStore.getState().timerState;
      return st === TimerState.NOT_RUNNING || st === TimerState.STOPPING;
    },
    enabledFor: () => {
      const st = useTrainerStore.getState();
      const hasLast = st.solves.length > 0;
      return [
        st.timerState === TimerState.NOT_RUNNING
          && trainerScramblesReady(st, multiRef.current ? 3 : 1),
        hasLast, hasLast, hasLast,
        st.hist.idx > 0,
        !!st.currentKey,
        hasLast,
        !!st.currentScramble,
      ];
    },
    fireAction: (i) => {
      const st = useTrainerStore.getState();
      const lastIdx = st.solves.length - 1;
      const last = st.solves[lastIdx];
      switch (i) {
        case 0: if (st.timerState === TimerState.NOT_RUNNING) advanceScramble(); break;
        case 1: if (last) setSolvePenalty(lastIdx, 'ok'); break;
        case 2: if (last) setSolvePenalty(lastIdx, last.penalty === '+2' ? 'ok' : '+2'); break;
        case 3: if (last) setSolvePenalty(lastIdx, last.penalty === 'DNF' ? 'ok' : 'DNF'); break;
        case 4: prevScramble(); break;
        case 5: {
          const k = st.currentKey;
          if (!k) break;
          const mk = useTrainerMarks.getState();
          mk.applyMarks([k], { s: markStatus(mk.marks, k) === 'mastered' ? 'learning' : 'mastered' });
          break;
        }
        case 6: if (last) deleteSolve(lastIdx); break;
        case 7: {
          // 复制的是**屏幕上那一份**:开了纯打乱就复制剥净后的文本。
          const raw = st.currentScramble;
          const scr = raw && st.pureScramble ? purifyScramble(puzzle, raw) : raw;
          if (scr && typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(scr).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            }).catch(() => {});
          }
          break;
        }
      }
    },
    onPressDown: () => {
      if (!useTrainerStore.getState().timing) return;
      const st = useTrainerStore.getState().timerState;
      if (st === TimerState.RUNNING) stopTimer();
      else if (st === TimerState.NOT_RUNNING) getTimerReady(TIMER_DELAY_MS);
    },
    onPressUp: () => {
      // 不计时模式:单击(未拖动)= 下一个打乱(三条一屏时 = 下一屏三条)
      if (!useTrainerStore.getState().timing) { advanceScramble(); return; }
      const st = useTrainerStore.getState().timerState;
      if (st === TimerState.READY) startTimer();
      else if (st === TimerState.AWAITING_READY || st === TimerState.STOPPING) setTimerState(TimerState.NOT_RUNNING);
    },
    onArmCancel: () => {
      const st = useTrainerStore.getState().timerState;
      if (st === TimerState.READY || st === TimerState.AWAITING_READY) setTimerState(TimerState.NOT_RUNNING);
    },
  });

  // stage 之外的页面空白(顶栏边缘、栏间留白、内容下方的 body)也当按压面:
  // 计时开 = 同空格按住/松开;计时关 = 单击直接下一个。sidebar(看成绩要点来点去)、
  // 弹窗、轮盘与一切交互控件除外;不 preventDefault,移动端滚动不受影响(轮盘手势仍只在 stage 内)。
  useEffect(() => {
    const isBlank = (t: EventTarget | null): boolean => {
      if (shouldIgnoreTimerTarget(t)) return false;
      if (!(t instanceof Element)) return false;
      return t.closest('.trainer-stage, .trainer-sidebar, .alg-admin-modal-backdrop, .gesture-wheel, .room-qr-backdrop, .trainer-round-modal-backdrop') === null;
    };
    let pressed = false;
    const down = (e: PointerEvent) => {
      if (isMemoRef.current) return;   // 记忆模式没有「点空白 = 下一题」这回事
      if (splitActiveRef.current) return; // 分屏空白不推进任一方,避免归属不明
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // 设置面板开着时,面板外的按压只该关面板 —— 不该顺带切打乱/触发计时。
      if (optsOpenRef.current) return;
      if (!isBlank(e.target)) return;
      pressed = true;
      if (!useTrainerStore.getState().timing) return;
      const st = useTrainerStore.getState().timerState;
      if (st === TimerState.RUNNING) stopTimer();
      else if (st === TimerState.NOT_RUNNING) getTimerReady(TIMER_DELAY_MS);
    };
    const up = () => {
      if (!pressed) return;
      pressed = false;
      if (!useTrainerStore.getState().timing) { advanceScramble(); return; }
      const st = useTrainerStore.getState().timerState;
      if (st === TimerState.READY) startTimer();
      else if (st === TimerState.AWAITING_READY || st === TimerState.STOPPING) setTimerState(TimerState.NOT_RUNNING);
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('pointerup', up);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
    };
  }, [advanceScramble, stopTimer, getTimerReady, startTimer, setTimerState]);

  /**
   * 计时成绩也算一次「复习」—— 手上做出来了就是记得住,这一把该喂回记忆调度里,
   * 否则计时练一整晚,记忆模式明天还当你没碰过。
   *
   * 去重:只有**当前到期**(或从没练过)的 case 才计分。同一个 case 在一场里连做十把,
   * 第一把之后它已经被排到未来了,后面九把不再改期 —— 这正是间隔重复要的语义。
   * 快慢基线取本场全部成功成绩的中位数(见 gradeFromSolve)。
   */
  const gradeSrs = useAlgSrs(s => s.grade);
  const lastGradedSolve = useRef(-1);
  useEffect(() => {
    if (!srsFromSolves || solves.length === 0) return;
    // 训练模式(随机抽)不产生任何持久进度:LSLL 一套 149,188 个 case,随机刷出来的
    // 排期既过不完一轮、也永远抽不全,只会把每用户 20,000 条的记录额度白白吃掉。
    // 指针照常前进 —— 否则中途切到复习模式会把之前随机刷的那一串补记一遍。
    const skip = mode === 'train';
    const okMs = solves.filter(s => s.penalty === 'ok').map(s => s.ms).sort((a, b) => a - b);
    const median = okMs.length >= 3 ? okMs[Math.floor(okMs.length / 2)] : null;
    const now = Date.now();
    for (let i = Math.max(0, lastGradedSolve.current + 1); i < solves.length; i++) {
      const sv = solves[i];
      lastGradedSolve.current = i;
      if (skip) continue;
      const rec = useAlgSrs.getState().recs[sv.caseKey];
      if (rec && rec.n > 0 && rec.d > now) continue;   // 这张卡今天已经排过期了
      const g = gradeFromSolve(sv.ms, sv.penalty, median);
      const next = gradeSrs(sv.caseKey, g);
      if (useTrainerStore.getState().srsAutoMark) autoMarkFromSrs(sv.caseKey, next, g);
    }
  }, [solves, srsFromSolves, gradeSrs, mode]);
  // 换 set 重新计数(成绩列表是 per-set 的)
  useEffect(() => { lastGradedSolve.current = solves.length - 1; }, [storePuzzle, storeSet]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 成绩驱动的标记升降级建议(只建议不自动改,标记主权在用户)──
  // 升:该 case 近 5 把全成功,且这 5 把的中位数不慢于本 session 全部成功成绩的中位数
  // 降:已掌握的 case 连续 2 把 DNF。每个 (case, 方向) 一个 session 只提一次。
  const applyMarks = useTrainerMarks(s => s.applyMarks);
  const [suggest, setSuggest] = useState<{ k: string; name: string; kind: 'master' | 'demote' } | null>(null);
  const suggestDismissed = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (solves.length === 0) return;
    const last = solves[solves.length - 1];
    const k = last.caseKey;
    const st = markStatus(useTrainerMarks.getState().marks, k);
    const attempts = solves.filter(s => s.caseKey === k);
    const effMs = (s: { ms: number; penalty: string }) => s.ms + (s.penalty === '+2' ? 2000 : 0);
    const median = (xs: number[]) => {
      const a = [...xs].sort((x, y) => x - y);
      return a.length > 0 ? a[Math.floor(a.length / 2)] : Infinity;
    };
    if (st === 'mastered') {
      const last2 = attempts.slice(-2);
      if (last2.length === 2 && last2.every(s => s.penalty === 'DNF') && !suggestDismissed.current.has(`${k}|demote`)) {
        setSuggest({ k, name: last.caseName, kind: 'demote' });
      }
      return;
    }
    const last5 = attempts.slice(-5);
    if (last5.length < 5 || !last5.every(s => s.penalty === 'ok')) return;
    const allOk = solves.filter(s => s.penalty === 'ok');
    if (median(last5.map(effMs)) > median(allOk.map(effMs))) return;
    if (suggestDismissed.current.has(`${k}|master`)) return;
    setSuggest({ k, name: last.caseName, kind: 'master' });
  }, [solves]);
  const resolveSuggest = (accept: boolean) => {
    if (!suggest) return;
    if (accept) applyMarks([suggest.k], { s: suggest.kind === 'master' ? 'mastered' : 'learning' });
    suggestDismissed.current.add(`${suggest.k}|${suggest.kind}`);
    setSuggest(null);
  };

  // ── 过遍进度(口径见 lib/alg-sweep.ts)────────────────────────────
  // 合练不记:`?scope=` 是某一套内部的分组,跨集合练没有「范围」这回事。
  const sweepScope = isMix ? null : (virtual ? virtualScope : scopeSlug);
  const loadSweep = useAlgSweep(s => s.loadSweep);
  const recordSweep = useAlgSweep(s => s.recordSweep);
  const moveSweepCursor = useAlgSweep(s => s.moveCursor);
  useEffect(() => {
    if (!puzzle || !meta || isMix) return;
    loadSweep(puzzle, setSlug);
  }, [puzzle, meta, isMix, setSlug, loadSweep]);

  // 游标只在复习模式下走 —— 训练模式是随机抽,「过到第几个」根本没有定义。
  const sweepAt = mode === 'recap' && hist.idx >= 0 ? hist.list[hist.idx]?.recap : undefined;
  const sweepPos = sweepAt?.pos, sweepTotal = sweepAt?.total;
  useEffect(() => {
    if (isMix || sweepPos == null || sweepTotal == null) return;
    moveSweepCursor(sweepScope, sweepPos, sweepTotal);
  }, [isMix, sweepPos, sweepTotal, sweepScope, moveSweepCursor]);

  // 整轮过完:记一笔,并折叠这一轮里没手动标过的记忆排期(水位之下不折,小集行为不变)。
  //
  // 「过完」两种模式各有各的判据:
  //  - 复习(recap):队列走到尾,store 直接给出 recapRoundDone。
  //  - 记忆(memo):没有队列尾可言 —— 判据换成「本轮每个 case 都已经有排期」,
  //    也就是每一个都至少过了一遍。缺了这条,拿记忆模式练 LSLL 就永远不会折叠,
  //    20,000 条上限照样在第 66 天撞上。
  // 训练(train)不在此列:随机抽,永远抽不全。
  const srsRecs = useAlgSrs(s => s.recs);
  const memoAllRated = mode === 'memo' && pool.length > 0 && pool.every(k => k in srsRecs);
  // 进场时就已经全有排期 ⟹ 那是上一场留下的,不是这一场过完的。只认「本场从缺到全」那一次
  // 跳变,否则每开一次记忆模式就白记一遍(小集不折叠,排期一直在,次次都满足)。
  const memoBaseline = useRef<boolean | null>(null);
  useEffect(() => { memoBaseline.current = null; }, [storePuzzle, storeSet, sweepScope]);
  const sweepRecorded = useRef(false);
  useEffect(() => {
    if (mode === 'memo' && memoBaseline.current === null && pool.length > 0) {
      memoBaseline.current = memoAllRated;
    }
    const done = mode === 'recap' ? recapRoundDone
      : mode === 'memo' ? (memoAllRated && memoBaseline.current === false)
      : false;
    if (!done) { sweepRecorded.current = false; return; }
    if (isMix || sweepRecorded.current) return;
    sweepRecorded.current = true;   // 弹窗期间 / 每次评分后的重渲染别记成好几轮
    recordSweep(sweepScope, pool);
  }, [recapRoundDone, memoAllRated, isMix, mode, sweepScope, pool, recordSweep]);

  /**
   * 智能魔方出题。必须摆在下面那几个提前 return 之前 —— hook 不能条件调用;
   * 没连魔方时它什么都不做(连 Web Bluetooth 都不碰)。
   *
   * 记忆模式不接:那边是「看图回忆 + 自评」,没有「拧对了」这个判据可用。
   * 不计时也接 —— 那时魔方仍然替你出题,拧完自动下一题,只是不记成绩。
   */
  const cubeCase = currentKey ? findCaseByKey(cases, currentKey) ?? null : null;
  const trainerCube = useTrainerCube({
    enabled: smartCube && !isMemo && !splitActive,
    timing,
    puzzle: puzzle ?? null,
    sessionSet: storeSet,
    currentCase: cubeCase,
    currentScramble,
    currentKey,
  });

  if (!puzzle || !meta) {
    // 合练成员不够:直接给选集器(SSG 壳读不到 query,挂载前先「加载中」免闪)
    if (puzzle && isMix) {
      return (
        <div className="trainer-root">
          {mounted
            ? <MixSetPicker puzzle={puzzle} puzzleParam={puzzleParam} leaf="run" initial={mixSets} />
            : <div className="trainer-landing-empty">{tr({ zh: '加载中…', en: 'Loading…' })}</div>}
        </div>
      );
    }
    return (
      <div className="trainer-root">
        <div className="trainer-landing-empty">
          {tr({ zh: '未知公式集', en: 'Unknown set' })}: {puzzleParam}/{setSlug}
        </div>
      </div>
    );
  }

  const selectHref = isMix
    ? mixHref(puzzleParam, mixSets, 'select')
    : virtual
    ? virtual.selectHref(virtualScope)
    : `/alg/${puzzleParam}/${setSlug}/select${scopeSlug ? `?scope=${encodeURIComponent(scopeSlug)}` : ''}`;

  // 顶栏范围后缀:库内集是子组名,虚拟集是它自己那套范围命名(LSLL:大类 / 已收录)
  const scopeSuffix = virtual
    ? tr(virtual.scopeLabel(virtualScope))
    : scopeSlug
    ? (setSlug === 'zbll' ? displayZbllToken(scopeSlug) : scopeSlug.toUpperCase())
    : '';

  // 本场在练哪几套(单集 = 就那一套);面板里的「一起练」按它增删
  const sessionSets = isMix ? mixSets : [setSlug];
  /** 换一组成员 = 换个 URL:剩一套回单集页,多套走合练页。 */
  const sessionHref = (next: string[]) => {
    const uniq = [...new Set(next)].sort();
    return uniq.length <= 1
      ? `/alg/${puzzleParam}/${uniq[0] ?? setSlug}/run`
      : mixHref(puzzleParam, uniq, 'run');
  };
  // 虚拟集不进 ALG_CATALOG,也就没法跟库内集混练(合练走 loadAlg 拉库表)—— 不给「一起练」
  const addableSets = virtual ? [] : (ALG_CATALOG[puzzle] ?? []).filter(s => !sessionSets.includes(s.slug));

  // 记忆模式按「整套(或该组)」排期 —— 用户从来没进过 select 页也该能直接开练,
  // 所以没勾选时回落到本页范围内的全部 case,而不是把人赶去选择页。
  const memoPool = pool.length > 0 ? pool : memoScopeKeys;

  // 打印范围与本场出题范围同源:普通训练是「勾选 ∩ scope」,记忆模式没勾选时则
  // 回落到 scope 全集。这里只固定题库的规范序;覆盖乱序 / 随机抽题在点 PDF 时才现算。
  const printableKeys = new Set(isMemo ? memoPool : pool);
  const printableCases = cases.filter(c => printableKeys.has(caseKey(c)));
  const pdfScopeSlug = scopeSlug?.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  const buildPdfSheet = () => trainerSheetFromCases({
    puzzle,
    set: setSlug,
    cases: printableCases,
    title: `${puzzle} ${tr(meta)}${scopeSuffix ? `: ${scopeSuffix}` : ''} ${tr({ zh: '训练', en: 'Practice' })}`,
    filename: `${puzzleParam}-${setSlug}${pdfScopeSlug ? `-${pdfScopeSlug}` : ''}-trainer`,
    mode,
    probMode,
    recapOrder,
    scrambleKind,
    scrambleOpts: mode === 'memo'
      ? {
        preAuf: false, postAuf: false, randomInitialD: false,
        psf2lFaceTurnsOnly: trainerSetScrambleFeatures(puzzle, isMix ? null : setSlug).psf2lExtraScramble,
        randomFinalAuf: false, f2lSlots: ['FR'],
      }
      : splitScrambleOpts,
    showThumb: showStageThumb,
    pureScramble,
  });

  // 本机没选 case:房间模式(题面来自服务端队列)不算「未选」,不拦。经邀请链接进来时
  // 显示「正在加入房间…」而非「去选择」,避免加入完成前闪一下空态;链接失效则给原因 + 出口。
  if (pool.length === 0 && cases.length > 0 && !room && !isMemo) {
    const joiningViaLink = !!roomParam;
    return (
      <div className="trainer-root">
        <div className="trainer-landing-empty">
          {joiningViaLink && !roomError ? (
            tr({ zh: '正在加入房间…', en: 'Joining room…' })
          ) : (
            <>
              {joiningViaLink
                ? tr({ zh: `无法加入房间(${roomError})`, en: `Couldn't join room (${roomError})` })
                : tr({ zh: '尚未选 case', en: 'No cases selected' })}
              <div style={{ marginTop: 16 }}>
                <Link href={selectHref} className="trainer-start-btn">
                  {tr({ zh: '去选择', en: 'Pick cases' })}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const ms =
    timerState === TimerState.RUNNING ? now - timerStarted :
    timerState === TimerState.READY || timerState === TimerState.AWAITING_READY ? 0 :
    solves.length > 0 ? solves[solves.length - 1].ms : 0;

  // 当前题(左栏大打乱 + 下方 case 图)。
  // 与智能魔方那边同一份(它在提前 return 之前就要算),别各算一次免得漂
  const currentCase = cubeCase;

  // 屏上的下一条(三条一屏的第 2 条 / 单条模式下的离屏预取目标):
  // 回看过就是历史里 idx+1 那条,否则是预抽的 peek。
  const nextEntry = (hist.idx >= 0 && hist.idx < hist.list.length - 1)
    ? hist.list[hist.idx + 1]
    : peek;
  const nextCase = nextEntry ? findCaseByKey(cases, nextEntry.key) ?? null : null;
  const nextScrambleStr = nextEntry?.scramble ?? null;

  // 再往后一格(三条一屏的第 3 条):在队尾 = 二级预抽 peek2,队尾前一格 = peek,
  // 更靠前 = 历史里 idx+2 那条(已看过、已缓存)。
  const next2Entry =
    (hist.idx >= 0 && hist.idx + 2 <= hist.list.length - 1) ? hist.list[hist.idx + 2]
    : (hist.idx >= 0 && hist.idx + 1 <= hist.list.length - 1) ? peek
    : peek2;
  const next2Case = next2Entry ? findCaseByKey(cases, next2Entry.key) ?? null : null;

  // 三条一屏只在不计时模式下成立(计时是一把一把的,一屏三条无从计时)。房间协同同样支持:
  // store 在房间里也维护 peek/peek2(靠 roomAdvance 预领),第 2、3 条照常从预抽取。
  const multi = multiScramble && !timing;
  // 虚拟集的打乱异步补齐。单条等 current;三条一屏等屏上的三条全到,
  // 期间所有前进入口都被上面的 gate 拦住,这里给用户一个明确、稳定的状态。
  const scramblePending = !!virtual && (
    !currentKey || !currentScramble
    || (multi && (!!nextEntry?.key && !nextEntry.scramble))
    || (multi && (!!next2Entry?.key && !next2Entry.scramble))
  );
  const failedScreenCases = virtual
    ? [currentCase, ...(multi ? [nextCase, next2Case] : [])]
        .filter((c): c is AlgCase => !!c && !!caseResolveErrors[caseKey(c)])
    : [];
  const scrambleFailed = failedScreenCases.length > 0;
  const scrambleLoading = (
    <div className={`trainer-scramble-loading${scrambleFailed ? ' is-error' : ''}`} role="status" aria-live="polite">
      {!scrambleFailed && <Spinner size={22} />}
      <span>{scrambleFailed
        ? tr({ zh: '打乱生成失败', en: 'Could not prepare the scramble' })
        : tr({ zh: '正在准备打乱…', en: 'Preparing scramble…' })}</span>
      <small>{scrambleFailed
        ? tr({
            zh: '当前题和进度都已保留，请重试生成',
            en: 'This case and your progress are preserved. Try generating it again',
          })
        : tr({
            zh: '准备完成前不会进入下一题，进度也不会提前变化',
            en: 'The next case and progress will wait until this scramble is ready',
          })}</small>
      {scrambleFailed && (
        <button
          type="button"
          className="trainer-quick-btn"
          onClick={() => { for (const c of failedScreenCases) void resolveCase(c); }}
        >
          {tr({ zh: '重试生成', en: 'Try again' })}
        </button>
      )}
    </div>
  );

  // 「上一个」卡片(回看 + 标记):默认 = 打乱历史里的上一条 —— 换题(计时停表 / 空格 / →)
  // 时光标一起走,卡片跟着更新(计时停表后的上一条正好是你刚做完那把)。在统计里点选某条
  // 成绩(pinned)则临时切到那把,标题显示 #N,换题自动解除。
  const pinnedSolve = observingPinned ? (solves[observingIdx] ?? null) : null;
  const prevHistEntry = hist.idx > 0 ? hist.list[hist.idx - 1] : null;
  const prevKey = pinnedSolve?.caseKey ?? prevHistEntry?.key ?? null;
  const prevCase = prevKey ? findCaseByKey(cases, prevKey) ?? null : null;
  const prevSolveScramble = pinnedSolve?.scramble ?? prevHistEntry?.scramble ?? null;
  const prevHeader = pinnedSolve
    ? `#${pinnedSolve.i + 1}`
    : tr({ zh: '上一个', en: 'Previous' });
  // 三条一屏时「上一个」= 上一屏那三条(点一次跨 3 格,所以回看的单位也是一屏三条),
  // 顺序与主屏一致(上屏第 1/2/3 条)。不计时模式下 pinned 恒为空,直接读历史即可。
  const prevTrio = multi
    ? [hist.idx - 3, hist.idx - 2, hist.idx - 1]
        .filter(i => i >= 0)
        .map(i => hist.list[i])
        .filter(Boolean)
    : [];
  // 纯打乱纯粹是**呈现**:store / 历史 / 缩略图 / 云备份仍存原打乱,只有给人看和复制的
  // 那一份剥掉括号与 `↑↓·` 标注。
  const shownScramble = (s: string | null | undefined): string =>
    pureScramble ? purifyScramble(puzzle, s ?? '') : (s ?? '');
  // 标记目标 = 上一个这把(你刚做完 / 刚切过的),数字键 1-4 也打在它上面。
  const pillCase = prevCase;
  pillKeyRef.current = pillCase ? caseKey(pillCase) : null;

  const onNextCase = () => {
    if (timerState === TimerState.NOT_RUNNING) advanceScramble();
  };

  // 计时:统计=成绩用时列表。不计时:同一个开关切成「历史」=打乱历史列表(点某条跳回看那条打乱)。
  // 两者用同一 showStats 偏好,互补出现;都开着侧栏才铺。
  // 没有成绩时不摆空统计框；第一把完成后再出现成绩列表。
  const statsVisible = timing && showStats && solves.length > 0;
  const historyVisible = !timing && showStats
    && hist.list.some((_, index) => index !== hist.idx);
  // 三块各自成列:上一个在左、统计在右、历史铺满底部。哪块空了哪列就不占宽。
  const leftShown = showPrevCard;

  // AUF 开关只对「顶层 case + U 可作 AUF」的场景有意义(F2L 类打乱前加 U 会换 case)
  // 合练:任一成员是 F2L 类就整场关掉(给 F2L 打乱前加 U 会换成另一个 case)
  // 记忆模式整对开关都不摆:那边一律不加 AUF(题面要与 case 图逐字一致,见 store 的
  // `aufOpts`),开关留着就是个拨了不动的死开关。
  // LSLL 曾单独关掉 post-AUF(怕对子转离展示相位),2026-07-28 放开:图从实际打乱渲染、
  // 跟着一起转,而收尾 AUF 恰恰是 LSLL 真解里要先补的那一下。
  const aufSupported = (puzzle === '3x3' || puzzle === '2x2') && !isMemo
    && !cases.some(c => c.sticker.kind === 'f2l');
  // F2L 系的随机 D / 末尾调整由公式集显式声明,不拿 sticker.kind 猜 —— 其它同样使用
  // f2l 贴纸模板的集不会因此凭空多开关。合练也不继承单集的特化设置。
  const setScrambleFeatures = trainerSetScrambleFeatures(puzzle, isMix ? null : setSlug);
  const setAdjustSupported = !isMemo && (
    setScrambleFeatures.randomInitialD
    || setScrambleFeatures.psf2lExtraScramble
    || setScrambleFeatures.psf2lSlots
    || setScrambleFeatures.randomFinalAuf
    || setScrambleFeatures.f2lSlots
  );
  /** 有没有钉过朝向 —— 空数组的组在 store 里是删掉而不是留空的,所以数键就够 */
  const oriPinned = Object.keys(oriSel).length > 0;
  // 真实概率只有带 meta 的 LL set(zbll / pll / ell / 1lll)有数学定义
  // 真实概率按「一套 LL set 内部的 AUF 轨道」定义,跨集混起来没有公认的相对权重 —— 合练不给
  const probSupported = puzzle === '3x3' && !isMix && !!ALG_SET_UNIVERSE[setSlug];
  // recap 进度:历史条目记的是当前题的 1-based 位置；顶部数字表达的是已经练完的数量，
  // 所以进入首题显示 0，前进后才增加。轮末确认后题面仍停在最后一题，要单独显示 total。
  const recapCur = hist.idx >= 0 ? hist.list[hist.idx]?.recap : undefined;
  const recapShown = mode === 'recap' && !!recapCur;
  const recapCompleted = completedRecapCount(recapCur, recapRoundDone || recapRoundAcked);

  return (
    <div className="trainer-root">
      <div className="trainer-topbar">
        <Link
          href={selectHref}
          className="trainer-back"
          aria-label={tr({ zh: '选择 case', en: 'Select cases' })}
        >
          <ArrowLeft size={14} />
        </Link>
        <span style={{ fontSize: '1rem', color: 'var(--muted-foreground)' }}>
          {puzzle} · {tr(meta)}{scopeSuffix ? ` · ${scopeSuffix}` : ''}
        </span>
        {/* 训练选项全收进齿轮弹出面板,齿轮居中吸在页面正上方
            (data-no-timer:面板空白不触发按压计时) */}
        <div className="trainer-opts trainer-opts--top" data-no-timer ref={optsRef}>
          {/* 打印和进度紧凑贴在齿轮左侧:absolute 脱流,齿轮仍精确居中。
              合练的 case 来自不同 set,不能拿一个 set 契约渲染整份 PDF,先不露错误入口。 */}
          <div className="trainer-top-actions">
            {!isMix && printableCases.length > 0 && (
              <AlgPdfButton
                build={buildPdfSheet}
                title={tr({ zh: '下载可打印的训练打乱', en: 'Download printable training scrambles' })}
              />
            )}
            <Link href="/alg/progress" className="trainer-progress-link" prefetch={false}>
              {tr({ zh: '进度', en: 'Progress' })}
            </Link>
          </div>
          <button
            type="button"
            className="trainer-opts-gear"
            onClick={() => setOptsOpen(o => !o)}
            aria-expanded={optsOpen}
            aria-label={tr({ zh: '训练设置', en: 'Trainer settings' })}
          >
            <Settings size={22} />
          </button>
          {/* 复习进度贴在齿轮右侧(absolute 脱流:齿轮仍精确居中,面板锚点不受影响) */}
          {recapShown && recapCur && !splitActive && (
            <span className="trainer-recap-progress">
              {/* 分轮次的范围(LSLL 已收录:302 条一轮、494 轮)把「第几轮」摆在进度前面 */}
              {roundLabel && roundNumber && totalRounds && virtual?.scopeForRound ? (
                <span className="trainer-recap-round">
                  {tr({ zh: '第', en: 'Round' })}{' '}
                  <input
                    className="trainer-round-input"
                    type="number"
                    min={1}
                    max={totalRounds}
                    step={1}
                    inputMode="numeric"
                    value={roundDraft}
                    onChange={(event) => setRoundDraft(event.target.value)}
                    onBlur={commitRoundDraft}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                      if (event.key === 'Escape') {
                        cancelRoundBlurRef.current = true;
                        setRoundDraft(String(roundNumber));
                        event.currentTarget.blur();
                      }
                    }}
                    aria-label={tr({ zh: '选择训练轮次', en: 'Choose training round' })}
                    title={tr({ zh: `请输入 1 到 ${totalRounds} 的整数`, en: `Enter an integer from 1 to ${totalRounds}` })}
                  />
                  {tr({ zh: ` / ${totalRounds} 轮`, en: ` / ${totalRounds}` })}
                </span>
              ) : roundLabel ? (
                <span className="trainer-recap-round">{tr(roundLabel)}</span>
              ) : null}
              {recapCompleted}/{recapCur.total}
            </span>
          )}
          {optsOpen && (
            <div className="trainer-opts-panel" ref={optsPanelRef}>
              {/* 虚拟集的打乱 / 公式是现算的 —— 这话得摆在设置面板最上面,别让人以为是收录的公式 */}
              {virtual && <div className="trainer-opts-hint">{tr(virtual.note)}</div>}
              {/* 公式集与打乱类型共用一行,空间不足时由 trainer-opts-row 自然换行。一起练的成员
                  用可点的链接删(中键能新开),加走下拉(可选项十几套,不适合摊成 chip)。 */}
              {(addableSets.length > 0 || kinds.length > 1) && (
                <div className="trainer-opts-row">
                  {addableSets.length > 0 && (
                    <>
                    {/* 不挂标题:一行里摆着本场的集名 chip 和一个「+」下拉,这行是干什么的一看就知道。 */}
                    {sessionSets.map(slug => (
                      <span key={slug} className="trainer-mix-chip">
                        {setLabel(puzzle, slug)}
                        {sessionSets.length > 1 && (
                          <Link
                            href={sessionHref(sessionSets.filter(s => s !== slug))}
                            className="trainer-mix-chip-x"
                            aria-label={tr({ zh: `不练 ${setLabel(puzzle, slug)}`, en: `Drop ${setLabel(puzzle, slug)}` })}
                            title={tr({ zh: '从本场移除', en: 'Remove from this drill' })}
                            prefetch={false}
                          >
                            <X size={12} />
                          </Link>
                        )}
                      </span>
                    ))}
                    <select
                      className="trainer-scramble-kind trainer-set-add-select"
                      value=""
                      onChange={e => {
                        const slug = e.target.value;
                        if (slug) router.push(sessionHref([...sessionSets, slug]));
                      }}
                      aria-label={tr({ zh: '加一套公式集', en: 'Add a set' })}
                    >
                      {/* 只留一个「+」:摆在集名 chip 后面,是干什么的一目了然,
                          文字进 aria-label(读屏仍读得到「加一套公式集」)。 */}
                      <option value="">+</option>
                      {addableSets.map(s => <option key={s.slug} value={s.slug}>{tr(s)}</option>)}
                    </select>
                    </>
                  )}
                  {kinds.length > 1 && (
                    <>
                      <span className="trainer-opts-label">{tr({ zh: '打乱', en: 'Scramble' })}</span>
                      <select
                        className="trainer-scramble-kind"
                        value={scrambleKind}
                        onChange={e => setScrambleKind(e.target.value as ScrambleKind)}
                        disabled={timerState !== TimerState.NOT_RUNNING}
                        aria-label={tr({ zh: '打乱类型', en: 'Scramble type' })}
                      >
                        {kinds.map(k => <option key={k.id} value={k.id}>{k.label()}</option>)}
                      </select>
                    </>
                  )}
                </div>
              )}
              {addableSets.length > 0 && sessionSets.length > 1 && (
                <div className="trainer-opts-hint">
                  {tr({
                    zh: '多套混在一起出题,进度仍分别记在各自那一套里 —— 这里标的「已掌握」,单独进那一套也看得到',
                    en: 'Cases from every set are drawn together, but progress still lands in each set on its own — a case you master here shows up mastered in that set too',
                  })}
                </div>
              )}
              <div className="trainer-opts-row">
                <select
                  className="trainer-scramble-kind trainer-mode-select"
                  value={isMemo ? 'memo' : 'train'}
                  onChange={e => setMode(e.target.value === 'memo' ? 'memo' : lastTrainingMode.current)}
                  disabled={!!room || splitActive}
                  aria-label={tr({ zh: '训练模式', en: 'Training mode' })}
                >
                  {PRIMARY_MODES.map(m => (
                    <option key={m.id} value={m.id}>{tr({ zh: m.zh, en: m.en })}</option>
                  ))}
                </select>
                {!isMemo && (
                  <>
                    <span className="trainer-opts-label">{tr({ zh: '出题', en: 'Draw' })}</span>
                    <PillToggle
                      value={mode === 'recap'}
                      onChange={covered => {
                        const next = covered ? 'recap' : 'train';
                        lastTrainingMode.current = next;
                        setMode(next);
                      }}
                      onLabel={tr({ zh: '覆盖', en: 'Coverage' })}
                      offLabel={tr({ zh: '随机', en: 'Random' })}
                      ariaLabel={tr({ zh: '出题方式', en: 'Draw mode' })}
                      disabled={splitActive}
                    />
                    <BoolToggle
                      value={timing}
                      onChange={setTiming}
                      label={tr({ zh: '计时', en: 'Timing' })}
                      disabled={splitActive}
                    />
                    {mode === 'recap' && (
                      <>
                        <PillToggle
                          value={recapOrder === 'shuffle'}
                          onChange={v => setRecapOrder(v ? 'shuffle' : 'seq')}
                          onLabel={tr({ zh: '乱序', en: 'Shuffled' })}
                          offLabel={tr({ zh: '顺序', en: 'In order' })}
                          ariaLabel={tr({ zh: '复习顺序', en: 'Recap order' })}
                          disabled={!!room}
                        />
                        {!room && !roundEndPromptRequired && (
                          <BoolToggle
                            value={showRecapRoundEnd}
                            onChange={setShowRecapRoundEnd}
                            label={tr({ zh: '显示本轮结束', en: 'Show round end' })}
                          />
                        )}
                        {/* 刷到一半想重来:清掉「7/472」这个本轮进度,重洗后从第 1 个再走一遍 */}
                        <button
                          type="button"
                          className="trainer-opts-btn is-ghost"
                          onClick={restartRecapRound}
                          disabled={!!room}
                          title={room
                            ? tr({ zh: '房间轮次由全队共享,离开房间才能重开', en: 'Room rounds are shared by the team — leave the room to restart' })
                            : tr({ zh: '清空本轮进度,重新从第 1 个开始', en: 'Clear this round’s progress and start over from the first case' })}
                        >
                          <RotateCcw size={13} /> {tr({ zh: '重置', en: 'Reset' })}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
              {!isMemo && (
                <div className="trainer-opts-hint">
                  {mode === 'recap'
                    ? tr({ zh: '覆盖:每轮每个选中 case 各出一次,全部完成后开始下一轮', en: 'Coverage: show every selected case once per round, then start the next round' })
                    : tr({ zh: '随机:每题独立抽取,同一 case 可能连续出现', en: 'Random: draw each case independently, so the same case may repeat' })}
                </div>
              )}
              {!isMemo && splitScreenAvailable && (
                <>
                  <div className="trainer-opts-row trainer-split-setting">
                    <BoolToggle
                      value={splitActive}
                      onChange={enabled => {
                        if (!enabled) {
                          void setSplitParam(null);
                          return;
                        }
                        if (room || pool.length < 2) return;
                        lastTrainingMode.current = 'recap';
                        setMode('recap');
                        setTiming(false);
                        setSmartCube(false);
                        void setSplitParam('1');
                        setOptsOpen(false);
                      }}
                      disabled={!!room || pool.length < 2}
                      label={tr({ zh: '分屏', en: 'Split view' })}
                    />
                  </div>
                  {(pool.length < 2 || room) && (
                    <div className="trainer-opts-hint trainer-split-setting">
                      {pool.length < 2
                        ? tr({ zh: '至少选择 2 个 case 才能分屏', en: 'Select at least 2 cases to use split view' })
                        : tr({ zh: '先离开多设备房间，再开启单屏分工', en: 'Leave the multi-device room before starting a shared-screen drill' })}
                    </div>
                  )}
                </>
              )}
              {/* 智能魔方:接上就不用照打乱拧了,魔方本身变成当前 case */}
              {!isMemo && (
                <SmartCubeRow
                  enabled={smartCube}
                  onEnabledChange={setSmartCube}
                  state={trainerCube}
                  supported={!splitActive && puzzleHasSmartCube(puzzle)}
                />
              )}
              {isMemo && (
                <div className="trainer-opts-hint">
                  {tr({
                      zh: '看图回忆公式后自评,系统按 SM-2 间隔重复排期:记得越牢下次间隔越长,忘了当场重来。每天只出到期的那些',
                      en: 'Recall the alg from the picture, then grade yourself. An SM-2 spaced-repetition schedule stretches the interval as memory holds and repeats it immediately when it breaks — only due cards come up each day',
                    })}
                </div>
              )}
              {isMemo && (
                <>
                  <div className="trainer-opts-row">
                    <label className="trainer-opts-num">
                      <span className="trainer-opts-label">{tr({ zh: '每场新卡', en: 'New/session' })}</span>
                      <input
                        className="trainer-opts-num-input"
                        type="number" min={0} max={200} step={1}
                        value={srsNewLimit}
                        onChange={e => setSrsNewLimit(Number(e.target.value))}
                        aria-label={tr({ zh: '每场最多学几张新卡', en: 'Max new cards per session' })}
                      />
                    </label>
                    <label className="trainer-opts-num">
                      <span className="trainer-opts-label">{tr({ zh: '每场上限', en: 'Cards/session' })}</span>
                      <input
                        className="trainer-opts-num-input"
                        type="number" min={5} max={500} step={5}
                        value={srsSessionLimit}
                        onChange={e => setSrsSessionLimit(Number(e.target.value))}
                        aria-label={tr({ zh: '每场卡片总数上限', en: 'Max cards per session' })}
                      />
                    </label>
                  </div>
                  <div className="trainer-opts-row">
                    <BoolToggle
                      value={srsFillExtra}
                      onChange={setSrsFillExtra}
                      label={tr({ zh: '加练', en: 'Extra drill' })}
                    />
                    <BoolToggle
                      value={srsAutoMark}
                      onChange={setSrsAutoMark}
                      label={tr({ zh: '自动标记', en: 'Auto marks' })}
                    />
                  </div>
                  <div className="trainer-opts-hint">
                    {tr({
                      zh: '加练 = 到期卡与新卡都用完后,继续按「最容易忘的」补满本场;自动标记 = 第一次记住升「不熟」,间隔过 21 天升「已掌握」,忘了打回「不熟」',
                      en: 'Extra drill tops the session up with your shakiest cards once due + new run out. Auto marks promote to Shaky on first recall, to Mastered once the interval passes 21 days, and back to Shaky on a lapse',
                    })}
                  </div>
                </>
              )}
              {/* 在线房间:后端共享队列,多设备原子领取 —— 不重不漏、动态均衡、真·合并进度 */}
              {mode === 'recap' && !splitActive && (
                <>
                  <div className="trainer-opts-row trainer-room-row">
                    {room ? (
                      <>
                        <button
                          type="button"
                          className="trainer-room-badge"
                          onClick={copyRoomLink}
                          title={tr({ zh: '复制邀请链接(队友打开即加入)', en: 'Copy invite link (teammates join on open)' })}
                        >
                          <span className="trainer-room-badge-label">{tr({ zh: '房间', en: 'Room' })}</span>
                          <span className="trainer-room-badge-code">{room.code}</span>
                          {codeCopied ? <Check size={13} /> : <Copy size={13} className="trainer-room-badge-copy" />}
                        </button>
                        <button
                          type="button"
                          className="trainer-room-qr-btn"
                          onClick={() => setQrOpen(true)}
                          title={tr({ zh: '二维码(队友扫码加入)', en: 'QR code (teammates scan to join)' })}
                          aria-label={tr({ zh: '房间二维码', en: 'Room QR code' })}
                        >
                          <QrCode size={15} />
                        </button>
                        <button
                          type="button"
                          className="trainer-opts-btn is-ghost"
                          onClick={() => { leaveRoom(); void setRoomParam(null); autoJoinRef.current = false; }}
                        >
                          {tr({ zh: '离开', en: 'Leave' })}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="trainer-opts-btn"
                          // 建完就把二维码摆出来:开房的下一步必然是喊人进来,
                          // 不该还要自己去点上头那个「房间」徽章。
                          onClick={() => void createRoom().then(r => {
                            if (!r.ok || !r.code) return;
                            void setRoomParam(r.code);
                            setQrOpen(true);
                          })}
                          disabled={roomBusy}
                        >
                          {tr({ zh: '创建房间', en: 'Create room' })}
                        </button>
                        <span className="trainer-opts-label">{tr({ zh: '或', en: 'or' })}</span>
                        <RoomCodeInput
                          className="trainer-coop-code"
                          value={joinCode}
                          onValueChange={setJoinCode}
                          onComplete={joinWithCode}
                          disabled={roomBusy}
                        />
                      </>
                    )}
                  </div>
                  {roomError && <div className="trainer-opts-hint trainer-room-err">{roomError}</div>}
                  {room && (
                    <div className="trainer-opts-hint">
                      {tr({
                        zh: '各设备领到的 case 互不重复',
                        en: 'Each device receives distinct cases',
                      })}
                    </div>
                  )}
                </>
              )}
              {probSupported && mode === 'train' && (
                <>
                  <div className="trainer-opts-row">
                    <span className="trainer-opts-label">{tr({ zh: '概率', en: 'Odds' })}</span>
                    <PillToggle
                      value={probMode === 'uniform'}
                      onChange={v => setProbMode(v ? 'uniform' : 'real')}
                      onLabel={tr({ zh: '均等', en: 'Uniform' })}
                      offLabel={tr({ zh: '真实', en: 'Real' })}
                      ariaLabel={tr({ zh: '出题概率模式', en: 'Case probability mode' })}
                    />
                  </div>
                  <div className="trainer-opts-hint">
                    {probMode === 'uniform'
                      ? tr({
                          zh: '每题独立均匀抽取:P(case) = 1/n',
                          en: 'Independent uniform draw: P(case) = 1/n',
                        })
                      : tr({
                          zh: '按 AUF 轨道大小加权:P(case) ∝ 16/c(c = 该 case 的对称阶),即随机顶层中它的真实出现频率',
                          en: 'Weighted by AUF orbit size: P(case) ∝ 16/c (c = symmetry order) — its true frequency in a random last layer',
                        })}
                  </div>
                </>
              )}
              {/* 朝向摆在 AUF 开关上面:它是这三个里最具体的一个(直接指着图说「就出这个方向」),
                  开关是它的粗档。post-AUF 又不能当朝向的前置条件 —— 开关默认关着,藏在后面
                  等于没有这个功能。 */}
              {aufSupported && (
                <OrientationPicker
                  puzzle={puzzle}
                  setSlug={setSlug}
                  cases={poolCases}
                  postAuf={postAuf}
                  sel={oriSel}
                  onChange={setOriSel}
                  onReset={resetOriSel}
                />
              )}
              {aufSupported && (
                <div className="trainer-opts-row">
                  <BoolToggle value={preAuf} onChange={setPreAuf} label="pre-AUF" />
                  {/* 钉了朝向就没有 post-AUF 这一说了(store 里同时关掉):留一个永远得让位的
                      开关只会让人以为随机还在跑。pre-AUF 不受影响,它改的是收尾不是朝向。 */}
                  {!oriPinned && (
                    <BoolToggle value={postAuf} onChange={setPostAuf} label="post-AUF" />
                  )}
                </div>
              )}
              {setAdjustSupported && (
                <>
                  <div className="trainer-opts-row">
                    {setScrambleFeatures.randomInitialD && (
                      <BoolToggle
                        value={randomInitialD}
                        onChange={setRandomInitialD}
                        label={tr({ zh: '随机 D 调整', en: 'Random D setup' })}
                      />
                    )}
                    {setScrambleFeatures.psf2lExtraScramble && (
                      <div
                        className="trainer-opts-row"
                        role="group"
                        aria-label={tr({ zh: '剩余 F2L 状态', en: 'Remaining F2L state' })}
                      >
                        <span>{tr({ zh: '一角', en: 'One corner' })}</span>
                        <PillToggle
                          value={!psf2lExtraScramble}
                          onChange={bothPresent => setPsf2lExtraScramble(!bothPresent)}
                          onLabel={tr({ zh: '和', en: 'and' })}
                          offLabel={tr({ zh: '或', en: 'or' })}
                          ariaLabel={tr({ zh: '一角和一棱或一角或一棱', en: 'One corner and one edge or one corner or one edge' })}
                        />
                        <span>{tr({ zh: '一棱', en: 'one edge' })}</span>
                      </div>
                    )}
                    {setScrambleFeatures.randomFinalAuf && (
                      <BoolToggle
                        value={randomFinalAuf}
                        onChange={setRandomFinalAuf}
                        label="AUF"
                      />
                    )}
                  </div>
                  {setScrambleFeatures.f2lSlots && (
                    <F2LSlotPicker slots={f2lSlots} onChange={setF2LSlots} />
                  )}
                  {setScrambleFeatures.psf2lSlots && (
                    <F2LSlotPicker
                      slots={psf2lSlots}
                      minimumSelected={2}
                      ariaLabel={tr({ zh: 'PSF2L 训练槽位', en: 'PSF2L training slots' })}
                      onChange={setPsf2lSlots}
                    />
                  )}
                </>
              )}
              {/* 极简:侧栏两块各自可隐藏(issue #30)。统计=成绩用时列表,不计时根本
                  没有用时可统计 —— 不计时时连开关一起隐掉,而不是留一个永远关着的死开关。 */}
              <div className="trainer-opts-row">
                <BoolToggle
                  value={showStageThumb}
                  onChange={setShowStageThumb}
                  label={tr({ zh: '打乱图', en: 'Cube image' })}
                />
                <BoolToggle
                  value={pureScramble}
                  onChange={setPureScramble}
                  label={tr({ zh: '纯打乱', en: 'Plain scramble' })}
                />
                {/* 三条一屏只在不计时下有意义(计时是一把一把的),分屏时每边独立显示一组。 */}
                {!timing && (
                  <BoolToggle
                    value={multiScramble}
                    onChange={setMultiScramble}
                    label={tr({ zh: '三条', en: 'Three at once' })}
                  />
                )}
                {/* 计时 = 成绩统计;不计时 = 打乱历史(查看以前的打乱)。同一开关,标签随模式变。 */}
                {!splitActive && (
                  <BoolToggle
                    value={showStats}
                    onChange={setShowStats}
                    label={timing ? tr({ zh: '统计', en: 'Stats' }) : tr({ zh: '历史', en: 'History' })}
                  />
                )}
              </div>
              {/* 计时练的这几把也算复习 —— 不然计时练一晚上,记忆模式明天还当你没碰过 */}
              {timing && (
                <>
                  <div className="trainer-opts-row">
                    <BoolToggle
                      value={srsFromSolves}
                      onChange={setSrsFromSolves}
                      label={tr({ zh: '成绩计入记忆', en: 'Solves feed memory' })}
                    />
                  </div>
                  <div className="trainer-opts-hint">
                    {tr({
                      zh: 'DNF 记「忘了」,明显慢于本场中位数记「犹豫」,正常记「记得」,明显快记「秒答」。同一个 case 每到期一次只计一把,连做十把不会把间隔吹上天',
                      en: 'A DNF counts as “forgot”, clearly slower than your session median as “hard”, normal as “good”, clearly faster as “easy”. Each case counts once per time it comes due, so ten reps in a row can’t inflate the interval',
                    })}
                  </div>
                </>
              )}
              {/* 三条一屏时「上一个」整屏回看,改叫「上三个」。 */}
              {!splitActive && (
                <div className="trainer-opts-row">
                  <BoolToggle
                    value={showPrevCard}
                    onChange={setShowPrevCard}
                    label={multi ? tr({ zh: '上三个', en: 'Previous 3' }) : tr({ zh: '上一个', en: 'Previous' })}
                  />
                </div>
              )}
              {timing && (
                <div className="trainer-opts-row">
                  <span className="trainer-opts-label">{tr({ zh: '计时字体', en: 'Timer font' })}</span>
                  <TimerFontPicker value={timerFont} onChange={setTimerFont} />
                </div>
              )}
              <div className="trainer-opts-row">
                <span className="trainer-opts-label">{tr({ zh: '打乱字体', en: 'Scramble font' })}</span>
                <TimerFontPicker
                  value={scrambleFont}
                  onChange={setScrambleFont}
                  ariaLabel={tr({ zh: '打乱字体', en: 'Scramble font' })}
                  preview="R U R' F2"
                  options={['sans', 'mono', 'liberation']}
                  previewWeight={400}
                />
              </div>
              {/* 不计时那句「单击 / 空格 / → 切下一个」不出:那是点哪都能试出来的事。 */}
              {timing && (
                <div className="trainer-opts-help">
                  {tr({ zh: '空格开始/停止，按住拖动呼出轮盘', en: 'Space to start/stop, hold & drag for the wheel' })}
                </div>
              )}
              <div className="trainer-opts-help">
                {multi
                  ? tr({
                      zh: '数字键 1 不熟、2 已掌握,标在「上三个」最后一条;其余两条点卡片上的标记按钮',
                      en: 'Keys 1 shaky and 2 mastered mark the last of “Previous 3”; use each card’s mark button for the other two',
                    })
                  : tr({
                      zh: '数字键 1 不熟、2 已掌握,标在「上一个」case',
                      en: 'Keys 1 shaky and 2 mastered mark the “Previous” case',
                    })}
              </div>
            </div>
          )}
        </div>
      </div>

      {isMemo ? (
        <MemoryTrainer
          puzzle={puzzle}
          set={setSlug}
          cases={cases}
          pool={memoPool}
          scrambleKind={scrambleKind}
          onExit={() => setMode('recap')}
          // 点大图开详情,与训练 / 复习那边的卡片同一个入口(同一份弹窗)
          onShowCase={setMetaCase}
          paused={overlayOpen}
        />
      ) : splitActive ? (
        <TrainerSplitScreen
          puzzle={puzzle}
          set={setSlug}
          cases={cases}
          pool={pool}
          order={recapOrder}
          scrambleKind={scrambleKind}
          scrambleOpts={splitScrambleOpts}
          showThumb={showStageThumb}
          pureScramble={pureScramble}
          scrambleFont={scrambleFont}
          multi={multi}
          resolveCase={resolveCase}
          markPassedAsMastered={markPassedAsMastered}
          onExit={() => { void setSplitParam(null); }}
        />
      ) : (
      <div className={`trainer-run${leftShown ? ' has-left' : ''}${statsVisible ? ' has-right' : ''}`}>
        <div className={`trainer-stage${scramblePending ? ' is-loading' : ''}`} ref={stageRef} aria-busy={scramblePending}>
          {/* head = 图以上的一切(按钮 / 计时数字),body = 图及其以下(图、打乱公式)。
              两段配合 .trainer-run 的 subgrid:主屏与左右两张卡片共用同一套行,
              三张图的顶边落在同一条线上,不靠数魔法像素。
              打乱公式一律排在图**下方** —— 主屏、两侧卡片、三条一屏、记忆模式同一个次序。 */}
          <div className="trainer-stage-head">
          {/* 三条一屏:当前 + 屏上第 2、3 条(队尾时 = 预抽的 peek / peek2,回看过则是历史里
              后两条),拧完三条再点一次切下一屏。图与打乱交错成六行,每条打乱紧跟自己那张图。
              图走 local 渲染:三张与三条文字在同一次 commit 出现,不再各自等自己的网络往返。 */}
          {multi && (scramblePending ? scrambleLoading : (
            <div className="trainer-scramble-multi">
              {[
                { s: currentScramble, c: currentCase },
                { s: nextEntry?.scramble ?? null, c: nextCase },
                { s: next2Entry?.scramble ?? null, c: next2Case },
              ]
                .filter(row => !!row.s)
                .map((row, i) => (
                  <div className="trainer-scramble-row" key={i}>
                    {/* 每条自带标记条(与左边「上三个」那三张卡片一一对应):
                        屏上三题各是各的,一条公共标记条指谁都不对。 */}
                    {showStageThumb && row.c && (
                      <div className="trainer-stage-marks">
                        <CaseMarkBar k={caseKey(row.c)} />
                      </div>
                    )}
                    {showStageThumb && row.c && (
                      <CaseThumb
                        puzzle={puzzle}
                        set={setSlug}
                        sticker={row.c.sticker}
                        alg={row.c.algs.flat()[0]?.alg ?? row.c.standard ?? ''}
                        setup={row.s ?? row.c.setup}
                        size={140}
                        local
                      />
                    )}
                    <div className="trainer-scramble-line">
                      {!showStageThumb && row.c && <CaseMarkBar k={caseKey(row.c)} />}
                      <ScrambleHeader
                        scramble={shownScramble(row.s)}
                        label={i === 0 && copied ? tr({ zh: '已复制', en: 'Copied' }) : undefined}
                        font={scrambleFont}
                      />
                    </div>
                  </div>
                ))}
            </div>
          ))}
          {timing && (
            <TimerDisplay
              state={timerState}
              ms={ms}
              penalty={solves.length > 0 ? solves[solves.length - 1].penalty : undefined}
              font={timerFont}
            />
          )}
          </div>

          <div className="trainer-stage-body">
          {/* 当前这道题的 case 图 + 一左一右夹着它的标记条(与「上一个」卡片同一个排法):
              图从「实际打乱」渲染(含 pre/post-AUF),与下方打乱公式朝向一致。
              标记条只出两个图标、不带 case 名:训练模式下答案还不能露。数字键 1、2、4 打的仍是
              「上一个」那把(pillCase),这里是手点当前这把,两个目标各归各的。
              三条一屏时图与标记都跟在各自那条打乱上面(见上),这里不再重复出。
              打乱还没算出来时(虚拟集)不出图 —— 空 setup 会渲染成一个已还原的方块,那是假的。 */}
          {!multi && (scramblePending ? scrambleLoading : (
            <>
              {showStageThumb && currentCase && (
                <div className="trainer-figure">
                  <CaseMarkBar k={caseKey(currentCase)} />
                  {/* 出题时出识别图,动手之后才换实时那颗 —— 换的时机归 TrainerLiveCube 管,
                      见它的头注。没瞄准(还没把这题喂给魔方)时也是识别图:那会儿魔方上的
                      状态根本不是这题。 */}
                  {showStageThumb && currentScramble && (
                    <div className="trainer-stage-thumb">
                      {(() => {
                        const thumb = (
                          <CaseThumb
                            puzzle={puzzle}
                            set={setSlug}
                            sticker={currentCase.sticker}
                            alg={currentCase.algs.flat()[0]?.alg ?? currentCase.standard ?? ''}
                            setup={currentScramble}
                            size={140}
                          />
                        );
                        return trainerCube.armed
                          ? <TrainerLiveCube state={trainerCube} scramble={currentScramble} idle={thumb} />
                          : thumb;
                      })()}
                    </div>
                  )}
                </div>
              )}
              {/* 打乱公式紧跟在图下方；关图后星标并到公式左侧，不再占一整行。 */}
              <div className="trainer-scramble-line">
                {!showStageThumb && currentCase && <CaseMarkBar k={caseKey(currentCase)} />}
                <ScrambleHeader
                  scramble={shownScramble(currentScramble)}
                  label={copied ? tr({ zh: '已复制', en: 'Copied' }) : undefined}
                  font={scrambleFont}
                />
              </div>
            </>
          ))}
          {/* 离屏预取下一题的图(size=140,与主屏/左卡同一 URL → 共用浏览器缓存):换题后它就是
              主屏当前图,也是「上一个」卡片的图,届时命中缓存秒出,不等网络往返(打乱公式是本地
              状态所以本就瞬间出)。「打乱图」关时哪都不出图,无需预取。 */}
          {showStageThumb && nextCase && nextScrambleStr && (
            <div className="trainer-thumb-prefetch" aria-hidden>
              <CaseThumb
                puzzle={puzzle}
                set={setSlug}
                sticker={nextCase.sticker}
                alg={nextCase.algs.flat()[0]?.alg ?? nextCase.standard ?? ''}
                setup={nextScrambleStr}
                size={140}
              />
            </div>
          )}

          {suggest && (
            <div className="trainer-mark-suggest" data-no-timer>
              <span>
                {suggest.kind === 'master'
                  ? tr({
                      zh: `${suggest.name} 近 5 把全部顺利,标为已掌握?`,
                      en: `Last 5 of ${suggest.name} all clean — mark as mastered?`,
                    })
                  : tr({
                      zh: `已掌握的 ${suggest.name} 连挂 2 把,降回不熟?`,
                      en: `${suggest.name} (mastered) failed twice in a row — back to shaky?`,
                    })}
              </span>
              <button type="button" className="trainer-quick-btn" onClick={() => resolveSuggest(true)}>
                {tr({ zh: '标记', en: 'Mark' })}
              </button>
              <button type="button" className="trainer-quick-btn" onClick={() => resolveSuggest(false)}>
                {tr({ zh: '忽略', en: 'Dismiss' })}
              </button>
            </div>
          )}
          </div>
        </div>

        {leftShown && (
          <aside className="trainer-sidebar is-left">
            {/* 上一个:刚做完那把(图+名+打乱)+ 标记条,标记打在这把上。第一把之前无成绩,不出。
                三条一屏 → 上三个:上一屏那三条各一张卡片,每张自带标记条(键盘 1、2、4 仍打最近那条)。 */}
            {multi && prevTrio.map((e, i) => {
              const c = findCaseByKey(cases, e.key) ?? null;
              if (!c) return null;
              return (
                <SolveCard
                  key={`${e.key}-${i}`}
                  puzzle={puzzle}
                  set={setSlug}
                  scramble={shownScramble(e.scramble)}
                  c={c}
                  isZh={isZh}
                  showThumb={showStageThumb}
                  onShowCase={setMetaCase}
                  header={i === 0 ? tr({ zh: '上三个', en: 'Previous 3' }) : undefined}
                  markSlot={<CaseMarkBar k={caseKey(c)} />}
                  font={scrambleFont}
                  // 三张一起换,一起出:走本地渲染。三个 <img> 各等各的往返,
                  // 落地有先有后 —— 而且这三张刚在主屏上就是本地渲染的,浏览器缓存里没有它们。
                  localThumb
                />
              );
            })}
            {!multi && prevCase && (
              <SolveCard
                puzzle={puzzle}
                set={setSlug}
                scramble={shownScramble(prevSolveScramble)}
                c={prevCase}
                isZh={isZh}
                showThumb={showStageThumb}
                onShowCase={setMetaCase}
                header={prevHeader}
                markSlot={<CaseMarkBar k={caseKey(prevCase)} />}
                font={scrambleFont}
              />
            )}
          </aside>
        )}

        {statsVisible && (
          <aside className="trainer-sidebar is-right">
            <StatsList
              solves={solves}
              cases={cases}
              puzzle={puzzle}
              set={setSlug}
              observingIdx={observingIdx}
              onPick={pinObserving}
              onClear={() => {
                if (confirm(tr({ zh: '清空所有成绩?', en: 'Clear all solves?'
              })))
                  clearSolves();
              }}
            />
          </aside>
        )}

        {/* 不计时:打乱历史列表(点某条 = 跳回看那条打乱)。铺在底部整行 —— 它是一排横向药丸,
            挤在右栏里只能竖着堆。 */}
        {historyVisible && (
          <aside className="trainer-sidebar is-bottom">
            <HistoryList
              hist={hist}
              cases={cases}
              puzzle={puzzle}
              set={setSlug}
              onPick={jumpToHist}
              onShowCase={(c) => setMetaCase(c)}
            />
          </aside>
        )}
      </div>
      )}

      <GestureWheel ref={wheelRef} isZh={isZh} labels={wheelLabels} />

      {/* 有没有 meta 都弹:没有元数据的集(虚拟集等)弹窗里仍有图、全部公式、打乱,
          外链换成该集自己的详情页地址(算不出库内地址)。 */}
      {metaCase && (
        <AlgCaseMetaModal
          caseObj={metaCase}
          puzzle={puzzle}
          set={setSlug}
          byNo={byNo}
          href={virtual?.caseHref ? virtual.caseHref(metaCase) : undefined}
          onClose={() => setMetaCase(null)}
          onJump={(c) => setMetaCase(c)}
        />
      )}

      {/* 房间邀请二维码:队友扫码即进房。room 消失(离开)自动收起。 */}
      {qrOpen && room && (() => {
        const url = roomInviteUrl();
        return url ? (
          <RoomQrModal url={url} code={room.code} onClose={() => setQrOpen(false)} />
        ) : null;
      })()}

      {/* 在线房间复习:全队刷完本轮共享队列 → 弹「本轮复习结束」,「继续下一轮」全员一起开新一轮。 */}
      {/* 房间领题失败(限流 / 断网)必须看得见 —— 否则「按了没反应」会被误读成刷完了。
          设置面板里那条同样的提示只有开着面板才看得到,这里补一条常驻的。 */}
      {room && roomError && !recapRoundDone && (
        <div className="trainer-room-toast" role="status" data-no-timer>
          <span>{tr({ zh: '领取下一个 case 失败', en: 'Could not fetch the next case' })}:{roomError}</span>
          <button type="button" className="trainer-opts-btn is-ghost" onClick={onNextCase} disabled={roomBusy}>
            {tr({ zh: '重试', en: 'Retry' })}
          </button>
        </div>
      )}

      {/* 「下一轮」会重洗队列(房间还会把全队进度清零)—— 只认按钮,点背景不触发(误触代价太大) */}
      {recapRoundDone && !splitActive && (
        <div className="trainer-round-modal-backdrop" role="dialog" aria-modal="true" data-no-timer>
          <div className="trainer-round-modal">
            <h2>{tr({ zh: '本轮复习结束', en: 'Round complete' })}</h2>
            <p>
              {room
                ? tr({
                    zh: `全队已刷完本轮全部 ${room.total} 个 case!点「继续下一轮」大家一起开新一轮${room.order === 'shuffle' ? '(重新洗牌)' : ''}。`,
                    en: `The team finished all ${room.total} cases this round! Hit “Next round” to start a fresh round together${room.order === 'shuffle' ? ' (reshuffled)' : ''}.`,
                  })
                : nextRoundHref
                ? tr({
                    zh: `本轮 ${recapCur?.total ?? 0} 个都过了一遍!下一轮还是这批 case,换下一个 ZBLL 收尾 —— 全部走完就把两步路线遍历完了。`,
                    en: `All ${recapCur?.total ?? 0} of this round are done! The next round keeps the same cases and swaps in the next ZBLL ending — go through them all and you have covered every two-look route.`,
                  })
                : tr({
                    zh: `选中的 ${recapCur?.total ?? 0} 个 case 都过了一遍!点「继续下一轮」${recapOrder === 'shuffle' ? '重新洗牌' : '按原顺序'}再走一遍。`,
                    en: `You’ve been through all ${recapCur?.total ?? 0} selected cases! Hit “Next round” to run them again${recapOrder === 'shuffle' ? ', reshuffled' : ' in the same order'}.`,
                  })}
            </p>
            {roomError && <p className="trainer-room-err">{roomError}</p>}
            <div className="trainer-round-modal-actions">
              {!room && (
                <button type="button" className="trainer-opts-btn is-ghost" onClick={dismissRecapRound}>
                  {tr({ zh: '先不了', en: 'Not now' })}
                </button>
              )}
              {/* 分轮次的范围:「再来一遍」是重洗本轮,「下一轮」是换一批 case —— 两件事,两个按钮。
                  下一轮是真链接(换 ?scope=),中键 / Ctrl 点能新开。 */}
              {nextRoundHref && (
                <button type="button" className="trainer-opts-btn is-ghost" onClick={continueRecapRound}>
                  {tr({ zh: '再刷一遍本轮', en: 'Repeat this round' })}
                </button>
              )}
              {nextRoundHref ? (
                <Link className="trainer-round-modal-btn" href={nextRoundHref} prefetch={false} autoFocus>
                  {tr({ zh: '进入下一轮', en: 'Next round' })}
                </Link>
              ) : (
                <button
                  type="button"
                  className="trainer-round-modal-btn"
                  onClick={continueRecapRound}
                  disabled={roomBusy}
                  autoFocus
                >
                  {tr({ zh: '继续下一轮', en: 'Next round' })}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
