// src/router/index.js
import { createRouter, createWebHashHistory } from 'vue-router'
import JoinView from '../views/JoinView.vue'
import AdminView from '../views/AdminView.vue'
import StoreLogin from '../views/StoreLogin.vue'

const routes = [
  {
    path: '/join/:storeId',
    name: 'Join',
    component: JoinView
  },
  {
    path: '/admin/:storeId',
    name: 'Admin',
    component: AdminView
  },
  {
    path: '/login',
    name: 'StoreLogin',
    component: StoreLogin
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// router/index.js など
router.beforeEach((to, from, next) => {
  if (to.path.startsWith('/admin/')) {
    const token = localStorage.getItem('storeToken')
    if (!token || isTokenExpired(token)) {
      localStorage.removeItem('storeToken')
      localStorage.removeItem('storeId')
      localStorage.removeItem('storeName')
      return next('/login')
    }
  }
  next()
})


function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const now = Math.floor(Date.now() / 1000)
    return payload.exp < now
  } catch {
    return true
  }
}

export default router
