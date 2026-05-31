//! dist_cross_6col: 六色底中性 Cross 深度分布
//!
//! 算法 (cpp cross_6_col.cpp 直译):
//! 1. 每面 (U/D/L/R/F/B) 建一张 190,080 字节的 BFS 表 (该面 cross solved 起点)
//!    编码 = quad_rank * 16 + ori_bits (quad_rank 是 4 个棱位的 Lehmer rank)
//! 2. 全空间 = 12! × 2^11 = 980,995,276,800 (棱排列 × 11-bit EO 自由度,parity 固定)
//! 3. 主循环 12 × 11 个 chunk(p0,p1 选定)→ 10! perms × 2048 oris
//!    AVX2 内层:32 oris 一批,6 面 lookup + 取 min + 直方图

use std::time::Instant;

#[cfg(target_arch = "x86_64")]
use std::arch::x86_64::*;

use rayon::prelude::*;

use cube_solver::cube_common::state_space;
use cube_solver::move_tables;

const TABLE_SIZE: usize = state_space::CROSS; // 190080
const TOTAL_PERMS: u64 = 479_001_600; // 12!
const THEORETICAL_TOTAL: u64 = 980_995_276_800; // 12! * 2^11
const MAX_DEPTH: usize = 8;

const GOLDEN_FILE: &str = "D:\\cube\\solver-rust\\.tmp\\cross_6_col_golden.txt";

/// quad_rank_table[a][b][c][d] = mid*16 + 0,where mid = mask_to_id[1<<a|1<<b|1<<c|1<<d]*24 + pid
/// 实际存 mid*16 直接做字节偏移 (每 pid 占 16 字节即 16 个 ori)
/// 注意 cpp 用的是 mid*384 + pid*16 = (mid*24 + pid) * 16
fn build_quad_rank() -> Box<[[[[u32; 12]; 12]; 12]; 12]> {
    let mut mask_to_id = [-1i32; 1 << 12];
    let mut cnt = 0i32;
    for m in 0u32..(1 << 12) {
        if m.count_ones() == 4 {
            mask_to_id[m as usize] = cnt;
            cnt += 1;
        }
    }

    let mut t = vec![[[[0u32; 12]; 12]; 12]; 12].into_boxed_slice();
    // 平铺向 box;手动 unsafe 转
    let mut tab = unsafe {
        Box::from_raw(Box::into_raw(t) as *mut [[[[u32; 12]; 12]; 12]; 12])
    };

    for a in 0..12usize {
        for b in 0..12usize {
            if a == b { continue; }
            for c in 0..12usize {
                if c == a || c == b { continue; }
                for d in 0..12usize {
                    if d == a || d == b || d == c { continue; }
                    let mask = (1u32 << a) | (1 << b) | (1 << c) | (1 << d);
                    let mid = mask_to_id[mask as usize];
                    let mut map = [0u8; 12];
                    let mut k = 0u8;
                    for i in 0..12 {
                        if (mask >> i) & 1 == 1 { map[i] = k; k += 1; }
                    }
                    let ra = map[a] as i32;
                    let rb = map[b] as i32;
                    let rc = map[c] as i32;
                    // pid (与 cpp 同):pid = ra*6 + (rb_adj)*2 + rc_adj
                    let mut pid = ra * 6;
                    let mut v = rb;
                    if v > ra { v -= 1; }
                    pid += v * 2;
                    let used = (1i32 << ra) | (1 << rb);
                    let mut v2 = 0i32;
                    for j in 0..rc {
                        if (used >> j) & 1 == 0 { v2 += 1; }
                    }
                    pid += v2;
                    tab[a][b][c][d] = (mid * 384 + pid * 16) as u32;
                }
            }
        }
    }
    tab
}

/// 自动检测每面的 4 个 cross 位置 (从 cube_common 的 mt_edge 派生)。
/// cpp 用 perm_move 检测,这里我们直接照搬 cube_common 约定:
/// - U 面 (move 0): 位置 4..7 (UB, UR, UF, UL)
/// - D 面 (move 3): 位置 8..11 (DB, DR, DF, DL)
/// - L 面 (move 6): 位置 3, 7, 11, 0 (FL, UL, DL, BL)? 待验证
/// 通过对 mt_edge 计算"被 move 改变位置的 edge ids"得到。
fn detect_face_slots(mt_edge: &[u32]) -> [[u8; 4]; 6] {
    // mt_edge[(2*pos+0)*18 + m] = 2*new_pos + new_ori。
    // 如果一个 edge 在 move m 下 pos 变了,则 pos 在 FACE_SLOTS[m/3] 中。
    let mut face_slots = [[0u8; 4]; 6];
    for f in 0..6 {
        let m = f * 3; // 第一个 (U/D/L/R/F/B 90°)
        let mut slots = Vec::new();
        for pos in 0..12 {
            let val = mt_edge[((2 * pos) * 18 + m) as usize];
            let new_pos = (val / 2) as u8;
            if new_pos != pos as u8 {
                slots.push(pos as u8);
            }
        }
        assert_eq!(slots.len(), 4, "face {} slots != 4", f);
        face_slots[f].copy_from_slice(&slots);
    }
    face_slots
}

/// BFS 表 (190,080 字节)。
/// 编码 = quad_rank[p[0]][p[1]][p[2]][p[3]] + ori_bits (0..15)
/// 起点 = solved (p = face_slots[f], o = 0..0),depth=0
fn build_bfs_table(
    face_slots: &[u8; 4],
    quad_rank: &[[[[u32; 12]; 12]; 12]; 12],
    mt_edge: &[u32],
) -> Vec<i8> {
    let mut tab = vec![-1i8; TABLE_SIZE];

    let encode = |p: &[u8; 4], o: &[u8; 4]| -> usize {
        let base = quad_rank[p[0] as usize][p[1] as usize][p[2] as usize][p[3] as usize] as usize;
        let oid = (o[0] | (o[1] << 1) | (o[2] << 2) | (o[3] << 3)) as usize;
        base + oid
    };

    let mut p = *face_slots;
    let o = [0u8; 4];
    let start = encode(&p, &o);
    tab[start] = 0;

    let mut frontier: Vec<([u8; 4], [u8; 4])> = vec![(p, o)];
    let mut depth: i8 = 0;

    while !frontier.is_empty() && depth < MAX_DEPTH as i8 {
        let mut next_frontier: Vec<([u8; 4], [u8; 4])> = Vec::new();
        for (cp, co) in &frontier {
            for m in 0..18 {
                let mut np = [0u8; 4];
                let mut no = [0u8; 4];
                for i in 0..4 {
                    let val = mt_edge[((2 * cp[i] as u32 + co[i] as u32) * 18 + m) as usize];
                    np[i] = (val / 2) as u8;
                    no[i] = (val % 2) as u8;
                }
                let key = encode(&np, &no);
                if tab[key] == -1 {
                    tab[key] = depth + 1;
                    next_frontier.push((np, no));
                }
            }
        }
        frontier = next_frontier;
        depth += 1;
    }
    tab
}

/// 预计算每面每个 11-bit ori 对应的 4-bit 局部 ori
/// simd_indices[f][ori_11] = local 4-bit ori for face f
fn build_simd_indices(face_slots: &[[u8; 4]; 6]) -> [[u8; 2048]; 6] {
    let mut out = [[0u8; 2048]; 6];
    for i in 0..2048u32 {
        // 11 个 ori 自由度,parity 计算 11 位 popcount,推出 edge 11 (DL) 的 ori
        let s11 = (i.count_ones() & 1) as u32;
        for f in 0..6usize {
            let mut o = 0u8;
            for z in 0..4 {
                let s = face_slots[f][z] as u32;
                let bit = if s == 11 { s11 } else { (i >> s) & 1 };
                o |= (bit as u8) << z;
            }
            out[f][i as usize] = o;
        }
    }
    out
}

#[target_feature(enable = "avx2")]
unsafe fn process_chunk(
    p0: u8, p1: u8,
    quad_rank: &[[[[u32; 12]; 12]; 12]; 12],
    face_slots: &[[u8; 4]; 6],
    tables: &[Vec<i8>; 6],
    simd_indices: &[[u8; 2048]; 6],
) -> [u64; 10] {
    let mut local_hist = [0u64; 10];
    let mut p = [0u8; 12];
    let mut inv_p = [0u8; 12];

    let mut current_p: Vec<u8> = (0u8..12).filter(|&x| x != p0 && x != p1).collect();
    current_p.sort();

    let v_zero = _mm256_setzero_si256();
    let v_depths: [__m256i; 9] = std::array::from_fn(|k| _mm256_set1_epi8(k as i8));

    loop {
        p[0] = p0;
        p[1] = p1;
        for k in 0..10 {
            p[k + 2] = current_p[k];
        }
        for i in 0..12 {
            inv_p[p[i] as usize] = i as u8;
        }

        // pre-load 6 rows
        let mut row_vecs: [__m256i; 6] = [v_zero; 6];
        for f in 0..6 {
            let t = &face_slots[f];
            let base = quad_rank[inv_p[t[0] as usize] as usize]
                                [inv_p[t[1] as usize] as usize]
                                [inv_p[t[2] as usize] as usize]
                                [inv_p[t[3] as usize] as usize] as usize;
            let row128 = _mm_loadu_si128(tables[f].as_ptr().add(base) as *const __m128i);
            row_vecs[f] = _mm256_broadcastsi128_si256(row128);
        }

        // SIMD inner: 2048 oris in batches of 32
        let mut i = 0;
        while i < 2048 {
            let mut min_d = _mm256_set1_epi8(-1i8);
            for f in 0..6 {
                let idx = _mm256_loadu_si256(simd_indices[f].as_ptr().add(i) as *const __m256i);
                let val = _mm256_shuffle_epi8(row_vecs[f], idx);
                min_d = _mm256_min_epu8(min_d, val);
            }
            local_hist[0] += (_mm256_movemask_epi8(_mm256_cmpeq_epi8(min_d, v_zero)) as u32).count_ones() as u64;
            for k in 1..=8 {
                local_hist[k] += (_mm256_movemask_epi8(_mm256_cmpeq_epi8(min_d, v_depths[k])) as u32).count_ones() as u64;
            }
            i += 32;
        }

        // next permutation
        if !next_permutation(&mut current_p) {
            break;
        }
    }
    local_hist
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

fn main() {
    let t0 = Instant::now();
    let mgr = move_tables::instance();
    let mt_edge: Vec<u32> = mgr.ensure_edge().as_u32().to_vec();

    eprintln!("[1/3] init lookups...");
    let quad_rank = build_quad_rank();
    let face_slots = detect_face_slots(&mt_edge);
    eprintln!("      face_slots = {:?}", face_slots);
    let simd_indices = build_simd_indices(&face_slots);

    eprintln!("[2/3] build 6 BFS tables...");
    let tables: [Vec<i8>; 6] = std::array::from_fn(|f| {
        build_bfs_table(&face_slots[f], &quad_rank, &mt_edge)
    });
    eprintln!("      done @ {:.2}s", t0.elapsed().as_secs_f64());

    eprintln!("[3/3] main scan 12! × 2048 with AVX2...");
    let chunks: Vec<(u8, u8)> = (0u8..12)
        .flat_map(|p0| (0u8..12).filter(move |&p1| p1 != p0).map(move |p1| (p0, p1)))
        .collect();

    let hist: [u64; 10] = chunks
        .par_iter()
        .map(|&(p0, p1)| unsafe {
            process_chunk(p0, p1, &quad_rank, &face_slots, &tables, &simd_indices)
        })
        .reduce(|| [0u64; 10], |mut a, b| {
            for k in 0..10 { a[k] += b[k]; }
            a
        });

    println!();
    println!("=== Six-Color Neutral Cross Exact Distribution ===");
    println!("Depth     Count               Pct        Cumul");
    println!("------------------------------------------------------------");
    let mut cumul: u64 = 0;
    let mut total: u64 = 0;
    let mut wsum: u64 = 0;
    for d in 0..=MAX_DEPTH {
        let c = hist[d];
        total += c;
        cumul += c;
        wsum += c * d as u64;
        let pct = c as f64 / THEORETICAL_TOTAL as f64 * 100.0;
        let cpct = cumul as f64 / THEORETICAL_TOTAL as f64 * 100.0;
        println!("{:<10}{:<20}{:.5}%   {:.5}%", d, c, pct, cpct);
    }
    println!("------------------------------------------------------------");
    println!("Total: {} (theory {})", total, THEORETICAL_TOTAL);
    println!("Avg Depth: {:.4}", wsum as f64 / total as f64);
    eprintln!("[Done] {:.2}s, {} perms", t0.elapsed().as_secs_f64(), TOTAL_PERMS);

    // 校验:总数对齐理论值
    assert_eq!(total, THEORETICAL_TOTAL, "total mismatch");
    eprintln!("[OK] total matches theoretical");

    // 若 .tmp/cross_6_col_golden.txt 存在,逐深度对齐
    if let Ok(text) = std::fs::read_to_string(GOLDEN_FILE) {
        let mut golden = Vec::new();
        for line in text.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                if let Ok(d) = parts[0].parse::<usize>() {
                    if d <= 8 {
                        if let Ok(c) = parts[1].parse::<u64>() {
                            while golden.len() <= d { golden.push(0u64); }
                            golden[d] = c;
                        }
                    }
                }
            }
        }
        if golden.len() >= 9 {
            let mut ok = true;
            for k in 0..=8 {
                if hist[k] != golden[k] {
                    eprintln!("d={} got {} expected {}", k, hist[k], golden[k]);
                    ok = false;
                }
            }
            if ok {
                eprintln!("[OK] bit-exact vs cpp golden");
            }
        }
    }
}
