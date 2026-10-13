// SPDX-License-Identifier: GPL-3.0-or-later
// H48 file layout and decoding adapted from nissy-core, commit
// 1f7e8e937d0e71e7eb3b5deab38b34d0a0159d88:
// src/solvers/tables{,_types_macros}.h and src/solvers/h48/
// {gendata_types_macros,gendata_h48,gendata_eoesep,checkdata,distribution_h48}.h.
// Original H48 copyright (C) 2023-2024 Sebastiano Tronto and Enrico Tenuti.
// See solver/vendor/nissy-core/LICENSE for the license and warranty disclaimer.

//! Read-only Nissy H48 h0..h11 files, unrelated to cubeopt Opt1..9 tables.
//!
//! This format has no version tag or working checksum field. Compatibility is
//! pinned to the source revision above, its little-endian layout, exact headers,
//! and known distributions. Distribution checks do not replace a file SHA-256.
//! The file must remain unchanged and untruncated for the mapping's lifetime.

use std::{
    ffi::c_void,
    fs::File,
    io::{Read, Seek, SeekFrom},
    path::Path,
    ptr::NonNull,
};

use crate::h48_variant::H48Variant;
pub use crate::h48_variant::{COCSEP_OFFSET, MAIN_HEADER_OFFSET, MAIN_OFFSET};
pub const HEADER_BYTES: usize = 512;
pub const COCSEP_ENTRIES: usize = 279_936;
pub const ESEP_ENTRIES: usize = 34_650;
pub const EOESEP_ENTRIES: usize = 1_601_536;

const COCSEP_CLASSES: usize = 3393;
const ESEP_CLASSES: usize = 782;
const LINE_BYTES: usize = 64;
const LINE_ENTRIES: u64 = 254;
const EXPECTED_COCSEP: [u64; 21] = [
    1, 6, 63, 468, 3068, 15438, 53814, 71352, 8784, 96, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];
// Fixed complete auxiliary table, also recorded in the existing file header.
const EXPECTED_EOESEP: [u64; 21] = [
    1, 1, 3, 23, 235, 2281, 22069, 182776, 767847, 617858, 8439, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Validation {
    /// Header and complete small auxiliary-data checks only. Does not scan the
    /// main table; intended for bounded coordinate/oracle diagnostics.
    Headers,
    /// Also scan every main-table cache line and check its encoded distribution.
    /// Touches the whole mapping without creating a second table allocation.
    Full,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TableHeader {
    pub distribution: [u64; 21],
    pub table_type: u64,
    pub info_size: u64,
    pub full_size: u64,
    pub hash: u64,
    pub entries: u64,
    pub classes: u64,
    pub next: u64,
    pub solver: String,
    pub h: u8,
    pub bits: u8,
    pub base: u8,
    pub max_value: u8,
}

impl TableHeader {
    fn parse(bytes: &[u8]) -> Result<Self, String> {
        if bytes.len() != HEADER_BYTES {
            return Err("H48 header must contain exactly 512 bytes".into());
        }
        let integer = |offset| u64::from_le_bytes(bytes[offset..offset + 8].try_into().unwrap());
        let name = &bytes[224..324];
        let end = name
            .iter()
            .position(|&b| b == 0)
            .ok_or("H48 solver name is not NUL-terminated")?;
        if name[end..].iter().any(|&b| b != 0) {
            return Err("H48 solver name has nonzero bytes after its terminator".into());
        }
        let solver = std::str::from_utf8(&name[..end])
            .map_err(|_| "H48 solver name is not UTF-8")?
            .to_owned();
        Ok(Self {
            distribution: std::array::from_fn(|i| integer(i * 8)),
            table_type: integer(168),
            info_size: integer(176),
            full_size: integer(184),
            hash: integer(192),
            entries: integer(200),
            classes: integer(208),
            next: integer(216),
            solver,
            h: bytes[324],
            bits: bytes[325],
            base: bytes[326],
            max_value: bytes[327],
        })
    }
}

fn expected_headers(variant: H48Variant) -> [TableHeader; 3] {
    let mut main_distribution = [0; 21];
    main_distribution[..4].copy_from_slice(variant.distribution());
    [
        TableHeader {
            distribution: EXPECTED_COCSEP,
            table_type: 1,
            info_size: 512,
            full_size: 1_120_256,
            hash: 0,
            entries: COCSEP_ENTRIES as u64,
            classes: COCSEP_CLASSES as u64,
            next: 1_120_256,
            solver: "cocsep data for h48".into(),
            h: 0,
            bits: 32,
            base: 0,
            max_value: 9,
        },
        TableHeader {
            distribution: main_distribution,
            table_type: 0,
            info_size: 512,
            full_size: variant.main_bytes() + 512,
            hash: 0,
            // Includes two metadata slots per line, but not the unused tail.
            entries: variant.main_header_entries(),
            classes: 0,
            next: variant.main_bytes() + 512,
            solver: format!("h48 solver h ={:2}", variant.h()),
            h: variant.h(),
            bits: 2,
            base: variant.base(),
            max_value: 3,
        },
        TableHeader {
            distribution: EXPECTED_EOESEP,
            table_type: 1,
            info_size: 512,
            full_size: 939_880,
            hash: 0,
            entries: EOESEP_ENTRIES as u64,
            classes: ESEP_CLASSES as u64,
            next: 0,
            solver: "eoesep data for h48".into(),
            h: 0,
            bits: 4,
            base: 0,
            max_value: 11,
        },
    ]
}

fn check_header(header: &TableHeader, expected: &TableHeader, part: usize) -> Result<(), String> {
    if header != expected {
        return Err(format!(
            "H48 segment {part} does not match the pinned Nissy H48 format: {header:?}"
        ));
    }
    Ok(())
}

/// A main-table zero code requires an EOESEP lookup using the original state.
/// `line_min` alone is not the complete Nissy fallback.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct MainProbe {
    pub code: u8,
    pub line_min: u8,
}

impl MainProbe {
    #[inline(always)]
    pub fn nonzero_bound(self, variant: H48Variant) -> Option<u8> {
        (self.code != 0).then_some(variant.base() + self.code)
    }

    /// The caller can avoid computing the auxiliary bound for nonzero codes.
    #[inline(always)]
    pub fn with_fallback(self, variant: H48Variant, eoesep_bound: u8) -> u8 {
        if self.code == 0 {
            self.line_min.max(eoesep_bound)
        } else {
            variant.base() + self.code
        }
    }
}

pub struct H48Table {
    variant: H48Variant,
    mapping: ReadOnlyMapping,
    headers: [TableHeader; 3],
    validation: Validation,
    main_distribution: Option<[u64; 4]>,
}

impl H48Table {
    /// Normal solving must use Full. Headers is explicit and diagnostic only.
    pub fn open(path: &Path, variant: H48Variant, validation: Validation) -> Result<Self, String> {
        let mut file = File::open(path).map_err(|e| format!("H48 open: {e}"))?;
        let metadata = file.metadata().map_err(|e| format!("H48 stat: {e}"))?;
        if !metadata.is_file() || metadata.len() != variant.file_bytes() {
            return Err(format!(
                "H48 h{} requires a regular file of exactly {} bytes",
                variant.h(),
                variant.file_bytes()
            ));
        }
        let expected = expected_headers(variant);
        let mut headers = Vec::with_capacity(3);
        for (part, offset) in [0, MAIN_HEADER_OFFSET, variant.eoesep_header_offset()]
            .into_iter()
            .enumerate()
        {
            let mut bytes = [0u8; HEADER_BYTES];
            file.seek(SeekFrom::Start(offset))
                .map_err(|e| format!("H48 header seek: {e}"))?;
            file.read_exact(&mut bytes)
                .map_err(|e| format!("H48 header read: {e}"))?;
            let header = TableHeader::parse(&bytes)?;
            check_header(&header, &expected[part], part)?;
            headers.push(header);
        }
        let mapping = ReadOnlyMapping::new(file, variant.file_bytes())?;
        let mut table = Self {
            variant,
            mapping,
            headers: headers.try_into().unwrap(),
            validation,
            main_distribution: None,
        };
        table.check_auxiliary()?;
        if validation == Validation::Full {
            let counts = scan_main(table.main_bytes(), variant.main_entries(), variant.base())?;
            if &counts != variant.distribution() {
                return Err(format!("H48 main-table distribution mismatch: {counts:?}"));
            }
            table.main_distribution = Some(counts);
        }
        Ok(table)
    }

    pub fn load(path: &Path, variant: H48Variant) -> Result<Self, String> {
        Self::open(path, variant, Validation::Full)
    }

    pub fn variant(&self) -> H48Variant {
        self.variant
    }
    pub fn headers(&self) -> &[TableHeader; 3] {
        &self.headers
    }
    pub fn validation(&self) -> Validation {
        self.validation
    }
    pub fn byte_len(&self) -> u64 {
        self.variant.file_bytes()
    }
    pub fn base(&self) -> u8 {
        self.variant.base()
    }
    pub fn max_bound(&self) -> u8 {
        self.variant.max_bound()
    }
    pub fn main_distribution(&self) -> Option<&[u64; 4]> {
        self.main_distribution.as_ref()
    }

    /// Issue the main-table request while the search prepares other contexts.
    /// This hint changes neither the coordinate nor the decoded bound. The
    /// complete line is in the live read-only mapping; no write is performed.
    #[inline(always)]
    pub fn prefetch_main(&self, index: u64) {
        let offset = main_line_offset(self.variant, index);
        #[cfg(all(feature = "h10-prefetch", target_arch = "aarch64"))]
        {
            let address = self.mapping.bytes().as_ptr().wrapping_add(offset as usize);
            // AArch64 cache hint, equivalent in intent to the original C
            // non-temporal read prefetch. It has no solver/FFI dependency.
            unsafe {
                std::arch::asm!("prfm pldl1strm, [{address}]", address = in(reg) address,
                    options(readonly, nostack, preserves_flags));
            }
        }
        #[cfg(not(all(feature = "h10-prefetch", target_arch = "aarch64")))]
        let _ = offset;
    }

    /// Invalid seven-bit corner masks have the original 0xffffffff sentinel.
    /// Callers must use a legal-state raw coordinate, not decode that sentinel.
    #[inline(always)]
    pub fn cocsep_entry(&self, raw: u32) -> u32 {
        assert!((raw as usize) < COCSEP_ENTRIES, "COCSEP index out of range");
        self.u32_at(COCSEP_OFFSET as usize + raw as usize * 4)
    }

    #[inline(always)]
    pub fn esep_entry(&self, raw: u32) -> u32 {
        assert!((raw as usize) < ESEP_ENTRIES, "ESEP index out of range");
        self.u32_at(self.variant.esep_offset() as usize + raw as usize * 4)
    }

    #[inline(always)]
    pub fn eoesep_bound(&self, index: u32) -> u8 {
        assert!(
            (index as usize) < EOESEP_ENTRIES,
            "EOESEP index out of range"
        );
        let byte = self.mapping.bytes()[self.variant.eoesep_offset() as usize + index as usize / 2];
        (byte >> ((index & 1) * 4)) & 15
    }

    #[inline(always)]
    pub fn lookup_main(&self, index: u64) -> MainProbe {
        assert!(
            index < self.variant.main_entries(),
            "H48 main index out of range"
        );
        decode_main(self.main_bytes(), index)
    }

    #[inline(always)]
    fn u32_at(&self, offset: usize) -> u32 {
        u32::from_le_bytes(self.mapping.bytes()[offset..offset + 4].try_into().unwrap())
    }

    #[inline(always)]
    fn main_bytes(&self) -> &[u8] {
        &self.mapping.bytes()[MAIN_OFFSET as usize..self.variant.eoesep_header_offset() as usize]
    }

    fn check_auxiliary(&self) -> Result<(), String> {
        let mut counts = [0u64; 21];
        let mut classes = [false; COCSEP_CLASSES];
        for raw in 0..COCSEP_ENTRIES as u32 {
            let value = self.cocsep_entry(raw);
            if !matches!((raw & 127).count_ones(), 3 | 4) {
                if value != u32::MAX {
                    return Err(format!("H48 COCSEP invalid-mask sentinel differs at {raw}"));
                }
                continue;
            }
            let class = (value >> 16) as usize;
            let symmetry = (value >> 8) & 255;
            let bound = (value & 255) as usize;
            if class >= COCSEP_CLASSES || symmetry >= 48 || bound > 9 {
                return Err(format!("H48 COCSEP entry is invalid at {raw}"));
            }
            counts[bound] += 1;
            classes[class] = true;
        }
        if counts != EXPECTED_COCSEP || classes.contains(&false) {
            return Err("H48 COCSEP distribution or class coverage differs".into());
        }
        let mut classes = [false; ESEP_CLASSES];
        for raw in 0..ESEP_ENTRIES as u32 {
            let value = self.esep_entry(raw);
            let class = (value >> 16) as usize;
            if class >= ESEP_CLASSES || ((value >> 8) & 255) >= 48 || value & 255 != 0 {
                return Err(format!("H48 ESEP entry is invalid at {raw}"));
            }
            classes[class] = true;
        }
        if classes.contains(&false) {
            return Err("H48 ESEP class coverage differs".into());
        }
        counts.fill(0);
        for index in 0..EOESEP_ENTRIES as u32 {
            let bound = self.eoesep_bound(index) as usize;
            if bound > 11 {
                return Err(format!("H48 EOESEP bound is invalid at {index}"));
            }
            counts[bound] += 1;
        }
        if counts != EXPECTED_EOESEP {
            return Err("H48 EOESEP distribution differs".into());
        }
        Ok(())
    }
}

#[inline(always)]
fn main_line_offset(variant: H48Variant, index: u64) -> u64 {
    assert!(
        index < variant.main_entries(),
        "H48 prefetch index out of range"
    );
    MAIN_OFFSET + (index / LINE_ENTRIES) * LINE_BYTES as u64
}

#[inline(always)]
fn decode_main(bytes: &[u8], index: u64) -> MainProbe {
    let line = index / LINE_ENTRIES;
    let extended = index + 2 * line;
    let byte = bytes[(extended / 4) as usize];
    MainProbe {
        code: (byte >> ((extended & 3) * 2)) & 3,
        line_min: bytes[(line as usize + 1) * LINE_BYTES - 1] >> 4,
    }
}

#[inline(always)]
fn count_word(word: u64, mask: u64, slots: u64, counts: &mut [u64; 4]) {
    let low = word & mask;
    let high = (word >> 1) & mask;
    let ones = low.count_ones() as u64;
    let twos = high.count_ones() as u64;
    let both = (low & high).count_ones() as u64;
    counts[0] += (slots - ones) - (twos - both);
    counts[1] += ones - both;
    counts[2] += twos - both;
    counts[3] += both;
}

fn scan_main(bytes: &[u8], entries: u64, base: u8) -> Result<[u64; 4], String> {
    let lines = entries.div_ceil(LINE_ENTRIES);
    if entries == 0 || bytes.len() as u64 != lines * LINE_BYTES as u64 {
        return Err("H48 main data has the wrong number of cache lines".into());
    }
    let mut counts = [0u64; 4];
    for line in bytes.chunks_exact(LINE_BYTES) {
        let zeros_before = counts[0];
        for word in line[..56].chunks_exact(8) {
            count_word(
                u64::from_le_bytes(word.try_into().unwrap()),
                0x5555_5555_5555_5555,
                32,
                &mut counts,
            );
        }
        // The upper nibble of byte 63 is metadata, not two pruning values.
        count_word(
            u64::from_le_bytes(line[56..64].try_into().unwrap()),
            0x0555_5555_5555_5555,
            30,
            &mut counts,
        );
        if counts[0] != zeros_before && line[63] >> 4 > base {
            return Err("H48 zero-code cache line has an invalid fallback minimum".into());
        }
    }
    // C counts every 254-slot line, then subtracts the unused tail from code 3.
    // Verify those unused slots really are the generator's 3 sentinel first.
    let padding = lines * LINE_ENTRIES - entries;
    for index in entries..entries + padding {
        if decode_main(bytes, index).code != 3 {
            return Err("H48 unused final-line slots are not code 3".into());
        }
    }
    counts[3] = counts[3]
        .checked_sub(padding)
        .ok_or("H48 invalid final-line distribution")?;
    Ok(counts)
}

struct ReadOnlyMapping {
    pointer: NonNull<u8>,
    len: usize,
    // Keep the descriptor alive; no writable view of the mapping is exposed.
    _file: File,
}

// SAFETY: PROT_READ mapping, no mutable view is exposed. Scoped workers only
// borrow it; Drop cannot unmap until all borrows have ended. As for any mmap,
// callers must keep the underlying immutable table file unchanged while open.
unsafe impl Sync for ReadOnlyMapping {}

#[cfg(all(
    any(target_os = "macos", target_os = "linux"),
    target_pointer_width = "64"
))]
extern "C" {
    fn mmap(
        address: *mut c_void,
        length: usize,
        protection: i32,
        flags: i32,
        fd: i32,
        offset: i64,
    ) -> *mut c_void;
    fn munmap(address: *mut c_void, length: usize) -> i32;
}

impl ReadOnlyMapping {
    #[cfg(all(
        any(target_os = "macos", target_os = "linux"),
        target_pointer_width = "64"
    ))]
    fn new(file: File, bytes: u64) -> Result<Self, String> {
        use std::os::fd::AsRawFd;
        let len = usize::try_from(bytes).map_err(|_| "H48 requires a 64-bit address space")?;
        if len == 0 || len > isize::MAX as usize {
            return Err("H48 mapping length is invalid".into());
        }
        // POSIX platform FFI only: PROT_READ=1, MAP_PRIVATE=2 on macOS/Linux.
        // No C solver, C coordinate routine, or writable mmap is called.
        let raw = unsafe { mmap(std::ptr::null_mut(), len, 1, 2, file.as_raw_fd(), 0) };
        if raw as isize == -1 {
            return Err(format!("H48 mmap: {}", std::io::Error::last_os_error()));
        }
        let Some(pointer) = NonNull::new(raw.cast::<u8>()) else {
            // A null mapping cannot back a Rust slice, even if the OS accepts it.
            unsafe {
                munmap(raw, len);
            }
            return Err("H48 mmap returned a null address".into());
        };
        Ok(Self {
            pointer,
            len,
            _file: file,
        })
    }

    #[cfg(not(all(
        any(target_os = "macos", target_os = "linux"),
        target_pointer_width = "64"
    )))]
    fn new(_file: File, _bytes: u64) -> Result<Self, String> {
        Err("H48 read-only mmap currently supports 64-bit macOS/Linux only".into())
    }

    #[inline(always)]
    fn bytes(&self) -> &[u8] {
        // The OS supplied this readable, non-null mapping of exactly len bytes;
        // len <= isize::MAX, and Drop cannot run while this borrow is alive.
        unsafe { std::slice::from_raw_parts(self.pointer.as_ptr(), self.len) }
    }
}

impl Drop for ReadOnlyMapping {
    fn drop(&mut self) {
        #[cfg(all(
            any(target_os = "macos", target_os = "linux"),
            target_pointer_width = "64"
        ))]
        unsafe {
            munmap(self.pointer.as_ptr().cast::<c_void>(), self.len);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encode_header(h: &TableHeader) -> [u8; HEADER_BYTES] {
        let mut bytes = [0u8; HEADER_BYTES];
        for (i, value) in h.distribution.iter().enumerate() {
            bytes[i * 8..i * 8 + 8].copy_from_slice(&value.to_le_bytes());
        }
        for (offset, value) in [
            (168, h.table_type),
            (176, h.info_size),
            (184, h.full_size),
            (192, h.hash),
            (200, h.entries),
            (208, h.classes),
            (216, h.next),
        ] {
            bytes[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
        }
        bytes[224..224 + h.solver.len()].copy_from_slice(h.solver.as_bytes());
        bytes[324..328].copy_from_slice(&[h.h, h.bits, h.base, h.max_value]);
        bytes
    }

    #[test]
    fn exact_headers_reject_wrong_variant_chain_and_distribution() {
        for variant in H48Variant::ALL {
            for (part, expected) in expected_headers(variant).iter().enumerate() {
                let bytes = encode_header(expected);
                assert_eq!(TableHeader::parse(&bytes).unwrap(), *expected);
                for offset in [
                    168, 176, 184, 192, 200, 208, 216, 224, 324, 325, 326, 327, 0,
                ] {
                    let mut changed = bytes;
                    changed[offset] ^= 1;
                    assert!(TableHeader::parse(&changed)
                        .and_then(|h| check_header(&h, expected, part))
                        .is_err());
                }
            }
            let main = expected_headers(variant)[1].clone();
            assert_eq!(main.solver, format!("h48 solver h ={:2}", variant.h()));
            assert_eq!(main.entries, variant.main_header_entries());
            assert_eq!(main.distribution[..4], *variant.distribution());
            for other in H48Variant::ALL {
                assert_eq!(
                    check_header(&main, &expected_headers(other)[1], 1).is_ok(),
                    variant == other
                );
            }
        }
        assert!(TableHeader::parse(&[0; 511]).is_err());
        let mut bytes = encode_header(&expected_headers(H48Variant::H10)[0]);
        bytes[323] = 1;
        assert!(TableHeader::parse(&bytes).is_err());
    }

    #[test]
    fn metadata_is_after_254_slots_and_fallback_is_state_dependent() {
        let mut bytes = [0u8; 128];
        bytes[63] = 0xa9;
        bytes[64] = 3;
        bytes[127] = 0x50;
        assert_eq!(
            decode_main(&bytes, 252),
            MainProbe {
                code: 1,
                line_min: 10
            }
        );
        assert_eq!(
            decode_main(&bytes, 253),
            MainProbe {
                code: 2,
                line_min: 10
            }
        );
        assert_eq!(
            decode_main(&bytes, 254),
            MainProbe {
                code: 3,
                line_min: 5
            }
        );
        let fallback = decode_main(&bytes, 255);
        for variant in H48Variant::ALL {
            assert_eq!(fallback.nonzero_bound(variant), None);
            assert_eq!(fallback.with_fallback(variant, 7), 7);
            assert_eq!(fallback.with_fallback(variant, 2), 5);
            // Even h0's zero bucket may use the full 11-bit EO auxiliary bound.
            assert_eq!(fallback.with_fallback(variant, 11), 11);
            for code in 1..=3 {
                let value = MainProbe { code, line_min: 15 };
                assert_eq!(value.nonzero_bound(variant), Some(variant.base() + code));
                assert_eq!(value.with_fallback(variant, 0), variant.base() + code);
            }
        }
    }

    #[test]
    fn distribution_excludes_metadata_and_checks_unused_tail() {
        let mut bytes = [255u8; 128];
        bytes[0] = (bytes[0] & !3) | 1;
        bytes[63] = (bytes[63] & !12) | 8;
        bytes[64] &= !3;
        bytes[127] &= 15;
        assert_eq!(scan_main(&bytes, 255, 10).unwrap(), [1, 1, 1, 252]);
        let mut corrupt = bytes;
        corrupt[64] &= !12; // First unused entry, not a logical coordinate.
        assert!(scan_main(&corrupt, 255, 10).is_err());
        bytes[127] |= 11 << 4;
        assert!(scan_main(&bytes, 255, 10).is_err());
    }

    #[test]
    fn single_complete_line_has_no_tail_to_subtract() {
        assert_eq!(scan_main(&[255; 64], 254, 10).unwrap(), [0, 0, 0, 254]);
        assert!(scan_main(&[255; 64], 255, 10).is_err());
        assert!(scan_main(&[], 0, 10).is_err());
    }

    #[test]
    fn h10_layout_reaches_exact_eof_without_u32_truncation() {
        use crate::h10_table::{
            EOESEP_HEADER_OFFSET, EOESEP_OFFSET, ESEP_OFFSET, H10_FILE_BYTES, MAIN_BYTES,
            MAIN_ENTRIES,
        };
        assert_eq!(
            COCSEP_OFFSET + COCSEP_ENTRIES as u64 * 4,
            MAIN_HEADER_OFFSET
        );
        assert_eq!(MAIN_OFFSET + MAIN_BYTES, EOESEP_HEADER_OFFSET);
        assert_eq!(ESEP_OFFSET + ESEP_ENTRIES as u64 * 4, EOESEP_OFFSET);
        assert_eq!(EOESEP_OFFSET + EOESEP_ENTRIES as u64 / 2, H10_FILE_BYTES);
        assert_eq!(
            expected_headers(H48Variant::H10)[1].entries,
            121_337_014_224
        );
        assert_eq!(MAIN_BYTES / 64 * 254 - MAIN_ENTRIES, 48);
        assert_eq!(
            H48Variant::H10.distribution().iter().sum::<u64>(),
            MAIN_ENTRIES
        );
    }

    #[test]
    fn every_variant_tail_and_prefetch_boundary_use_only_small_fixtures() {
        // A single final line exercises each real padding count. No table
        // file, mmap, sparse allocation, or variant-sized buffer is involved.
        for variant in H48Variant::ALL {
            let used = 254 - variant.padding_entries();
            let mut line = [255u8; 64];
            line[0] &= !3;
            line[63] = (line[63] & 15) | (variant.base() << 4);
            assert_eq!(
                scan_main(&line, used, variant.base()).unwrap(),
                [1, 0, 0, used - 1]
            );
            let mut bad_minimum = line;
            bad_minimum[63] += 16;
            assert!(scan_main(&bad_minimum, used, variant.base()).is_err());
            line[used as usize / 4] &= !(3 << (2 * (used % 4)));
            assert!(scan_main(&line, used, variant.base()).is_err());
            assert_eq!(main_line_offset(variant, 0), MAIN_OFFSET);
            assert_eq!(main_line_offset(variant, 253), MAIN_OFFSET);
            assert_eq!(main_line_offset(variant, 254), MAIN_OFFSET + 64);
            assert_eq!(
                main_line_offset(variant, variant.main_entries() - 1) + 64,
                variant.eoesep_header_offset()
            );
            assert!(
                std::panic::catch_unwind(|| main_line_offset(variant, variant.main_entries()))
                    .is_err()
            );
        }
    }
}
