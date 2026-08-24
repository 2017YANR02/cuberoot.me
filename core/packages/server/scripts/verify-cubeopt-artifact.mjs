import { resolve } from 'node:path';
import { loadCubeoptArtifact } from '../src/cubeopt/artifact.mjs';

const artifactDir = process.argv[2] || process.env.CUBEOPT_ARTIFACT_DIR;
if (!artifactDir) throw new Error('usage: pnpm cubeopt:verify -- <artifact-store>');

const verified = await loadCubeoptArtifact(resolve(artifactDir));
console.log(JSON.stringify({
  bundle: verified.manifest.bundle,
  variant: verified.manifest.variant,
  protocol: verified.manifest.protocol,
  root: verified.root,
}, null, 2));
