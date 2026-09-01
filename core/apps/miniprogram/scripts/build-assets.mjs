import { resolve } from 'node:path';

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
];
