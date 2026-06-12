use std::fmt::{Debug, Display, Formatter};
use std::str::FromStr;
use itertools::Itertools;
//This should be in the htr step, but we need it in the wasm version and the HTR step cannot be compiled to wasm right now

#[derive(Copy, Clone, Eq, PartialEq, Hash)]
pub struct Subset {
    pub discriminator: Option<&'static str>,
    pub generator: &'static str, //We need a const array, and creating an FromStr isn't const
    pub corners: u8,
    pub edges: u8,
    pub qt_corners: u8,
    pub qt: u8,
}

impl AsRef<Subset> for Subset {
    fn as_ref(&self) -> &Subset {
        self
    }
}

impl FromStr for Subset {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        DR_SUBSETS.iter()
            .find(|x|x.to_string().as_str().eq(s))
            .cloned()
            .ok_or(())
    }
}

impl Subset {
    pub(crate) const fn new(name: Option<&'static str>, generator: &'static str, corners: u8, edges: u8, qt_corners: u8, qt: u8) -> Self {
        Self { discriminator: name, generator, corners, edges, qt_corners, qt }
    }
}

impl Display for Subset {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}{}{} {}e", self.corners, self.discriminator.unwrap_or("c"), self.qt_corners, self.edges)
    }
}

impl Debug for Subset {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        Display::fmt(self, f)
    }
}

pub const DR_SUBSETS: [Subset; 48] = [
    Subset::new(None, "", 0, 0, 0, 0),
    Subset::new(None, "U R2 F2 R2 U", 0, 2, 0, 2),
    Subset::new(None, "U R2 L2 D", 0, 4, 0, 2),
    Subset::new(None, "U R2 L2 F2 R2 F2 D", 0, 6, 0, 2),
    Subset::new(None, "U R2 L2 F2 B2 U", 0, 8, 0, 2),
    Subset::new(Some("a"), "U R2 L2 U F2 B2 D", 4, 0, 1, 3),
    Subset::new(Some("a"), "U R2 L2 U R2 U", 4, 2, 1, 3),
    Subset::new(Some("a"), "U", 4, 4, 1, 1),
    Subset::new(Some("b"), "U R2 F2 R2 F2 U", 4, 0, 2, 2),
    Subset::new(Some("b"), "U R2 U", 4, 2, 2, 2),
    Subset::new(Some("b"), "U R2 F2 U", 4, 4, 2, 2),
    Subset::new(Some("a"), "U R2 U R2 B2 R2 U' R2 U", 4, 0, 2, 2),
    Subset::new(Some("a"), "D B2 D' F2 B2 D' F2 D", 4, 2, 2, 2),
    Subset::new(Some("a"), "U R2 U2 F2 U", 4, 4, 2, 2),
    Subset::new(None, "U F2 U2 R2 B2 U' L2 B2 D", 2, 0, 3, 3),
    Subset::new(None, "U R2 U R2 U", 2, 2, 3, 3),
    Subset::new(None, "U L2 U F2 U", 2, 4, 3, 3),
    Subset::new(None, "U L2 D R2 F2 B2 U", 2, 6, 3, 3),
    Subset::new(None, "U B2 L2 U B2 L2 U2 B2 D", 2, 8, 3, 3),
    Subset::new(None, "U R2 F2 U R2 U2 F2 U", 4, 0, 3, 3),
    Subset::new(None, "U B2 U R2 U2 F2 D", 4, 2, 3, 3),
    Subset::new(None, "U B2 U' L2 U2 B2 D", 4, 4, 3, 3),
    Subset::new(None, "U R2 U2 F2 U' R2 U2 R2 F2 U", 0, 0, 3, 3),
    Subset::new(None, "U R2 U2 F2 U R2 U2 F2 U", 0, 2, 3, 3),
    Subset::new(None, "U R2 U2 F2 U R2 U2 R2 B2 D", 0, 4, 3, 3),
    Subset::new(None, "U L2 U2 F2 U B2 U2 R2 U", 0, 6, 3, 3),
    Subset::new(None, "U R2 U2 F2 U' L2 U2 R2 F2 D", 0, 8, 3, 3),
    Subset::new(None, "U L2 D' R2 D L2 U", 2, 0, 4, 4),
    Subset::new(None, "U R2 U' R2 U R2 U", 2, 2, 4, 4),
    Subset::new(None, "U R2 U' L2 D R2 D", 2, 4, 4, 4),
    Subset::new(None, "U' B2 D' L2 B2 U' R2 U", 2, 6, 4, 4),
    Subset::new(None, "U R2 L2 B2 U R2 U' F2 U", 2, 8, 4, 4),
    Subset::new(None, "U R2 U R2 U2 B2 U B2 U", 0, 0, 4, 4),
    Subset::new(None, "U L2 U B2 U2 R2 U L2 U", 0, 2, 4, 4),
    Subset::new(None, "U B2 U F2 U2 R2 U R2 D", 0, 4, 4, 4),
    Subset::new(None, "U' R2 U L2 U2 L2 B2 U' B2 D", 0, 6, 4, 4),
    Subset::new(None, "U' R2 U R2 U2 B2 U F2 R2 L2 U", 0, 8, 4, 4),
    Subset::new(None, "U R2 U B2 U2 R2 F2 B2 U' B2 U", 4, 0, 4, 4),
    Subset::new(None, "U' F2 U F2 U2 R2 U' R2 U", 4, 2, 4, 4),
    Subset::new(None, "U' B2 U F2 U2 R2 U' R2 U", 4, 4, 4, 4),
    Subset::new(None, "U L2 U L2 U' L2 B2 U' B2 U", 2, 0, 5, 5),
    Subset::new(None, "U L2 U R2 U' R2 U R2 U", 2, 2, 5, 5),
    Subset::new(None, "D R2 U L2 D' R2 D L2 U", 2, 4, 5, 5),
    Subset::new(None, "U L2 U F2 U' R2 U B2 U", 2, 6, 5, 5),
    Subset::new(None, "U R2 U L2 F2 U B2 U' L2 U", 2, 8, 5, 5),
    Subset::new(None, "U' L2 U L2 U' R2 U R2 U", 4, 0, 5, 5),
    Subset::new(None, "U' R2 U F2 U' F2 U B2 D", 4, 2, 5, 5),
    Subset::new(None, "U' R2 U F2 U' F2 U F2 U", 4, 4, 5, 5)
];

pub const SUBSETS_0C0: &[Subset] = &[
    DR_SUBSETS[0],
    DR_SUBSETS[1],
    DR_SUBSETS[2],
    DR_SUBSETS[3],
    DR_SUBSETS[4],
];

pub const SUBSETS_4A1: &[Subset] = &[
    DR_SUBSETS[5],
    DR_SUBSETS[6],
    DR_SUBSETS[7],
];

pub const SUBSETS_4B2: &[Subset] = &[
    DR_SUBSETS[8],
    DR_SUBSETS[9],
    DR_SUBSETS[10],
];

pub const SUBSETS_4A2: &[Subset] = &[
    DR_SUBSETS[11],
    DR_SUBSETS[12],
    DR_SUBSETS[13],
];

pub const SUBSETS_2C3: &[Subset] = &[
    DR_SUBSETS[14],
    DR_SUBSETS[15],
    DR_SUBSETS[16],
    DR_SUBSETS[17],
    DR_SUBSETS[18],
];

pub const SUBSETS_4A3: &[Subset] = &[
    DR_SUBSETS[19],
    DR_SUBSETS[20],
    DR_SUBSETS[21],
];

pub const SUBSETS_4B3: &[Subset] = SUBSETS_4A3;

pub const SUBSETS_0C3: &[Subset] = &[
    DR_SUBSETS[22],
    DR_SUBSETS[23],
    DR_SUBSETS[24],
    DR_SUBSETS[25],
    DR_SUBSETS[26],
];

pub const SUBSETS_2C4: &[Subset] = &[
    DR_SUBSETS[27],
    DR_SUBSETS[28],
    DR_SUBSETS[29],
    DR_SUBSETS[30],
    DR_SUBSETS[31],
];

pub const SUBSETS_0C4: &[Subset] = &[
    DR_SUBSETS[32],
    DR_SUBSETS[33],
    DR_SUBSETS[34],
    DR_SUBSETS[35],
    DR_SUBSETS[36],
];

pub const SUBSETS_4A4: &[Subset] = &[
    DR_SUBSETS[37],
    DR_SUBSETS[38],
    DR_SUBSETS[39],
];

pub const SUBSETS_4B4: &[Subset] = SUBSETS_4A4;

pub const SUBSETS_2C5: &[Subset] = &[
    DR_SUBSETS[40],
    DR_SUBSETS[41],
    DR_SUBSETS[42],
    DR_SUBSETS[43],
    DR_SUBSETS[44],
];

pub const SUBSETS_4B5: &[Subset] = &[
    DR_SUBSETS[45],
    DR_SUBSETS[46],
    DR_SUBSETS[47],
];

pub fn expand_subset_name(name: &str) -> Vec<Subset> {
    DR_SUBSETS.iter().cloned()
        .filter(|x|{
            if name.len() >= 2 {
                x.to_string().starts_with(name)
            } else if name.len() == 1 {
                if let Ok(qt) = u8::from_str(name) {
                    x.qt_corners == qt
                } else {
                    false
                }
            } else {
                false
            }
        })
        .collect_vec()
}
