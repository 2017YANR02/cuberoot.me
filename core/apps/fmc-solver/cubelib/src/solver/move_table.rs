use std::collections::{HashMap, HashSet};
use std::fmt::{Debug, Display};
use std::hash::Hash;
use log::debug;
use crate::cube::{Symmetry, Turn333};
use crate::cube::turn::{ApplySymmetry, Invertible, TurnableMut};
use crate::solver::moveset::MoveSet;
use crate::steps::coord::Coord;

pub struct MoveTable<const C_SIZE: usize, C: Coord<C_SIZE>> {
    move_index: HashMap<Turn333, usize>,
    table: Vec<C>,
}

impl <const C_SIZE: usize, C: Coord<C_SIZE>> MoveTable<C_SIZE, C> {
    pub fn get(&self, from: C, t: Turn333) -> C {
        let m_idx = self.move_index[&t];
        self.table[from.val() * self.move_index.len() + m_idx]
    }

    pub fn generate<T: Default + Clone + Hash + Eq + TurnableMut + Debug + Display>(move_set: &MoveSet) -> Self where for<'a> C: From<&'a T> {
        let move_index = move_set.st_moves.iter()
            .chain(move_set.aux_moves.iter())
            .cloned()
            .fold(HashMap::default(), |mut acc, val|{
                let len = acc.len();
                acc.insert(val, len);
                acc
            });
        let mut table: Vec<Option<C>> = vec![None; C_SIZE * move_index.len()];
        let mut to_check = HashSet::from([T::default()]);
        while !to_check.is_empty() {
            debug!("To check has {}", to_check.len());
            let mut to_check_next = HashSet::new();
            for mut cube in to_check {
                let from = C::from(&cube);
                if from.val() >= C::size() {
                    println!("{from:?}");
                    println!("{cube:?}");
                    println!("{cube}");
                }
                for (turn, index) in &move_index {
                    if table[from.val() * move_index.len() + index].is_some() {
                        continue
                    }
                    cube.turn(*turn);
                    let coord = C::from(&cube);
                    table[from.val() * move_index.len() + index] = Some(coord);
                    to_check_next.insert(cube.clone());
                    cube.turn(turn.invert());
                }
            }
            to_check = to_check_next;
        }
        Self {
            move_index,
            table: table.into_iter().map(|x|x.unwrap()).collect(),
        }
    }

    pub fn generate_with_symmetries<T: Default + Clone + Hash + Eq + TurnableMut + Debug + Display + ApplySymmetry>(move_set: &MoveSet, symmetries: &Vec<Symmetry>) -> Self where for<'a> C: From<&'a T> {
        let move_index = move_set.st_moves.iter()
            .chain(move_set.aux_moves.iter())
            .cloned()
            .fold(HashMap::default(), |mut acc, val|{
                let len = acc.len();
                acc.insert(val, len);
                acc
            });
        let mut table: Vec<Option<C>> = vec![None; C_SIZE * move_index.len()];
        let mut to_check = HashSet::from([T::default()]);
        while !to_check.is_empty() {
            debug!("To check has {}", to_check.len());
            let mut to_check_next = HashSet::new();
            for mut cube in to_check {
                let from = C::from(&cube);
                if from.val() >= C::size() {
                    println!("{from:?}");
                    println!("{cube:?}");
                    println!("{cube}");
                }
                for (turn, index) in &move_index {
                    if table[from.val() * move_index.len() + index].is_some() {
                        continue
                    }
                    cube.turn(*turn);
                    let coord = C::min_with_symmetries(&cube, symmetries);
                    table[from.val() * move_index.len() + index] = Some(coord);
                    to_check_next.insert(cube.clone());
                    cube.turn(turn.invert());
                }
            }
            to_check = to_check_next;
        }
        Self {
            move_index,
            table: table.into_iter().map(|x|x.unwrap()).collect(),
        }
    }
}