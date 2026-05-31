//! e2e 集成测试:跑 std_analyzer 二进制(default 模式 = 仅 Cross 列),
//! 验证输出 CSV 的前 6 列(Cross)与 C++ golden bit-exact 一致,
//! 同时后 24 列(XCross+)为 0 占位。
//!
//! 用 `target/test-tables/e2e-std/` 隔离表目录,不污染 ./tables/。
//! 测试默认 `cargo test --release` 跑;debug 模式 IDA* 太慢不建议。

use std::path::PathBuf;
use std::process::{Command, Stdio};

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn target_binary() -> PathBuf {
    // CARGO_BIN_EXE_<name> 在集成测试构建时由 cargo 注入,绝对路径,指向当前 profile
    PathBuf::from(env!("CARGO_BIN_EXE_std_analyzer"))
}

#[test]
fn std_analyzer_cross_matches_golden_first5() {
    let root = project_root();
    let bin = target_binary();
    let testdata = root.join("testdata");
    let scramble = testdata.join("scramble_5.txt");
    let golden = testdata.join("golden").join("scramble_5_std_first5.csv");
    assert!(scramble.exists(), "missing scramble: {}", scramble.display());
    assert!(golden.exists(), "missing golden: {}", golden.display());

    // 隔离表目录(每次测试前清理)
    let table_dir = root.join("target").join("test-tables").join("e2e-cross");
    let _ = std::fs::remove_dir_all(&table_dir);
    std::fs::create_dir_all(&table_dir).unwrap();

    // 在隔离的临时工作目录跑 binary。binary 会把 csv 写到与 input 同目录,
    // 所以把 scramble 拷到 work_dir,然后输出在 work_dir/scramble_5_std.csv。
    let work_dir = root.join("target").join("test-tables").join("e2e-cross-work");
    let _ = std::fs::remove_dir_all(&work_dir);
    std::fs::create_dir_all(&work_dir).unwrap();
    let work_scramble = work_dir.join("scramble_5.txt");
    std::fs::copy(&scramble, &work_scramble).unwrap();

    // 跑:echo "scramble_5.txt\n" | std_analyzer.exe (cwd=work_dir, env CUBE_TABLE_DIR=隔离)
    let mut child = Command::new(&bin)
        .current_dir(&work_dir)
        .env("CUBE_TABLE_DIR", &table_dir)
        // 显式禁掉 XCross/Huge:默认即 disabled,但保险起见
        .env_remove("CUBE_RUN_FULL_STD")
        .env_remove("CUBE_ALLOW_HUGE_TABLES")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn std_analyzer");

    {
        use std::io::Write;
        let mut stdin = child.stdin.take().unwrap();
        // 第一行:文件名;第二行:exit
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

    // 解析 csv
    let out_path = work_dir.join("scramble_5_std.csv");
    assert!(out_path.exists(), "missing output csv: {}", out_path.display());
    let got = std::fs::read_to_string(&out_path).expect("read output");
    let golden_text = std::fs::read_to_string(&golden).expect("read golden");

    let got_lines: Vec<&str> = got.lines().collect();
    let golden_lines: Vec<&str> = golden_text.lines().collect();
    assert!(
        got_lines.len() >= 6,
        "expected at least 6 lines (header + 5 data), got {}",
        got_lines.len()
    );
    assert!(
        golden_lines.len() >= 6,
        "golden has only {} lines",
        golden_lines.len()
    );

    // 比较前 6 行的 前 13 列(id + 6 cross + 6 xcross)
    // golden 文件已经只到 xcross_x1(13 列),直接比即可
    for i in 0..6 {
        let got_cols: Vec<&str> = got_lines[i].split(',').take(13).collect();
        let golden_cols: Vec<&str> = golden_lines[i].split(',').collect();
        if i == 0 {
            // header
            assert_eq!(got_cols, golden_cols, "header mismatch");
            continue;
        }
        // data 行:cross 6 列必须 bit-exact;xcross 6 列(default 模式)必须全 0
        let id = got_cols[0];
        assert_eq!(id, golden_cols[0], "id mismatch on row {}", i);
        for k in 1..=6 {
            assert_eq!(
                got_cols[k], golden_cols[k],
                "cross col {} mismatch on id {} (got={:?} golden={:?})",
                k, id, got_cols, golden_cols
            );
        }
        for k in 7..=12 {
            assert_eq!(
                got_cols[k], "0",
                "xcross col {} should be 0 in default mode, id={}",
                k, id
            );
        }
    }

    // 额外:CSV 总列数应为 31(id + 5 阶段 * 6 列)
    for (i, line) in got_lines.iter().enumerate().skip(1).take(5) {
        let cnt = line.matches(',').count() + 1;
        assert_eq!(cnt, 31, "row {} has {} columns, expected 31", i, cnt);
    }

    // 清理
    let _ = std::fs::remove_dir_all(&table_dir);
    let _ = std::fs::remove_dir_all(&work_dir);
}
