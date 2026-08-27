mod commands;
mod webview_manager;

use tauri::menu::MenuEvent;
use tauri::{AppHandle, Emitter, Manager};
use webview_manager::{MenuContext, TabRegistry};

/// Applies real OS-level window blur/vibrancy (not just a translucent CSS
/// background) so the sidebar/toolbar show the desktop behind them blurred.
/// See docs/features/window-transparency.md for the reasoning and the
/// per-platform fallback chain.
fn apply_window_effects(window: &tauri::WebviewWindow) {
    #[cfg(target_os = "windows")]
    {
        use window_vibrancy::{apply_acrylic, apply_blur, apply_mica};

        if apply_mica(window, None).is_err() {
            if apply_acrylic(window, Some((18, 18, 18, 125))).is_err() {
                let _ = apply_blur(window, Some((18, 18, 18, 125)));
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

        let _ = apply_vibrancy(window, NSVisualEffectMaterial::Sidebar, None, None);
    }

    // Linux: window-vibrancy has no compositor-level blur support here: the
    // window stays transparent (set via tauri.conf.json) but without blur,
    // depending entirely on the user's own compositor — see
    // docs/features/window-transparency.md, "Известные ограничения".
}

/// Native context-menu clicks from a content webview. The menu is built in
/// `webview_manager::build_context_menu`; the context (link/image/selection) is
/// stashed on the `TabRegistry` by the `wisp://` bridge. Item actions are just
/// events — the frontend already owns tab/omnibox/clipboard behaviour.
/// See docs/features/new-tab-and-context-menu.md.
fn handle_menu_event(app: &AppHandle, event: MenuEvent) {
    let id: &str = event.id.as_ref();
    let Some(action) = id.strip_prefix("wisp:") else {
        return;
    };
    let Some(ctx) = app.state::<TabRegistry>().menu_context() else {
        return;
    };
    let MenuContext { tab_id, link_url, src_url, selection_text } = ctx;

    match action {
        "open-new-tab" => emit_open(app, link_url, false),
        "open-background" => emit_open(app, link_url, true),
        "open-image" => emit_open(app, src_url, false),
        "copy-link" => emit_copy(app, link_url),
        "copy-image" => emit_copy(app, src_url),
        "copy" => emit_copy(app, selection_text),
        "search" => {
            if let Some(text) = selection_text {
                let _ = app.emit("wisp-search", text);
            }
        }
        "back" | "forward" | "reload" => {
            let _ = app.emit(
                "wisp-tab-command",
                serde_json::json!({ "id": tab_id, "command": action }),
            );
        }
        _ => {}
    }
}

fn emit_open(app: &AppHandle, url: Option<String>, background: bool) {
    if let Some(url) = url {
        let _ = app.emit(
            "tab-open-request",
            serde_json::json!({ "url": url, "background": background }),
        );
    }
}

fn emit_copy(app: &AppHandle, text: Option<String>) {
    if let Some(text) = text {
        use tauri_plugin_clipboard_manager::ClipboardExt;
        let _ = app.clipboard().write_text(text);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        // Auto-update from GitHub Releases — see docs/features/auto-update.md.
        // `process` is needed for the post-install relaunch.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // Downloads manager: open / reveal finished files, pick a folder.
        // See docs/features/downloads.md.
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(TabRegistry::default())
        .on_menu_event(handle_menu_event)
        .invoke_handler(tauri::generate_handler![
            commands::tabs_create,
            commands::tabs_close,
            commands::tabs_activate,
            commands::tabs_navigate,
            commands::tabs_back,
            commands::tabs_forward,
            commands::tabs_reload,
            commands::tabs_stop,
            commands::show_internal_page,
            commands::set_content_bounds,
            commands::downloads_dir,
            commands::downloads_set_dir,
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                apply_window_effects(&window);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the browser application");
}
