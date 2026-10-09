// Geometry-only visual gate. From core: pnpm -F @cuberoot/client exec node scripts/ghost/preview.mjs
// Output stays in core/.tmp/png to avoid remounting the Windows Next dev server.
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
const out = fileURLToPath(new URL('../../../../.tmp/png/', import.meta.url));
mkdirSync(out, { recursive: true });
const result = await build({
  stdin: { contents: `
    import * as THREE from 'three';
    import {buildGhostPieces} from '../puzzle-render-core/src/engine/ghost/ghostGeometry';
    import {GHOST_DISPLAY_QUATERNION} from '../puzzle-render-core/src/engine/ghost/ghostModel';
    const renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(1100,850);renderer.setPixelRatio(2);document.body.append(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color('white');
    scene.add(new THREE.AmbientLight('white',2));
    const light=new THREE.DirectionalLight('white',3);light.position.set(300,500,400);scene.add(light);
    const cube=new THREE.Group();cube.quaternion.copy(GHOST_DISPLAY_QUATERNION);
    const pieces=buildGhostPieces();pieces.forEach(p=>cube.add(p.pivot));scene.add(cube);
    const camera=new THREE.PerspectiveCamera(35,1100/850,1,3000);camera.position.set(380,300,440);camera.lookAt(0,0,0);
    renderer.render(scene,camera);
    window.ghostPreview={scene,cube,pieces,camera,renderer,THREE};
  `, resolveDir: fileURLToPath(new URL('../../', import.meta.url)), loader: 'ts' },
  bundle: true, write: false, format: 'iife', platform: 'browser',
});
const html = `<html><body style="margin:0"><script>${result.outputFiles[0].text}</script></body></html>`;
writeFileSync(`${out}ghost-geometry-preview.html`, html);
createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); })
  .listen(3036, '127.0.0.1', () => console.log('Ghost geometry preview http://localhost:3036'));
