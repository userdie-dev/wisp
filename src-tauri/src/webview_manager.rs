use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::menu::{Menu, MenuBuilder};
use tauri::webview::DownloadEvent;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Webview, WebviewBuilder, WebviewUrl,
    Window, Wry,
};
use url::Url;

/// Injected into every content webview. Bridges page-side clicks / context
/// menus back to the chrome side over a `wisp://` sentinel navigation — see
/// `handle_bridge` below and docs/features/new-tab-and-context-menu.md.
const CONTENT_SCRIPT: &str = include_str!("content_script.js");

/// Pixel rect of the "hole" in the chrome webview where the active tab's
/// content webview (or nothing, if an internal page is shown) is drawn.
/// Reported by the frontend via `set_content_bounds` from a ResizeObserver on
/// the content placeholder element — see src/composables/useContentBounds.ts.
#[derive(Clone, Copy, Debug)]
pub struct ContentBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl Default for ContentBounds {
    fn default() -> Self {
        // Sane fallback matching the default sidebar/toolbar CSS sizes, used
        // only for the brief window before the frontend's first measurement.
        Self { x: 260.0, y: 48.0, width: 940.0, height: 752.0 }
    }
}

#[derive(Default)]
pub struct TabRegistry {
    /// Tab ids in creation order. The Webview itself is looked up on demand
    /// via `app.get_webview(&label_for(id))` rather than stored here, so this
    /// struct stays plain data behind one lock.
    order: Mutex<Vec<String>>,
    active: Mutex<Option<ActiveContent>>,
    bounds: Mutex<ContentBounds>,
    /// Per-tab navigation history, keyed by tab id. `Arc` because a clone is
    /// captured into each webview's `'static` `on_navigation` closure.
    /// See docs/features/navigation-state.md.
    nav: Arc<Mutex<HashMap<String, NavHistory>>>,
    /// Context gathered from the last right-click in a content webview, read
    /// back by the `on_menu_event` handler in lib.rs when an item is chosen.
    /// See docs/features/new-tab-and-context-menu.md.
    menu_context: Arc<Mutex<Option<MenuContext>>>,
    /// The last context `Menu` — kept alive here so it isn't dropped out from
    /// under an in-flight popup (GTK popups are async).
    context_menu: Arc<Mutex<Option<Menu<Wry>>>>,
    /// Override for the download destination directory. `None` = the OS
    /// "Downloads" folder. Set from the frontend via `downloads_set_dir`.
    downloads_dir: Arc<Mutex<Option<PathBuf>>>,
    /// Monotonic id source for download events.
    download_seq: Arc<AtomicU64>,
}

/// What the cursor was over when a content webview's context menu was opened.
#[derive(Clone, Default)]
pub struct MenuContext {
    pub tab_id: String,
    pub link_url: Option<String>,
    pub src_url: Option<String>,
    pub selection_text: Option<String>,
}

/// Reconstructed back/forward history for one tab. Tauri exposes no
/// cross-platform `can_go_back`/`can_go_forward`, so it is rebuilt from
/// `WebviewBuilder::on_navigation` callbacks — see
/// docs/features/navigation-state.md.
#[derive(Default)]
struct NavHistory {
    entries: Vec<String>,
    index: usize,
}

/// Folds one observed navigation into the history model.
fn apply_navigation(history: &mut NavHistory, url: &str) {
    if history.entries.is_empty() {
        history.entries.push(url.to_string());
        history.index = 0;
        return;
    }
    let is_forward = history
        .entries
        .get(history.index + 1)
        .is_some_and(|next| next == url);
    let is_back = history.index > 0 && history.entries[history.index - 1] == url;
    if is_forward {
        history.index += 1;
    } else if is_back {
        history.index -= 1;
    } else if history.entries[history.index] == url {
        // Same URL as the current entry (reload) — nothing changes.
    } else {
        history.entries.truncate(history.index + 1);
        history.entries.push(url.to_string());
        history.index = history.entries.len() - 1;
    }
}

#[derive(Clone, PartialEq)]
enum ActiveContent {
    Tab(String),
    InternalPage,
}

fn label_for(tab_id: &str) -> String {
    format!("tab-{tab_id}")
}

#[derive(Serialize, Clone)]
pub struct TabCreated {
    pub id: String,
    pub url: String,
}

impl TabRegistry {
    fn webview(&self, app: &AppHandle, tab_id: &str) -> Option<Webview> {
        app.get_webview(&label_for(tab_id))
    }

    pub fn create_tab(
        &self,
        app: &AppHandle,
        window: &Window,
        id: String,
        url: String,
    ) -> tauri::Result<TabCreated> {
        let bounds = *self.bounds.lock().unwrap();
        let parsed_url: Url = url.parse().map_err(tauri::Error::InvalidUrl)?;

        let app_for_load = app.clone();
        let tab_id_for_load = id.clone();
        let app_for_title = app.clone();
        let tab_id_for_title = id.clone();
        let app_for_nav = app.clone();
        let tab_id_for_nav = id.clone();
        let nav_for_nav = self.nav.clone();
        let window_for_nav = window.clone();

        let app_for_dl = app.clone();
        let dl_dir = self.downloads_dir.clone();
        let dl_seq = self.download_seq.clone();

        // Bounds are set explicitly on activate/resize instead of via
        // `auto_resize()`, since the content webview must track a rect
        // smaller than the full window (sidebar + toolbar stay outside it).
        // Load/title/navigation callbacks are registered on the builder (Tauri
        // fires them for the webview being constructed) and forwarded to the
        // frontend as `tab-updated` / `tab-nav-state`, which the tabs store and
        // the history store listen to.
        let builder = WebviewBuilder::new(label_for(&id), WebviewUrl::External(parsed_url))
            .on_page_load(move |wv, payload| {
                let event = payload.event();
                if matches!(event, tauri::webview::PageLoadEvent::Started) {
                    let _ = app_for_load.emit(
                        "tab-updated",
                        serde_json::json!({ "id": tab_id_for_load, "loading": true }),
                    );
                } else if matches!(event, tauri::webview::PageLoadEvent::Finished) {
                    let _ = app_for_load.emit(
                        "tab-updated",
                        serde_json::json!({
                            "id": tab_id_for_load,
                            "url": wv.url().map(|u| u.to_string()).unwrap_or_default(),
                            "loading": false,
                        }),
                    );
                }
            })
            .on_document_title_changed(move |wv, title| {
                let _ = app_for_title.emit(
                    "tab-updated",
                    serde_json::json!({
                        "id": tab_id_for_title,
                        "title": title,
                        "url": wv.url().map(|u| u.to_string()).unwrap_or_default(),
                    }),
                );
            })
            // Observes every real navigation (link clicks, redirects, form
            // submits, page-initiated history traversal, and our own
            // `tabs_back/forward/reload` evals) to keep the per-tab history
            // model current, then pushes the derived back/forward availability
            // to the frontend — see docs/features/navigation-state.md.
            //
            // Also the transport for the injected content script: a `wisp://`
            // URL is a message, not a navigation — handle it and cancel.
            .on_navigation(move |url| {
                if url.scheme() == "wisp" {
                    handle_bridge(&app_for_nav, &tab_id_for_nav, &window_for_nav, url);
                    return false;
                }
                let mut map = nav_for_nav.lock().unwrap();
                let history = map.entry(tab_id_for_nav.clone()).or_default();
                apply_navigation(history, url.as_str());
                let _ = app_for_nav.emit(
                    "tab-nav-state",
                    serde_json::json!({
                        "id": tab_id_for_nav,
                        "canGoBack": history.index > 0,
                        "canGoForward": history.index + 1 < history.entries.len(),
                    }),
                );
                true
            })
            .initialization_script(CONTENT_SCRIPT)
            // WebView2 / WebKit download interception. Wry only surfaces
            // request + finish (no byte progress) — see
            // docs/features/downloads.md.
            .on_download(move |_webview, event| {
                match event {
                    DownloadEvent::Requested { url, destination } => {
                        let dir = dl_dir
                            .lock()
                            .unwrap()
                            .clone()
                            .or_else(|| app_for_dl.path().download_dir().ok())
                            .unwrap_or_else(|| PathBuf::from("."));
                        let _ = std::fs::create_dir_all(&dir);
                        let path = unique_path(&dir, &file_name_from_url(&url));
                        *destination = path.clone();
                        let id = dl_seq.fetch_add(1, Ordering::Relaxed);
                        let _ = app_for_dl.emit(
                            "download-started",
                            serde_json::json!({
                                "id": id.to_string(),
                                "url": url.to_string(),
                                "filename": path
                                    .file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or("download"),
                                "path": path.to_string_lossy(),
                            }),
                        );
                    }
                    DownloadEvent::Finished { url, path, success } => {
                        let _ = app_for_dl.emit(
                            "download-finished",
                            serde_json::json!({
                                "url": url.to_string(),
                                "path": path.as_ref().map(|p| p.to_string_lossy().to_string()),
                                "success": success,
                            }),
                        );
                    }
                    _ => {}
                }
                true
            });

        // Created hidden at the current content rect; `activate_tab` brings it
        // to front. Kept alive (not closed) while the tab exists so switching
        // back preserves scroll position and in-page state.
        let webview = window.add_child(
            builder,
            LogicalPosition::new(bounds.x, bounds.y),
            LogicalSize::new(bounds.width, bounds.height),
        )?;
        webview.hide()?;

        // Seed the history with the initial URL so the first `on_navigation`
        // (fired for the initial load, or not, depending on the platform) is a
        // no-op rather than a spurious second entry. A redirecting start URL
        // still produces one — documented in navigation-state.md.
        self.nav.lock().unwrap().insert(
            id.clone(),
            NavHistory { entries: vec![url.clone()], index: 0 },
        );
        self.order.lock().unwrap().push(id.clone());
        Ok(TabCreated { id, url })
    }

    pub fn close_tab(&self, app: &AppHandle, tab_id: &str) -> tauri::Result<()> {
        if let Some(webview) = self.webview(app, tab_id) {
            webview.close()?;
        }
        self.order.lock().unwrap().retain(|id| id != tab_id);
        self.nav.lock().unwrap().remove(tab_id);
        let mut active = self.active.lock().unwrap();
        if *active == Some(ActiveContent::Tab(tab_id.to_string())) {
            *active = None;
        }
        Ok(())
    }

    pub fn activate_tab(&self, app: &AppHandle, tab_id: &str) -> tauri::Result<()> {
        self.hide_current(app)?;
        if let Some(webview) = self.webview(app, tab_id) {
            let bounds = *self.bounds.lock().unwrap();
            webview.set_position(LogicalPosition::new(bounds.x, bounds.y))?;
            webview.set_size(LogicalSize::new(bounds.width, bounds.height))?;
            webview.show()?;
        }
        *self.active.lock().unwrap() = Some(ActiveContent::Tab(tab_id.to_string()));
        Ok(())
    }

    pub fn show_internal_page(&self, app: &AppHandle) -> tauri::Result<()> {
        self.hide_current(app)?;
        *self.active.lock().unwrap() = Some(ActiveContent::InternalPage);
        Ok(())
    }

    fn hide_current(&self, app: &AppHandle) -> tauri::Result<()> {
        let active = self.active.lock().unwrap().clone();
        if let Some(ActiveContent::Tab(id)) = active {
            if let Some(webview) = self.webview(app, &id) {
                webview.hide()?;
            }
        }
        Ok(())
    }

    pub fn navigate(&self, app: &AppHandle, tab_id: &str, url: &str) -> tauri::Result<()> {
        if let Some(webview) = self.webview(app, tab_id) {
            let parsed: Url = url.parse().map_err(tauri::Error::InvalidUrl)?;
            webview.navigate(parsed)?;
        }
        Ok(())
    }

    pub fn eval_on_tab(&self, app: &AppHandle, tab_id: &str, script: &str) -> tauri::Result<()> {
        if let Some(webview) = self.webview(app, tab_id) {
            webview.eval(script)?;
        }
        Ok(())
    }

    pub fn set_bounds(&self, bounds: ContentBounds) {
        *self.bounds.lock().unwrap() = bounds;
    }

    pub fn resize_active(&self, app: &AppHandle) -> tauri::Result<()> {
        let active = self.active.lock().unwrap().clone();
        if let Some(ActiveContent::Tab(id)) = active {
            if let Some(webview) = self.webview(app, &id) {
                let bounds = *self.bounds.lock().unwrap();
                webview.set_position(LogicalPosition::new(bounds.x, bounds.y))?;
                webview.set_size(LogicalSize::new(bounds.width, bounds.height))?;
            }
        }
        Ok(())
    }

    /// The context of the last content-webview right-click, consumed by the
    /// `on_menu_event` handler in lib.rs.
    pub fn menu_context(&self) -> Option<MenuContext> {
        self.menu_context.lock().unwrap().clone()
    }

    pub fn set_menu_context(&self, ctx: MenuContext) {
        *self.menu_context.lock().unwrap() = Some(ctx);
    }

    pub fn retain_context_menu(&self, menu: Menu<Wry>) {
        *self.context_menu.lock().unwrap() = Some(menu);
    }

    /// Effective download directory as a string (the override, else the OS
    /// "Downloads" folder, else the process working directory).
    pub fn downloads_dir(&self, app: &AppHandle) -> String {
        self.downloads_dir
            .lock()
            .unwrap()
            .clone()
            .or_else(|| app.path().download_dir().ok())
            .unwrap_or_else(|| PathBuf::from("."))
            .to_string_lossy()
            .to_string()
    }

    pub fn set_downloads_dir(&self, dir: Option<PathBuf>) {
        *self.downloads_dir.lock().unwrap() = dir;
    }
}

/// Handles a `wisp://ipc/?k=<kind>&p=<json>` sentinel navigation from the
/// injected content script. Runs on the main thread (Wry navigation callback).
fn handle_bridge(app: &AppHandle, tab_id: &str, window: &Window, url: &Url) {
    let mut kind = String::new();
    let mut payload = serde_json::Value::Null;
    for (key, value) in url.query_pairs() {
        match key.as_ref() {
            "k" => kind = value.into_owned(),
            "p" => {
                payload = serde_json::from_str(value.as_ref()).unwrap_or(serde_json::Value::Null)
            }
            _ => {}
        }
    }

    match kind.as_str() {
        "newtab" => {
            if let Some(target) = payload.get("url").and_then(|v| v.as_str()) {
                let background = payload
                    .get("background")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                let _ = app.emit(
                    "tab-open-request",
                    serde_json::json!({ "url": target, "background": background }),
                );
            }
        }
        "contextmenu" => {
            let ctx = MenuContext {
                tab_id: tab_id.to_string(),
                link_url: json_str(&payload, "linkUrl"),
                src_url: json_str(&payload, "srcUrl"),
                selection_text: json_str(&payload, "selectionText"),
            };
            let registry = app.state::<TabRegistry>();
            registry.set_menu_context(ctx.clone());
            if let Ok(menu) = build_context_menu(app, &ctx) {
                registry.retain_context_menu(menu.clone());
                let _ = window.popup_menu(&menu);
            }
        }
        _ => {}
    }
}

fn json_str(value: &serde_json::Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

/// Builds the native right-click menu; item ids are matched in lib.rs's
/// `on_menu_event`. Only sections relevant to what was clicked are shown.
fn build_context_menu(app: &AppHandle, ctx: &MenuContext) -> tauri::Result<Menu<Wry>> {
    let mut builder = MenuBuilder::new(app);
    if ctx.link_url.is_some() {
        builder = builder
            .text("wisp:open-new-tab", "Открыть ссылку в новой вкладке")
            .text("wisp:open-background", "Открыть ссылку в фоновой вкладке")
            .text("wisp:copy-link", "Копировать адрес ссылки")
            .separator();
    }
    if ctx.src_url.is_some() {
        builder = builder
            .text("wisp:open-image", "Открыть изображение в новой вкладке")
            .text("wisp:copy-image", "Копировать адрес изображения")
            .separator();
    }
    if ctx.selection_text.is_some() {
        builder = builder
            .text("wisp:copy", "Копировать")
            .text("wisp:search", "Найти в поисковике")
            .separator();
    }
    builder
        .text("wisp:back", "Назад")
        .text("wisp:forward", "Вперёд")
        .text("wisp:reload", "Обновить")
        .build()
}

/// Last path segment of a URL, lightly sanitised for use as a file name.
fn file_name_from_url(url: &Url) -> String {
    let raw = url
        .path_segments()
        .and_then(|segments| segments.last())
        .unwrap_or("")
        .replace("%20", " ");
    let cleaned: String = raw
        .chars()
        .filter(|c| !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0'))
        .collect();
    let trimmed = cleaned.trim();
    if trimmed.is_empty() {
        "download".to_string()
    } else {
        trimmed.to_string()
    }
}

/// `dir/name`, or `dir/name (n).ext` if that already exists.
fn unique_path(dir: &Path, name: &str) -> PathBuf {
    let first = dir.join(name);
    if !first.exists() {
        return first;
    }
    let as_path = Path::new(name);
    let stem = as_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("download");
    let ext = as_path.extension().and_then(|s| s.to_str());
    for n in 1..1000 {
        let candidate = match ext {
            Some(ext) => dir.join(format!("{stem} ({n}).{ext}")),
            None => dir.join(format!("{stem} ({n})")),
        };
        if !candidate.exists() {
            return candidate;
        }
    }
    first
}

#[cfg(test)]
mod tests {
    use super::{apply_navigation, NavHistory};

    fn history_after(urls: &[&str]) -> NavHistory {
        let mut history = NavHistory::default();
        for url in urls {
            apply_navigation(&mut history, url);
        }
        history
    }

    #[test]
    fn linear_navigation_appends_entries() {
        let h = history_after(&["a", "b", "c"]);
        assert_eq!(h.entries, ["a", "b", "c"]);
        assert_eq!(h.index, 2);
    }

    #[test]
    fn back_then_forward_moves_the_index_without_growing() {
        let mut h = history_after(&["a", "b", "c"]);
        apply_navigation(&mut h, "b");
        assert_eq!(h.index, 1);
        apply_navigation(&mut h, "a");
        assert_eq!(h.index, 0);
        apply_navigation(&mut h, "b");
        assert_eq!(h.index, 1);
        assert_eq!(h.entries.len(), 3);
    }

    #[test]
    fn new_navigation_after_going_back_truncates_the_forward_entries() {
        let mut h = history_after(&["a", "b", "c"]);
        apply_navigation(&mut h, "b"); // back
        apply_navigation(&mut h, "x"); // new branch
        assert_eq!(h.entries, ["a", "b", "x"]);
        assert_eq!(h.index, 2);
    }

    #[test]
    fn reloading_the_current_url_changes_nothing() {
        let mut h = history_after(&["a", "b"]);
        apply_navigation(&mut h, "b");
        assert_eq!(h.entries, ["a", "b"]);
        assert_eq!(h.index, 1);
    }
}
