#![cfg_attr(target_arch = "wasm64", feature(simd_wasm64))]

pub mod batch;
pub mod coord;
pub mod cube;
#[cfg(feature = "corner-research")]
pub mod corner_coset;
#[cfg(feature = "corner-research")]
pub mod corner_symmetry;
#[cfg(feature = "corner-research")]
pub mod corner_oracle;
#[cfg(feature = "corner-research")]
pub mod corner_distance_search;
#[cfg(feature = "corner-research")]
pub mod corner_joint;
pub mod h10_coord;
pub mod h10_table;
pub mod h48_coord;
pub mod h48_table;
pub mod h48_variant;
pub mod search;
pub mod table;
#[cfg(target_arch = "x86_64")]
pub mod x86_simd;
pub mod opt10;
pub mod opt11;
pub mod opt11_generate;
#[cfg(all(feature = "opt11-native-search", not(target_family = "wasm")))]
pub mod opt11_search;
#[cfg(all(feature = "opt11-lookup", not(target_family = "wasm")))]
pub mod opt11_lookup;
#[cfg(feature = "opt11-generation-candidates")]
pub mod opt11_generate_candidate;
pub mod eo_table;
pub mod opt10_table;
pub mod opt10_generate;
#[cfg(all(target_arch = "x86_64", any(
    feature = "opt1-7-native-prefetch",
    feature = "opt9-native-prefetch",
    feature = "opt10-native-prefetch-x86",
    feature = "opt11-lookup",
)))]
mod prefetch;

pub use h48_coord::H48State;
pub use h48_table::H48Table;
pub use h48_variant::H48Variant;

pub struct OptSolver {
    coordinates: coord::CoordTables,
    pruning: table::PruningTable,
}

impl OptSolver {
    pub fn new(
        coordinates: coord::CoordTables,
        pruning: table::PruningTable,
    ) -> Result<Self, String> {
        if coordinates.variant() != pruning.variant().number() {
            return Err("coordinate and pruning variants differ".into());
        }
        Ok(Self {
            coordinates,
            pruning,
        })
    }

    /// One dispatch per request; the generic oracle remains the baseline.
    /// OptSolver::new and both table constructors already enforce matching,
    /// validated layouts. Other variants retain their existing search path.
    pub fn solve_specialized(
        &self,
        cube: cube::Cube,
        options: search::SearchOptions,
    ) -> Result<search::SearchOutcome, String> {
        #[cfg(all(feature = "opt8-native-specialized", not(target_family = "wasm")))]
        if self.pruning.variant().number() == 8 {
            return search::solve(cube, &Opt8Oracle(self), options);
        }
        if self.pruning.variant().number() == 9 {
            search::solve(cube, &Opt9Oracle::new(self), options)
        } else {
            search::solve(cube, self, options)
        }
    }

    /// One native Opt8 dispatch; construction of this private oracle is
    /// impossible for a mismatched coordinate/table variant.
    #[cfg(all(feature = "opt8-native-specialized", not(target_family = "wasm")))]
    pub fn experimental_native_opt8_oracle(
        &self,
    ) -> Option<impl search::PruningOracle<Query = u64> + Sync + '_> {
        (self.pruning.variant().number() == 8).then_some(Opt8Oracle(self))
    }

    /// Borrow the validated Opt9 layout for the opt-in native experiment.
    /// The concrete oracle stays private, so callers cannot construct it for
    /// another variant or outlive the immutable table owner. Returning the
    /// concrete opaque type also allows parallel search to specialize its hot
    /// coordinate and decoder paths without dynamic dispatch.
    #[cfg(all(
        any(feature = "opt9-native-bpmx", feature = "opt9-native-dynamic", feature = "opt9-native-prefetch", feature = "opt9-native-quarter", feature = "opt9-native-root-bound"),
        not(target_family = "wasm"),
    ))]
    pub fn experimental_native_opt9_oracle(
        &self,
    ) -> Option<impl search::PruningOracle<Query = u64> + Sync + '_> {
        (self.pruning.variant().number() == 9).then(|| Opt9Oracle::new(self))
    }

    /// Exposes the same optimized path to the small coordinate differential
    /// checks; no search or input/solution convention is changed.
    pub fn query_specialized(&self, cube: &cube::Cube) -> (u64, u8) {
        #[cfg(all(feature = "opt8-native-specialized", not(target_family = "wasm")))]
        if self.pruning.variant().number() == 8 {
            let index = self.coordinates.index8(cube);
            return (index, self.pruning.get_opt8(index));
        }
        if self.pruning.variant().number() == 9 {
            let index = self.coordinates.index9(cube);
            (index, self.pruning.get_opt9(index))
        } else {
            let index = self.coordinates.index64(cube);
            (index, self.pruning.get(index))
        }
    }
}

/// Native Opt8 candidates are explicit opt-ins. Lookup specialization alone
/// keeps the preserved quarter-only policy; the separate search feature adds
/// parent propagation, dynamic prefix ownership, and a proven root bound.
#[cfg(all(feature = "opt8-native-specialized", not(target_family = "wasm")))]
struct Opt8Oracle<'a>(&'a OptSolver);

#[cfg(all(feature = "opt8-native-specialized", not(target_family = "wasm")))]
impl search::PruningOracle for Opt8Oracle<'_> {
    type Query = u64;
    #[inline(always)]
    fn prepare(&self, cube: &cube::Cube, _: u8) -> Result<u64, u8> {
        let index = self.0.coordinates.index8(cube);
        #[cfg(feature = "opt8-native-prefetch")]
        self.0.pruning.prefetch_opt8(index);
        Ok(index)
    }
    #[inline(always)]
    fn lookup(&self, index: u64) -> u8 { self.0.pruning.get_opt8(index) }
    #[cfg(feature = "opt8-native-batch")]
    #[inline(always)]
    fn lookup_batch(&self, queries: &[Option<u64>; 8]) -> [u8; 8] {
        self.0.pruning.get_opt8_batch(queries)
    }
    fn conjugate(&self, cube: &cube::Cube, symmetry: u8) -> Option<cube::Cube> {
        Some(self.0.coordinates.conjugate(cube, symmetry))
    }
    #[inline(always)]
    fn max_bound(&self) -> u8 { 13 }
    #[inline(always)]
    fn allow_quarter_pruning(&self) -> bool { cfg!(feature = "opt8-native-quarter") }
    #[inline(always)]
    fn allow_parent_propagation(&self) -> bool { cfg!(feature = "opt8-native-search") }
    #[inline(always)]
    fn allow_dynamic_prefixes(&self) -> bool { cfg!(feature = "opt8-native-search") }
    #[inline(always)]
    fn allow_root_bound(&self) -> bool { cfg!(feature = "opt8-native-search") }
}

/// This private type cannot be constructed with a different variant by an
/// external caller. It changes neither admissibility nor lookup ordering.
struct Opt9Oracle<'a>(
    &'a OptSolver,
    #[cfg(all(feature = "opt9-native-ternary", target_arch = "aarch64"))]
    coord::Opt9TernaryRanks,
);

impl<'a> Opt9Oracle<'a> {
    fn new(solver: &'a OptSolver) -> Self {
        Self(solver,
            #[cfg(all(feature = "opt9-native-ternary", target_arch = "aarch64"))]
            solver.coordinates.opt9_ternary_ranks(),
        )
    }
}

impl search::PruningOracle for Opt9Oracle<'_> {
    type Query = u64;

    #[inline(always)]
    fn prepare(&self, cube: &cube::Cube, _: u8) -> Result<u64, u8> {
        #[cfg(all(feature = "opt9-native-ternary", target_arch = "aarch64"))]
        let index = self.0.coordinates.index9_ternary(cube, &self.1);
        #[cfg(not(all(feature = "opt9-native-ternary", target_arch = "aarch64")))]
        let index = self.0.coordinates.index9(cube);
        #[cfg(all(feature = "opt9-native-prefetch", not(target_family = "wasm")))]
        self.0.pruning.prefetch_opt9(index);
        Ok(index)
    }

    #[inline(always)]
    fn lookup(&self, index: u64) -> u8 {
        self.0.pruning.get_opt9(index)
    }

    fn conjugate(&self, cube: &cube::Cube, symmetry: u8) -> Option<cube::Cube> {
        Some(self.0.coordinates.conjugate(cube, symmetry))
    }

    #[inline(always)]
    fn max_bound(&self) -> u8 { 13 }

    #[inline(always)]
    fn allow_parent_propagation(&self) -> bool {
        cfg!(any(
            all(target_family = "wasm", target_feature = "simd128"),
            all(feature = "opt9-native-bpmx", not(target_family = "wasm")),
        ))
    }

    #[inline(always)]
    fn allow_dynamic_prefixes(&self) -> bool {
        cfg!(all(feature = "opt9-native-dynamic", not(target_family = "wasm")))
    }

    #[inline(always)]
    fn allow_quarter_pruning(&self) -> bool {
        cfg!(all(feature = "opt9-native-quarter", not(target_family = "wasm")))
    }

    #[inline(always)]
    fn allow_quarter_cache(&self) -> bool {
        cfg!(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))
    }

    #[inline(always)]
    fn allow_root_bound(&self) -> bool {
        cfg!(all(feature = "opt9-native-root-bound", not(target_family = "wasm")))
    }

    #[inline(always)]
    fn allow_niss_inverse_tie(&self) -> bool {
        cfg!(all(feature = "opt9-native-niss", not(target_family = "wasm")))
    }

    #[inline(always)]
    fn allow_global_prefix_ranking(&self) -> bool {
        cfg!(all(feature = "opt9-native-ranked", not(target_family = "wasm")))
    }

    #[inline(always)]
    fn allow_axis_pruning(&self) -> bool {
        cfg!(all(feature = "opt9-native-axis", not(target_family = "wasm")))
    }
}

impl search::PruningOracle for OptSolver {
    fn allow_quarter_pruning(&self) -> bool {
        cfg!(all(feature = "opt8-native-quarter", not(target_family = "wasm")))
            && self.pruning.variant().number() == 8
    }

    type Query = u64;
    #[inline(always)]
    fn prepare(&self, cube: &cube::Cube, _: u8) -> Result<u64, u8> {
        let index = self.coordinates.index64(cube);
        #[cfg(all(feature = "opt1-7-native-prefetch", not(target_family = "wasm")))]
        self.pruning.prefetch_opt1_to_7(index);
        Ok(index)
    }
    #[inline(always)]
    fn lookup(&self, index: u64) -> u8 {
        self.pruning.get(index)
    }
    fn conjugate(&self, cube: &cube::Cube, symmetry: u8) -> Option<cube::Cube> {
        Some(self.coordinates.conjugate(cube, symmetry))
    }
    fn max_bound(&self) -> u8 {
        self.pruning.variant().max_bound()
    }
}

/// Native H48 decoding on the same immutable table format used by nissy-core.
/// Only the table mapping uses operating-system FFI; search and coordinates
/// are Rust. The table is never copied into a second allocation.
pub struct H48Solver {
    pruning: H48Table,
}

#[derive(Clone, Copy)]
pub struct H48Query {
    state: H48State,
    pub index: u64,
    pub corner_bound: u8,
}

impl H48Solver {
    pub fn new(pruning: impl Into<H48Table>) -> Self {
        Self {
            pruning: pruning.into(),
        }
    }

    pub fn variant(&self) -> H48Variant {
        self.pruning.variant()
    }

    #[inline(always)]
    fn prepare_state(&self, cube: &cube::Cube, remaining: u8) -> Result<H48Query, u8> {
        let state = H48State::from_cube(cube);
        let data = self.pruning.cocsep_entry(state.raw_cocsep());
        let corner_bound = data as u8;
        if corner_bound > remaining {
            return Err(corner_bound);
        }
        let index = state.main_index(data, self.pruning.variant());
        self.pruning.prefetch_main(index);
        Ok(H48Query {
            state,
            index,
            corner_bound,
        })
    }

    /// Unconditionally decode the complete bound for differential validation.
    pub fn query(&self, cube: &cube::Cube) -> (u64, u8, u8) {
        let query = self.prepare_state(cube, u8::MAX).unwrap();
        (query.index, query.corner_bound, self.decode(query))
    }

    #[inline(always)]
    fn decode(&self, query: H48Query) -> u8 {
        let main = self.pruning.lookup_main(query.index);
        let bound = if main.code != 0 {
            self.pruning.base() + main.code
        } else {
            let data = self.pruning.esep_entry(query.state.raw_esep());
            main.line_min
                .max(self.pruning.eoesep_bound(query.state.eoesep_index(data)))
        };
        bound.max(query.corner_bound)
    }
}

impl search::PruningOracle for H48Solver {
    type Query = H48Query;
    #[inline(always)]
    fn prepare(&self, cube: &cube::Cube, remaining: u8) -> Result<Self::Query, u8> {
        self.prepare_state(cube, remaining)
    }
    #[inline(always)]
    fn lookup(&self, query: Self::Query) -> u8 {
        self.decode(query)
    }
    fn max_bound(&self) -> u8 {
        self.pruning.max_bound()
    }
}

/// Historical names remain source-compatible; H10Table fixes the variant.
pub type H10Solver = H48Solver;
pub type H10Query = H48Query;
