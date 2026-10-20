import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { validateNativePages } from '../scripts/native-page-check.mjs';

it('rejects a web container hidden behind a native page include', async () => {
  const root = await mkdtemp(join(tmpdir(), 'native-page-check-'));
  try {
    await mkdir(join(root, 'templates'));
    await writeFile(join(root, 'index.ttml'), '<include src="templates/body.ttml" />');
    await writeFile(join(root, 'templates/body.ttml'), '<view>Native</view>');
    await expect(validateNativePages(root, ['index'])).resolves.toBeUndefined();
    await writeFile(join(root, 'templates/component.ttml'), '<web-view src="{{url}}" />');
    await expect(validateNativePages(root, ['index'])).rejects.toThrow('contains web-view');
    await writeFile(join(root, 'templates/component.ttml'), '<view>Native component</view>');
    await writeFile(join(root, 'templates/body.ttml'), '<web-view src="{{url}}" />');
    await expect(validateNativePages(root, ['index'])).rejects.toThrow('contains web-view');
    await writeFile(join(root, 'templates/body.ttml'), '<include src="../../outside.ttml" />');
    await expect(validateNativePages(root, ['index'])).rejects.toThrow('escapes bundle');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
