/**
 * 复盘详情页——迁移自 recon/detail/recon_detail.js（1586 行）
 * NOTE: 展示单条复盘的完整信息，含 twisty 动画、视频、统计、评论
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, PenLine, Calendar, UserPlus, StickyNote,
  ChartColumn, Video, MessageCircle, TriangleAlert,
  Pencil, Trash2, Pin, PinOff, Plus, Key,
  Globe, Radio, ClipboardPaste, ChevronDown, ChevronUp,
  GitFork,
} from 'lucide-react';
import type { ReconSolve, ReconComment, ReconAlternative } from '@cuberoot/shared';
import youtubeLogo from '../../assets/youtube_logo.svg';
import bilibiliLogo from '../../assets/bilibili_logo.svg';
import { getRecon, listComments, addComment, updateComment, deleteComment, pinComment, getBiliCover, listRecons, deleteAlternative } from '../../utils/recon_api';
import {
  formatTime, flagClass,
  isBldEvent, getPuzzleId, wcaPersonUrl,
  buildExternalLinks, FACE_COLORS, attemptsPerRound, localizeRound,
} from '../../utils/recon_utils';
import { compLinkProps } from '../../utils/comp_link';
import { displayCuberName } from '../../utils/name_utils';
import { eventDisplayName } from '../../utils/wca_events';
import { EventIcon } from '../../components/EventIcon';
import { compNameZh, loadFlagData, flagDataVersion, personFlagIso2 } from '../../utils/country_flags';
import { Flag } from '../../utils/flag';
import { stripWcaPrefix } from '../../utils/comp_localize';
import { cleanForPlayer } from '../../utils/recon_alg_utils';
import { fetchAttempts, fetchCubingAttempts, fetchScrambles } from '../../utils/wca_results_api';
import { useAuthStore, isAdmin } from '../../stores/auth_store';
import LangToggle from '../../components/LangToggle';
import { RecordBadge } from '../../components/RecordBadge';
import TwistySection from '../../components/TwistySection';
import SolutionView from './components/SolutionView';
import { buildNormalizedSolution, findCrossLineIndex, hasWideMoveInCrossSection } from '../../utils/recon_norm_cross_extract';
import { computeAllStats } from '../../utils/recon_stats';
import { DiscussionComposer, DiscussionEditBox, UserHeadline, ItemMenu, UserAvatarFallback } from './components/Discussion';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import '../../recon.css';
import './recon_detail.css';

export default function ReconDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [solve, setSolve] = useState<ReconSolve | null>(null);
  const [comments, setComments] = useState<ReconComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reconTitle = (() => {
    const fallback = isZh ? '复盘' : 'Reconstruction';
    if (!solve) return fallback;
    const parts: string[] = [];
    const t = solve.value || (solve.rawTime != null ? formatTime(solve.rawTime) : null);
    if (t) parts.push(t);
    if (solve.event) parts.push(eventDisplayName(solve.event, isZh));
    if (solve.person) parts.push(displayCuberName(solve.person, isZh));
    return parts.length > 0 ? parts.join(' ') : fallback;
  })();
  useDocumentTitle(reconTitle, reconTitle);

  // NOTE: 异步加载 compNameZh 映射
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    loadFlagData().then(v => { if (v !== flagVer) setFlagVer(v); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // NOTE: 加载复盘数据
  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      // NOTE: 主数据独立加载——不被评论/历史 API 的失败拖累
      const solveData = await getRecon(Number(id));
      setSolve(solveData);
      // NOTE: 评论延迟加载（非关键路径，失败静默）
      listComments(Number(id)).then(setComments).catch(() => {});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="recon-page"><div className="recon-loading">{t('common.loading')}</div></div>;
  if (error) return <div className="recon-page"><div className="recon-error"><TriangleAlert size={16} /> {error}</div></div>;
  if (!solve) return <div className="recon-page"><div className="recon-error">{t('recon.notFound')}</div></div>;

  // NOTE: 解法文本：优先使用 solution 字段，fallback 到旧 recon 字段
  const solutionText = solve.solution || solve.recon || '';
  const scramble = solve.optimalScramble || solve.wcaScramble || '';

  return (
    <div className="recon-page detail-page">
      {/* 页头块: title + meta-bar */}
      <div className="detail-header-block">
        <div className="detail-header">
          <div className="detail-header-nav">
            <LangToggle />
          </div>
          <h1 className="detail-title">
            {solve.value || (solve.rawTime != null ? formatTime(solve.rawTime) : null)}
            <RecordBadge record={solve.regionalSingleRecord} variant="inline" iso2={solve.personCountry} />
            {solve.event && (
              <>{' '}<EventIcon event={solve.event} />{' '}{eventDisplayName(solve.event, isZh)}</>
            )}
            {solve.personCountry && <>{' '}<span className={flagClass(solve.personCountry)} /></>}
            {' '}{displayCuberName(solve.person || '', isZh)}
            {' '}
            <Link to={`/recon/submit/${solve.id}`} className="recon-btn recon-btn-edit detail-title-edit" title={t('recon.edit')} aria-label={t('recon.edit')}>
              <Pencil size={14} />
            </Link>
          </h1>
        </div>
        <div className="detail-meta-bar">
          {solve.date && <span className="detail-meta-item">{solve.date.slice(0, 10)}</span>}
          {solve.comp && (
            <span className="detail-meta-item">
              {solve.country && <span className={flagClass(solve.country)} />}
              <span>
                {solve.compWcaId ? (
                  <Link {...compLinkProps(solve.compWcaId)}>
                    {stripWcaPrefix(isZh ? (compNameZh(solve.comp) || solve.comp) : solve.comp)}
                  </Link>
                ) : stripWcaPrefix(isZh ? (compNameZh(solve.comp) || solve.comp) : solve.comp)}
                {solve.round && (isZh ? `，${localizeRound(solve.round, t)}` : `, ${localizeRound(solve.round, t)}`)}
              </span>
            </span>
          )}
        </div>
      </div>

      <ReconDetailBody
        scramble={scramble}
        solutionText={solutionText}
        solve={solve}
        comments={comments}
        onUpdate={loadData}
      />
    </div>
  );
}

// ── 子组件 ──

/**
 * 主体分栏布局——左栏 TwistyPlayer 撑满,右栏滚动展示所有内容
 * NOTE: playerRef 在 twisty 和 solution 之间共享(光标跟随)
 */
function ReconDetailBody({ scramble, solutionText, solve, comments, onUpdate }: {
  scramble: string;
  solutionText: string;
  solve: ReconSolve;
  comments: ReconComment[];
  onUpdate: () => void;
}) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const [crossNormalized, setCrossNormalized] = useState(false);
  // NOTE: 另解列表 lift up,这样 list / count / submit 间共享同一份 alts
  const [alts, setAlts] = useState<ReconAlternative[]>(solve.alternatives ?? []);

  // NOTE: 仅当 cross 段含宽转动时才允许切换;只有插入旋转或全单层时不显示
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

  return (
    <div className="detail-layout">
      {/* 左栏: TwistyPlayer 撑满 */}
      <div className="detail-player-pane">
        {scramble && solutionText && (
          <TwistySection
            puzzle={getPuzzleId(solve.event)}
            scramble={scramble}
            alg={cleanForPlayer(displayText)}
            playerRef={playerRef}
            fillPane
          />
        )}
      </div>

      {/* 右栏: 所有内容,可滚动 */}
      <div className="detail-content-pane">
        {/* 外部链接 */}
        {scramble && solutionText && (
          <ExternalLinks event={solve.event} scramble={scramble} alg={cleanForPlayer(solutionText)} solveId={solve.id} />
        )}

        {/* 打乱 + 解法 合并为一个框,无标签 */}
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

        {/* 另一种打乱（player/外链用 optimal,这里把 wca 也露出来,仅当两者都存在） */}
        {solve.optimalScramble && solve.wcaScramble && (
          <div className="detail-other-scramble">
            <span className="detail-other-scramble-label">{t('recon.wcaScramble')}</span>
            <span className="detail-other-scramble-value">{solve.wcaScramble}</span>
          </div>
        )}

        {/* 统计 */}
        <StatsGrid solve={solve} />

        {/* 视频 */}
        {solve.videoUrl && <VideoSection videoUrl={solve.videoUrl} />}

        {/* 备注 */}
        {solve.note && (
          <div className="detail-section">
            <div className="detail-section-label"><StickyNote size={14} /> {t('recon.note')}</div>
            <div className="detail-note">{solve.note}</div>
          </div>
        )}

        {/* 元数据脚注: 魔方型号 / 复盘者 / 复盘日期 / 录入者 */}
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

        {/* 同轮次成绩导航 */}
        {solve.comp && solve.event && solve.round && (
          <SameRoundNav solve={solve} />
        )}

        {/* 另解——任何登录用户都能投自己的解法 */}
        <AlternativesSection
          reconId={solve.id}
          alts={alts}
          setAlts={setAlts}
          solveTime={(isBldEvent(solve.event) ? solve.execTime : solve.rawTime)}
        />

        {/* 评论 */}
        <CommentsView comments={comments} reconId={solve.id} onUpdate={onUpdate} />
      </div>
    </div>
  );
}


/** 外部链接——alg.cubing.net / cubedb.net / 分享链接 */
function ExternalLinks({ event, scramble, alg, solveId }: {
  event: string; scramble: string; alg: string; solveId: number;
}) {
  const { t } = useTranslation();
  const { algUrl, algSiteName, cubedbUrl } = buildExternalLinks(event, scramble, alg);
  const shareUrl = `${window.location.origin}/recon/detail/?id=${solveId}`;

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(shareUrl).then(() => {
      const btn = e.currentTarget as HTMLElement;
      const orig = btn.textContent;
      btn.textContent = t('recon.copied');
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });
  };

  return (
    <div className="recon-external-links">
      <a href={algUrl} target="_blank" rel="noopener noreferrer">{algSiteName}</a>
      <a href={cubedbUrl} target="_blank" rel="noopener noreferrer">cubedb.net</a>
      <a href="#" onClick={handleCopyLink}>{t('recon.link')}</a>
    </div>
  );
}

// NOTE: Cross type 数字→文本映射
const CROSS_LABELS: Record<number, string> = { 0: 'cross', 1: 'xcross', 2: 'xxcross', 3: 'xxxcross', 4: 'xxxxcross' };

/** 统计网格——完全对齐原版 17 项字段 */
function StatsGrid({ solve }: { solve: ReconSolve }) {
  const { t } = useTranslation();
  // NOTE: 客户端从 solution 文本重算可推导字段，覆盖 DB 里的（旧版/坏算法的）缓存值
  // 这样老 solve 不用重新提交也能正确显示 cross/F2L/LL 等
  // 盲拧 TPS 用 execTime 当分母(跟 submit 页 ReconSubmitPage 一致),非盲走 rawTime
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

  // NOTE: 盲拧项目隐藏 CFOP 专属派生项(Cross/F2L/LL/?x/cross color/OLL/PLL/freePair/yRot)— 对 BLD 解法没意义
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

/** 视频嵌入：按 host 决定 YT/B 站谁嵌入谁出链接 */
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
  const isLocal = host === 'localhost' || host === '127.0.0.1' || /^192\.168\./.test(host);
  const isCN = /(?:^|\.)cuberoot\.me$/.test(host);

  let embedUrls: string[];
  let linkUrls: string[];
  if (isLocal) {
    // 本地 dev：两个都嵌入
    embedUrls = [...ytUrls, ...biliUrls];
    linkUrls = otherUrls;
  } else if (isCN) {
    // cuberoot.me：B 站嵌入 + YouTube 出链接（B 站为空时回退嵌 YT）
    if (biliUrls.length > 0) {
      embedUrls = biliUrls;
      linkUrls = [...ytUrls, ...otherUrls];
    } else {
      embedUrls = ytUrls;
      linkUrls = otherUrls;
    }
  } else {
    // 其他境外域名：YT 嵌入 + B 站出链接（YT 为空时回退嵌 B 站）
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

/** 单个视频嵌入 — 点击 facade 跳到对应平台网页(手机会唤起 app),不再 iframe 嵌入 */
function VideoEmbed({ url }: { url: string }) {
  // NOTE: YouTube
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
          <img
            src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
            alt=""
            referrerPolicy="no-referrer"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
          />
          <img
            src={youtubeLogo}
            alt="YouTube"
            style={{ position: 'relative', width: 68, height: 'auto', opacity: 0.95, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}
          />
        </div>
      </a>
    );
  }

  // NOTE: Bilibili — 同样跳到 B 站网页,手机系统会自动唤起 B 站 app
  // 支持两种:标准 URL 带 BV id(能取封面);b23.tv 短链(没有 BV id,facade 用纯色背景)
  const bvMatch = url.match(/(BV[A-Za-z0-9]+)/);
  const isB23 = /b23\.tv/i.test(url);
  if (bvMatch) {
    const bvId = bvMatch[1];
    return <BilibiliFacade bvId={bvId} href={`https://www.bilibili.com/video/${bvId}`} />;
  }
  if (isB23) {
    return <BilibiliFacade bvId={null} href={url} />;
  }

  // NOTE: 其他链接——显示为普通超链接
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="detail-video-link">
      <Video size={16} /> {url}
    </a>
  );
}

/** 解析粘贴的成绩字符串为 (秒|null)[]：支持 "3.79 4.33 3.61 3.74 2.80" / 逗号 / 换行 / DNF / DNS */
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

/** 同轮次成绩导航 — 缺失把数也渲染为占位 chip，点击跳到新建表单预填共享字段 */
function SameRoundNav({ solve }: { solve: ReconSolve }) {
  const { t } = useTranslation();
  const [siblings, setSiblings] = useState<ReconSolve[]>([]);
  const [loaded, setLoaded] = useState(false);
  // NOTE: 整轮 5 把成绩（秒；DNF=-1 / DNS=-2 / 不存在=null）
  const [wcaAttempts, setWcaAttempts] = useState<(number | null)[] | null>(null);
  // NOTE: 整轮 5 把官方打乱（仅 WCA 来源，cubing.com 暂不返回）
  const [scrambles, setScrambles] = useState<(string | null)[] | null>(null);
  // NOTE: 数据来源标记 — 用于 chip 旁的 lucide icon 提示
  const [attemptsSource, setAttemptsSource] = useState<'wca' | 'cubing' | null>(null);
  // NOTE: 用户手动粘贴的成绩（优先级高于自动源）
  const [pastedAttempts, setPastedAttempts] = useState<(number | null)[] | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteRaw, setPasteRaw] = useState('');

  useEffect(() => {
    if (loaded) return;
    // NOTE: 加载同选手+比赛+项目+轮次的其他 solve（同轮次≠同人,必须按 person 限定）
    listRecons().then(all => {
      const sameRound = all.filter(
        s => s.person === solve.person && s.comp === solve.comp && s.event === solve.event && s.round === solve.round && s.id !== solve.id
      ).sort((a, b) => (a.solveNum ?? 0) - (b.solveNum ?? 0));
      setSiblings(sameRound);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [solve, loaded]);

  // NOTE: 优先 WCA API（已导入的官方比赛），失败 fallback 到 cubing.com 代理（实时直播比赛）
  // 同时拉 WCA scrambles —— cubing.com 不返回 scramble,只能靠 WCA
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
      // NOTE: scrambles 独立拉一次,不阻塞 attempts
      const sc = await fetchScrambles(solve.compWcaId!, solve.event!, solve.round!, solve.groupId);
      if (cancelled) return;
      if (sc) setScrambles(sc);
    })().catch(() => { /* 静默——任一源挂掉都不影响主流程 */ });
    return () => { cancelled = true; };
  }, [solve.compWcaId, solve.personId, solve.event, solve.round, solve.groupId]);

  // NOTE: 把当前+siblings 按 solveNum 索引；渲染 1..N，缺失 slot 为占位 chip
  // total 取 max(event 默认把数, 整轮 attempts 数, sibling+self 里最大 solveNum)
  // —— H2H 决赛(20+ 把)和 cutoff 单淘等场景都靠这个动态判断
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

  // NOTE: 解析后的整轮成绩 — 优先粘贴，再 WCA。返回 null 表示 slot 无成绩可显示
  const attemptFor = (n: number): number | null => {
    const idx = n - 1;
    const fromPaste = pastedAttempts?.[idx];
    if (fromPaste != null) return fromPaste;
    return wcaAttempts?.[idx] ?? null;
  };

  /** -1 → DNF / -2 → DNS / 正数 → formatTime */
  const renderAttempt = (v: number | null): string => {
    if (v == null) return '';
    if (v === -1) return 'DNF';
    if (v === -2) return 'DNS';
    return formatTime(v);
  };

  // NOTE: 实时解析:每次输入变化都尝试解析,只要有 1 个以上有效成绩就应用,不需要点按钮
  const handlePasteChange = (raw: string) => {
    setPasteRaw(raw);
    const parsed = parsePastedAttempts(raw);
    if (parsed.some(v => v != null)) {
      setPastedAttempts(parsed);
    } else {
      setPastedAttempts(null);
    }
  };

  // NOTE: 缺失 chip 跳转链接 — 带 suggestTime / suggestScramble 让 SubmitPage 预填
  const buildHref = (n: number): string => {
    const params = new URLSearchParams();
    params.set('from', String(solve.id));
    params.set('solveNum', String(n));
    const t = attemptFor(n);
    if (t != null && t >= 0) params.set('suggestTime', String(t));   // 不预填 DNF/DNS
    const sc = scrambles?.[n - 1];
    if (sc) params.set('suggestScramble', sc);
    return `/recon/submit?${params.toString()}`;
  };

  const hasAnyAttempt = wcaAttempts != null || pastedAttempts != null;
  const hasMissingSlot = slots.some(n => !bySolveNum.get(n));

  // NOTE: 数据源指示 — 优先级:粘贴 > WCA/cubing
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
              <Link key={n} to={`/recon/${s.id}`} className="same-round-item">
                {formatTime(s.rawTime)}
              </Link>
            );
          }
          const att = attemptFor(n);
          return (
            <Link
              key={n}
              to={buildHref(n)}
              className="same-round-item same-round-missing"
              title={t('recon.addAttempt', { n })}
            >
              {att != null ? renderAttempt(att) : ' '}
            </Link>
          );
        })}
      </div>
      {/* 手动粘贴入口：仅当还有缺失 slot 且没拉到 WCA 数据 */}
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

/** B站视频 facade——异步获取封面图 */
function BilibiliFacade({ bvId, href }: { bvId: string | null; href: string }) {
  const [cover, setCover] = useState<string | null>(null);

  // NOTE: 组件加载时异步获取封面;b23.tv 短链没有 bvId 跳过(显示纯色 facade)
  useEffect(() => {
    if (!bvId) return;
    getBiliCover(bvId).then(res => {
      if (res.pic) setCover(res.pic);
    }).catch(() => { /* 封面获取失败静默忽略，依然显示 logo */ });
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
        {/* NOTE: 有封面则显示缩略图，无则纯黑背景;referrerPolicy=no-referrer 绕 hdslb.com 防盗链 */}
        {cover && (
          <img
            src={cover}
            alt=""
            referrerPolicy="no-referrer"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
          />
        )}
        {/* B 站 logo — 点击 facade 在新窗口打开 B 站 (手机会唤起 app) */}
        <img
          src={bilibiliLogo}
          alt="Bilibili"
          style={{ position: 'relative', width: 68, height: 68, opacity: 0.95, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}
        />
      </div>
    </a>
  );
}

/** 另解区——任何登录用户都能投自己的解法,挂在原 solve 下,不创建新行 */
function AlternativesSection({ reconId, alts, setAlts, solveTime }: {
  reconId: number;
  alts: ReconAlternative[];
  setAlts: (alts: ReconAlternative[]) => void;
  /** 原 solve 单次成绩(秒);用于计算另解 TPS */
  solveTime?: number;
}) {
  const user = useAuthStore(s => s.user);
  const currentWcaId = user?.wcaId || '';
  const isAdminUser = isAdmin();
  const { t } = useTranslation();
  const navigate = useNavigate();

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
          <Link to={`/recon/${reconId}/alt`} className="recon-btn recon-btn-edit" title={t('recon.addAlternative')}>
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
                  {/* 点击文本 → 跳到只看动画+解法的干净页 */}
                  <pre
                    className="detail-solution-text alt-solution-text"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/recon/${reconId}/alt/${idx}`)}
                    title={t('recon.playAlt')}
                  >
                    {alt.solution.split(/\r?\n/).map((line, li) => {
                      const nl = li > 0 ? '\n' : '';
                      if (line.trim().startsWith('//')) {
                        return <span key={li}>{nl}<span className="recon-step-label">{line}</span></span>;
                      }
                      return <span key={li}>{nl}{line}</span>;
                    })}
                  </pre>
                </div>
                <div className="alt-card-actions">
                  <ItemMenu items={[
                    ...(canEdit ? [{
                      icon: <Pencil size={14} />, label: t('recon.edit'),
                      onClick: () => navigate(`/recon/${reconId}/alt/${idx}/edit`),
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

/** 评论区——单层嵌套(YouTube 风格);顶层 + 各自 collapsed 回复列表 */
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
  // 回复状态
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  // 哪些顶层评论的回复已展开
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());

  const user = useAuthStore(s => s.user);
  const currentWcaId = user?.wcaId || '';
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  // 按 parent 分组
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
    // 回复内部按 createdAt asc
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

  // 开启回复 — 自动 prefill @username
  const startReply = (parent: ReconComment) => {
    const name = displayCuberName(parent.authorName || '', isZh);
    setReplyingToId(parent.id);
    setReplyText(`@${name} `);
    // 展开父评论的回复列表(便于看到刚发的)
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
              {/* 回复展开开关 + 内联回复列表 */}
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
                  {/* 回复输入框 */}
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

  /** 单条评论渲染 — top 层和 reply 共用;reply 关闭"回复"和"置顶"按钮 */
  function renderCommentItem(comment: ReconComment, isReply: boolean) {
    const isOwn = !!currentWcaId && currentWcaId === comment.authorId;
    const admin = isAdmin();
    const canEdit = isOwn;
    const canDelete = isOwn || admin;
    const canPin = admin && !isReply; // 回复不允许置顶
    const canReply = !isReply && !!currentWcaId; // 仅顶层可被回复(单层嵌套)
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
}



// NOTE: 声明 twisty-player 为自定义 HTML 元素（React 19 兼容写法）
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
