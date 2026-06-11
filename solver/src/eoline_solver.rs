//! eoline_solver: ZZ EOLine 求解器(EO + DB/DF 线棱)。
//!
//! 全自包含:从 MOVE_STATES 现场建微 move 表(eo12 2048×18 + line 144×18)与
//! 全空间精确距离表(EO 2048 / EOLine 2048×144 BFS),零 mmap 依赖,wasm 可直接 new()。
//!
//! 阶段:eo = 全 12 棱定向(轴 = 视角 F/B 轴原像);eoline = eo + DB,DF 归位。
//! 视角:yk 与 yk+2 同目标(y2 保 FB 轴、线棱对调)——每底色 2 条线取向,
//! 12 个 (底,轴) 目标每个在 24 视角中出现恰 2 次;EO 仅依赖轴,全局 3 轴。

use std::sync::OnceLock;

use crate::block222_solver::{face_map, ROTS6};
use crate::cube_common::{move_state, state_space, valid_moves, Move};
use crate::roux_s1_solver::{build_pt_product, conj_buf, S1Sol};

/// 规范线棱:DB(8), DF(10)。
pub const CANON_LINE_EDGES: [usize; 2] = [8, 10];
/// line 坐标空间:pos(DB)*12 + pos(DF),稀疏 144(对角线不可达)。
pub const LINE: usize = 144;
pub const LINE_SOLVED: usize = 8 * 12 + 10;

const FACE_D: u8 = 1;
const FACE_F: u8 = 4;
const FACE_CHARS: [char; 6] = ['U', 'D', 'L', 'R', 'F', 'B'];

/// 每 move 的棱位置置换:位置 p 的件 → dst[m][p](由 MOVE_STATES ep 反查)。
pub(crate) fn edge_pos_dst() -> [[u8; 12]; 18] {
    let mut t = [[0u8; 12]; 18];
    for m in Move::ALL {
        let (mep, _) = move_state(m).ep_eo();
        for (i, &src) in mep.iter().enumerate() {
            t[m.index()][src as usize] = i as u8;
        }
    }
    t
}

/// EO12 move 表(2048×18):index = eo[0..10] 位图(按位置),eo[11] = 偶宇称补位。
pub(crate) fn build_mt_eo12() -> Vec<u32> {
    let mut peo: [([u8; 12], [u8; 12]); 18] = [([0; 12], [0; 12]); 18];
    for m in Move::ALL {
        peo[m.index()] = move_state(m).ep_eo();
    }
    let mut t = vec![0u32; state_space::EO12 * 18];
    for idx in 0..state_space::EO12 {
        let mut eo = [0u8; 12];
        let mut par = 0u8;
        for (p, v) in eo.iter_mut().enumerate().take(11) {
            *v = ((idx >> p) & 1) as u8;
            par ^= *v;
        }
        eo[11] = par;
        for m in 0..18 {
            let (mep, meo) = peo[m];
            let mut nidx = 0usize;
            for p in 0..11 {
                nidx |= ((eo[mep[p] as usize] ^ meo[p]) as usize) << p;
            }
            t[idx * 18 + m] = nidx as u32;
        }
    }
    t
}

/// line move 表(144×18):双棱位置联动。
fn build_mt_line() -> Vec<u32> {
    let dst = edge_pos_dst();
    let mut t = vec![0u32; LINE * 18];
    for a in 0..12 {
        for b in 0..12 {
            if a == b {
                continue;
            }
            for (m, dm) in dst.iter().enumerate() {
                t[(a * 12 + b) * 18 + m] = (dm[a] as usize * 12 + dm[b] as usize) as u32;
            }
        }
    }
    t
}

/// 单坐标全空间 BFS 距离表。
fn bfs_single(mt: &[u32], n: usize, start: usize) -> Vec<u8> {
    let mut pt = vec![255u8; n];
    pt[start] = 0;
    let mut frontier = vec![start as u32];
    let mut d = 0u8;
    while !frontier.is_empty() {
        let mut next = Vec::new();
        for &i in &frontier {
            let base = i as usize * 18;
            for m in 0..18 {
                let ni = mt[base + m] as usize;
                if pt[ni] == 255 {
                    pt[ni] = d + 1;
                    next.push(ni as u32);
                }
            }
        }
        d += 1;
        frontier = next;
    }
    pt
}

/// (rot,yk) 的 EO 轴标签(F/B 面原像对,如 "FB"/"LR"/"UD",低位面在前)。
pub fn eo_axis_label(rot_idx: usize, yk: usize) -> &'static str {
    static V: OnceLock<[[String; 4]; 6]> = OnceLock::new();
    let t = V.get_or_init(|| {
        std::array::from_fn(|ri| {
            std::array::from_fn(|k| {
                let map = face_map(ROTS6[ri], k);
                let f = (0..6).find(|&t| map[t] == FACE_F).unwrap();
                let pair = [f.min(f ^ 1), f.max(f ^ 1)];
                format!("{}{}", FACE_CHARS[pair[0]], FACE_CHARS[pair[1]])
            })
        })
    });
    &t[rot_idx][yk]
}

/// (rot,yk) 的 EOLine 标签 "<底>(<轴>)",如 "D(FB)";12 个目标各现 2 次。
pub fn eoline_label(rot_idx: usize, yk: usize) -> &'static str {
    static V: OnceLock<[[String; 4]; 6]> = OnceLock::new();
    let t = V.get_or_init(|| {
        std::array::from_fn(|ri| {
            std::array::from_fn(|k| {
                let map = face_map(ROTS6[ri], k);
                let bottom = (0..6).find(|&t| map[t] == FACE_D).unwrap();
                format!("{}({})", FACE_CHARS[bottom], eo_axis_label(ri, k))
            })
        })
    });
    &t[rot_idx][yk]
}

pub struct EOLineSolver {
    mt_eo: Vec<u32>,
    mt_line: Vec<u32>,
    /// EO 全空间精确距离(2048)。
    pt_eo: Vec<u8>,
    /// EOLine 全空间精确距离,idx = eo*144 + line(不可达组合 = 255,合法 walk 不会落上)。
    pt: Vec<u8>,
}

impl Default for EOLineSolver {
    fn default() -> Self {
        Self::new()
    }
}

impl EOLineSolver {
    /// 全自包含构造(native/wasm 同路径,毫秒级)。
    pub fn new() -> Self {
        let mt_eo = build_mt_eo12();
        let mt_line = build_mt_line();
        let pt_eo = bfs_single(&mt_eo, state_space::EO12, 0);
        let pt = build_pt_product(
            &mt_eo,
            &mt_line,
            LINE,
            state_space::EO12 * LINE,
            LINE_SOLVED,
        );
        EOLineSolver { mt_eo, mt_line, pt_eo, pt }
    }

    /// 两阶段最大深度 (EO God, EOLine God)(信息用)。
    pub fn max_depths(&self) -> (u8, u8) {
        let eo = self.pt_eo.iter().copied().filter(|&v| v != 255).max().unwrap_or(0);
        let line = self.pt.iter().copied().filter(|&v| v != 255).max().unwrap_or(0);
        (eo, line)
    }

    /// 从 SOLVED 走 buf,返回 (eo, line)。
    fn walk(&self, buf: &[u8]) -> (usize, usize) {
        let mut eo = 0usize;
        let mut line = LINE_SOLVED;
        for &m in buf {
            eo = self.mt_eo[eo * 18 + m as usize] as usize;
            line = self.mt_line[line * 18 + m as usize] as usize;
        }
        (eo, line)
    }

    /// 单 (视角, yk) EO 最优步数(精确表直查)。
    pub fn solve_one_eo(&self, alg: &[Move], rot: &str, yk: usize) -> u32 {
        let (eo, _) = self.walk(&conj_buf(alg, rot, yk));
        self.pt_eo[eo] as u32
    }

    /// 单 (视角, yk) EOLine 最优步数(精确表直查)。
    pub fn solve_one(&self, alg: &[Move], rot: &str, yk: usize) -> u32 {
        let (eo, line) = self.walk(&conj_buf(alg, rot, yk));
        self.pt[eo * LINE + line] as u32
    }

    /// EO 多视角批量统计:每视角 = 2 条水平轴最小(yk 0/1;2/3 为重复目标)。
    pub fn get_stats_eo(&self, alg: &[Move], rots: &[&str]) -> Vec<u32> {
        rots.iter()
            .map(|r| (0..2).map(|k| self.solve_one_eo(alg, r, k)).min().unwrap())
            .collect()
    }

    /// EOLine 多视角批量统计:每视角 = 2 条线取向最小(yk 0/1)。
    pub fn get_stats(&self, alg: &[Move], rots: &[&str]) -> Vec<u32> {
        rots.iter()
            .map(|r| (0..2).map(|k| self.solve_one(alg, r, k)).min().unwrap())
            .collect()
    }

    /// 单坐标精确表上的解枚举(恰好 depth 步)。
    #[allow(clippy::too_many_arguments)]
    fn enumerate_single(
        mt: &[u32],
        pt: &[u8],
        idx: usize,
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
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let ni = mt[idx * 18 + m] as usize;
            if pt[ni] as u32 >= depth {
                continue;
            }
            path.push(m as u8);
            if depth == 1 {
                out.push(path.clone());
            } else {
                Self::enumerate_single(mt, pt, ni, depth - 1, m as u8, path, out, cap);
            }
            path.pop();
        }
    }

    /// 单视角多解(stage: 0=eo 1=eoline):yk 0/1 各枚举(预算 = 最优 + extra),
    /// 合并按 (len, yk) 排序,cap 截断。复用 S1Sol 形状。
    pub fn enumerate_face(
        &self,
        alg: &[Move],
        rot: &str,
        stage: usize,
        extra: u32,
        cap: usize,
    ) -> (u32, Vec<S1Sol>) {
        let mut ends = [(0usize, 0usize); 2];
        let mut dists = [0u32; 2];
        for k in 0..2 {
            let (eo, line) = self.walk(&conj_buf(alg, rot, k));
            ends[k] = (eo, line);
            dists[k] = if stage == 0 {
                self.pt_eo[eo] as u32
            } else {
                self.pt[eo * LINE + line] as u32
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
            let (eo, line) = ends[k];
            let mut out = Vec::new();
            let mut path = Vec::new();
            for d in dists[k]..=budget {
                if stage == 0 {
                    Self::enumerate_single(
                        &self.mt_eo, &self.pt_eo, eo, d, 18, &mut path, &mut out, cap,
                    );
                } else {
                    crate::roux_s1_solver::enumerate_product(
                        &self.mt_eo, &self.mt_line, LINE, &self.pt, eo, line, d, 18,
                        &mut path, &mut out, cap,
                    );
                }
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

    /// 单 (视角, yk) 多解(stage: 0=eo 1=eoline):预算 = 该 yk 最优 + extra。
    /// enumerate_face 的加法薄包装(不取双 yk 最小):链编排器在兄弟 yk 已完成
    /// (rot 级 best==0 → 合并枚举返回空)时用它保住本轴解集。
    pub fn enumerate_face_yk(
        &self,
        alg: &[Move],
        rot: &str,
        yk: usize,
        stage: usize,
        extra: u32,
        cap: usize,
    ) -> (u32, Vec<S1Sol>) {
        let (eo, line) = self.walk(&conj_buf(alg, rot, yk));
        let best = if stage == 0 {
            self.pt_eo[eo] as u32
        } else {
            self.pt[eo * LINE + line] as u32
        };
        let mut sols: Vec<S1Sol> = Vec::new();
        if best == 0 {
            return (0, sols);
        }
        let budget = best + extra;
        let mut out = Vec::new();
        let mut path = Vec::new();
        for d in best..=budget {
            if stage == 0 {
                Self::enumerate_single(&self.mt_eo, &self.pt_eo, eo, d, 18, &mut path, &mut out, cap);
            } else {
                crate::roux_s1_solver::enumerate_product(
                    &self.mt_eo, &self.mt_line, LINE, &self.pt, eo, line, d, 18, &mut path,
                    &mut out, cap,
                );
            }
            if out.len() >= cap {
                break;
            }
        }
        sols.extend(out.into_iter().map(|moves| S1Sol {
            yk,
            len: moves.len() as u32,
            moves,
        }));
        sols.sort_by_key(|s| s.len);
        sols.truncate(cap);
        (best, sols)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cube_common::{rot_map, string_to_alg, State};
    use crate::roux_s1_solver::tests::pseudo_scramble;

    /// State 级目标判定(独立于坐标编码):全棱定向 + DB/DF 归位。
    fn state_eo_done(st: &State) -> bool {
        let (_, eo) = st.ep_eo();
        eo.iter().all(|&v| v == 0)
    }

    fn state_eoline_done(st: &State) -> bool {
        let (ep, eo) = st.ep_eo();
        state_eo_done(st) && ep[8] == 8 && ep[10] == 10 && eo[8] == 0 && eo[10] == 0
    }

    #[test]
    fn basics_and_labels() {
        let s = EOLineSolver::new();

        // 可达性:EO 全 2048;EOLine 恰 2048×132 = 270,336(144 含 12 个不可达对角)
        assert!(s.pt_eo.iter().all(|&v| v != 255));
        assert_eq!(
            s.pt.iter().filter(|&&v| v != 255).count(),
            state_space::EO12 * 132
        );
        let (eo_god, line_god) = s.max_depths();
        assert!((6..=8).contains(&eo_god), "suspicious EO God {}", eo_god);
        assert!((7..=10).contains(&line_god), "suspicious EOLine God {}", line_god);

        // 单 move:U/D 不翻棱不动线 → 0/0;F 翻 4 棱 → eo 1;L 动 DL 不动线棱 → line 0
        let one_eo = |scr: &str| s.solve_one_eo(&string_to_alg(scr), "", 0);
        let one = |scr: &str| s.solve_one(&string_to_alg(scr), "", 0);
        assert_eq!(one_eo(""), 0);
        assert_eq!(one(""), 0);
        assert_eq!(one_eo("U"), 0);
        assert_eq!(one("U"), 0);
        assert_eq!(one_eo("F"), 1);
        assert_eq!(one("F"), 1);
        assert_eq!(one_eo("L"), 0);
        assert_eq!(one("L"), 0);
        assert_eq!(one_eo("D"), 0);
        assert_eq!(one("D"), 1); // D 移走 DB/DF

        // yk 与 yk+2 同目标(轴/线不变)
        for seed in 0..20u64 {
            let alg = pseudo_scramble(seed, 18);
            for rot in ROTS6 {
                for k in 0..2 {
                    assert_eq!(
                        s.solve_one_eo(&alg, rot, k),
                        s.solve_one_eo(&alg, rot, k + 2),
                        "eo yk dup mismatch"
                    );
                    assert_eq!(
                        s.solve_one(&alg, rot, k),
                        s.solve_one(&alg, rot, k + 2),
                        "eoline yk dup mismatch"
                    );
                }
            }
        }

        // 标签:EOLine 12 个目标各现 2 次;EO 轴 3 种各 8 次;规范 (0,0) = D(FB)
        let mut count = std::collections::HashMap::new();
        let mut axes = std::collections::HashMap::new();
        for ri in 0..6 {
            for k in 0..4 {
                *count.entry(eoline_label(ri, k)).or_insert(0) += 1;
                *axes.entry(eo_axis_label(ri, k)).or_insert(0) += 1;
            }
        }
        assert_eq!(count.len(), 12);
        assert!(count.values().all(|&c: &i32| c == 2));
        assert_eq!(axes.len(), 3);
        assert!(axes.values().all(|&c: &i32| c == 8));
        assert_eq!(eoline_label(0, 0), "D(FB)");
        assert_eq!(eo_axis_label(0, 0), "FB");

        // 一致性:eoline ≥ eo(同视角同 yk)
        for seed in 30..50u64 {
            let alg = pseudo_scramble(seed, 18);
            for rot in ROTS6 {
                for k in 0..2 {
                    assert!(s.solve_one(&alg, rot, k) >= s.solve_one_eo(&alg, rot, k));
                }
            }
        }
    }

    /// 纯 State 级 IDDFS(独立于 mt/pt):短打乱最优性。
    #[test]
    fn optimality_spot_check_iddfs() {
        let s = EOLineSolver::new();

        fn dfs(st: &State, depth: u32, prev: usize, done: &dyn Fn(&State) -> bool) -> bool {
            if depth == 0 {
                return done(st);
            }
            let (vmoves, vcnt) = valid_moves();
            let row = &vmoves[prev];
            for k in 0..vcnt[prev] as usize {
                let m = row[k] as usize;
                let ns = st.applied(Move::from_index(m));
                if dfs(&ns, depth - 1, m, done) {
                    return true;
                }
            }
            false
        }

        for seed in 500..512u64 {
            let alg = pseudo_scramble(seed, 5);
            let mut st = State::SOLVED;
            for &m in &alg {
                st.apply(m);
            }
            for (goal, got) in [
                (&state_eo_done as &dyn Fn(&State) -> bool, s.solve_one_eo(&alg, "", 0)),
                (&state_eoline_done as &dyn Fn(&State) -> bool, s.solve_one(&alg, "", 0)),
            ] {
                assert!(got <= 5 + 2, "5-move scramble dist way off");
                let mut want = 99;
                for d in 0..=got {
                    if dfs(&st, d, 18, goal) {
                        want = d;
                        break;
                    }
                }
                assert_eq!(got, want, "seed={}", seed);
            }
        }
    }

    #[test]
    fn enumerate_face_solutions_are_valid() {
        let s = EOLineSolver::new();
        let rm = rot_map();

        for seed in 600..610u64 {
            let alg = pseudo_scramble(seed, 18);
            for stage in 0..2 {
                // rot="" 时 State 级验证解的物理效果
                let stats_min = if stage == 0 {
                    s.get_stats_eo(&alg, &[""])[0]
                } else {
                    s.get_stats(&alg, &[""])[0]
                };
                let (best, sols) = s.enumerate_face(&alg, "", stage, 1, 20);
                assert_eq!(best, stats_min, "best mismatch seed={} stage={}", seed, stage);
                if best == 0 {
                    assert!(sols.is_empty());
                    continue;
                }
                assert!(!sols.is_empty());
                assert!(sols.iter().any(|x| x.len == best));
                for sol in &sols {
                    assert!(sol.len >= best && sol.len <= best + 1);
                    let mut st = State::SOLVED;
                    let inv_k = (4 - sol.yk) % 4;
                    for &m in &alg {
                        st.apply(m);
                    }
                    for &m in &sol.moves {
                        st.apply(Move::from_index(rm[inv_k][m as usize] as usize));
                    }
                    // 解在 yk 帧:yk=0 线 = DB/DF;yk=1 线 = y 帧的 DB/DF,
                    // 即原帧 DL/DR(y 把 L 轴转到 B 轴);EO 轴同理由帧决定。
                    // 统一退回 yk 帧校验:对 st 施 y^k 共轭等价于直接在 yk 帧 walk,
                    // 此处用坐标 walk 双保险即可。
                    let mut buf = conj_buf(&alg, "", sol.yk);
                    buf.extend_from_slice(&sol.moves);
                    let (eo, line) = s.walk(&buf);
                    if stage == 0 {
                        assert_eq!(s.pt_eo[eo], 0, "sol doesn't finish EO");
                    } else {
                        assert_eq!(s.pt[eo * LINE + line], 0, "sol doesn't finish EOLine");
                    }
                    // yk=0 的解再做 State 级物理验证
                    if sol.yk == 0 {
                        if stage == 0 {
                            assert!(state_eo_done(&st));
                        } else {
                            assert!(state_eoline_done(&st));
                        }
                    }
                }
            }
        }
    }
}
