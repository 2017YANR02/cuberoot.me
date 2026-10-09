// @vitest-environment jsdom

import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DisconnectReason } from 'livekit-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getVideoConfig: vi.fn(),
  getVideoToken: vi.fn(),
}));

vi.mock('@livekit/components-react', () => ({ LiveKitRoom: () => null }));


import { VideoDeniedError } from '@cuberoot/shared/video';
import { useTimerBattleVideo, type VideoRoom } from '@cuberoot/timer-ui/video/TimerBattleVideo';
const client = { getConfig: mocks.getVideoConfig, getToken: mocks.getVideoToken };

const G1 = '11111111-1111-4111-8111-111111111111';
const G2 = '22222222-2222-4222-8222-222222222222';

function Harness({ generation, report, code = '0427' }: { generation: string; code?: string; report: (video: VideoRoom) => void }) {
  const video = useTimerBattleVideo(client, code, 'player1234', 'a'.repeat(43), generation, 'en');
  useEffect(() => report(video), [report, video]);
  return null;
}

describe('battle video generation migration', () => {
  let root: Root;
  let container: HTMLDivElement;
  let current: VideoRoom;

  beforeEach(() => {
    mocks.getVideoConfig.mockReset();
    mocks.getVideoConfig.mockResolvedValue({ enabled: true, maxParticipants: 4 });
    mocks.getVideoToken.mockReset();
    mocks.getVideoToken
      .mockResolvedValueOnce({ url: 'wss://rtc.test', token: 'token-g1', room: `battle-0427-${G1}` })
      .mockResolvedValueOnce({ url: 'wss://rtc.test', token: 'token-g2', room: `battle-0427-${G2}` });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('disconnects G1, obtains G2 automatically, and ignores G1 late disconnect', async () => {
    const report = (video: VideoRoom) => { current = video; };
    await act(async () => { root.render(createElement(Harness, { generation: G1, report })); });
    await vi.waitFor(() => expect(current.enabled).toBe(true));

    await act(async () => current.toggle());
    await vi.waitFor(() => expect(current.token?.token).toBe('token-g1'));

    await act(async () => { root.render(createElement(Harness, { generation: G2, report })); });
    await vi.waitFor(() => expect(current.token?.token).toBe('token-g2'));
    expect(mocks.getVideoToken).toHaveBeenCalledTimes(2);

    await act(async () => current.leave(undefined, 'token-g1'));
    expect(current.token?.token).toBe('token-g2');
  });

  it('keeps the user intent and retries a bounded room-generation admission race', async () => {
    mocks.getVideoToken.mockReset();
    mocks.getVideoToken
      .mockRejectedValueOnce(new VideoDeniedError('changed'))
      .mockResolvedValueOnce({ url: 'wss://rtc.test', token: 'token-retry', room: `battle-0427-${G1}` });
    const report = (video: VideoRoom) => { current = video; };
    await act(async () => { root.render(createElement(Harness, { generation: G1, report })); });
    await vi.waitFor(() => expect(current.enabled).toBe(true));

    await act(async () => current.toggle());
    await vi.waitFor(() => expect(current.token?.token).toBe('token-retry'));
    expect(mocks.getVideoToken).toHaveBeenCalledTimes(2);
  });

  it('waits for membership generation after a retired room instead of looping on the same room', async () => {
    const report = (video: VideoRoom) => { current = video; };
    await act(async () => { root.render(createElement(Harness, { generation: G1, report })); });
    await vi.waitFor(() => expect(current.enabled).toBe(true));
    await act(async () => current.toggle());
    await vi.waitFor(() => expect(current.token?.token).toBe('token-g1'));

    await act(async () => current.leave(DisconnectReason.ROOM_DELETED, 'token-g1'));
    expect(current.token).toBeNull();
    expect(mocks.getVideoToken).toHaveBeenCalledTimes(1);
    await act(async () => { root.render(createElement(Harness, { generation: G2, report })); });
    await vi.waitFor(() => expect(current.token?.token).toBe('token-g2'));
    expect(mocks.getVideoToken).toHaveBeenCalledTimes(2);
  });
});


describe('battle video cancellation', () => {
  let root: Root;
  let container: HTMLDivElement;
  let current: VideoRoom;
  const report = (video: VideoRoom) => { current = video; };
  const render = (code = '0427') => act(async () => { root.render(createElement(Harness, { generation: G1, report, code })); });
  beforeEach(() => {
    mocks.getVideoConfig.mockReset().mockResolvedValue(null);
    mocks.getVideoToken.mockReset();
    container = document.createElement('div'); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); });

  it('requires a click, allows cancelling a pending request, and ignores a late token', async () => {
    let resolve!: (value: unknown) => void;
    mocks.getVideoToken.mockImplementation(() => new Promise(done => { resolve = done; }));
    await render();
    expect(mocks.getVideoToken).not.toHaveBeenCalled();
    expect(current.enabled).toBe(true);
    await act(async () => current.toggle());
    expect(current.busy).toBe(true);
    const signal = mocks.getVideoToken.mock.calls[0][3] as AbortSignal;
    await act(async () => current.toggle());
    expect(signal.aborted).toBe(true);
    await act(async () => resolve({ token: 'late' }));
    expect(current.token).toBeNull();
    expect(current.busy).toBe(false);
  });

  it('forgets consent after changing room and does not restore it when returning', async () => {
    mocks.getVideoToken.mockResolvedValue({ token: 'first' });
    await render(); await act(async () => current.toggle());
    expect(current.token?.token).toBe('first');
    const old = current;
    await render('1234');
    expect(current.token).toBeNull();
    await act(async () => old.fail('media', 'first'));
    expect(current.err).toBeNull();
    await render(); expect(current.token).toBeNull();
    expect(mocks.getVideoToken).toHaveBeenCalledTimes(1);
  });

  it('stops on background and requires another click on return', async () => {
    mocks.getVideoToken.mockResolvedValue({ token: 'first' });
    await render(); await act(async () => current.toggle());
    await act(async () => window.dispatchEvent(new Event('pagehide')));
    expect(current.token).toBeNull(); expect(current.wanted).toBe(false);
    await render(); expect(mocks.getVideoToken).toHaveBeenCalledTimes(1);
  });

  it('does not restart media when a delayed enabled config arrives', async () => {
    let resolve!: (value: unknown) => void;
    mocks.getVideoConfig.mockImplementation(() => new Promise(done => { resolve = done; }));
    mocks.getVideoToken.mockResolvedValue({ token: 'first' });
    await render(); await act(async () => current.toggle());
    expect(current.token?.token).toBe('first');
    await act(async () => resolve({ enabled: true, maxParticipants: 4 }));
    expect(current.token?.token).toBe('first');
    expect(mocks.getVideoToken).toHaveBeenCalledTimes(1);
  });

  it('allows explicit retry after failure without automatically hammering admission', async () => {
    mocks.getVideoToken.mockRejectedValueOnce(new VideoDeniedError('bandwidth')).mockResolvedValue({ token: 'retry' });
    await render(); await act(async () => current.toggle());
    expect(current.err).toContain('capacity'); expect(current.token).toBeNull();
    expect(mocks.getVideoToken).toHaveBeenCalledTimes(1);
    await act(async () => current.toggle()); expect(current.token?.token).toBe('retry');
  });
});
