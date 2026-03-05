<script setup>
import { ref } from "vue"
import { useRouter } from "vue-router"
import { API_URL } from '../config.js';
const router = useRouter()

const email = ref("")
const showOTP = ref(false)
const otp = ref(["", "", "", "", "", ""])
const loading = ref(false)

const openOTP = async () => {
  if (!email.value) return

  try {
    loading.value = true
    const res = await fetch("${API_URL}forgot-password/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.value })
    })

    const data = await res.json()
    if (!res.ok) return alert(data.message)

    showOTP.value = true
  } catch {
    alert("Server error")
  } finally {
    loading.value = false
  }
}

const handleOTPInput = (e, index) => {
  const val = e.target.value.replace(/\D/g, "")
  otp.value[index] = val
  if (val && index < 5) e.target.nextElementSibling?.focus()
}

const verifyOTP = async () => {
  const entered = otp.value.join("")
  if (entered.length !== 6) return

  try {
    const res = await fetch("${API_URL}forgot-password/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.value,
        otp: entered
      })
    })

    const data = await res.json()
    if (!res.ok) return alert(data.message)

    sessionStorage.setItem("resetEmail", email.value)
    router.push("/reset-password")
  } catch {
    alert("Verification failed")
  }
}
</script>

<template>
  <div class="page">
    <div class="card">
      <h2>Reset Password</h2>
      <p class="subtitle">Enter your email to receive an OTP</p>

      <input type="email" placeholder="Email" v-model="email" />
      <button @click="openOTP" :disabled="loading">
        {{ loading ? "Sending..." : "Generate OTP" }}
      </button>

      <router-link class="back" to="/login">← Back to Login</router-link>
    </div>

    <!-- OTP Modal -->
    <div v-if="showOTP" class="overlay">
      <div class="otp-modal">
        <h3>Enter OTP</h3>

        <div class="otp-box">
          <input
            v-for="(_, i) in otp"
            :key="i"
            maxlength="1"
            inputmode="numeric"
            v-model="otp[i]"
            @input="e => handleOTPInput(e, i)"
          />
        </div>

        <button class="verify-btn" @click="verifyOTP">
          Verify OTP
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(to bottom right, #0e192d 0%, #000 75%);
  color: #e5e7eb;
  font-family: system-ui;
}

.card {
  width: 100%;
  max-width: 380px;
  background: rgba(10, 15, 30, 0.8);
  padding: 2.2rem;
  border-radius: 16px;
  border: 1px solid #1e3a8a;
  text-align: center;
  box-shadow:
    0 25px 45px rgba(0,0,0,0.8),
    0 0 30px rgba(59,130,246,0.15);
}

h2 {
  margin-bottom: 0.6rem;
  letter-spacing: 0.12em;
}

.subtitle {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-bottom: 1.4rem;
}

input {
  width: 100%;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid #1e293b;
  background: #020617;
  color: #e5e7eb;
  margin-bottom: 1rem;
}

button {
  width: 100%;
  padding: 0.8rem;
  border-radius: 8px;
  border: none;
  background: linear-gradient(to bottom right, #1d4ed8, #3b82f6);
  color: white;
  cursor: pointer;
}

.back {
  display: inline-block;
  margin-top: 1rem;
  font-size: 0.85rem;
  color: #94a3b8;
  text-decoration: none;
}

.back:hover {
  color: #60a5fa;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

/* ===== OTP Modal ===== */
.otp-modal {
  width: 100%;
  max-width: 340px;
  background: rgba(10, 15, 30, 0.95);
  padding: 2rem;
  border-radius: 16px;
  border: 1px solid #1e3a8a;
  box-shadow:
    0 25px 50px rgba(0,0,0,0.9),
    0 0 30px rgba(59,130,246,0.2);
  text-align: center;
  position: relative;
}

.otp-modal h3 {
  margin-bottom: 1.2rem;
  letter-spacing: 0.12em;
  color: #e0e7ff;
}

/* Close */
.close {
  position: absolute;
  top: 10px;
  right: 14px;
  font-size: 1.4rem;
  cursor: pointer;
  color: #94a3b8;
}

.close:hover {
  color: #60a5fa;
}

.otp-box {
  display: flex;
  justify-content: center;
  flex-wrap: nowrap;
  gap: 0.5rem;
  margin-bottom: 1.4rem;
}

.otp-box input {
  width: 38px;
  height: 48px;
}

.otp-box input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px rgba(59,130,246,0.4);
}

/* Verify Button */
.verify-btn {
  width: 100%;
  padding: 0.8rem;
  border-radius: 8px;
  border: none;
  background: linear-gradient(to bottom right, #1d4ed8, #3b82f6);
  color: white;
  cursor: pointer;
}
</style>
