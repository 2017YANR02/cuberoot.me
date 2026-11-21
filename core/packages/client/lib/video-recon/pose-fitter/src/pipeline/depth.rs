use super::assignment::assign;
use super::*;

// Sparse recovery ranks the same proposals and preserves the existing camera
// solver. Give their observed image evidence more weight than pose priors and
// the per-active-layer model-selection penalty.
pub(super) const RECOVERY_REPROJECTION_WEIGHT: f64 = 4.;
fn outside(point: V2, poly: &[V2; 4]) -> f64 {
    let mut best = f64::INFINITY;
    let mut positive = true;
    let mut negative = true;
    for i in 0..4 {
        let a = poly[i];
        let b = poly[(i + 1) % 4];
        let e = [b[0] - a[0], b[1] - a[1]];
        let d = [point[0] - a[0], point[1] - a[1]];
        let cross = e[0] * d[1] - e[1] * d[0];
        positive &= cross >= -1e-6;
        negative &= cross <= 1e-6;
        let t =
            ((e[0] * d[0] + e[1] * d[1]) / (e[0] * e[0] + e[1] * e[1]).max(1e-12)).clamp(0., 1.);
        best = best.min(((d[0] - t * e[0]).powi(2) + (d[1] - t * e[1]).powi(2)).sqrt());
    }
    if positive || negative {
        0.
    } else {
        best
    }
}
pub(super) fn supported(g: &Geometry, frame: &Frame, c: &Camera, p: &Pose) -> bool {
    let (objects, classes) = startup::visible(g, p);
    let Some(projected) = opencv::project(&objects, c, p) else {
        return false;
    };
    let costs: Vec<_> = frame
        .observations
        .points
        .iter()
        .zip(&frame.observations.classes)
        .map(|(&point, &class)| {
            projected
                .iter()
                .zip(&classes)
                .map(|(&q, &id)| {
                    if class == id {
                        distance(point, q)
                    } else {
                        f64::INFINITY
                    }
                })
                .collect()
        })
        .collect();
    let (errors, matched) = assign(&costs, 18. * frame.pixel_scale);
    let inliers: Vec<_> = matched
        .iter()
        .filter(|&&(row, _)| errors[row] < 8. * frame.pixel_scale)
        .map(|&(_, col)| objects[col])
        .collect();
    if (inliers.len() as f64) < 5f64.max(0.55 * errors.len() as f64) {
        return false;
    }
    let surface = projection::surface(g, c, 0, [0.; 3], p.rvec, p.tvec);
    let polygons: Vec<_> = surface
        .face_polygons
        .iter()
        .zip(&surface.face_front)
        .filter_map(|(poly, &front)| {
            let area = 0.5
                * (0..4)
                    .map(|i| poly[i][0] * poly[(i + 1) % 4][1] - poly[i][1] * poly[(i + 1) % 4][0])
                    .sum::<f64>()
                    .abs();
            (front && area >= 1.).then_some(*poly)
        })
        .collect();
    let costs: Vec<_> = frame
        .observations
        .stickers
        .iter()
        .map(|&p| {
            polygons
                .iter()
                .map(|poly| {
                    let d = outside(p, poly);
                    if d == 0. {
                        let center = poly
                            .iter()
                            .fold([0.; 2], |a, p| [a[0] + p[0] / 4., a[1] + p[1] / 4.]);
                        1e-8 * distance(p, center)
                    } else {
                        d
                    }
                })
                .collect()
        })
        .collect();
    let (errors, _) = assign(&costs, 10. * frame.pixel_scale);
    let count = errors.iter().filter(|&&e| e < 1e-4).count();
    if (count as f64) < 4f64.max(0.75 * errors.len() as f64) {
        return false;
    }
    let mean = scale(
        inliers.iter().copied().fold([0.; 3], add),
        1. / inliers.len() as f64,
    );
    let matrix = DMatrix::from_fn(inliers.len(), 3, |i, j| inliers[i][j] - mean[j]);
    let s = matrix.svd(false, false).singular_values;
    s[2] >= 0.10 * s[0]
}
pub fn depth_targets(
    g: &Geometry,
    frames: &[Frame],
    poses: &[Option<Pose>],
    fps: f64,
) -> Vec<Option<f64>> {
    let mut anchors = vec![];
    for (i, p) in poses.iter().enumerate() {
        if let Some(p) = p {
            let w = work(&frames[i], p, None, vec![], vec![], false);
            if p.tvec[2] > g.cube_size && supported(g, &frames[i], &w.camera, p) {
                anchors.push(i)
            }
        }
    }
    targets_from_anchors(frames,poses,&anchors,fps)
}
pub fn targets_from_anchors(frames:&[Frame],poses:&[Option<Pose>],anchors:&[usize],fps:f64)->Vec<Option<f64>> {
    let times: Vec<_> = frames.iter().map(|f| f.frame as f64 / fps).collect();
    (0..frames.len())
        .map(|i| {
            let mut neighbors: Vec<_> = anchors
                .iter()
                .copied()
                .filter(|&j| j != i && (times[j] - times[i]).abs() <= 0.18)
                .collect();
            let value = if neighbors.len() >= 2
                && neighbors
                    .iter()
                    .map(|&j| (times[j] - times[i]).abs())
                    .fold(f64::INFINITY, f64::min)
                    <= 0.06
            {
                let mut nearest = neighbors.clone();
                nearest.sort_by(|&a, &b| {
                    (times[a] - times[i])
                        .abs()
                        .total_cmp(&(times[b] - times[i]).abs())
                });
                neighbors.retain(|&j| {
                    (times[j] - times[i]).abs() <= 0.055
                        || nearest[..2].contains(&j)
                        || nearest
                            .iter()
                            .find(|&&k| times[k] < times[i])
                            .is_some_and(|&k| k == j)
                        || nearest
                            .iter()
                            .find(|&&k| times[k] > times[i])
                            .is_some_and(|&k| k == j)
                });
                let elapsed: Vec<_> = neighbors.iter().map(|&j| times[j] - times[i]).collect();
                let bracket = elapsed.iter().any(|&e| e < 0.) && elapsed.iter().any(|&e| e > 0.);
                let depths: Vec<_> = neighbors
                    .iter()
                    .map(|&j| poses[j].as_ref().unwrap().tvec[2])
                    .collect();
                let mut sorted = depths.clone();
                sorted.sort_by(f64::total_cmp);
                let n = sorted.len();
                let median = (sorted[(n - 1) / 2] + sorted[n / 2]) / 2.;
                let proximity: Vec<_> = elapsed.iter().map(|&e| (-e.abs() / 0.08).exp()).collect();
                let mut weights = proximity.clone();
                let mut result = 0.;
                for _ in 0..4 {
                    let matrix =
                        DMatrix::from_fn(depths.len(), if bracket { 2 } else { 1 }, |i, j| {
                            weights[i].sqrt() * if j == 0 { 1. } else { elapsed[i] }
                        });
                    let y = DVector::from_iterator(
                        depths.len(),
                        depths.iter().zip(&weights).map(|(d, w)| d * w.sqrt()),
                    );
                    let line = matrix
                        .svd(true, true)
                        .solve(&y, f64::EPSILON * depths.len() as f64)
                        .unwrap();
                    result = line[0];
                    for k in 0..depths.len() {
                        let residual =
                            (depths[k] - line[0] - if bracket { elapsed[k] * line[1] } else { 0. })
                                .abs();
                        weights[k] = proximity[k] / (residual / (0.023 * median)).max(1.);
                    }
                }
                Some(result)
            } else {
                None
            };
            value.or_else(|| poses[i].as_ref().map(|p| p.tvec[2]))
        })
        .collect()
}

pub(super) fn depth_refine(
    g: &Geometry,
    w: &Workload,
    axis: usize,
    seed: [f64; 8],
    target: f64,
) -> [f64; 8] {
    let diameter = projection::cube_diameter(g, &w.camera, w.camera.rvec, w.camera.tvec);
    let sigmas = [
        0.6,
        0.6,
        0.6,
        3f64.max(0.025 * diameter),
        3f64.max(0.025 * diameter),
        6f64.max(0.012 * target),
    ];
    let uv = projection::project_uv(&w.camera, identity(), w.camera.tvec, [0.; 3]);
    let prior = [seed[0], seed[1], seed[2], uv[0], uv[1], target];
    let radii = [0.8, 0.8, 0.8, 40., 40., 100.];
    let mut lo: Vec<_> = (0..6).map(|i| seed[i] - radii[i]).collect();
    let mut hi: Vec<_> = (0..6).map(|i| seed[i] + radii[i]).collect();
    lo[5] = (g.cube_size + 1.).max(target - 4. * sigmas[5]);
    hi[5] = target + 4. * sigmas[5];
    let mut z: Vec<_> = (0..6)
        .map(|i| seed[i].clamp(lo[i] + 1e-8, hi[i] - 1e-8))
        .collect();
    for expansion in [1.5, 1.] {
        let evaluate = |z: &[f64]| {
            let mut x = seed;
            x[..6].copy_from_slice(z);
            let (values, jac) = projection::evaluate(g, w, axis, &x);
            let mut f = vec![];
            let mut rows: Vec<[f64; 6]> = vec![];
            for i in 0..values.len() / 2 {
                let a = values[2 * i];
                let b = values[2 * i + 1];
                let radius = (a * a + b * b).sqrt();
                let (cap, den) = if i < w.observations.points.len() {
                    (8. * expansion, 4.)
                } else {
                    (6. * expansion, 5.)
                };
                let clipped = radius.min(cap);
                let q = clipped / cap;
                let polynomial = (1. - q * q + q.powi(4) / 3.).sqrt();
                f.push(clipped * polynomial / den);
                let derivative = if radius < cap {
                    (1. - q * q).powi(2) / polynomial / den
                } else {
                    0.
                };
                rows.push(std::array::from_fn(|k| {
                    (a * jac[2 * i][k] + b * jac[2 * i + 1][k]) / radius.max(1e-12) * derivative
                }));
            }
            let (uv, j) = projection::project(
                &w.camera,
                rodrigues([x[0], x[1], x[2]]).0,
                rodrigues([x[0], x[1], x[2]]).1,
                [x[3], x[4], x[5]],
                [0.; 3],
            );
            let core = [x[0], x[1], x[2], uv[0], uv[1], x[5]];
            for k in 0..6 {
                f.push((core[k] - prior[k]) / sigmas[k]);
                let mut row = [0.; 6];
                if k < 3 || k == 5 {
                    row[k] = 1. / sigmas[k]
                } else {
                    for col in 0..6 {
                        row[col] = j[k - 3][col] / sigmas[k]
                    }
                }
                rows.push(row);
            }
            f.push(x[6] / 180.);
            f.push(x[7] / 180.);
            rows.extend([[0.; 6]; 2]);
            let matrix = DMatrix::from_fn(rows.len(), 6, |i, j| rows[i][j]);
            (f, matrix)
        };
        z = solver::bounded_lsq(
            &z,
            &lo,
            &hi,
            &[0.25, 0.25, 0.25, 8., 8., 25.],
            18,
            false,
            evaluate,
        )
        .0;
    }
    let mut x = seed;
    x[..6].copy_from_slice(&z);
    x
}
pub fn recover(
    g: &Geometry,
    frame: &Frame,
    source: &Pose,
    bank: Vec<Fit>,
    target: f64,
) -> (Vec<Fit>, bool) {
    if bank.is_empty() {
        return (bank, false);
    }
    let base = pose(&bank[0]);
    let mut source = source.clone();
    source.rvec = matrix_rvec(search::align(g, source.rvec, rodrigues(base.rvec).0));
    let mut w = work(frame, &source, None, vec![], vec![], false);
    let uv = projection::project_uv(&w.camera, identity(), source.tvec, [0.; 3]);
    let translation = scale(projection::undistort(&w.camera, uv), target);
    let radius = norm(g.corners[0]);
    let diameter = projection::cube_diameter(g, &w.camera, source.rvec, source.tvec);
    let margin = 16. * (diameter / 220.).max(0.3) * target / w.camera.k[0][0].min(w.camera.k[1][1])
        + radius * 3. * 6f64.max(0.012 * target) / target;
    let mut points = vec![];
    let mut classes = vec![];
    for (&p, &c) in w.observations.points.iter().zip(&w.observations.classes) {
        let ray = projection::undistort(&w.camera, p);
        let ray = scale(ray, 1. / norm(ray));
        let distance = norm(sub(translation, scale(ray, dot(ray, translation))));
        if distance <= radius + margin {
            points.push(p);
            classes.push(c)
        }
    }
    let outliers = w.observations.points.len() - points.len();
    let sigma = 6f64.max(0.012 * target);
    if frame.observations.points.len() >= 12
        || frame.observations.stickers.len() >= 10
        || ((base.tvec[2] - target).abs() <= 3. * sigma && outliers < 2)
        || points.len() < 3
    {
        return (bank, false);
    }
    w.observations.points = points;
    w.observations.classes = classes;
    let origin = [
        source.rvec[0],
        source.rvec[1],
        source.rvec[2],
        source.tvec[0],
        source.tvec[1],
        source.tvec[2],
        0.,
        0.,
    ];
    let mut seeds = vec![(0, origin, "source_rigid")];
    seeds.extend(bank.iter().map(|f| (f.axis, f.params, "baseline")));
    let mut fits = vec![];
    for (axis, seed, _provenance) in seeds {
        let revised = depth_refine(g, &w, axis, seed, target);
        for (x, refined) in [(seed, false), (revised, true)] {
            if let Some(mut f) = search::materialize(g, &w, axis, x) {
                let (values, _) = projection::evaluate(g, &w, axis, &f.params);
                let mut cost = 0.;
                for i in 0..values.len() / 2 {
                    let radius = (values[2 * i].powi(2) + values[2 * i + 1].powi(2)).sqrt();
                    let (cap, den) = if i < w.observations.points.len() {
                        (8., 4.)
                    } else {
                        (6., 5.)
                    };
                    let clipped = radius.min(cap);
                    let q = clipped / cap;
                    cost += (clipped * (1. - q * q + q.powi(4) / 3.).sqrt() / den).powi(2);
                }
                let core = projection::project_uv(
                    &w.camera,
                    identity(),
                    [f.params[3], f.params[4], f.params[5]],
                    [0.; 3],
                );
                let image_sigma = 3f64.max(0.025 * diameter);
                let rotation = matrix_rvec(mm(
                    rodrigues([f.params[0], f.params[1], f.params[2]]).0,
                    transpose(rodrigues(source.rvec).0),
                ));
                let pose_prior_loss = ((f.params[5] - target) / sigma).powi(2)
                    + ((core[0] - uv[0]) / image_sigma).powi(2)
                    + ((core[1] - uv[1]) / image_sigma).powi(2)
                    + norm(rotation).powi(2) / 0.36;
                let active = f.angles.iter().filter(|&&a| a.abs() >= 0.5).count();
                let components = crate::RecoveryScoreComponents {
                    observation_loss: cost,
                    pose_prior_loss,
                    active_layers: active,
                    observation_count: values.len() / 2,
                    reprojection_weight: RECOVERY_REPROJECTION_WEIGHT,
                };
                f.score = components.cost();
                f.recovery_score_components = Some(components);
                let _ = refined;
                fits.push(f);
            }
        }
    }
    let selected = search::assignment_bank(g, fits, 5);
    if selected.is_empty() {
        (bank, false)
    } else {
        (selected, true)
    }
}
