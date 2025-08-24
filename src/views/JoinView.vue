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
      <small v-if="minutesPerPerson">（1人あたり {{ minutesPerPerson }} 分基準）</small>
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
    <button v-if="!customerId" :disabled="submitting" @click="submit">登録</button>
    <button v-if="customerId" @click="resetRegistration">
      登録しなおす
    </button>

    <button v-if="customerId" :disabled="cancelling" @click="cancelRegistration" class="cancel-button">キャンセル</button>

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
const minutesPerPerson = ref(5) // 表示用に使うなら
const lastWaitingCount = ref(null)
const submitting = ref(false)
const cancelling = ref(false)
let lastSubscription = null

const fetchStoreName = async () => {
  try {
    const res = await axios.get(`/api/join/${storeId}/name`)
    storeName.value = res.data.name
  } catch (err) {
    console.error('店舗名取得エラー:', err)
    storeName.value = '(店舗名不明)'
  }
}


// 既存の submit を丸ごと差し替え
const submit = async () => {
  if (submitting.value) return
  message.value = ''
  const trimmed = (name.value || '').trim().slice(0, 40)
  if (!trimmed) return
  submitting.value = true
  try {
    const res = await axios.post(`/api/join/${storeId}`, { name: trimmed })

    message.value = res.data.message
    customerId.value = res.data.customerId
    localStorage.setItem('customerId', res.data.customerId)
    localStorage.setItem('customerName', trimmed)   // ← ここを trimmed に
    registeredName.value = trimmed                  // ← ここも trimmed に

    if (res.data.cancelToken) {
      localStorage.setItem('cancelToken', res.data.cancelToken)
    }

    await fetchWaitingInfo()
    await registerPushNotification()
  } catch (err) {
    message.value = '送信エラー'
    console.error(err)
  } finally {
    submitting.value = false
  }
}

async function registerPushNotification() {
  // ✅ SW/Push/Notification 未対応なら何もしないで帰る
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
    console.warn('Push未対応環境（Service Worker / Push / Notification）');
    // 必要ならユーザ向けメッセージを出す：
    // message.value = 'この端末はプッシュ通知に対応していません（キャンセルは画面から可能です）';
    return;
  }

  try {
    const { data } = await axios.get(`/api/join/${storeId}/publicKey`)
    const publicKey = data.publicKey

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.warn('通知が許可されませんでした')
      // message.value = '通知が許可されていません（後からブラウザ設定で変更できます）'
      return
    }

    const swVersion = '1.0.4'
    const registration = await navigator.serviceWorker.register(`/service-worker.js?v=${swVersion}`, { scope: '/' })
    await navigator.serviceWorker.ready

    // 既存購読があればそれを使う（重複subscribeエラー回避）※任意だけどオススメ
    const existing = await registration.pushManager.getSubscription()
    const subscription = existing || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    })

    // endpoint を保持（本人確認のfallbackに使う）
    lastSubscription = subscription
    localStorage.setItem('subscriptionEndpoint', subscription.endpoint)

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
    const params = {}
    if (customerId.value) params.customerId = customerId.value
    const res = await axios.get(`/api/join/${storeId}/waiting-time`, { params })
    waitingCount.value = res.data?.waitingCount ?? 0
    estimatedTime.value = Math.max(0, Math.round(res.data?.estimatedMinutes ?? 0))
    // （任意）UIで見せたいなら保存しておける
    minutesPerPerson.value = res.data?.minutesPerPerson ?? minutesPerPerson.value
    // （通知はサーバ内部で行う想定のためクライアントからは叩かない）
    if (customerId.value) {
      lastWaitingCount.value = waitingCount.value
    }
  } catch (err) {
    console.error('待ち人数取得エラー:', err)
  }
}

const unregisterPush = async () => {
  try {
    if (!('serviceWorker' in navigator)) return
    let reg = await navigator.serviceWorker.getRegistration('/')
    if (!reg) reg = await navigator.serviceWorker.getRegistration() // ← フォールバック
    const sub = await reg?.pushManager.getSubscription()
    await sub?.unsubscribe()
  } catch (e) { console.warn('unsubscribe失敗', e) }
}


const resetRegistration = async () => {
  await unregisterPush()
  localStorage.removeItem('customerId')
  localStorage.removeItem('customerName')
  localStorage.removeItem('cancelToken')
  localStorage.removeItem('subscriptionEndpoint')
  customerId.value = null
  name.value = ''
  registeredName.value = ''
  message.value = '登録情報をリセットしました'
  fetchWaitingInfo()
}

// 既存 onMounted の中で保存値を復元する処理に endpoint を追加
onMounted(async () => {
  const savedId = localStorage.getItem('customerId')
  const savedName = localStorage.getItem('customerName')
  const savedEndpoint = localStorage.getItem('subscriptionEndpoint')

  if (savedId) customerId.value = savedId
  if (savedName) {
    name.value = savedName
    registeredName.value = savedName
  }
  if (savedEndpoint) {
    lastSubscription = { endpoint: savedEndpoint }
  }

  await fetchStoreName()
  startPolling()
  document.addEventListener('visibilitychange', handleVisibility)
})

onUnmounted(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', handleVisibility)
})

// cancelRegistration を丸ごと置き換え推奨
const cancelRegistration = async () => {
  if (cancelling.value) return
  message.value = ''               // ← 追加
  cancelling.value = true
  try {
    const body = { customerId: customerId.value }

    // 署名トークン（Push未購読でもOK）
    const cancelToken = localStorage.getItem('cancelToken')
    if (cancelToken) body.cancelToken = cancelToken

    // Push購読の endpoint 一致でもOK（両対応にして通りやすく）
    if (lastSubscription?.endpoint) {
      body.subscription = { endpoint: lastSubscription.endpoint }
    } else {
      const ep = localStorage.getItem('subscriptionEndpoint')
      if (ep) body.subscription = { endpoint: ep }
    }

    await axios.delete(`/api/join/${storeId}/cancel`, { data: body })
    resetRegistration()
    message.value = 'キャンセルしました'
  } catch (err) {
    console.error('キャンセルエラー:', err)
    if (err?.response?.status === 403) {
      message.value = '本人確認に失敗しました（再登録してお試しください）'
    } else if (err?.response?.status === 409) {
      message.value = '呼び出し中は画面からキャンセルできません'
    } else {
      message.value = 'キャンセルできませんでした'
    }
  } finally {
    cancelling.value = false
  }
}

// ==== ポーリング制御（重複ガード + 非表示で停止） ====
const pollMs = 10000              // ポーリング間隔（必要に応じて変更）
let pollId = null                 // setInterval のID
let fetching = false              // リクエスト中フラグ

async function tick() {
  if (fetching) return
  fetching = true
  try {
    await fetchWaitingInfo()      // ← 既存の取得関数をそのまま使う
  } finally {
    fetching = false
  }
}

function startPolling() {
  if (pollId) return              // 二重起動を防止
  pollId = setInterval(tick, pollMs)
  tick()                          // 起動直後に1回即時実行
}

function stopPolling() {
  if (!pollId) return
  clearInterval(pollId)
  pollId = null
}

function handleVisibility() {
  if (document.visibilityState === 'hidden') {
    stopPolling()
  } else {
    startPolling()
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
