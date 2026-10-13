// SPDX-License-Identifier: GPL-3.0-or-later
//! Pinned Nissy H48 h0..h11 parameters. These are unrelated to cubeopt Opt1..9.
//!
//! Bases and distributions come from nissy-core commit
//! 1f7e8e937d0e71e7eb3b5deab38b34d0a0159d88, respectively
//! src/solvers/h48/gendata_h48.h and checkdata.h. Sizes follow
//! gendata_types_macros.h, including 254 values per 64-byte cache line.
//! No table generation, allocation, or file access occurs in this module.

pub const HEADER_BYTES: u64 = 512;
pub const COCSEP_ENTRIES: u32 = 279_936;
pub const COCSEP_CLASSES: u32 = 3393;
pub const ESEP_ENTRIES: u32 = 34_650;
pub const ESEP_CLASSES: u32 = 782;
pub const EOESEP_ENTRIES: u32 = ESEP_CLASSES * 2048;
pub const COCSEP_OFFSET: u64 = HEADER_BYTES;
pub const MAIN_HEADER_OFFSET: u64 = COCSEP_OFFSET + COCSEP_ENTRIES as u64 * 4;
pub const MAIN_OFFSET: u64 = MAIN_HEADER_OFFSET + HEADER_BYTES;
pub const EOESEP_FULL_BYTES: u64 =
    HEADER_BYTES + ESEP_ENTRIES as u64 * 4 + EOESEP_ENTRIES as u64 / 2;
pub const LINE_BYTES: u64 = 64;
pub const LINE_ENTRIES: u64 = 254;
pub const NO_EO_ENTRIES: u64 = COCSEP_CLASSES as u64 * ESEP_ENTRIES as u64;

// The four raw two-bit code counts, not decoded-distance distributions.
const DISTRIBUTIONS: [[u64; 4]; 12] = [
    [5_473_562, 34_776_317, 68_566_704, 8_750_867],
    [6_012_079, 45_822_302, 142_018_732, 41_281_787],
    [6_391_286, 55_494_785, 252_389_935, 155_993_794],
    [6_686_828, 63_867_852, 392_789_689, 477_195_231],
    [77_147_213, 543_379_415, 1_139_570_251, 120_982_321],
    [82_471_284, 687_850_732, 2_345_840_746, 645_995_638],
    [85_941_099, 804_752_968, 4_077_248_182, 2_556_374_551],
    [88_529_761, 897_323_475, 6_126_260_791, 7_936_519_573],
    [1_051_579_940, 8_136_021_316, 19_024_479_822, 1_885_186_122],
    [1_102_038_189, 9_888_265_242, 38_299_375_805, 10_904_855_164],
    [
        1_133_240_039,
        11_196_285_614,
        64_164_702_961,
        43_894_840_186,
    ],
    [
        1_150_763_161,
        12_045_845_660,
        91_163_433_330,
        136_418_095_449,
    ],
];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct H48Variant(u8);

impl H48Variant {
    pub const H10: Self = Self(10);
    pub const ALL: [Self; 12] = [
        Self(0),
        Self(1),
        Self(2),
        Self(3),
        Self(4),
        Self(5),
        Self(6),
        Self(7),
        Self(8),
        Self(9),
        Self(10),
        Self(11),
    ];

    pub fn new(h: u8) -> Result<Self, String> {
        if h <= 11 {
            Ok(Self(h))
        } else {
            Err("Nissy H48 h must be between 0 and 11".into())
        }
    }

    #[inline(always)]
    pub const fn h(self) -> u8 {
        self.0
    }

    #[inline(always)]
    pub const fn base(self) -> u8 {
        match self.0 {
            0..=3 => 8,
            4..=7 => 9,
            _ => 10,
        }
    }

    /// Also bounds the shared COCSEP (9) and EOESEP (11) fallback tables.
    #[inline(always)]
    pub const fn max_bound(self) -> u8 {
        self.base() + 3
    }

    #[inline(always)]
    pub const fn main_entries(self) -> u64 {
        NO_EO_ENTRIES << self.0
    }
    pub const fn lines(self) -> u64 {
        self.main_entries().div_ceil(LINE_ENTRIES)
    }
    pub const fn main_bytes(self) -> u64 {
        self.lines() * LINE_BYTES
    }
    pub const fn main_header_entries(self) -> u64 {
        self.main_entries() + 2 * self.lines()
    }
    pub const fn padding_entries(self) -> u64 {
        self.lines() * LINE_ENTRIES - self.main_entries()
    }
    pub const fn eoesep_header_offset(self) -> u64 {
        MAIN_OFFSET + self.main_bytes()
    }
    pub const fn esep_offset(self) -> u64 {
        self.eoesep_header_offset() + HEADER_BYTES
    }
    pub const fn eoesep_offset(self) -> u64 {
        self.esep_offset() + ESEP_ENTRIES as u64 * 4
    }
    pub const fn file_bytes(self) -> u64 {
        self.eoesep_header_offset() + EOESEP_FULL_BYTES
    }
    pub const fn distribution(self) -> &'static [u64; 4] {
        &DISTRIBUTIONS[self.0 as usize]
    }

    /// Checked before any path lookup/open/map by the CLI. The library format
    /// and coordinate code supports h11 for a future separately authorized host.
    pub fn ensure_local_cli_allowed(self) -> Result<(), String> {
        if self.0 == 11 {
            Err("H11 is code-only on this machine: file access, mapping, solving and benchmarking are disabled".into())
        } else {
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_pinned_sizes_bases_and_distributions_are_consistent() {
        let bytes = [
            31_683_944,
            61_307_240,
            120_553_832,
            239_047_016,
            476_033_384,
            950_006_120,
            1_897_951_528,
            3_793_842_344,
            7_585_624_040,
            15_169_187_432,
            30_336_314_216,
            60_670_567_784,
        ];
        let padding = [6, 12, 24, 48, 96, 192, 130, 6, 12, 24, 48, 96];
        let bases = [8, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10, 10];
        for (i, variant) in H48Variant::ALL.into_iter().enumerate() {
            assert_eq!(variant.file_bytes(), bytes[i]);
            assert_eq!(variant.padding_entries(), padding[i]);
            assert_eq!(variant.base(), bases[i]);
            assert_eq!(
                variant.distribution().iter().sum::<u64>(),
                variant.main_entries()
            );
            assert_eq!(
                variant.eoesep_offset() + EOESEP_ENTRIES as u64 / 2,
                bytes[i]
            );
            assert_eq!(variant.file_bytes() - variant.main_bytes(), 2_060_648);
            assert!(variant.max_bound() >= 11);
            assert!(variant.main_entries() > (variant.lines() - 1) * LINE_ENTRIES);
        }
        assert!(H48Variant::new(12).is_err());
        assert!(H48Variant::new(255).is_err());
        assert_eq!(H48Variant::new(11).unwrap().main_entries(), 240_778_137_600);
    }

    #[test]
    fn h11_cli_is_rejected_without_file_access() {
        for variant in H48Variant::ALL {
            assert_eq!(
                variant.ensure_local_cli_allowed().is_ok(),
                variant.h() != 11
            );
        }
    }

    #[test]
    fn parameters_match_the_pinned_vendor_arrays() {
        // Independent source check: catch a copied digit or a changed vendor
        // revision without generating, reading, or mapping any table.
        let checkdata = include_str!("../../../vendor/nissy-core/src/solvers/h48/checkdata.h");
        let arrays: Vec<_> = checkdata.split(".table = {").skip(1).collect();
        assert_eq!(arrays.len(), 12);
        for (variant, array) in H48Variant::ALL.into_iter().zip(arrays) {
            let counts: Vec<u64> = array
                .split("},")
                .next()
                .unwrap()
                .lines()
                .filter_map(|line| {
                    line.split_once('=')
                        .map(|(_, value)| value.trim().trim_end_matches(',').parse().unwrap())
                })
                .collect();
            assert_eq!(counts, variant.distribution());
        }
        let generator = include_str!("../../../vendor/nissy-core/src/solvers/h48/gendata_h48.h");
        let bases = generator
            .split("static const uint8_t base[] = {")
            .nth(1)
            .unwrap()
            .split("};")
            .next()
            .unwrap();
        let bases: Vec<u8> = bases
            .lines()
            .filter_map(|line| {
                line.split_once('=')
                    .map(|(_, value)| value.trim().trim_end_matches(',').parse().unwrap())
            })
            .collect();
        assert_eq!(bases.len(), 12);
        for (variant, base) in H48Variant::ALL.into_iter().zip(bases) {
            assert_eq!(variant.base(), base);
        }
    }
}
