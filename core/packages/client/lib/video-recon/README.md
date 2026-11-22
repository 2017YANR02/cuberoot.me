# Video reconstruction engine

The engine is imported from Magic Stew at
[04cf401](https://github.com/joongpa/magic-stew/tree/04cf40174a9f8c7f5dc26e5785b48cb883ab9f1d).
`engine/` contains the browser workers, media pipeline, pose and search adapters,
and replay math from upstream `web/src/lib/`. `pose-fitter/` contains the matching
Rust crate, WASM host, OpenCV wrapper and notices. The CubeRoot credits live at
[/about](https://cuberoot.me/about).

The pinned source revision does not declare a repository-wide license. The
[author's weights repository](https://huggingface.co/joongpa/you-only-cube-once)
labels its two PyTorch checkpoints MIT. The browser runs the separately
published ONNX exports from Magic Stew's `docs/models/`. The hashes below
identify the assets used by this integration. The CPU pipeline includes CubeRoot’s replay cleanup changes.

| Asset | SHA-256 |
| --- | --- |
| Cube bounding-box ONNX | `eb8735b0c9b90b6eb2c8612681ad005bbdcc003b0f8c2a2f35d632e7eef17382` |
| Cube pose ONNX | `1a86b6967d44313662a8d4dc784fd638634f0949c724dc9fdc4830cff06d91aa` |
| CPU pipeline WASM | `f8ffe9bf6dc5b8ed41317707861f1356bf3c5ddf8c86372daa140012cc593754` |
| OpenCV PnP WASM | `83e9da3fbae4564ded4fb316d4853892e407979ac18881bb09f1c4edc9f8d96b` |

Confirm permission for the source and ONNX exports with the author before
publishing. Retain the upstream [numerical algorithm notices](pose-fitter/THIRD_PARTY.md)
and [OpenCV notices](pose-fitter/vendor/opencv/README.md).

The Next development and production build commands compile the five worker
entries using `core/scripts/build-video-recon-workers.mjs`. Worker bundles are
generated into `public/vendor/video-recon/workers/`. The same build step copies
the pinned ONNX Runtime distribution into `public/vendor/video-recon/runtime/`.
The model weights use the upstream manifest. The pose manifest selects the current CPU pipeline build.
The original CubeRoot opening-grip fix now lives in `engine/cube-orientation.ts`.

Open `/frame-count?mode=detector` for automatic reconstruction or
`/frame-count?mode=timer` for the camera timer. The existing `/video-recon`
route remains available during migration.
Next serves COOP/COEP on the page and COEP/CORP on the worker assets. The existing
nginx proxy passes those Next headers through on the self-hosted line.
The production video tool installs a route-scoped offline service worker. It
warms the anonymous page shell and runtime, then caches each model on first use.
Uploaded frames and camera video are processed in the browser.

To rebuild the numerical pipeline, install the Rust
`wasm32-unknown-unknown` target, CMake, Ninja and Emscripten 4.0.20. From the
`pose-fitter/` directory:

```sh
node tools/build-opencv-wasm.mjs --source "$OPENCV_SOURCE"
cargo build --release --locked --features cpu-pipeline --target wasm32-unknown-unknown --lib
```

Use OpenCV 5.0.0 for `OPENCV_SOURCE`. Copy the release WASM, the OpenCV module
and WASM, and their matching geometry into `public/vendor/video-recon/pose/`.
Update the content-hash filenames and `pipeline.json` together. Keep the
numerical and OpenCV notices with the distributed assets.
