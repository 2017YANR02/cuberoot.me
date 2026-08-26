#[cfg(feature = "multi-path-channel-solver")]
use std::str::FromStr;
#[cfg(feature = "multi-path-channel-solver")]
use crate::algs::Algorithm;
#[cfg(feature = "multi-path-channel-solver")]
use crate::cube::{Cube333, Transformation333};
#[cfg(feature = "multi-path-channel-solver")]
use crate::defs::{StepKind, StepVariant};
#[cfg(feature = "multi-path-channel-solver")]
use crate::solver_new::dr::{DRBuilder, RZPBuilder, RZPStep};
#[cfg(feature = "multi-path-channel-solver")]
use crate::solver_new::eo::EOBuilder;
#[cfg(feature = "multi-path-channel-solver")]
use crate::solver_new::htr::HTRBuilder;
#[cfg(feature = "multi-path-channel-solver")]
use crate::solver_new::finish::{DRFinishBuilder, FRFinishBuilder, HTRFinishBuilder};
#[cfg(feature = "multi-path-channel-solver")]
use crate::solver_new::fr::FRBuilder;
#[cfg(feature = "multi-path-channel-solver")]
use crate::solver_new::group::StepGroup;
#[cfg(feature = "multi-path-channel-solver")]
use crate::solver_new::step::{DFSParameters, MoveSet};
#[cfg(feature = "multi-path-channel-solver")]
use crate::solver_new::thread_util::{ToWorker, Worker};
#[cfg(feature = "multi-path-channel-solver")]
use crate::steps::step::{PostStepCheck, PreStepCheck, StepConfig};
#[cfg(feature = "multi-path-channel-solver")]
use crate::solver_new::util_steps::FilterExcluded;

#[cfg(feature = "multi-path-channel-solver")]
pub mod step;
#[cfg(feature = "multi-path-channel-solver")]
pub mod eo;
#[cfg(feature = "multi-path-channel-solver")]
pub mod dr;
#[cfg(feature = "multi-path-channel-solver")]
pub mod group;
#[cfg(feature = "multi-path-channel-solver")]
pub mod thread_util;
#[cfg(feature = "multi-path-channel-solver")]
pub mod util_steps;
#[cfg(feature = "multi-path-channel-solver")]
pub mod htr;
#[cfg(feature = "multi-path-channel-solver")]
pub mod util_cube;
#[cfg(feature = "multi-path-channel-solver")]
pub mod fr;
#[cfg(feature = "multi-path-channel-solver")]
pub mod finish;
#[cfg(feature = "multi-path-channel-solver")]
pub mod ar;
pub mod vr;

#[cfg(feature = "multi-path-channel-solver")]
pub type Sender<T> = crossbeam::channel::Sender<T>;
#[cfg(feature = "multi-path-channel-solver")]
pub type Receiver<T> = crossbeam::channel::Receiver<T>;
#[cfg(feature = "multi-path-channel-solver")]
pub type SendError<T> = crossbeam::channel::SendError<T>;
#[cfg(feature = "multi-path-channel-solver")]
pub type RecvError = crossbeam::channel::RecvError;
#[cfg(feature = "multi-path-channel-solver")]
pub type TryRecvError = crossbeam::channel::TryRecvError;
#[cfg(feature = "multi-path-channel-solver")]

#[cfg(feature = "multi-path-channel-solver")]
pub fn bounded_channel<T>(size: usize) -> (Sender<T>, Receiver<T>) {
    crossbeam::channel::bounded(size)
}

#[cfg(feature = "multi-path-channel-solver")]
pub trait Step: PreStepCheck + PostStepCheck {
    fn get_dfs_parameters(&self) -> DFSParameters;
    fn get_moveset(&self, state: &Cube333, depth_left: usize) -> &'_ MoveSet;
    fn heuristic(&self, state: &Cube333, can_niss_switch: bool, depth_left: usize) -> usize;
    fn pre_step_trans(&self) -> &'_ Vec<Transformation333>;
    fn get_variant(&self) -> StepVariant;
}

#[cfg(feature = "multi-path-channel-solver")]
pub fn build_steps(mut steps: Vec<StepConfig>) -> Result<StepGroup, String> {
    let mut step_groups = vec![];
    let mut previous = None;
    steps.reverse();
    while !steps.is_empty() {
        let mut step = steps.pop().unwrap();
        let mut next_prev = Some(step.kind.clone());
        let excluded = step.excluded.clone();
        let mut step_group = match (previous, step.kind.clone()) {
            (None, StepKind::EO) => EOBuilder::try_from(step).map_err(|_|"Failed to parse EO step")?.build(),
            (Some(StepKind::EO), StepKind::RZP) => {
                let mut dr = steps.pop().ok_or("Expected DR to follow RZP".to_string())?;
                next_prev = Some(StepKind::DR);
                let rzp_builder = RZPBuilder::try_from(step).map_err(|_|"Failed to parse RZP step")?;
                let triggers = dr.params.remove("triggers").ok_or("Found RZP, but DR step has no triggers".to_string())?;
                let dr_excluded = dr.excluded.clone();
                let mut dr_step = DRBuilder::try_from(dr).map_err(|_|"Failed to parse DR step")?
                    .triggers(triggers.split(",")
                        .map(Algorithm::from_str)
                        .collect::<Result<_, _>>()
                        .map_err(|_|"Unable to parse algorithm")?)
                    .rzp(rzp_builder)
                    .build();
                if !dr_excluded.is_empty() {
                    dr_step.with_predicates(vec![FilterExcluded::new(dr_excluded)]);
                }
                dr_step
            },
            (Some(StepKind::EO), StepKind::DR) => {
                match step.params.remove("triggers") {
                    None => DRBuilder::try_from(step).map_err(|_|"Failed to parse DR step")?.build(),
                    Some(triggers) => {
                        let rzp = RZPStep::builder()
                            .max_length(step.max.unwrap_or(3).min(3) as usize)
                            .max_absolute_length(step.absolute_max.unwrap_or(6).min(6) as usize);
                        DRBuilder::try_from(step).map_err(|_|"Failed to parse DR step")?
                            .triggers(triggers.split(",")
                                .map(Algorithm::from_str)
                                .collect::<Result<_, _>>()
                                .map_err(|_|"Unable to parse algorithm")?)
                            .rzp(rzp)
                            .build()
                    }
                }
            },
            (Some(StepKind::DR), StepKind::HTR) => HTRBuilder::try_from(step).map_err(|_|"Failed to parse HTR step")?.build(),
            (Some(StepKind::HTR), StepKind::FR) | (Some(StepKind::HTR), StepKind::FRLS)  => FRBuilder::try_from(step).map_err(|_|"Failed to parse FR step")?.build(),
            (Some(StepKind::FR), StepKind::FIN) => FRFinishBuilder::try_from(step).map_err(|_|"Failed to parse FIN step")?.build(),
            (Some(StepKind::FRLS), StepKind::FINLS) => FRFinishBuilder::try_from(step).map_err(|_|"Failed to parse FIN step")?.build(),
            (Some(StepKind::HTR), StepKind::FIN) | (Some(StepKind::HTR), StepKind::FINLS) => {
                let htr_breaking = step.params.remove("htr-breaking").map(|x|bool::from_str(x.to_lowercase().as_str()).unwrap_or(false)).unwrap_or(false);
                if htr_breaking {
                    DRFinishBuilder::try_from(step)
                        .map_err(|_|"Failed to parse FIN step")?
                        .from_htr()
                        .build()
                } else {
                    HTRFinishBuilder::try_from(step).map_err(|_|"Failed to parse FIN step")?.build()
                }
            },
            (Some(StepKind::DR), StepKind::FIN) | (Some(StepKind::DR), StepKind::FINLS) => {
                step.params.remove("htr-breaking");
                DRFinishBuilder::try_from(step).map_err(|_|"Failed to parse FIN step")?.build()
            },
            // (Some(StepKind::FINLS), StepKind::FIN) => {
            //     crate::solver_new::vr::VRStep::new(2, true)
            // },
            (None, x) => return Err(format!("{x:?} is not supported as a first step", )),
            (Some(a), b) => return Err(format!("Step order {a:?} > {b:?} is not supported")),
        };
        if !excluded.is_empty() {
            step_group.with_predicates(vec![FilterExcluded::new(excluded)]);
        }
        step_groups.push(step_group);
        previous = next_prev;
    }
    Ok(StepGroup::sequential(step_groups))
}