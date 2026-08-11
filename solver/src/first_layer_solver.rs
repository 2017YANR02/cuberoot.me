//! 三阶 First Face / First Layer 两阶段 HTM 最优求解器。
//!
//! 规范底色为 D，四个 D 角是 4..7，四个 D 棱是 8..11。
//! - First Face：这 8 块占据 D 面槽位且 D 色贴纸朝 D，环上排列不限。
//! - First Layer：这 8 块的位置与朝向全部正确，侧色与中心对齐。
//!
//! First Face 把四个角、四个棱各自按“无标号集合”编码：
//! C(8,4)·3^4 × C(12,4)·2^4 = 44,906,400 态。单目标全图 BFS 给出严格
//! 最优距离、完整直方图和直径。First Layer 的有标号空间有
//! P(8,4)·3^4 × P(12,4)·2^4 = 25,866,086,400 态，不整表展开；IDA* 使用
//! First Face 精确表、角4 PDB、棱4 PDB、角棱联合排列 PDB 的最大值，仍严格最优。
//! 所有表均在内存现场生成，不写入磁盘。

use std::sync::{Arc, OnceLock};

use crate::block222_solver::{face_map, ROTS6};
use crate::cube_common::{
    alg_rotation, array_to_index, create_multi_move_table, index_to_array, move_state, state_space,
    valid_moves, Move,
};
use crate::move_tables::MoveTable;

const TRACKED_CORNERS: [i32; 4] = [4, 5, 6, 7];
const TRACKED_EDGES: [i32; 4] = [8, 9, 10, 11];

pub const CORNER4: usize = 136_080; // P(8,4) * 3^4
pub const CORNER_PERM4: usize = 1_680; // P(8,4)
pub const FACE_CORNERS: usize = 5_670; // C(8,4) * 3^4
pub const FACE_EDGES: usize = 7_920; // C(12,4) * 2^4
pub const FIRST_FACE_STATES: usize = FACE_CORNERS * FACE_EDGES;
pub const FIRST_LAYER_STATES: u64 = CORNER4 as u64 * state_space::CROSS as u64;
pub const FIRST_LAYER_CERTIFIED_LOWER_BOUND: u32 = 11;
pub const FIRST_LAYER_UPPER_BOUND: u32 = 20; // 整个三阶还原的 HTM 直径，因此也是本目标上界。

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum FirstLayerStage {
    FirstFace,
    FirstLayer,
}

impl FirstLayerStage {
    pub const ALL: [Self; 2] = [Self::FirstFace, Self::FirstLayer];

    pub const fn key(self) -> &'static str {
        match self {
            Self::FirstFace => "first_face",
            Self::FirstLayer => "first_layer",
        }
    }
}

#[derive(Clone, Debug)]
pub struct FirstLayerSol {
    pub len: u32,
    pub moves: Vec<u8>,
}

/// 该视角所选的物理底面标签。
pub fn first_layer_face_label(rot_idx: usize) -> &'static str {
    static LABELS: OnceLock<[String; 6]> = OnceLock::new();
    &LABELS.get_or_init(|| {
        std::array::from_fn(|ri| {
            let map = face_map(ROTS6[ri], 0);
            let face = (0..6).find(|&f| map[f] == 1).unwrap();
            ["U", "D", "L", "R", "F", "B"][face].to_owned()
        })
    })[rot_idx.min(5)]
}

#[derive(Clone)]
struct SubsetCodec {
    n: usize,
    orientation_base: usize,
    ranks: Vec<u16>,
    masks: Vec<u16>,
    orientation_states: usize,
}

impl SubsetCodec {
    fn new(n: usize, orientation_base: usize) -> Self {
        let mut ranks = vec![u16::MAX; 1usize << n];
        let mut masks = Vec::new();
        for mask in 0..(1usize << n) {
            if mask.count_ones() == 4 {
                ranks[mask] = masks.len() as u16;
                masks.push(mask as u16);
            }
        }
        let orientation_states = orientation_base.pow(4);
        Self {
            n,
            orientation_base,
            ranks,
            masks,
            orientation_states,
        }
    }

    fn len(&self) -> usize {
        self.masks.len() * self.orientation_states
    }

    /// pairs 中位置互异；件身份被有意丢弃。
    fn encode(&self, pairs: &[(u8, u8); 4]) -> usize {
        let mut sorted = *pairs;
        sorted.sort_unstable_by_key(|&(p, _)| p);
        let mut mask = 0usize;
        let mut ori = 0usize;
        for &(p, o) in &sorted {
            assert!((p as usize) < self.n);
            assert!((o as usize) < self.orientation_base);
            mask |= 1usize << p;
            ori = ori * self.orientation_base + o as usize;
        }
        self.ranks[mask] as usize * self.orientation_states + ori
    }

    fn decode(&self, index: usize) -> [(u8, u8); 4] {
        let rank = index / self.orientation_states;
        let mut ori = index % self.orientation_states;
        let mask = self.masks[rank] as usize;
        let mut positions = [0u8; 4];
        let mut count = 0;
        for p in 0..self.n {
            if mask >> p & 1 == 1 {
                positions[count] = p as u8;
                count += 1;
            }
        }
        let mut out = [(0u8, 0u8); 4];
        for i in (0..4).rev() {
            out[i] = (positions[i], (ori % self.orientation_base) as u8);
            ori /= self.orientation_base;
        }
        out
    }
}

struct FirstLayerTables {
    /// 有标号角4/棱4移动表，均规范化为 stride 18、值为直接索引。
    mt_c4: Vec<u32>,
    mt_e4: Vec<u32>,
    c4_to_face: Vec<u16>,
    e4_to_face: Vec<u16>,
    c4_to_perm: Vec<u16>,
    e4_to_perm: Vec<u16>,
    pt_first_face: Vec<u8>,
    pt_c4: Vec<u8>,
    pt_e4: Vec<u8>,
    /// 忽略朝向但同时跟踪四角、四棱身份，idx=cp4*EP4+ep4。
    pt_layer_perm: Vec<u8>,
    c4_solved: usize,
    e4_solved: usize,
    first_face_histogram: Vec<u64>,
}

#[derive(Clone)]
pub struct FirstLayerSolver {
    tables: Arc<FirstLayerTables>,
}

impl FirstLayerSolver {
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new() -> Self {
        static TABLES: OnceLock<Arc<FirstLayerTables>> = OnceLock::new();
        let tables = TABLES
            .get_or_init(|| {
                Arc::new(FirstLayerTables::build(
                    crate::move_tables::instance().ensure_edge4(),
                ))
            })
            .clone();
        Self { tables }
    }

    /// WASM/独立测试入口：棱4表由调用方提供；角4及所有 PDB 现场构建。
    pub fn from_edge4(mt_edge4: Arc<MoveTable>) -> Self {
        Self {
            tables: Arc::new(FirstLayerTables::build(mt_edge4)),
        }
    }

    pub fn first_face_max_depth(&self) -> u8 {
        (self.tables.first_face_histogram.len() - 1) as u8
    }

    pub fn first_face_histogram(&self) -> &[u64] {
        &self.tables.first_face_histogram
    }

    /// 可证明的底层直径下界；精确上界见 FIRST_LAYER_UPPER_BOUND。
    pub fn first_layer_pdb_lower_bound(&self) -> u8 {
        [
            self.tables.pt_c4.iter().copied().max().unwrap_or(0),
            self.tables.pt_e4.iter().copied().max().unwrap_or(0),
            self.tables.pt_layer_perm.iter().copied().max().unwrap_or(0),
            self.first_face_max_depth(),
        ]
        .into_iter()
        .max()
        .unwrap_or(0)
    }

    pub fn first_layer_known_lower_bound(&self) -> u32 {
        (self.first_layer_pdb_lower_bound() as u32).max(FIRST_LAYER_CERTIFIED_LOWER_BOUND)
    }

    fn conj_buf(alg: &[Move], rot: &str) -> Vec<u8> {
        let mut buf: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        alg_rotation(&mut buf, rot);
        buf
    }

    fn walk(&self, buf: &[u8]) -> (usize, usize) {
        let mut c = self.tables.c4_solved;
        let mut e = self.tables.e4_solved;
        for &m in buf {
            c = self.tables.mt_c4[c * 18 + m as usize] as usize;
            e = self.tables.mt_e4[e * 18 + m as usize] as usize;
        }
        (c, e)
    }

    #[inline]
    fn face_h(&self, c: usize, e: usize) -> u8 {
        let qc = self.tables.c4_to_face[c] as usize;
        let qe = self.tables.e4_to_face[e] as usize;
        self.tables.pt_first_face[qc * FACE_EDGES + qe]
    }

    #[inline]
    fn layer_h(&self, c: usize, e: usize) -> u8 {
        let cp = self.tables.c4_to_perm[c] as usize;
        let ep = self.tables.e4_to_perm[e] as usize;
        self.face_h(c, e)
            .max(self.tables.pt_c4[c])
            .max(self.tables.pt_e4[e])
            .max(self.tables.pt_layer_perm[cp * state_space::EP4 + ep])
    }

    fn stage_h(&self, stage: FirstLayerStage, c: usize, e: usize) -> u8 {
        match stage {
            FirstLayerStage::FirstFace => self.face_h(c, e),
            FirstLayerStage::FirstLayer => self.layer_h(c, e),
        }
    }

    fn search_one(&self, stage: FirstLayerStage, c: usize, e: usize, depth: u32, prev: u8) -> bool {
        if depth == 0 {
            return self.stage_h(stage, c, e) == 0;
        }
        let (vmoves, vcnt) = valid_moves();
        let row = &vmoves[prev as usize];
        for &m in &row[..vcnt[prev as usize] as usize] {
            let m = m as usize;
            let nc = self.tables.mt_c4[c * 18 + m] as usize;
            let ne = self.tables.mt_e4[e * 18 + m] as usize;
            if self.stage_h(stage, nc, ne) as u32 <= depth - 1
                && self.search_one(stage, nc, ne, depth - 1, m as u8)
            {
                return true;
            }
        }
        false
    }

    fn distance_from_coords(&self, stage: FirstLayerStage, c: usize, e: usize) -> u32 {
        let lower = self.stage_h(stage, c, e) as u32;
        if lower == 0 {
            return 0;
        }
        if stage == FirstLayerStage::FirstFace {
            return lower;
        }
        for depth in lower..=FIRST_LAYER_UPPER_BOUND {
            if self.search_one(stage, c, e, depth, 18) {
                return depth;
            }
        }
        panic!("legal cube state exceeded the 20 HTM whole-cube upper bound");
    }

    pub fn solve_one(&self, stage: FirstLayerStage, alg: &[Move], rot: &str) -> u32 {
        let (c, e) = self.walk(&Self::conj_buf(alg, rot));
        self.distance_from_coords(stage, c, e)
    }

    pub fn get_stage_stats(&self, stage: FirstLayerStage, alg: &[Move], rots: &[&str]) -> Vec<u32> {
        rots.iter()
            .map(|rot| self.solve_one(stage, alg, rot))
            .collect()
    }

    /// 阶段优先：First Face 六列，随后 First Layer 六列。
    pub fn get_stats(&self, alg: &[Move], rots: &[&str]) -> Vec<u32> {
        FirstLayerStage::ALL
            .into_iter()
            .flat_map(|stage| self.get_stage_stats(stage, alg, rots))
            .collect()
    }

    #[allow(clippy::too_many_arguments)]
    fn enumerate_at(
        &self,
        stage: FirstLayerStage,
        c: usize,
        e: usize,
        depth: u32,
        prev: u8,
        path: &mut Vec<u8>,
        out: &mut Vec<FirstLayerSol>,
        cap: usize,
    ) {
        if depth == 0 || out.len() >= cap {
            return;
        }
        let (vmoves, vcnt) = valid_moves();
        let row = &vmoves[prev as usize];
        for &m in &row[..vcnt[prev as usize] as usize] {
            if out.len() >= cap {
                return;
            }
            let m = m as usize;
            let nc = self.tables.mt_c4[c * 18 + m] as usize;
            let ne = self.tables.mt_e4[e * 18 + m] as usize;
            let h = self.stage_h(stage, nc, ne) as u32;
            if h >= depth {
                continue;
            }
            path.push(m as u8);
            if depth == 1 {
                out.push(FirstLayerSol {
                    len: path.len() as u32,
                    moves: path.clone(),
                });
            } else if h > 0 {
                // 已经命中目标却仍剩步数，拒绝“更短解 + 无效尾动”。
                self.enumerate_at(stage, nc, ne, depth - 1, m as u8, path, out, cap);
            }
            path.pop();
        }
    }

    pub fn enumerate_face(
        &self,
        stage: FirstLayerStage,
        alg: &[Move],
        rot: &str,
        extra: u32,
        cap: usize,
    ) -> (u32, Vec<FirstLayerSol>) {
        let (c, e) = self.walk(&Self::conj_buf(alg, rot));
        let best = self.distance_from_coords(stage, c, e);
        if best == 0 || cap == 0 {
            return (best, Vec::new());
        }
        let mut out = Vec::new();
        let mut path = Vec::new();
        for depth in best..=best.saturating_add(extra).min(FIRST_LAYER_UPPER_BOUND) {
            self.enumerate_at(stage, c, e, depth, 18, &mut path, &mut out, cap);
            if out.len() >= cap {
                break;
            }
        }
        out.sort_by_key(|solution| solution.len);
        out.truncate(cap);
        (best, out)
    }
}

impl FirstLayerTables {
    fn build(mt_edge4: Arc<MoveTable>) -> Self {
        assert_eq!(mt_edge4.state_count as usize, state_space::CROSS);
        assert_eq!(mt_edge4.stride, 24);

        let basic_corn = crate::mt_gen::create_mt_corn();
        let basic_corn_i32: Vec<i32> = basic_corn.iter().map(|&v| v as i32).collect();
        let mt_c4: Vec<u32> = create_multi_move_table(4, 3, 8, CORNER4 as i32, &basic_corn_i32)
            .into_iter()
            .map(|v| v as u32)
            .collect();
        let raw_e4 = mt_edge4.as_u32();
        let mut mt_e4 = vec![0u32; state_space::CROSS * 18];
        for i in 0..state_space::CROSS {
            for m in 0..18 {
                mt_e4[i * 18 + m] = raw_e4[i * 24 + m] / 24;
            }
        }

        let c4_solved = array_to_index(&TRACKED_CORNERS.map(|p| 3 * p), 4, 3, 8) as usize;
        let e4_solved = array_to_index(&TRACKED_EDGES.map(|p| 2 * p), 4, 2, 12) as usize;
        assert_eq!(e4_solved, state_space::CROSS_SOLVED);

        let ccodec = SubsetCodec::new(8, 3);
        let ecodec = SubsetCodec::new(12, 2);
        assert_eq!(ccodec.len(), FACE_CORNERS);
        assert_eq!(ecodec.len(), FACE_EDGES);

        let mt_fc = build_subset_moves(&ccodec, true);
        let mt_fe = build_subset_moves(&ecodec, false);
        let face_goal_c = ccodec.encode(&TRACKED_CORNERS.map(|p| (p as u8, 0)));
        let face_goal_e = ecodec.encode(&TRACKED_EDGES.map(|p| (p as u8, 0)));
        let pt_first_face = build_product_pt(
            &mt_fc,
            FACE_CORNERS,
            &mt_fe,
            FACE_EDGES,
            face_goal_c,
            face_goal_e,
        );
        let first_face_histogram = histogram(&pt_first_face);

        let c4_to_face = build_labeled_maps(CORNER4, 4, 3, 8, &ccodec, true);
        let e4_to_face = build_labeled_maps(state_space::CROSS, 4, 2, 12, &ecodec, true);
        let c4_to_perm = build_labeled_maps(CORNER4, 4, 3, 8, &ccodec, false);
        let e4_to_perm = build_labeled_maps(state_space::CROSS, 4, 2, 12, &ecodec, false);

        let pt_c4 = build_single_pt(&mt_c4, CORNER4, c4_solved);
        let pt_e4 = build_single_pt(&mt_e4, state_space::CROSS, e4_solved);

        let mt_cp4 = build_perm_moves(8, true);
        let mt_ep4 = build_perm_moves(12, false);
        let cp4_solved = array_to_index(&TRACKED_CORNERS, 4, 1, 8) as usize;
        let ep4_solved = array_to_index(&TRACKED_EDGES, 4, 1, 12) as usize;
        assert_eq!(ep4_solved, state_space::EP4_SOLVED);
        let pt_layer_perm = build_product_pt(
            &mt_cp4,
            CORNER_PERM4,
            &mt_ep4,
            state_space::EP4,
            cp4_solved,
            ep4_solved,
        );

        Self {
            mt_c4,
            mt_e4,
            c4_to_face,
            e4_to_face,
            c4_to_perm,
            e4_to_perm,
            pt_first_face,
            pt_c4,
            pt_e4,
            pt_layer_perm,
            c4_solved,
            e4_solved,
            first_face_histogram,
        }
    }
}

fn move_piece(position: u8, orientation: u8, m: Move, corner: bool) -> (u8, u8) {
    let state = move_state(m);
    if corner {
        let (perm, ori) = state.cp_co();
        for new_position in 0..8 {
            if perm[new_position] == position {
                return (new_position as u8, (orientation + ori[new_position]) % 3);
            }
        }
    } else {
        let (perm, ori) = state.ep_eo();
        for new_position in 0..12 {
            if perm[new_position] == position {
                return (new_position as u8, (orientation + ori[new_position]) % 2);
            }
        }
    }
    unreachable!()
}

fn build_subset_moves(codec: &SubsetCodec, corner: bool) -> Vec<u16> {
    let mut table = vec![0u16; codec.len() * 18];
    for index in 0..codec.len() {
        let state = codec.decode(index);
        for m in 0..18 {
            let mut next = state;
            for piece in &mut next {
                *piece = move_piece(piece.0, piece.1, Move::from_index(m), corner);
            }
            table[index * 18 + m] = codec.encode(&next) as u16;
        }
    }
    table
}

fn build_perm_moves(piece_count: usize, corner: bool) -> Vec<u16> {
    let states = if corner {
        CORNER_PERM4
    } else {
        state_space::EP4
    };
    let mut table = vec![0u16; states * 18];
    let mut decoded = [0i32; 4];
    for index in 0..states {
        index_to_array(&mut decoded, index as i32, 4, 1, piece_count as i32);
        for m in 0..18 {
            let mut next = [0i32; 4];
            for i in 0..4 {
                let position = (decoded[i] / 18) as u8;
                next[i] = move_piece(position, 0, Move::from_index(m), corner).0 as i32;
            }
            table[index * 18 + m] = array_to_index(&next, 4, 1, piece_count as i32) as u16;
        }
    }
    table
}

/// labeled coordinate → quotient face coordinate or orientation-free permutation coordinate。
fn build_labeled_maps(
    states: usize,
    n: i32,
    orientation_base: i32,
    piece_count: i32,
    codec: &SubsetCodec,
    quotient: bool,
) -> Vec<u16> {
    let mut out = vec![0u16; states];
    let mut decoded = [0i32; 4];
    for (index, slot) in out.iter_mut().enumerate() {
        index_to_array(&mut decoded, index as i32, n, orientation_base, piece_count);
        let pairs = decoded.map(|v| {
            let raw = v / 18;
            (
                (raw / orientation_base) as u8,
                (raw % orientation_base) as u8,
            )
        });
        *slot = if quotient {
            codec.encode(&pairs) as u16
        } else {
            let positions = pairs.map(|pair| pair.0 as i32);
            array_to_index(&positions, 4, 1, piece_count) as u16
        };
    }
    out
}

fn build_single_pt(mt: &[u32], states: usize, start: usize) -> Vec<u8> {
    let mut pt = vec![u8::MAX; states];
    let mut queue = Vec::with_capacity(states);
    pt[start] = 0;
    queue.push(start as u32);
    let mut head = 0;
    while head < queue.len() {
        let index = queue[head] as usize;
        head += 1;
        let next_depth = pt[index] + 1;
        for m in 0..18 {
            let next = mt[index * 18 + m] as usize;
            if pt[next] == u8::MAX {
                pt[next] = next_depth;
                queue.push(next as u32);
            }
        }
    }
    assert_eq!(queue.len(), states, "single PDB did not cover its space");
    pt
}

fn build_product_pt(
    mt_a: &[u16],
    states_a: usize,
    mt_b: &[u16],
    states_b: usize,
    start_a: usize,
    start_b: usize,
) -> Vec<u8> {
    let total = states_a * states_b;
    let start = start_a * states_b + start_b;
    let mut pt = vec![u8::MAX; total];
    let mut queue = Vec::with_capacity(total);
    pt[start] = 0;
    queue.push(start as u32);
    let mut head = 0;
    while head < queue.len() {
        let index = queue[head] as usize;
        head += 1;
        let a = index / states_b;
        let b = index % states_b;
        let next_depth = pt[index] + 1;
        for m in 0..18 {
            let next_a = mt_a[a * 18 + m] as usize;
            let next_b = mt_b[b * 18 + m] as usize;
            let next = next_a * states_b + next_b;
            if pt[next] == u8::MAX {
                pt[next] = next_depth;
                queue.push(next as u32);
            }
        }
    }
    assert_eq!(queue.len(), total, "product PDB did not cover its space");
    pt
}

fn histogram(pt: &[u8]) -> Vec<u64> {
    let max = pt.iter().copied().max().unwrap_or(0);
    assert_ne!(max, u8::MAX, "distance table contains unreachable states");
    let mut out = vec![0u64; max as usize + 1];
    for &distance in pt {
        out[distance as usize] += 1;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cube_common::{string_to_alg, State};

    fn solver() -> FirstLayerSolver {
        FirstLayerSolver::new()
    }

    fn physical_done(stage: FirstLayerStage, state: &State) -> bool {
        let (cp, co) = state.cp_co();
        let (ep, eo) = state.ep_eo();
        match stage {
            FirstLayerStage::FirstFace => {
                (4..8).all(|p| (4..8).contains(&(cp[p] as usize)) && co[p] == 0)
                    && (8..12).all(|p| (8..12).contains(&(ep[p] as usize)) && eo[p] == 0)
            }
            FirstLayerStage::FirstLayer => {
                (4..8).all(|p| cp[p] as usize == p && co[p] == 0)
                    && (8..12).all(|p| ep[p] as usize == p && eo[p] == 0)
            }
        }
    }

    fn physical_iddfs(state: &State, stage: FirstLayerStage, depth: u32, prev: usize) -> bool {
        if depth == 0 {
            return physical_done(stage, state);
        }
        let (vmoves, vcnt) = valid_moves();
        for &m in &vmoves[prev][..vcnt[prev] as usize] {
            let m = m as usize;
            if physical_iddfs(&state.applied(Move::from_index(m)), stage, depth - 1, m) {
                return true;
            }
        }
        false
    }

    fn pseudo_scramble(seed: u64, len: usize) -> Vec<Move> {
        let mut x = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        let mut out = Vec::with_capacity(len);
        let mut prev = 18usize;
        for _ in 0..len {
            x = x
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            let (vmoves, vcnt) = valid_moves();
            let row = &vmoves[prev];
            let m = row[(x >> 33) as usize % vcnt[prev] as usize] as usize;
            out.push(Move::from_index(m));
            prev = m;
        }
        out
    }

    #[test]
    fn exact_face_distribution_and_known_states() {
        let solver = solver();
        assert_eq!(
            solver.first_face_histogram().iter().sum::<u64>(),
            FIRST_FACE_STATES as u64
        );
        assert_eq!(solver.first_face_histogram()[0], 1);
        assert_eq!(
            solver.first_face_histogram(),
            [
                1, 12, 150, 1_886, 21_916, 242_166, 2_292_695, 14_228_012, 25_293_406, 2_825_994,
                162,
            ]
        );
        assert_eq!(solver.solve_one(FirstLayerStage::FirstFace, &[], ""), 0);
        assert_eq!(
            solver.solve_one(FirstLayerStage::FirstFace, &string_to_alg("D"), ""),
            0
        );
        assert_eq!(
            solver.solve_one(FirstLayerStage::FirstLayer, &string_to_alg("D"), ""),
            1
        );
        assert_eq!(
            (0..6).map(first_layer_face_label).collect::<Vec<_>>(),
            ["D", "U", "L", "R", "F", "B"]
        );
        assert_eq!(solver.first_layer_pdb_lower_bound(), 10);
        // 真题 25001 的规范 D 底层精确为 11，故底层 God 数至少 11；不是把样本最大值当直径。
        let witness =
            string_to_alg("U' B2 U2 F2 L2 D' F2 L2 B' D2 B' L' F R D L' B2 L2 B2 D' L2 U");
        assert_eq!(
            solver.solve_one(FirstLayerStage::FirstLayer, &witness, ""),
            FIRST_LAYER_CERTIFIED_LOWER_BOUND
        );
    }

    /// 完整 State + 物理目标谓词 + IDDFS，绕开所有坐标/PDB，核对短深最优性及 6 视角。
    #[test]
    fn short_depth_matches_independent_state_iddfs() {
        let solver = solver();
        for seed in 10..18u64 {
            let alg = pseudo_scramble(seed, 5);
            for rot in ROTS6 {
                let mut rotated: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
                alg_rotation(&mut rotated, rot);
                let mut state = State::SOLVED;
                for &m in &rotated {
                    state.apply(Move::from_index(m as usize));
                }
                for stage in FirstLayerStage::ALL {
                    let got = solver.solve_one(stage, &alg, rot);
                    let want = (0..=5)
                        .find(|&depth| physical_iddfs(&state, stage, depth, 18))
                        .unwrap();
                    assert_eq!(got, want, "seed={seed} rot={rot:?} stage={stage:?}");
                }
            }
        }
    }

    #[test]
    fn enumeration_reaches_physical_goal_without_trailing_moves() {
        let solver = solver();
        for stage in FirstLayerStage::ALL {
            for seed in 50..56u64 {
                let alg = pseudo_scramble(seed, 10);
                let (best, solutions) = solver.enumerate_face(stage, &alg, "", 1, 16);
                if best == 0 {
                    assert!(solutions.is_empty());
                    continue;
                }
                assert!(solutions.iter().any(|solution| solution.len == best));
                for solution in solutions {
                    let mut state = State::SOLVED;
                    for &m in &alg {
                        state.apply(m);
                    }
                    for &m in &solution.moves {
                        state.apply(Move::from_index(m as usize));
                    }
                    assert!(physical_done(stage, &state));

                    let mut before_last = State::SOLVED;
                    for &m in &alg {
                        before_last.apply(m);
                    }
                    for &m in &solution.moves[..solution.moves.len() - 1] {
                        before_last.apply(Move::from_index(m as usize));
                    }
                    assert!(
                        !physical_done(stage, &before_last),
                        "solution contains a redundant trailing move"
                    );
                }
            }
        }
    }

    #[test]
    fn wca_fixture_exact_throughput_smoke() {
        let solver = solver();
        let fixture = include_str!("../testdata/scramble_5.txt");
        let algorithms: Vec<Vec<Move>> = fixture
            .lines()
            .map(|line| string_to_alg(&line[line.find(',').unwrap() + 1..]))
            .collect();
        let started = std::time::Instant::now();
        let mut checksum = 0u64;
        const REPEATS: usize = 100;
        for _ in 0..REPEATS {
            for alg in &algorithms {
                checksum += solver
                    .get_stats(alg, &ROTS6)
                    .iter()
                    .map(|&v| v as u64)
                    .sum::<u64>();
            }
        }
        let seconds = started.elapsed().as_secs_f64();
        eprintln!(
            "first_layer fixture throughput: {:.1} scrambles/s (checksum={checksum})",
            (algorithms.len() * REPEATS) as f64 / seconds
        );
        assert!(checksum > 0);
    }
}
