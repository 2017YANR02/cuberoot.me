use std::cmp::Ordering;
use std::fmt::{Display, Formatter};
use std::str::FromStr;
use std::string::ToString;
use crate::cube::CubeAxis;

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "serde_support", derive(serde::Serialize, serde::Deserialize))]
pub enum StepKind {
    EO,
    RZP,
    AR,
    DR,
    HTR,
    FR,
    FRLS,
    FIN,
    FINLS,
    VR,
    Other(String)
}

impl PartialOrd for StepKind {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        if self.eq(&other) {
            return Some(Ordering::Equal)
        }
        match (self, other) {
            (Self::EO, _) => Some(Ordering::Less),
            (_, Self::EO) => Some(Ordering::Greater),
            (Self::RZP, Self::AR) => None,
            (Self::AR, Self::RZP) => None,
            (Self::RZP, _) => Some(Ordering::Less),
            (_, Self::RZP) => Some(Ordering::Greater),
            (Self::AR, _) => Some(Ordering::Less),
            (_, Self::AR) => Some(Ordering::Greater),
            (Self::DR, _) => Some(Ordering::Less),
            (_, Self::DR) => Some(Ordering::Greater),
            (Self::HTR, _) => Some(Ordering::Less),
            (_, Self::HTR) => Some(Ordering::Greater),
            (Self::FR, Self::FIN) => Some(Ordering::Less),
            (Self::FIN, Self::FR) => Some(Ordering::Greater),
            (Self::FRLS, Self::FINLS) => Some(Ordering::Less),
            (Self::FINLS, Self::FRLS) => Some(Ordering::Greater),
            _ => None,
        }
    }
}

impl PartialOrd for StepVariant {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        if self.eq(other) {
            return Some(Ordering::Equal)
        }
        let self_kind = StepKind::from(self.clone());
        let other_kind = StepKind::from(self.clone());
        if self_kind == other_kind {
            return None
        }
        self_kind.partial_cmp(&other_kind)
    }
}

#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "serde_support", derive(serde::Serialize, serde::Deserialize))]
pub enum StepVariant {
    EO(CubeAxis),
    RZP {
        eo_axis: CubeAxis,
        dr_axis: CubeAxis
    },
    AR {
        eo_axis: CubeAxis,
        dr_axis: CubeAxis
    },
    DR {
        eo_axis: CubeAxis,
        dr_axis: CubeAxis
    },
    HTR(CubeAxis),
    FR(CubeAxis),
    FRLS(CubeAxis),
    FRFIN(CubeAxis),
    FRFINLS(CubeAxis),
    HTRFIN,
    HTRFINLS(CubeAxis),
    DRFIN(CubeAxis),
    DRFINLS(CubeAxis),
}

impl StepVariant {
    pub(crate) fn can_solve_next(&self, other: &Self) -> bool {
        match (self, other) {
            (StepVariant::EO(x), StepVariant::DR { eo_axis, .. }) if eo_axis == x => true,
            (StepVariant::EO(x), StepVariant::RZP { eo_axis, .. }) if eo_axis == x => true,
            (StepVariant::EO(x), StepVariant::AR { eo_axis, .. }) if eo_axis == x => true,
            (
                StepVariant::RZP { dr_axis: rzp_dr_axis, eo_axis: rzp_eo_axis },
                StepVariant::DR { dr_axis, eo_axis }
            ) if dr_axis == rzp_dr_axis && eo_axis == rzp_eo_axis => true,
            (
                StepVariant::AR { dr_axis: rzp_dr_axis, eo_axis: rzp_eo_axis },
                StepVariant::DR { dr_axis, eo_axis }
            ) if dr_axis == rzp_dr_axis && eo_axis == rzp_eo_axis => true,
            (StepVariant::DR { dr_axis, .. }, StepVariant::HTR(htr_axis)) if dr_axis == htr_axis => true,
            (StepVariant::DR { dr_axis, .. }, StepVariant::DRFIN(drfin_axis)) if dr_axis == drfin_axis => true,
            (StepVariant::DR { dr_axis, .. }, StepVariant::DRFINLS(drfin_axis)) if dr_axis == drfin_axis => true,
            (StepVariant::HTR(_), StepVariant::DRFIN(_)) => true,
            (StepVariant::HTR(_), StepVariant::DRFINLS(_)) => true,
            (StepVariant::HTR(_), StepVariant::FR(_)) => true,
            (StepVariant::HTR(_), StepVariant::FRLS(_)) => true,
            (StepVariant::HTR(_), StepVariant::HTRFIN) => true,
            (StepVariant::HTR(_), StepVariant::HTRFINLS(_)) => true,
            (StepVariant::FR(x), StepVariant::FRFIN(y)) if x == y => true,
            (StepVariant::FRLS(x), StepVariant::FRFINLS(y)) if x == y => true,
            _ => false
        }
    }
}

impl Display for StepKind {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", Into::<String>::into(self.clone()))
    }
}

impl Display for StepVariant {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            StepVariant::EO(eo) => write!(f, "eo{}", eo.name()),
            StepVariant::RZP { eo_axis, dr_axis } => write!(f, "rzp{}-eo{}", dr_axis.name(), eo_axis.name()),
            StepVariant::AR { eo_axis, dr_axis } => write!(f, "ar{}-eo{}", dr_axis.name(), eo_axis.name()),
            StepVariant::DR { eo_axis, dr_axis } => write!(f, "dr{}-eo{}", dr_axis.name(), eo_axis.name()),
            StepVariant::HTR(dr) => write!(f, "htr-dr{}", dr.name()),
            StepVariant::FR(fr) => write!(f, "fr{}", fr.name()),
            StepVariant::FRLS(fr) => write!(f, "frls{}", fr.name()),
            StepVariant::FRFINLS(ls) | StepVariant::HTRFINLS(ls) | StepVariant::DRFINLS(ls) => write!(f, "finls-{}", ls.name()),
            StepVariant::HTRFIN | StepVariant::DRFIN(_) | StepVariant::FRFIN(_) => write!(f, "fin"),
        }
    }
}

impl From<StepVariant> for StepKind {
    fn from(value: StepVariant) -> Self {
        match value {
            StepVariant::EO(_) => Self::EO,
            StepVariant::RZP { .. } => Self::RZP,
            StepVariant::AR { .. } => Self::AR,
            StepVariant::DR { .. } => Self::DR,
            StepVariant::HTR(_) => Self::HTR,
            StepVariant::FR(_) => Self::FR,
            StepVariant::FRLS(_) => Self::FRLS,
            StepVariant::FRFIN(_) => Self::FIN,
            StepVariant::FRFINLS(_) => Self::FINLS,
            StepVariant::HTRFIN => Self::FIN,
            StepVariant::HTRFINLS(_) => Self::FINLS,
            StepVariant::DRFIN(_) => Self::FIN,
            StepVariant::DRFINLS(_) => Self::FINLS,
        }
    }
}

impl FromStr for StepKind {
    type Err = std::convert::Infallible;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "eo" => Ok(Self::EO),
            "dr" => Ok(Self::DR),
            "rzp" => Ok(Self::RZP),
            "ar" | "jzp" => Ok(Self::AR),
            "htr" => Ok(Self::HTR),
            "fr" => Ok(Self::FR),
            "frls" => Ok(Self::FRLS),
            "finish" | "fin" => Ok(Self::FIN),
            "finls" => Ok(Self::FINLS),
            "vr" => Ok(Self::VR),
            x=> Ok(Self::Other(x.to_string()))
        }
    }
}

impl Into<String> for StepKind {
    fn into(self) -> String {
        match self {
            StepKind::EO => "eo".to_string(),
            StepKind::RZP => "rzp".to_string(),
            StepKind::AR => "ar".to_string(),
            StepKind::DR => "dr".to_string(),
            StepKind::HTR => "htr".to_string(),
            StepKind::FR => "fr".to_string(),
            StepKind::FRLS => "frls".to_string(),
            StepKind::FIN => "finish".to_string(),
            StepKind::FINLS => "finls".to_string(),
            StepKind::VR => "vr".to_string(),
            StepKind::Other(x) => x,
        }
    }
}

#[derive(Default, Clone, Copy, PartialEq, Eq, Debug)]
#[cfg_attr(feature = "serde_support", derive(serde_with::DeserializeFromStr, serde_with::SerializeDisplay))]
pub enum NissSwitchType {
    #[default] Never = 0,
    Before = 1,
    Always = 2,
}

impl FromStr for NissSwitchType {
    type Err = &'static str;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "never" => Ok(NissSwitchType::Never),
            "before" => Ok(NissSwitchType::Before),
            "always" => Ok(NissSwitchType::Always),
            _ => Err("Invalid option")
        }
    }
}

impl Display for NissSwitchType {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            NissSwitchType::Never => write!(f, "never"),
            NissSwitchType::Before => write!(f, "before"),
            NissSwitchType::Always => write!(f, "always"),
        }
    }
}
