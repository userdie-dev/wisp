use tauri::{AppHandle, Manager, State};

use crate::webview_manager::{ContentBounds, TabCreated, TabRegistry};

/// Label of the single chrome window declared in tauri.conf.json. Looked up
/// explicitly (rather than relying on an injected `Window`/`WebviewWindow`
/// command parameter) since this app only ever has the one window.
const MAIN_WINDOW: &str = "main";

fn to_string_err<T>(result: tauri::Result<T>) -> Result<T, String> {
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn tabs_create(
    app: AppHandle,
    id: String,
    url: String,
    registry: State<'_, TabRegistry>,
) -> Result<TabCreated, String> {
    let window = app
        .get_window(MAIN_WINDOW)
        .ok_or_else(|| "main window not found".to_string())?;
    to_string_err(registry.create_tab(&app, &window, id, url))
}

#[tauri::command]
pub fn tabs_close(
    app: AppHandle,
    id: String,
    registry: State<'_, TabRegistry>,
) -> Result<(), String> {
    to_string_err(registry.close_tab(&app, &id))
}

#[tauri::command]
pub fn tabs_activate(
    app: AppHandle,
    id: String,
    registry: State<'_, TabRegistry>,
) -> Result<(), String> {
    to_string_err(registry.activate_tab(&app, &id))
}

#[tauri::command]
pub fn tabs_navigate(
    app: AppHandle,
    id: String,
    url: String,
    registry: State<'_, TabRegistry>,
) -> Result<(), String> {
    to_string_err(registry.navigate(&app, &id, &url))
}

#[tauri::command]
pub fn tabs_back(
    app: AppHandle,
    id: String,
    registry: State<'_, TabRegistry>,
) -> Result<(), String> {
    to_string_err(registry.eval_on_tab(&app, &id, "window.history.back()"))
}

#[tauri::command]
pub fn tabs_forward(
    app: AppHandle,
    id: String,
    registry: State<'_, TabRegistry>,
) -> Result<(), String> {
    to_string_err(registry.eval_on_tab(&app, &id, "window.history.forward()"))
}

#[tauri::command]
pub fn tabs_reload(
    app: AppHandle,
    id: String,
    registry: State<'_, TabRegistry>,
) -> Result<(), String> {
    to_string_err(registry.eval_on_tab(&app, &id, "window.location.reload()"))
}

#[tauri::command]
pub fn show_internal_page(
    app: AppHandle,
    registry: State<'_, TabRegistry>,
) -> Result<(), String> {
    to_string_err(registry.show_internal_page(&app))
}

/// Reported by a ResizeObserver on the frontend's content placeholder element
/// every time the sidebar/toolbar layout changes — see
/// src/composables/useContentBounds.ts and docs/architecture.md.
#[tauri::command]
pub fn set_content_bounds(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    registry: State<'_, TabRegistry>,
) -> Result<(), String> {
    registry.set_bounds(ContentBounds { x, y, width, height });
    to_string_err(registry.resize_active(&app))
}
