/** Syntax parsing alone does not validate a move against a particular PG puzzle. */
export function pgAlgError(kpuzzle: { algToTransformation: (alg: string) => unknown }, alg: string): string | null {
  try {
    kpuzzle.algToTransformation(alg);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
