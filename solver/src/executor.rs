//! 通用分析器执行框架。
//!
//! 移植自 C++ `analyzer_executor.h` 的 `run_analyzer_app<SolverT>(suffix)`。
//! C++ 用模板 + 静态接口,Rust 用 trait + 关联函数。
//! 简化点(与 C++ 差异):
//!   - 没有 ANSI 颜色 / 光标控制 / 监视线程进度条;只在 stderr 打整段事件
//!   - COUNT_NODE 改用全局 AtomicU64;调用方按需 `bump_node_count` 即可
//!   - OpenMP 并行 → rayon par_iter
//!   - 输出仍保序写入 csv

use std::io::{BufRead, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

#[cfg(not(target_arch = "wasm32"))]
use rayon::prelude::*;

use crate::cube_common::{string_to_alg, Move};

/// 全局节点计数器(线程安全)。`COUNT_NODE` 宏的 Rust 版本:调用方在搜索热路径
/// 自行 `bump_node_count(1)` 即可;executor 只读取最终值。
pub static GLOBAL_NODES: AtomicU64 = AtomicU64::new(0);

#[inline]
pub fn bump_node_count(n: u64) {
    GLOBAL_NODES.fetch_add(n, Ordering::Relaxed);
}

/// 跨 chunk 的**进程级**累计完成数(opt-in 全局进度用;不开则不动)。
static GLOBAL_COMPLETED: AtomicU64 = AtomicU64::new(0);

/// 全局进度配置(env opt-in,只读一次):`Some((every, total, base))` ⇒ 每完成 `every` 条
/// 打一行 `[PROG] {base+累计}/{total}`(跨 chunk 连续,非每块重置)。未设 `ANALYZER_PROGRESS_EVERY`
/// 或为 0 ⇒ None ⇒ 保持原"每块 1%"行为(其他 analyzer 不受影响)。inject 设这三个 env。
fn progress_cfg() -> Option<(u64, u64, u64)> {
    static C: std::sync::OnceLock<Option<(u64, u64, u64)>> = std::sync::OnceLock::new();
    *C.get_or_init(|| -> Option<(u64, u64, u64)> {
        let every: u64 = std::env::var("ANALYZER_PROGRESS_EVERY").ok()?.parse().ok()?;
        if every == 0 {
            return None;
        }
        let total = std::env::var("ANALYZER_PROGRESS_TOTAL").ok().and_then(|s| s.parse().ok()).unwrap_or(0);
        let base = std::env::var("ANALYZER_PROGRESS_BASE").ok().and_then(|s| s.parse().ok()).unwrap_or(0);
        Some((every, total, base))
    })
}

/// 直写进度文件(`ANALYZER_PROGRESS_FILE`,append + 每行 flush)。**绕过 PowerShell `2>` 的缓冲**
/// —— native stderr 经 PowerShell 重定向到文件会整块缓冲、长跑中看不到;直写 + flush 保证实时 tail。
fn progress_file() -> Option<&'static std::sync::Mutex<std::fs::File>> {
    static F: std::sync::OnceLock<Option<std::sync::Mutex<std::fs::File>>> = std::sync::OnceLock::new();
    F.get_or_init(|| {
        let path = std::env::var("ANALYZER_PROGRESS_FILE").ok()?;
        std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .ok()
            .map(std::sync::Mutex::new)
    })
    .as_ref()
}

/// 发一行进度:有进度文件就直写+flush(实时),否则回退 stderr。[PROG]/[DONE]/[STUCK] 都走它。
fn prog_emit(line: &str) {
    if let Some(f) = progress_file() {
        if let Ok(mut fh) = f.lock() {
            let _ = writeln!(fh, "{}", line);
            let _ = fh.flush();
        }
    } else {
        eprintln!("{}", line);
    }
}

/// 供 solver wrapper 直接发一行事件(走同一进度文件 + flush,实时 tail);如怪物超时的 `[MONSTER]`。
pub fn emit_event(line: &str) {
    prog_emit(line);
}

/// 看门狗阈值(秒,env `ANALYZER_STUCK_SECS`,只读一次)。`Some(n)` ⇒ 启用:某条解算超 n 秒立即
/// 报 `[STUCK]`。未设/0 ⇒ `None` ⇒ 整套关闭(in-flight 跟踪 + 看门狗线程都不跑,其他 analyzer 零开销)。
fn stuck_secs() -> Option<u64> {
    static S: std::sync::OnceLock<Option<u64>> = std::sync::OnceLock::new();
    *S.get_or_init(|| std::env::var("ANALYZER_STUCK_SECS").ok().and_then(|s| s.parse().ok()).filter(|&v| v > 0))
}

/// 在算中的条目:id → (输入串, 开始时刻)。看门狗据此找出卡死的具体打乱。仅 stuck_secs 启用时写入。
type InFlight = std::collections::HashMap<String, (String, Instant)>;
fn in_flight() -> &'static std::sync::Mutex<InFlight> {
    static F: std::sync::OnceLock<std::sync::Mutex<InFlight>> = std::sync::OnceLock::new();
    F.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
}

/// 求解器接口。C++ 端是静态成员 + 实例方法的混合,Rust 用关联函数表达:
///   - `global_init`:进程级一次性初始化(加载表等)
///   - `get_csv_header`:CSV 表头(不含换行)
///   - `solve`:对一条 (id, alg) 返回完整 CSV 行(不含换行)
pub trait SolverWrapper: Send + Sync {
    fn global_init();
    fn get_csv_header() -> String;
    fn solve(alg: &[Move], id: &str) -> String;
}

/// 原始字符串版接口:非 3x3 记号的 puzzle(pyraminx 小写 tip 等)用,
/// alg 不经 `string_to_alg`,由 wrapper 自己解析(解析失败行输出 `id,-`)。
pub trait RawSolverWrapper: Send + Sync {
    fn global_init();
    fn get_csv_header() -> String;
    fn solve_raw(alg: &str, id: &str) -> String;
}

/// 把 "输入文件名" 转换成 "输出文件名"。
/// 规则与 C++ 一致:去掉最后一个 ".",拼 suffix + ".csv"。
pub fn output_filename(input: &str, suffix: &str) -> PathBuf {
    let p = Path::new(input);
    let stem = match p.file_stem() {
        Some(s) => s.to_string_lossy().to_string(),
        None => input.to_string(),
    };
    let parent = p.parent().unwrap_or(Path::new(""));
    let mut name = stem;
    name.push_str(suffix);
    name.push_str(".csv");
    parent.join(name)
}

/// 解析任务文件:每行 "id,alg" 或纯 "alg"。Returns Vec<(id, alg)>。
pub fn parse_tasks_reader<R: BufRead>(r: R) -> Vec<(String, Vec<Move>)> {
    let mut tasks = Vec::new();
    for line in r.lines().map_while(Result::ok) {
        let trimmed = line.trim_end_matches('\r');
        if trimmed.is_empty() {
            continue;
        }
        if let Some(pos) = trimmed.find(',') {
            let id = trimmed[..pos].to_string();
            let alg = string_to_alg(&trimmed[pos + 1..]);
            tasks.push((id, alg));
        } else {
            let next_id = (tasks.len() + 1).to_string();
            tasks.push((next_id, string_to_alg(trimmed)));
        }
    }
    tasks
}

pub fn parse_tasks_file<P: AsRef<Path>>(path: P) -> std::io::Result<Vec<(String, Vec<Move>)>> {
    let f = std::fs::File::open(path)?;
    let r = std::io::BufReader::new(f);
    Ok(parse_tasks_reader(r))
}

/// 原始字符串版任务解析:每行 "id,alg" 或纯 "alg",alg 不做记号解析。
pub fn parse_tasks_raw_reader<R: BufRead>(r: R) -> Vec<(String, String)> {
    let mut tasks = Vec::new();
    for line in r.lines().map_while(Result::ok) {
        let trimmed = line.trim_end_matches('\r');
        if trimmed.is_empty() {
            continue;
        }
        if let Some(pos) = trimmed.find(',') {
            tasks.push((trimmed[..pos].to_string(), trimmed[pos + 1..].to_string()));
        } else {
            let next_id = (tasks.len() + 1).to_string();
            tasks.push((next_id, trimmed.to_string()));
        }
    }
    tasks
}

pub fn parse_tasks_raw_file<P: AsRef<Path>>(path: P) -> std::io::Result<Vec<(String, String)>> {
    let f = std::fs::File::open(path)?;
    let r = std::io::BufReader::new(f);
    Ok(parse_tasks_raw_reader(r))
}

/// 跑一次完整 batch:输入文件 → CSV 输出。
/// 不读 stdin,适合从代码直接调用。
#[cfg(not(target_arch = "wasm32"))]
pub fn run_batch<W: SolverWrapper>(input_file: &str, suffix: &str) -> std::io::Result<PathBuf> {
    let tasks = parse_tasks_file(input_file)?;
    run_batch_core(tasks, input_file, suffix, W::get_csv_header(), |alg, id| W::solve(alg, id), |_| String::new())
}

/// 原始字符串版 batch(`RawSolverWrapper`)。
#[cfg(not(target_arch = "wasm32"))]
pub fn run_batch_raw<W: RawSolverWrapper>(input_file: &str, suffix: &str) -> std::io::Result<PathBuf> {
    let tasks = parse_tasks_raw_file(input_file)?;
    run_batch_core(tasks, input_file, suffix, W::get_csv_header(), |alg, id| {
        W::solve_raw(alg, id)
    }, |s| s.clone())
}

#[cfg(not(target_arch = "wasm32"))]
fn run_batch_core<T: Send + Sync>(
    tasks: Vec<(String, T)>,
    input_file: &str,
    suffix: &str,
    header: String,
    solve: impl Fn(&T, &str) -> String + Send + Sync,
    descr: impl Fn(&T) -> String + Send + Sync,
) -> std::io::Result<PathBuf> {
    if tasks.is_empty() {
        eprintln!("[WARN] no tasks in {}", input_file);
    }
    let out_path = output_filename(input_file, suffix);
    GLOBAL_NODES.store(0, Ordering::Relaxed);
    let t0 = Instant::now();

    let total = tasks.len();
    let completed = AtomicU64::new(0);
    let progress_step = (total / 100).max(1);

    // 看门狗(opt-in):某条解算超阈值 ⇒ 立即报 `[STUCK] id=.. scramble=..` 暴露卡死的具体打乱。
    // 仅 ANALYZER_STUCK_SECS 启用;关时 in-flight 跟踪 + 线程都不跑,其他 analyzer 零开销。
    let wd_on = stuck_secs();
    let wd_stop = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let wd_handle = wd_on.map(|thresh| {
        let stop = wd_stop.clone();
        std::thread::spawn(move || {
            let mut reported: std::collections::HashSet<String> = std::collections::HashSet::new();
            while !stop.load(Ordering::Relaxed) {
                std::thread::sleep(std::time::Duration::from_secs(5));
                let now = Instant::now();
                if let Ok(map) = in_flight().lock() {
                    for (id, (scr, start)) in map.iter() {
                        let el = now.duration_since(*start).as_secs();
                        if el >= thresh && reported.insert(id.clone()) {
                            prog_emit(&format!("[STUCK] id={} elapsed={}s scramble={}", id, el, scr));
                        }
                    }
                }
            }
        })
    });

    let mut results: Vec<String> = vec![String::new(); total];
    results
        .par_iter_mut()
        .zip(tasks.par_iter())
        .for_each(|(slot, (id, alg))| {
            if wd_on.is_some() {
                if let Ok(mut m) = in_flight().lock() { m.insert(id.clone(), (descr(alg), Instant::now())); }
            }
            *slot = solve(alg, id);
            if wd_on.is_some() {
                if let Ok(mut m) = in_flight().lock() { m.remove(id); }
            }
            let c = completed.fetch_add(1, Ordering::Relaxed) + 1;
            if let Some((every, gtotal, base)) = progress_cfg() {
                // 全局连续进度(跨 chunk),每 every 条打 base+累计 / 总数。
                let g = GLOBAL_COMPLETED.fetch_add(1, Ordering::Relaxed) + 1;
                if g % every == 0 {
                    prog_emit(&format!("[PROG] {}/{}", base + g, gtotal));
                }
            } else if c as usize % progress_step == 0 {
                prog_emit(&format!("[PROG] {}/{}", c, total)); // 原行为:每块 1%
            }
        });

    wd_stop.store(true, Ordering::Relaxed);
    if let Some(h) = wd_handle { let _ = h.join(); }

    let f = std::fs::File::create(&out_path)?;
    let mut w = std::io::BufWriter::new(f);
    writeln!(w, "{}", header)?;
    for line in &results {
        writeln!(w, "{}", line)?;
    }
    w.flush()?;

    let elapsed = t0.elapsed();
    let nodes = GLOBAL_NODES.load(Ordering::Relaxed);
    prog_emit(&format!(
        "[DONE] {} tasks in {:.2}s, nodes={}, output={}",
        total,
        elapsed.as_secs_f64(),
        nodes,
        out_path.display()
    ));
    Ok(out_path)
}

/// 完整版:模拟 C++ 端 "stdin 取文件名 → 处理 → 循环" 模式。
/// 输入 "exit" 退出。
#[cfg(not(target_arch = "wasm32"))]
pub fn run_analyzer_app<W: SolverWrapper>(suffix: &str) {
    W::global_init();
    analyzer_stdin_loop(|name| run_batch::<W>(name, suffix));
}

/// 原始字符串版 stdin 循环(`RawSolverWrapper`)。
#[cfg(not(target_arch = "wasm32"))]
pub fn run_analyzer_app_raw<W: RawSolverWrapper>(suffix: &str) {
    W::global_init();
    analyzer_stdin_loop(|name| run_batch_raw::<W>(name, suffix));
}

#[cfg(not(target_arch = "wasm32"))]
fn analyzer_stdin_loop(run: impl Fn(&str) -> std::io::Result<PathBuf>) {
    let stdin = std::io::stdin();
    let mut lock = stdin.lock();
    loop {
        eprint!("Enter file (or exit): ");
        let _ = std::io::stderr().flush();
        let mut line = String::new();
        match lock.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) => {}
            Err(_) => break,
        }
        let name = line.trim();
        if name.is_empty() || name == "exit" {
            break;
        }
        if let Err(e) = run(name) {
            eprintln!("[ERROR] {}: {}", name, e);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Dummy;
    impl SolverWrapper for Dummy {
        fn global_init() {}
        fn get_csv_header() -> String {
            "id,col1,col2".into()
        }
        fn solve(_alg: &[Move], id: &str) -> String {
            format!("{},1,2", id)
        }
    }

    #[test]
    fn output_filename_basic() {
        let p = output_filename("scramble_5.txt", "_std");
        assert!(p.to_string_lossy().ends_with("scramble_5_std.csv"));
    }

    #[test]
    fn output_filename_no_ext() {
        let p = output_filename("foo", "_pair");
        assert!(p.to_string_lossy().ends_with("foo_pair.csv"));
    }

    #[test]
    fn output_filename_with_dir() {
        // 保留父目录
        let p = output_filename("data/scramble.txt", "_pseudo");
        let s = p.to_string_lossy();
        assert!(s.contains("scramble_pseudo.csv"));
        assert!(s.contains("data"));
    }

    #[test]
    fn parse_tasks_id_alg() {
        let input = "abc,R U R'\n\nxyz,F\n";
        let tasks = parse_tasks_reader(input.as_bytes());
        assert_eq!(tasks.len(), 2);
        assert_eq!(tasks[0].0, "abc");
        assert_eq!(tasks[0].1.len(), 3);
        assert_eq!(tasks[1].0, "xyz");
        assert_eq!(tasks[1].1.len(), 1);
    }

    #[test]
    fn parse_tasks_alg_only_autoid() {
        let input = "R U R'\nL D\r\n";
        let tasks = parse_tasks_reader(input.as_bytes());
        assert_eq!(tasks.len(), 2);
        assert_eq!(tasks[0].0, "1");
        assert_eq!(tasks[1].0, "2");
        assert_eq!(tasks[1].1.len(), 2);
    }

    #[test]
    fn end_to_end_dummy_batch() {
        let tmp = std::env::temp_dir().join("cube_exec_test_input.txt");
        std::fs::write(&tmp, "a,U\nb,D\n").unwrap();
        let out = run_batch::<Dummy>(tmp.to_string_lossy().as_ref(), "_dummy").unwrap();
        let content = std::fs::read_to_string(&out).unwrap();
        assert!(content.starts_with("id,col1,col2\n"));
        assert!(content.contains("a,1,2"));
        assert!(content.contains("b,1,2"));
        let _ = std::fs::remove_file(&tmp);
        let _ = std::fs::remove_file(&out);
    }

    #[test]
    fn node_counter_bump() {
        GLOBAL_NODES.store(0, Ordering::Relaxed);
        bump_node_count(7);
        bump_node_count(5);
        assert_eq!(GLOBAL_NODES.load(Ordering::Relaxed), 12);
    }
}
