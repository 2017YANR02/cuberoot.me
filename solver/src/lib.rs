// WASM 下 native-only manager 被 cfg 砍掉,其专用 import 会变 unused;
// 这些 import 在 native 确实在用,故仅对 wasm 抑制该噪音。
#![cfg_attr(target_arch = "wasm32", allow(unused_imports))]

pub mod cube_common;
pub mod move_tables;
pub mod prune_tables;

pub mod block222_solver;
pub mod block223_solver;
pub mod cross_solver;
pub mod executor;
pub mod roux_s1_solver;
pub mod xcross_solver;

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
pub mod pseudo_f2leo_solver;
pub mod pair_solver;
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
