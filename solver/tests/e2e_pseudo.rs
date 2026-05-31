//! e2e 集成测试:跑 pseudo_analyzer 二进制。
//!
//! 两个测试都 `#[ignore]`(避免默认 cargo test 跑出 ~415 MB / ~2.2 GB 表):
//!
//! `pseudo_analyzer_xxc_matches_golden_first5`(`cargo test --release -- --ignored`):
//!   - 跑 Cross + XCross + XXCross 共 18 列(需 ~415 MB 表,首次约 2-3 分钟)
//!   - 验证前 18 列 bit-exact + xxxcross 6 列占位 0 + 总列数 25
//!
//! `pseudo_analyzer_full_matches_golden_first5`(同 ignored,加 huge env):
//!   - 加 `CUBE_ALLOW_HUGE_TABLES=1`,全 24 列 bit-exact
//!   - 额外需 ~1.8 GB 表(pscross_E0E1E2 + C4C5C6)
//!
//! 表目录 `target/test-tables/e2e-pseudo-{xxc,full}/` 跨测试复用(不预清理)。

use std::path::PathBuf;
use std::process::{Command, Stdio};

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn target_binary() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_pseudo_analyzer"))
}

fn run_pseudo(table_dir_name: &str, work_dir_name: &str, allow_huge: bool) -> (PathBuf, PathBuf) {
    let root = project_root();
    let bin = target_binary();
    let testdata = root.join("testdata");
    let scramble = testdata.join("scramble_5.txt");
    assert!(scramble.exists(), "missing scramble: {}", scramble.display());

    // 表目录复用(huge tables 太贵不每次清)
    let table_dir = root.join("target").join("test-tables").join(table_dir_name);
    std::fs::create_dir_all(&table_dir).unwrap();

    let work_dir = root.join("target").join("test-tables").join(work_dir_name);
    let _ = std::fs::remove_dir_all(&work_dir);
    std::fs::create_dir_all(&work_dir).unwrap();
    let work_scramble = work_dir.join("scramble_5.txt");
    std::fs::copy(&scramble, &work_scramble).unwrap();

    let mut cmd = Command::new(&bin);
    cmd.current_dir(&work_dir)
        .env("CUBE_TABLE_DIR", &table_dir)
        .env_remove("CUBE_PSEUDO_SKIP_XCROSS")
        .env_remove("CUBE_PSEUDO_SKIP_XXCROSS")
        .env_remove("CUBE_PSEUDO_SKIP_XXXCROSS")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if allow_huge {
        cmd.env("CUBE_ALLOW_HUGE_TABLES", "1");
    } else {
        cmd.env_remove("CUBE_ALLOW_HUGE_TABLES");
    }

    let mut child = cmd.spawn().expect("spawn pseudo_analyzer");
    {
        use std::io::Write;
        let mut stdin = child.stdin.take().unwrap();
        writeln!(stdin, "scramble_5.txt").unwrap();
        writeln!(stdin, "exit").unwrap();
    }
    let output = child.wait_with_output().expect("wait pseudo_analyzer");
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "pseudo_analyzer exit={} stderr=\n{}",
        output.status,
        stderr
    );

    let out_path = work_dir.join("scramble_5_pseudo.csv");
    assert!(out_path.exists(), "missing csv: {}", out_path.display());
    (out_path, work_dir)
}

/// 验证前 5 行 × n_cols 列与 golden 一致。
/// `compare_cols` = 25 表示全部 24 列 + id;= 19 表示只比 id + Cross + XCross + XXCross。
/// 剩余列必须全 0。
fn assert_csv_matches(out_path: &PathBuf, compare_cols: usize) {
    let root = project_root();
    let golden = root
        .join("testdata")
        .join("golden")
        .join("scramble_5_pseudo_first5.csv");
    let got = std::fs::read_to_string(out_path).expect("read output");
    let golden_text = std::fs::read_to_string(&golden).expect("read golden");

    let got_lines: Vec<&str> = got.lines().collect();
    let golden_lines: Vec<&str> = golden_text.lines().collect();
    assert!(got_lines.len() >= 6, "expected >=6 lines, got {}", got_lines.len());
    assert!(golden_lines.len() >= 6);

    for i in 0..6 {
        let got_cols: Vec<&str> = got_lines[i].split(',').collect();
        let golden_cols: Vec<&str> = golden_lines[i].split(',').collect();
        assert_eq!(got_cols.len(), 25, "row {} should have 25 cols", i);
        if i == 0 {
            assert_eq!(got_cols, golden_cols, "header mismatch");
            continue;
        }
        let id = got_cols[0];
        assert_eq!(id, golden_cols[0], "id mismatch on row {}", i);
        for k in 1..compare_cols {
            assert_eq!(
                got_cols[k], golden_cols[k],
                "col {} mismatch id={} (got={:?} golden={:?})",
                k, id, got_cols, golden_cols
            );
        }
        for k in compare_cols..25 {
            assert_eq!(
                got_cols[k], "0",
                "col {} should be 0 (skipped phase), id={}",
                k, id
            );
        }
    }
}

#[test]
#[ignore]
fn pseudo_analyzer_xxc_matches_golden_first5() {
    let (out_path, work_dir) = run_pseudo("e2e-pseudo-xxc", "e2e-pseudo-xxc-work", false);
    // 19 列 = id + 6 cross + 6 xcross + 6 xxcross,后 6 列 xxxcross 必须 0
    assert_csv_matches(&out_path, 19);
    let _ = std::fs::remove_dir_all(&work_dir);
}

/// 全 cascade(包含 PsXXXCross)。需 ~1.8 GB huge tables。
#[test]
#[ignore]
fn pseudo_analyzer_full_matches_golden_first5() {
    let (out_path, work_dir) = run_pseudo("e2e-pseudo-full", "e2e-pseudo-full-work", true);
    // 全 25 列 bit-exact
    assert_csv_matches(&out_path, 25);
    let _ = std::fs::remove_dir_all(&work_dir);
}
