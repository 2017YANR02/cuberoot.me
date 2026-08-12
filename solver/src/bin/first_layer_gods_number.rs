//! Exact HTM diameter proof for the 3x3 First Layer target.
//!
//! This is an offline/native-only computation.  It enumerates all
//! P(8,4)*3^4 * P(12,4)*2^4 = 25,866,086,400 labelled partial states with the
//! two-bit frontier BFS in `dist::packed2`; it never builds or retains a full
//! byte/nibble distance table.  The browser does not load this code or table.
//!
//! Safety gates:
//! - the computed peak plan is checked against a hard 25 GB cap;
//! - at most 14 Rayon threads;
//! - a real run requires `CUBE_ALLOW_HUGE_TABLES=1`;
//! - `--dry-run` prints the exact resource plan without allocating the table.

use std::env;
use std::process::ExitCode;
use std::time::Instant;

use cube_solver::cube_common::{
    array_to_index, create_multi_move_table, state_space, Move, State, INV_MOVE,
};
use cube_solver::dist::packed2::{bfs_multi_packed2_exact, packed2_product_bytes, ExactBfsProof};
use cube_solver::first_layer_solver::{
    FirstLayerSolver, CORNER4, FIRST_LAYER_STATES, FIRST_LAYER_UPPER_BOUND,
};

const TRACKED_CORNERS: [i32; 4] = [4, 5, 6, 7];
const TRACKED_EDGES: [i32; 4] = [8, 9, 10, 11];
const MAX_THREADS: usize = 14;
/// Decimal gigabytes: honour the user's ceiling conservatively rather than
/// treating 25 GB as 25 GiB.
const MEMORY_CAP_BYTES: u64 = 25_000_000_000;
/// Covers the two move tables, their tiny single-piece sources, Rayon stacks,
/// allocator metadata and progress/result buffers.  The proof verifier is
/// constructed only after the frontier table has been dropped.
const NON_FRONTIER_RESERVE_BYTES: u64 = 512 * 1024 * 1024;

#[derive(Clone, Copy, Debug)]
struct Args {
    dry_run: bool,
    threads: usize,
}

#[derive(Clone, Copy, Debug)]
struct MemoryPlan {
    frontier_bytes: u64,
    corner_moves_bytes: u64,
    edge_moves_bytes: u64,
    reserve_bytes: u64,
    peak_budget_bytes: u64,
}

fn parse_args() -> Result<Args, String> {
    let mut dry_run = false;
    let default_threads = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
        .min(MAX_THREADS);
    let mut threads = env::var("RAYON_NUM_THREADS")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(default_threads);

    let mut it = env::args().skip(1);
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--dry-run" => dry_run = true,
            "--threads" => {
                let raw = it
                    .next()
                    .ok_or_else(|| "--threads requires a value".to_owned())?;
                threads = raw
                    .parse::<usize>()
                    .map_err(|_| format!("invalid --threads value: {raw}"))?;
            }
            "-h" | "--help" => {
                println!(
                    "first_layer_gods_number [--dry-run] [--threads N]\n\
                     full run also requires CUBE_ALLOW_HUGE_TABLES=1"
                );
                std::process::exit(0);
            }
            _ => return Err(format!("unknown argument: {arg}")),
        }
    }
    if threads == 0 || threads > MAX_THREADS {
        return Err(format!(
            "threads must be in 1..={MAX_THREADS}, got {threads}"
        ));
    }
    Ok(Args { dry_run, threads })
}

fn memory_plan() -> Result<MemoryPlan, String> {
    let frontier_bytes = packed2_product_bytes(CORNER4, state_space::CROSS)
        .ok_or_else(|| "First Layer packed2 size overflow".to_owned())?
        as u64;
    let corner_moves_bytes = CORNER4 as u64 * 18 * 4;
    let edge_moves_bytes = state_space::CROSS as u64 * 18 * 4;
    let peak_budget_bytes = frontier_bytes
        .checked_add(corner_moves_bytes)
        .and_then(|v| v.checked_add(edge_moves_bytes))
        .and_then(|v| v.checked_add(NON_FRONTIER_RESERVE_BYTES))
        .ok_or_else(|| "First Layer memory plan overflow".to_owned())?;
    Ok(MemoryPlan {
        frontier_bytes,
        corner_moves_bytes,
        edge_moves_bytes,
        reserve_bytes: NON_FRONTIER_RESERVE_BYTES,
        peak_budget_bytes,
    })
}

fn decimal_gb(bytes: u64) -> f64 {
    bytes as f64 / 1_000_000_000.0
}

fn gib(bytes: u64) -> f64 {
    bytes as f64 / 1024.0_f64.powi(3)
}

fn print_plan(plan: MemoryPlan, threads: usize) {
    println!("First Layer exact HTM diameter proof");
    println!("states={FIRST_LAYER_STATES}");
    println!("threads={threads} (hard max {MAX_THREADS})");
    println!(
        "frontier={} bytes ({:.3} GiB, two bits/state)",
        plan.frontier_bytes,
        gib(plan.frontier_bytes)
    );
    println!(
        "move_tables={} bytes ({:.3} GiB)",
        plan.corner_moves_bytes + plan.edge_moves_bytes,
        gib(plan.corner_moves_bytes + plan.edge_moves_bytes)
    );
    println!(
        "runtime_reserve={} bytes ({:.3} GiB)",
        plan.reserve_bytes,
        gib(plan.reserve_bytes)
    );
    println!(
        "hard_peak_budget={} bytes ({:.3} GB / {:.3} GiB)",
        plan.peak_budget_bytes,
        decimal_gb(plan.peak_budget_bytes),
        gib(plan.peak_budget_bytes)
    );
    println!(
        "configured_cap={} bytes ({:.3} GB)",
        MEMORY_CAP_BYTES,
        decimal_gb(MEMORY_CAP_BYTES)
    );
}

fn build_moves(
    tracked: &[i32],
    orientation_base: i32,
    piece_count: i32,
    states: usize,
    basic: Vec<u32>,
) -> Vec<i32> {
    let basic: Vec<i32> = basic.into_iter().map(|v| v as i32).collect();
    create_multi_move_table(
        tracked.len() as i32,
        orientation_base,
        piece_count,
        states as i32,
        &basic,
    )
}

fn solved_coords() -> (usize, usize) {
    let c = array_to_index(&TRACKED_CORNERS.map(|p| 3 * p), 4, 3, 8) as usize;
    let e = array_to_index(&TRACKED_EDGES.map(|p| 2 * p), 4, 2, 12) as usize;
    assert_eq!(e, state_space::CROSS_SOLVED);
    (c, e)
}

fn coords_from_state(state: &State) -> (usize, usize) {
    let mut corners = [0i32; 4];
    let mut edges = [0i32; 4];
    for (i, &piece) in TRACKED_CORNERS.iter().enumerate() {
        let position = state
            .corners
            .iter()
            .position(|&v| v / 3 == piece as u8)
            .expect("tracked corner missing");
        corners[i] = 3 * position as i32 + (state.corners[position] % 3) as i32;
    }
    for (i, &piece) in TRACKED_EDGES.iter().enumerate() {
        let position = state
            .edges
            .iter()
            .position(|&v| v / 2 == piece as u8)
            .expect("tracked edge missing");
        edges[i] = 2 * position as i32 + (state.edges[position] % 2) as i32;
    }
    (
        array_to_index(&corners, 4, 3, 8) as usize,
        array_to_index(&edges, 4, 2, 12) as usize,
    )
}

fn first_layer_solved(state: &State) -> bool {
    (4..8).all(|p| state.corners[p] == 3 * p as u8)
        && (8..12).all(|p| state.edges[p] == 2 * p as u8)
}

fn names(moves: &[u8]) -> String {
    moves
        .iter()
        .map(|&m| Move::from_index(m as usize).name())
        .collect::<Vec<_>>()
        .join(" ")
}

fn certify_witness(proof: &ExactBfsProof) -> Result<(usize, usize, String, String), String> {
    let god = proof
        .histogram
        .len()
        .checked_sub(1)
        .ok_or_else(|| "First Layer histogram is empty".to_owned())?;
    let c = proof.deepest_state / state_space::CROSS;
    let e = proof.deepest_state % state_space::CROSS;

    // The 6 GiB frontier table has been dropped before this function is called.
    // Build the normal admissible-PDB IDA* and independently demand the same
    // optimum for the deepest coordinate.
    let solver = FirstLayerSolver::new();
    let solution = solver.solve_coords_for_proof(c, e)?;
    if solution.len as usize != god {
        return Err(format!(
            "deepest witness mismatch: BFS depth {god}, IDA* depth {}",
            solution.len
        ));
    }
    let scramble: Vec<u8> = solution
        .moves
        .iter()
        .rev()
        .map(|&m| INV_MOVE[m as usize])
        .collect();

    // Independent full physical State replay: the inverse solution must reach
    // exactly the BFS coordinate, and scramble + solution must restore F1L.
    let mut physical = State::SOLVED;
    for &m in &scramble {
        physical.apply(Move::from_index(m as usize));
    }
    if coords_from_state(&physical) != (c, e) {
        return Err("physical witness does not match the deepest BFS coordinate".to_owned());
    }
    for &m in &solution.moves {
        physical.apply(Move::from_index(m as usize));
    }
    if !first_layer_solved(&physical) {
        return Err("physical witness solution does not restore First Layer".to_owned());
    }

    Ok((c, e, names(&scramble), names(&solution.moves)))
}

fn execute(args: Args) -> Result<(), String> {
    if usize::BITS < 64 {
        return Err("First Layer proof requires a 64-bit build".to_owned());
    }
    let plan = memory_plan()?;
    print_plan(plan, args.threads);
    if plan.peak_budget_bytes > MEMORY_CAP_BYTES {
        return Err(format!(
            "planned peak {} exceeds hard cap {}",
            plan.peak_budget_bytes, MEMORY_CAP_BYTES
        ));
    }
    if args.dry_run {
        println!("dry_run=true; no move table or frontier was allocated");
        return Ok(());
    }
    if env::var("CUBE_ALLOW_HUGE_TABLES").ok().as_deref() != Some("1") {
        return Err(
            "full proof is gated; set CUBE_ALLOW_HUGE_TABLES=1 after checking free memory"
                .to_owned(),
        );
    }

    rayon::ThreadPoolBuilder::new()
        .num_threads(args.threads)
        .build_global()
        .map_err(|e| format!("cannot configure Rayon pool: {e}"))?;

    let started = Instant::now();
    eprintln!("[first-layer-god] building 4-corner and 4-edge move tables");
    let mt_c = build_moves(
        &TRACKED_CORNERS,
        3,
        8,
        CORNER4,
        cube_solver::mt_gen::create_mt_corn(),
    );
    let mt_e = build_moves(
        &TRACKED_EDGES,
        2,
        12,
        state_space::CROSS,
        cube_solver::mt_gen::create_mt_edge(),
    );
    let (c0, e0) = solved_coords();
    let start = c0 * state_space::CROSS + e0;
    eprintln!(
        "[first-layer-god] BFS start after {:.2}s; packed frontier {:.3} GiB",
        started.elapsed().as_secs_f64(),
        gib(plan.frontier_bytes)
    );
    let bfs_started = Instant::now();
    let proof = bfs_multi_packed2_exact(
        CORNER4,
        state_space::CROSS,
        &[start],
        &mt_c,
        &mt_e,
        |layer| {
            eprintln!(
                "[first-layer-god] depth={} count={} cumulative={} elapsed={:.1}s witness={}",
                layer.depth,
                layer.count,
                layer.cumulative,
                bfs_started.elapsed().as_secs_f64(),
                layer.witness
            );
        },
    )?;
    if proof.visited != FIRST_LAYER_STATES {
        return Err(format!(
            "incomplete/contaminated BFS: visited {}, expected {FIRST_LAYER_STATES}",
            proof.visited
        ));
    }
    let god = proof.histogram.len() - 1;
    if god as u32 > FIRST_LAYER_UPPER_BOUND {
        return Err(format!(
            "computed diameter {god} exceeds the whole-cube upper bound {FIRST_LAYER_UPPER_BOUND}"
        ));
    }

    // Release the large transition tables before the independent IDA* witness
    // verifier allocates its normal ~100 MiB PDB stack.
    drop(mt_c);
    drop(mt_e);
    let (c, e, scramble, solution) = certify_witness(&proof)?;

    println!("FIRST_LAYER_GODS_NUMBER={god}");
    println!("FIRST_LAYER_HISTOGRAM={:?}", proof.histogram);
    println!("FIRST_LAYER_VISITED={}", proof.visited);
    println!(
        "EFFECTIVE_MOVES={}",
        proof
            .effective_moves
            .iter()
            .map(|&m| Move::from_index(m as usize).name())
            .collect::<Vec<_>>()
            .join(" ")
    );
    println!("DEEPEST_CORNER4={c}");
    println!("DEEPEST_EDGE4={e}");
    println!("DEEPEST_SCRAMBLE={scramble}");
    println!("DEEPEST_SOLUTION={solution}");
    println!("ELAPSED_SECONDS={:.3}", started.elapsed().as_secs_f64());
    Ok(())
}

fn main() -> ExitCode {
    match parse_args().and_then(execute) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("first_layer_gods_number: {error}");
            ExitCode::from(2)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::{HashMap, VecDeque};

    use cube_solver::cube_common::{index_to_array, move_state};

    type PieceState = (u8, u8, u8, u8);

    fn step_piece(state: PieceState, m: usize) -> PieceState {
        let (corner_pos, corner_ori, edge_pos, edge_ori) = state;
        let movement = move_state(Move::from_index(m));
        let (cp, co) = movement.cp_co();
        let (ep, eo) = movement.ep_eo();
        let next_corner = (0..8).find(|&p| cp[p] == corner_pos).unwrap();
        let next_edge = (0..12).find(|&p| ep[p] == edge_pos).unwrap();
        (
            next_corner as u8,
            (corner_ori + co[next_corner]) % 3,
            next_edge as u8,
            (edge_ori + eo[next_edge]) % 2,
        )
    }

    #[test]
    fn one_corner_one_edge_matches_independent_physical_bfs() {
        let mt_c = build_moves(
            &[4],
            3,
            8,
            state_space::CORNER,
            cube_solver::mt_gen::create_mt_corn(),
        );
        let mt_e = build_moves(
            &[8],
            2,
            12,
            state_space::EDGE,
            cube_solver::mt_gen::create_mt_edge(),
        );
        let c0 = array_to_index(&[12], 1, 3, 8) as usize;
        let e0 = array_to_index(&[16], 1, 2, 12) as usize;
        let proof = bfs_multi_packed2_exact(
            state_space::CORNER,
            state_space::EDGE,
            &[c0 * state_space::EDGE + e0],
            &mt_c,
            &mt_e,
            |_| {},
        )
        .expect("reduced packed2 BFS");

        let start: PieceState = (4, 0, 8, 0);
        let mut physical = HashMap::from([(start, 0u8)]);
        let mut queue = VecDeque::from([start]);
        while let Some(state) = queue.pop_front() {
            let depth = physical[&state];
            for m in 0..18 {
                let next = step_piece(state, m);
                if let std::collections::hash_map::Entry::Vacant(slot) = physical.entry(next) {
                    slot.insert(depth + 1);
                    queue.push_back(next);
                }
            }
        }
        let max = *physical.values().max().unwrap() as usize;
        let mut expected = vec![0u64; max + 1];
        for depth in physical.values() {
            expected[*depth as usize] += 1;
        }
        assert_eq!(physical.len(), state_space::CORNER * state_space::EDGE);
        assert_eq!(proof.histogram, expected);
        assert_eq!(
            proof.visited,
            (state_space::CORNER * state_space::EDGE) as u64
        );
        assert_eq!(proof.effective_moves, (0u8..18).collect::<Vec<_>>());
    }

    #[test]
    fn production_plan_is_below_decimal_25gb_cap() {
        let plan = memory_plan().unwrap();
        assert_eq!(FIRST_LAYER_STATES, 25_866_086_400);
        assert_eq!(plan.frontier_bytes, 6_466_521_600);
        assert!(plan.peak_budget_bytes < MEMORY_CAP_BYTES);
        assert!(plan.peak_budget_bytes < 7_100_000_000);
    }

    #[test]
    fn coordinate_decode_roundtrip_uses_physical_state() {
        let alg = [Move::R, Move::U2, Move::FPrime, Move::D, Move::L2];
        let mut state = State::SOLVED;
        for m in alg {
            state.apply(m);
        }
        let (c, e) = coords_from_state(&state);
        let mut ca = [0i32; 4];
        let mut ea = [0i32; 4];
        index_to_array(&mut ca, c as i32, 4, 3, 8);
        index_to_array(&mut ea, e as i32, 4, 2, 12);
        assert_eq!(
            ca.map(|v| v / 18),
            TRACKED_CORNERS.map(|piece| {
                let pos = state
                    .corners
                    .iter()
                    .position(|&v| v / 3 == piece as u8)
                    .unwrap();
                3 * pos as i32 + (state.corners[pos] % 3) as i32
            })
        );
        assert_eq!(
            ea.map(|v| v / 18),
            TRACKED_EDGES.map(|piece| {
                let pos = state
                    .edges
                    .iter()
                    .position(|&v| v / 2 == piece as u8)
                    .unwrap();
                2 * pos as i32 + (state.edges[pos] % 2) as i32
            })
        );
    }
}
