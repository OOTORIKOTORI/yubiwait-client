<template>
  <div class="login-container">
    <h2>管理者ログイン</h2>
    <p class="note">※この画面は店舗管理者用です。店員は店員ログインから入ってください。</p>

    <form @submit.prevent="login">
      <label for="email">メールアドレス</label>
      <input id="email" v-model="email" type="email" placeholder="メールアドレスを入力" />

      <label for="password">パスワード</label>
      <input id="password" v-model="password" type="password" placeholder="パスワードを入力" />

      <button type="submit" :disabled="loading">
        {{ loading ? 'ログイン中...' : 'ログイン' }}
      </button>
    </form>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

const router = useRouter()

const login = async () => {
  if (!email.value || !password.value) {
    errorMessage.value = 'メールアドレスとパスワードを入力してください'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const res = await axios.post('/api/admin/auth/login', {
      email: (email.value || '').trim(),
      password: (password.value || '').trim()
    })

    const token = res.data.token
    localStorage.setItem('adminToken', token)
    localStorage.setItem('adminInfo', JSON.stringify(res.data.admin || {}))

    router.push('/admin')
  } catch (err) {
    console.error('管理者ログイン失敗:', err)
    errorMessage.value = err?.response?.data?.error || 'ログインに失敗しました'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  max-width: 400px;
  margin: 80px auto;
  padding: 24px;
  text-align: center;
  border: 1px solid #ddd;
  border-radius: 10px;
  background-color: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

input {
  display: block;
  width: 80%;
  margin: 12px auto;
  padding: 8px;
  font-size: 1em;
  border: 1px solid #ccc;
  border-radius: 6px;
}

button {
  margin-top: 16px;
  padding: 10px 24px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.note {
  color: #666;
  font-size: .9em;
}

.error {
  color: red;
  margin-top: 12px;
}
</style>
