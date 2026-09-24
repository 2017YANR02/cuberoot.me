import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertClone, assertFiles, copyChanged, filesUnder, gaInlineCode, parseOptions, readUtf8, repoRoot, syncDirectory, upstreamDir, versionRecord, writeUtf8 } from './lib.js';

interface Input { root: string; upstream: string; dryRun?: boolean }
interface Config { rootFiles: string[]; trainerDirs: string[]; analytics: { trackingId: string } }
const getClicky = /\s*<script\s+async\s+data-id="[^"]*"\s+src="\/\/static\.getclicky\.com\/js"\s*>\s*<\/script>/gm;

export function syncAlgTrainers({ root, upstream, dryRun = false }: Input): void {
  assertFiles(root, ['scripts/upstream/sync-alg-trainers.ts', 'scripts/upstream/lib.ts', '.sync/alg_trainers_config.json', 'docs/generated-artifacts.json']);
  assertClone(upstream);
  const config = JSON.parse(readUtf8(join(root, '.sync/alg_trainers_config.json'))) as Config;
  const dest = join(root, 'tools/alg_trainers');
  const sourceIndex = join(upstream, 'index.json');
  const trainerDirs = existsSync(sourceIndex)
    ? [...new Set(Object.values(JSON.parse(readUtf8(sourceIndex)) as Record<string, { location: string }>).map(value => value.location))]
    : config.trainerDirs;
  const stats = { srcFiles: 0, styleFiles: 0, rootFiles: 0, trainerDirs: 0, indexConverted: 0 };
  for (const area of ['src', 'style'] as const) {
    for (const source of filesUnder(join(upstream, area))) {
      const target = join(dest, area, relative(join(upstream, area), source));
      if (copyChanged(source, target, dryRun)) stats[area === 'src' ? 'srcFiles' : 'styleFiles']++;
    }
  }
  for (const file of config.rootFiles) {
    const source = join(upstream, file);
    if (!existsSync(source)) { console.warn(`[WARN] missing upstream file: ${file}`); continue; }
    if (copyChanged(source, join(dest, file), dryRun)) stats.rootFiles++;
  }
  for (const dir of trainerDirs) {
    const source = join(upstream, dir);
    if (!existsSync(source)) { console.warn(`[WARN] missing upstream trainer: ${dir}`); continue; }
    syncDirectory(source, join(dest, dir), dryRun);
    stats.trainerDirs++;
  }
  const ga = gaInlineCode(config.analytics.trackingId);
  const sourceHome = join(upstream, 'index.html');
  if (existsSync(sourceHome)) {
    let html = readUtf8(sourceHome)
      .replace(getClicky, ga)
      .replace(/<script>\s*var selectedAlgSets[\s\S]*?registerServiceWorker\(\);\s*<\/script>/g, '<script>var selectedAlgSets = {};</script>')
      .replace(/\s*<link\s+rel="manifest"\s+href="manifest\.json"\s*\/?\s*>/gm, '');
    if (!html.includes('goTrainer')) {
      const helper = `<script>\nfunction goTrainer(path) {\n\tvar lang = new URLSearchParams(window.location.search).get('lang');\n\tif (lang) localStorage.setItem('i18n-locale', lang);\n\twindow.location = path + '?select';\n}\n</script>\n<script src='../i18n/i18n.js' defer></script>\n<script src='../assets/js/logo_nav.js' defer></script>`;
      html = html.replace(/<\/body>|<\/html>/, hit => `${helper}\n${hit}`)
        .replace(/onclick='window\.location="([^"]+)"'/g, (_, path: string) => `onclick="goTrainer('${path}')"`)
        .replace('window.location = `${entry.location}/index.html`;', "goTrainer(entry.location + '/index.html');");
    }
    if (!dryRun) writeUtf8(join(dest, 'index.html'), html);
    stats.indexConverted++;
  }
  const i18n = `\t<script src='../../i18n/i18n.js' defer></script>\n\t<script src='../../assets/js/logo_nav.js' defer></script>\n\t<script>\n\t\tvar _i18nPoll = setInterval(function() {\n\t\t\tif (document.getElementById('timer') && window.I18n && I18n._ready) {\n\t\t\t\tclearInterval(_i18nPoll);\n\t\t\t\tI18n.apply();\n\t\t\t\tI18n._injectToggle();\n\t\t\t\tI18n._updateToggle();\n\t\t\t}\n\t\t}, 200);\n\t</script>`;
  for (const dir of trainerDirs) {
    const target = join(dest, dir, 'index.html');
    if (!existsSync(target)) continue;
    let html = readUtf8(target);
    if (html.includes('getclicky.com')) html = html.replace(getClicky, ga);
    if (!html.includes('i18n.js')) html = html.replace('</head>', `${i18n}\n</head>`);
    if (!dryRun) writeUtf8(target, html);
  }
  if (!dryRun) versionRecord(root, 'tools.alg-trainers', upstream);
  console.log(`Alg-Trainers sync ${dryRun ? 'preview' : 'complete'}: ${JSON.stringify(stats)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseOptions();
  const root = repoRoot(options);
  assertFiles(root, ['scripts/upstream/sync-alg-trainers.ts', 'scripts/upstream/lib.ts', '.sync/alg_trainers_config.json']);
  if (!options.validateOnly) syncAlgTrainers({ root, upstream: upstreamDir(root, 'algtrainers', options), dryRun: Boolean(options.dryRun) });
  else console.log('Alg-Trainers sync validated');
}
