//! Exact HTM distribution for solving the second layer from a solved first layer.
//!
//! The conditional input coordinate contains only the four labelled middle-layer
//! edges: P(8,4) remaining positions × 2^4 orientations = 26,880 states.  The
//! first-layer pieces are fixed and the four irrelevant U-layer edges are
//! quotiented out.  Search may temporarily disturb the first layer.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

use cube_solver::xcross_solver::{XCrossSolver, SECOND_LAYER_INPUT_STATES};
use rayon::prelude::*;

const MAX_DEPTH: usize = 20;

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

fn main() {
    let started = Instant::now();
    let states = middle_edge_states();
    let solver = XCrossSolver::new(false);
    let done = AtomicU64::new(0);
    let next_report = AtomicU64::new(1_000);

    let histogram = states
        .par_iter()
        .fold(
            || [0u64; MAX_DEPTH + 1],
            |mut local, &middle_edges| {
                let depth = solver
                    .second_layer_distance(middle_edges)
                    .expect("enumerator produced an invalid conditional state")
                    as usize;
                assert!(depth <= MAX_DEPTH);
                local[depth] += 1;

                let n = done.fetch_add(1, Ordering::Relaxed) + 1;
                let report = next_report.load(Ordering::Relaxed);
                if n >= report
                    && next_report
                        .compare_exchange(
                            report,
                            report + 1_000,
                            Ordering::Relaxed,
                            Ordering::Relaxed,
                        )
                        .is_ok()
                {
                    eprintln!(
                        "progress={n}/{SECOND_LAYER_INPUT_STATES} ({:.1}%) elapsed={:.1}s",
                        100.0 * n as f64 / SECOND_LAYER_INPUT_STATES as f64,
                        started.elapsed().as_secs_f64(),
                    );
                }
                local
            },
        )
        .reduce(
            || [0u64; MAX_DEPTH + 1],
            |mut total, local| {
                for (dst, src) in total.iter_mut().zip(local) {
                    *dst += src;
                }
                total
            },
        );

    let total: u64 = histogram.iter().sum();
    assert_eq!(total as usize, SECOND_LAYER_INPUT_STATES);
    let god = histogram.iter().rposition(|&count| count != 0).unwrap_or(0);
    let trimmed = &histogram[..=god];

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
}
