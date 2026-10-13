// Static audit of the nine preserved upstream binaries; no WASM instantiation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const HASHES = [
  ['cb538e00a5b5ba7a80fa7008c70077ebd62cae8e78f77a7d445461c6fa0d801c', '04c0e38f79fa64b7517f32a0dfac858e73e3201a84e7f42a0bd1e9a1e5e8c347'],
  ['c1b441022b1f1034a458ce07602cfc1638f92e31671399ab20416282d9caf0ad', '9017043e886c13a0312a951a5ab9fb8f7650f285b9185de603a9aab7f612c5d8'],
  ['9c21eaa5b18e3fbda11a0ad2f1f5ef514db782440fbe33b83857fc086708a247', '78812e7d32dd4fd6b50eb36af244d399d73bf2a726f606413e3c9b5a11127eb8'],
  ['9980620d29f954557adcd05f692b34deacf2e04c8a45f2c172fcd7cf921ef53e', '37ac455c506b4f734b87a6717fb7e8322d966301ae69bc43fe189e0fc764c9bd'],
  ['a81e6e3394059c51c525f68ad04fec8a6e3e81093ea92e10c71b065e577480bb', '926ca2a0c1eab58b51e596494ed08cffb174e8b20c38767898e27534dc8631ad'],
  ['0cf2bfc58c446dd02a272bd97c117cda3adc54000e3fce2f9d2930c05fe32dfc', '02a28ebbc75a2e13ebefaf1b682a938dbb03be1598213e675183a99fb1f0e9ef'],
  ['bc909ade2a52cfbea5c2580b82ecde53f327b1e89ee5280418ffe0016249c2f1', '06a4ba311e0ad972351ad894300f128fe49d6a362846ff3874bf24a984b0b582'],
  ['63e2f0c1c24c9ed6bf5be09040578f22ca091f0fd417ccf5d81dce26f472b5f7', '6f829dd9fcfc9a6d83cd9945c325b4ee8cf7e877149900277d8776e3a7bcf107'],
  ['a041e72e9a05182425722c18a1c262cd0ac6018014c5dcd817069693883a734f', '9b5459d934600f3b24f34d3a6158a881dbceb9a6fa427c9857888dc60e4efe2d'],
];

// p is a native pointer: i32 in opt1..7, i64 in opt8/9. These indices,
// demangled names and exact signatures were checked independently in all nine.
export const FUNCTION_SPECS = {
  oracle_step1_query: { index: 37, name: 'step1_query(ida_context*, stat_info&)', parameters: 'pp', results: 'i' },
  oracle_cubie2fast: { index: 40, name: 'cubie2fast(cubie const&)', parameters: 'pp', results: '' },
  oracle_input_scramble: { index: 71, name: 'input_scramble(cubie&, char const*)', parameters: 'pp', results: 'i' },
  oracle_init_cubeopt: { index: 72, name: 'init_cubeopt()', parameters: '', results: '' },
  oracle_corn_mult: { index: 89, name: 'corn_mult(cubie const&, cubie const&, cubie&)', parameters: 'ppp', results: '' },
  oracle_edge_mult: { index: 90, name: 'edge_mult(cubie const&, cubie const&, cubie&)', parameters: 'ppp', results: '' },
  oracle_solved_cubie: { index: 92, name: 'solved_cubie()', parameters: 'p', results: '' },
  oracle_is_solved: { index: 93, name: 'is_solved(cubie const&)', parameters: 'p', results: 'i' },
  oracle_cube_move: { index: 94, name: 'cube_move(cubie const&, int, cubie&)', parameters: 'pip', results: '' },
  oracle_edge_conj: { index: 95, name: 'edge_conj(cubie const&, int, cubie&)', parameters: 'pip', results: '' },
  oracle_corn_conj: { index: 96, name: 'corn_conj(cubie const&, int, cubie&)', parameters: 'pip', results: '' },
  oracle_set_corn_idx: { index: 98, name: 'set_corn_idx(cubie&, int, int)', parameters: 'pii', results: '' },
  oracle_set_edge_idx: { index: 99, name: 'set_edge_idx(cubie&, int)', parameters: 'pi', results: '' },
};

export function getVariant(value = process.env.CUBEOPT_VARIANT ?? '1') {
  assert(/^[1-9]$/.test(String(value)), 'CUBEOPT_VARIANT must be one integer from 1 through 9');
  const id = Number(value), memory64 = id >= 8;
  const shift = id === 1 ? 0 : memory64 ? 1152 : 96;
  const tableBytes = id === 1 ? 30_401_280 : 121_605_120 * 2 ** (id - 2);
  const fastMoveBytes = memory64 ? 19_208_560 : 19_208_544;
  const frontierBytes = id === 1 ? 0 : tableBytes / 16;
  const regions = {
    symmetryCubies: { offset: 189856 + shift, count: 48, stride: 20 },
    moveCubies: { offset: 190816 + shift, count: 18, stride: 20 },
    symmetryProducts: { offset: 191184 + shift, count: 2304, stride: 1 },
    symmetryProductsReverse: { offset: 193488 + shift, count: 2304, stride: 1 },
    symmetryInverse: { offset: 195792 + shift, count: 48, stride: 1 },
    cornerRawToSym: { offset: 204496 + shift, count: 153090, stride: 4 },
    separation8: { offset: memory64 ? 7392 : 6560 + shift, count: 128, stride: 1 },
    separation12: { offset: memory64 ? 7520 : 6688 + shift, count: 2048, stride: 2 },
    mask8: { offset: 201888 + shift, count: 70, stride: 1 },
    mask12: { offset: 201968 + shift, count: 512, stride: 2 },
  };
  return {
    id, memory64, wasmSha256: HASHES[id - 1][0], wrapperSha256: HASHES[id - 1][1],
    tableBytes, tableName: id === 1 ? 'h48prun01.dat' : `h48prun31h${id}.dat`,
    memoryMaximumPages: memory64 ? 262144 : 65536,
    // Reserve the worst-case retained-prefix copy during frontier compaction,
    // but never exceed the original binary's address-space limit. In opt7/9
    // that limit is smaller than this conservative estimate; actual retained
    // size, allocator/runtime overhead and RSS still require monitoring.
    linearMemoryLimitPages: Math.min(memory64 ? 262144 : 65536, Math.ceil(Math.max(256 * 2 ** 20, tableBytes + fastMoveBytes + 2 * frontierBytes + 128 * 2 ** 20) / 65536)),
    fastMoveBytes, frontierBytes, frontierCopyUpperBoundBytes: frontierBytes,
    largeGenerationBuffersBytes: tableBytes + fastMoveBytes + frontierBytes,
    smallMemoryBytes: 816856 + shift, regions,
    context: memory64 ? { bytes: 1472, stackPointer: 1432, budget: 1440, status: 1444, index: 1448 } : { bytes: 1464, stackPointer: 1428, budget: 1432, status: 1436, index: 1440 },
  };
}

// Parse only binary metadata; deliberately avoids WebAssembly.Module/Instance.
export function auditBinary(bytes, variant = getVariant()) {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), variant.wasmSha256, 'upstream WASM changed: re-audit');
  assert.equal(bytes.subarray(0, 8).toString('hex'), '0061736d01000000');
  const cursor = { offset: 8 }, types = [], functions = [], names = new Map();
  let memory;
  function leb() {
    let value = 0, factor = 1;
    for (let i = 0; i < 8; i++) { assert(cursor.offset < bytes.length); const b = bytes[cursor.offset++]; value += (b & 127) * factor; if (!(b & 128)) { assert(Number.isSafeInteger(value)); return value; } factor *= 128; }
    throw Error('invalid metadata LEB');
  }
  function string() { const size = leb(); const text = bytes.toString('utf8', cursor.offset, cursor.offset + size); cursor.offset += size; return text; }
  function limits() { const flags = leb(), initial = leb(), maximum = flags & 1 ? leb() : null; return { flags, initial, maximum }; }
  while (cursor.offset < bytes.length) {
    const id = bytes[cursor.offset++], size = leb(), end = cursor.offset + size; assert(end <= bytes.length);
    if (id === 1) {
      const count = leb();
      for (let i = 0; i < count; i++) {
        assert.equal(bytes[cursor.offset++], 96); const n = leb(); const parameters = [...bytes.subarray(cursor.offset, cursor.offset + n)]; cursor.offset += n;
        const r = leb(); const results = [...bytes.subarray(cursor.offset, cursor.offset + r)]; cursor.offset += r; types.push({ parameters, results });
      }
    } else if (id === 2) {
      const count = leb();
      for (let i = 0; i < count; i++) {
        string(); const name = string(), kind = bytes[cursor.offset++];
        if (kind === 0) functions.push(leb());
        else if (kind === 1) { cursor.offset++; limits(); }
        else if (kind === 2) { assert(!memory, 'unexpected multiple memories'); memory = { name, ...limits() }; }
        else if (kind === 3) cursor.offset += 2;
        else throw Error(`unexpected import kind ${kind}`);
      }
    } else if (id === 3) { const count = leb(); for (let i = 0; i < count; i++) functions.push(leb()); }
    else if (id === 0 && string() === 'name') {
      while (cursor.offset < end) {
        const sub = bytes[cursor.offset++], length = leb(), subEnd = cursor.offset + length;
        if (sub === 1) { const count = leb(); for (let i = 0; i < count; i++) { const index = leb(); names.set(index, string()); } }
        cursor.offset = subEnd;
      }
    }
    cursor.offset = end;
  }
  assert.deepEqual(memory, { name: 'memory', flags: variant.memory64 ? 7 : 3, initial: 256, maximum: variant.memoryMaximumPages });
  for (const spec of Object.values(FUNCTION_SPECS)) {
    assert.equal(names.get(spec.index), spec.name, `function name at ${spec.index}`);
    const encode = (signature) => [...signature].map((type) => type === 'p' && variant.memory64 ? 126 : 127);
    assert.deepEqual(types[functions[spec.index]], { parameters: encode(spec.parameters), results: encode(spec.results) }, `signature of ${spec.name}`);
  }
  return { variant: variant.id, memory, functionsVerified: Object.keys(FUNCTION_SPECS).length };
}
