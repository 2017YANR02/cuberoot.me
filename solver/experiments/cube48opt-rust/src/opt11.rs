//! CubeRoot EO11 extension. Source only: no local execution is authorized.
//!
//! The full-pattern quotient already used by the Opt10 generator becomes the
//! lookup space. Keep all eleven independent EO bits and all corner-stabilizer
//! aliases. This is not Nissy H48 h11 and does not accept its table format.
use crate::{
    cube::Cube,
    eo_table::{AtomicEoTable, EoHeader, EoLayout, EoTable},
    opt10::Opt10Coordinates,
    opt10_generate::CoordinateSpace,
    search::PruningOracle,
};

pub const COORDINATES: u64 = EoLayout::<11>::COORDINATES;
pub const TABLE_BYTES: u64 = EoLayout::<11>::TABLE_BYTES;
pub const VALID_ENTRIES: u64 = EoLayout::<11>::VALID_ENTRIES;
pub const FILE_BYTES: u64 = EoLayout::<11>::FILE_BYTES;
pub type AtomicOpt11Table = AtomicEoTable<11>;
pub type Opt11Header = EoHeader<11>;
pub type Opt11Table = EoTable<11>;

/// Deliberate source-only boundary, before CLI file access or allocation.
/// No environment variable or Opt10 receipt can authorize a local Opt11 run.
pub fn ensure_local_cli_allowed() -> Result<(), String> {
    Err("Opt11 is source-only: generation, table loading and solving are disabled pending explicit run authorization and validation".into())
}

pub struct Opt11Coordinates(Opt10Coordinates);

impl Opt11Coordinates {
    pub fn from_opt9_snapshot(snapshot: &[u8]) -> Result<Self, String> {
        Ok(Self(Opt10Coordinates::from_opt9_snapshot(snapshot)?))
    }

    #[inline(always)]
    pub fn index(&self, cube: &Cube) -> u64 { self.0.full_index(cube, false) }

    pub fn index_scalar(&self, cube: &Cube) -> u64 { self.0.full_index(cube, true) }
}

impl CoordinateSpace for Opt11Coordinates {
    type State = Cube;
    fn solved(&self) -> Cube { Cube::SOLVED }
    fn full_key(&self, cube: &Cube) -> u64 { self.0.full_key(cube) }
    fn representative(&self, key: u64) -> Result<Cube, String> { self.0.representative(key) }
    fn moved(&self, cube: &Cube, movement: u8) -> Cube { cube.moved(movement) }
    fn mark_projected(&self, cube: &Cube, visit: &mut dyn FnMut(u64)) {
        self.0.full_aliases(cube, visit);
    }
    fn project_if_key(
        &self,
        cube: &Cube,
        include: impl FnOnce(u64) -> bool,
        visit: &mut dyn FnMut(u64),
    ) -> bool {
        self.0.full_if_key(cube, include, visit)
    }
    fn cells(&self) -> u64 { COORDINATES }
    fn allow_move(&self, previous: Option<u8>, next: u8) -> bool {
        self.0.allow_move(previous, next)
    }
}

pub struct Opt11Solver {
    coordinates: Opt11Coordinates,
    table: Opt11Table,
}

impl Opt11Solver {
    pub fn open(snapshot: &[u8], path: &std::path::Path) -> Result<Self, String> {
        let coordinates = Opt11Coordinates::from_opt9_snapshot(snapshot)?;
        let table = Opt11Table::load(path, snapshot)?;
        Ok(Self { coordinates, table })
    }

    /// Candidates borrow the same validated immutable allocation. This does
    /// not open another table or change the baseline oracle's read path.
    #[cfg(all(feature = "opt11-lookup", not(target_family = "wasm")))]
    pub(crate) fn table(&self) -> &Opt11Table { &self.table }
}

impl PruningOracle for Opt11Solver {
    type Query = u64;
    #[inline(always)]
    fn prepare(&self, cube: &Cube, _: u8) -> Result<u64, u8> { Ok(self.coordinates.index(cube)) }
    #[inline(always)]
    fn lookup(&self, index: u64) -> u8 { self.table.get(index) }
    fn max_bound(&self) -> u8 { self.table.header().max_bound }
    fn conjugate(&self, cube: &Cube, symmetry: u8) -> Option<Cube> {
        Some(self.coordinates.0.conjugate(cube, symmetry))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn layout_and_execution_boundary() {
        assert_eq!(TABLE_BYTES, 62_261_821_440);
        assert_eq!(FILE_BYTES, 62_261_822_464);
        assert_eq!(VALID_ENTRIES, 240_778_137_600);
        assert!(ensure_local_cli_allowed().unwrap_err().contains("source-only"));
    }

    #[test]
    #[ignore = "requires the Opt9 small snapshot; no main table is loaded"]
    fn full_eo_aliases_roundtrip_and_project_to_the_existing_opt10_coordinate() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../.tmp/cubeopt-reverse/opt9-generated/small-memory.bin");
        let snapshot = std::fs::read(path).unwrap();
        let coordinates = Opt11Coordinates::from_opt9_snapshot(&snapshot).unwrap();
        let mut cube = Cube::SOLVED;
        for step in 0..128 {
            cube = cube.moved(((step * 7 + step / 18) % 18) as u8);
            for symmetry in 0..48 {
                let state = coordinates.0.conjugate(&cube, symmetry);
                let index = coordinates.index(&state);
                assert_eq!(index, coordinates.index_scalar(&state));
                assert!(EoLayout::<11>::valid_index(index));
                assert_eq!(((index >> 10) << 9) | (index & 511), coordinates.0.index(&state));
                let key = coordinates.full_key(&state);
                let representative = coordinates.representative(key).unwrap();
                assert_eq!(coordinates.full_key(&representative), key);
                let mut contains_lookup = false;
                coordinates.mark_projected(&state, &mut |alias| {
                    contains_lookup |= alias == index;
                    assert!(EoLayout::<11>::valid_index(alias));
                });
                assert!(contains_lookup);
                let mut calls = 0;
                assert!(!coordinates.project_if_key(&state, |_| false, &mut |_| calls += 1));
                assert_eq!(calls, 0);
            }
        }
    }
}
