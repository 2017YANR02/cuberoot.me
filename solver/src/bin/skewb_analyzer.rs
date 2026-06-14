//! skewb_analyzer binary:Skewb 整解最优步数分析器。
//!
//! 输出 2 列 CSV(id + 1 值):
//!   - skewb:该打乱的整解最优步数(0..=11,God's number = 11,P4a 实测锁定)。
//!
//! 口径(P4a 锁定,精确非近似):全空间 3,149,280 距离表直查
//! (jaapsch 公开分布逐项锁,见 skewb_solver 模块注释)。
//!
//! 输入吃全 WCA skewb 记号:U/L/R/B,后缀 ' / 2 / 2'(阶 3:X2 = X')。
//! 记号虽全大写,但语义与 3x3 不同(X2 是 240° 非半转),不走 3x3 的
//! `string_to_alg`,改走 executor 的 raw 字符串通道,由 `parse_skewb` 解析;
//! 解析失败行输出 `id,-` 并打 stderr(任意 skewb 态都可解,合法行永无 `-`)。

use std::sync::OnceLock;

use cube_solver::executor::{run_analyzer_app_raw, RawSolverWrapper};
use cube_solver::skewb_solver::{parse_skewb, SkewbSolver};

static S: OnceLock<SkewbSolver> = OnceLock::new();

/// 是否追加第 3 列「一条最优解」(逆之即最优等价打乱)。默认关(保持 2 列、旧消费者与
/// 单测不变);打乱统计管道设 `PUZZLE_EMIT_SOLN=1` 时打开。
fn emit_soln() -> bool {
    std::env::var("PUZZLE_EMIT_SOLN").is_ok()
}

/// 一条 (id, alg 字符串) → CSV 行。解析失败 → `id,-`(stderr 报错,不中断 batch)。
/// 开 `PUZZLE_EMIT_SOLN` 时追加第 3 列:一条最优解(WCA skewb 记号);逆之即最优等价打乱。
fn skewb_line(s: &SkewbSolver, alg: &str, id: &str) -> String {
    match parse_skewb(alg) {
        Ok(moves) => {
            let len = s.solve_one(&moves);
            if !emit_soln() {
                return format!("{},{}", id, len);
            }
            let soln = s
                .enumerate(&moves)
                .moves
                .iter()
                .map(|m| m.name())
                .collect::<Vec<_>>()
                .join(" ");
            format!("{},{},{}", id, len, soln)
        }
        Err(e) => {
            eprintln!("[ERROR] id={}: {}", id, e);
            if emit_soln() { format!("{},-,", id) } else { format!("{},-", id) }
        }
    }
}

struct SkewbWrapper;

impl RawSolverWrapper for SkewbWrapper {
    fn global_init() {
        let s = S.get_or_init(SkewbSolver::new);
        eprintln!("[INFO] skewb table ready (max depth {})", s.max_depth());
    }

    fn get_csv_header() -> String {
        if emit_soln() { "id,skewb,soln".into() } else { "id,skewb".into() }
    }

    fn solve_raw(alg: &str, id: &str) -> String {
        skewb_line(S.get().unwrap(), alg, id)
    }
}

fn main() {
    cube_solver::logo::print_logo_block();
    run_analyzer_app_raw::<SkewbWrapper>("_skewb");
}

#[cfg(test)]
mod tests {
    use super::*;
    use cube_solver::skewb_solver::{SkewbMove, SkewbState};

    fn solver() -> &'static SkewbSolver {
        S.get_or_init(SkewbSolver::new)
    }

    fn lcg(x: u64) -> u64 {
        x.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407)
    }

    /// 确定性伪随机词(全 8 记号:4 轴 × ±')。
    fn pseudo_word(seed: u64, len: usize) -> Vec<SkewbMove> {
        let mut x = lcg(seed);
        let mut out = Vec::with_capacity(len);
        for _ in 0..len {
            x = lcg(x);
            let v = (x >> 33) as usize % 8;
            out.push(SkewbMove { axis: (v / 2) as u8, prime: v % 2 == 1 });
        }
        out
    }

    fn word_to_string(alg: &[SkewbMove]) -> String {
        alg.iter().map(|m| m.name()).collect::<Vec<_>>().join(" ")
    }

    /// 行输出 = "id,值" 的值部分(合法行)。
    fn val(s: &SkewbSolver, alg: &str) -> u32 {
        let line = skewb_line(s, alg, "t");
        line.strip_prefix("t,").unwrap().parse().expect("numeric value")
    }

    #[test]
    fn skb_basics() {
        let s = solver();

        // 已还原 = 0(空词 / 自消词)
        assert_eq!(val(s, ""), 0);
        assert_eq!(val(s, "U U'"), 0);
        assert_eq!(val(s, "B2 B"), 0); // X2 = X' ⇒ B2 B = id

        // 全 8 记号都吃,单 move = 1
        for t in ["U", "U'", "L", "L'", "R", "R'", "B", "B'"] {
            assert_eq!(val(s, t), 1, "single move {}", t);
        }
        // 2 后缀(阶 3:X2 = X')
        assert_eq!(val(s, "U2"), 1);
        assert_eq!(val(s, "R2'"), 1);

        // 手算锁定:异轴两步不可消 = 2
        assert_eq!(val(s, "U L"), 2);
        assert_eq!(val(s, "R' B"), 2);

        // 解析失败 → `id,-` 不 panic(D / 小写 / U3 均非 WCA skewb 记号)
        assert_eq!(skewb_line(s, "U D R", "bad1"), "bad1,-");
        assert_eq!(skewb_line(s, "U3", "bad2"), "bad2,-");
        assert_eq!(skewb_line(s, "u", "bad3"), "bad3,-");
    }

    /// 与 lib 直查逐位一致:随机词 → 渲染成记号串 → skewb_line 走字符串通道,
    /// 与 solve_one 直接吃 move 序列逐位相等(锁字符串 round-trip)。
    #[test]
    fn skb_matches_lib_direct() {
        let s = solver();
        for seed in 0..60u64 {
            let len = 1 + (seed as usize) % 18;
            let alg = pseudo_word(5000 + seed, len);
            let got = val(s, &word_to_string(&alg));
            assert_eq!(got, s.solve_one(&alg), "seed={} alg={}", seed, word_to_string(&alg));
        }
    }

    /// 独立预言机(金标准):件级 IDDFS(8 个 move,目标 = 全归位件级态),
    /// 不经坐标编码 / 距离表 → 锁口径与 bin 输出一致。
    #[test]
    fn skb_matches_iddfs_oracle() {
        let s = solver();

        fn dfs(st: &SkewbState, depth: u32, prev_axis: i32) -> bool {
            if depth == 0 {
                return *st == SkewbState::SOLVED;
            }
            for v in 0..8u8 {
                let axis = v / 2;
                // 同轴连续两步必可合并,剪掉(不破坏最优性)
                if prev_axis == axis as i32 {
                    continue;
                }
                let mut ns = *st;
                ns.apply(SkewbMove { axis, prime: v % 2 == 1 });
                if dfs(&ns, depth - 1, axis as i32) {
                    return true;
                }
            }
            false
        }

        for seed in 0..32u64 {
            let len = 1 + (seed as usize) % 5;
            let alg = pseudo_word(9000 + seed, len);
            let got = val(s, &word_to_string(&alg));
            assert!(got as usize <= len, "seed={} got={} len={}", seed, got, len);
            let mut st = SkewbState::SOLVED;
            st.apply_all(&alg);
            let mut want = u32::MAX;
            for dd in 0..=len as u32 {
                if dfs(&st, dd, -1) {
                    want = dd;
                    break;
                }
            }
            assert_eq!(got, want, "seed={} alg={}", seed, word_to_string(&alg));
        }
    }
}
