<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"

const router = useRouter()
const token = localStorage.getItem("token")

const user = ref({
  username: "",
  dob: "",
  country: "",
  state: "",
  city: ""
})

const logout = () => {
  localStorage.removeItem("token")
  localStorage.removeItem("user") // if you stored it earlier
  router.push("/login")
}

onMounted(async () => {
  if (!token) {
    router.push("/login")
    return
  }

  const res = await fetch("http://localhost:5000/user/profile", {
    headers: {
        Authorization: `Bearer ${token}`
    }
    })

    console.log("STATUS:", res.status)

  if (!res.ok) {
    localStorage.removeItem("token")
    return router.push("/login")
  }

  user.value = await res.json()
})
</script>

<template>
  <div class="page">
    <div class="card">
      <h2>User Profile</h2>

      <div class="row">
        <span>Username:</span>
        <strong>{{ user.username }}</strong>
      </div>

      <div class="row">
        <span>Date of Birth:</span>
        <strong>{{ user.dob }}</strong>
      </div>

      <div class="row">
        <span>Country:</span>
        <strong>{{ user.country }}</strong>
        </div>

        <div class="row">
        <span>State:</span>
        <strong>{{ user.state }}</strong>
        </div>

        <div class="row">
        <span>Region:</span>
        <strong>{{ user.city }}</strong>
        </div>
        <button @click="router.push('/create')">
            Create
        </button>
        <button class="logout" @click="logout">
            Logout
        </button>
      <button @click="router.push('/home')">Back</button>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #020617;
}

.card {
  background: rgba(10,15,30,0.9);
  padding: 2rem;
  border-radius: 16px;
  width: 100%;
  max-width: 360px;
  color: #e5e7eb;
  border: 1px solid #1e3a8a;
}

h2 {
  text-align: center;
  margin-bottom: 1.4rem;
}

.row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.8rem;
  font-size: 0.9rem;
}

button {
  margin-top: 1.4rem;
  width: 100%;
  padding: 0.7rem;
  border-radius: 8px;
  border: none;
  background: #3b82f6;
  color: white;
  cursor: pointer;
}
.logout {
  margin-top: 0.6rem;
  width: 100%;
  padding: 0.7rem;
  border-radius: 8px;
  border: none;
  background: #dc2626; /* red */
  color: white;
  cursor: pointer;
}

.logout:hover {
  background: #b91c1c;
}

</style>
