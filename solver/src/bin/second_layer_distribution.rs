//! Exact HTM distribution for solving the second layer from a solved first layer.
//!
//! The conditional input coordinate contains only the four labelled middle-layer
//! edges: P(8,4) remaining positions × 2^4 orientations = 26,880 states.  The
//! first-layer pieces are fixed and the four irrelevant U-layer edges are
//! quotiented out.  Search may temporarily disturb the first layer.

use std::fmt::Write as _;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

use cube_solver::cube_common::{Move, State, MOVE_NAMES};
use cube_solver::xcross_solver::{XCrossSolver, SECOND_LAYER_INPUT_STATES};
use rayon::prelude::*;

const MAX_DEPTH: usize = 20;
const EXAMPLES_PER_BIN: usize = 12;

fn middle_edge_states() -> Vec<[u8; 4]> {
    let mut states = Vec::with_capacity(SECOND_LAYER_INPUT_STATES);
    for a in 0u8..8 {
        for b in 0u8..8 {
            if b == a {
                continue;
            }
            for c in 0u8..8 {
                if c == a || c == b {
                    continue;
                }
                for d in 0u8..8 {
                    if d == a || d == b || d == c {
                        continue;
                    }
                    for orientations in 0u8..16 {
                        states.push([
                            2 * a + (orientations & 1),
                            2 * b + ((orientations >> 1) & 1),
                            2 * c + ((orientations >> 2) & 1),
                            2 * d + ((orientations >> 3) & 1),
                        ]);
                    }
                }
            }
        }
    }
    assert_eq!(states.len(), SECOND_LAYER_INPUT_STATES);
    states
}

fn inverse_moves(solution: &[u8]) -> Vec<u8> {
    solution
        .iter()
        .rev()
        .map(|&m| {
            let i = m as usize;
            ((i / 3) * 3 + [2, 1, 0][i % 3]) as u8
        })
        .collect()
}

fn inverse_scramble(solution: &[u8]) -> String {
    inverse_moves(solution)
        .into_iter()
        .map(|m| MOVE_NAMES[m as usize])
        .collect::<Vec<_>>()
        .join(" ")
}

fn first_layer_done(state: &State) -> bool {
    (4..8).all(|p| state.corners[p] as usize == 3 * p)
        && (8..12).all(|p| state.edges[p] as usize == 2 * p)
}

fn middle_edge_codes(state: &State) -> [u8; 4] {
    std::array::from_fn(|piece| {
        let pos = state
            .edges
            .iter()
            .position(|&value| value as usize / 2 == piece)
            .expect("middle edge must exist");
        2 * pos as u8 + state.edges[pos] % 2
    })
}

fn write_examples_ts(
    path: &Path,
    solver: &XCrossSolver,
    states: &[[u8; 4]],
    distances: &[u8],
    god: usize,
) {
    let mut examples = vec![Vec::<String>::new(); god + 1];
    for (&state, &distance) in states.iter().zip(distances) {
        let d = distance as usize;
        let cap = if d == god {
            usize::MAX
        } else {
            EXAMPLES_PER_BIN
        };
        if examples[d].len() >= cap {
            continue;
        }
        let solution = solver
            .second_layer_solution(state)
            .expect("enumerator produced an invalid conditional state");
        assert_eq!(solution.len(), d);
        let mut physical = State::SOLVED;
        for scramble_move in inverse_moves(&solution) {
            physical.apply(Move::from_index(scramble_move as usize));
        }
        assert!(first_layer_done(&physical));
        assert_eq!(middle_edge_codes(&physical), state);
        examples[d].push(inverse_scramble(&solution));
    }

    let mut out = String::from(
        "/** Generated offline by solver/src/bin/second_layer_distribution.rs. */\n\
         export const FIRST_LAYER_SOLVED_SECOND_LAYER_EXAMPLES: Readonly<Record<string, readonly string[]>> = {\n",
    );
    for (depth, rows) in examples.iter().enumerate() {
        if rows.is_empty() {
            continue;
        }
        writeln!(&mut out, "  '{depth}': [").unwrap();
        for scramble in rows {
            // MOVE_NAMES is ASCII and contains only apostrophes, so JSON-style double
            // quotes are already valid TypeScript string literals.
            writeln!(&mut out, "    \"{scramble}\",").unwrap();
        }
        out.push_str("  ],\n");
    }
    out.push_str("};\n");
    std::fs::write(path, out).expect("write generated TypeScript examples");
    eprintln!(
        "wrote_examples={} deepest_examples={} path={}",
        examples.iter().map(Vec::len).sum::<usize>(),
        examples[god].len(),
        path.display(),
    );
}

fn main() {
    let mut args = std::env::args().skip(1);
    let examples_path: Option<PathBuf> = match args.next().as_deref() {
        None => None,
        Some("--examples-ts") => Some(
            args.next()
                .map(PathBuf::from)
                .expect("--examples-ts requires an output path"),
        ),
        Some(other) => panic!("unknown argument: {other}"),
    };
    assert!(args.next().is_none(), "unexpected extra arguments");

    let started = Instant::now();
    let states = middle_edge_states();
    let solver = XCrossSolver::new(false);
    let done = AtomicU64::new(0);
    let next_report = AtomicU64::new(1_000);

    let distances: Vec<u8> = states
        .par_iter()
        .map(|&middle_edges| {
            let depth = solver
                .second_layer_distance(middle_edges)
                .expect("enumerator produced an invalid conditional state");
            assert!(depth as usize <= MAX_DEPTH);

            let n = done.fetch_add(1, Ordering::Relaxed) + 1;
            let report = next_report.load(Ordering::Relaxed);
            if n >= report
                && next_report
                    .compare_exchange(report, report + 1_000, Ordering::Relaxed, Ordering::Relaxed)
                    .is_ok()
            {
                eprintln!(
                    "progress={n}/{SECOND_LAYER_INPUT_STATES} ({:.1}%) elapsed={:.1}s",
                    100.0 * n as f64 / SECOND_LAYER_INPUT_STATES as f64,
                    started.elapsed().as_secs_f64(),
                );
            }
            depth as u8
        })
        .collect();

    let mut histogram = [0u64; MAX_DEPTH + 1];
    for &depth in &distances {
        histogram[depth as usize] += 1;
    }

    let total: u64 = histogram.iter().sum();
    assert_eq!(total as usize, SECOND_LAYER_INPUT_STATES);
    let god = histogram.iter().rposition(|&count| count != 0).unwrap_or(0);
    let trimmed = &histogram[..=god];

    if let Some(path) = examples_path.as_deref() {
        write_examples_ts(path, &solver, &states, &distances, god);
    }

    println!("SECOND_LAYER_STATES={total}");
    println!("SECOND_LAYER_GODS_NUMBER={god}");
    println!("SECOND_LAYER_HISTOGRAM={trimmed:?}");
    println!("ELAPSED_SECONDS={:.3}", started.elapsed().as_secs_f64());
    println!(
        "STATES_PER_SECOND={:.1}",
        total as f64 / started.elapsed().as_secs_f64()
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enumerates_the_exact_conditional_coordinate_once() {
        let states = middle_edge_states();
        assert_eq!(states.len(), SECOND_LAYER_INPUT_STATES);
        states.iter().for_each(|state| {
            let mut seen = 0u8;
            for &edge in state {
                assert!(edge < 16);
                let bit = 1u8 << (edge / 2);
                assert_eq!(seen & bit, 0);
                seen |= bit;
            }
        });
        let unique: std::collections::HashSet<_> = states.into_iter().collect();
        assert_eq!(unique.len(), SECOND_LAYER_INPUT_STATES);
    }

    #[test]
    fn inverse_scramble_uses_standard_move_notation() {
        assert_eq!(inverse_scramble(&[0, 10, 14]), "F R2 U'");
        assert_eq!(inverse_scramble(&[]), "");
    }
}
