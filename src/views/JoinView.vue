<template>
  <div>
    <h2>受付ページ</h2>
    <p>店舗ID: {{ storeId }}</p>
    <input v-model="name" placeholder="お名前を入力" />
    <button @click="submit">登録</button>

    <p v-if="message">{{ message }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const storeId = route.params.storeId

const name = ref('')
const message = ref('')

const submit = async () => {
  if (!name.value) return

  try {
    const res = await axios.post(`/api/join/${storeId}`, { name: name.value })
    message.value = res.data.message
  } catch (err) {
    message.value = '送信エラー'
    console.error(err)
  }
}
</script>
