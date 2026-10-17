// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import SmartCubeRow from '@/app/[lang]/alg/_trainer/SmartCubeRow';
import type { TrainerCubeState } from '@/app/[lang]/alg/_trainer/useTrainerCube';

vi.mock('@/lib/bluetooth', () => ({ detectBluetoothEnv: () => 'available', envAdvice: () => null }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));

it('keeps one Bluetooth trigger available before settings open and retains the MAC prompt across settings toggles', async () => {
  const host = document.createElement('div');
  const toolbar = document.createElement('div');
  const settings = document.createElement('div');
  document.body.append(host, toolbar, settings);
  const root = createRoot(host);
  const connect = vi.fn(async () => {});
  const onSettingsRequested = vi.fn();
  const submitMac = vi.fn();
  const state = {
    cube: { status: { connected: false, battery: null } },
    connect, submitMac, cancelMac: vi.fn(), practiceMode: 'virtual', setPracticeMode: vi.fn(),
    reason: 'no-case', macPrompt: { deviceName: 'GAN', isWrongKey: false },
  } as unknown as TrainerCubeState;
  const render = (settingsPortal: HTMLElement | null) => root.render(createElement(SmartCubeRow, {
    enabled: false, onEnabledChange: vi.fn(), supported: true, state,
    devicePortal: toolbar, settingsPortal, onSettingsRequested,
  }));
  try {
    await act(async () => render(null));
    expect(toolbar.querySelectorAll('button')).toHaveLength(1);
    expect(settings.querySelector('input')).toBeNull();
    await act(async () => toolbar.querySelector('button')!.click());
    expect(connect).toHaveBeenCalledOnce();
    expect(onSettingsRequested).toHaveBeenCalledOnce();
    await act(async () => render(settings));
    const input = settings.querySelector<HTMLInputElement>('input')!;
    expect(input).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'AB:CD:EF:12:34:56');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => render(null));
    expect(toolbar.querySelectorAll('button')).toHaveLength(1);
    await act(async () => render(settings));
    const restored = settings.querySelector<HTMLInputElement>('input')!;
    expect(restored.value).toBe('AB:CD:EF:12:34:56');
    await act(async () => restored.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(submitMac).toHaveBeenCalledWith('AB:CD:EF:12:34:56');
    expect(settings.querySelector('.shell-device-center')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    expect(toolbar.childElementCount).toBe(0);
    host.remove(); toolbar.remove(); settings.remove();
  }
});
