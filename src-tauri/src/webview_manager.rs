use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Webview, WebviewBuilder, WebviewUrl, Window};
use url::Url;

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

        // Bounds are set explicitly on activate/resize instead of via
        // `auto_resize()`, since the content webview must track a rect
        // smaller than the full window (sidebar + toolbar stay outside it).
        // Load/title callbacks are registered on the builder (Tauri fires
        // them for the webview being constructed) and forwarded to the
        // frontend as `tab-updated`, which both the tabs store and the
        // history store listen to.
        let builder = WebviewBuilder::new(label_for(&id), WebviewUrl::External(parsed_url))
            .on_page_load(move |wv, payload| {
                if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                    let _ = app_for_load.emit(
                        "tab-updated",
                        serde_json::json!({
                            "id": tab_id_for_load,
                            "url": wv.url().map(|u| u.to_string()).unwrap_or_default(),
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

        self.order.lock().unwrap().push(id.clone());
        Ok(TabCreated { id, url })
    }

    pub fn close_tab(&self, app: &AppHandle, tab_id: &str) -> tauri::Result<()> {
        if let Some(webview) = self.webview(app, tab_id) {
            webview.close()?;
        }
        self.order.lock().unwrap().retain(|id| id != tab_id);
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
}
