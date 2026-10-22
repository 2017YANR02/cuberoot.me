//! Factorized dense indexing of complete-corner 48 or 96 orbits.
//!
//! First quotient the 40320 corner permutations: their spatial/inverse action
//! has 654 orbits. Transport a permutation to its minimum representative, then
//! quotient its 2187 orientations by that representative's full stabilizer.
//! Thus only 654 * 2187 orientation slots need a local-class decoder. The sum
//! of their orientation-orbit counts is 934778, exactly the sparse table's set.
//!
//! Spatial-only indexing uses 984 permutation orbits and 1841970 full orbits.
//! Queries apply one transported affine orientation map; PreparedCornerPdb
//! precompiles it and folds the local-class decoder into direct distance bytes.
//! Exhaustive equivalence and lookup/search measurements are recorded in
//! corner96-validation.md. No dense BFS or new file format is introduced.
//! DenseCornerPdb either converts an already certified sparse PDB or directly
//! certifies that same persistent format on the dense orbit graph.

use super::{
    allocated, checked_usize, corner_cube, full_corner_unrank, inverse, multiply,
    read_envelope, validate_corners, ByteReader, CornerSymmetries, DistanceNode,
    FullCornerPdb, FACTORIAL, FULL_CORNER_ORBIT_COUNT, ID, PDB_MAGIC, UNKNOWN,
};
use crate::corner_coset::{orientation_unrank, ORIENTATION_COUNT};
use crate::cube::{Cube, MOVES};
use std::mem::size_of;
use std::path::Path;

pub const PERMUTATION_COUNT: usize = 40_320;
pub const PERMUTATION_ORBIT_COUNT: usize = 654;
pub const SPATIAL_PERMUTATION_ORBIT_COUNT: usize = 984;
pub const SPATIAL_CORNER_ORBIT_COUNT: usize = 1_841_970;
pub const ORIENTATION_SLOT_COUNT: usize = PERMUTATION_ORBIT_COUNT * ORIENTATION_COUNT;
/// Edges checked by a direct dense load. The construction BFS still uses the
/// complete 36-edge left/right adjacency; this constant concerns certification.
pub const DISTANCE_CERTIFICATE_EDGE_COUNT: usize = 18 * FULL_CORNER_ORBIT_COUNT;

const NO_CLASS: u16 = u16::MAX;
const NO_TOKEN: u8 = u8::MAX;

fn permutation_rank(corners: &[u8; 8]) -> usize {
    let mut rank = 0usize;
    for i in 0..8 {
        let smaller = corners[i + 1..].iter().filter(|&&v| (v & 7) < (corners[i] & 7)).count();
        rank += smaller * FACTORIAL[7 - i] as usize;
    }
    rank
}

fn permutation_unrank(mut rank: usize) -> [u8; 8] {
    let mut available = ID;
    let mut result = ID;
    for i in 0..8 {
        let digit = rank / FACTORIAL[7 - i] as usize;
        rank %= FACTORIAL[7 - i] as usize;
        result[i] = available[digit];
        for j in digit..7 - i { available[j] = available[j + 1]; }
    }
    result
}

fn orientation_rank(corners: &[u8; 8]) -> usize {
    let mut result = 0usize;
    let mut power = 1usize;
    for &corner in &corners[..7] {
        result += usize::from(corner >> 3) * power;
        power *= 3;
    }
    result
}

fn with_orientation(permutation: &[u8; 8], twists: &[u8; 8]) -> [u8; 8] {
    std::array::from_fn(|i| (permutation[i] & 7) | (twists[i] << 3))
}

// Tokens 0..48 are spatial maps, 48..96 are that spatial map after inversion.
// The actual full token is necessary even when two actions have similar
// permutation behavior: their twist signs and offsets must not be discarded.
fn apply_token(corners: &[u8; 8], token: u8, symmetries: &CornerSymmetries) -> [u8; 8] {
    let source = if token >= 48 { inverse(corners) } else { *corners };
    symmetries.maps[(token % 48) as usize].apply(&source)
}

fn inverse_tokens(symmetries: &CornerSymmetries) -> Result<[u8; 96], String> {
    let mut result = [0u8; 96];
    for (i, map) in symmetries.maps.iter().enumerate() {
        let opposite = symmetries.maps.iter().position(|candidate| candidate.moves == map.inverse_moves)
            .ok_or_else(|| "missing inverse spatial action while constructing dense index".to_string())?;
        result[i] = opposite as u8;
        // Inversion commutes with every spatial automorphism.
        result[48 + i] = 48 + opposite as u8;
    }
    Ok(result)
}

/// At fixed permutation, a spatial/inverse operation is an affine map on
/// V={o in F3^8 : sum(o)=0}. Each output uses one signed input plus a bias.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct OrientationAction {
    // Low 3 bits: source position; next 2 bits: additive bias modulo 3.
    source_bias: [u8; 7],
    negative: bool,
}

impl OrientationAction {
    fn compile(permutation: &[u8; 8], token: u8, symmetries: &CornerSymmetries) -> Self {
        let map = &symmetries.maps[(token % 48) as usize];
        let inverted = token >= 48;
        let mut inverse_permutation = ID;
        if inverted {
            for (position, &piece) in permutation.iter().enumerate() {
                inverse_permutation[(piece & 7) as usize] = position as u8;
            }
        }
        let mut source_bias = [0u8; 7];
        for (i, output) in source_bias.iter_mut().enumerate() {
            let j = (map.inverse_conjugator[i] & 7) as usize;
            let source = if inverted { inverse_permutation[j] as usize } else { j };
            let twist_source = if inverted { source } else { (permutation[j] & 7) as usize };
            let bias = ((map.conjugator[twist_source] >> 3) + 3 - (map.conjugator[j] >> 3)) % 3;
            *output = source as u8 | (bias << 3);
        }
        Self { source_bias, negative: map.negate ^ inverted }
    }

    fn apply(&self, twists: &[u8; 8]) -> usize {
        let mut result = 0usize;
        let mut power = 1usize;
        for &entry in &self.source_bias {
            let value = twists[(entry & 7) as usize];
            let signed = if self.negative { (3 - value) % 3 } else { value };
            result += usize::from((signed + (entry >> 3)) % 3) * power;
            power *= 3;
        }
        result
    }
}

/// Both the compiled action and the parent module's group arithmetic are
/// affine on the seven-dimensional orientation space at fixed permutation.
/// Equality at zero and the seven e_i-e_7 basis vectors proves equality at
/// every one of its 2187 points; this is not an arbitrary sample check.
fn verify_affine_action(permutation: &[u8; 8], target_permutation: usize, token: u8,
                        action: &OrientationAction, symmetries: &CornerSymmetries) -> Result<(), String> {
    for basis in 0..8 {
        let mut twists = [0u8; 8];
        if basis != 0 {
            twists[basis - 1] = 1;
            twists[7] = 2;
        }
        let image = apply_token(&with_orientation(permutation, &twists), token, symmetries);
        if permutation_rank(&image) != target_permutation || action.apply(&twists) != orientation_rank(&image) {
            return Err("factorized affine corner action differs from full group action".into());
        }
    }
    Ok(())
}

/// Dense orbit IDs in lexicographic order of the original full-corner
/// canonical ranks. The index contains no distance values.
pub struct DenseCornerIndex {
    permutation_class: Vec<u16>,
    transport: Vec<u8>,
    permutation_representatives: Vec<u16>,
    local_class: Vec<u16>,
    offsets: Vec<u32>,
    representative_bits: Vec<u64>,
    // Prefix population count before each u64 word, including an end sentinel.
    representative_prefix: Vec<u32>,
}

impl DenseCornerIndex {
    pub fn new(symmetries: &CornerSymmetries) -> Result<Self, String> {
        Self::with_inversion(symmetries, true)
    }

    pub fn spatial(symmetries: &CornerSymmetries) -> Result<Self, String> {
        Self::with_inversion(symmetries, false)
    }

    fn with_inversion(symmetries: &CornerSymmetries, inversion: bool) -> Result<Self, String> {
        let permutation_orbits = if inversion { PERMUTATION_ORBIT_COUNT } else { SPATIAL_PERMUTATION_ORBIT_COUNT };
        let corner_orbits = if inversion { FULL_CORNER_ORBIT_COUNT } else { SPATIAL_CORNER_ORBIT_COUNT };
        let orientation_slots = permutation_orbits * ORIENTATION_COUNT;
        let token_count = if inversion { 96 } else { 48 };
        let inverse_token = inverse_tokens(symmetries)?;
        let mut permutation_class = allocated(PERMUTATION_COUNT, NO_CLASS, "dense permutation classes")?;
        let mut transport = allocated(PERMUTATION_COUNT, NO_TOKEN, "dense permutation transporters")?;
        let mut permutation_representatives = Vec::new();
        permutation_representatives.try_reserve_exact(permutation_orbits)
            .map_err(|e| format!("cannot allocate dense permutation representatives: {e}"))?;
        let mut stabilizers: Vec<Vec<u8>> = Vec::new();
        stabilizers.try_reserve_exact(permutation_orbits)
            .map_err(|e| format!("cannot allocate dense permutation stabilizers: {e}"))?;

        // The first unseen permutation is its orbit minimum, because every
        // earlier discovered orbit was marked in its entirety. This performs
        // one token scan per orbit (654*96 or 984*48), not per permutation.
        for rank in 0..PERMUTATION_COUNT {
            if permutation_class[rank] != NO_CLASS { continue; }
            let class = permutation_representatives.len();
            if class >= permutation_orbits {
                return Err("permutation orbit count exceeded the analytic prediction".into());
            }
            let permutation = permutation_unrank(rank);
            permutation_representatives.push(rank as u16);
            let mut stabilizer = Vec::new();
            for token in 0..token_count {
                let image = apply_token(&permutation, token, symmetries);
                let other = permutation_rank(&image);
                if other < rank {
                    return Err("first unseen permutation was not its orbit minimum".into());
                }
                let old = permutation_class[other];
                if old != NO_CLASS && old as usize != class {
                    return Err("distinct permutation orbits intersect".into());
                }
                permutation_class[other] = class as u16;
                transport[other] = transport[other].min(inverse_token[token as usize]);
                if other == rank { stabilizer.push(token); }
            }
            if !stabilizer.contains(&0) || stabilizer.is_empty() {
                return Err("permutation stabilizer lacks the identity".into());
            }
            stabilizers.push(stabilizer);
        }
        if permutation_representatives.len() != permutation_orbits
            || permutation_class.contains(&NO_CLASS) || transport.contains(&NO_TOKEN) {
            return Err("permutation factor did not yield the expected complete orbits".into());
        }

        // Check every stored transport, including its orientation effect. A
        // mere permutation witness would not certify the full corner action.
        for rank in 0..PERMUTATION_COUNT {
            let permutation = permutation_unrank(rank);
            let class = permutation_class[rank] as usize;
            let target = permutation_representatives[class] as usize;
            let token = transport[rank];
            let action = OrientationAction::compile(&permutation, token, symmetries);
            verify_affine_action(&permutation, target, token, &action, symmetries)?;
        }

        let mut local_class = allocated(orientation_slots, NO_CLASS, "dense orientation classes")?;
        let mut representative_bits = allocated((orientation_slots + 63) / 64, 0u64, "dense representative bits")?;
        let mut offsets = Vec::new();
        offsets.try_reserve_exact(permutation_orbits + 1)
            .map_err(|e| format!("cannot allocate dense class offsets: {e}"))?;
        offsets.push(0u32);

        for class in 0..permutation_orbits {
            let permutation_rank = permutation_representatives[class] as usize;
            let permutation = permutation_unrank(permutation_rank);
            let mut actions = Vec::new();
            actions.try_reserve_exact(stabilizers[class].len())
                .map_err(|e| format!("cannot allocate orientation stabilizer actions: {e}"))?;
            for &token in &stabilizers[class] {
                let action = OrientationAction::compile(&permutation, token, symmetries);
                verify_affine_action(&permutation, permutation_rank, token, &action, symmetries)?;
                // A permutation stabilizer can have a kernel on its orientation
                // fiber. Equal affine actions may safely be visited only once.
                if !actions.contains(&action) { actions.push(action); }
            }
            let start = class * ORIENTATION_COUNT;
            let mut classes_in_fiber = 0u16;
            for orientation in 0..ORIENTATION_COUNT {
                if local_class[start + orientation] != NO_CLASS { continue; }
                let label = classes_in_fiber;
                classes_in_fiber = classes_in_fiber.checked_add(1)
                    .ok_or_else(|| "orientation class ID overflow".to_string())?;
                let flat = start + orientation;
                representative_bits[flat / 64] |= 1u64 << (flat % 64);
                let twists = orientation_unrank(orientation)?;
                for action in &actions {
                    let other = action.apply(&twists);
                    if other < orientation {
                        return Err("first unseen orientation was not its stabilizer-orbit minimum".into());
                    }
                    let old = local_class[start + other];
                    if old != NO_CLASS && old != label {
                        return Err("distinct stabilizer orientation orbits intersect".into());
                    }
                    local_class[start + other] = label;
                }
            }
            if classes_in_fiber == 0 || local_class[start..start + ORIENTATION_COUNT].contains(&NO_CLASS) {
                return Err("orientation stabilizer orbits did not cover their fiber".into());
            }
            offsets.push(offsets[class] + u32::from(classes_in_fiber));
        }
        if offsets.last().copied() != Some(corner_orbits as u32) {
            return Err(format!("dense factor has {:?} orbits, expected {corner_orbits}", offsets.last()));
        }

        let mut representative_prefix = Vec::new();
        representative_prefix.try_reserve_exact(representative_bits.len() + 1)
            .map_err(|e| format!("cannot allocate dense select directory: {e}"))?;
        representative_prefix.push(0u32);
        for &word in &representative_bits {
            let next = representative_prefix.last().copied().unwrap_or(0) + word.count_ones();
            representative_prefix.push(next);
        }
        if representative_prefix.last().copied() != offsets.last().copied() {
            return Err("dense representative bitset and class offsets disagree".into());
        }
        let result = Self {
            permutation_class, transport, permutation_representatives, local_class,
            offsets, representative_bits, representative_prefix,
        };
        // Verify the select representation also at every fiber boundary.
        for class in 0..=permutation_orbits {
            if result.rank_before(class * ORIENTATION_COUNT) != result.offsets[class] {
                return Err("dense representative select directory crosses a wrong fiber boundary".into());
            }
        }
        Ok(result)
    }

    pub fn len(&self) -> usize { self.offsets.last().copied().unwrap_or(0) as usize }

    pub fn is_empty(&self) -> bool { self.len() == 0 }

    pub fn permutation_orbits(&self) -> usize { self.permutation_representatives.len() }

    pub fn orientation_slots(&self) -> usize { self.local_class.len() }

    /// Allocated vector buffers only, including their capacities. This excludes
    /// allocator metadata, the enclosing object, shared maps and any PDB data.
    pub fn memory_bytes(&self) -> usize {
        self.permutation_class.capacity() * size_of::<u16>()
            + self.transport.capacity() * size_of::<u8>()
            + self.permutation_representatives.capacity() * size_of::<u16>()
            + self.local_class.capacity() * size_of::<u16>()
            + self.offsets.capacity() * size_of::<u32>()
            + self.representative_bits.capacity() * size_of::<u64>()
            + self.representative_prefix.capacity() * size_of::<u32>()
    }

    /// Exact dense ID of the selected corner orbit. Edges are ignored.
    /// After ranking the permutation this performs one affine orientation
    /// transport, one local-class lookup and an offset addition.
    pub fn index(&self, cube: &Cube, symmetries: &CornerSymmetries) -> Result<usize, String> {
        validate_corners(&cube.corners)?;
        let permutation = permutation_rank(&cube.corners);
        let class = self.permutation_class[permutation] as usize;
        let token = self.transport[permutation];
        let action = OrientationAction::compile(&cube.corners, token, symmetries);
        let twists = cube.corners.map(|corner| corner >> 3);
        let orientation = action.apply(&twists);
        let local = self.local_class[class * ORIENTATION_COUNT + orientation];
        Ok(self.offsets[class] as usize + local as usize)
    }

    /// For the default 96 index, matches CornerSymmetries::canonicalize.
    /// This method returns a rank, not a word-restoration frame witness.
    pub fn canonical_rank(&self, cube: &Cube, symmetries: &CornerSymmetries) -> Result<u32, String> {
        self.canonical_rank_by_index(self.index(cube, symmetries)?)
    }

    pub fn canonical_rank_by_index(&self, index: usize) -> Result<u32, String> {
        let flat = select_position(&self.representative_bits, &self.representative_prefix, index)?;
        if flat >= self.local_class.len() {
            return Err("dense representative select exceeds its orientation universe".into());
        }
        let class = flat / ORIENTATION_COUNT;
        let orientation = flat % ORIENTATION_COUNT;
        Ok(u32::from(self.permutation_representatives[class]) * ORIENTATION_COUNT as u32 + orientation as u32)
    }

    /// A legal Cube with canonical corners and artificial parity-completing
    /// edges, exactly like the parent module's full_corner_unrank.
    pub fn representative(&self, index: usize) -> Result<Cube, String> {
        full_corner_unrank(self.canonical_rank_by_index(index)?)
    }

    fn rank_before(&self, position: usize) -> u32 {
        let word = position / 64;
        let bit = position % 64;
        let complete = self.representative_prefix[word];
        if bit == 0 { complete } else {
            complete + (self.representative_bits[word] & ((1u64 << bit) - 1)).count_ones()
        }
    }
}

fn select_position(bits: &[u64], prefix: &[u32], index: usize) -> Result<usize, String> {
    let total = prefix.last().copied().unwrap_or(0) as usize;
    if index >= total { return Err("dense corner index out of range".into()); }
    let word = prefix.partition_point(|&count| count as usize <= index) - 1;
    let mut remaining = index - prefix[word] as usize;
    let mut value = bits[word];
    while remaining != 0 {
        value &= value - 1;
        remaining -= 1;
    }
    if value == 0 { return Err("invalid dense representative select directory".into()); }
    Ok(word * 64 + value.trailing_zeros() as usize)
}

/// Exact corner distances with a complete semantic certificate. The sparse
/// format remains the persistent interchange format. Conversion retains the
/// input sparse table; direct loading checks the dense graph without allocating
/// the parent loader's 88,179,840-byte raw-distance certificate. Neither route
/// establishes measured speed or a platform-independent peak memory bound.
pub struct DenseCornerPdb {
    index: DenseCornerIndex,
    values: Vec<u8>,
    maximum: u8,
}

impl DenseCornerPdb {
    /// Lift the already certified exact distance to the finer spatial-only
    /// quotient. The value at every representative is inherited, not weakened.
    pub fn spatial_from_certified(source: &Self, symmetries: &CornerSymmetries) -> Result<Self, String> {
        let index = DenseCornerIndex::spatial(symmetries)?;
        let mut values = allocated(index.len(), UNKNOWN, "spatial corner distances")?;
        for (id, value) in values.iter_mut().enumerate() {
            *value = source.distance(&index.representative(id)?, symmetries)?;
        }
        let result = Self { index, values, maximum: source.maximum };
        result.certify_graph(symmetries)?;
        Ok(result)
    }

    pub fn from_sparse(sparse: &FullCornerPdb, symmetries: &CornerSymmetries) -> Result<Self, String> {
        let index = DenseCornerIndex::new(symmetries)?;
        if sparse.len() != index.len() {
            return Err("sparse and dense corner orbit counts differ".into());
        }
        let result = Self::from_records(index, sparse.nodes.iter().copied().map(Ok), symmetries)?;
        if result.maximum != sparse.max_distance() {
            return Err("sparse and dense corner distance maxima differ".into());
        }
        // The bijection and copied values transport the sparse table's complete
        // root/Lipschitz/descent certificate; no weaker table is substituted.
        Ok(result)
    }

    /// Reads the existing full-corner file format and performs a complete
    /// semantic certificate using every canonical representative's 18 right
    /// successors. The directed representative graph has the exact distance TO
    /// the identity, even though its edges need not be symmetric. This does not
    /// authorize ordinary outward BFS on those 18 edges. No raw full-corner
    /// distance array is allocated, and neither a checksum nor the expected
    /// record count is accepted as a shortest-distance certificate.
    pub fn load_and_verify(path: &Path, symmetries: &CornerSymmetries) -> Result<Self, String> {
        let index = DenseCornerIndex::new(symmetries)?;
        let result = {
            let bytes = read_envelope(path, PDB_MAGIC, 8 + 5 * FULL_CORNER_ORBIT_COUNT)?;
            let mut reader = ByteReader::new(&bytes);
            let count = checked_usize(reader.u64()?, "dense corner PDB length")?;
            if count != index.len() {
                return Err("dense corner load requires every full-corner orbit record".into());
            }
            // Parse directly into dense values: retaining a separate sparse
            // DistanceNode array is unnecessary for this loading route.
            let records = (0..count).map(|_| {
                Ok(DistanceNode { rank: reader.u32()?, depth: reader.u8()? })
            });
            let result = Self::from_records(index, records, symmetries)?;
            reader.finish()?;
            result
        };
        // The input payload has been released before checking all graph edges.
        result.certify_graph(symmetries)?;
        Ok(result)
    }

    // This helper establishes only the representative/value bijection. A
    // public constructor must additionally inherit or verify a graph-distance
    // certificate before it returns the result to a caller.
    fn from_records(index: DenseCornerIndex,
                    records: impl Iterator<Item = Result<DistanceNode, String>>,
                    symmetries: &CornerSymmetries) -> Result<Self, String> {
        let mut values = allocated(index.len(), UNKNOWN, "dense corner distances")?;
        let mut previous = None;
        let mut count = 0usize;
        for node in records {
            let node = node?;
            if previous.is_some_and(|rank| rank >= node.rank) {
                return Err("corner PDB keys must be strictly sorted".into());
            }
            previous = Some(node.rank);
            if node.depth == UNKNOWN || (node.rank == 0) != (node.depth == 0) {
                return Err("corner PDB must have exactly the identity as its zero-distance orbit".into());
            }
            let cube = full_corner_unrank(node.rank)?;
            let dense = index.index(&cube, symmetries)?;
            if values[dense] != UNKNOWN {
                return Err("two sparse corner representatives map to one dense ID".into());
            }
            if index.canonical_rank_by_index(dense)? != node.rank {
                return Err("sparse to dense corner representative round trip failed".into());
            }
            values[dense] = node.depth;
            count += 1;
        }
        if count != index.len() || values.contains(&UNKNOWN) {
            return Err("corner records did not cover every dense corner ID".into());
        }
        let maximum = values.iter().copied().max().unwrap_or(0);
        Ok(Self { index, values, maximum })
    }

    /// Let Q_R have one vertex per selected orbit and the 18 right successors of its
    /// chosen representative. True distance D is constant on every orbit; each
    /// edge changes D by at most one, and each non-root representative has a
    /// right move on a geodesic that decreases D. Therefore the directed
    /// distance in Q_R TO the root equals D, without requiring full quotient
    /// adjacency or symmetric edges.
    ///
    /// Unique root + edge Lipschitz then proves stored value <= D along a
    /// shortest directed path; a descending edge at every positive vertex
    /// proves D <= stored value. This is a certificate for a complete fixed
    /// payload, not a claim that outward 18-edge BFS from the root is valid.
    fn certify_graph(&self, symmetries: &CornerSymmetries) -> Result<(), String> {
        for dense in 0..self.len() {
            let cube = self.index.representative(dense)?;
            let depth = self.values[dense];
            let mut descends = depth == 0;
            for movement in &MOVES {
                let corners = multiply(&cube.corners, &movement.corners);
                let other = self.index.index(&corner_cube(corners), symmetries)?;
                let other_depth = self.values[other];
                if depth.abs_diff(other_depth) > 1 {
                    return Err("dense corner PDB violates a representative right-edge Lipschitz bound".into());
                }
                if other_depth.checked_add(1) == Some(depth) { descends = true; }
            }
            if !descends {
                return Err("dense corner PDB has a positive vertex without a descending edge".into());
            }
        }
        Ok(())
    }

    pub fn index(&self) -> &DenseCornerIndex { &self.index }

    pub fn len(&self) -> usize { self.values.len() }

    pub fn is_empty(&self) -> bool { self.values.is_empty() }

    pub fn max_distance(&self) -> u8 { self.maximum }

    pub fn memory_bytes(&self) -> usize { self.index.memory_bytes() + self.values.capacity() }

    pub fn distance(&self, cube: &Cube, symmetries: &CornerSymmetries) -> Result<u8, String> {
        Ok(self.values[self.index.index(cube, symmetries)?])
    }

    /// Compile one transport per permutation and fold the local-class decoder
    /// into distance bytes. Build-only representative/select arrays are absent
    /// from this owned runtime layout, so the original DenseCornerPdb may drop.
    pub fn prepare_lookup(&self, symmetries: &CornerSymmetries) -> Result<PreparedCornerPdb, String> {
        let mut permutations = Vec::new();
        permutations.try_reserve_exact(PERMUTATION_COUNT).map_err(|e| e.to_string())?;
        for rank in 0..PERMUTATION_COUNT {
            let permutation = permutation_unrank(rank);
            let class = self.index.permutation_class[rank] as usize;
            let action = OrientationAction::compile(&permutation, self.index.transport[rank], symmetries);
            permutations.push(PreparedPermutation { action, base: (class * ORIENTATION_COUNT) as u32 });
        }
        let mut values = allocated(self.index.orientation_slots(), UNKNOWN, "prepared corner fibers")?;
        for (flat, value) in values.iter_mut().enumerate() {
            let class = flat / ORIENTATION_COUNT;
            let id = self.index.offsets[class] as usize + self.index.local_class[flat] as usize;
            *value = self.values[id];
        }
        Ok(PreparedCornerPdb { permutations, values, maximum: self.maximum, orbits: self.len() })
    }
}

#[derive(Clone, Copy)]
struct PreparedPermutation {
    action: OrientationAction,
    base: u32,
}

/// Same exact distances, with one permutation lookup and one distance lookup.
/// Some values repeat within a fiber, avoiding the larger u16 class decoder.
pub struct PreparedCornerPdb {
    permutations: Vec<PreparedPermutation>,
    values: Vec<u8>,
    maximum: u8,
    orbits: usize,
}

impl PreparedCornerPdb {
    pub fn max_distance(&self) -> u8 { self.maximum }
    pub fn orbits(&self) -> usize { self.orbits }
    pub fn memory_bytes(&self) -> usize {
        self.permutations.capacity() * size_of::<PreparedPermutation>() + self.values.capacity()
    }
    /// Input has valid corners, as required by the existing search contract.
    #[inline]
    pub fn distance(&self, cube: &Cube) -> u8 {
        let query = &self.permutations[permutation_rank(&cube.corners)];
        let twists = cube.corners.map(|corner| corner >> 3);
        self.values[query.base as usize + query.action.apply(&twists)]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cube::MOVES;

    #[test]
    fn affine_corner_actions_match_full_arithmetic_on_basis() {
        let symmetries = CornerSymmetries::new().unwrap();
        let permutations = [ID, MOVES[0].corners, MOVES[3].corners, [5, 4, 7, 6, 1, 0, 3, 2]];
        for permutation in permutations {
            let permutation = permutation.map(|corner| corner & 7);
            for token in 0..96u8 {
                let target = permutation_rank(&apply_token(&permutation, token, &symmetries));
                let action = OrientationAction::compile(&permutation, token, &symmetries);
                verify_affine_action(&permutation, target, token, &action, &symmetries).unwrap();
            }
        }
    }

    #[test]
    fn representative_select_handles_empty_words() {
        let bits = [1u64 << 1, 0, 1u64 << 63];
        let prefix = [0, 1, 1, 2];
        assert_eq!(select_position(&bits, &prefix, 0).unwrap(), 1);
        assert_eq!(select_position(&bits, &prefix, 1).unwrap(), 191);
        assert!(select_position(&bits, &prefix, 2).is_err());
    }
}
