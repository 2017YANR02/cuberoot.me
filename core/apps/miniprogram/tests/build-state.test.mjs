import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

import {
  buildGraphInputFiles,
  buildInputFingerprint,
  collectBuildInputFiles,
  collectExternalGraphWatchFiles,
  normalizedRelativePath,
  restoreBuildGraphInputs,
  serializeBuildGraphInputs,
} from '../scripts/build-state.mjs';

const packageRoot = resolve(import.meta.dirname, '..');
let resolvedGraphPromise;

function normalizedPaths(files) {
  return files.map((file) => normalizedRelativePath(packageRoot, file));
}

function resolvedSmartCubeGraph() {
  resolvedGraphPromise ??= build({
    absWorkingDir: packageRoot,
    bundle: true,
    entryPoints: ['src/pages/smart-cube/index.ts'],
    format: 'iife',
    logLevel: 'silent',
    metafile: true,
    outdir: '.tmp/test-build-graph-output',
    platform: 'browser',
    target: 'chrome91',
    write: false,
  }).then((result) => buildGraphInputFiles(packageRoot, result.metafile));
  return resolvedGraphPromise;
}

function externalRelayInput(graphInputFiles) {
  const matches = graphInputFiles.filter((file) => {
    const path = normalizedRelativePath(packageRoot, file);
    return path.startsWith('../') && path.endsWith('/relay.ts');
  });
  expect(matches).toHaveLength(1);
  return matches[0];
}

describe('mini program build graph state', () => {
  it('derives cross-package inputs from the esbuild metafile', async () => {
    const graphInputFiles = await resolvedSmartCubeGraph();
    const paths = normalizedPaths(graphInputFiles);

    expect(normalizedRelativePath(packageRoot, externalRelayInput(graphInputFiles)))
      .toMatch(/^(?:\.\.\/)+(?:[^/]+\/)+src\/.+\/relay\.ts$/);
    expect(paths).toContain('src/pages/smart-cube/index.ts');
    expect(paths.every((path) => !path.startsWith('dist/'))).toBe(true);

    const [buildSource, stateSource] = await Promise.all([
      readFile(resolve(packageRoot, 'scripts', 'build.mjs'), 'utf8'),
      readFile(resolve(packageRoot, 'scripts', 'build-state.mjs'), 'utf8'),
    ]);
    const productionBuildSources = `${buildSource}\n${stateSource}`;
    expect(productionBuildSources).not.toContain('sharedSmartCubeSourceRoot');
    expect(productionBuildSources).not.toContain('smart_cube');
  });

  it('fingerprints and watches every resolved external input generically', async () => {
    const firstGraph = await resolvedSmartCubeGraph();
    const externalInput = externalRelayInput(firstGraph);
    const futureExternalInput = resolve(
      externalInput,
      '..',
      '..',
      'comp_schedule.ts',
    );
    const expandedGraph = [...firstGraph, futureExternalInput];

    expect(await buildInputFingerprint(packageRoot, expandedGraph)).not.toBe(
      await buildInputFingerprint(packageRoot, firstGraph),
    );

    const watchPaths = normalizedPaths(
      await collectExternalGraphWatchFiles(packageRoot, expandedGraph),
    );
    expect(watchPaths).toContain(normalizedRelativePath(packageRoot, externalInput));
    expect(watchPaths).toContain(normalizedRelativePath(packageRoot, futureExternalInput));
    expect(watchPaths.some((path) => (
      path.startsWith('../') && path.endsWith('/package.json')
    ))).toBe(true);
    expect(watchPaths.some((path) => path.startsWith('src/'))).toBe(false);

    const allBuildInputs = normalizedPaths(
      await collectBuildInputFiles(packageRoot, expandedGraph),
    );
    expect(allBuildInputs).toEqual(expect.arrayContaining(watchPaths));
  }, 15_000);

  it('stores normalized relative paths and restores the same graph', async () => {
    const externalInput = externalRelayInput(await resolvedSmartCubeGraph());
    const externalPath = normalizedRelativePath(packageRoot, externalInput);
    const graphInputFiles = [externalInput, resolve(packageRoot, 'src', 'app.ts')];
    const storedInputs = serializeBuildGraphInputs(packageRoot, graphInputFiles);

    expect(storedInputs).toEqual([
      externalPath,
      'src/app.ts',
    ]);
    expect(storedInputs.every((path) => !path.includes('\\'))).toBe(true);
    expect(normalizedPaths(restoreBuildGraphInputs(packageRoot, storedInputs)))
      .toEqual(storedInputs);
    expect(() => restoreBuildGraphInputs(packageRoot, ['src\\app.ts']))
      .toThrow('not normalized');
  });

  it('rejects virtual, out-of-workspace, and generated build inputs', async () => {
    const externalPackageRoot = dirname(dirname(dirname(
      externalRelayInput(await resolvedSmartCubeGraph()),
    )));
    const externalGeneratedInput = (directory) => normalizedRelativePath(
      packageRoot,
      resolve(externalPackageRoot, directory, 'auth', 'web_session.js'),
    );

    expect(() => buildGraphInputFiles(packageRoot, { inputs: { '<stdin>': {} } }))
      .toThrow('not file-backed');
    expect(() => buildGraphInputFiles(packageRoot, { inputs: { '../../../AGENTS.md': {} } }))
      .toThrow('outside the core workspace');
    expect(() => buildGraphInputFiles(packageRoot, { inputs: { 'dist/app.js': {} } }))
      .toThrow('generated output');
    expect(() => buildGraphInputFiles(packageRoot, {
      inputs: { '.tmp/dist-next/app.js': {} },
    })).toThrow('generated output');
    expect(() => buildGraphInputFiles(packageRoot, {
      inputs: { [externalGeneratedInput('dist')]: {} },
    })).toThrow('generated output');
    expect(() => buildGraphInputFiles(packageRoot, {
      inputs: { [externalGeneratedInput('.tmp')]: {} },
    })).toThrow('generated output');
  });
});
