import mongoose from "mongoose"

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    password: { type: String, required: true },
    dob: String,
    age: Number,
    country: String,
    state: String,
    city: String,
    userid: String,
    verified: { type: Boolean, default: true }
  },
  { timestamps: true }
)

export default mongoose.model("User", userSchema)
