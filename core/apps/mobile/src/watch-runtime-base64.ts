// Adapt browser codecs to the standard typed-array codecs already in QuickJS.
Object.assign(globalThis, {
  btoa: (value: string) => (Uint8Array.from(value, c => c.charCodeAt(0)) as Uint8Array & { toBase64(): string }).toBase64(),
  atob: (value: string) => Array.from((Uint8Array as unknown as { fromBase64(s: string): Uint8Array }).fromBase64(value),
    byte => String.fromCharCode(byte)).join(''),
});
