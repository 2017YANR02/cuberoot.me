// SPDX-License-Identifier: GPL-3.0-or-later
//! Source-compatible H10 facade over the shared Nissy H48 table backend.

use crate::{h48_table::H48Table, h48_variant::H48Variant};
use std::{ops::Deref, path::Path};

pub use crate::h48_table::{
    TableHeader, Validation, COCSEP_ENTRIES, COCSEP_OFFSET, EOESEP_ENTRIES, ESEP_ENTRIES,
    HEADER_BYTES, MAIN_HEADER_OFFSET, MAIN_OFFSET,
};
pub const H10_FILE_BYTES: u64 = H48Variant::H10.file_bytes();
pub const H10_BASE: u8 = H48Variant::H10.base();
pub const H10_MAX_BOUND: u8 = H48Variant::H10.max_bound();
pub const MAIN_ENTRIES: u64 = H48Variant::H10.main_entries();
pub const MAIN_BYTES: u64 = H48Variant::H10.main_bytes();
pub const EOESEP_HEADER_OFFSET: u64 = H48Variant::H10.eoesep_header_offset();
pub const ESEP_OFFSET: u64 = H48Variant::H10.esep_offset();
pub const EOESEP_OFFSET: u64 = H48Variant::H10.eoesep_offset();

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct MainProbe {
    pub code: u8,
    pub line_min: u8,
}

impl MainProbe {
    #[inline(always)]
    pub fn nonzero_bound(self) -> Option<u8> {
        crate::h48_table::MainProbe {
            code: self.code,
            line_min: self.line_min,
        }
        .nonzero_bound(H48Variant::H10)
    }
    #[inline(always)]
    pub fn with_fallback(self, eoesep_bound: u8) -> u8 {
        crate::h48_table::MainProbe {
            code: self.code,
            line_min: self.line_min,
        }
        .with_fallback(H48Variant::H10, eoesep_bound)
    }
}

pub struct H10Table(H48Table);

impl H10Table {
    pub fn open(path: &Path, validation: Validation) -> Result<Self, String> {
        H48Table::open(path, H48Variant::H10, validation).map(Self)
    }
    pub fn load(path: &Path) -> Result<Self, String> {
        Self::open(path, Validation::Full)
    }
    pub fn headers(&self) -> &[TableHeader; 3] {
        self.0.headers()
    }
    pub fn validation(&self) -> Validation {
        self.0.validation()
    }
    pub fn byte_len(&self) -> u64 {
        self.0.byte_len()
    }
    pub fn base(&self) -> u8 {
        self.0.base()
    }
    pub fn max_bound(&self) -> u8 {
        self.0.max_bound()
    }
    pub fn main_distribution(&self) -> Option<&[u64; 4]> {
        self.0.main_distribution()
    }
    #[inline(always)]
    pub fn prefetch_main(&self, index: u64) {
        self.0.prefetch_main(index)
    }
    #[inline(always)]
    pub fn cocsep_entry(&self, raw: u32) -> u32 {
        self.0.cocsep_entry(raw)
    }
    #[inline(always)]
    pub fn esep_entry(&self, raw: u32) -> u32 {
        self.0.esep_entry(raw)
    }
    #[inline(always)]
    pub fn eoesep_bound(&self, index: u32) -> u8 {
        self.0.eoesep_bound(index)
    }
    #[inline(always)]
    pub fn lookup_main(&self, index: u64) -> MainProbe {
        let probe = self.0.lookup_main(index);
        MainProbe {
            code: probe.code,
            line_min: probe.line_min,
        }
    }
}

impl Deref for H10Table {
    type Target = H48Table;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl From<H10Table> for H48Table {
    fn from(table: H10Table) -> Self {
        table.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn historical_h10_constants_and_probe_api_remain_identical() {
        assert_eq!(H10_FILE_BYTES, 30_336_314_216);
        assert_eq!(MAIN_ENTRIES, 120_389_068_800);
        assert_eq!(EOESEP_OFFSET, 30_335_513_448);
        assert_eq!(
            MainProbe {
                code: 3,
                line_min: 2
            }
            .nonzero_bound(),
            Some(13)
        );
        assert_eq!(
            MainProbe {
                code: 0,
                line_min: 5
            }
            .with_fallback(7),
            7
        );
    }
}
