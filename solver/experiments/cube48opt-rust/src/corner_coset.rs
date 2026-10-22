//! Experimental corner half-turn cosets. Nothing in this module builds or loads
//! a table implicitly. The caller must explicitly opt into the research CLI.
//!
//! Corner bytes and move products use this repository's `Cube` convention:
//! `p(position) = identity`, with the twist attached to the position. Put
//! `phi: S4 -> S3` for the action on the three perfect matchings of four labels.
//! The corner half-turn subgroup is
//! `H_C = {(a,b) in S4 x S4 : phi(a) == phi(b)}`, of order 96. Thus an orbit
//! `H_C*c` has 70 choices of tetrad-position mask, six relative matching actions,
//! and 3^7 orientations: 420 * 2187 = 918540 states.
//!
//! The exact table is u(c) = min_{a in H_C} d_C(a*c). Right moves are well
//! defined on H_C\\C (orbits of left multiplication). Inversion is NOT exposed as a
//! coordinate-only operation: rank the actual inverse `Cube` instead.
//!
//! Saved tables are accepted only after a distance certificate is checked:
//! unique zero at the goal, edge Lipschitz inequalities, and descending edges
//! for every nonzero value below the cap. Checksums detect accidental corruption;
//! they are not a replacement for that mathematical certificate.

use crate::cube::{Cube, MOVES};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

pub const PERM_COSET_COUNT: usize = 420;
pub const ORIENTATION_COUNT: usize = 2187;
pub const COSET_COUNT: usize = PERM_COSET_COUNT * ORIENTATION_COUNT;
pub const HALF_TURNS: [u8; 6] = [1, 4, 7, 10, 13, 16];
pub const SOLVED_INDEX: usize = 0;

const UNKNOWN: u8 = u8::MAX;
const HEADER_LEN: usize = 64;
const CHECKPOINT_MAGIC: &[u8; 8] = b"CRHCQ001";
const TABLE_MAGIC: &[u8; 8] = b"CRHCT001";
const FORMAT_VERSION: u32 = 1;
const FNV_OFFSET: u64 = 0xcbf29ce484222325;
const FNV_PRIME: u64 = 0x100000001b3;
static TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

// Lexicographic arrays represent functions, not a word of adjacent swaps.
const S3: [[u8; 3]; 6] = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2],
    [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

const fn make_masks() -> [u8; 70] {
    let mut masks = [0; 70];
    let mut value = 0_u16;
    let mut next = 0;
    while value < 256 {
        if (value as u8).count_ones() == 4 {
            masks[next] = value as u8;
            next += 1;
        }
        value += 1;
    }
    masks
}

const MASKS: [u8; 70] = make_masks();

const fn make_mask_ranks() -> [u8; 256] {
    let mut ranks = [u8::MAX; 256];
    let mut i = 0;
    while i < MASKS.len() {
        ranks[MASKS[i] as usize] = i as u8;
        i += 1;
    }
    ranks
}

const MASK_RANKS: [u8; 256] = make_mask_ranks();

fn validate_corners(cube: &Cube) -> Result<(), String> {
    let mut seen = 0_u16;
    let mut twist_sum = 0_u16;
    for &value in &cube.corners {
        if value >= 24 {
            return Err("corner coordinate received a corner byte outside 0..24".into());
        }
        let bit = 1_u16 << (value & 7);
        if seen & bit != 0 {
            return Err("corner coordinate received a duplicate corner identity".into());
        }
        seen |= bit;
        twist_sum += u16::from(value >> 3);
    }
    if seen != 255 || twist_sum % 3 != 0 {
        return Err("corner coordinate received an invalid permutation or twist sum".into());
    }
    Ok(())
}

/// Action on matchings `(01)(23), (02)(13), (03)(12)`.
/// The matching indexed by j has partner map `i -> i XOR (j+1)`.
fn matching_action(permutation: [u8; 4]) -> [u8; 3] {
    let zero_preimage = permutation.iter().position(|&value| value == 0)
        .expect("matching_action requires a permutation of 0..4");
    std::array::from_fn(|j| permutation[zero_preimage ^ (j + 1)] - 1)
}

fn relative_matching_action(alpha: [u8; 4], beta: [u8; 4]) -> [u8; 3] {
    let a = matching_action(alpha);
    let b = matching_action(beta);
    let mut inverse_a = [0_u8; 3];
    for (i, &value) in a.iter().enumerate() {
        inverse_a[usize::from(value)] = i as u8;
    }
    // Composition is phi(alpha)^-1 after phi(beta).
    std::array::from_fn(|i| inverse_a[usize::from(b[i])])
}

fn matching_lift(action: [u8; 3]) -> [u8; 4] {
    // The S3 subgroup fixing label 3 maps isomorphically onto S4/V4.
    for permutation in S3 {
        let lift = [permutation[0], permutation[1], permutation[2], 3];
        if matching_action(lift) == action {
            return lift;
        }
    }
    unreachable!("every S3 action has a unique lift fixing label 3")
}

fn permutation_rank_unchecked(cube: &Cube) -> usize {
    let mut mask = 0_u8;
    let mut alpha = [0_u8; 4];
    let mut beta = [0_u8; 4];
    let mut a_count = 0;
    let mut b_count = 0;
    for (position, &corner) in cube.corners.iter().enumerate() {
        let identity = corner & 7;
        if identity < 4 {
            mask |= 1_u8 << position;
            alpha[a_count] = identity;
            a_count += 1;
        } else {
            beta[b_count] = identity - 4;
            b_count += 1;
        }
    }
    let relative = relative_matching_action(alpha, beta);
    let relative_rank = S3.iter().position(|&action| action == relative)
        .expect("relative matching action is an S3 permutation");
    usize::from(MASK_RANKS[usize::from(mask)]) * 6 + relative_rank
}

/// Base-three orientation rank, with position 0 as the least significant digit.
/// The caller must supply valid corner bytes; only the first seven twists are
/// stored, because the eighth is fixed by their sum modulo three.
pub fn orientation_rank(cube: &Cube) -> usize {
    let mut rank = 0;
    let mut place = 1;
    for &corner in &cube.corners[..7] {
        rank += usize::from(corner >> 3) * place;
        place *= 3;
    }
    rank
}

/// Return eight twist values (0, 1 or 2), not encoded corner bytes.
pub fn orientation_unrank(mut rank: usize) -> Result<[u8; 8], String> {
    if rank >= ORIENTATION_COUNT {
        return Err("corner orientation rank is outside 0..2187".into());
    }
    let mut twists = [0_u8; 8];
    let mut sum = 0_u8;
    for twist in &mut twists[..7] {
        *twist = (rank % 3) as u8;
        rank /= 3;
        sum += *twist;
    }
    twists[7] = (3 - sum % 3) % 3;
    Ok(twists)
}

/// Checked left-H_C coordinate. Edge identities/orientations are irrelevant.
pub fn rank(cube: &Cube) -> Result<usize, String> {
    validate_corners(cube)?;
    Ok(rank_unchecked(cube))
}

/// Fast coordinate for an already validated corner state.
/// This is not memory-unsafe, but invalid input can panic and is not a cube.
pub fn rank_unchecked(cube: &Cube) -> usize {
    permutation_rank_unchecked(cube) * ORIENTATION_COUNT + orientation_rank(cube)
}

/// A deterministic representative of an H_C*c coset. The two lowest edge
/// identities are exchanged when necessary so the returned complete `Cube`
/// satisfies the corner/edge parity constraint. These edges are not a pattern.
pub fn unrank(index: usize) -> Result<Cube, String> {
    if index >= COSET_COUNT {
        return Err("corner half-turn coset rank is outside 0..918540".into());
    }
    let permutation_rank = index / ORIENTATION_COUNT;
    let twists = orientation_unrank(index % ORIENTATION_COUNT)?;
    let mask = MASKS[permutation_rank / 6];
    let beta = matching_lift(S3[permutation_rank % 6]);
    let mut cube = Cube::SOLVED;
    let mut a_next = 0_u8;
    let mut b_next = 0;
    for (position, &twist) in twists.iter().enumerate() {
        let identity = if mask & (1 << position) != 0 {
            let identity = a_next;
            a_next += 1;
            identity
        } else {
            let identity = beta[b_next] + 4;
            b_next += 1;
            identity
        };
        cube.corners[position] = identity | (twist << 3);
    }
    let mut odd = false;
    for i in 0..8 {
        for j in i + 1..8 {
            odd ^= (cube.corners[i] & 7) > (cube.corners[j] & 7);
        }
    }
    if odd {
        cube.edges.swap(0, 1);
    }
    Ok(cube)
}

/// K_C consists of zero twists and separate permutations of the two tetrads.
pub fn in_k(cube: &Cube) -> bool {
    let mut seen = 0_u16;
    for (position, &corner) in cube.corners.iter().enumerate() {
        if corner >= 8 || usize::from(corner >> 2) != position / 4 {
            return false;
        }
        let bit = 1_u16 << corner;
        if seen & bit != 0 {
            return false;
        }
        seen |= bit;
    }
    seen == 255
}

pub fn in_h(cube: &Cube) -> bool {
    if !in_k(cube) {
        return false;
    }
    let alpha = std::array::from_fn(|i| cube.corners[i]);
    let beta = std::array::from_fn(|i| cube.corners[i + 4] - 4);
    matching_action(alpha) == matching_action(beta)
}

/// Proven analytic floor; 4 is not claimed to be the sharpest possible constant.
/// Every <=3 HTM word preserving the two tetrads is a half-turn word. Hence any
/// corner in K_C\H_C, and every left/right H_C translate of it, costs at least 4.
/// H_C and K_C are normalized by spatial symmetries, so this floor is also
/// spatially and inversion invariant. It is an H-subgroup certificate, unlike
/// the unrestricted complete-corner distance.
/// Retained for compatibility; `lower_bound5` gives the stronger proved floor.
pub fn lower_bound4(cube: &Cube) -> u8 {
    if in_k(cube) && !in_h(cube) { 4 } else { 0 }
}

/// Proven analytic floor; 5 is not claimed to be the sharpest possible constant.
/// Every <=4 HTM word whose corner state lies in K_C already lies in H_C.
/// Therefore K_C\H_C costs at least 5, including every left/right H_C translate.
/// Both subgroups are normalized by spatial symmetries and closed under inverse,
/// so this is a bi-H, spatially and inversion invariant subgroup certificate.
/// See `corner96-bounds.md`, the proof of the length-at-most-four word theorem.
/// That proof was independently reviewed symbolically; no exhaustive run is
/// asserted by this API or by the accompanying unexecuted test source.
pub fn lower_bound5(cube: &Cube) -> u8 {
    if in_k(cube) && !in_h(cube) { 5 } else { 0 }
}

/// Factorized right-move transitions. All entries are derived from the existing
/// `Cube::multiplied` and `MOVES`, not from duplicated cubie move constants.
#[derive(Clone)]
pub struct CornerTransitions {
    permutation: Vec<[u16; 18]>,
    orientation: Vec<[u16; 18]>,
}

impl CornerTransitions {
    pub fn new() -> Result<Self, String> {
        if rank(&Cube::SOLVED)? != SOLVED_INDEX {
            return Err("corner coset goal rank differs from the format contract".into());
        }
        let mut permutation = Vec::with_capacity(PERM_COSET_COUNT);
        for index in 0..PERM_COSET_COUNT {
            let representative = unrank(index * ORIENTATION_COUNT)?;
            let mut row = [0_u16; 18];
            for (movement, generator) in MOVES.iter().enumerate() {
                row[movement] = (rank(&representative.multiplied(generator))?
                    / ORIENTATION_COUNT) as u16;
            }
            permutation.push(row);
        }
        let mut orientation = Vec::with_capacity(ORIENTATION_COUNT);
        for index in 0..ORIENTATION_COUNT {
            let representative = unrank(index)?;
            let row = std::array::from_fn(|movement| {
                orientation_rank(&representative.multiplied(&MOVES[movement])) as u16
            });
            orientation.push(row);
        }
        Ok(Self { permutation, orientation })
    }

    pub fn successor(&self, index: usize, movement: u8) -> Result<usize, String> {
        if index >= COSET_COUNT || movement >= 18 {
            return Err("corner transition requires a valid rank and HTM move".into());
        }
        Ok(self.successor_unchecked(index, movement))
    }

    /// Inputs must already be in range; transitions are immutable after build.
    pub fn successor_unchecked(&self, index: usize, movement: u8) -> usize {
        let m = usize::from(movement);
        usize::from(self.permutation[index / ORIENTATION_COUNT][m]) * ORIENTATION_COUNT
            + usize::from(self.orientation[index % ORIENTATION_COUNT][m])
    }

    pub fn memory_bytes(&self) -> usize {
        (self.permutation.len() + self.orientation.len()) * std::mem::size_of::<[u16; 18]>()
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BuildMode {
    Exact,
    /// Values are min(exact_distance, cap). Valid caps are 1..=254.
    Capped(u8),
}

impl BuildMode {
    fn validate(self) -> Result<(), String> {
        match self {
            Self::Capped(0 | UNKNOWN) => Err("corner PDB cap must be in 1..=254; cap zero is intentionally unsupported".into()),
            _ => Ok(()),
        }
    }

    pub fn cap(self) -> Option<u8> {
        match self { Self::Exact => None, Self::Capped(cap) => Some(cap) }
    }

    fn tag(self) -> u8 {
        match self { Self::Exact => 0, Self::Capped(cap) => cap }
    }

    fn from_tag(tag: u8) -> Result<Self, String> {
        let mode = if tag == 0 { Self::Exact } else { Self::Capped(tag) };
        mode.validate()?;
        Ok(mode)
    }

    fn should_expand(self, depth: u8) -> bool {
        match self {
            Self::Exact => true,
            Self::Capped(cap) => depth < cap - 1,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct BuildProgress {
    /// Processed queue entries, including terminal entries at cap - 1.
    pub expanded: usize,
    pub discovered: usize,
    pub pending: usize,
    pub complete: bool,
    pub maximum_discovered_depth: u8,
}

/// Resumable, single-threaded reference BFS. A budget counts complete queue
/// entries. Whenever an entry needs expansion, all 18 successors are processed,
/// so a checkpoint never describes a half-expanded vertex. Terminal entries at
/// cap - 1 are consumed without expanding them. The caller controls cancellation
/// and checkpoint intervals.
pub struct CornerBfs {
    mode: BuildMode,
    distances: Vec<u8>,
    queue: Vec<u32>,
    head: usize,
}

impl CornerBfs {
    pub fn new(mode: BuildMode) -> Result<Self, String> {
        mode.validate()?;
        let mut distances = vec![UNKNOWN; COSET_COUNT];
        distances[SOLVED_INDEX] = 0;
        Ok(Self { mode, distances, queue: vec![SOLVED_INDEX as u32], head: 0 })
    }

    pub fn mode(&self) -> BuildMode { self.mode }

    pub fn progress(&self) -> BuildProgress {
        BuildProgress {
            expanded: self.head,
            discovered: self.queue.len(),
            pending: self.queue.len() - self.head,
            complete: self.head == self.queue.len(),
            maximum_discovered_depth: self.queue.last()
                .map_or(0, |&index| self.distances[index as usize]),
        }
    }

    pub fn advance(&mut self, moves: &CornerTransitions, node_budget: usize) -> Result<BuildProgress, String> {
        let stop = self.head.saturating_add(node_budget);
        while self.head < self.queue.len() && self.head < stop {
            let index = self.queue[self.head] as usize;
            let depth = self.distances[index];
            if self.mode.should_expand(depth) {
                let next_depth = depth.checked_add(1)
                    .filter(|&value| value != UNKNOWN)
                    .ok_or_else(|| "corner BFS exceeded the representable exact distance".to_string())?;
                for movement in 0..18_u8 {
                    let next = moves.successor_unchecked(index, movement);
                    if self.distances[next] == UNKNOWN {
                        self.distances[next] = next_depth;
                        self.queue.push(next as u32);
                    }
                }
            }
            self.head += 1;
        }
        Ok(self.progress())
    }

    /// Replacement is permitted only for a valid checkpoint in this same mode
    /// and coordinate format. A complete table or unrelated file is refused.
    pub fn save_checkpoint(&self, path: &Path) -> Result<(), String> {
        let replace = if path.exists() {
            let old = read_record(path, CHECKPOINT_MAGIC)?;
            if old.mode != self.mode {
                return Err("refusing to replace a checkpoint with a different build mode".into());
            }
            true
        } else { false };
        let bytes = encode_record(CHECKPOINT_MAGIC, self.mode, self.head, &self.distances, &self.queue)?;
        write_atomic(path, &bytes, replace)
    }

    /// Check both file integrity and the partial-BFS certificate before resuming.
    /// Validation is explicit work and can be appreciably more expensive than
    /// reading the file. It never trusts a persisted queue or distance label.
    pub fn load_checkpoint(path: &Path, moves: &CornerTransitions) -> Result<Self, String> {
        let record = read_record(path, CHECKPOINT_MAGIC)?;
        let bfs = Self { mode: record.mode, distances: record.values, queue: record.queue, head: record.head };
        bfs.validate_checkpoint(moves)?;
        Ok(bfs)
    }

    pub fn validate_checkpoint(&self, moves: &CornerTransitions) -> Result<(), String> {
        self.mode.validate()?;
        if self.distances.len() != COSET_COUNT || self.queue.is_empty()
            || self.queue.len() > COSET_COUNT || self.head > self.queue.len()
            || self.queue[0] as usize != SOLVED_INDEX || self.distances[SOLVED_INDEX] != 0 {
            return Err("invalid corner BFS checkpoint shape or goal".into());
        }
        let mut seen = vec![false; COSET_COUNT];
        let mut previous_depth = 0;
        for &raw_index in &self.queue {
            let index = raw_index as usize;
            if index >= COSET_COUNT || seen[index] {
                return Err("corner BFS checkpoint queue contains an invalid or duplicate rank".into());
            }
            let depth = self.distances[index];
            if depth == UNKNOWN || depth < previous_depth
                || (index != SOLVED_INDEX && depth == 0)
                || self.mode.cap().is_some_and(|cap| depth >= cap) {
                return Err("corner BFS checkpoint has invalid or unordered queue depths".into());
            }
            seen[index] = true;
            previous_depth = depth;
        }
        for (index, &depth) in self.distances.iter().enumerate() {
            if seen[index] != (depth != UNKNOWN) {
                return Err("corner BFS checkpoint queue and discovery labels disagree".into());
            }
        }
        if self.head == self.queue.len() && self.mode == BuildMode::Exact
            && self.queue.len() != COSET_COUNT {
            return Err("completed exact corner BFS did not cover every coset".into());
        }
        // At a valid BFS checkpoint, all unknown nodes lie beyond the current
        // frontier. Assigning that lower floor to unknown nodes yields a global
        // admissibility certificate, not merely plausible queue metadata.
        let unknown_floor = if self.head < self.queue.len() {
            self.distances[self.queue[self.head] as usize].checked_add(1)
                .ok_or_else(|| "corner BFS checkpoint frontier overflow".to_string())?
        } else {
            self.mode.cap().unwrap_or_else(|| previous_depth.saturating_add(1))
        };
        if previous_depth > unknown_floor {
            return Err("corner BFS checkpoint discovers beyond the current BFS frontier".into());
        }
        for index in 0..COSET_COUNT {
            let stored = self.distances[index];
            let value = if stored == UNKNOWN { unknown_floor } else { stored };
            let mut descends = stored == UNKNOWN || stored == 0;
            for movement in 0..18_u8 {
                let next = moves.successor_unchecked(index, movement);
                let next_stored = self.distances[next];
                let next_value = if next_stored == UNKNOWN { unknown_floor } else { next_stored };
                if value.abs_diff(next_value) > 1 {
                    return Err(format!("corner BFS checkpoint violates an edge bound at {index}/{movement}"));
                }
                if stored != UNKNOWN && stored > 0 && next_stored != UNKNOWN
                    && next_stored + 1 == stored {
                    descends = true;
                }
            }
            if !descends {
                return Err(format!("corner BFS checkpoint lacks a discovered descending witness at {index}"));
            }
        }
        for &raw_index in &self.queue[..self.head] {
            let index = raw_index as usize;
            let depth = self.distances[index];
            if !self.mode.should_expand(depth) { continue; }
            for movement in 0..18_u8 {
                let next = moves.successor_unchecked(index, movement);
                if self.distances[next] == UNKNOWN || self.distances[next] > depth + 1 {
                    return Err(format!("corner BFS checkpoint marks an unexpanded vertex complete at {index}"));
                }
            }
        }
        Ok(())
    }

    /// Require queue exhaustion, then verify the completed distance certificate.
    /// An interrupted build cannot be saved as a complete pruning table.
    pub fn finish(self, moves: &CornerTransitions) -> Result<CornerPdb, String> {
        if self.head != self.queue.len() {
            return Err("corner BFS is incomplete; save a checkpoint instead".into());
        }
        let mut values = self.distances;
        for value in &mut values {
            if *value == UNKNOWN {
                *value = self.mode.cap()
                    .ok_or_else(|| "exact corner BFS left an undiscovered state".to_string())?;
            }
        }
        CornerPdb::from_values_checked(values, self.mode, moves)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct DistanceCertificate {
    pub states: usize,
    pub directed_edges_checked: usize,
    pub maximum: u8,
    pub cap: Option<u8>,
    pub values_checksum: u64,
    pub format_fingerprint: u64,
}

/// Only certified exact or capped distances can construct this public type.
#[derive(Clone)]
pub struct CornerPdb {
    values: Vec<u8>,
    mode: BuildMode,
    certificate: DistanceCertificate,
}

impl CornerPdb {
    pub fn from_values_checked(values: Vec<u8>, mode: BuildMode, moves: &CornerTransitions) -> Result<Self, String> {
        let certificate = validate_distances(&values, mode, moves)?;
        Ok(Self { values, mode, certificate })
    }

    pub fn mode(&self) -> BuildMode { self.mode }
    pub fn cap(&self) -> Option<u8> { self.mode.cap() }
    pub fn values(&self) -> &[u8] { &self.values }
    pub fn certificate(&self) -> DistanceCertificate { self.certificate }

    /// The caller supplies a valid complete state, as required by search.rs.
    pub fn lookup(&self, cube: &Cube) -> u8 {
        self.values[rank_unchecked(cube)]
    }

    pub fn lookup_checked(&self, cube: &Cube) -> Result<u8, String> {
        Ok(self.values[rank(cube)?])
    }

    pub fn lookup_index(&self, index: usize) -> Result<u8, String> {
        self.values.get(index).copied()
            .ok_or_else(|| "corner table index is outside its coordinate range".into())
    }

    pub fn validate(&self, moves: &CornerTransitions) -> Result<DistanceCertificate, String> {
        validate_distances(&self.values, self.mode, moves)
    }

    /// Complete tables are immutable artifacts: refuse to overwrite any file.
    pub fn save(&self, path: &Path) -> Result<(), String> {
        let bytes = encode_record(TABLE_MAGIC, self.mode, 0, &self.values, &[])?;
        write_atomic(path, &bytes, false)
    }

    /// Loading always rechecks the mathematical distance certificate. The
    /// persisted checksum/fingerprint alone never authorizes search pruning.
    pub fn load(path: &Path, moves: &CornerTransitions) -> Result<Self, String> {
        let record = read_record(path, TABLE_MAGIC)?;
        if record.head != 0 || !record.queue.is_empty() {
            return Err("complete corner table contains checkpoint queue data".into());
        }
        Self::from_values_checked(record.values, record.mode, moves)
    }
}

pub fn validate_distances(values: &[u8], mode: BuildMode, moves: &CornerTransitions) -> Result<DistanceCertificate, String> {
    mode.validate()?;
    if values.len() != COSET_COUNT || values[SOLVED_INDEX] != 0 {
        return Err("corner distance certificate has an invalid size or goal value".into());
    }
    let mut maximum = 0;
    for (index, &value) in values.iter().enumerate() {
        if value == UNKNOWN || (value == 0 && index != SOLVED_INDEX)
            || mode.cap().is_some_and(|cap| value > cap) {
            return Err(format!("corner distance certificate has an invalid value at {index}"));
        }
        maximum = maximum.max(value);
        let needs_descent = value > 0 && mode.cap().is_none_or(|cap| value < cap);
        let mut descends = !needs_descent;
        for movement in 0..18_u8 {
            let next = moves.successor_unchecked(index, movement);
            let neighbor = values[next];
            if neighbor == UNKNOWN || value.abs_diff(neighbor) > 1 {
                return Err(format!("corner distance certificate violates an edge bound at {index}/{movement}"));
            }
            if needs_descent && neighbor.checked_add(1) == Some(value) {
                descends = true;
            }
        }
        if !descends {
            return Err(format!("corner distance certificate lacks a descending edge at {index}"));
        }
    }
    Ok(DistanceCertificate {
        states: COSET_COUNT,
        directed_edges_checked: COSET_COUNT * 18,
        maximum,
        cap: mode.cap(),
        values_checksum: fnv(values),
        format_fingerprint: format_fingerprint(),
    })
}

/// Binds a file to the coordinate convention and the actual repository moves.
/// This is an accidental-mismatch detector, not a cryptographic signature.
pub fn format_fingerprint() -> u64 {
    let mut hash = FNV_OFFSET;
    for &byte in b"corner-left-H-v1;mask=numeric-pop4;sigma=phiA^-1*phiB;co=little-base3-7;rank=perm*2187+co" {
        hash = fnv_byte(hash, byte);
    }
    for movement in &MOVES {
        for &byte in &movement.corners { hash = fnv_byte(hash, byte); }
    }
    hash
}

fn fnv_byte(hash: u64, byte: u8) -> u64 {
    (hash ^ u64::from(byte)).wrapping_mul(FNV_PRIME)
}

fn fnv(bytes: &[u8]) -> u64 {
    bytes.iter().fold(FNV_OFFSET, |hash, &byte| fnv_byte(hash, byte))
}

fn record_checksum(bytes: &[u8]) -> u64 {
    bytes.iter().enumerate().fold(FNV_OFFSET, |hash, (index, &byte)| {
        fnv_byte(hash, if (48..56).contains(&index) { 0 } else { byte })
    })
}

struct Record {
    mode: BuildMode,
    head: usize,
    values: Vec<u8>,
    queue: Vec<u32>,
}

fn encode_record(magic: &[u8; 8], mode: BuildMode, head: usize, values: &[u8], queue: &[u32]) -> Result<Vec<u8>, String> {
    mode.validate()?;
    if values.len() != COSET_COUNT || queue.len() > COSET_COUNT || head > queue.len() {
        return Err("invalid corner table/checkpoint serialization shape".into());
    }
    let mut bytes = vec![0_u8; HEADER_LEN];
    bytes[..8].copy_from_slice(magic);
    bytes[8..12].copy_from_slice(&FORMAT_VERSION.to_le_bytes());
    bytes[12..16].copy_from_slice(&(COSET_COUNT as u32).to_le_bytes());
    bytes[16] = mode.tag();
    bytes[24..32].copy_from_slice(&format_fingerprint().to_le_bytes());
    bytes[32..40].copy_from_slice(&(head as u64).to_le_bytes());
    bytes[40..48].copy_from_slice(&(queue.len() as u64).to_le_bytes());
    bytes.extend_from_slice(values);
    for &index in queue { bytes.extend_from_slice(&index.to_le_bytes()); }
    let checksum = record_checksum(&bytes);
    bytes[48..56].copy_from_slice(&checksum.to_le_bytes());
    Ok(bytes)
}

fn read_record(path: &Path, expected_magic: &[u8; 8]) -> Result<Record, String> {
    let file = File::open(path).map_err(|error| format!("cannot open {}: {error}", path.display()))?;
    let maximum = HEADER_LEN + COSET_COUNT * 5;
    let mut bytes = Vec::new();
    file.take(maximum as u64 + 1).read_to_end(&mut bytes)
        .map_err(|error| format!("cannot read {}: {error}", path.display()))?;
    if bytes.len() < HEADER_LEN || bytes.len() > maximum || &bytes[..8] != expected_magic {
        return Err("wrong corner file kind, truncated header, or oversized file".into());
    }
    let u32_at = |at: usize| u32::from_le_bytes(bytes[at..at + 4].try_into().expect("checked header"));
    let u64_at = |at: usize| u64::from_le_bytes(bytes[at..at + 8].try_into().expect("checked header"));
    if u32_at(8) != FORMAT_VERSION || u32_at(12) as usize != COSET_COUNT
        || bytes[17..24].iter().any(|&value| value != 0)
        || bytes[56..64].iter().any(|&value| value != 0)
        || u64_at(24) != format_fingerprint() {
        return Err("corner file version, dimensions, reserved bytes or move fingerprint differs".into());
    }
    let mode = BuildMode::from_tag(bytes[16])?;
    let head = usize::try_from(u64_at(32)).map_err(|_| "corner checkpoint head exceeds usize")?;
    let queue_len = usize::try_from(u64_at(40)).map_err(|_| "corner checkpoint queue exceeds usize")?;
    if queue_len > COSET_COUNT || head > queue_len
        || bytes.len() != HEADER_LEN + COSET_COUNT + queue_len * 4 {
        return Err("corner file payload length or queue dimensions differ".into());
    }
    if u64_at(48) != record_checksum(&bytes) {
        return Err("corner file checksum mismatch".into());
    }
    let values = bytes[HEADER_LEN..HEADER_LEN + COSET_COUNT].to_vec();
    let queue = bytes[HEADER_LEN + COSET_COUNT..].chunks_exact(4)
        .map(|chunk| u32::from_le_bytes(chunk.try_into().expect("four-byte queue item")))
        .collect();
    Ok(Record { mode, head, values, queue })
}

fn write_atomic(path: &Path, bytes: &[u8], replace_checkpoint: bool) -> Result<(), String> {
    if !replace_checkpoint && path.exists() {
        return Err(format!("refusing to overwrite existing file {}", path.display()));
    }
    let name = path.file_name().ok_or_else(|| "corner output path has no filename".to_string())?;
    let mut temporary_name = name.to_os_string();
    temporary_name.push(format!(".tmp-{}-{}", std::process::id(), TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed)));
    let temporary = path.with_file_name(temporary_name);
    let mut temporary_created = false;
    let result = (|| -> Result<(), String> {
        let mut file = OpenOptions::new().write(true).create_new(true).open(&temporary)
            .map_err(|error| format!("cannot create {}: {error}", temporary.display()))?;
        temporary_created = true;
        file.write_all(bytes).map_err(|error| format!("cannot write {}: {error}", temporary.display()))?;
        file.sync_all().map_err(|error| format!("cannot sync {}: {error}", temporary.display()))?;
        drop(file);
        if replace_checkpoint {
            // Never remove the old checkpoint first. On a platform where rename
            // cannot replace it atomically, report the error and preserve it.
            fs::rename(&temporary, path)
                .map_err(|error| format!("cannot atomically replace {}: {error}", path.display()))?;
            temporary_created = false;
        } else {
            // hard_link is an atomic no-clobber publication of the already
            // synced temporary inode. std::fs::rename would silently overwrite
            // an existing complete table in a race after the existence check.
            fs::hard_link(&temporary, path)
                .map_err(|error| format!("cannot publish new {} without overwriting: {error}", path.display()))?;
            fs::remove_file(&temporary)
                .map_err(|error| format!("published {}, but cannot remove its temporary link: {error}", path.display()))?;
            temporary_created = false;
        }
        #[cfg(unix)]
        {
            let parent = path.parent().filter(|directory| !directory.as_os_str().is_empty())
                .unwrap_or_else(|| Path::new("."));
            File::open(parent).and_then(|directory| directory.sync_all())
                .map_err(|error| format!("cannot sync corner output directory {}: {error}", parent.display()))?;
        }
        Ok(())
    })();
    if result.is_err() && temporary_created { let _ = fs::remove_file(&temporary); }
    result
}
