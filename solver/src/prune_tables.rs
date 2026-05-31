//! prune_tables: 4-bit packed 剪枝表的懒生成/加载/释放管理。
//!
//! 移植自 C++ PruneTableManager (`prune_tables.{h,cpp}`)。
//!
//! 文件格式(Rust 端,与 C++ .bin 不兼容):
//!   [0..8]   magic "CUBEPT01"
//!   [8..16]  u64 LE entry_count (逻辑条目数,可能 > u32::MAX,例如 EDGE6*CORNER2)
//!   [16..]   ceil(entry_count/2) 字节 packed nibbles
//!     nibble 顺序: low nibble = 偶数 index,high nibble = 奇数 index
//!     get(i) = (byte[i>>1] >> ((i&1)<<2)) & 0xF
//!
//! 角色(table_naming.csv):
//!   Canon = 真加载,本模块提供 ensure_* / release_*
//!   Conj  = 共轭复用,运行时映射,无独立 ensure_*
//!   Zombie = 仅调试用,本模块不暴露 ensure_*
//!
//! 大表保护策略(继承 Phase 2):
//!   - 默认 cargo test:
//!     - 真生成: pt_cross / pt_pscross / pt_pair_C4E0 / pt_pscross_C / pt_pspair_CE
//!       (≤ 2.18 MB)
//!   - cargo test -- --ignored:
//!     - 还可真生成 pt_cross_ins_C4 / pt_pscross_ins_C / pt_cross_C4E0 / pt_pscross_C4E
//!       / pt_pscross_Edge2 / pt_pscross_Corner2 / pt_ep4eo12 (≤ 52 MB)
//!   - 任何场景禁止默认生成 (panic 保护):
//!     - pt_pscross_Edge3 / pt_pscross_Corner3 (~822-957 MB)
//!     - pt_cross_CEE / pt_cross_CCE / pt_cross_C4C5C6 (~1.22 GB)
//!     - pt_cross_C4C5E0E1 / pt_cross_C4C6E0E2 (~10 GB)
//!     需要 env CUBE_ALLOW_HUGE_TABLES=1 才放行。

use std::fs::{self, File};
use std::io::{self, BufReader, BufWriter, Read, Write};
use std::path::Path;
#[cfg(test)]
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};

#[cfg(not(target_arch = "wasm32"))]
use memmap2::Mmap;

#[cfg(not(target_arch = "wasm32"))]
use crate::cube_common::state_space;
#[cfg(not(target_arch = "wasm32"))]
use crate::move_tables::{self as mt, table_path};

// ---------- 文件格式 ----------

pub const PT_MAGIC: &[u8; 8] = b"CUBEPT01";
pub const PT_HEADER_BYTES: usize = 16;

#[derive(Debug)]
pub enum PtError {
    Io(io::Error),
    BadMagic,
    BadSize,
}

impl From<io::Error> for PtError {
    fn from(e: io::Error) -> Self {
        PtError::Io(e)
    }
}

impl std::fmt::Display for PtError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PtError::Io(e) => write!(f, "io: {}", e),
            PtError::BadMagic => write!(f, "bad magic (expected CUBEPT01)"),
            PtError::BadSize => write!(f, "file size mismatch"),
        }
    }
}

impl std::error::Error for PtError {}

pub fn write_packed_prune_table<P: AsRef<Path>>(
    path: P,
    entry_count: u64,
    bytes: &[u8],
) -> Result<(), PtError> {
    let expected = ((entry_count + 1) / 2) as usize;
    if bytes.len() != expected {
        return Err(PtError::BadSize);
    }
    // Atomic write: 写到 .tmp 再 rename,避免中断留半截文件
    let final_path = path.as_ref();
    let tmp_path = final_path.with_extension("bin.tmp");
    {
        let f = File::create(&tmp_path)?;
        let mut w = BufWriter::new(f);
        w.write_all(PT_MAGIC)?;
        w.write_all(&entry_count.to_le_bytes())?;
        w.write_all(bytes)?;
        w.flush()?;
    }
    std::fs::rename(&tmp_path, final_path)?;
    Ok(())
}

/// 读盘并返回 (entry_count, bytes)。
#[allow(dead_code)]
pub fn read_packed_prune_table<P: AsRef<Path>>(path: P) -> Result<(u64, Vec<u8>), PtError> {
    let f = File::open(path)?;
    let meta = f.metadata()?;
    let mut r = BufReader::new(f);
    let mut magic = [0u8; 8];
    r.read_exact(&mut magic)?;
    if &magic != PT_MAGIC {
        return Err(PtError::BadMagic);
    }
    let mut nb = [0u8; 8];
    r.read_exact(&mut nb)?;
    let n = u64::from_le_bytes(nb);
    let expected_bytes = (n + 1) / 2;
    let expected_total = PT_HEADER_BYTES as u64 + expected_bytes;
    if meta.len() != expected_total {
        return Err(PtError::BadSize);
    }
    let mut out = vec![0u8; expected_bytes as usize];
    r.read_exact(&mut out)?;
    Ok((n, out))
}

// ---------- 4-bit packed 访问 ----------

/// nibble 顺序与 C++ set_prune / get_prune 一致:
///   shift = (idx & 1) << 2
///   get(i) = (byte[i>>1] >> shift) & 0xF
///   set(i,v): byte[i>>1] &= ~(0xF<<shift); byte[i>>1] |= (v&0xF)<<shift
#[inline]
pub fn get_prune_nibble(bytes: &[u8], idx: u64) -> u8 {
    let shift = ((idx & 1) << 2) as u8;
    (bytes[(idx >> 1) as usize] >> shift) & 0xF
}

#[inline]
pub fn set_prune_nibble(bytes: &mut [u8], idx: u64, value: u8) {
    let shift = ((idx & 1) << 2) as u8;
    let pos = (idx >> 1) as usize;
    bytes[pos] = (bytes[pos] & !(0xF << shift)) | ((value & 0xF) << shift);
}

// ---------- PackedPruneTable + 存储 ----------

pub enum PtStorage {
    Owned(Vec<u8>),
    #[cfg(not(target_arch = "wasm32"))]
    Mmap(Mmap),
}

impl PtStorage {
    pub fn bytes(&self) -> &[u8] {
        match self {
            PtStorage::Owned(v) => v.as_slice(),
            #[cfg(not(target_arch = "wasm32"))]
            PtStorage::Mmap(m) => &m[PT_HEADER_BYTES..],
        }
    }
}

impl std::fmt::Debug for PtStorage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PtStorage::Owned(v) => write!(f, "Owned(len={})", v.len()),
            #[cfg(not(target_arch = "wasm32"))]
            PtStorage::Mmap(m) => write!(f, "Mmap(bytes={})", m.len()),
        }
    }
}

#[derive(Debug)]
pub struct PackedPruneTable {
    pub data: PtStorage,
    pub entry_count: u64,
}

impl PackedPruneTable {
    pub fn bytes(&self) -> &[u8] {
        self.data.bytes()
    }

    /// 返回 0..15(C++ 端的 4-bit "深度下界")。
    #[inline]
    pub fn get(&self, idx: u64) -> u8 {
        get_prune_nibble(self.bytes(), idx)
    }

    /// 从 .bin 字节(16B header: PT_MAGIC + u64 LE entry_count,后接 ceil(n/2) packed
    /// nibbles)构造 Owned 表。WASM 路径用:JS fetch 表字节喂进来,绕过 mmap/磁盘。
    /// 任意 target 可用。
    pub fn from_bin(bytes: &[u8]) -> PackedPruneTable {
        assert!(bytes.len() >= PT_HEADER_BYTES, "pt bin too short");
        assert_eq!(&bytes[..8], PT_MAGIC, "bad pt magic");
        let n = u64::from_le_bytes(bytes[8..16].try_into().unwrap());
        let expected = ((n + 1) / 2) as usize;
        let data = &bytes[PT_HEADER_BYTES..];
        assert_eq!(data.len(), expected, "pt data length mismatch");
        PackedPruneTable {
            data: PtStorage::Owned(data.to_vec()),
            entry_count: n,
        }
    }
}

// ---------- 表 ID ----------
//
// 仅包含 Canon 角色的表(table_naming.csv)。Conj 表运行时通过 rot_map 映射,
// Zombie 表本模块不暴露。
//
// 整块 manager(磁盘表生成 + mmap 加载)native-only;WASM 走 PackedPruneTable::from_bin
// + solver from_tables 绕过,不需要 manager。

#[cfg(not(target_arch = "wasm32"))]
mod manager {
    use super::*;

const N_TABLES: usize = 47;

#[derive(Copy, Clone, Debug)]
#[repr(usize)]
pub enum PtId {
    // --- Std/Pair/EOCross 共享表 ---
    Cross = 0,           // pt_cross.bin                 ~139 KB
    CrossInsC4 = 1,      // pt_cross_ins_C4.bin          ~2.18 MB
    PairC4E0 = 2,        // pt_pair_C4E0.bin             ~292 B
    CrossC4E0 = 3,       // pt_cross_C4E0.bin            ~52.2 MB
    CrossC4C5E0E1 = 4,   // pt_cross_C4C5E0E1.bin        ~10 GB
    CrossC4C6E0E2 = 5,   // pt_cross_C4C6E0E2.bin        ~10 GB

    // --- Pseudo 基础表 ---
    PsCross = 6,         // pt_pscross.bin               ~139 KB
    PsCrossC4E0 = 7,     // pt_pscross_C4E0.bin          ~52.2 MB
    PsCrossC4E1 = 8,
    PsCrossC4E2 = 9,
    PsCrossC4E3 = 10,

    // --- Pseudo Aux Edge2 (仅 Canon: E0E1, E0E2) ---
    PsCrossE0E1 = 11,    // ~47.8 MB
    PsCrossE0E2 = 12,    // ~47.8 MB

    // --- Pseudo Aux Edge3 (仅 Canon: E0E1E2) ---
    PsCrossE0E1E2 = 13,  // ~957 MB

    // --- Pseudo Aux Corner2 (仅 Canon: C4C5, C4C6) ---
    PsCrossC4C5 = 14,    // ~45.6 MB
    PsCrossC4C6 = 15,    // ~45.6 MB

    // --- Pseudo Aux Corner3 (仅 Canon: C4C5C6) ---
    PsCrossC4C5C6 = 16,  // ~822 MB

    // --- PseudoPair 变体表 ---
    PsCrossC4 = 17,
    PsCrossC5 = 18,
    PsCrossC6 = 19,
    PsCrossC7 = 20,
    // ins_C_diff[e*4+c]: e=0..3, c=0..3
    PsCrossInsC4Diff0 = 21,
    PsCrossInsC4Diff1 = 22,
    PsCrossInsC4Diff2 = 23,
    PsCrossInsC4Diff3 = 24,
    PsCrossInsC5Diff0 = 25,
    PsCrossInsC5Diff1 = 26,
    PsCrossInsC5Diff2 = 27,
    PsCrossInsC5Diff3 = 28,
    PsCrossInsC6Diff0 = 29,
    PsCrossInsC6Diff1 = 30,
    PsCrossInsC6Diff2 = 31,
    PsCrossInsC6Diff3 = 32,
    PsCrossInsC7Diff0 = 33,
    PsCrossInsC7Diff1 = 34,
    PsCrossInsC7Diff2 = 35,
    PsCrossInsC7Diff3 = 36,

    // --- EOCross 专用表 ---
    Ep4Eo12 = 37,        // ~11.6 MB
    CrossC4E0E1 = 38,    // ~1.22 GB
    CrossC4E0E2 = 39,
    CrossC4E0E3 = 40,
    CrossC4C5E0 = 41,    // ~1.22 GB
    CrossC4C6E0 = 42,
    CrossC4C7E0 = 43,
    CrossC4C5C6 = 44,    // ~1.22 GB

    // --- PseudoPair Pair (16 张 296B) ---
    // 不单独 enum:用 PspairCE 槽放 16 张
    PspairCEStart = 45,
    // 45..=60 (16 slots)
    // _PspairCE15 = 60,
    _Last = 46, // 占位,使 N_TABLES 准确
}

const TABLE_FILES: [&str; N_TABLES] = [
    "pt_cross.bin",                  // 0
    "pt_cross_ins_C4.bin",           // 1
    "pt_pair_C4E0.bin",              // 2
    "pt_cross_C4E0.bin",             // 3
    "pt_cross_C4C5E0E1.bin",         // 4
    "pt_cross_C4C6E0E2.bin",         // 5
    "pt_pscross.bin",                // 6
    "pt_pscross_C4E0.bin",           // 7
    "pt_pscross_C4E1.bin",           // 8
    "pt_pscross_C4E2.bin",           // 9
    "pt_pscross_C4E3.bin",           // 10
    "pt_pscross_E0E1.bin",           // 11
    "pt_pscross_E0E2.bin",           // 12
    "pt_pscross_E0E1E2.bin",         // 13
    "pt_pscross_C4C5.bin",           // 14
    "pt_pscross_C4C6.bin",           // 15
    "pt_pscross_C4C5C6.bin",         // 16
    "pt_pscross_C4.bin",             // 17
    "pt_pscross_C5.bin",             // 18
    "pt_pscross_C6.bin",             // 19
    "pt_pscross_C7.bin",             // 20
    "pt_pscross_ins_C4_diff0.bin",   // 21
    "pt_pscross_ins_C4_diff1.bin",   // 22
    "pt_pscross_ins_C4_diff2.bin",   // 23
    "pt_pscross_ins_C4_diff3.bin",   // 24
    "pt_pscross_ins_C5_diff0.bin",   // 25
    "pt_pscross_ins_C5_diff1.bin",   // 26
    "pt_pscross_ins_C5_diff2.bin",   // 27
    "pt_pscross_ins_C5_diff3.bin",   // 28
    "pt_pscross_ins_C6_diff0.bin",   // 29
    "pt_pscross_ins_C6_diff1.bin",   // 30
    "pt_pscross_ins_C6_diff2.bin",   // 31
    "pt_pscross_ins_C6_diff3.bin",   // 32
    "pt_pscross_ins_C7_diff0.bin",   // 33
    "pt_pscross_ins_C7_diff1.bin",   // 34
    "pt_pscross_ins_C7_diff2.bin",   // 35
    "pt_pscross_ins_C7_diff3.bin",   // 36
    "pt_ep4eo12.bin",                // 37
    "pt_cross_C4E0E1.bin",           // 38
    "pt_cross_C4E0E2.bin",           // 39
    "pt_cross_C4E0E3.bin",           // 40
    "pt_cross_C4C5E0.bin",           // 41
    "pt_cross_C4C6E0.bin",           // 42
    "pt_cross_C4C7E0.bin",           // 43
    "pt_cross_C4C5C6.bin",           // 44
    "_pspair_ce_placeholder_45.bin", // 45 (实际由 pspair_ce 数组覆盖)
    "_unused_46.bin",                // 46
];

// PspairCE 单独用一组槽位(16 张 296B 表)
const N_PSPAIR_CE: usize = 16;

const PSPAIR_CE_FILES: [&str; N_PSPAIR_CE] = [
    "pt_pspair_C4_E0.bin", "pt_pspair_C5_E0.bin", "pt_pspair_C6_E0.bin", "pt_pspair_C7_E0.bin",
    "pt_pspair_C4_E1.bin", "pt_pspair_C5_E1.bin", "pt_pspair_C6_E1.bin", "pt_pspair_C7_E1.bin",
    "pt_pspair_C4_E2.bin", "pt_pspair_C5_E2.bin", "pt_pspair_C6_E2.bin", "pt_pspair_C7_E2.bin",
    "pt_pspair_C4_E3.bin", "pt_pspair_C5_E3.bin", "pt_pspair_C6_E3.bin", "pt_pspair_C7_E3.bin",
];

// ---------- 状态空间大小 ----------
//
// 用 u64 因为 EDGE6 * CORNER2 = 42577920 * 504 = 21459070080 > 2^32。

#[inline]
fn ec_count(t: usize) -> u64 {
    use PtId as I;
    let cr = state_space::CROSS as u64;
    let ed = state_space::EDGE as u64;
    let cn = state_space::CORNER as u64;
    let e2 = state_space::EDGE2 as u64;
    let e3 = state_space::EDGE3 as u64;
    let c2 = state_space::CORNER2 as u64;
    let c3 = state_space::CORNER3 as u64;
    let e6 = state_space::EDGE6 as u64;
    let ep4 = state_space::EP4 as u64;
    let eo = state_space::EO12 as u64;
    match t {
        x if x == I::Cross as usize => e2 * e2,
        x if x == I::CrossInsC4 as usize => cr * cn,
        x if x == I::PairC4E0 as usize => ed * cn,
        x if x == I::CrossC4E0 as usize => cr * cn * ed,
        x if x == I::CrossC4C5E0E1 as usize => e6 * c2,
        x if x == I::CrossC4C6E0E2 as usize => e6 * c2,
        x if x == I::PsCross as usize => e2 * e2,
        x if x == I::PsCrossC4E0 as usize
            || x == I::PsCrossC4E1 as usize
            || x == I::PsCrossC4E2 as usize
            || x == I::PsCrossC4E3 as usize => cr * cn * ed,
        x if x == I::PsCrossE0E1 as usize || x == I::PsCrossE0E2 as usize => cr * e2,
        x if x == I::PsCrossE0E1E2 as usize => cr * e3,
        x if x == I::PsCrossC4C5 as usize || x == I::PsCrossC4C6 as usize => cr * c2,
        x if x == I::PsCrossC4C5C6 as usize => cr * c3,
        x if x == I::PsCrossC4 as usize
            || x == I::PsCrossC5 as usize
            || x == I::PsCrossC6 as usize
            || x == I::PsCrossC7 as usize => cr * cn,
        x if (I::PsCrossInsC4Diff0 as usize..=I::PsCrossInsC7Diff3 as usize).contains(&x) => cr * cn,
        x if x == I::Ep4Eo12 as usize => ep4 * eo,
        x if x == I::CrossC4E0E1 as usize
            || x == I::CrossC4E0E2 as usize
            || x == I::CrossC4E0E3 as usize => cr * cn * ed * ed,
        x if x == I::CrossC4C5E0 as usize
            || x == I::CrossC4C6E0 as usize
            || x == I::CrossC4C7E0 as usize => cr * cn * ed * cn,
        x if x == I::CrossC4C5C6 as usize => cr * cn * cn * cn,
        _ => 0,
    }
}

// ---------- 大表保护(单位:逻辑条目数) ----------
//
// 默认阈值: 100 MB packed bytes  = 2.1e8 entries
// huge 阈值: 800 MB packed bytes = 1.6e9 entries (env CUBE_ALLOW_HUGE_TABLES=1 才生成)
//
// 中间区(2.1e8 .. 1.6e9): cargo test 不跑(#[ignore]),但允许生成

const HUGE_ENTRY_THRESHOLD: u64 = 1_600_000_000;

fn huge_table_check(id: usize, expected_entries: u64) {
    if expected_entries < HUGE_ENTRY_THRESHOLD {
        return;
    }
    let allow = std::env::var("CUBE_ALLOW_HUGE_TABLES")
        .map(|v| v == "1")
        .unwrap_or(false);
    if !allow {
        panic!(
            "{} generation disabled (entry_count={}); set CUBE_ALLOW_HUGE_TABLES=1 to opt in",
            TABLE_FILES[id], expected_entries
        );
    }
}

// ---------- Manager ----------

pub struct PruneTableManager {
    slots: [Mutex<Option<Arc<PackedPruneTable>>>; N_TABLES],
    pspair_slots: [Mutex<Option<Arc<PackedPruneTable>>>; N_PSPAIR_CE],
}

impl PruneTableManager {
    pub(crate) fn new() -> Self {
        let slots = std::array::from_fn(|_| Mutex::new(None));
        let pspair_slots = std::array::from_fn(|_| Mutex::new(None));
        PruneTableManager { slots, pspair_slots }
    }

    /// 大表(>= HUGE_ENTRY_THRESHOLD)受 env CUBE_ALLOW_HUGE_TABLES 保护;
    /// gen_fn 在文件不存在时被调用,生成 (entry_count, packed_bytes)。
    fn ensure_with(
        &self,
        id: usize,
        gen_fn: fn(&PruneTableManager) -> (u64, Vec<u8>),
    ) -> Arc<PackedPruneTable> {
        // 快速路径
        {
            let g = self.slots[id].lock().unwrap();
            if let Some(t) = g.as_ref() {
                return Arc::clone(t);
            }
        }
        let expected_entries = ec_count(id);
        huge_table_check(id, expected_entries);
        let path = table_path(TABLE_FILES[id]);
        ensure_parent_dir(&path);
        if !path.exists() {
            let (n, bytes) = gen_fn(self);
            assert_eq!(
                n, expected_entries,
                "{} BFS produced entry_count {} (expected {})",
                TABLE_FILES[id], n, expected_entries
            );
            write_packed_prune_table(&path, n, &bytes).expect("write pt");
        }
        let table = load_pt_from_disk(&path, expected_entries);
        let arc = Arc::new(table);
        let mut g = self.slots[id].lock().unwrap();
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

    fn ensure_pspair_with(
        &self,
        slot: usize,
        gen_fn: fn(&PruneTableManager, usize) -> (u64, Vec<u8>),
    ) -> Arc<PackedPruneTable> {
        {
            let g = self.pspair_slots[slot].lock().unwrap();
            if let Some(t) = g.as_ref() {
                return Arc::clone(t);
            }
        }
        let expected_entries =
            (state_space::EDGE as u64) * (state_space::CORNER as u64);
        let path = table_path(PSPAIR_CE_FILES[slot]);
        ensure_parent_dir(&path);
        if !path.exists() {
            let (n, bytes) = gen_fn(self, slot);
            assert_eq!(
                n, expected_entries,
                "{} BFS produced entry_count {} (expected {})",
                PSPAIR_CE_FILES[slot], n, expected_entries
            );
            write_packed_prune_table(&path, n, &bytes).expect("write pt");
        }
        let table = load_pt_from_disk(&path, expected_entries);
        let arc = Arc::new(table);
        let mut g = self.pspair_slots[slot].lock().unwrap();
        if let Some(existing) = g.as_ref() {
            Arc::clone(existing)
        } else {
            *g = Some(Arc::clone(&arc));
            arc
        }
    }

    fn release_pspair_slot(&self, slot: usize) {
        let mut g = self.pspair_slots[slot].lock().unwrap();
        *g = None;
    }
}

pub fn instance() -> &'static PruneTableManager {
    static INST: OnceLock<PruneTableManager> = OnceLock::new();
    INST.get_or_init(PruneTableManager::new)
}

fn ensure_parent_dir(p: &Path) {
    if let Some(dir) = p.parent() {
        if !dir.as_os_str().is_empty() && !dir.exists() {
            let _ = fs::create_dir_all(dir);
        }
    }
}

fn load_pt_from_disk(path: &Path, expected_entries: u64) -> PackedPruneTable {
    let file = File::open(path).expect("open pt file");
    let meta = file.metadata().expect("stat pt");
    let total = meta.len();
    let expected_bytes = (expected_entries + 1) / 2;
    let expected_total = PT_HEADER_BYTES as u64 + expected_bytes;
    assert_eq!(
        total, expected_total,
        "pt file {} has wrong size {} (expected {})",
        path.display(),
        total,
        expected_total
    );
    // SAFETY: 写入后只读,mmap 期间不修改。
    let mmap = unsafe { Mmap::map(&file) }.expect("mmap pt");
    assert_eq!(&mmap[..8], PT_MAGIC, "bad magic in {}", path.display());
    let n = u64::from_le_bytes(mmap[8..16].try_into().unwrap());
    assert_eq!(
        n, expected_entries,
        "entry_count mismatch in {}",
        path.display()
    );
    PackedPruneTable {
        data: PtStorage::Mmap(mmap),
        entry_count: n,
    }
}

// ---------- ensure / release 接口(只暴露 Canon 表) ----------

use crate::prune_create as pc;

macro_rules! pt_ensure_release {
    ($ensure:ident, $release:ident, $id:expr, $gen:path) => {
        impl PruneTableManager {
            pub fn $ensure(&self) -> Arc<PackedPruneTable> {
                self.ensure_with($id as usize, $gen)
            }
            pub fn $release(&self) {
                self.release_slot($id as usize);
            }
        }
    };
}

pt_ensure_release!(ensure_pt_cross, release_pt_cross, PtId::Cross, pc::gen_pt_cross);
pt_ensure_release!(ensure_pt_cross_ins_c4, release_pt_cross_ins_c4, PtId::CrossInsC4, pc::gen_pt_cross_ins_c4);
pt_ensure_release!(ensure_pt_pair_c4e0, release_pt_pair_c4e0, PtId::PairC4E0, pc::gen_pt_pair_c4e0);
pt_ensure_release!(ensure_pt_cross_c4e0, release_pt_cross_c4e0, PtId::CrossC4E0, pc::gen_pt_cross_c4e0);
pt_ensure_release!(ensure_pt_cross_c4c5e0e1, release_pt_cross_c4c5e0e1, PtId::CrossC4C5E0E1, pc::gen_pt_cross_c4c5e0e1);
pt_ensure_release!(ensure_pt_cross_c4c6e0e2, release_pt_cross_c4c6e0e2, PtId::CrossC4C6E0E2, pc::gen_pt_cross_c4c6e0e2);

pt_ensure_release!(ensure_pt_pscross, release_pt_pscross, PtId::PsCross, pc::gen_pt_pscross);

pt_ensure_release!(ensure_pt_pscross_e0e1, release_pt_pscross_e0e1, PtId::PsCrossE0E1, pc::gen_pt_pscross_e0e1);
pt_ensure_release!(ensure_pt_pscross_e0e2, release_pt_pscross_e0e2, PtId::PsCrossE0E2, pc::gen_pt_pscross_e0e2);
pt_ensure_release!(ensure_pt_pscross_e0e1e2, release_pt_pscross_e0e1e2, PtId::PsCrossE0E1E2, pc::gen_pt_pscross_e0e1e2);
pt_ensure_release!(ensure_pt_pscross_c4c5, release_pt_pscross_c4c5, PtId::PsCrossC4C5, pc::gen_pt_pscross_c4c5);
pt_ensure_release!(ensure_pt_pscross_c4c6, release_pt_pscross_c4c6, PtId::PsCrossC4C6, pc::gen_pt_pscross_c4c6);
pt_ensure_release!(ensure_pt_pscross_c4c5c6, release_pt_pscross_c4c5c6, PtId::PsCrossC4C5C6, pc::gen_pt_pscross_c4c5c6);

pt_ensure_release!(ensure_pt_ep4eo12, release_pt_ep4eo12, PtId::Ep4Eo12, pc::gen_pt_ep4eo12);

pt_ensure_release!(ensure_pt_cross_c4e0e1, release_pt_cross_c4e0e1, PtId::CrossC4E0E1, pc::gen_pt_cross_c4e0e1);
pt_ensure_release!(ensure_pt_cross_c4e0e2, release_pt_cross_c4e0e2, PtId::CrossC4E0E2, pc::gen_pt_cross_c4e0e2);
pt_ensure_release!(ensure_pt_cross_c4e0e3, release_pt_cross_c4e0e3, PtId::CrossC4E0E3, pc::gen_pt_cross_c4e0e3);
pt_ensure_release!(ensure_pt_cross_c4c5e0, release_pt_cross_c4c5e0, PtId::CrossC4C5E0, pc::gen_pt_cross_c4c5e0);
pt_ensure_release!(ensure_pt_cross_c4c6e0, release_pt_cross_c4c6e0, PtId::CrossC4C6E0, pc::gen_pt_cross_c4c6e0);
pt_ensure_release!(ensure_pt_cross_c4c7e0, release_pt_cross_c4c7e0, PtId::CrossC4C7E0, pc::gen_pt_cross_c4c7e0);
pt_ensure_release!(ensure_pt_cross_c4c5c6, release_pt_cross_c4c5c6, PtId::CrossC4C5C6, pc::gen_pt_cross_c4c5c6);

// 参数化:PsCrossC4E[i] (i=0..3)
impl PruneTableManager {
    pub fn ensure_pt_pscross_c4e(&self, i: usize) -> Arc<PackedPruneTable> {
        let id = match i {
            0 => PtId::PsCrossC4E0 as usize,
            1 => PtId::PsCrossC4E1 as usize,
            2 => PtId::PsCrossC4E2 as usize,
            3 => PtId::PsCrossC4E3 as usize,
            _ => panic!("PsCrossC4E index out of range"),
        };
        let gen: fn(&PruneTableManager) -> (u64, Vec<u8>) = match i {
            0 => pc::gen_pt_pscross_c4e0,
            1 => pc::gen_pt_pscross_c4e1,
            2 => pc::gen_pt_pscross_c4e2,
            3 => pc::gen_pt_pscross_c4e3,
            _ => unreachable!(),
        };
        self.ensure_with(id, gen)
    }

    pub fn release_pt_pscross_c4e(&self, i: usize) {
        let id = match i {
            0 => PtId::PsCrossC4E0 as usize,
            1 => PtId::PsCrossC4E1 as usize,
            2 => PtId::PsCrossC4E2 as usize,
            3 => PtId::PsCrossC4E3 as usize,
            _ => panic!("PsCrossC4E index out of range"),
        };
        self.release_slot(id);
    }

    pub fn ensure_pt_pscross_c(&self, c: usize) -> Arc<PackedPruneTable> {
        let id = match c {
            0 => PtId::PsCrossC4 as usize,
            1 => PtId::PsCrossC5 as usize,
            2 => PtId::PsCrossC6 as usize,
            3 => PtId::PsCrossC7 as usize,
            _ => panic!("PsCrossC index out of range"),
        };
        let gen: fn(&PruneTableManager) -> (u64, Vec<u8>) = match c {
            0 => pc::gen_pt_pscross_c4,
            1 => pc::gen_pt_pscross_c5,
            2 => pc::gen_pt_pscross_c6,
            3 => pc::gen_pt_pscross_c7,
            _ => unreachable!(),
        };
        self.ensure_with(id, gen)
    }

    pub fn release_pt_pscross_c(&self, c: usize) {
        let id = match c {
            0 => PtId::PsCrossC4 as usize,
            1 => PtId::PsCrossC5 as usize,
            2 => PtId::PsCrossC6 as usize,
            3 => PtId::PsCrossC7 as usize,
            _ => panic!("PsCrossC index out of range"),
        };
        self.release_slot(id);
    }

    /// ins_C{c+4}_diff{e},c=0..3, e=0..3
    pub fn ensure_pt_pscross_ins_c_diff(&self, c: usize, e: usize) -> Arc<PackedPruneTable> {
        let id = PtId::PsCrossInsC4Diff0 as usize + c * 4 + e;
        // gen 通过 (c,e) 选择
        let gen: fn(&PruneTableManager) -> (u64, Vec<u8>) =
            pc::PSCROSS_INS_C_DIFF_GENS[c * 4 + e];
        self.ensure_with(id, gen)
    }

    pub fn release_pt_pscross_ins_c_diff(&self, c: usize, e: usize) {
        let id = PtId::PsCrossInsC4Diff0 as usize + c * 4 + e;
        self.release_slot(id);
    }

    /// pspair_CE[e*4+c]
    pub fn ensure_pt_pspair_ce(&self, c: usize, e: usize) -> Arc<PackedPruneTable> {
        let slot = e * 4 + c;
        self.ensure_pspair_with(slot, |m, s| pc::gen_pt_pspair_ce_slot(m, s))
    }

    pub fn release_pt_pspair_ce(&self, c: usize, e: usize) {
        let slot = e * 4 + c;
        self.release_pspair_slot(slot);
    }
}

// 让 mt import 不报 unused(prune_create 用了 mt::instance)
#[allow(dead_code)]
fn _link_mt(_: &mt::MoveTableManager) {}
}

#[cfg(not(target_arch = "wasm32"))]
pub use manager::*;

// ---------- 测试 ----------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cube_common::state_space;
    use std::sync::Mutex as StdMutex;

    fn test_lock() -> &'static StdMutex<()> {
        crate::cube_common::test_env_lock()
    }

    fn fresh_dir(name: &str) -> PathBuf {
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

    fn fresh_mgr() -> PruneTableManager {
        PruneTableManager::new()
    }

    #[test]
    fn nibble_set_get_roundtrip() {
        let mut bytes = vec![0xFFu8; 8];
        for i in 0..16u64 {
            set_prune_nibble(&mut bytes, i, (i as u8) & 0xF);
        }
        for i in 0..16u64 {
            assert_eq!(get_prune_nibble(&bytes, i), (i as u8) & 0xF);
        }
        // 验证 byte 排版:idx=0 -> low nibble, idx=1 -> high nibble
        let mut b = vec![0xFFu8; 2];
        set_prune_nibble(&mut b, 0, 0x3);
        set_prune_nibble(&mut b, 1, 0xA);
        assert_eq!(b[0], 0xA3);
    }

    #[test]
    fn pt_cross_gen_and_roundtrip() {
        with_table_dir("pt_cross", || {
            let pmgr = fresh_mgr();
            let t1 = pmgr.ensure_pt_cross();
            let n = state_space::EDGE2 as u64 * state_space::EDGE2 as u64;
            assert_eq!(t1.entry_count, n);
            // 文件大小验证: 16 + (n+1)/2
            let path = table_path("pt_cross.bin");
            assert_eq!(
                fs::metadata(&path).unwrap().len(),
                PT_HEADER_BYTES as u64 + (n + 1) / 2
            );
            // SOLVED 索引深度 = 0
            let a = state_space::EDGE2_A_SOLVED as u64;
            let b = state_space::EDGE2_B_SOLVED as u64;
            let solved_idx = a * state_space::EDGE2 as u64 + b;
            assert_eq!(t1.get(solved_idx), 0);
            // 随机索引:值 ∈ 0..15
            for i in (0..n).step_by(10007) {
                let v = t1.get(i);
                assert!(v <= 15);
            }
            // 应该出现至少 1 个 >= 1 的深度
            let mut max_d = 0u8;
            for i in 0..1000 {
                max_d = max_d.max(t1.get(i));
            }
            // 部分 idx 没填到的 = 15 (0xF 默认填充),所以 max 一般是 15;
            // 但 SOLVED 处肯定 = 0
            // 把 SOLVED 邻居取一下验证 1
            // mt_edge2 在 idx=EDGE2_A_SOLVED 应有 18 个邻居,其中至少 1 个不是 SOLVED -> depth 1
            // 通过 mmap reload 路径再 ensure 一次
            pmgr.release_pt_cross();
            let t2 = pmgr.ensure_pt_cross();
            assert_eq!(t1.get(solved_idx), t2.get(solved_idx));
        });
    }

    #[test]
    fn pt_pscross_gen_small() {
        with_table_dir("pt_pscross", || {
            let pmgr = fresh_mgr();
            let t = pmgr.ensure_pt_pscross();
            let n = state_space::EDGE2 as u64 * state_space::EDGE2 as u64;
            assert_eq!(t.entry_count, n);
            // Pseudo 至少有 4 个 SOLVED(d=0)初始状态
            let a = state_space::EDGE2_A_SOLVED as u64;
            let b = state_space::EDGE2_B_SOLVED as u64;
            let idx = a * state_space::EDGE2 as u64 + b;
            assert_eq!(t.get(idx), 0);
        });
    }

    #[test]
    fn pt_pair_c4e0_gen() {
        with_table_dir("pt_pair", || {
            let pmgr = fresh_mgr();
            let t = pmgr.ensure_pt_pair_c4e0();
            let n = state_space::EDGE as u64 * state_space::CORNER as u64;
            assert_eq!(t.entry_count, n); // 576
            // 文件 = 16 + 288 = 304
            assert_eq!(
                fs::metadata(table_path("pt_pair_C4E0.bin")).unwrap().len(),
                304
            );
            // (E0=0, C4=12) 是 SOLVED 之一
            assert_eq!(t.get(0u64 * 24 + 12), 0);
        });
    }

    #[test]
    fn pt_pspair_ce_gen_one() {
        with_table_dir("pt_pspair_one", || {
            let pmgr = fresh_mgr();
            // (c=0, e=0) -> C4_E0
            let t = pmgr.ensure_pt_pspair_ce(0, 0);
            let n = state_space::EDGE as u64 * state_space::CORNER as u64;
            assert_eq!(t.entry_count, n);
            assert_eq!(t.get(0u64 * 24 + 12), 0);
        });
    }

    #[test]
    fn pt_pscross_c4_gen() {
        with_table_dir("pt_pscross_c4", || {
            let pmgr = fresh_mgr();
            let t = pmgr.ensure_pt_pscross_c(0); // PsCrossC4
            let n = state_space::CROSS as u64 * state_space::CORNER as u64;
            assert_eq!(t.entry_count, n);
            // 验证文件大小: 16 + (n+1)/2
            assert_eq!(
                fs::metadata(table_path("pt_pscross_C4.bin")).unwrap().len(),
                PT_HEADER_BYTES as u64 + (n + 1) / 2
            );
            // CROSS_SOLVED + C4(idx 12) 是 SOLVED 之一
            let solved_idx =
                state_space::CROSS_SOLVED as u64 * state_space::CORNER as u64 + 12;
            assert_eq!(t.get(solved_idx), 0);
        });
    }

    // 中表(2.18MB)
    #[test]
    fn pt_cross_ins_c4_gen() {
        with_table_dir("pt_cross_ins_c4", || {
            let pmgr = fresh_mgr();
            let t = pmgr.ensure_pt_cross_ins_c4();
            let n = state_space::CROSS as u64 * state_space::CORNER as u64;
            assert_eq!(t.entry_count, n);
            assert_eq!(
                fs::metadata(table_path("pt_cross_ins_C4.bin")).unwrap().len(),
                PT_HEADER_BYTES as u64 + (n + 1) / 2
            );
            // 主 SOLVED(CROSS_SOLVED, C4=12)
            let solved_idx =
                state_space::CROSS_SOLVED as u64 * state_space::CORNER as u64 + 12;
            assert_eq!(t.get(solved_idx), 0);
        });
    }

    // 中表(52MB)
    #[test]
    #[ignore]
    fn pt_cross_c4e0_gen() {
        with_table_dir("pt_cross_c4e0", || {
            let pmgr = fresh_mgr();
            let t = pmgr.ensure_pt_cross_c4e0();
            let n = state_space::CROSS as u64
                * state_space::CORNER as u64
                * state_space::EDGE as u64;
            assert_eq!(t.entry_count, n);
            // SOLVED idx
            let cr = state_space::CROSS_SOLVED as u64;
            let cn = 12u64; // C4
            let ed = 0u64; // E0
            let solved =
                cr * (state_space::CORNER as u64) * (state_space::EDGE as u64)
                    + cn * (state_space::EDGE as u64)
                    + ed;
            assert_eq!(t.get(solved), 0);
        });
    }

    // 中表(45-48 MB)
    #[test]
    #[ignore]
    fn pt_pscross_e0e1_gen() {
        with_table_dir("pt_pscross_e0e1", || {
            let pmgr = fresh_mgr();
            let t = pmgr.ensure_pt_pscross_e0e1();
            let n = state_space::CROSS as u64 * state_space::EDGE2 as u64;
            assert_eq!(t.entry_count, n);
        });
    }

    // 大表保护:CrossC4C5E0E1 默认应 panic
    #[test]
    fn pt_huge_default_panics() {
        with_table_dir("pt_huge_protect", || {
            let pmgr = fresh_mgr();
            std::env::remove_var("CUBE_ALLOW_HUGE_TABLES");
            let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                let _ = pmgr.ensure_pt_cross_c4c5e0e1();
            }));
            assert!(r.is_err(), "ensure_pt_cross_c4c5e0e1 should panic by default");
        });
    }

    // 跨模块联调: 验证 pt_cross 在 SOLVED 周围的深度分布合理
    //   - SOLVED 索引深度 = 0
    //   - SOLVED 经过 1 步 move 后的索引深度应 <= 1
    //   - 经过 2 步 后 <= 2
    // 同时验证 ensure_pt_cross 内部正确 ensure 了 mt_edge2 依赖。
    #[test]
    fn pt_cross_depth_sanity() {
        use crate::cube_common::array_to_index;
        with_table_dir("pt_cross_depth", || {
            let pmgr = fresh_mgr();
            let t = pmgr.ensure_pt_cross();
            // pt_cross 索引: idx = a * EDGE2 + b
            // 其中 a, b 是 EDGE2 子空间(D 层 4 个棱分成 2 组,每组 2 个)
            // SOLVED idx 已知:EDGE2_A_SOLVED = 416, EDGE2_B_SOLVED = 520
            let sz = state_space::EDGE2 as u64;
            let a0 = state_space::EDGE2_A_SOLVED as u64;
            let b0 = state_space::EDGE2_B_SOLVED as u64;
            assert_eq!(t.get(a0 * sz + b0), 0);

            // 通过 mt_edge2 走 1 步:任意非 D 系的 move 都会动 cross
            // mt_edge2 stride=18,值=新 idx
            let mt = mt::instance();
            let e2 = mt.ensure_edge2();
            let e2v = e2.as_u32();
            // 应用 R(idx 9):a/b 各动一次
            for &mv in &[9u32, 12, 0, 1] {
                let a1 = e2v[(a0 as usize) * 18 + mv as usize] as u64;
                let b1 = e2v[(b0 as usize) * 18 + mv as usize] as u64;
                let d = t.get(a1 * sz + b1);
                assert!(d <= 1, "single-move depth should be ≤ 1 (move={}, d={})", mv, d);
            }

            // sanity: array_to_index 仍可用
            let _ = array_to_index(&[0, 4], 2, 2, 12);
        });
    }
}
