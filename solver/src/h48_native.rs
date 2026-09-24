//! Build and supervise the vendored nissy-core H48 h10 generator.
//! This module is only linked into the table_generator binary.

use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

pub const H10_BYTES: u64 = 30_336_314_216;
pub const WARNING_BYTES: u64 = 57 * 1024 * 1024 * 1024;
#[cfg(target_os = "macos")]
const MIN_SYSTEM_FREE_PERCENT: u32 = 10;

#[cfg(target_os = "macos")]
fn system_free_percent() -> Option<u32> {
    let output = Command::new("memory_pressure").arg("-Q").output().ok()?;
    let status = String::from_utf8_lossy(&output.stdout);
    status.lines().find_map(|line| {
        line.strip_prefix("System-wide memory free percentage: ")?
            .trim_end_matches('%')
            .parse::<u32>()
            .ok()
    })
}

pub fn resident_bytes(pid: u32) -> Option<u64> {
    #[cfg(target_os = "linux")]
    {
        let status = std::fs::read_to_string(format!("/proc/{pid}/status")).ok()?;
        let kb = status.lines().find_map(|line| {
            line.strip_prefix("VmRSS:")?
                .split_whitespace()
                .next()?
                .parse::<u64>()
                .ok()
        })?;
        return Some(kb * 1024);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let output = Command::new("ps")
            .args(["-o", "rss=", "-p", &pid.to_string()])
            .output()
            .ok()?;
        let kb = String::from_utf8_lossy(&output.stdout)
            .trim()
            .parse::<u64>()
            .ok()?;
        Some(kb * 1024)
    }
}

fn compile_worker(manifest: &Path, target_dir: &Path, threads: usize) -> Result<PathBuf, String> {
    let vendor = manifest.join("vendor/nissy-core");
    let output = target_dir.join(if cfg!(windows) {
        format!("generate_h48_h10_{threads}.exe")
    } else {
        format!("generate_h48_h10_{threads}")
    });
    if output.exists() {
        let worker_mtime = std::fs::metadata(&output).and_then(|m| m.modified()).ok();
        let sources = [
            vendor.join("src/nissy.c"),
            vendor.join("src/solvers/h48/gendata_h48.h"),
            vendor.join("src/solvers/h48/gendata_cocsep.h"),
            vendor.join("src/solvers/h48/gendata_eoesep.h"),
            vendor.join("src/solvers/h48/distribution_h48.h"),
            vendor.join("src/utils/wrapthread.h"),
            vendor.join("src/utils/sleep.h"),
            manifest.join("native/generate_h48_h10.c"),
            manifest.join("native/h48_progress.c"),
            manifest.join("native/h48_progress.h"),
        ];
        if worker_mtime.is_some_and(|t| {
            sources.iter().all(|p| std::fs::metadata(p).and_then(|m| m.modified()).is_ok_and(|s| s <= t))
        }) {
            return Ok(output);
        }
    }
    std::fs::create_dir_all(target_dir).map_err(|e| e.to_string())?;
    let arch = if cfg!(target_arch = "aarch64") {
        "NEON"
    } else {
        "PORTABLE"
    };
    let compiler = std::env::var("CC").unwrap_or_else(|_| if cfg!(windows) { "clang" } else { "cc" }.into());
    eprintln!("[H48] compiling nissy-core: {threads} threads, {arch}, {compiler}");
    let mut command = Command::new(compiler);
    command.arg("-std=c11").arg("-D_POSIX_C_SOURCE=200809L");
    if cfg!(target_os = "macos") {
        command.arg("-D_DARWIN_C_SOURCE");
    } else if cfg!(target_os = "linux") {
        command.arg("-D_GNU_SOURCE");
    }
    let status = command
        .arg(format!("-DTHREADS={threads}"))
        .arg("-DCUBEROOT_H48_PROGRESS")
        .arg(format!("-D{arch}"))
        .arg("-O3")
        .arg("-pthread")
        .arg("-include")
        .arg(manifest.join("native/h48_progress.h"))
        .arg("-I")
        .arg(vendor.join("src"))
        .arg(vendor.join("src/nissy.c"))
        .arg(manifest.join("native/generate_h48_h10.c"))
        .arg(manifest.join("native/h48_progress.c"))
        .arg("-o")
        .arg(&output)
        .status()
        .map_err(|e| format!("cannot start C compiler: {e}"))?;
    if !status.success() {
        return Err(format!("nissy-core C compilation failed: {status}"));
    }
    Ok(output)
}

fn mark_failed_progress(table_path: &Path) {
    let mut name = table_path.as_os_str().to_os_string();
    name.push(".progress.json");
    let path = PathBuf::from(name);
    let Ok(status) = std::fs::read_to_string(&path) else { return };
    let updated = status.replacen("\"status\":\"running\"", "\"status\":\"failed\"", 1);
    if updated == status { return }
    let tmp = path.with_extension("json.new");
    if std::fs::write(&tmp, updated).is_ok() {
        let _ = std::fs::rename(tmp, path);
    }
}

pub fn generate(threads: usize, dataid: &str) -> Result<(bool, u64, u64), String> {
    if dataid != "h48h7" && dataid != "h48h10" {
        return Err(format!("unsupported H48 table: {dataid}"));
    }
    let path = crate::move_tables::table_dir().join(format!("h48-nissy-core/{dataid}.dat"));
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let target_dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or("cannot locate target directory")?
        .to_path_buf();
    let worker = compile_worker(&manifest, &target_dir, threads)?;
    let info = Command::new(&worker)
        .args(["--info", dataid])
        .output()
        .map_err(|e| format!("cannot inspect H48 {dataid} size: {e}"))?;
    if !info.status.success() {
        return Err(format!("cannot inspect H48 {dataid} size: {}", String::from_utf8_lossy(&info.stderr)));
    }
    let info_text = String::from_utf8_lossy(&info.stderr);
    let expected = info_text
        .split("expected_bytes=")
        .nth(1)
        .and_then(|value| value.lines().next())
        .and_then(|value| value.trim().parse::<u64>().ok())
        .ok_or_else(|| format!("H48 {dataid} did not report its expected size: {info_text}"))?;
    if dataid == "h48h10" && expected != H10_BYTES {
        return Err(format!("H48 h10 size changed: expected {H10_BYTES}, got {expected}"));
    }
    if std::fs::metadata(&path).is_ok_and(|m| m.len() == expected) {
        eprintln!("[SKIP] {} ({} bytes)", path.display(), expected);
        return Ok((false, 0, expected));
    }
    let log_path = path.with_extension("dat.log");
    let log = std::fs::File::create(&log_path)
        .map_err(|e| format!("cannot create H48 worker log {}: {e}", log_path.display()))?;
    eprintln!("[H48] worker log: {}", log_path.display());
    let mut child = Command::new(worker)
        .arg(&path)
        .arg(dataid)
        .stdout(Stdio::inherit())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("cannot start H48 worker: {e}"))?;
    let mut child_stderr = child.stderr.take().ok_or("cannot capture H48 worker stderr")?;
    let reader = std::thread::spawn(move || -> std::io::Result<()> {
        let mut log = log;
        let mut stderr = std::io::stderr().lock();
        let mut buffer = [0_u8; 8192];
        loop {
            let count = child_stderr.read(&mut buffer)?;
            if count == 0 { break; }
            log.write_all(&buffer[..count])?;
            stderr.write_all(&buffer[..count])?;
        }
        log.flush()
    });
    let started = Instant::now();
    let mut peak = 0;
    #[cfg(target_os = "macos")]
    let mut last_pressure_check = Instant::now() - Duration::from_secs(10);
    loop {
        if let Some(rss) = resident_bytes(child.id()) {
            peak = peak.max(rss);
            if rss >= WARNING_BYTES {
                let _ = child.kill();
                let _ = child.wait();
                let _ = reader.join();
                mark_failed_progress(&path);
                return Err(format!("H48 stopped at 57 GiB alarm: RSS {} bytes after {:.1}s", rss, started.elapsed().as_secs_f64()));
            }
        }
        #[cfg(target_os = "macos")]
        if last_pressure_check.elapsed() >= Duration::from_secs(10) {
            last_pressure_check = Instant::now();
            if let Some(free) = system_free_percent() {
                if free <= MIN_SYSTEM_FREE_PERCENT {
                    let _ = child.kill();
                    let _ = child.wait();
                    let _ = reader.join();
                    mark_failed_progress(&path);
                    return Err(format!(
                        "H48 stopped before system memory exhaustion: free {free}% <= {MIN_SYSTEM_FREE_PERCENT}%, peak worker RSS {peak} bytes after {:.1}s",
                        started.elapsed().as_secs_f64()
                    ));
                }
            }
        }
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            reader.join().map_err(|_| "H48 worker log thread panicked".to_owned())?
                .map_err(|e| format!("cannot write H48 worker log {}: {e}", log_path.display()))?;
            if !status.success() {
                mark_failed_progress(&path);
                return Err(format!("H48 worker failed: {status}; peak RSS {peak} bytes; see {}", log_path.display()));
            }
            if !std::fs::metadata(&path).is_ok_and(|m| m.len() == expected) {
                return Err(format!("H48 worker finished without complete {expected}-byte table"));
            }
            eprintln!("[H48] peak worker RSS: {peak} bytes ({:.2} GiB)", peak as f64 / 1024_f64.powi(3));
            return Ok((true, peak, expected));
        }
        std::thread::sleep(Duration::from_millis(250));
    }
}
