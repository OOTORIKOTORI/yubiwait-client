// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import axios from 'axios'

axios.defaults.baseURL = process.env.VUE_APP_API_URL

const app = createApp(App)
app.use(router)
app.mount('#app')
