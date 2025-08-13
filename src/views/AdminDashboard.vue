<template>
    <div class="page-container">
        <header class="header">
            <h2>管理ダッシュボード</h2>
            <div class="spacer"></div>
            <button class="logout" @click="logout">ログアウト</button>
        </header>

        <!-- 店舗選択 -->
        <div class="card">
            <h3>店舗選択</h3>
            <p class="note">編集する店舗を選んでください。</p>
            <select v-model="selectedStoreId" @change="onStoreChange">
                <option disabled value="">-- 店舗を選択 --</option>
                <option v-for="s in storeList" :key="s._id" :value="s._id">
                    {{ s.name }}（{{ s.location }}）
                </option>
            </select>
            <p v-if="storeLoadError" class="error">{{ storeLoadError }}</p>
        </div>

        <!-- 概要メトリクス（本日） -->
        <div class="card" v-if="selectedStoreId">
            <h3>本日のサマリー</h3>
            <div class="summary">
                <div class="summary-item">
                    <div class="label">完了件数</div>
                    <div class="value">{{ metrics.count }}</div>
                </div>
                <div class="summary-item">
                    <div class="label">平均待ち(分)</div>
                    <div class="value">{{ metrics.avgWait }}</div>
                </div>
                <div class="summary-item">
                    <div class="label">平均対応(分)</div>
                    <div class="value">{{ metrics.avgService }}</div>
                </div>
                <div class="summary-item">
                    <div class="label">合計平均(分)</div>
                    <div class="value">{{ metrics.avgTotal }}</div>
                </div>

            </div>
            <button class="secondary" @click="fetchMetrics">再読込</button>
            <p class="note small">対象期間: 今日の0時〜現在</p>
            <p v-if="metricsError" class="error">{{ metricsError }}</p>
        </div>

        <!-- 店舗設定 -->
        <div class="card" v-if="selectedStoreId">
            <h3>店舗設定</h3>
            <form @submit.prevent="saveSettings">
                <label>1人あたりの推定待ち分</label>
                <input type="number" min="1" v-model.number="waitMinutesPerPerson" />
                <label>通知テンプレ（near）</label>
                <input type="text" v-model="tplNear" placeholder="あと{{n}}人でご案内予定です。" />
                <label>通知テンプレ（ready）</label>
                <input type="text" v-model="tplReady" placeholder="まもなくご案内できます。" />
                <button type="submit" :disabled="saving">
                    {{ saving ? '保存中...' : '保存' }}
                </button>
                <span v-if="saved" class="ok">保存しました</span>
            </form>
            <p v-if="settingsError" class="error">{{ settingsError }}</p>
        </div>

        <!-- PINリセット -->
        <div class="card" v-if="selectedStoreId">
            <h3>店員PINリセット</h3>
            <p class="note">4〜8桁の数字を推奨。保存後、店員は新PINでログインできます。</p>
            <form @submit.prevent="resetPin">
                <label>新しいPIN</label>
                <input type="password" v-model="newPin" placeholder="例: 1234" />
                <button type="submit" :disabled="pinSaving">
                    {{ pinSaving ? '更新中...' : 'PINを更新' }}
                </button>
                <span v-if="pinSaved" class="ok">更新しました</span>
            </form>
            <p v-if="pinError" class="error">{{ pinError }}</p>
        </div>

        <!-- 履歴一覧（直近50件） -->
        <div class="card" v-if="selectedStoreId">
            <h3>完了履歴（最新50件）</h3>
            <button class="secondary" @click="fetchHistory">再読込</button>
            <table class="table" v-if="historyItems.length">
                <thead>
                    <tr>
                        <th>完了時刻</th>
                        <th>名前</th>
                        <th>受付時刻</th>
                        <th>待ち分</th>
                        <th>対応分</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="it in historyItems" :key="it._id">
                        <td>{{ fmt(it.completed_at) }}</td>
                        <td>{{ it.customer_name || '（不明）' }}</td>
                        <td>{{ fmt(it.joined_at) }}</td>
                        <td style="text-align:right;">{{ it.wait_minutes }}</td>
                        <td style="text-align:right;">{{ it.service_minutes ?? 0 }}</td>
                    </tr>
                </tbody>
            </table>
            <p v-else class="note">履歴がまだありません。</p>
            <p v-if="historyError" class="error">{{ historyError }}</p>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()
const adminToken = localStorage.getItem('adminToken') || ''
const adminInfo = JSON.parse(localStorage.getItem('adminInfo') || '{}')

// 店舗一覧
const storeList = ref([])
const selectedStoreId = ref('')
const storeLoadError = ref('')

const fetchStoreList = async () => {
    try {
        const res = await axios.get('/api/store/list')
        storeList.value = res.data || []
        if (!selectedStoreId.value) {
            const preferred = (adminInfo?.storeIds && adminInfo.storeIds[0]) || ''
            if (preferred && storeList.value.some(s => s._id === preferred)) {
                selectedStoreId.value = preferred
            }
        }
        if (selectedStoreId.value) {
            await Promise.all([fetchSettings(), fetchMetrics(), fetchHistory()])
        }
    } catch (err) {
        console.error('店舗一覧取得失敗:', err)
        storeLoadError.value = '店舗一覧の取得に失敗しました'
    }
}
const onStoreChange = async () => {
    if (selectedStoreId.value) {
        await Promise.all([fetchSettings(), fetchMetrics(), fetchHistory()])
    }
}

// 共通ヘッダ
const authHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}` } })

// 設定
const waitMinutesPerPerson = ref(5)
const tplNear = ref('あと{{n}}人でご案内予定です。')
const tplReady = ref('まもなくご案内できます。')
const saving = ref(false)
const saved = ref(false)
const settingsError = ref('')

const fetchSettings = async () => {
    settingsError.value = ''
    try {
        const res = await axios.get(`/api/admin/stores/${selectedStoreId.value}/settings`, authHeaders())
        waitMinutesPerPerson.value = res.data?.waitMinutesPerPerson ?? 5
        tplNear.value = res.data?.notificationTemplate?.near ?? 'あと{{n}}人でご案内予定です。'
        tplReady.value = res.data?.notificationTemplate?.ready ?? 'まもなくご案内できます。'
    } catch (err) {
        console.error('設定取得失敗:', err)
        if (err?.response?.status === 401) { localStorage.removeItem('adminToken'); localStorage.removeItem('adminInfo'); router.push('/admin-login'); return }
        settingsError.value = err?.response?.data?.error || '設定の取得に失敗しました'
    }
}
const saveSettings = async () => {
    if (!selectedStoreId.value) return
    saving.value = true; saved.value = false; settingsError.value = ''
    try {
        await axios.patch(`/api/admin/stores/${selectedStoreId.value}/settings`, {
            waitMinutesPerPerson: waitMinutesPerPerson.value,
            notificationTemplate: { near: tplNear.value, ready: tplReady.value }
        }, authHeaders())
        saved.value = true; setTimeout(() => (saved.value = false), 1500)
    } catch (err) {
        console.error('設定保存失敗:', err)
        if (err?.response?.status === 401) { localStorage.removeItem('adminToken'); localStorage.removeItem('adminInfo'); router.push('/admin-login'); return }
        settingsError.value = err?.response?.data?.error || '設定の保存に失敗しました'
    } finally { saving.value = false }
}

// PIN
const newPin = ref('')
const pinSaving = ref(false)
const pinSaved = ref(false)
const pinError = ref('')

const resetPin = async () => {
    pinSaving.value = true; pinSaved.value = false; pinError.value = ''
    try {
        await axios.post(`/api/admin/stores/${selectedStoreId.value}/reset-pin`,
            { newPin: (newPin.value || '').trim() },
            authHeaders()
        )
        pinSaved.value = true
        newPin.value = ''
        setTimeout(() => (pinSaved.value = false), 1500)
    } catch (err) {
        console.error('PIN更新失敗:', err)
        if (err?.response?.status === 401) { localStorage.removeItem('adminToken'); localStorage.removeItem('adminInfo'); router.push('/admin-login'); return }
        pinError.value = err?.response?.data?.error || 'PINの更新に失敗しました'
    } finally { pinSaving.value = false }
}

// メトリクス
const metrics = ref({ count: 0, avgWait: 0 })
const metricsError = ref('')

const fetchMetrics = async () => {
    metricsError.value = ''
    try {
        const res = await axios.get(`/api/admin/stores/${selectedStoreId.value}/metrics`, authHeaders())
        metrics.value = {
            count: res.data?.count || 0,
            avgWait: res.data?.avgWait || 0,
            avgService: res.data?.avgService || 0,
            avgTotal: res.data?.avgTotal || ((res.data?.avgWait || 0) + (res.data?.avgService || 0))
        }
    } catch (err) {
        console.error('メトリクス取得失敗:', err)
        if (err?.response?.status === 401) { localStorage.removeItem('adminToken'); localStorage.removeItem('adminInfo'); router.push('/admin-login'); return }
        metricsError.value = err?.response?.data?.error || 'メトリクスの取得に失敗しました'
    }
}

// 履歴
const historyItems = ref([])
const historyError = ref('')

const fetchHistory = async () => {
    historyError.value = ''
    try {
        const res = await axios.get(`/api/admin/stores/${selectedStoreId.value}/history?limit=50`, authHeaders())
        historyItems.value = res.data?.items || []
    } catch (err) {
        console.error('履歴取得失敗:', err)
        if (err?.response?.status === 401) { localStorage.removeItem('adminToken'); localStorage.removeItem('adminInfo'); router.push('/admin-login'); return }
        historyError.value = err?.response?.data?.error || '履歴の取得に失敗しました'
    }
}

const fmt = (d) => {
    if (!d) return ''
    const date = new Date(d)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return `${y}/${m}/${day} ${hh}:${mm}`
}

// ログアウト
const logout = () => { localStorage.removeItem('adminToken'); localStorage.removeItem('adminInfo'); router.push('/admin-login') }

// 起動時
onMounted(async () => {
    if (!adminToken) { router.push('/admin-login'); return }
    await fetchStoreList()
})
</script>

<style scoped>
.page-container {
    max-width: 960px;
    margin: 32px auto;
    padding: 16px;
}

.header {
    display: flex;
    align-items: center;
    margin-bottom: 16px;
}

.spacer {
    flex: 1;
}

.logout {
    padding: 8px 12px;
    background-color: #999;
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
}

.card {
    margin-top: 16px;
    padding: 16px;
    border: 1px solid #ddd;
    border-radius: 10px;
    background-color: #fff;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

select,
input {
    display: block;
    width: 80%;
    margin: 10px 0;
    padding: 8px;
    font-size: 1em;
    border: 1px solid #ccc;
    border-radius: 6px;
}

button[type="submit"],
.secondary {
    margin-top: 12px;
    padding: 8px 16px;
    background-color: #28a745;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
}

.secondary {
    background-color: #007bff;
}

.summary {
    display: flex;
    gap: 16px;
    margin-top: 8px;
}

.summary-item {
    flex: 1;
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 12px;
    text-align: center;
}

.label {
    color: #666;
    font-size: .9em;
}

.value {
    font-size: 1.6em;
    font-weight: bold;
    margin-top: 4px;
}

.table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
}

.table th,
.table td {
    border: 1px solid #eee;
    padding: 8px;
}

.table th {
    background: #fafafa;
    text-align: left;
}

.ok {
    color: #0a7a0a;
    margin-left: 12px;
}

.note {
    color: #666;
    font-size: .9em;
    margin-bottom: 8px;
}

.note.small {
    font-size: .85em;
}

.error {
    color: red;
    margin-top: 8px;
}
</style>
