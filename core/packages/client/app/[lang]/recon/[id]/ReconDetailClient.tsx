'use client';

/**
 * /recon/[id] — full detail page, ported from packages/client-vite/src/pages/recon/ReconDetailPage.tsx.
 * Restored features: SameRound nav, SameCompEvent table, normalized-cross block, full StatsGrid,
 * comment reply tree, pin/edit/delete, alternatives section.
 */
import { useEffect, useState, useCallback, useMemo, useRef, Fragment } from 'react';
import Link from '@/components/AppLink';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Box, PenLine, Calendar, UserPlus, StickyNote,
  ChartColumn, Video, MessageCircle, TriangleAlert,
  Pencil, Trash2, Pin, PinOff, Plus, Key,
  Globe, Radio, ClipboardPaste, ChevronDown, ChevronUp,
  GitFork,
} from 'lucide-react';
import type { ReconSolve, ReconComment, ReconAlternative } from '@cuberoot/shared';
import {
  getRecon, listComments, addComment, updateComment, deleteComment, pinComment, getBiliCover,
  listRecons, deleteAlternative, getSameScramble,
} from '@/lib/recon-api';
import {
  formatTime, isBldEvent, getPuzzleId, wcaPersonUrl,
  buildExternalLinks, FACE_COLORS, attemptsPerRound, localizeRound,
} from '@/lib/recon-utils';
import { compLinkProps } from '@/lib/comp-link';
import { displayCuberName } from '@/lib/cuber-name-display';
import { eventDisplayName, toWcaEventId } from '@/lib/wca-events';
import { EventIcon } from '@/components/EventIcon';
import { loadFlagData, flagDataVersion, personFlagIso2 } from '@/lib/country-flags';
import { Flag } from '@/components/Flag';
import { localizeCompName } from '@/lib/comp-localize';
import { displayCity } from '@/lib/city-display';
import { cleanForPlayer } from '@/lib/recon-alg-utils';
import {
  fetchAttempts, fetchCubingAttempts, fetchScrambles, matchRoundType,
} from '@/lib/wca-results-api';
import {
  fetchWcaPersonResults, fetchWcaPersonCompetitions,
  type WcaResultRow as WcaResultsRow, type WcaCompetition,
} from '@/lib/wca-person-api';
import { computePrRank } from '@/components/persons/logic/progress';
import { ROUND_ORDER, ROUND_HINT_ZH, ROUND_HINT_EN, roundLabel, roundClass } from '@/lib/wca-round-meta';
import { isAo5Bracketed } from '@/lib/wca-ao5-brackets';
import { formatWcaResult } from '@/lib/wca-format-result';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { useAuthStore, useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { RecordBadge } from '@/components/RecordBadge';
import TwistySection from '@/components/TwistySection';
import Sq1ReconPlayer from '@/components/Sq1ReconPlayer';
import SolutionView from '@/components/SolutionView';
import { canonicalSq1Alg } from '@/lib/sq1-svg';
import {
  buildNormalizedSolution, findCrossLineIndex, hasWideMoveInCrossSection,
} from '@/lib/recon-norm-cross-extract';
import { computeAllStats, buildCaption } from '@/lib/recon-stats';
import {
  DiscussionComposer, DiscussionEditBox, UserHeadline, ItemMenu, UserAvatarFallback,
} from '@/components/Discussion';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { parseReconId, reconPathSeg } from '@/lib/recon-seo';
import '../recon.css';
import './recon_detail.css';
import '@/components/wca-results/attempts-grid.css';
import { tr } from '@/i18n/tr';

const YOUTUBE_LOGO = '/assets/youtube_logo.svg';
const BILIBILI_LOGO = '/assets/bilibili_logo.svg';

function personLinkForSolve(solve: ReconSolve, isZh: boolean): string {
  const search = isZh ? '?lang=zh' : '';
  const compId = solve.compWcaId;
  const eventId = solve.event ? toWcaEventId(solve.event) : null;
  const round = solve.round;
  if (compId && eventId && round) {
    return `/wca/persons/${solve.personId}${search}#r-${compId}-${eventId}-${round}`;
  }
  return `/wca/persons/${solve.personId}${search}`;
}

function personHref(wcaId: string, isZh: boolean): string {
  return `/wca/persons/${wcaId}${isZh ? '?lang=zh' : ''}`;
}

export default function ReconDetailClient({ initialSolve, initialSameScramble }: {
  initialSolve?: ReconSolve;
  initialSameScramble?: ReconSolve[];
} = {}) {
  const params = useParams<{ id: string }>();
  const rawSeg = (Array.isArray(params?.id) ? params.id[0] : params?.id) ?? '';
  const id = parseReconId(rawSeg); // strip cosmetic slug suffix → numeric id
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  // Seeded from the server-fetched recon (page.tsx) so the first paint has data
  // (no flash of loading) and we skip the duplicate client fetch. Comments are
  // still fetched client-side. Falls back to a client fetch if absent.
  const [solve, setSolve] = useState<ReconSolve | null>(initialSolve ?? null);
  const [comments, setComments] = useState<ReconComment[]>([]);
  const [loading, setLoading] = useState(!initialSolve);
  const [error, setError] = useState<string | null>(null);

  const reconTitle = (() => {
    const fallback = tr({ zh: '复盘', en: 'Reconstruction'
    });
    if (!solve) return fallback;
    const parts: string[] = [];
    const ts = solve.value || (solve.rawTime != null ? formatTime(solve.rawTime) : null);
    if (ts) parts.push(ts);
    if (solve.event) parts.push(eventDisplayName(solve.event, isZh));
    if (solve.person) parts.push(displayCuberName(solve.person, isZh));
    return parts.length > 0 ? parts.join(' ') : fallback;
  })();
  useDocumentTitle(reconTitle, reconTitle);

  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    loadFlagData().then(v => { if (v !== flagVer) setFlagVer(v); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const solveData = await getRecon(Number(id));
      setSolve(solveData);
      listComments(Number(id)).then(setComments).catch(() => {});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // When the server already handed us the recon, skip the solve refetch and just
  // load comments. onUpdate (mutations) still calls loadData for a full refresh.
  useEffect(() => {
    if (initialSolve) {
      if (id) listComments(Number(id)).then(setComments).catch(() => {});
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData, id]);

  if (loading) return <div className="recon-page"><div className="recon-loading">{t('common.loading')}</div></div>;
  if (error) return <div className="recon-page"><div className="recon-error"><TriangleAlert size={16} /> {error}</div></div>;
  if (!solve) return <div className="recon-page"><div className="recon-error">{t('recon.notFound')}</div></div>;

  const solutionText = solve.solution || solve.recon || '';
  const scramble = solve.optimalScramble || solve.wcaScramble || '';

  // 主选手(成绩归属)+ 共同完成者,逐个带旗帜/链接渲染
  const cubers: { name: string; id?: string; country?: string }[] = [
    { name: solve.person || '', id: solve.personId, country: solve.personCountry },
    ...(solve.coPersons ?? []),
  ].filter(c => c.name);

  return (
    <div className="recon-page detail-page">
      <div className="detail-header-block">
        <div className="detail-header">
          <h1 className="detail-title">
            {solve.value || (solve.rawTime != null ? formatTime(solve.rawTime) : null)}
            <RecordBadge record={solve.regionalSingleRecord} variant="inline" iso2={solve.personCountry} />
            {solve.event && (
              <>{' '}<EventIcon event={solve.event} />{' '}{eventDisplayName(solve.event, isZh)}</>
            )}
            {cubers.map((c, i) => (
              <Fragment key={i}>
                {' '}
                <span className="detail-cuber">
                  {i > 0 && <span className="detail-cuber-sep">&amp;{' '}</span>}
                  {c.country && <Flag iso2={c.country} className="recon-inline-flag" />}
                  {c.id ? (
                    <Link
                      href={i === 0 ? personLinkForSolve(solve, isZh) : personHref(c.id, isZh)}
                      className="detail-person-link"
                    >
                      {displayCuberName(c.name, isZh)}
                    </Link>
                  ) : displayCuberName(c.name, isZh)}
                </span>
              </Fragment>
            ))}
            {' '}
            <Link href={`/recon/submit/${solve.id}`} className="recon-btn recon-btn-edit detail-title-edit" title={t('recon.edit')} aria-label={t('recon.edit')}>
              <Pencil size={14} />
            </Link>
          </h1>
        </div>
        <div className="detail-meta-bar">
          {solve.date && <span className="detail-meta-item">{solve.date.slice(0, 10)}</span>}
          {solve.comp && (
            <span className="detail-meta-item">
              {solve.country && <Flag iso2={solve.country} className="recon-inline-flag" />}
              <span>
                {solve.compWcaId ? (
                  <Link {...compLinkProps(solve.compWcaId)}>
                    {localizeCompName(solve.compWcaId ?? '', solve.comp, isZh)}
                  </Link>
                ) : localizeCompName(solve.compWcaId ?? '', solve.comp, isZh)}
                {solve.round && (isZh ? `，${localizeRound(solve.round, t)}` : `, ${localizeRound(solve.round, t)}`)}
              </span>
            </span>
          )}
          {solve.city && <span className="detail-meta-item">{displayCity(solve.city, isZh)}</span>}
        </div>
      </div>

      <ReconDetailBody
        scramble={scramble}
        solutionText={solutionText}
        solve={solve}
        comments={comments}
        onUpdate={loadData}
        initialSameScramble={initialSameScramble}
      />
    </div>
  );
}

function ReconDetailBody({ scramble, solutionText, solve, comments, onUpdate, initialSameScramble }: {
  scramble: string;
  solutionText: string;
  solve: ReconSolve;
  comments: ReconComment[];
  onUpdate: () => void;
  initialSameScramble?: ReconSolve[];
}) {
  const [sameCompHasRows, setSameCompHasRows] = useState(false);
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const [crossNormalized, setCrossNormalized] = useState(false);
  const [alts, setAlts] = useState<ReconAlternative[]>(solve.alternatives ?? []);

  const canToggle = useMemo(
    () => hasWideMoveInCrossSection(solutionText),
    [solutionText],
  );
  const normalizedText = useMemo(
    () => canToggle ? buildNormalizedSolution(solutionText) : null,
    [solutionText, canToggle],
  );
  const displayText = crossNormalized && normalizedText ? normalizedText : solutionText;
  const crossLineIdx = useMemo(() => findCrossLineIndex(displayText), [displayText]);
  const caption = useMemo(
    () => buildCaption(solutionText, (isBldEvent(solve.event) ? solve.execTime : solve.rawTime) ?? 0),
    [solutionText, solve.event, solve.execTime, solve.rawTime],
  );

  // SQ1 renders with the cuber WebGL engine (Sq1ReconPlayer, same as /sim &
  // the submit page); cubing.js draws it poorly. Its parseSq1Tokens accepts the
  // stored compact `1/06/…` form directly. The cubedb external link still needs
  // canonical `(1, 0) / …` notation; the on-page scramble text stays compact.
  const isSq1 = solve.event === 'sq1';
  const playerScramble = isSq1 ? canonicalSq1Alg(scramble) : scramble;

  return (
    <div className="detail-layout">
      <div className="detail-player-pane">
        {scramble && (
          // 有解法 → 播放复盘;无解法(只录了 WCA 成绩 + 打乱)→ alg 为空,
          // player 停在 setup(打乱)后的 3D 状态,至少能看到这个打乱。
          isSq1 ? (
            <Sq1ReconPlayer
              scramble={scramble}
              alg={displayText}
              playerRef={playerRef}
              fillPane
            />
          ) : (
            <TwistySection
              puzzle={getPuzzleId(solve.event)}
              scramble={playerScramble}
              alg={cleanForPlayer(displayText)}
              playerRef={playerRef}
              fillPane
            />
          )
        )}
      </div>

      <div className="detail-content-pane">
        {scramble && solutionText && (
          <ExternalLinks event={solve.event} scramble={playerScramble} alg={cleanForPlayer(solutionText)} solveId={solve.id} caption={caption} />
        )}

        {(scramble || solutionText) && (
          <div className="detail-section detail-scramble-solution">
            {scramble && <div className="detail-scramble-line">{scramble}</div>}
            {solutionText && (
              <SolutionView
                text={displayText}
                playerRef={playerRef}
                crossLineIdx={canToggle ? crossLineIdx : -1}
                crossNormalized={crossNormalized}
                onToggleCross={() => setCrossNormalized(v => !v)}
              />
            )}
          </div>
        )}

        {solve.optimalScramble && solve.wcaScramble && (
          <div className="detail-other-scramble">
            <span className="detail-other-scramble-label">{t('recon.wcaScramble')}</span>
            <span className="detail-other-scramble-value">{solve.wcaScramble}</span>
          </div>
        )}

        <StatsGrid solve={solve} />

        {solve.videoUrl && <VideoSection videoUrl={solve.videoUrl} />}

        {solve.note && (
          <div className="detail-section">
            <div className="detail-section-label"><StickyNote size={14} /> {t('recon.note')}</div>
            <div className="detail-note">{solve.note}</div>
          </div>
        )}

        <div className="detail-meta">
          {solve.cube && (
            <div className="detail-meta-item">
              <span className="detail-meta-label"><Box size={16} /></span>
              <span className="detail-meta-value">{solve.cube}</span>
            </div>
          )}
          {solve.reconer && (
            <div className="detail-meta-item">
              <span className="detail-meta-label"><PenLine size={16} /></span>
              <span className="detail-meta-value">
                {solve.reconerId && <Flag iso2={personFlagIso2(solve.reconerId)} className="yt-comment-flag" />}
                {solve.reconerId ? (
                  <a href={wcaPersonUrl(solve.reconerId)} target="_blank" rel="noopener noreferrer">
                    {displayCuberName(solve.reconer, isZh)}
                  </a>
                ) : displayCuberName(solve.reconer, isZh)}
              </span>
            </div>
          )}
          {solve.reconDate && (
            <div className="detail-meta-item">
              <span className="detail-meta-label"><Calendar size={16} /></span>
              <span className="detail-meta-value">{solve.reconDate.slice(0, 10)}</span>
            </div>
          )}
          {solve.addedBy && (
            <div className="detail-meta-item">
              <span className="detail-meta-label"><UserPlus size={16} /></span>
              <span className="detail-meta-value">
                {solve.addedById && <Flag iso2={personFlagIso2(solve.addedById)} className="yt-comment-flag" />}
                {solve.addedById ? (
                  <a href={wcaPersonUrl(solve.addedById)} target="_blank" rel="noopener noreferrer">
                    {displayCuberName(solve.addedBy, isZh)}
                  </a>
                ) : displayCuberName(solve.addedBy, isZh)}
              </span>
            </div>
          )}
        </div>

        {solve.comp && solve.event && solve.round && !sameCompHasRows && (
          <SameRoundNav solve={solve} />
        )}

        {solve.event && solve.personId && (solve.compWcaId || solve.comp) && (
          <SameCompEventTable solve={solve} onHasRows={setSameCompHasRows} />
        )}

        <SameScrambleNav solve={solve} initial={initialSameScramble} />

        <AlternativesSection
          reconId={solve.id}
          alts={alts}
          setAlts={setAlts}
          solveTime={(isBldEvent(solve.event) ? solve.execTime : solve.rawTime)}
        />

        <CommentsView comments={comments} reconId={solve.id} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

function ExternalLinks({ event, scramble, alg, solveId, caption }: {
  event: string; scramble: string; alg: string; solveId: number; caption: string;
}) {
  const { t } = useTranslation();
  const { algUrl, algSiteName, cubedbUrl } = buildExternalLinks(event, scramble, alg);
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/recon/${solveId}`
    : `/recon/${solveId}`;

  const copyTo = (text: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const btn = e.currentTarget as HTMLElement;
    const orig = btn.textContent;
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = t('recon.copied');
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });
  };

  return (
    <div className="recon-external-links">
      <a href={algUrl} target="_blank" rel="noopener noreferrer">{algSiteName}</a>
      <a href={cubedbUrl} target="_blank" rel="noopener noreferrer">cubedb.net</a>
      <a href="#" onClick={copyTo(shareUrl)}>{t('recon.link')}</a>
      {caption && <a href="#" onClick={copyTo(caption)}>{t('recon.caption')}</a>}
    </div>
  );
}

const CROSS_LABELS: Record<number, string> = { 0: 'cross', 1: 'xcross', 2: 'xxcross', 3: 'xxxcross', 4: 'xxxxcross' };

function StatsGrid({ solve }: { solve: ReconSolve }) {
  const { t } = useTranslation();
  const computed = useMemo(() => {
    const text = solve.solution || solve.recon || '';
    if (!text) return null;
    const time = (isBldEvent(solve.event) ? solve.execTime : solve.rawTime) ?? 0;
    return computeAllStats(text, time);
  }, [solve.solution, solve.recon, solve.rawTime, solve.execTime, solve.event]);
  const stm = computed ? computed.stm : solve.stm;
  const tps = computed ? computed.tps : solve.tps;
  const crossStm = computed ? computed.crossStm : solve.crossStm;
  const f2l = computed ? computed.f2l : solve.f2l;
  const ll = computed ? computed.ll : solve.ll;
  const crossType = computed ? computed.crossType : solve.crossType;
  const freePair = computed ? computed.freePair : solve.freePair;
  const yRot = computed ? computed.yRot : solve.yRot;
  const regrip = computed ? computed.regrip : solve.regrip;
  const lockup = computed ? computed.lockup : solve.lockup;
  const sMove = computed ? computed.sMove : solve.sMove;
  const crossColor = computed ? computed.crossColor : solve.crossColor;
  const ollShort = computed?.ollShort || solve.ollShort || solve.oll;
  const pllShort = computed?.pllShort || solve.pllShort || solve.pll;

  const isBld = isBldEvent(solve.event);
  const items: [string, React.ReactNode | undefined][] = [
    [t('recon.method'), solve.method],
    [t('recon.stm'), stm],
    [t('recon.tps'), tps],
    [t('recon.memo'), isBld && solve.memoTime != null ? Number(solve.memoTime).toFixed(2) : undefined],
    [t('recon.exec'), isBld && solve.execTime != null ? Number(solve.execTime).toFixed(2) : undefined],
    ['Cross', !isBld && crossStm != null ? `${crossStm}` : undefined],
    ['F2L', !isBld && f2l != null ? `${f2l}` : undefined],
    [t('recon.ll'), !isBld && ll != null ? `${ll}` : undefined],
    ['?x', !isBld && crossType != null ? (CROSS_LABELS[crossType as number] || String(crossType)) : undefined],
    [t('recon.freePair'), isBld ? undefined : freePair],
    [t('recon.yRot'), isBld ? undefined : yRot],
    [t('recon.regrip'), regrip],
    [t('recon.lockup'), lockup],
    [t('recon.sMove'), sMove],
    [t('recon.crossColor'), !isBld && crossColor ? (
      FACE_COLORS[crossColor as string]
        ? <span style={{ color: FACE_COLORS[crossColor as string], fontWeight: 600 }}>{String(crossColor)}</span>
        : String(crossColor)
    ) : undefined],
    ['OLL', isBld ? undefined : ollShort],
    ['PLL', isBld ? undefined : pllShort],
  ];

  const validItems = items.filter(([, v]) => v != null && v !== '' && v !== 0);
  if (validItems.length === 0) return null;

  return (
    <div className="detail-section">
      <div className="detail-section-label"><ChartColumn size={14} /> {t('recon.statistics')}</div>
      <div className="detail-stats-grid">
        {validItems.map(([label, value]) => (
          <div key={label} className="stat-item">
            <span className="stat-label">{label}</span>
            <span className="stat-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VideoSection({ videoUrl }: { videoUrl: string }) {
  const { t } = useTranslation();
  const urls = videoUrl.split('\n').map(u => u.trim()).filter(u => u);

  const ytUrls: string[] = [];
  const biliUrls: string[] = [];
  const otherUrls: string[] = [];
  for (const u of urls) {
    if (/youtu\.?be/i.test(u)) ytUrls.push(u);
    else if (/BV[A-Za-z0-9]+/.test(u) || /bilibili\.com/i.test(u) || /b23\.tv/i.test(u)) biliUrls.push(u);
    else otherUrls.push(u);
  }

  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocal = process.env.NODE_ENV === 'development';
  const isCN = /(?:^|\.)cuberoot\.me$/.test(host);

  let embedUrls: string[];
  let linkUrls: string[];
  if (isLocal) {
    embedUrls = [...ytUrls, ...biliUrls];
    linkUrls = otherUrls;
  } else if (isCN) {
    if (biliUrls.length > 0) {
      embedUrls = biliUrls;
      linkUrls = [...ytUrls, ...otherUrls];
    } else {
      embedUrls = ytUrls;
      linkUrls = otherUrls;
    }
  } else {
    if (ytUrls.length > 0) {
      embedUrls = ytUrls;
      linkUrls = [...biliUrls, ...otherUrls];
    } else {
      embedUrls = biliUrls;
      linkUrls = otherUrls;
    }
  }

  if (embedUrls.length === 0 && linkUrls.length === 0) return null;

  return (
    <div className="detail-section">
      <div className="detail-section-label">{t('recon.video')}</div>
      <div className="detail-video-row">
        {embedUrls.map((url, i) => (
          <VideoEmbed key={`e${i}`} url={url} />
        ))}
      </div>
      {linkUrls.map((url, i) => (
        <a key={`l${i}`} href={url} target="_blank" rel="noopener noreferrer" className="detail-video-link">
          <Video size={16} /> {url}
        </a>
      ))}
    </div>
  );
}

function VideoEmbed({ url }: { url: string }) {
  const ytMatch = url.match(/youtu\.?be(?:\.com)?\/(?:watch\?.*v=|embed\/|shorts\/|live\/|v\/|)([A-Za-z0-9_-]+)/);
  if (ytMatch) {
    const ytId = ytMatch[1];
    const tMatch = url.match(/[?&]t=(\d+)/);
    const tSuffix = tMatch ? `&t=${tMatch[1]}s` : '';
    return (
      <a
        href={`https://www.youtube.com/watch?v=${ytId}${tSuffix}`}
        target="_blank"
        rel="noopener noreferrer"
        className="detail-video-wrap detail-video-facade"
        style={{ display: 'block', textDecoration: 'none' }}
      >
        <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
            alt=""
            referrerPolicy="no-referrer"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={YOUTUBE_LOGO}
            alt="YouTube"
            style={{ position: 'relative', width: 68, height: 'auto', opacity: 0.95, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}
          />
        </div>
      </a>
    );
  }

  const bvMatch = url.match(/(BV[A-Za-z0-9]+)/);
  const isB23 = /b23\.tv/i.test(url);
  if (bvMatch) {
    const bvId = bvMatch[1];
    return <BilibiliFacade bvId={bvId} href={`https://www.bilibili.com/video/${bvId}`} />;
  }
  if (isB23) {
    return <BilibiliFacade bvId={null} href={url} />;
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="detail-video-link">
      <Video size={16} /> {url}
    </a>
  );
}

function parsePastedAttempts(raw: string): (number | null)[] {
  const tokens = raw.split(/[\s,，;；]+/).filter(s => s.length > 0);
  return tokens.map(tok => {
    const u = tok.toUpperCase();
    if (u === 'DNF') return -1;
    if (u === 'DNS') return -2;
    const m = tok.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/);
    if (m) return parseInt(m[1]) * 60 + parseFloat(m[2]);
    const n = parseFloat(tok);
    return isNaN(n) ? null : n;
  });
}

function SameRoundNav({ solve }: { solve: ReconSolve }) {
  const { t } = useTranslation();
  const [siblings, setSiblings] = useState<ReconSolve[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [wcaAttempts, setWcaAttempts] = useState<(number | null)[] | null>(null);
  const [scrambles, setScrambles] = useState<(string | null)[] | null>(null);
  const [attemptsSource, setAttemptsSource] = useState<'wca' | 'cubing' | null>(null);
  const [pastedAttempts, setPastedAttempts] = useState<(number | null)[] | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteRaw, setPasteRaw] = useState('');

  useEffect(() => {
    if (loaded) return;
    listRecons().then(all => {
      const sameRound = all.filter(
        s => s.person === solve.person && s.comp === solve.comp && s.event === solve.event && s.round === solve.round && s.id !== solve.id
      ).sort((a, b) => (a.solveNum ?? 0) - (b.solveNum ?? 0));
      setSiblings(sameRound);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [solve, loaded]);

  useEffect(() => {
    if (!solve.compWcaId || !solve.personId || !solve.event || !solve.round) return;
    let cancelled = false;
    (async () => {
      const wca = await fetchAttempts(solve.compWcaId!, solve.event!, solve.round!, solve.personId!);
      if (cancelled) return;
      if (wca) {
        setWcaAttempts(wca);
        setAttemptsSource('wca');
      } else {
        const cubing = await fetchCubingAttempts(solve.compWcaId!, solve.event!, solve.round!, solve.personId!);
        if (cancelled) return;
        if (cubing) {
          setWcaAttempts(cubing);
          setAttemptsSource('cubing');
        }
      }
      const sc = await fetchScrambles(solve.compWcaId!, solve.event!, solve.round!, solve.groupId);
      if (cancelled) return;
      if (sc) setScrambles(sc);
    })().catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [solve.compWcaId, solve.personId, solve.event, solve.round, solve.groupId]);

  const bySolveNum = new Map<number, ReconSolve>();
  for (const s of [...siblings, solve]) {
    if (s.solveNum != null) bySolveNum.set(s.solveNum, s);
  }
  const maxSolveNum = bySolveNum.size > 0 ? Math.max(...bySolveNum.keys()) : 0;
  const total = Math.max(
    attemptsPerRound(solve.event),
    wcaAttempts?.length ?? 0,
    pastedAttempts?.length ?? 0,
    maxSolveNum,
  );
  const slots = Array.from({ length: total }, (_, i) => i + 1);

  const attemptFor = (n: number): number | null => {
    const idx = n - 1;
    const fromPaste = pastedAttempts?.[idx];
    if (fromPaste != null) return fromPaste;
    return wcaAttempts?.[idx] ?? null;
  };

  const renderAttempt = (v: number | null): string => {
    if (v == null) return '';
    if (v === -1) return 'DNF';
    if (v === -2) return 'DNS';
    return formatTime(v);
  };

  const handlePasteChange = (raw: string) => {
    setPasteRaw(raw);
    const parsed = parsePastedAttempts(raw);
    if (parsed.some(v => v != null)) {
      setPastedAttempts(parsed);
    } else {
      setPastedAttempts(null);
    }
  };

  const buildHref = (n: number): string => {
    const params = new URLSearchParams();
    params.set('from', String(solve.id));
    params.set('solveNum', String(n));
    const tv = attemptFor(n);
    if (tv != null && tv >= 0) params.set('suggestTime', String(tv));
    const sc = scrambles?.[n - 1];
    if (sc) params.set('suggestScramble', sc);
    return `/recon/submit?${params.toString()}`;
  };

  const hasAnyAttempt = wcaAttempts != null || pastedAttempts != null;
  const hasMissingSlot = slots.some(n => !bySolveNum.get(n));

  const sourceKind = pastedAttempts ? 'paste' : attemptsSource;
  const sourceIcon = (() => {
    if (sourceKind === 'wca') return <Globe size={12} aria-label="WCA" />;
    if (sourceKind === 'cubing') return <Radio size={12} aria-label="cubing.com" />;
    if (sourceKind === 'paste') return <ClipboardPaste size={12} aria-label="paste" />;
    return null;
  })();
  const sourceTitle = sourceKind === 'wca' ? 'WCA'
    : sourceKind === 'cubing' ? 'cubing.com'
    : sourceKind === 'paste' ? t('recon.pasteAttempts')
    : '';

  return (
    <div className="detail-section">
      <div className="detail-section-label">
        {t('recon.sameRound')}
        {sourceIcon && (
          <span className="same-round-source" title={sourceTitle}>{sourceIcon}</span>
        )}
      </div>
      <div className="detail-same-round">
        {slots.map(n => {
          const s = bySolveNum.get(n);
          if (s && s.id === solve.id) {
            return (
              <span key={n} className="same-round-item same-round-current">
                {formatTime(s.rawTime)}
              </span>
            );
          }
          if (s) {
            return (
              <Link key={n} href={`/recon/${reconPathSeg(s)}`} className="same-round-item">
                {formatTime(s.rawTime)}
              </Link>
            );
          }
          const att = attemptFor(n);
          return (
            <Link
              key={n}
              href={buildHref(n)}
              className="same-round-item same-round-missing"
              title={t('recon.addAttempt', { n })}
            >
              {att != null ? renderAttempt(att) : ' '}
            </Link>
          );
        })}
      </div>
      {hasMissingSlot && !hasAnyAttempt && (
        <button
          type="button"
          className="same-round-paste-btn"
          onClick={() => setShowPaste(v => !v)}
        >
          {t('recon.pasteAttempts')}
        </button>
      )}
      {showPaste && (
        <div className="same-round-paste-wrap">
          <div className="same-round-paste-box">
            <textarea
              autoFocus
              value={pasteRaw}
              onChange={e => handlePasteChange(e.target.value)}
              placeholder={t('recon.pasteAttemptsPlaceholder')}
              rows={2}
            />
          </div>
          <div className="same-round-paste-hint">{t('recon.pasteAttemptsHint')}</div>
        </div>
      )}
    </div>
  );
}

// 归一化打乱字符串作为关联键：去首尾空白 + 内部空白折叠为单空格（大小写敏感，r≠R）。
function scrambleKey(solve: Pick<ReconSolve, 'optimalScramble' | 'wcaScramble'>): string {
  return (solve.optimalScramble || solve.wcaScramble || '').trim().replace(/\s+/g, ' ');
}

// 相同打乱的其它复盘（任意选手/项目，只要打乱字符串一致），方便跨复盘对比跳转。
function SameScrambleNav({ solve, initial }: { solve: ReconSolve; initial?: ReconSolve[] }) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  // Seeded from the server (SSR) so the section is in the initial HTML — instant,
  // no full /list download. Background-refresh via the cheap dedicated endpoint.
  const [matches, setMatches] = useState<ReconSolve[]>(initial ?? []);
  const key = scrambleKey(solve);

  useEffect(() => {
    let cancelled = false;
    getSameScramble(solve.id)
      .then(rows => {
        if (cancelled) return;
        setMatches(rows.filter(s => s.id !== solve.id));
      })
      .catch(async () => {
        // 端点未部署(dev 打 prod / 部署错位)时降级:老路径拉全量再客户端过滤。
        if (!key || cancelled) return;
        try {
          const all = await listRecons();
          if (cancelled) return;
          setMatches(all
            .filter(s => s.id !== solve.id && scrambleKey(s) === key)
            .sort((a, b) => (a.rawTime ?? Infinity) - (b.rawTime ?? Infinity)));
        } catch { /* keep SSR-seeded matches */ }
      });
    return () => { cancelled = true; };
  }, [solve.id, key]);

  if (!key || matches.length === 0) return null;

  return (
    <div className="detail-section">
      <div className="detail-section-label">{t('recon.sameScramble')}</div>
      <div className="detail-same-scramble">
        {matches.map(s => {
          const time = isBldEvent(s.event) ? s.execTime : s.rawTime;
          return (
            <Link key={s.id} href={`/recon/${reconPathSeg(s)}`} className="same-scramble-item">
              {time != null && <span className="ss-time">{formatTime(time)}</span>}
              {s.event && <EventIcon event={s.event} title={eventDisplayName(s.event, isZh)} />}
              <span className="ss-name">
                {s.personId && <Flag iso2={personFlagIso2(s.personId)} className="yt-comment-flag" />}
                {displayCuberName(s.person ?? '', isZh)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function SameCompEventTable({ solve, onHasRows }: { solve: ReconSolve; onHasRows: (v: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [allResults, setAllResults] = useState<WcaResultsRow[] | null>(null);
  const [allComps, setAllComps] = useState<WcaCompetition[] | null>(null);
  const [reconByRoundSolve, setReconByRoundSolve] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!solve.personId) return;
    fetchWcaPersonResults(solve.personId).then(setAllResults).catch(() => setAllResults([]));
    fetchWcaPersonCompetitions(solve.personId).then(setAllComps).catch(() => setAllComps([]));
  }, [solve.personId]);

  useEffect(() => {
    listRecons().then(all => {
      const m = new Map<string, number>();
      for (const s of all) {
        if (s.person === solve.person && s.comp === solve.comp && s.event === solve.event && s.round && s.solveNum != null) {
          m.set(`${s.round}|${s.solveNum}`, s.id);
        }
      }
      setReconByRoundSolve(m);
    }).catch(() => { /* ignore */ });
  }, [solve.person, solve.comp, solve.event]);

  const findReconForCell = (roundTypeId: string, attemptNum: number): number | undefined => {
    for (const reconRound of ['1', '2', '3', 'f']) {
      if (matchRoundType(reconRound, roundTypeId)) {
        const idVal = reconByRoundSolve.get(`${reconRound}|${attemptNum}`);
        if (idVal) return idVal;
      }
    }
    return undefined;
  };

  const effectiveCompWcaId = useMemo(() => {
    if (solve.compWcaId) return solve.compWcaId;
    if (!allComps || !solve.comp) return null;
    return allComps.find(c => c.name === solve.comp)?.id ?? null;
  }, [solve.compWcaId, solve.comp, allComps]);

  const rows = useMemo(() => {
    if (!allResults || !effectiveCompWcaId || !solve.event) return [];
    const wcaEid = toWcaEventId(solve.event);
    return allResults
      .filter(r => r.competition_id === effectiveCompWcaId && r.event_id === wcaEid)
      .sort((a, b) => (ROUND_ORDER[a.round_type_id] ?? 99) - (ROUND_ORDER[b.round_type_id] ?? 99));
  }, [allResults, effectiveCompWcaId, solve.event]);

  const prRank = useMemo(
    () => (allResults && allComps ? computePrRank(allResults, allComps) : new Map()),
    [allResults, allComps],
  );

  useEffect(() => { onHasRows(rows.length > 0); }, [rows.length, onHasRows]);

  if (rows.length === 0) return null;

  const eventId = toWcaEventId(solve.event!);

  return (
    <div className="detail-section">
      <div className="detail-section-label">{t('recon.sameCompEvent')}</div>
      <div className="same-comp-event-table-wrap">
        <div className="wp-table-scroll">
          <table className="wp-bycomp-table same-comp-event-table">
            <thead>
              <tr>
                <th>
                  <span className="wp-th-info">
                    {tr({ zh: '轮次', en: 'Round'
                    })}
                    <InfoTooltip content={(isZh ? ROUND_HINT_ZH : ROUND_HINT_EN)} />
                  </span>
                </th>
                <th className="wp-th-narrow">{tr({ zh: '排名', en: 'Pos' })}</th>
                <th>{tr({ zh: '单次', en: 'Single'
                })}</th>
                <th>{tr({ zh: '平均', en: 'Avg' })}</th>
                <th>{tr({ zh: '详细成绩', en: 'Attempts'
                })}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const rank = prRank.get(r.id);
                const singleRank = rank?.singleRank ?? null;
                const averageRank = rank?.averageRank ?? null;
                return (
                  <tr key={r.id}>
                    <td>
                      <span className={`wp-round-tag ${roundClass(r.round_type_id)}`}>
                        {roundLabel(r.round_type_id).replace(/^C-/, '')}
                      </span>
                    </td>
                    <td className={`wp-cell-pos ${r.pos === 1 ? 'wp-pos-first' : ''}`}>
                      {r.pos > 0 ? r.pos : '—'}
                    </td>
                    <td className="wp-cell-result">
                      <span className="record-num-cell">
                        {formatWcaResult(r.best, eventId, 'single')}
                        {r.regional_single_record
                          ? <RecordBadge record={r.regional_single_record} variant="inline" />
                          : singleRank
                            ? <RecordBadge record={singleRank === 1 ? 'PR' : `PR${singleRank}`} variant="inline" />
                            : null}
                      </span>
                    </td>
                    <td className="wp-cell-result">
                      <span className="record-num-cell">
                        {formatWcaResult(r.average, eventId, 'average')}
                        {r.regional_average_record
                          ? <RecordBadge record={r.regional_average_record} variant="inline" />
                          : averageRank
                            ? <RecordBadge record={averageRank === 1 ? 'PR' : `PR${averageRank}`} variant="inline" />
                            : null}
                      </span>
                    </td>
                    <td className="wp-cell-attempts">
                      <RoundAttempts
                        attempts={r.attempts}
                        best={r.best}
                        eventId={eventId}
                        roundTypeId={r.round_type_id}
                        currentReconId={solve.id}
                        findReconForCell={findReconForCell}
                        langQuery={(i18n.language.startsWith('zh') ? '?lang=zh' : '')}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RoundAttempts({ attempts, best, eventId, roundTypeId, currentReconId, findReconForCell, langQuery }: {
  attempts: number[];
  best: number;
  eventId: string;
  roundTypeId: string;
  currentReconId: number;
  findReconForCell: (roundTypeId: string, attemptNum: number) => number | undefined;
  langQuery: string;
}) {
  if (attempts.length === 0) return <span className="wp-text-mute">—</span>;
  const validNums = attempts.filter(x => x > 0);
  const minValid = validNums.length > 0 ? Math.min(...validNums) : 0;
  return (
    <span className="wp-attempts-flow">
      {attempts.map((a, i) => {
        if (a === undefined) return null;
        const formatted = formatWcaResult(a, eventId, 'single');
        const isBest = validNums.length > 0 && a > 0 && a === minValid && a === best;
        const reconId = findReconForCell(roundTypeId, i + 1);
        const isCurrent = reconId === currentReconId;
        const cls = `wp-att ${isBest ? 'wp-att-best' : ''} ${isAo5Bracketed(attempts, i) ? 'wp-att-trimmed' : ''} ${isCurrent ? 'same-comp-event-att-current' : ''}`;
        if (reconId && !isCurrent) {
          return (
            <Link key={i} href={`/recon/${reconId}${langQuery}`} className={`${cls} same-comp-event-att-link`}>
              {formatted}
            </Link>
          );
        }
        return <span key={i} className={cls}>{formatted}</span>;
      })}
    </span>
  );
}

function BilibiliFacade({ bvId, href }: { bvId: string | null; href: string }) {
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    if (!bvId) return;
    getBiliCover(bvId).then(res => {
      if (res.pic) setCover(res.pic);
    }).catch(() => { /* ignore */ });
  }, [bvId]);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="detail-video-wrap detail-video-facade"
      style={{ display: 'block', textDecoration: 'none' }}
    >
      <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {cover && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={cover}
            alt=""
            referrerPolicy="no-referrer"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BILIBILI_LOGO}
          alt="Bilibili"
          style={{ position: 'relative', width: 68, height: 68, opacity: 0.95, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}
        />
      </div>
    </a>
  );
}

function AlternativesSection({ reconId, alts, setAlts, solveTime }: {
  reconId: number;
  alts: ReconAlternative[];
  setAlts: (alts: ReconAlternative[]) => void;
  solveTime?: number;
}) {
  const user = useAuthUser();
  const currentWcaId = user?.wcaId || '';
  const isAdminUser = useIsAdmin();
  const { t } = useTranslation();
  const router = useRouter();

  const handleDelete = async (idx: number) => {
    if (!confirm(t('recon.confirmDeleteAlternative'))) return;
    try {
      const updated = await deleteAlternative(reconId, idx);
      setAlts(updated);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="detail-section">
      <div className="detail-section-label">
        <GitFork size={14} /> {t('recon.alternatives')} ({alts.length})
      </div>

      {currentWcaId ? (
        <div className="alt-add-bar">
          <Link href={`/recon/${reconId}/alt`} className="recon-btn recon-btn-edit" title={t('recon.addAlternative')}>
            <Plus size={14} /> {t('recon.alternatives')}
          </Link>
        </div>
      ) : (
        <div className="detail-comment-login-hint" onClick={() => useAuthStore.getState().login()} style={{ cursor: 'pointer' }}>
          <Key size={16} /> {t('recon.loginToAddAlternative')}
        </div>
      )}

      {alts.length === 0 ? (
        <div className="alt-empty">{t('recon.emptyAlternatives')}</div>
      ) : (
        <div className="yt-comment-list">
          {alts.map((alt, idx) => {
            const isOwn = !!currentWcaId && currentWcaId === alt.addedById;
            const canEdit = isOwn;
            const canDelete = isOwn || isAdminUser;
            const stats = computeAllStats(alt.solution, solveTime ?? 0);
            return (
              <div key={`${alt.addedById}-${alt.createdAt}-${idx}`} className="yt-comment">
                <UserAvatarFallback name={alt.addedBy} avatar={isOwn ? user?.avatar : null} />
                <div className="yt-comment-content">
                  <UserHeadline authorId={alt.addedById} authorName={alt.addedBy} createdAt={alt.createdAt} />
                  {stats.stm > 0 && (
                    <div className="alt-stats-line">
                      <span>{stats.stm} STM</span>
                      {stats.tps > 0 && <span>{stats.tps} TPS</span>}
                    </div>
                  )}
                  <Link
                    href={`/recon/${reconId}/alt/${idx}`}
                    title={t('recon.playAlt')}
                    style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                  >
                  <pre
                    className="detail-solution-text alt-solution-text"
                    style={{ cursor: 'pointer' }}
                  >
                    {alt.solution.split(/\r?\n/).map((line, li) => {
                      const nl = li > 0 ? '\n' : '';
                      if (line.trim().startsWith('//')) {
                        return <span key={li}>{nl}<span className="recon-step-label">{line}</span></span>;
                      }
                      return <span key={li}>{nl}{line}</span>;
                    })}
                  </pre>
                  </Link>
                </div>
                <div className="alt-card-actions">
                  <ItemMenu items={[
                    ...(canEdit ? [{
                      icon: <Pencil size={14} />, label: t('recon.edit'),
                      onClick: () => router.push(`/recon/${reconId}/alt/${idx}/edit`),
                    }] : []),
                    ...(canDelete ? [{
                      icon: <Trash2 size={14} />, label: t('recon.delete'),
                      onClick: () => handleDelete(idx),
                    }] : []),
                  ]} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CommentsView({
  comments, reconId, onUpdate,
}: {
  comments: ReconComment[];
  reconId: number;
  onUpdate: () => void;
}) {
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());

  const user = useAuthUser();
  const currentWcaId = user?.wcaId || '';
  const isAdminUser = useIsAdmin();
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  const { topLevel, repliesByParent } = useMemo(() => {
    const tl: ReconComment[] = [];
    const replies = new Map<number, ReconComment[]>();
    for (const c of comments) {
      if (c.parentId == null) tl.push(c);
      else {
        const arr = replies.get(c.parentId) ?? [];
        arr.push(c);
        replies.set(c.parentId, arr);
      }
    }
    for (const arr of replies.values()) {
      arr.sort((a, b) => a.createdAt - b.createdAt);
    }
    return { topLevel: tl, repliesByParent: replies };
  }, [comments]);

  const handleAdd = async () => {
    await addComment(reconId, newComment.trim());
    setNewComment('');
    onUpdate();
  };

  const handleEdit = async (commentId: number) => {
    if (!editText.trim()) return;
    try {
      await updateComment(commentId, editText.trim());
      setEditingId(null);
      onUpdate();
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    }
  };

  const handleTogglePin = async (commentId: number, nextPinned: boolean) => {
    try {
      await pinComment(commentId, nextPinned);
      onUpdate();
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm(t('recon.confirmDeleteComment'))) return;
    try {
      await deleteComment(commentId);
      onUpdate();
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    }
  };

  const startReply = (parent: ReconComment) => {
    const name = displayCuberName(parent.authorName || '', isZh);
    setReplyingToId(parent.id);
    setReplyText(`@${name} `);
    setExpandedReplies(prev => new Set(prev).add(parent.id));
  };

  const cancelReply = () => {
    setReplyingToId(null);
    setReplyText('');
  };

  const handleSubmitReply = async (parentId: number) => {
    const txt = replyText.trim();
    if (!txt || replySubmitting) return;
    setReplySubmitting(true);
    try {
      await addComment(reconId, txt, parentId);
      setReplyingToId(null);
      setReplyText('');
      onUpdate();
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    } finally {
      setReplySubmitting(false);
    }
  };

  const toggleExpandReplies = (parentId: number) => {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  function renderCommentItem(comment: ReconComment, isReply: boolean) {
    const isOwn = !!currentWcaId && currentWcaId === comment.authorId;
    const admin = isAdminUser;
    const canEdit = isOwn;
    const canDelete = isOwn || admin;
    const canPin = admin && !isReply;
    const canReply = !isReply && !!currentWcaId;
    const ownAvatar = isOwn && user?.avatar ? user.avatar : null;
    return (
      <div className="yt-comment">
        <UserAvatarFallback name={comment.authorName} avatar={ownAvatar} />
        <div className="yt-comment-content">
          {comment.pinned && (
            <div className="yt-comment-pinned-badge">
              <Pin size={12} /> {t('recon.pinned')}
            </div>
          )}
          <UserHeadline
            authorId={comment.authorId}
            authorName={comment.authorName}
            createdAt={comment.createdAt}
            suffix={comment.updatedAt ? ` (${t('recon.edited')})` : null}
          />
          {editingId === comment.id ? (
            <DiscussionEditBox
              value={editText}
              onChange={setEditText}
              onSave={() => handleEdit(comment.id)}
              onCancel={() => setEditingId(null)}
              autoFocus
            />
          ) : (
            <>
              <div className="yt-comment-body">{comment.content}</div>
              {canReply && (
                <div className="yt-comment-actions">
                  <button type="button" className="yt-reply-btn" onClick={() => startReply(comment)}>
                    {t('recon.reply')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        {editingId !== comment.id && (
          <ItemMenu items={[
            ...(canEdit ? [{
              icon: <Pencil size={14} />, label: t('recon.edit'),
              onClick: () => { setEditingId(comment.id); setEditText(comment.content); },
            }] : []),
            ...(canPin ? [{
              icon: comment.pinned ? <PinOff size={14} /> : <Pin size={14} />,
              label: comment.pinned ? t('recon.unpin') : t('recon.pin'),
              onClick: () => handleTogglePin(comment.id, !comment.pinned),
            }] : []),
            ...(canDelete ? [{
              icon: <Trash2 size={14} />, label: t('recon.delete'),
              onClick: () => handleDelete(comment.id),
            }] : []),
          ]} />
        )}
      </div>
    );
  }

  return (
    <div className="detail-section">
      <div className="detail-section-label">
        <MessageCircle size={14} /> {t('recon.comments')} ({comments.length})
      </div>
      <DiscussionComposer
        value={newComment}
        onChange={setNewComment}
        onSubmit={handleAdd}
        placeholder={t('recon.writeComment')}
        submitLabel={t('recon.post')}
        loginHint={t('recon.loginToComment')}
      />

      <div className="yt-comment-list">
        {topLevel.map(comment => {
          const replies = repliesByParent.get(comment.id) ?? [];
          const expanded = expandedReplies.has(comment.id);
          return (
            <div key={comment.id} className="yt-comment-thread">
              {renderCommentItem(comment, false)}
              {(replies.length > 0 || replyingToId === comment.id) && (
                <div className="yt-replies">
                  {replies.length > 0 && (
                    <button
                      type="button"
                      className="yt-replies-toggle"
                      onClick={() => toggleExpandReplies(comment.id)}
                    >
                      {expanded
                        ? <><ChevronUp size={14} /> {t('recon.hideReplies')}</>
                        : <><ChevronDown size={14} /> {t('recon.viewReplies', { count: replies.length })}</>}
                    </button>
                  )}
                  {expanded && replies.map(r => (
                    <div key={r.id} className="yt-reply-item">
                      {renderCommentItem(r, true)}
                    </div>
                  ))}
                  {replyingToId === comment.id && currentWcaId && (
                    <div className="yt-reply-composer">
                      <DiscussionComposer
                        value={replyText}
                        onChange={setReplyText}
                        onSubmit={async () => { await handleSubmitReply(comment.id); }}
                        onCancel={cancelReply}
                        placeholder={t('recon.writeReply')}
                        submitLabel={t('recon.post')}
                        loginHint=""
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

declare global {
  namespace React.JSX {
    interface IntrinsicElements {
      'twisty-player': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          puzzle?: string;
          alg?: string;
          'experimental-setup-alg'?: string;
          'experimental-setup-anchor'?: string;
        },
        HTMLElement
      >;
    }
  }
}
