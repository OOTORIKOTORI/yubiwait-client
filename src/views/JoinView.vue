<template>
  <div class="container">
    <h2>受付ページ - {{ storeName }}</h2>
    <p>店舗ID: {{ storeId }}</p>

    <div v-if="waitingCount !== null" class="status" :class="{
      'highlight-warning': waitingCount <= 3 && waitingCount > 0,
      'highlight-now': waitingCount === 0
    }">
      <template v-if="waitingCount === 0">
        <div v-if="customerId">
          🎉 あなたの順番です！<br />
          スタッフにお名前をお伝えください！
        </div>
        <div v-else>
          現在、待ち人数は0人です。<br />
          登録後すぐに受付可能です！
        </div>
      </template>
      <template v-else>
        あなたの前に <strong>{{ waitingCount }}</strong> 人待っています<br />
        予想待ち時間：約 <strong>{{ estimatedTime }}</strong> 分
      </template>
    </div>
    <div v-else-if="waitingCount === null">
      情報を取得しています...
    </div>

    <p v-if="customerId && registeredName">
      「{{ registeredName }}」さんの待ち時間です
    </p>

    <input v-model="name" placeholder="お名前を入力" />
    <br />
    <!-- 登録ボタン -->
    <button v-if="!customerId" @click="submit">
      登録
    </button>
    <button v-if="customerId" @click="resetRegistration">
      登録しなおす
    </button>

    <button v-if="customerId" @click="cancelRegistration" class="cancel-button">
      キャンセル
    </button>

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
const storeName = ref('')

let intervalId = null

const fetchStoreName = async () => {
  try {
    const res = await axios.get(`/api/join/${storeId}/name`)
    storeName.value = res.data.name
  } catch (err) {
    console.error('店舗名取得エラー:', err)
    storeName.value = '(店舗名不明)'
  }
}


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

    // ✅ ここでPush購読処理を呼ぶ！
    await registerPushNotification()
  } catch (err) {
    message.value = '送信エラー'
    console.error(err)
  }
}

async function registerPushNotification() {
  try {
    const response = await axios.get(`/api/join/${storeId}/publicKey`)
    const publicKey = response.data.publicKey

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      alert('通知が許可されていません')
      return
    }

    const swVersion = '1.0.4' // ← 自分で手動でバージョン上げる
    const registration = await navigator.serviceWorker.register(`/service-worker.js?v=${swVersion}`, { scope: '/' })

    // const registration = await navigator.serviceWorker.register('/service-worker.js?ver=' + Date.now(), { scope: '/' })
    console.log('SW 登録完了:', registration)

    // Service Worker が "起動完了" するのを待つ！
    const swReady = await navigator.serviceWorker.ready
    console.log(swReady);

    const existing = await registration.pushManager.getSubscription()
    console.log('既存購読:', existing)
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    })

    // 🔥 ここでサーバーに購読情報を送信！
    await axios.post(`/api/join/${storeId}/subscribe`, {
      customerId: customerId.value,
      subscription
    })
  } catch (err) {
    console.error('Push通知登録エラー:', err)
  }
}


function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}


const fetchWaitingInfo = async () => {
  try {
    const res = await axios.get(`/api/join/${storeId}/waiting-time`, {
      params: { customerId: customerId.value || '' }
    })
    waitingCount.value = res.data.waitingCount
    estimatedTime.value = (waitingCount.value ?? 0) * 5
    // 通知確認
    await axios.post(`/api/join/${storeId}/notify`, {
      customerId: customerId.value
    })
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
onMounted(async () => {
  const savedId = localStorage.getItem('customerId')
  const savedName = localStorage.getItem('customerName')

  if (savedId) {
    customerId.value = savedId
  }
  if (savedName) {
    name.value = savedName
    registeredName.value = savedName
  }

  await fetchStoreName() // ←ここを追加！
  fetchWaitingInfo()

  intervalId = setInterval(() => {
    fetchWaitingInfo()
  }, 10 * 1000)
})


onUnmounted(() => {
  // 🧹 クリーンアップ
  if (intervalId) clearInterval(intervalId)
})

const cancelRegistration = async () => {
  try {
    await axios.delete(`/api/join/${storeId}/cancel`, {
      data: { customerId: customerId.value }
    })
    resetRegistration()
    message.value = 'キャンセルしました'
  } catch (err) {
    console.error('キャンセルエラー:', err)
    message.value = 'キャンセルできませんでした'
  }
}

</script>

<style scoped>
.container {
  max-width: 400px;
  margin: 60px auto;
  padding: 20px;
  text-align: center;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #fdfdfd;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);
}

input {
  padding: 8px;
  width: 70%;
  margin-top: 12px;
  border-radius: 4px;
  border: 1px solid #ccc;
}

button {
  margin-top: 12px;
  padding: 8px 16px;
  margin-right: 8px;
  border: none;
  background-color: #007bff;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #0056b3;
}

.status {
  margin: 16px 0;
  font-size: 1.1em;
}

/* 強調：まもなく呼ばれる */
.highlight-warning {
  background-color: #fff8e1;
  border: 1px solid #ffc107;
  color: #b36b00;
  font-weight: bold;
  padding: 12px;
  border-radius: 6px;
}

/* 強調：あなたの番！ */
.highlight-now {
  background-color: #e1f5fe;
  border: 2px solid #00acc1;
  color: #006064;
  font-weight: bold;
  font-size: 1.2em;
  padding: 16px;
  border-radius: 6px;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.05);
  }

  100% {
    transform: scale(1);
  }
}

button:disabled {
  background-color: #ccc;
  color: #666;
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
