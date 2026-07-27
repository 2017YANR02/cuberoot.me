//! mt_gen: 12 张 mt_* 移动表的**运行时生成**(不读盘、不下载),native + wasm 双轨。
//!
//! 存在理由:mt_* 是纯函数产物 —— 由内置运动学(`State::applied`)逐状态枚举 18 个 move
//! 推出来的,和打乱、和用户输入都无关。native 侧 `move_tables::manager` 把它们 BFS 一次
//! 落盘再 mmap,是为了跨进程复用;浏览器侧没有这个前提,却一直在**下载**同一批产物
//! (mt_edge4 一张就 17.4MB / gz 8.3MB),而现场生成只要几十毫秒。
//!
//! 因此 wasm 路径改为:pt_*(BFS 深搜出来的剪枝表,生成要几十秒,只能下载)照旧 fetch;
//! mt_*(移动表)一律在 worker 里现场建。`TABLE_SETS` 里再无 mt_* 条目。
//!
//! 正确性:本模块就是 manager 那几个 gen_mt_* 的同一份代码(基础生成器直接搬过来,派生表
//! 走同一个 `create_multi_move_table{,2}`),故与 tables/*.bin 逐字节相同 —— 由
//! `tests::mt_gen_matches_manager` 对全部 10 张表逐 u32 断言。
//!
//! memo:同一 worker 内多个求解器共用同一张表(如 roux223 的 mt_edge3 也是 block222 要的),
//! 生成一次后按名缓存 Arc,重复取零成本。wasm 是单线程,用 thread_local 即可。

use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::Arc;

use crate::cube_common::{
    create_multi_move_table, create_multi_move_table2, index_to_o, o_to_index, state_space, Move,
    State,
};
use crate::move_tables::MoveTable;

// ---------- 基础表生成器(单棱 / 单角 / 单棱位置 / EO)----------
// 原在 move_tables::manager 内(native-only),移到这里让 wasm 也能调;manager 继续用这几个。

/// C++ createMTEdge:为每个 "edge i/2 处于位置 i/2,朝向 i%2" 的"单棱状态",
/// 枚举 18 个 move,写入"新单棱状态"。
pub fn create_mt_edge() -> Vec<u32> {
    let size = state_space::EDGE; // 24
    let mut mt = vec![0u32; size * 18];
    for i in 0..size {
        let e = (i / 2) as u8; // 目标棱编号
        let ori_in = (i % 2) as u8;
        // 构造一个 solved 状态,把目标棱的 orientation 改成 ori_in
        // (位置已是 e -> e,无需改)
        let mut s = State::SOLVED;
        // edges[e] = 2*e + ori_in
        s.edges[e as usize] = 2 * e + ori_in;
        for j in 0..18 {
            let m = Move::from_index(j);
            let ns = s.applied(m);
            let (ep, eo) = ns.ep_eo();
            // 找到 e 现在在哪
            let mut idx = 0usize;
            for k in 0..12 {
                if ep[k] == e {
                    idx = k;
                    break;
                }
            }
            mt[18 * i + j] = (2 * idx as u32) + eo[idx] as u32;
        }
    }
    mt
}

/// C++ createMTCorn:与 createMTEdge 同理,c=3,8 角。
pub fn create_mt_corn() -> Vec<u32> {
    let size = state_space::CORNER; // 24
    let mut mt = vec![0u32; size * 18];
    for i in 0..size {
        let c = (i / 3) as u8;
        let ori_in = (i % 3) as u8;
        let mut s = State::SOLVED;
        s.corners[c as usize] = 3 * c + ori_in;
        for j in 0..18 {
            let m = Move::from_index(j);
            let ns = s.applied(m);
            let (cp, co) = ns.cp_co();
            let mut idx = 0usize;
            for k in 0..8 {
                if cp[k] == c {
                    idx = k;
                    break;
                }
            }
            mt[18 * i + j] = (3 * idx as u32) + co[idx] as u32;
        }
    }
    mt
}

/// C++ createMTEP:每个棱 i 起始位置 i,枚举 move,记录新位置(忽略 orientation)。
pub fn create_mt_ep() -> Vec<u32> {
    let mut mt = vec![0u32; 12 * 18];
    for i in 0..12usize {
        let e = i as u8;
        let s = State::SOLVED; // edge e 已在位置 e
        for j in 0..18 {
            let m = Move::from_index(j);
            let ns = s.applied(m);
            let (ep, _eo) = ns.ep_eo();
            let mut idx = 0usize;
            for k in 0..12 {
                if ep[k] == e {
                    idx = k;
                    break;
                }
            }
            mt[18 * i + j] = idx as u32;
        }
    }
    mt
}

/// C++ createMTEO:遍历 2^11=2048 个 EO 编码,装入 state,apply move,
/// 编码新 EO,写入 mt[18*i + j] = 18 * idx (预乘 18,stride=18)。
pub fn create_mt_eo() -> Vec<u32> {
    create_mt_eo_inner(true)
}

/// C++ createMTEOAlt:同上但不预乘 18(table_naming.csv 标 "原始")。
pub fn create_mt_eo_alt() -> Vec<u32> {
    create_mt_eo_inner(false)
}

fn create_mt_eo_inner(premultiply: bool) -> Vec<u32> {
    let size = state_space::EO12;
    let mut mt = vec![0u32; size * 18];
    for i in 0..size {
        let mut eo_arr = vec![0i32; 12];
        index_to_o(&mut eo_arr, i as i32, 2, 12);
        // 构造 state:solved cp/co + solved ep + 指定 eo
        let mut s = State::SOLVED;
        for k in 0..12 {
            s.edges[k] = 2 * (k as u8) + eo_arr[k] as u8;
        }
        for j in 0..18 {
            let m = Move::from_index(j);
            let ns = s.applied(m);
            let (_ep, eo_new) = ns.ep_eo();
            let eo_i32: Vec<i32> = eo_new.iter().map(|&x| x as i32).collect();
            let idx = o_to_index(&eo_i32, 2, 12) as u32;
            mt[18 * i + j] = if premultiply { 18 * idx } else { idx };
        }
    }
    mt
}

// ---------- 派生表(多块组合,依赖单块基础表)----------

fn as_i32(slice: &[u32]) -> Vec<i32> {
    slice.iter().map(|&x| x as i32).collect()
}

/// `pn` = 该块类型的件数(棱 12 / 角 8),与 manager 的 gen_mt_* 调用逐参对齐 —— 角表传 8,
/// 传错会算出另一套编码,故这里显式带上而不是硬编码 12。
fn derive(n: i32, c: i32, pn: i32, size: i32, basic: &[u32], stride24: bool) -> Vec<u32> {
    let basic = as_i32(basic);
    let raw = if stride24 {
        create_multi_move_table2(n, c, pn, size, &basic)
    } else {
        create_multi_move_table(n, c, pn, size, &basic)
    };
    raw.into_iter().map(|x| x as u32).collect()
}

// ---------- 按名生成 + memo ----------

/// 可现场生成的 mt 表名。与 `move_tables::TABLE_FILES` 同名(去掉 `mt_` 前缀外的部分一致),
/// 供 wasm 侧按名取表;mt_edge6(3GB)不在此列,浏览器永远不碰它。
pub const GENERATED: [&str; 10] = [
    "mt_edge",
    "mt_corn",
    "mt_edge2",
    "mt_edge3",
    "mt_edge4",
    "mt_corn2",
    "mt_corn3",
    "mt_eo12",
    "mt_eo12_alt",
    "mt_ep4",
];

/// 表名 → (state_count, stride)。
pub fn shape(name: &str) -> (u32, u32) {
    match name {
        "mt_edge" => (state_space::EDGE as u32, 18),
        "mt_corn" => (state_space::CORNER as u32, 18),
        "mt_edge2" => (state_space::EDGE2 as u32, 18),
        "mt_edge3" => (state_space::EDGE3 as u32, 18),
        "mt_edge4" => (state_space::CROSS as u32, 24),
        "mt_corn2" => (state_space::CORNER2 as u32, 18),
        "mt_corn3" => (state_space::CORNER3 as u32, 18),
        "mt_eo12" => (state_space::EO12 as u32, 18),
        "mt_eo12_alt" => (state_space::EO12 as u32, 18),
        "mt_ep1" => (12, 18),
        "mt_ep4" => (state_space::EP4 as u32, 18),
        other => panic!("mt_gen: unknown table {other}"),
    }
}

fn build_raw(name: &str) -> Vec<u32> {
    match name {
        "mt_edge" => create_mt_edge(),
        "mt_corn" => create_mt_corn(),
        "mt_ep1" => create_mt_ep(),
        "mt_eo12" => create_mt_eo(),
        "mt_eo12_alt" => create_mt_eo_alt(),
        "mt_edge2" => derive(2, 2, 12, state_space::EDGE2 as i32, &create_mt_edge(), false),
        "mt_edge3" => derive(3, 2, 12, state_space::EDGE3 as i32, &create_mt_edge(), false),
        "mt_edge4" => derive(4, 2, 12, state_space::CROSS as i32, &create_mt_edge(), true),
        "mt_corn2" => derive(2, 3, 8, state_space::CORNER2 as i32, &create_mt_corn(), false),
        "mt_corn3" => derive(3, 3, 8, state_space::CORNER3 as i32, &create_mt_corn(), false),
        "mt_ep4" => derive(4, 1, 12, state_space::EP4 as i32, &create_mt_ep(), false),
        other => panic!("mt_gen: unknown table {other}"),
    }
}

thread_local! {
    static MEMO: RefCell<HashMap<&'static str, Arc<MoveTable>>> = RefCell::new(HashMap::new());
}

/// 取(必要时现场生成)一张 mt 表。同线程内按名 memo,重复取零成本。
pub fn get(name: &'static str) -> Arc<MoveTable> {
    MEMO.with(|m| {
        if let Some(t) = m.borrow().get(name) {
            return t.clone();
        }
        let (state_count, stride) = shape(name);
        let t = Arc::new(MoveTable::from_vec(build_raw(name), state_count, stride));
        m.borrow_mut().insert(name, t.clone());
        t
    })
}

/// 丢掉 memo(释放内存;wasm 端换求解器族时可选调用)。
pub fn clear_memo() {
    MEMO.with(|m| m.borrow_mut().clear());
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 现场生成的 10 张表必须与 manager 落盘/mmap 的那份逐 u32 相同 —— 这是「浏览器端
    /// 不再下载 mt_*」的正确性依据。mt_edge6 不测(3GB,浏览器永不加载)。
    #[test]
    #[ignore = "needs tables/ dir; run with --ignored"]
    fn mt_gen_matches_manager() {
        let mgr = crate::move_tables::instance();
        let pairs: Vec<(&str, Arc<MoveTable>)> = vec![
            ("mt_edge", mgr.ensure_edge()),
            ("mt_corn", mgr.ensure_corn()),
            ("mt_edge2", mgr.ensure_edge2()),
            ("mt_edge3", mgr.ensure_edge3()),
            ("mt_edge4", mgr.ensure_edge4()),
            ("mt_corn2", mgr.ensure_corn2()),
            ("mt_corn3", mgr.ensure_corn3()),
            ("mt_eo12", mgr.ensure_eo12()),
            ("mt_eo12_alt", mgr.ensure_eo12_alt()),
            ("mt_ep4", mgr.ensure_ep4()),
        ];
        for (name, disk) in pairs {
            let gen = get(name);
            assert_eq!(gen.state_count, disk.state_count, "{name} state_count");
            assert_eq!(gen.stride, disk.stride, "{name} stride");
            assert_eq!(gen.as_u32(), disk.as_u32(), "{name} data");
        }
    }

    /// 用现场生成的 mt 表 + 盘上 pt_cross 建 CrossSolver,6 视角对照 std_analyzer golden。
    /// (wasm 端 CrossSolverWasm::new 走的就是这条路。)
    #[test]
    #[ignore = "needs tables/ dir; run with --ignored"]
    fn cross_solver_on_generated_tables() {
        use crate::cross_solver::CrossSolver;
        use crate::cube_common::string_to_alg;
        use crate::prune_tables::PackedPruneTable;

        let bytes = std::fs::read(crate::move_tables::table_path("pt_cross.bin")).unwrap();
        let pt = Arc::new(PackedPruneTable::from_bin(&bytes));
        let solver = CrossSolver::from_tables(get("mt_edge2"), pt);
        let alg = string_to_alg("R U R' U' F2 L D B2 R' F' U2 D L2 B2 U2 F2 D' B2 U'");
        let rots = ["", "z2", "z'", "z", "x'", "x"];
        assert_eq!(solver.get_stats(&alg, &rots), vec![5, 5, 5, 4, 6, 6]);
    }
}
