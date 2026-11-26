// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import VaultPage from '@/app/[lang]/vault/page';
import { copyClipboardText } from '@/lib/clipboard';
import type { VaultEntry } from '@/lib/vault-crypto';
import { splitVaultLicenses } from '@/lib/vault-license';

const { user } = vi.hoisted(() => ({ user: { uid: 1, name: 'Test owner' } }));
const drag = vi.hoisted(() => ({ end: null as null | ((event: { active: { id: string }; over: { id: string } | null }) => void) }));
vi.mock('@dnd-kit/core', async (importOriginal) => ({
  ...await importOriginal<typeof import('@dnd-kit/core')>(),
  DndContext: ({ children, onDragEnd }: { children: ReactNode; onDragEnd: typeof drag.end }) => {
    drag.end = onDragEnd;
    return children;
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => user, authActions: { login: vi.fn() },
  useAuthStore: () => vi.fn() }));
vi.mock('@/components/BackHome', () => ({ default: () => null }));
vi.mock('@/lib/clipboard', () => ({ copyClipboardText: vi.fn() }));
vi.mock('@/hooks/usePinnedCountries', () => ({ usePinnedCountries: () => [[], vi.fn()] }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'zh', tr: ({ zh }: { zh: string }) => zh }));
vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => path, directApiUrl: (path: string) => path }));
vi.mock('@/lib/admin-api', () => ({ authHeaders: () => ({}), handleApi: (response: Response) => response.json() }));
vi.mock('@/lib/vault-crypto', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/vault-crypto')>(),
  isValidVaultPassphrase: () => true,
  unlockVaultPrivateKey: async () => ({}),
  decryptVaultEntry: async (ciphertext?: string) => ciphertext ? JSON.parse(ciphertext) : ({ id: 'entry', title: 'Test entry', fields: [], notes: '' }),
  encryptVaultEntry: async (entry: unknown, recipients: unknown[]) => ({ ciphertext: JSON.stringify(entry), iv: 'test', accesses: recipients }),
}));

let host: HTMLDivElement;
let root: Root;
const writes: { ciphertext: string; accesses: { userId: number }[] }[] = [];
const updates: { path: string; ciphertext: string; expectedVersion: number; accesses: { userId: number }[] }[] = [];
const trashedAt = '2026-01-03T00:00:00Z';
const response = (data: unknown) => new Response(JSON.stringify(data));
const type = async (value: string) => {
  const input = document.querySelector<HTMLInputElement>('[placeholder="搜索好友"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const advance = async (ms = 300) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const fill = async (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  await act(async () => {
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const editButton = () => host.querySelector<HTMLButtonElement>('button[aria-label="编辑模式"]')!;
const toggleEditing = async () => { await act(async () => editButton().click()); };
const unlockAndEdit = async () => {
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(editButton().getAttribute('aria-pressed')).toBe('false');
  expect(host.querySelector('button[aria-label="分享给好友"]')).toBeNull();
  await toggleEditing();
};
beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); writes.length = 0; updates.length = 0;
  vi.mocked(copyClipboardText).mockReset().mockResolvedValue(true);
  vi.stubGlobal('fetch', vi.fn((path: string, options?: RequestInit) => {
    if (path === '/v1/vault') return Promise.resolve(response({
      userId: 1, canManage: true, keyProfile: { publicKey: {}, encryptedPrivateKey: {} },
      items: [{ id: 'entry', ownerUserId: 1, ownerName: 'Test owner', version: 1, shares: [] }, ...writes.map((write, i) => ({ id: `saved-${i}`, ownerUserId: 1, ownerName: 'Test owner', version: 1, shares: [], ciphertext: write.ciphertext }))],
    }));
    if (path === '/v1/vault/items') {
      writes.push(JSON.parse(options!.body as string));
      return Promise.resolve(response({ id: `saved-${writes.length - 1}`, version: 1, updatedAt: '2026-01-01' }));
    }
    if (path.startsWith('/v1/vault/items/') && options?.method === 'PUT') {
      const body = JSON.parse(options.body as string);
      if (path.endsWith('/trash')) {
        return Promise.resolve(response({
          version: body.expectedVersion + 1, updatedAt: trashedAt, trashedAt: body.trashed ? trashedAt : null,
        }));
      }
      updates.push({ path, ...body });
      return Promise.resolve(response({ version: body.expectedVersion + 1, updatedAt: '2026-01-02' }));
    }
    if (path === '/v1/vault/users') return Promise.resolve(response({ users: [
      { userId: 2, name: 'Friend with a key', wcaId: '2026TEST01', publicKey: {} },
      { userId: 3, name: 'Friend without a key', wcaId: null, publicKey: null },
    ] }));
    throw new Error(`Unexpected request: ${path}`);
  }));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(VaultPage)));
  await unlockAndEdit();
  expect(host.querySelector('button[aria-label="分享给好友"]')).not.toBeNull();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('offers a retry when the vault load stalls', async () => {
  vi.mocked(fetch).mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
  }));
  await act(async () => root.unmount());
  root = createRoot(host);
  await act(async () => root.render(createElement(VaultPage)));
  expect(host.querySelector('[role="status"]')?.textContent).toBe('正在加载…');
  await advance(20_000);
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('资料库加载失败。');
  expect(host.querySelector('.vault-spin')).toBeNull();
  await clickText('重试');
  expect(host.querySelector('#vault-passphrase')).not.toBeNull();
});

it('returns to read-only only after confirming how to handle unsaved edits', async () => {
  const title = () => host.querySelector<HTMLInputElement>('.vault-title-input')!;
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
  await fill(title(), 'Unsaved title');
  await toggleEditing();
  expect(editButton().getAttribute('aria-pressed')).toBe('true');
  expect(title().value).toBe('Unsaved title');
  expect(host.querySelector<HTMLTextAreaElement>('#vault-notes')?.readOnly).toBe(false);
  await toggleEditing();
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(editButton().getAttribute('aria-pressed')).toBe('false');
  expect(title().readOnly).toBe(true);
  expect(title().value).toBe('Test entry');
  expect(host.querySelector('.vault-entry-notes')).toBeNull();
  expect(host.querySelector('[aria-label="移入回收站"]')).toBeNull();
  expect(host.querySelector('button[aria-label="分享给好友"]')).toBeNull();
  expect(host.textContent).not.toContain('新建');
  expect(updates).toHaveLength(0);
});

it('lists friends before searching and adds only an eligible recipient on save', async () => {
  const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="分享给好友"]')!;
  const options = () => [...document.querySelectorAll<HTMLButtonElement>('.list-select-item')];
  await act(async () => trigger.click());
  expect(options()).toHaveLength(2);
  expect(options()[1].textContent).toContain('尚未启用接收');
  expect(options()[1].disabled).toBe(true);
  const requestCount = vi.mocked(fetch).mock.calls.length;
  await type('2026TEST01');
  expect(options()).toHaveLength(1);
  await act(async () => options()[0].click());
  expect(host.querySelector('.vault-share-list')?.textContent).toContain('Friend with a key');
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(requestCount);
  await clickText('保存');
  expect(updates[0].accesses.map(({ userId }) => userId)).toEqual([1, 2]);
});

it('falls back to accepted friends when the older vault API returns an empty list', async () => {
  const fetchMock = vi.mocked(fetch);
  const originalFetch = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((input, options) => {
    if (input === '/v1/vault/users') return Promise.resolve(response({ users: [] }));
    if (input === '/v1/friends') return Promise.resolve(response({
      friends: [{ userId: 2, name: 'Accepted friend', wcaId: null }],
      incoming: [{ userId: 3, name: 'Pending request', wcaId: null }],
    }));
    if (input === '/v1/vault/users?q=2') return Promise.resolve(response({ users: [
      { userId: 22, name: 'Another user', publicKey: {} },
      { userId: 2, name: 'Accepted friend', publicKey: {} },
    ] }));
    return originalFetch(input, options);
  });
  await clickText('回收站');
  await clickText('返回');
  await clickText('Test entry');
  await clickText('分享给好友');
  const options = document.querySelectorAll<HTMLButtonElement>('.list-select-item');
  expect(options).toHaveLength(1);
  expect(options[0].textContent).toContain('Accepted friend');
  await act(async () => options[0].click());
  expect(host.querySelector('.vault-share-list')?.textContent).toContain('Accepted friend');
  await clickText('保存');
  expect(updates[0].accesses.map(({ userId }) => userId)).toEqual([1, 2]);
});

it('creates an owner-only encrypted account entry through the simplified editor', async () => {
  expect(host.querySelector('[aria-label="选择资料库文件"]')).toBeNull();
  expect(host.textContent).not.toContain('导出明文备份');
  const click = async (label: string) => {
    const button = [...host.querySelectorAll('button')].find(item => item.textContent === label)!;
    await act(async () => button.click());
  };
  await click('新建');
  await click('保存');
  expect(writes).toHaveLength(0);
  expect(host.textContent).toContain('请填写标题');
  await fill(host.querySelector<HTMLInputElement>('.vault-title-input')!, 'Account one');
  const fields = host.querySelectorAll<HTMLTextAreaElement>('textarea.vault-value-input');
  expect(fields).toHaveLength(3);
  expect([...host.querySelectorAll('.vault-account .vault-field-label')].map((label) => label.textContent))
    .toEqual(['密码', '备注']);
  await fill(fields[0], 'test-owner@example.com');
  await fill(fields[1], 'test-secret');
  let rejectSave!: (error: Error) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise((_, reject) => { rejectSave = reject; }));
  await click('保存');
  const saveButton = host.querySelector<HTMLButtonElement>('.vault-editor-head .is-primary')!;
  expect(saveButton.getAttribute('aria-busy')).toBe('true');
  expect(saveButton.querySelector('.vault-spin')).not.toBeNull();
  expect(saveButton.disabled).toBe(true);
  await act(async () => rejectSave(new Error('Save failed')));
  expect(saveButton.querySelector('.vault-spin')).toBeNull();
  expect(saveButton.disabled).toBe(false);
  await click('保存');
  expect(writes).toHaveLength(1);
  expect(writes[0].accesses.map(access => access.userId)).toEqual([1]);
  expect(JSON.parse(writes[0].ciphertext)).toMatchObject({
    title: 'Account one', category: 'accounts', fields: [
      { label: '账号', value: 'test-owner@example.com', secret: false },
      { label: '密码', value: 'test-secret', secret: true },
    ],
  });
  expect(editButton().getAttribute('aria-pressed')).toBe('false');
  expect(host.querySelector('.vault-editor-head .is-primary, .vault-spin')).toBeNull();
  expect(host.querySelector<HTMLInputElement>('.vault-title-input')?.readOnly).toBe(true);
  const search = host.querySelector<HTMLInputElement>('[placeholder="搜索资料"]')!;
  const requestCount = vi.mocked(fetch).mock.calls.length;
  await fill(search, 'TEST-OWNER@example.com');
  expect(host.querySelector('.vault-list')?.textContent).toContain('Account one');
  expect(host.querySelector('.vault-list')?.textContent).not.toContain('Test entry');
  await fill(search, ' SECRET ');
  expect(host.querySelector('.vault-list')?.textContent).toContain('Account one');
  expect(host.querySelector('.vault-list')?.textContent).not.toContain('Test entry');
  await fill(search, 'no matching value');
  expect(host.querySelector('.vault-list')?.textContent).toContain('没有内容');
  await advance();
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(requestCount);
});

it('keeps the generic field editor without showing stored field names', async () => {
  const account = { id: 'login', label: '身份证号码', value: 'example', secret: false };
  const notes = '第一段备注\n\n第二段备注';
  writes.push({ accesses: [{ userId: 1 }], ciphertext: JSON.stringify({
    id: 'info', title: 'Single field', category: 'other', notes,
    fields: [account, { id: 'password', label: '统一社会信用代码', value: 'fixture', secret: true }],
  }) });
  await act(async () => root.unmount());
  root = createRoot(host);
  await act(async () => root.render(createElement(VaultPage)));
  await unlockAndEdit();
  const search = host.querySelector<HTMLInputElement>('[placeholder="搜索资料"]')!;
  await fill(search, '身份证号码');
  expect(host.querySelector('.vault-list')?.textContent).not.toContain('Single field');
  for (const query of ['Single field', '第一段备注', 'example']) {
    await fill(search, query);
    expect(host.querySelector('.vault-list')?.textContent).toContain('Single field');
  }
  await fill(search, '');
  await clickText('Single field');
  expect(host.querySelector('[aria-label="资料分类"]')).toBeNull();
  expect(host.querySelector('.vault-fields')?.textContent).not.toMatch(/身份证号码|统一社会信用代码/);
  expect(host.querySelector('textarea[aria-label="内容 2"]')?.getAttribute('placeholder')).toBe('内容');
  const notesRow = host.querySelector('.vault-entry-notes')!;
  expect(notesRow.firstElementChild?.textContent).toBe('备注');
  expect(notesRow.querySelector('textarea')?.value).toBe(notes);
  const remainingFieldId = host.querySelector<HTMLTextAreaElement>('.vault-fields textarea.vault-value-input')!.id;
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="删除第 2 项内容"]')!.click());
  expect(updates).toHaveLength(0);
  expect(host.querySelectorAll('.vault-fields textarea.vault-value-input')).toHaveLength(1);
  expect(host.querySelector<HTMLTextAreaElement>('.vault-fields textarea.vault-value-input')!.id).toBe(remainingFieldId);
  await clickText('保存');
  expect(JSON.parse(updates[0].ciphertext)).toMatchObject({ category: 'other', fields: [account], notes });
  await clickText('Test entry');
  await clickText('Single field');
  expect(host.querySelectorAll('.vault-fields button.vault-copy-value')).toHaveLength(1);
  expect(host.querySelector('[aria-label="删除第 2 项内容"]')).toBeNull();

  await toggleEditing();
  await choose('筛选分类', '企业');
  await clickText('新建');
  await fill(host.querySelector<HTMLInputElement>('.vault-title-input')!, 'New information item');
  await clickText('添加内容');
  await fill(host.querySelector<HTMLTextAreaElement>('textarea[aria-label="内容 1"]')!, 'Business detail');
  await fill(host.querySelector<HTMLTextAreaElement>('#vault-notes')!, 'Business note');
  await clickText('添加一组');
  const groups = () => host.querySelectorAll<HTMLElement>('.vault-information-group');
  expect(groups()).toHaveLength(2);
  const second = groups()[1];
  const addContent = [...second.querySelectorAll('button')].find((button) => button.textContent === '添加内容')!;
  await act(async () => addContent.click());
  await fill(second.querySelector<HTMLInputElement>('[aria-label="第 2 组名称"]')!, 'Second license');
  await fill(second.querySelector<HTMLTextAreaElement>('[aria-label="内容 1"]')!, 'Second license number');
  await fill(second.querySelector<HTMLTextAreaElement>('textarea.vault-notes')!, 'Second license note');
  const bytes = new Uint8Array([255, 216, 255, 217]);
  const file = new File([bytes], 'second.jpg', { type: 'image/jpeg' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
  const imageInput = second.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(imageInput, 'files', { value: [file] });
  await act(async () => imageInput.dispatchEvent(new Event('change', { bubbles: true })));
  await clickText('保存');
  expect(JSON.parse(writes[1].ciphertext)).toMatchObject({
    category: 'business',
    notes: 'Business note',
    fields: [{ label: '', value: 'Business detail' }],
    informationGroups: [{
      name: 'Second license', fields: [{ label: '', value: 'Second license number' }], notes: 'Second license note',
      images: [{ name: 'second.jpg', dataUrl: 'data:image/jpeg;base64,/9j/2Q==' }],
    }],
  });
  expect(groups()[0].querySelector('img')).toBeNull();
  expect(groups()[1].querySelector('img')?.alt).toBe('second.jpg');
  await fill(search, 'Second license note');
  expect(host.querySelector('.vault-list')?.textContent).toContain('New information item');
});

const clickText = async (label: string) => {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === label || item.querySelector('strong')?.textContent === label)!;
  await act(async () => button.click());
};

it('uses displayed tags as categories while keeping unclassified and untagged entries accessible', async () => {
  writes.push(...[
    { title: '存证记录｜测试协议', category: 'other' },
    { title: '个人证件｜测试证件', category: 'personal' },
    { title: '证件｜第二份证件', category: 'other' },
    { title: '测试个人资料', category: 'personal' },
    { title: '出行｜测试记录', category: 'other' },
    { title: '未分类条目', category: 'other' },
  ].map((entry) => ({
    accesses: [{ userId: 1 }], ciphertext: JSON.stringify({ id: entry.title, ...entry, fields: [], notes: '' }),
  })));
  await act(async () => root.unmount());
  root = createRoot(host);
  await act(async () => root.render(createElement(VaultPage)));
  await unlockAndEdit();
  const list = host.querySelector('.vault-list')!;
  expect(list.textContent).toContain('未分类条目');
  expect(list.textContent).toContain('合同 测试协议');
  await clickText('证件 测试证件');
  expect(host.querySelector<HTMLInputElement>('[aria-label="标题标签"]')?.value).toBe('证件');
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="筛选分类"]')!.click());
  const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')];
  expect(options.map((option) => option.textContent)).toEqual(['全部', '个人', '账号', '企业', '证件', '合同', '出行']);
  await act(async () => options[4].click());
  expect(list.textContent).toContain('证件 测试证件');
  expect(list.textContent).toContain('证件 第二份证件');
  expect(list.textContent).not.toContain('测试个人资料');
  await choose('筛选分类', '个人');
  expect(list.textContent).toContain('测试个人资料');
  expect(list.textContent).not.toContain('证件 测试证件');
  const search = host.querySelector<HTMLInputElement>('[placeholder="搜索资料"]')!;
  await fill(search, '没有匹配的标题');
  await choose('筛选分类', '出行');
  await fill(search, '');
  expect(list.textContent).toContain('出行 测试记录');
  expect(list.textContent).not.toContain('证件 测试证件');
  await choose('筛选分类', '合同');
  expect(list.textContent).not.toContain('未分类条目');
  await clickText('合同 测试协议');
  await clickText('保存');
  expect(JSON.parse(updates[0].ciphertext).title).toBe('合同｜测试协议');

  await toggleEditing();
  await clickText('新建');
  expect(host.querySelector<HTMLInputElement>('[aria-label="标题标签"]')?.value).toBe('合同');
  await clickText('保存');
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('请填写标题。');
  await fill(host.querySelector<HTMLInputElement>('.vault-title-input')!, '新增协议');
  await clickText('保存');
  expect(list.textContent).toContain('合同 新增协议');
});

it('pairs legacy business licenses by the evidence in their notes and image names before saving', async () => {
  const firstCode = '1'.repeat(18);
  const secondCode = '2'.repeat(18);
  const firstName = '测试甲工作室（个人独资）';
  const secondName = '测试乙有限公司';
  const firstNotes = `名称：${firstName}\n成立日期：2024-01-01`;
  const secondNotes = `企业资料｜${secondName}营业执照\n名称：${secondName}\n统一社会信用代码：${secondCode}\n证照编号：fixture`;
  const firstImage = { id: 'first-photo', name: '测试甲营业执照-副本.jpg', dataUrl: 'data:image/jpeg;base64,/9j/2Q==' };
  const secondImage = { id: 'second-photo', name: `${secondName}-营业执照.jpg`, dataUrl: 'data:image/jpeg;base64,/9j/2g==' };
  const entry: VaultEntry = {
    id: 'licenses', title: '企业资料｜测试营业执照', category: 'business',
    fields: [secondCode, firstCode].map((value, index) => ({ id: `code-${index}`, label: '', value, secret: false })),
    notes: `${firstNotes}\n\n${secondNotes}`, images: [secondImage, firstImage],
  };
  const ambiguous = { ...entry, images: entry.images!.map((image) => ({ ...image, name: '营业执照.jpg' })) };
  expect(splitVaultLicenses(ambiguous)).toBe(ambiguous);
  writes.push({ accesses: [{ userId: 1 }], ciphertext: JSON.stringify(entry) });
  await act(async () => root.unmount());
  root = createRoot(host);
  await act(async () => root.render(createElement(VaultPage)));
  await unlockAndEdit();
  await clickText('企业 测试营业执照');
  expect(host.querySelector<HTMLInputElement>('[aria-label="标题标签"]')?.value).toBe('企业');
  const groups = host.querySelectorAll<HTMLElement>('.vault-information-group');
  expect(groups).toHaveLength(2);
  expect([...groups].map((group) => group.querySelector('img')?.alt)).toEqual([firstImage.name, secondImage.name]);
  for (const [index, notes] of [firstNotes, secondNotes].entries()) {
    const row = groups[index].querySelector('.vault-field-row--notes')!;
    expect(row.closest('details')).toBeNull();
    expect(row.querySelector('label')?.textContent).toBe('备注');
    expect(row.querySelector('textarea')?.value).toBe(notes);
  }
  expect(updates).toHaveLength(0);
  await clickText('保存');
  expect(JSON.parse(updates[0].ciphertext)).toMatchObject({
    informationName: firstName, fields: [{ value: firstCode }], notes: firstNotes, images: [firstImage],
    informationGroups: [{ name: secondName, fields: [{ value: secondCode }], notes: secondNotes, images: [secondImage] }],
  });
  expect(editButton().getAttribute('aria-pressed')).toBe('false');
  const readOnlyNotes = [...host.querySelectorAll('.vault-information-group button.vault-notes [id$="-copy-text"]')];
  expect(readOnlyNotes.map((note) => note.textContent)).toEqual([firstNotes, secondNotes]);
});

it('adds and removes accounts without changing the other accounts or the platform item', async () => {
  const images = [{ id: 'image', name: 'Fixture.jpg', dataUrl: 'data:image/jpeg;base64,/9j/2Q==' }];
  writes.push({ accesses: [{ userId: 1 }], ciphertext: JSON.stringify({
    id: 'old-account',
    title: 'Old account',
    category: 'accounts',
    notes: 'Original notes',
    privateNotes: 'Original private notes',
    accountName: 'Personal',
    images,
    fields: [
      { id: 'pass', label: '密码', value: 'fixture', secret: true },
      { id: 'email', label: '邮箱', value: 'example@example.com', secret: false },
      { id: 'phone', label: '手机号', value: '5550100', secret: false },
      { id: 'site', label: '网站', value: 'example.com', secret: false },
    ],
  }) });
  await act(async () => root.unmount());
  root = createRoot(host);
  await act(async () => root.render(createElement(VaultPage)));
  await unlockAndEdit();
  await clickText('Old account');
  const accountGroup = (account: number) => host.querySelector<HTMLElement>(`#vault-account-${account}`)!;
  const statusPicker = (account: number) => accountGroup(account).querySelector<HTMLElement>('.vault-account-status')!;
  const removeButton = (account: number) => accountGroup(account).querySelector<HTMLButtonElement>(`[aria-label="移除账号 ${account}"]`)!;
  expect(accountGroup(1).querySelector('.vault-account-heading')?.firstElementChild).toBe(statusPicker(1));
  expect(accountGroup(1).querySelector('.vault-account-heading textarea')?.id).toBe('vault-account-1-login');
  const statusTrigger = (account: number) => statusPicker(account).querySelector<HTMLButtonElement>('button[aria-expanded]')!;
  const visibleStatuses = (account: number) => [...statusPicker(account).querySelectorAll<HTMLElement>('[data-status]')]
    .map((mark) => mark.dataset.status);
  const chooseStatus = async (account: number, status: string) => {
    if (statusTrigger(account).getAttribute('aria-expanded') === 'false') await act(async () => statusTrigger(account).click());
    const option = statusPicker(account).querySelector<HTMLElement>(`[data-status="${status}"]`)!.closest('button')!;
    await act(async () => option.click());
  };
  expect(visibleStatuses(1)).toEqual(['untested']);
  expect(statusPicker(1).querySelectorAll('button')).toHaveLength(2);
  expect(removeButton(1).closest('[hidden]')).toBeNull();
  const pointer = (type: string, relatedTarget?: EventTarget) => Object.assign(
    new MouseEvent(type, { bubbles: true, relatedTarget }), { pointerType: 'mouse' },
  );
  await act(async () => statusTrigger(1).dispatchEvent(pointer('pointerover')));
  expect(visibleStatuses(1)).toEqual(['untested', 'verified', 'problem']);
  const expandedActions = statusPicker(1).querySelectorAll('button');
  expect(expandedActions).toHaveLength(4);
  expect(expandedActions[3].getAttribute('aria-label')).toBe('移除账号 1');
  await act(async () => removeButton(1).dispatchEvent(pointer('pointerdown')));
  expect(statusTrigger(1).getAttribute('aria-expanded')).toBe('true');
  await act(async () => statusTrigger(1).dispatchEvent(pointer('pointerout', document.body)));
  expect(visibleStatuses(1)).toEqual(['untested']);
  expect(host.querySelector<HTMLTextAreaElement>('#vault-account-1-login')?.value).toBe('邮箱: example@example.com\n手机号: 5550100');
  expect(host.querySelector<HTMLTextAreaElement>('#vault-account-1-notes')?.value)
    .toBe('Original notes\n\nOriginal private notes\n\n网站: example.com');
  expect(updates).toHaveLength(0);

  await clickText('添加账号');
  const newAccount = accountGroup(2);
  expect([...newAccount.querySelectorAll('label')].map((label) => label.textContent)).toEqual(['密码', '备注']);
  const [login, password, notes] = newAccount.querySelectorAll<HTMLTextAreaElement>('textarea');
  expect(login.placeholder).toBe('输入账号');
  await fill(login, 'work@example.com');
  await fill(password, 'second-account-fixture');
  await fill(notes, 'Work account');
  expect(visibleStatuses(2)).toEqual(['untested']);
  await chooseStatus(1, 'verified');
  expect(visibleStatuses(1)).toEqual(['verified']);
  expect(visibleStatuses(2)).toEqual(['untested']);
  await chooseStatus(2, 'problem');
  expect(visibleStatuses(2)).toEqual(['problem']);
  await clickText('保存');
  const saved = JSON.parse(updates[0].ciphertext);
  expect(saved.fields).toEqual(JSON.parse(writes[0].ciphertext).fields);
  expect(saved.accountStatus).toBe('verified');
  expect(saved.accounts).toMatchObject([{ accountStatus: 'problem', notes: 'Work account', fields: [
    { value: 'work@example.com', secret: false },
    { value: 'second-account-fixture', secret: true },
  ] }]);
  await clickText('Test entry');
  await fill(host.querySelector<HTMLInputElement>('[placeholder="搜索资料"]')!, 'Work account');
  await clickText('Old account');
  expect(visibleStatuses(1)).toEqual(['verified']);
  expect(visibleStatuses(2)).toEqual(['problem']);
  expect(host.querySelector('#vault-account-2-notes-copy-text')?.textContent).toBe('Work account');
  expect(host.querySelector('#vault-account-1-password-copy-text')?.textContent).toBe('fixture');
  await toggleEditing();
  await chooseStatus(2, 'untested');
  await clickText('保存');
  const bothAccounts = JSON.parse(updates[1].ciphertext);
  expect(bothAccounts).toMatchObject({ accountStatus: 'verified', accounts: [{ accountStatus: 'untested' }] });

  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
  const removeAccount = async (account: number) => {
    await act(async () => removeButton(account).click());
  };
  await toggleEditing();
  expect(statusTrigger(2).getAttribute('aria-expanded')).toBe('false');
  expect(removeButton(2).closest('[hidden]')).toBeNull();
  await removeAccount(2);
  expect(confirm).toHaveBeenCalled();
  expect(host.querySelectorAll('.vault-account')).toHaveLength(2);
  await removeAccount(2);
  expect(host.querySelectorAll('.vault-account')).toHaveLength(1);
  expect(host.querySelector<HTMLTextAreaElement>('#vault-account-1-password')?.value).toBe('fixture');
  expect(updates).toHaveLength(2);
  await toggleEditing();
  await toggleEditing();
  await removeAccount(1);
  expect(host.querySelectorAll('.vault-account')).toHaveLength(1);
  expect(host.querySelector<HTMLTextAreaElement>('#vault-account-1-login')?.value).toBe('work@example.com');
  expect(updates).toHaveLength(2);
  await clickText('保存');
  const remaining = JSON.parse(updates[2].ciphertext);
  expect(remaining).toMatchObject({ title: 'Old account', images, fields: [], notes: '', accounts: bothAccounts.accounts });
  expect(remaining).not.toHaveProperty('privateNotes');
  expect(remaining).not.toHaveProperty('accountName');
  expect(remaining).not.toHaveProperty('accountStatus');

  await toggleEditing();
  await removeAccount(1);
  await clickText('保存');
  expect(host.querySelectorAll('.vault-account')).toHaveLength(0);
  expect(JSON.parse(updates[3].ciphertext)).toMatchObject({ title: 'Old account', images, fields: [], accounts: [] });
  await toggleEditing();
  await clickText('添加账号');
  expect(host.querySelector<HTMLTextAreaElement>('#vault-account-1-login')?.placeholder).toBe('输入账号');
});
const choose = async (label: string, option: string) => {
  await act(async () => host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
  const item = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(item => item.textContent === option)!;
  await act(async () => item.click());
};

it('drags whole account groups and retains their order after saving', async () => {
  const accountFields = (name: string) => [
    { id: 'login', label: '账号', value: name, secret: false },
    { id: 'password', label: '密码', value: `fixture-${name}`, secret: true },
  ];
  const first = { fields: accountFields('first'), accountStatus: 'verified', notes: 'First notes' };
  const second = { id: 'second', name: '', fields: accountFields('second'), accountStatus: 'problem', notes: 'Second notes' };
  const third = { id: 'third', name: '', fields: accountFields('third'), accountStatus: 'untested', notes: '  \n' };
  writes.push({ accesses: [{ userId: 1 }], ciphertext: JSON.stringify({
    id: 'platform', title: '账号 ｜ Platform', category: 'accounts', ...first, accounts: [second, third],
  }) });
  const openPlatform = async () => {
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(createElement(VaultPage)));
    await unlockAndEdit();
    const title = host.querySelector('.vault-list-title')!;
    expect(title.querySelector('.vault-title-tag')?.textContent).toBe('账号');
    expect(title.querySelector('.vault-list-title-name')?.textContent).toBe('Platform');
    await act(async () => title.closest('button')!.click());
    expect(host.querySelector<HTMLInputElement>('.vault-editor-title input.vault-title-tag')?.value).toBe('账号');
    expect(host.querySelector<HTMLInputElement>('.vault-title-input')?.value).toBe('Platform');
  };
  const visibleAccounts = () => [...host.querySelectorAll('.vault-account')].map((group) =>
    [...Array.from(group.querySelectorAll('textarea'), (field) => field.value), group.querySelector<HTMLElement>('[data-status]')?.dataset.status],
  );
  await openPlatform();
  await toggleEditing();
  expect(host.querySelector('.sortable-card-drag-handle')).toBeNull();
  expect(host.querySelector<HTMLInputElement>('.vault-title-input')?.value).toBe('Platform');
  expect(host.querySelector('.vault-editor-title span.vault-title-tag')?.textContent).toBe('账号');
  const firstAccount = host.querySelector('#vault-account-1')!;
  const firstAccountValues = [...firstAccount.querySelectorAll<HTMLButtonElement>('.vault-copy-value')];
  expect(firstAccountValues.map(({ id }) => id)).toEqual(['vault-account-1-login', 'vault-account-1-password', 'vault-account-1-notes']);
  expect(firstAccount.querySelector('.vault-value-line .vault-icon-button')).toBeNull();
  const check = (button: HTMLButtonElement) => button.querySelector('.vault-copy-feedback .filled-status-mark[data-variant="success"]');
  expect(firstAccountValues.every((button) => !check(button))).toBe(true);
  await act(async () => firstAccountValues[0].click());
  expect(copyClipboardText).toHaveBeenLastCalledWith('first');
  expect(check(firstAccountValues[0])).not.toBeNull();
  expect(check(firstAccountValues[0])?.parentElement?.previousElementSibling?.textContent).toBe('first');
  vi.mocked(copyClipboardText).mockResolvedValueOnce(false);
  await act(async () => firstAccountValues[1].click());
  expect(copyClipboardText).toHaveBeenLastCalledWith('fixture-first');
  expect(check(firstAccountValues[1])).toBeNull();
  await act(async () => firstAccountValues[2].click());
  expect(copyClipboardText).toHaveBeenLastCalledWith('First notes');
  expect(check(firstAccountValues[0])).toBeNull();
  expect(check(firstAccountValues[2])).not.toBeNull();
  await advance(1_200);
  expect(check(firstAccountValues[2])).toBeNull();
  expect(host.querySelector('#vault-account-3 .vault-field-row--notes')).toBeNull();
  expect(host.querySelector<HTMLButtonElement>('.vault-account-status button')?.disabled).toBe(true);
  await toggleEditing();
  expect(host.querySelector('.vault-copy-value')).toBeNull();
  expect(host.querySelector('#vault-account-3 .vault-field-row--notes')).not.toBeNull();
  expect(host.querySelector('.vault-account-heading [aria-label="拖动调整账号 3 顺序"]')).not.toBeNull();
  await act(async () => drag.end!({ active: { id: 'account:third' }, over: null }));
  expect(visibleAccounts().map(([name]) => name)).toEqual(['first', 'second', 'third']);
  await act(async () => drag.end!({ active: { id: 'account:third' }, over: { id: 'primary' } }));
  const reordered = [
    ['third', 'fixture-third', '  \n', 'untested'],
    ['first', 'fixture-first', 'First notes', 'verified'],
    ['second', 'fixture-second', 'Second notes', 'problem'],
  ];
  expect(visibleAccounts()).toEqual(reordered);
  expect(updates).toHaveLength(0);
  await clickText('保存');
  expect(JSON.parse(updates[0].ciphertext)).toMatchObject({ ...first, primaryAccountIndex: 1, accounts: [third, second] });

  writes[0].ciphertext = updates[0].ciphertext;
  await openPlatform();
  expect(visibleAccounts()).toEqual(reordered);
  await act(async () => drag.end!({ active: { id: 'primary' }, over: { id: 'account:second' } }));
  expect(visibleAccounts()).toEqual([reordered[0], reordered[2], reordered[1]]);
  await fill(host.querySelector<HTMLInputElement>('.vault-title-input')!, 'New Platform');
  await clickText('保存');
  expect(JSON.parse(updates[1].ciphertext).title).toBe('账号 ｜ New Platform');
});

const openLegacyMergedFixture = async () => {
  const original = { id: 'old-merge', title: 'Source', fields: [], notes: 'Original note' };
  writes.push({
    accesses: [{ userId: 1 }],
    ciphertext: JSON.stringify({ ...original, mergedInto: { id: 'entry', title: 'Test entry' } }),
  });
  await act(async () => root.unmount());
  root = createRoot(host);
  await act(async () => root.render(createElement(VaultPage)));
  await unlockAndEdit();
  return original;
};

it('can still restore an existing entry marked as merged', async () => {
  const original = await openLegacyMergedFixture();
  await clickText('Source');
  await clickText('恢复原条目');
  expect(JSON.parse(updates[0].ciphertext)).toEqual(original);
  expect(updates[0].expectedVersion).toBe(1);
  expect(host.querySelector('.vault-list')?.textContent).toContain('Source');
  expect(host.querySelector('.vault-list')?.textContent).not.toContain('已合并');
});

it('moves one merged list item to Trash without disturbing another open draft', async () => {
  await openLegacyMergedFixture();
  const title = host.querySelector<HTMLInputElement>('.vault-title-input')!;
  await fill(title, 'Unsaved target edit');
  const removeSource = host.querySelector<HTMLButtonElement>('button[aria-label="将「Source」移入回收站"]')!;
  const fetchMock = vi.mocked(fetch);
  await act(async () => removeSource.click());
  const [path, request] = fetchMock.mock.lastCall!;
  expect(path).toBe('/v1/vault/items/saved-0/trash');
  expect(JSON.parse(request?.body as string)).toEqual({ trashed: true, expectedVersion: 1 });
  expect(host.querySelector('.vault-list')?.textContent).not.toContain('Source');
  expect(host.querySelector('.vault-list')?.textContent).toContain('Test entry');
  expect(title.value).toBe('Unsaved target edit');
});

it('moves a saved item to Trash, restores it, and only empties Trash after confirmation', async () => {
  const fetchMock = vi.mocked(fetch);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const trashPath = '/v1/vault/items/entry/trash';
  const clickTrash = async () => {
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="移入回收站"]')!;
    expect(button.textContent).toBe('');
    await act(async () => button.click());
  };
  fetchMock.mockResolvedValueOnce(response({ version: 2, updatedAt: trashedAt, trashedAt }));
  await clickTrash();
  const [path, request] = fetchMock.mock.lastCall!;
  expect(path).toBe(trashPath);
  expect(request?.method).toBe('PUT');
  expect(JSON.parse(request?.body as string)).toEqual({ trashed: true, expectedVersion: 1 });
  expect(host.querySelector('.vault-list')?.textContent).not.toContain('Test entry');

  await clickText('回收站');
  await clickText('Test entry');
  expect(host.querySelector<HTMLInputElement>('.vault-title-input')?.readOnly).toBe(true);
  await toggleEditing();
  expect(host.textContent).not.toContain('恢复');
  expect(host.textContent).not.toContain('清空回收站');
  await toggleEditing();
  fetchMock.mockResolvedValueOnce(response({ version: 3, updatedAt: trashedAt, trashedAt: null }));
  await clickText('恢复');
  expect(JSON.parse(fetchMock.mock.lastCall?.[1]?.body as string)).toEqual({ trashed: false, expectedVersion: 2 });
  expect(host.querySelector('.vault-list')?.textContent).toContain('回收站为空');

  await clickText('返回');
  await clickText('Test entry');
  fetchMock.mockResolvedValueOnce(response({ version: 4, updatedAt: trashedAt, trashedAt }));
  await clickTrash();
  await clickText('回收站');
  const requestCount = fetchMock.mock.calls.length;
  await clickText('清空回收站');
  expect(fetchMock).toHaveBeenCalledTimes(requestCount);
  expect(host.querySelector('.vault-list')?.textContent).toContain('Test entry');

  confirm.mockReturnValue(true);
  fetchMock.mockResolvedValueOnce(response({ ok: true }));
  await clickText('清空回收站');
  expect(fetchMock).toHaveBeenLastCalledWith('/v1/vault/trash', expect.objectContaining({ method: 'DELETE' }));
  expect(host.querySelector('.vault-list')?.textContent).toContain('回收站为空');
});
