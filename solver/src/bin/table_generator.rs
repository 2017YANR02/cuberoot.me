//! table_generator binary:对应 C++ `table_generator.cpp`。
//!
//! 顺序生成默认 move tables (12 张) + prune tables (61 张),自动启用
//! `CUBE_ALLOW_HUGE_TABLES=1`(可通过 `CUBE_DISABLE_HUGE_TABLES=1` 关闭)。
//! 64 GB-class 机器自动追加 EO XCross 5 张、SQ1 精确表及原生 H48 h10。
//!
//! 已存在的表跳过(各 manager 内部 mmap reload)。
//!
//! 默认档全 73 张实测 36.14 GB；high-memory 档另加 9.35 GB。

use std::io::Write;
use std::time::Instant;

use cube_solver::move_tables;
use cube_solver::prune_tables;
use cube_solver::{high_memory_tables, sq1_solver::Sq1WcaSolver, table_profile, table_timing};

#[path = "../h48_native.rs"]
mod h48_native;

fn step(name: &str, f: impl FnOnce()) {
    let table = name.split_whitespace().next().unwrap_or(name);
    let path = move_tables::table_path(&format!("{table}.bin"));
    let before = std::fs::metadata(&path).ok();
    let t = Instant::now();
    eprint!("[GEN] {:<35} ", name);
    let _ = std::io::stderr().flush();
    f();
    let elapsed = t.elapsed();
    eprintln!("done in {:>6.1}s", elapsed.as_secs_f64());
    let after = std::fs::metadata(&path).ok();
    let size = after.as_ref().map(|m| m.len()).unwrap_or(0);
    let unchanged = before.as_ref().zip(after.as_ref()).is_some_and(|(a, b)| {
        a.len() == b.len() && a.modified().ok() == b.modified().ok()
    });
    table_timing::record(table, elapsed, size, if unchanged { "skipped" } else { "generated" });
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let only = match args.as_slice() {
        [] => "all",
        [flag, value] if flag == "--only" => value.as_str(),
        _ => panic!("usage: table_generator [--only rust|sq1|h48-h7|h48-h10]"),
    };
    assert!(["all", "rust", "sq1", "h48-h7", "h48-h10"].contains(&only), "unknown --only target: {only}");
    let rayon_threads = rayon::current_num_threads();
    cube_solver::logo::print_logo_block();

    let disable_huge = std::env::var("CUBE_DISABLE_HUGE_TABLES")
        .map(|v| v == "1")
        .unwrap_or(false);
    if !disable_huge {
        std::env::set_var("CUBE_ALLOW_HUGE_TABLES", "1");
        eprintln!(
            "[INFO] huge tables enabled (~36 GB for all 73 default tables). \
             Set CUBE_DISABLE_HUGE_TABLES=1 to skip ≥800 MB tables."
        );
    } else {
        eprintln!("[INFO] huge tables skipped (CUBE_DISABLE_HUGE_TABLES=1).");
    }
    if let Ok(dir) = std::env::var("CUBE_TABLE_DIR") {
        eprintln!("[INFO] CUBE_TABLE_DIR = {}", dir);
    } else {
        eprintln!("[INFO] CUBE_TABLE_DIR not set; using ./tables/");
    }

    let t0 = Instant::now();
    let profile = table_profile::selection();
    let detected_memory = profile
        .total_memory_bytes
        .map(|bytes| format!("{:.1} GiB", bytes as f64 / 1024_f64.powi(3)))
        .unwrap_or_else(|| "unknown".to_string());
    eprintln!(
        "[INFO] table profile = {} (source: {}; physical memory: {}; rayon threads: {})",
        profile.profile.as_str(),
        profile.source.as_str(),
        detected_memory,
        rayon_threads
    );

    if only == "sq1" || only == "h48-h7" || only == "h48-h10" {
        assert!(profile.high_memory(), "large-table generation requires a high-memory profile");
    }
    if !disable_huge && profile.high_memory() && (only == "all" || only == "sq1") {
        eprintln!("\n=== SQ1 WCA exact phase-2 table ===");
        let started = Instant::now();
        let monitoring = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
        let monitor_flag = monitoring.clone();
        let memory_monitor = std::thread::spawn(move || {
            let mut peak = 0u64;
            while monitor_flag.load(std::sync::atomic::Ordering::Relaxed) {
                peak = peak.max(h48_native::resident_bytes(std::process::id()).unwrap_or(0));
                std::thread::sleep(std::time::Duration::from_millis(250));
            }
            peak
        });
        let generated = Sq1WcaSolver::generate_jsq_full_table().expect("SQ1 full-table generation failed");
        monitoring.store(false, std::sync::atomic::Ordering::Relaxed);
        let peak = memory_monitor.join().unwrap_or(0);
        let elapsed = started.elapsed();
        table_timing::record("sq1_wca_jsqfull", elapsed, std::fs::metadata(move_tables::table_path("sq1_wca_jsqfull.bin")).map(|m| m.len()).unwrap_or(0), if generated { "generated" } else { "skipped" });
        table_timing::record_peak("sq1_wca_jsqfull", peak);
        eprintln!("[SQ1] peak generator RSS: {peak} bytes ({:.2} GiB)", peak as f64 / 1024_f64.powi(3));
        eprintln!("[GEN] sq1_wca_jsqfull done in {:.1}s", elapsed.as_secs_f64());
    }
    if !disable_huge && profile.high_memory() && (only == "all" || only == "h48-h7" || only == "h48-h10") {
        let dataid = if only == "h48-h7" { "h48h7" } else { "h48h10" };
        eprintln!("\n=== H48 {dataid} native table (57 GiB RSS alarm) ===");
        let started = Instant::now();
        let (generated, peak, bytes) = match h48_native::generate(rayon_threads, dataid) {
            Ok(result) => result,
            Err(error) => {
                table_timing::record(dataid, started.elapsed(), 0, "failed");
                panic!("H48 {dataid} generation failed: {error}");
            }
        };
        let elapsed = started.elapsed();
        table_timing::record(dataid, elapsed, bytes, if generated { "generated" } else { "skipped" });
        table_timing::record_peak(dataid, peak);
        eprintln!("[GEN] {dataid} done in {:.1}s", elapsed.as_secs_f64());
    }
    if only == "sq1" || only == "h48-h7" || only == "h48-h10" {
        return;
    }

    let mtm = move_tables::instance();
    let ptm = prune_tables::instance();

    eprintln!("\n=== Move tables (12) ===");
    step("mt_edge", || {
        mtm.ensure_edge();
    });
    step("mt_corn", || {
        mtm.ensure_corn();
    });
    step("mt_edge2", || {
        mtm.ensure_edge2();
    });
    step("mt_edge3", || {
        mtm.ensure_edge3();
    });
    step("mt_edge4", || {
        mtm.ensure_edge4();
    });
    step("mt_corn2", || {
        mtm.ensure_corn2();
    });
    step("mt_corn3", || {
        mtm.ensure_corn3();
    });
    step("mt_eo12", || {
        mtm.ensure_eo12();
    });
    step("mt_eo12_alt", || {
        mtm.ensure_eo12_alt();
    });
    step("mt_ep1", || {
        mtm.ensure_ep1();
    });
    step("mt_ep4", || {
        mtm.ensure_ep4();
    });
    if !disable_huge {
        step("mt_edge6 [HUGE ~3GB]", || {
            mtm.ensure_edge6();
        });
    } else {
        eprintln!("[SKIP] mt_edge6 (huge)");
    }

    eprintln!("\n=== Prune tables: small/medium ===");
    step("pt_cross", || {
        ptm.ensure_pt_cross();
    });
    step("pt_cross_ins_c4", || {
        ptm.ensure_pt_cross_ins_c4();
    });
    step("pt_pair_c4e0", || {
        ptm.ensure_pt_pair_c4e0();
    });
    step("pt_cross_c4e0", || {
        ptm.ensure_pt_cross_c4e0();
    });
    step("pt_pscross", || {
        ptm.ensure_pt_pscross();
    });
    step("pt_pscross_e0e1", || {
        ptm.ensure_pt_pscross_e0e1();
    });
    step("pt_pscross_e0e2", || {
        ptm.ensure_pt_pscross_e0e2();
    });
    step("pt_pscross_c4c5", || {
        ptm.ensure_pt_pscross_c4c5();
    });
    step("pt_pscross_c4c6", || {
        ptm.ensure_pt_pscross_c4c6();
    });
    step("pt_ep4eo12", || {
        ptm.ensure_pt_ep4eo12();
    });
    step("pt_cross_c4e0e1", || {
        ptm.ensure_pt_cross_c4e0e1();
    });
    step("pt_cross_c4e0e2", || {
        ptm.ensure_pt_cross_c4e0e2();
    });
    step("pt_cross_c4e0e3", || {
        ptm.ensure_pt_cross_c4e0e3();
    });
    step("pt_cross_c4c5e0", || {
        ptm.ensure_pt_cross_c4c5e0();
    });
    step("pt_cross_c4c6e0", || {
        ptm.ensure_pt_cross_c4c6e0();
    });
    step("pt_cross_c4c7e0", || {
        ptm.ensure_pt_cross_c4c7e0();
    });

    eprintln!("\n=== Prune tables: indexed families ===");
    for i in 0..4 {
        step(&format!("pt_pscross_C4E{}", i), || {
            ptm.ensure_pt_pscross_c4e(i);
        });
    }
    for c in 0..4 {
        step(&format!("pt_pscross_C{}", c + 4), || {
            ptm.ensure_pt_pscross_c(c);
        });
    }
    for c in 0..4 {
        for e in 0..4 {
            step(&format!("pt_pscross_ins_C{}_diff{}", c + 4, e), || {
                ptm.ensure_pt_pscross_ins_c_diff(c, e);
            });
        }
    }
    for c in 0..4 {
        for e in 0..4 {
            step(&format!("pt_pspair_C{}E{}", c + 4, e), || {
                ptm.ensure_pt_pspair_ce(c, e);
            });
        }
    }

    if !disable_huge {
        eprintln!("\n=== Prune tables: HUGE (≥800MB) ===");
        step("pt_pscross_E0E1E2 [~1GB]", || {
            ptm.ensure_pt_pscross_e0e1e2();
        });
        step("pt_pscross_C4C5C6 [~822MB]", || {
            ptm.ensure_pt_pscross_c4c5c6();
        });
        step("pt_cross_C4C5C6 [~1.2GB]", || {
            ptm.ensure_pt_cross_c4c5c6();
        });
        step("pt_cross_C4C5E0E1 [~10GB]", || {
            ptm.ensure_pt_cross_c4c5e0e1();
        });
        step("pt_cross_C4C6E0E2 [~10GB]", || {
            ptm.ensure_pt_cross_c4c6e0e2();
        });
    } else {
        eprintln!("\n[SKIP] 5 huge prune tables");
    }

    if !disable_huge && profile.high_memory() {
        eprintln!("\n=== High-memory profile: EO XCross (5) ===");
        high_memory_tables::generate();
    } else if disable_huge && profile.high_memory() {
        eprintln!("\n[SKIP] 5 high-memory tables (CUBE_DISABLE_HUGE_TABLES=1)");
    } else {
        eprintln!("\n[SKIP] 5 high-memory tables (default profile)");
    }

    eprintln!(
        "\n=== All tables ready in {:.1}s ({:.1} min) ===",
        t0.elapsed().as_secs_f64(),
        t0.elapsed().as_secs_f64() / 60.0,
    );
}
