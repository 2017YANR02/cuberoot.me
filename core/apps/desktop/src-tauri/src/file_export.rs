use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn export_file(app: tauri::AppHandle, text: String, filename: String) -> Result<bool, String> {
    if filename.is_empty() || filename == "." || filename == ".." || filename.contains(['/', '\\', '\0']) {
        return Err("Invalid filename".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let Some(file) = app.dialog().file().set_file_name(&filename).blocking_save_file() else { return Ok(false); };
        let path = file.into_path().map_err(|error| error.to_string())?;
        std::fs::write(path, text.as_bytes()).map_err(|error| error.to_string())?;
        Ok(true)
    }).await.map_err(|error| error.to_string())?
}
