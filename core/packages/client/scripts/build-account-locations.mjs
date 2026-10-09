import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeAccountLocationRequirements } from '@cuberoot/shared/build-account-location-requirements';
import { getCitiesOfState, getCountries, getStatesOfCountry } from '@countrystatecity/countries';

const outputDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'account-locations');
// Province-scoped labels preserve homographs and the upstream English saved values.
const cnCityNames = JSON.parse(await readFile(new URL('./account-location-cn-zh.json', import.meta.url), 'utf8'));
const cnCurrent = JSON.parse(await readFile(new URL('./account-location-cn-current.json', import.meta.url), 'utf8'));
// CN options are an independently reviewed administrative hierarchy, not the
// upstream gazetteer's mixture of cities, counties, towns and historical names.
if (cnCurrent.regions.length !== 34 || new Set(cnCurrent.regions.map((r) => r.code)).size !== 34) {
  throw new Error('Expected 34 distinct CN province-level groups');
}
const cnStates = cnCurrent.regions.map((region) => {
  const cities = region.cities.map((city) => city.value);
  if (new Set(cities).size !== cities.length) throw new Error(`Duplicate CN city identifier: ${region.code}`);
  for (const city of region.cities) {
    if (!city.value.trim() || !/^[\u3400-\u9fff]+$/.test(city.name)) throw new Error(`Invalid CN city: ${region.code}/${city.value}`);
    if (region.administrativeCode && (!/^\d{6}$/.test(city.code) || !city.code.startsWith(region.administrativeCode.slice(0, 2)))) {
      throw new Error(`Wrong CN administrative parent: ${region.code}/${city.code}`);
    }
  }
  return {
    code: region.code, name: region.name, nameZh: region.nameZh, cities,
    cityNamesZh: Object.fromEntries(region.cities.map((city) => [city.value, city.name])),
    // These labels are only for a user's existing saved value, never new choices.
    legacyCityNamesZh: Object.fromEntries(Object.entries(cnCityNames[region.code] ?? {}).filter(([value]) => !cities.includes(value))),
  };
});
const requirements = {};
const check = process.argv.includes('--check');
const expected = new Map();

for (const country of await getCountries()) {
  const states = [];
  if (country.iso2 === 'CN') states.push(...cnStates);
  for (const state of country.iso2 === 'CN' ? [] : await getStatesOfCountry(country.iso2)) {
    const cities = await getCitiesOfState(country.iso2, state.iso2);
    const cityNames = [...new Set(cities.map((city) => city.name))].sort();
    states.push({
      code: state.iso2,
      name: state.name,
      cities: cityNames,
    });
  }
  requirements[country.iso2] = Object.fromEntries(states.map((state) => [state.code, state.cities.length > 0]));
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

await writeAccountLocationRequirements(requirements, { check });
