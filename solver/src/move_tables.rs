//! move_tables: 12 张 mt_*.bin 的懒加载/生成/释放管理。
//!
//! 移植自 C++ MoveTableManager (`move_tables.{h,cpp}`)。
//!
//! 关键差异点(详见 PORTING_NOTES.md Phase 2):
//!   - `MoveTable.data` 用 `TableStorage` 双模式(Owned Vec 或 mmap),mmap 走零拷贝
//!   - 槽位用 `Mutex<Option<Arc<MoveTable>>>`(而非 OnceLock,因为需要 release)
//!   - mt_edge6 默认 panic,设 env CUBE_ALLOW_HUGE_TABLES=1 才允许生成
//!   - 默认表目录 ./tables/,可被 env CUBE_TABLE_DIR 覆盖
//!
//! 每张表的预期文件大小(含 12 字节 header):
//!   - mt_edge       1740 B    (24 * 18 entries, ~1.7 KB)
//!   - mt_corn       1740 B    (~1.7 KB)
//!   - mt_edge2      38028 B   (528 * 18,        ~37 KB)
//!   - mt_edge3      760332 B  (10560 * 18,      ~743 KB)
//!   - mt_edge4      18247692 B(190080 * 24,     ~17.4 MB,stride=24)
//!   - mt_edge6      ~3.07 GB  (42577920 * 18,   危险,默认禁止)
//!   - mt_corn2      36300 B   (504 * 18,        ~35 KB)
//!   - mt_corn3      653196 B  (9072 * 18,       ~638 KB)
//!   - mt_eo12       147468 B  (2048 * 18,       ~144 KB)
//!   - mt_eo12_alt   147468 B  (~144 KB)
//!   - mt_ep1        876 B     (12 * 18,         <1 KB)
//!   - mt_ep4        855372 B  (11880 * 18,      ~835 KB)

use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

#[cfg(not(target_arch = "wasm32"))]
use memmap2::Mmap;

use crate::cube_common::{
    self as cc, create_multi_move_table, create_multi_move_table2, index_to_o, o_to_index,
    state_space, write_table_le_u32, Move, State, MAGIC,
};

// ---------- 路径 ----------

pub fn table_dir() -> PathBuf {
    match std::env::var("CUBE_TABLE_DIR") {
        Ok(s) if !s.is_empty() => PathBuf::from(s),
        _ => PathBuf::from("tables"),
    }
}

pub fn table_path(name: &str) -> PathBuf {
    table_dir().join(name)
}

// ---------- TableStorage ----------

pub enum TableStorage {
    Owned(Vec<u32>),
    #[cfg(not(target_arch = "wasm32"))]
    Mmap(Mmap),
}

impl TableStorage {
    /// 表数据的 u32 视图(不含 header)。
    pub fn as_u32(&self) -> &[u32] {
        match self {
            TableStorage::Owned(v) => v.as_slice(),
            #[cfg(not(target_arch = "wasm32"))]
            TableStorage::Mmap(m) => {
                let bytes = &m[12..];
                // SAFETY: 文件按 LE u32 写入,这里我们只在 LE 主机上使用。
                // 注意非对齐 mmap 上 reinterpret 是 UB,所以走 chunks_exact 校验路径前
                // 我们在 load 时已校验:header 12 字节后是 4 字节对齐(mmap 起点对齐于页边界
                // 64KB,所以 12 偏移仍 4 对齐),u32 转换安全。
                #[cfg(target_endian = "little")]
                unsafe {
                    let ptr = bytes.as_ptr() as *const u32;
                    let n = bytes.len() / 4;
                    std::slice::from_raw_parts(ptr, n)
                }
                #[cfg(not(target_endian = "little"))]
                {
                    // 非 LE 平台目前不支持(走 Owned 路径即可)
                    panic!("mmap u32 view requires little-endian host");
                }
            }
        }
    }
}

impl std::fmt::Debug for TableStorage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TableStorage::Owned(v) => write!(f, "Owned(len={})", v.len()),
            #[cfg(not(target_arch = "wasm32"))]
            TableStorage::Mmap(m) => write!(f, "Mmap(bytes={})", m.len()),
        }
    }
}

// ---------- MoveTable ----------

#[derive(Debug)]
pub struct MoveTable {
    pub data: TableStorage,
    pub state_count: u32,
    /// 步长:mt_edge / mt_corn 等是 18;mt_edge4 / mt_eo12 等"预乘"表是 24/18。
    /// 这里 stride 跟 C++ `table_naming.csv` 一致。
    pub stride: u32,
}

impl MoveTable {
    pub fn as_u32(&self) -> &[u32] {
        self.data.as_u32()
    }

    /// 从 .bin 字节(12B header: MAGIC + u32 LE entry_count,后接 state_count*stride 个
    /// u32 LE)构造 Owned MoveTable。WASM 路径用:JS fetch 表字节喂进来,绕过 mmap/磁盘。
    /// 任意 target 可用。
    pub fn from_bin(bytes: &[u8], state_count: u32, stride: u32) -> MoveTable {
        let expected_entries = (state_count as u64) * (stride as u64);
        assert!(bytes.len() >= 12, "move table bin too short");
        assert_eq!(&bytes[..8], MAGIC, "bad move table magic");
        let n = u32::from_le_bytes(bytes[8..12].try_into().unwrap()) as u64;
        assert_eq!(n, expected_entries, "move table entry_count mismatch");
        let data = &bytes[12..];
        assert_eq!(
            data.len() as u64,
            expected_entries * 4,
            "move table data length mismatch"
        );
        let mut v = vec![0u32; expected_entries as usize];
        for (i, c) in data.chunks_exact(4).enumerate() {
            v[i] = u32::from_le_bytes([c[0], c[1], c[2], c[3]]);
        }
        MoveTable {
            data: TableStorage::Owned(v),
            state_count,
            stride,
        }
    }
}

// ---------- 表 ID + Manager(磁盘生成 + mmap 加载)----------
// 整块 native-only;WASM 走 MoveTable::from_bin + solver from_tables 绕过。

#[cfg(not(target_arch = "wasm32"))]
mod manager {
    use super::*;

const N_TABLES: usize = 12;

#[derive(Copy, Clone, Debug)]
#[repr(usize)]
enum TableId {
    Edge = 0,
    Corn = 1,
    Edge2 = 2,
    Edge3 = 3,
    Edge4 = 4,
    Edge6 = 5,
    Corn2 = 6,
    Corn3 = 7,
    Eo12 = 8,
    Eo12Alt = 9,
    Ep1 = 10,
    Ep4 = 11,
}

const TABLE_FILES: [&str; N_TABLES] = [
    "mt_edge.bin",
    "mt_corn.bin",
    "mt_edge2.bin",
    "mt_edge3.bin",
    "mt_edge4.bin",
    "mt_edge6.bin",
    "mt_corn2.bin",
    "mt_corn3.bin",
    "mt_eo12.bin",
    "mt_eo12_alt.bin",
    "mt_ep1.bin",
    "mt_ep4.bin",
];

// ---------- Manager ----------

pub struct MoveTableManager {
    slots: [Mutex<Option<Arc<MoveTable>>>; N_TABLES],
}

impl MoveTableManager {
    pub(crate) fn new() -> Self {
        // 数组用 from_fn 初始化,因为 Mutex 不是 Copy
        let slots = std::array::from_fn(|_| Mutex::new(None));
        MoveTableManager { slots }
    }
}

pub fn instance() -> &'static MoveTableManager {
    static INST: OnceLock<MoveTableManager> = OnceLock::new();
    INST.get_or_init(MoveTableManager::new)
}

// ---------- 公共 ensure / release 接口 ----------

macro_rules! ensure_release {
    ($ensure:ident, $release:ident, $id:expr, $gen:ident, $state_count:expr, $stride:expr) => {
        impl MoveTableManager {
            pub fn $ensure(&self) -> Arc<MoveTable> {
                self.ensure_with($id, $state_count, $stride, $gen)
            }

            pub fn $release(&self) {
                self.release_slot($id);
            }
        }
    };
}

ensure_release!(ensure_edge, release_edge, TableId::Edge as usize, gen_mt_edge,
    state_space::EDGE as u32, 18);
ensure_release!(ensure_corn, release_corn, TableId::Corn as usize, gen_mt_corn,
    state_space::CORNER as u32, 18);
ensure_release!(ensure_edge2, release_edge2, TableId::Edge2 as usize, gen_mt_edge2,
    state_space::EDGE2 as u32, 18);
ensure_release!(ensure_edge3, release_edge3, TableId::Edge3 as usize, gen_mt_edge3,
    state_space::EDGE3 as u32, 18);
ensure_release!(ensure_edge4, release_edge4, TableId::Edge4 as usize, gen_mt_edge4,
    state_space::CROSS as u32, 24);
ensure_release!(ensure_corn2, release_corn2, TableId::Corn2 as usize, gen_mt_corn2,
    state_space::CORNER2 as u32, 18);
ensure_release!(ensure_corn3, release_corn3, TableId::Corn3 as usize, gen_mt_corn3,
    state_space::CORNER3 as u32, 18);
ensure_release!(ensure_eo12, release_eo12, TableId::Eo12 as usize, gen_mt_eo12,
    state_space::EO12 as u32, 18);
ensure_release!(ensure_eo12_alt, release_eo12_alt, TableId::Eo12Alt as usize, gen_mt_eo12_alt,
    state_space::EO12 as u32, 18);
ensure_release!(ensure_ep1, release_ep1, TableId::Ep1 as usize, gen_mt_ep1,
    12, 18);
ensure_release!(ensure_ep4, release_ep4, TableId::Ep4 as usize, gen_mt_ep4,
    state_space::EP4 as u32, 18);

// edge6 单独处理(默认 panic)
impl MoveTableManager {
    pub fn ensure_edge6(&self) -> Arc<MoveTable> {
        let allow = std::env::var("CUBE_ALLOW_HUGE_TABLES")
            .map(|v| v == "1")
            .unwrap_or(false);
        let path = table_path(TABLE_FILES[TableId::Edge6 as usize]);
        if !path.exists() && !allow {
            panic!(
                "mt_edge6 generation disabled, size ~3GB; \
                 set CUBE_ALLOW_HUGE_TABLES=1 to opt in"
            );
        }
        self.ensure_with(
            TableId::Edge6 as usize,
            state_space::EDGE6 as u32,
            18,
            gen_mt_edge6,
        )
    }

    pub fn release_edge6(&self) {
        self.release_slot(TableId::Edge6 as usize);
    }
}

// ---------- 内部:加载或生成 ----------

impl MoveTableManager {
    fn ensure_with(
        &self,
        id: usize,
        state_count: u32,
        stride: u32,
        gen_fn: fn(&MoveTableManager) -> Vec<u32>,
    ) -> Arc<MoveTable> {
        // 快速路径:已加载
        {
            let g = self.slots[id].lock().unwrap();
            if let Some(t) = g.as_ref() {
                return Arc::clone(t);
            }
        }
        // 慢路径:需要 load/gen。注意要在不持锁的状态下调用 gen_fn,因为依赖表会反过来锁。
        let path = table_path(TABLE_FILES[id]);
        ensure_parent_dir(&path);

        let expected_entries = (state_count as u64) * (stride as u64);

        if !path.exists() {
            let data = gen_fn(self);
            assert_eq!(
                data.len() as u64,
                expected_entries,
                "generated {} has unexpected length {} (expected {})",
                TABLE_FILES[id],
                data.len(),
                expected_entries
            );
            write_table_le_u32(&path, &data).expect("write table");
        }

        let table = load_table_from_disk(&path, expected_entries, state_count, stride);
        let arc = Arc::new(table);
        let mut g = self.slots[id].lock().unwrap();
        // 并发兜底:别人可能在我们 gen 完前先放了一个
        if let Some(existing) = g.as_ref() {
            Arc::clone(existing)
        } else {
            *g = Some(Arc::clone(&arc));
            arc
        }
    }

    fn release_slot(&self, id: usize) {
        let mut g = self.slots[id].lock().unwrap();
        *g = None;
    }
}

fn ensure_parent_dir(p: &Path) {
    if let Some(dir) = p.parent() {
        if !dir.as_os_str().is_empty() && !dir.exists() {
            let _ = fs::create_dir_all(dir);
        }
    }
}

fn load_table_from_disk(
    path: &Path,
    expected_entries: u64,
    state_count: u32,
    stride: u32,
) -> MoveTable {
    let file = File::open(path).expect("open table file");
    let meta = file.metadata().expect("stat table");
    let total = meta.len();
    let expected_bytes = 12 + expected_entries * 4;
    assert_eq!(
        total, expected_bytes,
        "table file {} has wrong size {} (expected {})",
        path.display(),
        total,
        expected_bytes
    );

    // SAFETY: 我们承诺在 mmap 生命周期内文件不被修改(本工程只写一次再 mmap)。
    let mmap = unsafe { Mmap::map(&file) }.expect("mmap table");
    // 校验 magic + entry_count
    assert_eq!(&mmap[..8], MAGIC, "bad magic in {}", path.display());
    let n = u32::from_le_bytes(mmap[8..12].try_into().unwrap()) as u64;
    assert_eq!(
        n, expected_entries,
        "entry_count mismatch in {}",
        path.display()
    );

    MoveTable {
        data: TableStorage::Mmap(mmap),
        state_count,
        stride,
    }
}

// ---------- 基础表生成器(单棱 / 单角 / 单棱位置) ----------

/// C++ createMTEdge:为每个 "edge i/2 处于位置 i/2,朝向 i%2" 的"单棱状态",
/// 枚举 18 个 move,写入"新单棱状态"。
fn create_mt_edge() -> Vec<u32> {
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
fn create_mt_corn() -> Vec<u32> {
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
fn create_mt_ep() -> Vec<u32> {
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
fn create_mt_eo() -> Vec<u32> {
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
            let idx = o_to_index(&eo_i32, 2, 12);
            mt[18 * i + j] = 18 * idx as u32;
        }
    }
    mt
}

/// C++ createMTEOAlt:同上但不预乘 18(table_naming.csv 标 "原始")。
fn create_mt_eo_alt() -> Vec<u32> {
    let size = state_space::EO12;
    let mut mt = vec![0u32; size * 18];
    for i in 0..size {
        let mut eo_arr = vec![0i32; 12];
        index_to_o(&mut eo_arr, i as i32, 2, 12);
        let mut s = State::SOLVED;
        for k in 0..12 {
            s.edges[k] = 2 * (k as u8) + eo_arr[k] as u8;
        }
        for j in 0..18 {
            let m = Move::from_index(j);
            let ns = s.applied(m);
            let (_ep, eo_new) = ns.ep_eo();
            let eo_i32: Vec<i32> = eo_new.iter().map(|&x| x as i32).collect();
            let idx = o_to_index(&eo_i32, 2, 12);
            mt[18 * i + j] = idx as u32;
        }
    }
    mt
}

// ---------- 12 张 gen_* 函数:从依赖表派生 ----------

fn gen_mt_edge(_mgr: &MoveTableManager) -> Vec<u32> {
    create_mt_edge()
}

fn gen_mt_corn(_mgr: &MoveTableManager) -> Vec<u32> {
    create_mt_corn()
}

fn gen_mt_ep1(_mgr: &MoveTableManager) -> Vec<u32> {
    create_mt_ep()
}

fn gen_mt_eo12(_mgr: &MoveTableManager) -> Vec<u32> {
    create_mt_eo()
}

fn gen_mt_eo12_alt(_mgr: &MoveTableManager) -> Vec<u32> {
    create_mt_eo_alt()
}

/// helper:把依赖表 (u32 切片) 转 i32 喂给 create_multi_move_table*
fn as_i32(slice: &[u32]) -> Vec<i32> {
    slice.iter().map(|&x| x as i32).collect()
}

fn gen_mt_edge2(mgr: &MoveTableManager) -> Vec<u32> {
    let edge = mgr.ensure_edge();
    let basic = as_i32(edge.as_u32());
    create_multi_move_table(2, 2, 12, state_space::EDGE2 as i32, &basic)
        .into_iter()
        .map(|x| x as u32)
        .collect()
}

fn gen_mt_edge3(mgr: &MoveTableManager) -> Vec<u32> {
    let edge = mgr.ensure_edge();
    let basic = as_i32(edge.as_u32());
    create_multi_move_table(3, 2, 12, state_space::EDGE3 as i32, &basic)
        .into_iter()
        .map(|x| x as u32)
        .collect()
}

fn gen_mt_edge4(mgr: &MoveTableManager) -> Vec<u32> {
    let edge = mgr.ensure_edge();
    let basic = as_i32(edge.as_u32());
    create_multi_move_table2(4, 2, 12, state_space::CROSS as i32, &basic)
        .into_iter()
        .map(|x| x as u32)
        .collect()
}

fn gen_mt_edge6(mgr: &MoveTableManager) -> Vec<u32> {
    let edge = mgr.ensure_edge();
    let basic = as_i32(edge.as_u32());
    create_multi_move_table(6, 2, 12, state_space::EDGE6 as i32, &basic)
        .into_iter()
        .map(|x| x as u32)
        .collect()
}

fn gen_mt_corn2(mgr: &MoveTableManager) -> Vec<u32> {
    let corn = mgr.ensure_corn();
    let basic = as_i32(corn.as_u32());
    create_multi_move_table(2, 3, 8, state_space::CORNER2 as i32, &basic)
        .into_iter()
        .map(|x| x as u32)
        .collect()
}

fn gen_mt_corn3(mgr: &MoveTableManager) -> Vec<u32> {
    let corn = mgr.ensure_corn();
    let basic = as_i32(corn.as_u32());
    create_multi_move_table(3, 3, 8, state_space::CORNER3 as i32, &basic)
        .into_iter()
        .map(|x| x as u32)
        .collect()
}

fn gen_mt_ep4(mgr: &MoveTableManager) -> Vec<u32> {
    let ep1 = mgr.ensure_ep1();
    let basic = as_i32(ep1.as_u32());
    create_multi_move_table(4, 1, 12, state_space::EP4 as i32, &basic)
        .into_iter()
        .map(|x| x as u32)
        .collect()
}

// 用一下 cc::Move 让导入不报 unused
const _: fn() = || {
    let _ = cc::Move::U;
};
}

#[cfg(not(target_arch = "wasm32"))]
pub use manager::*;

// ---------- 测试 ----------

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex as StdMutex;

    /// 使用 cube_common::test_env_lock(),与 prune_tables 共享同一把锁,避免
    /// CUBE_TABLE_DIR 被并发测试相互覆盖。
    fn test_lock() -> &'static StdMutex<()> {
        cc::test_env_lock()
    }

    fn fresh_dir(name: &str) -> PathBuf {
        // 用 target/test-tables/<name>/ 隔离,避免污染 ./tables/
        let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        p.push("target");
        p.push("test-tables");
        p.push(name);
        if p.exists() {
            let _ = fs::remove_dir_all(&p);
        }
        fs::create_dir_all(&p).unwrap();
        p
    }

    fn with_table_dir<R>(name: &str, f: impl FnOnce() -> R) -> R {
        let _g = test_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = fresh_dir(name);
        std::env::set_var("CUBE_TABLE_DIR", &dir);
        let r = f();
        std::env::remove_var("CUBE_TABLE_DIR");
        let _ = fs::remove_dir_all(&dir);
        r
    }

    /// 每个测试要用全新的 Manager(全局 instance() 跨测试串扰),所以测试里
    /// 直接构造一个本地 Manager。
    fn fresh_mgr() -> MoveTableManager {
        MoveTableManager::new()
    }

    // ---- mt_edge / mt_corn 基础 ----

    #[test]
    fn mt_edge_gen_then_mmap_eq() {
        with_table_dir("edge_basic", || {
            let mgr = fresh_mgr();
            // 第一次:磁盘上没文件,走生成路径
            let t1 = mgr.ensure_edge();
            let path = table_path("mt_edge.bin");
            assert!(path.exists());
            assert_eq!(fs::metadata(&path).unwrap().len(), 12 + 24 * 18 * 4);
            assert_eq!(t1.as_u32().len(), 24 * 18);

            // 验证若干已知:U 在 face=0,U(idx 0)轮换 top edges; e=8/9/10/11 不动
            // edge 8 (UF top? 不,边块编号见 cube_common 中的 ep 排列;U move 的 ep 列表
            // 是 [0,1,2,3,7,4,5,6,8,9,10,11],意味着位置 4 ← 位置 7,即 edge 7 移到位置 4。
            // 在 mt_edge 里 i = 2*edge+ori,起始位置=edge,所以
            //   i=14 (edge=7,ori=0) move=U(0): 应该返回 2*4 + 0 = 8
            let v = t1.as_u32();
            assert_eq!(v[18 * 14 + 0], 8, "edge 7 under U should land at pos 4 ori 0");

            // 释放并重新 ensure -> 走 mmap 路径,内容必须一致
            mgr.release_edge();
            let t2 = mgr.ensure_edge();
            assert_eq!(t1.as_u32(), t2.as_u32());
        });
    }

    #[test]
    fn mt_corn_gen_then_mmap_eq() {
        with_table_dir("corn_basic", || {
            let mgr = fresh_mgr();
            let t1 = mgr.ensure_corn();
            assert_eq!(t1.as_u32().len(), 24 * 18);
            let path = table_path("mt_corn.bin");
            assert_eq!(fs::metadata(&path).unwrap().len(), 12 + 24 * 18 * 4);
            mgr.release_corn();
            let t2 = mgr.ensure_corn();
            assert_eq!(t1.as_u32(), t2.as_u32());
        });
    }

    // ---- 小复合表:edge2 / edge3 / corn2 / corn3 ----

    #[test]
    fn mt_edge2_size_and_roundtrip() {
        with_table_dir("edge2", || {
            let mgr = fresh_mgr();
            let t = mgr.ensure_edge2();
            assert_eq!(t.as_u32().len(), 528 * 18);
            assert_eq!(
                fs::metadata(table_path("mt_edge2.bin")).unwrap().len(),
                12 + 528 * 18 * 4
            );
            // mmap 重新加载
            mgr.release_edge2();
            let t2 = mgr.ensure_edge2();
            assert_eq!(t.as_u32(), t2.as_u32());
        });
    }

    #[test]
    fn mt_edge3_size() {
        with_table_dir("edge3", || {
            let mgr = fresh_mgr();
            let t = mgr.ensure_edge3();
            assert_eq!(t.as_u32().len(), 10560 * 18);
            assert_eq!(
                fs::metadata(table_path("mt_edge3.bin")).unwrap().len(),
                12 + 10560 * 18 * 4
            );
        });
    }

    #[test]
    fn mt_corn2_size_and_roundtrip() {
        with_table_dir("corn2", || {
            let mgr = fresh_mgr();
            let t = mgr.ensure_corn2();
            assert_eq!(t.as_u32().len(), 504 * 18);
            assert_eq!(
                fs::metadata(table_path("mt_corn2.bin")).unwrap().len(),
                12 + 504 * 18 * 4
            );
            mgr.release_corn2();
            let t2 = mgr.ensure_corn2();
            assert_eq!(t.as_u32(), t2.as_u32());
        });
    }

    #[test]
    fn mt_corn3_size() {
        with_table_dir("corn3", || {
            let mgr = fresh_mgr();
            let t = mgr.ensure_corn3();
            assert_eq!(t.as_u32().len(), 9072 * 18);
            assert_eq!(
                fs::metadata(table_path("mt_corn3.bin")).unwrap().len(),
                12 + 9072 * 18 * 4
            );
        });
    }

    // ---- EO 系列 ----

    #[test]
    fn mt_eo12_size_and_premul() {
        with_table_dir("eo12", || {
            let mgr = fresh_mgr();
            let t = mgr.ensure_eo12();
            assert_eq!(t.as_u32().len(), 2048 * 18);
            // 预乘 18:每个值要么是 0,要么是 18 的倍数 (且 < 2048*18)
            let v = t.as_u32();
            for &x in v.iter().take(1000) {
                assert_eq!(x % 18, 0, "mt_eo12 value not pre-multiplied");
                assert!(x < 2048 * 18);
            }
            // identity move 不存在,但 i=0 (all-zero eo) 经过 U/U2/U' (不影响 EO) 应该仍是 0
            // U(0)/U2(1)/U'(2)/D/D2/D' 不改 eo
            for j in [0u8, 1, 2, 3, 4, 5] {
                assert_eq!(v[j as usize], 0, "U/D-axis should preserve all-zero EO");
            }
        });
    }

    #[test]
    fn mt_eo12_alt_size_no_premul() {
        with_table_dir("eo12_alt", || {
            let mgr = fresh_mgr();
            let t = mgr.ensure_eo12_alt();
            assert_eq!(t.as_u32().len(), 2048 * 18);
            // 原始(无预乘):值在 [0, 2048) 范围
            let v = t.as_u32();
            for &x in v.iter().take(1000) {
                assert!(x < 2048, "mt_eo12_alt out of range: {}", x);
            }
        });
    }

    // ---- EP1 / EP4 ----

    #[test]
    fn mt_ep1_size() {
        with_table_dir("ep1", || {
            let mgr = fresh_mgr();
            let t = mgr.ensure_ep1();
            assert_eq!(t.as_u32().len(), 12 * 18);
            assert_eq!(
                fs::metadata(table_path("mt_ep1.bin")).unwrap().len(),
                12 + 12 * 18 * 4
            );
            // 验证 edge 0 在 U move 下不动(U 只动 top-layer edges 4..7)
            assert_eq!(t.as_u32()[0], 0);
            // edge 4 在 U move 下移到位置 5
            //   U 的 ep = [0,1,2,3,7,4,5,6,8,9,10,11] 表示 new_ep[i] = old_ep[move.ep[i]]
            //   从 solved 出发,edge=4 起始在位置 4,U 后:找 edge 4 在新 ep 的位置
            //   new_ep = [0,1,2,3, old_ep[7], old_ep[4], old_ep[5], old_ep[6], 8,9,10,11]
            //          = [0,1,2,3, 7, 4, 5, 6, ...]  -> edge 4 在位置 5
            assert_eq!(t.as_u32()[18 * 4 + 0], 5);
        });
    }

    #[test]
    fn mt_ep4_depends_on_ep1() {
        with_table_dir("ep4", || {
            let mgr = fresh_mgr();
            let t = mgr.ensure_ep4();
            assert_eq!(t.as_u32().len(), 11880 * 18);
            assert_eq!(
                fs::metadata(table_path("mt_ep4.bin")).unwrap().len(),
                12 + 11880 * 18 * 4
            );
            // ensure_ep4 内部会自动 ensure_ep1
            assert!(table_path("mt_ep1.bin").exists());
        });
    }

    // ---- 中表 (#[ignore]) ----

    #[test]
    #[ignore]
    fn mt_edge4_size_17mb() {
        with_table_dir("edge4", || {
            let mgr = fresh_mgr();
            let t = mgr.ensure_edge4();
            assert_eq!(t.as_u32().len(), 190080 * 24);
            assert_eq!(
                fs::metadata(table_path("mt_edge4.bin")).unwrap().len(),
                12 + 190080 * 24 * 4
            );
            // mmap reload
            mgr.release_edge4();
            let t2 = mgr.ensure_edge4();
            assert_eq!(t.as_u32().len(), t2.as_u32().len());
        });
    }

    // ---- mt_edge6 保护机制 ----

    #[test]
    #[ignore]
    fn mt_edge6_default_panics() {
        with_table_dir("edge6_protect", || {
            let mgr = fresh_mgr();
            std::env::remove_var("CUBE_ALLOW_HUGE_TABLES");
            let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                let _ = mgr.ensure_edge6();
            }));
            assert!(r.is_err(), "ensure_edge6 should panic by default");
        });
    }
}
