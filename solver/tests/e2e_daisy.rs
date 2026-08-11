//! e2e 集成测试:跑 daisy_analyzer，核对 CSV 形状与库直查结果。

use std::path::PathBuf;
use std::process::{Command, Stdio};

use cube_solver::block222_solver::ROTS6;
use cube_solver::cube_common::string_to_alg;
use cube_solver::daisy_solver::DaisySolver;

#[test]
fn daisy_analyzer_matches_lib() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let bin = PathBuf::from(env!("CARGO_BIN_EXE_daisy_analyzer"));
    let scramble = root.join("testdata").join("scramble_5.txt");
    let work_dir = root
        .join("target")
        .join("test-tables")
        .join("e2e-daisy-work");
    let _ = std::fs::remove_dir_all(&work_dir);
    std::fs::create_dir_all(&work_dir).unwrap();
    std::fs::copy(&scramble, work_dir.join("scramble_5.txt")).unwrap();

    let mut child = Command::new(&bin)
        .current_dir(&work_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn daisy_analyzer");
    {
        use std::io::Write;
        let mut stdin = child.stdin.take().unwrap();
        writeln!(stdin, "scramble_5.txt").unwrap();
        writeln!(stdin, "exit").unwrap();
    }
    let output = child.wait_with_output().expect("wait daisy_analyzer");
    assert!(
        output.status.success(),
        "exit={} stderr=\n{}",
        output.status,
        String::from_utf8_lossy(&output.stderr)
    );

    let output_csv = work_dir.join("scramble_5_daisy.csv");
    let got = std::fs::read_to_string(&output_csv).unwrap();
    let lines: Vec<&str> = got.lines().collect();
    assert_eq!(
        lines[0],
        "id,daisy_z0,daisy_z2,daisy_z3,daisy_z1,daisy_x3,daisy_x1"
    );
    assert_eq!(lines.len(), 6);

    let solver = DaisySolver::new();
    let input = std::fs::read_to_string(&scramble).unwrap();
    for (line, source) in lines[1..].iter().zip(input.lines()) {
        let cols: Vec<&str> = line.split(',').collect();
        assert_eq!(cols.len(), 7);
        let comma = source.find(',').unwrap();
        assert_eq!(cols[0], &source[..comma]);
        let alg = string_to_alg(&source[comma + 1..]);
        let expected = solver.get_stats(&alg, &ROTS6);
        for (index, value) in expected.iter().enumerate() {
            assert_eq!(cols[index + 1].parse::<u32>().unwrap(), *value);
        }
    }

    let _ = std::fs::remove_dir_all(&work_dir);
}
