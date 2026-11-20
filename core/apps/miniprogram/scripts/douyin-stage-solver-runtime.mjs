export const standardWebAssembly = typeof WebAssembly === 'undefined' ? undefined : WebAssembly;
let assemblyRuntime;

export function useWebAssemblyRuntime(runtime) {
  assemblyRuntime = runtime;
}

// Expose the constructors selected by the host to the unmodified wasm-bindgen glue.
const assemblyBindings = {
  get Instance() { return assemblyRuntime.Instance; },
  get Module() { return assemblyRuntime.Module; },
};
export { assemblyBindings as WebAssembly };

export class TextEncoder {
  encode(value = '') {
    const encoded = encodeURIComponent(value);
    const bytes = [];
    for (let i = 0; i < encoded.length; i++) {
      if (encoded[i] === '%') {
        bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
        i += 2;
      } else bytes.push(encoded.charCodeAt(i));
    }
    return Uint8Array.from(bytes);
  }
}

export class TextDecoder {
  decode(bytes) {
    if (!bytes?.length) return '';
    const chunks = [];
    let ascii = true;
    for (let i = 0; i < bytes.length; i += 4096) {
      const chunk = bytes.subarray(i, i + 4096);
      ascii &&= !chunk.some(value => value >= 128);
      chunks.push(String.fromCharCode(...chunk));
    }
    const value = chunks.join('');
    if (ascii) return value;
    return decodeURIComponent(value.replace(/[\s\S]/g, character =>
      `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`));
  }
}
