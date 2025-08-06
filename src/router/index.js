// src/router/index.js
import { createRouter, createWebHashHistory } from 'vue-router'
import JoinView from '../views/JoinView.vue'
import StaffView from '../views/StaffView.vue'
import StaffLogin from '../views/StaffLogin.vue'

const routes = [
  {
    path: '/join/:storeId',
    name: 'Join',
    component: JoinView
  },
  {
    path: '/staff/:storeId',
    name: 'Staff',
    component: StaffView
  },
  {
    path: '/staff-login',
    name: 'StaffLogin',
    component: StaffLogin
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// router/index.js など
router.beforeEach((to, from, next) => {
  if (to.path.startsWith('/staff/')) {
    const token = localStorage.getItem('staffToken')
    if (!token || isTokenExpired(token)) {
      localStorage.removeItem('staffToken')
      localStorage.removeItem('storeId')
      localStorage.removeItem('storeName')
      return next('/staff-login')
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
