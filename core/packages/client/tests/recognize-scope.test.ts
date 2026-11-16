// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { sessionStoreFor } from '@/lib/session-store';
import { PLL_SET } from '@/lib/recognize-sets';
import { caseToKey } from '@/lib/pll-helpers';

const store = sessionStoreFor('pll');
const state = () => store.getState();
const queueKeys = () => state().queue.map(caseToKey);

describe('PLL recognition scope', () => {
  beforeEach(() => {
    localStorage.clear();
    store.setState(store.getInitialState());
  });

  it('uses selected case/orientation pairs on initial load and restart', () => {
    expect(state().setSelectedKeys(['T/y', 'Ua/', 'T/y', 'T/invalid'])).toBe(true);
    expect(queueKeys().sort()).toEqual(['T/y', 'Ua/']);
    state().resumePlay();
    state().submitAnswer(state().currentCase()!.name);
    state().restartEvaluation();
    expect(queueKeys().sort()).toEqual(['T/y', 'Ua/']);
    store.setState({ queue: [], results: [] });
    state().setInitial();
    expect(queueKeys().sort()).toEqual(['T/y', 'Ua/']);
  });

  it('keeps personalized repetitions within the selected directions', () => {
    state().setSelectedKeys(['T/y', 'Ua/']);
    state().resumePlay();
    state().submitAnswer('wrong');
    state().submitAnswer(state().currentCase()!.name);
    state().submitAnswer(state().currentCase()!.name);
    expect(state().gameState).toBe('evaluationDone');
    state().startPersonalized();
    expect(new Set(queueKeys())).toEqual(new Set(['T/y', 'Ua/']));
    expect(state().queue.length).toBeGreaterThan(2);
  });

  it('persists scope and supports legacy sessions without a scope', async () => {
    state().setSelectedKeys(['Ga/y2']);
    const saved = localStorage.getItem(PLL_SET.storageKey)!;
    store.setState(store.getInitialState());
    localStorage.setItem(PLL_SET.storageKey, saved);
    await store.persist.rehydrate();
    expect(state().selectedKeys).toEqual(['Ga/y2']);
    state().restartEvaluation();
    expect(queueKeys()).toEqual(['Ga/y2']);

    store.setState(store.getInitialState());
    localStorage.setItem(PLL_SET.storageKey, JSON.stringify({ state: { queue: [], results: [] }, version: 0 }));
    await store.persist.rehydrate();
    state().setInitial();
    expect(state().selectedKeys).toBeNull();
    expect(new Set(queueKeys())).toEqual(new Set(PLL_SET.allKeys()));
  });

  it('rejects empty/invalid selections without discarding a running session', () => {
    state().setSelectedKeys(['T/y']);
    state().resumePlay();
    const before = state();
    expect(state().setSelectedKeys([])).toBe(false);
    expect(state().setSelectedKeys(['H/y2'])).toBe(false);
    expect(state()).toBe(before);
  });

  it('restores all orientations and leaves OLL independent', () => {
    const oll = sessionStoreFor('oll').getState();
    state().setSelectedKeys(['T/y']);
    state().setSelectedKeys(PLL_SET.allKeys());
    expect(state().selectedKeys).toBeNull();
    expect(state().queue).toHaveLength(73);
    expect(sessionStoreFor('oll').getState()).toBe(oll);
  });
});
