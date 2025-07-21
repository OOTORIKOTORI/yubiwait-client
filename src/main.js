// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import axios from 'axios'

// ベースURL（環境変数から）
axios.defaults.baseURL = process.env.VUE_APP_API_URL

// 💡 Interceptorをここで登録
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('storeToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}, error => {
  return Promise.reject(error)
})

const app = createApp(App)
app.use(router)
app.mount('#app')
