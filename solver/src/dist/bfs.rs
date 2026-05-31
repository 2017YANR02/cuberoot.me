//! 通用 byte-valued BFS 距离表
//!
//! 输入:状态总数 `total`、起点索引、邻居生成闭包 `neighbors(i, out)` 写入 18 个邻居索引。
//! 输出:`Vec<u8>`,table[i] = 距离起点的最短步数(255 表示不可达)。
//!
//! 并发策略:rayon 按深度分轮扫描,每轮把"当前深度"格子的 18 邻居写 depth+1。
//! 多线程同时写同一格只可能写同一个值(depth+1),x86 单 byte store 原子,
//! 即"同值幂等"的 data race — 与 C++ OpenMP `if(table[ni]==255) table[ni]=depth+1` 同契约。

use std::sync::atomic::{AtomicU64, Ordering};

use rayon::prelude::*;

/// 邻居数(18 个 move 三阶魔方约定)
pub const N_NEIGHBORS: usize = 18;

/// 通用 BFS。`neighbors` 必须把 18 个邻居 index 写到 `out`。
///
/// 返回 `(table, max_depth)`。
pub fn bfs_byte<F>(total: usize, start_idx: usize, neighbors: F) -> (Vec<u8>, u8)
where
    F: Fn(usize, &mut [usize; N_NEIGHBORS]) + Sync + Send,
{
    let mut table: Vec<u8> = vec![255u8; total];
    table[start_idx] = 0;
    let ptr_addr = table.as_mut_ptr() as usize;

    let mut depth: u8 = 0;
    loop {
        let count = AtomicU64::new(0);
        (0..total).into_par_iter().with_min_len(4096).for_each(|i| {
            let p = ptr_addr as *mut u8;
            // SAFETY: 同值幂等的 byte 写,见模块顶部说明
            unsafe {
                if *p.add(i) != depth {
                    return;
                }
                let mut nbrs = [0usize; N_NEIGHBORS];
                neighbors(i, &mut nbrs);
                let mut local = 0u64;
                for &ni in &nbrs {
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
    (table, depth)
}
