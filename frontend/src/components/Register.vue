<script setup>
import { ref, watch, watchEffect, onMounted, onBeforeUnmount } from "vue"
import { Country, State, City } from "country-state-city"
import bcrypt from "bcryptjs"
import { useRouter } from "vue-router"
import { API_URL } from '../config.js';
/* ===== ROTATING TITLE TEXT ===== */
const roles = [
  "Dreamer",
  "Explorer",
  "Magician",
  "Manic",
  "Builder",
  "Weaver",
  "Architect",
  "Visionary",
  "Creator",
  "Seeker"
]

const router = useRouter()

const generateRandomToken = (length = 20) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return result
}

const currentRole = ref(roles[0])
let roleIndex = 0
let roleInterval = null

onMounted(() => {
  roleInterval = setInterval(() => {
    roleIndex = (roleIndex + 1) % roles.length
    currentRole.value = roles[roleIndex]
  }, 2000)
})

onBeforeUnmount(() => {
  clearInterval(roleInterval)
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

/* ===== FORM COMPLETION STATE ===== */
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
  //JSON.parse(sessionStorage.getItem("registerUser"))

  console.log("🟦 REGISTER DATA:", userData)

  await fetch("${API_URL}send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.value })
    })

  router.push("/otp")
}

/* ===== VALIDATIONS ===== */
const validateUsername = (value) => {
  if (!value) return ""
  return /^[A-Za-z0-9_]+$/.test(value)
    ? ""
    : "Only letters, numbers, underscores allowed"
}

watch(username, v => {
  usernameError.value = validateUsername(v)
})

/* ===== EMAIL VALIDATION ===== */
const validateEmail = (value) => {
  if (!value) return ""
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  return emailRegex.test(value)
    ? ""
    : "Enter a valid email address"
}

watch(email, v => {
  emailError.value = validateEmail(v)
})

/* ===== PASSWORD VALIDATION ===== */
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
  rePasswordError.value =
    rePassword.value && v !== rePassword.value
      ? "Passwords do not match"
      : ""
})

watch(rePassword, v => {
  rePasswordError.value = v !== password.value ? "Passwords do not match" : ""
})

/* ===== DOB → AGE + AGE VALIDATION ===== */
watch(dob, d => {
  ageError.value = ""
  if (!d) {
    age.value = ""
    return
  }

  const birth = new Date(d)
  const today = new Date()

  let a = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    a--
  }

  age.value = a

  if (a < 13) {
    ageError.value = "You must be at least 13 years old"
  } else if (a > 120) {
    ageError.value = "Please enter a valid date of birth"
  }
})

/* ===== COUNTRY DATA ===== */
onMounted(() => {
  countries.value = Country.getAllCountries()
})

watch(selectedCountry, code => {
  states.value = []
  cities.value = []
  if (!code) return
  states.value = State.getStatesOfCountry(code)
})

watch(selectedState, code => {
  if (!code) return
  cities.value = City.getCitiesOfState(selectedCountry.value, code)
})

/* ===== FORM COMPLETION CHECK ===== */
watchEffect(() => {
  isFormComplete.value =
    email.value &&
    !emailError.value &&
    username.value &&
    !usernameError.value &&
    password.value &&
    !passwordError.value &&
    rePassword.value &&
    !rePasswordError.value &&
    dob.value &&
    age.value &&
    !ageError.value &&
    selectedCountry.value &&
    selectedState.value &&
    selectedCity.value
})
</script>

<template>
  <head>
    <title>Register | Loomart</title>
  </head>

  <div class="maindiv">
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
        </div>

      </form>
    </div>
  </div>
</template>

<style scoped>
*,
*::before,
*::after {
  box-sizing: border-box;
}

.maindiv {
  min-height: 100vh;
  background: linear-gradient(135deg, #020b2d 0%, #000000 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #e5e7eb;
  gap: 25px;
}

.intro-text {
  font-size: 28px;
  color: #93c5fd;
  font-weight: 300;
}

.role {
  margin-left: 8px;
  font-weight: 700;
  color: #3b82f6;
  animation: fade 2s ease-in-out infinite;
}

@keyframes fade {
  0% { opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; }
}

.registerdiv {
  width: 900px;
  max-width: 95vw;
  border-radius: 40px;
  padding: 40px;
  background: rgba(2, 6, 23, 0.9);
  box-shadow:
    30px 30px 60px rgba(37, 99, 235, 0.35),
    -10px -10px 30px rgba(0, 0, 0, 0.9);
}

.formdiv {
  display: flex;
  gap: 60px;
}

.inputdiv {
  width: 50%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.label {
  font-size: 15px;
  color: #93c5fd;
}

.inputbox,
.selectbox,
.dob-input {
  width: 100%;
  background: #020617;
  border: 1px solid #1e40af;
  border-radius: 10px;
  color: white;
  padding: 8px 12px;
}

.password-wrapper {
  position: relative;
}

.eye {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  font-size: 18px;
  color: #93c5fd;
}

.register-btn {
  margin-top: 20px;
  padding: 12px;
  border-radius: 25px;
  border: none;
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
  color: white;
  font-weight: bold;
  cursor: pointer;
}

.register-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.error-text,
.age {
  color: #93c5fd;
  font-size: 12px;
}
</style>
