/**
 * 复盘详情页——迁移自 recon/detail/recon_detail.js（1586 行）
 * NOTE: 展示单条复盘的完整信息，含 twisty 动画、视频、统计、评论
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { ReconSolve, ReconComment, EditHistoryItem } from '@cuberoot/shared';
import { getRecon, listComments, getEditHistory, deleteRecon, addComment, updateComment, deleteComment, getBiliCover, listRecons } from '../../utils/recon_api';
import {
  formatTime, countryFlag, getEventDisplayName, getRoundDisplay,
  isBldEvent, getPuzzleId, t, wcaCompUrl, wcaPersonUrl,
  buildExternalLinks, displaySolverName, FACE_COLORS,
} from '../../utils/recon_utils';
import { cleanForPlayer } from '../../utils/recon_alg_utils';
import '../../recon.css';
import './recon_detail.css';

export default function ReconDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [solve, setSolve] = useState<ReconSolve | null>(null);
  const [comments, setComments] = useState<ReconComment[]>([]);
  const [history, setHistory] = useState<EditHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // NOTE: 加载复盘数据
  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [solveData, commentsData] = await Promise.all([
        getRecon(Number(id)),
        listComments(Number(id)),
      ]);
      setSolve(solveData);
      setComments(commentsData);
      // NOTE: 编辑历史延迟加载（非关键路径）
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
    if (!solve || !confirm(t('确定删除此复盘？', 'Delete this reconstruction?'))) return;
    try {
      await deleteRecon(solve.id);
      navigate('/recon');
    } catch (err) {
      alert(`Delete failed: ${(err as Error).message}`);
    }
  };

  if (loading) return <div className="recon-page"><div className="recon-loading">Loading...</div></div>;
  if (error) return <div className="recon-page"><div className="recon-error">⚠️ {error}</div></div>;
  if (!solve) return <div className="recon-page"><div className="recon-error">Not found</div></div>;

  // NOTE: 解法文本：优先使用 solution 字段，fallback 到旧 recon 字段
  const solutionText = solve.solution || solve.recon || '';
  const scramble = solve.optimalScramble || solve.wcaScramble || '';

  return (
    <div className="recon-page">
      {/* 页头 */}
      <div className="detail-header">
        <Link to="/recon" className="detail-back">← {t('返回', 'Back')}</Link>
        <h1 className="detail-title">
          {solve.personCountry && countryFlag(solve.personCountry)}{' '}
          {solve.person}
          {solve.rawTime != null && ` — ${formatTime(solve.rawTime)}`}
          {solve.regionalSingleRecord && (
            <span className={`record-badge record-${solve.regionalSingleRecord.toLowerCase().replace('cancelled ', 'cancelled')}`}>
              {solve.regionalSingleRecord}
            </span>
          )}
        </h1>
      </div>

      {/* 元数据 */}
      <div className="detail-meta-bar">
        {solve.comp && (
          <span className="detail-meta-tag">
            {solve.country && countryFlag(solve.country)}{' '}
            {solve.compWcaId ? (
              <a href={wcaCompUrl(solve.compWcaId)} target="_blank" rel="noopener noreferrer">
                {solve.comp}
              </a>
            ) : solve.comp}
          </span>
        )}
        {solve.event && <span className="detail-meta-tag">{getEventDisplayName(solve.event)}</span>}
        {solve.method && <span className="detail-meta-tag">{solve.method}</span>}
        {solve.round && <span className="detail-meta-tag">{getRoundDisplay(solve.round)}</span>}
        {solve.solveNum != null && <span className="detail-meta-tag">#{solve.solveNum}</span>}
        {solve.date && <span className="detail-meta-tag">📅 {solve.date}</span>}
        {solve.official && <span className="detail-meta-tag">🏆 WCA</span>}
        {solve.personId && (
          <a href={wcaPersonUrl(solve.personId)} target="_blank" rel="noopener noreferrer" className="detail-meta-tag">
            {solve.personId}
          </a>
        )}
      </div>

      {/* 主体——两列布局 */}
      <div className="detail-body">
        {/* 左列：twisty → 外部链接 → 打乱+解法融合块 */}
        <div className="detail-left">
          {/* Twisty Player */}
          {scramble && solutionText && (
            <TwistySection
              puzzle={getPuzzleId(solve.event)}
              scramble={scramble}
              alg={cleanForPlayer(solutionText)}
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
              <SolutionView text={solutionText} />
            </div>
          ) : (
            <>
              {scramble && (
                <div className="detail-section">
                  <div className="detail-section-label">{t('打乱', 'Scramble')}</div>
                  <div className="detail-scramble-text">{scramble}</div>
                </div>
              )}
              {solutionText && (
                <div className="detail-section">
                  <div className="detail-section-label">{t('解法', 'Solution')}</div>
                  <SolutionView text={solutionText} />
                </div>
              )}
            </>
          )}
        </div>

        {/* 右列：视频 → 统计 → 备注 */}
        <div className="detail-right">
          {/* 视频 */}
          {solve.videoUrl && <VideoSection videoUrl={solve.videoUrl} />}

          {/* 统计网格 */}
          <StatsGrid solve={solve} />

          {/* 备注 */}
          {solve.note && (
            <div className="detail-section">
              <div className="detail-section-label">📝 {t('备注', 'Note')}</div>
              <div className="detail-note">{solve.note}</div>
            </div>
          )}
        </div>
      </div>

      {/* NOTE: 元数据区——原版 emoji + 链接化 */}
      <div className="detail-meta">
        {solve.cube && (
          <div className="detail-meta-item">
            <span className="detail-meta-label">🧳</span>
            <span className="detail-meta-value">{solve.cube}</span>
          </div>
        )}
        {solve.reconer && (
          <div className="detail-meta-item">
            <span className="detail-meta-label">✍️</span>
            <span className="detail-meta-value">
              {solve.reconerId ? (
                <a href={wcaPersonUrl(solve.reconerId)} target="_blank" rel="noopener noreferrer">
                  {displaySolverName(solve.reconer)}
                </a>
              ) : displaySolverName(solve.reconer)}
            </span>
          </div>
        )}
        {solve.reconDate && (
          <div className="detail-meta-item">
            <span className="detail-meta-label">📅</span>
            <span className="detail-meta-value">{solve.reconDate}</span>
          </div>
        )}
        {solve.addedBy && (
          <div className="detail-meta-item">
            <span className="detail-meta-label">➕</span>
            <span className="detail-meta-value">
              {solve.addedById ? (
                <a href={wcaPersonUrl(solve.addedById)} target="_blank" rel="noopener noreferrer">
                  {displaySolverName(solve.addedBy)}
                </a>
              ) : displaySolverName(solve.addedBy)}
            </span>
          </div>
        )}
        {history.length > 0 && (
          <div className="detail-meta-item">
            <span className="detail-meta-label">✏️</span>
            <span className="detail-meta-value">{history.length} {t('次编辑', 'edits')}</span>
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
          {t('编辑', 'Edit')}
        </Link>
        <button className="recon-btn recon-btn-danger" onClick={handleDelete}>
          {t('删除', 'Delete')}
        </button>
      </div>
    </div>
  );
}

// ── 子组件 ──

/** 解法文本展示——高亮阶段注释 */
function SolutionView({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  return (
    <pre className="detail-solution-text">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) {
          return <div key={i} className="recon-step-label">{line}</div>;
        }
        return <div key={i}>{line}</div>;
      })}
    </pre>
  );
}

/** 外部链接——alg.cubing.net / cubedb.net / 分享链接 */
function ExternalLinks({ event, scramble, alg, solveId }: {
  event: string; scramble: string; alg: string; solveId: number;
}) {
  const { algUrl, algSiteName, cubedbUrl } = buildExternalLinks(event, scramble, alg);
  const shareUrl = `${window.location.origin}/recon/detail/?id=${solveId}`;

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(shareUrl).then(() => {
      const btn = e.currentTarget as HTMLElement;
      const orig = btn.textContent;
      btn.textContent = t('已复制', 'copied');
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });
  };

  return (
    <div className="recon-external-links">
      <a href={algUrl} target="_blank" rel="noopener noreferrer">{algSiteName}</a>
      <a href={cubedbUrl} target="_blank" rel="noopener noreferrer">cubedb.net</a>
      <a href="#" onClick={handleCopyLink}>{t('链接', 'link')}</a>
    </div>
  );
}

// NOTE: Cross type 数字→文本映射
const CROSS_LABELS: Record<number, string> = { 0: 'cross', 1: 'xcross', 2: 'xxcross', 3: 'xxxcross', 4: 'xxxxcross' };

/** 统计网格——完全对齐原版 17 项字段 */
function StatsGrid({ solve }: { solve: ReconSolve }) {
  // NOTE: 完整字段列表，与原版 buildStatsGrid 一致
  // NOTE: 值类型为 React.ReactNode 以支持 crossColor 着色
  const items: [string, React.ReactNode | undefined][] = [
    [t('方法', 'Method'), solve.method],
    [t('步数', 'STM'), solve.stm],
    [t('手速', 'TPS'), solve.tps],
    // NOTE: 盲拧专用
    [t('执行', 'Exec'), isBldEvent(solve.event) && solve.execTime != null ? Number(solve.execTime).toFixed(2) : undefined],
    [t('记忆', 'Memo'), isBldEvent(solve.event) && solve.memoTime != null ? Number(solve.memoTime).toFixed(2) : undefined],
    // NOTE: CFOP 阶段统计
    ['Cross', solve.crossStm != null ? `${solve.crossStm}` : undefined],
    ['F2L', solve.f2l != null ? `${solve.f2l}` : undefined],
    [t('顶层', 'LL'), solve.ll != null ? `${solve.ll}` : undefined],
    // NOTE: XCross 类型
    ['?x', solve.crossType != null ? (CROSS_LABELS[solve.crossType as number] || String(solve.crossType)) : undefined],
    [t('基态', 'Free Pair'), solve.freePair],
    [t('y 转体', 'y rot'), solve.yRot],
    [t('换手', 'Regrip'), solve.regrip],
    [t('卡顿', 'Lockup'), solve.lockup],
    ['S' + t('转动', ' move'), solve.sMove],
    // NOTE: crossColor 使用 FACE_COLORS 着色，与原版一致
    [t('底色', 'Color'), solve.crossColor ? (
      FACE_COLORS[solve.crossColor as string]
        ? <span style={{ color: FACE_COLORS[solve.crossColor as string], fontWeight: 600 }}>{String(solve.crossColor)}</span>
        : String(solve.crossColor)
    ) : undefined],
    ['OLL', solve.ollShort || solve.oll],
    ['PLL', solve.pllShort || solve.pll],
  ];

  // NOTE: 过滤掉空值和零值
  const validItems = items.filter(([, v]) => v != null && v !== '' && v !== 0);
  if (validItems.length === 0) return null;

  return (
    <div className="detail-section">
      <div className="detail-section-label">📊 {t('统计', 'Statistics')}</div>
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
  const urls = videoUrl.split('\n').filter(u => u.trim());
  return (
    <div className="detail-section">
      <div className="detail-section-label">{t('视频', 'Video')}</div>
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
      🎥 {url}
    </a>
  );
}

/** 编辑历史折叠面板 */
function EditHistoryPanel({ history }: { history: EditHistoryItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="detail-section">
      <button
        className="recon-btn"
        onClick={() => setOpen(!open)}
        style={{ fontSize: '0.82rem' }}
      >
        {open ? '▼' : '▶'} {t('编辑历史', 'Edit History')} ({history.length})
      </button>
      {open && (
        <div className="detail-history-list">
          {history.map((item, idx) => (
            <div key={item.id || idx} className="detail-history-item">
              <div className="detail-history-header">
                <span>{item.editedBy || t('未知', 'unknown')}</span>
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
      <div className="detail-section-label">{t('同轮次复盘', 'Same Round')}</div>
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

  // NOTE: 当前登录用户 WCA ID（从 localStorage 获取）
  const currentWcaId = localStorage.getItem('wca_wcaId') || '';

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
    if (!confirm(t('确定删除评论？', 'Delete this comment?'))) return;
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
        💬 {t('评论', 'Comments')} ({comments.length})
      </div>
      <div className="detail-comments">
        {comments.map(comment => (
          <div key={comment.id} className="detail-comment">
            <div className="detail-comment-header">
              <strong>{comment.authorName}</strong>
              <span className="detail-comment-time">
                {new Date(comment.createdAt * 1000).toLocaleDateString()}
                {comment.updatedAt && ` (${t('已编辑', 'edited')})`}
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
                    {t('保存', 'Save')}
                  </button>
                  <button className="recon-btn-sm" onClick={() => setEditingId(null)}>
                    {t('取消', 'Cancel')}
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
                      {t('编辑', 'Edit')}
                    </button>
                    <button className="recon-btn-sm recon-btn-danger-sm" onClick={() => handleDelete(comment.id)}>
                      {t('删除', 'Delete')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* NOTE: 添加评论——需登录后显示 */}
      {currentWcaId && (
        <div className="detail-comment-add">
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder={t('写评论...', 'Write a comment...')}
            rows={2}
          />
          <button
            className="recon-btn"
            onClick={handleAdd}
            disabled={submitting || !newComment.trim()}
          >
            {submitting ? t('提交中...', 'Posting...') : t('发送', 'Post')}
          </button>
        </div>
      )}
    </div>
  );
}

/** Twisty 播放器区域——动态导入 cubing 库 */
function TwistySection({
  puzzle, scramble, alg,
}: {
  puzzle: string;
  scramble: string;
  alg: string;
}) {
  const [visible, setVisible] = useState(false);
  const [cubingLoaded, setCubingLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // NOTE: 点击后动态导入 cubing 库并创建 twisty-player
  const handleToggle = useCallback(async () => {
    const next = !visible;
    setVisible(next);
    if (next && !cubingLoaded) {
      try {
        // NOTE: 动态导入 cubing 库——首次约 1MB
        await import('cubing/twisty');
        setCubingLoaded(true);
      } catch (err) {
        console.warn('Failed to load cubing library:', err);
      }
    }
  }, [visible, cubingLoaded]);

  // NOTE: cubing 库加载后，手动创建 twisty-player 元素
  useEffect(() => {
    if (!visible || !cubingLoaded || !containerRef.current) return;
    const container = containerRef.current;
    // NOTE: 清空旧的 player
    container.innerHTML = '';
    const player = document.createElement('twisty-player');
    player.setAttribute('puzzle', puzzle);
    player.setAttribute('experimental-setup-alg', scramble);
    player.setAttribute('alg', alg);
    player.style.width = '100%';
    player.style.maxWidth = '400px';
    player.style.margin = '12px 0';
    // NOTE: 深色背景适配
    player.setAttribute('background', 'none');
    player.setAttribute('control-panel', 'bottom');
    container.appendChild(player);
  }, [visible, cubingLoaded, puzzle, scramble, alg]);

  return (
    <div className="detail-section">
      <button className="recon-btn" onClick={handleToggle}>
        {visible ? t('隐藏动画', 'Hide Animation') : t('查看动画', 'View Animation')}
      </button>
      {visible && <div ref={containerRef} className="detail-twisty-container" />}
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
