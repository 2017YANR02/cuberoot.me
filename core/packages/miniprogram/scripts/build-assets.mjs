import { resolve } from 'node:path';

export const BUILD_ASSETS = [
  {
    source: resolve(
      import.meta.dirname,
      '..',
      '..',
      'client',
      'public',
      'icons',
      'icon-512.png',
    ),
    output: 'assets/share-cover.png',
  },
];
