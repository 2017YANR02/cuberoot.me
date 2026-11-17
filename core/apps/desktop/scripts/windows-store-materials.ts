/** Offline Store text preparation. Does not create an app, build, sign or submit a package. */
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const desktop = resolve(import.meta.dirname, '..');
const repo = resolve(desktop, '../../..');
const source = join(desktop, 'store');
const mode = process.argv[2];
assert.ok(mode === 'check' || mode === 'prepare', 'Usage: windows-store-materials.ts check|prepare [--online]');
assert.ok(process.argv.slice(3).every(arg => arg === '--online'), 'Unknown argument');
const files = ['listing.json', 'reviewer-notes.md', 'identity.env.example'];
const inputs = Object.fromEntries(files.map(name => [name, readFileSync(join(source, name), 'utf8')]));
const listing = JSON.parse(inputs['listing.json']);
const text = (value: unknown, maximum: number, label: string, allowEmpty = false) => {
  assert.equal(typeof value, 'string', `${label} must be text`);
  const content = value as string;
  assert.ok((allowEmpty || content.trim().length > 0) && content.length <= maximum, `${label} length must be 1..${maximum}`);
  assert.ok(!/<\/?[a-z][^>]*>/i.test(content), `${label} must not contain HTML`);
};
const list = (value: unknown, maximum: number, label: string) => {
  assert.ok(Array.isArray(value) && value.length > 0 && value.length <= maximum, `${label} has too many or no entries`);
  for (const item of value) text(item, 200, label);
};
assert.equal(listing.schemaVersion, 1);
assert.equal(listing.status, 'draft-not-submission-ready');
assert.equal(listing.productName, 'CubeRoot');
assert.deepEqual(Object.keys(listing.locales).sort(), ['en-US', 'zh-CN']);
assert.equal(listing.configuration.price, 'Free');
assert.equal(listing.configuration.payment, 'existing-membership-third-party');
assert.deepEqual(listing.configuration.microsoftIapProducts, []);
assert.equal(listing.configuration.publishingHold, 'manual');
assert.equal(listing.configuration.packageIdentity, 'pending-Partner-Center');
const urls = new Set<string>();
const priceKeys = ['individualMonthly', 'individualAnnual', 'enterpriseMonthly'] as const;
assert.equal(listing.membershipSnapshot.currency, 'CNY');
for (const key of priceKeys) {
  const price = listing.membershipSnapshot[key];
  assert.ok(typeof price === 'number' && Number.isFinite(price) && price > 0, `Invalid ${key} price`);
}
for (const [locale, entry] of Object.entries(listing.locales)) {
  const fields = entry as Record<string, unknown>;
  text(fields.description, 10_000, `${locale} description template`);
  let description = fields.description as string;
  for (const key of priceKeys) {
    const token = `{{${key}}}`;
    assert.equal(description.split(token).length, 2, `${locale}: include ${token} exactly once`);
    description = description.replace(token, listing.membershipSnapshot[key].toFixed(2).replace(/\.00$/, ''));
  }
  assert.ok(!/\{\{/.test(description), `${locale}: unknown description placeholder`);
  fields.description = description;
  text(fields.shortDescription, 270, `${locale} short description`);
  text(fields.description, 10_000, `${locale} description`);
  assert.ok(!/https?:\/\//.test(String(fields.description)), 'Keep URLs in dedicated Store fields');
  text(fields.releaseNotes, 1_500, `${locale} release notes`, true);
  assert.equal(fields.releaseNotes, '', 'First Store submission has no release notes');
  list(fields.features, 20, `${locale} features`);
  list(fields.minimumHardware, 11, `${locale} minimum hardware`);
  list(fields.recommendedHardware, 11, `${locale} recommended hardware`);
  list(fields.screenshotCaptions, 10, `${locale} captions`);
  for (const key of ['website', 'support', 'privacy']) {
    const url = new URL(String(fields[key]));
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'cuberoot.me');
    urls.add(url.href);
  }
}
const config = JSON.parse(readFileSync(join(desktop, 'src-tauri/tauri.conf.json'), 'utf8'));
assert.equal(config.productName, listing.productName, 'Listing name must match the desktop product');
const identityTemplate = inputs['identity.env.example'];
for (const key of ['IDENTITY_NAME', 'PUBLISHER', 'PUBLISHER_DISPLAY_NAME', 'VERSION']) {
  assert.ok(identityTemplate.split('\n').includes(`WINDOWS_STORE_${key}=`), 'Do not guess formal identity values');
}

// Explicit opt-in: default checks and CI never depend on production availability.
const online: Array<{ url: string; status: number; checkedAt: string }> = [];
if (process.argv.includes('--online')) {
  const fetchPublic = async (url: string) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    assert.ok(response.ok, `${url}: HTTP ${response.status}`);
    online.push({ url, status: response.status, checkedAt: new Date().toISOString() });
    return response;
  };
  await Promise.all([...urls].map(async url => {
    const response = await fetchPublic(url);
    assert.ok(response.headers.get('content-type')?.includes('text/html'), `${url}: expected a public HTML page`);
    const html = await response.text();
    assert.ok(/<title>[^<]+<\/title>/.test(html), `${url}: missing page title`);
  }));
  const snapshot = listing.membershipSnapshot;
  assert.equal(snapshot.source, 'https://api.cuberoot.me/v1/membership/plans');
  const current = await (await fetchPublic(snapshot.source)).json() as {
    plans: Array<{ slug: string; active: boolean; priceCents: number; currency: string }>;
    renewalPlans: Array<{ active: boolean }>;
    payEnabled: boolean;
    channels: { alipay: boolean; wechat: boolean };
  };
  const expected = { monthly: snapshot.individualMonthly, yearly: snapshot.individualAnnual, enterprise_monthly: snapshot.enterpriseMonthly };
  assert.deepEqual(current.plans.filter(p => p.active).map(p => p.slug).sort(), Object.keys(expected).sort(), 'Active plan set changed; review listing copy');
  for (const [slug, price] of Object.entries(expected)) {
    const plan = current.plans.find(p => p.slug === slug && p.active);
    assert.equal(plan?.currency, snapshot.currency);
    assert.equal(plan?.priceCents, Math.round(Number(price) * 100), `${slug} price changed; refresh BOTH descriptions and snapshot`);
  }
  assert.equal(current.renewalPlans.some(p => p.active), snapshot.autoRenewalAvailable, 'Auto-renewal availability changed');
  assert.ok(current.payEnabled && current.channels.alipay && current.channels.wechat, 'Payment availability changed');
}

if (mode === 'prepare') {
  const base = join(repo, '.local-data/windows-store');
  mkdirSync(base, { recursive: true });
  const output = mkdtempSync(join(base, 'materials-'));
  for (const [name, contents] of Object.entries(inputs)) {
    writeFileSync(join(output, name), name === 'listing.json' ? JSON.stringify(listing, null, 2) + '\n' : contents);
  }
  for (const [locale, entry] of Object.entries(listing.locales)) {
    const fields = { productName: listing.productName, ...(entry as Record<string, unknown>) };
    const content = Object.entries(fields).map(([key, value]) => `${key}\n${Array.isArray(value) ? value.join('\n') : value}`).join('\n\n');
    writeFileSync(join(output, `${locale}.txt`), content + '\n');
  }
  writeFileSync(join(output, 'receipt.json'), JSON.stringify({
    schemaVersion: 1, status: listing.status, preparedAt: new Date().toISOString(),
    sourceSha256: Object.fromEntries(Object.entries(inputs).map(([name, content]) => [name, createHash('sha256').update(content).digest('hex')])),
    onlineChecks: online, nativeBuild: 'not-run', screenshots: 'not-captured', submitted: false,
  }, null, 2) + '\n');
  console.log(`Draft Store materials: ${output}`);
}
console.log(`Store text/configuration checks passed (${online.length} public URLs checked). This is not submission readiness or Windows validation.`);
