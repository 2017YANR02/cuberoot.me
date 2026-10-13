//! Native search recovered from cube48opt1..9.wasm, without a WASM runtime.
//!
//! Evidence: `.tmp/cubeopt-reverse/cube48opt1.wat` functions 36--44 and 47.
//! The first implementation preserves the two-sided bound, NISS side score,
//! half-turn reuse, same-face backward pruning, and eight interleaved DFS
//! contexts, ranked prefix jobs and root-stabilizer reduction. Rust
//! uses explicit owned stacks and deterministic rank ties, so scheduling and
//! node totals need not be identical to the original pointer-based scheduler.

use crate::cube::{Cube, MOVES};

const ALL_MOVES: u32 = 0x3ffff;
const NO_HALF_TURNS: u32 = 0x2db6d;
const MAX_DEPTH: u8 = 20;
const MAX_CONTEXTS: usize = 8;

// WAT step4_domove: (68717638136 >> (20-(m+((4793490>>m)&3)))) & 262143.
// Move order is the cubeopt order, not nissy's order. Opposite faces differ by 3.
const ALLOWED: [u32; 6] = [0x3fff8, 0x3ffc7, 0x3fe3f, 0x3f1f8, 0x38fc7, 0x7e3f];

/// This is specifically an H48 subgroup lower-bound oracle. Its values must be
/// admissible for the original and inverse state, and invariant under a
/// half-turn applied on the opposite side. An arbitrary full-cube lower bound
/// does not meet the latter contract and cannot be substituted here.
pub trait PruningOracle {
    type Query: Copy;
    /// Prepare a large-table query, or return an already sufficient lower bound.
    /// The error must be strictly greater than `remaining`, and obey the same
    /// opposite-side half-turn invariance as a decoded table bound.
    fn prepare(&self, cube: &Cube, remaining: u8) -> Result<Self::Query, u8>;
    fn lookup(&self, query: Self::Query) -> u8;

    /// Maximum decoded bound: Opt1 = 10, Opt2/3 = 11, Opt4..7 = 12,
    /// Opt8/9 = 13; Nissy h0..3 = 11, h4..7 = 12, h8..11 = 13.
    /// This also sets the NISS threshold, prefix-job starting
    /// depth, and reciprocal-distance ranking scale recovered from each WASM.
    fn max_bound(&self) -> u8 {
        10
    }

    /// Optional complete cube conjugation for the original 48 symmetries.
    /// Missing symmetries simply disable that reduction; they never prune.
    fn conjugate(&self, _cube: &Cube, _symmetry: u8) -> Option<Cube> {
        None
    }
}

#[derive(Clone, Copy, Debug)]
pub struct SearchOptions {
    pub max_depth: u8,
    /// Zero means no node limit. The check covers the complete iterative search.
    pub max_nodes: u64,
    /// One is useful for isolating search semantics; eight enables the pipeline.
    pub contexts: usize,
}

impl Default for SearchOptions {
    fn default() -> Self {
        Self {
            max_depth: MAX_DEPTH,
            max_nodes: 0,
            contexts: MAX_CONTEXTS,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct SearchStats {
    /// States inspected, including terminal states; not the WASM's probe count.
    pub nodes: u64,
    pub probes: u64,
    pub inverse_probes: u64,
    pub cache_reuses: u64,
    pub splits: u64,
    /// Number of same-face pruning events which removed at least one sibling.
    pub face_prunes: u64,
    pub face_siblings_removed: u64,
    pub jobs: u64,
}

#[derive(Debug)]
pub struct SearchOutcome {
    pub solution: Option<Vec<u8>>,
    /// Largest fully exhausted depth. A found depth is not reported exhausted.
    pub completed_depth: Option<u8>,
    pub cancelled: bool,
    pub stats: SearchStats,
}

#[derive(Clone, Copy)]
struct Frame {
    cube: Cube,
    inverse: Cube,
    normal_mask: u32,
    inverse_mask: u32,
    normal_bound: u8,
    inverse_bound: u8,
    cached_inverse: bool,
    /// Current normal side relative to the original input (true = inverse).
    side: bool,
    /// Edge leading to the next frame, expressed in this frame's current side.
    chosen_move: u8,
}

impl Frame {
    fn root(cube: Cube) -> Self {
        Self {
            cube,
            inverse: cube.inverse(),
            normal_mask: ALL_MOVES,
            inverse_mask: ALL_MOVES,
            normal_bound: 0,
            inverse_bound: 0,
            cached_inverse: false,
            side: false,
            chosen_move: 0,
        }
    }

    fn plan(&mut self, remaining: u8, max_bound: u8) {
        if self.inverse_bound == remaining {
            self.normal_mask &= NO_HALF_TURNS;
        }
        if self.normal_bound == remaining {
            self.inverse_mask &= NO_HALF_TURNS;
        }
        // step2_plan only considers a switch at remaining <= 10 in opt1.
        // The bound is a tie breaker after move-mask population count.
        if remaining <= max_bound {
            let normal_score = self.normal_mask.count_ones() * 64 + u32::from(self.inverse_bound);
            let inverse_score = self.inverse_mask.count_ones() * 64 + u32::from(self.normal_bound);
            if inverse_score < normal_score {
                std::mem::swap(&mut self.cube, &mut self.inverse);
                std::mem::swap(&mut self.normal_mask, &mut self.inverse_mask);
                std::mem::swap(&mut self.normal_bound, &mut self.inverse_bound);
                self.side = !self.side;
            }
        }
    }

    fn child(&mut self) -> Self {
        debug_assert_ne!(self.normal_mask, 0);
        let movement = self.normal_mask.trailing_zeros() as u8;
        self.normal_mask &= self.normal_mask - 1;
        self.chosen_move = movement;
        let (cube, inverse) = crate::cube::moved_pair(&self.cube, &self.inverse, movement);
        let inverse_bound = if movement % 3 == 1 {
            self.inverse_bound
        } else {
            0
        };
        Self {
            cube,
            inverse,
            normal_mask: ALLOWED[usize::from(movement / 3)],
            inverse_mask: self.inverse_mask,
            normal_bound: 0,
            inverse_bound,
            cached_inverse: inverse_bound != 0,
            side: self.side,
            chosen_move: 0,
        }
    }
}

#[derive(Clone)]
struct Context {
    stack: Vec<Frame>,
    job: Option<usize>,
    weight: u64,
    needs_query: bool,
}

impl Context {
    fn empty() -> Self {
        Self {
            stack: Vec::with_capacity(usize::from(MAX_DEPTH) + 1),
            job: None,
            weight: 0,
            needs_query: true,
        }
    }

    fn remaining(&self, depth: u8) -> u8 {
        depth - (self.stack.len() - 1) as u8
    }

    /// Return to the nearest ancestor that still owns an untried move.
    fn reject(&mut self, excess: u8, stats: &mut SearchStats) {
        self.stack.pop();
        if excess > 1 {
            if let Some(parent) = self.stack.last_mut() {
                // If child h > r+1, every sibling on the same face has h > r:
                // two different powers of one face differ by a single HTM move.
                // This is step2_plan's face mask, not a whole-parent BPMX cut.
                let face_mask = 7 << (parent.chosen_move / 3 * 3);
                let removed = (parent.normal_mask & face_mask).count_ones();
                parent.normal_mask &= !face_mask;
                stats.face_prunes += u64::from(removed != 0);
                stats.face_siblings_removed += u64::from(removed);
            }
        }
        while self
            .stack
            .last()
            .is_some_and(|frame| frame.normal_mask == 0)
        {
            self.stack.pop();
        }
    }

    /// Split the earliest pending subtree. The two contexts own disjoint masks.
    /// Ancestors before the split have no pending moves and cannot be re-entered.
    fn split(&mut self) -> Option<Self> {
        if self.needs_query {
            return None;
        }
        let last = self.stack.len().checked_sub(1)?;
        let split_at = self.stack.iter().enumerate().position(|(i, frame)| {
            frame.normal_mask != 0 && (i != last || frame.normal_mask.count_ones() > 1)
        })?;
        let mut other = Self::empty();
        other.stack.extend_from_slice(&self.stack[..=split_at]);
        other.job = self.job;
        other.needs_query = false;
        let mask = self.stack[split_at].normal_mask;
        let mut high = mask;
        for _ in 0..mask.count_ones() / 2 {
            high &= high - 1;
        }
        self.stack[split_at].normal_mask &= !high;
        other.stack[split_at].normal_mask = high;
        Some(other)
    }

    fn solution(&self) -> Vec<u8> {
        let mut normal = Vec::with_capacity(self.stack.len() - 1);
        let mut inverse = Vec::with_capacity(self.stack.len() - 1);
        for parent in self.stack.iter().take(self.stack.len() - 1) {
            if parent.side {
                inverse.push(parent.chosen_move);
            } else {
                normal.push(parent.chosen_move);
            }
        }
        normal.extend(inverse.into_iter().rev().map(inverse_move));
        normal
    }
}

/// Original step0_initjobs retains only symmetries fixing the input. A prefix
/// fixes additional moves one at a time; its next move takes one orbit member.
struct RootSymmetries {
    maps: Vec<[u8; 18]>,
}

impl RootSymmetries {
    fn new<O: PruningOracle>(start: &Cube, oracle: &O) -> Self {
        let mut maps = vec![std::array::from_fn(|m| m as u8)];
        for symmetry in 0..48 {
            if oracle.conjugate(start, symmetry) != Some(*start) {
                continue;
            }
            let mut map = [0_u8; 18];
            let mut complete = true;
            for movement in 0..18 {
                let transformed = oracle.conjugate(&MOVES[movement], symmetry);
                if let Some(index) = MOVES.iter().position(|cube| Some(*cube) == transformed) {
                    map[movement] = index as u8;
                } else {
                    complete = false;
                    break;
                }
            }
            // A malformed/incomplete optional symmetry is never used to prune.
            if complete && !maps.contains(&map) {
                maps.push(map);
            }
        }
        Self { maps }
    }

    fn next_mask(&self, prefix: &[u8], allowed: u32) -> u32 {
        let mut result = 0;
        let mut pending = allowed;
        while pending != 0 {
            let movement = pending.trailing_zeros() as usize;
            result |= 1 << movement;
            for map in &self.maps {
                if prefix
                    .iter()
                    .all(|&previous| map[usize::from(previous)] == previous)
                {
                    pending &= !(1 << map[movement]);
                }
            }
        }
        result
    }
}

#[derive(Clone)]
struct PrefixJob {
    moves: [u8; 4],
    len: usize,
    weight: u64,
}

#[derive(Default)]
struct PrefixQueue {
    jobs: Vec<PrefixJob>,
    next: usize,
}

impl PrefixQueue {
    fn prepare(&mut self, depth: u8, max_bound: u8, symmetries: &RootSymmetries) {
        self.next = 0;
        if depth <= max_bound {
            return;
        }
        // dcmp function 41: descending score, corrected for opposite-face
        // canonical ordering (U/R/F have a different branching factor).
        self.jobs.sort_by_key(|job| {
            let factor = if job.moves[job.len - 1] / 3 < 3 {
                47525_u64
            } else {
                58206
            };
            std::cmp::Reverse(u128::from(job.weight) * u128::from(factor))
        });
        let len = usize::from((depth - max_bound).min(4));
        if self.jobs.is_empty() {
            let mask = symmetries.next_mask(&[], ALL_MOVES);
            for movement in 0..18 {
                if mask & (1 << movement) == 0 {
                    continue;
                }
                self.jobs.push(PrefixJob {
                    moves: [movement, 0, 0, 0],
                    len: 1,
                    weight: 0,
                });
            }
        }
        while self.jobs.first().is_some_and(|job| job.len < len) {
            let mut expanded = Vec::new();
            for parent in &self.jobs {
                let last = parent.moves[parent.len - 1];
                let mask = symmetries
                    .next_mask(&parent.moves[..parent.len], ALLOWED[usize::from(last / 3)]);
                // step0 enumerates the other five faces cyclically after the
                // preceding face, with powers 0,1,2 inside each face.
                for digit in 0..15_u8 {
                    let movement = (last / 3 * 3 + 3 + digit) % 18;
                    if mask & (1 << movement) == 0 {
                        continue;
                    }
                    let mut job = parent.clone();
                    job.moves[parent.len] = movement;
                    job.len += 1;
                    expanded.push(job);
                }
            }
            self.jobs = expanded;
        }
        // Every previous-depth weight has been consumed by sorting. New visits
        // are accumulated independently; split contexts share the job's index.
        for job in &mut self.jobs {
            job.weight = 0;
        }
    }

    fn fetch(&mut self, start: Cube, stats: &mut SearchStats) -> Option<Context> {
        let index = self.next;
        let job = self.jobs.get(index)?;
        self.next += 1;
        let mut context = Context::empty();
        context.job = Some(index);
        context.stack.push(Frame::root(start));
        for &movement in &job.moves[..job.len] {
            let parent = context.stack.last_mut().unwrap();
            parent.normal_mask = 1 << movement;
            let child = parent.child();
            context.stack.push(child);
        }
        stats.jobs += 1;
        Some(context)
    }

    fn finish(&mut self, context: &mut Context) {
        if let Some(index) = context.job.take() {
            self.jobs[index].weight += context.weight;
        }
        context.weight = 0;
    }
}

fn inverse_move(movement: u8) -> u8 {
    movement / 3 * 3 + 2 - movement % 3
}

enum DepthResult {
    Found(Vec<u8>),
    Exhausted,
    Cancelled,
}

fn search_depth<O: PruningOracle>(
    start: Cube,
    oracle: &O,
    options: SearchOptions,
    depth: u8,
    stats: &mut SearchStats,
    symmetries: &RootSymmetries,
    jobs: &mut PrefixQueue,
) -> DepthResult {
    let mut contexts: Vec<Context> = (0..options.contexts).map(|_| Context::empty()).collect();
    let max_bound = oracle.max_bound();
    let rank_scale = 1_u32 << max_bound;
    jobs.prepare(depth, max_bound, symmetries);
    if depth <= max_bound {
        let mut root = Frame::root(start);
        root.normal_mask = symmetries.next_mask(&[], ALL_MOVES);
        contexts[0].stack.push(root);
    } else {
        for context in &mut contexts {
            if let Some(job) = jobs.fetch(start, stats) {
                *context = job;
            }
        }
    }
    loop {
        let mut live = [false; MAX_CONTEXTS];
        let mut inverse_coordinate = [None; MAX_CONTEXTS];
        let mut normal_coordinate = [None; MAX_CONTEXTS];
        let mut excess = [0_u8; MAX_CONTEXTS];

        // stage 1a: compute all inverse coordinates before reading the large PDB.
        for (i, context) in contexts.iter_mut().enumerate() {
            if context.stack.is_empty() {
                continue;
            }
            if options.max_nodes != 0 && stats.nodes >= options.max_nodes {
                return DepthResult::Cancelled;
            }
            stats.nodes += 1;
            context.needs_query = false;
            let remaining = context.remaining(depth);
            let frame = context.stack.last().unwrap();
            if remaining == 0 {
                if frame.cube.is_solved() {
                    return DepthResult::Found(context.solution());
                }
                context.reject(1, stats);
                continue;
            }
            live[i] = true;
            if frame.cached_inverse {
                debug_assert!(frame.inverse_bound <= remaining);
                stats.cache_reuses += 1;
            } else {
                match oracle.prepare(&frame.inverse, remaining) {
                    Ok(query) => inverse_coordinate[i] = Some(query),
                    Err(bound) => {
                        debug_assert!(bound > remaining);
                        excess[i] = bound - remaining;
                    }
                }
            }
        }

        // stage 1b: inverse PDB reads; survivors prepare the normal-side query.
        for (i, context) in contexts.iter_mut().enumerate() {
            if !live[i] || excess[i] != 0 {
                continue;
            }
            let remaining = context.remaining(depth);
            let frame = context.stack.last_mut().unwrap();
            if let Some(index) = inverse_coordinate[i] {
                frame.inverse_bound = oracle.lookup(index);
                stats.probes += 1;
                stats.inverse_probes += 1;
            }
            if frame.inverse_bound > remaining {
                excess[i] = frame.inverse_bound - remaining;
            } else {
                match oracle.prepare(&frame.cube, remaining) {
                    Ok(query) => normal_coordinate[i] = Some(query),
                    Err(bound) => {
                        debug_assert!(bound > remaining);
                        frame.normal_bound = bound;
                        context.weight += u64::from(rank_scale >> bound)
                            + u64::from(rank_scale >> frame.inverse_bound);
                        excess[i] = bound - remaining;
                    }
                }
            }
        }

        // stage 1c: normal PDB reads, kept separate from coordinate computation.
        for (i, context) in contexts.iter_mut().enumerate() {
            let Some(index) = normal_coordinate[i] else {
                continue;
            };
            let remaining = context.remaining(depth);
            let frame = context.stack.last_mut().unwrap();
            frame.normal_bound = oracle.lookup(index);
            stats.probes += 1;
            // The original score adds one reciprocal power for each side,
            // including a normal-side lookup that subsequently rejects a node.
            context.weight += u64::from(rank_scale >> frame.normal_bound)
                + u64::from(rank_scale >> frame.inverse_bound);
            if frame.normal_bound > remaining {
                excess[i] = frame.normal_bound - remaining;
            }
        }

        // stage 2: backtrack rejected states, otherwise choose the NISS side.
        for (i, context) in contexts.iter_mut().enumerate() {
            if !live[i] {
                continue;
            }
            if excess[i] != 0 {
                context.reject(excess[i], stats);
            } else {
                let remaining = context.remaining(depth);
                context.stack.last_mut().unwrap().plan(remaining, max_bound);
                if context.stack.last().unwrap().normal_mask == 0 {
                    context.reject(1, stats);
                }
            }
        }

        // stage 3: refill vacant contexts by splitting existing pending work.
        // A failed split does not discard its donor; try the remaining donors.
        for empty in 0..contexts.len() {
            if !contexts[empty].stack.is_empty() {
                continue;
            }
            jobs.finish(&mut contexts[empty]);
            if depth > max_bound {
                if let Some(job) = jobs.fetch(start, stats) {
                    contexts[empty] = job;
                    continue;
                }
            }
            for donor in 0..contexts.len() {
                if donor == empty {
                    continue;
                }
                if let Some(other) = contexts[donor].split() {
                    contexts[empty] = other;
                    stats.splits += 1;
                    break;
                }
            }
        }

        // stage 4: one move per context, preserving the paired inverse state.
        let mut active = false;
        for context in &mut contexts {
            if let Some(frame) = context.stack.last_mut() {
                active = true;
                if context.needs_query {
                    continue;
                }
                debug_assert_ne!(frame.normal_mask, 0);
                let child = frame.child();
                context.stack.push(child);
                context.needs_query = true;
            }
        }
        if !active {
            return DepthResult::Exhausted;
        }
    }
}

/// Search every depth in ascending order. Cancellation never claims exhaustion
/// of its partial iteration. The caller should independently replay the result.
/// `start` must be a legal state (use `Cube::from_scramble`, `Cube::from_bytes`,
/// or `Cube::validate` before passing manually constructed public fields).
pub fn solve<O: PruningOracle>(
    start: Cube,
    oracle: &O,
    options: SearchOptions,
) -> Result<SearchOutcome, String> {
    if options.max_depth > MAX_DEPTH {
        return Err(format!("max_depth must be at most {MAX_DEPTH}"));
    }
    if options.contexts != 1 && options.contexts != MAX_CONTEXTS {
        return Err("contexts must be 1 or 8".into());
    }
    if !(10..=13).contains(&oracle.max_bound()) {
        return Err("H48 subgroup backends require max_bound between 10 and 13".into());
    }
    let mut outcome = SearchOutcome {
        solution: None,
        completed_depth: None,
        cancelled: false,
        stats: SearchStats::default(),
    };
    let symmetries = RootSymmetries::new(&start, oracle);
    let mut jobs = PrefixQueue::default();
    for depth in 0..=options.max_depth {
        match search_depth(
            start,
            oracle,
            options,
            depth,
            &mut outcome.stats,
            &symmetries,
            &mut jobs,
        ) {
            DepthResult::Found(solution) => {
                outcome.solution = Some(solution);
                return Ok(outcome);
            }
            DepthResult::Exhausted => outcome.completed_depth = Some(depth),
            DepthResult::Cancelled => {
                outcome.cancelled = true;
                return Ok(outcome);
            }
        }
    }
    Ok(outcome)
}

#[cfg(test)]
mod tests {
    use super::*;

    struct ZeroBound;
    impl PruningOracle for ZeroBound {
        type Query = u64;
        fn prepare(&self, _: &Cube, _: u8) -> Result<u64, u8> {
            Ok(0)
        }
        fn lookup(&self, _: u64) -> u8 {
            0
        }
    }

    fn replay(cube: Cube, moves: &[u8]) -> Cube {
        moves
            .iter()
            .fold(cube, |cube, &movement| cube.moved(movement))
    }

    #[test]
    fn masks_and_inverse_moves_follow_wat() {
        for movement in 0..18_u8 {
            let power = (4793490_u32 >> movement) & 3;
            let wasm_mask = ((68717638136_u64 >> (20 - (u32::from(movement) + power)))
                & u64::from(ALL_MOVES)) as u32;
            assert_eq!(ALLOWED[usize::from(movement / 3)], wasm_mask);
            assert!(replay(Cube::SOLVED, &[movement, inverse_move(movement)]).is_solved());
        }
    }

    #[test]
    fn single_and_eight_contexts_solve_shallow_states() {
        for contexts in [1, 8] {
            for first in 0..18 {
                let start = replay(Cube::SOLVED, &[first, (first + 6) % 18]);
                let result = solve(
                    start,
                    &ZeroBound,
                    SearchOptions {
                        max_depth: 2,
                        max_nodes: 20_000,
                        contexts,
                    },
                )
                .unwrap();
                assert!(!result.cancelled);
                let solution = result.solution.unwrap();
                assert_eq!(solution.len(), 2);
                assert!(replay(start, &solution).is_solved());
                assert_eq!(result.completed_depth, Some(1));
                if contexts == 8 {
                    assert!(result.stats.splits > 0);
                }
            }
        }
    }

    #[test]
    fn niss_side_and_halfturn_preserve_actual_inverse_and_output() {
        let start = replay(Cube::SOLVED, &[0, 3, 7]);
        let mut context = Context::empty();
        context.stack.push(Frame::root(start));
        // Remove the scramble from both ends: inverse U, normal F2, inverse R.
        // The test checks the recorded direction, not an invented bound.
        for (side, movement) in [(true, 0), (false, 7), (true, 3)] {
            let frame = context.stack.last_mut().unwrap();
            if frame.side != side {
                std::mem::swap(&mut frame.cube, &mut frame.inverse);
                std::mem::swap(&mut frame.normal_mask, &mut frame.inverse_mask);
                frame.side = !frame.side;
            }
            frame.normal_mask = 1 << movement;
            let child = frame.child();
            assert_eq!(child.inverse, child.cube.inverse());
            context.stack.push(child);
        }
        assert!(context.stack.last().unwrap().cube.is_solved());
        assert!(replay(start, &context.solution()).is_solved());
    }

    #[test]
    fn node_budget_does_not_claim_partial_depth_complete() {
        let start = replay(Cube::SOLVED, &[0, 3]);
        let result = solve(
            start,
            &ZeroBound,
            SearchOptions {
                max_depth: 3,
                max_nodes: 2,
                contexts: 8,
            },
        )
        .unwrap();
        assert!(result.cancelled);
        assert_eq!(result.completed_depth, Some(0));
        assert!(result.solution.is_none());
        assert_eq!(result.stats.nodes, 2);
    }

    #[test]
    fn face_cut_is_strict_and_does_not_clear_other_faces() {
        for (excess, expected) in [(1, 0b1111), (2, 0b1000)] {
            let mut root = Frame::root(Cube::SOLVED);
            root.normal_mask = 0b1111;
            root.chosen_move = 0;
            let mut context = Context::empty();
            context.stack = vec![root, Frame::root(Cube::SOLVED)];
            let mut stats = SearchStats::default();
            context.reject(excess, &mut stats);
            assert_eq!(context.stack[0].normal_mask, expected);
            assert_eq!(stats.face_siblings_removed, if excess == 1 { 0 } else { 3 });
        }
    }

    #[test]
    fn prefix_jobs_cover_the_canonical_tree_without_duplicates() {
        let symmetries = RootSymmetries::new(&Cube::SOLVED, &ZeroBound);
        for max_bound in 10..=13 {
            let mut queue = PrefixQueue::default();
            queue.prepare(max_bound, max_bound, &symmetries);
            assert!(queue.jobs.is_empty());
            for (offset, count) in [(1, 18), (2, 243), (3, 3240), (4, 43254), (5, 43254)] {
                queue.prepare(max_bound + offset, max_bound, &symmetries);
                assert_eq!(queue.jobs.len(), count);
                let mut unique = std::collections::HashSet::new();
                for job in &queue.jobs {
                    assert_eq!(job.len, usize::from(offset.min(4)));
                    assert!(unique.insert(job.moves));
                    for pair in job.moves[..job.len].windows(2) {
                        assert_ne!(ALLOWED[usize::from(pair[0] / 3)] & (1 << pair[1]), 0);
                    }
                }
            }
        }
    }

    #[test]
    fn variant_prefix_boundary_queries_the_root_or_first_prefix() {
        struct RecordingBound {
            maximum: u8,
            queries: std::cell::RefCell<Vec<Cube>>,
        }
        impl PruningOracle for RecordingBound {
            type Query = u64;
            fn prepare(&self, cube: &Cube, _: u8) -> Result<u64, u8> {
                self.queries.borrow_mut().push(*cube);
                Ok(0)
            }
            fn lookup(&self, _: u64) -> u8 {
                0
            }
            fn max_bound(&self) -> u8 {
                self.maximum
            }
        }
        let start = replay(Cube::SOLVED, &[3, 6]);
        for maximum in 10..=13 {
            for prefix_started in [false, true] {
                let oracle = RecordingBound {
                    maximum,
                    queries: std::cell::RefCell::new(Vec::new()),
                };
                let mut stats = SearchStats::default();
                let symmetries = RootSymmetries::new(&start, &oracle);
                let result = search_depth(
                    start,
                    &oracle,
                    SearchOptions {
                        max_depth: 20,
                        max_nodes: 1,
                        contexts: 1,
                    },
                    maximum + u8::from(prefix_started),
                    &mut stats,
                    &symmetries,
                    &mut PrefixQueue::default(),
                );
                assert!(matches!(result, DepthResult::Cancelled));
                assert_eq!(stats.nodes, 1);
                assert_eq!(stats.jobs, u64::from(prefix_started));
                let first = if prefix_started {
                    start.moved(0)
                } else {
                    start
                };
                assert_eq!(*oracle.queries.borrow(), vec![first.inverse(), first]);
            }
        }
    }

    struct SymmetryZeroBound;
    impl PruningOracle for SymmetryZeroBound {
        type Query = u64;
        fn prepare(&self, _: &Cube, _: u8) -> Result<u64, u8> {
            Ok(0)
        }
        fn lookup(&self, _: u64) -> u8 {
            0
        }
        fn conjugate(&self, cube: &Cube, symmetry: u8) -> Option<Cube> {
            if symmetry == 0 {
                return Some(*cube);
            }
            if symmetry != 2 {
                return None;
            }
            // Original WASM symmetry #2, bytes 189896..189916 of the small
            // initialized-memory fixture. A nontrivial proper order-2 rotation.
            const ROTATION: Cube = Cube {
                corners: [1, 0, 3, 2, 5, 4, 7, 6],
                edges: [2, 0, 6, 4, 14, 12, 10, 8, 20, 22, 16, 18],
            };
            Some(ROTATION.multiplied(cube).multiplied(&ROTATION))
        }
    }

    #[test]
    fn nontrivial_root_symmetry_preserves_shortest_solutions() {
        // This order-2 subgroup fixes U and D, and exchanges R/L and F/B.
        for moves in [&[3, 12][..], &[4, 13], &[0, 4, 13], &[1, 7, 16], &[0, 9]] {
            let start = replay(Cube::SOLVED, moves);
            assert_eq!(SymmetryZeroBound.conjugate(&start, 2), Some(start));
            let symmetry = RootSymmetries::new(&start, &SymmetryZeroBound);
            assert_eq!(symmetry.maps.len(), 2);
            assert!(symmetry.next_mask(&[], ALL_MOVES).count_ones() < 18);
            for contexts in [1, 8] {
                let options = SearchOptions {
                    max_depth: 3,
                    max_nodes: 100_000,
                    contexts,
                };
                let full = solve(start, &ZeroBound, options).unwrap();
                let reduced = solve(start, &SymmetryZeroBound, options).unwrap();
                assert!(!full.cancelled && !reduced.cancelled);
                assert_eq!(reduced.completed_depth, full.completed_depth);
                let solution = reduced.solution.unwrap();
                assert_eq!(solution.len(), full.solution.unwrap().len());
                assert!(replay(start, &solution).is_solved());
            }
        }
    }

    #[test]
    fn split_preserves_ancestor_ownership_and_job_identity() {
        let mut context = Context::empty();
        context.stack.push(Frame::root(Cube::SOLVED));
        for movement in [0, 3] {
            let parent = context.stack.last_mut().unwrap();
            parent.normal_mask = 1 << movement;
            let child = parent.child();
            context.stack.push(child);
        }
        context.stack[1].normal_mask = 1 << 6;
        let original_leaf = context.stack[2].cube;
        context.job = Some(17);
        context.weight = 42;
        context.needs_query = false;
        let other = context.split().unwrap();
        assert_eq!(other.stack.len(), 2);
        assert_eq!(other.stack[0].normal_mask, 0);
        assert_eq!(other.stack[1].normal_mask, 1 << 6);
        assert_eq!(context.stack[1].normal_mask, 0);
        assert_eq!(context.stack[2].cube, original_leaf);
        assert_eq!(other.job, Some(17));
        assert_eq!(other.weight, 0);
        assert_eq!(context.weight, 42);
    }

    #[test]
    fn inherited_halfturn_bound_uses_the_actual_opposite_side() {
        let cube = replay(Cube::SOLVED, &[0, 3, 6]);
        let mut frame = Frame::root(cube);
        frame.normal_bound = 3;
        frame.inverse_bound = 2;
        frame.inverse_mask = 7;
        frame.plan(4, 10);
        assert!(frame.side);
        assert_eq!(frame.inverse_bound, 3);
        frame.normal_mask = 1 << 1;
        let child = frame.child();
        assert!(child.cached_inverse);
        assert_eq!(child.inverse_bound, 3);
        assert_eq!(child.inverse, child.cube.inverse());

        let mut tight = Frame::root(cube);
        tight.inverse_bound = 4;
        tight.normal_bound = 0;
        tight.plan(4, 10);
        assert_eq!(tight.normal_mask & !NO_HALF_TURNS, 0);
        // Thus a half-turn never creates a cached bound > its child budget.
    }

    #[test]
    fn same_face_siblings_are_one_htm_move_apart() {
        let parent = replay(Cube::SOLVED, &[0, 3, 6, 10]);
        for face in 0..6 {
            for first in 0..3 {
                for second in 0..3 {
                    let a = parent.moved(face * 3 + first);
                    let b = parent.moved(face * 3 + second);
                    assert!(a == b || (0..18).any(|movement| a.moved(movement) == b));
                    assert!(
                        a.inverse() == b.inverse()
                            || (0..18)
                                .any(|movement| a.inverse().premoved(movement) == b.inverse())
                    );
                }
            }
        }
    }
}
