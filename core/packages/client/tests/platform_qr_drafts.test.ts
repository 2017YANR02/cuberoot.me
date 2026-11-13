// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { normalizeQrCard } from '@/lib/platform-qr-card';
import { useQrCardDrafts } from '@/components/platform/useQrCardDrafts';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mountDrafts() {
  let current!: ReturnType<typeof useQrCardDrafts>;
  function Editor() { current = useQrCardDrafts(); return null; }
  const root = createRoot(document.createElement('div'));
  await act(async () => root.render(createElement(Editor)));
  return { state: () => current, close: () => act(async () => root.unmount()) };
}

it('retains newer edits when a delayed save finishes and prevents exporting that draft', async () => {
  const editor = await mountDrafts();
  try {
    await act(async () => editor.state().hydrate({ card: normalizeQrCard({ quote: '原文' }) }));
    await act(async () => editor.state().edit('card', card => ({ ...card, quote: '提交版本' })));
    const token = editor.state().saveToken('card');
    const submitted = editor.state().drafts.card;
    let finish!: () => void;
    const network = new Promise<void>(resolve => { finish = resolve; });
    const exportCard = vi.fn();
    const pending = network.then(() => {
      if (editor.state().acceptSaved('card', submitted, token)) exportCard();
    });
    await act(async () => editor.state().edit('card', card => ({ ...card, quote: '保存期间的新编辑' })));
    await act(async () => { finish(); await pending; });
    expect(editor.state().cards.card.quote).toBe('提交版本');
    expect(editor.state().drafts.card.quote).toBe('保存期间的新编辑');
    expect(editor.state().dirtyIds.has('card')).toBe(true);
    expect(exportCard).not.toHaveBeenCalled();

    const latest = editor.state().saveToken('card');
    await act(async () => { expect(editor.state().acceptSaved('card', editor.state().drafts.card, latest)).toBe(true); });
    expect(editor.state().cards.card.quote).toBe('保存期间的新编辑');
    expect(editor.state().dirtyIds.has('card')).toBe(false);
  } finally { await editor.close(); }
});

it('invalidates queued print/export work after leaving the editor or switching account', async () => {
  const editor = await mountDrafts();
  await act(async () => editor.state().hydrate({ card: normalizeQrCard({ quote: '私有设计' }) }));
  const state = editor.state();
  const token = state.saveToken('card');
  await editor.close();
  expect(state.isCurrent('card', token)).toBe(false);
  expect(state.acceptSaved('card', state.drafts.card, token)).toBe(false);
});

it('keeps per-card revisions separate and treats reset as a newer edit', async () => {
  const editor = await mountDrafts();
  try {
    await act(async () => editor.state().hydrate({ a: normalizeQrCard({ quote: 'A' }), b: normalizeQrCard({ quote: 'B' }) }));
    await act(async () => editor.state().edit('a', card => ({ ...card, quote: 'A 草稿' })));
    const submitted = editor.state().drafts.a;
    const a = editor.state().saveToken('a');
    const b = editor.state().saveToken('b');
    await act(async () => editor.state().reset('a'));
    expect(editor.state().isCurrent('a', a)).toBe(false);
    expect(editor.state().isCurrent('b', b)).toBe(true);
    expect(editor.state().drafts.a.quote).toBe('A');
    expect(editor.state().dirtyIds.has('a')).toBe(false);
    await act(async () => { expect(editor.state().acceptSaved('a', submitted, a)).toBe(false); });
    expect(editor.state().cards.a.quote).toBe('A 草稿');
    expect(editor.state().drafts.a.quote).toBe('A');
    expect(editor.state().dirtyIds.has('a')).toBe(true);
  } finally { await editor.close(); }
});
