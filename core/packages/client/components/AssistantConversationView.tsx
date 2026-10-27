'use client';
import { useCallback } from 'react';
import LandingSearch, { type LandingSearchCard } from '@/components/LandingSearch';
import { assistantConversations, type AssistantConversation, type AssistantConversationSnapshot } from '@/lib/assistant-conversations';

export default function AssistantConversationView({ owner, conversation, active, lang, cards }: {
  owner: string; conversation: AssistantConversation; active: boolean; lang: 'zh' | 'en'; cards: LandingSearchCard[];
}) {
  const onChange = useCallback((snapshot: Partial<AssistantConversationSnapshot>) => {
    assistantConversations.patch(owner, conversation.id, snapshot);
  }, [owner, conversation.id]);
  return <div className="deskpet-conversation" hidden={!active}>
    <LandingSearch cards={cards} lang={lang} conversation={{ initial: conversation.snapshot, active, onChange, owner, id: conversation.id, pending: conversation.pending }} />
  </div>;
}
