import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const directory = process.argv[2];
const files = Object.fromEntries(readdirSync(directory).map(name => [name, createHash('sha256').update(readFileSync(join(directory, name))).digest('hex')]));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
writeFileSync(join(directory, 'build.json'), JSON.stringify({ commit: process.env.SOURCE_COMMIT, versionCode: Number(process.env.MOBILE_VERSION_CODE), versionName: pkg.version, channel: process.env.RELEASE_CHANNEL, files }, null, 2));
