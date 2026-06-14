//! pocket_analyzer binary:2x2x2 口袋魔方整解最优步数分析器。
//!
//! 输出 2 列 CSV(id + 1 值):
//!   - pocket:该打乱的整解最优 HTM 步数(0..=11,God's number = 11)。
//!
//! 语义(异于 3x3 的条件式多视角阶段):2x2x2 任意态都可解,单值、无视角列、无 `-`。
//! 输入支持全 18 种 3x3 面转记号(WCA 222 打乱只用 U/R/F,但稳妥起见全收):
//! 2x2x2 无中心,D/L/B 与对面转只差整体旋转(D = y'·U / L = x'·R / B = z'·F)。
//! 求解前把末态归一到固定 DBL 帧:在 24 个整体旋转里找唯一使 DBL 角归位归向者
//! (旋转对角的作用 = move 对:x = R L'、y = U D'、z = F B',中层只动棱/中心,
//! 不影响角),拼到打乱尾部后查 pocket_solver 全空间精确表。

use std::sync::OnceLock;

use cube_solver::cube_common::{move_state, Move, State};
use cube_solver::executor::{run_analyzer_app, SolverWrapper};
use cube_solver::pocket_solver::{PocketSolver, POCKET_MOVES};

static S: OnceLock<PocketSolver> = OnceLock::new();

/// 是否追加第 3 列「一条最优解」(逆之即最优等价打乱)。默认关(保持 2 列、旧消费者与
/// 单测不变);打乱统计管道设 `PUZZLE_EMIT_SOLN=1` 时打开。
fn emit_soln() -> bool {
    std::env::var("PUZZLE_EMIT_SOLN").is_ok()
}

/// 固定 DBL 角 = U/R/F 都不动(位置 + 朝向)的唯一角(与 pocket_solver 同式独立推导)。
fn fixed_corner() -> usize {
    static V: OnceLock<usize> = OnceLock::new();
    *V.get_or_init(|| {
        let mut fixed = usize::MAX;
        for c in 0..8usize {
            let untouched = POCKET_MOVES.iter().all(|&m| {
                let (cp, co) = move_state(Move::from_index(m as usize)).cp_co();
                cp[c] == c as u8 && co[c] == 0
            });
            if untouched {
                assert_eq!(fixed, usize::MAX, "more than one fixed corner");
                fixed = c;
            }
        }
        assert_ne!(fixed, usize::MAX, "no fixed corner under U/R/F");
        fixed
    })
}

/// 24 个整体旋转的等价 move 词(只取其对角的作用):{ε,x,x2,x',z,z'} × {ε,y,y2,y'}。
/// 前组把 6 个面轮流转到顶,后组绕竖轴自旋,穷举互异的 24 个旋转;首项为空词。
fn rot24() -> &'static Vec<Vec<Move>> {
    static V: OnceLock<Vec<Vec<Move>>> = OnceLock::new();
    V.get_or_init(|| {
        use Move::*;
        let a: [&[Move]; 6] = [
            &[],
            &[R, LPrime],  // x
            &[R2, L2],     // x2
            &[RPrime, L],  // x'
            &[F, BPrime],  // z
            &[FPrime, B],  // z'
        ];
        let b: [&[Move]; 4] = [&[], &[U, DPrime], &[U2, D2], &[UPrime, D]];
        let mut out = Vec::with_capacity(24);
        for x in a {
            for y in b {
                let mut w = x.to_vec();
                w.extend_from_slice(y);
                out.push(w);
            }
        }
        out
    })
}

/// 把任意 18-move 打乱归一到固定 DBL 帧:返回 (打乱 + 整体旋转词),DBL 在该词后归位归向。
/// 整体旋转不改最优解长(解经共轭等长),归一后 DBL 在家,坐标投影合法。WCA 222 打乱只用
/// U/R/F → DBL 本就不动 → 旋转词为空 → 归一结果 = 原打乱(解/逆解与原打乱同朝向)。
fn normalized(alg: &[Move]) -> Vec<Move> {
    let mut st = State::SOLVED;
    for &m in alg {
        st.apply(m);
    }
    let fixed = fixed_corner();
    for w in rot24() {
        let mut st2 = st;
        for &m in w {
            st2.apply(m);
        }
        let (cp, co) = st2.cp_co();
        if cp[fixed] as usize == fixed && co[fixed] == 0 {
            let mut full = alg.to_vec();
            full.extend_from_slice(w);
            return full;
        }
    }
    unreachable!("no whole-cube rotation fixes the DBL corner");
}

/// 任意 18-move 打乱的 2x2x2 最优 HTM 步数:先归一到固定 DBL 帧再查表。
fn pocket_len(s: &PocketSolver, alg: &[Move]) -> u32 {
    s.solve_one(&normalized(alg))
}

struct PocketWrapper;

impl SolverWrapper for PocketWrapper {
    fn global_init() {
        let s = S.get_or_init(PocketSolver::new);
        eprintln!("[INFO] pocket table ready (max depth {})", s.max_depth());
    }

    fn get_csv_header() -> String {
        if emit_soln() { "id,pocket,soln".into() } else { "id,pocket".into() }
    }

    fn solve(alg: &[Move], id: &str) -> String {
        let s = S.get().unwrap();
        let len = pocket_len(s, alg);
        if !emit_soln() {
            return format!("{},{}", id, len);
        }
        // 第 3 列:一条最优解(归一帧下 URF 记号串);逆之即「最优等价打乱」。
        let soln = s
            .enumerate(&normalized(alg))
            .moves
            .iter()
            .map(|&m| Move::from_index(m as usize).name())
            .collect::<Vec<_>>()
            .join(" ");
        format!("{},{},{}", id, len, soln)
    }
}

fn main() {
    cube_solver::logo::print_logo_block();
    run_analyzer_app::<PocketWrapper>("_pocket");
}

#[cfg(test)]
mod tests {
    use super::*;
    use cube_solver::cube_common::{alg_rotation, string_to_alg};

    fn solver() -> &'static PocketSolver {
        S.get_or_init(PocketSolver::new)
    }

    fn lcg(x: u64) -> u64 {
        x.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407)
    }

    /// 确定性伪随机词(给定 move 池)。
    fn pseudo_word(seed: u64, len: usize, pool: &[u8]) -> Vec<Move> {
        let mut x = lcg(seed);
        let mut out = Vec::with_capacity(len);
        for _ in 0..len {
            x = lcg(x);
            out.push(Move::from_index(pool[(x >> 33) as usize % pool.len()] as usize));
        }
        out
    }

    fn pseudo_scramble(seed: u64, len: usize) -> Vec<Move> {
        let all: Vec<u8> = (0..18u8).collect();
        pseudo_word(seed, len, &all)
    }

    #[test]
    fn pa_basics() {
        let s = solver();

        // rot24 是 24 个互异旋转(末态角排列互异),首项为空词
        assert_eq!(rot24().len(), 24);
        assert!(rot24()[0].is_empty());
        let mut ends: Vec<[u8; 8]> = rot24()
            .iter()
            .map(|w| {
                let mut st = State::SOLVED;
                for &m in w {
                    st.apply(m);
                }
                st.corners
            })
            .collect();
        ends.sort();
        ends.dedup();
        assert_eq!(ends.len(), 24, "rot24 not all distinct");

        // 空打乱 / 纯旋转词 = 0
        assert_eq!(pocket_len(s, &[]), 0);
        for w in rot24() {
            assert_eq!(pocket_len(s, w), 0, "pure rotation word must be 0");
        }

        // 全 18 个单 move = 1(D/L/B 与对面只差整体旋转)
        for m in Move::ALL {
            assert_eq!(pocket_len(s, &[m]), 1, "single move {}", m.name());
        }

        // 手算等价(D/L/B 语义锁定):
        // D U' = 整体 y' 旋转 → 0;L2 R2 = x2 旋转,再 U2 → 1;
        // R L' U D' F B' = x·y·z 三个旋转复合 → 0。
        assert_eq!(pocket_len(s, &string_to_alg("D U'")), 0);
        assert_eq!(pocket_len(s, &string_to_alg("L2 R2 U2")), 1);
        assert_eq!(pocket_len(s, &string_to_alg("R L' U D' F B'")), 0);
    }

    /// URF-only 词(WCA 222 打乱形态):归一应为恒等,与 solver 直查逐位一致。
    #[test]
    fn pa_urf_passthrough() {
        let s = solver();
        for seed in 0..60u64 {
            let len = 1 + (seed as usize) % 14;
            let alg = pseudo_word(3000 + seed, len, &POCKET_MOVES);
            assert_eq!(pocket_len(s, &alg), s.solve_one(&alg), "seed={}", seed);
        }
    }

    /// 独立预言机(金标准):IDDFS(9 个 URF move)从打乱角态搜「24 个旋转后的
    /// solved 角态」之一,不经归一逻辑、不经距离表 → 锁 D/L/B 归一正确性。
    #[test]
    fn pa_full18_matches_iddfs_oracle() {
        let s = solver();
        let goals: Vec<[u8; 8]> = rot24()
            .iter()
            .map(|w| {
                let mut st = State::SOLVED;
                for &m in w {
                    st.apply(m);
                }
                st.corners
            })
            .collect();

        fn dfs(st: &State, depth: u32, prev: i32, goals: &[[u8; 8]]) -> bool {
            if depth == 0 {
                return goals.contains(&st.corners);
            }
            for &mv in &POCKET_MOVES {
                let m = mv as usize;
                if prev >= 0 && m / 3 == prev as usize / 3 {
                    continue; // 同面剪枝(U/R/F 两两相邻,禁同面即可保最优)
                }
                let ns = st.applied(Move::from_index(m));
                if dfs(&ns, depth - 1, m as i32, goals) {
                    return true;
                }
            }
            false
        }

        for seed in 0..40u64 {
            let len = 1 + (seed as usize) % 5;
            let alg = pseudo_scramble(7000 + seed, len);
            let mut st = State::SOLVED;
            for &m in &alg {
                st.apply(m);
            }
            let got = pocket_len(s, &alg);
            // 每个面转(含 D/L/B)等价 1 个 pocket move ⇒ dist ≤ len ≤ 5
            assert!(got as usize <= len, "seed={} got={} len={}", seed, got, len);
            let mut want = u32::MAX;
            for dd in 0..=len as u32 {
                if dfs(&st, dd, -1, &goals) {
                    want = dd;
                    break;
                }
            }
            assert_eq!(got, want, "seed={} alg={:?}", seed, alg);
        }
    }

    /// 视角旋转不变性:共轭打乱(整体换视角)最优步数不变。
    #[test]
    fn pa_rotation_invariance() {
        let s = solver();
        for seed in 0..20u64 {
            let len = 3 + (seed as usize) % 10;
            let alg = pseudo_scramble(9000 + seed, len);
            let base = pocket_len(s, &alg);
            for r in ["x", "y", "y'", "z2", "x y", "z y'"] {
                let mut buf: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
                alg_rotation(&mut buf, r);
                let ralg: Vec<Move> = buf.iter().map(|&m| Move::from_index(m as usize)).collect();
                assert_eq!(pocket_len(s, &ralg), base, "seed={} rot={}", seed, r);
            }
        }
    }
}
