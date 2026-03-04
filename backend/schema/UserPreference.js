import mongoose from "mongoose"

const userPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  themeColor: {
    type: String,
    default: "#808080" // grey
  },
  // 🚀 NEW: Arrays for feed filtering
  includedCategories: {
    type: [String],
    default: []
  },
  excludedCategories: {
    type: [String],
    default: []
  }
})

export default mongoose.model("UserPreference", userPreferenceSchema)
