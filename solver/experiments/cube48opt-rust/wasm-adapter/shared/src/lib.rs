//! Separate shared-memory ABI; no singleton/TLS state and no table copies.
//! The trusted wrapper assigns disjoint allocator arenas and stacks to each
//! instance. Only the immutable PDB, snapshot and atomic cancel word are shared.
#![feature(simd_wasm64)]
use std::alloc::{GlobalAlloc, Layout};
use std::sync::atomic::{AtomicU32, Ordering};
use cube48opt_research::{coord::{Opt8CoordTables, CoordTables, snapshot_bytes}, cube::{Cube, MOVE_NAMES},
    search::{DepthSearch, PruningOracle, SearchShard}, table::Variant};
#[cfg(any(feature = "wasm-coset-batch", feature = "wasm-opt9-batch"))]
use cube48opt_research::coord::Opt9CoordTables;

const CONTROL: usize = 8 * 1024 * 1024;
const SNAPSHOT: usize = CONTROL + 65536;
const PDB: usize = 16 * 1024 * 1024;
#[cfg(feature="production-four")]
const MAX_THREADS: u32 = 4;
#[cfg(not(feature="production-four"))]
const MAX_THREADS: u32 = 18;

#[link(wasm_import_module = "host")]
extern "C" {
    fn allocate(size: usize, align: usize) -> usize;
    fn deallocate(pointer: usize, size: usize, align: usize);
}
struct HostAllocator;
#[global_allocator]
static ALLOCATOR: HostAllocator = HostAllocator;
unsafe impl GlobalAlloc for HostAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 { allocate(layout.size(), layout.align()) as *mut u8 }
    unsafe fn dealloc(&self, p: *mut u8, layout: Layout) { deallocate(p as usize, layout.size(), layout.align()); }
}
fn control(offset: usize) -> &'static AtomicU32 {
    // The wrapper reserves [8 MiB, 8 MiB + 64 KiB), naturally aligned and
    // disjoint from linker data, worker stacks/arenas and table bytes.
    unsafe { &*((CONTROL + offset) as *const AtomicU32) }
}
fn shared_words(variant: Variant) -> Option<&'static [u32]> {
    // Host allocates this exact memory range and never mutates it after the
    // release publication at control(4). No owned Vec points into this region.
    if PDB + variant.bytes() as usize > std::arch::wasm64::memory_size::<0>() * 65536 { return None; }
    Some(unsafe { std::slice::from_raw_parts(PDB as *const u32, variant.bytes() as usize / 4) })
}
struct Oracle {
    coords: Opt8CoordTables,
    words: &'static [u32],
    #[cfg(feature = "small-check")]
    fixture: bool,
}
// Keep the whole eight-slot load pass out of the decoder's function, including
// under LTO: no per-slot decode/normal-coordinate work may delay the next load.
// Bounds checks stay enabled; None never touches the table.
#[inline(never)]
fn load_opt8_probe_words(words: &[u32], queries: &[Option<u64>; 8]) -> [u32; 8] {
    std::array::from_fn(|i| queries[i].map_or(0, |index| words[(index >> 4) as usize]))
}
#[inline(always)]
fn lookup_opt8_batch(words: &[u32], queries: &[Option<u64>; 8]) -> [u8; 8] {
    let loaded = load_opt8_probe_words(words, queries);
    std::array::from_fn(|i| {
        let Some(index) = queries[i] else { return 0; };
        let code = loaded[i] >> ((index & 15) * 2) & 3;
        // Retain the original block-header access for code zero.
        if code == 0 { (words[((index >> 4) as usize) & !3] & 15) as u8 }
        else { code as u8 + 10 }
    })
}

// Independent Opt9 experiment: read both candidates before testing code zero.
// The header is in the same aligned 16-byte block, but the extra load and
// temporary storage may still be slower. Actual WASM select codegen and total
// runtime must be checked separately; this is not a claimed speedup.
#[cfg(feature = "wasm-opt9-select")]
#[inline(never)]
fn load_opt9_probe_pairs(words: &[u32], queries: &[Option<u64>; 8]) -> [[u32; 2]; 8] {
    std::array::from_fn(|i| {
        let Some(index) = queries[i] else { return [0; 2]; };
        let word = (index >> 4) as usize;
        [words[word], words[word & !3] & 15]
    })
}
#[cfg(feature = "wasm-opt9-select")]
#[inline(always)]
fn lookup_opt9_select_batch(words: &[u32], queries: &[Option<u64>; 8]) -> [u8; 8] {
    let loaded = load_opt9_probe_pairs(words, queries);
    std::array::from_fn(|i| {
        let Some(index) = queries[i] else { return 0; };
        let code = loaded[i][0] >> ((index & 15) * 2) & 3;
        if code == 0 { loaded[i][1] as u8 } else { code as u8 + 10 }
    })
}

// Keep this separate from the established batch fixture so the experiment's
// evidence can identify exactly which production decoder was exercised.
#[cfg(all(feature = "small-check", feature = "wasm-opt9-select"))]
#[no_mangle]
pub extern "C" fn cubeopt_fixture_verify_opt9_select_probes() -> i32 {
    if lookup_opt9_select_batch(&[], &[None; 8]) != [0; 8] { return -1; }
    let mut checked = 0;
    let mut seen_codes = 0_u32;
    for phase in 0..4_u32 {
        let mut words = [0_u32; 32];
        for (word, value) in words.iter_mut().enumerate() {
            for slot in 0..16 { *value |= (phase + word as u32 + slot) % 4 << (slot * 2); }
            if word & 3 == 0 { *value = (*value & !15) | ((word as u32 / 4 + phase) % 14); }
        }
        for base in (0..512_u64).step_by(8) {
            for sparse in [false, true] {
                // Deliberately mix words/blocks across lanes, including the
                // header word itself and the last element of the slice.
                let queries = std::array::from_fn(|i| if sparse && i % 2 == 0 { None }
                    else { Some((base + i as u64 * 73) % 512) });
                let actual = lookup_opt9_select_batch(&words, &queries);
                for (i, query) in queries.iter().enumerate() {
                    let Some(index) = query else { if actual[i] != 0 { return -2; } continue; };
                    let code = words[(index >> 4) as usize] >> ((index & 15) * 2) & 3;
                    seen_codes |= 1 << code;
                    if actual[i] != lookup_generic(&words, Variant::new(9).unwrap(), *index) { return -3; }
                    checked += 1;
                }
            }
        }
    }
    if seen_codes != 15 { return -4; }
    checked
}
// Actual-WASM verification of the production load/decode helper with 128B of
// synthetic words. This export is absent from every production artifact.
#[cfg(feature = "small-check")]
#[no_mangle]
pub extern "C" fn cubeopt_fixture_verify_batch_probes() -> i32 {
    // The fixed decoder's +10 is valid for both of these variants, including
    // the code-zero block-header fallback. Never apply it to Opt1..7.
    if Variant::new(8).unwrap().max_bound() != 13 || Variant::new(9).unwrap().max_bound() != 13 { return -5; }
    if lookup_opt8_batch(&[], &[None; 8]) != [0; 8] { return -1; }
    let mut checked = 0;
    let mut seen_codes = 0_u32;
    for phase in 0..4_u32 {
        let mut words = [0_u32; 32];
        for (word, value) in words.iter_mut().enumerate() {
            for slot in 0..16 { *value |= (phase + word as u32 + slot) % 4 << (slot * 2); }
            if word & 3 == 0 { *value = (*value & !15) | ((word as u32 / 4 + phase) % 14); }
        }
        for base in (0..512_u64).step_by(8) {
            for sparse in [false, true] {
                let queries = std::array::from_fn(|i| if sparse && i % 2 == 0 { None } else { Some(base + i as u64) });
                let actual = lookup_opt8_batch(&words, &queries);
                for (i, query) in queries.iter().enumerate() {
                    let Some(index) = query else { if actual[i] != 0 { return -2; } continue; };
                    let word = (index >> 4) as usize;
                    let code = words[word] >> ((index & 15) * 2) & 3;
                    seen_codes |= 1 << code;
                    let expected = if code == 0 { (words[word & !3] & 15) as u8 } else { code as u8 + 10 };
                    if actual[i] != expected { return -3; }
                    if actual[i] != lookup_generic(&words, Variant::new(9).unwrap(), *index) { return -6; }
                    checked += 1;
                }
            }
        }
    }
    if seen_codes != 15 { return -4; }
    checked
}
impl PruningOracle for Oracle {
    type Query = u64;
    #[inline(always)] fn prepare(&self, c: &Cube, _: u8) -> Result<u64, u8> {
        #[cfg(feature = "small-check")]
        if self.fixture { return Ok(0); }
        Ok(self.coords.index(c))
    }
    #[inline(always)] fn lookup(&self, index: u64) -> u8 {
        #[cfg(feature = "small-check")]
        if self.fixture { return 0; }
        let word = (index >> 4) as usize;
        let code = self.words[word] >> ((index & 15) * 2) & 3;
        if code == 0 { (self.words[word & !3] & 15) as u8 } else { code as u8 + 10 }
    }
    #[inline(always)] fn lookup_batch(&self, queries: &[Option<u64>; 8]) -> [u8; 8] {
        #[cfg(feature = "small-check")]
        if self.fixture { return [0; 8]; }
        lookup_opt8_batch(self.words, queries)
    }
    fn conjugate(&self, c: &Cube, symmetry: u8) -> Option<Cube> { Some(self.coords.conjugate(c, symmetry)) }
    fn max_bound(&self) -> u8 { 13 }
    #[inline(always)] fn allow_parent_propagation(&self) -> bool { true }
    #[inline(always)] fn allow_quarter_pruning(&self) -> bool { cfg!(feature = "quarter-fixed") }
    #[inline(always)] fn allow_backward_coset(&self) -> bool { cfg!(feature = "wasm-coset-batch") }
    #[inline(always)] fn cancelled(&self) -> bool { control(0).load(Ordering::Relaxed) != 0 }
}

// Opt9 binds its nine-bit coordinate and the same maximum-bound decoder once
// during construction. The batch-only feature retains quarter pruning but
// does not add coset cuts. Other variants keep their existing oracle.
#[cfg(any(feature = "wasm-coset-batch", feature = "wasm-opt9-batch"))]
struct Opt9Oracle {
    coords: Opt9CoordTables,
    words: &'static [u32],
    #[cfg(feature = "small-check")]
    fixture: bool,
}
#[cfg(any(feature = "wasm-coset-batch", feature = "wasm-opt9-batch"))]
impl PruningOracle for Opt9Oracle {
    type Query = u64;
    #[inline(always)] fn prepare(&self, c: &Cube, _: u8) -> Result<u64, u8> {
        #[cfg(feature = "small-check")]
        if self.fixture { return Ok(0); }
        Ok(self.coords.index(c))
    }
    #[inline(always)] fn lookup(&self, index: u64) -> u8 {
        #[cfg(feature = "small-check")]
        if self.fixture { return 0; }
        let word = (index >> 4) as usize;
        let code = self.words[word] >> ((index & 15) * 2) & 3;
        if code == 0 { (self.words[word & !3] & 15) as u8 } else { code as u8 + 10 }
    }
    #[inline(always)] fn lookup_batch(&self, queries: &[Option<u64>; 8]) -> [u8; 8] {
        #[cfg(feature = "small-check")]
        if self.fixture { return [0; 8]; }
        #[cfg(feature = "wasm-opt9-select")]
        { lookup_opt9_select_batch(self.words, queries) }
        #[cfg(not(feature = "wasm-opt9-select"))]
        { lookup_opt8_batch(self.words, queries) }
    }
    fn conjugate(&self, c: &Cube, symmetry: u8) -> Option<Cube> { Some(self.coords.conjugate(c, symmetry)) }
    fn max_bound(&self) -> u8 { 13 }
    #[inline(always)] fn allow_parent_propagation(&self) -> bool { true }
    #[inline(always)] fn allow_quarter_pruning(&self) -> bool { true }
    #[inline(always)] fn allow_backward_coset(&self) -> bool { cfg!(feature = "wasm-coset-batch") }
    #[inline(always)] fn cancelled(&self) -> bool { control(0).load(Ordering::Relaxed) != 0 }
}
struct GenericOracle {
    coords: CoordTables,
    words: &'static [u32],
    variant: Variant,
    #[cfg(feature = "small-check")]
    fixture: bool,
}
#[inline(always)]
fn lookup_generic(words: &[u32], variant: Variant, index: u64) -> u8 {
    let word = (index >> 4) as usize;
    let code = words[word] >> ((index & 15) * 2) & 3;
    if code == 0 { (words[word & !3] & 15) as u8 }
    else { code as u8 + variant.max_bound() - 3 }
}
impl PruningOracle for GenericOracle {
    type Query = u64;
    #[inline(always)] fn prepare(&self, c: &Cube, _: u8) -> Result<u64, u8> {
        #[cfg(feature = "small-check")]
        if self.fixture { return Ok(0); }
        Ok(self.coords.index64(c))
    }
    #[inline(always)] fn lookup(&self, index: u64) -> u8 {
        #[cfg(feature = "small-check")]
        if self.fixture { return 0; }
        lookup_generic(self.words, self.variant, index)
    }
    fn conjugate(&self, c: &Cube, symmetry: u8) -> Option<Cube> { Some(self.coords.conjugate(c, symmetry)) }
    fn max_bound(&self) -> u8 { self.variant.max_bound() }
    #[inline(always)] fn allow_parent_propagation(&self) -> bool { true }
    // Opt9 shares the left-half-turn coordinate invariance already used by
    // the native quarter rejection. Other generic variants stay unchanged.
    #[inline(always)] fn allow_quarter_pruning(&self) -> bool {
        cfg!(feature = "opt9-quarter-fixed") && self.variant.number() == 9
    }
    #[inline(always)] fn cancelled(&self) -> bool { control(0).load(Ordering::Relaxed) != 0 }
}
enum Backend {
    Opt8(Oracle),
    #[cfg(any(feature = "wasm-coset-batch", feature = "wasm-opt9-batch"))]
    Opt9(Opt9Oracle),
    Generic(GenericOracle),
}
struct State {
    oracle: Backend,
    input: [u8; 4096],
    output: String,
    search: Option<DepthSearch>,
    start: Cube,
    shard: SearchShard,
    #[cfg(all(feature = "small-check", feature = "wasm-root-bound"))]
    fixture_root_bound: bool,
}

#[cfg(feature = "wasm-root-bound")]
#[derive(Clone, Copy)]
struct RootProof { normal: u8, inverse: u8, maximum: u8, source: &'static str }
#[cfg(feature = "wasm-root-bound")]
impl RootProof { fn lower_bound(self) -> u8 { self.normal.max(self.inverse) } }

/// D(g)=D(g^-1), so max(h(g),h(g^-1)) excludes all smaller depths.
/// The checked constructor independently re-reads both bounds. Cancellation or
/// an invalid oracle result never advances the persistent search's depth.
#[cfg(feature = "wasm-root-bound")]
fn begin_with_root_proof<O: PruningOracle>(start: Cube, oracle: &O, shard: SearchShard,
    source: &'static str) -> Result<(DepthSearch, RootProof), String> {
    if oracle.cancelled() { return Err("cancelled before root proof".into()); }
    let read = |cube: &Cube| -> Result<u8, String> {
        if oracle.cancelled() { return Err("cancelled during root proof".into()); }
        let query = oracle.prepare(cube, u8::MAX)
            .map_err(|_| "unlimited root query was rejected".to_owned())?;
        let bound = oracle.lookup(query);
        if bound > oracle.max_bound() { return Err("root bound exceeds oracle maximum".into()); }
        Ok(bound)
    };
    let proof = RootProof { normal: read(&start)?, inverse: read(&start.inverse())?,
        maximum: oracle.max_bound(), source };
    let search = DepthSearch::new_with_initial_depth(start, oracle, shard, proof.lower_bound())?;
    if oracle.cancelled() { return Err("cancelled after root proof".into()); }
    Ok((search, proof))
}

/// A fixture-only admissible subgroup bound: one turn can correct at most four
/// corner twists or four edge flips. Left half turns preserve these counts.
/// The search itself retains the existing zero oracle; only its checked root
/// constructor uses this nonzero proof, without allocating or reading a PDB.
#[cfg(all(feature = "small-check", feature = "wasm-root-bound"))]
struct FixtureRootOracle<'a, O> { oracle: &'a O }
#[cfg(all(feature = "small-check", feature = "wasm-root-bound"))]
impl<O: PruningOracle> PruningOracle for FixtureRootOracle<'_, O> {
    type Query = u8;
    fn prepare(&self, cube: &Cube, _: u8) -> Result<u8, u8> {
        let corners = cube.corners.iter().filter(|&&c| c >> 3 != 0).count();
        let edges = cube.edges.iter().filter(|&&e| e & 1 != 0).count();
        Ok(corners.div_ceil(4).max(edges.div_ceil(4)) as u8)
    }
    fn lookup(&self, query: u8) -> u8 { query }
    fn max_bound(&self) -> u8 { self.oracle.max_bound() }
    fn cancelled(&self) -> bool { self.oracle.cancelled() }
    fn conjugate(&self, cube: &Cube, symmetry: u8) -> Option<Cube> { self.oracle.conjugate(cube, symmetry) }
}

#[cfg(feature = "wasm-root-bound")]
fn begin_backend<O: PruningOracle>(start: Cube, oracle: &O, shard: SearchShard,
    _fixture_proof: bool) -> Result<(DepthSearch, RootProof), String> {
    #[cfg(feature = "small-check")]
    if _fixture_proof {
        return begin_with_root_proof(start, &FixtureRootOracle { oracle }, shard, "fixture-orientation-bound");
    }
    begin_with_root_proof(start, oracle, shard, "pdb-forward-inverse")
}
unsafe fn state<'a>(p: usize) -> &'a mut State { &mut *(p as *mut State) }
fn status(p: usize, action: impl FnOnce(&mut State) -> Result<(), String>) -> i32 {
    // State handles are exclusively owned by the worker's serialized host API.
    let state = unsafe { state(p) };
    state.output.clear();
    match action(state) { Ok(()) => 0, Err(e) => { state.output = e; -1 } }
}
#[no_mangle] pub extern "C" fn cubeopt_abi_version() -> u32 { 2 }
#[no_mangle] pub extern "C" fn cubeopt_supports_variant(n: u32) -> u32 { u32::from((1..=9).contains(&n)) }
#[no_mangle] pub extern "C" fn cubeopt_pointer_bytes() -> u32 { std::mem::size_of::<usize>() as u32 }
#[no_mangle] pub extern "C" fn cubeopt_max_threads() -> u32 { MAX_THREADS }
#[cfg(feature="small-check")]
#[no_mangle] pub extern "C" fn cubeopt_fixture_coset_batch_enabled() -> u32 { u32::from(cfg!(feature="wasm-coset-batch")) }
#[cfg(feature="small-check")]
#[no_mangle] pub extern "C" fn cubeopt_fixture_opt9_batch_enabled() -> u32 { u32::from(cfg!(feature="wasm-opt9-batch")) }
#[cfg(feature="small-check")]
#[no_mangle] pub extern "C" fn cubeopt_fixture_opt9_select_enabled() -> u32 { u32::from(cfg!(feature="wasm-opt9-select")) }
#[cfg(feature="small-check")]
#[no_mangle] pub extern "C" fn cubeopt_fixture_padded_layout() -> u32 {
    #[cfg(feature="wasm-padded-state")]
    { cube48opt_research::search::padded_state_layout() }
    #[cfg(not(feature="wasm-padded-state"))]
    { 0 }
}
#[no_mangle] pub extern "C" fn cubeopt_table_bytes(n: u32) -> u64 { if (1..=9).contains(&n) { Variant::new(n as u8).unwrap().bytes() } else { 0 } }
#[no_mangle] pub extern "C" fn cubeopt_snapshot_bytes(n: u32) -> u64 { if (1..=9).contains(&n) { snapshot_bytes(n as u8).unwrap() as u64 } else { 0 } }
#[no_mangle] pub extern "C" fn cubeopt_control_ptr() -> usize { CONTROL }
#[no_mangle] pub extern "C" fn cubeopt_snapshot_ptr() -> usize { SNAPSHOT }
#[no_mangle] pub extern "C" fn cubeopt_pdb_ptr() -> usize { PDB }

/// Full upstream checksum and distribution validation before publishing the
/// table. The same format checks as PruningTable::from_words; no allocation.
#[no_mangle] pub extern "C" fn cubeopt_validate_table(n: u32) -> i32 {
    control(4).store(0, Ordering::Release);
    if !(1..=9).contains(&n) { return -1; }
    let variant = Variant::new(n as u8).unwrap();
    let Some(words) = shared_words(variant) else { return -1; };
    let base = usize::from(variant.max_bound() - 3);
    let mut counts = [0u64; 16];
    let mut checksum = 0u32;
    for (i, &word) in words.iter().enumerate() {
        let valid = if i & 3 == 0 { 0x5555_5550 } else if i & 31 == 31 { 0x1555_5555 } else { 0x5555_5555 };
        let low = word & valid;
        let high = word >> 1;
        counts[base+3] += (low & high).count_ones() as u64;
        counts[base+2] += (valid & !word & high).count_ones() as u64;
        counts[base+1] += (low & !high).count_ones() as u64;
        counts[(words[i & !3] & 15) as usize] += (valid & !word & !high).count_ones() as u64;
        checksum ^= word;
    }
    if checksum != variant.checksum()
        || counts.iter().sum::<u64>() != 117_567_450u64 << variant.eo_bits()
        || counts[usize::from(variant.max_bound())+1..].iter().any(|&n| n != 0)
        || n == 1 && counts != [36,27,77,547,3218,20172,102167,393472,4953846,34776317,77317571,0,0,0,0,0] { return -1; }
    control(4).store(n, Ordering::Release);
    0
}
fn create(index: u32, count: u32, n: u32, fixture: bool) -> usize {
    if count == 0 || count > MAX_THREADS || index >= count { return 0; }
    if !(1..=9).contains(&n) { return 0; }
    let variant = Variant::new(n as u8).unwrap();
    if !fixture && control(4).load(Ordering::Acquire) != n { return 0; }
    let snapshot = unsafe { std::slice::from_raw_parts(SNAPSHOT as *const u8, snapshot_bytes(n as u8).unwrap()) };
    let words = if fixture { &[][..] } else { let Some(words) = shared_words(variant) else { return 0; }; words };
    #[cfg(any(feature = "wasm-coset-batch", feature = "wasm-opt9-batch"))]
    let opt9 = if n == 9 {
        let Ok(coords) = Opt9CoordTables::from_bytes(snapshot) else { return 0; };
        Some(Backend::Opt9(Opt9Oracle { coords, words, #[cfg(feature = "small-check")] fixture }))
    } else { None };
    let oracle = if n == 8 {
        let Ok(coords) = Opt8CoordTables::from_bytes(snapshot) else { return 0; };
        Backend::Opt8(Oracle { coords, words, #[cfg(feature = "small-check")] fixture })
    } else {
        #[cfg(not(any(feature = "wasm-coset-batch", feature = "wasm-opt9-batch")))]
        let opt9 = None;
        if let Some(oracle) = opt9 { oracle } else {
            let Ok(coords) = CoordTables::from_variant_bytes(snapshot, n as u8) else { return 0; };
            Backend::Generic(GenericOracle { coords, words, variant, #[cfg(feature = "small-check")] fixture })
        }
    };
    Box::into_raw(Box::new(State { oracle, input: [0;4096],
        output: String::new(), search: None, start: Cube::SOLVED,
        #[cfg(all(feature = "small-check", feature = "wasm-root-bound"))] fixture_root_bound: false,
        shard: SearchShard { index: index as usize, count: count as usize } })) as usize
}
#[no_mangle] pub extern "C" fn cubeopt_create(index: u32, count: u32, n: u32) -> usize { create(index, count, n, false) }
#[cfg(feature="small-check")]
#[no_mangle] pub extern "C" fn cubeopt_fixture_create(index: u32, count: u32, n: u32) -> usize { create(index, count, n, true) }
#[cfg(all(feature = "small-check", feature = "wasm-root-bound"))]
#[no_mangle] pub extern "C" fn cubeopt_fixture_root_bound_create(index: u32, count: u32, n: u32) -> usize {
    let p = create(index, count, n, true);
    if p != 0 { unsafe { state(p).fixture_root_bound = true; } }
    p
}
#[no_mangle] pub extern "C" fn cubeopt_root_bound_enabled() -> u32 { u32::from(cfg!(feature = "wasm-root-bound")) }
#[no_mangle] pub extern "C" fn cubeopt_lazy_normal_enabled() -> u32 { u32::from(cfg!(feature = "wasm-lazy-normal")) }
#[no_mangle] pub extern "C" fn cubeopt_input_ptr(p: usize) -> usize { unsafe { state(p).input.as_ptr() as usize } }
#[no_mangle] pub extern "C" fn cubeopt_output_ptr(p: usize) -> usize { unsafe { state(p).output.as_ptr() as usize } }
#[no_mangle] pub extern "C" fn cubeopt_output_len(p: usize) -> usize { unsafe { state(p).output.len() } }
#[no_mangle] pub extern "C" fn cubeopt_begin(p: usize, len: usize) -> i32 {
    status(p, |s| {
        if len > s.input.len() { return Err("scramble exceeds input capacity".into()); }
        let input = std::str::from_utf8(&s.input[..len]).map_err(|e| e.to_string())?;
        s.start = Cube::from_scramble(input)?;
        // Do not retain a previous cube's depth if any new proof fails.
        s.search = None;
        #[cfg(feature = "wasm-root-bound")]
        {
            #[cfg(feature = "small-check")]
            let fixture_proof = s.fixture_root_bound;
            #[cfg(not(feature = "small-check"))]
            let fixture_proof = false;
            let (search, proof) = match &s.oracle {
                Backend::Opt8(o) => begin_backend(s.start, o, s.shard, fixture_proof)?,
                #[cfg(any(feature = "wasm-coset-batch", feature = "wasm-opt9-batch"))]
                Backend::Opt9(o) => begin_backend(s.start, o, s.shard, fixture_proof)?,
                Backend::Generic(o) => begin_backend(s.start, o, s.shard, fixture_proof)?,
            };
            s.search = Some(search);
            s.output = format!("{{\"worker\":{},\"initialDepth\":{},\"rootBounds\":{{\"normal\":{},\"inverse\":{},\"maximum\":{},\"source\":\"{}\"}}}}",
                s.shard.index, proof.lower_bound(), proof.normal, proof.inverse, proof.maximum, proof.source);
        }
        #[cfg(not(feature = "wasm-root-bound"))]
        {
            s.search = Some(match &s.oracle {
                Backend::Opt8(o) => DepthSearch::new(s.start, o, s.shard)?,
                #[cfg(any(feature = "wasm-coset-batch", feature = "wasm-opt9-batch"))]
                Backend::Opt9(o) => DepthSearch::new(s.start, o, s.shard)?,
                Backend::Generic(o) => DepthSearch::new(s.start, o, s.shard)?,
            });
        }
        Ok(())
    })
}
#[no_mangle] pub extern "C" fn cubeopt_run_depth(p: usize, depth: u32) -> i32 {
    status(p, |s| {
        if depth > 20 { return Err("depth must be at most 20".into()); }
        let search = s.search.as_mut().ok_or("begin a scramble first")?;
        let result = match &s.oracle {
            Backend::Opt8(o) => search.run_depth(o, depth as u8)?,
            #[cfg(any(feature = "wasm-coset-batch", feature = "wasm-opt9-batch"))]
            Backend::Opt9(o) => search.run_depth(o, depth as u8)?,
            Backend::Generic(o) => search.run_depth(o, depth as u8)?,
        };
        let solution = if let Some(moves) = result.solution {
            let end = moves.iter().fold(s.start, |cube, &m| cube.moved(m));
            if !end.is_solved() || moves.len() != depth as usize { return Err("independent replay failed".into()); }
            control(0).store(1, Ordering::Relaxed);
            format!("\"{}\"", moves.iter().map(|&m| MOVE_NAMES[m as usize]).collect::<Vec<_>>().join(" "))
        } else { "null".to_owned() };
        #[cfg(feature="opt9-quarter-fixed")]
        let quarter_removed = result.stats.quarter_siblings_removed;
        #[cfg(not(feature="opt9-quarter-fixed"))]
        let quarter_removed = 0u64;
        #[cfg(feature="wasm-coset-batch")]
        {
            let coset_removed = result.stats.coset_half_prunes;
            s.output = format!("{{\"depth\":{depth},\"solution\":{solution},\"cancelled\":{},\"completed\":{},\"nodes\":{},\"probes\":{},\"jobs\":{},\"worker\":{},\"quarterRemoved\":{quarter_removed},\"cosetRemoved\":{coset_removed}}}",
                result.cancelled, result.completed_depth == Some(depth as u8), result.stats.nodes,
                result.stats.probes, result.stats.jobs, s.shard.index);
        }
        #[cfg(not(feature="wasm-coset-batch"))]
        {
            s.output = format!("{{\"depth\":{depth},\"solution\":{solution},\"cancelled\":{},\"completed\":{},\"nodes\":{},\"probes\":{},\"jobs\":{},\"worker\":{},\"quarterRemoved\":{quarter_removed}}}",
                result.cancelled, result.completed_depth == Some(depth as u8), result.stats.nodes,
                result.stats.probes, result.stats.jobs, s.shard.index);
        }
        Ok(())
    })
}
#[cfg(feature="small-check")]
#[no_mangle] pub extern "C" fn cubeopt_fixture_coordinate(p: usize, len: usize) -> i32 {
    status(p, |s| {
        if len > s.input.len() { return Err("too long".into()); }
        let c = Cube::from_scramble(std::str::from_utf8(&s.input[..len]).map_err(|e| e.to_string())?)?;
        #[cfg(feature = "wasm-lazy-normal")]
        if !cube48opt_research::cube::verify_deferred_move_products(&c) {
            return Err("deferred SIMD move products disagree with scalar cube algebra".into());
        }
        #[cfg(feature = "wasm-padded-state")]
        if !cube48opt_research::cube::verify_padded_move_products(&c) {
            return Err("padded SIMD move products disagree with scalar cube algebra".into());
        }
        let (a,b) = match &s.oracle {
            Backend::Opt8(o) => (o.coords.index(&c),o.coords.index_scalar(&c)),
            #[cfg(any(feature = "wasm-coset-batch", feature = "wasm-opt9-batch"))]
            Backend::Opt9(o) => (o.coords.index(&c),o.coords.index_scalar(&c)),
            Backend::Generic(o) => (o.coords.index64(&c),o.coords.index64_slow(&c)),
        };
        if a != b { return Err("coordinate mismatch".into()); }
        // Check the precise Opt8 equivalence used by quarter rejection.
        if let Backend::Opt8(o) = &s.oracle {
            if o.allow_backward_coset() != cfg!(feature="wasm-coset-batch") {
                return Err("Opt8 backward coset feature not connected".into());
            }
            for face in 0..6 {
                let forward = c.moved(face * 3).inverse();
                let backward = c.moved(face * 3 + 2).inverse();
                if o.coords.index(&forward) != o.coords.index(&backward)
                    || o.coords.index_scalar(&forward) != o.coords.index_scalar(&backward) {
                    return Err("quarter inverse subgroup mismatch".into());
                }
            }
        }
        #[cfg(any(feature = "wasm-coset-batch", feature = "wasm-opt9-batch"))]
        if let Backend::Opt9(o) = &s.oracle {
            if !o.allow_quarter_pruning() || o.allow_backward_coset() != cfg!(feature = "wasm-coset-batch") {
                return Err("Opt9 fixed oracle pruning features not connected".into());
            }
            for face in 0..6 {
                let forward = c.moved(face * 3).inverse();
                let backward = c.moved(face * 3 + 2).inverse();
                if o.coords.index(&forward) != o.coords.index(&backward)
                    || o.coords.index_scalar(&forward) != o.coords.index_scalar(&backward) {
                    return Err("Opt9 fixed inverse subgroup mismatch".into());
                }
            }
        }
        if let Backend::Generic(o) = &s.oracle {
            if o.variant.number() == 9 {
                if o.allow_quarter_pruning() != cfg!(feature="opt9-quarter-fixed") {
                    return Err("Opt9 quarter pruning feature not connected".into());
                }
                for face in 0..6 {
                    let forward = c.moved(face * 3).inverse();
                    let backward = c.moved(face * 3 + 2).inverse();
                    if o.coords.index64(&forward) != o.coords.index64(&backward)
                        || o.coords.index64_slow(&forward) != o.coords.index64_slow(&backward) {
                        return Err("Opt9 quarter inverse subgroup mismatch".into());
                    }
                }
            }
        }
        s.output = a.to_string(); Ok(())
    })
}

/// Resource-only fixture: reject every query so all prefix queue lengths and
/// sorting stages can be exercised without a PDB or an exponential solve.
/// This is deliberately not an admissible oracle and supplies no solve result.
#[cfg(feature="small-check")]
#[no_mangle]
pub extern "C" fn cubeopt_fixture_prepare_depth(p: usize, depth: u32) -> i32 {
    struct RejectAll(u8);
    impl PruningOracle for RejectAll {
        type Query = u64;
        fn prepare(&self, _: &Cube, remaining: u8) -> Result<u64, u8> { Err(remaining + 1) }
        fn lookup(&self, _: u64) -> u8 { unreachable!("resource fixture must never query a PDB") }
        fn max_bound(&self) -> u8 { self.0 }
    }
    status(p, |s| {
        if depth > 20 { return Err("fixture depth must be at most 20".into()); }
        let max_bound = match &s.oracle {
            Backend::Opt8(o) => o.max_bound(),
            #[cfg(any(feature = "wasm-coset-batch", feature = "wasm-opt9-batch"))]
            Backend::Opt9(o) => o.max_bound(),
            Backend::Generic(o) => o.max_bound(),
        };
        let result = s.search.as_mut().ok_or("begin a scramble first")?
            .run_depth(&RejectAll(max_bound), depth as u8)?;
        if result.solution.is_some() || result.cancelled || result.completed_depth != Some(depth as u8) {
            return Err("resource fixture requires a nontrivial scramble and exhausted depth".into());
        }
        s.output = format!("{{\"depth\":{depth},\"nodes\":{},\"jobs\":{},\"worker\":{}}}",
            result.stats.nodes,result.stats.jobs,s.shard.index);
        Ok(())
    })
}

/// Exercise the production generic decoder with a 128-byte synthetic array.
#[cfg(feature="small-check")]
#[no_mangle]
pub extern "C" fn cubeopt_fixture_verify_generic_probes() -> i32 {
    let mut checked = 0;
    for number in 1..=9 {
        let variant = Variant::new(number).unwrap();
        for phase in 0..4_u32 {
            let mut words = [0_u32; 32];
            for (word, value) in words.iter_mut().enumerate() {
                for slot in 0..16 { *value |= (phase + word as u32 + slot) % 4 << (slot * 2); }
                if word & 3 == 0 { *value = (*value & !15) | ((word as u32 / 4 + phase) % u32::from(variant.max_bound()+1)); }
            }
            for index in 0..512_u64 {
                let word = (index / 16) as usize;
                let code = (words[word] / (1_u32 << (2 * (index % 16)))) % 4;
                let expected = if code == 0 { (words[word / 4 * 4] % 16) as u8 }
                    else { code as u8 + variant.max_bound() - 3 };
                if lookup_generic(&words, variant, index) != expected { return -1; }
                checked += 1;
            }
        }
    }
    checked
}
