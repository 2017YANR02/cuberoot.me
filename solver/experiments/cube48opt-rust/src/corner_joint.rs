//! Full corners modulo free spatial rotation, plus distinguished edges.
//!
//! Right spatial rotations preserve the set of 18 HTM generators by
//! conjugation. Quotienting by them therefore projects every concrete move
//! to one unit-cost edge. Forgetting untracked edge cubies is another graph
//! projection. Exact distance to the projected solved state is admissible.
//! It is a FULL-STATE distance certificate, NOT a left-H coset bound: never
//! feed it into the NISS side bounds, BPMX or quarter-turn pruning.
//!
//! Fix corner 0 at position 0 with twist 0. The coordinate is
//! 7! * 3^6 * 24 = 88,179,840 states. Normalization after a face move depends
//! only on that move, so permutation, orientation and edge transitions factor.

use crate::{coord::CoordTables, cube::{Cube, MOVES}};
use std::{fs::{self, File, OpenOptions}, io::{Read, Write, BufReader, BufWriter}, path::Path,
    time::{Instant, SystemTime, UNIX_EPOCH}};

pub const PERMUTATIONS: usize = 5040;
pub const ORIENTATIONS: usize = 729;
pub const EDGES: usize = 24;
pub const COUNT: usize = PERMUTATIONS * ORIENTATIONS * EDGES;
pub const PAIR_EDGES: usize = 12 * 11 * 4;
pub const PAIR_COUNT: usize = PERMUTATIONS * ORIENTATIONS * PAIR_EDGES;
pub type PairTransitions = JointTransitions<PAIR_EDGES>;
pub type PairPdb = JointPdb<PAIR_EDGES>;
const FACT: [usize; 8] = [1, 1, 2, 6, 24, 120, 720, 5040];
const UNKNOWN: u8 = 255;
const MAGIC: &[u8; 8] = b"CJOINT01";
const CHECKPOINT: &[u8; 8] = b"CJOINTC1";
const LAYER_CHECKPOINT: &[u8; 8] = b"CJOINTL1";

fn permutation(cube: &Cube) -> usize {
    let mut used = 1u16;
    let mut result = 0;
    for i in 1..8 {
        let identity = cube.corners[i] & 7;
        let smaller = (((1u16 << identity) - 1) & !used).count_ones() as usize;
        result += smaller * FACT[7 - i];
        used |= 1 << identity;
    }
    result
}

fn orientation(cube: &Cube) -> usize {
    cube.corners[1..7].iter().rev().fold(0, |acc, &c| acc * 3 + usize::from(c >> 3))
}

fn edge<const E: usize>(cube: &Cube) -> usize {
    let position = cube.edges.iter().position(|&e| e >> 1 == 0).unwrap();
    let flip = usize::from(cube.edges[position] & 1);
    if E == EDGES { return position * 2 + flip; }
    let second = cube.edges.iter().position(|&e| e >> 1 == 1).unwrap();
    (position * 11 + second - usize::from(second > position)) * 4
        + flip * 2 + usize::from(cube.edges[second] & 1)
}

fn representative<const E: usize>(p: usize, mut o: usize, e: usize) -> Cube {
    let mut cube = Cube::SOLVED;
    let mut p = p;
    let mut available = vec![1u8, 2, 3, 4, 5, 6, 7];
    for i in 1..8 {
        let digit = p / FACT[7 - i]; p %= FACT[7 - i];
        cube.corners[i] = available.remove(digit);
    }
    let mut twist = 0u8;
    for i in 1..7 {
        let value = (o % 3) as u8; o /= 3;
        cube.corners[i] |= value << 3; twist += value;
    }
    cube.corners[7] |= ((3 - twist % 3) % 3) << 3;
    let (first, second, first_flip, second_flip) = if E == EDGES {
        (e / 2, usize::MAX, e & 1, 0)
    } else {
        let first = e / 44;
        let compressed_second = e / 4 % 11;
        (first, compressed_second + usize::from(compressed_second >= first), (e >> 1) & 1, e & 1)
    };
    cube.edges.swap(0, first);
    if E == PAIR_EDGES {
        let source = cube.edges.iter().position(|&v| v >> 1 == 1).unwrap();
        cube.edges.swap(source, second);
        cube.edges[second] ^= second_flip as u8;
    }
    cube.edges[first] ^= first_flip as u8;
    let other: Vec<_> = (0..12).filter(|&i| i != first && i != second).collect();
    cube.edges[other[0]] ^= (first_flip ^ second_flip) as u8;
    let mut odd = false;
    for i in 0..8 { for j in i+1..8 { odd ^= (cube.corners[i] & 7) > (cube.corners[j] & 7); } }
    for i in 0..12 { for j in i+1..12 { odd ^= (cube.edges[i] >> 1) > (cube.edges[j] >> 1); } }
    if odd { cube.edges.swap(other[0], other[1]); }
    cube
}

pub struct JointTransitions<const E: usize = EDGES> {
    rotations: Vec<Cube>,
    anchor: [usize; 24],
    permutation: Vec<[u16; 18]>,
    orientation: Vec<[u16; 18]>,
    edge: [[u16; 18]; E],
    fingerprint: u64,
}

fn hash(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf29ce484222325, |h, &b| (h ^ u64::from(b)).wrapping_mul(0x100000001b3))
}

impl<const E: usize> JointTransitions<E> {
    pub fn new(small: &CoordTables) -> Result<Self, String> {
        if E != EDGES && E != PAIR_EDGES { return Err("unsupported joint edge projection".into()); }
        let rotations = small.proper_rotations();
        if rotations.len() != 24 { return Err("joint geometry needs 24 proper rotations".into()); }
        let mut anchor = [usize::MAX; 24];
        for (i, r) in rotations.iter().enumerate() {
            let c = r.corners[0];
            let key = usize::from(c & 7) + 8 * usize::from((3 - (c >> 3)) % 3);
            if anchor[key] != usize::MAX { return Err("rotation does not uniquely fix the anchor".into()); }
            anchor[key] = i;
            for m in MOVES {
                if !MOVES.contains(&r.inverse().multiplied(&m).multiplied(r)) {
                    return Err("rotation does not preserve full-cube HTM moves".into());
                }
            }
            for s in &rotations {
                if !rotations.contains(&r.multiplied(s)) { return Err("rotation group is not closed".into()); }
            }
        }
        if anchor.contains(&usize::MAX) { return Err("rotation anchor coverage is incomplete".into()); }
        let mut table = Self { rotations, anchor, permutation: Vec::new(), orientation: Vec::new(),
            edge: [[0; 18]; E], fingerprint: 0 };
        let normalized: Vec<_> = MOVES.iter().map(|m| table.normalize(m)).collect();
        for m in &normalized {
            if m.corners[0] != 0 || !normalized.contains(&m.inverse()) {
                return Err("normalized generator is not anchored or inverse-closed".into());
            }
        }
        for p in 0..PERMUTATIONS {
            let cube = representative::<E>(p, 0, 0);
            table.permutation.push(std::array::from_fn(|m| permutation(&cube.multiplied(&normalized[m])) as u16));
        }
        for o in 0..ORIENTATIONS {
            let cube = representative::<E>(0, o, 0);
            table.orientation.push(std::array::from_fn(|m| orientation(&cube.multiplied(&normalized[m])) as u16));
        }
        for e in 0..E {
            let cube = representative::<E>(0, 0, e);
            table.edge[e] = std::array::from_fn(|m| edge::<E>(&cube.multiplied(&normalized[m])) as u16);
        }
        let mut fingerprint = Vec::new();
        for r in &table.rotations { fingerprint.extend_from_slice(&r.to_bytes()); }
        for m in MOVES { fingerprint.extend_from_slice(&m.to_bytes()); }
        // Preserve the measured one-edge format exactly; two identities are
        // a different projection even when the rotation/move geometry agrees.
        if E == PAIR_EDGES { fingerprint.extend_from_slice(b"two-distinct-edges-0-1"); }
        table.fingerprint = hash(&fingerprint);
        if table.index(&Cube::SOLVED) != 0 { return Err("joint solved index is not zero".into()); }
        table.verify_small()?;
        if E == PAIR_EDGES {
            let one = JointTransitions::<EDGES>::new(small)?;
            if table.permutation != one.permutation || table.orientation != one.orientation {
                return Err("joint pair changed the original corner projection".into());
            }
            let forget_second = |e: usize| e / 44 * 2 + ((e >> 1) & 1);
            for e in 0..E { for m in 0..18 {
                if forget_second(usize::from(table.edge[e][m])) != usize::from(one.edge[forget_second(e)][m]) {
                    return Err("forgetting the second edge is not a graph projection".into());
                }
            } }
        }
        Ok(table)
    }

    fn normalize(&self, cube: &Cube) -> Cube {
        let position = cube.corners.iter().position(|&c| c & 7 == 0).unwrap();
        let key = position + 8 * usize::from(cube.corners[position] >> 3);
        cube.multiplied(&self.rotations[self.anchor[key]])
    }

    pub fn index(&self, cube: &Cube) -> usize {
        let normalized = self.normalize(cube);
        (permutation(&normalized) * ORIENTATIONS + orientation(&normalized)) * E + edge::<E>(&normalized)
    }

    #[inline(always)]
    fn successor(&self, index: usize, movement: usize) -> usize {
        let p = index / (ORIENTATIONS * E);
        let o = index / E % ORIENTATIONS;
        let e = index % E;
        (usize::from(self.permutation[p][movement]) * ORIENTATIONS
            + usize::from(self.orientation[o][movement])) * E + usize::from(self.edge[e][movement])
    }

    pub fn verify_small(&self) -> Result<(), String> {
        let mut cube = Cube::SOLVED;
        let mut seed = 0x4839abcdu64;
        let check = |cube: Cube| -> Result<(), String> {
            cube.validate()?;
            let key = self.index(&cube);
            for m in 0..18 {
                // Gauge changes relabel face moves. Compare successor SETS,
                // not the same face name in two differently oriented frames.
                let normalized = self.normalize(&cube);
                if self.index(&normalized.moved(m as u8)) != self.successor(key, m) {
                    return Err("joint factorized transition differs from cubie arithmetic".into());
                }
            }
            let mut actual: Vec<_> = (0..18).map(|m| self.index(&cube.moved(m))).collect();
            let mut abstracted: Vec<_> = (0..18).map(|m| self.successor(key, m)).collect();
            actual.sort_unstable(); abstracted.sort_unstable();
            if actual != abstracted { return Err("joint projection does not preserve successor multiset".into()); }
            for r in &self.rotations {
                if self.index(&cube.multiplied(r)) != key { return Err("joint gauge is not rotation invariant".into()); }
            }
            Ok(())
        };
        for p in 0..PERMUTATIONS { let c = representative::<E>(p, 0, 0); if self.index(&c) != p * ORIENTATIONS * E { return Err("joint permutation rank failed".into()); } check(c)?; }
        for o in 0..ORIENTATIONS { let c = representative::<E>(0, o, 0); if self.index(&c) != o * E { return Err("joint orientation rank failed".into()); } check(c)?; }
        for e in 0..E { let c = representative::<E>(0, 0, e); if self.index(&c) != e { return Err("joint edge rank failed".into()); } check(c)?; }
        for _ in 0..4096 {
            seed ^= seed << 13; seed ^= seed >> 7; seed ^= seed << 17;
            cube = cube.moved((seed % 18) as u8); check(cube)?; check(cube.inverse())?;
        }
        Ok(())
    }
}

fn read_u64(reader: &mut impl Read) -> Result<u64, String> {
    let mut bytes = [0; 8]; reader.read_exact(&mut bytes).map_err(|e| e.to_string())?;
    Ok(u64::from_le_bytes(bytes))
}

fn atomic(path: &Path, write: impl FnOnce(&mut BufWriter<File>) -> Result<(), String>) -> Result<(), String> {
    // Interrupted partial writes remain as evidence; a valid checkpoint is
    // never replaced until the next complete write has reached disk.
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
    let temporary = path.with_extension(format!("partial-{}-{nonce}", std::process::id()));
    let mut writer = BufWriter::new(OpenOptions::new().write(true).create_new(true).open(&temporary).map_err(|e| e.to_string())?);
    write(&mut writer)?;
    writer.flush().map_err(|e| e.to_string())?;
    writer.get_ref().sync_all().map_err(|e| e.to_string())?;
    fs::rename(temporary, path).map_err(|e| e.to_string())?;
    File::open(path.parent().ok_or("joint output has no parent")?).and_then(|f| f.sync_all()).map_err(|e| e.to_string())
}

fn save_checkpoint(path: &Path, fingerprint: u64, head: usize, values: &[u8], queue: &[u32]) -> Result<(), String> {
    atomic(path, |writer| {
        writer.write_all(CHECKPOINT).map_err(|e| e.to_string())?;
        for value in [fingerprint, head as u64, queue.len() as u64] { writer.write_all(&value.to_le_bytes()).map_err(|e| e.to_string())?; }
        writer.write_all(values).map_err(|e| e.to_string())?;
        for &value in queue { writer.write_all(&value.to_le_bytes()).map_err(|e| e.to_string())?; }
        Ok(())
    })
}

fn save_layer(path: &Path, fingerprint: u64, frontier: u8, values: &[u8]) -> Result<(), String> {
    let checksum = hash(values);
    atomic(path, |writer| {
        writer.write_all(LAYER_CHECKPOINT).map_err(|e| e.to_string())?;
        for value in [fingerprint, values.len() as u64, u64::from(frontier), checksum] {
            writer.write_all(&value.to_le_bytes()).map_err(|e| e.to_string())?;
        }
        writer.write_all(values).map_err(|e| e.to_string())
    })
}

pub struct JointPdb<const E: usize = EDGES> { values: Vec<u8>, pub maximum: u8 }

impl JointPdb {
    pub fn build(transitions: &JointTransitions, output: &Path, checkpoint: &Path) -> Result<Self, String> {
        if output == checkpoint || output.exists() { return Err("joint output must be new and distinct from its checkpoint".into()); }
        let mut values = vec![UNKNOWN; COUNT];
        let mut queue = Vec::<u32>::with_capacity(COUNT);
        let mut head = 0usize;
        if checkpoint.exists() {
            let mut reader = BufReader::new(File::open(checkpoint).map_err(|e| e.to_string())?);
            let mut magic = [0; 8]; reader.read_exact(&mut magic).map_err(|e| e.to_string())?;
            if &magic != CHECKPOINT || read_u64(&mut reader)? != transitions.fingerprint { return Err("joint checkpoint identity differs".into()); }
            head = read_u64(&mut reader)? as usize;
            let len = read_u64(&mut reader)? as usize;
            if head > len || len > COUNT { return Err("invalid joint checkpoint queue bounds".into()); }
            reader.read_exact(&mut values).map_err(|e| e.to_string())?;
            let mut seen = vec![false; COUNT];
            let mut previous = 0;
            for _ in 0..len {
                let mut b = [0; 4]; reader.read_exact(&mut b).map_err(|e| e.to_string())?;
                let i = u32::from_le_bytes(b) as usize;
                if i >= COUNT || seen[i] || values[i] >= UNKNOWN - 1 || values[i] < previous { return Err("invalid joint checkpoint ordering".into()); }
                seen[i] = true; previous = values[i]; queue.push(i as u32);
            }
            if queue.first() != Some(&0) || values[0] != 0 || values.iter().enumerate().any(|(i,&d)| seen[i] != (d != UNKNOWN)) {
                return Err("joint checkpoint coverage differs".into());
            }
            for &i in &queue[1..] {
                let distance = values[i as usize];
                if distance == 0 || !(0..18).any(|m| values[transitions.successor(i as usize, m)].checked_add(1) == Some(distance)) {
                    return Err("joint checkpoint lacks a path to its unique goal".into());
                }
            }
            // Expanded prefix must have exposed every outgoing neighbor.
            for &i in &queue[..head] { for m in 0..18 {
                let next = transitions.successor(i as usize, m);
                if values[next] > values[i as usize] + 1 { return Err("joint checkpoint omits an expanded successor".into()); }
            } }
            let mut end = [0]; if reader.read(&mut end).map_err(|e| e.to_string())? != 0 { return Err("joint checkpoint has trailing bytes".into()); }
            eprintln!("joint BFS resume: expanded={head} discovered={}", queue.len());
        } else {
            values[0] = 0; queue.push(0);
            save_checkpoint(checkpoint, transitions.fingerprint, head, &values, &queue)?;
        }
        let mut saved = Instant::now();
        let started = Instant::now();
        while head < queue.len() {
            let i = queue[head] as usize;
            let depth = values[i].checked_add(1).filter(|&d| d < UNKNOWN).ok_or("joint BFS distance overflow")?;
            for m in 0..18 {
                let next = transitions.successor(i, m);
                if values[next] == UNKNOWN { values[next] = depth; queue.push(next as u32); }
            }
            head += 1;
            if head % 1_000_000 == 0 && saved.elapsed().as_secs() >= 15 || head == queue.len() {
                save_checkpoint(checkpoint, transitions.fingerprint, head, &values, &queue)?;
                eprintln!("joint BFS: expanded={head} discovered={} elapsed={:.3}", queue.len(), started.elapsed().as_secs_f64());
                saved = Instant::now();
            }
        }
        if queue.len() != COUNT { return Err(format!("joint BFS reached {}/{COUNT}", queue.len())); }
        drop(queue);
        let maximum = certify(&values, transitions)?;
        atomic(output, |writer| {
            writer.write_all(MAGIC).map_err(|e| e.to_string())?;
            for value in [transitions.fingerprint, hash(&values)] { writer.write_all(&value.to_le_bytes()).map_err(|e| e.to_string())?; }
            writer.write_all(&values).map_err(|e| e.to_string())
        })?;
        Ok(Self { values, maximum })
    }

}

impl JointPdb<PAIR_EDGES> {
    /// Checkpoint only distances and the current BFS layer. On resume rebuild
    /// the unfinished frontier; at most that layer is re-expanded. Completed
    /// layers and all discovered distances survive without an 8 GB disk queue.
    pub fn build_pair(transitions: &PairTransitions, output: &Path, checkpoint: &Path) -> Result<Self, String> {
        if output == checkpoint || output.exists() { return Err("joint pair output must be new and distinct".into()); }
        let mut values = vec![UNKNOWN; PAIR_COUNT];
        let mut queue = Vec::<u32>::with_capacity(PAIR_COUNT);
        let mut discovered = 1usize;
        if checkpoint.exists() {
            if fs::metadata(checkpoint).map_err(|e| e.to_string())?.len() != (PAIR_COUNT + 40) as u64 {
                return Err("joint pair checkpoint size differs".into());
            }
            let mut reader = BufReader::new(File::open(checkpoint).map_err(|e| e.to_string())?);
            let mut magic = [0; 8]; reader.read_exact(&mut magic).map_err(|e| e.to_string())?;
            if &magic != LAYER_CHECKPOINT || read_u64(&mut reader)? != transitions.fingerprint
                || read_u64(&mut reader)? != PAIR_COUNT as u64 {
                return Err("joint pair checkpoint identity differs".into());
            }
            let frontier = read_u64(&mut reader)?;
            let checksum = read_u64(&mut reader)?;
            if frontier > u64::from(UNKNOWN) || frontier == u64::from(UNKNOWN - 1) { return Err("invalid joint pair frontier".into()); }
            reader.read_exact(&mut values).map_err(|e| e.to_string())?;
            if hash(&values) != checksum || values[0] != 0 { return Err("joint pair checkpoint checksum or goal differs".into()); }
            let frontier = frontier as u8;
            discovered = 0;
            for (i, &d) in values.iter().enumerate() {
                if d == UNKNOWN { continue; }
                discovered += 1;
                if d >= UNKNOWN - 1 || d == 0 && i != 0 || frontier != UNKNOWN && d > frontier.saturating_add(1) {
                    return Err("invalid joint pair checkpoint distance".into());
                }
                let mut descends = d == 0;
                for m in 0..18 {
                    let next = values[transitions.successor(i, m)];
                    descends |= next.checked_add(1) == Some(d);
                    if d < frontier && next > d + 1 { return Err("joint pair checkpoint omits an expanded neighbor".into()); }
                }
                if !descends { return Err("joint pair checkpoint lacks a path to the goal".into()); }
                if d == frontier { queue.push(i as u32); }
            }
            if frontier == UNKNOWN {
                if discovered != PAIR_COUNT { return Err("completed joint pair checkpoint has unknowns".into()); }
            } else {
                // Include previously discovered next-layer states AFTER the
                // entire current frontier, preserving nondecreasing distance.
                for (i, &d) in values.iter().enumerate() {
                    if Some(d) == frontier.checked_add(1) { queue.push(i as u32); }
                }
                if queue.is_empty() { return Err("joint pair checkpoint has no frontier".into()); }
            }
            eprintln!("joint pair resume: frontier={frontier} discovered={discovered} pending={}", queue.len());
        } else {
            values[0] = 0; queue.push(0);
            save_layer(checkpoint, transitions.fingerprint, 0, &values)?;
        }
        let started = Instant::now();
        let mut saved = Instant::now();
        let mut head = 0usize;
        while head < queue.len() && discovered < PAIR_COUNT {
            let index = queue[head] as usize;
            let depth = values[index].checked_add(1).filter(|&d| d < UNKNOWN).ok_or("joint pair distance overflow")?;
            for m in 0..18 {
                let next = transitions.successor(index, m);
                if values[next] == UNKNOWN { values[next] = depth; queue.push(next as u32); discovered += 1; }
            }
            head += 1;
            if head % 1_000_000 == 0 && saved.elapsed().as_secs() >= 15 && discovered < PAIR_COUNT && head < queue.len() {
                save_layer(checkpoint, transitions.fingerprint, values[queue[head] as usize], &values)?;
                eprintln!("joint pair BFS: depth={depth} expanded={head} discovered={discovered}/{PAIR_COUNT} seconds={:.3}", started.elapsed().as_secs_f64());
                saved = Instant::now();
            }
        }
        if discovered != PAIR_COUNT { return Err(format!("joint pair BFS reached {discovered}/{PAIR_COUNT}")); }
        drop(queue);
        save_layer(checkpoint, transitions.fingerprint, UNKNOWN, &values)?;
        eprintln!("joint pair BFS complete: expanded={head} states={discovered} seconds={:.3}; certifying", started.elapsed().as_secs_f64());
        let maximum = certify(&values, transitions)?;
        atomic(output, |writer| {
            writer.write_all(MAGIC).map_err(|e| e.to_string())?;
            for value in [transitions.fingerprint, hash(&values)] { writer.write_all(&value.to_le_bytes()).map_err(|e| e.to_string())?; }
            writer.write_all(&values).map_err(|e| e.to_string())
        })?;
        Ok(Self { values, maximum })
    }
}

impl<const E: usize> JointPdb<E> {
    pub fn load(path: &Path, transitions: &JointTransitions<E>) -> Result<Self, String> {
        let count = PERMUTATIONS * ORIENTATIONS * E;
        if fs::metadata(path).map_err(|e| e.to_string())?.len() != (count + 24) as u64 { return Err("joint file size differs".into()); }
        let mut reader = BufReader::new(File::open(path).map_err(|e| e.to_string())?);
        let mut magic = [0; 8]; reader.read_exact(&mut magic).map_err(|e| e.to_string())?;
        if &magic != MAGIC || read_u64(&mut reader)? != transitions.fingerprint { return Err("joint table geometry differs".into()); }
        let checksum = read_u64(&mut reader)?;
        let mut values = vec![0; count]; reader.read_exact(&mut values).map_err(|e| e.to_string())?;
        if hash(&values) != checksum { return Err("joint table checksum differs".into()); }
        let maximum = certify(&values, transitions)?;
        Ok(Self { values, maximum })
    }

    pub fn lookup(&self, cube: &Cube, transitions: &JointTransitions<E>) -> u8 { self.values[transitions.index(cube)] }
    pub fn distribution(&self) -> Vec<u64> {
        let mut counts = vec![0u64; usize::from(self.maximum)+1];
        for &d in &self.values { counts[usize::from(d)] += 1; } counts
    }

    /// Keep only the useful remaining-9/10 rejection thresholds. Values are
    /// 0 (distance <=9), 10, or 11 (distance >=11), always admissible. This is
    /// not an exact-distance table and cannot reject remaining >=11.
    pub fn into_thresholds(self) -> Result<JointThresholds<E>, String> {
        let distribution = self.distribution();
        let mut values = vec![0u8; self.values.len().div_ceil(4)];
        let mut counts = [0u64; 3];
        for (i, &distance) in self.values.iter().enumerate() {
            let code = distance.saturating_sub(9).min(2);
            counts[usize::from(code)] += 1;
            values[i / 4] |= code << (2 * (i % 4));
        }
        let prepared = JointThresholds { values };
        // Read every packed entry back, independently of the bit-placement
        // loop, and verify both its exact threshold and admissibility.
        let mut restored = [0u64; 3];
        for (i, &distance) in self.values.iter().enumerate() {
            let value = prepared.at(i);
            let expected = if distance >= 11 { 11 } else if distance == 10 { 10 } else { 0 };
            if value != expected || value > distance { return Err("joint packed threshold differs".into()); }
            restored[if value == 0 { 0 } else { usize::from(value - 9) }] += 1;
        }
        if restored != counts || counts[0] != distribution.iter().take(10).sum()
            || counts[1] != distribution.get(10).copied().unwrap_or(0)
            || counts[2] != distribution.iter().skip(11).sum() {
            return Err("joint packed threshold distribution differs".into());
        }
        Ok(prepared)
    }
}

pub struct JointThresholds<const E: usize> { values: Vec<u8> }

impl<const E: usize> JointThresholds<E> {
    #[inline(always)]
    fn at(&self, index: usize) -> u8 {
        let code = (self.values[index / 4] >> (2 * (index % 4))) & 3;
        if code == 0 { 0 } else { code + 9 }
    }
    pub fn lookup(&self, cube: &Cube, transitions: &JointTransitions<E>) -> u8 { self.at(transitions.index(cube)) }
    pub fn bytes(&self) -> usize { self.values.len() }
}

fn certify<const E: usize>(values: &[u8], transitions: &JointTransitions<E>) -> Result<u8, String> {
    if values.len() != PERMUTATIONS * ORIENTATIONS * E || values[0] != 0 { return Err("invalid joint goal".into()); }
    let mut maximum = 0;
    for (i, &distance) in values.iter().enumerate() {
        if E == PAIR_EDGES && i % 100_000_000 == 0 { eprintln!("joint pair certificate: {i}/{}", values.len()); }
        if distance == UNKNOWN || distance == 0 && i != 0 { return Err("joint certificate has an unknown value or extra zero".into()); }
        let mut descends = distance == 0;
        for m in 0..18 {
            let next = values[transitions.successor(i, m)];
            if distance.abs_diff(next) > 1 { return Err("joint distance violates an edge bound".into()); }
            descends |= next.checked_add(1) == Some(distance);
        }
        if !descends { return Err("joint distance lacks a descending edge".into()); }
        maximum = maximum.max(distance);
    }
    Ok(maximum)
}
