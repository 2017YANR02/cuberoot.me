#![cfg_attr(target_arch = "wasm64", feature(simd_wasm64))]

pub mod batch;
pub mod coord;
pub mod cube;
pub mod h10_coord;
pub mod h10_table;
pub mod h48_coord;
pub mod h48_table;
pub mod h48_variant;
pub mod search;
pub mod table;
pub mod opt10;
pub mod opt10_table;
pub mod opt10_generate;

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
        if self.pruning.variant().number() == 9 {
            search::solve(cube, &Opt9Oracle(self), options)
        } else {
            search::solve(cube, self, options)
        }
    }

    /// Exposes the same optimized path to the small coordinate differential
    /// checks; no search or input/solution convention is changed.
    pub fn query_specialized(&self, cube: &cube::Cube) -> (u64, u8) {
        if self.pruning.variant().number() == 9 {
            let index = self.coordinates.index9(cube);
            (index, self.pruning.get_opt9(index))
        } else {
            let index = self.coordinates.index64(cube);
            (index, self.pruning.get(index))
        }
    }
}

/// This private type cannot be constructed with a different variant by an
/// external caller. It changes neither admissibility nor lookup ordering.
struct Opt9Oracle<'a>(&'a OptSolver);

impl search::PruningOracle for Opt9Oracle<'_> {
    type Query = u64;

    #[inline(always)]
    fn prepare(&self, cube: &cube::Cube, _: u8) -> Result<u64, u8> {
        Ok(self.0.coordinates.index9(cube))
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
        cfg!(all(target_family = "wasm", target_feature = "simd128"))
    }
}

impl search::PruningOracle for OptSolver {
    type Query = u64;
    #[inline(always)]
    fn prepare(&self, cube: &cube::Cube, _: u8) -> Result<u64, u8> {
        Ok(self.coordinates.index64(cube))
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
