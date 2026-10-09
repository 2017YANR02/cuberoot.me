#[tauri::command]
pub async fn print_document(window: tauri::WebviewWindow, title: String) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        use std::sync::atomic::{AtomicBool, Ordering};
        static PRINTING: AtomicBool = AtomicBool::new(false);
        let title = std::ffi::CString::new(title).map_err(|_| "Invalid print title")?;
        if PRINTING.swap(true, Ordering::SeqCst) { return Err("Printing already active".into()); }
        let (send, receive) = std::sync::mpsc::sync_channel(1);
        let scheduled = window.with_webview(move |webview| {
            unsafe extern "C" { fn cuberoot_print(view: *mut std::ffi::c_void, title: *const std::ffi::c_char) -> i32; }
            // The WKWebView and CString remain alive during this main-thread call.
            let result = unsafe { cuberoot_print(webview.inner(), title.as_ptr()) };
            PRINTING.store(false, Ordering::SeqCst);
            let _ = send.send(result);
        });
        if let Err(error) = scheduled {
            PRINTING.store(false, Ordering::SeqCst);
            return Err(error.to_string());
        }
        let result = tauri::async_runtime::spawn_blocking(move || receive.recv())
            .await.map_err(|error| error.to_string())?.map_err(|error| error.to_string())?;
        if result < 0 { return Err("System printing unavailable".into()); }
        Ok(true) // Includes user cancellation; the panel really finished.
    }
    #[cfg(not(target_os = "macos"))]
    { let _ = (window, title); Ok(false) }
}
