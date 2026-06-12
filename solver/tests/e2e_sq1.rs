//! e2e 集成测试:跑 sq1_analyzer 二进制,验证 CSV 形状 + 与 lib 直查一致。
//!
//! sq1 是整解最优 twist 数(口径 P5a 锁定:slash 计 1 步,层转计 0 步,精确):
//! 任意 sq1 态都可解,输出 2 列 `id,sq1`,值 0..=13(God's number = 13),
//! 合法行永无 `-`(解析失败 / 非法 slash 行才出 `-`)。
//!
//! 两组输入:
//!   - wca_sq1_5(真实 WCA sq1 打乱,Scrambles.tsv event `sq1` id 774/775/1205/1208/778,
//!     含 3 条末尾悬挂 `/` 的真实形态)→ baseline 锁死 + 与 Sq1Solver 直查逐位一致。
//!     选样附带时长约束:语料里单态求解 0.05s..80s+ 方差极大(P5a 五表 max 启发式
//!     在少数 d=11/12 态上 IDDFS 末迭代爆炸),e2e 取秒级样本保证总时长 < 1min;
//!     慢态优化是 P5a/P5c 灌注侧议题,不在本测试加大 timeout 硬扛。
//!   - edge_5(记号边角:空串 / 单 slash / 转量+slash / 纯层转 / (0,0) 容忍)
//!     → 手算 baseline 锁解析语义(层转 0 步,双 slash 自消)
//!
//! 注意:executor 的任务行按**第一个逗号**切 id 与 alg —— sq1 记号内含逗号,
//! 输入行必须带显式 id(无 id 裸打乱行会在 `(x,y)` 的逗号处误切;管道语料恒有 id)。

use std::path::PathBuf;
use std::process::{Command, Stdio};

use cube_solver::sq1_solver::{state_from_scramble, Sq1Solver};

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

/// 真实 WCA sq1 打乱(Scrambles.tsv,id 见模块注释;w5 等 3 条末尾悬挂 `/`)。
const WCA_INPUT: &str = "\
w1,(0,-4) / (-2,-5) / (-3,0) / (0,-3) / (2,-4) / (-3,-5) / (0,-3) / (-2,-3) / (5,0) / (-2,0) / (1,-4) / (4,0)
w2,(4,0) / (-3,-3) / (3,0) / (0,-3) / (3,0) / (2,-1) / (-5,0) / (-3,-3) / (0,-4) / (0,-5) / (5,-2) / (4,-4)
w3,(4,0) / (3,0) / (-4,5) / (1,-5) / (3,0) / (6,0) / (-4,0) / (0,-3) / (0,-1) / (3,-4) / (4,-2) / (-4,-3) /
w4,(0,-4) / (-5,-2) / (-3,6) / (-3,0) / (5,-3) / (0,-3) / (0,-3) / (-3,0) / (2,0) / (1,0) / (-5,-2) / (0,-2) / (6,0) /
w5,(-2,-3) / (0,-3) / (-4,2) / (4,-5) / (2,-4) / (4,0) / (-3,0) / (6,-3) / (-1,-5) / (0,-4) / (4,0) /
";

/// baseline 锁死(回归信号):整解最优 twist 数,与 lib 直查双重校验。
const WCA_BASELINE: [&str; 5] = ["w1,11", "w2,9", "w3,10", "w4,9", "w5,11"];

/// 记号边角:锁解析语义。
const EDGE_INPUT: &str = "\
e1,
e2,/
e3,(3,0)/
e4,(6,6)
e5,(0,0)/ (0,0)/
";

/// e1:空串 → 0;e2:单 slash → 1;e3:层转 0 步 + slash → 1;
/// e4:纯层转 → 0;e5:(0,0) 容忍 + 双 slash 自消 → 0。
const EDGE_BASELINE: [&str; 5] = ["e1,0", "e2,1", "e3,1", "e4,0", "e5,0"];

fn check_csv(path: &std::path::Path, input: &str, baseline: &[&str; 5]) -> Vec<u32> {
    let got = std::fs::read_to_string(path).expect("read output");
    let lines: Vec<&str> = got.lines().collect();
    assert_eq!(lines[0], "id,sq1");
    assert_eq!(lines.len(), 6, "header + 5 rows");
    let mut vals = Vec::new();
    for ((line, src), base) in lines[1..].iter().zip(input.lines()).zip(baseline) {
        assert_eq!(line, base, "baseline mismatch");
        let cols: Vec<&str> = line.split(',').collect();
        assert_eq!(cols.len(), 2, "exactly id + 1 value");
        let pos = src.find(',').unwrap();
        assert_eq!(cols[0], &src[..pos], "id mismatch");
        let v: u32 = cols[1].parse().expect("sq1 value must be a number");
        assert!(v <= 13, "above God's number: {}", v);
        vals.push(v);
    }
    vals
}

#[test]
fn square1_analyzer_matches_lib() {
    let root = project_root();
    let bin = PathBuf::from(env!("CARGO_BIN_EXE_sq1_analyzer"));

    let work_dir = root.join("target").join("test-tables").join("e2e-sq1-work");
    let _ = std::fs::remove_dir_all(&work_dir);
    std::fs::create_dir_all(&work_dir).unwrap();
    std::fs::write(work_dir.join("wca_sq1_5.txt"), WCA_INPUT).unwrap();
    std::fs::write(work_dir.join("edge_5.txt"), EDGE_INPUT).unwrap();

    let mut child = Command::new(&bin)
        .current_dir(&work_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn sq1_analyzer");
    {
        use std::io::Write;
        let mut stdin = child.stdin.take().unwrap();
        writeln!(stdin, "wca_sq1_5.txt").unwrap();
        writeln!(stdin, "edge_5.txt").unwrap();
        writeln!(stdin, "exit").unwrap();
    }
    let output = child.wait_with_output().expect("wait sq1_analyzer");
    assert!(
        output.status.success(),
        "exit={} stderr=\n{}",
        output.status,
        String::from_utf8_lossy(&output.stderr)
    );

    // --- WCA 打乱:形状 + baseline + lib 直查逐位一致 ---
    let vals = check_csv(&work_dir.join("wca_sq1_5_sq1.csv"), WCA_INPUT, &WCA_BASELINE);
    let s = Sq1Solver::shared();
    for (v, src) in vals.iter().zip(WCA_INPUT.lines()) {
        let pos = src.find(',').unwrap();
        let st = state_from_scramble(&src[pos + 1..]).expect("WCA scramble must parse");
        assert_eq!(*v, s.solve_one(&st), "lib direct query mismatch on {}", &src[..pos]);
        // twist 距离奇偶 ≡ ml(P5a 守恒律,顺手锁住)
        assert_eq!(*v % 2, st.ml as u32, "parity ≡ ml on {}", &src[..pos]);
    }

    // --- 记号边角:形状 + 手算 baseline ---
    let vals = check_csv(&work_dir.join("edge_5_sq1.csv"), EDGE_INPUT, &EDGE_BASELINE);
    for (v, src) in vals.iter().zip(EDGE_INPUT.lines()) {
        let pos = src.find(',').unwrap();
        let st = state_from_scramble(&src[pos + 1..]).expect("edge case must parse");
        assert_eq!(*v, s.solve_one(&st), "lib direct query mismatch on {}", &src[..pos]);
    }

    let _ = std::fs::remove_dir_all(&work_dir);
}
