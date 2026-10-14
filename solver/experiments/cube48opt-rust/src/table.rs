//! cube48opt's padded, two-bit pruning tables (not nissy-core H48 files).
use std::{fs, io::Read, path::Path};

pub const OPT1_BYTES: usize = 30_401_280;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Variant(u8);

impl Variant {
    pub fn new(number: u8) -> Result<Self, String> {
        if (1..=9).contains(&number) {
            Ok(Self(number))
        } else {
            Err("CUBEOPT_VARIANT must be an integer from 1 to 9".into())
        }
    }
    pub fn number(self) -> u8 {
        self.0
    }
    pub fn eo_bits(self) -> u8 {
        if self.0 == 1 {
            0
        } else {
            self.0
        }
    }
    pub fn bytes(self) -> u64 {
        (OPT1_BYTES as u64) << self.eo_bits()
    }
    pub fn max_bound(self) -> u8 {
        match self.0 {
            1 => 10,
            2..=3 => 11,
            4..=7 => 12,
            _ => 13,
        }
    }
    pub fn checksum(self) -> u32 {
        // Opt1 is the verified generated golden. Opt2..9 are the nonzero
        // expected checksums passed by each pinned WASM's init_prun function.
        [
            0x780e1cba, 0xb3cd3a38, 0x8185c3b4, 0xe03723c6, 0x456aa3c7, 0xe6843b35, 0x6c7d5866,
            0x85408deb, 0xd66ff5cb,
        ][usize::from(self.0 - 1)]
    }
}

pub struct PruningTable {
    words: Vec<u32>,
    variant: Variant,
    distribution: [u64; 16],
}

impl PruningTable {
    pub fn load(path: &Path) -> Result<Self, String> {
        Self::load_variant(path, Variant(1))
    }

    pub fn load_variant(path: &Path, variant: Variant) -> Result<Self, String> {
        let size = fs::metadata(path).map_err(|e| e.to_string())?.len();
        if size != variant.bytes() {
            return Err(format!("opt{} requires exactly {} bytes; got {size}. Other variants and nissy tables are not interchangeable.", variant.number(), variant.bytes()));
        }
        let len = usize::try_from(size / 4).map_err(|_| "table needs a 64-bit host")?;
        let mut words = Vec::<u32>::new();
        words.try_reserve_exact(len).map_err(|e| e.to_string())?;
        words.resize(len, 0);
        let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
        for chunk in words.chunks_mut(1024 * 1024) {
            // u32 accepts every bit pattern; this exclusive byte view is
            // bounded to its initialized allocation. No second whole table.
            let bytes = unsafe {
                std::slice::from_raw_parts_mut(chunk.as_mut_ptr().cast::<u8>(), chunk.len() * 4)
            };
            file.read_exact(bytes).map_err(|e| e.to_string())?;
            #[cfg(target_endian = "big")]
            for word in chunk {
                *word = u32::from_le(*word);
            }
        }
        if file.read(&mut [0_u8; 1]).map_err(|e| e.to_string())? != 0 {
            return Err("table changed during read".into());
        }
        Self::from_words(words, variant)
    }

    /// Validate an owned table loaded by a host such as a WASM wrapper.
    /// Ownership moves into the table without allocating a second copy.
    pub fn from_words(words: Vec<u32>, variant: Variant) -> Result<Self, String> {
        if words.len() as u64 * 4 != variant.bytes() {
            return Err(format!(
                "opt{} requires exactly {} bytes; got {}",
                variant.number(), variant.bytes(), words.len() as u64 * 4
            ));
        }
        // The original check_pruning_dist_chunk masks the two reserved cells
        // in every block and the padded final cells in every 512-entry slice.
        // Keep the recovered reference distribution as a corruption check.
        let mut counts = [0_u64; 16];
        let mut checksum = 0_u32;
        let base = usize::from(variant.max_bound() - 3);
        for (i, &word) in words.iter().enumerate() {
            let valid = if i & 3 == 0 {
                0x5555_5550
            } else if i & 31 == 31 {
                0x1555_5555
            } else {
                0x5555_5555
            };
            let low = word & valid;
            let high = word >> 1;
            counts[base + 3] += (low & high).count_ones() as u64;
            counts[base + 2] += (valid & !word & high).count_ones() as u64;
            counts[base + 1] += (low & !high).count_ones() as u64;
            let fallback = (words[i & !3] & 15) as usize;
            counts[fallback] += (valid & !word & !high).count_ones() as u64;
            checksum ^= word;
        }
        if checksum != variant.checksum()
            || counts.iter().sum::<u64>() != 117_567_450_u64 << variant.eo_bits()
            || counts[usize::from(variant.max_bound()) + 1..]
                .iter()
                .any(|&n| n != 0)
            || variant.number() == 1
                && counts
                    != [
                        36, 27, 77, 547, 3218, 20172, 102167, 393472, 4953846, 34776317, 77317571,
                        0, 0, 0, 0, 0,
                    ]
        {
            return Err(
                "table checksum or pruning distribution differs from the verified variant".into(),
            );
        }
        Ok(Self {
            words,
            variant,
            distribution: counts,
        })
    }

    #[inline(always)]
    pub fn get(&self, index: u64) -> u8 {
        let word = (index >> 4) as usize;
        let code = (self.words[word] >> ((index & 15) * 2)) & 3;
        if code == 0 {
            (self.words[word & !3] & 15) as u8
        } else {
            code as u8 + self.variant.max_bound() - 3
        }
    }

    /// Exact Opt9 decoder, selected once by the private specialized oracle.
    /// Retains checked PDB accesses: no unchecked public index entry point.
    #[inline(always)]
    pub(crate) fn get_opt9(&self, index: u64) -> u8 {
        debug_assert_eq!(self.variant.number(), 9);
        let word = (index >> 4) as usize;
        let code = (self.words[word] >> ((index & 15) * 2)) & 3;
        if code == 0 {
            (self.words[word & !3] & 15) as u8
        } else {
            code as u8 + 10
        }
    }

    /// Start the immutable PDB read while the other search contexts still
    /// compute their coordinates. Invalid indices issue no hint and never
    /// form an out-of-allocation pointer; checked lookup remains authoritative.
    #[cfg(all(feature = "opt9-native-prefetch", not(target_family = "wasm")))]
    #[inline(always)]
    pub(crate) fn prefetch_opt9(&self, index: u64) {
        #[cfg(target_arch = "aarch64")]
        if let Some(address) = self.prefetch_word_address(index) {
            // address comes from an in-bounds reference to the live immutable
            // Vec. PRFM is a read hint only and does not mutate table contents.
            unsafe {
                std::arch::asm!(
                    "prfm pldl1keep, [{address}]",
                    address = in(reg) address,
                    options(readonly, nostack, preserves_flags),
                );
            }
        }
        #[cfg(not(target_arch = "aarch64"))]
        let _ = index;
    }

    #[cfg(all(feature = "opt9-native-prefetch", not(target_family = "wasm"), any(target_arch = "aarch64", test)))]
    #[inline(always)]
    fn prefetch_word_address(&self, index: u64) -> Option<*const u32> {
        let word = usize::try_from(index >> 4).ok()?;
        self.words.get(word).map(|word| word as *const u32)
    }

    pub fn byte_len(&self) -> usize {
        self.words.len() * 4
    }
    pub fn variant(&self) -> Variant {
        self.variant
    }
    pub fn distribution(&self) -> &[u64; 16] {
        &self.distribution
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn owned_table_rejects_wrong_size_before_scanning() {
        for number in 1..=9 {
            assert!(PruningTable::from_words(vec![0; 8], Variant::new(number).unwrap()).is_err());
        }
    }
    #[test]
    fn packed_codes_and_fallback_cross_word_boundary() {
        let mut table = PruningTable {
            words: vec![0; 8],
            variant: Variant(1),
            distribution: [0; 16],
        };
        table.words[0] = 5;
        table.words[1] = 1 | (2 << 2) | (3 << 30);
        table.words[4] = 7;
        assert_eq!(table.get(16), 8);
        assert_eq!(table.get(17), 9);
        assert_eq!(table.get(31), 10);
        assert_eq!(table.get(32), 5);
        assert_eq!(table.get(80), 7);
        for number in 2..=9 {
            table.variant = Variant::new(number).unwrap();
            assert_eq!(table.get(16), table.variant.max_bound() - 2);
            assert_eq!(table.get(17), table.variant.max_bound() - 1);
            assert_eq!(table.get(31), table.variant.max_bound());
            assert_eq!(table.get(32), 5);
            if number == 9 {
                for index in 0..(table.words.len() as u64 * 16) {
                    assert_eq!(table.get_opt9(index), table.get(index));
                }
            }
        }
    }

    #[cfg(all(feature = "opt9-native-prefetch", not(target_family = "wasm")))]
    #[test]
    fn opt9_prefetch_has_bounded_addresses_and_preserves_all_decoded_cells() {
        let mut table = PruningTable {
            words: vec![0; 8], variant: Variant(9), distribution: [0; 16],
        };
        table.words[0] = 5;
        table.words[1] = 1 | (2 << 2) | (3 << 30);
        table.words[4] = 7;
        table.words[7] = 0x0123_4567;
        let before = table.words.clone();
        assert_eq!(table.prefetch_word_address(0), Some(&table.words[0] as *const u32));
        assert_eq!(table.prefetch_word_address(15), Some(&table.words[0] as *const u32));
        assert_eq!(table.prefetch_word_address(16), Some(&table.words[1] as *const u32));
        assert_eq!(table.prefetch_word_address(127), Some(&table.words[7] as *const u32));
        for index in [128, 129, u64::MAX] {
            assert!(table.prefetch_word_address(index).is_none());
            table.prefetch_opt9(index);
        }
        for index in 0..128 {
            let expected = table.get(index);
            table.prefetch_opt9(index);
            assert_eq!(table.get_opt9(index), expected);
        }
        assert_eq!(table.words, before);
        table.words.clear();
        assert!(table.prefetch_word_address(0).is_none());
        table.prefetch_opt9(0);
    }
}
