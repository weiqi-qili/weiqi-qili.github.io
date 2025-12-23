import { createRouter, createWebHashHistory } from 'vue-router'
import { supabase } from '../supabase'
import Home from '../views/Home.vue'
import Admin from '../views/Admin.vue'
import Login from '../views/Login.vue'

const routes = [
  { 
    path: '/', 
    component: Home,
    meta: { requiresAuth: true } // 🔒 首页现在也是禁区了
  },
  { 
    path: '/login', 
    component: Login 
  },
  { 
    path: '/admin', 
    component: Admin,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  // 获取当前会话
  const { data: { session } } = await supabase.auth.getSession()
  
  // 检查目标页面是否需要权限
  if (to.meta.requiresAuth && !session) {
    next('/login') // 没登录？去登录页
  } else if (to.path === '/login' && session) {
    next('/') // 已登录还想去登录页？直接回首页
  } else {
    next() // 放行
  }
})

export default router