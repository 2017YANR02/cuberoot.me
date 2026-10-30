//! Resumable Opt11 orchestration around the shared full-pattern generator.
//! Checkpoints retain incomplete bounds, exact BFS slots and the suffix cursor
//! together. They cannot pass the final PDB reader. Local CLI remains disabled.
use crate::{
    eo_table::DEFAULT_BASE,
    opt10_generate::{generate_resumable, GenerationConfig, GenerationResume},
    opt11::{AtomicOpt11Table, Opt11Coordinates, Opt11Header},
};
use std::{
    collections::VecDeque,
    fs::{self, File, OpenOptions},
    path::{Path, PathBuf},
    sync::Mutex,
};

// Bump when generator enumeration/coordinate semantics or resume layout change.
const STATE_MAGIC: &[u8; 16] = b"CBRT-EO11-GEN01\0";
const STATE_HEADER: usize = 64;

#[derive(Clone, Copy)]
enum Implementation {
    Baseline,
    #[cfg(feature = "opt11-generation-candidates")]
    Candidate(crate::opt11_generate_candidate::Opt11GenerationCandidate),
}

impl Implementation {
    fn magic(self) -> &'static [u8; 16] {
        match self {
            Self::Baseline => STATE_MAGIC,
            #[cfg(feature = "opt11-generation-candidates")]
            Self::Candidate(candidate) => candidate.checkpoint_magic(),
        }
    }

    fn checkpoint_tag(self) -> Option<&'static str> {
        match self {
            Self::Baseline => None,
            #[cfg(feature = "opt11-generation-candidates")]
            Self::Candidate(candidate) => Some(candidate.id()),
        }
    }
}

fn encode(state: &GenerationResume, magic: &[u8; 16]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(STATE_HEADER + state.short_slots.len() * 8);
    bytes.extend_from_slice(magic);
    bytes.extend_from_slice(&[state.config.short_depth, state.config.max_depth, state.completed_bfs_depth, 0]);
    bytes.extend_from_slice(&(state.config.threads as u32).to_le_bytes());
    for n in [state.config.short_capacity as u64, state.config.max_short_states as u64,
        state.next_suffix_slot as u64, state.expanded, state.short_slots.len() as u64] {
        bytes.extend_from_slice(&n.to_le_bytes());
    }
    for n in &state.short_slots { bytes.extend_from_slice(&n.to_le_bytes()); }
    bytes
}

fn decode(bytes: &[u8], config: GenerationConfig, magic: &[u8; 16]) -> Result<GenerationResume, String> {
    if bytes.len() < STATE_HEADER || &bytes[..16] != magic || bytes[19] != 0 {
        return Err("Opt11 generator checkpoint version or candidate differs".into());
    }
    let u64_at = |at| u64::from_le_bytes(bytes[at..at + 8].try_into().unwrap());
    if bytes.len() != STATE_HEADER + config.short_capacity * 8
        || bytes[16] != config.short_depth || bytes[17] != config.max_depth
        || u32::from_le_bytes(bytes[20..24].try_into().unwrap()) as usize != config.threads
        || u64_at(24) != config.short_capacity as u64 || u64_at(32) != config.max_short_states as u64
        || u64_at(56) != config.short_capacity as u64 || bytes[18] > config.short_depth
        || u64_at(40) > config.short_capacity as u64
        || bytes[18] < config.short_depth && u64_at(40) != 0 {
        return Err("Opt11 generator checkpoint configuration or cursor differs".into());
    }
    Ok(GenerationResume {
        config, completed_bfs_depth: bytes[18], next_suffix_slot: u64_at(40) as usize,
        expanded: u64_at(48),
        short_slots: bytes[STATE_HEADER..].chunks_exact(8)
            .map(|chunk| u64::from_le_bytes(chunk.try_into().unwrap())).collect(),
    })
}

fn checkpoint_dir(output: &Path, implementation: Implementation) -> PathBuf {
    let mut name = output.as_os_str().to_os_string();
    if let Some(tag) = implementation.checkpoint_tag() {
        name.push(".");
        name.push(tag);
    }
    name.push(".checkpoints");
    PathBuf::from(name)
}

struct Lock(PathBuf, File);
impl Drop for Lock {
    fn drop(&mut self) { let _ = fs::remove_file(&self.0); }
}

/// This library operation is implemented for a future authorized runner.
/// It is not called by any enabled CLI, daily job or automatic table loader.
pub fn generate_to(snapshot: &[u8], output: &Path, threads: usize) -> Result<Opt11Header, String> {
    generate_with(snapshot, output, threads, Implementation::Baseline)
}

/// Independent candidate journal, same final table format. Not reachable from
/// an enabled CLI. This does not promote a candidate or authorize computation.
#[cfg(feature = "opt11-generation-candidates")]
pub fn generate_candidate_to(
    snapshot: &[u8],
    output: &Path,
    threads: usize,
    candidate: crate::opt11_generate_candidate::Opt11GenerationCandidate,
) -> Result<Opt11Header, String> {
    generate_with(snapshot, output, threads, Implementation::Candidate(candidate))
}

fn generate_with(
    snapshot: &[u8], output: &Path, threads: usize, implementation: Implementation,
) -> Result<Opt11Header, String> {
    let available = std::thread::available_parallelism().map_err(|e| e.to_string())?.get().min(16);
    if threads == 0 || threads > available { return Err(format!("generation threads must be 1..={available}")); }
    if output.exists() { return Err("refusing to replace an existing Opt11 table".into()); }
    let directory = checkpoint_dir(output, implementation);
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    // All implementations targeting one output share the original B0 lock;
    // journals remain separate but cannot generate that output concurrently.
    let lock_directory = checkpoint_dir(output, Implementation::Baseline);
    fs::create_dir_all(&lock_directory).map_err(|e| e.to_string())?;
    let lock_path = lock_directory.join("generation.lock");
    let lock_file = OpenOptions::new().write(true).create_new(true).open(&lock_path)
        .map_err(|e| format!("Opt11 generation lock: {e}; a stale lock requires manual review"))?;
    let _lock = Lock(lock_path, lock_file);
    // Another owner may have published after the pre-lock check and released
    // its lock. Recheck before coordinates, checkpoint I/O or PDB allocation.
    if output.exists() { return Err("refusing to replace an existing Opt11 table".into()); }
    let mut committed = Vec::new();
    let mut sequence = 0u64;
    for entry in fs::read_dir(&directory).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue; };
        let stem = name.strip_suffix(".checkpoint.partial")
            .or_else(|| name.strip_suffix(".checkpoint"));
        let Some(stem) = stem else { continue; };
        if stem.len() != 20 || !stem.bytes().all(|b| b.is_ascii_digit()) { continue; }
        let n: u64 = stem.parse().map_err(|_| "checkpoint sequence overflow")?;
        sequence = sequence.max(n.checked_add(1).ok_or("checkpoint sequence overflow")?);
        if name.ends_with(".checkpoint") { committed.push((n, entry.path())); }
    }
    committed.sort_by_key(|(n, _)| *n);
    let config = GenerationConfig { threads, ..GenerationConfig::default() };
    let coordinates = Opt11Coordinates::from_opt9_snapshot(snapshot)?;
    let (table, resume) = if let Some((_, path)) = committed.last() {
        // Fail on a corrupt newest checkpoint; never silently discard progress
        // and start over or fall back to a differently bound artifact.
        let (table, state) = AtomicOpt11Table::load_checkpoint(path, snapshot)?;
        let resume = decode(&state, config, implementation.magic())?;
        eprintln!("Opt11 resume: {}", path.display());
        (table, Some(resume))
    } else { (AtomicOpt11Table::new(DEFAULT_BASE)?, None) };
    let journal = Mutex::new((sequence, committed.into_iter().map(|(_, p)| p).collect::<VecDeque<_>>()));
    let checkpoint = |state: &GenerationResume| -> Result<(), String> {
        let mut journal = journal.lock().map_err(|_| "Opt11 checkpoint lock poisoned")?;
        let path = directory.join(format!("{:020}.checkpoint", journal.0));
        table.write_checkpoint(&path, snapshot, &encode(state, implementation.magic()))?;
        journal.0 = journal.0.checked_add(1).ok_or("checkpoint sequence overflow")?;
        journal.1.push_back(path);
        // Publish+fsync the new snapshot before removing older committed ones.
        // Keep the preceding snapshot as well; interrupted .partial files stay.
        while journal.1.len() > 2 {
            fs::remove_file(journal.1.front().unwrap()).map_err(|e| e.to_string())?;
            journal.1.pop_front();
        }
        Ok(())
    };
    let progress = |p: crate::opt10_generate::GenerationProgress| {
        eprintln!("Opt11 {:?}: depth={} short={} seeds={}/{} expanded={} elapsed={:.1}s",
            p.stage, p.depth, p.short_states, p.seeds_done, p.seeds_total, p.expanded, p.seconds);
    };
    let summary = match implementation {
        Implementation::Baseline => generate_resumable(
            &coordinates, &table, config, resume, Some(&checkpoint), progress,
        ),
        #[cfg(feature = "opt11-generation-candidates")]
        Implementation::Candidate(candidate) => crate::opt11_generate_candidate::generate_candidate_resumable(
            candidate, &coordinates, &table, config, resume, Some(&checkpoint), progress,
        ),
    }?;
    table.write_complete(output, snapshot, summary.completed_depth)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resume_state_roundtrip_and_mismatched_config() {
        let config = GenerationConfig { threads: 1, short_depth: 2, max_depth: 3, short_capacity: 16, max_short_states: 8 };
        let state = GenerationResume { config, completed_bfs_depth: 2, next_suffix_slot: 8,
            expanded: 123, short_slots: vec![0; 16] };
        let bytes = encode(&state, STATE_MAGIC);
        let restored = decode(&bytes, config, STATE_MAGIC).unwrap();
        assert_eq!(restored.next_suffix_slot, 8);
        assert_eq!(restored.expanded, 123);
        assert_eq!(restored.short_slots, state.short_slots);
        assert!(decode(&bytes, GenerationConfig { threads: 2, ..config }, STATE_MAGIC).is_err());
        assert!(decode(&bytes[..63], config, STATE_MAGIC).is_err());
        let mut corrupt = bytes;
        corrupt[18] = 1;
        assert!(decode(&corrupt, config, STATE_MAGIC).is_err());
    }

    // Written only; no fixture or generator was executed during preparation.
    #[test]
    #[cfg(feature = "opt11-generation-candidates")]
    fn candidate_checkpoints_cannot_be_resumed_as_another_implementation() {
        use crate::opt11_generate_candidate::Opt11GenerationCandidate::{PreparedAliases, UniqueAliases};
        let variants = [Implementation::Baseline, Implementation::Candidate(UniqueAliases),
            Implementation::Candidate(PreparedAliases)];
        let config = GenerationConfig { threads: 1, short_depth: 2, max_depth: 3,
            short_capacity: 16, max_short_states: 8 };
        let state = GenerationResume { config, completed_bfs_depth: 2, next_suffix_slot: 8,
            expanded: 123, short_slots: vec![0; 16] };
        for (i, variant) in variants.iter().enumerate() {
            let bytes = encode(&state, variant.magic());
            for (j, other) in variants.iter().enumerate() {
                assert_eq!(decode(&bytes, config, other.magic()).is_ok(), i == j);
                assert_eq!(checkpoint_dir(Path::new("opt11.dat"), *variant)
                    == checkpoint_dir(Path::new("opt11.dat"), *other), i == j);
            }
        }
        assert_eq!(checkpoint_dir(Path::new("opt11.dat"), Implementation::Baseline),
            PathBuf::from("opt11.dat.checkpoints"));
    }
}
