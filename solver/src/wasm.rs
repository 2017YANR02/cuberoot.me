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
use crate::chain_solver::{chain_json, parse_chain_config, ChainSolver};
use crate::cross_restrict_solver::{CrossRestrictSolver, MOVE_NAMES_54, ROTS_FACE};
use crate::cross_solver::CrossSolver;
use crate::xcross_restrict_solver::XCrossRestrictSolver;
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
use crate::cube222_solver::Cube222Solver;
use crate::prune_tables::PackedPruneTable;
use crate::pseudo_f2leo_solver::PseudoF2leoSolver;
use crate::pyraminx_solver::{parse_pyraminx, PyraminxSolver};
use crate::skewb_solver::{parse_skewb, SkewbSolver};
use crate::pseudo_pair_solver::PseudoPairSmallSolver;
use crate::pseudo_xcross_solver::PseudoSmallSolver;
use crate::roux_s1_solver::{s1_block_label, square_label, FbSquareSolver, RouxS1Solver};
use crate::xcross_solver::XCrossSolver;

/// 6 个 cube 视角(哪一面当底)。顺序对应 CSV 后缀 _z0/_z2/_z3/_z1/_x3/_x1。
const ROTS: [&str; 6] = ["", "z2", "z'", "z", "x'", "x"];

/// F2L 槽位标签(对齐 or18:BL=0 BR=1 FR=2 FL=3)。
const SLOT_LABELS: [&str; 4] = ["BL", "BR", "FR", "FL"];

/// 用户指定槽位组合:逗号分隔的槽位索引串(如 "2" / "0,1");空串 = 自动挑最优槽。
/// 去重 + 排序 + 只收 0..3,非法输入静默丢弃(降级为该串能解析出的子集;全非法=空=auto)。
fn parse_combo(s: &str) -> Vec<usize> {
    let mut v: Vec<usize> = s
        .split(',')
        .filter_map(|t| t.trim().parse::<usize>().ok())
        .filter(|&i| i < 4)
        .collect();
    v.sort_unstable();
    v.dedup();
    v
}

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

/// 流式解法回调:每枚举到一条解即 call 进 JS(worker 端 onSol 回调 postMessage 给 UI)。
/// `m`=带视角前缀的步骤串,`c`=槽位标签(无槽阶段空串),`len`=该解步数(不含视角前缀)。
/// 求解仍同步返回完整 JSON 作权威结果;回调只为「算一条出一条」的渐进显示。call 失败静默忽略。
fn emit_sol(on_sol: &js_sys::Function, m: &str, c: &str, len: usize) {
    let _ = on_sol.call3(
        &JsValue::NULL,
        &JsValue::from_str(m),
        &JsValue::from_str(c),
        &JsValue::from_f64(len as f64),
    );
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

/// 链式求解器(mallard P3):EO→DR→HTR→[FR]→Finish 一次编排,单 HOME 帧,零表下载。
/// 惰性 ensure:首次 solve_chain 现场建 EOLine/DR(2×~1M)/HTR(2.8MB)/htr2(648KB)
/// 距离表(数秒);fr.enabled 的请求再惰性建 FR 陪集表(更慢,一次性)。
#[wasm_bindgen]
pub struct ChainSolverWasm {
    inner: RefCell<Option<ChainSolver>>,
}

#[wasm_bindgen]
impl ChainSolverWasm {
    #[wasm_bindgen(constructor)]
    #[allow(clippy::new_without_default)]
    pub fn new() -> ChainSolverWasm {
        ChainSolverWasm { inner: RefCell::new(None) }
    }

    fn ensure(&self) {
        if self.inner.borrow().is_none() {
            *self.inner.borrow_mut() = Some(ChainSolver::new());
        }
    }

    /// scramble + 配置 JSON(per-stage {enabled,extra,cap,min,max,axes,excluded,
    /// niss} + maxChains,'{}' = 默认;niss 默认 eo/dr/htr/fr 开、fin 强制关)→
    /// {"chains":[{"steps":[{kind,variant,m,len,cum,inv?}],"solution":"...",
    /// "total":N}]}。m = 该步 HOME 帧串(无视角前缀);"inv":true = 整步做在
    /// inverse 打乱上(NISS-Before);solution = 线性化最终解 N ++ rev_inv(I)
    /// (normal 打乱上单序列),total = 其长度;cum = 截至该步总步数 N.len+I.len。
    /// excluded 串 = 「累计 N '|' 累计 I」(无 '|' = I 空,向后兼容)。打乱不可
    /// 解析或无链 → {"chains":[]} 哨兵;非法配置 JSON 整体回落默认配置。
    pub fn solve_chain(&self, scramble: &str, config_json: &str) -> String {
        self.ensure();
        let cfg = parse_chain_config(config_json);
        let b = self.inner.borrow();
        chain_json(&b.as_ref().unwrap().solve_chain(scramble, &cfg))
    }
}

/// 2x2x2 口袋魔方整解最优求解器(全自包含,**零表下载**):3.6MB 全空间精确距离表
/// 首次查询时惰性现场 BFS(lean 构造,不存 132MB 联合移动表,RefCell 缓存)。
/// 任意态都可解(非条件式阶段,无哨兵);支持全 18 面转记号(2x2x2 无中心,
/// D/L/B 与对面只差整体旋转,24 旋转归一到固定 DBL 帧)。度量 HTM,God's number = 11。
#[wasm_bindgen]
pub struct Cube222SolverWasm {
    cube222: RefCell<Option<Cube222Solver>>,
}

#[wasm_bindgen]
impl Cube222SolverWasm {
    #[wasm_bindgen(constructor)]
    #[allow(clippy::new_without_default)]
    pub fn new() -> Cube222SolverWasm {
        Cube222SolverWasm { cube222: RefCell::new(None) }
    }

    /// 用预算好的全空间距离表(3,674,160 字节)即时构造(秒算:静态资源直载,
    /// 跳过现场 BFS)。worker 拉 opt_222.bin.gz 解压后传入。
    pub fn from_dist(dist: &[u8]) -> Cube222SolverWasm {
        Cube222SolverWasm { cube222: RefCell::new(Some(Cube222Solver::from_dist(dist.to_vec()))) }
    }

    fn ensure(&self) {
        if self.cube222.borrow().is_none() {
            *self.cube222.borrow_mut() = Some(Cube222Solver::new_lean());
        }
    }

    /// 整解最优 HTM 步数(0..=11)。
    pub fn solve(&self, scramble: &str) -> u32 {
        self.ensure();
        let alg = string_to_alg(scramble);
        self.cube222.borrow().as_ref().unwrap().solve_one_any(&alg)
    }

    /// 一条最优解 JSON(同 Block222SolverWasm::solve_moves 形状,单条):
    /// {"len":N,"sols":[{"m":"x y' R U F2 ...","c":""}]}。`m` 前缀 = 整体旋转
    /// (打乱含 D/L/B 时归一所需,可为空),`c` 恒空串(整解无槽位/视角语义)。
    pub fn solve_moves(&self, scramble: &str) -> String {
        self.ensure();
        let alg = string_to_alg(scramble);
        let sol = self.cube222.borrow().as_ref().unwrap().enumerate_any(&alg);
        let items = vec![(fmt_moves(&sol.rot, &sol.moves), String::new())];
        sols_json(sol.len, &items)
    }
}

/// Pyraminx(金字塔)整解最优求解器(全自包含,**零表下载**):0.9MB 核心全空间
/// 精确距离表首次查询时惰性现场 BFS(lean 构造,不存 29.9MB 联合移动表,RefCell
/// 缓存)。吃全 WCA pyram 记号(大写 U/L/R/B 核心 + 小写 u/l/r/b 顶点,可带 '/2,
/// 阶 3 下 X2 = X');非法记号抛 JS 异常。口径(精确):总 HTM = 核心查表最优 +
/// #错位 tips。God's number 核心 11 / 含 tips 15。
#[wasm_bindgen]
pub struct PyraminxSolverWasm {
    pyra: RefCell<Option<PyraminxSolver>>,
}

#[wasm_bindgen]
impl PyraminxSolverWasm {
    #[wasm_bindgen(constructor)]
    #[allow(clippy::new_without_default)]
    pub fn new() -> PyraminxSolverWasm {
        PyraminxSolverWasm { pyra: RefCell::new(None) }
    }

    /// 用预算好的核心全空间距离表(933,120 字节)即时构造(秒算:静态资源直载,
    /// 跳过现场 BFS)。worker 拉 opt_pyraminx.bin.gz 解压后传入。
    pub fn from_dist(dist: &[u8]) -> PyraminxSolverWasm {
        PyraminxSolverWasm { pyra: RefCell::new(Some(PyraminxSolver::from_dist(dist.to_vec()))) }
    }

    fn ensure(&self) {
        if self.pyra.borrow().is_none() {
            *self.pyra.borrow_mut() = Some(PyraminxSolver::new_lean());
        }
    }

    /// 整解最优 HTM 步数(0..=15,含 tips)。非法记号 → Err(JS 异常)。
    pub fn solve(&self, scramble: &str) -> Result<u32, JsError> {
        let alg = parse_pyraminx(scramble).map_err(|e| JsError::new(&e))?;
        self.ensure();
        Ok(self.pyra.borrow().as_ref().unwrap().solve_one(&alg))
    }

    /// 一条最优解 JSON(同 Cube222SolverWasm::solve_moves 形状,单条):
    /// {"len":N,"sols":[{"m":"U L' B ... r b'","c":""}]}。`m` = 核心大写解 +
    /// 小写 tip 收尾(无整体旋转前缀),`c` 恒空串。非法记号 → Err(JS 异常)。
    pub fn solve_moves(&self, scramble: &str) -> Result<String, JsError> {
        let alg = parse_pyraminx(scramble).map_err(|e| JsError::new(&e))?;
        self.ensure();
        let sol = self.pyra.borrow().as_ref().unwrap().enumerate_lean(&alg);
        let items = vec![(sol.to_string_moves(), String::new())];
        Ok(sols_json(sol.len, &items))
    }
}

/// Skewb(斜转)整解最优求解器(全自包含,**零表下载**):3.0MB 全空间
/// (3,149,280 态)精确距离表首次查询时惰性现场 BFS(转移件级 decode/apply/encode,
/// 无联合移动表,RefCell 缓存)。吃全 WCA skewb 记号(U/L/R/B,后缀 '/2/2',
/// 阶 3 下 X2 = X');非法记号抛 JS 异常。God's number = 11。
#[wasm_bindgen]
pub struct SkewbSolverWasm {
    skewb: RefCell<Option<SkewbSolver>>,
}

#[wasm_bindgen]
impl SkewbSolverWasm {
    #[wasm_bindgen(constructor)]
    #[allow(clippy::new_without_default)]
    pub fn new() -> SkewbSolverWasm {
        SkewbSolverWasm { skewb: RefCell::new(None) }
    }

    /// 用预算好的全空间距离表(3,149,280 字节)即时构造(秒算:静态资源直载,
    /// 跳过现场 BFS)。worker 拉 opt_skewb.bin.gz 解压后传入。
    pub fn from_dist(dist: &[u8]) -> SkewbSolverWasm {
        SkewbSolverWasm { skewb: RefCell::new(Some(SkewbSolver::from_dist(dist.to_vec()))) }
    }

    fn ensure(&self) {
        if self.skewb.borrow().is_none() {
            *self.skewb.borrow_mut() = Some(SkewbSolver::new());
        }
    }

    /// 整解最优步数(0..=11,每 120° 一步)。非法记号 → Err(JS 异常)。
    pub fn solve(&self, scramble: &str) -> Result<u32, JsError> {
        let alg = parse_skewb(scramble).map_err(|e| JsError::new(&e))?;
        self.ensure();
        Ok(self.skewb.borrow().as_ref().unwrap().solve_one(&alg))
    }

    /// 一条最优解 JSON(同 Cube222SolverWasm::solve_moves 形状,单条):
    /// {"len":N,"sols":[{"m":"U L' B ...","c":""}]}。`m` = 最优解序列
    /// (无整体旋转前缀),`c` 恒空串。非法记号 → Err(JS 异常)。
    pub fn solve_moves(&self, scramble: &str) -> Result<String, JsError> {
        let alg = parse_skewb(scramble).map_err(|e| JsError::new(&e))?;
        self.ensure();
        let sol = self.skewb.borrow().as_ref().unwrap().enumerate(&alg);
        let items = vec![(sol.to_string_moves(), String::new())];
        Ok(sols_json(sol.len, &items))
    }
}

/// 受限步法 cross 搜索的深度上限:可解情形(禁 0–1 面)最优 ≤ ~10 远在界内;禁 2 面常无解,
/// 搜到此深度断定无解最坏 ~250ms(实测有界,worker 线程 + 终止兜底)。再高(14)无解情形到秒级。
const CROSS_MASK_DEPTH: u32 = 12;

/// 受限步法 XCross / F2L(variant 1..=4)搜索深度上限。小表 cascade,per-slot
/// pt_cross_C4E0 可采纳下界。实测(单视角,solver 本机):深度 13 时最坏 ~470ms
/// (xxxxcross 无解情形搜满 13 层断定无解 / 深解搜索),深度 14 飙到 ~5s(会卡 tab)。
/// 故钉 13:覆盖正常可解深度(xc/xxc/xxxc 受限最优 ≤ 13;多数 xxxxc 也 ≤ 13),
/// 真·受限最优 > 13 的(罕见深 F2L)返回「无解」哨兵,代价换不卡 tab。
const XCROSS_MASK_DEPTH: u32 = 13;

/// 受限步法 IDA* 小表族(实际仅 **pair / eo** 接入)搜索深度上限。
/// **注意:depth cap 单独压不住 variant 族的重限制爆炸。** 浏览器实测:stage0 禁 1 面 ~0.25s
/// (解浅早终止),但禁 2 面常无解,masked IDA* 要搜满深度才能证伪,而剪枝表是「无限制距离」
/// 对受限无解给不出有用下界 → cap 12/10/8 一律 15-30s(不像 CrossSolver 有精确距离表能秒证
/// 无解 → cross/xcross 禁多面仍 <0.6s)。**真正的兜底是 client UI 把 pair/eo 限单面**
/// (StageSolver SINGLE_FACE_METHODS):禁 1 面恒可解 → 必早终止有界,结构性杜绝 2+ 面。本函数
/// 自适应封顶(禁面越多 cap 越低)仅作二次防御 + 文档;UI 限单面后实际只会收到 0|1 面禁用(cap12)。
/// **pseudo / pseudo_pair / f2leo / pseudo_f2leo 不接入 MASK_SUPPORTED**:小表启发式**丢边**爆
/// 炸更狠(12-90s);理论上也可像 pair/eo 限单面接入,但其 1 面时延未验证,留作后续。
fn variant_mask_depth(mask: u32) -> u32 {
    let forbidden = (0..6).filter(|i| (mask >> (3 * i)) & 0b111 == 0).count();
    match forbidden {
        0 | 1 => 12,
        2 => 10,
        _ => 8,
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
    #[allow(clippy::too_many_arguments)]
    pub fn solve_moves(
        &self,
        scramble: &str,
        variant: u32,
        face: u32,
        extra: u32,
        cap: u32,
        combo: &str,
        on_sol: &js_sys::Function,
    ) -> String {
        let alg = string_to_alg(scramble);
        let rot = ROTS[(face as usize).min(5)];
        let cap = cap as usize;
        if variant == 0 {
            // cross 无槽位:c 留空串。cross 极快,枚举完后逐条回放给 on_sol(流式协议统一)。
            let (len, sols) = self.cross.enumerate_solutions(&alg, rot, extra, cap);
            let items: Vec<(String, String)> = sols
                .iter()
                .map(|p| {
                    let m = fmt_moves(rot, p);
                    emit_sol(on_sol, &m, "", p.len());
                    (m, String::new())
                })
                .collect();
            return sols_json(len, &items);
        }
        let k = (variant.min(4)) as usize; // 1..=4 槽
        // 每条解带自己的槽位组合(并列最优时含多个不同槽)。
        let label = |combo: &[usize]| {
            combo.iter().map(|&s| SLOT_LABELS[s]).collect::<Vec<_>>().join(" ")
        };
        // 流式回调:每枚举到一条解即 fmt + label 后 call 进 JS(worker postMessage 给 UI)。
        let mut emit = |combo: &[usize], p: &[u8]| emit_sol(on_sol, &fmt_moves(rot, p), &label(combo), p.len());
        // combo 非空 = 用户指定槽位(只枚举该 combo);空 = 自动挑最优槽。
        let slots = parse_combo(combo);
        let (len, sols) = if slots.is_empty() {
            self.xcross.enumerate_best(&alg, rot, k, extra, cap, &mut emit)
        } else {
            self.xcross.enumerate_combo(&alg, rot, &slots, extra, cap, &mut emit)
        };
        let items: Vec<(String, String)> =
            sols.iter().map(|(combo, p)| (fmt_moves(rot, p), label(combo))).collect();
        sols_json(len, &items)
    }

    /// 受限步法版 solve_face:`mask` = 18 个 move 的 bitmask(bit m=1 表示 move m 允许)。
    /// cross(variant 0)走 CrossSolver masked;xcross/F2L(variant 1..=4)走 XCrossSolver
    /// 小表 cascade masked(per-slot pt_cross_C4E0 可采纳下界,XCROSS_MASK_DEPTH 封顶)。
    /// 限制下(或深解超界)无解返回 u32::MAX 哨兵(client 显示 '-')。
    pub fn solve_face_masked(&self, scramble: &str, variant: u32, face: u32, mask: u32) -> u32 {
        let alg = string_to_alg(scramble);
        let rot = [ROTS[(face as usize).min(5)]];
        if variant == 0 {
            return self.cross.get_stats_masked(&alg, &rot, mask, CROSS_MASK_DEPTH)[0]
                .unwrap_or(u32::MAX);
        }
        let max_v = (variant.min(4) - 1) as usize; // 1→0(xc) .. 4→3(xxxxc)
        self.xcross
            .get_stats_small_masked(&alg, &rot, max_v, mask, XCROSS_MASK_DEPTH)[0]
            .unwrap_or(u32::MAX)
    }

    /// 受限步法版 solve_moves(同 solve_moves 形状)。cross 走 enumerate_solutions_masked;
    /// xcross/F2L(variant 1..=4)走 XCrossSolver enumerate_best_masked / enumerate_combo_masked。
    /// 限制下(或深解超界)无解 → len=u32::MAX 哨兵 + 空解集。
    #[allow(clippy::too_many_arguments)]
    pub fn solve_moves_masked(
        &self,
        scramble: &str,
        variant: u32,
        face: u32,
        extra: u32,
        cap: u32,
        combo: &str,
        mask: u32,
        on_sol: &js_sys::Function,
    ) -> String {
        let alg = string_to_alg(scramble);
        let rot = ROTS[(face as usize).min(5)];
        let cap = cap as usize;
        if variant == 0 {
            return match self
                .cross
                .enumerate_solutions_masked(&alg, rot, extra, cap, mask, CROSS_MASK_DEPTH)
            {
                Some((len, sols)) => {
                    let items: Vec<(String, String)> = sols
                        .iter()
                        .map(|p| {
                            let m = fmt_moves(rot, p);
                            emit_sol(on_sol, &m, "", p.len());
                            (m, String::new())
                        })
                        .collect();
                    sols_json(len, &items)
                }
                None => sols_json(u32::MAX, &[]),
            };
        }
        let k = (variant.min(4)) as usize; // 1..=4 槽
        let label = |combo: &[usize]| {
            combo.iter().map(|&s| SLOT_LABELS[s]).collect::<Vec<_>>().join(" ")
        };
        let mut emit = |combo: &[usize], p: &[u8]| emit_sol(on_sol, &fmt_moves(rot, p), &label(combo), p.len());
        let slots = parse_combo(combo);
        let (len, sols) = if slots.is_empty() {
            self.xcross
                .enumerate_best_masked(&alg, rot, k, extra, cap, mask, XCROSS_MASK_DEPTH, &mut emit)
        } else {
            self.xcross
                .enumerate_combo_masked(&alg, rot, &slots, extra, cap, mask, XCROSS_MASK_DEPTH, &mut emit)
        };
        // best_len==99 = 限制下(或超界)无解 → u32::MAX 哨兵 + 空解集(同 cross None 分支语义)。
        if len >= 99 {
            return sols_json(u32::MAX, &[]);
        }
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
        combo: &str,
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
        // combo 非空 = 用户指定目标槽位(只枚举槽位集合匹配的候选);空 = 自动挑最优。
        let force = parse_combo(combo);
        // enumerate_small 返回 (best_len, Vec<(frame, combo, sol)>):每条解带自己的 frame + 槽位
        // (并列最优可能跨不同槽 / 不同 y-frame)。
        let (len, raw) = if pseudo {
            self.ensure_pseudo();
            let b = self.pseudo.borrow();
            b.as_ref().unwrap().enumerate_small(&alg, rot, stage, extra, cap, &force)
        } else {
            self.ensure_f2leo();
            let b = self.f2leo.borrow();
            b.as_ref().unwrap().enumerate_small(&alg, rot, stage, extra, cap, &force)
        };
        let items: Vec<(String, String)> =
            raw.iter().map(|(frame, combo, p)| (fmt_moves(frame, p), label(combo))).collect();
        sols_json(len, &items)
    }

    /// 受限步法版 solve_f2leo_stage:`mask` = 18 个 move 的 bitmask。限制下无解的视角
    /// 返回 u32::MAX 哨兵(client 显示 '-')。variant_mask_depth(mask) 封顶。
    pub fn solve_f2leo_stage_masked(&self, scramble: &str, pseudo: bool, stage: u32, mask: u32) -> Vec<u32> {
        let alg = string_to_alg(scramble);
        let st = stage.min(3) as usize;
        let out = if pseudo {
            self.ensure_pseudo();
            self.pseudo.borrow().as_ref().unwrap().get_stage_masked(&alg, st, mask, variant_mask_depth(mask))
        } else {
            self.ensure_f2leo();
            self.f2leo.borrow().as_ref().unwrap().get_stage_masked(&alg, st, mask, variant_mask_depth(mask))
        };
        out.into_iter().map(|v| v.unwrap_or(u32::MAX)).collect()
    }

    /// 受限步法版 solve_moves(同形 JSON)。限制下(或超界)无解 → len=u32::MAX 哨兵 + 空解集。
    #[allow(clippy::too_many_arguments)]
    pub fn solve_moves_masked(
        &self,
        scramble: &str,
        pseudo: bool,
        face: u32,
        stage: u32,
        extra: u32,
        cap: u32,
        combo: &str,
        mask: u32,
    ) -> String {
        let alg = string_to_alg(scramble);
        let rot = ROTS[(face as usize).min(5)];
        let stage = stage.min(3) as usize;
        let cap = cap as usize;
        let label = |combo: &[usize]| {
            combo.iter().map(|&s| SLOT_LABELS[s.min(3)]).collect::<Vec<_>>().join(" ")
        };
        let force = parse_combo(combo);
        let (len, raw) = if pseudo {
            self.ensure_pseudo();
            let b = self.pseudo.borrow();
            b.as_ref().unwrap().enumerate_small_masked(&alg, rot, stage, extra, cap, &force, mask, variant_mask_depth(mask))
        } else {
            self.ensure_f2leo();
            let b = self.f2leo.borrow();
            b.as_ref().unwrap().enumerate_small_masked(&alg, rot, stage, extra, cap, &force, mask, variant_mask_depth(mask))
        };
        // best_len==99 = 限制下(或超界)无解 → u32::MAX 哨兵 + 空解集。
        if len >= 99 {
            return sols_json(u32::MAX, &[]);
        }
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
    /// `combo`:固定已解 xcross 槽集(or18「槽位」,空=自动);`base`:自由对槽(or18「基态」,
    /// 仅 pair/pseudo_pair 用,-1=自动),eo/pseudo 忽略。
    pub fn solve_moves(
        &self,
        scramble: &str,
        variant: u32,
        face: u32,
        stage: u32,
        extra: u32,
        cap: u32,
        combo: &str,
        base: i32,
    ) -> String {
        let alg = string_to_alg(scramble);
        let rot = ROTS[(face as usize).min(5)];
        let stage = stage as usize;
        let cap = cap as usize;
        // combo 非空 = 用户指定固定槽集(or18「槽位」);base>=0 = 指定自由对(or18「基态」)。
        let force = parse_combo(combo);
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
                let (len, raw) = b.as_ref().unwrap().enumerate_small(&alg, rot, stage, extra, cap, &force, base);
                pack(len, raw)
            }
            1 => {
                self.ensure_eo();
                let b = self.eo.borrow();
                let (len, raw) = b.as_ref().unwrap().enumerate_small(&alg, rot, stage, extra, cap, &force);
                pack(len, raw)
            }
            2 => {
                self.ensure_pseudo();
                let b = self.pseudo.borrow();
                let (len, raw) = b.as_ref().unwrap().enumerate_small(&alg, rot, stage, extra, cap, &force);
                pack(len, raw)
            }
            3 => {
                self.ensure_pseudo_pair();
                let b = self.pseudo_pair.borrow();
                let (len, raw) = b.as_ref().unwrap().enumerate_small(&alg, rot, stage, extra, cap, &force, base);
                pack(len, raw)
            }
            _ => sols_json(0, &[]),
        }
    }

    /// 受限步法版 solve_stage(单阶段 6 视角)。`mask` = 18 个 move 的 bitmask;限制下无解的
    /// 视角返回 u32::MAX 哨兵(client 显示 '-')。variant_mask_depth(mask) 封顶。
    pub fn solve_stage_masked(&self, scramble: &str, variant: u32, stage: u32, mask: u32) -> Vec<u32> {
        let alg = string_to_alg(scramble);
        let st = stage as usize;
        let out: Vec<Option<u32>> = match variant {
            0 => {
                self.ensure_pair();
                self.pair.borrow().as_ref().unwrap().get_stage_small_masked(&alg, &ROTS, st, mask, variant_mask_depth(mask))
            }
            1 => {
                self.ensure_eo();
                self.eo.borrow().as_ref().unwrap().eo_get_stage_small_masked(&alg, st, mask, variant_mask_depth(mask))
            }
            2 => {
                self.ensure_pseudo();
                self.pseudo.borrow().as_ref().unwrap().pseudo_get_stage_small_masked(&alg, st, mask, variant_mask_depth(mask))
            }
            3 => {
                self.ensure_pseudo_pair();
                self.pseudo_pair.borrow().as_ref().unwrap().pseudo_pair_get_stage_small_masked(&alg, st, mask, variant_mask_depth(mask))
            }
            _ => vec![None; 6],
        };
        out.into_iter().map(|v| v.unwrap_or(u32::MAX)).collect()
    }

    /// 受限步法版 solve_moves(同形 JSON)。限制下(或超界)无解 → len=u32::MAX 哨兵 + 空解集。
    #[allow(clippy::too_many_arguments)]
    pub fn solve_moves_masked(
        &self,
        scramble: &str,
        variant: u32,
        face: u32,
        stage: u32,
        extra: u32,
        cap: u32,
        combo: &str,
        base: i32,
        mask: u32,
    ) -> String {
        let alg = string_to_alg(scramble);
        let rot = ROTS[(face as usize).min(5)];
        let stage = stage as usize;
        let cap = cap as usize;
        let force = parse_combo(combo);
        let label = |combo: &[usize]| {
            combo.iter().map(|&s| SLOT_LABELS[s.min(3)]).collect::<Vec<_>>().join(" ")
        };
        let pack = |len: u32, raw: Vec<(String, Vec<usize>, Vec<u8>)>| -> String {
            if len >= 99 {
                return sols_json(u32::MAX, &[]);
            }
            let items: Vec<(String, String)> =
                raw.iter().map(|(frame, combo, p)| (fmt_moves(frame, p), label(combo))).collect();
            sols_json(len, &items)
        };
        let d = variant_mask_depth(mask);
        match variant {
            0 => {
                self.ensure_pair();
                let b = self.pair.borrow();
                let (len, raw) = b.as_ref().unwrap().enumerate_small_masked(&alg, rot, stage, extra, cap, &force, base, mask, d);
                pack(len, raw)
            }
            1 => {
                self.ensure_eo();
                let b = self.eo.borrow();
                let (len, raw) = b.as_ref().unwrap().enumerate_small_masked(&alg, rot, stage, extra, cap, &force, mask, d);
                pack(len, raw)
            }
            2 => {
                self.ensure_pseudo();
                let b = self.pseudo.borrow();
                let (len, raw) = b.as_ref().unwrap().enumerate_small_masked(&alg, rot, stage, extra, cap, &force, mask, d);
                pack(len, raw)
            }
            3 => {
                self.ensure_pseudo_pair();
                let b = self.pseudo_pair.borrow();
                let (len, raw) = b.as_ref().unwrap().enumerate_small_masked(&alg, rot, stage, extra, cap, &force, base, mask, d);
                pack(len, raw)
            }
            _ => sols_json(u32::MAX, &[]),
        }
    }
}

/// Cross restricted optimal 求解器(任意受限 54-move 集 + 中心朝向)。
/// 运行时建表(无外部表文件):coord_trans(190080*54)+ center_trans(24*54),
/// 构造即建好。`solve_cross_restricted` 走 BFS,首达即最优。
#[wasm_bindgen]
pub struct CrossRestrictSolverWasm {
    solver: CrossRestrictSolver,
}

#[wasm_bindgen]
impl CrossRestrictSolverWasm {
    /// 无需任何表字节,构造时现场建全部 transition 表。
    #[wasm_bindgen(constructor)]
    pub fn new() -> CrossRestrictSolverWasm {
        CrossRestrictSolverWasm {
            solver: CrossRestrictSolver::new(),
        }
    }

    /// 受限最优十字求解(从角度 `face` 看的十字),返回空格分隔的步骤串("" = 受限下不可解)。
    /// `scramble`:面动打乱串(只认 18 面动名)。
    /// `face`:0..5 视角(对应 analyzer 的 ROTS = ["","z2","z'","z","x'","x"]);
    ///         等价于 `search_cross(alg, ROTS[face])`,内部走逐 move 共轭。
    /// 54-bit allowed mask = (allowed_hi << 32) | allowed_lo(bit m = 1 表示 move m 允许)。
    /// `max_rot_count`:整体旋转动(x/y/z)在解里的最大个数。
    /// center_offset 固定 = [0](终态中心必须复原)。
    pub fn solve_cross_restricted(
        &self,
        scramble: &str,
        face: u32,
        allowed_lo: u32,
        allowed_hi: u32,
        max_rot_count: u32,
    ) -> String {
        let allowed: u64 = ((allowed_hi as u64) << 32) | (allowed_lo as u64);
        let sc = CrossRestrictSolver::parse_scramble(scramble);
        match self
            .solver
            .solve_face_restricted(&sc, face as usize, allowed, max_rot_count)
        {
            Some(seq) => seq
                .iter()
                .map(|&m| MOVE_NAMES_54[m])
                .collect::<Vec<_>>()
                .join(" "),
            None => String::new(),
        }
    }

    /// 受限最优十字「多解枚举」(对齐 analyzer「最大数量」):返回 JSON `{len, sols:[{m,c}]}`,
    /// 解按长度升序、长度 ∈ [最优, 最优+extra]、最多 `cap` 条;空集 → len = u32::MAX 哨兵。
    /// `c` 恒空串(cross 无 F2L 槽)。参数同 `solve_cross_restricted` + extra/cap。
    #[allow(clippy::too_many_arguments)]
    pub fn solve_cross_restricted_moves(
        &self,
        scramble: &str,
        face: u32,
        allowed_lo: u32,
        allowed_hi: u32,
        max_rot_count: u32,
        extra: u32,
        cap: u32,
    ) -> String {
        let allowed: u64 = ((allowed_hi as u64) << 32) | (allowed_lo as u64);
        let sc = CrossRestrictSolver::parse_scramble(scramble);
        let sols = self.solver.solve_face_restricted_enum(
            &sc, face as usize, allowed, max_rot_count, extra, cap as usize,
        );
        if sols.is_empty() {
            return sols_json(u32::MAX, &[]);
        }
        let len = sols[0].len() as u32;
        let items: Vec<(String, String)> = sols
            .iter()
            .map(|s| {
                (
                    s.iter().map(|&m| MOVE_NAMES_54[m]).collect::<Vec<_>>().join(" "),
                    String::new(),
                )
            })
            .collect();
        sols_json(len, &items)
    }
}

impl Default for CrossRestrictSolverWasm {
    fn default() -> Self {
        Self::new()
    }
}

/// 受限 单 (face,组合) IDA* 节点预算:超此即放弃该格(返回 -2 太宽),兜底极弱受限集
/// (如纯 {U,R,M})下「联合不可解」状态的深搜。紧/常规限制远在预算内出精确解。
/// 单视角枚举(用户点了某面、愿意等)用满预算;网格(6 面齐算、每次切格重算)按下方均摊压低。
/// 2026-06:cross↔角/棱 pos 联合 PDB 上线后启发式大幅收紧(宽受限 xxcross 实测 80M 节点解不出
/// → 中位 ~1-6M),故把满预算从 1.5M 抬到 12M;用户点开单面(愿等)绝大多数宽限制能在 ~1-3s
/// 出精确解(WASM 实测单面枚举满预算约 ~2-4s 上界)。极端宽集(全 wide+slice)最优证明重尾、
/// 个别格仍超预算 → ⋯(那是最优搜索在高冗余 move 集上的固有代价,非 bug)。
const XCR_NODE_LIMIT: u64 = 12_000_000;

/// 网格(概览)总节点预算目标:6 视角 × C(4,k) 组合均摊到每 (face,组合)。k≥2(xxcross/xxxcross/
/// F2L)组合多 + 多对启发式偏松易爆炸,不压低则一次切格要十几秒;均摊后整张网格 ≈4-5s。k≤1(xcross)
/// 维持满预算 XCR_NODE_LIMIT 不回归。`per_combo = clamp(目标/(6×组合数), 下限, 上限)`。
/// 联合 PDB 收紧启发式后,同等网格预算能解出远多于旧版的宽限制格(旧版几乎全 ⋯)。
const XCR_GRID_TARGET_TOTAL: u64 = 48_000_000;
const XCR_GRID_MIN_PER_COMBO: u64 = 600_000;
/// 单格上限:防 k=3/4(组合少)单格分到过大预算把网格拖慢;每格 ≤ 此值,整张网格 wall-clock 受控。
/// WASM 实测 k=2 网格(每格 ~1.3M)整张 ~2.5-3s;此上限只在 k=3/4 生效。
const XCR_GRID_MAX_PER_COMBO: u64 = 2_000_000;

/// C(4,k):k 对在 4 个 F2L 槽里的组合数(网格预算均摊用)。
fn n_combos(k: u32) -> u64 {
    match k {
        1 => 4,
        2 => 6,
        3 => 4,
        _ => 1, // k=0(纯十字,不走本引擎)/ k=4(满 F2L)均 1
    }
}

/// XCross restricted optimal 求解器(任意受限 54-move 集 + 中心朝向追踪)。
/// 运行时建表(无外部表文件):物理 54-move cross/corner/edge/center transition + 双 PDB
/// (cross 190080、pair 576,均按受限 move 集现场建、**中心移出表只在搜索态追踪**),IDA*
/// h=max(两 PDB)可采纳。每次受限集建表 ≈0.3s(原 4.56M 的 1/24)。与 CrossRestrictSolverWasm
/// 同样**零下载成本**:用到才在 worker 现场建表。
#[wasm_bindgen]
pub struct XCrossRestrictSolverWasm {
    solver: XCrossRestrictSolver,
}

#[wasm_bindgen]
impl XCrossRestrictSolverWasm {
    /// 无需任何表字节,构造时现场建全部 transition 表(~41MB RAM,~110ms,仅 worker 内存)。
    #[wasm_bindgen(constructor)]
    pub fn new() -> XCrossRestrictSolverWasm {
        XCrossRestrictSolverWasm {
            solver: XCrossRestrictSolver::new(),
        }
    }

    /// 6 视角受限最优网格(PDB 只建一次,6 视角 × C(4,k) 组合共用),返回 JSON 数组
    /// `[l0,l1,l2,l3,l4,l5]`,-1 = 真无解 / -2 = 限制过宽未在预算内判定。每格 = 该面在「k 对组合」
    /// 上的最小步数(`k`=同时归位的 F2L 对数:1 xcross / 2 xxcross / 3 xxxcross / 4 F2L)。
    /// 54-bit allowed mask = (allowed_hi << 32) | allowed_lo;`max_rot_count` = 解里整体旋转动上限。
    pub fn solve_xcross_restricted_grid(
        &self,
        scramble: &str,
        allowed_lo: u32,
        allowed_hi: u32,
        max_rot_count: u32,
        k: u32,
    ) -> String {
        let allowed: u64 = ((allowed_hi as u64) << 32) | (allowed_lo as u64);
        let sc = CrossRestrictSolver::parse_scramble(scramble);
        // 网格预算均摊:k≤1(xcross)维持满预算;k≥2 按组合数压低后再钳进 [下限, 上限],整张网格 ≈4-5s。
        let per_combo = if k <= 1 {
            XCR_NODE_LIMIT
        } else {
            (XCR_GRID_TARGET_TOTAL / (6 * n_combos(k)))
                .clamp(XCR_GRID_MIN_PER_COMBO, XCR_GRID_MAX_PER_COMBO)
        };
        let grid = self.solver.solve_xcross_restricted_grid_budgeted(
            &sc, allowed, max_rot_count, per_combo, k as usize,
        );
        let arr = grid
            .iter()
            .map(|l| l.to_string())
            .collect::<Vec<_>>()
            .join(",");
        format!("[{}]", arr)
    }

    /// 受限最优「多解枚举」:返回 JSON `{len, sols:[{m,c}]}`,解按长度升序、长度 ∈ [最优, 最优+extra]、
    /// 最多 `cap` 条;空集 → len = u32::MAX 哨兵。`c` 恒空串(阶段已隐含对数,组合由槽位下拉指定)。
    /// `k` = 同时归位的 F2L 对数;`combo` = 逗号分隔的固定槽集(空串=自动枚举全部 C(4,k) 组合)。
    #[allow(clippy::too_many_arguments)]
    pub fn solve_xcross_restricted_moves(
        &self,
        scramble: &str,
        face: u32,
        allowed_lo: u32,
        allowed_hi: u32,
        max_rot_count: u32,
        extra: u32,
        cap: u32,
        k: u32,
        combo: &str,
        on_sol: &js_sys::Function,
    ) -> String {
        let allowed: u64 = ((allowed_hi as u64) << 32) | (allowed_lo as u64);
        let sc = CrossRestrictSolver::parse_scramble(scramble);
        let combo_v: Option<Vec<usize>> = if combo.trim().is_empty() {
            None
        } else {
            Some(
                combo
                    .split(',')
                    .filter_map(|t| t.trim().parse::<usize>().ok())
                    .filter(|&i| i < 4)
                    .collect(),
            )
        };
        // 视角前缀:解是在 conjugate(scramble, ROTS_FACE[face]) 上求的,真机须先转到该帧。
        // 与全站其他求解器约定一致(`.m` 含视角前缀);face 0 前缀为空。len 不含前缀(旋转免费)。
        let pfx = ROTS_FACE[(face as usize).min(5)];
        let with_pfx = |body: String| -> String {
            if pfx.is_empty() { body } else { format!("{} {}", pfx, body) }
        };
        // 流式回调:每枚举到一条解即格式化(54-move 记号 + 视角前缀,c 恒空串)后 call 进 JS。
        let mut emit = |seq: &[usize]| {
            let body = seq.iter().map(|&x| MOVE_NAMES_54[x]).collect::<Vec<_>>().join(" ");
            emit_sol(on_sol, &with_pfx(body), "", seq.len());
        };
        let sols = self.solver.solve_xcross_restricted_enum_budgeted(
            &sc, face as usize, allowed, max_rot_count, extra, cap as usize, XCR_NODE_LIMIT,
            k as usize, combo_v, &mut emit,
        );
        if sols.is_empty() {
            return sols_json(u32::MAX, &[]);
        }
        let len = sols[0].len() as u32;
        let items: Vec<(String, String)> = sols
            .iter()
            .map(|s| {
                (
                    with_pfx(s.iter().map(|&m| MOVE_NAMES_54[m]).collect::<Vec<_>>().join(" ")),
                    String::new(),
                )
            })
            .collect();
        sols_json(len, &items)
    }
}

impl Default for XCrossRestrictSolverWasm {
    fn default() -> Self {
        Self::new()
    }
}
