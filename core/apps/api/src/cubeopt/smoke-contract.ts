export interface CubeoptSmokeResult {
  htm: number;
  solution: string;
}

/** The production smoke is intentionally byte-exact: R must solve as R'. */
export function assertCubeoptSmokeResult(result: CubeoptSmokeResult): void {
  if (result.htm !== 1 || result.solution !== "R'") {
    throw new Error(`unexpected smoke result: ${JSON.stringify(result)}`);
  }
}
