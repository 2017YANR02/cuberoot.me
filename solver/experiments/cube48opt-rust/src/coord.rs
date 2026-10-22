//! Opt1--9 padded H48 coordinates, recovered from WASM functions 37, 97, 100.
//! Only the small, non-PDB lookup snapshot is imported. Opt1 omits EO; Opt2--9
//! retain the highest 2--9 bits of the conjugated eleven-bit edge orientation.

pub use crate::cube::Cube;

#[cfg(target_arch = "x86_64")]
#[path = "coord_x86.rs"]
mod x86;

pub const SNAPSHOT_BYTES: usize = 816_856;
pub const CORNER_RAW_COUNT: usize = 70 * 2187;
pub const CORNER_CLASSES: u32 = 3393;
pub const EDGE_STRIDE: u32 = 70 * 512;
pub const COORDINATE_COUNT: u32 = CORNER_CLASSES * EDGE_STRIDE;
pub const PDB_BYTES: usize = COORDINATE_COUNT as usize / 4;

// The constants above and legacy u32 methods describe Opt1 only.
// Opt8/9 use memory64 in WASM, but the imported LUT elements remain u8/u16/u32.
fn layout(variant: u8) -> Result<(usize, usize), String> {
    match variant {
        1 => Ok((0, 0)),
        2..=7 => Ok((96, 96)),
        8..=9 => Ok((1152, 832)),
        _ => Err("cube48opt variant must be 1..9".into()),
    }
}

pub fn snapshot_bytes(variant: u8) -> Result<usize, String> {
    Ok(SNAPSHOT_BYTES + layout(variant)?.0)
}

pub struct CoordTables {
    variant: u8,
    corner_class: Box<[u32; CORNER_RAW_COUNT]>,
    symmetries: [[u8; 20]; 48],
    symmetry_inverse: [u8; 48],
    separation8: [u8; 128],
    separation12: Box<[u16; 2048]>,
    // The validated corner table only names 0..48. Padding to 64 lets the
    // compiler prove that the existing entry & 63 SIMD lookup is in bounds.
    // Unused slots retain inert padding and change no legal-state coordinate.
    edge_sources: [[u8; 16]; 64],
    edge_identities: [[u8; 16]; 64],
    edge_source_flips: [[u8; 16]; 64],
    edge_inverse_cubies: [[u8; 16]; 64],
    outer_complement: Box<[[u8; 8]; 2048]>,
}

/// Native Opt9-only rank lookup. The 12 edge identities belong to three
/// groups of four. Their first eleven base-3 digits uniquely determine the
/// last one, so 3^11 slots cover every legal partition without changing the
/// existing padded edge coordinate or the on-disk pruning table.
#[cfg(all(feature = "opt9-native-ternary", target_arch = "aarch64"))]
pub(crate) struct Opt9TernaryRanks {
    ranks: Box<[u16; 177_147]>,
}

/// Fixed Opt8 layout for the shared-memory server adapter. Construction binds
/// the EO projection once; callers cannot supply an Opt9 table by accident.
pub struct Opt8CoordTables(CoordTables);

#[cfg(all(test, feature = "opt8-native-specialized", not(target_family = "wasm")))]
mod opt8_specialized_checks {
    use super::*;

    #[test]
    #[ignore = "reads only the local 818008-byte small snapshot, never a PDB"]
    fn opt8_fixed_packing_matches_scalar_generic_and_wasm_wrapper() {
        let bytes = std::fs::read(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../.tmp/cubeopt-reverse/opt9-generated/small-memory.bin")).unwrap();
        assert_eq!(bytes.len(), 818008);
        let tables = CoordTables::from_variant_bytes(&bytes, 8).unwrap();
        let wrapper = Opt8CoordTables::from_bytes(&bytes).unwrap();
        let mut cube = Cube::SOLVED;
        let mut seed = 0x4839_e019_3b76_5931u64;
        let mut checked = 0;
        let mut wide = 0;
        let mut max_index = 0;
        for _ in 0..1024 {
            for symmetry in 0..48 {
                let normal = tables.conjugate(&cube, symmetry);
                for state in [normal, normal.inverse()] {
                    let expected = tables.index64_slow(&state);
                    assert_eq!(tables.index64(&state), expected);
                    assert_eq!(tables.index8(&state), expected);
                    assert_eq!(tables.index64_specialized(&state), expected);
                    assert_eq!(wrapper.index(&state), expected);
                    assert!(expected < tables.coordinate_count());
                    wide += usize::from(expected > u64::from(u32::MAX));
                    max_index = max_index.max(expected);
                    checked += 1;
                }
            }
            seed ^= seed << 13;
            seed ^= seed >> 7;
            seed ^= seed << 17;
            cube = cube.moved((seed % 18) as u8);
        }
        assert_eq!(checked, 98304);
        assert!(wide > 0, "Opt8 coordinates must exercise bits above u32");
        println!("Opt8 fixed packing: checks={checked}, wide={wide}, max_index={max_index}, pdbBytes=0");
    }
}

impl Opt8CoordTables {
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, String> {
        CoordTables::from_variant_bytes(bytes, 8).map(Self)
    }
    #[inline(always)]
    pub fn index(&self, cube: &Cube) -> u64 {
        self.0.index8(cube)
    }
    pub fn conjugate(&self, cube: &Cube, symmetry: u8) -> Cube { self.0.conjugate(cube, symmetry) }
    pub fn index_scalar(&self, cube: &Cube) -> u64 { self.0.index64_slow(cube) }
}

/// Fixed Opt9 packing for the isolated shared-WASM candidate. Construction
/// binds the snapshot layout once; the hot path reuses the native index9 math.
pub struct Opt9CoordTables(CoordTables);

impl Opt9CoordTables {
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, String> {
        CoordTables::from_variant_bytes(bytes, 9).map(Self)
    }
    #[inline(always)]
    pub fn index(&self, cube: &Cube) -> u64 { self.0.index9(cube) }
    pub fn conjugate(&self, cube: &Cube, symmetry: u8) -> Cube { self.0.conjugate(cube, symmetry) }
    pub fn index_scalar(&self, cube: &Cube) -> u64 { self.0.index64_slow(cube) }
}

impl CoordTables {
    /// Research geometry only. These are spatial rotations, not legal fixed-
    /// centre cube states; their cubie permutations can have opposite parity.
    #[cfg(feature = "corner-research")]
    pub(crate) fn proper_rotations(&self) -> Vec<Cube> {
        self.symmetries.iter().filter(|s| s[..8].iter().all(|&c| c < 24))
            .map(|s| Cube { corners: s[..8].try_into().unwrap(), edges: s[8..].try_into().unwrap() })
            .collect()
    }

    pub(crate) fn corner_entry(&self, cube: &Cube) -> u32 {
        self.corner_class[self.raw_corner(cube)]
    }

    /// EO10 retains canonical positions 1..10. Parity makes its omitted
    /// freedom a simultaneous flip at positions 0 and 11; return those two
    /// positions in the input cube, using the same source convention as the
    /// coordinate decoder. This only supports the native Opt10 experiment.
    #[cfg(all(any(feature = "opt10-native-lookahead", feature = "opt10-native-projection"), not(target_family = "wasm")))]
    pub(crate) fn eo10_omitted_sources(&self, cube: &Cube) -> [u8; 2] {
        self.eo10_omitted_sources_in_frame((self.corner_entry(cube) & 63) as u8)
    }

    #[cfg(all(any(feature = "opt10-native-lookahead", feature = "opt10-native-projection"), not(target_family = "wasm")))]
    pub(crate) fn eo10_omitted_sources_in_frame(&self, symmetry: u8) -> [u8; 2] {
        let sources = &self.edge_sources[usize::from(symmetry)];
        [sources[0], sources[11]]
    }

    /// Full EO pattern in an already chosen corner frame. No symmetry folding.
    pub(crate) fn full_pattern_in_frame(&self, cube: &Cube, class: u32) -> u64 {
        let mut outer = 0usize;
        let mut inner = 0usize;
        let mut inner_position = 0;
        let mut eo = 0u64;
        for (position, &edge) in cube.edges.iter().enumerate() {
            let identity = edge >> 1;
            if identity >= 8 { outer |= 1 << position; }
            else {
                inner |= usize::from((identity >> 2) & 1) << inner_position;
                inner_position += 1;
            }
            if position < 11 { eo |= u64::from(edge & 1) << position; }
        }
        (((u64::from(class) * 70 + u64::from(self.separation8[inner & 127])) << 11 | eo) << 9)
            | u64::from(self.separation12[outer & 2047])
    }

    /// Research-only EO10 coordinates, using the validated Opt9 small LUTs.
    /// This does not invent an upstream variant, checksum or PDB decoder.
    pub(crate) fn eo10_index(&self, cube: &Cube, scalar: bool) -> u64 {
        assert_eq!(self.variant, 9);
        let (orbit, eo) = if scalar {
            self.coordinate_parts_slow::<true>(cube)
        } else {
            #[cfg(target_arch = "aarch64")]
            { unsafe { self.coordinate_parts_neon::<true>(cube) } }
            #[cfg(target_arch = "x86_64")]
            { self.coordinate_parts_x86::<true>(cube) }
            #[cfg(not(any(target_arch = "aarch64", target_arch = "x86_64")))]
            { self.coordinate_parts_slow::<true>(cube) }
        };
        ((u64::from(orbit) & !511) << 10)
            | (u64::from(eo >> 1) << 9)
            | u64::from(orbit & 511)
    }

    /// One explicitly selected canonical corner frame. The caller must choose
    /// a symmetry with the same raw representative as the ordinary frame;
    /// the projection selector validates this while building its small LUT.
    #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
    pub(crate) fn eo10_index_in_frame(&self, cube: &Cube, raw: usize, symmetry: u8) -> u64 {
        assert_eq!(self.variant, 9);
        assert!(symmetry < 48);
        let entry = (self.corner_class[raw] & !63) | u32::from(symmetry);
        #[cfg(target_arch = "aarch64")]
        {
            // Reuse the existing bounded edge shuffles and combination rank,
            // without conjugating a full Cube or recomputing its corner rank.
            let (orbit, eo) = unsafe {
                let (_, identities, eo) = self.edge_parts_neon_in_frame::<true>(cube, entry);
                self.rank_edge_parts_neon(entry, identities, eo)
            };
            ((u64::from(orbit) & !511) << 10)
                | (u64::from(eo >> 1) << 9)
                | u64::from(orbit & 511)
        }
        #[cfg(not(target_arch = "aarch64"))]
        {
            let full = self.full_pattern_in_frame(&self.conjugate(cube, symmetry), entry >> 6);
            ((full >> 10) << 9) | (full & 511)
        }
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, String> {
        Self::from_variant_bytes(bytes, 1)
    }

    pub fn from_variant_bytes(bytes: &[u8], variant: u8) -> Result<Self, String> {
        let (delta, separation_delta) = layout(variant)?;
        let snapshot_bytes = SNAPSHOT_BYTES + delta;
        if bytes.len() != snapshot_bytes {
            return Err(format!(
                "opt{variant} small-table snapshot must be {snapshot_bytes} bytes"
            ));
        }
        let corner_class: Box<[u32; CORNER_RAW_COUNT]> = bytes[204_496 + delta..snapshot_bytes]
            .chunks_exact(4)
            .map(|b| u32::from_le_bytes(b.try_into().unwrap()))
            .collect::<Vec<_>>()
            .into_boxed_slice()
            .try_into()
            .map_err(|_| "corner class table length differs")?;
        if corner_class
            .iter()
            .any(|&v| v >> 6 >= CORNER_CLASSES || v & 63 >= 48)
            || corner_class.iter().map(|v| v >> 6).max() != Some(CORNER_CLASSES - 1)
        {
            return Err("invalid/uninitialized corner class table".into());
        }
        let mut symmetries = [[0u8; 20]; 48];
        for (i, symmetry) in symmetries.iter_mut().enumerate() {
            symmetry.copy_from_slice(&bytes[189_856 + delta + 20 * i..189_876 + delta + 20 * i]);
            // Symmetry corners can encode mirrors (orientation 3..5).
            if symmetry[..8].iter().any(|&v| v >= 48) || symmetry[8..].iter().any(|&v| v >= 24) {
                return Err("invalid symmetry cubie".into());
            }
        }
        let symmetry_inverse: [u8; 48] =
            bytes[195_792 + delta..195_840 + delta].try_into().unwrap();
        if symmetry_inverse.iter().any(|&v| v >= 48) {
            return Err("invalid symmetry inverse".into());
        }
        let separation8 = bytes[6_560 + separation_delta..6_688 + separation_delta]
            .try_into()
            .unwrap();
        let separation12: Box<[u16; 2048]> = bytes[6_688 + separation_delta..10_784 + separation_delta]
            .chunks_exact(2)
            .map(|b| u16::from_le_bytes(b.try_into().unwrap()))
            .collect::<Vec<_>>()
            .into_boxed_slice()
            .try_into()
            .map_err(|_| "4-of-12 table length differs")?;
        let outer_complement: Box<[[u8; 8]; 2048]> = bytes[13_632 + delta..30_016 + delta]
            .chunks_exact(8)
            .map(|b| b.try_into().unwrap())
            .collect::<Vec<[u8; 8]>>()
            .into_boxed_slice()
            .try_into()
            .map_err(|_| "edge complement table length differs")?;
        let mut edge_sources = [[0x80u8; 16]; 64];
        let mut edge_identities = [[0u8; 16]; 64];
        let mut edge_source_flips = [[0u8; 16]; 64];
        let mut edge_inverse_cubies = [[0u8; 16]; 64];
        for s in 0..48 {
            for i in 0..12 {
                edge_sources[s][i] = symmetries[s][8 + i] >> 1;
                edge_identities[s][i] = symmetries[symmetry_inverse[s] as usize][8 + i] >> 1;
                edge_source_flips[s][i] = symmetries[s][8 + i] & 1;
                edge_inverse_cubies[s][i] = symmetries[symmetry_inverse[s] as usize][8 + i];
            }
        }
        let tables = Self {
            variant,
            corner_class,
            symmetries,
            symmetry_inverse,
            separation8,
            separation12,
            edge_sources,
            edge_identities,
            edge_source_flips,
            edge_inverse_cubies,
            outer_complement,
        };
        // Independently recreate the small padded combination mapping.
        let mut rank8 = 0u8;
        let mut rank12 = 2u16;
        for mask in (0u16..4096).rev().filter(|m| m.count_ones() == 4) {
            if mask < 256 {
                if tables.separation8[(mask & 127) as usize] != rank8 {
                    return Err("4-of-8 mapping differs".into());
                }
                rank8 += 1;
            }
            if tables.separation12[(mask & 2047) as usize] != rank12 {
                return Err("padded 4-of-12 mapping differs".into());
            }
            let complement = (0u8..12)
                .filter(|i| mask & (1 << i) == 0)
                .collect::<Vec<_>>();
            if tables.outer_complement[(mask & 2047) as usize].as_slice() != complement {
                return Err("edge complement lookup differs".into());
            }
            rank12 += 1;
            if rank12 & 63 == 0 {
                rank12 += 2;
            }
        }
        for (m, expected) in crate::cube::MOVES.iter().enumerate() {
            if bytes[190_816 + delta + 20 * m..190_836 + delta + 20 * m] != expected.to_bytes() {
                return Err("snapshot move definitions differ".into());
            }
        }
        Ok(tables)
    }

    pub fn variant(&self) -> u8 {
        self.variant
    }

    /// Retained EO bits; the published family has no one-bit member.
    pub fn orientation_bits(&self) -> u8 {
        if self.variant == 1 {
            0
        } else {
            self.variant
        }
    }

    pub fn coordinate_count(&self) -> u64 {
        u64::from(COORDINATE_COUNT) << self.orientation_bits()
    }

    #[inline]
    fn pack_index(&self, orbit: u32, eo: u16) -> u64 {
        let bits = self.orientation_bits();
        ((u64::from(orbit) & !511) << bits)
            | (u64::from(eo >> (11 - bits)) << 9)
            | u64::from(orbit & 511)
    }

    /// The variant is bound to this table object, so callers cannot mix an
    /// Opt1 index with an Opt9 table by passing a different per-query option.
    #[inline]
    pub fn index64(&self, cube: &Cube) -> u64 {
        if self.variant == 1 {
            return u64::from(self.index(cube));
        }
        #[cfg(target_arch = "aarch64")]
        let (orbit, eo) = unsafe { self.coordinate_parts_neon::<true>(cube) };
        #[cfg(all(target_family = "wasm", target_feature = "simd128"))]
        let (orbit, eo) = unsafe { self.coordinate_parts_wasm::<true>(cube) };
        #[cfg(target_arch = "x86_64")]
        let (orbit, eo) = self.coordinate_parts_x86::<true>(cube);
        #[cfg(not(any(target_arch = "aarch64", target_arch = "x86_64", all(target_family = "wasm", target_feature = "simd128"))))]
        let (orbit, eo) = self.coordinate_parts_slow::<true>(cube);
        self.pack_index(orbit, eo)
    }

    /// Scalar specification of the full, variant-bound coordinate.
    pub fn index64_slow(&self, cube: &Cube) -> u64 {
        let (orbit, eo) = self.coordinate_parts_slow::<true>(cube);
        self.pack_index(orbit, eo)
    }

    /// Checked dispatch for coordinate-only callers and differential checks.
    /// The search oracle dispatches once per solve instead of per query.
    #[inline(always)]
    pub fn index64_specialized(&self, cube: &Cube) -> u64 {
        #[cfg(all(feature = "opt8-native-specialized", not(target_family = "wasm")))]
        if self.variant == 8 { return self.index8(cube); }
        if self.variant == 9 { self.index9(cube) } else { self.index64(cube) }
    }

    /// The established Opt8 WASM packing, also available to the private native
    /// Opt8 oracle after one validated dispatch. Same coordinate and table.
    #[inline(always)]
    pub(crate) fn index8(&self, cube: &Cube) -> u64 {
        debug_assert_eq!(self.variant, 8);
        #[cfg(target_arch = "aarch64")]
        let (orbit, eo) = unsafe { self.coordinate_parts_neon::<true>(cube) };
        #[cfg(all(target_family = "wasm", target_feature = "simd128"))]
        let (orbit, eo) = unsafe { self.coordinate_parts_wasm::<true>(cube) };
        #[cfg(target_arch = "x86_64")]
        let (orbit, eo) = self.coordinate_parts_x86::<true>(cube);
        #[cfg(not(any(target_arch = "aarch64", target_arch = "x86_64", all(target_family = "wasm", target_feature = "simd128"))))]
        let (orbit, eo) = self.coordinate_parts_slow::<true>(cube);
        ((u64::from(orbit) & !511) << 8)
            | (u64::from(eo >> 3) << 9)
            | u64::from(orbit & 511)
    }

    /// Only the private Opt9 oracle calls this after its entry-point dispatch.
    /// It shares the SIMD/scalar coordinate implementation and merely fixes
    /// the existing pack_index formula to nine retained EO bits.
    #[inline(always)]
    pub(crate) fn index9(&self, cube: &Cube) -> u64 {
        debug_assert_eq!(self.variant, 9);
        #[cfg(target_arch = "aarch64")]
        let (orbit, eo) = unsafe { self.coordinate_parts_neon::<true>(cube) };
        #[cfg(all(target_family = "wasm", target_feature = "simd128"))]
        let (orbit, eo) = unsafe { self.coordinate_parts_wasm::<true>(cube) };
        #[cfg(target_arch = "x86_64")]
        let (orbit, eo) = self.coordinate_parts_x86::<true>(cube);
        #[cfg(not(any(target_arch = "aarch64", target_arch = "x86_64", all(target_family = "wasm", target_feature = "simd128"))))]
        let (orbit, eo) = self.coordinate_parts_slow::<true>(cube);
        ((u64::from(orbit) & !511) << 9)
            | (u64::from(eo >> 2) << 9)
            | u64::from(orbit & 511)
    }

    #[cfg(all(feature = "opt9-native-ternary", target_arch = "aarch64"))]
    pub(crate) fn opt9_ternary_ranks(&self) -> Opt9TernaryRanks {
        assert_eq!(self.variant, 9);
        // Invalid group counts keep a sentinel. Search only supplies legal
        // cubes; legal partitions fill exactly C(12,4)*C(8,4)=34,650 entries.
        let mut ranks = vec![u16::MAX; 177_147];
        let mut filled = 0usize;
        for outer in 0u16..4096 {
            if outer.count_ones() != 4 { continue; }
            let complement = 4095 ^ outer;
            let mut middle = complement;
            loop {
                if middle.count_ones() == 4 {
                    let mut inner = 0usize;
                    let mut inner_position = 0usize;
                    let mut key = 0usize;
                    let mut power = 1usize;
                    for position in 0..12 {
                        let outer_bit = (outer >> position) & 1;
                        let middle_bit = (middle >> position) & 1;
                        if outer_bit == 0 {
                            inner |= usize::from(middle_bit) << inner_position;
                            inner_position += 1;
                        }
                        if position < 11 {
                            let group = if outer_bit != 0 { 2 } else { usize::from(middle_bit) };
                            key += group * power;
                            power *= 3;
                        }
                    }
                    let rank = u16::from(self.separation8[inner & 127]) * 512
                        + self.separation12[usize::from(outer) & 2047];
                    // Validated padded ranks are <= 69*512+511 = 35,839.
                    assert!(rank <= 35_839);
                    assert_eq!(ranks[key], u16::MAX);
                    ranks[key] = rank;
                    filled += 1;
                }
                if middle == 0 { break; }
                middle = (middle - 1) & complement;
            }
        }
        assert_eq!(filled, 34_650);
        Opt9TernaryRanks { ranks: ranks.into_boxed_slice().try_into().unwrap() }
    }

    #[cfg(all(feature = "opt9-native-ternary", target_arch = "aarch64"))]
    #[inline(always)]
    pub(crate) fn index9_ternary(&self, cube: &Cube, ranks: &Opt9TernaryRanks) -> u64 {
        debug_assert_eq!(self.variant, 9);
        // The canonical-frame transform and EO calculation are shared with
        // the unchanged coordinate. Only edge partition ranking differs.
        let (orbit, eo) = unsafe {
            use std::arch::aarch64::*;
            let (entry, identities, eo) = self.canonical_edge_parts_neon::<true>(cube);
            let groups = vshrq_n_u8::<2>(identities);
            let weights = vld1_u8([1u8, 3, 9, 27, 81, 243, 0, 0].as_ptr());
            let first = usize::from(vaddvq_u16(vmull_u8(vget_low_u8(groups), weights)));
            let high = vextq_u8::<6>(groups, vdupq_n_u8(0));
            let high_weights = vld1_u8([1u8, 3, 9, 27, 81, 0, 0, 0].as_ptr());
            let second = usize::from(vaddvq_u16(vmull_u8(vget_low_u8(high), high_weights)));
            // Groups are 0..2. Six digits <=728 and five <=242, so the
            // u16 partial reductions never truncate and key <=177,146.
            let key = first + 729 * second;
            let orbit = (entry >> 6) * EDGE_STRIDE + u32::from(ranks.ranks[key]);
            (orbit, eo)
        };
        ((u64::from(orbit) & !511) << 9)
            | (u64::from(eo >> 2) << 9)
            | u64::from(orbit & 511)
    }

    /// Raw corner orientation (little-endian base 3) and tetrad separation.
    #[inline]
    pub fn raw_corner(&self, cube: &Cube) -> usize {
        let mut co = 0usize;
        let mut pow = 1usize;
        let mut mask = 0usize;
        for (i, &corner) in cube.corners.iter().enumerate() {
            if i < 7 {
                co += (corner >> 3) as usize * pow;
                pow *= 3;
            }
            mask |= ((corner as usize >> 2) & 1) << i;
        }
        co * 70 + self.separation8[mask & 127] as usize
    }

    #[inline]
    pub fn index(&self, cube: &Cube) -> u32 {
        assert_eq!(
            self.variant, 1,
            "u32 index() is only valid for Opt1; use index64()"
        );
        #[cfg(target_arch = "aarch64")]
        // AArch64 always provides NEON. This function only loads within Cube
        // and the validated, fixed-size small tables owned by self.
        unsafe {
            self.coordinate_parts_neon::<false>(cube).0
        }
        #[cfg(all(target_family = "wasm", target_feature = "simd128"))]
        unsafe {
            self.coordinate_parts_wasm::<false>(cube).0
        }
        #[cfg(target_arch = "x86_64")]
        { self.coordinate_parts_x86::<false>(cube).0 }
        #[cfg(not(any(target_arch = "aarch64", target_arch = "x86_64", all(target_family = "wasm", target_feature = "simd128"))))]
        self.index_slow(cube)
    }

    /// Straight scalar specification retained for full differential checks.
    pub fn index_slow(&self, cube: &Cube) -> u32 {
        assert_eq!(
            self.variant, 1,
            "u32 index_slow() is only valid for Opt1; use index64_slow()"
        );
        self.coordinate_parts_slow::<false>(cube).0
    }

    fn coordinate_parts_slow<const WITH_EO: bool>(&self, cube: &Cube) -> (u32, u16) {
        let entry = self.corner_class[self.raw_corner(cube)];
        let symmetry = &self.symmetries[(entry & 63) as usize];
        let inverse = &self.symmetries[self.symmetry_inverse[(entry & 63) as usize] as usize];
        let mut outer = 0usize;
        let mut inner = 0usize;
        let mut inner_position = 0;
        let mut eo = 0;
        for position in 0..12 {
            // edge_conj, with orientations omitted because opt1 ignores EO.
            let source = (symmetry[8 + position] >> 1) as usize;
            let identity = (cube.edges[source] >> 1) as usize;
            let transformed = inverse[8 + identity] >> 1;
            if WITH_EO {
                let flip =
                    (cube.edges[source] ^ symmetry[8 + position] ^ inverse[8 + identity]) & 1;
                eo |= u16::from(flip) << position;
            }
            if transformed & 8 != 0 {
                outer |= 1 << position;
            } else {
                inner |= ((transformed as usize >> 2) & 1) << inner_position;
                inner_position += 1;
            }
        }
        debug_assert_eq!(inner_position, 8);
        let orbit = (entry >> 6) * EDGE_STRIDE
            + (self.separation8[inner & 127] as u32) * 512
            + self.separation12[outer & 2047] as u32;
        (orbit, eo & 2047)
    }

    /// The byte-shuffle coordinate in native WebAssembly SIMD. This preserves
    /// the scalar packing exactly: corner representative, twelve conjugated
    /// edges, EO bitmask, and the eight-edge complement mask. No per-edge
    /// indexed scalar loads or branches remain in this path.
    #[cfg(all(target_family = "wasm", target_feature = "simd128"))]
    #[inline(always)]
    unsafe fn coordinate_parts_wasm<const WITH_EO: bool>(&self, cube: &Cube) -> (u32, u16) {
        #[cfg(target_arch = "wasm32")]
        use std::arch::wasm32::*;
        #[cfg(target_arch = "wasm64")]
        use std::arch::wasm64::*;

        // The eight corners are a complete in-bounds 64-bit load. Multiplying
        // each twist by its base-three place gives the same 0..2186 scalar CO.
        let corners = v128_load64_zero(cube.corners.as_ptr().cast::<u64>());
        let orientation = u16x8_extend_low_u8x16(u8x16_shr(corners, 3));
        let products = i16x8_mul(orientation, u16x8(1, 3, 9, 27, 81, 243, 729, 0));
        let pairs = i32x4_extadd_pairwise_u16x8(products);
        let halves = i32x4_add(pairs, i32x4_shuffle::<2, 3, 0, 1>(pairs, pairs));
        let total = i32x4_add(halves, i32x4_shuffle::<1, 0, 3, 2>(halves, halves));
        let co = u32x4_extract_lane::<0>(total) as usize;
        let corner_mask = usize::from(i8x16_bitmask(i8x16_shl(corners, 5))) & 127;
        let entry = self.corner_class[co * 70 + self.separation8[corner_mask] as usize];
        let s = (entry & 63) as usize;

        // Cube is exactly 20 bytes. Load 4..20 and shuffle away the four corner
        // bytes, so there is no 16-byte read past the 12-byte edge array.
        let tail = v128_load((cube as *const Cube).cast::<u8>().add(4).cast::<v128>());
        let edges = i8x16_shuffle::<4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19>(tail, u8x16_splat(0));
        let source_values = i8x16_swizzle(edges, v128_load(self.edge_sources[s].as_ptr().cast::<v128>()));
        let (identities, eo) = if WITH_EO {
            let transformed = v128_xor(
                i8x16_swizzle(v128_load(self.edge_inverse_cubies[s].as_ptr().cast::<v128>()), u8x16_shr(source_values, 1)),
                v128_and(v128_xor(source_values, v128_load(self.edge_source_flips[s].as_ptr().cast::<v128>())), u8x16_splat(1)),
            );
            (u8x16_shr(transformed, 1), i8x16_bitmask(i8x16_shl(transformed, 7)) & 2047)
        } else {
            (i8x16_swizzle(v128_load(self.edge_identities[s].as_ptr().cast::<v128>()), u8x16_shr(source_values, 1)), 0)
        };
        let outer = usize::from(i8x16_bitmask(i8x16_shl(identities, 4))) & 2047;
        let positions = v128_load64_zero(self.outer_complement[outer].as_ptr().cast::<u64>());
        let remaining = i8x16_swizzle(identities, positions);
        let inner = usize::from(i8x16_bitmask(i8x16_shl(remaining, 5))) & 127;
        let orbit = (entry >> 6) * EDGE_STRIDE
            + (self.separation8[inner] as u32) * 512
            + self.separation12[outer] as u32;
        (orbit, eo)
    }

    /// Native version of the WASM's two byte-table lookups and complement
    /// shuffle. No per-edge branch or conjugated Cube is needed in this path.
    #[cfg(target_arch = "aarch64")]
    #[inline]
    unsafe fn coordinate_parts_neon<const WITH_EO: bool>(&self, cube: &Cube) -> (u32, u16) {
        let (entry, identities, eo) = self.canonical_edge_parts_neon::<WITH_EO>(cube);
        self.rank_edge_parts_neon(entry, identities, eo)
    }

    #[cfg(target_arch = "aarch64")]
    #[inline(always)]
    unsafe fn rank_edge_parts_neon(&self, entry: u32, identities: std::arch::aarch64::uint8x16_t, eo: u16) -> (u32, u16) {
        use std::arch::aarch64::*;
        let weights = vld1_u8([1u8, 2, 4, 8, 16, 32, 64, 128].as_ptr());
        let outer_bits = vandq_u8(vshrq_n_u8::<3>(identities), vdupq_n_u8(1));
        let outer = (vaddv_u8(vmul_u8(vget_low_u8(outer_bits), weights)) as usize
            | ((vaddv_u8(vmul_u8(vget_high_u8(outer_bits), weights)) as usize) << 8))
            & 2047;
        let positions = vcombine_u8(
            vld1_u8(self.outer_complement[outer].as_ptr()),
            vdup_n_u8(0x80),
        );
        let remaining = vget_low_u8(vqtbl1q_u8(identities, positions));
        let inner = vaddv_u8(vmul_u8(
            vand_u8(vshr_n_u8::<2>(remaining), vdup_n_u8(1)),
            weights,
        )) as usize
            & 127;
        let orbit = (entry >> 6) * EDGE_STRIDE
            + (self.separation8[inner] as u32) * 512
            + self.separation12[outer] as u32;
        (orbit, eo)
    }

    #[cfg(target_arch = "aarch64")]
    #[inline(always)]
    unsafe fn canonical_edge_parts_neon<const WITH_EO: bool>(&self, cube: &Cube) -> (u32, std::arch::aarch64::uint8x16_t, u16) {
        use std::arch::aarch64::*;
        let corners = vld1_u8(cube.corners.as_ptr());
        let orientation = vmovl_u8(vshr_n_u8::<3>(corners));
        let co = vaddvq_u16(vmulq_u16(
            orientation,
            vld1q_u16([1u16, 3, 9, 27, 81, 243, 729, 0].as_ptr()),
        )) as usize;
        let weights = vld1_u8([1u8, 2, 4, 8, 16, 32, 64, 128].as_ptr());
        let corner_mask = vaddv_u8(vmul_u8(
            vand_u8(vshr_n_u8::<2>(corners), vdup_n_u8(1)),
            weights,
        )) as usize;
        let entry = self.corner_class[co * 70 + self.separation8[corner_mask & 127] as usize];
        self.edge_parts_neon_in_frame::<WITH_EO>(cube, entry)
    }

    #[cfg(target_arch = "aarch64")]
    #[inline(always)]
    unsafe fn edge_parts_neon_in_frame<const WITH_EO: bool>(&self, cube: &Cube, entry: u32) -> (u32, std::arch::aarch64::uint8x16_t, u16) {
        use std::arch::aarch64::*;
        let weights = vld1_u8([1u8, 2, 4, 8, 16, 32, 64, 128].as_ptr());
        let s = (entry & 63) as usize;
        // repr(C) Cube is exactly 20 bytes: this load spans bytes 4..20,
        // then discards the four remaining corner bytes. No over-read.
        let tail = vld1q_u8((cube as *const Cube).cast::<u8>().add(4));
        let edges = vextq_u8::<4>(tail, vdupq_n_u8(0));
        let source_values = vqtbl1q_u8(edges, vld1q_u8(self.edge_sources[s].as_ptr()));
        let (identities, eo) = if WITH_EO {
            let transformed = veorq_u8(
                vqtbl1q_u8(
                    vld1q_u8(self.edge_inverse_cubies[s].as_ptr()),
                    vshrq_n_u8::<1>(source_values),
                ),
                vandq_u8(
                    veorq_u8(source_values, vld1q_u8(self.edge_source_flips[s].as_ptr())),
                    vdupq_n_u8(1),
                ),
            );
            let flips = vandq_u8(transformed, vdupq_n_u8(1));
            let eo = u16::from(vaddv_u8(vmul_u8(vget_low_u8(flips), weights)))
                | (u16::from(vaddv_u8(vmul_u8(vget_high_u8(flips), weights))) << 8);
            (vshrq_n_u8::<1>(transformed), eo & 2047)
        } else {
            (
                vqtbl1q_u8(
                    vld1q_u8(self.edge_identities[s].as_ptr()),
                    vshrq_n_u8::<1>(source_values),
                ),
                0,
            )
        };
        (entry, identities, eo)
    }

    /// Original symmetry conjugation, including reflected corner frames.
    /// Kept public for differential checking; search indexing only needs edges.
    pub fn conjugate(&self, cube: &Cube, symmetry_index: u8) -> Cube {
        let s = &self.symmetries[symmetry_index as usize];
        let inv = &self.symmetries[self.symmetry_inverse[symmetry_index as usize] as usize];
        let mut result = Cube::SOLVED;
        for i in 0..8 {
            let source = s[i];
            let current = cube.corners[(source & 7) as usize];
            let destination = inv[(current & 7) as usize];
            let twist = (current >> 3) + (source >> 3);
            let twist = if destination < 24 { twist } else { 12 - twist };
            result.corners[i] = destination & 7 | ((twist + (destination >> 3)) % 3) << 3;
        }
        for i in 0..12 {
            let source = s[8 + i];
            let current = cube.edges[(source >> 1) as usize];
            result.edges[i] = inv[8 + (current >> 1) as usize] ^ ((current ^ source) & 1);
        }
        result
    }
}

#[cfg(all(test, feature = "opt9-native-ternary", target_arch = "aarch64"))]
mod ternary_tests {
    use super::*;

    // No PDB or snapshot is loaded. Identity symmetry isolates edge ranking;
    // the real snapshot receives a separate full-state differential check.
    fn tables() -> CoordTables {
        let mut separation8 = [0u8; 128];
        let mut separation12 = Box::new([0u16; 2048]);
        let mut outer_complement = vec![[0u8; 8]; 2048];
        let mut rank8 = 0u8;
        let mut rank12 = 2u16;
        for mask in (0u16..4096).rev().filter(|m| m.count_ones() == 4) {
            if mask < 256 { separation8[usize::from(mask & 127)] = rank8; rank8 += 1; }
            separation12[usize::from(mask & 2047)] = rank12;
            outer_complement[usize::from(mask & 2047)] = (0u8..12)
                .filter(|i| mask & (1 << i) == 0).collect::<Vec<_>>().try_into().unwrap();
            rank12 += 1;
            if rank12 & 63 == 0 { rank12 += 2; }
        }
        let mut edge_sources = [[0x80u8; 16]; 64];
        let mut edge_identities = [[0u8; 16]; 64];
        let mut edge_inverse_cubies = [[0u8; 16]; 64];
        for i in 0..12 {
            edge_sources[0][i] = i as u8;
            edge_identities[0][i] = i as u8;
            edge_inverse_cubies[0][i] = 2 * i as u8;
        }
        CoordTables {
            variant: 9,
            corner_class: vec![0u32; CORNER_RAW_COUNT].into_boxed_slice().try_into().unwrap(),
            symmetries: [Cube::SOLVED.to_bytes(); 48], symmetry_inverse: [0; 48],
            separation8, separation12, edge_sources, edge_identities,
            edge_source_flips: [[0; 16]; 64], edge_inverse_cubies,
            outer_complement: outer_complement.into_boxed_slice().try_into().unwrap(),
        }
    }

    #[test]
    fn every_edge_partition_and_eo_bit_matches_existing_rank() {
        let tables = tables();
        let ranks = tables.opt9_ternary_ranks();
        let mut checked = 0usize;
        for outer in 0u16..4096 {
            if outer.count_ones() != 4 { continue; }
            let complement = 4095 ^ outer;
            let mut middle = complement;
            loop {
                if middle.count_ones() == 4 {
                    let mut cube = Cube::SOLVED;
                    let mut counts = [0u8; 3];
                    for p in 0..12 {
                        let group = if outer & (1 << p) != 0 { 2 }
                            else if middle & (1 << p) != 0 { 1 } else { 0 };
                        cube.edges[p] = 2 * (4 * group as u8 + counts[group]);
                        counts[group] += 1;
                    }
                    assert_eq!(counts, [4, 4, 4]);
                    assert_eq!(tables.index9_ternary(&cube, &ranks), tables.index9(&cube));
                    assert_eq!(tables.index9_ternary(&cube, &ranks), tables.index64_slow(&cube));
                    // Each retained and discarded EO bit, with parity fixed.
                    for bit in 0..11 {
                        cube.edges[bit] ^= 1; cube.edges[11] ^= 1;
                        assert_eq!(tables.index9_ternary(&cube, &ranks), tables.index9(&cube));
                        cube.edges[bit] ^= 1; cube.edges[11] ^= 1;
                    }
                    checked += 1;
                }
                if middle == 0 { break; }
                middle = (middle - 1) & complement;
            }
        }
        assert_eq!(checked, 34_650);
        assert_eq!(ranks.ranks.iter().filter(|&&x| x != u16::MAX).count(), checked);
        assert!(ranks.ranks.iter().filter(|&&x| x != u16::MAX).all(|&x| x <= 35_839));
        assert_eq!(2usize * (1 + 3 + 9 + 27 + 81 + 243), 728);
        assert_eq!(2usize * (1 + 3 + 9 + 27 + 81), 242);
        assert_eq!(728 + 729 * 242, ranks.ranks.len() - 1);
    }
}
