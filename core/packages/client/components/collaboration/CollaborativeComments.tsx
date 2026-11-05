'use client';

import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { UserContactLink } from '@/components/UserIdLabel';
import { T, tr, useLang } from '@/i18n/tr';
import { useAuthUser, useOwnerKey } from '@/lib/auth-store';
import { nextDocumentRecordId, sortByCreatedAt, type DocumentComment, type DocumentAnchor, type DocumentActivity } from '@/lib/document-collaboration';
import './collaborative-comments.css';

export function CollaborativeComments({ ydoc, canComment, quote = '', createAnchor, focus }: {
  ydoc: Y.Doc; canComment: boolean; quote?: string;
  createAnchor?: () => DocumentAnchor | null;
  focus?: (comment: DocumentComment) => void;
}) {
  const user = useAuthUser();
  const lang = useLang();
  const stamp = (value: number) => new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(value);
  const authorKey = useOwnerKey();
  const authorName = user?.name || tr({ zh: '访客', en: 'Guest' });
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const map = ydoc.getMap<DocumentComment>('documentComments');
  useEffect(() => {
    const refresh = () => setComments(sortByCreatedAt([...map.values()]).filter(item => !item.resolvedAt));
    refresh(); map.observe(refresh); return () => map.unobserve(refresh);
  }, [map]);
  const activity = (kind: DocumentActivity['kind'], summary: string) => ydoc.getArray<DocumentActivity>('documentActivity').push([
    { id: nextDocumentRecordId('activity'), kind, summary, authorKey, authorName, authorUserId: user?.uid, createdAt: Date.now() },
  ]);
  const add = () => {
    if (!canComment || !body.trim()) return;
    const id = nextDocumentRecordId('comment');
    ydoc.transact(() => {
      map.set(id, { id, body: body.trim(), authorKey, authorName, authorUserId: user?.uid, createdAt: Date.now(), resolvedAt: null, anchor: createAnchor?.() ?? null, replies: [] });
      activity('comment', tr({ zh: '添加了批注', en: 'Added a comment' }));
    });
    setBody('');
  };
  return <div className="collab-comments">
    {canComment && <div className="collab-comment-composer">{quote && <blockquote>{quote.slice(0, 160)}</blockquote>}<textarea className="collab-comment-input" aria-label={tr({ zh: '添加批注', en: 'Add a comment' })} value={body} onChange={event => setBody(event.target.value)} placeholder={tr({ zh: '添加批注', en: 'Add a comment' })} /><button className="collab-button" type="button" disabled={!body.trim()} onClick={add}><T zh="批注" en="Comment" /></button></div>}
    {!comments.length && <p className="collab-member-role"><T zh="没有未解决的批注" en="No unresolved comments" /></p>}
    {comments.map(comment => <article className="collab-comment" key={comment.id}>
      <UserContactLink userId={comment.authorUserId}><strong>{comment.authorName}</strong></UserContactLink><time>{stamp(comment.createdAt)}</time>
      {comment.anchor?.quote && <button className="collab-comment-quote" type="button" disabled={!focus} onClick={() => focus?.(comment)}>{comment.anchor.quote}</button>}
      <p>{comment.body}</p>
      {comment.replies.map(reply => <div className="collab-comment-reply" key={reply.id}><UserContactLink userId={reply.authorUserId}><strong>{reply.authorName}</strong></UserContactLink><time>{stamp(reply.createdAt)}</time><p>{reply.body}</p></div>)}
      {canComment && <div className="collab-comment-actions"><button className="collab-comment-action" type="button" onClick={() => setReplyTo(comment.id)}><T zh="回复" en="Reply" /></button><button className="collab-comment-action" type="button" onClick={() => { map.set(comment.id, { ...comment, resolvedAt: Date.now() }); activity('resolve', tr({ zh: '解决了批注', en: 'Resolved a comment' })); }}><T zh="解决" en="Resolve" /></button></div>}
      {canComment && replyTo === comment.id && <div className="collab-comment-composer"><textarea className="collab-comment-input" aria-label={tr({ zh: '回复批注', en: 'Reply to comment' })} value={replyBody} onChange={event => setReplyBody(event.target.value)} /><button className="collab-button" type="button" disabled={!replyBody.trim()} onClick={() => {
        const current = map.get(comment.id); if (!current || !replyBody.trim()) return;
        ydoc.transact(() => {
          map.set(comment.id, { ...current, replies: [...current.replies, { id: nextDocumentRecordId('reply'), body: replyBody.trim(), authorKey, authorName, authorUserId: user?.uid, createdAt: Date.now() }] });
          activity('reply', tr({ zh: '回复了批注', en: 'Replied to a comment' }));
        }); setReplyBody(''); setReplyTo('');
      }}><T zh="发送" en="Send" /></button></div>}
    </article>)}
  </div>;
}
