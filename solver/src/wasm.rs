//! WASM 入口(wasm-bindgen):浏览器内三阶 cross 系列求解
//! (cross / xc / xxc / xxxc / xxxxc),小表可采纳启发式,返回最优步数。
//!
//! 表(.bin 字节)由 JS fetch 后传入构造器,WASM 用 `from_bin` 装进线性内存,
//! 绕过 native 的 mmap / 磁盘 / manager。需要 6 张表:
//!   pt_cross(140KB)、pt_cross_C4E0(52MB)、mt_edge2、mt_edge4、mt_corn、mt_edge。

use std::cell::RefCell;
use std::sync::Arc;

use wasm_bindgen::prelude::*;

use crate::block222_solver::{block_label, Block222Solver, Y_NAMES};
use crate::block223_solver::{block223_label, Block223Solver};
use crate::cross_solver::CrossSolver;
use crate::cube_common::{state_space, string_to_alg, MOVE_NAMES};
use crate::dr_solver::{dr_axis_label, DrSolver};
use crate::eo_cross_solver::EOSmallSolver;
use crate::eoline_solver::{eo_axis_label, eoline_label, EOLineSolver};
use crate::f2b_solver::{f2b_label, F2BSolver};
use crate::f2leo_solver::F2leoSolver;
use crate::fr_solver::FrSolver;
use crate::htr_phase2_solver::HtrPhase2Solver;
use crate::htr_solver::HtrSolver;
use crate::move_tables::MoveTable;
use crate::pair_solver::PairSolver;
use crate::prune_tables::PackedPruneTable;
use crate::pseudo_f2leo_solver::PseudoF2leoSolver;
use crate::pseudo_pair_solver::PseudoPairSmallSolver;
use crate::pseudo_xcross_solver::PseudoSmallSolver;
use crate::roux_s1_solver::{s1_block_label, square_label, FbSquareSolver, RouxS1Solver};
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

/// 手搓 JSON(move 串/槽位标签只含字母/数字/'/空格,无需转义)。每条解带自己的槽位 `c`
/// (并列最优时不同条可能是不同槽);cross 等无槽阶段 `c` 为空串:
/// {"len":N,"sols":[{"m":"R U R'","c":"FR"},{"m":"...","c":"FL"}]}
fn sols_json(len: u32, sols: &[(String, String)]) -> String {
    let arr = sols
        .iter()
        .map(|(m, c)| format!("{{\"m\":\"{}\",\"c\":\"{}\"}}", m, c))
        .collect::<Vec<_>>()
        .join(",");
    format!("{{\"len\":{},\"sols\":[{}]}}", len, arr)
}

/// 2x2x2 块求解(1 角 + 3 棱)。表最小:mt_edge3 (~743KB) + mt_corn (~1.7KB),
/// 全空间精确距离表构造时现场 BFS(253,440 态,毫秒级)——查长度 O(1),枚举首达即最优。
/// 每视角 = 该底色 4 个贴底块;解前缀 = rot + y^k,`c` = 块标签(URF..DRB)。
#[wasm_bindgen]
pub struct Block222SolverWasm {
    solver: Block222Solver,
}

#[wasm_bindgen]
impl Block222SolverWasm {
    #[wasm_bindgen(constructor)]
    pub fn new(mt_edge3: &[u8], mt_corn: &[u8]) -> Block222SolverWasm {
        let mt_e3 = Arc::new(MoveTable::from_bin(mt_edge3, state_space::EDGE3 as u32, 18));
        let mt_c = Arc::new(MoveTable::from_bin(mt_corn, state_space::CORNER as u32, 18));
        Block222SolverWasm {
            solver: Block222Solver::from_tables(mt_e3, mt_c),
        }
    }

    /// 6 视角最优步数(每视角 = 4 贴底块最小),顺序对应 ROTS。
    pub fn solve(&self, scramble: &str) -> Vec<u32> {
        let alg = string_to_alg(scramble);
        self.solver.get_stats(&alg, &ROTS)
    }

    /// 单视角(face 0..5)最优步数。
    pub fn solve_face(&self, scramble: &str, face: u32) -> u32 {
        let alg = string_to_alg(scramble);
        self.solver.get_stats(&alg, &[ROTS[(face as usize).min(5)]])[0]
    }

    /// 单视角多解 JSON(同 CrossSolverWasm::solve_moves 形状)。4 个贴底块合并枚举,
    /// 按长度排序;`m` 前缀 = rot + y^k(1~2 个旋转 token),`c` = 块标签。
    pub fn solve_moves(&self, scramble: &str, face: u32, extra: u32, cap: u32) -> String {
        let alg = string_to_alg(scramble);
        let fi = (face as usize).min(5);
        let rot = ROTS[fi];
        let (len, sols) = self.solver.enumerate_face(&alg, rot, extra, cap as usize);
        let items: Vec<(String, String)> = sols
            .iter()
            .map(|s| {
                let y = Y_NAMES[s.yk];
                let frame = if rot.is_empty() {
                    y.to_string()
                } else if y.is_empty() {
                    rot.to_string()
                } else {
                    format!("{} {}", rot, y)
                };
                (fmt_moves(&frame, &s.moves), block_label(fi, s.yk).to_string())
            })
            .collect();
        sols_json(len, &items)
    }
}

/// Roux 第一块(方块 / 1x2x3 / 双 1x2x3)+ Petrus(2x2x2 / 2x2x3)组合求解器。4 张小表:
/// mt_edge3 (~743KB) + mt_corn2 (~36KB) + mt_edge2 (~38KB) + mt_corn (~1.7KB)。
/// FB 方块与 2x2x2 全表构造时即建(微型/毫秒级);1x2x3 全表(5,322,240 态)与
/// 2x2x3 启发式表惰性构建(首次相关查询现场 BFS,~秒级);2x2x3 与 f2b 共享 1x2x3 表
/// (f2b 零额外构建:同一张表 y2 共轭双查 IDA*)。
/// stage 编号:0=FB 方块 1=1x2x3 2=2x2x2 3=2x2x3 4=双 1x2x3(f2b)。
#[wasm_bindgen]
pub struct Roux223SolverWasm {
    mt_e3: Arc<MoveTable>,
    mt_c2: Arc<MoveTable>,
    mt_e2: Arc<MoveTable>,
    fbsq: FbSquareSolver,
    b222: Block222Solver,
    s1: RefCell<Option<RouxS1Solver>>,
    b223: RefCell<Option<Block223Solver>>,
    f2b: RefCell<Option<F2BSolver>>,
}

#[wasm_bindgen]
impl Roux223SolverWasm {
    #[wasm_bindgen(constructor)]
    pub fn new(
        mt_edge3: &[u8],
        mt_corn2: &[u8],
        mt_edge2: &[u8],
        mt_corn: &[u8],
    ) -> Roux223SolverWasm {
        let mt_e3 = Arc::new(MoveTable::from_bin(mt_edge3, state_space::EDGE3 as u32, 18));
        let mt_c2 = Arc::new(MoveTable::from_bin(mt_corn2, state_space::CORNER2 as u32, 18));
        let mt_e2 = Arc::new(MoveTable::from_bin(mt_edge2, state_space::EDGE2 as u32, 18));
        let mt_c = Arc::new(MoveTable::from_bin(mt_corn, state_space::CORNER as u32, 18));
        Roux223SolverWasm {
            fbsq: FbSquareSolver::from_tables(mt_c.clone(), mt_e2.clone()),
            b222: Block222Solver::from_tables(mt_e3.clone(), mt_c),
            s1: RefCell::new(None),
            b223: RefCell::new(None),
            f2b: RefCell::new(None),
            mt_e3,
            mt_c2,
            mt_e2,
        }
    }

    fn ensure_s1(&self) {
        if self.s1.borrow().is_none() {
            *self.s1.borrow_mut() =
                Some(RouxS1Solver::from_tables(self.mt_c2.clone(), self.mt_e3.clone()));
        }
    }

    fn ensure_223(&self) {
        self.ensure_s1();
        if self.b223.borrow().is_none() {
            let s1 = self.s1.borrow().as_ref().unwrap().clone();
            *self.b223.borrow_mut() = Some(Block223Solver::from_s1(s1, self.mt_e2.clone()));
        }
    }

    fn ensure_f2b(&self) {
        self.ensure_s1();
        if self.f2b.borrow().is_none() {
            let s1 = self.s1.borrow().as_ref().unwrap().clone();
            *self.f2b.borrow_mut() = Some(F2BSolver::from_s1(s1));
        }
    }

    /// 单阶段 6 视角(stage 0=FB方块 1=1x2x3 2=2x2x2 3=2x2x3 4=双1x2x3),顺序对应 ROTS。
    pub fn solve_stage(&self, scramble: &str, stage: u32) -> Vec<u32> {
        let alg = string_to_alg(scramble);
        match stage {
            0 => self.fbsq.get_stats(&alg, &ROTS),
            1 => {
                self.ensure_s1();
                self.s1.borrow().as_ref().unwrap().get_stats(&alg, &ROTS)
            }
            2 => self.b222.get_stats(&alg, &ROTS),
            4 => {
                self.ensure_f2b();
                self.f2b.borrow().as_ref().unwrap().get_stats(&alg, &ROTS)
            }
            _ => {
                self.ensure_223();
                self.b223.borrow().as_ref().unwrap().get_stats(&alg, &ROTS)
            }
        }
    }

    /// 单视角多解 JSON(同 Block222SolverWasm::solve_moves 形状)。`m` 前缀 =
    /// rot + y^k;`c` = 目标标签(方块 "DBL-L" / 1x2x3 "DL" / 2x2x2 角名 / 2x2x3 棱名 /
    /// f2b "D(LR)" 块对)。
    pub fn solve_moves(&self, scramble: &str, stage: u32, face: u32, extra: u32, cap: u32) -> String {
        let alg = string_to_alg(scramble);
        let fi = (face as usize).min(5);
        let rot = ROTS[fi];
        let frame = |yk: usize| -> String {
            let y = Y_NAMES[yk];
            if rot.is_empty() {
                y.to_string()
            } else if y.is_empty() {
                rot.to_string()
            } else {
                format!("{} {}", rot, y)
            }
        };
        let (len, items): (u32, Vec<(String, String)>) = match stage {
            0 => {
                let (len, sols) = self.fbsq.enumerate_face(&alg, rot, extra, cap as usize);
                (
                    len,
                    sols.iter()
                        .map(|s| {
                            (
                                fmt_moves(&frame(s.yk), &s.moves),
                                square_label(fi, s.yk, s.which).to_string(),
                            )
                        })
                        .collect(),
                )
            }
            1 => {
                self.ensure_s1();
                let b = self.s1.borrow();
                let (len, sols) = b.as_ref().unwrap().enumerate_face(&alg, rot, extra, cap as usize);
                (
                    len,
                    sols.iter()
                        .map(|s| {
                            (
                                fmt_moves(&frame(s.yk), &s.moves),
                                s1_block_label(fi, s.yk).to_string(),
                            )
                        })
                        .collect(),
                )
            }
            2 => {
                let (len, sols) = self.b222.enumerate_face(&alg, rot, extra, cap as usize);
                (
                    len,
                    sols.iter()
                        .map(|s| {
                            (
                                fmt_moves(&frame(s.yk), &s.moves),
                                block_label(fi, s.yk).to_string(),
                            )
                        })
                        .collect(),
                )
            }
            4 => {
                self.ensure_f2b();
                let b = self.f2b.borrow();
                let (len, sols) = b.as_ref().unwrap().enumerate_face(&alg, rot, extra, cap as usize);
                (
                    len,
                    sols.iter()
                        .map(|s| {
                            (
                                fmt_moves(&frame(s.yk), &s.moves),
                                f2b_label(fi, s.yk).to_string(),
                            )
                        })
                        .collect(),
                )
            }
            _ => {
                self.ensure_223();
                let b = self.b223.borrow();
                let (len, sols) = b.as_ref().unwrap().enumerate_face(&alg, rot, extra, cap as usize);
                (
                    len,
                    sols.iter()
                        .map(|s| {
                            (
                                fmt_moves(&frame(s.yk), &s.moves),
                                block223_label(fi, s.yk).to_string(),
                            )
                        })
                        .collect(),
                )
            }
        };
        sols_json(len, &items)
    }
}

/// EOLine / DR 求解器(全自包含,**零表下载**):eo12/line/co8/slice 微 move 表与
/// 全部距离表现场从内置运动学构建。EOLine 即时构建(~1MB BFS);DR 惰性
/// (两张 ~1M 距离表,首次查询时建)。
/// stage 编号:0=EO 1=EOLine 2=DR。
#[wasm_bindgen]
pub struct EoDrSolverWasm {
    eoline: EOLineSolver,
    dr: RefCell<Option<DrSolver>>,
}

#[wasm_bindgen]
impl EoDrSolverWasm {
    #[wasm_bindgen(constructor)]
    #[allow(clippy::new_without_default)]
    pub fn new() -> EoDrSolverWasm {
        EoDrSolverWasm {
            eoline: EOLineSolver::new(),
            dr: RefCell::new(None),
        }
    }

    fn ensure_dr(&self) {
        if self.dr.borrow().is_none() {
            *self.dr.borrow_mut() = Some(DrSolver::new());
        }
    }

    /// 单阶段 6 视角(stage 0=EO 1=EOLine 2=DR),顺序对应 ROTS。
    /// EO/DR 只依赖轴:对面底色列天然同值。
    pub fn solve_stage(&self, scramble: &str, stage: u32) -> Vec<u32> {
        let alg = string_to_alg(scramble);
        match stage {
            0 => self.eoline.get_stats_eo(&alg, &ROTS),
            1 => self.eoline.get_stats(&alg, &ROTS),
            _ => {
                self.ensure_dr();
                self.dr.borrow().as_ref().unwrap().get_stats(&alg, &ROTS)
            }
        }
    }

    /// 单视角多解 JSON(同 Block222SolverWasm::solve_moves 形状)。`m` 前缀 =
    /// rot + y^k;`c` = 目标标签(EO 轴 "FB" / EOLine "D(FB)" / DR 轴 "UD")。
    pub fn solve_moves(&self, scramble: &str, stage: u32, face: u32, extra: u32, cap: u32) -> String {
        let alg = string_to_alg(scramble);
        let fi = (face as usize).min(5);
        let rot = ROTS[fi];
        let frame = |yk: usize| -> String {
            let y = Y_NAMES[yk];
            if rot.is_empty() {
                y.to_string()
            } else if y.is_empty() {
                rot.to_string()
            } else {
                format!("{} {}", rot, y)
            }
        };
        let (len, items): (u32, Vec<(String, String)>) = match stage {
            0 | 1 => {
                let (len, sols) =
                    self.eoline
                        .enumerate_face(&alg, rot, stage as usize, extra, cap as usize);
                (
                    len,
                    sols.iter()
                        .map(|s| {
                            let label = if stage == 0 {
                                eo_axis_label(fi, s.yk)
                            } else {
                                eoline_label(fi, s.yk)
                            };
                            (fmt_moves(&frame(s.yk), &s.moves), label.to_string())
                        })
                        .collect(),
                )
            }
            _ => {
                self.ensure_dr();
                let b = self.dr.borrow();
                let (len, sols) = b.as_ref().unwrap().enumerate_face(&alg, rot, extra, cap as usize);
                (
                    len,
                    sols.iter()
                        .map(|s| {
                            (
                                fmt_moves(&frame(s.yk), &s.moves),
                                dr_axis_label(fi, s.yk).to_string(),
                            )
                        })
                        .collect(),
                )
            }
        };
        sols_json(len, &items)
    }
}

/// HTR(Thistlethwaite DR→HTR)求解器(全自包含,**零表下载**):角置换/轨道移动表与
/// 全空间 2,822,400 态精确距离表(~2.8MB)全部现场从内置运动学构建,首次查询时惰性 BFS
/// (RefCell,~秒级);查长度 O(1),枚举首达即最优。条件式阶段:该视角(UD 轴)必须已
/// 处于 DR,非 DR 视角返回 u32::MAX 哨兵。HTR 仅依赖轴:对面底色同值,且对 y 不变。
#[wasm_bindgen]
pub struct HtrSolverWasm {
    htr: RefCell<Option<HtrSolver>>,
}

#[wasm_bindgen]
impl HtrSolverWasm {
    #[wasm_bindgen(constructor)]
    #[allow(clippy::new_without_default)]
    pub fn new() -> HtrSolverWasm {
        HtrSolverWasm { htr: RefCell::new(None) }
    }

    fn ensure(&self) {
        if self.htr.borrow().is_none() {
            *self.htr.borrow_mut() = Some(HtrSolver::new());
        }
    }

    /// 6 视角最优步数(顺序对应 ROTS);该视角非 DR = u32::MAX 哨兵。
    pub fn solve(&self, scramble: &str) -> Vec<u32> {
        self.ensure();
        let alg = string_to_alg(scramble);
        let b = self.htr.borrow();
        b.as_ref()
            .unwrap()
            .get_stats(&alg, &ROTS)
            .into_iter()
            .map(|v| v.unwrap_or(u32::MAX))
            .collect()
    }

    /// 单视角多解 JSON(同 Block222SolverWasm::solve_moves 形状)。HTR 对 y 不变
    /// (解全在 yk=0),`m` 前缀 = rot,`c` = 轴标签(同 DR,如 "UD");
    /// 该视角非 DR = {"len":4294967295,"sols":[]}。
    pub fn solve_moves(&self, scramble: &str, face: u32, extra: u32, cap: u32) -> String {
        self.ensure();
        let alg = string_to_alg(scramble);
        let fi = (face as usize).min(5);
        let rot = ROTS[fi];
        let b = self.htr.borrow();
        match b.as_ref().unwrap().enumerate_face(&alg, rot, extra, cap as usize) {
            Some((len, sols)) => {
                let items: Vec<(String, String)> = sols
                    .iter()
                    .map(|s| (fmt_moves(rot, &s.moves), dr_axis_label(fi, 0).to_string()))
                    .collect();
                sols_json(len, &items)
            }
            None => sols_json(u32::MAX, &[]),
        }
    }
}

/// HTR phase-2(G3 → solved,只走 6 双转)求解器(全自包含,**零表下载**):角置换/边轨道
/// 移动表与全空间 663,552 态精确距离表(~648KB)全部现场从内置运动学构建,首次查询时惰性
/// BFS(RefCell,~亚秒);查长度 O(1),枚举首达即最优。条件式阶段:该视角必须已处于 HTR/G3
/// 子群,非 HTR 视角返回 u32::MAX 哨兵。对 y 不变。
#[wasm_bindgen]
pub struct HtrPhase2SolverWasm {
    htr2: RefCell<Option<HtrPhase2Solver>>,
}

#[wasm_bindgen]
impl HtrPhase2SolverWasm {
    #[wasm_bindgen(constructor)]
    #[allow(clippy::new_without_default)]
    pub fn new() -> HtrPhase2SolverWasm {
        HtrPhase2SolverWasm { htr2: RefCell::new(None) }
    }

    fn ensure(&self) {
        if self.htr2.borrow().is_none() {
            *self.htr2.borrow_mut() = Some(HtrPhase2Solver::new());
        }
    }

    /// 6 视角最优步数(顺序对应 ROTS);该视角非 HTR = u32::MAX 哨兵。
    pub fn solve(&self, scramble: &str) -> Vec<u32> {
        self.ensure();
        let alg = string_to_alg(scramble);
        let b = self.htr2.borrow();
        b.as_ref()
            .unwrap()
            .get_stats(&alg, &ROTS)
            .into_iter()
            .map(|v| v.unwrap_or(u32::MAX))
            .collect()
    }

    /// 单视角多解 JSON(同 HtrSolverWasm::solve_moves 形状)。HTR phase-2 对 y 不变
    /// (解全在 yk=0),`m` 前缀 = rot,`c` = 轴标签(同 DR,如 "UD");
    /// 该视角非 HTR = {"len":4294967295,"sols":[]}。
    pub fn solve_moves(&self, scramble: &str, face: u32, extra: u32, cap: u32) -> String {
        self.ensure();
        let alg = string_to_alg(scramble);
        let fi = (face as usize).min(5);
        let rot = ROTS[fi];
        let b = self.htr2.borrow();
        match b.as_ref().unwrap().enumerate_face(&alg, rot, extra, cap as usize) {
            Some((len, sols)) => {
                let items: Vec<(String, String)> = sols
                    .iter()
                    .map(|s| (fmt_moves(rot, &s.moves), dr_axis_label(fi, 0).to_string()))
                    .collect();
                sols_json(len, &items)
            }
            None => sols_json(u32::MAX, &[]),
        }
    }
}

/// FR(Floppy Reduction,HTR/G3 → FR)求解器(全自包含,**零表下载**):H=⟨L2,R2,F2,B2⟩
/// 右陪集空间(3456 态)移动表 + 精确距离表全部现场从内置运动学构建,首次查询时惰性
/// BFS(RefCell,~秒级);查长度 O(1),枚举首达即最优。条件式阶段:该视角必须已处于
/// HTR/G3 子群,非 HTR 视角返回 u32::MAX 哨兵。对 y 不变;视角轴 = [UD,UD,LR,LR,FB,FB]。
#[wasm_bindgen]
pub struct FrSolverWasm {
    fr: RefCell<Option<FrSolver>>,
}

#[wasm_bindgen]
impl FrSolverWasm {
    #[wasm_bindgen(constructor)]
    #[allow(clippy::new_without_default)]
    pub fn new() -> FrSolverWasm {
        FrSolverWasm { fr: RefCell::new(None) }
    }

    fn ensure(&self) {
        if self.fr.borrow().is_none() {
            *self.fr.borrow_mut() = Some(FrSolver::new());
        }
    }

    /// 6 视角最优步数(顺序对应 ROTS);该视角非 HTR = u32::MAX 哨兵。
    pub fn solve(&self, scramble: &str) -> Vec<u32> {
        self.ensure();
        let alg = string_to_alg(scramble);
        let b = self.fr.borrow();
        b.as_ref()
            .unwrap()
            .get_stats(&alg, &ROTS)
            .into_iter()
            .map(|v| v.unwrap_or(u32::MAX))
            .collect()
    }

    /// 单视角多解 JSON(同 HtrPhase2SolverWasm::solve_moves 形状)。FR 对 y 不变
    /// (解全在 yk=0),`m` 前缀 = rot,`c` = 该视角 FR 轴标签(UD/FB/LR,同 DR);
    /// 该视角非 HTR = {"len":4294967295,"sols":[]}。
    pub fn solve_moves(&self, scramble: &str, face: u32, extra: u32, cap: u32) -> String {
        self.ensure();
        let alg = string_to_alg(scramble);
        let fi = (face as usize).min(5);
        let rot = ROTS[fi];
        let b = self.fr.borrow();
        match b.as_ref().unwrap().enumerate_face(&alg, rot, extra, cap as usize) {
            Some((len, sols)) => {
                let items: Vec<(String, String)> = sols
                    .iter()
                    .map(|s| (fmt_moves(rot, &s.moves), dr_axis_label(fi, 0).to_string()))
                    .collect();
                sols_json(len, &items)
            }
            None => sols_json(u32::MAX, &[]),
        }
    }
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
            // cross 无槽位:c 留空串。
            let (len, sols) = self.cross.enumerate_solutions(&alg, rot, extra, cap);
            let items: Vec<(String, String)> =
                sols.iter().map(|p| (fmt_moves(rot, p), String::new())).collect();
            return sols_json(len, &items);
        }
        let k = (variant.min(4)) as usize; // 1..=4 槽
        // 每条解带自己的槽位组合(并列最优时含多个不同槽)。
        let label = |combo: &[usize]| {
            combo.iter().map(|&s| SLOT_LABELS[s]).collect::<Vec<_>>().join(" ")
        };
        let (len, sols) = self.xcross.enumerate_best(&alg, rot, k, extra, cap);
        let items: Vec<(String, String)> =
            sols.iter().map(|(combo, p)| (fmt_moves(rot, p), label(combo))).collect();
        sols_json(len, &items)
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

    /// 单格(F2LEO/Pseudo F2LEO × stage × face)多解步骤,返回 JSON {"len","combo","sols"}。
    /// pseudo=false → F2LEO,true → Pseudo F2LEO;两者破坏 y 对称(同 eo),最优可能只在 rot·y
    /// 帧达成,故步骤前缀用 enumerate_small 返回的真实帧(可能含尾 y,如 "x' y")。
    /// stage:0=cross/1=xc/2=xxc/3=xxxc;extra:超出最优步数(0=只最优长度全部解);cap:最多条数。
    pub fn solve_moves(
        &self,
        scramble: &str,
        pseudo: bool,
        face: u32,
        stage: u32,
        extra: u32,
        cap: u32,
    ) -> String {
        let alg = string_to_alg(scramble);
        let rot = ROTS[(face as usize).min(5)];
        let stage = stage.min(3) as usize;
        let cap = cap as usize;
        let label = |combo: &[usize]| {
            combo
                .iter()
                .map(|&s| SLOT_LABELS[s.min(3)])
                .collect::<Vec<_>>()
                .join(" ")
        };
        // enumerate_small 现返回 (best_len, Vec<(frame, combo, sol)>):每条解带自己的 frame + 槽位
        // (并列最优可能跨不同槽 / 不同 y-frame)。
        let (len, raw) = if pseudo {
            self.ensure_pseudo();
            let b = self.pseudo.borrow();
            b.as_ref().unwrap().enumerate_small(&alg, rot, stage, extra, cap)
        } else {
            self.ensure_f2leo();
            let b = self.f2leo.borrow();
            b.as_ref().unwrap().enumerate_small(&alg, rot, stage, extra, cap)
        };
        let items: Vec<(String, String)> =
            raw.iter().map(|(frame, combo, p)| (fmt_moves(frame, p), label(combo))).collect();
        sols_json(len, &items)
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
        // enumerate_small 现统一返回 (best_len, Vec<(frame, combo, sol)>):每条解带自己的 frame
        // (eo 破 y 对称可能 rot·y)+ 槽位(并列最优可能跨不同槽)。
        let pack = |len: u32, raw: Vec<(String, Vec<usize>, Vec<u8>)>| -> String {
            let items: Vec<(String, String)> =
                raw.iter().map(|(frame, combo, p)| (fmt_moves(frame, p), label(combo))).collect();
            sols_json(len, &items)
        };
        match variant {
            0 => {
                self.ensure_pair();
                let b = self.pair.borrow();
                let (len, raw) = b.as_ref().unwrap().enumerate_small(&alg, rot, stage, extra, cap);
                pack(len, raw)
            }
            1 => {
                self.ensure_eo();
                let b = self.eo.borrow();
                let (len, raw) = b.as_ref().unwrap().enumerate_small(&alg, rot, stage, extra, cap);
                pack(len, raw)
            }
            2 => {
                self.ensure_pseudo();
                let b = self.pseudo.borrow();
                let (len, raw) = b.as_ref().unwrap().enumerate_small(&alg, rot, stage, extra, cap);
                pack(len, raw)
            }
            3 => {
                self.ensure_pseudo_pair();
                let b = self.pseudo_pair.borrow();
                let (len, raw) = b.as_ref().unwrap().enumerate_small(&alg, rot, stage, extra, cap);
                pack(len, raw)
            }
            _ => sols_json(0, &[]),
        }
    }
}
