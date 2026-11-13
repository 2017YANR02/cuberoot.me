// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import type { PlatformQrCard } from '@/lib/platform-qr-card';

const { loadCard, saveCard, catalog } = vi.hoisted(() => ({ loadCard: vi.fn(), saveCard: vi.fn(), catalog: vi.fn() }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('nuqs', async () => {
  const { useState } = await import('react');
  return { parseAsString: {}, useQueryState: (key: string) => useState(key === 'edit' ? 'card-one' : 'card-one,card-two') };
});
vi.mock('@/lib/platform-qr-admin', () => ({ qrAdminRequest: catalog, qrAdminEntity: (row: unknown) => row }));
vi.mock('@/lib/platform-qr-card', async original => ({
  ...await original<object>(), getPlatformQrCard: loadCard, savePlatformQrCard: saveCard,
}));
vi.mock('@/components/platform/PlatformQrMetadataEditor', () => ({
  PlatformQrMetadataEditor: ({ saveRef }: { saveRef: { current: (() => Promise<boolean>) | null } }) => {
    useEffect(() => { saveRef.current = async () => true; return () => { saveRef.current = null; }; }, [saveRef]);
    return null;
  },
}));
vi.mock('@/components/platform/PlatformQrElementInspector', () => ({
  ElementInspector: ({ update }: { update: (updater: (card: PlatformQrCard) => PlatformQrCard) => void }) => createElement('button', {
    'data-edit-quote': true,
    onClick: () => update(card => ({ ...card, quote: `${card.quote} 新编辑` })),
  }, '编辑文案'),
}));
vi.mock('@/components/platform/PlatformQrPromptComposer', () => ({ PromptComposer: () => null }));
vi.mock('@/components/platform/PlatformQrCardUnit', () => ({ QrCardUnit: () => null }));
import { PlatformQrCardStudio } from '@/components/platform/PlatformQrCardStudio';
import { normalizeQrCard } from '@/lib/platform-qr-card';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

async function mountStudio() {
  const items = ['one', 'two'].map(name => ({ id: name, title: name, status: 'active', data: { code: `card-${name}` } }));
  catalog.mockResolvedValue({ items, page: 1, pageSize: 50, total: 2 });
  loadCard.mockImplementation(async (id: string) => ({ card: normalizeQrCard({ quote: id }) }));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  const host = document.createElement('div');
  const root = createRoot(host);
  await act(async () => root.render(createElement(PlatformQrCardStudio, { entities: items, query: '', onQueryChange: vi.fn() })));
  const click = async (selector: string) => act(async () => { host.querySelector<HTMLButtonElement>(selector)!.click(); });
  const printSelection = async () => act(async () => {
    Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('A4 打印'))!.click();
  });
  return { host, print, click, printSelection, close: () => act(async () => root.unmount()) };
}

it('saves a dirty non-current card before printing the selected sheet', async () => {
  const editor = await mountStudio();
  let finish!: (value: { card: PlatformQrCard }) => void;
  saveCard.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  try {
    await editor.click('[aria-label="编辑 card-two"]');
    await editor.click('[data-edit-quote]');
    await editor.click('[aria-label="编辑 card-one"]');
    await editor.printSelection();
    expect(saveCard).toHaveBeenCalledTimes(1);
    expect(saveCard.mock.calls[0][0]).toBe('two');
    expect(saveCard.mock.calls[0][1].quote).toBe('two 新编辑');
    expect(editor.print).not.toHaveBeenCalled();
    await act(async () => finish({ card: saveCard.mock.calls[0][1] }));
    expect(editor.print).toHaveBeenCalledTimes(1);
  } finally { await editor.close(); }
});

it('stops printing if the user changes a card while the selected sheet is saving', async () => {
  const editor = await mountStudio();
  let finish!: (value: { card: PlatformQrCard }) => void;
  saveCard.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  try {
    await editor.click('[aria-label="编辑 card-two"]');
    await editor.click('[data-edit-quote]');
    await editor.click('[aria-label="编辑 card-one"]');
    await editor.printSelection();
    await editor.click('[data-edit-quote]');
    await act(async () => finish({ card: saveCard.mock.calls[0][1] }));
    expect(editor.print).not.toHaveBeenCalled();
    expect(editor.host.textContent).toContain('设计或选择已修改');
    expect(editor.host.textContent).toContain('未保存');
  } finally { await editor.close(); }
});
