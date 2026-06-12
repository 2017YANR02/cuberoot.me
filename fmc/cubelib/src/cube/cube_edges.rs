use crate::cube::cube::Symmetry;
use crate::cube::turn::{ApplySymmetry, CubeOuterTurn, CubeTransformation, Edge, InvertibleMut, TransformableMut, TurnableMut};

//One byte per edge, 4 bits for id, 3 bits for eo (UD/FB/RL), 1 bit free
//UB UR UF UL FR FL BR BL DF DR DB DL
#[derive(Debug, Clone, Copy)]
pub struct CenterEdgeCube(
    #[cfg(target_feature = "avx2")] pub core::arch::x86_64::__m128i,
    #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
    pub core::arch::wasm32::v128,
    #[cfg(all(target_feature = "neon"))]
    pub core::arch::aarch64::uint8x16_t,
    // pub std::simd::u8x16;,
);

impl std::hash::Hash for CenterEdgeCube {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        let parts = self.get_edges_raw();
        state.write_u64(parts[0]);
        state.write_u64(parts[1]);
    }
}

// #[cfg(target_feature = "avx2")]
// impl std::hash::Hash for CenterEdgeCube {
//     fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
//         let parts = self.get_edges_raw();
//         state.write_u64(parts[0]);
//         state.write_u64(parts[1]);
//     }
// }
//
// #[cfg(target_feature = "neon")]
// impl std::hash::Hash for CenterEdgeCube {
//     fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
//         let parts = self.get_edges_raw();
//         state.write_u64(parts[0]);
//         state.write_u64(parts[1]);
//     }
// }

impl PartialEq for CenterEdgeCube {

    fn eq(&self, other: &Self) -> bool {
        let a = self.get_edges_raw();
        let b = other.get_edges_raw();
        a.eq(&b)
    }
}

impl Eq for CenterEdgeCube {

}

impl TurnableMut for CenterEdgeCube {
    #[inline]
    #[cfg(target_feature = "avx2")]
    fn turn(&mut self, m: CubeOuterTurn) {
        let CubeOuterTurn{face, dir} = m;
        unsafe { avx2::unsafe_turn(self, face, dir) }
    }

    #[inline]
    #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
    fn turn(&mut self, m: CubeOuterTurn) {
        let CubeOuterTurn{face, dir} = m;
        wasm32::turn(self, face, dir)
    }

    #[inline]
    #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
    fn turn(&mut self, m: CubeOuterTurn) {
        let CubeOuterTurn{face, dir} = m;
        unsafe { neon::unsafe_turn(self, face, dir) }
    }
}

impl TransformableMut for CenterEdgeCube {
    #[inline]
    #[cfg(target_feature = "avx2")]
    fn transform(&mut self, t: CubeTransformation) {
        let CubeTransformation{axis, dir} = t;
        unsafe {
            avx2::unsafe_transform(self, axis, dir);
        }
    }

    #[inline]
    #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
    fn transform(&mut self, t: CubeTransformation) {
        let CubeTransformation{axis, dir} = t;
        wasm32::transform(self, axis, dir)
    }

    #[inline]
    #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
    fn transform(&mut self, t: CubeTransformation) {
        let CubeTransformation{axis, dir} = t;
        unsafe { neon::unsafe_transform(self, axis, dir) }
    }
}

impl InvertibleMut for CenterEdgeCube {
    #[inline]
    #[cfg(target_feature = "avx2")]
    fn invert(&mut self) {
        unsafe {
            avx2::unsafe_invert(self);
        }
    }

    #[inline]
    #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
    fn invert(&mut self) {
        wasm32::invert(self)
    }

    #[inline]
    #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
    fn invert(&mut self) {
        unsafe { neon::unsafe_invert(self) }
    }
}

#[cfg(any(target_feature = "avx2", target_feature = "neon"))]
impl ApplySymmetry for CenterEdgeCube {
    fn apply_symmetry<T: AsRef<Symmetry>>(&mut self, s: T) {
        let s = s.as_ref();
        for t in s.1.iter().cloned() {
            self.transform(t);
        }
        if s.0 {
            self.mirror_z();
        }
    }
}

impl CenterEdgeCube {
    #[cfg(target_feature = "avx2")]
    pub fn new(state: std::arch::x86_64::__m128i) -> CenterEdgeCube {
        CenterEdgeCube(state)
    }

    #[cfg(target_feature = "neon")]
    pub fn new(state: std::arch::aarch64::uint8x16_t) -> CenterEdgeCube {
        CenterEdgeCube(state)
    }

    #[cfg(target_feature = "avx2")]
    pub fn get_edges(&self) -> [Edge; 12] {
        unsafe { avx2::unsafe_get_edges(self) }
    }

    #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
    pub fn get_edges(&self) -> [Edge; 12] {
        wasm32::get_edges(self)
    }

    #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
    pub fn get_edges(&self) -> [Edge; 12] {
        unsafe { neon::unsafe_get_edges(self) }
    }

    #[cfg(target_feature = "avx2")]
    pub fn get_edges_raw(&self) -> [u64; 2] {
        unsafe { avx2::unsafe_get_edges_raw(self) }
    }

    #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
    pub fn get_edges_raw(&self) -> [u64; 2] {
        wasm32::get_edges_raw(self)
    }

    #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
    pub fn get_edges_raw(&self) -> [u64; 2] {
        unsafe { neon::unsafe_get_edges_raw(self) }
    }
}

#[cfg(feature = "serde_support")]
impl serde::Serialize for CenterEdgeCube {

    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error> where S: serde::Serializer {
        let mut bytes = [0_u8; 16];
        unsafe {
            #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
            std::arch::wasm32::v128_store(bytes.as_mut_ptr() as *mut std::arch::wasm32::v128, self.0);
            #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
            std::arch::aarch64::vst1q_u8(bytes.as_mut_ptr(), self.0);
            #[cfg(target_feature = "avx2")]
            std::arch::x86_64::_mm_store_si128(bytes.as_mut_ptr() as *mut std::arch::x86_64::__m128i, self.0);
        }
        serializer.serialize_bytes(&bytes)
    }
}

#[cfg(feature = "serde_support")]
struct EdgeCubieCubeVisitor;

#[cfg(feature = "serde_support")]
impl<'de> serde::de::Visitor<'de> for EdgeCubieCubeVisitor {
    type Value = CenterEdgeCube;

    fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
        formatter.write_str("a byte array of length 16")
    }

    fn visit_bytes<E>(self, v: &[u8]) -> Result<Self::Value, E> where E: serde::de::Error {
        if v.len() != 16 {
            Err(E::custom("Array length must be 16"))
        } else {
            let val = unsafe {
                #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
                let val = std::arch::wasm32::v128_load(v.as_ptr() as *const std::arch::wasm32::v128);
                #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
                let val = std::arch::aarch64::vld1q_u8(v.as_ptr());
                #[cfg(target_feature = "avx2")]
                let val = std::arch::x86_64::_mm_load_si128(v.as_ptr() as *const std::arch::x86_64::__m128i);
                val
            };
            Ok(CenterEdgeCube(val))
        }
    }
}

#[cfg(feature = "serde_support")]
impl<'de> serde::Deserialize<'de> for CenterEdgeCube {
    fn deserialize<D>(deserializer: D) -> Result<CenterEdgeCube, D::Error>
        where
            D: serde::Deserializer<'de>,
    {
        deserializer.deserialize_bytes(EdgeCubieCubeVisitor)
    }
}

impl Default for CenterEdgeCube {
    #[inline]
    #[cfg(target_feature = "avx2")]
    fn default() -> Self {
        unsafe { avx2::unsafe_new_solved() }
    }

    #[inline]
    #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
    fn default() -> Self {
        wasm32::new_solved()
    }

    #[inline]
    #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
    fn default() -> Self {
        unsafe { neon::unsafe_new_solved() }
    }
}

impl CenterEdgeCube {
    #[inline]
    #[cfg(target_feature = "avx2")]
    pub fn random<T: rand::Rng>(parity: bool, rng: &mut T) -> Self {
        let bytes = random_edges(parity, rng);
        unsafe { avx2::unsafe_from_bytes(bytes) }
    }

    // #[inline]
    // #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
    // pub fn random<T: Rng>(parity: bool, rng: &mut T) -> Self {
    //     let bytes = random_edges(parity, rng);
    //     wasm32::from_bytes(bytes)
    // }

    #[inline]
    #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
    pub fn random<T: rand::Rng>(parity: bool, rng: &mut T) -> Self {
        let bytes = random_edges(parity, rng);
        unsafe { neon::unsafe_from_bytes(bytes) }
    }
}

impl CenterEdgeCube {
    #[inline]
    #[cfg(target_feature = "avx2")]
    pub(crate) fn mirror_z(&mut self) {
        unsafe { avx2::unsafe_mirror_z(self) }
    }

    #[inline]
    #[cfg(target_feature = "neon")]
    pub(crate) fn mirror_z(&mut self) {
        unsafe { neon::unsafe_mirror_z(self) }
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn random_edges<T: rand::Rng>(parity: bool, rng: &mut T) -> [u8; 12] {
    let mut edge_bytes: [u8; 12] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    let mut orientation_parity = false;
    let mut swap_parity = false;

    fn get_bytes(position_id: u8, piece_id: u8, flipped: bool) -> u8 {
        let slice = [0, 2, 0, 2, 1, 1, 1, 1, 0, 2, 0, 2]; // 0 = M, 1 = E, 2 = S
        let default_orientation: [u8; 4] = [
            0, // Piece is in its home slice
            2, // M <-> E
            4, // M <-> S
            6, // E <-> S
        ];
        let mut orientation: u8 = default_orientation[(slice[piece_id as usize] ^ slice[position_id as usize]) as usize];
        if flipped {
            orientation ^= 7;
        }
        (piece_id << 4) | (orientation << 1)
    }

    for i in 0..10 {
        let swap_index = rng.random_range(i..12);
        if swap_index != i {
            edge_bytes.swap(i, swap_index);
            swap_parity = !swap_parity;
        }
        let flipped = if rng.random_bool(0.5) {
            orientation_parity = !orientation_parity;
            true
        } else { false };
        edge_bytes[i] = get_bytes(i as u8, edge_bytes[i], flipped);
    }

    // Last position determined by parity
    if swap_parity != parity {
        edge_bytes.swap(10, 11);
    }
    let flipped = if rng.random_bool(0.5) {
        orientation_parity = !orientation_parity;
        true
    } else { false };
    edge_bytes[10] = get_bytes(10, edge_bytes[10], flipped);
    // Last orientation determined by parity
    edge_bytes[11] = get_bytes(11, edge_bytes[11], orientation_parity);
    edge_bytes
}

// mod portable_simd {
//     use std::simd::{simd_swizzle, u8x16};
//     use crate::cube::{CubeAxis, CubeFace, Direction, Edge};
//     use crate::cube::cube_edges::CenterEdgeCube;
//
//     const VALID_EDGE_MASK_HI: u64 = 0x00000000FFFFFFFF;
//
//     //UB UR UF UL FR FL BR BL DF DR DB DL
//     // 0  1  2  3  4  5  6  7  8  9 10 11
//     const TURN_EDGE_SHUFFLE: [[u8x16; 3]; 6] = [
//         [
//             u8x16::from_array([3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF]), //U
//             u8x16::from_array([2, 3, 0, 1, 4, 5, 6, 7, 8, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF]), //U2
//             u8x16::from_array([1, 2, 3, 0, 4, 5, 6, 7, 8, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF]), //U'
//         ],
//         [
//             u8x16::from_array([0, 1, 2, 3, 4, 5, 6, 7, 11, 8, 9, 10, 0xFF, 0xFF, 0xFF, 0xFF]), //D
//             u8x16::from_array([0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 8, 9, 0xFF, 0xFF, 0xFF, 0xFF]), //D2
//             u8x16::from_array([0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 8, 0xFF, 0xFF, 0xFF, 0xFF]), //D'
//         ],
//         [
//             u8x16::from_array([0, 1, 5, 3, 2, 8, 6, 7, 4, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF]), //F
//             u8x16::from_array([0, 1, 8, 3, 5, 4, 6, 7, 2, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF]), //F2
//             u8x16::from_array([0, 1, 4, 3, 8, 2, 6, 7, 5, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF]), //F'
//         ],
//         [
//             u8x16::from_array([6, 1, 2, 3, 4, 5, 10, 0, 8, 9, 7, 11, 0xFF, 0xFF, 0xFF, 0xFF]), //B
//             u8x16::from_array([10, 1, 2, 3, 4, 5, 7, 6, 8, 9, 0, 11, 0xFF, 0xFF, 0xFF, 0xFF]), //B2
//             u8x16::from_array([7, 1, 2, 3, 4, 5, 0, 10, 8, 9, 6, 11, 0xFF, 0xFF, 0xFF, 0xFF]), //B'
//         ],
//         [
//             u8x16::from_array([0, 1, 2, 7, 4, 3, 6, 11, 8, 9, 10, 5, 0xFF, 0xFF, 0xFF, 0xFF]), //L
//             u8x16::from_array([0, 1, 2, 11, 4, 7, 6, 5, 8, 9, 10, 3, 0xFF, 0xFF, 0xFF, 0xFF]), //L2
//             u8x16::from_array([0, 1, 2, 5, 4, 11, 6, 3, 8, 9, 10, 7, 0xFF, 0xFF, 0xFF, 0xFF]), //L'
//         ],
//         [
//             u8x16::from_array([0, 4, 2, 3, 9, 5, 1, 7, 8, 6, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF]), //R
//             u8x16::from_array([0, 9, 2, 3, 6, 5, 4, 7, 8, 1, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF]), //R2
//             u8x16::from_array([0, 6, 2, 3, 1, 5, 9, 7, 8, 4, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF]), //R'
//         ],
//     ];
//
//     const TURN_EO_FLIP: [u8x16; 6] = [
//         u8x16::from_array([0b00001000, 0b00001000, 0b00001000, 0b00001000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ]), //U
//         u8x16::from_array([0, 0, 0, 0, 0, 0, 0, 0, 0b00001000, 0b00001000, 0b00001000, 0b00001000, 0, 0, 0, 0, ]), //D
//         u8x16::from_array([0, 0, 0b00000100, 0, 0b00000100, 0b00000100, 0, 0, 0b00000100, 0, 0, 0, 0, 0, 0, 0, ]), //F
//         u8x16::from_array([0b00000100, 0, 0, 0, 0, 0, 0b00000100, 0b00000100, 0, 0, 0b00000100, 0, 0, 0, 0, 0, ]), //B
//         u8x16::from_array([0, 0, 0, 0b00000010, 0, 0b00000010, 0, 0b00000010, 0, 0, 0, 0b00000010, 0, 0, 0, 0, ]), //L
//         u8x16::from_array([0, 0b00000010, 0, 0, 0b00000010, 0, 0b00000010, 0, 0, 0b00000010, 0, 0, 0, 0, 0, 0, ]), //R
//     ];
//
//     const TRANSFORMATION_EP_SHUFFLE: [[u8x16; 3]; 3] = [
//         [
//             u8x16::from_array([2, 4, 8, 5, 9, 11, 1, 3, 10, 6, 0, 7, 0xFF, 0xFF, 0xFF, 0xFF]), //x
//             u8x16::from_array([8, 9, 10, 11, 6, 7, 4, 5, 0, 1, 2, 3, 0xFF, 0xFF, 0xFF, 0xFF]), //x2
//             u8x16::from_array([10, 6, 0, 7, 1, 3, 9, 11, 2, 4, 8, 5, 0xFF, 0xFF, 0xFF, 0xFF]), //x'
//         ],
//         [
//             u8x16::from_array([3, 0, 1, 2, 6, 4, 7, 5, 9, 10, 11, 8, 0xFF, 0xFF, 0xFF, 0xFF]), //y
//             u8x16::from_array([2, 3, 0, 1, 7, 6, 5, 4, 10, 11, 8, 9, 0xFF, 0xFF, 0xFF, 0xFF]), //y2
//             u8x16::from_array([1, 2, 3, 0, 5, 7, 4, 6, 11, 8, 9, 10, 0xFF, 0xFF, 0xFF, 0xFF]), //y'
//         ],
//         [
//             u8x16::from_array([7, 3, 5, 11, 2, 8, 0, 10, 4, 1, 6, 9, 0xFF, 0xFF, 0xFF, 0xFF]), //z
//             u8x16::from_array([10, 11, 8, 9, 5, 4, 7, 6, 2, 3, 0, 1, 0xFF, 0xFF, 0xFF, 0xFF]), //z2
//             u8x16::from_array([6, 9, 4, 1, 8, 2, 10, 0, 5, 11, 7, 3, 0xFF, 0xFF, 0xFF, 0xFF]), //z'
//         ],
//     ];
//
//     const TRANSFORMATION_EO_MAP: [u8x16; 3] = [
//         u8x16::from_array([0b0000, 0xFF, 0b0010, 0xFF, 0b1000, 0xFF, 0b1010, 0xFF, 0b0100, 0xFF, 0b0110, 0xFF, 0b1100, 0xFF, 0b1110, 0xFF, ]), //X
//         u8x16::from_array([0b0000, 0xFF, 0b0100, 0xFF, 0b0010, 0xFF, 0b0110, 0xFF, 0b1000, 0xFF, 0b1100, 0xFF, 0b1010, 0xFF, 0b1110, 0xFF, ]), //Y
//         u8x16::from_array([0b0000, 0xFF, 0b1000, 0xFF, 0b0100, 0xFF, 0b1100, 0xFF, 0b0010, 0xFF, 0b1010, 0xFF, 0b0110, 0xFF, 0b1110, 0xFF, ]), //Z
//     ];
//
//     pub(crate) unsafe fn unsafe_get_edges_raw(cube: &CenterEdgeCube) -> &[u64; 2] {
//         (cube.0.into() as std::simd::u64x2).as_array()
//     }
//
//     pub(crate) unsafe fn unsafe_new_solved() -> CenterEdgeCube {
//         CenterEdgeCube(u8x16::from_array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 0, 0, 0]))
//     }
//
//     pub(crate) unsafe fn unsafe_from_bytes(bytes: [u8; 12]) -> CenterEdgeCube {
//         let mut data = [0; 16];
//         data.copy_from_slice(&bytes);
//         CenterEdgeCube(u8x16::from_array(data))
//     }
//
//     pub(crate) unsafe fn unsafe_turn(cube: &mut CenterEdgeCube, face: CubeFace, dir: Direction) {
//         cube.0 = cube.0.swizzle_dyn(TURN_EDGE_SHUFFLE[face as usize][dir as usize]);
//         if dir != Direction::Half {
//             cube.0 = cube.0 ^ &TURN_EO_FLIP[face as usize];
//         }
//     }
//
//     // pub(crate) unsafe fn unsafe_mirror_z(cube: &mut CenterEdgeCube) {
//     //     let mirror_mask = _mm_setr_epi8(0, 3, 2, 1, 5, 4, 7, 6, 8, 11, 10, 9, -1, -1, -1, -1);
//     //     let edges = _mm_shuffle_epi8(cube.0, mirror_mask);
//     //     let translated_ep = _mm_slli_epi32::<4>(_mm_shuffle_epi8(
//     //         mirror_mask,
//     //         _mm_and_si128(_mm_set1_epi8(0xF), _mm_srli_epi32::<4>(edges)),
//     //     ));
//     //     let translated_eo = _mm_and_si128(edges, _mm_set1_epi8(0xF));
//     //     cube.0 = _mm_or_si128(translated_ep, translated_eo);
//     // }
//     //
//     // pub(crate) unsafe fn unsafe_transform(
//     //     cube: &mut CenterEdgeCube,
//     //     axis: CubeAxis,
//     //     dir: Direction,
//     // ) {
//     //     let edges_translated = _mm_shuffle_epi8(
//     //         cube.0,
//     //         TRANSFORMATION_EP_SHUFFLE[axis as usize][dir as usize],
//     //     );
//     //     let ep = _mm_srli_epi32::<4>(_mm_and_si128(
//     //         edges_translated,
//     //         _mm_set1_epi8(0xF0_u8 as i8),
//     //     ));
//     //     let eo = _mm_and_si128(edges_translated, _mm_set1_epi8(0b00001110));
//     //     let ep_translated = _mm_slli_epi32::<4>(_mm_shuffle_epi8(
//     //         TRANSFORMATION_EP_SHUFFLE[axis as usize][dir.invert() as usize],
//     //         ep,
//     //     ));
//     //     let eo = if dir != Direction::Half {
//     //         _mm_shuffle_epi8(TRANSFORMATION_EO_MAP[axis], eo)
//     //     } else {
//     //         eo
//     //     };
//     //     cube.0 = _mm_or_si128(ep_translated, eo);
//     // }
//     //
//     // pub(crate) unsafe fn unsafe_invert(cube: &mut CenterEdgeCube) {
//     //     let edge_ids = unsafe {
//     //         let mut a_arr = AlignedU8([0u8; 16]);
//     //         _mm_store_si128(
//     //             a_arr.0.as_mut_ptr() as *mut __m128i,
//     //             _mm_srli_epi32::<4>(_mm_and_si128(cube.0, _mm_set1_epi8(0xF0_u8 as i8))),
//     //         );
//     //         a_arr
//     //     };
//     //     //This essentially calculates the inverse of _mm_shuffle_epi8(solved_cube.edges, self.edges), same for corners
//     //     let mut edge_shuffle = AlignedU8([0u8; 16]);
//     //     let edges = edge_ids.0;
//     //     for i in 0..12 {
//     //         edge_shuffle.0[edges[i] as usize] = i as u8;
//     //     }
//     //     let edge_shuffle_mask = _mm_load_si128(edge_shuffle.0.as_ptr() as *const __m128i);
//     //
//     //     //Splice together the edge permutation, and the EO of the edges on the inverse (see niss prediction to see how this works)
//     //     let ep = _mm_and_si128(
//     //         _mm_shuffle_epi8(
//     //             _mm_shuffle_epi8(cube.0, edge_shuffle_mask),
//     //             edge_shuffle_mask,
//     //         ),
//     //         _mm_set1_epi8(0xF0_u8 as i8),
//     //     );
//     //     let eo_shuffle = _mm_shuffle_epi8(cube.0, _mm_srli_epi32::<4>(ep));
//     //     let eo = _mm_and_si128(eo_shuffle, _mm_set1_epi8(0b1110));
//     //
//     //     cube.0 = _mm_or_si128(ep, eo);
//     // }
// }

#[cfg(target_feature = "avx2")]
mod avx2 {
    use std::arch::x86_64::{
        __m128i, _mm_and_si128, _mm_load_si128,
        _mm_or_si128, _mm_set1_epi8, _mm_setr_epi8,
        _mm_shuffle_epi8, _mm_slli_epi32, _mm_slli_epi64, _mm_srli_epi32,
        _mm_store_si128, _mm_xor_si128,
    };

    use crate::cube::{CubeAxis, CubeFace, Direction, Edge};
    use crate::cube::cube_edges::CenterEdgeCube;
    use crate::simd_util::{AlignedU64, AlignedU8};
    use crate::simd_util::avx2::C;

    const VALID_EDGE_MASK_HI: u64 = 0x00000000FFFFFFFF;

    //UB UR UF UL FR FL BR BL DF DR DB DL
    // 0  1  2  3  4  5  6  7  8  9 10 11
    const TURN_EDGE_SHUFFLE: [[__m128i; 3]; 6] = [
        [
            unsafe { C { a_u8: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //U
            unsafe { C { a_u8: [2, 3, 0, 1, 4, 5, 6, 7, 8, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //U2
            unsafe { C { a_u8: [1, 2, 3, 0, 4, 5, 6, 7, 8, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //U'
        ],
        [
            unsafe { C { a_u8: [0, 1, 2, 3, 4, 5, 6, 7, 11, 8, 9, 10, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //D
            unsafe { C { a_u8: [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 8, 9, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //D2
            unsafe { C { a_u8: [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 8, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //D'
        ],
        [
            unsafe { C { a_u8: [0, 1, 5, 3, 2, 8, 6, 7, 4, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //F
            unsafe { C { a_u8: [0, 1, 8, 3, 5, 4, 6, 7, 2, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //F2
            unsafe { C { a_u8: [0, 1, 4, 3, 8, 2, 6, 7, 5, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //F'
        ],
        [
            unsafe { C { a_u8: [6, 1, 2, 3, 4, 5, 10, 0, 8, 9, 7, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //B
            unsafe { C { a_u8: [10, 1, 2, 3, 4, 5, 7, 6, 8, 9, 0, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //B2
            unsafe { C { a_u8: [7, 1, 2, 3, 4, 5, 0, 10, 8, 9, 6, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //B'
        ],
        [
            unsafe { C { a_u8: [0, 1, 2, 7, 4, 3, 6, 11, 8, 9, 10, 5, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //L
            unsafe { C { a_u8: [0, 1, 2, 11, 4, 7, 6, 5, 8, 9, 10, 3, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //L2
            unsafe { C { a_u8: [0, 1, 2, 5, 4, 11, 6, 3, 8, 9, 10, 7, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //L'
        ],
        [
            unsafe { C { a_u8: [0, 4, 2, 3, 9, 5, 1, 7, 8, 6, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //R
            unsafe { C { a_u8: [0, 9, 2, 3, 6, 5, 4, 7, 8, 1, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //R2
            unsafe { C { a_u8: [0, 6, 2, 3, 1, 5, 9, 7, 8, 4, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //R'
        ],
    ];

    const TURN_EO_FLIP: [__m128i; 6] = [
        unsafe { C { a_u8: [0b00001000, 0b00001000, 0b00001000, 0b00001000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ], }.a }, //U
        unsafe { C { a_u8: [0, 0, 0, 0, 0, 0, 0, 0, 0b00001000, 0b00001000, 0b00001000, 0b00001000, 0, 0, 0, 0, ], }.a }, //D
        unsafe { C { a_u8: [0, 0, 0b00000100, 0, 0b00000100, 0b00000100, 0, 0, 0b00000100, 0, 0, 0, 0, 0, 0, 0, ], }.a }, //F
        unsafe { C { a_u8: [0b00000100, 0, 0, 0, 0, 0, 0b00000100, 0b00000100, 0, 0, 0b00000100, 0, 0, 0, 0, 0, ], }.a }, //B
        unsafe { C { a_u8: [0, 0, 0, 0b00000010, 0, 0b00000010, 0, 0b00000010, 0, 0, 0, 0b00000010, 0, 0, 0, 0, ], }.a }, //L
        unsafe { C { a_u8: [0, 0b00000010, 0, 0, 0b00000010, 0, 0b00000010, 0, 0, 0b00000010, 0, 0, 0, 0, 0, 0, ], }.a }, //R
    ];

    const TRANSFORMATION_EP_SHUFFLE: [[__m128i; 3]; 3] = [
        [
            unsafe { C { a_u8: [2, 4, 8, 5, 9, 11, 1, 3, 10, 6, 0, 7, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //x
            unsafe { C { a_u8: [8, 9, 10, 11, 6, 7, 4, 5, 0, 1, 2, 3, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //x2
            unsafe { C { a_u8: [10, 6, 0, 7, 1, 3, 9, 11, 2, 4, 8, 5, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //x'
        ],
        [
            unsafe { C { a_u8: [3, 0, 1, 2, 6, 4, 7, 5, 9, 10, 11, 8, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //y
            unsafe { C { a_u8: [2, 3, 0, 1, 7, 6, 5, 4, 10, 11, 8, 9, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //y2
            unsafe { C { a_u8: [1, 2, 3, 0, 5, 7, 4, 6, 11, 8, 9, 10, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //y'
        ],
        [
            unsafe { C { a_u8: [7, 3, 5, 11, 2, 8, 0, 10, 4, 1, 6, 9, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //z
            unsafe { C { a_u8: [10, 11, 8, 9, 5, 4, 7, 6, 2, 3, 0, 1, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //z2
            unsafe { C { a_u8: [6, 9, 4, 1, 8, 2, 10, 0, 5, 11, 7, 3, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //z'
        ],
    ];

    const TRANSFORMATION_EO_MAP: [__m128i; 3] = [
        unsafe { C { a_u8: [0b0000, 0xFF, 0b0010, 0xFF, 0b1000, 0xFF, 0b1010, 0xFF, 0b0100, 0xFF, 0b0110, 0xFF, 0b1100, 0xFF, 0b1110, 0xFF, ], }.a }, //X
        unsafe { C { a_u8: [0b0000, 0xFF, 0b0100, 0xFF, 0b0010, 0xFF, 0b0110, 0xFF, 0b1000, 0xFF, 0b1100, 0xFF, 0b1010, 0xFF, 0b1110, 0xFF, ], }.a }, //X
        unsafe { C { a_u8: [0b0000, 0xFF, 0b1000, 0xFF, 0b0100, 0xFF, 0b1100, 0xFF, 0b0010, 0xFF, 0b1010, 0xFF, 0b0110, 0xFF, 0b1110, 0xFF, ], }.a }, //X
    ];

    #[target_feature(enable = "avx2")]
    pub(crate) unsafe fn unsafe_get_edges_raw(cube: &CenterEdgeCube) -> [u64; 2] {
        let mut a_arr = AlignedU64([0u64; 2]).0;
        _mm_store_si128(a_arr.as_mut_ptr() as *mut __m128i, cube.0);
        a_arr[1] &= VALID_EDGE_MASK_HI;
        a_arr
    }

    #[target_feature(enable = "avx2")]
    pub(crate) unsafe fn unsafe_new_solved() -> CenterEdgeCube {
        CenterEdgeCube(_mm_slli_epi64::<4>(_mm_setr_epi8( 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 0, 0, 0)))
    }

    #[target_feature(enable = "avx2")]
    pub(crate) unsafe fn unsafe_from_bytes(bytes: [u8; 12]) -> CenterEdgeCube {
        CenterEdgeCube(_mm_setr_epi8(bytes[0] as i8, bytes[1] as i8, bytes[2] as i8, bytes[3] as i8,
                                     bytes[4] as i8, bytes[5] as i8, bytes[6] as i8, bytes[7] as i8,
                                     bytes[8] as i8, bytes[9] as i8, bytes[10] as i8, bytes[11] as i8,
                                     0, 0, 0, 0))
    }

    #[target_feature(enable = "avx2")]
    pub unsafe fn unsafe_get_edges(cube: &CenterEdgeCube) -> [Edge; 12] {
        let mut edges = unsafe {
            let mut a_arr = AlignedU64([0u64; 2]).0;
            _mm_store_si128(a_arr.as_mut_ptr() as *mut __m128i, cube.0);
            a_arr
        };
        let mut edge_arr = [Edge {
            id: 0,
            oriented_ud: true,
            oriented_fb: true,
            oriented_rl: true,
        }; 12];

        for eid in 0..12 {
            let arr_id = eid / 8;
            let edge = (edges[arr_id] & 0xFF) as u8;
            edges[arr_id] >>= 8;

            let rl = edge & 0b0010 == 0;
            let fb = edge & 0b0100 == 0;
            let ud = edge & 0b1000 == 0;

            edge_arr[eid] = Edge {
                id: edge >> 4,
                oriented_ud: ud,
                oriented_fb: fb,
                oriented_rl: rl,
            };
        }

        edge_arr
    }

    #[target_feature(enable = "avx2")]
    pub(crate) unsafe fn unsafe_turn(cube: &mut CenterEdgeCube, face: CubeFace, dir: Direction) {
        cube.0 = _mm_shuffle_epi8(
            cube.0,
            TURN_EDGE_SHUFFLE[face as usize][dir as usize],
        );
        if dir != Direction::Half {
            cube.0 = _mm_xor_si128(cube.0, TURN_EO_FLIP[face as usize]);
        }
    }

    #[target_feature(enable = "avx2")]
    pub(crate) unsafe fn unsafe_mirror_z(cube: &mut CenterEdgeCube) {
        let mirror_mask = _mm_setr_epi8(0, 3, 2, 1, 5, 4, 7, 6, 8, 11, 10, 9, -1, -1, -1, -1);
        let edges = _mm_shuffle_epi8(cube.0, mirror_mask);
        let translated_ep = _mm_slli_epi32::<4>(_mm_shuffle_epi8(
            mirror_mask,
            _mm_and_si128(_mm_set1_epi8(0xF), _mm_srli_epi32::<4>(edges)),
        ));
        let translated_eo = _mm_and_si128(edges, _mm_set1_epi8(0xF));
        cube.0 = _mm_or_si128(translated_ep, translated_eo);
    }

    #[target_feature(enable = "avx2")]
    pub(crate) unsafe fn unsafe_transform(
        cube: &mut CenterEdgeCube,
        axis: CubeAxis,
        dir: Direction,
    ) {
        let edges_translated = _mm_shuffle_epi8(
            cube.0,
            TRANSFORMATION_EP_SHUFFLE[axis as usize][dir as usize],
        );
        let ep = _mm_srli_epi32::<4>(_mm_and_si128(
            edges_translated,
            _mm_set1_epi8(0xF0_u8 as i8),
        ));
        let eo = _mm_and_si128(edges_translated, _mm_set1_epi8(0b00001110));
        let ep_translated = _mm_slli_epi32::<4>(_mm_shuffle_epi8(
            TRANSFORMATION_EP_SHUFFLE[axis as usize][dir.invert() as usize],
            ep,
        ));
        let eo = if dir != Direction::Half {
            _mm_shuffle_epi8(TRANSFORMATION_EO_MAP[axis], eo)
        } else {
            eo
        };
        cube.0 = _mm_or_si128(ep_translated, eo);
    }

    #[target_feature(enable = "avx2")]
    pub(crate) unsafe fn unsafe_invert(cube: &mut CenterEdgeCube) {
        let edge_ids = unsafe {
            let mut a_arr = AlignedU8([0u8; 16]);
            _mm_store_si128(
                a_arr.0.as_mut_ptr() as *mut __m128i,
                _mm_srli_epi32::<4>(_mm_and_si128(cube.0, _mm_set1_epi8(0xF0_u8 as i8))),
            );
            a_arr
        };
        //This essentially calculates the inverse of _mm_shuffle_epi8(solved_cube.edges, self.edges), same for corners
        let mut edge_shuffle = AlignedU8([0u8; 16]);
        let edges = edge_ids.0;
        for i in 0..12 {
            edge_shuffle.0[edges[i] as usize] = i as u8;
        }
        let edge_shuffle_mask = _mm_load_si128(edge_shuffle.0.as_ptr() as *const __m128i);

        //Splice together the edge permutation, and the EO of the edges on the inverse (see niss prediction to see how this works)
        let ep = _mm_and_si128(
            _mm_shuffle_epi8(
                _mm_shuffle_epi8(cube.0, edge_shuffle_mask),
                edge_shuffle_mask,
            ),
            _mm_set1_epi8(0xF0_u8 as i8),
        );
        let eo_shuffle = _mm_shuffle_epi8(cube.0, _mm_srli_epi32::<4>(ep));
        let eo = _mm_and_si128(eo_shuffle, _mm_set1_epi8(0b1110));

        cube.0 = _mm_or_si128(ep, eo);
    }
}


#[cfg(target_feature = "neon")]
mod neon {
    use std::arch::aarch64::{uint8x16_t, vandq_u8, vdupq_n_u8, veorq_u8, vld1q_u8, vorrq_u8, vqtbl1q_u8, vreinterpretq_u64_u8, vshlq_n_u8, vshrq_n_u8, vst1q_u64, vst1q_u8};

    use crate::cube::{CubeAxis, CubeFace, Direction, Edge};
    use crate::cube::cube_edges::CenterEdgeCube;
    use crate::simd_util::{AlignedU64, AlignedU8};
    use crate::simd_util::neon::C16;

    const VALID_EDGE_MASK_HI: u64 = 0x00000000FFFFFFFF;

    //UB UR UF UL FR FL BR BL DF DR DB DL
    // 0  1  2  3  4  5  6  7  8  9 10 11
    const TURN_EDGE_SHUFFLE: [[uint8x16_t; 3]; 6] = [
        [
            unsafe { C16 { a_u8: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //U
            unsafe { C16 { a_u8: [2, 3, 0, 1, 4, 5, 6, 7, 8, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //U2
            unsafe { C16 { a_u8: [1, 2, 3, 0, 4, 5, 6, 7, 8, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //U'
        ],
        [
            unsafe { C16 { a_u8: [0, 1, 2, 3, 4, 5, 6, 7, 11, 8, 9, 10, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //D
            unsafe { C16 { a_u8: [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 8, 9, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //D2
            unsafe { C16 { a_u8: [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 8, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //D'
        ],
        [
            unsafe { C16 { a_u8: [0, 1, 5, 3, 2, 8, 6, 7, 4, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //F
            unsafe { C16 { a_u8: [0, 1, 8, 3, 5, 4, 6, 7, 2, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //F2
            unsafe { C16 { a_u8: [0, 1, 4, 3, 8, 2, 6, 7, 5, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //F'
        ],
        [
            unsafe { C16 { a_u8: [6, 1, 2, 3, 4, 5, 10, 0, 8, 9, 7, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //B
            unsafe { C16 { a_u8: [10, 1, 2, 3, 4, 5, 7, 6, 8, 9, 0, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //B2
            unsafe { C16 { a_u8: [7, 1, 2, 3, 4, 5, 0, 10, 8, 9, 6, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //B'
        ],
        [
            unsafe { C16 { a_u8: [0, 1, 2, 7, 4, 3, 6, 11, 8, 9, 10, 5, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //L
            unsafe { C16 { a_u8: [0, 1, 2, 11, 4, 7, 6, 5, 8, 9, 10, 3, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //L2
            unsafe { C16 { a_u8: [0, 1, 2, 5, 4, 11, 6, 3, 8, 9, 10, 7, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //L'
        ],
        [
            unsafe { C16 { a_u8: [0, 4, 2, 3, 9, 5, 1, 7, 8, 6, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //R
            unsafe { C16 { a_u8: [0, 9, 2, 3, 6, 5, 4, 7, 8, 1, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //R2
            unsafe { C16 { a_u8: [0, 6, 2, 3, 1, 5, 9, 7, 8, 4, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //R'
        ],
    ];

    const TURN_EO_FLIP: [uint8x16_t; 6] = [
        unsafe { C16 { a_u8: [0b00001000, 0b00001000, 0b00001000, 0b00001000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ], }.a }, //U
        unsafe { C16 { a_u8: [0, 0, 0, 0, 0, 0, 0, 0, 0b00001000, 0b00001000, 0b00001000, 0b00001000, 0, 0, 0, 0, ], }.a }, //D
        unsafe { C16 { a_u8: [0, 0, 0b00000100, 0, 0b00000100, 0b00000100, 0, 0, 0b00000100, 0, 0, 0, 0, 0, 0, 0, ], }.a }, //F
        unsafe { C16 { a_u8: [0b00000100, 0, 0, 0, 0, 0, 0b00000100, 0b00000100, 0, 0, 0b00000100, 0, 0, 0, 0, 0, ], }.a }, //B
        unsafe { C16 { a_u8: [0, 0, 0, 0b00000010, 0, 0b00000010, 0, 0b00000010, 0, 0, 0, 0b00000010, 0, 0, 0, 0, ], }.a }, //L
        unsafe { C16 { a_u8: [0, 0b00000010, 0, 0, 0b00000010, 0, 0b00000010, 0, 0, 0b00000010, 0, 0, 0, 0, 0, 0, ], }.a }, //R
    ];

    const TRANSFORMATION_EP_SHUFFLE: [[uint8x16_t; 3]; 3] = [
        [
            unsafe { C16 { a_u8: [2, 4, 8, 5, 9, 11, 1, 3, 10, 6, 0, 7, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //x
            unsafe { C16 { a_u8: [8, 9, 10, 11, 6, 7, 4, 5, 0, 1, 2, 3, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //x2
            unsafe { C16 { a_u8: [10, 6, 0, 7, 1, 3, 9, 11, 2, 4, 8, 5, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //x'
        ],
        [
            unsafe { C16 { a_u8: [3, 0, 1, 2, 6, 4, 7, 5, 9, 10, 11, 8, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //y
            unsafe { C16 { a_u8: [2, 3, 0, 1, 7, 6, 5, 4, 10, 11, 8, 9, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //y2
            unsafe { C16 { a_u8: [1, 2, 3, 0, 5, 7, 4, 6, 11, 8, 9, 10, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //y'
        ],
        [
            unsafe { C16 { a_u8: [7, 3, 5, 11, 2, 8, 0, 10, 4, 1, 6, 9, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //z
            unsafe { C16 { a_u8: [10, 11, 8, 9, 5, 4, 7, 6, 2, 3, 0, 1, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //z2
            unsafe { C16 { a_u8: [6, 9, 4, 1, 8, 2, 10, 0, 5, 11, 7, 3, 0xFF, 0xFF, 0xFF, 0xFF], }.a }, //z'
        ],
    ];

    const TRANSFORMATION_EO_MAP: [uint8x16_t; 3] = [
        unsafe { C16 { a_u8: [0b0000, 0xFF, 0b0010, 0xFF, 0b1000, 0xFF, 0b1010, 0xFF, 0b0100, 0xFF, 0b0110, 0xFF, 0b1100, 0xFF, 0b1110, 0xFF, ], }.a }, //X
        unsafe { C16 { a_u8: [0b0000, 0xFF, 0b0100, 0xFF, 0b0010, 0xFF, 0b0110, 0xFF, 0b1000, 0xFF, 0b1100, 0xFF, 0b1010, 0xFF, 0b1110, 0xFF, ], }.a }, //X
        unsafe { C16 { a_u8: [0b0000, 0xFF, 0b1000, 0xFF, 0b0100, 0xFF, 0b1100, 0xFF, 0b0010, 0xFF, 0b1010, 0xFF, 0b0110, 0xFF, 0b1110, 0xFF, ], }.a }, //X
    ];

    pub(crate) unsafe fn unsafe_mirror_z(cube: &mut CenterEdgeCube) {
        let mirror_mask = C16 { a_i8: [0, 3, 2, 1, 5, 4, 7, 6, 8, 11, 10, 9, -1, -1, -1, -1]}.a;
        let edges = vqtbl1q_u8(cube.0, mirror_mask);
        let translated_ep = vshlq_n_u8::<4>(vqtbl1q_u8(
            mirror_mask,
            vandq_u8(vdupq_n_u8(0xF), vshrq_n_u8::<4>(edges)),
        ));
        let translated_eo = vandq_u8(edges, vdupq_n_u8(0xF));
        cube.0 = vorrq_u8(translated_ep, translated_eo);
    }

    pub(crate) unsafe fn unsafe_get_edges_raw(cube: &CenterEdgeCube) -> [u64; 2] {
        let mut a_arr = AlignedU64([0u64; 2]).0;
        vst1q_u64(a_arr.as_mut_ptr(), vreinterpretq_u64_u8(cube.0));
        a_arr[1] &= VALID_EDGE_MASK_HI;
        a_arr
    }

    pub(crate) unsafe fn unsafe_new_solved() -> CenterEdgeCube {
        CenterEdgeCube(unsafe {
            vshlq_n_u8::<4>(C16 { a_u8: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 0, 0, 0]}.a)
        })
    }

    pub(crate) unsafe fn unsafe_from_bytes(bytes: [u8; 12]) -> CenterEdgeCube {
        CenterEdgeCube(unsafe {
            C16 { a_u8: [bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7], bytes[8], bytes[9], bytes[10], bytes[11], 0, 0, 0, 0]}.a
        })
    }

    pub unsafe fn unsafe_get_edges(cube: &CenterEdgeCube) -> [Edge; 12] {
        let mut edges = unsafe_get_edges_raw(cube);
        let mut edge_arr = [Edge {
            id: 0,
            oriented_ud: true,
            oriented_fb: true,
            oriented_rl: true,
        }; 12];

        for eid in 0..12 {
            let arr_id = eid / 8;
            let edge = (edges[arr_id] & 0xFF) as u8;
            edges[arr_id] >>= 8;

            let rl = edge & 0b0010 == 0;
            let fb = edge & 0b0100 == 0;
            let ud = edge & 0b1000 == 0;

            edge_arr[eid] = Edge {
                id: edge >> 4,
                oriented_ud: ud,
                oriented_fb: fb,
                oriented_rl: rl,
            };
        }

        edge_arr
    }

    pub(crate) unsafe fn unsafe_turn(cube: &mut CenterEdgeCube, face: CubeFace, dir: Direction) {
        cube.0 = vqtbl1q_u8(
            cube.0,
            TURN_EDGE_SHUFFLE[face as usize][dir as usize],
        );
        if dir != Direction::Half {
            cube.0 = veorq_u8(cube.0, TURN_EO_FLIP[face as usize]);
        }
    }

    pub(crate) unsafe fn unsafe_transform(
        cube: &mut CenterEdgeCube,
        axis: CubeAxis,
        dir: Direction,
    ) {
        let edges_translated = vqtbl1q_u8(
            cube.0,
            TRANSFORMATION_EP_SHUFFLE[axis as usize][dir as usize],
        );
        let ep = vshrq_n_u8::<4>(vandq_u8(
            edges_translated,
            vdupq_n_u8(0xF0_u8),
        ));
        let eo = vandq_u8(edges_translated, vdupq_n_u8(0b00001110));
        let ep_translated = vshlq_n_u8::<4>(vqtbl1q_u8(
            TRANSFORMATION_EP_SHUFFLE[axis as usize][dir.invert() as usize],
            ep,
        ));
        let eo = if dir != Direction::Half {
            vqtbl1q_u8(TRANSFORMATION_EO_MAP[axis], eo)
        } else {
            eo
        };
        cube.0 = vorrq_u8(ep_translated, eo);
    }

    pub(crate) unsafe fn unsafe_invert(cube: &mut CenterEdgeCube) {
        let edge_ids = unsafe {
            let mut a_arr = AlignedU8([0u8; 16]);
            vst1q_u8(
                a_arr.0.as_mut_ptr(),
                vshrq_n_u8::<4>(vandq_u8(cube.0, vdupq_n_u8(0xF0_u8))),
            );
            a_arr
        };
        //This essentially calculates the inverse of _mm_shuffle_epi8(solved_cube.edges, self.edges), same for corners
        let mut edge_shuffle = AlignedU8([0u8; 16]);
        let edges = edge_ids.0;
        for i in 0..12 {
            edge_shuffle.0[edges[i] as usize] = i as u8;
        }
        let edge_shuffle_mask = vld1q_u8(edge_shuffle.0.as_ptr());

        //Splice together the edge permutation, and the EO of the edges on the inverse (see niss prediction to see how this works)
        let ep = vandq_u8(
            vqtbl1q_u8(
                vqtbl1q_u8(cube.0, edge_shuffle_mask),
                edge_shuffle_mask,
            ),
            vdupq_n_u8(0xF0_u8),
        );
        let eo_shuffle = vqtbl1q_u8(cube.0, vshrq_n_u8::<4>(ep));
        let eo = vandq_u8(eo_shuffle, vdupq_n_u8(0b1110));

        cube.0 = vorrq_u8(ep, eo);
    }
}

#[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
mod wasm32 {
    use std::arch::wasm32::{
        u32x4_shl, u32x4_shr, u64x2_extract_lane, u8x16, u8x16_shl,
        u8x16_swizzle, v128, v128_and, v128_load, v128_or,
        v128_store, v128_xor,
    };

    use crate::cube::{CubeAxis, CubeFace, Direction, Edge};
    use crate::cube::cube_edges::CenterEdgeCube;
    use crate::wasm_util::u8x16_set1;

    //UB UR UF UL FR FL BR BL DF DR DB DL
    // 0  1  2  3  4  5  6  7  8  9 10 11
    const TURN_EDGE_SHUFFLE: [[v128; 3]; 6] = [
        [
            u8x16(3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF), //U
            u8x16(2, 3, 0, 1, 4, 5, 6, 7, 8, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF), //U2
            u8x16(1, 2, 3, 0, 4, 5, 6, 7, 8, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF), //U'
        ],
        [
            u8x16(0, 1, 2, 3, 4, 5, 6, 7, 11, 8, 9, 10, 0xFF, 0xFF, 0xFF, 0xFF), //D
            u8x16(0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 8, 9, 0xFF, 0xFF, 0xFF, 0xFF), //D2
            u8x16(0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 8, 0xFF, 0xFF, 0xFF, 0xFF), //D'
        ],
        [
            u8x16(0, 1, 5, 3, 2, 8, 6, 7, 4, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF), //F
            u8x16(0, 1, 8, 3, 5, 4, 6, 7, 2, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF), //F2
            u8x16(0, 1, 4, 3, 8, 2, 6, 7, 5, 9, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF), //F'
        ],
        [
            u8x16(6, 1, 2, 3, 4, 5, 10, 0, 8, 9, 7, 11, 0xFF, 0xFF, 0xFF, 0xFF), //B
            u8x16(10, 1, 2, 3, 4, 5, 7, 6, 8, 9, 0, 11, 0xFF, 0xFF, 0xFF, 0xFF), //B2
            u8x16(7, 1, 2, 3, 4, 5, 0, 10, 8, 9, 6, 11, 0xFF, 0xFF, 0xFF, 0xFF), //B'
        ],
        [
            u8x16(0, 1, 2, 7, 4, 3, 6, 11, 8, 9, 10, 5, 0xFF, 0xFF, 0xFF, 0xFF), //L
            u8x16(0, 1, 2, 11, 4, 7, 6, 5, 8, 9, 10, 3, 0xFF, 0xFF, 0xFF, 0xFF), //L2
            u8x16(0, 1, 2, 5, 4, 11, 6, 3, 8, 9, 10, 7, 0xFF, 0xFF, 0xFF, 0xFF), //L'
        ],
        [
            u8x16(0, 4, 2, 3, 9, 5, 1, 7, 8, 6, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF), //R
            u8x16(0, 9, 2, 3, 6, 5, 4, 7, 8, 1, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF), //R2
            u8x16(0, 6, 2, 3, 1, 5, 9, 7, 8, 4, 10, 11, 0xFF, 0xFF, 0xFF, 0xFF), //R'
        ],
    ];

    const TURN_EO_FLIP: [v128; 6] = [
        u8x16(0b00001000, 0b00001000, 0b00001000, 0b00001000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ), //U
        u8x16(0, 0, 0, 0, 0, 0, 0, 0, 0b00001000, 0b00001000, 0b00001000, 0b00001000, 0, 0, 0, 0, ), //D
        u8x16(0, 0, 0b00000100, 0, 0b00000100, 0b00000100, 0, 0, 0b00000100, 0, 0, 0, 0, 0, 0, 0, ), //F
        u8x16(0b00000100, 0, 0, 0, 0, 0, 0b00000100, 0b00000100, 0, 0, 0b00000100, 0, 0, 0, 0, 0, ), //B
        u8x16(0, 0, 0, 0b00000010, 0, 0b00000010, 0, 0b00000010, 0, 0, 0, 0b00000010, 0, 0, 0, 0, ), //L
        u8x16(0, 0b00000010, 0, 0, 0b00000010, 0, 0b00000010, 0, 0, 0b00000010, 0, 0, 0, 0, 0, 0, ), //R
    ];

    const TRANSFORMATION_EP_SHUFFLE: [[v128; 3]; 3] = [
        [
            u8x16(2, 4, 8, 5, 9, 11, 1, 3, 10, 6, 0, 7, 0xFF, 0xFF, 0xFF, 0xFF), //x
            u8x16(8, 9, 10, 11, 6, 7, 4, 5, 0, 1, 2, 3, 0xFF, 0xFF, 0xFF, 0xFF), //x2
            u8x16(10, 6, 0, 7, 1, 3, 9, 11, 2, 4, 8, 5, 0xFF, 0xFF, 0xFF, 0xFF), //x'
        ],
        [
            u8x16(3, 0, 1, 2, 6, 4, 7, 5, 9, 10, 11, 8, 0xFF, 0xFF, 0xFF, 0xFF), //y
            u8x16(2, 3, 0, 1, 7, 6, 5, 4, 10, 11, 8, 9, 0xFF, 0xFF, 0xFF, 0xFF), //y2
            u8x16(1, 2, 3, 0, 5, 7, 4, 6, 11, 8, 9, 10, 0xFF, 0xFF, 0xFF, 0xFF), //y'
        ],
        [
            u8x16(7, 3, 5, 11, 2, 8, 0, 10, 4, 1, 6, 9, 0xFF, 0xFF, 0xFF, 0xFF), //z
            u8x16(10, 11, 8, 9, 5, 4, 7, 6, 2, 3, 0, 1, 0xFF, 0xFF, 0xFF, 0xFF), //z2
            u8x16(6, 9, 4, 1, 8, 2, 10, 0, 5, 11, 7, 3, 0xFF, 0xFF, 0xFF, 0xFF), //z'
        ],
    ];

    const TRANSFORMATION_EO_MAP: [v128; 3] = [
        u8x16(0b0000, 0xFF, 0b0010, 0xFF, 0b1000, 0xFF, 0b1010, 0xFF, 0b0100, 0xFF, 0b0110, 0xFF, 0b1100, 0xFF, 0b1110, 0xFF), //X
        u8x16(0b0000, 0xFF, 0b0100, 0xFF, 0b0010, 0xFF, 0b0110, 0xFF, 0b1000, 0xFF, 0b1100, 0xFF, 0b1010, 0xFF, 0b1110, 0xFF), //Y
        u8x16(0b0000, 0xFF, 0b1000, 0xFF, 0b0100, 0xFF, 0b1100, 0xFF, 0b0010, 0xFF, 0b1010, 0xFF, 0b0110, 0xFF, 0b1110, 0xFF), //Z
    ];

    pub(crate) fn get_edges_raw(cube: &CenterEdgeCube) -> [u64; 2] {
        let low = u64x2_extract_lane::<0>(cube.0);
        let high = u64x2_extract_lane::<1>(cube.0);
        [low, high]
    }

    pub(crate) fn new_solved() -> CenterEdgeCube {
        CenterEdgeCube(u8x16_shl(
            u8x16(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 0, 0, 0),
            4,
        ))
    }

    pub(crate) fn from_bytes(bytes: [u8; 12]) -> CenterEdgeCube {
        CenterEdgeCube(u8x16(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7], bytes[8], bytes[9], bytes[10], bytes[11], 0, 0, 0, 0))
    }

    pub(crate) fn get_edges(cube: &CenterEdgeCube) -> [Edge; 12] {
        let mut edges = get_edges_raw(cube);
        let mut edge_arr = [Edge {
            id: 0,
            oriented_ud: true,
            oriented_fb: true,
            oriented_rl: true,
        }; 12];

        for eid in 0..12 {
            let arr_id = eid / 8;
            let edge = (edges[arr_id] & 0xFF) as u8;
            edges[arr_id] >>= 8;

            let rl = edge & 0b0010 == 0;
            let fb = edge & 0b0100 == 0;
            let ud = edge & 0b1000 == 0;

            edge_arr[eid] = Edge {
                id: edge >> 4,
                oriented_ud: ud,
                oriented_fb: fb,
                oriented_rl: rl,
            };
        }

        edge_arr
    }

    pub(crate) fn turn(cube: &mut CenterEdgeCube, face: CubeFace, dir: Direction) {
        cube.0 = u8x16_swizzle(
            cube.0,
            TURN_EDGE_SHUFFLE[face as usize][dir as usize],
        );
        if dir != Direction::Half {
            cube.0 = v128_xor(cube.0, TURN_EO_FLIP[face as usize]);
        }
    }

    pub(crate) fn transform(cube: &mut CenterEdgeCube, axis: CubeAxis, turn_type: Direction) {
        let edges_translated = u8x16_swizzle(
            cube.0,
            TRANSFORMATION_EP_SHUFFLE[axis as usize][turn_type as usize],
        );
        let ep = u32x4_shl(v128_and(edges_translated, u8x16_set1(0xF0)), 4);
        let eo = v128_and(edges_translated, u8x16_set1(0b00001110));
        let ep_translated = u32x4_shl(
            u8x16_swizzle(
                TRANSFORMATION_EP_SHUFFLE[axis as usize][turn_type.invert() as usize],
                ep,
            ),
            4,
        );
        let eo = if turn_type != Direction::Half {
            u8x16_swizzle(TRANSFORMATION_EO_MAP[axis], eo)
        } else {
            eo
        };
        cube.0 = v128_or(ep_translated, eo);
    }

    pub(crate) fn invert(cube: &mut CenterEdgeCube) {
        let edge_ids = unsafe {
            let mut a_arr = [0u8; 16];
            v128_store(
                a_arr.as_mut_ptr() as *mut v128,
                u32x4_shr(v128_and(cube.0, u8x16_set1(0xF0)), 4),
            );
            a_arr
        };
        //This essentially calculates the inverse of u8x16_shuffle(solved_cube.edges, self.edges), same for corners
        let mut edge_shuffle = [0u8; 16];
        for i in 0..12 {
            edge_shuffle[edge_ids[i] as usize] = i as u8;
        }
        let edge_shuffle_mask = unsafe { v128_load(edge_shuffle.as_ptr() as *const v128) };

        //Splice together the edge permutation, and the EO of the edges on the inverse (see niss prediction to see how this works)
        let ep = v128_and(
            u8x16_swizzle(u8x16_swizzle(cube.0, edge_shuffle_mask), edge_shuffle_mask),
            u8x16_set1(0xF0),
        );
        let eo_shuffle = u8x16_swizzle(cube.0, u32x4_shr(ep, 4));
        let eo = v128_and(eo_shuffle, u8x16_set1(0b1110));

        cube.0 = v128_or(ep, eo);
    }
}