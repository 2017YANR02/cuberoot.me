'use client';
import { useCallback, useEffect } from 'react';
import LandingSearch, { type LandingSearchCard } from '@/components/LandingSearch';
import { assistantConversations, type AssistantConversation, type AssistantConversationSnapshot } from '@/lib/assistant-conversations';

export default function AssistantConversationView({ owner, conversation, active, lang, cards }: {
  owner: string; conversation: AssistantConversation; active: boolean; lang: 'zh' | 'en'; cards: LandingSearchCard[];
}) {
  const onChange = useCallback((snapshot: Partial<AssistantConversationSnapshot>) => {
    assistantConversations.patch(owner, conversation.id, snapshot);
  }, [owner, conversation.id]);
  useEffect(() => {
    if (!active || !conversation.unreadReply) return;
    const markRead = () => {
      if (!document.hidden) assistantConversations.markReplyRead(owner, conversation.id);
    };
    markRead();
    document.addEventListener('visibilitychange', markRead);
    return () => document.removeEventListener('visibilitychange', markRead);
  }, [active, owner, conversation.id, conversation.unreadReply]);
  return <div className="deskpet-conversation" hidden={!active}>
    <LandingSearch cards={cards} lang={lang} conversation={{ initial: conversation.snapshot, active, onChange, owner, id: conversation.id, pending: conversation.pending }} />
  </div>;
}
