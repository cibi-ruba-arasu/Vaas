import mongoose from "mongoose";

const ConsoleSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true // One console per user
  },
  savedPosts: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Publish' 
  }]
});

export default mongoose.model("Console", ConsoleSchema);