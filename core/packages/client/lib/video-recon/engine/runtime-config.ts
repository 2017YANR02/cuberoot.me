import type { InferenceBackend } from "./detector";

/** API presence alone does not mean hardware or browser policy permits WebGPU. */
export async function hasWebGpuAdapter(gpu: Pick<GPU, 'requestAdapter'> | undefined): Promise<boolean> {
  try { return Boolean(await gpu?.requestAdapter()); }
  catch { return false; }
}

/** WebGPU keeps one WASM orchestration thread; CPU gets an isolated SIMD pool. */
export function wasmThreadCount(
  backend: InferenceBackend,
  isolated: boolean,
  cores: number,
): number {
  if (backend !== "wasm" || !isolated) return 1;
  return Math.max(
    1,
    Math.min(4, Math.floor(Number.isFinite(cores) ? cores : 1)),
  );
}
