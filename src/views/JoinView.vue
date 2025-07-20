<template>
  <div>
    <h2>受付ページ</h2>
    <p>店舗ID: {{ storeId }}</p>

    <p v-if="waitingCount !== null">
      あなたの前に {{ waitingCount }} 人待っています<br />
      予想待ち時間：約 {{ estimatedTime }} 分
    </p>
    <p v-if="customerId && registeredName">「{{ registeredName }}」さんの待ち時間です</p>

    <input v-model="name" placeholder="お名前を入力" />
    <button @click="submit">登録</button>
    <button @click="resetRegistration" style="margin-left: 8px;">登録しなおす</button>

    <p v-if="message">{{ message }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const storeId = route.params.storeId

const name = ref('') // 入力中
const registeredName = ref('') // 登録済み（表示用）
const message = ref('')
const customerId = ref(null)
const waitingCount = ref(null)
const estimatedTime = ref(null)
let intervalId = null

const submit = async () => {
  if (!name.value) return

  try {
    const res = await axios.post(`/api/join/${storeId}`, { name: name.value })
    message.value = res.data.message
    customerId.value = res.data.customerId
    localStorage.setItem('customerId', res.data.customerId)  // ← 保存！
    localStorage.setItem('customerName', name.value)
    registeredName.value = name.value


    await fetchWaitingInfo()
  } catch (err) {
    message.value = '送信エラー'
    console.error(err)
  }
}

const fetchWaitingInfo = async () => {
  try {
    const res = await axios.get(`/api/join/${storeId}/waiting-time`, {
      params: { customerId: customerId.value || '' }
    })
    waitingCount.value = res.data.waitingCount
    estimatedTime.value = waitingCount.value * 2
  } catch (err) {
    console.error('待ち人数取得エラー:', err)
  }
}

// ← リセット処理
const resetRegistration = () => {
  localStorage.removeItem('customerId')
  localStorage.removeItem('customerName')
  customerId.value = null
  name.value = ''
  registeredName.value = ''
  message.value = '登録情報をリセットしました'
  fetchWaitingInfo()
}

// ✅ 初期化処理
onMounted(() => {
  const savedId = localStorage.getItem('customerId')
  const savedName = localStorage.getItem('customerName')

  if (savedId) {
    customerId.value = savedId
  }
  if (savedName) {
    name.value = savedName
    registeredName.value = savedName
  }
  fetchWaitingInfo()
  // ⏱ 定期実行スタート（30秒ごと）
  intervalId = setInterval(() => {
    fetchWaitingInfo()
  }, 30 * 1000)
})

onUnmounted(() => {
  // 🧹 クリーンアップ
  if (intervalId) clearInterval(intervalId)
})
</script>
