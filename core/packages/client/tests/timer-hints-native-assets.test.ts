import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { transpileModule, ScriptTarget } from 'typescript';
import { workspaceFixturePath } from './workspace-fixture-path';

const source = readFileSync(workspaceFixturePath('@cuberoot/harmony', 'entry', 'src', 'main', 'ets', 'web', 'RawfileResponder.ets'), 'utf8');
const functions = source.slice(source.indexOf('const APP_PREFIX'), source.indexOf('function finishError'));
const js = transpileModule(functions, { compilerOptions: { target: ScriptTarget.ES2022 } }).outputText;
const rawfilePath = new Function(`${js}; return rawfilePath;`)() as (url: string) => string | null;

describe('Harmony packaged hint worker routing', () => {
  it.each([
    ['https://localhost/tools/cstimer-scramble/scrambler.worker.js', 'app/tools/cstimer-scramble/scrambler.worker.js'],
    ['https://localhost/tools/cstimer-scramble/lib/mathlib.js?v=1', 'app/tools/cstimer-scramble/lib/mathlib.js'],
    ['https://localhost/tools/solver/rust-cross/cross_solver_bg.wasm', 'app/tools/solver/rust-cross/cross_solver_bg.wasm'],
    ['https://localhost/tools/cstimer-scramble/%2e%2e/secret', ''],
    ['https://localhost/tools/cstimer-scramble/lib%2f..%2fsecret', ''],
    ['https://localhost/tools/cstimer-scramble/%5csecret', ''],
    ['https://localhost.evil/tools/cstimer-scramble/a.js', null],
    ['https://localhost/tools/unregistered/a.js', null],
  ])('routes or rejects %s without escaping packaged assets', (url, expected) => {
    expect(rawfilePath(url)).toBe(expected);
  });
});
