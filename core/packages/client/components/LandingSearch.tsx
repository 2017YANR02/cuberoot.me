'use client';

/**
 * Landing-page site search — full port of packages/client-vite/src/components/LandingSearch.tsx.
 *
 * Data layer lives in lib/site-search.ts (cards/tools/lookups/stats/persons/comps/
 * recons/glossary/about/stack/algSets/platform/forum). This component is
 * the dropdown UI shell.
 *
 * Next.js adaptations (vs Vite):
 *  - next/link Link href + useRouter().push instead of react-router
 *  - [lang] path prefix `/${lang}/...` in hrefs instead of ?lang= query
 *  - EventIcon lazy-loaded via next/dynamic (was React.lazy in Vite)
 *  - Browser speech recognition and smart paste reuse the shared hooks/utilities.
 */
import { Tooltip } from '@/components/Tooltip';
import { WcaPersonTeamBadge } from '@/components/WcaPersonTeamBadge';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from '@/components/AppLink';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ImagePlus, Plus, Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin, MessageSquare,
  CalendarDays, LayoutGrid, Wrench, ArrowRight, ArrowUp, X, Square, Search, Clipboard,
  ScanSearch, BookA, BookOpen, Library, Code as CodeIcon, Mic, Sparkles, type LucideIcon,
} from '@app-foundation/icons/lucide';
import { Flag } from '@/components/Flag';
import { RecordBadge } from '@/components/RecordBadge/RecordBadge';
import { displayCuberName } from '@/lib/cuber-name-display';
import { CompCell } from '@/components/CompCell/CompCell';
import { compLinkProps } from '@/lib/comp-link';
import { reconPathSeg } from '@/lib/recon-seo';
import { localizeCity } from '@/lib/city-localize';
import { formatDateRangeIso } from '@/lib/wca-date';
import {
  useSiteSearch,
  METRIC_LABEL_OVERRIDE,
  INITIAL_RENDER_CAP,
  type SiteSearchCard,
  type AlgSetHit,
} from '@/lib/site-search';
import { detectPasteIntent, type PasteIntent } from '@/lib/smart-paste';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import './landing_search.css';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { ensureAssistantConversation, useAssistantWorkspace } from '@/hooks/useAssistantWorkspace';
import { assistantConversations, assistantOwner, type AssistantConversation } from '@/lib/assistant-conversations';
import { tr } from '@/i18n/tr';
import { useAuthUser, useAuthStore } from '@/lib/auth-store';
import { authHeaders } from '@/lib/admin-api';
import { apiUrl } from '@/lib/api-base';
import SiteAssistantDialog, { SiteAssistantAnswerText, type AssistantTurn } from '@/components/SiteAssistantDialog';
import { assistantTimeoutMs, SITE_ASSISTANT_QUESTION_MAX_LENGTH, isAssistantSourceHref, readAssistantEvents, type AssistantStreamEvent, type AssistantStatus, type AssistantAnswer, type AssistantErrorCode, type AssistantImage } from '@cuberoot/shared/site-assistant';
import { ASSISTANT_ERROR_TEXT, assistantResponseError } from '@/lib/site-assistant-errors';
import { useAssistantThinkingMode } from '@/hooks/useAssistantThinkingMode';
import { requestSiteAssistant, assistantImageHistory } from '@/lib/site-assistant-request';
import type { AssistantConversationSnapshot } from '@/lib/assistant-conversations';
import { ALG_PUZZLES, type AlgCase } from '@cuberoot/shared/alg';

// EventIcon inlines all WCA event SVGs (~68KB gzip);only used in recon hits.
const EventIcon = dynamic(
  () => import('@/components/EventIcon/EventIcon').then(m => ({ default: m.EventIcon })),
  {
    ssr: false,
    // 同尺寸空位:图标晚到时结果行不左右抖(CSS 里是 1.2em 见方)。
    loading: () => <span className="landing-search-event-icon" aria-hidden="true" />,
  },
);

const CaseThumb = dynamic(
  () => import('@/components/CaseThumb').then(m => ({ default: m.CaseThumb })),
  { ssr: false },
);

function AlgSetResultThumb({ hit }: { hit: AlgSetHit }) {
  const [firstCase, setFirstCase] = useState<AlgCase | null>(null);
  const puzzle = ALG_PUZZLES.find(candidate => candidate === hit.puzzle);

  useEffect(() => {
    if (!puzzle) return;
    let cancelled = false;
    void import('@/lib/alg_case_alignment').then(({ loadAlg }) => loadAlg(puzzle, hit.setSlug))
      .then(data => { if (!cancelled) setFirstCase(data.cases[0] ?? null); })
      .catch(() => { if (!cancelled) setFirstCase(null); });
    return () => { cancelled = true; };
  }, [puzzle, hit.setSlug]);

  if (!puzzle || !firstCase) return null;

  const alg = firstCase.algs.flat()[0]?.alg ?? firstCase.standard ?? '';
  return (
    <CaseThumb
      puzzle={puzzle}
      set={hit.setSlug}
      sticker={firstCase.sticker}
      alg={alg}
      setup={firstCase.setup}
      size={36}
      local
      sq1SideBySide={puzzle === 'sq1'}
    />
  );
}

const ICON_MAP: Record<string, LucideIcon> = {
  Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin,
};

export type LandingSearchCard = SiteSearchCard;

const RECON_INITIAL_CAP = 10;
const COMP_INITIAL_CAP = 10;

const SPEECH_ERRORS: Record<string, { zh: string; en: string }> = {
  unsupported: { zh: '此浏览器不支持网页语音输入，请使用键盘上的听写功能或打字搜索。', en: 'This browser does not support voice input. Use keyboard dictation or type your search.' },
  'not-allowed': { zh: '无法使用麦克风，请检查网站和系统的麦克风权限。', en: 'Microphone access was denied. Check microphone permissions for this site and your system.' },
  'audio-capture': { zh: '无法获取麦克风声音，请检查输入设备。', en: 'Cannot capture audio. Check your microphone input device.' },
  network: { zh: '无法连接语音识别服务，请重试，或使用键盘上的听写功能。', en: 'Cannot connect to speech recognition. Retry or use keyboard dictation.' },
  'no-speech': { zh: '没有识别到文字，请检查麦克风是否静音、输入设备是否正确，然后重试。', en: 'No words were recognized. Check that the correct microphone is selected and unmuted, then retry.' },
  timeout: { zh: '语音识别长时间没有返回结果，已停止。请重试，或使用键盘上的听写功能。', en: 'Speech recognition did not respond in time and has stopped. Retry or use keyboard dictation.' },
  'language-not-supported': { zh: '语音服务不支持当前语言，请使用键盘上的听写功能。', en: 'The speech service does not support this language. Use keyboard dictation.' },
  'service-not-allowed': { zh: '浏览器的语音识别服务不可用，请使用键盘上的听写功能或打字搜索。', en: 'The browser speech service is unavailable. Use keyboard dictation or type your search.' },
  aborted: { zh: '语音识别已中断，请重试。', en: 'Speech recognition was interrupted. Please retry.' },
};

const PLACEHOLDERS_ZH = [
  '今天从哪里开始?',
  '最近在参加什么比赛?',
  '想查谁的成绩?',
  '哪个项目的世界纪录?',
  '想看哪一年的统计?',
  '哪个公式还没背会?',
  '今天练 PLL 还是 OLL?',
  '上周末谁拿了冠军?',
  '想复盘哪场比赛?',
  '中国选手谁最快?',
  '哪个赛事即将开始?',
  '想学什么新方法?',
];
const PLACEHOLDERS_EN = [
  'Where to start today?',
  'Which comp are you at?',
  'Look up a cuber?',
  'Find a world record?',
  'Browse stats by year?',
  'Which alg to drill?',
  'PLL or OLL today?',
  'Who won last weekend?',
  'Recon a recent solve?',
  'Search a competition?',
  'Try a new method?',
  'Curious about an event?',
];

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const current = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((current - start) / 86400000);
}

function rotatingPlaceholder(isZh: boolean, day: number): string {
  const list = (isZh ? PLACEHOLDERS_ZH : PLACEHOLDERS_EN);
  return list[day % list.length];
}

function HeaderMore({ overflow, title, href, onClick }: {
  overflow: number;
  title: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      +{overflow}
      <ArrowRight size={12} strokeWidth={1.75} />
    </>
  );
  if (href) {
    return (
      <Link href={href} prefetch={false} className="landing-search-header-more" onClick={onClick} title={title}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className="landing-search-header-more" onClick={onClick} title={title}>
      {inner}
    </button>
  );
}

interface Props {
  /** Reuse the same request/composer implementation inside the chat workspace. */
  conversation?: { initial: AssistantConversationSnapshot; active: boolean; onChange: (snapshot: Partial<AssistantConversationSnapshot>) => void; owner: string; id: string; pending?: AssistantConversation['pending'] };
  workspaceEntry?: boolean;

  cards: LandingSearchCard[];
  lang: 'zh' | 'en';
  /** Controlled query for the standalone /search page. Omit on the homepage. */
  query?: string;
  onQueryChange?: (query: string) => void;
  /** Keep results in document flow instead of behaving like a dismissible dropdown. */
  persistentResults?: boolean;
  autoFocus?: boolean;
}

export default function LandingSearch({
  cards,
  lang,
  query: controlledQuery,
  onQueryChange,
  persistentResults = false,
  autoFocus = false,
  conversation,
  workspaceEntry = false,
}: Props) {
  const isZh = lang === 'zh';
  const assistantUser = useAuthUser();
  const owner = assistantOwner(assistantUser);
  const workspace = useAssistantWorkspace(owner);
  const currentChat = workspace.conversations.find(chat => chat.id === workspace.activeId);
  const params = useParams<{ lang?: string }>();
  // Pattern B: English is the bare path → empty prefix; only Chinese is /zh.
  const effLang = params?.lang === 'zh' || params?.lang === 'en' ? params.lang : lang;
  const langPrefix = effLang === 'zh' ? '/zh' : '';
  const [internalQuery, setInternalQuery] = useState('');
  const query = conversation ? conversation.initial.draft : workspaceEntry ? currentChat?.snapshot.draft ?? '' : controlledQuery ?? internalQuery;
  const setQuery = useCallback((value: string) => {
    if (workspaceEntry) {
      assistantConversations.patch(owner, ensureAssistantConversation(owner).id, { draft: value });
      return;
    }
    if (controlledQuery === undefined) setInternalQuery(value);
    onQueryChange?.(value);
  }, [controlledQuery, onQueryChange, workspaceEntry, owner]);
  const [open, setOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceAction, setVoiceAction] = useState<'stop' | 'send' | null>(null);
  const { listening, waveform, waveformOffset, status: micStatus, error: micError, microphone, start: micStart, stop: micStop, cancel: micCancel } = useSpeechToText({
    visualizeAudio: true,
    continuous: true,
    lang: isZh ? 'zh-CN' : 'en-US',
    onResult: (text) => { setVoiceText(text); },
  });
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  usePanelClamp(plusMenuOpen, plusMenuRef);
  // SSR 和 hydration 首帧固定用同一个文案;挂载后才读取当天日期。
  // 否则服务器与手机跨 UTC 日期时会各选中相邻文案,触发 React #418。
  const [placeholderDay, setPlaceholderDay] = useState(0);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [expandedPersons, setExpandedPersons] = useState(false);
  const [expandedRecons, setExpandedRecons] = useState(false);
  const [expandedGlossary, setExpandedGlossary] = useState(false);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [assistantDialog, setAssistantDialog] = useState(false);
  const [localDraft, setLocalDraft] = useState('');
  const [localImages, setLocalImages] = useState<AssistantImage[]>([]);
  const assistantDraft = conversation ? conversation.initial.draft : localDraft;
  const assistantImages = conversation ? conversation.initial.images : localImages;
  const updateConversation = conversation?.onChange;
  const setAssistantDraft = useCallback((draft: string) => updateConversation ? updateConversation({ draft }) : setLocalDraft(draft), [updateConversation]);
  const setAssistantImages = useCallback((images: AssistantImage[]) => updateConversation ? updateConversation({ images }) : setLocalImages(images), [updateConversation]);
  const [assistantThinking, setAssistantThinking] = useAssistantThinkingMode();
  const [assistantTurns, setAssistantTurns] = useState<AssistantTurn[]>(conversation?.initial.turns ?? []);
  const assistantConversation = useRef<string | null>(conversation?.initial.conversationId ?? null);
  const assistantRequest = useRef<AbortController | null>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatus>({ phase: 'planning' });
  const [assistantError, setAssistantError] = useState<AssistantErrorCode | null>(null);
  const [assistantAnswer, setAssistantAnswer] = useState<AssistantAnswer | null>(null);

  useEffect(() => {
    if (conversation) return;
    assistantRequest.current?.abort();
    assistantRequest.current = null;
    setAssistantBusy(false);
    setAssistantTurns([]);
    assistantConversation.current = null;
    setAssistantDraft('');
    setAssistantImages([]);
    setAssistantAnswer(null);
    setAssistantError(null);
  }, [assistantUser?.uid, assistantUser?.wcaId]);

  useEffect(() => {
    assistantRequest.current?.abort();
    assistantRequest.current = null;
    setAssistantBusy(false);
    setAssistantError(null);
    setAssistantAnswer(null);
    return () => { assistantRequest.current?.abort(); assistantRequest.current = null; };
  }, [conversation ? '' : query, lang]);

  const onConversationChange = conversation?.onChange;
  useEffect(() => {
    onConversationChange?.({ turns: assistantTurns, conversationId: assistantConversation.current });
  }, [assistantTurns, onConversationChange]);

  const stopAssistant = () => { assistantRequest.current?.abort(); assistantRequest.current = null; setAssistantBusy(false); };
  const closeAssistant = useCallback(() => { assistantRequest.current?.abort(); assistantRequest.current = null; setAssistantBusy(false); setAssistantDialog(false); }, []);
  const askAssistant = async (question = query, replaceLast = false, images: AssistantImage[] = []) => {
    question = question.trim();
    if (workspaceEntry) {
      const chat = ensureAssistantConversation(owner);
      const attachments = images.length ? images : chat.snapshot.images;
      if ((!question && !attachments.length) || question.length > SITE_ASSISTANT_QUESTION_MAX_LENGTH) return;
      micStop();
      setOpen(false);
      setPlusMenuOpen(false);
      assistantConversations.submit(owner, chat.id, question, attachments);
      router.push(`${langPrefix}/chat`);
      return;
    }
    if ((!question && !images.length) || question.length > SITE_ASSISTANT_QUESTION_MAX_LENGTH || assistantRequest.current) return;
    const completed = (replaceLast ? assistantTurns.slice(0, -1) : assistantTurns).filter(turn => turn.result);
    // Release older attachment bytes without erasing the visible conversation.
    const previous = completed.map((turn, index) => index < completed.length - 9 && turn.images?.length ? { ...turn, images: undefined, imagesExpired: true } : turn);
    const createdAt = Date.now();
    const nextTurns = [...previous, { question, images, createdAt }];
    setAssistantTurns(nextTurns);
    setAssistantDialog(true);
    micStop();
    if (!assistantUser || !/^\d{4}[A-Z]{4}\d{2}$/.test(assistantUser.wcaId)) {
      setAssistantError(assistantUser ? 'wca_link_required' : 'login_required');
      setAssistantAnswer(null);
      return;
    }
    const controller = new AbortController();
    assistantRequest.current = controller;
    setOpen(true);
    setAssistantBusy(true);
    setAssistantStatus({ phase: 'planning' });
    setAssistantError(null);
    setAssistantAnswer(null);
    const timeout = setTimeout(() => controller.abort(), assistantTimeoutMs(assistantThinking));
    try {
      assistantConversation.current ??= crypto.randomUUID();
      const response = await requestSiteAssistant(apiUrl('/v1/site-assistant'), {
        conversationId: assistantConversation.current, parentId: previous.at(-1)?.requestId, retryOf: replaceLast ? assistantTurns.at(-1)?.requestId : undefined,
        question, lang, thinking: assistantThinking, ...(images.length ? {images} : {}), timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,
        history: assistantImageHistory(previous.filter(turn => !turn.partial).slice(-5).flatMap(turn => [{ role: 'user', content: turn.question, ...(turn.images?.length ? {images:turn.images} : {}) }, { role: 'assistant', content: turn.result!.answer }]), images),
      }, {headers: { ...authHeaders(), Accept: 'text/event-stream' },signal: controller.signal});
      const requestId = response.headers.get('X-Assistant-Request-Id') ?? undefined;
      if (assistantRequest.current === controller) setAssistantTurns([...previous, { question, images, requestId, createdAt }]);
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        if (assistantRequest.current === controller) setAssistantError(assistantResponseError(response, failure));
        return;
      }
      const applyAnswer = (data: AssistantAnswer, partial = false) => {
        if (typeof data.answer !== 'string' || !Array.isArray(data.sources)) throw new Error('invalid response');
        if (assistantRequest.current !== controller) return;
        const result: AssistantAnswer = { answer: data.answer, actions: data.actions?.filter(action => typeof action.href === 'string' && isAssistantSourceHref(action.href)), artifacts: Array.isArray(data.artifacts) ? data.artifacts : [], sources: data.sources.filter(source => typeof source.href === 'string' && isAssistantSourceHref(source.href)) };
        if (!partial) {
          setAssistantAnswer(result);
          if (conversation) assistantConversations.replyCompleted(conversation.owner, conversation.id);
        }
        setAssistantTurns([...previous, { question, images, result, partial, requestId, createdAt }]);
      };
      if (response.headers?.get('content-type')?.includes('text/event-stream')) {
        if (!response.body) throw new Error('missing stream');
        let ended = false;
        for await (const raw of readAssistantEvents(response.body)) {
          if (assistantRequest.current !== controller) return;
          const event = JSON.parse(raw) as AssistantStreamEvent;
          if (event.type === 'status') setAssistantStatus(event.status);
          else if (event.type === 'answer') applyAnswer(event, true);
          else if (event.type === 'done') { applyAnswer(event.result); ended = true; break; }
          else if (event.type === 'error') {
            setAssistantError(assistantResponseError(response, { error: event.error })); ended = true; break;
          }
        }
        if (!ended) throw new TypeError('incomplete assistant stream');
      } else applyAnswer(await response.json());

    } catch(error) {
      if (assistantRequest.current === controller) setAssistantError(controller.signal.aborted ? 'timeout' : error instanceof TypeError ? 'network' : 'unavailable');
    } finally {
      clearTimeout(timeout);
      if (assistantRequest.current === controller) { assistantRequest.current = null; setAssistantBusy(false); }
    }
  };

  // Only the mounted conversation consumes a homepage submission. The atomic
  // take prevents StrictMode or store notifications from sending it twice.
  useEffect(() => {
    if (!conversation?.pending || assistantRequest.current) return;
    let active = true;
    queueMicrotask(() => {
      if (!active || assistantRequest.current) return;
      const pending = assistantConversations.takeSubmission(conversation.owner, conversation.id);
      if (pending) void askAssistant(pending.question, false, pending.images);
    });
    return () => { active = false; };
  }, [conversation?.pending, conversation?.owner, conversation?.id, assistantBusy]);

  useEffect(() => {
    if (!workspaceEntry || !workspace.open) return;
    setOpen(false);
    setPlusMenuOpen(false);
    textInputRef.current?.blur();
    micStop();
  }, [workspaceEntry, workspace.open]);

  useEffect(() => {
    setPlaceholderDay(dayOfYear(new Date()));
  }, []);

  const {
    q, localSearchError,
    cardMatches, toolMatches, lookupMatches, statMatches,
    personMatches, compMatches,
    reconMatches, glossaryMatches, aboutMatches, stackMatches, algSetMatches,
    platformMatches, platformSearchError,
    forumMatches, forumTotal, forumSearchError,
    translationMatches, translationSearchError, translationStale,
    totalCount, yearMatch,
  } = useSiteSearch((conversation && !conversation.active) || (workspaceEntry && workspace.open) ? '' : query, 'lazy', { cards });

  useEffect(() => {
    setExpandedPersons(false);
    setExpandedRecons(false); setExpandedGlossary(false);
  }, [q]);

  const visiblePersons = expandedPersons ? personMatches : personMatches.slice(0, INITIAL_RENDER_CAP);
  const visibleComps = compMatches.slice(0, COMP_INITIAL_CAP);
  const visibleRecons = expandedRecons ? reconMatches : reconMatches.slice(0, RECON_INITIAL_CAP);
  const visibleGlossary = expandedGlossary ? glossaryMatches : glossaryMatches.slice(0, INITIAL_RENDER_CAP);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Wait for stop() to deliver its final transcript before editing or sending.
  useEffect(() => {
    if (!voiceMode || listening) return;
    if (micError) {
      setVoiceMode(false);
      setVoiceAction(null);
      if (voiceText) setQuery(voiceText);
      return;
    }
    if (!voiceAction) return;
    setVoiceMode(false);
    setVoiceAction(null);
    if (voiceAction === 'send') void askAssistant(voiceText);
    else { setQuery(voiceText); setOpen(true); }
  });

  const showDropdown = !voiceMode && (persistentResults || open) && q !== '';

  // Prepend [lang] segment to internal paths. Vite uses ?lang= query;
  // Next uses /<lang>/* path prefix.
  const langHref = (path: string, extraQuery?: string): string => {
    const url = `${langPrefix}${path}`;
    return extraQuery ? `${url}?${extraQuery}` : url;
  };
  const hrefWithQuery = (path: string, extraQuery?: string): string => (
    extraQuery ? `${path}?${extraQuery}` : path
  );

  const closeAfter = () => {
    setOpen(false);
    if (conversation) assistantConversations.setOpen(conversation.owner, false);
    if (!persistentResults && !workspaceEntry && !conversation) setQuery('');
  };
  const goCard = (c: LandingSearchCard) => {
    closeAfter();
    if (c.internal) router.push(langHref(c.href));
    else window.location.href = c.href;
  };

  // 直接在框里输入/粘贴 WCA URL / 打乱 / cubing.com 等 → 识别为对应工具的跳转意图
  const pasteIntent = useMemo(() => detectPasteIntent(query), [query]);
  const goPasteIntent = (intent: PasteIntent) => {
    closeAfter();
    setPlusMenuOpen(false);
    router.push(`${langPrefix}${intent.route}`);
  };

  // Enter on the search box → jump to the first result, following the same
  // top-to-bottom order the dropdown renders its sections in.
  const pushInternal = (href: string) => { closeAfter(); router.push(href); };
  const goFirstResult = () => {
    if (personMatches.length > 0) { pushInternal(langHref(`/wca/persons/${personMatches[0].wcaId}`)); return; }
    if (yearMatch) { pushInternal(langHref('/wca/comp', `year=${yearMatch}`)); return; }
    if (pasteIntent) { goPasteIntent(pasteIntent); return; }
    if (translationMatches.length > 0) { pushInternal(langHref('/regulation/translation/search', `q=${encodeURIComponent(query.trim())}`)); return; }
    if (forumMatches.length > 0) { pushInternal(langHref(`/forum/t/${forumMatches[0].id}`)); return; }
    if (platformMatches.length > 0) { pushInternal(langHref(platformMatches[0].href)); return; }
    if (cardMatches.length > 0) { goCard(cardMatches[0]); return; }
    if (toolMatches.length > 0) { pushInternal(langHref(toolMatches[0].path)); return; }
    if (lookupMatches.length > 0) { pushInternal(langHref(lookupMatches[0].path, lookupMatches[0].extraQuery)); return; }
    if (statMatches.length > 0 && statMatches[0].items.length > 0) {
      const it = statMatches[0].items[0];
      if (it.kind === 'stat') pushInternal(langHref(`/wca/${it.stat.id}`));
      else pushInternal(`${langHref(`/wca/${it.parent.id}`)}#metric=${it.metric.id}`);
      return;
    }
    if (aboutMatches.length > 0) { pushInternal(langHref(`/wca/about/${aboutMatches[0].id}`)); return; }
    if (stackMatches.length > 0) { pushInternal(langHref(`/dev/stack/${stackMatches[0].slug}`)); return; }
    if (glossaryMatches.length > 0) { pushInternal(`${langHref('/wiki')}#${glossaryMatches[0].slug}`); return; }
    if (algSetMatches.length > 0) { pushInternal(langHref(algSetMatches[0].path)); return; }
    if (compMatches.length > 0) {
      pushInternal(compLinkProps(compMatches[0].id, undefined, lang).href);
      return;
    }
    if (reconMatches.length > 0) { pushInternal(langHref(`/recon/${reconPathSeg(reconMatches[0])}`)); return; }
  };

  // Smart paste — 读剪贴板,识别 WCA URL / 打乱 / cubing.com 等并跳转;识别不出就当搜索词。
  const onSmartPaste = async () => {
    setPlusMenuOpen(false);
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch { /* 权限拒绝 / 无 API */ }
    if (!text) {
      textInputRef.current?.focus();
      return;
    }
    const intent = detectPasteIntent(text);
    if (intent) {
      goPasteIntent(intent);
    } else {
      setQuery(text);
      setOpen(true);
    }
  };

  useEffect(() => {
    if (!plusMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPlusMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [plusMenuOpen]);

  // Persons section is rendered inline normally, but pushed to the bottom for a
  // bare year query (e.g. "2026" matches every 2026-registered WCA ID prefix —
  // noise the user didn't ask for; the year-calendar shortcut takes the top).
  const personsSection = personMatches.length > 0 ? (
    <section className="landing-search-section">
      <div className="landing-search-section-header">
        <UserRound size={14} strokeWidth={1.75} />
        <h3>{tr({ zh: '选手', en: 'Persons'
        })}</h3>
        {!expandedPersons && personMatches.length > INITIAL_RENDER_CAP && (
          <HeaderMore
            overflow={personMatches.length - INITIAL_RENDER_CAP}
            title={(isZh ? `展开全部 ${personMatches.length} 位` : `Expand all ${personMatches.length}`)}
            onClick={() => setExpandedPersons(true)}
          />
        )}
      </div>
      <div className="landing-search-grid">
        {visiblePersons.map(p => (
          <Link
            key={p.wcaId}
            href={`/wca/persons/${p.wcaId}`}
            prefetch={false}
            className="landing-search-item landing-search-item--rich"
            onClick={closeAfter}
          >
            <Flag iso2={p.iso2} className="country-flag" />
            <span className="landing-search-item-main">
              <span className="landing-search-item-name">{displayCuberName(p.name, isZh)}<WcaPersonTeamBadge wcaId={p.wcaId} /></span>
              <span className="landing-search-item-meta">{p.wcaId}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  ) : null;

  const searchResults = (
<div className={conversation ? "site-assistant-search-results" : "landing-search-panel"}>
          {personsSection}
          {!conversation && (assistantBusy || assistantError || assistantAnswer || query.trim().length > SITE_ASSISTANT_QUESTION_MAX_LENGTH) && (
          <section className="landing-search-section landing-search-answer" aria-live="polite" aria-busy={assistantBusy}>
            {assistantBusy ? <p>{tr({ zh: '正在回答…', en: 'Preparing an answer…' })}</p>
              : assistantError ? <>
                <p>{tr(ASSISTANT_ERROR_TEXT[assistantError])}</p>
                {(assistantError === 'login_required' || assistantError === 'wca_link_required') && <button type="button" className="landing-search-item" onClick={() => useAuthStore.getState().login()}>{tr({ zh: '前往账号页', en: 'Go to account' })}</button>}
                {totalCount > 0 && <button type="button" className="landing-search-item" onClick={goFirstResult}>{tr({ zh: '打开首个搜索结果', en: 'Open the first search result' })}</button>}
              </> : assistantAnswer ? <>
                <div className="landing-search-answer-text"><SiteAssistantAnswerText result={assistantAnswer}/></div>
                <button type="button" className="landing-search-item" onClick={() => setAssistantDialog(true)}>{tr({zh:'继续对话',en:'Continue conversation'})}</button>

              </> : <p>{tr({ zh: `请把问题缩短到 ${SITE_ASSISTANT_QUESTION_MAX_LENGTH} 字以内。`, en: `Please keep your question within ${SITE_ASSISTANT_QUESTION_MAX_LENGTH} characters.` })}</p>}
          </section>
          )}
          {yearMatch && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <CalendarDays size={14} strokeWidth={1.75} />
                <h3>{tr({ zh: '年份', en: 'Year' })}</h3>
              </div>
              <div className="landing-search-grid">
                <Link
                  href={hrefWithQuery('/wca/comp', `year=${yearMatch}`)}
                  prefetch={false}
                  className="landing-search-item"
                  onClick={closeAfter}
                >
                  <span className="landing-search-item-name">{(isZh ? `${yearMatch} 年比赛日历` : `${yearMatch} competitions`)}</span>
                  <span className="landing-search-item-meta">{tr({ zh: '查看该年所有比赛', en: 'All competitions that year'
                })}</span>
                </Link>
              </div>
            </section>
          )}
          {pasteIntent && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <Sparkles size={14} strokeWidth={1.75} />
                <h3>{tr({ zh: '智能识别', en: 'Smart'
                })}</h3>
              </div>
              <div className="landing-search-grid">
                <button
                  type="button"
                  className="landing-search-item"
                  onClick={() => goPasteIntent(pasteIntent)}
                >
                  <span className="landing-search-item-name">{(isZh ? pasteIntent.labelZh : pasteIntent.labelEn)}</span>
                  <span className="landing-search-item-meta">
                    {query.trim().slice(0, 60)}{query.trim().length > 60 ? '…' : ''}
                  </span>
                </button>
              </div>
            </section>
          )}

          {(translationMatches.length > 0 || translationSearchError) && (
            <section className="landing-search-section landing-search-translations">
              <div className="landing-search-section-header">
                <BookA size={14} strokeWidth={1.75} />
                <h3>{tr({ zh: 'WCA 官方译文', en: 'WCA official translations' })}</h3>
                <Link href={'/regulation/translation/search?q=' + encodeURIComponent(query.trim())} prefetch={false} onClick={closeAfter}>
                  {tr({ zh: '更多译文', en: 'More translations' })} →
                </Link>
              </div>
              {translationSearchError && <p role="status">{tr({ zh: '译文查询暂时不可用，其他搜索不受影响。', en: 'Translation search is unavailable. Other searches are still available.' })}</p>}
              {translationStale && <p role="status">{tr({ zh: '译文同步数据较旧，请核对官方出处。', en: 'The translation snapshot is older. Check the official source.' })}</p>}
              <div className="landing-search-grid">
                {translationMatches.map(match => <Link
                  key={`${match.component}:${match.unitId}`}
                  href={`/regulation/translation/search?q=${encodeURIComponent(query.trim())}#translation-${match.component}-${match.unitId}`}
                  prefetch={false} className="landing-search-item" onClick={closeAfter}
                >
                  <span className="landing-search-item-name" lang="en">{match.en}</span>
                  <span className="landing-search-item-meta" lang="zh-Hans">{match.zh}</span>
                </Link>)}
              </div>
            </section>
          )}

          {(forumMatches.length > 0 || forumSearchError) && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <MessageSquare size={14} strokeWidth={1.75} />
                <h3>{tr({ zh: '论坛', en: 'Forum' })}</h3>
                {forumTotal > forumMatches.length && <HeaderMore
                  overflow={forumTotal - forumMatches.length}
                  title={tr({ zh: '查看全部论坛结果', en: 'View all forum results' })}
                  href={'/forum/search?q=' + encodeURIComponent(query.trim())}
                  onClick={closeAfter}
                />}
              </div>
              {forumSearchError && <p role="status">{tr({ zh: '论坛搜索暂时不可用。', en: 'Forum search is temporarily unavailable.' })}</p>}
              <div className="landing-search-grid">
                {forumMatches.map(thread => <Link
                  key={thread.id}
                  href={`/forum/t/${thread.id}`}
                  prefetch={false}
                  className="landing-search-item"
                  onClick={closeAfter}
                >
                  <span className="landing-search-item-name">{thread.title}</span>
                  {thread.snippet && <span className="landing-search-item-meta">{thread.snippet}</span>}
                </Link>)}
              </div>
            </section>
          )}

          {/* 纯年份查询只看年份相关(选手 + 年份直达 + 比赛);
              抑制这些泛文本匹配类,否则 tagline/术语里碰巧含 "2026" 的会混进来 */}
          {!yearMatch && (
          <>
          {(platformMatches.length > 0 || platformSearchError) && <section className="landing-search-section">
            <div className="landing-search-section-header"><Library size={14} strokeWidth={1.75} /><h3>{tr({ zh: '课程、活动与商城', en: 'Courses, events and shop' })}</h3></div>
            {platformSearchError && <p role="status">{tr({ zh: '课程与商城搜索暂时不可用，其他结果仍可浏览。', en: 'Course and shop search is temporarily unavailable. Other results are still available.' })}</p>}
            <div className="landing-search-grid">{platformMatches.slice(0, 12).map(item => <Link key={item.type + ':' + item.id} href={item.href} prefetch={false} className="landing-search-item" onClick={closeAfter}>
              <span className="landing-search-item-name">{tr({ zh: item.titleZh || item.titleEn, en: item.titleEn || item.titleZh })}</span>
            </Link>)}</div>
            {platformMatches.length > 12 && <Link href={'/platform/search?q=' + encodeURIComponent(query.trim())} prefetch={false} onClick={closeAfter}>{tr({ zh: '查看全部内容结果', en: 'View all content results' })}</Link>}
          </section>}
          {algSetMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <Library size={14} strokeWidth={1.75} />
                <h3>{tr({ zh: '公式库', en: 'Algorithms'
                })}</h3>
              </div>
              <div className="landing-search-grid">
                {algSetMatches.map(a => (
                  <Link
                    key={`${a.puzzle}/${a.setSlug}`}
                    href={a.path}
                    prefetch={false}
                    className="landing-search-item landing-search-item--alg"
                    onClick={closeAfter}
                  >
                    <EventIcon event={a.puzzle} className="landing-search-event-icon" />
                    <div className="landing-search-alg-thumb">
                      <AlgSetResultThumb hit={a} />
                    </div>
                    <span className="landing-search-item-name">{tr({ zh: a.nameZh, en: a.nameEn })}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {cardMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <LayoutGrid size={14} strokeWidth={1.75} />
                <h3>{tr({ zh: '页面', en: 'Pages'
                })}</h3>
              </div>
              <div className="landing-search-grid">
                {cardMatches.map(c => (
                  <Link
                    key={c.id}
                    href={c.href}
                    prefetch={false}
                    className="landing-search-item"
                    onClick={closeAfter}
                  >
                    <span className="landing-search-item-name">{(isZh ? c.nameZh : c.nameEn)}</span>
                    <span className="landing-search-item-meta">{(isZh ? c.sectionTitleZh : c.sectionTitleEn)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {toolMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <Wrench size={14} strokeWidth={1.75} />
                <h3>{tr({ zh: '工具', en: 'Tools' })}</h3>
              </div>
              <div className="landing-search-grid">
                {toolMatches.map(it => (
                  <Link
                    key={it.path}
                    href={it.path}
                    prefetch={false}
                    className="landing-search-item"
                    onClick={closeAfter}
                  >
                    <span className="landing-search-item-name">{tr(it)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {lookupMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <Search size={14} strokeWidth={1.75} />
                <h3>{tr({ zh: '查询', en: 'Lookup'
                })}</h3>
              </div>
              <div className="landing-search-grid">
                {lookupMatches.map(it => (
                  <Link
                    key={`${it.path}|${it.extraQuery ?? ''}|${it.en}`}
                    href={hrefWithQuery(it.path, it.extraQuery)}
                    prefetch={false}
                    className="landing-search-item"
                    onClick={closeAfter}
                  >
                    <span className="landing-search-item-name">{tr(it)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {statMatches.map(({ cat, items }) => {
            const Icon = ICON_MAP[cat.iconName || ''];
            return (
              <section key={cat.nameEn} className="landing-search-section">
                <div className="landing-search-section-header">
                  {Icon && <Icon size={14} strokeWidth={1.75} />}
                  <h3>{(isZh ? cat.nameZh : cat.nameEn)}</h3>
                </div>
                <div className="landing-search-grid">
                  {items.map(it => {
                    if (it.kind === 'stat') {
                      const s = it.stat;
                      return (
                        <Link
                          key={`s:${s.id}`}
                          href={`/wca/${s.id}`}
                          prefetch={false}
                          className="landing-search-item"
                          onClick={closeAfter}
                        >
                          <span className="landing-search-item-name">{(isZh ? s.titleZh : s.titleEn)}</span>
                        </Link>
                      );
                    }
                    const { parent, metric } = it;
                    const parentTitle = (isZh ? parent.titleZh : parent.titleEn);
                    const metricLabel = METRIC_LABEL_OVERRIDE[metric.labelEn] ?? ((isZh ? metric.labelZh : metric.labelEn));
                    return (
                      <Link
                        key={`m:${parent.id}:${metric.id}`}
                        href={`/wca/${parent.id}#metric=${metric.id}`}
                        prefetch={false}
                        className="landing-search-item"
                        onClick={closeAfter}
                      >
                        <span className="landing-search-item-name">{parentTitle} · {metricLabel}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {aboutMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <BookOpen size={14} strokeWidth={1.75} />
                <h3>{tr({ zh: '算法说明', en: 'About'
                })}</h3>
              </div>
              <div className="landing-search-grid">
                {aboutMatches.map(a => (
                  <Link
                    key={a.id}
                    href={`/wca/about/${a.id}`}
                    prefetch={false}
                    className="landing-search-item"
                    onClick={closeAfter}
                  >
                    <span className="landing-search-item-name">{(isZh ? a.titleZh : a.titleEn)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {stackMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <CodeIcon size={14} strokeWidth={1.75} />
                <h3>{tr({ zh: '技术栈', en: 'Stack'
                })}</h3>
              </div>
              <div className="landing-search-grid">
                {stackMatches.map(s => (
                  <Link
                    key={s.slug}
                    href={`/dev/stack/${s.slug}`}
                    prefetch={false}
                    className="landing-search-item"
                    onClick={closeAfter}
                  >
                    <span className="landing-search-item-name">{s.name}</span>
                    <span className="landing-search-item-meta">{isZh ? s.zh.tagline : s.en.tagline}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {glossaryMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <BookA size={14} strokeWidth={1.75} />
                <h3>{tr({ zh: '术语', en: 'Glossary'
                })}</h3>
                {!expandedGlossary && glossaryMatches.length > INITIAL_RENDER_CAP && (
                  <HeaderMore
                    overflow={glossaryMatches.length - INITIAL_RENDER_CAP}
                    title={(isZh ? `展开全部 ${glossaryMatches.length} 条` : `Expand all ${glossaryMatches.length}`)}
                    onClick={() => setExpandedGlossary(true)}
                  />
                )}
              </div>
              <div className="landing-search-grid">
                {visibleGlossary.map(g => (
                  <Link
                    key={g.slug}
                    href={`/wiki#${g.slug}`}
                    prefetch={false}
                    className="landing-search-item"
                    onClick={closeAfter}
                  >
                    <span className="landing-search-item-name">{g.head}</span>
                    <span className="landing-search-item-meta">{g.body.slice(0, 80)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          </>
          )}

          {compMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <CalendarDays size={14} strokeWidth={1.75} />
                <h3>{tr({ zh: '比赛', en: 'Competitions'
                })}</h3>
                {compMatches.length > COMP_INITIAL_CAP && (
                  <HeaderMore
                    overflow={compMatches.length - COMP_INITIAL_CAP}
                    title={(isZh ? `查看全部 ${compMatches.length} 场` : `View all ${compMatches.length}`)}
                    href={hrefWithQuery('/wca/comp', `view=list&q=${encodeURIComponent(q)}`)}
                    onClick={closeAfter}
                  />
                )}
              </div>
              <div className="landing-search-grid">
                {visibleComps.map(c => {
                  const cityStr = c.city ? localizeCity(c.city, isZh, c.country) : '';
                  return (
                    <Link
                      key={c.id}
                      {...compLinkProps(c.id)}
                      className="landing-search-item landing-search-item--rich"
                      onClick={closeAfter}
                    >
                      <Flag iso2={c.country} className="country-flag" />
                      <span className="landing-search-item-main">
                        <span className="landing-search-item-name">
                          <CompCell compId={c.id} compName={c.name} isZh={isZh} date={c.start_date} noFlag />
                        </span>
                        <span className="landing-search-item-meta">
                          <span className="landing-search-date">{formatDateRangeIso(c.start_date, c.end_date)}</span>
                          {cityStr ? ` · ${cityStr}` : ''}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}


          {reconMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <ScanSearch size={14} strokeWidth={1.75} />
                <h3>{tr({ zh: '复盘', en: 'Recons'
                })}</h3>
                {!expandedRecons && reconMatches.length > RECON_INITIAL_CAP && (
                  <HeaderMore
                    overflow={reconMatches.length - RECON_INITIAL_CAP}
                    title={(isZh ? `展开全部 ${reconMatches.length} 条` : `Expand all ${reconMatches.length}`)}
                    onClick={() => setExpandedRecons(true)}
                  />
                )}
              </div>
              <div className="landing-search-grid">
                {visibleRecons.map(r => (
                  <Link
                    key={r.id}
                    href={`/recon/${reconPathSeg(r)}`}
                    prefetch={false}
                    className="landing-search-item landing-search-item--rich"
                    onClick={closeAfter}
                  >
                    {r.personIso2 && <Flag iso2={r.personIso2} className="country-flag" />}
                    <EventIcon event={r.event} className="landing-search-event-icon" />
                    <span className="landing-search-item-main">
                      <span className="landing-search-item-name">
                        {displayCuberName(r.person, isZh)} · {r.valueStr}
                        {r.recordTag && <RecordBadge record={r.recordTag} variant="inline" iso2={r.personIso2} />}
                        {r.aoType ? ` · ${r.aoType}` : ''}
                      </span>
                      <span className="landing-search-item-meta">
                        {r.comp && <CompCell compId={r.compWcaId ?? ''} compName={r.comp} isZh={isZh} date={r.date ?? null} noFlag />}
                        {r.date && <span className="landing-search-date">{r.comp ? ' · ' : ''}{r.date}</span>}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}


          {localSearchError && <div className="landing-search-empty" role="status">{tr({zh:'部分搜索资料加载失败，请重新输入以重试。',en:'Some search data could not load. Edit your search to retry.'})}</div>}
        </div>
  );

  const assistantView = <SiteAssistantDialog onBranch={index => { assistantConversations.branch(owner, crypto.randomUUID(), assistantTurns.slice(0, index + 1)); router.push(`${langPrefix}/chat`); }} searchResults={conversation?.active && query.trim() && !assistantBusy ? searchResults : undefined} embedded={!!conversation} active={conversation?.active ?? true} key={`${assistantUser?.uid ?? "guest"}:${assistantUser?.wcaId ?? ""}`} images={assistantImages} onImagesChange={setAssistantImages} thinking={assistantThinking} onThinkingChange={setAssistantThinking} lang={lang} draft={assistantDraft} onDraftChange={setAssistantDraft} turns={assistantTurns} onFeedback={(id,value)=>setAssistantTurns(turns=>turns.map(turn=>turn.requestId===id?{...turn,feedback:value}:turn))} status={assistantStatus} busy={assistantBusy} error={assistantError} onAsk={(question, replaceLast, images) => void askAssistant(question, replaceLast, images)} onStop={stopAssistant} onClose={closeAssistant} onNew={() => { assistantConversation.current = null; stopAssistant(); setAssistantDraft(''); setAssistantImages([]); setAssistantTurns([]); setAssistantAnswer(null); setAssistantError(null); }} />;
  if (conversation) return assistantView;

  return (
    <div className={`landing-search${persistentResults ? ' landing-search--page' : ''}`} ref={wrapRef} style={workspaceEntry && workspace.open ? { display: 'none' } : undefined}>
      <div className="landing-search-controls">
        {voiceMode ? (
          <div className="landing-search-input landing-search-voice" onKeyDown={event => {
            if (event.key === 'Escape') { micCancel(); setVoiceMode(false); setVoiceAction(null); }
          }}>
            <button type="button" className="landing-search-voice-button" aria-label={tr({ zh: '取消语音输入', en: 'Cancel voice input' })}
              onClick={() => { micCancel(); setVoiceMode(false); setVoiceAction(null); setVoiceText(''); }}><X size={22} /></button>
            <div className="landing-search-wave" role="status"
              aria-label={micStatus === 'starting' ? tr({ zh: '正在启动语音输入', en: 'Starting voice input' })
                : micStatus === 'stopping' ? tr({ zh: '正在识别', en: 'Transcribing' })
                : listening ? tr({ zh: '正在聆听', en: 'Listening' }) : tr({ zh: '语音输入已结束', en: 'Voice input finished' })}>
              <div className="landing-search-wave-track" aria-hidden="true" style={{ transform: `translateX(${-waveformOffset * 100 / waveform.length}%)` }}>
                {waveform.map((amplitude, index) => <span key={index} style={{ height: `${3 + amplitude * 25}px` }} />)}
              </div>
            </div>
            <Tooltip content={tr({ zh: '停止听写', en: 'Stop dictation' })}>{(tip) => <button {...tip} type="button" className="landing-search-voice-button landing-search-voice-stop" disabled={voiceAction !== null}
              aria-label={tr({ zh: '停止并编辑文字', en: 'Stop and edit text' })}
              onClick={() => { setVoiceAction('stop'); micStop(); }}>
              <Square size={15} fill="currentColor" />
            </button>}</Tooltip>
            <button type="button" className="landing-search-voice-button landing-search-voice-send"
              disabled={voiceAction !== null || !voiceText.trim() || voiceText.trim().length > SITE_ASSISTANT_QUESTION_MAX_LENGTH || assistantBusy}
              aria-label={tr({ zh: '发送语音提问', en: 'Send voice question' })}
              onClick={() => { setVoiceAction('send'); micStop(); }}><ArrowUp size={24} /></button>
          </div>
        ) : <div
          className="landing-search-input"
          onMouseDown={e => {
            // 点击容器自身(上下 padding / 元素间 gap 死区)→ 聚焦输入框
            if (e.target === e.currentTarget) {
              e.preventDefault();
              textInputRef.current?.focus();
            }
          }}
        >
          <button
            type="button"
            className="landing-search-plus"
            onClick={() => setPlusMenuOpen(v => !v)}
            title={tr({ zh: '添加', en: 'Add'
          })}
            aria-label={tr({ zh: '添加', en: 'Add'
          })}
            aria-expanded={plusMenuOpen}
          >
            <Plus size={18} strokeWidth={1.75} />
          </button>
          {/* allow-manual-search: Results update while typing; Enter submits a natural-language question. */}
          <input
            ref={textInputRef}
            type="text"
            autoFocus={autoFocus}
            className="landing-search-field"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onPaste={e => {
              const intent = detectPasteIntent(e.clipboardData.getData('text'));
              if (intent) { e.preventDefault(); goPasteIntent(intent); }
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                setOpen(false);
                (e.target as HTMLInputElement).blur();
              } else if (e.key === 'ArrowRight' && !query && !e.nativeEvent.isComposing && e.keyCode !== 229
                && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey
                && !listening && micStatus !== 'starting' && micStatus !== 'stopping') {
                e.preventDefault();
                const input = e.currentTarget;
                const suggestion = rotatingPlaceholder(isZh, placeholderDay);
                setQuery(suggestion);
                setOpen(true);
                requestAnimationFrame(() => {
                  if (document.activeElement === input && input.value === suggestion) {
                    input.setSelectionRange(suggestion.length, suggestion.length);
                  }
                });
              } else if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                if (yearMatch || pasteIntent) goFirstResult();
                else void askAssistant();
              }
            }}
            placeholder={micStatus === 'starting' ? tr({ zh: '正在启动语音输入…', en: 'Starting voice input…' })
              : micStatus === 'stopping' ? tr({ zh: '正在等待识别结果…', en: 'Waiting for speech results…' })
                : listening ? tr({ zh: '请说…', en: 'Listening…' }) : rotatingPlaceholder(isZh, placeholderDay)}
            aria-label={tr({ zh: '全站搜索', en: 'Site search' })}
          />

          {/* allow-manual-search: Dictation only fills speech text; typed search still updates through onChange. */}
          <Tooltip content={tr({ zh: '听写', en: 'Dictate' })}>{(tip) => <button {...tip}
            type="button"
            className="landing-search-mic landing-search-dictation"
            aria-pressed={listening}
            disabled={micStatus === 'stopping'}
            onClick={() => { setVoiceText(''); setVoiceAction(null); setVoiceMode(true); setOpen(false); setPlusMenuOpen(false); micStart(); }}
            aria-label={tr({ zh: '听写', en: 'Dictate' })}
          >
            <Mic size={16} strokeWidth={1.75} />
          </button>}</Tooltip>
            <button type="button" className="landing-search-mic landing-search-send" disabled={assistantBusy || !!currentChat?.pending || (!query.trim() && !(workspaceEntry && currentChat?.snapshot.images.length)) || query.trim().length > SITE_ASSISTANT_QUESTION_MAX_LENGTH}
              onClick={() => void askAssistant()}
              aria-label={tr({ zh: '提问', en: 'Ask' })} title={tr({ zh: '提问（回车）', en: 'Ask (Enter)' })}>
              <ArrowUp size={20} strokeWidth={1.75} />
            </button>
        </div>}
        {plusMenuOpen && (
          <div ref={plusMenuRef} className="landing-search-plus-menu" data-site-surface="popover" role="menu">
            <button type="button" className="landing-search-plus-menu-btn" role="menuitem" aria-label={tr({zh:'图片提问',en:'Ask with images'})} onClick={() => {
              if (workspaceEntry) { ensureAssistantConversation(owner); assistantConversations.setOpen(owner, true); router.push(`${langPrefix}/chat`); }
              else { setAssistantDraft(query); setAssistantDialog(true); }
              setPlusMenuOpen(false);
            }}>
              <ImagePlus size={14} strokeWidth={1.75} />
              <span className="landing-search-plus-menu-title">{tr({ zh: '图片提问', en: 'Ask with images' })}{workspaceEntry && !!currentChat?.snapshot.images.length && ` (${currentChat.snapshot.images.length})`}</span>
            </button>
            <button type="button" className="landing-search-plus-menu-btn" role="menuitem" onClick={onSmartPaste}>
              <Clipboard size={14} strokeWidth={1.75} />
              <div className="landing-search-plus-menu-text">
                <span className="landing-search-plus-menu-title">{tr({ zh: '智能粘贴', en: 'Smart paste'
                })}</span>
                <span className="landing-search-plus-menu-sub">{tr({ zh: 'WCA URL / 打乱 / 公式', en: 'WCA URL / scramble / alg'
                })}</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {(micError || (listening && microphone)) && (
        <p className="landing-search-speech-status" role="status">
          {microphone && <span>{tr({ zh: '麦克风：', en: 'Microphone: ' })}{microphone}{micError ? ' · ' : ''}</span>}
          {micError && tr(SPEECH_ERRORS[micError] ?? SPEECH_ERRORS['service-not-allowed'])}
        </p>
      )}

      {assistantDialog && assistantView}

      {showDropdown && !assistantDialog && searchResults}
    </div>
  );
}
