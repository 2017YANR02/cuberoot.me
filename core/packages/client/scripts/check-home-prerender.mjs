import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// A dev response and component SSR test cannot detect Next's production query-hook
// bailout. Inspect the actual artifacts before either deployment can be published.
export function checkHomePrerender(outputDir = new URL('../.next/', import.meta.url)) {
  for (const lang of ['en', 'zh']) {
    let artifact = new URL(`server/app/${lang}.html`, outputDir);
    if (!existsSync(artifact)) {
      // Adapter builds store each route owner's responses under a hashed directory.
      // Find the exact locale root, never a nested page or a different route's HTML.
      const cache = new URL('server/route-cache/APP_PAGE/', outputDir);
      const candidates = readdirSync(cache, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => new URL(`${entry.name}/$/${lang}.html`, cache))
        .filter(file => existsSync(file));
      if (candidates.length !== 1) throw new Error(`${lang}: expected one homepage artifact, found ${candidates.length}`);
      artifact = candidates[0];
    }
    const html = readFileSync(artifact, 'utf8');
    if (!html.includes('class="landing-page"') || !/id="card-[^"]+"/.test(html)) {
      throw new Error(`${lang}: homepage navigation is missing from production HTML`);
    }
    console.log(`${lang}: homepage navigation is prerendered`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) checkHomePrerender();
