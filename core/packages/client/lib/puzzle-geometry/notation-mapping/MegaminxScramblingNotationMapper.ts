// Vendored from cubing.js (https://github.com/cubing/cubing.js) v0.63.3 —
// the `puzzle-geometry` subsystem (group theory + geometry compiler) by
// Tomas Rokicki et al. Brought into this repo with the authors' permission.
// Licensed MPL-2.0 (cubing.js is dual "MPL-2.0 OR GPL-3.0-or-later"; used here
// under MPL-2.0, https://mozilla.org/MPL/2.0/). Original: src/cubing/puzzle-geometry/notation-mapping/MegaminxScramblingNotationMapper.ts
// Only change vs upstream: external `../alg`/`../kpuzzle` imports repointed to
// the published `cubing/alg` & `cubing/kpuzzle` (Move/QuantumMove + KPuzzle types).

// Sits on top of a (possibly null) notation mapper, and

import { Move, QuantumMove } from "cubing/alg";
import type { NotationMapper } from "./NotationMapper";

// adds R++/R--/D++/D-- notation mapping.
export class MegaminxScramblingNotationMapper implements NotationMapper {
  constructor(private child: NotationMapper) {}

  public notationToInternal(move: Move): Move | null {
    if (move.innerLayer === undefined && move.outerLayer === undefined) {
      if (Math.abs(move.amount) === 1) {
        if (move.family === "R++") {
          return new Move(new QuantumMove("L", 3, 2), -2 * move.amount);
        } else if (move.family === "R--") {
          return new Move(new QuantumMove("L", 3, 2), 2 * move.amount);
        } else if (move.family === "D++") {
          return new Move(new QuantumMove("U", 3, 2), -2 * move.amount);
        } else if (move.family === "D--") {
          return new Move(new QuantumMove("U", 3, 2), 2 * move.amount);
        }

        // TODO: Figure out if `cubing/alg` should parse `R++` to a family of `R++`.
        if (move.family === "R_PLUSPLUS_") {
          return new Move(new QuantumMove("L", 3, 2), -2 * move.amount);
        } else if (move.family === "D_PLUSPLUS_") {
          return new Move(new QuantumMove("U", 3, 2), -2 * move.amount);
        }
      }
      if (move.family === "y") {
        return new Move("Uv", move.amount);
      }
      if (move.family === "x" && Math.abs(move.amount) === 2) {
        return new Move("ERv", move.amount / 2);
      }
    }
    return this.child.notationToInternal(move);
  }

  // we never rewrite click moves to these moves.
  public notationToExternal(move: Move): Move | null {
    if (move.family === "ERv" && Math.abs(move.amount) === 1) {
      return new Move(
        new QuantumMove("x", move.innerLayer, move.outerLayer),
        move.amount * 2,
      );
    }
    if (move.family === "ILv" && Math.abs(move.amount) === 1) {
      return new Move(
        new QuantumMove("x", move.innerLayer, move.outerLayer),
        -move.amount * 2,
      );
    }
    if (move.family === "Uv") {
      return new Move(
        new QuantumMove("y", move.innerLayer, move.outerLayer),
        move.amount,
      );
    }
    if (move.family === "Dv") {
      return new Move("y", -move.amount);
    }
    return this.child.notationToExternal(move);
  }
}
