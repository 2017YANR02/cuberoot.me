/**
 * 复盘详情页——迁移自 recon/detail/recon_detail.js（1586 行）
 * NOTE: 展示单条复盘的完整信息，含 twisty 动画、视频、统计、评论
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { ReconSolve, ReconComment, EditHistoryItem } from '@cuberoot/shared';
import { getRecon, listComments, getEditHistory, deleteRecon } from '../../utils/recon_api';
import {
  formatTime, countryFlag, getEventDisplayName, getRoundDisplay,
  isBldEvent, getPuzzleId, t, wcaCompUrl, wcaPersonUrl,
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

      {/* 主体 */}
      <div className="detail-body">
        {/* 左列：打乱 + 解法 + twisty */}
        <div className="detail-left">
          {/* 打乱 */}
          {scramble && (
            <div className="detail-section">
              <div className="detail-section-label">
                {t('打乱', 'Scramble')}
              </div>
              <div className="detail-scramble-text">{scramble}</div>
            </div>
          )}

          {/* 解法 */}
          <div className="detail-section">
            <div className="detail-section-label">
              {t('解法', 'Solution')}
            </div>
            <SolutionView text={solutionText} />
          </div>

          {/* Twisty Player */}
          {scramble && solutionText && (
            <TwistySection
              puzzle={getPuzzleId(solve.event)}
              scramble={scramble}
              alg={cleanForPlayer(solutionText)}
            />
          )}

          {/* 盲拧附加信息 */}
          {isBldEvent(solve.event) && (solve.execTime || solve.memoTime) && (
            <div className="detail-bld-times">
              {solve.memoTime != null && (
                <span>🧠 Memo: {formatTime(solve.memoTime)}</span>
              )}
              {solve.execTime != null && (
                <span>⚡ Exec: {formatTime(solve.execTime)}</span>
              )}
            </div>
          )}
        </div>

        {/* 右列：统计 + 视频 + 评论 */}
        <div className="detail-right">
          {/* 统计网格 */}
          <StatsGrid solve={solve} />

          {/* 视频 */}
          {solve.videoUrl && <VideoSection videoUrl={solve.videoUrl} />}

          {/* 备注 */}
          {solve.note && (
            <div className="detail-section">
              <div className="detail-section-label">{t('备注', 'Note')}</div>
              <div className="detail-note">{solve.note}</div>
            </div>
          )}

          {/* 评论 */}
          <CommentsView
            comments={comments}
            reconId={solve.id}
            onUpdate={loadData}
          />
        </div>
      </div>

      {/* 底部元信息 */}
      <div className="detail-footer">
        {solve.addedBy && (
          <span className="detail-footer-item">
            {t('添加者', 'Added by')}: {solve.addedBy}
          </span>
        )}
        {solve.reconer && (
          <span className="detail-footer-item">
            {t('复盘者', 'Reconstructor')}: {solve.reconer}
          </span>
        )}
        {solve.cube && (
          <span className="detail-footer-item">
            🧊 {solve.cube}
          </span>
        )}
        {solve.createdAt && (
          <span className="detail-footer-item">
            {new Date(solve.createdAt * 1000).toLocaleDateString()}
          </span>
        )}
        {history.length > 0 && (
          <span className="detail-footer-item">
            ✏️ {history.length} {t('次编辑', 'edits')}
          </span>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="detail-actions">
        <Link to={`/recon/submit/${solve.id}`} className="recon-btn">
          ✏️ {t('编辑', 'Edit')}
        </Link>
        <button className="recon-btn detail-delete-btn" onClick={handleDelete}>
          🗑 {t('删除', 'Delete')}
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

/** 统计网格 */
function StatsGrid({ solve }: { solve: ReconSolve }) {
  const items: [string, string | number | undefined][] = [
    ['STM', solve.stm],
    ['TPS', solve.tps],
    ['Cross', solve.crossStm != null ? `${solve.crossStm} STM` : undefined],
    ['F2L', solve.f2l != null ? `${solve.f2l} STM` : undefined],
    ['LL', solve.ll != null ? `${solve.ll} STM` : undefined],
    ['OLL', solve.oll || solve.ollShort],
    ['PLL', solve.pll || solve.pllShort],
    ['Cross Color', solve.crossColor],
    ['Free Pair', solve.freePair],
    ['Y Rot', solve.yRot],
    ['Regrip', solve.regrip],
    ['Lockup', solve.lockup],
    ['S Move', solve.sMove],
  ];

  // NOTE: 过滤掉空值
  const validItems = items.filter(([, v]) => v != null && v !== '' && v !== 0);
  if (validItems.length === 0) return null;

  return (
    <div className="detail-section">
      <div className="detail-section-label">{t('统计', 'Statistics')}</div>
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

  // NOTE: Bilibili
  const bvMatch = url.match(/(BV[A-Za-z0-9]+)/);
  if (bvMatch) {
    const bvId = bvMatch[1];
    if (!loaded) {
      return (
        <div className="detail-video-wrap detail-video-facade" onClick={() => setLoaded(true)}>
          <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
            ▶️ Bilibili
          </div>
        </div>
      );
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

/** 评论区 */
function CommentsView({
  comments, reconId: _reconId, onUpdate: _onUpdate,
}: {
  comments: ReconComment[];
  reconId: number;
  onUpdate: () => void;
}) {
  if (comments.length === 0) return null;

  return (
    <div className="detail-section">
      <div className="detail-section-label">
        {t('评论', 'Comments')} ({comments.length})
      </div>
      <div className="detail-comments">
        {comments.map(comment => (
          <div key={comment.id} className="detail-comment">
            <div className="detail-comment-header">
              <strong>{comment.authorName}</strong>
              <span className="detail-comment-time">
                {new Date(comment.createdAt * 1000).toLocaleDateString()}
              </span>
            </div>
            <div className="detail-comment-body">{comment.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Twisty 播放器区域 */
function TwistySection({
  puzzle, scramble, alg,
}: {
  puzzle: string;
  scramble: string;
  alg: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="detail-section">
      <button className="recon-btn" onClick={() => setVisible(!visible)}>
        {visible ? t('隐藏动画', 'Hide Animation') : t('查看动画', 'View Animation')}
      </button>
      {visible && (
        <div className="detail-twisty-container">
          {/* NOTE: twisty-player Web Component 需要动态导入 cubing.js */}
          <twisty-player
            puzzle={puzzle}
            experimental-setup-alg={scramble}
            alg={alg}
            style={{ width: '100%', maxWidth: '400px', margin: '12px 0' }}
          />
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
