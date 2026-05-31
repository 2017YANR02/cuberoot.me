//! 4-bit packed BFS (visited 表每 nibble 存一个深度,0xF=未访问)
//!
//! 用于状态空间 ≥ 10G 的 BFS,把 8-bit byte 减半到 4-bit nibble。
//! - 深度 0..14 直接存,深度 ≥15 全 cap 到 14(本系列实际 max ≤12,够用)
//! - nibble 写入用 AtomicU8 CAS 处理同字节不同 nibble 的竞争
//! - 块扫描用 AVX2 一次比对 64 nibble,跳过全部无 d 的块
//!
//! 当前给 `dist_xxcross_1col_{adj,diag}` 用 — 两者只差 target_edges/target_corners,
//! 共用同一个 `bfs_xxcross_packed4` 入口。后续 xxcross_1col(6-min)若也走 (e×c) layout
//! 可复用;走更复杂 layout 时再加新入口,别强抽象。

use std::sync::atomic::{AtomicU64, AtomicU8, Ordering};

#[cfg(target_arch = "x86_64")]
use std::arch::x86_64::*;

use rayon::prelude::*;

/// 读 nibble。`idx` 是 nibble 序号(状态 index)。
#[inline(always)]
pub fn get_nibble(table: &[u8], idx: usize) -> u8 {
    let byte = table[idx >> 1];
    (byte >> ((idx & 1) << 2)) & 0x0F
}

/// 原子写 nibble:只有当前是 0xF(未访问)时才写入 val。
///
/// SAFETY: `p` 指向有效 packed table,`idx` 在 table 容量内。
#[inline(always)]
pub unsafe fn set_nibble_atomic(p: *mut u8, idx: usize, val: u8) {
    let byte_idx = idx >> 1;
    let shift = ((idx & 1) << 2) as u8;
    let mask = !(0x0F_u8 << shift);
    let new_part = (val & 0x0F) << shift;

    let byte_ptr = &*(p.add(byte_idx) as *const AtomicU8);
    let mut old = byte_ptr.load(Ordering::Relaxed);
    loop {
        if ((old >> shift) & 0x0F) != 0x0F {
            return;
        }
        let desired = (old & mask) | new_part;
        match byte_ptr.compare_exchange_weak(old, desired, Ordering::Relaxed, Ordering::Relaxed) {
            Ok(_) => return,
            Err(actual) => old = actual,
        }
    }
}

/// 2-维 (edge_sz × corn_sz) 状态空间 BFS。
///
/// state_idx = e * corn_sz + c。`mt_edges[e*18+m]` / `mt_corns[c*18+m]` 给出邻居索引。
/// 起点 = `start_e * corn_sz + start_c`,起点深度 = 0。
///
/// 返回 `(packed_table, dist_counts)`:dist_counts[d] = 深度 d 的状态数。
///
/// 内部并行按 edge 维度,每个 edge 顺序扫所有 corner block (64 nibble = 32 byte AVX2 一比对)。
pub fn bfs_xxcross_packed4(
    edge_sz: usize,
    corn_sz: usize,
    start_e: usize,
    start_c: usize,
    mt_edges: &[i32],
    mt_corns: &[i32],
) -> (Vec<u8>, Vec<u64>) {
    let total = edge_sz * corn_sz;
    let packed_len = (total + 1) / 2 + 32; // +32 byte AVX 越界 padding
    let mut table = vec![0xFFu8; packed_len];

    let start_idx = start_e * corn_sz + start_c;
    // SAFETY: start_idx < total,packed_len 已含 padding
    unsafe { set_nibble_atomic(table.as_mut_ptr(), start_idx, 0); }

    let ptr_addr = table.as_mut_ptr() as usize;
    let mt_edges_addr = mt_edges.as_ptr() as usize;
    let mt_corns_addr = mt_corns.as_ptr() as usize;

    let mut dist_counts: Vec<u64> = Vec::new();
    let mut depth: u8 = 0;

    loop {
        let next_d: u8 = if depth + 1 > 14 { 14 } else { depth + 1 };
        let count_atomic = AtomicU64::new(0);

        (0..edge_sz).into_par_iter().with_min_len(128).for_each(|e| {
            let p = ptr_addr as *mut u8;
            let mte = mt_edges_addr as *const i32;
            let mtc = mt_corns_addr as *const i32;
            unsafe {
                // 预取本 e 的 18 个下一步 edge index
                let mut next_e_cache = [0i32; 18];
                let base_mt_e = e * 18;
                for m in 0..18 {
                    next_e_cache[m] = *mte.add(base_mt_e + m);
                }

                let base_state = e * corn_sz;
                let mut local_count: u64 = 0;

                let mut c_base = 0usize;
                while c_base < corn_sz {
                    let remaining = corn_sz - c_base;
                    let limit = if remaining < 64 { remaining } else { 64 };

                    // AVX2 块跳过(只在满 64 + 字节对齐内时)
                    if remaining >= 64 {
                        let nibble_off = base_state + c_base;
                        let byte_off = nibble_off >> 1;
                        let chunk = _mm256_loadu_si256(p.add(byte_off) as *const __m256i);
                        let mask_low = _mm256_set1_epi8(0x0F);
                        let vec_d = _mm256_set1_epi8(depth as i8);
                        let low = _mm256_and_si256(chunk, mask_low);
                        let high = _mm256_and_si256(_mm256_srli_epi16(chunk, 4), mask_low);
                        let cmp_low = _mm256_cmpeq_epi8(low, vec_d);
                        let cmp_high = _mm256_cmpeq_epi8(high, vec_d);
                        let cmp_any = _mm256_or_si256(cmp_low, cmp_high);
                        if _mm256_testz_si256(cmp_any, cmp_any) != 0 {
                            c_base += 64;
                            continue;
                        }
                    }

                    // 标量命中处理(且当 remaining<64 时也走这里)
                    for k in 0..limit {
                        let c = c_base + k;
                        let state_idx = base_state + c;
                        let byte = *p.add(state_idx >> 1);
                        let cur = (byte >> ((state_idx & 1) << 2)) & 0x0F;
                        if cur == depth {
                            local_count += 1;
                            let base_mt_c = c * 18;
                            for m in 0..18 {
                                let ne = *next_e_cache.get_unchecked(m) as usize;
                                let nc = *mtc.add(base_mt_c + m) as usize;
                                let next_idx = ne * corn_sz + nc;
                                let nbyte = *p.add(next_idx >> 1);
                                let ncur = (nbyte >> ((next_idx & 1) << 2)) & 0x0F;
                                if ncur == 0x0F {
                                    set_nibble_atomic(p, next_idx, next_d);
                                }
                            }
                        }
                    }
                    c_base += 64;
                }

                if local_count > 0 {
                    count_atomic.fetch_add(local_count, Ordering::Relaxed);
                }
            }
        });

        let count = count_atomic.load(Ordering::Relaxed);
        if count == 0 {
            break;
        }
        dist_counts.push(count);
        depth += 1;
        if depth >= 20 {
            break; // 保险
        }
    }

    (table, dist_counts)
}
