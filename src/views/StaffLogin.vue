<template>
  <div class="login-container">
    <h2>店員ログイン</h2>
    <p class="note">※この画面は店舗スタッフ用です。お客様はQRコードからアクセスしてください。</p>


    <form @submit.prevent="login">
      <label for="storeId">店舗を選択</label>
      <select id="storeId" v-model="storeId">
        <option disabled value="">-- 店舗を選んでください --</option>
        <option v-for="store in storeList" :key="store._id" :value="store._id">
          {{ store.name }}（{{ store.location }}）
        </option>
      </select>

      <label for="pinCode">PINコード</label>
      <input id="pinCode" v-model="pinCode" placeholder="PINコードを入力" type="password" />

      <button type="submit" :disabled="loading">
        {{ loading ? 'ログイン中...' : 'ログイン' }}
      </button>
    </form>

    <p style="margin-top:16px;font-size:.9em;color:#666;">
      管理者の方は <a href="#/admin-login">こちら</a>
    </p>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const storeId = ref('')
const pinCode = ref('')
const loading = ref(false)
const errorMessage = ref('')
const storeList = ref([])

const router = useRouter()

// ✅ 画面表示時に店舗一覧を取得
onMounted(async () => {
  try {
    const res = await axios.get('/api/store/list')
    storeList.value = res.data
  } catch (err) {
    console.error('店舗一覧取得失敗:', err)
    errorMessage.value = '店舗一覧の取得に失敗しました'
  }
})

const login = async () => {
  if (!storeId.value || !pinCode.value) {
    errorMessage.value = '店舗とPINコードを選択してください'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const res = await axios.post('/api/store/staff-login', {
      storeId: storeId.value,
      pinCode: pinCode.value
    })

    const token = res.data.token
    localStorage.setItem('staffToken', token)
    localStorage.setItem('storeId', storeId.value)
    localStorage.setItem('storeName', res.data.storeName) // ←これ追加！


    router.push(`/staff/${storeId.value}`)
  } catch (err) {
    console.error('ログイン失敗:', err)
    errorMessage.value =
      err?.response?.data?.message || 'ログインに失敗しました'
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

input,
select {
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
  background-color: #28a745;
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

.error {
  color: red;
  margin-top: 12px;
}
</style>
