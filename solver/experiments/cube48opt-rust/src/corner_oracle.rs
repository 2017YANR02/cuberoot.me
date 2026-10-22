//! Certificates for the corner experiments. A distance-only value is kept
//! separate from the left-H-invariant functions required by search.rs.

pub mod eo;

use crate::corner_coset::{self, CornerPdb};
use crate::corner_symmetry::{CornerSymmetries, DoubleClasses, FullCornerPdb};
use crate::corner_symmetry::dense::{DenseCornerPdb, PreparedCornerPdb};
use crate::cube::{Cube, MOVES};
use crate::search::PruningOracle;

/// Only certifies value <= the full-cube HTM distance. This type deliberately
/// has no PruningOracle implementation and no opposite-half-turn reuse API.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct DistanceBound(u8);

impl DistanceBound {
    pub fn get(self) -> u8 { self.0 }
}

/// A pointwise certificate for both one-sided H distances. Unlike v, the
/// function w=min(u(g),u(g^-1)) need not be H-invariant: after a left half
/// turn only its left certificate survives. Do not cache it as an H function.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PointwiseBothBound(u8);

impl PointwiseBothBound {
    pub fn get(self) -> u8 { self.0 }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CornerBounds {
    /// <= min_{a in H} D(a*g); its defining function is left-H-invariant.
    pub left: u8,
    /// <= min_{a in H} D(a*g^-1); invariant under right H on g.
    pub right: u8,
    /// max(left,right): 96-invariant, but not an H-invariant function.
    pub distance: DistanceBound,
    /// min(left,right): two pointwise certificates, not an H function.
    pub pointwise_both: PointwiseBothBound,
}

fn same_side(pdb: &CornerPdb, cube: &Cube, maximum: u8) -> u8 {
    pdb.lookup(cube).max(corner_coset::lower_bound5(cube)).min(maximum)
}

/// The input must be a legal Cube. Clipping to 13 matches the existing NISS
/// interface; it does not assert that 13 is the corner-coset diameter.
pub fn bounds(pdb: &CornerPdb, cube: &Cube) -> CornerBounds {
    let left = same_side(pdb, cube, 13);
    let right = same_side(pdb, &cube.inverse(), 13);
    CornerBounds {
        left, right,
        distance: DistanceBound(left.max(right)),
        pointwise_both: PointwiseBothBound(left.min(right)),
    }
}

/// A one-step coupling of the corner H quotient and complete EO quotient.
/// The input must be a legal Cube; both tables must come from their certified
/// constructors. Returns a left-H-invariant subgroup lower bound, not a
/// distance-only value. It is not automatically enabled by a search wrapper.
///
/// If b(g)=max(u(g),EO(g)) is positive, g is outside H. Every shortest word
/// reaching H has a first move, hence 1+min_m b(g*m) <= d_H(g). All 18 moves
/// must participate; a path-restricted move mask cannot replace this minimum.
/// `saturating_add` only caps the returned admissible bound if u8 would overflow.
/// See corner96-bounds.md: the corner-U/edge-R witness has b=1 and result=3
/// for exact (or sufficiently uncapped) input tables. No run is asserted here.
pub fn coupled_one_step_h_bound(pdb: &CornerPdb, eo: &eo::EoPdb, cube: &Cube) -> u8 {
    let bound = |state: &Cube| pdb.lookup(state).max(eo.lower_bound(state));
    let base = bound(cube);
    if base == 0 { return 0; }
    let mut smallest = u8::MAX;
    for movement in &MOVES {
        smallest = smallest.min(bound(&cube.multiplied(movement)));
        if smallest.saturating_add(1) <= base { return base; }
    }
    base.max(smallest.saturating_add(1))
}

/// Uses the existing two-sided/NISS search without loading an Opt8/Opt9 table.
/// It may be weak on edge-only states; this is a correctness experiment.
pub struct CornerOracle<'a> {
    pdb: &'a CornerPdb,
    edge_orientation: Option<&'a eo::EoPdb>,
}

impl<'a> CornerOracle<'a> {
    pub fn new(pdb: &'a CornerPdb) -> Self { Self { pdb, edge_orientation: None } }

    /// Adds the full 11-bit EO quotient on the same side. EO(h*g)=EO(g) for
    /// h in H, so this additional value has the original subgroup contract.
    pub fn new_with_eo(pdb: &'a CornerPdb, edge_orientation: &'a eo::EoPdb) -> Self {
        Self { pdb, edge_orientation: Some(edge_orientation) }
    }
}

impl PruningOracle for CornerOracle<'_> {
    type Query = u8;
    fn prepare(&self, cube: &Cube, remaining: u8) -> Result<u8, u8> {
        let value = same_side(self.pdb, cube, self.max_bound())
            .max(self.edge_orientation.map_or(0, |pdb| pdb.lower_bound(cube)).min(self.max_bound()));
        if value > remaining { Err(value) } else { Ok(value) }
    }
    fn lookup(&self, value: u8) -> u8 { value }
    fn max_bound(&self) -> u8 { 13 }
}

/// Strengthens the SAME side only. In particular, neither u(g^-1), w, nor
/// d_C(g) is merged into this oracle's left-H-invariant result.
pub struct StrengthenedOracle<'a, O, const DEFER: bool = false> {
    inner: &'a O,
    corner: &'a CornerPdb,
    edge_orientation: Option<&'a eo::EoPdb>,
}

#[derive(Clone, Copy)]
pub struct StrengthenedQuery<Q: Copy> {
    inner: Q,
    corner: CornerQuery,
}

#[derive(Clone, Copy)]
enum CornerQuery { Value(u8), State(Cube) }

impl<'a, O: PruningOracle> StrengthenedOracle<'a, O> {
    pub fn new(inner: &'a O, corner: &'a CornerPdb) -> Result<Self, String> {
        if !(10..=13).contains(&inner.max_bound()) {
            return Err("the existing search requires max_bound in 10..=13".into());
        }
        Ok(Self { inner, corner, edge_orientation: None })
    }

    pub fn new_with_eo(inner: &'a O, corner: &'a CornerPdb,
        edge_orientation: &'a eo::EoPdb) -> Result<Self, String> {
        let mut oracle = Self::new(inner, corner)?;
        oracle.edge_orientation = Some(edge_orientation);
        Ok(oracle)
    }

    /// Preserve the pure max bound, but compute the small coordinate only if
    /// the primary table value is below the auxiliary table's certified cap.
    pub fn deferred(inner: &'a O, corner: &'a CornerPdb,
        edge_orientation: Option<&'a eo::EoPdb>) -> Result<StrengthenedOracle<'a, O, true>, String> {
        Self::new(inner, corner)?;
        Ok(StrengthenedOracle { inner, corner, edge_orientation })
    }
}

impl<O: PruningOracle, const DEFER: bool> StrengthenedOracle<'_, O, DEFER> {
    fn finish(&self, primary: u8, query: CornerQuery) -> u8 {
        let corner = match query {
            CornerQuery::Value(value) => value,
            CornerQuery::State(cube) => {
                let maximum = self.corner.certificate().maximum.max(5)
                    .max(self.edge_orientation.map_or(0, |eo| eo.maximum())).min(self.inner.max_bound());
                if primary >= maximum { return primary; }
                same_side(self.corner, &cube, self.inner.max_bound())
                    .max(self.edge_orientation.map_or(0, |eo| eo.lower_bound(&cube)).min(self.inner.max_bound()))
            }
        };
        primary.max(corner)
    }
}

impl<O: PruningOracle, const DEFER: bool> PruningOracle for StrengthenedOracle<'_, O, DEFER> {
    type Query = StrengthenedQuery<O::Query>;

    fn prepare(&self, cube: &Cube, remaining: u8) -> Result<Self::Query, u8> {
        if DEFER {
            return self.inner.prepare(cube, remaining)
                .map(|inner| StrengthenedQuery { inner, corner: CornerQuery::State(*cube) });
        }
        let corner = same_side(self.corner, cube, self.max_bound())
            .max(self.edge_orientation.map_or(0, |pdb| pdb.lower_bound(cube)).min(self.max_bound()));
        if corner > remaining { return Err(corner); }
        self.inner.prepare(cube, remaining)
            .map(|inner| StrengthenedQuery { inner, corner: CornerQuery::Value(corner) })
            .map_err(|inner| inner.max(corner))
    }

    fn lookup(&self, query: Self::Query) -> u8 {
        self.finish(self.inner.lookup(query.inner), query.corner)
    }

    #[cfg(any(feature = "wasm-batch-probes", all(feature = "opt10-native-batch", not(target_family = "wasm"))))]
    fn lookup_batch(&self, queries: &[Option<Self::Query>; 8]) -> [u8; 8] {
        let inner = std::array::from_fn(|i| queries[i].map(|q| q.inner));
        let result = self.inner.lookup_batch(&inner);
        std::array::from_fn(|i| queries[i].map_or(0, |q| self.finish(result[i], q.corner)))
    }

    fn cancelled(&self) -> bool { self.inner.cancelled() }
    fn distance_only_bound(&self, cube: &Cube, remaining: u8) -> Option<u8> {
        self.inner.distance_only_bound(cube, remaining)
    }
    fn distance_only_after_primary(&self) -> bool { self.inner.distance_only_after_primary() }
    fn max_bound(&self) -> u8 { self.inner.max_bound() }
    fn allow_parent_propagation(&self) -> bool { self.inner.allow_parent_propagation() }
    fn allow_dynamic_prefixes(&self) -> bool { self.inner.allow_dynamic_prefixes() }
    fn allow_quarter_pruning(&self) -> bool { self.inner.allow_quarter_pruning() }
    fn allow_quarter_cache(&self) -> bool { self.inner.allow_quarter_cache() }
    fn allow_root_bound(&self) -> bool { self.inner.allow_root_bound() }
    fn allow_dual_rejection(&self) -> bool { self.inner.allow_dual_rejection() }
    fn allow_backward_coset(&self) -> bool { self.inner.allow_backward_coset() }
    fn allow_coset_chain(&self) -> bool { self.inner.allow_coset_chain() }
    fn profile_search(&self) -> bool { self.inner.profile_search() }
    fn allow_niss_inverse_tie(&self) -> bool { self.inner.allow_niss_inverse_tie() }
    fn allow_axis_pruning(&self) -> bool { self.inner.allow_axis_pruning() }
    fn allow_global_prefix_ranking(&self) -> bool { self.inner.allow_global_prefix_ranking() }

    fn lookahead_move(&self, cube: &Cube, remaining: u8, normal_bound: u8) -> Option<u8> {
        self.inner.lookahead_move(cube, remaining, normal_bound)
    }

    fn alternative_query(&self, cube: &Cube, original: Self::Query,
        remaining: u8, normal_bound: u8) -> Option<Self::Query> {
        self.inner.alternative_query(cube, original.inner, remaining, normal_bound)
            .map(|inner| StrengthenedQuery { inner, corner: original.corner })
    }

    fn conjugate(&self, cube: &Cube, symmetry: u8) -> Option<Cube> {
        self.inner.conjugate(cube, symmetry)
    }
}

/// v=min_{a,b in H_C} d_C(a*c*b), clipped if the input u table is clipped.
/// The payload has 907 values, but the current class decoder is much larger.
pub struct DoubleCornerOracle<'a> {
    classes: &'a DoubleClasses,
    values: Vec<u8>,
    edge_orientation: Option<&'a eo::EoPdb>,
}

impl<'a> DoubleCornerOracle<'a> {
    pub fn new(classes: &'a DoubleClasses, pdb: &CornerPdb) -> Result<Self, String> {
        let values = classes.orbit_minima(pdb.values())?;
        Ok(Self { classes, values, edge_orientation: None })
    }

    /// The seven EO weight minima, unlike full EO, preserve both left and
    /// right H and all 96 operations. Their max with v and ell5 does too.
    pub fn new_with_eo(classes: &'a DoubleClasses, pdb: &CornerPdb,
        edge_orientation: &'a eo::EoPdb) -> Result<Self, String> {
        let mut oracle = Self::new(classes, pdb)?;
        oracle.edge_orientation = Some(edge_orientation);
        Ok(oracle)
    }

    pub fn values(&self) -> &[u8] { &self.values }

    /// Raw (possibly capped) v. PruningOracle additionally maxes with ell5
    /// and optional EO weight minima, then clips to its declared maximum,
    /// so the two APIs may return different values.
    pub fn value(&self, cube: &Cube) -> Result<u8, String> {
        let index = corner_coset::rank(cube)?;
        let class = self.classes.orbit_class(index)? as usize;
        self.values.get(class).copied().ok_or_else(|| "invalid double orbit ID".into())
    }
}

impl PruningOracle for DoubleCornerOracle<'_> {
    type Query = u8;
    fn prepare(&self, cube: &Cube, remaining: u8) -> Result<u8, u8> {
        // The class map and values have already been verified; legal Cube is
        // the same caller obligation as in the pre-existing search API.
        let index = corner_coset::rank_unchecked(cube);
        let class = self.classes.orbit_class(index).expect("verified class map") as usize;
        let value = self.values[class].max(corner_coset::lower_bound5(cube))
            .max(self.edge_orientation.map_or(0, |pdb| pdb.weight_bound(cube))).min(13);
        if value > remaining { Err(value) } else { Ok(value) }
    }
    fn lookup(&self, value: u8) -> u8 { value }
    fn max_bound(&self) -> u8 { 13 }
}

/// Exact corner distance is a full-cube lower bound, not a subgroup oracle.
/// Its safe consumer is corner_distance_search (or an explicitly separated
/// distance-only rejection in another search implementation).
pub struct FullCornerDistanceOracle<'a> {
    table: CornerDistanceStorage<'a>,
    symmetries: &'a CornerSymmetries,
    maximum: u8,
}

#[derive(Clone, Copy)]
enum CornerDistanceStorage<'a> {
    Sparse(&'a FullCornerPdb),
    Dense(&'a DenseCornerPdb),
    Prepared(&'a PreparedCornerPdb),
}

impl<'a> FullCornerDistanceOracle<'a> {
    pub fn new(table: &'a FullCornerPdb, symmetries: &'a CornerSymmetries) -> Self {
        // Compute once, outside the search. A declared mathematical diameter
        // is not substituted for the maximum of this certified payload.
        Self { table: CornerDistanceStorage::Sparse(table), symmetries,
            maximum: table.max_distance() }
    }

    pub fn from_dense(table: &'a DenseCornerPdb, symmetries: &'a CornerSymmetries) -> Self {
        Self { table: CornerDistanceStorage::Dense(table), symmetries,
            maximum: table.max_distance() }
    }

    pub fn from_prepared(table: &'a PreparedCornerPdb, symmetries: &'a CornerSymmetries) -> Self {
        Self { table: CornerDistanceStorage::Prepared(table), symmetries, maximum: table.max_distance() }
    }

    pub fn max_distance(&self) -> u8 { self.maximum }

    pub fn lower_bound(&self, cube: &Cube) -> Result<DistanceBound, String> {
        match self.table {
            CornerDistanceStorage::Sparse(table) => table.distance(cube, self.symmetries),
            CornerDistanceStorage::Dense(table) => table.distance(cube, self.symmetries),
            CornerDistanceStorage::Prepared(table) => Ok(table.distance(cube)),
        }.map(DistanceBound)
    }
}

/// Adds only the independent L <= D rejection channel. The original subgroup
/// queries, bounds, masks, thresholds and cached values keep their contracts.
///
/// Every corner is reachable as the projection of a legal full cube, so d_C
/// is admissible for the residual state on either side of a NISS switch.
/// Neither d_C nor max(inner_bound, d_C) is an H-invariant oracle value.
pub trait IndependentDistance {
    /// A full-state certificate only. None can also be used by a diagnostic
    /// observer that must leave the original search decisions unchanged.
    fn bound(&self, cube: &Cube, remaining: u8) -> Option<u8>;
}

impl IndependentDistance for FullCornerDistanceOracle<'_> {
    fn bound(&self, cube: &Cube, remaining: u8) -> Option<u8> {
        (remaining < self.max_distance()).then(|| self.lower_bound(cube)
            .expect("certified corner table and a legal search state").get())
    }
}

pub struct DistanceGatedOracle<'a, O, const LATE: bool = false, const PROFILE: bool = false,
    D: IndependentDistance = FullCornerDistanceOracle<'a>> {
    inner: &'a O,
    distance: &'a D,
}

impl<'a, O: PruningOracle> DistanceGatedOracle<'a, O> {
    pub fn new(inner: &'a O, distance: &'a FullCornerDistanceOracle<'a>) -> Self {
        Self { inner, distance }
    }

    pub fn after_primary(inner: &'a O, distance: &'a FullCornerDistanceOracle<'a>) -> DistanceGatedOracle<'a, O, true> {
        DistanceGatedOracle { inner, distance }
    }

    #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
    pub fn profiled_after_primary(inner: &'a O, distance: &'a FullCornerDistanceOracle<'a>) -> DistanceGatedOracle<'a, O, true, true> {
        DistanceGatedOracle { inner, distance }
    }
}

impl<'a, O: PruningOracle, D: IndependentDistance> DistanceGatedOracle<'a, O, true, false, D> {
    pub fn with_independent(inner: &'a O, distance: &'a D) -> Self { Self { inner, distance } }
}

impl<O: PruningOracle, const LATE: bool, const PROFILE: bool, D: IndependentDistance> PruningOracle for DistanceGatedOracle<'_, O, LATE, PROFILE, D> {
    type Query = O::Query;

    fn prepare(&self, cube: &Cube, remaining: u8) -> Result<Self::Query, u8> {
        self.inner.prepare(cube, remaining)
    }
    fn lookup(&self, query: Self::Query) -> u8 { self.inner.lookup(query) }

    fn distance_only_after_primary(&self) -> bool { LATE }

    fn distance_only_bound(&self, cube: &Cube, remaining: u8) -> Option<u8> {
        let previous = self.inner.distance_only_bound(cube, remaining);
        if previous.is_some_and(|bound| bound > remaining) {
            return previous;
        }
        match self.distance.bound(cube, remaining) {
            Some(value) => Some(previous.map_or(value, |bound| bound.max(value))),
            None => previous,
        }
    }

    #[cfg(any(feature = "wasm-batch-probes", all(feature = "opt10-native-batch", not(target_family = "wasm"))))]
    fn lookup_batch(&self, queries: &[Option<Self::Query>; 8]) -> [u8; 8] {
        self.inner.lookup_batch(queries)
    }

    fn cancelled(&self) -> bool { self.inner.cancelled() }
    fn max_bound(&self) -> u8 { self.inner.max_bound() }
    fn allow_parent_propagation(&self) -> bool { self.inner.allow_parent_propagation() }
    fn allow_dynamic_prefixes(&self) -> bool { self.inner.allow_dynamic_prefixes() }
    fn allow_quarter_pruning(&self) -> bool { self.inner.allow_quarter_pruning() }
    fn allow_quarter_cache(&self) -> bool { self.inner.allow_quarter_cache() }
    fn allow_root_bound(&self) -> bool { self.inner.allow_root_bound() }
    fn allow_dual_rejection(&self) -> bool { self.inner.allow_dual_rejection() }
    fn allow_backward_coset(&self) -> bool { self.inner.allow_backward_coset() }
    fn allow_coset_chain(&self) -> bool { self.inner.allow_coset_chain() }
    fn profile_search(&self) -> bool { PROFILE || self.inner.profile_search() }
    fn allow_niss_inverse_tie(&self) -> bool { self.inner.allow_niss_inverse_tie() }
    fn allow_axis_pruning(&self) -> bool { self.inner.allow_axis_pruning() }
    fn allow_global_prefix_ranking(&self) -> bool { self.inner.allow_global_prefix_ranking() }

    fn lookahead_move(&self, cube: &Cube, remaining: u8, normal_bound: u8) -> Option<u8> {
        self.inner.lookahead_move(cube, remaining, normal_bound)
    }
    fn alternative_query(&self, cube: &Cube, original: Self::Query,
        remaining: u8, normal_bound: u8) -> Option<Self::Query> {
        self.inner.alternative_query(cube, original, remaining, normal_bound)
    }
    fn conjugate(&self, cube: &Cube, symmetry: u8) -> Option<Cube> {
        self.inner.conjugate(cube, symmetry)
    }
}
