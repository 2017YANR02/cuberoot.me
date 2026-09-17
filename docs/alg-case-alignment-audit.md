# Formula case alignment audit — 2026-09-16

The public case setup is now the reference for its thumbnail, scramble, every alternative solution, playback, copying and PDF export. A solution's private inverse setup no longer proves that it belongs to the pictured case. Starting adjustments and necessary finishing adjustments remain visible in both plain and formatted notation. Validation also checks COEP solutions and displayed optimal/COEP scrambles.

The original failure was reproducible in S-: its first solution needed an initial `U`, while the old validator checked the solution against its own inverse and reported success. At the original public angle the fixed sequence is `U R U2' R' U' R U' R'`, against setup `R U R' U R U2' R' U'`.

## Administrator-selected angle

The user replaced the proposed first-solution-based angle with an explicit administrator action. The automatic first-solution rule was removed before release. On supported NxN top-layer diagrams, clicking the case picture saves a clockwise quarter turn. The common setup gains `U`; all solutions are realigned to that state, with adjacent U turns cancelled or combined using the puzzle's turn order. Unchanged rich-text finger marks are retained. Clicking four times restores the starting state.

For S-, one click changes the setup to `R U R' U R U2' R'`. Its first solution becomes `R U2' R' U' R U' R'`; its second begins with only `U'`, without an adjacent `U U'` pair. The diagram, copied sequences, PDF and player all consume the same adjusted state.

The existing authenticated case-update API persists the angle. Before writing, the client validates the candidate and reads the actual database row, preserving every stored algorithm and field. In particular, CMLL's runtime OH merge is not written back as duplicate source formulas. The UI changes only after a successful save, and detail-page administrators bypass the normal public read cache. A temporary angle selected in the page controls is included in the saved picture and then reset to the new default. Existing source failures remain failures rather than blocking all other rows or being deleted.

## Confirmed source relocations

The user explicitly authorized moving misplaced formulas and required that no formula be deleted. These 13 moves were applied through the production admin API, with a destination copy written before the misplaced source occurrence was removed. Each affected set was read back and its entire case payload compared with the planned result. Formula counts are unchanged.

| Set | Source case → destination case | Entries | Set total before / after |
| --- | --- | ---: | ---: |
| OLL | T → L; L → T | 2 | 462 / 462 |
| 2x2 LS-3 | Stollery-A 3 → Gun-B 3 | 1 | 151 / 151 |
| Megaminx CO | CO 9 → CO 10 | 1 | 32 / 32 |
| Pyraminx L4E | Bad Hedge → Upper Edge Flipped #7 | 3 | 202 / 202 |
| Skewb Sarah's Advanced | 5b → 5c; 9a → 8d; 13b → 12a; 13d → 12a; 18f → 19d | 5 | 448 / 448 |
| SQ1 CSP | Muffin / Barrel (Even) → Right Fist / Right Fist (Even) | 1 | 201 / 201 |

The corrected OLL left-hand entries, including their public starting adjustment, are:

- **T:** `U' x (l B l' U) (l B' l' U') x'`
- **L:** `U' x (l B' l' U) (l B l' U') x'`

The exact original entries, destination entries, tags, source IDs and case IDs are retained in `core/packages/client/tests/fixtures/alg-case-relocations.json`. Do not reintroduce the historical T/L transposition when reimporting the DOCX. The earlier source exceptions in `oll-docx-migration.md` describe the original import, before these user-authorized relocations.

## Coverage and unresolved source data

- Full public snapshot: 71 sets, 24,633 source entries; 24,684 entries after the existing CMLL/OH merge. The historical snapshot remains intact in the regression fixture, including misplaced entries, to ensure the validator continues to detect them.
- Every accepted entry is executed from the public setup. All four display angles are checked for 3x3 top-layer sets. Derived right-hand OLL/PLL entries, formatted notation, PDF state, and source-preserving reorder payloads are covered.
- 13 entries had a unique verified destination within their set and were moved. Entries without a unique destination remain in the library, with their original text and attribution. They cannot silently become valid playback or training exercises.
- After relocation and the inverse-double parser fix, the earlier 71-set scan found 476 unmatched primary source rows. These are unresolved data/notation cases, not a claim that the entire source collection has been corrected. The subsequent U-reduction regression keeps the historical snapshot's exact 489 exception identities unchanged (including the 13 now-relocated entries), with 6,583 displayed sequences adjusted or simplified. Metadata discrepancies are additionally included in the page's validation report.
- **F-**, **I4** and **DPi** each still contain one source formula that fails the OLL preconditions and matches none of the 57 OLL cases under the supported starting adjustments. Moving them to an arbitrary OLL case would not repair them. Their original text is retained for review.
- Failures in other puzzles can involve source notation, an incomplete phase definition, or a mismatched initial state. A failed match alone is not evidence of a typo; no speculative source replacements were made.
- Fixed the shared Sarah-notation translator's missing inverse-double suffix support (`r2'`, `L2'`, `S2'`, `H2'`). A corner's `2'` must retain its signed amount because skewb corner turns have order three. Actual sequence/inverse tests cover the three affected first-solution cases and inverse macro doubles.
- Where the source supplies no independent case setup, the existing first-solution convention remains the reference. This audit establishes consistency with that reference, not independent proof that every upstream label is correct.

## Verification and release boundary

- Client typecheck passed. Full-corpus execution, common-state rendering/PDF tests, source-preservation tests and related validation/preference/community regressions passed.
- Local browser evidence: S- shows the initial U and its matching diagram; T/L show the relocated entries. Representative 2x2, SQ1, Megaminx, Pyraminx and FTO pages rendered at 390 px with no page errors or horizontal overflow.
- The 13 data relocations are applied and read back from production. Frontend code changes are local; no code push or frontend deployment is included in this audit.
- The administrator-rotation follow-up passed client typecheck and 169 tests across nine files, including the complete 71-set snapshot, four-save round trips, failed saves, fresh-load equivalence, source retention and CMLL merge protection. Browser QA exercised list and detail clicks, four rotations, refresh, a rejected save, non-admin visibility and a 390 px detail layout, with no page errors or overflow. Copied text matches the rotated solution, the player reaches its seventh move, and the rotation button retains its keyboard focus ring in all four system/explicit light/dark combinations. Save requests in this browser QA were intercepted and stored only in the test fixture; this follow-up changed no production data.
