//! e2e 回归测试:大表版 f2leo / pseudo_f2leo 与小表版 **逐格 bit-exact**。
//!
//! 大表版(`F2leoBigSolver` / `PseudoF2leoBigSolver`)用更强的联合大表 / pt_pscross_C4E
//! 启发式 + 叶子自由棱 EO 门控,输出必须与小表版(`F2leoSolver` / `PseudoF2leoSolver`)
//! 完全相同(仅访问节点远少)。本测试 spawn 同一 analyzer 两种模式对拍。
//!
//! **默认 `#[ignore]`**(需表 + 较慢):`cargo test --release -- --ignored`。
//!   - pseudo:在隔离 table 目录现场生成 4×54 MB pt_pscross_C4E(首次 ~2 min),自洽可跑。
//!   - f2leo:需 2×10 GB pair huge 表 —— 仅当 `solver/tables/` 已有这两张表时才跑,
//!     否则 skip(生成 20 GB 不现实);用真实表目录对拍。

use std::path::PathBuf;
use std::process::{Command, Stdio};

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

/// 跑一次 analyzer:把 scramble 文件喂 stdin,返回输出 CSV 的行。
fn run_analyzer(bin: &PathBuf, table_dir: &PathBuf, work_dir: &PathBuf, scramble_name: &str, out_name: &str, envs: &[(&str, &str)]) -> Vec<String> {
    let mut cmd = Command::new(bin);
    cmd.current_dir(work_dir)
        .env("CUBE_TABLE_DIR", table_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    // 先清掉所有相关 toggle,再按需设置,避免外部环境串扰。
    cmd.env_remove("CUBE_ALLOW_HUGE_TABLES");
    cmd.env_remove("CUBE_F2LEO_FORCE_SMALL");
    for &(k, v) in envs {
        cmd.env(k, v);
    }
    let mut child = cmd.spawn().expect("spawn analyzer");
    {
        use std::io::Write;
        let mut stdin = child.stdin.take().unwrap();
        writeln!(stdin, "{scramble_name}").unwrap();
        writeln!(stdin, "exit").unwrap();
    }
    let output = child.wait_with_output().expect("wait analyzer");
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(output.status.success(), "analyzer exit={} stderr=\n{}", output.status, stderr);
    let out_path = work_dir.join(out_name);
    assert!(out_path.exists(), "no output {}", out_path.display());
    std::fs::read_to_string(&out_path).unwrap().lines().map(|s| s.to_string()).collect()
}

fn assert_bit_exact(big: &[String], small: &[String]) {
    assert_eq!(big.len(), small.len(), "row count mismatch");
    let mut diffs = 0;
    for (i, (b, s)) in big.iter().zip(small.iter()).enumerate() {
        if b != s {
            diffs += 1;
            if diffs <= 3 {
                eprintln!("row {i} mismatch:\n  big  ={b}\n  small={s}");
            }
        }
    }
    assert_eq!(diffs, 0, "{diffs} rows differ between big and small");
}

/// pseudo_f2leo:大表电池(C4E + corner2/3 + edge2/3,含 E0E1E2 1GB / C4C5C6 862MB)vs 小表。
/// 仅当真实 huge 电池表已存在时跑(否则 skip;生成 ~2GB 不现实);用真实表目录对拍。
#[test]
#[ignore]
fn pseudo_f2leo_big_matches_small() {
    let root = project_root();
    let real_tables = root.join("tables");
    let e3 = real_tables.join("pt_pscross_E0E1E2.bin");
    let c3 = real_tables.join("pt_pscross_C4C5C6.bin");
    if !e3.exists() || !c3.exists() {
        eprintln!("[SKIP] pseudo_f2leo_big_matches_small: huge battery tables absent at {}", real_tables.display());
        return;
    }
    let bin = PathBuf::from(env!("CARGO_BIN_EXE_pseudo_f2leo_analyzer"));
    let work = root.join("target").join("test-tables").join("e2e-pseudo-f2leo-work");
    let _ = std::fs::remove_dir_all(&work);
    std::fs::create_dir_all(&work).unwrap();
    std::fs::copy(root.join("testdata").join("scramble_100.txt"), work.join("s.txt")).unwrap();

    let big = run_analyzer(&bin, &real_tables, &work, "s.txt", "s_pseudo_f2leo.csv", &[("CUBE_ALLOW_HUGE_TABLES", "1")]);
    let small = run_analyzer(&bin, &real_tables, &work, "s.txt", "s_pseudo_f2leo.csv", &[("CUBE_F2LEO_FORCE_SMALL", "1")]);
    assert_bit_exact(&big, &small);
    let _ = std::fs::remove_dir_all(&work);
}

/// f2leo:大表(std pair huge)vs 小表。仅当真实 huge 表已存在时跑(否则 skip)。
#[test]
#[ignore]
fn f2leo_big_matches_small() {
    let root = project_root();
    let real_tables = root.join("tables");
    let nb = real_tables.join("pt_cross_C4C5E0E1.bin");
    let dg = real_tables.join("pt_cross_C4C6E0E2.bin");
    if !nb.exists() || !dg.exists() {
        eprintln!("[SKIP] f2leo_big_matches_small: huge tables absent at {} (generating 2x10GB is impractical)", real_tables.display());
        return;
    }
    let bin = PathBuf::from(env!("CARGO_BIN_EXE_f2leo_analyzer"));
    let work = root.join("target").join("test-tables").join("e2e-f2leo-work");
    let _ = std::fs::remove_dir_all(&work);
    std::fs::create_dir_all(&work).unwrap();
    std::fs::copy(root.join("testdata").join("scramble_100.txt"), work.join("s.txt")).unwrap();

    let big = run_analyzer(&bin, &real_tables, &work, "s.txt", "s_f2leo.csv", &[("CUBE_ALLOW_HUGE_TABLES", "1")]);
    let small = run_analyzer(&bin, &real_tables, &work, "s.txt", "s_f2leo.csv", &[]);
    assert_bit_exact(&big, &small);
    let _ = std::fs::remove_dir_all(&work);
}
