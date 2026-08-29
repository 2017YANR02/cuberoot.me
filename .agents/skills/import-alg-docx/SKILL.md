---
name: import-alg-docx
description: Import or synchronize curated 3x3 algorithm tables from DOCX while preserving order, notation, classifications, tags, scramble links, metrics, diagrams, and left/right-hand formula relationships.
---

# Import algorithm DOCX

## Workflow

1. Start from the repository root, inspect the scoped worktree, and create or update a task tracker under `docs/` before changing data.
2. Use the `documents` skill to render the DOCX and inspect every page; treat visual layout as evidence for table pairing, headings, arrows, and icon meaning.
3. Run `scripts/extract_alg_docx.py` for machine-readable extraction, then reconcile its output against the rendered pages and record counts in the tracker.
4. Ignore green text. Interpret a green `->` or `<-` as a cross-cell scramble link, not as a formula.
5. Map embedded formula icons through `references/import-contract.md`; keep unknown icons unresolved until the user or document identifies them.
6. Run `scripts/add_formula_setups.mts` to invert every normalized formula into its entry-level `setup`; verify every generated state is the intended case before migration and reconcile any source anomaly against the rendered DOCX.
7. Preserve prime marks on 180-degree turns. Put curated DOCX formulas before existing formulas and remove an existing near-duplicate only after normalizing grouping whitespace and the optional prime after `2`.
8. Keep the DOCX category and case order. Never substitute the site's previous grouping.
9. Treat DOCX one-handed formulas as left-handed. Reuse the PLL formula-tag and partner-first left-to-right-hand derivation path to expose right-handed formulas; do not mirror the current case and do not create another mirror implementation.
10. Reuse `AlgCategoryView`, `AlgCaseView`, `CaseThumb`, `AlgPlayer`, formula-tag helpers, and shared `AlgCaseMeta`; keep all formula-type badges neutral gray and the unfiltered menu option concise as `All` / `全部`.
11. Store `ETM` as the first curated formula's execution count and store `ETM*`, `HTM*`, `STM*`, and `ATM*` as optimal metrics. ATM merges simultaneous parallel-layer turns; ETM only merges combinations that a person can execute together.
12. Run `scripts/build_alg_migration.py` with a state-verified mirror map; inspect the generated SQL before applying it.
13. Apply DB data changes in the next numbered migration, preserve unrelated rows, and synchronize the `/dev/schema` migration ledger without overwriting parallel edits.
14. Add parser, contract, UI, and migration regression tests; run targeted tests, client typecheck, migration validation, and desktop plus narrow-screen browser checks.
15. Update the tracker after every completed stage with concrete evidence and unresolved decisions.

## Boundaries

- Reject missing case numbers, duplicate case numbers, malformed five-number metric rows, unsupported arrows, and formulas left empty after green-text removal.
- Preserve non-green inline styling as `algHtml` only through the existing safe algorithm-markup contract.
- Keep the case-level setup for the main thumbnail and use entry-level setups for formula-specific DOCX orientations. Stop on state mismatches by default; when the user explicitly makes the owner DOCX authoritative, preserve only visually confirmed source text and lock the exact exception set in tests and the tracker.
- Build `meta.mirror` from a state-verified M-plane mirror relation. Scramble arrows are unrelated and must not be reused as mirror links.
- Require OLL mirror numbers to be unique, resolvable, and involutive; self-mirror cases point to themselves.
- Do not import diagrams when the existing case sticker data already renders the same state.
- Do not push unless the user explicitly asks or deployment is required by the repository policy.

## Resources

- `scripts/extract_alg_docx.py`: extract headings, paired cases, metrics, formulas, styles, icons, and arrow relations into JSON.
- `scripts/add_formula_setups.mts`: normalize and invert each formula into the entry-level setup consumed by the existing player.
- `scripts/build_alg_migration.py`: generate the guarded, idempotent merge migration from extracted JSON and a verified mirror map.
- `references/import-contract.md`: field, color, icon, ordering, deduplication, and handedness mapping.
