/** Native Opt10 official artifact; shared installer never starts a solver. */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readNativeRelease, verifyNativeRelease, installNativeRelease, nativeReleaseCli } from './native-release.mts';
export const readOpt10Release = () => readNativeRelease(10);
export const verifyOpt10Release = () => verifyNativeRelease(10);
export const installOpt10Release = () => installNativeRelease(10);
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) nativeReleaseCli(10);
