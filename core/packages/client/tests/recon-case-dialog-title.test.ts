// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const { cleanups } = vi.hoisted(() => ({ cleanups: [] as (() => void)[] }));
vi.mock('react', () => ({ useEffect: (effect: () => (() => void) | undefined) => {
  const cleanup = effect();
  if (cleanup) cleanups.push(cleanup);
} }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'zh' } }) }));
afterEach(() => {
  cleanups.splice(0).reverse().forEach(cleanup => cleanup());
  vi.unstubAllGlobals();
});

it('settles multiple title consumers with one observer instead of a microtask loop', async () => {
  const NativeObserver = MutationObserver;
  const observers: MutationObserver[] = [];
  let callbacks = 0;
  vi.stubGlobal('MutationObserver', class extends NativeObserver {
    constructor(callback: MutationCallback) {
      super((records, observer) => {
        callbacks++;
        if (callbacks === 20) { observers.forEach(item => item.disconnect()); return; }
        callback(records, observer);
      });
      observers.push(this);
    }
  });
  useDocumentTitle('复盘', 'Reconstruction');
  useDocumentTitle('OLL-L-', 'OLL-L-');
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(callbacks).toBe(1);
  expect(observers).toHaveLength(1);
  expect(document.title).toBe('OLL-L-');
});

it('restores the remaining owner when the latest owner closes', async () => {
  useDocumentTitle('复盘', 'Reconstruction');
  useDocumentTitle('公式', 'Algorithm');
  cleanups.pop()!();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(document.title).toBe('复盘');
  cleanups.pop()!();
  expect(document.title).toBe('CubeRoot');
});

it('does not overwrite an active owner when an older owner unmounts', async () => {
  useDocumentTitle('旧页面', 'Old page');
  useDocumentTitle('新页面', 'New page');
  cleanups.shift()!();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(document.title).toBe('新页面');
});

it('repairs delayed metadata and can mount again after all owners unmount', async () => {
  useDocumentTitle('复盘', 'Reconstruction');
  document.title = 'Delayed metadata';
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(document.title).toBe('复盘');
  cleanups.pop()!();
  useDocumentTitle('公式', 'Algorithm');
  document.title = 'Delayed metadata';
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(document.title).toBe('公式');
});

it('keeps the host title and registers no title cleanup for an embedded case', async () => {
  useDocumentTitle('复盘', 'Reconstruction');
  useDocumentTitle('OLL-L-', 'OLL-L-', false);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(document.title).toBe('复盘');
  expect(cleanups).toHaveLength(1);
  const view = readFileSync('app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView.tsx', 'utf8');
  const dialog = readFileSync('components/ReconCaseLink.tsx', 'utf8');
  expect(view).toContain('useDocumentTitle(primary, primary, !embedded)');
  expect(dialog).toMatch(/<AlgCaseView\b[^>]*\bembedded\s*\/>/);
});
