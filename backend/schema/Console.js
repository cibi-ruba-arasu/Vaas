import mongoose from "mongoose";

// Defines a single save slot (Instance)
const InstanceSchema = new mongoose.Schema({
  id: { type: Number, required: true }, // The frontend-generated timestamp ID
  name: { type: String, default: "Instance" },
  variables: { type: mongoose.Schema.Types.Mixed, default: [] },
  visitedNodes: [{ type: Number }], // Array of node indices for the map history
  currentLocation: { type: Number, default: null },
  lastPlayed: { type: Date, default: Date.now }
});

// Defines a Game in the library, containing its instances and achievements
const GameStateSchema = new mongoose.Schema({
  gameId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Publish', 
    required: true 
  },
  instances: [InstanceSchema],
  achievements: {
    pfp: [{ name: String, pixels: mongoose.Schema.Types.Mixed, font: String }],
    badges: [{ name: String, pixels: mongoose.Schema.Types.Mixed, font: String }]
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
  // 🚀 REPLACES playStates: Tracks the complex object for every game
  gameStates: [GameStateSchema] 
});

export default mongoose.model("Console", ConsoleSchema);