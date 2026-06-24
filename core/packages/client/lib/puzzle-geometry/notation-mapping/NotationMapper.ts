// Vendored from cubing.js (https://github.com/cubing/cubing.js) v0.63.3 —
// the `puzzle-geometry` subsystem (group theory + geometry compiler) by
// Tomas Rokicki et al. Brought into this repo with the authors' permission.
// Licensed MPL-2.0 (cubing.js is dual "MPL-2.0 OR GPL-3.0-or-later"; used here
// under MPL-2.0, https://mozilla.org/MPL/2.0/). Original: src/cubing/puzzle-geometry/notation-mapping/NotationMapper.ts
// Only change vs upstream: external `../alg`/`../kpuzzle` imports repointed to
// the published `cubing/alg` & `cubing/kpuzzle` (Move/QuantumMove + KPuzzle types).

import { Move } from "cubing/alg";
import type { KPuzzleDefinition } from "cubing/kpuzzle";

export interface NotationMapper {
  notationToInternal(move: Move): Move | null;
  notationToExternal(move: Move): Move | null;
}

export function remapKPuzzleDefinition(
  internalDefinition: KPuzzleDefinition,
  notationMapper: NotationMapper,
): KPuzzleDefinition {
  const externalDefinition: KPuzzleDefinition = {
    ...internalDefinition,
    moves: {},
  };
  for (const [internalMoveName, transformationData] of Object.entries(
    internalDefinition.moves,
  )) {
    let prefix = internalMoveName;
    let suffix = "";
    if (["v", "w"].includes(internalMoveName.at(-1)!)) {
      prefix = internalMoveName.slice(0, -1);
      suffix = internalMoveName.slice(-1);
    }
    const externalPrefix = notationMapper.notationToExternal(
      Move.fromString(prefix),
    );
    if (!externalPrefix) {
      continue;
    }
    const externalMoveName = externalPrefix + suffix;
    if (!externalMoveName) {
      throw new Error(
        `Missing external move name for: ${internalMoveName.toString()}`,
      );
    }
    externalDefinition.moves[externalMoveName.toString()] = transformationData;
  }
  return externalDefinition;
}
