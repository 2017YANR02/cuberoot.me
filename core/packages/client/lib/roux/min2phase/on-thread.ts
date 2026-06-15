// NOTE(port): removed unused `import {Sequence} from "alg"` and
// `import {Transformation} from "kpuzzle"` — both were unused and those
// packages are not installed in this monorepo (would break module resolution).
import {Min2PhaseSolver} from "./min2phase-solver"
import {initialize, solve} from "./min2phase-wrapper"
import { CubieCube } from "../CubeLib";

export class OnThreadMin2Phase implements Min2PhaseSolver {
  async initialize(): Promise<void> {
    return initialize();
  }
  async solve(state: CubieCube): Promise<string> {
    return solve(state);
  }
}
