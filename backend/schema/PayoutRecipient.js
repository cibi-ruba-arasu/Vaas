import mongoose from "mongoose";

const PayoutRecipientSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  currency: { type: String, default: "INR" },
  accountHolderName: { type: String, required: true },
  phone: { type: String },
  email: { type: String },
  
  // These fields will store the encrypted strings (e.g., "iv_hex:content_hex")
  accountNumber: { type: String },
  ifsc: { type: String },
  upiId: { type: String }, 
  
  method: { type: String, default: "manual_inr" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("PayoutRecipient", PayoutRecipientSchema);