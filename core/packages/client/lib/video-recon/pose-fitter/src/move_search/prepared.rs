use super::{
    cube::Tables,
    routes::{self, Shape},
    Config, Frame,
};
use serde::Serialize;
use std::collections::BTreeMap;
use std::collections::{HashMap, HashSet};
use std::{cell::RefCell, sync::Arc};

#[derive(Clone)]
pub struct Geometry {
    pub index: usize,
    pub bank_index: usize,
    pub symmetry: usize,
    pub rotation: crate::M3,
    pub shape: Shape,
    pub signature: Vec<usize>,
    pub score: f64,
    pub inliers: usize,
    pub p90: f64,
    pub layer_inliers: usize,
    pub observations: Vec<(usize, [f64; 6])>,
}
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Row {
    pub before: Option<usize>,
    pub after: usize,
    pub moves: Arc<Vec<String>>,
    pub sources: Arc<Vec<usize>>,
    pub degrees: f64,
    pub budget: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub motion: Option<super::motion::Motion>,
}
/// Keep raw rows for probes, and cache the scorer's first-permutation wins rule.
pub struct RowBatch {
    pub rows: Vec<Row>,
    pub scoring_indices: Vec<usize>,
}
impl std::ops::Deref for RowBatch {
    type Target = [Row];
    fn deref(&self) -> &[Row] {
        &self.rows
    }
}
fn scoring_indices(rows: &[Row]) -> Vec<usize> {
    let mut seen = HashSet::new();
    rows.iter()
        .enumerate()
        .filter_map(|(i, row)| {
            seen.insert((row.before, row.after, row.sources.as_slice()))
                .then_some(i)
        })
        .collect()
}
pub struct Prepared {
    pub frame: usize,
    pub held: bool,
    pub geometries: Vec<Geometry>,
    pub geometry_lookup: Vec<usize>,
    pub shapes: BTreeMap<usize, Shape>,
    pub previous: Option<usize>,
    pub limit: f64,
    pub slice_limit: f64,
    pub rows: Vec<Row>,
    pub scoring_rows: BTreeMap<Option<usize>, Vec<usize>>,
    pub ready: bool,
    pub flagged: bool,
    pub geometry_flagged: bool,
    pub flag_sparse_color_contexts: bool,
    pub color_evidence_threshold: Option<usize>,
    pub reliability_reason: Option<&'static str>,
    pub resolve_orientation: bool,
    pub rotation_limit: Option<f64>,
    pub orientation_parents: BTreeMap<Option<usize>, (Shape, Option<crate::M3>, bool)>,
    pub orientation_cache: RefCell<HashMap<(Option<usize>, usize), Arc<RowBatch>>>,
    pub mechanical_cache: RefCell<HashMap<(ShapeKey, ShapeKey), Arc<Vec<MechanicalRoute>>>>,
}
impl Prepared {
    pub fn geometry(&self, index: usize) -> Option<&Geometry> {
        self.geometry_lookup
            .get(index)
            .and_then(|&i| self.geometries.get(i))
    }
    pub fn index_geometries(&mut self) {
        self.geometry_lookup = vec![usize::MAX; 150];
        for (position, geometry) in self.geometries.iter().enumerate() {
            self.geometry_lookup[geometry.index] = position;
        }
    }
}
pub struct MechanicalRoute {
    route: routes::Route,
    material: Box<[crate::M3]>,
}
#[derive(Clone, PartialEq, Eq, Hash)]
pub struct ShapeKey(Option<usize>, [u64; 3]);
impl From<&Shape> for ShapeKey {
    fn from(shape: &Shape) -> Self {
        Self(
            shape.axis,
            shape.angles.map(|a| if a == 0. { 0 } else { a.to_bits() }),
        )
    }
}
pub const COLORS: [&str; 6] = ["blue", "green", "orange", "red", "white", "yellow"];
fn balance(t: &Tables, k: f64, s: f64) -> f64 {
    0.5 * (k / t.keypoint_scale).clamp(0., 1.) + 0.5 * (s / t.sticker_scale).clamp(0., 1.)
}
pub fn compile(t: &Tables, c: &Config, input: Frame) -> Result<Prepared, String> {
    let reason = super::reliability::reason(&input.bank, input.landmark_count, input.colors.len());
    let geometry_reason = super::reliability::geometry_reason(&input.bank, input.landmark_count, input.colors.len());
    // Legacy explicit flags described bad geometry. New producers distinguish
    // insufficient color evidence so reliable geometry still constrains moves.
    let geometry_flagged = c.expand_flagged_frames && input.geometry_flagged
        .unwrap_or_else(|| input.flagged.unwrap_or(geometry_reason.is_some()));
    let flagged = c.expand_flagged_frames && (input.flagged.unwrap_or(reason.is_some()) || geometry_flagged);
    if input.bank.len() > 6 {
        return Err("A frame may contain at most five fits and one flat fallback".into());
    }
    if input.bank.iter().any(|f| {
        f.nearest.len() != input.colors.len()
            || f.valid.len() != input.colors.len()
            || f.nearest.iter().any(|&i| i >= 54)
    }) {
        return Err("Each fit needs one valid face assignment per sticker observation".into());
    }
    if input.colors.iter().any(|s| !COLORS.contains(&s.as_str())) {
        return Err("Unknown sticker color".into());
    }
    let held = c.turning_start_frame.is_some_and(|end| input.frame <= end) || input.bank.is_empty();
    let mut geometries: Vec<Geometry> = vec![];
    let mut ordinary = 0;
    let mut flat = false;
    if !held {
        for (index, f) in input.bank.iter().enumerate() {
            if f.flat_fallback {
                if flat {
                    continue;
                }
                flat = true;
            } else {
                if ordinary >= 5 {
                    continue;
                }
                ordinary += 1;
            }
            if f.angles.iter().any(|&a| a != 0.) && f.metrics.layer_inlier_count == 0 {
                continue;
            }
            let score = balance(t, f.metrics.keypoint_error, f.metrics.sticker_error);
            if !score.is_finite() {
                continue;
            }
            let shape = Shape::new(f.axis, f.angles);
            let signature: Vec<_> = f
                .nearest
                .iter()
                .zip(&f.valid)
                .map(|(&i, &v)| if v { i } else { 255 })
                .collect();
            let mut costs: BTreeMap<usize, [f64; 6]> = BTreeMap::new();
            for ((&face, &valid), predicted) in f.nearest.iter().zip(&f.valid).zip(&input.colors) {
                if valid {
                    let row = costs.entry(face).or_insert([1.; 6]);
                    for (i, truth) in COLORS.iter().enumerate() {
                        let cost = if *truth == predicted {
                            0.
                        } else if t.confusion[*truth].contains(predicted) {
                            0.5
                        } else {
                            1.
                        };
                        row[i] = row[i].min(cost);
                    }
                }
            }
            let g = Geometry {
                index,
                bank_index: index,
                symmetry: super::orientations::tables().identity_index,
                rotation: crate::math::rodrigues([f.params[0], f.params[1], f.params[2]]).0,
                shape,
                signature,
                score,
                inliers: f.metrics.inlier_count,
                p90: f.metrics.p90_error,
                layer_inliers: if f.angles.iter().any(|&a| a != 0.) {
                    f.metrics.layer_inlier_count
                } else {
                    0
                },
                observations: costs.into_iter().collect(),
            };
            // Match _rotation_plans: collapse only identical shape AND assignment.
            if let Some(i) = geometries
                .iter()
                .position(|p| p.shape == g.shape && p.signature == g.signature)
            {
                let p = &geometries[i];
                if (g.score, -(g.inliers as i64), g.p90) < (p.score, -(p.inliers as i64), p.p90) {
                    geometries[i] = g;
                }
            } else {
                geometries.push(g);
            }
        }
    }
    geometries.sort_by_key(|g| g.index);
    let shapes = geometries
        .iter()
        .map(|g| (g.index, g.shape.clone()))
        .collect();
    let mut result = Prepared {
        frame: input.frame,
        held,
        geometries,
        geometry_lookup: vec![],
        shapes,
        previous: None,
        limit: 0.,
        slice_limit: 0.,
        rows: vec![],
        scoring_rows: BTreeMap::new(),
        ready: held,
        flagged,
        geometry_flagged,
        flag_sparse_color_contexts: c.expand_flagged_frames,
        color_evidence_threshold: c.unrestricted_sticker_count,
        reliability_reason: flagged.then_some(reason.unwrap_or("explicit_flag")),
        resolve_orientation: c.resolve_orientation_ambiguity,
        rotation_limit: None,
        orientation_parents: BTreeMap::new(),
        orientation_cache: RefCell::new(HashMap::new()),
        mechanical_cache: RefCell::new(HashMap::new()),
    };
    result.index_geometries();
    Ok(result)
}
fn rows(t: &Tables, frame: &Prepared, previous: Option<&Prepared>) -> Vec<Row> {
    let before = previous
        .map(|p| {
            p.shapes
                .iter()
                .map(|(&i, s)| (Some(i), s.clone()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_else(|| vec![(None, Shape::flat())]);
    let mut rows: Vec<Row> = vec![];
    let mut seen = HashMap::new();
    for (&after, shape) in &frame.shapes {
        for (before_index, old) in &before {
            for route in routes::between_with_slice_limit(old, shape, frame.limit, frame.slice_limit) {
                let (sources, moves) = t.shared_permutation(&route.groups);
                let key = (*before_index, after, moves.clone());
                if let Some(&index) = seen.get(&key) {
                    let row: &mut Row = &mut rows[index];
                    row.degrees = row.degrees.min(route.degrees);
                    row.budget = route.budget;
                } else {
                    seen.insert(key, rows.len());
                    rows.push(Row {
                        before: *before_index,
                        after,
                        moves,
                        sources,
                        degrees: route.degrees,
                        budget: route.budget,
                        motion: None,
                    });
                }
            }
        }
    }
    rows
}
pub fn orientation_rows(
    t: &Tables,
    frame: &Prepared,
    before: Option<usize>,
    after: usize,
) -> Arc<RowBatch> {
    let key = (before, after);
    if let Some(rows) = frame.orientation_cache.borrow().get(&key) {
        return Arc::clone(rows);
    }
    let mut result: Vec<Row> = vec![];
    let mut seen = HashMap::new();
    if let Some((old, prior, geometry_flagged)) = frame.orientation_parents.get(&before) {
        let geometry = frame.geometry(after).unwrap();
        let shapes = (ShapeKey::from(old), ShapeKey::from(&frame.shapes[&after]));
        let cached = frame.mechanical_cache.borrow().get(&shapes).cloned();
        let measure_motion =
            !frame.geometry_flagged && !*geometry_flagged && prior.is_some() && frame.rotation_limit.is_some();
        let routes = cached.unwrap_or_else(|| {
            let routes = Arc::new(
                routes::between_with_slice_limit(old, &geometry.shape, frame.limit, frame.slice_limit)
                    .into_iter()
                    .map(|route| {
                        let material = if measure_motion {
                            t.material_cache.prepare(old, &geometry.shape, &route.groups)
                        } else {
                            Box::new([])
                        };
                        MechanicalRoute { route, material }
                    })
                    .collect(),
            );
            frame.mechanical_cache.borrow_mut().insert(shapes, Arc::clone(&routes));
            routes
        });
        for prepared in routes.iter() {
            let route = &prepared.route;
            let motion = if !frame.geometry_flagged && !*geometry_flagged {
                prior.zip(frame.rotation_limit).map(|(prior, limit)| {
                    (
                        super::motion::measure_prepared(
                            prior,
                            geometry.rotation,
                            &prepared.material,
                        ),
                        limit,
                    )
                })
            } else {
                None
            };
            if motion.is_some_and(|(m, limit)| {
                m.rigid_degrees > limit + 1e-6 || m.combined_degrees > frame.limit + 1e-6
            }) {
                continue;
            }
            let (sources, moves) = t.shared_permutation(&route.groups);
            if let Some(&i) = seen.get(&moves) {
                let row: &mut Row = &mut result[i];
                row.degrees = row.degrees.min(route.degrees);
                row.budget = route.budget;
            } else {
                seen.insert(moves.clone(), result.len());
                result.push(Row {
                    before,
                    after,
                    moves,
                    sources,
                    degrees: route.degrees,
                    budget: route.budget,
                    motion: motion.map(|m| m.0),
                });
            }
        }
    }
    let result = Arc::new(RowBatch {
        scoring_indices: scoring_indices(&result),
        rows: result,
    });
    frame.orientation_cache.borrow_mut().insert(key, Arc::clone(&result));
    result
}
/// Equal 54/54 limits need no future double-turn classification. Each bank
/// becomes searchable as soon as its preceding eligible bank is linked.
pub fn release(t: &Tables, frames: &mut [Prepared]) -> usize {
    for index in 0..frames.len() {
        if !frames[index].ready {
            let (earlier, tail) = frames.split_at_mut(index);
            let current = &mut tail[0];
            let previous = current.previous.map(|j| &earlier[j]);
            if current.resolve_orientation {
                super::orientations::augment(current, previous);
            } else {
                current.rows = rows(t, current, previous);
                for index in scoring_indices(&current.rows) {
                    current
                        .scoring_rows
                        .entry(current.rows[index].before)
                        .or_default()
                        .push(index);
                }
            }
            current.ready = true;
        }
    }
    frames.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scoring_index_keeps_first_row_metadata_and_separates_contexts() {
        let first = Row {
            before: Some(0),
            after: 1,
            moves: Arc::new(vec!["R".into()]),
            sources: Arc::new((0..54).collect()),
            degrees: 90.,
            budget: 162.,
            motion: None,
        };
        let mut alias = first.clone();
        alias.moves = Arc::new(vec!["different spelling".into()]);
        alias.degrees = 180.;
        let mut other_parent = first.clone();
        other_parent.before = Some(2);
        let mut other_endpoint = first.clone();
        other_endpoint.after = 3;
        let rows = vec![first.clone(), alias, other_parent, other_endpoint];
        assert_eq!(scoring_indices(&rows), vec![0, 2, 3]);
        assert_eq!(rows[0], first);
        assert_eq!(rows.len(), 4, "Raw diagnostic rows must not be removed");
    }
}
