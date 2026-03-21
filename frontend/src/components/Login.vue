<script setup>
import { ref, onMounted, onUnmounted } from "vue"
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

// Reactive references for the generated star fields
const starsSmall = ref('')
const starsMedium = ref('')
const starsLarge = ref('')

// Mouse tracking coordinates
const mouseX = ref(0)
const mouseY = ref(0)

// Function to generate the CSS box-shadow string for our stars
const generateStars = (count, blur) => {
  let shadows = []
  for (let i = 0; i < count; i++) {
    const x = (Math.random() * 110 - 5).toFixed(2)
    const y = (Math.random() * 210 - 5).toFixed(2)
    shadows.push(`${x}vw ${y}vh ${blur}px #FFF`)
  }
  return shadows.join(', ')
}

const handleMouseMove = (e) => {
  mouseX.value = (e.clientX - window.innerWidth / 2) * -0.01
  mouseY.value = (e.clientY - window.innerHeight / 2) * -0.01
}

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove)
  
  starsSmall.value = generateStars(400, 0)   
  starsMedium.value = generateStars(150, 1)  
  starsLarge.value = generateStars(50, 2)    
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
})

const handleLogin = async () => {
  if (!email.value || !password.value) {
    return alert("Please fill all fields")
  }

  isLoading.value = true

  try {
    // ✅ DYNAMIC URL: Uses localhost in dev, but relative path on Render
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
  <div class="page" :style="{ '--mouse-x': mouseX + 'px', '--mouse-y': mouseY + 'px' }">
  
    <div class="sky-container">
      <div class="parallax-wrap p-1">
        <div class="star-layer layer-1" :style="{ boxShadow: starsSmall }"></div>
      </div>
      <div class="parallax-wrap p-2">
        <div class="star-layer layer-2" :style="{ boxShadow: starsMedium }"></div>
      </div>
      <div class="parallax-wrap p-3">
        <div class="star-layer layer-3" :style="{ boxShadow: starsLarge }"></div>
      </div>
    </div>

    <div class="easter-egg">
      <span class="halo"></span>
      <span class="eye-symbol">𓂀</span>
      <div class="tooltip">
        Congratulations!<br />
        you found the light within you
      </div>
    </div>

    <div class="gate-text">
      <span>Enter the Gates</span>
    </div>

    <div class="login-card">
      <h2 class="title">Login</h2>

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
  background-color: #030305;
  color: #e5e7eb;
  font-family: system-ui, -apple-system, BlinkMacSystemFont;
  overflow-x: hidden;
}

/* --- NIGHT SKY EFFECT --- */
.sky-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  overflow: hidden;
  pointer-events: none; 
}

.parallax-wrap {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transition: transform 0.1s ease-out; 
}

.p-1 { transform: translate(calc(var(--mouse-x) * 0.5), calc(var(--mouse-y) * 0.5)); }
.p-2 { transform: translate(calc(var(--mouse-x) * 1.5), calc(var(--mouse-y) * 1.5)); }
.p-3 { transform: translate(calc(var(--mouse-x) * 3.0), calc(var(--mouse-y) * 3.0)); }

.star-layer {
  position: absolute;
  top: 0;
  left: 0;
  background: transparent;
  border-radius: 50%; 
}

.star-layer::after {
  content: "";
  position: absolute;
  top: 200vh;
  left: 0;
  width: inherit;
  height: inherit;
  background: transparent;
  border-radius: inherit;
  box-shadow: inherit; 
}

.layer-1 { width: 1.5px; height: 1.5px; animation: drift 150s linear infinite; }
.layer-2 { width: 2.5px; height: 2.5px; animation: drift 100s linear infinite, twinkle 6s ease-in-out infinite alternate; }
.layer-3 { width: 3.5px; height: 3.5px; animation: drift 50s linear infinite, twinkle 4s ease-in-out infinite alternate; }

@keyframes drift {
  from { transform: translateY(0); }
  to { transform: translateY(-200vh); }
}

@keyframes twinkle {
  0% { opacity: 0.2; }
  100% { opacity: 1; }
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
  position: relative;
  z-index: 10;
  margin-bottom: 1.3rem;
  font-size: 1.6rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #3b82f6;
  text-shadow: 0 0 22px rgba(59, 130, 246, 0.35);
  font-family: 'Times New Roman', Times, serif;
  
  opacity: 0;
  animation: ethereal-reveal 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

/* ===== Login Card ===== */
.login-card {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 380px;
  background: rgba(10, 15, 30, 0.3);
  backdrop-filter: blur(2px); /* Blurs the stars behind the card */
  padding: 2.5rem;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  border: 1px solid rgb(59, 131, 246);
  box-shadow:
    0 25px 45px rgba(0, 0, 0, 0.8),
    0 0 30px rgba(41, 122, 251, 0.12);
    
  opacity: 0;
  animation: ethereal-reveal 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  animation-delay: 0.2s; /* Starts slightly after the text */
}

@keyframes ethereal-reveal {
  0% {
    opacity: 0;
    transform: translateY(40px) scale(0.98);
    filter: blur(8px);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0px);
  }
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
  background: rgba(2, 6, 23, 0.8);
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

@media (max-width: 768px) {
  .login-card {
    max-width: 320px;
    padding: 2rem;
  }
}

@media (max-width: 480px) {
  .page {
    padding: 1rem;
  }
  
  .login-card {
    max-width: 100%;
    padding: 1.5rem;
    gap: 1rem;
  }

  .gate-text {
    font-size: 1.2rem;
    letter-spacing: 0.15em;
  }

  /* Adjust easter egg tooltip to prevent screen overflow on mobile */
  .tooltip {
    left: 40px;
    font-size: 0.7rem;
    white-space: normal;
    width: 180px;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>