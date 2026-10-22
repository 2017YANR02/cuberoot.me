//! Independent corner-group symmetry research.
//!
//! This module does not read or alter an Opt8 table. Its full-corner graph uses
//! both left and right HTM moves: inversion exchanges these two edge families.
//! A representative's 18 right edges preserve distance *to* the identity, but
//! are not sufficient for an ordinary outward BFS from the identity.
//!
//! All counts below are mathematical predictions checked by the constructors
//! after complete enumeration, not measurements made while writing this file.
//! FullCornerPdb is queryable only after an exhaustive distance certificate:
//! orbit coverage, the unique zero, edge Lipschitz inequalities and descent.

use crate::corner_coset::{self, CornerTransitions, COSET_COUNT, HALF_TURNS, ORIENTATION_COUNT};
use crate::cube::{inverse_move, Cube, MOVES};
use std::ffi::OsString;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub mod dense;

pub const FULL_CORNER_COUNT: usize = 88_179_840;
pub const FULL_CORNER_ORBIT_COUNT: usize = 934_778;
pub const DOUBLE_CLASS_COUNT: usize = 11_436;
pub const DOUBLE_INVERSE_CLASS_COUNT: usize = 5_870;
pub const DOUBLE_SPATIAL_CLASS_COUNT: usize = 1_275;
pub const DOUBLE_ALL_CLASS_COUNT: usize = 907;

const ID: [u8; 8] = [0, 1, 2, 3, 4, 5, 6, 7];
const FACTORIAL: [u32; 9] = [1, 1, 2, 6, 24, 120, 720, 5_040, 40_320];
const UNKNOWN: u8 = u8::MAX;
const DOUBLE_MAGIC: &[u8; 8] = b"C96DBL01";
const CHECKPOINT_MAGIC: &[u8; 8] = b"C96BFS01";
const PDB_MAGIC: &[u8; 8] = b"C96PDB01";

// These helpers implement exactly Cube::multiplied's position -> identity
// corner convention. They deliberately do not operate on dummy edges.
fn multiply(a: &[u8; 8], b: &[u8; 8]) -> [u8; 8] {
    let mut result = ID;
    for i in 0..8 {
        let source = a[(b[i] & 7) as usize];
        result[i] = (source & 7) | ((((source >> 3) + (b[i] >> 3)) % 3) << 3);
    }
    result
}

fn inverse(a: &[u8; 8]) -> [u8; 8] {
    let mut result = ID;
    for (position, &corner) in a.iter().enumerate() {
        result[(corner & 7) as usize] = position as u8 | (((3 - (corner >> 3)) % 3) << 3);
    }
    result
}

fn negate_twists(a: &[u8; 8]) -> [u8; 8] {
    let mut result = *a;
    for corner in &mut result {
        *corner = (*corner & 7) | (((3 - (*corner >> 3)) % 3) << 3);
    }
    result
}

fn conjugate(a: &[u8; 8], g: &[u8; 8]) -> [u8; 8] {
    multiply(&multiply(a, g), &inverse(a))
}

fn validate_corners(corners: &[u8; 8]) -> Result<(), String> {
    let mut mask = 0u16;
    let mut sum = 0u8;
    for &corner in corners {
        if corner >= 24 {
            return Err("corner byte must encode identity 0..7 and twist 0..2".into());
        }
        mask |= 1 << (corner & 7);
        sum += corner >> 3;
    }
    if mask != 255 || sum % 3 != 0 {
        return Err("corners must be a permutation with zero total twist".into());
    }
    Ok(())
}

fn corner_cube(corners: [u8; 8]) -> Cube {
    let mut result = Cube::SOLVED;
    result.corners = corners;
    let mut odd = false;
    for i in 0..8 {
        for j in i + 1..8 {
            odd ^= (corners[i] & 7) > (corners[j] & 7);
        }
    }
    if odd {
        result.edges.swap(0, 1);
    }
    result
}

fn rank_corners(corners: &[u8; 8]) -> u32 {
    let mut permutation = 0u32;
    for i in 0..8 {
        let smaller = corners[i + 1..].iter().filter(|&&v| (v & 7) < (corners[i] & 7)).count();
        permutation += smaller as u32 * FACTORIAL[7 - i];
    }
    let mut orientation = 0u32;
    let mut place = 1u32;
    for &corner in &corners[..7] {
        orientation += u32::from(corner >> 3) * place;
        place *= 3;
    }
    permutation * ORIENTATION_COUNT as u32 + orientation
}

/// Lexicographic Lehmer permutation rank, followed by little-endian ternary CO.
/// Only the corner projection is validated; input edges are irrelevant.
pub fn full_corner_rank(cube: &Cube) -> Result<u32, String> {
    validate_corners(&cube.corners)?;
    Ok(rank_corners(&cube.corners))
}

/// Returns a legal full Cube whose edges only supply the required parity.
pub fn full_corner_unrank(rank: u32) -> Result<Cube, String> {
    if rank as usize >= FULL_CORNER_COUNT {
        return Err("full corner rank out of range".into());
    }
    let twists = corner_coset::orientation_unrank(rank as usize % ORIENTATION_COUNT)?;
    let mut permutation = rank / ORIENTATION_COUNT as u32;
    let mut available = ID;
    let mut corners = ID;
    for i in 0..8 {
        let digit = (permutation / FACTORIAL[7 - i]) as usize;
        permutation %= FACTORIAL[7 - i];
        corners[i] = available[digit] | (twists[i] << 3);
        for j in digit..7 - i {
            available[j] = available[j + 1];
        }
    }
    Ok(corner_cube(corners))
}

#[derive(Clone)]
struct SpatialMap {
    conjugator: [u8; 8],
    inverse_conjugator: [u8; 8],
    negate: bool,
    moves: [u8; 18],
    inverse_moves: [u8; 18],
}

impl SpatialMap {
    fn apply(&self, corners: &[u8; 8]) -> [u8; 8] {
        let g = if self.negate { negate_twists(corners) } else { *corners };
        multiply(&multiply(&self.conjugator, &g), &self.inverse_conjugator)
    }
}

/// Witness for r = phi(g) or r = phi(g^-1), with phi(g) = a g a^-1
/// (and, for an improper spatial map, a twist-negation before conjugation).
#[derive(Clone, Debug)]
pub struct CanonicalCorner {
    /// Canonical corners with artificial edges completing permutation parity.
    /// This is not a spatially transformed full-cube state.
    pub cube: Cube,
    pub rank: u32,
    pub symmetry: u8,
    pub inverted: bool,
}

/// All 48 spatial automorphisms, constructed without external small tables.
pub struct CornerSymmetries {
    maps: Vec<SpatialMap>,
}

impl CornerSymmetries {
    pub fn new() -> Result<Self, String> {
        // On corners, R L' and U D' are whole-cube rotations. Their full-Cube
        // edge fields are NOT whole-cube rotations; use corner arrays only.
        let x = multiply(&MOVES[3].corners, &MOVES[14].corners);
        let y = multiply(&MOVES[0].corners, &MOVES[11].corners);
        let mut rotations = vec![ID];
        let mut head = 0usize;
        while head < rotations.len() {
            let r = rotations[head];
            for generator in [x, y] {
                let candidate = multiply(&r, &generator);
                if !rotations.contains(&candidate) {
                    if rotations.len() >= 24 {
                        return Err("corner rotation generators exceeded order 24".into());
                    }
                    rotations.push(candidate);
                }
            }
            head += 1;
        }
        if rotations.len() != 24 {
            return Err(format!("expected 24 proper corner rotations, got {}", rotations.len()));
        }
        // Central spatial inversion is Ad_j tau, not tau alone. Corner order:
        // URF, ULB, DLF, DRB, DRF, DLB, ULF, URB.
        let j = [5, 4, 7, 6, 1, 0, 3, 2];
        let mut maps = Vec::with_capacity(48);
        for improper in [false, true] {
            for rotation in &rotations {
                let a = if improper { multiply(rotation, &j) } else { *rotation };
                let mut map = SpatialMap {
                    conjugator: a,
                    inverse_conjugator: inverse(&a),
                    negate: improper,
                    moves: [0; 18],
                    inverse_moves: [0; 18],
                };
                let mut seen = [false; 18];
                for m in 0..18 {
                    let transformed = map.apply(&MOVES[m].corners);
                    let target = MOVES.iter().position(|candidate| candidate.corners == transformed)
                        .ok_or_else(|| "spatial map did not preserve corner HTM generators".to_string())?;
                    if seen[target] {
                        return Err("spatial move image was not a permutation".into());
                    }
                    seen[target] = true;
                    map.moves[m] = target as u8;
                    map.inverse_moves[target] = m as u8;
                }
                if maps.iter().any(|old: &SpatialMap| old.moves == map.moves) {
                    return Err("duplicate spatial action on corner generators".into());
                }
                maps.push(map);
            }
        }
        // Generator images faithfully determine an automorphism of C. Check
        // closure as well as distinctness, without enumerating corner states.
        for a in &maps {
            for b in &maps {
                let mut composition = [0u8; 18];
                for (m, target) in composition.iter_mut().enumerate() {
                    *target = a.moves[b.moves[m] as usize];
                }
                if !maps.iter().any(|candidate| candidate.moves == composition) {
                    return Err("spatial maps were not closed under composition".into());
                }
            }
        }
        Ok(Self { maps })
    }

    pub fn len(&self) -> usize { self.maps.len() }

    pub fn is_empty(&self) -> bool { self.maps.is_empty() }

    pub fn move_image(&self, symmetry: u8, movement: u8) -> Result<u8, String> {
        let map = self.maps.get(symmetry as usize).ok_or("spatial symmetry out of range")?;
        map.moves.get(movement as usize).copied().ok_or_else(|| "move out of range".into())
    }

    /// Transform the corner projection. Returned edges are an artificial
    /// parity completion, not the transformed edges of the input cube.
    pub fn transform(&self, cube: &Cube, symmetry: u8, inverted: bool) -> Result<Cube, String> {
        validate_corners(&cube.corners)?;
        let map = self.maps.get(symmetry as usize).ok_or("spatial symmetry out of range")?;
        let source = if inverted { inverse(&cube.corners) } else { cube.corners };
        Ok(corner_cube(map.apply(&source)))
    }

    fn orbit_ranks(&self, corners: &[u8; 8]) -> [u32; 96] {
        let mut result = [0; 96];
        let opposite = inverse(corners);
        for (i, map) in self.maps.iter().enumerate() {
            result[i] = rank_corners(&map.apply(corners));
            result[48 + i] = rank_corners(&map.apply(&opposite));
        }
        result
    }

    pub fn canonicalize(&self, cube: &Cube) -> Result<CanonicalCorner, String> {
        validate_corners(&cube.corners)?;
        let opposite = inverse(&cube.corners);
        let mut best = CanonicalCorner {
            cube: corner_cube(cube.corners), rank: u32::MAX, symmetry: 0, inverted: false,
        };
        for (inverted, source) in [(false, &cube.corners), (true, &opposite)] {
            for (i, map) in self.maps.iter().enumerate() {
                let image = map.apply(source);
                let rank = rank_corners(&image);
                if rank < best.rank {
                    best = CanonicalCorner {
                        cube: corner_cube(image), rank, symmetry: i as u8, inverted,
                    };
                }
            }
        }
        Ok(best)
    }

    /// If W solves the corners r = phi(g^epsilon), then (phi^-1(W))^epsilon
    /// solves g's corners. It makes no claim about the original full cube's edges.
    /// Word inversion means reversing order AND inverting each move.
    pub fn restore_solution(&self, token: &CanonicalCorner, canonical_word: &[u8]) -> Result<Vec<u8>, String> {
        let map = self.maps.get(token.symmetry as usize).ok_or("spatial symmetry out of range")?;
        if full_corner_rank(&token.cube)? != token.rank {
            return Err("canonical token rank does not match its corners".into());
        }
        let mut result = Vec::with_capacity(canonical_word.len());
        let mut check = token.cube.corners;
        for &movement in canonical_word {
            if movement >= 18 {
                return Err("move out of range".into());
            }
            check = multiply(&check, &MOVES[movement as usize].corners);
            result.push(map.inverse_moves[movement as usize]);
        }
        if check != ID {
            return Err("word does not solve the canonical corner state".into());
        }
        if token.inverted {
            result.reverse();
            for movement in &mut result { *movement = inverse_move(*movement); }
        }
        Ok(result)
    }

    /// Bounded deterministic fixtures; no PDB, filesystem or production table.
    pub fn verify_small(&self) -> Result<(), String> {
        let fixtures: &[&[u8]] = &[
            &[], &[0], &[3, 0, 6], &[1, 3, 0, 6],
            &[0, 3, 6, 9, 12, 15], &[2, 4, 8, 10, 14, 16, 0, 7],
        ];
        for word in fixtures {
            let mut corners = ID;
            for &movement in *word {
                corners = multiply(&corners, &MOVES[movement as usize].corners);
            }
            let cube = corner_cube(corners);
            if full_corner_unrank(full_corner_rank(&cube)?)?.corners != corners {
                return Err("full corner rank round trip failed".into());
            }
            let token = self.canonicalize(&cube)?;
            let solution: Vec<u8> = word.iter().rev().map(|&m| inverse_move(m)).collect();
            let map = &self.maps[token.symmetry as usize];
            let mut canonical_word: Vec<u8> = solution.iter().map(|&m| map.moves[m as usize]).collect();
            if token.inverted {
                canonical_word.reverse();
                for movement in &mut canonical_word { *movement = inverse_move(*movement); }
            }
            if self.restore_solution(&token, &canonical_word)? != solution {
                return Err("canonical word restoration failed".into());
            }
            for symmetry in 0..48 {
                for inverted in [false, true] {
                    let image = self.transform(&cube, symmetry, inverted)?;
                    if self.canonicalize(&image)?.rank != token.rank {
                        return Err("96-orbit canonical rank was not invariant".into());
                    }
                }
            }
        }
        Ok(())
    }
}

struct Dsu { parent: Vec<u32>, size: Vec<u32> }

impl Dsu {
    fn new(count: usize) -> Result<Self, String> {
        let mut parent = allocated(count, 0u32, "disjoint-set parents")?;
        for (i, entry) in parent.iter_mut().enumerate() { *entry = i as u32; }
        Ok(Self { parent, size: allocated(count, 1u32, "disjoint-set sizes")? })
    }

    fn find(&mut self, mut i: usize) -> usize {
        while self.parent[i] as usize != i {
            let parent = self.parent[i] as usize;
            self.parent[i] = self.parent[parent];
            i = parent;
        }
        i
    }

    fn union(&mut self, a: usize, b: usize) {
        let mut a = self.find(a);
        let mut b = self.find(b);
        if a == b { return; }
        if self.size[a] < self.size[b] { std::mem::swap(&mut a, &mut b); }
        self.parent[b] = a as u32;
        self.size[a] += self.size[b];
    }

    fn labels(mut self) -> Result<(Vec<u16>, Vec<u32>), String> {
        let count = self.parent.len();
        let mut names = allocated(count, u16::MAX, "component names")?;
        let mut labels = allocated(count, 0u16, "component labels")?;
        let mut representatives = Vec::new();
        for (i, label) in labels.iter_mut().enumerate() {
            let root = self.find(i);
            if names[root] == u16::MAX {
                if representatives.len() >= u16::MAX as usize {
                    return Err("too many components for u16 class IDs".into());
                }
                names[root] = representatives.len() as u16;
                representatives.push(i as u32);
            }
            *label = names[root];
        }
        Ok((labels, representatives))
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct DoubleClassStats {
    pub double_classes: usize,
    pub inverse_classes: usize,
    pub spatial_classes: usize,
    pub all_classes: usize,
}

/// Exact H\C/H classes and their spatial/inverse orbits.
///
/// This is a bounded, single-pass construction without checkpoint/resume.
/// It DOES NOT run a BFS on the double-coset graph. For exact v, first build
/// exact u on H\C, then take component minima with component_minima.
pub struct DoubleClasses {
    by_coset: Vec<u16>,
    all_by_double: Vec<u16>,
    representatives: Vec<u32>,
    stats: DoubleClassStats,
}

impl DoubleClasses {
    pub fn build(transitions: &CornerTransitions) -> Result<Self, String> {
        let mut components = Dsu::new(COSET_COUNT)?;
        for index in 0..COSET_COUNT {
            for movement in HALF_TURNS {
                components.union(index, transitions.successor_unchecked(index, movement));
            }
        }
        let (by_coset, representatives) = components.labels()?;
        if representatives.len() != DOUBLE_CLASS_COUNT {
            return Err(format!("expected {DOUBLE_CLASS_COUNT} double cosets, got {}", representatives.len()));
        }
        let mut inverse_components = Dsu::new(DOUBLE_CLASS_COUNT)?;
        let mut spatial_components = Dsu::new(DOUBLE_CLASS_COUNT)?;
        let mut all_components = Dsu::new(DOUBLE_CLASS_COUNT)?;
        // Effective normalizer quotient on DOUBLE COSETS only: t, j generate
        // S3, and tau supplies the improper action. This smaller set must not
        // replace the actual 48 maps on complete corner states.
        // With the x,y used above, xy H = t H and y H = j H. Thus the proper
        // spatial image already contains Ad_t and Ad_j on double cosets;
        // combining Ad_j with the actual reflection Ad_j tau also gives tau.
        let t = [8, 9, 10, 11, 20, 21, 22, 23];
        let j = [5, 4, 7, 6, 1, 0, 3, 2];
        for (class, &representative) in representatives.iter().enumerate() {
            let cube = corner_coset::unrank(representative as usize)?;
            let target = |corners| {
                by_coset[corner_coset::rank_unchecked(&corner_cube(corners))] as usize
            };
            let opposite = target(inverse(&cube.corners));
            inverse_components.union(class, opposite);
            all_components.union(class, opposite);
            for image in [conjugate(&t, &cube.corners), conjugate(&j, &cube.corners), negate_twists(&cube.corners)] {
                let other = target(image);
                spatial_components.union(class, other);
                all_components.union(class, other);
            }
        }
        let (_, inverse_representatives) = inverse_components.labels()?;
        let (_, spatial_representatives) = spatial_components.labels()?;
        let (all_by_double, all_representatives) = all_components.labels()?;
        let stats = DoubleClassStats {
            double_classes: representatives.len(), inverse_classes: inverse_representatives.len(),
            spatial_classes: spatial_representatives.len(), all_classes: all_representatives.len(),
        };
        if stats.inverse_classes != DOUBLE_INVERSE_CLASS_COUNT
            || stats.spatial_classes != DOUBLE_SPATIAL_CLASS_COUNT
            || stats.all_classes != DOUBLE_ALL_CLASS_COUNT {
            return Err(format!("double-coset orbit counts differ from the analytic prediction: {stats:?}"));
        }
        Ok(Self { by_coset, all_by_double, representatives, stats })
    }

    pub fn stats(&self) -> DoubleClassStats { self.stats }

    pub fn representatives(&self) -> &[u32] { &self.representatives }

    pub fn double_class(&self, index: usize) -> Result<u16, String> {
        self.by_coset.get(index).copied().ok_or_else(|| "corner coset index out of range".into())
    }

    pub fn orbit_class(&self, index: usize) -> Result<u16, String> {
        Ok(self.all_by_double[self.double_class(index)? as usize])
    }

    /// One minimum per double coset (11,436 entries). Input distances must be
    /// certified separately; this function makes no distance claim about them.
    pub fn component_minima(&self, values: &[u8]) -> Result<Vec<u8>, String> {
        if values.len() != COSET_COUNT || values.contains(&UNKNOWN) {
            return Err("component minima require 918540 initialized coset values".into());
        }
        let mut minima = allocated(DOUBLE_CLASS_COUNT, UNKNOWN, "double-coset minima")?;
        for (&value, &class) in values.iter().zip(&self.by_coset) {
            minima[class as usize] = minima[class as usize].min(value);
        }
        Ok(minima)
    }

    /// Fold the exact (or uniformly capped) v values to 907 entries, verifying
    /// equality inside each orbit rather than silently weakening by a minimum.
    pub fn orbit_minima(&self, values: &[u8]) -> Result<Vec<u8>, String> {
        let minima = self.component_minima(values)?;
        let mut result = allocated(DOUBLE_ALL_CLASS_COUNT, UNKNOWN, "double-orbit minima")?;
        for (&value, &class) in minima.iter().zip(&self.all_by_double) {
            let previous = &mut result[class as usize];
            if *previous != UNKNOWN && *previous != value {
                return Err("double-coset minima are not invariant under M + inversion".into());
            }
            *previous = value;
        }
        Ok(result)
    }

    fn payload(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(16 + 2 * COSET_COUNT + 6 * DOUBLE_CLASS_COUNT);
        for n in [self.stats.double_classes, self.stats.inverse_classes, self.stats.spatial_classes, self.stats.all_classes] {
            bytes.extend_from_slice(&(n as u32).to_le_bytes());
        }
        for &n in &self.by_coset { bytes.extend_from_slice(&n.to_le_bytes()); }
        for &n in &self.all_by_double { bytes.extend_from_slice(&n.to_le_bytes()); }
        for &n in &self.representatives { bytes.extend_from_slice(&n.to_le_bytes()); }
        bytes
    }

    pub fn save(&self, path: &Path) -> Result<(), String> {
        write_atomic(path, DOUBLE_MAGIC, &self.payload())
    }

    /// Full reconstruction and byte comparison is intentional. A checksum by
    /// itself cannot certify an equivalence relation or its expected counts.
    pub fn load_and_verify(path: &Path, transitions: &CornerTransitions) -> Result<Self, String> {
        let bytes = read_envelope(path, DOUBLE_MAGIC, 16 + 2 * COSET_COUNT + 6 * DOUBLE_CLASS_COUNT)?;
        let rebuilt = Self::build(transitions)?;
        if bytes != rebuilt.payload() {
            return Err("double-coset file differs from reconstructed classes".into());
        }
        Ok(rebuilt)
    }
}

#[derive(Clone, Copy, Debug)]
struct DistanceNode { rank: u32, depth: u8 }

#[derive(Clone, Copy, Debug)]
pub struct BfsProgress {
    pub expanded: usize,
    pub discovered: usize,
    pub raw_visited: usize,
    pub complete: bool,
    /// Depth of the next queue entry, or the maximum depth if complete.
    pub depth: u8,
}

/// Resumable, ordinary outward BFS on the true 96-orbit graph.
///
/// Every representative has 18 right and 18 left successors. Before any
/// canonicalization, an approximately 11 MB raw-state bitset rejects already
/// discovered orbits. Each newly discovered orbit is marked in its entirety.
/// No normal-word/ALLOWED/history pruning is applied to these graph edges.
pub struct FullCornerBfs {
    nodes: Vec<DistanceNode>,
    head: usize,
    visited: Vec<u64>,
    raw_visited: usize,
}

impl FullCornerBfs {
    pub fn new(symmetries: &CornerSymmetries) -> Result<Self, String> {
        let mut visited = allocated((FULL_CORNER_COUNT + 63) / 64, 0u64, "corner orbit visited bits")?;
        let mut raw_visited = 0usize;
        for rank in symmetries.orbit_ranks(&ID) {
            if mark(&mut visited, rank) { raw_visited += 1; }
        }
        Ok(Self { nodes: vec![DistanceNode { rank: 0, depth: 0 }], head: 0, visited, raw_visited })
    }

    pub fn progress(&self) -> BfsProgress {
        BfsProgress {
            expanded: self.head, discovered: self.nodes.len(), raw_visited: self.raw_visited,
            complete: self.head == self.nodes.len(),
            depth: self.nodes.get(self.head).or_else(|| self.nodes.last()).map_or(0, |n| n.depth),
        }
    }

    /// Expand at most max_expansions queue entries. Returning early preserves
    /// an exact resumable frontier; it does not create a queryable PDB.
    pub fn advance(&mut self, symmetries: &CornerSymmetries, max_expansions: usize) -> Result<BfsProgress, String> {
        let mut expanded = 0usize;
        while self.head < self.nodes.len() && expanded < max_expansions {
            let node = self.nodes[self.head];
            let corners = full_corner_unrank(node.rank)?.corners;
            let next_depth = node.depth.checked_add(1).filter(|&d| d < UNKNOWN)
                .ok_or_else(|| "corner BFS exceeded the supported distance range".to_string())?;
            for movement in &MOVES {
                for next in [multiply(&corners, &movement.corners), multiply(&movement.corners, &corners)] {
                    let raw_rank = rank_corners(&next);
                    if marked(&self.visited, raw_rank) { continue; }
                    let orbit = symmetries.orbit_ranks(&next);
                    let canonical = orbit.iter().copied().fold(u32::MAX, u32::min);
                    if marked(&self.visited, canonical) {
                        return Err("visited bitset contains only part of an orbit".into());
                    }
                    if self.nodes.len() >= FULL_CORNER_ORBIT_COUNT {
                        return Err("corner BFS exceeded the analytic orbit count".into());
                    }
                    self.nodes.try_reserve(1).map_err(|e| format!("cannot grow corner BFS queue: {e}"))?;
                    for rank in orbit {
                        if mark(&mut self.visited, rank) { self.raw_visited += 1; }
                    }
                    self.nodes.push(DistanceNode { rank: canonical, depth: next_depth });
                }
            }
            self.head += 1;
            expanded += 1;
        }
        Ok(self.progress())
    }

    pub fn save_checkpoint(&self, path: &Path) -> Result<(), String> {
        let mut bytes = Vec::with_capacity(16 + 5 * self.nodes.len());
        bytes.extend_from_slice(&(self.head as u64).to_le_bytes());
        bytes.extend_from_slice(&(self.nodes.len() as u64).to_le_bytes());
        append_nodes(&mut bytes, &self.nodes);
        write_atomic(path, CHECKPOINT_MAGIC, &bytes)
    }

    /// Besides format/checksum checks, resume verifies canonicality and orbit
    /// uniqueness, BFS ordering, known-edge Lipschitz/descent, and that every
    /// previously expanded vertex has all 36 successors already discovered.
    /// This validation temporarily uses an approximately 88 MB raw-distance
    /// array. An unfinished checkpoint remains non-queryable.
    pub fn resume(path: &Path, symmetries: &CornerSymmetries) -> Result<Self, String> {
        let bytes = read_envelope(path, CHECKPOINT_MAGIC, 16 + 5 * FULL_CORNER_ORBIT_COUNT)?;
        let mut reader = ByteReader::new(&bytes);
        let head = checked_usize(reader.u64()?, "BFS queue cursor")?;
        let count = checked_usize(reader.u64()?, "BFS queue length")?;
        let nodes = read_nodes(&mut reader, count)?;
        reader.finish()?;
        let certificate = certify(&nodes, Some(head), symmetries, true)?;
        let visited = certificate.visited.ok_or_else(|| "missing restored visited bitset".to_string())?;
        Ok(Self { nodes, head, visited, raw_visited: certificate.raw_count })
    }

    /// Completion and the analytic count alone are insufficient. This consumes
    /// the builder, checks the complete distance certificate, then exposes a
    /// queryable table. Stored keys are u32 canonical ranks, not a free dense
    /// 934778-entry ranking scheme.
    pub fn finish(self, symmetries: &CornerSymmetries) -> Result<FullCornerPdb, String> {
        if self.head != self.nodes.len() {
            return Err("cannot finish an incomplete corner BFS".into());
        }
        let Self { mut nodes, visited, .. } = self;
        drop(visited);
        nodes.sort_unstable_by_key(|node| node.rank);
        certify(&nodes, None, symmetries, false)?;
        let maximum = nodes.iter().map(|node| node.depth).max().unwrap_or(0);
        Ok(FullCornerPdb { nodes, maximum })
    }
}

/// Exact HTM distance in the complete corner projection C, indexed by 96-orbit
/// canonical ranks. It is an admissible bound for a full cube; a corner-only
/// solution returned here need not solve the edges.
pub struct FullCornerPdb { nodes: Vec<DistanceNode>, maximum: u8 }

impl FullCornerPdb {
    pub fn len(&self) -> usize { self.nodes.len() }

    pub fn is_empty(&self) -> bool { self.nodes.is_empty() }

    pub fn max_distance(&self) -> u8 { self.maximum }

    pub fn distance(&self, cube: &Cube, symmetries: &CornerSymmetries) -> Result<u8, String> {
        let rank = symmetries.canonicalize(cube)?.rank;
        self.nodes.binary_search_by_key(&rank, |node| node.rank)
            .map(|i| self.nodes[i].depth)
            .map_err(|_| "certified corner PDB is missing a canonical rank".into())
    }

    /// Ordinary right-move descent in the caller's original frame avoids
    /// exposing a mixed left/right BFS path or forgetting its frame changes.
    pub fn solve_corners(&self, cube: &Cube, symmetries: &CornerSymmetries) -> Result<Vec<u8>, String> {
        validate_corners(&cube.corners)?;
        let mut current = corner_cube(cube.corners);
        let mut depth = self.distance(&current, symmetries)?;
        let mut word = Vec::with_capacity(depth as usize);
        while depth != 0 {
            let mut chosen = None;
            for movement in 0..18 {
                let next = corner_cube(multiply(&current.corners, &MOVES[movement].corners));
                if self.distance(&next, symmetries)?.checked_add(1) == Some(depth) {
                    chosen = Some((movement as u8, next));
                    break;
                }
            }
            let (movement, next) = chosen.ok_or_else(|| "certified corner distance has no right descent".to_string())?;
            word.push(movement);
            current = next;
            depth -= 1;
        }
        if current.corners != ID {
            return Err("zero corner distance did not reach solved corners".into());
        }
        Ok(word)
    }

    pub fn save(&self, path: &Path) -> Result<(), String> {
        let mut bytes = Vec::with_capacity(8 + 5 * self.nodes.len());
        bytes.extend_from_slice(&(self.nodes.len() as u64).to_le_bytes());
        append_nodes(&mut bytes, &self.nodes);
        write_atomic(path, PDB_MAGIC, &bytes)
    }

    /// Full semantic verification, not a checksum-only trusted load. Temporary
    /// raw distances permit O(1) neighbor lookup during the 36-edge checks.
    pub fn load_and_verify(path: &Path, symmetries: &CornerSymmetries) -> Result<Self, String> {
        let bytes = read_envelope(path, PDB_MAGIC, 8 + 5 * FULL_CORNER_ORBIT_COUNT)?;
        let mut reader = ByteReader::new(&bytes);
        let count = checked_usize(reader.u64()?, "corner PDB length")?;
        let nodes = read_nodes(&mut reader, count)?;
        reader.finish()?;
        certify(&nodes, None, symmetries, false)?;
        let maximum = nodes.iter().map(|node| node.depth).max().unwrap_or(0);
        Ok(Self { nodes, maximum })
    }
}

struct Certificate { visited: Option<Vec<u64>>, raw_count: usize }

/// Root + Lipschitz proves every stored number <= true distance; descending
/// edges prove the reverse inequality. The 36-edge set is equivariant under
/// every spatial map and inversion, so one representative per orbit suffices.
fn certify(nodes: &[DistanceNode], expanded: Option<usize>, symmetries: &CornerSymmetries,
           retain_visited: bool) -> Result<Certificate, String> {
    if nodes.is_empty() || nodes.len() > FULL_CORNER_ORBIT_COUNT {
        return Err("invalid number of corner orbit records".into());
    }
    if let Some(head) = expanded {
        if head > nodes.len() || (head == 0 && nodes.len() != 1) {
            return Err("invalid BFS queue cursor".into());
        }
        if nodes[0].rank != 0 || nodes[0].depth != 0 {
            return Err("BFS queue does not begin at the identity".into());
        }
        for pair in nodes.windows(2) {
            if pair[0].depth > pair[1].depth || u16::from(pair[1].depth) > u16::from(pair[0].depth) + 1 {
                return Err("BFS queue depths are not in consecutive nondecreasing layers".into());
            }
        }
        if head < nodes.len() && u16::from(nodes.last().unwrap().depth) > u16::from(nodes[head].depth) + 1 {
            return Err("BFS frontier contains a depth beyond the next layer".into());
        }
    } else if nodes.windows(2).any(|pair| pair[0].rank >= pair[1].rank) {
        return Err("corner PDB keys must be strictly sorted".into());
    }
    let complete = expanded.is_none() || expanded == Some(nodes.len());
    if complete && nodes.len() != FULL_CORNER_ORBIT_COUNT {
        return Err(format!("expected {FULL_CORNER_ORBIT_COUNT} complete corner orbits, got {}", nodes.len()));
    }
    let mut raw = allocated(FULL_CORNER_COUNT, UNKNOWN, "corner distance certificate")?;
    let mut visited = if retain_visited {
        Some(allocated((FULL_CORNER_COUNT + 63) / 64, 0u64, "restored corner visited bits")?)
    } else { None };
    let mut raw_count = 0usize;
    for node in nodes {
        if node.depth == UNKNOWN || (node.depth == 0) != (node.rank == 0) {
            return Err("corner certificate has an invalid value or a non-unique zero".into());
        }
        let corners = full_corner_unrank(node.rank)?.corners;
        let orbit = symmetries.orbit_ranks(&corners);
        if orbit.iter().copied().fold(u32::MAX, u32::min) != node.rank {
            return Err("corner record is not the minimum rank in its 96 orbit".into());
        }
        if raw[node.rank as usize] != UNKNOWN {
            return Err("duplicate corner orbit in certificate".into());
        }
        for rank in orbit {
            let slot = &mut raw[rank as usize];
            if *slot == UNKNOWN {
                *slot = node.depth;
                raw_count += 1;
                if let Some(bits) = &mut visited { mark(bits, rank); }
            } else if *slot != node.depth {
                return Err("intersecting corner orbits have different distances".into());
            }
        }
    }
    if raw[0] != 0 || (complete && raw_count != FULL_CORNER_COUNT) {
        return Err(format!("corner orbit coverage is incomplete: {raw_count}/{FULL_CORNER_COUNT}"));
    }
    for (i, node) in nodes.iter().enumerate() {
        let corners = full_corner_unrank(node.rank)?.corners;
        let must_have_all_neighbors = complete || expanded.is_some_and(|head| i < head);
        let mut descends = node.depth == 0;
        for movement in &MOVES {
            for next in [multiply(&corners, &movement.corners), multiply(&movement.corners, &corners)] {
                let next_depth = raw[rank_corners(&next) as usize];
                if next_depth == UNKNOWN {
                    if must_have_all_neighbors {
                        return Err("expanded/certified corner vertex has an undiscovered successor".into());
                    }
                    continue;
                }
                if node.depth.abs_diff(next_depth) > 1 {
                    return Err("corner distance certificate violates an edge Lipschitz inequality".into());
                }
                descends |= node.depth.checked_sub(1) == Some(next_depth);
            }
        }
        if !descends {
            return Err("nonzero corner distance has no descending edge".into());
        }
    }
    Ok(Certificate { visited, raw_count })
}

fn marked(bits: &[u64], rank: u32) -> bool {
    bits[rank as usize / 64] & (1u64 << (rank % 64)) != 0
}

fn mark(bits: &mut [u64], rank: u32) -> bool {
    let slot = &mut bits[rank as usize / 64];
    let mask = 1u64 << (rank % 64);
    let fresh = *slot & mask == 0;
    *slot |= mask;
    fresh
}

fn allocated<T: Clone>(length: usize, value: T, purpose: &str) -> Result<Vec<T>, String> {
    let mut result = Vec::new();
    result.try_reserve_exact(length).map_err(|e| format!("cannot allocate {purpose}: {e}"))?;
    result.resize(length, value);
    Ok(result)
}

fn checked_usize(value: u64, name: &str) -> Result<usize, String> {
    usize::try_from(value).map_err(|_| format!("{name} does not fit this platform"))
}

fn append_nodes(bytes: &mut Vec<u8>, nodes: &[DistanceNode]) {
    for node in nodes {
        bytes.extend_from_slice(&node.rank.to_le_bytes());
        bytes.push(node.depth);
    }
}

fn read_nodes(reader: &mut ByteReader<'_>, count: usize) -> Result<Vec<DistanceNode>, String> {
    if count == 0 || count > FULL_CORNER_ORBIT_COUNT {
        return Err("invalid corner record count".into());
    }
    let mut result = Vec::new();
    result.try_reserve_exact(count).map_err(|e| format!("cannot allocate corner records: {e}"))?;
    for _ in 0..count { result.push(DistanceNode { rank: reader.u32()?, depth: reader.u8()? }); }
    Ok(result)
}

struct ByteReader<'a> { bytes: &'a [u8], position: usize }

impl<'a> ByteReader<'a> {
    fn new(bytes: &'a [u8]) -> Self { Self { bytes, position: 0 } }

    fn take(&mut self, count: usize) -> Result<&'a [u8], String> {
        let end = self.position.checked_add(count).ok_or("binary input offset overflow")?;
        let result = self.bytes.get(self.position..end).ok_or("truncated corner file")?;
        self.position = end;
        Ok(result)
    }

    fn u8(&mut self) -> Result<u8, String> { Ok(self.take(1)?[0]) }

    fn u32(&mut self) -> Result<u32, String> {
        let b = self.take(4)?;
        Ok(u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
    }

    fn u64(&mut self) -> Result<u64, String> {
        let b = self.take(8)?;
        Ok(u64::from_le_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]]))
    }

    fn finish(&self) -> Result<(), String> {
        if self.position != self.bytes.len() { Err("unexpected trailing corner data".into()) } else { Ok(()) }
    }
}

// FNV is a corruption detector, not an authenticity or distance certificate.
fn checksum(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325u64;
    for &byte in bytes { hash = (hash ^ u64::from(byte)).wrapping_mul(0x100000001b3); }
    hash
}

fn model_hash() -> u64 {
    let mut bytes = b"corner96-v1:lehmer*2187+co7le:Ad_r:Ad_rj_tau:LR36:htm".to_vec();
    for movement in &MOVES { bytes.extend_from_slice(&movement.corners); }
    checksum(&bytes)
}

fn read_envelope(path: &Path, magic: &[u8; 8], maximum_payload: usize) -> Result<Vec<u8>, String> {
    let mut file = File::open(path).map_err(|e| format!("cannot open {}: {e}", path.display()))?;
    let length = file.metadata().map_err(|e| format!("cannot stat {}: {e}", path.display()))?.len();
    if length < 32 || length > 32 + maximum_payload as u64 {
        return Err("corner file has an invalid bounded size".into());
    }
    let mut header = [0u8; 32];
    file.read_exact(&mut header).map_err(|e| format!("cannot read corner header: {e}"))?;
    let mut reader = ByteReader::new(&header);
    if reader.take(8)? != magic || reader.u64()? != model_hash() {
        return Err("corner file type/version/model does not match this implementation".into());
    }
    let payload_size = reader.u64()?;
    let expected_checksum = reader.u64()?;
    if payload_size != length - 32 || payload_size > maximum_payload as u64 {
        return Err("corner payload length does not match its header".into());
    }
    let mut payload = allocated(checked_usize(payload_size, "corner payload size")?, 0u8, "corner file payload")?;
    file.read_exact(&mut payload).map_err(|e| format!("cannot read corner payload: {e}"))?;
    let mut extra = [0u8; 1];
    if file.read(&mut extra).map_err(|e| format!("cannot check corner file end: {e}"))? != 0 {
        return Err("corner file changed size while being read".into());
    }
    if checksum(&payload) != expected_checksum {
        return Err("corner file checksum mismatch".into());
    }
    Ok(payload)
}

/// Complete tables are atomically published without overwriting any file.
/// Only an existing checkpoint with the same validated format/model may be
/// replaced. A directory-sync error after publication may report failure even
/// though the new file is present. Interrupted temporary files are never read.
fn write_atomic(path: &Path, magic: &[u8; 8], payload: &[u8]) -> Result<(), String> {
    let replacing_checkpoint = match fs::symlink_metadata(path) {
        Ok(metadata) => {
            if magic != CHECKPOINT_MAGIC || !metadata.file_type().is_file() {
                return Err(format!("refusing to overwrite existing file {}", path.display()));
            }
            read_envelope(path, CHECKPOINT_MAGIC, 16 + 5 * FULL_CORNER_ORBIT_COUNT)?;
            true
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Err(error) => return Err(format!("cannot inspect corner output {}: {error}", path.display())),
    };
    let name = path.file_name().ok_or("corner output path must name a file")?;
    let parent = path.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or_else(|| Path::new("."));
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH)
        .map_err(|e| format!("cannot name temporary corner file: {e}"))?.as_nanos();
    let mut temporary_name = OsString::from(".");
    temporary_name.push(name);
    temporary_name.push(format!(".{}.{nonce}.tmp", std::process::id()));
    let temporary_path = parent.join(temporary_name);
    let mut temporary_created = false;
    let result = (|| -> Result<(), String> {
        let mut file = OpenOptions::new().write(true).create_new(true).open(&temporary_path)
            .map_err(|e| format!("cannot create {}: {e}", temporary_path.display()))?;
        temporary_created = true;
        file.write_all(magic).and_then(|_| file.write_all(&model_hash().to_le_bytes()))
            .and_then(|_| file.write_all(&(payload.len() as u64).to_le_bytes()))
            .and_then(|_| file.write_all(&checksum(payload).to_le_bytes()))
            .and_then(|_| file.write_all(payload)).and_then(|_| file.sync_all())
            .map_err(|e| format!("cannot write/sync {}: {e}", temporary_path.display()))?;
        drop(file);
        if replacing_checkpoint {
            // Never remove the previous valid checkpoint first.
            fs::rename(&temporary_path, path).map_err(|e| format!("cannot replace {}: {e}", path.display()))?;
        } else {
            // The existence check above is only diagnostic. hard_link supplies
            // the atomic no-clobber guarantee even if another writer races us.
            fs::hard_link(&temporary_path, path)
                .map_err(|e| format!("cannot publish new {} without overwriting: {e}", path.display()))?;
            fs::remove_file(&temporary_path)
                .map_err(|e| format!("published {}, but cannot remove its temporary link: {e}", path.display()))?;
        }
        temporary_created = false;
        #[cfg(unix)]
        File::open(parent).and_then(|directory| directory.sync_all())
            .map_err(|e| format!("cannot sync corner output directory {}: {e}", parent.display()))?;
        Ok(())
    })();
    if result.is_err() && temporary_created { let _ = fs::remove_file(&temporary_path); }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bounded_symmetry_and_solution_fixtures() {
        let symmetries = CornerSymmetries::new().unwrap();
        assert_eq!(symmetries.len(), 48);
        symmetries.verify_small().unwrap();
    }

    #[test]
    fn corner_rank_extremes_and_moves() {
        for rank in [0, 1, 2_186, 2_187, FULL_CORNER_COUNT as u32 - 1] {
            let cube = full_corner_unrank(rank).unwrap();
            cube.validate().unwrap();
            assert_eq!(full_corner_rank(&cube).unwrap(), rank);
        }
        for movement in &MOVES {
            let rank = full_corner_rank(movement).unwrap();
            assert_eq!(full_corner_unrank(rank).unwrap().corners, movement.corners);
        }
    }

    #[test]
    fn checkpoint_certificate_rejects_wrong_depth_and_missing_root() {
        let symmetries = CornerSymmetries::new().unwrap();
        let wrong_root = [DistanceNode { rank: 0, depth: 1 }];
        assert!(certify(&wrong_root, Some(0), &symmetries, false).is_err());
        let not_root = [DistanceNode { rank: full_corner_rank(&MOVES[0]).unwrap(), depth: 0 }];
        assert!(certify(&not_root, Some(0), &symmetries, false).is_err());
    }
}
