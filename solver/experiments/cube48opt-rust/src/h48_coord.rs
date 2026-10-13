// SPDX-License-Identifier: GPL-3.0-or-later
//! Nissy H48 h0..h11 coordinates for the existing native cube48opt state.
//!
//! Ported from sebastianotronto/nissy-core, commit
//! 1f7e8e937d0e71e7eb3b5deab38b34d0a0159d88: arch/portable.h,
//! core/constants.h, core/transform.h, and solvers/h48/{coordinate.h,
//! gendata_eoesep.h}. See solver/vendor/nissy-core/LICENSE.
//! The state conversion is a fixed physical-piece relabeling and edge
//! orientation gauge. No C, WASM, strings, allocation or table generation
//! participates in a coordinate query.
//!
//! `h10-fast-coord` preserves these exact coordinates with 8184 bytes of
//! compile-time subset tables and, on AArch64, 1536 bytes of padded symmetry
//! vectors. NEON keeps the transformed edges in registers through ESEP/EO.
//! Explicit scalar methods remain available for differential validation.

use crate::{cube::Cube, h48_variant::H48Variant};

pub const COCSEP_ENTRIES: u32 = 2187 * 128;
pub const CORNER_CLASSES: u32 = 3393;
pub const ESEP_ENTRIES: u32 = 34_650;
pub const ESEP_CLASSES: u32 = 782;
pub const EOESEP_ENTRIES: u32 = ESEP_CLASSES * 2048;

// Both permutations are involutions. Corner twist values have the same
// handedness in both models. Opt's edge orientation differs at the four
// U/D--R/L edges, so flipping depends on both the position and the identity.
const CORNER_TO_NISSY: [usize; 8] = [0, 1, 2, 3, 6, 7, 4, 5];
const EDGE_TO_NISSY: [usize; 12] = [0, 1, 2, 3, 4, 7, 6, 5, 8, 9, 10, 11];

#[inline]
const fn edge_gauge(i: usize) -> u8 {
    (i >= 4 && i < 8) as u8
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CornerData {
    pub class: u16,
    /// Nissy's symmetry number, never cube48opt's symmetry number.
    pub symmetry: u8,
    pub bound: u8,
}

impl CornerData {
    #[inline]
    pub fn from_word(word: u32) -> Self {
        let result = Self {
            class: (word >> 16) as u16,
            symmetry: (word >> 8) as u8,
            bound: word as u8,
        };
        debug_assert!(u32::from(result.class) < CORNER_CLASSES);
        debug_assert!(result.symmetry < 48);
        debug_assert!(result.bound <= 9);
        result
    }
}

/// A query-local Nissy state; prepare once, then compute the auxiliary
/// coordinate only when the main table returns a zero code.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct H48State {
    corners: [u8; 8],
    edges: [u8; 12],
}

impl H48State {
    #[inline]
    pub fn from_cube(cube: &Cube) -> Self {
        let mut result = Self {
            corners: [0; 8],
            edges: [0; 12],
        };
        for (position, &value) in cube.corners.iter().enumerate() {
            result.corners[CORNER_TO_NISSY[position]] =
                CORNER_TO_NISSY[(value & 7) as usize] as u8 | ((value >> 3) << 5);
        }
        for (position, &value) in cube.edges.iter().enumerate() {
            let identity = (value >> 1) as usize;
            let flip = (value & 1) ^ edge_gauge(position) ^ edge_gauge(identity);
            result.edges[EDGE_TO_NISSY[position]] = EDGE_TO_NISSY[identity] as u8 | (flip << 4);
        }
        result
    }

    pub fn to_bytes(&self) -> [u8; 20] {
        let mut result = [0; 20];
        result[..8].copy_from_slice(&self.corners);
        result[8..].copy_from_slice(&self.edges);
        result
    }

    #[inline]
    pub fn raw_cocsep(&self) -> u32 {
        let mut orientation = 0;
        let mut separation = 0;
        let mut power = 1;
        for i in 0..7 {
            orientation += u32::from(self.corners[i] >> 5) * power;
            power *= 3;
            separation |= u32::from((self.corners[i] >> 2) & 1) << i;
        }
        (orientation << 7) | separation
    }

    #[inline]
    pub fn raw_esep(&self) -> u32 {
        edge_separation(&self.edges)
    }

    /// Original branch/combinatorial implementation, retained as a reference.
    #[inline]
    pub fn raw_esep_scalar(&self) -> u32 {
        edge_separation_scalar(&self.edges)
    }

    #[inline]
    pub fn raw_eo(&self) -> u32 {
        edge_orientation(&self.edges)
    }

    #[inline]
    pub fn raw_eo_scalar(&self) -> u32 {
        edge_orientation_scalar(&self.edges)
    }

    /// T * cube * T^-1 in the exact 0..47 order in Nissy constants.h.
    /// Mirrors need no additional edge-orientation correction in this model.
    #[inline]
    pub fn transformed_edges(&self, symmetry: u8) -> [u8; 12] {
        #[cfg(all(feature = "h10-fast-coord", target_arch = "aarch64"))]
        // Each input is exactly 12 bytes; load_edges_neon never over-reads it.
        unsafe {
            use std::arch::aarch64::*;
            let vector = transform_edges_neon(load_edges_neon(&self.edges), symmetry);
            let mut padded = [0; 16];
            vst1q_u8(padded.as_mut_ptr(), vector);
            padded[..12].try_into().unwrap()
        }
        #[cfg(not(all(feature = "h10-fast-coord", target_arch = "aarch64")))]
        self.transformed_edges_scalar(symmetry)
    }

    #[inline]
    pub fn transformed_edges_scalar(&self, symmetry: u8) -> [u8; 12] {
        let (transform, inverse) = &EDGE_TRANSFORMS[symmetry as usize];
        let mut result = [0; 12];
        for i in 0..12 {
            let right = inverse[i];
            let middle = self.edges[(right & 15) as usize];
            result[i] = transform[(middle & 15) as usize] ^ ((middle ^ right) & 16);
        }
        result
    }

    #[inline]
    pub fn main_index(&self, cdata: u32, variant: H48Variant) -> u64 {
        self.main_index_from_corner(CornerData::from_word(cdata), variant)
    }

    #[inline]
    pub fn main_index_from_corner(&self, corner: CornerData, variant: H48Variant) -> u64 {
        #[cfg(all(feature = "h10-fast-coord", target_arch = "aarch64"))]
        let (separation, orientation) = unsafe {
            // Retain the transformed vector through both coordinate queries.
            let edges = transform_edges_neon(load_edges_neon(&self.edges), corner.symmetry);
            (edge_separation_neon(edges), edge_orientation_neon(edges))
        };
        #[cfg(not(all(feature = "h10-fast-coord", target_arch = "aarch64")))]
        let (separation, orientation) = {
            let edges = self.transformed_edges(corner.symmetry);
            (edge_separation(&edges), edge_orientation(&edges))
        };
        let orbit = u64::from(corner.class) * u64::from(ESEP_ENTRIES) + u64::from(separation);
        fold_coordinate(orbit, orientation, variant)
    }

    #[inline]
    pub fn main_index_scalar(&self, cdata: u32, variant: H48Variant) -> u64 {
        let corner = CornerData::from_word(cdata);
        let edges = self.transformed_edges_scalar(corner.symmetry);
        let orbit = u64::from(corner.class) * u64::from(ESEP_ENTRIES)
            + u64::from(edge_separation_scalar(&edges));
        fold_coordinate(orbit, edge_orientation_scalar(&edges), variant)
    }

    /// edata is esep_entry(self.raw_esep()). Its class/representative are
    /// independent of the COCSEP representative used by the main table.
    #[inline]
    pub fn eoesep_index(&self, edata: u32) -> u32 {
        let class = edata >> 16;
        let symmetry = (edata >> 8) as u8;
        debug_assert!(class < ESEP_CLASSES);
        debug_assert!(symmetry < 48);
        #[cfg(all(feature = "h10-fast-coord", target_arch = "aarch64"))]
        let orientation = unsafe {
            edge_orientation_neon(transform_edges_neon(load_edges_neon(&self.edges), symmetry))
        };
        #[cfg(not(all(feature = "h10-fast-coord", target_arch = "aarch64")))]
        let orientation = edge_orientation(&self.transformed_edges(symmetry));
        (class << 11) | orientation
    }

    #[inline]
    pub fn eoesep_index_scalar(&self, edata: u32) -> u32 {
        let class = edata >> 16;
        let symmetry = (edata >> 8) as u8;
        debug_assert!(class < ESEP_CLASSES);
        debug_assert!(symmetry < 48);
        (class << 11) | edge_orientation_scalar(&self.transformed_edges_scalar(symmetry))
    }
}

#[inline(always)]
fn fold_coordinate(orbit: u64, orientation: u32, variant: H48Variant) -> u64 {
    // Equivalent to (orbit * 2048 + eo) >> (11-h), including h=0 and h=11.
    // Preserve u64 before shifting: even h6's logical coordinate exceeds u32.
    (orbit << variant.h()) | u64::from(orientation >> (11 - variant.h()))
}

#[inline]
fn edge_orientation(edges: &[u8; 12]) -> u32 {
    #[cfg(all(feature = "h10-fast-coord", target_arch = "aarch64"))]
    unsafe {
        edge_orientation_neon(load_edges_neon(edges))
    }
    #[cfg(not(all(feature = "h10-fast-coord", target_arch = "aarch64")))]
    edge_orientation_scalar(edges)
}

#[inline]
fn edge_orientation_scalar(edges: &[u8; 12]) -> u32 {
    let mut result = 0;
    // Nissy drops position 0, not position 11. The omitted bit is fixed by
    // legal edge-flip parity; the retained coordinate is little-endian.
    for (i, edge) in edges.iter().enumerate().skip(1) {
        result |= u32::from(edge >> 4) << (i - 1);
    }
    result
}

#[inline]
fn edge_separation(edges: &[u8; 12]) -> u32 {
    #[cfg(all(feature = "h10-fast-coord", target_arch = "aarch64"))]
    unsafe {
        edge_separation_neon(load_edges_neon(edges))
    }
    #[cfg(all(feature = "h10-fast-coord", not(target_arch = "aarch64")))]
    {
        edge_separation_lut(edges)
    }
    #[cfg(not(feature = "h10-fast-coord"))]
    edge_separation_scalar(edges)
}

#[inline]
fn edge_separation_scalar(edges: &[u8; 12]) -> u32 {
    let (mut outer, mut inner) = (0, 0);
    let (mut outer_left, mut inner_left, mut inner_position) = (4, 4, 0);
    for (i, edge) in edges.iter().enumerate() {
        if edge & 8 != 0 {
            outer += BINOMIAL[11 - i][outer_left];
            outer_left -= 1;
        } else {
            if edge & 4 != 0 {
                inner += BINOMIAL[7 - inner_position][inner_left];
                inner_left -= 1;
            }
            inner_position += 1;
        }
    }
    outer * 70 + inner
}

const BINOMIAL: [[u32; 5]; 12] = {
    let mut result = [[0; 5]; 12];
    let mut n = 0;
    while n < 12 {
        result[n][0] = 1;
        if n != 0 {
            let mut k = 1;
            while k < 5 {
                result[n][k] = result[n - 1][k - 1] + result[n - 1][k];
                k += 1;
            }
        }
        n += 1;
    }
    result
};

// This is Nissy's subset rank, not the differently numbered cubeopt LUT.
// For a four-bit subset in n positions, rank = sum C(n-1-i, remaining).
// Its final bit contributes C(0,1)=0, so the first n-1 bits determine the
// rank. Their weight is three or four; it also determines the omitted bit.
// In the outer subset's complement, the same argument applies to four of
// eight inner identities. The scalar algorithm above is the reference.
#[cfg(any(feature = "h10-fast-coord", test))]
struct SeparationTables {
    rank12: [u16; 2048],
    complement: [[u8; 8]; 495],
    rank8: [u8; 128],
}

#[cfg(any(feature = "h10-fast-coord", test))]
const fn subset_rank(mask: u16, size: usize) -> u16 {
    let (mut rank, mut remaining, mut i) = (0, 4, 0);
    while i < size {
        if mask & (1 << i) != 0 {
            rank += BINOMIAL[size - 1 - i][remaining] as u16;
            remaining -= 1;
        }
        i += 1;
    }
    rank
}

#[cfg(any(feature = "h10-fast-coord", test))]
static SEPARATION: SeparationTables = {
    let mut result = SeparationTables {
        rank12: [u16::MAX; 2048],
        complement: [[0; 8]; 495],
        rank8: [u8::MAX; 128],
    };
    let mut mask = 0u16;
    while mask < 4096 {
        if mask.count_ones() == 4 {
            let rank = subset_rank(mask, 12) as usize;
            result.rank12[(mask & 2047) as usize] = rank as u16;
            let (mut i, mut j) = (0, 0);
            while i < 12 {
                if mask & (1 << i) == 0 {
                    result.complement[rank][j] = i as u8;
                    j += 1;
                }
                i += 1;
            }
        }
        mask += 1;
    }
    mask = 0;
    while mask < 256 {
        if mask.count_ones() == 4 {
            result.rank8[(mask & 127) as usize] = subset_rank(mask, 8) as u8;
        }
        mask += 1;
    }
    result
};

// 4096 + 3960 + 128 = 8184 bytes; the symmetry vectors below add 1536.
#[cfg(any(feature = "h10-fast-coord", test))]
const _: [(); 8184] = [(); std::mem::size_of::<SeparationTables>()];

#[cfg(any(all(feature = "h10-fast-coord", not(target_arch = "aarch64")), test))]
#[inline]
fn edge_separation_lut(edges: &[u8; 12]) -> u32 {
    let mut mask = 0;
    for (i, edge) in edges.iter().take(11).enumerate() {
        mask |= usize::from((edge >> 3) & 1) << i;
    }
    let outer = SEPARATION.rank12[mask] as usize;
    let mut inner = 0;
    for (i, &position) in SEPARATION.complement[outer].iter().take(7).enumerate() {
        inner |= usize::from((edges[position as usize] >> 2) & 1) << i;
    }
    outer as u32 * 70 + u32::from(SEPARATION.rank8[inner])
}

#[cfg(all(any(feature = "h10-fast-coord", test), target_arch = "aarch64"))]
static EDGE_TRANSFORMS_NEON: [[[u8; 16]; 2]; 48] = {
    let mut result = [[[0; 16]; 2]; 48];
    let mut symmetry = 0;
    while symmetry < 48 {
        let mut i = 0;
        while i < 12 {
            result[symmetry][0][i] = EDGE_TRANSFORMS[symmetry].0[i];
            result[symmetry][1][i] = EDGE_TRANSFORMS[symmetry].1[i];
            i += 1;
        }
        symmetry += 1;
    }
    result
};

#[cfg(all(any(feature = "h10-fast-coord", test), target_arch = "aarch64"))]
#[inline]
unsafe fn load_edges_neon(edges: &[u8; 12]) -> std::arch::aarch64::uint8x16_t {
    use std::arch::aarch64::*;
    // An eight-byte load plus four scalar bytes stays inside the 12-byte
    // object. In particular, do not vld1q_u8(edges.as_ptr()).
    let tail = u32::from_le_bytes(edges[8..12].try_into().unwrap());
    vcombine_u8(
        vld1_u8(edges.as_ptr()),
        vreinterpret_u8_u64(vcreate_u64(u64::from(tail))),
    )
}

#[cfg(all(any(feature = "h10-fast-coord", test), target_arch = "aarch64"))]
#[inline]
unsafe fn transform_edges_neon(
    edges: std::arch::aarch64::uint8x16_t,
    symmetry: u8,
) -> std::arch::aarch64::uint8x16_t {
    use std::arch::aarch64::*;
    let tables = &EDGE_TRANSFORMS_NEON[symmetry as usize];
    let inverse = vld1q_u8(tables[1].as_ptr());
    let middle = vqtbl1q_u8(edges, vandq_u8(inverse, vdupq_n_u8(15)));
    // For each real lane: T[edge[T^-1[i]].id] XOR (edge EO XOR T^-1 EO).
    // Last four lanes are ignored by the final masks and complement shuffle.
    veorq_u8(
        vqtbl1q_u8(
            vld1q_u8(tables[0].as_ptr()),
            vandq_u8(middle, vdupq_n_u8(15)),
        ),
        vandq_u8(veorq_u8(middle, inverse), vdupq_n_u8(16)),
    )
}

#[cfg(all(any(feature = "h10-fast-coord", test), target_arch = "aarch64"))]
#[inline]
unsafe fn bitmask_neon<const SHIFT: i32>(edges: std::arch::aarch64::uint8x16_t) -> u16 {
    use std::arch::aarch64::*;
    let weights = vld1_u8([1u8, 2, 4, 8, 16, 32, 64, 128].as_ptr());
    let bits = vandq_u8(vshrq_n_u8::<SHIFT>(edges), vdupq_n_u8(1));
    u16::from(vaddv_u8(vmul_u8(vget_low_u8(bits), weights)))
        | (u16::from(vaddv_u8(vmul_u8(vget_high_u8(bits), weights))) << 8)
}

#[cfg(all(any(feature = "h10-fast-coord", test), target_arch = "aarch64"))]
#[inline]
unsafe fn edge_orientation_neon(edges: std::arch::aarch64::uint8x16_t) -> u32 {
    // Position zero is omitted, matching Nissy (not cubeopt's last bit).
    u32::from((bitmask_neon::<4>(edges) >> 1) & 2047)
}

#[cfg(all(any(feature = "h10-fast-coord", test), target_arch = "aarch64"))]
#[inline]
unsafe fn edge_separation_neon(edges: std::arch::aarch64::uint8x16_t) -> u32 {
    use std::arch::aarch64::*;
    let mask = usize::from(bitmask_neon::<3>(edges) & 2047);
    let outer = SEPARATION.rank12[mask] as usize;
    let positions = vcombine_u8(
        vld1_u8(SEPARATION.complement[outer].as_ptr()),
        vdup_n_u8(0x80),
    );
    let remaining = vget_low_u8(vqtbl1q_u8(edges, positions));
    let weights = vld1_u8([1u8, 2, 4, 8, 16, 32, 64, 128].as_ptr());
    let inner = usize::from(
        vaddv_u8(vmul_u8(
            vand_u8(vshr_n_u8::<2>(remaining), vdup_n_u8(1)),
            weights,
        )) & 127,
    );
    outer as u32 * 70 + u32::from(SEPARATION.rank8[inner])
}

// Nissy's explicit transform and inverse edge cubies. Generated only from
// the pinned core/constants.h decimal constants, not from a runtime oracle.
const EDGE_TRANSFORMS: [([u8; 12], [u8; 12]); 48] = [
    // 0: UFr
    (
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    ),
    // 1: ULr
    (
        [5, 4, 7, 6, 0, 1, 2, 3, 25, 26, 27, 24],
        [4, 5, 6, 7, 1, 0, 3, 2, 27, 24, 25, 26],
    ),
    // 2: UBr
    (
        [1, 0, 3, 2, 5, 4, 7, 6, 10, 11, 8, 9],
        [1, 0, 3, 2, 5, 4, 7, 6, 10, 11, 8, 9],
    ),
    // 3: URr
    (
        [4, 5, 6, 7, 1, 0, 3, 2, 27, 24, 25, 26],
        [5, 4, 7, 6, 0, 1, 2, 3, 25, 26, 27, 24],
    ),
    // 4: DFr
    (
        [3, 2, 1, 0, 6, 7, 4, 5, 9, 8, 11, 10],
        [3, 2, 1, 0, 6, 7, 4, 5, 9, 8, 11, 10],
    ),
    // 5: DLr
    (
        [6, 7, 4, 5, 2, 3, 0, 1, 26, 25, 24, 27],
        [6, 7, 4, 5, 2, 3, 0, 1, 26, 25, 24, 27],
    ),
    // 6: DBr
    (
        [2, 3, 0, 1, 7, 6, 5, 4, 11, 10, 9, 8],
        [2, 3, 0, 1, 7, 6, 5, 4, 11, 10, 9, 8],
    ),
    // 7: DRr
    (
        [7, 6, 5, 4, 3, 2, 1, 0, 24, 27, 26, 25],
        [7, 6, 5, 4, 3, 2, 1, 0, 24, 27, 26, 25],
    ),
    // 8: RUr
    (
        [20, 23, 22, 21, 24, 27, 26, 25, 0, 1, 2, 3],
        [8, 9, 10, 11, 16, 19, 18, 17, 20, 23, 22, 21],
    ),
    // 9: RFr
    (
        [24, 27, 26, 25, 23, 20, 21, 22, 19, 16, 17, 18],
        [25, 26, 27, 24, 21, 22, 23, 20, 16, 19, 18, 17],
    ),
    // 10: RDr
    (
        [23, 20, 21, 22, 27, 24, 25, 26, 2, 3, 0, 1],
        [10, 11, 8, 9, 17, 18, 19, 16, 21, 22, 23, 20],
    ),
    // 11: RBr
    (
        [27, 24, 25, 26, 20, 23, 22, 21, 17, 18, 19, 16],
        [27, 24, 25, 26, 20, 23, 22, 21, 17, 18, 19, 16],
    ),
    // 12: LUr
    (
        [21, 22, 23, 20, 26, 25, 24, 27, 1, 0, 3, 2],
        [9, 8, 11, 10, 19, 16, 17, 18, 22, 21, 20, 23],
    ),
    // 13: LFr
    (
        [25, 26, 27, 24, 21, 22, 23, 20, 16, 19, 18, 17],
        [24, 27, 26, 25, 23, 20, 21, 22, 19, 16, 17, 18],
    ),
    // 14: LDr
    (
        [22, 21, 20, 23, 25, 26, 27, 24, 3, 2, 1, 0],
        [11, 10, 9, 8, 18, 17, 16, 19, 23, 20, 21, 22],
    ),
    // 15: LBr
    (
        [26, 25, 24, 27, 22, 21, 20, 23, 18, 17, 16, 19],
        [26, 25, 24, 27, 22, 21, 20, 23, 18, 17, 16, 19],
    ),
    // 16: FUr
    (
        [16, 19, 18, 17, 9, 8, 11, 10, 5, 4, 7, 6],
        [16, 19, 18, 17, 9, 8, 11, 10, 5, 4, 7, 6],
    ),
    // 17: FRr
    (
        [8, 9, 10, 11, 16, 19, 18, 17, 20, 23, 22, 21],
        [20, 23, 22, 21, 24, 27, 26, 25, 0, 1, 2, 3],
    ),
    // 18: FDr
    (
        [19, 16, 17, 18, 8, 9, 10, 11, 7, 6, 5, 4],
        [17, 18, 19, 16, 11, 10, 9, 8, 4, 5, 6, 7],
    ),
    // 19: FLr
    (
        [9, 8, 11, 10, 19, 16, 17, 18, 22, 21, 20, 23],
        [21, 22, 23, 20, 26, 25, 24, 27, 1, 0, 3, 2],
    ),
    // 20: BUr
    (
        [17, 18, 19, 16, 11, 10, 9, 8, 4, 5, 6, 7],
        [19, 16, 17, 18, 8, 9, 10, 11, 7, 6, 5, 4],
    ),
    // 21: BRr
    (
        [11, 10, 9, 8, 18, 17, 16, 19, 23, 20, 21, 22],
        [22, 21, 20, 23, 25, 26, 27, 24, 3, 2, 1, 0],
    ),
    // 22: BDr
    (
        [18, 17, 16, 19, 10, 11, 8, 9, 6, 7, 4, 5],
        [18, 17, 16, 19, 10, 11, 8, 9, 6, 7, 4, 5],
    ),
    // 23: BLr
    (
        [10, 11, 8, 9, 17, 18, 19, 16, 21, 22, 23, 20],
        [23, 20, 21, 22, 27, 24, 25, 26, 2, 3, 0, 1],
    ),
    // 24: UFm
    (
        [0, 1, 2, 3, 5, 4, 7, 6, 9, 8, 11, 10],
        [0, 1, 2, 3, 5, 4, 7, 6, 9, 8, 11, 10],
    ),
    // 25: ULm
    (
        [4, 5, 6, 7, 0, 1, 2, 3, 24, 27, 26, 25],
        [4, 5, 6, 7, 0, 1, 2, 3, 24, 27, 26, 25],
    ),
    // 26: UBm
    (
        [1, 0, 3, 2, 4, 5, 6, 7, 11, 10, 9, 8],
        [1, 0, 3, 2, 4, 5, 6, 7, 11, 10, 9, 8],
    ),
    // 27: URm
    (
        [5, 4, 7, 6, 1, 0, 3, 2, 26, 25, 24, 27],
        [5, 4, 7, 6, 1, 0, 3, 2, 26, 25, 24, 27],
    ),
    // 28: DFm
    (
        [3, 2, 1, 0, 7, 6, 5, 4, 8, 9, 10, 11],
        [3, 2, 1, 0, 7, 6, 5, 4, 8, 9, 10, 11],
    ),
    // 29: DLm
    (
        [7, 6, 5, 4, 2, 3, 0, 1, 27, 24, 25, 26],
        [6, 7, 4, 5, 3, 2, 1, 0, 25, 26, 27, 24],
    ),
    // 30: DBm
    (
        [2, 3, 0, 1, 6, 7, 4, 5, 10, 11, 8, 9],
        [2, 3, 0, 1, 6, 7, 4, 5, 10, 11, 8, 9],
    ),
    // 31: DRm
    (
        [6, 7, 4, 5, 3, 2, 1, 0, 25, 26, 27, 24],
        [7, 6, 5, 4, 2, 3, 0, 1, 27, 24, 25, 26],
    ),
    // 32: RUm
    (
        [21, 22, 23, 20, 25, 26, 27, 24, 0, 1, 2, 3],
        [8, 9, 10, 11, 19, 16, 17, 18, 23, 20, 21, 22],
    ),
    // 33: RFm
    (
        [25, 26, 27, 24, 22, 21, 20, 23, 19, 16, 17, 18],
        [25, 26, 27, 24, 22, 21, 20, 23, 19, 16, 17, 18],
    ),
    // 34: RDm
    (
        [22, 21, 20, 23, 26, 25, 24, 27, 2, 3, 0, 1],
        [10, 11, 8, 9, 18, 17, 16, 19, 22, 21, 20, 23],
    ),
    // 35: RBm
    (
        [26, 25, 24, 27, 21, 22, 23, 20, 17, 18, 19, 16],
        [27, 24, 25, 26, 23, 20, 21, 22, 18, 17, 16, 19],
    ),
    // 36: LUm
    (
        [20, 23, 22, 21, 27, 24, 25, 26, 1, 0, 3, 2],
        [9, 8, 11, 10, 16, 19, 18, 17, 21, 22, 23, 20],
    ),
    // 37: LFm
    (
        [24, 27, 26, 25, 20, 23, 22, 21, 16, 19, 18, 17],
        [24, 27, 26, 25, 20, 23, 22, 21, 16, 19, 18, 17],
    ),
    // 38: LDm
    (
        [23, 20, 21, 22, 24, 27, 26, 25, 3, 2, 1, 0],
        [11, 10, 9, 8, 17, 18, 19, 16, 20, 23, 22, 21],
    ),
    // 39: LBm
    (
        [27, 24, 25, 26, 23, 20, 21, 22, 18, 17, 16, 19],
        [26, 25, 24, 27, 21, 22, 23, 20, 17, 18, 19, 16],
    ),
    // 40: FUm
    (
        [16, 19, 18, 17, 8, 9, 10, 11, 4, 5, 6, 7],
        [16, 19, 18, 17, 8, 9, 10, 11, 4, 5, 6, 7],
    ),
    // 41: FRm
    (
        [9, 8, 11, 10, 16, 19, 18, 17, 21, 22, 23, 20],
        [20, 23, 22, 21, 27, 24, 25, 26, 1, 0, 3, 2],
    ),
    // 42: FDm
    (
        [19, 16, 17, 18, 9, 8, 11, 10, 6, 7, 4, 5],
        [17, 18, 19, 16, 10, 11, 8, 9, 5, 4, 7, 6],
    ),
    // 43: FLm
    (
        [8, 9, 10, 11, 19, 16, 17, 18, 23, 20, 21, 22],
        [21, 22, 23, 20, 25, 26, 27, 24, 0, 1, 2, 3],
    ),
    // 44: BUm
    (
        [17, 18, 19, 16, 10, 11, 8, 9, 5, 4, 7, 6],
        [19, 16, 17, 18, 9, 8, 11, 10, 6, 7, 4, 5],
    ),
    // 45: BRm
    (
        [10, 11, 8, 9, 18, 17, 16, 19, 22, 21, 20, 23],
        [22, 21, 20, 23, 26, 25, 24, 27, 2, 3, 0, 1],
    ),
    // 46: BDm
    (
        [18, 17, 16, 19, 11, 10, 9, 8, 7, 6, 5, 4],
        [18, 17, 16, 19, 11, 10, 9, 8, 7, 6, 5, 4],
    ),
    // 47: BLm
    (
        [11, 10, 9, 8, 17, 18, 19, 16, 20, 23, 22, 21],
        [23, 20, 21, 22, 24, 27, 26, 25, 3, 2, 1, 0],
    ),
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_eo_folds_match_original_formula_at_u64_boundaries() {
        let maximum_orbit = crate::h48_variant::NO_EO_ENTRIES - 1;
        for variant in H48Variant::ALL {
            for orbit in [0, 1, 34_649, 34_650, maximum_orbit] {
                for eo in 0..2048 {
                    let full = orbit * 2048 + u64::from(eo);
                    let index = fold_coordinate(orbit, eo, variant);
                    assert_eq!(index, full >> (11 - variant.h()));
                    assert!(index < variant.main_entries());
                    if variant.h() == 0 {
                        assert_eq!(index, orbit);
                    }
                    if variant.h() == 11 {
                        assert_eq!(index, full);
                    }
                }
            }
            assert_eq!(
                fold_coordinate(maximum_orbit, 2047, variant),
                variant.main_entries() - 1
            );
        }
    }

    #[test]
    fn all_variants_fast_scalar_and_h10_facade_agree_without_tables() {
        for scramble in [
            "",
            "U",
            "R U F2",
            "R U R' U' F2 D B L2",
            "B2 D' L F' U2 R D2",
        ] {
            let cube = Cube::from_scramble(scramble).unwrap();
            for cube in [cube, cube.inverse()] {
                let state = H48State::from_cube(&cube);
                let old_api = crate::h10_coord::H10State::from_cube(&cube);
                for symmetry in 0u8..48 {
                    // Synthetic valid metadata checks folding and all 48 local
                    // transforms; it does not claim to select the true COCSEP class.
                    for class in [0, CORNER_CLASSES - 1] {
                        let cdata = (class << 16) | (u32::from(symmetry) << 8);
                        for variant in H48Variant::ALL {
                            let index = state.main_index(cdata, variant);
                            assert_eq!(index, state.main_index_scalar(cdata, variant));
                            assert!(index < variant.main_entries());
                            if variant == H48Variant::H10 {
                                assert_eq!(index, old_api.main_index(cdata));
                                assert_eq!(index, old_api.main_index_scalar(cdata));
                            }
                        }
                    }
                    let edata = ((ESEP_CLASSES - 1) << 16) | (u32::from(symmetry) << 8);
                    assert_eq!(state.eoesep_index(edata), state.eoesep_index_scalar(edata));
                    assert!(state.eoesep_index(edata) < EOESEP_ENTRIES);
                }
            }
        }
    }

    #[test]
    fn all_34650_edge_groupings_match_original_rank() {
        let mut seen = [false; ESEP_ENTRIES as usize];
        let mut cases = 0;
        for outer in 0u16..4096 {
            if outer.count_ones() != 4 {
                continue;
            }
            for inner in 0u16..256 {
                if inner.count_ones() != 4 {
                    continue;
                }
                let mut edges = [0; 12];
                let (mut low, mut middle, mut high, mut position) = (0, 4, 8, 0);
                for (i, edge) in edges.iter_mut().enumerate() {
                    *edge = if outer & (1 << i) != 0 {
                        let result = high;
                        high += 1;
                        result
                    } else {
                        let result = if inner & (1 << position) != 0 {
                            let result = middle;
                            middle += 1;
                            result
                        } else {
                            let result = low;
                            low += 1;
                            result
                        };
                        position += 1;
                        result
                    };
                }
                let expected = edge_separation_scalar(&edges);
                assert_eq!(edge_separation_lut(&edges), expected);
                assert_eq!(edge_separation(&edges), expected);
                #[cfg(target_arch = "aarch64")]
                unsafe {
                    assert_eq!(edge_separation_neon(load_edges_neon(&edges)), expected);
                }
                assert!(!seen[expected as usize]);
                seen[expected as usize] = true;
                cases += 1;
            }
        }
        assert_eq!(cases, 34_650);
        assert!(seen.iter().all(|&value| value));
        assert_eq!(std::mem::size_of_val(&SEPARATION), 8184);
        #[cfg(target_arch = "aarch64")]
        assert_eq!(std::mem::size_of_val(&EDGE_TRANSFORMS_NEON), 1536);
    }

    #[test]
    fn all_2048_eo_values_match_and_do_not_change_group_rank() {
        for eo in 0u32..2048 {
            let mut edges = std::array::from_fn(|i| i as u8);
            for (i, edge) in edges.iter_mut().enumerate().skip(1) {
                *edge |= (((eo >> (i - 1)) & 1) as u8) << 4;
            }
            edges[0] |= ((eo.count_ones() & 1) as u8) << 4;
            assert_eq!(edge_orientation_scalar(&edges), eo);
            assert_eq!(edge_orientation(&edges), eo);
            assert_eq!(edge_separation_lut(&edges), 0);
            #[cfg(target_arch = "aarch64")]
            unsafe {
                let vector = load_edges_neon(&edges);
                assert_eq!(edge_orientation_neon(vector), eo);
                assert_eq!(edge_separation_neon(vector), 0);
            }
        }
    }

    #[test]
    fn all_transform_lane_values_match_scalar() {
        // A transformed lane reads exactly one source lane. Exhaust every
        // symmetry/source position/identity/flip; this checks the local map
        // for all permutations and orientations without their Cartesian product.
        let mut cases = 0;
        for symmetry in 0..48 {
            for position in 0..12 {
                for identity in 0..12 {
                    for flip in 0..2 {
                        let mut state = H48State::from_cube(&Cube::SOLVED);
                        state.edges[position] = identity | (flip << 4);
                        let expected = state.transformed_edges_scalar(symmetry);
                        assert_eq!(state.transformed_edges(symmetry), expected);
                        #[cfg(target_arch = "aarch64")]
                        unsafe {
                            use std::arch::aarch64::*;
                            let vector =
                                transform_edges_neon(load_edges_neon(&state.edges), symmetry);
                            let mut actual = [0; 16];
                            vst1q_u8(actual.as_mut_ptr(), vector);
                            assert_eq!(&actual[..12], &expected);
                        }
                        cases += 1;
                    }
                }
            }
        }
        assert_eq!(cases, 13_824);
    }
}
