<script setup>
import { useRoute, useRouter } from 'vue-router'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/firebaseConfig'

const route = useRoute()
const router = useRouter()

const uid = route.query.uid

if (uid) {
  const userRef = doc(db, 'users', uid)
  updateDoc(userRef, { premium: true }).then(() => {
    alert('🎉 You are now a premium user!')
    router.push('/')
  })
}
</script>

<template>
  <div class="p-10 text-center">
    <h1 class="text-2xl font-bold text-green-600">Processing premium status...</h1>
  </div>
</template>
