use keyring::{Entry, Error as KeyringError};
use tauri::Manager;

mod ble_notifications;
mod ble_address;
mod file_export;
mod native_print;

const SERVICE: &str = "me.cuberoot.app";

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
        .invoke_handler(tauri::generate_handler![native_print::print_document, file_export::export_file, secure_get, secure_set, secure_remove, ble_notifications::ble_subscribe, ble_address::ble_device_mac])
        .run(tauri::generate_context!())
        .expect("error while running CubeRoot");
}
