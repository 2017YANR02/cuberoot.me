//! e2e 集成测试:跑 skewb_analyzer 二进制,验证 CSV 形状 + 与 lib 直查一致。
//!
//! skewb 是整解最优(口径 P4a 锁定:全空间 3,149,280 距离表直查,精确):
//! 任意 skewb 态都可解,输出 2 列 `id,skewb`,值 0..=11(God's number = 11),
//! 合法行永无 `-`(解析失败行才出 `-`)。
//!
//! 两组输入:
//!   - wca_skewb_5(真实 WCA skewb 打乱,Scrambles.tsv event `skewb` id 308-312)
//!     → baseline 锁死 + 与 SkewbSolver::solve_one 直查逐位一致
//!   - edge_5(记号边角:自消词 / 2 后缀 / 单 move / 异轴短词)→ 手算 baseline
//!     锁解析语义(X2 = X',自消归零,异轴不可消)

use std::path::PathBuf;
use std::process::{Command, Stdio};

use cube_solver::skewb_solver::{parse_skewb, SkewbSolver};

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

/// 真实 WCA skewb 打乱(Scrambles.tsv id 308-312,11 个大写 U/L/R/B ± ')。
const WCA_INPUT: &str = "\
w1,L R L' B R B' U B' U B L
w2,L R B R L' R' U' B' R L B
w3,L R' L B U' R L' U' R' B U'
w4,L R' L B L B R B U L R
w5,L R L' B' L' U L' B' L B U
";

/// baseline 锁死(回归信号):整解最优步数,与 lib 直查双重校验。
const WCA_BASELINE: [&str; 5] = ["w1,9", "w2,9", "w3,9", "w4,8", "w5,8"];

/// 记号边角:锁解析语义。
const EDGE_INPUT: &str = "\
e1,U U'
e2,B2 B
e3,R2
e4,U L
e5,U L' R B'
";

/// e1:自消词 → 0;e2:B2 = B' ⇒ B2 B = id → 0;e3:R2 = R' → 1;
/// e4:异轴两步不可消 → 2;e5:四异轴步无可消对 → 4(距离表锁死)。
const EDGE_BASELINE: [&str; 5] = ["e1,0", "e2,0", "e3,1", "e4,2", "e5,4"];

fn check_csv(path: &std::path::Path, input: &str, baseline: &[&str; 5]) -> Vec<u32> {
    let got = std::fs::read_to_string(path).expect("read output");
    let lines: Vec<&str> = got.lines().collect();
    assert_eq!(lines[0], "id,skewb");
    assert_eq!(lines.len(), 6, "header + 5 rows");
    let mut vals = Vec::new();
    for ((line, src), base) in lines[1..].iter().zip(input.lines()).zip(baseline) {
        assert_eq!(line, base, "baseline mismatch");
        let cols: Vec<&str> = line.split(',').collect();
        assert_eq!(cols.len(), 2, "exactly id + 1 value");
        let pos = src.find(',').unwrap();
        assert_eq!(cols[0], &src[..pos], "id mismatch");
        let v: u32 = cols[1].parse().expect("skewb value must be a number");
        assert!(v <= 11, "above God's number: {}", v);
        vals.push(v);
    }
    vals
}

#[test]
fn skewb_analyzer_matches_lib() {
    let root = project_root();
    let bin = PathBuf::from(env!("CARGO_BIN_EXE_skewb_analyzer"));

    let work_dir = root.join("target").join("test-tables").join("e2e-skewb-work");
    let _ = std::fs::remove_dir_all(&work_dir);
    std::fs::create_dir_all(&work_dir).unwrap();
    std::fs::write(work_dir.join("wca_skewb_5.txt"), WCA_INPUT).unwrap();
    std::fs::write(work_dir.join("edge_5.txt"), EDGE_INPUT).unwrap();

    let mut child = Command::new(&bin)
        .current_dir(&work_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn skewb_analyzer");
    {
        use std::io::Write;
        let mut stdin = child.stdin.take().unwrap();
        writeln!(stdin, "wca_skewb_5.txt").unwrap();
        writeln!(stdin, "edge_5.txt").unwrap();
        writeln!(stdin, "exit").unwrap();
    }
    let output = child.wait_with_output().expect("wait skewb_analyzer");
    assert!(
        output.status.success(),
        "exit={} stderr=\n{}",
        output.status,
        String::from_utf8_lossy(&output.stderr)
    );

    // --- WCA 打乱:形状 + baseline + lib 直查逐位一致 ---
    let vals = check_csv(&work_dir.join("wca_skewb_5_skewb.csv"), WCA_INPUT, &WCA_BASELINE);
    let s = SkewbSolver::new();
    for (v, src) in vals.iter().zip(WCA_INPUT.lines()) {
        let pos = src.find(',').unwrap();
        let alg = parse_skewb(&src[pos + 1..]).expect("WCA scramble must parse");
        assert_eq!(*v, s.solve_one(&alg), "lib direct query mismatch on {}", &src[..pos]);
    }

    // --- 记号边角:形状 + 手算 baseline ---
    let vals = check_csv(&work_dir.join("edge_5_skewb.csv"), EDGE_INPUT, &EDGE_BASELINE);
    for (v, src) in vals.iter().zip(EDGE_INPUT.lines()) {
        let pos = src.find(',').unwrap();
        let alg = parse_skewb(&src[pos + 1..]).expect("edge case must parse");
        assert_eq!(*v, s.solve_one(&alg), "lib direct query mismatch on {}", &src[..pos]);
    }

    let _ = std::fs::remove_dir_all(&work_dir);
}
