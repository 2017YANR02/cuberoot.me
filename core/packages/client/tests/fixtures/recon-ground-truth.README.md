# Reconstruction ground truth

`recon-ground-truth.xlsx` is the only file edited by hand.

- Append one solve per row; do not rename the first three columns.
- Columns A-C are required: source `/recon/<id>` URL, timer replay URL, exact expected reconstruction.
- Columns D-E are optional context: current wrong output and notes.
- Run `pnpm --filter @cuberoot/client test:recon-ground-truth` from `core/`; it refreshes `recon-ground-truth.json` and tests every populated row.
- `recon-ground-truth.json` is generated for Git diff and AI review; do not edit it directly.
