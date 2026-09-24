import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertClone, assertFiles, copyChanged, filesUnder, gaInlineCode, parseOptions, readUtf8, repoRoot, syncDirectory, upstreamDir, versionRecord, writeUtf8 } from './lib.js';

interface Input { root: string; upstream: string; dryRun?: boolean }
interface Page { upstream: string; subdir: string; i18nTitle?: string }
interface Config { rootFiles: string[]; rootDirs?: string[]; pages: Page[]; analytics: { trackingId: string } }

export function syncSolver({ root, upstream, dryRun = false }: Input): void {
  assertFiles(root, ['scripts/upstream/sync-rubiks-solver-demo.ts', 'scripts/upstream/lib.ts', '.sync/page_config.json', '.sync/menu_template.html', 'docs/generated-artifacts.json']);
  assertClone(upstream);
  const config = JSON.parse(readUtf8(join(root, '.sync/page_config.json'))) as Config;
  const menu = readUtf8(join(root, '.sync/menu_template.html'));
  const targetBase = join(root, 'tools');
  const stats = { srcFiles: 0, rootFiles: 0, rootDirs: 0, pages: 0 };
  const sourceDir = join(upstream, 'src');
  const exclusions = [/\.cpp$/, /\.h$/, /\.sh$/, /\.txt$/, /\.gitignore/, /README/i, /PRODUCTION_GUIDE/, /CHANGELOG/, /build_/, /test_/, /docs/, /tools/, /tsl/];
  for (const source of filesUnder(sourceDir)) {
    const rel = relative(sourceDir, source);
    if (exclusions.some(pattern => pattern.test(rel))) continue;
    if (copyChanged(source, join(targetBase, 'src', rel), dryRun)) stats.srcFiles++;
  }
  for (const file of config.rootFiles) {
    const source = join(upstream, file);
    if (!existsSync(source)) { console.warn(`[WARN] missing upstream file: ${file}`); continue; }
    if (copyChanged(source, join(targetBase, file), dryRun)) stats.rootFiles++;
  }
  for (const dir of config.rootDirs ?? []) {
    const source = join(upstream, dir);
    if (!existsSync(source)) { console.warn(`[WARN] missing upstream directory: ${dir}`); continue; }
    syncDirectory(source, join(targetBase, dir), dryRun);
    stats.rootDirs++;
  }
  const swPath = join(targetBase, 'sw.js');
  if (existsSync(swPath)) {
    let content = readUtf8(swPath).replace(/^\t'analytics\.js',?\r?\n/gm, '');
    for (const page of config.pages) if (page.upstream !== 'index.html') content = content.replaceAll(`'${page.upstream}'`, `'${page.subdir}/index.html'`);
    if (!dryRun) writeUtf8(swPath, content);
  }
  const swRegisterPath = join(targetBase, 'sw-register.js');
  if (existsSync(swRegisterPath)) {
    let content = readUtf8(swRegisterPath);
    const anchor = "navigator.serviceWorker.register('sw.js')";
    if (content.includes(anchor)) {
      content = content.replace("if ('serviceWorker' in navigator) {", "if ('serviceWorker' in navigator) {\n\tconst swRegisterBase = document.currentScript ? document.currentScript.src : window.location.href;")
        .replace(anchor, "navigator.serviceWorker.register(new URL('sw.js', swRegisterBase).href)");
      if (!dryRun) writeUtf8(swRegisterPath, content);
    } else if (!content.includes('document.currentScript')) console.warn('[WARN] sw-register.js anchor changed');
  }
  const manifestPath = join(targetBase, 'manifest.json');
  if (existsSync(manifestPath)) {
    const content = readUtf8(manifestPath)
      .replace(/"start_url":\s*"\/RubiksSolverDemo\/index\.html"/, '"start_url": "/"')
      .replace(/"scope":\s*"\/RubiksSolverDemo\/"/, '"scope": "/"')
      .replace(/"name":\s*"Rubik's Cube Solver"/, '"name": "CubeRoot"')
      .replace(/"short_name":\s*"Solver"/, '"short_name": "CubeRoot"')
      .replaceAll('"icons/', '"custom_icons/');
    if (!dryRun) writeUtf8(manifestPath, content);
  }
  const ga = gaInlineCode(config.analytics.trackingId);
  for (const page of config.pages) {
    const source = join(upstream, page.upstream);
    if (!existsSync(source)) { console.warn(`[SKIP] missing upstream page: ${page.upstream}`); continue; }
    let html = readUtf8(source).replaceAll("'src/", "'../src/").replaceAll('"src/', '"../src/')
      .replace(/\s*<script\s+src="analytics\.js"\s+defer>\s*<\/script>/gm, ga)
      .replaceAll('"manifest.json"', '"../manifest.json"')
      .replaceAll('"url_params_compressor_simple.js"', '"../url_params_compressor_simple.js"')
      .replaceAll("'url_params_compressor_simple.js'", "'../url_params_compressor_simple.js'");
    if (!html.includes('manifest.json')) html = html.replace(/(<meta\s+charset="UTF-8">)/, '$1\n\t<link rel="manifest" href="../manifest.json">');
    if (!html.includes('apple-touch-icon')) html = html.replace(/(<link\s+rel="manifest"[^>]*>)/, '$1\n\t<link rel="apple-touch-icon" href="../custom_icons/icon-192x192.png">');
    html = html.replaceAll('#121212', '#0a0a0f').replace(/(body\s*\{[^}]*?)background-color:\s*#0a0a0f;/g, '$1background-color: #0a0a0f;\n            background-image:\n                radial-gradient(ellipse at 20% 50%, rgba(90, 90, 200, 0.08) 0%, transparent 50%),\n                radial-gradient(ellipse at 80% 50%, rgba(200, 90, 90, 0.06) 0%, transparent 50%);');
    html = html.replace(/(<div\s+class="drawer-content">)\s*\n[\s\S]*?(\s*<\/div>\s*\n\s*<\/nav>)/g, `$1\n${menu}\n$2`);
    if (page.i18nTitle) html = html.replace('<title>', `<title data-i18n="${page.i18nTitle}">`).replace(/(<h1)(>)/g, `$1 data-i18n="${page.i18nTitle}"$2`);
    html = html.replace(/(<h2\s+class="drawer-title")(>)/g, '$1 data-i18n="common.menu"$2')
      .replaceAll('"sw-register.js"', '"../sw-register.js"');
    if (!html.includes('i18n.js')) html = html.replace('</body>', '<script src="../i18n/i18n.js" defer></script>\n</body>');
    if (!dryRun) writeUtf8(join(targetBase, page.subdir, 'index.html'), html);
    stats.pages++;
  }
  if (!dryRun) versionRecord(root, 'tools.rubiks-solver-demo', upstream);
  console.log(`RubiksSolverDemo sync ${dryRun ? 'preview' : 'complete'}: ${JSON.stringify(stats)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseOptions();
  const root = repoRoot(options);
  assertFiles(root, ['scripts/upstream/sync-rubiks-solver-demo.ts', 'scripts/upstream/lib.ts', '.sync/page_config.json']);
  if (options.validateOnly) console.log('RubiksSolverDemo sync validated');
  else syncSolver({ root, upstream: upstreamDir(root, 'solver', options), dryRun: Boolean(options.dryRun) });
}
