use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle,
};

// Keep the standard Edit, Window and application menus and their native shortcuts.
#[tauri::command]
pub fn configure_navigation_menu(app: AppHandle, language: String) -> Result<(), String> {
    install(&app, language == "zh").map_err(|error| error.to_string())
}

fn install(app: &AppHandle, chinese: bool) -> tauri::Result<()> {
    let menu = Menu::default(app)?;
    let title = if chinese { "显示" } else { "View" };
    let existing = menu.items()?.into_iter().find_map(|item| {
        let sub = item.as_submenu()?;
        (sub.text().ok()?.as_str() == "View").then(|| sub.clone())
    });
    let view = match existing {
        Some(view) => {
            view.set_text(title)?;
            view.append(&PredefinedMenuItem::separator(app)?)?;
            view
        }
        None => {
            let view = Submenu::new(app, title, true)?;
            menu.insert(&view, 2)?;
            view
        }
    };
    let back = if cfg!(target_os = "macos") {
        "Cmd+BracketLeft"
    } else {
        "Alt+ArrowLeft"
    };
    for (id, zh, en, shortcut) in [
        ("timer", "计时", "Timer", "CmdOrCtrl+1"),
        ("tools", "工具", "Tools", "CmdOrCtrl+2"),
        ("account", "我的", "Account", "CmdOrCtrl+3"),
        ("back", "返回上一个工具页面", "Go Back in Tools", back),
        (
            "refresh",
            "刷新当前工具页面",
            "Reload Current Tool",
            "CmdOrCtrl+R",
        ),
        ("search", "搜索工具", "Search Tools", "CmdOrCtrl+K"),
    ] {
        if id == "back" {
            view.append(&PredefinedMenuItem::separator(app)?)?;
        }
        let item = MenuItem::with_id(
            app,
            format!("nav-{id}"),
            if chinese { zh } else { en },
            true,
            Some(shortcut),
        )?;
        view.append(&item)?;
    }
    app.set_menu(menu)?;
    Ok(())
}
