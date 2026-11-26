import { expect, it, vi } from 'vitest';
import { readAssistantBatch, withAssistantSourceSlot } from '../src/utils/site_assistant_execution.js';

it('refills an idle slot, retains partial failures and returns results in input order', async () => {
  const slow = Promise.withResolvers<string>();
  const lastStarted = Promise.withResolvers<void>();
  const pending = readAssistantBatch([0, 1, 2], 2, async index => {
    if (index === 0) return slow.promise;
    if (index === 1) throw Error('source failed');
    lastStarted.resolve();
    return 'third';
  });
  await lastStarted.promise;
  slow.resolve('first');
  expect(await pending).toEqual([
    {status: 'fulfilled', value: 'first'},
    {status: 'rejected', reason: Error('source failed')},
    {status: 'fulfilled', value: 'third'},
  ]);
});

it('bounds same-origin reads across requests and skips a cancelled waiter', async () => {
  const release = Promise.withResolvers<void>();
  const signal = new AbortController().signal;
  const slots = Array.from({length: 8}, () => withAssistantSourceSlot('https://one.test', signal, () => release.promise));
  const stop = new AbortController();
  const cancelled = vi.fn(async () => 'unexpected');
  const waiting = withAssistantSourceSlot('https://one.test', stop.signal, cancelled);
  const next = vi.fn(async () => 'done');
  const resumed = withAssistantSourceSlot('https://one.test', signal, next);
  try {
    await expect(withAssistantSourceSlot('https://two.test', signal, async () => 'independent')).resolves.toBe('independent');
    expect(next).not.toHaveBeenCalled();
    stop.abort();
    await expect(waiting).rejects.toMatchObject({name: 'AbortError'});
  } finally {
    release.resolve();
    await Promise.all(slots);
  }
  expect(await resumed).toBe('done');
  expect(cancelled).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalledTimes(1);
});
