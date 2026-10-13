//! Cubie arithmetic recovered from cube48opt1.wasm, not from nissy.
//!
//! WASM functions 89/90 multiply, 94 moves, 40 makes the inverse half of
//! fastcube. The six generators below are the original .rodata bytes at
//! linear-memory addresses 4028, 4048, 4068, 4088, 4108, 4128.

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
/// that feature, and other architectures, retain the scalar operations.
/// Both implementations preserve move order and the remaining search state.
#[inline]
pub fn moved_pair(cube: &Cube, inverse: &Cube, movement: u8) -> (Cube, Cube) {
    #[cfg(all(feature = "neon-moves", target_arch = "aarch64"))]
    // AArch64 always provides NEON. All loads/stores stay within their objects;
    // the byte-table indices do not become memory addresses.
    unsafe {
        moved_pair_neon(cube, inverse, movement)
    }
    #[cfg(not(all(feature = "neon-moves", target_arch = "aarch64")))]
    (cube.moved(movement), inverse.premoved(movement))
}

// Same three 16-byte blocks as original fast-move table at address 30016:
// normal/inverse corners, normal edges, inverse edges. Four padding bytes per
// edge block are zero. The six physical generators remain the single source.
#[cfg(all(feature = "neon-moves", target_arch = "aarch64"))]
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
