//! table_generator binary:对应 C++ `table_generator.cpp`。
//!
//! 顺序生成全部 move tables (12 张) + prune tables (61 张),自动启用
//! `CUBE_ALLOW_HUGE_TABLES=1`(可通过 `CUBE_DISABLE_HUGE_TABLES=1` 关闭)。
//!
//! 已存在的表跳过(各 manager 内部 mmap reload)。
//!
//! 总磁盘 ~25 GB,首次生成约 1-2 小时(机器 + 磁盘 IO 决定)。

use std::io::Write;
use std::time::Instant;

use cube_solver::move_tables;
use cube_solver::prune_tables;

fn step(name: &str, f: impl FnOnce()) {
    let t = Instant::now();
    eprint!("[GEN] {:<35} ", name);
    let _ = std::io::stderr().flush();
    f();
    eprintln!("done in {:>6.1}s", t.elapsed().as_secs_f64());
}

/// 删除目录里所有 *.bin.tmp 残留(上次中断留下的半截文件)。
fn cleanup_tmp_files() {
    let dir = std::env::var("CUBE_TABLE_DIR").unwrap_or_else(|_| "./tables".into());
    let path = std::path::PathBuf::from(&dir);
    if !path.exists() {
        return;
    }
    if let Ok(entries) = std::fs::read_dir(&path) {
        let mut removed = 0;
        for e in entries.flatten() {
            let p = e.path();
            if p.extension().and_then(|s| s.to_str()) == Some("tmp") {
                let _ = std::fs::remove_file(&p);
                eprintln!("[CLEANUP] removed stale {}", p.display());
                removed += 1;
            }
        }
        if removed > 0 {
            eprintln!("[CLEANUP] {} stale .tmp file(s) removed\n", removed);
        }
    }
}

fn main() {
    cube_solver::logo::print_logo_block();
    cleanup_tmp_files();

    let disable_huge = std::env::var("CUBE_DISABLE_HUGE_TABLES")
        .map(|v| v == "1")
        .unwrap_or(false);
    if !disable_huge {
        std::env::set_var("CUBE_ALLOW_HUGE_TABLES", "1");
        eprintln!(
            "[INFO] huge tables enabled (~25 GB total). \
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
    let mtm = move_tables::instance();
    let ptm = prune_tables::instance();

    eprintln!("\n=== Move tables (12) ===");
    step("mt_edge",      || { mtm.ensure_edge(); });
    step("mt_corn",      || { mtm.ensure_corn(); });
    step("mt_edge2",     || { mtm.ensure_edge2(); });
    step("mt_edge3",     || { mtm.ensure_edge3(); });
    step("mt_edge4",     || { mtm.ensure_edge4(); });
    step("mt_corn2",     || { mtm.ensure_corn2(); });
    step("mt_corn3",     || { mtm.ensure_corn3(); });
    step("mt_eo12",      || { mtm.ensure_eo12(); });
    step("mt_eo12_alt",  || { mtm.ensure_eo12_alt(); });
    step("mt_ep1",       || { mtm.ensure_ep1(); });
    step("mt_ep4",       || { mtm.ensure_ep4(); });
    if !disable_huge {
        step("mt_edge6 [HUGE ~3GB]", || { mtm.ensure_edge6(); });
    } else {
        eprintln!("[SKIP] mt_edge6 (huge)");
    }

    eprintln!("\n=== Prune tables: small/medium ===");
    step("pt_cross",            || { ptm.ensure_pt_cross(); });
    step("pt_cross_ins_c4",     || { ptm.ensure_pt_cross_ins_c4(); });
    step("pt_pair_c4e0",        || { ptm.ensure_pt_pair_c4e0(); });
    step("pt_cross_c4e0",       || { ptm.ensure_pt_cross_c4e0(); });
    step("pt_pscross",          || { ptm.ensure_pt_pscross(); });
    step("pt_pscross_e0e1",     || { ptm.ensure_pt_pscross_e0e1(); });
    step("pt_pscross_e0e2",     || { ptm.ensure_pt_pscross_e0e2(); });
    step("pt_pscross_c4c5",     || { ptm.ensure_pt_pscross_c4c5(); });
    step("pt_pscross_c4c6",     || { ptm.ensure_pt_pscross_c4c6(); });
    step("pt_ep4eo12",          || { ptm.ensure_pt_ep4eo12(); });
    step("pt_cross_c4e0e1",     || { ptm.ensure_pt_cross_c4e0e1(); });
    step("pt_cross_c4e0e2",     || { ptm.ensure_pt_cross_c4e0e2(); });
    step("pt_cross_c4e0e3",     || { ptm.ensure_pt_cross_c4e0e3(); });
    step("pt_cross_c4c5e0",     || { ptm.ensure_pt_cross_c4c5e0(); });
    step("pt_cross_c4c6e0",     || { ptm.ensure_pt_cross_c4c6e0(); });
    step("pt_cross_c4c7e0",     || { ptm.ensure_pt_cross_c4c7e0(); });

    eprintln!("\n=== Prune tables: indexed families ===");
    for i in 0..4 {
        step(&format!("pt_pscross_C4E{}", i), || { ptm.ensure_pt_pscross_c4e(i); });
    }
    for c in 0..4 {
        step(&format!("pt_pscross_C{}", c + 4), || { ptm.ensure_pt_pscross_c(c); });
    }
    for c in 0..4 {
        for e in 0..4 {
            step(
                &format!("pt_pscross_ins_C{}_diff{}", c + 4, e),
                || { ptm.ensure_pt_pscross_ins_c_diff(c, e); },
            );
        }
    }
    for c in 0..4 {
        for e in 0..4 {
            step(
                &format!("pt_pspair_C{}E{}", c + 4, e),
                || { ptm.ensure_pt_pspair_ce(c, e); },
            );
        }
    }

    if !disable_huge {
        eprintln!("\n=== Prune tables: HUGE (≥800MB) ===");
        step("pt_pscross_E0E1E2 [~1GB]",  || { ptm.ensure_pt_pscross_e0e1e2(); });
        step("pt_pscross_C4C5C6 [~822MB]",|| { ptm.ensure_pt_pscross_c4c5c6(); });
        step("pt_cross_C4C5C6 [~1.2GB]",  || { ptm.ensure_pt_cross_c4c5c6(); });
        step("pt_cross_C4C5E0E1 [~10GB]", || { ptm.ensure_pt_cross_c4c5e0e1(); });
        step("pt_cross_C4C6E0E2 [~10GB]", || { ptm.ensure_pt_cross_c4c6e0e2(); });
    } else {
        eprintln!("\n[SKIP] 5 huge prune tables");
    }

    eprintln!(
        "\n=== All tables ready in {:.1}s ({:.1} min) ===",
        t0.elapsed().as_secs_f64(),
        t0.elapsed().as_secs_f64() / 60.0,
    );
}
