//! Memory64 ABI. The host fills one module-owned PDB allocation; finalization
//! moves that allocation into the ordinary Rust decoder without copying it.
//! No filesystem, host pruning callback, or thread pool is used during search.
#[cfg(feature = "bpmx-check")]
mod bpmx_check;
use std::cell::RefCell;

use cube48opt_research::{
    coord::{snapshot_bytes, CoordTables},
    cube::{Cube, MOVE_NAMES},
    search::SearchOptions,
    table::{PruningTable, Variant},
    OptSolver,
};

const INPUT_CAPACITY: usize = 4096;

#[derive(Default)]
struct State {
    variant: Option<Variant>,
    snapshot: Vec<u8>,
    words: Vec<u32>,
    solver: Option<OptSolver>,
    input: Vec<u8>,
    output: String,
}

thread_local! {
    // Exports are synchronous and never invoke host code. The wrapper never
    // shares an instance between workers, so there is no concurrent mutation.
    static STATE: RefCell<State> = RefCell::new(State::default());
}

fn status(action: impl FnOnce(&mut State) -> Result<(), String>) -> i32 {
    STATE.with(|cell| {
        let mut state = cell.borrow_mut();
        state.output.clear();
        match action(&mut state) {
            Ok(()) => 0,
            Err(error) => {
                state.output = error;
                -1
            }
        }
    })
}

fn variant(number: u32) -> Result<Variant, String> {
    Variant::new(u8::try_from(number).map_err(|_| "variant must be 1..9")?)
}

#[no_mangle]
pub extern "C" fn cubeopt_abi_version() -> u32 { 1 }

#[no_mangle]
pub extern "C" fn cubeopt_pointer_bytes() -> u32 { std::mem::size_of::<usize>() as u32 }

#[no_mangle]
pub extern "C" fn cubeopt_threads() -> u32 { 1 }

#[no_mangle]
pub extern "C" fn cubeopt_table_bytes(number: u32) -> u64 {
    variant(number).map(|v| v.bytes()).unwrap_or(0)
}

#[no_mangle]
pub extern "C" fn cubeopt_snapshot_bytes(number: u32) -> u64 {
    variant(number)
        .and_then(|v| snapshot_bytes(v.number()))
        .map(|len| len as u64)
        .unwrap_or(0)
}

/// One large allocation. Call only inside the same resource guard used for
/// native table loading; the module does not claim to control operating-system swap.
#[no_mangle]
pub extern "C" fn cubeopt_init_alloc(number: u32, snapshot_len: u64) -> i32 {
    status(|state| {
        if state.variant.is_some() || state.solver.is_some() {
            return Err("instance is already allocated; create a fresh instance".into());
        }
        if std::mem::size_of::<usize>() != 8 {
            return Err("this adapter requires a wasm64 build".into());
        }
        let variant = variant(number)?;
        let small_len = snapshot_bytes(variant.number())?;
        if snapshot_len != small_len as u64 {
            return Err(format!("Opt{} snapshot requires {small_len} bytes", variant.number()));
        }
        let words_len = usize::try_from(variant.bytes() / 4)
            .map_err(|_| "table does not fit the target address space")?;
        let mut snapshot = Vec::new();
        snapshot.try_reserve_exact(small_len).map_err(|e| e.to_string())?;
        snapshot.resize(small_len, 0);
        let mut input = Vec::new();
        input.try_reserve_exact(INPUT_CAPACITY).map_err(|e| e.to_string())?;
        input.resize(INPUT_CAPACITY, 0);
        let mut words = Vec::new();
        words.try_reserve_exact(words_len).map_err(|e| e.to_string())?;
        words.resize(words_len, 0);
        state.variant = Some(variant);
        state.snapshot = snapshot;
        state.words = words;
        state.input = input;
        Ok(())
    })
}

#[no_mangle]
pub extern "C" fn cubeopt_snapshot_ptr() -> u64 {
    STATE.with(|state| state.borrow().snapshot.as_ptr() as usize as u64)
}

#[no_mangle]
pub extern "C" fn cubeopt_pdb_ptr() -> u64 {
    STATE.with(|state| {
        let state = state.borrow();
        if state.words.is_empty() { 0 } else { state.words.as_ptr() as usize as u64 }
    })
}

#[no_mangle]
pub extern "C" fn cubeopt_pdb_len() -> u64 {
    STATE.with(|state| state.borrow().words.len() as u64 * 4)
}

#[no_mangle]
pub extern "C" fn cubeopt_ready() -> u32 {
    STATE.with(|state| u32::from(state.borrow().solver.is_some()))
}

/// The host must have completed both streams before this call. The ordinary
/// native checksum and distribution checks are shared with this WASM path.
#[no_mangle]
pub extern "C" fn cubeopt_finalize() -> i32 {
    status(|state| {
        if state.solver.is_some() { return Err("instance is already finalized".into()); }
        let variant = state.variant.ok_or("allocate the instance first")?;
        if state.words.len() as u64 * 4 != variant.bytes() {
            return Err("PDB is unavailable; create a fresh instance after a failed finalization".into());
        }
        let coordinates = CoordTables::from_variant_bytes(&state.snapshot, variant.number())?;
        let pruning = PruningTable::from_words(std::mem::take(&mut state.words), variant)?;
        state.solver = Some(OptSolver::new(coordinates, pruning)?);
        state.snapshot = Vec::new();
        Ok(())
    })
}

#[no_mangle]
pub extern "C" fn cubeopt_input_ptr() -> u64 {
    STATE.with(|state| state.borrow().input.as_ptr() as usize as u64)
}

#[no_mangle]
pub extern "C" fn cubeopt_input_capacity() -> u64 {
    STATE.with(|state| state.borrow().input.len() as u64)
}

fn input_cube(state: &State, input_len: u64) -> Result<Cube, String> {
    let len = usize::try_from(input_len).map_err(|_| "input length overflow")?;
    let bytes = state.input.get(..len).ok_or("scramble exceeds the input buffer")?;
    let scramble = std::str::from_utf8(bytes).map_err(|_| "scramble must be UTF-8")?;
    Cube::from_scramble(scramble)
}

#[no_mangle]
pub extern "C" fn cubeopt_query(input_len: u64) -> i32 {
    status(|state| {
        let cube = input_cube(state, input_len)?;
        let solver = state.solver.as_ref().ok_or("finalize the table before querying")?;
        let (index, bound) = solver.query_specialized(&cube);
        state.output = format!("{{\"index\":{index},\"bound\":{bound}}}");
        Ok(())
    })
}

#[no_mangle]
pub extern "C" fn cubeopt_solve(input_len: u64, contexts: u32, max_depth: u32, max_nodes: u64) -> i32 {
    status(|state| {
        let cube = input_cube(state, input_len)?;
        let solver = state.solver.as_ref().ok_or("finalize the table before solving")?;
        let max_depth = u8::try_from(max_depth).map_err(|_| "max_depth must be at most 20")?;
        let result = solver.solve_specialized(cube, SearchOptions {
            contexts: contexts as usize,
            max_depth,
            max_nodes,
        })?;
        let (solution, length) = if let Some(moves) = &result.solution {
            if !moves.iter().fold(cube, |c, &m| c.moved(m)).is_solved() {
                return Err("internal solution replay failed".into());
            }
            let moves = moves.iter().map(|&m| MOVE_NAMES[m as usize]).collect::<Vec<_>>().join(" ");
            (format!("\"{moves}\""), result.solution.as_ref().unwrap().len().to_string())
        } else { ("null".into(), "null".into()) };
        let completed = result.completed_depth.map(|d| d.to_string()).unwrap_or("null".into());
        let s = result.stats;
        state.output = format!(
            "{{\"solution\":{solution},\"length\":{length},\"completed_depth\":{completed},\"cancelled\":{},\"contexts\":{contexts},\"threads\":1,\"nodes\":{},\"probes\":{},\"inverse_probes\":{},\"cache_reuses\":{},\"splits\":{},\"face_prunes\":{},\"face_siblings_removed\":{},\"jobs\":{}}}",
            result.cancelled, s.nodes, s.probes, s.inverse_probes, s.cache_reuses,
            s.splits, s.face_prunes, s.face_siblings_removed, s.jobs,
        );
        Ok(())
    })
}

#[no_mangle]
pub extern "C" fn cubeopt_output_ptr() -> u64 {
    STATE.with(|state| state.borrow().output.as_ptr() as usize as u64)
}

#[no_mangle]
pub extern "C" fn cubeopt_output_len() -> u64 {
    STATE.with(|state| state.borrow().output.len() as u64)
}
