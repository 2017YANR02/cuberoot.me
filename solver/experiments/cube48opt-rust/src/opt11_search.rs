//! Source-only Opt11 search candidates. No table, executable or result is
//! created by declaring a policy, and no policy relaxes the CLI/guard gate.
//!
//! Keep the original `Opt11Solver` untouched. These borrowed wrappers reuse
//! the shared search engine and its owned-prefix/cancellation semantics. The
//! underlying oracle may be the baseline decoder or an Opt11 lookup candidate;
//! its bounds must retain the `PruningOracle` left-H-invariant contract.
use crate::{cube::Cube, opt11::Opt11Solver, search::PruningOracle};

/// Separate controls for later one-change-at-a-time comparison. There is no
/// default promotion: B0 remains the original solver, with every extra policy
/// disabled. S2 adds only direct backward-coset proofs to S1.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Opt11SearchPolicy {
    #[default]
    Baseline,
    Search,
    Coset,
}

impl Opt11SearchPolicy {
    pub const ALL: [Self; 3] = [Self::Baseline, Self::Search, Self::Coset];

    pub const fn id(self) -> &'static str {
        match self {
            Self::Baseline => "b0",
            Self::Search => "s1-search",
            Self::Coset => "s2-coset",
        }
    }

    /// Fail explicitly when an isolated candidate was not compiled. Merely
    /// selecting a policy must not silently produce baseline timing instead.
    /// This is a build-capability check, not permission to run Opt11.
    pub fn require_compiled(self) -> Result<(), String> {
        match self {
            Self::Baseline => Ok(()),
            Self::Search if cfg!(all(
                feature = "opt11-native-search", not(target_family = "wasm")
            )) => Ok(()),
            Self::Coset if cfg!(all(
                feature = "opt11-native-search", feature = "opt11-native-coset",
                not(target_family = "wasm")
            )) => Ok(()),
            Self::Search => Err("Opt11 S1 requires the opt11-native-search native candidate feature; local execution remains disabled".into()),
            Self::Coset => Err("Opt11 S2 requires the opt11-native-coset native candidate feature; local execution remains disabled".into()),
        }
    }

    #[inline(always)]
    const fn search_enabled(self) -> bool {
        matches!(self, Self::Search | Self::Coset)
    }
}

/// One borrowed table/coordinate owner, with an independently selected search
/// policy. Do not clone the PDB or instantiate an oracle per input/batch.
///
/// Search-control methods intentionally come from this policy, not from the
/// wrapped oracle. Query preparation/decoding, independent distance-only
/// certificates, root symmetries and cancellation are forwarded unchanged.
pub struct Opt11SearchOracle<'a, O = Opt11Solver> {
    oracle: &'a O,
    policy: Opt11SearchPolicy,
}

impl<'a, O: PruningOracle> Opt11SearchOracle<'a, O> {
    pub fn new(oracle: &'a O, policy: Opt11SearchPolicy) -> Result<Self, String> {
        policy.require_compiled()?;
        Ok(Self { oracle, policy })
    }

    pub const fn policy(&self) -> Opt11SearchPolicy { self.policy }
}

impl<O: PruningOracle> PruningOracle for Opt11SearchOracle<'_, O> {
    type Query = O::Query;

    #[inline(always)]
    fn prepare(&self, cube: &Cube, remaining: u8) -> Result<Self::Query, u8> {
        self.oracle.prepare(cube, remaining)
    }

    #[inline(always)]
    fn lookup(&self, query: Self::Query) -> u8 { self.oracle.lookup(query) }

    #[cfg(any(
        feature = "wasm-batch-probes",
        all(any(feature = "opt10-native-batch", feature = "opt11-native-batch"), not(target_family = "wasm"))
    ))]
    #[inline(always)]
    fn lookup_batch(&self, queries: &[Option<Self::Query>; 8]) -> [u8; 8] {
        self.oracle.lookup_batch(queries)
    }

    #[cfg(feature = "corner-research")]
    #[inline(always)]
    fn distance_only_bound(&self, cube: &Cube, remaining: u8) -> Option<u8> {
        self.oracle.distance_only_bound(cube, remaining)
    }

    #[cfg(feature = "corner-research")]
    #[inline(always)]
    fn distance_only_after_primary(&self) -> bool { self.oracle.distance_only_after_primary() }

    #[inline(always)]
    fn max_bound(&self) -> u8 { self.oracle.max_bound() }

    #[inline(always)]
    fn cancelled(&self) -> bool { self.oracle.cancelled() }

    fn conjugate(&self, cube: &Cube, symmetry: u8) -> Option<Cube> {
        self.oracle.conjugate(cube, symmetry)
    }

    /// S1: if a child rejects with excess > 2, each reversed edge loses one
    /// unit of full-state distance proof and adds one unit of parent budget.
    /// The existing search keeps this rejection separate from cached h_H.
    #[inline(always)]
    fn allow_parent_propagation(&self) -> bool { self.policy.search_enabled() }

    /// S1: workers atomically claim disjoint canonical prefixes. Every depth
    /// still has a barrier; no prefix is skipped merely because another
    /// worker has a different ranking or finishes its initial share early.
    #[inline(always)]
    fn allow_dynamic_prefixes(&self) -> bool { self.policy.search_enabled() }

    /// S1: (gF')^-1 = F² (gF)^-1. As F² is in H, an inverse rejection of
    /// one quarter turn also rejects the sibling's same-depth inverse query.
    /// The existing side/ownership checks remain in the shared search body.
    #[inline(always)]
    fn allow_quarter_pruning(&self) -> bool { self.policy.search_enabled() }

    /// S1: max(h_H(g), h_H(g^-1)) is a full-solution lower bound. The native
    /// coordinator and checked worker constructor retain their actual probes,
    /// cancellation checks and separate verification of the skipped depths.
    #[inline(always)]
    fn allow_root_bound(&self) -> bool { self.policy.search_enabled() }

    /// S2 only: direct normal-child h_H(gM) proves d_H(g)>=h_H(gM)-1.
    /// At child excess two that equals the parent's remaining budget, so an
    /// opposite-side half turn cannot be the parent's next useful move. The
    /// existing engine applies this certificate before generic propagation,
    /// to this context's pending inverse mask only; it never rewrites h_H.
    #[inline(always)]
    fn allow_backward_coset(&self) -> bool { self.policy == Opt11SearchPolicy::Coset }

    // Quarter-bound caching, dual probes, coset chains, lookahead, alternate
    // projections, global rankings and NISS tie changes remain at trait
    // defaults. They are not bundled into S1/S2 without their own comparison.
}
