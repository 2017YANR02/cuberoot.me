/** Lossless dictionary encoding for the research catalog; no facts are truncated. */
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Packed = null | boolean | number | Packed[];
export interface PackedCatalog { strings: string[]; shapes: number[][]; value: Packed }
export function encodeCatalog(value: unknown): PackedCatalog {
  const strings: string[] = [], shapes: number[][] = [];
  const stringIds = new Map<string, number>(), shapeIds = new Map<string, number>();
  const intern = (s: string) => {
    let id = stringIds.get(s);
    if (id === undefined) { id = strings.length; strings.push(s); stringIds.set(s, id); }
    return id;
  };
  const pack = (v: Json): Packed => {
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'string') return intern(v);
    if (typeof v === 'number') return [0, v];
    if (Array.isArray(v)) return [1, ...v.map(pack)];
    const keys = Object.keys(v).map(intern), key = keys.join(',');
    let shape = shapeIds.get(key);
    if (shape === undefined) { shape = shapes.length; shapes.push(keys); shapeIds.set(key, shape); }
    return [shape + 2, ...Object.values(v).map(pack)];
  };
  const packed = pack(value as Json);
  return { strings, shapes, value: packed };
}
export function decodeCatalog<T>(catalog: PackedCatalog): T {
  const unpack = (v: Packed): Json => {
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') return catalog.strings[v];
    const [tag, ...values] = v as [number, ...Packed[]];
    if (tag === 0) return values[0] as number;
    if (tag === 1) return values.map(unpack);
    return Object.fromEntries(catalog.shapes[tag - 2].map((key, i) => [catalog.strings[key], unpack(values[i])]));
  };
  return unpack(catalog.value) as T;
}
