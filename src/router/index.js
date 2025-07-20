// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
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
  history: createWebHistory(),
  routes
})

export default router
