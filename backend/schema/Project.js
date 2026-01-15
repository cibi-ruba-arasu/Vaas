import mongoose from "mongoose"

const singleProjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    description: {
      type: String
    }
  },
  { timestamps: true }
)

const projectBucketSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    unique: true,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  projects: [singleProjectSchema]
})

export default mongoose.model("Project", projectBucketSchema)
