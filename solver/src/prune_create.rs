//! prune_create: BFS 引擎家族 + 每个 pt_* 表的 gen_pt_xxx 注册函数。
//!
//! 移植自 C++ prune_create.cpp(+ prune_tables.cpp 里的 genPT* 调用方)。
//!
//! 设计要点:
//!   - 每个 BFS 引擎(createPT*)接受 mt 数组、状态空间维度、初始 SOLVED 索引集合、
//!     最大深度 depth,内部用 `tmp: Vec<u8>` 填 0..15 深度,255 = unvisited,
//!     最后 pack 成 4-bit nibble (Vec<u8>)。
//!   - C++ 用 OpenMP + CAS;Rust 用 rayon par_iter 并行扫描,用 AtomicU8 CAS(只允许
//!     255 -> nd 的转换)。`tmp` 用 Vec<AtomicU8> 直接共享。
//!   - 单线程也能跑(rayon 自动调度);为了控制 RAM,BFS 完成后用 `pack_atomics_inplace`
//!     把 nibble 原位写回同一 buffer 前半段,不再额外开一份 total 字节拷贝
//!     (huge 表峰值从 ~53 GB 降到 ~21 GB,32 GB 机可跑)。
//!   - `t_cr` (mt_edge4) 步长 24,值预乘 24,索引时直接用 `t_cr[i_cr+j]` 然后整除 24
//!     恢复纯索引。`t_cn / t_ed` 等步长 18。
//!
//! `gen_pt_*` 命名约定:
//!   gen_pt_cross / gen_pt_cross_ins_c4 / gen_pt_pair_c4e0 / gen_pt_cross_c4e0 / ...
//!   每个函数:
//!     1. 自动 ensure 依赖的 mt 表(共享 MoveTableManager 单例)
//!     2. 调用对应 BFS 引擎,返回 (entry_count, packed_bytes)

use std::io::Write;
use std::sync::atomic::{AtomicU8, Ordering};
use std::time::Instant;

use rayon::prelude::*;

use crate::cube_common::{array_to_index, state_space, string_to_alg, Move};
use crate::move_tables as mt;
use crate::prune_tables::PruneTableManager;

// ---------- 公共工具 ----------

/// CAS:仅当当前值是 255 时写入 nd。
#[inline]
fn cas_unvisited(slot: &AtomicU8, nd: u8) {
    let _ = slot.compare_exchange(255, nd, Ordering::Relaxed, Ordering::Relaxed);
}

/// 消费 BFS 后的 AtomicU8 buffer,**原位**打包成 4-bit nibble:
/// out[i] 低半字节 = src[2i](偶 idx),高半字节 = src[2i+1](奇 idx),255→0xF。
/// out idx i ≤ 源 idx 2i,前向写不会覆盖还没读的源字节;打包后把 Vec<AtomicU8>
/// 重解释为 Vec<u8> 截断到 nb,省掉一份 total 字节的拷贝(huge 表峰值 53→21 GB)。
fn pack_atomics_inplace(mut atomics: Vec<AtomicU8>) -> Vec<u8> {
    let total = atomics.len();
    let nb = (total + 1) / 2;
    // SAFETY: BFS 已结束,单线程独占;AtomicU8 与 u8 同 size/align/repr。
    let buf: &mut [u8] =
        unsafe { std::slice::from_raw_parts_mut(atomics.as_mut_ptr() as *mut u8, total) };
    for i in 0..nb {
        let lo = buf[2 * i];
        let hi = if 2 * i + 1 < total { buf[2 * i + 1] } else { 255 };
        let lo = if lo == 255 { 0x0F } else { lo & 0x0F };
        let hi = if hi == 255 { 0x0F } else { hi & 0x0F };
        buf[i] = lo | (hi << 4);
    }
    let ptr = atomics.as_mut_ptr() as *mut u8;
    let cap = atomics.capacity();
    std::mem::forget(atomics);
    // SAFETY: 同上 layout 一致;ptr/cap 来自刚 forget 的同一 Vec。
    let mut out = unsafe { Vec::from_raw_parts(ptr, total, cap) };
    out.truncate(nb);
    out
}

/// 在 BFS 主循环里,扫描所有 `tmp[i] == d` 的 i,对每个 j ∈ 0..18,
/// 用 next_index(i, j) 算出新 idx,做 CAS。
///
/// `next_index` 接受 (cur_idx, mv_index_0_17),返回 next_idx(u64)。
fn bfs_step<F: Fn(u64, usize) -> u64 + Sync>(
    tmp: &[AtomicU8],
    d: u8,
    total: u64,
    next_index: F,
) -> u64 {
    let nd = d + 1;
    (0..total)
        .into_par_iter()

        .map(|i| {
            if tmp[i as usize].load(Ordering::Relaxed) == d {
                for j in 0..18 {
                    let ni = next_index(i, j);
                    if ni < total {
                        cas_unvisited(&tmp[ni as usize], nd);
                    }
                }
                1u64
            } else {
                0
            }
        })
        .sum()
}

/// 千分位格式化(对齐 C++ DistributionPrinter::formatWithCommas)。
fn commas(n: u64) -> String {
    let s = n.to_string();
    let b = s.as_bytes();
    let len = b.len();
    let mut out = String::with_capacity(len + len / 3);
    for (i, &c) in b.iter().enumerate() {
        if i > 0 && (len - i) % 3 == 0 {
            out.push(',');
        }
        out.push(c as char);
    }
    out
}

/// 对齐 C++ DistributionPrinter:State Space 头 + 每深度 Depth/Count/Pct/Cum 行
/// + 结尾分隔线 + 加权平均深度。pct/cum 相对完整状态空间。
struct DistPrinter {
    total_space: u64,
    accumulated: u64,
    records: Vec<(u32, u64)>,
}

impl DistPrinter {
    fn new(total: u64) -> Self {
        eprintln!("\n    State Space: {}", commas(total));
        eprintln!("    -------------------------------------------------");
        eprintln!("    Depth           Count          Pct          Cum");
        eprintln!("    -------------------------------------------------");
        DistPrinter {
            total_space: total,
            accumulated: 0,
            records: Vec::new(),
        }
    }

    fn print_row(&mut self, depth: u32, count: u64) {
        if count == 0 {
            return;
        }
        self.accumulated += count;
        self.records.push((depth, count));
        let pct = 100.0 * count as f64 / self.total_space as f64;
        let cum = 100.0 * self.accumulated as f64 / self.total_space as f64;
        eprintln!(
            "    {:>5}  {:>14}  {:>9.6}%  {:>9.6}%",
            depth,
            commas(count),
            pct,
            cum
        );
    }

    fn done(&self, secs: f64) {
        eprintln!("    -------------------------------------------------");
        let mut wsum = 0.0f64;
        for &(d, c) in &self.records {
            wsum += d as f64 * c as f64;
        }
        let avg = if self.accumulated > 0 {
            wsum / self.accumulated as f64
        } else {
            0.0
        };
        eprintln!(
            "    {:>5.2}  {:>14}  visited, BFS {:.0}s",
            avg,
            commas(self.accumulated),
            secs
        );
    }
}

/// 与 `bfs_step` 同算法,但把 0..total 扫描切成块,块间刷 `\r Scanning depth N: X%`
/// 实时进度(对齐 C++ DistributionPrinter::progress)。分块只改扫描粒度,扩展顺序
/// 在一轮内与结果无关,输出 bit-exact 不变。
fn bfs_step_chunked<F: Fn(u64, usize) -> u64 + Sync>(
    tmp: &[AtomicU8],
    d: u8,
    total: u64,
    next_index: &F,
) -> u64 {
    let nd = d + 1;
    let n_chunks: u64 = 200;
    let chunk = ((total + n_chunks - 1) / n_chunks).max(1);
    let mut cnt = 0u64;
    let mut lo = 0u64;
    while lo < total {
        let hi = (lo + chunk).min(total);
        cnt += (lo..hi)
            .into_par_iter()
            .map(|i| {
                if tmp[i as usize].load(Ordering::Relaxed) == d {
                    for j in 0..18 {
                        let ni = next_index(i, j);
                        if ni < total {
                            cas_unvisited(&tmp[ni as usize], nd);
                        }
                    }
                    1u64
                } else {
                    0
                }
            })
            .sum::<u64>();
        lo = hi;
        eprint!("\r    Scanning depth {:>2}: {:>3}%", d, lo * 100 / total);
        let _ = std::io::stderr().flush();
    }
    eprint!("\r{:55}\r", "");
    let _ = std::io::stderr().flush();
    cnt
}

/// 通用收尾:run BFS depth 轮,最后 pack。
fn run_bfs_and_pack<F: Fn(u64, usize) -> u64 + Sync>(
    total: u64,
    depth: u32,
    seeds: &[u64],
    next_index: F,
) -> Vec<u8> {
    // 大表(≥1G 状态)走 C++ 式分布进度;小表静默(table_generator 自带 [GEN] 行)。
    let verbose = total >= 1_000_000_000;
    let t0 = Instant::now();
    let mut dp = if verbose { Some(DistPrinter::new(total)) } else { None };
    let tmp: Vec<AtomicU8> = (0..total).map(|_| AtomicU8::new(255)).collect();
    for &s in seeds {
        if s < total {
            tmp[s as usize].store(0, Ordering::Relaxed);
        }
    }
    for d in 0..depth {
        let cnt = if verbose {
            bfs_step_chunked(&tmp, d as u8, total, &next_index)
        } else {
            bfs_step(&tmp, d as u8, total, &next_index)
        };
        if let Some(dp) = dp.as_mut() {
            dp.print_row(d, cnt);
        }
        if cnt == 0 {
            break;
        }
    }
    if let Some(dp) = dp.as_ref() {
        dp.done(t0.elapsed().as_secs_f64());
        eprintln!("    packing {:.1} GB in place ...", (total / 2) as f64 / 1e9);
    }
    let out = pack_atomics_inplace(tmp);
    if verbose {
        eprintln!("    packed, total {:.0}s", t0.elapsed().as_secs_f64());
    }
    out
}

// ---------- BFS 引擎 ----------
//
// 与 C++ 一一对应。所有函数返回 (entry_count, packed_bytes)。

// 1. createPTCross / createPTPsCross:
//    两个 EDGE2 维度的笛卡尔积。
fn create_pt_cross_or_pscross(
    seeds_extra_d_moves: bool, // true=pscross(4 个 SOLVED),false=cross(1 个)
    mt_edge2: &[u32],
) -> (u64, Vec<u8>) {
    let sz = state_space::EDGE2 as u64;
    let total = sz * sz;
    let depth = 10u32;

    let i1 = state_space::EDGE2_A_SOLVED as u64;
    let i2 = state_space::EDGE2_B_SOLVED as u64;
    let mut seeds = vec![i1 * sz + i2];
    if seeds_extra_d_moves {
        for &mv in &[3u32, 4, 5] {
            let nj1 = mt_edge2[(i1 as usize) * 18 + mv as usize] as u64;
            let nj2 = mt_edge2[(i2 as usize) * 18 + mv as usize] as u64;
            seeds.push(nj1 * sz + nj2);
        }
    }

    let bytes = run_bfs_and_pack(total, depth, &seeds, |i, j| {
        let idx1 = (i / sz) as usize * 18;
        let idx2 = (i % sz) as usize * 18;
        let n1 = mt_edge2[idx1 + j] as u64;
        let n2 = mt_edge2[idx2 + j] as u64;
        n1 * sz + n2
    });
    (total, bytes)
}

// 2. createPTCrossInsC: pt_cross_ins_C4 (Std/Pair)
//    Cross × Corner, t_cr=mt_edge4 stride24, t_cn=mt_corn stride18
//    seed 主 + 4 组 algorithm-shift,每组再展 3 个 U-axis 邻居
fn create_pt_cross_ins_c(
    idx_cr: u64,
    idx_cn: u64,
    sz_cr: u64,
    sz_cn: u64,
    depth: u32,
    t_cr: &[u32],
    t_cn: &[u32],
) -> (u64, Vec<u8>) {
    let total = sz_cr * sz_cn;
    let mut tmp = vec![255u8; total as usize];

    let am = ["L U L'", "L U' L'", "B' U B", "B' U' B"];
    tmp[(idx_cr * sz_cn + idx_cn) as usize] = 0;
    for s in &am {
        // i_cr 在循环里保持"已乘 24"的状态(因为 mt_edge4 存值 = cross_idx * 24)
        let mut i_cr = (idx_cr * 24) as usize;
        let mut i_cn = idx_cn as usize;
        for m in string_to_alg(s) {
            i_cr = t_cr[i_cr + m.index()] as usize;
            i_cn = t_cn[i_cn * 18 + m.index()] as usize;
        }
        // 主 idx
        let main_idx = (i_cr as u64 / 24) * sz_cn + i_cn as u64;
        if main_idx < total {
            tmp[main_idx as usize] = 0;
        }
        // 3 个 U-axis 邻居(C++: j=0,1,2)
        let base_cr = i_cr;
        let base_cn = i_cn * 18;
        for k in 0..3 {
            let ni = t_cr[base_cr + k] as u64 + t_cn[base_cn + k] as u64;
            if ni < total {
                tmp[ni as usize] = 0;
            }
        }
    }

    let atomics: Vec<AtomicU8> = tmp.into_iter().map(AtomicU8::new).collect();
    for d in 0..depth {
        let nd = d as u8 + 1;
        let cnt: u64 = (0..total)
            .into_par_iter()

            .map(|i| {
                if atomics[i as usize].load(Ordering::Relaxed) == d as u8 {
                    let i_cr = (i / sz_cn) as usize * 24;
                    let i_cn = (i % sz_cn) as usize * 18;
                    for j in 0..18 {
                        let ni = t_cr[i_cr + j] as u64 + t_cn[i_cn + j] as u64;
                        if ni < total {
                            cas_unvisited(&atomics[ni as usize], nd);
                        }
                    }
                    1u64
                } else {
                    0
                }
            })
            .sum();
        if cnt == 0 {
            break;
        }
    }
    (total, pack_atomics_inplace(atomics))
}

// 3. createPTPair: pt_pair_C4E0 / pt_pspair_CE (后者多 seed)
fn create_pt_pair_basic(
    idx_ed: u64,
    idx_cn: u64,
    sz_ed: u64,
    sz_cn: u64,
    depth: u32,
    t_ed: &[u32],
    t_cn: &[u32],
) -> (u64, Vec<u8>) {
    let total = sz_ed * sz_cn;
    let mut tmp = vec![255u8; total as usize];
    let am = ["L U L'", "L U' L'", "B' U B", "B' U' B"];
    tmp[(idx_ed * sz_cn + idx_cn) as usize] = 0;
    for s in &am {
        let mut c_ed = idx_ed as usize;
        let mut c_cn = idx_cn as usize;
        for m in string_to_alg(s) {
            c_ed = t_ed[c_ed * 18 + m.index()] as usize;
            c_cn = t_cn[c_cn * 18 + m.index()] as usize;
        }
        tmp[c_ed * sz_cn as usize + c_cn] = 0;
        for k in 0..3 {
            let n_ed = t_ed[c_ed * 18 + k] as usize;
            let n_cn = t_cn[c_cn * 18 + k] as usize;
            tmp[n_ed * sz_cn as usize + n_cn] = 0;
        }
    }

    let atomics: Vec<AtomicU8> = tmp.into_iter().map(AtomicU8::new).collect();
    for d in 0..depth {
        let nd = d as u8 + 1;
        let cnt: u64 = (0..total)
            .into_par_iter()

            .map(|i| {
                if atomics[i as usize].load(Ordering::Relaxed) == d as u8 {
                    let i_ed = (i / sz_cn) as usize * 18;
                    let i_cn = (i % sz_cn) as usize * 18;
                    for j in 0..18 {
                        let ni = t_ed[i_ed + j] as u64 * sz_cn + t_cn[i_cn + j] as u64;
                        cas_unvisited(&atomics[ni as usize], nd);
                    }
                    1u64
                } else {
                    0
                }
            })
            .sum();
        if cnt == 0 {
            break;
        }
    }
    (total, pack_atomics_inplace(atomics))
}

// 4. createPTCrossCE: Cross × Corner × Edge
fn create_pt_cross_ce(
    idx_cr: u64,
    idx_cn: u64,
    idx_ed: u64,
    sz_cr: u64,
    sz_cn: u64,
    sz_ed: u64,
    depth: u32,
    t1: &[u32], // mt_edge4 stride 24
    t2: &[u32], // mt_corn  stride 18
    t3: &[u32], // mt_edge  stride 18 (值 = 2*pos+ori)
    is_pseudo: bool,
) -> (u64, Vec<u8>) {
    let total = sz_cr * sz_cn * sz_ed;
    let num_init = if is_pseudo { 4 } else { 1 };
    let d_moves = [-1i32, 3, 4, 5];

    let mut tmp = vec![255u8; total as usize];
    for m_idx in 0..num_init {
        let (cur_cr, cur_cn);
        if m_idx == 0 {
            cur_cr = idx_cr * 24;
            cur_cn = (idx_cn as usize * 18) as u64;
        } else {
            let mv = d_moves[m_idx] as usize;
            cur_cr = t1[(idx_cr * 24) as usize + mv] as u64;
            cur_cn = (t2[(idx_cn * 18) as usize + mv] as u64) * 18;
        }
        let cur_ed = idx_ed;
        let start_idx = (cur_cr + cur_cn / 18) * 24 + cur_ed;
        if start_idx < total {
            tmp[start_idx as usize] = 0;
        }
    }

    let atomics: Vec<AtomicU8> = tmp.into_iter().map(AtomicU8::new).collect();
    for d in 0..depth {
        let nd = d as u8 + 1;
        let cnt: u64 = (0..total)
            .into_par_iter()

            .map(|i| {
                if atomics[i as usize].load(Ordering::Relaxed) == d as u8 {
                    let comb = i / sz_ed;
                    let cur_ed = i % sz_ed;
                    let cur_cr = (comb / sz_cn) as usize * 24;
                    let cur_cn = (comb % sz_cn) as usize * 18;
                    let idx3_base = cur_ed as usize * 18;
                    for j in 0..18 {
                        let n_cr = t1[cur_cr + j] as u64;
                        let n_cn = t2[cur_cn + j] as u64;
                        let n_ed = t3[idx3_base + j] as u64;
                        let ni = (n_cr + n_cn) * 24 + n_ed;
                        if ni < total {
                            cas_unvisited(&atomics[ni as usize], nd);
                        }
                    }
                    1u64
                } else {
                    0
                }
            })
            .sum();
        if cnt == 0 {
            break;
        }
    }
    (total, pack_atomics_inplace(atomics))
}

// 5. createPTEdge6Corn2: Edge6 × Corner2 (Huge)
fn create_pt_edge6_corn2(
    sz_e6: u64,
    sz_c2: u64,
    depth: u32,
    target_e_ids: &[i32],
    target_c_ids: &[i32],
    mt_e6: &[u32],
    mt_c2: &[u32],
) -> (u64, Vec<u8>) {
    let total = sz_e6 * sz_c2;
    let idx_e6 = array_to_index(target_e_ids, 6, 2, 12) as u64;
    let idx_c2 = array_to_index(target_c_ids, 2, 3, 8) as u64;
    let seeds = [idx_e6 * sz_c2 + idx_c2];
    let bytes = run_bfs_and_pack(total, depth, &seeds, |i, j| {
        let cur_e6 = (i / sz_c2) as usize * 18;
        let cur_c2 = (i % sz_c2) as usize * 18;
        let n_e6 = mt_e6[cur_e6 + j] as u64;
        let n_c2 = mt_c2[cur_c2 + j] as u64;
        n_e6 * sz_c2 + n_c2
    });
    (total, bytes)
}

// 6. createPTPsCrossEdge2 / Corner2: Cross × Aux (4 个 D-shift seeds)
fn create_pt_pscross_aux2(
    idx_cr: u64,
    idx_aux: u64,
    sz_cr: u64,
    sz_aux: u64,
    depth: u32,
    t_cr: &[u32], // mt_edge4 stride24
    t_aux: &[u32], // mt_edge2 / mt_corn2  stride18
) -> (u64, Vec<u8>) {
    let total = sz_cr * sz_aux;
    let d_moves = [-1i32, 3, 4, 5];
    let mut seeds: Vec<u64> = Vec::with_capacity(4);
    for m_idx in 0..4 {
        let (cur_cr, cur_aux);
        if m_idx == 0 {
            cur_cr = idx_cr;
            cur_aux = idx_aux;
        } else {
            let mv = d_moves[m_idx] as usize;
            cur_cr = (t_cr[(idx_cr * 24) as usize + mv] / 24) as u64;
            cur_aux = t_aux[(idx_aux * 18) as usize + mv] as u64;
        }
        seeds.push(cur_cr * sz_aux + cur_aux);
    }
    let bytes = run_bfs_and_pack(total, depth, &seeds, |i, j| {
        let cur_cr = (i / sz_aux) as usize * 24;
        let cur_aux = (i % sz_aux) as usize * 18;
        let n_cr = (t_cr[cur_cr + j] / 24) as u64;
        let n_aux = t_aux[cur_aux + j] as u64;
        n_cr * sz_aux + n_aux
    });
    (total, bytes)
}

// 7. createPTPsCrossEdge3 / Corner3: 同 aux2,但 sz_aux 不同
//    C++ 把 Edge3/Corner3 单独写,Rust 这里直接复用 create_pt_pscross_aux2。

// 8. createPTDim2: pt_ep4eo12
fn create_pt_dim2(
    idx1: u64,
    idx2: u64,
    sz1: u64,
    sz2: u64,
    depth: u32,
    t1: &[u32],
    t2: &[u32],
) -> (u64, Vec<u8>) {
    let total = sz1 * sz2;
    let seeds = [idx1 * sz2 + idx2];
    let bytes = run_bfs_and_pack(total, depth, &seeds, |i, j| {
        let i1 = (i / sz2) as usize * 18;
        let i2 = (i % sz2) as usize * 18;
        let n1 = t1[i1 + j] as u64;
        let n2 = t2[i2 + j] as u64;
        n1 * sz2 + n2
    });
    (total, bytes)
}

// 9. createPTCrossCEX: Cross × Corner × Edge × Extra (EOCross Plus)
fn create_pt_cross_cex(
    idx_cr: u64,
    idx_cn: u64,
    idx_ed: u64,
    idx_extra: u64,
    sz_cr: u64,
    sz_cn: u64,
    sz_ed: u64,
    sz_ex: u64,
    depth: u32,
    t1: &[u32],
    t2: &[u32],
    t3: &[u32],
    t4: &[u32],
) -> (u64, Vec<u8>) {
    let total = sz_cr * sz_cn * sz_ed * sz_ex;
    let cur_cr = idx_cr * 24;
    let cur_cn = idx_cn * 18;
    let start_idx = ((cur_cr + cur_cn / 18) * 24 + idx_ed) * 24 + idx_extra;
    let seeds = [start_idx];
    let bytes = run_bfs_and_pack(total, depth, &seeds, |i, j| {
        let mut rem = i;
        let c_ex = (rem % sz_ex) as usize;
        rem /= sz_ex;
        let c_ed = (rem % sz_ed) as usize;
        rem /= sz_ed;
        let c_cn = (rem % sz_cn) as usize;
        rem /= sz_cn;
        let c_mul = rem;
        let idx1_base = c_mul as usize * 24;
        let idx2_base = c_cn * 18;
        let idx3_base = c_ed * 18;
        let idx4_base = c_ex * 18;
        let n_cr = t1[idx1_base + j] as u64;
        let n_cn = t2[idx2_base + j] as u64;
        let n_ed = t3[idx3_base + j] as u64;
        let n_ex = t4[idx4_base + j] as u64;
        ((n_cr + n_cn) * 24 + n_ed) * 24 + n_ex
    });
    (total, bytes)
}

// 10. createPTCrossCCC: 4 维 3-Corner
fn create_pt_cross_ccc(
    idx_cr: u64,
    idx_cn1: u64,
    idx_cn2: u64,
    idx_cn3: u64,
    sz_cr: u64,
    sz_cn1: u64,
    sz_cn2: u64,
    sz_cn3: u64,
    depth: u32,
    t_cr: &[u32],
    t_cn1: &[u32],
    t_cn2: &[u32],
    t_cn3: &[u32],
) -> (u64, Vec<u8>) {
    let total = sz_cr * sz_cn1 * sz_cn2 * sz_cn3;
    let cur_cr = idx_cr * 24;
    let cur_cn1 = idx_cn1 * 18;
    let start_idx = ((cur_cr + cur_cn1 / 18) * sz_cn2 + idx_cn2) * sz_cn3 + idx_cn3;
    let seeds = [start_idx];
    let bytes = run_bfs_and_pack(total, depth, &seeds, |i, j| {
        let mut rem = i;
        let c_cn3 = (rem % sz_cn3) as usize;
        rem /= sz_cn3;
        let c_cn2 = (rem % sz_cn2) as usize;
        rem /= sz_cn2;
        let c_cn1 = (rem % sz_cn1) as usize;
        rem /= sz_cn1;
        let c_mul = rem;
        let idx_cr_base = c_mul as usize * 24;
        let idx_cn1_base = c_cn1 * 18;
        let idx_cn2_base = c_cn2 * 18;
        let idx_cn3_base = c_cn3 * 18;
        let n_cr = t_cr[idx_cr_base + j] as u64;
        let n_cn1 = t_cn1[idx_cn1_base + j] as u64;
        let n_cn2 = t_cn2[idx_cn2_base + j] as u64;
        let n_cn3 = t_cn3[idx_cn3_base + j] as u64;
        ((n_cr + n_cn1) * sz_cn2 + n_cn2) * sz_cn3 + n_cn3
    });
    (total, bytes)
}

// 11. createPTPsCrossCorn: Cross × Corner (PseudoPair 变体 base)
//     固定 a={16,18,20,22} cross-edge SOLVED + 3 个 U-axis 邻居
fn create_pt_pscross_corn(
    index2: u64,
    depth: u32,
    t1: &[u32], // mt_edge4
    t2: &[u32], // mt_corn
) -> (u64, Vec<u8>) {
    let size1 = state_space::CROSS as u64;
    let size2 = state_space::CORNER as u64;
    let total = size1 * size2;
    let a = [16i32, 18, 20, 22];
    let index1 = array_to_index(&a, 4, 2, 12) as u64;

    let mut tmp = vec![255u8; total as usize];
    tmp[(index1 * size2 + index2) as usize] = 0;
    for k in 3..=5usize {
        let ni = t1[(index1 * 24) as usize + k] as u64 + t2[(index2 * 18) as usize + k] as u64;
        if ni < total {
            tmp[ni as usize] = 0;
        }
    }

    let atomics: Vec<AtomicU8> = tmp.into_iter().map(AtomicU8::new).collect();
    for d in 0..depth {
        let nd = d as u8 + 1;
        let cnt: u64 = (0..total)
            .into_par_iter()

            .map(|i| {
                if atomics[i as usize].load(Ordering::Relaxed) == d as u8 {
                    let i1 = (i / size2) as usize * 24;
                    let i2 = (i % size2) as usize * 18;
                    for j in 0..18 {
                        let ni = t1[i1 + j] as u64 + t2[i2 + j] as u64;
                        if ni < total {
                            cas_unvisited(&atomics[ni as usize], nd);
                        }
                    }
                    1u64
                } else {
                    0
                }
            })
            .sum();
        if cnt == 0 {
            break;
        }
    }
    (total, pack_atomics_inplace(atomics))
}

// 12. createPTPsCrossInsC: PseudoPair XCross 变体(16 张)
//     按 index3(edge slot 0/2/4/6)选 algorithm + tmp_moves。
fn create_pt_pscross_ins_c(
    index3: u64,
    index2: u64,
    depth: u32,
    t1: &[u32],
    t2: &[u32],
) -> (u64, Vec<u8>) {
    let size1 = state_space::CROSS as u64;
    let size2 = state_space::CORNER as u64;
    let total = size1 * size2;
    let (am, tmp_moves): (&[&str], &[i32]) = match index3 {
        0 => (&["L U L'", "L U' L'", "B' U B", "B' U' B"], &[0, 3, 4, 5]),
        2 => (&["R' U R", "R' U' R", "B U B'", "B U' B'"], &[5, 0, 3, 4]),
        4 => (&["R U R'", "R U' R'", "F' U F", "F' U' F"], &[4, 5, 0, 3]),
        6 => (&["L' U L", "L' U' L", "F U F'", "F U' F'"], &[3, 4, 5, 0]),
        _ => panic!("createPTPsCrossInsC: bad index3 {}", index3),
    };

    let a = [16i32, 18, 20, 22];
    let index1 = array_to_index(&a, 4, 2, 12) as u64;
    let mut tmp = vec![255u8; total as usize];
    tmp[(index1 * size2 + index2) as usize] = 0;
    for k in 3..=5usize {
        let ni = t1[(index1 * 24) as usize + k] as u64
            + t2[(index2 * 18) as usize + k] as u64;
        if ni < total {
            tmp[ni as usize] = 0;
        }
    }

    let sel = (index2 / 3 - 4) as usize;
    for i in 0..4 {
        let mut i1 = (index1 * 24) as usize;
        let mut i2 = index2 as usize;
        let mv0 = tmp_moves[sel] as usize;
        i1 = t1[i1 + mv0] as usize;
        i2 = t2[i2 * 18 + mv0] as usize;
        for m in string_to_alg(am[i]) {
            i1 = t1[i1 + m.index()] as usize;
            i2 = t2[i2 * 18 + m.index()] as usize;
        }
        // main
        let ni = i1 as u64 + i2 as u64; // i1 已 = cross*24, i2 = corner_idx; ni = cross*24+corner
                                        // (因为 size2=24, ni = (cross)*24 + corner)
        if ni < total {
            tmp[ni as usize] = 0;
        }
        // 邻居 j = 3,4,5
        for k in 3..=5usize {
            let ni2 = t1[i1 + k] as u64 + t2[i2 * 18 + k] as u64;
            if ni2 < total {
                tmp[ni2 as usize] = 0;
            }
            // table1[table1[i1] + k]   + table2[table2[i2*18] * 18 + k]
            let ni3 = t1[(t1[i1] as usize) + k] as u64
                + t2[(t2[i2 * 18] as usize) * 18 + k] as u64;
            if ni3 < total {
                tmp[ni3 as usize] = 0;
            }
        }
        // U(0)
        let i1_u = t1[i1] as usize;
        let i2_u = t2[i2 * 18] as usize;
        let _ = i1_u; // 已用于上面的 ni3
        let _ = i2_u;

        // 把 j=1,2 也做一次:t1[i1+1], t2[i2*18+1] 等
        for off in [1usize, 2] {
            let base1 = t1[i1 + off] as usize;
            let base2 = t2[i2 * 18 + off] as usize;
            let ni_a = base1 as u64 + base2 as u64;
            if ni_a < total {
                tmp[ni_a as usize] = 0;
            }
            for k in 3..=5usize {
                let ni_b = t1[base1 + k] as u64 + t2[base2 * 18 + k] as u64;
                if ni_b < total {
                    tmp[ni_b as usize] = 0;
                }
            }
        }
    }

    let atomics: Vec<AtomicU8> = tmp.into_iter().map(AtomicU8::new).collect();
    for d in 0..depth {
        let nd = d as u8 + 1;
        let cnt: u64 = (0..total)
            .into_par_iter()

            .map(|i| {
                if atomics[i as usize].load(Ordering::Relaxed) == d as u8 {
                    let i1 = (i / size2) as usize * 24;
                    let i2 = (i % size2) as usize * 18;
                    for j in 0..18 {
                        let ni = t1[i1 + j] as u64 + t2[i2 + j] as u64;
                        if ni < total {
                            cas_unvisited(&atomics[ni as usize], nd);
                        }
                    }
                    1u64
                } else {
                    0
                }
            })
            .sum();
        if cnt == 0 {
            break;
        }
    }
    (total, pack_atomics_inplace(atomics))
}

// 13. createPTPsPair: PseudoPair Pair 变体(16 张,296B)
fn create_pt_pspair(
    index1: u64,
    index2: u64,
    size1: u64,
    size2: u64,
    depth: u32,
    t1: &[u32], // mt_edge stride 18,值 = 2*pos+ori
    t2: &[u32], // mt_corn
) -> (u64, Vec<u8>) {
    let total = size1 * size2;
    let mut tmp = vec![255u8; total as usize];
    tmp[(index1 * size2 + index2) as usize] = 0;
    for k in 3..=5usize {
        let n_ed = t1[(index1 * 18) as usize + k] as u64;
        let n_cn = t2[(index2 * 18) as usize + k] as u64;
        tmp[(n_ed * size2 + n_cn) as usize] = 0;
    }

    let (am, tmp_moves): (&[&str], &[i32]) = match index1 {
        0 => (&["L U L'", "L U' L'", "B' U B", "B' U' B"], &[0, 3, 4, 5]),
        2 => (&["R' U R", "R' U' R", "B U B'", "B U' B'"], &[5, 0, 3, 4]),
        4 => (&["R U R'", "R U' R'", "F' U F", "F' U' F"], &[4, 5, 0, 3]),
        6 => (&["L' U L", "L' U' L", "F U F'", "F U' F'"], &[3, 4, 5, 0]),
        _ => panic!("createPTPsPair: bad index1 {}", index1),
    };

    let sel = (index2 / 3 - 4) as usize;
    for i in 0..4 {
        let mut i1 = index1 as usize;
        let mut i2 = index2 as usize;
        let mv0 = tmp_moves[sel] as usize;
        i1 = t1[i1 * 18 + mv0] as usize;
        i2 = t2[i2 * 18 + mv0] as usize;
        for m in string_to_alg(am[i]) {
            i1 = t1[i1 * 18 + m.index()] as usize;
            i2 = t2[i2 * 18 + m.index()] as usize;
        }
        tmp[(i1 as u64 * size2 + i2 as u64) as usize] = 0;
        for k in 3..=5usize {
            let n_ed = t1[i1 * 18 + k] as u64;
            let n_cn = t2[i2 * 18 + k] as u64;
            tmp[(n_ed * size2 + n_cn) as usize] = 0;
        }
        // U(0) chain
        let i1_u = t1[i1 * 18] as usize;
        let i2_u = t2[i2 * 18] as usize;
        tmp[(i1_u as u64 * size2 + i2_u as u64) as usize] = 0;
        for k in 3..=5usize {
            let n_ed = t1[i1_u * 18 + k] as u64;
            let n_cn = t2[i2_u * 18 + k] as u64;
            tmp[(n_ed * size2 + n_cn) as usize] = 0;
        }
        // off=1,2 similar branches
        for off in [1usize, 2] {
            let i1_o = t1[i1 * 18 + off] as usize;
            let i2_o = t2[i2 * 18 + off] as usize;
            tmp[(i1_o as u64 * size2 + i2_o as u64) as usize] = 0;
            for k in 3..=5usize {
                let n_ed = t1[i1_o * 18 + k] as u64;
                let n_cn = t2[i2_o * 18 + k] as u64;
                tmp[(n_ed * size2 + n_cn) as usize] = 0;
            }
        }
    }

    let atomics: Vec<AtomicU8> = tmp.into_iter().map(AtomicU8::new).collect();
    for d in 0..depth {
        let nd = d as u8 + 1;
        let cnt: u64 = (0..total)
            .into_par_iter()

            .map(|i| {
                if atomics[i as usize].load(Ordering::Relaxed) == d as u8 {
                    let i1 = (i / size2) as usize * 18;
                    let i2 = (i % size2) as usize * 18;
                    for j in 0..18 {
                        let ni = t1[i1 + j] as u64 * size2 + t2[i2 + j] as u64;
                        cas_unvisited(&atomics[ni as usize], nd);
                    }
                    1u64
                } else {
                    0
                }
            })
            .sum();
        if cnt == 0 {
            break;
        }
    }
    (total, pack_atomics_inplace(atomics))
}

// ==================================================================
// gen_pt_xxx: 把每个 BFS 引擎挂接到 PruneTableManager
// ==================================================================

const CORNER_INDICES: [u64; 4] = [12, 15, 18, 21]; // C4..C7
const EDGE_INDICES: [u64; 4] = [0, 2, 4, 6]; // E0..E3

// ---------- 共享表 ----------

pub fn gen_pt_cross(_pmgr: &PruneTableManager) -> (u64, Vec<u8>) {
    let mtm = mt::instance();
    let e2 = mtm.ensure_edge2();
    create_pt_cross_or_pscross(false, e2.as_u32())
}

pub fn gen_pt_cross_ins_c4(_pmgr: &PruneTableManager) -> (u64, Vec<u8>) {
    let mtm = mt::instance();
    let e4 = mtm.ensure_edge4();
    let cn = mtm.ensure_corn();
    create_pt_cross_ins_c(
        state_space::CROSS_SOLVED as u64,
        12,
        state_space::CROSS as u64,
        state_space::CORNER as u64,
        10,
        e4.as_u32(),
        cn.as_u32(),
    )
}

pub fn gen_pt_pair_c4e0(_pmgr: &PruneTableManager) -> (u64, Vec<u8>) {
    let mtm = mt::instance();
    let ed = mtm.ensure_edge();
    let cn = mtm.ensure_corn();
    create_pt_pair_basic(
        0,  // E0
        12, // C4
        state_space::EDGE as u64,
        state_space::CORNER as u64,
        8,
        ed.as_u32(),
        cn.as_u32(),
    )
}

pub fn gen_pt_cross_c4e0(_pmgr: &PruneTableManager) -> (u64, Vec<u8>) {
    let mtm = mt::instance();
    let e4 = mtm.ensure_edge4();
    let cn = mtm.ensure_corn();
    let ed = mtm.ensure_edge();
    create_pt_cross_ce(
        state_space::CROSS_SOLVED as u64,
        12, 0,
        state_space::CROSS as u64,
        state_space::CORNER as u64,
        state_space::EDGE as u64,
        11,
        e4.as_u32(),
        cn.as_u32(),
        ed.as_u32(),
        false,
    )
}

pub fn gen_pt_cross_c4c5e0e1(_pmgr: &PruneTableManager) -> (u64, Vec<u8>) {
    let mtm = mt::instance();
    let e6 = mtm.ensure_edge6();
    let c2 = mtm.ensure_corn2();
    create_pt_edge6_corn2(
        state_space::EDGE6 as u64,
        state_space::CORNER2 as u64,
        15,
        &[0, 2, 16, 18, 20, 22],
        &[12, 15],
        e6.as_u32(),
        c2.as_u32(),
    )
}

pub fn gen_pt_cross_c4c6e0e2(_pmgr: &PruneTableManager) -> (u64, Vec<u8>) {
    let mtm = mt::instance();
    let e6 = mtm.ensure_edge6();
    let c2 = mtm.ensure_corn2();
    create_pt_edge6_corn2(
        state_space::EDGE6 as u64,
        state_space::CORNER2 as u64,
        15,
        &[0, 4, 16, 18, 20, 22],
        &[12, 18],
        e6.as_u32(),
        c2.as_u32(),
    )
}

// ---------- Pseudo ----------

pub fn gen_pt_pscross(_pmgr: &PruneTableManager) -> (u64, Vec<u8>) {
    let mtm = mt::instance();
    let e2 = mtm.ensure_edge2();
    create_pt_cross_or_pscross(true, e2.as_u32())
}

fn gen_pt_pscross_c4e_n(i: usize) -> (u64, Vec<u8>) {
    let mtm = mt::instance();
    let e4 = mtm.ensure_edge4();
    let cn = mtm.ensure_corn();
    let ed = mtm.ensure_edge();
    let e_diff = EDGE_INDICES[i];
    create_pt_cross_ce(
        state_space::CROSS_SOLVED as u64,
        12,
        e_diff,
        state_space::CROSS as u64,
        state_space::CORNER as u64,
        state_space::EDGE as u64,
        11,
        e4.as_u32(),
        cn.as_u32(),
        ed.as_u32(),
        true,
    )
}

pub fn gen_pt_pscross_c4e0(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_c4e_n(0) }
pub fn gen_pt_pscross_c4e1(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_c4e_n(1) }
pub fn gen_pt_pscross_c4e2(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_c4e_n(2) }
pub fn gen_pt_pscross_c4e3(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_c4e_n(3) }

// pscross_E0E1 = Edge2(0,1) ; pscross_E0E2 = Edge2(0,2)
fn gen_pt_pscross_edge2(a: i32, b: i32) -> (u64, Vec<u8>) {
    let mtm = mt::instance();
    let e4 = mtm.ensure_edge4();
    let e2 = mtm.ensure_edge2();
    let mut target = [a * 2, b * 2];
    target.sort();
    let idx_solved = array_to_index(&target, 2, 2, 12) as u64;
    create_pt_pscross_aux2(
        state_space::CROSS_SOLVED as u64,
        idx_solved,
        state_space::CROSS as u64,
        state_space::EDGE2 as u64,
        11,
        e4.as_u32(),
        e2.as_u32(),
    )
}

pub fn gen_pt_pscross_e0e1(_p: &PruneTableManager) -> (u64, Vec<u8>) {
    gen_pt_pscross_edge2(0, 1)
}
pub fn gen_pt_pscross_e0e2(_p: &PruneTableManager) -> (u64, Vec<u8>) {
    gen_pt_pscross_edge2(0, 2)
}

// pscross_E0E1E2 = Edge3(0,1,2)
fn gen_pt_pscross_edge3(a: i32, b: i32, c: i32) -> (u64, Vec<u8>) {
    let mtm = mt::instance();
    let e4 = mtm.ensure_edge4();
    let e3 = mtm.ensure_edge3();
    let mut target = [a * 2, b * 2, c * 2];
    target.sort();
    let idx_solved = array_to_index(&target, 3, 2, 12) as u64;
    create_pt_pscross_aux2(
        state_space::CROSS_SOLVED as u64,
        idx_solved,
        state_space::CROSS as u64,
        state_space::EDGE3 as u64,
        12,
        e4.as_u32(),
        e3.as_u32(),
    )
}

pub fn gen_pt_pscross_e0e1e2(_p: &PruneTableManager) -> (u64, Vec<u8>) {
    gen_pt_pscross_edge3(0, 1, 2)
}

// pscross_C4C5 = Corner2(4,5)
fn gen_pt_pscross_corner2(a: i32, b: i32) -> (u64, Vec<u8>) {
    let mtm = mt::instance();
    let e4 = mtm.ensure_edge4();
    let c2 = mtm.ensure_corn2();
    let mut target = [a * 3, b * 3];
    target.sort();
    let idx_solved = array_to_index(&target, 2, 3, 8) as u64;
    create_pt_pscross_aux2(
        state_space::CROSS_SOLVED as u64,
        idx_solved,
        state_space::CROSS as u64,
        state_space::CORNER2 as u64,
        11,
        e4.as_u32(),
        c2.as_u32(),
    )
}

pub fn gen_pt_pscross_c4c5(_p: &PruneTableManager) -> (u64, Vec<u8>) {
    gen_pt_pscross_corner2(4, 5)
}
pub fn gen_pt_pscross_c4c6(_p: &PruneTableManager) -> (u64, Vec<u8>) {
    gen_pt_pscross_corner2(4, 6)
}

// pscross_C4C5C6 = Corner3(4,5,6)
fn gen_pt_pscross_corner3(a: i32, b: i32, c: i32) -> (u64, Vec<u8>) {
    let mtm = mt::instance();
    let e4 = mtm.ensure_edge4();
    let c3 = mtm.ensure_corn3();
    let mut target = [a * 3, b * 3, c * 3];
    target.sort();
    let idx_solved = array_to_index(&target, 3, 3, 8) as u64;
    create_pt_pscross_aux2(
        state_space::CROSS_SOLVED as u64,
        idx_solved,
        state_space::CROSS as u64,
        state_space::CORNER3 as u64,
        13,
        e4.as_u32(),
        c3.as_u32(),
    )
}

pub fn gen_pt_pscross_c4c5c6(_p: &PruneTableManager) -> (u64, Vec<u8>) {
    gen_pt_pscross_corner3(4, 5, 6)
}

// ---------- PseudoPair 变体: PsCrossC{c+4} / PsCrossInsC{c+4}Diff{e} / PspairCE ----------

fn gen_pt_pscross_c_n(c: usize) -> (u64, Vec<u8>) {
    let mtm = mt::instance();
    let e4 = mtm.ensure_edge4();
    let cn = mtm.ensure_corn();
    create_pt_pscross_corn(CORNER_INDICES[c], 10, e4.as_u32(), cn.as_u32())
}

pub fn gen_pt_pscross_c4(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_c_n(0) }
pub fn gen_pt_pscross_c5(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_c_n(1) }
pub fn gen_pt_pscross_c6(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_c_n(2) }
pub fn gen_pt_pscross_c7(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_c_n(3) }

// ins_C_diff[e*4+c]:c=corner slot, e=edge diff
fn gen_pt_pscross_ins_c_diff_n(c: usize, e: usize) -> (u64, Vec<u8>) {
    let mtm = mt::instance();
    let e4 = mtm.ensure_edge4();
    let cn = mtm.ensure_corn();
    create_pt_pscross_ins_c(EDGE_INDICES[e], CORNER_INDICES[c], 10, e4.as_u32(), cn.as_u32())
}

// 一组 16 个函数,每个都 fn(&PruneTableManager) -> (u64, Vec<u8>) 形态。
pub fn gen_pt_pscross_ins_c4_diff0(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_ins_c_diff_n(0, 0) }
pub fn gen_pt_pscross_ins_c4_diff1(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_ins_c_diff_n(0, 1) }
pub fn gen_pt_pscross_ins_c4_diff2(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_ins_c_diff_n(0, 2) }
pub fn gen_pt_pscross_ins_c4_diff3(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_ins_c_diff_n(0, 3) }
pub fn gen_pt_pscross_ins_c5_diff0(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_ins_c_diff_n(1, 0) }
pub fn gen_pt_pscross_ins_c5_diff1(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_ins_c_diff_n(1, 1) }
pub fn gen_pt_pscross_ins_c5_diff2(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_ins_c_diff_n(1, 2) }
pub fn gen_pt_pscross_ins_c5_diff3(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_ins_c_diff_n(1, 3) }
pub fn gen_pt_pscross_ins_c6_diff0(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_ins_c_diff_n(2, 0) }
pub fn gen_pt_pscross_ins_c6_diff1(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_ins_c_diff_n(2, 1) }
pub fn gen_pt_pscross_ins_c6_diff2(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_ins_c_diff_n(2, 2) }
pub fn gen_pt_pscross_ins_c6_diff3(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_ins_c_diff_n(2, 3) }
pub fn gen_pt_pscross_ins_c7_diff0(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_ins_c_diff_n(3, 0) }
pub fn gen_pt_pscross_ins_c7_diff1(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_ins_c_diff_n(3, 1) }
pub fn gen_pt_pscross_ins_c7_diff2(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_ins_c_diff_n(3, 2) }
pub fn gen_pt_pscross_ins_c7_diff3(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_pscross_ins_c_diff_n(3, 3) }

// 索引数组: PSCROSS_INS_C_DIFF_GENS[c*4+e]
pub const PSCROSS_INS_C_DIFF_GENS: [fn(&PruneTableManager) -> (u64, Vec<u8>); 16] = [
    gen_pt_pscross_ins_c4_diff0, gen_pt_pscross_ins_c4_diff1,
    gen_pt_pscross_ins_c4_diff2, gen_pt_pscross_ins_c4_diff3,
    gen_pt_pscross_ins_c5_diff0, gen_pt_pscross_ins_c5_diff1,
    gen_pt_pscross_ins_c5_diff2, gen_pt_pscross_ins_c5_diff3,
    gen_pt_pscross_ins_c6_diff0, gen_pt_pscross_ins_c6_diff1,
    gen_pt_pscross_ins_c6_diff2, gen_pt_pscross_ins_c6_diff3,
    gen_pt_pscross_ins_c7_diff0, gen_pt_pscross_ins_c7_diff1,
    gen_pt_pscross_ins_c7_diff2, gen_pt_pscross_ins_c7_diff3,
];

// pt_pspair_CE[e*4+c] — Manager 内部通过 slot 调用,c=slot%4, e=slot/4
pub fn gen_pt_pspair_ce_slot(_p: &PruneTableManager, slot: usize) -> (u64, Vec<u8>) {
    let c = slot % 4;
    let e = slot / 4;
    let mtm = mt::instance();
    let ed = mtm.ensure_edge();
    let cn = mtm.ensure_corn();
    create_pt_pspair(
        EDGE_INDICES[e],
        CORNER_INDICES[c],
        state_space::EDGE as u64,
        state_space::CORNER as u64,
        8,
        ed.as_u32(),
        cn.as_u32(),
    )
}

// ---------- EOCross 专用 ----------

pub fn gen_pt_ep4eo12(_p: &PruneTableManager) -> (u64, Vec<u8>) {
    let mtm = mt::instance();
    let ep4 = mtm.ensure_ep4();
    let eo = mtm.ensure_eo12_alt();
    create_pt_dim2(
        state_space::EP4_SOLVED as u64,
        0,
        state_space::EP4 as u64,
        state_space::EO12 as u64,
        11,
        ep4.as_u32(),
        eo.as_u32(),
    )
}

fn gen_pt_cross_cee(i: usize) -> (u64, Vec<u8>) {
    let mtm = mt::instance();
    let e4 = mtm.ensure_edge4();
    let cn = mtm.ensure_corn();
    let ed = mtm.ensure_edge();
    let idx_extra = EDGE_INDICES[i + 1];
    create_pt_cross_cex(
        state_space::CROSS_SOLVED as u64,
        12, 0, idx_extra,
        state_space::CROSS as u64,
        state_space::CORNER as u64,
        state_space::EDGE as u64,
        state_space::EDGE as u64,
        14,
        e4.as_u32(),
        cn.as_u32(),
        ed.as_u32(),
        ed.as_u32(),
    )
}

pub fn gen_pt_cross_c4e0e1(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_cross_cee(0) }
pub fn gen_pt_cross_c4e0e2(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_cross_cee(1) }
pub fn gen_pt_cross_c4e0e3(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_cross_cee(2) }

fn gen_pt_cross_cce(i: usize) -> (u64, Vec<u8>) {
    let mtm = mt::instance();
    let e4 = mtm.ensure_edge4();
    let cn = mtm.ensure_corn();
    let ed = mtm.ensure_edge();
    let idx_extra = CORNER_INDICES[i + 1];
    create_pt_cross_cex(
        state_space::CROSS_SOLVED as u64,
        12, 0, idx_extra,
        state_space::CROSS as u64,
        state_space::CORNER as u64,
        state_space::EDGE as u64,
        state_space::CORNER as u64,
        14,
        e4.as_u32(),
        cn.as_u32(),
        ed.as_u32(),
        cn.as_u32(),
    )
}

pub fn gen_pt_cross_c4c5e0(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_cross_cce(0) }
pub fn gen_pt_cross_c4c6e0(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_cross_cce(1) }
pub fn gen_pt_cross_c4c7e0(_p: &PruneTableManager) -> (u64, Vec<u8>) { gen_pt_cross_cce(2) }

pub fn gen_pt_cross_c4c5c6(_p: &PruneTableManager) -> (u64, Vec<u8>) {
    let mtm = mt::instance();
    let e4 = mtm.ensure_edge4();
    let cn = mtm.ensure_corn();
    create_pt_cross_ccc(
        state_space::CROSS_SOLVED as u64,
        12, 15, 18,
        state_space::CROSS as u64,
        state_space::CORNER as u64,
        state_space::CORNER as u64,
        state_space::CORNER as u64,
        14,
        e4.as_u32(),
        cn.as_u32(),
        cn.as_u32(),
        cn.as_u32(),
    )
}

// 防止 Move 引入未使用 lint
#[allow(dead_code)]
fn _link_move(_: Move) {}
