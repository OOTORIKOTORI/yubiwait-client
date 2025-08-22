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

        <div class="card" v-if="selectedStoreId">
            <h3>期間フィルタ</h3>
            <p class="note small">
                日付だけ指定でOK（JST基準）。
                <small v-if="activeQuick" class="note">選択中: {{ {today:'今日',yesterday:'昨日',week:'今週',month:'今月'}[activeQuick] }}</small>
            </p>
            <div class="range-row">
                <input type="date" v-model="fromDate" @input="activeQuick=null">
                <span>〜</span>
                <input type="date" v-model="toDate"   @input="activeQuick=null">
                <button class="secondary" @click="applyRange">適用</button>
                <button class="chip" :class="{ active: activeQuick === 'today' }" aria-pressed="true"
                    v-if="activeQuick === 'today'" @click="quick('today')">今日</button>
                <button class="chip" :class="{ active: activeQuick === 'today' }"
                    :aria-pressed="activeQuick === 'today'" v-else @click="quick('today')">今日</button>
                <button class="chip" :class="{ active: activeQuick === 'yesterday' }" aria-pressed="true"
                    v-if="activeQuick === 'yesterday'" @click="quick('yesterday')">昨日</button>
                <button class="chip" :class="{ active: activeQuick === 'yesterday' }"
                    :aria-pressed="activeQuick === 'yesterday'" v-else @click="quick('yesterday')">昨日</button>
                <button class="chip" :class="{ active: activeQuick === 'week' }" aria-pressed="true"
                    v-if="activeQuick === 'week'" @click="quick('week')">今週</button>
                <button class="chip" :class="{ active: activeQuick === 'week' }" :aria-pressed="activeQuick === 'week'"
                    v-else @click="quick('week')">今週</button>
                <button class="chip" :class="{ active: activeQuick === 'month' }" aria-pressed="true"
                    v-if="activeQuick === 'month'" @click="quick('month')">今月</button>
                <button class="chip" :class="{ active: activeQuick === 'month' }"
                    :aria-pressed="activeQuick === 'month'" v-else @click="quick('month')">今月</button>
            </div>
            <p class="note small">日付だけ指定でOK（JST基準）。</p>
        </div>

        <!-- 概要メトリクス（本日） -->
        <div class="card" v-if="selectedStoreId">
            <h3>{{ summaryTitle }}</h3>
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
            <p class="note small">対象期間: {{ periodLabel }}</p>
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
            <div class="history-header">
                <h3 class="flex-grow">{{ historyTitle }}</h3>
                <label class="limit-label">
                    表示件数
                    <select v-model.number="historyLimit" @change="applyRange">
                        <option :value="20">20</option>
                        <option :value="50">50</option>
                        <option :value="100">100</option>
                        <option :value="200">200</option>
                    </select>
                </label>
            </div>
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
                        <td>{{ fmtDateTime(it.completed_at) }}</td>
                        <td>{{ it.customer_name || '（不明）' }}</td>
                        <td>{{ fmtDateTime(it.joined_at) }}</td>
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
import { computed } from 'vue'

const router = useRouter()
const adminToken = localStorage.getItem('adminToken') || ''
const adminInfo = JSON.parse(localStorage.getItem('adminInfo') || '{}')

// 店舗一覧
const storeList = ref([])
const selectedStoreId = ref('')
const storeLoadError = ref('')

// 追記：期間フィルタの状態
const fromDate = ref('') // 'YYYY-MM-DD'
const toDate = ref('')   // 'YYYY-MM-DD'
const periodLabel = ref('今日の0時〜現在')
const activeQuick = ref(null) // 'today' | 'yesterday' | 'week' | 'month' | null

// 期間クエリ生成（date-only をそのまま送る：サーバ側でJST解釈）
const rangeParams = () => {
    const p = new URLSearchParams()
    if (fromDate.value) p.set('from', fromDate.value)
    if (toDate.value) p.set('to', toDate.value)
    if (historyLimit.value) p.set('limit', String(historyLimit.value))
    return p.toString()
}

// JSTで YYYY-MM-DD を作る
const fmtJST = (d) => new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(d).replace(/\//g, '-')
// JSTの「今日」の日付文字列
const todayJST = () => fmtJST(new Date())
// JST日付文字列から±days した日付文字列（JST基準）
const shiftJST = (yyyy_mm_dd, days) => {
    const base = new Date(`${yyyy_mm_dd}T00:00:00+09:00`)
    return fmtJST(new Date(base.getTime() + days * 86400000))
}

// クイック範囲
const quick = (kind) => {
    if (activeQuick.value === kind) return; // もうその範囲なら何もしない
    if (kind === 'today') {
        fromDate.value = ''; toDate.value = ''; // サーバ既定=今日
    } else if (kind === 'yesterday') {
        const t = todayJST(); const y = shiftJST(t, -1)
        fromDate.value = y; toDate.value = y
    } else if (kind === 'week') {
        // 週の開始は月曜（JST）
        const t = todayJST()
        const dt = new Date(`${t}T00:00:00+09:00`)
        const dow = (dt.getDay() + 6) % 7; // 月曜=0
        const mon = fmtJST(new Date(dt.getTime() - dow * 86400000))
        fromDate.value = mon; toDate.value = t
    } else if (kind === 'month') {
        const t = todayJST()
        const [y, m] = t.split('-').map(Number)
        const first = `${y}-${String(m).padStart(2, '0')}-01`
        fromDate.value = first; toDate.value = t
    }
    applyRange()
}

const applyRange = async () => {
    if (fromDate.value && toDate.value && fromDate.value > toDate.value) {
        // 入れ替える場合
        [fromDate.value, toDate.value] = [toDate.value, fromDate.value]
    }
    // 期間適用：isTodayRange ロジックは廃止し、常に現在のfrom/toから判定
    activeQuick.value = deriveQuickFromRange()

    // 永続化
    localStorage.setItem('adminRangeFrom', fromDate.value || '')
    localStorage.setItem('adminRangeTo', toDate.value || '')
    localStorage.setItem('adminHistoryLimit', String(historyLimit.value || 50))
    await Promise.all([fetchMetrics(), fetchHistory()])
}

// 起動時に復元した期間から “どのクイックか” を推定
// 追加（または置き換え）：現在の from/to からどのクイックか判定
function deriveQuickFromRange() {
    const t = todayJST()
    // today: from/to 共に空（サーバ既定で今日扱い）
    if (fromDate.value === '' && toDate.value === '') return 'today'

    // yesterday
    const y = shiftJST(t, -1)
    if (fromDate.value === y && toDate.value === y) return 'yesterday'

    // week（今週：JSTの月曜〜今日）
    const dt = new Date(`${t}T00:00:00+09:00`)
    const dow = (dt.getDay() + 6) % 7 // 月曜=0
    const mon = fmtJST(new Date(dt.getTime() - dow * 86400000))
    if (fromDate.value === mon && toDate.value === t) return 'week'

    // month（今月：1日〜今日）
    const [yy, mm] = t.split('-').map(Number)
    const first = `${yy}-${String(mm).padStart(2, '0')}-01`
    if (fromDate.value === first && toDate.value === t) return 'month'

    return null // 手入力などの任意期間
}

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
const metrics = ref({ count: 0, avgWait: 0, avgService: 0, avgTotal: 0 })
const metricsError = ref('')

// fetchMetrics を修正：クエリを付与して periodLabel を更新
const fetchMetrics = async () => {
    metricsError.value = ''
    try {
        const q = rangeParams()
        const url = q
            ? `/api/admin/stores/${selectedStoreId.value}/metrics?${q}`
            : `/api/admin/stores/${selectedStoreId.value}/metrics`
        const res = await axios.get(url, authHeaders())
        metrics.value = {
            count: res.data?.count || 0,
            avgWait: res.data?.avgWait || 0,
            avgService: res.data?.avgService || 0,
            avgTotal: res.data?.avgTotal || ((res.data?.avgWait || 0) + (res.data?.avgService || 0))
        }
        // 期間ラベル
        const f = res.data?.from ? new Date(res.data.from) : null
        const t = res.data?.to ? new Date(res.data.to) : null
        const fmt = (d) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
        periodLabel.value = (f && t) ? `${fmt(f)}〜${fmt(new Date(t.getTime() - 1))}` : '今日の0時〜現在'
    } catch (err) {
        console.error('メトリクス取得失敗:', err)
        if (err?.response?.status === 401) { localStorage.removeItem('adminToken'); localStorage.removeItem('adminInfo'); router.push('/admin-login'); return }
        metricsError.value = err?.response?.data?.error || 'メトリクスの取得に失敗しました'
    }
}
// 履歴
const historyItems = ref([])
const historyError = ref('')

// fetchHistory を修正：クエリを付与
const fetchHistory = async () => {
    historyError.value = ''
    try {
        const p = new URLSearchParams()
        p.set('limit', String(historyLimit.value || 50))
        if (fromDate.value) p.set('from', fromDate.value)
        if (toDate.value) p.set('to', toDate.value)
        const res = await axios.get(`/api/admin/stores/${selectedStoreId.value}/history?${p.toString()}`, authHeaders())
        historyItems.value = res.data?.items || []
    } catch (err) {
        console.error('履歴取得失敗:', err)
        if (err?.response?.status === 401) { localStorage.removeItem('adminToken'); localStorage.removeItem('adminInfo'); router.push('/admin-login'); return }
        historyError.value = err?.response?.data?.error || '履歴の取得に失敗しました'
    }
}

const historyLimit = ref(Number(localStorage.getItem('adminHistoryLimit') || 50))

// 日時（テーブル用）
const fmtDateTime = (d) => {
    if (!d) return ''
    const date = new Date(d)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return `${y}/${m}/${day} ${hh}:${mm}`
}
// 日付だけ（タイトル用）
const fmtYMD = (s) => s?.replaceAll('-', '/')

const historyTitle = computed(() => {
    const f = fromDate.value, t = toDate.value
    const n = historyLimit.value
    if (!f && !t) return `完了履歴（本日の最新${n}件）`
    if (f && t && f === t) return `完了履歴（${fmtYMD(f)} の最新${n}件）`
    if (f && t) return `完了履歴（${fmtYMD(f)}〜${fmtYMD(t)} の最新${n}件）`
    if (f && !t) return `完了履歴（${fmtYMD(f)}〜現在 の最新${n}件）`
    if (!f && t) return `完了履歴（〜${fmtYMD(t)} の最新${n}件）`
    return `完了履歴（最新${n}件）`
})

// ログアウト
const logout = () => { localStorage.removeItem('adminToken'); localStorage.removeItem('adminInfo'); router.push('/admin-login') }

// 起動時
onMounted(async () => {
    if (!adminToken) { router.push('/admin-login'); return }
    // 期間/件数の復元
    const f = localStorage.getItem('adminRangeFrom') || ''
    const t = localStorage.getItem('adminRangeTo') || ''
    if (f) fromDate.value = f
    if (t) toDate.value = t
    const lim = Number(localStorage.getItem('adminHistoryLimit') || 50)
    historyLimit.value = lim
    activeQuick.value = deriveQuickFromRange()
    await fetchStoreList()
})

const summaryTitle = computed(() => {
    const f = fromDate.value
    const t = toDate.value
    if (!f && !t) return '本日のサマリー'
    if (f && t && f === t) return `${fmtYMD(f)} のサマリー`
    if (f && t) return `サマリー（${fmtYMD(f)}〜${fmtYMD(t)}）`
    if (f && !t) return `サマリー（${fmtYMD(f)}〜現在）`
    if (!f && t) return `サマリー（〜${fmtYMD(t)}）`
    return 'サマリー'
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

.range-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    justify-content: center;
}

.button.link,
.link {
    background: transparent;
    color: #007bff;
    border: none;
    cursor: pointer;
    text-decoration: underline;
    padding: 4px 6px;
}

.history-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 10px;
}

.history-header .flex-grow {
    flex: 1;
    margin: 0;
}

.limit-label {
    font-size: 14px;
    color: #444;
    display: flex;
    align-items: center;
    gap: 6px;
}

.limit-label select {
    padding: 4px 6px;
}

.chip {
    background: #f0f6ff;
    color: #0b5ed7;
    border: 1px solid #b6d1ff;
    border-radius: 16px;
    padding: 4px 10px;
    cursor: pointer;
}

.chip.active {
    background: #0b5ed7;
    color: #fff;
    border-color: #0b5ed7;
}

.chip:focus {
    outline: 2px solid #99c0ff;
    outline-offset: 1px;
}

.chip:focus-visible {
    outline: 2px solid #99c0ff;
    outline-offset: 2px;
}
</style>
