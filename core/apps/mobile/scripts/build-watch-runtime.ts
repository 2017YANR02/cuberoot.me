import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { buildWatchScramble } from './build-watch-scramble.ts';
const root = fileURLToPath(new URL('..', import.meta.url));
const outfile = process.argv[2];
if (!outfile) throw new Error('A derived output path is required');
await buildWatchScramble(resolve(dirname(outfile), 'WatchScramble.js'));
await build({ entryPoints: [resolve(root, 'src/watch-cube-runtime.ts')], outfile,
  bundle: true, format: 'iife', platform: 'neutral', target: 'es2020', minify: true,
  conditions: ['import'], mainFields: ['module', 'main'], legalComments: 'inline' });
await build({ entryPoints: [resolve(root, 'src/watch-scene-runtime.ts')],
  outfile: resolve(dirname(outfile), 'WatchScene.js'), bundle: true, format: 'iife',
  platform: 'neutral', target: 'es2020', minify: true, conditions: ['import'],
  mainFields: ['module', 'main'], legalComments: 'inline' });

// QuickJS supports native private fields; downlevel WeakMaps retain large
// cubing.js analysis graphs and exceeded the bounded renderer memory budget.
await build({ entryPoints: [resolve(root, 'src/watch-replay-runtime.ts')],
  outfile: resolve(dirname(outfile), 'WatchReplay.js'), bundle: true, format: 'iife',
  platform: 'neutral', target: 'es2022', minify: true, conditions: ['import'],
  mainFields: ['module', 'main'], legalComments: 'inline' });

// The exact public AlgFiles stay on disk and are loaded by set on demand.
const directory = resolve(dirname(outfile), 'WatchAlgorithms');
await mkdir(directory, { recursive: true });
const source = 'https://api.cuberoot.me/v1/alg/sets';
const files: Record<string, any> = {};
for (const set of ['oll','pll','zbll','ollcp','1lll','coll','ell','zbls','vls','wv','sv','cmll']) {
  const target = resolve(directory, set + '.json');
  let cached: string | undefined;
  if (process.env.WATCH_REFRESH_ALGORITHMS !== '1') try { cached = await readFile(target, 'utf8'); } catch {}
  if (!cached) {
    const response = await fetch(source + '/3x3/' + set);
    if (!response.ok) throw new Error('Watch algorithm snapshot ' + set + ': ' + response.status);
    cached = await response.text();
  }
  const file = JSON.parse(cached);
  if (file.puzzle !== '3x3' || file.set !== set || !file.cases?.length) throw new Error('Invalid Watch algorithm set: ' + set);
  await writeFile(target, cached);
  files['3x3/' + set] = file;
}
const builder = resolve(dirname(outfile), 'watch-lookup-build.mjs');
await build({ entryPoints: [resolve(root, 'scripts/watch-lookup-build.ts')], outfile: builder,
  bundle: true, platform: 'node', format: 'esm', target: 'es2022' });
const version = createHash('sha256').update(await readFile(builder)).update(JSON.stringify(files)).digest('hex');
const algorithmFile = resolve(dirname(outfile), 'WatchAlgData.json');
let previous: any;
try { previous = JSON.parse(await readFile(algorithmFile, 'utf8')); } catch {}
if (previous?.version !== version) {
  const { generate } = await import(pathToFileURL(builder).href);
  await writeFile(algorithmFile, JSON.stringify({ version, source, fetchedAt: new Date().toISOString(), lookup: await generate(files) }));
}

// Persist analysis across presentation-only rebuilds. The fingerprint covers the
// complete analysis dependency graph, cache schema, native budget and offline data.
const analysisBundle=await build({stdin:{contents:`
export { runReconstructionAnalysis } from '@cuberoot/timer-ui/reconstruct/analysis-runner';
export { createReconstructionAnalyzer } from '@cuberoot/timer-ui/reconstruct/analysis-core';
export { prepareReconstruction } from '@cuberoot/shared/timer/reconstruct/recon-text';
export { detectSolveMethod } from '@cuberoot/shared/timer/reconstruct/method-walk';
export * from '@cuberoot/timer-ui/reconstruct/history-model';
`,resolveDir:root,sourcefile:'watch-analysis-fingerprint.ts'},write:false,bundle:true,format:'esm',platform:'neutral',target:'es2022',minify:true,conditions:['import'],mainFields:['module','main']});
const analysisVersion=createHash('sha256').update(analysisBundle.outputFiles[0].text)
  .update(await readFile(resolve(root,'src/watch-replay-runtime.ts'))).update(version).digest('hex');
const installedData=JSON.parse(await readFile(algorithmFile,'utf8'));
if(installedData.analysisVersion!==analysisVersion)await writeFile(algorithmFile,JSON.stringify({...installedData,analysisVersion}));
