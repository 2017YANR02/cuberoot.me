// Vendored from cubing.js (https://github.com/cubing/cubing.js) v0.63.3 —
// the `puzzle-geometry` subsystem (group theory + geometry compiler) by
// Tomas Rokicki et al. Brought into this repo with the authors' permission.
// Licensed MPL-2.0 (cubing.js is dual "MPL-2.0 OR GPL-3.0-or-later"; used here
// under MPL-2.0, https://mozilla.org/MPL/2.0/). Original: src/cubing/puzzle-geometry/notation-mapping/NxNxNCubeMapper.ts
// Only change vs upstream: external `../alg`/`../kpuzzle` imports repointed to
// the published `cubing/alg` & `cubing/kpuzzle` (Move/QuantumMove + KPuzzle types).

import { Move, QuantumMove } from "cubing/alg";
import type { NotationMapper } from "./NotationMapper";

export class NxNxNCubeMapper implements NotationMapper {
  constructor(public slices: number) {}

  public notationToInternal(move: Move): Move {
    const grip = move.family;
    if (!(move.innerLayer || move.outerLayer)) {
      if (grip === "x") {
        move = new Move("Rv", move.amount);
      } else if (grip === "y") {
        move = new Move("Uv", move.amount);
      } else if (grip === "z") {
        move = new Move("Fv", move.amount);
      }
      if ((this.slices & 1) === 1) {
        if (grip === "E") {
          move = new Move(
            new QuantumMove("D", (this.slices + 1) / 2),
            move.amount,
          );
        } else if (grip === "M") {
          move = new Move(
            new QuantumMove("L", (this.slices + 1) / 2),
            move.amount,
          );
        } else if (grip === "S") {
          move = new Move(
            new QuantumMove("F", (this.slices + 1) / 2),
            move.amount,
          );
        }
      }
      if (this.slices > 2) {
        if (grip === "e") {
          move = new Move(
            new QuantumMove("D", this.slices - 1, 2),
            move.amount,
          );
        } else if (grip === "m") {
          move = new Move(
            new QuantumMove("L", this.slices - 1, 2),
            move.amount,
          );
        } else if (grip === "s") {
          move = new Move(
            new QuantumMove("F", this.slices - 1, 2),
            move.amount,
          );
        }
      }
    }
    return move;
  }

  // do we want to map slice moves to E/M/S instead of 2U/etc.?
  public notationToExternal(move: Move): Move {
    const grip = move.family;
    if (!(move.innerLayer || move.outerLayer)) {
      if (grip === "Rv") {
        return new Move("x", move.amount);
      } else if (grip === "Uv") {
        return new Move("y", move.amount);
      } else if (grip === "Fv") {
        return new Move("z", move.amount);
      } else if (grip === "Lv") {
        return new Move("x", -move.amount);
      } else if (grip === "Dv") {
        return new Move("y", -move.amount);
      } else if (grip === "Bv") {
        return new Move("z", -move.amount);
      }
    }
    return move;
  }
}
