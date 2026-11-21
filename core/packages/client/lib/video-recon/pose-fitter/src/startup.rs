//! Faithful counterpart of sticker_keypoint_matches_for_colors and
//! best_sticker_pnp_candidates. Current-frame measurements generate cameras;
//! no previous fitted camera is substituted for this stage.
use crate::{math::*, opencv, projection, Camera, Geometry, Observations, Pose};
use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize)]
pub struct Input {
    pub width: f64,
    pub height: f64,
    pub observations: Observations,
    #[serde(default)]
    pub landmark_presence: Vec<f64>,
}
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Match {
    pub sticker_index: usize,
    pub indices: Vec<usize>,
    pub sticker_type: usize,
    pub center_error: f64,
    pub mean_presence: f64,
    pub sequences: Vec<Vec<usize>>,
}
#[derive(Clone, Serialize)]
pub struct Candidate {
    pub pose: Pose,
    pub visual_score: f64,
    pub overall_score: f64,
    pub anchor_error: f64,
    pub mean_presence: f64,
    pub sticker_type: usize,
    pub anchor_indices: Vec<usize>,
    pub sequence: Vec<usize>,
}
/// Compact current-frame hypotheses for ordered startup selection. These carry
/// existing PnP results; selecting a root never runs another fit or solver.
#[derive(Clone, Serialize, Deserialize)]
pub struct Seed {
    pub pose: Pose,
    pub visual_score: f64,
    pub fit_metric: f64,
    pub core_uv: V2,
    pub diameter: f64,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct FinalizedCore {
    pub frame: usize,
    pub core: V2,
}

/// A lagged reference needs a conservative allowance for normal screen-plane
/// motion. Two unflagged finalized cores establish it; one alone is insufficient.
pub fn selection_context(history: &[FinalizedCore], frame: usize) -> (Option<V2>, f64) {
    if history.len() < 2 {
        return (None, 0.);
    }
    let a = &history[history.len() - 2];
    let b = &history[history.len() - 1];
    if a.frame >= b.frame || b.frame >= frame {
        return (None, 0.);
    }
    let allowance =
        distance(a.core, b.core) / (b.frame - a.frame) as f64 * (frame - b.frame) as f64;
    (Some(b.core), allowance)
}

pub fn projected_core(camera: &Camera, pose: &Pose) -> V2 {
    let core = mv(camera.k, pose.tvec);
    [core[0] / core[2], core[1] / core[2]]
}

pub fn seeds(g: &Geometry, input: &Input) -> Vec<Seed> {
    let camera = camera(input);
    prepare(g, input)
        .candidates
        .into_iter()
        .map(|c| {
            let diameter = projection::cube_diameter(g, &camera, c.pose.rvec, c.pose.tvec);
            Seed {
                fit_metric: c.visual_score - 0.25 * c.anchor_error / diameter,
                core_uv: projected_core(&camera, &c.pose),
                diameter,
                pose: c.pose,
                visual_score: c.visual_score,
            }
        })
        .collect()
}

/// The accepted 25% rule: change the visual winner only when its projected core
/// jumps >25% of its cube diameter and the closest eligible root more than halves
/// that 2D jump. The caller supplies the last eligible finalized, unflagged
/// pose's projected core. No 3D translation enters the comparison.
pub fn select_seed(seeds: &[Seed], previous_core: Option<V2>) -> Option<&Seed> {
    select_seed_with_allowance(seeds, previous_core, 0.)
}
pub fn select_seed_with_allowance(
    seeds: &[Seed],
    previous_core: Option<V2>,
    motion_allowance: f64,
) -> Option<&Seed> {
    let finite: Vec<_> = seeds.iter().filter(|s| s.fit_metric.is_finite()).collect();
    let qualified: Vec<_> = finite
        .iter()
        .copied()
        .filter(|s| s.fit_metric <= 0.1)
        .collect();
    let pool = if qualified.is_empty() {
        &finite
    } else {
        &qualified
    };
    let visual = pool.iter().copied().reduce(|best, s| {
        if s.visual_score.total_cmp(&best.visual_score).is_lt() {
            s
        } else {
            best
        }
    })?;
    let Some(previous) = previous_core else {
        return Some(visual);
    };
    let closest = pool
        .iter()
        .copied()
        .reduce(|best, s| {
            if distance(s.core_uv, previous)
                .total_cmp(&distance(best.core_uv, previous))
                .then(s.visual_score.total_cmp(&best.visual_score))
                .is_lt()
            {
                s
            } else {
                best
            }
        })
        .unwrap();
    let visual_jump = distance(visual.core_uv, previous);
    if visual_jump > 0.25 * visual.diameter + motion_allowance
        && distance(closest.core_uv, previous) < 0.5 * visual_jump
    {
        Some(closest)
    } else {
        Some(visual)
    }
}
#[derive(Serialize)]
pub struct Output {
    pub matches: Vec<Match>,
    pub candidates: Vec<Candidate>,
}
const PROFILES: [[i32; 4]; 3] = [[0, 1, 2, 1], [1, 1, 2, 2], [2, 2, 2, 2]];
const COORDS: [[[usize; 2]; 4]; 3] = [
    [[0, 0], [1, 0], [1, 1], [0, 1]],
    [[1, 0], [2, 0], [2, 1], [1, 1]],
    [[1, 1], [2, 1], [2, 2], [1, 2]],
];
fn cmp_match(a: &Match, b: &Match) -> std::cmp::Ordering {
    a.center_error
        .total_cmp(&b.center_error)
        .then(b.indices.len().cmp(&a.indices.len()))
        .then(b.mean_presence.total_cmp(&a.mean_presence))
        .then(a.sticker_index.cmp(&b.sticker_index))
}
fn cross(a: V2, b: V2) -> f64 {
    a[0] * b[1] - a[1] * b[0]
}
fn sub2(a: V2, b: V2) -> V2 {
    [a[0] - b[0], a[1] - b[1]]
}
fn f32point(p: V2) -> V2 {
    [p[0] as f32 as f64, p[1] as f32 as f64]
}
fn contains(poly: &[V2], p: V2) -> bool {
    let p = f32point(p);
    let c: Vec<_> = (0..poly.len())
        .map(|i| {
            let a = f32point(poly[i]);
            let b = f32point(poly[(i + 1) % poly.len()]);
            cross(sub2(b, a), sub2(p, a))
        })
        .collect();
    c.iter().all(|&c| c >= 0.) || c.iter().all(|&c| c <= 0.)
}
fn convex(poly: &[V2]) -> bool {
    let p: Vec<_> = poly.iter().copied().map(f32point).collect();
    let crosses: Vec<_> = (0..p.len())
        .map(|i| {
            cross(
                sub2(p[(i + 1) % p.len()], p[i]),
                sub2(p[(i + 2) % p.len()], p[(i + 1) % p.len()]),
            )
        })
        .collect();
    let area: f64 = (0..p.len())
        .map(|i| cross(p[i], p[(i + 1) % p.len()]))
        .sum();
    area.abs() > 0.000002 && (crosses.iter().all(|&v| v > 0.) || crosses.iter().all(|&v| v < 0.))
}
fn combinations(values: &[usize], count: usize) -> Vec<Vec<usize>> {
    fn walk(
        v: &[usize],
        left: usize,
        offset: usize,
        chosen: &mut Vec<usize>,
        out: &mut Vec<Vec<usize>>,
    ) {
        if left == 0 {
            out.push(chosen.clone());
            return;
        }
        for i in offset..v.len().saturating_sub(left - 1) {
            chosen.push(v[i]);
            walk(v, left - 1, i + 1, chosen, out);
            chosen.pop();
        }
    }
    let mut out = vec![];
    if values.len() >= count {
        walk(values, count, 0, &mut vec![], &mut out)
    }
    out
}
fn sequences(typ: usize, classes: &[i32]) -> Vec<Vec<usize>> {
    let mut out = vec![];
    for start in 0..4 {
        let cyclic: Vec<_> = (0..4).map(|i| (start + i) % 4).collect();
        for omit in 0..if classes.len() == 3 { 4 } else { 1 } {
            let s: Vec<_> = cyclic
                .iter()
                .enumerate()
                .filter(|(i, _)| classes.len() == 4 || *i != omit)
                .map(|(_, i)| *i)
                .collect();
            if s.iter().zip(classes).all(|(&i, &c)| PROFILES[typ][i] == c) && !out.contains(&s) {
                out.push(s)
            }
        }
    }
    out
}
fn valid_profile(classes: &[i32]) -> bool {
    let mut c = classes.to_vec();
    c.sort();
    if c.len() == 4 {
        return c == [0, 1, 1, 2] || c == [1, 1, 2, 2] || c == [2, 2, 2, 2];
    }
    c.len() == 3
        && ((c.iter().filter(|&&v| v == 0).count() == 1
            && c.contains(&1)
            && c.iter().filter(|&&v| v == 2).count() <= 1)
            || (!c.contains(&0) && c.contains(&1) && c.contains(&2))
            || c == [2, 2, 2])
}
fn align_group(input: &Input, mut ids: Vec<usize>, sticker: usize) -> Vec<Match> {
    let obs = &input.observations;
    let center = obs.stickers[sticker];
    let centroid = ids.iter().fold([0.; 2], |a, &i| {
        [
            a[0] + obs.points[i][0] / ids.len() as f64,
            a[1] + obs.points[i][1] / ids.len() as f64,
        ]
    });
    ids.sort_by(|&a, &b| {
        let p = sub2(obs.points[a], centroid);
        let q = sub2(obs.points[b], centroid);
        p[1].atan2(p[0]).total_cmp(&q[1].atan2(q[0]))
    });
    let points: Vec<_> = ids.iter().map(|&i| obs.points[i]).collect();
    if !convex(&points) {
        return vec![];
    }
    let classes: Vec<_> = ids.iter().map(|&i| obs.classes[i]).collect();
    let mean_presence = ids
        .iter()
        .map(|&i| input.landmark_presence.get(i).copied().unwrap_or(1.))
        .sum::<f64>()
        / ids.len() as f64;
    let mut matches = vec![];
    for typ in 0..3 {
        let mut completions: Vec<(Option<(usize, usize)>, Vec<Vec<usize>>)> = vec![];
        for seq in sequences(typ, &classes) {
            let opposite = if ids.len() == 3 {
                (0..3)
                    .flat_map(|i| (i + 1..3).map(move |j| (i, j)))
                    .find(|&(i, j)| (seq[i] + 4 - seq[j]) % 4 == 2)
            } else {
                None
            };
            if let Some((_, s)) = completions.iter_mut().find(|(k, _)| *k == opposite) {
                s.push(seq)
            } else {
                completions.push((opposite, vec![seq]))
            }
        }
        for (opposite, seqs) in completions {
            let quad = if let Some((i, j)) = opposite {
                let other = 3 - i - j;
                let inferred = [
                    points[i][0] + points[j][0] - points[other][0],
                    points[i][1] + points[j][1] - points[other][1],
                ];
                let mut quad = vec![inferred; 4];
                for (n, &id) in seqs[0].iter().enumerate() {
                    quad[id] = points[n]
                }
                quad
            } else {
                points.clone()
            };
            if !contains(&quad, center)
                || obs
                    .stickers
                    .iter()
                    .enumerate()
                    .any(|(i, &p)| i != sticker && contains(&quad, p))
            {
                continue;
            }
            let error = ((0..2)
                .map(|i| {
                    let mid = [
                        (quad[i][0] + quad[i + 2][0]) / 2.,
                        (quad[i][1] + quad[i + 2][1]) / 2.,
                    ];
                    distance(mid, center).powi(2)
                })
                .sum::<f64>()
                / 2.)
                .sqrt();
            matches.push(Match {
                sticker_index: sticker,
                indices: ids.clone(),
                sticker_type: typ,
                center_error: error,
                mean_presence,
                sequences: seqs,
            });
        }
    }
    let best = matches
        .iter()
        .map(|m| m.center_error)
        .fold(f64::INFINITY, f64::min);
    matches.retain(|m| (m.center_error - best).abs() <= 1e-9);
    matches
}
pub fn matches(input: &Input) -> Vec<Match> {
    let obs = &input.observations;
    let mut matches: Vec<Match> = vec![];
    for (sticker, &center) in obs.stickers.iter().enumerate() {
        let mut blocked = vec![vec![false; obs.points.len()]; obs.points.len()];
        for i in 0..obs.points.len() {
            for j in i + 1..obs.points.len() {
                let a = sub2(obs.points[i], center);
                let b = sub2(obs.points[j], center);
                if cross(a, b).abs() <= 1e-6 {
                    continue;
                }
                let invalid = obs.stickers.iter().enumerate().any(|(k, &p)| {
                    if k == sticker {
                        return false;
                    }
                    let q = sub2(p, center);
                    let sides = [
                        cross(a, q),
                        cross(sub2(b, a), sub2(q, a)),
                        cross([-b[0], -b[1]], sub2(q, b)),
                    ];
                    sides.iter().all(|&v| v >= 0.) || sides.iter().all(|&v| v <= 0.)
                });
                blocked[i][j] = invalid;
                blocked[j][i] = invalid;
            }
        }
        let mut nearest: Vec<_> = (0..obs.points.len())
            .filter(|&i| {
                (0..3).contains(&obs.classes[i]) && obs.points[i].iter().all(|v| v.is_finite())
            })
            .collect();
        nearest.sort_by(|&a, &b| {
            distance(obs.points[a], center).total_cmp(&distance(obs.points[b], center))
        });
        for count in [4, 3] {
            for size in count..=nearest.len() {
                let last = nearest[size - 1];
                let compatible: Vec<_> = nearest[..size - 1]
                    .iter()
                    .copied()
                    .filter(|&i| !blocked[i][last])
                    .collect();
                let mut best: Option<(f64, Vec<Match>)> = None;
                for mut ids in combinations(&compatible, count - 1) {
                    if (0..ids.len()).any(|i| (i + 1..ids.len()).any(|j| blocked[ids[i]][ids[j]])) {
                        continue;
                    }
                    ids.push(last);
                    if !valid_profile(&ids.iter().map(|&i| obs.classes[i]).collect::<Vec<_>>()) {
                        continue;
                    }
                    let group = align_group(input, ids.clone(), sticker);
                    if group.is_empty() {
                        continue;
                    }
                    let total = ids
                        .iter()
                        .map(|&i| distance(obs.points[i], center))
                        .sum::<f64>();
                    if best.as_ref().is_none_or(|(d, g)| {
                        total.total_cmp(d).then(cmp_match(&group[0], &g[0])).is_lt()
                    }) {
                        best = Some((total, group))
                    }
                }
                if let Some((_, group)) = best {
                    for m in group {
                        let mut key = m.indices.clone();
                        key.sort();
                        if let Some(old) = matches.iter_mut().find(|old| {
                            let mut k = old.indices.clone();
                            k.sort();
                            k == key && old.sticker_type == m.sticker_type
                        }) {
                            if cmp_match(&m, old).is_lt() {
                                *old = m
                            }
                        } else {
                            matches.push(m)
                        }
                    }
                    break;
                }
            }
        }
    }
    matches.sort_by(cmp_match);
    matches
}

pub fn camera(input: &Input) -> Camera {
    let f = input.width.max(input.height) * 1.2;
    Camera {
        rvec: [0.; 3],
        tvec: [0.; 3],
        k: [
            [f, 0., input.width / 2.],
            [0., f, input.height / 2.],
            [0., 0., 1.],
        ],
        dist: vec![0.; 4],
    }
}
pub fn canonical(g: &Geometry, typ: usize) -> [V3; 4] {
    std::array::from_fn(|i| {
        let p = COORDS[typ][i];
        [
            ((p[0] as f64 - 1.5) * g.cube_size / 3.) as f32 as f64,
            ((p[1] as f64 - 1.5) * g.cube_size / 3.) as f32 as f64,
            (-g.cube_size / 2.) as f32 as f64,
        ]
    })
}
fn percentile(values: &[f64], q: f64) -> f64 {
    let mut v = values.to_vec();
    v.sort_by(f64::total_cmp);
    let x = (v.len() - 1) as f64 * q;
    let i = x.floor() as usize;
    v[i] + (v[x.ceil() as usize] - v[i]) * (x - i as f64)
}
fn huber(d: f64) -> f64 {
    if d <= 4. {
        0.5 * d * d
    } else {
        4. * (d - 2.)
    }
}
pub(crate) fn visible(g: &Geometry, pose: &Pose) -> (Vec<V3>, Vec<i32>) {
    let origin = scale(mv(transpose(rodrigues(pose.rvec).0), pose.tvec), -1.);
    let h = g.cube_size / 2.;
    let mut objects = vec![];
    let mut classes = vec![];
    for x in 0..4 {
        for y in 0..4 {
            for z in 0..4 {
                let coords = [x, y, z];
                let boundary = coords.iter().filter(|&&v| v == 0 || v == 3).count();
                if boundary == 0 {
                    continue;
                }
                let p: V3 = std::array::from_fn(|i| {
                    ((coords[i] as f64 - 1.5) * g.cube_size / 3.) as f32 as f64
                });
                let facing = (0..3).any(|i| {
                    (coords[i] == 0 && origin[i] < p[i]) || (coords[i] == 3 && origin[i] > p[i])
                });
                if !facing {
                    continue;
                }
                let ray = sub(p, origin);
                let mut enter = 0f64;
                let mut exit = 1f64;
                let mut inside = true;
                for i in 0..3 {
                    if ray[i].abs() <= 1e-12 && (origin[i] < -h || origin[i] > h) {
                        inside = false
                    }
                    let safe = if ray[i].abs() <= 1e-12 { 1. } else { ray[i] };
                    let a = (-h - origin[i]) / safe;
                    let b = (h - origin[i]) / safe;
                    enter = enter.max(a.min(b));
                    exit = exit.min(a.max(b));
                }
                if inside && enter <= exit && norm(ray) > 1e-9 && enter > 1e-5 && enter < 1. - 1e-4
                {
                    continue;
                }
                objects.push(p);
                classes.push(3 - boundary as i32);
            }
        }
    }
    (objects, classes)
}
fn rank(
    g: &Geometry,
    input: &Input,
    c: &Camera,
    m: &Match,
    seq: &[usize],
    pose: Pose,
) -> Option<Candidate> {
    if pose.tvec[2] <= 0. || !pose.rvec.iter().chain(&pose.tvec).all(|v| v.is_finite()) {
        return None;
    }
    let rotation = rodrigues(pose.rvec).0;
    let normal = mv(rotation, [0., 0., -1.]);
    let canon = canonical(g, m.sticker_type);
    let anchors: Vec<_> = seq.iter().map(|&i| canon[i]).collect();
    let center = anchors.iter().copied().fold([0.; 3], add);
    let center = add(
        mv(rotation, scale(center, 1. / anchors.len() as f64)),
        pose.tvec,
    );
    if dot(normal, scale(center, -1.)) <= 0.
        || anchors
            .iter()
            .any(|&p| add(mv(rotation, p), pose.tvec)[2] <= 0.)
    {
        return None;
    }
    let (objects, classes) = visible(g, &pose);
    if objects.is_empty() {
        return None;
    }
    let pixels = opencv::project(&objects, c, &pose)?;
    let points: Vec<_> = input
        .observations
        .points
        .iter()
        .copied()
        .map(f32point)
        .collect();
    let mut assigned_objects = vec![[0.; 3]; points.len()];
    let mut projected = vec![[0.; 2]; points.len()];
    let mut fixed_cols = vec![];
    for (&row, &object) in m.indices.iter().zip(&anchors) {
        let col = (0..objects.len()).min_by(|&a, &b| {
            norm(sub(object, objects[a])).total_cmp(&norm(sub(object, objects[b])))
        })?;
        if norm(sub(object, objects[col])) > 1e-4 || fixed_cols.contains(&col) {
            return None;
        }
        fixed_cols.push(col);
        assigned_objects[row] = objects[col];
        projected[row] = pixels[col];
    }
    for i in 0..points.len() {
        if m.indices.contains(&i) {
            continue;
        }
        let col = (0..objects.len())
            .filter(|j| {
                !fixed_cols.contains(j)
                    && (input.observations.classes[i] < 0
                        || classes[*j] == input.observations.classes[i])
            })
            .min_by(|&a, &b| {
                distance(points[i], pixels[a]).total_cmp(&distance(points[i], pixels[b]))
            })?;
        assigned_objects[i] = objects[col];
        projected[i] = pixels[col];
    }
    let errors: Vec<_> = points
        .iter()
        .zip(&projected)
        .map(|(&a, &b)| distance(a, b))
        .collect();
    let anchor_pixels: Vec<_> = m.indices.iter().map(|&i| points[i]).collect();
    let pivot = opencv::roots(4, &anchors, &anchor_pixels, c, Some(&pose))
        .pop()
        .filter(|p| p.tvec[2] > 0. && p.rvec.iter().chain(&p.tvec).all(|x| x.is_finite()));
    let nonlinear = pivot.and_then(|pivot| {
        let projected = opencv::project(&assigned_objects, c, &pivot)?;
        let errors = points
            .iter()
            .zip(&projected)
            .map(|(&a, &b)| distance(a, b))
            .collect::<Vec<_>>();
        let correction = norm(matrix_rvec(mm(
            rodrigues(pivot.rvec).0,
            transpose(rotation),
        ))) / 0.1
            + norm(sub(pivot.tvec, pose.tvec)) / 20.;
        Some((errors, correction))
    });
    let (pivot_errors, correction) = nonlinear.unwrap_or_else(|| {
        // The CPU retains this anchor-only robust linear correction if LM
        // fails. Free observations never participate in estimating the pivot.
        use nalgebra::{DMatrix, DVector};
        let jac: Vec<_> = assigned_objects
            .iter()
            .map(|&o| projection::project(c, rotation, rodrigues(pose.rvec).1, pose.tvec, o).1)
            .collect();
        let residual: Vec<_> = points
            .iter()
            .zip(&projected)
            .map(|(&a, &b)| [a[0] - b[0], a[1] - b[1]])
            .collect();
        let mut delta = DVector::zeros(6);
        for _ in 0..3 {
            let weights: Vec<_> = m
                .indices
                .iter()
                .map(|&row| {
                    let e: [f64; 2] = std::array::from_fn(|k| {
                        residual[row][k] - (0..6).map(|j| jac[row][k][j] * delta[j]).sum::<f64>()
                    });
                    (4. / (e[0] * e[0] + e[1] * e[1]).sqrt().max(1e-6))
                        .min(1.)
                        .sqrt()
                })
                .collect();
            let a = DMatrix::from_fn(m.indices.len() * 2, 6, |i, j| {
                jac[m.indices[i / 2]][i % 2][j] * weights[i / 2]
            });
            let b = DVector::from_iterator(
                m.indices.len() * 2,
                (0..m.indices.len() * 2)
                    .map(|i| residual[m.indices[i / 2]][i % 2] * weights[i / 2]),
            );
            let svd = a.svd(true, true);
            let tolerance =
                f64::EPSILON * (m.indices.len() * 2).max(6) as f64 * svd.singular_values[0];
            delta = svd
                .solve(&b, tolerance)
                .expect("Finite pivot least squares");
        }
        let errors = (0..points.len())
            .map(|row| {
                let e: [f64; 2] = std::array::from_fn(|k| {
                    residual[row][k] - (0..6).map(|j| jac[row][k][j] * delta[j]).sum::<f64>()
                });
                (e[0] * e[0] + e[1] * e[1]).sqrt()
            })
            .collect();
        (
            errors,
            norm([delta[0], delta[1], delta[2]]) / 0.1 + norm([delta[3], delta[4], delta[5]]) / 20.,
        )
    });
    let consistency = pivot_errors.iter().map(|&v| huber(v)).sum::<f64>() / points.len() as f64
        + 0.4 * percentile(&pivot_errors, 0.9)
        + 0.2 * percentile(&pivot_errors, 0.95)
        + 0.05 * pivot_errors.iter().copied().fold(0., f64::max)
        + (correction - 1.).max(0.) * 8.;
    let overall = errors.iter().map(|&v| huber(v)).sum::<f64>() / points.len() as f64
        + 0.25 * percentile(&errors, 0.9)
        + 1.5 * consistency;
    // cv2.projectPoints and the measured sticker anchors are float32 here;
    // NumPy performs this particular norm/mean in float32 as well.
    let anchor_error = (m
        .indices
        .iter()
        .map(|&i| {
            let a = projected[i][0] as f32 - points[i][0] as f32;
            let b = projected[i][1] as f32 - points[i][1] as f32;
            (a * a + b * b).sqrt()
        })
        .sum::<f32>()
        / m.indices.len() as f32) as f64;
    let d = projection::cube_diameter(g, c, pose.rvec, pose.tvec);
    let normalized: Vec<_> = errors.iter().map(|&v| v / d).collect();
    let visual = percentile(&normalized, 0.5)
        + 0.5 * percentile(&normalized, 0.9)
        + 0.25 * (anchor_error / d);
    Some(Candidate {
        pose,
        visual_score: visual,
        overall_score: overall,
        anchor_error,
        mean_presence: m.mean_presence,
        sticker_type: m.sticker_type,
        anchor_indices: m.indices.clone(),
        sequence: seq.to_vec(),
    })
}
pub fn prepare(g: &Geometry, input: &Input) -> Output {
    let matches = matches(input);
    let c = camera(input);
    let mut groups: Vec<Vec<&Match>> = vec![];
    for m in &matches {
        let mut key = m.indices.clone();
        key.sort();
        if let Some(group) = groups.iter_mut().find(|group| {
            let mut k = group[0].indices.clone();
            k.sort();
            k == key
        }) {
            group.push(m)
        } else {
            groups.push(vec![m])
        }
    }
    let mut candidates = vec![];
    let mut solved = 0;
    for group in groups {
        let before = candidates.len();
        for m in group {
            let canon = canonical(g, m.sticker_type);
            let pixels: Vec<_> = m
                .indices
                .iter()
                .map(|&i| f32point(input.observations.points[i]))
                .collect();
            let mut local = vec![];
            for seq in &m.sequences {
                let objects: Vec<_> = seq.iter().map(|&i| canon[i]).collect();
                let mut roots = vec![];
                for method in if seq.len() == 4 {
                    vec![0]
                } else {
                    vec![1, 2, 3]
                } {
                    for pose in opencv::roots(method, &objects, &pixels, &c, None) {
                        let r = rodrigues(pose.rvec).0;
                        if roots.iter().any(|old: &Pose| {
                            let diff = rodrigues(old.rvec)
                                .0
                                .iter()
                                .flatten()
                                .zip(r.iter().flatten())
                                .map(|(a, b)| (a - b).powi(2))
                                .sum::<f64>()
                                .sqrt();
                            diff <= 1e-5 && norm(sub(old.tvec, pose.tvec)) <= 1e-4
                        }) {
                            continue;
                        }
                        roots.push(pose)
                    }
                }
                for pose in roots {
                    if let Some(candidate) = rank(g, input, &c, m, seq, pose) {
                        local.push(candidate)
                    }
                }
            }
            local.sort_by(|a, b| {
                a.overall_score
                    .total_cmp(&b.overall_score)
                    .then(a.anchor_error.total_cmp(&b.anchor_error))
            });
            candidates.extend(local);
        }
        if candidates.len() > before {
            solved += 1
        }
        if solved == 3 {
            break;
        }
    }
    candidates.sort_by(|a, b| {
        a.visual_score
            .total_cmp(&b.visual_score)
            .then(b.mean_presence.total_cmp(&a.mean_presence))
    });
    Output {
        matches,
        candidates,
    }
}
