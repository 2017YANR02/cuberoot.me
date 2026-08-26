use std::sync::LazyLock;

use itertools::Itertools;
use log::debug;

use crate::cube::*;
use crate::defs::StepVariant;
use crate::solver::lookup_table;
use crate::solver::lookup_table::{DepthEstimate, InMemoryIndexTable};
use crate::solver_new::*;
use crate::solver_new::group::StepGroup;
use crate::solver_new::step::*;
use crate::steps::coord::ZeroCoord;
use crate::steps::eo::coords::EOCoordFB;
use crate::steps::eo::eo_config::{EO_FB_MOVESET};

pub static EO_TABLE: LazyLock<EOPruningTable> = LazyLock::new(gen_eo);
pub type EOPruningTable = Box<dyn DepthEstimate<2048, EOCoordFB>>;

const EOFB_ST_MOVES: &[Turn333] = &[
    Turn333::F, Turn333::Fi,
    Turn333::B, Turn333::Bi,
];

const EOFB_AUX_MOVES: &[Turn333] = &[
    Turn333::U, Turn333::Ui, Turn333::U2,
    Turn333::D, Turn333::Di, Turn333::D2,
    Turn333::F2,
    Turn333::B2,
    Turn333::L, Turn333::Li, Turn333::L2,
    Turn333::R, Turn333::Ri, Turn333::R2,
];

pub const EOFB_MOVESET: MoveSet = MoveSet::new_qt_ht_ordered(EOFB_ST_MOVES, EOFB_AUX_MOVES);

pub struct EOStep;
pub type EOBuilder = builder::EOBuilderInternal<false, false, false, false, false>;

impl EOStep {
    pub fn builder() -> EOBuilder {
        EOBuilder::default()
    }

    pub fn new(dfs: DFSParameters, axis: Vec<CubeAxis>) -> StepGroup {
        debug!("Step eo with options {dfs:?}");
        let variants = axis.into_iter()
            .map(|eo|match eo {
                CubeAxis::UD => (vec![Transformation333::X], StepVariant::EO(eo)),
                CubeAxis::FB => (vec![], StepVariant::EO(eo)),
                CubeAxis::LR => (vec![Transformation333::Y], StepVariant::EO(eo)),
            })
            .map(|(trans, variant)| StepGroup::single(Box::new(PruningTableStep::<2048, EOCoordFB, 0, ZeroCoord>  {
                table: &EO_TABLE,
                options: dfs.clone(),
                pre_step_trans: trans,
                pre_step_check: vec![],
                variant,
                post_step_check: vec![],
                move_set: &EOFB_MOVESET,
                _pc: Default::default(),
            })))
            .collect_vec();
        StepGroup::parallel(variants)
    }
}

fn gen_eo() -> EOPruningTable {
    Box::new(InMemoryIndexTable::load_and_save("eo", ||lookup_table::generate(&EO_FB_MOVESET,
                                                                      &|c: &crate::cube::Cube333| EOCoordFB::from(c),
                                                                      &|| InMemoryIndexTable::new(false),
                                                                      &|table, coord|table.get(coord),
                                                                      &|table, coord, val|table.set(coord, val))).0)
}

pub mod builder {
    use crate::cube::CubeAxis;
    use crate::defs::{NissSwitchType, StepKind};
    use crate::solver_new::eo::EOStep;
    use crate::solver_new::group::StepGroup;
    use crate::solver_new::step::DFSParameters;
    use crate::steps::step::StepConfig;

    pub struct EOBuilderInternal<const A: bool, const B: bool, const C: bool, const D: bool, const E: bool> {
        _a_max_length: usize,
        // _b_max_absolute_length: usize,
        _c_niss: NissSwitchType,
        _d_eo_axis: Vec<CubeAxis>,
        _e_min_length: usize,
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool, const E: bool> EOBuilderInternal<A, B, C, D, E> {
        fn convert<const _A: bool, const _B: bool, const _C: bool, const _D: bool, const _E: bool>(self) -> EOBuilderInternal<_A, _B, _C, _D, _E> {
            EOBuilderInternal {
                _a_max_length: self._a_max_length,
                // _b_max_absolute_length: self._b_max_absolute_length,
                _c_niss: self._c_niss,
                _d_eo_axis: self._d_eo_axis,
                _e_min_length: self._e_min_length,
            }
        }
    }

    impl <const B: bool, const C: bool, const D: bool, const E: bool> EOBuilderInternal<false, B, C, D, E> {
        pub fn max_length(mut self, max_length: usize) -> EOBuilderInternal<true, B, C, D, E> {
            self._a_max_length = max_length;
            self.convert()
        }
    }

    // impl <const A: bool, const C: bool, const D: bool, const E: bool> EOBuilderInternal<A, false, C, D, E> {
    //     pub fn max_absolute_length(mut self, max_absolute_length: usize) -> EOBuilderInternal<A, true, C, D, E> {
    //         self._b_max_absolute_length = max_absolute_length;
    //         self.convert()
    //     }
    // }

    impl <const A: bool, const B: bool, const D: bool, const E: bool> EOBuilderInternal<A, B, false, D, E> {
        pub fn niss(mut self, niss: NissSwitchType) -> EOBuilderInternal<A, B, true, D, E> {
            self._c_niss = niss;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const E: bool> EOBuilderInternal<A, B, C, false, E> {
        pub fn eo_axis(mut self, eo_axis: Vec<CubeAxis>) -> EOBuilderInternal<A, B, C, true, E> {
            self._d_eo_axis = eo_axis;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool> EOBuilderInternal<A, B, C, D, false> {
        pub fn min_length(mut self, min_length: usize) -> EOBuilderInternal<A, B, C, D, true> {
            self._e_min_length = min_length;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool, const E: bool> EOBuilderInternal<A, B, C, D, E> {
        pub fn build(self) -> StepGroup {
            let dfs = DFSParameters {
                niss_type: self._c_niss,
                min_moves: self._e_min_length,
                max_moves: self._a_max_length,
                absolute_max_moves: None,//Some(self._b_max_absolute_length),
                ignore_previous_step_restrictions: false,
            };
            EOStep::new(dfs, self._d_eo_axis)
        }
    }

    impl EOBuilderInternal<false, false, false, false, false> {
        pub fn new() -> Self {
            Self {
                _a_max_length: 5,
                // _b_max_absolute_length: 5,
                _e_min_length: 0,
                _c_niss: NissSwitchType::Always,
                _d_eo_axis: vec![CubeAxis::X, CubeAxis::Y, CubeAxis::Z],
            }
        }
    }

    impl Default for EOBuilderInternal<false, false, false, false, false> {
        fn default() -> Self {
            Self::new()
        }
    }

    impl TryFrom<StepConfig> for EOBuilderInternal<false, false, false, false, false> {
        type Error = ();

        fn try_from(value: StepConfig) -> Result<Self, Self::Error> {
            if !value.params.is_empty() {
                return Err(())
            }
            if value.kind != StepKind::EO {
                return Err(())
            }
            let mut defaults = Self::default();
            if let Some(max) = value.max {
                defaults._a_max_length = max as usize;
            }
            // if let Some(abs_max) = value.absolute_max {
            //     defaults._b_max_absolute_length = abs_max as usize;
            // }
            if let Some(niss) = value.niss {
                defaults._c_niss = niss;
            }
            if let Some(variants) = value.substeps {
                let axis: Result<Vec<CubeAxis>, Self::Error> = variants.into_iter()
                    .map(|variant| match variant.to_lowercase().as_str() {
                        "eoud" | "ud" => Ok(CubeAxis::UD),
                        "eofb" | "fb" => Ok(CubeAxis::FB),
                        "eolr" | "lr" => Ok(CubeAxis::LR),
                        _ => Err(()),
                    })
                    .collect();
                defaults._d_eo_axis = axis?;
            }
            if let Some(min) = value.min {
                defaults._e_min_length = min as usize;
            }
            Ok(defaults)
        }
    }
}