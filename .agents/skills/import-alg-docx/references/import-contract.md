# DOCX import contract

## Source semantics

- Green text: ignore.
- Green `->`: the current left case uses the right case's first imported restore formula as its scramble.
- Green `<-`: the current right case uses the left case's first imported restore formula as its scramble.
- Left-hand icon: `oh` source tag. The right-hand view takes the mirror partner's left-hand formulas, then applies the canonical PLL M-plane mirror path.
- Foot icon: `ft`.
- Pen icon: `fmc`.
- Large-order grid icon: `big`.
- Keyboard icon: `key`.

## Metrics

The five numbers after a case name are ordered as `ETM, ETM*, HTM*, STM*, ATM*`.

- `ETM`: execution moves for the first imported formula.
- `ETM*`: optimal execution moves.
- `HTM*`: optimal half-turn metric.
- `STM*`: optimal slice-turn metric.
- `ATM*`: optimal action-turn metric, merging simultaneous parallel-layer turns.

## Merge rules

- Preserve the DOCX case, category, and formula order.
- Keep DOCX formulas before existing formulas.
- Preserve `R2'`, `U2'`, and equivalent explicit turn directions exactly.
- For duplicate comparison only, ignore whitespace, grouping parentheses, and a prime immediately following a `2` turn.
- When a DOCX formula and an existing formula compare equal, keep the DOCX entry.
- Preserve distinct existing formulas after the imported block.
- Match cases by their stable pre-import identity, fail unless every source case resolves exactly once, and update only the requested puzzle/set.
- Merge metadata into the existing JSON object; never erase unrelated keys.

## One-handed derivation

- Store only `oh`; `oh-right` remains a virtual UI filter and is never written to the database.
- Resolve the target case's `meta.mirror` partner before mirroring formulas.
- Remove source-only finger markup, videos, alternate IDs, and generation provenance from a derived right-hand entry.
- Preserve the mirror partner's curated formula order and skip unsupported formulas instead of exposing the source unchanged.
- Verify every mirror link by OLL state, not by DOCX arrow, name, or visual guess.
