//! Native generation over the full EO11 quotient, followed by EO10 projection.
//!
//! EO10 is not a move congruence: its packed value must never be used as a
//! visited test. The small exact BFS retains full EO11 keys. Every shortest
//! path longer than that BFS has a shortest prefix on its final layer, so
//! enumerating bounded suffixes from all final-layer states is exhaustive.
use crate::eo_table::AtomicEoTable;
#[cfg(test)]
use crate::opt10_table::AtomicOpt10Table;
use std::{
    sync::{
        atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering},
        Mutex,
    },
    thread,
    time::Instant,
};

/// The keys must describe a move congruence and identify symmetry orbits
/// uniquely. `representative(key)` must reproduce the same key, and every
/// stabilizer image of that representative must be included in the projection.
pub trait CoordinateSpace: Sync {
    type State: Copy + Send;
    fn solved(&self) -> Self::State;
    fn full_key(&self, state: &Self::State) -> u64;
    fn representative(&self, key: u64) -> Result<Self::State, String>;
    fn moved(&self, state: &Self::State, movement: u8) -> Self::State;
    fn mark_projected(&self, state: &Self::State, visit: &mut dyn FnMut(u64));
    /// Include a full state only when its exact key passes the predicate.
    /// Coordinate implementations may reuse canonicalization across the key
    /// and projected aliases; rejected keys must not emit any projections.
    fn project_if_key(
        &self,
        state: &Self::State,
        include: impl FnOnce(u64) -> bool,
        visit: &mut dyn FnMut(u64),
    ) -> bool {
        let included = include(self.full_key(state));
        if included {
            self.mark_projected(state, visit);
        }
        included
    }
    fn cells(&self) -> u64;
    fn move_count(&self) -> u8 {
        18
    }
    /// Optional word reduction within a suffix. It must retain at least one
    /// shortest word for each reachable state; the first suffix move is free.
    fn allow_move(&self, _previous: Option<u8>, _next: u8) -> bool {
        true
    }
}

/// A monotone projected-distance sink. Keeping this smaller than the concrete
/// Opt10 file format lets the exact same generator be checked against Opt1.
/// This interface cannot publish a table or relax Opt10's output validation.
pub trait GenerationSink: Sync {
    fn cells(&self) -> u64;
    fn record_min(&self, index: u64, depth: u8) -> Result<bool, String>;
}

impl<const EO: u8> GenerationSink for AtomicEoTable<EO> {
    fn cells(&self) -> u64 {
        AtomicEoTable::cells(self)
    }
    fn record_min(&self, index: u64, depth: u8) -> Result<bool, String> {
        AtomicEoTable::record_min(self, index, depth)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct GenerationConfig {
    pub threads: usize,
    pub short_depth: u8,
    pub max_depth: u8,
    /// Power-of-two slots; each slot is exactly eight bytes, with no hidden
    /// per-entry allocation or resizable hash-map overhead.
    pub short_capacity: usize,
    pub max_short_states: usize,
}

/// Quiescent generator state. The checkpoint owner must atomically bind this
/// to the matching sink bytes, coordinate snapshot and generator format.
#[derive(Clone)]
pub struct GenerationResume {
    pub config: GenerationConfig,
    pub completed_bfs_depth: u8,
    pub next_suffix_slot: usize,
    pub expanded: u64,
    pub short_slots: Vec<u64>,
}

pub type CheckpointWriter<'a> = dyn Fn(&GenerationResume) -> Result<(), String> + Sync + 'a;

impl Default for GenerationConfig {
    fn default() -> Self {
        Self {
            threads: thread::available_parallelism()
                .map(|n| n.get().min(16))
                .unwrap_or(1),
            short_depth: 8,
            max_depth: 12,
            short_capacity: 1 << 24,
            max_short_states: 10_000_000,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GenerationStage {
    ShortBfs,
    SuffixSearch,
    Completed,
}

#[derive(Clone, Copy, Debug)]
pub struct GenerationProgress {
    pub stage: GenerationStage,
    pub depth: u8,
    pub short_states: u64,
    pub seeds_done: u64,
    pub seeds_total: u64,
    pub expanded: u64,
    pub seconds: f64,
}

#[derive(Clone, Copy, Debug)]
pub struct GenerationSummary {
    pub short_states: u64,
    pub final_layer_states: u64,
    pub expanded: u64,
    pub completed_depth: u8,
    pub seconds: f64,
}

/// Fixed-capacity open addressing, with a four-bit exact BFS depth packed
/// beside each key. Zero denotes an empty slot. Insertions in a BFS pass all
/// have the same depth; earlier layers are immutable after their join barrier.
struct ShortStates {
    slots: Vec<AtomicU64>,
    count: AtomicUsize,
    maximum: usize,
}

impl ShortStates {
    fn new(capacity: usize, maximum: usize) -> Result<Self, String> {
        if capacity < 16 || !capacity.is_power_of_two() || capacity > (1 << 26) {
            return Err("short-state capacity must be a power of two in 16..=67108864".into());
        }
        if maximum == 0 || maximum > capacity / 4 * 3 {
            return Err("short-state limit must leave at least 25% empty slots".into());
        }
        let mut slots = Vec::new();
        slots
            .try_reserve_exact(capacity)
            .map_err(|e| e.to_string())?;
        slots.resize_with(capacity, || AtomicU64::new(0));
        Ok(Self {
            slots,
            count: AtomicUsize::new(0),
            maximum,
        })
    }

    fn encoded(key: u64, depth: u8) -> Result<u64, String> {
        if key >= (u64::MAX >> 4) || depth > 15 {
            return Err(
                "full coordinate key or BFS depth exceeds packed short-state capacity".into(),
            );
        }
        Ok(((key + 1) << 4) | u64::from(depth))
    }

    fn hash(key: u64) -> u64 {
        let mut value = key;
        value ^= value >> 30;
        value = value.wrapping_mul(0xbf58_476d_1ce4_e5b9);
        value ^= value >> 27;
        value = value.wrapping_mul(0x94d0_49bb_1331_11eb);
        value ^ (value >> 31)
    }

    fn insert(&self, key: u64, depth: u8) -> Result<bool, String> {
        let encoded = Self::encoded(key, depth)?;
        let mask = self.slots.len() - 1;
        let start = Self::hash(key) as usize & mask;
        for offset in 0..self.slots.len() {
            let slot = &self.slots[(start + offset) & mask];
            let mut found = slot.load(Ordering::Relaxed);
            if found == 0 {
                match slot.compare_exchange(0, encoded, Ordering::Relaxed, Ordering::Relaxed) {
                    Ok(_) => {
                        if self.count.fetch_add(1, Ordering::Relaxed) >= self.maximum {
                            return Err("short-state budget exhausted; incomplete generation must not be published".into());
                        }
                        return Ok(true);
                    }
                    Err(actual) => found = actual,
                }
            }
            if found >> 4 == encoded >> 4 {
                return Ok(false);
            }
        }
        Err("short-state dictionary unexpectedly full".into())
    }

    fn contains(&self, key: u64) -> bool {
        let mask = self.slots.len() - 1;
        let start = Self::hash(key) as usize & mask;
        for offset in 0..self.slots.len() {
            let found = self.slots[(start + offset) & mask].load(Ordering::Relaxed);
            if found == 0 {
                return false;
            }
            if (found >> 4) - 1 == key {
                return true;
            }
        }
        false
    }

    fn count(&self) -> u64 {
        self.count.load(Ordering::Relaxed) as u64
    }
}

struct Failure {
    stopped: AtomicBool,
    error: Mutex<Option<String>>,
}

impl Failure {
    fn new() -> Self {
        Self {
            stopped: AtomicBool::new(false),
            error: Mutex::new(None),
        }
    }
    fn stop(&self, error: String) {
        self.stopped.store(true, Ordering::Relaxed);
        let mut saved = self
            .error
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if saved.is_none() {
            *saved = Some(error);
        }
    }
    fn check(&self) -> Result<(), String> {
        match self
            .error
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .as_ref()
        {
            Some(error) => Err(error.clone()),
            None => Ok(()),
        }
    }
}

struct WorkerFailureGuard<'a>(&'a Failure);
impl Drop for WorkerFailureGuard<'_> {
    fn drop(&mut self) {
        if thread::panicking() {
            // Signal peers immediately, even when the parent has not yet
            // reached this worker's join handle.
            self.0.stop("generation worker panicked".into());
        }
    }
}

fn mark<S: CoordinateSpace, T: GenerationSink>(
    space: &S,
    table: &T,
    state: &S::State,
    depth: u8,
) -> Result<(), String> {
    record_projections(table, depth, |visit| {
        space.mark_projected(state, visit);
        true
    })
    .map(|_| ())
}

fn record_projections<T: GenerationSink>(
    table: &T,
    depth: u8,
    project: impl FnOnce(&mut dyn FnMut(u64)) -> bool,
) -> Result<bool, String> {
    let mut error = None;
    let mut count = 0;
    let included = project(&mut |index| {
        count += 1;
        if error.is_none() {
            if let Err(reason) = table.record_min(index, depth) {
                error = Some(reason);
            }
        }
    });
    if let Some(error) = error {
        return Err(error);
    }
    if included && count == 0 {
        return Err("a full coordinate emitted no projected stabilizer image".into());
    }
    Ok(included)
}

/// Generate into a freshly allocated atomic table. The caller may write a
/// complete artifact only after this returns success. Errors leave the table
/// explicitly incomplete; there is no restart or partial-table promotion.
pub fn generate<S: CoordinateSpace, T: GenerationSink>(
    space: &S,
    table: &T,
    config: GenerationConfig,
    progress: impl Fn(GenerationProgress) + Sync,
) -> Result<GenerationSummary, String> {
    generate_resumable(space, table, config, None, None, progress)
}

/// Same enumeration as `generate`; checkpoint barriers never reload the sink
/// or restart the process. A failure returns to the caller, never auto-retries.
pub fn generate_resumable<S: CoordinateSpace, T: GenerationSink>(
    space: &S,
    table: &T,
    config: GenerationConfig,
    resume: Option<GenerationResume>,
    checkpoint: Option<&CheckpointWriter<'_>>,
    progress: impl Fn(GenerationProgress) + Sync,
) -> Result<GenerationSummary, String> {
    let maximum_threads = thread::available_parallelism()
        .map_err(|e| e.to_string())?
        .get()
        .min(16);
    if config.threads == 0 || config.threads > maximum_threads {
        return Err(format!(
            "generation threads must be in 1..={maximum_threads}"
        ));
    }
    if config.short_depth > config.max_depth || config.max_depth > 12 {
        return Err("generation requires short_depth <= max_depth <= 12".into());
    }
    if space.move_count() == 0 || space.move_count() > 64 {
        return Err("move count must be in 1..=64".into());
    }
    if space.cells() != table.cells() {
        return Err("coordinate space and table capacity differ".into());
    }
    let short = ShortStates::new(config.short_capacity, config.max_short_states)?;
    let failure = Failure::new();
    let mut bfs_depth = 0;
    let mut next_suffix_slot = 0;
    let mut previous_expanded = 0;
    if let Some(saved) = resume {
        if saved.config != config || saved.short_slots.len() != short.slots.len()
            || saved.completed_bfs_depth > config.short_depth
            || saved.next_suffix_slot > short.slots.len()
            || saved.completed_bfs_depth < config.short_depth && saved.next_suffix_slot != 0 {
            return Err("generation checkpoint configuration or progress differs".into());
        }
        let mut count = 0;
        for (slot, value) in short.slots.iter().zip(saved.short_slots) {
            if value != 0 {
                if value >> 4 == 0 || (value & 15) > u64::from(saved.completed_bfs_depth) {
                    return Err("generation checkpoint contains an invalid short state".into());
                }
                count += 1;
            }
            slot.store(value, Ordering::Relaxed);
        }
        if count == 0 || count > config.max_short_states {
            return Err("generation checkpoint short-state count is invalid".into());
        }
        short.count.store(count, Ordering::Relaxed);
        bfs_depth = saved.completed_bfs_depth;
        next_suffix_slot = saved.next_suffix_slot;
        previous_expanded = saved.expanded;
    } else {
        let solved = space.solved();
        short.insert(space.full_key(&solved), 0)?;
        mark(space, table, &solved, 0)?;
    }
    let expanded = AtomicU64::new(previous_expanded);
    let start = Instant::now();
    let save = |completed_bfs_depth, next_suffix_slot| -> Result<(), String> {
        if let Some(write) = checkpoint {
            write(&GenerationResume {
                config, completed_bfs_depth, next_suffix_slot,
                expanded: expanded.load(Ordering::Relaxed),
                short_slots: short.slots.iter().map(|s| s.load(Ordering::Relaxed)).collect(),
            })?;
        }
        Ok(())
    };
    progress(GenerationProgress {
        stage: GenerationStage::ShortBfs,
        depth: bfs_depth,
        short_states: short.count(),
        seeds_done: 0,
        seeds_total: 0,
        expanded: previous_expanded,
        seconds: 0.0,
    });

    for depth in bfs_depth..config.short_depth {
        thread::scope(|scope| {
            let mut workers = Vec::new();
            for worker in 0..config.threads {
                let short = &short;
                let failure = &failure;
                let expanded = &expanded;
                let from = short.slots.len() * worker / config.threads;
                let to = short.slots.len() * (worker + 1) / config.threads;
                match thread::Builder::new()
                    .name(format!("opt10-bfs-{worker}"))
                    .stack_size(1024 * 1024)
                    .spawn_scoped(scope, move || {
                        let _panic_guard = WorkerFailureGuard(failure);
                        let mut local_expanded = 0;
                        for slot in &short.slots[from..to] {
                            if failure.stopped.load(Ordering::Relaxed) {
                                break;
                            }
                            let packed = slot.load(Ordering::Relaxed);
                            if packed == 0 || (packed & 15) != u64::from(depth) {
                                continue;
                            }
                            let key = (packed >> 4) - 1;
                            let result = (|| {
                                let state = space.representative(key)?;
                                if space.full_key(&state) != key {
                                    return Err(
                                        "full-coordinate representative does not round-trip".into(),
                                    );
                                }
                                for movement in 0..space.move_count() {
                                    let next = space.moved(&state, movement);
                                    local_expanded += 1;
                                    if short.insert(space.full_key(&next), depth + 1)? {
                                        mark(space, table, &next, depth + 1)?;
                                    }
                                }
                                Ok::<(), String>(())
                            })();
                            if let Err(error) = result {
                                failure.stop(error);
                                break;
                            }
                        }
                        expanded.fetch_add(local_expanded, Ordering::Relaxed);
                    }) {
                    Ok(worker) => workers.push(worker),
                    Err(error) => {
                        failure.stop(format!("cannot start generation worker: {error}"));
                        break;
                    }
                }
            }
            for worker in workers {
                if worker.join().is_err() {
                    failure.stop("generation worker panicked".into());
                }
            }
        });
        failure.check()?;
        save(depth + 1, 0)?;
        progress(GenerationProgress {
            stage: GenerationStage::ShortBfs,
            depth: depth + 1,
            short_states: short.count(),
            seeds_done: 0,
            seeds_total: 0,
            expanded: expanded.load(Ordering::Relaxed),
            seconds: start.elapsed().as_secs_f64(),
        });
    }

    let seed_count = short
        .slots
        .iter()
        .filter(|slot| {
            let value = slot.load(Ordering::Relaxed);
            value != 0 && (value & 15) == u64::from(config.short_depth)
        })
        .count() as u64;
    let cursor = AtomicUsize::new(next_suffix_slot);
    let completed = AtomicU64::new(short.slots[..next_suffix_slot].iter().filter(|slot| {
        let value = slot.load(Ordering::Relaxed);
        value != 0 && (value & 15) == u64::from(config.short_depth)
    }).count() as u64);
    let last_progress = Mutex::new(Instant::now());
    progress(GenerationProgress {
        stage: GenerationStage::SuffixSearch,
        depth: config.max_depth,
        short_states: short.count(),
        seeds_done: completed.load(Ordering::Relaxed),
        seeds_total: seed_count,
        expanded: expanded.load(Ordering::Relaxed),
        seconds: start.elapsed().as_secs_f64(),
    });
    while next_suffix_slot < short.slots.len() {
        // Only the checkpointed caller adds barriers. The existing Opt10 caller
        // retains its original single suffix dispatch and allocation behavior.
        let end_slot = if checkpoint.is_some() {
            (next_suffix_slot + (1 << 20)).min(short.slots.len())
        } else { short.slots.len() };
        cursor.store(next_suffix_slot, Ordering::Relaxed);
        thread::scope(|scope| {
            let mut workers = Vec::new();
            for worker in 0..config.threads {
                let short = &short;
                let failure = &failure;
                let cursor = &cursor;
                let completed = &completed;
                let expanded = &expanded;
                let progress = &progress;
                let last_progress = &last_progress;
                match thread::Builder::new()
                    .name(format!("opt10-suffix-{worker}"))
                    .stack_size(1024 * 1024)
                    .spawn_scoped(scope, move || {
                        let _panic_guard = WorkerFailureGuard(failure);
                        while !failure.stopped.load(Ordering::Relaxed) {
                            let from = cursor.fetch_add(128, Ordering::Relaxed);
                            if from >= end_slot {
                                break;
                            }
                            let to = (from + 128).min(end_slot);
                            for slot in &short.slots[from..to] {
                                if failure.stopped.load(Ordering::Relaxed) {
                                    break;
                                }
                                let packed = slot.load(Ordering::Relaxed);
                                if packed == 0 || (packed & 15) != u64::from(config.short_depth) {
                                    continue;
                                }
                                let key = (packed >> 4) - 1;
                                let mut local_expanded = 0;
                                let result = (|| {
                                    let state = space.representative(key)?;
                                    if space.full_key(&state) != key {
                                        return Err(
                                            "full-coordinate representative does not round-trip".into(),
                                        );
                                    }
                                    suffix(
                                        space,
                                        table,
                                        short,
                                        failure,
                                        &state,
                                        None,
                                        config.short_depth,
                                        config.max_depth,
                                        &mut local_expanded,
                                    )
                                })();
                                expanded.fetch_add(local_expanded, Ordering::Relaxed);
                                if let Err(error) = result {
                                    failure.stop(error);
                                    break;
                                }
                                let done = completed.fetch_add(1, Ordering::Relaxed) + 1;
                                if done % 1024 == 0 || done == seed_count {
                                    let mut last =
                                        last_progress.lock().unwrap_or_else(|p| p.into_inner());
                                    if done == seed_count || last.elapsed().as_secs() >= 1 {
                                        progress(GenerationProgress {
                                            stage: GenerationStage::SuffixSearch,
                                            depth: config.max_depth,
                                            short_states: short.count(),
                                            seeds_done: done,
                                            seeds_total: seed_count,
                                            expanded: expanded.load(Ordering::Relaxed),
                                            seconds: start.elapsed().as_secs_f64(),
                                        });
                                        *last = Instant::now();
                                    }
                                }
                            }
                        }
                    }) {
                    Ok(worker) => workers.push(worker),
                    Err(error) => {
                        failure.stop(format!("cannot start generation worker: {error}"));
                        break;
                    }
                }
            }
            for worker in workers {
                if worker.join().is_err() {
                    failure.stop("generation worker panicked".into());
                }
            }
        });
        failure.check()?;
        next_suffix_slot = end_slot;
        save(config.short_depth, next_suffix_slot)?;
    }
    if completed.load(Ordering::Relaxed) != seed_count {
        return Err("not all final-layer states were processed".into());
    }
    let summary = GenerationSummary {
        short_states: short.count(),
        final_layer_states: seed_count,
        expanded: expanded.load(Ordering::Relaxed),
        completed_depth: config.max_depth,
        seconds: start.elapsed().as_secs_f64(),
    };
    progress(GenerationProgress {
        stage: GenerationStage::Completed,
        depth: config.max_depth,
        short_states: summary.short_states,
        seeds_done: seed_count,
        seeds_total: seed_count,
        expanded: summary.expanded,
        seconds: summary.seconds,
    });
    Ok(summary)
}

#[allow(clippy::too_many_arguments)]
fn suffix<S: CoordinateSpace, T: GenerationSink>(
    space: &S,
    table: &T,
    short: &ShortStates,
    failure: &Failure,
    state: &S::State,
    previous: Option<u8>,
    depth: u8,
    maximum: u8,
    expanded: &mut u64,
) -> Result<(), String> {
    if depth == maximum || failure.stopped.load(Ordering::Relaxed) {
        return Ok(());
    }
    for movement in 0..space.move_count() {
        if !space.allow_move(previous, movement) {
            continue;
        }
        let next = space.moved(state, movement);
        *expanded += 1;
        if depth + 1 == maximum {
            // A leaf has no continuation to prune. If its key was already in
            // the exact BFS, every alias was marked at a shorter distance;
            // a monotone update at this depth cannot lower those cells.
            // Thus neither full-key construction nor hash lookup is needed.
            mark(space, table, &next, depth + 1)?;
            continue;
        }
        // The complete exact BFS already represents every continuation from
        // this key with a shorter prefix. This does NOT inspect EO10 codes.
        let included = record_projections(table, depth + 1, |visit| {
            space.project_if_key(&next, |key| !short.contains(key), visit)
        })?;
        if !included {
            continue;
        }
        suffix(
            space,
            table,
            short,
            failure,
            &next,
            Some(movement),
            depth + 1,
            maximum,
            expanded,
        )?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checkpoint_resume_keeps_completed_bfs_and_suffix_work() {
        let config = GenerationConfig { threads: 1, short_depth: 3, max_depth: 12,
            short_capacity: 32, max_short_states: 16 };
        let table = crate::opt11::AtomicOpt11Table::new_for_cells(8192, 10).unwrap();
        let saved = Mutex::new(None);
        let checkpoint = |state: &GenerationResume| -> Result<(), String> {
            *saved.lock().unwrap() = Some(state.clone());
            if state.completed_bfs_depth == 2 { return Err("simulated stop".into()); }
            Ok(())
        };
        let failed = generate_resumable(&ProjectedCycle, &table, config, None, Some(&checkpoint), |_| {});
        assert_eq!(failed.unwrap_err(), "simulated stop");
        let resume = saved.lock().unwrap().take().unwrap();
        let initial_expanded = resume.expanded;
        let keep = |state: &GenerationResume| -> Result<(), String> {
            *saved.lock().unwrap() = Some(state.clone());
            Ok(())
        };
        let result = generate_resumable(&ProjectedCycle, &table, config, Some(resume), Some(&keep), |p| {
            if p.stage == GenerationStage::ShortBfs { assert!(p.depth >= 2); }
        }).unwrap();
        assert!(result.expanded > initial_expanded);
        for state in 0_u64..100 {
            if state != 10 { assert_eq!(table.get(state * 64 + 2), state.min(100 - state).min(13) as u8); }
        }
        // A completed checkpoint needs no enumeration, even if final-file
        // publication was interrupted after this checkpoint was committed.
        let finished = saved.lock().unwrap().take().unwrap();
        assert_eq!(finished.next_suffix_slot, config.short_capacity);
        let resumed = generate_resumable(&ProjectedCycle, &table, config, Some(finished), None, |_| {}).unwrap();
        assert_eq!(resumed.expanded, result.expanded);
    }

    // A non-congruent projection: state 10 shares state 0's output cell, but
    // their successors differ. A visited cutoff on output cells loses 11/12.
    struct ProjectedCycle;
    impl CoordinateSpace for ProjectedCycle {
        type State = u64;
        fn solved(&self) -> u64 {
            0
        }
        fn full_key(&self, state: &u64) -> u64 {
            *state
        }
        fn representative(&self, key: u64) -> Result<u64, String> {
            if key < 100 {
                Ok(key)
            } else {
                Err("invalid cycle key".into())
            }
        }
        fn moved(&self, state: &u64, movement: u8) -> u64 {
            if movement == 0 {
                (state + 1) % 100
            } else {
                (state + 99) % 100
            }
        }
        fn mark_projected(&self, state: &u64, visit: &mut dyn FnMut(u64)) {
            let projection = if *state == 10 { 0 } else { *state };
            visit(projection * 64 + 2);
            visit(projection * 64 + 3);
        }
        fn cells(&self) -> u64 {
            8192
        }
        fn move_count(&self) -> u8 {
            2
        }
    }

    #[test]
    fn full_keys_preserve_non_markov_projection_and_all_aliases() {
        for threads in [1, thread::available_parallelism().unwrap().get().min(4)] {
            let table = AtomicOpt10Table::new_for_cells(8192, 10).unwrap();
            let result = generate(
                &ProjectedCycle,
                &table,
                GenerationConfig {
                    threads,
                    short_depth: 3,
                    max_depth: 12,
                    short_capacity: 32,
                    max_short_states: 16,
                },
                |_| {},
            )
            .unwrap();
            assert_eq!(result.short_states, 7);
            assert_eq!(result.final_layer_states, 2);
            assert_eq!(result.completed_depth, 12);
            for state in 0_u64..100 {
                if state == 10 {
                    continue;
                } // It has no separate projected cell.
                let expected = state.min(100 - state).min(13) as u8;
                assert_eq!(
                    table.get(state * 64 + 2),
                    expected,
                    "state {state}, threads {threads}"
                );
                assert_eq!(
                    table.get(state * 64 + 3),
                    expected,
                    "alias {state}, threads {threads}"
                );
            }
            assert_eq!(table.get(11 * 64 + 2), 11);
            assert_eq!(table.get(12 * 64 + 2), 12);
        }
    }

    #[test]
    fn insufficient_short_map_never_reports_completion() {
        let table = AtomicOpt10Table::new_for_cells(8192, 10).unwrap();
        let completed = AtomicBool::new(false);
        let result = generate(
            &ProjectedCycle,
            &table,
            GenerationConfig {
                threads: 1,
                short_depth: 3,
                max_depth: 12,
                short_capacity: 16,
                max_short_states: 2,
            },
            |p| {
                if p.stage == GenerationStage::Completed {
                    completed.store(true, Ordering::Relaxed);
                }
            },
        );
        assert!(result.unwrap_err().contains("budget exhausted"));
        assert!(!completed.load(Ordering::Relaxed));
    }

    #[test]
    fn exact_dictionary_keeps_depth_and_distinct_full_keys() {
        let table = ShortStates::new(64, 32).unwrap();
        assert!(table.insert(0, 0).unwrap());
        assert!(table.insert(1 << 38, 8).unwrap());
        assert!(!table.insert(0, 8).unwrap());
        assert_eq!(table.count(), 2);
        assert!(table.contains(0));
        assert!(table.contains(1 << 38));
        assert!(!table.contains(1));
        let depths: Vec<_> = table
            .slots
            .iter()
            .map(|s| s.load(Ordering::Relaxed))
            .filter(|&s| s != 0)
            .map(|s| s & 15)
            .collect();
        assert!(depths.contains(&0));
        assert!(depths.contains(&8));
    }

    #[test]
    fn dictionary_budget_fails_without_resizing() {
        let table = ShortStates::new(16, 2).unwrap();
        table.insert(0, 0).unwrap();
        table.insert(1, 1).unwrap();
        assert!(table.insert(2, 2).is_err());
        assert_eq!(table.slots.len(), 16);
        assert!(ShortStates::new(17, 2).is_err());
        assert!(ShortStates::new(16, 13).is_err());
        assert!(ShortStates::encoded(u64::MAX >> 4, 8).is_err());
        assert!(ShortStates::encoded(0, 16).is_err());
    }
}
