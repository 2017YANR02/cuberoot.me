use std::fmt::{Debug, Display, Formatter};
use std::ops::{Index, IndexMut};
use std::str::FromStr;

use crate::algs::Algorithm;
use crate::cube::{Transformation333, Turn333};
use crate::cube::cube::Symmetry;
use crate::cube::turn::CubeFace::*;
use crate::cube::turn::Direction::*;

#[derive(Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "serde_support", derive(serde::Serialize, serde::Deserialize))]
//Using a tuple struct here would break type aliasing :(
pub struct CubeOuterTurn {
    pub face: CubeFace,
    pub dir: Direction,
}

impl CubeOuterTurn {
    pub fn all() -> &'static [Self] {
        &Self::ALL
    }

    pub fn is_same_type(&self, other: &Self) -> bool {
        self.face == other.face
    }
}

pub trait TransformableMut {
    fn transform(&mut self, transformation: Transformation333);
}

pub trait Transformable {
    fn transform(&self, transformation: Transformation333) -> Self;
}

pub trait TurnableMut {
    fn turn(&mut self, turn: Turn333);
}

pub trait InvertibleMut {
    fn invert(&mut self);
}

pub trait Invertible {
    fn invert(&self) -> Self;
}

pub trait ApplyAlgorithm {
    fn apply_alg(&mut self, alg: &Algorithm);
}

pub trait ApplySymmetry {
    fn apply_symmetry<T: AsRef<Symmetry>>(&mut self, s: T);
}

impl<C: TurnableMut + InvertibleMut> ApplyAlgorithm for C {
    fn apply_alg(&mut self, alg: &Algorithm) {
        for m in &alg.normal_moves {
            self.turn(*m);
        }
        if !alg.inverse_moves.is_empty() {
            self.invert();
            for m in &alg.inverse_moves {
                self.turn(*m);
            }
            self.invert();
        }
    }
}

impl Invertible for CubeOuterTurn {
    fn invert(&self) -> CubeOuterTurn {
        CubeOuterTurn {
            face: self.face,
            dir: self.dir.invert()
        }
    }
}

impl Transformable for CubeOuterTurn {
    fn transform(&self, transformation: CubeTransformation) -> Self {
        Self::new(self.face.transform(transformation), self.dir)
    }
}

impl From<usize> for CubeOuterTurn {
    fn from(value: usize) -> Self {
        Self::ALL[value]
    }
}

impl Into<usize> for CubeOuterTurn {
    fn into(self) -> usize {
        self.to_id()
    }
}

#[derive(Copy, Clone, Eq, PartialEq, Hash)]
#[cfg_attr(feature = "serde_support", derive(serde::Serialize, serde::Deserialize))]
pub struct CubeTransformation {
    pub axis: CubeAxis,
    pub dir: Direction,
}

const TRANSFORMATIONS: [CubeTransformation; 9] = [
    CubeTransformation::X, CubeTransformation::Xi, CubeTransformation::X2,
    CubeTransformation::Y, CubeTransformation::Yi, CubeTransformation::Y2,
    CubeTransformation::Z, CubeTransformation::Zi, CubeTransformation::Z2,
];

impl Invertible for CubeTransformation {
    fn invert(&self) -> Self {
        CubeTransformation::new(self.axis, self.dir.invert())
    }
}

impl From<usize> for CubeTransformation {
    fn from(value: usize) -> Self {
        TRANSFORMATIONS[value]
    }
}

impl Into<usize> for CubeTransformation {
    fn into(self) -> usize {
        self.to_id()
    }
}

#[allow(non_upper_case_globals)]
impl CubeTransformation {
    pub const X: CubeTransformation = CubeTransformation::new(CubeAxis::X, Clockwise);
    pub const X2: CubeTransformation = CubeTransformation::new(CubeAxis::X, Half);
    pub const Xi: CubeTransformation = CubeTransformation::new(CubeAxis::X, CounterClockwise);

    pub const Y: CubeTransformation = CubeTransformation::new(CubeAxis::Y, Clockwise);
    pub const Y2: CubeTransformation = CubeTransformation::new(CubeAxis::Y, Half);
    pub const Yi: CubeTransformation = CubeTransformation::new(CubeAxis::Y, CounterClockwise);

    pub const Z: CubeTransformation = CubeTransformation::new(CubeAxis::Z, Clockwise);
    pub const Z2: CubeTransformation = CubeTransformation::new(CubeAxis::Z, Half);
    pub const Zi: CubeTransformation = CubeTransformation::new(CubeAxis::Z, CounterClockwise);

    pub const ALL: [Self; 9] = [Self::X, Self::X2, Self::Xi, Self::Y, Self::Y2, Self::Yi, Self::Z, Self::Z2, Self::Zi];

    pub const fn new(axis: CubeAxis, dir: Direction) -> Self {
        Self { axis, dir }
    }

    pub const fn to_id(&self) -> usize {
        self.axis as usize * 3 + self.dir as usize
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "serde_support", derive(serde::Serialize, serde::Deserialize))]
pub enum CubeFace {
    Up = 0,
    Down = 1,
    Front = 2,
    Back = 3,
    Left = 4,
    Right = 5,
}

impl CubeFace {
    pub const ALL: [CubeFace; 6] = [Up, Down, Front, Back, Left, Right];

    const TRANSFORMATIONS: [[[CubeFace; 3]; 3]; 6] = [
        [[Back, Down, Front], [Up, Up, Up], [Right, Down, Left]],
        [[Front, Up, Back], [Down, Down, Down], [Left, Up, Right]],
        [[Up, Back, Down], [Left, Back, Right], [Front, Front, Front]],
        [[Down, Front, Up], [Right, Front, Left], [Back, Back, Back]],
        [[Left, Left, Left], [Back, Right, Front], [Up, Right, Down]],
        [[Right, Right, Right], [Front, Left, Back], [Down, Left, Up]],
    ];

    pub const fn opposite(self) -> Self {
        match self {
            Up => Down,
            Down => Up,
            Front => Back,
            Back => Front,
            Left => Right,
            Right => Left,
        }
    }

    pub fn transform(self, t: CubeTransformation) -> CubeFace {
        Self::TRANSFORMATIONS[self][t.axis][t.dir as usize]
    }

    pub fn get_axis(self) -> CubeAxis {
        match self {
            Up | Down => CubeAxis::UD,
            Front | Back => CubeAxis::FB,
            Left | Right => CubeAxis::LR,
        }
    }

    pub fn is_on_axis(self, a: CubeAxis) -> bool {
        self.get_axis() == a
    }
}

impl Into<CubeAxis> for CubeFace {
    fn into(self) -> CubeAxis {
        match self {
            Up | Down => CubeAxis::UD,
            Front | Back => CubeAxis::FB,
            Left | Right => CubeAxis::LR
        }
    }
}

impl CubeAxis {
    pub fn get_faces(&self) -> (CubeFace, CubeFace) {
        match *self {
            CubeAxis::UD => (Up, Down),
            CubeAxis::FB => (Front, Back),
            CubeAxis::LR => (Left, Right),
        }
    }
}

impl TryFrom<char> for CubeFace {
    type Error = ();

    fn try_from(value: char) -> Result<Self, Self::Error> {
        match value.to_ascii_uppercase() {
            'U' => Ok(Up),
            'D' => Ok(Down),
            'F' => Ok(Front),
            'B' => Ok(Back),
            'L' => Ok(Left),
            'R' => Ok(Right),
            _ => Err(()),
        }
    }
}

impl Into<char> for CubeFace {
    fn into(self) -> char {
        match self {
            Up => 'U',
            Down => 'D',
            Front => 'F',
            Back => 'B',
            Left => 'L',
            Right => 'R',
        }
    }
}

impl TryFrom<char> for CubeAxis {
    type Error = ();

    fn try_from(value: char) -> Result<Self, Self::Error> {
        match value.to_ascii_uppercase() {
            'X' => Ok(CubeAxis::X),
            'Y' => Ok(CubeAxis::Y),
            'Z' => Ok(CubeAxis::Z),
            _ => Err(()),
        }
    }
}

impl Into<char> for CubeAxis {
    fn into(self) -> char {
        match self {
            CubeAxis::X => 'X',
            CubeAxis::Y => 'Y',
            CubeAxis::Z => 'Z',
        }
    }
}

impl<T, const N: usize> Index<CubeFace> for [T; N] {
    type Output = T;

    fn index(&self, index: CubeFace) -> &Self::Output {
        &self[index as usize]
    }
}

impl<T, const N: usize> IndexMut<CubeFace> for [T; N] {
    fn index_mut(&mut self, index: CubeFace) -> &mut Self::Output {
        &mut self[index as usize]
    }
}

impl From<usize> for CubeFace {
    fn from(face: usize) -> Self {
        match face {
            0 => Up,
            1 => Down,
            2 => Front,
            3 => Back,
            4 => Left,
            5 => Right,
            _ => panic!("Invalid face"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "serde_support", derive(serde::Serialize, serde::Deserialize))]
pub enum Direction {
    Clockwise = 0,
    Half = 1,
    CounterClockwise = 2,
}

impl Direction {
    pub fn invert(&self) -> Self {
        match *self {
            Clockwise => CounterClockwise,
            CounterClockwise => Clockwise,
            Half => Half,
        }
    }

    pub fn from_qt(qt: u8) -> Option<Self> {
        match qt % 4 {
            0 => None,
            1 => Some(Clockwise),
            2 => Some(Half),
            3 => Some(CounterClockwise),
            _ => unreachable!()
        }
    }

    pub fn to_qt(&self) -> u8 {
        match self {
            Clockwise => 1,
            Half => 2,
            CounterClockwise => 3,
        }
    }

    pub(crate) fn to_symbol(&self) -> &'static str {
        match self {
            Clockwise => "",
            Half => "2",
            CounterClockwise => "'",
        }
    }
}

#[allow(non_upper_case_globals)]
impl CubeOuterTurn {
    pub const U: CubeOuterTurn = CubeOuterTurn::new(Up, Clockwise);
    pub const U2: CubeOuterTurn = CubeOuterTurn::new(Up, Half);
    pub const Ui: CubeOuterTurn = CubeOuterTurn::new(Up, CounterClockwise);
    pub const D: CubeOuterTurn = CubeOuterTurn::new(Down, Clockwise);
    pub const D2: CubeOuterTurn = CubeOuterTurn::new(Down, Half);
    pub const Di: CubeOuterTurn = CubeOuterTurn::new(Down, CounterClockwise);
    pub const F: CubeOuterTurn = CubeOuterTurn::new(Front, Clockwise);
    pub const F2: CubeOuterTurn = CubeOuterTurn::new(Front, Half);
    pub const Fi: CubeOuterTurn = CubeOuterTurn::new(Front, CounterClockwise);
    pub const B: CubeOuterTurn = CubeOuterTurn::new(Back, Clockwise);
    pub const B2: CubeOuterTurn = CubeOuterTurn::new(Back, Half);
    pub const Bi: CubeOuterTurn = CubeOuterTurn::new(Back, CounterClockwise);
    pub const R: CubeOuterTurn = CubeOuterTurn::new(Right, Clockwise);
    pub const R2: CubeOuterTurn = CubeOuterTurn::new(Right, Half);
    pub const Ri: CubeOuterTurn = CubeOuterTurn::new(Right, CounterClockwise);
    pub const L: CubeOuterTurn = CubeOuterTurn::new(Left, Clockwise);
    pub const L2: CubeOuterTurn = CubeOuterTurn::new(Left, Half);
    pub const Li: CubeOuterTurn = CubeOuterTurn::new(Left, CounterClockwise);

    pub const ALL: [CubeOuterTurn; 18] = [
        CubeOuterTurn::U, CubeOuterTurn:: Ui, CubeOuterTurn::U2,
        CubeOuterTurn::D, CubeOuterTurn:: Di, CubeOuterTurn::D2,
        CubeOuterTurn::F, CubeOuterTurn:: Fi, CubeOuterTurn::F2,
        CubeOuterTurn::B, CubeOuterTurn:: Bi, CubeOuterTurn::B2,
        CubeOuterTurn::L, CubeOuterTurn:: Li, CubeOuterTurn::L2,
        CubeOuterTurn::R, CubeOuterTurn:: Ri, CubeOuterTurn::R2,
    ];

    pub const fn new(face: CubeFace, dir: Direction) -> CubeOuterTurn {
        Self { face, dir }
    }

    pub fn mirror(&self, a: CubeAxis) -> CubeOuterTurn {
        if self.face.is_on_axis(a) {
            CubeOuterTurn::new(self.face.opposite(), self.dir.invert())
        } else {
            CubeOuterTurn::new(self.face, self.dir.invert())
        }
    }

    pub const fn to_id(&self) -> usize {
        self.face as usize * 3 + self.dir as usize
    }
}

impl Display for CubeTransformation {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let face: String = String::from(<CubeAxis as Into<char>>::into(self.axis));
        let turn = match self.dir {
            Clockwise => "",
            CounterClockwise => "'",
            Half => "2",
        };
        write!(f, "{face}{turn}")
    }
}

impl Debug for CubeTransformation {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self)
    }
}

impl Display for CubeOuterTurn {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let face: String = String::from(<CubeFace as Into<char>>::into(self.face));
        let turn = match self.dir {
            Clockwise => "",
            CounterClockwise => "'",
            Half => "2",
        };
        write!(f, "{face}{turn}")
    }
}

impl Debug for CubeOuterTurn {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self)
    }
}

impl FromStr for CubeOuterTurn {
    type Err = ();

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        let mut chars = value.chars();
        let face = chars.next().map_or(Err(()), |c| CubeFace::try_from(c))?;
        let turn = match chars.next() {
            Some('2') => Ok(Direction::Half),
            Some('\'') | Some('’') => Ok(Direction::CounterClockwise),
            None => Ok(Direction::Clockwise),
            _ => Err(()),
        }?;
        if chars.next().is_none() {
            Ok(CubeOuterTurn::new(face, turn))
        } else {
            Err(())
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "serde_support", derive(serde::Serialize, serde::Deserialize))]
pub enum CubeAxis {
    LR = 0,
    UD = 1,
    FB = 2,
}

impl CubeAxis {
    pub const X: CubeAxis = CubeAxis::LR;
    pub const Y: CubeAxis = CubeAxis::UD;
    pub const Z: CubeAxis = CubeAxis::FB;

    pub fn name(&self) -> &'static str {
        match self {
            CubeAxis::LR => "lr",
            CubeAxis::UD => "ud",
            CubeAxis::FB => "fb",
        }
    }
}

impl<T, const N: usize> Index<CubeAxis> for [T; N] {
    type Output = T;

    fn index(&self, index: CubeAxis) -> &Self::Output {
        &self[index as usize]
    }
}

#[derive(Debug, Clone, Copy)]
pub enum CubeColor {
    White = 0,
    Yellow = 1,
    Green = 2,
    Blue = 3,
    Orange = 4,
    Red = 5,

    None = 6,
}

#[derive(Debug, Clone, Copy)]
pub struct Corner {
    pub id: u8,
    pub orientation: u8,
}

#[derive(Debug, Clone, Copy)]
pub struct Edge {
    pub id: u8,
    pub oriented_ud: bool,
    pub oriented_fb: bool,
    pub oriented_rl: bool,
}

impl Display for CubeColor {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            CubeColor::White => write!(f, "⬜"),
            CubeColor::Yellow => write!(f, "🟨"),
            CubeColor::Blue => write!(f, "🟦"),
            CubeColor::Green => write!(f, "🟩"),
            CubeColor::Red => write!(f, "🟥"),
            CubeColor::Orange => write!(f, "🟧"),
            CubeColor::None => write!(f, "⬛"),
        }
    }
}