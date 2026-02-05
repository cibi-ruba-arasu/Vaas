import mongoose from "mongoose";

const publishSchema = new mongoose.Schema({
  // ... (Existing fields: projectId, authorId, name, etc.)
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, default: "Anonymous" },
  name: { type: String, required: true },
  titleFont: { type: String, default: "Cinzel" },
  thumbnail: String,
  description: { 
    type: mongoose.Schema.Types.Mixed, // ✅ Changed from Array to Mixed
    default: { blocks: [], container: { colors: ['transparent'], angle: 135 } }
   }, 
  language: { type: String, default: "en" },
  
  categories: [String],
  customCategories: [String],
  warnings: [String],
  isThumbnailNSFW: { type: Boolean, default: false },
  
  monetization: {
    isPaid: { type: Boolean, default: false },
    hasDemo: { type: Boolean, default: false },
    demoNodeLimit: { type: Number, default: 10 }
  },

  canvasState: { type: mongoose.Schema.Types.Mixed, default: {} },
  publishedAt: { type: Date, default: Date.now },

  // ✅ UPDATED ANALYTICS
  visits: { type: Number, default: 0 }, // Raw page loads
  
  // Store Arrays of User IDs for uniqueness
  viewedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  playedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likedBy:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Optional if you want unique likes

  // Virtuals/Counts (Stored for fast access, or calculated)
  views: { type: Number, default: 0 },
  plays: { type: Number, default: 0 },
  likes: { type: Number, default: 0 }
});

export default mongoose.model("Publish", publishSchema);