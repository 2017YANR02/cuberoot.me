use std::cmp::min;
use std::collections::HashMap;
use std::sync::LazyLock;

use itertools::Itertools;
use log::{debug, warn, error};

use crate::algs::Algorithm;
use crate::cube::*;
use crate::cube::turn::{TransformableMut, TurnableMut};
use crate::defs::StepVariant;
use crate::solver::lookup_table;
use crate::solver::lookup_table::{DepthEstimate, InMemoryIndexTable};
use crate::solver::solution::Solution;
use crate::solver_new::*;
use crate::solver_new::dr::builder::RZPSettings;
use crate::solver_new::group::StepGroup;
use crate::solver_new::htr::HTR_TABLES;
use crate::solver_new::step::*;
use crate::solver_new::util_cube::CubeState;
use crate::steps::coord::Coord;
use crate::steps::dr::co::COCountUD;
use crate::steps::dr::coords::{DRUDEOFB_SIZE, DRUDEOFBCoord};
use crate::steps::dr::dr_config::{ARM_UD_EO_FB_MOVESET, DR_UD_EO_FB_MOVESET, HTR_MOVES};
use crate::steps::eo::coords::{BadEdgeCount, EOCoordFB};
use crate::steps::htr::coords::HTRDRUDCoord;
use crate::steps::htr::subsets::{DR_SUBSETS, DRSubsetFilter, Subset};
use crate::steps::step::PostStepCheck;

pub type DRPruningTable = Box<dyn DepthEstimate<{DRUDEOFB_SIZE}, DRUDEOFBCoord>>;
pub static DR_TABLE: LazyLock<DRPruningTable> = LazyLock::new(gen_dr);
pub type ARDRPruningTable = Box<dyn DepthEstimate<{DRUDEOFB_SIZE}, DRUDEOFBCoord>>;
pub static AR_DR_TABLE: LazyLock<ARDRPruningTable> = LazyLock::new(gen_ar_dr);

const DRUD_EOFB_ST_MOVES: &[Turn333] = &[
    Turn333::L, Turn333::Li,
    Turn333::R, Turn333::Ri,
];

const DRUD_EOFB_AUX_MOVES: &[Turn333] = &[
    Turn333::U, Turn333::Ui, Turn333::U2,
    Turn333::D, Turn333::Di, Turn333::D2,
    Turn333::F2,
    Turn333::B2,
    Turn333::L2,
    Turn333::R2,
];

const DRUF_PRE_TRIGGER_ST_MOVES: &[Turn333] = &[
    Turn333::U, Turn333::Ui,
    Turn333::D, Turn333::Di,
];

const DRUF_PRE_TRIGGER_AUX_MOVES: &[Turn333] = &[
    Turn333::U2,
    Turn333::D2,
    Turn333::F2,
    Turn333::B2,
    Turn333::L2,
    Turn333::R2,
];


pub type DRBuilder = builder::DRBuilderInternal<false, false, false, false, false, false, false, false>;
pub type RZPBuilder = builder::RZPBuilderInternal<false, false, false>;

pub const DRUD_ARUD_MOVESET: MoveSet = MoveSet::new_qt_ht_ordered(DRUD_EOFB_ST_MOVES, HTR_MOVES);
pub const DRUD_EOFB_MOVESET: MoveSet = MoveSet::new_qt_ht_ordered(DRUD_EOFB_ST_MOVES, DRUD_EOFB_AUX_MOVES);
pub const DR_TRIGGER_MOVESET: MoveSet = MoveSet::new_unordered(DRUD_EOFB_ST_MOVES, DRUD_EOFB_AUX_MOVES);
pub const DRUD_PRE_TRIGGER_MOVESET: MoveSet = MoveSet::new_qt_ht_ordered(DRUF_PRE_TRIGGER_ST_MOVES, DRUF_PRE_TRIGGER_AUX_MOVES);
pub const DRUD_EOFB_POST_TRIGGER_MOVESET: MoveSet = DRUD_EOFB_MOVESET;

pub struct DRStep;

impl DRStep {
    pub fn builder() -> DRBuilder {
        DRBuilder::default()
    }

    pub fn new(dfs: DFSParameters, axis: HashMap<CubeAxis, Vec<CubeAxis>>, subsets: Vec<Subset>, from_ar: bool) -> StepGroup {
        debug!("Step dr with options {dfs:?}");
        let variants = axis.into_iter()
            .flat_map(move |(dr, eo)|eo.into_iter().map(move |eo|(eo, dr.clone())))
            .filter_map(|(eo,dr)|match (eo, dr) {
                (CubeAxis::UD, CubeAxis::FB) => Some((dr, vec![Transformation333::X], StepVariant::DR { eo_axis: eo, dr_axis: dr })),
                (CubeAxis::UD, CubeAxis::LR) => Some((dr, vec![Transformation333::X, Transformation333::Z], StepVariant::DR { eo_axis: eo, dr_axis: dr })),
                (CubeAxis::FB, CubeAxis::UD) => Some((dr, vec![], StepVariant::DR { eo_axis: eo, dr_axis: dr })),
                (CubeAxis::FB, CubeAxis::LR) => Some((dr, vec![Transformation333::Z], StepVariant::DR { eo_axis: eo, dr_axis: dr })),
                (CubeAxis::LR, CubeAxis::UD) => Some((dr, vec![Transformation333::Y], StepVariant::DR { eo_axis: eo, dr_axis: dr })),
                (CubeAxis::LR, CubeAxis::FB) => Some((dr, vec![Transformation333::Y, Transformation333::Z], StepVariant::DR { eo_axis: eo, dr_axis: dr })),
                _ => None,
            })
            .map(|x|{
                let mut post_checks: Vec<Box<dyn PostStepCheck + Send>> = vec![];
                if !subsets.is_empty() {
                    post_checks.push(Box::new(DRSubsetFilter::new_subset(&HTR_TABLES.1, &subsets)));
                }
                (x, post_checks)
            })
            .map(|((_, trans, variant), psc)| {
                if from_ar {
                    StepGroup::single(Box::new(DRARStep {
                        table: &AR_DR_TABLE,
                        options: dfs.clone(),
                        pre_step_trans: trans,
                        post_step_check: psc,
                        variant,
                    }))
                } else {
                    StepGroup::single(Box::new(PruningTableStep::<DRUDEOFB_SIZE, DRUDEOFBCoord, 2048, EOCoordFB> {
                        table: &DR_TABLE,
                        options: dfs.clone(),
                        pre_step_check: vec![],
                        pre_step_trans: trans,
                        post_step_check: psc,
                        move_set: &DRUD_EOFB_MOVESET,
                        variant,
                        _pc: Default::default(),
                    }))
                }
            })
            .collect_vec();
        StepGroup::parallel(variants)
    }

    pub fn new_with_triggers(dfs_dr: DFSParameters, axis: HashMap<CubeAxis, Vec<CubeAxis>>, subsets: Vec<Subset>, triggers: Vec<Algorithm>, rzp_settings: RZPSettings) -> StepGroup {
        debug!("Step rzp with options {:?}", rzp_settings.dfs);
        debug!("Step dr with options {dfs_dr:?}");
        let mut trigger_variants = vec![];
        let mut trigger_types: HashMap<(u8, u8), usize> = HashMap::new();
        for trigger in triggers.into_iter() {
            let mut cube = Cube333::default();
            for (m, len) in trigger.normal_moves.iter().rev().zip(1..) {
                cube.turn(m.clone());
                if DR_UD_EO_FB_MOVESET.st_moves.contains(m) {
                    let rzp_state = calc_rzp_state(&cube);
                    let e = trigger_types.entry(rzp_state).or_default();
                    *e = (*e).max(len);
                    debug!("Registering {}c/{}e trigger with length {}", rzp_state.0, rzp_state.1, len);
                }
            }
            trigger_variants.append(&mut Self::generate_trigger_variations(trigger));
        }

        let variants = axis.into_iter()
            .flat_map(move |(dr, eo)|eo.into_iter().map(move |eo|(eo, dr.clone())))
            .filter_map(|(eo,dr)|match (eo, dr) {
                (CubeAxis::UD, CubeAxis::FB) => Some((vec![Transformation333::X], (eo, dr))),
                (CubeAxis::UD, CubeAxis::LR) => Some((vec![Transformation333::X, Transformation333::Z], (eo, dr))),
                (CubeAxis::FB, CubeAxis::UD) => Some((vec![], (eo, dr))),
                (CubeAxis::FB, CubeAxis::LR) => Some((vec![Transformation333::Z], (eo, dr))),
                (CubeAxis::LR, CubeAxis::UD) => Some((vec![Transformation333::Y], (eo, dr))),
                (CubeAxis::LR, CubeAxis::FB) => Some((vec![Transformation333::Y, Transformation333::Z], (eo, dr))),
                _ => None,
            })
            .map(|x|{
                let mut post_checks: Vec<Box<dyn PostStepCheck + Send>> = vec![];
                if !subsets.is_empty() {
                    post_checks.push(Box::new(DRSubsetFilter::new_subset(&HTR_TABLES.1, &subsets)));
                }
                (x, post_checks)
            })
            .map(|((trans, (eo, dr)), psc)|{
                let rzp = StepGroup::single(Box::new(RZPStep {
                    dfs: rzp_settings.dfs.clone(),
                    pre_step_trans: trans.clone(),
                    variant: StepVariant::RZP {
                        eo_axis: eo,
                        dr_axis: dr,
                    },
                }));
                let dr_trigger = StepGroup::single(Box::new(DRTriggerStep {
                    table: &DR_TABLE,
                    options: dfs_dr.clone(),
                    pre_step_trans: trans,
                    post_step_check: psc,
                    variant: StepVariant::DR {
                        eo_axis: eo,
                        dr_axis: dr,
                    },
                    trigger_variants: trigger_variants.clone(),
                    trigger_types: trigger_types.clone(),
                }));
                StepGroup::sequential(vec![rzp, dr_trigger])
            })
            .collect_vec();
        StepGroup::parallel(variants)
    }

    fn generate_trigger_variations(mut trigger: Algorithm) -> Vec<Vec<Turn333>> {
        if !trigger.inverse_moves.is_empty() {
            error!("Triggers with inverse components are not supported");
            return vec![];
        }
        if let Some(last) = trigger.normal_moves.last() {
            if !last.face.is_on_axis(CubeAxis::LR) || last.dir == Direction::Half {
                warn!("Ignoring DRUD triggers that don't end with R R' L or L'");
                return vec![];
            }
        } else {
            warn!("Ignoring empty triggers");
            return vec![];
        };
        let mut triggers: Vec<Vec<Turn333>> = vec![];
        triggers.push(trigger.normal_moves.clone());
        trigger.transform(Transformation333::new(CubeAxis::UD, Direction::Half));
        triggers.push(trigger.normal_moves.clone());
        trigger.transform(Transformation333::new(CubeAxis::FB, Direction::Half));
        triggers.push(trigger.normal_moves.clone());
        trigger.transform(Transformation333::new(CubeAxis::UD, Direction::Half));
        triggers.push(trigger.normal_moves.clone());
        trigger.transform(Transformation333::new(CubeAxis::FB, Direction::Half));
        trigger.mirror(CubeAxis::LR);
        triggers.push(trigger.normal_moves.clone());
        trigger.transform(Transformation333::new(CubeAxis::UD, Direction::Half));
        triggers.push(trigger.normal_moves.clone());
        trigger.transform(Transformation333::new(CubeAxis::FB, Direction::Half));
        triggers.push(trigger.normal_moves.clone());
        trigger.transform(Transformation333::new(CubeAxis::UD, Direction::Half));
        triggers.push(trigger.normal_moves.clone());

        triggers.into_iter()
            .map(|mut moves| {
                let last = moves.len() - 1;
                moves[last] = Turn333::new(moves[last].face, Direction::Clockwise);
                moves
            })
            .unique()
            .collect_vec()
    }
}

struct DRARStep {
    table: &'static ARDRPruningTable,
    options: DFSParameters,
    pre_step_trans: Vec<Transformation333>,
    variant: StepVariant,
    post_step_check: Vec<Box<dyn PostStepCheck + Send + 'static>>,
}

impl PreStepCheck for DRARStep {
    fn is_cube_ready(&self, cube: &Cube333, _: Option<&Solution>) -> bool {
        if EOCoordFB::from(cube).val() != 0 {
            return false;
        }
        if DRUDEOFBCoord::from(cube).val() == 0 {
            return true;
        }
        true
    }
}

impl PostStepCheck for DRARStep {
    fn is_solution_admissible(&self, cube: &Cube333, alg: &Algorithm) -> bool {
        self.post_step_check.iter()
            .all(|psc|psc.is_solution_admissible(cube, alg))
    }
}

impl Step for DRARStep {
    fn get_dfs_parameters(&self) -> DFSParameters {
        self.options.clone()
    }

    fn get_moveset(&self, _: &Cube333, _: usize) -> &MoveSet {
        &DRUD_ARUD_MOVESET
    }

    fn heuristic(&self, state: &Cube333, can_niss_switch: bool, _: usize) -> usize {
        let coord = DRUDEOFBCoord::from(state);
        let heuristic = self.table.get(coord) as usize;
        if can_niss_switch {
            min(1, heuristic)
        } else {
            heuristic
        }
    }

    fn pre_step_trans(&self) -> &'_ Vec<Transformation333> {
        &self.pre_step_trans
    }

    fn get_variant(&self) -> StepVariant {
        self.variant
    }
}


struct DRTriggerStep {
    table: &'static DRPruningTable,
    options: DFSParameters,
    pre_step_trans: Vec<Transformation333>,
    variant: StepVariant,
    post_step_check: Vec<Box<dyn PostStepCheck + Send + 'static>>,
    trigger_types: HashMap<(u8, u8), usize>,
    trigger_variants: Vec<Vec<Turn333>>,
}

impl PreStepCheck for DRTriggerStep {
    fn is_cube_ready(&self, cube: &Cube333, _: Option<&Solution>) -> bool {
        if EOCoordFB::from(cube).val() != 0 {
            return false;
        }
        if DRUDEOFBCoord::from(cube).val() == 0 {
            return true;
        }
        let trigger_state = calc_rzp_state(cube);
        self.trigger_types.contains_key(&trigger_state)
    }
}

impl PostStepCheck for DRTriggerStep {
    fn is_solution_admissible(&self, cube: &Cube333, alg: &Algorithm) -> bool {
        if alg.len() > 0 && !filter_dr_trigger(alg, &self.trigger_variants) {
            false
        } else {
            self.post_step_check.iter()
                .all(|psc| psc.is_solution_admissible(cube, alg))
        }
    }
}

fn filter_dr_trigger(alg: &Algorithm, triggers: &Vec<Vec<Turn333>>) -> bool {
    if alg.len() == 0 {
        return true;
    }
    let mut temp_alg = alg.clone();
    if !temp_alg.normal_moves.is_empty() {
        let last_id = temp_alg.normal_moves.len() - 1;
        let last = temp_alg.normal_moves[last_id];
        temp_alg.normal_moves[last_id] = Turn333::new(last.face, if last.dir == Direction::Half { Direction::Half } else {Direction::Clockwise});
        let normal_match = triggers.iter()
            .any(|trigger|temp_alg.normal_moves.ends_with(trigger));
        if normal_match {
            return true;
        }
    }
    if !temp_alg.inverse_moves.is_empty() {
        let last_id = temp_alg.inverse_moves.len() - 1;
        let last = temp_alg.inverse_moves[last_id];
        temp_alg.inverse_moves[last_id] = Turn333::new(last.face, if last.dir == Direction::Half { Direction::Half } else {Direction::Clockwise});
        let inverse_match = triggers.iter()
            .any(|trigger|temp_alg.inverse_moves.ends_with(trigger));
        if inverse_match {
            return true;
        }
    }
    return false;
}

impl Step for DRTriggerStep {
    fn get_dfs_parameters(&self) -> DFSParameters {
        self.options.clone()
    }

    fn get_moveset(&self, state: &Cube333, depth_left: usize) -> &'_ MoveSet {
        let rzp_state = calc_rzp_state(state);
        if let Some(trigger_length) = self.trigger_types.get(&rzp_state) {
            if *trigger_length >= depth_left {
                &DR_TRIGGER_MOVESET
            } else {
                &DRUD_PRE_TRIGGER_MOVESET
            }
        } else {
            &DRUD_PRE_TRIGGER_MOVESET
        }
    }

    fn heuristic(&self, state: &Cube333, can_niss_switch: bool, _: usize) -> usize {
        let coord = DRUDEOFBCoord::from(state);
        let heuristic = self.table.get(coord);
        if can_niss_switch {
            min(1, heuristic as usize)
        } else {
            heuristic as usize
        }
    }

    fn pre_step_trans(&self) -> &'_ Vec<Transformation333> {
        &self.pre_step_trans
    }

    fn get_variant(&self) -> StepVariant {
        self.variant
    }
}

pub struct RZPStep {
    dfs: DFSParameters,
    pre_step_trans: Vec<Transformation333>,
    variant: StepVariant
}

impl RZPStep {
    pub fn builder() -> RZPBuilder {
        RZPBuilder::default()
    }
}

impl PreStepCheck for RZPStep {
    fn is_cube_ready(&self, cube: &Cube333, _: Option<&Solution>) -> bool {
        cube.count_bad_edges_fb() == 0
    }
}

impl PostStepCheck for RZPStep {
    fn is_solution_admissible(&self, _: &Cube333, _: &Algorithm) -> bool {
        true
    }
}

impl Step for RZPStep {
    fn get_dfs_parameters(&self) -> DFSParameters {
        self.dfs.clone()
    }

    fn get_moveset(&self, _: &Cube333, _: usize) -> &'_ MoveSet {
        &DRUD_EOFB_MOVESET
    }

    fn heuristic(&self, _: &Cube333, _: bool, depth_left: usize) -> usize {
        depth_left
    }

    fn pre_step_trans(&self) -> &'_ Vec<Transformation333> {
        &self.pre_step_trans
    }

    fn get_variant(&self) -> StepVariant {
        self.variant
    }
}

fn calc_rzp_state(cube: &Cube333) -> (u8, u8) {
    let eo_count_lr = cube.edges.count_bad_edges_lr();
    let co_count_ud = COCountUD::co_count(cube);
    (co_count_ud, eo_count_lr as u8)
}

fn gen_dr() -> DRPruningTable {
    Box::new(InMemoryIndexTable::load_and_save("dr", ||lookup_table::generate(&DR_UD_EO_FB_MOVESET,
                                                                      &|c: &Cube333| DRUDEOFBCoord::from(c),
                                                                      &|| InMemoryIndexTable::new(false),
                                                                      &|table, coord|table.get(coord),
                                                                      &|table, coord, val|table.set(coord, val))).0)
}

fn gen_ar_dr() -> ARDRPruningTable {
    Box::new(InMemoryIndexTable::load_and_save("arm-dr", ||lookup_table::generate(&ARM_UD_EO_FB_MOVESET,
                                                                          &|c: &Cube333| DRUDEOFBCoord::from(c),
                                                                          &|| InMemoryIndexTable::new(false),
                                                                          &|table, coord|table.get(coord),
                                                                          &|table, coord, val|table.set(coord, val))).0)
}

impl Cube333 {
    pub fn get_dr_subset(&self) -> Option<Subset>{
        let state = self.get_cube_state();
        match state {
            CubeState::Scrambled | CubeState::EO(_) => None,
            CubeState::DR(axis) => {
                let mut cube = self.clone();
                cube.transform(match axis {
                    CubeAxis::UD => Transformation333::Y,
                    CubeAxis::FB => Transformation333::X,
                    CubeAxis::LR => Transformation333::Z,
                });
                Some(DR_SUBSETS[HTR_TABLES.1.get(HTRDRUDCoord::from(&cube)) as usize])
            },
            CubeState::TripleDR => {
                Some(DR_SUBSETS[HTR_TABLES.1.get(HTRDRUDCoord::from(self)) as usize])
            },
            _ => Some(DR_SUBSETS[0])
        }
    }
}

mod builder {
    use std::collections::HashMap;

    use crate::algs::Algorithm;
    use crate::cube::CubeAxis;
    use crate::defs::{NissSwitchType, StepKind};
    use crate::solver_new::dr::DRStep;
    use crate::solver_new::group::StepGroup;
    use crate::solver_new::step::DFSParameters;
    use crate::steps::step::StepConfig;
    use crate::steps::util::{expand_subset_name, Subset};

    pub struct DRBuilderInternal<const A: bool, const B: bool, const C: bool, const D: bool, const E: bool, const F: bool, const G: bool, const H: bool> {
        _a_max_length: usize,
        _b_max_absolute_length: usize,
        _c_niss: NissSwitchType,
        _d_dr_eo_axis: HashMap<CubeAxis, Vec<CubeAxis>>,
        _e_subsets: Vec<Subset>,
        _f_triggers: Vec<Algorithm>,
        _g_rzp_options: Option<RZPSettings>,
        _h_from_ar: bool,
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool, const E: bool, const F: bool, const G: bool, const H: bool> DRBuilderInternal<A, B, C, D, E, F, G, H> {
        fn convert<const _A: bool, const _B: bool, const _C: bool, const _D: bool, const _E: bool, const _F: bool, const _G: bool, const _H: bool>(self) -> DRBuilderInternal<_A, _B, _C, _D, _E, _F, _G, _H> {
            DRBuilderInternal {
                _a_max_length: self._a_max_length,
                _b_max_absolute_length: self._b_max_absolute_length,
                _c_niss: self._c_niss,
                _d_dr_eo_axis: self._d_dr_eo_axis,
                _e_subsets: self._e_subsets,
                _f_triggers: self._f_triggers,
                _g_rzp_options: self._g_rzp_options,
                _h_from_ar: self._h_from_ar,
            }
        }
    }

    impl <const B: bool, const C: bool, const D: bool, const E: bool, const F: bool, const G: bool, const H: bool> DRBuilderInternal<false, B, C, D, E, F, G, H> {
        pub fn max_length(mut self, max_length: usize) -> DRBuilderInternal<true, B, C, D, E, F, G, H> {
            self._a_max_length = max_length;
            self.convert()
        }
    }

    impl <const A: bool, const C: bool, const D: bool, const E: bool, const F: bool, const G: bool, const H: bool> DRBuilderInternal<A, false, C, D, E, F, G, H> {
        pub fn max_absolute_length(mut self, max_absolute_length: usize) -> DRBuilderInternal<A, true, C, D, E, F, G, H> {
            self._b_max_absolute_length = max_absolute_length;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const D: bool, const E: bool, const F: bool, const G: bool, const H: bool> DRBuilderInternal<A, B, false, D, E, F, G, H> {
        pub fn niss(mut self, niss: NissSwitchType) -> DRBuilderInternal<A, B, true, D, E, F, G, H> {
            self._c_niss = niss;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const E: bool, const F: bool, const G: bool, const H: bool> DRBuilderInternal<A, B, C, false, E, F, G, H> {
        pub fn axis<T: IntoIterator<Item = CubeAxis>>(mut self, dr_eo_axis: T) -> DRBuilderInternal<A, B, C, true, E, F, G, H> {
            self._d_dr_eo_axis = dr_eo_axis.into_iter()
                .map(|x|(x, match x {
                    CubeAxis::UD => vec![CubeAxis::FB, CubeAxis::LR],
                    CubeAxis::FB => vec![CubeAxis::UD, CubeAxis::LR],
                    CubeAxis::LR => vec![CubeAxis::UD, CubeAxis::FB],
                }))
                .collect();
            self.convert()
        }

        pub fn dr_eo_axis(mut self, dr_eo_axis: HashMap<CubeAxis, Vec<CubeAxis>>) -> DRBuilderInternal<A, B, C, true, E, F, G, H> {
            self._d_dr_eo_axis = dr_eo_axis;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool, const F: bool, const G: bool, const H: bool> DRBuilderInternal<A, B, C, D, false, F, G, H> {
        pub fn subsets(mut self, subsets: Vec<Subset>) -> DRBuilderInternal<A, B, C, D, true, F, G, H> {
            self._e_subsets = subsets;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool, const E: bool, const F: bool, const G: bool, const H: bool> DRBuilderInternal<A, B, C, D, E, F, G, H> {
        pub fn add_subset(mut self, subset: Subset) -> DRBuilderInternal<A, B, C, D, true, F, G, H> {
            self._e_subsets.push(subset);
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const E: bool, const D: bool, const F: bool, const G: bool, const H: bool> DRBuilderInternal<A, B, C, D, E, F, G, H> {
        pub fn add_subsets<Y: AsRef<Subset>, X: IntoIterator<Item = Y>>(mut self, subsets: X) -> DRBuilderInternal<A, B, C, D, true, F, G, H> {
            for subset in subsets.into_iter() {
                self._e_subsets.push(subset.as_ref().clone());
            }
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool, const E: bool, const G: bool, const H: bool> DRBuilderInternal<A, B, C, D, E, false, G, H> {
        pub fn triggers(mut self, triggers: Vec<Algorithm>) -> DRBuilderInternal<A, B, C, D, E, true, G, H> {
            self._f_triggers = triggers;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool, const E: bool, const F: bool> DRBuilderInternal<A, B, C, D, E, F, false, false> {
        pub fn rzp<T: Into<RZPSettings>>(mut self, rzp: T) -> DRBuilderInternal<A, B, C, D, E, F, true, false> {
            self._g_rzp_options = Some(rzp.into());
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool, const E: bool> DRBuilderInternal<A, B, C, D, E, false, false, false> {
        pub fn from_ar(mut self) -> DRBuilderInternal<A, B, C, D, E, false, false, true> {
            self._h_from_ar = true;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool, const E: bool> DRBuilderInternal<A, B, C, D, E, true, true, false> {
        pub fn build(self) -> StepGroup {
            let dfs = DFSParameters {
                niss_type: self._c_niss,
                min_moves: 0,
                max_moves: self._a_max_length,
                absolute_max_moves: Some(self._b_max_absolute_length),
                ignore_previous_step_restrictions: false,
            };
            DRStep::new_with_triggers(dfs, self._d_dr_eo_axis, self._e_subsets, self._f_triggers, self._g_rzp_options.expect("Guaranteed by the type system"))
        }
    }

    impl <const A: bool, const B: bool, const C: bool, const D: bool, const E: bool, const H: bool> DRBuilderInternal<A, B, C, D, E, false, false, H> {
        pub fn build(self) -> StepGroup {
            let dfs = DFSParameters {
                niss_type: self._c_niss,
                min_moves: 0,
                max_moves: self._a_max_length,
                absolute_max_moves: Some(self._b_max_absolute_length),
                ignore_previous_step_restrictions: false,
            };
            DRStep::new(dfs, self._d_dr_eo_axis, self._e_subsets, self._h_from_ar)
        }
    }

    impl DRBuilderInternal<false, false, false, false, false, false, false, false> {
        pub fn new() -> Self {
            Self {
                _a_max_length: 10,
                _b_max_absolute_length: 15,
                _c_niss: NissSwitchType::Before,
                _d_dr_eo_axis: HashMap::from([(CubeAxis::X, vec![CubeAxis::Y, CubeAxis::Z]), (CubeAxis::Y, vec![CubeAxis::X, CubeAxis::Z]), (CubeAxis::Z, vec![CubeAxis::X, CubeAxis::Y])]),
                _e_subsets: vec![],
                _f_triggers: vec![],
                _g_rzp_options: None,
                _h_from_ar: false,
            }
        }
    }

    impl Default for DRBuilderInternal<false, false, false, false, false, false, false, false> {
        fn default() -> Self {
            Self::new()
        }
    }

    impl TryFrom<StepConfig> for DRBuilderInternal<false, false, false, false, false, false, false, false> {
        type Error = ();

        fn try_from(mut value: StepConfig) -> Result<Self, Self::Error> {
            if value.kind != StepKind::DR {
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
                        "ud" | "drud" => Ok(vec![(CubeAxis::UD, CubeAxis::FB), (CubeAxis::UD, CubeAxis::LR)]),
                        "fb" | "drfb" => Ok(vec![(CubeAxis::FB, CubeAxis::UD), (CubeAxis::FB, CubeAxis::LR)]),
                        "lr" | "drlr" => Ok(vec![(CubeAxis::LR, CubeAxis::UD), (CubeAxis::LR, CubeAxis::FB)]),

                        "eoud" => Ok(vec![(CubeAxis::FB, CubeAxis::UD), (CubeAxis::LR, CubeAxis::UD)]),
                        "eofb" => Ok(vec![(CubeAxis::UD, CubeAxis::FB), (CubeAxis::LR, CubeAxis::FB)]),
                        "eolr" => Ok(vec![(CubeAxis::UD, CubeAxis::FB), (CubeAxis::FB, CubeAxis::LR)]),

                        "drud-eofb" => Ok(vec![(CubeAxis::UD, CubeAxis::FB)]),
                        "drud-eolr" => Ok(vec![(CubeAxis::UD, CubeAxis::LR)]),
                        "drfb-eoud" => Ok(vec![(CubeAxis::FB, CubeAxis::UD)]),
                        "drfb-eolr" => Ok(vec![(CubeAxis::FB, CubeAxis::LR)]),
                        "drlr-eoud" => Ok(vec![(CubeAxis::LR, CubeAxis::UD)]),
                        "drlr-eofb" => Ok(vec![(CubeAxis::LR, CubeAxis::FB)]),
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
                defaults._d_dr_eo_axis = axis_map;
            }
            if let Some(subsets) = value.params.remove("subsets") {
                defaults._e_subsets = subsets.split(",")
                    .flat_map(expand_subset_name)
                    .collect();
            }
            if !value.params.is_empty() {
                return Err(())
            }
            Ok(defaults)
        }
    }

    pub struct RZPSettings {
        pub(crate) dfs: DFSParameters
    }

    pub struct RZPBuilderInternal<const A: bool, const B: bool, const C: bool> {
        _a_max_length: usize,
        _b_max_absolute_length: usize,
        _c_niss: NissSwitchType,
    }

    impl <const A: bool, const B: bool, const C: bool> RZPBuilderInternal<A, B, C> {
        fn convert<const _A: bool, const _B: bool, const _C: bool>(self) -> RZPBuilderInternal<_A, _B, _C> {
            RZPBuilderInternal {
                _a_max_length: self._a_max_length,
                _b_max_absolute_length: self._b_max_absolute_length,
                _c_niss: self._c_niss,
            }
        }
    }

    impl <const B: bool, const C: bool> RZPBuilderInternal<false, B, C> {
        pub fn max_length(mut self, max_length: usize) -> RZPBuilderInternal<true, B, C> {
            self._a_max_length = max_length;
            self.convert()
        }
    }

    impl <const A: bool, const C: bool> RZPBuilderInternal<A, false, C> {
        pub fn max_absolute_length(mut self, max_absolute_length: usize) -> RZPBuilderInternal<A, true, C> {
            self._b_max_absolute_length = max_absolute_length;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool> RZPBuilderInternal<A, B, false> {
        pub fn niss(mut self, niss: NissSwitchType) -> RZPBuilderInternal<A, B, true> {
            self._c_niss = niss;
            self.convert()
        }
    }

    impl <const A: bool, const B: bool, const C: bool> RZPBuilderInternal<A, B, C> {
        pub fn build(self) -> RZPSettings {
            RZPSettings {
                dfs: DFSParameters {
                    niss_type: self._c_niss,
                    min_moves: 0,
                    max_moves: self._a_max_length,
                    absolute_max_moves: Some(self._b_max_absolute_length),
                    ignore_previous_step_restrictions: false,
                }
            }
        }
    }

    impl RZPBuilderInternal<false, false, false> {
        pub fn new() -> Self {
            Self {
                _a_max_length: 3,
                _b_max_absolute_length: 10,
                _c_niss: NissSwitchType::Never,
            }
        }
    }

    impl Default for RZPBuilderInternal<false, false, false> {
        fn default() -> Self {
            Self::new()
        }
    }

    impl <const A: bool, const B: bool, const C: bool> Into<RZPSettings> for RZPBuilderInternal<A, B, C> {
        fn into(self) -> RZPSettings {
            self.build()
        }
    }

    impl TryFrom<StepConfig> for RZPBuilderInternal<false, false, false> {
        type Error = ();

        fn try_from(value: StepConfig) -> Result<Self, Self::Error> {
            if value.kind != StepKind::RZP {
                return Err(())
            }
            let mut defaults = Self::default();
            if !value.params.is_empty() {
                return Err(())
            }
            if let Some(max) = value.max {
                defaults._a_max_length = max as usize;
            }
            if let Some(abs_max) = value.absolute_max {
                defaults._b_max_absolute_length = abs_max as usize;
            }
            if let Some(niss) = value.niss {
                defaults._c_niss = niss;
            }
            Ok(defaults)
        }
    }
}
