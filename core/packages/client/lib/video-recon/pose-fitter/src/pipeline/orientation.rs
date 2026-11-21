use super::*;
fn contains(poly: &[V2; 4], point: V2, epsilon: f64) -> bool {
    let p = [point[0] as f32 as f64, point[1] as f32 as f64];
    let values: Vec<_> = (0..4)
        .map(|i| {
            let a = poly[i].map(|v| v as f32 as f64);
            let b = poly[(i + 1) % 4].map(|v| v as f32 as f64);
            (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
        })
        .collect();
    values.iter().all(|&v| v >= -epsilon) || values.iter().all(|&v| v <= epsilon)
}
pub fn orient(
    g: &Geometry,
    w: &Workload,
    bank: Vec<Fit>,
    centers: &[Center],
    reference: Option<(M3, usize)>,
    fps: f64,
    colors: &[String],
) -> Vec<Fit> {
    let mut revised = vec![];
    for fit in bank {
        let p = pose(&fit);
        let rot = rodrigues(p.rvec).0;
        let surface = projection::surface(g, &w.camera, fit.axis, fit.angles, p.rvec, p.tvec);
        let mut center_ids = vec![];
        for center in centers {
            center_ids.push(
                (0..g.faces.len())
                    .find(|&i| {
                        let c = scale(g.faces[i].iter().copied().fold([0.; 3], add), 0.25);
                        g.face_normals[i][center.axis].signum() == center.side as f64
                            && (0..3).all(|k| k == center.axis || c[k].abs() < 1e-5)
                    })
                    .unwrap(),
            );
        }
        let mut observed: Vec<Vec<&str>> = vec![vec![]; centers.len()];
        for (&point, color) in w.observations.stickers.iter().zip(colors) {
            let face = (0..g.faces.len())
                .filter(|&i| {
                    let matrix = surface.matrices[g.axes[fit.axis].face_layers[i]];
                    let base_center = scale(g.faces[i].iter().copied().fold([0.; 3], add), 0.25);
                    let cubie = sub(
                        base_center,
                        scale(
                            g.face_normals[i],
                            g.cube_size / 6. / norm(g.face_normals[i]),
                        ),
                    );
                    let normal = mv(rot, mv(matrix, g.face_normals[i]));
                    let camera = add(mv(rot, mv(matrix, cubie)), p.tvec);
                    dot(normal, scale(camera, -1.)) > 0.
                        && contains(&surface.face_polygons[i], point, 0.)
                })
                .min_by(|&a, &b| {
                    distance(point, surface.centers[a])
                        .total_cmp(&distance(point, surface.centers[b]))
                });
            if let Some(i) = face {
                if let Some(slot) = center_ids.iter().position(|&f| f == i) {
                    observed[slot].push(color);
                }
            }
        }
        let angular_scale = 90.
            * reference
                .map(|(_, frame)| 30. * w.frame.saturating_sub(frame).max(1) as f64 / fps)
                .unwrap_or(1.);
        let mut selected = identity();
        let mut best = f64::INFINITY;
        for &symmetry in &g.symmetries {
            let transformed = mm(rot, transpose(symmetry));
            let angle = reference
                .map(|(r, _)| norm(matrix_rvec(mm(transpose(r), transformed))).to_degrees())
                .unwrap_or(0.);
            let mut count = 0;
            let mut errors = 0;
            for center in centers {
                let mut normal = [0.; 3];
                normal[center.axis] = center.side as f64;
                let source = mv(transpose(symmetry), normal);
                let slot = centers
                    .iter()
                    .position(|c| source[c.axis] == c.side as f64)
                    .unwrap();
                if !observed[slot].is_empty() {
                    count += 1;
                    errors += usize::from(!observed[slot].contains(&center.color.as_str()));
                }
            }
            let score = angle / angular_scale + 0.8 * errors as f64 / (count.max(1)) as f64;
            if score < best {
                best = score;
                selected = symmetry
            }
        }
        let r = matrix_rvec(mm(rot, transpose(selected)));
        let axis = (0..3).find(|&i| selected[i][fit.axis] != 0.).unwrap();
        let sign = selected[axis][fit.axis];
        let angles = if sign > 0. {
            fit.angles
        } else {
            [-fit.angles[2], -fit.angles[1], -fit.angles[0]]
        };
        let x = [
            r[0], r[1], r[2], p.tvec[0], p.tvec[1], p.tvec[2], angles[0], angles[2],
        ];
        if let Some(mut f) = search::materialize(
            g,
            w,
            if angles.iter().all(|&a| a == 0.) {
                0
            } else {
                axis
            },
            x,
        ) {
            f.source = fit.source;
            f.flat_fallback = fit.flat_fallback;
            revised.push(f)
        }
    }
    search::assignment_bank(g, revised, 5)
}
