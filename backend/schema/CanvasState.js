import mongoose from "mongoose"

const CanvasStateSchema = new mongoose.Schema({
  projectId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
    // Note: We don't strictly ref "Project" here because Project is a subdocument in your User schema, 
    // but we store the ID to link them logically.
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true, 
    ref: "User" 
  },
  canvasData: { 
    type: Array, 
    default: [] 
  }, // This stores the nodes, connections, scenes (Canvas_Status)
  globalVariables: { 
    type: Array, 
    default: [] 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
})

export default mongoose.model("CanvasState", CanvasStateSchema)