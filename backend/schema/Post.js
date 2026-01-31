import mongoose from "mongoose";

// A reusable sub-schema for translated text fields
// Structure: { en: "Hello", es: "Hola", ... }
const LocalizedString = {
  type: Map,
  of: String
};

const PostSchema = new mongoose.Schema({
  // --- RELATIONSHIPS ---
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String },

  // --- META DATA (TRANSLATED) ---
  title: LocalizedString,
  
  description: {
    background: String,
    blocks: [{
      text: LocalizedString, // TRANSLATED
      color: String,
      backgroundColor: String,
      fontFamily: String,
      fontSize: Number,
      fontWeight: String,
      fontStyle: String,
      textDecoration: String,
      textAlign: String,
      padding: Number,
      borderRadius: Number,
      borderWidth: Number,
      borderColor: String
    }]
  },
  
  // --- CLASSIFICATION (TRANSLATED) ---
  // Standard Categories (Action, RPG, etc.)
  categories: [LocalizedString], 
  
  // Custom User Categories (Dark Fantasy, Cyber-Noir, etc.)
  tags: [LocalizedString], 
  
  // Content Warnings
  warnings: [LocalizedString],

  // --- GAME CONTENT (RAW / UNTRANSLATED) ---
  // We strictly store the original node structure here. No translations inside.
  content: {
    nodes: [], // Stores the raw CanvasState nodes
    globalVariables: [],
    rootNodeId: String
  },

  // --- BANKING & MONETIZATION ---
  monetization: {
    isPaid: { type: Boolean, default: false },
    price: Number,
    currency: String,
    payouts: {
      country: String,
      accountName: String,
      bankName: String,
      accountNumber: String,
      ifscCode: String,
      swiftCode: String,
      iban: String,
      upiId: String
    }
  },

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Post", PostSchema);