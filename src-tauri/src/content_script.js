// Injected into every content webview via `WebviewBuilder::initialization_script`
// (runs before page scripts, in the main world, not subject to page CSP).
//
// The system webview owns the page DOM, so anything the chrome (Vue) side needs
// to know about clicks / context menus has to originate here. There is no IPC
// channel to a remote page, so this talks back by navigating to a `wisp://`
// sentinel URL that Rust's `on_navigation` handler recognises and cancels — see
// docs/features/new-tab-and-context-menu.md.
(function () {
  if (window.__wispBridge) return
  window.__wispBridge = true

  function send(kind, payload) {
    try {
      var q = new URLSearchParams({ k: kind, p: JSON.stringify(payload || {}) })
      // Cancelled before commit by the Rust handler; the current page stays put.
      window.location.href = 'wisp://ipc/?' + q.toString()
    } catch (e) {
      /* ignore — a page that breaks URLSearchParams just loses the feature */
    }
  }

  // window.open -> foreground tab. Keep a reference in case we need to bail.
  var nativeOpen = window.open
  window.open = function (url) {
    if (url) {
      try {
        send('newtab', { url: new URL(url, window.location.href).href, background: false })
        return null
      } catch (e) {
        /* fall through to native */
      }
    }
    return nativeOpen.apply(window, arguments)
  }

  function anchorFrom(node) {
    while (node && node.nodeType === 1) {
      if (node.tagName === 'A' && node.href) return node
      node = node.parentNode
    }
    return null
  }

  function onClick(e) {
    if (e.defaultPrevented) return
    if (e.button !== 0 && e.button !== 1) return
    var a = anchorFrom(e.target)
    if (!a) return
    var href = a.href
    if (!/^https?:/i.test(href)) return
    var wantsNewTab = a.target === '_blank' || a.target === '_new'
    var wantsBackground = e.button === 1 || e.ctrlKey || e.metaKey
    if (!wantsNewTab && !wantsBackground) return
    e.preventDefault()
    e.stopPropagation()
    send('newtab', { url: href, background: wantsBackground })
  }
  document.addEventListener('click', onClick, true)
  document.addEventListener('auxclick', onClick, true)

  document.addEventListener(
    'contextmenu',
    function (e) {
      var a = anchorFrom(e.target)
      var img = e.target && e.target.tagName === 'IMG' && e.target.src ? e.target.src : null
      var selection = ''
      try {
        selection = String(window.getSelection() || '')
      } catch (e2) {
        /* ignore */
      }
      // Suppress the engine's own menu; the native Wisp menu takes over.
      e.preventDefault()
      send('contextmenu', {
        linkUrl: a ? a.href : null,
        srcUrl: img,
        selectionText: selection ? selection.slice(0, 500) : null,
        pageUrl: window.location.href,
      })
    },
    true,
  )
})()
