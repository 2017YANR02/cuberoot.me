//! Exact compact Cross + F2L-edge EO table, shared by native F2LEO statistics.
//! Generation is explicit through table_generator; solving never generates a table.

use std::sync::OnceLock;

pub const CROSS_POSITIONS: u32 = 12 * 11 * 10 * 9;
pub const FREE_SUBSETS: u32 = 70; // C(8, 4)
pub const PLACEMENTS: u32 = CROSS_POSITIONS * FREE_SUBSETS;
pub const ORIENTATIONS: u32 = 256;
pub const STATES: u32 = PLACEMENTS * ORIENTATIONS;
pub const PACKED_BYTES: usize = STATES as usize / 2;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Goal {
    Cross,
    PseudoCross,
}

/// Each entry is `2 * physical_position + flip`.
/// Cross order is DB, DR, DF, DL (piece IDs 8, 9, 10, 11).
/// The four interchangeable F2L edges are sorted by physical position.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Coordinate {
    cross: [u8; 4],
    free: [u8; 4],
}

struct Subsets {
    masks: [u8; 70],
    rank: [u8; 256],
}

fn subsets() -> &'static Subsets {
    static TABLE: OnceLock<Subsets> = OnceLock::new();
    TABLE.get_or_init(|| {
        let mut out = Subsets {
            masks: [0; 70],
            rank: [u8::MAX; 256],
        };
        let mut n = 0;
        for mask in 0u16..256 {
            if mask.count_ones() == 4 {
                out.masks[n] = mask as u8;
                out.rank[mask as usize] = n as u8;
                n += 1;
            }
        }
        assert_eq!(n, FREE_SUBSETS as usize);
        out
    })
}

impl Coordinate {
    fn from_solver_root(i1: usize, i2: usize, edges: [usize; 4]) -> Self {
        let mut a = [0i32; 2];
        let mut b = [0i32; 2];
        index_to_array(&mut a, i1 as i32, 2, 2, 12);
        index_to_array(&mut b, i2 as i32, 2, 2, 12);
        let cross = [a[0], a[1], b[0], b[1]].map(|v| (v / 18) as u8);
        Self::new(cross, edges.map(|v| v as u8)).expect("valid F2LEO root")
    }

    pub fn new(cross: [u8; 4], mut free: [u8; 4]) -> Result<Self, &'static str> {
        let mut occupied = 0u16;
        for edge in cross.iter().chain(free.iter()) {
            if *edge >= 24 {
                return Err("edge coordinate outside 0..24");
            }
            let bit = 1u16 << (edge / 2);
            if occupied & bit != 0 {
                return Err("two tracked edges occupy the same position");
            }
            occupied |= bit;
        }
        free.sort_unstable();
        Ok(Self { cross, free })
    }

    /// Project the existing `State::edges` representation, without loading tables.
    pub fn from_edges(edges: &[u8; 12]) -> Result<Self, &'static str> {
        let mut seen = 0u16;
        let mut cross = [0u8; 4];
        let mut free = [0u8; 4];
        let mut nf = 0;
        for (pos, &edge) in edges.iter().enumerate() {
            let piece = edge / 2;
            if piece >= 12 || seen & (1 << piece) != 0 {
                return Err("invalid edge piece permutation");
            }
            seen |= 1 << piece;
            let value = 2 * pos as u8 + (edge & 1);
            if piece >= 8 {
                cross[(piece - 8) as usize] = value;
            } else if piece < 4 {
                free[nf] = value;
                nf += 1;
            }
        }
        Self::new(cross, free)
    }

    pub fn cross(&self) -> [u8; 4] {
        self.cross
    }

    pub fn free(&self) -> [u8; 4] {
        self.free
    }

    /// P(12,4) lexicographic position rank, then C(8,4) residual subset rank,
    /// then eight independent flip bits. All legal coordinates use one address.
    pub fn rank(&self) -> u32 {
        let mut available = (1u16 << 12) - 1;
        let mut cross_rank = 0u32;
        let mut flips = 0u32;
        for (i, &edge) in self.cross.iter().enumerate() {
            let pos = edge / 2;
            let ordinal = (available & ((1u16 << pos) - 1)).count_ones();
            cross_rank = cross_rank * (12 - i as u32) + ordinal;
            available &= !(1 << pos);
            flips |= ((edge & 1) as u32) << i;
        }
        let mut free_mask = 0u8;
        for (i, &edge) in self.free.iter().enumerate() {
            let pos = edge / 2;
            let ordinal = (available & ((1u16 << pos) - 1)).count_ones();
            free_mask |= 1 << ordinal;
            flips |= ((edge & 1) as u32) << (i + 4);
        }
        let free_rank = subsets().rank[free_mask as usize] as u32;
        (cross_rank * FREE_SUBSETS + free_rank) * ORIENTATIONS + flips
    }

    pub fn unrank(index: u32) -> Result<Self, &'static str> {
        if index >= STATES {
            return Err("compact index outside coordinate space");
        }
        let flips = index & 255;
        let placement = index / ORIENTATIONS;
        let free_mask = subsets().masks[(placement % FREE_SUBSETS) as usize];
        let mut rest = placement / FREE_SUBSETS;
        let mut digits = [0u32; 4];
        for i in (0..4).rev() {
            digits[i] = rest % (12 - i as u32);
            rest /= 12 - i as u32;
        }
        let mut available = (1u16 << 12) - 1;
        let mut cross = [0u8; 4];
        for i in 0..4 {
            let pos = nth_set_bit(available, digits[i]);
            available &= !(1 << pos);
            cross[i] = 2 * pos + ((flips >> i) & 1) as u8;
        }
        let mut free = [0u8; 4];
        let mut nf = 0;
        for ordinal in 0..8 {
            if free_mask & (1 << ordinal) != 0 {
                let pos = nth_set_bit(available, ordinal);
                free[nf] = 2 * pos + ((flips >> (nf + 4)) & 1) as u8;
                nf += 1;
            }
        }
        // Construction guarantees distinct positions and a sorted free set.
        Ok(Self { cross, free })
    }

    /// `single_edge_moves` is the existing 24×18, unscaled single-edge table.
    pub fn moved(&self, mv: usize, single_edge_moves: &[u32]) -> Self {
        assert!(mv < 18 && single_edge_moves.len() == 24 * 18);
        let cross = self
            .cross
            .map(|e| single_edge_moves[e as usize * 18 + mv] as u8);
        let free = self
            .free
            .map(|e| single_edge_moves[e as usize * 18 + mv] as u8);
        Self::new(cross, free).expect("a cube move preserves distinct positions")
    }

    pub fn is_goal(&self, goal: Goal) -> bool {
        if self.free.iter().any(|e| e & 1 != 0) {
            return false;
        }
        match goal {
            Goal::Cross => self.cross == [16, 18, 20, 22],
            Goal::PseudoCross => (0..4)
                .any(|offset| (0..4).all(|i| self.cross[i] == 2 * (8 + ((i + offset) % 4)) as u8)),
        }
    }

    /// Relabel tracked cross identities, without making a physical D turn.
    /// This commutes with all moves and maps the four pseudo goals to strict goals.
    /// Therefore one strict PDB can answer pseudo Cross by taking four lookups' min.
    pub fn relabel_cross(&self, offset: usize) -> Self {
        let mut out = *self;
        out.cross.rotate_left(offset % 4);
        out
    }
}

fn nth_set_bit(mut mask: u16, n: u32) -> u8 {
    for _ in 0..n {
        mask &= mask - 1;
    }
    mask.trailing_zeros() as u8
}

use std::fs::{self, File, OpenOptions};
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, AtomicU8, Ordering};
use std::sync::Arc;

use memmap2::Mmap;
use rayon::prelude::*;

use crate::cube_common::index_to_array;
use crate::move_tables::table_path;
use crate::prune_tables::{PackedPruneTable, PtStorage, PT_HEADER_BYTES, PT_MAGIC};

pub const FILE_NAME: &str = "pt_cross_eo_E0E1E2E3.bin";
const FRONTIER_WORDS: usize = STATES as usize / 64;
const CHECKPOINT_MAGIC: &[u8; 8] = b"F2CCK001";
// Fixed-axis E3 distribution / 4!, independently computed by dist_tracked.
pub const EXPECTED_HISTOGRAM: [u64; 10] = [
    70,
    1_050,
    12_056,
    125_910,
    1_201_656,
    9_611_723,
    53_636_750,
    120_620_046,
    27_666_715,
    13_624,
];

#[derive(Debug)]
pub struct BuildSummary {
    pub generated: bool,
    pub resumed: bool,
    pub states: u64,
    pub bytes: u64,
    pub diameter: u8,
    pub histogram: Vec<u64>,
}

pub struct CompactCrossTable {
    table: PackedPruneTable,
}

impl CompactCrossTable {
    pub fn load(path: &Path) -> Result<Self, String> {
        let file = File::open(path).map_err(|e| format!("{}: {e}", path.display()))?;
        let expected = (PACKED_BYTES + PT_HEADER_BYTES) as u64;
        if file.metadata().map_err(|e| e.to_string())?.len() != expected {
            return Err(format!("{}: expected {expected} bytes", path.display()));
        }
        // SAFETY: completed tables are atomically published and immutable while mapped.
        let mmap = unsafe { Mmap::map(&file) }.map_err(|e| e.to_string())?;
        if &mmap[..8] != PT_MAGIC
            || u64::from_le_bytes(mmap[8..16].try_into().unwrap()) != STATES as u64
        {
            return Err(format!(
                "{}: wrong compact coordinate header",
                path.display()
            ));
        }
        Ok(Self {
            table: PackedPruneTable {
                data: PtStorage::Mmap(mmap),
                entry_count: STATES as u64,
            },
        })
    }

    pub fn distance(&self, coordinate: Coordinate, pseudo: bool) -> u32 {
        if pseudo {
            (0..4)
                .map(|r| self.table.get(coordinate.relabel_cross(r).rank() as u64) as u32)
                .min()
                .unwrap()
        } else {
            self.table.get(coordinate.rank() as u64) as u32
        }
    }

    pub fn distance_from_root(&self, i1: usize, i2: usize, edges: [usize; 4], pseudo: bool) -> u32 {
        self.distance(Coordinate::from_solver_root(i1, i2, edges), pseudo)
    }
}

pub fn instance() -> Arc<CompactCrossTable> {
    static TABLE: OnceLock<Arc<CompactCrossTable>> = OnceLock::new();
    TABLE.get_or_init(|| {
        Arc::new(CompactCrossTable::load(&table_path(FILE_NAME)).unwrap_or_else(|error| {
            panic!("compact F2LEO table unavailable: {error}; generate it through table_generator --only rust --table {FILE_NAME}")
        }))
    }).clone()
}

/// Explicit off mode retains the existing Cross search and does not open the table.
pub fn configured() -> Option<Arc<CompactCrossTable>> {
    match std::env::var("CUBE_F2LEO_COMPACT_MODE").as_deref() {
        Ok("off") => None,
        Ok("first") | Err(std::env::VarError::NotPresent) => Some(instance()),
        _ => panic!("CUBE_F2LEO_COMPACT_MODE must be off or first"),
    }
}

fn orientation_lut() -> &'static [[u8; 16]; 256] {
    static LUT: OnceLock<[[u8; 16]; 256]> = OnceLock::new();
    LUT.get_or_init(|| {
        std::array::from_fn(|permutation| {
            std::array::from_fn(|bits| {
                let mut result = 0;
                for i in 0..4 {
                    result |= (((bits >> i) & 1) as u8) << ((permutation >> (i * 2)) & 3);
                }
                result
            })
        })
    })
}

// Low 32 bits contain destination placement and flip XOR for zero input flips;
// next eight bits map each input free-edge flip to its sorted destination bit.
fn transition_row(placement: u32, moves: &[u32]) -> [u64; 18] {
    let source = Coordinate::unrank(placement * 256).unwrap();
    std::array::from_fn(|mv| {
        let destination = source.moved(mv, moves);
        let mut permutation = 0u8;
        for i in 0..4 {
            let position = moves[source.free[i] as usize * 18 + mv] / 2;
            let j = destination
                .free
                .iter()
                .position(|&v| v as u32 / 2 == position)
                .unwrap();
            permutation |= (j as u8) << (2 * i);
        }
        destination.rank() as u64 | ((permutation as u64) << 32)
    })
}

#[inline]
fn successor(record: u64, flips: u8, lut: &[[u8; 16]; 256]) -> u32 {
    record as u32
        ^ ((flips & 15) as u32
            | ((lut[((record >> 32) & 255) as usize][(flips >> 4) as usize] as u32) << 4))
}

#[inline]
fn distance_at(table: &[AtomicU8], index: u32) -> u8 {
    (table[(index / 2) as usize].load(Ordering::Relaxed) >> ((index & 1) * 4)) & 15
}

#[inline]
fn claim(table: &[AtomicU8], index: u32, depth: u8) -> bool {
    let cell = &table[(index / 2) as usize];
    let shift = (index & 1) * 4;
    let mut old = cell.load(Ordering::Relaxed);
    loop {
        if (old >> shift) & 15 != 15 {
            return false;
        }
        let updated = (old & !(15 << shift)) | (depth << shift);
        match cell.compare_exchange_weak(old, updated, Ordering::Relaxed, Ordering::Relaxed) {
            Ok(_) => return true,
            Err(actual) => old = actual,
        }
    }
}

fn mark(frontier: &[AtomicU64], index: u32) {
    frontier[index as usize / 64].fetch_or(1 << (index % 64), Ordering::Relaxed);
}

fn verify_histogram(bytes: &[u8]) -> Result<Vec<u64>, String> {
    let mut histogram = vec![0u64; 16];
    for &byte in bytes {
        histogram[(byte & 15) as usize] += 1;
        histogram[(byte >> 4) as usize] += 1;
    }
    if histogram[..10] != EXPECTED_HISTOGRAM || histogram[10..].iter().any(|&n| n != 0) {
        return Err(format!(
            "compact F2LEO distribution mismatch: {histogram:?}"
        ));
    }
    histogram.truncate(10);
    Ok(histogram)
}

fn atomic_write(
    path: &Path,
    write: impl FnOnce(&mut BufWriter<File>) -> Result<(), String>,
) -> Result<(), String> {
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let tmp = path.with_extension(format!("new-{}", std::process::id()));
    let file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&tmp)
        .map_err(|e| format!("{}: {e}", tmp.display()))?;
    let mut writer = BufWriter::new(file);
    write(&mut writer)?;
    writer.flush().map_err(|e| e.to_string())?;
    writer.get_ref().sync_all().map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())?;
    File::open(parent)
        .and_then(|f| f.sync_all())
        .map_err(|e| e.to_string())
}

fn checkpoint_path(path: &Path) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(".checkpoint");
    PathBuf::from(name)
}

fn hash_byte(hash: &mut u64, byte: u8) {
    *hash = (*hash ^ byte as u64).wrapping_mul(0x100000001b3);
}

fn save_checkpoint(
    path: &Path,
    depth: u8,
    table: &[AtomicU8],
    frontier: &[AtomicU64],
) -> Result<(), String> {
    atomic_write(path, |writer| {
        writer
            .write_all(CHECKPOINT_MAGIC)
            .map_err(|e| e.to_string())?;
        writer
            .write_all(&((table.len() * 2) as u32).to_le_bytes())
            .map_err(|e| e.to_string())?;
        writer
            .write_all(&(depth as u32).to_le_bytes())
            .map_err(|e| e.to_string())?;
        let mut hash = 0xcbf29ce484222325u64;
        for chunk in table.chunks(65536) {
            let bytes: Vec<u8> = chunk.iter().map(|b| b.load(Ordering::Relaxed)).collect();
            for &byte in &bytes {
                hash_byte(&mut hash, byte);
            }
            writer.write_all(&bytes).map_err(|e| e.to_string())?;
        }
        for chunk in frontier.chunks(8192) {
            let mut bytes = Vec::with_capacity(chunk.len() * 8);
            for word in chunk {
                bytes.extend_from_slice(&word.load(Ordering::Relaxed).to_le_bytes());
            }
            for &byte in &bytes {
                hash_byte(&mut hash, byte);
            }
            writer.write_all(&bytes).map_err(|e| e.to_string())?;
        }
        writer
            .write_all(&hash.to_le_bytes())
            .map_err(|e| e.to_string())
    })
}

fn read_checkpoint(
    path: &Path,
    table: &mut [AtomicU8],
    frontier: &mut [AtomicU64],
    expected_histogram: &[u64],
) -> Result<u8, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let states = (table.len() * 2) as u32;
    if file.metadata().map_err(|e| e.to_string())?.len()
        != (16 + table.len() + frontier.len() * 8 + 8) as u64
    {
        return Err("compact checkpoint size mismatch".into());
    }
    let mut reader = BufReader::new(file);
    let mut header = [0u8; 16];
    reader.read_exact(&mut header).map_err(|e| e.to_string())?;
    let depth = u32::from_le_bytes(header[12..16].try_into().unwrap());
    if &header[..8] != CHECKPOINT_MAGIC
        || u32::from_le_bytes(header[8..12].try_into().unwrap()) != states
        || depth as usize >= expected_histogram.len()
        || depth >= 15
    {
        return Err("compact checkpoint header mismatch".into());
    }
    let mut hash = 0xcbf29ce484222325u64;
    let mut buffer = vec![0u8; 65536];
    for chunk in table.chunks_mut(65536) {
        let bytes = &mut buffer[..chunk.len()];
        reader.read_exact(bytes).map_err(|e| e.to_string())?;
        for (cell, &byte) in chunk.iter_mut().zip(bytes.iter()) {
            *cell.get_mut() = byte;
            hash_byte(&mut hash, byte);
        }
    }
    for chunk in frontier.chunks_mut(8192) {
        let bytes = &mut buffer[..chunk.len() * 8];
        reader.read_exact(bytes).map_err(|e| e.to_string())?;
        for &byte in bytes.iter() {
            hash_byte(&mut hash, byte);
        }
        for (cell, value) in chunk.iter_mut().zip(bytes.chunks_exact(8)) {
            *cell.get_mut() = u64::from_le_bytes(value.try_into().unwrap());
        }
    }
    let mut checksum = [0u8; 8];
    reader
        .read_exact(&mut checksum)
        .map_err(|e| e.to_string())?;
    if hash != u64::from_le_bytes(checksum) {
        return Err("compact checkpoint checksum mismatch".into());
    }
    let mut histogram = [0u64; 16];
    for index in 0..states {
        let distance = distance_at(table, index);
        histogram[distance as usize] += 1;
        let active =
            (frontier[index as usize / 64].load(Ordering::Relaxed) >> (index % 64)) & 1 != 0;
        if active != (distance == depth as u8) {
            return Err("compact checkpoint frontier mismatch".into());
        }
    }
    for d in 0..15 {
        let expected = if d <= depth as usize {
            expected_histogram[d]
        } else {
            0
        };
        if histogram[d] != expected {
            return Err("compact checkpoint layer distribution mismatch".into());
        }
    }
    Ok(depth as u8)
}

/// Called only by the unified, externally protected table_generator entry point.
/// Existing complete files are verified; incomplete builds resume a checked layer.
pub fn generate_or_verify(path: &Path) -> Result<BuildSummary, String> {
    if path.exists() {
        let table = CompactCrossTable::load(path)?;
        let histogram = verify_histogram(table.table.bytes())?;
        return Ok(BuildSummary {
            generated: false,
            resumed: false,
            states: STATES as u64,
            bytes: (PACKED_BYTES + PT_HEADER_BYTES) as u64,
            diameter: 9,
            histogram,
        });
    }
    let mut distances: Vec<AtomicU8> = (0..PACKED_BYTES).map(|_| AtomicU8::new(255)).collect();
    let mut current: Vec<AtomicU64> = (0..FRONTIER_WORDS).map(|_| AtomicU64::new(0)).collect();
    let next: Vec<AtomicU64> = (0..FRONTIER_WORDS).map(|_| AtomicU64::new(0)).collect();
    let checkpoint = checkpoint_path(path);
    let resumed = checkpoint.exists();
    let mut depth = if resumed {
        read_checkpoint(
            &checkpoint,
            &mut distances,
            &mut current,
            &EXPECTED_HISTOGRAM,
        )?
    } else {
        for &mask in &subsets().masks {
            let mut free = [0u8; 4];
            let mut n = 0;
            for pos in 0..8 {
                if mask & (1 << pos) != 0 {
                    free[n] = 2 * pos;
                    n += 1;
                }
            }
            let index = Coordinate::new([16, 18, 20, 22], free).unwrap().rank();
            assert!(claim(&distances, index, 0));
            mark(&current, index);
        }
        save_checkpoint(&checkpoint, 0, &distances, &current)?;
        0
    };
    eprintln!(
        "[F2LEO compact] {} layer {depth}; building 119750400-byte position transitions",
        if resumed { "resumed" } else { "seeded" }
    );
    let moves = crate::mt_gen::create_mt_edge();
    let mut transitions = vec![0u64; PLACEMENTS as usize * 18];
    transitions
        .par_chunks_mut(18)
        .enumerate()
        .for_each(|(placement, row)| {
            row.copy_from_slice(&transition_row(placement as u32, &moves))
        });
    let lut = orientation_lut();
    let mut visited: u64 = EXPECTED_HISTOGRAM[..=depth as usize].iter().sum();
    let mut current = current;
    let mut next = next;
    while visited < STATES as u64 {
        if depth >= 9 {
            return Err("compact table exceeds verified diameter 9".into());
        }
        let frontier = EXPECTED_HISTOGRAM[depth as usize];
        let reverse = frontier * 18 > (STATES as u64 - visited) * 4;
        let added = expand_layer(
            &distances,
            &current,
            &next,
            &transitions,
            depth,
            reverse,
            STATES,
            lut,
        );
        depth += 1;
        if added != EXPECTED_HISTOGRAM[depth as usize] {
            return Err(format!(
                "compact layer {depth}: got {added}, expected {}",
                EXPECTED_HISTOGRAM[depth as usize]
            ));
        }
        visited += added;
        std::mem::swap(&mut current, &mut next);
        next.par_iter()
            .for_each(|word| word.store(0, Ordering::Relaxed));
        save_checkpoint(&checkpoint, depth, &distances, &current)?;
        eprintln!(
            "[F2LEO compact] layer {depth}: {added}, visited {visited}/{STATES}, {}",
            if reverse { "reverse" } else { "forward" }
        );
    }
    drop(transitions);
    drop(current);
    drop(next);
    let bytes: Vec<u8> = distances
        .iter()
        .map(|cell| cell.load(Ordering::Relaxed))
        .collect();
    drop(distances);
    let histogram = verify_histogram(&bytes)?;
    atomic_write(path, |writer| {
        writer.write_all(PT_MAGIC).map_err(|e| e.to_string())?;
        writer
            .write_all(&(STATES as u64).to_le_bytes())
            .map_err(|e| e.to_string())?;
        writer.write_all(&bytes).map_err(|e| e.to_string())
    })?;
    // Retain the last validated checkpoint as evidence; no stopped run is erased.
    Ok(BuildSummary {
        generated: true,
        resumed,
        states: STATES as u64,
        bytes: (PACKED_BYTES + PT_HEADER_BYTES) as u64,
        diameter: depth,
        histogram,
    })
}

#[allow(clippy::too_many_arguments)]
fn expand_layer(
    distances: &[AtomicU8],
    current: &[AtomicU64],
    next: &[AtomicU64],
    transitions: &[u64],
    depth: u8,
    reverse: bool,
    states: u32,
    lut: &[[u8; 16]; 256],
) -> u64 {
    if reverse {
        (0..states)
            .into_par_iter()
            .map(|index| {
                if distance_at(distances, index) != 15 {
                    return 0;
                }
                let row = &transitions[index as usize / 256 * 18..][..18];
                if row.iter().any(|&record| {
                    distance_at(distances, successor(record, index as u8, lut)) == depth
                }) && claim(distances, index, depth + 1)
                {
                    mark(next, index);
                    1
                } else {
                    0
                }
            })
            .sum()
    } else {
        current
            .par_iter()
            .enumerate()
            .map(|(word_index, word)| {
                let mut bits = word.load(Ordering::Relaxed);
                let mut count = 0u64;
                while bits != 0 {
                    let bit = bits.trailing_zeros();
                    bits &= bits - 1;
                    let index = word_index as u32 * 64 + bit;
                    let row = &transitions[index as usize / 256 * 18..][..18];
                    for &record in row {
                        let neighbor = successor(record, index as u8, lut);
                        if claim(distances, neighbor, depth + 1) {
                            mark(next, neighbor);
                            count += 1;
                        }
                    }
                }
                count
            })
            .sum()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compact_solver_root_matches_full_state() {
        use crate::cube_common::{create_multi_move_table, Move, State};
        let moves = crate::mt_gen::create_mt_edge();
        let basic: Vec<i32> = moves.iter().map(|&v| v as i32).collect();
        let pairs = create_multi_move_table(2, 2, 12, 528, &basic);
        let (mut i1, mut i2, mut edges) = (416usize, 520usize, [0usize, 2, 4, 6]);
        let mut full = State::SOLVED;
        let mut seed = 0x9e37_79b9u32;
        for _ in 0..512 {
            assert_eq!(
                Coordinate::from_solver_root(i1, i2, edges),
                Coordinate::from_edges(&full.edges).unwrap()
            );
            seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            let mv = (seed % 18) as usize;
            i1 = pairs[i1 * 18 + mv] as usize;
            i2 = pairs[i2 * 18 + mv] as usize;
            edges = edges.map(|e| moves[e * 18 + mv] as usize);
            full = full.applied(Move::from_index(mv));
        }
    }

    #[test]
    fn compact_transition_orientation_factor_matches_moves() {
        let moves = crate::mt_gen::create_mt_edge();
        let lut = orientation_lut();
        for placement in [0, 1, 69, 70, 12_345, PLACEMENTS / 2, PLACEMENTS - 1] {
            let row = transition_row(placement, &moves);
            for flips in 0..256 {
                let coordinate = Coordinate::unrank(placement * 256 + flips).unwrap();
                for mv in 0..18 {
                    assert_eq!(
                        successor(row[mv], flips as u8, lut),
                        coordinate.moved(mv, &moves).rank()
                    );
                }
            }
        }
    }

    #[test]
    fn compact_packed_layers_and_checkpoint_match_small_hypercube() {
        // 512 vertices, 18 involutive moves (each of nine bit flips twice).
        // Exercise the production forward/reverse CAS kernels and checkpoint I/O.
        let states = 512u32;
        let expected = [1, 9, 36, 84, 126, 126, 84, 36, 9, 1];
        let mut transitions = vec![0u64; 2 * 18];
        for p in 0..2 {
            for mv in 0..18 {
                transitions[p * 18 + mv] =
                    ((p as u32 * 256) ^ (1 << (mv / 2))) as u64 | (228u64 << 32);
            }
        }
        let mut table: Vec<AtomicU8> = (0..states / 2).map(|_| AtomicU8::new(255)).collect();
        let mut current: Vec<AtomicU64> = (0..states / 64).map(|_| AtomicU64::new(0)).collect();
        let mut next: Vec<AtomicU64> = (0..states / 64).map(|_| AtomicU64::new(0)).collect();
        assert!(claim(&table, 0, 0));
        mark(&current, 0);
        for depth in 0..9u8 {
            let added = expand_layer(
                &table,
                &current,
                &next,
                &transitions,
                depth,
                depth >= 4,
                states,
                orientation_lut(),
            );
            assert_eq!(added, expected[depth as usize + 1]);
            std::mem::swap(&mut current, &mut next);
            next.iter().for_each(|v| v.store(0, Ordering::Relaxed));
            if depth == 3 {
                let directory = Path::new(env!("CARGO_MANIFEST_DIR"))
                    .join("target/test-tables")
                    .join(format!("f2leo-compact-checkpoint-{}", std::process::id()));
                fs::create_dir_all(&directory).unwrap();
                let path = directory.join("state.checkpoint");
                save_checkpoint(&path, 4, &table, &current).unwrap();
                for cell in &mut table {
                    *cell.get_mut() = 255;
                }
                for word in &mut current {
                    *word.get_mut() = 0;
                }
                assert_eq!(
                    read_checkpoint(&path, &mut table, &mut current, &expected).unwrap(),
                    4
                );
                let mut damaged = fs::read(&path).unwrap();
                damaged[16] ^= 1;
                fs::write(&path, damaged).unwrap();
                assert!(read_checkpoint(&path, &mut table, &mut current, &expected).is_err());
                // Restore the valid checkpoint before continuing; failed reads may fill buffers.
                fs::remove_dir_all(&directory).unwrap();
                for index in 0..states {
                    let d = index.count_ones() as u8;
                    let value = if d <= 4 { d } else { 15 };
                    let cell = table[(index / 2) as usize].get_mut();
                    let shift = (index & 1) * 4;
                    *cell = (*cell & !(15 << shift)) | (value << shift);
                }
            }
        }
        for index in 0..states {
            assert_eq!(distance_at(&table, index), index.count_ones() as u8);
        }
    }
}
