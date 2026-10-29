import { describe, expect, it, vi } from 'vitest';
import { createAssistantConversations } from '@/lib/assistant-conversations';

describe('assistant workspace conversations', () => {
  it('tracks completed replies independently across chats and accounts without treating snapshots as completion', () => {
    const store = createAssistantConversations();
    store.create('alice', 'a');
    store.create('alice', 'b');
    store.create('bob', 'a');
    store.patch('alice', 'a', { turns: [{ question: 'first', partial: true, result: { answer: 'streaming', sources: [] } }] });
    expect(store.read('alice').conversations[0].unreadReply).toBeUndefined();
    store.replyCompleted('alice', 'a');
    store.replyCompleted('alice', 'b');
    expect(store.read('alice').conversations.map(chat => chat.unreadReply)).toEqual([true, true]);
    expect(store.read('alice').activeId).toBe('b');
    expect(store.read('bob').conversations[0].unreadReply).toBeUndefined();
    store.select('alice', 'a');
    // Selection alone is insufficient: the page could be hidden or covered on mobile.
    expect(store.read('alice').conversations[0].unreadReply).toBe(true);
    store.markReplyRead('alice', 'a');
    expect(store.read('alice').conversations.map(chat => chat.unreadReply)).toEqual([false, true]);
    let changes = 0;
    store.subscribe(() => { changes++; });
    store.markReplyRead('alice', 'a');
    store.replyCompleted('alice', 'b');
    store.replyCompleted('alice', 'missing');
    expect(changes).toBe(0);
    store.replyCompleted('alice', 'a');
    expect(changes).toBe(1);
    expect(store.read('alice').conversations[0].unreadReply).toBe(true);
  });

  it('restores pinned chats for the same account without persisting image bytes', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
    try {
      const store = createAssistantConversations();
      store.restorePinned('alice');
      store.create('alice', 'a');
      store.patch('alice', 'a', { turns: [{ question: 'picture', images: [{ data: 'secret-image', mediaType: 'image/png' }] }] });
      store.rename('alice', 'a', '  Photo notes  ');
      store.setPinned('alice', 'a', true);
      expect([...data.values()].join('')).not.toContain('secret-image');
      const reopened = createAssistantConversations();
      reopened.restorePinned('bob');
      reopened.restorePinned('alice');
      expect(reopened.read('bob').conversations).toEqual([]);
      expect(reopened.read('alice').conversations[0]).toMatchObject({ id: 'a', title: 'Photo notes', pinned: true, snapshot: { turns: [{ question: 'picture', imagesExpired: true }] } });
      reopened.setPinned('alice', 'a', false);
      const again = createAssistantConversations();
      again.restorePinned('alice');
      expect(again.read('alice').conversations).toEqual([]);
    } finally { vi.unstubAllGlobals(); }
  });
  it('branches through the selected answer without changing or aliasing the original', () => {
    const store = createAssistantConversations();
    store.create('alice', 'original');
    const turns = [{ question: 'first', result: { answer: 'answer', sources: [] } }, { question: 'later' }];
    store.patch('alice', 'original', { turns, conversationId: 'old-request' });
    store.branch('alice', 'branch', turns.slice(0, 1));
    const branch = store.read('alice').conversations[1];
    expect(branch.snapshot.turns).toEqual([turns[0]]);
    expect(branch.snapshot.conversationId).toBeNull();
    branch.snapshot.turns[0].question = 'changed';
    expect(turns[0].question).toBe('first');
    expect(store.read('alice').activeId).toBe('branch');
    expect(store.read('bob').conversations).toEqual([]);
  });
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

  it('hands a submission to one consumer without overwriting a newer draft or attachments', () => {
    const store = createAssistantConversations();
    store.create('alice', 'a');
    const images = [{ data: 'test', mediaType: 'image/png' as const }];
    store.patch('alice', 'a', { draft: 'translate WIC', images });
    expect(store.submit('alice', 'a', 'translate WIC', images)).toBe(true);
    expect(store.submit('alice', 'a', 'duplicate', [])).toBe(false);
    expect(store.read('alice').open).toBe(true);
    expect(store.read('alice').conversations[0].snapshot.draft).toBe('');
    const submitted = store.takeSubmission('alice', 'a');
    expect(submitted).toEqual({ question: 'translate WIC', images });
    expect(store.takeSubmission('alice', 'a')).toBeNull();
    store.patch('alice', 'a', { draft: 'next question', images });
    store.setOpen('alice', false);
    store.patch('alice', 'a', { turns: [{ question: 'translate WIC', result: { answer: '廉政委员会', sources: [] } }] });
    expect(store.read('alice').conversations[0].snapshot).toMatchObject({ draft: 'next question', images });
    expect(store.read('alice').opened).toBe(true);
    expect(store.read('bob').open).toBe(false);
    expect(store.read('bob').conversations).toEqual([]);
  });
});
