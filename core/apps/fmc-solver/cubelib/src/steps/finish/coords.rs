use crate::cube::{CornerCube333, Cube333, EdgeCube333};
use crate::steps::coord::Coord;

#[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
pub struct CPCoord(pub(crate) u16);

#[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
pub struct DRFinishSliceCoord(pub(crate) u8);

#[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
pub struct DRFinishNonSliceEP(pub(crate) u16);

#[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
pub struct FRUDFinishCoord(pub(crate) u8);

#[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
pub struct HTRFinishCoord(pub(crate) u32);

#[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
pub struct HTRLeaveSliceFinishCoord(pub(crate) u16);

#[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
pub struct DRFinishCoord(pub(crate) CPCoord, pub(crate) DRFinishNonSliceEP, pub(crate) DRFinishSliceCoord);

#[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
pub struct DRLeaveSliceFinishCoord(pub(crate) CPCoord, pub(crate) DRFinishNonSliceEP);

pub const DR_FINISH_SIZE: usize = 40320 * 40320 * 24 / 2;
impl Coord<{DR_FINISH_SIZE}> for DRFinishCoord {
    fn val(&self) -> usize {
        let raw_val = self.0.val() * DRFinishSliceCoord::size() * DRFinishNonSliceEP::size() +
            self.1.val() * DRFinishSliceCoord::size() +
            self.2.val();
        raw_val >> 1
    }
}

pub const DR_FINISH_LS_SIZE: usize = 40320 * 40320;
impl Coord<{ DR_FINISH_LS_SIZE }> for DRLeaveSliceFinishCoord {
    fn val(&self) -> usize {
        self.0.val() * DRFinishNonSliceEP::size() +
            self.1.val()
    }
}

pub const HTR_FINISH_SIZE: usize = 24*24*24*4*12;
impl Coord<{HTR_FINISH_SIZE}> for HTRFinishCoord {
    fn val(&self) -> usize {
        self.0 as usize
    }
}

pub const HTR_LEAVE_SLICE_FINISH_SIZE: usize = 24*24*24*4;
impl Coord<{ HTR_LEAVE_SLICE_FINISH_SIZE }> for HTRLeaveSliceFinishCoord {
    fn val(&self) -> usize {
        self.0 as usize
    }
}

pub const FR_FINISH_SIZE: usize = 256;
impl Coord<{ FR_FINISH_SIZE }> for FRUDFinishCoord {
    fn val(&self) -> usize {
        self.0 as usize
    }
}

impl Into<usize> for FRUDFinishCoord {
    fn into(self) -> usize {
        self.0 as usize
    }
}

impl Coord<40320> for CPCoord {
    fn val(&self) -> usize {
        self.0 as usize
    }
}

impl Into<usize> for CPCoord {
    fn into(self) -> usize {
        self.0 as usize
    }
}

impl Coord<40320> for DRFinishNonSliceEP {
    fn val(&self) -> usize {
        self.0 as usize
    }
}

impl Into<usize> for DRFinishNonSliceEP {
    fn into(self) -> usize {
        self.0 as usize
    }
}

impl Coord<24> for DRFinishSliceCoord {
    fn val(&self) -> usize {
        self.0 as usize
    }
}

impl Into<usize> for DRFinishSliceCoord {
    fn into(self) -> usize {
        self.0 as usize
    }
}

impl Into<usize> for DRFinishCoord {
    fn into(self) -> usize {
        self.val()
    }
}

impl Into<usize> for DRLeaveSliceFinishCoord {
    fn into(self) -> usize {
        self.val()
    }
}

impl From<&EdgeCube333> for DRFinishSliceCoord {
    #[cfg(target_feature = "avx2")]
    fn from(value: &EdgeCube333) -> Self {
        unsafe { avx2::unsafe_from_drfinish_slice_coord(value) }
    }
    #[cfg(target_feature = "neon")]
    fn from(value: &EdgeCube333) -> Self {
        unsafe { neon::unsafe_from_drfinish_slice_coord(value) }
    }
}

impl From<&EdgeCube333> for DRFinishNonSliceEP {
    #[cfg(target_feature = "avx2")]
    fn from(value: &EdgeCube333) -> Self {
        unsafe { avx2::unsafe_from_drfinish_edges_coord(value) }
    }
    #[cfg(target_feature = "neon")]
    fn from(value: &EdgeCube333) -> Self {
        unsafe { neon::unsafe_from_drfinish_edges_coord(value) }
    }
}

#[cfg(any(target_feature = "avx2", target_feature = "neon"))]
impl From<&Cube333> for DRFinishCoord {
    fn from(value: &Cube333) -> Self {
        let cp = CPCoord::from(&value.corners);
        let slice_ep = DRFinishSliceCoord::from(&value.edges);
        let non_slice_ep = DRFinishNonSliceEP::from(&value.edges);
        Self(cp, non_slice_ep, slice_ep)
    }
}

impl From<usize> for DRFinishCoord {
    fn from(value: usize) -> Self {
        let value = value << 1;
        let mut slice_ep = DRFinishSliceCoord((value % DRFinishSliceCoord::size()) as u8);
        let value = value / DRFinishSliceCoord::size();
        let non_slice_ep = DRFinishNonSliceEP((value % DRFinishNonSliceEP::size()) as u16);
        let cp = CPCoord((value / DRFinishNonSliceEP::size()) as u16);
        let slice_ep_parity = !cp.parity_even() as u8 ^ !non_slice_ep.parity_even() as u8 ^ !slice_ep.parity_even() as u8;
        if slice_ep_parity & 1 == 1 {
            slice_ep.0 = slice_ep.0 ^ 1;
        }
        Self(cp, non_slice_ep, slice_ep)
    }
}

#[cfg(any(target_feature = "avx2", target_feature = "neon"))]
impl From<&Cube333> for DRLeaveSliceFinishCoord {
    fn from(value: &Cube333) -> Self {
        let cp = CPCoord::from(&value.corners);
        let non_slice_ep = DRFinishNonSliceEP::from(&value.edges);
        Self(cp, non_slice_ep)
    }
}

impl From<usize> for DRLeaveSliceFinishCoord {
    fn from(value: usize) -> Self {
        let non_slice_ep = DRFinishNonSliceEP((value % DRFinishNonSliceEP::size()) as u16);
        let cp = CPCoord((value / DRFinishNonSliceEP::size()) as u16);
        Self(cp, non_slice_ep)
    }
}

impl From<&Cube333> for FRUDFinishCoord {
    #[inline]
    #[cfg(target_feature = "avx2")]
    fn from(value: &Cube333) -> Self {
        unsafe { avx2::unsafe_from_fr_finish_coord(value) }
    }

    #[inline]
    #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
    fn from(value: &Cube333) -> Self {
        unsafe { neon::unsafe_from_fr_finish_coord(value) }
    }

    #[inline]
    #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
    fn from(value: &Cube333) -> Self {
        wasm32::from_fr_finish_coord(value)
    }
}

impl Into<usize> for HTRFinishCoord {
    fn into(self) -> usize {
        self.0 as usize
    }
}

impl From<&Cube333> for HTRFinishCoord {
    #[inline]
    #[cfg(target_feature = "avx2")]
    fn from(value: &Cube333) -> Self {
        unsafe { avx2::unsafe_from_htr_finish_coord(value) }
    }

    #[inline]
    #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
    fn from(value: &Cube333) -> Self {
        unsafe { neon::unsafe_from_htr_finish_coord(value) }
    }
}

impl Into<usize> for HTRLeaveSliceFinishCoord {
    fn into(self) -> usize {
        self.0 as usize
    }
}

impl From<&Cube333> for HTRLeaveSliceFinishCoord {
    #[inline]
    #[cfg(target_feature = "avx2")]
    fn from(value: &Cube333) -> Self {
        unsafe { avx2::unsafe_from_htr_leave_slice_finish_coord(value) }
    }

    #[inline]
    #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
    fn from(value: &Cube333) -> Self {
        unsafe { neon::unsafe_from_htr_leave_slice_finish_coord(value) }
    }
}

#[cfg(target_feature = "avx2")]
impl From<&CornerCube333> for CPCoord {
    #[inline]
    fn from(value: &CornerCube333) -> Self {
        unsafe { avx2::unsafe_from_cpcoord(value) }
    }
}

#[cfg(target_feature = "neon")]
impl From<&CornerCube333> for CPCoord {
    #[inline]
    fn from(value: &CornerCube333) -> Self {
        unsafe { neon::unsafe_from_cpcoord(value) }
    }
}

#[cfg(target_feature = "avx2")]
impl Into<Cube333> for &DRFinishCoord {
    fn into(self) -> Cube333 {
        unsafe { avx2::unsafe_inverse_cube_from_drfinish(self) }
    }
}

#[cfg(target_feature = "neon")]
impl Into<Cube333> for &DRFinishCoord {
    fn into(self) -> Cube333 {
        unsafe { neon::unsafe_inverse_cube_from_drfinish(self) }
    }
}

#[cfg(target_feature = "avx2")]
impl Into<Cube333> for &DRLeaveSliceFinishCoord {
    fn into(self) -> Cube333 {
        unsafe { avx2::unsafe_inverse_cube_from_drlsfinish(self) }
    }
}

#[cfg(target_feature = "neon")]
impl Into<Cube333> for &DRLeaveSliceFinishCoord {
    fn into(self) -> Cube333 {
        unsafe { neon::unsafe_inverse_cube_from_drlsfinish(self) }
    }
}

impl CPCoord {
    pub fn parity_even(&self) -> bool {
        inverse_permutation_n_parity_even::<8>(self.0 as u32)
    }
}

impl DRFinishNonSliceEP {
    pub fn parity_even(&self) -> bool {
        inverse_permutation_n_parity_even::<8>(self.0 as u32)
    }
}

impl DRFinishSliceCoord {
    pub fn parity_even(&self) -> bool {
        inverse_permutation_n_parity_even::<4>(self.0 as u32)
    }
}

pub(crate) fn inverse_permutation_n_parity_even<const N: usize>(perm: u32) -> bool {
    assert!(N <= 12);
    let fac = [1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800, 39916800, 479001600];
    let mut parity = false;
    for i in 1..N {
        parity = !(parity ^ ((perm % fac[i] / fac[i-1]) & 1 == 1));
    }
    parity
}

// Not optimized at all
//TODO move somewhere more appropriate
pub(crate) fn inverse_permutation_n<const N: usize>(perm: u32) -> [u8; N] {
    assert!(N <= 12);
    let fac = [1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800, 39916800, 479001600];
    let mut factors = [0;N];
    for i in 1..N {
        factors[i] = perm % fac[i] / fac[i-1];
    }
    let mut values = [0u8;N];
    let mut found = [false;N];
    for i in (0..N).rev() {
        let mut j = N - 1;
        while found[j] {
            j -= 1;
        }
        while factors[i] > 0 {
            j -= 1;
            factors[i] -= 1;
            while found[j] {
                j -= 1;
            }
        }
        values[i] = j as u8;
        found[j] = true;
    }

    values
}

#[cfg(target_feature = "avx2")]
mod avx2 {
    use std::arch::x86_64::{__m128i, _mm_and_si128, _mm_cmpeq_epi8, _mm_cmplt_epi8, _mm_extract_epi16, _mm_extract_epi64, _mm_hadd_epi16, _mm_hadd_epi32, _mm_load_si128, _mm_movemask_epi8, _mm_mullo_epi16, _mm_or_si128, _mm_sad_epu8, _mm_set1_epi8, _mm_set_epi16, _mm_set_epi8, _mm_setr_epi16, _mm_setr_epi8, _mm_shuffle_epi8, _mm_slli_epi32, _mm_srli_epi32};
    use crate::cube::*;
    use crate::steps::coord::avx2::unsafe_permutation_8;
    use crate::steps::finish::coords::{CPCoord, DRFinishCoord, DRFinishNonSliceEP, DRFinishSliceCoord, DRLeaveSliceFinishCoord, FRUDFinishCoord, HTRFinishCoord, HTRLeaveSliceFinishCoord, inverse_permutation_n};

    #[target_feature(enable = "avx2")]
    pub(crate) unsafe fn unsafe_inverse_cube_from_drfinish(value: &DRFinishCoord) -> Cube333 {
        let cp = inverse_permutation_n::<8>(value.0.0 as u32);
        let cp_data = [cp.as_slice(), &[0;8]].concat();
        let val = _mm_load_si128(cp_data.as_ptr() as *const __m128i);
        let corners = CornerCube333::new(_mm_slli_epi32::<5>(val));

        let mut non_slice_edges = inverse_permutation_n::<8>(value.1.0 as u32);
        for i in 0..8 {
            if non_slice_edges[i] >= 4 {
                non_slice_edges[i] += 4;
            }
        }
        let mut slice_edges = inverse_permutation_n::<4>(value.2.0 as u32);
        for i in 0..4 {
            slice_edges[i] += 4;
        }
        let ep_data = [
            [&non_slice_edges[0..4], &slice_edges].concat(),
            [&non_slice_edges[4..8], &[0;4]].concat(),
        ].concat();

        let val = _mm_load_si128(ep_data.as_ptr() as *const __m128i);
        let edges = EdgeCube333::new(_mm_slli_epi32::<4>(val));
        Cube333::new(edges, corners)
    }

    #[target_feature(enable = "avx2")]
    pub(crate) unsafe fn unsafe_inverse_cube_from_drlsfinish(value: &DRLeaveSliceFinishCoord) -> Cube333 {
        let cp = inverse_permutation_n::<8>(value.0.0 as u32);
        let cp_data = [cp.as_slice(), &[0;8]].concat();
        let val = _mm_load_si128(cp_data.as_ptr() as *const __m128i);
        let corners = CornerCube333::new(_mm_slli_epi32::<5>(val));

        let mut non_slice_edges = inverse_permutation_n::<8>(value.1.0 as u32);
        for i in 0..8 {
            if non_slice_edges[i] >= 4 {
                non_slice_edges[i] += 4;
            }
        }
        let ep_data = [
            [&non_slice_edges[0..4], &[4, 5, 6, 7]].concat(),
            [&non_slice_edges[4..8], &[0;4]].concat(),
        ].concat();

        let val = _mm_load_si128(ep_data.as_ptr() as *const __m128i);
        let edges = EdgeCube333::new(_mm_slli_epi32::<4>(val));
        Cube333::new(edges, corners)
    }

    #[target_feature(enable = "avx2")]
    pub(crate) unsafe fn unsafe_from_drfinish_slice_coord(value: &EdgeCube333) -> DRFinishSliceCoord {
        let edges = _mm_shuffle_epi8(value.0, _mm_setr_epi8(-1, 5, 6, 7, -1, -1, 6, 7, -1, -1, -1, 7, -1, -1, -1, -1));
        let higher_left = _mm_shuffle_epi8(value.0, _mm_setr_epi8(-1, 4, 4, 4, -1, -1, 5, 5, -1, -1, -1, 6, -1, -1, -1, -1));
        let higher_left = _mm_and_si128(_mm_cmplt_epi8(edges, higher_left), _mm_set1_epi8(1));
        let sum = _mm_hadd_epi32(higher_left, _mm_set1_epi8(0));
        let sum = _mm_hadd_epi32(sum, _mm_set1_epi8(0));
        let sum = _mm_shuffle_epi8(sum, _mm_setr_epi8(1, -1, 2, -1, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1));
        let factorials = _mm_setr_epi16( 1, 2, 6, 0, 0, 0, 0, 0);
        let prod = _mm_extract_epi64::<0>(_mm_mullo_epi16(sum, factorials));
        let sum = ((prod) + (prod >> 16) + (prod >> 32)) & 0xFF;
        DRFinishSliceCoord(sum as u8)
    }

    #[target_feature(enable = "avx2")]
    pub(crate) unsafe fn unsafe_from_drfinish_edges_coord(value: &EdgeCube333) -> DRFinishNonSliceEP {
        let non_slice_edges = _mm_shuffle_epi8(value.0, _mm_setr_epi8(0, 1, 2, 3, 8, 9, 10, 11, -1, -1, -1, -1, -1, -1, -1, -1));
        DRFinishNonSliceEP(unsafe_permutation_8(_mm_and_si128(_mm_srli_epi32::<4>(non_slice_edges), _mm_set1_epi8(0xF))))
    }

    #[target_feature(enable = "avx2")]
    pub(crate) unsafe fn unsafe_from_cpcoord(value: &CornerCube333) -> CPCoord {
        let cp_values = _mm_and_si128(_mm_srli_epi32::<5>(value.0), _mm_set1_epi8(0b111));
        CPCoord(unsafe_permutation_8(cp_values))
    }

    #[target_feature(enable = "avx2")]
    #[inline]
    pub unsafe fn unsafe_from_fr_finish_coord(cube: &Cube333) -> FRUDFinishCoord {
        let correct_ufl_corner_position = _mm_cmpeq_epi8(cube.corners.0, _mm_set1_epi8(0b01100000));
        let correct_ufr_corner_position = _mm_cmpeq_epi8(cube.corners.0, _mm_set1_epi8(0b01000000));

        let ufl_values = _mm_and_si128(correct_ufl_corner_position, _mm_setr_epi8( 0, 1, 0, 0, 0, 2, 0, 3, 0, 0, 0, 0, 0, 0, 0,0));
        let ufr_values = _mm_and_si128(correct_ufr_corner_position, _mm_setr_epi8( 4, 0, 0, 0, 8, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0,0));

        let edge_coord = _mm_sad_epu8(_mm_or_si128(ufl_values, ufr_values), _mm_set1_epi8(0));
        let corners = _mm_extract_epi16::<0>(edge_coord) as u8;

        let edges = (_mm_movemask_epi8(cube.edges.0) & 0xF) as u8;

        let coord = corners << 4 | edges;
        FRUDFinishCoord(coord)
    }

    #[target_feature(enable = "avx2")]
    #[inline]
    pub unsafe fn unsafe_from_htr_leave_slice_finish_coord(cube: &Cube333) -> HTRLeaveSliceFinishCoord {
        let orbit_corners = _mm_and_si128(_mm_srli_epi32::<6>(cube.corners.0), _mm_set1_epi8(0b00000011));
        let edges = _mm_srli_epi32::<4>(cube.edges.0);

        let values_246 = _mm_shuffle_epi8(orbit_corners, _mm_set_epi8(
            -1,-1,-1,-1,
            -1,-1,-1, 6,
            -1,-1, 4, 6,
            -1, 2, 4, 6));
        let higher_left_246 = _mm_and_si128(_mm_cmplt_epi8(values_246, _mm_shuffle_epi8(orbit_corners, _mm_set_epi8(
            -1,-1,-1,-1,
            -1,-1,-1, 4,
            -1,-1, 2, 2,
            -1, 0, 0, 0
        ))), _mm_set1_epi8(1));

        let values_e12 = _mm_shuffle_epi8(edges, _mm_set_epi8(
            -1,-1,-1,-1,
            -1,-1,-1, 7,
            -1,-1, 6, 7,
            -1, 5, 6, 7));
        let cmp_values = _mm_shuffle_epi8(edges, _mm_set_epi8(
            -1,-1,-1,-1,
            -1,-1,-1, 6,
            -1,-1, 5, 5,
            -1, 4, 4, 4));
        let higher_left_e12 = _mm_and_si128(_mm_cmplt_epi8(values_e12, cmp_values), _mm_set1_epi8(1));

        let sum = _mm_hadd_epi32(higher_left_246, higher_left_e12);
        let sum = _mm_hadd_epi32(sum, _mm_set1_epi8(0));
        let sum = _mm_or_si128(sum, _mm_shuffle_epi8(orbit_corners, _mm_set_epi8(-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1)));
        let sum = _mm_shuffle_epi8(sum, _mm_set_epi8(
            -1,-1,-1,-1,
            -1, 4,-1, 5,
            -1, 3,-1, 0,
            -1, 1,-1, 2));

        let binom = _mm_mullo_epi16(sum, _mm_set_epi16(0, 0, 0, 0, 24, 6, 2, 1));
        let full_sum = _mm_hadd_epi16(_mm_hadd_epi16(_mm_hadd_epi16(binom, _mm_set1_epi8(0)), _mm_set1_epi8(0)), _mm_set1_epi8(0));
        let cp_eep_value = _mm_extract_epi16::<0>(full_sum) as u16;

        let values_m123s123 = _mm_shuffle_epi8(edges, _mm_set_epi8(
            11,  9,  3, -1,
            11,  9, -1, 10,
            11, -1,  8, 10,
            -1,  2,  8, 10));
        let cmp_values = _mm_shuffle_epi8(edges, _mm_set_epi8(
            1,  1,  1, -1,
            3,  3, -1,  8,
            9, -1,  2,  2,
            -1,  0,  0,  0));
        let higher_left_m123s123 = _mm_and_si128(_mm_cmplt_epi8(values_m123s123, cmp_values), _mm_set1_epi8(1));
        //We're doing two sums at once
        let sum = _mm_hadd_epi32(higher_left_m123s123, _mm_set1_epi8(0));
        //Split CubeFace::up the two sums again
        let sum = _mm_shuffle_epi8(sum, _mm_set_epi8(
            -1,-1,-1, 3,
            -1, 5, 6, 7,
            -1,-1,-1, 4,
            -1, 2, 1, 0));


        let sum = _mm_hadd_epi32(sum, _mm_set1_epi8(0));
        let sum = _mm_shuffle_epi8(sum, _mm_set_epi8(
            -1, 7,-1, 4,
            -1, 5,-1, 6,
            -1, 3,-1, 0,
            -1, 1,-1, 2));
        let binom = _mm_mullo_epi16(sum, _mm_set_epi16(0, 6*24, 2*24, 1*24, 0, 6, 2, 1));
        let full_sum = _mm_hadd_epi16(_mm_hadd_epi16(_mm_hadd_epi16(binom, _mm_set1_epi8(0)), _mm_set1_epi8(0)), _mm_set1_epi8(0));

        let edge_sum_ms = _mm_extract_epi16::<0>(full_sum) as u16;

        HTRLeaveSliceFinishCoord(cp_eep_value + edge_sum_ms * 96)
    }

    #[target_feature(enable = "avx2")]
    #[inline]
    pub unsafe fn unsafe_from_htr_finish_coord(cube: &Cube333) -> HTRFinishCoord {
        let orbit_corners = _mm_and_si128(_mm_srli_epi32::<6>(cube.corners.0), _mm_set1_epi8(0b00000011));
        let edges = _mm_srli_epi32::<4>(cube.edges.0);

        let values_246 = _mm_shuffle_epi8(orbit_corners, _mm_set_epi8(
            -1,-1,-1,-1,
            -1,-1,-1, 6,
            -1,-1, 4, 6,
            -1, 2, 4, 6));
        let higher_left_246 = _mm_and_si128(_mm_cmplt_epi8(values_246, _mm_shuffle_epi8(orbit_corners, _mm_set_epi8(
            -1,-1,-1,-1,
            -1,-1,-1, 4,
            -1,-1, 2, 2,
            -1, 0, 0, 0
        ))), _mm_set1_epi8(1));

        let values_e12 = _mm_shuffle_epi8(edges, _mm_set_epi8(
            -1,-1,-1,-1,
            -1,-1,-1, 7,
            -1,-1, 6, 7,
            -1, 5, 6, 7));
        let cmp_values = _mm_shuffle_epi8(edges, _mm_set_epi8(
            -1,-1,-1,-1,
            -1,-1,-1, 6,
            -1,-1, 5, 5,
            -1, 4, 4, 4));
        let higher_left_e12 = _mm_and_si128(_mm_cmplt_epi8(values_e12, cmp_values), _mm_set1_epi8(1));

        let sum = _mm_hadd_epi32(higher_left_246, higher_left_e12);
        let sum = _mm_hadd_epi32(sum, _mm_set1_epi8(0));

        let sum = _mm_or_si128(sum, _mm_shuffle_epi8(orbit_corners, _mm_set_epi8(-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1)));
        let sum = _mm_shuffle_epi8(sum, _mm_set_epi8(
            -1,-1,-1,-1,
            -1, 4,-1, 5,
            -1, 3,-1, 0,
            -1, 1,-1, 2));

        let binom = _mm_mullo_epi16(sum, _mm_set_epi16(0, 0, 3, 1, 24*12, 6*12, 2*12, 1*12));
        let full_sum = _mm_hadd_epi16(_mm_hadd_epi16(_mm_hadd_epi16(binom, _mm_set1_epi8(0)), _mm_set1_epi8(0)), _mm_set1_epi8(0));
        let cp_eep_value = _mm_extract_epi16::<0>(full_sum) as u32;

        let values_m123s123 = _mm_shuffle_epi8(edges, _mm_set_epi8(
            11,  9,  3, -1,
            11,  9, -1, 10,
            11, -1,  8, 10,
            -1,  2,  8, 10));
        let cmp_values = _mm_shuffle_epi8(edges, _mm_set_epi8(
            1,  1,  1, -1,
            3,  3, -1,  8,
            9, -1,  2,  2,
            -1,  0,  0,  0));
        let higher_left_m123s123 = _mm_and_si128(_mm_cmplt_epi8(values_m123s123, cmp_values), _mm_set1_epi8(1));
        //We're doing two sums at once
        let sum = _mm_hadd_epi32(higher_left_m123s123, _mm_set1_epi8(0));
        //Split CubeFace::up the two sums again
        let sum = _mm_shuffle_epi8(sum, _mm_set_epi8(
            -1,-1,-1, 3,
            -1, 5, 6, 7,
            -1,-1,-1, 4,
            -1, 2, 1, 0));


        let sum = _mm_hadd_epi32(sum, _mm_set1_epi8(0));
        let sum = _mm_shuffle_epi8(sum, _mm_set_epi8(
            -1, 7,-1, 4,
            -1, 5,-1, 6,
            -1, 3,-1, 0,
            -1, 1,-1, 2));
        let binom = _mm_mullo_epi16(sum, _mm_set_epi16(0, 6*24, 2*24, 1*24, 0, 6, 2, 1));
        let full_sum = _mm_hadd_epi16(_mm_hadd_epi16(_mm_hadd_epi16(binom, _mm_set1_epi8(0)), _mm_set1_epi8(0)), _mm_set1_epi8(0));

        let edge_sum_ms = _mm_extract_epi16::<0>(full_sum) as u32;

        HTRFinishCoord(cp_eep_value + edge_sum_ms * 1152)
    }
}

#[cfg(target_feature = "neon")]
mod neon {
    use std::arch::aarch64::{vadd_u8, vaddq_u8, vaddv_u8, vaddvq_u16, vand_u8, vandq_u8, vceq_u8, vclt_u8, vcltq_u8, vcombine_u8, vdup_n_u8, vdupq_n_u8, vget_low_u8, vld1_u8, vld1q_u8, vmul_u8, vmulq_u16, vorr_u8, vorrq_u8, vqtbl1_u8, vqtbl1q_u8, vreinterpretq_u16_u8, vshl_n_u8, vshlq_n_u8, vshr_n_u8, vshrq_n_u8, vtbl1_u8, vzip1q_u8};

    use crate::cube::{CornerCube333, Cube333, EdgeCube333};
    use crate::simd_util::neon::{C16, C8, extract_most_significant_bits_u8};
    use crate::steps::coord::neon::unsafe_permutation_8;
    use crate::steps::finish::coords::{CPCoord, DRFinishCoord, DRFinishNonSliceEP, DRFinishSliceCoord, DRLeaveSliceFinishCoord, FRUDFinishCoord, HTRFinishCoord, HTRLeaveSliceFinishCoord, inverse_permutation_n};

    pub(crate) unsafe fn unsafe_from_drfinish_slice_coord(value: &EdgeCube333) -> DRFinishSliceCoord {
        let edges = vqtbl1_u8(value.0, C8 { a_i8: [5, 6, 7, 6, 7, 7, -1, -1]}.a);
        let higher_left = vqtbl1_u8(value.0, C8 { a_i8: [4, 4, 4, 5, 5, 6, -1, -1]}.a);

        let higher_left = vand_u8(vclt_u8(edges, higher_left), vdup_n_u8(1));
        let sum = vadd_u8(higher_left, vtbl1_u8(higher_left, C8 { a_i8: [-1, 3, 4, -1, -1, -1, -1, -1]}.a));
        let sum = vadd_u8(sum, vtbl1_u8(sum, C8 { a_i8: [-1, -1, 5, -1, -1, -1, -1, -1]}.a));
        let prod = vmul_u8(sum, C8 { a_u8: [1, 2, 6, 0, 0, 0, 0, 0]}.a);
        DRFinishSliceCoord(vaddv_u8(prod))
    }

    pub unsafe fn unsafe_from_fr_finish_coord(cube: &Cube333) -> FRUDFinishCoord {
        let correct_ufl_corner_position = vceq_u8(cube.corners.0, vdup_n_u8(0b01100000));
        let correct_ufr_corner_position = vceq_u8(cube.corners.0, vdup_n_u8(0b01000000));

        let ufl_values = vand_u8(correct_ufl_corner_position, C8 { a_u8: [0, 1, 0, 0, 0, 2, 0, 3]}.a);
        let ufr_values = vand_u8(correct_ufr_corner_position, C8 { a_u8: [4, 0, 0, 0, 8, 0, 12, 0]}.a);

        let corners = vaddv_u8(vorr_u8(ufl_values, ufr_values));

        let edges = extract_most_significant_bits_u8(vget_low_u8(cube.edges.0)) & 0xF;

        let coord = corners << 4 | edges;
        FRUDFinishCoord(coord)
    }

    pub unsafe fn unsafe_from_htr_leave_slice_finish_coord(cube: &Cube333) -> HTRLeaveSliceFinishCoord {
        let orbit_corners = vand_u8(vshr_n_u8::<6>(cube.corners.0), vdup_n_u8(0b00000011));
        let edges = vshrq_n_u8::<4>(cube.edges.0);

        let values_246 = vtbl1_u8(orbit_corners, C8{ a_i8: [2, 4, 6, 4, 6, 6, -1, -1]}.a);
        let higher_left_246 = vand_u8(vclt_u8(values_246, vtbl1_u8(orbit_corners, C8{ a_i8: [0, 0, 0, 2, 2, 4, -1, -1]}.a)), vdup_n_u8(1));

        let values_e12 = vqtbl1_u8(edges, C8{ a_i8: [5, 6, 7, 6, 7, 7, -1, -1]}.a);
        let higher_left_e12 = vand_u8(vclt_u8(values_e12, vqtbl1_u8(edges, C8{ a_i8: [4, 4, 4, 5, 5, 6, -1, -1]}.a)), vdup_n_u8(1));

        let combined = vcombine_u8(higher_left_246, higher_left_e12);
        let sum = vaddq_u8(combined, vqtbl1q_u8(combined, C16{ a_i8: [-1, 3, 4, -1, -1, -1, -1, -1, -1, 11, 12, -1, -1, -1, -1, -1]}.a));
        let sum = vaddq_u8(sum, vqtbl1q_u8(sum, C16{ a_i8: [-1, -1, 5, -1, -1, -1, -1, -1, -1, -1, 13, -1, -1, -1, -1, -1]}.a));
        let sum = vqtbl1q_u8(sum, C16{ a_i8: [0, -1, 1, 2, 8, 9, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1]}.a);
        let sum = vorrq_u8(sum, vcombine_u8(vand_u8(orbit_corners, C8{ a_i8: [0, -1, 0, 0, 0, 0, 0, 0]}.a), vdup_n_u8(0)));
        let sum = vreinterpretq_u16_u8(vzip1q_u8(sum, vdupq_n_u8(0)));
        let binom = vmulq_u16(sum, C16{ a_u16: [1, 24, 2, 6, 0, 0, 0, 0]}.a_16);
        let cp_eep_value = vaddvq_u16(binom);

        let values_m123s123 = vqtbl1q_u8(edges, C16{ a_i8: [2, 8, 10, 8, 10, 10, -1, -1, 3, 9, 11, 9, 11, 11, -1, -1]}.a);
        let cmp_values = vqtbl1q_u8(edges, C16{ a_i8:      [0, 0,  0, 2,  2,  8, -1, -1, 1, 1,  1, 3,  3,  9, -1, -1]}.a);
        let higher_left_m123s123 = vandq_u8(vcltq_u8(values_m123s123, cmp_values), vdupq_n_u8(1));

        let sum = vaddq_u8(higher_left_m123s123, vqtbl1q_u8(higher_left_m123s123, C16{ a_i8: [-1, 3, 4, -1, -1, -1, -1, -1, -1, 11, 12, -1, -1, -1, -1, -1]}.a));
        let sum = vaddq_u8(sum, vqtbl1q_u8(sum, C16{ a_i8: [-1, -1, 5, -1, -1, -1, -1, -1, -1, -1, 13, -1, -1, -1, -1, -1]}.a));

        let sum = vreinterpretq_u16_u8(vqtbl1q_u8(sum, C16{ a_i8: [0, -1, 1, -1, 2, -1, 8, -1, 9, -1, 10, -1, -1, -1, -1, -1]}.a));
        let binom = vmulq_u16(sum, C16{ a_u16: [1, 2, 6, 1*24, 2*24, 6*24, 0, 0]}.a_16);
        let edge_sum_ms = vaddvq_u16(binom);

        HTRLeaveSliceFinishCoord(cp_eep_value + edge_sum_ms * 96)
    }

    pub unsafe fn unsafe_from_htr_finish_coord(cube: &Cube333) -> HTRFinishCoord {
        let orbit_corners = vand_u8(vshr_n_u8::<6>(cube.corners.0), vdup_n_u8(0b00000011));
        let edges = vshrq_n_u8::<4>(cube.edges.0);

        let values_246 = vtbl1_u8(orbit_corners, C8{ a_i8: [2, 4, 6, 4, 6, 6, -1, -1]}.a);
        let higher_left_246 = vand_u8(vclt_u8(values_246, vtbl1_u8(orbit_corners, C8{ a_i8: [0, 0, 0, 2, 2, 4, -1, -1]}.a)), vdup_n_u8(1));

        let values_e12 = vqtbl1_u8(edges, C8{ a_i8: [5, 6, 7, 6, 7, 7, -1, -1]}.a);
        let higher_left_e12 = vand_u8(vclt_u8(values_e12, vqtbl1_u8(edges, C8{ a_i8: [4, 4, 4, 5, 5, 6, -1, -1]}.a)), vdup_n_u8(1));

        let combined = vcombine_u8(higher_left_246, higher_left_e12);
        let sum = vaddq_u8(combined, vqtbl1q_u8(combined, C16{ a_i8: [-1, 3, 4, -1, -1, -1, -1, -1, -1, 11, 12, -1, -1, -1, -1, -1]}.a));
        let sum = vaddq_u8(sum, vqtbl1q_u8(sum, C16{ a_i8: [-1, -1, 5, -1, -1, -1, -1, -1, -1, -1, 13, -1, -1, -1, -1, -1]}.a));
        let sum = vqtbl1q_u8(sum, C16{ a_i8: [0, -1, 1, 2, 8, 9, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1]}.a);
        let sum = vorrq_u8(sum, vcombine_u8(vand_u8(orbit_corners, C8{ a_i8: [0, -1, 0, 0, 0, 0, 0, 0]}.a), vdup_n_u8(0)));
        let sum = vreinterpretq_u16_u8(vzip1q_u8(sum, vdupq_n_u8(0)));
        let binom = vmulq_u16(sum, C16{ a_u16: [1*12, 24*12, 2*12, 6*12, 0, 1, 3, 0]}.a_16);
        let cp_eep_value = vaddvq_u16(binom) as u32;

        let values_m123s123 = vqtbl1q_u8(edges, C16{ a_i8: [2, 8, 10, 8, 10, 10, -1, -1, 3, 9, 11, 9, 11, 11, -1, -1]}.a);
        let cmp_values = vqtbl1q_u8(edges, C16{ a_i8:      [0, 0,  0, 2,  2,  8, -1, -1, 1, 1,  1, 3,  3,  9, -1, -1]}.a);
        let higher_left_m123s123 = vandq_u8(vcltq_u8(values_m123s123, cmp_values), vdupq_n_u8(1));

        let sum = vaddq_u8(higher_left_m123s123, vqtbl1q_u8(higher_left_m123s123, C16{ a_i8: [-1, 3, 4, -1, -1, -1, -1, -1, -1, 11, 12, -1, -1, -1, -1, -1]}.a));
        let sum = vaddq_u8(sum, vqtbl1q_u8(sum, C16{ a_i8: [-1, -1, 5, -1, -1, -1, -1, -1, -1, -1, 13, -1, -1, -1, -1, -1]}.a));

        let sum = vreinterpretq_u16_u8(vqtbl1q_u8(sum, C16{ a_i8: [0, -1, 1, -1, 2, -1, 8, -1, 9, -1, 10, -1, -1, -1, -1, -1]}.a));
        let binom = vmulq_u16(sum, C16{ a_u16: [1, 2, 6, 1*24, 2*24, 6*24, 0, 0]}.a_16);
        let edge_sum_ms = vaddvq_u16(binom) as u32;

        HTRFinishCoord(cp_eep_value + edge_sum_ms * 1152)
    }

    pub(crate) unsafe fn unsafe_from_drfinish_edges_coord(value: &EdgeCube333) -> DRFinishNonSliceEP {
        let non_slice_edges = vqtbl1_u8(value.0, C8{ a_u8: [0, 1, 2, 3, 8, 9, 10, 11]}.a);
        DRFinishNonSliceEP(unsafe_permutation_8(vand_u8(vshr_n_u8::<4>(non_slice_edges), vdup_n_u8(0xF))))
    }

    pub(crate) unsafe fn unsafe_from_cpcoord(value: &CornerCube333) -> CPCoord {
        let cp_values = vand_u8(vshr_n_u8::<5>(value.0), vdup_n_u8(0b111));
        CPCoord(unsafe_permutation_8(cp_values))
    }

    pub(crate) unsafe fn unsafe_inverse_cube_from_drfinish(value: &DRFinishCoord) -> Cube333 {
        let cp = inverse_permutation_n::<8>(value.0.0 as u32);
        let cp_data = [cp.as_slice(), &[0;8]].concat();

        let val = std::arch::aarch64::vld1_u8(cp_data.as_ptr());
        let corners = CornerCube333::new(vshl_n_u8::<5>(val));

        let mut non_slice_edges = inverse_permutation_n::<8>(value.1.0 as u32);
        for i in 0..8 {
            if non_slice_edges[i] >= 4 {
                non_slice_edges[i] += 4;
            }
        }
        let mut slice_edges = inverse_permutation_n::<4>(value.2.0 as u32);
        for i in 0..4 {
            slice_edges[i] += 4;
        }
        let ep_data = [
            [&non_slice_edges[0..4], &slice_edges].concat(),
            [&non_slice_edges[4..8], &[0;4]].concat(),
        ].concat();

        let val = vld1q_u8(ep_data.as_ptr());
        let edges = EdgeCube333::new(vshlq_n_u8::<4>(val));
        Cube333::new(edges, corners)
    }

    pub(crate) unsafe fn unsafe_inverse_cube_from_drlsfinish(value: &DRLeaveSliceFinishCoord) -> Cube333 {
        let cp = inverse_permutation_n::<8>(value.0.0 as u32);
        let cp_data = [cp.as_slice(), &[0;8]].concat();
        let val = vld1_u8(cp_data.as_ptr());
        let corners = CornerCube333::new(vshl_n_u8::<5>(val));

        let mut non_slice_edges = inverse_permutation_n::<8>(value.1.0 as u32);
        for i in 0..8 {
            if non_slice_edges[i] >= 4 {
                non_slice_edges[i] += 4;
            }
        }
        let ep_data = [
            [&non_slice_edges[0..4], &[4, 5, 6, 7]].concat(),
            [&non_slice_edges[4..8], &[0;4]].concat(),
        ].concat();

        let val = vld1q_u8(ep_data.as_ptr());
        let edges = EdgeCube333::new(vshlq_n_u8::<4>(val));
        Cube333::new(edges, corners)
    }
}

#[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
mod wasm32 {
    use std::arch::wasm32::{u8x16, u8x16_bitmask, u8x16_eq, u8x16_extract_lane, v128_and, v128_or};

    use crate::puzzles::c333::Cube333;
    use crate::puzzles::c333::steps::finish::coords::FRUDFinishCoord;
    use crate::wasm_util::{mm_sad_epu8, u8x16_set1};

    #[inline]
    pub fn from_fr_finish_coord(cube: &Cube333) -> FRUDFinishCoord {
        let correct_ufl_corner_position = u8x16_eq(cube.corners.0, u8x16_set1(0b01100000));
        let correct_ufr_corner_position = u8x16_eq(cube.corners.0, u8x16_set1(0b01000000));

        let ufl_values = v128_and(correct_ufl_corner_position, u8x16(0, 1, 0, 0, 0, 2, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0));
        let ufr_values = v128_and(correct_ufr_corner_position, u8x16(4, 0, 0, 0, 8, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0));

        let edge_coord = mm_sad_epu8(v128_or(ufl_values, ufr_values));
        let corners = u8x16_extract_lane::<0>(edge_coord);

        let edges = (u8x16_bitmask(cube.edges.0) & 0xF) as u8;

        let coord = corners << 4 | edges;
        FRUDFinishCoord(coord)
    }
}