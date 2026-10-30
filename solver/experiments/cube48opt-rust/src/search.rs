//! Native search recovered from cube48opt1..9.wasm, without a WASM runtime.
//!
//! Evidence: `.tmp/cubeopt-reverse/cube48opt1.wat` functions 36--44 and 47.
//! The first implementation preserves the two-sided bound, NISS side score,
//! half-turn reuse, same-face backward pruning, and eight interleaved DFS
//! contexts, ranked prefix jobs and root-stabilizer reduction. Rust
//! uses explicit owned stacks and deterministic rank ties, so scheduling and
//! node totals need not be identical to the original pointer-based scheduler.

use crate::cube::{Cube, MOVES};
#[cfg(all(feature = "wasm-padded-state", any(target_family = "wasm", test)))]
use crate::cube::{PaddedCube as FrameCube, moved_pair_padded as moved_frame_pair};
#[cfg(not(all(feature = "wasm-padded-state", any(target_family = "wasm", test))))]
use crate::cube::{Cube as FrameCube, moved_pair as moved_frame_pair};
#[cfg(all(feature = "opt9-native-dynamic", not(target_family = "wasm")))]
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};

#[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
use std::sync::atomic::{AtomicU64, AtomicU8};

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

    /// Optional, separate certificate L <= D(cube). No half-turn invariance,
    /// consistency, or relationship to max_bound is required. The caller may
    /// supply the actual inverse state to avoid materializing a deferred normal
    /// state; inversion preserves D. None means no additional certificate.
    ///
    /// Only L > remaining is consumed, through generic distance rejection.
    /// This value is never stored in either subgroup bound/cache and never
    /// enters the H-specific quarter, axis, backward-coset or coset-chain cuts.
    #[cfg(feature = "corner-research")]
    #[inline(always)]
    fn distance_only_bound(&self, _cube: &Cube, _remaining: u8) -> Option<u8> { None }

    /// Evaluate an independent distance certificate only after the ordinary
    /// subgroup queries survive, retaining their stronger rejection margins.
    #[cfg(feature = "corner-research")]
    #[inline(always)]
    fn distance_only_after_primary(&self) -> bool { false }

    /// Optional batched reads of the same immutable oracle. None slots must
    /// not issue a lookup; their result is unused. Returned bounds must equal
    /// lookup(query), independent of lookup/prepare call interleaving.
    #[cfg(any(feature = "wasm-batch-probes", all(any(feature = "opt10-native-batch", feature = "opt11-native-batch"), not(target_family = "wasm"))))]
    #[inline(always)]
    fn lookup_batch(&self, queries: &[Option<Self::Query>; MAX_CONTEXTS]) -> [u8; MAX_CONTEXTS] {
        std::array::from_fn(|i| queries[i].map_or(0, |query| self.lookup(query)))
    }

    /// Cooperative cancellation used by parallel depth shards. Ordinary
    /// backends compile the default false away and keep their old behavior.
    #[inline(always)]
    fn cancelled(&self) -> bool { false }

    /// Maximum decoded bound: Opt1 = 10, Opt2/3 = 11, Opt4..7 = 12,
    /// Opt8/9 = 13; Nissy h0..3 = 11, h4..7 = 12, h8..11 = 13.
    /// This also sets the NISS threshold, prefix-job starting
    /// depth, and reciprocal-distance ranking scale recovered from each WASM.
    fn max_bound(&self) -> u8 {
        10
    }

    /// Experimental parent propagation is opt-in per backend.
    /// This does not strengthen or replace the half-turn-invariant oracle.
    #[inline(always)]
    fn allow_parent_propagation(&self) -> bool { false }

    /// Experimental native scheduling only. All workers retain the same
    /// canonical prefix set, but may claim any unowned prefix at this depth.
    #[inline(always)]
    fn allow_dynamic_prefixes(&self) -> bool { false }

    /// Opt-in native pruning of inverse-coordinate-equivalent quarter turns.
    /// This uses the existing left-half-turn invariant; it does not cache or
    /// strengthen the oracle's stored bounds.
    #[inline(always)]
    fn allow_quarter_pruning(&self) -> bool { false }

    /// Reuse an accepted opposite-side bound for the other quarter turn on
    /// the same face. This retains the exact bound, including a valid zero.
    #[inline(always)]
    fn allow_quarter_cache(&self) -> bool { false }

    /// Native coordinators may skip depths proved impossible by both root
    /// queries. The worker constructor independently checks that proof.
    #[inline(always)]
    fn allow_root_bound(&self) -> bool { false }

    /// On a weak inverse rejection, optionally query the other side to seek
    /// a stronger local backtrack proof. Never cache the propagated proof.
    #[inline(always)]
    fn allow_dual_rejection(&self) -> bool { false }

    /// Propagate a direct normal-child coset proof to constrain its parent's
    /// opposite-side first move. Never uses a generic full-state BPMX proof.
    #[inline(always)]
    fn allow_backward_coset(&self) -> bool { false }

    /// Extend direct query certificates through right moves and opposite
    /// half turns. An opposite quarter turn ends this proof chain.
    #[inline(always)]
    fn allow_coset_chain(&self) -> bool { false }

    /// Diagnostic counters only. Does not change query order or pruning.
    #[inline(always)]
    fn profile_search(&self) -> bool { false }

    /// Select an optional legal half turn for a surviving normal-side state.
    /// h(gM)-1 is a d_H(g) certificate, so it may strengthen the stored normal
    /// bound. For fixed remaining/normal_bound, a selector must satisfy
    /// M(ag)=M(g) for every a in H; this preserves the value's left-H
    /// invariance. Default oracles retain their exact query/ordering behavior.
    #[inline(always)]
    fn lookahead_move(&self, _cube: &Cube, _remaining: u8, _normal_bound: u8) -> Option<u8> { None }

    /// Prepare an alternative projection of the same surviving normal state.
    /// lookup(query) must be a d_H(cube) lower bound, not a neighboring-state
    /// or full-state-only bound. For fixed remaining/normal_bound, its chosen
    /// projection and decoded bound must be invariant under left H. This
    /// permits max merging and the existing NISS/half-turn certificate reuse.
    #[inline(always)]
    fn alternative_query(&self, _cube: &Cube, _original_query: Self::Query, _remaining: u8, _normal_bound: u8) -> Option<Self::Query> { None }

    /// Reorder equal-width NISS sides only. Prefer the larger opposite-side
    /// bound as a hypothesis about early rejection, without changing coverage.
    #[inline(always)]
    fn allow_niss_inverse_tie(&self) -> bool { false }

    /// Reuse rejection proofs across two commuting opposite-face moves.
    /// These cuts remain confined to this context's pending move masks.
    #[inline(always)]
    fn allow_axis_pruning(&self) -> bool { false }

    /// Aggregate previous-depth prefix scores across native workers.
    #[inline(always)]
    fn allow_global_prefix_ranking(&self) -> bool { false }

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
    #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
    pub projection_attempts: u64,
    #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
    pub projection_probes: u64,
    #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
    pub projection_raises: u64,
    #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
    pub projection_rejects: u64,
    /// Attribution buckets for remaining budgets [11, 12].
    #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
    pub projection_attempts_by_remaining: [u64; 2],
    #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
    pub projection_raises_by_remaining: [u64; 2],
    #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
    pub projection_rejects_by_remaining: [u64; 2],
    #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
    pub profile: SearchProfile,
    #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
    pub lookahead_attempts: u64,
    #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
    pub lookahead_probes: u64,
    #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
    pub lookahead_raises: u64,
    #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
    pub lookahead_rejects: u64,
    #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
    pub lookahead_tightened_at_budget: u64,
    #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
    pub lookahead_half_prunes: u64,
    /// Attribution buckets for remaining budgets [10, 11, 12].
    #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
    pub lookahead_attempts_by_remaining: [u64; 3],
    #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
    pub lookahead_raises_by_remaining: [u64; 3],
    #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
    pub lookahead_rejects_by_remaining: [u64; 3],
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
    /// Extra prepare attempts, strict bound raises, and newly proved whole
    /// parent cuts. Actual extra lookups also contribute to ordinary probes.
    #[cfg(all(feature = "opt10-native-dual", not(target_family = "wasm")))]
    pub dual_attempts: u64,
    #[cfg(all(feature = "opt10-native-dual", not(target_family = "wasm")))]
    pub dual_raised: u64,
    #[cfg(all(feature = "opt10-native-dual", not(target_family = "wasm")))]
    pub dual_parent_cuts: u64,
    /// Local parent masks strengthened by a child coset proof, and the actual
    /// inverse half-turn bits removed. These are not global subtree counts.
    #[cfg(any(all(feature = "wasm-coset-prune", any(target_family = "wasm", test)), all(any(feature = "opt10-native-coset", feature = "opt11-native-coset"), not(target_family = "wasm"))))]
    pub coset_parent_proofs: u64,
    #[cfg(any(all(feature = "wasm-coset-prune", any(target_family = "wasm", test)), all(any(feature = "opt10-native-coset", feature = "opt11-native-coset"), not(target_family = "wasm"))))]
    pub coset_half_prunes: u64,
    #[cfg(all(feature = "opt10-native-coset-chain", not(target_family = "wasm")))]
    pub coset_chain_proofs: u64,
    #[cfg(all(feature = "opt10-native-coset-chain", not(target_family = "wasm")))]
    pub coset_chain_attempts: u64,
    #[cfg(all(feature = "opt10-native-coset-chain", not(target_family = "wasm")))]
    pub coset_chain_edges: u64,
    /// Additional whole frames removed after ordinary BPMX, not global jobs.
    #[cfg(all(feature = "opt10-native-coset-chain", not(target_family = "wasm")))]
    pub coset_chain_ancestor_cuts: u64,
    /// Actual local half-turn mask bits newly removed by ancestor equality.
    #[cfg(all(feature = "opt10-native-coset-chain", not(target_family = "wasm")))]
    pub coset_chain_half_prunes: u64,
    /// Native barrier accounting, excluding the separate initial root proof.
    #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
    pub exhausted_depth_nodes: u64,
    #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
    pub solution_depth_nodes: u64,
    #[cfg(any(feature = "wasm-quarter-fixed", all(feature = "opt9-native-quarter", not(target_family = "wasm"))))]
    pub quarter_siblings_removed: u64,
    #[cfg(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
    pub quarter_cache_reuses: u64,
    #[cfg(all(feature = "opt9-native-axis", not(target_family = "wasm")))]
    pub axis_siblings_removed: u64,
    #[cfg(all(feature = "opt9-native-axis", not(target_family = "wasm")))]
    pub axis_deferred_marks: u64,
    #[cfg(all(feature = "opt9-native-axis", not(target_family = "wasm")))]
    pub axis_deferred_siblings_removed: u64,
}

/// Entries are indexed by remaining HTM budget, 0..=20. Root proof queries
/// use an unlimited budget and therefore have separate exact counters.
#[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct SearchProfile {
    pub visited: [u64; 21],
    pub inverse_probes: [u64; 21],
    pub normal_probes: [u64; 21],
    /// Actual Opt10 reads returning <=10; cached bounds are excluded.
    pub inverse_fallback: [u64; 21],
    pub normal_fallback: [u64; 21],
    pub cached_inverse: [u64; 21],
    pub inverse_rejected: [u64; 21],
    pub normal_rejected: [u64; 21],
    /// Independent full-state certificate, separate from subgroup rejection.
    pub distance_attempts: [u64; 21],
    pub distance_queries: [u64; 21],
    pub distance_rejected: [u64; 21],
    /// Sample one hook call in 256 per remaining depth; Some results only.
    /// Includes timing overhead. Diagnostic estimates, not benchmark timings.
    pub distance_samples: [u64; 21],
    pub distance_sample_ns: [u64; 21],
    /// Both bounds passed, before NISS/move-mask planning.
    pub survived: [u64; 21],
    /// Actual stage-4 children generated, indexed by their parent's budget.
    pub child_expansions: [u64; 21],
    /// Visited contexts left unclassified by a terminal return/cancellation.
    pub pending: [u64; 21],
    pub leaf_solved: [u64; 21],
    pub leaf_rejected: [u64; 21],
    pub root_nodes: u64,
    pub root_inverse_probes: u64,
    pub root_normal_probes: u64,
}

#[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
impl SearchProfile {
    pub fn matches_totals(&self, stats: &SearchStats) -> bool {
        self.visited.iter().sum::<u64>() + self.root_nodes == stats.nodes
            && self.inverse_probes.iter().sum::<u64>() + self.root_inverse_probes == stats.inverse_probes
            && self.inverse_probes.iter().sum::<u64>() + self.normal_probes.iter().sum::<u64>()
                + self.root_inverse_probes + self.root_normal_probes == stats.probes
            && self.cached_inverse.iter().sum::<u64>() == stats.cache_reuses
            && (0..=20).all(|r| self.visited[r] == self.inverse_rejected[r] + self.normal_rejected[r]
                + self.distance_rejected[r] + self.survived[r] + self.pending[r] + self.leaf_solved[r] + self.leaf_rejected[r]
                && self.inverse_fallback[r] <= self.inverse_probes[r]
                && self.normal_fallback[r] <= self.normal_probes[r])
    }

    pub fn add(&mut self, part: Self) {
        for r in 0..=20 {
            self.visited[r] += part.visited[r];
            self.inverse_probes[r] += part.inverse_probes[r];
            self.normal_probes[r] += part.normal_probes[r];
            self.inverse_fallback[r] += part.inverse_fallback[r];
            self.normal_fallback[r] += part.normal_fallback[r];
            self.cached_inverse[r] += part.cached_inverse[r];
            self.inverse_rejected[r] += part.inverse_rejected[r];
            self.normal_rejected[r] += part.normal_rejected[r];
            self.distance_attempts[r] += part.distance_attempts[r];
            self.distance_queries[r] += part.distance_queries[r];
            self.distance_rejected[r] += part.distance_rejected[r];
            self.distance_samples[r] += part.distance_samples[r];
            self.distance_sample_ns[r] += part.distance_sample_ns[r];
            self.survived[r] += part.survived[r];
            self.child_expansions[r] += part.child_expansions[r];
            self.pending[r] += part.pending[r];
            self.leaf_solved[r] += part.leaf_solved[r];
            self.leaf_rejected[r] += part.leaf_rejected[r];
        }
        self.root_nodes += part.root_nodes;
        self.root_inverse_probes += part.root_inverse_probes;
        self.root_normal_probes += part.root_normal_probes;
    }

    pub fn json(&self) -> String {
        format!("{{\"visited\":{:?},\"inverse_probes\":{:?},\"normal_probes\":{:?},\"inverse_fallback\":{:?},\"normal_fallback\":{:?},\"cached_inverse\":{:?},\"inverse_rejected\":{:?},\"normal_rejected\":{:?},\"distance_attempts\":{:?},\"distance_queries\":{:?},\"distance_rejected\":{:?},\"distance_samples\":{:?},\"distance_sample_ns\":{:?},\"survived\":{:?},\"child_expansions\":{:?},\"pending\":{:?},\"leaf_solved\":{:?},\"leaf_rejected\":{:?},\"root_nodes\":{},\"root_inverse_probes\":{},\"root_normal_probes\":{}}}",
            self.visited, self.inverse_probes, self.normal_probes, self.inverse_fallback, self.normal_fallback,
            self.cached_inverse, self.inverse_rejected, self.normal_rejected,
            self.distance_attempts, self.distance_queries, self.distance_rejected, self.distance_samples, self.distance_sample_ns,
            self.survived, self.child_expansions, self.pending,
            self.leaf_solved, self.leaf_rejected, self.root_nodes, self.root_inverse_probes, self.root_normal_probes)
    }
}

#[cfg(feature = "corner-research")]
#[inline(always)]
fn independent_distance<O: PruningOracle>(oracle: &O, cube: &Cube, remaining: u8,
    _stats: &mut SearchStats) -> Option<u8> {
    #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
    if oracle.profile_search() {
        let r = usize::from(remaining);
        let profile = &mut _stats.profile;
        profile.distance_attempts[r] += 1;
        let started = (profile.distance_attempts[r] & 255 == 1).then(std::time::Instant::now);
        let bound = oracle.distance_only_bound(cube, remaining);
        if let Some(bound) = bound {
            profile.distance_queries[r] += 1;
            profile.distance_rejected[r] += u64::from(bound > remaining);
            if let Some(started) = started {
                profile.distance_samples[r] += 1;
                profile.distance_sample_ns[r] += started.elapsed().as_nanos() as u64;
            }
        }
        return bound;
    }
    oracle.distance_only_bound(cube, remaining)
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
    cube: FrameCube,
    inverse: FrameCube,
    normal_mask: u32,
    inverse_mask: u32,
    normal_bound: u8,
    inverse_bound: u8,
    cached_inverse: bool,
    /// Current normal side relative to the original input (true = inverse).
    side: bool,
    /// Edge leading to the next frame, expressed in this frame's current side.
    chosen_move: u8,
    /// Deferred normal child is cube * move; inverse is always fully valid.
    /// Prefix construction stays eager. 255 means cube is already materialized.
    #[cfg(all(feature = "wasm-lazy-normal", any(target_family = "wasm", test)))]
    pending_normal: u8,
    /// Upper nibble: face; lower nibble: accepted opposite-side bound.
    /// 0xff means absent, so a cached bound of zero remains distinguishable.
    #[cfg(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
    quarter_cache: u8,
    /// Face A whose pending A' child must omit the opposite-face quarters.
    /// 0xff is absent. The rejection proof is tied to this frame's side/depth.
    #[cfg(all(feature = "opt9-native-axis", not(target_family = "wasm")))]
    axis_quarter_cut: u8,
}

#[cfg(all(feature = "wasm-padded-state", any(target_family = "wasm", test)))]
const _: [(); 64] = [(); std::mem::size_of::<Frame>()];

/// Actual layouts used by the WASM fixture, packed into three byte fields.
#[cfg(all(feature = "wasm-padded-state", any(target_family = "wasm", test)))]
pub fn padded_state_layout() -> u32 {
    std::mem::size_of::<Cube>() as u32
        | (std::mem::size_of::<FrameCube>() as u32) << 8
        | (std::mem::size_of::<Frame>() as u32) << 16
}

impl Frame {
    fn root(cube: Cube) -> Self {
        Self {
            cube: cube.into(),
            inverse: cube.inverse().into(),
            normal_mask: ALL_MOVES,
            inverse_mask: ALL_MOVES,
            normal_bound: 0,
            inverse_bound: 0,
            cached_inverse: false,
            side: false,
            chosen_move: 0,
            #[cfg(all(feature = "wasm-lazy-normal", any(target_family = "wasm", test)))]
            pending_normal: 255,
            #[cfg(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
            quarter_cache: 0xff,
            #[cfg(all(feature = "opt9-native-axis", not(target_family = "wasm")))]
            axis_quarter_cut: 0xff,
        }
    }

    fn plan(&mut self, remaining: u8, max_bound: u8) {
        self.plan_ordered::<false>(remaining, max_bound);
    }

    fn plan_ordered<const INVERSE_TIE: bool>(&mut self, remaining: u8, max_bound: u8) {
        #[cfg(all(feature = "wasm-lazy-normal", any(target_family = "wasm", test)))]
        debug_assert_eq!(self.pending_normal, 255, "NISS requires the actual paired states");
        if self.inverse_bound == remaining {
            self.normal_mask &= NO_HALF_TURNS;
        }
        if self.normal_bound == remaining {
            self.inverse_mask &= NO_HALF_TURNS;
        }
        // step2_plan only considers a switch at remaining <= 10 in opt1.
        // The bound is a tie breaker after move-mask population count.
        if remaining <= max_bound {
            // All supported bounds are <=13, so reversing the tie component
            // cannot overturn a strict move-count comparison. Both choices
            // retain every legal continuation on the selected side.
            let normal_tie = if INVERSE_TIE { self.normal_bound } else { self.inverse_bound };
            let inverse_tie = if INVERSE_TIE { self.inverse_bound } else { self.normal_bound };
            let normal_score = self.normal_mask.count_ones() * 64 + u32::from(normal_tie);
            let inverse_score = self.inverse_mask.count_ones() * 64 + u32::from(inverse_tie);
            if inverse_score < normal_score {
                std::mem::swap(&mut self.cube, &mut self.inverse);
                std::mem::swap(&mut self.normal_mask, &mut self.inverse_mask);
                std::mem::swap(&mut self.normal_bound, &mut self.inverse_bound);
                self.side = !self.side;
                // The saved face describes children in the old normal side.
                #[cfg(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
                { self.quarter_cache = 0xff; }
                #[cfg(all(feature = "opt9-native-axis", not(target_family = "wasm")))]
                { self.axis_quarter_cut = 0xff; }
            }
        }
    }

    fn child(&mut self) -> Self {
        self.child_counted(None)
    }

    fn child_counted(&mut self, _stats: Option<&mut SearchStats>) -> Self {
        self.child_counted_mode::<false>(_stats)
    }

    #[cfg(all(feature = "wasm-lazy-normal", any(target_family = "wasm", test)))]
    #[inline(always)]
    fn materialize_normal(&mut self) {
        if self.pending_normal != 255 {
            self.cube = crate::cube::moved_normal(&self.cube, self.pending_normal).into();
            self.pending_normal = 255;
        }
    }

    fn child_counted_mode<const DEFER: bool>(&mut self, _stats: Option<&mut SearchStats>) -> Self {
        debug_assert_ne!(self.normal_mask, 0);
        #[cfg(all(feature = "wasm-lazy-normal", any(target_family = "wasm", test)))]
        debug_assert_eq!(self.pending_normal, 255, "only materialized parents may expand");
        let movement = self.normal_mask.trailing_zeros() as u8;
        self.normal_mask &= self.normal_mask - 1;
        self.chosen_move = movement;
        #[cfg(all(feature = "wasm-lazy-normal", any(target_family = "wasm", test)))]
        let (cube, inverse) = if DEFER {
            (self.cube, crate::cube::moved_inverse(&self.inverse, movement).into())
        } else { moved_frame_pair(&self.cube, &self.inverse, movement) };
        #[cfg(not(all(feature = "wasm-lazy-normal", any(target_family = "wasm", test))))]
        let (cube, inverse) = moved_frame_pair(&self.cube, &self.inverse, movement);
        let inverse_bound = if movement % 3 == 1 {
            self.inverse_bound
        } else {
            0
        };
        let cached_inverse = inverse_bound != 0;
        #[cfg(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
        let (inverse_bound, cached_inverse) = if movement % 3 != 1
            && self.quarter_cache >> 4 == movement / 3 {
            (self.quarter_cache & 15, true)
        } else { (inverse_bound, cached_inverse) };
        let normal_mask = ALLOWED[usize::from(movement / 3)];
        #[cfg(all(feature = "opt9-native-axis", not(target_family = "wasm")))]
        let normal_mask = if movement % 3 == 2 && self.axis_quarter_cut == movement / 3 {
            let forbidden = 5 << (((movement / 3 + 3) % 6) * 3);
            if let Some(stats) = _stats {
                stats.axis_deferred_siblings_removed += u64::from((normal_mask & forbidden).count_ones());
            }
            normal_mask & !forbidden
        } else { normal_mask };
        Self {
            cube,
            inverse,
            normal_mask,
            inverse_mask: self.inverse_mask,
            normal_bound: 0,
            inverse_bound,
            cached_inverse,
            side: self.side,
            chosen_move: 0,
            #[cfg(all(feature = "wasm-lazy-normal", any(target_family = "wasm", test)))]
            pending_normal: if DEFER { movement } else { 255 },
            #[cfg(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
            quarter_cache: 0xff,
            #[cfg(all(feature = "opt9-native-axis", not(target_family = "wasm")))]
            axis_quarter_cut: 0xff,
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

/// Indices refer to the original stack. This proof is applied only after the
/// ordinary rejection has finished, so it cannot reinterpret BPMX residuals.
#[cfg(all(feature = "opt10-native-coset-chain", not(target_family = "wasm")))]
#[derive(Clone, Copy, Debug)]
struct CosetChainProof {
    keep: u8,
    equal: u8,
    normal: bool,
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
        self.reject_bound(excess, false, stats);
    }

    /// Let the parent be g and its chosen quarter turn F. The alternate
    /// child gF' has inverse Fg^-1 = F²(F'g^-1). Therefore the two inverse
    /// queries have exactly the same H48 coordinate, not merely bounds that
    /// differ by at most one. A rejection at excess=1 can already remove F'.
    ///
    /// NISS may swap a saved child's sides before a later query. Comparing
    /// the child's and parent's side bits identifies the original opposite
    /// side; a split copies both bits and the chosen edge unchanged. We only
    /// clear a bit in this context's owned mask. Zero-mask prefix ancestors
    /// and sibling contexts/threads retain their separate ownership.
    #[cfg(any(feature = "wasm-quarter-fixed", all(feature = "opt9-native-quarter", not(target_family = "wasm"))))]
    fn reject_equivalent_quarter(&mut self, inverse_rejected: bool, stats: &mut SearchStats) {
        let Some(parent_index) = self.stack.len().checked_sub(2) else { return; };
        let child_side = self.stack[parent_index + 1].side;
        let parent = &mut self.stack[parent_index];
        if inverse_rejected != (child_side == parent.side) { return; }
        let movement = parent.chosen_move;
        if movement % 3 == 1 { return; }
        let opposite_quarter = movement / 3 * 3 + 2 - movement % 3;
        let removed = parent.normal_mask & (1 << opposite_quarter) != 0;
        parent.normal_mask &= !(1 << opposite_quarter);
        stats.quarter_siblings_removed += u64::from(removed);
    }

    /// For a fixed parent g, (gF)^-1 and (gF')^-1 differ by a left half turn,
    /// so their inverse oracle values are identical. Cache only a bound that
    /// passed at this child's remaining depth; both siblings have that depth.
    /// Moves are consumed in ascending order, so only F can have F' pending.
    /// The parent is immutable while its child is active; splits copy the same
    /// state/depth/side and only partition masks. A NISS swap clears its cache.
    #[cfg(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
    fn remember_successful_quarter(&mut self, remaining: u8) {
        let Some(parent_index) = self.stack.len().checked_sub(2) else { return; };
        let child = self.stack[parent_index + 1];
        let parent = &mut self.stack[parent_index];
        let movement = parent.chosen_move;
        if child.side != parent.side || movement % 3 != 0
            || parent.normal_mask & (1 << (movement + 2)) == 0 { return; }
        debug_assert!(child.inverse_bound <= remaining);
        debug_assert!(child.inverse_bound <= 13);
        parent.quarter_cache = (movement / 3) << 4 | child.inverse_bound;
    }

    #[cfg(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
    fn reuses_quarter_bound(&self) -> bool {
        let Some(parent_index) = self.stack.len().checked_sub(2) else { return false; };
        let parent = &self.stack[parent_index];
        let child = &self.stack[parent_index + 1];
        // A cached quarter edge on its original side came from quarter_cache;
        // after a side swap the already-known normal bound is reused instead.
        child.cached_inverse && child.side == parent.side && parent.chosen_move % 3 != 1
    }

    /// Write b(g)=h(g^-1). For opposite faces A,B, their moves commute:
    ///   b(g A² B)=h(A² B^-1 g^-1)=b(g B).
    /// If the grandchild exceeds its budget by >=2, gB (one move shallower)
    /// also exceeds its budget. B and B' have equal inverse bounds, so both
    /// pending direct children of g can be removed immediately.
    ///
    /// Also b(g A B)=b(g A' B)=b(g A B')=b(g A' B'): changing either quarter
    /// multiplies the inverse on the left by a half turn, using AB=BA. A failed
    /// grandchild therefore proves both B quarters impossible under pending
    /// A'. The one-byte marker affects only that future child's normal mask.
    /// It never cuts the complete A' subtree or its inverse-side move mask.
    ///
    /// The two edges must have been made on one side. A later inversion of
    /// the grandchild is allowed only if the rejected query was its original
    /// inverse. Grandparent NISS swaps invalidate the marker; splits copy the
    /// same proof but only partition masks. No other context/job is modified.
    #[cfg(all(feature = "opt9-native-axis", not(target_family = "wasm")))]
    fn reject_axis_equivalents(&mut self, inverse_rejected: bool, excess: u8, stats: &mut SearchStats) {
        let Some(grandparent_index) = self.stack.len().checked_sub(3) else { return; };
        let parent = self.stack[grandparent_index + 1];
        let child_side = self.stack[grandparent_index + 2].side;
        let grandparent = &mut self.stack[grandparent_index];
        if parent.side != grandparent.side || inverse_rejected != (child_side == parent.side) { return; }
        let first = grandparent.chosen_move;
        let second = parent.chosen_move;
        if second % 3 == 1 || (first / 3 + 3) % 6 != second / 3 { return; }
        if first % 3 == 1 && excess >= 2 {
            let forbidden = 5 << (second / 3 * 3);
            stats.axis_siblings_removed += u64::from((grandparent.normal_mask & forbidden).count_ones());
            grandparent.normal_mask &= !forbidden;
        } else if first % 3 == 0 && excess >= 1
            && grandparent.normal_mask & (1 << (first + 2)) != 0 {
            let face = first / 3;
            stats.axis_deferred_marks += u64::from(grandparent.axis_quarter_cut != face);
            grandparent.axis_quarter_cut = face;
        }
    }

    /// Only an already failed inverse query reaches this gate. At budget <=10,
    /// the maximum 13 can turn excess 1/2 into a whole-parent proof. Skip cases
    /// where existing quarter/same-face pruning already empties our parent's
    /// owned mask; zero-mask prefix ancestors and other split owners are not
    /// reasons to issue another query. This method does not mutate any proof.
    #[cfg(all(feature = "opt10-native-dual", not(target_family = "wasm")))]
    fn dual_probe_has_owned_work(&self, remaining: u8, excess: u8, quarter: bool) -> bool {
        if remaining == 0 || remaining > 10 || !matches!(excess, 1 | 2) {
            return false;
        }
        let Some(parent_index) = self.stack.len().checked_sub(2) else { return false; };
        let child = &self.stack[parent_index + 1];
        let parent = &self.stack[parent_index];
        let movement = parent.chosen_move;
        let mut pending = parent.normal_mask;
        if excess == 2 {
            pending &= !(7 << (movement / 3 * 3));
        } else if quarter && child.side == parent.side && movement % 3 != 1 {
            let other = movement / 3 * 3 + 2 - movement % 3;
            pending &= !(1 << other);
        }
        pending != 0
    }

    /// Let H be the subgroup generated by face half turns. A raw admissible
    /// left-H-invariant bound satisfies h(x)<=d_H(x)=min_a_in_H d(ax).
    /// For the normal child x=gM, d_H(g)>=h(x)-1. At child excess two,
    /// h(x)=r+2, this reaches the parent budget r+1. An inverse-side half
    /// turn cannot lower d_H, so the parent's remaining branches must not
    /// use it as their first inverse move. Right suffixes preserve that
    /// proof with one unit lost per move, until the inverse side is used.
    ///
    /// Apply only to the direct query, before generic BPMX changes excess.
    /// The side test is the opposite of inverse-quarter equivalence. A NISS
    /// swap preserves the certificate's identity via the saved side bits.
    /// Only our own pending branch mask is changed; no Frame bound, cache,
    /// other split context, prefix ownership, or ranking is modified.
    #[cfg(any(all(feature = "wasm-coset-prune", any(target_family = "wasm", test)), all(any(feature = "opt10-native-coset", feature = "opt11-native-coset"), not(target_family = "wasm"))))]
    fn reject_backward_coset(&mut self, inverse_rejected: bool, excess: u8, stats: &mut SearchStats) {
        if excess != 2 { return; }
        let Some(parent_index) = self.stack.len().checked_sub(2) else { return; };
        let child_side = self.stack[parent_index + 1].side;
        let parent = &mut self.stack[parent_index];
        if inverse_rejected == (child_side == parent.side) { return; }
        // Existing excess-two handling will remove this entire face. If no
        // owned branch survives, strengthening the inverse mask is pointless.
        let face = 7 << (parent.chosen_move / 3 * 3);
        if parent.normal_mask & !face == 0 { return; }
        let removed = parent.inverse_mask & !NO_HALF_TURNS;
        if removed == 0 { return; }
        parent.inverse_mask &= NO_HALF_TURNS;
        stats.coset_parent_proofs += 1;
        stats.coset_half_prunes += u64::from(removed.count_ones());
    }

    /// Keep the query's global side fixed while walking immutable path edges.
    /// A same-side child is gM, so d_H(g)>=h(gM)-1. An opposite-side child
    /// is M^-1 g^-1: only a half turn lies in H and transports its certificate
    /// for free. A quarter turn cannot be crossed. Each ancestor adds one to
    /// the budget, so excess falls by two on a right edge and one on a left
    /// half turn. NISS changes neither the fixed query side nor these facts.
    ///
    /// Direct excess two keeps its existing fast path. Nothing here mutates
    /// stored bounds, caches, masks, or prefix ownership. Whole-frame proofs
    /// and the first equality are captured before ordinary BPMX can pop them.
    #[cfg(all(feature = "opt10-native-coset-chain", not(target_family = "wasm")))]
    fn coset_chain_proof(&self, inverse_rejected: bool, excess: u8, stats: &mut SearchStats) -> Option<CosetChainProof> {
        self.coset_chain_proof_gated::<{ cfg!(feature = "opt10-native-coset-gated") }>(inverse_rejected, excess, stats)
    }

    #[cfg(all(feature = "opt10-native-coset-chain", not(target_family = "wasm")))]
    fn coset_chain_proof_gated<const GATED: bool>(&self, inverse_rejected: bool, excess: u8, stats: &mut SearchStats) -> Option<CosetChainProof> {
        if excess < 3 || self.stack.len() < 2 { return None; }
        debug_assert!(self.stack.len() <= usize::from(MAX_DEPTH) + 1);
        let global_side = self.stack.last().unwrap().side ^ inverse_rejected;
        if GATED {
            let parent = &self.stack[self.stack.len() - 2];
            // The existing walk immediately stops at this edge, returning
            // None without changing any mask. Reject it before constructing
            // a proof or touching diagnostic counters. Opposite half turns
            // remain valid zero-loss edges, including synthetic fixtures.
            if global_side != parent.side && parent.chosen_move % 3 != 1 {
                return None;
            }
        }
        stats.coset_chain_attempts += 1;
        let mut gap = excess;
        let mut proof = CosetChainProof { keep: self.stack.len() as u8, equal: u8::MAX, normal: false };
        for index in (0..self.stack.len() - 1).rev() {
            stats.coset_chain_edges += 1;
            let parent = &self.stack[index];
            let normal = global_side == parent.side;
            let cost = if normal { 2 } else if parent.chosen_move % 3 == 1 { 1 } else { break; };
            if gap < cost { break; }
            gap -= cost;
            if gap == 0 {
                proof.equal = index as u8;
                proof.normal = normal;
                break;
            }
            proof.keep = index as u8;
        }
        if usize::from(proof.keep) == self.stack.len() && proof.equal == u8::MAX { None }
        else { Some(proof) }
    }

    #[cfg(all(feature = "opt10-native-coset-chain", not(target_family = "wasm")))]
    fn apply_coset_chain(&mut self, proof: CosetChainProof, stats: &mut SearchStats) {
        let mut changed = false;
        if usize::from(proof.keep) < self.stack.len() {
            stats.coset_chain_ancestor_cuts += (self.stack.len() - usize::from(proof.keep)) as u64;
            self.stack.truncate(usize::from(proof.keep));
            changed = true;
        }
        if let Some(frame) = self.stack.get_mut(usize::from(proof.equal)) {
            // For a normal certificate, only future owned normal branches
            // benefit from a restriction on the inverse-side first move.
            if !proof.normal || frame.normal_mask != 0 {
                let mask = if proof.normal { &mut frame.inverse_mask } else { &mut frame.normal_mask };
                let removed = *mask & !NO_HALF_TURNS;
                if removed != 0 {
                    *mask &= NO_HALF_TURNS;
                    stats.coset_chain_half_prunes += u64::from(removed.count_ones());
                    changed = true;
                }
            }
        }
        stats.coset_chain_proofs += u64::from(changed);
        while self.stack.last().is_some_and(|frame| frame.normal_mask == 0) {
            self.stack.pop();
        }
    }

    fn reject_bound(&mut self, mut excess: u8, propagate_parent: bool, stats: &mut SearchStats) {
        self.stack.pop();
        // An admissible child bound h and child budget r imply a full-state
        // parent bound h-1 against budget r+1: its excess is excess-2.
        // NISS inversion preserves distance to solved. Propagate only this
        // local rejection proof; it is NOT a half-turn-invariant table bound.
        if propagate_parent && excess > 2 {
            let count = self.stack.len().min(usize::from((excess - 1) / 2));
            self.stack.truncate(self.stack.len() - count);
            excess -= 2 * count as u8;
        }
        if excess > 1 {
            if let Some(parent) = self.stack.last_mut() {
                // If child h > r+1, every sibling on the same face has h > r:
                // two different powers of one face differ by a single HTM move.
                // At excess=2 the whole parent is not proved impossible; retain
                // the original same-face cut using its recorded chosen move.
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
    fn split_into(&mut self, other: &mut Self) -> bool {
        // The caller has already finished this vacant context. Keep its
        // MAX_DEPTH+1 frame buffer instead of allocating a replacement on
        // every split (which crosses the host allocator ABI in shared WASM).
        debug_assert!(other.stack.is_empty());
        debug_assert!(other.job.is_none());
        if self.needs_query {
            return false;
        }
        let Some(last) = self.stack.len().checked_sub(1) else { return false; };
        let Some(split_at) = self.stack.iter().enumerate().position(|(i, frame)| {
            frame.normal_mask != 0 && (i != last || frame.normal_mask.count_ones() > 1)
        }) else { return false; };
        other.stack.extend_from_slice(&self.stack[..=split_at]);
        other.job = self.job;
        other.weight = 0;
        other.needs_query = false;
        let mask = self.stack[split_at].normal_mask;
        let mut high = mask;
        for _ in 0..mask.count_ones() / 2 {
            high &= high - 1;
        }
        self.stack[split_at].normal_mask &= !high;
        other.stack[split_at].normal_mask = high;
        true
    }

    #[cfg(any(test, feature = "bpmx-check"))]
    fn split(&mut self) -> Option<Self> {
        let mut other = Self::empty();
        self.split_into(&mut other).then_some(other)
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

/// Atomic ownership of canonical prefixes, independent of each worker's local
/// ranking. The native coordinator resets this only after its depth barrier.
/// At a given depth every prefix has the same length (one through four), so
/// its base-18 encoding uniquely identifies it within this ownership array.
#[cfg(all(feature = "opt9-native-dynamic", not(target_family = "wasm")))]
pub struct PrefixClaims {
    claimed: Box<[AtomicBool]>,
    #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
    ranked: Option<RankedPrefixWeights>,
}

/// A depth barrier freezes the previous buffer while workers accumulate the
/// current one. Keys are canonical base-18 prefixes, never local sorted indices.
#[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
struct RankedPrefixWeights {
    weights: [Box<[AtomicU64]>; 2],
    // 255 = new; 254 = stopped; 0..20 = exhausted; 32+d = running depth d.
    phase: AtomicU8,
}

#[cfg(all(feature = "opt9-native-dynamic", not(target_family = "wasm")))]
impl PrefixClaims {
    pub fn new() -> Self {
        Self {
            claimed: (0..18_usize.pow(4)).map(|_| AtomicBool::new(false)).collect(),
            #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
            ranked: None,
        }
    }

    #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
    pub fn new_ranked() -> Self {
        let mut claims = Self::new();
        claims.ranked = Some(RankedPrefixWeights {
            weights: std::array::from_fn(|_| (0..18_usize.pow(4)).map(|_| AtomicU64::new(0)).collect()),
            phase: AtomicU8::new(255),
        });
        claims
    }

    /// Coordinator-only, after every worker has joined the preceding barrier.
    /// A failed/cancelled/incomplete depth cannot provide the next ranking.
    #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
    pub fn begin_depth(&self, depth: u8) -> Result<(), String> {
        if let Some(ranked) = &self.ranked {
            if depth > MAX_DEPTH { return Err("ranked prefix depth exceeds 20".into()); }
            let previous = ranked.phase.load(Ordering::Relaxed);
            if previous != 255 && !(previous < MAX_DEPTH && previous + 1 == depth) {
                return Err("ranked prefix depth did not follow a fully exhausted barrier".into());
            }
            for weight in &ranked.weights[usize::from(depth & 1)] { weight.store(0, Ordering::Relaxed); }
            ranked.phase.store(32 + depth, Ordering::Relaxed);
        }
        self.reset();
        Ok(())
    }

    /// Called only after all results at this depth arrive. Found/cancelled/error
    /// results stop ranking advancement even if some peers exhausted their work.
    #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
    pub fn complete_depth(&self, depth: u8, exhausted: bool) -> Result<(), String> {
        if let Some(ranked) = &self.ranked {
            if depth > MAX_DEPTH || ranked.phase.load(Ordering::Relaxed) != 32 + depth {
                return Err("ranked prefix completion has no matching running depth".into());
            }
            ranked.phase.store(if exhausted { depth } else { 254 }, Ordering::Relaxed);
        }
        Ok(())
    }

    #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
    fn previous_weights(&self, depth: u8) -> Option<&[AtomicU64]> {
        let ranked = self.ranked.as_ref()?;
        assert_eq!(ranked.phase.load(Ordering::Relaxed), 32 + depth);
        depth.checked_sub(1).map(|previous| ranked.weights[usize::from(previous & 1)].as_ref())
    }

    #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
    fn record_weight(&self, depth: u8, key: usize, weight: u64) {
        let Some(ranked) = &self.ranked else { return; };
        debug_assert_eq!(ranked.phase.load(Ordering::Relaxed), 32 + depth);
        ranked.weights[usize::from(depth & 1)][key].fetch_add(weight, Ordering::Relaxed);
    }

    /// No worker may still read or claim the preceding depth during reset.
    pub fn reset(&self) {
        for claimed in &self.claimed { claimed.store(false, Ordering::Relaxed); }
    }

    fn claim(&self, key: usize) -> bool {
        // The bit grants exclusive ownership; no mutable job data is exchanged.
        // The command/result channels supply the reset/depth happens-before.
        let claimed = &self.claimed[key];
        !claimed.load(Ordering::Relaxed)
            && claimed.compare_exchange(false, true, Ordering::Relaxed, Ordering::Relaxed).is_ok()
    }
}

#[derive(Default)]
struct PrefixQueue {
    jobs: Vec<PrefixJob>,
    next: usize,
    shard: Option<SearchShard>,
    #[cfg(all(feature = "opt9-native-dynamic", not(target_family = "wasm")))]
    claims: Option<Arc<PrefixClaims>>,
    #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
    ranking_depth: Option<u8>,
}

impl PrefixQueue {
    fn prepare(&mut self, depth: u8, max_bound: u8, symmetries: &RootSymmetries) {
        self.next = 0;
        #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
        { self.ranking_depth = self.claims.as_ref().filter(|c| c.ranked.is_some()).map(|_| depth); }
        if depth <= max_bound {
            return;
        }
        #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
        let globally_ranked = self.ranking_depth.is_some();
        #[cfg(not(all(feature = "opt9-native-ranked", not(target_family = "wasm"))))]
        let globally_ranked = false;
        #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
        if globally_ranked {
            let previous = self.claims.as_ref().unwrap().previous_weights(depth);
            let expected_len = usize::from((depth - max_bound - 1).min(4));
            for job in &mut self.jobs {
                assert_eq!(job.len, expected_len, "previous-depth prefix length differs");
                let key = job.moves[..job.len].iter().fold(0usize, |key, &m| key * 18 + usize::from(m));
                job.weight = previous.map_or(0, |weights| weights[key].load(Ordering::Relaxed));
            }
            // A canonical tie-breaker makes different local list histories
            // converge, including all-zero rankings. Scores never prune jobs.
            self.jobs.sort_by_key(|job| {
                let factor = if job.moves[job.len - 1] / 3 < 3 { 47525_u64 } else { 58206 };
                let key = job.moves[..job.len].iter().fold(0usize, |key, &m| key * 18 + usize::from(m));
                (std::cmp::Reverse(u128::from(job.weight) * u128::from(factor)), key)
            });
        }
        if !globally_ranked {
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
        }
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

    fn fetch_into(&mut self, start: Cube, stats: &mut SearchStats, context: &mut Context) -> bool {
        #[cfg(all(feature = "opt9-native-dynamic", not(target_family = "wasm")))]
        let dynamic = self.claims.is_some();
        #[cfg(not(all(feature = "opt9-native-dynamic", not(target_family = "wasm"))))]
        let dynamic = false;
        #[cfg(all(feature = "opt9-native-dynamic", not(target_family = "wasm")))]
        if let Some(claims) = &self.claims {
            while let Some(job) = self.jobs.get(self.next) {
                let key = job.moves[..job.len].iter().fold(0usize, |key, &m| key * 18 + usize::from(m));
                if claims.claim(key) { break; }
                self.next += 1;
            }
        }
        if !dynamic {
            if let Some(shard) = self.shard {
                while let Some(job) = self.jobs.get(self.next) {
                    // Ownership depends only on the prefix, never on locally
                    // accumulated weights or scheduling order in another worker.
                    let key = job.moves[..job.len].iter().fold(0usize, |key, &m| key * 18 + usize::from(m));
                    if key % shard.count == shard.index { break; }
                    self.next += 1;
                }
            }
        }
        let index = self.next;
        let Some(job) = self.jobs.get(index) else {
            return false;
        };
        // Callers finish an exhausted context before refilling it. Preserve its
        // reserved stack allocation; an absent job leaves the context untouched.
        debug_assert!(context.stack.is_empty());
        debug_assert!(context.job.is_none());
        self.next += 1;
        context.job = Some(index);
        context.weight = 0;
        context.needs_query = true;
        context.stack.push(Frame::root(start));
        for &movement in &job.moves[..job.len] {
            let parent = context.stack.last_mut().unwrap();
            parent.normal_mask = 1 << movement;
            let child = parent.child();
            context.stack.push(child);
        }
        stats.jobs += 1;
        true
    }

    fn finish(&mut self, context: &mut Context) {
        if let Some(index) = context.job.take() {
            self.jobs[index].weight += context.weight;
            #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
            if let Some(depth) = self.ranking_depth {
                let job = &self.jobs[index];
                let key = job.moves[..job.len].iter().fold(0usize, |key, &m| key * 18 + usize::from(m));
                self.claims.as_ref().unwrap().record_weight(depth, key, context.weight);
            }
        }
        context.weight = 0;
    }
}

fn inverse_move(movement: u8) -> u8 {
    movement / 3 * 3 + 2 - movement % 3
}

/// Merge a second admissible bound into this rejected node's local proof.
/// Both sides have the same distance to solved; only a strict improvement
/// changes the recorded failure side. No Frame bound or cache is overwritten.
#[cfg(all(feature = "opt10-native-dual", not(target_family = "wasm")))]
fn merge_dual_rejection(remaining: u8, bound: u8, excess: &mut u8,
    inverse_rejected: &mut bool, stats: &mut SearchStats) {
    let stronger = bound.saturating_sub(remaining);
    if stronger > *excess {
        stats.dual_raised += 1;
        stats.dual_parent_cuts += u64::from(*excess <= 2 && stronger >= 3);
        *excess = stronger;
        *inverse_rejected = false;
    }
}

enum DepthResult {
    Found(Vec<u8>),
    Exhausted,
    Cancelled,
}

/// Every raw Opt coset-oracle value is <=d_H. Right multiplication by one move costs at
/// most one in this coset metric, so h(gM)-1 remains <=d_H(g). It can be kept
/// across left-half-turn cache reuse and NISS side exchange. Unlike generic
/// full-state BPMX, this is a coset certificate stored on the actual frame.
#[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
fn merge_lookahead_bound(frame: &mut Frame, remaining: u8, raw: u8, excess: &mut u8, stats: &mut SearchStats) -> bool {
    let bound = raw.saturating_sub(1);
    if bound > frame.normal_bound {
        frame.normal_bound = bound;
        stats.lookahead_raises += 1;
        if (10..=12).contains(&remaining) { stats.lookahead_raises_by_remaining[usize::from(remaining - 10)] += 1; }
        if bound > remaining {
            *excess = bound - remaining;
            stats.lookahead_rejects += 1;
            if (10..=12).contains(&remaining) { stats.lookahead_rejects_by_remaining[usize::from(remaining - 10)] += 1; }
        } else if bound == remaining {
            stats.lookahead_tightened_at_budget += 1;
            return true;
        }
    }
    false
}

/// Both projections describe this same state's left-H coset. Their maximum
/// remains a coset certificate, including after NISS or half-turn cache reuse.
#[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
fn merge_projection_bound(frame: &mut Frame, remaining: u8, bound: u8, excess: &mut u8, stats: &mut SearchStats) {
    if bound > frame.normal_bound {
        frame.normal_bound = bound;
        stats.projection_raises += 1;
        if (11..=12).contains(&remaining) { stats.projection_raises_by_remaining[usize::from(remaining - 11)] += 1; }
        if bound > remaining {
            *excess = bound - remaining;
            stats.projection_rejects += 1;
            if (11..=12).contains(&remaining) { stats.projection_rejects_by_remaining[usize::from(remaining - 11)] += 1; }
        }
    }
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
    #[cfg(any(feature = "wasm-quarter-fixed", all(feature = "opt9-native-fixed-contexts", not(target_family = "wasm"))))]
    {
        match options.contexts {
            1 => search_depth_contexts::<O, 1>(start, oracle, options, depth, stats, symmetries, jobs),
            8 => search_depth_contexts::<O, 8>(start, oracle, options, depth, stats, symmetries, jobs),
            _ => unreachable!("context count is validated before depth search"),
        }
    }
    #[cfg(not(any(feature = "wasm-quarter-fixed", all(feature = "opt9-native-fixed-contexts", not(target_family = "wasm")))))]
    search_depth_contexts::<O, 0>(start, oracle, options, depth, stats, symmetries, jobs)
}

// One search body: only the context container's length becomes a compile-time
// constant in the isolated native candidate. Ordering, masks and ownership are
// unchanged; scratch slots keep the existing MAX_CONTEXTS interface.
fn search_depth_contexts<O: PruningOracle, const N: usize>(
    start: Cube,
    oracle: &O,
    options: SearchOptions,
    depth: u8,
    stats: &mut SearchStats,
    symmetries: &RootSymmetries,
    jobs: &mut PrefixQueue,
) -> DepthResult {
    #[cfg(any(feature = "wasm-quarter-fixed", all(feature = "opt9-native-fixed-contexts", not(target_family = "wasm"))))]
    let mut contexts: [Context; N] = std::array::from_fn(|_| Context::empty());
    #[cfg(not(any(feature = "wasm-quarter-fixed", all(feature = "opt9-native-fixed-contexts", not(target_family = "wasm")))))]
    let mut contexts: Vec<Context> = (0..options.contexts).map(|_| Context::empty()).collect();
    let max_bound = oracle.max_bound();
    let parent_propagation = oracle.allow_parent_propagation();
    #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
    let profiling = oracle.profile_search();
    #[cfg(all(feature = "opt10-native-dual", not(target_family = "wasm")))]
    let dual_rejection = parent_propagation && oracle.allow_dual_rejection();
    #[cfg(any(all(feature = "wasm-coset-prune", any(target_family = "wasm", test)), all(any(feature = "opt10-native-coset", feature = "opt11-native-coset"), not(target_family = "wasm"))))]
    let backward_coset = oracle.allow_backward_coset();
    #[cfg(all(feature = "opt10-native-coset-chain", not(target_family = "wasm")))]
    let coset_chain = oracle.allow_coset_chain();
    #[cfg(any(feature = "wasm-quarter-fixed", all(feature = "opt9-native-quarter", not(target_family = "wasm"))))]
    let quarter_pruning = oracle.allow_quarter_pruning();
    #[cfg(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
    let quarter_cache = oracle.allow_quarter_cache();
    #[cfg(all(feature = "opt9-native-niss", not(target_family = "wasm")))]
    let inverse_tie = oracle.allow_niss_inverse_tie();
    #[cfg(all(feature = "opt9-native-axis", not(target_family = "wasm")))]
    let axis_pruning = oracle.allow_axis_pruning();
    let rank_scale = 1_u32 << max_bound;
    jobs.prepare(depth, max_bound, symmetries);
    if depth <= max_bound {
        let mut root = Frame::root(start);
        root.normal_mask = symmetries.next_mask(&[], ALL_MOVES);
        if let Some(shard) = jobs.shard {
            root.normal_mask &= (0..18).filter(|m| m % shard.count == shard.index)
                .fold(0, |mask, m| mask | (1 << m));
        }
        contexts[0].stack.push(root);
    } else {
        for context in &mut contexts {
            jobs.fetch_into(start, stats, context);
        }
    }
    loop {
        if oracle.cancelled() { return DepthResult::Cancelled; }
        let mut live = [false; MAX_CONTEXTS];
        let mut inverse_coordinate = [None; MAX_CONTEXTS];
        let mut normal_coordinate = [None; MAX_CONTEXTS];
        let mut excess = [0_u8; MAX_CONTEXTS];
        #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
        let mut lookahead_tightened = [false; MAX_CONTEXTS];
        #[cfg(any(feature = "wasm-quarter-fixed", all(any(feature = "opt9-native-quarter", feature = "opt9-native-axis"), not(target_family = "wasm"))))]
        let mut inverse_rejected = [false; MAX_CONTEXTS];

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
            #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
            if profiling { stats.profile.visited[usize::from(remaining)] += 1; }
            if remaining == 0 {
                // Inversion preserves identity. A rejected/solved leaf need
                // never construct its pending normal state.
                #[cfg(all(feature = "wasm-lazy-normal", any(target_family = "wasm", test)))]
                let solved = frame.inverse.is_solved();
                #[cfg(not(all(feature = "wasm-lazy-normal", any(target_family = "wasm", test))))]
                let solved = frame.cube.is_solved();
                if solved {
                    #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
                    if profiling { stats.profile.leaf_solved[0] += 1; }
                    return DepthResult::Found(context.solution());
                }
                #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
                if profiling { stats.profile.leaf_rejected[0] += 1; }
                context.reject(1, stats);
                continue;
            }
            #[cfg(feature = "corner-research")]
            if let Some(bound) = (!oracle.distance_only_after_primary())
                .then(|| independent_distance(oracle, &frame.inverse, remaining, stats)).flatten() {
                if bound > remaining {
                    // A pure distance certificate can use triangle-inequality
                    // parent/same-face cuts, but none of stage 2's H-specific
                    // consequences. Reject before setting live or pending so
                    // this context cannot enter that pipeline or its caches.
                    context.reject_bound(bound - remaining, parent_propagation, stats);
                    continue;
                }
            }
            #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
            if profiling { stats.profile.pending[usize::from(remaining)] += 1; }
            live[i] = true;
            if frame.cached_inverse {
                debug_assert!(frame.inverse_bound <= remaining);
                stats.cache_reuses += 1;
                #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
                if profiling { stats.profile.cached_inverse[usize::from(remaining)] += 1; }
                #[cfg(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
                { stats.quarter_cache_reuses += u64::from(context.reuses_quarter_bound()); }
            } else {
                match oracle.prepare(&frame.inverse, remaining) {
                    Ok(query) => inverse_coordinate[i] = Some(query),
                    Err(bound) => {
                        debug_assert!(bound > remaining);
                        excess[i] = bound - remaining;
                        #[cfg(any(feature = "wasm-quarter-fixed", all(any(feature = "opt9-native-quarter", feature = "opt9-native-axis"), not(target_family = "wasm"))))]
                        { inverse_rejected[i] = true; }
                    }
                }
            }
        }

        // The opt-in batch path issues all inverse reads before any
        // survivor's normal coordinate work. Processing/statistics stay ordered.
        #[cfg(any(feature = "wasm-batch-probes", all(any(feature = "opt10-native-batch", feature = "opt11-native-batch"), not(target_family = "wasm"))))]
        let inverse_bounds = oracle.lookup_batch(&inverse_coordinate);
        // stage 1b: inverse PDB reads; survivors prepare the normal-side query.
        for (i, context) in contexts.iter_mut().enumerate() {
            if !live[i] || excess[i] != 0 {
                continue;
            }
            let remaining = context.remaining(depth);
            let frame = context.stack.last_mut().unwrap();
            if let Some(_index) = inverse_coordinate[i] {
                #[cfg(not(any(feature = "wasm-batch-probes", all(any(feature = "opt10-native-batch", feature = "opt11-native-batch"), not(target_family = "wasm")))))]
                { frame.inverse_bound = oracle.lookup(_index); }
                #[cfg(any(feature = "wasm-batch-probes", all(any(feature = "opt10-native-batch", feature = "opt11-native-batch"), not(target_family = "wasm"))))]
                { frame.inverse_bound = inverse_bounds[i]; }
                stats.probes += 1;
                stats.inverse_probes += 1;
                #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
                if profiling {
                    stats.profile.inverse_probes[usize::from(remaining)] += 1;
                    stats.profile.inverse_fallback[usize::from(remaining)] += u64::from(frame.inverse_bound <= 10);
                }
            }
            if frame.inverse_bound > remaining {
                excess[i] = frame.inverse_bound - remaining;
                #[cfg(any(feature = "wasm-quarter-fixed", all(any(feature = "opt9-native-quarter", feature = "opt9-native-axis"), not(target_family = "wasm"))))]
                { inverse_rejected[i] = true; }
            } else {
                #[cfg(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
                if quarter_cache {
                    context.remember_successful_quarter(remaining);
                }
                // The optional cache update borrows the parent as well.
                let frame = context.stack.last_mut().unwrap();
                #[cfg(all(feature = "wasm-lazy-normal", any(target_family = "wasm", test)))]
                frame.materialize_normal();
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

        #[cfg(any(feature = "wasm-batch-probes", all(any(feature = "opt10-native-batch", feature = "opt11-native-batch"), not(target_family = "wasm"))))]
        let normal_bounds = oracle.lookup_batch(&normal_coordinate);
        // stage 1c: normal PDB reads, kept separate from coordinate computation.
        for (i, context) in contexts.iter_mut().enumerate() {
            let Some(_index) = normal_coordinate[i] else {
                continue;
            };
            let remaining = context.remaining(depth);
            let frame = context.stack.last_mut().unwrap();
            #[cfg(not(any(feature = "wasm-batch-probes", all(any(feature = "opt10-native-batch", feature = "opt11-native-batch"), not(target_family = "wasm")))))]
            { frame.normal_bound = oracle.lookup(_index); }
            #[cfg(any(feature = "wasm-batch-probes", all(any(feature = "opt10-native-batch", feature = "opt11-native-batch"), not(target_family = "wasm"))))]
            { frame.normal_bound = normal_bounds[i]; }
            stats.probes += 1;
            #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
            if profiling {
                stats.profile.normal_probes[usize::from(remaining)] += 1;
                stats.profile.normal_fallback[usize::from(remaining)] += u64::from(frame.normal_bound <= 10);
            }
            // The original score adds one reciprocal power for each side,
            // including a normal-side lookup that subsequently rejects a node.
            context.weight += u64::from(rank_scale >> frame.normal_bound)
                + u64::from(rank_scale >> frame.inverse_bound);
            if frame.normal_bound > remaining {
                excess[i] = frame.normal_bound - remaining;
            }
        }

        // stage 1d: strengthen only survivors, preparing all selected right
        // half turns before reading any. This extra probe adds no weight here;
        // its stronger certificate can later enter the existing weight formula
        // after NISS or inverse-cache reuse.
        #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
        {
            let mut lookahead_queries = [None; MAX_CONTEXTS];
            let mut attempted = false;
            for (i, context) in contexts.iter_mut().enumerate() {
                if !live[i] || excess[i] != 0 { continue; }
                let remaining = context.remaining(depth);
                let frame = context.stack.last_mut().unwrap();
                let Some(movement) = oracle.lookahead_move(&frame.cube, remaining, frame.normal_bound) else { continue; };
                debug_assert!(movement < 18 && movement % 3 == 1);
                stats.lookahead_attempts += 1;
                attempted = true;
                if (10..=12).contains(&remaining) { stats.lookahead_attempts_by_remaining[usize::from(remaining - 10)] += 1; }
                let child = frame.cube.moved(movement);
                match oracle.prepare(&child, remaining + 1) {
                    Ok(query) => lookahead_queries[i] = Some(query),
                    Err(bound) => {
                        debug_assert!(bound > remaining + 1);
                        lookahead_tightened[i] = merge_lookahead_bound(frame, remaining, bound, &mut excess[i], stats);
                        inverse_rejected[i] = false;
                    }
                }
            }
            if attempted && oracle.cancelled() { return DepthResult::Cancelled; }
            for (i, context) in contexts.iter_mut().enumerate() {
                let Some(query) = lookahead_queries[i] else { continue; };
                let remaining = context.remaining(depth);
                let bound = oracle.lookup(query);
                stats.probes += 1;
                stats.lookahead_probes += 1;
                #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
                if profiling {
                    stats.profile.normal_probes[usize::from(remaining)] += 1;
                    stats.profile.normal_fallback[usize::from(remaining)] += u64::from(bound <= 10);
                }
                lookahead_tightened[i] = merge_lookahead_bound(context.stack.last_mut().unwrap(), remaining, bound, &mut excess[i], stats);
                if excess[i] != 0 { inverse_rejected[i] = false; }
            }
        }

        // Alternative same-state projections are prepared for survivors only,
        // then read in a separate pass. The extra probe adds no weight here;
        // a retained stronger certificate may affect later NISS/cache scores.
        #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
        {
            let mut queries = [None; MAX_CONTEXTS];
            let mut attempted = false;
            for (i, context) in contexts.iter().enumerate() {
                if context.stack.is_empty() || excess[i] != 0 { continue; }
                let Some(original_query) = normal_coordinate[i] else { continue; };
                let remaining = context.remaining(depth);
                let frame = context.stack.last().unwrap();
                let Some(query) = oracle.alternative_query(&frame.cube, original_query, remaining, frame.normal_bound) else { continue; };
                queries[i] = Some(query);
                attempted = true;
                stats.projection_attempts += 1;
                if (11..=12).contains(&remaining) { stats.projection_attempts_by_remaining[usize::from(remaining - 11)] += 1; }
            }
            if attempted && oracle.cancelled() { return DepthResult::Cancelled; }
            for (i, context) in contexts.iter_mut().enumerate() {
                let Some(query) = queries[i] else { continue; };
                let remaining = context.remaining(depth);
                let bound = oracle.lookup(query);
                stats.probes += 1;
                stats.projection_probes += 1;
                #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
                if profiling {
                    stats.profile.normal_probes[usize::from(remaining)] += 1;
                    stats.profile.normal_fallback[usize::from(remaining)] += u64::from(bound <= 10);
                }
                merge_projection_bound(context.stack.last_mut().unwrap(), remaining, bound, &mut excess[i], stats);
                if excess[i] != 0 { inverse_rejected[i] = false; }
            }
        }

        // A failed inverse normally skips the other side entirely. A second
        // admissible bound can instead prove its whole parent impossible. Keep
        // these probes separate from ordinary survivors: do not change their
        // ranking weights, stored bounds, half-turn cache, or node accounting.
        #[cfg(all(feature = "opt10-native-dual", not(target_family = "wasm")))]
        if dual_rejection {
            if oracle.cancelled() { return DepthResult::Cancelled; }
            let mut dual_queries = [None; MAX_CONTEXTS];
            for (i, context) in contexts.iter_mut().enumerate() {
                if !live[i] || !inverse_rejected[i] { continue; }
                let remaining = context.remaining(depth);
                if remaining.saturating_add(2) >= max_bound
                    || !context.dual_probe_has_owned_work(remaining, excess[i], quarter_pruning) {
                    continue;
                }
                stats.dual_attempts += 1;
                let frame = context.stack.last_mut().unwrap();
                // Only relevant when unit tests combine the native dual
                // experiment with lazy state; this block is absent in WASM.
                #[cfg(all(feature = "wasm-lazy-normal", test))]
                frame.materialize_normal();
                match oracle.prepare(&frame.cube, remaining) {
                    Ok(query) => dual_queries[i] = Some(query),
                    Err(bound) => {
                        debug_assert!(bound > remaining);
                        merge_dual_rejection(remaining, bound, &mut excess[i], &mut inverse_rejected[i], stats);
                    }
                }
            }
            for (i, context) in contexts.iter().enumerate() {
                let Some(query) = dual_queries[i] else { continue; };
                let bound = oracle.lookup(query);
                stats.probes += 1;
                #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
                if profiling {
                    let r = usize::from(context.remaining(depth));
                    stats.profile.normal_probes[r] += 1;
                    stats.profile.normal_fallback[r] += u64::from(bound <= 10);
                }
                merge_dual_rejection(context.remaining(depth), bound, &mut excess[i], &mut inverse_rejected[i], stats);
            }
        }

        // stage 2: backtrack rejected states, otherwise choose the NISS side.
        for (i, context) in contexts.iter_mut().enumerate() {
            if !live[i] {
                continue;
            }
            #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
            if profiling {
                let r = usize::from(context.remaining(depth));
                stats.profile.pending[r] -= 1;
                if excess[i] == 0 { stats.profile.survived[r] += 1; }
                else if inverse_rejected[i] { stats.profile.inverse_rejected[r] += 1; }
                else { stats.profile.normal_rejected[r] += 1; }
            }
            if excess[i] != 0 {
                #[cfg(all(feature = "opt10-native-coset-chain", not(target_family = "wasm")))]
                let chain_proof = if coset_chain { context.coset_chain_proof(inverse_rejected[i], excess[i], stats) } else { None };
                #[cfg(any(all(feature = "wasm-coset-prune", any(target_family = "wasm", test)), all(any(feature = "opt10-native-coset", feature = "opt11-native-coset"), not(target_family = "wasm"))))]
                if backward_coset {
                    context.reject_backward_coset(inverse_rejected[i], excess[i], stats);
                }
                // Larger excesses already trigger the existing same-face or
                // whole-parent cut, so only the previously missed case needs
                // the additional equivalence check.
                #[cfg(any(feature = "wasm-quarter-fixed", all(feature = "opt9-native-quarter", not(target_family = "wasm"))))]
                if quarter_pruning && excess[i] == 1 {
                    context.reject_equivalent_quarter(inverse_rejected[i], stats);
                }
                #[cfg(all(feature = "opt9-native-axis", not(target_family = "wasm")))]
                if axis_pruning {
                    context.reject_axis_equivalents(inverse_rejected[i], excess[i], stats);
                }
                context.reject_bound(excess[i], parent_propagation, stats);
                #[cfg(all(feature = "opt10-native-coset-chain", not(target_family = "wasm")))]
                if let Some(proof) = chain_proof { context.apply_coset_chain(proof, stats); }
            } else {
                let remaining = context.remaining(depth);
                // Preserve primary failures and their full rejection margin.
                // Distance-only rejection never enters the H-specific cuts;
                // use this existing survivor pass instead of another scan.
                #[cfg(feature = "corner-research")]
                if oracle.distance_only_after_primary() {
                    if let Some(bound) = independent_distance(oracle, &context.stack.last().unwrap().inverse, remaining, stats) {
                        if bound > remaining {
                            #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
                            if profiling { stats.profile.survived[usize::from(remaining)] -= 1; }
                            context.reject_bound(bound - remaining, parent_propagation, stats);
                            continue;
                        }
                    }
                }
                let frame = context.stack.last_mut().unwrap();
                #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
                if lookahead_tightened[i] {
                    debug_assert_eq!(frame.normal_bound, remaining);
                    stats.lookahead_half_prunes += u64::from((frame.inverse_mask & !NO_HALF_TURNS).count_ones());
                }
                #[cfg(all(feature = "opt9-native-niss", not(target_family = "wasm")))]
                if inverse_tie { frame.plan_ordered::<true>(remaining, max_bound); }
                else { frame.plan(remaining, max_bound); }
                #[cfg(not(all(feature = "opt9-native-niss", not(target_family = "wasm"))))]
                frame.plan(remaining, max_bound);
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
                if jobs.fetch_into(start, stats, &mut contexts[empty]) {
                    continue;
                }
            }
            for donor in 0..contexts.len() {
                if donor == empty {
                    continue;
                }
                let split = if donor < empty {
                    let (before, after) = contexts.split_at_mut(empty);
                    before[donor].split_into(&mut after[0])
                } else {
                    let (before, after) = contexts.split_at_mut(donor);
                    after[0].split_into(&mut before[empty])
                };
                if split {
                    stats.splits += 1;
                    break;
                }
            }
        }

        // stage 4: one move per context, preserving the paired inverse state.
        let mut active = false;
        for context in &mut contexts {
            #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
            let parent_remaining = depth.saturating_sub(context.stack.len().saturating_sub(1) as u8);
            if let Some(frame) = context.stack.last_mut() {
                active = true;
                if context.needs_query {
                    continue;
                }
                debug_assert_ne!(frame.normal_mask, 0);
                #[cfg(all(feature = "wasm-lazy-normal", any(target_family = "wasm", test)))]
                let child = frame.child_counted_mode::<true>(Some(stats));
                #[cfg(all(not(all(feature = "wasm-lazy-normal", any(target_family = "wasm", test))), feature = "opt9-native-axis", not(target_family = "wasm")))]
                let child = frame.child_counted(Some(stats));
                #[cfg(all(not(all(feature = "wasm-lazy-normal", any(target_family = "wasm", test))), not(all(feature = "opt9-native-axis", not(target_family = "wasm")))))]
                let child = frame.child();
                #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
                if profiling { stats.profile.child_expansions[usize::from(parent_remaining)] += 1; }
                context.stack.push(child);
                context.needs_query = true;
            }
        }
        if !active {
            return DepthResult::Exhausted;
        }
    }
}

/// One disjoint part of each depth. A coordinator must exhaust all shards at
/// depth d before starting d+1. A result found at d may cancel its siblings.
#[derive(Clone, Copy, Debug)]
pub struct SearchShard { pub index: usize, pub count: usize }

/// Persistent prefix rankings for one worker; no table is owned here. The
/// optional experimental claim array is shared by the coordinator. The start
/// cube and oracle must stay unchanged across depths.
pub struct DepthSearch {
    start: Cube,
    symmetries: RootSymmetries,
    jobs: PrefixQueue,
    next_depth: u8,
}

impl DepthSearch {
    pub fn new<O: PruningOracle>(start: Cube, oracle: &O, shard: SearchShard) -> Result<Self, String> {
        if shard.count == 0 || shard.count > 256 || shard.index >= shard.count {
            return Err("shards require 1..256 workers and a valid worker index".into());
        }
        if !(10..=13).contains(&oracle.max_bound()) { return Err("invalid subgroup bound".into()); }
        Ok(Self { start, symmetries: RootSymmetries::new(&start, oracle),
            jobs: PrefixQueue { shard: Some(shard), ..PrefixQueue::default() }, next_depth: 0 })
    }

    /// Start no deeper than an independently verified admissible root bound.
    /// If L=max(h(g),h(g^-1)), all depths below L are impossible, so searching
    /// consecutively from any depth <=L preserves optimality. Querying with
    /// u8::MAX requires exact decoded values, never a depth-dependent shortcut.
    /// A native coordinator checks cancellation before and after construction.
    #[cfg(any(feature = "wasm-root-bound", all(feature = "opt9-native-root-bound", not(target_family = "wasm"))))]
    pub fn new_with_initial_depth<O: PruningOracle>(start: Cube, oracle: &O,
        shard: SearchShard, initial_depth: u8) -> Result<Self, String> {
        let mut search = Self::new(start, oracle, shard)?;
        let query = oracle.prepare(&start, u8::MAX)
            .map_err(|_| "root query rejected an unlimited depth".to_string())?;
        let normal_bound = oracle.lookup(query);
        let query = oracle.prepare(&start.inverse(), u8::MAX)
            .map_err(|_| "inverse root query rejected an unlimited depth".to_string())?;
        let inverse_bound = oracle.lookup(query);
        if normal_bound > oracle.max_bound() || inverse_bound > oracle.max_bound() {
            return Err("root bound exceeds the declared oracle maximum".into());
        }
        if initial_depth > normal_bound.max(inverse_bound) {
            return Err("initial depth exceeds the independently verified root bound".into());
        }
        search.next_depth = initial_depth;
        Ok(search)
    }

    pub fn run_depth<O: PruningOracle>(&mut self, oracle: &O, depth: u8) -> Result<SearchOutcome, String> {
        self.run_depth_with_options(oracle, depth, SearchOptions::default())
    }

    /// Use one shared ownership array for every worker of this cube. Shallow
    /// depths continue using the ordinary root-move shards.
    #[cfg(all(feature = "opt9-native-dynamic", not(target_family = "wasm")))]
    pub fn set_prefix_claims(&mut self, claims: Arc<PrefixClaims>) {
        self.jobs.claims = Some(claims);
    }

    pub fn run_depth_with_options<O: PruningOracle>(&mut self, oracle: &O, depth: u8, options: SearchOptions) -> Result<SearchOutcome, String> {
        if depth > MAX_DEPTH || depth != self.next_depth { return Err("depths must be searched consecutively from zero".into()); }
        if options.max_depth > MAX_DEPTH || depth > options.max_depth || (options.contexts != 1 && options.contexts != MAX_CONTEXTS) {
            return Err("invalid shard depth or context count".into());
        }
        let mut outcome = SearchOutcome { solution: None, completed_depth: None,
            cancelled: false, stats: SearchStats::default() };
        match search_depth(self.start, oracle, options, depth,
            &mut outcome.stats, &self.symmetries, &mut self.jobs) {
            DepthResult::Found(solution) => outcome.solution = Some(solution),
            DepthResult::Exhausted => { outcome.completed_depth = Some(depth); self.next_depth += 1; }
            DepthResult::Cancelled => outcome.cancelled = true,
        }
        Ok(outcome)
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

    #[cfg(feature = "wasm-padded-state")]
    #[test]
    fn padded_state_preserves_frame_boundaries() {
        assert_eq!(padded_state_layout(), 20 | (24 << 8) | (64 << 16));
        for scramble in ["", "U", "R F U2", "R U R' F D2 B' L"] {
            let start = Cube::from_scramble(scramble).unwrap();
            assert!(crate::cube::verify_padded_move_products(&start));
            for side in [false, true] {
                for movement in 0..18 {
                    let mut parent = Frame::root(start);
                    if side {
                        parent.normal_mask = ALL_MOVES;
                        parent.inverse_mask = 1;
                        parent.plan(6, 13);
                    }
                    assert_eq!(parent.side, side);
                    let base = if side { start.inverse() } else { start };
                    assert_eq!(parent.cube, base);
                    assert_eq!(parent.inverse, base.inverse());
                    parent.normal_mask = 1 << movement;
                    parent.inverse_bound = 7;
                    let child = parent.child();
                    assert_eq!(child.cube, base.moved(movement));
                    assert_eq!(child.inverse, base.inverse().premoved(movement));
                    assert_eq!(child.inverse, child.cube.inverse());
                    assert_eq!(child.cube.is_solved(), child.inverse.is_solved());
                    assert_eq!((child.cached_inverse, child.inverse_bound),
                        (movement % 3 == 1, if movement % 3 == 1 { 7 } else { 0 }));
                    let mut context = Context::empty();
                    context.stack = vec![parent, child];
                    let copied = context.clone();
                    for (a, b) in context.stack.iter().zip(&copied.stack) {
                        assert_eq!((a.cube, a.inverse), (b.cube, b.inverse));
                    }
                    context.reject_bound(1, true, &mut SearchStats::default());
                    assert!(context.stack.len() <= 1);
                    for frame in &context.stack { assert_eq!(frame.inverse, frame.cube.inverse()); }
                }
            }
        }

        let start = Cube::from_scramble("R U F'").unwrap();
        let mut queue = PrefixQueue::default();
        queue.jobs.push(PrefixJob { moves: [0, 3, 6, 0], len: 3, weight: 0 });
        let mut donor = Context::empty();
        assert!(queue.fetch_into(start, &mut SearchStats::default(), &mut donor));
        for (depth, frame) in donor.stack.iter().enumerate() {
            assert_eq!(frame.cube, replay(start, &[0, 3, 6][..depth]));
            assert_eq!(frame.inverse, frame.cube.inverse());
        }
        donor.needs_query = false;
        let mut other = Context::empty();
        assert!(donor.split_into(&mut other));
        for frame in donor.stack.iter().chain(&other.stack) {
            assert_eq!(frame.inverse, frame.cube.inverse());
        }
    }

    #[cfg(feature = "wasm-lazy-normal")]
    #[test]
    fn deferred_normal_preserves_frame_boundaries() {
        // The extra state byte consumes existing padding, not another cache
        // line or a larger stack clone. Cube's 20-byte layout is also fixed.
        assert_eq!(std::mem::size_of::<Cube>(), 20);
        assert_eq!(std::mem::size_of::<Frame>(), if cfg!(feature = "wasm-padded-state") { 64 } else { 56 });
        fn same_frame(a: &Frame, b: &Frame) {
            assert_eq!((a.cube, a.inverse), (b.cube, b.inverse));
            assert_eq!((a.normal_mask, a.inverse_mask), (b.normal_mask, b.inverse_mask));
            assert_eq!((a.normal_bound, a.inverse_bound, a.cached_inverse),
                (b.normal_bound, b.inverse_bound, b.cached_inverse));
            assert_eq!((a.side, a.chosen_move, a.pending_normal),
                (b.side, b.chosen_move, b.pending_normal));
        }
        for scramble in ["", "U", "R F U2", "R U R' F D2 B' L"] {
            let start = Cube::from_scramble(scramble).unwrap();
            assert!(crate::cube::verify_deferred_move_products(&start));
            for movement in 0..18 {
                let mut parent = Frame::root(start);
                parent.normal_mask = 1 << movement;
                parent.inverse_bound = 7;
                let mut eager_parent = parent;
                let eager = eager_parent.child();
                let deferred = parent.child_counted_mode::<true>(None);
                same_frame(&parent, &eager_parent);
                assert_eq!(deferred.cube, start);
                assert_eq!(deferred.inverse, eager.inverse);
                assert_eq!(deferred.pending_normal, movement);
                assert_eq!((deferred.cached_inverse, deferred.inverse_bound),
                    (movement % 3 == 1, if movement % 3 == 1 { 7 } else { 0 }));
                assert_eq!(deferred.inverse.is_solved(), eager.cube.is_solved());
                let mut materialized = deferred;
                materialized.materialize_normal();
                same_frame(&materialized, &eager);
                materialized.materialize_normal();
                same_frame(&materialized, &eager);
                // Both possible NISS choices see the same complete states.
                for switch in [false, true] {
                    let mut a = materialized;
                    let mut b = eager;
                    for frame in [&mut a, &mut b] {
                        frame.normal_mask = if switch { ALL_MOVES } else { 1 };
                        frame.inverse_mask = if switch { 1 } else { ALL_MOVES };
                        frame.normal_bound = 2;
                        frame.inverse_bound = 3;
                        frame.plan(6, 13);
                    }
                    same_frame(&a, &b);
                    assert_eq!(a.side, switch);
                    assert_eq!(a.inverse, a.cube.inverse());
                }
            }
        }

        // A solved leaf may still hold an unsolved normal parent. Identity is
        // instead tested on the exact inverse, requiring no materialization.
        let mut leaf_parent = Frame::root(Cube::SOLVED.moved(2));
        leaf_parent.normal_mask = 1;
        let leaf = leaf_parent.child_counted_mode::<true>(None);
        assert!(!leaf.cube.is_solved());
        assert!(leaf.inverse.is_solved());

        // Rejection can discard a pending state without ever reading its
        // normal cube. It must leave identical parent ownership and stats.
        let mut parent = Frame::root(Cube::from_scramble("R F").unwrap());
        let mut eager_parent = parent;
        let eager = eager_parent.child();
        let deferred = parent.child_counted_mode::<true>(None);
        for excess in [1, 2, 3] {
            let mut a = Context::empty();
            a.stack = vec![parent, deferred];
            let mut b = Context::empty();
            b.stack = vec![eager_parent, eager];
            let mut a_stats = SearchStats::default();
            let mut b_stats = SearchStats::default();
            a.reject_bound(excess, true, &mut a_stats);
            b.reject_bound(excess, true, &mut b_stats);
            assert_eq!(a_stats, b_stats);
            assert_eq!(a.stack.len(), b.stack.len());
            for (a, b) in a.stack.iter().zip(&b.stack) { same_frame(a, b); }
        }

        // Prefixes bypass per-node queries, so every prefix edge must remain
        // eager; otherwise a second move would use a stale parent cube.
        let start = Cube::from_scramble("R U F'").unwrap();
        let mut queue = PrefixQueue::default();
        queue.jobs.push(PrefixJob { moves: [0, 3, 6, 0], len: 3, weight: 0 });
        let mut context = Context::empty();
        assert!(queue.fetch_into(start, &mut SearchStats::default(), &mut context));
        assert_eq!(context.stack.len(), 4);
        for (depth, frame) in context.stack.iter().enumerate() {
            assert_eq!(frame.pending_normal, 255);
            assert_eq!(frame.cube, replay(start, &[0, 3, 6][..depth]));
            assert_eq!(frame.inverse, frame.cube.inverse());
        }

        // Pending contexts cannot be split. After the normal query and plan,
        // a clone/split carries the same fully valid states on both owners.
        let mut donor = Context::empty();
        donor.stack = vec![parent, deferred];
        let mut other = Context::empty();
        assert!(!donor.split_into(&mut other));
        donor.stack.last_mut().unwrap().materialize_normal();
        donor.needs_query = false;
        let clone = donor.clone();
        for (a, b) in donor.stack.iter().zip(&clone.stack) { same_frame(a, b); }
        assert!(donor.split_into(&mut other));
        for frame in donor.stack.iter().chain(&other.stack) {
            assert_eq!(frame.pending_normal, 255);
            assert_eq!(frame.inverse, frame.cube.inverse());
        }
    }

    #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
    #[test]
    fn profile_counts_actual_children_instead_of_planned_states() {
        struct Zero;
        impl PruningOracle for Zero {
            type Query = ();
            fn prepare(&self, _: &Cube, _: u8) -> Result<(), u8> { Ok(()) }
            fn lookup(&self, _: ()) -> u8 { 0 }
            fn profile_search(&self) -> bool { true }
        }
        for contexts in [1, 8] {
            let outcome = solve(Cube::from_scramble("R F").unwrap(), &Zero,
                SearchOptions { max_depth: 1, max_nodes: 0, contexts }).unwrap();
            assert!(outcome.solution.is_none() && !outcome.cancelled);
            assert!(outcome.stats.profile.matches_totals(&outcome.stats));
            let mut expected = [0_u64; 21];
            expected[1] = 18;
            assert_eq!(outcome.stats.profile.child_expansions, expected);
        }
    }

    // Freeze the complete outcome/statistics and each direction-independent
    // prepare/lookup trace with the old feature-off path, then require exactly
    // the same digest with batching enabled. No PDB or large search is used.
    #[test]
    fn probe_pipeline_search_semantics() {
        use std::cell::Cell;
        fn mix(value: &Cell<u64>, bytes: &[u8]) {
            for &byte in bytes { value.set((value.get() ^ u64::from(byte)).wrapping_mul(1099511628211)); }
        }
        struct TwistBound { early: bool, profile: bool, prepares: Cell<u64>, probes: Cell<u64> }
        impl PruningOracle for TwistBound {
            type Query = u8;
            fn prepare(&self, cube: &Cube, remaining: u8) -> Result<u8, u8> {
                mix(&self.prepares, &cube.to_bytes()); mix(&self.prepares, &[remaining]);
                // A move changes at most four corner orientations, and every
                // half turn preserves the number of twisted corners.
                let bound = cube.corners.iter().filter(|&&c| c >> 3 != 0).count().div_ceil(4) as u8;
                if self.early && bound > remaining { Err(bound) } else { Ok(bound) }
            }
            fn lookup(&self, query: u8) -> u8 { mix(&self.probes, &[query]); query }
            fn profile_search(&self) -> bool { self.profile }
        }
        let digest = Cell::new(14695981039346656037_u64);
        let mut aggregate = SearchStats::default();
        let mut count = 0;
        for scramble in ["", "U", "R2", "R F", "R F U", "F R U2", "R U R'", "F R F' U"] {
            let cube = Cube::from_scramble(scramble).unwrap();
            for contexts in [1, 8] { for early in [false, true] { for budget in [0, 29, 1024] {
                let oracle = TwistBound { early, profile: false, prepares: Cell::new(0), probes: Cell::new(0) };
                let result = solve(cube, &oracle, SearchOptions { max_depth: 3, max_nodes: budget, contexts }).unwrap();
                #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
                {
                    assert_eq!(result.stats.profile, SearchProfile::default());
                    let profiled_oracle = TwistBound { early, profile: true, prepares: Cell::new(0), probes: Cell::new(0) };
                    let profiled = solve(cube, &profiled_oracle, SearchOptions { max_depth: 3, max_nodes: budget, contexts }).unwrap();
                    assert_eq!(profiled.solution, result.solution);
                    assert_eq!((profiled.completed_depth, profiled.cancelled), (result.completed_depth, result.cancelled));
                    assert_eq!((profiled_oracle.prepares.get(), profiled_oracle.probes.get()), (oracle.prepares.get(), oracle.probes.get()));
                    assert!(profiled.stats.profile.matches_totals(&profiled.stats));
                    assert_eq!(profiled.stats.profile.inverse_fallback, profiled.stats.profile.inverse_probes);
                    assert_eq!(profiled.stats.profile.normal_fallback, profiled.stats.profile.normal_probes);
                    let mut unchanged = profiled.stats;
                    unchanged.profile = SearchProfile::default();
                    assert_eq!(unchanged, result.stats);
                }
                if let Some(solution) = &result.solution { assert!(replay(cube, solution).is_solved()); }
                let trace = format!("{result:?}|{}|{}", oracle.prepares.get(), oracle.probes.get());
                #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
                let trace = {
                    assert_eq!((result.stats.projection_attempts, result.stats.projection_probes,
                        result.stats.projection_raises, result.stats.projection_rejects), (0, 0, 0, 0));
                    assert_eq!((result.stats.projection_attempts_by_remaining, result.stats.projection_raises_by_remaining,
                        result.stats.projection_rejects_by_remaining), ([0; 2], [0; 2], [0; 2]));
                    trace.replace("projection_attempts: 0, ", "")
                        .replace("projection_probes: 0, ", "")
                        .replace("projection_raises: 0, ", "")
                        .replace("projection_rejects: 0, ", "")
                        .replace("projection_attempts_by_remaining: [0, 0], ", "")
                        .replace("projection_raises_by_remaining: [0, 0], ", "")
                        .replace("projection_rejects_by_remaining: [0, 0], ", "")
                };
                #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
                let trace = {
                    assert_eq!((result.stats.lookahead_attempts, result.stats.lookahead_probes,
                        result.stats.lookahead_raises, result.stats.lookahead_rejects,
                        result.stats.lookahead_tightened_at_budget, result.stats.lookahead_half_prunes), (0, 0, 0, 0, 0, 0));
                    assert_eq!((result.stats.lookahead_attempts_by_remaining, result.stats.lookahead_raises_by_remaining,
                        result.stats.lookahead_rejects_by_remaining), ([0; 3], [0; 3], [0; 3]));
                    trace.replace("lookahead_attempts: 0, ", "")
                        .replace("lookahead_probes: 0, ", "")
                        .replace("lookahead_raises: 0, ", "")
                        .replace("lookahead_rejects: 0, ", "")
                        .replace("lookahead_tightened_at_budget: 0, ", "")
                        .replace("lookahead_half_prunes: 0, ", "")
                        .replace("lookahead_attempts_by_remaining: [0, 0, 0], ", "")
                        .replace("lookahead_raises_by_remaining: [0, 0, 0], ", "")
                        .replace("lookahead_rejects_by_remaining: [0, 0, 0], ", "")
                };
                #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
                let trace = {
                    assert_eq!(result.stats.profile, SearchProfile::default());
                    trace.replace(&format!("profile: {:?}, ", SearchProfile::default()), "")
                };
                #[cfg(any(feature = "wasm-quarter-fixed", all(feature = "opt9-native-quarter", not(target_family = "wasm"))))]
                let trace = {
                    // This oracle has not opted in. Preserve the frozen
                    // baseline trace, including all its original statistics;
                    // only omit the newly added, explicitly verified zero.
                    assert_eq!(result.stats.quarter_siblings_removed, 0);
                    trace.replace(", quarter_siblings_removed: 0", "")
                };
                #[cfg(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
                let trace = {
                    assert_eq!(result.stats.quarter_cache_reuses, 0);
                    trace.replace(", quarter_cache_reuses: 0", "")
                };
                #[cfg(all(feature = "opt9-native-axis", not(target_family = "wasm")))]
                let trace = {
                    assert_eq!(result.stats.axis_siblings_removed, 0);
                    assert_eq!(result.stats.axis_deferred_marks, 0);
                    assert_eq!(result.stats.axis_deferred_siblings_removed, 0);
                    trace.replace(", axis_siblings_removed: 0", "")
                        .replace(", axis_deferred_marks: 0", "")
                        .replace(", axis_deferred_siblings_removed: 0", "")
                };
                #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
                let trace = {
                    assert_eq!((result.stats.exhausted_depth_nodes, result.stats.solution_depth_nodes), (0, 0));
                    trace.replace(", exhausted_depth_nodes: 0", "").replace(", solution_depth_nodes: 0", "")
                };
                #[cfg(all(feature = "opt10-native-dual", not(target_family = "wasm")))]
                let trace = {
                    // This oracle did not opt in; verify real zeros before
                    // removing only the added fields from the frozen digest.
                    assert_eq!((result.stats.dual_attempts, result.stats.dual_raised,
                        result.stats.dual_parent_cuts), (0, 0, 0));
                    trace.replace(", dual_attempts: 0", "")
                        .replace(", dual_raised: 0", "")
                        .replace(", dual_parent_cuts: 0", "")
                };
                #[cfg(any(all(feature = "wasm-coset-prune", any(target_family = "wasm", test)), all(any(feature = "opt10-native-coset", feature = "opt11-native-coset"), not(target_family = "wasm"))))]
                let trace = {
                    assert_eq!((result.stats.coset_parent_proofs, result.stats.coset_half_prunes), (0, 0));
                    trace.replace(", coset_parent_proofs: 0", "").replace(", coset_half_prunes: 0", "")
                };
                #[cfg(all(feature = "opt10-native-coset-chain", not(target_family = "wasm")))]
                let trace = {
                    assert_eq!((result.stats.coset_chain_proofs, result.stats.coset_chain_attempts,
                        result.stats.coset_chain_edges, result.stats.coset_chain_ancestor_cuts,
                        result.stats.coset_chain_half_prunes), (0, 0, 0, 0, 0));
                    trace.replace(", coset_chain_proofs: 0", "")
                        .replace(", coset_chain_attempts: 0", "")
                        .replace(", coset_chain_edges: 0", "")
                        .replace(", coset_chain_ancestor_cuts: 0", "")
                        .replace(", coset_chain_half_prunes: 0", "")
                };
                mix(&digest, trace.as_bytes());
                aggregate.probes += result.stats.probes; aggregate.cache_reuses += result.stats.cache_reuses;
                aggregate.splits += result.stats.splits; count += 1;
            } } }
        }
        assert_eq!(count, 96);
        // Captured with wasm-batch-probes disabled: complete results, all eight
        // SearchStats fields and separate prepare/probe traces must not drift.
        assert_eq!(digest.get(), 0x6d17ca1f6d7bb115);
        assert_eq!((aggregate.probes, aggregate.cache_reuses, aggregate.splits), (4718, 896, 1250));
        println!("probe pipeline: cases={count} digest={:016x} probes={} cache={} splits={}",
            digest.get(), aggregate.probes, aggregate.cache_reuses, aggregate.splits);
    }

    #[cfg(any(feature = "wasm-batch-probes", all(any(feature = "opt10-native-batch", feature = "opt11-native-batch"), not(target_family = "wasm"))))]
    #[test]
    fn probe_pipeline_none_slots_issue_no_lookup() {
        struct Recording(std::cell::RefCell<Vec<u8>>);
        impl PruningOracle for Recording {
            type Query = u8;
            fn prepare(&self, _: &Cube, _: u8) -> Result<u8, u8> { unreachable!() }
            fn lookup(&self, query: u8) -> u8 { self.0.borrow_mut().push(query); query }
        }
        let oracle = Recording(std::cell::RefCell::new(Vec::new()));
        assert_eq!(oracle.lookup_batch(&[None; 8]), [0; 8]);
        assert!(oracle.0.borrow().is_empty());
        assert_eq!(oracle.lookup_batch(&[None, Some(0), Some(13), None, Some(2), None, None, Some(7)]), [0, 0, 13, 0, 2, 0, 0, 7]);
        assert_eq!(*oracle.0.borrow(), vec![0, 13, 2, 7]);
    }

    #[test]
    fn depth_shards_cover_every_prefix_once_despite_independent_rankings() {
        use std::collections::BTreeSet;
        let symmetries = RootSymmetries { maps: vec![std::array::from_fn(|m| m as u8)] };
        for count in [1, 2, 4, 16] {
            let mut queues: Vec<_> = (0..count).map(|index| PrefixQueue {
                shard: Some(SearchShard { index, count }), ..PrefixQueue::default()
            }).collect();
            let mut reference = PrefixQueue::default();
            for depth in 11..=14 {
                reference.prepare(depth, 10, &symmetries);
                let expected: BTreeSet<Vec<u8>> = reference.jobs.iter().map(|j| j.moves[..j.len].to_vec()).collect();
                let mut visited = BTreeSet::new();
                for (worker, queue) in queues.iter_mut().enumerate() {
                    // Distinct previous-depth weights force independent order,
                    // but must never change global coverage/ownership.
                    for (i, job) in queue.jobs.iter_mut().enumerate() { job.weight = ((i + 7) * (worker + 3) % 101) as u64; }
                    queue.prepare(depth, 10, &symmetries);
                    let mut context = Context::empty();
                    let mut stats = SearchStats::default();
                    while queue.fetch_into(Cube::SOLVED, &mut stats, &mut context) {
                        let job = &queue.jobs[context.job.unwrap()];
                        assert!(visited.insert(job.moves[..job.len].to_vec()), "duplicate prefix ownership");
                        assert_eq!(context.stack.len(), job.len + 1);
                        context.stack.clear(); queue.finish(&mut context);
                    }
                }
                assert_eq!(visited, expected, "missing depth {depth} prefix with {count} workers");
            }
        }
    }

    #[cfg(all(feature = "opt9-native-dynamic", not(target_family = "wasm")))]
    #[test]
    fn dynamic_prefix_claims_cover_every_prefix_once_with_concurrent_distinct_rankings() {
        use std::collections::BTreeSet;
        let symmetries = RootSymmetries { maps: vec![std::array::from_fn(|m| m as u8)] };
        for count in [4, 16] {
            let claims = Arc::new(PrefixClaims::new());
            let mut queues: Vec<_> = (0..count).map(|index| PrefixQueue {
                shard: Some(SearchShard { index, count }), claims: Some(Arc::clone(&claims)),
                ..PrefixQueue::default()
            }).collect();
            let mut reference = PrefixQueue::default();
            // Above max_bound these contain 18, 243, 3240, 43254 and again
            // 43254 canonical jobs. The last iteration tests ownership reset
            // when prefix length stops increasing but depth still advances.
            for depth in 11..=15 {
                reference.prepare(depth, 10, &symmetries);
                let expected: BTreeSet<_> = reference.jobs.iter().map(|j| j.moves[..j.len].to_vec()).collect();
                for (worker, queue) in queues.iter_mut().enumerate() {
                    for (i, job) in queue.jobs.iter_mut().enumerate() {
                        job.weight = ((i + 7) * (worker + 3) % 101) as u64;
                    }
                    queue.prepare(depth, 10, &symmetries);
                    // Previous locally measured scores differ. Reordering is
                    // deliberately unrelated to static key % worker ownership.
                    if worker % 2 == 0 { queue.jobs.reverse(); }
                }
                claims.reset();
                let visits = std::thread::scope(|scope| {
                    let handles: Vec<_> = queues.iter_mut().map(|queue| scope.spawn(move || {
                        let mut context = Context::empty();
                        let mut stats = SearchStats::default();
                        let mut visited = Vec::new();
                        while queue.fetch_into(Cube::SOLVED, &mut stats, &mut context) {
                            let job = &queue.jobs[context.job.unwrap()];
                            visited.push(job.moves[..job.len].to_vec());
                            assert_eq!(context.stack.len(), job.len + 1);
                            context.stack.clear(); queue.finish(&mut context);
                        }
                        assert_eq!(stats.jobs as usize, visited.len());
                        visited
                    })).collect();
                    handles.into_iter().flat_map(|handle| handle.join().unwrap()).collect::<Vec<_>>()
                });
                let actual: BTreeSet<_> = visits.iter().cloned().collect();
                assert_eq!(actual.len(), visits.len(), "duplicate depth {depth} claim");
                assert_eq!(actual, expected, "missing depth {depth} claim with {count} workers");
            }
        }
    }

    #[cfg(all(feature = "opt9-native-dynamic", not(target_family = "wasm")))]
    #[test]
    fn dynamic_search_cancellation_preserves_claims_until_all_workers_join() {
        use std::sync::{Barrier, atomic::AtomicUsize};

        struct BoundedZero<'a> {
            calls: AtomicUsize,
            started: &'a Barrier,
        }
        impl PruningOracle for BoundedZero<'_> {
            type Query = ();
            fn prepare(&self, _: &Cube, _: u8) -> Result<(), u8> {
                if self.calls.fetch_add(1, Ordering::Relaxed) == 0 {
                    // Every worker must own and enter a real prefix before any
                    // can reach its cancellation limit. No fake pruning bound.
                    self.started.wait();
                }
                Ok(())
            }
            fn lookup(&self, _: ()) -> u8 { 0 }
            fn cancelled(&self) -> bool { self.calls.load(Ordering::Relaxed) >= 64 }
            fn allow_dynamic_prefixes(&self) -> bool { true }
            fn allow_quarter_pruning(&self) -> bool { true }
            fn allow_quarter_cache(&self) -> bool { true }
        }

        // WCA 22001, already verified as 18 moves in the frozen native corpus.
        // This fixture exercises cancellation and ownership, not a new proof
        // of its distance. It never loads a PDB or finishes a deep search.
        let start = Cube::from_scramble("B2 U' L2 U F2 L2 D2 L2 U F2 L F2 L D U L' D2 F' U2 B").unwrap();
        let symmetries = RootSymmetries { maps: vec![std::array::from_fn(|m| m as u8)] };
        let workers = 4;
        let depth = 12; // max_bound=10, so this enters two-move prefix jobs.
        for contexts in [1, 8] {
            let claims = Arc::new(PrefixClaims::new());
            let mut queues: Vec<_> = (0..workers).map(|index| PrefixQueue {
                shard: Some(SearchShard { index, count: workers }),
                claims: Some(Arc::clone(&claims)),
                ..PrefixQueue::default()
            }).collect();
            for _ in 0..2 {
                // The previous epoch's scoped join is the ownership barrier.
                claims.reset();
                assert!(claims.claimed.iter().all(|flag| !flag.load(Ordering::Relaxed)));
                let started = Barrier::new(workers);
                let results = std::thread::scope(|scope| {
                    let handles: Vec<_> = queues.iter_mut().map(|queue| {
                        let started = &started;
                        let symmetries = &symmetries;
                        scope.spawn(move || {
                            let oracle = BoundedZero { calls: AtomicUsize::new(0), started };
                            let mut stats = SearchStats::default();
                            let result = search_depth(start, &oracle,
                                SearchOptions { max_depth: depth, max_nodes: 0, contexts },
                                depth, &mut stats, symmetries, queue);
                            assert!(matches!(result, DepthResult::Cancelled));
                            let calls = oracle.calls.load(Ordering::Relaxed);
                            assert!((64..=64 + contexts * 2).contains(&calls));
                            assert!(stats.nodes > 0);
                            assert!(stats.jobs >= contexts as u64);
                            stats.jobs
                        })
                    }).collect();
                    handles.into_iter().map(|handle| handle.join().unwrap()).collect::<Vec<_>>()
                });
                let claimed = claims.claimed.iter().filter(|flag| flag.load(Ordering::Relaxed)).count();
                assert_eq!(claimed as u64, results.iter().sum::<u64>());
                assert!(claimed >= workers * contexts);
                // Cancellation retains these claims; only the coordinator's
                // next reset may release them, after every worker has stopped.
                assert!(claimed < 243);
            }
        }
    }

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

    #[cfg(feature = "corner-research")]
    mod distance_only_tests {
        use super::*;

        // This is exactly min(D, 2): distance zero is identity, and distance
        // one is one of the repository's 18 generators. It needs no PDB and
        // is not H-invariant, since it assigns one to every face half turn.
        fn clipped_distance(cube: &Cube) -> u8 {
            if cube.is_solved() { 0 }
            else if MOVES.iter().any(|movement| movement == cube) { 1 }
            else { 2 }
        }

        struct SeparateBounds { late: bool }
        impl PruningOracle for SeparateBounds {
            type Query = u8;
            fn prepare(&self, _: &Cube, _: u8) -> Result<u8, u8> { Ok(0) }
            fn lookup(&self, _: u8) -> u8 { 0 }
            fn distance_only_bound(&self, cube: &Cube, _: u8) -> Option<u8> {
                Some(clipped_distance(cube))
            }
            fn distance_only_after_primary(&self) -> bool { self.late }
            fn allow_parent_propagation(&self) -> bool { true }
            fn profile_search(&self) -> bool { true }
        }

        #[test]
        fn non_h_invariant_distance_bound_keeps_one_move_half_turn_solutions() {
            for contexts in [1, 8] {
              for late in [false, true] {
                for movement in [1_u8, 4, 7, 10, 13, 16] {
                    let start = MOVES[usize::from(movement)];
                    let result = solve(start, &SeparateBounds { late }, SearchOptions {
                        max_depth: 1, max_nodes: 1000, contexts,
                    }).unwrap();
                    assert!(!result.cancelled);
                    let solution = result.solution.expect("distance-only bounds must retain half turns");
                    assert_eq!(solution.len(), 1);
                    assert!(replay(start, &solution).is_solved());
                }
              }
            }
        }

        struct PrimaryReject;
        impl PruningOracle for PrimaryReject {
            type Query = u8;
            fn prepare(&self, _: &Cube, _: u8) -> Result<u8, u8> { Err(2) }
            fn lookup(&self, _: u8) -> u8 { unreachable!() }
            fn distance_only_after_primary(&self) -> bool { true }
            fn distance_only_bound(&self, _: &Cube, _: u8) -> Option<u8> {
                panic!("an existing primary rejection must retain its margin without an auxiliary query")
            }
        }

        #[test]
        fn late_distance_checks_only_primary_survivors() {
            let options = SearchOptions { max_depth: 1, max_nodes: 1000, contexts: 1 };
            let start = MOVES[0].multiplied(&MOVES[3]);
            let rejected = solve(start, &PrimaryReject, options).unwrap();
            assert_eq!(rejected.solution, None);
            assert_eq!(rejected.stats.nodes, 2);
            assert_eq!(rejected.stats.probes, 0);
            for late in [false, true] {
                let survived = solve(start, &SeparateBounds { late }, options).unwrap();
                assert_eq!(survived.solution, None);
                assert_eq!(survived.stats.nodes, 2);
                assert_eq!(survived.stats.probes, if late { 2 } else { 0 });
                #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
                {
                    assert!(survived.stats.profile.matches_totals(&survived.stats));
                    assert_eq!(survived.stats.profile.distance_queries[1], 1);
                    assert_eq!(survived.stats.profile.distance_rejected[1], 1);
                }
            }
        }

        struct RejectBeforeSubgroupQuery;
        impl PruningOracle for RejectBeforeSubgroupQuery {
            type Query = u8;
            fn prepare(&self, _: &Cube, _: u8) -> Result<u8, u8> {
                panic!("a distance-rejected state must not enter subgroup preparation")
            }
            fn lookup(&self, _: u8) -> u8 { unreachable!("no subgroup query was prepared") }
            fn distance_only_bound(&self, cube: &Cube, remaining: u8) -> Option<u8> {
                assert!(remaining > 0, "zero-budget leaves must precede this hook");
                Some(clipped_distance(cube))
            }
        }

        #[test]
        fn distance_rejection_and_zero_budget_leaves_bypass_subgroup_queries() {
            let options = SearchOptions { max_depth: 1, max_nodes: 1000, contexts: 1 };
            let solved = solve(Cube::SOLVED, &RejectBeforeSubgroupQuery, options).unwrap();
            assert_eq!(solved.solution, Some(Vec::new()));
            let start = MOVES[0].multiplied(&MOVES[3]);
            assert_eq!(clipped_distance(&start), 2);
            let result = solve(start, &RejectBeforeSubgroupQuery, options).unwrap();
            assert!(!result.cancelled);
            assert!(result.solution.is_none());
            assert_eq!(result.completed_depth, Some(1));
            assert_eq!(result.stats.nodes, 2);
            assert_eq!(result.stats.probes, 0);
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
    fn split_reuses_vacant_stack_and_matches_allocating_reference() {
        // The frozen shared-WASM baseline's allocating split, retained only
        // as an independent reference for mask/ownership/state equivalence.
        fn allocating_reference(context: &mut Context) -> Option<Context> {
            if context.needs_query { return None; }
            let last = context.stack.len().checked_sub(1)?;
            let at = context.stack.iter().enumerate().position(|(i, frame)| {
                frame.normal_mask != 0 && (i != last || frame.normal_mask.count_ones() > 1)
            })?;
            let mut other = Context::empty();
            other.stack.extend_from_slice(&context.stack[..=at]);
            other.job = context.job;
            other.needs_query = false;
            let mask = context.stack[at].normal_mask;
            let mut high = mask;
            for _ in 0..mask.count_ones() / 2 { high &= high - 1; }
            context.stack[at].normal_mask &= !high;
            other.stack[at].normal_mask = high;
            Some(other)
        }
        fn frames(context: &Context) -> Vec<([u8; 20], [u8; 20], u32, u32, u8, u8, bool, bool, u8)> {
            context.stack.iter().map(|f| (f.cube.to_bytes(), f.inverse.to_bytes(), f.normal_mask,
                f.inverse_mask, f.normal_bound, f.inverse_bound, f.cached_inverse, f.side, f.chosen_move)).collect()
        }
        let mut vacant = Context::empty();
        let pointer = vacant.stack.as_ptr();
        let capacity = vacant.stack.capacity();
        for depth in 0..=usize::from(MAX_DEPTH) + 1 {
            for pending in 0..=depth {
                for mask in [0, 1, 3, 0b1001001, ALL_MOVES] {
                    for needs_query in [false, true] {
                        let mut donor = Context::empty();
                        donor.job = Some(17);
                        donor.weight = 42;
                        donor.needs_query = needs_query;
                        for i in 0..depth {
                            let mut frame = Frame::root(MOVES[i % 18]);
                            frame.normal_mask = if i == pending { mask } else { 0 };
                            frame.side = i % 2 != 0;
                            frame.chosen_move = (i % 18) as u8;
                            donor.stack.push(frame);
                        }
                        let mut reference = donor.clone();
                        let expected = allocating_reference(&mut reference);
                        let success = donor.split_into(&mut vacant);
                        assert_eq!(success, expected.is_some());
                        assert_eq!(frames(&donor), frames(&reference));
                        assert_eq!((donor.job, donor.weight, donor.needs_query),
                            (reference.job, reference.weight, reference.needs_query));
                        if let Some(expected) = expected {
                            assert_eq!(frames(&vacant), frames(&expected));
                            assert_eq!((vacant.job, vacant.weight, vacant.needs_query),
                                (expected.job, expected.weight, expected.needs_query));
                        } else {
                            assert!(vacant.stack.is_empty() && vacant.job.is_none());
                            assert_eq!((vacant.weight, vacant.needs_query), (0, true));
                        }
                        assert_eq!(vacant.stack.as_ptr(), pointer);
                        assert_eq!(vacant.stack.capacity(), capacity);
                        vacant.stack.clear();
                        vacant.job = None;
                        vacant.weight = 0;
                        vacant.needs_query = true;
                    }
                }
            }
        }
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

#[cfg(any(test, feature = "bpmx-check"))]
#[path = "bpmx_check.rs"]
mod bpmx_check;

#[cfg(feature = "bpmx-check")]
pub fn verify_bpmx_small() -> Result<String, String> {
    bpmx_check::run()
}

#[cfg(all(test, feature = "opt9-native-ranked", not(target_family = "wasm")))]
mod ranked_tests {
    use super::*;
    use std::collections::{BTreeMap, BTreeSet};

    fn key(job: &PrefixJob) -> usize {
        job.moves[..job.len].iter().fold(0usize, |key, &m| key * 18 + usize::from(m))
    }

    #[test]
    fn global_rank_converges_sixteen_local_orders_and_counts_split_weights_once() {
        let symmetries = RootSymmetries { maps: vec![std::array::from_fn(|m| m as u8)] };
        let claims = Arc::new(PrefixClaims::new_ranked());
        let mut queues: Vec<_> = (0..16).map(|index| PrefixQueue {
            shard: Some(SearchShard { index, count: 16 }), claims: Some(Arc::clone(&claims)),
            ..PrefixQueue::default()
        }).collect();
        for (depth, count) in [(11, 18), (12, 243), (13, 3240), (14, 43254), (15, 43254)] {
            claims.begin_depth(depth).unwrap();
            for (worker, queue) in queues.iter_mut().enumerate() {
                // Different old orders and incomplete local scores must be
                // superseded by the canonical global scores, including zero.
                if worker % 2 == 0 { queue.jobs.reverse(); }
                for (i, job) in queue.jobs.iter_mut().enumerate() { job.weight = (i + worker * 137) as u64; }
                queue.prepare(depth, 10, &symmetries);
            }
            let order: Vec<_> = queues[0].jobs.iter().map(key).collect();
            assert_eq!(order.len(), count);
            for queue in &queues { assert_eq!(queue.jobs.iter().map(key).collect::<Vec<_>>(), order); }
            let expected: BTreeMap<_, _> = order.iter().map(|&key| {
                let total = if key % 7 == 0 { 0 } else { (key % 1023 + 1 + key % 5) as u64 };
                (key, total)
            }).collect();
            let visits = std::thread::scope(|scope| {
                let handles: Vec<_> = queues.iter_mut().map(|queue| scope.spawn(move || {
                    let mut context = Context::empty();
                    let mut other = Context::empty();
                    let mut stats = SearchStats::default();
                    let mut visited = Vec::new();
                    while queue.fetch_into(Cube::SOLVED, &mut stats, &mut context) {
                        let canonical = key(&queue.jobs[context.job.unwrap()]);
                        context.weight = if canonical % 7 == 0 { 0 } else { (canonical % 1023 + 1) as u64 };
                        context.needs_query = false;
                        assert!(context.split_into(&mut other));
                        assert_eq!(other.weight, 0, "a split must not copy already counted work");
                        other.weight = if canonical % 7 == 0 { 0 } else { (canonical % 5) as u64 };
                        context.stack.clear(); other.stack.clear();
                        queue.finish(&mut context); queue.finish(&mut context);
                        queue.finish(&mut other); queue.finish(&mut other);
                        assert_eq!(context.weight, 0); assert_eq!(other.weight, 0);
                        visited.push(canonical);
                    }
                    visited
                })).collect();
                handles.into_iter().flat_map(|h| h.join().unwrap()).collect::<Vec<_>>()
            });
            claims.complete_depth(depth, true).unwrap();
            let actual: BTreeSet<_> = visits.iter().copied().collect();
            assert_eq!(actual.len(), visits.len(), "each prefix still has one owner");
            assert_eq!(actual, expected.keys().copied().collect());
            let stored = &claims.ranked.as_ref().unwrap().weights[usize::from(depth & 1)];
            for (key, expected) in expected {
                assert_eq!(stored[key].load(Ordering::Relaxed), expected);
            }
        }
    }

    #[test]
    fn global_rank_epochs_preserve_previous_scores_and_reject_incomplete_progress() {
        let claims = PrefixClaims::new_ranked();
        // Starting at a proved shallow lower bound has no previous job scores.
        claims.begin_depth(9).unwrap();
        assert!(claims.previous_weights(9).unwrap().iter().all(|w| w.load(Ordering::Relaxed) == 0));
        claims.record_weight(9, 17, 7);
        assert_eq!(claims.previous_weights(9).unwrap()[17].load(Ordering::Relaxed), 0);
        assert!(claims.begin_depth(10).is_err(), "running work cannot be reused");
        claims.complete_depth(9, true).unwrap();
        assert!(claims.begin_depth(11).is_err(), "depth skips cannot mix prefix lengths");
        claims.begin_depth(10).unwrap();
        assert_eq!(claims.previous_weights(10).unwrap()[17].load(Ordering::Relaxed), 7);
        claims.record_weight(10, 17, 999);
        assert_eq!(claims.previous_weights(10).unwrap()[17].load(Ordering::Relaxed), 7,
            "current-depth writes cannot race previous-depth reads");
        claims.complete_depth(10, true).unwrap();
        claims.begin_depth(11).unwrap();
        assert_eq!(claims.previous_weights(11).unwrap()[17].load(Ordering::Relaxed), 999);
        assert_eq!(claims.ranked.as_ref().unwrap().weights[1][17].load(Ordering::Relaxed), 0,
            "the old same-parity epoch is cleared");
        claims.complete_depth(11, false).unwrap();
        assert!(claims.begin_depth(12).is_err(), "cancelled/found/error work cannot rank a later depth");
        assert!(claims.complete_depth(11, true).is_err());
    }
}
