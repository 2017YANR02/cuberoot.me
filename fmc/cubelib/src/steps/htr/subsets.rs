use std::cmp::max;
use std::collections::HashMap;
use std::str::FromStr;
use itertools::Itertools;
use log::{debug, info, warn};
use tinyset::Set64;
use crate::algs::Algorithm;
use crate::cube::*;
use crate::cube::Cube333;
use crate::cube::turn::{ApplyAlgorithm, InvertibleMut, TurnableMut};
use crate::steps::coord::Coord;
use crate::steps::dr::coords::DRUDEOFBCoord;
use crate::solver::lookup_table::{DepthEstimate, EmptyVal, NissDepthEstimate};
use crate::solver::solution::Solution;
use crate::steps::dr::dr_config::HTR_DR_UD_MOVESET;
use crate::steps::htr::coords::HTRDRUDCoord;
use crate::steps::htr::htr_config::{HTRPruningTable, HTRSubsetTable};
use crate::steps::step::{PostStepCheck, PreStepCheck};
use crate::steps::util::expand_subset_name;

pub type Subset = crate::steps::util::Subset;
pub const DR_SUBSETS: [Subset; 48] = crate::steps::util::DR_SUBSETS;

#[derive(Clone)]
pub struct DRSubsetFilter<'a>(&'a HTRSubsetTable, Set64<u8>);

impl <'a> DRSubsetFilter<'a> {
    pub fn matches_subset(&self, cube: &Cube333) -> bool {
        if DRUDEOFBCoord::from(cube).val() != 0 {
            return false;
        }
        let subset_id = self.0.get(HTRDRUDCoord::from(cube));
        self.1.contains(subset_id)
    }

    pub fn new_subset(subset_table: &'a HTRSubsetTable, subsets: &Vec<Subset>) -> Self {
        let mut subset_set = Set64::new();
        for subset in subsets {
            for id in 0..DR_SUBSETS.len() {
                if DR_SUBSETS[id].eq(subset) {
                    subset_set.insert(id as u8);
                    break;
                }
            }
        }
        Self(subset_table, subset_set)
    }
}

pub fn dr_subset_filter<'a>(subset_table: &'a HTRSubsetTable, subsets: &Vec<String>) -> Option<DRSubsetFilter<'a>> {
    let subsets = subsets.iter()
        .flat_map(|subset_name|{
            let matched_subsets = expand_subset_name(subset_name.as_str());
            if matched_subsets.is_empty() {
                warn!("Ignoring unrecognized subset name {subset_name}")
            }
            if matched_subsets.len() == 1 {
                for subset in matched_subsets.iter() {
                    debug!("Adding subset {subset}");
                }
            } else {
                for subset in matched_subsets.iter() {
                    debug!("Expanding {subset_name} to subset {subset}");
                }
            }
            matched_subsets.into_iter()
        })
        .collect_vec();
    if subsets.is_empty() {
        None
    } else {
        Some(DRSubsetFilter::new_subset(subset_table, &subsets))
    }
}

impl PreStepCheck for DRSubsetFilter<'_> {
    fn is_cube_ready(&self, cube: &Cube333, _: Option<&Solution>) -> bool {
        self.matches_subset(cube)
    }
}

impl PostStepCheck for DRSubsetFilter<'_> {
    fn is_solution_admissible(&self, cube: &Cube333, alg: &Algorithm) -> bool {
        let mut cube = cube.clone();
        cube.apply_alg(alg);
        self.matches_subset(&cube)
    }
}

pub fn gen_subset_tables(htr_table: &mut HTRPruningTable) -> HTRSubsetTable {
    let mut subset_table = HTRSubsetTable::new(false);

    let table_size = HTRDRUDCoord::size();
    let mut total_checked = 0;

    for (subset, id) in DR_SUBSETS.iter().zip(1..) {
        info!("Generating NISS table for subset: {id}. {subset:?}");
        let generator = Algorithm::from_str(subset.generator).unwrap();
        let checked = fill_table(htr_table, &mut subset_table, &generator, id - 1);
        total_checked += checked;
        debug!(
            "Checked {:width$}/{} cubes (new {})",
            total_checked,
            table_size,
            checked,
            width = table_size.to_string().len(),
        );
    }
    subset_table
}

fn min_niss_moves(alg: &Algorithm) -> u8 {
    let mut max_half_turns = 0;
    let mut current_half_turns = 0;
    for turn in alg.normal_moves.iter() {
        if turn.dir == Direction::Half {
            current_half_turns += 1;
            max_half_turns = max(current_half_turns, max_half_turns);
        } else {
            current_half_turns = 0;
        }
    }
    alg.normal_moves.len() as u8 - max_half_turns
}

fn gen_coset_0() -> Vec<Cube333> {
    let mut checked = HashMap::new();
    let mut to_check: Vec<Cube333> = vec![Cube333::default()];
    let mut check_next: Vec<Cube333> = vec![];

    loop {
        for cube in to_check {
            for cube in HTR_DR_UD_MOVESET.aux_moves.iter().cloned()
                .map(|m|{
                    let mut cube = cube.clone();
                    cube.turn(m);
                    cube
                }) {
                let coord = HTRDRUDCoord::from(&cube);
                if checked.contains_key(&coord) {
                    continue;
                }
                checked.insert(coord, cube);
                check_next.push(cube);
            }
        }
        if check_next.is_empty() {
            break;
        }
        to_check = check_next;
        check_next = vec![];
    }
    checked.values().cloned().collect_vec()
}

fn fill_table(htr_table: &mut HTRPruningTable, subset_table: &mut HTRSubsetTable, generator: &Algorithm, subset_id: u8) -> usize {
    let mut total_checked = 0;
    let niss_bound = min_niss_moves(generator);
    let mut to_check: Vec<Cube333> = gen_coset_0()
        .into_iter()
        .flat_map(|c|{
            vec![c].into_iter()
                .flat_map(|mut a| {
                    let b = a.clone();
                    a.turn(Turn333::U);
                    a.turn(Turn333::D);
                    vec![a, b].into_iter()
                })
                .map(|mut c|{
                    c.apply_alg(generator);
                    c
                })
        })
        .collect_vec();
    let mut check_next: Vec<Cube333> = vec![];
    loop {
        for cube in to_check.iter().cloned().flat_map(|mut a|{
            let b = a.clone();
            a.invert();
            vec![a, b].into_iter()
        }) {
            for cube in HTR_DR_UD_MOVESET.aux_moves.iter().cloned()
                .map(|m|{
                    let mut cube = cube.clone();
                    cube.turn(m);
                    cube
                }) {
                let coord = HTRDRUDCoord::from(&cube);
                let (_, niss) = htr_table.get_niss_estimate(coord);
                if niss != htr_table.empty_val() {
                    continue;
                }
                htr_table.set_niss(coord, niss_bound);
                subset_table.set(coord, subset_id);
                check_next.push(cube);
            }
        }
        if check_next.is_empty() {
            break total_checked;
        }
        total_checked += check_next.len();
        to_check = check_next;
        check_next = vec![];
    }
}