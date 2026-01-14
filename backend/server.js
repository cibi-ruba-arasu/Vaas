import express from "express"
import cors from "cors"
import nodemailer from "nodemailer"
import dotenv from "dotenv"
import mongoose from "mongoose"
import User from "./schema/User.js"
import bcrypt from "bcryptjs"

dotenv.config()

const app = express()
const PORT = 5000

app.use(cors())
app.use(express.json())

/* ===== MONGO ===== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("🟢 MongoDB connected"))
  .catch(err => console.error("❌ Mongo error:", err))

/* ===== OTP STORE ===== */
const otpStore = new Map()

/* ===== EMAIL ===== */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASS
  }
})

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString()

/* ===== SEND OTP ===== */
app.post("/send-otp", async (req, res) => {
  const { email } = req.body

  if (!email) return res.status(400).json({ message: "Email required" })

  const otp = generateOTP()
  const expires = Date.now() + 5 * 60 * 1000

  otpStore.set(email, { otp, expires })

  await transporter.sendMail({
    from: `"Loomart" <${process.env.EMAIL}>`,
    to: email,
    subject: "Your Loomart OTP",
    html: `<h1>${otp}</h1><p>Expires in 5 minutes</p>`
  })

  res.json({ success: true })
})

/* ===== VERIFY OTP + SAVE USER ===== */
app.post("/verify-otp", async (req, res) => {
  const { email, otp, userData } = req.body

  const stored = otpStore.get(email)

  if (!stored) {
    return res.status(400).json({
      success: false,
      message: "OTP not found"
    })
  }

  if (Date.now() > stored.expires) {
    otpStore.delete(email)
    return res.status(400).json({
      success: false,
      message: "OTP expired"
    })
  }

  if (stored.otp !== otp) {
    return res.status(400).json({
      success: false,
      message: "Invalid OTP"
    })
  }

  // ✅ OTP IS VALID — delete it
  otpStore.delete(email)

  try {
    const user = new User(userData)
    await user.save()

    return res.status(200).json({
      success: true,
      message: "Verified & User Saved"
    })
  } catch (err) {
    console.error("User save error:", err)
    return res.status(500).json({
      success: false,
      message: "User save failed"
    })
  }
})

app.post("/forgot-password/verify-otp", (req, res) => {
  const { email, otp } = req.body
  const stored = otpStore.get(email)

  if (!stored || stored.otp !== otp || Date.now() > stored.expires) {
    return res.status(400).json({ message: "Invalid or expired OTP" })
  }

  otpStore.delete(email)
  res.json({ success: true })
})

app.post("/forgot-password/reset", async (req, res) => {
  const { email, password }
  = req.body

  const hashed = await bcrypt.hash(password, 10)
  await User.updateOne({ email }, { password: hashed })

  res.json({ success: true })
})

app.post("/forgot-password/send-otp", async (req, res) => {
  const { email } = req.body
  const user = await User.findOne({ email })
  if (!user) return res.status(404).json({ message: "Account not found" })

  const otp = generateOTP()
  otpStore.set(email, { otp, expires: Date.now() + 300000 })

  await transporter.sendMail({
    to: email,
    subject: "Reset Password OTP",
    html: `<h1>${otp}</h1><p>Expires in 5 minutes</p>`
  })

  res.json({ success: true })
})

app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
)