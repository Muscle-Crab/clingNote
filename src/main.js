import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
// Initialize PushAlert SDK
(function(d, t) {
    var g = d.createElement(t),
        s = d.getElementsByTagName(t)[0];
    g.src = "https://cdn.pushalert.co/integrate_c01e733e69329e2d521a22070d81d645.js";
    s.parentNode.insertBefore(g, s);
}(document, "script"));
createApp(App).use(store).use(router).mount('#app')
