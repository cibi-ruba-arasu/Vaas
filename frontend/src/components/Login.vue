<script setup>
import { ref } from "vue"
import { useRouter } from "vue-router"
import { API_URL } from '../config.js';
const router = useRouter()

const email = ref("")
const password = ref("")
const showPassword = ref(false)
const isLoading = ref(false)

const togglePassword = () => {
  showPassword.value = !showPassword.value
}

const handleLogin = async () => {
  if (!email.value || !password.value) {
    return alert("Please fill all fields")
  }

  isLoading.value = true

  try {
    // ✅ DYNAMIC URL: Uses localhost in dev, but relative path on Render
    const API_URL = import.meta.env.PROD ? "" : "http://localhost:5000"

    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.value,
        password: password.value
      })
    })

    const data = await res.json()

    if (!res.ok) {
      return alert(data.message)
    }

    // Save auth data to sessionStorage
    sessionStorage.setItem("token", data.token)
    sessionStorage.setItem("user", JSON.stringify(data.user))

    // Redirect to Homepage
    router.push("/home")

  } catch (err) {
    alert("Login failed")
    console.error(err)
  } finally {
    isLoading.value = false
  }
}
</script>
<template>
    <head>
        <title>Login | Loomart</title>
    </head>
  <div class="page">

    <!-- 🧿 Hidden Easter Egg -->
    <div class="easter-egg">
      <span class="halo"></span>
      <span class="eye-symbol">𓂀</span>
      <div class="tooltip">
        Congratulations!<br />
        you found the light within you
      </div>
    </div>

    <!-- Gate message -->
    <div class="gate-text">
      <span>Enter the Gates</span>
    </div>

    <div class="login-card">
      <h2 class="title">Login</h2>

      <!-- 🌙 Patience Box -->
      

      <input
        type="email"
        placeholder="Email"
        v-model="email"
      />

      <div class="password-wrapper">
        <input
          :type="showPassword ? 'text' : 'password'"
          placeholder="Password"
          v-model="password"
        />

        <span
          class="eye"
          @click="togglePassword"
          :title="showPassword ? 'Hide password' : 'Show password'"
        >
          𓂀
        </span>
      </div>

      <button @click="handleLogin" :disabled="isLoading">
        <span v-if="!isLoading">Login</span>
        <span v-else class="loading">
          <span class="spinner"></span>
          Verifying...
        </span>
      </button>
      
      <div class="patience-box">
        Thank ✨you✨ for your patience
      </div>

      <div class="links">
        <router-link to="/register">
          Do not have an account? Register here
        </router-link>

        <router-link to="/forgot-password">
          Forgot password?
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== Page Background ===== */
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: linear-gradient(to bottom right, #0e192d 0%, #000 75%);
  color: #e5e7eb;
  font-family: system-ui, -apple-system, BlinkMacSystemFont;
}

/* ===== 🧿 Easter Egg ===== */
.easter-egg {
  position: fixed;
  top: 14px;
  left: 14px;
  width: 42px;
  height: 42px;
  cursor: pointer;
  z-index: 999;
}

.eye-symbol {
  position: relative;
  font-size: 1.6rem;
  color: #60a5fa;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 2;
}

.halo {
  position: absolute;
  inset: -10px;
  background: radial-gradient(circle, rgba(96,165,250,0.45), transparent 70%);
  border-radius: 50%;
  opacity: 0;
  filter: blur(6px);
  transition: opacity 0.3s ease;
}

.tooltip {
  position: absolute;
  top: 50%;
  left: 55px;
  transform: translateY(-50%);
  background: rgba(2, 6, 23, 0.95);
  border: 1px solid rgba(96, 165, 250, 0.4);
  padding: 0.6rem 0.8rem;
  border-radius: 8px;
  font-size: 0.75rem;
  color: #e0e7ff;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  box-shadow: 0 0 20px rgba(96, 165, 250, 0.35);
  transition: opacity 0.3s ease;
}

.easter-egg:hover .eye-symbol {
  opacity: 1;
  transform: rotate(90deg);
}

.easter-egg:hover .halo {
  opacity: 1;
}

.easter-egg:hover .tooltip {
  opacity: 1;
}

/* ===== Gate Text ===== */
.gate-text {
  margin-bottom: 1.3rem;
  font-size: 1.6rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #3b82f6;
  text-shadow: 0 0 22px rgba(59, 130, 246, 0.35);
  font-family: 'Times New Roman', Times, serif;
}

/* ===== Login Card ===== */
.login-card {
  width: 100%;
  max-width: 380px;
  background: rgba(10, 15, 30, 0.75);
  padding: 2.5rem;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  border: 1px solid rgb(59, 131, 246);
  box-shadow:
    0 25px 45px rgba(0, 0, 0, 0.8),
    0 0 30px rgba(41, 122, 251, 0.12);
}

/* ===== Title ===== */
.title {
  text-align: center;
  margin-bottom: 0.3rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: #e0e7ff;
}

/* 🌙 Patience Box */
.patience-box {
  text-align: center;
  font-size: 0.75rem;
  color: #93c5fd;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.25);
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
  margin-bottom: 0.6rem;
  box-shadow: inset 0 0 10px rgba(59, 130, 246, 0.15);
  height: 20px;
}

/* ===== Inputs ===== */
.login-card input {
  width: 100%;
  padding: 0.75rem 0.9rem;
  border-radius: 8px;
  border: 1px solid #1e293b;
  background: #020617;
  color: #e5e7eb;
  font-size: 0.95rem;
  box-sizing: border-box;
}

.login-card input::placeholder {
  color: #64748b;
}

.login-card input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.4);
}

/* ===== Password Wrapper ===== */
.password-wrapper {
  position: relative;
}

.password-wrapper input {
  padding-right: 2.8rem;
}

/* ===== Eye Icon ===== */
.eye {
  position: absolute;
  right: 0.8rem;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  font-size: 1.15rem;
  opacity: 0.75;
  user-select: none;
  color: #60a5fa;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.eye:hover {
  opacity: 1;
  transform: translateY(-50%) scale(1.25) rotate(90deg);
}

/* ===== Button ===== */
.login-card button {
  margin-top: 0.6rem;
  padding: 0.8rem;
  border-radius: 8px;
  border: none;
  background: linear-gradient(to bottom right, #1d4ed8 5%, #3b82f6);
  color: white;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.login-card button:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 25px rgba(59, 130, 246, 0.45);
}

/* ===== Links ===== */
.links {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  text-align: center;
}

.links a {
  color: #94a3b8;
  font-size: 0.85rem;
  text-decoration: none;
}

.links a:hover {
  color: #60a5fa;
  text-decoration: underline;
}

.loading {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 3px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
