//! state_cross_2col: 双色 (白+黄) Cross d=8 状态的 scramble
//!
//! 直译自 cpp cross_2_col_state/cross.cpp:
//! 1. BFS 算白/黄 cross dist (190080 each)
//! 2. stitch:对每个 W_d=8 的 W_idx 和 Y_d=8 的 Y_idx,过滤 mask 不相交
//! 3. IDA* per pair,启发式 = max(W_d, Y_d),终止 = h==0 (两色都解)
//! 4. 输出 cross_2_col_state.txt:`<idx>. <scramble>\n`
//!
//! 注意:cpp 这套逻辑找的是"双色都解"路径(长度可>8),
//! 与 dist_cross_2col 的 min(W_d, Y_d) 定义不一致;按 cpp 输出。

use std::fs::File;
use std::io::{BufWriter, Write};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Instant;

use rayon::prelude::*;

use cube_solver::cube_common::{array_to_index, index_to_array, state_space, MOVE_NAMES};
use cube_solver::move_tables;

const SZ: usize = state_space::CROSS;
const SOLVED_W: usize = state_space::CROSS_SOLVED; // 187520

fn bfs_dist(mt: &[u32], start: usize) -> Vec<u8> {
    let mut d = vec![u8::MAX; SZ];
    d[start] = 0;
    let mut frontier = vec![start as u32];
    let mut depth: u8 = 0;
    while !frontier.is_empty() {
        let mut next = Vec::with_capacity(frontier.len() * 4);
        for &cur in &frontier {
            for m in 0..18 {
                let ni = (mt[(cur as usize) * 24 + m] / 24) as usize;
                if d[ni] == u8::MAX {
                    d[ni] = depth + 1;
                    next.push(ni as u32);
                }
            }
        }
        if next.is_empty() { break; }
        depth += 1;
        frontier = next;
    }
    d
}

/// 反解 cross idx 出 4 个棱所在位置(12 bit mask)
fn idx_to_mask(idx: usize) -> u32 {
    let mut p = [0i32; 4];
    index_to_array(&mut p, idx as i32, 4, 2, 12);
    let mut mask = 0u32;
    for k in 0..4 {
        let raw = p[k] / 18;
        let pos = (raw / 2) as u32;
        mask |= 1 << pos;
    }
    mask
}

/// IDA* 找 (W_idx, Y_idx) → (W_solved, Y_solved) 的最短 move 序列
fn ida_solve(
    w_start: usize, y_start: usize,
    w_dist: &[u8], y_dist: &[u8],
    mt: &[u32],
) -> Vec<u8> {
    let h0 = (w_dist[w_start] as i32).max(y_dist[y_start] as i32);
    let mut bound = h0;
    let mut path: Vec<u8> = Vec::with_capacity(20);

    while bound <= 20 {
        path.clear();
        if dfs(w_start, y_start, 0, bound, &mut path, w_dist, y_dist, mt, u8::MAX) {
            return path;
        }
        bound += 1;
    }
    Vec::new()
}

fn dfs(
    w: usize, y: usize, g: i32, bound: i32, path: &mut Vec<u8>,
    w_dist: &[u8], y_dist: &[u8], mt: &[u32], last_m: u8,
) -> bool {
    let wd = w_dist[w] as i32;
    let yd = y_dist[y] as i32;
    let h = wd.max(yd);
    if g + h > bound { return false; }
    if h == 0 { return true; }
    for m in 0..18u8 {
        if last_m != u8::MAX {
            let m_ax = m / 3;
            let l_ax = last_m / 3;
            if m_ax == l_ax { continue; }
            if (m_ax == 0 && l_ax == 1) || (m_ax == 2 && l_ax == 3) || (m_ax == 4 && l_ax == 5) {
                continue;
            }
        }
        let nw = (mt[w * 24 + m as usize] / 24) as usize;
        let ny = (mt[y * 24 + m as usize] / 24) as usize;
        path.push(m);
        if dfs(nw, ny, g + 1, bound, path, w_dist, y_dist, mt, m) {
            return true;
        }
        path.pop();
    }
    false
}

fn main() {
    let t0 = Instant::now();
    let mgr = move_tables::instance();
    let mt = mgr.ensure_edge4();
    let mt = mt.as_u32();

    // yellow solved:U 棱 4..7 各在位置 4..7,综合值 2*pos+0
    let y_target = [8i32, 10, 12, 14];
    let solved_y = array_to_index(&y_target, 4, 2, 12) as usize;

    eprintln!("[1] BFS W from {}...", SOLVED_W);
    let w_dist = bfs_dist(mt, SOLVED_W);
    eprintln!("[2] BFS Y from {}...", solved_y);
    let y_dist = bfs_dist(mt, solved_y);

    let w8: Vec<usize> = (0..SZ).filter(|&i| w_dist[i] == 8).collect();
    let y8: Vec<usize> = (0..SZ).filter(|&i| y_dist[i] == 8).collect();
    eprintln!("    W_d=8: {}, Y_d=8: {}", w8.len(), y8.len());

    // stitch
    eprintln!("[3] Stitching disjoint pairs...");
    let mut jobs: Vec<(usize, usize)> = Vec::new();
    let w_masks: Vec<u32> = w8.iter().map(|&i| idx_to_mask(i)).collect();
    let y_masks: Vec<u32> = y8.iter().map(|&i| idx_to_mask(i)).collect();
    for (wi, &w_idx) in w8.iter().enumerate() {
        let wm = w_masks[wi];
        for (yi, &y_idx) in y8.iter().enumerate() {
            if (wm & y_masks[yi]) == 0 {
                jobs.push((w_idx, y_idx));
            }
        }
    }
    eprintln!("    {} jobs", jobs.len());

    eprintln!("[4] IDA* solving in parallel...");
    let processed = AtomicUsize::new(0);
    let total = jobs.len();
    let results: Vec<Vec<u8>> = jobs.par_iter().map(|&(w, y)| {
        let path = ida_solve(w, y, &w_dist, &y_dist, mt);
        let n = processed.fetch_add(1, Ordering::Relaxed) + 1;
        if n % 200 == 0 || n == total {
            eprintln!("    {}/{}", n, total);
        }
        path
    }).collect();

    // self-check:抽样 100 个 path,apply 后 (w_start, y_start) 应到 (SOLVED_W, solved_y)
    let step = (jobs.len() / 100).max(1);
    for i in (0..jobs.len()).step_by(step).take(100) {
        let (w0, y0) = jobs[i];
        let mut w = w0;
        let mut y = y0;
        for &m in &results[i] {
            w = (mt[w * 24 + m as usize] / 24) as usize;
            y = (mt[y * 24 + m as usize] / 24) as usize;
        }
        assert_eq!(w, SOLVED_W, "job {} path didn't solve W", i);
        assert_eq!(y, solved_y, "job {} path didn't solve Y", i);
    }
    eprintln!("[OK] path self-check passed (100 samples)");

    let f = File::create("cross_2_col_state.txt").expect("create file");
    let mut w_out = BufWriter::new(f);
    for (i, path) in results.iter().enumerate() {
        let mut s = String::new();
        for &m in path.iter().rev() {
            let base = (m / 3) * 3;
            let off = m % 3;
            let inv_m = base + (2 - off);
            s.push_str(MOVE_NAMES[inv_m as usize]);
            s.push(' ');
        }
        writeln!(w_out, "{}. {}", i + 1, s.trim_end()).unwrap();
    }
    drop(w_out);

    eprintln!("[Done] {:.2}s, wrote {} scrambles to cross_2_col_state.txt",
        t0.elapsed().as_secs_f64(), results.len());
}
