import {dirname, isAbsolute, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
export const cornerExecutable = resolve(here, 'target/corner-research/release/corner-research');
export const cornerDirectory = resolve(root, '.tmp/cubeopt-reverse/corner96');
const MiB = 2 ** 20, GiB = 2 ** 30;

/** Pure protocol/budget selection. It does not inspect or reset any baseline.
 * The existing guard owns the exclusive lock, resource checks and stop history.
 */
export function cornerResearchPolicy(label: string, executable: string, args: string[],
    env: NodeJS.ProcessEnv = process.env) {
  if (!/^corner96-[a-z0-9-]+$/.test(label) || executable !== cornerExecutable
      || env.CUBEOPT_BACKEND !== 'corner')
    throw Error('Corner research requires a corner96-* label, its dedicated binary, and CUBEOPT_BACKEND=corner');
  if (Object.entries(env).some(([key, value]) => value !== undefined && key.startsWith('CUBEOPT_')
      && (key.endsWith('_REVIEW') || ['CUBEOPT_VARIANT', 'CUBEOPT_H', 'CUBEOPT_BENCHMARK',
        'CUBEOPT_MEASURE_RSS', 'CUBEOPT_CORNER_GUARDED'].includes(key)))
      || ![undefined, '1'].includes(env.CUBEOPT_SOLVE_THREADS)
      || ![undefined, '1'].includes(env.CUBEOPT_SEARCH_THREADS))
    throw Error('Corner research cannot inherit another review, backend, benchmark, guard token or parallel-worker setting');
  const count = (minimum: number, maximum = minimum) => {
    if (args.length < minimum || args.length > maximum) throw Error('Wrong corner-research argument count');
  };
  const integer = (index: number, minimum: number, maximum: number, optional = false) => {
    if (optional && args[index] === undefined) return;
    const text = args[index], value = Number(text);
    if (!/^(?:0|[1-9][0-9]*)$/.test(text ?? '') || !Number.isSafeInteger(value)
        || value < minimum || value > maximum)
      throw Error(`Invalid corner-research integer at argument ${index}`);
  };
  const path = (index: number, research = true) => {
    const text = args[index];
    if (!text || !isAbsolute(text) || resolve(text) !== text
        || research && !text.startsWith(cornerDirectory + sep))
      throw Error(`Corner research needs an absolute ${research ? 'corner96 artifact' : 'existing Opt input'} path at argument ${index}`);
    if (text.split(sep).some(part => part === '.Trash' || part === '.Trashes'))
      throw Error('Restore research inputs to the project data directory before use; Trash is not a working directory');
  };
  const searchOptions = (index: number) => {
    integer(index, 0, 20); integer(index + 1, 1, Number.MAX_SAFE_INTEGER);
    if (args[index + 2] !== undefined && !['1', '8'].includes(args[index + 2]))
      throw Error('Corner NISS contexts must be 1 or 8');
  };
  const mode = args[0];
  let tableBytes = 0, rssLimit = 512 * MiB;
  let deadlineMs = 60 * 60_000;
  switch (mode) {
    case 'verify-small': case 'verify-coordinate': case 'verify-eo': case 'query-eo': count(1); break;
    case 'verify-opt8-projection': count(2); path(1, false); break;
    case 'joint-check': case 'joint-pair-check': count(2); path(1, false); break;
    case 'joint-build': case 'joint-pair-build':
      count(4); path(1, false); path(2); path(3);
      if (args[2] === args[3] || args[1] === args[2] || args[1] === args[3])
        throw Error('Joint inputs, output and checkpoint must differ');
      tableBytes = mode === 'joint-build' ? 88_179_864 : 1_939_956_504;
      rssLimit = mode === 'joint-build' ? GiB : 5 * 1_939_956_480 + GiB; break;
    case 'joint-probe': case 'joint-pair-probe': case 'joint-pair-solve':
      count(5); path(1, false); path(2, false); path(3); integer(4, 1, 1_000_000_000);
      tableBytes = 30_401_280 * 2 ** 8 + (mode === 'joint-probe' ? 88_179_864 : 1_939_956_504);
      rssLimit = tableBytes + GiB; break;
    case 'build-u':
      count(4, 5); path(1); path(2);
      if (args[1] === args[2]) throw Error('Table and checkpoint paths must differ');
      if (args[3] !== 'exact') integer(3, 1, 254);
      integer(4, 1, 1_000_000, true);
      tableBytes = 918_604; break;
    case 'build-double': case 'verify-double':
      count(2); path(1); tableBytes = 1_905_744; break;
    case 'verify-u': case 'query-u': case 'query-u-eo':
      count(2); path(1); tableBytes = 918_604; break;
    case 'query-v':
      count(3); path(1); path(2); tableBytes = 918_604 + 1_905_744; break;
    case 'build96':
      count(3, 4); path(1); path(2);
      if (args[1] === args[2]) throw Error('Table and checkpoint paths must differ');
      integer(3, 1, 1_000_000, true);
      tableBytes = 4_673_930; rssLimit = GiB; deadlineMs = 6 * 60 * 60_000; break;
    case 'verify96': case 'verify-dense': case 'query96': case 'query96-dense': case 'solve-corners':
      count(2); path(1); tableBytes = 4_673_930; rssLimit = GiB; break;
    case 'compare-layouts':
      count(2); path(1); tableBytes = 4_673_930; rssLimit = 512 * MiB; break;
    case 'solve-u': case 'solve-u-eo':
      count(4, 5); path(1); searchOptions(2); tableBytes = 918_604; break;
    case 'solve-u-distance': case 'solve-u-distance-sparse':
      count(5, 6); path(1); path(2); searchOptions(3);
      tableBytes = 918_604 + 4_673_930; rssLimit = GiB; break;
    case 'solve-v': case 'solve-v-eo':
      count(5, 6); path(1); path(2); searchOptions(3); tableBytes = 918_604 + 1_905_744; break;
    case 'solve-distance': case 'solve-distance-dense':
      count(4, 5); path(1); integer(2, 0, 20); integer(3, 1, Number.MAX_SAFE_INTEGER);
      integer(4, 0, 1_000_000, true); tableBytes = 4_673_930; rssLimit = GiB; break;
    case 'verify-search':
      count(3, 4); path(1); integer(2, 0, 3);
      tableBytes = 918_604;
      if (args[3] !== undefined) { path(3); tableBytes += 4_673_930; rssLimit = GiB; }
      break;
    case 'solve-opt':
      count(7, 8); path(1); integer(2, 8, 9); path(3, false); path(4, false); searchOptions(5);
      tableBytes = 30_401_280 * 2 ** Number(args[2]);
      rssLimit = tableBytes + GiB; break;
    case 'solve-opt-distance': case 'solve-opt-distance-eo':
      count(8, 9); path(1); path(2); integer(3, 8, 9); path(4, false); path(5, false); searchOptions(6);
      tableBytes = 30_401_280 * 2 ** Number(args[3]) + 918_604 + 4_673_930;
      rssLimit = tableBytes + GiB; break;
    case 'compare-opt8': case 'compare-opt8-scheduled': case 'profile-opt8':
      count(6); path(1); path(2); path(3, false); path(4, false); integer(5, 1, 1_000_000_000);
      tableBytes = 30_401_280 * 2 ** 8 + 918_604 + 4_673_930;
      rssLimit = tableBytes + GiB; break;
    default: throw Error('Unknown guarded corner-research command');
  }
  return {entry: 'corner' as const, mode, backend: 'corner' as const,
    variant: null, h: null, tablePath: null, tableBytes,
    measureNativeRss: false, rssLimit, deadlineMs, searchThreads: 1};
}
