import { createApp, vaporInteropPlugin } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'

// Required whenever a vapor component (e.g. TabItem.vue, see
// docs/architecture.md) is used inside a regular VDOM tree.
createApp(App).use(createPinia()).use(vaporInteropPlugin).mount('#app')
