// src/routes/routes.js
import { createRouter, createWebHistory } from "vue-router"

import Login from "@/components/Login.vue"
import Register from "@/components/Register.vue"
import OTP from "@/components/OTP.vue"
import ForgotPassword from "@/components/ForgotPassword.vue"
import ResetPassword from "@/components/ResetPassword.vue"
import Homepage from "@/components/Homepage.vue"
import UserProfile from "@/components/UserProfile.vue"
import Create from "@/components/Create.vue"
import Canvas from "@/components/Canvas.vue"
import Publish from "@/components/Publish.vue"
import Update from '../components/Update.vue'
import Post from '@/components/Post.vue';
import User from '@/components/User.vue'
import Search from '@/components/Search.vue';

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
  },
  {
    path: "/home",
    name: "Homepage",
    component: Homepage,
    meta: { requiresAuth: true }
  },
  {
    path: "/profile",
    name: "UserProfile",
    component: UserProfile,
    meta: { requiresAuth: true }
  },
  {
    path: "/create",
    name: "Create",
    component: Create,
    meta: { requiresAuth: true }
  },
  {
    path: "/canvas/:projectId",
    name: "Canvas",
    component: Canvas,
    meta: { requiresAuth: true }
  },
  {
    path: '/publish/:id',
    name: 'Publish',
    component: Publish,
    meta: { requiresAuth: true }
  },
  {
    path: '/update/:id',
    name: 'Update',
    component: Update,
    meta: { requiresAuth: true }
  },
  {
    path: "/post/:id",
    name: "Post",
    component: Post,
    meta: { requiresAuth: true } // Or false if you want public access
  },
  {
    path: "/user/:userid", // ✅ Matches the router.push from Homepage search
    name: "User",
    component: User,
    meta: { requiresAuth: true }
  },
  {
    path: "/search",
    name: "Search",
    component: Search,
    meta: { requiresAuth: true }
  },
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

  /* ===== RESET PASSWORD PROTECTION ===== */
  if (to.meta.requiresReset) {
    const resetEmail = sessionStorage.getItem("resetEmail")
    if (!resetEmail) return next("/login")
  }

  /* ===== AUTH PROTECTION (JWT) ===== */
  if (to.meta.requiresAuth) {
    const token = sessionStorage.getItem("token")

    if (!token) {
      // ❌ Not logged in
      return next("/login")
    }

    // ✅ Token exists
    return next()
  }
  
  next()
})

export default router