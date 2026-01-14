<script setup>
import { ref, computed, onMounted } from "vue"
import { useRouter } from "vue-router"

const router = useRouter()

const email = ref("")
const password = ref("")
const confirmPassword = ref("")
const showSuccess = ref(false)
const isLoading = ref(false)

onMounted(() => {
  const stored = sessionStorage.getItem("resetEmail")
  if (!stored) router.push("/login")
  email.value = stored
})

const maskedEmail = computed(() => {
  const [name, domain] = email.value.split("@")
  return `${name[0]}*****${name.at(-1)}@${domain}`
})

const rules = computed(() => ({
  length: password.value.length >= 8,
  upper: /[A-Z]/.test(password.value),
  lower: /[a-z]/.test(password.value),
  number: /\d/.test(password.value),
  special: /[^A-Za-z0-9]/.test(password.value)
}))

const validPassword = computed(() =>
  Object.values(rules.value).every(Boolean) &&
  password.value === confirmPassword.value
)

const resetPassword = async () => {
  if (isLoading.value) return

  isLoading.value = true

  try {
    const res = await fetch("http://localhost:5000/forgot-password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.value,
        password: password.value
      })
    })

    const data = await res.json()
    if (!res.ok) {
      isLoading.value = false
      return alert(data.message)
    }

    sessionStorage.removeItem("resetEmail")
    showSuccess.value = true
  } catch {
    alert("Reset failed")
  } finally {
    isLoading.value = false
  }
}

const goToLogin = () => {
  router.push("/login")
}
</script>

<template>
  <div class="page">
    <div class="card">
      <h2>Reset Password</h2>
      <p class="subtitle">
        Account: <strong>{{ maskedEmail }}</strong>
      </p>

      <input
        type="password"
        placeholder="New Password"
        v-model="password"
        :disabled="isLoading"
      />

      <input
        type="password"
        placeholder="Re-enter Password"
        v-model="confirmPassword"
        :disabled="isLoading"
      />

      <ul class="rules">
        <li :class="{ ok: rules.length }">8 characters</li>
        <li :class="{ ok: rules.upper }">Uppercase letter</li>
        <li :class="{ ok: rules.lower }">Lowercase letter</li>
        <li :class="{ ok: rules.number }">Number</li>
        <li :class="{ ok: rules.special }">Special character</li>
      </ul>

      <button
        :disabled="!validPassword || isLoading"
        @click="resetPassword"
      >
        <span v-if="!isLoading">Reset Password</span>

        <span v-else class="loading">
          <span class="spinner"></span>
          Resetting...
        </span>
      </button>
    </div>

    <!-- ===== SUCCESS MODAL ===== -->
    <div v-if="showSuccess" class="overlay">
      <div class="success-modal">
        <h3>Password Reset</h3>
        <p>
          Your password has been reset successfully.<br />
          Please log in with your new password.
        </p>

        <button @click="goToLogin">
          OK
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== Page ===== */
.page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(to bottom right, #0e192d 0%, #000 75%);
  color: #e5e7eb;
  font-family: system-ui, -apple-system, BlinkMacSystemFont;
}

/* ===== Card ===== */
.card {
  width: 100%;
  max-width: 400px;
  background: rgba(10, 15, 30, 0.85);
  padding: 2.4rem;
  border-radius: 18px;
  border: 1px solid #1e3a8a;
  box-shadow:
    0 25px 45px rgba(0,0,0,0.85),
    0 0 35px rgba(59,130,246,0.18);
}

/* ===== Headings ===== */
h2 {
  text-align: center;
  margin-bottom: 0.6rem;
  letter-spacing: 0.14em;
  color: #e0e7ff;
}

.subtitle {
  text-align: center;
  font-size: 0.85rem;
  color: #93c5fd;
  margin-bottom: 1.6rem;
}

/* ===== Inputs ===== */
input {
  width: 100%;
  padding: 0.85rem;
  margin-bottom: 0.9rem;
  border-radius: 10px;
  border: 1px solid #1e293b;
  background: #020617;
  color: #e5e7eb;
  font-size: 0.95rem;
}

input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px rgba(59,130,246,0.4);
}

/* ===== Rules ===== */
.rules {
  list-style: none;
  padding: 0;
  margin: 0.8rem 0 1.6rem;
  font-size: 0.75rem;
}

.rules li {
  margin-bottom: 0.35rem;
  color: #94a3b8;
  padding-left: 1.2rem;
  position: relative;
}

.rules li::before {
  content: "•";
  position: absolute;
  left: 0;
  color: #475569;
}

.rules li.ok {
  color: #60a5fa;
}

.rules li.ok::before {
  content: "✓";
  color: #60a5fa;
}

/* ===== Button ===== */
button {
  width: 100%;
  padding: 0.9rem;
  border-radius: 10px;
  border: none;
  background: linear-gradient(to bottom right, #1d4ed8, #3b82f6);
  color: white;
  font-size: 1rem;
  cursor: pointer;
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ===== Success Modal ===== */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
}

.success-modal {
  width: 100%;
  max-width: 320px;
  background: rgba(10, 15, 30, 0.95);
  padding: 2rem;
  border-radius: 16px;
  border: 1px solid #1e3a8a;
  text-align: center;
  box-shadow:
    0 25px 50px rgba(0,0,0,0.9),
    0 0 30px rgba(59,130,246,0.25);
}

.success-modal h3 {
  margin-bottom: 0.8rem;
  letter-spacing: 0.12em;
  color: #e0e7ff;
}

.success-modal p {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-bottom: 1.4rem;
}

.success-modal button {
  width: 100%;
}

.loading {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 3px solid rgba(255,255,255,0.25);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Disable inputs while loading */
input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
