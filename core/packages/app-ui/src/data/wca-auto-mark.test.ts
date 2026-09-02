import { describe, expect, it, vi } from 'vitest';

import { timerWcaCompetitionScrambleSlotIdentity, type Solve } from '@cuberoot/shared/timer';

import {
  autoMarkSavedWcaSolve,
  wcaAutoMarkLiveSession,
  wcaAutoMarkOwnerKey,
} from './wca-auto-mark';

const solve: Omit<Solve, 'id' | 'ts'> = {
  event: '333',
  penalty: 'ok',
  scramble: "R U R'",
  scrambleSource: {
    kind: 'wca',
    identity: timerWcaCompetitionScrambleSlotIdentity({
      competitionId: 'Example2026',
      eventId: '333',
      groupId: 'A',
      isExtra: false,
      roundTypeId: '1',
      scrambleNumber: 2,
    }),
  },
  timeMs: 12_340,
};

const session = {
  token: 'header.payload.signature',
  user: {
    avatar: '',
    avatarPreset: null,
    avatarSource: 'auto' as const,
    name: 'Test Cuber',
    uid: 7,
    wcaId: '2017TEST01',
  },
};

describe('installed timer WCA auto-mark boundary', () => {
  it('does not post after a failed save and posts once after the pending retry succeeds', async () => {
    const repository = {
      addSolve: vi.fn()
        .mockRejectedValueOnce(new Error('write failed'))
        .mockResolvedValueOnce(undefined),
    };
    const loadMarks = vi.fn().mockResolvedValue({ count: 1, marks: [] });
    const postMark = vi.fn().mockResolvedValue(undefined);
    const updateMark = vi.fn();
    const ownerAtSaveStart = wcaAutoMarkOwnerKey(session);
    const markAfterSave = () => autoMarkSavedWcaSolve(solve, ownerAtSaveStart, session, true, {
      loadMarks,
      postMark,
      updateMark,
    });

    await expect(repository.addSolve(solve).then(markAfterSave)).rejects.toThrow('write failed');
    expect(postMark).not.toHaveBeenCalled();

    await expect(repository.addSolve(solve).then(markAfterSave)).resolves.toBe(true);
    expect(postMark).toHaveBeenCalledOnce();
    expect(postMark).toHaveBeenCalledWith(expect.objectContaining({
      ci: 'Example2026',
      e: '333',
      g: 'A',
      n: 2,
      r: '1',
      x: 0,
    }), { country: '', timeCs: 1_234 }, session.token);
    expect(loadMarks).toHaveBeenCalledOnce();
    expect(loadMarks).toHaveBeenCalledWith(expect.any(Object), true);
    expect(updateMark).not.toHaveBeenCalled();
  });

  it('does not mark when logout completes before a deferred durable save', async () => {
    let finishSave!: () => void;
    const addSolve = vi.fn(() => new Promise<void>((resolve) => { finishSave = resolve; }));
    const postMark = vi.fn();
    let liveSession: typeof session | null = session;
    const ownerAtSaveStart = wcaAutoMarkOwnerKey(liveSession);
    const saved = addSolve().then(() => autoMarkSavedWcaSolve(
      solve,
      ownerAtSaveStart,
      liveSession,
      true,
      { loadMarks: vi.fn(), postMark, updateMark: vi.fn() },
    ));

    liveSession = null;
    finishSave();

    await expect(saved).resolves.toBe(false);
    expect(postMark).not.toHaveBeenCalled();
  });

  it('does not mark another account when switching before a pending retry starts', async () => {
    let finishRetry!: () => void;
    const addSolve = vi.fn(() => new Promise<void>((resolve) => { finishRetry = resolve; }));
    const postMark = vi.fn();
    const pending = { ownerAtSaveStart: wcaAutoMarkOwnerKey(session), solve };
    const liveSession = {
      ...session,
      token: 'other.header.signature',
      user: { ...session.user, uid: 8, wcaId: '2018OTHR01' },
    };
    const saved = addSolve().then(() => autoMarkSavedWcaSolve(
      pending.solve,
      pending.ownerAtSaveStart,
      liveSession,
      true,
      { loadMarks: vi.fn(), postMark, updateMark: vi.fn() },
    ));

    finishRetry();

    await expect(saved).resolves.toBe(false);
    expect(postMark).not.toHaveBeenCalled();
  });

  it('does not mark a signed-out pending solve after login before retry', async () => {
    let finishRetry!: () => void;
    const addSolve = vi.fn(() => new Promise<void>((resolve) => { finishRetry = resolve; }));
    const postMark = vi.fn();
    const pending = { ownerAtSaveStart: wcaAutoMarkOwnerKey(null), solve };
    const saved = addSolve().then(() => autoMarkSavedWcaSolve(
      pending.solve,
      pending.ownerAtSaveStart,
      session,
      true,
      { loadMarks: vi.fn(), postMark, updateMark: vi.fn() },
    ));

    finishRetry();

    await expect(saved).resolves.toBe(false);
    expect(postMark).not.toHaveBeenCalled();
  });

  it('uses a refreshed live token when the pending owner is unchanged', async () => {
    let finishSave!: () => void;
    const addSolve = vi.fn(() => new Promise<void>((resolve) => { finishSave = resolve; }));
    const postMark = vi.fn().mockResolvedValue(undefined);
    let liveSession = session;
    const pending = { ownerAtSaveStart: wcaAutoMarkOwnerKey(liveSession), solve };
    const saved = addSolve().then(() => autoMarkSavedWcaSolve(
      pending.solve,
      pending.ownerAtSaveStart,
      liveSession,
      true,
      {
        loadMarks: vi.fn().mockResolvedValue({ count: 1, marks: [] }),
        postMark,
        updateMark: vi.fn(),
      },
    ));

    liveSession = { ...session, token: 'refreshed.header.signature' };
    finishSave();

    await expect(saved).resolves.toBe(true);
    expect(postMark).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      'refreshed.header.signature',
    );
  });

  it('treats an old rendered session as signed out while auth is busy', async () => {
    let finishSave!: () => void;
    const addSolve = vi.fn(() => new Promise<void>((resolve) => { finishSave = resolve; }));
    const postMark = vi.fn();
    const ownerAtSaveStart = wcaAutoMarkOwnerKey(session);
    let authBusy = false;
    const saved = addSolve().then(() => autoMarkSavedWcaSolve(
      solve,
      ownerAtSaveStart,
      wcaAutoMarkLiveSession(session, authBusy),
      true,
      { loadMarks: vi.fn(), postMark, updateMark: vi.fn() },
    ));

    authBusy = true;
    finishSave();

    await expect(saved).resolves.toBe(false);
    expect(postMark).not.toHaveBeenCalled();
  });

  it.each(['DNF', 'DNS'] as const)('does not post a %s solve', async (penalty) => {
    const postMark = vi.fn();
    await expect(autoMarkSavedWcaSolve({ ...solve, penalty }, wcaAutoMarkOwnerKey(session), session, true, {
      loadMarks: vi.fn(),
      postMark,
      updateMark: vi.fn(),
    })).resolves.toBe(false);
    expect(postMark).not.toHaveBeenCalled();
  });

  it('does not read or post marks for a signed-out solve', async () => {
    const loadMarks = vi.fn();
    const postMark = vi.fn();
    await expect(autoMarkSavedWcaSolve(solve, '', null, true, {
      loadMarks,
      postMark,
      updateMark: vi.fn(),
    })).resolves.toBe(false);
    expect(loadMarks).not.toHaveBeenCalled();
    expect(postMark).not.toHaveBeenCalled();
  });

  it('rejects a malformed persisted WCA slot without making a request', async () => {
    const postMark = vi.fn();
    await expect(autoMarkSavedWcaSolve({
      ...solve,
      scrambleSource: { kind: 'wca', identity: '["truncated"]' },
    }, wcaAutoMarkOwnerKey(session), session, true, {
      loadMarks: vi.fn(),
      postMark,
      updateMark: vi.fn(),
    })).resolves.toBe(false);
    expect(postMark).not.toHaveBeenCalled();
  });

  it('uses authenticated update-only when auto-mark is disabled', async () => {
    const postMark = vi.fn();
    const updateMark = vi.fn().mockResolvedValue(true);
    const loadMarks = vi.fn().mockResolvedValue({ count: 1, marks: [] });

    await expect(autoMarkSavedWcaSolve(solve, wcaAutoMarkOwnerKey(session), session, false, {
      loadMarks,
      postMark,
      updateMark,
    })).resolves.toBe(true);
    expect(postMark).not.toHaveBeenCalled();
    expect(updateMark).toHaveBeenCalledOnce();
    expect(updateMark).toHaveBeenCalledWith(
      expect.any(Object),
      { country: '', timeCs: 1_234 },
      session.token,
    );
    expect(loadMarks).toHaveBeenCalledOnce();
    expect(loadMarks).toHaveBeenCalledWith(expect.any(Object), true);
  });

  it('does not create a mark while disabled when the user has no existing mark', async () => {
    const postMark = vi.fn();
    const updateMark = vi.fn().mockResolvedValue(false);
    const loadMarks = vi.fn();
    await expect(autoMarkSavedWcaSolve(solve, wcaAutoMarkOwnerKey(session), session, false, {
      loadMarks,
      postMark,
      updateMark,
    })).resolves.toBe(false);
    expect(updateMark).toHaveBeenCalledOnce();
    expect(loadMarks).not.toHaveBeenCalled();
    expect(postMark).not.toHaveBeenCalled();
  });
});
