//! state_cross_1col: 单色底 Cross 各深度的 scramble 公式
//!
//! 输出 1.txt..8.txt,每行一条 scramble(空格分隔)。
//! 对应 cpp:cross_1_col_state.cpp
//!
//! Golden 行数(per depth):15 / 158 / 1394 / 9809 / 46381 / 97254 / 34966 / 102

use std::fs::File;
use std::io::{BufWriter, Write};
use std::time::Instant;

use cube_solver::cube_common::{array_to_index, state_space, Move, State, MOVE_NAMES};
use cube_solver::move_tables;

const SZ: usize = state_space::CROSS;

fn main() {
    let t0 = Instant::now();
    let mgr = move_tables::instance();
    let mt = mgr.ensure_edge4();
    let mt = mt.as_u32();

    let target = [16i32, 18, 20, 22];
    let start = array_to_index(&target, 4, 2, 12) as usize;

    let mut depth = vec![u8::MAX; SZ];
    let mut parent = vec![u32::MAX; SZ];
    let mut mv_from_parent = vec![u8::MAX; SZ];
    depth[start] = 0;
    let mut frontier: Vec<u32> = vec![start as u32];
    let mut max_d: u8 = 0;

    while !frontier.is_empty() {
        let d = max_d;
        let mut next: Vec<u32> = Vec::with_capacity(frontier.len() * 4);
        for &cur in &frontier {
            let last = if cur as usize == start { u8::MAX } else { mv_from_parent[cur as usize] };
            for m in 0..18u8 {
                if last != u8::MAX && last / 3 == m / 3 {
                    continue;
                }
                let ni = (mt[(cur as usize) * 24 + m as usize] / 24) as usize;
                if depth[ni] == u8::MAX {
                    depth[ni] = d + 1;
                    parent[ni] = cur;
                    mv_from_parent[ni] = m;
                    next.push(ni as u32);
                }
            }
        }
        if next.is_empty() { break; }
        max_d += 1;
        frontier = next;
    }

    eprintln!("[BFS] max_depth={}, time {:.3}s", max_d, t0.elapsed().as_secs_f64());

    let mut buckets: Vec<Vec<u32>> = vec![Vec::new(); (max_d as usize) + 1];
    for i in 0..SZ {
        if depth[i] != u8::MAX {
            buckets[depth[i] as usize].push(i as u32);
        }
    }

    let golden: [u64; 9] = [1, 15, 158, 1394, 9809, 46381, 97254, 34966, 102];
    let mut total = 0u64;
    for d in 0..=max_d as usize {
        total += buckets[d].len() as u64;
        if d < golden.len() {
            assert_eq!(buckets[d].len() as u64, golden[d],
                "depth {} count mismatch", d);
        }
    }
    assert_eq!(total, SZ as u64);
    eprintln!("[OK] depth counts bit-exact vs cpp golden");

    for d in 1..=max_d as usize {
        let path = format!("{}.txt", d);
        let f = File::create(&path).expect("create file");
        let mut w = BufWriter::new(f);
        let mut buf = String::with_capacity(64);
        for &idx in &buckets[d] {
            buf.clear();
            let mut moves: Vec<u8> = Vec::with_capacity(d);
            let mut cur = idx as usize;
            while depth[cur] > 0 {
                moves.push(mv_from_parent[cur]);
                cur = parent[cur] as usize;
            }
            moves.reverse();
            for (i, &m) in moves.iter().enumerate() {
                if i > 0 { buf.push(' '); }
                buf.push_str(MOVE_NAMES[m as usize]);
            }
            writeln!(w, "{}", buf).unwrap();
        }
        eprintln!("[write] {}: {} lines", path, buckets[d].len());
    }

    // self-check:抽样 100 条 scramble,apply 后检查仍是合法 cross idx 且距 0 相符
    for d in 1..=max_d as usize {
        let sample = buckets[d].iter().step_by((buckets[d].len() / 50).max(1)).take(50);
        for &idx in sample {
            let mut moves: Vec<u8> = Vec::new();
            let mut cur = idx as usize;
            while depth[cur] > 0 {
                moves.push(mv_from_parent[cur]);
                cur = parent[cur] as usize;
            }
            moves.reverse();
            let mut s = State::solved();
            for &m in &moves {
                s.apply(Move::from_index(m as usize));
            }
            let (ep, eo) = s.ep_eo();
            let mut arr = [0i32; 4];
            for i in 0..12 {
                if ep[i] >= 8 {
                    arr[(ep[i] - 8) as usize] = (2 * i as i32) + eo[i] as i32;
                }
            }
            let recovered_idx = array_to_index(&arr, 4, 2, 12) as usize;
            assert_eq!(recovered_idx, idx as usize,
                "scramble for idx {} (d={}) produced wrong state {}", idx, d, recovered_idx);
        }
    }
    eprintln!("[OK] scramble self-check passed (50 samples/depth)");
    eprintln!("[Done] {:.3}s total", t0.elapsed().as_secs_f64());
}
