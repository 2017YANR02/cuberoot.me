import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Local authoring uses Blender. A release must provision the separate asset
// bundle before explicitly enabling it; ordinary CI has no heavy binaries.
export const SPACE_ASSET_SOURCE: 'blender' | 'bootstrap' = process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SPACE_BLENDER !== '1' ? 'bootstrap' : 'blender';

// The small sidecar changes on every Blender export; binary and texture URLs can
// then be cached without serving an older mesh after the artist saves an edit.
export async function loadSpaceBlender(asset: string) {
  if (!/^(shanghai|(minimal|modern|cyberpunk|vintage|italian|penthouse|japanese|company)-(original|island|shanghai))$/.test(asset)) throw new Error('Unknown Blender asset');
  const base = `/assets/space/blender-v1/${asset}`;
  const response = await fetch(`${base}.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Blender asset manifest HTTP ${response.status}: ${asset}`);
  const manifest = await response.json();
  if (manifest.asset !== asset || manifest.schemaVersion !== 2 || !/^[a-f0-9]{64}$/.test(manifest.sha256)) throw new Error(`Invalid Blender manifest: ${asset}`);
  return new GLTFLoader().loadAsync(`${base}.glb?v=${manifest.sha256}`);
}
