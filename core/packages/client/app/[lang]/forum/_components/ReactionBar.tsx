'use client';

// Per-post reactions: existing kinds as toggle chips + a picker for the rest.
// One reaction per user per post (clicking your current kind removes it).

import { useEffect, useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';
import {
  REACTION_KINDS, REACTION_EMOJI,
  type PostReaction, type ReactionKind,
} from '@/lib/forum-api';

export function ReactionBar({
  reactions, myKind, onReact,
}: {
  reactions: PostReaction[];
  myKind: ReactionKind | null;
  onReact: (kind: ReactionKind | null) => Promise<void>;
}) {
  const user = useAuthUser();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pickerOpen) return;
    const close = () => setPickerOpen(false);
    const t = setTimeout(() => document.addEventListener('click', close), 0);
    return () => { clearTimeout(t); document.removeEventListener('click', close); };
  }, [pickerOpen]);

  const react = async (kind: ReactionKind | null) => {
    if (!user) { useAuthStore.getState().login(); return; }
    if (busy) return;
    setBusy(true);
    try {
      await onReact(kind);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
      setPickerOpen(false);
    }
  };

  const shown = reactions.filter(r => r.count > 0);

  return (
    <div className="forum-reactions">
      {shown.map(r => (
        <button
          key={r.kind}
          type="button"
          className={`forum-reaction-chip${myKind === r.kind ? ' is-mine' : ''}`}
          title={r.names.join(', ')}
          onClick={() => react(myKind === r.kind ? null : r.kind)}
          disabled={busy}
        >
          <span aria-hidden="true">{REACTION_EMOJI[r.kind]}</span> {r.count}
        </button>
      ))}
      <span className="forum-reaction-picker-wrap" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className="forum-reaction-add"
          aria-label={tr({ zh: '添加回应', en: 'Add reaction' })}
          title={tr({ zh: '回应', en: 'React' })}
          onClick={() => setPickerOpen(o => !o)}
          disabled={busy}
        >
          <SmilePlus size={15} aria-hidden="true" />
        </button>
        {pickerOpen && (
          <span className="forum-reaction-picker">
            {REACTION_KINDS.map(kind => (
              <button
                key={kind}
                type="button"
                className={`forum-reaction-option${myKind === kind ? ' is-mine' : ''}`}
                aria-label={kind}
                onClick={() => react(myKind === kind ? null : kind)}
                disabled={busy}
              >
                {REACTION_EMOJI[kind]}
              </button>
            ))}
          </span>
        )}
      </span>
    </div>
  );
}
