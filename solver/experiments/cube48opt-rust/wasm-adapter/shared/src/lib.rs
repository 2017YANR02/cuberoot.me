//! Separate shared-memory ABI; no singleton/TLS state and no table copies.
//! The trusted wrapper assigns disjoint allocator arenas and stacks to each
//! instance. Only the immutable PDB, snapshot and atomic cancel word are shared.
#![feature(simd_wasm64)]
use std::alloc::{GlobalAlloc, Layout};
use std::sync::atomic::{AtomicU32, Ordering};
use cube48opt_research::{coord::{Opt8CoordTables, CoordTables, snapshot_bytes}, cube::{Cube, MOVE_NAMES},
    search::{DepthSearch, PruningOracle, SearchShard}, table::Variant};

const CONTROL: usize = 8 * 1024 * 1024;
const SNAPSHOT: usize = CONTROL + 65536;
const PDB: usize = 16 * 1024 * 1024;

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
// Actual-WASM verification of the production load/decode helper with 128B of
// synthetic words. This export is absent from every production artifact.
#[cfg(feature = "small-check")]
#[no_mangle]
pub extern "C" fn cubeopt_fixture_verify_batch_probes() -> i32 {
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
    #[inline(always)] fn cancelled(&self) -> bool { control(0).load(Ordering::Relaxed) != 0 }
}
struct GenericOracle {
    coords: CoordTables,
    words: &'static [u32],
    variant: Variant,
    #[cfg(feature = "small-check")]
    fixture: bool,
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
        let word = (index >> 4) as usize;
        let code = self.words[word] >> ((index & 15) * 2) & 3;
        if code == 0 { (self.words[word & !3] & 15) as u8 } else { code as u8 + self.variant.max_bound() - 3 }
    }
    fn conjugate(&self, c: &Cube, symmetry: u8) -> Option<Cube> { Some(self.coords.conjugate(c, symmetry)) }
    fn max_bound(&self) -> u8 { self.variant.max_bound() }
    #[inline(always)] fn allow_parent_propagation(&self) -> bool { true }
    #[inline(always)] fn cancelled(&self) -> bool { control(0).load(Ordering::Relaxed) != 0 }
}
enum Backend { Opt8(Oracle), Generic(GenericOracle) }
struct State {
    oracle: Backend,
    input: [u8; 4096],
    output: String,
    search: Option<DepthSearch>,
    start: Cube,
    shard: SearchShard,
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
#[no_mangle] pub extern "C" fn cubeopt_max_threads() -> u32 { 4 }
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
    if count == 0 || count > 4 || index >= count { return 0; }
    if !(1..=9).contains(&n) { return 0; }
    let variant = Variant::new(n as u8).unwrap();
    if !fixture && control(4).load(Ordering::Acquire) != n { return 0; }
    let snapshot = unsafe { std::slice::from_raw_parts(SNAPSHOT as *const u8, snapshot_bytes(n as u8).unwrap()) };
    let words = if fixture { &[][..] } else { let Some(words) = shared_words(variant) else { return 0; }; words };
    let oracle = if n == 8 {
        let Ok(coords) = Opt8CoordTables::from_bytes(snapshot) else { return 0; };
        Backend::Opt8(Oracle { coords, words, #[cfg(feature = "small-check")] fixture })
    } else {
        let Ok(coords) = CoordTables::from_variant_bytes(snapshot, n as u8) else { return 0; };
        Backend::Generic(GenericOracle { coords, words, variant, #[cfg(feature = "small-check")] fixture })
    };
    Box::into_raw(Box::new(State { oracle, input: [0;4096],
        output: String::new(), search: None, start: Cube::SOLVED,
        shard: SearchShard { index: index as usize, count: count as usize } })) as usize
}
#[no_mangle] pub extern "C" fn cubeopt_create(index: u32, count: u32, n: u32) -> usize { create(index, count, n, false) }
#[cfg(feature="small-check")]
#[no_mangle] pub extern "C" fn cubeopt_fixture_create(index: u32, count: u32, n: u32) -> usize { create(index, count, n, true) }
#[no_mangle] pub extern "C" fn cubeopt_input_ptr(p: usize) -> usize { unsafe { state(p).input.as_ptr() as usize } }
#[no_mangle] pub extern "C" fn cubeopt_output_ptr(p: usize) -> usize { unsafe { state(p).output.as_ptr() as usize } }
#[no_mangle] pub extern "C" fn cubeopt_output_len(p: usize) -> usize { unsafe { state(p).output.len() } }
#[no_mangle] pub extern "C" fn cubeopt_begin(p: usize, len: usize) -> i32 {
    status(p, |s| {
        if len > s.input.len() { return Err("scramble exceeds input capacity".into()); }
        let input = std::str::from_utf8(&s.input[..len]).map_err(|e| e.to_string())?;
        s.start = Cube::from_scramble(input)?;
        s.search = Some(match &s.oracle {
            Backend::Opt8(o) => DepthSearch::new(s.start, o, s.shard)?,
            Backend::Generic(o) => DepthSearch::new(s.start, o, s.shard)?,
        });
        Ok(())
    })
}
#[no_mangle] pub extern "C" fn cubeopt_run_depth(p: usize, depth: u32) -> i32 {
    status(p, |s| {
        if depth > 20 { return Err("depth must be at most 20".into()); }
        let search = s.search.as_mut().ok_or("begin a scramble first")?;
        let result = match &s.oracle {
            Backend::Opt8(o) => search.run_depth(o, depth as u8)?,
            Backend::Generic(o) => search.run_depth(o, depth as u8)?,
        };
        let solution = if let Some(moves) = result.solution {
            let end = moves.iter().fold(s.start, |cube, &m| cube.moved(m));
            if !end.is_solved() || moves.len() != depth as usize { return Err("independent replay failed".into()); }
            control(0).store(1, Ordering::Relaxed);
            format!("\"{}\"", moves.iter().map(|&m| MOVE_NAMES[m as usize]).collect::<Vec<_>>().join(" "))
        } else { "null".to_owned() };
        s.output = format!("{{\"depth\":{depth},\"solution\":{solution},\"cancelled\":{},\"completed\":{},\"nodes\":{},\"probes\":{},\"jobs\":{},\"worker\":{}}}",
            result.cancelled, result.completed_depth == Some(depth as u8), result.stats.nodes,
            result.stats.probes, result.stats.jobs, s.shard.index);
        Ok(())
    })
}
#[cfg(feature="small-check")]
#[no_mangle] pub extern "C" fn cubeopt_fixture_coordinate(p: usize, len: usize) -> i32 {
    status(p, |s| {
        if len > s.input.len() { return Err("too long".into()); }
        let c = Cube::from_scramble(std::str::from_utf8(&s.input[..len]).map_err(|e| e.to_string())?)?;
        let (a,b) = match &s.oracle {
            Backend::Opt8(o) => (o.coords.index(&c),o.coords.index_scalar(&c)),
            Backend::Generic(o) => (o.coords.index64(&c),o.coords.index64_slow(&c)),
        };
        if a != b { return Err("coordinate mismatch".into()); }
        s.output = a.to_string(); Ok(())
    })
}
