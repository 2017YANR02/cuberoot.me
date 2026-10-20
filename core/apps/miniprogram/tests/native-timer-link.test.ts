import { afterEach, expect, it, vi } from 'vitest';
import { parseNativeTimerLink, queueNativeTimerLink, takeNativeTimerLink, confirmNativeTimerLink } from '../src/lib/native-timer-link';
import { NativeTimer } from '../src/lib/native-timer';

afterEach(() => { vi.unstubAllGlobals(); });
it('decodes only supported event/scramble parameters, without losing duplicate or unknown options', () => {
  expect(parseNativeTimerLink('/zh/timer?event=222&scramble=R+U%27')).toEqual({ event: '222', scramble: "R U'" });
  for (const path of ['/timer?event=222&event=333', '/timer?event=333fm', '/timer?x=1', '/timer?event=%', '/timer?event=222#settings', '/timer?scramble=R%0AU', '/timer?scramble=']) {
    expect(parseNativeTimerLink(path), path).toBeNull();
  }
});
it('does not let an old navigation failure clear a newer queued link', () => {
  vi.stubGlobal('getApp', () => app);
  const app = {};
  const cancel = queueNativeTimerLink({ event: '222' });
  queueNativeTimerLink({ event: '333' });
  cancel();
  expect(takeNativeTimerLink()).toEqual({ event: '333' });
  expect(takeNativeTimerLink()).toBeUndefined();
});
it('applies shared input only after confirmation and does not create a solve', () => {
  const app = {};
  let callback!: (result: { confirm: boolean }) => void;
  vi.stubGlobal('getApp', () => app);
  vi.stubGlobal('wx', { getStorageSync: () => 'en', showModal: (options: { success: typeof callback }) => { callback = options.success; } });
  const timer = new NativeTimer({ getStorageSync: () => undefined, setStorageSync: vi.fn(), removeStorageSync: vi.fn() });
  const count = timer.records.length;
  queueNativeTimerLink({ event: '222', scramble: "R U R'" });
  confirmNativeTimerLink(timer, () => true, vi.fn());
  expect(timer.event).toBe('333');
  callback({ confirm: false });
  expect(timer.event).toBe('333');
  queueNativeTimerLink({ event: '222', scramble: "R U R'" });
  confirmNativeTimerLink(timer, () => true, vi.fn());
  callback({ confirm: true });
  expect(timer.event).toBe('222');
  expect(timer.scramble).toBe("R U R'");
  expect(timer.currentSource).toBe('manual');
  expect(timer.records).toHaveLength(count);
});
it('ignores confirmation after leaving and prevents changing a running timer', () => {
  const app = {}, timer = { busy: false, selectEvent: vi.fn(), setManualScrambles: vi.fn() };
  let callback!: (result: { confirm: boolean }) => void;
  const toast = vi.fn();
  vi.stubGlobal('getApp', () => app);
  vi.stubGlobal('wx', { getStorageSync: () => 'en', showModal: (options: { success: typeof callback }) => { callback = options.success; }, showToast: toast });
  queueNativeTimerLink({ event: '222' });
  confirmNativeTimerLink(timer, () => false, vi.fn());
  callback({ confirm: true });
  expect(timer.selectEvent).not.toHaveBeenCalled();
  queueNativeTimerLink({ event: '222' });
  confirmNativeTimerLink(timer, () => true, vi.fn());
  timer.busy = true;
  callback({ confirm: true });
  expect(timer.selectEvent).not.toHaveBeenCalled();
  expect(toast).toHaveBeenCalledOnce();
});
