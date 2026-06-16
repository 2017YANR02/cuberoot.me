//! sq1_analyzer binary:Square-1(SQ1)整解步数分析器。
//!
//! **默认输出 3 列 CSV `id,wca,slash`**:一次近最优解算同时给两种口径,前端切换用 —
//!   - **wca** = WCA 12c4 计步:`(x,y)` 层转计 1 + `/` 计 1 = 解 token 数(官方记法步数);
//!   - **slash** = jaapsch twist:只数 `/`(`(x,y)` 计 0,God's number 13)。
//! 二者同源(同一条 cstimer 双阶段近最优解),毫秒级一题,全 125k 语料几秒跑完。
//!
//! `SQ1_EXACT=1` ⇒ 改 2 列 `id,sq1`(`sq1_solver::solve_one` 可证最优,slash 口径,
//!   tail-bound 深态数分钟;仅供 ground-truth / 对照,不用于全量灌注)。
//!
//! 输入吃全 WCA sq1 记号:`(x,y)` 括号对(x/y 含负数,空格可有可无)+ `/` slash,
//! 行尾空白 / 末尾悬挂 `/` / `(0,0)`(理论不出现)都容忍。记号含逗号和括号,
//! 进不了 3x3 的 `string_to_alg`,走 executor 的 raw 字符串通道,由
//! `state_from_scramble` 解析;解析失败(含非法 slash:角跨缝)行输出 `id,-`
//! 并打 stderr,不中断 batch(WCA 真实打乱永远合法,合法行永无 `-`)。

use cube_solver::executor::{run_analyzer_app_raw, RawSolverWrapper};
use cube_solver::sq1_solver::{state_from_scramble, Sq1Solver, Sq1WcaSolver};
use cube_solver::sq1_twophase::{solve_with_solution, Sq1TwoPhase};

/// `SQ1_EXACT=1` ⇒ 走精确最优器(slash 口径,tail-bound,2 列调试用);否则默认近最优 two-phase。
fn use_exact() -> bool {
    std::env::var("SQ1_EXACT").map(|v| v == "1").unwrap_or(false)
}

/// `SQ1_WCA_EXACT=1` ⇒ 走 WCA 12c4 **精确最优**器(2 列 `id,wca_exact`)。可证最优,
/// 深态较慢(IDA*,无 phase-2);用于真实 WCA 难度分布 / D_WCA 经验下界,优先于 SQ1_EXACT。
fn use_wca_exact() -> bool {
    std::env::var("SQ1_WCA_EXACT").map(|v| v == "1").unwrap_or(false)
}

/// 一条 (id, alg) → CSV 行。
/// **默认 3 列 `id,wca,slash`**:一次解算同时给两种口径(WCA 12c4 = (X,Y)+/ token 数;
/// slash = jaapsch twist)。前端按口径切换直方图,二者同源同一条近最优解。
/// `SQ1_EXACT=1` 时 2 列 `id,sq1`(精确 slash,调试/对照)。解析失败 → `id,-`。
fn sq1_line(alg: &str, id: &str) -> String {
    match state_from_scramble(alg) {
        Ok(st) => {
            if use_wca_exact() {
                return format!("{},{}", id, Sq1WcaSolver::shared().solve_wca(&st));
            }
            if use_exact() {
                return format!("{},{}", id, Sq1Solver::shared().solve_one(&st));
            }
            let (slash, tokens) = solve_with_solution(&st);
            // WCA 12c4 = (X,Y) 数 + / 数 = token 总数(moves_to_tokens 只发非零 Turn 与 Slash)。
            let wca = tokens.len() as u32;
            format!("{},{},{}", id, wca, slash)
        }
        Err(e) => {
            eprintln!("[ERROR] id={}: {}", id, e);
            format!("{},-", id)
        }
    }
}

struct Sq1Wrapper;

impl RawSolverWrapper for Sq1Wrapper {
    fn global_init() {
        if use_wca_exact() {
            let _ = Sq1WcaSolver::shared();
            eprintln!("[INFO] sq1 WCA-EXACT solver ready (provably WCA 12c4-optimal; D_WCA proven in [13,27])");
        } else if use_exact() {
            let _ = Sq1Solver::shared();
            eprintln!("[INFO] sq1 EXACT solver ready (provably optimal, slow tail; slash / God's number 13)");
        } else {
            let _ = Sq1TwoPhase::shared();
            eprintln!("[INFO] sq1 two-phase solver ready (near-optimal, ms/solve; emits both WCA 12c4 + slash)");
        }
    }

    fn get_csv_header() -> String {
        if use_wca_exact() {
            "id,wca_exact".into()
        } else if use_exact() {
            "id,sq1".into()
        } else {
            "id,wca,slash".into()
        }
    }

    fn solve_raw(alg: &str, id: &str) -> String {
        sq1_line(alg, id)
    }
}

fn main() {
    cube_solver::logo::print_logo_block();
    run_analyzer_app_raw::<Sq1Wrapper>("_sq1");
}

#[cfg(test)]
mod tests {
    use super::*;
    use cube_solver::sq1_solver::{parse_scramble, scramble_to_string, Sq1State, Sq1Token};

    fn lcg(x: u64) -> u64 {
        x.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407)
    }

    /// 转量 0..11 → WCA 显示值 x ∈ (-5..=6]。
    fn disp(a: u32) -> i8 {
        if a > 6 {
            a as i8 - 12
        } else {
            a as i8
        }
    }

    /// 合法 (a,b)+slash 确定性随机游走(只走 pub API)。返回 (末态, WCA token 序列)。
    fn random_walk_tokens(seed: u64, twists: usize) -> (Sq1State, Vec<Sq1Token>) {
        let mut st = Sq1State::SOLVED;
        let mut x = lcg(seed);
        let mut toks = Vec::new();
        for _ in 0..twists {
            let mut opts = Vec::new();
            for a in 0..12u32 {
                for b in 0..12u32 {
                    if st.turned(a, b).slash_legal() {
                        opts.push((a, b));
                    }
                }
            }
            x = lcg(x);
            let (a, b) = opts[(x >> 33) as usize % opts.len()];
            if (a, b) != (0, 0) {
                toks.push(Sq1Token::Turn(disp(a), disp(b)));
            }
            toks.push(Sq1Token::Slash);
            st = st.turned(a, b).slashed();
        }
        (st, toks)
    }

    /// 默认 3 列 `t,wca,slash` 的 wca 列(WCA 12c4 计步)。
    fn val(alg: &str) -> u32 {
        let line = sq1_line(alg, "t");
        line.split(',').nth(1).unwrap().parse().expect("numeric wca")
    }

    /// 默认 3 列的 slash 列(jaapsch twist)。
    fn val_slash(alg: &str) -> u32 {
        let line = sq1_line(alg, "t");
        line.split(',').nth(2).unwrap().parse().expect("numeric slash")
    }

    #[test]
    fn sqa_basics() {
        // 精确还原(空串 / (0,0) / 双 slash 自消)= 0 步,恒成立。
        assert_eq!(val(""), 0);
        assert_eq!(val("(0,0)"), 0); // 理论不出现,但出现不 panic
        assert_eq!(val("//"), 0);

        // 默认 WCA 12c4 计步:(x,y) 计 1 + / 计 1。**纯层转态在 WCA 下要 1 步对齐**
        // (slash-only 口径才是 0)—— 只是旋转等价,WCA 算一步。真实打乱永不出现纯旋转。
        assert!(val("(1,0)") <= 1);
        assert!(val("(6,6)") <= 1);
        // 无前缀单刀 `/` = 1(square→square 一刀,无层转);其余近最优态 ≥ 1。
        assert_eq!(val("/"), 1);
        assert_eq!(val("  /  "), 1); // 宽松空白 + 行尾空白
        assert!(val("(0,-1)/") >= 1);
        assert!(val("(3,0)/") >= 1);

        // 解析/合法性失败 → `id,-` 不 panic
        assert_eq!(sq1_line("(2,0)/", "bad1"), "bad1,-"); // 角跨缝,非法 slash
        assert_eq!(sq1_line("(13,0)", "bad2"), "bad2,-"); // 转量越界
        assert_eq!(sq1_line("R U R'", "bad3"), "bad3,-"); // 3x3 记号
        assert_eq!(sq1_line("(1,2", "bad4"), "bad4,-"); // 括号不闭合
    }

    /// 记号 round-trip:随机游走 → token → 串 → parse 逐 token 相等,
    /// 且串 → 态 = token 直接 apply 的态。
    #[test]
    fn sqa_notation_round_trip() {
        for seed in 0..20u64 {
            let tw = 1 + (seed as usize) % 8;
            let (st, toks) = random_walk_tokens(300 + seed, tw);
            let txt = scramble_to_string(&toks);
            assert_eq!(parse_scramble(&txt).unwrap(), toks, "round-trip: {}", txt);
            let mut replay = Sq1State::SOLVED;
            for t in &toks {
                replay.apply(*t).unwrap();
            }
            assert_eq!(replay, st, "token replay drift, seed={}", seed);
        }
    }

    /// 字符串通道两列与 lib 直查逐位一致:wca 列 = solve_wca、slash 列 = solve_twist;
    /// 且 wca ≥ slash(WCA = slash 数 + 层转数,层转 ≥ 0)。
    #[test]
    fn sqa_matches_lib_direct() {
        use cube_solver::sq1_twophase::{solve_twist, solve_wca};
        for seed in 0..12u64 {
            let tw = 1 + (seed as usize) % 6;
            let (st, toks) = random_walk_tokens(600 + seed, tw);
            let txt = scramble_to_string(&toks);
            assert_eq!(val(&txt), solve_wca(&st), "wca seed={} scramble={}", seed, txt);
            assert_eq!(val_slash(&txt), solve_twist(&st), "slash seed={} scramble={}", seed, txt);
            assert!(val(&txt) >= val_slash(&txt), "wca >= slash, seed={}", seed);
        }
    }

    /// `SQ1_EXACT=1` 切到精确器(可证最优):同一态精确值 ≤ 默认 two-phase 近最优值。
    #[test]
    fn sqa_exact_env_switch() {
        use cube_solver::sq1_twophase::solve_twist;
        let st = state_from_scramble("(0,-1)/").unwrap();
        let exact = Sq1Solver::shared().solve_one(&st);
        let near = solve_twist(&st);
        assert!(exact <= near, "exact {} should be <= near {}", exact, near);
        assert_eq!(exact, 1, "(0,-1)/ is one slash from solved");
    }
}
