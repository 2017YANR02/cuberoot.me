//! CubeRoot's experimental EO10 extension, not a published cube48opt variant.
//! Native generation uses full-pattern orbit keys; queries retain ten EO bits.
//! Reuses the Opt9 small LUT layout, retains one additional EO bit, and keeps
//! the padded outer-edge coordinate in the low nine bits.
use crate::{
    coord::{CoordTables, COORDINATE_COUNT},
    cube::Cube,
};

pub const COORDINATES: u64 = (COORDINATE_COUNT as u64) << 10;
pub const TABLE_BYTES: u64 = COORDINATES / 4;
pub const VALID_ENTRIES: u64 = 3393 * 70 * 495 * 1024;

pub struct Opt10Coordinates {
    tables: CoordTables,
    representatives: Vec<Cube>,
    stabilizers: Vec<Vec<u8>>,
    masks8: Vec<u16>,
    masks12: [u16; 512],
    #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
    lookahead_moves: Box<[u8]>,
    #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
    projection_symmetries: Box<[u8]>,
    #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
    projection_classes: Box<[u8]>,
}

impl crate::opt10_generate::CoordinateSpace for Opt10Coordinates {
    type State = Cube;
    fn solved(&self) -> Cube {
        Cube::SOLVED
    }
    fn full_key(&self, state: &Cube) -> u64 {
        self.full_key(state)
    }
    fn representative(&self, key: u64) -> Result<Cube, String> {
        self.representative(key)
    }
    fn moved(&self, state: &Cube, movement: u8) -> Cube {
        state.moved(movement)
    }
    fn mark_projected(&self, state: &Cube, visit: &mut dyn FnMut(u64)) {
        self.projected_aliases(state, visit);
    }
    fn project_if_key(
        &self,
        state: &Cube,
        include: impl FnOnce(u64) -> bool,
        visit: &mut dyn FnMut(u64),
    ) -> bool {
        self.projected_if_key(state, include, visit)
    }
    fn cells(&self) -> u64 {
        COORDINATES
    }
    fn allow_move(&self, previous: Option<u8>, next: u8) -> bool {
        previous.is_none_or(|previous| {
            let (a, b) = (previous / 3, next / 3);
            a != b && !(a == b + 3)
        })
    }
}

pub struct Opt10Solver {
    coordinates: Opt10Coordinates,
    table: crate::opt10_table::Opt10Table,
}

impl Opt10Solver {
    /// Bind both coordinates and PDB to exactly the same snapshot bytes.
    pub fn open(snapshot: &[u8], path: &std::path::Path) -> Result<Self, String> {
        let coordinates = Opt10Coordinates::from_opt9_snapshot(snapshot)?;
        let table = crate::opt10_table::Opt10Table::load(path, snapshot)?;
        Ok(Self { coordinates, table })
    }
}

impl crate::search::PruningOracle for Opt10Solver {
    type Query = u64;
    fn prepare(&self, cube: &Cube, _: u8) -> Result<u64, u8> {
        let index = self.coordinates.index(cube);
        #[cfg(all(feature = "opt10-native-hotpath", not(target_family = "wasm")))]
        self.table.prefetch(index);
        Ok(index)
    }
    #[cfg_attr(all(feature = "opt10-native-hotpath", not(target_family = "wasm")), inline(always))]
    fn lookup(&self, index: u64) -> u8 {
        self.table.get(index)
    }
    #[cfg(all(feature = "opt10-native-batch", not(target_family = "wasm")))]
    #[inline(always)]
    fn lookup_batch(&self, queries: &[Option<u64>; 8]) -> [u8; 8] {
        self.table.get_batch(queries)
    }
    fn max_bound(&self) -> u8 {
        self.table.header().max_bound
    }
    fn allow_parent_propagation(&self) -> bool {
        cfg!(all(feature = "opt10-native-search", not(target_family = "wasm")))
    }
    fn allow_dynamic_prefixes(&self) -> bool {
        cfg!(all(feature = "opt10-native-search", not(target_family = "wasm")))
    }
    fn allow_quarter_pruning(&self) -> bool {
        cfg!(all(feature = "opt10-native-search", not(target_family = "wasm")))
    }
    fn allow_dual_rejection(&self) -> bool {
        cfg!(all(feature = "opt10-native-dual", not(target_family = "wasm")))
    }
    fn allow_backward_coset(&self) -> bool {
        cfg!(all(feature = "opt10-native-coset", not(target_family = "wasm")))
    }
    fn allow_coset_chain(&self) -> bool {
        cfg!(all(feature = "opt10-native-coset-chain", not(target_family = "wasm")))
    }
    fn profile_search(&self) -> bool {
        cfg!(all(feature = "opt10-native-profile", not(target_family = "wasm")))
    }
    fn allow_root_bound(&self) -> bool {
        cfg!(all(feature = "opt10-native-search", not(target_family = "wasm")))
    }
    #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
    fn lookahead_move(&self, cube: &Cube, remaining: u8, normal_bound: u8) -> Option<u8> {
        self.coordinates.lookahead_move(cube, remaining, normal_bound)
    }
    #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
    fn alternative_query(&self, cube: &Cube, original_query: u64, remaining: u8, normal_bound: u8) -> Option<u64> {
        let index = self.coordinates.alternative_query(cube, original_query, remaining, normal_bound)?;
        self.table.prefetch(index);
        Some(index)
    }
    fn conjugate(&self, cube: &Cube, symmetry: u8) -> Option<Cube> {
        Some(self.coordinates.conjugate(cube, symmetry))
    }
}

impl Opt10Coordinates {
    pub fn from_opt9_snapshot(snapshot: &[u8]) -> Result<Self, String> {
        let tables = CoordTables::from_variant_bytes(snapshot, 9)?;
        let masks8: Vec<_> = (0u16..256).rev().filter(|m| m.count_ones() == 4).collect();
        let mut representatives = vec![None; 3393];
        #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
        let mut lookahead_moves = vec![u8::MAX; crate::coord::CORNER_RAW_COUNT].into_boxed_slice();
        #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
        let mut projection_symmetries = vec![u8::MAX; crate::coord::CORNER_RAW_COUNT].into_boxed_slice();
        #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
        let mut projection_classes = vec![0; crate::coord::CORNER_CLASSES as usize].into_boxed_slice();
        // Recover representatives from the complete validated raw corner LUT.
        for orientation in 0..2187 {
            for &mask in &masks8 {
                let mut cube = Cube::SOLVED;
                let mut next = [0u8, 4u8];
                let (mut co, mut sum) = (orientation, 0);
                for i in 0..8 {
                    let group = ((mask >> i) & 1) as usize;
                    let twist = if i < 7 {
                        let t = co % 3;
                        co /= 3;
                        sum += t;
                        t
                    } else {
                        (3 - sum % 3) % 3
                    };
                    cube.corners[i] = next[group] | (twist << 3) as u8;
                    next[group] += 1;
                }
                let entry = tables.corner_entry(&cube);
                #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
                {
                    lookahead_moves[tables.raw_corner(&cube)] = select_eo10_half(&tables, &cube);
                }
                let canonical = tables.conjugate(&cube, (entry & 63) as u8);
                #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
                {
                    let symmetry = select_eo10_projection(&tables, &cube, tables.raw_corner(&canonical));
                    projection_symmetries[tables.raw_corner(&cube)] = symmetry;
                    if symmetry != u8::MAX { projection_classes[(entry >> 6) as usize] = 1; }
                }
                let slot = &mut representatives[(entry >> 6) as usize];
                if let Some(previous) = slot {
                    if tables.raw_corner(previous) != tables.raw_corner(&canonical) {
                        return Err("Opt9 corner representatives disagree".into());
                    }
                } else {
                    *slot = Some(canonical);
                }
            }
        }
        let representatives = representatives
            .into_iter()
            .collect::<Option<Vec<_>>>()
            .ok_or("incomplete corner representatives")?;
        let stabilizers = representatives
            .iter()
            .map(|cube| {
                (0..48)
                    .filter(|&s| {
                        tables.raw_corner(&tables.conjugate(cube, s)) == tables.raw_corner(cube)
                    })
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();
        if stabilizers.iter().any(Vec::is_empty) {
            return Err("empty corner stabilizer".into());
        }
        let mut masks12 = [0; 512];
        for (ordinal, mask) in (0u16..4096)
            .rev()
            .filter(|m| m.count_ones() == 4)
            .enumerate()
        {
            masks12[ordinal + 2 * (ordinal / 62 + 1)] = mask;
        }
        Ok(Self {
            tables,
            representatives,
            stabilizers,
            masks8,
            masks12,
            #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
            lookahead_moves,
            #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
            projection_symmetries,
            #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
            projection_classes,
        })
    }

    #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
    fn lookahead_move(&self, cube: &Cube, remaining: u8, normal_bound: u8) -> Option<u8> {
        // The main PDB is capped at 13, hence the shifted certificate is at
        // most 12. At r=12 it can only remove opposite-side half turns.
        if !(10..=12).contains(&remaining) || normal_bound >= 12 {
            return None;
        }
        let movement = self.lookahead_moves[self.tables.raw_corner(cube)];
        (movement != u8::MAX).then_some(movement)
    }

    #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
    fn alternative_query(&self, cube: &Cube, original_query: u64, remaining: u8, normal_bound: u8) -> Option<u64> {
        if !(11..=12).contains(&remaining) || normal_bound != remaining { return None; }
        // Reuse the original query's corner class to avoid recomputing raw
        // corners for the common case with no informative stabilizer frame.
        let class = usize::try_from((original_query >> 19) / 70).ok()?;
        if self.projection_classes.get(class).copied() != Some(1) { return None; }
        let raw = self.tables.raw_corner(cube);
        let symmetry = self.projection_symmetries[raw];
        if symmetry == u8::MAX { return None; }
        debug_assert_eq!((self.tables.corner_entry(cube) >> 6) as usize, class);
        let index = self.tables.eo10_index_in_frame(cube, raw, symmetry);
        // Distinct omitted freedoms do not guarantee different indices for
        // every particular state. Avoid issuing the same PDB query twice.
        (index != original_query).then_some(index)
    }

    pub fn index(&self, cube: &Cube) -> u64 {
        self.tables.eo10_index(cube, false)
    }

    pub fn index_scalar(&self, cube: &Cube) -> u64 {
        self.tables.eo10_index(cube, true)
    }

    /// A single canonical frame for EO11 lookup. Generation writes every
    /// stabilizer alias, so lookup need not enumerate them or take a minimum.
    pub(crate) fn full_index(&self, cube: &Cube, scalar: bool) -> u64 {
        self.tables.eo11_index(cube, scalar)
    }

    pub fn conjugate(&self, cube: &Cube, symmetry: u8) -> Cube {
        self.tables.conjugate(cube, symmetry)
    }

    /// Full 11-EO orbit key for generation only. This never reads an H11 table.
    pub fn full_key(&self, cube: &Cube) -> u64 {
        let mut key = u64::MAX;
        self.full_aliases(cube, &mut |alias| key = key.min(alias));
        key
    }

    pub(crate) fn full_aliases(&self, cube: &Cube, visit: &mut dyn FnMut(u64)) {
        let entry = self.tables.corner_entry(cube);
        let class = entry >> 6;
        let canonical = self.tables.conjugate(cube, (entry & 63) as u8);
        for &symmetry in &self.stabilizers[class as usize] {
            let state = self.tables.conjugate(&canonical, symmetry);
            visit(self.tables.full_pattern_in_frame(&state, class));
        }
    }

    pub fn projected_aliases(&self, cube: &Cube, visit: &mut dyn FnMut(u64)) {
        self.full_aliases(cube, &mut |full| visit(((full >> 10) << 9) | (full & 511)));
    }

    /// Reuse the full aliases when both the canonical key and projections are
    /// needed. There are at most 48 corner stabilizers, so no heap allocation
    /// or second symmetry pass is required for an accepted suffix node.
    pub fn projected_if_key(
        &self,
        cube: &Cube,
        include: impl FnOnce(u64) -> bool,
        visit: &mut dyn FnMut(u64),
    ) -> bool {
        self.full_if_key(cube, include, &mut |full| visit(((full >> 10) << 9) | (full & 511)))
    }

    pub(crate) fn full_if_key(
        &self,
        cube: &Cube,
        include: impl FnOnce(u64) -> bool,
        visit: &mut dyn FnMut(u64),
    ) -> bool {
        let mut aliases = [0u64; 48];
        let mut count = 0;
        let mut key = u64::MAX;
        self.full_aliases(cube, &mut |alias| {
            aliases[count] = alias;
            count += 1;
            key = key.min(alias);
        });
        if !include(key) {
            return false;
        }
        for &full in &aliases[..count] {
            visit(full);
        }
        true
    }

    pub fn representative(&self, key: u64) -> Result<Cube, String> {
        if key >= COORDINATES * 2 {
            return Err("full EO key out of range".into());
        }
        let outer = self.masks12[(key & 511) as usize];
        if outer == 0 {
            return Err("full EO key points to padding".into());
        }
        let eo = (key >> 9) & 2047;
        let orbit = key >> 20;
        let inner = self.masks8[(orbit % 70) as usize];
        let mut cube = self.representatives[(orbit / 70) as usize];
        let (mut next, mut inner_position, mut flip) = ([0u8, 4u8, 8u8], 0, 0);
        for position in 0..12 {
            let group = if outer & (1 << position) != 0 {
                2
            } else {
                let group = ((inner >> inner_position) & 1) as usize;
                inner_position += 1;
                group
            };
            let orientation = if position < 11 {
                ((eo >> position) & 1) as u8
            } else {
                flip
            };
            flip ^= orientation;
            cube.edges[position] = (next[group] << 1) | orientation;
            next[group] += 1;
        }
        // Internal tetrad permutation is omitted by the abstraction. Choose a
        // physically legal parity representative without changing any pattern.
        if cube.validate().is_err() {
            let positions: Vec<_> = (0..8)
                .filter(|&i| cube.corners[i] & 7 < 4)
                .take(2)
                .collect();
            let (a, b) = (positions[0], positions[1]);
            let (ia, ib) = (cube.corners[a] & 7, cube.corners[b] & 7);
            cube.corners[a] = (cube.corners[a] & !7) | ib;
            cube.corners[b] = (cube.corners[b] & !7) | ia;
        }
        cube.validate()?;
        Ok(cube)
    }
}

/// Choose a right half turn that makes the currently omitted EO freedom
/// visible in the new coordinate. For (g*A)[p], the original source is
/// A.edges[p] >> 1: pull the child's missing pair back through A, rather than
/// applying A in the opposite direction or comparing canonical labels.
///
/// Every decision uses only raw corner patterns. Left multiplication by H,
/// generated by half turns, preserves those patterns both at g and g*A.
/// Thus A(h*g)=A(g), and max(h(g), h(g*A)-1) remains a left-H-invariant lower
/// bound. Moving an omitted bit only proves visibility, not a stronger bound.
#[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
fn select_eo10_half(tables: &CoordTables, cube: &Cube) -> u8 {
    let [first, last] = tables.eo10_omitted_sources(cube);
    let omitted = (1u16 << first) | (1u16 << last);
    for movement in [1u8, 4, 7, 10, 13, 16] {
        let child = cube.moved(movement);
        let [first, last] = tables.eo10_omitted_sources(&child);
        let sources = &crate::cube::MOVES[movement as usize].edges;
        let child_omitted = (1u16 << (sources[first as usize] >> 1))
            | (1u16 << (sources[last as usize] >> 1));
        if child_omitted != omitted {
            return movement;
        }
    }
    u8::MAX
}

/// Find one alternate direct canonical frame in the corner stabilizer orbit.
/// The changed missing EO pair can expose information absent from the first
/// projection. No turn is applied, so its decoded lower bound needs no -1.
/// This selection depends only on raw corners and is constant on left H cosets.
#[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
fn select_eo10_projection(tables: &CoordTables, cube: &Cube, canonical_raw: usize) -> u8 {
    let [a, b] = tables.eo10_omitted_sources(cube);
    let omitted = (1u16 << a) | (1u16 << b);
    for symmetry in 0..48 {
        let [a, b] = tables.eo10_omitted_sources_in_frame(symmetry);
        if ((1u16 << a) | (1u16 << b)) == omitted { continue; }
        if tables.raw_corner(&tables.conjugate(cube, symmetry)) == canonical_raw {
            return symmetry;
        }
    }
    u8::MAX
}

/// Remove the additional EO bit, keeping the outer-edge padding unchanged.
/// A larger coordinate does not alone prove a stronger *compressed* bound.
pub fn project_to_opt9(index: u64) -> Result<u64, String> {
    if index >= COORDINATES {
        return Err("EO10 coordinate out of range".into());
    }
    Ok(((index >> 10) << 9) | (index & 511))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
    #[test]
    #[ignore = "requires only the local 818008-byte Opt9 coordinate snapshot, never the PDB"]
    fn eo10_projection_selection_exhaustive_snapshot() {
        use crate::{coord::CORNER_RAW_COUNT, cube::MOVES};
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../.tmp/cubeopt-reverse/opt9-generated/small-memory.bin");
        assert_eq!(std::fs::metadata(&path).unwrap().len(), 818_008);
        let coordinates = Opt10Coordinates::from_opt9_snapshot(&std::fs::read(path).unwrap()).unwrap();
        assert_eq!(coordinates.projection_symmetries.len(), CORNER_RAW_COUNT);
        assert_eq!(coordinates.projection_classes.len(), 3393);
        let mut seen = vec![false; CORNER_RAW_COUNT];
        let mut eligible = 0;
        let mut left_half_checks = 0;
        let mut gate_witness = None;
        for orientation in 0..2187 {
            for &mask in &coordinates.masks8 {
                let mut cube = Cube::SOLVED;
                let (mut co, mut sum, mut next) = (orientation, 0, [0u8, 4]);
                for i in 0..8 {
                    let group = ((mask >> i) & 1) as usize;
                    let twist = if i < 7 { let t = co % 3; co /= 3; sum += t; t } else { (3 - sum % 3) % 3 };
                    cube.corners[i] = next[group] | (twist << 3) as u8;
                    next[group] += 1;
                }
                if cube.validate().is_err() {
                    let slots: Vec<_> = (0..8).filter(|&i| cube.corners[i] & 7 < 4).take(2).collect();
                    let (a, b) = (slots[0], slots[1]);
                    let (ia, ib) = (cube.corners[a] & 7, cube.corners[b] & 7);
                    cube.corners[a] = (cube.corners[a] & !7) | ib;
                    cube.corners[b] = (cube.corners[b] & !7) | ia;
                }
                cube.validate().unwrap();
                let raw = coordinates.tables.raw_corner(&cube);
                assert!(!std::mem::replace(&mut seen[raw], true));
                let entry = coordinates.tables.corner_entry(&cube);
                let canonical_raw = coordinates.tables.raw_corner(&coordinates.conjugate(&cube, (entry & 63) as u8));
                let original = coordinates.index(&cube);
                assert_eq!(original, coordinates.index_scalar(&cube));
                let mut flipped = cube;
                for position in coordinates.tables.eo10_omitted_sources(&cube) { flipped.edges[position as usize] ^= 1; }
                flipped.validate().unwrap();
                assert_eq!(original, coordinates.index(&flipped));
                // Select independently by actual scalar-coordinate visibility,
                // not by the missing-pair comparison used to build the LUT.
                let mut expected = None;
                for symmetry in 0..48 {
                    let a = coordinates.conjugate(&cube, symmetry);
                    if coordinates.tables.raw_corner(&a) != canonical_raw { continue; }
                    let b = coordinates.conjugate(&flipped, symmetry);
                    let a = coordinates.tables.full_pattern_in_frame(&a, entry >> 6);
                    let b = coordinates.tables.full_pattern_in_frame(&b, entry >> 6);
                    let projected_a = ((a >> 10) << 9) | (a & 511);
                    let projected_b = ((b >> 10) << 9) | (b & 511);
                    if projected_a != projected_b {
                        expected = Some(symmetry);
                        break;
                    }
                }
                assert_eq!(coordinates.projection_symmetries[raw], expected.unwrap_or(u8::MAX));
                assert_eq!(coordinates.projection_classes[(entry >> 6) as usize], u8::from(expected.is_some()));
                let Some(symmetry) = expected else { continue; };
                eligible += 1;
                let alt = coordinates.tables.eo10_index_in_frame(&flipped, raw, symmetry);
                let slow_full = coordinates.tables.full_pattern_in_frame(&coordinates.conjugate(&flipped, symmetry), entry >> 6);
                assert_eq!(alt, ((slow_full >> 10) << 9) | (slow_full & 511));
                assert_ne!(alt, original);
                assert_eq!(coordinates.tables.eo10_index_in_frame(&cube, raw, symmetry), original);
                assert_eq!(coordinates.alternative_query(&cube, original, 12, 12), None, "skip duplicate index");
                assert_eq!(coordinates.alternative_query(&flipped, original, 11, 11), Some(alt));
                assert_eq!(coordinates.alternative_query(&flipped, original, 12, 12), Some(alt));
                let mut generated_member = false;
                coordinates.projected_aliases(&flipped, &mut |index| generated_member |= index == alt);
                assert!(generated_member, "query must belong to the generator's projected orbit");
                gate_witness = Some((flipped, original, alt));
                for movement in [1u8, 4, 7, 10, 13, 16] {
                    let shifted = MOVES[movement as usize].multiplied(&flipped);
                    assert_eq!(coordinates.tables.raw_corner(&shifted), raw);
                    assert_eq!(coordinates.index(&shifted), original);
                    assert_eq!(coordinates.alternative_query(&shifted, original, 12, 12), Some(alt));
                    left_half_checks += 1;
                }
            }
        }
        assert!(seen.into_iter().all(|value| value));
        assert_eq!(eligible, 7890);
        assert_eq!(left_half_checks, 47340);
        let (witness, original, alt) = gate_witness.unwrap();
        for remaining in 0..=20 {
            for bound in 0..=20 {
                assert_eq!(coordinates.alternative_query(&witness, original, remaining, bound),
                    if (11..=12).contains(&remaining) && bound == remaining { Some(alt) } else { None });
            }
        }
        assert_eq!(coordinates.alternative_query(&witness, u64::MAX, 12, 12), None);
        let mut cube = Cube::SOLVED;
        let mut seed = 0xabd9_148f_9270_813c_u64;
        let mut random_different = 0;
        for _ in 0..4096 {
            for _ in 0..30 {
                seed ^= seed << 13; seed ^= seed >> 7; seed ^= seed << 17;
                cube = cube.moved((seed % 18) as u8);
            }
            for state in [cube, cube.inverse()] {
                let original = coordinates.index(&state);
                assert_eq!(original, coordinates.index_scalar(&state));
                let Some(alt) = coordinates.alternative_query(&state, original, 12, 12) else { continue; };
                assert_ne!(alt, original);
                let raw = coordinates.tables.raw_corner(&state);
                let symmetry = coordinates.projection_symmetries[raw];
                let entry = coordinates.tables.corner_entry(&state);
                let slow = coordinates.tables.full_pattern_in_frame(&coordinates.conjugate(&state, symmetry), entry >> 6);
                assert_eq!(alt, ((slow >> 10) << 9) | (slow & 511));
                let mut member = false;
                coordinates.projected_aliases(&state, &mut |index| member |= index == alt);
                assert!(member);
                random_different += 1;
            }
        }
        assert!(random_different > 0);
        println!("EO10 projection: rawCorners={CORNER_RAW_COUNT} eligible={eligible} leftHalfChecks={left_half_checks} randomStates=8192 randomDifferent={random_different} pdbBytes=0");
    }

    #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
    #[test]
    #[ignore = "requires only the local 818008-byte Opt9 coordinate snapshot, never the PDB"]
    fn eo10_lookahead_selection_exhaustive_snapshot() {
        use crate::{coord::CORNER_RAW_COUNT, cube::MOVES};
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../.tmp/cubeopt-reverse/opt9-generated/small-memory.bin");
        assert_eq!(std::fs::metadata(&path).unwrap().len(), 818_008);
        let coordinates = Opt10Coordinates::from_opt9_snapshot(&std::fs::read(path).unwrap()).unwrap();
        assert_eq!(coordinates.lookahead_moves.len(), CORNER_RAW_COUNT);
        let mut seen = vec![false; CORNER_RAW_COUNT];
        let mut available_histogram = [0usize; 7];
        let mut first_faces = [0usize; 6];
        let mut pair_checks = 0;
        let mut left_half_checks = 0;
        for orientation in 0..2187 {
            for &mask in &coordinates.masks8 {
                let mut cube = Cube::SOLVED;
                let (mut co, mut sum, mut next) = (orientation, 0, [0u8, 4]);
                for i in 0..8 {
                    let group = ((mask >> i) & 1) as usize;
                    let twist = if i < 7 {
                        let t = co % 3;
                        co /= 3;
                        sum += t;
                        t
                    } else {
                        (3 - sum % 3) % 3
                    };
                    cube.corners[i] = next[group] | (twist << 3) as u8;
                    next[group] += 1;
                }
                // Keep the witness physically legal, without changing the
                // raw pattern by exchanging identities within one tetrad.
                if cube.validate().is_err() {
                    let slots: Vec<_> = (0..8).filter(|&i| cube.corners[i] & 7 < 4).take(2).collect();
                    let (a, b) = (slots[0], slots[1]);
                    let (ia, ib) = (cube.corners[a] & 7, cube.corners[b] & 7);
                    cube.corners[a] = (cube.corners[a] & !7) | ib;
                    cube.corners[b] = (cube.corners[b] & !7) | ia;
                }
                cube.validate().unwrap();
                let raw = coordinates.tables.raw_corner(&cube);
                assert!(!std::mem::replace(&mut seen[raw], true));
                let mut flipped = cube;
                for position in coordinates.tables.eo10_omitted_sources(&cube) {
                    flipped.edges[position as usize] ^= 1;
                }
                flipped.validate().unwrap();
                assert_eq!(coordinates.index(&cube), coordinates.index(&flipped));
                assert_eq!(coordinates.index_scalar(&cube), coordinates.index_scalar(&flipped));
                // Derive the expected choice from actual coordinate
                // visibility, independently of select_eo10_half's pair math.
                let mut first_visible = None;
                let mut available = 0;
                for movement in [1u8, 4, 7, 10, 13, 16] {
                    let child = cube.moved(movement);
                    let other = flipped.moved(movement);
                    let a = coordinates.index_scalar(&child);
                    let b = coordinates.index_scalar(&other);
                    assert_eq!(coordinates.index(&child), a);
                    assert_eq!(coordinates.index(&other), b);
                    if a != b {
                        available += 1;
                        first_visible.get_or_insert(movement);
                    }
                    pair_checks += 1;
                }
                available_histogram[available] += 1;
                let movement = first_visible.unwrap();
                first_faces[(movement / 3) as usize] += 1;
                for remaining in 10..=12 {
                    assert_eq!(coordinates.lookahead_move(&cube, remaining, 11), Some(movement));
                }
                for face in 0..6 {
                    let shifted = MOVES[face * 3 + 1].multiplied(&cube);
                    assert_eq!(coordinates.tables.raw_corner(&shifted), raw);
                    assert_eq!(coordinates.lookahead_move(&shifted, 11, 11), Some(movement));
                    assert_eq!(coordinates.index(&cube.moved(movement)), coordinates.index(&shifted.moved(movement)));
                    left_half_checks += 1;
                }
            }
        }
        assert!(seen.into_iter().all(|value| value));
        assert_eq!(available_histogram, [0, 0, 288, 1264, 40211, 73186, 38141]);
        assert_eq!(first_faces, [127225, 22394, 3399, 48, 24, 0]);
        assert_eq!(pair_checks, 918_540);
        assert_eq!(left_half_checks, 918_540);
        for remaining in 0..=20 {
            for normal_bound in 0..=20 {
                assert_eq!(coordinates.lookahead_move(&Cube::SOLVED, remaining, normal_bound).is_some(),
                    (10..=12).contains(&remaining) && normal_bound < 12);
            }
        }
        println!("EO10 lookahead: rawCorners={CORNER_RAW_COUNT} covered={CORNER_RAW_COUNT} pairChecks={pair_checks} leftHalfChecks={left_half_checks} pdbBytes=0");
    }

    #[test]
    fn capacity_and_projection_preserve_outer_padding() {
        assert_eq!(TABLE_BYTES, 31_130_910_720);
        assert_eq!(VALID_ENTRIES, 120_389_068_800);
        for block in [0, 1, (3393 * 70) - 1] {
            for eo in 0..1024 {
                for outer in [0, 1, 2, 63, 64, 65, 66, 510, 511] {
                    let index = (block << 19) | (eo << 9) | outer;
                    assert_eq!(
                        project_to_opt9(index).unwrap(),
                        (block << 18) | ((eo >> 1) << 9) | outer
                    );
                }
            }
        }
        assert_eq!(
            project_to_opt9(COORDINATES - 1).unwrap(),
            COORDINATES / 2 - 1
        );
        assert!(project_to_opt9(COORDINATES).is_err());
        assert!(project_to_opt9(u64::MAX).is_err());
        // Published variants remain closed; do not silently bypass validation.
        assert!(crate::table::Variant::new(10).is_err());
    }
}
