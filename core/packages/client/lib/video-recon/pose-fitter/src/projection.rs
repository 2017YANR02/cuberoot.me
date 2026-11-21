use crate::math::*;
use crate::{Camera, Geometry, Workload};
pub type J6 = [[f64; 6]; 2];
fn coeff(c: &Camera, i: usize) -> f64 {
    c.dist.get(i).copied().unwrap_or(0.)
}
fn tilt(c: &Camera) -> M3 {
    let a = coeff(c, 12);
    let b = coeff(c, 13);
    let x = [
        [1., 0., 0.],
        [0., a.cos(), a.sin()],
        [0., -a.sin(), a.cos()],
    ];
    let y = [
        [b.cos(), 0., -b.sin()],
        [0., 1., 0.],
        [b.sin(), 0., b.cos()],
    ];
    let r = mm(y, x);
    mm(
        [
            [r[2][2], 0., -r[0][2]],
            [0., r[2][2], -r[1][2]],
            [0., 0., 1.],
        ],
        r,
    )
}
pub fn project(c: &Camera, rot: M3, drot: [M3; 3], t: V3, obj: V3) -> (V2, J6) {
    let p = add(mv(rot, obj), t);
    let iz = if p[2] != 0. { 1. / p[2] } else { 1. };
    let x = p[0] * iz;
    let y = p[1] * iz;
    let r2 = x * x + y * y;
    let r4 = r2 * r2;
    let r6 = r4 * r2;
    let k: [f64; 12] = std::array::from_fn(|i| coeff(c, i));
    let num = 1. + k[0] * r2 + k[1] * r4 + k[4] * r6;
    let den = 1. + k[5] * r2 + k[6] * r4 + k[7] * r6;
    let radial = num / den;
    let dr = ((k[0] + 2. * k[1] * r2 + 3. * k[4] * r4) * den
        - num * (k[5] + 2. * k[6] * r2 + 3. * k[7] * r4))
        / (den * den);
    let mut u = x * radial + 2. * k[2] * x * y + k[3] * (r2 + 2. * x * x) + k[8] * r2 + k[9] * r4;
    let mut v = y * radial + k[2] * (r2 + 2. * y * y) + 2. * k[3] * x * y + k[10] * r2 + k[11] * r4;
    let mut du = [
        radial
            + 2. * x * x * dr
            + 2. * k[2] * y
            + 6. * k[3] * x
            + 2. * k[8] * x
            + 4. * k[9] * r2 * x,
        2. * x * y * dr + 2. * k[2] * x + 2. * k[3] * y + 2. * k[8] * y + 4. * k[9] * r2 * y,
    ];
    let mut dv = [
        2. * x * y * dr + 2. * k[2] * x + 2. * k[3] * y + 2. * k[10] * x + 4. * k[11] * r2 * x,
        radial
            + 2. * y * y * dr
            + 6. * k[2] * y
            + 2. * k[3] * x
            + 2. * k[10] * y
            + 4. * k[11] * r2 * y,
    ];
    if coeff(c, 12) != 0. || coeff(c, 13) != 0. {
        let m = tilt(c);
        let q = mv(m, [u, v, 1.]);
        let a = [
            (m[0][0] * q[2] - q[0] * m[2][0]) / q[2].powi(2),
            (m[0][1] * q[2] - q[0] * m[2][1]) / q[2].powi(2),
        ];
        let b = [
            (m[1][0] * q[2] - q[1] * m[2][0]) / q[2].powi(2),
            (m[1][1] * q[2] - q[1] * m[2][1]) / q[2].powi(2),
        ];
        let old = du;
        du = [a[0] * old[0] + a[1] * dv[0], a[0] * old[1] + a[1] * dv[1]];
        dv = [b[0] * old[0] + b[1] * dv[0], b[0] * old[1] + b[1] * dv[1]];
        u = q[0] / q[2];
        v = q[1] / q[2];
    }
    let fx = c.k[0][0];
    let fy = c.k[1][1];
    let trans = [
        [
            fx * du[0] * iz,
            fx * du[1] * iz,
            -fx * (du[0] * x + du[1] * y) * iz,
        ],
        [
            fy * dv[0] * iz,
            fy * dv[1] * iz,
            -fy * (dv[0] * x + dv[1] * y) * iz,
        ],
    ];
    let mut jac = [[0.; 6]; 2];
    for i in 0..2 {
        for k in 0..3 {
            jac[i][k] = dot(trans[i], mv(drot[k], obj));
            jac[i][k + 3] = trans[i][k];
        }
    }
    ([fx * u + c.k[0][2], fy * v + c.k[1][2]], jac)
}
pub fn project_uv(c: &Camera, rot: M3, t: V3, obj: V3) -> V2 {
    project(c, rot, [[[0.; 3]; 3]; 3], t, obj).0
}
pub fn cube_diameter(g: &Geometry, c: &Camera, rvec: V3, tvec: V3) -> f64 {
    let rot = rodrigues(rvec).0;
    diameter(
        &g.corners
            .iter()
            .map(|&p| project_uv(c, rot, tvec, p))
            .collect::<Vec<_>>(),
    )
}
pub fn undistort(c: &Camera, p: V2) -> V3 {
    let mut x0 = (p[0] - c.k[0][2]) / c.k[0][0];
    let mut y0 = (p[1] - c.k[1][2]) / c.k[1][1];
    if coeff(c, 12) != 0. || coeff(c, 13) != 0. {
        let m = nalgebra::Matrix3::from_row_slice(&tilt(c).concat())
            .try_inverse()
            .unwrap();
        let q = m * nalgebra::Vector3::new(x0, y0, 1.);
        x0 = q[0] / q[2];
        y0 = q[1] / q[2];
    }
    let (mut x, mut y) = (x0, y0);
    for _ in 0..5 {
        let r2 = x * x + y * y;
        let ic = (1. + ((coeff(c, 7) * r2 + coeff(c, 6)) * r2 + coeff(c, 5)) * r2)
            / (1. + ((coeff(c, 4) * r2 + coeff(c, 1)) * r2 + coeff(c, 0)) * r2);
        if ic < 0. {
            return [x0, y0, 1.];
        }
        let dx = 2. * coeff(c, 2) * x * y
            + coeff(c, 3) * (r2 + 2. * x * x)
            + coeff(c, 8) * r2
            + coeff(c, 9) * r2 * r2;
        let dy = coeff(c, 2) * (r2 + 2. * y * y)
            + 2. * coeff(c, 3) * x * y
            + coeff(c, 10) * r2
            + coeff(c, 11) * r2 * r2;
        x = (x0 - dx) * ic;
        y = (y0 - dy) * ic;
    }
    [x, y, 1.]
}
pub fn entry(g: &Geometry, origin: V3, ray: V3, rot: M3, axis: usize, layer: usize) -> f64 {
    let o = mv(transpose(rot), origin);
    let d = mv(transpose(rot), ray);
    let mut near = 0f64;
    let mut far = f64::INFINITY;
    for k in 0..3 {
        let lo = if k == axis {
            -g.cube_size / 2. + layer as f64 * g.cube_size / 3.
        } else {
            -g.cube_size / 2.
        };
        let hi = if k == axis {
            lo + g.cube_size / 3.
        } else {
            g.cube_size / 2.
        };
        if d[k].abs() < 1e-12 {
            if o[k] < lo - 1e-7 || o[k] > hi + 1e-7 {
                return f64::INFINITY;
            }
        } else {
            let a = (lo - o[k]) / d[k];
            let b = (hi - o[k]) / d[k];
            near = near.max(a.min(b));
            far = far.min(a.max(b));
        }
    }
    if near <= far + 1e-7 {
        near
    } else {
        f64::INFINITY
    }
}
#[derive(Clone)]
pub struct Surface {
    pub objects: Vec<V3>,
    pub points: Vec<V2>,
    pub point_jac: Vec<J6>,
    pub point_visible: Vec<bool>,
    pub point_front: Vec<bool>,
    pub face_polygons: Vec<[V2; 4]>,
    pub centers: Vec<V2>,
    pub center_jac: Vec<J6>,
    pub face_visible: Vec<bool>,
    pub face_front: Vec<bool>,
    pub matrices: [M3; 3],
    pub origin: V3,
    pub rotation: M3,
    pub rotation_jac: [M3; 3],
}
pub fn surface(
    g: &Geometry,
    c: &Camera,
    axis: usize,
    angles: [f64; 3],
    rvec: V3,
    tvec: V3,
) -> Surface {
    let a = &g.axes[axis];
    let matrices = angles.map(|v| axis_rotation(axis, v));
    let (rotation, rotation_jac) = rodrigues(rvec);
    let origin = scale(mv(transpose(rotation), tvec), -1.);
    let mut s = Surface {
        objects: vec![],
        points: vec![],
        point_jac: vec![],
        point_visible: vec![],
        point_front: vec![],
        face_polygons: vec![],
        centers: vec![],
        center_jac: vec![],
        face_visible: vec![],
        face_front: vec![],
        matrices,
        origin,
        rotation,
        rotation_jac,
    };
    for (i, &base) in a.points.iter().enumerate() {
        let obj = mv(matrices[a.layers[i]], base);
        let front = (0..3).any(|j| {
            a.masks[i][j] && dot(mv(matrices[a.layers[i]], a.normals[i][j]), sub(origin, obj)) > 0.
        });
        let visible = front
            && (0..3)
                .all(|l| entry(g, origin, sub(obj, origin), matrices[l], axis, l) >= 1. - 1e-5);
        let (p, j) = project(c, rotation, rotation_jac, tvec, obj);
        s.objects.push(obj);
        s.points.push(p);
        s.point_jac.push(j);
        s.point_visible.push(visible);
        s.point_front.push(front);
    }
    for (i, face) in g.faces.iter().enumerate() {
        let rot = matrices[a.face_layers[i]];
        let objects = face.map(|p| mv(rot, p));
        let center = scale(objects.into_iter().fold([0.; 3], add), 0.25);
        let front = dot(mv(rot, g.face_normals[i]), sub(origin, center)) > 0.;
        let visible = front
            && (0..3)
                .all(|l| entry(g, origin, sub(center, origin), matrices[l], axis, l) >= 1. - 1e-5);
        let mut poly = [[0.; 2]; 4];
        let mut jac = [[0.; 6]; 2];
        for k in 0..4 {
            let (p, j) = project(c, rotation, rotation_jac, tvec, objects[k]);
            poly[k] = p;
            for row in 0..2 {
                for col in 0..6 {
                    jac[row][col] += j[row][col] * 0.25;
                }
            }
        }
        s.centers.push([
            (poly[0][0] + poly[1][0] + poly[2][0] + poly[3][0]) * 0.25,
            (poly[0][1] + poly[1][1] + poly[2][1] + poly[3][1]) * 0.25,
        ]);
        s.face_polygons.push(poly);
        s.center_jac.push(jac);
        s.face_visible.push(visible);
        s.face_front.push(front);
    }
    s
}
pub fn evaluate(
    g: &Geometry,
    w: &Workload,
    axis: usize,
    x: &[f64; 8],
) -> (Vec<f64>, Vec<[f64; 8]>) {
    let s = surface(
        g,
        &w.camera,
        axis,
        [x[6], 0., x[7]],
        [x[0], x[1], x[2]],
        [x[3], x[4], x[5]],
    );
    let scale = (cube_diameter(g, &w.camera, w.camera.rvec, w.camera.tvec) / 220.).max(0.3);
    let a = &g.axes[axis];
    let obs = &w.observations;
    let unit = identity()[axis];
    let mut residual = Vec::new();
    let mut jacobian = Vec::new();
    for (kind, observations) in [&obs.points, &obs.stickers].into_iter().enumerate() {
        for (i, &p) in observations.iter().enumerate() {
            let candidates = if kind == 0 { &s.points } else { &s.centers };
            let visible = if kind == 0 {
                &s.point_visible
            } else {
                &s.face_visible
            };
            let mut best = 0;
            let mut bestd = f64::INFINITY;
            for (j, &q) in candidates.iter().enumerate() {
                let compatible = kind != 0
                    || obs.classes[i] < 0
                    || a.classes[j] < 0
                    || obs.classes[i] == a.classes[j];
                if visible[j] && compatible {
                    let d = distance(p, q);
                    if d < bestd {
                        bestd = d;
                        best = j;
                    }
                }
            }
            let base_jac = if kind == 0 {
                s.point_jac[best]
            } else {
                s.center_jac[best]
            };
            let layer = if kind == 0 {
                a.layers[best]
            } else {
                a.face_layers[best]
            };
            let mut angle_jac = [0.; 2];
            if kind == 0 {
                let v = mv(
                    s.rotation,
                    scale3(cross(unit, s.objects[best]), std::f64::consts::PI / 180.),
                );
                for row in 0..2 {
                    angle_jac[row] =
                        base_jac[row][3] * v[0] + base_jac[row][4] * v[1] + base_jac[row][5] * v[2];
                }
            } else {
                for &vertex in &g.faces[best] {
                    let object = mv(s.matrices[layer], vertex);
                    let (_, j) = project(
                        &w.camera,
                        s.rotation,
                        s.rotation_jac,
                        [x[3], x[4], x[5]],
                        object,
                    );
                    let v = mv(
                        s.rotation,
                        scale3(cross(unit, object), std::f64::consts::PI / 180.),
                    );
                    for row in 0..2 {
                        angle_jac[row] +=
                            (j[row][3] * v[0] + j[row][4] * v[1] + j[row][5] * v[2]) * 0.25;
                    }
                }
            }
            for row in 0..2 {
                let mut jac = [0.; 8];
                if bestd.is_finite() {
                    jac[..6].copy_from_slice(&base_jac[row]);
                    if layer == 0 {
                        jac[6] = angle_jac[row]
                    }
                    if layer == 2 {
                        jac[7] = angle_jac[row]
                    }
                    for v in &mut jac {
                        *v /= scale
                    }
                    residual.push((candidates[best][row] - p[row]) / scale);
                } else {
                    residual.push((40. * scale) / scale);
                }
                jacobian.push(jac);
            }
        }
    }
    (residual, jacobian)
}
fn scale3(a: V3, s: f64) -> V3 {
    scale(a, s)
}
