import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChatController, createChatClient, ChatError, mergeChatMessages,
  type ChatClient, type ChatMessage, type ChatMessagesPage } from '@cuberoot/shared/chat';
const id = '11111111-1111-4111-8111-111111111111';
const key = '22222222-2222-4222-8222-222222222222';
const peer = { userId: 2, name: 'Two', avatarUrl: null, avatarSource: 'auto' as const, avatarPreset: null, wcaId: null };
const message = (sequence: string, senderUserId = 2): ChatMessage => ({ conversationId: id, sequence, senderUserId,
  clientMessageId: key, body: 'hello', createdAt: '2026-09-27T00:00:00.000Z' });
const page = (items: ChatMessage[], patch: Partial<ChatMessagesPage> = {}): ChatMessagesPage => ({
  conversationId: id, peer, items, canSend: true, myReadSequence: '0', lastSequence: items.at(-1)?.sequence ?? '0',
  oldestSequence: items[0]?.sequence ?? null, nextAfterSequence: items.at(-1)?.sequence ?? '0', hasMore: false, ...patch,
});
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((yes) => { resolve = yes; }); return { promise, resolve }; }
const controllers: ReturnType<typeof createChatController>[] = [];
function setup() {
  const client = { conversations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }), messages: vi.fn().mockResolvedValue(page([message('1')])),
    send: vi.fn(), read: vi.fn().mockResolvedValue({ myReadSequence: '1', unreadCount: 0 }) } satisfies ChatClient;
  const unauthorized = vi.fn();
  const controller = createChatController({ client, userId: 1, uuid: () => key, onUnauthorized: unauthorized });
  controllers.push(controller); controller.selectPeer(2); controller.setActive(true);
  return { client, controller, unauthorized };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { controllers.splice(0).forEach((c) => c.dispose()); vi.useRealTimers(); });
describe('shared chat controller', () => {
  it('merges bigint sequences without lossy conversion or duplicate messages', () => {
    const result = mergeChatMessages([message('9007199254740993')], [message('9007199254740992'), message('9007199254740993')]);
    expect(result.map((m) => m.sequence)).toEqual(['9007199254740992', '9007199254740993']);
  });
  it('does not mark fetched messages read before the UI confirms visibility', async () => {
    const { client, controller } = setup(); await flush();
    expect(client.read).not.toHaveBeenCalled();
    controller.acknowledgeVisible(true); await flush();
    expect(client.read).toHaveBeenCalledWith(2, '1', expect.any(AbortSignal));
  });
  it('does not advance the receive cursor from an early send response', async () => {
    const { client, controller } = setup(); await flush();
    client.send.mockResolvedValue(message('3', 1));
    client.messages.mockResolvedValue(page([message('2'), message('3', 1)]));
    controller.setDraft('hello'); await controller.send(); await flush();
    expect(client.messages.mock.calls[1][1]).toEqual({ after: '1' });
    expect(controller.getSnapshot().messages.map((m) => m.sequence)).toEqual(['1', '2', '3']);
  });
  it('catches up every incremental page, never jumps straight to lastSequence', async () => {
    const { client, controller } = setup(); await flush();
    client.messages.mockResolvedValueOnce(page([message('2')], { hasMore: true, lastSequence: '3' }))
      .mockResolvedValueOnce(page([message('3')]));
    await vi.advanceTimersByTimeAsync(3000);
    expect(client.messages.mock.calls.slice(1).map((call) => call[1])).toEqual([{ after: '1' }, { after: '2' }]);
    expect(controller.getSnapshot().messages).toHaveLength(3);
  });
  it('retains the same key and body on a manual retry after an ambiguous failure', async () => {
    const { client, controller } = setup(); await flush();
    client.send.mockRejectedValueOnce(new ChatError('NETWORK_ERROR')).mockResolvedValueOnce(message('2', 1));
    controller.setDraft('hello'); await controller.send();
    expect(controller.getSnapshot().pending[0].status).toBe('failed');
    await controller.send(key);
    expect(client.send.mock.calls[0][1]).toEqual(client.send.mock.calls[1][1]);
    expect(controller.getSnapshot().pending).toHaveLength(0);
  });
  it('ignores a late peer response after selecting another peer', async () => {
    const { client, controller } = setup(); await flush();
    const late = deferred<ChatMessagesPage>();
    client.messages.mockReturnValueOnce(late.promise).mockResolvedValueOnce(page([], { peer: { ...peer, userId: 3 } }));
    controller.refresh(); controller.selectPeer(3); await flush();
    late.resolve(page([message('9')])); await flush();
    expect(controller.getSnapshot().peerId).toBe(3);
    expect(controller.getSnapshot().messages).toEqual([]);
  });
  it('pauses hidden/offline surfaces and resumes from the last receive cursor', async () => {
    const { client, controller } = setup(); await flush();
    controller.setActive(false); await vi.advanceTimersByTimeAsync(60_000);
    expect(client.messages).toHaveBeenCalledTimes(1);
    controller.setActive(true); await flush();
    expect(client.messages.mock.calls[1][1]).toEqual({ after: '1' });
  });
  it('retains an explicit truncated-tail gap until latest is reloaded, without marking unseen messages read', async () => {
    const { client, controller } = setup(); await flush();
    controller.acknowledgeVisible(false);
    client.messages.mockResolvedValueOnce(page(Array.from({ length: 499 }, (_, i) => message(String(i + 2)))))
      .mockResolvedValueOnce(page([message('501')])).mockResolvedValueOnce(page([message('502')]));
    controller.refresh(); await flush(); controller.refresh(); await flush();
    expect(controller.getSnapshot().hasNewerGap).toBe(true);
    controller.acknowledgeVisible(true); await flush(); controller.refresh(); await flush();
    controller.acknowledgeVisible(true); await flush();
    expect(controller.getSnapshot().messages.at(-1)?.sequence).toBe('500');
    expect(client.read.mock.calls.every((call) => BigInt(call[1]) <= 500n)).toBe(true);
    client.messages.mockResolvedValueOnce(page([message('500'),message('501'),message('502')]));
    controller.latest(); await flush();
    expect(controller.getSnapshot().hasNewerGap).toBe(false);
    expect(controller.getSnapshot().messages.map((m) => m.sequence)).toEqual(['500','501','502']);
  });
  it('makes an interrupted pending send retryable when reloading latest', async () => {
    const { client, controller } = setup(); await flush();
    client.send.mockImplementation((_peer, _input, signal) => new Promise((_yes, no) => signal?.addEventListener('abort', () => no(new ChatError('NETWORK_ERROR')))));
    controller.setDraft('hello'); void controller.send(); await flush(); controller.latest(); await flush();
    expect(controller.getSnapshot().pending[0].status).toBe('failed');
  });
  it('retains expanded conversations and their tail cursor across a first-page refresh', async () => {
    const { client, controller } = setup(); await flush();
    const conversation = (id: string, peerId: number) => ({ id, peer: { ...peer, userId: peerId },
      lastMessage: message('1'), lastSequence: '1', myReadSequence: '0', unreadCount: 1, canSend: true });
    client.conversations.mockResolvedValueOnce({ items: [conversation('first', 2)], nextCursor: 'page-two' });
    controller.refresh(); await flush();
    client.conversations.mockResolvedValueOnce({ items: [conversation('second', 3)], nextCursor: 'page-three' });
    await controller.loadMoreConversations();
    client.conversations.mockResolvedValueOnce({ items: [{ ...conversation('first', 2), unreadCount: 0 }], nextCursor: 'page-two' });
    controller.refresh(); await flush();
    expect(controller.getSnapshot().conversations.map((c) => c.id).sort()).toEqual(['first', 'second']);
    expect(controller.getSnapshot().conversations.find((c) => c.id === 'first')?.unreadCount).toBe(0);
    expect(controller.getSnapshot().nextCursor).toBe('page-three');
  });
  it('stops on 401 and never acts on a disposed account', async () => {
    const { client, controller, unauthorized } = setup(); await flush();
    client.messages.mockRejectedValueOnce(new ChatError('UNAUTHENTICATED'));
    controller.refresh(); await flush();
    expect(unauthorized).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000); expect(client.messages).toHaveBeenCalledTimes(2);
    controller.selectPeer(3);
    expect(controller.getSnapshot()).toMatchObject({ error: 'UNAUTHENTICATED', loading: false });
    controller.dispose(); controller.setDraft('private'); expect(controller.getSnapshot().draft).toBe('');
  });
  it('honors retry-after and does not overlap slow polling requests', async () => {
    const { client, controller } = setup(); await flush();
    client.messages.mockRejectedValueOnce(new ChatError('RATE_LIMITED', 20_000));
    controller.refresh(); await flush();
    await vi.advanceTimersByTimeAsync(19_000); expect(client.messages).toHaveBeenCalledTimes(2);
    const slow = deferred<ChatMessagesPage>(); client.messages.mockReturnValueOnce(slow.promise);
    await vi.advanceTimersByTimeAsync(1_000); await vi.advanceTimersByTimeAsync(9_000);
    expect(client.messages).toHaveBeenCalledTimes(3);
    slow.resolve(page([],{ nextAfterSequence: '1' })); await flush();
  });
});
describe('shared chat HTTP client', () => {
  it('rejects malformed successes and forwards errors without leaking response text', async () => {
    const transport = { fetch: vi.fn().mockResolvedValue(new Response('<html>failure</html>', { status: 200 })), url: (p: string) => p, headers: () => ({ Authorization: 'Bearer fixture' }) };
    const client = createChatClient(transport);
    await expect(client.messages(2)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    transport.fetch.mockResolvedValue(new Response('{"error":{"code":"RATE_LIMITED"}}', { status: 429, headers: { 'Retry-After': '7' } }));
    await expect(client.messages(2)).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterMs: 7000 });
    expect(transport.fetch.mock.calls[0][1]).toMatchObject({ cache: 'no-store', headers: { Authorization: 'Bearer fixture' } });
  });
});
