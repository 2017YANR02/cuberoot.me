// Rectangular minimum-cost assignment with a separate outlier column per row,
// matching the CPU's padded linear_sum_assignment contract.
pub fn assign(cost: &[Vec<f64>], gate: f64) -> (Vec<f64>, Vec<(usize, usize)>) {
    let n = cost.len();
    if n == 0 {
        return (vec![], vec![]);
    }
    let original = cost[0].len();
    let m = original + n;
    let mut u = vec![0.; n + 1];
    let mut v = vec![0.; m + 1];
    let mut p = vec![0; m + 1];
    let mut way = vec![0; m + 1];
    for i in 1..=n {
        p[0] = i;
        let mut j0 = 0;
        let mut minv = vec![f64::INFINITY; m + 1];
        let mut used = vec![false; m + 1];
        loop {
            used[j0] = true;
            let i0 = p[j0];
            let mut delta = f64::INFINITY;
            let mut j1 = 0;
            for j in 1..=m {
                if !used[j] {
                    let c = if j <= original {
                        cost[i0 - 1][j - 1]
                    } else {
                        gate
                    };
                    let cur = c - u[i0] - v[j];
                    if cur < minv[j] {
                        minv[j] = cur;
                        way[j] = j0
                    }
                    if minv[j] < delta {
                        delta = minv[j];
                        j1 = j
                    }
                }
            }
            for j in 0..=m {
                if used[j] {
                    u[p[j]] += delta;
                    v[j] -= delta
                } else {
                    minv[j] -= delta
                }
            }
            j0 = j1;
            if p[j0] == 0 {
                break;
            }
        }
        loop {
            let j1 = way[j0];
            p[j0] = p[j1];
            j0 = j1;
            if j0 == 0 {
                break;
            }
        }
    }
    let mut errors = vec![gate; n];
    let mut matched = vec![];
    for j in 1..=original {
        if p[j] > 0 {
            let i = p[j] - 1;
            errors[i] = cost[i][j - 1];
            matched.push((i, j - 1));
        }
    }
    matched.sort();
    (errors, matched)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn unique_assignments_and_independent_outlier_slots() {
        let (errors, matched) = assign(
            &[
                vec![1., 9.],
                vec![1.5, 2.],
                vec![20., 30.],
                vec![f64::INFINITY, f64::INFINITY],
            ],
            5.,
        );
        assert_eq!(matched, vec![(0, 0), (1, 1)]);
        assert_eq!(errors, vec![1., 2., 5., 5.]);
    }
    #[test]
    fn an_outlier_cannot_steal_a_supported_correspondence() {
        let (errors, matched) = assign(&[vec![f64::INFINITY], vec![0.1], vec![0.2]], 2.);
        assert_eq!(matched, vec![(1, 0)]);
        assert_eq!(errors, vec![2., 0.1, 2.]);
    }
}
