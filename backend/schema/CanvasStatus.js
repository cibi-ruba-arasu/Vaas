/* ===== backend/schema/CanvasStatus.js ===== */
import mongoose from "mongoose"

const canvasStatusSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project", // logical reference, though we store ID as string/objectID
      required: true,
      unique: true // ✅ Ensures 1 Project = 1 Canvas Status document
    },
    canvasData: {
      type: Array, // Stores the nodes (Canvas_Status)
      default: []
    },
    globalVariables: {
      type: Array, // Stores global variables
      default: []
    }
  },
  { timestamps: true }
)

export default mongoose.model("CanvasStatus", canvasStatusSchema)