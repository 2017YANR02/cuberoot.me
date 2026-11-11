//! Symmetry-reduced native PDBs for MiddleFour and DeepSeven stage goals.

use std::fs::{File, OpenOptions};
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, OnceLock};

use memmap2::{Mmap, MmapMut};
use rayon::prelude::*;

use crate::move_tables::{self, MoveTable};
use crate::stage_symmetry::{
    coordinate_size, piece_moves, rank, stabilizer, transform_coordinate, unrank, StageSymmetry,
};

const HEADER: usize = 4096;
const RECORD: usize = 512;
const MAGIC: &[u8; 8] = b"STGJPDB1";
const FORMAT: u64 = 1;
const LANES: u64 = 0x1111_1111_1111_1111;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum JointKind {
    MiddleFour,
    DeepSeven,
}

#[derive(Clone, Copy, Debug)]
pub struct JointSpec {
    pub kind: JointKind,
    pub filename: &'static str,
    pub corner_rows: usize,
    pub edge_states: usize,
    pub canonical_states: u64,
    pub packed_bytes: u64,
    pub auxiliary_budget_bytes: u64,
}

impl JointKind {
    pub fn spec(self) -> JointSpec {
        let (filename, corner_rows, edge_states, canonical_states, auxiliary_budget_bytes) =
            match self {
                Self::MiddleFour => (
                    "pt_C4C5C6C7E0E1E2E3.bin",
                    17214,
                    190080,
                    3233313360,
                    96 << 20,
                ),
                Self::DeepSeven => (
                    "pt_cross_C4C6E0E1E2.bin",
                    258,
                    510935040,
                    128755722240,
                    (3u64 << 30) + (96 << 20),
                ),
            };
        JointSpec {
            kind: self,
            filename,
            corner_rows,
            edge_states,
            canonical_states,
            packed_bytes: corner_rows as u64 * edge_states as u64 / 2,
            auxiliary_budget_bytes,
        }
    }
    fn labels(self) -> (&'static [u8], &'static [u8]) {
        match self {
            Self::MiddleFour => (&[4, 5, 6, 7], &[0, 1, 2, 3]),
            Self::DeepSeven => (&[4, 6], &[0, 2, 8, 9, 10, 11, 1]),
        }
    }
    fn id(self) -> u64 {
        match self {
            Self::MiddleFour => 1,
            Self::DeepSeven => 2,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct JointState {
    pub corner: u32,
    pub edge: u32,
}

#[derive(Clone, Copy)]
struct CornerStep {
    row: u16,
    symmetry: u8,
}

/// Small coordinate/rank maps only; constructing this never opens a PDB or edge6 move table.
pub struct JointCoordinates {
    pub kind: JointKind,
    syms: Vec<StageSymmetry>,
    corner_to_row: Vec<u16>,
    corner_to_sym: Vec<u8>,
    #[cfg(test)]
    representatives: Vec<u32>,
    fixed: Vec<u8>,
    corner_moves: Vec<u32>,
    corner_steps: Vec<CornerStep>,
    edge_permutations: Vec<Vec<u32>>,
    edge_xors: Vec<Vec<u8>>,
    orientation_permutations: Vec<Vec<u8>>,
    edge_masks: Vec<u16>,
}

impl JointCoordinates {
    pub fn new(kind: JointKind) -> Self {
        let (corners, edges) = kind.labels();
        let syms = stabilizer(corners, edges);
        assert_eq!(
            syms.len(),
            if kind == JointKind::MiddleFour { 8 } else { 2 }
        );
        assert!(syms[0].identity());
        let corner_size = coordinate_size(corners.len(), 3, 8);
        let mut canonical = vec![0u32; corner_size];
        let mut corner_to_sym = vec![0u8; corner_size];
        for i in 0..corner_size {
            let mut best = i as u32;
            for (s, sym) in syms.iter().enumerate().skip(1) {
                let next = transform_coordinate(sym, true, corners, i as u32);
                if next < best {
                    best = next;
                    corner_to_sym[i] = s as u8;
                }
            }
            canonical[i] = best;
        }
        let representatives: Vec<u32> = canonical
            .iter()
            .enumerate()
            .filter_map(|(i, &v)| (i == v as usize).then_some(v))
            .collect();
        assert_eq!(representatives.len(), kind.spec().corner_rows);
        let mut row_of_rep = vec![u16::MAX; corner_size];
        for (row, &r) in representatives.iter().enumerate() {
            row_of_rep[r as usize] = row as u16;
        }
        let corner_to_row: Vec<u16> = canonical.iter().map(|&r| row_of_rep[r as usize]).collect();
        let fixed = representatives
            .iter()
            .map(|&r| {
                syms.iter().enumerate().fold(0u8, |bits, (s, g)| {
                    bits | if transform_coordinate(g, true, corners, r) == r {
                        1 << s
                    } else {
                        0
                    }
                })
            })
            .collect();
        let cm = piece_moves(true);
        let mut corner_moves = vec![0u32; corner_size * 18];
        for (i, row) in corner_moves.chunks_mut(18).enumerate() {
            let mut codes = [0u8; 4];
            unrank(i as u32, &mut codes[..corners.len()], 3, 8);
            for m in 0..18 {
                let mut next = [0u8; 4];
                for j in 0..corners.len() {
                    next[j] = cm[codes[j] as usize][m];
                }
                row[m] = rank(&next[..corners.len()], 3, 8);
            }
        }
        let corner_steps = representatives
            .iter()
            .flat_map(|&r| {
                (0..18)
                    .map(|m| {
                        let next = corner_moves[r as usize * 18 + m] as usize;
                        CornerStep {
                            row: corner_to_row[next],
                            symmetry: corner_to_sym[next],
                        }
                    })
                    .collect::<Vec<_>>()
            })
            .collect();
        let base_edges = if kind == JointKind::DeepSeven {
            &edges[..6]
        } else {
            edges
        };
        let n = base_edges.len();
        let orientations = 1usize << n;
        let permutations = coordinate_size(n, 1, 12);
        let mut edge_permutations = vec![Vec::new(); syms.len()];
        let mut edge_xors = vec![Vec::new(); syms.len()];
        let mut orientation_permutations = vec![vec![0u8; orientations]; syms.len()];
        let mut edge_masks = if kind == JointKind::DeepSeven {
            vec![0u16; permutations]
        } else {
            Vec::new()
        };
        for (s, g) in syms.iter().enumerate() {
            for bits in 0..orientations {
                let mut value = 0;
                for (j, &label) in base_edges.iter().enumerate() {
                    let target = base_edges
                        .iter()
                        .position(|&l| l == g.edges[label as usize])
                        .unwrap();
                    value |= ((bits >> (n - j - 1)) & 1) << (n - target - 1);
                }
                orientation_permutations[s][bits] = value as u8;
            }
            if s == 0 {
                continue;
            }
            let mut pmap = vec![0u32; permutations];
            let mut xmap = vec![0u8; permutations];
            for p in 0..permutations {
                let mut codes = [0u8; 7];
                unrank((p * orientations) as u32, &mut codes[..n], 2, 12);
                let next = transform_coordinate(g, false, base_edges, (p * orientations) as u32);
                pmap[p] = next / orientations as u32;
                xmap[p] = (next % orientations as u32) as u8;
                if !edge_masks.is_empty() && s == 1 {
                    edge_masks[p] = codes[..n].iter().fold(0, |a, &c| a | (1 << (c / 2)));
                }
            }
            edge_permutations[s] = pmap;
            edge_xors[s] = xmap;
        }
        Self {
            kind,
            syms,
            corner_to_row,
            corner_to_sym,
            #[cfg(test)]
            representatives,
            fixed,
            corner_moves,
            corner_steps,
            edge_permutations,
            edge_xors,
            orientation_permutations,
            edge_masks,
        }
    }

    #[inline]
    fn transform_base_edge(&self, edge: u32, s: usize) -> u32 {
        if s == 0 {
            return edge;
        }
        let bits = if self.kind == JointKind::MiddleFour {
            4
        } else {
            6
        };
        let p = (edge >> bits) as usize;
        let o = (edge & ((1 << bits) - 1)) as usize;
        (self.edge_permutations[s][p] << bits)
            | (self.orientation_permutations[s][o] ^ self.edge_xors[s][p]) as u32
    }

    #[inline]
    pub fn split_deep_edge(&self, edge: u32) -> (u32, u8) {
        let e6 = edge / 12;
        let residual = edge % 12;
        let mask = self.edge_masks[(e6 >> 6) as usize];
        let mut empty = (!mask) & 0xfff;
        for _ in 0..residual / 2 {
            empty &= empty - 1;
        }
        (e6, (empty.trailing_zeros() * 2 + residual % 2) as u8)
    }

    #[inline]
    pub fn join_deep_edge(&self, e6: u32, extra: u8) -> u32 {
        let mask = self.edge_masks[(e6 >> 6) as usize];
        let pos = extra / 2;
        debug_assert_eq!(mask & (1 << pos), 0);
        e6 * 12 + 2 * (((!mask) & ((1 << pos) - 1)).count_ones()) + (extra % 2) as u32
    }

    #[inline]
    pub fn transform_edge(&self, edge: u32, s: usize) -> u32 {
        if s == 0 {
            return edge;
        }
        if self.kind == JointKind::MiddleFour {
            self.transform_base_edge(edge, s)
        } else {
            let (e6, extra) = self.split_deep_edge(edge);
            self.join_deep_edge(
                self.transform_base_edge(e6, s),
                self.syms[s].transform(false, 1, extra),
            )
        }
    }

    #[inline]
    fn canonical_edge(&self, row: usize, edge: u32) -> u32 {
        let mut bits = self.fixed[row] & !1;
        let mut best = edge;
        while bits != 0 {
            let s = bits.trailing_zeros() as usize;
            bits &= bits - 1;
            best = best.min(self.transform_edge(edge, s));
        }
        best
    }

    #[inline]
    pub fn index(&self, state: JointState) -> u64 {
        let row = self.corner_to_row[state.corner as usize] as usize;
        let edge = self.transform_edge(
            state.edge,
            self.corner_to_sym[state.corner as usize] as usize,
        );
        row as u64 * self.kind.spec().edge_states as u64 + self.canonical_edge(row, edge) as u64
    }

    #[inline]
    fn canonical_index(&self, index: u64) -> bool {
        let width = self.kind.spec().edge_states as u64;
        let row = (index / width) as usize;
        let edge = (index % width) as u32;
        self.canonical_edge(row, edge) == edge
    }

    pub fn root(&self, moves: &[u8]) -> JointState {
        let (cl, el) = self.kind.labels();
        let mut c = [0u8; 4];
        let mut e = [0u8; 7];
        for (i, &l) in cl.iter().enumerate() {
            c[i] = 3 * l;
        }
        for (i, &l) in el.iter().enumerate() {
            e[i] = 2 * l;
        }
        let cm = piece_moves(true);
        let em = piece_moves(false);
        for &m in moves {
            for code in &mut c[..cl.len()] {
                *code = cm[*code as usize][m as usize];
            }
            for code in &mut e[..el.len()] {
                *code = em[*code as usize][m as usize];
            }
        }
        let edge = if self.kind == JointKind::MiddleFour {
            rank(&e[..4], 2, 12)
        } else {
            self.join_deep_edge(rank(&e[..6], 2, 12), e[6])
        };
        JointState {
            corner: rank(&c[..cl.len()], 3, 8),
            edge,
        }
    }
}

fn coordinates(kind: JointKind) -> Arc<JointCoordinates> {
    static M: OnceLock<Arc<JointCoordinates>> = OnceLock::new();
    static D: OnceLock<Arc<JointCoordinates>> = OnceLock::new();
    (if kind == JointKind::MiddleFour {
        &M
    } else {
        &D
    })
    .get_or_init(|| Arc::new(JointCoordinates::new(kind)))
    .clone()
}

fn require_existing_moves(kind: JointKind) -> io::Result<()> {
    let (name, entries) = match kind {
        JointKind::MiddleFour => ("mt_edge4.bin", 190080u64 * 24),
        JointKind::DeepSeven => ("mt_edge6.bin", 42577920u64 * 18),
    };
    let file = File::open(move_tables::table_path(name))?;
    if file.metadata()?.len() != 12 + entries * 4 {
        return Err(error(
            "Stage PDB requires an existing move table of the expected size",
        ));
    }
    Ok(())
}

pub struct JointGraph {
    pub coordinates: Arc<JointCoordinates>,
    edge_moves: Arc<MoveTable>,
}
impl JointGraph {
    /// Called only by a protected generator or an explicitly enabled native solver.
    pub fn new(kind: JointKind) -> Self {
        require_existing_moves(kind)
            .expect("stage computation never generates a missing move table");
        let coordinates = coordinates(kind);
        let mt = move_tables::instance();
        let edge_moves = if kind == JointKind::MiddleFour {
            mt.ensure_edge4()
        } else {
            mt.ensure_edge6()
        };
        Self {
            coordinates,
            edge_moves,
        }
    }
    #[inline]
    fn edge_step(&self, edge: u32, m: usize) -> u32 {
        if self.coordinates.kind == JointKind::MiddleFour {
            self.edge_moves.as_u32()[edge as usize * 24 + m] / 24
        } else {
            let (e6, e1) = self.coordinates.split_deep_edge(edge);
            self.coordinates.join_deep_edge(
                self.edge_moves.as_u32()[e6 as usize * 18 + m],
                piece_moves(false)[e1 as usize][m],
            )
        }
    }
    #[inline]
    pub fn step(&self, state: JointState, m: usize) -> JointState {
        JointState {
            corner: self.coordinates.corner_moves[state.corner as usize * 18 + m],
            edge: self.edge_step(state.edge, m),
        }
    }
    #[inline]
    fn next(&self, index: u64, m: usize) -> u64 {
        let width = self.coordinates.kind.spec().edge_states as u64;
        let row = (index / width) as usize;
        let edge = (index % width) as u32;
        let cs = self.coordinates.corner_steps[row * 18 + m];
        let moved = self.edge_step(edge, m);
        let transformed = self.coordinates.transform_edge(moved, cs.symmetry as usize);
        cs.row as u64 * width
            + self
                .coordinates
                .canonical_edge(cs.row as usize, transformed) as u64
    }
}

#[derive(Clone, Debug)]
pub struct GenerationOptions {
    pub threads: usize,
    /// Exact layers retained. Unseen cells are returned as this value + 1, never blindly as 15.
    pub max_depth: u8,
    /// Upper bound on transitions in this invocation; checked before each entire layer.
    pub max_transitions: u64,
    /// Reopen an explicitly chosen checkpoint; no automatic retry after a resource stop.
    pub resume: bool,
}
impl Default for GenerationOptions {
    fn default() -> Self {
        Self {
            threads: 1,
            max_depth: 14,
            max_transitions: 0,
            resume: false,
        }
    }
}

#[derive(Clone, Debug)]
pub struct GenerationProgress {
    pub completed_depth: u8,
    pub reached: u64,
    pub frontier: u64,
    pub transitions: u64,
    pub backwards: bool,
}
#[derive(Clone, Debug)]
pub struct GenerationReport {
    pub completed_depth: u8,
    pub reached: u64,
    pub full: bool,
    pub reason: &'static str,
    pub transitions: u64,
    pub checksum: u64,
}

#[derive(Clone)]
struct Checkpoint {
    generation: u64,
    depth: u8,
    ready: bool,
    full: bool,
    hash: u64,
    histogram: [u64; 15],
}
fn error(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}
fn mix(hash: u64, value: u64) -> u64 {
    (hash ^ value).wrapping_mul(0x100000001b3)
}
fn word_hash(words: &[AtomicU64]) -> u64 {
    words
        .iter()
        .fold(0xcbf29ce484222325, |h, w| mix(h, w.load(Ordering::Relaxed)))
}

fn encode_record(kind: JointKind, c: &Checkpoint) -> [u8; RECORD] {
    let spec = kind.spec();
    let mut values = vec![
        FORMAT,
        kind.id(),
        spec.corner_rows as u64,
        spec.edge_states as u64,
        spec.canonical_states,
        c.generation,
        c.depth as u64,
        c.ready as u64,
        c.full as u64,
        c.hash,
    ];
    values.extend(c.histogram);
    let mut bytes = [0u8; RECORD];
    bytes[..8].copy_from_slice(MAGIC);
    for (i, &v) in values.iter().enumerate() {
        bytes[8 + i * 8..16 + i * 8].copy_from_slice(&v.to_le_bytes());
    }
    let h = bytes[..RECORD - 8]
        .chunks_exact(8)
        .fold(0xcbf29ce484222325, |h, b| {
            mix(h, u64::from_le_bytes(b.try_into().unwrap()))
        });
    bytes[RECORD - 8..].copy_from_slice(&h.to_le_bytes());
    bytes
}
fn decode_record(bytes: &[u8], kind: JointKind) -> Option<Checkpoint> {
    if bytes.len() != RECORD || &bytes[..8] != MAGIC {
        return None;
    }
    let value = |i: usize| u64::from_le_bytes(bytes[8 + i * 8..16 + i * 8].try_into().unwrap());
    let spec = kind.spec();
    let h = bytes[..RECORD - 8]
        .chunks_exact(8)
        .fold(0xcbf29ce484222325, |h, b| {
            mix(h, u64::from_le_bytes(b.try_into().unwrap()))
        });
    if h != u64::from_le_bytes(bytes[RECORD - 8..].try_into().unwrap())
        || value(0) != FORMAT
        || value(1) != kind.id()
        || value(2) != spec.corner_rows as u64
        || value(3) != spec.edge_states as u64
        || value(4) != spec.canonical_states
        || value(6) > 14
        || value(7) > 1
        || value(8) > 1
    {
        return None;
    }
    let histogram = std::array::from_fn(|i| value(10 + i));
    let reached = histogram.iter().try_fold(0u64, |a, &v| a.checked_add(v))?;
    if histogram[0] != 1
        || reached > spec.canonical_states
        || histogram[value(6) as usize + 1..].iter().any(|&v| v != 0)
        || (value(8) == 1 && reached != spec.canonical_states)
    {
        return None;
    }
    Some(Checkpoint {
        generation: value(5),
        depth: value(6) as u8,
        ready: value(7) == 1,
        full: value(8) == 1,
        hash: value(9),
        histogram,
    })
}
fn read_checkpoint(bytes: &[u8], kind: JointKind) -> io::Result<Checkpoint> {
    [0, RECORD]
        .into_iter()
        .filter_map(|offset| decode_record(&bytes[offset..offset + RECORD], kind))
        .max_by_key(|c| c.generation)
        .ok_or_else(|| error("No valid stage table checkpoint record"))
}
fn save_checkpoint(
    file: &mut File,
    map: &MmapMut,
    kind: JointKind,
    c: &Checkpoint,
) -> io::Result<()> {
    // Anonymous table stays resident once. Sequential writes replace the same
    // checkpoint payload; no second table-sized byte buffer or snapshot file.
    file.seek(SeekFrom::Start(HEADER as u64))?;
    for chunk in map[HEADER..].chunks(1 << 20) {
        file.write_all(chunk)?;
    }
    file.sync_all()?;
    file.seek(SeekFrom::Start((c.generation as usize % 2 * RECORD) as u64))?;
    file.write_all(&encode_record(kind, c))?;
    file.sync_all()
}

#[inline]
fn matching(word: u64, depth: u8) -> u64 {
    let x = word ^ (depth as u64 * LANES);
    !(x | (x >> 1) | (x >> 2) | (x >> 3)) & LANES
}
#[inline]
fn get(words: &[AtomicU64], index: u64) -> u8 {
    ((words[index as usize / 16].load(Ordering::Relaxed) >> (index % 16 * 4)) & 15) as u8
}
#[inline]
fn discover(words: &[AtomicU64], index: u64, depth: u8) -> bool {
    let shift = index % 16 * 4;
    let mask = 15 << shift;
    let w = &words[index as usize / 16];
    let mut old = w.load(Ordering::Relaxed);
    loop {
        if old & mask != mask {
            return false;
        }
        let next = (old & !mask) | ((depth as u64) << shift);
        match w.compare_exchange_weak(old, next, Ordering::Relaxed, Ordering::Relaxed) {
            Ok(_) => return true,
            Err(v) => old = v,
        }
    }
}

trait LayerGraph: Sync {
    fn entries(&self) -> u64;
    fn canonical_states(&self) -> u64;
    fn seed(&self) -> u64;
    fn is_canonical(&self, index: u64) -> bool;
    fn successor(&self, index: u64, m: usize) -> u64;
}
impl LayerGraph for JointGraph {
    fn entries(&self) -> u64 {
        self.coordinates.kind.spec().packed_bytes * 2
    }
    fn canonical_states(&self) -> u64 {
        self.coordinates.kind.spec().canonical_states
    }
    fn seed(&self) -> u64 {
        self.coordinates.index(self.coordinates.root(&[]))
    }
    fn is_canonical(&self, index: u64) -> bool {
        self.coordinates.canonical_index(index)
    }
    fn successor(&self, index: u64, m: usize) -> u64 {
        self.next(index, m)
    }
}

fn expand_layer<G: LayerGraph>(
    words: &[AtomicU64],
    graph: &G,
    depth: u8,
    backwards: bool,
) -> (u64, u64) {
    words
        .par_iter()
        .enumerate()
        .map(|(wi, word)| {
            let mut lanes = matching(
                word.load(Ordering::Relaxed),
                if backwards { 15 } else { depth },
            );
            let mut found = 0;
            let mut transitions = 0;
            while lanes != 0 {
                let lane = lanes.trailing_zeros() / 4;
                lanes &= lanes - 1;
                let index = wi as u64 * 16 + lane as u64;
                if index >= graph.entries() {
                    continue;
                }
                if backwards {
                    if !graph.is_canonical(index) {
                        continue;
                    }
                    for m in 0..18 {
                        transitions += 1;
                        if get(words, graph.successor(index, m)) == depth {
                            found += discover(words, index, depth + 1) as u64;
                            break;
                        }
                    }
                } else {
                    for m in 0..18 {
                        transitions += 1;
                        found += discover(words, graph.successor(index, m), depth + 1) as u64;
                    }
                }
            }
            (found, transitions)
        })
        .reduce(|| (0, 0), |a, b| (a.0 + b.0, a.1 + b.1))
}

/// Discard only writes from an interrupted next layer, then validate the previous
/// durable boundary. This permits an in-place checkpoint without a second table.
fn restore_boundary(words: &[AtomicU64], c: &Checkpoint) -> io::Result<()> {
    for word in words {
        let old = word.load(Ordering::Relaxed);
        let mut value = old;
        for lane in 0..16 {
            let v = ((old >> (lane * 4)) & 15) as u8;
            if v == c.depth + 1 && v < 15 {
                value |= 15u64 << (lane * 4);
            } else if v > c.depth && v != 15 {
                return Err(error("Stage checkpoint contains a future layer"));
            }
        }
        if old != value {
            word.store(value, Ordering::Relaxed);
        }
    }
    if word_hash(words) != c.hash {
        return Err(error("Stage checkpoint checksum mismatch"));
    }
    let mut histogram = [0u64; 15];
    for word in words {
        let w = word.load(Ordering::Relaxed);
        for lane in 0..16 {
            let v = ((w >> (lane * 4)) & 15) as usize;
            if v < 15 {
                histogram[v] += 1;
            }
        }
    }
    if histogram != c.histogram {
        return Err(error("Stage checkpoint histogram mismatch"));
    }
    Ok(())
}

/// Generates only the requested table. Work is budgeted before each layer;
/// `max_transitions=0` is rejected rather than silently running without a bound.
/// An intentional depth cap publishes a valid partial PDB. A work-budget stop
/// keeps the unpublished layer checkpoint for a separately authorized resume.
pub fn generate<F>(
    path: &Path,
    kind: JointKind,
    options: &GenerationOptions,
    mut progress: F,
) -> io::Result<GenerationReport>
where
    F: FnMut(GenerationProgress) -> io::Result<()>,
{
    if options.threads == 0
        || options.threads > 18
        || options.max_depth > 14
        || options.max_transitions == 0
    {
        return Err(error("Stage generation requires 1..18 threads, depth 0..14 and an explicit transition budget"));
    }
    if std::env::var("CUBE_ALLOW_HUGE_TABLES").as_deref() != Ok("1") {
        return Err(error(
            "Protected stage generation requires CUBE_ALLOW_HUGE_TABLES=1",
        ));
    }
    let spec = kind.spec();
    require_existing_moves(kind)?;
    let work = path.with_extension("bin.part");
    if path.exists() {
        return Err(error(
            "Published stage table already exists; preserve it and select a new output path",
        ));
    }
    if work.exists() != options.resume {
        return Err(error(
            "Checkpoint existence and explicit resume flag disagree",
        ));
    }
    let mut file = OpenOptions::new()
        .read(true)
        .write(true)
        .create_new(!options.resume)
        .open(&work)?;
    let file_bytes = HEADER as u64 + spec.packed_bytes;
    if !options.resume {
        file.set_len(file_bytes)?;
    } else if file.metadata()?.len() != file_bytes {
        return Err(error("Stage checkpoint length mismatch"));
    }
    let mut map = MmapMut::map_anon(file_bytes as usize)?;
    if options.resume {
        file.seek(SeekFrom::Start(0))?;
        for chunk in map.chunks_mut(1 << 20) {
            file.read_exact(chunk)?;
        }
    } else {
        map[HEADER..].fill(0xff);
    }
    // Anonymous pages and HEADER are naturally AtomicU64-aligned. All concurrent data
    // access below is atomic; byte access occurs only before/after the workers.
    let words = unsafe {
        std::slice::from_raw_parts(
            map.as_ptr().add(HEADER) as *const AtomicU64,
            spec.packed_bytes as usize / 8,
        )
    };
    let graph = JointGraph::new(kind);
    let mut c = if options.resume {
        let c = read_checkpoint(&map[..HEADER], kind)?;
        restore_boundary(words, &c)?;
        c
    } else {
        discover(words, graph.seed(), 0);
        let mut h = [0; 15];
        h[0] = 1;
        Checkpoint {
            generation: 0,
            depth: 0,
            ready: false,
            full: false,
            hash: word_hash(words),
            histogram: h,
        }
    };
    if c.ready {
        return Err(error(
            "Published-ready checkpoint must be reviewed before further computation",
        ));
    }
    if options.max_depth < c.depth {
        return Err(error("Requested depth precedes the durable checkpoint"));
    }
    save_checkpoint(&mut file, &map, kind, &c)?;
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(options.threads)
        .build()
        .map_err(io::Error::other)?;
    let mut transitions = 0u64;
    let mut reason = "depth-cap";
    while c.depth < options.max_depth {
        let reached = c.histogram.iter().sum::<u64>();
        let frontier = c.histogram[c.depth as usize];
        let remaining = graph.canonical_states() - reached;
        if remaining == 0 {
            c.full = true;
            reason = "full";
            break;
        }
        // Reverse expansion stops at its first predecessor, making the late
        // layers substantially cheaper than frontier * 18 successor visits.
        let backwards = remaining < frontier;
        let estimate = if backwards { remaining } else { frontier }.saturating_mul(18);
        if transitions.saturating_add(estimate) > options.max_transitions {
            reason = "work-limit";
            break;
        }
        progress(GenerationProgress {
            completed_depth: c.depth,
            reached,
            frontier,
            transitions,
            backwards,
        })?;
        let (produced, actual) = pool.install(|| expand_layer(words, &graph, c.depth, backwards));
        transitions += actual;
        if produced == 0 {
            if reached != graph.canonical_states() {
                return Err(error(
                    "Stage graph exhausted before its certified orbit count",
                ));
            }
            c.full = true;
            reason = "full";
            break;
        }
        c.depth += 1;
        c.histogram[c.depth as usize] = produced;
        c.generation += 1;
        c.hash = word_hash(words);
        if c.histogram.iter().sum::<u64>() > graph.canonical_states() {
            return Err(error("Stage BFS exceeded its canonical orbit count"));
        }
        save_checkpoint(&mut file, &map, kind, &c)?;
    }
    c.full = c.histogram.iter().sum::<u64>() == graph.canonical_states();
    if c.full {
        reason = "full";
    }
    let report = GenerationReport {
        completed_depth: c.depth,
        reached: c.histogram.iter().sum(),
        full: c.full,
        reason,
        transitions,
        checksum: c.hash,
    };
    // A work-budget stop is resumable, not an accepted new artifact. An explicit
    // max_depth cap, on the other hand, intentionally publishes a partial PDB.
    if reason == "work-limit" {
        return Ok(report);
    }
    c.ready = true;
    c.generation += 1;
    // Payload is already durable at the last layer boundary; only commit the
    // small publication record rather than writing the whole table twice.
    file.seek(SeekFrom::Start((c.generation as usize % 2 * RECORD) as u64))?;
    file.write_all(&encode_record(kind, &c))?;
    file.sync_all()?;
    drop(map);
    drop(file);
    std::fs::rename(&work, path)?;
    Ok(report)
}

/// Full streaming checksum verification, without mapping or copying the table.
pub fn verify_file(path: &Path, kind: JointKind) -> io::Result<GenerationReport> {
    let mut file = File::open(path)?;
    if file.metadata()?.len() != HEADER as u64 + kind.spec().packed_bytes {
        return Err(error("Stage table length mismatch"));
    }
    let mut header = [0u8; HEADER];
    file.read_exact(&mut header)?;
    let c = read_checkpoint(&header, kind)?;
    if !c.ready {
        return Err(error("Stage table is not published-ready"));
    }
    let mut bytes = vec![0u8; 1 << 20];
    let mut remaining = kind.spec().packed_bytes;
    let mut hash = 0xcbf29ce484222325;
    while remaining != 0 {
        let n = (remaining as usize).min(bytes.len());
        file.read_exact(&mut bytes[..n])?;
        for word in bytes[..n].chunks_exact(8) {
            hash = mix(hash, u64::from_le_bytes(word.try_into().unwrap()));
        }
        remaining -= n as u64;
    }
    if hash != c.hash {
        return Err(error("Stage table checksum mismatch"));
    }
    Ok(GenerationReport {
        completed_depth: c.depth,
        reached: c.histogram.iter().sum(),
        full: c.full,
        reason: "verified",
        transitions: 0,
        checksum: hash,
    })
}

pub struct JointPdb {
    pub graph: JointGraph,
    map: Mmap,
    checkpoint: Checkpoint,
}

fn project_diagonal_distance(
    corner: u32,
    edge6: u32,
    mut bound: impl FnMut(JointState) -> u32,
) -> u32 {
    (0..12)
        .map(|residual| {
            bound(JointState {
                corner,
                edge: edge6 * 12 + residual,
            })
        })
        .min()
        .unwrap()
}

impl JointPdb {
    pub fn load_existing(path: &Path, kind: JointKind) -> io::Result<Self> {
        require_existing_moves(kind)?;
        let file = File::open(path)?;
        if file.metadata()?.len() != HEADER as u64 + kind.spec().packed_bytes {
            return Err(error("Stage table file length mismatch"));
        }
        let map = unsafe { Mmap::map(&file)? };
        let checkpoint = read_checkpoint(&map[..HEADER], kind)?;
        if !checkpoint.ready {
            return Err(error("Stage table is an unpublished checkpoint"));
        }
        let graph = JointGraph::new(kind);
        Ok(Self {
            graph,
            map,
            checkpoint,
        })
    }
    #[inline]
    pub fn bound(&self, state: JointState) -> u32 {
        let index = self.graph.coordinates.index(state) as usize;
        let value = (self.map[HEADER + index / 2] >> ((index & 1) * 4)) & 15;
        if value == 15 {
            self.checkpoint.depth as u32 + 1
        } else {
            value as u32
        }
    }

    /// Recover the exact C2 x E6 diagonal distance by minimizing over every
    /// legal position/orientation of E1. Every coarse solution has a completion
    /// that also solves E1. The certified coarse diameter is 12, so retaining
    /// those exact layers suffices even if deeper DeepSeven layers are capped.
    pub fn diagonal_distance(&self, corner: u32, edge6: u32) -> u32 {
        assert_eq!(self.graph.coordinates.kind, JointKind::DeepSeven);
        assert!(
            self.completed_depth() >= 12,
            "diagonal projection requires depth >= 12"
        );
        let distance = project_diagonal_distance(corner, edge6, |state| self.bound(state));
        assert!(
            distance <= 12,
            "DeepSeven diagonal projection exceeds the certified diameter"
        );
        distance
    }
    pub fn completed_depth(&self) -> u8 {
        self.checkpoint.depth
    }
    pub fn is_full(&self) -> bool {
        self.checkpoint.full
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum JointMode {
    Off,
    Middle,
    Deep,
    Both,
}

impl JointMode {
    fn includes(self, kind: JointKind) -> bool {
        match self {
            Self::Off => false,
            Self::Middle => kind == JointKind::MiddleFour,
            Self::Deep => kind == JointKind::DeepSeven,
            Self::Both => true,
        }
    }
}

fn selected_mode(explicit: Option<&str>, default: JointMode) -> Result<JointMode, &'static str> {
    match explicit {
        None => Ok(default),
        Some("off") => Ok(JointMode::Off),
        Some("middle") => Ok(JointMode::Middle),
        Some("deep") => Ok(JointMode::Deep),
        Some("both") => Ok(JointMode::Both),
        Some(_) => Err("CUBE_STAGE_JOINT_MODE must be off|middle|deep|both"),
    }
}

/// Each native consumer selects its accepted default; an explicit environment
/// mode overrides it. Loading never falls back to generating a missing table.
pub fn enabled_table(kind: JointKind, default: JointMode) -> Option<Arc<JointPdb>> {
    if !cfg!(feature = "stage-joint-table") {
        return None;
    }
    let explicit = match std::env::var("CUBE_STAGE_JOINT_MODE") {
        Ok(value) => Some(value),
        Err(std::env::VarError::NotPresent) => None,
        Err(_) => panic!("CUBE_STAGE_JOINT_MODE must contain valid Unicode"),
    };
    let mode =
        selected_mode(explicit.as_deref(), default).unwrap_or_else(|error| panic!("{error}"));
    if !mode.includes(kind) {
        return None;
    }
    static M: OnceLock<Arc<JointPdb>> = OnceLock::new();
    static D: OnceLock<Arc<JointPdb>> = OnceLock::new();
    Some(
        (if kind == JointKind::MiddleFour {
            &M
        } else {
            &D
        })
        .get_or_init(|| {
            Arc::new(
                JointPdb::load_existing(&move_tables::table_path(kind.spec().filename), kind)
                    .expect("explicit stage PDB must already be generated and published"),
            )
        })
        .clone(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cube_common::INV_MOVE;

    #[test]
    fn consumer_defaults_and_explicit_stage_modes_are_separate() {
        assert_eq!(
            selected_mode(None, JointMode::Middle),
            Ok(JointMode::Middle)
        );
        assert_eq!(selected_mode(None, JointMode::Off), Ok(JointMode::Off));
        assert!(JointMode::Middle.includes(JointKind::MiddleFour));
        assert!(!JointMode::Middle.includes(JointKind::DeepSeven));
        for default in [JointMode::Off, JointMode::Middle] {
            for (text, expected) in [
                ("off", JointMode::Off),
                ("middle", JointMode::Middle),
                ("deep", JointMode::Deep),
                ("both", JointMode::Both),
            ] {
                assert_eq!(selected_mode(Some(text), default), Ok(expected));
                for kind in [JointKind::MiddleFour, JointKind::DeepSeven] {
                    assert_eq!(
                        expected.includes(kind),
                        text == "both"
                            || (text == "middle" && kind == JointKind::MiddleFour)
                            || (text == "deep" && kind == JointKind::DeepSeven)
                    );
                }
            }
            assert!(selected_mode(Some(""), default).is_err());
            assert!(selected_mode(Some("all"), default).is_err());
        }
    }

    fn slow_step(c: &JointCoordinates, state: JointState, m: usize) -> JointState {
        let (cl, el) = c.kind.labels();
        let mut corner = [0u8; 4];
        let mut edge = [0u8; 7];
        unrank(state.corner, &mut corner[..cl.len()], 3, 8);
        if c.kind == JointKind::MiddleFour {
            unrank(state.edge, &mut edge[..4], 2, 12);
        } else {
            let (e6, e1) = c.split_deep_edge(state.edge);
            unrank(e6, &mut edge[..6], 2, 12);
            edge[6] = e1;
        }
        for v in &mut corner[..cl.len()] {
            *v = piece_moves(true)[*v as usize][m];
        }
        for v in &mut edge[..el.len()] {
            *v = piece_moves(false)[*v as usize][m];
        }
        JointState {
            corner: rank(&corner[..cl.len()], 3, 8),
            edge: if c.kind == JointKind::MiddleFour {
                rank(&edge[..4], 2, 12)
            } else {
                c.join_deep_edge(rank(&edge[..6], 2, 12), edge[6])
            },
        }
    }
    fn representative(c: &JointCoordinates, index: u64) -> JointState {
        let width = c.kind.spec().edge_states as u64;
        JointState {
            corner: c.representatives[(index / width) as usize],
            edge: (index % width) as u32,
        }
    }

    #[test]
    fn diagonal_projection_matches_independent_coarse_bfs_through_depth_three() {
        use std::collections::{HashMap, VecDeque};
        let c = JointCoordinates::new(JointKind::DeepSeven);
        let goal = c.root(&[]);
        let bfs = |coarse: bool| {
            let start = (goal.corner, if coarse { goal.edge / 12 } else { goal.edge });
            let mut distances = HashMap::from([(start, 0u32)]);
            let mut queue = VecDeque::from([start]);
            while let Some((corner, edge)) = queue.pop_front() {
                let depth = distances[&(corner, edge)];
                if depth == 3 {
                    continue;
                }
                for m in 0..18 {
                    let next = slow_step(
                        &c,
                        JointState {
                            corner,
                            edge: if coarse { edge * 12 } else { edge },
                        },
                        m,
                    );
                    let key = (next.corner, if coarse { next.edge / 12 } else { next.edge });
                    if let std::collections::hash_map::Entry::Vacant(entry) = distances.entry(key) {
                        entry.insert(depth + 1);
                        queue.push_back(key);
                    }
                }
            }
            distances
        };
        let deep = bfs(false);
        let coarse = bfs(true);
        let bound = |state: JointState| *deep.get(&(state.corner, state.edge)).unwrap_or(&4);
        for (&(corner, edge6), &distance) in &coarse {
            assert_eq!(project_diagonal_distance(corner, edge6, bound), distance);
        }
        // Flipping tracked E1 (and an untracked edge in a legal completion)
        // leaves the old diagonal goal solved but makes the actual Deep goal
        // unsolved. Its bound cannot replace XXCross distance without projection.
        let extra_flipped = JointState {
            corner: goal.corner,
            edge: goal.edge ^ 1,
        };
        assert!(bound(extra_flipped) > 0);
        assert_eq!(
            project_diagonal_distance(extra_flipped.corner, extra_flipped.edge / 12, bound),
            0
        );
    }

    #[test]
    fn stage_coordinates_preserve_goal_moves_and_stabilizer_aliases() {
        for kind in [JointKind::MiddleFour, JointKind::DeepSeven] {
            let c = JointCoordinates::new(kind);
            let goal = c.root(&[]);
            let mut current = goal;
            assert_eq!(c.representatives.len(), kind.spec().corner_rows);
            for s in 0..c.syms.len() {
                assert_eq!(
                    c.index(JointState {
                        corner: transform_coordinate(
                            &c.syms[s],
                            true,
                            kind.labels().0,
                            goal.corner
                        ),
                        edge: c.transform_edge(goal.edge, s)
                    }),
                    c.index(goal)
                );
            }
            for seed in 0..48 {
                let m = (seed * 7 + 3) % 18;
                let next = slow_step(&c, current, m);
                assert_eq!(slow_step(&c, next, INV_MOVE[m] as usize), current);
                current = next;
                let index = c.index(current);
                let canon = representative(&c, index);
                assert_eq!(c.index(canon), index);
                let mut a: Vec<u64> = (0..18)
                    .map(|m| c.index(slow_step(&c, current, m)))
                    .collect();
                let mut b: Vec<u64> = (0..18).map(|m| c.index(slow_step(&c, canon, m))).collect();
                a.sort_unstable();
                b.sort_unstable();
                assert_eq!(a, b, "quotient successor set differs");
                let width = kind.spec().edge_states as u64;
                let row = (index / width) as usize;
                for m in 0..18 {
                    let cs = c.corner_steps[row * 18 + m];
                    let moved = slow_step(&c, canon, m);
                    let transformed = c.transform_edge(moved.edge, cs.symmetry as usize);
                    let fast = cs.row as u64 * width
                        + c.canonical_edge(cs.row as usize, transformed) as u64;
                    assert_eq!(
                        fast,
                        c.index(moved),
                        "factored canonical transition differs"
                    );
                }
                for s in 0..c.syms.len() {
                    assert_eq!(
                        c.index(JointState {
                            corner: transform_coordinate(
                                &c.syms[s],
                                true,
                                kind.labels().0,
                                current.corner
                            ),
                            edge: c.transform_edge(current.edge, s)
                        }),
                        index
                    );
                }
                if kind == JointKind::DeepSeven {
                    let (e6, e1) = c.split_deep_edge(current.edge);
                    assert_eq!(c.join_deep_edge(e6, e1), current.edge);
                }
            }
        }
    }

    struct Tiny;
    impl LayerGraph for Tiny {
        fn entries(&self) -> u64 {
            64
        }
        fn canonical_states(&self) -> u64 {
            32
        }
        fn seed(&self) -> u64 {
            0
        }
        fn is_canonical(&self, i: u64) -> bool {
            i % 2 == 0
        }
        fn successor(&self, i: u64, m: usize) -> u64 {
            (i as i64
                + if m % 2 == 0 {
                    2 * (m as i64 / 2 + 1)
                } else {
                    -2 * (m as i64 / 2 + 1)
                })
            .rem_euclid(64) as u64
        }
    }
    #[test]
    fn packed_forward_reverse_and_interrupted_layer_match_byte_bfs() {
        let graph = Tiny;
        let words: Vec<AtomicU64> = (0..4).map(|_| AtomicU64::new(u64::MAX)).collect();
        discover(&words, 0, 0);
        let mut expected = [15u8; 64];
        expected[0] = 0;
        let mut frontier = vec![0u64];
        let mut histogram = [0u64; 15];
        histogram[0] = 1;
        for depth in 0..14u8 {
            let checkpoint = Checkpoint {
                generation: depth as u64,
                depth,
                ready: false,
                full: false,
                hash: word_hash(&words),
                histogram,
            };
            // Partially persisted next-layer writes must be rolled back, including
            // a bogus pending alias. Completed-layer corruption must not pass.
            if depth == 0 {
                discover(&words, 2, 1);
                discover(&words, 3, 1);
                restore_boundary(&words, &checkpoint).unwrap();
                assert_eq!(get(&words, 2), 15);
                assert_eq!(get(&words, 3), 15);
            }
            let mut next = Vec::new();
            for &i in &frontier {
                for m in 0..18 {
                    let n = graph.successor(i, m) as usize;
                    if expected[n] == 15 {
                        expected[n] = depth + 1;
                        next.push(n as u64);
                    }
                }
            }
            let (count, transitions) = expand_layer(&words, &graph, depth, depth % 2 == 1);
            if depth % 2 == 0 {
                assert_eq!(transitions, frontier.len() as u64 * 18);
            } else {
                assert!(
                    transitions <= (graph.canonical_states() - histogram.iter().sum::<u64>()) * 18
                );
            }
            assert_eq!(count, next.len() as u64);
            for i in 0..64 {
                assert_eq!(get(&words, i as u64), expected[i]);
            }
            if next.is_empty() {
                break;
            }
            histogram[depth as usize + 1] = count;
            frontier = next;
        }
        let checkpoint = Checkpoint {
            generation: 1,
            depth: 4,
            ready: false,
            full: true,
            hash: word_hash(&words),
            histogram,
        };
        words[0].fetch_xor(1, Ordering::Relaxed);
        assert!(restore_boundary(&words, &checkpoint).is_err());
    }
    #[test]
    fn checkpoint_records_reject_torn_metadata_and_wrong_target() {
        let mut h = [0; 15];
        h[0] = 1;
        let a = Checkpoint {
            generation: 4,
            depth: 0,
            ready: false,
            full: false,
            hash: 42,
            histogram: h,
        };
        let mut b = a.clone();
        b.generation = 5;
        let mut header = [0u8; HEADER];
        header[..RECORD].copy_from_slice(&encode_record(JointKind::MiddleFour, &a));
        header[RECORD..2 * RECORD].copy_from_slice(&encode_record(JointKind::MiddleFour, &b));
        assert_eq!(
            read_checkpoint(&header, JointKind::MiddleFour)
                .unwrap()
                .generation,
            5
        );
        header[RECORD + 90] ^= 1;
        assert_eq!(
            read_checkpoint(&header, JointKind::MiddleFour)
                .unwrap()
                .generation,
            4
        );
        assert!(read_checkpoint(&header, JointKind::DeepSeven).is_err());
    }

    #[test]
    fn native_stage_targets_are_subsets_of_their_search_goals() {
        let (mc, me) = JointKind::MiddleFour.labels();
        assert!(mc.iter().all(|c| [4, 5, 6, 7].contains(c)));
        assert!(
            me.iter().all(|e| [0, 1, 2, 3, 9, 11].contains(e)),
            "MiddleFour must be an F2B subgoal"
        );
        let (dc, de) = JointKind::DeepSeven.labels();
        for missing in 0..4 {
            let view = (missing + 1) % 4;
            let symmetry = crate::stage_symmetry::all_symmetries()
                .iter()
                .find(|s| {
                    (0..18).all(|m| s.moves[m] == crate::cube_common::conj_moves_flat()[m][view])
                })
                .unwrap();
            let inverse_corner =
                |target: u8| symmetry.corners.iter().position(|&v| v == target).unwrap() as u8;
            let inverse_edge =
                |target: u8| symmetry.edges.iter().position(|&v| v == target).unwrap() as u8;
            assert!(dc.iter().all(|&c| inverse_corner(c) != 4 + missing as u8));
            assert!(de.iter().all(|&e| inverse_edge(e) != missing as u8));
            assert!(de.iter().all(|&e| {
                let t = inverse_edge(e);
                t < 4 || t >= 8
            }));
        }
    }
}
