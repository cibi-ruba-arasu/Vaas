import express from "express"
import cors from "cors"
import nodemailer from "nodemailer"
import dotenv from "dotenv"
import mongoose from "mongoose"
import User from "./schema/User.js"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import UserPreference from "./schema/UserPreference.js"
import authMiddleware from "./middleware/auth.js"
import Project from "./schema/Project.js"


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

app.post("/login", async (req, res) => {
  const { email, password } = req.body

  console.log("🔐 Login attempt:", email)

  if (!email || !password) {
    console.log("❌ Missing email or password")
    return res.status(400).json({ message: "Email and password required" })
  }

  try {
    // 1️⃣ Find user by email
    const user = await User.findOne({ email })

    if (!user) {
      console.log("❌ Login failed: User not found")
      return res.status(404).json({ message: "Account does not exist" })
    }

    // 2️⃣ Compare password
    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      console.log("❌ Login failed: Wrong password")
      return res.status(401).json({ message: "Invalid credentials" })
    }

    // 3️⃣ Create JWT payload
    const payload = {
      mongoId: user._id,     // MongoDB ObjectId
      userId: user.userid   // Custom user ID from DB
    }

    // 4️⃣ Sign JWT
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "7d"
    })

    // 5️⃣ SUCCESS LOGS
    console.log("✅ LOGIN SUCCESSFUL")
    console.log("👤 Mongo ID:", user._id.toString())
    console.log("🆔 UserID:", user.userid)
    console.log("🔐 JWT TOKEN:", token)

    // 6️⃣ Response
    res.json({
      success: true,
      token,
      user: {
        mongoId: user._id,
        userId: user.userid
      }
    })

  } catch (err) {
    console.error("❌ Login server error:", err)
    res.status(500).json({ message: "Server error" })
  }
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

app.get("/user/theme", authMiddleware, async (req, res) => {
  const { mongoId } = req.user

  let pref = await UserPreference.findOne({ userId: mongoId })

  if (!pref) {
    return res.json({ themeColor: "#808080" }) // default grey
  }

  res.json({ themeColor: pref.themeColor })
})

app.post("/user/theme", authMiddleware, async (req, res) => {
  const { mongoId } = req.user
  const { color } = req.body

  let pref = await UserPreference.findOne({ userId: mongoId })

  if (!pref) {
    pref = new UserPreference({
      userId: mongoId,
      themeColor: color
    })
  } else {
    pref.themeColor = color
  }

  await pref.save()
  res.json({ success: true })
})

app.get("/user/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.mongoId).select(
      "username dob country state city"
    )

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({
      username: user.username,
      dob: user.dob,
      country: user.country,
      state: user.state,
      city: user.city
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server error" })
  }
})

app.get("/projects", authMiddleware, async (req, res) => {
  const { mongoId } = req.user

  const bucket = await Project.findOne({ userId: mongoId })

  if (!bucket) return res.json([])

  // oldest → newest
  const sorted = bucket.projects.sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  )

  res.json(sorted)
})

app.post("/projects", authMiddleware, async (req, res) => {
  const { mongoId } = req.user
  const { name, description } = req.body

  if (!name) {
    return res.status(400).json({ message: "Project name required" })
  }

  const user = await User.findById(mongoId).select("username")

  let bucket = await Project.findOne({ userId: mongoId })

  if (!bucket) {
    bucket = new Project({
      userId: mongoId,
      username: user.username,
      projects: []
    })
  }

  const exists = bucket.projects.some(
    p => p.name.toLowerCase() === name.toLowerCase()
  )

  if (exists) {
    return res.status(409).json({
      message: "Project with same name already exists"
    })
  }

  bucket.projects.push({ name, description })
  await bucket.save()

  res.status(201).json(bucket.projects.at(-1))
})

app.put("/projects/:id", authMiddleware, async (req, res) => {
  const { mongoId } = req.user
  const { name, description } = req.body

  const bucket = await Project.findOne({ userId: mongoId })

  if (!bucket) {
    return res.status(404).json({ message: "Project not found" })
  }

  const project = bucket.projects.id(req.params.id)

  if (!project) {
    return res.status(404).json({ message: "Project not found" })
  }

  const duplicate = bucket.projects.some(
    p =>
      p._id.toString() !== project._id.toString() &&
      p.name.toLowerCase() === name.toLowerCase()
  )

  if (duplicate) {
    return res.status(409).json({
      message: "Project name already exists"
    })
  }

  project.name = name
  project.description = description
  project.updatedAt = new Date()

  await bucket.save()
  res.json(project)
})

app.delete("/projects/:id", authMiddleware, async (req, res) => {
  const { mongoId } = req.user

  const bucket = await Project.findOne({ userId: mongoId })

  if (!bucket) {
    return res.status(404).json({ message: "Project not found" })
  }

  const project = bucket.projects.id(req.params.id)

  if (!project) {
    return res.status(404).json({ message: "Project not found" })
  }

  project.deleteOne()
  await bucket.save()

  res.json({ success: true })
})

app.get("/projects/:id", authMiddleware, async (req, res) => {
  const { mongoId } = req.user
  const { id } = req.params

  const bucket = await Project.findOne({ userId: mongoId })

  if (!bucket) {
    return res.status(404).json({ message: "Project not found" })
  }

  const project = bucket.projects.id(id)

  if (!project) {
    return res.status(404).json({ message: "Project not found" })
  }

  res.json(project)
})

app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
)