import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Who gets the alert
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Who caused it
  type: { 
    type: String, 
    enum: ['follow', 'publish', 'update'], 
    required: true 
  },
  message: { type: String, required: true }, // e.g., "X followed you"
  link: { type: String, default: "" }, // Where clicking takes you (e.g., /user/xyz or /post/123)
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Auto-delete notifications older than 30 days to save space (Optional but good practice)
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

export default mongoose.model("Notification", notificationSchema);