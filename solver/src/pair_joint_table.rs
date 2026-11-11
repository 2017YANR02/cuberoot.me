//! Exact Cross + Pair goal intersections. Native generation is explicit; loading
//! never creates a missing table. The four pseudo tables use corner-canonical frames.

use std::collections::{BTreeSet, VecDeque};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Instant;

use rayon::prelude::*;

use crate::cube_common::{self as cc, state_space, Move, State};
use crate::prune_tables::{PackedPruneTable, PtStorage, PT_HEADER_BYTES, PT_MAGIC};

pub const ENTRY_COUNT: u64 = 109_486_080;
pub const REACHABLE_COUNT: u64 = 72_990_720;
pub const PAYLOAD_BYTES: u64 = ENTRY_COUNT / 2;
pub const FILE_BYTES: u64 = PAYLOAD_BYTES + PT_HEADER_BYTES as u64;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Pair,
    PseudoPair(u8),
}

pub const ALL_KINDS: [Kind; 5] = [
    Kind::Pair,
    Kind::PseudoPair(0),
    Kind::PseudoPair(1),
    Kind::PseudoPair(2),
    Kind::PseudoPair(3),
];

impl Kind {
    fn slot(self) -> usize {
        match self {
            Self::Pair => 0,
            Self::PseudoPair(d) if d < 4 => d as usize + 1,
            Self::PseudoPair(d) => panic!("invalid pseudo pair diff {d}"),
        }
    }

    pub fn file_name(self) -> &'static str {
        [
            "pt_cross_pair_C4E0.bin",
            "pt_pscross_pair_C4E0.bin",
            "pt_pscross_pair_C4E1.bin",
            "pt_pscross_pair_C4E2.bin",
            "pt_pscross_pair_C4E3.bin",
        ][self.slot()]
    }

    pub fn seed_count(self) -> u64 {
        if self == Self::Pair {
            17
        } else {
            68
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    Off,
    First,
    All,
}

impl Mode {
    pub fn from_env(default: Self) -> Self {
        Self::parse(std::env::var("CUBE_PAIR_JOINT_MODE").ok().as_deref(), default)
    }

    fn parse(value: Option<&str>, default: Self) -> Self {
        match value {
            None => default,
            Some("off" | "0") => Self::Off,
            Some("first") => Self::First,
            Some("all") => Self::All,
            Some(v) => panic!("CUBE_PAIR_JOINT_MODE must be off, first or all; got {v}"),
        }
    }
}

fn apply(mut s: State, moves: &[Move]) -> State {
    for &m in moves {
        s.apply(m);
    }
    s
}

fn edge(s: &State, piece: usize) -> u8 {
    let p = s
        .edges
        .iter()
        .position(|v| *v as usize / 2 == piece)
        .unwrap();
    2 * p as u8 + s.edges[p] % 2
}

fn corner(s: &State, piece: usize) -> u8 {
    let p = s
        .corners
        .iter()
        .position(|v| *v as usize / 3 == piece)
        .unwrap();
    3 * p as u8 + s.corners[p] % 3
}

fn cross(s: &State) -> [u8; 4] {
    std::array::from_fn(|i| edge(s, i + 8))
}

fn projection_seeds(kind: Kind) -> (BTreeSet<([u8; 4], u8)>, BTreeSet<(u8, u8)>) {
    let e = match kind {
        Kind::Pair => 0,
        Kind::PseudoPair(d) => d as usize,
    };
    projection_seeds_for(0, e, kind != Kind::Pair)
}

fn projection_seeds_for(
    c: usize,
    e: usize,
    pseudo: bool,
) -> (BTreeSet<([u8; 4], u8)>, BTreeSet<(u8, u8)>) {
    let algorithms = [
        ["L U L'", "L U' L'", "B' U B", "B' U' B"],
        ["R' U R", "R' U' R", "B U B'", "B U' B'"],
        ["R U R'", "R U' R'", "F' U F", "F' U' F"],
        ["L' U L", "L' U' L", "F U F'", "F U' F'"],
    ];
    let mut ins = vec![State::SOLVED];
    let mut pair = vec![State::SOLVED];
    if !pseudo {
        for text in algorithms[0] {
            let s = apply(State::SOLVED, &cc::string_to_alg(text));
            ins.push(s);
            for mv in 0..3 {
                ins.push(s.applied(Move::from_index(mv)));
            }
        }
        pair = ins.clone();
    } else {
        for mv in 3..6 {
            let s = State::SOLVED.applied(Move::from_index(mv));
            ins.push(s);
            pair.push(s);
        }
        // Exact seed expansion of create_pt_pscross_ins_c / create_pt_pspair.
        // Their U expansion differs, so intersect projections.
        for text in algorithms[e] {
            let prefix =
                Move::from_index([[0, 3, 4, 5], [5, 0, 3, 4], [4, 5, 0, 3], [3, 4, 5, 0]][e][c]);
            let s = apply(State::SOLVED.applied(prefix), &cc::string_to_alg(text));
            ins.push(s);
            pair.push(s);
            for mv in 3..6 {
                ins.push(s.applied(Move::from_index(mv)));
                pair.push(s.applied(Move::from_index(mv)));
            }
            let u = s.applied(Move::U);
            pair.push(u);
            for mv in 3..6 {
                ins.push(u.applied(Move::from_index(mv)));
                pair.push(u.applied(Move::from_index(mv)));
            }
            for off in 1..3 {
                let u = s.applied(Move::from_index(off));
                ins.push(u);
                pair.push(u);
                for mv in 3..6 {
                    ins.push(u.applied(Move::from_index(mv)));
                    pair.push(u.applied(Move::from_index(mv)));
                }
            }
        }
    }
    (
        ins.iter().map(|s| (cross(s), corner(s, c + 4))).collect(),
        pair.iter()
            .map(|s| (edge(s, e), corner(s, c + 4)))
            .collect(),
    )
}

pub fn goal_indices(kind: Kind) -> Vec<u64> {
    let (ins, pair) = projection_seeds(kind);
    let mut out = BTreeSet::new();
    for &(cr, c) in &ins {
        let raw = cr.map(i32::from);
        let cr_index = cc::array_to_index(&raw, 4, 2, 12) as u64;
        for &(e, pc) in &pair {
            if c == pc && cr.iter().all(|v| *v / 2 != e / 2) {
                out.insert((cr_index * 24 + c as u64) * 24 + e as u64);
            }
        }
    }
    assert_eq!(out.len() as u64, kind.seed_count());
    out.into_iter().collect()
}

#[derive(Debug)]
pub struct GenerationReport {
    pub kind: Kind,
    pub path: PathBuf,
    pub entry_count: u64,
    pub reachable_count: u64,
    pub histogram: [u64; 15],
    pub max_depth: u8,
    pub seconds: f64,
    pub resumed: bool,
    pub already_present: bool,
}

const CHECKPOINT_MAGIC: &[u8; 8] = b"PAIRJNT2";
const FNV_OFFSET: u64 = 0xcbf29ce484222325;

fn checksum_update(mut hash: u64, bytes: &[u8]) -> u64 {
    for &v in bytes {
        hash = (hash ^ u64::from(v)).wrapping_mul(0x100000001b3);
    }
    hash
}

fn checkpoint_path(dir: &Path, kind: Kind) -> PathBuf {
    dir.join(format!("{}.checkpoint", kind.file_name()))
}

fn save_checkpoint(path: &Path, kind: Kind, depth: u8, data: &[AtomicU8]) -> Result<(), String> {
    let pending = path.with_extension("checkpoint.pending");
    let mut f = File::create(&pending).map_err(|e| e.to_string())?;
    let mut header = [0u8; 18];
    header[..8].copy_from_slice(CHECKPOINT_MAGIC);
    header[8] = kind.slot() as u8;
    header[9] = depth;
    header[10..].copy_from_slice(&(data.len() as u64).to_le_bytes());
    f.write_all(&header).map_err(|e| e.to_string())?;
    let mut checksum = checksum_update(FNV_OFFSET, &header);
    let mut buf = [0u8; 65536];
    for chunk in data.chunks(buf.len()) {
        for (to, from) in buf.iter_mut().zip(chunk) {
            *to = from.load(Ordering::Relaxed);
        }
        f.write_all(&buf[..chunk.len()])
            .map_err(|e| e.to_string())?;
        checksum = checksum_update(checksum, &buf[..chunk.len()]);
    }
    f.write_all(&checksum.to_le_bytes())
        .map_err(|e| e.to_string())?;
    f.sync_all().map_err(|e| e.to_string())?;
    fs::rename(&pending, path).map_err(|e| e.to_string())
}

fn restore_checkpoint(path: &Path, kind: Kind) -> Result<(Vec<AtomicU8>, u8, [u64; 15]), String> {
    read_checkpoint(
        path,
        kind,
        ENTRY_COUNT,
        REACHABLE_COUNT,
        &goal_indices(kind),
    )
}

fn read_checkpoint(
    path: &Path,
    kind: Kind,
    entry_count: u64,
    reachable_count: u64,
    goals: &[u64],
) -> Result<(Vec<AtomicU8>, u8, [u64; 15]), String> {
    let mut f = File::open(path).map_err(|e| e.to_string())?;
    if f.metadata().map_err(|e| e.to_string())?.len() != entry_count + 26 {
        return Err("joint checkpoint length mismatch".into());
    }
    let mut header = [0u8; 18];
    f.read_exact(&mut header).map_err(|e| e.to_string())?;
    if &header[..8] != CHECKPOINT_MAGIC
        || header[8] as usize != kind.slot()
        || header[9] > 14
        || u64::from_le_bytes(header[10..18].try_into().unwrap()) != entry_count
    {
        return Err("joint checkpoint identity mismatch".into());
    }
    let mut counts = [0u64; 15];
    let mut checksum = checksum_update(FNV_OFFSET, &header);
    let mut data = Vec::with_capacity(entry_count as usize);
    let mut buf = [0u8; 65536];
    while data.len() < entry_count as usize {
        let n = buf.len().min(entry_count as usize - data.len());
        f.read_exact(&mut buf[..n]).map_err(|e| e.to_string())?;
        checksum = checksum_update(checksum, &buf[..n]);
        for &v in &buf[..n] {
            if v != 255 {
                if v > header[9] {
                    return Err("checkpoint has a future BFS layer".into());
                }
                counts[v as usize] += 1;
            }
            data.push(AtomicU8::new(v));
        }
    }
    let mut stored_checksum = [0u8; 8];
    f.read_exact(&mut stored_checksum)
        .map_err(|e| e.to_string())?;
    if checksum != u64::from_le_bytes(stored_checksum) {
        return Err("joint checkpoint checksum mismatch".into());
    }
    if counts[0] != goals.len() as u64
        || counts.iter().sum::<u64>() > reachable_count
        || goals
            .iter()
            .any(|&i| data[i as usize].load(Ordering::Relaxed) != 0)
    {
        return Err("joint checkpoint goal/count mismatch".into());
    }
    Ok((data, header[9], counts))
}

fn expand_layer<F>(data: &[AtomicU8], depth: u8, successors: F) -> u64
where
    F: Fn(usize) -> [usize; 18] + Sync,
{
    data.par_iter()
        .enumerate()
        .map(|(i, cell)| {
            if cell.load(Ordering::Relaxed) != depth {
                return 0;
            }
            let mut count = 0;
            for idx in successors(i) {
                let next = &data[idx];
                if next.load(Ordering::Relaxed) == 255
                    && next
                        .compare_exchange(255, depth + 1, Ordering::Relaxed, Ordering::Relaxed)
                        .is_ok()
                {
                    count += 1;
                }
            }
            count
        })
        .sum()
}

pub fn generate(kind: Kind, directory: &Path) -> Result<GenerationReport, String> {
    fs::create_dir_all(directory).map_err(|e| e.to_string())?;
    let path = directory.join(kind.file_name());
    if path.exists() {
        return validate_file(kind, &path);
    }
    let start = Instant::now();
    let mtm = crate::move_tables::instance();
    let e4 = mtm.ensure_edge4();
    let c = mtm.ensure_corn();
    let e = mtm.ensure_edge();
    let (mt4, mtc, mte) = (e4.as_u32(), c.as_u32(), e.as_u32());
    let checkpoint = checkpoint_path(directory, kind);
    let resumed = checkpoint.exists();
    let (data, mut depth, mut histogram) = if resumed {
        restore_checkpoint(&checkpoint, kind)?
    } else {
        let data: Vec<AtomicU8> = (0..ENTRY_COUNT).map(|_| AtomicU8::new(255)).collect();
        let seeds = goal_indices(kind);
        for &i in &seeds {
            data[i as usize].store(0, Ordering::Relaxed);
        }
        let mut histogram = [0; 15];
        histogram[0] = seeds.len() as u64;
        (data, 0, histogram)
    };
    let mut visited = histogram.iter().sum::<u64>();
    while visited < REACHABLE_COUNT {
        if depth >= 14 {
            return Err("joint distance would collide with 4-bit sentinel 15".into());
        }
        let next_depth = depth + 1;
        let added = expand_layer(&data, depth, |i| {
            let combined = i / 24;
            let edge = (i % 24) * 18;
            let corner = (combined % 24) * 18;
            let cross = (combined / 24) * 24;
            std::array::from_fn(|mv| {
                (mt4[cross + mv] as usize + mtc[corner + mv] as usize) * 24
                    + mte[edge + mv] as usize
            })
        });
        if added == 0 {
            return Err(format!(
                "joint BFS stopped at {visited}, expected {REACHABLE_COUNT}"
            ));
        }
        depth = next_depth;
        histogram[depth as usize] = added;
        visited += added;
        if visited > REACHABLE_COUNT {
            return Err("joint BFS reached an invalid coordinate".into());
        }
        save_checkpoint(&checkpoint, kind, depth, &data)?;
        eprintln!(
            "[PAIR-JOINT] {} depth={depth} new={added} reached={visited}/{REACHABLE_COUNT}",
            kind.file_name()
        );
    }
    let packed = crate::prune_create::pack_atomics_inplace(data);
    if validate_packed(kind, &packed)? != histogram {
        return Err("packed joint histogram differs from generated BFS".into());
    }
    crate::prune_tables::write_packed_prune_table(&path, ENTRY_COUNT, &packed)
        .map_err(|e| e.to_string())?;
    fs::remove_file(&checkpoint).map_err(|e| e.to_string())?;
    Ok(GenerationReport {
        kind,
        path,
        entry_count: ENTRY_COUNT,
        reachable_count: visited,
        histogram,
        max_depth: depth,
        seconds: start.elapsed().as_secs_f64(),
        resumed,
        already_present: false,
    })
}

fn validate_packed(kind: Kind, bytes: &[u8]) -> Result<[u64; 15], String> {
    if bytes.len() as u64 != PAYLOAD_BYTES {
        return Err("joint payload length mismatch".into());
    }
    let mut counts = [0u64; 16];
    for &v in bytes {
        counts[(v & 15) as usize] += 1;
        counts[(v >> 4) as usize] += 1;
    }
    if counts[0] != kind.seed_count() || counts[..15].iter().sum::<u64>() != REACHABLE_COUNT {
        return Err("joint reachable/zero count mismatch".into());
    }
    if goal_indices(kind)
        .iter()
        .any(|&i| crate::prune_tables::get_prune_nibble(bytes, i) != 0)
    {
        return Err("joint table has incorrect goal seeds".into());
    }
    Ok(counts[..15].try_into().unwrap())
}

/// Validate an existing completed table without changing it or creating tables.
pub fn validate_file(kind: Kind, path: &Path) -> Result<GenerationReport, String> {
    let start = Instant::now();
    let (_, histogram) = read_validated(kind, path)?;
    Ok(GenerationReport {
        kind,
        path: path.to_owned(),
        entry_count: ENTRY_COUNT,
        reachable_count: histogram.iter().sum(),
        max_depth: histogram.iter().rposition(|&n| n != 0).unwrap() as u8,
        histogram,
        seconds: start.elapsed().as_secs_f64(),
        resumed: false,
        already_present: true,
    })
}

pub fn load_cached(kind: Kind) -> Result<Arc<PackedPruneTable>, String> {
    type Cached = Option<(PathBuf, Arc<PackedPruneTable>)>;
    static CACHE: OnceLock<Mutex<[Cached; 5]>> = OnceLock::new();
    let path = crate::move_tables::table_dir().join(kind.file_name());
    let mut cache = CACHE
        .get_or_init(|| Mutex::new(std::array::from_fn(|_| None)))
        .lock()
        .unwrap();
    if let Some((p, table)) = &cache[kind.slot()] {
        if p == &path {
            return Ok(table.clone());
        }
    }
    let (table, _) = read_validated(kind, &path)?;
    let table = Arc::new(table);
    cache[kind.slot()] = Some((path, table.clone()));
    Ok(table)
}

fn read_validated(kind: Kind, path: &Path) -> Result<(PackedPruneTable, [u64; 15]), String> {
    let f = File::open(path).map_err(|e| {
        format!(
            "{}: {e}; generate it through table_generator",
            path.display()
        )
    })?;
    if f.metadata().map_err(|e| e.to_string())?.len() != FILE_BYTES {
        return Err(format!("{}: wrong joint table size", path.display()));
    }
    // SAFETY: immutable, completed file; generation writes a separate file and renames.
    let mmap = unsafe { memmap2::MmapOptions::new().map(&f) }.map_err(|e| e.to_string())?;
    if &mmap[..8] != PT_MAGIC || u64::from_le_bytes(mmap[8..16].try_into().unwrap()) != ENTRY_COUNT
    {
        return Err("joint table header mismatch".into());
    }
    let histogram = validate_packed(kind, &mmap[PT_HEADER_BYTES..])?;
    let table = PackedPruneTable {
        data: PtStorage::Mmap(mmap),
        entry_count: ENTRY_COUNT,
    };
    Ok((table, histogram))
}

struct Frame {
    cross: Vec<u32>,
    corner: [u8; 24],
    edge: [u8; 24],
}

fn piece_frame(mt: &[u32], slot: usize, physical: usize, canonical: usize) -> [u8; 24] {
    let mut out = [u8::MAX; 24];
    let mut queue = VecDeque::from([(physical, canonical)]);
    out[physical] = canonical as u8;
    while let Some((p, c)) = queue.pop_front() {
        for mv in 0..18 {
            let np = mt[p * 18 + mv] as usize;
            let nc = mt[c * 18 + cc::conj_moves_flat()[mv][slot] as usize] as usize;
            if out[np] == u8::MAX {
                out[np] = nc as u8;
                queue.push_back((np, nc));
            } else {
                assert_eq!(out[np], nc as u8);
            }
        }
    }
    assert!(out.iter().all(|v| *v != u8::MAX));
    out
}

fn frames() -> &'static [Frame; 4] {
    static FRAMES: OnceLock<[Frame; 4]> = OnceLock::new();
    FRAMES.get_or_init(|| {
        let em = crate::mt_gen::create_mt_edge();
        let cm = crate::mt_gen::create_mt_corn();
        std::array::from_fn(|slot| {
            let edge = piece_frame(&em, slot, 2 * slot, 0);
            let corner = piece_frame(&cm, slot, 3 * (slot + 4), 12);
            let cross = (0..state_space::CROSS)
                .map(|i| {
                    let mut raw = [0; 4];
                    cc::index_to_array(&mut raw, i as i32, 4, 2, 12);
                    let mut normalized = [0; 4];
                    for k in 0..4 {
                        let reference = edge[2 * (k + 8)];
                        let target = reference as usize / 2 - 8;
                        normalized[target] = (edge[raw[k] as usize / 18] ^ (reference & 1)) as i32;
                    }
                    cc::array_to_index(&normalized, 4, 2, 12) as u32 * 24
                })
                .collect();
            Frame {
                cross,
                corner,
                edge,
            }
        })
    })
}

pub struct PseudoTables {
    tables: [Arc<PackedPruneTable>; 4],
    frames: &'static [Frame; 4],
}

impl PseudoTables {
    pub fn load() -> Result<Self, String> {
        let mut tables = Vec::with_capacity(4);
        for diff in 0..4 {
            tables.push(load_cached(Kind::PseudoPair(diff))?);
        }
        Ok(Self {
            tables: tables.try_into().unwrap(),
            frames: frames(),
        })
    }

    #[inline]
    pub fn distance(
        &self,
        pair_slot: usize,
        cross_scaled: usize,
        corner: usize,
        edge: usize,
    ) -> u32 {
        let c = pair_slot % 4;
        let diff = (pair_slot / 4 + 4 - c) % 4;
        let frame = &self.frames[c];
        let cr = frame.cross[cross_scaled / 24] as u64;
        let idx = (cr + frame.corner[corner] as u64) * 24 + frame.edge[edge] as u64;
        self.tables[diff].get(idx) as u32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mode_defaults_are_per_solver_and_explicit_modes_override_them() {
        for default in [Mode::First, Mode::Off] {
            assert_eq!(Mode::parse(None, default), default);
            for (value, expected) in [
                ("off", Mode::Off),
                ("0", Mode::Off),
                ("first", Mode::First),
                ("all", Mode::All),
            ] {
                assert_eq!(Mode::parse(Some(value), default), expected);
            }
        }
    }

    #[test]
    #[should_panic(expected = "CUBE_PAIR_JOINT_MODE must be off, first or all")]
    fn mode_rejects_unknown_explicit_value() {
        Mode::parse(Some("unknown"), Mode::First);
    }

    #[test]
    fn layered_generation_matches_independent_queue_bfs() {
        const N: usize = 257;
        let successors = |i: usize| {
            std::array::from_fn(|mv| {
                let step = [1, 7, 23][mv % 3];
                (i + if mv % 2 == 0 { step } else { N - step }) % N
            })
        };
        let mut expected = vec![255u8; N];
        let mut queue = VecDeque::new();
        for seed in [0, 128] {
            expected[seed] = 0;
            queue.push_back(seed);
        }
        while let Some(i) = queue.pop_front() {
            for next in successors(i) {
                if expected[next] == 255 {
                    expected[next] = expected[i] + 1;
                    queue.push_back(next);
                }
            }
        }
        let data: Vec<_> = (0..N).map(|_| AtomicU8::new(255)).collect();
        data[0].store(0, Ordering::Relaxed);
        data[128].store(0, Ordering::Relaxed);
        let mut visited = 2;
        for depth in 0..14 {
            let added = expand_layer(&data, depth, successors);
            assert_eq!(
                added,
                expected.iter().filter(|&&v| v == depth + 1).count() as u64
            );
            visited += added;
            if added == 0 {
                break;
            }
        }
        assert_eq!(visited, N as u64);
        assert_eq!(
            data.iter()
                .map(|v| v.load(Ordering::Relaxed))
                .collect::<Vec<_>>(),
            expected
        );
    }

    #[test]
    fn checkpoint_roundtrip_rejects_payload_and_metadata_corruption() {
        let directory = Path::new(env!("CARGO_MANIFEST_DIR")).join("../.tmp/scratch");
        fs::create_dir_all(&directory).unwrap();
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = directory.join(format!(
            "pair-joint-checkpoint-{}-{stamp}",
            std::process::id()
        ));
        let data: Vec<_> = [0, 1, 2, 255, 2, 1, 0]
            .into_iter()
            .map(AtomicU8::new)
            .collect();
        save_checkpoint(&path, Kind::Pair, 2, &data).unwrap();
        let (restored, depth, histogram) =
            read_checkpoint(&path, Kind::Pair, 7, 7, &[0, 6]).unwrap();
        assert_eq!(depth, 2);
        assert_eq!(&histogram[..3], &[2, 2, 2]);
        assert_eq!(
            restored
                .iter()
                .map(|v| v.load(Ordering::Relaxed))
                .collect::<Vec<_>>(),
            [0, 1, 2, 255, 2, 1, 0]
        );
        let original = fs::read(&path).unwrap();
        for position in [9, 19, original.len() - 1] {
            let mut damaged = original.clone();
            damaged[position] ^= 1;
            fs::write(&path, damaged).unwrap();
            let error = read_checkpoint(&path, Kind::Pair, 7, 7, &[0, 6]).unwrap_err();
            assert!(error.contains("checksum"), "{error}");
        }
        fs::write(&path, &original).unwrap();
        assert!(read_checkpoint(&path, Kind::PseudoPair(0), 7, 7, &[0, 6]).is_err());
        assert!(read_checkpoint(&path, Kind::Pair, 8, 7, &[0, 6]).is_err());
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn joint_seed_intersections_match_targets() {
        assert_eq!(ENTRY_COUNT, state_space::CROSS as u64 * 24 * 24);
        assert_eq!(REACHABLE_COUNT, state_space::CROSS as u64 * 16 * 24);
        for kind in ALL_KINDS {
            let (ins, pair) = projection_seeds(kind);
            assert_eq!(
                (ins.len(), pair.len()),
                if kind == Kind::Pair {
                    (9, 17)
                } else {
                    (36, 20)
                }
            );
            assert_eq!(goal_indices(kind).len() as u64, kind.seed_count());
        }
    }

    #[test]
    fn all_sixteen_pseudo_goals_normalize_to_four_joint_tables() {
        let frames = frames();
        for c in 0..4 {
            for e in 0..4 {
                let frame = &frames[c];
                let (ins, pair) = projection_seeds_for(c, e, true);
                let mut normalized = BTreeSet::new();
                for &(cr, corner) in &ins {
                    let raw = cc::array_to_index(&cr.map(i32::from), 4, 2, 12) as usize;
                    for &(edge, pc) in &pair {
                        if corner == pc && cr.iter().all(|v| *v / 2 != edge / 2) {
                            normalized.insert(
                                (frame.cross[raw] as u64 + frame.corner[corner as usize] as u64)
                                    * 24
                                    + frame.edge[edge as usize] as u64,
                            );
                        }
                    }
                }
                assert_eq!(
                    normalized.into_iter().collect::<Vec<_>>(),
                    goal_indices(Kind::PseudoPair(((e + 4 - c) % 4) as u8)),
                    "physical corner {c}, edge {e}"
                );
            }
        }
    }

    #[test]
    fn pseudo_frames_match_independent_conjugate_replay() {
        let frames = frames();
        let mut random = 1234567u32;
        for _ in 0..32 {
            let mut physical = State::SOLVED;
            let mut canonical = [State::SOLVED; 4];
            for _ in 0..25 {
                random = random.wrapping_mul(1664525).wrapping_add(1013904223);
                let mv = (random % 18) as usize;
                physical.apply(Move::from_index(mv));
                for c in 0..4 {
                    canonical[c].apply(Move::from_index(cc::conj_moves_flat()[mv][c] as usize));
                    let cr = cross(&physical).map(i32::from);
                    let raw = cc::array_to_index(&cr, 4, 2, 12) as usize;
                    let expected = cross(&canonical[c]).map(i32::from);
                    assert_eq!(
                        frames[c].cross[raw],
                        cc::array_to_index(&expected, 4, 2, 12) as u32 * 24
                    );
                    assert_eq!(
                        frames[c].corner[corner(&physical, c + 4) as usize],
                        corner(&canonical[c], 4)
                    );
                    for e in 0..4 {
                        let diff = (e + 4 - c) % 4;
                        assert_eq!(
                            frames[c].edge[edge(&physical, e) as usize],
                            edge(&canonical[c], diff)
                        );
                    }
                }
            }
        }
    }
}
