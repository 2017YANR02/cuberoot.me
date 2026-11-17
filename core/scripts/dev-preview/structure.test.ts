import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { watchStructure } from '../next-dev.mts';
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

test('new files, nested directories, deletes and exports restart; edits and generated output do not', async () => {
  const scratch = resolve(import.meta.dirname, '../../../.tmp/scratch');
  mkdirSync(scratch, { recursive: true });
  const root = mkdtempSync(join(scratch, 'structure-'));
  mkdirSync(join(root, 'src')); mkdirSync(join(root, 'dist'));
  writeFileSync(join(root, 'package.json'), '{"exports":{}}');
  writeFileSync(join(root, 'src/existing.css'), '.before {}');
  let changes = 0;
  const errors: Error[] = [];
  const close = watchStructure(() => [root], () => changes++, e => errors.push(e), 60);
  const changed = async (expected: number) => {
    for (let i = 0; i < 50 && changes < expected; i++) await pause(20);
    assert.equal(changes, expected);
  };
  try {
    writeFileSync(join(root, 'src/existing.css'), '.edited {}');
    writeFileSync(join(root, 'src/.save'), '.atomic {}');
    renameSync(join(root, 'src/.save'), join(root, 'src/existing.css'));
    writeFileSync(join(root, 'dist/generated.js'), 'generated');
    await pause(180); assert.equal(changes, 0);
    // A burst becomes one restart, including a previously missing directory.
    mkdirSync(join(root, 'src/new'));
    writeFileSync(join(root, 'src/new/a.css'), '.a {}');
    writeFileSync(join(root, 'src/new/b.css'), '.b {}');
    await changed(1);
    writeFileSync(join(root, 'package.json'), '{"exports":{"./a.css":"./src/new/a.css"}}');
    await changed(2);
    rmSync(join(root, 'src/new/a.css')); await changed(3);
    assert.deepEqual(errors, []);
  } finally { close(); rmSync(root, { recursive: true, force: true }); }
});
