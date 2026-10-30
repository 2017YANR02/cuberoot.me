//! Compatibility names for the unchanged Opt10 on-disk format.
pub use crate::eo_table::{sha256, DEFAULT_BASE, HEADER_BYTES};
pub type Opt10Header = crate::eo_table::EoHeader<10>;
pub type AtomicOpt10Table = crate::eo_table::AtomicEoTable<10>;
pub type Opt10Table = crate::eo_table::EoTable<10>;
pub const FILE_BYTES: u64 = crate::eo_table::EoLayout::<10>::FILE_BYTES;
#[inline(always)]
pub fn valid_index(index: u64) -> bool { crate::eo_table::EoLayout::<10>::valid_index(index) }
