//! chain_solver: mallard 式链式还原编排器 EO → DR → HTR → [FR] → Finish(P3
//! normal-side + P5 NISS-Before 双侧搜索)。
//!
//! 设计要点:
//! - **单一 HOME 帧**:整条链以打乱自身的帧为唯一参照。每个阶段在其子求解器的
//!   (rot,yk) 共轭帧下枚举(各 `enumerate_face` 原样复用),返回的解 move 经
//!   `inv_conj_map`(逆 face-relabel)映回 HOME 帧后才追加进累计解 / 残差。
//!   conj 是逐 move 双射 C:conj_buf(scr ++ C⁻¹(sol)) = conj_buf(scr) ++ sol,
//!   故映回后在 HOME 帧重放即达成该阶段目标(chain_inv_conj_roundtrip 测试锁死)。
//! - **轴槽位**:EO 轴 FB=(rot "",yk0) / LR=(rot "",yk1) / UD=(rot "x'",yk0);
//!   DR/HTR/FR 轴 UD=rot ""(idx0) / LR=rot "z'"(idx2) / FB=rot "x'"(idx4),
//!   yk=0(目标对 y 不变)。槽位由 eo_axis_label / dr_axis_label 在 new() 断言锁死。
//! - **阶段串接**:每阶段对当前残差(HOME 帧 scramble+累计 move 列)枚举候选,
//!   过滤 [min_len,max_len] + excluded,合并各轴按长度排序截 cap,逐候选递归下一
//!   阶段。DR 轴须异于 EO 轴(mallard 配对约束);HTR 继承 DR 轴(同 rot);FR 轴
//!   独立可选;Finish = HtrPhase2(G3→solved,rot "")。FR 开启时 Finish 仍是 htr2:
//!   FR 步的 move ⊆ G3,残差仍在 G3,htr2 直接收尾(链的正确性不依赖 FR)。
//! - **与 mallard 的已记录偏差**:(1) DR 步用全 18 move 搜索(引擎 DrSolver 原样),
//!   不限定 EO-保持 st-move ——终态同为 G2 陪集,链仍正确;(2) excluded 语义简化为
//!   「该阶段截止的累计 HOME 帧 move 序列(不含打乱)与给定 alg 解析后逐 move 相等」
//!   (string_to_alg 归一,空白不敏感、非法 token 丢弃);(3) 解行打印 len/cumulative,
//!   无 cancellation 数学;(4) FR 开启时 Finish 用全 6 双转(htr2),不限于 floppy
//!   收尾 4 双转——可能更短,残差 ∈ floppy 子群由测试独立断言。
//! - **窗口**:每阶段枚举预算 = 该阶段该轴最优 + extra,再被 max_len 截顶;
//!   min_len/max_len 只在窗口内过滤(窗口外的更长解不枚举)。best==0 时引擎返回
//!   空解集,合成零步候选(min_len==0 时)。各轴枚举的内部 cap(EO 1024 等)是
//!   实用上界,极端 extra 下个别并列解可能被截断。
//! - **组合守卫**:per-stage cap(默认 5/5/3/2/1,跨轴**跨侧**合并后截断)+ 按当前
//!   已收 top-N 总长剪枝(results 满 max_chains 后 cum > 最差保留总长即剪)。
//! - **NISS-Before(P5)**:每条链携带双侧累计序列 (N, I)(均 HOME 帧;单步整步
//!   只落一侧)。不变量:当前局面的 normal 词 = rev_inv(I) ++ S ++ N,inverse 词
//!   = 其群逆 = rev_inv(N) ++ rev_inv(S) ++ I(rev_inv = 逆序 + 逐 move INV_MOVE)。
//!   niss 开的阶段在两词上各枚举一次,inverse 侧候选(经 inv_conj_map 映回 HOME
//!   帧)追加进 I;候选跨轴跨侧合并按长度排序后截 cap(cap 语义不变)。阶段目标
//!   均为子群成员(g∈Gk ⟺ g⁻¹∈Gk),故任一侧达成 ⇒ 两侧表示同时在轨(条件式
//!   阶段在 normal 词上仍接受,chain_niss_stage_boundary 测试实证)。最终线性解
//!   = N ++ rev_inv(I),复原判据:S ++ N ++ rev_inv(I) 自 SOLVED 重放为 SOLVED
//!   (chain_niss_invariant 测试锁死两种词表示等价)。niss 默认 eo/dr/htr/fr 开、
//!   fin 强制关(忽略配置);excluded 序列化为「累计 N 串 '|' 累计 I 串」,无 '|'
//!   的旧串向后兼容 = I 为空。
//! - 子求解器全部在 `ChainSolver::new()` 构造一次、整链复用(DR 2×~1M、HTR 2.8M、
//!   htr2 648KB 距离表);FrSolver 惰性(OnceLock,fr.enabled 首用才建,陪集规范化
//!   较贵)。native / wasm 同一代码路径(配置 JSON 解析也在本模块,native 可测)。

use std::sync::OnceLock;

use crate::block222_solver::ROTS6;
use crate::cube_common::{alg_rotation, rot_map, string_to_alg, Move, INV_MOVE, MOVE_NAMES};
use crate::dr_solver::{dr_axis_label, DrSolver};
use crate::eoline_solver::{eo_axis_label, EOLineSolver};
use crate::fr_solver::FrSolver;
use crate::htr_phase2_solver::HtrPhase2Solver;
use crate::htr_solver::HtrSolver;
use crate::roux_s1_solver::S1Sol;

// 各阶段枚举的内部解收集上界(过滤前;EO 因双 yk 合并需更大余量)。
const EO_ENUM_CAP: usize = 1024;
const DR_ENUM_CAP: usize = 256;
const HTR_ENUM_CAP: usize = 512;
const FR_ENUM_CAP: usize = 256;
const FIN_ENUM_CAP: usize = 128;

/// 链阶段轴(HOME 帧物理轴)。
#[derive(Copy, Clone, PartialEq, Eq, Debug)]
pub enum Axis {
    Ud,
    Fb,
    Lr,
}

impl Axis {
    pub fn name(self) -> &'static str {
        match self {
            Axis::Ud => "ud",
            Axis::Fb => "fb",
            Axis::Lr => "lr",
        }
    }

    pub fn parse(s: &str) -> Option<Axis> {
        match s {
            "ud" | "UD" => Some(Axis::Ud),
            "fb" | "FB" => Some(Axis::Fb),
            "lr" | "LR" => Some(Axis::Lr),
            _ => None,
        }
    }
}

/// EO 轴 → (ROTS6 索引, yk)。由 new() 里 eo_axis_label 断言锁死。
fn eo_slot(a: Axis) -> (usize, usize) {
    match a {
        Axis::Fb => (0, 0),
        Axis::Lr => (0, 1),
        Axis::Ud => (4, 0),
    }
}

/// DR/HTR/FR 轴 → ROTS6 索引(yk=0)。由 new() 里 dr_axis_label 断言锁死。
fn dr_slot(a: Axis) -> usize {
    match a {
        Axis::Ud => 0,
        Axis::Lr => 2,
        Axis::Fb => 4,
    }
}

/// (rot,yk) 共轭的**逆** move 重标表:解 move(conj 帧)→ HOME 帧物理 move。
/// conj_buf = 先 alg_rotation(rot) 再 rot_map\[yk\] ⇒ 逆 = 先 rot_map\[(4-yk)%4\]
/// 再 alg_rotation(逆 rot token)。
fn inv_conj_map(rot: &str, yk: usize) -> [u8; 18] {
    let inv_rot = match rot {
        "z" => "z'",
        "z'" => "z",
        "x" => "x'",
        "x'" => "x",
        "y" => "y'",
        "y'" => "y",
        other => other, // "" / "z2" / "x2" / "y2" 自逆
    };
    let rm = rot_map();
    let inv_yk = (4 - yk % 4) % 4;
    let mut map = [0u8; 18];
    for (m, slot) in map.iter_mut().enumerate() {
        *slot = rm[inv_yk][m];
    }
    alg_rotation(&mut map, inv_rot);
    map
}

/// rev_inv:逆序 + 逐 move 取逆(INV_MOVE)。词值 = 原词值的群逆。
fn rev_inv(moves: &[u8]) -> Vec<u8> {
    moves.iter().rev().map(|&m| INV_MOVE[m as usize]).collect()
}

/// 拼枚举词:prefix(move 索引)++ scr ++ suffix(move 索引)。
fn word(prefix: &[u8], scr: &[Move], suffix: &[u8]) -> Vec<Move> {
    let mut w: Vec<Move> = Vec::with_capacity(prefix.len() + scr.len() + suffix.len());
    w.extend(prefix.iter().map(|&m| Move::from_index(m as usize)));
    w.extend_from_slice(scr);
    w.extend(suffix.iter().map(|&m| Move::from_index(m as usize)));
    w
}

/// 单阶段配置。`excluded` 为「累计 N 串 '|' 累计 I 串」(string_to_alg 各自归一;
/// 无 '|' = I 为空,向后兼容),语义 = 排除「双侧累计 HOME 帧 move 序列(不含
/// 打乱)截至本阶段恰好等于该对」的链分支。
#[derive(Clone, Debug)]
pub struct StageCfg {
    pub enabled: bool,
    /// 枚举窗口:该轴该侧最优 + extra(再被 max_len 截顶)。
    pub extra: u32,
    /// 本阶段跨轴跨侧合并后保留的候选数。
    pub cap: usize,
    pub min_len: u32,
    pub max_len: u32,
    /// 参与的轴(EO/DR/FR;HTR 继承 DR 轴时忽略,DR 关闭时才用)。
    pub axes: Vec<Axis>,
    pub excluded: Vec<String>,
    /// NISS-Before:本阶段是否同时在 inverse 词上枚举(整步落一侧)。
    /// fin 阶段强制 false(parse_chain_config 钳死 + stage_fin 忽略)。
    pub niss: bool,
}

impl StageCfg {
    fn new(enabled: bool, extra: u32, cap: usize) -> StageCfg {
        StageCfg {
            enabled,
            extra,
            cap,
            min_len: 0,
            max_len: 99,
            axes: vec![Axis::Ud, Axis::Fb, Axis::Lr],
            excluded: Vec::new(),
            niss: true,
        }
    }
}

/// 链配置。默认:eo(extra1,cap5) → dr(extra0,cap5) → htr(extra1,cap3) →
/// fr 关闭(extra0,cap2) → fin(extra0,cap1),max_chains 10;niss 默认
/// eo/dr/htr/fr 开、fin 关(强制)。
#[derive(Clone, Debug)]
pub struct ChainConfig {
    pub eo: StageCfg,
    pub dr: StageCfg,
    pub htr: StageCfg,
    pub fr: StageCfg,
    pub fin: StageCfg,
    pub max_chains: usize,
}

impl Default for ChainConfig {
    fn default() -> Self {
        ChainConfig {
            eo: StageCfg::new(true, 1, 5),
            dr: StageCfg::new(true, 0, 5),
            htr: StageCfg::new(true, 1, 3),
            fr: StageCfg::new(false, 0, 2),
            fin: StageCfg { niss: false, ..StageCfg::new(true, 0, 1) },
            max_chains: 10,
        }
    }
}

/// 链单步。`moves` = HOME 帧 move 索引(无视角前缀);`inv` = 整步做在
/// inverse 打乱上(NISS-Before,追加进 I 而非 N)。
#[derive(Clone, Debug)]
pub struct ChainStep {
    /// "eo" | "dr" | "htr" | "fr" | "fin"。
    pub kind: &'static str,
    /// mallard 式变体名:eoud / drlr-eoud / htr-drlr / frud / fin。
    pub variant: String,
    pub moves: Vec<u8>,
    pub len: u32,
    /// 截至本步的总步数(N.len + I.len)。
    pub cumulative: u32,
    pub inv: bool,
}

impl ChainStep {
    pub fn moves_string(&self) -> String {
        self.moves
            .iter()
            .map(|&m| MOVE_NAMES[m as usize])
            .collect::<Vec<_>>()
            .join(" ")
    }
}

#[derive(Clone, Debug)]
pub struct ChainResult {
    pub steps: Vec<ChainStep>,
    /// 总步数 = N.len + I.len = 线性化解长。
    pub total: u32,
}

impl ChainResult {
    /// 线性化最终解(normal 打乱上的单序列):N ++ rev_inv(I)。
    pub fn solution_moves(&self) -> Vec<u8> {
        let mut n = Vec::new();
        let mut i = Vec::new();
        for st in &self.steps {
            if st.inv {
                i.extend_from_slice(&st.moves);
            } else {
                n.extend_from_slice(&st.moves);
            }
        }
        n.extend(rev_inv(&i));
        n
    }

    pub fn solution_string(&self) -> String {
        self.solution_moves()
            .iter()
            .map(|&m| MOVE_NAMES[m as usize])
            .collect::<Vec<_>>()
            .join(" ")
    }
}

/// 链式求解器:5 个子求解器构造一次、整链复用。
pub struct ChainSolver {
    eoline: EOLineSolver,
    dr: DrSolver,
    htr: HtrSolver,
    /// 惰性:陪集规范化构造较贵,fr.enabled 的请求首用才建(OnceLock 双轨可编)。
    fr: OnceLock<FrSolver>,
    htr2: HtrPhase2Solver,
}

impl Default for ChainSolver {
    fn default() -> Self {
        Self::new()
    }
}

impl ChainSolver {
    pub fn new() -> Self {
        // 轴→槽位映射的承重墙断言:标签函数是引擎几何的单一来源。
        assert_eq!(eo_axis_label(0, 0), "FB", "EO slot FB drifted");
        assert_eq!(eo_axis_label(0, 1), "LR", "EO slot LR drifted");
        assert_eq!(eo_axis_label(4, 0), "UD", "EO slot UD drifted");
        assert_eq!(dr_axis_label(0, 0), "UD", "DR slot UD drifted");
        assert_eq!(dr_axis_label(2, 0), "LR", "DR slot LR drifted");
        assert_eq!(dr_axis_label(4, 0), "FB", "DR slot FB drifted");
        ChainSolver {
            eoline: EOLineSolver::new(),
            dr: DrSolver::new(),
            htr: HtrSolver::new(),
            fr: OnceLock::new(),
            htr2: HtrPhase2Solver::new(),
        }
    }

    fn fr(&self) -> &FrSolver {
        self.fr.get_or_init(FrSolver::new)
    }

    /// 链式求解:打乱不可解析(解析后为空)→ 空结果。返回按 total 升序的前
    /// max_chains 条链。
    pub fn solve_chain(&self, scramble: &str, cfg: &ChainConfig) -> Vec<ChainResult> {
        let scr = string_to_alg(scramble);
        if scr.is_empty() {
            return Vec::new();
        }
        let scr_idx: Vec<u8> = scr.iter().map(|m| m.index() as u8).collect();
        let scr_inv: Vec<Move> =
            rev_inv(&scr_idx).iter().map(|&m| Move::from_index(m as usize)).collect();
        let excl = [
            parse_excluded(&cfg.eo.excluded),
            parse_excluded(&cfg.dr.excluded),
            parse_excluded(&cfg.htr.excluded),
            parse_excluded(&cfg.fr.excluded),
            parse_excluded(&cfg.fin.excluded),
        ];
        let mut search = Search { s: self, cfg, excl, scr, scr_inv, results: Vec::new() };
        search.stage_eo(&[], &[], &[], 0);
        search.results
    }
}

/// excluded 串 → (N 序列, I 序列) 对:'|' 分隔两侧,无 '|' = I 空(向后兼容)。
fn parse_excluded(list: &[String]) -> Vec<(Vec<u8>, Vec<u8>)> {
    let to_idx =
        |t: &str| -> Vec<u8> { string_to_alg(t).iter().map(|m| m.index() as u8).collect() };
    list.iter()
        .map(|s| {
            let (n, i) = match s.split_once('|') {
                Some((a, b)) => (a, b),
                None => (s.as_str(), ""),
            };
            (to_idx(n), to_idx(i))
        })
        .collect()
}

/// 双侧累计比较:候选对 = (cum_n [++ step], cum_i [++ step])(step 落 inv_side 侧)。
fn is_excluded(
    excl: &[(Vec<u8>, Vec<u8>)],
    cum_n: &[u8],
    cum_i: &[u8],
    step: &[u8],
    inv_side: bool,
) -> bool {
    let empty: &[u8] = &[];
    let (sn, si) = if inv_side { (empty, step) } else { (step, empty) };
    excl.iter().any(|(en, ei)| {
        en.len() == cum_n.len() + sn.len()
            && ei.len() == cum_i.len() + si.len()
            && en[..cum_n.len()] == *cum_n
            && en[cum_n.len()..] == *sn
            && ei[..cum_i.len()] == *cum_i
            && ei[cum_i.len()..] == *si
    })
}

fn dedup_axes(axes: &[Axis]) -> Vec<Axis> {
    let mut out = Vec::new();
    for &a in axes {
        if !out.contains(&a) {
            out.push(a);
        }
    }
    out
}

/// 把 conj 帧解集过滤进 [min,max] 窗口 + excluded,映回 HOME 帧。
/// best==0 ⇒ 引擎返回空解集,合成零步候选(min_len==0 时);零步只从 normal 侧
/// 合成(目标为子群 ⇒ 两侧 best 同 0,inverse 侧再合成必重复)。
#[allow(clippy::too_many_arguments)]
fn windowed(
    cfg: &StageCfg,
    best: u32,
    sols: &[&S1Sol],
    inv: &[u8; 18],
    excl: &[(Vec<u8>, Vec<u8>)],
    cum_n: &[u8],
    cum_i: &[u8],
    inv_side: bool,
) -> Vec<(Vec<u8>, u32)> {
    let hi = (best + cfg.extra).min(cfg.max_len);
    let mut out = Vec::new();
    if best == 0 {
        if !inv_side && cfg.min_len == 0 && !is_excluded(excl, cum_n, cum_i, &[], false) {
            out.push((Vec::new(), 0));
        }
        return out;
    }
    if best > hi {
        return out;
    }
    for sol in sols {
        if out.len() >= cfg.cap {
            break;
        }
        if sol.len < cfg.min_len || sol.len > hi {
            continue;
        }
        let home: Vec<u8> = sol.moves.iter().map(|&m| inv[m as usize]).collect();
        if is_excluded(excl, cum_n, cum_i, &home, inv_side) {
            continue;
        }
        out.push((home, sol.len));
    }
    out
}

/// 把候选步追加到所属侧:inv_side ⇒ I,否则 N。
fn extended_side(n: &[u8], i: &[u8], mv: &[u8], inv_side: bool) -> (Vec<u8>, Vec<u8>) {
    let mut nn = n.to_vec();
    let mut ni = i.to_vec();
    if inv_side {
        ni.extend_from_slice(mv);
    } else {
        nn.extend_from_slice(mv);
    }
    (nn, ni)
}

struct Search<'a> {
    s: &'a ChainSolver,
    cfg: &'a ChainConfig,
    /// 每阶段解析后的 excluded 对(顺序 eo/dr/htr/fr/fin)。
    excl: [Vec<(Vec<u8>, Vec<u8>)>; 5],
    /// HOME 帧打乱 S 及其 rev_inv(inverse 打乱)。
    scr: Vec<Move>,
    scr_inv: Vec<Move>,
    results: Vec<ChainResult>,
}

impl Search<'_> {
    /// 剪枝界:results 满 max_chains 后 = 最差保留总长,否则无界。
    fn bound(&self) -> u32 {
        if self.results.len() >= self.cfg.max_chains {
            self.results.last().map(|c| c.total).unwrap_or(u32::MAX)
        } else {
            u32::MAX
        }
    }

    fn push_chain(&mut self, steps: Vec<ChainStep>, total: u32) {
        self.results.push(ChainResult { steps, total });
        self.results.sort_by_key(|c| c.total); // stable:并列保 DFS 先后
        self.results.truncate(self.cfg.max_chains);
    }

    /// normal 侧枚举词:rev_inv(I) ++ S ++ N(当前局面的 normal 表示)。
    fn normal_word(&self, n: &[u8], i: &[u8]) -> Vec<Move> {
        word(&rev_inv(i), &self.scr, n)
    }

    /// inverse 侧枚举词 = normal 词的群逆:rev_inv(N) ++ rev_inv(S) ++ I。
    fn inverse_word(&self, n: &[u8], i: &[u8]) -> Vec<Move> {
        word(&rev_inv(n), &self.scr_inv, i)
    }

    /// 本阶段要枚举的 (inv_side, 词) 列表:normal 恒在;niss 开再加 inverse。
    fn words(&self, cfg: &StageCfg, n: &[u8], i: &[u8]) -> Vec<(bool, Vec<Move>)> {
        let mut w = vec![(false, self.normal_word(n, i))];
        if cfg.niss {
            w.push((true, self.inverse_word(n, i)));
        }
        w
    }

    fn stage_eo(&mut self, n: &[u8], i: &[u8], steps: &[ChainStep], cum_len: u32) {
        let cfg = &self.cfg.eo;
        if !cfg.enabled {
            self.stage_dr(n, i, steps, cum_len, None);
            return;
        }
        let mut cands: Vec<(Axis, bool, Vec<u8>, u32)> = Vec::new();
        for (inv_side, alg) in &self.words(cfg, n, i) {
            for axis in dedup_axes(&cfg.axes) {
                let (ri, yk) = eo_slot(axis);
                let rot = ROTS6[ri];
                let axis_best = self.s.eoline.solve_one_eo(alg, rot, yk);
                let hi = (axis_best + cfg.extra).min(cfg.max_len);
                if axis_best == 0 {
                    // 零步候选只从 normal 侧合成(EO 子群对称,两侧 best 同 0)。
                    if !inv_side
                        && cfg.min_len == 0
                        && !is_excluded(&self.excl[0], n, i, &[], false)
                    {
                        cands.push((axis, false, Vec::new(), 0));
                    }
                    continue;
                }
                if axis_best > hi {
                    continue;
                }
                // enumerate_face(stage 0) 合并枚举该 rot 的 yk0/yk1 两条轴,预算锚定
                // 两轴较小者;此处把窗口顶到 hi 再按 yk 过滤回本轴。
                let rot_best = self
                    .s
                    .eoline
                    .solve_one_eo(alg, rot, 0)
                    .min(self.s.eoline.solve_one_eo(alg, rot, 1));
                // 兄弟 yk 已 EO 完成(rot_best==0)时 enumerate_face 早返回空解集,
                // 本轴(axis_best>0)会整支静默消失 → 退回单 yk 枚举兜住本轴。
                let sols = if rot_best == 0 {
                    self.s.eoline.enumerate_face_yk(alg, rot, yk, 0, hi - axis_best, EO_ENUM_CAP).1
                } else {
                    self.s.eoline.enumerate_face(alg, rot, 0, hi - rot_best, EO_ENUM_CAP).1
                };
                let refs: Vec<&S1Sol> = sols.iter().filter(|x| x.yk == yk).collect();
                let inv = inv_conj_map(rot, yk);
                for (mv, len) in
                    windowed(cfg, axis_best, &refs, &inv, &self.excl[0], n, i, *inv_side)
                {
                    cands.push((axis, *inv_side, mv, len));
                }
            }
        }
        cands.sort_by_key(|c| c.3);
        cands.truncate(cfg.cap);
        for (axis, inv_side, mv, len) in cands {
            let nlen = cum_len + len;
            if nlen > self.bound() {
                continue;
            }
            let (nn, ni) = extended_side(n, i, &mv, inv_side);
            let mut nsteps = steps.to_vec();
            nsteps.push(ChainStep {
                kind: "eo",
                variant: format!("eo{}", axis.name()),
                moves: mv,
                len,
                cumulative: nlen,
                inv: inv_side,
            });
            self.stage_dr(&nn, &ni, &nsteps, nlen, Some(axis));
        }
    }

    fn stage_dr(
        &mut self,
        n: &[u8],
        i: &[u8],
        steps: &[ChainStep],
        cum_len: u32,
        eo_axis: Option<Axis>,
    ) {
        let cfg = &self.cfg.dr;
        if !cfg.enabled {
            self.stage_htr(n, i, steps, cum_len, None);
            return;
        }
        let mut cands: Vec<(Axis, bool, Vec<u8>, u32)> = Vec::new();
        for (inv_side, alg) in &self.words(cfg, n, i) {
            for axis in dedup_axes(&cfg.axes) {
                if eo_axis == Some(axis) {
                    continue; // DR 轴须异于 EO 轴(mallard 配对约束)
                }
                let rot = ROTS6[dr_slot(axis)];
                let (best, sols) = self.s.dr.enumerate_face(alg, rot, cfg.extra, DR_ENUM_CAP);
                if best >= 99 {
                    continue; // 防御:>MAX_DEPTH 哨兵(phase-1 God=12,实际不可达)
                }
                let refs: Vec<&S1Sol> = sols.iter().collect();
                let inv = inv_conj_map(rot, 0);
                for (mv, len) in windowed(cfg, best, &refs, &inv, &self.excl[1], n, i, *inv_side)
                {
                    cands.push((axis, *inv_side, mv, len));
                }
            }
        }
        cands.sort_by_key(|c| c.3);
        cands.truncate(cfg.cap);
        for (axis, inv_side, mv, len) in cands {
            let nlen = cum_len + len;
            if nlen > self.bound() {
                continue;
            }
            let (nn, ni) = extended_side(n, i, &mv, inv_side);
            let variant = match eo_axis {
                Some(a1) => format!("dr{}-eo{}", axis.name(), a1.name()),
                None => format!("dr{}", axis.name()),
            };
            let mut nsteps = steps.to_vec();
            nsteps.push(ChainStep {
                kind: "dr",
                variant,
                moves: mv,
                len,
                cumulative: nlen,
                inv: inv_side,
            });
            self.stage_htr(&nn, &ni, &nsteps, nlen, Some(axis));
        }
    }

    fn stage_htr(
        &mut self,
        n: &[u8],
        i: &[u8],
        steps: &[ChainStep],
        cum_len: u32,
        dr_axis: Option<Axis>,
    ) {
        let cfg = &self.cfg.htr;
        if !cfg.enabled {
            self.stage_fr(n, i, steps, cum_len);
            return;
        }
        // HTR 轴继承 DR 轴(同 rot);DR 关闭时才尝试 cfg.htr.axes(条件式自筛)。
        let axes = match dr_axis {
            Some(a) => vec![a],
            None => dedup_axes(&cfg.axes),
        };
        let mut cands: Vec<(Axis, bool, Vec<u8>, u32)> = Vec::new();
        for (inv_side, alg) in &self.words(cfg, n, i) {
            for &axis in &axes {
                let rot = ROTS6[dr_slot(axis)];
                let Some((best, sols)) =
                    self.s.htr.enumerate_face(alg, rot, cfg.extra, HTR_ENUM_CAP)
                else {
                    continue; // 该视角非 DR
                };
                let refs: Vec<&S1Sol> = sols.iter().collect();
                let inv = inv_conj_map(rot, 0);
                for (mv, len) in windowed(cfg, best, &refs, &inv, &self.excl[2], n, i, *inv_side)
                {
                    cands.push((axis, *inv_side, mv, len));
                }
            }
        }
        cands.sort_by_key(|c| c.3);
        cands.truncate(cfg.cap);
        for (axis, inv_side, mv, len) in cands {
            let nlen = cum_len + len;
            if nlen > self.bound() {
                continue;
            }
            let (nn, ni) = extended_side(n, i, &mv, inv_side);
            let mut nsteps = steps.to_vec();
            nsteps.push(ChainStep {
                kind: "htr",
                variant: format!("htr-dr{}", axis.name()),
                moves: mv,
                len,
                cumulative: nlen,
                inv: inv_side,
            });
            self.stage_fr(&nn, &ni, &nsteps, nlen);
        }
    }

    fn stage_fr(&mut self, n: &[u8], i: &[u8], steps: &[ChainStep], cum_len: u32) {
        let cfg = &self.cfg.fr;
        if !cfg.enabled {
            self.stage_fin(n, i, steps, cum_len);
            return;
        }
        let fr = self.s.fr();
        let mut cands: Vec<(Axis, bool, Vec<u8>, u32)> = Vec::new();
        for (inv_side, alg) in &self.words(cfg, n, i) {
            for axis in dedup_axes(&cfg.axes) {
                let rot = ROTS6[dr_slot(axis)];
                let Some((best, sols)) = fr.enumerate_face(alg, rot, cfg.extra, FR_ENUM_CAP)
                else {
                    continue; // 该视角非 HTR(HTR 启用时不会发生;G3 对旋转不变)
                };
                let refs: Vec<&S1Sol> = sols.iter().collect();
                let inv = inv_conj_map(rot, 0);
                for (mv, len) in windowed(cfg, best, &refs, &inv, &self.excl[3], n, i, *inv_side)
                {
                    cands.push((axis, *inv_side, mv, len));
                }
            }
        }
        cands.sort_by_key(|c| c.3);
        cands.truncate(cfg.cap);
        for (axis, inv_side, mv, len) in cands {
            let nlen = cum_len + len;
            if nlen > self.bound() {
                continue;
            }
            let (nn, ni) = extended_side(n, i, &mv, inv_side);
            let mut nsteps = steps.to_vec();
            nsteps.push(ChainStep {
                kind: "fr",
                variant: format!("fr{}", axis.name()),
                moves: mv,
                len,
                cumulative: nlen,
                inv: inv_side,
            });
            self.stage_fin(&nn, &ni, &nsteps, nlen);
        }
    }

    /// Finish:NISS 强制 Never(忽略 cfg.fin.niss),只在 normal 词上枚举。
    fn stage_fin(&mut self, n: &[u8], i: &[u8], steps: &[ChainStep], cum_len: u32) {
        let cfg = &self.cfg.fin;
        if !cfg.enabled {
            // fin 关闭 = 链止于上一启用阶段(不保证复原);测试/默认配置不走这。
            self.push_chain(steps.to_vec(), cum_len);
            return;
        }
        let alg = self.normal_word(n, i);
        let Some((best, sols)) = self.s.htr2.enumerate_face(&alg, "", cfg.extra, FIN_ENUM_CAP)
        else {
            return; // 残差非 HTR(HTR 启用时不会发生)
        };
        let refs: Vec<&S1Sol> = sols.iter().collect();
        let inv = inv_conj_map("", 0); // identity:rot "" 解已是 HOME 帧
        for (mv, len) in windowed(cfg, best, &refs, &inv, &self.excl[4], n, i, false) {
            let nlen = cum_len + len;
            if nlen > self.bound() {
                continue;
            }
            let mut nsteps = steps.to_vec();
            nsteps.push(ChainStep {
                kind: "fin",
                variant: "fin".to_string(),
                moves: mv,
                len,
                cumulative: nlen,
                inv: false,
            });
            self.push_chain(nsteps, nlen);
        }
    }
}

// ---------- 输出 JSON(wasm 用,native 可测) ----------

/// {"chains":[{"steps":[{"kind":"eo","variant":"eofb","m":"F R","len":2,"cum":2,
/// "inv":true}],"solution":"...","total":N}]}。"inv":true 仅 inverse 侧步骤携带;
/// solution = 线性化最终解 N ++ rev_inv(I)(normal 打乱上单序列),total = 其长度。
/// move 串 / 变体名只含字母数字 '-' '\'' 空格,无需转义。
pub fn chain_json(chains: &[ChainResult]) -> String {
    let mut out = String::from("{\"chains\":[");
    for (i, c) in chains.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        out.push_str("{\"steps\":[");
        for (j, st) in c.steps.iter().enumerate() {
            if j > 0 {
                out.push(',');
            }
            out.push_str(&format!(
                "{{\"kind\":\"{}\",\"variant\":\"{}\",\"m\":\"{}\",\"len\":{},\"cum\":{}{}}}",
                st.kind,
                st.variant,
                st.moves_string(),
                st.len,
                st.cumulative,
                if st.inv { ",\"inv\":true" } else { "" }
            ));
        }
        out.push_str(&format!(
            "],\"solution\":\"{}\",\"total\":{}}}",
            c.solution_string(),
            c.total
        ));
    }
    out.push_str("]}");
    out
}

// ---------- 配置 JSON 解析(手搓微型解析器:wasm 不带 serde,native 同路径可测) ----------

/// 形如:{"maxChains":10,"eo":{"enabled":true,"extra":1,"cap":5,"min":0,"max":8,
/// "axes":["ud","fb","lr"],"excluded":["F R'","|U F"],"niss":true},"dr":{...},
/// "htr":{...},"fr":{...},"fin":{...}}
/// 全部字段可省(缺省走 Default);"min"/"max" 亦接受 "minLen"/"maxLen"。
/// 安全钳:extra ≤ 4,cap 1..=50,min/max ≤ 99,maxChains 1..=100;fin.niss
/// 强制 false(忽略配置)。解析失败(非法 JSON)整体回落默认配置。
pub fn parse_chain_config(json: &str) -> ChainConfig {
    let mut cfg = ChainConfig::default();
    let Some(root) = mini_json::parse(json) else {
        return cfg;
    };
    if let Some(n) = root.get("maxChains").and_then(|v| v.as_u32()) {
        cfg.max_chains = (n as usize).clamp(1, 100);
    }
    apply_stage(root.get("eo"), &mut cfg.eo);
    apply_stage(root.get("dr"), &mut cfg.dr);
    apply_stage(root.get("htr"), &mut cfg.htr);
    apply_stage(root.get("fr"), &mut cfg.fr);
    apply_stage(root.get("fin"), &mut cfg.fin);
    cfg.fin.niss = false; // Finish NISS 强制 Never
    cfg
}

fn apply_stage(j: Option<&mini_json::J>, st: &mut StageCfg) {
    let Some(o) = j else {
        return;
    };
    if let Some(b) = o.get("enabled").and_then(|v| v.as_bool()) {
        st.enabled = b;
    }
    if let Some(n) = o.get("extra").and_then(|v| v.as_u32()) {
        st.extra = n.min(4);
    }
    if let Some(n) = o.get("cap").and_then(|v| v.as_u32()) {
        st.cap = (n as usize).clamp(1, 50);
    }
    for key in ["min", "minLen"] {
        if let Some(n) = o.get(key).and_then(|v| v.as_u32()) {
            st.min_len = n.min(99);
        }
    }
    for key in ["max", "maxLen"] {
        if let Some(n) = o.get(key).and_then(|v| v.as_u32()) {
            st.max_len = n.min(99);
        }
    }
    if let Some(b) = o.get("niss").and_then(|v| v.as_bool()) {
        st.niss = b;
    }
    if let Some(a) = o.get("axes").and_then(|v| v.as_arr()) {
        let axes: Vec<Axis> = a.iter().filter_map(|v| v.as_str().and_then(Axis::parse)).collect();
        if !axes.is_empty() {
            st.axes = axes;
        }
    }
    if let Some(a) = o.get("excluded").and_then(|v| v.as_arr()) {
        st.excluded = a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect();
    }
}

mod mini_json {
    //! 配置子集 JSON 解析器(对象/数组/串/数/布尔/null;\uXXXX 不展开)。

    #[derive(Debug)]
    pub enum J {
        Null,
        Bool(bool),
        Num(f64),
        Str(String),
        Arr(Vec<J>),
        Obj(Vec<(String, J)>),
    }

    impl J {
        pub fn get(&self, key: &str) -> Option<&J> {
            if let J::Obj(kv) = self {
                kv.iter().find(|(k, _)| k == key).map(|(_, v)| v)
            } else {
                None
            }
        }
        pub fn as_bool(&self) -> Option<bool> {
            if let J::Bool(b) = self {
                Some(*b)
            } else {
                None
            }
        }
        pub fn as_u32(&self) -> Option<u32> {
            if let J::Num(n) = self {
                if n.is_finite() && *n >= 0.0 && *n <= u32::MAX as f64 {
                    return Some(*n as u32);
                }
            }
            None
        }
        pub fn as_str(&self) -> Option<&str> {
            if let J::Str(s) = self {
                Some(s)
            } else {
                None
            }
        }
        pub fn as_arr(&self) -> Option<&[J]> {
            if let J::Arr(a) = self {
                Some(a)
            } else {
                None
            }
        }
    }

    /// 嵌套深度上限:敌意深嵌套配置直接拒绝(防 wasm 栈溢出)。
    const MAX_DEPTH: usize = 64;

    pub fn parse(s: &str) -> Option<J> {
        let b = s.as_bytes();
        let mut p = 0usize;
        let v = val(b, &mut p, 0)?;
        ws(b, &mut p);
        if p == b.len() {
            Some(v)
        } else {
            None
        }
    }

    fn ws(b: &[u8], p: &mut usize) {
        while *p < b.len() && matches!(b[*p], b' ' | b'\t' | b'\n' | b'\r') {
            *p += 1;
        }
    }

    fn val(b: &[u8], p: &mut usize, depth: usize) -> Option<J> {
        if depth > MAX_DEPTH {
            return None;
        }
        ws(b, p);
        match *b.get(*p)? {
            b'{' => obj(b, p, depth),
            b'[' => arr(b, p, depth),
            b'"' => string(b, p).map(J::Str),
            b't' => lit(b, p, b"true").map(|_| J::Bool(true)),
            b'f' => lit(b, p, b"false").map(|_| J::Bool(false)),
            b'n' => lit(b, p, b"null").map(|_| J::Null),
            _ => num(b, p),
        }
    }

    fn lit(b: &[u8], p: &mut usize, w: &[u8]) -> Option<()> {
        if b.len() - *p >= w.len() && &b[*p..*p + w.len()] == w {
            *p += w.len();
            Some(())
        } else {
            None
        }
    }

    fn num(b: &[u8], p: &mut usize) -> Option<J> {
        let start = *p;
        if *b.get(*p)? == b'-' {
            *p += 1;
        }
        while *p < b.len()
            && (b[*p].is_ascii_digit() || matches!(b[*p], b'.' | b'e' | b'E' | b'+' | b'-'))
        {
            *p += 1;
        }
        std::str::from_utf8(&b[start..*p]).ok()?.parse::<f64>().ok().map(J::Num)
    }

    fn string(b: &[u8], p: &mut usize) -> Option<String> {
        if *b.get(*p)? != b'"' {
            return None;
        }
        *p += 1;
        let mut s: Vec<u8> = Vec::new();
        loop {
            match *b.get(*p)? {
                b'"' => {
                    *p += 1;
                    return String::from_utf8(s).ok();
                }
                b'\\' => {
                    *p += 1;
                    match *b.get(*p)? {
                        b'"' => s.push(b'"'),
                        b'\\' => s.push(b'\\'),
                        b'/' => s.push(b'/'),
                        b'n' => s.push(b'\n'),
                        b't' => s.push(b'\t'),
                        b'r' => s.push(b'\r'),
                        b'b' => s.push(8),
                        b'f' => s.push(12),
                        b'u' => {
                            // 配置串用不到,占位 '?' 并跳 4 hex。
                            if b.len() < *p + 5 {
                                return None;
                            }
                            *p += 4;
                            s.push(b'?');
                        }
                        _ => return None,
                    }
                    *p += 1;
                }
                c => {
                    s.push(c);
                    *p += 1;
                }
            }
        }
    }

    fn arr(b: &[u8], p: &mut usize, depth: usize) -> Option<J> {
        *p += 1; // '['
        let mut items = Vec::new();
        ws(b, p);
        if *b.get(*p)? == b']' {
            *p += 1;
            return Some(J::Arr(items));
        }
        loop {
            items.push(val(b, p, depth + 1)?);
            ws(b, p);
            match *b.get(*p)? {
                b',' => {
                    *p += 1;
                }
                b']' => {
                    *p += 1;
                    return Some(J::Arr(items));
                }
                _ => return None,
            }
        }
    }

    fn obj(b: &[u8], p: &mut usize, depth: usize) -> Option<J> {
        *p += 1; // '{'
        let mut kv = Vec::new();
        ws(b, p);
        if *b.get(*p)? == b'}' {
            *p += 1;
            return Some(J::Obj(kv));
        }
        loop {
            ws(b, p);
            let k = string(b, p)?;
            ws(b, p);
            if *b.get(*p)? != b':' {
                return None;
            }
            *p += 1;
            kv.push((k, val(b, p, depth + 1)?));
            ws(b, p);
            match *b.get(*p)? {
                b',' => {
                    *p += 1;
                }
                b'}' => {
                    *p += 1;
                    return Some(J::Obj(kv));
                }
                _ => return None,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cube_common::State;
    use crate::roux_s1_solver::conj_buf;
    use std::collections::{HashMap, HashSet};
    use std::sync::OnceLock as StdOnceLock;

    /// 全模块共享一份 ChainSolver(DR/HTR 构造秒级,只付一次)。
    fn solver() -> &'static ChainSolver {
        static S: StdOnceLock<ChainSolver> = StdOnceLock::new();
        S.get_or_init(ChainSolver::new)
    }

    const FIX1: &str =
        "R' U' F D2 L2 F R2 U2 R2 B D2 L B2 L' B D' U R2 D L2 U' R' U' F";
    const FIX2: &str = "D B U B2 R2 U' L2 D2 R2 D' L D2 B D' L2 F' D L' D'";

    /// 锁死的最优链总长基线(NISS 关,FR 关 = P3 行为;改算法时主动改 = review 信号)。
    const FIX1_BEST_TOTAL: u32 = 25;
    const FIX2_BEST_TOTAL: u32 = 26;

    /// 锁死的 NISS-Before 最优链总长基线(默认配置 = niss eo/dr/htr 开,FR 关)。
    /// 必须 ≤ 对应 NISS-off 基线(chain_niss_golden_replay 同时断言);FIX2 上
    /// NISS 严格更优(26 → 25,最优链 DR 在 inverse 侧)。
    const FIX1_NISS_BEST_TOTAL: u32 = 25;
    const FIX2_NISS_BEST_TOTAL: u32 = 25;

    /// 全阶段 niss 关 = P3 normal-side 行为。
    fn niss_off(mut cfg: ChainConfig) -> ChainConfig {
        for st in [&mut cfg.eo, &mut cfg.dr, &mut cfg.htr, &mut cfg.fr, &mut cfg.fin] {
            st.niss = false;
        }
        cfg
    }

    fn to_idx(s: &str) -> Vec<u8> {
        string_to_alg(s).iter().map(|m| m.index() as u8).collect()
    }

    fn apply_idx(idx: &[u8]) -> State {
        let mut st = State::SOLVED;
        for &m in idx {
            st.apply(Move::from_index(m as usize));
        }
        st
    }

    /// 顺序重放(仅 normal-side 链合法):S + 各步 moves。
    fn apply_all(scr: &str, steps: &[ChainStep]) -> State {
        assert!(steps.iter().all(|st| !st.inv), "apply_all only valid for normal-side chains");
        let mut st = State::SOLVED;
        for m in string_to_alg(scr) {
            st.apply(m);
        }
        for step in steps {
            for &m in &step.moves {
                st.apply(Move::from_index(m as usize));
            }
        }
        st
    }

    /// 线性化重放:S ++ N ++ rev_inv(I) 自 SOLVED(NISS 链复原判据)。
    fn replay_linear(scr: &str, c: &ChainResult) -> State {
        let mut idx = to_idx(scr);
        idx.extend(c.solution_moves());
        apply_idx(&idx)
    }

    /// 截至第 upto 步(不含)的双侧累计 (N, I)。
    fn split_ni(steps: &[ChainStep], upto: usize) -> (Vec<u8>, Vec<u8>) {
        let mut n = Vec::new();
        let mut i = Vec::new();
        for st in &steps[..upto] {
            if st.inv {
                i.extend_from_slice(&st.moves);
            } else {
                n.extend_from_slice(&st.moves);
            }
        }
        (n, i)
    }

    /// 构造表示词:normal = rev_inv(I)++S++N;inverse = rev_inv(N)++rev_inv(S)++I。
    fn repr_words(scr: &str, n: &[u8], i: &[u8]) -> (Vec<Move>, Vec<Move>) {
        let s_idx = to_idx(scr);
        let to_moves = |v: Vec<u8>| -> Vec<Move> {
            v.iter().map(|&m| Move::from_index(m as usize)).collect()
        };
        let nw = [rev_inv(i), s_idx.clone(), n.to_vec()].concat();
        let iw = [rev_inv(n), rev_inv(&s_idx), i.to_vec()].concat();
        (to_moves(nw), to_moves(iw))
    }

    fn state_of(w: &[Move]) -> State {
        let mut st = State::SOLVED;
        for &m in w {
            st.apply(m);
        }
        st
    }

    fn axis_of_variant(v: &str) -> Axis {
        // "eoud" / "drlr-eoud" / "htr-drlr" / "frud":取 kind 前缀后的 2 字母。
        let core = v.strip_prefix("htr-dr").unwrap_or(v);
        let core = core
            .strip_prefix("eo")
            .or_else(|| core.strip_prefix("dr"))
            .or_else(|| core.strip_prefix("fr"))
            .unwrap_or(core);
        Axis::parse(&core[..2]).expect("variant axis")
    }

    // ---------- 帧映射证明(数学层) ----------

    /// inv_conj_map 与 conj_buf 互逆 + 串接同态:conj(scr ++ inv(sol)) = conj(scr) ++ sol。
    #[test]
    fn chain_inv_conj_roundtrip() {
        for (ri, rot) in ROTS6.iter().enumerate() {
            for yk in 0..4 {
                let inv = inv_conj_map(rot, yk);
                // 前向逐 move 表:conj_buf 对单 move alg 的效果。
                let mut fwd = [0u8; 18];
                for m in 0..18usize {
                    fwd[m] = conj_buf(&[Move::from_index(m)], rot, yk)[0];
                }
                for m in 0..18usize {
                    assert_eq!(inv[fwd[m] as usize], m as u8, "inv∘fwd != id rot={} yk={}", ri, yk);
                    assert_eq!(fwd[inv[m] as usize], m as u8, "fwd∘inv != id rot={} yk={}", ri, yk);
                }
                // 同态:任意 HOME 词 w + conj 帧词 s。
                let w = string_to_alg("R U2 F' L D B2 R' F");
                let s: Vec<u8> = vec![0, 13, 9, 4, 17]; // U F2 R D2 B'(conj 帧)
                let mut wid: Vec<Move> = w.clone();
                wid.extend(s.iter().map(|&m| Move::from_index(inv[m as usize] as usize)));
                let lhs = conj_buf(&wid, rot, yk);
                let mut rhs = conj_buf(&w, rot, yk);
                rhs.extend_from_slice(&s);
                assert_eq!(lhs, rhs, "conj homomorphism broken rot={} yk={}", ri, yk);
            }
        }
    }

    // ---------- 金标准(NISS 关 = P3 行为):整链重放复原 + 最优总长基线 ----------

    #[test]
    fn chain_golden_replay_solved() {
        let s = solver();
        let cfg = niss_off(ChainConfig::default());
        for (scr, best_total) in [(FIX1, FIX1_BEST_TOTAL), (FIX2, FIX2_BEST_TOTAL)] {
            let chains = s.solve_chain(scr, &cfg);
            assert!(!chains.is_empty(), "no chains for {}", scr);
            assert!(chains.len() <= cfg.max_chains);
            // 按 total 升序。
            for w in chains.windows(2) {
                assert!(w[0].total <= w[1].total, "chains not sorted");
            }
            assert_eq!(chains[0].total, best_total, "optimal total baseline drifted ({})", scr);
            for c in &chains {
                // 阶段结构:默认配置 = eo,dr,htr,fin;niss 关 ⇒ 全 normal 侧。
                let kinds: Vec<&str> = c.steps.iter().map(|st| st.kind).collect();
                assert_eq!(kinds, vec!["eo", "dr", "htr", "fin"], "stage kinds");
                assert!(c.steps.iter().all(|st| !st.inv), "niss-off must be normal-side only");
                // cumulative 单调 + total 一致。
                let mut cum = 0u32;
                for st in &c.steps {
                    cum += st.len;
                    assert_eq!(st.cumulative, cum, "cumulative mismatch");
                    assert_eq!(st.moves.len() as u32, st.len, "len != moves.len");
                }
                assert_eq!(c.total, cum, "total != sum of lens");
                // 物理重放:打乱 + 全链 HOME 帧 move → 复原。线性化解与顺序重放等价。
                assert_eq!(apply_all(scr, &c.steps), State::SOLVED, "chain does not solve ({})", scr);
                assert_eq!(replay_linear(scr, c), State::SOLVED);
            }
        }
    }

    // ---------- NISS 不变量(数学层):双侧词表示等价 + rev_inv 对合 ----------

    #[test]
    fn chain_niss_invariant() {
        // rev_inv 对合:rev_inv(rev_inv(x)) == x;词值互逆:x ++ rev_inv(x) = 恒等。
        let x = to_idx("R U2 F' L D B2 R' F U D2");
        assert_eq!(rev_inv(&rev_inv(&x)), x, "rev_inv must be an involution");
        let mut xi = x.clone();
        xi.extend(rev_inv(&x));
        assert_eq!(apply_idx(&xi), State::SOLVED, "x ++ rev_inv(x) must be identity");

        // 表示等价:w1 = rev_inv(I)++S++N(normal 表示)与 w2 = S++N++rev_inv(I)
        // (线性化判据)共轭:v(w1) = v(rev_inv(I)) v(w2) v(rev_inv(I))⁻¹,
        // 故两者同时为恒等(链完成判据可在任一表示上判)。
        let s_idx = to_idx(FIX2);
        let mut i_solving = s_idx.clone();
        i_solving.extend(to_idx("R U R'"));
        let cases: Vec<(Vec<u8>, Vec<u8>)> = vec![
            // 可解构造:v(I) = v(S++N) ⇒ 两表示皆复原。
            (to_idx("R U R'"), i_solving),
            (Vec::new(), s_idx.clone()),
            // 不可解:任取 N/I。
            (to_idx("F2 L D'"), to_idx("U B2")),
            (to_idx("U"), Vec::new()),
            (Vec::new(), to_idx("L' F")),
        ];
        for (k, (nm, im)) in cases.iter().enumerate() {
            let ri = rev_inv(im);
            let w1: Vec<u8> = [ri.clone(), s_idx.clone(), nm.clone()].concat();
            let w2: Vec<u8> = [s_idx.clone(), nm.clone(), ri.clone()].concat();
            // 共轭关系实证:state(w1) == state(rev_inv(I) ++ w2 ++ rev_inv(rev_inv(I)))。
            let conj: Vec<u8> = [ri.clone(), w2.clone(), rev_inv(&ri)].concat();
            assert_eq!(apply_idx(&w1), apply_idx(&conj), "conjugacy broken case {}", k);
            // 复原等价。
            assert_eq!(
                apply_idx(&w1) == State::SOLVED,
                apply_idx(&w2) == State::SOLVED,
                "solved-ness must agree between representations case {}",
                k
            );
            // 前两 case 按构造必复原(防全空验证)。
            if k < 2 {
                assert_eq!(apply_idx(&w2), State::SOLVED, "solving case {} must solve", k);
            }
        }
    }

    // ---------- NISS 金标准:默认配置(niss 开)线性化重放复原 + 基线 ----------

    #[test]
    fn chain_niss_golden_replay() {
        let s = solver();
        let cfg = ChainConfig::default();
        for (scr, best_total, off_total) in [
            (FIX1, FIX1_NISS_BEST_TOTAL, FIX1_BEST_TOTAL),
            (FIX2, FIX2_NISS_BEST_TOTAL, FIX2_BEST_TOTAL),
        ] {
            let chains = s.solve_chain(scr, &cfg);
            assert!(!chains.is_empty(), "no NISS chains for {}", scr);
            for w in chains.windows(2) {
                assert!(w[0].total <= w[1].total, "chains not sorted");
            }
            println!("NISS-ON best total {} = {}", scr, chains[0].total);
            assert_eq!(chains[0].total, best_total, "NISS-on baseline drifted ({})", scr);
            // NISS 是 normal-only 的超集搜索:最优只会更好或持平。
            assert!(chains[0].total <= off_total, "NISS-on best must be <= NISS-off best");
            for c in &chains {
                let kinds: Vec<&str> = c.steps.iter().map(|st| st.kind).collect();
                assert_eq!(kinds, vec!["eo", "dr", "htr", "fin"], "stage kinds");
                let mut cum = 0u32;
                for st in &c.steps {
                    cum += st.len;
                    assert_eq!(st.cumulative, cum, "cum must be N.len+I.len so far");
                    assert_eq!(st.moves.len() as u32, st.len);
                    if st.kind == "fin" {
                        assert!(!st.inv, "fin is forced normal-side");
                    }
                }
                assert_eq!(c.total, cum, "total != sum of lens");
                let sol = c.solution_moves();
                assert_eq!(sol.len() as u32, c.total, "linearized length != total");
                // 复原判据:S ++ N ++ rev_inv(I) 自 SOLVED 重放为 SOLVED。
                assert_eq!(
                    replay_linear(scr, c),
                    State::SOLVED,
                    "S ++ N ++ rev_inv(I) must solve ({})",
                    scr
                );
            }
        }
    }

    /// 默认 NISS 配置在 fixtures 上必须真用到 inverse 侧步骤(NISS 生效实锤)。
    #[test]
    fn chain_niss_inverse_step_used() {
        let s = solver();
        let cfg = ChainConfig::default();
        let mut found = false;
        for scr in [FIX1, FIX2] {
            for c in s.solve_chain(scr, &cfg) {
                if c.steps.iter().any(|st| st.inv) {
                    found = true;
                }
            }
        }
        assert!(found, "no inverse-side step in any NISS chain — fixtures need replacing");
    }

    // ---------- NISS 条件式阶段健全性:任一侧步骤后两种表示同时在轨 ----------

    #[test]
    fn chain_niss_stage_boundary() {
        let s = solver();
        let mut cfg = ChainConfig::default();
        cfg.fr.enabled = true;
        let h_sets: HashMap<&'static str, HashSet<[u8; 20]>> = [
            ("ud", home_closure(&fr_home_gens(Axis::Ud))),
            ("fb", home_closure(&fr_home_gens(Axis::Fb))),
            ("lr", home_closure(&fr_home_gens(Axis::Lr))),
        ]
        .into_iter()
        .collect();
        let key = |st: &State| -> [u8; 20] {
            let mut k = [0u8; 20];
            k[..8].copy_from_slice(&st.corners);
            k[8..].copy_from_slice(&st.edges);
            k
        };
        let mut inv_dr_checked = 0usize;
        for scr in [FIX1, FIX2] {
            let chains = s.solve_chain(scr, &cfg);
            assert!(!chains.is_empty());
            for c in &chains {
                for (k, step) in c.steps.iter().enumerate() {
                    let (n, i) = split_ni(&c.steps, k + 1);
                    let (nw, iw) = repr_words(scr, &n, &i);
                    match step.kind {
                        "eo" => {
                            let (ri, yk) = eo_slot(axis_of_variant(&step.variant));
                            assert_eq!(s.eoline.solve_one_eo(&nw, ROTS6[ri], yk), 0);
                            assert_eq!(s.eoline.solve_one_eo(&iw, ROTS6[ri], yk), 0);
                        }
                        "dr" => {
                            // 关键断言:inverse 侧 DR 后,normal 表示的残差词仍被
                            // HtrSolver 条件式接受(G2 子群对称)。
                            let rot = ROTS6[dr_slot(axis_of_variant(&step.variant))];
                            assert!(s.htr.is_dr(&nw, rot, 0), "normal repr not DR after dr step");
                            assert!(s.htr.is_dr(&iw, rot, 0), "inverse repr not DR after dr step");
                            if step.inv {
                                inv_dr_checked += 1;
                            }
                        }
                        "htr" => {
                            assert!(s.htr2.is_htr(&nw, "", 0), "normal repr not HTR");
                            assert!(s.htr2.is_htr(&iw, "", 0), "inverse repr not HTR");
                            assert!(s.fr().is_fr(&nw, "", 0), "fr rejects normal repr");
                        }
                        "fr" => {
                            // post-FR 残差(normal 表示词值)∈ 该轴 floppy 子群
                            // (独立 State 闭包判定,不经 solver 坐标)。
                            let axis = axis_of_variant(&step.variant);
                            assert!(
                                h_sets[axis.name()].contains(&key(&state_of(&nw))),
                                "post-FR normal-repr residual not in floppy H_{}",
                                axis.name()
                            );
                        }
                        "fin" => {
                            assert!(!step.inv);
                            // 链完成:normal 表示词值为恒等(⇒ inverse 表示亦恒等)。
                            assert_eq!(state_of(&nw), State::SOLVED);
                            assert_eq!(state_of(&iw), State::SOLVED);
                        }
                        other => panic!("unexpected kind {}", other),
                    }
                }
            }
        }
        println!("inverse-side DR steps boundary-checked: {}", inv_dr_checked);
    }

    // ---------- NISS excluded 双侧 pair key + 无 '|' 向后兼容 ----------

    #[test]
    fn chain_niss_excluded_pair() {
        let s = solver();
        let cfg = ChainConfig::default();
        let base = s.solve_chain(FIX1, &cfg);
        assert!(!base.is_empty());
        let eo0 = base[0].steps[0].clone();
        let m = eo0.moves_string();
        assert!(eo0.len > 0, "fixture EO should be nontrivial");
        // 引擎规范 pair key:累计 N 串 '|' 累计 I 串(EO 为首阶段,对侧累计为空;
        // normal 侧省 '|' 即旧格式)。
        let (matching, mismatching) = if eo0.inv {
            (format!("|{}", m), m.clone())
        } else {
            (m.clone(), format!("|{}", m))
        };
        // 命中侧排除:该 (side, moves) 首步从所有链消失,余链仍复原。
        let mut c1 = cfg.clone();
        c1.eo.excluded = vec![matching];
        let ex = s.solve_chain(FIX1, &c1);
        assert!(!ex.is_empty(), "excluding one EO must not kill all chains");
        for c in &ex {
            assert!(
                !(c.steps[0].inv == eo0.inv && c.steps[0].moves_string() == m),
                "excluded (side, moves) pair leaked"
            );
            assert_eq!(replay_linear(FIX1, c), State::SOLVED);
        }
        // 错侧 key 不排除(向后兼容:无 '|' 串只匹配 normal 侧,'|x' 只匹配 inverse 侧)。
        let mut c2 = cfg.clone();
        c2.eo.excluded = vec![mismatching];
        let keep = s.solve_chain(FIX1, &c2);
        assert!(
            keep.iter().any(|c| c.steps[0].inv == eo0.inv && c.steps[0].moves_string() == m),
            "wrong-side exclude must not remove the step"
        );
    }

    // ---------- 阶段边界证明:每阶段映回后,下一阶段的条件式必接受 ----------

    #[test]
    fn chain_stage_boundary_proof() {
        let s = solver();
        let cfg = niss_off(ChainConfig::default());
        let chains = s.solve_chain(FIX1, &cfg);
        assert!(!chains.is_empty());
        for c in &chains {
            let mut alg = string_to_alg(FIX1);
            for step in &c.steps {
                alg.extend(step.moves.iter().map(|&m| Move::from_index(m as usize)));
                match step.kind {
                    "eo" => {
                        // EO 完成:该轴 conj 帧下 State 级 eo 全 0(独立于 pt 查表)。
                        let (ri, yk) = eo_slot(axis_of_variant(&step.variant));
                        let buf = conj_buf(&alg, ROTS6[ri], yk);
                        let mut st = State::SOLVED;
                        for &m in &buf {
                            st.apply(Move::from_index(m as usize));
                        }
                        let (_, eo) = st.ep_eo();
                        assert!(eo.iter().all(|&v| v == 0), "EO not done after eo step");
                        assert_eq!(
                            s.eoline.solve_one_eo(&alg, ROTS6[ri], yk),
                            0,
                            "eo table disagrees"
                        );
                    }
                    "dr" => {
                        // 下一阶段 HtrSolver 的条件式必须接受(该轴视角已是 DR)。
                        let rot = ROTS6[dr_slot(axis_of_variant(&step.variant))];
                        assert!(s.htr.is_dr(&alg, rot, 0), "HtrSolver rejects post-DR state");
                    }
                    "htr" => {
                        // 下一阶段 htr2 / fr 的条件式必须接受(G3 对旋转不变)。
                        assert!(s.htr2.is_htr(&alg, "", 0), "htr2 rejects post-HTR state");
                        assert!(s.fr().is_fr(&alg, "", 0), "fr rejects post-HTR state");
                    }
                    "fin" => {
                        let mut st = State::SOLVED;
                        for &m in &alg {
                            st.apply(m);
                        }
                        assert_eq!(st, State::SOLVED, "not solved after fin");
                    }
                    other => panic!("unexpected kind {}", other),
                }
            }
        }
    }

    // ---------- min/max + excluded 过滤 ----------

    #[test]
    fn chain_filters_min_max_excluded() {
        let s = solver();
        let base = s.solve_chain(FIX2, &niss_off(ChainConfig::default()));
        assert!(!base.is_empty());
        let eo0 = &base[0].steps[0];
        let eo0_len = eo0.len;
        let eo0_str = eo0.moves_string();
        assert!(eo0_len > 0, "fixture EO should be nontrivial");

        // excluded:排除最优链的 EO(累计 = EO 步本身)→ 仍有链,但没有任何链用它。
        let mut cfg = niss_off(ChainConfig::default());
        cfg.eo.excluded = vec![eo0_str.clone()];
        let chains = s.solve_chain(FIX2, &cfg);
        assert!(!chains.is_empty(), "excluding one EO must not kill all chains");
        for c in &chains {
            assert_ne!(c.steps[0].moves_string(), eo0_str, "excluded EO leaked");
            assert_eq!(apply_all(FIX2, &c.steps), State::SOLVED);
        }

        // min_len:EO 步长全部 ≥ 下限(窗口随之上移:看到的 EO 都更长)。
        let mut cfg = niss_off(ChainConfig::default());
        cfg.eo.min_len = eo0_len + 1;
        cfg.eo.extra = 2; // 抬窗口,保证下限内仍有解
        let chains = s.solve_chain(FIX2, &cfg);
        for c in &chains {
            assert!(c.steps[0].len >= eo0_len + 1, "min_len violated");
            assert_eq!(apply_all(FIX2, &c.steps), State::SOLVED);
        }

        // max_len:EO 步长全部 ≤ 上限。
        let mut cfg = niss_off(ChainConfig::default());
        cfg.eo.max_len = eo0_len;
        let chains = s.solve_chain(FIX2, &cfg);
        assert!(!chains.is_empty());
        for c in &chains {
            assert!(c.steps[0].len <= eo0_len, "max_len violated");
        }
    }

    // ---------- FR 开/关:都复原;开启时 post-FR 残差落 floppy 子群(独立判定) ----------

    /// 独立 State 级闭包:HOME 帧给定生成元的子群成员集。
    fn home_closure(gens: &[u8]) -> HashSet<[u8; 20]> {
        let key = |st: &State| -> [u8; 20] {
            let mut k = [0u8; 20];
            k[..8].copy_from_slice(&st.corners);
            k[8..].copy_from_slice(&st.edges);
            k
        };
        let mut seen = HashSet::new();
        seen.insert(key(&State::SOLVED));
        let mut frontier = vec![State::SOLVED];
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for st in &frontier {
                for &m in gens {
                    let ns = st.applied(Move::from_index(m as usize));
                    if seen.insert(key(&ns)) {
                        next.push(ns);
                    }
                }
            }
            frontier = next;
        }
        seen
    }

    /// FR 轴(floppy 轴)→ HOME 帧 floppy 收尾子群 H 的 4 个双转生成元。
    fn fr_home_gens(axis: Axis) -> [u8; 4] {
        match axis {
            Axis::Ud => [7, 10, 13, 16],  // L2 R2 F2 B2(U/D 不动)
            Axis::Fb => [1, 4, 7, 10],    // U2 D2 L2 R2(F/B 不动)
            Axis::Lr => [1, 4, 13, 16],   // U2 D2 F2 B2(L/R 不动)
        }
    }

    #[test]
    fn chain_fr_enabled_floppy() {
        let s = solver();
        let off = s.solve_chain(FIX1, &niss_off(ChainConfig::default()));
        let mut cfg = niss_off(ChainConfig::default());
        cfg.fr.enabled = true;
        let on = s.solve_chain(FIX1, &cfg);
        assert!(!off.is_empty() && !on.is_empty());
        assert!(off.iter().all(|c| c.steps.iter().all(|st| st.kind != "fr")));

        let h_sets: HashMap<&'static str, HashSet<[u8; 20]>> = [
            ("ud", home_closure(&fr_home_gens(Axis::Ud))),
            ("fb", home_closure(&fr_home_gens(Axis::Fb))),
            ("lr", home_closure(&fr_home_gens(Axis::Lr))),
        ]
        .into_iter()
        .collect();
        let key = |st: &State| -> [u8; 20] {
            let mut k = [0u8; 20];
            k[..8].copy_from_slice(&st.corners);
            k[8..].copy_from_slice(&st.edges);
            k
        };

        for c in &on {
            let kinds: Vec<&str> = c.steps.iter().map(|st| st.kind).collect();
            assert_eq!(kinds, vec!["eo", "dr", "htr", "fr", "fin"]);
            assert_eq!(apply_all(FIX1, &c.steps), State::SOLVED, "fr-enabled chain not solved");
            // post-FR 残差 ∈ 该轴 floppy 子群(独立 State 闭包,不经 solver 坐标)。
            let fr_idx = c.steps.iter().position(|st| st.kind == "fr").unwrap();
            let axis = axis_of_variant(&c.steps[fr_idx].variant);
            let st = apply_all_until(FIX1, &c.steps, fr_idx + 1);
            assert!(
                h_sets[axis.name()].contains(&key(&st)),
                "post-FR residual not in floppy subgroup H_{}",
                axis.name()
            );
        }
        // 同一前缀空间上 FR 是额外中间约束:fr-on 最优总长 ≥ fr-off 最优总长。
        assert!(on[0].total >= off[0].total);
    }

    fn apply_all_until(scr: &str, steps: &[ChainStep], n: usize) -> State {
        let mut st = State::SOLVED;
        for m in string_to_alg(scr) {
            st.apply(m);
        }
        for step in &steps[..n] {
            for &m in &step.moves {
                st.apply(Move::from_index(m as usize));
            }
        }
        st
    }

    /// htr2(6 双转)在 floppy 子群 H_UD 全 192 态上 vs H 限定(4 双转)BFS 距离:
    /// 锁基线 = 两者恰好处处相等(若未来引擎变化打破,此处会显式红)。
    #[test]
    fn chain_fr_finish_subgroup_sweep() {
        let s = solver();
        // H_UD 全员 BFS,带生成词(HOME 帧;距离 = 词长)。
        let gens = fr_home_gens(Axis::Ud);
        let key = |st: &State| -> [u8; 20] {
            let mut k = [0u8; 20];
            k[..8].copy_from_slice(&st.corners);
            k[8..].copy_from_slice(&st.edges);
            k
        };
        let mut dist: HashMap<[u8; 20], (u32, Vec<Move>)> = HashMap::new();
        dist.insert(key(&State::SOLVED), (0, Vec::new()));
        let mut frontier = vec![(State::SOLVED, Vec::<Move>::new())];
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for (st, w) in &frontier {
                for &m in &gens {
                    let mv = Move::from_index(m as usize);
                    let ns = st.applied(mv);
                    let k = key(&ns);
                    if !dist.contains_key(&k) {
                        let mut nw = w.clone();
                        nw.push(mv);
                        dist.insert(k, (nw.len() as u32, nw.clone()));
                        next.push((ns, nw));
                    }
                }
            }
            frontier = next;
        }
        assert_eq!(dist.len(), 192, "|H_UD| changed");
        let mut strict_less = 0usize;
        for (_, (hd, word)) in &dist {
            let d2 = s.htr2.solve_one(word, "", 0).expect("H member must be HTR");
            assert!(d2 <= *hd, "htr2 dist exceeds H-restricted dist");
            if d2 < *hd {
                strict_less += 1;
            }
        }
        // 实测基线:6 双转最优在 H_UD 全员上恰等于 4 双转限定最优。
        assert_eq!(strict_less, 0, "htr2 shortcut via U2/D2 appeared inside H");
    }

    // ---------- 配置 JSON 解析 ----------

    #[test]
    fn chain_config_json_parse() {
        // 缺省:niss eo/dr/htr/fr 开,fin 关。
        let d = parse_chain_config("{}");
        assert!(d.eo.enabled && !d.fr.enabled);
        assert_eq!(d.max_chains, 10);
        assert_eq!(d.eo.cap, 5);
        assert!(d.eo.niss && d.dr.niss && d.htr.niss && d.fr.niss && !d.fin.niss);
        // 非法 JSON → 整体缺省。
        let g = parse_chain_config("not json at all");
        assert_eq!(g.max_chains, 10);
        // 覆写 + 钳制 + 别名。
        let c = parse_chain_config(
            r#"{"maxChains":3,
                "eo":{"extra":99,"cap":0,"min":2,"maxLen":6,"axes":["ud","lr"],"excluded":["F R'","B2"],"niss":false},
                "fr":{"enabled":true,"axes":["fb"]},
                "fin":{"enabled":false,"niss":true}}"#,
        );
        assert_eq!(c.max_chains, 3);
        assert_eq!(c.eo.extra, 4); // 钳 ≤4
        assert_eq!(c.eo.cap, 1); // 钳 ≥1
        assert_eq!(c.eo.min_len, 2);
        assert_eq!(c.eo.max_len, 6);
        assert_eq!(c.eo.axes, vec![Axis::Ud, Axis::Lr]);
        assert_eq!(c.eo.excluded, vec!["F R'".to_string(), "B2".to_string()]);
        assert!(!c.eo.niss);
        assert!(c.fr.enabled);
        assert_eq!(c.fr.axes, vec![Axis::Fb]);
        assert!(!c.fin.enabled);
        assert!(!c.fin.niss, "fin niss must be forced false even if config says true");
        // dr 未给 → 缺省不动(niss 默认开)。
        assert_eq!(c.dr.cap, 5);
        assert!(c.dr.niss);
        // excluded 归一:解析为 (N, I) move 索引序列对(F=12,R'=11;无 '|' = I 空)。
        assert_eq!(parse_excluded(&c.eo.excluded)[0], (vec![12u8, 11], vec![]));
        let pairs = parse_excluded(&["F R'|B2".to_string(), "|U".to_string()]);
        assert_eq!(pairs[0], (vec![12u8, 11], vec![16]));
        assert_eq!(pairs[1], (vec![], vec![0]));
    }

    // ---------- EO sibling-yk 兜底:某轴已 EO 完成时,同 rot 兄弟轴不消失 ----------

    /// 仅 U/D/L/R/F2/B2 的词:FB 轴 EO 天然完成(无 F/B 四分之一转),LR/UD 破。
    const EO_FB_COMPLETE: &str = "U R2 D' L F2 U' B2 L2 D R' U2 L' D2 R F2 B2 U L D' R2";

    #[test]
    fn chain_eo_sibling_axis_fallback() {
        let s = solver();
        let alg = string_to_alg(EO_FB_COMPLETE);
        // fixture 前提:EO 恰好只在 FB 轴完成。
        assert_eq!(s.eoline.solve_one_eo(&alg, "", 0), 0, "FB must be EO-complete");
        let lr_best = s.eoline.solve_one_eo(&alg, "", 1);
        let ud_best = s.eoline.solve_one_eo(&alg, "x'", 0);
        assert!(lr_best > 0 && ud_best > 0, "LR/UD must not be EO-complete");

        // bug 实锤:rot 级合并枚举因 yk0 best==0 早返回空 → LR 解集为空(修前
        // stage_eo 据此把 LR 整支静默丢掉);单 yk 枚举兜回非空解集。
        let (b, sols) = s.eoline.enumerate_face(&alg, "", 0, lr_best + 1, EO_ENUM_CAP);
        assert_eq!(b, 0);
        assert!(sols.is_empty(), "rot-level enumerate must be empty when sibling yk best==0");
        let (b1, sols1) = s.eoline.enumerate_face_yk(&alg, "", 1, 0, 1, EO_ENUM_CAP);
        assert_eq!(b1, lr_best);
        assert!(!sols1.is_empty() && sols1.iter().all(|x| x.yk == 1));

        // 链级回归:限定 EO 轴 = LR(修前该支消失 → 0 条链),修后有链且复原。
        let mut cfg = niss_off(ChainConfig::default());
        cfg.eo.axes = vec![Axis::Lr];
        let chains = s.solve_chain(EO_FB_COMPLETE, &cfg);
        assert!(!chains.is_empty(), "sibling-axis EO branch must survive");
        for c in &chains {
            assert_eq!(c.steps[0].kind, "eo");
            assert_eq!(c.steps[0].variant, "eolr");
            assert!(c.steps[0].len > 0, "eolr step must be nontrivial");
            assert_eq!(apply_all(EO_FB_COMPLETE, &c.steps), State::SOLVED);
        }

        // UD 轴(rot x',兄弟槽位 EO 未完成)走原 rot 级路径,同样有链且复原。
        let mut cfg = niss_off(ChainConfig::default());
        cfg.eo.axes = vec![Axis::Ud];
        let chains = s.solve_chain(EO_FB_COMPLETE, &cfg);
        assert!(!chains.is_empty());
        for c in &chains {
            assert_eq!(c.steps[0].variant, "eoud");
            assert_eq!(apply_all(EO_FB_COMPLETE, &c.steps), State::SOLVED);
        }

        // 默认轴配置(全 3 轴,niss 关):FB 出零步候选,链仍全部复原。
        let chains = s.solve_chain(EO_FB_COMPLETE, &niss_off(ChainConfig::default()));
        assert!(!chains.is_empty());
        for c in &chains {
            assert_eq!(apply_all(EO_FB_COMPLETE, &c.steps), State::SOLVED);
        }

        // NISS 开(默认配置):同 fixture 链全部经线性化判据复原。
        let chains = s.solve_chain(EO_FB_COMPLETE, &ChainConfig::default());
        assert!(!chains.is_empty());
        for c in &chains {
            assert_eq!(replay_linear(EO_FB_COMPLETE, c), State::SOLVED);
        }
    }

    // ---------- mini_json 深度上限:敌意深嵌套 → 拒绝(回落默认),不 panic ----------

    #[test]
    fn chain_config_json_depth_limit() {
        // ≤64 层可解析;>64 层拒绝;1 万层不栈溢出。
        let ok = format!("{}1{}", "[".repeat(60), "]".repeat(60));
        assert!(mini_json::parse(&ok).is_some());
        let over = format!("{}1{}", "[".repeat(65), "]".repeat(65));
        assert!(mini_json::parse(&over).is_none());
        let hostile = format!("{}1{}", "[".repeat(10_000), "]".repeat(10_000));
        assert!(mini_json::parse(&hostile).is_none());
        // 对象嵌套同限。
        let deep_obj =
            format!("{}1{}", "{\"a\":".repeat(10_000), "}".repeat(10_000));
        assert!(mini_json::parse(&deep_obj).is_none());
        // 配置层:敌意输入整体回落默认配置,不 panic。
        let cfg = parse_chain_config(&hostile);
        assert_eq!(cfg.max_chains, 10);
        assert!(cfg.eo.enabled && !cfg.fr.enabled);
        assert_eq!(cfg.eo.cap, 5);
    }

    // ---------- 固定 fixture 的 JSON 输出(node wasm parity 对照用) ----------

    #[test]
    fn chain_wasm_parity_fixture_print() {
        let s = solver();
        let fr_on = r#"{"fr":{"enabled":true}}"#;
        let niss_off_json =
            r#"{"eo":{"niss":false},"dr":{"niss":false},"htr":{"niss":false},"fr":{"niss":false}}"#;
        for (scr, cfg_json) in [
            (FIX1, "{}"),
            (FIX2, "{}"),
            (FIX1, fr_on),
            (FIX2, fr_on),
            (FIX1, niss_off_json),
            (FIX2, niss_off_json),
        ] {
            let cfg = parse_chain_config(cfg_json);
            let t0 = std::time::Instant::now();
            let json = chain_json(&s.solve_chain(scr, &cfg));
            let ms = t0.elapsed().as_millis();
            assert!(json.starts_with("{\"chains\":[{"), "chains must be nonempty");
            println!("TIMING\t{}\t{}\t{}ms", scr, cfg_json, ms);
            println!("PARITY\t{}\t{}\t{}", scr, cfg_json, json);
        }
        // 哨兵:不可解析打乱 → 空。
        assert_eq!(
            chain_json(&s.solve_chain("xyzzy", &ChainConfig::default())),
            "{\"chains\":[]}"
        );
    }
}
