use std::vec;
use log::debug;
use crate::cube::Cube333;

use crate::solver::solution::Solution;

use crate::steps;

pub mod lookup_table;
pub mod stream;
pub mod solution;
pub mod df_search;
pub mod moveset;
pub mod move_table;

use crate::solver::df_search::CancelToken;
use crate::steps::step::{DefaultStepOptions, Step};

pub fn solve_steps<'a>(puzzle: Cube333, steps: &'a Vec<(Step<'a>, DefaultStepOptions)>, cancel_token: &'a CancelToken) -> impl Iterator<Item = Solution> + 'a {
    let first_step: Box<dyn Iterator<Item = Solution>> = Box::new(vec![Solution::new()].into_iter());

    let solutions: Box<dyn Iterator<Item=Solution>> = steps.iter()
        .fold(first_step, |acc, (step, search_opts)|{
            debug!("Step {} with options {:?}", step.kind(), search_opts);
            let next = steps::step::next_step(acc, step, search_opts.clone(), puzzle.clone(), cancel_token)
                .zip(0..)
                .take_while(|(_, count)| search_opts.step_limit.map(|limit| limit > *count).unwrap_or(true))
                .map(|(sol, _)|sol);
            Box::new(next)
        });

    solutions
}

pub struct SolutionIterator<'a> {
    #[allow(unused)]
    steps: Vec<(Step<'a>, DefaultStepOptions)>,
    solutions: Box<dyn Iterator<Item=Solution>>,
}

impl Iterator for SolutionIterator<'_> {
    type Item = Solution;

    fn next(&mut self) -> Option<Self::Item> {
        self.solutions.next()
    }
}
