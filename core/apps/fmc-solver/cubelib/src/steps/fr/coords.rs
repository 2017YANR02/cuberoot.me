use crate::cube::*;
use crate::steps::coord::Coord;

#[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
pub struct FREdgesCoord(pub(crate) u8);

#[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
pub struct FRCPOrbitCoord(pub(crate) u8);

//Coordinate representing the orbit parity state in floppy reduction
#[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
pub struct FROrbitParityCoord(pub(crate) bool);

#[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
pub struct FRUDNoSliceCoord(pub(crate) u16);

#[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
pub struct FRSliceEdgesCoord(pub(crate) u8);

#[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
pub struct FRUDWithSliceCoord(pub(crate) u16);

impl Coord<64> for FREdgesCoord {
    fn val(&self) -> usize {
        self.0 as usize
    }
}

impl Into<usize> for FREdgesCoord {
    fn into(self) -> usize {
        self.0 as usize
    }
}

impl Coord<4> for FRCPOrbitCoord {
    fn val(&self) -> usize {
        self.0 as usize
    }
}

impl Into<usize> for FRCPOrbitCoord {
    fn into(self) -> usize {
        self.0 as usize
    }
}

impl Coord<2> for FROrbitParityCoord {
    fn val(&self) -> usize {
        self.0 as usize
    }
}

impl Into<usize> for FROrbitParityCoord {
    fn into(self) -> usize {
        self.0 as usize
    }
}

pub const FRUD_NO_SLICE_SIZE: usize = 2 * 4 * 64;
impl Coord<FRUD_NO_SLICE_SIZE> for FRUDNoSliceCoord {
    fn val(&self) -> usize {
        self.0 as usize
    }
}

impl Into<usize> for FRUDNoSliceCoord {
    fn into(self) -> usize {
        self.0 as usize
    }
}

//Actually only 12 possible values, but that'd be harder to compute
impl Coord<16> for FRSliceEdgesCoord {
    fn val(&self) -> usize {
        self.0 as usize
    }
}

impl Into<usize> for FRSliceEdgesCoord {
    fn into(self) -> usize {
        self.0 as usize
    }
}

pub const FRUD_WITH_SLICE_SIZE: usize = FRUD_NO_SLICE_SIZE * 16;
impl Coord<FRUD_WITH_SLICE_SIZE> for FRUDWithSliceCoord {
    fn val(&self) -> usize {
        self.0 as usize
    }
}

impl Into<usize> for FRUDWithSliceCoord {
    fn into(self) -> usize {
        self.0 as usize
    }
}



impl From<&EdgeCube333> for FREdgesCoord {
    #[inline]
    #[cfg(target_feature = "avx2")]
    fn from(value: &EdgeCube333) -> Self {
        unsafe { avx2::unsafe_from_fr_edges_coord(value) }
    }

    #[inline]
    #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
    fn from(value: &EdgeCube333) -> Self {
        wasm32::from_fr_edges_coord(value)
    }

    #[inline]
    #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
    fn from(value: &EdgeCube333) -> Self {
        unsafe { neon::unsafe_from_fr_edges_coord(value) }
    }
}

impl From<&CornerCube333> for FRCPOrbitCoord {
    #[inline]
    #[cfg(target_feature = "avx2")]
    fn from(value: &CornerCube333) -> Self {
        unsafe { avx2::unsafe_from_fr_cp_coord(value) }
    }

    #[inline]
    #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
    fn from(value: &CornerCube333) -> Self {
        wasm32::from_fr_cp_coord(value)
    }

    #[inline]
    #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
    fn from(value: &CornerCube333) -> Self {
        unsafe { neon::unsafe_from_fr_cp_coord(value) }
    }
}

impl From<&Cube333> for FROrbitParityCoord {
    #[inline]
    #[cfg(target_feature = "avx2")]
    fn from(value: &Cube333) -> Self {
        unsafe { avx2::unsafe_from_fr_parity_coord(value) }
    }

    #[inline]
    #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
    fn from(value: &Cube333) -> Self {
        wasm32::from_fr_parity_coord(value)
    }

    #[inline]
    #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
    fn from(value: &Cube333) -> Self {
        unsafe { neon::unsafe_from_fr_parity_coord(value) }
    }
}

impl From<&Cube333> for FRSliceEdgesCoord {
    #[inline]
    #[cfg(target_feature = "avx2")]
    fn from(value: &Cube333) -> Self {
        unsafe { avx2::unsafe_from_fr_slice_coord(value) }
    }

    #[inline]
    #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
    fn from(value: &Cube333) -> Self {
        wasm32::from_fr_slice_coord(value)
    }

    #[inline]
    #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
    fn from(value: &Cube333) -> Self {
        unsafe { neon::unsafe_from_fr_slice_coord(value) }
    }
}

impl From<&Cube333> for FRUDNoSliceCoord {
    fn from(value: &Cube333) -> Self {
        let edges = FREdgesCoord::from(&value.edges).val();
        let orbit_cp = FRCPOrbitCoord::from(&value.corners).val();
        let orbit_parity = FROrbitParityCoord::from(value).val();
        let coord = orbit_parity +
            orbit_cp * FROrbitParityCoord::size() +
            edges * FROrbitParityCoord::size() * FRCPOrbitCoord::size();
        FRUDNoSliceCoord(coord as u16)
    }
}

impl From<&Cube333> for FRUDWithSliceCoord {
    fn from(value: &Cube333) -> Self {
        let no_slice = FRUDNoSliceCoord::from(value).val();
        let slice = FRSliceEdgesCoord::from(value).val();

        let coord = slice +
            no_slice * FRSliceEdgesCoord::size();
        FRUDWithSliceCoord(coord as u16)
    }
}

#[cfg(target_feature = "avx2")]
mod avx2 {
    use std::arch::x86_64::{_mm_and_si128, _mm_broadcastb_epi8, _mm_castpd_si128, _mm_castsi128_pd, _mm_cmpeq_epi8, _mm_cmpgt_epi8, _mm_extract_epi16, _mm_movemask_epi8, _mm_or_si128, _mm_permute_pd, _mm_sad_epu8, _mm_set1_epi32, _mm_set1_epi8, _mm_setr_epi8, _mm_shuffle_epi8, _mm_srli_epi32, _mm_xor_si128};

    use crate::cube::{CornerCube333, Cube333, EdgeCube333};
    use crate::steps::fr::coords::{FRCPOrbitCoord, FREdgesCoord, FROrbitParityCoord, FRSliceEdgesCoord};

    #[target_feature(enable = "avx2")]
    #[inline]
    pub unsafe fn unsafe_from_fr_slice_coord(cube: &Cube333) -> FRSliceEdgesCoord {
        let corner_edge_mapping = _mm_setr_epi8( 0b01110000, 0b01100000, 0b01000000, 0b01010000, 0b01010000, 0b01000000, 0b01100000, 0b01110000, 0, 0, 0, 0, 0, 0, 0,0);

        let associated_edges = _mm_shuffle_epi8(corner_edge_mapping, _mm_and_si128(_mm_srli_epi32::<5>(cube.corners.0), _mm_set1_epi8(0x0F)));

        let correct_bl_edge_position = _mm_cmpeq_epi8(cube.edges.0, _mm_shuffle_epi8(associated_edges, _mm_setr_epi8( -1, -1, -1, -1, 0, 0, 0, 0, -1, -1, -1, -1, -1, -1, -1,-1)));
        let correct_br_edge_position = _mm_cmpeq_epi8(cube.edges.0, _mm_shuffle_epi8(associated_edges, _mm_setr_epi8( -1, -1, -1, -1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1,-1)));

        let bl_edge_values = _mm_and_si128(correct_bl_edge_position, _mm_setr_epi8( 0, 0, 0, 0, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0,0));
        let br_edge_values = _mm_and_si128(correct_br_edge_position, _mm_setr_epi8( 0, 0, 0, 0, 12, 8, 0, 4, 0, 0, 0, 0, 0, 0, 0,0));

        let edge_coord = _mm_sad_epu8(_mm_or_si128(bl_edge_values, br_edge_values), _mm_set1_epi8(0));
        let coord = _mm_extract_epi16::<0>(edge_coord) as u8;

        FRSliceEdgesCoord(coord)
    }

    #[target_feature(enable = "avx2")]
    #[inline]
    pub unsafe fn unsafe_from_fr_edges_coord(cube: &EdgeCube333) -> FREdgesCoord {
        let relevant_edges = _mm_shuffle_epi8(cube.0, _mm_setr_epi8( 0, 1, 2, 3, 8, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1,-1));
        let ids = _mm_and_si128(_mm_srli_epi32::<4>(relevant_edges), _mm_set1_epi8(0x0F));
        let fr_colors = _mm_shuffle_epi8(_mm_setr_epi8( 0, 1, 1, 0, -1, -1, -1, -1, 1, 1, 0, 0, -1, -1, -1,-1), ids);
        let incorrect = _mm_cmpeq_epi8(fr_colors, _mm_setr_epi8( 1, 0, 0, 1, 0, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1,-1));
        let coord = _mm_movemask_epi8(incorrect) as u8;
        FREdgesCoord(coord)
    }

    #[target_feature(enable = "avx2")]
    #[inline]
    pub unsafe fn unsafe_from_fr_cp_coord(cube: &CornerCube333) -> FRCPOrbitCoord {
        let opposites = _mm_and_si128(_mm_xor_si128(cube.0, _mm_set1_epi32(-1)), _mm_set1_epi8(0b11100000_u8 as i8));
        let all_ubl_opposite = _mm_broadcastb_epi8(opposites);
        let opposite_position = _mm_cmpeq_epi8(cube.0, all_ubl_opposite);
        let position_values = _mm_and_si128(opposite_position, _mm_setr_epi8( -1, 1, -1, 2, -1, 3, -1, 0, -1, -1, -1, -1, -1, -1, -1,-1));
        let coord = _mm_extract_epi16::<0>(_mm_sad_epu8(position_values, _mm_set1_epi8(0))) as u8;
        FRCPOrbitCoord(coord)
    }

    #[target_feature(enable = "avx2")]
    #[inline]
    pub unsafe fn unsafe_from_fr_parity_coord(cube: &Cube333) -> FROrbitParityCoord {
        let orbit_corners = _mm_shuffle_epi8(cube.corners.0, _mm_setr_epi8( 2, 4, 4, 6, 6, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1,-1));
        let slice_edges = _mm_shuffle_epi8(cube.edges.0, _mm_setr_epi8( -1, -1, -1, -1, -1, -1, -1, -1, 5, 6, 6, 7, 7, 7, -1,-1));

        let cmp_corners = _mm_shuffle_epi8(
            cube.corners.0,
            _mm_setr_epi8( 0, 0, 2, 0, 2, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1,-1),
        );
        let cmp_edges = _mm_shuffle_epi8(
            cube.edges.0,
            _mm_setr_epi8( -1, -1, -1, -1, -1, -1, -1, -1, 4, 4, 5, 4, 5, 6, -1,-1),
        );
        let cmp0 = _mm_or_si128(orbit_corners, slice_edges);
        let cmp1 = _mm_or_si128(cmp_edges, cmp_corners);
        let higher_left = _mm_and_si128(
            _mm_cmpgt_epi8(cmp0, cmp1),
            _mm_set1_epi8(1),
        );
        let added = _mm_sad_epu8(higher_left, _mm_set1_epi8(0));
        let added = _mm_xor_si128(added, _mm_castpd_si128(_mm_permute_pd::<0b11>(_mm_castsi128_pd(added))));
        let parity = _mm_extract_epi16::<0>(added) & 1;
        FROrbitParityCoord(parity == 1)
    }
}

#[cfg(target_feature = "neon")]
mod neon {
    use std::arch::aarch64::{vaddv_u8, vaddvq_u8, vand_u8, vandq_u8, vceq_u8, vcgtq_s8, vcombine_u8, vdup_lane_u8, vdup_n_u8, vdupq_n_u8, veor_u8, vget_low_u8, vorr_u8, vqtbl1_u8, vreinterpretq_s8_u8, vshr_n_u8, vtbl1_u8};

    use crate::cube::{CornerCube333, Cube333, EdgeCube333};
    use crate::steps::fr::coords::{FRCPOrbitCoord, FREdgesCoord, FROrbitParityCoord, FRSliceEdgesCoord};
    use crate::simd_util::neon::{C16, C8, extract_most_significant_bits_u8};

    pub unsafe fn unsafe_from_fr_slice_coord(cube: &Cube333) -> FRSliceEdgesCoord {
        let corner_edge_mapping = C8 { a_u8: [0b01110000, 0b01100000, 0b01000000, 0b01010000, 0b01010000, 0b01000000, 0b01100000, 0b01110000] }.a;

        let associated_edges = vtbl1_u8(corner_edge_mapping, vand_u8(vshr_n_u8::<5>(cube.corners.0), vdup_n_u8(0x0F)));

        let correct_bl_edge_position = vceq_u8(vget_low_u8(cube.edges.0), vtbl1_u8(associated_edges, C8 { a_i8: [-1, -1, -1, -1, 0, 0, 0, 0] }.a));
        let correct_br_edge_position = vceq_u8(vget_low_u8(cube.edges.0), vtbl1_u8(associated_edges, C8 { a_i8: [-1, -1, -1, -1, 1, 1, 1, 1] }.a));

        let bl_edge_values = vand_u8(correct_bl_edge_position, C8 { a_i8: [0, 0, 0, 0, 3, 2, 1, 0]}.a);
        let br_edge_values = vand_u8(correct_br_edge_position, C8 { a_i8: [0, 0, 0, 0, 12, 8, 0, 4]}.a);

        let edge_coord = vaddv_u8(vorr_u8(bl_edge_values, br_edge_values));

        FRSliceEdgesCoord(edge_coord)
    }

    pub unsafe fn unsafe_from_fr_edges_coord(cube: &EdgeCube333) -> FREdgesCoord {
        let relevant_edges = vqtbl1_u8(cube.0, C8 { a_i8: [0, 1, 2, 3, 8, 9, -1, -1]}.a);
        let ids = vand_u8(vshr_n_u8::<4>(relevant_edges), vdup_n_u8(0x0F));
        let fr_colors = vqtbl1_u8(C16 { a_i8: [0, 1, 1, 0, -1, -1, -1, -1, 1, 1, 0, 0, -1, -1, -1,-1]}.a, ids);
        let incorrect = vceq_u8(fr_colors, C8 { a_i8: [1, 0, 0, 1, 0, 0, -1, -1]}.a);
        let coord = extract_most_significant_bits_u8(incorrect);
        FREdgesCoord(coord)
    }

    pub unsafe fn unsafe_from_fr_cp_coord(cube: &CornerCube333) -> FRCPOrbitCoord {
        let opposites = vand_u8(veor_u8(cube.0, vdup_n_u8(0xFF)), vdup_n_u8(0b11100000_u8));
        let all_ubl_opposite = vdup_lane_u8::<0>(opposites);
        let opposite_position = vceq_u8(cube.0, all_ubl_opposite);
        let position_values = vand_u8(opposite_position, C8 { a_i8: [-1, 1, -1, 2, -1, 3, -1, 0]}.a);
        let coord = vaddv_u8(position_values);
        FRCPOrbitCoord(coord)
    }

    pub unsafe fn unsafe_from_fr_parity_coord(cube: &Cube333) -> FROrbitParityCoord {
        let orbit_corners = vtbl1_u8(cube.corners.0, C8 { a_i8: [2, 4, 4, 6, 6, 6, -1, -1]}.a);
        let slice_edges = vqtbl1_u8(cube.edges.0, C8 { a_i8: [5, 6, 6, 7, 7, 7, -1,-1]}.a);

        let cmp_corners = vtbl1_u8(cube.corners.0, C8 { a_i8: [0, 0, 2, 0, 2, 4, -1, -1]}.a);
        let cmp_edges = vqtbl1_u8(cube.edges.0, C8 { a_i8: [4, 4, 5, 4, 5, 6, -1,-1]}.a);

        let cmp0 = vcombine_u8(orbit_corners, slice_edges);
        let cmp1 = vcombine_u8(cmp_corners, cmp_edges);
        let higher_left = vandq_u8(
            vcgtq_s8(vreinterpretq_s8_u8(cmp0), vreinterpretq_s8_u8(cmp1)),
            vdupq_n_u8(1),
        );
        let parity = vaddvq_u8(higher_left) & 1;
        FROrbitParityCoord(parity == 1)
    }
}

#[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
mod wasm32 {
    use std::arch::wasm32::{i32x4, i8x16, u32x4_shr, u64x2, u64x2_shuffle, u8x16, u8x16_bitmask, u8x16_eq, u8x16_extract_lane, u8x16_gt, u8x16_swizzle, v128_and, v128_or, v128_xor};

    use crate::cube::{CornerCube333, Cube333, EdgeCube333};
    use crate::steps::fr::coords::{FRCPOrbitCoord, FREdgesCoord, FROrbitParityCoord, FRSliceEdgesCoord};
    use crate::wasm_util::{mm_sad_epu8, u8x16_set1};

    #[inline]
    pub fn from_fr_slice_coord(cube: &Cube333) -> FRSliceEdgesCoord {
        let corner_edge_mapping = u8x16( 0b01110000, 0b01100000, 0b01000000, 0b01010000, 0b01010000, 0b01000000, 0b01100000, 0b01110000, 0, 0, 0, 0, 0, 0, 0,0);

        let associated_edges = u8x16_swizzle(corner_edge_mapping, v128_and(u32x4_shr(cube.corners.0, 5), u8x16_set1(0x0F)));

        let correct_bl_edge_position = u8x16_eq(cube.edges.0, u8x16_swizzle(associated_edges, i8x16( -1, -1, -1, -1, 0, 0, 0, 0, -1, -1, -1, -1, -1, -1, -1,-1)));
        let correct_br_edge_position = u8x16_eq(cube.edges.0, u8x16_swizzle(associated_edges, i8x16( -1, -1, -1, -1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1,-1)));

        let bl_edge_values = v128_and(correct_bl_edge_position, u8x16( 0, 0, 0, 0, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0,0));
        let br_edge_values = v128_and(correct_br_edge_position, u8x16( 0, 0, 0, 0, 12, 8, 0, 4, 0, 0, 0, 0, 0, 0, 0,0));

        let edge_coord = mm_sad_epu8(v128_or(bl_edge_values, br_edge_values));
        let coord = u8x16_extract_lane::<0>(edge_coord);

        FRSliceEdgesCoord(coord)
    }

    #[inline]
    pub fn from_fr_edges_coord(cube: &EdgeCube333) -> FREdgesCoord {
        let relevant_edges = u8x16_swizzle(cube.0, i8x16( 0, 1, 2, 3, 8, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1,-1));
        let ids = v128_and(u32x4_shr(relevant_edges, 4), u8x16_set1(0x0F));
        let fr_colors = u8x16_swizzle(i8x16( 0, 1, 1, 0, -1, -1, -1, -1, 1, 1, 0, 0, -1, -1, -1,-1), ids);
        let incorrect = u8x16_eq(fr_colors, i8x16( 1, 0, 0, 1, 0, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1,-1));
        let coord = u8x16_bitmask(incorrect) as u8;
        FREdgesCoord(coord)
    }

    #[inline]
    pub fn from_fr_cp_coord(cube: &CornerCube333) -> FRCPOrbitCoord {
        let opposites = v128_and(v128_xor(cube.0, i32x4(-1, -1, -1, -1)), u8x16_set1(0b11100000_u8));
        let all_ubl_opposite = u8x16_swizzle(opposites, i8x16( 0, 0, 0, 0, 0, 0, 0, 0, -1, -1, -1, -1, -1, -1, -1,-1));
        let opposite_position = u8x16_eq(cube.0, all_ubl_opposite);
        let position_values = v128_and(opposite_position, i8x16( 0, 1, 0, 2, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0));
        let coord = u8x16_extract_lane::<0>(mm_sad_epu8(position_values));

        FRCPOrbitCoord(coord)
    }

    #[inline]
    pub fn from_fr_parity_coord(cube: &Cube333) -> FROrbitParityCoord {
        let orbit_corners = u8x16_swizzle(cube.corners.0, i8x16( 2, 4, 4, 6, 6, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1,-1));
        let slice_edges = u8x16_swizzle(cube.edges.0, i8x16( -1, -1, -1, -1, -1, -1, -1, -1, 5, 6, 6, 7, 7, 7, -1,-1));

        let cmp_corners = u8x16_swizzle(
            cube.corners.0,
            i8x16( 0, 0, 2, 0, 2, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1,-1),
        );
        let cmp_edges = u8x16_swizzle(
            cube.edges.0,
            i8x16( -1, -1, -1, -1, -1, -1, -1, -1, 4, 4, 5, 4, 5, 6, -1,-1),
        );
        let cmp0 = v128_or(orbit_corners, slice_edges);
        let cmp1 = v128_or(cmp_edges, cmp_corners);
        let higher_left = v128_and(
            u8x16_gt(cmp0, cmp1),
            u8x16_set1(1),
        );
        let added = mm_sad_epu8(higher_left);
        let added = v128_xor(added, u64x2_shuffle::<1, 1>(added, u64x2(0, 0)));
        let parity = u8x16_extract_lane::<0>(added) & 1;
        FROrbitParityCoord(parity == 1)
    }
}