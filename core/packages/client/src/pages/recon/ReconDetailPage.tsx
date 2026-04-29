/**
 * 复盘详情页——迁移自 recon/detail/recon_detail.js（1586 行）
 * NOTE: 展示单条复盘的完整信息，含 twisty 动画、视频、统计、评论
 */
import { useEffect, useState, useCallback, useMemo, useRef, type MutableRefObject } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, PenLine, Calendar, UserPlus, StickyNote,
  ChartColumn, Video, MessageCircle, Key, TriangleAlert, ArrowRightLeft,
  MoreVertical, Pencil, Trash2, Pin, PinOff,
  Globe, Radio, ClipboardPaste,
} from 'lucide-react';
import type { ReconSolve, ReconComment } from '@cuberoot/shared';
import { getRecon, listComments, addComment, updateComment, deleteComment, pinComment, getBiliCover, listRecons } from '../../utils/recon_api';
import {
  formatTime, flagClass,
  isBldEvent, getPuzzleId, wcaCompUrl, wcaPersonUrl,
  buildExternalLinks, FACE_COLORS, attemptsPerRound,
} from '../../utils/recon_utils';
import { displayCuberName } from '../../utils/name_utils';
import { eventDisplayName } from '../../utils/wca_events';
import { EventIcon } from '../../components/EventIcon';
import { compNameZh, loadFlagData, flagDataVersion, personFlagIso2 } from '../../utils/country_flags';
import { Flag } from '../../utils/flag';
import { stripWcaPrefix } from '../../utils/comp_localize';
import { toIsoDate } from '../../utils/date_range';
import { cleanForPlayer, findTokenPositions, snapToTokenBoundary, extractAlgFromText, syncPlayerToMoveCount, countMovesExpanded } from '../../utils/recon_alg_utils';
import { fetchAttempts, fetchCubingAttempts, fetchScrambles } from '../../utils/wca_results_api';
import { useAuthStore, isAdmin } from '../../stores/auth_store';
import LangToggle from '../../components/LangToggle';
import { RecordBadge } from '../../components/RecordBadge';
import TwistySection from './components/TwistySection';
import { buildNormalizedSolution, findCrossLineIndex, hasWideMoveInCrossSection } from '../../utils/recon_norm_cross_extract';
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
    <div className="recon-page">
      {/* NOTE: 页头——对齐原版格式: 时间 + 纪录 + 项目 + 选手名 + 国旗 */}
      <div className="detail-header">
        <div className="detail-header-nav">
          <LangToggle />
        </div>
        <h1 className="detail-title">
          {solve.rawTime != null && formatTime(solve.rawTime)}
          <RecordBadge record={solve.regionalSingleRecord} variant="inline" />
          {solve.event && (
            <>{' '}<EventIcon event={solve.event} />{' '}{eventDisplayName(solve.event, isZh)}</>
          )}
          {solve.personCountry && <>{' '}<span className={flagClass(solve.personCountry)} /></>}
          {' '}{displayCuberName(solve.person || '', isZh)}
        </h1>
      </div>

      {/* NOTE: 元数据——对齐原版（日期 + 国旗 + 比赛名链接） */}
      <div className="detail-meta-bar">
        {solve.date && <span className="detail-meta-item">{solve.date.slice(0, 10)}</span>}
        {solve.comp && (
          <span className="detail-meta-item">
            {solve.country && <><span className={flagClass(solve.country)} />{' '}</>}
            {solve.compWcaId ? (
              <a href={wcaCompUrl(solve.compWcaId)} target="_blank" rel="noopener noreferrer">
                {stripWcaPrefix(isZh ? (compNameZh(solve.comp) || solve.comp) : solve.comp)}
              </a>
            ) : stripWcaPrefix(isZh ? (compNameZh(solve.comp) || solve.comp) : solve.comp)}
          </span>
        )}
      </div>

      <TwistyPlayerContext scramble={scramble} solutionText={solutionText} solve={solve} />

      {/* NOTE: 元数据区——原版 emoji + 链接化 */}
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

      {/* 评论 */}
      <CommentsView comments={comments} reconId={solve.id} onUpdate={loadData} />

      {/* 操作按钮 */}
      <div className="detail-actions">
        <Link to={`/recon/submit/${solve.id}`} className="recon-btn recon-btn-edit">
          {t('recon.edit')}
        </Link>
      </div>
    </div>
  );
}

// ── 子组件 ──

/**
 * 主体两列布局——包含 twisty player + 解法文本 + 光标跟随
 * NOTE: 从 legacy 迁移的核心交互——player ref 在 twisty 和 solution 之间共享
 */
function TwistyPlayerContext({ scramble, solutionText, solve }: {
  scramble: string; solutionText: string; solve: ReconSolve;
}) {
  const { t } = useTranslation();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const [crossNormalized, setCrossNormalized] = useState(false);

  // NOTE: 仅当 cross 段含宽转动时才允许切换；只有插入旋转或全单层时不显示
  const canToggle = useMemo(() => hasWideMoveInCrossSection(solutionText), [solutionText]);
  const normalizedText = useMemo(
    () => canToggle ? buildNormalizedSolution(solutionText) : null,
    [solutionText, canToggle],
  );
  const displayText = crossNormalized && normalizedText ? normalizedText : solutionText;
  const crossLineIdx = useMemo(() => findCrossLineIndex(displayText), [displayText]);

  return (
    <div className="detail-body">
      {/* 左列：twisty → 外部链接 → 打乱+解法融合块 */}
      <div className="detail-left">
        {/* Twisty Player */}
        {scramble && solutionText && (
          <TwistySection
            puzzle={getPuzzleId(solve.event)}
            scramble={scramble}
            alg={cleanForPlayer(displayText)}
            playerRef={playerRef}
          />
        )}

        {/* NOTE: 外部链接——与原版一致（alg.cubing.net / cubedb.net / 链接） */}
        {scramble && solutionText && (
          <ExternalLinks event={solve.event} scramble={scramble} alg={cleanForPlayer(solutionText)} solveId={solve.id} />
        )}

        {scramble && (
          <div className="detail-section">
            <div className="detail-section-label">{t('recon.scramble')}</div>
            <div className="detail-scramble-text">{scramble}</div>
          </div>
        )}
        {solutionText && (
          <div className="detail-section">
            <div className="detail-section-label">{t('recon.solution')}</div>
            <SolutionView
              text={displayText}
              playerRef={playerRef}
              crossLineIdx={canToggle ? crossLineIdx : -1}
              crossNormalized={crossNormalized}
              onToggleCross={() => setCrossNormalized(v => !v)}
            />
          </div>
        )}
      </div>

      {/* 右列：视频 → 统计 → 备注 */}
      <div className="detail-right">
        {solve.videoUrl && <VideoSection videoUrl={solve.videoUrl} />}
        <StatsGrid solve={solve} />
        {solve.note && (
          <div className="detail-section">
            <div className="detail-section-label"><StickyNote size={14} /> {t('recon.note')}</div>
            <div className="detail-note">{solve.note}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 光标跟随工具函数（从 legacy recon_detail.js 迁移） ──

/** 获取点击在 DOM 元素纯文本中的绝对偏移 */
function getTextOffsetInElement(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return -1;
  const node = sel.anchorNode;
  let offset = sel.anchorOffset;
  if (!node || !el.contains(node)) return -1;
  let current: Node | null = node;
  while (current && current !== el) {
    let prev = current.previousSibling;
    while (prev) {
      offset += (prev.textContent || '').length;
      prev = prev.previousSibling;
    }
    current = current.parentNode;
  }
  return offset;
}

/** 在 DOM 元素的指定纯文本偏移处插入可视闪烁光标 */
function insertVisualCursor(el: HTMLElement, textOffset: number) {
  const old = el.querySelector('.detail-cursor');
  if (old) old.remove();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let accumulated = 0;
  let targetNode: Text | null = null;
  let localOffset = 0;
  while (walker.nextNode()) {
    const nodeLen = (walker.currentNode as Text).textContent?.length || 0;
    if (accumulated + nodeLen >= textOffset) {
      targetNode = walker.currentNode as Text;
      localOffset = textOffset - accumulated;
      break;
    }
    accumulated += nodeLen;
  }
  if (!targetNode) return;
  const cursor = document.createElement('span');
  cursor.className = 'detail-cursor';
  cursor.textContent = '\u200B';
  const afterNode = targetNode.splitText(localOffset);
  afterNode.parentNode!.insertBefore(cursor, afterNode);
}


/** 解法文本展示——高亮阶段注释 + 光标跟随 twisty-player（从 legacy 迁移） */
function SolutionView({ text, playerRef, crossLineIdx, crossNormalized, onToggleCross }: {
  text: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef: MutableRefObject<any>;
  crossLineIdx: number;
  crossNormalized: boolean;
  onToggleCross: () => void;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const cursorOffsetRef = useRef(0);

  // NOTE: 点击解法文本——计算偏移 → 磁吸到 token 边界 → 插入光标 + 同步 player
  const handleClick = useCallback(() => {
    const el = preRef.current;
    if (!el) return;
    let offset = getTextOffsetInElement(el);
    if (offset < 0) return;
    const plainText = (el.textContent || '').replace(/\u200B/g, '');
    const result = findTokenPositions(plainText);
    offset = snapToTokenBoundary(offset, result);
    cursorOffsetRef.current = offset;
    insertVisualCursor(el, offset);
    // NOTE: 计算光标前的步数并同步 player——展开 (...)N 重复以对齐播放器的实际动画步数
    const textBefore = plainText.substring(0, offset);
    const algBefore = extractAlgFromText(textBefore);
    syncPlayerToMoveCount(playerRef.current, countMovesExpanded(algBefore));
  }, [playerRef]);

  // NOTE: 方向键导航——左右按 token 跳转，上下按行跳转（从 legacy 迁移）
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const el = preRef.current;
    if (!el || !playerRef.current) return;
    const fullText = (el.textContent || '').replace(/\u200B/g, '');
    const tokens = findTokenPositions(fullText);
    if (tokens.length === 0) return;
    let newPos = cursorOffsetRef.current;

    if (e.key === 'ArrowRight') {
      for (const t of tokens) {
        if (t.start >= cursorOffsetRef.current) { newPos = t.end; break; }
      }
    } else if (e.key === 'ArrowLeft') {
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].end < cursorOffsetRef.current) { newPos = tokens[j].end; break; }
      }
    } else {
      // NOTE: ArrowUp/ArrowDown — 按行跳转
      const lines = fullText.split('\n');
      const lineStarts: number[] = [];
      let off = 0;
      for (const line of lines) { lineStarts.push(off); off += line.length + 1; }
      let curLine = 0;
      for (let l = lineStarts.length - 1; l >= 0; l--) {
        if (cursorOffsetRef.current >= lineStarts[l]) { curLine = l; break; }
      }
      const targetLine = e.key === 'ArrowDown' ? curLine + 1 : curLine - 1;
      if (targetLine < 0 || targetLine >= lines.length) return;
      const targetStart = lineStarts[targetLine];
      const targetEnd = targetStart + lines[targetLine].length;
      if (e.key === 'ArrowDown') {
        for (const t of tokens) {
          if (t.start >= targetStart && t.end <= targetEnd) { newPos = t.end; break; }
        }
      } else {
        for (let n = tokens.length - 1; n >= 0; n--) {
          if (tokens[n].start >= targetStart && tokens[n].end <= targetEnd) { newPos = tokens[n].end; break; }
        }
      }
    }
    if (newPos === cursorOffsetRef.current) return;
    e.preventDefault();
    cursorOffsetRef.current = newPos;
    insertVisualCursor(el, newPos);
    const textBefore = fullText.substring(0, newPos);
    const algBefore = extractAlgFromText(textBefore);
    syncPlayerToMoveCount(playerRef.current, countMovesExpanded(algBefore));
  }, [playerRef]);

  const lines = text.split(/\r?\n/);
  return (
    <pre
      // NOTE: key 跟着文本走，切换 toggle 时强制重挂载，丢弃 insertVisualCursor 留下的 splitText 残留
      key={crossNormalized ? 'normalized' : 'original'}
      ref={preRef}
      className="detail-solution-text"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{ cursor: 'text', outline: 'none' }}
    >
      {/* NOTE: 用 \n + <span> 而非 <div> 包裹每行
        * <div> 是块级元素，el.textContent 不会在 <div> 之间插入 \n
        * 导致 extractAlgFromText 的 split('\n') 只有一行，步数计算完全错误
        * <pre> 天然保留 \n，所以手动插入 \n 确保 textContent 含正确换行 */}
      {lines.map((line, i) => {
        const trimmed = line.trim();
        const nl = i > 0 ? '\n' : '';
        const toggle = i === crossLineIdx ? (
          <button
            type="button"
            className={`recon-cross-toggle${crossNormalized ? ' active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleCross(); }}
            title={crossNormalized ? 'Show original' : 'Normalize cross'}
            tabIndex={-1}
          >
            <ArrowRightLeft size={12} />
          </button>
        ) : null;
        if (trimmed.startsWith('//')) {
          return <span key={i}>{nl}<span className="recon-step-label">{line}</span>{toggle}</span>;
        }
        return <span key={i}>{nl}{line}{toggle}</span>;
      })}
    </pre>
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
  const items: [string, React.ReactNode | undefined][] = [
    [t('recon.method'), solve.method],
    [t('recon.stm'), solve.stm],
    [t('recon.tps'), solve.tps],
    [t('recon.exec'), isBldEvent(solve.event) && solve.execTime != null ? Number(solve.execTime).toFixed(2) : undefined],
    [t('recon.memo'), isBldEvent(solve.event) && solve.memoTime != null ? Number(solve.memoTime).toFixed(2) : undefined],
    ['Cross', solve.crossStm != null ? `${solve.crossStm}` : undefined],
    ['F2L', solve.f2l != null ? `${solve.f2l}` : undefined],
    [t('recon.ll'), solve.ll != null ? `${solve.ll}` : undefined],
    ['?x', solve.crossType != null ? (CROSS_LABELS[solve.crossType as number] || String(solve.crossType)) : undefined],
    [t('recon.freePair'), solve.freePair],
    [t('recon.yRot'), solve.yRot],
    [t('recon.regrip'), solve.regrip],
    [t('recon.lockup'), solve.lockup],
    [t('recon.sMove'), solve.sMove],
    [t('recon.crossColor'), solve.crossColor ? (
      FACE_COLORS[solve.crossColor as string]
        ? <span style={{ color: FACE_COLORS[solve.crossColor as string], fontWeight: 600 }}>{String(solve.crossColor)}</span>
        : String(solve.crossColor)
    ) : undefined],
    ['OLL', solve.ollShort || solve.oll],
    ['PLL', solve.pllShort || solve.pll],
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
    else if (/BV[A-Za-z0-9]+/.test(u) || /bilibili\.com/i.test(u)) biliUrls.push(u);
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
    // ruiminyan.github.io 或其他境外：YT 嵌入 + B 站出链接（YT 为空时回退嵌 B 站）
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
      {embedUrls.map((url, i) => (
        <VideoEmbed key={`e${i}`} url={url} />
      ))}
      {linkUrls.map((url, i) => (
        <a key={`l${i}`} href={url} target="_blank" rel="noopener noreferrer" className="detail-video-link">
          <Video size={16} /> {url}
        </a>
      ))}
    </div>
  );
}

/** 单个视频嵌入 */
function VideoEmbed({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);

  // NOTE: YouTube
  const ytMatch = url.match(/youtu\.?be(?:\.com)?\/(?:watch\?.*v=|embed\/|shorts\/|live\/|v\/|)([A-Za-z0-9_-]+)/);
  if (ytMatch) {
    const ytId = ytMatch[1];
    const tMatch = url.match(/[?&]t=(\d+)/);
    const tParam = tMatch ? `?start=${tMatch[1]}` : '';
    if (!loaded) {
      return (
        <div className="detail-video-wrap detail-video-facade" onClick={() => setLoaded(true)}>
          <img src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`} alt="YouTube video" />
          <img className="detail-video-play-yt"
            src="https://www.youtube.com/s/desktop/28b0985e/img/favicon_144x144.png" alt="Play" />
        </div>
      );
    }
    return (
      <div className="detail-video-wrap">
        <iframe
          src={`https://www.youtube.com/embed/${ytId}?autoplay=1${tParam.replace('?', '&')}`}
          allow="autoplay; encrypted-media" allowFullScreen title="YouTube video"
        />
      </div>
    );
  }

  // NOTE: Bilibili — 异步获取封面图 + 品牌 logo overlay
  const bvMatch = url.match(/(BV[A-Za-z0-9]+)/);
  if (bvMatch) {
    const bvId = bvMatch[1];
    if (!loaded) {
      return <BilibiliFacade bvId={bvId} onLoad={() => setLoaded(true)} />;
    }
    return (
      <div className="detail-video-wrap">
        <iframe
          src={`https://player.bilibili.com/player.html?bvid=${bvId}&autoplay=1&high_quality=1`}
          allow="autoplay" allowFullScreen title="Bilibili video"
        />
      </div>
    );
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

  // NOTE: 把当前+siblings 按 solveNum 索引；渲染 1..N（N 由 event 决定），缺失 slot 为占位 chip
  const total = attemptsPerRound(solve.event);
  const bySolveNum = new Map<number, ReconSolve>();
  for (const s of [...siblings, solve]) {
    if (s.solveNum != null) bySolveNum.set(s.solveNum, s);
  }
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
                #{n} {formatTime(s.rawTime)}
              </span>
            );
          }
          if (s) {
            return (
              <Link key={n} to={`/recon/${s.id}`} className="same-round-item">
                #{n} {formatTime(s.rawTime)}
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
              #{n}{att != null && <> {renderAttempt(att)}</>}
            </Link>
          );
        })}
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
      </div>
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
function BilibiliFacade({ bvId, onLoad }: { bvId: string; onLoad: () => void }) {
  const [cover, setCover] = useState<string | null>(null);

  // NOTE: 组件加载时异步获取封面
  useEffect(() => {
    getBiliCover(bvId).then(res => {
      if (res.pic) setCover(res.pic);
    }).catch(() => { /* 封面获取失败静默忽略，依然显示 logo */ });
  }, [bvId]);

  return (
    <div className="detail-video-wrap detail-video-facade" onClick={onLoad}>
      <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* NOTE: 有封面则显示缩略图，无则纯黑背景 */}
        {cover && (
          <img
            src={cover}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
          />
        )}
        {/* B站品牌 logo overlay */}
        <img
          className="detail-video-play-bili"
          src="/recon/assets/bilibili_logo.png"
          alt="Bilibili"
          style={{ position: 'relative', width: 68, height: 68, opacity: 0.85, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}
        />
      </div>
    </div>
  );
}

/** 评论区——CRUD 完整功能 */
function CommentsView({
  comments, reconId, onUpdate,
}: {
  comments: ReconComment[];
  reconId: number;
  onUpdate: () => void;
}) {
  const [newComment, setNewComment] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const user = useAuthStore(s => s.user);
  const currentWcaId = user?.wcaId || '';
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  // NOTE: 点击空白处关闭菜单
  useEffect(() => {
    if (menuOpenId === null) return;
    const handler = () => setMenuOpenId(null);
    const timer = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handler);
    };
  }, [menuOpenId]);

  const handleAdd = async () => {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addComment(reconId, newComment.trim());
      setNewComment('');
      setComposerOpen(false);
      onUpdate();
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelCompose = () => {
    setNewComment('');
    setComposerOpen(false);
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

  return (
    <div className="detail-section">
      <div className="detail-section-label">
        <MessageCircle size={14} /> {t('recon.comments')} ({comments.length})
      </div>
      {/* NOTE: 添加评论——YouTube 风格，放在评论列表上方；未登录则显示登录提示 */}
      {currentWcaId ? (
        <div className={`yt-composer${composerOpen || newComment ? ' yt-composer-active' : ''}`}>
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="yt-composer-avatar" />
          ) : (
            <div className="yt-composer-avatar yt-composer-avatar-fallback">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div className="yt-composer-body">
            <textarea
              className="yt-composer-input"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onFocus={() => setComposerOpen(true)}
              placeholder={t('recon.writeComment')}
              rows={composerOpen || newComment ? 2 : 1}
            />
            {(composerOpen || newComment) && (
              <div className="yt-composer-actions">
                <div />
                <div className="yt-composer-buttons">
                  <button type="button" className="yt-btn-text" onClick={handleCancelCompose}>
                    {t('recon.cancel')}
                  </button>
                  <button
                    type="button"
                    className="yt-btn-primary"
                    onClick={handleAdd}
                    disabled={submitting || !newComment.trim()}
                  >
                    {submitting ? t('recon.posting') : t('recon.post')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="detail-comment-login-hint" onClick={() => useAuthStore.getState().login()} style={{ cursor: 'pointer' }}>
          <Key size={16} /> {t('recon.loginToComment')}
        </div>
      )}

      <div className="yt-comment-list">
        {comments.map(comment => {
          const isOwn = !!currentWcaId && currentWcaId === comment.authorId;
          const admin = isAdmin();
          const canEdit = isOwn;
          const canDelete = isOwn || admin;
          const canPin = admin;
          const ownAvatar = isOwn && user?.avatar ? user.avatar : null;
          const displayName = displayCuberName(comment.authorName || '', isZh);
          return (
            <div key={comment.id} className="yt-comment">
              {ownAvatar ? (
                <img src={ownAvatar} alt="" className="yt-comment-avatar" />
              ) : (
                <div className="yt-comment-avatar yt-comment-avatar-fallback">
                  {displayName?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div className="yt-comment-content">
                {comment.pinned && (
                  <div className="yt-comment-pinned-badge">
                    <Pin size={12} /> {t('recon.pinned')}
                  </div>
                )}
                <div className="yt-comment-meta">
                  <Flag iso2={personFlagIso2(comment.authorId)} className="yt-comment-flag" />
                  <span className="yt-comment-author">{displayName}</span>
                  <span className="yt-comment-time">
                    {toIsoDate(new Date(comment.createdAt * 1000))}
                    {comment.updatedAt ? ` (${t('recon.edited')})` : ''}
                  </span>
                </div>
                {editingId === comment.id ? (
                  <div className="yt-comment-edit">
                    <textarea
                      className="yt-composer-input"
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={2}
                      autoFocus
                    />
                    <div className="yt-composer-actions">
                      <div />
                      <div className="yt-composer-buttons">
                        <button type="button" className="yt-btn-text" onClick={() => setEditingId(null)}>
                          {t('recon.cancel')}
                        </button>
                        <button type="button" className="yt-btn-primary" onClick={() => handleEdit(comment.id)} disabled={!editText.trim()}>
                          {t('recon.save')}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="yt-comment-body">{comment.content}</div>
                )}
              </div>
              {(canEdit || canDelete || canPin) && editingId !== comment.id && (
                <div className="yt-comment-menu-wrap" onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className="yt-comment-menu-btn"
                    onClick={() => setMenuOpenId(menuOpenId === comment.id ? null : comment.id)}
                  >
                    <MoreVertical size={18} />
                  </button>
                  {menuOpenId === comment.id && (
                    <div className="yt-comment-menu">
                      {canEdit && (
                        <button type="button" onClick={() => {
                          setEditingId(comment.id);
                          setEditText(comment.content);
                          setMenuOpenId(null);
                        }}>
                          <Pencil size={14} /> {t('recon.edit')}
                        </button>
                      )}
                      {canPin && (
                        <button type="button" onClick={() => {
                          setMenuOpenId(null);
                          handleTogglePin(comment.id, !comment.pinned);
                        }}>
                          {comment.pinned
                            ? <><PinOff size={14} /> {t('recon.unpin')}</>
                            : <><Pin size={14} /> {t('recon.pin')}</>}
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" onClick={() => {
                          setMenuOpenId(null);
                          handleDelete(comment.id);
                        }}>
                          <Trash2 size={14} /> {t('recon.delete')}
                        </button>
                      )}
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
