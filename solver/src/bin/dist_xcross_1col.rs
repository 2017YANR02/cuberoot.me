//! dist_xcross_1col: 三阶魔方单色底不固定槽 XCross 深度分布
//!
//! 移植自 D:\cube\solver_wip\xcross_1_col\xcross_1_col.cpp
//!
//! 算法:
//!   1. 单色 cross 状态空间 190080,4 个 F2L 槽 (BL/BR/FR/FL)
//!   2. BL 槽 BFS 表 + BR 槽 BFS 表 (各 109 MB byte),y2 对称推导 FR/FL
//!   3. 每个 cross 状态在 8 free 棱 × 8 free 角上做累积直方图
//!   4. L (BL+BR 4-term permanent) 和 R (FR+FL ...)
//!   5. 对所有 28×28 disjoint mask pair (i,j) 累加 L[i][k] * R[j][k]
//!   6. exact_counts[d] = total[d] - total[d+1]
//!
//! 预期输出:total = 695,280,402,432,000;max depth = 10

use std::time::Instant;

use rayon::prelude::*;

use cube_solver::cube_common::{array_to_index, index_to_array, state_space};
use cube_solver::dist::bfs::bfs_byte;
use cube_solver::dist::mask::{disjoint_adj_28x28, mask_lookup, NUM_MASKS};
use cube_solver::move_tables;

// ---------- 全局尺寸 ----------

const SZ_CR: usize = state_space::CROSS;
const SZ_CN: usize = state_space::CORNER;
const SZ_ED: usize = state_space::EDGE;
const STRIDE: usize = SZ_CN * SZ_ED; // 576
const TOTAL: usize = SZ_CR * STRIDE;

const Y2_CORN: [usize; 8] = [2, 3, 0, 1, 6, 7, 4, 5];
const Y2_EDGE: [usize; 12] = [2, 3, 0, 1, 6, 7, 4, 5, 10, 11, 8, 9];

const D_BINS: usize = 16; // 深度桶上限 (实际 ≤ 10), 16 个对齐 AVX2 两 chunk

// ---------- 预计算辅助 ----------

struct Aux {
    cross_y2_map: Vec<u32>,
    mask_lookup: [[u8; 2]; NUM_MASKS],
    adj_flat: Vec<u16>,
    adj_off: Vec<u32>,
}

impl Aux {
    fn new() -> Self {
        let mut cross_y2_map = vec![0u32; SZ_CR];
        let mut p = [0i32; 4];
        let mut p_unscaled = [0i32; 4];
        for i in 0..SZ_CR {
            index_to_array(&mut p, i as i32, 4, 2, 12);
            let p_perm = [p[2], p[3], p[0], p[1]];
            let mut p_transformed = [0i32; 4];
            for k in 0..4 {
                let val = p_perm[k] / 18;
                let pos = (val / 2) as usize;
                let ori = val % 2;
                p_transformed[k] = 18 * (2 * Y2_EDGE[pos] as i32 + ori);
            }
            for k in 0..4 {
                p_unscaled[k] = p_transformed[k] / 18;
            }
            cross_y2_map[i] = array_to_index(&p_unscaled, 4, 2, 12) as u32;
        }
        let (adj_flat, adj_off) = disjoint_adj_28x28();
        Aux {
            cross_y2_map,
            mask_lookup: mask_lookup(),
            adj_flat,
            adj_off,
        }
    }
}

// ---------- AVX2 内核 ----------

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx2")]
unsafe fn build_lr_avx2(
    valid_ge_k: &[i16; 4 * 8 * 8 * D_BINS],
    mask_lookup: &[[u8; 2]; NUM_MASKS],
    l_mat: &mut [Row16; 784],
    r_mat: &mut [Row16; 784],
) {
    use std::arch::x86_64::*;
    let base = valid_ge_k.as_ptr();
    let load_i32 = |slot: usize, u: usize, v: usize, k: usize| -> __m256i {
        let p = base.add(slot * 1024 + u * 128 + v * 16 + k);
        _mm256_cvtepi16_epi32(_mm_loadu_si128(p as *const __m128i))
    };

    for i in 0..NUM_MASKS {
        let c1 = *mask_lookup.get_unchecked(i).get_unchecked(0) as usize;
        let c2 = *mask_lookup.get_unchecked(i).get_unchecked(1) as usize;
        for j in 0..NUM_MASKS {
            let idx = i * NUM_MASKS + j;
            let e1 = *mask_lookup.get_unchecked(j).get_unchecked(0) as usize;
            let e2 = *mask_lookup.get_unchecked(j).get_unchecked(1) as usize;

            let lp = l_mat.get_unchecked_mut(idx).0.as_mut_ptr();
            let rp = r_mat.get_unchecked_mut(idx).0.as_mut_ptr();

            for chunk in [0usize, 8] {
                let v0_c1e1 = load_i32(0, c1, e1, chunk);
                let v0_c1e2 = load_i32(0, c1, e2, chunk);
                let v0_c2e1 = load_i32(0, c2, e1, chunk);
                let v0_c2e2 = load_i32(0, c2, e2, chunk);
                let v1_c1e1 = load_i32(1, c1, e1, chunk);
                let v1_c1e2 = load_i32(1, c1, e2, chunk);
                let v1_c2e1 = load_i32(1, c2, e1, chunk);
                let v1_c2e2 = load_i32(1, c2, e2, chunk);
                let t1 = _mm256_mullo_epi32(v0_c1e1, v1_c2e2);
                let t2 = _mm256_mullo_epi32(v0_c1e2, v1_c2e1);
                let t3 = _mm256_mullo_epi32(v0_c2e1, v1_c1e2);
                let t4 = _mm256_mullo_epi32(v0_c2e2, v1_c1e1);
                let sum_l = _mm256_add_epi32(_mm256_add_epi32(t1, t2), _mm256_add_epi32(t3, t4));
                _mm256_store_si256(lp.add(chunk) as *mut __m256i, sum_l);

                let v2_c1e1 = load_i32(2, c1, e1, chunk);
                let v2_c1e2 = load_i32(2, c1, e2, chunk);
                let v2_c2e1 = load_i32(2, c2, e1, chunk);
                let v2_c2e2 = load_i32(2, c2, e2, chunk);
                let v3_c1e1 = load_i32(3, c1, e1, chunk);
                let v3_c1e2 = load_i32(3, c1, e2, chunk);
                let v3_c2e1 = load_i32(3, c2, e1, chunk);
                let v3_c2e2 = load_i32(3, c2, e2, chunk);
                let u1 = _mm256_mullo_epi32(v2_c1e1, v3_c2e2);
                let u2 = _mm256_mullo_epi32(v2_c1e2, v3_c2e1);
                let u3 = _mm256_mullo_epi32(v2_c2e1, v3_c1e2);
                let u4 = _mm256_mullo_epi32(v2_c2e2, v3_c1e1);
                let sum_r = _mm256_add_epi32(_mm256_add_epi32(u1, u2), _mm256_add_epi32(u3, u4));
                _mm256_store_si256(rp.add(chunk) as *mut __m256i, sum_r);
            }
        }
    }
}

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx2")]
unsafe fn aggregate_avx2(
    l_mat: &[Row16; 784],
    r_mat: &[Row16; 784],
    adj_flat: &[u16],
    adj_off: &[u32],
    acc: &mut [i64; D_BINS],
) {
    use std::arch::x86_64::*;
    let mut acc0_lo = _mm256_setzero_si256();
    let mut acc0_hi = _mm256_setzero_si256();
    let mut acc1_lo = _mm256_setzero_si256();
    let mut acc1_hi = _mm256_setzero_si256();

    for i in 0..784usize {
        let start = *adj_off.get_unchecked(i) as usize;
        let end = *adj_off.get_unchecked(i + 1) as usize;
        if start == end {
            continue;
        }
        let lp = l_mat.get_unchecked(i).0.as_ptr();
        let l_chunk0 = _mm256_load_si256(lp as *const __m256i);
        let l_chunk1 = _mm256_load_si256(lp.add(8) as *const __m256i);
        let l_chunk0_swap = _mm256_shuffle_epi32(l_chunk0, 0xB1);
        let l_chunk1_swap = _mm256_shuffle_epi32(l_chunk1, 0xB1);

        for &ni in adj_flat.get_unchecked(start..end) {
            let rp = r_mat.get_unchecked(ni as usize).0.as_ptr();
            let r_chunk0 = _mm256_load_si256(rp as *const __m256i);
            let r_chunk1 = _mm256_load_si256(rp.add(8) as *const __m256i);

            acc0_lo = _mm256_add_epi64(acc0_lo, _mm256_mul_epu32(l_chunk0, r_chunk0));
            let r_chunk0_swap = _mm256_shuffle_epi32(r_chunk0, 0xB1);
            acc0_hi = _mm256_add_epi64(acc0_hi, _mm256_mul_epu32(l_chunk0_swap, r_chunk0_swap));

            acc1_lo = _mm256_add_epi64(acc1_lo, _mm256_mul_epu32(l_chunk1, r_chunk1));
            let r_chunk1_swap = _mm256_shuffle_epi32(r_chunk1, 0xB1);
            acc1_hi = _mm256_add_epi64(acc1_hi, _mm256_mul_epu32(l_chunk1_swap, r_chunk1_swap));
        }
    }

    let mut buf = [0i64; 4];
    _mm256_storeu_si256(buf.as_mut_ptr() as *mut __m256i, acc0_lo);
    acc[0] += buf[0]; acc[2] += buf[1]; acc[4] += buf[2]; acc[6] += buf[3];
    _mm256_storeu_si256(buf.as_mut_ptr() as *mut __m256i, acc0_hi);
    acc[1] += buf[0]; acc[3] += buf[1]; acc[5] += buf[2]; acc[7] += buf[3];
    _mm256_storeu_si256(buf.as_mut_ptr() as *mut __m256i, acc1_lo);
    acc[8] += buf[0]; acc[10] += buf[1]; acc[12] += buf[2]; acc[14] += buf[3];
    _mm256_storeu_si256(buf.as_mut_ptr() as *mut __m256i, acc1_hi);
    acc[9] += buf[0]; acc[11] += buf[1]; acc[13] += buf[2]; acc[15] += buf[3];
}

#[inline(always)]
fn aggregate_scalar(
    l_mat: &[Row16; 784],
    r_mat: &[Row16; 784],
    adj_flat: &[u16],
    adj_off: &[u32],
    acc: &mut [i64; D_BINS],
) {
    for i in 0..784usize {
        let start = adj_off[i] as usize;
        let end = adj_off[i + 1] as usize;
        if start == end {
            continue;
        }
        let l = &l_mat[i].0;
        for &ni in &adj_flat[start..end] {
            let r = &r_mat[ni as usize].0;
            for k in 0..D_BINS {
                acc[k] += (l[k] as i64) * (r[k] as i64);
            }
        }
    }
}

// ---------- Scratch (per-thread buffer) ----------

#[repr(C, align(32))]
#[derive(Copy, Clone)]
pub struct Row16(pub [i32; D_BINS]);

struct Scratch {
    acc: [i64; D_BINS],
    l_mat: Box<[Row16; 784]>,
    r_mat: Box<[Row16; 784]>,
}

impl Scratch {
    fn new() -> Self {
        Scratch {
            acc: [0; D_BINS],
            l_mat: Box::new([Row16([0; D_BINS]); 784]),
            r_mat: Box::new([Row16([0; D_BINS]); 784]),
        }
    }
}

// ---------- 单 cross 状态聚合 ----------

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx2")]
#[inline]
unsafe fn process_cr_avx2(cr: usize, table_bl: &[u8], table_br: &[u8], aux: &Aux, s: &mut Scratch) {
    process_cr(cr, table_bl, table_br, aux, s, true);
}

#[inline(always)]
fn process_cr(
    cr: usize,
    table_bl: &[u8],
    table_br: &[u8],
    aux: &Aux,
    s: &mut Scratch,
    use_avx2: bool,
) {
    let mut p_cross = [0i32; 4];
    index_to_array(&mut p_cross, cr as i32, 4, 2, 12);
    let mut mask_edges_used: u32 = 0;
    for &val in &p_cross {
        mask_edges_used |= 1 << ((val / 18) / 2);
    }
    let mut free_corners = [0u8; 8];
    for i in 0..8 {
        free_corners[i] = i as u8;
    }
    let mut free_edges = [0u8; 8];
    let mut fe = 0;
    for i in 0..12u8 {
        if (mask_edges_used >> i) & 1 == 0 {
            free_edges[fe] = i;
            fe += 1;
        }
    }
    debug_assert_eq!(fe, 8);

    let cr_rot = aux.cross_y2_map[cr] as usize;
    let base0 = cr * STRIDE;
    let base1 = cr_rot * STRIDE;

    let mut local_cache = [[0u8; STRIDE]; 4];
    local_cache[0].copy_from_slice(&table_bl[base0..base0 + STRIDE]);
    local_cache[1].copy_from_slice(&table_br[base0..base0 + STRIDE]);
    local_cache[2].copy_from_slice(&table_bl[base1..base1 + STRIDE]);
    local_cache[3].copy_from_slice(&table_br[base1..base1 + STRIDE]);

    let mut valid_ge_k = [[[[0i16; D_BINS]; 8]; 8]; 4];

    for u in 0..8usize {
        let c_real = free_corners[u] as usize;
        let c_y2 = Y2_CORN[c_real];
        let r0_base = 3 * c_real * 24;
        let r2_base = 3 * c_y2 * 24;

        for v in 0..8usize {
            let e_real = free_edges[v] as usize;
            let e_y2 = Y2_EDGE[e_real];
            let mut h = [[0i32; D_BINS]; 4];

            for co in 0..3usize {
                let off0 = r0_base + co * 24 + e_real * 2;
                let off1 = r2_base + co * 24 + e_y2 * 2;
                h[0][local_cache[0][off0] as usize] += 1;
                h[0][local_cache[0][off0 + 1] as usize] += 1;
                h[1][local_cache[1][off0] as usize] += 1;
                h[1][local_cache[1][off0 + 1] as usize] += 1;
                h[2][local_cache[2][off1] as usize] += 1;
                h[2][local_cache[2][off1 + 1] as usize] += 1;
                h[3][local_cache[3][off1] as usize] += 1;
                h[3][local_cache[3][off1 + 1] as usize] += 1;
            }

            let mut s = [0i32; 4];
            for k in (0..D_BINS - 2).rev() {
                s[0] += h[0][k]; valid_ge_k[0][u][v][k] = s[0] as i16;
                s[1] += h[1][k]; valid_ge_k[1][u][v][k] = s[1] as i16;
                s[2] += h[2][k]; valid_ge_k[2][u][v][k] = s[2] as i16;
                s[3] += h[3][k]; valid_ge_k[3][u][v][k] = s[3] as i16;
            }
        }
    }

    let l_mat = &mut *s.l_mat;
    let r_mat = &mut *s.r_mat;

    #[cfg(target_arch = "x86_64")]
    if use_avx2 {
        let vgk_flat: &[i16; 4 * 8 * 8 * D_BINS] =
            unsafe { &*(valid_ge_k.as_ptr() as *const [i16; 4 * 8 * 8 * D_BINS]) };
        unsafe {
            build_lr_avx2(vgk_flat, &aux.mask_lookup, l_mat, r_mat);
            aggregate_avx2(l_mat, r_mat, &aux.adj_flat, &aux.adj_off, &mut s.acc);
        }
        return;
    }

    // scalar fallback
    for i in 0..NUM_MASKS {
        let c1 = aux.mask_lookup[i][0] as usize;
        let c2 = aux.mask_lookup[i][1] as usize;
        for j in 0..NUM_MASKS {
            let idx = i * NUM_MASKS + j;
            let e1 = aux.mask_lookup[j][0] as usize;
            let e2 = aux.mask_lookup[j][1] as usize;
            for k in 0..D_BINS {
                let v0_c1e1 = valid_ge_k[0][c1][e1][k] as i32;
                let v0_c1e2 = valid_ge_k[0][c1][e2][k] as i32;
                let v0_c2e1 = valid_ge_k[0][c2][e1][k] as i32;
                let v0_c2e2 = valid_ge_k[0][c2][e2][k] as i32;
                let v1_c1e1 = valid_ge_k[1][c1][e1][k] as i32;
                let v1_c1e2 = valid_ge_k[1][c1][e2][k] as i32;
                let v1_c2e1 = valid_ge_k[1][c2][e1][k] as i32;
                let v1_c2e2 = valid_ge_k[1][c2][e2][k] as i32;
                l_mat[idx].0[k] = v0_c1e1 * v1_c2e2
                    + v0_c1e2 * v1_c2e1
                    + v0_c2e1 * v1_c1e2
                    + v0_c2e2 * v1_c1e1;
                let v2_c1e1 = valid_ge_k[2][c1][e1][k] as i32;
                let v2_c1e2 = valid_ge_k[2][c1][e2][k] as i32;
                let v2_c2e1 = valid_ge_k[2][c2][e1][k] as i32;
                let v2_c2e2 = valid_ge_k[2][c2][e2][k] as i32;
                let v3_c1e1 = valid_ge_k[3][c1][e1][k] as i32;
                let v3_c1e2 = valid_ge_k[3][c1][e2][k] as i32;
                let v3_c2e1 = valid_ge_k[3][c2][e1][k] as i32;
                let v3_c2e2 = valid_ge_k[3][c2][e2][k] as i32;
                r_mat[idx].0[k] = v2_c1e1 * v3_c2e2
                    + v2_c1e2 * v3_c2e1
                    + v2_c2e1 * v3_c1e2
                    + v2_c2e2 * v3_c1e1;
            }
        }
    }
    aggregate_scalar(l_mat, r_mat, &aux.adj_flat, &aux.adj_off, &mut s.acc);
    #[cfg(not(target_arch = "x86_64"))]
    let _ = use_avx2;
}

// ---------- 主程序 ----------

fn main() {
    let t_total = Instant::now();
    eprintln!("[Init] Loading move tables (mt_edge / mt_corn / mt_edge4) ...");
    let mgr = move_tables::instance();
    let mt_edge_arc = mgr.ensure_edge();
    let mt_corn_arc = mgr.ensure_corn();
    let mt_multi_arc = mgr.ensure_edge4();
    let mt_edge: Vec<i32> = mt_edge_arc.as_u32().iter().map(|&x| x as i32).collect();
    let mt_corn: Vec<i32> = mt_corn_arc.as_u32().iter().map(|&x| x as i32).collect();
    let mt_multi: Vec<i32> = mt_multi_arc.as_u32().iter().map(|&x| x as i32).collect();

    // BL 槽 BFS:cn=12 (C4 在 DBL, ori=0), ed=0 (E0 在 BL, ori=0)
    let table_bl = build_bfs(187520, 12, 0, &mt_multi, &mt_corn, &mt_edge, "BL Table");
    // BR 槽 BFS:cn=15 (C5 在 DBR, ori=0), ed=2 (E1 在 BR, ori=0)
    let table_br = build_bfs(187520, 15, 2, &mt_multi, &mt_corn, &mt_edge, "BR Table");

    drop(mt_multi); // 不再使用

    let aux = Aux::new();

    let use_avx2 = is_x86_feature_detected!("avx2");
    eprintln!(
        "[Step 4] Aggregating ({})...",
        if use_avx2 { "AVX2 + rayon" } else { "scalar + rayon" }
    );
    let t_agg = Instant::now();

    let total_counts: [i64; D_BINS] = (0..SZ_CR)
        .into_par_iter()
        .with_min_len(64)
        .fold(
            Scratch::new,
            |mut s, cr| {
                #[cfg(target_arch = "x86_64")]
                if use_avx2 {
                    unsafe { process_cr_avx2(cr, &table_bl, &table_br, &aux, &mut s); }
                    return s;
                }
                process_cr(cr, &table_bl, &table_br, &aux, &mut s, use_avx2);
                s
            },
        )
        .map(|s| s.acc)
        .reduce(
            || [0i64; D_BINS],
            |mut a, b| {
                for k in 0..D_BINS {
                    a[k] += b[k];
                }
                a
            },
        );

    eprintln!(" -> Calculation Time: {:.5}s", t_agg.elapsed().as_secs_f64());

    println!("\n=== Final Distribution ===");
    let mut grand_total: i64 = 0;
    let mut exact = [0i64; D_BINS];
    for d in 0..D_BINS - 1 {
        exact[d] = total_counts[d] - total_counts[d + 1];
    }
    for d in 0..D_BINS - 1 {
        if exact[d] > 0 {
            println!("{}\t{}", d, exact[d]);
            grand_total += exact[d];
        }
    }
    println!("total\t{}", grand_total);
    eprintln!("\n[Done] Total elapsed: {:.3}s", t_total.elapsed().as_secs_f64());
}

fn build_bfs(
    idx_cr: usize,
    idx_cn: usize,
    idx_ed: usize,
    mt_multi: &[i32],
    mt_corn: &[i32],
    mt_edge: &[i32],
    name: &str,
) -> Vec<u8> {
    eprintln!("[Step 2] Allocating {}...", name);
    let start_idx = (idx_cr * SZ_CN + idx_cn) * SZ_ED + idx_ed;
    let (table, depth) = bfs_byte(TOTAL, start_idx, |i, out| {
        let cur_ed = i % SZ_ED;
        let tmp = i / SZ_ED;
        let cur_cn = tmp % SZ_CN;
        let cur_cr = tmp / SZ_CN;
        let t1_idx = cur_cr * 24;
        let t2_idx = cur_cn * 18;
        let t3_idx = cur_ed * 18;
        for j in 0..18 {
            let new_cr = (mt_multi[t1_idx + j] / 24) as usize;
            let new_cn = mt_corn[t2_idx + j] as usize;
            let new_ed = mt_edge[t3_idx + j] as usize;
            out[j] = (new_cr * SZ_CN + new_cn) * SZ_ED + new_ed;
        }
    });
    eprintln!("         Max Depth: {}", depth);
    table
}
