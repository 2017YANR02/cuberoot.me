use crate::math::*;
use crate::projection::{self, Surface};
use crate::solver;
use crate::{Camera, Fit, Geometry, Metrics, Pose, RefinementTrace, Workload};
use std::cmp::Ordering;
use std::collections::HashSet;
fn percentile(values: &[f64], fraction: f64) -> f64 {
    if values.is_empty() {
        return f64::INFINITY;
    }
    let mut a = values.to_vec();
    a.sort_by(f64::total_cmp);
    let p = (a.len() - 1) as f64 * fraction;
    let lo = p.floor() as usize;
    let hi = p.ceil() as usize;
    if lo == hi {
        a[lo]
    } else {
        a[lo] + (a[hi] - a[lo]) * (p - lo as f64)
    }
}
fn inside(point: V2, poly: [V2; 4]) -> bool {
    let c: Vec<f64> = (0..4)
        .map(|i| {
            let j = (i + 1) % 4;
            (poly[j][0] - poly[i][0]) * (point[1] - poly[i][1])
                - (poly[j][1] - poly[i][1]) * (point[0] - poly[i][0])
        })
        .collect();
    c.iter().all(|&v| v >= -1e-4) || c.iter().all(|&v| v <= 1e-4)
}
fn metrics(
    g: &Geometry,
    w: &Workload,
    s: &Surface,
    axis: usize,
    angles: [f64; 3],
    diameter: f64,
    limit: f64,
    support_limit: f64,
    assign: bool,
) -> (Metrics, Vec<usize>, Vec<bool>, Vec<usize>) {
    let a = &g.axes[axis];
    let obs = &w.observations;
    let mut m = Metrics::default();
    let mut ds = vec![];
    let mut columns = vec![];
    for (i, &p) in obs.points.iter().enumerate() {
        let mut best = f64::INFINITY;
        let mut index = 0;
        for (j, &q) in s.points.iter().enumerate() {
            if s.point_visible[j]
                && (obs.classes[i] < 0 || a.classes[j] < 0 || obs.classes[i] == a.classes[j])
            {
                let d = distance(p, q);
                if d < best {
                    best = d;
                    index = j;
                }
            }
        }
        columns.push(index);
        if best.is_finite() {
            ds.push(best / diameter);
            if best <= limit {
                m.keypoint_inlier_count += 1;
                if angles[a.layers[index]] != 0. {
                    m.keypoint_layer_inlier_count += 1
                }
            }
            if best <= support_limit {
                m.layer_support[a.layers[index]] += 1;
            }
        }
    }
    m.keypoint_error = if ds.is_empty() {
        f64::INFINITY
    } else {
        ds.iter().sum::<f64>() / ds.len() as f64
    };
    m.p90_error = percentile(&ds, 0.9);
    m.robust_error = percentile(&ds, 0.5) + 0.5 * m.p90_error;
    let mut weighted = vec![];
    let mut penalty = 0.;
    let mut total = 0.;
    for (i, &p) in obs.stickers.iter().enumerate() {
        let u = if obs.uncertainties.len() == obs.stickers.len() {
            obs.uncertainties[i].max(1.)
        } else {
            1.
        };
        let weight = if u.is_finite() { 1. / (u * u) } else { 0. };
        let mut best = f64::INFINITY;
        let mut active_best = f64::INFINITY;
        let mut support = [false; 3];
        for (j, &q) in s.centers.iter().enumerate() {
            if s.face_visible[j] {
                let d = distance(p, q);
                best = best.min(d);
                if angles[a.face_layers[j]] != 0. {
                    active_best = active_best.min(d)
                }
                if d < support_limit {
                    support[a.face_layers[j]] = true;
                }
            }
        }
        for l in 0..3 {
            m.layer_support[l] += usize::from(support[l]);
        }
        if best.is_finite() && weight > 0. {
            let gate = limit / diameter;
            let tolerance = (0.02 + (u / diameter).min(0.01)).min(gate - 1e-9);
            let f = ((best / diameter - tolerance) / (gate - tolerance).max(1e-12)).clamp(0., 1.);
            penalty += weight * f * f * (3. - 2. * f);
            total += weight;
            weighted.push((best / diameter, weight));
            if best < limit {
                m.sticker_match_count += 1
            }
        }
        if active_best.is_finite() && active_best < limit {
            m.layer_inlier_count += 1;
        }
    }
    m.sticker_error = if total > 0. {
        g.sticker_scale * penalty / total.max(1e-12)
    } else {
        f64::INFINITY
    };
    weighted.sort_by(|a, b| a.0.total_cmp(&b.0));
    let quantile = |fraction: f64| {
        let target = fraction * total;
        let mut sum = 0.;
        for &(v, weight) in &weighted {
            sum += weight;
            if sum >= target {
                return v;
            }
        }
        f64::INFINITY
    };
    m.robust_error += quantile(0.5) + 0.5 * quantile(0.9);
    m.combined_mean_error = m.keypoint_error + m.sticker_error;
    m.inlier_count = m.keypoint_inlier_count + m.sticker_match_count;
    m.layer_inlier_count += m.keypoint_layer_inlier_count;
    let mut nearest = vec![];
    let mut valid = vec![];
    if assign {
        for &p in &obs.stickers {
            let ray = mv(transpose(s.rotation), projection::undistort(&w.camera, p));
            let depths: [f64; 3] = std::array::from_fn(|l| {
                projection::entry(g, s.origin, ray, s.matrices[l], axis, l)
            });
            let depth = depths.into_iter().fold(f64::INFINITY, f64::min);
            let mut best = f64::INFINITY;
            let mut index = 0;
            for j in 0..s.centers.len() {
                let d = depths[a.face_layers[j]];
                if d.is_finite()
                    && d <= depth + 1e-6
                    && s.face_front[j]
                    && inside(p, s.face_polygons[j])
                {
                    let distance = distance(p, s.centers[j]);
                    if distance < best {
                        best = distance;
                        index = j;
                    }
                }
            }
            nearest.push(index);
            valid.push(best.is_finite());
        }
    }
    (m, nearest, valid, columns)
}
pub(crate) fn cost(g: &Geometry, m: &Metrics) -> f64 {
    if !m.keypoint_error.is_finite() || !m.sticker_error.is_finite() {
        return f64::INFINITY;
    }
    0.5 * (m.keypoint_error / g.assignment_fraction).clamp(0., 1.)
        + 0.5 * (m.sticker_error / g.sticker_scale).clamp(0., 1.)
}
pub(crate) fn materialize(g: &Geometry, w: &Workload, axis: usize, mut x: [f64; 8]) -> Option<Fit> {
    let angles = [
        if x[6].abs() < 0.5 { 0. } else { x[6] },
        0.,
        if x[7].abs() < 0.5 { 0. } else { x[7] },
    ];
    x[6] = angles[0];
    x[7] = angles[2];
    let r = [x[0], x[1], x[2]];
    let t = [x[3], x[4], x[5]];
    let s = projection::surface(g, &w.camera, axis, angles, r, t);
    let d = projection::cube_diameter(g, &w.camera, r, t);
    let limit = g.assignment_fraction * d;
    let (m, nearest, valid, columns) = metrics(g, w, &s, axis, angles, d, limit, limit, true);
    let score = cost(g, &m);
    if !score.is_finite() {
        return None;
    }
    Some(Fit {
        axis,
        params: x,
        angles,
        score,
        recovery_score_components: None,
        source: "angle_sweep".into(),
        flat_fallback: false,
        metrics: m,
        nearest,
        valid,
        assignment_objects: columns.iter().map(|&i| s.objects[i]).collect(),
        assignment_projected: columns.iter().map(|&i| s.points[i]).collect(),
        assignment_classes: columns.iter().map(|&i| g.axes[axis].classes[i]).collect(),
    })
}
pub(crate) fn align(g: &Geometry, r: V3, reference: M3) -> M3 {
    let rot = rodrigues(r).0;
    let mut best = f64::NEG_INFINITY;
    let mut result = rot;
    for &sym in &g.symmetries {
        let candidate = mm(rot, sym);
        let score: f64 = (0..3).map(|i| dot(candidate[i], reference[i])).sum();
        if score > best {
            best = score;
            result = candidate
        }
    }
    result
}

fn core(c: &Camera, x: [f64; 8]) -> V3 {
    let t = [x[3], x[4], x[5]];
    let uv = projection::project_uv(c, identity(), t, [0.; 3]);
    [uv[0], uv[1], t[2]]
}
fn equivalent(g: &Geometry, c: &Camera, first: &Fit, second: &Fit) -> bool {
    let one = core(c, first.params);
    let two = core(c, second.params);
    if distance([one[0], one[1]], [two[0], two[1]]) > 3.
        || (one[2] - two[2]).abs() > 3f64.max(0.015 * one[2].min(two[2]))
    {
        return false;
    }
    let r1 = rodrigues([first.params[0], first.params[1], first.params[2]]).0;
    let r2 = rodrigues([second.params[0], second.params[1], second.params[2]]).0;
    let mut best = f64::NEG_INFINITY;
    let mut chosen = identity();
    let mut r2best = r2;
    for &sym in &g.symmetries {
        let alt = mm(r2, transpose(sym));
        let score: f64 = (0..3).map(|i| dot(alt[i], r1[i])).sum();
        if score > best {
            best = score;
            chosen = sym;
            r2best = alt;
        }
    }
    if norm(matrix_rvec(mm(r2best, transpose(r1)))).to_degrees() > 4. {
        return false;
    }
    let target = (0..3)
        .max_by_key(|&i| chosen[i][second.axis].abs() as i32)
        .unwrap();
    let sign = chosen[target][second.axis];
    let has = second.angles.iter().any(|&a| a != 0.);
    let first_has = first.angles.iter().any(|&a| a != 0.);
    if has && first_has && target != first.axis {
        return false;
    }
    let angles = if sign < 0. {
        [-second.angles[2], -second.angles[1], -second.angles[0]]
    } else {
        second.angles
    };
    for i in 0..3 {
        if (first.angles[i] != 0.) != (angles[i] != 0.) {
            return false;
        }
        if ((first.angles[i] - angles[i] + 45.).rem_euclid(90.) - 45.).abs() > 6. {
            return false;
        }
    }
    true
}
fn shortlist(g: &Geometry, c: &Camera, mut fits: Vec<Fit>, size: usize) -> Vec<Fit> {
    fits.retain(|f| f.score.is_finite());
    fits.sort_by(compare_fits);
    let mut ranked: Vec<Fit> = vec![];
    for f in fits {
        if ranked.len() >= size && f.score >= ranked[size - 1].score + 0.01 {
            break;
        }
        if !ranked.iter().any(|a| equivalent(g, c, a, &f)) {
            ranked.push(f)
        }
    }
    if ranked.is_empty() {
        return ranked;
    }
    let cutoff = ranked[(size.min(ranked.len())) - 1].score + 0.01;
    ranked.retain(|f| f.score < cutoff);
    ranked
}
fn compare_fits(a: &Fit, b: &Fit) -> Ordering {
    a.score
        .total_cmp(&b.score)
        .then(a.axis.cmp(&b.axis))
        .then_with(|| {
            for i in 0..3 {
                let cmp = a.angles[i].total_cmp(&b.angles[i]);
                if !cmp.is_eq() {
                    return cmp;
                }
            }
            std::cmp::Ordering::Equal
        })
}

// Observed sticker order is fixed. Invalid rows use None, never the arbitrary
// argmin index left behind when every projected face is ineligible.
pub(crate) fn assignment_key(
    g: &Geometry,
    fit: &Fit,
    reference: M3,
    permutations: &mut [Option<Vec<usize>>],
) -> Vec<Option<usize>> {
    let rotation = rodrigues([fit.params[0], fit.params[1], fit.params[2]]).0;
    let mut best = f64::NEG_INFINITY;
    let mut index = 0;
    for (i, &symmetry) in g.symmetries.iter().enumerate() {
        let alternative = mm(rotation, transpose(symmetry));
        let score: f64 = (0..3).map(|j| dot(alternative[j], reference[j])).sum();
        if score > best {
            best = score;
            index = i;
        }
    }
    let permutation = permutations[index].get_or_insert_with(|| {
        let centers: Vec<V3> = g
            .faces
            .iter()
            .map(|face| scale(face.iter().copied().fold([0.; 3], add), 0.25))
            .collect();
        centers
            .iter()
            .map(|&point| {
                let transformed = mv(g.symmetries[index], point);
                (0..centers.len())
                    .min_by(|&a, &b| {
                        norm(sub(transformed, centers[a]))
                            .total_cmp(&norm(sub(transformed, centers[b])))
                    })
                    .unwrap()
            })
            .collect()
    });
    assert_eq!(fit.nearest.len(), fit.valid.len());
    fit.nearest
        .iter()
        .zip(&fit.valid)
        .map(|(&face, &valid)| if valid { Some(permutation[face]) } else { None })
        .collect()
}

pub(crate) fn assignment_bank(g: &Geometry, mut fits: Vec<Fit>, size: usize) -> Vec<Fit> {
    fits.retain(|fit| fit.score.is_finite());
    for fit in &mut fits {
        fit.flat_fallback = false;
    }
    fits.sort_by(compare_fits);
    let Some(first) = fits.first() else {
        return vec![];
    };
    let reference = rodrigues([first.params[0], first.params[1], first.params[2]]).0;
    let flat = fits
        .iter()
        .find(|fit| fit.angles.iter().all(|&angle| angle == 0.))
        .cloned();
    let mut permutations = vec![None; g.symmetries.len()];
    let mut signatures = HashSet::new();
    let mut selected = vec![];
    for fit in fits {
        if signatures.insert(assignment_key(g, &fit, reference, &mut permutations)) {
            selected.push(fit);
            if selected.len() == size {
                break;
            }
        }
    }
    if let Some(mut flat) = flat {
        flat.flat_fallback = true;
        selected.push(flat);
    }
    selected
}
pub(crate) fn sweep(g: &Geometry, w: &Workload, camera: &Pose) -> Vec<Fit> {
    let arot = align(g, camera.rvec, rodrigues(w.camera.rvec).0);
    let rvec = matrix_rvec(arot);
    let mut c = w.camera.clone();
    c.rvec = rvec;
    c.tvec = camera.tvec;
    let base_d = projection::cube_diameter(g, &c, rvec, c.tvec);
    // Each neighboring camera gets its own gate, exactly as swept_geometries
    // constructs its temporary pose before the CPU batched sweep.
    let original_limit = g.assignment_fraction * base_d;
    let mut fits = vec![];
    for axis in 0..3 {
        let a = &g.axes[axis];
        let cached: Vec<Surface> = (-45..=45)
            .step_by(15)
            .map(|angle| projection::surface(g, &c, axis, [angle as f64; 3], rvec, c.tvec))
            .collect();
        let middle: Vec<(V3, f64)> = (-45..=45)
            .step_by(15)
            .map(|v| {
                let rv = matrix_rvec(mm(arot, axis_rotation(axis, v as f64)));
                let dia = projection::cube_diameter(g, &c, rv, c.tvec);
                (rv, dia)
            })
            .collect();
        // Diameter depends only on the middle angle, not the two outer angles.
        // Keep the round trip through rvec: using `arot` here changes rounding.
        let diameters: Vec<f64> = (-45..=45).step_by(15).map(|angle| {
            let rv = matrix_rvec(mm(rodrigues(rvec).0, axis_rotation(axis, angle as f64)));
            projection::cube_diameter(g, &c, rv, c.tvec)
        }).collect();
        // A point's occlusion by one layer depends only on its own angle and
        // that layer's angle. Cache those pairs instead of intersecting the
        // same ray for every one of the 7^3 angle combinations.
        let visibility = |count: usize, face: bool| -> Vec<[[u8; 3]; 7]> {
            (0..count).map(|p| std::array::from_fn(|row| {
                let source = if row == 6 {
                    if face { a.face_aliases[p] } else { a.point_aliases[p] }
                } else { p };
                let data = &cached[if row == 6 { 0 } else { row }];
                let front = if face { data.face_front[source] } else { data.point_front[source] };
                if !front { return [0; 3]; }
                let object = if face {
                    let world = scale(g.faces[source].iter().copied().fold([0.; 3], add), 0.25);
                    mv(data.matrices[0], world)
                } else { data.objects[source] };
                let ray = sub(object, cached[0].origin);
                std::array::from_fn(|layer| (0..7).fold(0, |mask, angle| {
                    let matrix = cached[if angle == 6 { 0 } else { angle }].matrices[0];
                    mask | (u8::from(projection::entry(g, cached[0].origin, ray, matrix, axis, layer) >= 1. - 1e-5) << angle)
                }))
            })).collect()
        };
        let point_visibility = visibility(a.points.len(), false);
        let face_visibility = visibility(g.faces.len(), true);
        for i in 0..7 {
            for j in 0..7 {
                for k in 0..7 {
                    if i == 3 && j == 3 && k == 3 {
                        continue;
                    }
                    let indices = [i, j, k];
                    let angles = indices.map(|i| -45. + 15. * i as f64);
                    let mut s = cached[0].clone();
                    s.matrices = indices.map(|i| cached[if i == 6 { 0 } else { i }].matrices[0]);
                    for p in 0..a.points.len() {
                        let row = indices[a.layers[p]];
                        let source = if row == 6 { a.point_aliases[p] } else { p };
                        let data = &cached[if row == 6 { 0 } else { row }];
                        s.objects[p] = data.objects[source];
                        s.points[p] = cached[row].points[p];
                        s.point_front[p] = data.point_front[source];
                        s.point_visible[p] = (0..3).all(|l|
                            point_visibility[p][row][l] & (1 << indices[l]) != 0);
                    }
                    for f in 0..g.faces.len() {
                        let row = indices[a.face_layers[f]];
                        let source = if row == 6 { a.face_aliases[f] } else { f };
                        let data = &cached[if row == 6 { 0 } else { row }];
                        s.centers[f] = data.centers[source];
                        s.face_polygons[f] = data.face_polygons[source];
                        s.face_front[f] = data.face_front[source];
                        s.face_visible[f] = (0..3).all(|l|
                            face_visibility[f][row][l] & (1 << indices[l]) != 0);
                    }
                    let (rv, _) = middle[j];
                    let d = diameters[j];
                    let (m, _, _, _) = metrics(
                        g,
                        w,
                        &s,
                        axis,
                        angles,
                        d,
                        original_limit * d / base_d,
                        original_limit,
                        false,
                    );
                    let score = cost(g, &m);
                    if !score.is_finite() {
                        continue;
                    }
                    let relative = std::array::from_fn(|l| {
                        let diff = angles[l] - angles[1];
                        let a = (diff + 45.).rem_euclid(90.) - 45.;
                        if a == -45. && diff > 0. {
                            45.
                        } else {
                            a
                        }
                    });
                    fits.push(Fit {
                        axis,
                        params: [
                            rv[0],
                            rv[1],
                            rv[2],
                            c.tvec[0],
                            c.tvec[1],
                            c.tvec[2],
                            relative[0],
                            relative[2],
                        ],
                        angles: relative,
                        score,
                        recovery_score_components: None,
                        source: "angle_sweep".into(),
                        flat_fallback: false,
                        metrics: m,
                        nearest: vec![],
                        valid: vec![],
                        assignment_objects: vec![],
                        assignment_projected: vec![],
                        assignment_classes: vec![],
                    });
                }
            }
        }
        let state = projection::surface(g, &c, axis, [0.; 3], rvec, c.tvec);
        let (m, _, _, _) = metrics(
            g,
            w,
            &state,
            axis,
            [0.; 3],
            base_d,
            original_limit,
            original_limit,
            false,
        );
        let score = cost(g, &m);
        if score.is_finite() {
            fits.push(Fit {
                axis,
                params: [
                    rvec[0], rvec[1], rvec[2], c.tvec[0], c.tvec[1], c.tvec[2], 0., 0.,
                ],
                angles: [0.; 3],
                score,
                recovery_score_components: None,
                source: "angle_sweep".into(),
                flat_fallback: false,
                metrics: m,
                nearest: vec![],
                valid: vec![],
                assignment_objects: vec![],
                assignment_projected: vec![],
                assignment_classes: vec![],
            });
        }
    }
    fits
}
pub fn fit_frame(g: &Geometry, w: &Workload, traces: &mut Vec<RefinementTrace>) -> Vec<Fit> {
    if w.observations.points.len() < 3 || w.observations.stickers.is_empty() {
        return vec![];
    }
    let prior = if let Some(p) = &w.prior {
        let rv = matrix_rvec(align(g, p.rvec, rodrigues(w.camera.rvec).0));
        [rv[0], rv[1], rv[2], p.tvec[0], p.tvec[1], p.tvec[2]]
    } else {
        [
            w.camera.rvec[0],
            w.camera.rvec[1],
            w.camera.rvec[2],
            w.camera.tvec[0],
            w.camera.tvec[1],
            w.camera.tvec[2],
        ]
    };
    if w.static_mode {
        let x = [
            w.camera.rvec[0],
            w.camera.rvec[1],
            w.camera.rvec[2],
            w.camera.tvec[0],
            w.camera.tvec[1],
            w.camera.tvec[2],
            0.,
            0.,
        ];
        let fit = solver::refine(g, w, 0, x, prior, [false, false]);
        traces.push(RefinementTrace {
            axis: 0,
            seed_score: None,
            seed: x,
            output: fit.params,
            nfev: fit.nfev,
            status: fit.status,
            cost: fit.cost,
        });
        return materialize(g, w, 0, fit.params)
            .into_iter()
            .map(|mut fit| {
                fit.flat_fallback = true;
                fit
            })
            .collect();
    }
    let mut cameras = vec![];
    if w.retained.is_empty() {
        cameras.push(Pose {
            rvec: w.camera.rvec,
            tvec: w.camera.tvec,
        });
    }
    cameras.extend(w.neighbors.clone());
    let mut proposals = vec![];
    let mut seeds = vec![];
    for camera in cameras {
        let swept = sweep(g, w, &camera);
        for axis in 0..3 {
            for mask in [[false, false], [true, false], [false, true], [true, true]] {
                let group = swept
                    .iter()
                    .filter(|f| f.axis == axis && [f.angles[0] != 0., f.angles[2] != 0.] == mask)
                    .cloned()
                    .collect();
                seeds.extend(shortlist(g, &w.camera, group, 2).into_iter().take(2));
            }
        }
        proposals.extend(swept);
    }
    let mut fits = w.retained.clone();
    for f in shortlist(g, &w.camera, proposals, 5) {
        if let Some(f) = materialize(g, w, f.axis, f.params) {
            fits.push(f)
        }
    }
    for f in seeds {
        let x = solver::refine(
            g,
            w,
            f.axis,
            f.params,
            prior,
            [f.params[6] != 0., f.params[7] != 0.],
        );
        traces.push(RefinementTrace {
            axis: f.axis,
            seed_score: Some(f.score),
            seed: f.params,
            output: x.params,
            nfev: x.nfev,
            status: x.status,
            cost: x.cost,
        });
        if let Some(mut revised) = materialize(g, w, f.axis, x.params) {
            revised.source = "angle_sweep_refined".into();
            fits.push(revised)
        }
    }
    assignment_bank(g, fits, 5)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn example() -> (Geometry, Fit) {
        let value: serde_json::Value =
            serde_json::from_str(include_str!("../tests/fixtures/cpu-golden.json")).unwrap();
        let geometry: Geometry = serde_json::from_value(value["geometry"].clone()).unwrap();
        let mut fit: Fit =
            serde_json::from_value(value["workloads"][0]["expected"][0].clone()).unwrap();
        fit.nearest = vec![0, 0];
        fit.valid = vec![true, false];
        fit.angles = [-15., 0., 0.];
        fit.params[6] = -15.;
        fit.params[7] = 0.;
        fit.score = 0.;
        fit.flat_fallback = false;
        (geometry, fit)
    }

    #[test]
    fn five_assignment_patterns_and_flat_ignore_cutoff_ties() {
        let (g, base) = example();
        let mut fits: Vec<_> = (0..7)
            .map(|i| {
                let mut fit = base.clone();
                fit.nearest[0] = i;
                fit.score = i as f64 * 0.01;
                fit
            })
            .collect();
        let mut duplicate = base.clone();
        duplicate.nearest[1] = 53;
        duplicate.angles = [30., 0., 0.];
        duplicate.score = 0.001;
        fits.push(duplicate);
        let mut flat = base.clone();
        flat.angles = [0.; 3];
        flat.params[6] = 0.;
        flat.score = 10.;
        fits.push(flat);
        let bank = assignment_bank(&g, fits, 5);
        assert_eq!(bank.len(), 6);
        for (i, fit) in bank[..5].iter().enumerate() {
            assert_eq!(fit.score, i as f64 * 0.01);
            assert!(!fit.flat_fallback);
        }
        assert!(bank[5].flat_fallback);
        assert_eq!(bank[5].angles, [0.; 3]);
        assert_eq!(bank[5].score, 10.);
    }

    #[test]
    fn assigned_status_is_distinct_and_missing_patterns_are_not_padded() {
        let (g, base) = example();
        let mut changed = base.clone();
        changed.valid[1] = true;
        changed.score = 0.1;
        let bank = assignment_bank(&g, vec![base.clone(), base, changed], 5);
        assert_eq!(bank.len(), 2);
        assert_eq!(bank[0].valid, vec![true, false]);
        assert_eq!(bank[1].valid, vec![true, true]);
    }
}
