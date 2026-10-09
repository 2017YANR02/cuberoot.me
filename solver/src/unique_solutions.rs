use std::collections::HashSet;

pub(crate) type CandidateSolution = (String, Vec<usize>, Vec<u8>);

/// 多个候选目标会产生同一条可执行公式。枚举器的 cap 是原始命中数，
/// 因此去重后不足 cap 时扩大搜索，再按首次出现顺序保留不同公式。
pub(crate) fn enumerate_unique(
    cap: usize,
    mut enumerate: impl FnMut(usize) -> (u32, Vec<CandidateSolution>),
) -> (u32, Vec<CandidateSolution>) {
    const MAX_RAW: usize = 100_000;
    let mut raw_cap = cap.max(1);
    loop {
        let (len, raw) = enumerate(raw_cap);
        let exhausted = raw.len() < raw_cap;
        let mut seen = HashSet::new();
        let mut unique = Vec::new();
        for item in raw {
            if seen.insert((item.0.clone(), item.2.clone())) {
                unique.push(item);
                if unique.len() >= cap {
                    break;
                }
            }
        }
        if unique.len() >= cap || exhausted || raw_cap >= MAX_RAW {
            return (len, unique);
        }
        raw_cap = raw_cap.saturating_mul(2).min(MAX_RAW);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duplicates_do_not_consume_the_solution_limit() {
        let candidates = [
            ("z".into(), vec![0], vec![1, 2]),
            ("z".into(), vec![1], vec![1, 2]),
            ("z".into(), vec![2], vec![3, 4]),
            ("z".into(), vec![3], vec![5, 6]),
        ];
        let mut caps = Vec::new();
        let (best, out) = enumerate_unique(3, |cap| {
            caps.push(cap);
            (5, candidates.iter().take(cap).cloned().collect())
        });
        assert_eq!(best, 5);
        assert_eq!(caps, [3, 6]);
        assert_eq!(out.len(), 3);
        assert_eq!(
            out.iter().map(|item| &item.2).collect::<Vec<_>>(),
            [&vec![1, 2], &vec![3, 4], &vec![5, 6]]
        );
    }
}
