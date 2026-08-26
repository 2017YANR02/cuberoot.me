use std::sync::LazyLock;

use itertools::Itertools;
use log::debug;

use crate::cube::*;
use crate::defs::StepVariant;
use crate::solver::lookup_table;
use crate::solver::lookup_table::{DepthEstimate, InMemoryIndexTable, MemoryMappedIndexTable};
use crate::solver::solution::Solution;
use crate::solver_new::*;
use crate::solver_new::group::StepGroup;
use crate::solver_new::step::*;
use crate::steps::dr::coords::{DRUDEOFB_SIZE, DRUDEOFBCoord};
use crate::steps::dr::dr_config::{DR_UD_EO_FB_MOVES, HTR_DR_UD_MOVESET};
use crate::steps::finish::coords::{DR_FINISH_LS_SIZE, DR_FINISH_SIZE, DRFinishCoord, DRLeaveSliceFinishCoord, FR_FINISH_SIZE, FRUDFinishCoord, HTR_FINISH_SIZE, HTR_LEAVE_SLICE_FINISH_SIZE, HTRFinishCoord, HTRLeaveSliceFinishCoord};
use crate::steps::finish::finish_config::{FRUD_FINISH_MOVESET, HTR_FINISH_MOVESET};
use crate::steps::fr::coords::{FRUD_NO_SLICE_SIZE, FRUD_WITH_SLICE_SIZE, FRUDNoSliceCoord, FRUDWithSliceCoord};
use crate::steps::htr::coords::{HTRDRUD_SIZE, HTRDRUDCoord};

pub static FR_FINISH_TABLE: LazyLock<FRFinishPruningTable> = LazyLock::new(||gen_fr_finish());
pub type FRFinishPruningTable = Box<dyn DepthEstimate<{FR_FINISH_SIZE}, FRUDFinishCoord>>;
pub static HTR_FINISH_TABLE: LazyLock<HTRFinishPruningTable> = LazyLock::new(||gen_htr_finish());
pub type HTRFinishPruningTable = Box<dyn DepthEstimate<{HTR_FINISH_SIZE}, HTRFinishCoord>>;
pub static HTR_LEAVE_SLICE_FINISH_TABLE: LazyLock<HTRLeaveSliceFinishPruningTable> = LazyLock::new(||gen_htr_ls_finish());
pub type HTRLeaveSliceFinishPruningTable = Box<dyn DepthEstimate<{HTR_LEAVE_SLICE_FINISH_SIZE}, HTRLeaveSliceFinishCoord>>;
pub static DR_FINISH_TABLE: LazyLock<DRFinishPruningTable> = LazyLock::new(|| gen_dr_finish());
pub type DRFinishPruningTable = Box<dyn DepthEstimate<{DR_FINISH_SIZE}, DRFinishCoord>>;
pub static DR_LEAVE_SLICE_FINISH_TABLE: LazyLock<DRLeaveSliceFinishPruningTable> = LazyLock::new(|| gen_dr_leave_slice_finish());
pub type DRLeaveSliceFinishPruningTable = Box<dyn DepthEstimate<{DR_FINISH_LS_SIZE}, DRLeaveSliceFinishCoord>>;

pub const DR_SYMMETRIES: &[Symmetry] = &[
    Symmetry::U0, Symmetry::UM0,
    Symmetry::U1, Symmetry::UM1,
    Symmetry::U2, Symmetry::UM2,
    Symmetry::U3, Symmetry::UM3,
    Symmetry::D0, Symmetry::DM0,
    Symmetry::D1, Symmetry::DM1,
    Symmetry::D2, Symmetry::DM2,
    Symmetry::D3, Symmetry::DM3,
];

const FINISH_FRUD_ST_MOVES: &[Turn333] = &[
    Turn333::F2, Turn333::B2,
    Turn333::L2, Turn333::R2,
];

const FINISH_HTR_ST_MOVES: &[Turn333] = &[
    Turn333::U2, Turn333::D2,
    Turn333::F2, Turn333::B2,
    Turn333::L2, Turn333::R2,
];

const FINISH_AUX_MOVES: &[Turn333] = &[];

pub const FINISH_FRUD_MOVESET: MoveSet = MoveSet::new_qt_ht_ordered(FINISH_FRUD_ST_MOVES, FINISH_AUX_MOVES);
pub const FINISH_HTR_MOVESET: MoveSet = MoveSet::new_qt_ht_ordered(FINISH_HTR_ST_MOVES, FINISH_AUX_MOVES);
pub const FINISH_DR_MOVESET: MoveSet = MoveSet::new_qt_ht_ordered(DR_UD_EO_FB_MOVES, &[]);

pub struct FRFinishStep;
pub type FRFinishBuilder = builder::FRFinishBuilderInternal<false, false, false, false>;

impl FRFinishStep {
    pub fn builder() -> FRFinishBuilder {
        FRFinishBuilder::default()
    }
}

impl FRFinishStep {
    pub fn new(dfs: DFSParameters, fr_axis: Vec<CubeAxis>, leave_slice: bool) -> StepGroup {
        debug!("Step fin with options {dfs:?}");
        let variants = fr_axis.into_iter()
            .map(|fr|match fr {
                CubeAxis::UD => (vec![], fr),
                CubeAxis::FB => (vec![Transformation333::X], fr),
                CubeAxis::LR => (vec![Transformation333::Z], fr),
            })
            .map(|(trans, fr)|{
                if leave_slice {
                    StepGroup::single(Box::new(PruningTableStep::<FR_FINISH_SIZE, FRUDFinishCoord, FRUD_NO_SLICE_SIZE, FRUDNoSliceCoord>  {
                        table: &FR_FINISH_TABLE,
                        options: dfs.clone(),
                        pre_step_check: vec![],
                        pre_step_trans: trans,
                        variant: StepVariant::FRFINLS(fr),
                        post_step_check: vec![],
                        move_set: &FINISH_FRUD_MOVESET,
                        _pc: Default::default(),
                    }))
                } else {
                    StepGroup::single(Box::new(PruningTableStep::<FR_FINISH_SIZE, FRUDFinishCoord, FRUD_WITH_SLICE_SIZE, FRUDWithSliceCoord>  {
                        table: &FR_FINISH_TABLE,
                        options: dfs.clone(),
                        pre_step_check: vec![],
                        pre_step_trans: trans,
                        variant: StepVariant::FRFIN(fr),
                        post_step_check: vec![],
                        move_set: &FINISH_FRUD_MOVESET,
                        _pc: Default::default(),
                    }))
                }
            })
            .collect_vec();
        StepGroup::parallel(variants)
    }
}

pub struct DRFinishStep;
pub type DRFinishBuilder = builder::DRFinishBuilderInternal<false, false, false, false, false>;

impl DRFinishStep {
    pub fn builder() -> DRFinishBuilder {
        DRFinishBuilder::default()
    }

    pub(crate) fn get_possible_cancellation_count(solution: &Solution, dr_fin_axis: CubeAxis) -> usize {
        // Only if we have a HTR step, we will consider cancelling with any step before the HTR.
        if let Some(x) = solution.steps.last() {
            if StepKind::from(x.variant) != StepKind::HTR {
                return 0
            }
            // If the HTR has moves on both sides, there is no hope of cancelling anything
            if !x.alg.normal_moves.is_empty() && !x.alg.inverse_moves.is_empty() {
                return 0
            }
            let candidate = solution.steps.iter()
                .take_while(|x|StepKind::from(x.variant) != StepKind::HTR)
                .filter(|x|(solution.ends_on_normal() && !x.alg.inverse_moves.is_empty()) ||
                    (!solution.ends_on_normal() && !x.alg.normal_moves.is_empty()))
                .last();
            if let Some(canditate) = candidate.cloned() {
                let candidate_cancel_moves = if solution.ends_on_normal() {
                    canditate.alg.inverse_moves
                } else {
                    canditate.alg.normal_moves
                };
                let cancel_candidates = candidate_cancel_moves.iter()
                    .rev()
                    .take_while(|x|x.face.is_on_axis(dr_fin_axis) || x.dir == Direction::Half)
                    .count();
                if cancel_candidates == 0 {
                    0
                } else if cancel_candidates == candidate_cancel_moves.len() {
                    cancel_candidates * 2
                } else {
                    cancel_candidates * 2 + 1
                }
            } else {
                0
            }
        } else {
            0
        }
    }
}

#[cfg(test)]
mod test {
    use std::str::FromStr;
    use crate::algs::Algorithm;
    use crate::cube::CubeAxis;
    use crate::defs::StepVariant;
    use crate::solver::solution::{Solution, SolutionStep};
    use crate::solver_new::finish::DRFinishStep;

    #[test]
    fn test_dr_cancel_moves() {
        let solution = Solution {
            steps: vec![
                SolutionStep {
                    variant: StepVariant::EO(CubeAxis::LR),
                    alg: Algorithm::from_str("D' R (U L)").unwrap(),
                    comment: "".to_string(),
                },
                SolutionStep {
                    variant: StepVariant::DR { eo_axis: CubeAxis::LR, dr_axis: CubeAxis::FB },
                    alg: Algorithm::from_str("(B' L2 D2 U2 F2 B' D)").unwrap(),
                    comment: "".to_string(),
                },
                SolutionStep {
                    variant: StepVariant::HTR(CubeAxis::FB),
                    alg: Algorithm::from_str("(L2 B)").unwrap(),
                    comment: "".to_string(),
                },
            ],
            ends_on_normal: false,
            vr_solution: None,
        };
        assert_eq!(0, DRFinishStep::get_possible_cancellation_count(&solution, CubeAxis::FB));
        assert_eq!(3, DRFinishStep::get_possible_cancellation_count(&solution, CubeAxis::LR));
        assert_eq!(0, DRFinishStep::get_possible_cancellation_count(&solution, CubeAxis::UD));
    }

    #[test]
    fn test_dr_ht_section_cancel_moves() {
        let solution = Solution {
            steps: vec![
                SolutionStep {
                    variant: StepVariant::EO(CubeAxis::LR),
                    alg: Algorithm::from_str("D' L F2 R (U L)").unwrap(),
                    comment: "".to_string(),
                },
                SolutionStep {
                    variant: StepVariant::DR { eo_axis: CubeAxis::LR, dr_axis: CubeAxis::FB },
                    alg: Algorithm::from_str("(B' L2 D2 U2 F2 B' D)").unwrap(),
                    comment: "".to_string(),
                },
                SolutionStep {
                    variant: StepVariant::HTR(CubeAxis::FB),
                    alg: Algorithm::from_str("(L2 B)").unwrap(),
                    comment: "".to_string(),
                },
            ],
            ends_on_normal: false,
            vr_solution: None,
        };
        assert_eq!(0, DRFinishStep::get_possible_cancellation_count(&solution, CubeAxis::FB));
        assert_eq!(7, DRFinishStep::get_possible_cancellation_count(&solution, CubeAxis::LR));
        assert_eq!(0, DRFinishStep::get_possible_cancellation_count(&solution, CubeAxis::UD));
    }

    #[test]
    fn test_two_dr_cancel_moves() {
        let solution = Solution {
            steps: vec![
                SolutionStep {
                    variant: StepVariant::EO(CubeAxis::LR),
                    alg: Algorithm::from_str("(D' R U L)").unwrap(),
                    comment: "".to_string(),
                },
                SolutionStep {
                    variant: StepVariant::DR { eo_axis: CubeAxis::LR, dr_axis: CubeAxis::FB },
                    alg: Algorithm::from_str("F B").unwrap(),
                    comment: "".to_string(),
                },
                SolutionStep {
                    variant: StepVariant::HTR(CubeAxis::FB),
                    alg: Algorithm::from_str("(L2 B)").unwrap(),
                    comment: "".to_string(),
                },
            ],
            ends_on_normal: false,
            vr_solution: None,
        };
        assert_eq!(4, DRFinishStep::get_possible_cancellation_count(&solution, CubeAxis::FB));
        assert_eq!(0, DRFinishStep::get_possible_cancellation_count(&solution, CubeAxis::LR));
        assert_eq!(0, DRFinishStep::get_possible_cancellation_count(&solution, CubeAxis::UD));
    }
}

impl DRFinishStep {
    pub fn new(dfs: DFSParameters, dr_axis: Vec<CubeAxis>, leave_slice: bool) -> StepGroup {
        debug!("Step fin with options {dfs:?}");
        let variants = dr_axis.into_iter()
            .map(|dr|match dr {
                CubeAxis::UD => (vec![], dr),
                CubeAxis::FB => (vec![Transformation333::X], dr),
                CubeAxis::LR => (vec![Transformation333::Z], dr),
            })
            .map(|(trans, axis)|{
                if leave_slice {
                    StepGroup::single(Box::new(PruningTableStep::<{ DR_FINISH_LS_SIZE }, DRLeaveSliceFinishCoord, { DRUDEOFB_SIZE }, DRUDEOFBCoord>  {
                        table: &DR_LEAVE_SLICE_FINISH_TABLE,
                        options: dfs.clone(),
                        pre_step_trans: trans,
                        pre_step_check: vec![],
                        variant: StepVariant::DRFINLS(axis),
                        post_step_check: vec![],
                        move_set: &FINISH_DR_MOVESET,
                        _pc: Default::default(),
                    }))
                } else {
                    StepGroup::single(Box::new(PruningTableStep::<{ DR_FINISH_SIZE }, DRFinishCoord, { DRUDEOFB_SIZE }, DRUDEOFBCoord>  {
                        table: &DR_FINISH_TABLE,
                        options: dfs.clone(),
                        pre_step_trans: trans,
                        pre_step_check: vec![],
                        variant: StepVariant::DRFIN(axis),
                        post_step_check: vec![],
                        move_set: &FINISH_DR_MOVESET,
                        _pc: Default::default(),
                    }))
                }
            })
            .collect_vec();
        StepGroup::parallel(variants)
    }
}

pub struct HTRFinishStep;
pub type HTRFinishBuilder = builder::HTRFinishBuilderInternal<false, false, false, false>;

impl HTRFinishStep {
    pub fn builder() -> HTRFinishBuilder {
        HTRFinishBuilder::default()
    }
}

impl HTRFinishStep {
    pub fn new(dfs: DFSParameters, ls_axis: Vec<CubeAxis>, leave_slice: bool) -> StepGroup {
        debug!("Step fin with options {dfs:?}");
        if leave_slice {
            let (follow_dr, ls_axis) = if ls_axis.is_empty() {
                (true, vec![CubeAxis::UD, CubeAxis::FB, CubeAxis::LR])
            } else {
                (false, ls_axis)
            };
            let variants = ls_axis.into_iter()
                .map(|slice|match slice {
                    CubeAxis::UD => (vec![], slice),
                    CubeAxis::FB => (vec![Transformation333::X], slice),
                    CubeAxis::LR => (vec![Transformation333::Z], slice),
                })
                .map(|(trans, slice)|{
                    let pre_check: Vec<Box<dyn PreStepCheck + Send + 'static>> = if follow_dr {
                        vec![Box::new(DRAxisPreStepCheck(slice))]
                    } else {
                        vec![]
                    };
                    StepGroup::single(Box::new(PruningTableStep::<HTR_LEAVE_SLICE_FINISH_SIZE, HTRLeaveSliceFinishCoord, HTRDRUD_SIZE, HTRDRUDCoord>  {
                        table: &HTR_LEAVE_SLICE_FINISH_TABLE,
                        options: dfs.clone(),
                        pre_step_trans: trans,
                        pre_step_check: pre_check,
                        variant: StepVariant::HTRFINLS(slice),
                        post_step_check: vec![],
                        move_set: &FINISH_HTR_MOVESET,
                        _pc: Default::default(),
                    }))
                })
                .collect();
            StepGroup::parallel(variants)
        } else {
            StepGroup::single(Box::new(PruningTableStep::<HTR_FINISH_SIZE, HTRFinishCoord, HTRDRUD_SIZE, HTRDRUDCoord>  {
                table: &HTR_FINISH_TABLE,
                options: dfs.clone(),
                pre_step_trans: vec![],
                pre_step_check: vec![],
                variant: StepVariant::HTRFIN,
                post_step_check: vec![],
                move_set: &FINISH_HTR_MOVESET,
                _pc: Default::default(),
            }))
        }
    }
}

fn gen_fr_finish() -> FRFinishPruningTable {
    Box::new(InMemoryIndexTable::load_and_save("frfin", ||lookup_table::generate(&FRUD_FINISH_MOVESET,
                                                                         &|c: &Cube333| FRUDFinishCoord::from(c),
                                                                         &|| InMemoryIndexTable::new(false),
                                                                         &|table, coord|table.get(coord),
                                                                         &|table, coord, val|table.set(coord, val))).0)
}

fn gen_htr_finish() -> HTRFinishPruningTable {
    Box::new(InMemoryIndexTable::load_and_save("htrfin", ||lookup_table::generate(&HTR_FINISH_MOVESET,
                                                                          &|c: &Cube333| HTRFinishCoord::from(c),
                                                                          &|| InMemoryIndexTable::new(false),
                                                                          &|table, coord|table.get(coord),
                                                                          &|table, coord, val|table.set(coord, val))).0)
}

fn gen_htr_ls_finish() -> HTRLeaveSliceFinishPruningTable {
    Box::new(InMemoryIndexTable::load_and_save("htrfinls", ||lookup_table::generate(&HTR_FINISH_MOVESET,
                                                                            &|c: &Cube333| HTRLeaveSliceFinishCoord::from(c),
                                                                            &|| InMemoryIndexTable::new(false),
                                                                            &|table, coord|table.get(coord),
                                                                            &|table, coord, val|table.set(coord, val))).0)
}

fn gen_dr_finish() -> DRFinishPruningTable {
    Box::new(MemoryMappedIndexTable::load_and_save("drfin", ||lookup_table::generate_large_table(&HTR_DR_UD_MOVESET)).0)
}

fn gen_dr_leave_slice_finish() -> DRLeaveSliceFinishPruningTable {
    Box::new(MemoryMappedIndexTable::load_and_save("drfinls", ||lookup_table::generate_large_table(&HTR_DR_UD_MOVESET)).0)
}

struct DRAxisPreStepCheck(CubeAxis);

impl PreStepCheck for DRAxisPreStepCheck {
    fn is_cube_ready(&self, _: &Cube333, sol: Option<&Solution>) -> bool {
        sol.map(|sol|sol.steps.iter()
            .any(|x|if let StepVariant::DR { dr_axis, .. } = x.variant {
                dr_axis == self.0
            } else {
                false
            }))
            .unwrap_or(true)
    }
}

pub mod builder {
    use crate::cube::CubeAxis;
    use crate::defs::{NissSwitchType, StepKind};
    use crate::solver_new::finish::{DRFinishStep, FRFinishStep, HTRFinishStep};
    use crate::solver_new::group::StepGroup;
    use crate::solver_new::step::DFSParameters;
    use crate::steps::step::StepConfig;

    pub struct FRFinishBuilderInternal<const A: bool, const B: bool, const C: bool, const D: bool> {
        _a_max_length: usize,
        _b_max_absolute_length: usize,
        _c_fr_axis: Vec<CubeAxis>,
        _d_leave_slice: bool,
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool> FRFinishBuilderInternal<A, B, C, D> {
        fn convert<const _A: bool, const _B: bool, const _C: bool, const _D: bool>(self) -> FRFinishBuilderInternal<_A, _B, _C, _D> {
            FRFinishBuilderInternal {
                _a_max_length: self._a_max_length,
                _b_max_absolute_length: self._b_max_absolute_length,
                _c_fr_axis: self._c_fr_axis,
                _d_leave_slice: self._d_leave_slice,
            }
        }
    }

    impl <const B: bool, const C: bool, const D: bool> FRFinishBuilderInternal<false, B, C, D> {
        pub fn max_length(mut self, max_length: usize) -> FRFinishBuilderInternal<true, B, C, D> {
            self._a_max_length = max_length;
            self.convert()
        }
    }

    impl <const A: bool, const C: bool, const D: bool> FRFinishBuilderInternal<A, false, C, D> {
        pub fn max_absolute_length(mut self, max_absolute_length: usize) -> FRFinishBuilderInternal<A, true, C, D> {
            self._b_max_absolute_length = max_absolute_length;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const D: bool> FRFinishBuilderInternal<A, B, false, D> {
        pub fn fr_axis(mut self, fr_axis: Vec<CubeAxis>) -> FRFinishBuilderInternal<A, B, true, D> {
            self._c_fr_axis = fr_axis;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const D: bool> FRFinishBuilderInternal<A, B, false, D> {
        pub fn leave_slice(mut self) -> FRFinishBuilderInternal<A, B, true, D> {
            self._d_leave_slice = true;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool> FRFinishBuilderInternal<A, B, C, D> {
        pub fn build(self) -> StepGroup {
            let dfs = DFSParameters {
                niss_type: NissSwitchType::Never,
                min_moves: 0,
                max_moves: self._a_max_length,
                absolute_max_moves: Some(self._b_max_absolute_length),
                ignore_previous_step_restrictions: false,
            };
            FRFinishStep::new(dfs, self._c_fr_axis, self._d_leave_slice)
        }
    }

    impl FRFinishBuilderInternal<false, false, false, false> {
        pub fn new() -> Self {
            Self {
                _a_max_length: 10,
                _b_max_absolute_length: 50,
                _c_fr_axis: vec![CubeAxis::X, CubeAxis::Y, CubeAxis::Z],
                _d_leave_slice: false,
            }
        }
    }

    impl Default for FRFinishBuilderInternal<false, false, false, false> {
        fn default() -> Self {
            Self::new()
        }
    }

    impl TryFrom<StepConfig> for FRFinishBuilderInternal<false, false, false, false> {
        type Error = ();

        fn try_from(value: StepConfig) -> Result<Self, Self::Error> {
            if !value.params.is_empty() {
                return Err(())
            }
            if value.kind != StepKind::FIN && value.kind != StepKind::FINLS {
                return Err(())
            }
            let mut defaults = Self::default();
            if let Some(max) = value.max {
                defaults._a_max_length = max as usize;
            }
            if let Some(abs_max) = value.absolute_max {
                defaults._b_max_absolute_length = abs_max as usize;
            }
            if let Some(variants) = value.substeps {
                let axis: Result<Vec<CubeAxis>, Self::Error> = variants.into_iter()
                    .map(|variant| match variant.to_lowercase().as_str() {
                        "finishud" | "finud" | "ud" => Ok(CubeAxis::UD),
                        "finishfd" | "finfb" | "fb" => Ok(CubeAxis::FB),
                        "finishlr" | "finlr" | "lr" => Ok(CubeAxis::LR),
                        _ => Err(()),
                    })
                    .collect();
                defaults._c_fr_axis = axis?;
            }
            if value.kind == StepKind::FINLS {
                defaults._d_leave_slice = true;
            }
            Ok(defaults)
        }
    }

    pub struct HTRFinishBuilderInternal<const A: bool, const B: bool, const C: bool, const D: bool> {
        _a_max_length: usize,
        _b_max_absolute_length: usize,
        _c_leave_slice: bool,
        _d_ls_axis: Vec<CubeAxis>,
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool> HTRFinishBuilderInternal<A, B, C, D> {
        fn convert<const _A: bool, const _B: bool, const _C: bool, const _D: bool>(self) -> HTRFinishBuilderInternal<_A, _B, _C, _D> {
            HTRFinishBuilderInternal {
                _a_max_length: self._a_max_length,
                _b_max_absolute_length: self._b_max_absolute_length,
                _c_leave_slice: self._c_leave_slice,
                _d_ls_axis: self._d_ls_axis,
            }
        }
    }

    impl <const B: bool, const C: bool, const D: bool> HTRFinishBuilderInternal<false, B, C, D> {
        pub fn max_length(mut self, max_length: usize) -> HTRFinishBuilderInternal<true, B, C, D> {
            self._a_max_length = max_length;
            self.convert()
        }
    }

    impl <const A: bool, const C: bool, const D: bool> HTRFinishBuilderInternal<A, false, C, D> {
        pub fn max_absolute_length(mut self, max_absolute_length: usize) -> HTRFinishBuilderInternal<A, true, C, D> {
            self._b_max_absolute_length = max_absolute_length;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const D: bool> HTRFinishBuilderInternal<A, B, false, D> {
        pub fn leave_slice(mut self) -> HTRFinishBuilderInternal<A, B, true, D> {
            self._c_leave_slice = true;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool> HTRFinishBuilderInternal<A, B, C, false> {
        pub fn leave_slice_axis(mut self, ls_axis: Vec<CubeAxis>) -> HTRFinishBuilderInternal<A, B, true, true> {
            self._c_leave_slice = true;
            self._d_ls_axis = ls_axis;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool> HTRFinishBuilderInternal<A, B, C, D> {
        pub fn build(self) -> StepGroup {
            let dfs = DFSParameters {
                niss_type: NissSwitchType::Never,
                min_moves: 0,
                max_moves: self._a_max_length,
                absolute_max_moves: Some(self._b_max_absolute_length),
                ignore_previous_step_restrictions: false,
            };
            HTRFinishStep::new(dfs, self._d_ls_axis, self._c_leave_slice)
        }
    }

    impl HTRFinishBuilderInternal<false, false, false, false> {
        pub fn new() -> Self {
            Self {
                _a_max_length: 14,
                _b_max_absolute_length: 50,
                _c_leave_slice: false,
                _d_ls_axis: vec![], // Empty means same as DR
            }
        }
    }

    impl Default for HTRFinishBuilderInternal<false, false, false, false> {
        fn default() -> Self {
            Self::new()
        }
    }

    impl TryFrom<StepConfig> for HTRFinishBuilderInternal<false, false, false, false> {
        type Error = ();

        fn try_from(value: StepConfig) -> Result<Self, Self::Error> {
            if !value.params.is_empty() {
                return Err(())
            }
            if value.kind != StepKind::FIN && value.kind != StepKind::FINLS {
                return Err(())
            }
            let mut defaults = Self::default();
            if let Some(max) = value.max {
                defaults._a_max_length = max as usize;
            }
            if let Some(abs_max) = value.absolute_max {
                defaults._b_max_absolute_length = abs_max as usize;
            }
            if value.kind == StepKind::FINLS {
                defaults._c_leave_slice = true;
            }
            if let Some(variants) = value.substeps {
                let axis: Result<Vec<CubeAxis>, Self::Error> = variants.into_iter()
                    .map(|variant| match variant.to_lowercase().as_str() {
                        "finishlsud" | "finlsud" | "finishud" | "finud" | "ud" => Ok(CubeAxis::UD),
                        "finishlsfd" | "finlsfb" | "finishfd" | "finfb" | "fb" => Ok(CubeAxis::FB),
                        "finishlslr" | "finlslr" | "finishlr" | "finlr" | "lr" => Ok(CubeAxis::LR),
                        _ => Err(()),
                    })
                    .collect();
                defaults._d_ls_axis = axis?;
            }
            Ok(defaults)
        }
    }
    pub struct DRFinishBuilderInternal<const A: bool, const B: bool, const C: bool, const D: bool, const E: bool> {
        _a_max_length: usize,
        _b_max_absolute_length: usize,
        _c_leave_slice: bool,
        _d_from_htr: bool,
        _e_ls_axis: Vec<CubeAxis>
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool, const E: bool> DRFinishBuilderInternal<A, B, C, D, E> {
        fn convert<const _A: bool, const _B: bool, const _C: bool, const _D: bool, const _E: bool>(self) -> DRFinishBuilderInternal<_A, _B, _C, _D, _E> {
            DRFinishBuilderInternal {
                _a_max_length: self._a_max_length,
                _b_max_absolute_length: self._b_max_absolute_length,
                _c_leave_slice: self._c_leave_slice,
                _d_from_htr: self._d_from_htr,
                _e_ls_axis: self._e_ls_axis,
            }
        }
    }

    impl <const B: bool, const C: bool, const D: bool, const E: bool> DRFinishBuilderInternal<false, B, C, D, E> {
        pub fn max_length(mut self, max_length: usize) -> DRFinishBuilderInternal<true, B, C, D, E> {
            self._a_max_length = max_length;
            self.convert()
        }
    }

    impl <const A: bool, const C: bool, const D: bool, const E: bool> DRFinishBuilderInternal<A, false, C, D, E> {
        pub fn max_absolute_length(mut self, max_absolute_length: usize) -> DRFinishBuilderInternal<A, true, C, D, E> {
            self._b_max_absolute_length = max_absolute_length;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const D: bool, const E: bool> DRFinishBuilderInternal<A, B, false, D, E> {
        pub fn leave_slice(mut self) -> DRFinishBuilderInternal<A, B, true, D, E> {
            self._c_leave_slice = true;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const E: bool> DRFinishBuilderInternal<A, B, C, false, E> {
        pub fn from_htr(mut self) -> DRFinishBuilderInternal<A, B, C, true, E> {
            self._d_from_htr = true;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool> DRFinishBuilderInternal<A, B, C, D, false> {
        pub fn leave_slice_axis<T: Into<Vec<CubeAxis>>>(mut self, ls_axis: T) -> DRFinishBuilderInternal<A, B, C, D, true> {
            self._e_ls_axis = ls_axis.into();
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool, const E: bool> DRFinishBuilderInternal<A, B, C, D, E> {
        pub fn build(self) -> StepGroup {
            let dfs = DFSParameters {
                niss_type: NissSwitchType::Never,
                min_moves: 0,
                max_moves: self._a_max_length,
                absolute_max_moves: Some(self._b_max_absolute_length),
                ignore_previous_step_restrictions: self._d_from_htr,
            };
            DRFinishStep::new(dfs, self._e_ls_axis, self._c_leave_slice)
        }
    }

    impl DRFinishBuilderInternal<false, false, false, false, false> {
        pub fn new() -> Self {
            Self {
                _a_max_length: 14,
                _b_max_absolute_length: 50,
                _c_leave_slice: false,
                _d_from_htr: false,
                _e_ls_axis: vec![CubeAxis::UD, CubeAxis::FB, CubeAxis::LR],
            }
        }
    }

    impl Default for DRFinishBuilderInternal<false, false, false, false, false> {
        fn default() -> Self {
            Self::new()
        }
    }

    impl TryFrom<StepConfig> for DRFinishBuilderInternal<false, false, false, false, false> {
        type Error = ();

        fn try_from(value: StepConfig) -> Result<Self, Self::Error> {
            if !value.params.is_empty() {
                return Err(())
            }
            if value.kind != StepKind::FIN && value.kind != StepKind::FINLS {
                return Err(())
            }
            let mut defaults = Self::default();
            if let Some(max) = value.max {
                defaults._a_max_length = max as usize;
            }
            if let Some(abs_max) = value.absolute_max {
                defaults._b_max_absolute_length = abs_max as usize;
            }
            if value.kind == StepKind::FINLS {
                defaults._c_leave_slice = true;
            }
            if let Some(variants) = value.substeps {
                let axis: Result<Vec<CubeAxis>, Self::Error> = variants.into_iter()
                    .map(|variant| match variant.to_lowercase().as_str() {
                        "finishlsud" | "finlsud" | "finishud" | "finud" | "ud" => Ok(CubeAxis::UD),
                        "finishlsfd" | "finlsfb" | "finishfd" | "finfb" | "fb" => Ok(CubeAxis::FB),
                        "finishlslr" | "finlslr" | "finishlr" | "finlr" | "lr" => Ok(CubeAxis::LR),
                        _ => Err(()),
                    })
                    .collect();
                defaults._e_ls_axis = axis?;
            }
            Ok(defaults)
        }
    }
}
