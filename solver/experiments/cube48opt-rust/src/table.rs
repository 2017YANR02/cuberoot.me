//! cube48opt's padded, two-bit pruning tables (not nissy-core H48 files).
use std::{fs, io::Read, path::Path};

#[path = "table_validation_cache.rs"]
mod validation_cache;

pub const OPT1_BYTES: usize = 30_401_280;

/// Byte offset and length of complete pages strictly contained in an allocation.
/// Pure arithmetic: no pointer is constructed or memory accessed here.
#[cfg(all(feature = "opt8-native-hugepages", any(test, all(target_os = "linux", target_arch = "x86_64"))))]
fn full_pages_inside(address: usize, bytes: usize, page: usize) -> Result<Option<(usize, usize)>, &'static str> {
    if address == 0 || !page.is_power_of_two() || page > isize::MAX as usize {
        return Err("invalid allocation address or base page size");
    }
    if bytes > isize::MAX as usize {
        return Err("allocation exceeds pointer offset limit");
    }
    let end = address.checked_add(bytes).ok_or("allocation end overflow")?;
    let offset = (page - address % page) % page;
    if offset >= bytes {
        return Ok(None);
    }
    let start = address.checked_add(offset).ok_or("aligned start overflow")?;
    let aligned_end = end - end % page;
    if aligned_end <= start {
        return Ok(None);
    }
    Ok(Some((offset, aligned_end - start)))
}

#[cfg(all(feature = "opt8-native-hugepages", target_os = "linux", target_arch = "x86_64"))]
fn advise_opt8_hugepages(words: &mut Vec<u32>, requested_len: usize) {
    use std::ffi::{c_int, c_void};
    // Linux libc ABI: man7.org/linux/man-pages/man2/{getpagesize,madvise}.2.html.
    unsafe extern "C" {
        fn getpagesize() -> c_int;
        fn madvise(address: *mut c_void, length: usize, advice: c_int) -> c_int;
    }
    // Linux x86 UAPI includes asm-generic/mman-common.h, which defines this value.
    const MADV_HUGEPAGE: c_int = 14;
    let mut advise = || -> Result<Option<(usize, usize)>, String> {
        if requested_len > words.capacity() {
            return Err("requested table exceeds reserved capacity".into());
        }
        let bytes = requested_len.checked_mul(std::mem::size_of::<u32>())
            .ok_or("table byte length overflow")?;
        // SAFETY: getpagesize takes no pointers and has no memory preconditions.
        let page = usize::try_from(unsafe { getpagesize() }).map_err(|_| "invalid base page size")?;
        let pointer = words.as_mut_ptr().cast::<u8>();
        let Some((offset, length)) = full_pages_inside(pointer as usize, bytes, page)? else {
            return Ok(None);
        };
        // SAFETY: reserve has allocated at least requested_len u32s. The checked
        // range is entirely inside that allocation, excludes partial edge pages,
        // and is a whole number of base pages (madvise cannot round it outward).
        // add preserves the allocation's provenance; no reference to uninitialized
        // words is created. MADV_HUGEPAGE advises mapping policy without reading,
        // writing, discarding, or changing access permissions of these bytes.
        // The Vec stays alive and cannot reallocate during this synchronous call.
        let result = unsafe { madvise(pointer.add(offset).cast::<c_void>(), length, MADV_HUGEPAGE) };
        if result != 0 {
            return Err(std::io::Error::last_os_error().to_string());
        }
        Ok(Some((length, page)))
    };
    match advise() {
        Ok(Some((bytes, page))) => eprintln!("Opt8: MADV_HUGEPAGE accepted for {bytes} bytes (base page {page}); actual THP backing is kernel-dependent"),
        Ok(None) => eprintln!("Opt8: MADV_HUGEPAGE skipped (no complete allocated pages); continuing without advice"),
        Err(error) => eprintln!("Opt8: MADV_HUGEPAGE unavailable: {error}; continuing without advice"),
    }
}

// Preserve the existing WASM load/decode boundary even under LTO. None lanes
// never read the table; every Some retains the ordinary slice bounds check.
#[cfg(all(feature = "opt8-native-batch", not(target_family = "wasm")))]
#[inline(never)]
fn load_opt8_probe_words(words: &[u32], queries: &[Option<u64>; 8]) -> [u32; 8] {
    std::array::from_fn(|i| queries[i].map_or(0, |index| words[(index >> 4) as usize]))
}

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
        Self::load_file(path, variant, false, false)
    }

    /// Native CLI fast path: reuse validation only for an unchanged local file.
    /// The ordinary load_variant/from_words APIs still always validate fully.
    pub fn load_variant_cached(path: &Path, variant: Variant, force: bool) -> Result<Self, String> {
        Self::load_file(path, variant, true, force)
    }

    fn load_file(path: &Path, variant: Variant, cache_validation: bool, force: bool) -> Result<Self, String> {
        let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
        let before = file.metadata().map_err(|e| e.to_string())?;
        let size = before.len();
        if size != variant.bytes() {
            return Err(format!("opt{} requires exactly {} bytes; got {size}. Other variants and nissy tables are not interchangeable.", variant.number(), variant.bytes()));
        }
        let len = usize::try_from(size / 4).map_err(|_| "table needs a 64-bit host")?;
        let mut words = Vec::<u32>::new();
        words.try_reserve_exact(len).map_err(|e| e.to_string())?;
        #[cfg(all(feature = "opt8-native-hugepages", target_os = "linux", target_arch = "x86_64"))]
        if variant.number() == 8 {
            advise_opt8_hugepages(&mut words, len);
        }
        words.resize(len, 0);
        let cache = cache_validation.then(|| validation_cache::Cache::new(path, &before, variant)).flatten();
        if force {
            if let Some(cache) = &cache {
                // A failed forced recheck must never leave an old success receipt.
                cache.invalidate().map_err(|e| format!("cannot invalidate table validation cache: {e}"))?;
            }
        }
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
        if validation_cache::identity(&before) != validation_cache::identity(&file.metadata().map_err(|e| e.to_string())?) {
            return Err("table changed during read".into());
        }
        if let Some(counts) = cache.as_ref().filter(|_| !force).and_then(|cache| cache.read()) {
            eprintln!("Opt{}: table validation reused (unchanged file)", variant.number());
            return Ok(Self { words, variant, distribution: counts });
        }
        if cache_validation {
            eprintln!("Opt{}: validating complete table", variant.number());
        }
        let table = Self::from_words(words, variant)?;
        if validation_cache::identity(&before) != validation_cache::identity(&file.metadata().map_err(|e| e.to_string())?) {
            return Err("table changed during validation".into());
        }
        if let Some(cache) = cache {
            if let Err(error) = cache.write(&table.distribution) {
                eprintln!("Table verified, but validation cache could not be saved: {error}");
            }
        }
        Ok(table)
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
        if checksum != variant.checksum() || !valid_distribution(&counts, variant) {
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

    /// Exact Opt8 decoder. Checked reads and code-zero block fallback remain
    /// identical to get(); only the validated layout's base becomes constant.
    #[cfg(all(feature = "opt8-native-specialized", not(target_family = "wasm")))]
    #[inline(always)]
    pub(crate) fn get_opt8(&self, index: u64) -> u8 {
        debug_assert_eq!(self.variant.number(), 8);
        let word = (index >> 4) as usize;
        let code = (self.words[word] >> ((index & 15) * 2)) & 3;
        if code == 0 {
            (self.words[word & !3] & 15) as u8
        } else {
            code as u8 + 10
        }
    }

    /// Read the same immutable Opt8 cells together, then decode in lane order.
    /// Zero codes still read their original aligned block header.
    #[cfg(all(feature = "opt8-native-batch", not(target_family = "wasm")))]
    #[inline(always)]
    pub(crate) fn get_opt8_batch(&self, queries: &[Option<u64>; 8]) -> [u8; 8] {
        debug_assert_eq!(self.variant.number(), 8);
        let loaded = load_opt8_probe_words(&self.words, queries);
        std::array::from_fn(|i| {
            let Some(index) = queries[i] else { return 0; };
            let code = (loaded[i] >> ((index & 15) * 2)) & 3;
            if code == 0 {
                (self.words[((index >> 4) as usize) & !3] & 15) as u8
            } else {
                code as u8 + 10
            }
        })
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

    /// Opt1–7 generic-oracle candidate; Opt8/9 keep their separate policies.
    #[cfg(all(feature = "opt1-7-native-prefetch", not(target_family = "wasm")))]
    #[inline(always)]
    pub(crate) fn prefetch_opt1_to_7(&self, index: u64) {
        #[cfg(target_arch = "x86_64")]
        if self.variant.number() <= 7 {
            crate::prefetch::read_word(&self.words, index);
        }
        #[cfg(not(target_arch = "x86_64"))]
        let _ = index;
    }

    /// Start the immutable PDB read while the other search contexts still
    /// compute their coordinates. Invalid indices issue no hint and never
    /// form an out-of-allocation pointer; checked lookup remains authoritative.
    #[cfg(all(feature = "opt9-native-prefetch", not(target_family = "wasm")))]
    #[inline(always)]
    pub(crate) fn prefetch_opt9(&self, index: u64) {
        #[cfg(target_arch = "x86_64")]
        crate::prefetch::read_word(&self.words, index);
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
        #[cfg(not(any(target_arch = "aarch64", target_arch = "x86_64")))]
        let _ = index;
    }

    /// Opt8 x86 candidate: hint the primary word only, while preserving the
    /// exact decoder and the order in which search contexts are processed.
    /// SSE prefetch is available on every x86_64 host; no AVX capability is
    /// required. Other architectures retain their ordinary lookup behavior.
    #[cfg(all(feature = "opt8-native-prefetch", not(target_family = "wasm")))]
    #[inline(always)]
    pub(crate) fn prefetch_opt8(&self, index: u64) {
        #[cfg(target_arch = "x86_64")]
        if let Some(address) = self.prefetch_word_address(index) {
            // An in-bounds reference to this immutable Vec supplies the
            // pointer. The instruction is only a read hint, never a load
            // used as a bound or a substitute for the checked decoder.
            unsafe {
                std::arch::x86_64::_mm_prefetch(address.cast::<i8>(), std::arch::x86_64::_MM_HINT_T0);
            }
        }
        #[cfg(not(target_arch = "x86_64"))]
        let _ = index;
    }

    #[cfg(all(not(target_family = "wasm"), any(
        all(feature = "opt9-native-prefetch", any(target_arch = "aarch64", test)),
        all(feature = "opt8-native-prefetch", any(target_arch = "x86_64", test)),
    )))]
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

fn valid_distribution(counts: &[u64; 16], variant: Variant) -> bool {
    counts.iter().try_fold(0_u64, |total, count| total.checked_add(*count))
        == Some(117_567_450_u64 << variant.eo_bits())
        && counts[usize::from(variant.max_bound()) + 1..].iter().all(|&n| n == 0)
        && (variant.number() != 1 || *counts == [
            36, 27, 77, 547, 3218, 20172, 102167, 393472, 4953846, 34776317, 77317571,
            0, 0, 0, 0, 0,
        ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(feature = "opt8-native-hugepages")]
    #[test]
    fn hugepage_advice_range_contains_only_complete_allocated_pages() {
        assert_eq!(full_pages_inside(0x1000, 0x3000, 0x1000), Ok(Some((0, 0x3000))));
        assert_eq!(full_pages_inside(0x1004, 0x3000, 0x1000), Ok(Some((0xffc, 0x2000))));
        assert_eq!(full_pages_inside(0x1004, 0x1ffc, 0x1000), Ok(Some((0xffc, 0x1000))));
        assert_eq!(full_pages_inside(0x1004, 0x1ffb, 0x1000), Ok(None));
        assert_eq!(full_pages_inside(0x1000, 0, 0x1000), Ok(None));
        assert_eq!(full_pages_inside(0x1000, 0xfff, 0x1000), Ok(None));
        for (address, bytes, page) in [
            (0, 4096, 4096), (4096, 4096, 0), (4096, 4096, 3),
            (4096, 4096, usize::MAX), (4096, isize::MAX as usize + 1, 4096),
            (usize::MAX - 8, 16, 4096), (1, 1, isize::MAX as usize + 1),
        ] {
            assert!(full_pages_inside(address, bytes, page).is_err());
        }
        // Every possible base-page offset, plus alternate runtime page sizes.
        // No allocation, FFI, or table loading is involved in these checks.
        for page in [4096, 16384, 65536] {
            for displacement in 0..page {
                let address = page * 4 + displacement;
                for bytes in [0, 1, page - 1, page, page + 1, page * 2 - 1, page * 2, page * 3 + 7] {
                    if let Some((offset, length)) = full_pages_inside(address, bytes, page).unwrap() {
                        assert!(offset < page && length > 0);
                        assert_eq!((address + offset) % page, 0);
                        assert_eq!(length % page, 0);
                        assert!(offset + length <= bytes);
                        assert!(bytes - offset - length < page);
                    } else {
                        let first_page = address / page + usize::from(address % page != 0);
                        assert!(first_page * page + page > address + bytes);
                    }
                }
            }
        }
    }
    #[cfg(all(feature = "opt8-native-batch", not(target_family = "wasm")))]
    #[test]
    fn opt8_batch_decoder_matches_scalar_sparse_lanes_and_block_headers() {
        let empty = PruningTable {
            words: vec![], variant: Variant(8), distribution: [0; 16],
        };
        assert_eq!(empty.get_opt8_batch(&[None; 8]), [0; 8]);
        let mut table = PruningTable {
            words: vec![0; 64], variant: Variant(8), distribution: [0; 16],
        };
        let mut seen_codes = 0u32;
        let mut seen_headers = 0u32;
        for phase in 0..16u32 {
            for (word, value) in table.words.iter_mut().enumerate() {
                *value = 0;
                for slot in 0..16 {
                    *value |= ((phase + word as u32 + slot) & 3) << (slot * 2);
                }
                if word & 3 == 0 {
                    *value = (*value & !15) | ((phase + word as u32 / 4) % 14);
                }
            }
            for base in (0..1024u64).step_by(8) {
                for mask in [0xffu8, 0x55, 0xaa] {
                    // The stride mixes words and aligned blocks across lanes,
                    // including index zero and the final valid cell.
                    let queries = std::array::from_fn(|i| {
                        (mask & (1 << i) != 0).then_some((base + i as u64 * 73) % 1024)
                    });
                    let actual = table.get_opt8_batch(&queries);
                    for (i, query) in queries.into_iter().enumerate() {
                        let Some(index) = query else { assert_eq!(actual[i], 0); continue; };
                        let word = (index >> 4) as usize;
                        let code = (table.words[word] >> ((index & 15) * 2)) & 3;
                        seen_codes |= 1 << code;
                        if code == 0 { seen_headers |= 1 << (table.words[word & !3] & 15); }
                        assert_eq!(actual[i], table.get(index));
                        assert_eq!(actual[i], table.get_opt8(index));
                    }
                }
            }
        }
        assert_eq!(seen_codes, 15);
        assert_eq!(seen_headers, (1 << 14) - 1);
        let mut invalid = [None; 8];
        invalid[7] = Some(1024);
        assert!(std::panic::catch_unwind(|| table.get_opt8_batch(&invalid)).is_err());
    }

    #[cfg(all(feature = "opt8-native-specialized", not(target_family = "wasm")))]
    #[test]
    fn opt8_fixed_decoder_matches_generic_all_cells_codes_and_headers() {
        let mut table = PruningTable {
            words: vec![0; 64], variant: Variant(8), distribution: [0; 16],
        };
        let mut seen_codes = 0u32;
        let mut seen_headers = 0u32;
        let mut checked = 0;
        for phase in 0..16u32 {
            for (word, value) in table.words.iter_mut().enumerate() {
                *value = 0;
                for slot in 0..16 {
                    *value |= ((phase + word as u32 + slot) & 3) << (slot * 2);
                }
                if word & 3 == 0 {
                    *value = (*value & !15) | ((phase + word as u32 / 4) % 14);
                }
            }
            for index in 0..1024u64 {
                let word = (index >> 4) as usize;
                let code = (table.words[word] >> ((index & 15) * 2)) & 3;
                seen_codes |= 1 << code;
                let expected = if code == 0 {
                    let header = (table.words[word & !3] & 15) as u8;
                    seen_headers |= 1 << header;
                    header
                } else { code as u8 + 10 };
                assert_eq!(table.get(index), expected);
                assert_eq!(table.get_opt8(index), expected);
                checked += 1;
            }
        }
        assert_eq!(checked, 16384);
        assert_eq!(seen_codes, 15);
        assert_eq!(seen_headers, (1 << 14) - 1);
        assert!(std::panic::catch_unwind(|| table.get_opt8(1024)).is_err());
    }

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

    #[cfg(all(feature = "opt1-7-native-prefetch", not(target_family = "wasm")))]
    #[test]
    fn opt1_to_7_prefetch_preserves_variant_bases_and_block_fallbacks() {
        // Two small blocks exercise all codes, distinct fallback minima, the
        // last allocated word, empty storage and overflowing public indices.
        for number in 1..=7 {
            let mut table = PruningTable {
                words: vec![5, 1 | (2 << 2) | (3 << 30), 0, 0, 7, 0, 0, 0x0123_4567],
                variant: Variant::new(number).unwrap(), distribution: [0; 16],
            };
            let before = table.words.clone();
            let decoded: Vec<_> = (0..128).map(|index| table.get(index)).collect();
            assert_eq!(decoded[16], table.variant.max_bound() - 2);
            assert_eq!(decoded[17], table.variant.max_bound() - 1);
            assert_eq!(decoded[31], table.variant.max_bound());
            assert_eq!(decoded[32], 5);
            assert_eq!(decoded[80], 7);
            for index in 0..128 {
                table.prefetch_opt1_to_7(index);
                assert_eq!(table.get(index), decoded[index as usize]);
            }
            for index in [128, 129, u64::MAX] {
                table.prefetch_opt1_to_7(index);
                assert!(std::panic::catch_unwind(|| table.get(index)).is_err());
            }
            assert_eq!(table.words, before);
            table.words.clear();
            table.prefetch_opt1_to_7(0);
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

    #[cfg(all(feature = "opt8-native-prefetch", not(target_family = "wasm")))]
    #[test]
    fn opt8_prefetch_has_bounded_addresses_and_preserves_all_decoded_cells() {
        let mut table = PruningTable {
            words: vec![0; 8], variant: Variant(8), distribution: [0; 16],
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
            table.prefetch_opt8(index);
        }
        for index in 0..128 {
            let expected = table.get(index);
            table.prefetch_opt8(index);
            assert_eq!(table.get_opt8(index), expected);
        }
        assert_eq!(table.words, before);
        table.words.clear();
        assert!(table.prefetch_word_address(0).is_none());
        table.prefetch_opt8(0);
    }
}
