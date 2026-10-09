/** Read-only smoke check for the WCA extra API endpoints. */
export {};
const base = (process.argv[2] || 'https://api.cuberoot.me').replace(/\/$/, '');
const cases: Array<[string, string]> = [
  ['grand-slam', '/v1/wca/grand-slam'],
  ['grand-slam(333)', '/v1/wca/grand-slam?event=333'],
  ['all-results', '/v1/wca/all-results?event=333&type=single'],
  ['all-results CN', '/v1/wca/all-results?event=333&type=single&country=China'],
  ['cohort-ranks', '/v1/wca/cohort-ranks?cohort=2020&event=333&type=single'],
  ['success-rate', '/v1/wca/success-rate?event=333bf'],
  ['all-events-done', '/v1/wca/all-events-done'],
  ['sum-of-ranks', '/v1/wca/sum-of-ranks?type=single'],
  ['sum-of-ranks 5', '/v1/wca/sum-of-ranks?type=single&events=333,222,444,555,666'],
];
console.log(`== Testing ${base}/v1/wca/* ==`);
for (const [name, route] of cases) {
  try {
    const response = await fetch(base + route, { signal: AbortSignal.timeout(10_000) });
    const body = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 80)}`);
    const data = JSON.parse(body) as { rows?: unknown[] };
    console.log(`${name.padEnd(22)} OK (${response.status}, ${Array.isArray(data.rows) ? data.rows.length : 'ok'} rows)`);
  } catch (error) {
    process.exitCode = 1;
    console.error(`${name.padEnd(22)} FAIL: ${String(error)}`);
  }
}
