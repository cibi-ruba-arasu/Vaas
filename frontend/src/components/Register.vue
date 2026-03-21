<script setup>
import { ref, watch, watchEffect, onMounted, onBeforeUnmount } from "vue"
import { Country, State, City } from "country-state-city"
import bcrypt from "bcryptjs"
import { useRouter } from "vue-router"
import { API_URL } from '../config.js';

const router = useRouter()

/* ===== ROTATING TITLE TEXT ===== */
const roles = [
  "Dreamer", "Explorer", "Magician", "Manic", "Builder",
  "Weaver", "Architect", "Visionary", "Creator", "Seeker"
]

const currentRole = ref(roles[0])
let roleIndex = 0
let roleInterval = null

// --- BACKGROUND STAR LOGIC ---
const starsSmall = ref('')
const starsMedium = ref('')
const starsLarge = ref('')

const mouseX = ref(0)
const mouseY = ref(0)

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

const generateRandomToken = (length = 20) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

onMounted(() => {
  // Star generation and mouse tracking
  window.addEventListener('mousemove', handleMouseMove)
  starsSmall.value = generateStars(400, 0)
  starsMedium.value = generateStars(150, 1)
  starsLarge.value = generateStars(50, 2)

  // Role rotation
  roleInterval = setInterval(() => {
    roleIndex = (roleIndex + 1) % roles.length
    currentRole.value = roles[roleIndex]
  }, 2000)

  // Load countries
  countries.value = Country.getAllCountries()
})

onBeforeUnmount(() => {
  if (roleInterval) clearInterval(roleInterval)
  window.removeEventListener('mousemove', handleMouseMove)
})

/* ===== FORM STATE ===== */
const countries = ref([])
const states = ref([])
const cities = ref([])

const selectedCountry = ref("")
const selectedState = ref("")
const selectedCity = ref("")
const dob = ref("")
const age = ref("")

const password = ref("")
const rePassword = ref("")
const email = ref("")
const username = ref("")

const showPassword = ref(false)
const showRePassword = ref(false)

const passwordError = ref("")
const rePasswordError = ref("")
const usernameError = ref("")
const emailError = ref("")
const ageError = ref("")

const isFormComplete = ref(false)

/* ===== SUBMIT ===== */
const handlesubmit = async () => {
  if (!isFormComplete.value) return

  const registrationToken = generateRandomToken(20)
  const salt = bcrypt.genSaltSync(10)
  const hashedPassword = bcrypt.hashSync(password.value, salt)
  
  const userData = {
    email: email.value,
    username: username.value,
    password: hashedPassword,
    dob: dob.value,
    age: age.value,
    country: selectedCountry.value,
    state: selectedState.value,
    city: selectedCity.value,
    userid: registrationToken
  }

  sessionStorage.setItem("registerUser", JSON.stringify(userData))

  await fetch(`${API_URL}/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.value })
  })

  router.push("/otp")
}

/* ===== VALIDATIONS ===== */
const validateUsername = (value) => {
  if (!value) return ""
  return /^[A-Za-z0-9_]+$/.test(value) ? "" : "Only letters, numbers, underscores allowed"
}

watch(username, v => { usernameError.value = validateUsername(v) })

const validateEmail = (value) => {
  if (!value) return ""
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  return emailRegex.test(value) ? "" : "Enter a valid email address"
}

watch(email, v => { emailError.value = validateEmail(v) })

const validatePassword = (value) => {
  const errors = []
  if (value.length < 8) errors.push("8+ chars")
  if (!/[a-z]/.test(value)) errors.push("lowercase")
  if (!/[A-Z]/.test(value)) errors.push("uppercase")
  if (!/[!@#$%^&*]/.test(value)) errors.push("special char")
  return errors
}

watch(password, v => {
  const errors = validatePassword(v)
  passwordError.value = errors.length ? errors.join(", ") : ""
  rePasswordError.value = rePassword.value && v !== rePassword.value ? "Passwords do not match" : ""
})

watch(rePassword, v => { rePasswordError.value = v !== password.value ? "Passwords do not match" : "" })

watch(dob, d => {
  ageError.value = ""
  if (!d) { age.value = ""; return; }
  const birth = new Date(d); const today = new Date();
  let a = today.getFullYear() - birth.getFullYear(); const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) { a-- }
  age.value = a
  if (a < 13) { ageError.value = "You must be at least 13 years old" }
  else if (a > 120) { ageError.value = "Please enter a valid date of birth" }
})

watch(selectedCountry, code => {
  states.value = []; cities.value = []; if (!code) return
  states.value = State.getStatesOfCountry(code)
})

watch(selectedState, code => {
  if (!code) return
  cities.value = City.getCitiesOfState(selectedCountry.value, code)
})

watchEffect(() => {
  isFormComplete.value =
    email.value && !emailError.value &&
    username.value && !usernameError.value &&
    password.value && !passwordError.value &&
    rePassword.value && !rePasswordError.value &&
    dob.value && age.value && !ageError.value &&
    selectedCountry.value && selectedState.value && selectedCity.value
})
</script>

<template>
  <head>
    <title>Register | Loomart</title>
  </head>

  <div class="maindiv" :style="{ '--mouse-x': mouseX + 'px', '--mouse-y': mouseY + 'px' }">
    
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
        Ah, a curious soul!<br />
        You seek secrets before you even begin.
      </div>
    </div>

    <div class="intro-text">
      Who are you?
      <span class="role">{{ currentRole }}</span>
    </div>

    <div class="registerdiv">
      <form class="formdiv" @submit.prevent="handlesubmit">

        <div class="inputdiv">
          <label class="label">Email</label>
          <input class="inputbox" v-model="email" />
          <p v-if="emailError" class="error-text">{{ emailError }}</p>

          <label class="label">Username</label>
          <input class="inputbox" v-model="username" />
          <p v-if="usernameError" class="error-text">{{ usernameError }}</p>

          <label class="label">Password</label>
          <div class="password-wrapper">
            <input
              :type="showPassword ? 'text' : 'password'"
              class="inputbox"
              v-model="password"
            />
            <span class="eye" @click="showPassword = !showPassword">𓂀</span>
          </div>
          <p v-if="passwordError" class="error-text">{{ passwordError }}</p>

          <label class="label">Re-Enter Password</label>
          <div class="password-wrapper">
            <input
              :type="showRePassword ? 'text' : 'password'"
              class="inputbox"
              v-model="rePassword"
            />
            <span class="eye" @click="showRePassword = !showRePassword">𓂀</span>
          </div>
          <p v-if="rePasswordError" class="error-text">{{ rePasswordError }}</p>

          <label class="label">DOB</label>
          <input type="date" class="dob-input" v-model="dob" />
          <p class="age">Age: {{ age }}</p>
          <p v-if="ageError" class="error-text">{{ ageError }}</p>
        </div>

        <div class="inputdiv">
          <label class="label">Country</label>
          <select class="selectbox" v-model="selectedCountry">
            <option value="">Select</option>
            <option v-for="c in countries" :key="c.isoCode" :value="c.isoCode">
              {{ c.name }}
            </option>
          </select>

          <label class="label">State</label>
          <select class="selectbox" v-model="selectedState">
            <option value="">Select</option>
            <option v-for="s in states" :key="s.isoCode" :value="s.isoCode">
              {{ s.name }}
            </option>
          </select>

          <label class="label">City</label>
          <select class="selectbox" v-model="selectedCity">
            <option value="">Select</option>
            <option v-for="c in cities" :key="c.name" :value="c.name">
              {{ c.name }}
            </option>
          </select>

          <button
            class="register-btn"
            type="submit"
            :disabled="!isFormComplete"
          >
            Register
          </button>
          
          <div class="login-link">
            Already have an account? <router-link to="/login">Login here</router-link>
          </div>
        </div>

      </form>
    </div>
  </div>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }

/* ===== Page Background ===== */
.maindiv {
  min-height: 100vh;
  background-color: #030305;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #e5e7eb;
  gap: 25px;
  overflow-x: hidden;
  position: relative;
}

/* --- NIGHT SKY EFFECT --- */
.sky-container {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  z-index: 0; overflow: hidden; pointer-events: none; 
}

.parallax-wrap {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  transition: transform 0.1s ease-out; 
}

.p-1 { transform: translate(calc(var(--mouse-x) * 0.5), calc(var(--mouse-y) * 0.5)); }
.p-2 { transform: translate(calc(var(--mouse-x) * 1.5), calc(var(--mouse-y) * 1.5)); }
.p-3 { transform: translate(calc(var(--mouse-x) * 3.0), calc(var(--mouse-y) * 3.0)); }

.star-layer { position: absolute; top: 0; left: 0; background: transparent; border-radius: 50%; }
.star-layer::after {
  content: ""; position: absolute; top: 200vh; left: 0; width: inherit; height: inherit;
  background: transparent; border-radius: inherit; box-shadow: inherit; 
}

.layer-1 { width: 1.5px; height: 1.5px; animation: drift 150s linear infinite; }
.layer-2 { width: 2.5px; height: 2.5px; animation: drift 100s linear infinite, twinkle 6s ease-in-out infinite alternate; }
.layer-3 { width: 3.5px; height: 3.5px; animation: drift 50s linear infinite, twinkle 4s ease-in-out infinite alternate; }

@keyframes drift { from { transform: translateY(0); } to { transform: translateY(-200vh); } }
@keyframes twinkle { 0% { opacity: 0.2; } 100% { opacity: 1; } }

/* ===== 🧿 Easter Egg Logic ===== */
.easter-egg { position: fixed; top: 14px; left: 14px; width: 42px; height: 42px; cursor: pointer; z-index: 999; }
.eye-symbol { position: relative; font-size: 1.6rem; color: #60a5fa; opacity: 0; transition: opacity 0.3s ease; z-index: 2; }
.halo { position: absolute; inset: -10px; background: radial-gradient(circle, rgba(96,165,250,0.45), transparent 70%); border-radius: 50%; opacity: 0; filter: blur(6px); transition: opacity 0.3s ease; }
.tooltip { position: absolute; top: 50%; left: 55px; transform: translateY(-50%); background: rgba(2, 6, 23, 0.95); border: 1px solid rgba(96, 165, 250, 0.4); padding: 0.6rem 0.8rem; border-radius: 8px; font-size: 0.75rem; color: #e0e7ff; white-space: nowrap; opacity: 0; pointer-events: none; box-shadow: 0 0 20px rgba(96, 165, 250, 0.35); transition: opacity 0.3s ease; }
.easter-egg:hover .eye-symbol { opacity: 1; transform: rotate(90deg); }
.easter-egg:hover .halo, .easter-egg:hover .tooltip { opacity: 1; }

.intro-text {
  font-size: 28px; color: #93c5fd; font-weight: 300; position: relative; z-index: 10;
  opacity: 0; animation: ethereal-reveal 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

.role { margin-left: 8px; font-weight: 700; color: #3b82f6; animation: fade 2s ease-in-out infinite; }
@keyframes fade { 0%, 100% { opacity: 0; } 20%, 80% { opacity: 1; } }

/* ===== Registration Card ===== */
.registerdiv {
  width: 900px; max-width: 95vw; border-radius: 40px; padding: 40px;
  background: rgba(2, 6, 23, 0.3); /* Lower opacity for stars to shine through */
  backdrop-filter: blur(2px); /* Frosted glass effect */
  border: 1px solid rgba(59, 131, 246, 0.5);
  box-shadow: 30px 30px 60px rgba(37, 99, 235, 0.2), -10px -10px 30px rgba(0, 0, 0, 0.9);
  position: relative; z-index: 10;
  opacity: 0; animation: ethereal-reveal 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  animation-delay: 0.2s;
}

@keyframes ethereal-reveal {
  0% { opacity: 0; transform: translateY(40px) scale(0.98); filter: blur(8px); }
  100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0px); }
}

.formdiv { display: flex; gap: 60px; }
.inputdiv { width: 50%; display: flex; flex-direction: column; gap: 12px; }
.label { font-size: 15px; color: #93c5fd; }

.inputbox, .selectbox, .dob-input {
  width: 100%; background: rgba(2, 6, 23, 0.5); border: 1px solid rgba(30, 64, 175, 0.4);
  border-radius: 10px; color: white; padding: 8px 12px; transition: all 0.3s ease;
}

.inputbox:focus, .selectbox:focus, .dob-input:focus {
  outline: none; border-color: #3b82f6; box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
}

.password-wrapper { position: relative; }
.eye {
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  cursor: pointer; font-size: 18px; color: #93c5fd; transition: transform 0.2s ease;
}
.eye:hover { transform: translateY(-50%) scale(1.2); }

.register-btn {
  margin-top: 20px; padding: 12px; border-radius: 25px; border: none;
  background: linear-gradient(135deg, #1d4ed8, #2563eb); color: white;
  font-weight: bold; cursor: pointer; transition: all 0.3s ease;
}
.register-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(59, 130, 246, 0.4); }
.register-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.error-text, .age { color: #93c5fd; font-size: 12px; }
.login-link { text-align: center; margin-top: 15px; font-size: 14px; color: #94a3b8; }
.login-link a { color: #60a5fa; text-decoration: none; font-weight: bold; }
.login-link a:hover { text-decoration: underline; }

/* Responsive adjustments */
@media (max-width: 950px) {
  .registerdiv { padding: 30px; }
  .formdiv { gap: 30px; }
}

@media (max-width: 768px) {
  .maindiv { padding: 40px 0; }
  .formdiv { flex-direction: column; gap: 20px; }
  .inputdiv { width: 100%; }
}
</style>