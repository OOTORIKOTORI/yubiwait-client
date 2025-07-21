<template>
  <div class="container">
    <h2>店員ページ</h2>
    <p class="store-name">店舗名: {{ storeName }}</p>
    <p class="store-id">店舗ID: {{ storeId }}</p>

    <!-- ログアウトボタン追加！ -->
    <button class="logout-btn" @click="logout">ログアウト</button>

    <!-- 新規受付ボタン追加 -->
    <button class="anon-btn" @click="registerAnonymous">匿名で受付</button>


    <h3>受付一覧：</h3>
    <table class="customer-table">
      <thead>
        <tr>
          <th>#</th>
          <th>名前</th>
          <th>受付時間</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(c, i) in customers" :key="c._id">
          <td>{{ i + 1 }}</td>
          <td class="name">{{ c.name }}</td>
          <td class="time">{{ formatDate(c.joinedAt) }}</td>
          <td>
            <button class="done-btn" :class="{ 'highlighted': i === 0 }" @click="markAsDone(c._id)">
              ✔ 完了
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'

const storeName = ref(localStorage.getItem('storeName') || '')
const router = useRouter()
const route = useRoute()
const logout = () => {
  localStorage.removeItem('storeToken')
  localStorage.removeItem('storeId')
  localStorage.removeItem('storeName')
  router.push('/login')
}

let intervalId = null

const storeId = route.params.storeId
const customers = ref([])

const fetchCustomers = async () => {
  try {
    const res = await axios.get(`/api/admin/${storeId}`)
    customers.value = res.data.customers
  } catch (err) {
    console.error('一覧取得エラー', err)
    if (err?.response?.status === 401) {
      // トークン無効 or 期限切れなど → 強制ログアウト
      logout()
    }
  }
}

const markAsDone = async (customerId) => {
  try {
    await axios.patch(`/api/admin/${storeId}/done/${customerId}`)
    await fetchCustomers()
  } catch (err) {
    console.error('完了処理エラー', err)
    if (err?.response?.status === 401) {
      // トークン無効 or 期限切れなど → 強制ログアウト
      logout()
    }
  }
}

const formatDate = (isoString) => {
  const date = new Date(isoString)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}/${m}/${d} ${h}:${min}`
}

const registerAnonymous = async () => {
  try {
    await axios.post(`/api/admin/${storeId}/anonymous`)
    await fetchCustomers()
  } catch (err) {
    console.error('匿名登録エラー', err)
    if (err?.response?.status === 401) {
      logout()
    }
  }
}


onMounted(() => {
  fetchCustomers()
  intervalId = setInterval(fetchCustomers, 10000)
})

onBeforeUnmount(() => {
  clearInterval(intervalId)
})

</script>

<style scoped>
.container {
  max-width: 720px;
  margin: 50px auto;
  padding: 20px;
  text-align: center;
  font-family: sans-serif;
}

.store-id {
  color: #666;
  font-size: 14px;
}

.customer-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}

.customer-table th,
.customer-table td {
  border: 1px solid #ddd;
  padding: 12px;
}

.customer-table th {
  background-color: #f2f2f2;
}

.customer-table tr:hover {
  background-color: #f9f9f9;
}

.name {
  text-align: left;
  font-weight: 500;
}

.time {
  font-family: monospace;
}

.done-btn {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}

.done-btn:hover {
  background-color: #218838;
}

.logout-btn {
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  margin: 12px 0;
}

.logout-btn:hover {
  background-color: #c82333;
}

.store-name {
  font-size: 16px;
  margin-bottom: 4px;
}

.customer-table tbody tr:first-child {
  background-color: #fff3cd;
  /* 薄い黄色（Bootstrapでいう「警告」系） */
  font-weight: bold;
}

.done-btn.highlighted {
  border: 2px solid #333;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
}

.anon-btn {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  margin-bottom: 12px;
}

.anon-btn:hover {
  background-color: #0069d9;
}

</style>
