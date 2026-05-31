//! e2e 集成测试:启用 XCross(env CUBE_RUN_FULL_STD=1,需 52 MB 表),
//! 跑 std_analyzer 验证 Cross + XCross 12 列全部匹配 golden。
//!
//! **默认 `#[ignore]`** —— 首次跑要 BFS 生成 52 MB pt_cross_C4E0,需要数分钟。
//! 用 `cargo test --release -- --ignored` 启用。
//!
//! 同样用隔离表目录 target/test-tables/e2e-xcross/(注意:测试完不删表,
//! 避免 re-run 时重复生成;手动 `cargo clean` 或删 target 即可清掉)。

use std::path::PathBuf;
use std::process::{Command, Stdio};

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn target_binary() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_std_analyzer"))
}

#[test]
#[ignore]
fn std_analyzer_xcross_matches_golden_first5() {
    let root = project_root();
    let bin = target_binary();
    let testdata = root.join("testdata");
    let scramble = testdata.join("scramble_5.txt");
    let golden = testdata.join("golden").join("scramble_5_std_first5.csv");
    assert!(scramble.exists());
    assert!(golden.exists());

    // 隔离表目录 — 但**不**预清理(52 MB 表可复用,避免每次 re-run 重生)
    let table_dir = root.join("target").join("test-tables").join("e2e-xcross");
    std::fs::create_dir_all(&table_dir).unwrap();

    let work_dir = root
        .join("target")
        .join("test-tables")
        .join("e2e-xcross-work");
    let _ = std::fs::remove_dir_all(&work_dir);
    std::fs::create_dir_all(&work_dir).unwrap();
    let work_scramble = work_dir.join("scramble_5.txt");
    std::fs::copy(&scramble, &work_scramble).unwrap();

    let mut child = Command::new(&bin)
        .current_dir(&work_dir)
        .env("CUBE_TABLE_DIR", &table_dir)
        .env("CUBE_RUN_FULL_STD", "1")
        .env_remove("CUBE_ALLOW_HUGE_TABLES")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn std_analyzer");

    {
        use std::io::Write;
        let mut stdin = child.stdin.take().unwrap();
        writeln!(stdin, "scramble_5.txt").unwrap();
        writeln!(stdin, "exit").unwrap();
    }
    let output = child.wait_with_output().expect("wait std_analyzer");
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "std_analyzer exit={} stderr=\n{}",
        output.status,
        stderr
    );

    let out_path = work_dir.join("scramble_5_std.csv");
    assert!(out_path.exists());
    let got = std::fs::read_to_string(&out_path).unwrap();
    let golden_text = std::fs::read_to_string(&golden).unwrap();
    let got_lines: Vec<&str> = got.lines().collect();
    let golden_lines: Vec<&str> = golden_text.lines().collect();

    for i in 0..6 {
        let got_cols: Vec<&str> = got_lines[i].split(',').take(13).collect();
        let golden_cols: Vec<&str> = golden_lines[i].split(',').collect();
        if i == 0 {
            assert_eq!(got_cols, golden_cols, "header mismatch");
            continue;
        }
        for k in 0..13 {
            assert_eq!(
                got_cols[k], golden_cols[k],
                "col {} mismatch on row {} (got={:?} golden={:?})",
                k, i, got_cols, golden_cols
            );
        }
    }

    // 清理 work dir(保留 table dir 以便后续 re-run)
    let _ = std::fs::remove_dir_all(&work_dir);
}
