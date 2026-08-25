import { resolve } from 'node:path';

export const BUILD_ASSETS = [
  {
    source: resolve(
      import.meta.dirname,
      '..',
      '..',
      '..',
      'assets',
      'brand',
      'icon-512.png',
    ),
    output: 'assets/share-cover.png',
  },
];
