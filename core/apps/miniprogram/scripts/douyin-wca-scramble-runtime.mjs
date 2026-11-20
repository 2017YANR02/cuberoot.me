import { gunzipSync } from 'fflate';

export { TextDecoder, TextEncoder } from './douyin-stage-solver-runtime.mjs';

let entropy;
let entropyCursor = 0;

export function beginScrambleEntropy(buffer) {
  entropy = new Uint8Array(buffer);
  entropyCursor = 0;
}

export function endScrambleEntropy() {
  entropy = undefined;
}

// Both upstream random-uint-below and Twips use Web Crypto synchronously.
// The Mini Program main thread supplies this job's bytes via tt.getRandomValues.
// Worker jobs are serialized and never reuse a previous job's random bytes.
const nativeScrambleGlobal = {
  Math,
  crypto: {
    getRandomValues(array) {
      const end = entropyCursor + array.byteLength;
      if (!entropy || end > entropy.byteLength) throw new Error('Native scramble entropy exhausted');
      new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(entropy.subarray(entropyCursor, end));
      entropyCursor = end;
      return array;
    },
  },
  performance: Date,
};

export { nativeScrambleGlobal as globalThis };
export const performance = Date;

export async function instantiateNativeScrambleWasm(imports, loadCompressedBytes) {
  // Developer Tools can expose standard constructors even when its native
  // path loader never resolves. Both inputs are generated from the same
  // installed Twips binary.
  if (typeof WebAssembly !== 'undefined' && WebAssembly !== nativeWasmApi()
      && typeof WebAssembly.Module === 'function' && typeof WebAssembly.Instance === 'function') {
    const { default: compressed } = await loadCompressedBytes();
    const module = new WebAssembly.Module(gunzipSync(compressed));
    return { module, instance: new WebAssembly.Instance(module, imports) };
  }
  return nativeWasmApi()?.instantiate('workers/wca-scramble.wasm.br', imports)
    ?? Promise.reject(new Error('Native timer Worker WebAssembly unavailable'));
}

function nativeWasmApi() {
  return typeof TTWebAssembly === 'undefined' ? undefined : TTWebAssembly;
}
