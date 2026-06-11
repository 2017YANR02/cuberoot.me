//! e2e 集成测试:跑 pyraminx_analyzer 二进制,验证 CSV 形状 + 与 lib 直查一致。
//!
//! pyraminx 是整解最优(口径 P3a 锁定:总 HTM = 核心查表最优 + #错位 tips,精确):
//! 任意 pyram 态都可解,输出 2 列 `id,pyraminx`,值 0..=15(God's number 含 tips
//! = 15),合法行永无 `-`(解析失败行才出 `-`)。
//!
//! 两组输入:
//!   - wca_pyram_5(WCA pyram 打乱形态:10 个大写 U/L/R/B ± ' + 0-3 个小写
//!     tip u/l/r/b ± ')→ baseline 锁死 + 与 PyraminxSolver::solve_one 直查逐位一致
//!   - edge_5(记号边角:自消词 / 纯 tips / 2 后缀 / 大小写混合)→ 手算 baseline
//!     锁解析语义(X2 = X',单大写带动同轴 tip,坏 tip 逐个 +1)

use std::path::PathBuf;
use std::process::{Command, Stdio};

use cube_solver::pyraminx_solver::{parse_pyraminx, PyraminxSolver};

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

/// WCA pyram 打乱形态(10 大写 + 末尾小写 tips)。
const WCA_INPUT: &str = "\
w1,U' L R' B U' R L' B' U R' l r' b
w2,B U' B L' R B' R' U L' R u' l' r
w3,R' L B' U L' B U' B' R L' u b'
w4,L R' U B' U' L' R B' L U' l' b
w5,U B' R L' B U' R' L B' U r b'
";

/// baseline 锁死(回归信号):整解最优步数,与 lib 直查双重校验。
const WCA_BASELINE: [&str; 5] = ["w1,10", "w2,11", "w3,10", "w4,11", "w5,11"];

/// 记号边角:锁解析语义。
const EDGE_INPUT: &str = "\
e1,U U'
e2,u l' r b'
e3,R2 R
e4,U u'
e5,B2 L' b2 u'
";

/// e1:自消词 → 0;e2:四 tip 全错 → 4;e3:R2 = R' ⇒ R2 R = id → 0;
/// e4:核心 1 + 坏 tip 1 → 2;e5:核心 B' L' = 2 + 坏 tip b,u = 2 → 4。
const EDGE_BASELINE: [&str; 5] = ["e1,0", "e2,4", "e3,0", "e4,2", "e5,4"];

fn check_csv(path: &std::path::Path, input: &str, baseline: &[&str; 5]) -> Vec<u32> {
    let got = std::fs::read_to_string(path).expect("read output");
    let lines: Vec<&str> = got.lines().collect();
    assert_eq!(lines[0], "id,pyraminx");
    assert_eq!(lines.len(), 6, "header + 5 rows");
    let mut vals = Vec::new();
    for ((line, src), base) in lines[1..].iter().zip(input.lines()).zip(baseline) {
        assert_eq!(line, base, "baseline mismatch");
        let cols: Vec<&str> = line.split(',').collect();
        assert_eq!(cols.len(), 2, "exactly id + 1 value");
        let pos = src.find(',').unwrap();
        assert_eq!(cols[0], &src[..pos], "id mismatch");
        let v: u32 = cols[1].parse().expect("pyraminx value must be a number");
        assert!(v <= 15, "above God's number incl tips: {}", v);
        vals.push(v);
    }
    vals
}

#[test]
fn pyraminx_analyzer_matches_lib() {
    let root = project_root();
    let bin = PathBuf::from(env!("CARGO_BIN_EXE_pyraminx_analyzer"));

    let work_dir = root.join("target").join("test-tables").join("e2e-pyraminx-work");
    let _ = std::fs::remove_dir_all(&work_dir);
    std::fs::create_dir_all(&work_dir).unwrap();
    std::fs::write(work_dir.join("wca_pyram_5.txt"), WCA_INPUT).unwrap();
    std::fs::write(work_dir.join("edge_5.txt"), EDGE_INPUT).unwrap();

    let mut child = Command::new(&bin)
        .current_dir(&work_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn pyraminx_analyzer");
    {
        use std::io::Write;
        let mut stdin = child.stdin.take().unwrap();
        writeln!(stdin, "wca_pyram_5.txt").unwrap();
        writeln!(stdin, "edge_5.txt").unwrap();
        writeln!(stdin, "exit").unwrap();
    }
    let output = child.wait_with_output().expect("wait pyraminx_analyzer");
    assert!(
        output.status.success(),
        "exit={} stderr=\n{}",
        output.status,
        String::from_utf8_lossy(&output.stderr)
    );

    // --- WCA 打乱:形状 + baseline + lib 直查逐位一致 ---
    let vals = check_csv(&work_dir.join("wca_pyram_5_pyraminx.csv"), WCA_INPUT, &WCA_BASELINE);
    let s = PyraminxSolver::new();
    for (v, src) in vals.iter().zip(WCA_INPUT.lines()) {
        let pos = src.find(',').unwrap();
        let alg = parse_pyraminx(&src[pos + 1..]).expect("WCA scramble must parse");
        assert_eq!(*v, s.solve_one(&alg), "lib direct query mismatch on {}", &src[..pos]);
    }

    // --- 记号边角:形状 + 手算 baseline ---
    let vals = check_csv(&work_dir.join("edge_5_pyraminx.csv"), EDGE_INPUT, &EDGE_BASELINE);
    for (v, src) in vals.iter().zip(EDGE_INPUT.lines()) {
        let pos = src.find(',').unwrap();
        let alg = parse_pyraminx(&src[pos + 1..]).expect("edge case must parse");
        assert_eq!(*v, s.solve_one(&alg), "lib direct query mismatch on {}", &src[..pos]);
    }

    let _ = std::fs::remove_dir_all(&work_dir);
}
