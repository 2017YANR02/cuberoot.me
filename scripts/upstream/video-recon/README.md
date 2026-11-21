# Magic Stew on CubeRoot

The Next page at `/video-recon` embeds the production application under the same-origin `/vendor/video-recon/` scope. The patch applies to joongpa/magic-stew commit `04cf40174a9f8c7f5dc26e5785b48cb883ab9f1d`. It exposes the initial display basis as setup moves and includes them in clipboard exports from both the detector and timer replay. Detection, fitting and move search use the upstream workers and models.

## Rebuild

From a checkout of that upstream revision, set `CUBEROOT_REPO` to the absolute path of the CubeRoot repository. Apply the patch once, then hydrate the source tree from the pinned release. The two unversioned model names below are the input contract for the Vite build.

```sh
git apply "$CUBEROOT_REPO/scripts/upstream/video-recon/initial-grip.patch"
mkdir -p web/public/pose
cp -R docs/pose/. web/public/pose/
cp docs/models/cube-bbox-640.eb8735b0c9b90b6e.onnx web/public/models/cube-bbox-640.onnx
cp docs/models/cube-pose-256.1a86b6967d443136.onnx web/public/models/cube-pose-256.onnx
cd web
npm ci
npm run sync:runtime
npm run check
./node_modules/.bin/tsx --test --test-name-pattern="opening grip replays" src/lib/cube-orientation.test.ts
./node_modules/.bin/vite build --base=/vendor/video-recon/
```

Copy the resulting `web/dist/` release into `core/packages/client/public/vendor/video-recon/`, omitting the GitHub Pages files `.nojekyll` and `_headers`. Replace the bundle and its cache manifests together. Next serves the isolation headers and the two HTML entries. The pose sync can report missing local Rust/OpenCV build outputs when reusing the compiled pose release copied above.

Upstream sources and model attribution are recorded on CubeRoot’s About page.
