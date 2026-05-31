//! dist_xcross_2col: 双色底 (白 D / 黄 U) 不固定槽 XCross 深度分布
//!
//! 算法 (cpp xcross_2_col.cpp v33 直译):
//! - 8 张 transposed pruning 表(W_BL/BR/FR/FL + Y_BL/BR/FR/FL),每张 109 MB
//! - D4h 对称 (16 元) 把 190,080 cross state 折叠成 canon reps
//! - 每个 rep × 70 partition(把 8 free slot 分给 W/Y 各 4 个)
//!   × 24 perm × 16 ori × 4 slot × 8 corner 的 AVX2 累加
//! - 输出 11 个深度(d=0..10)总数,总和 = 43,252,003,274,489,856,000(全空间)
//!
//! Ground truth (cpp v33, 877s on 14 threads):
//!   d=0:4716424212835   d=1:70684100048529   d=2:810010675407438
//!   d=3:9164539088016574   d=4:100275129028335625   d=5:988415943046745864
//!   d=6:7571709355823781261   d=7:25284688565714070184
//!   d=8:9286904784514949171   d=9:9959546054057915   d=10:20230604

use std::collections::{BTreeSet, VecDeque};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

#[cfg(target_arch = "x86_64")]
use std::arch::x86_64::*;

use rayon::prelude::*;

use cube_solver::cube_common::{
    array_to_index, create_multi_move_table, index_to_array, state_space,
};
use cube_solver::move_tables;

const SZ_CR: usize = state_space::CROSS; // 190080
const SZ_CN: usize = 24;
const SZ_ED: usize = 24;
const MAX_D: usize = 14;
const SENTINEL: u8 = 15;
const HIST_SIZE: usize = 16;

const GOLDEN: [u128; 11] = [
    4_716_424_212_835,
    70_684_100_048_529,
    810_010_675_407_438,
    9_164_539_088_016_574,
    100_275_129_028_335_625,
    988_415_943_046_745_864,
    7_571_709_355_823_781_261,
    25_284_688_565_714_070_184,
    9_286_904_784_514_949_171,
    9_959_546_054_057_915,
    20_230_604,
];
const THEORETICAL_TOTAL: u128 = 43_252_003_274_489_856_000;

// ===========================================================================
// D4h symmetry (16-elem)
// ===========================================================================

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct SymOp([u8; 12]);

fn init_symmetries() -> Vec<SymOp> {
    // 三个生成元:y (绕竖轴 CCW),x2 (绕水平轴 180°),m (左右镜像)
    // 全部用 cube_common 棱位约定 (0..3=F2L,4..7=U,8..11=D)
    let y = SymOp([3, 0, 1, 2, 7, 4, 5, 6, 11, 8, 9, 10]);
    let x2 = SymOp([3, 2, 1, 0, 10, 9, 8, 11, 6, 5, 4, 7]);
    let m = SymOp([1, 0, 3, 2, 4, 7, 6, 5, 8, 11, 10, 9]);

    let id = SymOp([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    let mut group = BTreeSet::new();
    let mut q = VecDeque::new();
    group.insert(id);
    q.push_back(id);
    let gens = [y, x2, m];
    while let Some(curr) = q.pop_front() {
        for g in &gens {
            let mut next = [0u8; 12];
            for i in 0..12 {
                next[i] = g.0[curr.0[i] as usize];
            }
            let ns = SymOp(next);
            if group.insert(ns) {
                q.push_back(ns);
            }
        }
    }
    assert_eq!(group.len(), 16, "D4h group must have 16 elements");
    group.into_iter().collect()
}

fn apply_symmetry(cr: i32, op: &SymOp) -> i32 {
    let mut p = [0i32; 4];
    index_to_array(&mut p, cr, 4, 2, 12);
    let mut b = [0i32; 4];
    for k in 0..4 {
        let raw = p[k] / 18;
        let pos = (raw / 2) as usize;
        let ori = raw % 2;
        let new_pos = op.0[pos] as i32;
        let target_piece_id = op.0[k] as usize;
        b[target_piece_id] = 2 * new_pos + ori;
    }
    array_to_index(&b, 4, 2, 12)
}

#[derive(Clone, Copy)]
struct RepInfo {
    cr_index: i32,
    weight: u8,
}

fn generate_reps(symmetries: &[SymOp]) -> Vec<RepInfo> {
    let mut visited = vec![false; SZ_CR];
    let mut reps = Vec::new();
    for i in 0..SZ_CR as i32 {
        if visited[i as usize] {
            continue;
        }
        let mut orbit = BTreeSet::new();
        for sym in symmetries {
            orbit.insert(apply_symmetry(i, sym));
        }
        let canon = *orbit.iter().next().unwrap();
        reps.push(RepInfo {
            cr_index: canon,
            weight: orbit.len() as u8,
        });
        for &idx in &orbit {
            visited[idx as usize] = true;
        }
    }
    let total_w: u64 = reps.iter().map(|r| r.weight as u64).sum();
    assert_eq!(total_w as usize, SZ_CR);
    reps
}

// ===========================================================================
// Parity helpers (cross perm + cross EO)
// ===========================================================================

fn get_cross_perm_parity(cr: i32) -> u8 {
    let mut p = [0i32; 4];
    index_to_array(&mut p, cr, 4, 2, 12);
    let mut pos = [0i32; 4];
    let mut is_cross = [false; 12];
    for k in 0..4 {
        pos[k] = (p[k] / 18) / 2;
        is_cross[pos[k] as usize] = true;
    }
    let mut inv = 0i32;
    for i in 0..4 {
        for j in (i + 1)..4 {
            if pos[i] > pos[j] {
                inv += 1;
            }
        }
    }
    for k in 0..4 {
        for s in (pos[k] + 1)..12 {
            if !is_cross[s as usize] {
                inv += 1;
            }
        }
    }
    (inv % 2) as u8
}

fn get_cross_eo_parity(cr: i32) -> u8 {
    let mut p = [0i32; 4];
    index_to_array(&mut p, cr, 4, 2, 12);
    let mut s = 0;
    for k in 0..4 {
        s += (p[k] / 18) % 2;
    }
    (s % 2) as u8
}

// ===========================================================================
// Partitions (70 = C(8,4)) + corner_perms (96 = 8*7*6*3) + mask_map
// ===========================================================================

struct Partitions {
    partitions: Vec<u8>,         // 70 masks (popcount=4) over 8 bits
    parities: [u8; 70],          // partition parity (Lehmer of W/Y interleave)
    complement: [u8; 70],        // index of complement partition
}

fn get_partition_parity(mask: u32) -> u8 {
    let mut w_pos = Vec::new();
    let mut y_pos = Vec::new();
    for i in 0..8 {
        if (mask >> i) & 1 == 1 {
            w_pos.push(i);
        } else {
            y_pos.push(i);
        }
    }
    let mut inv = 0u32;
    for &w in &w_pos {
        for &y in &y_pos {
            if w > y {
                inv += 1;
            }
        }
    }
    (inv % 2) as u8
}

fn init_partitions() -> (Partitions, [i8; 256]) {
    let mut partitions = Vec::with_capacity(70);
    for m in 0u32..256 {
        if m.count_ones() == 4 {
            partitions.push(m as u8);
        }
    }
    // 不打乱 (cpp 用 random_shuffle,我们保持原序 → mask_map 唯一确定,跨运行结果一致)
    let mut mask_map = [-1i8; 256];
    let mut parities = [0u8; 70];
    let mut complement = [0u8; 70];
    for (i, &m) in partitions.iter().enumerate() {
        mask_map[m as usize] = i as i8;
        parities[i] = get_partition_parity(m as u32);
    }
    for (i, &m) in partitions.iter().enumerate() {
        let comp = (!(m as u32)) & 0xFF;
        complement[i] = mask_map[comp as usize] as u8;
    }
    (
        Partitions {
            partitions,
            parities,
            complement,
        },
        mask_map,
    )
}

#[derive(Clone, Copy)]
struct CornerPermInfo {
    indices: [u8; 4],
    mask_idx: u8,
    parity: u8,
}

fn count_inversions(v: &[u8]) -> u32 {
    let mut inv = 0u32;
    for i in 0..v.len() {
        for j in (i + 1)..v.len() {
            if v[i] > v[j] {
                inv += 1;
            }
        }
    }
    inv
}

fn init_corner_perms(mask_map: &[i8; 256]) -> Vec<CornerPermInfo> {
    let mut out = Vec::new();
    for c0 in 0..8u8 {
        for c1 in 0..8u8 {
            if c1 == c0 {
                continue;
            }
            for c2 in 0..8u8 {
                if c2 == c0 || c2 == c1 {
                    continue;
                }
                for c3 in 0..8u8 {
                    if c3 == c0 || c3 == c1 || c3 == c2 {
                        continue;
                    }
                    let mask = (1u32 << c0) | (1 << c1) | (1 << c2) | (1 << c3);
                    let mask_idx = mask_map[mask as usize];
                    debug_assert!(mask_idx >= 0);
                    let s = [c0, c1, c2, c3];
                    let mut sorted = s;
                    sorted.sort();
                    let mut ranks = [0u8; 4];
                    for i in 0..4 {
                        for j in 0..4 {
                            if s[i] == sorted[j] {
                                ranks[i] = j as u8;
                            }
                        }
                    }
                    out.push(CornerPermInfo {
                        indices: s,
                        mask_idx: mask_idx as u8,
                        parity: (count_inversions(&ranks) % 2) as u8,
                    });
                }
            }
        }
    }
    // 按 mask_idx 排序提升 cache 局部性
    out.sort_by_key(|i| i.mask_idx);
    out
}

// ===========================================================================
// hist_lut: hist_lut[d0][d1][d2].v[k_corner_ori][k_depth]
// ===========================================================================

#[repr(C, align(32))]
#[derive(Clone, Copy)]
struct HistLut {
    v: [[i16; 16]; 3],
}

fn init_hist_lut() -> Vec<HistLut> {
    let mut lut = vec![HistLut { v: [[0i16; 16]; 3] }; 16 * 16 * 16];
    for d0 in 0..16usize {
        for d1 in 0..16usize {
            for d2 in 0..16usize {
                let idx = (d0 * 16 + d1) * 16 + d2;
                let invalid = d0 as u8 == SENTINEL || d1 as u8 == SENTINEL || d2 as u8 == SENTINEL;
                for k in 0..16usize {
                    lut[idx].v[0][k] = if !invalid && d0 >= k { 1 } else { 0 };
                    lut[idx].v[1][k] = if !invalid && d1 >= k { 1 } else { 0 };
                    lut[idx].v[2][k] = if !invalid && d2 >= k { 1 } else { 0 };
                }
            }
        }
    }
    lut
}

#[inline(always)]
fn hist_lut_index(d0: u8, d1: u8, d2: u8) -> usize {
    ((d0 as usize) * 16 + (d1 as usize)) * 16 + (d2 as usize)
}

// ===========================================================================
// gen_pruning_transposed: BFS 单 pair (cross + corner + edge) -> transposed [ed][cr][cn]
// ===========================================================================

fn gen_pruning_transposed(
    mt_edge: &[i32],
    mt_corn: &[i32],
    mt_multi: &[i32],
    solved_cr: usize,
    solved_cn: usize,
    solved_ed: usize,
    name: &str,
) -> Vec<u8> {
    let total = SZ_CR * SZ_CN * SZ_ED;
    let mut temp_table = vec![255u8; total];
    let start = ((solved_cr * SZ_CN) + solved_cn) * SZ_ED + solved_ed;
    temp_table[start] = 0;
    let ptr_addr = temp_table.as_mut_ptr() as usize;

    let mut depth: u8 = 0;
    eprint!("[Table] {} ", name);
    loop {
        let count = AtomicU64::new(0);
        (0..total).into_par_iter().with_min_len(4096).for_each(|i| {
            let p = ptr_addr as *mut u8;
            unsafe {
                if *p.add(i) != depth {
                    return;
                }
                let cur_ed = i % SZ_ED;
                let tmp = i / SZ_ED;
                let cur_cn = tmp % SZ_CN;
                let cur_cr = tmp / SZ_CN;
                let mut local = 0u64;
                for m in 0..18 {
                    let new_cr = mt_multi[cur_cr * 18 + m] as usize;
                    let new_cn = mt_corn[cur_cn * 18 + m] as usize;
                    let new_ed = mt_edge[cur_ed * 18 + m] as usize;
                    let ni = (new_cr * SZ_CN + new_cn) * SZ_ED + new_ed;
                    if *p.add(ni) == 255 {
                        *p.add(ni) = depth + 1;
                        local += 1;
                    }
                }
                if local > 0 {
                    count.fetch_add(local, Ordering::Relaxed);
                }
            }
        });
        if count.load(Ordering::Relaxed) == 0 {
            break;
        }
        depth += 1;
    }
    eprint!("max d={} ", depth);

    // 转置 [cr][cn][ed] -> [ed][cr][cn]
    let mut t_final = vec![255u8; total + 64];
    let t_addr = t_final.as_mut_ptr() as usize;
    (0..SZ_CR).into_par_iter().for_each(|cr| {
        let tp = t_addr as *mut u8;
        for cn in 0..SZ_CN {
            for ed in 0..SZ_ED {
                let old_idx = (cr * SZ_CN + cn) * SZ_ED + ed;
                let new_idx = (ed * SZ_CR + cr) * SZ_CN + cn;
                unsafe { *tp.add(new_idx) = temp_table[old_idx]; }
            }
        }
    });
    eprintln!("(transposed)");
    t_final
}

// ===========================================================================
// perms_4 + perm_parity
// ===========================================================================

fn init_perms_4() -> ([[u8; 4]; 24], [u8; 24]) {
    let mut perms = [[0u8; 4]; 24];
    let mut parity = [0u8; 24];
    let mut p = [0u8, 1, 2, 3];
    for pid in 0..24 {
        perms[pid].copy_from_slice(&p);
        parity[pid] = (count_inversions(&p) % 2) as u8;
        // next_permutation
        next_permutation(&mut p);
    }
    (perms, parity)
}

fn next_permutation(a: &mut [u8]) -> bool {
    let n = a.len();
    if n < 2 { return false; }
    let mut i = n - 1;
    while i > 0 && a[i - 1] >= a[i] { i -= 1; }
    if i == 0 { return false; }
    let mut j = n - 1;
    while a[j] <= a[i - 1] { j -= 1; }
    a.swap(i - 1, j);
    a[i..].reverse();
    true
}

#[inline(always)]
fn get_perm_index_optimized(a0: u8, a1: u8, a2: u8, a3: u8) -> u32 {
    let a0 = a0 as u32;
    let a1 = a1 as u32;
    let a2 = a2 as u32;
    let a3 = a3 as u32;
    let term0 = a0;
    let tmp = (a0 < a1) as u32;
    let term1 = (a1 - tmp) * 12;
    let tmp = (a0 < a2) as u32 + (a1 < a2) as u32;
    let term2 = (a2 - tmp) * 132;
    let tmp = (a0 < a3) as u32 + (a1 < a3) as u32 + (a2 < a3) as u32;
    let term3 = (a3 - tmp) * 1320;
    term0 + term1 + term2 + term3
}

// ===========================================================================
// HistBucket: counts[2][2][3][16] = u16  (parity × eo × co × depth)
// ===========================================================================

#[repr(C, align(32))]
#[derive(Clone, Copy)]
struct HistBucket {
    // 平铺为 [parity][eo][co * 16 + k];co=0,1,2 各占连续 16 个 u16
    counts: [[[u16; 48]; 2]; 2],
}

impl HistBucket {
    fn new() -> Self {
        HistBucket { counts: [[[0u16; 48]; 2]; 2] }
    }
    fn clear(&mut self) {
        for p in 0..2 {
            for eo in 0..2 {
                for k in 0..48 {
                    self.counts[p][eo][k] = 0;
                }
            }
        }
    }
}

// ===========================================================================
// CntTable: int16[4][3][8][16] = 4 slot × 3 corner-ori × 8 corner-pos × 16 depth
// ===========================================================================

#[repr(C, align(32))]
struct CntTable {
    data: [[[[i16; 16]; 8]; 3]; 4],
}

impl CntTable {
    fn new() -> Self {
        // SAFETY: all-zero is valid for i16
        unsafe { std::mem::zeroed() }
    }
}

// ===========================================================================
// AVX2 helpers
// ===========================================================================

#[target_feature(enable = "avx2")]
#[inline]
unsafe fn conv3_mixed(a: [__m256i; 3], pb0: *const i16, pb1: *const i16, pb2: *const i16) -> [__m256i; 3] {
    let b0 = _mm256_loadu_si256(pb0 as *const __m256i);
    let b1 = _mm256_loadu_si256(pb1 as *const __m256i);
    let b2 = _mm256_loadu_si256(pb2 as *const __m256i);

    let t0 = _mm256_mullo_epi16(a[0], b0);
    let t0 = _mm256_add_epi16(t0, _mm256_mullo_epi16(a[1], b2));
    let out0 = _mm256_add_epi16(t0, _mm256_mullo_epi16(a[2], b1));

    let t1 = _mm256_mullo_epi16(a[0], b1);
    let t1 = _mm256_add_epi16(t1, _mm256_mullo_epi16(a[1], b0));
    let out1 = _mm256_add_epi16(t1, _mm256_mullo_epi16(a[2], b2));

    let t2 = _mm256_mullo_epi16(a[0], b2);
    let t2 = _mm256_add_epi16(t2, _mm256_mullo_epi16(a[1], b1));
    let out2 = _mm256_add_epi16(t2, _mm256_mullo_epi16(a[2], b0));

    [out0, out1, out2]
}

#[target_feature(enable = "avx2")]
#[inline]
unsafe fn add_to_bucket(vec: __m256i, dst: *mut u16) {
    let cur = _mm256_load_si256(dst as *const __m256i);
    let sum = _mm256_add_epi16(cur, vec);
    _mm256_store_si256(dst as *mut __m256i, sum);
}

#[target_feature(enable = "avx2")]
unsafe fn accumulate_corners(
    cnts: &CntTable,
    buckets: &mut [HistBucket; 70],
    edge_parity: u8,
    eo_val: u8,
    corner_perms: &[CornerPermInfo],
) {
    let mut acc: [[__m256i; 3]; 2] = [
        [_mm256_setzero_si256(); 3],
        [_mm256_setzero_si256(); 3],
    ];
    let mut current_mask = corner_perms[0].mask_idx;

    for info in corner_perms {
        if info.mask_idx != current_mask {
            // flush current_mask
            let b = &mut buckets[current_mask as usize];
            let p0 = b.counts[0][eo_val as usize].as_mut_ptr();
            add_to_bucket(acc[0][0], p0);
            add_to_bucket(acc[0][1], p0.add(16));
            add_to_bucket(acc[0][2], p0.add(32));
            let p1 = b.counts[1][eo_val as usize].as_mut_ptr();
            add_to_bucket(acc[1][0], p1);
            add_to_bucket(acc[1][1], p1.add(16));
            add_to_bucket(acc[1][2], p1.add(32));
            for i in 0..2 {
                for j in 0..3 {
                    acc[i][j] = _mm256_setzero_si256();
                }
            }
            current_mask = info.mask_idx;
        }

        let pid0 = info.indices[0] as usize;
        let pid1 = info.indices[1] as usize;
        let pid2 = info.indices[2] as usize;
        let pid3 = info.indices[3] as usize;

        let v0 = [
            _mm256_loadu_si256(cnts.data[0][0][pid0].as_ptr() as *const __m256i),
            _mm256_loadu_si256(cnts.data[0][1][pid0].as_ptr() as *const __m256i),
            _mm256_loadu_si256(cnts.data[0][2][pid0].as_ptr() as *const __m256i),
        ];
        let t0 = conv3_mixed(
            v0,
            cnts.data[1][0][pid1].as_ptr(),
            cnts.data[1][1][pid1].as_ptr(),
            cnts.data[1][2][pid1].as_ptr(),
        );
        let t1 = conv3_mixed(
            t0,
            cnts.data[2][0][pid2].as_ptr(),
            cnts.data[2][1][pid2].as_ptr(),
            cnts.data[2][2][pid2].as_ptr(),
        );
        let t2 = conv3_mixed(
            t1,
            cnts.data[3][0][pid3].as_ptr(),
            cnts.data[3][1][pid3].as_ptr(),
            cnts.data[3][2][pid3].as_ptr(),
        );

        let p = (info.parity ^ edge_parity) as usize;
        acc[p][0] = _mm256_add_epi16(acc[p][0], t2[0]);
        acc[p][1] = _mm256_add_epi16(acc[p][1], t2[1]);
        acc[p][2] = _mm256_add_epi16(acc[p][2], t2[2]);
    }

    // flush final
    let b = &mut buckets[current_mask as usize];
    let p0 = b.counts[0][eo_val as usize].as_mut_ptr();
    add_to_bucket(acc[0][0], p0);
    add_to_bucket(acc[0][1], p0.add(16));
    add_to_bucket(acc[0][2], p0.add(32));
    let p1 = b.counts[1][eo_val as usize].as_mut_ptr();
    add_to_bucket(acc[1][0], p1);
    add_to_bucket(acc[1][1], p1.add(16));
    add_to_bucket(acc[1][2], p1.add(32));
}

// ===========================================================================
// 主循环:fill CntTable from W/Y pruning rows
// ===========================================================================

#[target_feature(enable = "avx2")]
unsafe fn fill_cnt_for_perm_ori(
    cnt: &mut CntTable,
    ptrs: [*const u8; 4],
    base_cr_offset: usize,
    ori: usize,
    hist_lut: &[HistLut],
) {
    let current_offset = base_cr_offset + ori * SZ_CN;
    for s in 0..4 {
        let t_ptr = ptrs[s].add(current_offset);
        for c in 0..8 {
            // 读 3 字节 d0/d1/d2 (cn = 3c + 0/1/2 = 该 corner 位置的 3 种 ori)
            let raw_depths = *(t_ptr.add(3 * c) as *const u32);
            let mut d0 = (raw_depths & 0xFF) as u8;
            let mut d1 = ((raw_depths >> 8) & 0xFF) as u8;
            let mut d2 = ((raw_depths >> 16) & 0xFF) as u8;
            if d0 > SENTINEL { d0 = SENTINEL; }
            if d1 > SENTINEL { d1 = SENTINEL; }
            if d2 > SENTINEL { d2 = SENTINEL; }
            let lut = &hist_lut[hist_lut_index(d0, d1, d2)];
            let dst0 = cnt.data[s][0][c].as_mut_ptr() as *mut __m256i;
            let dst1 = cnt.data[s][1][c].as_mut_ptr() as *mut __m256i;
            let dst2 = cnt.data[s][2][c].as_mut_ptr() as *mut __m256i;
            _mm256_store_si256(dst0, _mm256_load_si256(lut.v[0].as_ptr() as *const __m256i));
            _mm256_store_si256(dst1, _mm256_load_si256(lut.v[1].as_ptr() as *const __m256i));
            _mm256_store_si256(dst2, _mm256_load_si256(lut.v[2].as_ptr() as *const __m256i));
        }
    }
}

// ===========================================================================
// 单个 canon rep 处理
// ===========================================================================

#[target_feature(enable = "avx2")]
unsafe fn process_rep(
    rep: &RepInfo,
    tables: &[Vec<u8>; 8],
    partitions: &Partitions,
    corner_perms: &[CornerPermInfo],
    hist_lut: &[HistLut],
    perms_4: &[[u8; 4]; 24],
    perm_parity: &[u8; 24],
    thread_hist: &mut [u128; HIST_SIZE],
) {
    let cr = rep.cr_index;
    let weight = rep.weight as u128;
    let cross_perm_parity = get_cross_perm_parity(cr);
    let cross_eo_parity = get_cross_eo_parity(cr);

    let mut p_f2l = [0i32; 4];
    index_to_array(&mut p_f2l, cr, 4, 2, 12);
    // mask_f2l = 位掩码,4 个 cross 棱占的位置
    let mut mask_f2l = 0u32;
    for &x in &p_f2l {
        mask_f2l |= 1 << ((x / 18) / 2);
    }
    let mut free_slots = [0u8; 8];
    let mut fi = 0;
    for j in 0..12 {
        if (mask_f2l >> j) & 1 == 0 {
            free_slots[fi] = j as u8;
            fi += 1;
        }
    }
    debug_assert_eq!(fi, 8);

    let mut f2l_idx = [0usize; 4];
    for j in 0..4 {
        f2l_idx[j] = (p_f2l[j] / 18) as usize;
    }
    let mut ptr_w = [std::ptr::null::<u8>(); 4];
    let mut ptr_y = [std::ptr::null::<u8>(); 4];
    for s in 0..4 {
        ptr_w[s] = tables[s].as_ptr().add(f2l_idx[s] * SZ_CR * SZ_CN);
        ptr_y[s] = tables[s + 4].as_ptr().add(f2l_idx[s] * SZ_CR * SZ_CN);
    }

    let mut cnt_w = CntTable::new();
    let mut cnt_y = CntTable::new();
    let mut w_hist: [HistBucket; 70] = std::array::from_fn(|_| HistBucket::new());
    let mut y_hist: [HistBucket; 70] = std::array::from_fn(|_| HistBucket::new());

    for edge_mask_idx in 0..70usize {
        let mask_part = partitions.partitions[edge_mask_idx] as u32;
        let mut w_slots = [0u8; 4];
        let mut y_slots = [0u8; 4];
        let mut wi = 0;
        let mut yi = 0;
        for j in 0..8 {
            if (mask_part >> j) & 1 == 1 {
                w_slots[wi] = free_slots[j];
                wi += 1;
            } else {
                y_slots[yi] = free_slots[j];
                yi += 1;
            }
        }

        for k in 0..70 {
            w_hist[k].clear();
            y_hist[k].clear();
        }

        // W side: 24 perm × 16 ori
        for p in 0..24usize {
            let perm_idx = get_perm_index_optimized(
                w_slots[perms_4[p][0] as usize],
                w_slots[perms_4[p][1] as usize],
                w_slots[perms_4[p][2] as usize],
                w_slots[perms_4[p][3] as usize],
            ) as usize;
            let base_cr_offset = perm_idx * 16 * SZ_CN;
            let edge_parity = perm_parity[p];
            for ori in 0..16usize {
                let eo_val = (ori.count_ones() % 2) as u8;
                fill_cnt_for_perm_ori(&mut cnt_w, ptr_w, base_cr_offset, ori, hist_lut);
                accumulate_corners(&cnt_w, &mut w_hist, edge_parity, eo_val, corner_perms);
            }
        }
        // Y side: same
        for p in 0..24usize {
            let perm_idx = get_perm_index_optimized(
                y_slots[perms_4[p][0] as usize],
                y_slots[perms_4[p][1] as usize],
                y_slots[perms_4[p][2] as usize],
                y_slots[perms_4[p][3] as usize],
            ) as usize;
            let base_cr_offset = perm_idx * 16 * SZ_CN;
            let edge_parity = perm_parity[p];
            for ori in 0..16usize {
                let eo_val = (ori.count_ones() % 2) as u8;
                fill_cnt_for_perm_ori(&mut cnt_y, ptr_y, base_cr_offset, ori, hist_lut);
                accumulate_corners(&cnt_y, &mut y_hist, edge_parity, eo_val, corner_perms);
            }
        }

        let part_parity = partitions.parities[edge_mask_idx];

        for m_c in 0..70usize {
            let cp_parity = partitions.parities[m_c];
            let total_perm_parity = part_parity ^ cp_parity ^ cross_perm_parity;
            let wh = &w_hist[m_c];
            let yh = &y_hist[partitions.complement[m_c] as usize];

            for k in 0..=MAX_D {
                let mut local_sum = 0u128;
                for p in 0..2usize {
                    let target_p = p ^ total_perm_parity as usize;
                    for eo in 0..2usize {
                        let target_eo = eo ^ cross_eo_parity as usize;
                        for co in 0..3usize {
                            let target_co = (3 - co) % 3;
                            // counts 平铺 [co][k] = counts[p][eo][co*16+k]
                            let w_val = wh.counts[p][eo][co * 16 + k] as u128;
                            let y_val = yh.counts[target_p][target_eo][target_co * 16 + k] as u128;
                            local_sum += w_val * y_val;
                        }
                    }
                }
                thread_hist[k] += local_sum * weight;
            }
        }
    }
}

// ===========================================================================
// main
// ===========================================================================

fn main() {
    let t0 = Instant::now();
    if std::env::var("CUBE_ALLOW_HUGE_TABLES").ok().as_deref() != Some("1") {
        eprintln!("set CUBE_ALLOW_HUGE_TABLES=1 (will allocate 8 × 109 MB tables ~ 1 GB)");
        std::process::exit(1);
    }

    eprintln!("[init] move tables...");
    let mgr = move_tables::instance();
    let mt_edge: Vec<i32> = mgr.ensure_edge().as_u32().iter().map(|&x| x as i32).collect();
    let mt_corn: Vec<i32> = mgr.ensure_corn().as_u32().iter().map(|&x| x as i32).collect();
    // mt_multi (4-edge cross,stride 18 raw idx)
    let mt_multi = create_multi_move_table(4, 2, 12, SZ_CR as i32, &mt_edge);

    eprintln!("[init] D4h symmetries + canon reps...");
    let symmetries = init_symmetries();
    let reps = generate_reps(&symmetries);
    eprintln!("       {} reps (reduction {:.2}x)",
              reps.len(), SZ_CR as f64 / reps.len() as f64);

    eprintln!("[init] partitions, corner_perms, hist_lut...");
    let (partitions, mask_map) = init_partitions();
    let corner_perms = init_corner_perms(&mask_map);
    let hist_lut = init_hist_lut();
    let (perms_4, perm_parity) = init_perms_4();

    eprintln!("[tables] generating 8 transposed pruning tables (~872 MB)...");
    // W:cross 187520 (D 层 solved),corner C4=12,C5=15,C6=18,C7=21,edge E0=0,E1=2,E2=4,E3=6
    // Y:cross 由 array_to_index([8,10,12,14],4,2,12) 给出 (U 层 solved)
    let yc_cr = array_to_index(&[8, 10, 12, 14], 4, 2, 12) as usize;
    let table_specs = [
        (187520usize, 12, 0, "W_BL"),
        (187520, 15, 2, "W_BR"),
        (187520, 18, 4, "W_FR"),
        (187520, 21, 6, "W_FL"),
        (yc_cr,    0,  0, "Y_BL"),  // C0=0 (UBL),E0=0 (BL)
        (yc_cr,    3,  2, "Y_BR"),  // C1=3 (UBR),E1=2 (BR)
        (yc_cr,    6,  4, "Y_FR"),  // C2=6 (UFR),E2=4 (FR)
        (yc_cr,    9,  6, "Y_FL"),  // C3=9 (UFL),E3=6 (FL)
    ];
    let tables: [Vec<u8>; 8] = std::array::from_fn(|i| {
        let (cr, cn, ed, name) = table_specs[i];
        gen_pruning_transposed(&mt_edge, &mt_corn, &mt_multi, cr, cn, ed, name)
    });
    eprintln!("[tables] done @ {:.1}s", t0.elapsed().as_secs_f64());

    eprintln!("[solve] processing {} reps in parallel...", reps.len());
    let solve_t = Instant::now();

    let final_hist: [u128; HIST_SIZE] = reps
        .par_iter()
        .fold(
            || [0u128; HIST_SIZE],
            |mut acc, rep| {
                unsafe {
                    process_rep(
                        rep,
                        &tables,
                        &partitions,
                        &corner_perms,
                        &hist_lut,
                        &perms_4,
                        &perm_parity,
                        &mut acc,
                    );
                }
                acc
            },
        )
        .reduce(
            || [0u128; HIST_SIZE],
            |mut a, b| {
                for k in 0..HIST_SIZE {
                    a[k] += b[k];
                }
                a
            },
        );

    let solve_secs = solve_t.elapsed().as_secs_f64();
    eprintln!("[solve] done @ {:.1}s", solve_secs);

    // 输出 (ge[k] → raw[k] = ge[k] - ge[k+1])
    println!();
    println!("=== Dual X-Cross Exact Distribution ===");
    println!("Depth   Count                   Pct");
    println!("------------------------------------------------");
    let mut total_sum: u128 = 0;
    let mut raws = vec![0u128; MAX_D + 1];
    for k in 0..=MAX_D {
        let ge_next = if k + 1 < HIST_SIZE { final_hist[k + 1] } else { 0 };
        let raw = final_hist[k] - ge_next;
        raws[k] = raw;
        total_sum += raw;
    }
    for k in 0..=MAX_D {
        let raw = raws[k];
        if raw == 0 && k > 10 { continue; }
        let pct = if total_sum > 0 {
            (raw as f64) / (total_sum as f64) * 100.0
        } else {
            0.0
        };
        println!("{:<8}{:>24}    {:.5}%", k, raw, pct);
    }
    println!("------------------------------------------------");
    println!("Total   {:>24}    100.00000%", total_sum);
    eprintln!("[Done] {:.1}s total", t0.elapsed().as_secs_f64());

    // 校验
    assert_eq!(total_sum, THEORETICAL_TOTAL, "total mismatch with theoretical");
    for (k, &exp) in GOLDEN.iter().enumerate() {
        assert_eq!(raws[k], exp, "d={} got {} expected {}", k, raws[k], exp);
    }
    eprintln!("[OK] bit-exact vs cpp v33 golden");
}
