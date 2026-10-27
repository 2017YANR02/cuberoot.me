'use client';
import { useCallback, useSyncExternalStore } from 'react';
import { assistantConversations } from '@/lib/assistant-conversations';

export function ensureAssistantConversation(owner: string) {
  const current = assistantConversations.read(owner);
  if (!current.activeId) assistantConversations.create(owner, crypto.randomUUID());
  const state = assistantConversations.read(owner);
  return state.conversations.find(chat => chat.id === state.activeId)!;
}

export function useAssistantWorkspace(owner: string) {
  const read = useCallback(() => assistantConversations.read(owner), [owner]);
  return useSyncExternalStore(assistantConversations.subscribe, read, assistantConversations.serverSnapshot);
}
