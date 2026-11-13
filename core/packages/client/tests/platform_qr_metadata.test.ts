// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { PlatformActionResult, PlatformEntity } from '@/lib/platform-types';

const mocks = vi.hoisted(() => ({ loadCard: vi.fn(), t: (zh: string) => zh }));
vi.mock('@/hooks/useT', () => ({ useT: () => mocks.t }));
vi.mock('@/components/AppLink', () => ({ default: () => null }));
vi.mock('@/lib/platform-qr-card', () => ({ getPlatformQrCard: mocks.loadCard }));
import { PlatformQrMetadataEditor } from '@/components/platform/PlatformQrMetadataEditor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const entity = (label: string): PlatformEntity => ({ id: 'qr-fixture', title: label, data: { code: 'qr-fixture', label, type: 'redirect', targetKind: 'internal_path', targetValue: '/' } });
const edit = async (host: HTMLElement, label: string, value: string) => {
  const input = Array.from(host.querySelectorAll('label')).find(node => node.querySelector('span')?.textContent === label)!.querySelector('input,textarea')!;
  const prototype = input instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

it.each(['后来编辑', '原名称'])('preserves the newer draft "%s" during a QR save and blocks a stale print snapshot', async latest => {
  const host = document.createElement('div');
  const root = createRoot(host);
  const saveRef = { current: null as null | (() => Promise<boolean>) };
  let finish!: (result: PlatformActionResult) => void;
  const runAction = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ id: 'qr-fixture' });
  const render = (item: PlatformEntity) => root.render(createElement(PlatformQrMetadataEditor, { entity: item, resourceId: item.id, busy: null, runAction, saveRef }));
  try {
    await act(async () => render(entity('原名称')));
    await edit(host, '内部名称', '保存名称');
    let pending!: Promise<boolean>;
    await act(async () => { pending = saveRef.current!(); });
    expect(runAction.mock.calls[0][1].label).toBe('保存名称');
    await edit(host, '内部名称', latest);
    await act(async () => { render(entity('保存名称')); finish({ id: 'qr-fixture' }); await pending; });
    const input = Array.from(host.querySelectorAll('label')).find(node => node.querySelector('span')?.textContent === '内部名称')!.querySelector('input')!;
    expect(input.value).toBe(latest);
    expect(await pending).toBe(false);
    await act(async () => { expect(await saveRef.current!()).toBe(true); });
    expect(runAction.mock.calls[1][1].label).toBe(latest);
  } finally { await act(async () => root.unmount()); }
});

it('does not start a metadata mutation after its draft was unmounted during card loading', async () => {
  const host = document.createElement('div');
  const root = createRoot(host);
  const saveRef = { current: null as null | (() => Promise<boolean>) };
  let finish!: (value: unknown) => void;
  mocks.loadCard.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const runAction = vi.fn();
  await act(async () => root.render(createElement(PlatformQrMetadataEditor, { entity: entity('原名称'), resourceId: 'qr-fixture', busy: null, runAction, saveRef })));
  await edit(host, '落地页介绍与卡片背面副文案', '新介绍');
  let pending!: Promise<boolean>;
  await act(async () => { pending = saveRef.current!(); });
  await act(async () => root.unmount());
  await act(async () => { finish({ card: { intro: '', term: '' } }); await pending; });
  expect(runAction).not.toHaveBeenCalled();
  expect(await pending).toBe(false);
});
