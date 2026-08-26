use crate::cube::Corner;
use crate::cube::cube::Symmetry;
use crate::cube::turn::{ApplySymmetry, CubeOuterTurn, CubeTransformation, InvertibleMut, TransformableMut, TurnableMut};

//One byte per corner, 3 bits for id, 2 bits free, 3 bits for co (from UD perspective)
//UBL UBR UFR UFL DFL DFR DBR DBL
#[derive(Debug, Clone, Copy)]
pub struct CubeCornersOdd(
    #[cfg(target_feature = "avx2")]
    pub core::arch::x86_64::__m128i,
    #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
    pub core::arch::wasm32::v128,
    #[cfg(target_feature = "neon")]
    pub core::arch::aarch64::uint8x8_t,
);

#[cfg(target_feature = "avx2")]
impl std::hash::Hash for CubeCornersOdd {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        state.write_u64(self.get_corners_raw());
    }
}


#[cfg(target_feature = "neon")]
impl std::hash::Hash for CubeCornersOdd {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        state.write_u64(self.get_corners_raw());
    }
}

impl PartialEq<Self> for CubeCornersOdd {
    fn eq(&self, other: &Self) -> bool {
        self.get_corners_raw() == other.get_corners_raw()
    }
}

impl Eq for CubeCornersOdd {

}

impl TurnableMut for CubeCornersOdd {
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

impl TransformableMut for CubeCornersOdd {
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
        unsafe {
            neon::unsafe_transform(self, axis, dir);
        }
    }
}

impl InvertibleMut for CubeCornersOdd {
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
impl ApplySymmetry for CubeCornersOdd {
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

impl CubeCornersOdd {
    #[cfg(target_feature = "avx2")]
    pub fn new(state: std::arch::x86_64::__m128i) -> CubeCornersOdd {
        CubeCornersOdd(state)
    }

    #[cfg(target_feature = "neon")]
    pub fn new(state: std::arch::aarch64::uint8x8_t) -> CubeCornersOdd {
        CubeCornersOdd(state)
    }

    #[inline]
    #[cfg(target_feature = "avx2")]
    pub fn get_corners(&self) -> [Corner; 8] {
        unsafe { avx2::unsafe_get_corners(self) }
    }

    #[inline]
    #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
    pub fn get_corners(&self) -> [Corner; 8] {
        unsafe { neon::unsafe_get_corners(self) }
    }

    #[inline]
    #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
    pub fn get_corners(&self) -> [Corner; 8] {
        wasm32::get_corners(self)
    }

    #[inline]
    #[cfg(target_feature = "avx2")]
    pub fn get_corners_raw(&self) -> u64 {
        unsafe { avx2::unsafe_get_corners_raw(self) }
    }

    #[inline]
    #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
    pub fn get_corners_raw(&self) -> u64 {
        wasm32::get_corners_raw(self)
    }

    #[inline]
    #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
    pub fn get_corners_raw(&self) -> u64 {
        unsafe { neon::unsafe_get_corners_raw(self) }
    }
}

#[cfg(feature = "serde_support")]
impl serde::Serialize for CubeCornersOdd {

    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error> where S: serde::Serializer {
        let mut bytes = [0_u8; 16];
        unsafe {
            #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
            std::arch::wasm32::v128_store(bytes.as_mut_ptr() as *mut std::arch::wasm32::v128, self.0);
            #[cfg(target_feature = "avx2")]
            std::arch::x86_64::_mm_store_si128(bytes.as_mut_ptr() as *mut std::arch::x86_64::__m128i, self.0);
            #[cfg(target_feature = "neon")]
            std::arch::aarch64::vst1_u8(bytes.as_mut_ptr(), self.0);
        }
        serializer.serialize_bytes(&bytes)
    }
}

#[cfg(feature = "serde_support")]
struct CornerCubieCubeVisitor;

#[cfg(feature = "serde_support")]
impl<'de> serde::de::Visitor<'de> for CornerCubieCubeVisitor {
    type Value = CubeCornersOdd;

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
                #[cfg(target_feature = "avx2")]
                let val = std::arch::x86_64::_mm_load_si128(v.as_ptr() as *const std::arch::x86_64::__m128i);
                #[cfg(target_feature = "neon")]
                let val = std::arch::aarch64::vld1_u8(v.as_ptr());
                val
            };
            Ok(CubeCornersOdd(val))
        }
    }
}

#[cfg(feature = "serde_support")]
impl<'de> serde::Deserialize<'de> for CubeCornersOdd {
    fn deserialize<D>(deserializer: D) -> Result<CubeCornersOdd, D::Error>
        where
            D: serde::Deserializer<'de>,
    {
        deserializer.deserialize_bytes(CornerCubieCubeVisitor)
    }
}

impl Default for CubeCornersOdd {
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

impl CubeCornersOdd {
    #[inline]
    #[cfg(target_feature = "avx2")]
    pub fn random<T: rand::Rng>(parity: bool, rng: &mut T) -> Self {
        let bytes = random_corners(parity, rng);
        unsafe { avx2::unsafe_from_bytes(bytes) }
    }

    // #[inline]
    // #[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
    // pub fn random<T: Rng>(parity: bool, rng: &mut T) -> Self {
    //     let bytes = random_corners(parity, rng);
    //     wasm32::from_bytes(bytes)
    // }

    #[inline]
    #[cfg(all(target_feature = "neon", not(target_feature = "avx2")))]
    pub fn random<T: rand::Rng>(parity: bool, rng: &mut T) -> Self {
        let bytes = random_corners(parity, rng);
        unsafe { neon::unsafe_from_bytes(bytes) }
    }
}

impl CubeCornersOdd {
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
fn random_corners<T: rand::Rng>(parity: bool, rng: &mut T) -> [u8; 8] {
    let mut corner_bytes: [u8; 8] = [0, 1, 2, 3, 4, 5, 6, 7];
    let mut orientation_parity = 0;
    let mut swap_parity = false;

    fn get_bytes(piece_id: u8, orientation: u8) -> u8 {
        (piece_id << 5) | (orientation & 0x3)
    }

    for i in 0..6 {
        let swap_index = rng.random_range(i..8);
        if swap_index != i {
            corner_bytes.swap(i, swap_index);
            swap_parity = !swap_parity;
        }
        let orientation = rng.random_range(0..3);
        orientation_parity = (orientation_parity + orientation) % 3;
        corner_bytes[i] = get_bytes(corner_bytes[i], orientation);
    }
    // Last position determined by parity
    if swap_parity != parity {
        corner_bytes.swap(6, 7);
    }
    let orientation = rng.random_range(0..3);
    orientation_parity = (orientation_parity + orientation) % 3;
    corner_bytes[6] = get_bytes(corner_bytes[6], orientation);
    // Last orientation determined by parity
    let last_orientation = (3 - orientation_parity) % 3;
    corner_bytes[7] = get_bytes(corner_bytes[7], last_orientation);
    corner_bytes
}


#[cfg(target_feature = "avx2")]
mod avx2 {
    use std::arch::x86_64::{
        __m128i, _mm_add_epi8, _mm_and_si128, _mm_andnot_si128, _mm_extract_epi64,
        _mm_loadl_epi64, _mm_or_si128, _mm_set1_epi8, _mm_setr_epi8,
        _mm_shuffle_epi8, _mm_slli_epi32, _mm_slli_epi64, _mm_srli_epi16, _mm_srli_epi32,
        _mm_sub_epi8, _mm_xor_si128,
    };

    use crate::cube::{Corner, CubeAxis, CubeFace, Direction};
    use crate::cube::cube_corners::CubeCornersOdd;
    use crate::simd_util::avx2::C;

    const TURN_CORNER_SHUFFLE: [[__m128i; 3]; 6] = [
        [
            unsafe { C { a_u8: [3, 0, 1, 2, 4, 5, 6, 7, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //U
            unsafe { C { a_u8: [2, 3, 0, 1, 4, 5, 6, 7, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //U2
            unsafe { C { a_u8: [1, 2, 3, 0, 4, 5, 6, 7, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //U'
        ],
        [
            unsafe { C { a_u8: [0, 1, 2, 3, 7, 4, 5, 6, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //D
            unsafe { C { a_u8: [0, 1, 2, 3, 6, 7, 4, 5, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //D2
            unsafe { C { a_u8: [0, 1, 2, 3, 5, 6, 7, 4, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //D'
        ],
        [
            unsafe { C { a_u8: [0, 1, 3, 4, 5, 2, 6, 7, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //F
            unsafe { C { a_u8: [0, 1, 4, 5, 2, 3, 6, 7, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //F2
            unsafe { C { a_u8: [0, 1, 5, 2, 3, 4, 6, 7, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //F'
        ],
        [
            unsafe { C { a_u8: [1, 6, 2, 3, 4, 5, 7, 0, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //B
            unsafe { C { a_u8: [6, 7, 2, 3, 4, 5, 0, 1, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //B2
            unsafe { C { a_u8: [7, 0, 2, 3, 4, 5, 1, 6, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //B'
        ],
        [
            unsafe { C { a_u8: [7, 1, 2, 0, 3, 5, 6, 4, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //L
            unsafe { C { a_u8: [4, 1, 2, 7, 0, 5, 6, 3, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //L2
            unsafe { C { a_u8: [3, 1, 2, 4, 7, 5, 6, 0, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //L'
        ],
        [
            unsafe { C { a_u8: [0, 2, 5, 3, 4, 6, 1, 7, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //R
            unsafe { C { a_u8: [0, 5, 6, 3, 4, 1, 2, 7, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //R2
            unsafe { C { a_u8: [0, 6, 1, 3, 4, 2, 5, 7, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //R'
        ],
    ];

    pub(crate) const TRANSFORMATION_CP_SHUFFLE: [[__m128i; 3]; 3] = [
        [
            unsafe { C { a_u8: [3, 2, 5, 4, 7, 6, 1, 0, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //x
            unsafe { C { a_u8: [4, 5, 6, 7, 0, 1, 2, 3, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //x2
            unsafe { C { a_u8: [7, 6, 1, 0, 3, 2, 5, 4, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //x'
        ],
        [
            unsafe { C { a_u8: [3, 0, 1, 2, 5, 6, 7, 4, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //y
            unsafe { C { a_u8: [2, 3, 0, 1, 6, 7, 4, 5, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //y2
            unsafe { C { a_u8: [1, 2, 3, 0, 7, 4, 5, 6, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //y'
        ],
        [
            unsafe { C { a_u8: [7, 0, 3, 4, 5, 2, 1, 6, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //F
            unsafe { C { a_u8: [6, 7, 4, 5, 2, 3, 0, 1, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //F2
            unsafe { C { a_u8: [1, 6, 5, 2, 3, 4, 7, 0, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ], }.a }, //F'
        ],
    ];

    //CPOO
    // const CO_MAP: __m128i = unsafe { C { a_u8: [0b00, 0b01, 0b10, 0xFF, 0b01, 0b00, 0b10, 0xFF, 0b10, 0b01, 0b00, 0xFF, 0b00, 0b01, 0b10, 0xFF] }.a }; //z

    const TRANSFORMATION_CO_MAP: [__m128i; 3] = [
        unsafe { C { a_u8: [0b00, 0b01, 0b10, 0xFF, 0b01, 0b10, 0b00, 0xFF, 0b10, 0b00, 0b01, 0xFF, 0b00, 0b01, 0b10, 0xFF, ], }.a }, //z
        unsafe { C { a_u8: [0b00, 0b01, 0b10, 0xFF, 0b00, 0b01, 0b10, 0xFF, 0b00, 0b01, 0b10, 0xFF, 0b00, 0b01, 0b10, 0xFF, ], }.a }, //y
        unsafe { C { a_u8: [0b00, 0b01, 0b10, 0xFF, 0b10, 0b00, 0b01, 0xFF, 0b01, 0b10, 0b00, 0xFF, 0b00, 0b01, 0b10, 0xFF, ], }.a }, //x
    ];

    const CO_OVERFLOW_MASK: __m128i = unsafe { C { a_u8: [0b00000100, 0b00000100, 0b00000100, 0b00000100, 0b00000100, 0b00000100, 0b00000100, 0b00000100, 0, 0, 0, 0, 0, 0, 0, 0, ], }.a };

    const TURN_CO_CHANGE: [__m128i; 6] = [
        unsafe { C { a_u8: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0], }.a }, //U
        unsafe { C { a_u8: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0], }.a }, //D
        unsafe { C { a_u8: [1, 1, 2, 3, 2, 3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0], }.a }, //F
        unsafe { C { a_u8: [2, 3, 1, 1, 1, 1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0], }.a }, //B
        unsafe { C { a_u8: [3, 1, 1, 2, 3, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0], }.a }, //L
        unsafe { C { a_u8: [1, 2, 3, 1, 1, 2, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0], }.a }, //R
    ];

    #[target_feature(enable = "avx2")]
    #[inline]
    pub(crate) unsafe fn unsafe_new_solved() -> CubeCornersOdd {
        CubeCornersOdd(_mm_slli_epi64::<5>(_mm_setr_epi8( 0, 1, 2, 3, 4, 5, 6, 7, 0, 0, 0, 0, 0, 0, 0,0)))
    }

    #[target_feature(enable = "avx2")]
    #[inline]
    pub(crate) unsafe fn unsafe_from_bytes(bytes: [u8; 8]) -> CubeCornersOdd {
        CubeCornersOdd(_mm_setr_epi8(bytes[0] as i8, bytes[1] as i8, bytes[2] as i8, bytes[3] as i8, bytes[4] as i8, bytes[5] as i8, bytes[6] as i8, bytes[7] as i8, 0, 0, 0, 0, 0, 0, 0,0))
    }

    #[target_feature(enable = "avx2")]
    #[inline]
    pub(crate) unsafe fn unsafe_get_corners_raw(cube: &CubeCornersOdd) -> u64 {
        _mm_extract_epi64::<0>(cube.0) as u64
    }

    #[target_feature(enable = "avx2")]
    #[inline]
    pub(crate) unsafe fn unsafe_get_corners(cube: &CubeCornersOdd) -> [Corner; 8] {
        let mut corner_bits = _mm_extract_epi64::<0>(cube.0) as u64;
        let mut corner_arr = [Corner {
            id: 0,
            orientation: 0,
        }; 8];
        for cid in 0..8 {
            let corner = (corner_bits & 0xFF) as u8;
            corner_bits >>= 8;
            corner_arr[cid] = Corner {
                id: corner >> 5,
                orientation: corner & 0x7,
            };
        }
        corner_arr
    }

    #[target_feature(enable = "avx2")]
    #[inline]
    pub(crate) unsafe fn unsafe_turn(cube: &mut CubeCornersOdd, face: CubeFace, dir: Direction) {
        cube.0 = _mm_shuffle_epi8(
            cube.0,
            TURN_CORNER_SHUFFLE[face as usize][dir as usize],
        );
        if dir != Direction::Half {
            //Valid COs are 00, 01, 10. When we move, we don't add 0, 1, 2 (no change, clockwise, counter-clockwise), but we add 1, 2, 3 to force overflowing into the next bit.
            //This code either subtracts 1 if there is no overflow (because we added 1 too much before), or 4, because this gives us the original addition mod 3.
            let corners_tmp = _mm_add_epi8(cube.0, TURN_CO_CHANGE[face as usize]);
            let overflow_bits = _mm_and_si128(corners_tmp, CO_OVERFLOW_MASK);
            let not_overflow =
                _mm_srli_epi16::<2>(_mm_andnot_si128(corners_tmp, CO_OVERFLOW_MASK));
            let overflow_sub = _mm_or_si128(overflow_bits, not_overflow);
            cube.0 = _mm_sub_epi8(corners_tmp, overflow_sub);
        }
    }

    #[target_feature(enable = "avx2")]
    #[inline]
    pub(crate) unsafe fn unsafe_transform(
        cube: &mut CubeCornersOdd,
        axis: CubeAxis,
        dir: Direction,
    ) {
        let corners_translated = _mm_shuffle_epi8(
            cube.0,
            TRANSFORMATION_CP_SHUFFLE[axis as usize][dir as usize],
        );
        let cp = _mm_srli_epi32::<5>(_mm_and_si128(
            corners_translated,
            _mm_set1_epi8(0b11100000_u8 as i8),
        ));
        let co = _mm_and_si128(corners_translated, _mm_set1_epi8(0b00000011));
        let cp_translated = _mm_slli_epi32::<5>(_mm_shuffle_epi8(
            TRANSFORMATION_CP_SHUFFLE[axis as usize][dir.invert() as usize],
            cp,
        ));
        let co = if dir != Direction::Half {
            let corner_orbit_id = _mm_and_si128(cp_translated, _mm_set1_epi8(0b00100000));
            //We want 4 bits. The lowest two are for the corner CO, the third tells us which orbit the corner belongs to, and the fourth is which orbit the corner is in.
            //Changing the CO only depends on the axis, corner orbit and previous UD-CO, so we can just use a lookup table to do this in a simple way
            let co_id = _mm_or_si128(_mm_srli_epi32::<3>(corner_orbit_id), co);
            let co_id = _mm_or_si128(
                co_id,
                _mm_setr_epi8( 0, 0b1000, 0, 0b1000, 0, 0b1000, 0, 0b1000, 0, 0, 0, 0, 0, 0, 0,
                               0),
            );
            _mm_shuffle_epi8(TRANSFORMATION_CO_MAP[axis], co_id)
        } else {
            co
        };
        cube.0 = _mm_or_si128(cp_translated, co);
    }

    #[target_feature(enable = "avx2")]
    pub(crate) unsafe fn unsafe_mirror_z(cube: &mut CubeCornersOdd) {
        let corners = _mm_shuffle_epi8(cube.0, _mm_setr_epi8(1, 0, 3, 2, 5, 4, 7, 6, -1, -1, -1, -1, -1, -1, -1, -1));
        let tmp = _mm_and_si128(
            _mm_add_epi8(
                corners,
                _mm_setr_epi8( 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0,0),
            ),
            _mm_set1_epi8(2),
        );
        let flip_mask = _mm_and_si128(_mm_or_si128(tmp, _mm_srli_epi32::<1>(tmp)), _mm_set1_epi8(0b11));
        let flip_mask = _mm_or_si128(flip_mask, _mm_set1_epi8(0b00100000));
        cube.0 = _mm_xor_si128(corners, flip_mask);
    }

    #[target_feature(enable = "avx2")]
    #[inline]
    pub(crate) unsafe fn unsafe_invert(cube: &mut CubeCornersOdd) {
        let corner_ids = (_mm_extract_epi64::<0>(_mm_srli_epi32::<5>(_mm_and_si128(
                cube.0,
                _mm_set1_epi8(0xE0_u8 as i8),
            ))) as u64)
                .to_le_bytes();

        let mut corner_shuffle = corner_ids.clone();
        for i in 0..8 {
            corner_shuffle[corner_ids[i] as usize] = i as u8;
        }
        let corner_shuffle_mask = _mm_loadl_epi64(corner_shuffle.as_ptr() as *const __m128i);

        //Splice together the corner permutation, and the CO of the corners on the inverse (see niss prediction to see how this works)
        //Also switch CO 1 <-> 2,  CO 0 stays the same
        let cp = _mm_and_si128(
            _mm_shuffle_epi8(
                _mm_shuffle_epi8(cube.0, corner_shuffle_mask),
                corner_shuffle_mask,
            ),
            _mm_set1_epi8(0b11100000_u8 as i8),
        );
        let co_shuffle = _mm_shuffle_epi8(cube.0, _mm_srli_epi32::<5>(cp));
        let tmp = _mm_and_si128(
            _mm_add_epi8(
                co_shuffle,
                _mm_setr_epi8( 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0,0),
            ),
            _mm_set1_epi8(2),
        );
        let co_flip_mask = _mm_or_si128(tmp, _mm_srli_epi32::<1>(tmp));
        let co = _mm_and_si128(_mm_xor_si128(co_shuffle, co_flip_mask), _mm_set1_epi8(7));

        cube.0 = _mm_or_si128(cp, co);
    }
}

#[cfg(target_feature = "neon")]
mod neon {
    use std::arch::aarch64::{uint8x16_t, uint8x8_t, vadd_u8, vand_u8, vdup_n_u8, veor_u8, vget_lane_u64, vld1_u8, vmvn_u8, vorr_u8, vqtbl1_u8, vreinterpret_u64_u8, vshl_n_u8, vshr_n_u8, vsub_u8, vtbl1_u8};

    use crate::cube::{Corner, CubeAxis, CubeFace, Direction};
    use crate::cube::cube_corners::CubeCornersOdd;
    use crate::simd_util::neon::{C16, C8};

    const TURN_CORNER_SHUFFLE: [[uint8x8_t; 3]; 6] = [
        [
            unsafe { C8 { a_u8: [3, 0, 1, 2, 4, 5, 6, 7], }.a }, //U
            unsafe { C8 { a_u8: [2, 3, 0, 1, 4, 5, 6, 7], }.a }, //U2
            unsafe { C8 { a_u8: [1, 2, 3, 0, 4, 5, 6, 7], }.a }, //U'
        ],
        [
            unsafe { C8 { a_u8: [0, 1, 2, 3, 7, 4, 5, 6], }.a }, //D
            unsafe { C8 { a_u8: [0, 1, 2, 3, 6, 7, 4, 5], }.a }, //D2
            unsafe { C8 { a_u8: [0, 1, 2, 3, 5, 6, 7, 4], }.a }, //D'
        ],
        [
            unsafe { C8 { a_u8: [0, 1, 3, 4, 5, 2, 6, 7], }.a }, //F
            unsafe { C8 { a_u8: [0, 1, 4, 5, 2, 3, 6, 7], }.a }, //F2
            unsafe { C8 { a_u8: [0, 1, 5, 2, 3, 4, 6, 7], }.a }, //F'
        ],
        [
            unsafe { C8 { a_u8: [1, 6, 2, 3, 4, 5, 7, 0], }.a }, //B
            unsafe { C8 { a_u8: [6, 7, 2, 3, 4, 5, 0, 1], }.a }, //B2
            unsafe { C8 { a_u8: [7, 0, 2, 3, 4, 5, 1, 6], }.a }, //B'
        ],
        [
            unsafe { C8 { a_u8: [7, 1, 2, 0, 3, 5, 6, 4], }.a }, //L
            unsafe { C8 { a_u8: [4, 1, 2, 7, 0, 5, 6, 3], }.a }, //L2
            unsafe { C8 { a_u8: [3, 1, 2, 4, 7, 5, 6, 0], }.a }, //L'
        ],
        [
            unsafe { C8 { a_u8: [0, 2, 5, 3, 4, 6, 1, 7], }.a }, //R
            unsafe { C8 { a_u8: [0, 5, 6, 3, 4, 1, 2, 7], }.a }, //R2
            unsafe { C8 { a_u8: [0, 6, 1, 3, 4, 2, 5, 7], }.a }, //R'
        ],
    ];

    pub(crate) const TRANSFORMATION_CP_SHUFFLE: [[uint8x8_t; 3]; 3] = [
        [
            unsafe { C8 { a_u8: [3, 2, 5, 4, 7, 6, 1, 0], }.a }, //x
            unsafe { C8 { a_u8: [4, 5, 6, 7, 0, 1, 2, 3], }.a }, //x2
            unsafe { C8 { a_u8: [7, 6, 1, 0, 3, 2, 5, 4], }.a }, //x'
        ],
        [
            unsafe { C8 { a_u8: [3, 0, 1, 2, 5, 6, 7, 4], }.a }, //y
            unsafe { C8 { a_u8: [2, 3, 0, 1, 6, 7, 4, 5], }.a }, //y2
            unsafe { C8 { a_u8: [1, 2, 3, 0, 7, 4, 5, 6], }.a }, //y'
        ],
        [
            unsafe { C8 { a_u8: [7, 0, 3, 4, 5, 2, 1, 6], }.a }, //F
            unsafe { C8 { a_u8: [6, 7, 4, 5, 2, 3, 0, 1], }.a }, //F2
            unsafe { C8 { a_u8: [1, 6, 5, 2, 3, 4, 7, 0], }.a }, //F'
        ],
    ];

    //CPOO
    // const CO_MAP: __m128i = unsafe { C { a_u8: [0b00, 0b01, 0b10, 0xFF, 0b01, 0b00, 0b10, 0xFF, 0b10, 0b01, 0b00, 0xFF, 0b00, 0b01, 0b10, 0xFF] }.a }; //z

    const TRANSFORMATION_CO_MAP: [uint8x16_t; 3] = [
        unsafe { C16 { a_u8: [0b00, 0b01, 0b10, 0xFF, 0b01, 0b10, 0b00, 0xFF, 0b10, 0b00, 0b01, 0xFF, 0b00, 0b01, 0b10, 0xFF, ], }.a }, //z
        unsafe { C16 { a_u8: [0b00, 0b01, 0b10, 0xFF, 0b00, 0b01, 0b10, 0xFF, 0b00, 0b01, 0b10, 0xFF, 0b00, 0b01, 0b10, 0xFF, ], }.a }, //y
        unsafe { C16 { a_u8: [0b00, 0b01, 0b10, 0xFF, 0b10, 0b00, 0b01, 0xFF, 0b01, 0b10, 0b00, 0xFF, 0b00, 0b01, 0b10, 0xFF, ], }.a }, //x
    ];

    const CO_OVERFLOW_MASK: uint8x8_t = unsafe { C8 { a_u8: [0b00000100, 0b00000100, 0b00000100, 0b00000100, 0b00000100, 0b00000100, 0b00000100, 0b00000100], }.a };

    const TURN_CO_CHANGE: [uint8x8_t; 6] = [
        unsafe { C8 { a_u8: [1, 1, 1, 1, 1, 1, 1, 1], }.a }, //U
        unsafe { C8 { a_u8: [1, 1, 1, 1, 1, 1, 1, 1], }.a }, //D
        unsafe { C8 { a_u8: [1, 1, 2, 3, 2, 3, 1, 1], }.a }, //F
        unsafe { C8 { a_u8: [2, 3, 1, 1, 1, 1, 2, 3], }.a }, //B
        unsafe { C8 { a_u8: [3, 1, 1, 2, 3, 1, 1, 2], }.a }, //L
        unsafe { C8 { a_u8: [1, 2, 3, 1, 1, 2, 3, 1], }.a }, //R
    ];

    #[inline]
    pub(crate) unsafe fn unsafe_new_solved() -> CubeCornersOdd {
        CubeCornersOdd(vshl_n_u8::<5>(C8 { a_u8: [ 0, 1, 2, 3, 4, 5, 6, 7], }.a))
    }

    #[inline]
    pub(crate) unsafe fn unsafe_from_bytes(bytes: [u8; 8]) -> CubeCornersOdd {
        CubeCornersOdd(C8 { a_u8: bytes, }.a)
    }

    #[inline]
    pub(crate) unsafe fn unsafe_get_corners_raw(cube: &CubeCornersOdd) -> u64 {
        vget_lane_u64::<0>(vreinterpret_u64_u8(cube.0))
    }

    #[inline]
    pub(crate) unsafe fn unsafe_get_corners(cube: &CubeCornersOdd) -> [Corner; 8] {
        let mut corner_bits = unsafe_get_corners_raw(cube);
        let mut corner_arr = [Corner {
            id: 0,
            orientation: 0,
        }; 8];
        for cid in 0..8 {
            let corner = (corner_bits & 0xFF) as u8;
            corner_bits >>= 8;
            corner_arr[cid] = Corner {
                id: corner >> 5,
                orientation: corner & 0x7,
            };
        }
        corner_arr
    }

    #[inline]
    pub(crate) unsafe fn unsafe_turn(cube: &mut CubeCornersOdd, face: CubeFace, dir: Direction) {
        cube.0 = vtbl1_u8(cube.0, TURN_CORNER_SHUFFLE[face as usize][dir as usize]);
        if dir != Direction::Half {
            //Valid COs are 00, 01, 10. When we move, we don't add 0, 1, 2 (no change, clockwise, counter-clockwise), but we add 1, 2, 3 to force overflowing into the next bit.
            //This code either subtracts 1 if there is no overflow (because we added 1 too much before), or 4, because this gives us the original addition mod 3.
            let corners_tmp = vadd_u8(cube.0, TURN_CO_CHANGE[face as usize]);
            let overflow_bits = vand_u8(corners_tmp, CO_OVERFLOW_MASK);

            let not_overflow = vshr_n_u8::<2>(vand_u8(vmvn_u8(corners_tmp), CO_OVERFLOW_MASK));
            let overflow_sub = vorr_u8(overflow_bits, not_overflow);
            cube.0 = vsub_u8(corners_tmp, overflow_sub);
        }
    }

    pub(crate) unsafe fn unsafe_transform(
        cube: &mut CubeCornersOdd,
        axis: CubeAxis,
        dir: Direction,
    ) {
        let corners_translated = vtbl1_u8(
            cube.0,
            TRANSFORMATION_CP_SHUFFLE[axis as usize][dir as usize],
        );
        let cp = vshr_n_u8::<5>(vand_u8(
            corners_translated,
            vdup_n_u8(0b11100000_u8),
        ));
        let co = vand_u8(corners_translated, vdup_n_u8(0b00000011));
        let cp_translated = vshl_n_u8::<5>(vtbl1_u8(
            TRANSFORMATION_CP_SHUFFLE[axis as usize][dir.invert() as usize],
            cp,
        ));
        let co = if dir != Direction::Half {
            let corner_orbit_id = vand_u8(cp_translated, vdup_n_u8(0b00100000));
            //We want 4 bits. The lowest two are for the corner CO, the third tells us which orbit the corner belongs to, and the fourth is which orbit the corner is in.
            //Changing the CO only depends on the axis, corner orbit and previous UD-CO, so we can just use a lookup table to do this in a simple way
            let co_id = vorr_u8(vshr_n_u8::<3>(corner_orbit_id), co);
            let co_id = vorr_u8(
                co_id,
                C8{ a_u8: [0, 0b1000, 0, 0b1000, 0, 0b1000, 0, 0b1000]}.a,
            );
            vqtbl1_u8(TRANSFORMATION_CO_MAP[axis], co_id)
        } else {
            co
        };
        cube.0 = vorr_u8(cp_translated, co);
    }

    pub(crate) unsafe fn unsafe_mirror_z(cube: &mut CubeCornersOdd) {
        let corners = vtbl1_u8(cube.0, C8{a_u8: [1, 0, 3, 2, 5, 4, 7, 6]}.a);
        let tmp = vand_u8(
            vadd_u8(corners, vdup_n_u8(1)),
            vdup_n_u8(2),
        );
        let flip_mask = vand_u8(vorr_u8(tmp, vshr_n_u8::<1>(tmp)), vdup_n_u8(0b11));
        let flip_mask = vorr_u8(flip_mask, vdup_n_u8(0b00100000));
        cube.0 = veor_u8(corners, flip_mask);
    }

    pub(crate) unsafe fn unsafe_invert(cube: &mut CubeCornersOdd) {
        let corner_ids = unsafe {
            vget_lane_u64::<0>(vreinterpret_u64_u8(vshr_n_u8::<5>(vand_u8(
                cube.0,
                vdup_n_u8(0xE0_u8),
            )))).to_le_bytes()
        };

        let mut corner_shuffle = corner_ids.clone();
        for i in 0..8 {
            corner_shuffle[corner_ids[i] as usize] = i as u8;
        }
        let corner_shuffle_mask = vld1_u8(corner_shuffle.as_ptr());

        //Splice together the corner permutation, and the CO of the corners on the inverse (see niss prediction to see how this works)
        //Also switch CO 1 <-> 2,  CO 0 stays the same
        let cp = vand_u8(
            vtbl1_u8(
                vtbl1_u8(cube.0, corner_shuffle_mask),
                corner_shuffle_mask,
            ),
            vdup_n_u8(0b11100000_u8),
        );
        let co_shuffle = vtbl1_u8(cube.0, vshr_n_u8::<5>(cp));
        let tmp = vand_u8(
            vadd_u8(
                co_shuffle,
                vdup_n_u8(1),
            ),
            vdup_n_u8(2),
        );
        let co_flip_mask = vorr_u8(tmp, vshr_n_u8::<1>(tmp));
        let co = vand_u8(veor_u8(co_shuffle, co_flip_mask), vdup_n_u8(7));

        cube.0 = vorr_u8(cp, co);
    }
}

#[cfg(all(target_arch = "wasm32", not(target_feature = "avx2")))]
mod wasm32 {
    use std::arch::wasm32::{
        u16x8_shr, u32x4_shl, u32x4_shr, u64x2_extract_lane, u8x16, u8x16_add, u8x16_shl,
        u8x16_sub, u8x16_swizzle, v128, v128_and, v128_andnot, v128_load,
        v128_or, v128_xor,
    };

    use crate::cube::{Corner, CubeAxis, CubeFace, Direction};
    use crate::cube::cube_corners::CubeCornersOdd;
    use crate::wasm_util::u8x16_set1;

    const TURN_CORNER_SHUFFLE: [[v128; 3]; 6] = [
        [
            u8x16(3, 0, 1, 2, 4, 5, 6, 7, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //U
            u8x16(2, 3, 0, 1, 4, 5, 6, 7, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //U2
            u8x16(1, 2, 3, 0, 4, 5, 6, 7, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //U'
        ],
        [
            u8x16(0, 1, 2, 3, 7, 4, 5, 6, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,), //D
            u8x16(0, 1, 2, 3, 6, 7, 4, 5, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,), //D2
            u8x16(0, 1, 2, 3, 5, 6, 7, 4, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,), //D'
        ],
        [
            u8x16(0, 1, 3, 4, 5, 2, 6, 7, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,), //F
            u8x16(0, 1, 4, 5, 2, 3, 6, 7, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,), //F2
            u8x16(0, 1, 5, 2, 3, 4, 6, 7, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,), //F'
        ],
        [
            u8x16(1, 6, 2, 3, 4, 5, 7, 0, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,), //B
            u8x16(6, 7, 2, 3, 4, 5, 0, 1, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //B2
            u8x16(7, 0, 2, 3, 4, 5, 1, 6, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //B'
        ],
        [
            u8x16(7, 1, 2, 0, 3, 5, 6, 4, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //L
            u8x16(4, 1, 2, 7, 0, 5, 6, 3, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //L2
            u8x16(3, 1, 2, 4, 7, 5, 6, 0, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //L'
        ],
        [
            u8x16(0, 2, 5, 3, 4, 6, 1, 7, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //R
            u8x16(0, 5, 6, 3, 4, 1, 2, 7, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //R2
            u8x16(0, 6, 1, 3, 4, 2, 5, 7, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //R'
        ],
    ];

    const TRANSFORMATION_CP_SHUFFLE: [[v128; 3]; 3] = [
        [
            u8x16(3, 2, 5, 4, 7, 6, 1, 0, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //x
            u8x16(4, 5, 6, 7, 0, 1, 2, 3, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //x2
            u8x16(7, 6, 1, 0, 3, 2, 5, 4, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //x'
        ],
        [
            u8x16(3, 0, 1, 2, 5, 6, 7, 4, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //y
            u8x16(2, 3, 0, 1, 6, 7, 4, 5, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //y2
            u8x16(1, 2, 3, 0, 7, 4, 5, 6, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //y'
        ],
        [
            u8x16(7, 0, 3, 4, 5, 2, 1, 6, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //F
            u8x16(6, 7, 4, 5, 2, 3, 0, 1, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //F2
            u8x16(1, 6, 5, 2, 3, 4, 7, 0, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ), //F'
        ],
    ];
    const TRANSFORMATION_CO_MAP: [v128; 3] = [
        u8x16(0b00, 0b01, 0b10, 0xFF, 0b01, 0b10, 0b00, 0xFF, 0b10, 0b00, 0b01, 0xFF, 0b00, 0b01, 0b10, 0xFF, ), //z
        u8x16(0b00, 0b01, 0b10, 0xFF, 0b00, 0b01, 0b10, 0xFF, 0b00, 0b01, 0b10, 0xFF, 0b00, 0b01, 0b10, 0xFF, ), //y
        u8x16(0b00, 0b01, 0b10, 0xFF, 0b10, 0b00, 0b01, 0xFF, 0b01, 0b10, 0b00, 0xFF, 0b00, 0b01, 0b10, 0xFF, ), //x
    ];

    const CO_OVERFLOW_MASK: v128 = u8x16(0b00000100, 0b00000100, 0b00000100, 0b00000100, 0b00000100, 0b00000100, 0b00000100, 0b00000100, 0, 0, 0, 0, 0, 0, 0, 0, );

    const TURN_CO_CHANGE: [v128; 6] = [
        u8x16(1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0), //U
        u8x16(1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0), //D
        u8x16(1, 1, 2, 3, 2, 3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0), //F
        u8x16(2, 3, 1, 1, 1, 1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0), //B
        u8x16(3, 1, 1, 2, 3, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0), //L
        u8x16(1, 2, 3, 1, 1, 2, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0), //R
    ];

    #[inline]
    pub(crate) fn new_solved() -> CubeCornersOdd {
        CubeCornersOdd(u8x16_shl(
            u8x16(0, 1, 2, 3, 4, 5, 6, 7, 0, 0, 0, 0, 0, 0, 0, 0),
            5,
        ))
    }

    #[inline]
    pub(crate) fn from_bytes(bytes: [u8; 8]) -> CubeCornersOdd {
        CubeCornersOdd(u8x16(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7], 0, 0, 0, 0, 0, 0, 0, 0))
    }

    #[inline]
    pub(crate) fn get_corners_raw(cube: &CubeCornersOdd) -> u64 {
        u64x2_extract_lane::<0>(cube.0)
    }

    #[inline]
    pub(crate) fn get_corners(cube: &CubeCornersOdd) -> [Corner; 8] {
        let mut corner_bits = get_corners_raw(cube);
        let mut corner_arr = [Corner {
            id: 0,
            orientation: 0,
        }; 8];
        for cid in 0..8 {
            let corner = (corner_bits & 0xFF) as u8;
            corner_bits >>= 8;
            corner_arr[cid] = Corner {
                id: corner >> 5,
                orientation: corner & 0x7,
            };
        }
        corner_arr
    }

    #[inline]
    pub(crate) fn turn(cube: &mut CubeCornersOdd, face: CubeFace, turn_type: Direction) {
        cube.0 = u8x16_swizzle(
            cube.0,
            TURN_CORNER_SHUFFLE[face as usize][turn_type as usize],
        );
        if turn_type != Direction::Half {
            //Valid COs are 00, 01, 10. When we move, we don't add 0, 1, 2 (no change, clockwise, counter-clockwise), but we add 1, 2, 3 to force overflowing into the next bit.
            //This code either subtracts 1 if there is no overflow (because we added 1 too much before), or 4, because this gives us the original addition mod 3.
            let corners_tmp = u8x16_add(cube.0, TURN_CO_CHANGE[face as usize]);
            let overflow_bits = v128_and(corners_tmp, CO_OVERFLOW_MASK);
            let not_overflow = u16x8_shr(v128_andnot(CO_OVERFLOW_MASK, corners_tmp), 2);
            let overflow_sub = v128_or(overflow_bits, not_overflow);
            cube.0 = u8x16_sub(corners_tmp, overflow_sub);
        }
    }

    #[inline]
    pub(crate) fn transform(cube: &mut CubeCornersOdd, axis: CubeAxis, turn_type: Direction) {
        let corners_translated = u8x16_swizzle(
            cube.0,
            TRANSFORMATION_CP_SHUFFLE[axis as usize][turn_type as usize],
        );
        let cp = u32x4_shr(v128_and(corners_translated, u8x16_set1(0b11100000)), 5);
        let co = v128_and(corners_translated, u8x16_set1(0b00000011));
        let cp_translated = u32x4_shl(
            u8x16_swizzle(
                TRANSFORMATION_CP_SHUFFLE[axis as usize][turn_type.invert() as usize],
                cp,
            ),
            5,
        );
        let co = if turn_type != Direction::Half {
            let corner_orbit_id = v128_and(cp_translated, u8x16_set1(0b00100000));
            //We want 4 bits. The lowest two are for the corner CO, the third tells us which orbit the corner belongs to, and the fourth is which orbit the corner is in.
            //Changing the CO only depends on the axis, corner orbit and previous UD-CO, so we can just use a lookup table to do this in a simple way
            let co_id = v128_or(u32x4_shr(corner_orbit_id, 3), co);
            let co_id = v128_or(
                co_id,
                u8x16(
                    0, 0, 0, 0, 0, 0, 0, 0, 0b1000, 0, 0b1000, 0, 0b1000, 0, 0b1000, 0,
                ),
            );
            u8x16_swizzle(TRANSFORMATION_CO_MAP[axis], co_id)
        } else {
            co
        };
        cube.0 = v128_or(cp_translated, co);
    }

    #[inline]
    pub(crate) fn invert(cube: &mut CubeCornersOdd) {
        let corner_ids =
            (u64x2_extract_lane::<0>(u32x4_shr(v128_and(cube.0, u8x16_set1(0xE0)), 5)))
                .to_le_bytes();

        let mut corner_shuffle = corner_ids.clone();
        for i in 0..8 {
            corner_shuffle[corner_ids[i] as usize] = i as u8;
        }
        let corner_shuffle_mask = unsafe { v128_load(corner_shuffle.as_ptr() as *const v128) };

        //Splice together the corner permutation, and the CO of the corners on the inverse (see niss prediction to see how this works)
        //Also switch CO 1 <-> 2,  CO 0 stays the same
        let cp = v128_and(
            u8x16_swizzle(
                u8x16_swizzle(cube.0, corner_shuffle_mask),
                corner_shuffle_mask,
            ),
            u8x16_set1(0b11100000),
        );
        let co_shuffle = u8x16_swizzle(cube.0, u32x4_shr(cp, 5));
        let tmp = v128_and(u8x16_add(co_shuffle, u8x16_set1(1)), u8x16_set1(2));
        let co_flip_mask = v128_or(tmp, u32x4_shr(tmp, 1));
        let co = v128_and(v128_xor(co_shuffle, co_flip_mask), u8x16_set1(7));

        cube.0 = v128_or(cp, co);
    }
}