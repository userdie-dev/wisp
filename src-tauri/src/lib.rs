mod commands;
mod webview_manager;

use tauri::Manager;
use webview_manager::TabRegistry;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        // Auto-update from GitHub Releases — see docs/features/auto-update.md.
        // `process` is needed for the post-install relaunch.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(TabRegistry::default())
        .invoke_handler(tauri::generate_handler![
            commands::tabs_create,
            commands::tabs_close,
            commands::tabs_activate,
            commands::tabs_navigate,
            commands::tabs_back,
            commands::tabs_forward,
            commands::tabs_reload,
            commands::show_internal_page,
            commands::set_content_bounds,
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
