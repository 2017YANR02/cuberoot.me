//! e2e 集成测试:跑 pocket_analyzer 二进制,验证 CSV 形状 + 与 lib 直查一致。
//!
//! pocket 是整解最优(非 3x3 的条件式多视角阶段):任意 2x2x2 态都可解,
//! 输出 2 列 `id,pocket`,值 0..=11(God's number = 11),永无 `-`。
//!
//! 两组输入:
//!   - wca222_5(URF-only,WCA 222 打乱形态)→ 与 PocketSolver::solve_one 直查
//!     逐位一致(URF 词无需归一,lib 直查即独立口径)+ baseline 锁死
//!   - dlb_5(含 D/L/B)→ 锁 D/L/B 整体旋转归一语义:D=y'·U / L=x'·R / B=z'·F,
//!     前 4 条手算可证(纯旋转词=0 等),第 5 条据实测锁(归一逻辑本身另有
//!     pocket_analyzer 内 IDDFS 独立预言机单测兜底)

use std::path::PathBuf;
use std::process::{Command, Stdio};

use cube_solver::cube_common::string_to_alg;
use cube_solver::pocket_solver::PocketSolver;

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

/// WCA 222 打乱形态(URF-only,9-11 步)。
const WCA_INPUT: &str = "\
w1,R U' R' F2 R' U R' F' U2 R'
w2,F R2 U' R2 U' F2 R' U' R U'
w3,U2 R' F2 R F' R U2 F' R2 U'
w4,F2 U' R U' F2 U' R' U R' F'
w5,R2 F' U2 F' U2 R F' R F2 U'
";

/// baseline 锁死(回归信号):URF 打乱的整解最优步数,与 lib 直查双重校验。
const WCA_BASELINE: [&str; 5] = ["w1,9", "w2,9", "w3,10", "w4,9", "w5,9"];

/// 含 D/L/B 的打乱:锁整体旋转归一语义。
const DLB_INPUT: &str = "\
d1,D
d2,D U'
d3,R L' U D' F B'
d4,L2 R2 U2
d5,B' D2 L F U R' D' B L2 F'
";

/// d1:D ≡ U 差 y' 旋转 → 1;d2:D U' = 整体 y' → 0;
/// d3:(R L')(U D')(F B') = x·y·z 纯旋转复合 → 0;d4:L2 R2 = x2 旋转,余 U2 → 1;
/// d5:一般混合词,据实测锁(独立预言机见 pocket_analyzer 单测)。
const DLB_BASELINE: [&str; 5] = ["d1,1", "d2,0", "d3,0", "d4,1", "d5,9"];

fn check_csv(path: &std::path::Path, input: &str, baseline: &[&str; 5]) -> Vec<u32> {
    let got = std::fs::read_to_string(path).expect("read output");
    let lines: Vec<&str> = got.lines().collect();
    assert_eq!(lines[0], "id,pocket");
    assert_eq!(lines.len(), 6, "header + 5 rows");
    let mut vals = Vec::new();
    for ((line, src), base) in lines[1..].iter().zip(input.lines()).zip(baseline) {
        assert_eq!(line, base, "baseline mismatch");
        let cols: Vec<&str> = line.split(',').collect();
        assert_eq!(cols.len(), 2, "exactly id + 1 value");
        let pos = src.find(',').unwrap();
        assert_eq!(cols[0], &src[..pos], "id mismatch");
        let v: u32 = cols[1].parse().expect("pocket value must be a number");
        assert!(v <= 11, "above God's number: {}", v);
        vals.push(v);
    }
    vals
}

#[test]
fn pocket_analyzer_matches_lib() {
    let root = project_root();
    let bin = PathBuf::from(env!("CARGO_BIN_EXE_pocket_analyzer"));

    let work_dir = root.join("target").join("test-tables").join("e2e-pocket-work");
    let _ = std::fs::remove_dir_all(&work_dir);
    std::fs::create_dir_all(&work_dir).unwrap();
    std::fs::write(work_dir.join("wca222_5.txt"), WCA_INPUT).unwrap();
    std::fs::write(work_dir.join("dlb_5.txt"), DLB_INPUT).unwrap();

    let mut child = Command::new(&bin)
        .current_dir(&work_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn pocket_analyzer");
    {
        use std::io::Write;
        let mut stdin = child.stdin.take().unwrap();
        writeln!(stdin, "wca222_5.txt").unwrap();
        writeln!(stdin, "dlb_5.txt").unwrap();
        writeln!(stdin, "exit").unwrap();
    }
    let output = child.wait_with_output().expect("wait pocket_analyzer");
    assert!(
        output.status.success(),
        "exit={} stderr=\n{}",
        output.status,
        String::from_utf8_lossy(&output.stderr)
    );

    // --- WCA(URF-only)打乱:形状 + baseline + lib 直查逐位一致 ---
    let vals = check_csv(&work_dir.join("wca222_5_pocket.csv"), WCA_INPUT, &WCA_BASELINE);
    let s = PocketSolver::new();
    for (v, src) in vals.iter().zip(WCA_INPUT.lines()) {
        let pos = src.find(',').unwrap();
        let alg = string_to_alg(&src[pos + 1..]);
        assert_eq!(*v, s.solve_one(&alg), "lib direct query mismatch on {}", &src[..pos]);
    }

    // --- D/L/B 打乱:形状 + 旋转归一语义 baseline ---
    check_csv(&work_dir.join("dlb_5_pocket.csv"), DLB_INPUT, &DLB_BASELINE);

    let _ = std::fs::remove_dir_all(&work_dir);
}
