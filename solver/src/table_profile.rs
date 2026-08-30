//! Native table-profile selection from an explicit override or total physical memory.

use std::sync::OnceLock;

pub const HIGH_MEMORY_AUTO_MIN_BYTES: u64 = 56 * 1024 * 1024 * 1024;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TableProfile {
    Default,
    HighMemory,
}

impl TableProfile {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Default => "default",
            Self::HighMemory => "high-memory",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProfileSource {
    Environment,
    PhysicalMemory,
    SafeFallback,
}

impl ProfileSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Environment => "CUBE_TABLE_PROFILE",
            Self::PhysicalMemory => "physical-memory-auto-detect",
            Self::SafeFallback => "memory-detection-fallback",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TableProfileSelection {
    pub profile: TableProfile,
    pub source: ProfileSource,
    pub total_memory_bytes: Option<u64>,
}

impl TableProfileSelection {
    pub fn high_memory(self) -> bool {
        self.profile == TableProfile::HighMemory
    }
}

pub fn selection() -> &'static TableProfileSelection {
    static SELECTION: OnceLock<TableProfileSelection> = OnceLock::new();
    SELECTION.get_or_init(select_profile)
}

pub fn high_memory_enabled() -> bool {
    selection().high_memory()
}

pub fn configure_rayon_threads(max_threads: usize) -> usize {
    assert!(max_threads > 0, "Rayon thread limit must be positive");
    let threads = std::env::var("RAYON_NUM_THREADS")
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(max_threads)
        .clamp(1, max_threads);
    std::env::set_var("RAYON_NUM_THREADS", threads.to_string());
    threads
}

fn select_profile() -> TableProfileSelection {
    let total_memory_bytes = detect_total_memory_bytes();
    match std::env::var("CUBE_TABLE_PROFILE") {
        Ok(raw) => match raw.trim() {
            "" | "auto" => auto_selection(total_memory_bytes),
            "default" => TableProfileSelection {
                profile: TableProfile::Default,
                source: ProfileSource::Environment,
                total_memory_bytes,
            },
            "high-memory" => TableProfileSelection {
                profile: TableProfile::HighMemory,
                source: ProfileSource::Environment,
                total_memory_bytes,
            },
            value => panic!(
                "invalid CUBE_TABLE_PROFILE={value:?}; expected auto, default, or high-memory"
            ),
        },
        Err(std::env::VarError::NotPresent) => auto_selection(total_memory_bytes),
        Err(std::env::VarError::NotUnicode(_)) => {
            panic!("CUBE_TABLE_PROFILE must be valid Unicode")
        }
    }
}

fn auto_selection(total_memory_bytes: Option<u64>) -> TableProfileSelection {
    match total_memory_bytes {
        Some(bytes) => TableProfileSelection {
            profile: if bytes >= HIGH_MEMORY_AUTO_MIN_BYTES {
                TableProfile::HighMemory
            } else {
                TableProfile::Default
            },
            source: ProfileSource::PhysicalMemory,
            total_memory_bytes: Some(bytes),
        },
        None => TableProfileSelection {
            profile: TableProfile::Default,
            source: ProfileSource::SafeFallback,
            total_memory_bytes: None,
        },
    }
}

#[cfg(target_os = "linux")]
fn detect_total_memory_bytes() -> Option<u64> {
    let meminfo = std::fs::read_to_string("/proc/meminfo").ok()?;
    let kib = meminfo.lines().find_map(|line| {
        line.strip_prefix("MemTotal:")?
            .split_whitespace()
            .next()?
            .parse::<u64>()
            .ok()
    })?;
    kib.checked_mul(1024)
}

#[cfg(target_os = "macos")]
fn detect_total_memory_bytes() -> Option<u64> {
    use std::ffi::{c_char, c_void};

    #[link(name = "System")]
    extern "C" {
        fn sysctlbyname(
            name: *const c_char,
            old_value: *mut c_void,
            old_len: *mut usize,
            new_value: *mut c_void,
            new_len: usize,
        ) -> i32;
    }

    let mut bytes = 0u64;
    let mut len = std::mem::size_of::<u64>();
    let result = unsafe {
        sysctlbyname(
            b"hw.memsize\0".as_ptr().cast(),
            (&mut bytes as *mut u64).cast(),
            &mut len,
            std::ptr::null_mut(),
            0,
        )
    };
    (result == 0 && len == std::mem::size_of::<u64>()).then_some(bytes)
}

#[cfg(target_os = "windows")]
fn detect_total_memory_bytes() -> Option<u64> {
    #[repr(C)]
    struct MemoryStatusEx {
        length: u32,
        memory_load: u32,
        total_phys: u64,
        avail_phys: u64,
        total_page_file: u64,
        avail_page_file: u64,
        total_virtual: u64,
        avail_virtual: u64,
        avail_extended_virtual: u64,
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn GlobalMemoryStatusEx(buffer: *mut MemoryStatusEx) -> i32;
    }

    let mut status = MemoryStatusEx {
        length: std::mem::size_of::<MemoryStatusEx>() as u32,
        memory_load: 0,
        total_phys: 0,
        avail_phys: 0,
        total_page_file: 0,
        avail_page_file: 0,
        total_virtual: 0,
        avail_virtual: 0,
        avail_extended_virtual: 0,
    };
    let result = unsafe { GlobalMemoryStatusEx(&mut status) };
    (result != 0 && status.total_phys > 0).then_some(status.total_phys)
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn detect_total_memory_bytes() -> Option<u64> {
    None
}
