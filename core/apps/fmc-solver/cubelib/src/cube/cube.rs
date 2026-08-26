use std::fmt::{Display, Formatter};
use std::ops::Deref;

use crate::cube::{CornerCube333, EdgeCube333, Transformation333, Turn333};
use crate::cube::cube::CornerPosition::*;
use crate::cube::cube::EdgePosition::*;
use crate::cube::cube_edges::CenterEdgeCube;
use crate::cube::turn::{ApplySymmetry, CubeColor, CubeFace, InvertibleMut, TransformableMut, TurnableMut};

//http://kociemba.org/math/cubielevel.htm
#[derive(Debug, Clone, Copy, PartialEq)]
#[cfg_attr(feature = "serde_support", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(target_feature = "avx2", derive(Hash))]
pub struct Cube333 {
    pub edges: EdgeCube333,
    pub corners: CornerCube333,
}

impl Into<EdgeCube333> for &Cube333 {
    fn into(self) -> EdgeCube333 {
        self.edges
    }
}

impl Into<CornerCube333> for &Cube333 {
    fn into(self) -> CornerCube333 {
        self.corners
    }
}

impl Cube333 {
    pub fn new(edges: EdgeCube333, corners: CornerCube333) -> Cube333 {
        Cube333 { edges, corners }
    }
    #[cfg(not(target_arch = "wasm32"))]
    pub fn random<T: rand::Rng>(rng: &mut T) -> Cube333 {
        let parity = rng.random_bool(0.5);
        Cube333 {
            edges: EdgeCube333::random(parity, rng),
            corners: CornerCube333::random(parity, rng),
        }
    }
}

impl Deref for Cube333 {
    type Target = EdgeCube333;

    fn deref(&self) -> &Self::Target {
        &self.edges
    }
}

impl Display for Cube333 {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let facelets = self.get_facelets();
        let block_width = "   ";
        let block_spacing = " ";
        for x in (0..3).rev() {
            write!(f, "{}{}", block_width.repeat(3), block_spacing.repeat(4))?;
            for y in (0..3).rev() {
                write!(f, "{}{}", facelets[CubeFace::Back][x * 3 + y], block_spacing)?;
            }
            writeln!(f)?;
        }
        for x in 0..3 {
            let x_rev = 2 - x;
            for y in (0..3).rev() {
                write!(f, "{}{}", facelets[CubeFace::Left][x + y * 3], block_spacing)?;
            }
            write!(f, "{}", block_spacing)?;
            for y in 0..3 {
                write!(f, "{}{}", facelets[CubeFace::Up][x * 3 + y], block_spacing)?;
            }
            write!(f, "{}", block_spacing)?;
            for y in 0..3 {
                write!(
                    f,
                    "{}{}",
                    facelets[CubeFace::Right][x_rev + y * 3],
                    block_spacing
                )?;
            }
            write!(f, "{}", block_spacing)?;
            for y in (0..3).rev() {
                write!(
                    f,
                    "{}{}",
                    facelets[CubeFace::Down][x_rev * 3 + y],
                    block_spacing
                )?;
            }
            writeln!(f)?;
        }

        for x in 0..3 {
            write!(f, "{}{}", block_width.repeat(3), block_spacing.repeat(4))?;
            for y in 0..3 {
                write!(f, "{}{}", facelets[CubeFace::Front][x * 3 + y], block_spacing)?;
            }
            writeln!(f)?;
        }
        Ok(())
    }
}

impl TurnableMut for Cube333 {
    fn turn(&mut self, m: Turn333) {
        self.edges.turn(m);
        self.corners.turn(m);
    }
}

impl TransformableMut for Cube333 {
    fn transform(&mut self, t: Transformation333) {
        self.edges.transform(t);
        self.corners.transform(t);
    }
}

impl InvertibleMut for Cube333 {
    #[inline]
    fn invert(&mut self) {
        self.edges.invert();
        self.corners.invert();
    }
}

impl Default for Cube333 {
    #[inline]
    fn default() -> Cube333 {
        Cube333 {
            edges: EdgeCube333::default(),
            corners: CornerCube333::default(),
        }
    }
}

#[derive(Copy, Clone)]
pub struct Symmetry(pub(crate) bool, pub(crate) &'static [Transformation333]);

impl Symmetry {
    pub const U0: Symmetry = Symmetry(false, &[]);
    pub const U1: Symmetry = Symmetry(false, &[Transformation333::Y]);
    pub const U2: Symmetry = Symmetry(false, &[Transformation333::Y2]);
    pub const U3: Symmetry = Symmetry(false, &[Transformation333::Yi]);

    pub const F0: Symmetry = Symmetry(false, &[Transformation333::X]);
    pub const F1: Symmetry = Symmetry(false, &[Transformation333::X, Transformation333::Y]);
    pub const F2: Symmetry = Symmetry(false, &[Transformation333::X, Transformation333::Y2]);
    pub const F3: Symmetry = Symmetry(false, &[Transformation333::X, Transformation333::Yi]);

    pub const B0: Symmetry = Symmetry(false, &[Transformation333::Xi]);
    pub const B1: Symmetry = Symmetry(false, &[Transformation333::Xi, Transformation333::Y]);
    pub const B2: Symmetry = Symmetry(false, &[Transformation333::Xi, Transformation333::Y2]);
    pub const B3: Symmetry = Symmetry(false, &[Transformation333::Xi, Transformation333::Yi]);

    pub const D0: Symmetry = Symmetry(false, &[Transformation333::X2]);
    pub const D1: Symmetry = Symmetry(false, &[Transformation333::X2, Transformation333::Y]);
    pub const D2: Symmetry = Symmetry(false, &[Transformation333::X2, Transformation333::Y2]);
    pub const D3: Symmetry = Symmetry(false, &[Transformation333::X2, Transformation333::Yi]);

    pub const L0: Symmetry = Symmetry(false, &[Transformation333::Z]);
    pub const L1: Symmetry = Symmetry(false, &[Transformation333::Z, Transformation333::Y]);
    pub const L2: Symmetry = Symmetry(false, &[Transformation333::Z, Transformation333::Y2]);
    pub const L3: Symmetry = Symmetry(false, &[Transformation333::Z, Transformation333::Yi]);

    pub const R0: Symmetry = Symmetry(false, &[Transformation333::Zi]);
    pub const R1: Symmetry = Symmetry(false, &[Transformation333::Zi, Transformation333::Y]);
    pub const R2: Symmetry = Symmetry(false, &[Transformation333::Zi, Transformation333::Y2]);
    pub const R3: Symmetry = Symmetry(false, &[Transformation333::Zi, Transformation333::Yi]);

    pub const UM0: Symmetry = Symmetry(true, &[]);
    pub const UM1: Symmetry = Symmetry(true, &[Transformation333::Y]);
    pub const UM2: Symmetry = Symmetry(true, &[Transformation333::Y2]);
    pub const UM3: Symmetry = Symmetry(true, &[Transformation333::Yi]);

    pub const FM0: Symmetry = Symmetry(true, &[Transformation333::X]);
    pub const FM1: Symmetry = Symmetry(true, &[Transformation333::X, Transformation333::Y]);
    pub const FM2: Symmetry = Symmetry(true, &[Transformation333::X, Transformation333::Y2]);
    pub const FM3: Symmetry = Symmetry(true, &[Transformation333::X, Transformation333::Yi]);

    pub const BM0: Symmetry = Symmetry(true, &[Transformation333::Xi]);
    pub const BM1: Symmetry = Symmetry(true, &[Transformation333::Xi, Transformation333::Y]);
    pub const BM2: Symmetry = Symmetry(true, &[Transformation333::Xi, Transformation333::Y2]);
    pub const BM3: Symmetry = Symmetry(true, &[Transformation333::Xi, Transformation333::Yi]);

    pub const DM0: Symmetry = Symmetry(true, &[Transformation333::X2]);
    pub const DM1: Symmetry = Symmetry(true, &[Transformation333::X2, Transformation333::Y]);
    pub const DM2: Symmetry = Symmetry(true, &[Transformation333::X2, Transformation333::Y2]);
    pub const DM3: Symmetry = Symmetry(true, &[Transformation333::X2, Transformation333::Yi]);

    pub const LM0: Symmetry = Symmetry(true, &[Transformation333::Z]);
    pub const LM1: Symmetry = Symmetry(true, &[Transformation333::Z, Transformation333::Y]);
    pub const LM2: Symmetry = Symmetry(true, &[Transformation333::Z, Transformation333::Y2]);
    pub const LM3: Symmetry = Symmetry(true, &[Transformation333::Z, Transformation333::Yi]);

    pub const RM0: Symmetry = Symmetry(true, &[Transformation333::Zi]);
    pub const RM1: Symmetry = Symmetry(true, &[Transformation333::Zi, Transformation333::Y]);
    pub const RM2: Symmetry = Symmetry(true, &[Transformation333::Zi, Transformation333::Y2]);
    pub const RM3: Symmetry = Symmetry(true, &[Transformation333::Zi, Transformation333::Yi]);

    pub const I: Symmetry = Self::U0;
    pub const M: Symmetry = Self::UM0;
}

impl AsRef<Symmetry> for Symmetry {
    fn as_ref(&self) -> &Symmetry {
        self
    }
}

#[cfg(any(target_feature = "avx2", target_feature = "neon"))]
impl ApplySymmetry for Cube333 {
    fn apply_symmetry<T: AsRef<Symmetry>>(&mut self, s: T) {
        self.edges.apply_symmetry(&s);
        self.corners.apply_symmetry(s);
    }
}

#[derive(Debug, Clone, Copy)]
pub enum CornerPosition {
    UBL = 0,
    UBR = 1,
    UFR = 2,
    UFL = 3,
    DFL = 4,
    DFR = 5,
    DBR = 6,
    DBL = 7,
}

#[derive(Debug, Clone, Copy)]
pub enum EdgePosition {
    UB = 0,
    UR = 1,
    UF = 2,
    UL = 3,
    FR = 4,
    FL = 5,
    BR = 6,
    BL = 7,
    DF = 8,
    DR = 9,
    DB = 10,
    DL = 11,
}

impl Display for CenterEdgeCube {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", Cube333 {
            edges: self.clone(),
            corners: Default::default(),
        })
    }
}

impl Display for CornerCube333 {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", Cube333 {
            edges: Default::default(),
            corners: self.clone(),
        })
    }
}

impl Cube333 {
    pub const CORNER_COLORS: [[CubeColor; 3]; 8] = [
        [CubeColor::White, CubeColor::Orange, CubeColor::Blue],
        [CubeColor::White, CubeColor::Blue, CubeColor::Red],
        [CubeColor::White, CubeColor::Red, CubeColor::Green],
        [CubeColor::White, CubeColor::Green, CubeColor::Orange],
        [CubeColor::Yellow, CubeColor::Orange, CubeColor::Green],
        [CubeColor::Yellow, CubeColor::Green, CubeColor::Red],
        [CubeColor::Yellow, CubeColor::Red, CubeColor::Blue],
        [CubeColor::Yellow, CubeColor::Blue, CubeColor::Orange],
    ];

    const EDGE_COLORS: [[CubeColor; 2]; 12] = [
        [CubeColor::White, CubeColor::Blue],
        [CubeColor::White, CubeColor::Red],
        [CubeColor::White, CubeColor::Green],
        [CubeColor::White, CubeColor::Orange],
        [CubeColor::Green, CubeColor::Red],
        [CubeColor::Green, CubeColor::Orange],
        [CubeColor::Blue, CubeColor::Red],
        [CubeColor::Blue, CubeColor::Orange],
        [CubeColor::Yellow, CubeColor::Green],
        [CubeColor::Yellow, CubeColor::Red],
        [CubeColor::Yellow, CubeColor::Blue],
        [CubeColor::Yellow, CubeColor::Orange],
    ];

    pub fn get_facelets(&self) -> [[CubeColor; 9]; 6] {
        let corners = self.corners.get_corners();
        let edges = self.edges.get_edges();
        let mut facelets = [[CubeColor::None; 9]; 6];

        //There has to be a better way
        let c = |id: CornerPosition, twist: u8| {
            let corner = corners[id as usize];
            let twist_id = (3 - corner.orientation + twist) % 3;
            Cube333::CORNER_COLORS[corner.id as usize][twist_id as usize]
        };

        let e = |id: EdgePosition, flip: bool| {
            let edge = edges[id as usize];
            let eo_id = !(edge.oriented_fb ^ flip) as usize;
            Cube333::EDGE_COLORS[edge.id as usize][eo_id as usize]
        };

        facelets[CubeFace::Up][0] = c(UBL, 0);
        facelets[CubeFace::Up][1] = e(UB, false);
        facelets[CubeFace::Up][2] = c(UBR, 0);
        facelets[CubeFace::Up][3] = e(UL, false);
        facelets[CubeFace::Up][4] = CubeColor::White;
        facelets[CubeFace::Up][5] = e(UR, false);
        facelets[CubeFace::Up][6] = c(UFL, 0);
        facelets[CubeFace::Up][7] = e(UF, false);
        facelets[CubeFace::Up][8] = c(UFR, 0);

        facelets[CubeFace::Down][0] = c(DFL, 0);
        facelets[CubeFace::Down][1] = e(DF, false);
        facelets[CubeFace::Down][2] = c(DFR, 0);
        facelets[CubeFace::Down][3] = e(DL, false);
        facelets[CubeFace::Down][4] = CubeColor::Yellow;
        facelets[CubeFace::Down][5] = e(DR, false);
        facelets[CubeFace::Down][6] = c(DBL, 0);
        facelets[CubeFace::Down][7] = e(DB, false);
        facelets[CubeFace::Down][8] = c(DBR, 0);

        facelets[CubeFace::Front][0] = c(UFL, 1);
        facelets[CubeFace::Front][1] = e(UF, true);
        facelets[CubeFace::Front][2] = c(UFR, 2);
        facelets[CubeFace::Front][3] = e(FL, false);
        facelets[CubeFace::Front][4] = CubeColor::Green;
        facelets[CubeFace::Front][5] = e(FR, false);
        facelets[CubeFace::Front][6] = c(DFL, 2);
        facelets[CubeFace::Front][7] = e(DF, true);
        facelets[CubeFace::Front][8] = c(DFR, 1);

        facelets[CubeFace::Back][0] = c(UBR, 1);
        facelets[CubeFace::Back][1] = e(UB, true);
        facelets[CubeFace::Back][2] = c(UBL, 2);
        facelets[CubeFace::Back][3] = e(BR, false);
        facelets[CubeFace::Back][4] = CubeColor::Blue;
        facelets[CubeFace::Back][5] = e(BL, false);
        facelets[CubeFace::Back][6] = c(DBR, 2);
        facelets[CubeFace::Back][7] = e(DB, true);
        facelets[CubeFace::Back][8] = c(DBL, 1);

        facelets[CubeFace::Left][0] = c(UBL, 1);
        facelets[CubeFace::Left][1] = e(UL, true);
        facelets[CubeFace::Left][2] = c(UFL, 2);
        facelets[CubeFace::Left][3] = e(BL, true);
        facelets[CubeFace::Left][4] = CubeColor::Orange;
        facelets[CubeFace::Left][5] = e(FL, true);
        facelets[CubeFace::Left][6] = c(DBL, 2);
        facelets[CubeFace::Left][7] = e(DL, true);
        facelets[CubeFace::Left][8] = c(DFL, 1);

        facelets[CubeFace::Right][0] = c(UFR, 1);
        facelets[CubeFace::Right][1] = e(UR, true);
        facelets[CubeFace::Right][2] = c(UBR, 2);
        facelets[CubeFace::Right][3] = e(FR, true);
        facelets[CubeFace::Right][4] = CubeColor::Red;
        facelets[CubeFace::Right][5] = e(BR, true);
        facelets[CubeFace::Right][6] = c(DFR, 2);
        facelets[CubeFace::Right][7] = e(DR, true);
        facelets[CubeFace::Right][8] = c(DBR, 1);

        facelets
    }
}
