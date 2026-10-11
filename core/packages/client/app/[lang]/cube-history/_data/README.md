# Catalog transport

The nine research JSON files remain the editable source of truth. `catalog-source.ts`
assembles them with the existing domestic-price rule. `catalog.compact.json` is a
lossless generated dictionary, decoded by `catalog.ts`; no description, source,
comparison field or export field is omitted.

After editing research records, run from `core/`:

```
pnpm --filter @cuberoot/client build:cube-history
```

Run this even when the development server is already open, so its hot reload sees
the new generated file. New dev sessions and production builds regenerate it
automatically. `check:cube-history` checks freshness without writing; the complete
round-trip test also rejects stale generated data in CI. Do not edit the compact
file manually.
