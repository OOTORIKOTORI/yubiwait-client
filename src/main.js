// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import axios from 'axios'

// ベースURL（環境変数から）
axios.defaults.baseURL = process.env.VUE_APP_API_URL

// 💡 Interceptorをここで登録
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('staffToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}, error => {
  return Promise.reject(error)
})

// レスポンスインターセプター
axios.interceptors.response.use(
  response => response, // 正常時はそのまま返す
  error => {
    if (error.response && error.response.status === 401) {
      // 認証切れ時の処理
      localStorage.removeItem('staffToken');
      // 任意のログインページにリダイレクト
      window.location.href = '/staff-login';
    }
    return Promise.reject(error);
  }
);


const app = createApp(App)
app.use(router)
app.mount('#app')
