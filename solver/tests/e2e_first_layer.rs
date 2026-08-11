//! e2e：运行 first_layer_analyzer，锁定 12 列顺序并与库直查逐格比较。

use std::path::PathBuf;
use std::process::{Command, Stdio};

use cube_solver::block222_solver::ROTS6;
use cube_solver::cube_common::string_to_alg;
use cube_solver::first_layer_solver::FirstLayerSolver;

#[test]
fn first_layer_analyzer_matches_lib() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let bin = PathBuf::from(env!("CARGO_BIN_EXE_first_layer_analyzer"));
    let input_path = root.join("testdata").join("scramble_5.txt");
    let work_dir = root
        .join("target")
        .join("test-tables")
        .join("e2e-first-layer-work");
    let table_dir = root
        .join("target")
        .join("test-tables")
        .join("e2e-first-layer-tables");
    let _ = std::fs::remove_dir_all(&work_dir);
    let _ = std::fs::remove_dir_all(&table_dir);
    std::fs::create_dir_all(&work_dir).unwrap();
    std::fs::create_dir_all(&table_dir).unwrap();
    std::fs::copy(&input_path, work_dir.join("scramble_5.txt")).unwrap();

    let mut child = Command::new(&bin)
        .current_dir(&work_dir)
        .env("CUBE_TABLE_DIR", &table_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn first_layer_analyzer");
    {
        use std::io::Write;
        let mut stdin = child.stdin.take().unwrap();
        writeln!(stdin, "scramble_5.txt").unwrap();
        writeln!(stdin, "exit").unwrap();
    }
    let output = child.wait_with_output().expect("wait first_layer_analyzer");
    assert!(
        output.status.success(),
        "exit={} stderr=\n{}",
        output.status,
        String::from_utf8_lossy(&output.stderr)
    );

    let csv = std::fs::read_to_string(work_dir.join("scramble_5_first_layer.csv")).unwrap();
    let lines: Vec<&str> = csv.lines().collect();
    assert_eq!(
        lines[0],
        "id,first_face_z0,first_face_z2,first_face_z3,first_face_z1,first_face_x3,first_face_x1,\
         first_layer_z0,first_layer_z2,first_layer_z3,first_layer_z1,first_layer_x3,first_layer_x1"
    );
    assert_eq!(lines.len(), 6);

    std::env::set_var("CUBE_TABLE_DIR", &table_dir);
    let solver = FirstLayerSolver::new();
    let input = std::fs::read_to_string(&input_path).unwrap();
    for (line, source) in lines[1..].iter().zip(input.lines()) {
        let columns: Vec<&str> = line.split(',').collect();
        assert_eq!(columns.len(), 13);
        let comma = source.find(',').unwrap();
        assert_eq!(columns[0], &source[..comma]);
        let alg = string_to_alg(&source[comma + 1..]);
        let expected = solver.get_stats(&alg, &ROTS6);
        for (index, value) in expected.iter().enumerate() {
            assert_eq!(columns[index + 1].parse::<u32>().unwrap(), *value);
        }
    }

    let _ = std::fs::remove_dir_all(&work_dir);
    let _ = std::fs::remove_dir_all(&table_dir);
}
