<template>
  <div class="login-container">
    <h2>管理员登录</h2>
    
    <div class="form-box">
      <input 
        v-model="email" 
        type="email" 
        placeholder="请输入邮箱" 
      />
      <input 
        v-model="password" 
        type="password" 
        placeholder="请输入密码" 
        @keyup.enter="handleLogin" 
      />
      
      <button class="login-btn" @click="handleLogin" :disabled="loading">
        {{ loading ? '登录中...' : '登录' }}
      </button>
      
      <p class="msg" :class="{ error: isError }">{{ message }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'

const router = useRouter()
const email = ref('')
const password = ref('')
const loading = ref(false)
const message = ref('')
const isError = ref(false)

const handleLogin = async () => {
  if (!email.value || !password.value) return
  
  loading.value = true
  message.value = ''
  isError.value = false

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  })

  if (error) {
    message.value = '登录失败: ' + (error.message === 'Invalid login credentials' ? '账号或密码错误' : error.message)
    isError.value = true
    loading.value = false
  } else {
    // 登录成功
    message.value = '登录成功，跳转中...'
    // 稍微延迟一下让用户看到提示
    setTimeout(() => {
      router.push('/') // 跳转回首页
    }, 500)
  }
}
</script>

<style scoped>
.login-container { 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  margin-top: 100px; 
  padding: 20px; 
  color: white; 
}

.form-box { 
  background: #333; 
  padding: 30px; 
  border-radius: 12px; 
  display: flex; 
  flex-direction: column; 
  gap: 20px; 
  width: 100%; 
  max-width: 350px; 
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
}

h2 { margin-bottom: 20px; color: #4caf50; }

input { 
  padding: 15px; 
  background: #222; 
  border: 1px solid #444; 
  color: white; 
  border-radius: 8px; 
  font-size: 16px;
  outline: none;
}
input:focus { border-color: #4caf50; }

.login-btn { 
  padding: 15px; 
  background: #4caf50; 
  color: white; 
  border: none; 
  border-radius: 8px; 
  font-weight: bold; 
  font-size: 16px; 
  cursor: pointer; 
  transition: background 0.2s;
}
.login-btn:disabled { background: #555; cursor: not-allowed; }
.login-btn:not(:disabled):active { background: #388e3c; }

.msg { text-align: center; font-size: 14px; min-height: 20px; color: #aaa; }
.msg.error { color: #f44336; }
</style>