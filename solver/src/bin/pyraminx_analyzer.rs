//! pyraminx_analyzer binary:Pyraminx(金字塔)整解最优步数分析器。
//!
//! 输出 2 列 CSV(id + 1 值):
//!   - pyraminx:该打乱的整解最优 HTM 步数(0..=15,God's number 含 tips = 15)。
//!
//! 口径(P3a 锁定,精确非近似):总 HTM = 核心查表最优 + #错位 tips
//! (定理证明 + 75,582,720 全空间联合 BFS 逐态验证,见 pyraminx_solver 模块注释)。
//!
//! 输入吃全 WCA pyram 记号:大写 U/L/R/B 核心 move + 小写 u/l/r/b 顶点 tip move,
//! 均带可选 '(及 2,阶 3 下 X2 = X')。pyram 记号不走 3x3 的 `string_to_alg`
//! (小写 tip 无对应 Move),改走 executor 的 raw 字符串通道,由
//! `parse_pyraminx` 解析;解析失败行输出 `id,-` 并打 stderr(任意 pyram 态都
//! 可解,合法行永无 `-`)。

use std::sync::OnceLock;

use cube_solver::executor::{run_analyzer_app_raw, RawSolverWrapper};
use cube_solver::pyraminx_solver::{parse_pyraminx, PyraminxSolver};

static S: OnceLock<PyraminxSolver> = OnceLock::new();

/// 是否追加第 3 列「一条最优解」(逆之即最优等价打乱)。默认关(保持 2 列、旧消费者与
/// 单测不变);打乱统计管道设 `PUZZLE_EMIT_SOLN=1` 时打开。
fn emit_soln() -> bool {
    std::env::var("PUZZLE_EMIT_SOLN").is_ok()
}

/// 一条 (id, alg 字符串) → CSV 行。解析失败 → `id,-`(stderr 报错,不中断 batch)。
/// 开 `PUZZLE_EMIT_SOLN` 时追加第 3 列:一条最优解(核心大写 + 收尾小写 tip);逆之即最优等价打乱。
fn pyra_line(s: &PyraminxSolver, alg: &str, id: &str) -> String {
    match parse_pyraminx(alg) {
        Ok(moves) => {
            let len = s.solve_one(&moves);
            if !emit_soln() {
                return format!("{},{}", id, len);
            }
            format!("{},{},{}", id, len, s.enumerate(&moves).to_string_moves())
        }
        Err(e) => {
            eprintln!("[ERROR] id={}: {}", id, e);
            if emit_soln() { format!("{},-,", id) } else { format!("{},-", id) }
        }
    }
}

struct PyraminxWrapper;

impl RawSolverWrapper for PyraminxWrapper {
    fn global_init() {
        let s = S.get_or_init(PyraminxSolver::new);
        eprintln!("[INFO] pyraminx table ready (core max depth {})", s.max_depth());
    }

    fn get_csv_header() -> String {
        if emit_soln() { "id,pyraminx,soln".into() } else { "id,pyraminx".into() }
    }

    fn solve_raw(alg: &str, id: &str) -> String {
        pyra_line(S.get().unwrap(), alg, id)
    }
}

fn main() {
    cube_solver::logo::print_logo_block();
    run_analyzer_app_raw::<PyraminxWrapper>("_pyraminx");
}

#[cfg(test)]
mod tests {
    use super::*;
    use cube_solver::pyraminx_solver::{PyraMove, PyraState};

    fn solver() -> &'static PyraminxSolver {
        S.get_or_init(PyraminxSolver::new)
    }

    fn lcg(x: u64) -> u64 {
        x.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407)
    }

    /// 确定性伪随机词(全 16 记号:8 大写 + 8 小写,含 ')。
    fn pseudo_word(seed: u64, len: usize) -> Vec<PyraMove> {
        let mut x = lcg(seed);
        let mut out = Vec::with_capacity(len);
        for _ in 0..len {
            x = lcg(x);
            let v = (x >> 33) as usize % 16;
            out.push(PyraMove { axis: (v % 8 / 2) as u8, prime: v % 2 == 1, tip: v >= 8 });
        }
        out
    }

    fn word_to_string(alg: &[PyraMove]) -> String {
        alg.iter().map(|m| m.name()).collect::<Vec<_>>().join(" ")
    }

    /// 行输出 = "id,值" 的值部分(合法行)。
    fn val(s: &PyraminxSolver, alg: &str) -> u32 {
        let line = pyra_line(s, alg, "t");
        line.strip_prefix("t,").unwrap().parse().expect("numeric value")
    }

    #[test]
    fn pya_basics() {
        let s = solver();

        // 已还原 = 0(空词 / 自消词 / 纯旋转无此概念,pyram 无整体旋转记号)
        assert_eq!(val(s, ""), 0);
        assert_eq!(val(s, "U U'"), 0);
        assert_eq!(val(s, "R2 R"), 0); // X2 = X' ⇒ R2 R = id

        // 全 16 记号 ± ' 都吃,单 move = 1(单 tip = 1;单大写带动同轴 tip,r=0)
        for t in [
            "U", "U'", "L", "L'", "R", "R'", "B", "B'", "u", "u'", "l", "l'", "r", "r'", "b", "b'",
        ] {
            assert_eq!(val(s, t), 1, "single move {}", t);
        }
        // 2 后缀(阶 3:X2 = X')
        assert_eq!(val(s, "U2"), 1);
        assert_eq!(val(s, "b2"), 1);

        // 手算锁定:U u' = 核心 1 + 坏 tip 1;四 tip 全错 = 4
        assert_eq!(val(s, "U u'"), 2);
        assert_eq!(val(s, "u l r b"), 4);
        assert_eq!(val(s, "u l' r b'"), 4);

        // 解析失败 → `id,-` 不 panic
        assert_eq!(pyra_line(s, "U X R", "bad1"), "bad1,-");
        assert_eq!(pyra_line(s, "U3", "bad2"), "bad2,-");
    }

    /// 与 lib 直查逐位一致:随机词 → 渲染成记号串 → pyra_line 走字符串通道,
    /// 与 solve_one 直接吃 move 序列逐位相等(锁字符串 round-trip)。
    #[test]
    fn pya_matches_lib_direct() {
        let s = solver();
        for seed in 0..60u64 {
            let len = 1 + (seed as usize) % 18;
            let alg = pseudo_word(4000 + seed, len);
            let got = val(s, &word_to_string(&alg));
            assert_eq!(got, s.solve_one(&alg), "seed={} alg={}", seed, word_to_string(&alg));
        }
    }

    /// 独立预言机(金标准):联合 IDDFS(16 个 move,目标 = 全归位件级态),
    /// 不经「核心 + tips 相加」公式、不经距离表 → 锁口径与 bin 输出一致。
    #[test]
    fn pya_matches_iddfs_oracle() {
        let s = solver();

        fn dfs(st: &PyraState, depth: u32, prev: i32) -> bool {
            if depth == 0 {
                return *st == PyraState::SOLVED;
            }
            for v in 0..16u8 {
                // 同 (轴,大小写) 类连续两步必可合并,剪掉
                if prev >= 0 && v / 2 == prev as u8 / 2 {
                    continue;
                }
                let mut ns = *st;
                ns.apply(PyraMove { axis: v % 8 / 2, prime: v % 2 == 1, tip: v >= 8 });
                if dfs(&ns, depth - 1, v as i32) {
                    return true;
                }
            }
            false
        }

        for seed in 0..32u64 {
            let len = 1 + (seed as usize) % 5;
            let alg = pseudo_word(8000 + seed, len);
            let got = val(s, &word_to_string(&alg));
            assert!(got as usize <= len, "seed={} got={} len={}", seed, got, len);
            let mut st = PyraState::SOLVED;
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
