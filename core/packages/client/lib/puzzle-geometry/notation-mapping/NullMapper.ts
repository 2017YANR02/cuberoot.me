// Vendored from cubing.js (https://github.com/cubing/cubing.js) v0.63.3 —
// the `puzzle-geometry` subsystem (group theory + geometry compiler) by
// Tomas Rokicki et al. Brought into this repo with the authors' permission.
// Licensed MPL-2.0 (cubing.js is dual "MPL-2.0 OR GPL-3.0-or-later"; used here
// under MPL-2.0, https://mozilla.org/MPL/2.0/). Original: src/cubing/puzzle-geometry/notation-mapping/NullMapper.ts
// Only change vs upstream: external `../alg`/`../kpuzzle` imports repointed to
// the published `cubing/alg` & `cubing/kpuzzle` (Move/QuantumMove + KPuzzle types).

import type { Move } from "cubing/alg";
import type { NotationMapper } from "./NotationMapper";

export class NullMapper implements NotationMapper {
  public notationToInternal(move: Move): Move | null {
    return move;
  }

  public notationToExternal(move: Move): Move | null {
    return move;
  }
}
