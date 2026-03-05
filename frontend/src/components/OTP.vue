<script setup>
import { ref, computed } from "vue"
import { useRouter } from "vue-router"
import { API_URL } from '../config.js';

const router = useRouter()

const success = ref(false)
const otp = ref(["", "", "", "", "", ""])
const error = ref(false)
const wrongOTP = ref(false)
const cooldown = ref(30)
const canResend = ref(false)

const isComplete = computed(() =>
  otp.value.every(digit => digit !== "")
)

const handleInput = (e, index) => {
  const value = e.target.value.replace(/\D/g, "")
  otp.value[index] = value

  if (value && index < 5) {
    e.target.nextElementSibling?.focus()
  }
}

const handleBackspace = (e, index) => {
  if (!otp.value[index] && index > 0) {
    e.target.previousElementSibling?.focus()
  }
}

const submitOTP = async () => {
  wrongOTP.value = false

  const enteredOTP = otp.value.join("")
  const userData = JSON.parse(sessionStorage.getItem("registerUser"))

  try {
    const res = await fetch("${API_URL}verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userData.email,
        otp: enteredOTP,
        userData
      })
    })

    const data = await res.json()

    if (!data.success) {
      wrongOTP.value = true
      return
    }

    success.value = true
    sessionStorage.removeItem("registerUser")

    setTimeout(() => {
      router.push("/login")
    }, 1800)

  } catch (err) {
    console.error(err)
    wrongOTP.value = true
  }
}


const startCooldown = () => {
  cooldown.value = 30
  canResend.value = false

  const interval = setInterval(() => {
    cooldown.value--
    if (cooldown.value === 0) {
      canResend.value = true
      clearInterval(interval)
    }
  }, 1000)
}

startCooldown()

const resendOTP = async () => {
  const user = JSON.parse(sessionStorage.getItem("registerUser"))

  await fetch("${API_URL}send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email })
  })

  startCooldown()
}
</script>

<template>
  <div class="page">
    <div class="otp-card">
      <h2 class="title">Verification</h2>

      <div class="subtitle">
        Enter the 6-digit code sent to your email
      </div>

      <div v-if="success" class="success">
        ✓ Verified Successfully
      </div>

      <div v-if="!success" class="otp-box">
        <input
          v-for="(digit, index) in otp"
          :key="index"
          maxlength="1"
          inputmode="numeric"
          autocomplete="one-time-code"
          v-model="otp[index]"
          @input="e => handleInput(e, index)"
          @keydown.backspace="e => handleBackspace(e, index)"
        />
      </div>

      <p v-if="wrongOTP" class="error">
        Wrong OTP entered / OTP expired
      </p>

      <p v-if="error" class="error">
        Please enter the complete code
      </p>

      <button
        class="verify-btn"
        :disabled="!isComplete || success"
        @click="submitOTP"
        >
          Verify
      </button>

      <div class="resend">
            <span
                v-if="canResend"
                @click="resendOTP"
            >
                Resend
            </span>
            <span v-else>
                Resend in {{ cooldown }}s
            </span>
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
  font-family: system-ui, -apple-system, BlinkMacSystemFont;
  color: #e5e7eb;
}

/* ===== Card ===== */
.otp-card {
  width: 100%;
  max-width: 400px;
  background: rgba(10, 15, 30, 0.8);
  padding: 2.4rem;
  border-radius: 16px;
  border: 1px solid #1e3a8a;
  box-shadow:
    0 30px 60px rgba(0, 0, 0, 0.8),
    0 0 30px rgba(59, 130, 246, 0.15);
  text-align: center;
}

/* ===== Title ===== */
.title {
  font-size: 1.6rem;
  letter-spacing: 0.12em;
  margin-bottom: 0.4rem;
  color: #e0e7ff;
}

/* ===== Subtitle ===== */
.subtitle {
  font-size: 0.9rem;
  color: #94a3b8;
  margin-bottom: 1.8rem;
}

/* ===== OTP Inputs ===== */
.otp-box {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  margin-bottom: 1.2rem;
}

.otp-box input {
  width: 46px;
  height: 54px;
  text-align: center;
  font-size: 1.4rem;
  border-radius: 10px;
  border: 1px solid #1e293b;
  background: #020617;
  color: #e5e7eb;
  transition: border 0.15s ease, box-shadow 0.15s ease;
}

.otp-box input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.45);
}

/* ===== Error ===== */
.error {
  color: #93c5fd;
  font-size: 0.8rem;
  margin-bottom: 0.8rem;
}

/* ===== Button ===== */
.verify-btn {
  width: 100%;
  margin-top: 0.6rem;
  padding: 0.85rem;
  border-radius: 10px;
  border: none;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  background: linear-gradient(to bottom right, #1d4ed8, #3b82f6);
  color: white;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.verify-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 25px rgba(59, 130, 246, 0.45);
}

.verify-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ===== Resend ===== */
.resend {
  margin-top: 1.2rem;
  font-size: 0.85rem;
  color: #94a3b8;
}

.resend span {
  color: #60a5fa;
  cursor: pointer;
}

.resend span:hover {
  text-decoration: underline;
}

.success {
  margin-bottom: 1.2rem;
  font-size: 1rem;
  font-weight: 500;
  color: #22c55e;
  animation: pop 0.6s ease-out;
}

@keyframes pop {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  60% {
    transform: scale(1.05);
    opacity: 1;
  }
  100% {
    transform: scale(1);
  }
}
</style>
