// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import axios from 'axios'

// ベースURL（未設定なら同一オリジン）
axios.defaults.baseURL = process.env.VUE_APP_API_URL || ''

// ★ リクエスト: /api/admin は adminToken、/api/staff|/api/store は staffToken を付与
axios.interceptors.request.use((cfg) => {
  const url = cfg.url || ''
  const isAdmin = url.startsWith('/api/admin')
  const isStaff = url.startsWith('/api/staff') || url.startsWith('/api/store')

  let token = ''
  if (isAdmin) token = localStorage.getItem('adminToken') || ''
  else if (isStaff) token = localStorage.getItem('staffToken') || ''

  cfg.headers = cfg.headers || {}
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  else delete cfg.headers.Authorization

  return cfg
})

// ★ レスポンス: 401 になった側だけ片付け＆画面遷移
axios.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status
    const url = err?.config?.url || ''

    if (status === 401) {
      if (url.startsWith('/api/admin')) {
        localStorage.removeItem('adminToken')
        localStorage.removeItem('adminInfo')
        if (location.hash.startsWith('#/admin')) location.hash = '#/admin-login'
      } else if (url.startsWith('/api/staff') || url.startsWith('/api/store')) {
        localStorage.removeItem('staffToken')
        localStorage.removeItem('storeId')
        localStorage.removeItem('storeName')
        if (location.hash.startsWith('#/staff')) location.hash = '#/staff-login'
      }
    }
    return Promise.reject(err)
  }
)

const app = createApp(App)
app.use(router)
app.mount('#app')
