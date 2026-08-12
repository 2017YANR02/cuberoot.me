//! Independent semantic probe for Second Layer = std XXXXCross/F2L.
//!
//! This deliberately uses the complete physical `State` transition model for
//! its goal and shallow oracle, not XCross coordinates or pruning tables.

use cube_solver::block222_solver::ROTS6;
use cube_solver::cube_common::{alg_rotation, string_to_alg, Move, State};
use cube_solver::xcross_solver::XCrossSolver;

const D_CORNERS: [usize; 4] = [4, 5, 6, 7];
const D_CROSS_EDGES: [usize; 4] = [8, 9, 10, 11];
const MIDDLE_EDGES: [usize; 4] = [0, 1, 2, 3];

fn piece_solved(state: &State, corner: bool, position: usize) -> bool {
    if corner {
        state.corners[position] as usize == 3 * position
    } else {
        state.edges[position] as usize == 2 * position
    }
}

/// User wording: a solved first layer plus all four middle edges.
fn second_layer_done(state: &State) -> bool {
    D_CORNERS.iter().all(|&p| piece_solved(state, true, p))
        && D_CROSS_EDGES.iter().all(|&p| piece_solved(state, false, p))
        && MIDDLE_EDGES.iter().all(|&p| piece_solved(state, false, p))
}

/// std wording: a solved cross and every one of the four F2L slots.
fn xxxxcross_done(state: &State) -> bool {
    let cross = D_CROSS_EDGES.iter().all(|&p| piece_solved(state, false, p));
    let all_slots = (0..4).all(|slot| {
        piece_solved(state, true, D_CORNERS[slot]) && piece_solved(state, false, MIDDLE_EDGES[slot])
    });
    cross && all_slots
}

fn physical_search(state: State, depth: u32, previous_face: usize) -> bool {
    if depth == 0 {
        return second_layer_done(&state);
    }
    for m in 0..18 {
        let face = m / 3;
        if face == previous_face {
            continue;
        }
        if physical_search(state.applied(Move::from_index(m)), depth - 1, face) {
            return true;
        }
    }
    false
}

fn physical_distance(state: State, max_depth: u32) -> u32 {
    (0..=max_depth)
        .find(|&depth| physical_search(state, depth, 6))
        .expect("inverse of the shallow scramble must be within the probe bound")
}

fn state_after_rotated_alg(alg: &[Move], rot: &str) -> State {
    let mut rotated: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
    alg_rotation(&mut rotated, rot);
    let mut state = State::SOLVED;
    for m in rotated {
        state.apply(Move::from_index(m as usize));
    }
    state
}

fn solver() -> XCrossSolver {
    // Prefer the already generated local table. On a clean machine the manager
    // may build the same 52 MiB PDB under target/, never under source control.
    let manifest = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let local = manifest.join("tables").join("pt_cross_C4E0.bin");
    if !local.exists() {
        let target = manifest
            .join("target")
            .join("test-tables")
            .join("second-layer-audit");
        std::fs::create_dir_all(&target).unwrap();
        std::env::set_var("CUBE_TABLE_DIR", target);
    } else {
        std::env::set_var("CUBE_TABLE_DIR", manifest.join("tables"));
    }
    XCrossSolver::new(false)
}

#[test]
fn terminal_predicates_are_identical_on_physical_states() {
    let scrambles = [
        "",
        "U",
        "D",
        "R",
        "F2",
        "R U",
        "F2 U R'",
        "L U2 B'",
        "R U R' U'",
        "F R2 U' L",
    ];
    for scramble in scrambles {
        let alg = string_to_alg(scramble);
        for rot in ROTS6 {
            let state = state_after_rotated_alg(&alg, rot);
            assert_eq!(
                second_layer_done(&state),
                xxxxcross_done(&state),
                "scramble={scramble:?} rot={rot:?}"
            );
        }
    }
}

#[test]
fn std_stage_four_matches_independent_shallow_iddfs_in_all_six_views() {
    let solver = solver();
    let scrambles = ["", "U", "D", "R", "F2", "R U", "F2 U R'", "L U2 B'"];
    for scramble in scrambles {
        let alg = string_to_alg(scramble);
        let max_depth = alg.len() as u32;
        for rot in ROTS6 {
            let state = state_after_rotated_alg(&alg, rot);
            let want = physical_distance(state, max_depth);
            let stages = solver.get_stats_small(&alg, &[rot], 3);
            let got = stages[3];
            assert_eq!(got, want, "scramble={scramble:?} rot={rot:?}");
            assert_eq!(got == 0, second_layer_done(&state));
        }
    }
}
