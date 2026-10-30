//! Source-only Opt11 generation candidates. No local execution is enabled.
//!
//! Both adapters retain the shared exact-BFS/suffix enumeration. G1 removes
//! duplicate writes within one state's stabilizer aliases. G2 additionally
//! keeps those aliases in the generated state so a key and its writes share
//! one canonicalization. Neither uses PDB values as a visited set.
use crate::{
    opt10_generate::{
        generate_resumable, CheckpointWriter, CoordinateSpace, GenerationConfig,
        GenerationProgress, GenerationResume, GenerationSink, GenerationSummary,
    },
    opt11::Opt11Coordinates,
};

const MAX_ALIASES: usize = 48;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Opt11GenerationCandidate {
    /// Keep the baseline state and key path; suppress only repeated writes.
    UniqueAliases,
    /// Materialize all unique full aliases together with their minimum key.
    PreparedAliases,
}

impl Opt11GenerationCandidate {
    pub const fn id(self) -> &'static str {
        match self {
            Self::UniqueAliases => "opt11-g1-unique-aliases-v1",
            Self::PreparedAliases => "opt11-g2-prepared-aliases-v1",
        }
    }

    /// The orchestration layer must use this tag for checkpoint state and
    /// reject a different candidate even though the final PDB format agrees.
    pub const fn checkpoint_magic(self) -> &'static [u8; 16] {
        match self {
            Self::UniqueAliases => b"CBRT-E11-G1-01\0\0",
            Self::PreparedAliases => b"CBRT-E11-G2-01\0\0",
        }
    }
}

/// A bounded, per-state set. First-occurrence order is retained; removing
/// repeated minima never changes the packed table's eventual lower bound.
/// There are at most 48 corner stabilizers, hence at most 48 full aliases.
#[derive(Clone, Copy)]
struct Aliases {
    values: [u64; MAX_ALIASES],
    len: usize,
    minimum: u64,
}

impl Aliases {
    fn new() -> Self {
        Self { values: [0; MAX_ALIASES], len: 0, minimum: u64::MAX }
    }

    fn insert(&mut self, index: u64) -> bool {
        if self.values[..self.len].contains(&index) {
            return false;
        }
        // Never silently drop an image if the coordinate contract changes.
        assert!(self.len < MAX_ALIASES, "Opt11 stabilizer alias bound exceeded");
        self.values[self.len] = index;
        self.len += 1;
        self.minimum = self.minimum.min(index);
        true
    }

    fn visit(&self, visit: &mut dyn FnMut(u64)) {
        for &index in &self.values[..self.len] {
            visit(index);
        }
    }
}

/// G1 is valid for any space with at most 48 projected aliases. It forwards
/// the original full key and include predicate, including a rejected key's
/// zero-callback behavior. Only exactly equal indices are deduplicated.
struct UniqueAliasSpace<'a, S: CoordinateSpace>(&'a S);

impl<S: CoordinateSpace> CoordinateSpace for UniqueAliasSpace<'_, S> {
    type State = S::State;
    fn solved(&self) -> Self::State { self.0.solved() }
    fn full_key(&self, state: &Self::State) -> u64 { self.0.full_key(state) }
    fn representative(&self, key: u64) -> Result<Self::State, String> { self.0.representative(key) }
    fn moved(&self, state: &Self::State, movement: u8) -> Self::State {
        self.0.moved(state, movement)
    }
    fn mark_projected(&self, state: &Self::State, visit: &mut dyn FnMut(u64)) {
        let mut seen = Aliases::new();
        self.0.mark_projected(state, &mut |index| {
            if seen.insert(index) { visit(index); }
        });
    }
    fn project_if_key(
        &self,
        state: &Self::State,
        include: impl FnOnce(u64) -> bool,
        visit: &mut dyn FnMut(u64),
    ) -> bool {
        let mut seen = Aliases::new();
        self.0.project_if_key(state, include, &mut |index| {
            if seen.insert(index) { visit(index); }
        })
    }
    fn cells(&self) -> u64 { self.0.cells() }
    fn move_count(&self) -> u8 { self.0.move_count() }
    fn allow_move(&self, previous: Option<u8>, next: u8) -> bool {
        self.0.allow_move(previous, next)
    }
}

/// Additional proof obligation for G2: `mark_projected` emits the complete
/// full-coordinate aliases and their minimum is exactly `full_key`.
/// Do NOT implement this for EO10: its projected aliases discard one EO bit.
/// This private marker prevents another backend accidentally opting in.
trait FullAliasSpace: CoordinateSpace {}
impl FullAliasSpace for Opt11Coordinates {}

#[derive(Clone, Copy)]
struct PreparedState<S: Copy> {
    original: S,
    aliases: Aliases,
}

struct PreparedAliasSpace<'a, S: FullAliasSpace>(&'a S);

impl<S: FullAliasSpace> PreparedAliasSpace<'_, S> {
    fn prepare(&self, original: S::State) -> PreparedState<S::State> {
        let mut aliases = Aliases::new();
        self.0.mark_projected(&original, &mut |index| { aliases.insert(index); });
        PreparedState { original, aliases }
    }
}

impl<S: FullAliasSpace> CoordinateSpace for PreparedAliasSpace<'_, S> {
    type State = PreparedState<S::State>;
    fn solved(&self) -> Self::State { self.prepare(self.0.solved()) }
    fn full_key(&self, state: &Self::State) -> u64 { state.aliases.minimum }
    fn representative(&self, key: u64) -> Result<Self::State, String> {
        self.0.representative(key).map(|state| self.prepare(state))
    }
    fn moved(&self, state: &Self::State, movement: u8) -> Self::State {
        self.prepare(self.0.moved(&state.original, movement))
    }
    fn mark_projected(&self, state: &Self::State, visit: &mut dyn FnMut(u64)) {
        state.aliases.visit(visit);
    }
    fn project_if_key(
        &self,
        state: &Self::State,
        include: impl FnOnce(u64) -> bool,
        visit: &mut dyn FnMut(u64),
    ) -> bool {
        if !include(state.aliases.minimum) { return false; }
        state.aliases.visit(visit);
        true
    }
    fn cells(&self) -> u64 { self.0.cells() }
    fn move_count(&self) -> u8 { self.0.move_count() }
    fn allow_move(&self, previous: Option<u8>, next: u8) -> bool {
        self.0.allow_move(previous, next)
    }
}

/// Future runner adapter only. The existing CLI/guard continues to reject
/// Opt11. The caller owns a single resident sink and candidate-bound journal;
/// this function does not load files, publish results, or restart on failure.
pub fn generate_candidate_resumable<T: GenerationSink>(
    candidate: Opt11GenerationCandidate,
    coordinates: &Opt11Coordinates,
    table: &T,
    config: GenerationConfig,
    resume: Option<GenerationResume>,
    checkpoint: Option<&CheckpointWriter<'_>>,
    progress: impl Fn(GenerationProgress) + Sync,
) -> Result<GenerationSummary, String> {
    match candidate {
        Opt11GenerationCandidate::UniqueAliases => generate_resumable(
            &UniqueAliasSpace(coordinates), table, config, resume, checkpoint, progress,
        ),
        Opt11GenerationCandidate::PreparedAliases => generate_resumable(
            &PreparedAliasSpace(coordinates), table, config, resume, checkpoint, progress,
        ),
    }
}

// Source-only fixtures: written for later authorization, not executed here.
#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU8, AtomicUsize, Ordering};

    struct FullCycle { alias_passes: AtomicUsize }
    impl FullCycle {
        fn new() -> Self { Self { alias_passes: AtomicUsize::new(0) } }
    }
    impl CoordinateSpace for FullCycle {
        type State = u64;
        fn solved(&self) -> u64 { 0 }
        fn full_key(&self, state: &u64) -> u64 {
            let mut key = u64::MAX;
            self.mark_projected(state, &mut |index| { key = key.min(index); });
            key
        }
        fn representative(&self, key: u64) -> Result<u64, String> {
            if key < 200 && key & 1 == 0 { Ok(key / 2) }
            else { Err("invalid full cycle key".into()) }
        }
        fn moved(&self, state: &u64, movement: u8) -> u64 {
            if movement == 0 { (state + 1) % 100 } else { (state + 99) % 100 }
        }
        fn mark_projected(&self, state: &u64, visit: &mut dyn FnMut(u64)) {
            self.alias_passes.fetch_add(1, Ordering::Relaxed);
            for offset in [0, 0, 1, 0, 1] { visit(state * 2 + offset); }
        }
        fn cells(&self) -> u64 { 200 }
        fn move_count(&self) -> u8 { 2 }
    }
    impl FullAliasSpace for FullCycle {}

    struct ExactSink(Vec<AtomicU8>);
    impl ExactSink {
        fn new() -> Self { Self((0..200).map(|_| AtomicU8::new(13)).collect()) }
        fn values(&self) -> Vec<u8> { self.0.iter().map(|v| v.load(Ordering::Relaxed)).collect() }
    }
    impl GenerationSink for ExactSink {
        fn cells(&self) -> u64 { self.0.len() as u64 }
        fn record_min(&self, index: u64, depth: u8) -> Result<bool, String> {
            let cell = self.0.get(index as usize).ok_or("fixture index out of range")?;
            Ok(cell.fetch_min(depth, Ordering::Relaxed) > depth)
        }
    }

    #[test]
    fn duplicate_removal_keeps_all_distinct_images_and_rejected_keys_emit_nothing() {
        let raw = FullCycle::new();
        let unique = UniqueAliasSpace(&raw);
        let mut images = Vec::new();
        unique.mark_projected(&7, &mut |index| images.push(index));
        assert_eq!(images, vec![14, 15]);
        assert_eq!(unique.full_key(&7), 14);
        images.clear();
        assert!(!unique.project_if_key(&7, |_| false, &mut |index| images.push(index)));
        assert!(images.is_empty());
    }

    #[test]
    fn prepared_key_and_images_share_one_full_coordinate_pass() {
        let raw = FullCycle::new();
        let prepared = PreparedAliasSpace(&raw);
        let state = prepared.representative(14).unwrap();
        let mut images = Vec::new();
        assert_eq!(prepared.full_key(&state), 14);
        prepared.mark_projected(&state, &mut |index| images.push(index));
        assert_eq!(images, vec![14, 15]);
        assert_eq!(raw.alias_passes.load(Ordering::Relaxed), 1);
        assert!(!prepared.project_if_key(&state, |_| false, &mut |_| panic!("rejected image")));
        assert_eq!(raw.alias_passes.load(Ordering::Relaxed), 1);
    }

    #[test]
    fn both_adapters_preserve_complete_generation_and_exact_keys() {
        let raw = FullCycle::new();
        let config = GenerationConfig {
            threads: 1, short_depth: 3, max_depth: 12,
            short_capacity: 32, max_short_states: 16,
        };
        let baseline = ExactSink::new();
        let unique = ExactSink::new();
        let prepared = ExactSink::new();
        let b = generate_resumable(&raw, &baseline, config, None, None, |_| {}).unwrap();
        let g1 = generate_resumable(&UniqueAliasSpace(&raw), &unique, config, None, None, |_| {}).unwrap();
        let g2 = generate_resumable(&PreparedAliasSpace(&raw), &prepared, config, None, None, |_| {}).unwrap();
        assert_eq!(unique.values(), baseline.values());
        assert_eq!(prepared.values(), baseline.values());
        assert_eq!((g1.short_states, g1.final_layer_states, g1.expanded), (b.short_states, b.final_layer_states, b.expanded));
        assert_eq!((g2.short_states, g2.final_layer_states, g2.expanded), (b.short_states, b.final_layer_states, b.expanded));
        for state in 0_u64..100 {
            let expected = state.min(100 - state).min(13) as u8;
            assert_eq!(baseline.0[(state * 2) as usize].load(Ordering::Relaxed), expected);
            assert_eq!(baseline.0[(state * 2 + 1) as usize].load(Ordering::Relaxed), expected);
        }
    }
}
