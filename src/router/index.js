// src/router/index.js
import { createRouter, createWebHashHistory } from 'vue-router'
import JoinView from '../views/JoinView.vue'
import AdminView from '../views/AdminView.vue'

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
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
