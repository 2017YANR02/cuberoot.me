import { readFileSync } from 'node:fs';

// A dev response and component SSR test cannot detect Next's production query-hook
// bailout. Inspect the actual artifacts before either deployment can be published.
for (const lang of ['en', 'zh']) {
  const html = readFileSync(new URL(`../.next/server/app/${lang}.html`, import.meta.url), 'utf8');
  if (!html.includes('class="landing-page"') || !/id="card-[^"]+"/.test(html)) {
    throw new Error(`${lang}: homepage navigation is missing from production HTML`);
  }
  console.log(`${lang}: homepage navigation is prerendered`);
}
