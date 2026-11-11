//! Cubical automorphisms and compact labelled-piece coordinates for stage PDBs.

use std::sync::OnceLock;

use crate::cube_common::MOVE_STATES;

#[derive(Clone, Debug)]
pub struct StageSymmetry {
    pub corners: [u8; 8],
    pub edges: [u8; 12],
    pub corner_offsets: [u8; 8],
    pub edge_offsets: [u8; 12],
    pub reflected: bool,
    pub moves: [u8; 18],
}

const CORNERS: [[i8; 3]; 8] = [
    [-1, 1, -1],
    [1, 1, -1],
    [1, 1, 1],
    [-1, 1, 1],
    [-1, -1, -1],
    [1, -1, -1],
    [1, -1, 1],
    [-1, -1, 1],
];
const EDGES: [[i8; 3]; 12] = [
    [-1, 0, -1],
    [1, 0, -1],
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, -1],
    [1, 1, 0],
    [0, 1, 1],
    [-1, 1, 0],
    [0, -1, -1],
    [1, -1, 0],
    [0, -1, 1],
    [-1, -1, 0],
];
const FACES: [[i8; 3]; 6] = [
    [0, 1, 0],
    [0, -1, 0],
    [-1, 0, 0],
    [1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
];

pub fn piece_moves(corner: bool) -> &'static [[u8; 18]; 24] {
    static C: OnceLock<[[u8; 18]; 24]> = OnceLock::new();
    static E: OnceLock<[[u8; 18]; 24]> = OnceLock::new();
    let cell = if corner { &C } else { &E };
    cell.get_or_init(|| {
        let base = if corner { 3 } else { 2 };
        std::array::from_fn(|code| {
            std::array::from_fn(|m| {
                let values: &[u8] = if corner {
                    &MOVE_STATES[m].corners
                } else {
                    &MOVE_STATES[m].edges
                };
                let dst = values
                    .iter()
                    .position(|&v| v as usize / base == code / base)
                    .unwrap();
                (dst * base + (code % base + values[dst] as usize % base) % base) as u8
            })
        })
    })
}

impl StageSymmetry {
    #[inline]
    pub fn transform(&self, corner: bool, label: u8, code: u8) -> u8 {
        let base = if corner { 3 } else { 2 };
        let pos = (code / base) as usize;
        let (next, a, b) = if corner {
            (
                self.corners[pos],
                self.corner_offsets[pos],
                self.corner_offsets[label as usize],
            )
        } else {
            (
                self.edges[pos],
                self.edge_offsets[pos],
                self.edge_offsets[label as usize],
            )
        };
        let ori = if corner && self.reflected {
            -(code as i16 % base as i16)
        } else {
            code as i16 % base as i16
        };
        next * base + (ori + a as i16 - b as i16).rem_euclid(base as i16) as u8
    }

    pub fn preserves(&self, corners: &[u8], edges: &[u8]) -> bool {
        corners
            .iter()
            .all(|&i| corners.contains(&self.corners[i as usize]))
            && edges
                .iter()
                .all(|&i| edges.contains(&self.edges[i as usize]))
    }

    pub fn identity(&self) -> bool {
        self.corners
            .iter()
            .enumerate()
            .all(|(i, &v)| i == v as usize)
            && self.edges.iter().enumerate().all(|(i, &v)| i == v as usize)
            && !self.reflected
    }
}

fn offsets<const N: usize>(
    map: &[u8; N],
    moves: &[u8; 18],
    corner: bool,
    reflected: bool,
) -> [u8; N] {
    let base = if corner { 3 } else { 2 };
    let sign = if corner && reflected { -1i16 } else { 1 };
    let mt = piece_moves(corner);
    let mut out = [u8::MAX; N];
    out[0] = 0;
    while out.contains(&u8::MAX) {
        let mut changed = false;
        for p in 0..N {
            if out[p] == u8::MAX {
                continue;
            }
            for m in 0..18 {
                let q = mt[p * base][m] as usize;
                let gq = mt[map[p] as usize * base][moves[m] as usize] as usize;
                assert_eq!(gq / base, map[q / base] as usize);
                let value = (out[p] as i16 + (gq % base) as i16 - sign * (q % base) as i16)
                    .rem_euclid(base as i16) as u8;
                if out[q / base] == u8::MAX {
                    out[q / base] = value;
                    changed = true;
                } else {
                    assert_eq!(out[q / base], value);
                }
            }
        }
        assert!(
            changed || !out.contains(&u8::MAX),
            "disconnected single-piece move graph"
        );
    }
    out
}

pub fn all_symmetries() -> &'static [StageSymmetry] {
    static ALL: OnceLock<Vec<StageSymmetry>> = OnceLock::new();
    ALL.get_or_init(|| {
        let mut out = Vec::with_capacity(48);
        for p in [
            [0, 1, 2],
            [0, 2, 1],
            [1, 0, 2],
            [1, 2, 0],
            [2, 0, 1],
            [2, 1, 0],
        ] {
            let inversions = (0..3)
                .flat_map(|i| (i + 1..3).map(move |j| (i, j)))
                .filter(|&(i, j)| p[i] > p[j])
                .count();
            for bits in 0u8..8 {
                let signs: [i8; 3] =
                    std::array::from_fn(|i| if bits >> i & 1 == 0 { 1 } else { -1 });
                let reflected = (inversions + bits.count_ones() as usize) % 2 != 0;
                let apply = |v: [i8; 3]| std::array::from_fn(|i| signs[i] * v[p[i]]);
                let corners = std::array::from_fn(|i| {
                    CORNERS
                        .iter()
                        .position(|&v| v == apply(CORNERS[i]))
                        .unwrap() as u8
                });
                let edges = std::array::from_fn(|i| {
                    EDGES.iter().position(|&v| v == apply(EDGES[i])).unwrap() as u8
                });
                let moves = std::array::from_fn(|m| {
                    let face = FACES
                        .iter()
                        .position(|&v| v == apply(FACES[m / 3]))
                        .unwrap();
                    (face * 3 + if reflected { [2, 1, 0][m % 3] } else { m % 3 }) as u8
                });
                out.push(StageSymmetry {
                    corner_offsets: offsets(&corners, &moves, true, reflected),
                    edge_offsets: offsets(&edges, &moves, false, reflected),
                    corners,
                    edges,
                    reflected,
                    moves,
                });
            }
        }
        out.sort_by_key(|s| !s.identity());
        out
    })
}

pub fn stabilizer(corners: &[u8], edges: &[u8]) -> Vec<StageSymmetry> {
    all_symmetries()
        .iter()
        .filter(|s| s.preserves(corners, edges))
        .cloned()
        .collect()
}

pub fn coordinate_size(n: usize, base: usize, pieces: usize) -> usize {
    (0..n).fold(base.pow(n as u32), |v, i| v * (pieces - i))
}

/// Same mixed-radix layout as cube_common::array_to_index, without allocation.
#[inline]
pub fn rank(codes: &[u8], base: usize, pieces: usize) -> u32 {
    let mut p = 0usize;
    let mut stride = 1usize;
    let mut o = 0usize;
    let mut occupied = 0u16;
    for (i, &code) in codes.iter().enumerate() {
        let pos = code as usize / base;
        debug_assert!(pos < pieces && occupied & (1 << pos) == 0);
        let earlier = (occupied & ((1 << pos) - 1)).count_ones() as usize;
        p += (pos - earlier) * stride;
        stride *= pieces - i;
        occupied |= 1 << pos;
        o = o * base + code as usize % base;
    }
    (p * base.pow(codes.len() as u32) + o) as u32
}

#[inline]
pub fn unrank(mut index: u32, codes: &mut [u8], base: usize, pieces: usize) {
    let orientation_size = base.pow(codes.len() as u32) as u32;
    let mut o = index % orientation_size;
    index /= orientation_size;
    let mut occupied = 0u16;
    for (i, code) in codes.iter_mut().enumerate() {
        let radix = (pieces - i) as u32;
        let mut digit = index % radix;
        index /= radix;
        let mut pos = 0;
        loop {
            if occupied & (1 << pos) == 0 {
                if digit == 0 {
                    break;
                }
                digit -= 1;
            }
            pos += 1;
        }
        occupied |= 1 << pos;
        *code = (pos * base) as u8;
    }
    for code in codes.iter_mut().rev() {
        *code += (o % base as u32) as u8;
        o /= base as u32;
    }
}

pub fn transform_coordinate(sym: &StageSymmetry, corner: bool, labels: &[u8], index: u32) -> u32 {
    let base = if corner { 3 } else { 2 };
    let pieces = if corner { 8 } else { 12 };
    let mut from = [0u8; 7];
    let mut to = [0u8; 7];
    unrank(index, &mut from[..labels.len()], base, pieces);
    for (i, &label) in labels.iter().enumerate() {
        let dest = if corner {
            sym.corners[label as usize]
        } else {
            sym.edges[label as usize]
        };
        let j = labels
            .iter()
            .position(|&v| v == dest)
            .expect("symmetry must stabilize tracked labels");
        to[j] = sym.transform(corner, label, from[i]);
    }
    rank(&to[..labels.len()], base, pieces)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn all_automorphisms_preserve_moves_and_solved_orientation() {
        assert_eq!(all_symmetries().len(), 48);
        for s in all_symmetries() {
            for corner in [false, true] {
                let base = if corner { 3 } else { 2 };
                let n = 24 / base;
                let mt = piece_moves(corner);
                for label in 0..n {
                    assert_eq!(
                        s.transform(corner, label as u8, (label * base) as u8) % base as u8,
                        0
                    );
                    for code in 0..24 {
                        for m in 0..18 {
                            let left = s.transform(corner, label as u8, mt[code][m]);
                            let right = mt[s.transform(corner, label as u8, code as u8) as usize]
                                [s.moves[m] as usize];
                            assert_eq!(left, right);
                        }
                    }
                }
            }
        }
    }
    #[test]
    fn partial_rank_matches_existing_layout() {
        let mut codes = [0u8; 4];
        for i in 0..136080u32 {
            unrank(i, &mut codes, 3, 8);
            assert_eq!(rank(&codes, 3, 8), i);
            let old: Vec<i32> = codes.iter().map(|&v| v as i32).collect();
            assert_eq!(crate::cube_common::array_to_index(&old, 4, 3, 8), i as i32);
        }
    }
}
