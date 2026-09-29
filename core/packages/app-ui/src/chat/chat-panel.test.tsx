// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatError, type ChatClient, type ChatMessagesPage } from '@cuberoot/shared/chat';
import { ChatPanel, type ChatPanelProps } from './ChatPanel';

const peer = { userId: 2, name: 'Two', avatarUrl: null, avatarSource: 'auto' as const, avatarPreset: null, wcaId: null };
const body = '<img src=x onerror=alert(1)>\n你好 👋';
const page: ChatMessagesPage = { conversationId: '11111111-1111-4111-8111-111111111111', peer,
  items: [{ conversationId: '11111111-1111-4111-8111-111111111111', sequence: '1', senderUserId: 2,
    clientMessageId: '22222222-2222-4222-8222-222222222222', body, createdAt: '2026-09-27T00:00:00.000Z' }],
  canSend: true, myReadSequence: '0', lastSequence: '1', oldestSequence: '1', nextAfterSequence: '1', hasMore: false };
const observers = new Map<Element, (visible: boolean) => void>();
let host: HTMLDivElement;
let root: Root;
let finePointer = true;
let client: ChatClient & { send: ReturnType<typeof vi.fn>; read: ReturnType<typeof vi.fn> };
const props = (): ChatPanelProps => ({ client, userId: 1, peerId: 2, onSelectPeer: vi.fn(),
  renderIdentity: (user) => createElement('span', null, user.name), t: (_zh, en) => en, locale: 'en' });
async function render(patch: Partial<ChatPanelProps> = {}) {
  await act(async () => root.render(createElement(StrictMode, null, createElement(ChatPanel, { ...props(), ...patch }))));
}
async function intersect(selector: string, visible: boolean) {
  const element = host.querySelector(selector)!;
  expect(observers.has(element)).toBe(true);
  await act(async () => observers.get(element)!(visible));
}
async function activate() { await intersect('.friend-chat', true); }
async function draft(value: string) {
  const input = host.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  return input;
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  finePointer = true;
  vi.stubGlobal('IntersectionObserver', class {
    constructor(private callback: (entries: unknown[]) => void) {}
    targets: Element[] = [];
    observe(target: Element) { this.targets.push(target); observers.set(target, (visible) => this.callback([{ isIntersecting: visible }])); }
    disconnect() { this.targets.forEach((target) => observers.delete(target)); }
  });
  vi.stubGlobal('matchMedia', () => ({ matches: finePointer }));
  client = { conversations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }), messages: vi.fn().mockResolvedValue(page),
    send: vi.fn().mockRejectedValue(new ChatError('NETWORK_ERROR')), read: vi.fn().mockResolvedValue({ myReadSequence: '1', unreadCount: 0 }) };
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); observers.clear(); vi.unstubAllGlobals(); });

describe('shared friend chat DOM', () => {
  it('omits the sent fallback and retries failed messages from the exclamation button with the same identity', async () => {
    vi.mocked(client.messages).mockResolvedValue({ ...page, items: [{ ...page.items[0], senderUserId: 1 }] });
    await render(); await activate();
    expect(host.querySelector('.friend-chat-receipt')).toBeNull();
    expect(host.textContent).not.toContain('Sent');
    const input = await draft('retry me');
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    const original = client.send.mock.calls[0][1];
    const retry = host.querySelector<HTMLButtonElement>('.friend-chat-failed-retry')!;
    expect(retry.textContent).toBe('');
    expect(retry.querySelector('svg')).not.toBeNull();
    client.send.mockResolvedValue({ ...page.items[0], ...original, sequence: '2', senderUserId: 1 });
    await act(async () => retry.click());
    expect(client.send.mock.calls[1][1].clientMessageId).toBe(original.clientMessageId);
    expect(client.send.mock.calls[1][1].body).toBe('retry me');
    expect(host.querySelector('.friend-chat-failed-retry')).toBeNull();
  });
  it('keeps the expression tray open while inserting, records recents and deletes whole expression tokens', async () => {
    vi.stubGlobal('requestAnimationFrame', (run: () => void) => { run(); return 0; });
    await render({ expressionPacks: [{ id: 'wechat', zh: '微信表情', en: 'WeChat emoji', items: [{ token: '[捂脸]', zh: '捂脸', en: 'Facepalm', src: '/face.png' }] }] }); await activate();
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Expressions"]')!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Facepalm"]')!.click());
    expect(host.querySelector('textarea')?.value).toBe('[捂脸]');
    expect(host.querySelector('[aria-label="Expression picker"]')).not.toBeNull();
    expect(host.textContent).toContain('Recently used');
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Delete previous expression or character"]')!.click());
    expect(host.querySelector('textarea')?.value).toBe('');
    expect(JSON.parse(localStorage.getItem('cuberoot.chat.recent-expressions.1')!)[0]).toBe('[捂脸]');
  });
  it('shows per-message unread/read receipts only for sent messages and keeps the input visually empty', async () => {
    vi.mocked(client.messages).mockResolvedValue({ ...page, peerReadSequence: '1', lastSequence: '3', items: [
      { ...page.items[0], senderUserId: 1 }, { ...page.items[0], sequence: '2', senderUserId: 1 },
      { ...page.items[0], sequence: '3', senderUserId: 2 },
    ] });
    await render(); await activate();
    expect(host.querySelector('[aria-label="Read by recipient"]')?.textContent).toBe('Read');
    expect(host.querySelector('[aria-label="Not yet read by recipient"]')?.textContent).toBe('Unread');
    expect(host.querySelectorAll('.friend-chat-receipt')).toHaveLength(2);
    expect(host.querySelector('textarea')?.hasAttribute('placeholder')).toBe(false);
    expect(host.querySelector('label[for="friend-chat-message"]')).toBeNull();
    expect(host.querySelector('textarea')?.getAttribute('aria-label')).toBe('Message');
  });
  it('uploads to favorites and previews before sending, without clearing a text draft', async () => {
    const id = '33333333-3333-4333-8333-333333333333';
    const upload = vi.fn().mockResolvedValue({ id });
    client.stickers = { upload, list: vi.fn().mockResolvedValue([{ id }]), image: vi.fn(), save: vi.fn() };
    await render(); await activate(); await draft('text stays');
    const button = (label: string) => [...host.querySelectorAll('button')].find((b) => (b.textContent === label || b.getAttribute('aria-label') === label))!;
    await act(async () => button('More actions').click());
    await act(async () => button('Saved stickers').click());
    const input = host.querySelector('input[type=file]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['gif'], 'hello.gif', { type: 'image/gif' })] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    expect(upload).toHaveBeenCalledOnce();
    expect(client.send).not.toHaveBeenCalled();
    expect(button('Send sticker')).toBeDefined();
    await act(async () => button('Send sticker').click());
    expect(client.send.mock.calls[0][1].stickerId).toBe(id);
    expect(host.querySelector('textarea')?.value).toBe('text stays');
    expect(host.querySelector('button[aria-label="Delivery unconfirmed. Retry sending"]')).not.toBeNull();
  });
  it('ignores upload completion after switching to another peer', async () => {
    let complete!: (value: { id: string }) => void;
    client.stickers = { upload: vi.fn().mockImplementation(() => new Promise((resolve) => { complete = resolve; })),
      list: vi.fn().mockResolvedValue([]), image: vi.fn(), save: vi.fn() };
    await render(); await activate();
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="More actions"]')!.click());
    await act(async () => [...host.querySelectorAll('button')].find((b) => b.textContent === 'Saved stickers')!.click());
    const input = host.querySelector('input[type=file]')!;
    Object.defineProperty(input, 'files', { value: [new File(['gif'], 'hello.gif', { type: 'image/gif' })] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    await render({ peerId: 3 });
    await act(async () => complete({ id: '33333333-3333-4333-8333-333333333333' }));
    expect(client.send).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Send sticker');
  });
  it('renders message bodies as text and waits for the message tail, not just the panel, before reading', async () => {
    await render(); await activate();
    expect(host.querySelector('.friend-chat-message-body')?.textContent).toBe(body);
    expect(host.querySelector('img')).toBeNull();
    expect(client.read).not.toHaveBeenCalled();
    await intersect('.friend-chat-tail', true);
    expect(client.read).toHaveBeenCalledWith(2, '1', expect.any(AbortSignal));
  });
  it('keeps IME Enter and touch Enter in the composer; desktop Enter sends once', async () => {
    await render(); await activate(); const input = await draft('你好');
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })));
    expect(client.send).not.toHaveBeenCalled();
    finePointer = false;
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(client.send).not.toHaveBeenCalled();
    finePointer = true;
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(client.send).toHaveBeenCalledTimes(1);
    expect(client.send.mock.calls[0][1].body).toBe('你好');
    expect(host.querySelector('button[aria-label="Delivery unconfirmed. Retry sending"]')).not.toBeNull();
  });
  it('offers explicit sign-in after session expiry without opening login in the background', async () => {
    client.messages = vi.fn().mockRejectedValue(new ChatError('UNAUTHENTICATED'));
    const onSignIn = vi.fn(); await render({ onSignIn }); await activate();
    expect(onSignIn).not.toHaveBeenCalled();
    const button = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Sign in');
    expect(button).toBeDefined(); await act(async () => button!.click()); expect(onSignIn).toHaveBeenCalledOnce();
  });
  it('shows session expiry in the thread even when the hidden conversation list receives 401 first', async () => {
    client.conversations = vi.fn().mockRejectedValue(new ChatError('UNAUTHENTICATED'));
    client.messages = vi.fn().mockImplementation(() => new Promise(() => {}));
    const onSignIn = vi.fn(); await render({ onSignIn }); await activate();
    const button = [...host.querySelectorAll('.friend-chat-thread button')].find((b) => b.textContent === 'Sign in');
    expect(button).toBeDefined();
    expect(onSignIn).not.toHaveBeenCalled();
  });
  it('clears the old account history and drafts when the account binding changes', async () => {
    await render(); await activate(); await draft('private draft');
    const other = { ...client, messages: vi.fn().mockResolvedValue({ ...page, items: [], lastSequence: '0', nextAfterSequence: '0' }) };
    await render({ userId: 3, client: other }); await activate();
    expect(host.querySelector('textarea')?.value).toBe('');
    expect(host.textContent).not.toContain(body);
  });
});
