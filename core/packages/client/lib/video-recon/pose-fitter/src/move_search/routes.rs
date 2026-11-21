//! Mechanical port of independent_keypoint_rotation_budget.py.
use super::cube::{normalize, Group};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Shape {
    pub axis: Option<usize>,
    pub angles: [f64; 3],
}
impl Shape {
    pub fn new(axis: usize, angles: [f64; 3]) -> Self {
        Self {
            axis: angles.iter().any(|&a| a != 0.).then_some(axis),
            angles,
        }
    }
    pub fn flat() -> Self {
        Self {
            axis: None,
            angles: [0.; 3],
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Route {
    pub groups: Vec<Group>,
    pub degrees: f64,
    pub budget: f64,
}
fn relative(a: [f64; 3]) -> [f64; 2] {
    [a[0] - a[1], a[2] - a[1]]
}
/// Physical turn travel, independent of the common rigid orientation.
/// A middle turn changes both outer-to-middle angles in the same direction;
/// those are two measurements of one turn, not two separate turns. Opposing
/// outer turns still spend their combined travel. Rigid motion is gated
/// separately by the camera/material motion checks.
fn travel(delta: [f64; 2]) -> f64 {
    delta[0].max(delta[1]).max(0.) - delta[0].min(delta[1]).min(0.)
}
fn slice_travel(delta: [f64; 2]) -> f64 {
    // Common outer-to-middle motion is a slice in any rigid cube basis.
    // Wide turns have one zero component; opposing outer turns have no slice.
    if delta[0] * delta[1] > 0. {
        delta[0].abs().min(delta[1].abs())
    } else {
        0.
    }
}
fn offsets(start: [f64; 3], end: [f64; 3], budget: f64) -> Vec<[i32; 3]> {
    let a = relative(start);
    let b = relative(end);
    let mut result = vec![];
    let bounds = |i: usize| {
        (
            ((-budget - b[i] + a[i] - 1e-9) / 90.).ceil() as i32,
            ((budget - b[i] + a[i] + 1e-9) / 90.).floor() as i32,
        )
    };
    let (lo, hi) = bounds(0);
    let (lo2, hi2) = bounds(1);
    for neg in lo..=hi {
        for pos in lo2..=hi2 {
            for mid in -0.max(neg).max(pos)..=-0.min(neg).min(pos) {
                result.push([neg + mid, mid, pos + mid]);
            }
        }
    }
    result
}
fn cost(a: [f64; 3], b: [f64; 3]) -> f64 {
    let a = relative(a);
    let b = relative(b);
    (b[0] - a[0]).abs().max((b[1] - a[1]).abs())
}
fn boundary(s: &Shape, budget: f64, exiting: bool) -> Vec<(Vec<Group>, f64, [i32; 3])> {
    let Some(axis) = s.axis else {
        return vec![(vec![], 0., [0; 3])];
    };
    let (a, b) = if exiting {
        (s.angles, [0.; 3])
    } else {
        ([0.; 3], s.angles)
    };
    offsets(a, b, budget)
        .into_iter()
        .filter_map(|q| {
            let target =
                std::array::from_fn(|i| 90. * q[i] as f64 + if exiting { 0. } else { s.angles[i] });
            let distance = cost(if exiting { s.angles } else { [0.; 3] }, target);
            (distance <= budget + 1e-9)
                .then(|| (normalize(&[Group { axis, offsets: q }]), distance, q))
        })
        .collect()
}
fn hidden(count: usize) -> Arc<Vec<Vec<Group>>> {
    type Cache = Mutex<HashMap<usize, Arc<Vec<Vec<Group>>>>>;
    static CACHE: OnceLock<Cache> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    if let Some(value) = cache.lock().unwrap().get(&count) {
        return value.clone();
    }
    if count == 0 {
        return Arc::new(vec![vec![]]);
    }
    let mut result = std::collections::BTreeSet::new();
    let previous = hidden(count - 1);
    for axis in 0..3 {
        for layers in [&[0][..], &[1][..], &[2][..], &[0, 1][..], &[1, 2][..]] {
            for sign in [-1, 1] {
                let group = Group {
                    axis,
                    offsets: std::array::from_fn(|i| if layers.contains(&i) { sign } else { 0 }),
                };
                for prior in previous.iter() {
                    if prior.last().is_none_or(|g| g.axis != axis) {
                        let mut path = prior.clone();
                        path.push(group.clone());
                        result.insert(normalize(&path));
                    }
                }
            }
        }
    }
    let value = Arc::new(result.into_iter().collect());
    cache.lock().unwrap().insert(count, Arc::clone(&value));
    value
}
#[derive(Clone)]
struct Phase {
    axis: usize,
    delta: [f64; 2],
}
fn phase(axis: usize, start: [f64; 3], end: [f64; 3]) -> Phase {
    let a = relative(start);
    let b = relative(end);
    Phase {
        axis,
        delta: [b[0] - a[0], b[1] - a[1]],
    }
}
fn add(
    unique: &mut BTreeMap<Vec<Group>, (f64, Route)>,
    groups: Vec<Group>,
    phases: Vec<Phase>,
    budget: f64,
    double: f64,
    slice_budget: f64,
) {
    let mut merged: Vec<Phase> = vec![];
    for mut p in phases {
        if merged.last().is_some_and(|a| a.axis == p.axis) {
            let old = merged.pop().unwrap();
            for i in 0..2 {
                p.delta[i] += old.delta[i];
            }
        }
        merged.push(p);
    }
    let (mut degrees, mut fraction) = (0., 0.);
    for p in merged {
        degrees += travel(p.delta);
        let mut f: f64 = 0.;
        for i in 0..2 {
            let distance = p.delta[i].abs();
            let limit = budget;
            f = f.max(if limit > 0. {
                distance / limit
            } else if distance == 0. {
                0.
            } else {
                f64::INFINITY
            });
        }
        let slice = slice_travel(p.delta);
        f = f.max(if slice_budget > 0. { slice / slice_budget } else if slice == 0. { 0. } else { f64::INFINITY });
        fraction += f;
    }
    fraction = fraction.max(if double > 0. {
        degrees / double
    } else if degrees == 0. {
        0.
    } else {
        f64::INFINITY
    });
    if fraction <= 1. + 1e-9 {
        let groups = normalize(&groups);
        let route = Route {
            groups: groups.clone(),
            degrees,
            budget: if fraction > 0. {
                degrees / fraction
            } else {
                budget
            },
        };
        if unique.get(&groups).is_none_or(|(old, _)| fraction < *old) {
            unique.insert(groups, (fraction, route));
        }
    }
}
pub fn between(before: &Shape, after: &Shape, budget: f64) -> Vec<Route> {
    between_with_slice_limit(before, after, budget, budget)
}
pub fn between_with_slice_limit(before: &Shape, after: &Shape, budget: f64, slice_budget: f64) -> Vec<Route> {
    let double = budget;
    let mut unique = BTreeMap::new();
    if before.axis.is_none() || after.axis.is_none() || before.axis == after.axis {
        let axes = if before.axis.is_none() && after.axis.is_none() {
            vec![0, 1, 2]
        } else {
            vec![after.axis.or(before.axis).unwrap()]
        };
        for axis in axes {
            for q in offsets(before.angles, after.angles, double) {
                let end = std::array::from_fn(|i| after.angles[i] + 90. * q[i] as f64);
                add(
                    &mut unique,
                    vec![Group { axis, offsets: q }],
                    vec![phase(axis, before.angles, end)],
                    budget,
                    double,
                    slice_budget,
                );
            }
        }
    }
    for (exit, ec, eq) in boundary(before, double, true) {
        for (entry, ic, iq) in boundary(after, double, false) {
            if ec + ic > double + 1e-9 {
                continue;
            }
            let mut phases = vec![];
            if let Some(axis) = before.axis {
                phases.push(phase(axis, before.angles, eq.map(|q| 90. * q as f64)));
            }
            if let Some(axis) = after.axis {
                phases.push(phase(
                    axis,
                    [0.; 3],
                    std::array::from_fn(|i| after.angles[i] + 90. * iq[i] as f64),
                ));
            }
            let mut groups = exit.clone();
            groups.extend(entry.clone());
            add(&mut unique, groups, phases.clone(), budget, double, slice_budget);
            let limit = ((double - ec - ic + 1e-9) / 90.).floor().max(0.) as usize;
            for count in 1..=limit {
                if phases.is_empty() && count as f64 * 90. > budget + 1e-9 {
                    continue;
                }
                for middle in hidden(count).iter() {
                    let mut ps = vec![];
                    if before.axis.is_some() {
                        ps.push(phases[0].clone());
                    }
                    for g in middle {
                        ps.push(phase(g.axis, [0.; 3], g.offsets.map(|q| 90. * q as f64)));
                    }
                    if after.axis.is_some() {
                        ps.push(phases.last().unwrap().clone());
                    }
                    let mut gs = exit.clone();
                    gs.extend(middle.clone());
                    gs.extend(entry.clone());
                    add(&mut unique, gs, ps, budget, double, slice_budget);
                }
            }
        }
    }
    let mut result: Vec<_> = unique.into_values().map(|(_, r)| r).collect();
    result.sort_by(|a, b| {
        a.degrees
            .total_cmp(&b.degrees)
            .then(a.groups.cmp(&b.groups))
    });
    result
}
