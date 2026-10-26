import { describe, expect, it } from 'vitest';
import { createAssistantConversations } from '@/lib/assistant-conversations';

describe('assistant workspace conversations', () => {
  it('keeps drafts, images and context independent while switching and receiving a background reply', () => {
    const store = createAssistantConversations();
    store.create('alice', 'a');
    const first = { ...store.read('alice').conversations[0].snapshot, draft: 'first draft', conversationId: 'request-a', turns: [{ question: 'first question' }] };
    store.update('alice', 'a', first);
    store.create('alice', 'b');
    const second = { ...store.read('alice').conversations[1].snapshot, draft: 'second draft', conversationId: 'request-b' };
    store.update('alice', 'b', second);
    store.update('alice', 'a', { ...first, turns: [{ question: 'first question', result: { answer: 'first reply', sources: [] } }] });
    expect(store.read('alice').activeId).toBe('b');
    expect(store.read('alice').conversations[1].snapshot).toBe(second);
    store.select('alice', 'a');
    expect(store.read('alice').activeId).toBe('a');
    expect(store.read('alice').conversations[0].snapshot.turns[0].result?.answer).toBe('first reply');
    expect(store.read('alice').conversations[0].snapshot.draft).toBe('first draft');
  });

  it('isolates accounts and preserves chats when a workspace unsubscribes and reopens', () => {
    const store = createAssistantConversations();
    const unsubscribe = store.subscribe(() => {});
    store.create('alice', 'a');
    const saved = store.read('alice');
    unsubscribe();
    store.create('bob', 'b');
    store.select('bob', 'a');
    expect(store.read('bob').activeId).toBe('b');
    expect(store.read('bob').conversations.map(item => item.id)).toEqual(['b']);
    expect(store.read('alice')).toBe(saved);
    expect(store.serverSnapshot().conversations).toEqual([]);
  });

  it('does not notify recursively for an unchanged component snapshot', () => {
    const store = createAssistantConversations();
    store.create('alice', 'a');
    let notifications = 0;
    store.subscribe(() => { notifications++; });
    store.update('alice', 'a', { ...store.read('alice').conversations[0].snapshot });
    expect(notifications).toBe(0);
  });
});
