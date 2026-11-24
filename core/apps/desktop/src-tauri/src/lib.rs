mod navigation_menu;
mod screen_awake;
use keyring::{Entry, Error as KeyringError};
use tauri::{Emitter, Manager};

mod ble_notifications;
mod ble_address;
mod file_export;
mod native_print;
mod primary_navigation;

const SERVICE: &str = if cfg!(all(target_os = "macos", debug_assertions)) {
    "me.cuberoot.desktop.debug"
} else if cfg!(all(target_os = "macos", not(feature = "mac-app-store"))) {
    "me.cuberoot.desktop"
} else {
    // Preserve existing Mac App Store sessions across updates.
    "me.cuberoot.app"
};

#[tauri::command]
fn copy_text(text: String) -> Result<(), String> {
    arboard::Clipboard::new()
        .and_then(|mut clipboard| clipboard.set_text(text))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn desktop_distribution() -> &'static str {
    if cfg!(all(target_os = "windows", feature = "microsoft-store")) {
        "microsoft-store"
    } else if cfg!(all(target_os = "macos", feature = "mac-app-store")) {
        "mac-app-store"
    } else {
        "direct"
    }
}

#[tauri::command]
fn prepare_auth_callback(_app: tauri::AppHandle) -> Result<(), String> {
    // Standalone Windows binaries have no installer to register their login callback.
    // Register only when signing in, not every time a second installation is launched.
    // MSIX owns protocol registration through AppxManifest.xml. Never overwrite
    // that association with the executable's versioned WindowsApps path.
    #[cfg(all(target_os = "windows", not(feature = "microsoft-store")))]
    {
        use tauri_plugin_deep_link::DeepLinkExt;
        _app.deep_link().register_all().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn open_web_link(window: tauri::WebviewWindow, href: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let url = tauri::Url::parse(&href).map_err(|_| "Invalid website URL")?;
        if window.label() != "main"
            || !matches!(url.scheme(), "http" | "https")
            || url.host_str().is_none()
            || href.len() > 8192
        {
            return Err("Unsupported website URL".into());
        }
        let href = std::ffi::CString::new(url.as_str()).map_err(|_| "Invalid website URL")?;
        window.run_on_main_thread(move || {
            unsafe extern "C" { fn cuberoot_open_web_link(href: *const std::ffi::c_char); }
            unsafe { cuberoot_open_web_link(href.as_ptr()); }
        }).map_err(|error| error.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, href);
        Err("In-app web window unavailable".into())
    }
}

fn entry(key: &str) -> Result<Entry, String> {
    if !matches!(key, "session" | "pending_auth" | "net_battle_session") {
        return Err("unsupported secure-storage key".into());
    }
    Entry::new(SERVICE, key).map_err(|error| error.to_string())
}

#[tauri::command]
fn secure_get(key: String) -> Result<Option<String>, String> {
    match entry(&key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn secure_set(key: String, value: String) -> Result<(), String> {
    entry(&key)?.set_password(&value).map_err(|error| error.to_string())
}

#[tauri::command]
fn secure_remove(key: String) -> Result<(), String> {
    match entry(&key)?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

pub fn run() {
    let layout_script = format!(
        "(() => {{ const parentOrigins = ['tauri://localhost', 'https://tauri.localhost', 'http://127.0.0.1:1420']; const styles = {};\n(() => {{ {} }})();\n{}\n}})();",
        serde_json::json!(include_str!("../../../../packages/app-ui/src/embedded-layout.css")),
        include_str!("../../../../packages/app-ui/src/embedded-layout.js"),
        include_str!("tools-input.js")
    );
    tauri::Builder::default()
        .plugin(tauri::plugin::Builder::<_>::new("embedded-layout").js_init_script_on_all_frames(layout_script).build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_blec::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|_app| {
            #[cfg(target_os = "windows")]
            if let Some(window) = _app.get_webview_window("main") {
                use windows_sys::Win32::UI::WindowsAndMessaging::*;
                let hwnd = window.hwnd()?.0;
                // Suppress the caption icon and its fallback while keeping the large shell icon.
                unsafe {
                    let style = GetWindowLongW(hwnd, GWL_EXSTYLE);
                    SetWindowLongW(hwnd, GWL_EXSTYLE, style | WS_EX_DLGMODALFRAME as i32);
                    SendMessageW(hwnd, WM_SETICON, ICON_SMALL as usize, 0);
                    SetWindowPos(hwnd, std::ptr::null_mut(), 0, 0, 0, 0,
                        SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);
                }
            }
            #[cfg(target_os = "macos")]
            if let Some(window) = _app.get_webview_window("main") {
                window.with_webview(|view| {
                    unsafe extern "C" { fn cuberoot_install_tools_search(view: *mut std::ffi::c_void); }
                    unsafe { cuberoot_install_tools_search(view.inner()); }
                })?;
            }
            Ok(())
        })
        .on_menu_event(|app, event| {
            if let Some(command) = event.id().as_ref().strip_prefix("nav-") {
                let _ = app.emit_to("main", "desktop-navigation", command);
            }
        })
        .on_window_event(|_, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                let _ = screen_awake::apply(false);
            }
        })
        .invoke_handler(tauri::generate_handler![copy_text, navigation_menu::configure_navigation_menu, primary_navigation::render_primary_navigation, desktop_distribution, prepare_auth_callback, open_web_link, screen_awake::set_keep_awake, native_print::print_document, file_export::export_file, secure_get, secure_set, secure_remove, ble_notifications::ble_subscribe, ble_address::ble_device_mac])
        .run(tauri::generate_context!())
        .expect("error while running CubeRoot");
}
