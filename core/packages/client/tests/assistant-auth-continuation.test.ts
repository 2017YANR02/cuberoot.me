import { describe, expect, it } from 'vitest';
import { canUseAssistant, createAssistantAuthContinuation } from '@/lib/assistant-auth-continuation';

const input = { id: 'd88596d2-996c-4d41-9882-daf0730f06e9', text: '  帮我复盘这场比赛  ', returnTo: '/zh?view=all#results', scrollY: 640, uid: null };
function fixture() {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  let time = 1000;
  const fresh = () => createAssistantAuthContinuation(() => storage, () => time);
  return { store: fresh(), fresh, values, advance: () => { time += 2 * 60 * 60 * 1000; } };
}

describe('assistant sign-in continuation', () => {
  it('ordinary sign-in restores the exact draft and location without sending', () => {
    const { store, fresh } = fixture();
    expect(store.save(input)).toBe(true);
    expect(fresh().read()).toMatchObject(input);
    expect(store.takeReturn(input.returnTo, 10)).toBeNull();
    expect(store.complete(input.returnTo, 10)).toBe(true);
    expect(fresh().takeReturn(input.returnTo, 10)).toMatchObject({ ...input, uid: 10, send: false });
  });
  it('requires completion and the original account/page, and consumes send intent before dispatch', () => {
    const { store, fresh } = fixture();
    store.save(input, true);
    expect(store.takeReturn(input.returnTo, 10)).toBeNull();
    expect(store.complete('/zh/elsewhere', 10)).toBe(false);
    store.complete(input.returnTo, 10);
    expect(store.takeReturn(input.returnTo, 11)).toBeNull();
    expect(store.takeReturn('/zh', 10)).toBeNull();
    expect(store.takeReturn(input.returnTo, 10)).toMatchObject({ send: true, text: input.text });
    expect(fresh().takeReturn(input.returnTo, 10)).toMatchObject({ send: false, text: input.text });
    expect(store.complete(input.returnTo, 11)).toBe(false);
  });
  it('editing or returning from cancelled login disarms sending; deleting the draft removes it', () => {
    const { store } = fixture();
    store.save(input, true);
    store.save({ ...input, text: 'Edited draft' });
    store.complete(input.returnTo, 10);
    expect(store.takeReturn(input.returnTo, 10)).toMatchObject({ text: 'Edited draft', send: false });
    store.save({ ...input, text: '' });
    expect(store.read()).toBeNull();
  });
  it('keeps WCA binding required and re-arms only an explicit binding-and-send action', () => {
    const { store } = fixture();
    store.save(input, true);
    store.complete(input.returnTo, 10);
    const returned = store.takeReturn(input.returnTo, 10)!;
    expect(canUseAssistant({ wcaId: '' })).toBe(false);
    expect(canUseAssistant({ wcaId: 'bad' })).toBe(false);
    expect(canUseAssistant({ wcaId: '2020TEST01' })).toBe(true);
    store.save({ ...returned, uid: 10 }, true);
    expect(store.complete(input.returnTo, 11)).toBe(false);
    store.complete(input.returnTo, 10);
    expect(store.takeReturn(input.returnTo, 10)?.send).toBe(true);
  });
  it('keeps edits to a restored draft across reload without re-arming it', () => {
    const { store, fresh } = fixture();
    store.save(input, true);
    store.complete(input.returnTo, 10);
    const returned = store.takeReturn(input.returnTo, 10)!;
    store.save({ ...returned, text: 'Changed after returning' });
    expect(fresh().takeReturn(input.returnTo, 10)).toMatchObject({ text: 'Changed after returning', send: false });
  });
  it('expires drafts, rejects external destinations and cannot arm when storage fails', () => {
    const { store, advance } = fixture();
    expect(store.save({ ...input, returnTo: '//example.com' }, true)).toBe(false);
    store.save(input, true); advance();
    expect(store.read()).toBeNull();
    const unavailable = createAssistantAuthContinuation(() => { throw new Error('blocked'); });
    expect(unavailable.save(input, true)).toBe(false);
    expect(unavailable.takeReturn(input.returnTo, 10)).toBeNull();
  });
});
