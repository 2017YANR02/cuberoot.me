import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(pkgDir, '../../..');
export const dataRoot = resolve(process.env.CUBEROOT_DATA_ROOT || join(repoRoot, '../scramble'));
export const wcaDir = resolve(process.env.CUBEROOT_WCA_DATA_DIR || join(dataRoot, 'wca_scramble'));
export const puzzleDir = resolve(process.env.CUBEROOT_PUZZLE_DATA_DIR || process.env.PUZZLE_DATA_DIR || join(dataRoot, 'puzzle'));
export const xcrossDir = resolve(process.env.CUBEROOT_XCROSS_DATA_DIR || join(dataRoot, 'xcross_2_col_10f'));
export const tableDir = resolve(process.env.CUBE_TABLE_DIR || join(repoRoot, 'solver/tables'));
export const executableSuffix = process.platform === 'win32' ? '.exe' : '';
