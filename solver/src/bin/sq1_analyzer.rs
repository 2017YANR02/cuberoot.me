//! sq1_analyzer binary:Square-1(SQ1)整解步数分析器。
//!
//! **默认输出 3 列 CSV `id,wca,slash`**:一次近最优解算同时给两种口径,前端切换用 —
//!   - **wca** = WCA 12c4 计步:`(x,y)` 层转计 1 + `/` 计 1 = 解 token 数(官方记法步数);
//!   - **slash** = jaapsch twist:只数 `/`(`(x,y)` 计 0,God's number 13)。
//! 二者同源(同一条 cstimer 双阶段近最优解),毫秒级一题,全 125k 语料几秒跑完。
//!
//! `SQ1_EXACT=1` ⇒ 改 2 列 `id,sq1`(`sq1_solver::solve_one` 可证最优,slash 口径,God's number 13)。
//!   再叠 `SQ1_SLASH_SOLN=1` ⇒ 3 列 `id,slash_exact,opt_scramble`(附 slash 最优等价打乱),
//!   供全量灌注 slash 最优分布 + 网站「slash 最优打乱」展示。
//!
//! 输入吃全 WCA sq1 记号:`(x,y)` 括号对(x/y 含负数,空格可有可无)+ `/` slash,
//! 行尾空白 / 末尾悬挂 `/` / `(0,0)`(理论不出现)都容忍。记号含逗号和括号,
//! 进不了 3x3 的 `string_to_alg`,走 executor 的 raw 字符串通道,由
//! `state_from_scramble` 解析;解析失败(含非法 slash:角跨缝)行输出 `id,-`
//! 并打 stderr,不中断 batch(WCA 真实打乱永远合法,合法行永无 `-`)。

use cube_solver::executor::{run_analyzer_app_raw, RawSolverWrapper};
use cube_solver::sq1_solver::{
    invert_scramble, scramble_to_compact, state_from_scramble, tokens_from_scramble, SlashViaWca,
    Sq1Solver, Sq1Token, Sq1WcaSolver,
};
use cube_solver::sq1_twophase::{solve_with_solution, Sq1TwoPhase};

/// `SQ1_EXACT=1` ⇒ 走精确最优器(slash 口径,tail-bound,2 列调试用);否则默认近最优 two-phase。
fn use_exact() -> bool {
    std::env::var("SQ1_EXACT").map(|v| v == "1").unwrap_or(false)
}

/// `SQ1_SLASH_SOLN=1`(配合 `SQ1_EXACT=1`)⇒ 多出第 3 列 `opt_scramble`:slash 最优等价打乱
/// (= 可证 slash 最优解的逆,从 SOLVED 到达同一态、slash 数 = slash_exact)。SQ1 简写记号,CSV 安全。
/// 供网站「原始 / slash 最优打乱」切换 + slash 口径示例。3 列表头 `id,slash_exact,opt_scramble`。
fn use_slash_soln() -> bool {
    std::env::var("SQ1_SLASH_SOLN").map(|v| v == "1").unwrap_or(false)
}

/// `SQ1_WCA_EXACT=1` ⇒ 走 WCA 12c4 **精确最优**器(2 列 `id,wca_exact`)。可证最优,
/// 深态较慢(IDA*,无 phase-2);用于真实 WCA 难度分布 / D_WCA 经验下界,优先于 SQ1_EXACT。
fn use_wca_exact() -> bool {
    std::env::var("SQ1_WCA_EXACT").map(|v| v == "1").unwrap_or(false)
}

/// `SQ1_COMPACTIFY=1` ⇒ 纯记号转换器(不求解):输入 `id,scramble`(WCA 或 compact 自动识别)→
/// 输出 `id,compact`(SQ1 简写,CSV 安全)。用于 corpus 一次性迁移 + 抽取时把 WCA 导出转 compact。
fn use_compactify() -> bool {
    std::env::var("SQ1_COMPACTIFY").map(|v| v == "1").unwrap_or(false)
}

/// `SQ1_SLASH_VIA_WCA=1` ⇒ slash 最优(twist)**经 WCA 机器可证**(不需 13GB jsq_full,轻量解器)。
/// 输入 `id,compact,W`(W = 已知 WCA 12c4 最优,PS 从 sq1_wca_exact.csv 传;compact 无逗号 ⇒ 末段干净切)。
/// 歧义态(W=2s-1):找 (s-1)-slash 解 ⇒ t=s-1;穷举无 ⇒ t=s(可证)。输出 `id,slash_exact,opt_scramble`
/// (opt 空 = t=s 用 WCA 最优打乱;`id,M` = 看门狗超时怪物)。配 `SQ1_SOLVE_TIMEOUT_SECS` 看门狗。
fn use_slash_via_wca() -> bool {
    std::env::var("SQ1_SLASH_VIA_WCA").map(|v| v == "1").unwrap_or(false)
}

/// `SQ1_WCA_SOLN=1`(配合 `SQ1_WCA_EXACT=1`)⇒ 多出第 3 列 `opt_scramble`:最优等价打乱
/// (= 可证最优解的逆,从 SOLVED 到达同一态、步数=wca_exact)。**SQ1 简写记号**(`tb/tb/…`,无逗号/
/// 括号/空格 → 天生 CSV 安全,前端原样可渲染),供网站「原始/最优打乱」切换 + 示例。
fn use_wca_soln() -> bool {
    std::env::var("SQ1_WCA_SOLN").map(|v| v == "1").unwrap_or(false)
}

/// `SQ1_SOLVE_TIMEOUT_SECS=N`(N>0,配合 `SQ1_WCA_EXACT=1`)⇒ 单条 solve 超 N 秒判**怪物**:放弃、
/// 输出 `id,M` 占位(标记已处理 ⇒ 续跑跳过、build 侧 `Number('M')`=NaN 自动略过不污染分布)、实时
/// `[MONSTER] id=.. scramble=..` 报具体打乱;怪物留清单(inject 脚本从 `id,M` 回捞)后续大 TT 单独跑。
/// 未设/0 ⇒ 无超时(必出可证最优解,深尾可能很久)。
fn solve_timeout_secs() -> Option<u64> {
    static S: std::sync::OnceLock<Option<u64>> = std::sync::OnceLock::new();
    *S.get_or_init(|| {
        std::env::var("SQ1_SOLVE_TIMEOUT_SECS").ok().and_then(|s| s.parse().ok()).filter(|&v| v > 0)
    })
}

/// `SQ1_SOLVE_PARALLEL=N`(N≥1,配 `SQ1_WCA_EXACT=1`、不配超时)⇒ 单条 solve 走 **root-split 并行
/// IDA***(EPIC ④),split 深度 = N(用全部 RAYON_NUM_THREADS 核啃一条怪物)。供怪物 grind 尾部
/// 单条独占全核;未设/0 ⇒ 老串行路径。仍可证 WCA 12c4 最优(只是把同一搜索分到多核)。
fn solve_parallel_split() -> Option<u8> {
    static S: std::sync::OnceLock<Option<u8>> = std::sync::OnceLock::new();
    *S.get_or_init(|| {
        std::env::var("SQ1_SOLVE_PARALLEL").ok().and_then(|s| s.parse::<u8>().ok()).filter(|&v| v > 0)
    })
}

/// 一条 (id, alg) → CSV 行。
/// **默认 3 列 `id,wca,slash`**:一次解算同时给两种口径(WCA 12c4 = (X,Y)+/ token 数;
/// slash = jaapsch twist)。前端按口径切换直方图,二者同源同一条近最优解。
/// `SQ1_EXACT=1` 时 2 列 `id,sq1`(精确 slash,调试/对照)。解析失败 → `id,-`。
fn sq1_line(alg: &str, id: &str) -> String {
    // 纯转换器:id,scramble(WCA/compact 自动识别)→ id,compact。不求解。
    if use_compactify() {
        return match tokens_from_scramble(alg) {
            Ok(toks) => format!("{},{}", id, scramble_to_compact(&toks)),
            Err(e) => {
                eprintln!("[ERROR] id={}: {}", id, e);
                format!("{},-", id)
            }
        };
    }
    // slash 最优 via WCA:输入 alg = "compact,W"(compact 无逗号 ⇒ 首逗号前=记号、后=W)。
    if use_slash_via_wca() {
        let (scr, w) = match alg.find(',') {
            Some(p) => match alg[p + 1..].trim().parse::<u8>() {
                Ok(w) => (&alg[..p], w),
                Err(_) => {
                    eprintln!("[ERROR] id={}: SQ1_SLASH_VIA_WCA needs id,compact,W (bad W)", id);
                    return format!("{},-", id);
                }
            },
            None => {
                eprintln!("[ERROR] id={}: SQ1_SLASH_VIA_WCA needs id,compact,W", id);
                return format!("{},-", id);
            }
        };
        let st = match state_from_scramble(scr) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[ERROR] id={}: {}", id, e);
                return format!("{},-", id);
            }
        };
        // 歧义态 W=2s-1 ⇒ s=(W+1)/2;t∈{s-1,s}。深态超时 → 怪物(PS 加大超时/资源重跑)。
        // SQ1_SOLVE_PARALLEL=N ⇒ root-split 并行(单条怪物吃满全核啃 W=23 穷尽);未设 ⇒ 串行。
        let s = (w + 1) / 2;
        let split = solve_parallel_split().unwrap_or(0);
        let deadline = solve_timeout_secs()
            .map(|secs| std::time::Instant::now() + std::time::Duration::from_secs(secs));
        return match Sq1WcaSolver::shared_lite().slash_minus_one_via_wca(&st, w, deadline, split) {
            SlashViaWca::SmallerExists(sol) => {
                format!("{},{},{}", id, s - 1, scramble_to_compact(&invert_scramble(&sol)))
            }
            // t=s:opt 留空 ⇒ PS 用 WCA 最优打乱(恰 s 刀 = 合法 slash 最优等价打乱)。
            SlashViaWca::ProvenEqual => format!("{},{},", id, s),
            SlashViaWca::Timeout => {
                cube_solver::executor::emit_event(&format!(
                    "[MONSTER] id={} timeout={}s scramble={}",
                    id,
                    solve_timeout_secs().unwrap_or(0),
                    scr
                ));
                format!("{},M", id)
            }
        };
    }
    match state_from_scramble(alg) {
        Ok(st) => {
            if use_wca_exact() {
                let w = Sq1WcaSolver::shared();
                let timeout = solve_timeout_secs();
                // 成功行:有 soln 列则附最优等价打乱(= 解的逆,SQ1 简写记号,CSV 安全无逗号/括号/空格)。
                let row = |cost: u32, sol: &[Sq1Token]| -> String {
                    if use_wca_soln() {
                        format!("{},{},{}", id, cost, scramble_to_compact(&invert_scramble(sol)))
                    } else {
                        format!("{},{}", id, cost)
                    }
                };
                // 怪物:超时放弃 → id,M 占位(续跑跳过 / build 侧 NaN 略过不污染分布)+ 实时 [MONSTER]。
                let monster = || {
                    cube_solver::executor::emit_event(&format!(
                        "[MONSTER] id={} timeout={}s scramble={}",
                        id,
                        timeout.unwrap_or(0),
                        alg
                    ));
                    format!("{},M", id)
                };
                // EPIC ④:并行(root-split 全核)。配超时 ⇒ 单条墙钟看门狗,≤N 秒超即怪物,绝不死等。
                if let Some(split) = solve_parallel_split() {
                    return match timeout {
                        Some(secs) => {
                            let deadline =
                                std::time::Instant::now() + std::time::Duration::from_secs(secs);
                            match w.solve_with_solution_parallel_deadline(&st, split, deadline) {
                                Some((cost, sol)) => row(cost, &sol),
                                None => monster(),
                            }
                        }
                        None => {
                            let (cost, sol) = w.solve_with_solution_parallel(&st, split);
                            row(cost, &sol)
                        }
                    };
                }
                // 串行(老路径)。超时 ⇒ 怪物超时分支(deadline 在 dfs 内 unwind,不毒化 TT)。
                if let Some(secs) = timeout {
                    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(secs);
                    return match w.solve_with_solution_deadline(&st, deadline) {
                        Some((cost, sol)) => row(cost, &sol),
                        None => monster(),
                    };
                }
                if use_wca_soln() {
                    let (cost, sol) = w.solve_with_solution(&st);
                    return row(cost, &sol);
                }
                return format!("{},{}", id, w.solve_wca(&st));
            }
            if use_exact() {
                let s = Sq1Solver::shared();
                // slash 行装配:有 soln 列则附 slash 最优等价打乱(= 解的逆,SQ1 简写,CSV 安全)。
                let row = |cost: u32, sol: &[Sq1Token]| -> String {
                    if use_slash_soln() {
                        format!("{},{},{}", id, cost, scramble_to_compact(&invert_scramble(sol)))
                    } else {
                        format!("{},{}", id, cost)
                    }
                };
                // 怪物超时:>N 秒放弃 → id,M 占位(续跑跳过 / build 侧 NaN 略过)+ 实时 [MONSTER]。
                if let Some(secs) = solve_timeout_secs() {
                    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(secs);
                    return match s.solve_with_solution_deadline(&st, deadline) {
                        Some((cost, sol)) => row(cost, &sol),
                        None => {
                            cube_solver::executor::emit_event(&format!(
                                "[MONSTER] id={} timeout={}s scramble={}",
                                id, secs, alg
                            ));
                            format!("{},M", id)
                        }
                    };
                }
                let (cost, sol) = s.solve_with_solution(&st);
                return row(cost, &sol);
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
        if use_compactify() {
            eprintln!("[INFO] sq1 COMPACTIFY (notation converter: id,scramble -> id,compact; no solve)");
        } else if use_slash_via_wca() {
            let _ = Sq1WcaSolver::shared_lite();
            eprintln!("[INFO] sq1 SLASH-VIA-WCA ready (provably slash-optimal via WCA geodesic; lite ~600MB, no 13GB jsq_full)");
        } else if use_wca_exact() {
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
        if use_compactify() {
            "id,compact".into()
        } else if use_slash_via_wca() {
            "id,slash_exact,opt_scramble".into()
        } else if use_wca_exact() {
            if use_wca_soln() { "id,wca_exact,opt_scramble".into() } else { "id,wca_exact".into() }
        } else if use_exact() {
            if use_slash_soln() { "id,slash_exact,opt_scramble".into() } else { "id,sq1".into() }
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
