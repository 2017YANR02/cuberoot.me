//! cube_common: 魔方公共定义和工具函数
//!
//! 移植自 C++ 端 cube_common.{h,cpp}。
//! 编码约定与 C++ 严格一致:
//!   - 角块状态值 = 3 * idx + ori (0..24)
//!   - 棱块状态值 = 2 * idx + ori (0..24)

use std::sync::OnceLock;

// ---------- 配置 ----------

pub const TABLE_DIR: &str = "tables/";

// ---------- StateSpace 维度常量 ----------

pub mod state_space {
    pub const EDGE: usize = 24;
    pub const CORNER: usize = 24;
    pub const EDGE2: usize = 528;
    pub const EDGE3: usize = 10560;
    pub const CORNER2: usize = 504;
    pub const CORNER3: usize = 9072;
    pub const CROSS: usize = 190080;
    pub const EDGE6: usize = 42577920;
    pub const EP4: usize = 11880;
    pub const EO12: usize = 2048;

    pub const CROSS_SOLVED: usize = 187520;
    pub const EDGE2_A_SOLVED: usize = 416;
    pub const EDGE2_B_SOLVED: usize = 520;
    pub const EP4_SOLVED: usize = 11720;
    pub const EDGE6_POS: usize = 665280;
}

// ---------- 18 个 Move ----------

#[repr(u8)]
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Move {
    U = 0,
    U2 = 1,
    UPrime = 2,
    D = 3,
    D2 = 4,
    DPrime = 5,
    L = 6,
    L2 = 7,
    LPrime = 8,
    R = 9,
    R2 = 10,
    RPrime = 11,
    F = 12,
    F2 = 13,
    FPrime = 14,
    B = 15,
    B2 = 16,
    BPrime = 17,
}

impl Move {
    pub const ALL: [Move; 18] = [
        Move::U, Move::U2, Move::UPrime,
        Move::D, Move::D2, Move::DPrime,
        Move::L, Move::L2, Move::LPrime,
        Move::R, Move::R2, Move::RPrime,
        Move::F, Move::F2, Move::FPrime,
        Move::B, Move::B2, Move::BPrime,
    ];

    #[inline]
    pub fn from_index(i: usize) -> Move {
        Self::ALL[i]
    }

    #[inline]
    pub fn index(self) -> usize {
        self as u8 as usize
    }

    pub fn name(self) -> &'static str {
        MOVE_NAMES[self.index()]
    }
}

pub const MOVE_NAMES: [&str; 18] = [
    "U", "U2", "U'", "D", "D2", "D'",
    "L", "L2", "L'", "R", "R2", "R'",
    "F", "F2", "F'", "B", "B2", "B'",
];

// ---------- State ----------

/// 完整魔方状态。`corners[i]` = 3*idx + ori,`edges[i]` = 2*idx + ori。
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub struct State {
    pub corners: [u8; 8],
    pub edges: [u8; 12],
}

impl State {
    pub const SOLVED: State = State {
        corners: [0, 3, 6, 9, 12, 15, 18, 21],
        edges: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22],
    };

    pub fn solved() -> Self {
        Self::SOLVED
    }

    /// 拆出 (cp, co):cp = idx, co = ori
    #[inline]
    pub fn cp_co(&self) -> ([u8; 8], [u8; 8]) {
        let mut cp = [0u8; 8];
        let mut co = [0u8; 8];
        for i in 0..8 {
            cp[i] = self.corners[i] / 3;
            co[i] = self.corners[i] % 3;
        }
        (cp, co)
    }

    /// 拆出 (ep, eo)
    #[inline]
    pub fn ep_eo(&self) -> ([u8; 12], [u8; 12]) {
        let mut ep = [0u8; 12];
        let mut eo = [0u8; 12];
        for i in 0..12 {
            ep[i] = self.edges[i] / 2;
            eo[i] = self.edges[i] % 2;
        }
        (ep, eo)
    }

    fn from_parts(cp: [u8; 8], co: [u8; 8], ep: [u8; 12], eo: [u8; 12]) -> Self {
        let mut corners = [0u8; 8];
        let mut edges = [0u8; 12];
        for i in 0..8 {
            corners[i] = 3 * cp[i] + co[i];
        }
        for i in 0..12 {
            edges[i] = 2 * ep[i] + eo[i];
        }
        State { corners, edges }
    }

    /// 对 self 应用 move m,得到新 state。
    /// C++ 等价:
    ///   ncp[i] = cp[m.cp[i]]
    ///   nco[i] = (co[m.cp[i]] + m.co[i]) % 3
    ///   nep[i] = ep[m.ep[i]]
    ///   neo[i] = (eo[m.ep[i]] + m.eo[i]) % 2
    pub fn compose(&self, m: &State) -> State {
        let (cp, co) = self.cp_co();
        let (ep, eo) = self.ep_eo();
        let (mcp, mco) = m.cp_co();
        let (mep, meo) = m.ep_eo();
        let mut ncp = [0u8; 8];
        let mut nco = [0u8; 8];
        let mut nep = [0u8; 12];
        let mut neo = [0u8; 12];
        for i in 0..8 {
            ncp[i] = cp[mcp[i] as usize];
            nco[i] = (co[mcp[i] as usize] + mco[i]) % 3;
        }
        for i in 0..12 {
            nep[i] = ep[mep[i] as usize];
            neo[i] = (eo[mep[i] as usize] + meo[i]) % 2;
        }
        State::from_parts(ncp, nco, nep, neo)
    }

    pub fn apply(&mut self, m: Move) {
        let mv = move_state(m);
        *self = self.compose(mv);
    }

    pub fn applied(&self, m: Move) -> State {
        let mut s = *self;
        s.apply(m);
        s
    }
}

impl Default for State {
    fn default() -> Self {
        Self::SOLVED
    }
}

// ---------- 18 个 Move 对应的基础 State 表 ----------

const fn make_move(cp: [u8; 8], co: [u8; 8], ep: [u8; 12], eo: [u8; 12]) -> State {
    let mut corners = [0u8; 8];
    let mut edges = [0u8; 12];
    let mut i = 0;
    while i < 8 {
        corners[i] = 3 * cp[i] + co[i];
        i += 1;
    }
    let mut j = 0;
    while j < 12 {
        edges[j] = 2 * ep[j] + eo[j];
        j += 1;
    }
    State { corners, edges }
}

const Z0: [u8; 8] = [0, 0, 0, 0, 0, 0, 0, 0];
const Z0E: [u8; 12] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const MOVE_STATES: [State; 18] = [
    // U
    make_move([3, 0, 1, 2, 4, 5, 6, 7], Z0, [0, 1, 2, 3, 7, 4, 5, 6, 8, 9, 10, 11], Z0E),
    // U2
    make_move([2, 3, 0, 1, 4, 5, 6, 7], Z0, [0, 1, 2, 3, 6, 7, 4, 5, 8, 9, 10, 11], Z0E),
    // U'
    make_move([1, 2, 3, 0, 4, 5, 6, 7], Z0, [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11], Z0E),
    // D
    make_move([0, 1, 2, 3, 5, 6, 7, 4], Z0, [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 8], Z0E),
    // D2
    make_move([0, 1, 2, 3, 6, 7, 4, 5], Z0, [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 8, 9], Z0E),
    // D'
    make_move([0, 1, 2, 3, 7, 4, 5, 6], Z0, [0, 1, 2, 3, 4, 5, 6, 7, 11, 8, 9, 10], Z0E),
    // L
    make_move([4, 1, 2, 0, 7, 5, 6, 3], [2, 0, 0, 1, 1, 0, 0, 2],
              [11, 1, 2, 7, 4, 5, 6, 0, 8, 9, 10, 3], Z0E),
    // L2
    make_move([7, 1, 2, 4, 3, 5, 6, 0], Z0, [3, 1, 2, 0, 4, 5, 6, 11, 8, 9, 10, 7], Z0E),
    // L'
    make_move([3, 1, 2, 7, 0, 5, 6, 4], [2, 0, 0, 1, 1, 0, 0, 2],
              [7, 1, 2, 11, 4, 5, 6, 3, 8, 9, 10, 0], Z0E),
    // R
    make_move([0, 2, 6, 3, 4, 1, 5, 7], [0, 1, 2, 0, 0, 2, 1, 0],
              [0, 5, 9, 3, 4, 2, 6, 7, 8, 1, 10, 11], Z0E),
    // R2
    make_move([0, 6, 5, 3, 4, 2, 1, 7], Z0, [0, 2, 1, 3, 4, 9, 6, 7, 8, 5, 10, 11], Z0E),
    // R'
    make_move([0, 5, 1, 3, 4, 6, 2, 7], [0, 1, 2, 0, 0, 2, 1, 0],
              [0, 9, 5, 3, 4, 1, 6, 7, 8, 2, 10, 11], Z0E),
    // F
    make_move([0, 1, 3, 7, 4, 5, 2, 6], [0, 0, 1, 2, 0, 0, 2, 1],
              [0, 1, 6, 10, 4, 5, 3, 7, 8, 9, 2, 11],
              [0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0]),
    // F2
    make_move([0, 1, 7, 6, 4, 5, 3, 2], Z0, [0, 1, 3, 2, 4, 5, 10, 7, 8, 9, 6, 11], Z0E),
    // F'
    make_move([0, 1, 6, 2, 4, 5, 7, 3], [0, 0, 1, 2, 0, 0, 2, 1],
              [0, 1, 10, 6, 4, 5, 2, 7, 8, 9, 3, 11],
              [0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0]),
    // B
    make_move([1, 5, 2, 3, 0, 4, 6, 7], [1, 2, 0, 0, 2, 1, 0, 0],
              [4, 8, 2, 3, 1, 5, 6, 7, 0, 9, 10, 11],
              [1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
    // B2
    make_move([5, 4, 2, 3, 1, 0, 6, 7], Z0, [1, 0, 2, 3, 8, 5, 6, 7, 4, 9, 10, 11], Z0E),
    // B'
    make_move([4, 0, 2, 3, 5, 1, 6, 7], [1, 2, 0, 0, 2, 1, 0, 0],
              [8, 4, 2, 3, 0, 5, 6, 7, 1, 9, 10, 11],
              [1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
];

#[inline]
pub fn move_state(m: Move) -> &'static State {
    &MOVE_STATES[m.index()]
}

// ---------- 索引转换辅助 ----------
// 与 C++ c_array / c_array2 / base_array / base_array2 对齐:
//   c_array[c][n]:  c^n
//   c_array2[c][n]: c^n (但 c=2: 起 1 共 12 项)
//   base_array[tmp2][i]: P(pn, i) 的累积偏移,用于 Lehmer 排列编码
//   base_array2[tmp2][i]: 剩余可选数 (pn - i)

// c_array[c][n] = c^n
const C_ARRAY: [[i32; 7]; 4] = [
    [0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 2, 4, 8, 16, 32, 64],
    [1, 3, 9, 27, 81, 243, 729],
];

// base_array[tmp2][i] = 偏移基(tmp2 = 24/pn,实际只用 tmp2 ∈ {2,3} 即 pn ∈ {12,8})
//   tmp2=2 (pn=12): [1, 12, 132, 1320, 11880, 95040]
//   tmp2=3 (pn=8):  [1, 8, 56, 336, 1680, 6720]
const BASE_ARRAY: [[i32; 6]; 4] = [
    [0; 6],
    [0; 6],
    [1, 12, 132, 1320, 11880, 95040],
    [1, 8, 56, 336, 1680, 6720],
];

// base_array2[tmp2][i] = 剩余数:
//   tmp2=2 (pn=12): [12, 11, 10, 9, 8, 7]
//   tmp2=3 (pn=8):  [8, 7, 6, 5, 4, 3]
const BASE_ARRAY2: [[i32; 6]; 4] = [
    [0; 6],
    [0; 6],
    [12, 11, 10, 9, 8, 7],
    [8, 7, 6, 5, 4, 3],
];

// c_array2[c][n] = c^n (c=2 用于 EO 累计,容量 12;c=3 用于 CO,容量 8)
const C_ARRAY2_C2: [i32; 12] = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
const C_ARRAY2_C3: [i32; 8] = [1, 3, 9, 27, 81, 243, 729, 2187];

#[inline]
fn c_array2(c: i32, idx: i32) -> i32 {
    if c == 2 {
        C_ARRAY2_C2[idx as usize]
    } else {
        C_ARRAY2_C3[idx as usize]
    }
}

/// 朝向 → 索引(C++ o_to_index)
pub fn o_to_index(o: &[i32], c: i32, pn: i32) -> i32 {
    let mut idx = 0;
    for i in 0..(pn - 1) {
        idx += o[i as usize] * c_array2(c, pn - i - 2);
    }
    idx
}

/// 索引 → 朝向
pub fn index_to_o(o: &mut [i32], idx: i32, c: i32, pn: i32) {
    let mut idx = idx;
    let mut cnt = 0;
    for i in 0..(pn - 1) {
        o[(pn - i - 2) as usize] = idx % c;
        cnt += o[(pn - i - 2) as usize];
        idx /= c;
    }
    o[(pn - 1) as usize] = (c - cnt % c) % c;
}

/// 排列+朝向 → 索引(C++ array_to_index)
///
/// 输入 `a[i]`:综合状态值 = c * raw_pos + ori (与 C++ 表示一致)。
/// 返回 idx_p * c^n + idx_o。
pub fn array_to_index(a: &[i32], n: i32, c: i32, pn: i32) -> i32 {
    let mut idx_p = 0i32;
    let mut idx_o = 0i32;
    let tmp2 = 24 / pn;
    for i in 0..n {
        idx_o += (a[i as usize] % c) * C_ARRAY[c as usize][(n - i - 1) as usize];
    }
    let mut pa = vec![0i32; n as usize];
    for i in 0..n {
        pa[i as usize] = a[i as usize] / c;
    }
    for i in 0..n {
        let mut tmp = 0;
        for j in 0..i {
            if pa[j as usize] < pa[i as usize] {
                tmp += 1;
            }
        }
        idx_p += (pa[i as usize] - tmp) * BASE_ARRAY[tmp2 as usize][i as usize];
    }
    idx_p * C_ARRAY[c as usize][n as usize] + idx_o
}

/// 索引 → 排列+朝向(C++ index_to_array)
///
/// 输出 `p[i]` 与 C++ 一致:`18 * (c * raw_pos + ori)`(注:C++ 在最后乘了
/// 18,因为 basic_table 的元素是按 18-stride 排的,这里保持同样语义,后续
/// move_tables phase 直接用)。
pub fn index_to_array(p: &mut [i32], index: i32, n: i32, c: i32, pn: i32) {
    let tmp2 = 24 / pn;
    let mut p_idx = index / C_ARRAY[c as usize][n as usize];
    let mut o_idx = index % C_ARRAY[c as usize][n as usize];
    let mut sorted = vec![0i32; n as usize];
    for i in 0..n {
        p[i as usize] = p_idx % BASE_ARRAY2[tmp2 as usize][i as usize];
        p_idx /= BASE_ARRAY2[tmp2 as usize][i as usize];
        // C++ 用 sort + 调整恢复绝对位置(Lehmer 解码)
        sorted[..i as usize].sort();
        for j in 0..i {
            if sorted[j as usize] <= p[i as usize] {
                p[i as usize] += 1;
            }
        }
        sorted[i as usize] = p[i as usize];
    }
    for i in 0..n {
        let pos = (n - i - 1) as usize;
        p[pos] = 18 * (c * p[pos] + o_idx % c);
        o_idx /= c;
    }
}

// ---------- 旋转/共轭 ----------

/// rot_map[k][m]: 应用 k 次 y 旋转后,原 move m 变为哪个 move。
/// k=0: identity, k=1: y, k=2: y2, k=3: y'。
/// 通过类型映射 [U,D,L,R,F,B] -> [U,D,B,F,L,R] 迭代生成。
pub fn rot_map() -> &'static [[u8; 18]; 4] {
    static V: OnceLock<[[u8; 18]; 4]> = OnceLock::new();
    V.get_or_init(|| {
        let y_type_map: [u8; 6] = [0, 1, 5, 4, 2, 3];
        let mut rm = [[0u8; 18]; 4];
        for m in 0..18u8 {
            rm[0][m as usize] = m;
        }
        for k in 1..4 {
            for m in 0..18usize {
                let prev = rm[k - 1][m];
                let prev_type = prev / 3;
                let prev_pow = prev % 3;
                let new_type = y_type_map[prev_type as usize];
                rm[k][m] = new_type * 3 + prev_pow;
            }
        }
        rm
    })
}

/// conj_moves_flat[m][k]: m 经过 k 视角共轭后的等价 move。
/// k=0..3 对应槽位 0..3 的视角变换。直接翻译 C++ init_matrix 中的硬编码逻辑。
pub fn conj_moves_flat() -> &'static [[u8; 4]; 18] {
    static V: OnceLock<[[u8; 4]; 18]> = OnceLock::new();
    V.get_or_init(|| {
        let mut tbl = [[0u8; 4]; 18];
        for i in 0..18u8 {
            let m_type = i / 3;
            let m_pow = i % 3;
            tbl[i as usize][0] = i;

            let m1 = match m_type {
                0 | 1 => i,
                2 => 12 + m_pow,
                3 => 15 + m_pow,
                4 => 9 + m_pow,
                5 => 6 + m_pow,
                _ => unreachable!(),
            };
            tbl[i as usize][1] = m1;

            let m2 = match m_type {
                0 | 1 => i,
                2 => 9 + m_pow,
                3 => 6 + m_pow,
                4 => 15 + m_pow,
                5 => 12 + m_pow,
                _ => unreachable!(),
            };
            tbl[i as usize][2] = m2;

            let m3 = match m_type {
                0 | 1 => i,
                2 => 15 + m_pow,
                3 => 12 + m_pow,
                4 => 6 + m_pow,
                5 => 9 + m_pow,
                _ => unreachable!(),
            };
            tbl[i as usize][3] = m3;
        }
        tbl
    })
}

/// 把 alg 中每个 move 通过 face 映射 `f`(长度 6:U/D/L/R/F/B 的新类型)旋转。
fn alg_convert_rotation(alg: &mut [u8], f: &[u8; 6]) {
    for m in alg.iter_mut() {
        let t = (*m / 3) as usize;
        let p = *m % 3;
        *m = 3 * f[t] + p;
    }
}

/// alg_rotation:按空格分隔的 rotation 串(x, x2, x', y, y2, y', z, z2, z')
pub fn alg_rotation(a: &mut [u8], r: &str) {
    for tok in r.split_whitespace() {
        let f: [u8; 6] = match tok {
            "x" => [5, 4, 2, 3, 0, 1],
            "x2" => [1, 0, 2, 3, 5, 4],
            "x'" => [4, 5, 2, 3, 1, 0],
            "y" => [0, 1, 5, 4, 2, 3],
            "y2" => [0, 1, 3, 2, 5, 4],
            "y'" => [0, 1, 4, 5, 3, 2],
            "z" => [3, 2, 0, 1, 4, 5],
            "z2" => [1, 0, 3, 2, 4, 5],
            "z'" => [2, 3, 1, 0, 4, 5],
            _ => continue,
        };
        alg_convert_rotation(a, &f);
    }
}

/// sym_moves_flat[m][s]: 12 个对称 slot (s=0..11) 下,move m 的等价 move。
/// s 顺序与 C++ rot_names 一致:
/// "", "y", "z2", "z2 y", "z'", "z' y", "z", "z y", "x'", "x' y", "x", "x y"
pub fn sym_moves_flat() -> &'static [[u8; 12]; 18] {
    static V: OnceLock<[[u8; 12]; 18]> = OnceLock::new();
    V.get_or_init(|| {
        let rot_names = [
            "", "y", "z2", "z2 y", "z'", "z' y",
            "z", "z y", "x'", "x' y", "x", "x y",
        ];
        let mut tbl = [[0u8; 12]; 18];
        for m in 0..18u8 {
            for (s, &r) in rot_names.iter().enumerate() {
                let mut buf = [m];
                alg_rotation(&mut buf, r);
                tbl[m as usize][s] = buf[0];
            }
        }
        tbl
    })
}

// ---------- 解析字符串算法 ----------

/// 把 "R U R' U'" 解析为 Vec<Move>。无法识别的 token 跳过。
pub fn string_to_alg(s: &str) -> Vec<Move> {
    let mut out = Vec::new();
    for tok in s.split_whitespace() {
        if let Some(i) = MOVE_NAMES.iter().position(|&n| n == tok) {
            out.push(Move::from_index(i));
        }
    }
    out
}

// ---------- valid_moves (move pruning matrix) ----------

/// valid_moves[prev]: 给定上一步 move(20 = 18 + 2 sentinel:18 表示无上一步,
/// 但 C++ 是 0..=18,这里同样保留 20 槽 0..20 防越界,实际只填到 18)。
/// 返回 (flat, counts):flat[prev * 18 + i] = 第 i 个合法 move 索引,counts[prev] = 个数。
pub fn valid_moves() -> &'static ([[u8; 18]; 20], [u8; 20]) {
    static V: OnceLock<([[u8; 18]; 20], [u8; 20])> = OnceLock::new();
    V.get_or_init(|| {
        let mut flat = [[0u8; 18]; 20];
        let mut cnt = [0u8; 20];
        for prev in 0..=18i32 {
            let mut c = 0;
            for i in 0..18i32 {
                let bad = (prev < 18)
                    && (i / 3 == prev / 3
                        || ((i / 3) / 2 == (prev / 3) / 2
                            && (prev / 3) % 2 > (i / 3) % 2));
                if !bad {
                    flat[prev as usize][c] = i as u8;
                    c += 1;
                }
            }
            cnt[prev as usize] = c as u8;
        }
        (flat, cnt)
    })
}

// ---------- 移动表构造引擎 ----------

/// 逆操作映射表:inv[m] = m 的逆 move(数值上)。
pub const INV_MOVE: [u8; 18] = [
    2, 1, 0, 5, 4, 3, 8, 7, 6, 11, 10, 9, 14, 13, 12, 17, 16, 15,
];

/// 翻译自 C++ createMultiMoveTable。stride=18。
///
/// `basic_table`:单块基础移动表(genMTEdge / genMTCorn 等生成),
/// basic_table[18 * raw_state + m] = 新的 raw_state(含 ori)。
///
/// 返回大小 = size * 18,mt[i*18 + m] = 新 index。
pub fn create_multi_move_table(
    n: i32,
    c: i32,
    pn: i32,
    size: i32,
    basic_table: &[i32],
) -> Vec<i32> {
    let mut mt = vec![-1i32; (size * 18) as usize];
    let mut a = vec![0i32; n as usize];
    let mut b = vec![0i32; n as usize];
    for i in 0..size {
        index_to_array(&mut a, i, n, c, pn);
        let tmp_i = (i * 18) as usize;
        for j in 0..18 {
            if mt[tmp_i + j as usize] == -1 {
                for k in 0..n as usize {
                    b[k] = basic_table[(a[k] + j) as usize];
                }
                let tmp = array_to_index(&b, n, c, pn);
                mt[tmp_i + j as usize] = tmp;
                mt[(18 * tmp + INV_MOVE[j as usize] as i32) as usize] = i;
            }
        }
    }
    mt
}

/// 翻译自 C++ createMultiMoveTable2。stride=24,值预乘 24。
pub fn create_multi_move_table2(
    n: i32,
    c: i32,
    pn: i32,
    size: i32,
    basic_table: &[i32],
) -> Vec<i32> {
    let mut mt = vec![-1i32; (size * 24) as usize];
    let mut a = vec![0i32; n as usize];
    let mut b = vec![0i32; n as usize];
    for i in 0..size {
        index_to_array(&mut a, i, n, c, pn);
        let tmp_i = (i * 24) as usize;
        for j in 0..18 {
            if mt[tmp_i + j as usize] == -1 {
                for k in 0..n as usize {
                    b[k] = basic_table[(a[k] + j) as usize];
                }
                let tmp = 24 * array_to_index(&b, n, c, pn);
                mt[tmp_i + j as usize] = tmp;
                mt[(tmp + INV_MOVE[j as usize] as i32) as usize] = tmp_i as i32;
            }
        }
    }
    mt
}

// ---------- 文件 I/O ----------
//
// 表文件格式(Rust 端独立设计,不兼容 C++ .bin):
//   [0..8]   magic "CUBESLV1"
//   [8..12]  u32 LE entry_count
//   [12..]   entry_count * 4 字节 LE u32 数据
//
// 后续 phase(剪枝表 4-bit packed 等)可在此基础上扩展(magic 升版本或多 header 字段)。

pub const MAGIC: &[u8; 8] = b"CUBESLV1";

use std::fs::{self, File};
use std::io::{self, BufReader, BufWriter, Read, Write};
use std::path::Path;

#[derive(Debug)]
pub enum TableError {
    Io(io::Error),
    BadMagic,
    BadSize,
}

impl From<io::Error> for TableError {
    fn from(e: io::Error) -> Self {
        TableError::Io(e)
    }
}

impl std::fmt::Display for TableError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TableError::Io(e) => write!(f, "io: {}", e),
            TableError::BadMagic => write!(f, "bad magic (expected CUBESLV1)"),
            TableError::BadSize => write!(f, "file size mismatch"),
        }
    }
}

impl std::error::Error for TableError {}

pub fn write_table_le_u32<P: AsRef<Path>>(path: P, data: &[u32]) -> Result<(), TableError> {
    // Atomic write: 写到 .tmp 再 rename,避免中断留半截文件
    let final_path = path.as_ref();
    let tmp_path = final_path.with_extension("bin.tmp");
    {
        let f = File::create(&tmp_path)?;
        let mut w = BufWriter::new(f);
        w.write_all(MAGIC)?;
        let n = data.len() as u32;
        w.write_all(&n.to_le_bytes())?;
        for &x in data {
            w.write_all(&x.to_le_bytes())?;
        }
        w.flush()?;
    }
    fs::rename(&tmp_path, final_path)?;
    Ok(())
}

pub fn read_table_le_u32<P: AsRef<Path>>(path: P) -> Result<Vec<u32>, TableError> {
    let f = File::open(path)?;
    let meta = f.metadata()?;
    let mut r = BufReader::new(f);
    let mut magic = [0u8; 8];
    r.read_exact(&mut magic)?;
    if &magic != MAGIC {
        return Err(TableError::BadMagic);
    }
    let mut nb = [0u8; 4];
    r.read_exact(&mut nb)?;
    let n = u32::from_le_bytes(nb) as usize;
    let expected = 8 + 4 + n as u64 * 4;
    if meta.len() != expected {
        return Err(TableError::BadSize);
    }
    let mut out = vec![0u32; n];
    let mut buf = [0u8; 4];
    for slot in out.iter_mut() {
        r.read_exact(&mut buf)?;
        *slot = u32::from_le_bytes(buf);
    }
    Ok(out)
}

// ---------- 槽位关系判断 ----------

#[inline]
pub fn get_neighbor_view(s1: i32, s2: i32) -> i32 {
    if (s2 - s1 + 4) % 4 == 1 { return s1; }
    if (s1 - s2 + 4) % 4 == 1 { return s2; }
    -1
}

#[inline]
pub fn get_diagonal_view(s1: i32, s2: i32) -> i32 {
    let mn = s1.min(s2);
    let mx = s1.max(s2);
    if mn == 0 && mx == 2 { return 0; }
    if mn == 1 && mx == 3 { return 1; }
    -1
}

#[inline]
pub fn get_plus_table_idx(s_base: i32, s_target: i32) -> i32 {
    let diff = (s_target - s_base + 4) % 4;
    match diff {
        1 => 0,
        2 => 1,
        3 => 2,
        _ => -1,
    }
}

#[inline]
pub fn get_e2_type(e1: i32, e2: i32) -> i32 {
    let diff = (e2 - e1 + 4) & 3;
    if diff == 2 { 1 } else { 0 }
}

#[inline]
pub fn get_c2_type(c1: i32, c2: i32) -> i32 {
    let diff = (c2 - c1 + 4) & 3;
    if diff == 2 { 1 } else { 0 }
}

// ---------- 测试辅助:跨模块共享 env-lock ----------
//
// 多个模块的 #[cfg(test)] 都会 set_var("CUBE_TABLE_DIR"),为了避免并行测试相互覆盖
// 环境变量,统一用这个 Mutex(由 cargo test 默认多线程触发的)。

pub fn test_env_lock() -> &'static std::sync::Mutex<()> {
    static LOCK: OnceLock<std::sync::Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| std::sync::Mutex::new(()))
}

// ---------- 测试 ----------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn solved_state() {
        let s = State::solved();
        let (cp, co) = s.cp_co();
        let (ep, eo) = s.ep_eo();
        assert_eq!(cp, [0, 1, 2, 3, 4, 5, 6, 7]);
        assert_eq!(co, [0; 8]);
        assert_eq!(ep, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        assert_eq!(eo, [0; 12]);
    }

    #[test]
    fn move_count_18() {
        assert_eq!(Move::ALL.len(), 18);
        assert_eq!(MOVE_NAMES.len(), 18);
        for (i, m) in Move::ALL.iter().enumerate() {
            assert_eq!(m.index(), i);
        }
    }

    #[test]
    fn u_quad_identity() {
        let mut s = State::solved();
        for _ in 0..4 { s.apply(Move::U); }
        assert_eq!(s, State::solved());
    }

    #[test]
    fn l_quad_identity() {
        let mut s = State::solved();
        for _ in 0..4 { s.apply(Move::L); }
        assert_eq!(s, State::solved());
    }

    #[test]
    fn r_quad_identity() {
        let mut s = State::solved();
        for _ in 0..4 { s.apply(Move::R); }
        assert_eq!(s, State::solved());
    }

    #[test]
    fn d_f_b_quad_identity() {
        for m in [Move::D, Move::F, Move::B] {
            let mut s = State::solved();
            for _ in 0..4 { s.apply(m); }
            assert_eq!(s, State::solved(), "{:?} ^4 != id", m);
        }
    }

    #[test]
    fn u2_squared_identity() {
        let mut s = State::solved();
        s.apply(Move::U2);
        s.apply(Move::U2);
        assert_eq!(s, State::solved());
    }

    #[test]
    fn all_double_squared_identity() {
        for m in [Move::U2, Move::D2, Move::L2, Move::R2, Move::F2, Move::B2] {
            let mut s = State::solved();
            s.apply(m);
            s.apply(m);
            assert_eq!(s, State::solved(), "{:?}^2 != id", m);
        }
    }

    #[test]
    fn move_and_inverse() {
        let pairs = [
            (Move::U, Move::UPrime),
            (Move::D, Move::DPrime),
            (Move::L, Move::LPrime),
            (Move::R, Move::RPrime),
            (Move::F, Move::FPrime),
            (Move::B, Move::BPrime),
        ];
        for (a, b) in pairs {
            let mut s = State::solved();
            s.apply(a);
            s.apply(b);
            assert_eq!(s, State::solved(), "{:?} {:?} != id", a, b);
        }
    }

    #[test]
    fn inv_move_table_matches() {
        // INV_MOVE 编码与 Move 命名一致:
        // U(0) <-> U'(2),U2(1) 自逆,以此类推
        let expect = [
            (Move::U, Move::UPrime),
            (Move::U2, Move::U2),
            (Move::UPrime, Move::U),
            (Move::D, Move::DPrime),
            (Move::D2, Move::D2),
            (Move::DPrime, Move::D),
        ];
        for (m, inv) in expect {
            assert_eq!(INV_MOVE[m.index()] as usize, inv.index());
        }
    }

    // ---- 索引转换 ----

    #[test]
    fn orientation_roundtrip_edge() {
        // EO12: 2^11 = 2048 个 idx,每个 eo 长度 12,基数 2
        for idx in 0..2048i32 {
            let mut o = vec![0i32; 12];
            index_to_o(&mut o, idx, 2, 12);
            let back = o_to_index(&o, 2, 12);
            assert_eq!(back, idx, "EO roundtrip failed at {}", idx);
            // 校验"和为 0 mod 2"约束
            let sum: i32 = o.iter().sum();
            assert_eq!(sum % 2, 0);
        }
    }

    #[test]
    fn orientation_roundtrip_corner() {
        // CO: 3^7 = 2187 个 idx,长度 8,基数 3
        for idx in 0..2187i32 {
            let mut o = vec![0i32; 8];
            index_to_o(&mut o, idx, 3, 8);
            let back = o_to_index(&o, 3, 8);
            assert_eq!(back, idx);
            let sum: i32 = o.iter().sum();
            assert_eq!(sum % 3, 0);
        }
    }

    #[test]
    fn array_index_roundtrip_edge2() {
        // EDGE2: n=2, c=2, pn=12,size=528
        for idx in 0..state_space::EDGE2 as i32 {
            let mut p = vec![0i32; 2];
            index_to_array(&mut p, idx, 2, 2, 12);
            // p[i] 在 C++ 中被乘以 18,这里反推:还原成原始 raw 值
            let raw: Vec<i32> = p.iter().map(|&v| v / 18).collect();
            let back = array_to_index(&raw, 2, 2, 12);
            assert_eq!(back, idx, "EDGE2 roundtrip failed at {}", idx);
        }
    }

    #[test]
    fn array_index_roundtrip_corner2() {
        // CORNER2: n=2, c=3, pn=8
        for idx in 0..state_space::CORNER2 as i32 {
            let mut p = vec![0i32; 2];
            index_to_array(&mut p, idx, 2, 3, 8);
            let raw: Vec<i32> = p.iter().map(|&v| v / 18).collect();
            let back = array_to_index(&raw, 2, 3, 8);
            assert_eq!(back, idx, "CORNER2 roundtrip failed at {}", idx);
        }
    }

    #[test]
    fn array_index_roundtrip_cross() {
        // CROSS: n=4, c=2, pn=12, size=190080
        for idx in (0..state_space::CROSS as i32).step_by(37) {
            let mut p = vec![0i32; 4];
            index_to_array(&mut p, idx, 4, 2, 12);
            let raw: Vec<i32> = p.iter().map(|&v| v / 18).collect();
            let back = array_to_index(&raw, 4, 2, 12);
            assert_eq!(back, idx);
        }
    }

    // ---- 旋转/共轭 ----

    #[test]
    fn rot_map_identity_at_k0() {
        let rm = rot_map();
        for m in 0..18u8 {
            assert_eq!(rm[0][m as usize], m);
        }
    }

    #[test]
    fn rot_map_y4_identity() {
        // 4 次 y rotation = id;rot_map[1] 是 y,迭代 4 次应回到原 move
        let rm = rot_map();
        for m in 0..18u8 {
            let mut x = m;
            for _ in 0..4 {
                x = rm[1][x as usize];
            }
            assert_eq!(x, m);
        }
    }

    #[test]
    fn conj_self_at_slot_0() {
        // slot 0 应是恒等共轭
        let cj = conj_moves_flat();
        for m in 0..18u8 {
            assert_eq!(cj[m as usize][0], m);
        }
    }

    #[test]
    fn conj_preserves_move_type_pow() {
        // 共轭后,move 的 power(0/1/2)应保持不变(只改变 face type)
        let cj = conj_moves_flat();
        for m in 0..18u8 {
            for k in 0..4 {
                assert_eq!(cj[m as usize][k] % 3, m % 3);
            }
        }
    }

    #[test]
    fn sym_self_at_slot_0() {
        // 第 0 个 rot_name 是空字符串 -> identity
        let sm = sym_moves_flat();
        for m in 0..18u8 {
            assert_eq!(sm[m as usize][0], m);
        }
    }

    #[test]
    fn sym_preserves_power() {
        let sm = sym_moves_flat();
        for m in 0..18u8 {
            for s in 0..12 {
                assert_eq!(sm[m as usize][s] % 3, m % 3);
            }
        }
    }

    // ---- valid_moves ----

    #[test]
    fn valid_moves_initial_is_18() {
        // prev == 18 表示"无上一步",此时全部 18 个 move 都合法
        let (_, cnt) = valid_moves();
        assert_eq!(cnt[18], 18);
    }

    #[test]
    fn valid_moves_after_u_excludes_u_axis() {
        // 上一步是 U(0):同轴(U/U2/U' = 0..3)及同对立轴更高优先级都被禁止
        // C++ 规则:bad if i/3 == prev/3 OR (i/3/2 == prev/3/2 AND prev/3%2 > i/3%2)
        // prev=0 -> face=U(type 0),禁掉 U/U2/U' 自己(face 0)。
        // D 是 face 1,(0/2==1/2 即 0==0) 且 (0%2=0) > (1%2=1) 不成立,所以 D 允许。
        let (flat, cnt) = valid_moves();
        let n = cnt[0] as usize;
        let allowed: Vec<u8> = flat[0][..n].to_vec();
        for &m in &allowed {
            assert_ne!(m / 3, 0, "U-axis move allowed after U");
        }
    }

    // ---- 字符串解析 ----

    #[test]
    fn string_to_alg_basic() {
        let a = string_to_alg("R U R' U'");
        assert_eq!(a, vec![Move::R, Move::U, Move::RPrime, Move::UPrime]);
    }

    #[test]
    fn sexy_move_six_times_identity() {
        // (R U R' U')^6 = id,经典恒等式
        let alg = string_to_alg("R U R' U'");
        let mut s = State::solved();
        for _ in 0..6 {
            for &m in &alg {
                s.apply(m);
            }
        }
        assert_eq!(s, State::solved());
    }

    // ---- 文件 I/O ----

    #[test]
    fn table_io_roundtrip() {
        use std::env::temp_dir;
        let dir = temp_dir();
        let path = dir.join("cube_solver_test_table.bin");
        let data: Vec<u32> = (0u32..1000).map(|x| x.wrapping_mul(2654435761)).collect();
        write_table_le_u32(&path, &data).expect("write");
        let back = read_table_le_u32(&path).expect("read");
        assert_eq!(data, back);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn table_io_bad_magic() {
        use std::env::temp_dir;
        let path = temp_dir().join("cube_solver_test_bad.bin");
        std::fs::write(&path, b"XXXXXXXX\x00\x00\x00\x00").unwrap();
        let r = read_table_le_u32(&path);
        assert!(matches!(r, Err(TableError::BadMagic)));
        let _ = std::fs::remove_file(&path);
    }
}
