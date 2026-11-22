#[tauri::command]
pub async fn render_primary_navigation(
    window: tauri::WebviewWindow,
    state: Option<serde_json::Value>,
) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        use std::ffi::{c_char, c_void, CString};

        unsafe extern "C" {
            fn cuberoot_render_primary_navigation(view: *mut c_void, state: *const c_char) -> bool;
        }

        let json = CString::new(state.unwrap_or(serde_json::Value::Null).to_string())
            .map_err(|error| error.to_string())?;
        let (send, mut receive) = tauri::async_runtime::channel(1);
        window
            .with_webview(move |view| {
                // Both pointers remain valid for this call on AppKit's main thread.
                let rendered = unsafe { cuberoot_render_primary_navigation(view.inner(), json.as_ptr()) };
                let _ = send.try_send(rendered);
            })
            .map_err(|error| error.to_string())?;
        Ok(receive.recv().await.unwrap_or(false))
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, state);
        Ok(false)
    }
}
