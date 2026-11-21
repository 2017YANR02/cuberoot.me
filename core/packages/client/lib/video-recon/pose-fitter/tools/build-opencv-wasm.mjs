import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {delimiter, dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {spawnSync} from 'node:child_process';

// Build the camera kernels without depending on the archived Python project.
const fitter = fileURLToPath(new URL('../', import.meta.url));
const root = dirname(fitter.replace(/[\\/]$/, ''));
const {values} = parseArgs({options: {
  emsdk: {type: 'string', default: process.env.EMSDK},
  source: {type: 'string'},
  'build-dir': {type: 'string', default: join(fitter, 'target/opencv-build')},
  jobs: {type: 'string', default: '6'},
  help: {type: 'boolean', short: 'h'},
}});
if (values.help) {
  console.log('Build pinned OpenCV 5.0.0 camera kernels.\n' +
    'Usage: node pose-fitter/tools/build-opencv-wasm.mjs --source OPENCV_SOURCE ' +
    '[--emsdk EMSDK | EMSDK environment variable] [--build-dir BUILD_DIR] [--jobs 6]');
  process.exit(0);
}
if (!values.emsdk || !values.source) throw new Error('--source and --emsdk (or EMSDK) are required');
const jobs = Number(values.jobs);
if (!Number.isInteger(jobs) || jobs <= 0) throw new Error('--jobs must be a positive integer');
const sdk = resolve(values.emsdk), source = resolve(values.source), build = resolve(values['build-dir']);
const version = readFileSync(join(source, 'modules/core/include/opencv2/core/version.hpp'), 'utf8');
const numbers = ['MAJOR', 'MINOR', 'REVISION'].map(key =>
  Number(version.match(new RegExp(`#define CV_VERSION_${key}\\s+(\\d+)`))?.[1]));
if (numbers.join('.') !== '5.0.0') throw new Error('This build requires the official OpenCV 5.0.0 source tree');
const emscripten = join(sdk, 'upstream/emscripten');
const env = {...process.env, PATH: emscripten + delimiter + (process.env.PATH ?? ''), EM_CONFIG: join(sdk, '.emscripten')};
function run(command, args) {
  const result = spawnSync(command, args, {cwd: root, env, stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.signal ?? result.status})`);
}
if (!existsSync(join(build, 'CMakeCache.txt'))) {
  const flags = {
    BUILD_LIST: 'core,geometry', BUILD_SHARED_LIBS: 'OFF', BUILD_TESTS: 'OFF', BUILD_PERF_TESTS: 'OFF',
    BUILD_EXAMPLES: 'OFF', BUILD_opencv_apps: 'OFF', BUILD_JAVA: 'OFF', BUILD_opencv_python3: 'OFF', BUILD_opencv_js: 'OFF',
    WITH_IPP: 'OFF', WITH_LAPACK: 'OFF', WITH_EIGEN: 'OFF', WITH_OPENCL: 'OFF', WITH_ITT: 'OFF', WITH_PTHREADS_PF: 'OFF',
    CV_ENABLE_INTRINSICS: 'OFF', CPU_BASELINE: '', CPU_DISPATCH: '', CMAKE_BUILD_TYPE: 'Release',
    CMAKE_CXX_FLAGS: '-ffp-contract=off', CMAKE_CXX_STANDARD: '17',
  };
  run(join(emscripten, 'emcmake'), ['cmake', '-S', source, '-B', build, '-G', 'Ninja',
    ...Object.entries(flags).map(([key, value]) => `-D${key}=${value}`)]);
}
run('cmake', ['--build', build, '--target', 'opencv_geometry', '--parallel', String(jobs)]);
const target = join(fitter, 'target');
mkdirSync(target, {recursive: true});
run(join(emscripten, 'em++'), [join(fitter, 'tools/opencv-pnp.cpp'),
  ...['geometry', 'flann', 'core'].map(name => join(build, `lib/libopencv_${name}.a`)),
  join(build, '3rdparty/lib/libzlib.a'), `-I${build}`,
  ...['core', 'geometry', 'flann'].map(name => `-I${join(source, 'modules', name, 'include')}`),
  '-O3', '-ffp-contract=off', '-fexceptions', '-sDISABLE_EXCEPTION_CATCHING=0', '-sMODULARIZE=1', '-sEXPORT_ES6=1',
  '-sENVIRONMENT=web,worker,node', '-sALLOW_MEMORY_GROWTH=1', '-sFILESYSTEM=0',
  '-sEXPORTED_FUNCTIONS=_pose_cv,_malloc,_free', '-sEXPORTED_RUNTIME_METHODS=HEAPF64',
  '-o', join(target, 'opencv-pnp.mjs')]);
console.log(join(target, 'opencv-pnp.wasm'));
