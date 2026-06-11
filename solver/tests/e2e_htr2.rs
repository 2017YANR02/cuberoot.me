//! e2e 集成测试:跑 htr_phase2_analyzer 二进制,验证 CSV 形状 + 与 lib 直查一致。
//!
//! HTR phase-2 是条件式阶段(输入须处于该视角 HTR / G3 陪集):
//!   - WCA 随机打乱(scramble_5.txt)全视角非 HTR → 全 `-`
//!   - G3 词打乱(htr2_5,内联,只用 6 双转 U2 D2 L2 R2 F2 B2)→ 全程在 G3,
//!     对任意旋转仍 HTR ⇒ 6 视角恒同值(非 htr 的"只 UD 轴 DR"),具体值锁 baseline

use std::path::PathBuf;
use std::process::{Command, Stdio};

use cube_solver::block222_solver::ROTS6;
use cube_solver::cube_common::string_to_alg;
use cube_solver::htr_phase2_solver::HtrPhase2Solver;

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

/// G3 词打乱(只 6 双转,保证全程在 G3 内):G3 态对任意旋转仍 HTR,
/// 故 6 视角全数值且恒同值。
const HTR_INPUT: &str = "\
h1,U2 R2 F2 D2 L2 B2 U2 D2 R2 F2
h2,F2 B2 U2 D2 L2 R2 F2 B2 U2 D2
h3,R2 L2 U2 D2 F2 B2 R2 L2 F2 U2
h4,U2 F2 R2 B2 L2 D2 U2 R2 F2 L2
h5,D2 R2 U2 L2 F2 R2 B2 U2 D2 F2
";

/// baseline 锁死(回归信号):G3 词的 HTR phase-2(G3→G4)最优步数。
/// G3 态对任意旋转仍 HTR ⇒ 6 视角同值(由 lib 直查写入)。
const HTR_BASELINE: [&str; 5] = [
    "h1,10,10,10,10,10,10",
    "h2,2,2,2,2,2,2",
    "h3,4,4,4,4,4,4",
    "h4,4,4,4,4,4,4",
    "h5,6,6,6,6,6,6",
];

fn fmt_cell(v: Option<u32>) -> String {
    match v {
        Some(d) => d.to_string(),
        None => "-".to_string(),
    }
}

#[test]
fn htr_phase2_analyzer_matches_lib() {
    let root = project_root();
    let bin = PathBuf::from(env!("CARGO_BIN_EXE_htr_phase2_analyzer"));
    let scramble = root.join("testdata").join("scramble_5.txt");
    assert!(scramble.exists(), "missing scramble: {}", scramble.display());

    let work_dir = root.join("target").join("test-tables").join("e2e-htr2-work");
    let _ = std::fs::remove_dir_all(&work_dir);
    std::fs::create_dir_all(&work_dir).unwrap();
    std::fs::copy(&scramble, work_dir.join("scramble_5.txt")).unwrap();
    std::fs::write(work_dir.join("htr2_5.txt"), HTR_INPUT).unwrap();

    let mut child = Command::new(&bin)
        .current_dir(&work_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn htr_phase2_analyzer");
    {
        use std::io::Write;
        let mut stdin = child.stdin.take().unwrap();
        writeln!(stdin, "scramble_5.txt").unwrap();
        writeln!(stdin, "htr2_5.txt").unwrap();
        writeln!(stdin, "exit").unwrap();
    }
    let output = child.wait_with_output().expect("wait htr_phase2_analyzer");
    assert!(
        output.status.success(),
        "exit={} stderr=\n{}",
        output.status,
        String::from_utf8_lossy(&output.stderr)
    );

    let s = HtrPhase2Solver::new();
    let header = "id,htr2_z0,htr2_z2,htr2_z3,htr2_z1,htr2_x3,htr2_x1";

    // --- WCA 随机打乱:全视角非 HTR → 全 `-`,且与 lib 直查一致 ---
    let got = std::fs::read_to_string(work_dir.join("scramble_5_htr2.csv")).expect("read output");
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
            assert_eq!(*w, None, "WCA scramble unexpectedly in HTR");
            assert_eq!(cols[k + 1], fmt_cell(*w), "col {} mismatch on {}", k + 1, cols[0]);
        }
    }

    // --- G3 词打乱:数值列与 lib 直查一致 + baseline 锁死 ---
    let got = std::fs::read_to_string(work_dir.join("htr2_5_htr2.csv")).expect("read output");
    let lines: Vec<&str> = got.lines().collect();
    assert_eq!(lines[0], header);
    assert_eq!(lines.len(), 6, "header + 5 rows");
    for ((line, src), base) in lines[1..].iter().zip(HTR_INPUT.lines()).zip(HTR_BASELINE) {
        assert_eq!(*line, base, "baseline mismatch");
        let cols: Vec<&str> = line.split(',').collect();
        assert_eq!(cols.len(), 7);
        let pos = src.find(',').unwrap();
        assert_eq!(cols[0], &src[..pos], "id mismatch");
        let alg = string_to_alg(&src[pos + 1..]);
        let want = s.get_stats(&alg, &ROTS6);
        // G3 词:全程在 G3,对任意旋转仍 HTR ⇒ 6 视角全数值且恒同值。
        assert!(want.iter().all(|w| w.is_some()), "G3 word must be HTR on all views");
        assert!(want.iter().all(|w| *w == want[0]), "G3 word: views must be identical");
        for (k, w) in want.iter().enumerate() {
            assert_eq!(cols[k + 1], fmt_cell(*w), "col {} mismatch on {}", k + 1, cols[0]);
        }
    }

    let _ = std::fs::remove_dir_all(&work_dir);
}
