# Scramble hub artwork

Transparent WebP decorations for `/scramble`, cropped and composed from the eight
reference screenshots supplied for this page. The pictures are decorative;
card labels and navigation remain real text in the page component.

| Asset | Source and treatment |
| --- | --- |
| `generate.webp` | Image 1: first three scramble rows and their cube nets; remove the table background. |
| `solve.webp` | Image 2: isolate the cube, preserving the white center sticker. |
| `pattern.webp` | Images 3, 4, 5: isolate and combine all three pattern cubes. |
| `batch.webp` | Image 1: six different cube nets arranged as a batch. |
| `symmetry.webp` | Image 6: crop rotation and reflection symbols into two rows. |
| `hardest.webp` | Image 7: crop the four examples and remove the page background. |
| `mcc.webp` | Image 8: crop the upper part of the move-cost table and remove its background. |
| `subsolver.webp` | Images 2 and 6: combine a partially colored cube with rotation symbols. |

`batch` and `subsolver` are suggested illustrations using the supplied material;
they can be replaced independently without changing the navigation or layout.

Background removal uses edge-connected neutral pixels so white stickers enclosed
by cube outlines remain opaque. Screenshot text also has its white counters
cleared; cube-net areas retain their enclosed white stickers. Page CSS controls
opacity, framing, and the mask fade that keeps the card labels readable. The
card itself continues to use the shared `panel` surface and theme tokens.
