//! Append-only, machine-written per-table generation history.

use std::io::Write;
use std::time::Duration;

pub fn record(name: &str, elapsed: Duration, size: u64, status: &str) {
    let path = crate::move_tables::table_path("generation-times.csv");
    let result = (|| -> std::io::Result<()> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        let new = !path.exists();
        let mut file = std::fs::OpenOptions::new().create(true).append(true).open(&path)?;
        if new {
            writeln!(file, "timestamp_unix,table,seconds,bytes,status")?;
        }
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        writeln!(file, "{timestamp},{name},{:.3},{size},{status}", elapsed.as_secs_f64())?;
        file.flush()?;
        Ok(())
    })();
    if let Err(error) = result {
        eprintln!("[WARN] cannot record table timing at {}: {error}", path.display());
    }
}

pub fn record_peak(name: &str, peak_bytes: u64) {
    let path = crate::move_tables::table_path("generation-memory.csv");
    let result = (|| -> std::io::Result<()> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        let new = !path.exists();
        let mut file = std::fs::OpenOptions::new().create(true).append(true).open(&path)?;
        if new {
            writeln!(file, "timestamp_unix,table,peak_rss_bytes")?;
        }
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        writeln!(file, "{timestamp},{name},{peak_bytes}")?;
        Ok(())
    })();
    if let Err(error) = result {
        eprintln!("[WARN] cannot record peak memory at {}: {error}", path.display());
    }
}
