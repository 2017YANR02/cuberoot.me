//! Exact HTM diameter proof for the 3x3 First Layer target.
//!
//! This is an offline/native-only computation.  It enumerates all
//! P(8,4)*3^4 * P(12,4)*2^4 = 25,866,086,400 labelled partial states with the
//! two-bit frontier BFS in `dist::packed2`; it never builds or retains a full
//! byte/nibble distance table.  The browser does not load this code or table.
//! The same layer scan counts the exact conditional distribution for states
//! whose D cross is already solved.
//!
//! Safety gates:
//! - the computed peak plan is checked against a hard 25 GB cap;
//! - at most 14 Rayon threads;
//! - a real run requires `CUBE_ALLOW_HUGE_TABLES=1`;
//! - `--dry-run` prints the exact resource plan without allocating the table.
//! - checksummed A/B snapshots resume only at completed layer boundaries.

use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{BufWriter, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

use cube_solver::cube_common::{
    array_to_index, create_multi_move_table, state_space, Move, State, INV_MOVE,
};
#[cfg(test)]
use cube_solver::dist::packed2::bfs_multi_packed2_exact;
use cube_solver::dist::packed2::{
    bfs_multi_packed2_exact_resumable, packed2_product_bytes, ExactBfsProof, Packed2Resume,
    Packed2Snapshot, ScanProgress,
};
use cube_solver::first_layer_solver::{
    FirstLayerSolver, CORNER4, FIRST_LAYER_STATES, FIRST_LAYER_UPPER_BOUND,
};

const TRACKED_CORNERS: [i32; 4] = [4, 5, 6, 7];
const TRACKED_EDGES: [i32; 4] = [8, 9, 10, 11];
const MAX_THREADS: usize = 14;
/// Decimal gigabytes: honour the user's ceiling conservatively rather than
/// treating 25 GB as 25 GiB.
const MEMORY_CAP_BYTES: u64 = 25_000_000_000;
/// Covers the two move tables, their tiny single-piece sources, Rayon stacks,
/// allocator metadata and progress/result buffers.  The proof verifier is
/// constructed only after the frontier table has been dropped.
const NON_FRONTIER_RESERVE_BYTES: u64 = 512 * 1024 * 1024;
const CHECKPOINT_HEADER_BYTES: usize = 4096;
const CHECKPOINT_MAX_HISTOGRAM: usize = 64;
const CHECKPOINT_IO_WORDS: usize = 1 << 20;
const CHECKPOINT_MAGIC: &[u8; 8] = b"FLGODCP1";
const CHECKPOINT_VERSION: u32 = 1;
const CHECKPOINT_COMMITTED: u32 = 0xC0DE_C0DE;
const DEFAULT_CHECKPOINT_DIR: &str = "checkpoints/first-layer-god";
/// Recomputing the tiny opening layers is cheaper than writing 6.47 GB of
/// mostly-zero checkpoint data after each one.
const CHECKPOINT_MIN_STATES: u64 = 1_000_000;

#[derive(Clone, Debug)]
struct Args {
    dry_run: bool,
    threads: usize,
    checkpoint_dir: PathBuf,
    checkpoint_every: u32,
}

#[derive(Clone, Copy, Debug)]
struct MemoryPlan {
    frontier_bytes: u64,
    corner_moves_bytes: u64,
    edge_moves_bytes: u64,
    reserve_bytes: u64,
    peak_budget_bytes: u64,
    checkpoint_slot_bytes: u64,
    checkpoint_disk_bytes: u64,
}

fn parse_args() -> Result<Args, String> {
    let mut dry_run = false;
    let default_threads = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
        .min(MAX_THREADS);
    let mut threads = env::var("RAYON_NUM_THREADS")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(default_threads);
    let mut checkpoint_dir = PathBuf::from(DEFAULT_CHECKPOINT_DIR);
    let mut checkpoint_every = 1u32;

    let mut it = env::args().skip(1);
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--dry-run" => dry_run = true,
            "--threads" => {
                let raw = it
                    .next()
                    .ok_or_else(|| "--threads requires a value".to_owned())?;
                threads = raw
                    .parse::<usize>()
                    .map_err(|_| format!("invalid --threads value: {raw}"))?;
            }
            "--checkpoint-dir" => {
                checkpoint_dir = PathBuf::from(
                    it.next()
                        .ok_or_else(|| "--checkpoint-dir requires a path".to_owned())?,
                );
            }
            "--checkpoint-every" => {
                let raw = it
                    .next()
                    .ok_or_else(|| "--checkpoint-every requires a value".to_owned())?;
                checkpoint_every = raw
                    .parse::<u32>()
                    .map_err(|_| format!("invalid --checkpoint-every value: {raw}"))?;
            }
            "-h" | "--help" => {
                println!(
                    "first_layer_gods_number [--dry-run] [--threads N] \\\n+                     [--checkpoint-dir PATH] [--checkpoint-every N]\n\
                     full run also requires CUBE_ALLOW_HUGE_TABLES=1"
                );
                std::process::exit(0);
            }
            _ => return Err(format!("unknown argument: {arg}")),
        }
    }
    if threads == 0 || threads > MAX_THREADS {
        return Err(format!(
            "threads must be in 1..={MAX_THREADS}, got {threads}"
        ));
    }
    if checkpoint_every == 0 {
        return Err("checkpoint interval must be at least one layer".to_owned());
    }
    Ok(Args {
        dry_run,
        threads,
        checkpoint_dir,
        checkpoint_every,
    })
}

fn memory_plan() -> Result<MemoryPlan, String> {
    let frontier_bytes = packed2_product_bytes(CORNER4, state_space::CROSS)
        .ok_or_else(|| "First Layer packed2 size overflow".to_owned())?
        as u64;
    let corner_moves_bytes = CORNER4 as u64 * 18 * 4;
    let edge_moves_bytes = state_space::CROSS as u64 * 18 * 4;
    let peak_budget_bytes = frontier_bytes
        .checked_add(corner_moves_bytes)
        .and_then(|v| v.checked_add(edge_moves_bytes))
        .and_then(|v| v.checked_add(NON_FRONTIER_RESERVE_BYTES))
        .ok_or_else(|| "First Layer memory plan overflow".to_owned())?;
    let checkpoint_slot_bytes = frontier_bytes + CHECKPOINT_HEADER_BYTES as u64;
    let checkpoint_disk_bytes = checkpoint_slot_bytes
        .checked_mul(2)
        .ok_or_else(|| "First Layer checkpoint disk plan overflow".to_owned())?;
    Ok(MemoryPlan {
        frontier_bytes,
        corner_moves_bytes,
        edge_moves_bytes,
        reserve_bytes: NON_FRONTIER_RESERVE_BYTES,
        peak_budget_bytes,
        checkpoint_slot_bytes,
        checkpoint_disk_bytes,
    })
}

fn decimal_gb(bytes: u64) -> f64 {
    bytes as f64 / 1_000_000_000.0
}

fn gib(bytes: u64) -> f64 {
    bytes as f64 / 1024.0_f64.powi(3)
}

fn print_plan(plan: MemoryPlan, args: &Args) {
    println!("First Layer exact HTM diameter proof");
    println!("states={FIRST_LAYER_STATES}");
    println!("threads={} (hard max {MAX_THREADS})", args.threads);
    println!(
        "frontier={} bytes ({:.3} GiB, two bits/state)",
        plan.frontier_bytes,
        gib(plan.frontier_bytes)
    );
    println!(
        "move_tables={} bytes ({:.3} GiB)",
        plan.corner_moves_bytes + plan.edge_moves_bytes,
        gib(plan.corner_moves_bytes + plan.edge_moves_bytes)
    );
    println!(
        "runtime_reserve={} bytes ({:.3} GiB)",
        plan.reserve_bytes,
        gib(plan.reserve_bytes)
    );
    println!(
        "hard_peak_budget={} bytes ({:.3} GB / {:.3} GiB)",
        plan.peak_budget_bytes,
        decimal_gb(plan.peak_budget_bytes),
        gib(plan.peak_budget_bytes)
    );
    println!(
        "configured_cap={} bytes ({:.3} GB)",
        MEMORY_CAP_BYTES,
        decimal_gb(MEMORY_CAP_BYTES)
    );
    println!("checkpoint_dir={}", args.checkpoint_dir.display());
    println!("checkpoint_every={} layer(s)", args.checkpoint_every);
    println!("checkpoint_starts_after={CHECKPOINT_MIN_STATES} visited states");
    println!(
        "checkpoint_slots=2 x {} bytes; fixed disk budget={} bytes ({:.3} GiB)",
        plan.checkpoint_slot_bytes,
        plan.checkpoint_disk_bytes,
        gib(plan.checkpoint_disk_bytes)
    );
}

#[derive(Clone, Debug)]
struct CheckpointHeader {
    generation: u64,
    word_count: usize,
    current_colour: u8,
    next_colour: u8,
    next_depth: u32,
    cumulative: u64,
    deepest_state: usize,
    histogram: Vec<u64>,
    selected_b_histogram: Vec<u64>,
    payload_checksum: u64,
}

#[derive(Clone, Copy)]
struct WordChecksum {
    lanes: [u64; 4],
    index: u64,
}

impl WordChecksum {
    fn new() -> Self {
        Self {
            lanes: [
                0x243f_6a88_85a3_08d3,
                0x1319_8a2e_0370_7344,
                0xa409_3822_299f_31d0,
                0x082e_fa98_ec4e_6c89,
            ],
            index: 0,
        }
    }

    fn update(&mut self, words: &[u64]) {
        for &word in words {
            let lane = self.index as usize & 3;
            self.lanes[lane] ^= word.wrapping_add(self.index.wrapping_mul(0x9e37_79b9_7f4a_7c15));
            self.lanes[lane] = self.lanes[lane]
                .rotate_left(17)
                .wrapping_mul(0x94d0_49bb_1331_11eb);
            self.index += 1;
        }
    }

    fn finish(self) -> u64 {
        self.lanes
            .into_iter()
            .enumerate()
            .fold(self.index ^ 0xd6e8_feb8_6659_fd93, |hash, (lane, value)| {
                hash.rotate_left(13 + lane as u32 * 3) ^ value
            })
    }
}

fn header_checksum(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf2_9ce4_8422_2325, |hash, &byte| {
        (hash ^ byte as u64).wrapping_mul(0x0000_0100_0000_01b3)
    })
}

fn put_u32(out: &mut [u8], offset: usize, value: u32) {
    out[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
}

fn put_u64(out: &mut [u8], offset: usize, value: u64) {
    out[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
}

fn get_u32(input: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes(input[offset..offset + 4].try_into().unwrap())
}

fn get_u64(input: &[u8], offset: usize) -> u64 {
    u64::from_le_bytes(input[offset..offset + 8].try_into().unwrap())
}

fn checkpoint_header_bytes(
    generation: u64,
    selected_b: usize,
    snapshot: &Packed2Snapshot<'_>,
    payload_checksum: u64,
) -> Result<[u8; CHECKPOINT_HEADER_BYTES], String> {
    if snapshot.histogram.len() > CHECKPOINT_MAX_HISTOGRAM {
        return Err(format!(
            "checkpoint histogram has {} bins; max is {CHECKPOINT_MAX_HISTOGRAM}",
            snapshot.histogram.len()
        ));
    }
    if snapshot.selected_b_histogram.len() != snapshot.histogram.len() {
        return Err("checkpoint conditional histogram length mismatch".to_owned());
    }
    let mut out = [0u8; CHECKPOINT_HEADER_BYTES];
    out[..8].copy_from_slice(CHECKPOINT_MAGIC);
    put_u32(&mut out, 8, CHECKPOINT_VERSION);
    put_u32(&mut out, 12, CHECKPOINT_COMMITTED);
    put_u64(&mut out, 16, generation);
    put_u64(&mut out, 24, CORNER4 as u64);
    put_u64(&mut out, 32, state_space::CROSS as u64);
    put_u64(&mut out, 40, snapshot.words.len() as u64);
    out[48] = snapshot.current_colour;
    out[49] = snapshot.next_colour;
    put_u32(&mut out, 52, snapshot.next_depth);
    put_u64(&mut out, 56, snapshot.cumulative);
    put_u64(&mut out, 64, snapshot.deepest_state as u64);
    put_u32(&mut out, 72, snapshot.histogram.len() as u32);
    put_u32(&mut out, 76, selected_b as u32);
    put_u64(&mut out, 80, payload_checksum);
    for (index, &count) in snapshot.histogram.iter().enumerate() {
        put_u64(&mut out, 96 + index * 8, count);
    }
    for (index, &count) in snapshot.selected_b_histogram.iter().enumerate() {
        put_u64(
            &mut out,
            96 + CHECKPOINT_MAX_HISTOGRAM * 8 + index * 8,
            count,
        );
    }
    let checksum = header_checksum(&out);
    put_u64(&mut out, 88, checksum);
    Ok(out)
}

fn parse_checkpoint_header(
    path: &Path,
    expected_words: usize,
    selected_b: usize,
) -> Result<CheckpointHeader, String> {
    let mut file =
        File::open(path).map_err(|e| format!("cannot open checkpoint {}: {e}", path.display()))?;
    let expected_len = CHECKPOINT_HEADER_BYTES as u64 + expected_words as u64 * 8;
    let actual_len = file
        .metadata()
        .map_err(|e| format!("cannot stat checkpoint {}: {e}", path.display()))?
        .len();
    if actual_len != expected_len {
        return Err(format!(
            "checkpoint {} size mismatch: got {actual_len}, expected {expected_len}",
            path.display()
        ));
    }
    let mut bytes = [0u8; CHECKPOINT_HEADER_BYTES];
    file.read_exact(&mut bytes)
        .map_err(|e| format!("cannot read checkpoint header {}: {e}", path.display()))?;
    if &bytes[..8] != CHECKPOINT_MAGIC
        || get_u32(&bytes, 8) != CHECKPOINT_VERSION
        || get_u32(&bytes, 12) != CHECKPOINT_COMMITTED
    {
        return Err(format!(
            "checkpoint {} has no committed v{} header",
            path.display(),
            CHECKPOINT_VERSION
        ));
    }
    let stored_header_checksum = get_u64(&bytes, 88);
    put_u64(&mut bytes, 88, 0);
    if header_checksum(&bytes) != stored_header_checksum {
        return Err(format!(
            "checkpoint {} header checksum mismatch",
            path.display()
        ));
    }
    if get_u64(&bytes, 24) != CORNER4 as u64
        || get_u64(&bytes, 32) != state_space::CROSS as u64
        || get_u64(&bytes, 40) != expected_words as u64
        || get_u32(&bytes, 76) != selected_b as u32
    {
        return Err(format!(
            "checkpoint {} belongs to a different state space",
            path.display()
        ));
    }
    let current_colour = bytes[48];
    let next_colour = bytes[49];
    if !matches!((current_colour, next_colour), (1, 2) | (2, 1)) {
        return Err(format!(
            "checkpoint {} has invalid frontier colours {current_colour}/{next_colour}",
            path.display()
        ));
    }
    let histogram_len = get_u32(&bytes, 72) as usize;
    if histogram_len > CHECKPOINT_MAX_HISTOGRAM {
        return Err(format!(
            "checkpoint {} histogram length {histogram_len} exceeds {CHECKPOINT_MAX_HISTOGRAM}",
            path.display()
        ));
    }
    let histogram: Vec<u64> = (0..histogram_len)
        .map(|index| get_u64(&bytes, 96 + index * 8))
        .collect();
    let selected_b_histogram: Vec<u64> = (0..histogram_len)
        .map(|index| get_u64(&bytes, 96 + CHECKPOINT_MAX_HISTOGRAM * 8 + index * 8))
        .collect();
    let cumulative = get_u64(&bytes, 56);
    let histogram_sum = histogram.iter().try_fold(0u64, |sum, &count| {
        sum.checked_add(count)
            .ok_or_else(|| "checkpoint histogram overflow".to_owned())
    })?;
    let selected_b_sum = selected_b_histogram.iter().try_fold(0u64, |sum, &count| {
        sum.checked_add(count)
            .ok_or_else(|| "checkpoint conditional histogram overflow".to_owned())
    })?;
    if histogram_sum != cumulative
        || cumulative > FIRST_LAYER_STATES
        || get_u32(&bytes, 52) as usize != histogram_len
        || selected_b_sum > CORNER4 as u64
    {
        return Err(format!(
            "checkpoint {} metadata invariants failed",
            path.display()
        ));
    }
    let deepest_state = get_u64(&bytes, 64) as usize;
    if deepest_state >= FIRST_LAYER_STATES as usize {
        return Err(format!(
            "checkpoint {} witness {deepest_state} is out of range",
            path.display()
        ));
    }
    Ok(CheckpointHeader {
        generation: get_u64(&bytes, 16),
        word_count: expected_words,
        current_colour,
        next_colour,
        next_depth: get_u32(&bytes, 52),
        cumulative,
        deepest_state,
        histogram,
        selected_b_histogram,
        payload_checksum: get_u64(&bytes, 80),
    })
}

fn words_as_bytes(words: &[u64]) -> &[u8] {
    // u8 has alignment 1 and every u64 bit pattern is valid.
    unsafe { std::slice::from_raw_parts(words.as_ptr().cast::<u8>(), std::mem::size_of_val(words)) }
}

fn words_as_bytes_mut(words: &mut [u64]) -> &mut [u8] {
    // u8 has alignment 1 and the read fills the complete target slice.
    unsafe {
        std::slice::from_raw_parts_mut(
            words.as_mut_ptr().cast::<u8>(),
            std::mem::size_of_val(words),
        )
    }
}

fn checkpoint_paths(dir: &Path) -> [PathBuf; 2] {
    [dir.join("checkpoint-a.bin"), dir.join("checkpoint-b.bin")]
}

fn write_checkpoint(
    dir: &Path,
    generation: u64,
    selected_b: usize,
    snapshot: &Packed2Snapshot<'_>,
) -> Result<PathBuf, String> {
    fs::create_dir_all(dir)
        .map_err(|e| format!("cannot create checkpoint directory {}: {e}", dir.display()))?;
    let path = checkpoint_paths(dir)[generation as usize & 1].clone();
    let file = OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(&path)
        .map_err(|e| format!("cannot create checkpoint {}: {e}", path.display()))?;
    let mut writer = BufWriter::with_capacity(8 * 1024 * 1024, file);
    writer
        .write_all(&[0u8; CHECKPOINT_HEADER_BYTES])
        .map_err(|e| format!("cannot invalidate checkpoint {}: {e}", path.display()))?;

    let mut checksum = WordChecksum::new();
    let mut buffer = Vec::<u64>::with_capacity(CHECKPOINT_IO_WORDS);
    for chunk in snapshot.words.chunks(CHECKPOINT_IO_WORDS) {
        buffer.clear();
        buffer.extend(chunk.iter().map(|word| word.load(Ordering::Relaxed)));
        checksum.update(&buffer);
        if cfg!(target_endian = "big") {
            buffer.iter_mut().for_each(|word| *word = word.to_le());
        }
        writer
            .write_all(words_as_bytes(&buffer))
            .map_err(|e| format!("cannot write checkpoint payload {}: {e}", path.display()))?;
    }
    writer
        .flush()
        .map_err(|e| format!("cannot flush checkpoint {}: {e}", path.display()))?;
    let mut file = writer
        .into_inner()
        .map_err(|e| format!("cannot finish checkpoint {}: {e}", path.display()))?;
    file.sync_all()
        .map_err(|e| format!("cannot sync checkpoint payload {}: {e}", path.display()))?;
    let header = checkpoint_header_bytes(generation, selected_b, snapshot, checksum.finish())?;
    file.seek(SeekFrom::Start(0))
        .and_then(|_| file.write_all(&header))
        .and_then(|_| file.sync_all())
        .map_err(|e| format!("cannot commit checkpoint {}: {e}", path.display()))?;
    Ok(path)
}

fn load_checkpoint_payload(path: &Path, header: CheckpointHeader) -> Result<Packed2Resume, String> {
    let mut file =
        File::open(path).map_err(|e| format!("cannot open checkpoint {}: {e}", path.display()))?;
    file.seek(SeekFrom::Start(CHECKPOINT_HEADER_BYTES as u64))
        .map_err(|e| format!("cannot seek checkpoint {}: {e}", path.display()))?;
    let mut words = Vec::new();
    words
        .try_reserve_exact(header.word_count)
        .map_err(|e| format!("cannot reserve checkpoint frontier memory: {e}"))?;
    words.resize_with(header.word_count, || AtomicU64::new(0));
    let mut buffer = vec![0u64; CHECKPOINT_IO_WORDS];
    let mut checksum = WordChecksum::new();
    let mut offset = 0usize;
    while offset < header.word_count {
        let count = (header.word_count - offset).min(CHECKPOINT_IO_WORDS);
        file.read_exact(words_as_bytes_mut(&mut buffer[..count]))
            .map_err(|e| format!("cannot read checkpoint payload {}: {e}", path.display()))?;
        if cfg!(target_endian = "big") {
            buffer[..count]
                .iter_mut()
                .for_each(|word| *word = u64::from_le(*word));
        }
        checksum.update(&buffer[..count]);
        for (target, &value) in words[offset..offset + count].iter().zip(&buffer[..count]) {
            target.store(value, Ordering::Relaxed);
        }
        offset += count;
    }
    let actual_checksum = checksum.finish();
    if actual_checksum != header.payload_checksum {
        return Err(format!(
            "checkpoint {} payload checksum mismatch: got {actual_checksum:016x}, expected {:016x}",
            path.display(),
            header.payload_checksum
        ));
    }
    Ok(Packed2Resume {
        words,
        current_colour: header.current_colour,
        next_colour: header.next_colour,
        next_depth: header.next_depth,
        cumulative: header.cumulative,
        histogram: header.histogram,
        selected_b_histogram: header.selected_b_histogram,
        deepest_state: header.deepest_state,
    })
}

fn load_latest_checkpoint(
    dir: &Path,
    expected_words: usize,
    selected_b: usize,
) -> Result<Option<(u64, Packed2Resume, PathBuf)>, String> {
    let paths = checkpoint_paths(dir);
    let mut any_file = false;
    let mut candidates = Vec::new();
    let mut errors = Vec::new();
    for path in paths {
        if !path.exists() {
            continue;
        }
        any_file = true;
        match parse_checkpoint_header(&path, expected_words, selected_b) {
            Ok(header) => candidates.push((header.generation, path, header)),
            Err(error) => {
                eprintln!("[first-layer-god] checkpoint slot ignored: {error}");
                errors.push(error);
            }
        }
    }
    candidates.sort_by(|a, b| b.0.cmp(&a.0));
    for (generation, path, header) in candidates {
        match load_checkpoint_payload(&path, header) {
            Ok(resume) => return Ok(Some((generation, resume, path))),
            Err(error) => {
                eprintln!("[first-layer-god] checkpoint slot ignored: {error}");
                errors.push(error);
            }
        }
    }
    if any_file {
        return Err(format!(
            "checkpoint files exist but none is recoverable:\n{}",
            errors.join("\n")
        ));
    }
    Ok(None)
}

fn human_duration(seconds: f64) -> String {
    if !seconds.is_finite() || seconds < 0.0 {
        return "unknown".to_owned();
    }
    let seconds = seconds.round() as u64;
    let hours = seconds / 3600;
    let minutes = seconds % 3600 / 60;
    let seconds = seconds % 60;
    format!("{hours:02}:{minutes:02}:{seconds:02}")
}

fn build_moves(
    tracked: &[i32],
    orientation_base: i32,
    piece_count: i32,
    states: usize,
    basic: Vec<u32>,
) -> Vec<i32> {
    let basic: Vec<i32> = basic.into_iter().map(|v| v as i32).collect();
    create_multi_move_table(
        tracked.len() as i32,
        orientation_base,
        piece_count,
        states as i32,
        &basic,
    )
}

fn solved_coords() -> (usize, usize) {
    let c = array_to_index(&TRACKED_CORNERS.map(|p| 3 * p), 4, 3, 8) as usize;
    let e = array_to_index(&TRACKED_EDGES.map(|p| 2 * p), 4, 2, 12) as usize;
    assert_eq!(e, state_space::CROSS_SOLVED);
    (c, e)
}

fn coords_from_state(state: &State) -> (usize, usize) {
    let mut corners = [0i32; 4];
    let mut edges = [0i32; 4];
    for (i, &piece) in TRACKED_CORNERS.iter().enumerate() {
        let position = state
            .corners
            .iter()
            .position(|&v| v / 3 == piece as u8)
            .expect("tracked corner missing");
        corners[i] = 3 * position as i32 + (state.corners[position] % 3) as i32;
    }
    for (i, &piece) in TRACKED_EDGES.iter().enumerate() {
        let position = state
            .edges
            .iter()
            .position(|&v| v / 2 == piece as u8)
            .expect("tracked edge missing");
        edges[i] = 2 * position as i32 + (state.edges[position] % 2) as i32;
    }
    (
        array_to_index(&corners, 4, 3, 8) as usize,
        array_to_index(&edges, 4, 2, 12) as usize,
    )
}

fn first_layer_solved(state: &State) -> bool {
    (4..8).all(|p| state.corners[p] == 3 * p as u8)
        && (8..12).all(|p| state.edges[p] == 2 * p as u8)
}

fn names(moves: &[u8]) -> String {
    moves
        .iter()
        .map(|&m| Move::from_index(m as usize).name())
        .collect::<Vec<_>>()
        .join(" ")
}

fn certify_witness(proof: &ExactBfsProof) -> Result<(usize, usize, String, String), String> {
    let god = proof
        .histogram
        .len()
        .checked_sub(1)
        .ok_or_else(|| "First Layer histogram is empty".to_owned())?;
    let c = proof.deepest_state / state_space::CROSS;
    let e = proof.deepest_state % state_space::CROSS;

    // The 6 GiB frontier table has been dropped before this function is called.
    // Build the normal admissible-PDB IDA* and independently demand the same
    // optimum for the deepest coordinate.
    let solver = FirstLayerSolver::new();
    let solution = solver.solve_coords_for_proof(c, e)?;
    if solution.len as usize != god {
        return Err(format!(
            "deepest witness mismatch: BFS depth {god}, IDA* depth {}",
            solution.len
        ));
    }
    let scramble: Vec<u8> = solution
        .moves
        .iter()
        .rev()
        .map(|&m| INV_MOVE[m as usize])
        .collect();

    // Independent full physical State replay: the inverse solution must reach
    // exactly the BFS coordinate, and scramble + solution must restore F1L.
    let mut physical = State::SOLVED;
    for &m in &scramble {
        physical.apply(Move::from_index(m as usize));
    }
    if coords_from_state(&physical) != (c, e) {
        return Err("physical witness does not match the deepest BFS coordinate".to_owned());
    }
    for &m in &solution.moves {
        physical.apply(Move::from_index(m as usize));
    }
    if !first_layer_solved(&physical) {
        return Err("physical witness solution does not restore First Layer".to_owned());
    }

    Ok((c, e, names(&scramble), names(&solution.moves)))
}

fn execute(args: Args) -> Result<(), String> {
    if usize::BITS < 64 {
        return Err("First Layer proof requires a 64-bit build".to_owned());
    }
    let plan = memory_plan()?;
    print_plan(plan, &args);
    if plan.peak_budget_bytes > MEMORY_CAP_BYTES {
        return Err(format!(
            "planned peak {} exceeds hard cap {}",
            plan.peak_budget_bytes, MEMORY_CAP_BYTES
        ));
    }
    if args.dry_run {
        println!("dry_run=true; no move table or frontier was allocated");
        return Ok(());
    }
    if env::var("CUBE_ALLOW_HUGE_TABLES").ok().as_deref() != Some("1") {
        return Err(
            "full proof is gated; set CUBE_ALLOW_HUGE_TABLES=1 after checking free memory"
                .to_owned(),
        );
    }

    rayon::ThreadPoolBuilder::new()
        .num_threads(args.threads)
        .build_global()
        .map_err(|e| format!("cannot configure Rayon pool: {e}"))?;

    let started = Instant::now();
    let expected_words = (plan.frontier_bytes / 8) as usize;
    let checkpoint_started = Instant::now();
    let loaded = load_latest_checkpoint(
        &args.checkpoint_dir,
        expected_words,
        state_space::CROSS_SOLVED,
    )?;
    let (mut checkpoint_generation, resume, resumed_from) = match loaded {
        Some((generation, resume, path)) => {
            eprintln!(
                "[first-layer-god] resumed generation={generation} depth={} cumulative={} cross_states={} from={} load_elapsed={:.1}s",
                resume.next_depth,
                resume.cumulative,
                resume.selected_b_histogram.iter().sum::<u64>(),
                path.display(),
                checkpoint_started.elapsed().as_secs_f64()
            );
            let cumulative = resume.cumulative;
            (generation, Some(resume), cumulative)
        }
        None => {
            eprintln!(
                "[first-layer-god] no checkpoint found in {}; starting fresh",
                args.checkpoint_dir.display()
            );
            (0, None, 0)
        }
    };
    eprintln!("[first-layer-god] building 4-corner and 4-edge move tables");
    let mt_c = build_moves(
        &TRACKED_CORNERS,
        3,
        8,
        CORNER4,
        cube_solver::mt_gen::create_mt_corn(),
    );
    let mt_e = build_moves(
        &TRACKED_EDGES,
        2,
        12,
        state_space::CROSS,
        cube_solver::mt_gen::create_mt_edge(),
    );
    let (c0, e0) = solved_coords();
    let start = c0 * state_space::CROSS + e0;
    eprintln!(
        "[first-layer-god] BFS start after {:.2}s; packed frontier {:.3} GiB",
        started.elapsed().as_secs_f64(),
        gib(plan.frontier_bytes)
    );
    let bfs_started = Instant::now();
    let scan_reporter = |scan: ScanProgress| {
        let percent = scan.rows_done as f64 / scan.rows_total as f64 * 100.0;
        eprintln!(
            "[first-layer-god] scan depth={} rows={}/{} ({percent:.1}%) total_elapsed={}",
            scan.depth,
            scan.rows_done,
            scan.rows_total,
            human_duration(bfs_started.elapsed().as_secs_f64())
        );
    };
    let proof = bfs_multi_packed2_exact_resumable(
        CORNER4,
        state_space::CROSS,
        &[start],
        &mt_c,
        &mt_e,
        resume,
        Some(state_space::CROSS_SOLVED),
        Some(&scan_reporter),
        |layer, snapshot| {
            let elapsed = bfs_started.elapsed().as_secs_f64();
            let expanded_this_run = snapshot.cumulative.saturating_sub(resumed_from);
            let rate = if elapsed > 0.0 {
                expanded_this_run as f64 / elapsed
            } else {
                0.0
            };
            let eta = if rate > 0.0 {
                (FIRST_LAYER_STATES - snapshot.cumulative) as f64 / rate
            } else {
                f64::INFINITY
            };
            let percent = snapshot.cumulative as f64 / FIRST_LAYER_STATES as f64 * 100.0;
            eprintln!(
                "[first-layer-god] progress depth={} count={} cross_count={} cumulative={} ({percent:.6}%) rate={rate:.0} states/s state_eta={} elapsed={} witness={}",
                layer.depth,
                layer.count,
                layer.selected_b_count,
                snapshot.cumulative,
                human_duration(eta),
                human_duration(elapsed),
                layer.witness
            );
            if snapshot.cumulative >= CHECKPOINT_MIN_STATES
                && snapshot.next_depth % args.checkpoint_every == 0
            {
                checkpoint_generation = checkpoint_generation
                    .checked_add(1)
                    .ok_or_else(|| "checkpoint generation overflow".to_owned())?;
                let checkpoint_write_started = Instant::now();
                eprintln!(
                    "[first-layer-god] checkpoint start generation={} depth={} slot={} payload={:.3} GiB",
                    checkpoint_generation,
                    snapshot.next_depth,
                    if checkpoint_generation & 1 == 0 { "A" } else { "B" },
                    gib(plan.frontier_bytes)
                );
                let path = write_checkpoint(
                    &args.checkpoint_dir,
                    checkpoint_generation,
                    state_space::CROSS_SOLVED,
                    &snapshot,
                )?;
                eprintln!(
                    "[first-layer-god] checkpoint committed generation={} path={} elapsed={:.1}s",
                    checkpoint_generation,
                    path.display(),
                    checkpoint_write_started.elapsed().as_secs_f64()
                );
            }
            Ok(())
        },
    )?;
    if proof.visited != FIRST_LAYER_STATES {
        return Err(format!(
            "incomplete/contaminated BFS: visited {}, expected {FIRST_LAYER_STATES}",
            proof.visited
        ));
    }
    let god = proof.histogram.len() - 1;
    if god as u32 > FIRST_LAYER_UPPER_BOUND {
        return Err(format!(
            "computed diameter {god} exceeds the whole-cube upper bound {FIRST_LAYER_UPPER_BOUND}"
        ));
    }
    let selected_total: u64 = proof.selected_b_histogram.iter().sum();
    if selected_total != CORNER4 as u64 {
        return Err(format!(
            "incomplete cross-solved conditional distribution: counted {selected_total}, expected {CORNER4}"
        ));
    }
    let given_cross_god = proof
        .selected_b_histogram
        .iter()
        .rposition(|&count| count != 0)
        .ok_or_else(|| "cross-solved conditional histogram is empty".to_owned())?;

    // Release the large transition tables before the independent IDA* witness
    // verifier allocates its normal ~100 MiB PDB stack.
    drop(mt_c);
    drop(mt_e);
    let (c, e, scramble, solution) = certify_witness(&proof)?;

    println!("FIRST_LAYER_GODS_NUMBER={god}");
    println!("FIRST_LAYER_HISTOGRAM={:?}", proof.histogram);
    println!("FIRST_LAYER_VISITED={}", proof.visited);
    println!("FIRST_LAYER_GIVEN_CROSS_GODS_NUMBER={given_cross_god}");
    println!(
        "FIRST_LAYER_GIVEN_CROSS_HISTOGRAM={:?}",
        proof.selected_b_histogram
    );
    println!("FIRST_LAYER_GIVEN_CROSS_STATES={selected_total}");
    println!(
        "EFFECTIVE_MOVES={}",
        proof
            .effective_moves
            .iter()
            .map(|&m| Move::from_index(m as usize).name())
            .collect::<Vec<_>>()
            .join(" ")
    );
    println!("DEEPEST_CORNER4={c}");
    println!("DEEPEST_EDGE4={e}");
    println!("DEEPEST_SCRAMBLE={scramble}");
    println!("DEEPEST_SOLUTION={solution}");
    println!("ELAPSED_SECONDS={:.3}", started.elapsed().as_secs_f64());
    Ok(())
}

fn main() -> ExitCode {
    match parse_args().and_then(execute) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("first_layer_gods_number: {error}");
            ExitCode::from(2)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::{HashMap, VecDeque};
    use std::time::{SystemTime, UNIX_EPOCH};

    use cube_solver::cube_common::{index_to_array, move_state};

    type PieceState = (u8, u8, u8, u8);

    fn step_piece(state: PieceState, m: usize) -> PieceState {
        let (corner_pos, corner_ori, edge_pos, edge_ori) = state;
        let movement = move_state(Move::from_index(m));
        let (cp, co) = movement.cp_co();
        let (ep, eo) = movement.ep_eo();
        let next_corner = (0..8).find(|&p| cp[p] == corner_pos).unwrap();
        let next_edge = (0..12).find(|&p| ep[p] == edge_pos).unwrap();
        (
            next_corner as u8,
            (corner_ori + co[next_corner]) % 3,
            next_edge as u8,
            (edge_ori + eo[next_edge]) % 2,
        )
    }

    #[test]
    fn one_corner_one_edge_matches_independent_physical_bfs() {
        let mt_c = build_moves(
            &[4],
            3,
            8,
            state_space::CORNER,
            cube_solver::mt_gen::create_mt_corn(),
        );
        let mt_e = build_moves(
            &[8],
            2,
            12,
            state_space::EDGE,
            cube_solver::mt_gen::create_mt_edge(),
        );
        let c0 = array_to_index(&[12], 1, 3, 8) as usize;
        let e0 = array_to_index(&[16], 1, 2, 12) as usize;
        let proof = bfs_multi_packed2_exact(
            state_space::CORNER,
            state_space::EDGE,
            &[c0 * state_space::EDGE + e0],
            &mt_c,
            &mt_e,
            |_| {},
        )
        .expect("reduced packed2 BFS");

        let start: PieceState = (4, 0, 8, 0);
        let mut physical = HashMap::from([(start, 0u8)]);
        let mut queue = VecDeque::from([start]);
        while let Some(state) = queue.pop_front() {
            let depth = physical[&state];
            for m in 0..18 {
                let next = step_piece(state, m);
                if let std::collections::hash_map::Entry::Vacant(slot) = physical.entry(next) {
                    slot.insert(depth + 1);
                    queue.push_back(next);
                }
            }
        }
        let max = *physical.values().max().unwrap() as usize;
        let mut expected = vec![0u64; max + 1];
        for depth in physical.values() {
            expected[*depth as usize] += 1;
        }
        assert_eq!(physical.len(), state_space::CORNER * state_space::EDGE);
        assert_eq!(proof.histogram, expected);
        assert_eq!(
            proof.visited,
            (state_space::CORNER * state_space::EDGE) as u64
        );
        assert_eq!(proof.effective_moves, (0u8..18).collect::<Vec<_>>());
    }

    #[test]
    fn production_plan_is_below_decimal_25gb_cap() {
        let plan = memory_plan().unwrap();
        assert_eq!(FIRST_LAYER_STATES, 25_866_086_400);
        assert_eq!(plan.frontier_bytes, 6_466_521_600);
        assert_eq!(plan.checkpoint_slot_bytes, 6_466_525_696);
        assert_eq!(plan.checkpoint_disk_bytes, 12_933_051_392);
        assert!(plan.peak_budget_bytes < MEMORY_CAP_BYTES);
        assert!(plan.peak_budget_bytes < 7_100_000_000);
    }

    #[test]
    fn coordinate_decode_roundtrip_uses_physical_state() {
        let alg = [Move::R, Move::U2, Move::FPrime, Move::D, Move::L2];
        let mut state = State::SOLVED;
        for m in alg {
            state.apply(m);
        }
        let (c, e) = coords_from_state(&state);
        let mut ca = [0i32; 4];
        let mut ea = [0i32; 4];
        index_to_array(&mut ca, c as i32, 4, 3, 8);
        index_to_array(&mut ea, e as i32, 4, 2, 12);
        assert_eq!(
            ca.map(|v| v / 18),
            TRACKED_CORNERS.map(|piece| {
                let pos = state
                    .corners
                    .iter()
                    .position(|&v| v / 3 == piece as u8)
                    .unwrap();
                3 * pos as i32 + (state.corners[pos] % 3) as i32
            })
        );
        assert_eq!(
            ea.map(|v| v / 18),
            TRACKED_EDGES.map(|piece| {
                let pos = state
                    .edges
                    .iter()
                    .position(|&v| v / 2 == piece as u8)
                    .unwrap();
                2 * pos as i32 + (state.edges[pos] % 2) as i32
            })
        );
    }

    #[test]
    fn checkpoint_ab_falls_back_after_torn_newest_slot() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("test-checkpoints")
            .join(format!("first-layer-god-{}-{unique}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();

        let words: Vec<AtomicU64> = [1u64, 2, 3, u64::MAX]
            .into_iter()
            .map(AtomicU64::new)
            .collect();
        let first = Packed2Snapshot {
            words: &words,
            current_colour: 2,
            next_colour: 1,
            next_depth: 1,
            cumulative: 1,
            histogram: &[1],
            selected_b_histogram: &[1],
            deepest_state: 0,
        };
        let first_path = write_checkpoint(&dir, 1, state_space::CROSS_SOLVED, &first).unwrap();

        words[0].store(0x55aa, Ordering::Relaxed);
        let second = Packed2Snapshot {
            words: &words,
            current_colour: 1,
            next_colour: 2,
            next_depth: 2,
            cumulative: 3,
            histogram: &[1, 2],
            selected_b_histogram: &[1, 1],
            deepest_state: 2,
        };
        let second_path = write_checkpoint(&dir, 2, state_space::CROSS_SOLVED, &second).unwrap();
        let (generation, resume, loaded_path) =
            load_latest_checkpoint(&dir, words.len(), state_space::CROSS_SOLVED)
                .unwrap()
                .unwrap();
        assert_eq!(generation, 2);
        assert_eq!(loaded_path, second_path);
        assert_eq!(resume.histogram, vec![1, 2]);
        assert_eq!(resume.words[0].load(Ordering::Relaxed), 0x55aa);
        drop(resume);

        let mut newest = OpenOptions::new().write(true).open(&second_path).unwrap();
        newest.seek(SeekFrom::Start(0)).unwrap();
        newest.write_all(b"TORN").unwrap();
        newest.sync_all().unwrap();
        let (generation, resume, loaded_path) =
            load_latest_checkpoint(&dir, words.len(), state_space::CROSS_SOLVED)
                .unwrap()
                .unwrap();
        assert_eq!(generation, 1);
        assert_eq!(loaded_path, first_path);
        assert_eq!(resume.histogram, vec![1]);
        assert_eq!(resume.words[0].load(Ordering::Relaxed), 1);

        // target/ is disposable test output under the repository policy.
        fs::remove_dir_all(dir).unwrap();
    }
}
