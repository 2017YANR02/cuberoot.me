import { resolve } from 'node:path';

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
