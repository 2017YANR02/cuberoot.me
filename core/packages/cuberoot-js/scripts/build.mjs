import { copyFile, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const packageDir = fileURLToPath(new URL('../', import.meta.url));
const outDir = join(packageDir, 'dist');
const renderer = import.meta.resolve('@cuberoot/puzzle-render-core/replay/mountReplayCube');
const workerClient = fileURLToPath(import.meta.resolve('@cuberoot/puzzle-render-core/engine/nxn/setup_worker_client'));
const workerEntry = fileURLToPath(import.meta.resolve('@cuberoot/puzzle-render-core/engine/nxn/setup.worker'));
const requireFromRenderer = createRequire(renderer);
const kernelAsset = requireFromRenderer.resolve('@cuberoot/stack-kernel/wasm');
const threeLicense = resolve(dirname(requireFromRenderer.resolve('three')), '../LICENSE');
const cubingDirectory = dirname(dirname(fileURLToPath(import.meta.resolve('cubing/twisty'))));
const requireFromPackage = createRequire(import.meta.url);
const requireFromReactDom = createRequire(requireFromPackage.resolve('react-dom/package.json'));
const uiLicenses = [
  ['react-MIT.txt', requireFromPackage.resolve('react/package.json')],
  ['react-dom-MIT.txt', requireFromPackage.resolve('react-dom/package.json')],
  ['scheduler-MIT.txt', requireFromReactDom.resolve('scheduler/package.json')],
  ['lucide-react.txt', requireFromPackage.resolve('lucide-react/package.json')],
];
const embeddedStyles = new Set([
  '@cuberoot/timer-ui/PlaybackBar.css',
  '@cuberoot/timer-ui/PlaybackScrubber.css',
].map(specifier => fileURLToPath(import.meta.resolve(specifier))));

// esbuild doesn't compile the Worker constructor's URL. Emit the Worker as
// its own entry and point the constructor at the generated sibling file.
const workerUrlPlugin = {
  name: 'replay-setup-worker-url',
  setup(context) {
    context.onLoad({ filter: /setup_worker_client\.ts$/ }, async ({ path }) => {
      if (path !== workerClient) return;
      const source = await readFile(path, 'utf8');
      if (!source.includes("'./setup.worker.ts'")) {
        throw new Error('The replay setup worker URL needs to be updated for the standalone build');
      }
      return { contents: source.replace("'./setup.worker.ts'", "'./setup.worker.js'"), loader: 'ts' };
    });
  },
};

// cubing.js registers its renderer's custom elements on import. Keep our
// bundled copy in its own namespace so it can run next to an upstream player.
const cubingElementNames = [
  'twisty-2d-puzzle', 'twisty-2d-scene-wrapper', 'twisty-3d-scene-wrapper',
  'twisty-3d-vantage', 'twisty-alg-editor', 'twisty-alg-leaf-elem',
  'twisty-alg-viewer', 'twisty-alg-wrapper-elem', 'twisty-button',
  'twisty-buttons', 'twisty-managed-custom-element', 'twisty-player',
  'twisty-scrubber', 'twisty-stream-source', 'twizzle-link',
];
const cubingElementPattern = new RegExp(
  `(?<![\\w-])(?:${cubingElementNames.join('|')})(?![\\w-])`,
  'g',
);
const cubingElementPlugin = {
  name: 'replay-cubing-element-names',
  setup(context) {
    context.onLoad({ filter: /\.js$/ }, async ({ path }) => {
      const file = relative(cubingDirectory, path);
      if (!file.startsWith(`twisty${sep}`) && !file.startsWith(`chunks${sep}`)) return;

      const source = await readFile(path, 'utf8');
      const registrations = source.matchAll(/customElements(?:Shim)?\.define\(\s*"([\w-]+)"/g);
      for (const [, tag] of registrations) {
        if (!cubingElementNames.includes(tag)) {
          throw new Error(`Unknown cubing.js custom element: ${tag}`);
        }
      }
      return {
        contents: source.replace(cubingElementPattern, tag => `cuberoot-pg-${tag}`),
        loader: 'js',
        resolveDir: dirname(path),
      };
    });
  },
};

// Bundle the shared component styles into the player's Shadow DOM stylesheet.
// An ordinary CSS import from the component would otherwise emit global CSS.
const shadowStylesPlugin = {
  name: 'replay-shadow-styles',
  setup(context) {
    context.onResolve({ filter: /^\.\/element\.css\?inline$/ }, ({ resolveDir }) => ({
      path: join(resolveDir, 'element.css'),
      namespace: 'replay-shadow-styles',
    }));
    context.onLoad({ filter: /./, namespace: 'replay-shadow-styles' }, async ({ path }) => {
      const { outputFiles: css } = await build({
        absWorkingDir: packageDir,
        entryPoints: [path],
        bundle: true,
        minify: true,
        target: 'es2022',
        write: false,
      });
      return { contents: css[0].text, loader: 'text' };
    });
    context.onLoad({ filter: /Playback(?:Bar|Scrubber)\.css$/ }, ({ path }) => {
      if (embeddedStyles.has(path)) return { loader: 'empty' };
    });
  },
};

const { metafile, outputFiles } = await build({
  absWorkingDir: packageDir,
  entryPoints: {
    index: 'src/index.ts',
    element: 'src/element.ts',
    'setup.worker': workerEntry,
  },
  outdir: outDir,
  bundle: true,
  splitting: true,
  format: 'esm',
  chunkNames: 'chunk-[hash]',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  sourcemap: true,
  legalComments: 'eof',
  metafile: true,
  write: false,
  plugins: [workerUrlPlugin, cubingElementPlugin, shadowStylesPlugin],
});

for (const [output, metadata] of Object.entries(metafile.outputs)) {
  const external = metadata.imports.filter(dependency => dependency.external);
  if (external.length > 0) {
    throw new Error(`${output} has unresolved imports: ${external.map(dependency => dependency.path).join(', ')}`);
  }
}

await mkdir(outDir, { recursive: true });
const previousChunks = (await readdir(outDir)).filter(file => /^chunk-[A-Z0-9]+\.js(?:\.map)?$/.test(file));
await Promise.all(previousChunks.map(file => rm(join(outDir, file))));
await Promise.all(outputFiles.map(file => writeFile(file.path, file.contents)));
await Promise.all([
  copyFile(kernelAsset, join(outDir, 'stack_kernel_bg.wasm')),
  copyFile(join(packageDir, '../../../LICENSE'), join(outDir, 'LICENSE')),
  copyFile(join(packageDir, 'THIRD_PARTY_NOTICES.md'), join(outDir, 'THIRD_PARTY_NOTICES.md')),
  cp(join(packageDir, 'licenses'), join(outDir, 'licenses'), { recursive: true }),
]);
await Promise.all([
  copyFile(threeLicense, join(outDir, 'licenses/three-MIT.txt')),
  ...uiLicenses.map(([file, manifest]) => copyFile(join(dirname(manifest), 'LICENSE'), join(outDir, 'licenses', file))),
]);
