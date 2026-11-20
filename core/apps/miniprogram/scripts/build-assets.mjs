import { resolve } from 'node:path';
import { TIMER_INSPECTION_VOICE_COPY, TIMER_INSPECTION_VOICE_PHRASES } from '@cuberoot/shared/timer/sound-feedback';

const contactAssetNames = [
  'author.png',
  'bilibili.png',
  'discord.png',
  'douyin.png',
  'email.png',
  'instagram.png',
  'kuaishou.png',
  'qq.png',
  'qr.png',
  'ruimin-wechat-qr.jpg',
  'tiktok.png',
  'wechat.png',
  'xiaohongshu.png',
  'youtube.png',
];

export const BUILD_ASSETS = [
  {
    source: resolve(
      import.meta.dirname,
      '..',
      '..',
      '..',
      'assets',
      'brand',
      'icon-192.png',
    ),
    output: 'assets/cuberoot-logo.png',
  },
  {
    source: resolve(
      import.meta.dirname,
      '..',
      'assets',
      'share-cover.png',
    ),
    output: 'assets/share-cover.png',
  },
  ...contactAssetNames.map((name) => ({
    source: resolve(import.meta.dirname, '..', 'assets', 'contact', name),
    output: `assets/contact/${name}`,
  })),
];

export const DOUYIN_TIMER_VOICE_ASSETS = Object.keys(TIMER_INSPECTION_VOICE_COPY)
  .filter((voice) => voice !== 'none')
  .flatMap((voice) => Object.keys(TIMER_INSPECTION_VOICE_PHRASES).map((cue) => {
    const output = `assets/timer-voice/${voice}-${cue}.mp3`;
    return { source: resolve(import.meta.dirname, '..', output), output };
  }));
