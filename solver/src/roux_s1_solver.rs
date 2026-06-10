//! roux_s1_solver: Roux 第一块(1x2x3)与 FB 方块(1x2x2)求解器。
//!
//! 规范块(D 底 L 侧,即标准 Roux 左块):角 DBL(4)+DLF(7),棱 BL(0)+FL(3)+DL(11)。
//! - `RouxS1Solver`:全空间精确距离表 CORNER2(504) × EDGE3(10560) = 5,322,240
//!   (~5MB,native 现场 BFS 秒级)——查长度 O(1),枚举首达即最优。
//! - `FbSquareSolver`:FB 的两个 1x2x2 子方块,与 roux-trainers fs_back/fs_front
//!   同语义:back = DBL+BL+DL,front = DLF+FL+DL(只算侧面方块,不含 D 面)。
//!   两张微型全表 CORNER(24) × EDGE2(528) = 12,672。
//!
//! 视角结构:24 个 (rot, y^k) ↔ 24 个物理 1x2x3 块一一对应(每底色 4 个侧立块);
//! 方块每 (rot,yk) 两个目标(back/front),每底色 8 个。标签探针法导出。

use std::sync::{Arc, OnceLock};

use crate::block222_solver::{face_map, CORNER_FACE_MASK, CORNER_NAMES, ROTS6};
use crate::cube_common::{
    alg_rotation, array_to_index, rot_map, state_space, valid_moves, Move,
};
use crate::move_tables::MoveTable;

/// 规范 1x2x3 的 2 角(DBL, DLF)与 3 棱(BL, FL, DL)。
pub const CANON_CORNERS: [usize; 2] = [4, 7];
pub const CANON_EDGES: [usize; 3] = [0, 3, 11];

/// FB 两个子方块:(角, [棱; 2])。0 = back(DBL+BL+DL),1 = front(DLF+FL+DL)。
pub const SQUARES: [(usize, [usize; 2]); 2] = [(4, [0, 11]), (7, [3, 11])];

const FACE_D: u8 = 1;
const FACE_L: u8 = 2;
const FACE_CHARS: [char; 6] = ['U', 'D', 'L', 'R', 'F', 'B'];

/// 12 棱名(索引 = cube_common 棱编号)。
pub(crate) const EDGE_NAMES: [&str; 12] = [
    "BL", "BR", "FR", "FL", "UB", "UR", "UF", "UL", "DB", "DR", "DF", "DL",
];
/// 棱编号 → 面集合 bitmask(bit = 面类型,同 Move 索引/3)。
pub(crate) const EDGE_FACE_MASK: [u8; 12] = [
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

/// (rot,yk) 求的物理 1x2x3 块标签 "<底面><侧面>"(原始朝向),如 "DL" = D 底 L 侧块。
/// 底面 = D 的原像,侧面(块中心所在面)= L 的原像;24 视角标签互异。
pub fn s1_block_label(rot_idx: usize, yk: usize) -> &'static str {
    static V: OnceLock<[[String; 4]; 6]> = OnceLock::new();
    let t = V.get_or_init(|| {
        std::array::from_fn(|ri| {
            std::array::from_fn(|k| {
                let map = face_map(ROTS6[ri], k);
                let bottom = (0..6).find(|&t| map[t] == FACE_D).unwrap();
                let side = (0..6).find(|&t| map[t] == FACE_L).unwrap();
                format!("{}{}", FACE_CHARS[bottom], FACE_CHARS[side])
            })
        })
    });
    &t[rot_idx][yk]
}

/// (rot,yk,which) 方块标签 "<角名>-<所在面>",如 "DBL-L"。which: 0=back 1=front。
pub fn square_label(rot_idx: usize, yk: usize, which: usize) -> &'static str {
    static V: OnceLock<[[[String; 2]; 4]; 6]> = OnceLock::new();
    let t = V.get_or_init(|| {
        std::array::from_fn(|ri| {
            std::array::from_fn(|k| {
                let map = face_map(ROTS6[ri], k);
                std::array::from_fn(|w| {
                    let canon_mask = CORNER_FACE_MASK[SQUARES[w].0];
                    let mut mask = 0u8;
                    for t in 0..6 {
                        if canon_mask & (1 << map[t]) != 0 {
                            mask |= 1 << t;
                        }
                    }
                    let ci = CORNER_FACE_MASK.iter().position(|&m| m == mask).unwrap();
                    let face = (0..6).find(|&t| map[t] == FACE_L).unwrap();
                    format!("{}-{}", CORNER_NAMES[ci], FACE_CHARS[face])
                })
            })
        })
    });
    &t[rot_idx][yk][which]
}

/// 积坐标全空间精确距离表(idx = a*b_space + b),frontier BFS。
/// roux_s1(504×10560)/ fb 方块(24×528)/ block223 启发式表(504×528)共用。
pub(crate) fn build_pt_product(
    mt_a: &[u32],
    mt_b: &[u32],
    b_space: usize,
    total: usize,
    start: usize,
) -> Vec<u8> {
    let mut pt = vec![255u8; total];
    pt[start] = 0;
    let mut frontier: Vec<u32> = vec![start as u32];
    let mut d = 0u8;
    while !frontier.is_empty() {
        let mut next = Vec::new();
        for &i in &frontier {
            let a = i as usize / b_space;
            let b = i as usize % b_space;
            let ab = a * 18;
            let bb = b * 18;
            for m in 0..18 {
                let ni = mt_a[ab + m] as usize * b_space + mt_b[bb + m] as usize;
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

/// 共轭:alg → rot 视角 → y^k 帧的 move 索引序列(与 block222 同构)。
pub(crate) fn conj_buf(alg: &[Move], rot: &str, yk: usize) -> Vec<u8> {
    let mut buf: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
    alg_rotation(&mut buf, rot);
    let rm = &rot_map()[yk];
    for b in buf.iter_mut() {
        *b = rm[*b as usize];
    }
    buf
}

/// 精确 pt 上的解枚举(恰好 depth 步,语义同 Block222Solver::enumerate)。
#[allow(clippy::too_many_arguments)]
pub(crate) fn enumerate_product(
    mt_a: &[u32],
    mt_b: &[u32],
    b_space: usize,
    pt: &[u8],
    a: usize,
    b: usize,
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
    for k in 0..count {
        if out.len() >= cap {
            return;
        }
        let m = row[k] as usize;
        let na = mt_a[a * 18 + m] as usize;
        let nb = mt_b[b * 18 + m] as usize;
        if pt[na * b_space + nb] as u32 >= depth {
            continue;
        }
        path.push(m as u8);
        if depth == 1 {
            out.push(path.clone());
        } else {
            enumerate_product(mt_a, mt_b, b_space, pt, na, nb, depth - 1, m as u8, path, out, cap);
        }
        path.pop();
    }
}

/// 单条 1x2x3 解:yk(底色下第几个块)、长度、规范帧 move 索引路径。
pub struct S1Sol {
    pub yk: usize,
    pub len: u32,
    pub moves: Vec<u8>,
}

#[derive(Clone)]
pub struct RouxS1Solver {
    pub(crate) mt_corn2: Arc<MoveTable>,
    pub(crate) mt_edge3: Arc<MoveTable>,
    /// 全空间精确距离表,idx = c2_idx * EDGE3 + e3_idx(Arc:block223 共享)。
    pub(crate) pt: Arc<Vec<u8>>,
    pub(crate) c2_solved: usize,
    pub(crate) e3_solved: usize,
}

impl RouxS1Solver {
    /// native:走 manager(生成/加载 mt_corn2 + mt_edge3)。
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new() -> Self {
        let mtm = crate::move_tables::instance();
        Self::from_tables(mtm.ensure_corn2(), mtm.ensure_edge3())
    }

    /// 直接用预建表构造(WASM:JS fetch 表字节 from_bin 后喂入)。
    /// 距离表现场 BFS(5,322,240 态,native 秒级 / wasm 数秒)。
    pub fn from_tables(mt_corn2: Arc<MoveTable>, mt_edge3: Arc<MoveTable>) -> Self {
        let corners: Vec<i32> = CANON_CORNERS.iter().map(|&c| (3 * c) as i32).collect();
        let c2_solved = array_to_index(&corners, 2, 3, 8) as usize;
        let edges: Vec<i32> = CANON_EDGES.iter().map(|&e| (2 * e) as i32).collect();
        let e3_solved = array_to_index(&edges, 3, 2, 12) as usize;
        let start = c2_solved * state_space::EDGE3 + e3_solved;
        let pt = Arc::new(build_pt_product(
            mt_corn2.as_u32(),
            mt_edge3.as_u32(),
            state_space::EDGE3,
            state_space::CORNER2 * state_space::EDGE3,
            start,
        ));
        RouxS1Solver { mt_corn2, mt_edge3, pt, c2_solved, e3_solved }
    }

    /// 距离表最大深度(1x2x3 的 God's number,信息用)。
    pub fn max_depth(&self) -> u8 {
        self.pt.iter().copied().filter(|&v| v != 255).max().unwrap_or(0)
    }

    /// 从 SOLVED 走 buf,返回 (c2_idx, e3_idx)。
    pub(crate) fn walk(&self, buf: &[u8]) -> (usize, usize) {
        let mt_c2 = self.mt_corn2.as_u32();
        let mt_e3 = self.mt_edge3.as_u32();
        let mut c = self.c2_solved;
        let mut e = self.e3_solved;
        for &m in buf {
            c = mt_c2[c * 18 + m as usize] as usize;
            e = mt_e3[e * 18 + m as usize] as usize;
        }
        (c, e)
    }

    /// 单 (视角, yk) 最优步数(精确表直查,无搜索)。
    pub fn solve_one(&self, alg: &[Move], rot: &str, yk: usize) -> u32 {
        let (c, e) = self.walk(&conj_buf(alg, rot, yk));
        self.pt[c * state_space::EDGE3 + e] as u32
    }

    /// 多视角批量统计:每视角 = 4 个侧立块最小,顺序与 `rots` 一致。
    pub fn get_stats(&self, alg: &[Move], rots: &[&str]) -> Vec<u32> {
        rots.iter()
            .map(|r| (0..4).map(|k| self.solve_one(alg, r, k)).min().unwrap())
            .collect()
    }

    /// 单视角多解:4 个 yk 各枚举(预算 = 全局最优 + extra),合并按 (len, yk) 排序,
    /// cap 截断。全局最优 = 0 时解集为空(已有块成型)。
    pub fn enumerate_face(
        &self,
        alg: &[Move],
        rot: &str,
        extra: u32,
        cap: usize,
    ) -> (u32, Vec<S1Sol>) {
        let mut ends = [(0usize, 0usize); 4];
        let mut dists = [0u32; 4];
        for k in 0..4 {
            let (c, e) = self.walk(&conj_buf(alg, rot, k));
            ends[k] = (c, e);
            dists[k] = self.pt[c * state_space::EDGE3 + e] as u32;
        }
        let best = dists.iter().copied().min().unwrap();
        let mut sols: Vec<S1Sol> = Vec::new();
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
                enumerate_product(
                    self.mt_corn2.as_u32(),
                    self.mt_edge3.as_u32(),
                    state_space::EDGE3,
                    &self.pt,
                    c,
                    e,
                    d,
                    18,
                    &mut path,
                    &mut out,
                    cap,
                );
                if out.len() >= cap {
                    break;
                }
            }
            sols.extend(out.into_iter().map(|moves| S1Sol {
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

/// 单条方块解:yk、which(0=back 1=front)、长度、规范帧 move 索引路径。
pub struct SquareSol {
    pub yk: usize,
    pub which: usize,
    pub len: u32,
    pub moves: Vec<u8>,
}

pub struct FbSquareSolver {
    mt_corn: Arc<MoveTable>,
    mt_edge2: Arc<MoveTable>,
    /// 两张全空间精确距离表(back/front),idx = corner_idx * EDGE2 + e2_idx。
    pt: [Vec<u8>; 2],
    solved: [(usize, usize); 2],
}

impl FbSquareSolver {
    /// native:走 manager(mt_corn + mt_edge2)。
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new() -> Self {
        let mtm = crate::move_tables::instance();
        Self::from_tables(mtm.ensure_corn(), mtm.ensure_edge2())
    }

    /// 直接用预建表构造;两张距离表现场 BFS(各 12,672 态,毫秒级)。
    pub fn from_tables(mt_corn: Arc<MoveTable>, mt_edge2: Arc<MoveTable>) -> Self {
        let mut pt: [Vec<u8>; 2] = [Vec::new(), Vec::new()];
        let mut solved = [(0usize, 0usize); 2];
        for (w, &(corner, edges)) in SQUARES.iter().enumerate() {
            let c_solved = array_to_index(&[(3 * corner) as i32], 1, 3, 8) as usize;
            let ev: Vec<i32> = edges.iter().map(|&e| (2 * e) as i32).collect();
            let e_solved = array_to_index(&ev, 2, 2, 12) as usize;
            solved[w] = (c_solved, e_solved);
            pt[w] = build_pt_product(
                mt_corn.as_u32(),
                mt_edge2.as_u32(),
                state_space::EDGE2,
                state_space::CORNER * state_space::EDGE2,
                c_solved * state_space::EDGE2 + e_solved,
            );
        }
        FbSquareSolver { mt_corn, mt_edge2, pt, solved }
    }

    /// 两表最大深度的较大值(方块 God's number,信息用)。
    pub fn max_depth(&self) -> u8 {
        self.pt
            .iter()
            .flat_map(|p| p.iter().copied())
            .filter(|&v| v != 255)
            .max()
            .unwrap_or(0)
    }

    fn walk(&self, buf: &[u8], which: usize) -> (usize, usize) {
        let mt_c = self.mt_corn.as_u32();
        let mt_e2 = self.mt_edge2.as_u32();
        let (mut c, mut e) = self.solved[which];
        for &m in buf {
            c = mt_c[c * 18 + m as usize] as usize;
            e = mt_e2[e * 18 + m as usize] as usize;
        }
        (c, e)
    }

    /// 单 (视角, yk, which) 最优步数(精确表直查)。
    pub fn solve_one(&self, alg: &[Move], rot: &str, yk: usize, which: usize) -> u32 {
        let (c, e) = self.walk(&conj_buf(alg, rot, yk), which);
        self.pt[which][c * state_space::EDGE2 + e] as u32
    }

    /// 多视角批量统计:每视角 = 4 yk × 2 方块共 8 个目标的最小。
    pub fn get_stats(&self, alg: &[Move], rots: &[&str]) -> Vec<u32> {
        rots.iter()
            .map(|r| {
                (0..4)
                    .flat_map(|k| (0..2).map(move |w| (k, w)))
                    .map(|(k, w)| self.solve_one(alg, r, k, w))
                    .min()
                    .unwrap()
            })
            .collect()
    }

    /// 单视角多解:8 个 (yk, which) 各枚举,合并按 (len, yk, which) 排序,cap 截断。
    pub fn enumerate_face(
        &self,
        alg: &[Move],
        rot: &str,
        extra: u32,
        cap: usize,
    ) -> (u32, Vec<SquareSol>) {
        let mut ends = [[(0usize, 0usize); 2]; 4];
        let mut dists = [[0u32; 2]; 4];
        for k in 0..4 {
            let buf = conj_buf(alg, rot, k);
            for w in 0..2 {
                let (c, e) = self.walk(&buf, w);
                ends[k][w] = (c, e);
                dists[k][w] = self.pt[w][c * state_space::EDGE2 + e] as u32;
            }
        }
        let best = dists.iter().flatten().copied().min().unwrap();
        let mut sols: Vec<SquareSol> = Vec::new();
        if best == 0 {
            return (0, sols);
        }
        let budget = best + extra;
        for k in 0..4 {
            for w in 0..2 {
                if dists[k][w] > budget {
                    continue;
                }
                let (c, e) = ends[k][w];
                let mut out = Vec::new();
                let mut path = Vec::new();
                for d in dists[k][w]..=budget {
                    enumerate_product(
                        self.mt_corn.as_u32(),
                        self.mt_edge2.as_u32(),
                        state_space::EDGE2,
                        &self.pt[w],
                        c,
                        e,
                        d,
                        18,
                        &mut path,
                        &mut out,
                        cap,
                    );
                    if out.len() >= cap {
                        break;
                    }
                }
                sols.extend(out.into_iter().map(|moves| SquareSol {
                    yk: k,
                    which: w,
                    len: moves.len() as u32,
                    moves,
                }));
            }
        }
        sols.sort_by_key(|s| (s.len, s.yk, s.which));
        sols.truncate(cap);
        (best, sols)
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::cube_common::{move_state, string_to_alg, test_env_lock, State};
    use std::collections::HashMap;
    use std::path::PathBuf;

    fn setup_dir(name: &str) -> PathBuf {
        let dir = PathBuf::from("target").join("test-tables").join(name);
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::env::set_var("CUBE_TABLE_DIR", &dir);
        dir
    }

    // ---------- 独立单件运动学(绕开 mt 表与 Lehmer 编码) ----------

    /// 角单件转移表 trans[state=3p+o][m],由 MOVE_STATES 扫描导出。
    pub(crate) fn corner_trans() -> [[u8; 18]; 24] {
        let mut t = [[0u8; 18]; 24];
        for p in 0..8u8 {
            for o in 0..3u8 {
                for m in Move::ALL {
                    let ms = move_state(m);
                    let (mcp, mco) = ms.cp_co();
                    for i in 0..8 {
                        if mcp[i] == p {
                            t[(3 * p + o) as usize][m.index()] = 3 * i as u8 + (o + mco[i]) % 3;
                        }
                    }
                }
            }
        }
        t
    }

    pub(crate) fn edge_trans() -> [[u8; 18]; 24] {
        let mut t = [[0u8; 18]; 24];
        for p in 0..12u8 {
            for o in 0..2u8 {
                for m in Move::ALL {
                    let ms = move_state(m);
                    let (mep, meo) = ms.ep_eo();
                    for i in 0..12 {
                        if mep[i] == p {
                            t[(2 * p + o) as usize][m.index()] = 2 * i as u8 + (o + meo[i]) % 2;
                        }
                    }
                }
            }
        }
        t
    }

    /// 标签 "<底><侧>" → 块件集合(2 角 + 3 棱)。
    pub(crate) fn s1_block_pieces(label: &str) -> ([usize; 2], [usize; 3]) {
        let face_of = |ch: u8| FACE_CHARS.iter().position(|&c| c as u8 == ch).unwrap() as u8;
        let bottom = face_of(label.as_bytes()[0]);
        let side = face_of(label.as_bytes()[1]);
        let excl = (1u8 << (bottom ^ 1)) | (1 << (side ^ 1));
        let mut corners = [0usize; 2];
        let mut cn = 0;
        for (c, &m) in CORNER_FACE_MASK.iter().enumerate() {
            if m & (1 << bottom) != 0 && m & (1 << side) != 0 {
                corners[cn] = c;
                cn += 1;
            }
        }
        assert_eq!(cn, 2);
        let mut edges = [0usize; 3];
        let mut en = 0;
        for (e, &m) in EDGE_FACE_MASK.iter().enumerate() {
            if m & (1 << side) != 0 && m & excl == 0 {
                edges[en] = e;
                en += 1;
            }
        }
        assert_eq!(en, 3);
        (corners, edges)
    }

    /// 暴力距离表:radix-24 key = ((((c0*24+c1)*24+e0)*24+e1)*24+e2,Vec<u8> 全 24^5。
    fn brute_s1_table(corners: [usize; 2], edges: [usize; 3], ct: &[[u8; 18]; 24], et: &[[u8; 18]; 24]) -> Vec<u8> {
        let key = |st: &[u8; 5]| -> usize {
            st.iter().fold(0usize, |k, &s| k * 24 + s as usize)
        };
        let start = [
            (3 * corners[0]) as u8,
            (3 * corners[1]) as u8,
            (2 * edges[0]) as u8,
            (2 * edges[1]) as u8,
            (2 * edges[2]) as u8,
        ];
        let mut dist = vec![255u8; 24usize.pow(5)];
        dist[key(&start)] = 0;
        let mut frontier = vec![start];
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for st in &frontier {
                for m in 0..18 {
                    let ns = [
                        ct[st[0] as usize][m],
                        ct[st[1] as usize][m],
                        et[st[2] as usize][m],
                        et[st[3] as usize][m],
                        et[st[4] as usize][m],
                    ];
                    let k = key(&ns);
                    if dist[k] == 255 {
                        dist[k] = d + 1;
                        next.push(ns);
                    }
                }
            }
            d += 1;
            frontier = next;
        }
        dist
    }

    fn brute_s1_dist(
        table: &[u8],
        corners: [usize; 2],
        edges: [usize; 3],
        ct: &[[u8; 18]; 24],
        et: &[[u8; 18]; 24],
        alg: &[Move],
    ) -> u8 {
        let mut st = [
            (3 * corners[0]) as u8,
            (3 * corners[1]) as u8,
            (2 * edges[0]) as u8,
            (2 * edges[1]) as u8,
            (2 * edges[2]) as u8,
        ];
        for &m in alg {
            st = [
                ct[st[0] as usize][m.index()],
                ct[st[1] as usize][m.index()],
                et[st[2] as usize][m.index()],
                et[st[3] as usize][m.index()],
                et[st[4] as usize][m.index()],
            ];
        }
        table[st.iter().fold(0usize, |k, &s| k * 24 + s as usize)]
    }

    /// 确定性伪随机打乱(LCG,免外部依赖)。
    pub(crate) fn pseudo_scramble(seed: u64, len: usize) -> Vec<Move> {
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
    fn s1_pt_basics_and_single_moves() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = setup_dir("roux_s1_basics");
        let s = RouxS1Solver::new();

        assert!(s.pt.iter().all(|&v| v != 255), "unreachable states found");
        let md = s.max_depth();
        assert!((8..=13).contains(&md), "suspicious max depth {}", md);

        let z0 = |scr: &str| s.get_stats(&string_to_alg(scr), &[""])[0];
        // U 不碰任何 D 底侧立块 → 0;D 整层位移 4 块 → 1
        assert_eq!(z0("U"), 0);
        assert_eq!(z0("D"), 1);
        assert_eq!(z0(""), 0);
        assert_eq!(s.solve_one(&string_to_alg("D"), "", 0), 1);
        assert_eq!(s.solve_one(&string_to_alg("U"), "", 0), 0);
        // 规范块 = D 底 L 侧:R 不碰 → 0;L 破坏 → 1
        assert_eq!(s.solve_one(&string_to_alg("R"), "", 0), 0);
        assert_eq!(s.solve_one(&string_to_alg("L"), "", 0), 1);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn s1_label_structure() {
        // 24 个 (rot,yk) 标签互异;rot0 全 D 底;规范 (0,0) = DL。
        let mut seen = std::collections::HashSet::new();
        for ri in 0..6 {
            for k in 0..4 {
                let l = s1_block_label(ri, k);
                assert!(seen.insert(l), "dup label {}", l);
            }
        }
        assert_eq!(seen.len(), 24);
        for k in 0..4 {
            assert!(s1_block_label(0, k).starts_with('D'));
        }
        assert_eq!(s1_block_label(0, 0), "DL");
    }

    #[test]
    fn s1_brute_force_cross_check_all_24_views() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = setup_dir("roux_s1_brute");
        let s = RouxS1Solver::new();

        let ct = corner_trans();
        let et = edge_trans();
        // 24 个块各一张暴力表(radix-24^5 Vec,~8MB/张)
        let mut tables: HashMap<&'static str, ([usize; 2], [usize; 3], Vec<u8>)> = HashMap::new();
        for ri in 0..6 {
            for k in 0..4 {
                let label = s1_block_label(ri, k);
                let (corners, edges) = s1_block_pieces(label);
                let t = brute_s1_table(corners, edges, &ct, &et);
                assert_eq!(
                    t.iter().filter(|&&v| v != 255).count(),
                    state_space::CORNER2 * state_space::EDGE3,
                    "brute table size mismatch for {}",
                    label
                );
                tables.insert(label, (corners, edges, t));
            }
        }

        for seed in 0..40u64 {
            let alg = pseudo_scramble(seed, 20);
            for (ri, rot) in ROTS6.iter().enumerate() {
                for k in 0..4 {
                    let got = s.solve_one(&alg, rot, k);
                    let label = s1_block_label(ri, k);
                    let (corners, edges, table) = &tables[label];
                    let want = brute_s1_dist(table, *corners, *edges, &ct, &et, &alg) as u32;
                    assert_eq!(got, want, "seed={} rot={:?} yk={} label={}", seed, rot, k, label);
                }
            }
        }

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn s1_enumerate_face_solutions_are_valid() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = setup_dir("roux_s1_enum");
        let s = RouxS1Solver::new();

        for seed in 100..112u64 {
            let alg = pseudo_scramble(seed, 20);
            for (ri, rot) in ROTS6.iter().enumerate() {
                let stats_min = s.get_stats(&alg, &[rot])[0];
                let (best, sols) = s.enumerate_face(&alg, rot, 1, 30);
                assert_eq!(best, stats_min, "best mismatch seed={} rot={}", seed, ri);
                if best == 0 {
                    assert!(sols.is_empty());
                    continue;
                }
                assert!(!sols.is_empty());
                assert!(sols.iter().any(|x| x.len == best));
                for sol in &sols {
                    assert!(sol.len >= best && sol.len <= best + 1);
                    assert_eq!(sol.len as usize, sol.moves.len());
                    let mut buf = conj_buf(&alg, rot, sol.yk);
                    buf.extend_from_slice(&sol.moves);
                    let (c, e) = s.walk(&buf);
                    assert_eq!(s.pt[c * state_space::EDGE3 + e], 0, "sol doesn't solve block");
                }
            }
        }

        // State 级二次验证:rot="" 时把解经 y^k 逆映射回原帧,验证 5 件物理归位
        let alg = string_to_alg("D B U B2 R2 U' L2 D2 R2 D' L D2 B D' L2 F' D L' D'");
        let (_best, sols) = s.enumerate_face(&alg, "", 0, 5);
        let rm = rot_map();
        for sol in &sols {
            let mut st = State::SOLVED;
            let inv_k = (4 - sol.yk) % 4;
            for &m in &alg {
                st.apply(m);
            }
            for &m in &sol.moves {
                st.apply(Move::from_index(rm[inv_k][m as usize] as usize));
            }
            let (corners, edges) = s1_block_pieces(s1_block_label(0, sol.yk));
            let (cp, co) = st.cp_co();
            for &c in &corners {
                assert_eq!((cp[c], co[c]), (c as u8, 0), "corner {} not home", c);
            }
            let (ep, eo) = st.ep_eo();
            for &e in &edges {
                assert_eq!((ep[e], eo[e]), (e as u8, 0), "edge {} not home", e);
            }
        }

        let _ = std::fs::remove_dir_all(&dir);
    }

    // ---------- FB 方块 ----------

    /// 标签 "<角名>-<面>" → (角, [棱;2])。
    fn square_pieces(label: &str) -> (usize, [usize; 2]) {
        let (cname, fch) = label.split_once('-').unwrap();
        let corner = CORNER_NAMES.iter().position(|&n| n == cname).unwrap();
        let face = FACE_CHARS.iter().position(|&c| c.to_string() == fch).unwrap() as u8;
        let cm = CORNER_FACE_MASK[corner];
        let mut edges = [0usize; 2];
        let mut n = 0;
        for (e, &m) in EDGE_FACE_MASK.iter().enumerate() {
            if m & (1 << face) != 0 && m & cm == m {
                edges[n] = e;
                n += 1;
            }
        }
        assert_eq!(n, 2, "square {} edge count", label);
        (corner, edges)
    }

    fn brute_square_table(corner: usize, edges: [usize; 2], ct: &[[u8; 18]; 24], et: &[[u8; 18]; 24]) -> Vec<u8> {
        let start = [(3 * corner) as u8, (2 * edges[0]) as u8, (2 * edges[1]) as u8];
        let key = |st: &[u8; 3]| st.iter().fold(0usize, |k, &s| k * 24 + s as usize);
        let mut dist = vec![255u8; 24usize.pow(3)];
        dist[key(&start)] = 0;
        let mut frontier = vec![start];
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for st in &frontier {
                for m in 0..18 {
                    let ns = [ct[st[0] as usize][m], et[st[1] as usize][m], et[st[2] as usize][m]];
                    let k = key(&ns);
                    if dist[k] == 255 {
                        dist[k] = d + 1;
                        next.push(ns);
                    }
                }
            }
            d += 1;
            frontier = next;
        }
        dist
    }

    #[test]
    fn square_basics_labels_and_brute() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = setup_dir("fb_square");
        let s = FbSquareSolver::new();

        for w in 0..2 {
            assert!(s.pt[w].iter().all(|&v| v != 255), "unreachable square states");
        }
        let md = s.max_depth();
        assert!((5..=9).contains(&md), "suspicious square max depth {}", md);

        // 标签:48 个 (rot,yk,which) 覆盖 24 个方块,每个出现恰 2 次;规范对
        let mut count: HashMap<&str, u32> = HashMap::new();
        for ri in 0..6 {
            for k in 0..4 {
                for w in 0..2 {
                    *count.entry(square_label(ri, k, w)).or_insert(0) += 1;
                }
            }
        }
        assert_eq!(count.len(), 24);
        assert!(count.values().all(|&c| c == 2));
        assert_eq!(square_label(0, 0, 0), "DBL-L");
        assert_eq!(square_label(0, 0, 1), "DLF-L");

        // 单 move:U 不碰 D 底 8 方块 → 0;D 全破 → 1
        let z0 = |scr: &str| s.get_stats(&string_to_alg(scr), &[""])[0];
        assert_eq!(z0("U"), 0);
        assert_eq!(z0("D"), 1);

        // 暴力对照:24 方块全表(13,824 态/张)
        let ct = corner_trans();
        let et = edge_trans();
        let mut tables: HashMap<&'static str, (usize, [usize; 2], Vec<u8>)> = HashMap::new();
        for ri in 0..6 {
            for k in 0..4 {
                for w in 0..2 {
                    let label = square_label(ri, k, w);
                    if tables.contains_key(label) {
                        continue;
                    }
                    let (corner, edges) = square_pieces(label);
                    let t = brute_square_table(corner, edges, &ct, &et);
                    assert_eq!(
                        t.iter().filter(|&&v| v != 255).count(),
                        state_space::CORNER * state_space::EDGE2
                    );
                    tables.insert(label, (corner, edges, t));
                }
            }
        }
        for seed in 0..60u64 {
            let alg = pseudo_scramble(seed, 20);
            for (ri, rot) in ROTS6.iter().enumerate() {
                for k in 0..4 {
                    for w in 0..2 {
                        let got = s.solve_one(&alg, rot, k, w);
                        let label = square_label(ri, k, w);
                        let (corner, edges, table) = &tables[label];
                        let mut st = [(3 * corner) as u8, (2 * edges[0]) as u8, (2 * edges[1]) as u8];
                        for &m in &alg {
                            st = [
                                ct[st[0] as usize][m.index()],
                                et[st[1] as usize][m.index()],
                                et[st[2] as usize][m.index()],
                            ];
                        }
                        let want = table[st.iter().fold(0usize, |kk, &v| kk * 24 + v as usize)] as u32;
                        assert_eq!(got, want, "seed={} rot={} yk={} w={}", seed, ri, k, w);
                    }
                }
            }
        }

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn square_enumerate_face_solutions_are_valid() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = setup_dir("fb_square_enum");
        let s = FbSquareSolver::new();

        for seed in 200..215u64 {
            let alg = pseudo_scramble(seed, 20);
            for (ri, rot) in ROTS6.iter().enumerate() {
                let stats_min = s.get_stats(&alg, &[rot])[0];
                let (best, sols) = s.enumerate_face(&alg, rot, 1, 30);
                assert_eq!(best, stats_min, "best mismatch seed={} rot={}", seed, ri);
                if best == 0 {
                    assert!(sols.is_empty());
                    continue;
                }
                assert!(!sols.is_empty());
                assert!(sols.iter().any(|x| x.len == best));
                for sol in &sols {
                    assert!(sol.len >= best && sol.len <= best + 1);
                    let mut buf = conj_buf(&alg, rot, sol.yk);
                    buf.extend_from_slice(&sol.moves);
                    let (c, e) = s.walk(&buf, sol.which);
                    assert_eq!(s.pt[sol.which][c * state_space::EDGE2 + e], 0);
                }
            }
        }

        let _ = std::fs::remove_dir_all(&dir);
    }
}
