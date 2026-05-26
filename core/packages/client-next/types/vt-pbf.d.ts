declare module 'vt-pbf' {
  interface LayerDict {
    [name: string]: unknown;
  }
  function vtpbf(tile: { layers: LayerDict }): Uint8Array;
  export default vtpbf;
}
