import mongoose from "mongoose"

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    password: { type: String, required: true },
    
    // Identity & Bio
    userid: { type: String, unique: true },
    
    // Description Rich Text
    description: { type: mongoose.Schema.Types.Mixed, default: {} }, 
    
    // The rendered image (Base64) used for display across the app
    profilePic: { type: String, default: "" }, 
    
    // ✅ NEW: Stores the raw editor data (Matrix array, bg colors, angles)
    pfp_status: { 
      type: mongoose.Schema.Types.Mixed, 
      default: { 
        matrix: [], // Will store the 128x128 grid colors
        background: { colors: ['#1e293b', '#0f172a'], angle: 135 }
      } 
    },

    // Demographics
    dob: String,
    age: Number,
    country: String,
    state: String,
    city: String,
    
    // Status
    verified: { 
      type: String, 
      enum: ['normal', 'chosen', 'verified', 'paid'], 
      default: 'normal' 
    },
    
    // Stats
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    rating: { type: Number, default: 0.0 },
    weavesCount: { type: Number, default: 0 }
  },
  { timestamps: true }
)

export default mongoose.model("User", userSchema)