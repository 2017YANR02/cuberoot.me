//! A separate complete-edge-orientation lower bound (2048 states).
//!
//! This repository stores the edge flip in bit 0. For a right move m,
//! `eo(g*m)[i] = eo(g)[p_m(i)] XOR eo(m)[i]`; the current edge identities do
//! not occur in this update. Every face half turn has zero EO, so every h in
//! the half-turn subgroup has zero EO and `eo(h*g) == eo(g)`. Consequently the
//! exact distance in this projection is left-H invariant and is a lower bound
//! on min_h D(h*g), not merely on D(g). It can strengthen the same-side oracle.
//!
//! A strict information witness is a legal state with solved corners and edge
//! permutation, and two flipped edges in the four EO positions omitted by the
//! old Opt8 projection's solved-corner frame. Its old normal/inverse keys are
//! solved, but its complete EO distance is at least three: in at most two
//! moves the possible flip counts are 0, 4, 6, and 8, never two.
//! This comparison concerns the old two queries, not the maximum of all 96.
//!
//! Inversion is intentionally not a coordinate operation: inverse EO also
//! depends on the actual edge permutation. Query the actual inverse Cube.
//! Its coarsest inversion-stable coarsening is the total number of flipped
//! edges. The seven weight minima are computed from the certified EO table;
//! they give an additional bi-H, spatial-symmetry/inversion invariant bound.
//! No table is built implicitly; callers explicitly construct EoPdb::new().

use crate::cube::{Cube, MOVES};

pub const EO_COUNT: usize = 1 << 11;
const UNKNOWN: u8 = u8::MAX;

/// First eleven position flips as little-endian bits. The final position is
/// fixed by even total flip parity. Input is an already valid corner/edge state.
pub fn rank_unchecked(cube: &Cube) -> usize {
    cube.edges[..11].iter().enumerate().fold(0, |index, (position, &edge)| {
        index | (usize::from(edge & 1) << position)
    })
}

/// Validate the edge projection, then rank it. Corner data is not inspected.
pub fn rank(cube: &Cube) -> Result<usize, String> {
    let mut seen = 0_u16;
    let mut parity = 0_u8;
    for &edge in &cube.edges {
        if edge >= 24 { return Err("EO coordinate received an edge byte outside 0..24".into()); }
        let identity = edge >> 1;
        let bit = 1_u16 << identity;
        if seen & bit != 0 { return Err("EO coordinate received a duplicate edge identity".into()); }
        seen |= bit;
        parity ^= edge & 1;
    }
    if seen != (1 << 12) - 1 || parity != 0 {
        return Err("EO coordinate received an invalid edge permutation or odd flip parity".into());
    }
    Ok(rank_unchecked(cube))
}

/// A legal complete representative: identity permutations, solved corners,
/// and the indexed even-parity edge-flip vector.
pub fn representative(index: usize) -> Result<Cube, String> {
    if index >= EO_COUNT { return Err("EO rank is outside 0..2048".into()); }
    let mut cube = Cube::SOLVED;
    let mut parity = 0_u8;
    for position in 0..11 {
        let flip = ((index >> position) & 1) as u8;
        cube.edges[position] |= flip;
        parity ^= flip;
    }
    cube.edges[11] |= parity;
    Ok(cube)
}

fn transitions() -> Result<Vec<[u16; 18]>, String> {
    let mut rows = Vec::with_capacity(EO_COUNT);
    for index in 0..EO_COUNT {
        let cube = representative(index)?;
        let mut row = [0_u16; 18];
        for (movement, generator) in MOVES.iter().enumerate() {
            // Use the repository's cubie arithmetic, not copied move constants.
            row[movement] = rank(&cube.multiplied(generator))? as u16;
        }
        rows.push(row);
    }
    Ok(rows)
}

/// Unique goal, edge Lipschitz inequalities, and a descending edge at every
/// positive state together certify exact shortest-path distances. Checksum or
/// BFS provenance alone would not establish that claim.
fn certify(values: &[u8; EO_COUNT], moves: &[[u16; 18]]) -> Result<u8, String> {
    if moves.len() != EO_COUNT || values[0] != 0 {
        return Err("EO distance certificate has an invalid transition shape or goal".into());
    }
    let mut maximum = 0;
    for (index, &value) in values.iter().enumerate() {
        if value == UNKNOWN || (value == 0 && index != 0) {
            return Err(format!("EO distance certificate has an invalid value at {index}"));
        }
        maximum = maximum.max(value);
        let mut descends = value == 0;
        for (movement, &raw_next) in moves[index].iter().enumerate() {
            let next = usize::from(raw_next);
            let neighbor = *values.get(next)
                .ok_or_else(|| "EO transition leaves its coordinate range".to_string())?;
            if neighbor == UNKNOWN || value.abs_diff(neighbor) > 1 {
                return Err(format!("EO certificate violates an edge bound at {index}/{movement}"));
            }
            if neighbor.checked_add(1) == Some(value) { descends = true; }
        }
        if !descends { return Err(format!("EO certificate lacks a descending edge at {index}")); }
    }
    Ok(maximum)
}

/// Immutable, semantically certified exact EO distance. Runtime construction
/// uses a temporary 2048-by-18 transition array and a finite BFS queue, then
/// discards both. There is no external file or process-global lazy initializer.
#[derive(Clone)]
pub struct EoPdb {
    values: [u8; EO_COUNT],
    weight_minima: [u8; 7],
    maximum: u8,
}

impl EoPdb {
    pub fn new() -> Result<Self, String> {
        let moves = transitions()?;
        let mut values = [UNKNOWN; EO_COUNT];
        values[0] = 0;
        let mut queue = Vec::with_capacity(EO_COUNT);
        queue.push(0_u16);
        let mut head = 0;
        while head < queue.len() {
            let index = usize::from(queue[head]);
            let next_depth = values[index].checked_add(1)
                .filter(|&value| value != UNKNOWN)
                .ok_or_else(|| "EO BFS exceeded its representable distance".to_string())?;
            for &raw_next in &moves[index] {
                let next = usize::from(raw_next);
                if values[next] == UNKNOWN {
                    values[next] = next_depth;
                    queue.push(raw_next);
                }
            }
            head += 1;
        }
        if queue.len() != EO_COUNT { return Err("EO BFS did not reach all even flip vectors".into()); }
        let maximum = certify(&values, &moves)?;
        // Inversion can permute an EO vector by any edge permutation, once
        // corner permutation parity is chosen to match. Its EO-only stable
        // classes are therefore exactly the seven even Hamming weights.
        // These are minima of certified distances, not distances from a BFS
        // on a weight-only transition graph (which would lose successors).
        let mut weight_minima = [UNKNOWN; 7];
        for (index, &value) in values.iter().enumerate() {
            let first_eleven = index.count_ones() as usize;
            let weight = first_eleven + (first_eleven & 1);
            weight_minima[weight / 2] = weight_minima[weight / 2].min(value);
        }
        if weight_minima.contains(&UNKNOWN) {
            return Err("EO weight minima omit an even flip count".into());
        }
        Ok(Self { values, weight_minima, maximum })
    }

    /// Same legal-Cube obligation as the original search oracle. EO on both
    /// NISS sides is obtained from their actual Cube values, never by guessing
    /// an inverse coordinate from this rank alone.
    pub fn lower_bound(&self, cube: &Cube) -> u8 { self.values[rank_unchecked(cube)] }

    pub fn lower_bound_checked(&self, cube: &Cube) -> Result<u8, String> {
        Ok(self.values[rank(cube)?])
    }

    /// A weaker EO-only bound that is invariant under both H actions and all
    /// 96 spatial/inversion operations. Input must be a legal Cube. Full EO
    /// lookup dominates this value on each side; this form is for callers
    /// needing the stronger invariance contract.
    pub fn weight_bound(&self, cube: &Cube) -> u8 {
        let weight: usize = cube.edges.iter().map(|&edge| usize::from(edge & 1)).sum();
        self.weight_minima[weight / 2]
    }

    pub fn weight_bound_checked(&self, cube: &Cube) -> Result<u8, String> {
        rank(cube)?;
        Ok(self.weight_bound(cube))
    }

    /// Entry k is min d_EO(x) over all orientation vectors of weight 2*k.
    pub fn weight_minima(&self) -> &[u8; 7] { &self.weight_minima }
    pub fn maximum(&self) -> u8 { self.maximum }
    pub fn values(&self) -> &[u8] { &self.values }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::corner_coset::HALF_TURNS;

    #[test]
    fn every_even_flip_vector_has_a_valid_representative_and_checked_rank() {
        for index in 0..EO_COUNT {
            let cube = representative(index).unwrap();
            cube.validate().unwrap();
            assert_eq!(rank(&cube).unwrap(), index);
        }
        assert!(representative(EO_COUNT).is_err());
        let mut odd = Cube::SOLVED;
        odd.edges[0] ^= 1;
        assert!(rank(&odd).is_err());
        let mut duplicate = Cube::SOLVED;
        duplicate.edges[0] = duplicate.edges[1];
        assert!(rank(&duplicate).is_err());
        let mut invalid = Cube::SOLVED;
        invalid.edges[0] = 24;
        assert!(rank(&invalid).is_err());
    }

    #[test]
    fn certified_eo_distances_respect_half_turns_and_the_two_flip_witness() {
        let table = EoPdb::new().unwrap();
        assert_eq!(table.lower_bound(&Cube::SOLVED), 0);
        for (movement, generator) in MOVES.iter().enumerate() {
            let flips = generator.edges.iter().filter(|&&edge| edge & 1 != 0).count();
            if movement % 3 == 1 {
                assert_eq!(flips, 0);
                assert_eq!(table.lower_bound(generator), 0);
            } else {
                assert_eq!(flips, 4);
                assert_eq!(table.lower_bound(generator), 1);
            }
        }
        let mut witness = Cube::SOLVED;
        witness.edges[0] ^= 1;
        witness.edges[1] ^= 1;
        witness.validate().unwrap();
        assert_eq!(witness.inverse(), witness);
        assert!(table.lower_bound(&witness) >= 3);
        assert_eq!(table.weight_minima()[1], 3);
        // The weight minimum is admissible but need not be consistent. A
        // two-flip vector meeting F in one edge becomes a four-flip vector.
        // Their class minima are three and one across this single move.
        assert_eq!(table.weight_bound(&witness), 3);
        assert_eq!(table.weight_bound(&witness.multiplied(&MOVES[6])), 1);
        assert!(table.maximum() >= table.lower_bound(&witness));
        for index in 0..EO_COUNT {
            let cube = representative(index).unwrap();
            assert!(table.weight_bound(&cube) <= table.lower_bound(&cube));
            assert_eq!(table.weight_bound(&cube), table.weight_bound(&cube.inverse()));
            for half_turn in HALF_TURNS {
                let translated = MOVES[usize::from(half_turn)].multiplied(&cube);
                assert_eq!(table.lower_bound(&translated), table.lower_bound(&cube));
                assert_eq!(table.weight_bound(&translated), table.weight_bound(&cube));
                let translated_right = cube.multiplied(&MOVES[usize::from(half_turn)]);
                assert_eq!(table.weight_bound(&translated_right), table.weight_bound(&cube));
            }
        }
    }

    #[test]
    fn complete_eo_still_does_not_define_coordinate_only_inversion() {
        let mut a = Cube::SOLVED;
        a.edges[0] ^= 1;
        a.edges[1] ^= 1;
        let mut b = a;
        // Even edge 3-cycle (0 1 3), with the same position flips as a.
        b.edges[0] = 3;
        b.edges[1] = 7;
        b.edges[3] = 0;
        a.validate().unwrap();
        b.validate().unwrap();
        assert_eq!(rank(&a).unwrap(), rank(&b).unwrap());
        assert_ne!(rank(&a.inverse()).unwrap(), rank(&b.inverse()).unwrap());
    }
}
