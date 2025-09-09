
<template>
  <div class="container">
    <h2>受付ページ - {{ storeName }}</h2>
    <p class="store-id">店舗ID: {{ storeId }}</p>

    <!-- 現在状況（読み上げ対応） -->
    <div
      v-if="waitingCount !== null"
      class="status"
      :class="{
        'highlight-warning': waitingCount <= 3 && waitingCount > 0,
        'highlight-now': waitingCount === 0
      }"
      role="status"
      aria-live="polite"
    >
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
    <div v-else class="loading">情報を取得しています...</div>

    <p v-if="customerId && registeredName" class="hint">
      「{{ registeredName }}」さんの待ち時間です
    </p>

    <!-- 入力/送信 -->
    <form class="form" @submit.prevent="submit" novalidate>
      <input
        v-model="name"
        placeholder="お名前を入力"
        inputmode="text"
        autocomplete="name"
        :maxlength="40"
        :minlength="1"
        :aria-invalid="nameError ? 'true' : 'false'"
      />
      <div class="actions">
        <button
          v-if="!customerId"
          type="submit"
          :disabled="submitting || !!nameError"
          :aria-busy="submitting ? 'true' : 'false'"
        >
          登録
        </button>

        <button
          v-if="customerId"
          type="button"
          class="secondary"
          @click="resetRegistration"
        >
          登録しなおす
        </button>

        <button
          v-if="customerId"
          ref="cancelBtn"
          type="button"
          class="cancel-button"
          :disabled="cancelling"
          @click="cancelRegistration"
        >
          キャンセル
        </button>
      </div>
    </form>

    <!-- 通知許可をあとから行うための補助ボタン -->
    <div v-if="showNotifyButton" class="notify-box">
      <p class="notify-text">呼び出し通知を受け取るには通知の許可が必要です。</p>
      <button type="button" class="secondary" @click="requestNotify">
        通知を許可する
      </button>
    </div>

    <p v-if="message" class="message">{{ message }}</p>
    <p v-if="lastUpdated" class="mini">最終更新: {{ lastUpdated }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const storeId = route.params.storeId

// ---- state ----
const name = ref('')                   // 入力中
const registeredName = ref('')         // 登録済み（表示用）
const message = ref('')
const customerId = ref(null)
const waitingCount = ref(null)
const estimatedTime = ref(null)
const storeName = ref('')
const minutesPerPerson = ref(5)
const submitting = ref(false)
const cancelling = ref(false)
const cancelBtn = ref(null)

let lastSubscription = null            // { endpoint }
const lastUpdated = ref('')

// Push/SW対応可否
const notificationSupported = typeof Notification !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window

const permission = ref(notificationSupported ? Notification.permission : 'denied')

const showNotifyButton = computed(() => {
  return Boolean(
    customerId.value &&
    notificationSupported &&
    permission.value !== 'granted'
  )
})

const nameError = computed(() => {
  const trimmed = (name.value || '').trim()
  if (!trimmed) return '名前を入力してください'
  if (trimmed.length > 40) return '40文字以内で入力してください'
  return ''
})

// ---- helpers ----
const fetchStoreName = async () => {
  try {
    const res = await axios.get(`/api/join/${storeId}/name`)
    storeName.value = res.data.name
  } catch (err) {
    console.error('店舗名取得エラー:', err)
    storeName.value = '(店舗名不明)'
  }
}

// 送信
const submit = async () => {
  if (submitting.value) return
  message.value = ''
  const trimmed = (name.value || '').trim().slice(0, 40)
  if (!trimmed) {
    message.value = '名前を入力してください'
    return
  }
  submitting.value = true
  try {
    const res = await axios.post(`/api/join/${storeId}`, { name: trimmed })
    message.value = res.data.message
    customerId.value = res.data.customerId

    localStorage.setItem('customerId', res.data.customerId)
    localStorage.setItem('customerName', trimmed)
    registeredName.value = trimmed

    if (res.data.cancelToken) {
      localStorage.setItem('cancelToken', res.data.cancelToken)
    }

    await fetchWaitingInfo()

    // 通知権限がすでに許可済みなら自動購読
    if (permission.value === 'granted') {
      await registerPushNotification()
    }

    // UX: キャンセルボタンにフォーカス
    await nextTick()
    cancelBtn.value?.focus()
  } catch (err) {
    message.value = '送信エラー'
    console.error(err)
  } finally {
    submitting.value = false
  }
}

// 通知を明示的に許可（ボタン用）
const requestNotify = async () => {
  if (!notificationSupported) return
  try {
    const p = await Notification.requestPermission()
    permission.value = p
    if (p === 'granted') {
      await registerPushNotification()
      message.value = '通知を有効にしました'
    } else {
      message.value = '通知は許可されませんでした'
    }
  } catch (e) {
    console.error('通知許可エラー:', e)
  }
}

async function registerPushNotification () {
  if (!notificationSupported) return

  try {
    const { data } = await axios.get(`/api/join/${storeId}/publicKey`)
    const publicKey = data.publicKey

    const swVersion = '1.0.5'
    const registration = await navigator.serviceWorker.register(`/service-worker.js?v=${swVersion}`, { scope: '/' })
    await navigator.serviceWorker.ready

    // 既存購読を再利用
    const existing = await registration.pushManager.getSubscription()
    const subscription = existing || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    })

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

function urlBase64ToUint8Array (base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

// 待ち情報
const fetchWaitingInfo = async () => {
  try {
    const params = {}
    if (customerId.value) params.customerId = customerId.value
    const res = await axios.get(`/api/join/${storeId}/waiting-time`, { params })
    waitingCount.value = res.data?.waitingCount ?? 0
    estimatedTime.value = Math.max(0, Math.round(res.data?.estimatedMinutes ?? 0))
    minutesPerPerson.value = res.data?.minutesPerPerson ?? minutesPerPerson.value
    lastUpdated.value = new Date().toLocaleTimeString()
    // 正常応答ならポーリング間隔をリセット
    resetBackoff()
  } catch (err) {
    console.error('待ち人数取得エラー:', err)
    // 失敗時はバックオフ
    increaseBackoff()
  }
}

// Push 購読解除（登録し直し時）
const unregisterPush = async () => {
  try {
    if (!('serviceWorker' in navigator)) return
    let reg = await navigator.serviceWorker.getRegistration('/')
    if (!reg) reg = await navigator.serviceWorker.getRegistration()
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
  await fetchWaitingInfo()
}

// ---- ポーリング（自己調整バックオフ） ----
const basePollMs = 10000
let nextDelay = basePollMs
let timerId = null
let polling = false

function resetBackoff () {
  nextDelay = basePollMs
}

function increaseBackoff () {
  nextDelay = Math.min(nextDelay * 2, 60000) // 最大60秒
}

async function tick () {
  if (polling) return
  polling = true
  try {
    await fetchWaitingInfo()
  } finally {
    polling = false
    scheduleNext()
  }
}

function scheduleNext () {
  clearTimeout(timerId)
  timerId = setTimeout(tick, nextDelay)
}

function startPolling () {
  if (timerId) return
  scheduleNext() // すぐ一回 + 次回以降は nextDelay に従う
}

function stopPolling () {
  clearTimeout(timerId)
  timerId = null
}

function handleVisibility () {
  if (document.visibilityState === 'hidden') {
    stopPolling()
  } else {
    startPolling()
  }
}

// ---- lifecycle ----
onMounted(async () => {
  try {
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
    await fetchWaitingInfo()
  } finally {
    startPolling()
    document.addEventListener('visibilitychange', handleVisibility)
  }
})

onUnmounted(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', handleVisibility)
})

// キャンセル
const cancelRegistration = async () => {
  if (cancelling.value) return
  message.value = ''
  cancelling.value = true
  try {
    const body = { customerId: customerId.value }

    const cancelToken = localStorage.getItem('cancelToken')
    if (cancelToken) body.cancelToken = cancelToken

    if (lastSubscription?.endpoint) {
      body.subscription = { endpoint: lastSubscription.endpoint }
    } else {
      const ep = localStorage.getItem('subscriptionEndpoint')
      if (ep) body.subscription = { endpoint: ep }
    }

    await axios.delete(`/api/join/${storeId}/cancel`, { data: body })
    await resetRegistration()
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
</script>

<style scoped>
/* 参考：コンテナはそのままでOK */
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

h2 {
  margin: 0 0 6px 0;
  font-size: 22px;
}

.store-id {
  margin: 0 0 12px 0;
  color: #6b7280;
  font-size: 12px;
  word-break: break-all;
}

.status {
  margin: 16px 0;
  font-size: 15px;
}

.loading {
  color: #6b7280;
  margin: 12px 0;
}

.hint {
  margin: 6px 0 0 0;
  color: #374151;
}

.form {
  margin-top: 12px;
}

/* 追加：幅計算を border-box に統一 */
*, *::before, *::after {
  box-sizing: border-box;
}

/* 入力欄を枠内にピッタリ収める */
input {
  width: 100%;
  max-width: 100%;
  display: block;
  padding: 10px 14px;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-sizing: border-box; /* ←コレが効く */
  font-size: 16px;         /* iOSのズーム防止にも有効 */
  margin-top: 12px;
}

.actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

button {
  margin-top: 12px;
  padding: 10px 16px;
  border: none;
  background-color: #2563eb;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

button:hover {
  background-color: #1e40af;
}

button.secondary {
  background-color: #6b7280;
}
button.secondary:hover {
  background-color: #4b5563;
}

.cancel-button {
  background-color: #ef4444;
}
.cancel-button:hover {
  background-color: #b91c1c;
}

button:disabled {
  background-color: #cbd5e1;
  color: #6b7280;
  cursor: not-allowed;
  opacity: 0.7;
}

.status.highlight-warning {
  background-color: #fff8e1;
  border: 1px solid #f59e0b;
  color: #92400e;
  font-weight: 600;
  padding: 12px;
  border-radius: 8px;
}

.status.highlight-now {
  background-color: #e1f5fe;
  border: 2px solid #06b6d4;
  color: #0e7490;
  font-weight: 700;
  font-size: 1.1em;
  padding: 14px;
  border-radius: 8px;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.03); }
  100% { transform: scale(1); }
}

.message {
  margin-top: 10px;
}

.mini {
  margin-top: 8px;
  color: #6b7280;
  font-size: 12px;
}

.notify-box {
  margin-top: 8px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  padding: 10px;
  border-radius: 8px;
}

.notify-text {
  margin: 0;
  font-size: 13px;
}
</style>
