// Called on the main thread, including cleanup: Windows execution state is thread-local.
pub fn apply(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        unsafe extern "C" { fn cuberoot_keep_awake(enabled: i32) -> i32; }
        if unsafe { cuberoot_keep_awake(i32::from(enabled)) } != 0 {
            return Err("Could not update display sleep assertion".into());
        }
    }
    #[cfg(target_os = "windows")]
    {
        #[link(name = "kernel32")]
        unsafe extern "system" { fn SetThreadExecutionState(flags: u32) -> u32; }
        // Display and system idle timers are independent on Windows.
        let flags = 0x80000000 | if enabled { 0x00000002 | 0x00000001 } else { 0 };
        if unsafe { SetThreadExecutionState(flags) } == 0 {
            return Err("Could not update display execution state".into());
        }
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    { let _ = enabled; return Err("Display sleep adapter unavailable".into()); }
    #[allow(unreachable_code)]
    Ok(())
}

#[tauri::command]
pub async fn set_keep_awake(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let (send, receive) = std::sync::mpsc::sync_channel(1);
    app.run_on_main_thread(move || { let _ = send.send(apply(enabled)); })
        .map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || receive.recv())
        .await.map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())?
}
