use std::sync::LazyLock;

use itertools::Itertools;
use log::debug;

use crate::cube::*;
use crate::defs::StepVariant;
use crate::solver::lookup_table;
use crate::solver::lookup_table::{DepthEstimate, NissDepthEstimate, SaveToDisk, InMemoryIndexTable, InMemoryNissIndexTable};
use crate::solver_new::*;
use crate::solver_new::group::StepGroup;
use crate::solver_new::step::*;
use crate::steps::dr::coords::{DRUDEOFB_SIZE, DRUDEOFBCoord};
use crate::steps::dr::dr_config::HTR_DR_UD_MOVESET;
use crate::steps::htr::coords::{HTRDRUD_SIZE, HTRDRUDCoord};

pub static HTR_TABLES: LazyLock<(HTRPruningTable, HTRSubsetTable)> = LazyLock::new(||gen_htr_with_subsets());
pub type HTRPruningTable = Box<dyn NissDepthEstimate<{HTRDRUD_SIZE}, HTRDRUDCoord>>;
pub type HTRSubsetTable = InMemoryIndexTable<{HTRDRUD_SIZE}, HTRDRUDCoord>;

const HTR_DRUD_ST_MOVES: &[Turn333] = &[
    Turn333::U, Turn333::Ui,
    Turn333::D, Turn333::Di,
];

const HTR_DRUD_AUX_MOVES: &[Turn333] = &[
    Turn333::U2, Turn333::D2,
    Turn333::F2, Turn333::B2,
    Turn333::L2, Turn333::R2,
];

pub const HTR_DRUD_MOVESET: MoveSet = MoveSet::new_qt_ht_ordered(HTR_DRUD_ST_MOVES, HTR_DRUD_AUX_MOVES);

pub struct HTRStep;
pub type HTRBuilder = builder::HTRBuilderInternal<false, false, false, false>;

impl HTRStep {
    pub fn builder() -> HTRBuilder {
        HTRBuilder::default()
    }
}

impl HTRStep {
    pub fn new(dfs: DFSParameters, dr_axis: Vec<CubeAxis>) -> StepGroup {
        debug!("Step htr with options {dfs:?}");
        let variants = dr_axis.into_iter()
            .map(|dr|match dr {
                CubeAxis::UD => (vec![], dr),
                CubeAxis::FB => (vec![Transformation333::X], dr),
                CubeAxis::LR => (vec![Transformation333::Z], dr),
            })
            .map(|(trans, dr)|{
                StepGroup::single(Box::new(NissPruningTableStep::<HTRDRUD_SIZE, HTRDRUDCoord, DRUDEOFB_SIZE, DRUDEOFBCoord>  {
                    table: &HTR_TABLES.0,
                    options: dfs.clone(),
                    pre_step_trans: trans,
                    variant: StepVariant::HTR(dr),
                    post_step_check: vec![],
                    move_set: &HTR_DRUD_MOVESET,
                    _pc: Default::default(),
                }))
            })
            .collect_vec();
        StepGroup::parallel(variants)
    }
}

fn gen_htr_with_subsets() -> (HTRPruningTable, HTRSubsetTable) {
    let mut htr_table = InMemoryNissIndexTable::load_and_save("htr", ||lookup_table::generate(&HTR_DR_UD_MOVESET,
                                               &|c: &Cube333| HTRDRUDCoord::from(c),
                                               &|| InMemoryNissIndexTable::new(),
                                               &|table, coord|table.get(coord),
                                               &|table, coord, val|table.set(coord, val)));
    let (htr_subset_table, generated) = InMemoryIndexTable::load_and_save("htr-subset", ||crate::steps::htr::subsets::gen_subset_tables(&mut htr_table));
    if generated {
        _ = htr_table.save_to_disk("333", "htr");
    }
    (Box::new(htr_table), htr_subset_table)
}


pub mod builder {
    use crate::cube::CubeAxis;
    use crate::defs::{NissSwitchType, StepKind};
    use crate::solver_new::group::StepGroup;
    use crate::solver_new::htr::HTRStep;
    use crate::solver_new::step::DFSParameters;
    use crate::steps::step::StepConfig;

    pub struct HTRBuilderInternal<const A: bool, const B: bool, const C: bool, const D: bool> {
        _a_max_length: usize,
        _b_max_absolute_length: usize,
        _c_niss: NissSwitchType,
        _d_dr_axis: Vec<CubeAxis>,
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool> HTRBuilderInternal<A, B, C, D> {
        fn convert<const _A: bool, const _B: bool, const _C: bool, const _D: bool>(self) -> HTRBuilderInternal<_A, _B, _C, _D> {
            HTRBuilderInternal {
                _a_max_length: self._a_max_length,
                _b_max_absolute_length: self._b_max_absolute_length,
                _c_niss: self._c_niss,
                _d_dr_axis: self._d_dr_axis,
            }
        }
    }

    impl <const B: bool, const C: bool, const D: bool> HTRBuilderInternal<false, B, C, D> {
        pub fn max_length(mut self, max_length: usize) -> HTRBuilderInternal<true, B, C, D> {
            self._a_max_length = max_length;
            self.convert()
        }
    }

    impl <const A: bool, const C: bool, const D: bool> HTRBuilderInternal<A, false, C, D> {
        pub fn max_absolute_length(mut self, max_absolute_length: usize) -> HTRBuilderInternal<A, true, C, D> {
            self._b_max_absolute_length = max_absolute_length;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const D: bool> HTRBuilderInternal<A, B, false, D> {
        pub fn niss(mut self, niss: NissSwitchType) -> HTRBuilderInternal<A, B, true, D> {
            self._c_niss = niss;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool> HTRBuilderInternal<A, B, C, false> {
        pub fn dr_axis(mut self, eo_axis: Vec<CubeAxis>) -> HTRBuilderInternal<A, B, C, true> {
            self._d_dr_axis = eo_axis;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool> HTRBuilderInternal<A, B, C, D> {
        pub fn build(self) -> StepGroup {
            let dfs = DFSParameters {
                niss_type: self._c_niss,
                min_moves: 0,
                max_moves: self._a_max_length,
                absolute_max_moves: Some(self._b_max_absolute_length),
                ignore_previous_step_restrictions: true,
            };
            HTRStep::new(dfs, self._d_dr_axis)
        }
    }

    impl HTRBuilderInternal<false, false, false, false> {
        pub fn new() -> Self {
            Self {
                _a_max_length: 14,
                _b_max_absolute_length: 30,
                _c_niss: NissSwitchType::Before,
                _d_dr_axis: vec![CubeAxis::X, CubeAxis::Y, CubeAxis::Z],
            }
        }
    }

    impl Default for HTRBuilderInternal<false, false, false, false> {
        fn default() -> Self {
            Self::new()
        }
    }

    impl TryFrom<StepConfig> for HTRBuilderInternal<false, false, false, false> {
        type Error = ();

        fn try_from(value: StepConfig) -> Result<Self, Self::Error> {
            if !value.params.is_empty() {
                return Err(())
            }
            if value.kind != StepKind::HTR {
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
                let axis: Result<Vec<CubeAxis>, Self::Error> = variants.into_iter()
                    .map(|variant| match variant.to_lowercase().as_str() {
                        "htrud" | "ud" => Ok(CubeAxis::UD),
                        "htrfb" | "fb" => Ok(CubeAxis::FB),
                        "htrlr" | "lr" => Ok(CubeAxis::LR),
                        _ => Err(()),
                    })
                    .collect();
                defaults._d_dr_axis = axis?;
            }
            Ok(defaults)
        }
    }
}