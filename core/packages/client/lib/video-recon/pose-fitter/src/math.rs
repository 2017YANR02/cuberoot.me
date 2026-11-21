use nalgebra::Matrix3;
pub type V3 = [f64; 3];
pub type V2 = [f64; 2];
pub type M3 = [[f64; 3]; 3];
pub fn add(a: V3, b: V3) -> V3 {
    [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}
pub fn sub(a: V3, b: V3) -> V3 {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
pub fn scale(a: V3, s: f64) -> V3 {
    [a[0] * s, a[1] * s, a[2] * s]
}
pub fn dot(a: V3, b: V3) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
pub fn cross(a: V3, b: V3) -> V3 {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}
pub fn norm(a: V3) -> f64 {
    dot(a, a).sqrt()
}
pub fn mv(a: M3, b: V3) -> V3 {
    [dot(a[0], b), dot(a[1], b), dot(a[2], b)]
}
pub fn transpose(a: M3) -> M3 {
    std::array::from_fn(|i| std::array::from_fn(|j| a[j][i]))
}
pub fn mm(a: M3, b: M3) -> M3 {
    let t = transpose(b);
    std::array::from_fn(|i| std::array::from_fn(|j| dot(a[i], t[j])))
}
pub fn identity() -> M3 {
    [[1., 0., 0.], [0., 1., 0.], [0., 0., 1.]]
}
pub fn axis_rotation(axis: usize, angle: f64) -> M3 {
    let mut v = [0.; 3];
    v[axis] = angle.to_radians();
    rodrigues(v).0
}
// OpenCV's normalized-axis Rodrigues formula and analytic derivative.
pub fn rodrigues(v: V3) -> (M3, [M3; 3]) {
    let theta = norm(v);
    let mut jac = [[[0.; 3]; 3]; 3];
    let e = identity();
    let dx = [
        [[0., 0., 0.], [0., 0., -1.], [0., 1., 0.]],
        [[0., 0., 1.], [0., 0., 0.], [-1., 0., 0.]],
        [[0., -1., 0.], [1., 0., 0.], [0., 0., 0.]],
    ];
    if theta < f64::EPSILON {
        return (e, dx);
    }
    let c = theta.cos();
    let s = theta.sin();
    let c1 = 1. - c;
    let it = 1. / theta;
    let r = scale(v, it);
    let outer: M3 = std::array::from_fn(|i| std::array::from_fn(|j| r[i] * r[j]));
    let skew = [[0., -r[2], r[1]], [r[2], 0., -r[0]], [-r[1], r[0], 0.]];
    let rot = std::array::from_fn(|i| {
        std::array::from_fn(|j| c * e[i][j] + c1 * outer[i][j] + s * skew[i][j])
    });
    for k in 0..3 {
        for i in 0..3 {
            for j in 0..3 {
                let douter = if i == k { r[j] } else { 0. } + if j == k { r[i] } else { 0. };
                jac[k][i][j] = -s * r[k] * e[i][j]
                    + (s - 2. * c1 * it) * r[k] * outer[i][j]
                    + c1 * it * douter
                    + (c - s * it) * r[k] * skew[i][j]
                    + s * it * dx[k][i][j];
            }
        }
    }
    (rot, jac)
}
pub fn matrix_rvec(matrix: M3) -> V3 {
    let m = Matrix3::from_row_slice(&matrix.concat());
    let svd = m.svd(true, true);
    let m = svd.u.unwrap() * svd.v_t.unwrap();
    let mut r = [
        m[(2, 1)] - m[(1, 2)],
        m[(0, 2)] - m[(2, 0)],
        m[(1, 0)] - m[(0, 1)],
    ];
    let s = (dot(r, r) * 0.25).sqrt();
    let c = ((m.trace() - 1.) * 0.5).clamp(-1., 1.);
    let theta = c.acos();
    if s < 1e-5 {
        if c > 0. {
            return [0.; 3];
        }
        r = [
            ((m[(0, 0)] + 1.) * 0.5).max(0.).sqrt(),
            ((m[(1, 1)] + 1.) * 0.5).max(0.).sqrt() * if m[(0, 1)] < 0. { -1. } else { 1. },
            ((m[(2, 2)] + 1.) * 0.5).max(0.).sqrt() * if m[(0, 2)] < 0. { -1. } else { 1. },
        ];
        if r[0].abs() < r[1].abs()
            && r[0].abs() < r[2].abs()
            && ((m[(1, 2)] > 0.) != (r[1] * r[2] > 0.))
        {
            r[2] = -r[2];
        }
        return scale(r, theta / norm(r));
    }
    scale(r, theta / (2. * s))
}
pub fn distance(a: V2, b: V2) -> f64 {
    ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2)).sqrt()
}
// OpenCV's incremental float32 enclosing circle, including its 1e-4 margin.
pub fn diameter(points: &[V2]) -> f64 {
    // Preserve the CPU OpenCV float32 arithmetic, including explicit fused
    // subtractions in the circumcenter determinants. mul_add has the same
    // rounding on native and WASM; no relaxed SIMD/fast-math is used.
    let pts: Vec<[f32; 2]> = points.iter().map(|p| [p[0] as f32, p[1] as f32]).collect();
    let dist = |a: [f32; 2], b: [f32; 2]| {
        let x = (a[0] - b[0]) as f64;
        let y = (a[1] - b[1]) as f64;
        (x * x + y * y).sqrt()
    };
    let pair = |a: [f32; 2], b: [f32; 2]| {
        (
            [(a[0] + b[0]) / 2., (a[1] + b[1]) / 2.],
            dist(a, b) as f32 / 2. + 1e-4f32,
        )
    };
    if pts.len() < 2 {
        return 0.0002;
    }
    let (mut c, mut r) = pair(pts[0], pts[1]);
    for i in 2..pts.len() {
        if (dist(pts[i], c) as f32) < r {
            continue;
        }
        (c, r) = pair(pts[0], pts[i]);
        for j in 1..i {
            if dist(pts[j], c) < r as f64 {
                continue;
            }
            (c, r) = pair(pts[j], pts[i]);
            for k in 0..j {
                if dist(pts[k], c) < r as f64 {
                    continue;
                }
                let a = pts[i];
                let b = pts[j];
                let d = pts[k];
                let v1 = [b[0] - a[0], b[1] - a[1]];
                let v2 = [d[0] - a[0], d[1] - a[1]];
                let m1 = [(a[0] + b[0]) / 2., (a[1] + b[1]) / 2.];
                let m2 = [(a[0] + d[0]) / 2., (a[1] + d[1]) / 2.];
                let c1 = m1[0] * v1[0] + m1[1] * v1[1];
                let c2 = m2[0] * v2[0] + m2[1] * v2[1];
                let det = v1[0].mul_add(v2[1], -v1[1] * v2[0]);
                if det.abs() <= 1e-4 {
                    continue;
                }
                c = [
                    c1.mul_add(v2[1], -c2 * v1[1]) / det,
                    v1[0].mul_add(c2, -v2[0] * c1) / det,
                ];
                let dx = c[0] - a[0];
                let dy = c[1] - a[1];
                r = (dx * dx + dy * dy).sqrt() + 1e-4;
            }
        }
    }
    2. * r as f64
}
