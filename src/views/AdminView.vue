<template>
  <div>
    <h2>店員ページ</h2>
    <p>店舗ID: {{ storeId }}</p>

    <h3>受付一覧：</h3>
    <ul>
      <li v-for="(c, i) in customers" :key="i">
        {{ c.name }}（{{ formatDate(c.joinedAt) }}）
        <button @click="markAsDone(c._id)">完了</button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const storeId = route.params.storeId
const customers = ref([])

const fetchCustomers = async () => {
  try {
    const res = await axios.get(`/api/admin/${storeId}`)
    customers.value = res.data.customers
  } catch (err) {
    console.error('一覧取得エラー', err)
  }
}

onMounted(fetchCustomers)

// ✅ 完了ボタン押下時
const markAsDone = async (customerId) => {
  try {
    await axios.patch(`/api/admin/${storeId}/done/${customerId}`)
    await fetchCustomers() // 再取得して更新
  } catch (err) {
    console.error('完了処理エラー', err)
  }
}

// ✅ 日付フォーマット（例：2025/07/20 13:00）
const formatDate = (isoString) => {
  const date = new Date(isoString)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}/${m}/${d} ${h}:${min}`
}
</script>
