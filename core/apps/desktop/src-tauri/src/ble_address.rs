//! Optional macOS protocol-key address lookup. GATT continues using BLEC UUIDs.
#[cfg(target_os = "macos")]
fn lookup(identifier: &str) -> Option<String> {
    use std::ffi::CString;
    unsafe extern "C" {
        fn cuberoot_ble_address(identifier: *const std::ffi::c_char, output: *mut u8) -> bool;
    }
    let identifier = CString::new(identifier).ok()?;
    let mut bytes = [0_u8; 6];
    // SAFETY: valid NUL-terminated string and writable six-byte output, both
    // retained until the synchronous native function returns. No pointers escape.
    if !unsafe { cuberoot_ble_address(identifier.as_ptr(), bytes.as_mut_ptr()) } {
        return None;
    }
    Some(bytes.iter().map(|byte| format!("{byte:02X}")).collect::<Vec<_>>().join(":"))
}

#[tauri::command]
pub async fn ble_device_mac(device_id: String) -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    {
        tauri::async_runtime::spawn_blocking(move || lookup(&device_id))
            .await
            .map_err(|error| error.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = device_id;
        Ok(None)
    }
}
