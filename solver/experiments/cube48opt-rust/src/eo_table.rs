//! Shared CubeRoot EO10 / EO11 table storage. This is not an upstream cube48opt table.
//!
//! Each 64-coordinate block has 62 two-bit cells and a four-bit shared
//! minimum in its first two cells. Coordinate 511 of every 512 is padding.
//! Code zero uses the shared minimum; codes 1..3 mean base + code. Generation
//! starts at the saturated bound base + 3 and monotonically reduces cells.
//! Publishing requires an exhaustive search through base + 2: before then,
//! untouched cells do not yet constitute an admissible pruning bound.

use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU32, Ordering},
};

pub const HEADER_BYTES: usize = 1024;
pub const DEFAULT_BASE: u8 = 10;
/// Both variants share the packing, but never accept each other's files.
pub struct EoLayout<const EO: u8>;
impl<const EO: u8> EoLayout<EO> {
    pub const COORDINATES: u64 = (crate::coord::COORDINATE_COUNT as u64) << EO;
    pub const TABLE_BYTES: u64 = Self::COORDINATES / 4;
    pub const VALID_ENTRIES: u64 = 3393 * 70 * 495 * (1u64 << EO);
    pub const FILE_BYTES: u64 = Self::TABLE_BYTES + HEADER_BYTES as u64;
    const MAGIC: &'static [u8; 16] = match EO {
        10 => b"CBRT-OPT10-PDB\0\0",
        11 => b"CBRT-OPT11-PDB\0\0",
        _ => panic!("only EO10 and EO11 layouts are defined"),
    };
    #[inline(always)]
    pub fn valid_index(index: u64) -> bool {
        matches!(EO, 10 | 11) && index < Self::COORDINATES && index & 63 >= 2 && index & 511 != 511
    }
}
const VERSION: u32 = 1;
const LAYOUT: u32 = 1;
const HASH_OFFSET: usize = HEADER_BYTES - 32;
const CHUNK_BYTES: usize = 1024 * 1024;
const WRITE_SYNC_BYTES: usize = 64 * CHUNK_BYTES;
const CHECKPOINT_MAGIC: &[u8; 16] = b"CBRT-EO-CKPT\0\0\0\0";
const MAX_CHECKPOINT_STATE: u64 = 64 + (1 << 26) * 8;

fn check_base(base: u8) -> Result<(), String> {
    if base != DEFAULT_BASE {
        Err("EO table format v1 requires base 10 and saturated bound 13".into())
    } else {
        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EoHeader<const EO: u8> {
    pub base: u8,
    pub max_bound: u8,
    /// Every state through this depth must have been enumerated by the
    /// generator. A digest detects corruption, not mathematical correctness.
    pub completed_depth: u8,
    pub snapshot_sha256: [u8; 32],
    pub payload_sha256: [u8; 32],
    pub distribution: [u64; 16],
}

impl<const EO: u8> EoHeader<EO> {
    fn encode(&self) -> [u8; HEADER_BYTES] {
        let mut bytes = [0u8; HEADER_BYTES];
        bytes[..16].copy_from_slice(EoLayout::<EO>::MAGIC);
        put_u32(&mut bytes, 16, VERSION);
        put_u32(&mut bytes, 20, HEADER_BYTES as u32);
        put_u32(&mut bytes, 24, u32::from(EO));
        put_u32(&mut bytes, 28, LAYOUT);
        put_u64(&mut bytes, 32, EoLayout::<EO>::COORDINATES);
        put_u64(&mut bytes, 40, EoLayout::<EO>::VALID_ENTRIES);
        put_u64(&mut bytes, 48, EoLayout::<EO>::TABLE_BYTES);
        bytes[56] = self.base;
        bytes[57] = self.max_bound;
        bytes[58] = self.completed_depth;
        bytes[59] = 1; // Finished, exhaustive-depth generation only.
        put_u64(
            &mut bytes,
            64,
            crate::coord::snapshot_bytes(9).unwrap() as u64,
        );
        bytes[72..104].copy_from_slice(&self.snapshot_sha256);
        bytes[104..136].copy_from_slice(&self.payload_sha256);
        for (i, count) in self.distribution.iter().enumerate() {
            put_u64(&mut bytes, 160 + i * 8, *count);
        }
        let digest = sha256(&bytes[..HASH_OFFSET]);
        bytes[HASH_OFFSET..].copy_from_slice(&digest);
        bytes
    }

    pub fn decode(bytes: &[u8; HEADER_BYTES]) -> Result<Self, String> {
        if &bytes[..16] != EoLayout::<EO>::MAGIC
            || get_u32(bytes, 16) != VERSION
            || get_u32(bytes, 20) != HEADER_BYTES as u32
            || get_u32(bytes, 24) != u32::from(EO)
            || get_u32(bytes, 28) != LAYOUT
            || get_u64(bytes, 32) != EoLayout::<EO>::COORDINATES
            || get_u64(bytes, 40) != EoLayout::<EO>::VALID_ENTRIES
            || get_u64(bytes, 48) != EoLayout::<EO>::TABLE_BYTES
            || get_u64(bytes, 64) != crate::coord::snapshot_bytes(9)? as u64
        {
            return Err(
                format!("not a supported CubeRoot Opt{EO} table; other variants/H48 files cannot be substituted"),
            );
        }
        if bytes[60..64]
            .iter()
            .chain(bytes[136..160].iter())
            .chain(bytes[288..HASH_OFFSET].iter())
            .any(|&b| b != 0)
            || sha256(&bytes[..HASH_OFFSET]).as_slice() != &bytes[HASH_OFFSET..]
        {
            return Err(format!("Opt{EO} header integrity or reserved fields differ"));
        }
        let base = bytes[56];
        check_base(base)?;
        if bytes[57] != base + 3 || bytes[59] != 1 || bytes[58] < base + 2 || bytes[58] > 20 {
            return Err(format!("Opt{EO} table is incomplete or has inconsistent depth coverage"));
        }
        let mut distribution = [0u64; 16];
        for (i, count) in distribution.iter_mut().enumerate() {
            *count = get_u64(bytes, 160 + i * 8);
        }
        if distribution
            .iter()
            .try_fold(0u64, |sum, &n| sum.checked_add(n))
            != Some(EoLayout::<EO>::VALID_ENTRIES)
            || distribution[usize::from(base + 4)..]
                .iter()
                .any(|&n| n != 0)
        {
            return Err(format!("Opt{EO} header has invalid valid-cell coverage"));
        }
        Ok(Self {
            base,
            max_bound: base + 3,
            completed_depth: bytes[58],
            snapshot_sha256: bytes[72..104].try_into().unwrap(),
            payload_sha256: bytes[104..136].try_into().unwrap(),
            distribution,
        })
    }
}

/// One allocation, updated in place. No mmap-backed writable generation.
/// Do not use the compressed bound as a visited-state or exact-depth map.
pub struct AtomicEoTable<const EO: u8> {
    words: Vec<AtomicU32>,
    base: u8,
}

impl<const EO: u8> AtomicEoTable<EO> {
    pub fn new(base: u8) -> Result<Self, String> {
        Self::allocate(EoLayout::<EO>::COORDINATES, base)
    }

    fn allocate(coordinates: u64, base: u8) -> Result<Self, String> {
        if !matches!(EO, 10 | 11) { return Err("only EO10 and EO11 layouts are defined".into()); }
        check_base(base)?;
        if coordinates == 0 || coordinates % 512 != 0 || coordinates > EoLayout::<EO>::COORDINATES {
            return Err(format!("Opt{EO} allocation must contain complete padded 512-cell slices"));
        }
        let count =
            usize::try_from(coordinates / 16).map_err(|_| "EO table requires a 64-bit host")?;
        let mut words = Vec::new();
        words.try_reserve_exact(count).map_err(|e| e.to_string())?;
        words.extend((0..count).map(|i| {
            AtomicU32::new(if i & 3 == 0 {
                0xffff_fff0 | u32::from(base)
            } else {
                u32::MAX
            })
        }));
        Ok(Self { words, base })
    }

    pub fn base(&self) -> u8 {
        self.base
    }
    pub fn byte_len(&self) -> u64 {
        self.words.len() as u64 * 4
    }
    pub fn cells(&self) -> u64 {
        self.words.len() as u64 * 16
    }

    /// Miniature, padded storage for the generator's unit tests. The writer
    /// still rejects it, so fixtures cannot masquerade as completed PDBs.
    #[cfg(test)]
    pub(crate) fn new_for_cells(coordinates: u64, base: u8) -> Result<Self, String> {
        Self::allocate(coordinates, base)
    }

    /// Returns whether the packed representation was reduced; this is not a
    /// first-visit flag. Callers must join all producers before publishing.
    pub fn record_min(&self, index: u64, depth: u8) -> Result<bool, String> {
        if !EoLayout::<EO>::valid_index(index) || index / 16 >= self.words.len() as u64 {
            return Err(format!("Opt{EO} update index is padding or outside this table"));
        }
        let word_index = (index / 16) as usize;
        let code = depth.saturating_sub(self.base).min(3);
        let mut changed = false;
        if code == 0 {
            changed = self.words[word_index & !3]
                .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |old| {
                    (old & 15 > u32::from(depth)).then_some((old & !15) | u32::from(depth))
                })
                .is_ok();
        }
        let shift = (index & 15) * 2;
        changed |= self.words[word_index]
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |old| {
                ((old >> shift) & 3 > u32::from(code))
                    .then_some((old & !(3 << shift)) | (u32::from(code) << shift))
            })
            .is_ok();
        Ok(changed)
    }

    #[inline]
    pub fn get(&self, index: u64) -> u8 {
        assert!(EoLayout::<EO>::valid_index(index));
        let word = (index / 16) as usize;
        let code = (self.words[word].load(Ordering::Relaxed) >> ((index & 15) * 2)) & 3;
        if code == 0 {
            (self.words[word & !3].load(Ordering::Relaxed) & 15) as u8
        } else {
            self.base + code as u8
        }
    }

    /// Writes a new native file, fsyncs, then publishes without replacing an
    /// existing table. Failed or interrupted `.partial` files are retained.
    /// The caller must have exhaustively enumerated the claimed depth.
    pub fn write_complete(
        &self,
        path: &Path,
        snapshot: &[u8],
        completed_depth: u8,
    ) -> Result<EoHeader<EO>, String> {
        if self.byte_len() != EoLayout::<EO>::TABLE_BYTES {
            return Err(format!("cannot publish a miniature Opt{EO} table"));
        }
        if snapshot.len() != crate::coord::snapshot_bytes(9)? {
            return Err(format!("Opt{EO} requires the full Opt9 small-table snapshot"));
        }
        if completed_depth < self.base + 2 || completed_depth > 20 {
            return Err(format!("Opt{EO} generation did not complete the required exhaustive depth"));
        }
        let mut output = create_partial(path)?;
        let mut hasher = Sha256::new();
        let mut distribution = [0u64; 16];
        let mut scratch = Vec::with_capacity(CHUNK_BYTES);
        let mut unsynced_bytes = 0;
        let mut fallback = 0u8;
        for (i, atom) in self.words.iter().enumerate() {
            let word = atom.load(Ordering::Relaxed);
            inspect_word(word, i, self.base, &mut fallback, &mut distribution)?;
            scratch.extend_from_slice(&word.to_le_bytes());
            if scratch.len() == CHUNK_BYTES {
                hasher.update(&scratch);
                write_stream_chunk(&mut output, &scratch, &mut unsynced_bytes)?;
                scratch.clear();
            }
        }
        if !scratch.is_empty() {
            hasher.update(&scratch);
            write_stream_chunk(&mut output, &scratch, &mut unsynced_bytes)?;
        }
        if distribution.iter().sum::<u64>() != EoLayout::<EO>::VALID_ENTRIES {
            return Err(format!("Opt{EO} completed payload has wrong valid-cell count"));
        }
        let header = EoHeader::<EO> {
            base: self.base,
            max_bound: self.base + 3,
            completed_depth,
            snapshot_sha256: sha256(snapshot),
            payload_sha256: hasher.finish(),
            distribution,
        };
        use std::io::{Seek, SeekFrom};
        output.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
        output
            .write_all(&header.encode())
            .map_err(|e| e.to_string())?;
        publish_partial(output, path)?;
        Ok(header)
    }

    /// Only call at a generator barrier. The state and table are one hashed,
    /// atomically published file; a checkpoint is never a solvable PDB.
    pub(crate) fn write_checkpoint(&self, path: &Path, snapshot: &[u8], state: &[u8]) -> Result<(), String> {
        if self.byte_len() != EoLayout::<EO>::TABLE_BYTES
            || snapshot.len() != crate::coord::snapshot_bytes(9)?
            || state.len() as u64 > MAX_CHECKPOINT_STATE {
            return Err("invalid EO checkpoint dimensions".into());
        }
        let mut output = create_partial(path)?;
        let mut hash = Sha256::new();
        hash.update(state);
        let mut unsynced = 0;
        for chunk in state.chunks(CHUNK_BYTES) {
            write_stream_chunk(&mut output, chunk, &mut unsynced)?;
        }
        let mut scratch = Vec::with_capacity(CHUNK_BYTES);
        for words in self.words.chunks(CHUNK_BYTES / 4) {
            scratch.clear();
            for word in words { scratch.extend_from_slice(&word.load(Ordering::Relaxed).to_le_bytes()); }
            hash.update(&scratch);
            write_stream_chunk(&mut output, &scratch, &mut unsynced)?;
        }
        let mut header = [0u8; HEADER_BYTES];
        header[..16].copy_from_slice(CHECKPOINT_MAGIC);
        put_u32(&mut header, 16, 1);
        put_u32(&mut header, 20, u32::from(EO));
        put_u64(&mut header, 24, self.byte_len());
        header[32] = self.base;
        header[40..72].copy_from_slice(&sha256(snapshot));
        put_u64(&mut header, 72, state.len() as u64);
        header[80..112].copy_from_slice(&hash.finish());
        let digest = sha256(&header[..HASH_OFFSET]);
        header[HASH_OFFSET..].copy_from_slice(&digest);
        use std::io::{Seek, SeekFrom};
        output.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
        output.write_all(&header).map_err(|e| e.to_string())?;
        publish_partial(output, path)
    }

    pub(crate) fn load_checkpoint(path: &Path, snapshot: &[u8]) -> Result<(Self, Vec<u8>), String> {
        if path.extension().is_some_and(|ext| ext == "partial") {
            return Err("cannot resume an uncommitted checkpoint".into());
        }
        let mut input = File::open(path).map_err(|e| e.to_string())?;
        configure_streaming_io(&input)?;
        let mut header = [0u8; HEADER_BYTES];
        input.read_exact(&mut header).map_err(|e| e.to_string())?;
        let state_len = get_u64(&header, 72);
        if &header[..16] != CHECKPOINT_MAGIC || get_u32(&header, 16) != 1
            || get_u32(&header, 20) != u32::from(EO)
            || get_u64(&header, 24) != EoLayout::<EO>::TABLE_BYTES
            || header[32] != DEFAULT_BASE || state_len > MAX_CHECKPOINT_STATE
            || snapshot.len() != crate::coord::snapshot_bytes(9)?
            || header[40..72] != sha256(snapshot)
            || header[33..40].iter().chain(header[112..HASH_OFFSET].iter()).any(|&v| v != 0)
            || header[HASH_OFFSET..] != sha256(&header[..HASH_OFFSET])
            || input.metadata().map_err(|e| e.to_string())?.len() != EoLayout::<EO>::FILE_BYTES + state_len {
            return Err("EO checkpoint format, snapshot or size differs".into());
        }
        let mut state = vec![0; state_len as usize];
        input.read_exact(&mut state).map_err(|e| e.to_string())?;
        let mut hash = Sha256::new();
        hash.update(&state);
        let table = Self::new(DEFAULT_BASE)?;
        let mut scratch = vec![0u8; CHUNK_BYTES];
        let mut fallback = 0;
        let mut counts = [0; 16];
        let mut offset = 0;
        for words in table.words.chunks(CHUNK_BYTES / 4) {
            let bytes = &mut scratch[..words.len() * 4];
            input.read_exact(bytes).map_err(|e| e.to_string())?;
            hash.update(bytes);
            for (word, bytes) in words.iter().zip(bytes.chunks_exact(4)) {
                let value = u32::from_le_bytes(bytes.try_into().unwrap());
                inspect_word(value, offset, DEFAULT_BASE, &mut fallback, &mut counts)?;
                word.store(value, Ordering::Relaxed);
                offset += 1;
            }
        }
        if input.read(&mut [0u8; 1]).map_err(|e| e.to_string())? != 0
            || input.metadata().map_err(|e| e.to_string())?.len() != EoLayout::<EO>::FILE_BYTES + state_len
            || header[80..112] != hash.finish() {
            return Err("EO checkpoint integrity differs; refusing to resume".into());
        }
        Ok((table, state))
    }
}

pub struct EoTable<const EO: u8> {
    words: Vec<u32>,
    header: EoHeader<EO>,
}

impl<const EO: u8> EoTable<EO> {
    /// Full integrity verification is mandatory. One native-word allocation
    /// is read directly and checked without a second whole-table byte buffer.
    pub fn load(path: &Path, snapshot: &[u8]) -> Result<Self, String> {
        if path.extension().is_some_and(|ext| ext == "partial") {
            return Err(format!("an unpublished Opt{EO} .partial file cannot be loaded"));
        }
        let mut input = File::open(path).map_err(|e| e.to_string())?;
        configure_streaming_io(&input)?;
        if input.metadata().map_err(|e| e.to_string())?.len() != EoLayout::<EO>::FILE_BYTES {
            return Err(format!(
                "EO{EO} native file must be exactly {} bytes", EoLayout::<EO>::FILE_BYTES
            ));
        }
        let mut raw_header = [0u8; HEADER_BYTES];
        input
            .read_exact(&mut raw_header)
            .map_err(|e| e.to_string())?;
        let header = EoHeader::<EO>::decode(&raw_header)?;
        if snapshot.len() != crate::coord::snapshot_bytes(9)?
            || header.snapshot_sha256 != sha256(snapshot)
        {
            return Err(format!("Opt{EO} small-table snapshot differs from the generating snapshot"));
        }
        let count = usize::try_from(EoLayout::<EO>::TABLE_BYTES / 4).map_err(|_| "EO table requires a 64-bit host")?;
        let mut words = Vec::new();
        words.try_reserve_exact(count).map_err(|e| e.to_string())?;
        words.resize(count, 0u32);
        let mut hasher = Sha256::new();
        let mut distribution = [0u64; 16];
        let mut fallback = 0u8;
        let mut offset = 0usize;
        for chunk in words.chunks_mut(CHUNK_BYTES / 4) {
            // u32 accepts every bit pattern; the byte view exactly spans this
            // initialized exclusive chunk. Never alias it with live u32 refs.
            let bytes = unsafe {
                std::slice::from_raw_parts_mut(chunk.as_mut_ptr().cast::<u8>(), chunk.len() * 4)
            };
            input.read_exact(bytes).map_err(|e| e.to_string())?;
            hasher.update(bytes);
            for word in chunk.iter_mut() {
                *word = u32::from_le(*word);
                inspect_word(*word, offset, header.base, &mut fallback, &mut distribution)?;
                offset += 1;
            }
        }
        if input.read(&mut [0u8; 1]).map_err(|e| e.to_string())? != 0
            || input.metadata().map_err(|e| e.to_string())?.len() != EoLayout::<EO>::FILE_BYTES
            || hasher.finish() != header.payload_sha256
            || distribution != header.distribution
        {
            return Err(
                format!("Opt{EO} payload integrity/distribution differs or file changed during load"),
            );
        }
        Ok(Self { words, header })
    }

    #[inline(always)]
    pub fn get(&self, index: u64) -> u8 {
        assert!(EoLayout::<EO>::valid_index(index));
        let word = (index / 16) as usize;
        let code = (self.words[word] >> ((index & 15) * 2)) & 3;
        if code == 0 {
            (self.words[word & !3] & 15) as u8
        } else {
            self.header.base + code as u8
        }
    }

    /// Keep the entire read pass separate under LTO, so a cell's decoding and
    /// fallback cannot delay issuing later independent reads. None slots never
    /// read memory. Every real coordinate retains the scalar decoder's checks.
    #[cfg(all(feature = "opt10-native-batch", not(target_family = "wasm")))]
    #[inline(never)]
    fn load_probe_words(&self, queries: &[Option<u64>; 8]) -> [u32; 8] {
        std::array::from_fn(|i| queries[i].map_or(0, |index| {
            assert!(EoLayout::<EO>::valid_index(index));
            self.words[(index >> 4) as usize]
        }))
    }

    #[cfg(all(feature = "opt10-native-batch", not(target_family = "wasm")))]
    #[inline(always)]
    pub(crate) fn get_batch(&self, queries: &[Option<u64>; 8]) -> [u8; 8] {
        let loaded = self.load_probe_words(queries);
        std::array::from_fn(|i| {
            let Some(index) = queries[i] else { return 0; };
            let code = (loaded[i] >> ((index & 15) * 2)) & 3;
            if code == 0 { (self.words[((index >> 4) as usize) & !3] & 15) as u8 }
            else { self.header.base + code as u8 }
        })
    }

    /// Begin the immutable read while other contexts prepare their queries.
    /// A hint never replaces get's padding and allocation-boundary checks.
    #[cfg(all(feature = "opt10-native-hotpath", not(target_family = "wasm")))]
    #[inline(always)]
    pub(crate) fn prefetch(&self, index: u64) {
        #[cfg(all(feature = "opt10-native-prefetch-x86", target_arch = "x86_64"))]
        crate::prefetch::read_word(&self.words, index);
        #[cfg(target_arch = "aarch64")]
        if let Some(address) = self.prefetch_word_address(index) {
            // SAFETY: the pointer comes from an in-bounds reference into the
            // live immutable Vec. PRFM is only a read hint, retaining nothing.
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

    #[cfg(all(feature = "opt10-native-hotpath", not(target_family = "wasm"), any(target_arch = "aarch64", test)))]
    #[inline(always)]
    fn prefetch_word_address(&self, index: u64) -> Option<*const u32> {
        let word = usize::try_from(index >> 4).ok()?;
        self.words.get(word).map(|value| value as *const u32)
    }

    pub fn byte_len(&self) -> u64 {
        EoLayout::<EO>::TABLE_BYTES
    }
    pub fn header(&self) -> &EoHeader<EO> {
        &self.header
    }
}

#[cfg(feature = "opt11-lookup")]
impl EoTable<11> {
    /// Borrow the already validated allocation for isolated EO11 read
    /// candidates. The storage stays immutable and owned by this table;
    /// baseline decoders, Opt10 and all loading/checkpoint paths are unchanged.
    #[inline(always)]
    pub(crate) fn immutable_words(&self) -> &[u32] { &self.words }

    /// Bounded, deliberately incomplete storage for decoder unit fixtures.
    /// No file access; this is never a loadable or publishable EO11 table.
    #[cfg(test)]
    pub(crate) fn lookup_fixture(words: Vec<u32>) -> Self {
        assert!(words.len() <= 64, "lookup fixtures are limited to 256 bytes");
        Self {
            words,
            header: EoHeader {
                base: 10,
                max_bound: 13,
                completed_depth: 12,
                snapshot_sha256: [0; 32],
                payload_sha256: [0; 32],
                distribution: [0; 16],
            },
        }
    }
}

/// The in-memory table already occupies tens of GB. On macOS, a bounded userspace
/// buffer alone does not prevent another table-sized file cache during either
/// writing or verification/loading. Set this before any data I/O/allocation;
/// failure must not silently fall back to the original cached path. This is
/// a file-cache policy, not a system-wide no-swap guarantee; the guard remains.
#[cfg(target_os = "macos")]
fn configure_streaming_io(file: &File) -> Result<(), String> {
    use std::os::fd::AsRawFd;
    // Darwin <sys/fcntl.h>: a nonzero argument disables data caching.
    const F_NOCACHE: std::ffi::c_int = 48;
    unsafe extern "C" {
        fn fcntl(fd: std::ffi::c_int, command: std::ffi::c_int, ...) -> std::ffi::c_int;
    }
    // SAFETY: the borrowed File keeps this descriptor valid; F_NOCACHE takes
    // one c_int argument and does not retain any pointer or take ownership.
    if unsafe { fcntl(file.as_raw_fd(), F_NOCACHE, 1 as std::ffi::c_int) } == -1 {
        return Err(format!(
            "EO table requires macOS F_NOCACHE for streamed table I/O: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn configure_streaming_io(_: &File) -> Result<(), String> {
    // Other hosts retain their existing I/O policy; no uncached-I/O claim.
    Ok(())
}

fn create_partial(path: &Path) -> Result<File, String> {
    if path.exists() {
        return Err("refusing to replace an existing EO table".into());
    }
    let partial = partial_path(path);
    let mut output = OpenOptions::new()
        .write(true)
        .read(true)
        .create_new(true)
        .open(&partial)
        .map_err(|e| format!("{}: {e}", partial.display()))?;
    configure_streaming_io(&output)?;
    // A crash before the finalized header is written always fails closed.
    output
        .write_all(&[0u8; HEADER_BYTES])
        .map_err(|e| e.to_string())?;
    Ok(output)
}

fn write_stream_chunk(
    output: &mut File,
    bytes: &[u8],
    unsynced_bytes: &mut usize,
) -> Result<(), String> {
    output.write_all(bytes).map_err(|e| e.to_string())?;
    *unsynced_bytes += bytes.len();
    if *unsynced_bytes >= WRITE_SYNC_BYTES {
        // The 1024-byte header leaves payload writes unaligned. Darwin can
        // therefore use its copy path even with F_NOCACHE; drain pending
        // writes every 64 MiB rather than only after the complete 31 GB file.
        output.sync_data().map_err(|e| e.to_string())?;
        *unsynced_bytes = 0;
    }
    Ok(())
}

fn publish_partial(output: File, path: &Path) -> Result<(), String> {
    output.sync_all().map_err(|e| e.to_string())?;
    drop(output);
    let partial = partial_path(path);
    // A same-directory hard link provides an atomic no-clobber publish;
    // rename() would silently replace a concurrently-created destination.
    fs::hard_link(&partial, path).map_err(|e| e.to_string())?;
    fs::remove_file(&partial).map_err(|e| e.to_string())?;
    if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
        File::open(parent)
            .and_then(|f| f.sync_all())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn inspect_word(
    word: u32,
    index: usize,
    base: u8,
    fallback: &mut u8,
    counts: &mut [u64; 16],
) -> Result<(), String> {
    if index & 3 == 0 {
        *fallback = (word & 15) as u8;
        if *fallback > base {
            return Err("EO block minimum exceeds its base".into());
        }
    }
    if index & 31 == 31 && word >> 30 != 3 {
        return Err("EO final padded cell is not canonical".into());
    }
    let valid = if index & 3 == 0 {
        0x5555_5550
    } else if index & 31 == 31 {
        0x1555_5555
    } else {
        0x5555_5555
    };
    let low = word & valid;
    let high = word >> 1;
    counts[usize::from(base + 3)] += (low & high).count_ones() as u64;
    counts[usize::from(base + 2)] += (valid & !word & high).count_ones() as u64;
    counts[usize::from(base + 1)] += (low & !high).count_ones() as u64;
    counts[usize::from(*fallback)] += (valid & !word & !high).count_ones() as u64;
    Ok(())
}

fn partial_path(path: &Path) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(".partial");
    PathBuf::from(name)
}
fn put_u32(bytes: &mut [u8], at: usize, n: u32) {
    bytes[at..at + 4].copy_from_slice(&n.to_le_bytes());
}
fn put_u64(bytes: &mut [u8], at: usize, n: u64) {
    bytes[at..at + 8].copy_from_slice(&n.to_le_bytes());
}
fn get_u32(bytes: &[u8], at: usize) -> u32 {
    u32::from_le_bytes(bytes[at..at + 4].try_into().unwrap())
}
fn get_u64(bytes: &[u8], at: usize) -> u64 {
    u64::from_le_bytes(bytes[at..at + 8].try_into().unwrap())
}

/// Dependency-free SHA-256, shared by the header, snapshot, and streamed PDB.
pub fn sha256(bytes: &[u8]) -> [u8; 32] {
    let mut hash = Sha256::new();
    hash.update(bytes);
    hash.finish()
}

struct Sha256 {
    state: [u32; 8],
    buffer: [u8; 64],
    buffered: usize,
    bytes: u64,
}
impl Sha256 {
    fn new() -> Self {
        Self {
            state: [
                0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
                0x5be0cd19,
            ],
            buffer: [0; 64],
            buffered: 0,
            bytes: 0,
        }
    }
    fn update(&mut self, mut bytes: &[u8]) {
        self.bytes = self
            .bytes
            .checked_add(bytes.len() as u64)
            .expect("SHA-256 input too long");
        if self.buffered != 0 {
            let n = (64 - self.buffered).min(bytes.len());
            self.buffer[self.buffered..self.buffered + n].copy_from_slice(&bytes[..n]);
            self.buffered += n;
            bytes = &bytes[n..];
            if self.buffered == 64 {
                self.compress(self.buffer);
                self.buffered = 0;
            } else {
                return;
            }
        }
        while bytes.len() >= 64 {
            self.compress(bytes[..64].try_into().unwrap());
            bytes = &bytes[64..];
        }
        self.buffer[..bytes.len()].copy_from_slice(bytes);
        self.buffered = bytes.len();
    }
    fn finish(mut self) -> [u8; 32] {
        let bit_len = self.bytes.checked_mul(8).expect("SHA-256 input too long");
        self.buffer[self.buffered] = 0x80;
        self.buffer[self.buffered + 1..].fill(0);
        if self.buffered >= 56 {
            self.compress(self.buffer);
            self.buffer = [0; 64];
        }
        self.buffer[56..].copy_from_slice(&bit_len.to_be_bytes());
        self.compress(self.buffer);
        let mut digest = [0u8; 32];
        for (i, value) in self.state.into_iter().enumerate() {
            digest[i * 4..i * 4 + 4].copy_from_slice(&value.to_be_bytes());
        }
        digest
    }
    fn compress(&mut self, block: [u8; 64]) {
        const K: [u32; 64] = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
            0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
            0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
            0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
            0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
            0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
            0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
            0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
            0xc67178f2,
        ];
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes(block[i * 4..i * 4 + 4].try_into().unwrap());
        }
        for i in 16..64 {
            let a = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let b = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16]
                .wrapping_add(a)
                .wrapping_add(w[i - 7])
                .wrapping_add(b);
        }
        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut h] = self.state;
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ (!e & g);
            let t1 = h
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[i])
                .wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let t2 = s0.wrapping_add(maj);
            h = g;
            g = f;
            f = e;
            e = d.wrapping_add(t1);
            d = c;
            c = b;
            b = a;
            a = t1.wrapping_add(t2);
        }
        for (state, value) in self.state.iter_mut().zip([a, b, c, d, e, f, g, h]) {
            *state = state.wrapping_add(value);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::opt10::{COORDINATES, VALID_ENTRIES};
    use crate::opt10_table::{AtomicOpt10Table, Opt10Header, Opt10Table, FILE_BYTES, valid_index};

    #[test]
    fn opt11_header_and_bounds_cannot_be_confused_with_opt10() {
        let mut distribution = [0; 16];
        distribution[13] = EoLayout::<11>::VALID_ENTRIES;
        let header = EoHeader::<11> { base: 10, max_bound: 13, completed_depth: 12,
            snapshot_sha256: [1; 32], payload_sha256: [2; 32], distribution };
        let encoded = header.encode();
        assert_eq!(&encoded[..16], b"CBRT-OPT11-PDB\0\0");
        assert_eq!(EoHeader::<11>::decode(&encoded).unwrap(), header);
        assert!(EoHeader::<10>::decode(&encoded).is_err());
        let mut masquerading = encoded;
        masquerading[..16].copy_from_slice(EoLayout::<10>::MAGIC);
        put_u32(&mut masquerading, 24, 10);
        let digest = sha256(&masquerading[..HASH_OFFSET]);
        masquerading[HASH_OFFSET..].copy_from_slice(&digest);
        assert!(EoHeader::<10>::decode(&masquerading).is_err());
        assert!(EoLayout::<11>::valid_index(EoLayout::<10>::COORDINATES + 2));
        assert!(!EoLayout::<10>::valid_index(EoLayout::<10>::COORDINATES + 2));
        assert!(!EoLayout::<11>::valid_index(EoLayout::<11>::COORDINATES));
        assert!(!EoLayout::<11>::valid_index(511));
        let table = AtomicEoTable::<11>::new_for_cells(512, 10).unwrap();
        assert_eq!(table.get(2), 13);
        table.record_min(2, 7).unwrap();
        table.record_min(3, 11).unwrap();
        assert_eq!(table.get(2), 7);
        assert_eq!(table.get(3), 11);
        assert!(table.write_complete(Path::new("never-created-opt11"), &[], 12).is_err());
    }

    #[cfg(all(feature = "opt10-native-hotpath", not(target_family = "wasm")))]
    #[test]
    fn hotpath_prefetch_stays_in_allocation_and_preserves_the_decoder() {
        // 256 bytes of synthetic storage, never a publishable main table.
        // Each word exercises codes 0/1/2/3; each block has its own minimum.
        let mut words = vec![0xe4e4_e4e4; 64];
        for block in 0..16 {
            words[block * 4] = (words[block * 4] & !15) | (block % 11) as u32;
        }
        let mut table = Opt10Table {
            words,
            header: Opt10Header {
                base: 10,
                max_bound: 13,
                completed_depth: 12,
                snapshot_sha256: [0; 32],
                payload_sha256: [0; 32],
                distribution: [0; 16],
            },
        };
        let before = table.words.clone();
        for (index, word) in [(0, 0), (15, 0), (16, 1), (511, 31), (1023, 63)] {
            assert_eq!(table.prefetch_word_address(index), Some(&table.words[word] as *const u32));
        }
        for index in [1024, 1026, COORDINATES, u64::MAX] {
            assert!(table.prefetch_word_address(index).is_none());
            table.prefetch(index);
        }
        let mut decoded = 0;
        for index in 0..1024u64 {
            if !valid_index(index) { continue; }
            let code = index & 3;
            let expected = if code == 0 { ((index / 64) % 11) as u8 } else { 10 + code as u8 };
            assert_eq!(table.get(index), expected);
            table.prefetch(index);
            assert_eq!(table.get(index), expected);
            decoded += 1;
        }
        assert_eq!(decoded, 990);
        #[cfg(feature = "opt10-native-batch")]
        {
            let mut checked = 0;
            for start in (0..1024u64).step_by(8) {
                for mask in 0..256 {
                    let queries = std::array::from_fn(|i| {
                        let index = start + i as u64;
                        (mask & (1 << i) != 0 && valid_index(index)).then_some(index)
                    });
                    let expected = queries.map(|query| query.map_or(0, |index| table.get(index)));
                    assert_eq!(table.get_batch(&queries), expected);
                    checked += queries.iter().filter(|query| query.is_some()).count();
                }
            }
            assert_eq!(checked, 990 * 128);
            for invalid in [0, 1, 64, 511, 1023, 1026, u64::MAX] {
                for slot in 0..8 {
                    let mut queries = [None; 8];
                    queries[slot] = Some(invalid);
                    assert!(std::panic::catch_unwind(|| table.get_batch(&queries)).is_err());
                }
            }
        }
        // Padding may receive an in-allocation hint, but get still rejects it.
        // A real coordinate beyond the fixture must still fail its Vec check.
        for index in [0, 1, 64, 65, 511, 512, 513, 1023, 1026, u64::MAX] {
            table.prefetch(index);
            assert!(std::panic::catch_unwind(|| table.get(index)).is_err());
        }
        assert_eq!(table.words, before);
        table.words.clear();
        assert!(table.prefetch_word_address(0).is_none());
        table.prefetch(0);
        #[cfg(feature = "opt10-native-batch")]
        assert_eq!(table.get_batch(&[None; 8]), [0; 8]);
    }

    struct IoFixture(PathBuf);

    impl IoFixture {
        fn new() -> Self {
            let nonce = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let directory = Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("target/test-tables")
                .join(format!("opt10-io-{}-{nonce}", std::process::id()));
            fs::create_dir_all(directory.parent().unwrap()).unwrap();
            fs::create_dir(&directory).unwrap();
            Self(directory)
        }
    }

    impl Drop for IoFixture {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    #[test]
    fn streamed_io_preserves_unaligned_bytes_and_publishes_exclusively() {
        use std::io::{Seek, SeekFrom};
        let directory = IoFixture::new();
        let path = directory.0.join("small-io-fixture.bin");
        let partial = partial_path(&path);
        let mut output = create_partial(&path).unwrap();
        assert!(!path.exists());
        assert_eq!(fs::read(&partial).unwrap(), vec![0; HEADER_BYTES]);

        // Exercise the production 1024-byte file offset, full 1 MiB chunk,
        // short tail and final header rewrite without allocating a real PDB.
        let payload: Vec<u8> = (0..CHUNK_BYTES + 73).map(|i| (i % 251) as u8).collect();
        // Start just below the production drain threshold to exercise the
        // actual sync path without creating a 64 MiB test file.
        let mut unsynced = WRITE_SYNC_BYTES - CHUNK_BYTES;
        write_stream_chunk(&mut output, &payload[..CHUNK_BYTES], &mut unsynced).unwrap();
        assert_eq!(unsynced, 0);
        write_stream_chunk(&mut output, &payload[CHUNK_BYTES..], &mut unsynced).unwrap();
        assert_eq!(unsynced, 73);
        let header = [0xa5; HEADER_BYTES];
        output.seek(SeekFrom::Start(0)).unwrap();
        output.write_all(&header).unwrap();
        publish_partial(output, &path).unwrap();
        assert!(!partial.exists());

        // The same F_NOCACHE setup is used before the real loader allocates
        // its word buffer. Reopen and verify every byte, including the tail.
        let mut input = File::open(&path).unwrap();
        configure_streaming_io(&input).unwrap();
        assert_eq!(
            input.metadata().unwrap().len(),
            (HEADER_BYTES + payload.len()) as u64
        );
        let mut actual_header = [0; HEADER_BYTES];
        input.read_exact(&mut actual_header).unwrap();
        assert_eq!(actual_header, header);
        let mut actual_payload = vec![0; payload.len()];
        for chunk in actual_payload.chunks_mut(CHUNK_BYTES) {
            input.read_exact(chunk).unwrap();
        }
        assert_eq!(actual_payload, payload);
        assert_eq!(input.read(&mut [0]).unwrap(), 0);
        assert!(create_partial(&path).is_err());
        assert!(!partial.exists());
        // Small I/O fixtures must never be accepted as full Opt10 tables.
        assert!(Opt10Table::load(&path, &[]).is_err());
    }

    #[test]
    fn interrupted_io_retains_partial_and_never_replaces_a_racing_destination() {
        let directory = IoFixture::new();
        let path = directory.0.join("interrupted-io-fixture.bin");
        let partial = partial_path(&path);
        let mut output = create_partial(&path).unwrap();
        output.write_all(b"unfinished payload").unwrap();
        drop(output);
        let interrupted_bytes = fs::read(&partial).unwrap();
        assert!(create_partial(&path).is_err());
        assert_eq!(fs::read(&partial).unwrap(), interrupted_bytes);
        assert!(!path.exists());

        let raced = directory.0.join("raced-io-fixture.bin");
        let mut output = create_partial(&raced).unwrap();
        output.write_all(b"our payload").unwrap();
        fs::write(&raced, b"existing table must survive").unwrap();
        assert!(publish_partial(output, &raced).is_err());
        assert_eq!(fs::read(&raced).unwrap(), b"existing table must survive");
        let retained = fs::read(partial_path(&raced)).unwrap();
        assert_eq!(&retained[..HEADER_BYTES], &[0; HEADER_BYTES]);
        assert_eq!(&retained[HEADER_BYTES..], b"our payload");
    }
    fn hex(bytes: [u8; 32]) -> String {
        bytes.iter().map(|b| format!("{b:02x}")).collect()
    }

    #[test]
    fn sha256_known_vectors_and_stream_boundaries() {
        assert_eq!(
            hex(sha256(b"")),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            hex(sha256(b"abc")),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        let million = vec![b'a'; 1_000_000];
        assert_eq!(
            hex(sha256(&million)),
            "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"
        );
        for chunk_size in [1, 55, 56, 63, 64, 65, 129, 4096] {
            let mut hash = Sha256::new();
            for chunk in million.chunks(chunk_size) {
                hash.update(chunk);
            }
            assert_eq!(hash.finish(), sha256(&million));
        }
    }

    #[test]
    fn atomic_packing_is_monotone_and_keeps_padding() {
        let table = AtomicOpt10Table::allocate(1024, 10).unwrap();
        assert_eq!(table.get(2), 13);
        table.record_min(2, 12).unwrap();
        assert_eq!(table.get(2), 12);
        table.record_min(17, 11).unwrap();
        assert_eq!(table.get(17), 11);
        table.record_min(2, 7).unwrap();
        assert_eq!(table.get(2), 7);
        table.record_min(18, 4).unwrap();
        assert_eq!(table.get(2), 4);
        assert_eq!(table.get(17), 11);
        assert!(!table.record_min(2, 20).unwrap());
        for padding in [0, 1, 64, 65, 511, 512, 513, 1024] {
            assert!(table.record_min(padding, 0).is_err());
        }
        let mut counts = [0u64; 16];
        let mut fallback = 0;
        for (i, word) in table.words.iter().enumerate() {
            inspect_word(
                word.load(Ordering::Relaxed),
                i,
                10,
                &mut fallback,
                &mut counts,
            )
            .unwrap();
        }
        assert_eq!(counts.iter().sum::<u64>(), 990);
        assert_eq!(counts[4], 2);
        assert_eq!(counts[11], 1);
    }

    #[test]
    fn concurrent_minima_do_not_lose_neighbors_or_block_minimum() {
        let table = AtomicOpt10Table::allocate(512, 10).unwrap();
        std::thread::scope(|scope| {
            for depth in 0..20 {
                let t = &table;
                scope.spawn(move || {
                    for i in 2..16 {
                        t.record_min(i, depth).unwrap();
                    }
                });
            }
        });
        for i in 2..16 {
            assert_eq!(table.get(i), 0);
        }
        assert_eq!(table.get(16), 13);
    }

    #[test]
    fn header_rejects_partial_wrong_variant_and_corruption() {
        let mut distribution = [0u64; 16];
        distribution[13] = VALID_ENTRIES;
        let header = Opt10Header {
            base: 10,
            max_bound: 13,
            completed_depth: 12,
            snapshot_sha256: sha256(b"snapshot"),
            payload_sha256: sha256(b"payload"),
            distribution,
        };
        assert_eq!(Opt10Header::decode(&header.encode()).unwrap(), header);
        let mut corrupt = header.encode();
        corrupt[104] ^= 1;
        assert!(Opt10Header::decode(&corrupt).is_err());
        for mutate in [0, 1, 2, 3, 4] {
            let mut bytes = header.encode();
            match mutate {
                0 => bytes[24] = 9,
                1 => bytes[59] = 0,
                2 => bytes[58] = 11,
                3 => bytes[288] = 1,
                _ => bytes[160] = 1,
            }
            let hash = sha256(&bytes[..HASH_OFFSET]);
            bytes[HASH_OFFSET..].copy_from_slice(&hash);
            assert!(Opt10Header::decode(&bytes).is_err());
        }
        assert_eq!(FILE_BYTES, 31_130_911_744);
        assert!(AtomicOpt10Table::allocate(512, 13).is_err());
        let partial_error = Opt10Table::load(Path::new("missing-opt10.pdb.partial"), &[])
            .err()
            .unwrap();
        assert_eq!(
            partial_error,
            "an unpublished Opt10 .partial file cannot be loaded"
        );
        let mut fallback = 0;
        let mut counts = [0; 16];
        assert!(inspect_word(0, 31, 10, &mut fallback, &mut counts).is_err());
    }
}
