//! sq1_analyzer binary:Square-1(SQ1)整解最优 twist 数分析器。
//!
//! 输出 2 列 CSV(id + 1 值):
//!   - sq1:该打乱的整解最优 twist 数(0..=13,God's number = 13,P5a 对 jaapsch 锁定)。
//!
//! 口径(P5a 定死,精确非近似):twist metric —— `/`(slash)计 1 步,`(x,y)` 层转
//! 计 0 步(双阶段 IDDFS + 五张全空间投影精确表,见 sq1_solver 模块注释)。
//!
//! 输入吃全 WCA sq1 记号:`(x,y)` 括号对(x/y 含负数,空格可有可无)+ `/` slash,
//! 行尾空白 / 末尾悬挂 `/` / `(0,0)`(理论不出现)都容忍。记号含逗号和括号,
//! 进不了 3x3 的 `string_to_alg`,走 executor 的 raw 字符串通道,由
//! `state_from_scramble` 解析;解析失败(含非法 slash:角跨缝)行输出 `id,-`
//! 并打 stderr,不中断 batch(WCA 真实打乱永远合法,合法行永无 `-`)。

use cube_solver::executor::{run_analyzer_app_raw, RawSolverWrapper};
use cube_solver::sq1_solver::{state_from_scramble, Sq1Solver};

/// 一条 (id, alg 字符串) → CSV 行。解析失败 → `id,-`(stderr 报错,不中断 batch)。
fn sq1_line(s: &Sq1Solver, alg: &str, id: &str) -> String {
    match state_from_scramble(alg) {
        Ok(st) => format!("{},{}", id, s.solve_one(&st)),
        Err(e) => {
            eprintln!("[ERROR] id={}: {}", id, e);
            format!("{},-", id)
        }
    }
}

struct Sq1Wrapper;

impl RawSolverWrapper for Sq1Wrapper {
    fn global_init() {
        let _ = Sq1Solver::shared();
        eprintln!("[INFO] sq1 tables ready (twist metric, God's number 13)");
    }

    fn get_csv_header() -> String {
        "id,sq1".into()
    }

    fn solve_raw(alg: &str, id: &str) -> String {
        sq1_line(Sq1Solver::shared(), alg, id)
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

    fn solver() -> &'static Sq1Solver {
        Sq1Solver::shared()
    }

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

    /// 行输出 = "id,值" 的值部分(合法行)。
    fn val(s: &Sq1Solver, alg: &str) -> u32 {
        let line = sq1_line(s, alg, "t");
        line.strip_prefix("t,").unwrap().parse().expect("numeric value")
    }

    #[test]
    fn sqa_basics() {
        let s = solver();

        // 已还原 = 0(空串 / 纯层转 / 双 slash 自消)
        assert_eq!(val(s, ""), 0);
        assert_eq!(val(s, "(1,0)"), 0);
        assert_eq!(val(s, "(6,6)"), 0);
        assert_eq!(val(s, "(0,0)"), 0); // 理论不出现,但出现不 panic
        assert_eq!(val(s, "//"), 0);

        // 单 slash = 1(含转量前缀 / (0,0) 前缀 / 宽松空白)
        assert_eq!(val(s, "/"), 1);
        assert_eq!(val(s, "(3,0)/"), 1);
        assert_eq!(val(s, "(0,-1)/"), 1);
        assert_eq!(val(s, "(0,0)/"), 1);
        assert_eq!(val(s, "  ( 3 , 0 ) /  "), 1); // 空白容忍 + 行尾空白

        // 解析/合法性失败 → `id,-` 不 panic
        assert_eq!(sq1_line(s, "(2,0)/", "bad1"), "bad1,-"); // 角跨缝,非法 slash
        assert_eq!(sq1_line(s, "(13,0)", "bad2"), "bad2,-"); // 转量越界
        assert_eq!(sq1_line(s, "R U R'", "bad3"), "bad3,-"); // 3x3 记号
        assert_eq!(sq1_line(s, "(1,2", "bad4"), "bad4,-"); // 括号不闭合
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

    /// 字符串通道与 lib 直查逐位一致:游走态渲染成 WCA 串走 sq1_line,
    /// 与 solve_one 直接吃态逐位相等(锁通道无损)。
    #[test]
    fn sqa_matches_lib_direct() {
        let s = solver();
        for seed in 0..12u64 {
            let tw = 1 + (seed as usize) % 6;
            let (st, toks) = random_walk_tokens(600 + seed, tw);
            let txt = scramble_to_string(&toks);
            let got = val(s, &txt);
            assert_eq!(got, s.solve_one(&st), "seed={} scramble={}", seed, txt);
            assert!(got as usize <= tw, "optimal must not exceed walk twists");
        }
    }
}
