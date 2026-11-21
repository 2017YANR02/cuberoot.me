//! Live-view adapter. The fitted geometry/search policy is the CPU port;
//! startup camera hypotheses come from independent four-landmark sticker quads.
use crate::math::*;
use crate::{search, solver, Camera, Fit, Geometry, Observations, Pose, Workload};
use nalgebra::{DMatrix, DVector, Matrix3};
use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize)]
pub struct FrameInput {
    width: f64,
    height: f64,
    observations: Observations,
    previous: Option<Pose>,
}

#[derive(Deserialize)]
pub struct NeighborInput {
    width: f64,
    height: f64,
    observations: Observations,
    bank: Vec<Fit>,
    neighbors: Vec<Pose>,
}

#[derive(Serialize)]
pub struct FrameOutput {
    pub bank: Vec<Fit>,
    pub wireframe: Vec<[V2; 4]>,
    pub pose: Option<Pose>,
    pub bootstrap: bool,
    pub message: String,
    pub stage: &'static str,
}

fn class_for(x: usize, y: usize) -> i32 {
    2 - usize::from(x == 0 || x == 3) as i32 - usize::from(y == 0 || y == 3) as i32
}

// Exact four-point homography followed by the usual pinhole planar-pose
// decomposition. The common TRF solver subsequently fits all observations.
fn planar_pose(camera: &Camera, objects: [V2; 4], image: [V2; 4], z: f64) -> Option<Pose> {
    let mut a = DMatrix::zeros(8, 8);
    let mut b = DVector::zeros(8);
    for i in 0..4 {
        let [x, y] = objects[i];
        let u = (image[i][0] - camera.k[0][2]) / camera.k[0][0];
        let v = (image[i][1] - camera.k[1][2]) / camera.k[1][1];
        for (row, values) in [
            (2 * i, [x, y, 1., 0., 0., 0., -u * x, -u * y]),
            (2 * i + 1, [0., 0., 0., x, y, 1., -v * x, -v * y]),
        ] {
            for j in 0..8 {
                a[(row, j)] = values[j];
            }
        }
        b[2 * i] = u;
        b[2 * i + 1] = v;
    }
    let h = a.lu().solve(&b)?;
    let c1 = [h[0], h[3], h[6]];
    let c2 = [h[1], h[4], h[7]];
    let factor = 2. / (norm(c1) + norm(c2));
    let r1 = scale(c1, factor);
    let r2 = scale(c2, factor);
    let r3 = cross(r1, r2);
    let approximate = Matrix3::from_columns(&[
        nalgebra::Vector3::from(r1),
        nalgebra::Vector3::from(r2),
        nalgebra::Vector3::from(r3),
    ]);
    let svd = approximate.svd(true, true);
    let rotation = svd.u? * svd.v_t?;
    if rotation.determinant() < 0. {
        return None;
    }
    let matrix: M3 = std::array::from_fn(|i| std::array::from_fn(|j| rotation[(i, j)]));
    let translation = sub(
        scale([h[2], h[5], 1.], factor),
        scale([matrix[0][2], matrix[1][2], matrix[2][2]], z),
    );
    if !translation.iter().all(|x| x.is_finite())
        || translation[2] <= 56.
        || translation[2] > 20000.
    {
        return None;
    }
    // The canonical sticker is on the positive Z face, facing the camera.
    let center = add(mv(matrix, [0., 0., z]), translation);
    if dot(
        [matrix[0][2], matrix[1][2], matrix[2][2]],
        scale(center, -1.),
    ) <= 0.
    {
        return None;
    }
    let pose = Pose {
        rvec: matrix_rvec(matrix),
        tvec: translation,
    };
    Some(refine_planar(camera, objects, image, z, pose))
}

// Homography columns are noisy on a small sticker. Enforce the pinhole rigid
// camera constraints against the four known correspondences before ranking it.
fn refine_planar(camera: &Camera, objects: [V2; 4], image: [V2; 4], z: f64, pose: Pose) -> Pose {
    let mut x = [
        pose.rvec[0],
        pose.rvec[1],
        pose.rvec[2],
        pose.tvec[0],
        pose.tvec[1],
        pose.tvec[2],
    ];
    let evaluate = |x: [f64; 6]| {
        let (r, j) = rodrigues([x[0], x[1], x[2]]);
        let t = [x[3], x[4], x[5]];
        let mut values = DVector::zeros(8);
        let mut jac = DMatrix::zeros(8, 6);
        for i in 0..4 {
            let (uv, derivative) =
                crate::projection::project(camera, r, j, t, [objects[i][0], objects[i][1], z]);
            for row in 0..2 {
                values[2 * i + row] = uv[row] - image[i][row];
                for col in 0..6 {
                    jac[(2 * i + row, col)] = derivative[row][col];
                }
            }
        }
        (values, jac)
    };
    let mut damping = 0.001;
    for _ in 0..20 {
        let (residual, jac) = evaluate(x);
        let cost = residual.norm_squared();
        let mut normal = jac.transpose() * &jac;
        let gradient = jac.transpose() * residual;
        for i in 0..6 {
            normal[(i, i)] += damping * normal[(i, i)].max(1e-6);
        }
        let Some(step) = normal.lu().solve(&(-gradient)) else {
            break;
        };
        let factor = 1f64
            .min(0.35 / norm([step[0], step[1], step[2]]).max(1e-12))
            .min(100. / norm([step[3], step[4], step[5]]).max(1e-12));
        let next = std::array::from_fn(|i| x[i] + factor * step[i]);
        if next[5] > 56. && evaluate(next).0.norm_squared() < cost {
            x = next;
            damping = (damping * 0.3).max(1e-9);
            if step.norm() * factor < 1e-7 {
                break;
            }
        } else {
            damping = (damping * 10.).min(1e12);
        }
    }
    Pose {
        rvec: [x[0], x[1], x[2]],
        tvec: [x[3], x[4], x[5]],
    }
}

fn bootstrap(g: &Geometry, w: &Workload) -> Option<Pose> {
    let obs = &w.observations;
    if obs.points.len() < 4 || obs.stickers.is_empty() {
        return None;
    }
    let mut candidates: Vec<Fit> = vec![];
    let step = g.cube_size / 3.;
    let half = g.cube_size / 2.;
    for &center in obs.stickers.iter().take(32) {
        let mut nearby: Vec<_> = (0..obs.points.len()).collect();
        nearby.sort_by(|&a, &b| {
            distance(obs.points[a], center).total_cmp(&distance(obs.points[b], center))
        });
        nearby.truncate(6);
        for mask in 0u32..(1 << nearby.len()) {
            if mask.count_ones() != 4 {
                continue;
            }
            let mut ids: Vec<_> = nearby
                .iter()
                .enumerate()
                .filter(|(i, _)| mask & (1 << i) != 0)
                .map(|(_, i)| *i)
                .collect();
            ids.sort_by(|&a, &b| {
                let p = obs.points[a];
                let q = obs.points[b];
                (p[1] - center[1])
                    .atan2(p[0] - center[0])
                    .total_cmp(&(q[1] - center[1]).atan2(q[0] - center[0]))
            });
            let image: [V2; 4] = std::array::from_fn(|i| obs.points[ids[i]]);
            let crosses: [f64; 4] = std::array::from_fn(|i| {
                let a = sub2(image[(i + 1) % 4], image[i]);
                let b = sub2(center, image[i]);
                a[0] * b[1] - a[1] * b[0]
            });
            if !crosses.iter().all(|&x| x > 1.) {
                continue;
            }
            for x in 0..3 {
                for y in 0..3 {
                    let xy = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
                    for reverse in [false, true] {
                        for shift in 0..4 {
                            let corners: [usize; 4] = std::array::from_fn(|i| {
                                if reverse {
                                    (shift + 4 - i) % 4
                                } else {
                                    (shift + i) % 4
                                }
                            });
                            if !(0..4).all(|i| {
                                let p = xy[corners[i]];
                                obs.classes[ids[i]] == class_for(p[0], p[1])
                            }) {
                                continue;
                            }
                            let objects = std::array::from_fn(|i| {
                                let p = xy[corners[i]];
                                [-half + p[0] as f64 * step, -half + p[1] as f64 * step]
                            });
                            if let Some(pose) = planar_pose(&w.camera, objects, image, half) {
                                let params = [
                                    pose.rvec[0],
                                    pose.rvec[1],
                                    pose.rvec[2],
                                    pose.tvec[0],
                                    pose.tvec[1],
                                    pose.tvec[2],
                                    0.,
                                    0.,
                                ];
                                if let Some(fit) = search::materialize(g, w, 0, params) {
                                    let mut fit = fit;
                                    fit.score = bootstrap_quality(g, w, params);
                                    candidates.push(fit);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    candidates.sort_by(|a, b| a.score.total_cmp(&b.score));
    let mut best: Option<Fit> = None;
    let mut selected: Vec<&Fit> = vec![];
    for fit in &candidates {
        let rotation = rodrigues([fit.params[0], fit.params[1], fit.params[2]]).0;
        if selected.iter().any(|old| {
            let other = rodrigues([old.params[0], old.params[1], old.params[2]]).0;
            let similarity = g
                .symmetries
                .iter()
                .map(|&s| {
                    let r = mm(other, s);
                    (0..3).map(|i| dot(r[i], rotation[i])).sum::<f64>()
                })
                .fold(f64::NEG_INFINITY, f64::max);
            similarity > 1. + 2. * 8f64.to_radians().cos()
                && norm(sub(
                    [fit.params[3], fit.params[4], fit.params[5]],
                    [old.params[3], old.params[4], old.params[5]],
                )) < 0.05 * fit.params[5]
        }) {
            continue;
        }
        selected.push(fit);
        if selected.len() == 8 {
            break;
        }
    }
    for fit in selected {
        let mut local = w.clone();
        local.camera.rvec = [fit.params[0], fit.params[1], fit.params[2]];
        local.camera.tvec = [fit.params[3], fit.params[4], fit.params[5]];
        let prior = std::array::from_fn(|i| fit.params[i]);
        let refined = solver::refine(g, &local, 0, fit.params, prior, [false, false]);
        if let Some(mut proposal) = search::materialize(g, &local, 0, refined.params) {
            proposal.score = bootstrap_quality(g, w, refined.params);
            if best.as_ref().is_none_or(|b| proposal.score < b.score) {
                best = Some(proposal);
            }
        }
    }
    best.map(|f| Pose {
        rvec: [f.params[0], f.params[1], f.params[2]],
        tvec: [f.params[3], f.params[4], f.params[5]],
    })
}
fn bootstrap_quality(g: &Geometry, w: &Workload, x: [f64; 8]) -> f64 {
    let surface = crate::projection::surface(
        g,
        &w.camera,
        0,
        [0.; 3],
        [x[0], x[1], x[2]],
        [x[3], x[4], x[5]],
    );
    let points = &w.observations.points;
    let stickers = &w.observations.stickers;
    let mut lo = [f64::INFINITY; 2];
    let mut hi = [f64::NEG_INFINITY; 2];
    for p in points.iter().chain(stickers) {
        for i in 0..2 {
            lo[i] = lo[i].min(p[i]);
            hi[i] = hi[i].max(p[i]);
        }
    }
    let limit = 0.045 * distance(lo, hi).max(1.);
    let mut landmarks = 0.;
    for (i, &p) in points.iter().enumerate() {
        let d = surface
            .points
            .iter()
            .enumerate()
            .filter(|(j, _)| {
                surface.point_visible[*j]
                    && (w.observations.classes[i] < 0
                        || g.axes[0].classes[*j] == w.observations.classes[i])
            })
            .map(|(_, q)| distance(p, *q))
            .fold(f64::INFINITY, f64::min);
        landmarks += (d / limit).min(1.).powf(1.3);
    }
    let mut centers = 0.;
    for &p in stickers {
        let d = surface
            .centers
            .iter()
            .enumerate()
            .filter(|(j, _)| surface.face_visible[*j])
            .map(|(_, q)| distance(p, *q))
            .fold(f64::INFINITY, f64::min);
        centers += (d / limit).min(1.).powf(1.3);
    }
    0.5 * (landmarks / points.len() as f64 + centers / stickers.len() as f64)
}
fn sub2(a: V2, b: V2) -> V2 {
    [a[0] - b[0], a[1] - b[1]]
}

pub fn fit_frame(g: &Geometry, input: FrameInput) -> FrameOutput {
    let empty = |message: &str| FrameOutput {
        bank: vec![],
        wireframe: vec![],
        pose: None,
        bootstrap: false,
        message: message.into(),
        stage: "initial_geometry",
    };
    if input.width <= 0.
        || input.height <= 0.
        || input.observations.points.len() < 3
        || input.observations.stickers.is_empty()
    {
        return empty("Waiting for landmarks and stickers");
    }
    let f = input.width.max(input.height) * 1.2;
    let mut w = Workload {
        name: "browser".into(),
        frame: 0,
        stage: "initial_geometry".into(),
        camera: Camera {
            rvec: [0.; 3],
            tvec: [0., 0., 500.],
            k: [
                [f, 0., input.width / 2.],
                [0., f, input.height / 2.],
                [0., 0., 1.],
            ],
            dist: vec![0.; 4],
        },
        observations: input.observations,
        prior: input.previous.clone(),
        neighbors: vec![],
        retained: vec![],
        static_mode: false,
        refinement_traces: vec![],
    };
    let fresh = input.previous.is_none();
    let pose = input.previous.or_else(|| bootstrap(g, &w));
    let Some(pose) = pose else {
        return empty("Waiting for a clear sticker and four surrounding landmarks");
    };
    w.camera.rvec = pose.rvec;
    w.camera.tvec = pose.tvec;
    let mut traces = vec![];
    let bank = search::fit_frame(g, &w, &mut traces);
    let Some(best) = bank.first() else {
        return empty("No valid geometry fit");
    };
    if best.score > 0.85 {
        return empty("Reacquiring cube pose");
    }
    output(g, &w, bank, fresh, "initial_geometry")
}

fn output(
    g: &Geometry,
    w: &Workload,
    bank: Vec<Fit>,
    bootstrap: bool,
    stage: &'static str,
) -> FrameOutput {
    let best = &bank[0];
    let rvec = [best.params[0], best.params[1], best.params[2]];
    let tvec = [best.params[3], best.params[4], best.params[5]];
    let surface = crate::projection::surface(g, &w.camera, best.axis, best.angles, rvec, tvec);
    let wireframe = surface
        .face_polygons
        .iter()
        .zip(&surface.face_front)
        .filter_map(|(p, &front)| front.then_some(*p))
        .collect();
    FrameOutput {
        bank,
        wireframe,
        pose: Some(Pose { rvec, tvec }),
        bootstrap,
        message: "Fitted pose".into(),
        stage,
    }
}

/// The CPU's second geometry pass. Neighbors must be the immutable INITIAL
/// winners, never previously revised outputs. Match process_pose_geometry's
/// symmetry-aligned mean rotation and mean translation prior.
pub fn refine_neighbors(g: &Geometry, input: NeighborInput) -> FrameOutput {
    let Some(first) = input.bank.first() else {
        return FrameOutput {
            bank: vec![],
            wireframe: vec![],
            pose: None,
            bootstrap: false,
            message: "No initial geometry fit".into(),
            stage: "temporal_neighbors",
        };
    };
    let rvec = [first.params[0], first.params[1], first.params[2]];
    let tvec = [first.params[3], first.params[4], first.params[5]];
    let reference = rodrigues(rvec).0;
    let mut mean_delta = [0.; 3];
    let mut mean_translation = [0.; 3];
    for neighbor in &input.neighbors {
        let rotation = rodrigues(neighbor.rvec).0;
        let aligned = g
            .symmetries
            .iter()
            .map(|&symmetry| mm(rotation, symmetry))
            .max_by(|a, b| {
                let score = |r: &M3| (0..3).map(|j| dot(r[j], reference[j])).sum::<f64>();
                score(a).total_cmp(&score(b))
            })
            .unwrap();
        mean_delta = add(mean_delta, matrix_rvec(mm(aligned, transpose(reference))));
        mean_translation = add(mean_translation, neighbor.tvec);
    }
    let count = input.neighbors.len() as f64;
    let prior = if count > 0. {
        Some(Pose {
            rvec: matrix_rvec(mm(rodrigues(scale(mean_delta, 1. / count)).0, reference)),
            tvec: scale(mean_translation, 1. / count),
        })
    } else {
        None
    };
    let f = input.width.max(input.height) * 1.2;
    let w = Workload {
        name: "browser".into(),
        frame: 0,
        stage: "temporal_neighbors".into(),
        camera: Camera {
            rvec,
            tvec,
            k: [
                [f, 0., input.width / 2.],
                [0., f, input.height / 2.],
                [0., 0., 1.],
            ],
            dist: vec![0.; 4],
        },
        observations: input.observations,
        prior,
        neighbors: input.neighbors,
        retained: input.bank,
        static_mode: false,
        refinement_traces: vec![],
    };
    let bank = if w.neighbors.is_empty() {
        w.retained.clone()
    } else {
        search::fit_frame(g, &w, &mut vec![])
    };
    output(g, &w, bank, false, "temporal_neighbors")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saved_detections_bootstrap_without_cached_camera_then_track() {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../tests/fixtures/cpu-golden.json")).unwrap();
        let geometry: Geometry = serde_json::from_value(fixture["geometry"].clone()).unwrap();
        let sample = &fixture["workloads"][0];
        let input = serde_json::json!({"width":sample["image_size"][0],"height":sample["image_size"][1],"observations":sample["observations"],"previous":null});
        let output = fit_frame(&geometry, serde_json::from_value(input.clone()).unwrap());
        assert!(output.pose.is_some(), "{}", output.message);
        assert!(output.bootstrap);
        assert!(!output.wireframe.is_empty());
        assert!(
            output.bank[0].score < 0.3,
            "bootstrap score {}",
            output.bank[0].score
        );
        assert!(output.bank.last().unwrap().flat_fallback);
        let input = serde_json::json!({"previous":output.pose,"width":sample["image_size"][0],"height":sample["image_size"][1],"observations":sample["observations"]});
        let tracked = fit_frame(&geometry, serde_json::from_value(input).unwrap());
        assert!(tracked.pose.is_some());
        assert!(!tracked.bootstrap);
    }

    #[test]
    fn neighbor_pass_matches_cpu_mean_prior_and_assignments() {
        let golden: serde_json::Value =
            serde_json::from_str(include_str!("../tests/fixtures/cpu-golden.json")).unwrap();
        let geometry: Geometry = serde_json::from_value(golden["geometry"].clone()).unwrap();
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../tests/fixtures/browser-neighbors.json")).unwrap();
        let result = refine_neighbors(
            &geometry,
            serde_json::from_value(fixture["input"].clone()).unwrap(),
        );
        let expected: Vec<Fit> = serde_json::from_value(fixture["expected"].clone()).unwrap();
        assert_eq!(result.stage, "temporal_neighbors");
        assert_eq!(result.bank.len(), expected.len());
        for (actual, reference) in result.bank.iter().zip(&expected) {
            assert_eq!(actual.nearest, reference.nearest);
            assert_eq!(actual.valid, reference.valid);
            assert_eq!(actual.flat_fallback, reference.flat_fallback);
            assert_eq!(actual.axis, reference.axis);
            assert!((actual.score - reference.score).abs() < 1e-6);
            for (a, b) in actual
                .assignment_projected
                .iter()
                .flatten()
                .zip(reference.assignment_projected.iter().flatten())
            {
                assert!((a - b).abs() < 1e-4);
            }
        }
    }
}
