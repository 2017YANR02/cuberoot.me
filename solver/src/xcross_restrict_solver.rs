//! XCross restricted optimal solver — 任意受限 54-move 集下的最优 xcross(cross + 1 个 F2L pair)
//! 求解器(含中心朝向)。
//!
//! **物理保真的 54-move 集**(与 `cross_restrict_solver` 的抽象 or18 帧不同):本模块全部
//! 从 `cube_common::State`(真魔方角/棱编号 + compose 语义)出发,自建一套几何精确、互相相容
//! 的 54 个整体算子,任何解都能直接套到真魔方上:
//!   - 面动 0..18:`cube_common::MOVE_STATES`(物理面动)。
//!   - 整体旋转 x/y/z(45/48/51):由「共轭所有 18 面动到 conj(面动)」唯一确定(cubie 重标 +
//!     朝向定解,见 base 常量),order-4、相容,2/' 变体复合得到。
//!   - wide 18..36:= 对应轴旋转**限制在该 wide 的活动 cubie**(face 层 + 平行中层),其余恒等。
//!   - slice 36..45:= 对应轴旋转**限制在该 slice 的 4 条棱**,角恒等。
//!   - 中心:6 面索引 [U,D,L,R,F,B] 自有约定,solved = [0..6];每 move 的中心置换 = 其旋转分量的
//!     面置换(面动中心恒等)。
//!
//! 复用 `cross_restrict_solver` 仅限**坐标编解码** `encode_coord`/`decode_coord`(纯 Lehmer,
//! 约定无关)与 `ROTS_FACE` / `MOVE_NAMES_54` / `conjugate_scramble`(面动逐 move 共轭,与
//! analyzer `alg_rotation` 同表)。所有转移表都由本模块的物理 State 算子重建,**不**复用其抽象
//! cross-coord / center 转移。
//!
//! 槽位 ↔ 件映射(探针验证,与现有 `XCrossSolver` 语义一致):slot k(0..4)= 角块 (4+k) + 棱块 k;
//! cross 棱 = 8,9,10,11(D 层)。6 视角 = 6 面(`ROTS_FACE`),每视角值 = 该面下 4 槽 xcross 最小值。
//!
//! 一次 solve:打乱按 `ROTS_FACE[face]` 逐 move 共轭,从 SOLVED 应用得起点,在 `allowed` 受限
//! 54-move 集上 IDA*(旋转受 max_rot_count 限),目标 = cross 复原 + 槽角/槽棱归位 + center ∈
//! center_offset(=[0])。h = max(PDB_cross, PDB_pair),双可采纳下界 → max 可采纳。

#![allow(dead_code)]

use crate::cross_restrict_solver::{
    decode_coord, encode_coord, solved_coord, CrossRestrictSolver, CROSS_COORD, MOVE_NAMES_54,
    NCENTER, ROTS_FACE,
};
use crate::cube_common::{State, MOVE_STATES};

/// 角块状态空间:8 位置 × 3 朝向 = 24(只追踪「该视角槽位的那一个角」)。
pub const CORNER_STATES: usize = 24;
/// 棱块状态空间(单棱):12 位置 × 2 朝向 = 24(追踪槽棱)。
pub const EDGE_STATES: usize = 24;
/// 4 个十字棱件 id(D 层)。
pub const CROSS_PIECES: [usize; 4] = [8, 9, 10, 11];

// ---------- 物理整体旋转 base(x/y/z),由 cubie 重标 + 共轭定解一次性求出后固化 ----------
//
// 这三个常量是「整体旋转作为完整 cube State 算子」的角/棱 (perm+ori),满足对全部 18 面动
// g 有 R·g·R⁻¹ = conj(g)(face_perm:x=[5,4,2,3,0,1] y=[0,1,5,4,2,3] z=[3,2,0,1,4,5]),
// 且 order-4、parity 符合真旋转(角两 4-cycle 偶、棱三 4-cycle 奇)。运行时 assert 复核(见 new)。
const ROT_X: ([u8; 8], [u8; 12]) = (
    [14, 16, 5, 1, 22, 20, 7, 11],
    [23, 19, 11, 15, 16, 3, 8, 1, 20, 5, 12, 7],
);
const ROT_Y: ([u8; 8], [u8; 12]) = (
    [3, 6, 9, 0, 15, 18, 21, 12],
    [3, 5, 7, 1, 10, 12, 14, 8, 18, 20, 22, 16],
);
const ROT_Z: ([u8; 8], [u8; 12]) = (
    [4, 17, 19, 8, 2, 13, 23, 10],
    [8, 16, 20, 12, 2, 18, 4, 10, 0, 22, 6, 14],
);

/// 旋转的面置换(中心怎么搬):x/y/z。
const ROT_FACE_PERM: [[u8; 6]; 3] = [
    [5, 4, 2, 3, 0, 1], // x
    [0, 1, 5, 4, 2, 3], // y
    [3, 2, 0, 1, 4, 5], // z
];

/// 每个 face(0=U..5=B)的 4 角 + 4 棱(home 槽位)。由 cube_common 几何(探针)得到。
const FACE_CORNERS: [[usize; 4]; 6] = [
    [0, 1, 2, 3], // U
    [4, 5, 6, 7], // D
    [0, 3, 4, 7], // L
    [1, 2, 5, 6], // R
    [2, 3, 6, 7], // F
    [0, 1, 4, 5], // B
];
const FACE_EDGES: [[usize; 4]; 6] = [
    [4, 5, 6, 7],   // U
    [8, 9, 10, 11], // D
    [0, 3, 7, 11],  // L
    [1, 2, 5, 9],   // R
    [2, 3, 6, 10],  // F
    [0, 1, 4, 8],   // B
];
/// 三个中层 slice 的 4 条棱:M(L-R 之间)、E(U-D)、S(F-B)。
const SLICE_M_EDGES: [usize; 4] = [4, 6, 8, 10];
const SLICE_E_EDGES: [usize; 4] = [0, 1, 2, 3];
const SLICE_S_EDGES: [usize; 4] = [5, 7, 9, 11];

// ---------- 物理 54-move 全 cube State 算子构建 ----------

/// 把一个旋转「限制」到 moving cubie(face 层 + 平行中层 / 中层棱),其余恒等。
/// rot 把这些 cubie 在自身集合内置换(旋转保持各层 setwise),故直接拷 rot 的值即得合法 partial。
fn partial(rot: &State, mc: &[usize], me: &[usize]) -> State {
    let mut s = State::SOLVED;
    for &i in mc {
        s.corners[i] = rot.corners[i];
    }
    for &i in me {
        s.edges[i] = rot.edges[i];
    }
    s
}

#[inline]
fn st(c: [u8; 8], e: [u8; 12]) -> State {
    State {
        corners: c,
        edges: e,
    }
}

/// 构建全 54 个物理 cube State 算子 + 每个 move 的中心(6 面)置换。
/// 返回 (ops[54], center_perm[54])。center_perm[m][i] = 中心向量在 m 下:new_center[i]=center[perm[i]]。
fn build_phys_moves() -> ([State; 54], [[u8; 6]; 54]) {
    // 旋转 base 与逆 / 幂。
    let x = st(ROT_X.0, ROT_X.1);
    let y = st(ROT_Y.0, ROT_Y.1);
    let z = st(ROT_Z.0, ROT_Z.1);
    let comp = |a: &State, b: &State| a.compose(b);
    let pow = |b: &State, n: u32| {
        let mut s = State::SOLVED;
        for _ in 0..n {
            s = s.compose(b);
        }
        s
    };
    let xi = x.inverse();
    let yi = y.inverse();
    let zi = z.inverse();

    let mut ops = [State::SOLVED; 54];

    // 0..18 面动。
    for m in 0..18 {
        ops[m] = MOVE_STATES[m];
    }

    // 18..36 wide:每档 (轴旋转 base, 该 wide 的活动角/棱)。base 为该 wide「1 次」的旋转,
    // 2/' 变体 = base 自复合(在活动集合内)。活动集 = face 层角棱 + 平行 slice 棱。
    // 顺序与 MOVE_NAMES_54:u(18) d(21) l(24) r(27) f(30) b(33),每个 1/2/'。
    // u→y(U 面顺时针=y),d→y',l→x',r→x,f→z,b→z'(方向由「该 wide 与对应整体旋转同手性」定)。
    let wide_defs: [(State, usize); 6] = [
        (y.clone_state(), 0),  // u  → face U(0)
        (yi.clone_state(), 1), // d  → face D(1)
        (xi.clone_state(), 2), // l  → face L(2)
        (x.clone_state(), 3),  // r  → face R(3)
        (z.clone_state(), 4),  // f  → face F(4)
        (zi.clone_state(), 5), // b  → face B(5)
    ];
    for (w, (rot, face)) in wide_defs.iter().enumerate() {
        let mut me: Vec<usize> = FACE_EDGES[*face].to_vec();
        // 平行 slice 棱:U/D 用 E,L/R 用 M,F/B 用 S。
        let slice = match *face {
            0 | 1 => SLICE_E_EDGES,
            2 | 3 => SLICE_M_EDGES,
            _ => SLICE_S_EDGES,
        };
        me.extend_from_slice(&slice);
        let mc = FACE_CORNERS[*face];
        let base = partial(rot, &mc, &me);
        let b2 = comp(&base, &base);
        let b3 = comp(&b2, &base);
        ops[18 + w * 3] = base;
        ops[18 + w * 3 + 1] = b2;
        ops[18 + w * 3 + 2] = b3;
    }

    // 36..45 slice M/E/S(各 1/2/')。base = 对应轴旋转限制到 4 条 slice 棱。
    // M→x'(同 L 向),E→y'(同 D 向),S→z(同 F 向)。
    let slice_defs: [(State, [usize; 4]); 3] = [
        (xi.clone_state(), SLICE_M_EDGES),
        (yi.clone_state(), SLICE_E_EDGES),
        (z.clone_state(), SLICE_S_EDGES),
    ];
    for (s, (rot, edges)) in slice_defs.iter().enumerate() {
        let base = partial(rot, &[], edges);
        let b2 = comp(&base, &base);
        let b3 = comp(&b2, &base);
        ops[36 + s * 3] = base;
        ops[36 + s * 3 + 1] = b2;
        ops[36 + s * 3 + 2] = b3;
    }

    // 45..54 rotation x/y/z(各 1/2/')。
    let rots = [&x, &y, &z];
    for (r, rot) in rots.iter().enumerate() {
        ops[45 + r * 3] = (*rot).clone_state();
        ops[45 + r * 3 + 1] = pow(rot, 2);
        ops[45 + r * 3 + 2] = pow(rot, 3);
    }

    // ---------- 中心(6 面)置换 ----------
    // 每个 move 的中心置换 = 其旋转分量的面置换(面动中心恒等)。
    let id6: [u8; 6] = [0, 1, 2, 3, 4, 5];
    let mut center_perm = [[0u8; 6]; 54];
    // 把面置换复合 n 次。
    let compose_face = |a: &[u8; 6], b: &[u8; 6]| -> [u8; 6] {
        let mut o = [0u8; 6];
        for i in 0..6 {
            o[i] = a[b[i] as usize];
        }
        o
    };
    let powf = |b: &[u8; 6], n: u32| -> [u8; 6] {
        let mut o = id6;
        for _ in 0..n {
            o = compose_face(&o, b);
        }
        o
    };
    // 面动:恒等。
    for m in 0..18 {
        center_perm[m] = id6;
    }
    // wide/slice/rotation 用各自旋转分量的面置换(注意方向 ' = 逆 = base^3)。
    // 旋转 base 面置换:x=ROT_FACE_PERM[0], y=[1], z=[2];逆 = base^3。
    let fp_x = ROT_FACE_PERM[0];
    let fp_y = ROT_FACE_PERM[1];
    let fp_z = ROT_FACE_PERM[2];
    let fp_xi = powf(&fp_x, 3);
    let fp_yi = powf(&fp_y, 3);
    let fp_zi = powf(&fp_z, 3);
    // wide 中心方向与 wide_defs 同:u→y, d→y', l→x', r→x, f→z, b→z'。
    let wide_fp = [&fp_y, &fp_yi, &fp_xi, &fp_x, &fp_z, &fp_zi];
    for (w, base) in wide_fp.iter().enumerate() {
        center_perm[18 + w * 3] = **base;
        center_perm[18 + w * 3 + 1] = powf(base, 2);
        center_perm[18 + w * 3 + 2] = powf(base, 3);
    }
    // slice:M→x', E→y', S→z。
    let slice_fp = [&fp_xi, &fp_yi, &fp_z];
    for (s, base) in slice_fp.iter().enumerate() {
        center_perm[36 + s * 3] = **base;
        center_perm[36 + s * 3 + 1] = powf(base, 2);
        center_perm[36 + s * 3 + 2] = powf(base, 3);
    }
    // rotation:x,y,z。
    let rot_fp = [&fp_x, &fp_y, &fp_z];
    for (r, base) in rot_fp.iter().enumerate() {
        center_perm[45 + r * 3] = **base;
        center_perm[45 + r * 3 + 1] = powf(base, 2);
        center_perm[45 + r * 3 + 2] = powf(base, 3);
    }

    (ops, center_perm)
}

/// State 浅拷贝(Copy 已具备,这里命名以表意)。
trait CloneState {
    fn clone_state(&self) -> State;
}
impl CloneState for State {
    #[inline]
    fn clone_state(&self) -> State {
        *self
    }
}

// ---------- pair / 单棱 / 单角 编码 ----------

#[inline]
fn corner_code(pos: usize, ori: u8) -> u8 {
    (pos * 3 + ori as usize) as u8
}
#[inline]
fn corner_decode(code: u8) -> (usize, u8) {
    ((code / 3) as usize, code % 3)
}
#[inline]
fn edge_code(pos: usize, ori: u8) -> u8 {
    (pos * 2 + ori as usize) as u8
}
#[inline]
fn edge_decode(code: u8) -> (usize, u8) {
    ((code / 2) as usize, code % 2)
}

// ---------- 求解器 ----------

/// 受限集相关的 PDB 缓存(slot/face/scramble 无关,只随 allowed 变):cross PDB + 4 槽 pair PDB。
struct Pdbs {
    allowed_moves: Vec<usize>,
    cross: Vec<u8>,
    pairs: [Vec<u8>; 4],
}

/// 节点预算:限制单次 (face,slot) IDA* 的访问节点数。宽限制(允许 move 多)分支爆炸,
/// 价值又低(允许越多最优越接近无限制),超预算即放弃该视角(报 budget-hit)而非卡死。
/// `limit = u64::MAX` 表示不限(测试 / 紧限制走此路,行为与无预算时完全一致)。
struct SearchBudget {
    nodes: u64,
    limit: u64,
    hit: bool,
}
impl SearchBudget {
    fn unlimited() -> Self {
        SearchBudget { nodes: 0, limit: u64::MAX, hit: false }
    }
}

pub struct XCrossRestrictSolver {
    /// 物理 54 cube State 算子(replay / 校验复用)。
    ops: [State; 54],
    /// cross_trans[c * 54 + m] = cross-coord c 上施加 move m 的新 cross-coord(4 棱 8,9,10,11)。
    cross_trans: Vec<u32>,
    /// corner_trans[c * 54 + m] = 槽角编码 c(任一角)上施加 move m 的新槽角编码。
    corner_trans: Vec<u8>,
    /// edge_trans[e * 54 + m] = 槽棱编码 e 上施加 move m 的新槽棱编码。
    edge_trans: Vec<u8>,
    /// center_trans[ci][m]:中心索引 ci(0..24)上施加 move m。
    center_trans: [[u8; 54]; 24],
    /// SOLVED cross-coord。
    solved_cross: u32,
}

impl Default for XCrossRestrictSolver {
    fn default() -> Self {
        Self::new()
    }
}

impl XCrossRestrictSolver {
    pub fn new() -> Self {
        let (ops, center_perm) = build_phys_moves();

        // ---- 自检:旋转 order-4 + 共轭全 18 面动(物理保真的硬保证)----
        for (r, fp) in [(45usize, ROT_FACE_PERM[0]), (48, ROT_FACE_PERM[1]), (51, ROT_FACE_PERM[2])] {
            let rot = ops[r];
            // order-4
            let mut s = State::SOLVED;
            for _ in 0..4 {
                s = s.compose(&rot);
            }
            assert_eq!(s, State::SOLVED, "rotation idx {} not order-4", r);
            // 共轭所有 18 面动
            let inv = rot.inverse();
            for m in 0..18usize {
                let conj = 3 * fp[m / 3] as usize + (m % 3);
                let lhs = rot.compose(&MOVE_STATES[m]).compose(&inv);
                assert_eq!(lhs, MOVE_STATES[conj], "rotation idx {} fails conj of face {}", r, m);
            }
        }
        // 面动算子必须 == MOVE_STATES。
        for m in 0..18 {
            assert_eq!(ops[m], MOVE_STATES[m], "face op {} mismatch", m);
        }

        // ---- cross_trans:对每个 cross-coord 施加 54 move,用物理算子搬 4 棱 8,9,10,11 ----
        // op 把棱从 home pos p 搬到 slot q(op.edges[q] 的 ep 部分 == p),翻向 = op.edges[q] 的 eo。
        // 先为每个 op 求「单棱 dest」:edge_dest[m][s] = (新 pos, 翻向增量)。
        let mut edge_dest = [[(0u8, 0u8); 12]; 54];
        for m in 0..54 {
            for q in 0..12 {
                let src = (ops[m].edges[q] / 2) as usize; // slot q 的件来自 home src
                let flip = ops[m].edges[q] % 2;
                edge_dest[m][src] = (q as u8, flip);
            }
        }
        // 单角 dest:corner_dest[m][s] = (新 pos, 朝向增量 mod3)。
        let mut corner_dest = [[(0u8, 0u8); 8]; 54];
        for m in 0..54 {
            for q in 0..8 {
                let src = (ops[m].corners[q] / 3) as usize;
                let twist = ops[m].corners[q] % 3;
                corner_dest[m][src] = (q as u8, twist);
            }
        }

        let solved_cross = solved_coord() as u32;

        // cross-coord 转移(复用 encode/decode 编解码)。
        let mut cross_trans = vec![0u32; CROSS_COORD * 54];
        for c in 0..CROSS_COORD {
            let (pos, ori) = decode_coord(c);
            for m in 0..54 {
                let mut np = [0usize; 4];
                let mut no = [0u8; 4];
                for k in 0..4 {
                    let (d, dori) = edge_dest[m][pos[k]];
                    np[k] = d as usize;
                    no[k] = (ori[k] + dori) % 2;
                }
                cross_trans[c * 54 + m] = encode_coord(&np, &no) as u32;
            }
        }

        // corner_trans。
        let mut corner_trans = vec![0u8; CORNER_STATES * 54];
        for c in 0..CORNER_STATES {
            let (pos, ori) = corner_decode(c as u8);
            for m in 0..54 {
                let (d, dori) = corner_dest[m][pos];
                corner_trans[c * 54 + m] = corner_code(d as usize, (ori + dori) % 3);
            }
        }

        // edge_trans。
        let mut edge_trans = vec![0u8; EDGE_STATES * 54];
        for e in 0..EDGE_STATES {
            let (pos, ori) = edge_decode(e as u8);
            for m in 0..54 {
                let (d, dori) = edge_dest[m][pos];
                edge_trans[e * 54 + m] = edge_code(d as usize, (ori + dori) % 2);
            }
        }

        // center_trans:中心向量(6 面)编成 0..24 索引(枚举所有可达中心朝向)。
        let center_trans = build_center_trans(&center_perm);

        XCrossRestrictSolver {
            ops,
            cross_trans,
            corner_trans,
            edge_trans,
            center_trans,
            solved_cross,
        }
    }

    #[inline]
    fn step_cross(&self, c: u32, m: usize) -> u32 {
        self.cross_trans[c as usize * 54 + m]
    }
    #[inline]
    fn step_corner(&self, c: u8, m: usize) -> u8 {
        self.corner_trans[c as usize * 54 + m]
    }
    #[inline]
    fn step_edge(&self, e: u8, m: usize) -> u8 {
        self.edge_trans[e as usize * 54 + m]
    }
    #[inline]
    fn step_center(&self, ci: u8, m: usize) -> u8 {
        self.center_trans[ci as usize][m]
    }

    /// slot k 在 SOLVED 时的 (角编码, 棱编码):角 = 4+k(pos 4+k, ori 0),棱 = k(pos k, ori 0)。
    #[inline]
    fn solved_pair(slot: usize) -> (u8, u8) {
        (corner_code(4 + slot, 0), edge_code(slot, 0))
    }

    /// 从给定视角(face)+ 槽(slot)算起点 (cross_coord, slot_corner, slot_edge, center)。
    /// 打乱按 ROTS_FACE[face] 逐 move 共轭(面动),从 SOLVED 应用。
    fn start_state(&self, scramble: &[usize], face: usize, slot: usize) -> (u32, u8, u8, u8) {
        let conj = CrossRestrictSolver::conjugate_scramble_pub(scramble, ROTS_FACE[face.min(5)]);
        let mut cross = self.solved_cross;
        let (mut corner, mut edge) = Self::solved_pair(slot);
        let mut center = 0u8;
        for &m in &conj {
            cross = self.step_cross(cross, m);
            corner = self.step_corner(corner, m);
            edge = self.step_edge(edge, m);
            center = self.step_center(center, m);
        }
        (cross, corner, edge, center)
    }

    // ---------- 两个 PDB(运行时建,无文件)----------

    /// PDB_cross = (cross-coord, center) → 受限 54-move 最优到 solved-cross 距离(忽略 rot)。
    /// over allowed_moves(每步法格对逆封闭 ⇒ 无向图 ⇒ 正向 BFS = 距离)。
    /// `max_states`:可达状态数上限;超出 → BFS 中止、返回 (部分表, complete=false)。宽限制(允许
    /// move 多)可达空间大、建表慢且价值低 → 调用方据此判「太宽」而非干等。`usize::MAX` = 不限。
    fn build_pdb_cross(
        &self,
        allowed_moves: &[usize],
        goal_centers: &[u8],
        limit: u8,
        max_states: usize,
    ) -> (Vec<u8>, bool) {
        const INF: u8 = u8::MAX;
        let mut h = vec![INF; CROSS_COORD * NCENTER];
        let mut q: std::collections::VecDeque<(u32, u8)> = std::collections::VecDeque::new();
        let mut visited = 0usize;
        for &gc in goal_centers {
            let id = self.solved_cross as usize * NCENTER + gc as usize;
            if h[id] == INF {
                h[id] = 0;
                visited += 1;
                q.push_back((self.solved_cross, gc));
            }
        }
        while let Some((coord, center)) = q.pop_front() {
            let d = h[coord as usize * NCENTER + center as usize];
            if d >= limit {
                continue;
            }
            for &m in allowed_moves {
                let nc = self.step_cross(coord, m);
                let ncen = self.step_center(center, m);
                let id = nc as usize * NCENTER + ncen as usize;
                if h[id] == INF {
                    h[id] = d + 1;
                    visited += 1;
                    if visited > max_states {
                        return (h, false); // 太宽:可达空间超预算,放弃建全表
                    }
                    q.push_back((nc, ncen));
                }
            }
        }
        (h, true)
    }

    /// PDB_pair = (slot_corner, slot_edge, center) → 受限 54-move 最优到 pair-solved 距离(忽略 rot)。
    /// 状态空间 24×24×24 = 13824(tiny)。从 solved-pair(本 slot)反向 BFS。
    fn build_pdb_pair(&self, slot: usize, allowed_moves: &[usize], goal_centers: &[u8]) -> Vec<u8> {
        const INF: u8 = u8::MAX;
        let size = CORNER_STATES * EDGE_STATES * NCENTER;
        let mut h = vec![INF; size];
        let idx = |c: u8, e: u8, ce: u8| -> usize {
            (c as usize * EDGE_STATES + e as usize) * NCENTER + ce as usize
        };
        let (sc, se) = Self::solved_pair(slot);
        let mut q: std::collections::VecDeque<(u8, u8, u8)> = std::collections::VecDeque::new();
        for &gc in goal_centers {
            let id = idx(sc, se, gc);
            if h[id] == INF {
                h[id] = 0;
                q.push_back((sc, se, gc));
            }
        }
        while let Some((c, e, ce)) = q.pop_front() {
            let d = h[idx(c, e, ce)];
            for &m in allowed_moves {
                let nc = self.step_corner(c, m);
                let ne = self.step_edge(e, m);
                let ncen = self.step_center(ce, m);
                let id = idx(nc, ne, ncen);
                if h[id] == INF {
                    h[id] = d + 1;
                    q.push_back((nc, ne, ncen));
                }
            }
        }
        h
    }

    // ---------- 单视角 IDA* ----------

    /// 受限集相关的 PDB 缓存:cross PDB(slot 无关)+ 4 个槽各自的 pair PDB。
    /// 一次受限集只建一次,6 视角 × 4 槽 共用,免重复建 4.5M 表。
    fn build_pdbs(&self, allowed: u64) -> Pdbs {
        // 不限状态数(测试 / 无预算路径):cross PDB 必完整。
        self.build_pdbs_budgeted(allowed, usize::MAX)
            .expect("unlimited build_pdbs must complete")
    }

    /// 带可达状态预算的 PDB 构建:cross PDB 超 `max_states` → 返回 None(限制过宽,不建表)。
    /// pair PDB 状态空间恒小(24×24×24)无需预算。
    fn build_pdbs_budgeted(&self, allowed: u64, max_states: usize) -> Option<Pdbs> {
        let allowed_moves: Vec<usize> = (0..54).filter(|&m| (allowed >> m) & 1 == 1).collect();
        let goal_centers = [0u8];
        let (cross, complete) =
            self.build_pdb_cross(&allowed_moves, &goal_centers, 20, max_states);
        if !complete {
            return None;
        }
        let pairs: [Vec<u8>; 4] =
            std::array::from_fn(|slot| self.build_pdb_pair(slot, &allowed_moves, &goal_centers));
        Some(Pdbs {
            allowed_moves,
            cross,
            pairs,
        })
    }

    /// 受限 xcross IDA* 的 bound 上界(超过即视为「该受限集下不可解」返回 None)。
    /// 任意合法受限 xcross 最优远低于此(实测最重受限也 ≤ ~18);给足余量到 20。受限集若不生成
    /// 完整群,某些 (cross,pair) 个别可达但联合不可达的状态会在此被截断(返回 None)。
    /// 注:极弱受限集(如纯 {U,R,M})下「联合不可解」状态会一路深搜到此上界才放弃,可能 >2s
    /// (admissible h 会剪枝但不能证伪)。调用方对弱受限集应自带超时或预判。
    const MAX_BOUND: u32 = 20;

    /// 解「face 视角 + slot 槽」的受限最优 xcross(用预建 PDB 缓存)。
    /// h = max(PDB_cross, PDB_pair),双可采纳下界 → max 可采纳。IDA* 迭代加深,首达即最优。
    fn solve_view_slot_with(
        &self,
        scramble: &[usize],
        face: usize,
        slot: usize,
        pdbs: &Pdbs,
        max_rot_count: u32,
    ) -> Option<Vec<usize>> {
        self.solve_view_slot_bounded(scramble, face, slot, pdbs, max_rot_count, Self::MAX_BOUND)
    }

    /// 同上但显式 bound 上界(测试 / oracle 配合用,避免对不可解状态深搜)。无预算版。
    fn solve_view_slot_bounded(
        &self,
        scramble: &[usize],
        face: usize,
        slot: usize,
        pdbs: &Pdbs,
        max_rot_count: u32,
        max_bound: u32,
    ) -> Option<Vec<usize>> {
        let mut budget = SearchBudget::unlimited();
        self.solve_view_slot_budgeted(scramble, face, slot, pdbs, max_rot_count, max_bound, &mut budget)
    }

    /// 带节点预算版:返回最优解;`budget.hit` 置位表示因超预算放弃(结果 None 但「非无解」)。
    /// 预算不限(SearchBudget::unlimited)时行为与无预算版逐字节一致。
    #[allow(clippy::too_many_arguments)]
    fn solve_view_slot_budgeted(
        &self,
        scramble: &[usize],
        face: usize,
        slot: usize,
        pdbs: &Pdbs,
        max_rot_count: u32,
        max_bound: u32,
        budget: &mut SearchBudget,
    ) -> Option<Vec<usize>> {
        let goal_centers = [0u8];
        let (start_cross, start_corner, start_edge, start_center) =
            self.start_state(scramble, face, slot);

        let (solved_corner, solved_edge) = Self::solved_pair(slot);
        let pdb_pair = &pdbs.pairs[slot];
        let pdb_cross = &pdbs.cross;

        if start_cross == self.solved_cross
            && start_corner == solved_corner
            && start_edge == solved_edge
            && start_center == 0
        {
            return Some(Vec::new());
        }

        let hc = pdb_cross[start_cross as usize * NCENTER + start_center as usize];
        let hp = pdb_pair[(start_corner as usize * EDGE_STATES + start_edge as usize) * NCENTER
            + start_center as usize];
        if hc == u8::MAX || hp == u8::MAX {
            return None;
        }
        let h0 = hc.max(hp) as u32;

        for bound in h0..=max_bound {
            let mut path: Vec<usize> = Vec::new();
            if let Some(sol) = self.ida(
                start_cross, start_corner, start_edge, start_center, 0, bound, &pdbs.allowed_moves,
                &goal_centers, max_rot_count, pdb_cross, pdb_pair, &solved_corner, &solved_edge,
                &mut path, budget,
            ) {
                return Some(sol);
            }
            if budget.hit {
                return None; // 超预算 → 放弃继续加深(更深只会更慢)
            }
        }
        None
    }

    /// 便捷:单 (face, slot) 解(自建 PDB)。测试 / oracle 用。
    fn solve_view_slot(
        &self,
        scramble: &[usize],
        face: usize,
        slot: usize,
        allowed: u64,
        max_rot_count: u32,
    ) -> Option<Vec<usize>> {
        let pdbs = self.build_pdbs(allowed);
        self.solve_view_slot_with(scramble, face, slot, &pdbs, max_rot_count)
    }

    /// IDA* 递归(h 剪枝 + 同格相邻剪枝 + rot 预算)。
    #[allow(clippy::too_many_arguments)]
    fn ida(
        &self,
        cross: u32,
        corner: u8,
        edge: u8,
        center: u8,
        depth: u32,
        bound: u32,
        allowed_moves: &[usize],
        goal_centers: &[u8],
        max_rot: u32,
        pdb_cross: &[u8],
        pdb_pair: &[u8],
        solved_corner: &u8,
        solved_edge: &u8,
        path: &mut Vec<usize>,
        budget: &mut SearchBudget,
    ) -> Option<Vec<usize>> {
        if cross == self.solved_cross
            && corner == *solved_corner
            && edge == *solved_edge
            && goal_centers.contains(&center)
        {
            return Some(path.clone());
        }
        // 节点预算:超限即剪枝整棵子树(返回 None + 置位 hit),调用方据 hit 区分「无解」与「太宽」。
        budget.nodes += 1;
        if budget.nodes > budget.limit {
            budget.hit = true;
            return None;
        }
        let hc = pdb_cross[cross as usize * NCENTER + center as usize];
        let hp =
            pdb_pair[(corner as usize * EDGE_STATES + edge as usize) * NCENTER + center as usize];
        if hc == u8::MAX || hp == u8::MAX {
            return None;
        }
        let h = hc.max(hp) as u32;
        if depth + h > bound {
            return None;
        }
        let rots_used = path.iter().filter(|&&m| m >= 45).count() as u32;
        let prev_cell = path.last().map(|&m| m / 3);
        for &m in allowed_moves {
            if Some(m / 3) == prev_cell {
                continue;
            }
            let is_rot = m >= 45;
            if is_rot && rots_used + 1 > max_rot {
                continue;
            }
            let nc = self.step_cross(cross, m);
            let ncorner = self.step_corner(corner, m);
            let nedge = self.step_edge(edge, m);
            let ncenter = self.step_center(center, m);
            path.push(m);
            if let Some(sol) = self.ida(
                nc, ncorner, nedge, ncenter, depth + 1, bound, allowed_moves, goal_centers, max_rot,
                pdb_cross, pdb_pair, solved_corner, solved_edge, path, budget,
            ) {
                return Some(sol);
            }
            path.pop();
            if budget.hit {
                return None;
            }
        }
        None
    }

    // ---------- 公共 API ----------

    /// 解「face 视角」的受限最优 xcross(= 4 个槽 xcross 的最小者),返回最优解(rotated frame
    /// 下的 move 索引序列)。allowed 由 [allowed_lo, allowed_hi] 拼成 54-bit mask。
    pub fn solve_xcross_restricted(
        &self,
        scramble: &[usize],
        face: usize,
        allowed_lo: u32,
        allowed_hi: u32,
        max_rot_count: u32,
    ) -> Option<Vec<usize>> {
        let allowed = (allowed_lo as u64) | ((allowed_hi as u64) << 32);
        let pdbs = self.build_pdbs(allowed);
        let mut best: Option<Vec<usize>> = None;
        for slot in 0..4 {
            if let Some(sol) = self.solve_view_slot_with(scramble, face, slot, &pdbs, max_rot_count) {
                let better = match &best {
                    None => true,
                    Some(b) => sol.len() < b.len(),
                };
                if better {
                    best = Some(sol);
                }
            }
        }
        best
    }

    /// 长度专用:face 视角下受限最优 xcross 步数(4 槽最小),None = 不可解。
    pub fn solve_xcross_restricted_len(
        &self,
        scramble: &[usize],
        face: usize,
        allowed: u64,
        max_rot_count: u32,
    ) -> Option<u32> {
        let pdbs = self.build_pdbs(allowed);
        let mut best: Option<u32> = None;
        for slot in 0..4 {
            if let Some(sol) = self.solve_view_slot_with(scramble, face, slot, &pdbs, max_rot_count) {
                let l = sol.len() as u32;
                best = Some(best.map_or(l, |b| b.min(l)));
            }
        }
        best
    }

    /// 6 视角长度网格(face 0..6),每格 = 该面受限最优 xcross 步数(None = 不可解)。
    /// PDB 只建一次,6 视角 × 4 槽共用。
    pub fn solve_xcross_restricted_grid(
        &self,
        scramble: &[usize],
        allowed: u64,
        max_rot_count: u32,
    ) -> [Option<u32>; 6] {
        let pdbs = self.build_pdbs(allowed);
        std::array::from_fn(|face| {
            let mut best: Option<u32> = None;
            for slot in 0..4 {
                if let Some(sol) =
                    self.solve_view_slot_with(scramble, face, slot, &pdbs, max_rot_count)
                {
                    let l = sol.len() as u32;
                    best = Some(best.map_or(l, |b| b.min(l)));
                }
            }
            best
        })
    }

    /// 带节点预算的 6 视角网格(交互用):每格 = 该面 4 槽最小步数。返回 i64:
    /// ≥0 = 步数;-1 = 受限下无解;-2 = 限制过宽(PDB 可达空间或 IDA* 分支超预算,价值低)放弃。
    /// `node_limit` = 单 (face,slot) IDA* 节点上限(每格独立);`max_states` = PDB 可达状态上限。
    pub fn solve_xcross_restricted_grid_budgeted(
        &self,
        scramble: &[usize],
        allowed: u64,
        max_rot_count: u32,
        node_limit: u64,
        max_states: usize,
    ) -> [i64; 6] {
        // PDB 可达空间超预算 → 整盘「太宽」(-2),秒返不干等建表。
        let pdbs = match self.build_pdbs_budgeted(allowed, max_states) {
            Some(p) => p,
            None => return [-2; 6],
        };
        std::array::from_fn(|face| {
            let mut best: Option<u32> = None;
            let mut any_budget = false;
            for slot in 0..4 {
                let mut budget = SearchBudget { nodes: 0, limit: node_limit, hit: false };
                let r = self.solve_view_slot_budgeted(
                    scramble, face, slot, &pdbs, max_rot_count, Self::MAX_BOUND, &mut budget,
                );
                match r {
                    Some(sol) => {
                        let l = sol.len() as u32;
                        best = Some(best.map_or(l, |b| b.min(l)));
                    }
                    None if budget.hit => any_budget = true,
                    None => {}
                }
            }
            match best {
                Some(l) => l as i64,
                None if any_budget => -2,
                None => -1,
            }
        })
    }

    /// 多解枚举:face 视角下、长度 ∈ [opt, opt+extra]、最多 cap 条解(升序、去重)。无预算版。
    pub fn solve_xcross_restricted_enum(
        &self,
        scramble: &[usize],
        face: usize,
        allowed: u64,
        max_rot: u32,
        extra: u32,
        cap: usize,
    ) -> Vec<Vec<usize>> {
        self.enum_with_budget(scramble, face, allowed, max_rot, extra, cap, u64::MAX, usize::MAX)
    }

    /// 带节点 + PDB 状态预算的多解枚举(交互用):超预算(限制过宽)→ 返回已收集的解(可能为空)。
    #[allow(clippy::too_many_arguments)]
    pub fn solve_xcross_restricted_enum_budgeted(
        &self,
        scramble: &[usize],
        face: usize,
        allowed: u64,
        max_rot: u32,
        extra: u32,
        cap: usize,
        node_limit: u64,
        max_states: usize,
    ) -> Vec<Vec<usize>> {
        self.enum_with_budget(scramble, face, allowed, max_rot, extra, cap, node_limit, max_states)
    }

    #[allow(clippy::too_many_arguments)]
    fn enum_with_budget(
        &self,
        scramble: &[usize],
        face: usize,
        allowed: u64,
        max_rot: u32,
        extra: u32,
        cap: usize,
        node_limit: u64,
        max_states: usize,
    ) -> Vec<Vec<usize>> {
        let goal_centers = [0u8];
        let pdbs = match self.build_pdbs_budgeted(allowed, max_states) {
            Some(p) => p,
            None => return Vec::new(), // 限制过宽:PDB 可达空间超预算
        };

        // 每槽独立预算(与 grid 一致):某槽超节点预算只是不贡献,不会拖垮整个视角的枚举。
        let fresh = || SearchBudget { nodes: 0, limit: node_limit, hit: false };
        let mut slot_opt = [None::<u32>; 4];
        let mut global_opt: Option<u32> = None;
        for slot in 0..4 {
            let mut b = fresh();
            if let Some(sol) =
                self.solve_view_slot_budgeted(scramble, face, slot, &pdbs, max_rot, Self::MAX_BOUND, &mut b)
            {
                let l = sol.len() as u32;
                slot_opt[slot] = Some(l);
                global_opt = Some(global_opt.map_or(l, |g| g.min(l)));
            }
        }
        let opt = match global_opt {
            Some(o) => o,
            None => return Vec::new(),
        };

        let mut sols: Vec<Vec<usize>> = Vec::new();
        for lim in opt..=opt + extra {
            for slot in 0..4 {
                if sols.len() >= cap {
                    break;
                }
                match slot_opt[slot] {
                    Some(o) if o <= lim => {}
                    _ => continue,
                }
                let (sc, scn, se, sce) = self.start_state(scramble, face, slot);
                let (solved_corner, solved_edge) = Self::solved_pair(slot);
                let mut path: Vec<usize> = Vec::new();
                let mut b = fresh();
                self.dfs_exact(
                    sc, scn, se, sce, 0, lim, &pdbs.allowed_moves, &goal_centers, max_rot,
                    &pdbs.cross, &pdbs.pairs[slot], &solved_corner, &solved_edge, &mut path,
                    &mut sols, cap, &mut b,
                );
            }
            if sols.len() >= cap {
                break;
            }
        }
        sols.sort_by(|a, b| a.len().cmp(&b.len()).then_with(|| a.cmp(b)));
        sols.dedup();
        sols.truncate(cap);
        sols
    }

    /// 定长 h 剪枝 DFS:只收**恰为 lim** 长的到达解(同格相邻剪枝、rot 预算、cap 上限)。
    #[allow(clippy::too_many_arguments)]
    fn dfs_exact(
        &self,
        cross: u32,
        corner: u8,
        edge: u8,
        center: u8,
        depth: u32,
        lim: u32,
        allowed_moves: &[usize],
        goal_centers: &[u8],
        max_rot: u32,
        pdb_cross: &[u8],
        pdb_pair: &[u8],
        solved_corner: &u8,
        solved_edge: &u8,
        path: &mut Vec<usize>,
        sols: &mut Vec<Vec<usize>>,
        cap: usize,
        budget: &mut SearchBudget,
    ) {
        if sols.len() >= cap || budget.hit {
            return;
        }
        if cross == self.solved_cross
            && corner == *solved_corner
            && edge == *solved_edge
            && goal_centers.contains(&center)
        {
            if depth == lim {
                sols.push(path.clone());
            }
            return;
        }
        if depth == lim {
            return;
        }
        budget.nodes += 1;
        if budget.nodes > budget.limit {
            budget.hit = true;
            return;
        }
        let hc = pdb_cross[cross as usize * NCENTER + center as usize];
        let hp =
            pdb_pair[(corner as usize * EDGE_STATES + edge as usize) * NCENTER + center as usize];
        if hc == u8::MAX || hp == u8::MAX {
            return;
        }
        let h = hc.max(hp) as u32;
        if depth + h > lim {
            return;
        }
        let rots_used = path.iter().filter(|&&m| m >= 45).count() as u32;
        let prev_cell = path.last().map(|&m| m / 3);
        for &m in allowed_moves {
            if Some(m / 3) == prev_cell {
                continue;
            }
            let is_rot = m >= 45;
            if is_rot && rots_used + 1 > max_rot {
                continue;
            }
            let nc = self.step_cross(cross, m);
            let ncorner = self.step_corner(corner, m);
            let nedge = self.step_edge(edge, m);
            let ncenter = self.step_center(center, m);
            path.push(m);
            self.dfs_exact(
                nc, ncorner, nedge, ncenter, depth + 1, lim, allowed_moves, goal_centers, max_rot,
                pdb_cross, pdb_pair, solved_corner, solved_edge, path, sols, cap, budget,
            );
            path.pop();
            if sols.len() >= cap || budget.hit {
                return;
            }
        }
    }

    /// move 索引序列 → 步骤串。
    pub fn moves_to_string(seq: &[usize]) -> String {
        seq.iter()
            .map(|&m| MOVE_NAMES_54[m])
            .collect::<Vec<_>>()
            .join(" ")
    }
}

// ---------- 中心(6 面)24 索引化 + 转移表 ----------

/// 把可达的中心朝向(从 solved 经 24 旋转/move 生成)枚举成 0..N 的索引,并建 center_trans。
/// 中心朝向数 = 24(立方体朝向群),但本约定下棱中心置换会经 wide/slice 触达更多?——不会:
/// 中心置换由旋转面置换生成,这些面置换构成 24 阶旋转群 ⇒ 恰 24 个不同中心向量。
fn build_center_trans(center_perm: &[[u8; 6]; 54]) -> [[u8; 54]; 24] {
    // BFS 从 solved 中心 [0..6],对 54 move 应用 center_perm,收集所有可达向量并编号。
    use std::collections::HashMap;
    let id6: [u8; 6] = [0, 1, 2, 3, 4, 5];
    let apply = |cur: &[u8; 6], m: usize| -> [u8; 6] {
        // new_center[i] = cur[center_perm[m][i]]。
        let mut nc = [0u8; 6];
        for i in 0..6 {
            nc[i] = cur[center_perm[m][i] as usize];
        }
        nc
    };
    let mut index: HashMap<[u8; 6], u8> = HashMap::new();
    let mut order: Vec<[u8; 6]> = Vec::new();
    index.insert(id6, 0);
    order.push(id6);
    let mut head = 0;
    while head < order.len() {
        let cur = order[head];
        head += 1;
        for m in 0..54 {
            let nc = apply(&cur, m);
            if !index.contains_key(&nc) {
                let id = index.len() as u8;
                index.insert(nc, id);
                order.push(nc);
            }
        }
    }
    assert_eq!(order.len(), 24, "center orientations must be exactly 24, got {}", order.len());
    let mut ct = [[0u8; 54]; 24];
    for (ci, cur) in order.iter().enumerate() {
        for m in 0..54 {
            let nc = apply(cur, m);
            ct[ci][m] = *index.get(&nc).unwrap();
        }
    }
    ct
}

// ---------- 独立 replay 校验(测试用,全 cube State)----------
//
// 在完整 cube State 上独立重放打乱 + 解,确认该 (face, slot) 的 xcross 已解。本模块的 54-move
// 算子本身就是物理 cube State(faces=MOVE_STATES,wide/slice/rotation 几何精确),故 replay
// 与求解器坐标完全独立但物理一致:任何枚举解套到真魔方上必须真解出该 slot 的 xcross。
pub mod replay {
    use super::*;
    use std::sync::OnceLock;

    fn ops() -> &'static [State; 54] {
        static V: OnceLock<[State; 54]> = OnceLock::new();
        V.get_or_init(|| build_phys_moves().0)
    }

    /// 54-move 名索引 → 完整 cube State 算子。
    pub fn move_state_54(m: usize) -> State {
        ops()[m]
    }

    /// 在完整 cube 上重放 (conjugated_scramble ∘ solution),返回该 slot 的 xcross 是否已解。
    /// xcross 已解 = cross 4 棱(8,9,10,11)归位归向 + 槽角(4+slot)归位归向 + 槽棱(slot)归位归向。
    pub fn xcross_solved_after(
        scramble: &[usize],
        face: usize,
        slot: usize,
        solution: &[usize],
    ) -> bool {
        let conj = CrossRestrictSolver::conjugate_scramble_pub(scramble, ROTS_FACE[face.min(5)]);
        let mut cube = State::SOLVED;
        for &m in &conj {
            cube = cube.compose(&MOVE_STATES[m]); // conj 全是面动(0..18)
        }
        let o = ops();
        for &m in solution {
            cube = cube.compose(&o[m]);
        }
        let (cp, co) = cube.cp_co();
        let (ep, eo) = cube.ep_eo();
        for &e in &CROSS_PIECES {
            if ep[e] as usize != e || eo[e] != 0 {
                return false;
            }
        }
        let c = 4 + slot;
        if cp[c] as usize != c || co[c] != 0 {
            return false;
        }
        if ep[slot] as usize != slot || eo[slot] != 0 {
            return false;
        }
        true
    }
}
// ---------- 测试 ----------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cube_common::{string_to_alg, test_env_lock};
    use crate::xcross_solver::XCrossSolver;
    use std::path::PathBuf;

    // ===== 共用工具 =====

    fn lcg(x: u64) -> u64 {
        x.wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407)
    }

    /// 生成 len 个随机面动(move 索引 0..18)。
    fn random_face_scramble(seed: u64, len: usize) -> Vec<usize> {
        let mut x = lcg(seed);
        let mut out = Vec::with_capacity(len);
        for _ in 0..len {
            x = lcg(x);
            out.push(((x >> 33) as usize) % 18);
        }
        out
    }

    fn mask_18_faces() -> u64 {
        (1u64 << 18) - 1
    }

    /// 用真实 ./tables/(mt_edge4/mt_corn/mt_edge + pt_cross_C4E0 已存在)初始化现有引擎。
    fn use_real_tables() {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tables");
        std::env::set_var("CUBE_TABLE_DIR", &dir);
    }
    // ===== 物理 54-move 算子自检(prompt task 1:角块表 + 旋转 + wide/slice 几何)=====

    /// 把一个完整 cube State 算子的角块拆成 (cp, co)。
    fn op_cp_co(s: &State) -> ([u8; 8], [u8; 8]) {
        s.cp_co()
    }

    #[test]
    fn corner_part_is_permutation_and_consistent() {
        // 每个 move 的角块置换是 0..8 的排列,朝向 < 3,且角朝向总和 ≡ 0 (mod 3)(物理守恒)。
        for m in 0..54usize {
            let (cp, co) = op_cp_co(&replay::move_state_54(m));
            let mut seen = [false; 8];
            for i in 0..8 {
                let v = cp[i] as usize;
                assert!(v < 8 && !seen[v], "move {} corner not a permutation", m);
                seen[v] = true;
                assert!(co[i] < 3, "move {} co out of range", m);
            }
            let s: u32 = co.iter().map(|&x| x as u32).sum();
            assert_eq!(s % 3, 0, "move {} CO sum not 0 mod 3 (={})", m, s);
        }
    }

    #[test]
    fn corner_face_moves_match_move_states() {
        // 0..18 面动算子必须逐位 == cube_common::MOVE_STATES(物理面动 = 现有引擎同一套约定)。
        for m in 0..18 {
            assert_eq!(replay::move_state_54(m), MOVE_STATES[m], "face move {} mismatch", m);
        }
    }

    #[test]
    fn rotations_coherent_and_order4() {
        // x/y/z(45/48/51)必须:order-4,且共轭全部 18 面动到 conj(face)(几何精确的硬保证)。
        let fps: [(usize, [usize; 6]); 3] = [
            (45, [5, 4, 2, 3, 0, 1]),
            (48, [0, 1, 5, 4, 2, 3]),
            (51, [3, 2, 0, 1, 4, 5]),
        ];
        for (idx, fp) in fps {
            let rot = replay::move_state_54(idx);
            let mut s = State::SOLVED;
            for _ in 0..4 {
                s = s.compose(&rot);
            }
            assert_eq!(s, State::SOLVED, "rotation {} not order-4", idx);
            let inv = rot.inverse();
            for m in 0..18usize {
                let conj = 3 * fp[m / 3] + (m % 3);
                assert_eq!(
                    rot.compose(&MOVE_STATES[m]).compose(&inv),
                    MOVE_STATES[conj],
                    "rotation {} fails conjugation of face {}",
                    idx,
                    m
                );
            }
        }
    }

    #[test]
    fn wide_slice_move_exactly_correct_cubies() {
        // wide r(27):移动 R 角{1,2,5,6} + R 棱{1,2,5,9} + M 棱{4,6,8,10},共 4 角 8 棱,order-4。
        // slice M(36):移动 M 棱{4,6,8,10},0 角,order-4。其余 wide/slice 同理由 build 保证。
        let moved_c = |s: &State| -> Vec<usize> {
            (0..8).filter(|&i| s.corners[i] / 3 != i as u8 || s.corners[i] % 3 != 0).collect()
        };
        let moved_e = |s: &State| -> Vec<usize> {
            (0..12).filter(|&i| s.edges[i] / 2 != i as u8 || s.edges[i] % 2 != 0).collect()
        };
        let ord4 = |s: &State| -> bool {
            let mut t = State::SOLVED;
            for _ in 0..4 {
                t = t.compose(s);
            }
            t == State::SOLVED
        };
        let r = replay::move_state_54(27);
        assert_eq!(moved_c(&r), vec![1, 2, 5, 6], "wide r corners");
        assert_eq!(moved_e(&r), vec![1, 2, 4, 5, 6, 8, 9, 10], "wide r edges");
        assert!(ord4(&r), "wide r not order-4");

        let m = replay::move_state_54(36);
        assert!(moved_c(&m).is_empty(), "slice M must not move corners");
        assert_eq!(moved_e(&m), vec![4, 6, 8, 10], "slice M edges");
        assert!(ord4(&m), "slice M not order-4");

        // 每个 wide/slice/rotation 都是合法置换(角棱各自双射)。
        for mv in 0..54usize {
            let s = replay::move_state_54(mv);
            let mut sc = [false; 8];
            let mut se = [false; 12];
            for i in 0..8 {
                let v = (s.corners[i] / 3) as usize;
                assert!(!sc[v], "move {} corner perm invalid", mv);
                sc[v] = true;
            }
            for i in 0..12 {
                let v = (s.edges[i] / 2) as usize;
                assert!(!se[v], "move {} edge perm invalid", mv);
                se[v] = true;
            }
        }
    }

    #[test]
    fn corner_move_inverse_roundtrip() {
        // 面动 m 与其逆 inv(m) 复合回原(用 step_corner 转移表)。
        let solver = XCrossRestrictSolver::new();
        let inv = [2usize, 1, 0, 5, 4, 3, 8, 7, 6, 11, 10, 9, 14, 13, 12, 17, 16, 15];
        for m in 0..18 {
            for c in 0..CORNER_STATES as u8 {
                let a = solver.step_corner(c, m);
                let b = solver.step_corner(a, inv[m]);
                assert_eq!(b, c, "corner move {} then inv != id", m);
            }
        }
    }

    #[test]
    fn corner_trans_matches_op() {
        // step_corner 转移表必须与完整算子的角块作用逐位一致(转移表正确性)。
        let solver = XCrossRestrictSolver::new();
        for m in 0..54usize {
            let (cp, co) = op_cp_co(&replay::move_state_54(m));
            for pos in 0..8usize {
                for ori in 0..3u8 {
                    let code = (pos * 3 + ori as usize) as u8;
                    let got = solver.step_corner(code, m);
                    // 件 pos 经算子 → 输出 slot q(cp[q]==pos),朝向 += co[q]。
                    let mut out = usize::MAX;
                    let mut tw = 0u8;
                    for q in 0..8 {
                        if cp[q] as usize == pos {
                            out = q;
                            tw = co[q];
                            break;
                        }
                    }
                    let want = (out * 3 + ((ori + tw) % 3) as usize) as u8;
                    assert_eq!(got, want, "step_corner mismatch move {} code {}", m, code);
                }
            }
        }
    }

    /// slice / wide / rotation 的 EP/EO 部分必须与 cross_restrict 的 build_edge_dest /
    /// build_rotation_edge_dests 同源(它们已在 cross_restrict 测试里被绑定到 analyzer)。
    /// 这里验证我物化的完整算子棱块部分,与求解器 edge_trans 用的 dest 表逐位一致。
    #[test]
    fn edge_part_consistent_with_cross_restrict() {
        let solver = XCrossRestrictSolver::new();
        // 对每个 move,任取一个棱编码,求解器 step_edge 必须与「完整算子作用后该棱位置/朝向」一致。
        for m in 0..54usize {
            let op = replay::move_state_54(m);
            let (ep, eo) = op.ep_eo();
            for pos in 0..12usize {
                for ori in 0..2u8 {
                    let code = (pos * 2 + ori as usize) as u8;
                    let got = solver.step_edge(code, m);
                    // 完整算子:棱件「位置 pos、朝向 ori」经 op 后:它出现在 op 把 pos 搬到的输出位置。
                    // op.edges 语义:new_ep[i] = ep_op[i] 表示输出位置 i 的件来自输入 ep_op[i]。
                    // 求件 pos 的输出位置 = 满足 ep_op[i]==pos 的 i;朝向增量 = eo_op[i]。
                    let mut out_pos = usize::MAX;
                    let mut flip = 0u8;
                    for i in 0..12 {
                        if ep[i] as usize == pos {
                            out_pos = i;
                            flip = eo[i];
                            break;
                        }
                    }
                    let want = (out_pos * 2 + ((ori + flip) % 2) as usize) as u8;
                    assert_eq!(got, want, "step_edge mismatch move {} code {}", m, code);
                }
            }
        }
    }

    // ===== T1: 无限制下与现有引擎逐视角等长 =====

    #[test]
    fn t1_unrestricted_matches_existing_xcross() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        use_real_tables();

        let solver = XCrossRestrictSolver::new();
        let existing = XCrossSolver::new(false);
        let rots = ["", "z2", "z'", "z", "x'", "x"];
        let face_mask = mask_18_faces();

        for seed in 0..30u64 {
            let scramble = random_face_scramble(5000 + seed, 20);
            let scramble_str: String = scramble
                .iter()
                .map(|&m| MOVE_NAMES_54[m])
                .collect::<Vec<_>>()
                .join(" ");
            let alg = string_to_alg(&scramble_str);
            // 现有引擎 6 视角 xcross(get_stats_small max_v=0 → 前 6 个 = xc 6 视角)。
            let existing_out = existing.get_stats_small(&alg, &rots, 0);

            for face in 0..6 {
                let mine = solver
                    .solve_xcross_restricted_len(&scramble, face, face_mask, 0)
                    .expect("18-face xcross must be solvable");
                let want = existing_out[face];
                assert_eq!(
                    mine, want,
                    "seed {} face {} ({}): mine {} != existing {}",
                    seed, face, rots[face], mine, want
                );
            }
        }
    }

    // ===== T2: 6-face 子掩码下与现有 *_masked 等长 =====

    #[test]
    fn t2_face_submask_matches_existing_masked() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        use_real_tables();

        let solver = XCrossRestrictSolver::new();
        let existing = XCrossSolver::new(false);
        let rots = ["", "z2", "z'", "z", "x'", "x"];

        // 禁 B(face type 5 = moves 15,16,17),只剩 15 个面动。
        let allowed_18: u64 = ((1u64 << 18) - 1) & !(0b111u64 << 15);
        let mask18: u32 = ((1u32 << 18) - 1) & !(0b111u32 << 15);

        for seed in 0..20u64 {
            let scramble = random_face_scramble(7000 + seed, 20);
            let scramble_str: String = scramble
                .iter()
                .map(|&m| MOVE_NAMES_54[m])
                .collect::<Vec<_>>()
                .join(" ");
            let alg = string_to_alg(&scramble_str);
            let existing_out = existing.get_stats_small_masked(&alg, &rots, 0, mask18, 14);

            for face in 0..6 {
                let mine = solver.solve_xcross_restricted_len(&scramble, face, allowed_18, 0);
                let want = existing_out[face];
                assert_eq!(
                    mine, want,
                    "seed {} face {} ({}): mine {:?} != existing {:?}",
                    seed, face, rots[face], mine, want
                );
            }
        }
    }

    // ===== T3: 枚举解有效性 =====

    #[test]
    fn t3_enum_solutions_valid() {
        let solver = XCrossRestrictSolver::new();
        let face_mask = mask_18_faces();

        for seed in 0..12u64 {
            let scramble = random_face_scramble(9000 + seed, 18);
            for face in 0..6 {
                let extra = 2u32;
                let sols =
                    solver.solve_xcross_restricted_enum(&scramble, face, face_mask, 0, extra, 200);
                if sols.is_empty() {
                    continue;
                }
                let opt = sols[0].len();
                // 排序升序(长度优先,长度相等按字典序)。
                for w in sols.windows(2) {
                    let lt = w[0].len() < w[1].len()
                        || (w[0].len() == w[1].len() && w[0] <= w[1]);
                    assert!(lt, "not sorted ascending");
                }
                // 互异。
                for i in 0..sols.len() {
                    for j in (i + 1)..sols.len() {
                        assert_ne!(sols[i], sols[j], "duplicate solution");
                    }
                }
                // 第一条 = opt(= 单解最优)。
                let single = solver
                    .solve_xcross_restricted_len(&scramble, face, face_mask, 0)
                    .unwrap();
                assert_eq!(opt as u32, single, "first enum len != optimal");
                for s in &sols {
                    assert!(
                        s.len() as u32 >= single && s.len() as u32 <= single + extra,
                        "len {} out of [{},{}]",
                        s.len(),
                        single,
                        single + extra
                    );
                    // 独立重放校验:该解必须解出该 face 的某个槽的 xcross。
                    let any_slot =
                        (0..4).any(|slot| replay::xcross_solved_after(&scramble, face, slot, s));
                    assert!(
                        any_slot,
                        "seed {} face {}: enumerated sol does NOT solve xcross: {}",
                        seed,
                        face,
                        XCrossRestrictSolver::moves_to_string(s)
                    );
                }
            }
        }
    }

    // ===== T4: 可采纳性 oracle(含 wide/slice 的真受限集)=====

    /// 独立 IDDFS oracle:对 allowed 受限集做**无启发式**的迭代加深 DFS(只用同格相邻剪枝,
    /// 这是无损的),返回到目标的最短步数(≤ depth_cap),无解返回 None。
    /// 不碰求解器的 PDB/IDA* 启发式(仅复用 step_* = move 语义本身),作可采纳性 oracle。
    /// 小 optimal(≤depth_cap)时极快(无 HashSet,只 5^depth 量级 DFS)。
    #[allow(clippy::too_many_arguments)]
    fn bfs_oracle_view_slot(
        solver: &XCrossRestrictSolver,
        scramble: &[usize],
        face: usize,
        slot: usize,
        allowed: u64,
        max_rot: u32,
        depth_cap: u32,
    ) -> Option<u32> {
        let allowed_moves: Vec<usize> = (0..54).filter(|&m| (allowed >> m) & 1 == 1).collect();
        let (sc, scn, se, sce) = solver.start_state(scramble, face, slot);
        let (goal_corner, goal_edge) = XCrossRestrictSolver::solved_pair(slot);
        let is_goal = |cross: u32, corner: u8, edge: u8, center: u8| -> bool {
            cross == solver.solved_cross
                && corner == goal_corner
                && edge == goal_edge
                && center == 0
        };

        // 深度受限 DFS:返回是否能在恰好 ≤ remaining 步(无启发,纯枚举)到达;首达即返回 true。
        #[allow(clippy::too_many_arguments)]
        fn dfs(
            solver: &XCrossRestrictSolver,
            cross: u32,
            corner: u8,
            edge: u8,
            center: u8,
            rots: u32,
            remaining: u32,
            max_rot: u32,
            allowed_moves: &[usize],
            prev_cell: i32,
            is_goal: &dyn Fn(u32, u8, u8, u8) -> bool,
        ) -> bool {
            if is_goal(cross, corner, edge, center) {
                return true;
            }
            if remaining == 0 {
                return false;
            }
            for &m in allowed_moves {
                if (m / 3) as i32 == prev_cell {
                    continue; // 同格相邻剪枝(无损)
                }
                let is_rot = m >= 45;
                let nrot = if is_rot { rots + 1 } else { rots };
                if is_rot && nrot > max_rot {
                    continue;
                }
                let nc = solver.step_cross(cross, m);
                let ncn = solver.step_corner(corner, m);
                let ne = solver.step_edge(edge, m);
                let nce = solver.step_center(center, m);
                if dfs(
                    solver, nc, ncn, ne, nce, nrot, remaining - 1, max_rot, allowed_moves,
                    (m / 3) as i32, is_goal,
                ) {
                    return true;
                }
            }
            false
        }

        for d in 0..=depth_cap {
            if dfs(solver, sc, scn, se, sce, 0, d, max_rot, &allowed_moves, -1, &is_goal) {
                return Some(d);
            }
        }
        None
    }

    #[test]
    fn t4_admissibility_oracle_restricted_with_wide_slice() {
        let solver = XCrossRestrictSolver::new();
        // 受限集含 wide/slice/rotation(题目精神:含非面动)且足够丰富以频繁解出 xcross:
        // 全 6 面 + wide u/d/r/l + slice M/E/S + 旋转 x/y。base *3 取 1/2/' 三档。
        //   faces:0,3,6,9,12,15;wide u/d/l/r:18,21,24,27;slice M/E/S:36,39,42;rot x/y:45,48。
        let mut allowed: u64 = 0;
        for b in [0u32, 3, 6, 9, 12, 15, 18, 21, 24, 27, 36, 39, 42, 45, 48] {
            allowed |= 0b111u64 << b;
        }
        let max_rot = 2u32;
        // PDB 只建一次(受限集固定),24 个 (face,slot) 共用,避免重复建 4.5M cross 表。
        let pdbs = solver.build_pdbs(allowed);

        // 关键:可采纳性 = 「不存在比 IDA* 更短的解」。求解器给长度 L 后,**只**用 IDDFS oracle
        // 验到深度 L(若 L≤cap):oracle 在 < L 找到 ⟹ 启发式不可采纳(bug)。oracle 探到深度恰
        // L 才首达 ⟹ 一致。这样 oracle 上界 = L(小,极快),绝不展开「证明无解 ≤cap」的巨大球。
        let cap = 9u32; // 只对 L≤cap 的(face,slot)做 oracle 验证;求解器也只搜到 cap(更长跳过)。
        let mut checked = 0usize;
        for seed in 0..10u64 {
            let scramble = random_face_scramble(11000 + seed, 4);
            for face in 0..6 {
                for slot in 0..4 {
                    // 求解器只搜到 cap:超出(或不可解)→ None,跳过(不深搜不可解状态)。
                    let mine = solver
                        .solve_view_slot_bounded(&scramble, face, slot, &pdbs, max_rot, cap);
                    let l = match mine {
                        Some(s) => s.len() as u32,
                        None => continue,
                    };
                    // oracle 只探到深度 l;返回的最短深度必须 == l(不能更短)。
                    let oracle =
                        bfs_oracle_view_slot(&solver, &scramble, face, slot, allowed, max_rot, l);
                    assert_eq!(
                        oracle,
                        Some(l),
                        "INADMISSIBLE: seed {} face {} slot {}: ida says {} but independent IDDFS \
                         finds {:?} (≤{})",
                        seed,
                        face,
                        slot,
                        l,
                        oracle,
                        l
                    );
                    checked += 1;
                }
            }
        }
        assert!(checked >= 30, "T4 verified too few cases ({}); widen scope", checked);
        eprintln!("T4: verified {} (face,slot) cases — IDA* optimal == independent IDDFS optimal", checked);
    }
}
