'use client';

import { useEffect, useRef, useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';
import { setCommentVote, type listComments } from '@/lib/recon-api';
import { useT } from '@/hooks/useT';

export function ReconCommentVotes({ comment }: { comment: Awaited<ReturnType<typeof listComments>>[number] }) {
  const t = useT();
  const user = useAuthUser();
  const [value, setValue] = useState({ likeCount: comment.likeCount ?? 0, myVote: comment.myVote ?? null });
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [burst, setBurst] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    setValue({ likeCount: comment.likeCount ?? 0, myVote: comment.myVote ?? null });
  }, [comment.likeCount, comment.myVote]);

  async function vote(kind: 'like' | 'dislike') {
    if (!user) { useAuthStore.getState().login(); return; }
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    const next = value.myVote === kind ? null : kind;
    try {
      const result = await setCommentVote(comment.id, next);
      setValue({ likeCount: result.likeCount ?? 0, myVote: result.myVote ?? null });
      setBurst(next === 'like' && result.myVote === 'like');
    } catch {
      setError(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <>
    <button type="button" className="recon-comment-vote" aria-label={t('点赞', 'Like')}
      aria-pressed={value.myVote === 'like'} disabled={busy} onClick={() => void vote('like')}>
      <span className={`recon-comment-vote-icon${burst ? ' is-bursting' : ''}`}
        onAnimationEnd={() => setBurst(false)}>
        <ThumbsUp size={18} fill={value.myVote === 'like' ? 'currentColor' : 'none'} />
        {burst && <span className="recon-comment-vote-burst" aria-hidden="true" />}
      </span>
      {value.likeCount > 0 && <span>{value.likeCount}</span>}
    </button>
    <button type="button" className="recon-comment-vote" aria-label={t('点踩', 'Dislike')}
      aria-pressed={value.myVote === 'dislike'} disabled={busy} onClick={() => void vote('dislike')}>
      <ThumbsDown size={18} fill={value.myVote === 'dislike' ? 'currentColor' : 'none'} />
    </button>
    {error && <span role="alert" className="recon-comment-vote-error">{t('操作失败，请重试', 'Could not save. Please retry.')}</span>}
  </>;
}
