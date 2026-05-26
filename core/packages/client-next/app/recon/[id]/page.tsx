'use client';

/**
 * /recon/[id] — detail page.
 *
 * Functional port with TwistySection + comments list. Comments allow adding new ones (auth-gated).
 *
 * DEFERRED from full Vite version:
 *   - SolutionView with caret-driven move sync (complex; player still animates from textarea above)
 *   - Same-round nav / same-comp-event nav (WCA results API + recon_attempt_lookup)
 *   - Normalized-cross block (hasWideMoveInCrossSection)
 *   - Pin / reply tree for discussion
 *   - Alternative solution editor (separate /alt route works)
 *   - Edit / delete (auth-gated; only owner / admin)
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, TriangleAlert, LogIn, MessageSquare, Send } from 'lucide-react';
import type { ReconSolve, ReconComment } from '@cuberoot/shared';
import { getRecon, listComments, addComment } from '@/lib/recon-api';
import {
  formatTime, formatAvg, formatAoXR, formatRound, wcaPersonUrl, getPuzzleId,
} from '@/lib/recon-utils';
import { cleanForPlayer } from '@/lib/recon-alg-utils';
import { displayCuberName } from '@/lib/cuber-name-display';
import { useAuthStore } from '@/lib/auth-store';
import LangToggle from '@/components/LangToggle';
import TwistySection from '@/components/TwistySection';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../recon.css';

export default function ReconDetailPage() {
  const params = useParams<{ id: string }>();
  const id = (Array.isArray(params?.id) ? params.id[0] : params?.id) ?? '';
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const authUser = useAuthStore(s => s.user);
  const login = useAuthStore(s => s.login);

  const [solve, setSolve] = useState<ReconSolve | null>(null);
  const [comments, setComments] = useState<ReconComment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [posting, setPosting] = useState(false);

  useDocumentTitle(
    solve ? `${displayCuberName(solve.person || '', isZh)} ${solve.value || formatTime(solve.rawTime)}` : '复盘',
    solve ? `${displayCuberName(solve.person || '', isZh)} ${solve.value || formatTime(solve.rawTime)}` : 'Reconstruction',
  );

  useEffect(() => {
    if (!id) return;
    getRecon(Number(id))
      .then(s => { setSolve(s); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
    listComments(Number(id))
      .then(setComments)
      .catch(() => { /* degraded */ });
  }, [id]);

  const reloadComments = async () => {
    if (!id) return;
    try { setComments(await listComments(Number(id))); } catch { /* ignore */ }
  };

  const handlePostComment = async () => {
    const c = commentDraft.trim();
    if (!c || !id) return;
    setPosting(true);
    try {
      await addComment(Number(id), c, null);
      setCommentDraft('');
      await reloadComments();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPosting(false);
    }
  };

  if (loading) return <div className="recon-page"><div className="recon-loading">{t('common.loading')}</div></div>;
  if (error || !solve) {
    return (
      <div className="recon-page">
        <div className="recon-error"><TriangleAlert size={16} /> {error || t('recon.notFound')}</div>
        <Link href="/recon" className="recon-btn"><ArrowLeft size={14} /> Back</Link>
      </div>
    );
  }

  const scramble = solve.optimalScramble || solve.wcaScramble || '';
  const cleanedSolution = cleanForPlayer(solve.solution || '');
  const puzzle = getPuzzleId(solve.event);

  return (
    <div className="recon-page">
      <div className="recon-page-header">
        <div>
          <Link href="/recon" className="recon-back-link">
            <ArrowLeft size={14} /> {isZh ? '返回列表' : 'Back to list'}
          </Link>
          <h1>
            {solve.value || formatTime(solve.rawTime)} {solve.event}
          </h1>
          <p className="recon-subtitle">
            {solve.personId ? (
              <a href={wcaPersonUrl(solve.personId)} target="_blank" rel="noopener noreferrer">
                {displayCuberName(solve.person || '', isZh)}
              </a>
            ) : displayCuberName(solve.person || '', isZh)}
            {solve.comp && ` · ${solve.comp}`}
            {solve.date && ` · ${solve.date.slice(0, 10)}`}
            {solve.round && ` · ${formatRound(solve.round, solve.solveNum)}`}
          </p>
        </div>
        <LangToggle />
      </div>

      <div className="recon-detail-body" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(0, 1.4fr)', gap: 24, padding: '0 16px' }}>
        <div className="recon-player-pane">
          {scramble && solve.event && solve.event !== 'sq1' && (
            <TwistySection
              puzzle={puzzle}
              scramble={scramble}
              alg={cleanedSolution}
              fillPane
            />
          )}
        </div>

        <div className="recon-detail-info">
          {solve.wcaScramble && (
            <section style={{ marginBottom: 16 }}>
              <h3>{t('recon.scramble')}</h3>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                {solve.wcaScramble}
              </pre>
            </section>
          )}

          {solve.optimalScramble && solve.optimalScramble !== solve.wcaScramble && (
            <section style={{ marginBottom: 16 }}>
              <h3>{isZh ? '最优打乱' : 'Optimal scramble'}</h3>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                {solve.optimalScramble}
              </pre>
            </section>
          )}

          {solve.solution && (
            <section style={{ marginBottom: 16 }}>
              <h3>{t('recon.solution')}</h3>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                {solve.solution}
              </pre>
            </section>
          )}

          {solve.note && (
            <section style={{ marginBottom: 16 }}>
              <h3>{t('recon.note')}</h3>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{solve.note}</pre>
            </section>
          )}

          {(solve.average || solve.aoType || solve.stm || solve.tps) && (
            <section style={{ marginBottom: 16 }}>
              <h3>{t('recon.statistics')}</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {solve.average != null && <li>{t('recon.average')}: {formatAvg(solve.average)}</li>}
                {solve.aoType && <li>AoXR: {formatAoXR(solve.aoType)}</li>}
                {solve.stm && <li>STM: {solve.stm}</li>}
                {typeof solve.tps === 'number' && <li>TPS: {solve.tps.toFixed(2)}</li>}
                {solve.method && <li>{t('recon.method')}: {solve.method}</li>}
              </ul>
            </section>
          )}

          {solve.videoUrl && (
            <section style={{ marginBottom: 16 }}>
              <h3>{t('recon.video')}</h3>
              <a href={solve.videoUrl} target="_blank" rel="noopener noreferrer">{solve.videoUrl}</a>
            </section>
          )}

          {solve.alternatives && solve.alternatives.length > 0 && (
            <section style={{ marginBottom: 16 }}>
              <h3>{isZh ? '另解' : 'Alternatives'}</h3>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {solve.alternatives.map((alt, i) => (
                  <li key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>
                      <Link href={`/recon/${id}/alt/${i}`}>{displayCuberName(alt.addedBy || '', isZh)}</Link>
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem', margin: 0 }}>{alt.solution}</pre>
                  </li>
                ))}
              </ul>
              {authUser && (
                <p style={{ marginTop: 8 }}>
                  <Link href={`/recon/${id}/alt/new`} className="recon-btn">
                    {isZh ? '提交另解' : 'Submit alternative'}
                  </Link>
                </p>
              )}
            </section>
          )}

          <section style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={16} /> {isZh ? '评论' : 'Comments'} {comments && `(${comments.length})`}
            </h3>
            {comments == null ? (
              <p style={{ color: 'var(--muted-foreground)' }}>{isZh ? '加载中…' : 'Loading…'}</p>
            ) : comments.length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)' }}>{isZh ? '暂无评论' : 'No comments yet'}</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {comments.map(c => (
                  <li key={c.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>
                      {displayCuberName(c.authorName || '', isZh)}
                      {c.createdAt && ` · ${new Date(c.createdAt).toISOString().slice(0, 10)}`}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{c.content}</div>
                  </li>
                ))}
              </ul>
            )}

            {authUser ? (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  value={commentDraft}
                  onChange={e => setCommentDraft(e.target.value)}
                  placeholder={isZh ? '添加评论…' : 'Add a comment…'}
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
                <div>
                  <button type="button" className="recon-btn" onClick={handlePostComment} disabled={posting || !commentDraft.trim()}>
                    <Send size={14} /> {posting ? (isZh ? '发送中…' : 'Posting…') : (isZh ? '发送' : 'Post')}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 16 }}>
                <button type="button" className="recon-btn" onClick={() => login()}>
                  <LogIn size={14} /> {isZh ? '登录评论' : 'Sign in to comment'}
                </button>
              </div>
            )}
          </section>

          <p style={{ marginTop: 24, fontSize: 12, color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
            {isZh
              ? '注:同轮成绩导航、Normalized-Cross 块、Stats 全项、回复树、编辑/置顶/删除 尚未在 Next.js 版本实现。'
              : 'Note: same-round nav, normalized-cross block, full stats panel, reply tree, edit/pin/delete are not yet ported.'}
          </p>
        </div>
      </div>
    </div>
  );
}
