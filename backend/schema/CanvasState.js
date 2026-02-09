import mongoose from "mongoose";

const ComponentSchema = new mongoose.Schema({
  id: Number,
  type: String, // 'text', 'image', 'video', 'input', 'variable', 'options'
  name: String,
  x: Number,
  y: Number,
  width: Number,
  height: Number,
  rotation: Number,
  
  // Content & Source
  content: String,
  url: String, // Base64 Data URL or Link
  variableId: String, // For Variable Display or Input Target
  
  // Style
  fontSize: Number,
  fontFamily: String,
  fontWeight: String,
  fontStyle: String,
  textDecoration: String,
  textDecorationColor: String,
  color: String,
  backgroundColor: String,
  borderColor: String,
  borderWidth: Number,
  borderRadius: Number,
  
  // Media Specific
  aspectRatio: Number,
  isLoop: Boolean,
  isMuted: Boolean,
  bgMusicVolume: Number,
  
  // Options Specific
  boxColor: String,
  boxOpacity: Number,
  optionsList: [
    {
      id: Number,
      text: String
    }
  ],
  hasTimeLimit: Boolean,
  timeLimitDuration: Number,
  timeoutAction: String,
  timeoutTargetId: Number,
  styles: mongoose.Schema.Types.Mixed, // Store complex style objects for options

  // Input Specific
  placeholderText: String,
  buttonText: String,
  buttonSubmittedText: String,
  buttonNormalColor: String,
  buttonHoverColor: String,
  buttonClickColor: String,
  buttonTextColor: String,
  targetVariableId: String,

  // Animation
  animationType: String,
  animationDuration: Number,
  exitAnimationType: String,
  exitAnimationDuration: Number,
  
  // Render Logic
  renderWhileClicked: Boolean,
  autoRender: Boolean
}, { _id: false });

const SceneSchema = new mongoose.Schema({
  id: Number,
  name: String,
  backgroundColor: String,
  components: [ComponentSchema]
}, { _id: false });

const NodeSchema = new mongoose.Schema({
  index: Number, // Node ID
  x: Number,
  y: Number,
  node_type: String,
  Node_name: String,
  
  referenceWidth: Number,  // The width of the editor when designed
  referenceHeight: Number, // The height of the editor when designed

  // Connections
  Next: Number,
  NextTrue: Number,
  NextFalse: Number,
  
  // Logic
  varId: String,
  varOperator: String, // Also covers 'operator' for If-Else
  operator: String,    // Explicit check
  varValue: mongoose.Schema.Types.Mixed, // Can be string or number
  compareValue: mongoose.Schema.Types.Mixed,
  varValueType: String,
  compareValueType: String,
  stringPrefix: String,
  stringSuffix: String,

  // Content
  scenes: [SceneSchema],
  audio: {
    name: String,
    url: String,
    volume: Number,
    loop: Boolean
  },
  
  // Options Links
  options: [{
    id: Number,
    text: String,
    next: Number
  }],

  // --- NEW: GIFT NODE PROPERTIES ---
  giftMode: String, // 'pfp' or 'badge'
  giftName: String,
  giftFont: String,
  // Using Mixed for pixelData because it is a 2D array of strings/nulls
  pixelData: mongoose.Schema.Types.Mixed, 
  giftAudio: {
    name: String,
    url: String,
    duration: Number
  }
}, { _id: false });

const GlobalVarSchema = new mongoose.Schema({
  id: Number,
  name: String,
  type: String,
  value: mongoose.Schema.Types.Mixed,
  defaultValue: mongoose.Schema.Types.Mixed
}, { _id: false });

const CanvasStateSchema = new mongoose.Schema({
  projectId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Project', 
    required: true,
    unique: true // Ensures 1 canvas state per project
  },
  nodes: [NodeSchema], // This stores your Canvas_Status
  globalVariables: [GlobalVarSchema],
  rootNodeId: { type: Number, default: null },
  totalOptionsCount: { type: Number, default: 0 },
  disconnectedOptionsCount: { type: Number, default: 0 },
  lastSaved: { type: Date, default: Date.now }
});

export default mongoose.model("CanvasState", CanvasStateSchema);