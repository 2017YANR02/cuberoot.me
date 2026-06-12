use std::collections::HashMap;
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
use crate::steps::dr::coords::{DRUDEOFB_SIZE, DRUDEOFBCoord};
use crate::steps::dr::dr_config::{HTR_DR_UD_STATE_CHANGE_MOVES, PRE_AR_UD_EO_FB_MOVESET};
use crate::steps::eo::coords::EOCoordFB;

pub static EO_ARM_TABLE: LazyLock<EOARPruningTable> = LazyLock::new(gen_eo_ar);
pub type EOARPruningTable = Box<dyn DepthEstimate<{ DRUDEOFB_SIZE }, DRUDEOFBCoord>>;

const PRE_AR_UD_EO_FB_AUX_MOVES: &[Turn333] = &[
    Turn333::U2,
    Turn333::D2,
    Turn333::F2,
    Turn333::B2,
    Turn333::L, Turn333::Li, Turn333::L2,
    Turn333::R, Turn333::Ri, Turn333::R2
];
pub const ARUD_EOFB_MOVESET: MoveSet = MoveSet::new_qt_ht_ordered(HTR_DR_UD_STATE_CHANGE_MOVES, PRE_AR_UD_EO_FB_AUX_MOVES);

pub struct ARStep;
pub type ARBuilder = builder::ARBuilderInternal<false, false, false, false>;

impl ARStep {
    pub fn builder() -> ARBuilder {
        ARBuilder::default()
    }
}

impl ARStep {
    pub fn new(dfs: DFSParameters, arm_eo_axis: HashMap<CubeAxis, Vec<CubeAxis>>) -> StepGroup {
        debug!("Step ar with options {dfs:?}");
        let variants = arm_eo_axis.into_iter()
            .flat_map(move |(ar, eo)|eo.into_iter().map(move |eo|(eo, ar.clone())))
            .filter_map(|(eo, ar)|match (eo, ar) {
                (CubeAxis::UD, CubeAxis::FB) => Some((vec![Transformation333::X], StepVariant::AR { eo_axis: eo, dr_axis: ar })),
                (CubeAxis::UD, CubeAxis::LR) => Some((vec![Transformation333::X, Transformation333::Z], StepVariant::AR { eo_axis: eo, dr_axis: ar })),
                (CubeAxis::FB, CubeAxis::UD) => Some((vec![], StepVariant::AR { eo_axis: eo, dr_axis: ar })),
                (CubeAxis::FB, CubeAxis::LR) => Some((vec![Transformation333::Z], StepVariant::AR { eo_axis: eo, dr_axis: ar })),
                (CubeAxis::LR, CubeAxis::UD) => Some((vec![Transformation333::Y], StepVariant::AR { eo_axis: eo, dr_axis: ar })),
                (CubeAxis::LR, CubeAxis::FB) => Some((vec![Transformation333::Y, Transformation333::Z], StepVariant::AR { eo_axis: eo, dr_axis: ar })),
                _ => None,
            })
            .map(|(trans, variant)| StepGroup::single(Box::new(PruningTableStep::<DRUDEOFB_SIZE, DRUDEOFBCoord, 2048, EOCoordFB> {
                    table: &EO_ARM_TABLE,
                    options: dfs.clone(),
                    pre_step_trans: trans,
                    pre_step_check: vec![],
                    post_step_check: vec![],
                    move_set: &ARUD_EOFB_MOVESET,
                    variant,
                    _pc: Default::default(),
            })))
            .collect_vec();
        StepGroup::parallel(variants)
    }
}

fn gen_eo_ar() -> EOARPruningTable {
    Box::new(InMemoryIndexTable::load_and_save("eo-arm", ||lookup_table::generate(&PRE_AR_UD_EO_FB_MOVESET,
                                                                          &|c: &Cube333| DRUDEOFBCoord::from(c),
                                                                          &|| InMemoryIndexTable::new(false),
                                                                          &|table, coord|table.get(coord),
                                                                          &|table, coord, val|table.set(coord, val))).0)
}

pub mod builder {
    use std::collections::HashMap;
    use crate::cube::CubeAxis;
    use crate::defs::{NissSwitchType, StepKind};
    use crate::solver_new::ar::ARStep;
    use crate::solver_new::group::StepGroup;
    use crate::solver_new::step::DFSParameters;
    use crate::steps::step::StepConfig;

    pub struct ARBuilderInternal<const A: bool, const B: bool, const C: bool, const D: bool> {
        _a_max_length: usize,
        _b_max_absolute_length: usize,
        _c_niss: NissSwitchType,
        _d_ar_eo_axis: HashMap<CubeAxis, Vec<CubeAxis>>,
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool> ARBuilderInternal<A, B, C, D> {
        fn convert<const _A: bool, const _B: bool, const _C: bool, const _D: bool>(self) -> ARBuilderInternal<_A, _B, _C, _D> {
            ARBuilderInternal {
                _a_max_length: self._a_max_length,
                _b_max_absolute_length: self._b_max_absolute_length,
                _c_niss: self._c_niss,
                _d_ar_eo_axis: self._d_ar_eo_axis,
            }
        }
    }

    impl <const B: bool, const C: bool, const D: bool> ARBuilderInternal<false, B, C, D> {
        pub fn max_length(mut self, max_length: usize) -> ARBuilderInternal<true, B, C, D> {
            self._a_max_length = max_length;
            self.convert()
        }
    }

    impl <const A: bool, const C: bool, const D: bool> ARBuilderInternal<A, false, C, D> {
        pub fn max_absolute_length(mut self, max_absolute_length: usize) -> ARBuilderInternal<A, true, C, D> {
            self._b_max_absolute_length = max_absolute_length;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const D: bool> ARBuilderInternal<A, B, false, D> {
        pub fn niss(mut self, niss: NissSwitchType) -> ARBuilderInternal<A, B, true, D> {
            self._c_niss = niss;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool> ARBuilderInternal<A, B, C, false> {
        pub fn axis(mut self, arm_eo_axis: HashMap<CubeAxis, Vec<CubeAxis>>) -> ARBuilderInternal<A, B, C, true> {
            self._d_ar_eo_axis = arm_eo_axis;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool> ARBuilderInternal<A, B, C, D> {
        pub fn build(self) -> StepGroup {
            let dfs = DFSParameters {
                niss_type: self._c_niss,
                min_moves: 0,
                max_moves: self._a_max_length,
                absolute_max_moves: Some(self._b_max_absolute_length),
                ignore_previous_step_restrictions: false,
            };
            ARStep::new(dfs, self._d_ar_eo_axis)
        }
    }

    impl ARBuilderInternal<false, false, false, false> {
        pub fn new() -> Self {
            Self {
                _a_max_length: 7,
                _b_max_absolute_length: 10,
                _c_niss: NissSwitchType::Before,
                _d_ar_eo_axis: HashMap::from([(CubeAxis::X, vec![CubeAxis::Y, CubeAxis::Z]), (CubeAxis::Y, vec![CubeAxis::X, CubeAxis::Z]), (CubeAxis::Z, vec![CubeAxis::X, CubeAxis::Y])]),
            }
        }
    }

    impl Default for ARBuilderInternal<false, false, false, false> {
        fn default() -> Self {
            Self::new()
        }
    }

    impl TryFrom<StepConfig> for ARBuilderInternal<false, false, false, false> {
        type Error = ();

        fn try_from(value: StepConfig) -> Result<Self, Self::Error> {
            if !value.params.is_empty() {
                return Err(())
            }
            if value.kind != StepKind::AR {
                return Err(())
            }
            let mut defaults = Self::default();
            if let Some(max) = value.max {
                defaults._a_max_length = max as usize;
            }
            if let Some(abs_max) = value.absolute_max {
                defaults._b_max_absolute_length = abs_max as usize;
            }
            if let Some(niss) = value.niss {
                defaults._c_niss = niss;
            }
            if let Some(variants) = value.substeps {
                let axis: Result<Vec<(CubeAxis, CubeAxis)>, Self::Error> = variants.into_iter()
                    .map(|variant| match variant.to_lowercase().as_str() {
                        "ud" | "arud" => Ok(vec![(CubeAxis::UD, CubeAxis::FB), (CubeAxis::UD, CubeAxis::LR)]),
                        "fb" | "arfb" => Ok(vec![(CubeAxis::FB, CubeAxis::UD), (CubeAxis::FB, CubeAxis::LR)]),
                        "lr" | "arlr" => Ok(vec![(CubeAxis::LR, CubeAxis::UD), (CubeAxis::LR, CubeAxis::FB)]),

                        "eoud" => Ok(vec![(CubeAxis::FB, CubeAxis::UD), (CubeAxis::LR, CubeAxis::UD)]),
                        "eofb" => Ok(vec![(CubeAxis::UD, CubeAxis::FB), (CubeAxis::LR, CubeAxis::FB)]),
                        "eolr" => Ok(vec![(CubeAxis::UD, CubeAxis::FB), (CubeAxis::FB, CubeAxis::LR)]),

                        "arud-eofb" => Ok(vec![(CubeAxis::UD, CubeAxis::FB)]),
                        "arud-eolr" => Ok(vec![(CubeAxis::UD, CubeAxis::LR)]),
                        "arfb-eoud" => Ok(vec![(CubeAxis::FB, CubeAxis::UD)]),
                        "arfb-eolr" => Ok(vec![(CubeAxis::FB, CubeAxis::LR)]),
                        "arlr-eoud" => Ok(vec![(CubeAxis::LR, CubeAxis::UD)]),
                        "arlr-eofb" => Ok(vec![(CubeAxis::LR, CubeAxis::FB)]),
                        _ => Err(()),
                    })
                    .flat_map(|x|match x {
                        Ok(x) => x.into_iter().map(|item|Ok(item)).collect(),
                        Err(x) => vec![Err(x)],
                    })
                    .collect();
                let mut axis_map = HashMap::new();
                for (dr, eo) in axis? {
                    let e = axis_map.entry(dr);
                    let v = e.or_insert(vec![]);
                    if !v.contains(&eo) {
                        v.push(eo);
                    }
                }
                defaults._d_ar_eo_axis = axis_map;
            }
            Ok(defaults)
        }
    }
}