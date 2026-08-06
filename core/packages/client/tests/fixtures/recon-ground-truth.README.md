# Reconstruction ground truth

The administrator manages cases at `/recon/ground-truth`.

- Only manually confirmed, complete 3×3 solves enter the public export.
- `recon-ground-truth.json` is the deterministic API snapshot used by CI; do not edit it directly.
- Run `pnpm --filter @cuberoot/client test:recon-ground-truth` from `core/` to refresh the snapshot and test every confirmed case.
- Final truth contains only cube moves and semantic `// stage` labels. Timing, ellipses, action parentheses and arrows are removed.
