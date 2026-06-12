use std::collections::{HashMap, HashSet};
use std::fmt::{Debug, Display, Formatter};
#[cfg(feature = "serde_support")]
use serde_with::serde_as;
use itertools::Itertools;
use crate::algs::Algorithm;
use crate::cube::turn::{ApplyAlgorithm, CubeAxis, CubeFace, Direction, Invertible, InvertibleMut, Transformable, TurnableMut};
use crate::cube::{Transformation333, Turn333};
use crate::defs::{StepKind, StepVariant};
use crate::solver_new::vr::VRInsertions;

#[cfg_attr(feature = "serde_support", derive(serde::Serialize, serde::Deserialize))]
#[derive(Eq, PartialEq)]
pub struct Solution {
    pub steps: Vec<SolutionStep>,
    pub ends_on_normal: bool,
    pub insertion_direction: Option<Transformation333>,
}

#[derive(Clone, Eq, PartialEq)]
#[cfg_attr(feature = "serde_support", serde_as)]
#[cfg_attr(feature = "serde_support", derive(serde::Serialize, serde::Deserialize))]
pub struct SolutionStep {
    pub variant: StepVariant,
    pub alg: Algorithm,
    pub comment: String,
    #[cfg_attr(feature = "serde_support", serde_as(as = "Vec<(_, _)>"))]
    pub e_insertions: HashMap<usize, Direction>,
}

impl Solution {

    const E_INSERTION_FOOTNOTE_SYMBOL: [&'static str; 3] = ["^", "@", "#"];

    pub fn new() -> Solution {
        Solution { steps: vec![], ends_on_normal: true, insertion_direction: None }
    }

    pub fn set_vr_insertions(&mut self, vr_solution: VRInsertions) {
        let VRInsertions(mut insertions, trans) = vr_solution;
        self.insertion_direction = trans;
        for step in self.steps.iter_mut() {
            if let Some(insertion) = insertions.remove(&step.variant) {
                step.e_insertions = insertion.into_iter().collect();
            } else if !step.e_insertions.is_empty() {
                step.e_insertions = Default::default();
            }
        }
    }

    pub fn len(&self) -> usize {
        if let Some(StepKind::FIN) = self.steps.last().map(|x|StepKind::from(x.variant)) {
            Into::<Algorithm>::into(self.clone()).to_uninverted()
        } else {
            Into::<Algorithm>::into(self.clone())
        }.canonicalize().len()
    }

    pub fn add_step(&mut self, step: SolutionStep) {
        self.ends_on_normal = match (step.alg.normal_moves.is_empty(), step.alg.inverse_moves.is_empty()) {
            (true, true) => self.ends_on_normal,
            (false, false) => !self.ends_on_normal,
            (true, false) => false,
            (false, true) => true,
        };
        self.steps.push(step);
    }

    pub fn ends_on_normal(&self) -> bool {
        self.ends_on_normal
    }

    pub fn get_steps(&self) -> &'_ Vec<SolutionStep> {
        &self.steps
    }

    pub fn compact(self) -> Self {
        let mut steps: Vec<SolutionStep> = vec![];

        let mut i = 0;
        while i < self.steps.len() {
            let mut step = self.steps.get(i).cloned().unwrap();
            while i < self.steps.len() - 1 {
                let next = self.steps.get(i + 1).unwrap();
                if next.alg.len() == 0 {
                    step.variant = next.variant.clone();
                } else {
                    break;
                }
                i += 1;
            }
            steps.push(step);
            i += 1;
        }
        Solution {
            steps,
            ends_on_normal: self.ends_on_normal,
            insertion_direction: self.insertion_direction
        }
    }

    fn to_compact_alg_with_insertions(mut self) -> Algorithm {
        let trans = if let Some(trans) = self.insertion_direction {
            trans
        } else {
            return self.into()
        };
        // We assume that a Solution with a VR is always finished.
        let mut trans_qt = 0;
        let primary_face = match trans.axis {
            CubeAxis::UD => CubeFace::Up,
            CubeAxis::FB => CubeFace::Right,
            CubeAxis::LR => CubeFace::Back,
        };
        let trans_axis = primary_face.get_axis();
        let mut turns = vec![];
        fn transform_turn(turn: Turn333, trans_axis: CubeAxis, y_trans_qt: u8) -> Turn333 {
            Direction::from_qt(y_trans_qt)
                .map(|x|{
                    // The reason for this special case is that X Y Z follows R U F, while M E S follows R' U' F
                    if trans_axis == CubeAxis::FB {
                        turn.transform(Transformation333::new(trans_axis, x.invert()))
                    } else {
                        turn.transform(Transformation333::new(trans_axis, x))
                    }
                })
                .unwrap_or(turn)
        }
        for step in &mut self.steps {
            for (idx, turn) in step.alg.normal_moves.iter().enumerate() {
                if let Some(dir) = step.e_insertions.remove(&idx) {
                    trans_qt = (trans_qt + dir.to_qt()) % 4;
                    turns.push(Turn333::new(primary_face, dir));
                    turns.push(Turn333::new(primary_face.opposite(), dir.invert()));
                }
                turns.push(transform_turn(*turn, trans_axis, trans_qt));
            }
            if step.alg.normal_moves.len() > 0 {
                if let Some(dir) = step.e_insertions.remove(&step.alg.normal_moves.len()) {
                    trans_qt = (trans_qt + dir.to_qt()) % 4;
                    turns.push(Turn333::new(primary_face, dir));
                    turns.push(Turn333::new(primary_face.opposite(), dir.invert()));
                }
            }
        }
        for step in self.steps.iter_mut().rev() {
            for (idx, turn) in step.alg.inverse_moves.iter().rev().enumerate() {
                let idx = idx + step.alg.normal_moves.len();
                if let Some(dir) = step.e_insertions.remove(&idx) {
                    trans_qt = (trans_qt + dir.to_qt()) % 4;
                    turns.push(Turn333::new(primary_face, dir));
                    turns.push(Turn333::new(primary_face.opposite(), dir.invert()));
                }
                turns.push(transform_turn(turn.invert(), trans_axis, trans_qt));
            }
            if step.alg.inverse_moves.len() > 0 {
                if let Some(dir) = step.e_insertions.remove(&step.alg.inverse_moves.len()) {
                    trans_qt = (trans_qt + dir.to_qt()) % 4;
                    turns.push(Turn333::new(primary_face, dir));
                    turns.push(Turn333::new(primary_face.opposite(), dir.invert()));
                }
            }
            assert!(step.e_insertions.is_empty());
        }
        Algorithm {
            normal_moves: turns,
            inverse_moves: vec![],
        }.canonicalize()
    }
}

impl Into<Algorithm> for Solution {
    fn into(self) -> Algorithm {
        if self.insertion_direction.is_some() {
            self.to_compact_alg_with_insertions()
        } else {
            let mut start = Algorithm::new();
            let is_finished = if let Some(last) = self.steps.last().as_ref() {
                StepKind::from(last.variant) == StepKind::FIN
            } else {
                false
            };

            for step in self.steps {
                start = start + step.alg;
            }
            if is_finished {
                start = start.to_uninverted();
            }
            start.canonicalize()
        }
    }
}

impl Clone for Solution {
    fn clone(&self) -> Self {
        Solution {
            steps: self.steps.clone(),
            ends_on_normal: self.ends_on_normal,
            insertion_direction: self.insertion_direction,
        }
    }
}

impl Debug for Solution {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "[")?;
        for n in 0..self.steps.len() {
            let step = self.steps.get(n).unwrap();
            write!(f, "{}: {}", step.variant, step.alg)?;
            if n < self.steps.len() - 1 {
                write!(f, ", ")?;
            }
        }
        write!(f, "]")
    }
}

fn write_alg_with_insertion_placeholders(alg: &Algorithm, insertions: &HashMap<usize, Direction>) -> String {
    if alg.inverse_moves.is_empty() {
        write_alg_side_with_insertions_placeholders(&alg.normal_moves, insertions, None)
    } else if alg.normal_moves.is_empty() {
        format!("({})", write_alg_side_with_insertions_placeholders(&alg.inverse_moves, insertions, Some(0)))
    } else {
        format!("{} ({})",
                write_alg_side_with_insertions_placeholders(&alg.normal_moves, insertions, None),
                write_alg_side_with_insertions_placeholders(&alg.inverse_moves, insertions, Some(alg.normal_moves.len()))
        )
    }
}

fn write_alg_side_with_insertions_placeholders(moves: &Vec<Turn333>, insertions: &HashMap<usize, Direction>, offset: Option<usize>) -> String {
    let mut alg_string = String::new();
    for idx in 0..moves.len() {
        let insertion_idx = if let Some(offset) = offset {
            moves.len() - idx + offset
        } else {
            idx
        };
        if let Some(dir) = insertions.get(&insertion_idx).cloned() {
            alg_string.push_str(&Solution::E_INSERTION_FOOTNOTE_SYMBOL[dir.to_qt() as usize - 1]);
            alg_string.push_str(" ");
        }
        alg_string.push_str(moves[idx].to_string().as_str());
        if idx + 1 < moves.len() {
            alg_string.push_str(" ");
        }
    }
    let insertion_idx = if let Some(offset) = offset {
        offset
    } else {
        moves.len()
    };
    if let Some(dir) = insertions.get(&insertion_idx).cloned() {
        alg_string.push_str(" ");
        alg_string.push_str(&Solution::E_INSERTION_FOOTNOTE_SYMBOL[dir.to_qt() as usize - 1]);
    }
    alg_string
}

impl Display for Solution {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let compact = self.clone();

        let longest_alg_length = compact
            .steps
            .iter()
            .map(|s| s.alg.to_string().len() + s.e_insertions.len() * 2)
            .max()
            .unwrap_or(0);
        let longest_name_length = compact
            .steps
            .iter()
            .map(|s| s.variant.to_string().len() + if s.comment.is_empty() { 0 } else { s.comment.len() + 3 })
            .max()
            .unwrap_or(0);
        let footnotes: HashSet<Direction> = self.steps.iter()
            .flat_map(|x|x.e_insertions.iter().map(|x|x.1.clone()))
            .collect();
        let slice_name = match self.insertion_direction {
            Some(x) if x.axis == CubeAxis::Y => "E",
            Some(x) if x.axis == CubeAxis::X => "S",
            Some(x) if x.axis == CubeAxis::Z => "M",
            _ => "",
        };
        let footnotes_line = [Direction::Clockwise, Direction::Half, Direction::CounterClockwise]
            .into_iter()
            .filter(|x|footnotes.contains(x))
            .map(|x|{
                // let idx = match trans.map(|x|x.axis) {
                //     Some(CubeAxis::LR) => x.invert().to_qt(),
                //     _ => x.to_qt()
                // } as usize - 1;
                let idx = x.to_qt() as usize - 1;
                format!("{} = {slice_name}{}", Self::E_INSERTION_FOOTNOTE_SYMBOL[idx], x.to_symbol()).to_string()
            })
            .join(", ");
        let longest_alg_length = longest_alg_length.max(footnotes_line.len());
        let mut collected_alg = Algorithm::new();
        for (idx, step) in compact.steps.iter().enumerate() {
            let alg_string = write_alg_with_insertion_placeholders(&step.alg, &step.e_insertions);

            let alg_length = step.alg.len();
            let previous_length = collected_alg.len();
            let kind = StepKind::from(step.variant);
            collected_alg = if idx + 1 == compact.steps.len() && (kind == StepKind::FINLS || kind == StepKind::FIN) {
                (collected_alg + step.alg.clone()).to_uninverted()
            } else {
                collected_alg + step.alg.clone()
            }.canonicalize();
            let cancelled_moves = previous_length + alg_length - collected_alg.len();
            let comment = if step.comment.is_empty() {
                "".to_string()
            } else {
                format!(" [{}]", step.comment)
            };
            let length_comment = if cancelled_moves == 0 {
                format!("({alg_length}/{})", collected_alg.len())
            } else {
                format!("({alg_length}-{cancelled_moves}/{})", collected_alg.len())
            };
            let variant_name = if self.insertion_direction.is_some() {
                match step.variant {
                    StepVariant::DRFINLS(x) => StepVariant::DRFIN(x),
                    StepVariant::HTRFINLS(x) => StepVariant::DRFIN(x),
                    StepVariant::FRFINLS(x) => StepVariant::DRFIN(x),
                    x => x
                }.to_string()
            } else {
                step.variant.to_string()
            };
            let name = format!("{}{comment}", variant_name.to_string());
            writeln!(f, "{:longest_alg_length$}  // {name:longest_name_length$} {length_comment}", alg_string)?;
        }
        if self.insertion_direction.is_some() {
            let collected_alg_with_insertions = self.clone().to_compact_alg_with_insertions();
            let len_diff = collected_alg_with_insertions.len() as isize - collected_alg.len() as isize;

            let length_comment = format!("({len_diff}/{})", collected_alg_with_insertions.len());
            if !footnotes_line.is_empty() {
                writeln!(f, "{footnotes_line:longest_alg_length$}  // {:longest_name_length$} {length_comment}", "vr")?;
            }
            writeln!(
                f,
                "Solution ({}): {}",
                collected_alg_with_insertions.len(),
                collected_alg_with_insertions
            )
        } else {
            writeln!(
                f,
                "Solution ({}): {}",
                collected_alg.len(),
                collected_alg
            )
        }
    }
}

pub trait ApplySolution<C: TurnableMut> {
    fn apply_solution(&mut self, solution: &Solution);
}

impl <C: TurnableMut + InvertibleMut> ApplySolution<C> for C {
    fn apply_solution(&mut self, solution: &Solution) {
        if solution.insertion_direction.is_some() {
            let alg = solution.clone().to_compact_alg_with_insertions();
            self.apply_alg(&alg);
        } else {
            for step in solution.steps.iter() {
                for m in step.alg.normal_moves.iter() {
                    self.turn(m.clone());
                }
            }
            self.invert();
            for step in solution.steps.iter() {
                for m in step.alg.inverse_moves.iter() {
                    self.turn(m.clone());
                }
            }
            self.invert();
        }
    }
}