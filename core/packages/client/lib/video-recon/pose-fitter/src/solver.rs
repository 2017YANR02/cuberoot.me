// Algorithmic translation of SciPy 1.17.1's bounded, exact-SVD TRF path.
// See THIRD_PARTY.md. Bounds, robust scaling, reflected/Cauchy alternatives,
// trust-radius updates and stopping tests follow scipy.optimize._lsq.
use crate::projection;
use crate::{Geometry, Workload};
use nalgebra::{DMatrix as Mat, DVector as VecN};
fn norm(v: &[f64]) -> f64 {
    v.iter().map(|x| x * x).sum::<f64>().sqrt()
}
fn dot(a: &[f64], b: &[f64]) -> f64 {
    a.iter().zip(b).map(|(a, b)| a * b).sum()
}
fn cl(x: &[f64], g: &[f64], lo: &[f64], hi: &[f64]) -> (Vec<f64>, Vec<f64>) {
    let mut v = vec![1.; x.len()];
    let mut dv = vec![0.; x.len()];
    for i in 0..x.len() {
        if g[i] < 0. && hi[i].is_finite() {
            v[i] = hi[i] - x[i];
            dv[i] = -1.
        }
        if g[i] > 0. && lo[i].is_finite() {
            v[i] = x[i] - lo[i];
            dv[i] = 1.
        }
    }
    (v, dv)
}
fn nextafter(x: f64, y: f64) -> f64 {
    if x == y {
        return y;
    }
    if x == 0. {
        return f64::from_bits(1).copysign(y);
    }
    let b = x.to_bits();
    f64::from_bits(if (y > x) == (x > 0.) { b + 1 } else { b - 1 })
}
fn feasible(x: &[f64], lo: &[f64], hi: &[f64], relative: bool) -> Vec<f64> {
    x.iter()
        .enumerate()
        .map(|(i, &a)| {
            let ld = a - lo[i];
            let ud = hi[i] - a;
            let tol = if relative { 1e-10 } else { 0. };
            let lower = ld <= ud.min(tol * lo[i].abs().max(1.));
            let upper = ud <= ld.min(tol * hi[i].abs().max(1.));
            let mut v = a;
            if lower {
                v = if relative {
                    lo[i] + tol * lo[i].abs().max(1.)
                } else {
                    nextafter(lo[i], hi[i])
                }
            }
            if upper {
                v = if relative {
                    hi[i] - tol * hi[i].abs().max(1.)
                } else {
                    nextafter(hi[i], lo[i])
                }
            }
            if v < lo[i] || v > hi[i] {
                v = (lo[i] + hi[i]) * 0.5
            }
            v
        })
        .collect()
}
fn bound_step(x: &[f64], s: &[f64], lo: &[f64], hi: &[f64]) -> (f64, Vec<bool>) {
    let steps: Vec<f64> = x
        .iter()
        .enumerate()
        .map(|(i, &x)| {
            if s[i] == 0. {
                f64::INFINITY
            } else {
                ((lo[i] - x) / s[i]).max((hi[i] - x) / s[i])
            }
        })
        .collect();
    let min = steps.iter().copied().fold(f64::INFINITY, f64::min);
    (min, steps.iter().map(|s| *s == min).collect())
}
fn intersect(x: &[f64], s: &[f64], delta: f64) -> f64 {
    let a = dot(s, s);
    let b = dot(x, s);
    let c = dot(x, x) - delta * delta;
    let d = (b * b - a * c).max(0.).sqrt();
    let q = -(b + d.copysign(b));
    (q / a).max(c / q)
}
fn quadratic(j: &Mat<f64>, g: &[f64], s: &[f64], diag: &[f64]) -> f64 {
    let js = j * VecN::from_column_slice(s);
    0.5 * (js.norm_squared() + s.iter().zip(diag).map(|(v, d)| v * v * d).sum::<f64>()) + dot(g, s)
}
fn line(
    j: &Mat<f64>,
    g: &[f64],
    s: &[f64],
    diag: &[f64],
    start: Option<&[f64]>,
) -> (f64, f64, f64) {
    let v = j * VecN::from_column_slice(s);
    let a = 0.5 * (v.norm_squared() + s.iter().zip(diag).map(|(s, d)| s * s * d).sum::<f64>());
    let mut b = dot(g, s);
    let mut c = 0.;
    if let Some(p) = start {
        let u = j * VecN::from_column_slice(p);
        b += u.dot(&v)
            + p.iter()
                .zip(diag)
                .zip(s)
                .map(|((p, d), s)| p * d * s)
                .sum::<f64>();
        c = 0.5 * (u.norm_squared() + p.iter().zip(diag).map(|(p, d)| p * p * d).sum::<f64>())
            + dot(g, p)
    }
    (a, b, c)
}
fn min_line(a: f64, b: f64, c: f64, lo: f64, hi: f64) -> (f64, f64) {
    let mut ts = vec![lo, hi];
    if a != 0. {
        let t = -0.5 * b / a;
        if t > lo && t < hi {
            ts.push(t)
        }
    }
    let mut best = (lo, f64::INFINITY);
    for t in ts {
        let v = t * (a * t + b) + c;
        if v < best.1 {
            best = (t, v)
        }
    }
    best
}
fn select(
    x: &[f64],
    j: &Mat<f64>,
    diag: &[f64],
    g: &[f64],
    mut p: Vec<f64>,
    mut ph: Vec<f64>,
    d: &[f64],
    delta: f64,
    lo: &[f64],
    hi: &[f64],
    theta: f64,
) -> (Vec<f64>, Vec<f64>, f64) {
    if x.iter()
        .enumerate()
        .all(|(i, &x)| x + p[i] >= lo[i] && x + p[i] <= hi[i])
    {
        let pred = -quadratic(j, g, &ph, diag);
        return (p, ph, pred);
    }
    let (stride, hits) = bound_step(x, &p, lo, hi);
    let mut rh: Vec<f64> = ph
        .iter()
        .enumerate()
        .map(|(i, &v)| if hits[i] { -v } else { v })
        .collect();
    let r: Vec<f64> = rh.iter().zip(d).map(|(a, b)| a * b).collect();
    for i in 0..p.len() {
        p[i] *= stride;
        ph[i] *= stride;
    }
    let at: Vec<f64> = x.iter().zip(&p).map(|(a, b)| a + b).collect();
    let totr = intersect(&ph, &rh, delta);
    let (tobound, _) = bound_step(&at, &r, lo, hi);
    let rs = tobound.min(totr);
    let (rl, ru) = if rs > 0. {
        (
            (1. - theta) * stride / rs,
            if rs == tobound { theta * tobound } else { totr },
        )
    } else {
        (0., -1.)
    };
    let mut rv = f64::INFINITY;
    let mut rr = vec![0.; x.len()];
    if rl <= ru {
        let (a, b, c) = line(j, g, &rh, diag, Some(&ph));
        let (t, v) = min_line(a, b, c, rl, ru);
        rv = v;
        for i in 0..rh.len() {
            rh[i] = rh[i] * t + ph[i];
            rr[i] = rh[i] * d[i];
        }
    }
    for i in 0..p.len() {
        p[i] *= theta;
        ph[i] *= theta;
    }
    let pv = quadratic(j, g, &ph, diag);
    let mut ah: Vec<f64> = g.iter().map(|g| -g).collect();
    let mut ag: Vec<f64> = ah.iter().zip(d).map(|(a, b)| a * b).collect();
    let tr = delta / norm(&ah);
    let (tb, _) = bound_step(x, &ag, lo, hi);
    let ast = if tb < tr { theta * tb } else { tr };
    let (a, b, c) = line(j, g, &ah, diag, None);
    let (t, av) = min_line(a, b, c, 0., ast);
    for i in 0..ag.len() {
        ag[i] *= t;
        ah[i] *= t;
    }
    if pv < rv && pv < av {
        (p, ph, -pv)
    } else if rv < pv && rv < av {
        (rr, rh, -rv)
    } else {
        (ag, ah, -av)
    }
}
fn trust_step(
    s: &VecN<f64>,
    v: &Mat<f64>,
    uf: &VecN<f64>,
    m: usize,
    delta: f64,
    mut alpha: f64,
) -> (Vec<f64>, f64) {
    let n = s.len();
    let suf = s.component_mul(uf);
    let rank = m >= n && s[n - 1] > f64::EPSILON * m as f64 * s[0];
    if rank {
        let p = -(v * uf.component_div(s));
        if p.norm() <= delta {
            return (p.as_slice().to_vec(), 0.);
        }
    }
    let phi = |a: f64| {
        let denominators = s.map(|s| s * s + a);
        let pn = suf.component_div(&denominators).norm();
        (
            pn - delta,
            -suf.iter()
                .zip(denominators.iter())
                .map(|(x, d)| x * x / d.powi(3))
                .sum::<f64>()
                / pn,
        )
    };
    let mut upper = suf.norm() / delta;
    let mut lower = if rank {
        let (p, d) = phi(0.);
        -p / d
    } else {
        0.
    };
    if !rank && alpha == 0. {
        alpha = (0.001 * upper).max((lower * upper).sqrt())
    }
    for _ in 0..10 {
        if alpha < lower || alpha > upper {
            alpha = (0.001 * upper).max((lower * upper).sqrt())
        }
        let (p, der) = phi(alpha);
        if p < 0. {
            upper = alpha
        }
        let ratio = p / der;
        lower = lower.max(alpha - ratio);
        alpha -= (p + delta) * ratio / delta;
        if p.abs() < 0.01 * delta {
            break;
        }
    }
    let mut p = -(v * suf.component_div(&s.map(|s| s * s + alpha)));
    let length = p.norm();
    p *= delta / length;
    (p.as_slice().to_vec(), alpha)
}
fn cost(f: &[f64]) -> f64 {
    f.iter()
        .map(|v| 9. * ((1. + (v / 3.).powi(2)).sqrt() - 1.))
        .sum()
}
fn robust(f: &[f64], j: &Mat<f64>) -> (VecN<f64>, Mat<f64>) {
    let mut fs = VecN::from_column_slice(f);
    let mut js = j.clone();
    for i in 0..f.len() {
        let z = 1. + (f[i] / 3.).powi(2);
        let r1 = 1. / z.sqrt();
        let r2 = -0.5 / z.powf(1.5) / 9.;
        let scale = (r1 + 2. * r2 * f[i] * f[i]).max(f64::EPSILON).sqrt();
        fs[i] *= r1 / scale;
        for k in 0..j.ncols() {
            js[(i, k)] *= scale;
        }
    }
    (fs, js)
}
pub struct Refined {
    pub params: [f64; 8],
    pub nfev: usize,
    pub status: i32,
    pub cost: f64,
}
pub fn refine(
    g: &Geometry,
    w: &Workload,
    axis: usize,
    seed: [f64; 8],
    prior: [f64; 6],
    mask: [bool; 2],
) -> Refined {
    let free: Vec<usize> = (0..8).filter(|&i| i < 6 || mask[i - 6]).collect();
    let n = free.len();
    let radii = [0.8, 0.8, 0.8, 40., 40., 100.];
    let mut lower = [-45.; 8];
    let mut upper = [45.; 8];
    for i in 0..6 {
        lower[i] = seed[i] - radii[i];
        upper[i] = seed[i] + radii[i];
    }
    lower[5] = lower[5].max(g.cube_size + 1.);
    let lo: Vec<_> = free.iter().map(|&i| lower[i]).collect();
    let hi: Vec<_> = free.iter().map(|&i| upper[i]).collect();
    let scales = [0.25, 0.25, 0.25, 8., 8., 25., 15., 15.];
    let sigmas = [0.6, 0.6, 0.6, 25., 25., 70., 180., 180.];
    let scale: Vec<_> = free.iter().map(|&i| scales[i]).collect();
    let unpack = |z: &[f64]| {
        let mut x = seed;
        for (i, &k) in free.iter().enumerate() {
            x[k] = z[i]
        }
        x
    };
    let evaluate = |z: &[f64]| {
        let x = unpack(z);
        let (mut f, mut jac) = projection::evaluate(g, w, axis, &x);
        for k in 0..8 {
            f.push((x[k] - if k < 6 { prior[k] } else { 0. }) / sigmas[k]);
            let mut row = [0.; 8];
            row[k] = 1. / sigmas[k];
            jac.push(row);
        }
        let j = Mat::from_fn(f.len(), n, |i, k| jac[i][free[k]]);
        (f, j)
    };
    let x0: Vec<f64> = free.iter().map(|&i| seed[i]).collect();
    let (x, nfev, status, cost) = bounded_lsq(&x0, &lo, &hi, &scale, 18, true, evaluate);
    Refined {
        params: unpack(&x),
        nfev,
        status,
        cost,
    }
}
fn loss_cost(f: &[f64], soft_l1: bool) -> f64 {
    if soft_l1 {
        cost(f)
    } else {
        0.5 * f.iter().map(|v| v * v).sum::<f64>()
    }
}
fn loss_state(f: &[f64], j: &Mat<f64>, soft_l1: bool) -> (VecN<f64>, Mat<f64>) {
    if soft_l1 {
        robust(f, j)
    } else {
        (VecN::from_column_slice(f), j.clone())
    }
}
pub(crate) fn bounded_lsq<F>(
    x0: &[f64],
    lo: &[f64],
    hi: &[f64],
    scale: &[f64],
    iterations: usize,
    soft_l1: bool,
    evaluate: F,
) -> (Vec<f64>, usize, i32, f64)
where
    F: Fn(&[f64]) -> (Vec<f64>, Mat<f64>),
{
    let n = x0.len();
    let mut x = feasible(x0, lo, hi, true);
    let (f0, j0) = evaluate(&x);
    let mut ftrue = f0;
    let (mut f, mut j) = loss_state(&ftrue, &j0, soft_l1);
    let mut current_cost = loss_cost(&ftrue, soft_l1);
    let mut grad = j.transpose() * &f;
    let (v, dv) = cl(&x, grad.as_slice(), &lo, &hi);
    let mut delta = x
        .iter()
        .enumerate()
        .map(|(i, &x)| {
            (x / scale[i] / (v[i] * if dv[i] != 0. { 1. / scale[i] } else { 1. }).sqrt()).powi(2)
        })
        .sum::<f64>()
        .sqrt();
    if delta == 0. {
        delta = 1.
    }
    let mut alpha = 0.;
    let mut nfev = 1;
    let mut status = 0;
    loop {
        let (mut v, dv) = cl(&x, grad.as_slice(), &lo, &hi);
        let gnorm = grad
            .iter()
            .zip(&v)
            .map(|(g, v)| (g * v).abs())
            .fold(0., f64::max);
        if gnorm < 1e-8 {
            status = 1;
            break;
        }
        if nfev == iterations {
            break;
        }
        for i in 0..n {
            if dv[i] != 0. {
                v[i] /= scale[i]
            }
        }
        let d: Vec<_> = v.iter().zip(scale).map(|(v, s)| v.sqrt() * s).collect();
        let diag: Vec<_> = (0..n).map(|i| grad[i] * dv[i] * scale[i]).collect();
        let gh: Vec<_> = (0..n).map(|i| grad[i] * d[i]).collect();
        let jh = Mat::from_fn(j.nrows(), n, |i, k| j[(i, k)] * d[k]);
        let aug = Mat::from_fn(j.nrows() + n, n, |i, k| {
            if i < j.nrows() {
                jh[(i, k)]
            } else if i - j.nrows() == k {
                diag[k].sqrt()
            } else {
                0.
            }
        });
        let svd = aug.svd(true, true);
        let u = svd.u.unwrap();
        let vm = svd.v_t.unwrap().transpose();
        let mut faug = VecN::zeros(f.len() + n);
        faug.rows_mut(0, f.len()).copy_from(&f);
        let uf = u.transpose() * faug;
        let singular = svd.singular_values;
        let theta = 0.995f64.max(1. - gnorm);
        let mut reduction = -1.;
        let mut terminate = false;
        let mut next_x = x.clone();
        let mut next_f = vec![];
        let mut next_j = Mat::zeros(0, n);
        let mut next_cost = current_cost;
        while reduction <= 0. && nfev < iterations {
            let (ph, a) = trust_step(&singular, &vm, &uf, f.len(), delta, alpha);
            alpha = a;
            let p: Vec<_> = ph.iter().zip(&d).map(|(p, d)| p * d).collect();
            let (step, step_h, predicted) =
                select(&x, &jh, &diag, &gh, p, ph, &d, delta, &lo, &hi, theta);
            let proposed: Vec<_> = x.iter().zip(&step).map(|(a, b)| a + b).collect();
            next_x = feasible(&proposed, &lo, &hi, false);
            (next_f, next_j) = evaluate(&next_x);
            nfev += 1;
            let sh = norm(&step_h);
            if !next_f.iter().all(|v| v.is_finite()) {
                delta = 0.25 * sh;
                continue;
            }
            next_cost = loss_cost(&next_f, soft_l1);
            reduction = current_cost - next_cost;
            let ratio = if predicted > 0. {
                reduction / predicted
            } else if predicted == 0. && reduction == 0. {
                1.
            } else {
                0.
            };
            let new_delta = if ratio < 0.25 {
                0.25 * sh
            } else if ratio > 0.75 && sh > 0.95 * delta {
                2. * delta
            } else {
                delta
            };
            let ftol = reduction < 1e-8 * current_cost && ratio > 0.25;
            let xtol = norm(&step) < 1e-8 * (1e-8 + norm(&x));
            terminate = ftol || xtol;
            if terminate {
                status = if ftol && xtol {
                    4
                } else if ftol {
                    2
                } else {
                    3
                };
                break;
            }
            alpha *= delta / new_delta;
            delta = new_delta;
        }
        if reduction > 0. {
            x = next_x;
            ftrue = next_f;
            current_cost = next_cost;
            (f, j) = loss_state(&ftrue, &next_j, soft_l1);
            grad = j.transpose() * &f;
        }
        if terminate || nfev == iterations {
            break;
        }
    }
    (x, nfev, status, current_cost)
}
