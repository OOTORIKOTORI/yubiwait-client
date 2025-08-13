<template>
  <div class="container">
    <h2>店員ページ</h2>
    <p class="store-name">店舗名: {{ storeName }}</p>
    <p class="store-id">店舗ID: {{ storeId }}</p>

    <button class="logout-btn" @click="logout">ログアウト</button>
    <button class="anon-btn" @click="registerAnonymous">匿名で受付</button>

    <!-- 呼び出し中 -->
    <h3>呼び出し中：</h3>
    <table class="customer-table">
      <thead>
        <tr>
          <th>#</th>
          <th>名前</th>
          <th>コメント</th>
          <th>呼出時間</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(c, i) in serving" :key="c._id" class="serving-row">
          <td>{{ i + 1 }}</td>

          <!-- 名前 -->
          <td>
            <div v-if="!c._isEditing">
              {{ c.name }}
              <button class="edit-btn" @click="enableEdit(c)">✏</button>
            </div>
            <div v-else>
              <input v-model="c._editName" />
            </div>
          </td>

          <!-- コメント -->
          <td>
            <div v-if="!c._isEditing">
              {{ c.comment || '（なし）' }}
            </div>
            <div v-else>
              <textarea v-model="c._editComment" placeholder="メモを入力"></textarea>
            </div>
          </td>

          <!-- 呼出時間 -->
          <td class="time">{{ formatDate(c.calledAt) }}</td>

          <!-- 操作：ここで完了 -->
          <td>
            <button v-if="!c._isEditing" class="done-btn" :class="{ 'highlighted': i === 0 }"
              @click="markAsDone(c._id)">
              ✔ 完了
            </button>
            <div v-if="c._isEditing">
              <button class="save-btn" @click="saveEdit(c)">保存</button>
              <button class="cancel-btn" @click="cancelEdit(c)">キャンセル</button>
            </div>
          </td>
        </tr>
        <tr v-if="serving.length === 0">
          <td colspan="5" style="color:#666;">呼び出し中のお客様はいません</td>
        </tr>
      </tbody>
    </table>

    <!-- 待機中 -->
    <h3>待機中：</h3>
    <table class="customer-table">
      <thead>
        <tr>
          <th>#</th>
          <th>名前</th>
          <th>コメント</th>
          <th>受付時間</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(c, i) in waiting" :key="c._id">
          <td>{{ i + 1 }}</td>

          <!-- 名前 -->
          <td>
            <div v-if="!c._isEditing">
              {{ c.name }}
              <button class="edit-btn" @click="enableEdit(c)">✏</button>
            </div>
            <div v-else>
              <input v-model="c._editName" />
            </div>
          </td>

          <!-- コメント -->
          <td>
            <div v-if="!c._isEditing">
              {{ c.comment || '（なし）' }}
            </div>
            <div v-else>
              <textarea v-model="c._editComment" placeholder="メモを入力"></textarea>
            </div>
          </td>

          <!-- 受付時間 -->
          <td class="time">{{ formatDate(c.joinedAt) }}</td>

          <!-- 操作：自動呼出運用なら何も無し（手動呼出したいならボタンを出す） -->
          <td>
            <div v-if="c._isEditing">
              <button class="save-btn" @click="saveEdit(c)">保存</button>
              <button class="cancel-btn" @click="cancelEdit(c)">キャンセル</button>
            </div>
            <!-- 手動呼出を使う場合は下を有効化
            <button v-else class="call-btn" @click="call(c._id)">呼び出し</button>
            -->
          </td>
        </tr>
        <tr v-if="waiting.length === 0">
          <td colspan="5" style="color:#666;">待機中のお客様はいません</td>
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
const storeId = route.params.storeId

const logout = () => {
  localStorage.removeItem('staffToken')
  localStorage.removeItem('storeId')
  localStorage.removeItem('storeName')
  router.push('/staff-login')
}

let intervalId = null

// 2リスト化
const waiting = ref([])
const serving = ref([])

const isEditingAny = ref(false)

const fetchCustomers = async () => {
  if (isEditingAny.value) return  // 編集中はリフレッシュしない
  try {
    const res = await axios.get(`/api/staff/${storeId}?status=all`)
    waiting.value = res.data.waiting || []
    serving.value = res.data.serving || []
  } catch (err) {
    console.error('一覧取得エラー', err)
    if (err?.response?.status === 401) logout()
  }
}

const markAsDone = async (customerId) => {
  try {
    await axios.patch(`/api/staff/${storeId}/done/${customerId}`)
    await fetchCustomers()
  } catch (err) {
    console.error('完了処理エラー', err)
    if (err?.response?.status === 401) logout()
  }
}

// （手動呼出を使う場合だけ）
// const call = async (customerId) => {
//   try {
//     await axios.patch(`/api/staff/${storeId}/call/${customerId}`)
//     await fetchCustomers()
//   } catch (err) {
//     console.error('呼出エラー', err)
//     if (err?.response?.status === 401) logout()
//   }
// }

const formatDate = (isoString) => {
  if (!isoString) return '—'
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
    await axios.post(`/api/staff/${storeId}/anonymous`)
    await fetchCustomers()
  } catch (err) {
    console.error('匿名登録エラー', err)
    if (err?.response?.status === 401) logout()
  }
}

const enableEdit = (customer) => {
  isEditingAny.value = true
  customer._isEditing = true
  customer._editName = customer.name
  customer._editComment = customer.comment || ''
}

const cancelEdit = (customer) => {
  customer._isEditing = false
  isEditingAny.value = false
}

const saveEdit = async (customer) => {
  try {
    await axios.patch(`/api/staff/${storeId}/update/${customer._id}`, {
      name: customer._editName,
      comment: customer._editComment
    })
    customer._isEditing = false
    isEditingAny.value = false
    await fetchCustomers()
  } catch (err) {
    console.error('編集保存エラー', err)
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
.store-id { color: #666; font-size: 14px; }
.customer-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
.customer-table th, .customer-table td { border: 1px solid #ddd; padding: 12px; }
.customer-table th { background-color: #f2f2f2; }
.customer-table tr:hover { background-color: #f9f9f9; }
.time { font-family: monospace; }
.done-btn { background-color: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; }
.done-btn:hover { background-color: #218838; }
.done-btn.highlighted { border: 2px solid #333; box-shadow: 0 0 0 2px rgba(0,0,0,0.1); }
.logout-btn { background-color: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; margin: 12px 0; }
.logout-btn:hover { background-color: #c82333; }
.anon-btn { background-color: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-bottom: 12px; }
.anon-btn:hover { background-color: #0069d9; }

/* 視覚的に分かりやすく：呼び出し中を淡い色で強調 */
.serving-row { background-color: #fff3cd; font-weight: 500; }
</style>
