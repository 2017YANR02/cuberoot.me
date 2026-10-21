//! Exact padded Opt coordinates using byte shuffles; the on-disk layout stays
//! unchanged. AVX-512BW/VL uses predicate masks directly for edge bitsets.
use super::{CoordTables, Cube, EDGE_STRIDE};
use std::arch::x86_64::*;

impl CoordTables {
    #[inline]
    pub(super) fn coordinate_parts_x86<const WITH_EO: bool>(&self, cube: &Cube) -> (u32, u16) {
        use crate::x86_simd::{selected, Backend};
        match selected() {
            Backend::Avx2 => unsafe { self.coordinate_parts_avx2::<WITH_EO>(cube) },
            Backend::Avx512 => unsafe { self.coordinate_parts_avx512::<WITH_EO>(cube) },
            Backend::Scalar => self.coordinate_parts_slow::<WITH_EO>(cube),
        }
    }

    #[target_feature(enable = "avx2")]
    unsafe fn canonical_edges_x86<const WITH_EO: bool>(&self, cube: &Cube) -> (u32, __m128i) {
        let corners = _mm_loadl_epi64(cube.corners.as_ptr().cast());
        let orientation = _mm_cvtepu8_epi16(_mm_and_si128(_mm_srli_epi16::<3>(corners), _mm_set1_epi8(31)));
        let products = _mm_madd_epi16(orientation, _mm_setr_epi16(1, 3, 9, 27, 81, 243, 729, 0));
        let pairs = _mm_add_epi32(products, _mm_srli_si128::<8>(products));
        let co = _mm_cvtsi128_si32(_mm_add_epi32(pairs, _mm_srli_si128::<4>(pairs))) as usize;
        let mask = (_mm_movemask_epi8(_mm_slli_epi16::<5>(corners)) as usize) & 127;
        let entry = self.corner_class[co * 70 + self.separation8[mask] as usize];
        let s = (entry & 63) as usize;
        let values = _mm_shuffle_epi8(crate::x86_simd::edges(cube),
            _mm_loadu_si128(self.edge_sources[s].as_ptr().cast()));
        let indices = _mm_and_si128(_mm_srli_epi16::<1>(values), _mm_set1_epi8(15));
        let transformed = if WITH_EO {
            _mm_xor_si128(
                _mm_shuffle_epi8(_mm_loadu_si128(self.edge_inverse_cubies[s].as_ptr().cast()), indices),
                _mm_and_si128(_mm_xor_si128(values,
                    _mm_loadu_si128(self.edge_source_flips[s].as_ptr().cast())), _mm_set1_epi8(1)))
        } else {
            _mm_shuffle_epi8(_mm_loadu_si128(self.edge_identities[s].as_ptr().cast()), indices)
        };
        (entry, transformed)
    }

    #[target_feature(enable = "avx2")]
    unsafe fn coordinate_parts_avx2<const WITH_EO: bool>(&self, cube: &Cube) -> (u32, u16) {
        let (entry, transformed) = self.canonical_edges_x86::<WITH_EO>(cube);
        let (identities, eo) = if WITH_EO {
            (_mm_and_si128(_mm_srli_epi16::<1>(transformed), _mm_set1_epi8(15)),
                (_mm_movemask_epi8(_mm_slli_epi16::<7>(transformed)) & 2047) as u16)
        } else { (transformed, 0) };
        let outer = (_mm_movemask_epi8(_mm_slli_epi16::<4>(identities)) & 2047) as usize;
        let remaining = _mm_shuffle_epi8(identities, _mm_loadl_epi64(self.outer_complement[outer].as_ptr().cast()));
        let inner = (_mm_movemask_epi8(_mm_slli_epi16::<5>(remaining)) & 127) as usize;
        let orbit = (entry >> 6) * EDGE_STRIDE
            + u32::from(self.separation8[inner]) * 512 + u32::from(self.separation12[outer]);
        (orbit, eo)
    }

    #[target_feature(enable = "avx2,avx512f,avx512bw,avx512vl")]
    unsafe fn coordinate_parts_avx512<const WITH_EO: bool>(&self, cube: &Cube) -> (u32, u16) {
        let (entry, transformed) = self.canonical_edges_x86::<WITH_EO>(cube);
        let (identities, eo) = if WITH_EO {
            (_mm_and_si128(_mm_srli_epi16::<1>(transformed), _mm_set1_epi8(15)),
                _mm_test_epi8_mask(transformed, _mm_set1_epi8(1)) & 2047)
        } else { (transformed, 0) };
        let outer = (_mm_test_epi8_mask(identities, _mm_set1_epi8(8)) & 2047) as usize;
        let remaining = _mm_shuffle_epi8(identities, _mm_loadl_epi64(self.outer_complement[outer].as_ptr().cast()));
        let inner = (_mm_test_epi8_mask(remaining, _mm_set1_epi8(4)) & 127) as usize;
        let orbit = (entry >> 6) * EDGE_STRIDE
            + u32::from(self.separation8[inner]) * 512 + u32::from(self.separation12[outer]);
        (orbit, eo)
    }
}
