import mongoose from "mongoose";

const PlayStateSchema = new mongoose.Schema({
  gameId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Publish', 
    required: true 
  },
  currentNodeIndex: { 
    type: Number, 
    required: true 
  },
  currentSceneIndex: { 
    type: Number, 
    default: 0 
  },
  variables: { 
    type: mongoose.Schema.Types.Mixed, 
    default: {} 
  }, // Stores { "1769752665869": "John", "Age": 25 }
  lastPlayed: { 
    type: Date, 
    default: Date.now 
  }
});

const ConsoleSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true 
  },
  savedPosts: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Publish' 
  }],
  // 🚀 NEW: Tracks user progress for every game they start
  playStates: [PlayStateSchema] 
});

export default mongoose.model("Console", ConsoleSchema);