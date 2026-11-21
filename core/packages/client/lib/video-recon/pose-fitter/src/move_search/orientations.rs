//! State-independent orientation alternatives; no PnP, projection or fitting.
use super::prepared::{Geometry, Prepared};
use crate::math::*;
use serde::Deserialize;
use std::sync::OnceLock;
#[derive(Deserialize)]
pub struct Orientations {
    pub matrices: Vec<M3>,
    pub face_permutations: Vec<Vec<usize>>,
    pub identity_index: usize,
}
pub fn tables() -> &'static Orientations {
    static TABLE: OnceLock<Orientations> = OnceLock::new();
    TABLE.get_or_init(|| {
        serde_json::from_str(include_str!("../../tables/orientations.json")).unwrap()
    })
}
pub fn angle(a: M3, b: M3) -> f64 {
    let trace = similarity(a, b);
    ((trace - 1.) / 2.).clamp(-1., 1.).acos().to_degrees()
}
pub fn similarity(a: M3, b: M3) -> f64 {
    a.iter()
        .flatten()
        .zip(b.iter().flatten())
        .map(|(x, y)| x * y)
        .sum::<f64>()
}
fn variant(base: &Geometry, symmetry: usize) -> Geometry {
    let t = tables();
    let s = t.matrices[symmetry];
    let mut g = base.clone();
    g.index = 6 + base.bank_index * 24 + symmetry;
    g.symmetry = symmetry;
    g.rotation = mm(base.rotation, transpose(s));
    if let Some(axis) = base.shape.axis {
        let target = (0..3).find(|&i| s[i][axis] != 0.).unwrap();
        let angles = if s[target][axis] > 0. {
            base.shape.angles
        } else {
            [
                -base.shape.angles[2],
                -base.shape.angles[1],
                -base.shape.angles[0],
            ]
        };
        g.shape = super::routes::Shape::new(target, angles);
    }
    let perm = &t.face_permutations[symmetry];
    g.signature = base
        .signature
        .iter()
        .map(|&f| if f < 54 { perm[f] } else { f })
        .collect();
    g.observations = base
        .observations
        .iter()
        .map(|(face, costs)| (perm[*face], *costs))
        .collect();
    g.observations.sort_by_key(|(face, _)| *face);
    g
}
/// Retain the original camera orientation and its closest cube-symmetry
/// continuation for each incoming context when the original jump exceeds 45°.
/// Full sticker colors in the search state decide between them, including slice
/// moves. A legitimate rapid hand rotation is always still available.
pub fn augment(current: &mut Prepared, previous: Option<&Prepared>) {
    let t = tables();
    let bases = current.geometries.clone();
    // A frame has one shared cube basis across its six geometric fits. Derive
    // at most one continuation from the preceding primary cameras; search
    // branches must not invent more bases from their own move histories.
    let mut candidate = None;
    if let (Some(base), Some(previous)) = (bases.first(), previous) {
        let primary = previous.geometries.first().map(|g| g.bank_index);
        for parent in previous
            .geometries
            .iter()
            .filter(|g| Some(g.bank_index) == primary)
        {
            if angle(parent.rotation, base.rotation) <= 45. {
                continue;
            }
            for symmetry in 0..t.matrices.len() {
                if symmetry == t.identity_index {
                    continue;
                }
                let distance = angle(
                    parent.rotation,
                    mm(base.rotation, transpose(t.matrices[symmetry])),
                );
                if distance < 45. && candidate.is_none_or(|(_, old)| distance < old) {
                    candidate = Some((symmetry, distance));
                }
            }
        }
    }
    if current.rotation_limit.is_some() {
        for symmetry in 0..t.matrices.len() {
            if symmetry != t.identity_index {
                current
                    .geometries
                    .extend(bases.iter().map(|base| variant(base, symmetry)));
            }
        }
    } else if let Some((symmetry, _)) = candidate {
        current
            .geometries
            .extend(bases.iter().map(|base| variant(base, symmetry)));
    }
    if let Some(previous) = previous {
        current.orientation_parents = previous
            .geometries
            .iter()
            .map(|g| {
                (
                    Some(g.index),
                    (g.shape.clone(), Some(g.rotation), previous.geometry_flagged),
                )
            })
            .collect();
    } else {
        current
            .orientation_parents
            .insert(None, (super::routes::Shape::flat(), None, false));
    }
    current.shapes = current
        .geometries
        .iter()
        .map(|g| (g.index, g.shape.clone()))
        .collect();
    current.index_geometries();
}
