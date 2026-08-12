//! Two-bit exact frontier BFS.
//!
//! Diameter proofs only need to know whether a state is unseen, in the current
//! layer, in the next layer, or already processed.  Storing those four colours
//! uses two bits per state and, unlike a packed distance nibble, has no depth
//! ceiling.  The two frontier colours alternate after a full parallel scan.

use std::sync::atomic::{AtomicU64, Ordering};

use rayon::prelude::*;

const FRONTIER_A: u8 = 1;
const FRONTIER_B: u8 = 2;
const STATES_PER_WORD: usize = 32;
const WORD_GROUP: usize = 4;
const LOW_BITS: u64 = 0x5555_5555_5555_5555;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LayerProgress {
    pub depth: u32,
    pub count: u64,
    pub cumulative: u64,
    pub witness: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExactBfsProof {
    pub histogram: Vec<u64>,
    pub visited: u64,
    /// An arbitrary state in the last non-empty layer.
    pub deepest_state: usize,
    /// Move indices that are not universal self-loops in this quotient graph.
    pub effective_moves: Vec<u8>,
}

#[inline]
pub const fn packed2_bytes(states: usize) -> usize {
    states.div_ceil(4)
}

#[inline]
pub const fn packed2_product_bytes(a_size: usize, b_size: usize) -> Option<usize> {
    match a_size.checked_mul(b_size.div_ceil(STATES_PER_WORD)) {
        Some(words) => words.checked_mul(std::mem::size_of::<u64>()),
        None => None,
    }
}

#[inline(always)]
fn matching_lanes(word: u64, colour: u8) -> u64 {
    let pattern = (colour as u64).wrapping_mul(LOW_BITS);
    let x = word ^ pattern;
    !(x | (x >> 1)) & LOW_BITS
}

/// Set one two-bit lane iff it is still unseen.
#[inline(always)]
fn discover(word: &AtomicU64, lane: usize, colour: u8) -> bool {
    let shift = lane * 2;
    let lane_mask = 3u64 << shift;
    let new_part = (colour as u64) << shift;
    let mut old = word.load(Ordering::Relaxed);
    loop {
        if old & lane_mask != 0 {
            return false;
        }
        match word.compare_exchange_weak(old, old | new_part, Ordering::Relaxed, Ordering::Relaxed)
        {
            Ok(_) => return true,
            Err(actual) => old = actual,
        }
    }
}

/// Exact BFS on a product graph with 18 moves per factor.
///
/// State `a * b_size + b` moves to
/// `mt_a[a * 18 + m] * b_size + mt_b[b * 18 + m]`. Rows are padded to whole
/// atomic words so each Rayon row owns its writes;
/// First Layer uses 190,080 inner states and therefore needs no padding in its
/// hot loop. Smaller
/// projections may pad the tail of each row to one 64-bit word. `on_layer`
/// runs after every complete layer for durable progress logs.
pub fn bfs_multi_packed2_exact<F>(
    a_size: usize,
    b_size: usize,
    starts: &[usize],
    mt_a: &[i32],
    mt_b: &[i32],
    mut on_layer: F,
) -> Result<ExactBfsProof, String>
where
    F: FnMut(LayerProgress),
{
    let total = a_size
        .checked_mul(b_size)
        .ok_or_else(|| "packed2 state count overflow".to_owned())?;
    if total == 0 {
        return Err("packed2 state space is empty".to_owned());
    }
    let expected_a = a_size
        .checked_mul(18)
        .ok_or_else(|| "packed2 A move-table length overflow".to_owned())?;
    let expected_b = b_size
        .checked_mul(18)
        .ok_or_else(|| "packed2 B move-table length overflow".to_owned())?;
    if mt_a.len() != expected_a {
        return Err(format!(
            "packed2 A move-table length mismatch: got {}, expected {expected_a}",
            mt_a.len()
        ));
    }
    if mt_b.len() != expected_b {
        return Err(format!(
            "packed2 B move-table length mismatch: got {}, expected {expected_b}",
            mt_b.len()
        ));
    }
    if starts.is_empty() {
        return Err("packed2 start set is empty".to_owned());
    }
    if let Some((index, value)) = mt_a
        .iter()
        .copied()
        .enumerate()
        .find(|(_, value)| *value < 0 || *value as usize >= a_size)
    {
        return Err(format!(
            "packed2 A transition {index} has out-of-range target {value}"
        ));
    }
    if let Some((index, value)) = mt_b
        .iter()
        .copied()
        .enumerate()
        .find(|(_, value)| *value < 0 || *value as usize >= b_size)
    {
        return Err(format!(
            "packed2 B transition {index} has out-of-range target {value}"
        ));
    }

    // A move that is the identity on both factors is a self-loop at every
    // product state and can never improve a shortest path. The production
    // First Layer graph keeps all 18 moves; this generic reduction only helps
    // smaller quotient graphs that genuinely have universal self-loops.
    let effective_moves: Vec<usize> = (0..18)
        .filter(|&m| {
            (0..a_size).any(|a| mt_a[a * 18 + m] as usize != a)
                || (0..b_size).any(|b| mt_b[b * 18 + m] as usize != b)
        })
        .collect();

    let words_per_row = b_size.div_ceil(STATES_PER_WORD);
    let word_count = a_size
        .checked_mul(words_per_row)
        .ok_or_else(|| "packed2 word count overflow".to_owned())?;
    let allocation_bytes = word_count
        .checked_mul(std::mem::size_of::<AtomicU64>())
        .ok_or_else(|| "packed2 allocation bytes overflow".to_owned())?;
    let mut table = Vec::new();
    table
        .try_reserve_exact(word_count)
        .map_err(|e| format!("cannot reserve {allocation_bytes} packed2 bytes: {e}"))?;
    table.resize_with(word_count, || AtomicU64::new(0));
    for &start in starts {
        if start >= total {
            return Err(format!("packed2 start {start} out of range {total}"));
        }
        let (a, b) = (start / b_size, start % b_size);
        discover(
            &table[a * words_per_row + b / STATES_PER_WORD],
            b % STATES_PER_WORD,
            FRONTIER_A,
        );
    }

    let mut current = FRONTIER_A;
    let mut next = FRONTIER_B;
    let mut depth = 0u32;
    let mut cumulative = 0u64;
    let mut histogram = Vec::new();
    let mut deepest_state = starts[0];

    loop {
        let count = AtomicU64::new(0);
        let witness = AtomicU64::new(u64::MAX);

        (0..a_size).into_par_iter().with_min_len(32).for_each(|a| {
            let mut next_a = [0usize; 18];
            for &m in &effective_moves {
                next_a[m] = mt_a[a * 18 + m] as usize;
            }
            let row_word = a * words_per_row;
            let mut local_count = 0u64;
            let mut local_witness = u64::MAX;

            for group_start in (0..words_per_row).step_by(WORD_GROUP) {
                let group_len = (words_per_row - group_start).min(WORD_GROUP);
                let mut words = [0u64; WORD_GROUP];
                let mut matches = [0u64; WORD_GROUP];
                let mut any = 0u64;
                for offset in 0..group_len {
                    words[offset] = table[row_word + group_start + offset].load(Ordering::Relaxed);
                    matches[offset] = matching_lanes(words[offset], current);
                    any |= matches[offset];
                }
                if any == 0 {
                    continue;
                }

                for offset in 0..group_len {
                    let word_index = row_word + group_start + offset;
                    let mut lanes = matches[offset];
                    if lanes == 0 {
                        continue;
                    }
                    let processed_mask = if current == FRONTIER_A {
                        lanes << 1
                    } else {
                        lanes
                    };
                    while lanes != 0 {
                        let bit = lanes.trailing_zeros() as usize;
                        let lane = bit / 2;
                        let b = (group_start + offset) * STATES_PER_WORD + lane;
                        if b >= b_size {
                            lanes &= lanes - 1;
                            continue;
                        }
                        let state = a * b_size + b;
                        local_count += 1;
                        local_witness = local_witness.min(state as u64);

                        for &m in &effective_moves {
                            let nb = mt_b[b * 18 + m] as usize;
                            let target_word = next_a[m] * words_per_row + nb / STATES_PER_WORD;
                            discover(&table[target_word], nb % STATES_PER_WORD, next);
                        }
                        lanes &= lanes - 1;
                    }
                    // 01 -> 11 by setting the high bit; 10 -> 11 by setting
                    // the low bit.  fetch_or preserves concurrent discoveries
                    // in other lanes of the same word.
                    table[word_index].fetch_or(processed_mask, Ordering::Relaxed);
                }
            }

            if local_count != 0 {
                count.fetch_add(local_count, Ordering::Relaxed);
                witness.fetch_min(local_witness, Ordering::Relaxed);
            }
        });

        let layer_count = count.load(Ordering::Relaxed);
        if layer_count == 0 {
            break;
        }
        let layer_witness = witness.load(Ordering::Relaxed) as usize;
        cumulative = cumulative
            .checked_add(layer_count)
            .ok_or_else(|| "packed2 visited count overflow".to_owned())?;
        histogram.push(layer_count);
        deepest_state = layer_witness;
        on_layer(LayerProgress {
            depth,
            count: layer_count,
            cumulative,
            witness: layer_witness,
        });
        depth = depth
            .checked_add(1)
            .ok_or_else(|| "packed2 BFS depth overflow".to_owned())?;
        std::mem::swap(&mut current, &mut next);
    }

    Ok(ExactBfsProof {
        histogram,
        visited: cumulative,
        deepest_state,
        effective_moves: effective_moves.into_iter().map(|m| m as u8).collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::VecDeque;

    fn cycle_moves(size: usize, plus_move: usize, minus_move: usize) -> Vec<i32> {
        let mut mt = vec![0i32; size * 18];
        for state in 0..size {
            for m in 0..18 {
                mt[state * 18 + m] = match m {
                    x if x == plus_move => ((state + 1) % size) as i32,
                    x if x == minus_move => ((state + size - 1) % size) as i32,
                    _ => state as i32,
                };
            }
        }
        mt
    }

    #[test]
    fn exact_histogram_matches_independent_queue_bfs() {
        let (a_size, b_size) = (4usize, 64usize);
        let mt_a = cycle_moves(a_size, 0, 2);
        let mt_b = cycle_moves(b_size, 3, 5);
        let proof = bfs_multi_packed2_exact(a_size, b_size, &[0], &mt_a, &mt_b, |_| {})
            .expect("packed2 BFS");

        let mut distance = vec![u8::MAX; a_size * b_size];
        let mut queue = VecDeque::from([0usize]);
        distance[0] = 0;
        while let Some(state) = queue.pop_front() {
            let (a, b) = (state / b_size, state % b_size);
            for m in 0..18 {
                let next = mt_a[a * 18 + m] as usize * b_size + mt_b[b * 18 + m] as usize;
                if distance[next] == u8::MAX {
                    distance[next] = distance[state] + 1;
                    queue.push_back(next);
                }
            }
        }
        let max = *distance.iter().max().unwrap() as usize;
        let mut expected = vec![0u64; max + 1];
        for d in distance {
            expected[d as usize] += 1;
        }

        assert_eq!(proof.histogram, expected);
        assert_eq!(proof.visited, (a_size * b_size) as u64);
        assert_eq!(proof.histogram.len() - 1, 34);
        assert_eq!(proof.effective_moves, vec![0, 2, 3, 5]);
    }

    #[test]
    fn multi_source_and_memory_formula_are_exact() {
        let mt_a = cycle_moves(8, 0, 2);
        let mt_b = cycle_moves(64, 3, 5);
        let proof = bfs_multi_packed2_exact(8, 64, &[0, 4 * 64, 4 * 64], &mt_a, &mt_b, |_| {})
            .expect("packed2 multi-source BFS");
        assert_eq!(proof.visited, 8 * 64);
        assert_eq!(proof.histogram.len() - 1, 34);
        assert_eq!(packed2_bytes(0), 0);
        assert_eq!(packed2_bytes(1), 1);
        assert_eq!(packed2_bytes(4), 1);
        assert_eq!(packed2_bytes(5), 2);
        assert_eq!(packed2_product_bytes(24, 24), Some(24 * 8));
    }
}
