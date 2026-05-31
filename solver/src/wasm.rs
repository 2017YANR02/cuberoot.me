//! WASM 入口(wasm-bindgen):浏览器内三阶 cross 系列求解
//! (cross / xc / xxc / xxxc / xxxxc),小表可采纳启发式,返回最优步数。
//!
//! 表(.bin 字节)由 JS fetch 后传入构造器,WASM 用 `from_bin` 装进线性内存,
//! 绕过 native 的 mmap / 磁盘 / manager。需要 6 张表:
//!   pt_cross(140KB)、pt_cross_C4E0(52MB)、mt_edge2、mt_edge4、mt_corn、mt_edge。

use std::cell::RefCell;
use std::sync::Arc;

use wasm_bindgen::prelude::*;

use crate::cross_solver::CrossSolver;
use crate::cube_common::{state_space, string_to_alg, MOVE_NAMES};
use crate::eo_cross_solver::EOSmallSolver;
use crate::f2leo_solver::F2leoSolver;
use crate::move_tables::MoveTable;
use crate::pair_solver::PairSolver;
use crate::prune_tables::PackedPruneTable;
use crate::pseudo_f2leo_solver::PseudoF2leoSolver;
use crate::pseudo_pair_solver::PseudoPairSmallSolver;
use crate::pseudo_xcross_solver::PseudoSmallSolver;
use crate::xcross_solver::XCrossSolver;

/// 6 个 cube 视角(哪一面当底)。顺序对应 CSV 后缀 _z0/_z2/_z3/_z1/_x3/_x1。
const ROTS: [&str; 6] = ["", "z2", "z'", "z", "x'", "x"];

/// F2L 槽位标签(对齐 or18:BL=0 BR=1 FR=2 FL=3)。
const SLOT_LABELS: [&str; 4] = ["BL", "BR", "FR", "FL"];

/// 把一条 move 索引路径转成步骤串,带视角前缀(rot 非空时)。
fn fmt_moves(rot: &str, path: &[u8]) -> String {
    let body = path
        .iter()
        .map(|&m| MOVE_NAMES[m as usize])
        .collect::<Vec<_>>()
        .join(" ");
    if rot.is_empty() {
        body
    } else {
        format!("{} {}", rot, body)
    }
}

/// 手搓 JSON(move 串只含字母/数字/'/空格,无需转义):
/// {"len":N,"combo":"BL FR","sols":["...","..."]}
fn sols_json(len: u32, combo: &str, sols: &[String]) -> String {
    let arr = sols
        .iter()
        .map(|s| format!("\"{}\"", s))
        .collect::<Vec<_>>()
        .join(",");
    format!("{{\"len\":{},\"combo\":\"{}\",\"sols\":[{}]}}", len, combo, arr)
}

#[wasm_bindgen]
pub struct CrossSolverWasm {
    cross: CrossSolver,
    xcross: XCrossSolver,
}

#[wasm_bindgen]
impl CrossSolverWasm {
    /// 用 6 张表的 .bin 字节构造(参数名即所需表)。
    #[wasm_bindgen(constructor)]
    pub fn new(
        pt_cross: &[u8],
        pt_cross_c4e0: &[u8],
        mt_edge2: &[u8],
        mt_edge4: &[u8],
        mt_corn: &[u8],
        mt_edge: &[u8],
    ) -> CrossSolverWasm {
        let pt_cross = Arc::new(PackedPruneTable::from_bin(pt_cross));
        let pt_c4e0 = Arc::new(PackedPruneTable::from_bin(pt_cross_c4e0));
        let mt_e2 = Arc::new(MoveTable::from_bin(mt_edge2, state_space::EDGE2 as u32, 18));
        let mt_e4 = Arc::new(MoveTable::from_bin(mt_edge4, state_space::CROSS as u32, 24));
        let mt_c = Arc::new(MoveTable::from_bin(mt_corn, state_space::CORNER as u32, 18));
        let mt_e = Arc::new(MoveTable::from_bin(mt_edge, state_space::EDGE as u32, 18));

        CrossSolverWasm {
            cross: CrossSolver::from_tables(mt_e2, pt_cross),
            xcross: XCrossSolver::from_small_tables(mt_e4, mt_c, mt_e, pt_c4e0),
        }
    }

    /// 单个变体的 6 视角最优步数(Uint32Array,长度 6)。
    /// variant:0=cross,1=xc,2=xxc,3=xxxc,4=xxxxc。
    /// 顺序对应 rot ["","z2","z'","z","x'","x"]。
    pub fn solve(&self, scramble: &str, variant: u32) -> Vec<u32> {
        let alg = string_to_alg(scramble);
        if variant == 0 {
            return self.cross.get_stats(&alg, &ROTS);
        }
        let max_v = (variant.min(4) - 1) as usize; // 1→0(xc) .. 4→3(xxxxc)
        let all = self.xcross.get_stats_small(&alg, &ROTS, max_v);
        let off = max_v * 6;
        all[off..off + 6].to_vec()
    }

    /// 单格步数:某变体在某 face(0..5)的最优步数。UI 逐格流式用,
    /// 避免慢变体(xxxxc)一次算 6 视角干等。
    pub fn solve_face(&self, scramble: &str, variant: u32, face: u32) -> u32 {
        let alg = string_to_alg(scramble);
        let rot = [ROTS[(face as usize).min(5)]];
        if variant == 0 {
            return self.cross.get_stats(&alg, &rot)[0];
        }
        let max_v = (variant.min(4) - 1) as usize;
        let all = self.xcross.get_stats_small(&alg, &rot, max_v);
        all[max_v] // 单 face 时每阶段各 1 值,第 max_v 段即所选变体
    }

    /// 累计变体:一次返回 cross..variant 全部阶段,长度 (variant+1)*6。
    /// 对应 analyzer 的 "cross,x" / "cross,x,xx" / "cross,x,xx,xxx" 选项。
    pub fn solve_cumulative(&self, scramble: &str, variant: u32) -> Vec<u32> {
        let alg = string_to_alg(scramble);
        let mut out = self.cross.get_stats(&alg, &ROTS);
        if variant >= 1 {
            let max_v = (variant.min(4) - 1) as usize;
            let mut xs = self.xcross.get_stats_small(&alg, &ROTS, max_v);
            xs.truncate((max_v + 1) * 6);
            out.extend(xs);
        }
        out
    }

    /// 单格(variant × face)多解步骤,返回 JSON 串。
    /// variant:0=cross,1=xc,2=xxc,3=xxxc,4=xxxxc;face:0..5 对应 ROTS。
    /// extra:允许超出最优的步数(0=只最优长度全部解);cap:最多收集条数。
    /// 解步骤带视角前缀(face>0 时如 "z2 R U ..."),combo 是该格选中的 F2L 槽位。
    pub fn solve_moves(
        &self,
        scramble: &str,
        variant: u32,
        face: u32,
        extra: u32,
        cap: u32,
    ) -> String {
        let alg = string_to_alg(scramble);
        let rot = ROTS[(face as usize).min(5)];
        let cap = cap as usize;
        if variant == 0 {
            let (len, sols) = self.cross.enumerate_solutions(&alg, rot, extra, cap);
            let strs: Vec<String> = sols.iter().map(|p| fmt_moves(rot, p)).collect();
            return sols_json(len, "cross", &strs);
        }
        let k = (variant.min(4)) as usize; // 1..=4 槽
        let (len, combo, sols) = self.xcross.enumerate_best(&alg, rot, k, extra, cap);
        let combo_label = combo
            .iter()
            .map(|&s| SLOT_LABELS[s])
            .collect::<Vec<_>>()
            .join(" ");
        let strs: Vec<String> = sols.iter().map(|p| fmt_moves(rot, p)).collect();
        sols_json(len, &combo_label, &strs)
    }
}

/// F2LEO / Pseudo F2LEO 浏览器内求解(count-only)。小表:复用 mt_edge2/edge4/corn/edge
/// + pt_cross(f2leo),pseudo 另现场建 4-seed cross + D-AUF xcross 剪枝表(~18MB)。
/// 不需要 pt_cross_C4E0 / huge 表。
///
/// **惰性建表**:构造器只存表引用(~0ms),不建剪枝表;首次调到 f2leo / pseudo 时才
/// 各自建一次(~2s,RefCell 缓存)。这样 std-only 的 worker 完全不付这笔钱,且只想看
/// 一个变体时不会顺带建另一个。单线程 wasm 用 RefCell 做内部可变。
#[wasm_bindgen]
pub struct F2leoSolverWasm {
    mt_e2: Arc<MoveTable>,
    mt_e4: Arc<MoveTable>,
    mt_c: Arc<MoveTable>,
    mt_e: Arc<MoveTable>,
    pt_cross: Arc<PackedPruneTable>,
    f2leo: RefCell<Option<F2leoSolver>>,
    pseudo: RefCell<Option<PseudoF2leoSolver>>,
}

#[wasm_bindgen]
impl F2leoSolverWasm {
    /// 5 张表:pt_cross(f2leo cross 剪枝)+ mt_edge2/edge4/corn/edge(两变体共用)。
    /// 仅存引用,不建剪枝表(惰性,见 struct 文档)。
    #[wasm_bindgen(constructor)]
    pub fn new(
        pt_cross: &[u8],
        mt_edge2: &[u8],
        mt_edge4: &[u8],
        mt_corn: &[u8],
        mt_edge: &[u8],
    ) -> F2leoSolverWasm {
        F2leoSolverWasm {
            pt_cross: Arc::new(PackedPruneTable::from_bin(pt_cross)),
            mt_e2: Arc::new(MoveTable::from_bin(mt_edge2, state_space::EDGE2 as u32, 18)),
            mt_e4: Arc::new(MoveTable::from_bin(mt_edge4, state_space::CROSS as u32, 24)),
            mt_c: Arc::new(MoveTable::from_bin(mt_corn, state_space::CORNER as u32, 18)),
            mt_e: Arc::new(MoveTable::from_bin(mt_edge, state_space::EDGE as u32, 18)),
            f2leo: RefCell::new(None),
            pseudo: RefCell::new(None),
        }
    }

    fn ensure_f2leo(&self) {
        if self.f2leo.borrow().is_none() {
            let s = F2leoSolver::from_tables(
                self.mt_e2.clone(),
                self.mt_e4.clone(),
                self.mt_c.clone(),
                self.mt_e.clone(),
                self.pt_cross.clone(),
            );
            *self.f2leo.borrow_mut() = Some(s);
        }
    }

    fn ensure_pseudo(&self) {
        if self.pseudo.borrow().is_none() {
            let s = PseudoF2leoSolver::from_tables(
                self.mt_e2.clone(),
                self.mt_e4.clone(),
                self.mt_c.clone(),
                self.mt_e.clone(),
            );
            *self.pseudo.borrow_mut() = Some(s);
        }
    }

    /// F2LEO 24 值:[cross×6, xcross×6, xxcross×6, xxxcross×6](6 = 已折叠 z0/z2/z3/z1/x3/x1)。
    pub fn solve_f2leo(&self, scramble: &str) -> Vec<u32> {
        self.ensure_f2leo();
        self.f2leo.borrow().as_ref().unwrap().get_stats(&string_to_alg(scramble))
    }

    /// Pseudo F2LEO 24 值,顺序同上。
    pub fn solve_pseudo_f2leo(&self, scramble: &str) -> Vec<u32> {
        self.ensure_pseudo();
        self.pseudo.borrow().as_ref().unwrap().get_stats(&string_to_alg(scramble))
    }

    /// 单阶段 6 值(stage 0=cross/1=xc/2=xxc/3=xxxc)。cross 极快 → UI 先单算 cross 秒出,
    /// 深阶段后台补。pseudo=true 走伪变体。
    pub fn solve_f2leo_stage(&self, scramble: &str, pseudo: bool, stage: u32) -> Vec<u32> {
        let alg = string_to_alg(scramble);
        let st = stage.min(3) as usize;
        if pseudo {
            self.ensure_pseudo();
            self.pseudo.borrow().as_ref().unwrap().get_stage(&alg, st)
        } else {
            self.ensure_f2leo();
            self.f2leo.borrow().as_ref().unwrap().get_stage(&alg, st)
        }
    }
}

/// 其余 comp 变体的浏览器小表求解(count-only,逐格 bit-exact 对照大表/huge 路径)。
/// pair / eo / pseudo / pseudo_pair —— 各自 native analyzer 用 ~10GB+ huge 表「联合」
/// 验证多槽是否解出,wasm 装不下;这里复用各 solver 的 `*_small` cascade:显式逐槽
/// 追踪 + per-slot 小表(pt_cross_C4E0 等)既作可采纳下界又作 goal 验证,IDA* 首达即最优。
/// 惰性按变体建(RefCell),只想看一个变体不顺带建别的。
///
/// variant 编号:0=pair,1=eo,2=pseudo,3=pseudo_pair(后三个待接)。
#[wasm_bindgen]
pub struct VariantSolverWasm {
    // pair 用
    pt_cross_c4e0: Arc<PackedPruneTable>,
    pt_cross_ins_c4: Arc<PackedPruneTable>,
    pt_pair_c4e0: Arc<PackedPruneTable>,
    mt_e4: Arc<MoveTable>,
    mt_c: Arc<MoveTable>,
    mt_e: Arc<MoveTable>,
    // eo 另用
    pt_cross: Arc<PackedPruneTable>,
    pt_ep4eo12: Arc<PackedPruneTable>,
    mt_e2: Arc<MoveTable>,
    mt_eo12: Arc<MoveTable>,
    mt_eo12_alt: Arc<MoveTable>,
    mt_ep4: Arc<MoveTable>,
    // pseudo 另用(cross+corner 剪枝在 from_tables 内 BFS 现建,~185ms)
    pt_pscross: Arc<PackedPruneTable>,
    pair: RefCell<Option<PairSolver>>,
    eo: RefCell<Option<EOSmallSolver>>,
    pseudo: RefCell<Option<PseudoSmallSolver>>,
    pseudo_pair: RefCell<Option<PseudoPairSmallSolver>>,
}

#[wasm_bindgen]
impl VariantSolverWasm {
    /// 12 表:pair 用 mt_edge4/corn/edge + pt_cross_ins_C4 + pt_pair_C4E0 + pt_cross_C4E0;
    /// eo 另用 pt_cross + pt_ep4eo12 + mt_edge2 + mt_eo12 + mt_eo12_alt + mt_ep4。
    /// 仅存引用,惰性建 solver。(pseudo / pseudo_pair 接入时再扩。)
    #[wasm_bindgen(constructor)]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        pt_cross_c4e0: &[u8],
        pt_cross_ins_c4: &[u8],
        pt_pair_c4e0: &[u8],
        mt_edge4: &[u8],
        mt_corn: &[u8],
        mt_edge: &[u8],
        pt_cross: &[u8],
        pt_ep4eo12: &[u8],
        mt_edge2: &[u8],
        mt_eo12: &[u8],
        mt_eo12_alt: &[u8],
        mt_ep4: &[u8],
        pt_pscross: &[u8],
    ) -> VariantSolverWasm {
        VariantSolverWasm {
            pt_cross_c4e0: Arc::new(PackedPruneTable::from_bin(pt_cross_c4e0)),
            pt_cross_ins_c4: Arc::new(PackedPruneTable::from_bin(pt_cross_ins_c4)),
            pt_pair_c4e0: Arc::new(PackedPruneTable::from_bin(pt_pair_c4e0)),
            mt_e4: Arc::new(MoveTable::from_bin(mt_edge4, state_space::CROSS as u32, 24)),
            mt_c: Arc::new(MoveTable::from_bin(mt_corn, state_space::CORNER as u32, 18)),
            mt_e: Arc::new(MoveTable::from_bin(mt_edge, state_space::EDGE as u32, 18)),
            pt_cross: Arc::new(PackedPruneTable::from_bin(pt_cross)),
            pt_ep4eo12: Arc::new(PackedPruneTable::from_bin(pt_ep4eo12)),
            mt_e2: Arc::new(MoveTable::from_bin(mt_edge2, state_space::EDGE2 as u32, 18)),
            mt_eo12: Arc::new(MoveTable::from_bin(mt_eo12, state_space::EO12 as u32, 18)),
            mt_eo12_alt: Arc::new(MoveTable::from_bin(mt_eo12_alt, state_space::EO12 as u32, 18)),
            mt_ep4: Arc::new(MoveTable::from_bin(mt_ep4, state_space::EP4 as u32, 18)),
            pt_pscross: Arc::new(PackedPruneTable::from_bin(pt_pscross)),
            pair: RefCell::new(None),
            eo: RefCell::new(None),
            pseudo: RefCell::new(None),
            pseudo_pair: RefCell::new(None),
        }
    }

    fn ensure_pair(&self) {
        if self.pair.borrow().is_none() {
            let s = PairSolver::from_tables(
                self.mt_e4.clone(),
                self.mt_c.clone(),
                self.mt_e.clone(),
                self.pt_cross_ins_c4.clone(),
                self.pt_pair_c4e0.clone(),
                self.pt_cross_c4e0.clone(),
            );
            *self.pair.borrow_mut() = Some(s);
        }
    }

    fn ensure_eo(&self) {
        if self.eo.borrow().is_none() {
            let s = EOSmallSolver::from_tables(
                self.mt_e2.clone(),
                self.mt_eo12.clone(),
                self.pt_cross.clone(),
                self.mt_e4.clone(),
                self.mt_c.clone(),
                self.mt_e.clone(),
                self.mt_ep4.clone(),
                self.mt_eo12_alt.clone(),
                self.pt_cross_c4e0.clone(),
                self.pt_ep4eo12.clone(),
            );
            *self.eo.borrow_mut() = Some(s);
        }
    }

    fn ensure_pseudo(&self) {
        if self.pseudo.borrow().is_none() {
            let s = PseudoSmallSolver::from_tables(
                self.mt_e2.clone(),
                self.mt_e4.clone(),
                self.mt_c.clone(),
                self.mt_e.clone(),
                self.pt_pscross.clone(),
            );
            *self.pseudo.borrow_mut() = Some(s);
        }
    }

    fn ensure_pseudo_pair(&self) {
        if self.pseudo_pair.borrow().is_none() {
            let s = PseudoPairSmallSolver::from_tables(
                self.mt_e4.clone(),
                self.mt_c.clone(),
                self.mt_e.clone(),
            );
            *self.pseudo_pair.borrow_mut() = Some(s);
        }
    }

    /// 整变体 24(pair/pseudo/pseudo_pair,4 阶段)/ 30(eo,5 阶段)值 × 6 视角(物理面序 z0/z2/z3/z1/x3/x1)。
    pub fn solve(&self, scramble: &str, variant: u32) -> Vec<u32> {
        let alg = string_to_alg(scramble);
        match variant {
            0 => {
                self.ensure_pair();
                self.pair.borrow().as_ref().unwrap().get_stats_small(&alg, &ROTS)
            }
            1 => {
                self.ensure_eo();
                self.eo.borrow().as_ref().unwrap().eo_get_stats_small(&alg)
            }
            2 => {
                self.ensure_pseudo();
                self.pseudo.borrow().as_ref().unwrap().pseudo_get_stats_small(&alg)
            }
            3 => {
                self.ensure_pseudo_pair();
                self.pseudo_pair.borrow().as_ref().unwrap().pseudo_pair_get_stats_small(&alg)
            }
            _ => vec![0; 24],
        }
    }

    /// 单阶段 6 值。两遍 UI:先 cross(stage 0)秒出,深阶段后台补。
    pub fn solve_stage(&self, scramble: &str, variant: u32, stage: u32) -> Vec<u32> {
        let alg = string_to_alg(scramble);
        match variant {
            0 => {
                self.ensure_pair();
                self.pair
                    .borrow()
                    .as_ref()
                    .unwrap()
                    .get_stage_small(&alg, &ROTS, stage as usize)
            }
            1 => {
                self.ensure_eo();
                self.eo.borrow().as_ref().unwrap().eo_get_stage_small(&alg, stage as usize)
            }
            2 => {
                self.ensure_pseudo();
                self.pseudo
                    .borrow()
                    .as_ref()
                    .unwrap()
                    .pseudo_get_stage_small(&alg, stage as usize)
            }
            3 => {
                self.ensure_pseudo_pair();
                self.pseudo_pair
                    .borrow()
                    .as_ref()
                    .unwrap()
                    .pseudo_pair_get_stage_small(&alg, stage as usize)
            }
            _ => vec![0; 6],
        }
    }

    /// 单格(variant × stage × face)多解步骤,返回 JSON 串(同 CrossSolverWasm::solve_moves 形状
    /// {"len","combo","sols"})。variant:0=pair,1=eo,2=pseudo,3=pseudo_pair;stage:0=cross 系起。
    /// extra:超出最优的步数(0=只最优长度全部解);cap:最多收集条数。
    /// 步骤带视角前缀:多数变体即 ROTS[face];**eo** 因破坏 y 对称,最优可能只在 rot·y 帧达成,
    /// 故前缀用 enumerate_small 返回的真实帧(可能形如 "x' y",含两个旋转 token)。
    pub fn solve_moves(
        &self,
        scramble: &str,
        variant: u32,
        face: u32,
        stage: u32,
        extra: u32,
        cap: u32,
    ) -> String {
        let alg = string_to_alg(scramble);
        let rot = ROTS[(face as usize).min(5)];
        let stage = stage as usize;
        let cap = cap as usize;
        let label = |combo: &[usize]| {
            combo
                .iter()
                .map(|&s| SLOT_LABELS[s.min(3)])
                .collect::<Vec<_>>()
                .join(" ")
        };
        match variant {
            0 => {
                self.ensure_pair();
                let b = self.pair.borrow();
                let (len, combo, sols) =
                    b.as_ref().unwrap().enumerate_small(&alg, rot, stage, extra, cap);
                let strs: Vec<String> = sols.iter().map(|p| fmt_moves(rot, p)).collect();
                sols_json(len, &label(&combo), &strs)
            }
            1 => {
                self.ensure_eo();
                let b = self.eo.borrow();
                let (len, frame, combo, sols) =
                    b.as_ref().unwrap().enumerate_small(&alg, rot, stage, extra, cap);
                let strs: Vec<String> = sols.iter().map(|p| fmt_moves(&frame, p)).collect();
                sols_json(len, &label(&combo), &strs)
            }
            2 => {
                self.ensure_pseudo();
                let b = self.pseudo.borrow();
                let (len, combo, sols) =
                    b.as_ref().unwrap().enumerate_small(&alg, rot, stage, extra, cap);
                let strs: Vec<String> = sols.iter().map(|p| fmt_moves(rot, p)).collect();
                sols_json(len, &label(&combo), &strs)
            }
            3 => {
                self.ensure_pseudo_pair();
                let b = self.pseudo_pair.borrow();
                let (len, combo, sols) =
                    b.as_ref().unwrap().enumerate_small(&alg, rot, stage, extra, cap);
                let strs: Vec<String> = sols.iter().map(|p| fmt_moves(rot, p)).collect();
                sols_json(len, &label(&combo), &strs)
            }
            _ => sols_json(0, "", &[]),
        }
    }
}
