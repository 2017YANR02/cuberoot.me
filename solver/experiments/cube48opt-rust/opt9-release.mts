/** Native Opt9 official artifact; shared installer never starts a solver. */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readNativeRelease, verifyNativeRelease, installNativeRelease, nativeReleaseCli } from './native-release.mts';
export const readOpt9Release = () => readNativeRelease(9);
export const verifyOpt9Release = () => verifyNativeRelease(9);
export const installOpt9Release = () => installNativeRelease(9);
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) nativeReleaseCli(9);
