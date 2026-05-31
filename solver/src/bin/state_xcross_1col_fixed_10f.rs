//! state_xcross_1col_fixed_10f: 单色 BL 槽固定 XCross 各深度 scramble
//!
//! 状态空间 = 190080 × 24 × 24 = 109,486,080 (~109MB visited + 436MB parent)
//! 输出 1.txt..10.txt,行数:15 / 172 / 1950 / 21535 / 220368 / 1989591
//!                   13431990 / 40963892 / 16325184 / 36022 (total 72,990,719)
//!
//! 对应 cpp xcross_1_col_fixed_10f.cpp。单线程 BFS,parent + move 回溯。

use std::fs::File;
use std::io::{BufWriter, Write};
use std::time::Instant;

use cube_solver::cube_common::{state_space, MOVE_NAMES};
use cube_solver::move_tables;

const SZ_CR: usize = state_space::CROSS;
const SZ_CN: usize = state_space::CORNER;
const SZ_ED: usize = state_space::EDGE;
const STRIDE: usize = SZ_CN * SZ_ED;
const TOTAL: usize = SZ_CR * STRIDE;

const GOLDEN: [u64; 11] = [
    1, 15, 172, 1950, 21535, 220368, 1989591, 13431990, 40963892, 16325184, 36022,
];

fn main() {
    let t0 = Instant::now();
    let mgr = move_tables::instance();
    let mt_edge_arc = mgr.ensure_edge();
    let mt_corn_arc = mgr.ensure_corn();
    let mt_multi_arc = mgr.ensure_edge4();
    let mt_edge = mt_edge_arc.as_u32();
    let mt_corn = mt_corn_arc.as_u32();
    let mt_multi = mt_multi_arc.as_u32();

    eprintln!("[Alloc] {} MB visited + {} MB parent + {} MB move...",
        TOTAL >> 20, (TOTAL * 4) >> 20, TOTAL >> 20);
    let mut depth: Vec<u8> = vec![u8::MAX; TOTAL];
    let mut parent: Vec<u32> = vec![u32::MAX; TOTAL];
    let mut mv: Vec<u8> = vec![u8::MAX; TOTAL];

    let start = (187520 * SZ_CN + 12) * SZ_ED + 0;
    depth[start] = 0;
    let mut queue: Vec<u32> = Vec::with_capacity(73_000_000);
    queue.push(start as u32);
    let mut head: usize = 0;
    let mut cur_depth: u8 = 0;
    let t_bfs = Instant::now();

    while head < queue.len() {
        let curr = queue[head] as usize;
        head += 1;
        let d = depth[curr];
        if d > cur_depth {
            eprintln!("  depth {} done, queue={}, {:.2}s",
                cur_depth, queue.len(), t_bfs.elapsed().as_secs_f64());
            cur_depth = d;
            if cur_depth >= 10 { break; }
        }

        let cur_ed = curr % SZ_ED;
        let tmp = curr / SZ_ED;
        let cur_cn = tmp % SZ_CN;
        let cur_cr = tmp / SZ_CN;

        let t1_base = cur_cr * 24;
        let t2_base = cur_cn * 18;
        let t3_base = cur_ed * 18;

        let lm = if curr == start { u8::MAX } else { mv[curr] };

        for m in 0..18u8 {
            if lm != u8::MAX {
                let m_ax = m / 3;
                let l_ax = lm / 3;
                if m_ax == l_ax { continue; }
                if (m_ax == 0 && l_ax == 1) || (m_ax == 2 && l_ax == 3) || (m_ax == 4 && l_ax == 5) {
                    continue;
                }
            }
            let val_cr = mt_multi[t1_base + m as usize];
            let val_cn = mt_corn[t2_base + m as usize];
            let val_ed = mt_edge[t3_base + m as usize];
            let next = (val_cr as usize + val_cn as usize) * SZ_ED + val_ed as usize;
            if depth[next] == u8::MAX {
                depth[next] = d + 1;
                parent[next] = curr as u32;
                mv[next] = m;
                queue.push(next as u32);
            }
        }
    }
    eprintln!("[BFS] complete, visited={}, {:.2}s", queue.len(), t_bfs.elapsed().as_secs_f64());

    // 收集每深度 bucket
    let mut buckets: Vec<Vec<u32>> = vec![Vec::new(); 11];
    for i in 0..TOTAL {
        let d = depth[i];
        if d <= 10 {
            buckets[d as usize].push(i as u32);
        }
    }
    let mut total: u64 = 0;
    for d in 0..=10 {
        total += buckets[d].len() as u64;
        assert_eq!(buckets[d].len() as u64, GOLDEN[d],
            "depth {} count mismatch", d);
    }
    assert_eq!(total, 72_990_720);
    eprintln!("[OK] depth counts bit-exact vs cpp golden");

    // self-check:每个 depth 抽 50 个,apply scramble 到 (SOLVED, 12, 0) 应得到原 idx
    for d in 1..=10 {
        let n = buckets[d].len();
        let step = (n / 50).max(1);
        for &idx in buckets[d].iter().step_by(step).take(50) {
            let mut moves: Vec<u8> = Vec::with_capacity(d);
            let mut cur = idx as usize;
            while depth[cur] > 0 {
                moves.push(mv[cur]);
                cur = parent[cur] as usize;
            }
            let (mut cr, mut cn, mut ed) = (187520usize, 12usize, 0usize);
            for &m in moves.iter().rev() {
                let val_cr = mt_multi[cr * 24 + m as usize];
                let val_cn = mt_corn[cn * 18 + m as usize];
                let val_ed = mt_edge[ed * 18 + m as usize];
                let next = (val_cr as usize + val_cn as usize) * SZ_ED + val_ed as usize;
                cr = next / STRIDE;
                cn = (next / SZ_ED) % SZ_CN;
                ed = next % SZ_ED;
            }
            let recovered = (cr * SZ_CN + cn) * SZ_ED + ed;
            assert_eq!(recovered, idx as usize,
                "d={} idx={} recovered={}", d, idx, recovered);
        }
    }
    eprintln!("[OK] scramble self-check passed (50 samples/depth)");

    // 输出 1..10.txt
    for d in 1..=10 {
        let path = format!("{}.txt", d);
        let f = File::create(&path).expect("create file");
        let mut w = BufWriter::with_capacity(1 << 20, f);
        let mut moves: Vec<u8> = Vec::with_capacity(d);
        let mut buf = String::with_capacity(64);
        for &idx in &buckets[d] {
            moves.clear();
            buf.clear();
            let mut cur = idx as usize;
            while depth[cur] > 0 {
                moves.push(mv[cur]);
                cur = parent[cur] as usize;
            }
            for (i, &m) in moves.iter().rev().enumerate() {
                if i > 0 { buf.push(' '); }
                buf.push_str(MOVE_NAMES[m as usize]);
            }
            writeln!(w, "{}", buf).unwrap();
        }
        eprintln!("[write] {}: {} lines", path, buckets[d].len());
    }

    eprintln!("[Done] {:.2}s total", t0.elapsed().as_secs_f64());
}
