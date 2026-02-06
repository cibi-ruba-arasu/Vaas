/* backend/schema/User.js */
import mongoose from "mongoose"

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    password: { type: String, required: true },
    userid: { type: String, unique: true },
    
    description: { type: mongoose.Schema.Types.Mixed, default: {} }, 
    profilePic: { type: String, default: "" }, 
    
    // ✅ FIX: Change [String] to Array so it accepts Objects {i:1, c:'red'}
    pfp_status: { 
      matrix: { type: Array, default: [] }, 
      background: {
        colors: { type: [String], default: ['#ffffff'] },
        angle: { type: Number, default: 90 }
      }
    },

    // ... (Keep existing fields: dob, age, verified, stats, etc.)
    dob: String,
    age: Number,
    country: String,
    state: String,
    city: String,
    verified: { type: String, enum: ['normal', 'chosen', 'verified', 'paid'], default: 'normal' },
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    rating: { type: Number, default: 0.0 },
    weavesCount: { type: Number, default: 0 }
  },
  { timestamps: true }
)

export default mongoose.model("User", userSchema)