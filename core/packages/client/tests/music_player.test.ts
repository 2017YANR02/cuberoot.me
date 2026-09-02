import { describe, expect, it } from 'vitest';
import { normalizeMusicManifest, parseLrc } from '@/lib/music-player';

describe('music player data', () => {
  it('keeps valid unique tracks and rejects local paths', () => {
    expect(normalizeMusicManifest({
      version: 1,
      tracks: [
        { id: ' one ', title: ' One ', artist: '', src: ' /music/library/one.m4a ' },
        { id: 'one', title: 'Duplicate', src: '/music/library/two.m4a' },
        { id: 'local', title: 'Private', src: 'E:\\Music\\private.mp3' },
        { id: 'cover', title: 'Private cover', src: '/music/cover.m4a', cover: 'file:///E:/cover.jpg' },
        { id: 'duration', title: 'Bad duration', src: '/music/duration.m4a', duration: -1 },
      ],
    }).tracks).toEqual([{
      id: 'one', title: 'One', artist: '', src: '/music/library/one.m4a',
    }]);
  });

  it('parses multiple LRC timestamps and offset', () => {
    expect(parseLrc('[offset:500]\n[00:01.20][00:03]Hello')).toEqual([
      { time: 1.7, text: 'Hello' },
      { time: 3.5, text: 'Hello' },
    ]);
  });
});
