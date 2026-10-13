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
        Ok(self.coordinates.index(cube))
    }
    fn lookup(&self, index: u64) -> u8 {
        self.table.get(index)
    }
    fn max_bound(&self) -> u8 {
        self.table.header().max_bound
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
                let canonical = tables.conjugate(&cube, (entry & 63) as u8);
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
        })
    }

    pub fn index(&self, cube: &Cube) -> u64 {
        self.tables.eo10_index(cube, false)
    }

    pub fn index_scalar(&self, cube: &Cube) -> u64 {
        self.tables.eo10_index(cube, true)
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

    fn full_aliases(&self, cube: &Cube, visit: &mut dyn FnMut(u64)) {
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
            visit(((full >> 10) << 9) | (full & 511));
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
