// @vitest-environment jsdom

import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DisconnectReason } from 'livekit-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getVideoConfig: vi.fn(),
  getVideoToken: vi.fn(),
}));

vi.mock('@/lib/video-room-api', () => ({
  VIDEO_MAX_BITRATE: 3_000_000,
  SCREEN_SHARE_MAX_BITRATE: 1_500_000,
  VideoDeniedError: class extends Error {
    constructor(readonly reason: string) { super(reason); }
  },
  getVideoConfig: mocks.getVideoConfig,
  getVideoToken: mocks.getVideoToken,
}));
vi.mock('@livekit/components-react', () => ({ LiveKitRoom: () => null }));
vi.mock('@/components/video/VideoTiles', () => ({ default: () => null }));

import { VideoDeniedError } from '@/lib/video-room-api';
import { useVideoRoom, type VideoRoom } from '@/app/[lang]/timer/_battle/VideoStrip';

const G1 = '11111111-1111-4111-8111-111111111111';
const G2 = '22222222-2222-4222-8222-222222222222';

function Harness({ generation, report }: { generation: string; report: (video: VideoRoom) => void }) {
  const video = useVideoRoom('0427', 'player1234', 'a'.repeat(43), generation);
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

  it('reconnects an authorized member after the server retires the old room, without waiting for polling', async () => {
    const report = (video: VideoRoom) => { current = video; };
    await act(async () => { root.render(createElement(Harness, { generation: G1, report })); });
    await vi.waitFor(() => expect(current.enabled).toBe(true));
    await act(async () => current.toggle());
    await vi.waitFor(() => expect(current.token?.token).toBe('token-g1'));

    await act(async () => current.leave(DisconnectReason.ROOM_DELETED, 'token-g1'));
    await vi.waitFor(() => expect(current.token?.token).toBe('token-g2'));
    expect(mocks.getVideoToken).toHaveBeenCalledTimes(2);
  });
});
