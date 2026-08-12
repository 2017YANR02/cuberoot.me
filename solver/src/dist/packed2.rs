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
    /// States in this layer whose B coordinate equals the optional selector.
    pub selected_b_count: u64,
    pub cumulative: u64,
    pub witness: usize,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ScanProgress {
    pub depth: u32,
    pub rows_done: usize,
    pub rows_total: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExactBfsProof {
    pub histogram: Vec<u64>,
    pub visited: u64,
    /// An arbitrary state in the last non-empty layer.
    pub deepest_state: usize,
    /// Move indices that are not universal self-loops in this quotient graph.
    pub effective_moves: Vec<u8>,
    /// Per-layer counts for an optional fixed B coordinate.
    pub selected_b_histogram: Vec<u64>,
}

/// Owned state needed to resume at the next unprocessed BFS layer.
///
/// `words` deliberately remains atomic: loading a checkpoint may be followed
/// immediately by a parallel layer scan, without a second 6 GiB allocation or
/// an unsafe representation conversion.
pub struct Packed2Resume {
    pub words: Vec<AtomicU64>,
    pub current_colour: u8,
    pub next_colour: u8,
    pub next_depth: u32,
    pub cumulative: u64,
    pub histogram: Vec<u64>,
    pub selected_b_histogram: Vec<u64>,
    pub deepest_state: usize,
}

/// Borrowed, layer-boundary snapshot. No Rayon workers are active while the
/// callback runs, so the caller may serialize every atomic word consistently.
pub struct Packed2Snapshot<'a> {
    pub words: &'a [AtomicU64],
    pub current_colour: u8,
    pub next_colour: u8,
    pub next_depth: u32,
    pub cumulative: u64,
    pub histogram: &'a [u64],
    pub selected_b_histogram: &'a [u64],
    pub deepest_state: usize,
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
    bfs_multi_packed2_exact_resumable(
        a_size,
        b_size,
        starts,
        mt_a,
        mt_b,
        None,
        None,
        None,
        |progress, _| {
            on_layer(progress);
            Ok(())
        },
    )
}

/// Resumable variant of [`bfs_multi_packed2_exact`].
///
/// The callback runs only after a layer is fully processed and the frontier
/// colours have been swapped. A successfully serialized snapshot therefore
/// resumes at `next_depth` without repeating or skipping any state.
pub fn bfs_multi_packed2_exact_resumable<F>(
    a_size: usize,
    b_size: usize,
    starts: &[usize],
    mt_a: &[i32],
    mt_b: &[i32],
    resume: Option<Packed2Resume>,
    selected_b: Option<usize>,
    scan_reporter: Option<&(dyn Fn(ScanProgress) + Sync)>,
    mut on_layer: F,
) -> Result<ExactBfsProof, String>
where
    F: FnMut(LayerProgress, Packed2Snapshot<'_>) -> Result<(), String>,
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
    if let Some(b) = selected_b {
        if b >= b_size {
            return Err(format!(
                "packed2 selected B coordinate {b} out of range {b_size}"
            ));
        }
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
    let (
        table,
        mut current,
        mut next,
        mut depth,
        mut cumulative,
        mut histogram,
        mut selected_b_histogram,
        mut deepest_state,
    ) = if let Some(resume) = resume {
        if resume.words.len() != word_count {
            return Err(format!(
                "packed2 resume word count mismatch: got {}, expected {word_count}",
                resume.words.len()
            ));
        }
        if !matches!(
            (resume.current_colour, resume.next_colour),
            (FRONTIER_A, FRONTIER_B) | (FRONTIER_B, FRONTIER_A)
        ) {
            return Err(format!(
                "packed2 resume colours are invalid: current={}, next={}",
                resume.current_colour, resume.next_colour
            ));
        }
        if resume.next_depth as usize != resume.histogram.len() {
            return Err(format!(
                "packed2 resume depth/histogram mismatch: depth={}, bins={}",
                resume.next_depth,
                resume.histogram.len()
            ));
        }
        if resume.selected_b_histogram.len() != resume.histogram.len() {
            return Err(format!(
                "packed2 resume selected-B histogram mismatch: selected bins={}, all bins={}",
                resume.selected_b_histogram.len(),
                resume.histogram.len()
            ));
        }
        let histogram_sum = resume.histogram.iter().try_fold(0u64, |sum, &count| {
            sum.checked_add(count)
                .ok_or_else(|| "packed2 resume histogram overflow".to_owned())
        })?;
        if histogram_sum != resume.cumulative || resume.cumulative > total as u64 {
            return Err(format!(
                "packed2 resume cumulative mismatch: histogram={histogram_sum}, stored={}, total={total}",
                resume.cumulative
            ));
        }
        if resume.deepest_state >= total {
            return Err(format!(
                "packed2 resume witness {} out of range {total}",
                resume.deepest_state
            ));
        }
        (
            resume.words,
            resume.current_colour,
            resume.next_colour,
            resume.next_depth,
            resume.cumulative,
            resume.histogram,
            resume.selected_b_histogram,
            resume.deepest_state,
        )
    } else {
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
        (
            table,
            FRONTIER_A,
            FRONTIER_B,
            0,
            0,
            Vec::new(),
            Vec::new(),
            starts[0],
        )
    };

    loop {
        let count = AtomicU64::new(0);
        let selected_count = AtomicU64::new(0);
        let witness = AtomicU64::new(u64::MAX);
        let rows_done = std::sync::atomic::AtomicUsize::new(0);
        let scan_interval = (a_size / 64).max(1);

        (0..a_size).into_par_iter().with_min_len(32).for_each(|a| {
            let mut next_a = [0usize; 18];
            for &m in &effective_moves {
                next_a[m] = mt_a[a * 18 + m] as usize;
            }
            let row_word = a * words_per_row;
            let mut local_count = 0u64;
            let mut local_witness = u64::MAX;
            if let Some(b) = selected_b {
                let word = table[row_word + b / STATES_PER_WORD].load(Ordering::Relaxed);
                if ((word >> ((b % STATES_PER_WORD) * 2)) & 3) as u8 == current {
                    selected_count.fetch_add(1, Ordering::Relaxed);
                }
            }

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
            if let Some(reporter) = scan_reporter {
                let done = rows_done.fetch_add(1, Ordering::Relaxed) + 1;
                if done % scan_interval == 0 || done == a_size {
                    reporter(ScanProgress {
                        depth,
                        rows_done: done,
                        rows_total: a_size,
                    });
                }
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
        let layer_selected_count = selected_count.load(Ordering::Relaxed);
        selected_b_histogram.push(layer_selected_count);
        deepest_state = layer_witness;
        let progress = LayerProgress {
            depth,
            count: layer_count,
            selected_b_count: layer_selected_count,
            cumulative,
            witness: layer_witness,
        };
        depth = depth
            .checked_add(1)
            .ok_or_else(|| "packed2 BFS depth overflow".to_owned())?;
        std::mem::swap(&mut current, &mut next);
        on_layer(
            progress,
            Packed2Snapshot {
                words: &table,
                current_colour: current,
                next_colour: next,
                next_depth: depth,
                cumulative,
                histogram: &histogram,
                selected_b_histogram: &selected_b_histogram,
                deepest_state,
            },
        )?;
    }

    Ok(ExactBfsProof {
        histogram,
        visited: cumulative,
        deepest_state,
        effective_moves: effective_moves.into_iter().map(|m| m as u8).collect(),
        selected_b_histogram,
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
        let scan_reports = std::sync::atomic::AtomicUsize::new(0);
        let scan_reporter = |progress: ScanProgress| {
            assert!(progress.rows_done <= progress.rows_total);
            scan_reports.fetch_add(1, Ordering::Relaxed);
        };
        let proof = bfs_multi_packed2_exact_resumable(
            a_size,
            b_size,
            &[0],
            &mt_a,
            &mt_b,
            None,
            Some(7),
            Some(&scan_reporter),
            |_, _| Ok(()),
        )
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
        let mut selected = vec![0u64; max + 1];
        for (state, d) in distance.into_iter().enumerate() {
            expected[d as usize] += 1;
            if state % b_size == 7 {
                selected[d as usize] += 1;
            }
        }

        assert_eq!(proof.histogram, expected);
        assert_eq!(proof.selected_b_histogram, selected);
        assert_eq!(proof.visited, (a_size * b_size) as u64);
        assert_eq!(proof.histogram.len() - 1, 34);
        assert_eq!(proof.effective_moves, vec![0, 2, 3, 5]);
        assert!(scan_reports.load(Ordering::Relaxed) > 0);
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

    #[test]
    fn layer_snapshot_resumes_exactly_and_counts_selected_b() {
        let (a_size, b_size) = (4usize, 64usize);
        let mt_a = cycle_moves(a_size, 0, 2);
        let mt_b = cycle_moves(b_size, 3, 5);
        let full = bfs_multi_packed2_exact_resumable(
            a_size,
            b_size,
            &[0],
            &mt_a,
            &mt_b,
            None,
            Some(7),
            None,
            |_, _| Ok(()),
        )
        .expect("full resumable BFS");

        let mut saved = None;
        let stopped = bfs_multi_packed2_exact_resumable(
            a_size,
            b_size,
            &[0],
            &mt_a,
            &mt_b,
            None,
            Some(7),
            None,
            |progress, snapshot| {
                if progress.depth == 9 {
                    saved = Some(Packed2Resume {
                        words: snapshot
                            .words
                            .iter()
                            .map(|word| AtomicU64::new(word.load(Ordering::Relaxed)))
                            .collect(),
                        current_colour: snapshot.current_colour,
                        next_colour: snapshot.next_colour,
                        next_depth: snapshot.next_depth,
                        cumulative: snapshot.cumulative,
                        histogram: snapshot.histogram.to_vec(),
                        selected_b_histogram: snapshot.selected_b_histogram.to_vec(),
                        deepest_state: snapshot.deepest_state,
                    });
                    return Err("intentional checkpoint stop".to_owned());
                }
                Ok(())
            },
        );
        assert_eq!(stopped.unwrap_err(), "intentional checkpoint stop");

        let resumed = bfs_multi_packed2_exact_resumable(
            a_size,
            b_size,
            &[0],
            &mt_a,
            &mt_b,
            saved,
            Some(7),
            None,
            |_, _| Ok(()),
        )
        .expect("resumed BFS");
        assert_eq!(resumed.histogram, full.histogram);
        assert_eq!(resumed.selected_b_histogram, full.selected_b_histogram);
        assert_eq!(
            resumed.selected_b_histogram.iter().sum::<u64>(),
            a_size as u64
        );
        assert_eq!(resumed.deepest_state, full.deepest_state);
        assert_eq!(resumed.visited, full.visited);
    }
}
