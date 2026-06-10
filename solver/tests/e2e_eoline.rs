//! e2e 集成测试:跑 eoline_analyzer 二进制,验证 CSV 形状 + 与 lib 直查一致。

use std::path::PathBuf;
use std::process::{Command, Stdio};

use cube_solver::block222_solver::ROTS6;
use cube_solver::cube_common::string_to_alg;
use cube_solver::eoline_solver::EOLineSolver;

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

#[test]
fn eoline_analyzer_matches_lib() {
    let root = project_root();
    let bin = PathBuf::from(env!("CARGO_BIN_EXE_eoline_analyzer"));
    let scramble = root.join("testdata").join("scramble_5.txt");
    assert!(scramble.exists(), "missing scramble: {}", scramble.display());

    let work_dir = root.join("target").join("test-tables").join("e2e-eoline-work");
    let _ = std::fs::remove_dir_all(&work_dir);
    std::fs::create_dir_all(&work_dir).unwrap();
    std::fs::copy(&scramble, work_dir.join("scramble_5.txt")).unwrap();

    let mut child = Command::new(&bin)
        .current_dir(&work_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn eoline_analyzer");
    {
        use std::io::Write;
        let mut stdin = child.stdin.take().unwrap();
        writeln!(stdin, "scramble_5.txt").unwrap();
        writeln!(stdin, "exit").unwrap();
    }
    let output = child.wait_with_output().expect("wait eoline_analyzer");
    assert!(
        output.status.success(),
        "exit={} stderr=\n{}",
        output.status,
        String::from_utf8_lossy(&output.stderr)
    );

    let out_path = work_dir.join("scramble_5_eoline.csv");
    let got = std::fs::read_to_string(&out_path).expect("read output");
    let lines: Vec<&str> = got.lines().collect();
    assert_eq!(
        lines[0],
        "id,eo_z0,eo_z2,eo_z3,eo_z1,eo_x3,eo_x1,\
         eoline_z0,eoline_z2,eoline_z3,eoline_z1,eoline_x3,eoline_x1"
    );
    assert_eq!(lines.len(), 6, "header + 5 rows");

    let s = EOLineSolver::new();
    let input = std::fs::read_to_string(&scramble).unwrap();
    for (line, src) in lines[1..].iter().zip(input.lines()) {
        let cols: Vec<&str> = line.split(',').collect();
        assert_eq!(cols.len(), 13);
        let pos = src.find(',').unwrap();
        assert_eq!(cols[0], &src[..pos], "id mismatch");
        let alg = string_to_alg(&src[pos + 1..]);
        let want: Vec<u32> = s
            .get_stats_eo(&alg, &ROTS6)
            .into_iter()
            .chain(s.get_stats(&alg, &ROTS6))
            .collect();
        for (k, w) in want.iter().enumerate() {
            assert_eq!(
                cols[k + 1].parse::<u32>().unwrap(),
                *w,
                "col {} mismatch on {}",
                k + 1,
                cols[0]
            );
        }
    }

    let _ = std::fs::remove_dir_all(&work_dir);
}
