import mongoose from "mongoose";

const publishSchema = new mongoose.Schema({
  projectId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Project', 
    required: true, 
    unique: true 
  },
  authorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  authorName: { type: String, default: "Anonymous" }, // Snapshot of author name
  name: { type: String, required: true },
  titleFont: { type: String, default: "Cinzel" },
  thumbnail: String,
  
  // Store the rich text blocks
  description: { type: Array, default: [] }, 
  
  // Metadata
  language: { type: String, default: "en" },
  categories: [String],
  customCategories: [String],
  warnings: [String],
  isThumbnailNSFW: { type: Boolean, default: false },
  
  // Monetization Settings
  monetization: {
    isPaid: { type: Boolean, default: false },
    hasDemo: { type: Boolean, default: false },
    demoNodeLimit: { type: Number, default: 10 }
  },

  // METRICS & TIMESTAMPS
  publishedAt: { type: Date, default: Date.now }, // The exact time requested
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 }
});

export default mongoose.model("Publish", publishSchema);