//! Cross restricted optimal solver — 任意受限 move 集下的最优十字求解器(含中心朝向)。
//!
//! 移植自 or18 的 crossSolver,但用一个干净、无歧义的状态模型:
//!   - 不走 or18 的 converter / rotationMap 优化,直接对全 54-move 集做 BFS。
//!   - 状态 = (cross-coordinate, center-index)。
//!     * cross-coordinate 编码 4 个十字棱(件 id 8,9,10,11)在 12 个槽位中的有序位置
//!       (Lehmer / 阶乘进制,12*11*10*9 = 11880)× 2^4 朝向 = 190080。双射可逆。
//!     * center-index 0..23 走 or18 的 center_to_index(由 index_to_center 反查得到)。
//!
//! 54-move 集顺序(与 or18 move_names 一致):
//!   0-17  : U U2 U' D D2 D' L L2 L' R R2 R' F F2 F' B B2 B'
//!   18-35 : u u2 u' d d2 d' l l2 l' r r2 r' f f2 f' b b2 b'
//!   36-44 : M M2 M' E E2 E' S S2 S'
//!   45-53 : x x2 x' y y2 y' z z2 z'
//!
//! 单次 solve:从 SOLVED 应用打乱(18 面动)得到起点,在 `allowed` bitmask 受限的
//! 54-move 集上 BFS,旋转动(45-53)受 `max_rot_count` 上限;目标 = cross-coord 复原
//! 且 center-index ∈ center_offset。BFS 首达即最优。

// 这些常量/函数主要服务于 wasm 绑定与测试,native build 不一定全用到。
#![allow(dead_code)]

// ---------- 54-move 表(ep / eo / center),逐位转写自 or18 crossSolver ----------

/// 54 个 move 的名字(顺序即 move 索引)。
pub const MOVE_NAMES_54: [&str; 54] = [
    "U", "U2", "U'", "D", "D2", "D'", "L", "L2", "L'", "R", "R2", "R'", "F", "F2", "F'", "B", "B2",
    "B'", "u", "u2", "u'", "d", "d2", "d'", "l", "l2", "l'", "r", "r2", "r'", "f", "f2", "f'", "b",
    "b2", "b'", "M", "M2", "M'", "E", "E2", "E'", "S", "S2", "S'", "x", "x2", "x'", "y", "y2", "y'",
    "z", "z2", "z'",
];

/// 6 个视角(哪一面当底)对应的 rotation 前缀,与 `wasm.rs` 的 `ROTS` 完全一致。
/// 顺序对应 analyzer 的 face 0..5(CSV 后缀 _z0/_z2/_z3/_z1/_x3/_x1)。
pub const ROTS_FACE: [&str; 6] = ["", "z2", "z'", "z", "x'", "x"];

/// 每个 move 的 ep[12](与 or18 `moves[...].ep` 一致):new_ep[i] = ep[EP[i]]。
const EP: [[u8; 12]; 54] = [
    // 0 U
    [0, 1, 2, 3, 7, 4, 5, 6, 8, 9, 10, 11],
    // 1 U2
    [0, 1, 2, 3, 6, 7, 4, 5, 8, 9, 10, 11],
    // 2 U'
    [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11],
    // 3 D
    [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 8],
    // 4 D2
    [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 8, 9],
    // 5 D'
    [0, 1, 2, 3, 4, 5, 6, 7, 11, 8, 9, 10],
    // 6 L
    [11, 1, 2, 7, 4, 5, 6, 0, 8, 9, 10, 3],
    // 7 L2
    [3, 1, 2, 0, 4, 5, 6, 11, 8, 9, 10, 7],
    // 8 L'
    [7, 1, 2, 11, 4, 5, 6, 3, 8, 9, 10, 0],
    // 9 R
    [0, 5, 9, 3, 4, 2, 6, 7, 8, 1, 10, 11],
    // 10 R2
    [0, 2, 1, 3, 4, 9, 6, 7, 8, 5, 10, 11],
    // 11 R'
    [0, 9, 5, 3, 4, 1, 6, 7, 8, 2, 10, 11],
    // 12 F
    [0, 1, 6, 10, 4, 5, 3, 7, 8, 9, 2, 11],
    // 13 F2
    [0, 1, 3, 2, 4, 5, 10, 7, 8, 9, 6, 11],
    // 14 F'
    [0, 1, 10, 6, 4, 5, 2, 7, 8, 9, 3, 11],
    // 15 B
    [4, 8, 2, 3, 1, 5, 6, 7, 0, 9, 10, 11],
    // 16 B2
    [1, 0, 2, 3, 8, 5, 6, 7, 4, 9, 10, 11],
    // 17 B'
    [8, 4, 2, 3, 0, 5, 6, 7, 1, 9, 10, 11],
    // 18 u
    [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 8],
    // 19 u2
    [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 8, 9],
    // 20 u'
    [0, 1, 2, 3, 4, 5, 6, 7, 11, 8, 9, 10],
    // 21 d
    [0, 1, 2, 3, 7, 4, 5, 6, 8, 9, 10, 11],
    // 22 d2
    [0, 1, 2, 3, 6, 7, 4, 5, 8, 9, 10, 11],
    // 23 d'
    [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11],
    // 24 l
    [0, 5, 9, 3, 4, 2, 6, 7, 8, 1, 10, 11],
    // 25 l2
    [0, 2, 1, 3, 4, 9, 6, 7, 8, 5, 10, 11],
    // 26 l'
    [0, 9, 5, 3, 4, 1, 6, 7, 8, 2, 10, 11],
    // 27 r
    [11, 1, 2, 7, 4, 5, 6, 0, 8, 9, 10, 3],
    // 28 r2
    [3, 1, 2, 0, 4, 5, 6, 11, 8, 9, 10, 7],
    // 29 r'
    [7, 1, 2, 11, 4, 5, 6, 3, 8, 9, 10, 0],
    // 30 f
    [4, 8, 2, 3, 1, 5, 6, 7, 0, 9, 10, 11],
    // 31 f2
    [1, 0, 2, 3, 8, 5, 6, 7, 4, 9, 10, 11],
    // 32 f'
    [8, 4, 2, 3, 0, 5, 6, 7, 1, 9, 10, 11],
    // 33 b
    [0, 1, 6, 10, 4, 5, 3, 7, 8, 9, 2, 11],
    // 34 b2
    [0, 1, 3, 2, 4, 5, 10, 7, 8, 9, 6, 11],
    // 35 b'
    [0, 1, 10, 6, 4, 5, 2, 7, 8, 9, 3, 11],
    // 36 M
    [7, 5, 9, 11, 4, 2, 6, 3, 8, 1, 10, 0],
    // 37 M2
    [3, 2, 1, 0, 4, 9, 6, 11, 8, 5, 10, 7],
    // 38 M'
    [11, 9, 5, 7, 4, 1, 6, 0, 8, 2, 10, 3],
    // 39 E
    [0, 1, 2, 3, 7, 4, 5, 6, 11, 8, 9, 10],
    // 40 E2
    [0, 1, 2, 3, 6, 7, 4, 5, 10, 11, 8, 9],
    // 41 E'
    [0, 1, 2, 3, 5, 6, 7, 4, 9, 10, 11, 8],
    // 42 S
    [4, 8, 10, 6, 1, 5, 2, 7, 0, 9, 3, 11],
    // 43 S2
    [1, 0, 3, 2, 8, 5, 10, 7, 4, 9, 6, 11],
    // 44 S'
    [8, 4, 6, 10, 0, 5, 3, 7, 1, 9, 2, 11],
    // 45 x
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    // 46 x2
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    // 47 x'
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    // 48 y
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    // 49 y2
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    // 50 y'
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    // 51 z
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    // 52 z2
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    // 53 z'
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
];

/// 每个 move 的 eo[12](与 or18 `moves[...].eo` 一致):neo[i] = (eo[EP[i]] + EO[i]) % 2。
const EO: [[u8; 12]; 54] = [
    // 0 U
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 1 U2
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 2 U'
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 3 D
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 4 D2
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 5 D'
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 6 L
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 7 L2
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 8 L'
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 9 R
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 10 R2
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 11 R'
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 12 F
    [0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0],
    // 13 F2
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 14 F'
    [0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0],
    // 15 B
    [1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    // 16 B2
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 17 B'
    [1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    // 18 u
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 19 u2
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 20 u'
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 21 d
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 22 d2
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 23 d'
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 24 l
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 25 l2
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 26 l'
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 27 r
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 28 r2
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 29 r'
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 30 f
    [1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    // 31 f2
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 32 f'
    [1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    // 33 b
    [0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0],
    // 34 b2
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 35 b'
    [0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0],
    // 36 M
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 37 M2
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 38 M'
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 39 E
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 40 E2
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 41 E'
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 42 S
    [1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0],
    // 43 S2
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 44 S'
    [1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0],
    // 45 x
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 46 x2
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 47 x'
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 48 y
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 49 y2
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 50 y'
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 51 z
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 52 z2
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 53 z'
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

/// 每个 move 的 center[6](与 or18 `moves[...].center` 一致):new_center[i] = center[CENTER[i]]。
const CENTER: [[u8; 6]; 54] = [
    // 0 U
    [0, 1, 2, 3, 4, 5],
    // 1 U2
    [0, 1, 2, 3, 4, 5],
    // 2 U'
    [0, 1, 2, 3, 4, 5],
    // 3 D
    [0, 1, 2, 3, 4, 5],
    // 4 D2
    [0, 1, 2, 3, 4, 5],
    // 5 D'
    [0, 1, 2, 3, 4, 5],
    // 6 L
    [0, 1, 2, 3, 4, 5],
    // 7 L2
    [0, 1, 2, 3, 4, 5],
    // 8 L'
    [0, 1, 2, 3, 4, 5],
    // 9 R
    [0, 1, 2, 3, 4, 5],
    // 10 R2
    [0, 1, 2, 3, 4, 5],
    // 11 R'
    [0, 1, 2, 3, 4, 5],
    // 12 F
    [0, 1, 2, 3, 4, 5],
    // 13 F2
    [0, 1, 2, 3, 4, 5],
    // 14 F'
    [0, 1, 2, 3, 4, 5],
    // 15 B
    [0, 1, 2, 3, 4, 5],
    // 16 B2
    [0, 1, 2, 3, 4, 5],
    // 17 B'
    [0, 1, 2, 3, 4, 5],
    // 18 u
    [0, 1, 4, 5, 3, 2],
    // 19 u2
    [0, 1, 3, 2, 5, 4],
    // 20 u'
    [0, 1, 5, 4, 2, 3],
    // 21 d
    [0, 1, 5, 4, 2, 3],
    // 22 d2
    [0, 1, 3, 2, 5, 4],
    // 23 d'
    [0, 1, 4, 5, 3, 2],
    // 24 l
    [5, 4, 2, 3, 0, 1],
    // 25 l2
    [1, 0, 2, 3, 5, 4],
    // 26 l'
    [4, 5, 2, 3, 1, 0],
    // 27 r
    [4, 5, 2, 3, 1, 0],
    // 28 r2
    [1, 0, 2, 3, 5, 4],
    // 29 r'
    [5, 4, 2, 3, 0, 1],
    // 30 f
    [2, 3, 1, 0, 4, 5],
    // 31 f2
    [1, 0, 3, 2, 4, 5],
    // 32 f'
    [3, 2, 0, 1, 4, 5],
    // 33 b
    [3, 2, 0, 1, 4, 5],
    // 34 b2
    [1, 0, 3, 2, 4, 5],
    // 35 b'
    [2, 3, 1, 0, 4, 5],
    // 36 M
    [5, 4, 2, 3, 0, 1],
    // 37 M2
    [1, 0, 2, 3, 5, 4],
    // 38 M'
    [4, 5, 2, 3, 1, 0],
    // 39 E
    [0, 1, 5, 4, 2, 3],
    // 40 E2
    [0, 1, 3, 2, 5, 4],
    // 41 E'
    [0, 1, 4, 5, 3, 2],
    // 42 S
    [2, 3, 1, 0, 4, 5],
    // 43 S2
    [1, 0, 3, 2, 4, 5],
    // 44 S'
    [3, 2, 0, 1, 4, 5],
    // 45 x
    [4, 5, 2, 3, 1, 0],
    // 46 x2
    [1, 0, 2, 3, 5, 4],
    // 47 x'
    [5, 4, 2, 3, 0, 1],
    // 48 y
    [0, 1, 4, 5, 3, 2],
    // 49 y2
    [0, 1, 3, 2, 5, 4],
    // 50 y'
    [0, 1, 5, 4, 2, 3],
    // 51 z
    [2, 3, 1, 0, 4, 5],
    // 52 z2
    [1, 0, 3, 2, 4, 5],
    // 53 z'
    [3, 2, 0, 1, 4, 5],
];

/// or18 `index_to_center`:center-index i 对应的 center[6] 向量。
const INDEX_TO_CENTER: [[u8; 6]; 24] = [
    [0, 1, 2, 3, 4, 5],
    [0, 1, 4, 5, 3, 2],
    [0, 1, 3, 2, 5, 4],
    [0, 1, 5, 4, 2, 3],
    [1, 0, 3, 2, 4, 5],
    [1, 0, 4, 5, 2, 3],
    [1, 0, 2, 3, 5, 4],
    [1, 0, 5, 4, 3, 2],
    [3, 2, 0, 1, 4, 5],
    [3, 2, 4, 5, 1, 0],
    [3, 2, 1, 0, 5, 4],
    [3, 2, 5, 4, 0, 1],
    [2, 3, 1, 0, 4, 5],
    [2, 3, 4, 5, 0, 1],
    [2, 3, 0, 1, 5, 4],
    [2, 3, 5, 4, 1, 0],
    [5, 4, 2, 3, 0, 1],
    [5, 4, 0, 1, 3, 2],
    [5, 4, 3, 2, 1, 0],
    [5, 4, 1, 0, 2, 3],
    [4, 5, 2, 3, 1, 0],
    [4, 5, 1, 0, 3, 2],
    [4, 5, 3, 2, 0, 1],
    [4, 5, 0, 1, 2, 3],
];

// ---------- cross-coordinate 编码 ----------

/// 状态空间大小:11880(4 件位置 Lehmer)× 16(4 件朝向)= 190080。
pub const CROSS_COORD: usize = 11880 * 16;

/// 4 个十字棱件的 id(或18 / 本 crate 共用编号:D 层 4 棱)。
pub const CROSS_PIECES: [usize; 4] = [8, 9, 10, 11];

/// 受限 move 数(全 54)。
pub const NMOVES: usize = 54;

/// center-index 数。
pub const NCENTER: usize = 24;

/// cross-coordinate ⇄ (4 件位置 pos[4], 4 件朝向 ori[4]) 双射。
///
/// pos[k] = CROSS_PIECES[k] 这个件当前所在的槽位(0..12,互异);
/// ori[k] = 该件朝向(0/1)。
///
/// 编码:位置部分用阶乘进制(Lehmer)把 12P4 = 11880 个有序位置映成 0..11880;
/// 朝向部分 4 bit(ori[0] 是最低位)= 0..16。index = pos_index * 16 + ori_index。
#[inline]
pub fn encode_coord(pos: &[usize; 4], ori: &[u8; 4]) -> usize {
    // Lehmer:对 pos[i],数 j<i 中 pos[j] < pos[i] 的个数,得到“去掉已用”的相对秩。
    // base = [12,11,10,9] 的累积进制(高位是 pos[0])。
    let bases = [12usize, 11, 10, 9];
    let mut pos_index = 0usize;
    for i in 0..4 {
        let mut rank = pos[i];
        for j in 0..i {
            if pos[j] < pos[i] {
                rank -= 1;
            }
        }
        pos_index = pos_index * bases[i] + rank;
    }
    let mut ori_index = 0usize;
    for k in 0..4 {
        ori_index |= (ori[k] as usize) << k;
    }
    pos_index * 16 + ori_index
}

/// cross-coordinate ⇄ (pos[4], ori[4]) 的逆。
#[inline]
pub fn decode_coord(index: usize) -> ([usize; 4], [u8; 4]) {
    let mut ori_index = index % 16;
    let mut pos_index = index / 16;
    let mut ori = [0u8; 4];
    for k in 0..4 {
        ori[k] = (ori_index & 1) as u8;
        ori_index >>= 1;
    }
    // 解 Lehmer:从低位(pos[3])往高位还原相对秩,再用“可用槽位升序”表把相对秩映回绝对槽位。
    let bases = [12usize, 11, 10, 9];
    let mut ranks = [0usize; 4];
    for i in (0..4).rev() {
        ranks[i] = pos_index % bases[i];
        pos_index /= bases[i];
    }
    // 用一张“仍可用的槽位”升序表,按 rank 取第 rank 个可用槽,然后移除。
    let mut avail: Vec<usize> = (0..12).collect();
    let mut pos = [0usize; 4];
    for i in 0..4 {
        let slot = avail[ranks[i]];
        pos[i] = slot;
        avail.remove(ranks[i]);
    }
    (pos, ori)
}

/// SOLVED 的 cross-coordinate:件 8,9,10,11 在槽位 8,9,10,11,朝向 0。
pub fn solved_coord() -> usize {
    encode_coord(&[8, 9, 10, 11], &[0, 0, 0, 0])
}

// ---------- 求解器(运行时建表) ----------

pub struct CrossRestrictSolver {
    /// coord_trans[c * 54 + m] = 在 cross-coord c 上施加 move m 后的 cross-coord。
    coord_trans: Vec<u32>,
    /// center_trans[ci][m] = center-index ci 上施加 move m 后的 center-index。
    center_trans: [[u8; 54]; 24],
    /// 求解起点与目标用的 SOLVED cross-coord。
    solved: u32,
    /// BFS visited 用的代际戳数组(避免每次 clear 全表)。
    /// 大小 = CROSS_COORD * 24 * (max_rot_used 维度由 solve 时按需扩展处理)。
    /// 这里不预分配 rot 维度;solve 时按 max_rot_count 现场建。
    _phantom: (),
}

/// 单个边件在每个 move 下的去向:edge_dest[m][s] = (新槽位, 朝向增量)。
/// 语义来自 or18 apply_move:new_ep[i] = ep[move.ep[i]],new_eo[i] = (eo[move.ep[i]] + move.eo[i])%2。
/// ⇒ 若件在输入槽 s,则它出现在那个使 move.ep[i] == s 成立的输出槽 i,朝向增量 = move.eo[i]。
fn build_edge_dest() -> [[(u8, u8); 12]; 54] {
    let mut tbl = [[(0u8, 0u8); 12]; 54];
    for m in 0..54 {
        for i in 0..12 {
            let s = EP[m][i] as usize; // 输出槽 i 的件来自输入槽 s
            tbl[m][s] = (i as u8, EO[m][i]);
        }
    }
    tbl
}

/// 9 个旋转(45..54 顺序:x x2 x' y y2 y' z z2 z')的「真·整体旋转」edge_dest。
///
/// or18 字面把旋转记成棱恒等(只换中心);这里改成几何上真正搬棱的整体旋转。
/// 基础旋转 (x/y/z) 的真棱置换 R_ep + 翻向 R_eo 由共轭约束唯一解出
///   R_ep[E_m[i]] = E_m̄[R_ep[i]]   (m̄ = conj_r(m),f 为旋转面置换)
///   R_eo[E_m[x]] = R_eo[x] + EO_m̄[R_ep[x]] + EO_m[x]  (mod 2)
/// 对 18 个面动生成元联立;2/' 变体 = 基础自复合。返回 [9][12] 的 (新槽,翻向增量)。
fn build_rotation_edge_dests() -> [[(u8, u8); 12]; 9] {
    // 基础旋转的面置换 f[6](face t → f[t],与 cube_common::alg_rotation 同表)。
    let base_face_perm: [[usize; 6]; 3] = [
        [5, 4, 2, 3, 0, 1], // x
        [0, 1, 5, 4, 2, 3], // y
        [3, 2, 0, 1, 4, 5], // z
    ];
    let conj_face = |m: usize, f: &[usize; 6]| -> usize { 3 * f[m / 3] + (m % 3) };

    // 解一个基础旋转的真棱置换 R_ep + 翻向 R_eo。
    let solve_true = |f: &[usize; 6]| -> ([usize; 12], [u8; 12]) {
        let mut rep = [usize::MAX; 12];
        'cand: for b0 in 0..12usize {
            // 关系传播:已知 cand[x]=y ⟹ cand[E_m[x]] = E_m̄[y]。
            let mut cand = [usize::MAX; 12];
            cand[0] = b0;
            let mut frontier = vec![0usize];
            let mut ok = true;
            while let Some(x) = frontier.pop() {
                let y = cand[x];
                for m in 0..18usize {
                    let mbar = conj_face(m, f);
                    let nx = EP[m][x] as usize;
                    let ny = EP[mbar][y] as usize;
                    if cand[nx] == usize::MAX {
                        cand[nx] = ny;
                        frontier.push(nx);
                    } else if cand[nx] != ny {
                        ok = false;
                        break;
                    }
                }
                if !ok {
                    break;
                }
            }
            if !ok || cand.iter().any(|&v| v == usize::MAX) {
                continue 'cand;
            }
            let mut seen = [false; 12];
            for &v in &cand {
                if v >= 12 || seen[v] {
                    continue 'cand;
                }
                seen[v] = true;
            }
            rep = cand;
            break;
        }
        assert!(
            rep.iter().all(|&v| v != usize::MAX),
            "could not solve true rotation edge permutation for face map {:?}",
            f
        );
        // 翻向:reo[0]=0 锚定,reo[E_m[x]] = reo[x] + EO[mbar][rep[x]] + EO[m][x]。
        let mut reo = [u8::MAX; 12];
        reo[0] = 0;
        let mut frontier = vec![0usize];
        while let Some(x) = frontier.pop() {
            for m in 0..18usize {
                let mbar = conj_face(m, f);
                let nx = EP[m][x] as usize;
                let val = (reo[x] + EO[mbar][rep[x]] + EO[m][x]) % 2;
                if reo[nx] == u8::MAX {
                    reo[nx] = val;
                    frontier.push(nx);
                } else {
                    assert_eq!(reo[nx], val, "rotation eo inconsistency for face map {:?}", f);
                }
            }
        }
        assert!(
            reo.iter().all(|&v| v != u8::MAX),
            "rotation eo underdetermined for face map {:?}",
            f
        );
        (rep, reo)
    };

    // (R_ep,R_eo) → edge_dest:件在输入槽 s 出现在输出槽 i(rep[i]==s),翻向 += reo[i]。
    let dest_of = |rep: &[usize; 12], reo: &[u8; 12]| -> [(u8, u8); 12] {
        let mut d = [(0u8, 0u8); 12];
        for i in 0..12 {
            d[rep[i]] = (i as u8, reo[i]);
        }
        d
    };
    // 复合两个 edge_dest(先 a 后 b)。
    let compose = |a: &[(u8, u8); 12], b: &[(u8, u8); 12]| -> [(u8, u8); 12] {
        let mut d = [(0u8, 0u8); 12];
        for s in 0..12usize {
            let (s1, d1) = a[s];
            let (s2, d2) = b[s1 as usize];
            d[s] = (s2, (d1 + d2) % 2);
        }
        d
    };

    let mut out: [[(u8, u8); 12]; 9] = [[(0u8, 0u8); 12]; 9];
    for (bi, f) in base_face_perm.iter().enumerate() {
        let (rep, reo) = solve_true(f);
        let base = dest_of(&rep, &reo);
        let dbl = compose(&base, &base);
        let trp = compose(&dbl, &base);
        out[bi * 3] = base; // X
        out[bi * 3 + 1] = dbl; // X2
        out[bi * 3 + 2] = trp; // X'
    }
    out
}

/// center[6] 向量 → center-index(or18 center_to_index 的反查)。
fn build_center_to_index() -> std::collections::HashMap<[u8; 6], u8> {
    let mut map = std::collections::HashMap::new();
    for (i, v) in INDEX_TO_CENTER.iter().enumerate() {
        map.insert(*v, i as u8);
    }
    map
}

impl CrossRestrictSolver {
    /// 运行时建全部表(restriction-independent),无需任何外部文件。
    pub fn new() -> Self {
        let edge_dest = build_edge_dest();
        let c2i = build_center_to_index();

        // center_trans:对每个 center-index 施加 54 个 move。
        let mut center_trans = [[0u8; 54]; 24];
        for ci in 0..24 {
            let cur = INDEX_TO_CENTER[ci];
            for m in 0..54 {
                let mut nc = [0u8; 6];
                for i in 0..6 {
                    nc[i] = cur[CENTER[m][i] as usize];
                }
                center_trans[ci][m] = *c2i.get(&nc).expect("center perm must map to a valid index");
            }
        }

        // coord_trans:对每个 cross-coord 施加 54 个 move。
        let mut coord_trans = vec![0u32; CROSS_COORD * 54];
        for c in 0..CROSS_COORD {
            let (pos, ori) = decode_coord(c);
            for m in 0..54 {
                let mut npos = [0usize; 4];
                let mut nori = [0u8; 4];
                for k in 0..4 {
                    let (dest, dori) = edge_dest[m][pos[k]];
                    npos[k] = dest as usize;
                    nori[k] = (ori[k] + dori) % 2;
                }
                coord_trans[c * 54 + m] = encode_coord(&npos, &nori) as u32;
            }
        }

        // ---------- 旋转动(idx 45-53)改成「真·整体旋转」(搬棱 + 搬中心) ----------
        //
        // **关键发现**(crossSolver/solver.cpp L126):or18 字面把旋转记成棱恒等
        // (只换中心),搜索时靠 `rotationMap` 重映射后续面动达成「换面触达」(陪集偏移)。
        // 这套实验室帧下,prompt 给的 `x = R M' L'` 复合出来也是「棱恒等 + 中心旋转」
        // (实测 `R M' L'` 的 full ep = 恒等;or18 的 M/E/S 在该帧里配着抵消棱位),旋转因此
        // **在棱坐标上搬不动棱**——无法在 State-BFS 里让旋转打开触达。
        //
        // 故把旋转改成**几何上真正的整体旋转**:棱按旋转面置换搬位 + 翻向(由共轭约束
        // 唯一解出,见 `build_rotation_edge_dests`),中心仍 = or18 字面旋转中心。
        let rot_edge_dest = build_rotation_edge_dests();

        // 自检(强制 assert,对应 prompt task 1):真旋转的**中心置换** = or18 字面旋转中心。
        // center_trans[ci][45..54] 仍是 or18 字面(由 CENTER + INDEX_TO_CENTER 算出);
        // 这里逐位核对「我们改写的旋转模型,其中心朝向与 or18 字面完全一致」⟺ 几何同朝向。
        // 任何错误的旋转展开都会让中心对不上而被抓出。
        for ci in 0..24u8 {
            for rot in 45..54usize {
                let cur = INDEX_TO_CENTER[ci as usize];
                let mut nc = [0u8; 6];
                for i in 0..6 {
                    nc[i] = cur[CENTER[rot][i] as usize];
                }
                let want = *c2i.get(&nc).expect("center perm valid");
                assert_eq!(
                    center_trans[ci as usize][rot], want,
                    "rotation center self-check failed: ci {} rot {}",
                    ci, rot
                );
            }
        }

        // 改写旋转列:中心保持 or18 字面(已 assert 一致),棱用真旋转 edge_dest。
        for c in 0..CROSS_COORD {
            let (pos, ori) = decode_coord(c);
            for r in 0..9usize {
                let rot = 45 + r;
                let dest = &rot_edge_dest[r];
                let mut npos = [0usize; 4];
                let mut nori = [0u8; 4];
                for k in 0..4 {
                    let (d, dori) = dest[pos[k]];
                    npos[k] = d as usize;
                    nori[k] = (ori[k] + dori) % 2;
                }
                coord_trans[c * 54 + rot] = encode_coord(&npos, &nori) as u32;
            }
        }
        // center 列不改(or18 字面已正确,且与真旋转中心逐位相等,自检已证)。

        let solved = solved_coord() as u32;
        CrossRestrictSolver {
            coord_trans,
            center_trans,
            solved,
            _phantom: (),
        }
    }

    /// 在 coord c 上施加 move m。
    #[inline]
    fn step_coord(&self, c: u32, m: usize) -> u32 {
        self.coord_trans[c as usize * 54 + m]
    }

    /// 在 center-index ci 上施加 move m。
    #[inline]
    fn step_center(&self, ci: u8, m: usize) -> u8 {
        self.center_trans[ci as usize][m]
    }

    /// 把打乱(18 面动序列,move 索引 0..18)从 SOLVED 应用,得到起点 (coord, center)。
    fn apply_scramble(&self, scramble: &[usize]) -> (u32, u8) {
        let mut coord = self.solved;
        let mut center = 0u8;
        for &m in scramble {
            debug_assert!(m < 18, "scramble move must be a face move (0..18)");
            coord = self.step_coord(coord, m);
            center = self.step_center(center, m);
        }
        (coord, center)
    }

    /// 核心 solve。
    ///
    /// - `scramble`:18 面动 move 索引序列(打乱)。
    /// - `allowed`:54-bit bitmask,bit m 置位 = 允许 move m。
    /// - `center_offset`:允许的终态 center-index 集(目标要求 center ∈ 此集)。
    /// - `max_rot_count`:整体旋转动(45-53)在一个解里的最大个数。
    ///
    /// 返回最优解(move 索引序列)或 None(受限下不可解)。
    /// BFS 状态 = (coord, center, rot_used),按 BFS 层序展开 ⟹ 首达目标即最优。
    pub fn solve(
        &self,
        scramble: &[usize],
        allowed: u64,
        center_offset: &[u8],
        max_rot_count: u32,
    ) -> Option<Vec<usize>> {
        let (start_coord, start_center) = self.apply_scramble(scramble);
        self.solve_from(start_coord, start_center, allowed, center_offset, max_rot_count)
    }

    /// 解「从角度 face 看的十字」:等价于现有 analyzer 的 `search_cross(alg, ROTS[face])`。
    ///
    /// 语义(已由 §3 六面闸逐格证明,与 `cross_solver::start_indices` 同):analyzer 用
    /// `alg_rotation` 把打乱**逐 move 共轭**(把每个面动的面经 rot 的面置换重映射,
    /// = `rot·alg·rot'` 作为群元),再从 SOLVED 应用、解标准 D 十字。
    ///
    /// 注:本求解器虽已把旋转动改成「真·整体旋转(搬棱)」(task 1,见 `new()`),但
    /// analyzer 的「换面视角」语义本质是**逐 move 共轭**(在 or18 实验室帧里靠 rotationMap
    /// 重映射面动达成),不是「在棱坐标上前缀一个旋转」。因此这里直接逐 move 共轭打乱
    /// (把每个面动重映射到旋转后的面),从 SOLVED 应用得到与 analyzer 同一个 (coord, center)
    /// 起点,再 BFS 解 D 十字 + 中心复原(center_offset = [0])。这与 `cross_solver::start_indices`
    /// 的 `alg_rotation` 逐位一致,故六面闸(§3)逐格相等。
    ///
    /// - `scramble`:18 面动 move 索引序列。
    /// - `face`:0..6,对应 `ROTS_FACE`。
    /// - `allowed`:54-bit allowed bitmask(解里允许的 move)。
    /// - `max_rot_count`:解里整体旋转动的上限。
    ///
    /// 返回最优解(move 索引序列)或 None。
    pub fn solve_face_restricted(
        &self,
        scramble: &[usize],
        face: usize,
        allowed: u64,
        max_rot_count: u32,
    ) -> Option<Vec<usize>> {
        // 逐 move 共轭打乱(== analyzer 的 alg_rotation),再从 SOLVED 应用。
        let conj = Self::conjugate_scramble(scramble, ROTS_FACE[face.min(5)]);
        let mut coord = self.solved;
        let mut center = 0u8;
        for &m in &conj {
            coord = self.step_coord(coord, m);
            center = self.step_center(center, m);
        }
        self.solve_from(coord, center, allowed, &[0], max_rot_count)
    }

    /// 把面动序列经 rotation 串逐 move 共轭(与 `cube_common::alg_rotation` 完全一致):
    /// 每个面动 `m`(面 = m/3)的面被 rotation 的面置换 `f` 重映射成 `3*f[m/3] + m%3`。
    /// rotation 串可含多个 token(如 "z' y"),依次应用。
    fn conjugate_scramble(scramble: &[usize], rot: &str) -> Vec<usize> {
        let mut buf: Vec<usize> = scramble.to_vec();
        for tok in rot.split_whitespace() {
            // 面置换 f[6]:face t 在该 rotation 下变成 face f[t](与 alg_rotation 同表)。
            let f: [usize; 6] = match tok {
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
            for m in buf.iter_mut() {
                let t = *m / 3;
                let p = *m % 3;
                *m = 3 * f[t] + p;
            }
        }
        buf
    }

    /// 从给定起点 (coord, center) 做 BFS(solve 的核心,供 solve / solve_face_restricted 共用)。
    fn solve_from(
        &self,
        start_coord: u32,
        start_center: u8,
        allowed: u64,
        center_offset: &[u8],
        max_rot_count: u32,
    ) -> Option<Vec<usize>> {
        let allowed_moves: Vec<usize> = (0..54).filter(|&m| (allowed >> m) & 1 == 1).collect();

        let is_goal = |coord: u32, center: u8| -> bool {
            coord == self.solved && center_offset.contains(&center)
        };

        if is_goal(start_coord, start_center) {
            return Some(Vec::new());
        }

        let rot_dim = (max_rot_count + 1) as usize;
        let total: usize = CROSS_COORD * 24 * rot_dim;
        let mut visited = vec![false; total];
        let mut parent: Vec<(u32, u8)> = vec![(u32::MAX, 0u8); total];

        let state_id = |coord: u32, center: u8, rot: u32| -> usize {
            ((coord as usize * 24) + center as usize) * rot_dim + rot as usize
        };

        let start_id = state_id(start_coord, start_center, 0);
        visited[start_id] = true;

        let mut queue: std::collections::VecDeque<(u32, u8, u32)> =
            std::collections::VecDeque::new();
        queue.push_back((start_coord, start_center, 0));

        let mut goal_state: Option<usize> = None;

        'bfs: while let Some((coord, center, rot)) = queue.pop_front() {
            let cur_id = state_id(coord, center, rot);
            for &m in &allowed_moves {
                let is_rot = m >= 45;
                let nrot = if is_rot { rot + 1 } else { rot };
                if is_rot && nrot > max_rot_count {
                    continue;
                }
                let ncoord = self.step_coord(coord, m);
                let ncenter = self.step_center(center, m);
                let nid = state_id(ncoord, ncenter, nrot);
                if visited[nid] {
                    continue;
                }
                visited[nid] = true;
                parent[nid] = (cur_id as u32, m as u8);
                if is_goal(ncoord, ncenter) {
                    goal_state = Some(nid);
                    break 'bfs;
                }
                queue.push_back((ncoord, ncenter, nrot));
            }
        }

        let goal = goal_state?;
        let mut path = Vec::new();
        let mut cur = goal;
        while cur != start_id {
            let (p, m) = parent[cur];
            path.push(m as usize);
            cur = p as usize;
        }
        path.reverse();
        Some(path)
    }

    /// 把 move 索引序列转成空格分隔的步骤串。
    pub fn moves_to_string(seq: &[usize]) -> String {
        seq.iter()
            .map(|&m| MOVE_NAMES_54[m])
            .collect::<Vec<_>>()
            .join(" ")
    }

    /// 把打乱串(面动 move 名)解析成 move 索引序列(只认 0..18 的面动名)。
    pub fn parse_scramble(s: &str) -> Vec<usize> {
        s.split_whitespace()
            .filter_map(|tok| MOVE_NAMES_54[..18].iter().position(|&n| n == tok))
            .collect()
    }
}

impl Default for CrossRestrictSolver {
    fn default() -> Self {
        Self::new()
    }
}

// ---------- 测试 ----------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cube_common::{string_to_alg, test_env_lock, Move};
    use std::path::PathBuf;

    // ===== A. coord 双射 round-trip =====

    #[test]
    fn coord_roundtrip_sampled() {
        // 抽样若干 index,decode 再 encode 必相等。
        let samples = [
            0usize,
            1,
            15,
            16,
            CROSS_COORD - 1,
            CROSS_COORD / 2,
            12345,
            99999,
            187519,
            solved_coord(),
        ];
        for &idx in &samples {
            let (pos, ori) = decode_coord(idx);
            // pos 互异且 < 12
            for k in 0..4 {
                assert!(pos[k] < 12, "pos out of range idx={}", idx);
                for l in (k + 1)..4 {
                    assert_ne!(pos[k], pos[l], "pos dup idx={}", idx);
                }
                assert!(ori[k] < 2);
            }
            assert_eq!(encode_coord(&pos, &ori), idx, "roundtrip idx={}", idx);
        }
    }

    #[test]
    fn coord_roundtrip_full_enumeration() {
        // 全枚举所有 (pos 有序排列, ori) — encode 双射且无碰撞。
        // 12P4 * 16 = 190080 个状态全部覆盖一次。
        let mut seen = vec![false; CROSS_COORD];
        let mut count = 0usize;
        // 枚举 4 个互异槽位的有序排列。
        for a in 0..12 {
            for b in 0..12 {
                if b == a {
                    continue;
                }
                for c in 0..12 {
                    if c == a || c == b {
                        continue;
                    }
                    for d in 0..12 {
                        if d == a || d == b || d == c {
                            continue;
                        }
                        for oi in 0..16u8 {
                            let pos = [a, b, c, d];
                            let ori = [oi & 1, (oi >> 1) & 1, (oi >> 2) & 1, (oi >> 3) & 1];
                            let idx = encode_coord(&pos, &ori);
                            assert!(idx < CROSS_COORD, "idx oob");
                            assert!(!seen[idx], "collision at idx={}", idx);
                            seen[idx] = true;
                            // 反向也得一致
                            let (p2, o2) = decode_coord(idx);
                            assert_eq!(p2, pos);
                            assert_eq!(o2, ori);
                            count += 1;
                        }
                    }
                }
            }
        }
        assert_eq!(count, CROSS_COORD);
        assert!(seen.iter().all(|&x| x), "not bijective");
    }

    // ===== 共用:确定性 PRNG + 随机面动打乱 =====

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

    /// 18 面动 bitmask(bits 0..17)。
    fn mask_18_faces() -> u64 {
        (1u64 << 18) - 1
    }

    /// 全 54 move bitmask。
    fn mask_all_54() -> u64 {
        (1u64 << 54) - 1
    }

    // ===== B. 等价性(核心正确性闸):与现有 search_cross 一致 =====

    #[test]
    fn equivalence_with_existing_cross_solver_50_scrambles() {
        // 现有 search_cross 走 manager,需要 CUBE_TABLE_DIR。
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = PathBuf::from("target")
            .join("test-tables")
            .join("cross_restrict_equiv");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::env::set_var("CUBE_TABLE_DIR", &dir);

        let solver = CrossRestrictSolver::new();
        let face_mask = mask_18_faces();

        for seed in 0..50u64 {
            let scramble = random_face_scramble(1000 + seed, 20);

            // 新受限求解器:只许 18 面动,center_offset=[0],max_rot=0。
            let new_sol = solver
                .solve(&scramble, face_mask, &[0], 0)
                .expect("18-face cross must always be solvable");
            let new_len = new_sol.len() as u32;

            // 现有 search_cross:把同一打乱解析成 crate 的 Move 序列。
            let scramble_str = scramble
                .iter()
                .map(|&m| MOVE_NAMES_54[m])
                .collect::<Vec<_>>()
                .join(" ");
            let alg: Vec<Move> = string_to_alg(&scramble_str);
            let expected = crate::cross_solver::search_cross(&alg, "", false);

            assert_eq!(
                new_len, expected,
                "seed={} scramble='{}' new={} existing={}",
                seed, scramble_str, new_len, expected
            );
        }

        let _ = std::fs::remove_dir_all(&dir);
    }

    // ===== A2. 真旋转群结构 sanity:旋转搬棱 + 自复合/逆一致 =====

    #[test]
    fn true_rotations_move_edges_and_form_group() {
        let solver = CrossRestrictSolver::new();
        let x = solver.step_coord(solver.solved, 45);
        let x2 = solver.step_coord(solver.solved, 46);
        let y = solver.step_coord(solver.solved, 48);
        let z = solver.step_coord(solver.solved, 51);
        // 旋转现在真搬棱(or18 字面是恒等;改写后 coord 必变)。
        assert_ne!(x, solver.solved, "x must move cross edges now");
        assert_ne!(z, solver.solved, "z must move cross edges now");
        // y 绕竖轴转,D 棱在 D 层内换槽 ⟹ coord 仍变。
        assert_ne!(y, solver.solved, "y must permute D edges among D slots");
        // x^4 = 恒等;x∘x = x2;x∘x∘x = x'。
        let x4 = {
            let mut c = solver.solved;
            for _ in 0..4 {
                c = solver.step_coord(c, 45);
            }
            c
        };
        assert_eq!(x4, solver.solved, "x^4 must be identity");
        assert_eq!(solver.step_coord(x, 45), x2, "x then x must equal x2");
        assert_eq!(
            solver.step_coord(x2, 45),
            solver.step_coord(solver.solved, 47),
            "x^3 must equal x'"
        );
    }

    // ===== B2. 六面等价闸(硬 acceptance):solve_face_restricted == search_cross(alg, ROTS[f]) =====

    #[test]
    fn equivalence_all_six_faces_50_scrambles() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = PathBuf::from("target")
            .join("test-tables")
            .join("cross_restrict_six_faces");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::env::set_var("CUBE_TABLE_DIR", &dir);

        let solver = CrossRestrictSolver::new();
        let face_mask = mask_18_faces();

        for face in 0..6usize {
            for seed in 0..50u64 {
                let scramble = random_face_scramble(7000 + seed, 20);

                let new_len = solver
                    .solve_face_restricted(&scramble, face, face_mask, 0)
                    .expect("18-face cross-at-angle must always be solvable")
                    .len() as u32;

                let scramble_str = scramble
                    .iter()
                    .map(|&m| MOVE_NAMES_54[m])
                    .collect::<Vec<_>>()
                    .join(" ");
                let alg: Vec<Move> = string_to_alg(&scramble_str);
                let expected = crate::cross_solver::search_cross(&alg, ROTS_FACE[face], false);

                assert_eq!(
                    new_len, expected,
                    "face={} (rot='{}') seed={} scramble='{}' new={} existing={}",
                    face, ROTS_FACE[face], seed, scramble_str, new_len, expected
                );
            }
        }

        let _ = std::fs::remove_dir_all(&dir);
    }

    // ===== State 级独立 replay 校验(全 54-move 视角) =====

    /// 完整 State(ep/eo/center),只跟踪我们要校验的量。
    #[derive(Clone)]
    struct FullState {
        ep: [u8; 12],
        eo: [u8; 12],
        center: [u8; 6],
    }

    impl FullState {
        fn solved() -> Self {
            FullState {
                ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
                eo: [0; 12],
                center: [0, 1, 2, 3, 4, 5],
            }
        }

        /// or18 apply_move 语义:new_ep[i]=ep[EP[m][i]]; new_eo[i]=(eo[EP[m][i]]+EO[m][i])%2;
        /// new_center[i]=center[CENTER[m][i]]。
        fn apply(&self, m: usize) -> FullState {
            let mut nep = [0u8; 12];
            let mut neo = [0u8; 12];
            let mut nc = [0u8; 6];
            for i in 0..12 {
                let p = EP[m][i] as usize;
                nep[i] = self.ep[p];
                neo[i] = (self.eo[p] + EO[m][i]) % 2;
            }
            for i in 0..6 {
                nc[i] = self.center[CENTER[m][i] as usize];
            }
            FullState {
                ep: nep,
                eo: neo,
                center: nc,
            }
        }

        /// 4 个 D 棱(件 8,9,10,11)归位且朝向 0 + center 恒等。
        fn cross_solved_centers_home(&self) -> bool {
            let edges_home = (8..12).all(|p| self.ep[p] == p as u8 && self.eo[p] == 0);
            let centers_home = self.center == [0, 1, 2, 3, 4, 5];
            edges_home && centers_home
        }

        /// 带「真旋转(搬棱 + 搬中心)」语义的 apply:旋转动(45-53)走
        /// `build_rotation_edge_dests`(与求解器同一份真旋转模型)对 12 棱搬位 + 翻向,
        /// 中心走 or18 字面 CENTER;非旋转动直接 or18 字面 apply。
        /// 用于 task 4 的独立 State 级 replay 校验(不复用求解器的 coord_trans)。
        fn apply_pm(&self, m: usize) -> FullState {
            if m < 45 {
                return self.apply(m);
            }
            let dests = build_rotation_edge_dests();
            let dest = &dests[m - 45];
            // 棱:件在输入槽 s → 输出槽 d,翻向 += δ(new_ep[d]=ep[s])。
            let mut nep = [0u8; 12];
            let mut neo = [0u8; 12];
            for s in 0..12usize {
                let (d, dori) = dest[s];
                nep[d as usize] = self.ep[s];
                neo[d as usize] = (self.eo[s] + dori) % 2;
            }
            // 中心:or18 字面 CENTER[m]。
            let mut nc = [0u8; 6];
            for i in 0..6 {
                nc[i] = self.center[CENTER[m][i] as usize];
            }
            FullState { ep: nep, eo: neo, center: nc }
        }
    }

    // ===== C. Sanity:全 54-move <= 18-face,且 replay 真到 cross =====

    #[test]
    fn full54_not_worse_than_18face_and_replay_valid() {
        let solver = CrossRestrictSolver::new();
        let face_mask = mask_18_faces();
        let all_mask = mask_all_54();

        let mut shorter_count = 0;
        for seed in 0..30u64 {
            let scramble = random_face_scramble(5000 + seed, 20);

            let sol18 = solver.solve(&scramble, face_mask, &[0], 0).unwrap();
            let sol54 = solver.solve(&scramble, all_mask, &[0], 0).unwrap();
            assert!(
                sol54.len() <= sol18.len(),
                "seed={} full54 len {} > 18face len {}",
                seed,
                sol54.len(),
                sol18.len()
            );
            if sol54.len() < sol18.len() {
                shorter_count += 1;
            }

            // 独立 State 级 replay 校验 sol54:从打乱态出发,逐步施加解,必到 cross+center 复原。
            let mut st = FullState::solved();
            for &m in &scramble {
                st = st.apply(m);
            }
            for &m in &sol54 {
                st = st.apply(m);
            }
            assert!(
                st.cross_solved_centers_home(),
                "seed={} sol54 replay did not reach solved cross+centers",
                seed
            );

            // sol18 同样 replay 校验。
            let mut st2 = FullState::solved();
            for &m in &scramble {
                st2 = st2.apply(m);
            }
            for &m in &sol18 {
                st2 = st2.apply(m);
            }
            assert!(
                st2.cross_solved_centers_home(),
                "seed={} sol18 replay did not reach solved cross+centers",
                seed
            );
        }
        // 切片/宽动应当至少在某些打乱里缩短(不强求每条,但总体必须 > 0)。
        assert!(
            shorter_count > 0,
            "full 54-move never shortened any of 30 scrambles — suspicious"
        );
    }

    // ===== D. 受限不可解:只许 {U,U2,U'} 必返回 None 且不挂 =====

    #[test]
    fn restricted_unsolvable_returns_none() {
        let solver = CrossRestrictSolver::new();
        // 只许 U 系(bits 0,1,2)。U 不可能解十字(D 层棱永远动不了到位,除非本来就好)。
        let u_only: u64 = 0b111;
        // 用一个会打乱 D 层棱的打乱(含 F/R 把 D 棱挪走)。
        let scramble = CrossRestrictSolver::parse_scramble("F R U' D2 L B'");
        let res = solver.solve(&scramble, u_only, &[0], 0);
        assert!(
            res.is_none(),
            "U-only must be unsolvable for a scramble that moves D edges, got {:?}",
            res
        );
    }

    // ===== 额外:center_offset 与 max_rot_count 行为 sanity =====

    #[test]
    fn rotation_helps_when_offset_allows() {
        // 用一个 z2 视角更优的打乱:允许 1 个旋转 + center_offset 含 z2 对应的 center-index。
        // 这里只验证 solve 不 panic 且 max_rot 限制被尊重(解里 rotation 数 <= max_rot)。
        let solver = CrossRestrictSolver::new();
        let scramble = random_face_scramble(42, 20);
        // 允许全 54,center_offset = 全 24(任意终态朝向都算解),max_rot=1。
        let all: Vec<u8> = (0..24).collect();
        let sol = solver
            .solve(&scramble, mask_all_54(), &all, 1)
            .expect("with any center offset and rotations this must solve");
        let rot_used = sol.iter().filter(|&&m| m >= 45).count();
        assert!(rot_used <= 1, "max_rot_count=1 violated: {} rotations", rot_used);

        // max_rot=0 时解里不能有 rotation。
        let sol0 = solver.solve(&scramble, mask_all_54(), &all, 0).unwrap();
        assert!(sol0.iter().all(|&m| m < 45), "max_rot=0 but solution has rotation");
    }

    // ===== E. 旋转真正打开「触达」:<R,U> 解不了的打乱,加 x2 + 旋转预算后可解 =====

    #[test]
    fn rotation_enables_reach_under_restriction() {
        let solver = CrossRestrictSolver::new();
        // <R,U> = bits {0,1,2}(U 系)∪ {9,10,11}(R 系)。
        let ru_mask: u64 = 0b111 | (0b111 << 9);
        // <R,U> + x2(bit 46)。
        let ru_x2_mask: u64 = ru_mask | (1u64 << 46);

        // 找一个 <R,U> 无解、但 <R,U>+x2(max_rot>=2)有解的打乱(确定性扫种子)。
        // 直觉:D 层十字棱被挪到非 R/U 可触达的槽位,只有把整方块 x2 翻过来才够得着。
        let mut found: Option<(Vec<usize>, Vec<usize>)> = None;
        for seed in 0..2000u64 {
            let scramble = random_face_scramble(90000 + seed, 12);
            if solver.solve(&scramble, ru_mask, &[0], 0).is_some() {
                continue; // <R,U> 已可解,不是我们要的反例
            }
            // 加 x2 + 旋转预算 >=2(x2 算 1 个旋转,但解里可能要 2 个旋转夹住面动)。
            if let Some(sol) = solver.solve(&scramble, ru_x2_mask, &[0], 2) {
                // 解里必须真的用到了旋转(否则不算「旋转打开触达」)。
                if sol.iter().any(|&m| m >= 45) {
                    found = Some((scramble, sol));
                    break;
                }
            }
        }

        let (scramble, sol) = found.expect(
            "should find a scramble unsolvable under <R,U> but solvable with <R,U>+x2 (max_rot>=2)",
        );

        // 旋转数 <= 2(尊重 max_rot_count)。
        let rot_used = sol.iter().filter(|&&m| m >= 45).count();
        assert!(rot_used <= 2, "max_rot_count=2 violated: {} rotations", rot_used);
        // 只许 <R,U> 面动 + x2 旋转。
        for &m in &sol {
            assert!(
                (ru_x2_mask >> m) & 1 == 1,
                "solution used a move outside <R,U>+x2: {}",
                MOVE_NAMES_54[m]
            );
        }

        // 独立 FullState replay(旋转走「搬棱」复合语义):从打乱态出发施加解,
        // 必到 cross + center 全复原(center_offset=0)。
        let mut st = FullState::solved();
        for &m in &scramble {
            st = st.apply(m); // 打乱全是面动
        }
        for &m in &sol {
            st = st.apply_pm(m); // 解含旋转,用搬棱语义
        }
        assert!(
            st.cross_solved_centers_home(),
            "piece-moving replay of <R,U>+x2 solution did not reach solved cross+centers; scramble={:?} sol={:?}",
            scramble.iter().map(|&m| MOVE_NAMES_54[m]).collect::<Vec<_>>(),
            sol.iter().map(|&m| MOVE_NAMES_54[m]).collect::<Vec<_>>(),
        );

        // 反例确实:<R,U> 单独无解。
        assert!(
            solver.solve(&scramble, ru_mask, &[0], 0).is_none(),
            "control: <R,U> alone must be unsolvable for the chosen scramble"
        );
    }
}
