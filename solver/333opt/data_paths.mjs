import { resolve, join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dataRoot = resolve(process.env.CUBEROOT_DATA_ROOT || join(repoRoot, '../scramble'));
export const wcaDir = resolve(process.env.CUBEROOT_WCA_DATA_DIR || join(dataRoot, 'wca_scramble'));
