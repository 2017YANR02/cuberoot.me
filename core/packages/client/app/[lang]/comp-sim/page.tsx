'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useParams } from 'next/navigation';
import {
  CircleAlert,
  FastForward,
  LogIn,
  RotateCcw,
  Share2,
  Trophy,
} from 'lucide-react';
import {
  fromWcaSpelling,
  parseTimerEntry,
  roundResult,
  type RoundConfig,
  type Solve,
} from '@cuberoot/shared/timer';
import BackHome from '@/components/BackHome';
import BoolToggle from '@/components/BoolToggle';
import { CompPicker } from '@/components/CompPicker';
import { Flag } from '@/components/Flag';
import HeaderToggles from '@/components/HeaderToggles';
import PersonLink from '@/components/PersonLink';
import PuzzlePicker from '@/components/PuzzlePicker/PuzzlePicker';
import { displayCuberName } from '@/lib/cuber-name-display';
import { localizeCompName } from '@/lib/comp-localize';
import type { Comp } from '@/lib/comp-search';
import { roundTypeName } from '@/lib/comp-schedule';
import {
  fetchCompWcif,
  type CompWcifRound,
} from '@/lib/comp-wcif';
import {
  advancesFromRound,
  buildCompSimLeaderboard,
  callupDelayMs,
  COMP_SIM_ACTIVE_VERSION,
  expectedAttemptCount,
  filterNextRoundOfficialRows,
  hasCrossRoundCumulativeLimit,
  isValidCompSimActiveSnapshot,
  matchPublishedCompSimRounds,
  makeCompSimSolve,
  roundConfigFromWcif,
  selectPlayableScrambleGroup,
  shouldDuplicateScramble,
  SUPPORTED_COMP_SIM_EVENTS,
  type CompSimLeaderboardRow,
  type PlayableScrambleGroup,
} from '@/lib/comp-sim';
import {
  COMP_SIM_MEDIA,
  type CompSimCrowdVideo,
  type CompSimInspectionVoice,
} from '@/lib/comp-sim-media';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';
import { eventDisplayName, toWcaEventId } from '@/lib/wca-events';
import { formatWcaResult } from '@/lib/wca-format-result';
import { fetchWcaPerson } from '@/lib/wca-person-api';
import {
  fetchWcaResults,
  fetchWcaScrambles,
  type WcaResultRow,
} from '@/lib/wca-results-api';
import { persistItem } from '@/lib/safe-storage';
import { tr } from '@/i18n/tr';
import './comp-sim.css';

type Stage = 'setup' | 'loading' | 'waiting' | 'called' | 'ready' | 'entry' | 'results';

interface RoundBundle {
  detail: CompWcifRound;
  config: RoundConfig;
  roundTypeId: string;
  officialRows: WcaResultRow[];
  group: PlayableScrambleGroup;
}

interface SimOptions {
  inspectionVoice: boolean;
  ambiance: boolean;
  distractions: boolean;
  announcements: boolean;
  duplicateScrambles: boolean;
  visuals: boolean;
  stationary: boolean;
  maxWaitMinutes: number;
}

interface SavedRound {
  key: string;
  competition: string;
  event: string;
  round: string;
  rank: number;
  result: string;
  at: number;
}

interface ActiveSimulation {
  version: typeof COMP_SIM_ACTIVE_VERSION;
  wcaId: string;
  competition: Comp;
  eventId: string;
  options: SimOptions;
  rounds: RoundBundle[];
  roundIndex: number;
  solves: Solve[];
  currentScramble: string;
  usedExtras: number;
  tableNumber: number;
  stage: Exclude<Stage, 'setup' | 'loading'>;
  callupAt: number | null;
  inspectionStartedAt: number | null;
  inspectionVoice: CompSimInspectionVoice | null;
  crowdVideo: CompSimCrowdVideo | null;
  personalRecords: { single: number | null; average: number | null };
}

const SAVED_KEY = 'cuberoot-comp-sim-results-v1';
const ACTIVE_KEY = 'cuberoot-comp-sim-active-v1';
const DEFAULT_OPTIONS: SimOptions = {
  inspectionVoice: true,
  ambiance: false,
  distractions: false,
  announcements: true,
  duplicateScrambles: true,
  visuals: false,
  stationary: false,
  maxWaitMinutes: 3,
};

function speak(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
}

function randomItem<T>(items: readonly T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.min(items.length - 1, Math.floor(Math.random() * items.length))] ?? null;
}

function stopAudio(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
}

function playClip(src: string, volume: number, fallback?: () => void): HTMLAudioElement | null {
  if (!src || typeof Audio === 'undefined') {
    fallback?.();
    return null;
  }
  const audio = new Audio(src);
  audio.volume = volume;
  void audio.play().catch(() => fallback?.());
  return audio;
}

function attemptText(
  value: number,
  eventId: string,
  dropped: boolean,
): string {
  const formatted = formatWcaResult(value, eventId, 'single', { zero: 'empty' });
  return dropped && formatted ? `(${formatted})` : formatted;
}

function resultText(row: CompSimLeaderboardRow, eventId: string, averageFormat: boolean): string {
  return formatWcaResult(
    averageFormat ? row.average : row.best,
    eventId,
    averageFormat ? 'average' : 'single',
  );
}

function loadSavedRounds(): SavedRound[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((row): row is SavedRound => (
      !!row && typeof row === 'object' && typeof (row as SavedRound).key === 'string'
    )) : [];
  } catch {
    return [];
  }
}

export default function CompSimPage() {
  const params = useParams();
  const isZh = params?.lang === 'zh';
  const user = useAuthUser();
  const loginWithWca = useAuthStore((state) => state.loginWithWca);
  const [competitionInput, setCompetitionInput] = useState('');
  const [competition, setCompetition] = useState<Comp | null>(null);
  const [eventId, setEventId] = useState('');
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [stage, setStage] = useState<Stage>('setup');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [rounds, setRounds] = useState<RoundBundle[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [solves, setSolves] = useState<Solve[]>([]);
  const [currentScramble, setCurrentScramble] = useState('');
  const [usedExtras, setUsedExtras] = useState(0);
  const [tableNumber, setTableNumber] = useState(1);
  const [callupAt, setCallupAt] = useState<number | null>(null);
  const [inspectionStartedAt, setInspectionStartedAt] = useState<number | null>(null);
  const [inspectionVoice, setInspectionVoice] = useState<CompSimInspectionVoice | null>(null);
  const [crowdVideo, setCrowdVideo] = useState<CompSimCrowdVideo | null>(null);
  const [entry, setEntry] = useState('');
  const [plusTwo, setPlusTwo] = useState(false);
  const [personalRecords, setPersonalRecords] = useState<{ single: number | null; average: number | null }>({ single: null, average: null });
  const [savedRounds, setSavedRounds] = useState<SavedRound[]>([]);
  const [hasSpeech, setHasSpeech] = useState(false);
  const inspectionTimers = useRef<number[]>([]);
  const callupTimer = useRef<number | null>(null);
  const ambienceAudio = useRef<HTMLAudioElement | null>(null);
  const distractionTimer = useRef<number | null>(null);
  const distractionAudios = useRef(new Set<HTMLAudioElement>());
  const announcementAudio = useRef<HTMLAudioElement | null>(null);
  const inspectionAudio = useRef<HTMLAudioElement[]>([]);
  const restoredFor = useRef<string | null>(null);
  const loadRequestId = useRef(0);
  const entryRef = useRef<HTMLInputElement>(null);

  const hasAmbiance = COMP_SIM_MEDIA.ambience.length > 0;
  const hasDistractions = COMP_SIM_MEDIA.effects.length > 0;
  const hasVisuals = COMP_SIM_MEDIA.crowdVideos.length > 0;
  const hasAnnouncements = hasSpeech || Object.values(COMP_SIM_MEDIA.announcements.events).some((items) => items.length > 0)
    || Object.values(COMP_SIM_MEDIA.announcements.rounds).some((items) => items.length > 0)
    || Object.values(COMP_SIM_MEDIA.announcements.groups).some((items) => items.length > 0);
  const currentRound = rounds[roundIndex] ?? null;
  const currentResult = currentRound ? roundResult(solves, currentRound.config) : null;
  const liveMediaActive = stage === 'waiting' || stage === 'called' || stage === 'ready' || stage === 'entry';
  const averageFormat = currentRound?.config.format === 'ao5' || currentRound?.config.format === 'mo3';
  const attemptNumber = currentResult ? Math.min(currentResult.attempts, solves.length + 1) : 1;
  const currentIsExtra = usedExtras > 0
    && currentRound?.group.extras[usedExtras - 1]?.scramble === currentScramble;
  const supportedEvents = useMemo(() => new Set(
    (competition?.events ?? [])
      .map(toWcaEventId)
      .filter((id) => SUPPORTED_COMP_SIM_EVENTS.has(id)),
  ), [competition]);
  const eventGroups = useMemo(() => [{
    id: 'competition-events',
    label: tr({ zh: '本场比赛项目', en: 'Competition events' }),
    items: [...supportedEvents].map((id) => ({
      id,
      label: eventDisplayName(id, isZh),
      iconClass: `event-${id}`,
    })),
  }], [supportedEvents, isZh]);

  const leaderboard = useMemo(() => {
    if (!currentRound || !currentResult?.complete || !user) return [];
    return buildCompSimLeaderboard({
      officialRows: currentRound.officialRows,
      result: currentResult,
      sim: { wcaId: user.wcaId, name: user.name, countryIso2: user.country },
      personalRecords,
    });
  }, [averageFormat, currentResult, currentRound, personalRecords, solves, user]);
  const simRow = leaderboard.find((row) => row.kind === 'sim') ?? null;
  const advances = !!(simRow && currentRound && roundIndex < rounds.length - 1 && advancesFromRound(
    simRow,
    currentRound.detail.advancementCondition,
    leaderboard.length,
  ));

  useEffect(() => {
    setHasSpeech('speechSynthesis' in window);
  }, []);

  const clearInspectionTimers = useCallback(() => {
    inspectionTimers.current.forEach((id) => window.clearTimeout(id));
    inspectionTimers.current = [];
    inspectionAudio.current.forEach(stopAudio);
    inspectionAudio.current = [];
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  }, []);

  useEffect(() => {
    setSavedRounds(loadSavedRounds());
    return () => {
      loadRequestId.current += 1;
      clearInspectionTimers();
      if (callupTimer.current !== null) window.clearTimeout(callupTimer.current);
      if (distractionTimer.current !== null) window.clearTimeout(distractionTimer.current);
      stopAudio(ambienceAudio.current);
      distractionAudios.current.forEach(stopAudio);
      distractionAudios.current.clear();
      stopAudio(announcementAudio.current);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [clearInspectionTimers]);

  useEffect(() => {
    if (!user?.wcaId || restoredFor.current === user.wcaId) return;
    restoredFor.current = user.wcaId;
    try {
      const raw = localStorage.getItem(ACTIVE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!isValidCompSimActiveSnapshot(parsed)) {
        localStorage.removeItem(ACTIVE_KEY);
        return;
      }
      const saved = parsed as ActiveSimulation;
      if (saved.wcaId !== user.wcaId) {
        localStorage.removeItem(ACTIVE_KEY);
        return;
      }
      setCompetition(saved.competition);
      setCompetitionInput(saved.competition.name);
      setEventId(saved.eventId);
      setOptions({ ...DEFAULT_OPTIONS, ...saved.options });
      setRounds(saved.rounds);
      setRoundIndex(saved.roundIndex);
      setSolves(saved.solves);
      setCurrentScramble(saved.currentScramble);
      setUsedExtras(saved.usedExtras);
      setTableNumber(saved.tableNumber);
      setCallupAt(saved.callupAt);
      setInspectionStartedAt(saved.inspectionStartedAt);
      setInspectionVoice(saved.inspectionVoice);
      setCrowdVideo(saved.crowdVideo);
      setPersonalRecords(saved.personalRecords);
      setStage(saved.stage);
    } catch {
      // A malformed or stale local snapshot must not block starting a new sim.
      localStorage.removeItem(ACTIVE_KEY);
    }
  }, [user]);

  useEffect(() => {
    if (!user?.wcaId || !competition || rounds.length === 0 || stage === 'setup' || stage === 'loading') return;
    const snapshot: ActiveSimulation = {
      version: COMP_SIM_ACTIVE_VERSION,
      wcaId: user.wcaId,
      competition,
      eventId,
      options,
      rounds,
      roundIndex,
      solves,
      currentScramble,
      usedExtras,
      tableNumber,
      stage,
      callupAt,
      inspectionStartedAt,
      inspectionVoice,
      crowdVideo,
      personalRecords,
    };
    persistItem(ACTIVE_KEY, JSON.stringify(snapshot));
  }, [callupAt, competition, crowdVideo, currentScramble, eventId, inspectionStartedAt, inspectionVoice, options, personalRecords, roundIndex, rounds, solves, stage, tableNumber, usedExtras, user]);

  useEffect(() => {
    if (stage !== 'entry') return;
    requestAnimationFrame(() => entryRef.current?.focus());
  }, [stage]);

  useEffect(() => {
    stopAudio(ambienceAudio.current);
    ambienceAudio.current = null;
    if (!liveMediaActive || !options.ambiance) return;
    const src = randomItem(COMP_SIM_MEDIA.ambience);
    if (!src) return;
    const audio = playClip(src, 0.32);
    if (!audio) return;
    audio.loop = true;
    ambienceAudio.current = audio;
    return () => {
      stopAudio(audio);
      if (ambienceAudio.current === audio) ambienceAudio.current = null;
    };
  }, [liveMediaActive, options.ambiance]);

  useEffect(() => {
    if (distractionTimer.current !== null) window.clearTimeout(distractionTimer.current);
    distractionAudios.current.forEach(stopAudio);
    distractionAudios.current.clear();
    if (ambienceAudio.current) ambienceAudio.current.volume = 0.32;
    if (!liveMediaActive || !options.distractions || COMP_SIM_MEDIA.effects.length === 0) return;
    let cancelled = false;
    const schedule = (first: boolean) => {
      const delay = first
        ? 1500 + Math.random() * 3500
        : 25_000 + Math.random() * 40_000;
      distractionTimer.current = window.setTimeout(() => {
        if (cancelled) return;
        const src = randomItem(COMP_SIM_MEDIA.effects);
        if (src) {
          const ambience = ambienceAudio.current;
          if (ambience) ambience.volume = 0.12;
          let audio: HTMLAudioElement | null = null;
          let finished = false;
          const finish = () => {
            if (finished) return;
            finished = true;
            if (audio) {
              distractionAudios.current.delete(audio);
              stopAudio(audio);
            }
            if (ambienceAudio.current) ambienceAudio.current.volume = 0.32;
            if (!cancelled) schedule(false);
          };
          audio = playClip(src, 0.12 + Math.random() * 0.16, finish);
          if (audio) {
            distractionAudios.current.add(audio);
            audio.addEventListener('ended', finish, { once: true });
            audio.addEventListener('error', finish, { once: true });
          } else if (!finished) finish();
        } else {
          schedule(false);
        }
      }, delay);
    };
    schedule(true);
    return () => {
      cancelled = true;
      if (distractionTimer.current !== null) window.clearTimeout(distractionTimer.current);
      distractionTimer.current = null;
      distractionAudios.current.forEach(stopAudio);
      distractionAudios.current.clear();
      if (ambienceAudio.current) ambienceAudio.current.volume = 0.32;
    };
  }, [liveMediaActive, options.distractions]);

  const playRoundAnnouncement = useCallback((bundle: RoundBundle) => {
    if (!options.announcements) return;
    stopAudio(announcementAudio.current);
    announcementAudio.current = null;
    const sources = [
      randomItem(COMP_SIM_MEDIA.announcements.events[eventId] ?? []),
      randomItem(COMP_SIM_MEDIA.announcements.rounds[bundle.roundTypeId] ?? []),
      randomItem(COMP_SIM_MEDIA.announcements.groups[bundle.group.groupId] ?? []),
    ].filter((src): src is string => !!src);
    const fallback = `${eventDisplayName(eventId, false)}, ${roundTypeName(bundle.roundTypeId, false)}, group ${bundle.group.groupId}`;
    if (sources.length === 0) {
      if (hasSpeech) speak(fallback);
      return;
    }
    let index = 0;
    const playNext = () => {
      const src = sources[index++];
      if (!src) return;
      const audio = playClip(src, 1, playNext);
      if (!audio) return;
      announcementAudio.current = audio;
      audio.addEventListener('ended', playNext, { once: true });
    };
    playNext();
  }, [eventId, hasSpeech, options.announcements]);

  const callUp = useCallback(() => {
    const table = Math.floor(Math.random() * 10) + 1;
    setTableNumber(table);
    setCallupAt(null);
    setStage('called');
    if (user) speak(`${user.name}, table ${table}`);
  }, [user]);

  useEffect(() => {
    if (stage !== 'waiting') return;
    const target = callupAt ?? (Date.now() + callupDelayMs(options.maxWaitMinutes));
    if (callupAt === null) setCallupAt(target);
    callupTimer.current = window.setTimeout(callUp, Math.max(0, target - Date.now()));
    return () => {
      if (callupTimer.current !== null) window.clearTimeout(callupTimer.current);
      callupTimer.current = null;
    };
  }, [callUp, callupAt, options.maxWaitMinutes, stage]);

  const pickCompetition = (picked: Comp) => {
    loadRequestId.current += 1;
    setCompetition(picked);
    setCompetitionInput(picked.name);
    setEventId('');
    setError('');
  };

  const startRound = useCallback((bundle: RoundBundle) => {
    const first = bundle.group.scrambles[0]?.scramble ?? '';
    setSolves([]);
    setUsedExtras(0);
    setCurrentScramble(first);
    setEntry('');
    setPlusTwo(false);
    setInspectionStartedAt(null);
    setCallupAt(options.stationary ? null : Date.now() + callupDelayMs(options.maxWaitMinutes));
    playRoundAnnouncement(bundle);
    setStage(options.stationary ? 'ready' : 'waiting');
  }, [options.maxWaitMinutes, options.stationary, playRoundAnnouncement]);

  const startSimulation = async () => {
    if (!user?.wcaId || !competition || !eventId) return;
    const requestId = ++loadRequestId.current;
    setStage('loading');
    setError('');
    setStatus(tr({ zh: '正在加载比赛成绩、打乱和轮次规则…', en: 'Loading results, scrambles, and round rules…' }));
    try {
      const [resultData, scrambleRows, wcif, person] = await Promise.all([
        fetchWcaResults(competition.id, eventId),
        fetchWcaScrambles(competition.id),
        fetchCompWcif(competition.id),
        fetchWcaPerson(user.wcaId).catch(() => null),
      ]);
      if (requestId !== loadRequestId.current) return;
      if (!resultData?.rounds.length) {
        throw new Error(tr({ zh: '这场比赛没有已发布的该项目成绩。请选择已结束且已发布成绩的比赛。', en: 'This competition has no published results for that event. Choose a completed competition with posted results.' }));
      }
      if (!scrambleRows?.length) {
        throw new Error(tr({ zh: '这场比赛没有可用的官方打乱。', en: 'No official scrambles are available for this competition.' }));
      }
      const details = wcif.roundDetails[eventId] ?? [];
      if (!details.length) {
        throw new Error(tr({ zh: '比赛轮次规则与已发布成绩无法对应。', en: 'The published results do not match the competition round rules.' }));
      }
      const matchedRounds = matchPublishedCompSimRounds(details, resultData.rounds);
      if (!matchedRounds) {
        throw new Error(tr({ zh: '比赛轮次规则与已发布成绩无法一一对应。', en: 'The published results do not match the competition round rules one-to-one.' }));
      }
      const loaded: RoundBundle[] = [];
      for (const { detail, officialRound } of matchedRounds) {
        if (hasCrossRoundCumulativeLimit(detail)) {
          throw new Error(tr({
            zh: '该轮使用跨项目或跨轮累计时限，无法在单项目模拟中可靠还原。',
            en: 'This round shares a cumulative time limit across rounds or events, which cannot be reproduced reliably in a single-event simulation.',
          }));
        }
        const config = roundConfigFromWcif(detail);
        const attempts = expectedAttemptCount(detail.format);
        if (!config || attempts === null) {
          if (loaded.length > 0) break;
          throw new Error(tr({ zh: '该轮次的赛制暂不支持模拟。', en: 'That round format is not supported by the simulator.' }));
        }
        const group = selectPlayableScrambleGroup(
          scrambleRows,
          eventId,
          officialRound.roundTypeId,
          attempts,
        );
        if (!group) {
          if (loaded.length > 0) break;
          throw new Error(tr({ zh: '没有包含足够打乱的可用分组。', en: 'No scramble group contains enough scrambles.' }));
        }
        loaded.push({
          detail,
          config,
          roundTypeId: officialRound.roundTypeId,
          officialRows: officialRound.results,
          group,
        });
      }
      if (loaded.length === 0) {
        throw new Error(tr({ zh: '没有可模拟的已发布轮次。', en: 'No published rounds are playable.' }));
      }
      const records = person?.personal_records[eventId];
      setPersonalRecords({
        single: records?.single?.best ?? null,
        average: records?.average?.best ?? null,
      });
      setRounds(loaded);
      setRoundIndex(0);
      setCrowdVideo(options.visuals ? randomItem(COMP_SIM_MEDIA.crowdVideos) : null);
      setStatus('');
      startRound(loaded[0]);
    } catch (caught) {
      if (requestId !== loadRequestId.current) return;
      setStage('setup');
      setStatus('');
      setError(caught instanceof Error ? caught.message : tr({ zh: '比赛数据加载失败。', en: 'Could not load competition data.' }));
    }
  };

  const scheduleInspectionCues = useCallback((startedAt: number, voice: CompSimInspectionVoice | null) => {
    clearInspectionTimers();
    if (!options.inspectionVoice) return;
    const cues = [
      { at: 8000, src: voice?.eight ?? '', text: 'Eight seconds' },
      { at: 12000, src: voice?.twelve ?? '', text: 'Twelve seconds' },
    ];
    for (const cue of cues) {
      const remaining = startedAt + cue.at - Date.now();
      if (remaining <= 0) continue;
      inspectionTimers.current.push(window.setTimeout(() => {
        const fallback = hasSpeech ? () => speak(cue.text) : undefined;
        const audio = cue.src ? playClip(cue.src, 1, fallback) : (fallback?.(), null);
        if (audio) inspectionAudio.current.push(audio);
      }, remaining));
    }
  }, [clearInspectionTimers, hasSpeech, options.inspectionVoice]);

  useEffect(() => {
    if (stage !== 'entry' || inspectionStartedAt === null) return;
    scheduleInspectionCues(inspectionStartedAt, inspectionVoice);
    return clearInspectionTimers;
  }, [clearInspectionTimers, inspectionStartedAt, inspectionVoice, scheduleInspectionCues, stage]);

  const beginInspection = () => {
    const startedAt = Date.now();
    const voice = randomItem(COMP_SIM_MEDIA.inspectionVoices);
    setEntry('');
    setPlusTwo(false);
    setInspectionStartedAt(startedAt);
    setInspectionVoice(voice);
    setStage('entry');
    scheduleInspectionCues(startedAt, voice);
  };

  const useExtra = () => {
    if (!currentRound) return;
    const extra = currentRound.group.extras[usedExtras];
    if (!extra?.scramble) {
      showToast(tr({ zh: '这个分组没有更多备打。', en: 'No extra scrambles are available for this group.' }));
      return;
    }
    clearInspectionTimers();
    setUsedExtras((count) => count + 1);
    setCurrentScramble(extra.scramble);
    setEntry('');
    setPlusTwo(false);
    setInspectionStartedAt(null);
    setInspectionVoice(null);
    setStage('ready');
  };

  const finishRound = (nextSolves: Solve[]) => {
    setSolves(nextSolves);
    setInspectionStartedAt(null);
    setInspectionVoice(null);
    setCallupAt(null);
    setStage('results');
  };

  const submitResult = (forced?: 'DNF') => {
    if (!currentRound) return;
    const parsed = forced === 'DNF' ? { ms: 0, penalty: 'DNF' as const } : parseTimerEntry(entry);
    if (!parsed || parsed.penalty === 'DNS') {
      showToast(tr({ zh: '请输入有效成绩，例如 12.34、1:23.45、DNF 或 12.34+2。', en: 'Enter a valid result like 12.34, 1:23.45, DNF, or 12.34+2.' }));
      entryRef.current?.focus();
      return;
    }
    clearInspectionTimers();
    const penalty = parsed.penalty === 'DNF' ? 'DNF' : (plusTwo || parsed.penalty === '+2' ? '+2' : 'ok');
    const solve = makeCompSimSolve(fromWcaSpelling(eventId), currentScramble, parsed.ms, penalty);
    const nextSolves = [...solves, solve];
    const nextResult = roundResult(nextSolves, currentRound.config);
    setEntry('');
    setPlusTwo(false);
    if (nextResult.complete) {
      finishRound(nextSolves);
      return;
    }
    const nextIndex = nextSolves.length;
    const shouldDuplicate = usedExtras < currentRound.group.extras.length
      && shouldDuplicateScramble(options.duplicateScrambles, nextIndex);
    setCurrentScramble(shouldDuplicate
      ? currentScramble
      : (currentRound.group.scrambles[nextIndex]?.scramble ?? ''));
    setSolves(nextSolves);
    setInspectionStartedAt(null);
    setInspectionVoice(null);
    setCallupAt(options.stationary ? null : Date.now() + callupDelayMs(options.maxWaitMinutes));
    setStage(options.stationary ? 'ready' : 'waiting');
  };

  const handleEntryKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === '2') {
      event.preventDefault();
      setPlusTwo((value) => !value);
    } else if ((event.ctrlKey || event.metaKey) && event.key === '3') {
      event.preventDefault();
      submitResult('DNF');
    } else if (event.key === 'Enter') {
      event.preventDefault();
      submitResult();
    } else if (event.key === ' ') {
      event.preventDefault();
      clearInspectionTimers();
      showToast(tr({ zh: '本把剩余观察提示已取消。', en: 'Remaining inspection cues cancelled for this solve.' }));
    }
  };

  useEffect(() => {
    if (stage !== 'results' || !simRow || !competition || !currentRound) return;
    const result = resultText(simRow, eventId, !!averageFormat);
    const item: SavedRound = {
      key: `${competition.id}|${eventId}|${roundIndex}|${simRow.primary}`,
      competition: localizeCompName(competition.id, competition.name, isZh),
      event: eventDisplayName(eventId, isZh),
      round: roundTypeName(currentRound.roundTypeId, isZh),
      rank: simRow.rank,
      result,
      at: Date.now(),
    };
    setSavedRounds((previous) => {
      if (previous.some((row) => row.key === item.key)) return previous;
      const next = [item, ...previous].slice(0, 30);
      persistItem(SAVED_KEY, JSON.stringify(next));
      return next;
    });
  }, [averageFormat, competition, currentRound, eventId, isZh, roundIndex, simRow, stage]);

  const startNextRound = () => {
    const nextIndex = roundIndex + 1;
    const next = rounds[nextIndex];
    if (!next || !advances) return;
    const adjusted = {
      ...next,
      officialRows: filterNextRoundOfficialRows(
        next.officialRows,
        leaderboard,
        currentRound?.detail.advancementCondition ?? null,
      ),
    };
    setRounds((previous) => previous.map((round, index) => (index === nextIndex ? adjusted : round)));
    setRoundIndex(nextIndex);
    startRound(adjusted);
  };

  const resetSimulation = () => {
    loadRequestId.current += 1;
    clearInspectionTimers();
    if (callupTimer.current !== null) window.clearTimeout(callupTimer.current);
    localStorage.removeItem(ACTIVE_KEY);
    setStage('setup');
    setCompetition(null);
    setCompetitionInput('');
    setEventId('');
    setOptions(DEFAULT_OPTIONS);
    setRounds([]);
    setSolves([]);
    setRoundIndex(0);
    setCurrentScramble('');
    setUsedExtras(0);
    setCallupAt(null);
    setInspectionStartedAt(null);
    setInspectionVoice(null);
    setCrowdVideo(null);
    setError('');
    setToast('');
  };

  const shareResult = async () => {
    if (!simRow || !competition || !currentRound) return;
    const text = `${localizeCompName(competition.id, competition.name, isZh)} — ${eventDisplayName(eventId, isZh)} ${roundTypeName(currentRound.roundTypeId, isZh)}: ${resultText(simRow, eventId, !!averageFormat)} (#${simRow.rank})`;
    try {
      if (navigator.share) await navigator.share({ title: tr({ zh: '比赛模拟成绩', en: 'Competition simulation result' }), text });
      else await navigator.clipboard.writeText(text);
      showToast(tr({ zh: '成绩已分享。', en: 'Result shared.' }));
    } catch {
      // Closing the native share sheet is not an error the page needs to report.
    }
  };

  const renderHeader = () => (
    <header className="comp-sim-header">
      <div className="comp-sim-header-left">
        <BackHome />
        <div>
          <h1>{tr({ zh: '比赛模拟', en: 'Competition Simulator' })}</h1>
          <p>{tr({ zh: '真实比赛、真实对手、每把只有一次机会', en: 'Real competitions, real opponents, one chance per attempt' })}</p>
        </div>
      </div>
      <HeaderToggles />
    </header>
  );

  if (stage === 'setup' || stage === 'loading') {
    return (
      <main className="comp-sim-page">
        {renderHeader()}
        <section className="comp-sim-setup" aria-busy={stage === 'loading'} inert={stage === 'loading' ? true : undefined}>
          <div className="comp-sim-step">
            <span className="comp-sim-step-number">1</span>
            <div className="comp-sim-step-body">
              <h2>{tr({ zh: '使用 WCA 登录', en: 'Sign in with WCA' })}</h2>
              {user?.wcaId ? (
                <p>{tr({ zh: '参赛者', en: 'Competitor' })}: <PersonLink wcaId={user.wcaId} name={user.name} isZh={isZh} /></p>
              ) : (
                <button type="button" className="comp-sim-primary comp-sim-signin" onClick={() => loginWithWca()}>
                  <LogIn size={18} aria-hidden="true" />
                  {tr({ zh: '使用 WCA 继续', en: 'Continue with WCA' })}
                </button>
              )}
            </div>
          </div>

          <div className={`comp-sim-step${!user?.wcaId ? ' is-disabled' : ''}`}>
            <span className="comp-sim-step-number">2</span>
            <div className="comp-sim-step-body">
              <h2>{tr({ zh: '选择比赛', en: 'Select a Competition' })}</h2>
              {user?.wcaId ? (
                <CompPicker
                  value={competitionInput}
                  onChange={(value) => {
                    setCompetitionInput(value);
                    if (competition && value !== competition.name) {
                      loadRequestId.current += 1;
                      setCompetition(null);
                      setEventId('');
                    }
                  }}
                  onPick={pickCompetition}
                  placeholder={tr({ zh: '搜索已结束的 WCA 比赛', en: 'Search completed WCA competitions' })}
                  isZh={isZh}
                  hideFuture
                  hideNotEnded
                  hideCancelled
                />
              ) : (
                <input className="comp-sim-step-input" type="text" disabled placeholder={tr({ zh: '请先使用 WCA 登录', en: 'Continue with WCA first' })} />
              )}
            </div>
          </div>

          <div className={`comp-sim-step${!competition ? ' is-disabled' : ''}`}>
            <span className="comp-sim-step-number">3</span>
            <div className="comp-sim-step-body">
              <h2>{tr({ zh: '选择项目', en: 'Choose an Event' })}</h2>
              {competition && supportedEvents.size > 0 ? (
                <PuzzlePicker
                  isZh={isZh}
                  selectedEvent={eventId}
                  groups={eventGroups}
                  onSelect={(id) => {
                    loadRequestId.current += 1;
                    setEventId(id);
                    setError('');
                  }}
                />
              ) : (
                <p className="comp-sim-muted">{competition
                  ? tr({ zh: '这场比赛没有本站支持的项目。', en: 'No supported events were found.' })
                  : tr({ zh: '选择比赛后可选项目。', en: 'Choose a competition to see its events.' })}</p>
              )}
            </div>
          </div>

          <div className={`comp-sim-step${!eventId ? ' is-disabled' : ''}`}>
            <span className="comp-sim-step-number">4</span>
            <div className="comp-sim-step-body">
              <h2>{tr({ zh: '设置现场', en: 'Set the Scene' })}</h2>
              <div className="comp-sim-options">
                <BoolToggle value={options.inspectionVoice} onChange={(value) => setOptions((old) => ({ ...old, inspectionVoice: value }))} label={tr({ zh: '观察时间语音提示', en: 'Voice alert inspection' })} disabled={!hasSpeech && COMP_SIM_MEDIA.inspectionVoices.length === 0} />
                <BoolToggle value={options.announcements} onChange={(value) => setOptions((old) => ({ ...old, announcements: value }))} label={tr({ zh: '轮次播报', en: 'Round announcements' })} disabled={!hasAnnouncements} />
                <BoolToggle value={options.ambiance} onChange={(value) => setOptions((old) => ({ ...old, ambiance: value }))} label={tr({ zh: '比赛环境声', en: 'Competition ambiance' })} disabled={!hasAmbiance} />
                <BoolToggle value={options.distractions} onChange={(value) => setOptions((old) => ({ ...old, distractions: value }))} label={tr({ zh: '随机声音干扰', en: 'Auditory distractions' })} disabled={!hasDistractions} />
                <BoolToggle value={options.duplicateScrambles} onChange={(value) => setOptions((old) => ({ ...old, duplicateScrambles: value }))} label={tr({ zh: '模拟重复打乱', en: 'Duplicate scrambles' })} />
                <BoolToggle value={options.visuals} onChange={(value) => setOptions((old) => ({ ...old, visuals: value }))} label={tr({ zh: '比赛现场画面', en: 'Competition visuals' })} disabled={!hasVisuals} />
                <BoolToggle value={options.stationary} onChange={(value) => setOptions((old) => ({ ...old, stationary: value }))} label={tr({ zh: '固定座位', en: 'Stationary seating' })} />
              </div>
              {(!hasAmbiance || !hasDistractions || !hasVisuals) && (
                <p className="comp-sim-media-note">
                  {tr({ zh: '音视频素材尚未加入；对应选项会在素材清单补齐后自动启用。', en: 'Audio and video assets have not been added yet; their options will enable automatically when the media manifest is filled.' })}
                </p>
              )}
              <label className="comp-sim-wait">
                <span>{tr({ zh: '每把最长等待', en: 'Max wait between attempts' })}</span>
                <input
                  className="comp-sim-wait-input"
                  type="number"
                  min={1}
                  max={15}
                  step={1}
                  value={options.maxWaitMinutes}
                  onChange={(event) => setOptions((old) => ({
                    ...old,
                    maxWaitMinutes: Math.min(15, Math.max(1, Number(event.target.value) || 1)),
                  }))}
                />
                <span>{tr({ zh: '分钟', en: 'minutes' })}</span>
              </label>
              <button
                type="button"
                className="comp-sim-primary comp-sim-start"
                disabled={!user?.wcaId || !competition || !eventId || stage === 'loading'}
                onClick={startSimulation}
              >
                {stage === 'loading' ? tr({ zh: '正在准备现场…', en: 'Preparing the round…' }) : tr({ zh: '开始模拟', en: 'Start simulation' })}
              </button>
              {status && <p className="comp-sim-status" role="status">{status}</p>}
              {error && <p className="comp-sim-error" role="alert"><CircleAlert size={17} aria-hidden="true" />{error}</p>}
            </div>
          </div>
        </section>

        {savedRounds.length > 0 && (
          <section className="comp-sim-saved" aria-labelledby="comp-sim-saved-title">
            <h2 id="comp-sim-saved-title">{tr({ zh: '本机最近模拟', en: 'Recent simulations on this device' })}</h2>
            <ul>
              {savedRounds.slice(0, 5).map((row) => (
                <li key={row.key}>
                  <span>{row.competition} {row.event} {row.round}</span>
                  <strong>{row.result} #{row.rank}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    );
  }

  if (!competition || !currentRound || !user) return null;

  const competitionName = localizeCompName(competition.id, competition.name, isZh);
  return (
    <main className={`comp-sim-live${crowdVideo && options.visuals && liveMediaActive ? ' has-visuals' : ''}`}>
      {crowdVideo && options.visuals && liveMediaActive && (
        <video
          className="comp-sim-background-video"
          src={crowdVideo.src}
          poster={crowdVideo.poster}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
      )}
      <header className="comp-sim-live-header">
        <div>
          <strong>{competitionName}</strong>
          <span>{eventDisplayName(eventId, isZh)} {roundTypeName(currentRound.roundTypeId, isZh)} {tr({ zh: `第 ${attemptNumber} 把`, en: `Attempt ${attemptNumber}` })}</span>
        </div>
        <button type="button" className="comp-sim-icon-button" onClick={resetSimulation} aria-label={tr({ zh: '新建比赛模拟', en: 'New competition simulation' })}>
          <RotateCcw size={18} aria-hidden="true" />
        </button>
      </header>

      {stage === 'waiting' && (
        <section className="comp-sim-stage" tabIndex={-1}>
          <p className="comp-sim-kicker">{tr({ zh: '打乱并热手', en: 'Scramble and warm up' })}</p>
          <div className="comp-sim-scramble">{currentScramble}</div>
          <p>{tr({ zh: `请打乱并盖住比赛用魔方；热手请使用另一颗魔方。你会在接下来 ${options.maxWaitMinutes} 分钟内收到叫号。`, en: `Scramble and cover your competition puzzle; use another puzzle to warm up. Your call-up will arrive within the next ${options.maxWaitMinutes} minutes.` })}</p>
          <button type="button" className="comp-sim-secondary" onClick={callUp}>
            <FastForward size={18} aria-hidden="true" /> {tr({ zh: '跳过等待', en: 'Skip wait' })}
          </button>
        </section>
      )}

      {stage === 'called' && (
        <section className="comp-sim-stage comp-sim-callup" tabIndex={-1}>
          <p>{displayCuberName(user.name, isZh)}</p>
          <h2>{tr({ zh: `${tableNumber} 号桌`, en: `Table ${tableNumber}` })}</h2>
          <button type="button" className="comp-sim-primary comp-sim-stage-action" onClick={beginInspection}>
            {tr({ zh: '开始观察', en: 'Begin inspection' })}
          </button>
        </section>
      )}

      {stage === 'ready' && (
        <section className="comp-sim-stage" tabIndex={-1}>
          <p className="comp-sim-kicker">{currentIsExtra ? tr({ zh: '备打', en: 'Extra Scramble' }) : tr({ zh: '打乱并盖住魔方', en: 'Scramble and Cover Your Puzzle' })}</p>
          <div className="comp-sim-scramble">{currentScramble}</div>
          <div className="comp-sim-stage-buttons">
            <button type="button" className="comp-sim-secondary comp-sim-stage-button" onClick={useExtra}>{tr({ zh: '备打', en: 'Extra' })}</button>
            <button type="button" className="comp-sim-primary comp-sim-stage-action comp-sim-stage-button" onClick={beginInspection}>{tr({ zh: '开始观察', en: 'Begin inspection' })}</button>
          </div>
        </section>
      )}

      {stage === 'entry' && (
        <section className="comp-sim-entry-stage">
          <p>{tr({ zh: '使用你的实体计时器完成本把，然后录入成绩。', en: 'Complete the attempt on your physical timer, then enter the result.' })}</p>
          <div className="comp-sim-entry-controls">
            <input
              ref={entryRef}
              className="comp-sim-entry-input"
              type="text"
              inputMode="decimal"
              maxLength={16}
              autoComplete="off"
              value={entry}
              placeholder="12.34"
              aria-label={tr({ zh: '本把成绩', en: 'Attempt result' })}
              onChange={(event) => setEntry(event.target.value)}
              onKeyDown={handleEntryKeyDown}
            />
            <button type="button" className="comp-sim-secondary comp-sim-entry-action" onClick={useExtra}>{tr({ zh: '备打', en: 'Extra' })}</button>
            <button type="button" className={`comp-sim-secondary comp-sim-entry-action${plusTwo ? ' is-active' : ''}`} aria-pressed={plusTwo} onClick={() => setPlusTwo((value) => !value)}>+2</button>
            <button type="button" className="comp-sim-secondary comp-sim-entry-action" onClick={() => submitResult('DNF')}>DNF</button>
            <button type="button" className="comp-sim-primary comp-sim-entry-action" onClick={() => submitResult()}>{tr({ zh: '提交', en: 'Submit' })}</button>
          </div>
          <p className="comp-sim-shortcuts">{tr({ zh: 'Enter 提交，Ctrl/⌘+2 切换 +2，Ctrl/⌘+3 记 DNF，空格取消剩余语音提示', en: 'Enter submits; Ctrl/⌘+2 toggles +2; Ctrl/⌘+3 records DNF; Space cancels remaining voice cues' })}</p>
        </section>
      )}

      {stage === 'results' && simRow && (
        <section className="comp-sim-results">
          <div className="comp-sim-results-heading">
            <div>
              <p className="comp-sim-kicker">{tr({ zh: '官方排名模拟', en: 'Simulated official standings' })}</p>
              <h2>{resultText(simRow, eventId, !!averageFormat)}</h2>
              <p>#{simRow.rank}{simRow.xpr ? ` ${tr({ zh: '非官方个人纪录', en: 'Unofficial personal record' })}` : ''}</p>
            </div>
            <button type="button" className="comp-sim-secondary" onClick={shareResult}><Share2 size={17} aria-hidden="true" />{tr({ zh: '分享', en: 'Share' })}</button>
          </div>
          <div className="comp-sim-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tr({ zh: '排名', en: 'Rank' })}</th>
                  <th>{tr({ zh: '选手', en: 'Name' })}</th>
                  {Array.from({ length: currentResult?.attempts ?? 0 }, (_, index) => <th className="comp-sim-attempt-col" key={index}>{index + 1}</th>)}
                  <th className="comp-sim-best-col">{tr({ zh: '单次', en: 'Best' })}</th>
                  <th>{averageFormat ? tr({ zh: '平均', en: 'Average' }) : tr({ zh: '成绩', en: 'Result' })}</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row) => (
                  <tr key={`${row.kind}-${row.wcaId}`} className={row.kind === 'sim' ? 'is-sim' : undefined}>
                    <td>{row.rank}</td>
                    <td>
                      <span className="comp-sim-person">
                        <Flag iso2={row.countryIso2} />
                        <PersonLink wcaId={row.wcaId} name={row.name} isZh={isZh} />
                        {row.kind === 'sim' && <span className="comp-sim-badge">SIM</span>}
                      </span>
                    </td>
                    {Array.from({ length: currentResult?.attempts ?? 0 }, (_, index) => (
                      <td className="comp-sim-attempt-col" key={index}>{attemptText(row.attempts[index] ?? 0, eventId, index === row.bestIndex || index === row.worstIndex)}</td>
                    ))}
                    <td className="comp-sim-best-col">{formatWcaResult(row.best, eventId, 'single')}{row.xprBest && <span className="comp-sim-badge">XPR</span>}</td>
                    <td>{resultText(row, eventId, !!averageFormat)}{row.xprAverage && <span className="comp-sim-badge">XPR</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="comp-sim-results-actions">
            {roundIndex < rounds.length - 1 && (
              <button type="button" className="comp-sim-primary" disabled={!advances} onClick={startNextRound}>
                <Trophy size={18} aria-hidden="true" />
                {advances ? tr({ zh: `开始第 ${roundIndex + 2} 轮`, en: `Start Round ${roundIndex + 2}` }) : tr({ zh: '未晋级下一轮', en: 'Not advanced to the next round' })}
              </button>
            )}
            <button type="button" className="comp-sim-secondary" onClick={resetSimulation}><RotateCcw size={17} aria-hidden="true" />{tr({ zh: '新建模拟', en: 'New simulation' })}</button>
          </div>
        </section>
      )}

      {toast && <div className="comp-sim-toast" role="status">{toast}</div>}
    </main>
  );
}
