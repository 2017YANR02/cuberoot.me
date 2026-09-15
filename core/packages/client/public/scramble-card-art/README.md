# Scramble hub artwork

Transparent WebP decorations for `/scramble`, cropped and composed from the eight
reference screenshots supplied for this page. The pictures are decorative;
card labels and navigation remain real text in the page component.

| Asset | Source and treatment |
| --- | --- |
| `generate.webp` | Image 1: the first cube net, paired with its scramble as real text on wide screens. |
| `solve.webp` | Image 2: isolate the cube, preserving the white center sticker. |
| `pattern.webp` | Images 3, 4, 5: one central pattern cube with two smaller companions. |
| `batch.webp` | Image 1: three different cube nets in a single row. |
| `symmetry.webp` | Image 6: eighteen rotation/reflection diagrams in six columns and three rows. Native-resolution crops are displayed smaller than the source to avoid enlargement blur; tiny screenshot labels are omitted. |
| `hardest.webp` | Image 7: the first cube net, paired with its `H* 20` value as real text. |
| `mcc.webp` | Image 8: the first three action rows and their current costs, omitting the other columns. |
| `subsolver.webp` | Image 2: a partially colored cube, paired with `U / R / F` as real text. |

`batch` and `subsolver` are suggested illustrations using the supplied material;
they can be replaced independently without changing the navigation or layout.

Background removal uses edge-connected neutral pixels so white stickers enclosed
by cube outlines remain opaque. Screenshot text also has its white counters
cleared; cube-net areas retain their enclosed white stickers. Page CSS controls
framing and light translucency. Illustrations use `contain` in their own layout
row, above the labels, without gradient masks or overlap. Desktop layout uses
two primary cards, two medium cards, then four compact cards; small screens use
two columns in the same reading order. The cards continue to use the shared
`panel` surface and theme tokens.
