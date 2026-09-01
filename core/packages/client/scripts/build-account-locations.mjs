import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCitiesOfState, getCountries, getStatesOfCountry } from '@countrystatecity/countries';

const outputDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'account-locations');
const check = process.argv.includes('--check');
const expected = new Map();

for (const country of await getCountries()) {
  const states = [];
  for (const state of await getStatesOfCountry(country.iso2)) {
    const cities = await getCitiesOfState(country.iso2, state.iso2);
    states.push({
      code: state.iso2,
      name: state.name,
      cities: [...new Set(cities.map((city) => city.name))].sort(),
    });
  }
  expected.set(`${country.iso2}.json`, `${JSON.stringify(states)}\n`);
}

await mkdir(outputDir, { recursive: true });
if (!check) {
  await Promise.all([...expected].map(([name, content]) => writeFile(join(outputDir, name), content)));
  console.log(`wrote ${expected.size} country location files`);
} else {
  const actualNames = (await readdir(outputDir)).filter((name) => name.endsWith('.json')).sort();
  const expectedNames = [...expected.keys()].sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) throw new Error('account location file list is stale');
  for (const [name, content] of expected) {
    if (await readFile(join(outputDir, name), 'utf8') !== content) throw new Error(`${name} is stale`);
  }
  console.log(`verified ${expected.size} country location files`);
}
