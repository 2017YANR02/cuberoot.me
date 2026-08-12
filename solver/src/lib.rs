// WASM 下 native-only manager 被 cfg 砍掉,其专用 import 会变 unused;
// 这些 import 在 native 确实在用,故仅对 wasm 抑制该噪音。
#![cfg_attr(target_arch = "wasm32", allow(unused_imports))]

pub mod cube_common;
pub mod move_tables;
// mt_gen:12 张 mt_* 移动表的运行时生成(native + wasm)。浏览器端靠它把 mt_* 从下载清单里
// 彻底去掉(mt_edge4 一张就 gz 8.3MB),现场建只要几十毫秒。
pub mod mt_gen;
pub mod prune_tables;

pub mod block222_solver;
pub mod block223_solver;
// lsll:手写的 PoC(4 张投影 PDB + IDA*,22.8MB 表)2026-07-27 退役 —— 实测 11 步 T-perm
// 求最优要 1.68s、枚举到 opt+2 要 233s,LSLL 峰值 12–14 步外推每 case 小时级,跑不动
// 148,384 个的管道。改走 cubeopt/h48 opt9(见 333opt/README.md)。代码在 git b2e21a52b9。
// chain:mallard 式链式 EO→DR→HTR→[FR]→Finish 编排(全自包含,native+wasm 双轨)。
pub mod chain_solver;
pub mod cross_solver;
// daisy:四条指定色棱围绕对面中心的 190,080 态精确多源 BFS。
pub mod daisy_solver;
// cross restricted optimal:任意受限 54-move 集 + 中心朝向 + center_offset/max_rot 的最优十字 BFS。
// 全自包含(运行时建表,无外部文件),native+wasm 双轨可编。
pub mod cross_restrict_solver;
// eoline / dr / htr / f2b:全自包含(微表现场建 / 复用 s1 表),native+wasm 双轨可编。
pub mod dr_solver;
pub mod eoline_solver;
pub mod executor;
pub mod f2b_solver;
pub mod first_layer_solver;
pub mod fr_solver;
pub mod htr_phase2_solver;
pub mod htr_solver;
// 222:2x2x2 口袋魔方全空间最优(3.6MB 零盘表现场 BFS)。
pub mod cube222_solver;
// pyraminx:金字塔核心+顶点全空间最优(0.9MB 零盘表现场 BFS,独立状态模型)。
pub mod pyraminx_solver;
pub mod roux_s1_solver;
// skewb:斜转方块全空间最优(3.0MB 零盘表现场 BFS,独立状态模型)。
pub mod skewb_solver;
// sq1:Square-1 twist-metric 最优(双阶段 search + 五张投影剪枝表 ~43MB 现场建,零盘表,独立状态模型)。
pub mod sq1_solver;
// sq1 two-phase:cstimer 移植的近最优 SQ1 求解器(slash 数,毫秒级;管道默认走它)。
pub mod sq1_twophase;
pub mod xcross_solver;
// xcross restricted optimal:任意受限 54-move 集 + 中心朝向 + center_offset/max_rot 的最优
// xcross(cross + 1 F2L pair)IDA*。全自包含(运行时建表 + 双 PDB,无外部文件),
// native+wasm 双轨可编。
pub mod xcross_restrict_solver;

// --- native-only(依赖 rayon / 磁盘表生成 / mmap manager,WASM 不编)---
#[cfg(not(target_arch = "wasm32"))]
pub mod logo;
#[cfg(not(target_arch = "wasm32"))]
pub mod prune_create;

#[cfg(not(target_arch = "wasm32"))]
pub mod dist;

// eo:native(manager,含 huge 路径)+ wasm(EOSmallSolver from_tables 小表 cascade)。
// 各 manager 构造已 cfg 门控,模块本身 wasm 可编。
pub mod eo_cross_solver;
// f2leo / pseudo_f2leo / pair 双轨:native(manager)+ wasm(from_tables + *_small cascade)。
// manager 调用(new)已各自 cfg 门控,模块本身 wasm 可编。
pub mod f2leo_solver;
pub mod pair_solver;
pub mod pseudo_f2leo_solver;
// pseudo_pair:native(manager,GB 表)+ wasm(PseudoPairSmallSolver,全 prune 现建)。自包含 wasm 可编。
pub mod pseudo_pair_solver;
// pseudo:native(manager,4×54MB 表)+ wasm(PseudoSmallSolver,cross+corner 表现建)。
// manager 构造已门控,模块自包含 wasm 可编。pseudo_xxcross/xxxcross 仍 native-only。
pub mod pseudo_xcross_solver;
#[cfg(not(target_arch = "wasm32"))]
pub mod pseudo_xxcross_solver;
#[cfg(not(target_arch = "wasm32"))]
pub mod pseudo_xxxcross_solver;

// --- WASM 入口(wasm-bindgen) ---
#[cfg(target_arch = "wasm32")]
pub mod wasm;
