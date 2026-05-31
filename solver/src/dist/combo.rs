//! 组合数学共享 helper, 用于 *_0f / 0-move 分布计算的容斥
//!
//! 三阶魔方 cube laws:
//!   - 棱朝向守恒 EO conservation:  ∏ eo_i ≡ 0 mod 2
//!   - 角朝向守恒 CO conservation:  ∑ co_i ≡ 0 mod 3
//!   - 排列奇偶守恒 perm parity:    sgn(corner_perm) = sgn(edge_perm)

const fn build_fact() -> [u128; 13] {
    let mut a = [1u128; 13];
    let mut i: usize = 1;
    while i <= 12 {
        a[i] = a[i - 1] * i as u128;
        i += 1;
    }
    a
}

const fn build_pow2() -> [u128; 13] {
    let mut a = [1u128; 13];
    let mut i: usize = 1;
    while i <= 12 {
        a[i] = a[i - 1] * 2;
        i += 1;
    }
    a
}

const fn build_pow3() -> [u128; 9] {
    let mut a = [1u128; 9];
    let mut i: usize = 1;
    while i <= 8 {
        a[i] = a[i - 1] * 3;
        i += 1;
    }
    a
}

pub const FACT: [u128; 13] = build_fact();
pub const POW2: [u128; 13] = build_pow2();
pub const POW3: [u128; 9] = build_pow3();

/// 排列数 P(n, k) = n! / (n-k)!
pub fn perm(n: usize, k: usize) -> u128 {
    if k > n {
        return 0;
    }
    let mut r: u128 = 1;
    for i in 0..k {
        r *= (n - i) as u128;
    }
    r
}

/// 组合数 C(n, k)
pub fn binom(n: usize, k: usize) -> u128 {
    if k > n {
        return 0;
    }
    let k = if k > n / 2 { n - k } else { k };
    let mut r: u128 = 1;
    for i in 1..=k {
        r = r * (n - i + 1) as u128 / i as u128;
    }
    r
}

/// 在固定 kE 个棱 + kC 个角后, 剩余自由块构成的全空间合法 cube state 数
///
/// = (12-kE)! * (8-kC)! * 2^(12-kE) * 3^(8-kC)
///   / 2 (if free edges > 0, EO)
///   / 3 (if free corners > 0, CO)
///   / 2 (if free edges >= 2 或 free corners >= 2, perm parity)
pub fn count_legal_states(k_edges: usize, k_corners: usize) -> u128 {
    if k_edges > 12 || k_corners > 8 {
        return 0;
    }
    let n_e = 12 - k_edges;
    let n_c = 8 - k_corners;
    let mut total = FACT[n_e] * FACT[n_c] * POW2[n_e] * POW3[n_c];
    if n_e > 0 {
        total /= 2;
    }
    if n_c > 0 {
        total /= 3;
    }
    if n_e >= 2 || n_c >= 2 {
        total /= 2;
    }
    total
}

/// 子空间 sub-space 计数 (用于 1_col 系列)
///
/// 固定 cross + k 个 F2L 槽 (k 棱 + k 角) 后,
/// 剩下 (4-k) 棱要在 (8-k) 个非 cross 棱位中排列 (含 2^(4-k) 朝向),
/// (4-k) 角要在 (8-k) 个角位中排列 (含 3^(4-k) 朝向)。
pub fn w_sub(k: usize) -> u128 {
    if k > 4 {
        return 0;
    }
    let rem = 4 - k;
    let slots = 8 - k;
    let edges = perm(slots, rem) * POW2[rem];
    let corners = perm(slots, rem) * POW3[rem];
    edges * corners
}
