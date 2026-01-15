<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"

const router = useRouter()
const bgColor = ref("#808080")
const token = localStorage.getItem("token")

onMounted(async () => {
  const res = await fetch("http://localhost:5000/user/theme", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  if (res.ok) {
    const data = await res.json()
    bgColor.value = data.themeColor || "#808080"
  }
})

const saveColor = async () => {
  await fetch("http://localhost:5000/user/theme", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ color: bgColor.value })
  })
}

const goToProfile = () => {
  router.push("/profile")
}
</script>

<template>
  <div class="page" :style="{ backgroundColor: bgColor }">

    <!-- 👤 Profile Icon -->
    <div class="profile-icon" @click="goToProfile">
      👤
    </div>

    <h2>Homepage</h2>

    <input type="color" v-model="bgColor" />
    <button @click="saveColor">Save Theme</button>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 2rem;
  transition: background-color 0.3s ease;
  position: relative;
}

/* Profile Icon */
.profile-icon {
  position: absolute;
  top: 20px;
  right: 20px;
  font-size: 1.6rem;
  cursor: pointer;
  background: rgba(0,0,0,0.3);
  padding: 0.5rem;
  border-radius: 50%;
  transition: transform 0.2s ease, background 0.2s ease;
}

.profile-icon:hover {
  transform: scale(1.15);
  background: rgba(0,0,0,0.45);
}
</style>
