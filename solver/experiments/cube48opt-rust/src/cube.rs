//! Cubie arithmetic recovered from cube48opt1.wasm, not from nissy.
//!
//! WASM functions 89/90 multiply, 94 moves, 40 makes the inverse half of
//! fastcube. The six generators below are the original .rodata bytes at
//! linear-memory addresses 4028, 4048, 4068, 4088, 4108, 4128.

#[cfg(target_arch = "x86_64")]
#[path = "cube_x86.rs"]
mod x86;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
#[repr(C)]
pub struct Cube {
    /// At each position: identity in bits 0..2, twist in bits 3..4.
    pub corners: [u8; 8],
    /// At each position: identity in bits 1..4, flip in bit 0.
    pub edges: [u8; 12],
}

// The NEON load windows in this module and coord.rs rely on this exact layout.
const _: [(); 20] = [(); std::mem::size_of::<Cube>()];

/// Explicit owned storage for a whole edge SIMD vector. This is deliberately
/// separate from Cube: coordinates, serialization, ABI and native production
/// keep their 20-byte state. No SIMD access derives from a Cube subobject.
#[cfg(all(feature = "wasm-padded-state", any(target_family = "wasm", test)))]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(C)]
pub(crate) struct PaddedCube {
    cube: Cube,
    padding: [u8; 4],
}

#[cfg(all(feature = "wasm-padded-state", any(target_family = "wasm", test)))]
const _: () = {
    assert!(std::mem::size_of::<PaddedCube>() == 24);
    assert!(std::mem::offset_of!(PaddedCube, cube) == 0);
    assert!(std::mem::offset_of!(Cube, edges) == 8);
    assert!(std::mem::offset_of!(PaddedCube, padding) == 20);
};

#[cfg(all(feature = "wasm-padded-state", any(target_family = "wasm", test)))]
impl From<Cube> for PaddedCube {
    #[inline(always)]
    fn from(cube: Cube) -> Self { Self { cube, padding: [0; 4] } }
}

#[cfg(all(feature = "wasm-padded-state", any(target_family = "wasm", test)))]
impl From<PaddedCube> for Cube {
    #[inline(always)]
    fn from(padded: PaddedCube) -> Self { padded.cube }
}

#[cfg(all(feature = "wasm-padded-state", any(target_family = "wasm", test)))]
impl std::ops::Deref for PaddedCube {
    type Target = Cube;
    #[inline(always)]
    fn deref(&self) -> &Cube { &self.cube }
}

#[cfg(all(feature = "wasm-padded-state", any(target_family = "wasm", test)))]
impl PartialEq<Cube> for PaddedCube {
    fn eq(&self, other: &Cube) -> bool { self.cube == *other && self.padding == [0; 4] }
}

#[cfg(all(feature = "wasm-padded-state", any(target_family = "wasm", test)))]
#[inline]
pub(crate) fn moved_pair_padded(cube: &PaddedCube, inverse: &PaddedCube, movement: u8) -> (PaddedCube, PaddedCube) {
    #[cfg(all(target_family = "wasm", target_feature = "simd128"))]
    // The raw bases name the full 24-byte objects. Both [8,24) vectors are
    // in-bounds and initialized, including the explicit zero padding.
    unsafe { moved_pair_padded_wasm(cube, inverse, movement) }
    #[cfg(not(all(target_family = "wasm", target_feature = "simd128")))]
    {
        let (normal, inverse) = moved_pair(cube, inverse, movement);
        (normal.into(), inverse.into())
    }
}

/// Bounded ABI/SIMD fixture used with real WASM, without any pruning table.
/// Scalar group multiplication is the independent arithmetic reference.
#[cfg(all(feature = "wasm-padded-state", any(target_family = "wasm", test)))]
pub fn verify_padded_move_products(cube: &Cube) -> bool {
    let inverse = cube.inverse();
    let normal: PaddedCube = (*cube).into();
    let opposite: PaddedCube = inverse.into();
    for movement in 0..18 {
        let (a, b) = moved_pair_padded(&normal, &opposite, movement);
        if a != cube.moved(movement) || b != inverse.premoved(movement)
            || b != a.inverse() { return false; }
        // A subsequent move after an NISS side swap reads padding produced by
        // the first SIMD operation, rather than just freshly zeroed roots.
        let next = (movement + 7) % 18;
        let (c, d) = moved_pair_padded(&b, &a, next);
        if c != b.moved(next) || d != a.premoved(next) || d != c.inverse() {
            return false;
        }
        let (restored, restored_inverse) = moved_pair_padded(&a, &b, inverse_move(movement));
        if restored != *cube || restored_inverse != inverse { return false; }
    }
    true
}

pub const MOVE_NAMES: [&str; 18] = [
    "U", "U2", "U'", "R", "R2", "R'", "F", "F2", "F'", "D", "D2", "D'", "L", "L2", "L'", "B", "B2",
    "B'",
];

const QUARTERS: [Cube; 6] = [
    Cube {
        corners: [7, 6, 2, 3, 4, 5, 0, 1],
        edges: [9, 15, 4, 6, 3, 10, 12, 1, 16, 18, 20, 22],
    },
    Cube {
        corners: [20, 1, 2, 23, 11, 5, 6, 8],
        edges: [0, 2, 4, 6, 17, 23, 12, 14, 11, 18, 20, 9],
    },
    Cube {
        corners: [14, 1, 12, 3, 16, 5, 18, 7],
        edges: [19, 2, 4, 17, 8, 10, 12, 14, 1, 7, 20, 22],
    },
    Cube {
        corners: [0, 1, 5, 4, 2, 3, 6, 7],
        edges: [0, 2, 11, 13, 8, 7, 5, 14, 16, 18, 20, 22],
    },
    Cube {
        corners: [0, 21, 22, 3, 4, 10, 9, 7],
        edges: [0, 2, 4, 6, 8, 10, 19, 21, 16, 15, 13, 22],
    },
    Cube {
        corners: [0, 15, 2, 13, 4, 17, 6, 19],
        edges: [0, 23, 21, 6, 8, 10, 12, 14, 16, 18, 3, 5],
    },
];

const fn make_moves() -> [Cube; 18] {
    let mut moves = [Cube::SOLVED; 18];
    let mut face = 0;
    while face < 6 {
        moves[face * 3] = QUARTERS[face];
        moves[face * 3 + 1] = QUARTERS[face].multiplied(&QUARTERS[face]);
        moves[face * 3 + 2] = moves[face * 3 + 1].multiplied(&QUARTERS[face]);
        face += 1;
    }
    moves
}

pub const MOVES: [Cube; 18] = make_moves();

pub const fn inverse_move(m: u8) -> u8 {
    (m / 3) * 3 + 2 - m % 3
}

/// Advance a legal cube and its inverse together: (g*m, m^-1*g^-1).
/// The default neon-moves feature enables NEON on AArch64; builds without
/// that feature retain scalar moves on AArch64. Native x86 selects AVX2 or
/// AVX-512 when supported, with a scalar fallback; WASM keeps its SIMD path.
/// Both implementations preserve move order and the remaining search state.
#[inline]
pub fn moved_pair(cube: &Cube, inverse: &Cube, movement: u8) -> (Cube, Cube) {
    #[cfg(target_arch = "x86_64")]
    match crate::x86_simd::selected() {
        crate::x86_simd::Backend::Avx2 => return unsafe { x86::moved_pair_avx2(cube, inverse, movement) },
        crate::x86_simd::Backend::Avx512 => return unsafe { x86::moved_pair_avx512(cube, inverse, movement) },
        crate::x86_simd::Backend::Scalar => {},
    }
    #[cfg(all(feature = "neon-moves", target_arch = "aarch64"))]
    // AArch64 always provides NEON. All loads/stores stay within their objects;
    // the byte-table indices do not become memory addresses.
    unsafe {
        moved_pair_neon(cube, inverse, movement)
    }
    #[cfg(all(target_family = "wasm", target_feature = "simd128"))]
    unsafe {
        moved_pair_wasm(cube, inverse, movement)
    }
    #[cfg(not(any(all(feature = "neon-moves", target_arch = "aarch64"), all(target_family = "wasm", target_feature = "simd128"))))]
    (cube.moved(movement), inverse.premoved(movement))
}

/// The isolated WASM lazy-state path evaluates the inverse child first. Both
/// helpers compute exactly the same group products as moved_pair, separately.
#[cfg(all(feature = "wasm-lazy-normal", any(target_family = "wasm", test)))]
#[inline(always)]
pub(crate) fn moved_normal(cube: &Cube, movement: u8) -> Cube {
    #[cfg(all(target_family = "wasm", target_feature = "simd128"))]
    unsafe { moved_single_wasm::<false>(cube, movement) }
    #[cfg(not(all(target_family = "wasm", target_feature = "simd128")))]
    cube.moved(movement)
}

#[cfg(all(feature = "wasm-lazy-normal", any(target_family = "wasm", test)))]
#[inline(always)]
pub(crate) fn moved_inverse(inverse: &Cube, movement: u8) -> Cube {
    #[cfg(all(target_family = "wasm", target_feature = "simd128"))]
    unsafe { moved_single_wasm::<true>(inverse, movement) }
    #[cfg(not(all(target_family = "wasm", target_feature = "simd128")))]
    inverse.premoved(movement)
}

/// Bounded fixture hook for the actual WASM SIMD implementation. The adapter
/// calls this only from its small-table verification export, never the search.
#[cfg(all(feature = "wasm-lazy-normal", any(target_family = "wasm", test)))]
pub fn verify_deferred_move_products(cube: &Cube) -> bool {
    let inverse = cube.inverse();
    (0..18).all(|movement| {
        let normal = moved_normal(cube, movement);
        let opposite = moved_inverse(&inverse, movement);
        let paired = moved_pair(cube, &inverse, movement);
        normal == cube.moved(movement) && opposite == inverse.premoved(movement)
            && (normal, opposite) == paired && opposite == normal.inverse()
    })
}

#[cfg(all(feature = "wasm-lazy-normal", target_family = "wasm", target_feature = "simd128"))]
#[inline(always)]
unsafe fn moved_single_wasm<const LEFT: bool>(cube: &Cube, movement: u8) -> Cube {
    #[cfg(target_arch = "wasm32")]
    use std::arch::wasm32::*;
    #[cfg(target_arch = "wasm64")]
    use std::arch::wasm64::*;
    let movement = &PAIRED_MOVES[usize::from(movement)];
    let corners = v128_load64_zero(cube.corners.as_ptr().cast::<u64>());
    let move_corners = v128_load64_zero(movement.as_ptr().add(if LEFT { 8 } else { 0 }).cast::<u64>());
    let (source, rhs) = if LEFT { (move_corners, corners) } else { (corners, move_corners) };
    let corners = i8x16_add(i8x16_swizzle(source, v128_and(rhs, u8x16_splat(7))), v128_and(rhs, u8x16_splat(24)));
    let corners = u8x16_min(corners, i8x16_add(corners, u8x16_splat(232)));
    let tail = v128_load((cube as *const Cube).cast::<u8>().add(4).cast::<v128>());
    let edges = i8x16_shuffle::<4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19>(tail, u8x16_splat(0));
    let move_edges = v128_load(movement.as_ptr().add(if LEFT { 32 } else { 16 }).cast::<v128>());
    let (source, rhs) = if LEFT { (move_edges, edges) } else { (edges, move_edges) };
    let edges = v128_xor(i8x16_swizzle(source, u8x16_shr(rhs, 1)), v128_and(rhs, u8x16_splat(1)));
    let mut result = Cube::SOLVED;
    v128_store64_lane::<0>(corners, result.corners.as_mut_ptr().cast::<u64>());
    v128_store64_lane::<0>(edges, result.edges.as_mut_ptr().cast::<u64>());
    v128_store32_lane::<2>(edges, result.edges.as_mut_ptr().add(8).cast::<u32>());
    result
}

// Same three 16-byte blocks as original fast-move table at address 30016:
// normal/inverse corners, normal edges, inverse edges. Four padding bytes per
// edge block are zero. The six physical generators remain the single source.
#[cfg(any(target_arch = "x86_64", all(feature = "neon-moves", target_arch = "aarch64"), all(target_family = "wasm", target_feature = "simd128")))]
const PAIRED_MOVES: [[u8; 48]; 18] = {
    let mut result = [[0; 48]; 18];
    let mut m = 0;
    while m < 18 {
        let movement = MOVES[m];
        let inverse = MOVES[inverse_move(m as u8) as usize];
        let mut i = 0;
        while i < 8 {
            result[m][i] = movement.corners[i];
            result[m][8 + i] = inverse.corners[i];
            i += 1;
        }
        i = 0;
        while i < 12 {
            result[m][16 + i] = movement.edges[i];
            result[m][32 + i] = inverse.edges[i];
            i += 1;
        }
        m += 1;
    }
    result
};

/// One paired corner shuffle and two edge shuffles, equivalent to the NEON
/// implementation and the original WASM fast-move representation. Only the
/// fixed move table uses padding; all Cube loads and stores remain in-bounds.
#[cfg(all(target_family = "wasm", target_feature = "simd128"))]
#[inline]
unsafe fn moved_pair_wasm(cube: &Cube, inverse: &Cube, movement: u8) -> (Cube, Cube) {
    #[cfg(target_arch = "wasm32")]
    use std::arch::wasm32::*;
    #[cfg(target_arch = "wasm64")]
    use std::arch::wasm64::*;

    let movement = &PAIRED_MOVES[movement as usize];
    let corner_source = v128_load64_lane::<1>(
        v128_load64_zero(cube.corners.as_ptr().cast::<u64>()),
        movement.as_ptr().add(8).cast::<u64>(),
    );
    let corner_rhs = v128_load64_lane::<1>(
        v128_load64_zero(movement.as_ptr().cast::<u64>()),
        inverse.corners.as_ptr().cast::<u64>(),
    );
    let corner_indices = v128_or(v128_and(corner_rhs, u8x16_splat(7)), u8x16(0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 8));
    let corners = i8x16_add(i8x16_swizzle(corner_source, corner_indices), v128_and(corner_rhs, u8x16_splat(24)));
    let corners = u8x16_min(corners, i8x16_add(corners, u8x16_splat(232)));
    let normal_tail = v128_load((cube as *const Cube).cast::<u8>().add(4).cast::<v128>());
    let inverse_tail = v128_load((inverse as *const Cube).cast::<u8>().add(4).cast::<v128>());
    let normal_edges = i8x16_shuffle::<4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19>(normal_tail, u8x16_splat(0));
    let inverse_edges = i8x16_shuffle::<4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19>(inverse_tail, u8x16_splat(0));
    let move_edges = v128_load(movement.as_ptr().add(16).cast::<v128>());
    let inverse_move_edges = v128_load(movement.as_ptr().add(32).cast::<v128>());
    let normal_edges = v128_xor(i8x16_swizzle(normal_edges, u8x16_shr(move_edges, 1)), v128_and(move_edges, u8x16_splat(1)));
    let inverse_edges = v128_xor(i8x16_swizzle(inverse_move_edges, u8x16_shr(inverse_edges, 1)), v128_and(inverse_edges, u8x16_splat(1)));
    let mut normal = Cube::SOLVED;
    let mut inverse = Cube::SOLVED;
    v128_store64_lane::<0>(corners, normal.corners.as_mut_ptr().cast::<u64>());
    v128_store64_lane::<1>(corners, inverse.corners.as_mut_ptr().cast::<u64>());
    v128_store64_lane::<0>(normal_edges, normal.edges.as_mut_ptr().cast::<u64>());
    v128_store64_lane::<0>(inverse_edges, inverse.edges.as_mut_ptr().cast::<u64>());
    v128_store32_lane::<2>(normal_edges, normal.edges.as_mut_ptr().add(8).cast::<u32>());
    v128_store32_lane::<2>(inverse_edges, inverse.edges.as_mut_ptr().add(8).cast::<u32>());
    (normal, inverse)
}

/// Same group products as moved_pair_wasm, with complete owned edge vectors.
/// Only search frames opt into this layout; the original Cube path is intact.
#[cfg(all(feature = "wasm-padded-state", target_family = "wasm", target_feature = "simd128"))]
#[inline]
unsafe fn moved_pair_padded_wasm(cube: &PaddedCube, inverse: &PaddedCube, movement: u8) -> (PaddedCube, PaddedCube) {
    #[cfg(target_arch = "wasm32")]
    use std::arch::wasm32::*;
    #[cfg(target_arch = "wasm64")]
    use std::arch::wasm64::*;

    let movement = &PAIRED_MOVES[movement as usize];
    let corner_source = v128_load64_lane::<1>(
        v128_load64_zero(cube.corners.as_ptr().cast::<u64>()),
        movement.as_ptr().add(8).cast::<u64>(),
    );
    let corner_rhs = v128_load64_lane::<1>(
        v128_load64_zero(movement.as_ptr().cast::<u64>()),
        inverse.corners.as_ptr().cast::<u64>(),
    );
    let corner_indices = v128_or(v128_and(corner_rhs, u8x16_splat(7)), u8x16(0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 8));
    let corners = i8x16_add(i8x16_swizzle(corner_source, corner_indices), v128_and(corner_rhs, u8x16_splat(24)));
    let corners = u8x16_min(corners, i8x16_add(corners, u8x16_splat(232)));
    // Pointer provenance is the complete PaddedCube, never &cube.cube/edges.
    let normal_edges = v128_load((cube as *const PaddedCube).cast::<u8>().add(8).cast::<v128>());
    let inverse_edges = v128_load((inverse as *const PaddedCube).cast::<u8>().add(8).cast::<v128>());
    let move_edges = v128_load(movement.as_ptr().add(16).cast::<v128>());
    let inverse_move_edges = v128_load(movement.as_ptr().add(32).cast::<v128>());
    let normal_edges = v128_xor(i8x16_swizzle(normal_edges, u8x16_shr(move_edges, 1)), v128_and(move_edges, u8x16_splat(1)));
    let inverse_edges = v128_xor(i8x16_swizzle(inverse_move_edges, u8x16_shr(inverse_edges, 1)), v128_and(inverse_edges, u8x16_splat(1)));
    // Dummy lanes are not cubies. Mask them before the whole-vector store so
    // copies, NISS swaps and subsequent moves preserve canonical zero bytes.
    let edge_mask = u8x16(255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0);
    let mut normal = PaddedCube::from(Cube::SOLVED);
    let mut inverse = PaddedCube::from(Cube::SOLVED);
    v128_store64_lane::<0>(corners, normal.cube.corners.as_mut_ptr().cast::<u64>());
    v128_store64_lane::<1>(corners, inverse.cube.corners.as_mut_ptr().cast::<u64>());
    v128_store((&mut normal as *mut PaddedCube).cast::<u8>().add(8).cast::<v128>(), v128_and(normal_edges, edge_mask));
    v128_store((&mut inverse as *mut PaddedCube).cast::<u8>().add(8).cast::<v128>(), v128_and(inverse_edges, edge_mask));
    (normal, inverse)
}

/// Original step4_domove (WASM func43): one paired corner shuffle and two
/// edge shuffles. Unlike the original packed fastcube, Cube is only 20 bytes.
#[cfg(all(feature = "neon-moves", target_arch = "aarch64"))]
#[inline]
unsafe fn moved_pair_neon(cube: &Cube, inverse: &Cube, movement: u8) -> (Cube, Cube) {
    use std::arch::aarch64::*;
    // Bounds-check before taking pointers; invalid movements fail as before.
    let movement = &PAIRED_MOVES[movement as usize];
    let corner_source = vcombine_u8(
        vld1_u8(cube.corners.as_ptr()),
        vld1_u8(movement.as_ptr().add(8)),
    );
    let corner_rhs = vcombine_u8(
        vld1_u8(movement.as_ptr()),
        vld1_u8(inverse.corners.as_ptr()),
    );
    let corner_indices = vorrq_u8(
        vandq_u8(corner_rhs, vdupq_n_u8(7)),
        vcombine_u8(vdup_n_u8(0), vdup_n_u8(8)),
    );
    let corners = vaddq_u8(
        vqtbl1q_u8(corner_source, corner_indices),
        vandq_u8(corner_rhs, vdupq_n_u8(24)),
    );
    // Legal input twist sums are 0..4, so every byte is 0..39. Subtracting
    // 24 wraps to 232..255 below 24; unsigned min implements twist mod 3.
    let corners = vminq_u8(corners, vaddq_u8(corners, vdupq_n_u8(232)));

    // repr(C) Cube contains exactly 20 bytes. Load bytes 4..20 and discard
    // the first four corner bytes; never read 16 bytes from a 12-byte edge.
    let normal_edges = vextq_u8::<4>(
        vld1q_u8((cube as *const Cube).cast::<u8>().add(4)),
        vdupq_n_u8(0),
    );
    let inverse_edges = vextq_u8::<4>(
        vld1q_u8((inverse as *const Cube).cast::<u8>().add(4)),
        vdupq_n_u8(0),
    );
    let move_edges = vld1q_u8(movement.as_ptr().add(16));
    let inverse_move_edges = vld1q_u8(movement.as_ptr().add(32));
    let normal_edges = veorq_u8(
        vqtbl1q_u8(normal_edges, vshrq_n_u8::<1>(move_edges)),
        vandq_u8(move_edges, vdupq_n_u8(1)),
    );
    let inverse_edges = veorq_u8(
        vqtbl1q_u8(inverse_move_edges, vshrq_n_u8::<1>(inverse_edges)),
        vandq_u8(inverse_edges, vdupq_n_u8(1)),
    );

    let mut normal = Cube::SOLVED;
    let mut inverse = Cube::SOLVED;
    vst1_u8(normal.corners.as_mut_ptr(), vget_low_u8(corners));
    vst1_u8(inverse.corners.as_mut_ptr(), vget_high_u8(corners));
    vst1_u8(normal.edges.as_mut_ptr(), vget_low_u8(normal_edges));
    vst1_u8(inverse.edges.as_mut_ptr(), vget_low_u8(inverse_edges));
    normal.edges[8..12]
        .copy_from_slice(&vgetq_lane_u32::<2>(vreinterpretq_u32_u8(normal_edges)).to_ne_bytes());
    inverse.edges[8..12]
        .copy_from_slice(&vgetq_lane_u32::<2>(vreinterpretq_u32_u8(inverse_edges)).to_ne_bytes());
    (normal, inverse)
}

impl Cube {
    pub const SOLVED: Self = Self {
        corners: [0, 1, 2, 3, 4, 5, 6, 7],
        edges: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22],
    };

    pub const fn solved() -> Self {
        Self::SOLVED
    }

    /// Product self * rhs: rhs maps a destination to its source position.
    /// This routine is for legal cube states, not mirrored symmetry cubies.
    pub const fn multiplied(&self, rhs: &Self) -> Self {
        let mut product = Self::SOLVED;
        let mut i = 0;
        while i < 8 {
            let b = rhs.corners[i];
            let a = self.corners[(b & 7) as usize];
            product.corners[i] = (a & 7) | (((a >> 3) + (b >> 3)) % 3) << 3;
            i += 1;
        }
        i = 0;
        while i < 12 {
            let b = rhs.edges[i];
            product.edges[i] = self.edges[(b >> 1) as usize] ^ (b & 1);
            i += 1;
        }
        product
    }

    #[inline]
    pub fn moved(&self, m: u8) -> Self {
        self.multiplied(&MOVES[m as usize])
    }

    /// Inverse move on the left: (g * m)^-1 = m^-1 * g^-1.
    #[inline]
    pub fn premoved(&self, m: u8) -> Self {
        MOVES[inverse_move(m) as usize].multiplied(self)
    }

    #[inline]
    pub fn inverse(&self) -> Self {
        let mut inverse = Self::SOLVED;
        for (position, &corner) in self.corners.iter().enumerate() {
            inverse.corners[(corner & 7) as usize] =
                position as u8 | ((3 - (corner >> 3)) % 3) << 3;
        }
        for (position, &edge) in self.edges.iter().enumerate() {
            inverse.edges[(edge >> 1) as usize] = (position as u8) << 1 | (edge & 1);
        }
        inverse
    }

    #[inline]
    pub fn is_solved(&self) -> bool {
        *self == Self::SOLVED
    }

    pub fn to_bytes(&self) -> [u8; 20] {
        let mut bytes = [0; 20];
        bytes[..8].copy_from_slice(&self.corners);
        bytes[8..].copy_from_slice(&self.edges);
        bytes
    }

    /// Mirrors the 48-byte fastcube payload; padding is deterministically zero.
    pub fn to_fast_bytes(&self) -> [u8; 48] {
        let inverse = self.inverse();
        let mut bytes = [0; 48];
        bytes[..8].copy_from_slice(&self.corners);
        bytes[8..16].copy_from_slice(&inverse.corners);
        bytes[16..28].copy_from_slice(&self.edges);
        bytes[32..44].copy_from_slice(&inverse.edges);
        bytes
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, String> {
        if bytes.len() != 20 {
            return Err("cube48opt state must contain 20 bytes".into());
        }
        let mut cube = Self::SOLVED;
        cube.corners.copy_from_slice(&bytes[..8]);
        cube.edges.copy_from_slice(&bytes[8..]);
        cube.validate()?;
        Ok(cube)
    }

    pub fn validate(&self) -> Result<(), String> {
        let mut corner_mask = 0u16;
        let mut edge_mask = 0u16;
        let mut twist = 0;
        let mut flip = 0;
        for &c in &self.corners {
            if c >= 24 {
                return Err("invalid cube48opt corner byte".into());
            }
            corner_mask |= 1 << (c & 7);
            twist += c >> 3;
        }
        for &e in &self.edges {
            if e >= 24 {
                return Err("invalid cube48opt edge byte".into());
            }
            edge_mask |= 1 << (e >> 1);
            flip ^= e & 1;
        }
        if corner_mask != 255 || edge_mask != 4095 || twist % 3 != 0 || flip != 0 {
            return Err("invalid cube48opt piece permutation/orientation".into());
        }
        let mut parity = 0;
        for i in 0..8 {
            for j in i + 1..8 {
                parity ^= ((self.corners[i] & 7) > (self.corners[j] & 7)) as u8;
            }
        }
        for i in 0..12 {
            for j in i + 1..12 {
                parity ^= ((self.edges[i] >> 1) > (self.edges[j] >> 1)) as u8;
            }
        }
        if parity != 0 {
            return Err("corner/edge permutation parity differs".into());
        }
        Ok(())
    }

    pub fn from_scramble(scramble: &str) -> Result<Self, String> {
        let mut cube = Self::SOLVED;
        for token in scramble.split_whitespace() {
            let m = MOVE_NAMES
                .iter()
                .position(|&name| name == token)
                .ok_or_else(|| format!("invalid HTM move: {token}"))?;
            cube = cube.moved(m as u8);
        }
        Ok(cube)
    }
}
