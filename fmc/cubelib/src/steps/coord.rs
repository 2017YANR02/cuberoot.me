use std::cmp::Ordering;
use std::fmt::Debug;
use std::hash::Hash;
use std::ops::Deref;
use crate::cube::Symmetry;
use crate::cube::turn::ApplySymmetry;

pub trait Coord<const SIZE: usize>: Into<usize> + Copy + Clone + Eq + PartialEq + Hash + Debug + Send + Sync {
    fn size() -> usize {
        SIZE
    }
    fn val(&self) -> usize;
    fn wrap(self) -> CoordWrapper<SIZE, Self> {
        CoordWrapper(self)
    }
    fn min_with_symmetries<'a, T: ApplySymmetry + Clone, V: IntoIterator<Item = &'a Symmetry>>(t: &'a T, symmetries: V) -> Self where for<'b> Self: From<&'b T> {
        symmetries.into_iter()
            .map(|s|{
                let mut t = t.clone();
                t.apply_symmetry(s);
                Self::from(&t).wrap()
            })
            .min()
            .unwrap()
            .unwrap()
    }
}

#[derive(Copy, Clone, Eq, PartialEq, Hash)]
pub struct CoordWrapper<const SIZE: usize, C: Coord<SIZE>>(C);

impl <const SIZE: usize, C: Coord<SIZE>> Deref for CoordWrapper<SIZE, C> {
    type Target = C;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl <const SIZE: usize, C: Coord<SIZE>> From<C> for CoordWrapper<SIZE, C> {
    fn from(value: C) -> Self {
        Self(value)
    }
}

impl <const SIZE: usize, C: Coord<SIZE>> CoordWrapper<SIZE, C> {
    pub fn unwrap(self) -> C {
        self.0
    }
}

impl <const SIZE: usize, C: Coord<SIZE>> PartialOrd for CoordWrapper<SIZE, C> {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl <const SIZE: usize, C: Coord<SIZE>> Ord for CoordWrapper<SIZE, C> {
    fn cmp(&self, other: &Self) -> Ordering {
        self.0.val().cmp(&other.0.val())
    }
}

#[derive(Copy, Clone, PartialEq, Eq, Hash, Debug)]
pub struct ZeroCoord;

impl Into<usize> for ZeroCoord {
    fn into(self) -> usize {
        0
    }
}

impl Coord<0> for ZeroCoord {
    fn val(&self) -> usize {
        0
    }
}

impl <P> From<&P> for ZeroCoord {
    fn from(_: &P) -> Self {
        ZeroCoord
    }
}

#[cfg(any(target_feature = "avx2", target_feature = "neon"))]
pub type CPCoord = default_coords::CPCoord;
#[cfg(any(target_feature = "avx2"))]
pub type EPCoord = default_coords::EPCoord;
#[cfg(any(target_feature = "avx2"))]
pub type EdgeCoord = default_coords::EdgeCoord;

#[cfg(any(target_feature = "avx2", target_feature = "neon"))]
mod default_coords {
    use crate::cube::{CornerCube333, Cube333};
    use crate::steps;
    use crate::steps::coord::{Coord};

    #[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
    pub struct CPCoord(pub u16);
    #[cfg(target_feature = "avx2")]
    #[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
    pub struct EPCoord(pub u32);
    #[cfg(target_feature = "avx2")]
    #[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
    pub struct EdgeCoord(pub steps::eo::coords::EOCoordFB, pub EPCoord);

    impl Coord<40320> for CPCoord {
        fn val(&self) -> usize {
            self.0 as usize
        }
    }

    #[cfg(target_feature = "avx2")]
    impl Coord<479001600> for EPCoord {
        fn val(&self) -> usize {
            self.0 as usize
        }
    }

    #[cfg(target_feature = "avx2")]
    impl Coord<{2048 * 479001600}> for EdgeCoord {
        fn val(&self) -> usize {
            self.0.val() * steps::eo::coords::EOCoordFB::size() + self.1.val()
        }
    }

    impl Into<usize> for CPCoord {
        fn into(self) -> usize {
            self.0 as usize
        }
    }

    #[cfg(target_feature = "avx2")]
    impl Into<usize> for EPCoord {
        fn into(self) -> usize {
            self.0 as usize
        }
    }

    #[cfg(target_feature = "avx2")]
    impl Into<usize> for EdgeCoord {
        fn into(self) -> usize {
            self.val()
        }
    }

    #[cfg(target_feature = "avx2")]
    impl EdgeCoord {
        pub fn new(val: usize) -> Self {
            let eo = val % steps::eo::coords::EOCoordFB::size();
            let ep = val / steps::eo::coords::EOCoordFB::size();
            Self(steps::eo::coords::EOCoordFB(eo as u16), EPCoord(ep as u32))
        }
    }

    impl From<&CornerCube333> for CPCoord {
        fn from(value: &CornerCube333) -> Self {
            #[cfg(target_feature = "avx2")]
            unsafe {
                steps::coord::avx2::unsafe_from_cpcoord(value)
            }
            #[cfg(target_feature = "neon")]
            unsafe {
                steps::coord::neon::unsafe_from_cpcoord(value)
            }
        }
    }

    #[cfg(target_feature = "avx2")]
    impl From<&crate::cube::EdgeCube333> for EPCoord {
        fn from(value: &crate::cube::EdgeCube333) -> Self {
            unsafe {
                steps::coord::avx2::unsafe_from_epcoord(value)
            }
        }
    }

    #[cfg(target_feature = "avx2")]
    impl From<&crate::cube::EdgeCube333> for EdgeCoord {
        fn from(value: &crate::cube::EdgeCube333) -> Self {
            Self(crate::steps::eo::coords::EOCoordFB::from(value), EPCoord::from(value))
        }
    }

    #[cfg(target_feature = "avx2")]
    impl From<EdgeCoord> for crate::cube::EdgeCube333 {
        fn from(value: EdgeCoord) -> Self {
            unsafe {
                steps::coord::avx2::unsafe_inverse_from_edge_coord(value)
            }
        }
    }

    impl From<&Cube333> for CPCoord {
        fn from(value: &Cube333) -> Self {
            Self::from(&value.corners)
        }
    }

    #[cfg(target_feature = "avx2")]
    impl From<&Cube333> for EPCoord {
        fn from(value: &Cube333) -> Self {
            Self::from(&value.edges)
        }
    }

    #[cfg(target_feature = "avx2")]
    impl From<&Cube333> for EdgeCoord {
        fn from(value: &Cube333) -> Self {
            Self::from(&value.edges)
        }
    }
}

#[cfg(target_feature = "avx2")]
pub(crate) mod avx2 {
    use std::arch::x86_64::{__m128i, _mm256_and_si256, _mm256_castsi256_si128, _mm256_cmpgt_epi8, _mm256_extracti128_si256, _mm256_hadd_epi32, _mm256_mullo_epi32, _mm256_set1_epi64x, _mm256_set1_epi8, _mm256_set_epi32, _mm256_set_epi8, _mm256_setr_m128i, _mm256_shuffle_epi8, _mm_add_epi32, _mm_add_epi8, _mm_and_si128, _mm_cmpgt_epi8, _mm_cmplt_epi8, _mm_extract_epi16, _mm_extract_epi32, _mm_hadd_epi16, _mm_hadd_epi32, _mm_load_si128, _mm_mullo_epi16, _mm_mullo_epi32, _mm_or_si128, _mm_set1_epi64x, _mm_set1_epi8, _mm_set_epi16, _mm_set_epi32, _mm_set_epi64x, _mm_set_epi8, _mm_setr_epi16, _mm_setr_epi8, _mm_shuffle_epi8, _mm_slli_epi32, _mm_srli_epi32};

    use crate::cube::{CornerCube333, EdgeCube333};
    use crate::steps::coord::Coord;
    use crate::steps::coord::default_coords::{CPCoord, EdgeCoord, EPCoord};
    use crate::steps::finish::coords::inverse_permutation_n;

    pub(crate) unsafe fn unsafe_inverse_from_edge_coord(value: EdgeCoord) -> EdgeCube333 {
        let ep_arr = inverse_permutation_n::<12>(value.1.val() as u32);
        let ep_data = [ep_arr.as_slice(), &[0;4]].concat();
        let ep = _mm_slli_epi32::<4>(_mm_load_si128(ep_data.as_ptr() as *const __m128i));
        let eo = if value.0.0.count_ones() % 2 == 0 {
            value.0.0
        } else {
            value.0.0 | 0b100000000000
        };
        let lower = (eo & 0xFFu16) as i8;
        let upper = (eo >> 8) as i8;
        let eo_vals = _mm_setr_epi8(lower, lower, lower, lower, lower, lower, lower, lower, upper, upper, upper, upper, 0, 0, 0, 0);
        let bad_edges = _mm_cmpgt_epi8(
            _mm_and_si128(eo_vals, _mm_set1_epi64x(0x8040201008040201u64 as i64)),
            _mm_set1_epi8(0));
        let eofb_bit = _mm_and_si128(bad_edges, _mm_set1_epi8(0b100));
        EdgeCube333::new(_mm_or_si128(eofb_bit, ep))
    }

    #[target_feature(enable = "avx2")]
    pub(crate) unsafe fn unsafe_from_cpcoord(value: &CornerCube333) -> CPCoord {
        let cp_values = _mm_and_si128(_mm_srli_epi32::<5>(value.0), _mm_set1_epi8(0b111));
        CPCoord(unsafe_permutation_8(cp_values))
    }

    #[target_feature(enable = "avx2")]
    pub(crate) unsafe fn unsafe_permutation_8(val: __m128i) -> u16 {
        //We interleave the values to make using hadd_epi_<16/32> easier when we combine them
        let values_67 = _mm_shuffle_epi8(
            val,
            _mm_setr_epi8( 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, -1, 7, -1,-1),
        );
        let values_2345 = _mm_shuffle_epi8(
            val,
            _mm_setr_epi8( 2, 3, 4, 5, 2, 3, 4, 5, -1, 3, 4, 5, -1, -1, 4,5),
        );
        let values_15 = _mm_shuffle_epi8(val, _mm_set_epi64x(5, 1));

        let higher_left_67 = _mm_and_si128(
            _mm_cmplt_epi8(
                values_67,
                _mm_shuffle_epi8(
                    val,
                    _mm_setr_epi8( 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, -1, 6, -1,-1),
                ),
            ),
            _mm_set1_epi8(1),
        );
        let higher_left_2345 = _mm_and_si128(
            _mm_cmplt_epi8(
                values_2345,
                _mm_shuffle_epi8(
                    val,
                    _mm_setr_epi8( 0, 0, 0, 0, 1, 1, 1, 1, -1, 2, 2, 2, -1, -1, 3,3),
                ),
            ),
            _mm_set1_epi8(1),
        );
        let higher_left_15 = _mm_and_si128(
            _mm_cmplt_epi8(values_15, _mm_shuffle_epi8(val, _mm_set_epi64x(4, 0))),
            _mm_set1_epi8(1),
        );

        let hsum = _mm_hadd_epi32(higher_left_2345, higher_left_67);
        let hsum = _mm_hadd_epi32(hsum, higher_left_15);
        let hsum = _mm_shuffle_epi8(
            hsum,
            _mm_setr_epi8( 8, 0, -1, -1, 1, 2, -1, -1, 3, 4, 12, 6, 5, -1, 7,-1),
        );
        let hsum = _mm_hadd_epi16(hsum, _mm_set1_epi8(0));
        let hsum = _mm_shuffle_epi8(
            hsum,
            _mm_setr_epi8( 0, -1, 1, -1, 2, -1, 3, -1, 4, -1, 5, -1, 6, -1, -1,-1),
        );
        let factorials = _mm_setr_epi16( 1, 2, 6, 24, 120, 720, 5040,0);
        let prod = _mm_mullo_epi16(hsum, factorials);

        hsum_epi16_sse3(prod)
    }

    #[target_feature(enable = "avx2")]
    pub(crate) unsafe fn unsafe_from_epcoord(value: &EdgeCube333) -> EPCoord {
        let ep_values_m128 = _mm_and_si128(_mm_srli_epi32::<4>(value.0), _mm_set1_epi8(0b1111));
        let ep_values = _mm256_setr_m128i(ep_values_m128, ep_values_m128);

        let values_1011 = _mm256_shuffle_epi8(ep_values, _mm256_set_epi8(-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, -1, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10));
        let values_6789 = _mm256_shuffle_epi8(ep_values, _mm256_set_epi8(9, 8, -1, -1, 9, 8, 7, -1, 9, 8, 7, 6, 9, 8, 7, 6, 9, 8, 7, 6, 9, 8, 7, 6, 9, 8, 7, 6, 9, 8, 7, 6));
        let values_2345 = _mm_shuffle_epi8(ep_values_m128, _mm_set_epi8(5, 4, 5, 4, 5, 4, 5, 4, -1, -1, 3, -1, 3, 2, 3, 2));

        let values_159 = _mm_shuffle_epi8(ep_values_m128, _mm_set_epi8(-1, -1, -1, -1, 9, -1, -1, -1, 1, -1, -1, 1, 5, -1, -1, -1));

        let higher_left_1011 = _mm256_and_si256(_mm256_cmpgt_epi8(_mm256_shuffle_epi8(ep_values, _mm256_set_epi8(
            -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, -1, 9, 9, 8, 8,
            7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 0, 0,
        )), values_1011), _mm256_set1_epi8(1));

        let higher_left_6789 = _mm256_and_si256(_mm256_cmpgt_epi8(_mm256_shuffle_epi8(ep_values, _mm256_set_epi8(
            7, 7, -1, -1, 6, 6, 6, -1, 5, 5, 5, 5, 4, 4, 4, 4,
            3, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0, 0, 0,
        )), values_6789), _mm256_set1_epi8(1));

        let higher_left_2345 = _mm_and_si128(_mm_cmplt_epi8(values_2345, _mm_shuffle_epi8(ep_values_m128, _mm_set_epi8(
            3, 3, 2, 2, 1, 1, 0, 0, -1, -1, 2, -1, 1, 1, 0, 0
        ))), _mm_set1_epi8(1));

        let higher_left_159 = _mm_and_si128(_mm_cmpgt_epi8(_mm_shuffle_epi8(ep_values_m128, _mm_set_epi8(
            -1, -1, -1, -1, 8, -1, -1, -1, -1, -1, -1, 0, 4, -1, -1, -1
        )), values_159), _mm_set1_epi8(1));

        let hsum = _mm256_hadd_epi32(higher_left_6789, higher_left_1011);

        let hsum_lo = _mm256_castsi256_si128(hsum);
        let hsum_hi = _mm256_extracti128_si256::<1>(hsum);
        let hsum = _mm_add_epi8(hsum_lo, hsum_hi);

        let hsum_with_6789 = _mm_hadd_epi32(higher_left_2345, hsum);
        let hsum = _mm_and_si128(_mm_hadd_epi16(hsum_with_6789, _mm_set1_epi8(0)), _mm_set_epi16(0, 0, 0, 0, -1, 0, -1, -1));
        let hsum = _mm_add_epi8(hsum, _mm_and_si128(hsum_with_6789, _mm_set_epi16(0, 0, -1, -1, 0, 0, 0, 0)));
        let hsum = _mm_add_epi8(hsum, higher_left_159);

        let hsum_lower_factorials = _mm_shuffle_epi8(hsum, _mm_set_epi8(
            -1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 0, -1, -1, -1, 4,
        ));

        let prod1 = _mm_mullo_epi32(hsum_lower_factorials, _mm_set_epi32(0, 6, 2, 1));

        let hsum_higher_factorials = _mm256_shuffle_epi8(_mm256_setr_m128i(hsum, hsum), _mm256_set_epi8(
            -1, -1, -1, 7, -1, -1, -1, 6, -1, -1, -1, 11, -1, -1, -1, 10,
            -1, -1, -1, 9, -1, -1, -1, 8, -1, -1, -1, 3, -1, -1, -1, 2,
        ));

        let prod2 = _mm256_mullo_epi32(hsum_higher_factorials, _mm256_set_epi32(39916800, 3628800, 362880, 40320, 5040, 720, 120, 24));

        let prodsum = _mm256_hadd_epi32(prod2, _mm256_set1_epi64x(0));

        let prodsum_lo = _mm256_castsi256_si128(prodsum);
        let prodsum_hi = _mm256_extracti128_si256::<1>(prodsum);
        let prodsum = _mm_add_epi32(prodsum_lo, prodsum_hi);

        let prodsum = _mm_add_epi32(prodsum, _mm_hadd_epi32(prod1, _mm_set1_epi8(0)));
        let prodsum = _mm_hadd_epi32(prodsum, _mm_set1_epi8(0));

        EPCoord(_mm_extract_epi32::<0>(prodsum) as u32)
    }

    #[inline]
    unsafe fn hsum_epi16_sse3(v: __m128i) -> u16 {
        let sum = _mm_hadd_epi16(v, _mm_set1_epi8(0));
        let sum = _mm_hadd_epi16(sum, _mm_set1_epi8(0));
        let sum = _mm_hadd_epi16(sum, _mm_set1_epi8(0));
        _mm_extract_epi16::<0>(sum) as u16
    }
}

#[cfg(target_feature = "neon")]
pub(crate) mod neon {
    use std::arch::aarch64::{uint8x8_t, vaddq_u8, vaddvq_u16, vandq_u8, vcltq_u8, vcombine_u8, vdup_n_u8, vdupq_n_u8, vmulq_u16, vorrq_u8, vqtbl1q_u8, vreinterpretq_u16_u8};

    use crate::cube::CornerCube333;
    use crate::simd_util::neon::C16;
    use crate::steps::coord::default_coords::CPCoord;

    pub(crate) unsafe fn unsafe_from_cpcoord(cube: &CornerCube333) -> CPCoord {
        CPCoord(unsafe_permutation_8(cube.0))
    }

    pub(crate) unsafe fn unsafe_permutation_8(val: uint8x8_t) -> u16 {
        let val = vcombine_u8(val, vdup_n_u8(0));
        let values_367 = vqtbl1q_u8(
            val,
            C16{ a_i8: [3, 7, 6, 3, 7, 6, 3, 7, 6, 7, 6, 7, 6, 7, 6, 7] }.a
        );
        let higher_left_367 = vandq_u8(vcltq_u8(
            values_367,
            vqtbl1q_u8(val, C16 { a_i8: [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 5, 6] }.a)
        ), vdupq_n_u8(1));

        let sum_367 = vaddq_u8(
            higher_left_367,
            vqtbl1q_u8(higher_left_367, C16 { a_i8: [3, -1, 5, -1, 1, -1, -1, 9, 10, -1, -1, 13, 14, -1, -1, -1]}.a)
        );
        let sum_367 = vaddq_u8(
            sum_367,
            vqtbl1q_u8(sum_367, C16 { a_i8: [6, -1, 8, -1, 7, -1, -1, -1, -1, -1, -1, 15, -1, -1, -1, -1]}.a)
        );
        let sum_367 = vaddq_u8(
            sum_367,
            vqtbl1q_u8(sum_367, C16 { a_i8: [-1, -1, 12, -1, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]}.a)
        );

        let values_1245 = vqtbl1q_u8(
            val,
            C16 { a_i8: [1, 2, 2, 4, 4, 4, 5, 4, 5, 5, 5, 5, -1, -1, -1, -1] }.a
        );
        let higher_left_1245 = vandq_u8(vcltq_u8(
            values_1245,
            vqtbl1q_u8(val, C16 { a_i8: [0, 0, 1, 0, 1, 2, 0, 3, 1, 2, 3, 4, -1, -1, -1, -1] }.a)
        ), vdupq_n_u8(1));

        let sum_1245 = vaddq_u8(
            higher_left_1245,
            vqtbl1q_u8(higher_left_1245, C16 { a_i8: [-1, -1, 1, -1, 3, 7, 8, -1, -1, 10, -1, -1, -1, -1, -1, -1]}.a)
        );
        let sum_1245 = vaddq_u8(
            sum_1245,
            vqtbl1q_u8(sum_1245, C16 { a_i8: [-1, -1, -1, -1, 5, -1, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1]}.a)
        );
        let sum_1245 = vaddq_u8(
            sum_1245,
            vqtbl1q_u8(sum_1245, C16 { a_i8: [-1, -1, -1, -1, -1, -1, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1]}.a)
        );
        let sum_1245 = vqtbl1q_u8(
            sum_1245,
            C16 { a_i8: [0, -1, 2, -1, -1, -1, 4, -1, 6, -1, -1, -1, -1, -1, -1, -1]}.a
        );
        let sum_367 = vqtbl1q_u8(
            sum_367,
            C16 { a_i8: [-1, -1, -1, -1, 0, -1, -1, -1, -1, -1, 2, -1, 4, -1, -1, -1]}.a
        );
        let sum = vreinterpretq_u16_u8(vorrq_u8(sum_1245, sum_367));
        let mul = vmulq_u16(sum, C16{ a_u16: [1, 2, 6, 24, 120, 720, 5040, 0]}.a_16);
        vaddvq_u16(mul)
    }
}
