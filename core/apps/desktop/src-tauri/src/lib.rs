mod screen_awake;
use keyring::{Entry, Error as KeyringError};
use tauri::Manager;

mod ble_notifications;
mod ble_address;
mod file_export;
mod native_print;

const SERVICE: &str = "me.cuberoot.app";

#[tauri::command]
fn prepare_auth_callback(_app: tauri::AppHandle) -> Result<(), String> {
    // Standalone Windows binaries have no installer to register their login callback.
    // Register only when signing in, not every time a second installation is launched.
    #[cfg(target_os = "windows")]
    {
        use tauri_plugin_deep_link::DeepLinkExt;
        _app.deep_link().register_all().map_err(|error| error.to_string())?;
    }
    Ok(())
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
    tauri::Builder::default()
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
        .on_window_event(|_, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                let _ = screen_awake::apply(false);
            }
        })
        .invoke_handler(tauri::generate_handler![prepare_auth_callback, screen_awake::set_keep_awake, native_print::print_document, file_export::export_file, secure_get, secure_set, secure_remove, ble_notifications::ble_subscribe, ble_address::ble_device_mac])
        .run(tauri::generate_context!())
        .expect("error while running CubeRoot");
}
