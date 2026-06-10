//! block222_solver: 2x2x2 块求解器(1 角 + 3 棱,cstimer "2x2x2" 工具同语义)。
//!
//! 规范块 = DBL:角 4 (DBL) + 棱 8 (DB)、11 (DL)、0 (BL)。
//! 状态空间 = CORNER(24) × EDGE3(10560) = 253,440,构造时全空间 BFS 出精确
//! 距离表(u8 ~248KB,毫秒级)——查长度 O(1),枚举解的启发式精确(首达即最优)。
//!
//! 8 个块位置(URF..DRB)通过共轭归约到规范块:视角 rot(6 底色,同 std 的
//! z0/z2/z3/z1/x3/x1)× y^k(k=0..3,该底色下 4 个贴底块)。每视角值 = 4 块最小。
//!
//! native + wasm 双轨:native 走 manager(mt_edge3/mt_corn 磁盘表),wasm 走
//! from_tables(表字节由 JS 喂入,距离表现场 BFS)。

use std::sync::Arc;

use crate::cube_common::{
    alg_rotation, array_to_index, rot_map, state_space, valid_moves, Move,
};
use crate::move_tables::MoveTable;

/// 规范块 DBL 的角索引与 3 条棱索引(DB, DL, BL)。
const CANON_CORNER: usize = 4;
const CANON_EDGES: [usize; 3] = [8, 11, 0];

/// 6 视角 rot 串,顺序与 std_analyzer 列序 z0/z2/z3/z1/x3/x1 一致。
pub const ROTS6: [&str; 6] = ["", "z2", "z'", "z", "x'", "x"];
/// y^k 的记号(解前缀用)。
pub const Y_NAMES: [&str; 4] = ["", "y", "y2", "y'"];

/// 面类型顺序(= Move 索引/3):U D L R F B。
const FACE_U: u8 = 0;
const FACE_D: u8 = 1;
const FACE_L: u8 = 2;
const FACE_B: u8 = 5;

/// 8 个角的 cstimer 风格名,索引 = 角编号(见 cube_common MOVE_STATES 标号)。
const CORNER_NAMES: [&str; 8] = ["ULB", "UBR", "URF", "UFL", "DBL", "DRB", "DFR", "DLF"];

/// 角编号 → 面集合 bitmask(bit = 面类型)。
const CORNER_FACE_MASK: [u8; 8] = [
    1 << FACE_U | 1 << FACE_B | 1 << FACE_L, // 0 ULB
    1 << FACE_U | 1 << FACE_B | 1 << 3,      // 1 UBR
    1 << FACE_U | 1 << 4 | 1 << 3,           // 2 URF
    1 << FACE_U | 1 << 4 | 1 << FACE_L,      // 3 UFL
    1 << FACE_D | 1 << FACE_B | 1 << FACE_L, // 4 DBL
    1 << FACE_D | 1 << FACE_B | 1 << 3,      // 5 DRB
    1 << FACE_D | 1 << 4 | 1 << 3,           // 6 DFR
    1 << FACE_D | 1 << 4 | 1 << FACE_L,      // 7 DLF
];

/// (rot, yk) 共轭的复合面映射:探针法(对每面取代表 move 走 alg_rotation + rot_map),
/// 与求解路径用同一套变换,保证标签与实际求的块一致。
fn face_map(rot: &str, yk: usize) -> [u8; 6] {
    let rm = rot_map();
    let mut map = [0u8; 6];
    for t in 0..6u8 {
        let mut buf = [t * 3];
        alg_rotation(&mut buf, rot);
        map[t as usize] = rm[yk][buf[0] as usize] / 3;
    }
    map
}

/// (rot_idx, yk) 求的物理块标签(原始朝向下的角名,如 "DBL")。
/// 物理面 = 复合映射的原像 {D, B, L}。
pub fn block_label(rot_idx: usize, yk: usize) -> &'static str {
    use std::sync::OnceLock;
    static V: OnceLock<[[&'static str; 4]; 6]> = OnceLock::new();
    V.get_or_init(|| {
        let mut tbl = [[""; 4]; 6];
        for (ri, rot) in ROTS6.iter().enumerate() {
            for k in 0..4 {
                let map = face_map(rot, k);
                let mut mask = 0u8;
                for (t, &nt) in map.iter().enumerate() {
                    if nt == FACE_D || nt == FACE_B || nt == FACE_L {
                        mask |= 1 << t;
                    }
                }
                let ci = CORNER_FACE_MASK.iter().position(|&m| m == mask).unwrap();
                tbl[ri][k] = CORNER_NAMES[ci];
            }
        }
        tbl
    })[rot_idx][yk]
}

/// 单条解:yk(底色下第几个块)、长度、规范帧 move 索引路径。
pub struct BlockSol {
    pub yk: usize,
    pub len: u32,
    pub moves: Vec<u8>,
}

pub struct Block222Solver {
    mt_edge3: Arc<MoveTable>,
    mt_corn: Arc<MoveTable>,
    /// 全空间精确距离表,idx = corner_idx * EDGE3 + edge3_idx。
    pt: Vec<u8>,
    corn_solved: usize,
    e3_solved: usize,
}

impl Block222Solver {
    /// native:走 manager(生成/加载 mt_edge3 + mt_corn)。
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new() -> Self {
        let mtm = crate::move_tables::instance();
        Self::from_tables(mtm.ensure_edge3(), mtm.ensure_corn())
    }

    /// 直接用预建表构造(WASM:JS fetch 表字节 from_bin 后喂入)。
    /// 距离表现场 BFS(253,440 态,毫秒级)。
    pub fn from_tables(mt_edge3: Arc<MoveTable>, mt_corn: Arc<MoveTable>) -> Self {
        let corn_solved = array_to_index(&[(3 * CANON_CORNER) as i32], 1, 3, 8) as usize;
        let edges: Vec<i32> = CANON_EDGES.iter().map(|&e| (2 * e) as i32).collect();
        let e3_solved = array_to_index(&edges, 3, 2, 12) as usize;
        let pt = Self::build_pt(mt_edge3.as_u32(), mt_corn.as_u32(), corn_solved, e3_solved);
        Block222Solver { mt_edge3, mt_corn, pt, corn_solved, e3_solved }
    }

    /// 全空间 frontier BFS(单线程,~4.6M 转移)。
    fn build_pt(mt_e3: &[u32], mt_c: &[u32], corn_solved: usize, e3_solved: usize) -> Vec<u8> {
        let e3 = state_space::EDGE3;
        let total = state_space::CORNER * e3;
        let mut pt = vec![255u8; total];
        let start = corn_solved * e3 + e3_solved;
        pt[start] = 0;
        let mut frontier: Vec<u32> = vec![start as u32];
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for &i in &frontier {
                let c = i as usize / e3;
                let e = i as usize % e3;
                let cb = c * 18;
                let eb = e * 18;
                for m in 0..18 {
                    let ni = mt_c[cb + m] as usize * e3 + mt_e3[eb + m] as usize;
                    if pt[ni] == 255 {
                        pt[ni] = d + 1;
                        next.push(ni as u32);
                    }
                }
            }
            d += 1;
            frontier = next;
        }
        pt
    }

    /// 距离表最大深度(块的 God's number,信息用)。
    pub fn max_depth(&self) -> u8 {
        self.pt.iter().copied().filter(|&v| v != 255).max().unwrap_or(0)
    }

    /// 共轭:alg → rot 视角 → y^k 帧的 move 索引序列。
    fn conj_buf(alg: &[Move], rot: &str, yk: usize) -> Vec<u8> {
        let mut buf: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        alg_rotation(&mut buf, rot);
        let rm = &rot_map()[yk];
        for b in buf.iter_mut() {
            *b = rm[*b as usize];
        }
        buf
    }

    /// 从 SOLVED 走 buf,返回 (corner_idx, edge3_idx)。
    fn walk(&self, buf: &[u8]) -> (usize, usize) {
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge3.as_u32();
        let mut c = self.corn_solved;
        let mut e = self.e3_solved;
        for &m in buf {
            c = mt_c[c * 18 + m as usize] as usize;
            e = mt_e[e * 18 + m as usize] as usize;
        }
        (c, e)
    }

    /// 单 (视角, yk) 最优步数(精确表直查,无搜索)。
    pub fn solve_one(&self, alg: &[Move], rot: &str, yk: usize) -> u32 {
        let (c, e) = self.walk(&Self::conj_buf(alg, rot, yk));
        self.pt[c * state_space::EDGE3 + e] as u32
    }

    /// 单视角 4 个贴底块明细(yk 序 0..4)。
    pub fn face_blocks(&self, alg: &[Move], rot: &str) -> [u32; 4] {
        let mut out = [0u32; 4];
        for (k, slot) in out.iter_mut().enumerate() {
            *slot = self.solve_one(alg, rot, k);
        }
        out
    }

    /// 多视角批量统计:每视角 = 4 块最小,顺序与 `rots` 一致。
    pub fn get_stats(&self, alg: &[Move], rots: &[&str]) -> Vec<u32> {
        rots.iter()
            .map(|r| self.face_blocks(alg, r).into_iter().min().unwrap())
            .collect()
    }

    /// 枚举恰好 `depth` 步内的解(精确 pt 剪枝,语义与 CrossSolver::enumerate 一致)。
    #[allow(clippy::too_many_arguments)]
    fn enumerate(
        &self,
        c: usize,
        e: usize,
        depth: u32,
        prev: u8,
        path: &mut Vec<u8>,
        out: &mut Vec<Vec<u8>>,
        cap: usize,
    ) {
        if out.len() >= cap {
            return;
        }
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge3.as_u32();
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let nc = mt_c[c * 18 + m] as usize;
            let ne = mt_e[e * 18 + m] as usize;
            if self.pt[nc * state_space::EDGE3 + ne] as u32 >= depth {
                continue;
            }
            path.push(m as u8);
            if depth == 1 {
                out.push(path.clone());
            } else {
                self.enumerate(nc, ne, depth - 1, m as u8, path, out, cap);
            }
            path.pop();
        }
    }

    /// 单视角多解:4 个 yk 各枚举(预算 = 全局最优 + extra),合并按 (len, yk) 排序,
    /// cap 截断。返回 (全局最优, 解集);全局最优 = 0 时解集为空(已有块成型)。
    pub fn enumerate_face(
        &self,
        alg: &[Move],
        rot: &str,
        extra: u32,
        cap: usize,
    ) -> (u32, Vec<BlockSol>) {
        let mut ends = [(0usize, 0usize); 4];
        let mut dists = [0u32; 4];
        for k in 0..4 {
            let (c, e) = self.walk(&Self::conj_buf(alg, rot, k));
            ends[k] = (c, e);
            dists[k] = self.pt[c * state_space::EDGE3 + e] as u32;
        }
        let best = dists.iter().copied().min().unwrap();
        let mut sols: Vec<BlockSol> = Vec::new();
        if best == 0 {
            return (0, sols);
        }
        let budget = best + extra;
        for k in 0..4 {
            if dists[k] > budget {
                continue;
            }
            let (c, e) = ends[k];
            let mut out = Vec::new();
            let mut path = Vec::new();
            for d in dists[k]..=budget {
                self.enumerate(c, e, d, 18, &mut path, &mut out, cap);
                if out.len() >= cap {
                    break;
                }
            }
            sols.extend(out.into_iter().map(|moves| BlockSol {
                yk: k,
                len: moves.len() as u32,
                moves,
            }));
        }
        sols.sort_by_key(|s| (s.len, s.yk));
        sols.truncate(cap);
        (best, sols)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cube_common::{move_state, string_to_alg, test_env_lock, State};
    use std::collections::HashMap;
    use std::path::PathBuf;

    fn setup_solver(name: &str) -> (Block222Solver, PathBuf) {
        let dir = PathBuf::from("target").join("test-tables").join(name);
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::env::set_var("CUBE_TABLE_DIR", &dir);
        (Block222Solver::new(), dir)
    }

    #[test]
    fn pt_basics_and_single_moves() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let (s, dir) = setup_solver("block222_basics");

        // 全空间可达
        assert!(s.pt.iter().all(|&v| v != 255), "unreachable states found");
        // 已知:2x2x2 块 God's number 较小,sanity 上界
        let md = s.max_depth();
        assert!((7..=12).contains(&md), "suspicious max depth {}", md);

        // 默认视角(底 D)规范块 DBL:U/R/F 不碰 → 仍有块为 0;D/L/B 破坏全部 4 个贴底块?
        // 注意 get_stats 是 4 块最小:U 不碰任何贴 D 块 → 0;D 整层位移 4 块 → 1。
        let z0 = |scr: &str| s.get_stats(&string_to_alg(scr), &["",])[0];
        assert_eq!(z0("U"), 0);
        assert_eq!(z0("D"), 1);
        assert_eq!(z0(""), 0);
        // R 破坏 DFR/DRB 但 DBL/DLF 完好 → 0
        assert_eq!(z0("R"), 0);
        // 单块视为:solve_one yk 固定。D 后规范块 DBL 距离 1
        assert_eq!(s.solve_one(&string_to_alg("D"), "", 0), 1);
        // U 后规范块不动
        assert_eq!(s.solve_one(&string_to_alg("U"), "", 0), 0);

        let _ = std::fs::remove_dir_all(&dir);
    }

    // ---------- 独立暴力对照 ----------
    // 用 MOVE_STATES 的 (位置,朝向) 单件运动学(绕开 mt 表与 Lehmer 编码)逐块建距离表,
    // 8 块 × 全空间 BFS,然后随机打乱 × 24 (rot,yk) 全对照。

    /// 角单件:位置 p、朝向 o,应用 move m 后的 (p', o')。
    fn move_piece_corner(p: u8, o: u8, m: Move) -> (u8, u8) {
        let ms = move_state(m);
        let (mcp, mco) = ms.cp_co();
        for i in 0..8 {
            if mcp[i] == p {
                return (i as u8, (o + mco[i]) % 3);
            }
        }
        unreachable!()
    }

    fn move_piece_edge(p: u8, o: u8, m: Move) -> (u8, u8) {
        let ms = move_state(m);
        let (mep, meo) = ms.ep_eo();
        for i in 0..12 {
            if mep[i] == p {
                return (i as u8, (o + meo[i]) % 2);
            }
        }
        unreachable!()
    }

    /// 块定义:角索引 + 3 棱索引(棱 = 面集合含于角面集合)。
    fn block_pieces(corner: usize) -> (usize, [usize; 3]) {
        // 棱面集合(bitmask,面类型同 CORNER_FACE_MASK)
        const EDGE_FACE_MASK: [u8; 12] = [
            1 << 5 | 1 << 2, // 0 BL
            1 << 5 | 1 << 3, // 1 BR
            1 << 4 | 1 << 3, // 2 FR
            1 << 4 | 1 << 2, // 3 FL
            1 << 0 | 1 << 5, // 4 UB
            1 << 0 | 1 << 3, // 5 UR
            1 << 0 | 1 << 4, // 6 UF
            1 << 0 | 1 << 2, // 7 UL
            1 << 1 | 1 << 5, // 8 DB
            1 << 1 | 1 << 3, // 9 DR
            1 << 1 | 1 << 4, // 10 DF
            1 << 1 | 1 << 2, // 11 DL
        ];
        let cm = CORNER_FACE_MASK[corner];
        let mut edges = [0usize; 3];
        let mut n = 0;
        for (e, &em) in EDGE_FACE_MASK.iter().enumerate() {
            if em & cm == em {
                edges[n] = e;
                n += 1;
            }
        }
        assert_eq!(n, 3);
        (corner, edges)
    }

    /// 暴力距离表:key = (((c*24+e0)*24+e1)*24+e2),c/e_i = 角(3p+o)/棱(2p+o) 单件状态。
    fn brute_table(corner: usize) -> HashMap<u64, u8> {
        let (c, edges) = block_pieces(corner);
        let home = |cp: u8, co: u8, e: [(u8, u8); 3]| -> u64 {
            let mut k = (3 * cp + co) as u64;
            for (p, o) in e {
                k = k * 24 + (2 * p + o) as u64;
            }
            k
        };
        let start = home(
            c as u8,
            0,
            [(edges[0] as u8, 0), (edges[1] as u8, 0), (edges[2] as u8, 0)],
        );
        let mut dist: HashMap<u64, u8> = HashMap::new();
        dist.insert(start, 0);
        let mut frontier = vec![(
            (c as u8, 0u8),
            [(edges[0] as u8, 0u8), (edges[1] as u8, 0u8), (edges[2] as u8, 0u8)],
        )];
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for &(cc, ee) in &frontier {
                for m in Move::ALL {
                    let nc = move_piece_corner(cc.0, cc.1, m);
                    let ne = [
                        move_piece_edge(ee[0].0, ee[0].1, m),
                        move_piece_edge(ee[1].0, ee[1].1, m),
                        move_piece_edge(ee[2].0, ee[2].1, m),
                    ];
                    let key = home(nc.0, nc.1, ne);
                    if let std::collections::hash_map::Entry::Vacant(v) = dist.entry(key) {
                        v.insert(d + 1);
                        next.push((nc, ne));
                    }
                }
            }
            d += 1;
            frontier = next;
        }
        dist
    }

    /// 打乱后查暴力表:跟踪块 4 件在打乱后的 (位置,朝向)。
    fn brute_dist(table: &HashMap<u64, u8>, corner: usize, alg: &[Move]) -> u8 {
        let (c, edges) = block_pieces(corner);
        let mut cc = (c as u8, 0u8);
        let mut ee = [
            (edges[0] as u8, 0u8),
            (edges[1] as u8, 0u8),
            (edges[2] as u8, 0u8),
        ];
        for &m in alg {
            cc = move_piece_corner(cc.0, cc.1, m);
            for e in ee.iter_mut() {
                *e = move_piece_edge(e.0, e.1, m);
            }
        }
        let mut k = (3 * cc.0 + cc.1) as u64;
        for (p, o) in ee {
            k = k * 24 + (2 * p + o) as u64;
        }
        table[&k]
    }

    /// 确定性伪随机打乱(LCG,免外部依赖)。
    fn pseudo_scramble(seed: u64, len: usize) -> Vec<Move> {
        let mut x = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        let mut out = Vec::with_capacity(len);
        let mut prev = 18usize;
        for _ in 0..len {
            x = x.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            let (vmoves, vcnt) = valid_moves();
            let row = &vmoves[prev];
            let m = row[(x >> 33) as usize % vcnt[prev] as usize] as usize;
            out.push(Move::from_index(m));
            prev = m;
        }
        out
    }

    #[test]
    fn brute_force_cross_check_all_24_views() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let (s, dir) = setup_solver("block222_brute");

        // 8 块暴力表
        let names_to_corner: HashMap<&str, usize> = CORNER_NAMES
            .iter()
            .enumerate()
            .map(|(i, &n)| (n, i))
            .collect();
        let tables: Vec<HashMap<u64, u8>> = (0..8).map(brute_table).collect();
        // 暴力表大小 = 全空间
        for t in &tables {
            assert_eq!(t.len(), state_space::CORNER * state_space::EDGE3);
        }

        for seed in 0..60u64 {
            let alg = pseudo_scramble(seed, 20);
            for (ri, rot) in ROTS6.iter().enumerate() {
                for k in 0..4 {
                    let got = s.solve_one(&alg, rot, k);
                    let label = block_label(ri, k);
                    let corner = names_to_corner[label];
                    let want = brute_dist(&tables[corner], corner, &alg) as u32;
                    assert_eq!(
                        got, want,
                        "seed={} rot={:?} yk={} label={}",
                        seed, rot, k, label
                    );
                }
            }
        }

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn label_table_structure() {
        // 24 个 (rot,yk):每视角 4 块互异;8 块各出现 3 次;
        // 视角 0(底 D)4 块都是 D 层角。
        let mut count: HashMap<&str, u32> = HashMap::new();
        for ri in 0..6 {
            let mut seen = std::collections::HashSet::new();
            for k in 0..4 {
                let l = block_label(ri, k);
                assert!(seen.insert(l), "dup label {} in rot {}", l, ri);
                *count.entry(l).or_insert(0) += 1;
            }
        }
        assert_eq!(count.len(), 8);
        assert!(count.values().all(|&c| c == 3));
        for k in 0..4 {
            assert!(block_label(0, k).starts_with('D'), "rot0 yk{} not D-layer", k);
        }
        // 规范:rot0 yk0 = DBL
        assert_eq!(block_label(0, 0), "DBL");
    }

    #[test]
    fn enumerate_face_solutions_are_valid() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let (s, dir) = setup_solver("block222_enum");

        for seed in 100..115u64 {
            let alg = pseudo_scramble(seed, 20);
            for (ri, rot) in ROTS6.iter().enumerate() {
                let stats_min = s.get_stats(&alg, &[rot])[0];
                let (best, sols) = s.enumerate_face(&alg, rot, 1, 30);
                assert_eq!(best, stats_min, "best mismatch seed={} rot={}", seed, ri);
                if best == 0 {
                    assert!(sols.is_empty());
                    continue;
                }
                assert!(!sols.is_empty(), "no sols seed={} rot={}", seed, ri);
                for sol in &sols {
                    assert!(sol.len >= best && sol.len <= best + 1);
                    assert_eq!(sol.len as usize, sol.moves.len());
                    // 解有效性:共轭帧下 走(打乱+解)后规范块归位
                    let mut buf = Block222Solver::conj_buf(&alg, rot, sol.yk);
                    buf.extend_from_slice(&sol.moves);
                    let (c, e) = s.walk(&buf);
                    assert_eq!(
                        s.pt[c * state_space::EDGE3 + e],
                        0,
                        "sol doesn't solve block, seed={} rot={} yk={}",
                        seed,
                        ri,
                        sol.yk
                    );
                }
                // 最优长度的解必须存在
                assert!(sols.iter().any(|x| x.len == best));
            }
        }

        // State 级二次验证(独立于 mt 表):取一个具体打乱,验证解后 4 件归位
        let alg = string_to_alg("D B U B2 R2 U' L2 D2 R2 D' L D2 B D' L2 F' D L' D'");
        let (_best, sols) = s.enumerate_face(&alg, "", 0, 5);
        for sol in &sols {
            let mut st = State::SOLVED;
            // 共轭帧 = 原帧(rot="",yk 可能 >0:需把解转回原帧;yk 共轭对 State 直接用
            // rot_map 逆变换:原帧解 = rot_map[(4-yk)%4] 映射后的 moves)
            let rm = rot_map();
            let inv_k = (4 - sol.yk) % 4;
            for &m in &alg {
                st.apply(m);
            }
            for &m in &sol.moves {
                st.apply(Move::from_index(rm[inv_k][m as usize] as usize));
            }
            // 该解对应物理块 = block_label(0, yk)
            let names_to_corner: HashMap<&str, usize> = CORNER_NAMES
                .iter()
                .enumerate()
                .map(|(i, &n)| (n, i))
                .collect();
            let corner = names_to_corner[block_label(0, sol.yk)];
            let (c, edges) = block_pieces(corner);
            let (cp, co) = st.cp_co();
            assert_eq!((cp[c], co[c]), (c as u8, 0), "corner not home");
            let (ep, eo) = st.ep_eo();
            for &e in &edges {
                assert_eq!((ep[e], eo[e]), (e as u8, 0), "edge {} not home", e);
            }
        }

        let _ = std::fs::remove_dir_all(&dir);
    }
}
