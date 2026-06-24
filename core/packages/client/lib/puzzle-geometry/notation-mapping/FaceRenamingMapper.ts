// Vendored from cubing.js (https://github.com/cubing/cubing.js) v0.63.3 —
// the `puzzle-geometry` subsystem (group theory + geometry compiler) by
// Tomas Rokicki et al. Brought into this repo with the authors' permission.
// Licensed MPL-2.0 (cubing.js is dual "MPL-2.0 OR GPL-3.0-or-later"; used here
// under MPL-2.0, https://mozilla.org/MPL/2.0/). Original: src/cubing/puzzle-geometry/notation-mapping/FaceRenamingMapper.ts
// Only change vs upstream: external `../alg`/`../kpuzzle` imports repointed to
// the published `cubing/alg` & `cubing/kpuzzle` (Move/QuantumMove + KPuzzle types).

// face renaming mapper.  Accepts two face name remappers.  We
// work between the two.

import { Move, QuantumMove } from "cubing/alg";
import type { FaceNameSwizzler } from "../FaceNameSwizzler";
import type { NotationMapper } from "./NotationMapper";

export class FaceRenamingMapper implements NotationMapper {
  constructor(
    public internalNames: FaceNameSwizzler,
    public externalNames: FaceNameSwizzler,
  ) {}

  // TODO:  consider putting a cache in front of this
  public convertString(
    grip: string,
    a: FaceNameSwizzler,
    b: FaceNameSwizzler,
  ): string {
    let suffix = "";
    if ((grip.endsWith("v") || grip.endsWith("v")) && grip <= "_") {
      suffix = grip.slice(grip.length - 1);
      grip = grip.slice(0, grip.length - 1);
    }
    const upper = grip.toUpperCase();
    let isLowerCase = false;
    if (grip !== upper) {
      isLowerCase = true;
      grip = upper;
    }
    grip = b.joinByFaceIndices(a.splitByFaceNames(grip));
    if (isLowerCase) {
      grip = grip.toLowerCase();
    }
    return grip + suffix;
  }

  public convert(move: Move, a: FaceNameSwizzler, b: FaceNameSwizzler): Move {
    const grip = move.family;
    const ngrip = this.convertString(grip, a, b);
    if (grip === ngrip) {
      return move;
    } else {
      return new Move(
        new QuantumMove(ngrip, move.innerLayer, move.outerLayer),
        move.amount,
      );
    }
  }

  public notationToInternal(move: Move): Move {
    const r = this.convert(move, this.externalNames, this.internalNames);
    return r;
  }

  public notationToExternal(move: Move): Move {
    return this.convert(move, this.internalNames, this.externalNames);
  }
}
