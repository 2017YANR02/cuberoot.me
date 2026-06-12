use itertools::Itertools;
use crate::defs::StepKind;
use crate::steps;
use crate::steps::step::{DefaultStepOptions, Step, StepConfig};
use crate::steps::tables::PruningTables333;

pub fn gen_tables(steps: &Vec<StepConfig>, tables: &mut PruningTables333) {
    let previous = vec![None].into_iter().chain(steps.iter().map(|x|Some(x.kind.clone()))).collect_vec();
    let steps = steps.into_iter().zip(previous.into_iter()).collect_vec();

    for (conf, pre) in steps.iter() {
        match (pre.clone(), conf.kind.clone()) {
            #[cfg(feature = "333eo")]
            (_, StepKind::EO) => tables.gen_eo(),
            #[cfg(feature = "333dr")]
            (_, StepKind::DR) => {
                tables.gen_dr();
                #[cfg(feature = "333htr")]
                tables.gen_htr();
            },
            #[cfg(feature = "333htr")]
            (_, StepKind::HTR) => tables.gen_htr(),
            #[cfg(feature = "333fr")]
            (_, StepKind::FR) => tables.gen_fr(),
            #[cfg(feature = "333fr")]
            (_, StepKind::FRLS) => tables.gen_fr_leave_slice(),
            #[cfg(feature = "333finish")]
            (Some(StepKind::FR), StepKind::FIN) | (Some(StepKind::FRLS), StepKind::FINLS) => tables.gen_fr_finish(),
            #[cfg(feature = "333finish")]
            (Some(StepKind::HTR), StepKind::FIN) => tables.gen_htr_finish(),
            #[cfg(feature = "333finish")]
            (Some(StepKind::HTR), StepKind::FINLS) => tables.gen_htr_leave_slice_finish(),
            _ => ()
        }
    }
}

pub fn build_steps(steps: Vec<StepConfig>, tables: &PruningTables333) -> Result<Vec<(Step<'_>, DefaultStepOptions)>, String> {
    let previous = vec![None].into_iter().chain(steps.iter().map(|x|Some(x.kind.clone()))).collect_vec();
    let steps = steps.into_iter().zip(previous.into_iter()).collect_vec();

    let steps = steps.into_iter()
        .flat_map(|(config, previous)| match (previous, config.kind.clone()) {
            #[cfg(feature = "333eo")]
            (None, StepKind::EO) => vec![steps::eo::eo_config::from_step_config(tables.eo().expect("EO table required"), config.clone())].into_iter(),
            #[cfg(feature = "333dr")]
            (Some(StepKind::EO), StepKind::RZP)   => vec![steps::dr::rzp_config::from_step_config(config.clone())].into_iter(),
            #[cfg(feature = "333dr")]
            (Some(StepKind::EO), StepKind::DR) => {
                let dr_table = tables.dr().expect("DR table required");
                if config.params.contains_key("triggers") {
                    log::warn!("Found explicitly defined DR triggers without RZP. Adding RZP step with default settings.");
                    let mut rzp_config = StepConfig::new(StepKind::RZP);
                    rzp_config.quality = config.quality;
                    rzp_config.max = config.max;
                    rzp_config.absolute_max = config.absolute_max;
                    #[cfg(feature = "333htr")]
                    { vec![steps::dr::rzp_config::from_step_config(rzp_config), steps::dr::dr_trigger_config::from_step_config(dr_table, tables.htr_subset().expect("HTR Subset table required"), config.clone())].into_iter() }
                    #[cfg(not(feature = "333htr"))]
                    { vec![steps::dr::rzp_config::from_step_config(rzp_config), steps::dr::dr_trigger_config::from_step_config(dr_table, config.clone())].into_iter() }
                } else {
                    #[cfg(feature = "333htr")]
                    { vec![steps::dr::dr_config::from_step_config(dr_table, tables.htr_subset().expect("HTR Subset table required"), config.clone())].into_iter() }
                    #[cfg(not(feature = "333htr"))]
                    { vec![steps::dr::dr_config::from_step_config(dr_table, config.clone())].into_iter() }
                }
            }
            #[cfg(feature = "333dr")]
            (Some(StepKind::RZP), StepKind::DR) => {
                let dr_table = tables.dr().expect("DR table required");
                if !config.params.contains_key("triggers") {
                    log::warn!("RZP without defining triggers is pointless and slower. Consider deleting the RZP step or adding explicit DR triggers.");
                    #[cfg(feature = "333htr")]
                    { vec![steps::dr::dr_config::from_step_config(dr_table, tables.htr_subset().expect("HTR Subset table required"), config.clone())].into_iter() }
                    #[cfg(not(feature = "333htr"))]
                    { vec![steps::dr::dr_config::from_step_config(dr_table, config.clone())].into_iter() }
                } else {
                    #[cfg(feature = "333htr")]
                    { vec![steps::dr::dr_trigger_config::from_step_config(dr_table, tables.htr_subset().expect("HTR Subset table required"), config.clone())].into_iter() }
                    #[cfg(not(feature = "333htr"))]
                    { vec![steps::dr::dr_trigger_config::from_step_config(dr_table, config.clone())].into_iter() }
                }
            }
            #[cfg(feature = "333htr")]
            (Some(StepKind::DR), StepKind::HTR)   => vec![steps::htr::htr_config::from_step_config(tables.htr().expect("HTR table required"), config.clone())].into_iter(),
            #[cfg(feature = "333fr")]
            (Some(StepKind::HTR), StepKind::FR)   => vec![steps::fr::fr_config::from_step_config(tables.fr().expect("FR table required"), config.clone())].into_iter(),
            #[cfg(feature = "333fr")]
            (Some(StepKind::HTR), StepKind::FRLS)  => vec![steps::fr::fr_config::from_step_config_no_slice(tables.fr_leave_slice().expect("FRLeaveSlice table required"), config.clone())].into_iter(),
            #[cfg(feature = "333finish")]
            (Some(StepKind::HTR), StepKind::FIN)   => vec![steps::finish::finish_config::from_step_config_htr(tables.htr_finish().expect("HTRFinish table required"), config.clone())].into_iter(),
            #[cfg(feature = "333finish")]
            (Some(StepKind::HTR), StepKind::FINLS)   => vec![steps::finish::finish_config::from_step_config_htr_leave_slice(tables.htr_leave_slice_finish().expect("HTRLSFinish table required"), config.clone())].into_iter(),
            #[cfg(feature = "333finish")]
            (Some(StepKind::FR), StepKind::FIN)   => vec![steps::finish::finish_config::from_step_config_fr(tables.fr_finish().expect("FRFinish table required"), config.clone())].into_iter(),
            #[cfg(feature = "333finish")]
            (Some(StepKind::FRLS), StepKind::FINLS)   => vec![steps::finish::finish_config::from_step_config_fr_leave_slice(tables.fr_finish().expect("FRFinish table required"), config.clone())].into_iter(),
            (None, x) => vec![Err(format!("{:?} is not supported as a first step", x))].into_iter(),
            (Some(x), y) => vec![Err(format!("Unsupported step order {:?} > {:?}", x, y))].into_iter(),
        })
        .collect();
    steps
}