//! f2b_solver: 双 1x2x3 块(左 + 右,Roux 前两块)联合最优求解器。
//!
//! 规范目标 = roux_s1 规范块(DBL+DLF / BL+FL+DL)+ 其 y2 镜位块(DRB+DFR / BR+FR+DR),
//! 即 D 层 4 角 + 6 棱(E 层 4 侧棱 + DL + DR)。全空间放不下,走 IDA*。
//!
//! 坐标:SB 用「扭曲」坐标 —— 根 = y2 帧 walk,搜索步进用 rot_map[2] 映射的 move
//! (同一物理 move 在 y2 帧的编号),与 FB 共用同一套 mt/同一张 5.3M 精确表。
//! 启发式 = 精确子目标距离表的 max(全部可采纳 ⇒ 首达即最优;h==0 ⟺ 两块皆成):
//!   - pt_s1[fb] / pt_s1[sb]:单块精确(复用 RouxS1Solver 表,零额外构建)
//!   - pt_cc[fb.c2, sb.c2]:D 层 4 角联合(504×504 扭曲积)
//!   - pt_ee[fb.e3, sb.e3](heavy):6 棱联合精确(10560² = 111.5M 扭曲积,
//!     可达 = EDGE6 全 42.6M 态)
//!   - pt9[(fb.c2,fb.e3), sb.c2] / 对称双查(heavy):{整块 + 对侧 2 角} 联合精确,
//!     5.3M×504 = 2.68G 态 nibble packed(1.34GB),首跑 BFS 落盘
//!     `pt_f2b_be3c2.bin`,后续 mmap。y² 自同构 ⇒ 同一张表服务两个方向。
//!     F2B 平均最优 ~11.5 步,轻表 h 撑不住,analyzer 必开 heavy。
//!
//! 轻版(wasm 交互单查):仅 cc,单格毫秒~十毫秒级,够用。
//!
//! 视角:yk 与 yk+2 同目标(块对不变)——每底色 2 个块对(侧轴 LR / FB),
//! 12 个 (底,侧轴) 目标每个在 24 视角中出现恰 2 次。

use std::sync::{Arc, OnceLock};

use crate::block222_solver::{face_map, ROTS6};
use crate::cube_common::{rot_map, state_space, valid_moves, Move};
use crate::prune_tables::PackedPruneTable;
use crate::roux_s1_solver::{build_pt_product, conj_buf, RouxS1Solver, S1Sol};

const FACE_D: u8 = 1;
const FACE_L: u8 = 2;
const FACE_CHARS: [char; 6] = ['U', 'D', 'L', 'R', 'F', 'B'];

/// IDA* 深度上限(F2B God's number 远低于此,保险阈)。
const MAX_DEPTH: u32 = 24;

/// (rot,yk) 求的物理块对标签 "<底>(<侧轴>)",如 "D(LR)";12 个目标各现 2 次。
pub fn f2b_label(rot_idx: usize, yk: usize) -> &'static str {
    static V: OnceLock<[[String; 4]; 6]> = OnceLock::new();
    let t = V.get_or_init(|| {
        std::array::from_fn(|ri| {
            std::array::from_fn(|k| {
                let map = face_map(ROTS6[ri], k);
                let bottom = (0..6).find(|&t| map[t] == FACE_D).unwrap();
                let side = (0..6).find(|&t| map[t] == FACE_L).unwrap();
                let pair = [side.min(side ^ 1), side.max(side ^ 1)];
                format!(
                    "{}({}{})",
                    FACE_CHARS[bottom], FACE_CHARS[pair[0]], FACE_CHARS[pair[1]]
                )
            })
        })
    });
    &t[rot_idx][yk]
}

pub struct F2BSolver {
    /// 复用其 mt_corn2/mt_edge3 与 5.3M 精确全表(FB/SB 双查)。
    s1: RouxS1Solver,
    /// D 层 4 角联合精确距离,idx = fb.c2 * CORNER2 + sb.c2(扭曲积)。
    pt_cc: Vec<u8>,
    /// 6 棱联合精确距离(heavy),idx = fb.e3 * EDGE3 + sb.e3(扭曲积);空 = 轻版。
    pt_ee: Vec<u8>,
    /// {整块 + 对侧 2 角}(heavy),idx = (c2_a*EDGE3+e3_a)*CORNER2 + c2_b,
    /// nibble packed(值 = min(d,15);0xF 兼作不可达,合法 walk 不会查到)。
    pt9: Option<Arc<PackedPruneTable>>,
}

/// y2 帧步进用的置换 move 表:mt'[i,m] = mt[i, rm2[m]]。
fn permute_y2(mt: &[u32], n: usize) -> Vec<u32> {
    let rm2 = &rot_map()[2];
    let mut t = vec![0u32; n * 18];
    for i in 0..n {
        for m in 0..18 {
            t[i * 18 + m] = mt[i * 18 + rm2[m] as usize];
        }
    }
    t
}

/// pt9 逻辑条目数(2,682,408,960)。
const PT9_ENTRIES: u64 =
    (state_space::CORNER2 * state_space::EDGE3 * state_space::CORNER2) as u64;

/// pt9 BFS(直接写 packed nibbles,峰值内存 ~1.6GB):frontier 模式起步,
/// 层宽超阈值切全表扫描模式(省 frontier 内存),层宽缩回再切回。
#[cfg(not(target_arch = "wasm32"))]
fn build_pt9_packed(s1: &RouxS1Solver) -> Vec<u8> {
    use crate::prune_tables::{get_prune_nibble, set_prune_nibble};
    const FRONTIER_CAP: usize = 60_000_000;
    let c2n = state_space::CORNER2;
    let e3n = state_space::EDGE3;
    let mt_c2 = s1.mt_corn2.as_u32();
    let mt_e3 = s1.mt_edge3.as_u32();
    let mt_c2_y2 = permute_y2(mt_c2, c2n);
    let mut bytes = vec![0xFFu8; PT9_ENTRIES.div_ceil(2) as usize];
    let start = (s1.c2_solved * e3n + s1.e3_solved) * c2n + s1.c2_solved;
    set_prune_nibble(&mut bytes, start as u64, 0);
    let mut frontier: Vec<u32> = vec![start as u32];
    let mut scan = false;
    let mut d = 0u8;
    loop {
        assert!(d + 1 < 15, "pt9 depth overflow (nibble)");
        let mut next: Vec<u32> = Vec::new();
        let mut produced = 0u64;
        let mut overflow = false;
        macro_rules! relax {
            ($idx:expr) => {{
                let idx = $idx;
                let bc2 = idx % c2n;
                let rest = idx / c2n;
                let e3 = rest % e3n;
                let ac2 = rest / e3n;
                for m in 0..18 {
                    let ni = (mt_c2[ac2 * 18 + m] as usize * e3n
                        + mt_e3[e3 * 18 + m] as usize)
                        * c2n
                        + mt_c2_y2[bc2 * 18 + m] as usize;
                    if get_prune_nibble(&bytes, ni as u64) == 0xF {
                        set_prune_nibble(&mut bytes, ni as u64, d + 1);
                        produced += 1;
                        if !overflow {
                            next.push(ni as u32);
                            if next.len() > FRONTIER_CAP {
                                overflow = true;
                                next = Vec::new();
                            }
                        }
                    }
                }
            }};
        }
        if !scan {
            let cur = std::mem::take(&mut frontier);
            for &iu in &cur {
                relax!(iu as usize);
            }
        } else {
            for idx in 0..PT9_ENTRIES as usize {
                if get_prune_nibble(&bytes, idx as u64) == d {
                    relax!(idx);
                }
            }
        }
        if produced == 0 {
            break;
        }
        scan = overflow;
        frontier = next;
        d += 1;
    }
    bytes
}

/// pt9:有盘上缓存(`pt_f2b_be3c2.bin`,1.34GB)直接 mmap,否则 BFS 构建并落盘。
#[cfg(not(target_arch = "wasm32"))]
fn ensure_pt9(s1: &RouxS1Solver) -> Arc<PackedPruneTable> {
    use crate::prune_tables::{PtStorage, PT_HEADER_BYTES, PT_MAGIC};
    let path = crate::move_tables::table_path("pt_f2b_be3c2.bin");
    if let Ok(f) = std::fs::File::open(&path) {
        if let Ok(m) = unsafe { memmap2::Mmap::map(&f) } {
            if m.len() == PT_HEADER_BYTES + PT9_ENTRIES.div_ceil(2) as usize
                && &m[..8] == PT_MAGIC
                && u64::from_le_bytes(m[8..16].try_into().unwrap()) == PT9_ENTRIES
            {
                return Arc::new(PackedPruneTable {
                    data: PtStorage::Mmap(m),
                    entry_count: PT9_ENTRIES,
                });
            }
        }
    }
    eprintln!("[INFO] building pt_f2b_be3c2 (2.68G states, one-time, minutes)...");
    let bytes = build_pt9_packed(s1);
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    if let Err(e) = crate::prune_tables::write_packed_prune_table(&path, PT9_ENTRIES, &bytes) {
        eprintln!("[WARN] pt_f2b_be3c2 cache write failed: {}", e);
    }
    Arc::new(PackedPruneTable {
        data: PtStorage::Owned(bytes),
        entry_count: PT9_ENTRIES,
    })
}

impl F2BSolver {
    /// native 轻版(测试 / 通用):走 manager 建 s1,仅 cc。
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new() -> Self {
        Self::from_s1(RouxS1Solver::new())
    }

    /// heavy 版(analyzer 用):另建 6 棱联合表 + {块+2角} 盘缓存表。
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new_heavy() -> Self {
        let s1 = RouxS1Solver::new();
        let pt9 = ensure_pt9(&s1);
        let mut s = Self::from_s1(s1);
        let mt_e3 = s.s1.mt_edge3.as_u32();
        let mt_e3_y2 = permute_y2(mt_e3, state_space::EDGE3);
        s.pt_ee = build_pt_product(
            mt_e3,
            &mt_e3_y2,
            state_space::EDGE3,
            state_space::EDGE3 * state_space::EDGE3,
            s.s1.e3_solved * state_space::EDGE3 + s.s1.e3_solved,
        );
        s.pt9 = Some(pt9);
        s
    }

    /// 轻版(wasm 交互单查):仅 pt_cc(254K),h 较弱但单格查询毫秒级。
    pub fn from_s1(s1: RouxS1Solver) -> Self {
        let mt_c2 = s1.mt_corn2.as_u32();
        let mt_c2_y2 = permute_y2(mt_c2, state_space::CORNER2);
        let pt_cc = build_pt_product(
            mt_c2,
            &mt_c2_y2,
            state_space::CORNER2,
            state_space::CORNER2 * state_space::CORNER2,
            s1.c2_solved * state_space::CORNER2 + s1.c2_solved,
        );
        F2BSolver { s1, pt_cc, pt_ee: Vec::new(), pt9: None }
    }

    /// s1 表最大深度(信息用)。
    pub fn max_depth_s1(&self) -> u8 {
        self.s1.max_depth()
    }

    #[inline]
    fn d(&self, c: usize, e: usize) -> u32 {
        self.s1.pt[c * state_space::EDGE3 + e] as u32
    }

    /// 根坐标:fb = yk 帧,sb = yk+2 帧(同一张表的两次 walk)。
    fn roots(&self, alg: &[Move], rot: &str, yk: usize) -> ((usize, usize), (usize, usize)) {
        let fb = self.s1.walk(&conj_buf(alg, rot, yk));
        let sb = self.s1.walk(&conj_buf(alg, rot, (yk + 2) % 4));
        (fb, sb)
    }

    /// 可采纳下界(精确子目标表 max);== 0 ⟺ 双块皆成。
    /// (pt9 存 min(d,15) 仍可采纳;h==0 ⟺ d==0 性质保留。)
    #[inline]
    fn h(&self, fb: (usize, usize), sb: (usize, usize)) -> u32 {
        let mut v = self.d(fb.0, fb.1).max(self.d(sb.0, sb.1));
        v = v.max(self.pt_cc[fb.0 * state_space::CORNER2 + sb.0] as u32);
        if !self.pt_ee.is_empty() {
            v = v.max(self.pt_ee[fb.1 * state_space::EDGE3 + sb.1] as u32);
        }
        if let Some(p9) = &self.pt9 {
            let c2n = state_space::CORNER2 as u64;
            let e3n = state_space::EDGE3 as u64;
            let ia = (fb.0 as u64 * e3n + fb.1 as u64) * c2n + sb.0 as u64;
            let ib = (sb.0 as u64 * e3n + sb.1 as u64) * c2n + fb.0 as u64;
            v = v.max(p9.get(ia) as u32).max(p9.get(ib) as u32);
        }
        v
    }

    /// IDA* 一层:fb 按 m 步进,sb 按 rot_map[2][m] 步进(y2 帧的同一物理 move)。
    /// HEAVY = 启用 ee + pt9(编译期特化,免热路径分支)。
    fn search<const HEAVY: bool>(
        &self,
        fb: (usize, usize),
        sb: (usize, usize),
        depth: u32,
        prev: u8,
    ) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_c2 = self.s1.mt_corn2.as_u32();
        let mt_e3 = self.s1.mt_edge3.as_u32();
        let rm2 = &rot_map()[2];
        for k in 0..count {
            let m = row[k] as usize;
            let nfb = (
                mt_c2[fb.0 * 18 + m] as usize,
                mt_e3[fb.1 * 18 + m] as usize,
            );
            if self.d(nfb.0, nfb.1) >= depth {
                continue;
            }
            let m2 = rm2[m] as usize;
            let nsb = (
                mt_c2[sb.0 * 18 + m2] as usize,
                mt_e3[sb.1 * 18 + m2] as usize,
            );
            if self.d(nsb.0, nsb.1) >= depth
                || self.pt_cc[nfb.0 * state_space::CORNER2 + nsb.0] as u32 >= depth
            {
                continue;
            }
            if HEAVY {
                let p9 = self.pt9.as_ref().unwrap();
                let c2n = state_space::CORNER2 as u64;
                let e3n = state_space::EDGE3 as u64;
                if self.pt_ee[nfb.1 * state_space::EDGE3 + nsb.1] as u32 >= depth
                    || p9.get((nfb.0 as u64 * e3n + nfb.1 as u64) * c2n + nsb.0 as u64) as u32
                        >= depth
                    || p9.get((nsb.0 as u64 * e3n + nsb.1 as u64) * c2n + nfb.0 as u64) as u32
                        >= depth
                {
                    continue;
                }
            }
            if depth == 1 || self.search::<HEAVY>(nfb, nsb, depth - 1, m as u8) {
                return true;
            }
        }
        false
    }

    /// IDA* 入口分派(轻 / heavy 特化)。
    #[inline]
    fn search_root(&self, fb: (usize, usize), sb: (usize, usize), depth: u32) -> bool {
        if self.pt9.is_some() {
            self.search::<true>(fb, sb, depth, 18)
        } else {
            self.search::<false>(fb, sb, depth, 18)
        }
    }

    /// 单 (视角, yk) 最优步数(IDA*,首达即最优)。
    pub fn solve_one(&self, alg: &[Move], rot: &str, yk: usize) -> u32 {
        let (fb, sb) = self.roots(alg, rot, yk);
        let h = self.h(fb, sb);
        if h == 0 {
            return 0;
        }
        for d in h..=MAX_DEPTH {
            if self.search_root(fb, sb, d) {
                return d;
            }
        }
        99
    }

    /// 单视角(2 个块对最小;yk 2/3 为重复目标):按根下界排序 + bound 传递。
    pub fn solve_face(&self, alg: &[Move], rot: &str) -> u32 {
        let mut tasks: Vec<((usize, usize), (usize, usize), u32)> = (0..2)
            .map(|k| {
                let (fb, sb) = self.roots(alg, rot, k);
                (fb, sb, self.h(fb, sb))
            })
            .collect();
        tasks.sort_by_key(|t| t.2);
        if tasks[0].2 == 0 {
            return 0;
        }
        let mut min_v = MAX_DEPTH + 1;
        for &(fb, sb, h) in &tasks {
            if h >= min_v {
                continue;
            }
            for d in h..min_v {
                if self.search_root(fb, sb, d) {
                    min_v = d;
                    break;
                }
            }
        }
        min_v
    }

    /// 多视角批量统计,顺序与 `rots` 一致。
    pub fn get_stats(&self, alg: &[Move], rots: &[&str]) -> Vec<u32> {
        rots.iter().map(|r| self.solve_face(alg, r)).collect()
    }

    /// 枚举恰好 depth 步的解(可采纳剪枝;叶 = 双块全 0)。
    #[allow(clippy::too_many_arguments)]
    fn enum_paths(
        &self,
        fb: (usize, usize),
        sb: (usize, usize),
        depth: u32,
        prev: u8,
        path: &mut Vec<u8>,
        out: &mut Vec<Vec<u8>>,
        cap: usize,
    ) {
        if out.len() >= cap {
            return;
        }
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_c2 = self.s1.mt_corn2.as_u32();
        let mt_e3 = self.s1.mt_edge3.as_u32();
        let rm2 = &rot_map()[2];
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let nfb = (
                mt_c2[fb.0 * 18 + m] as usize,
                mt_e3[fb.1 * 18 + m] as usize,
            );
            let h_fb = self.d(nfb.0, nfb.1);
            if h_fb >= depth {
                continue;
            }
            let m2 = rm2[m] as usize;
            let nsb = (
                mt_c2[sb.0 * 18 + m2] as usize,
                mt_e3[sb.1 * 18 + m2] as usize,
            );
            let h_sb = self.d(nsb.0, nsb.1);
            if h_sb >= depth
                || self.pt_cc[nfb.0 * state_space::CORNER2 + nsb.0] as u32 >= depth
                || (!self.pt_ee.is_empty()
                    && self.pt_ee[nfb.1 * state_space::EDGE3 + nsb.1] as u32 >= depth)
            {
                continue;
            }
            if let Some(p9) = &self.pt9 {
                let c2n = state_space::CORNER2 as u64;
                let e3n = state_space::EDGE3 as u64;
                if p9.get((nfb.0 as u64 * e3n + nfb.1 as u64) * c2n + nsb.0 as u64) as u32 >= depth
                    || p9.get((nsb.0 as u64 * e3n + nsb.1 as u64) * c2n + nfb.0 as u64) as u32
                        >= depth
                {
                    continue;
                }
            }
            path.push(m as u8);
            if depth == 1 {
                out.push(path.clone());
            } else if h_fb > 0 || h_sb > 0 {
                // 两块皆解(h_fb==0 && h_sb==0)却仍要走步 = 更短解 + 无效尾动,跳过。
                self.enum_paths(nfb, nsb, depth - 1, m as u8, path, out, cap);
            }
            path.pop();
        }
    }

    /// 单视角多解:yk 0/1 各枚举(预算 = 全局最优 + extra),合并按 (len, yk) 排序,
    /// cap 截断。复用 S1Sol 形状。
    pub fn enumerate_face(
        &self,
        alg: &[Move],
        rot: &str,
        extra: u32,
        cap: usize,
    ) -> (u32, Vec<S1Sol>) {
        let mut ends = [((0usize, 0usize), (0usize, 0usize)); 2];
        let mut dists = [0u32; 2];
        for k in 0..2 {
            let (fb, sb) = self.roots(alg, rot, k);
            ends[k] = (fb, sb);
            dists[k] = {
                let h = self.h(fb, sb);
                if h == 0 {
                    0
                } else {
                    let mut v = 99;
                    for d in h..=MAX_DEPTH {
                        if self.search_root(fb, sb, d) {
                            v = d;
                            break;
                        }
                    }
                    v
                }
            };
        }
        let best = dists.iter().copied().min().unwrap();
        let mut sols: Vec<S1Sol> = Vec::new();
        if best == 0 {
            return (0, sols);
        }
        let budget = best + extra;
        for k in 0..2 {
            if dists[k] > budget {
                continue;
            }
            let (fb, sb) = ends[k];
            let mut out = Vec::new();
            let mut path = Vec::new();
            for d in dists[k]..=budget {
                self.enum_paths(fb, sb, d, 18, &mut path, &mut out, cap);
                if out.len() >= cap {
                    break;
                }
            }
            sols.extend(out.into_iter().map(|moves| S1Sol {
                yk: k,
                len: moves.len() as u32,
                moves,
            }));
        }
        sols.sort_by_key(|s| (s.len, s.yk));
        sols.truncate(cap);
        (best, sols)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cube_common::{string_to_alg, test_env_lock, State};
    use crate::roux_s1_solver::tests::{pseudo_scramble, s1_block_pieces};
    use crate::roux_s1_solver::s1_block_label;
    use std::path::PathBuf;

    fn setup_dir(name: &str) -> PathBuf {
        let dir = PathBuf::from("target").join("test-tables").join(name);
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::env::set_var("CUBE_TABLE_DIR", &dir);
        dir
    }

    /// (rot_idx,yk) 的 F2B 件集合 = s1 块(yk)∪ s1 块(yk+2)。
    fn f2b_pieces(rot_idx: usize, yk: usize) -> (Vec<usize>, Vec<usize>) {
        let (c1, e1) = s1_block_pieces(s1_block_label(rot_idx, yk));
        let (c2, e2) = s1_block_pieces(s1_block_label(rot_idx, (yk + 2) % 4));
        let mut corners: Vec<usize> = c1.iter().chain(c2.iter()).copied().collect();
        let mut edges: Vec<usize> = e1.iter().chain(e2.iter()).copied().collect();
        corners.sort_unstable();
        corners.dedup();
        edges.sort_unstable();
        edges.dedup();
        assert_eq!(corners.len(), 4);
        assert_eq!(edges.len(), 6);
        (corners, edges)
    }

    fn state_f2b_done(st: &State, corners: &[usize], edges: &[usize]) -> bool {
        let (cp, co) = st.cp_co();
        let (ep, eo) = st.ep_eo();
        corners.iter().all(|&c| cp[c] == c as u8 && co[c] == 0)
            && edges.iter().all(|&e| ep[e] == e as u8 && eo[e] == 0)
    }

    #[test]
    fn basics_consistency_and_labels() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = setup_dir("f2b_basics");
        let s = F2BSolver::new();

        // 标签:12 个块对,每个出现恰 2 次;规范 (0,0) = D(LR)
        let mut count = std::collections::HashMap::new();
        for ri in 0..6 {
            for k in 0..4 {
                *count.entry(f2b_label(ri, k)).or_insert(0) += 1;
            }
        }
        assert_eq!(count.len(), 12);
        assert!(count.values().all(|&c: &i32| c == 2));
        assert_eq!(f2b_label(0, 0), "D(LR)");
        assert_eq!(f2b_label(0, 1), "D(FB)");

        // 单 move:U 不碰双块 → 0;D/L/R/F/B 各破至少一块 → 1
        let one = |scr: &str| s.solve_one(&string_to_alg(scr), "", 0);
        assert_eq!(one(""), 0);
        assert_eq!(one("U"), 0);
        assert_eq!(one("D"), 1);
        assert_eq!(one("L"), 1);
        assert_eq!(one("R"), 1);
        assert_eq!(one("F"), 1);
        assert_eq!(one("B"), 1);

        // yk 与 yk+2 同目标
        for seed in 0..10u64 {
            let alg = pseudo_scramble(seed, 18);
            for rot in ROTS6 {
                for k in 0..2 {
                    assert_eq!(
                        s.solve_one(&alg, rot, k),
                        s.solve_one(&alg, rot, k + 2),
                        "f2b yk dup mismatch seed={}",
                        seed
                    );
                }
            }
        }

        // 一致性:f2b ≥ max(s1(yk), s1(yk+2)) 且 solve_face = min(yk0, yk1)
        for seed in 20..32u64 {
            let alg = pseudo_scramble(seed, 20);
            for rot in ROTS6 {
                let d0 = s.solve_one(&alg, rot, 0);
                let d1 = s.solve_one(&alg, rot, 1);
                assert_eq!(s.solve_face(&alg, rot), d0.min(d1));
                for k in 0..2 {
                    let dk = if k == 0 { d0 } else { d1 };
                    let s1a = s.s1.solve_one(&alg, rot, k);
                    let s1b = s.s1.solve_one(&alg, rot, k + 2);
                    assert!(dk >= s1a.max(s1b), "f2b < s1 subgoal seed={}", seed);
                }
            }
        }

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// 纯 State 级 IDDFS(独立于 mt/pt):短打乱最优性。
    #[test]
    fn optimality_spot_check_iddfs() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = setup_dir("f2b_iddfs");
        let s = F2BSolver::new();

        fn dfs(st: &State, depth: u32, prev: usize, corners: &[usize], edges: &[usize]) -> bool {
            if depth == 0 {
                return state_f2b_done(st, corners, edges);
            }
            let (vmoves, vcnt) = valid_moves();
            let row = &vmoves[prev];
            for k in 0..vcnt[prev] as usize {
                let m = row[k] as usize;
                let ns = st.applied(Move::from_index(m));
                if dfs(&ns, depth - 1, m, corners, edges) {
                    return true;
                }
            }
            false
        }

        let (corners, edges) = f2b_pieces(0, 0);
        for seed in 700..708u64 {
            let alg = pseudo_scramble(seed, 5);
            let got = s.solve_one(&alg, "", 0);
            assert!(got <= 5, "5-move scramble dist > 5");
            let mut st = State::SOLVED;
            for &m in &alg {
                st.apply(m);
            }
            let mut want = 99;
            for d in 0..=5u32 {
                if dfs(&st, d, 18, &corners, &edges) {
                    want = d;
                    break;
                }
            }
            assert_eq!(got, want, "seed={}", seed);
        }

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn enumerate_face_solutions_are_valid() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = setup_dir("f2b_enum");
        let s = F2BSolver::new();
        let rm = crate::cube_common::rot_map();

        for seed in 800..804u64 {
            let alg = pseudo_scramble(seed, 14);
            for (ri, rot) in ROTS6.iter().enumerate() {
                let stats_min = s.solve_face(&alg, rot);
                let (best, sols) = s.enumerate_face(&alg, rot, 0, 6);
                assert_eq!(best, stats_min, "best mismatch seed={} rot={}", seed, ri);
                if best == 0 {
                    assert!(sols.is_empty());
                    continue;
                }
                assert!(!sols.is_empty());
                assert!(sols.iter().all(|x| x.len == best));
                for sol in &sols {
                    // 坐标级:双块全 0
                    let (fb, sb) = s.roots(&alg, rot, sol.yk);
                    let mut cfb = fb;
                    let mut csb = sb;
                    let mt_c2 = s.s1.mt_corn2.as_u32();
                    let mt_e3 = s.s1.mt_edge3.as_u32();
                    let rm2 = &rm[2];
                    for &m in &sol.moves {
                        cfb = (
                            mt_c2[cfb.0 * 18 + m as usize] as usize,
                            mt_e3[cfb.1 * 18 + m as usize] as usize,
                        );
                        let m2 = rm2[m as usize] as usize;
                        csb = (
                            mt_c2[csb.0 * 18 + m2] as usize,
                            mt_e3[csb.1 * 18 + m2] as usize,
                        );
                    }
                    assert_eq!(s.h(cfb, csb), 0, "sol doesn't finish F2B");
                }
            }
        }

        // State 级二次验证:rot="" 把解经 y^k 逆映射回原帧,验证 10 件物理归位
        let alg = string_to_alg("D B U B2 R2 U' L2 D2 R2 D' L D2 B D' L2 F' D L' D'");
        let (_best, sols) = s.enumerate_face(&alg, "", 0, 3);
        for sol in &sols {
            let mut st = State::SOLVED;
            let inv_k = (4 - sol.yk) % 4;
            for &m in &alg {
                st.apply(m);
            }
            for &m in &sol.moves {
                st.apply(Move::from_index(rm[inv_k][m as usize] as usize));
            }
            let (corners, edges) = f2b_pieces(0, sol.yk);
            assert!(state_f2b_done(&st, &corners, &edges), "F2B not physically done");
        }

        let _ = std::fs::remove_dir_all(&dir);
    }
}
