<template>
  <div>
    <h2>店員ページ</h2>
    <p>店舗ID: {{ storeId }}</p>

    <h3>受付一覧：</h3>
    <ul>
      <li v-for="(c, i) in customers" :key="i">
        {{ c.name }}（{{ c.joinedAt }}）
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

onMounted(async () => {
  try {
    const res = await axios.get(`/api/admin/${storeId}`)
    customers.value = res.data.customers
  } catch (err) {
    console.error('一覧取得エラー', err)
  }
})
</script>
