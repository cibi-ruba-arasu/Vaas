// src/routes/routes.js
import { createRouter, createWebHistory } from "vue-router"

import Login from "@/components/Login.vue"
import Register from "@/components/Register.vue"
import OTP from "@/components/OTP.vue"
import ForgotPassword from "@/components/ForgotPassword.vue"
import ResetPassword from "@/components/ResetPassword.vue"

const routes = [
  {
    path: "/",
    name: "Login",
    component: Login
  },
  {
    path: "/register",
    name: "Register",
    component: Register
  },
  {
    path: "/otp",
    name: "OTP",
    component: OTP,
    meta: { requiresOTP: true }
  },
  {
    path: "/forgot-password",
    name: "ForgotPassword",
    component: ForgotPassword,
    meta: { requiresForgot: true }
  },
  {
    path: "/reset-password",
    name: "ResetPassword",
    component: ResetPassword,
    meta: { requiresReset: true }
  },
  {
    path: "/login",
    redirect: "/"
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  /* ===== OTP PROTECTION ===== */
  if (to.meta.requiresOTP) {
    const registerUser = sessionStorage.getItem("registerUser")
    if (!registerUser) return next("/login")
  }

  /* ===== FORGOT PASSWORD PROTECTION ===== */
  if (to.meta.requiresForgot) {
    // Optional: block direct access if you want stricter flow
    // Example: user must come from login
    // For now, allow access
    return next()
  }

  /* ===== RESET PASSWORD PROTECTION ===== */
  if (to.meta.requiresReset) {
    const resetEmail = sessionStorage.getItem("resetEmail")
    if (!resetEmail) return next("/login")
  }

  next()
})

export default router
