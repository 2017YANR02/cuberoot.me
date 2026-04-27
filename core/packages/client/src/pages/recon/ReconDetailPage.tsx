/**
 * 复盘详情页——迁移自 recon/detail/recon_detail.js（1586 行）
 * NOTE: 展示单条复盘的完整信息，含 twisty 动画、视频、统计、评论
 */
import { useEffect, useState, useCallback, useRef, type MutableRefObject } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, PenLine, Calendar, UserPlus, Pencil, StickyNote,
  ChartColumn, Video, MessageCircle, Key, TriangleAlert,
} from 'lucide-react';
import type { ReconSolve, ReconComment, EditHistoryItem } from '@cuberoot/shared';
import { getRecon, listComments, getEditHistory, deleteRecon, addComment, updateComment, deleteComment, getBiliCover, listRecons } from '../../utils/recon_api';
import {
  formatTime, flagClass, getEventDisplayName,
  isBldEvent, getPuzzleId, wcaCompUrl, wcaPersonUrl,
  buildExternalLinks, displaySolverName, FACE_COLORS,
} from '../../utils/recon_utils';
import { compNameZh, loadFlagData, flagDataVersion } from '../../utils/country_flags';
import { cleanForPlayer, findTokenPositions, snapToTokenBoundary, extractAlgFromText, syncPlayerToMoveCount } from '../../utils/recon_alg_utils';
import { useAuthStore } from '../../stores/auth_store';
import LangToggle from '../../components/LangToggle';
import { RecordBadge } from '../../components/RecordBadge';
import TwistySection from './components/TwistySection';
import '../../recon.css';
import './recon_detail.css';

export default function ReconDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [solve, setSolve] = useState<ReconSolve | null>(null);
  const [comments, setComments] = useState<ReconComment[]>([]);
  const [history, setHistory] = useState<EditHistoryItem[]>([]);
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
      // NOTE: 评论和历史延迟加载（非关键路径，失败静默）
      listComments(Number(id)).then(setComments).catch(() => {});
      getEditHistory(String(id)).then(setHistory).catch(() => {});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // NOTE: 删除复盘
  const handleDelete = async () => {
    if (!solve || !confirm(t('recon.confirmDelete'))) return;
    try {
      await deleteRecon(solve.id);
      navigate('/recon');
    } catch (err) {
      alert(`Delete failed: ${(err as Error).message}`);
    }
  };

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
          <Link to="/recon" className="detail-back">← {t('common.back')}</Link>
          <LangToggle />
        </div>
        <h1 className="detail-title">
          {solve.rawTime != null && formatTime(solve.rawTime)}
          <RecordBadge record={solve.regionalSingleRecord} variant="inline" />
          {solve.event && ` ${getEventDisplayName(solve.event)}`}
          {solve.personCountry && <>{' '}<span className={flagClass(solve.personCountry)} /></>}
          {' '}{solve.person}
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
                {isZh ? (compNameZh(solve.comp) || solve.comp) : solve.comp}
              </a>
            ) : (isZh ? (compNameZh(solve.comp) || solve.comp) : solve.comp)}
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
              {solve.reconerId ? (
                <a href={wcaPersonUrl(solve.reconerId)} target="_blank" rel="noopener noreferrer">
                  {displaySolverName(solve.reconer, isZh)}
                </a>
              ) : displaySolverName(solve.reconer, isZh)}
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
              {solve.addedById ? (
                <a href={wcaPersonUrl(solve.addedById)} target="_blank" rel="noopener noreferrer">
                  {displaySolverName(solve.addedBy, isZh)}
                </a>
              ) : displaySolverName(solve.addedBy, isZh)}
            </span>
          </div>
        )}
        {history.length > 0 && (
          <div className="detail-meta-item">
            <span className="detail-meta-label"><Pencil size={16} /></span>
            <span className="detail-meta-value">{history.length} {t('recon.editCount', { count: history.length })}</span>
          </div>
        )}
      </div>

      {/* 编辑历史 */}
      {history.length > 0 && <EditHistoryPanel history={history} />}

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
        <button className="recon-btn recon-btn-danger" onClick={handleDelete}>
          {t('recon.delete')}
        </button>
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

  return (
    <div className="detail-body">
      {/* 左列：twisty → 外部链接 → 打乱+解法融合块 */}
      <div className="detail-left">
        {/* Twisty Player */}
        {scramble && solutionText && (
          <TwistySection
            puzzle={getPuzzleId(solve.event)}
            scramble={scramble}
            alg={cleanForPlayer(solutionText)}
            playerRef={playerRef}
          />
        )}

        {/* NOTE: 外部链接——与原版一致（alg.cubing.net / cubedb.net / 链接） */}
        {scramble && solutionText && (
          <ExternalLinks event={solve.event} scramble={scramble} alg={cleanForPlayer(solutionText)} solveId={solve.id} />
        )}

        {/* NOTE: 打乱+解法融合块——原版风格（打乱和解法共享一个视觉框体） */}
        {scramble && solutionText ? (
          <div className="detail-solution-block">
            <div className="detail-scramble-text">{scramble}</div>
            <div className="detail-block-divider" />
            <SolutionView text={solutionText} playerRef={playerRef} />
          </div>
        ) : (
          <>
            {scramble && (
              <div className="detail-section">
                <div className="detail-section-label">{t('recon.scramble')}</div>
                <div className="detail-scramble-text">{scramble}</div>
              </div>
            )}
            {solutionText && (
              <div className="detail-section">
                <div className="detail-section-label">{t('recon.solution')}</div>
                <SolutionView text={solutionText} playerRef={playerRef} />
              </div>
            )}
          </>
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SolutionView({ text, playerRef }: { text: string; playerRef: MutableRefObject<any> }) {
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
    // NOTE: 计算光标前的步数并同步 player
    const textBefore = plainText.substring(0, offset);
    const algBefore = extractAlgFromText(textBefore);
    const moves = algBefore.trim().split(/\s+/).filter(s => s.length > 0);
    syncPlayerToMoveCount(playerRef.current, moves.length);
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
    const moves = algBefore.trim().split(/\s+/).filter(s => s.length > 0);
    syncPlayerToMoveCount(playerRef.current, moves.length);
  }, [playerRef]);

  const lines = text.split(/\r?\n/);
  return (
    <pre
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
        if (trimmed.startsWith('//')) {
          return <span key={i}>{nl}<span className="recon-step-label">{line}</span></span>;
        }
        return <span key={i}>{nl}{line}</span>;
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

/** 视频嵌入 */
function VideoSection({ videoUrl }: { videoUrl: string }) {
  const { t } = useTranslation();
  const urls = videoUrl.split('\n').filter(u => u.trim());
  return (
    <div className="detail-section">
      <div className="detail-section-label">{t('recon.video')}</div>
      {urls.map((url, i) => (
        <VideoEmbed key={i} url={url.trim()} />
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

/** 编辑历史折叠面板 */
function EditHistoryPanel({ history }: { history: EditHistoryItem[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="detail-section">
      <button
        className="recon-btn"
        onClick={() => setOpen(!open)}
        style={{ fontSize: '0.82rem' }}
      >
        {open ? '▼' : '▶'} {t('recon.editHistory')} ({history.length})
      </button>
      {open && (
        <div className="detail-history-list">
          {history.map((item, idx) => (
            <div key={item.id || idx} className="detail-history-item">
              <div className="detail-history-header">
                <span>{item.editedBy || t('recon.unknown')}</span>
                <span className="detail-comment-time">
                  {new Date(item.editedAt * 1000).toLocaleString()}
                </span>
              </div>
              {/* NOTE: 显示变更字段的 before/after diff */}
              {item.after && (
                <div className="detail-history-diff">
                  {Object.keys(item.after).map(key => {
                    const beforeVal = item.before?.[key];
                    const afterVal = item.after![key];
                    // NOTE: 跳过相同值
                    if (JSON.stringify(beforeVal) === JSON.stringify(afterVal)) return null;
                    return (
                      <div key={key} className="detail-history-field">
                        <span className="detail-history-key">{key}</span>
                        <span className="detail-history-before">{String(beforeVal ?? '')}</span>
                        <span className="detail-history-arrow">→</span>
                        <span className="detail-history-after">{String(afterVal ?? '')}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 同轮次成绩导航 */
function SameRoundNav({ solve }: { solve: ReconSolve }) {
  const { t } = useTranslation();
  const [siblings, setSiblings] = useState<ReconSolve[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    // NOTE: 加载同比赛+项目+轮次的其他 solve
    listRecons().then(all => {
      const sameRound = all.filter(
        s => s.comp === solve.comp && s.event === solve.event && s.round === solve.round && s.id !== solve.id
      ).sort((a, b) => (a.solveNum ?? 0) - (b.solveNum ?? 0));
      setSiblings(sameRound);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [solve, loaded]);

  if (siblings.length === 0) return null;

  return (
    <div className="detail-section">
      <div className="detail-section-label">{t('recon.sameRound')}</div>
      <div className="detail-same-round">
        {/* NOTE: 当前 solve */}
        <span className="same-round-item same-round-current">
          #{solve.solveNum ?? '?'} {formatTime(solve.rawTime)}
        </span>
        {siblings.map(s => (
          <Link key={s.id} to={`/recon/${s.id}`} className="same-round-item">
            #{s.solveNum ?? '?'} {formatTime(s.rawTime)}
          </Link>
        ))}
      </div>
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
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const currentWcaId = useAuthStore(s => s.user?.wcaId) || '';
  const { t } = useTranslation();

  const handleAdd = async () => {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addComment(reconId, newComment.trim());
      setNewComment('');
      onUpdate();
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
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
      <div className="detail-comments">
        {comments.map(comment => (
          <div key={comment.id} className="detail-comment">
            <div className="detail-comment-header">
              <strong>{comment.authorName}</strong>
              <span className="detail-comment-time">
                {new Date(comment.createdAt * 1000).toLocaleDateString()}
                {comment.updatedAt && ` (${t('recon.edited')})`}
              </span>
            </div>
            {editingId === comment.id ? (
              <div className="detail-comment-edit">
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  rows={3}
                />
                <div className="detail-comment-edit-actions">
                  <button className="recon-btn-sm" onClick={() => handleEdit(comment.id)}>
                    {t('recon.save')}
                  </button>
                  <button className="recon-btn-sm" onClick={() => setEditingId(null)}>
                    {t('recon.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="detail-comment-body">{comment.content}</div>
                {/* NOTE: 仅本人可编辑/删除自己的评论 */}
                {currentWcaId && currentWcaId === comment.authorId && (
                  <div className="detail-comment-actions">
                    <button className="recon-btn-sm" onClick={() => {
                      setEditingId(comment.id);
                      setEditText(comment.content);
                    }}>
                      {t('recon.edit')}
                    </button>
                    <button className="recon-btn-sm recon-btn-danger-sm" onClick={() => handleDelete(comment.id)}>
                      {t('recon.delete')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* NOTE: 添加评论——需登录后显示，未登录显示提示 */}
      {currentWcaId ? (
        <div className="detail-comment-add">
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder={t('recon.writeComment')}
            rows={2}
          />
          <button
            className="recon-btn"
            onClick={handleAdd}
            disabled={submitting || !newComment.trim()}
          >
            {submitting ? t('recon.posting') : t('recon.post')}
          </button>
        </div>
      ) : (
        <div className="detail-comment-login-hint" onClick={() => useAuthStore.getState().login()} style={{ cursor: 'pointer' }}>
          <Key size={16} /> {t('recon.loginToComment')}
        </div>
      )}
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
