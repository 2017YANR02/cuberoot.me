use crate::cube::*;
use crate::steps::coord::Coord;

#[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
pub struct EOCoordFB(pub(crate) u16);

impl Coord<2048> for EOCoordFB {
    fn val(&self) -> usize {
        self.0 as usize
    }
}

impl Into<usize> for EOCoordFB {
    fn into(self) -> usize {
        self.0 as usize
    }
}

impl From<&EdgeCube333> for EOCoordFB {
    #[inline]
    #[cfg(target_feature = "avx2")]
    fn from(value: &EdgeCube333) -> Self {
        unsafe { avx2::unsafe_from_eocoord_fb(value) }
    }

    #[inline]
    #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
    fn from(value: &EdgeCube333) -> Self {
        wasm32::from_eocoord_fb(value)
    }

    #[inline]
    #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
    fn from(value: &EdgeCube333) -> Self {
        unsafe { neon::unsafe_from_eocoord_fb(value) }
    }
}

impl From<&Cube333> for EOCoordFB {
    fn from(value: &Cube333) -> Self {
        EOCoordFB::from(&value.edges)
    }
}

pub trait BadEdgeCount {
    fn count_bad_edges_ud(&self) -> u32;
    fn count_bad_edges_fb(&self) -> u32;
    fn count_bad_edges_lr(&self) -> u32;
}

#[cfg(target_feature = "avx2")]
impl BadEdgeCount for EdgeCube333 {
    fn count_bad_edges_ud(&self) -> u32 {
        unsafe { avx2::unsafe_get_bad_edge_count_ud(self) }
    }

    fn count_bad_edges_fb(&self) -> u32 {
        unsafe { avx2::unsafe_get_bad_edge_count_fb(self) }
    }

    fn count_bad_edges_lr(&self) -> u32 {
        unsafe { avx2::unsafe_get_bad_edge_count_lr(self) }
    }
}

#[cfg(target_feature = "neon")]
impl BadEdgeCount for EdgeCube333 {
    fn count_bad_edges_ud(&self) -> u32 {
        unsafe { neon::unsafe_get_bad_edge_count_ud(self) }
    }

    fn count_bad_edges_fb(&self) -> u32 {
        unsafe { neon::unsafe_get_bad_edge_count_fb(self) }
    }

    fn count_bad_edges_lr(&self) -> u32 {
        unsafe { neon::unsafe_get_bad_edge_count_lr(self) }
    }
}

#[cfg(target_feature = "avx2")]
mod avx2 {
    use std::arch::x86_64::{_mm_and_si128, _mm_movemask_epi8, _mm_setr_epi8, _mm_slli_epi64};
    use crate::cube::EdgeCube333;
    use crate::steps::eo::coords::EOCoordFB;

    #[inline]
    pub(crate) unsafe fn unsafe_from_eocoord_fb(value: &EdgeCube333) -> EOCoordFB {
        EOCoordFB(unsafe_get_bad_edges::<SHL_FB, IGNORE_LAST_EDGE>(value) as u16)
    }

    const SHL_UD: i32 = 4;
    const SHL_FB: i32 = 5;
    const SHL_LR: i32 = 6;
    const IGNORE_LAST_EDGE: i8 = 0;
    const INCLUDE_LAST_EDGE: i8 = 0x0F;

    pub(crate) unsafe fn unsafe_get_bad_edge_count_ud(value: &EdgeCube333) -> u32 {
        unsafe_get_bad_edges::<SHL_UD, INCLUDE_LAST_EDGE>(value).count_ones()
    }

    pub(crate) unsafe fn unsafe_get_bad_edge_count_fb(value: &EdgeCube333) -> u32 {
        unsafe_get_bad_edges::<SHL_FB, INCLUDE_LAST_EDGE>(value).count_ones()
    }

    pub(crate) unsafe fn unsafe_get_bad_edge_count_lr(value: &EdgeCube333) -> u32 {
        unsafe_get_bad_edges::<SHL_LR, INCLUDE_LAST_EDGE>(value).count_ones()
    }

    #[inline]
    unsafe fn unsafe_get_bad_edges<const SHL: i32, const LAST_EDGE: i8>(value: &EdgeCube333) -> u32 {
        //Number of oriented edges is always even, so the last edge can be ignored in the coordinate
        let no_db_edge = _mm_and_si128(
            value.0,
            _mm_setr_epi8( 0x0F,
                           0x0F, 0x0F, 0x0F, 0x0F, 0x0F, 0x0F, 0x0F, 0x0F, 0x0F, 0x0F, LAST_EDGE, 0x00, 0x00, 0x00,
                           0x00),
        );
        _mm_movemask_epi8(_mm_slli_epi64::<SHL>(no_db_edge)) as u32
    }
}


#[cfg(target_feature = "neon")]
mod neon {
    use std::arch::aarch64::{vaddv_u8, vandq_u8, vdupq_n_u8, vget_high_u8, vget_low_u8, vshlq_u8};

    use crate::cube::EdgeCube333;
    use crate::steps::eo::coords::EOCoordFB;

    use crate::simd_util::neon::C16;


    const SHL_UD: i8 = -1;
    const SHL_FB: i8 = 0;
    const SHL_LR: i8 = 1;

    const SHL_UD_MASK: u8 = 0b1000;
    const SHL_FB_MASK: u8 = 0b0100;
    const SHL_LR_MASK: u8 = 0b0010;

    const IGNORE_LAST_EDGE: u8 = 0b111;
    const INCLUDE_LAST_EDGE: u8 = 0b1111;

    pub(crate) unsafe fn unsafe_get_bad_edge_count_ud(value: &EdgeCube333) -> u32 {
        unsafe_get_bad_edges::<SHL_UD, SHL_UD_MASK, INCLUDE_LAST_EDGE>(value).count_ones()
    }

    pub(crate) unsafe fn unsafe_get_bad_edge_count_fb(value: &EdgeCube333) -> u32 {
        unsafe_get_bad_edges::<SHL_FB, SHL_FB_MASK, INCLUDE_LAST_EDGE>(value).count_ones()
    }

    pub(crate) unsafe fn unsafe_get_bad_edge_count_lr(value: &EdgeCube333) -> u32 {
        unsafe_get_bad_edges::<SHL_LR, SHL_LR_MASK, INCLUDE_LAST_EDGE>(value).count_ones()
    }

    #[inline]
    unsafe fn unsafe_get_bad_edges<const SHL: i8, const SH_MASK: u8, const LAST_EDGE: u8>(value: &EdgeCube333) -> u16 {
        let data = vandq_u8(value.0, vdupq_n_u8(SH_MASK));
        let data = vshlq_u8(data, C16 { a_i8: [-2 + SHL, -1 + SHL, SHL, 1 + SHL, 2 + SHL, 3 + SHL, 4 + SHL, 5 + SHL,
                                               -2 + SHL, -1 + SHL, SHL, 1 + SHL, 2 + SHL, 3 + SHL, 4 + SHL, 5 + SHL]}.a_i);

        let low = vaddv_u8(vget_low_u8(data)) as u16;
        let high = (vaddv_u8(vget_high_u8(data)) & LAST_EDGE) as u16;
        low | (high << 8)
    }

    #[inline]
    pub(crate) unsafe fn unsafe_from_eocoord_fb(value: &EdgeCube333) -> EOCoordFB {
        EOCoordFB(unsafe_get_bad_edges::<SHL_FB, SHL_FB_MASK, IGNORE_LAST_EDGE>(value))
    }
}

#[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
mod wasm32 {
    use std::arch::wasm32::{u32x4_shl, u8x16, u8x16_bitmask, v128_and};

    use crate::cube::EdgeCube333;
    use crate::steps::eo::coords::EOCoordFB;

    #[inline]
    pub(crate) fn from_eocoord_fb(value: &EdgeCube333) -> EOCoordFB {
        EOCoordFB(get_eocoord::<5>(value))
    }

    #[inline]
    fn get_eocoord<const SHL: u32>(value: &EdgeCube333) -> u16 {
        //Number of oriented edges is always even, so the last edge can be ignored in the coordinate
        let no_db_edge = v128_and(
            value.0,
            u8x16(0x0F, 0x0F, 0x0F, 0x0F, 0x0F, 0x0F, 0x0F, 0x0F, 0x0F,
                  0x0F, 0x0F, 0x00, 0x00, 0x00, 0x00, 0x00),
        );
        u8x16_bitmask(u32x4_shl(no_db_edge, SHL))
    }
}