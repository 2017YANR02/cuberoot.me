//! dump_opt_tables:把 2x2x2 / 金字塔 / 斜转的全空间最优距离表落盘成 .bin,
//! 供浏览器端「秒算」静态直载(build_wasm 再 gzip 进 pkg-web/tables;worker
//! init 拉 opt_*.bin.gz 解压后喂 *SolverWasm::from_dist,跳过每会话首查现场 BFS)。
//!
//! 用法:cargo run --release --bin dump_opt_tables -- [out_dir]   (默认 tables/)
//!
//! 表内容 = 全空间精确距离 Vec<u8>(idx 由各 solver 内部 encode 定义,与
//! from_dist 严丝合缝;round-trip 由各 solver 的 from_dist_matches_* 测试锁定)。

use std::fs;
use std::path::Path;

use cube_solver::cube222_solver::Cube222Solver;
use cube_solver::pyraminx_solver::PyraminxSolver;
use cube_solver::skewb_solver::SkewbSolver;

fn dump(dir: &Path, name: &str, bytes: &[u8]) {
    let path = dir.join(format!("{name}.bin"));
    fs::write(&path, bytes).unwrap_or_else(|e| panic!("write {}: {e}", path.display()));
    println!("{:>12}  {}", bytes.len(), path.display());
}

fn main() {
    let dir = std::env::args().nth(1).unwrap_or_else(|| "tables".to_string());
    let dir = Path::new(&dir);
    fs::create_dir_all(dir).expect("create out dir");

    dump(dir, "opt_222", Cube222Solver::new_lean().dist_bytes());
    dump(dir, "opt_pyraminx", PyraminxSolver::new_lean().dist_bytes());
    dump(dir, "opt_skewb", SkewbSolver::new().dist_bytes());
}
