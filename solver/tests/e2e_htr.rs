//! e2e 集成测试:跑 htr_analyzer 二进制,验证 CSV 形状 + 与 lib 直查一致。
//!
//! HTR 是条件式阶段(输入须处于该视角 DR):
//!   - WCA 随机打乱(scramble_5.txt)全视角非 DR → 全 `-`
//!   - G2 词打乱(dr_5,内联)→ z0≡z2 数值,其余轴 `-`,具体值锁 baseline

use std::path::PathBuf;
use std::process::{Command, Stdio};

use cube_solver::block222_solver::ROTS6;
use cube_solver::cube_common::string_to_alg;
use cube_solver::htr_solver::HtrSolver;

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

const DR_INPUT: &str = "\
h1,U L2 F2 D' R2 B2 U2 L2 U' B2 F2 U R2 F2 D' L2 B2 D2
h2,D2 R2 U' F2 L2 D B2 U2 F2 D' L2 U F2 R2 D2 B2 U' L2
h3,U' B2 D2 L2 F2 U R2 U2 D' F2 L2 B2 U' D2 R2 F2 U2 D
h4,F2 U R2 D' B2 L2 U2 R2 D L2 U' F2 D2 B2 R2 U D' F2
h5,R2 D' F2 U' L2 B2 D R2 U2 B2 D' L2 F2 U R2 B2 D2 U'
";

/// baseline 锁死(回归信号):G2 词的 DR→HTR 最优步数,z0≡z2(HTR 仅依赖轴)。
const DR_BASELINE: [&str; 5] = [
    "h1,7,7,-,-,-,-",
    "h2,10,10,-,-,-,-",
    "h3,6,6,-,-,-,-",
    "h4,6,6,-,-,-,-",
    "h5,10,10,-,-,-,-",
];

fn fmt_cell(v: Option<u32>) -> String {
    match v {
        Some(d) => d.to_string(),
        None => "-".to_string(),
    }
}

#[test]
fn htr_analyzer_matches_lib() {
    let root = project_root();
    let bin = PathBuf::from(env!("CARGO_BIN_EXE_htr_analyzer"));
    let scramble = root.join("testdata").join("scramble_5.txt");
    assert!(scramble.exists(), "missing scramble: {}", scramble.display());

    let work_dir = root.join("target").join("test-tables").join("e2e-htr-work");
    let _ = std::fs::remove_dir_all(&work_dir);
    std::fs::create_dir_all(&work_dir).unwrap();
    std::fs::copy(&scramble, work_dir.join("scramble_5.txt")).unwrap();
    std::fs::write(work_dir.join("dr_5.txt"), DR_INPUT).unwrap();

    let mut child = Command::new(&bin)
        .current_dir(&work_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn htr_analyzer");
    {
        use std::io::Write;
        let mut stdin = child.stdin.take().unwrap();
        writeln!(stdin, "scramble_5.txt").unwrap();
        writeln!(stdin, "dr_5.txt").unwrap();
        writeln!(stdin, "exit").unwrap();
    }
    let output = child.wait_with_output().expect("wait htr_analyzer");
    assert!(
        output.status.success(),
        "exit={} stderr=\n{}",
        output.status,
        String::from_utf8_lossy(&output.stderr)
    );

    let s = HtrSolver::new();
    let header = "id,htr_z0,htr_z2,htr_z3,htr_z1,htr_x3,htr_x1";

    // --- WCA 随机打乱:全视角非 DR → 全 `-`,且与 lib 直查一致 ---
    let got = std::fs::read_to_string(work_dir.join("scramble_5_htr.csv")).expect("read output");
    let lines: Vec<&str> = got.lines().collect();
    assert_eq!(lines[0], header);
    assert_eq!(lines.len(), 6, "header + 5 rows");
    let input = std::fs::read_to_string(&scramble).unwrap();
    for (line, src) in lines[1..].iter().zip(input.lines()) {
        let cols: Vec<&str> = line.split(',').collect();
        assert_eq!(cols.len(), 7);
        let pos = src.find(',').unwrap();
        assert_eq!(cols[0], &src[..pos], "id mismatch");
        let alg = string_to_alg(&src[pos + 1..]);
        let want = s.get_stats(&alg, &ROTS6);
        for (k, w) in want.iter().enumerate() {
            assert_eq!(*w, None, "WCA scramble unexpectedly in DR");
            assert_eq!(cols[k + 1], fmt_cell(*w), "col {} mismatch on {}", k + 1, cols[0]);
        }
    }

    // --- G2 词打乱:数值列与 lib 直查一致 + baseline 锁死 ---
    let got = std::fs::read_to_string(work_dir.join("dr_5_htr.csv")).expect("read output");
    let lines: Vec<&str> = got.lines().collect();
    assert_eq!(lines[0], header);
    assert_eq!(lines.len(), 6, "header + 5 rows");
    for ((line, src), base) in lines[1..].iter().zip(DR_INPUT.lines()).zip(DR_BASELINE) {
        assert_eq!(*line, base, "baseline mismatch");
        let cols: Vec<&str> = line.split(',').collect();
        assert_eq!(cols.len(), 7);
        let pos = src.find(',').unwrap();
        assert_eq!(cols[0], &src[..pos], "id mismatch");
        let alg = string_to_alg(&src[pos + 1..]);
        let want = s.get_stats(&alg, &ROTS6);
        // G2 词:UD 轴必为 DR(z0/z2 数值),其余轴本批全非 DR
        assert!(want[0].is_some() && want[1].is_some(), "G2 word must be DR on UD axis");
        assert_eq!(want[0], want[1], "z0 != z2 (HTR axis invariance)");
        for (k, w) in want.iter().enumerate() {
            assert_eq!(cols[k + 1], fmt_cell(*w), "col {} mismatch on {}", k + 1, cols[0]);
        }
    }

    let _ = std::fs::remove_dir_all(&work_dir);
}
