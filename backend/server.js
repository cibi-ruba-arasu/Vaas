import express from "express"
import cors from "cors"
import nodemailer from "nodemailer"
import dotenv from "dotenv"
import mongoose from "mongoose"
import User from "./schema/User.js"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import UserPreference from "./schema/UserPreference.js"
import authMiddleware from "./middleware/auth.js"
import Project from "./schema/Project.js"
import CanvasState from "./schema/CanvasState.js"
import { Storage } from "@google-cloud/storage"; // Import GCS
import path from "path";
import crypto from "crypto"
import { translate } from "@vitalets/google-translate-api";
import pLimit from "p-limit";
import Publish from "./schema/Publish.js"
import Notification from "./schema/Notification.js"
import axios from "axios";
import Razorpay from "razorpay";
import PayoutRecipient from "./schema/PayoutRecipient.js";
import ConsoleDB from "./schema/Console.js";
import Purchase from "./schema/Purchase.js";
import Comment from "./schema/Comment.js"
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config()

const app = express()
const PORT = 5000

app.use(cors())
app.use(express.json({ limit: '200mb' })); 
app.use(express.urlencoded({ limit: '200mb', extended: true }));

const TARGET_LANGUAGES = [
    'en', 'es', 'fr', 'de', 'zh-cn', 'ja', 'ko', 'ru', 'pt', 'hi'
];

const ENCRYPTION_KEY = Buffer.from(process.env.PAYOUT_ENC_KEY || '', 'hex'); 
const IV_LENGTH = 16; // AES block size

function encrypt(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (e) {
    console.error("Encryption Error:", e);
    return null;
  }
}

// (Optional) Add this if you build an admin panel later to read the data
function decrypt(text) {
  if (!text) return text;
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    console.error("Decryption Error:", e);
    return null;
  }
}

const WISE_API_URL = process.env.WISE_API_URL || "https://api.transferwise.com";
const WISE_API_KEY = process.env.WISE_API_KEY;
let _cachedProfileId = null;
const limit = pLimit(5); 
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const getWiseProfileId = async () => {
    if (_cachedProfileId) return _cachedProfileId;
    try {
        const res = await axios.get(`${WISE_API_URL}/v1/profiles`, {
            headers: { Authorization: `Bearer ${WISE_API_KEY}` }
        });
        // We look for the 'business' profile. If not found, use the first one.
        const profile = res.data.find(p => p.type === "business") || res.data[0];
        if (profile) _cachedProfileId = profile.id;
        return _cachedProfileId;
    } catch (err) {
        console.error("Wise Profile Error:", err.response?.data || err.message);
        return null;
    }
};

/* ===== GOOGLE CLOUD STORAGE SETUP ===== */
const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  credentials: {
    client_email: process.env.GCS_CLIENT_EMAIL,
    // The .replace() is mandatory here. Environment variables sometimes escape 
    // the \n characters as literal string text instead of actual line breaks. 
    // This replace method prevents the dreaded "Invalid crypto engine" crash.
    private_key: (process.env.GCS_PRIVATE_KEY || "").replace(/\\n/g, '\n')
  }
});
const bucketName = "loomart-media-storage"; // REPLACE THIS (e.g. loomart-media-storage)
const bucket = storage.bucket(bucketName);

const deleteFolderContent = async (prefix) => {
  try {
    // 🚀 OPTIMIZATION: Bulk delete directly instead of fetching metadata first
    await bucket.deleteFiles({ force: true, prefix });
    console.log(`🗑️ Cleared old files in: ${prefix}`);
  } catch (err) {
    console.error("Delete Error:", err);
  }
};

const getExtension = (mimeType) => {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/ogg': 'ogg'
  };
  return map[mimeType] || 'bin'; // Default to bin if unknown
};

/* ===== HELPER: UPLOAD BASE64 TO GCS ===== */
const uploadToGCS = async (base64Data, folderPath, fileNamePrefix) => {
  try {
    // 1. Validate Base64
    const splitIndex = base64Data.indexOf(';base64,');
    if (splitIndex === -1) {
      console.error("[GCS] Invalid Base64 format");
      return null;
    }

    // 2. Extract Info
    const contentType = base64Data.substring(5, splitIndex);
    const ext = getExtension(contentType);
    
    // Extract the raw base64 string
    const rawBase64 = base64Data.substring(splitIndex + 8);
    
    // Create the Buffer (This is the heavy operation, done once)
    const buffer = Buffer.from(rawBase64, "base64");

    // 3. Generate Hash & Path
    // --- FIX IS HERE: Use 'buffer' instead of 'rawBase64' ---
    // Passing the huge string to update() caused the memory crash.
    const hash = crypto.createHash("md5").update(buffer).digest("hex"); 
    // --------------------------------------------------------

    const fullFileName = `${fileNamePrefix}_${hash}.${ext}`;
    const fullPath = `${folderPath}/${fullFileName}`;

    // 4. Check if exists
    const file = bucket.file(fullPath);
    const [exists] = await file.exists();

    if (exists) {
      console.log(`[GCS] File exists (Skipping): ${fullFileName}`);
      return { 
          url: `https://storage.googleapis.com/${bucketName}/${fullPath}`, 
          path: fullPath 
      };
    }

    // 5. Upload
    // 5. Upload (Inside uploadToGCS function)
    console.log(`[GCS] Uploading: ${fullFileName} (${contentType})`);
    await file.save(buffer, {
      metadata: { 
        contentType,
        // 🚀 OPTIMIZATION: Tell browsers to cache this file for 1 year
        cacheControl: 'public, max-age=31536000' 
      },
      validation: "md5",
      resumable: false
    });

    return { 
        url: `https://storage.googleapis.com/${bucketName}/${fullPath}`, 
        path: fullPath 
    };

  } catch (error) {
    console.error(`[GCS] Upload FAILED:`, error);
    return null;
  }
};


// Helper: Random delay to look human
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const translateToAll = async (text, sourceLang) => {
    if (!text || typeof text !== 'string') return {};

    const results = {};
    const promises = TARGET_LANGUAGES.map(lang => {
        return limit(async () => {
            if (lang === sourceLang) {
                results[lang] = text;
                return;
            }
            try {
                // Delay to prevent Google blocking IP
                await delay(500 + Math.random() * 500); 
                const res = await translate(text, { to: lang });
                results[lang] = res.text;
            } catch (err) {
                console.error(`⚠️ Translation skipped (${lang}):`, err.message);
                results[lang] = text; // Fallback to original
            }
        });
    });

    await Promise.all(promises);
    return results;
};

const calculateGiftCounts = (canvasState) => {
    let pfpCount = 0;
    let badgeCount = 0;

    if (canvasState && canvasState.nodes && Array.isArray(canvasState.nodes)) {
        const connected = new Set();
        
        // Helper to safely register connections
        const addConnection = (val) => {
            if (val !== null && val !== undefined && val !== "") {
                connected.add(Number(val));
            }
        };

        // PASS 1: The Root Node is inherently connected
        if (canvasState.rootNodeId !== undefined && canvasState.rootNodeId !== null) {
            connected.add(Number(canvasState.rootNodeId));
        }

        // PASS 1: Map every single outgoing connection in the canvas
        canvasState.nodes.forEach(n => {
            addConnection(n.Next);
            addConnection(n.NextTrue);
            addConnection(n.NextFalse);
            if (n.options && Array.isArray(n.options)) {
                n.options.forEach(o => addConnection(o.next));
            }
        });

        // PASS 2: Check gifts and ONLY count if their index exists in the connected set
        canvasState.nodes.forEach(node => {
            const typeStr = String(node.node_type || node.Node_type || node.type || node.name || node.Node_name || "");
            
            // Case insensitive check for "Gift"
            if (typeStr.toLowerCase() === 'gift' && connected.has(Number(node.index))) {
                const mode = String(node.giftMode || (node.data && node.data.giftMode) || (node.Node_data && node.Node_data.giftMode) || 'pfp').toLowerCase();
                if (mode === 'badge') {
                    badgeCount++;
                } else {
                    pfpCount++;
                }
            }
        });
    }
    return { pfp: pfpCount, badges: badgeCount };
};

/* ===== HELPER: Calculate Maximum Demo Nodes (Height of General Nodes) ===== */
const calculateMaxDemoNodes = (canvasState) => {
  if (!canvasState || !canvasState.nodes || !Array.isArray(canvasState.nodes)) {
    return 0;
  }

  const nodes = canvasState.nodes;
  const rootNodeId = canvasState.rootNodeId;
  
  if (rootNodeId === undefined || rootNodeId === null) return 0;

  // Helper function to check if a node is a General node
  const isGeneralNode = (node) => {
    if (!node) return false;
    const typeStr = String(node.node_type || node.Node_type || node.type || node.name || node.Node_name || "").toLowerCase();
    return typeStr === 'general';
  };

  // Build adjacency list for General nodes only
  const generalNodes = new Set();
  const adjacencyMap = new Map(); // nodeIndex -> Set of connected General node indices
  
  nodes.forEach(node => {
    if (isGeneralNode(node)) {
      generalNodes.add(node.index);
      adjacencyMap.set(node.index, new Set());
    }
  });

  // If no General nodes found, return 0
  if (generalNodes.size === 0) return 0;

  // Populate connections between General nodes
  nodes.forEach(node => {
    if (!isGeneralNode(node)) return;

    const targets = [];
    
    if (node.Next !== null && node.Next !== undefined) {
      targets.push(node.Next);
    }
    
    if (node.NextTrue !== null && node.NextTrue !== undefined) {
      targets.push(node.NextTrue);
    }
    if (node.NextFalse !== null && node.NextFalse !== undefined) {
      targets.push(node.NextFalse);
    }
    
    if (node.options && Array.isArray(node.options)) {
      node.options.forEach(opt => {
        if (opt.next !== null && opt.next !== undefined) {
          targets.push(opt.next);
        }
      });
    }

    const currentNodeAdj = adjacencyMap.get(node.index) || new Set();
    targets.forEach(targetIndex => {
      if (generalNodes.has(targetIndex)) {
        currentNodeAdj.add(targetIndex);
      }
    });
    adjacencyMap.set(node.index, currentNodeAdj);
  });

  // DFS with memoization to find longest path
  const memo = new Map();

  const dfs = (nodeIndex, visited = new Set()) => {
    if (!generalNodes.has(nodeIndex)) return 0;
    if (memo.has(nodeIndex)) return memo.get(nodeIndex);
    if (visited.has(nodeIndex)) return 0; // Cycle detected
    
    visited.add(nodeIndex);
    
    let maxChildLength = 0;
    const nextNodes = adjacencyMap.get(nodeIndex) || new Set();
    
    for (const nextIndex of nextNodes) {
      const branchVisited = new Set(visited);
      const childLength = dfs(nextIndex, branchVisited);
      maxChildLength = Math.max(maxChildLength, childLength);
    }
    
    const result = 1 + maxChildLength;
    memo.set(nodeIndex, result);
    return result;
  };

  const maxHeight = dfs(rootNodeId);
  
  // Demo limit should be maxHeight - 1 (prevent reaching final node)
  // Ensure at least 1
  return Math.max(1, maxHeight - 1);
};

/* ===== HELPER: RECURSIVE MEDIA PROCESSOR ===== */
const processProjectAssets = async (nodes, userId, projectId) => {
  const usedFilePaths = new Set();
  const projectFolder = `users/${userId}/projects/${projectId}`;
  const uploadPromises = []; // Store our concurrent upload tasks

  const processAsset = async (dataUrl, namePrefix, updateCallback) => {
    if (!dataUrl || !dataUrl.startsWith("data:")) return;
    
    // We wrap the upload in the concurrency limiter
    await limit(async () => {
      const result = await uploadToGCS(dataUrl, projectFolder, namePrefix);
      if (result) {
        usedFilePaths.add(result.path);
        updateCallback(result.url); // Update the specific node property
      }
    });
  };

  const trackExistingUrl = (url) => {
    if (url && url.includes(bucketName)) {
      const urlParts = url.split(`${bucketName}/`);
      if (urlParts[1]) usedFilePaths.add(urlParts[1]);
    }
  };

  // 1. Queue all uploads concurrently
  for (const node of nodes) {
    if (node.audio && node.audio.url) {
      if (node.audio.url.startsWith("data:")) {
        uploadPromises.push(processAsset(node.audio.url, "audio", (url) => node.audio.url = url));
      } else {
        trackExistingUrl(node.audio.url);
      }
    }

    if (node.giftAudio && node.giftAudio.url) {
      if (node.giftAudio.url.startsWith("data:")) {
        uploadPromises.push(processAsset(node.giftAudio.url, "gift_audio", (url) => node.giftAudio.url = url));
      } else {
        trackExistingUrl(node.giftAudio.url);
      }
    }

    if (node.scenes) {
      for (const scene of node.scenes) {
        if (scene.components) {
          for (const comp of scene.components) {
            if (comp.type === "image" || comp.type === "video") {
              if (comp.url && comp.url.startsWith("data:")) {
                const safeName = comp.name ? comp.name.replace(/[^a-z0-9]/gi, '_') : 'asset';
                uploadPromises.push(processAsset(comp.url, safeName, (url) => comp.url = url));
              } else {
                trackExistingUrl(comp.url);
              }
            }
          }
        }
      }
    }
  }

  // 2. Wait for all queued uploads to finish
  await Promise.all(uploadPromises);

  return { updatedNodes: nodes, usedFilePaths };
};

/* ===== HELPER: CLEANUP ORPHANED FILES ===== */
const cleanupOrphanedFiles = async (userId, projectId, usedFilePaths) => {
  const prefix = `users/${userId}/projects/${projectId}/`;
  
  // List all files in this project folder
  const [files] = await bucket.getFiles({ prefix });

  const deletePromises = files.map(file => {
    // If the file in storage is NOT in our "used" set, delete it
    if (!usedFilePaths.has(file.name)) {
      console.log(`🗑️ Deleting orphan file: ${file.name}`);
      return file.delete();
    }
  });

  await Promise.all(deletePromises);
};


/* ===== MONGO ===== */

/* ===== OTP STORE ===== */
const otpStore = new Map()

/* ===== EMAIL ===== */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASS
  }
})

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString()

/* ===== SEND OTP ===== */
app.post("/send-otp", async (req, res) => {
  const { email } = req.body

  if (!email) return res.status(400).json({ message: "Email required" })

  const otp = generateOTP()
  const expires = Date.now() + 5 * 60 * 1000

  otpStore.set(email, { otp, expires })

  await transporter.sendMail({
    from: `"Loomart" <${process.env.EMAIL}>`,
    to: email,
    subject: "Your Loomart OTP",
    html: `<h1>${otp}</h1><p>Expires in 5 minutes</p>`
  })

  res.json({ success: true })
})

/* ===== VERIFY OTP + SAVE USER ===== */
app.post("/verify-otp", async (req, res) => {
  const { email, otp, userData } = req.body

  const stored = otpStore.get(email)

  if (!stored) {
    return res.status(400).json({
      success: false,
      message: "OTP not found"
    })
  }

  if (Date.now() > stored.expires) {
    otpStore.delete(email)
    return res.status(400).json({
      success: false,
      message: "OTP expired"
    })
  }

  if (stored.otp !== otp) {
    return res.status(400).json({
      success: false,
      message: "Invalid OTP"
    })
  }

  // ✅ OTP IS VALID — delete it
  otpStore.delete(email)

  try {
    const user = new User(userData)
    await user.save()

    return res.status(200).json({
      success: true,
      message: "Verified & User Saved"
    })
  } catch (err) {
    console.error("User save error:", err)
    return res.status(500).json({
      success: false,
      message: "User save failed"
    })
  }
})

app.post("/forgot-password/verify-otp", (req, res) => {
  const { email, otp } = req.body
  const stored = otpStore.get(email)

  if (!stored || stored.otp !== otp || Date.now() > stored.expires) {
    return res.status(400).json({ message: "Invalid or expired OTP" })
  }

  otpStore.delete(email)
  res.json({ success: true })
})

app.post("/login", async (req, res) => {
  const { email, password } = req.body

  console.log("🔐 Login attempt:", email)

  if (!email || !password) {
    console.log("❌ Missing email or password")
    return res.status(400).json({ message: "Email and password required" })
  }

  try {
    // 1️⃣ Find user by email
    const user = await User.findOne({ email })

    if (!user) {
      console.log("❌ Login failed: User not found")
      return res.status(404).json({ message: "Account does not exist" })
    }

    // 2️⃣ Compare password
    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      console.log("❌ Login failed: Wrong password")
      return res.status(401).json({ message: "Invalid credentials" })
    }

    // 3️⃣ Create JWT payload
    const payload = {
      mongoId: user._id,     // MongoDB ObjectId
      userId: user.userid   // Custom user ID from DB
    }

    // 4️⃣ Sign JWT
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "7d"
    })

    // 5️⃣ SUCCESS LOGS
    console.log("✅ LOGIN SUCCESSFUL")
    console.log("👤 Mongo ID:", user._id.toString())
    console.log("🆔 UserID:", user.userid)
    console.log("🔐 JWT TOKEN:", token)

    // 6️⃣ Response
    res.json({
      success: true,
      token,
      user: {
        mongoId: user._id,
        userId: user.userid
      }
    })

  } catch (err) {
    console.error("❌ Login server error:", err)
    res.status(500).json({ message: "Server error" })
  }
})

app.post("/forgot-password/reset", async (req, res) => {
  const { email, password }
  = req.body

  const hashed = await bcrypt.hash(password, 10)
  await User.updateOne({ email }, { password: hashed })

  res.json({ success: true })
})

app.post("/user/follow/:targetId", authMiddleware, async (req, res) => {
  const { mongoId } = req.user; // Me
  const { targetId } = req.params; // The person I want to follow

  if (mongoId === targetId) return res.status(400).json({ message: "Cannot follow yourself" });

  try {
    const me = await User.findById(mongoId);
    const target = await User.findById(targetId);

    if (!target) return res.status(404).json({ message: "User not found" });

    // Check if already following
    const isFollowing = me.following.includes(targetId);

    if (isFollowing) {
      // UNFOLLOW LOGIC
      me.following = me.following.filter(id => id.toString() !== targetId);
      target.followers = target.followers.filter(id => id.toString() !== mongoId);
      
      // Update counts
      me.followingCount = Math.max(0, me.followingCount - 1);
      target.followersCount = Math.max(0, target.followersCount - 1);

      await me.save();
      await target.save();

      res.json({ success: true, isFollowing: false, followersCount: target.followersCount });

    } else {
      // FOLLOW LOGIC
      me.following.push(targetId);
      target.followers.push(mongoId);
      
      // Update counts
      me.followingCount += 1;
      target.followersCount += 1;

      await me.save();
      await target.save();

      // 🔔 NOTIFICATION: Tell target they have a new follower
      await Notification.create({
        recipient: targetId,
        sender: mongoId,
        type: 'follow',
        message: `${me.username} started following you.`,
        link: `/user/${me.userid}`
      });

      res.json({ success: true, isFollowing: true, followersCount: target.followersCount });
    }

  } catch (err) {
    console.error("Follow error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===== SOCIAL: GET MY NETWORK (Populated Lists) ===== */
app.get("/user/network", authMiddleware, async (req, res) => {
  try {
    // Only fetch for the logged-in user (Privacy Requirement)
    const user = await User.findById(req.user.mongoId)
      .populate("followers", "username userid profilePic") // Only get necessary fields
      .populate("following", "username userid profilePic");
      
    res.json({
      followers: user.followers,
      following: user.following
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching network" });
  }
});

/* ===== NOTIFICATIONS: GET ALL ===== */
app.get("/notifications", authMiddleware, async (req, res) => {
  try {
    const alerts = await Notification.find({ recipient: req.user.mongoId })
      .populate("sender", "username profilePic") // Show who sent it
      .sort({ createdAt: -1 }) // Newest first
      .limit(20); // Don't overload
    
    // Count unread
    const unreadCount = await Notification.countDocuments({ 
      recipient: req.user.mongoId, 
      isRead: false 
    });

    res.json({ alerts, unreadCount });
  } catch (err) {
    res.status(500).json({ message: "Error fetching notifications" });
  }
});

/* ===== NOTIFICATIONS: MARK READ ===== */
app.put("/notifications/read", authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.mongoId, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Error updating notifications" });
  }
});

app.post("/forgot-password/send-otp", async (req, res) => {
  const { email } = req.body
  const user = await User.findOne({ email })
  if (!user) return res.status(404).json({ message: "Account not found" })

  const otp = generateOTP()
  otpStore.set(email, { otp, expires: Date.now() + 300000 })

  await transporter.sendMail({
    to: email,
    subject: "Reset Password OTP",
    html: `<h1>${otp}</h1><p>Expires in 5 minutes</p>`
  })

  res.json({ success: true })
})

app.get("/user/theme", authMiddleware, async (req, res) => {
  const { mongoId } = req.user

  let pref = await UserPreference.findOne({ userId: mongoId })

  if (!pref) {
    return res.json({ 
      themeColor: "#808080", 
      includedCategories: [], 
      excludedCategories: [] 
    }) // default
  }

  res.json({ 
    themeColor: pref.themeColor,
    includedCategories: pref.includedCategories || [],
    excludedCategories: pref.excludedCategories || []
  })
})

/* ===== UPDATE USER PREFERENCES ===== */
app.post("/user/theme", authMiddleware, async (req, res) => {
  const { mongoId } = req.user
  const { color, includedCategories, excludedCategories } = req.body

  let pref = await UserPreference.findOne({ userId: mongoId })

  if (!pref) {
    pref = new UserPreference({
      userId: mongoId,
      themeColor: color,
      includedCategories: includedCategories || [],
      excludedCategories: excludedCategories || []
    })
  } else {
    if (color) pref.themeColor = color;
    // Update arrays if they are provided in the request
    if (includedCategories !== undefined) pref.includedCategories = includedCategories;
    if (excludedCategories !== undefined) pref.excludedCategories = excludedCategories;
  }

  await pref.save()
  res.json({ success: true })
})

// 2. Get User's Console Items
app.get("/console", authMiddleware, async (req, res) => {
  try {
    const { mongoId } = req.user;
    
    const userConsole = await ConsoleDB.findOne({ userId: mongoId })
      .populate("savedPosts"); 
      
    if (!userConsole || !userConsole.savedPosts) {
        return res.json([]);
    }
    
    // FIX: Filter out null values in case a published post was deleted by its author
    const validPosts = userConsole.savedPosts.filter(post => post !== null);
    
    res.json(validPosts);
  } catch (err) {
    console.error("Console Fetch Error:", err);
    res.status(500).json({ message: "Failed to fetch console" });
  }
});


app.get("/publish/explore", async (req, res) => {
  try {
    // 🚀 FIX: Accept 'categories' (plural) from the query
    const { categories } = req.query;
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;

    let includedPrefs = [];
    let excludedPrefs = [];

    // 1. Identify User Preferences
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const pref = await UserPreference.findOne({ userId: decoded.mongoId });
        if (pref) {
          includedPrefs = pref.includedCategories || [];
          excludedPrefs = pref.excludedCategories || [];
        }
      } catch (e) {}
    }

    // 2. Base Query
    let query = {};
    
    // 🚀 FIX: Handle multiple categories via the $in operator
    if (categories) {
      const catArray = categories.split(','); // Convert "Action,Sci-Fi" into ["Action", "Sci-Fi"]
      query.$or = [
        { categories: { $in: catArray } },
        { customCategories: { $in: catArray } }
      ];
    }
    
    if (excludedPrefs.length > 0) {
      query.$and = [
        { categories: { $nin: excludedPrefs } },
        { customCategories: { $nin: excludedPrefs } },
        { warnings: { $nin: excludedPrefs } }
      ];
    }

    const weaves = await Publish.find(query).lean();

    // 3. The Scoring Engine
    const now = new Date();
    const scoredWeaves = weaves.map(weave => {
      const likes = weave.likes || 0;
      const plays = weave.plays || 0;
      const visits = weave.visits || 0;
      const views = weave.views || 0;

      const baseScore = (likes * 10) + (plays * 5) + (visits * 2) + (views * 1);
      const conversionRatio = (plays + likes) / (visits + 1);
      const qualityScore = baseScore * (1 + conversionRatio);

      const publishDate = new Date(weave.publishedAt || weave._id.getTimestamp());
      const ageInHours = Math.max(1, (now - publishDate) / (1000 * 60 * 60));
      const gravity = 1.2; 
      let finalScore = qualityScore / Math.pow(ageInHours + 2, gravity);

      if (includedPrefs.length > 0) {
        let matchCount = 0;
        if (weave.categories) matchCount += weave.categories.filter(c => includedPrefs.includes(c)).length;
        if (weave.customCategories) matchCount += weave.customCategories.filter(c => includedPrefs.includes(c)).length;
        if (matchCount > 0) finalScore *= (1 + (0.5 * matchCount));
      }

      return { ...weave, rankScore: finalScore };
    });

    // 4. Sort highest score first
    scoredWeaves.sort((a, b) => b.rankScore - a.rankScore);

    // 🚀 NEW: Pagination Logic
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedWeaves = scoredWeaves.slice(startIndex, endIndex);
    const totalPages = Math.ceil(scoredWeaves.length / limit);

    res.json({
      weaves: paginatedWeaves,
      currentPage: page,
      totalPages: totalPages,
      totalItems: scoredWeaves.length
    });

  } catch (err) {
    console.error("Recommendation Engine Error:", err);
    res.status(500).json({ message: "Failed to compile feed" });
  }
});

app.get("/user/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.mongoId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const publishedCount = await Publish.countDocuments({ authorId: req.user.mongoId });

    res.json({
      username: user.username,
      userid: user.userid,
      description: user.description,
      profilePic: user.profilePic,
      pfp_status: user.pfp_status, 
      
      // ✅ Send the arrays to the frontend securely
      pfp_inventory: user.pfp_inventory || { custom: [], earned: [] },
      active_pfp_type: user.active_pfp_type,
      active_earned_ref: user.active_earned_ref,
      badges: user.badges || [], 
      
      verified: user.verified,
      stats: {
        followers: user.followersCount || 0,
        following: user.followingCount || 0,
        rating: user.rating || 5.0,
        weaves: publishedCount
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/user/publishes", authMiddleware, async (req, res) => {
  try {
    const publishes = await Publish.find({ authorId: req.user.mongoId })
      .sort({ publishedAt: -1 }); // Newest first
    res.json(publishes);
  } catch (err) {
    console.error("Fetch Publishes Error:", err);
    res.status(500).json({ message: "Error fetching published projects" });
  }
});

app.post("/console/add/:postId", authMiddleware, async (req, res) => {
  try {
    const { mongoId } = req.user;
    const { postId } = req.params;

    // Find user's console or create one if it doesn't exist
    let userConsole = await ConsoleDB.findOne({ userId: mongoId });
    if (!userConsole) {
      userConsole = new ConsoleDB({ userId: mongoId, savedPosts: [] });
    }

    // FIX: Convert ObjectId to string before comparing
    const isAlreadyAdded = userConsole.savedPosts.some(id => id.toString() === postId);
    
    if (!isAlreadyAdded) {
      userConsole.savedPosts.push(postId);
      await userConsole.save();
    }

    res.json({ success: true, message: "Added to Console" });
  } catch (err) {
    console.error("Console Add Error:", err);
    res.status(500).json({ message: "Failed to add to console" });
  }
});



/* ===== UPDATE USER PROFILE ===== */
app.put("/user/profile", authMiddleware, async (req, res) => {
  const { mongoId } = req.user;
  const { username, description, profilePic, pfp_status, pfp_inventory, active_pfp_type, active_earned_ref, badges } = req.body; 

  try {
    const updateData = { username, description, profilePic, pfp_status, active_pfp_type };
    
    // ✅ SAFETY CHECK: Only update arrays if the frontend actually sent them. Prevents accidental wiping.
    if (pfp_inventory) updateData.pfp_inventory = pfp_inventory;
    if (active_earned_ref !== undefined) updateData.active_earned_ref = active_earned_ref;
    if (badges) updateData.badges = badges;

    const updatedUser = await User.findByIdAndUpdate(
      mongoId,
      updateData,
      { new: true }
    ).select("-password");

    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Update failed" });
  }
});

app.get("/projects", authMiddleware, async (req, res) => {
  const { mongoId } = req.user;

  // 1. Fetch User's Project Bucket using .lean() for Plain Objects
  const bucket = await Project.findOne({ userId: mongoId }).lean();
  
  if (!bucket) return res.json([]);

  const projectsRaw = bucket.projects; // Now this is already a plain array

  // 2. Attach Stats & Check Published Status
  const projectsWithData = await Promise.all(projectsRaw.map(async (p) => {
      // Check Publish DB
      const isPublished = await Publish.exists({ projectId: p._id });

      // Check Canvas Stats
      const state = await CanvasState.findOne({ projectId: p._id });
      
      // 🚀 FIX: Added hasRootNode to the initial stats object
      let stats = { disconnected: 0, orphans: 0, hasGeneralNode: false, totalNodes: 0, hasRootNode: false };
      if (state) {
          stats.disconnected = state.disconnectedOptionsCount || 0;
          stats.orphans = state.orphanedNodesCount || 0;
          stats.hasGeneralNode = state.nodes ? state.nodes.some(n => n.node_type === 'General') : false;
          
          // 🚀 FIX: Safely check if rootNodeId exists. 
          // We check against null/undefined because '0' is a valid index but evaluates to false in standard JS checks.
          stats.hasRootNode = state.rootNodeId !== null && state.rootNodeId !== undefined;
      }

      return {
          ...p,
          stats,
          isPublished: !!isPublished
      };
  }));

  const sorted = projectsWithData.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json(sorted);
});

app.post("/projects", authMiddleware, async (req, res) => {
  const { mongoId } = req.user
  const { name, description, thumbnail } = req.body

  if (!name) return res.status(400).json({ message: "Name required" })

  const user = await User.findById(mongoId).select("username")
  let bucket = await Project.findOne({ userId: mongoId })

  if (!bucket) {
    bucket = new Project({ userId: mongoId, username: user.username, projects: [] })
  }

  // 1. Create Project Subdocument (to get ID)
  const newProject = bucket.projects.create({ name, description });

  // 2. Handle Thumbnail Upload
  if (thumbnail && thumbnail.startsWith("data:")) {
      // PATH: users/{uid}/projects/{pid}/thumbnail/
      const thumbnailFolder = `users/${mongoId}/projects/${newProject._id}/thumbnail`;
      
      // Upload (filename prefix 'cover' creates users/.../thumbnail/cover_hash.jpg)
      const uploadResult = await uploadToGCS(thumbnail, thumbnailFolder, "cover");
      
      if (uploadResult) {
          newProject.thumbnail = uploadResult.url;
      }
  }

  bucket.projects.push(newProject)
  await bucket.save()

  res.status(201).json(bucket.projects.at(-1))
})

app.put("/projects/:id", authMiddleware, async (req, res) => {
  const { mongoId } = req.user
  const { name, description, thumbnail, titleFont } = req.body 
  
  const bucket = await Project.findOne({ userId: mongoId })
  if (!bucket) return res.status(404).json({ message: "Bucket not found" })
  
  const project = bucket.projects.id(req.params.id)
  if (!project) return res.status(404).json({ message: "Project not found" })

  const thumbnailFolder = `users/${mongoId}/projects/${project._id}/thumbnail`;
  
  if (thumbnail && thumbnail.startsWith("linear-gradient")) {
      await deleteFolderContent(thumbnailFolder);
      project.thumbnail = thumbnail;
  } else if (thumbnail && thumbnail.startsWith("data:")) {
      const splitIndex = thumbnail.indexOf(';base64,');
      if (splitIndex !== -1) {
          await deleteFolderContent(thumbnailFolder);
          const uploadResult = await uploadToGCS(thumbnail, thumbnailFolder, "cover");
          if (uploadResult) project.thumbnail = uploadResult.url;
      }
  } else if (thumbnail === null) {
      await deleteFolderContent(thumbnailFolder);
      project.thumbnail = undefined;
  }
  
  // Update Draft Data
  project.name = name
  project.description = description
  if (titleFont) project.titleFont = titleFont; 
  project.updatedAt = new Date()

  await bucket.save()
  res.json({ project })
})

app.delete("/projects/:id", authMiddleware, async (req, res) => {
  const { mongoId } = req.user;
  const projectId = req.params.id;

  try {
    const bucket = await Project.findOne({ userId: mongoId });

    if (!bucket) {
      return res.status(404).json({ message: "Project bucket not found" });
    }

    const project = bucket.projects.id(projectId);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // 1. Find the Published post to get its unique _id
    // (Consoles store the Publish _id, not the Draft projectId)
    const publishedPost = await Publish.findOne({ projectId });

    if (publishedPost) {
      // 2. Remove this post from ALL users' consoles
      await ConsoleDB.updateMany(
        {}, 
        { $pull: { savedPosts: publishedPost._id } }
      );
      
      // 3. Delete the Publish document
      await Publish.deleteOne({ projectId });
    }

    // 4. Delete the CanvasState (the actual nodes/game data)
    await CanvasState.deleteOne({ projectId });

    // 5. Wipe all media from Google Cloud Storage to prevent ghost files
    // (Using your existing deleteFolderContent helper)
    const gcsFolder = `users/${mongoId}/projects/${projectId}`;
    await deleteFolderContent(gcsFolder);

    // 6. Finally, remove the project from the user's draft bucket
    project.deleteOne();
    await bucket.save();

    res.json({ success: true, message: "Project completely unraveled." });

  } catch (err) {
    console.error("Delete Project Cascade Error:", err);
    res.status(500).json({ message: "Failed to delete project." });
  }
});

app.get("/projects/:id", authMiddleware, async (req, res) => {
  const { mongoId } = req.user
  const { id } = req.params

  const bucket = await Project.findOne({ userId: mongoId })

  if (!bucket) {
    return res.status(404).json({ message: "Project not found" })
  }

  const project = bucket.projects.id(id)

  if (!project) {
    return res.status(404).json({ message: "Project not found" })
  }

  // - We combine the project data with the username from the parent bucket
  const projectData = {
    ...project.toObject(),
    authorName: bucket.username 
  }

  res.json(projectData)
})

app.post("/canvas/save", authMiddleware, async (req, res) => {
  const { 
    projectId, 
    nodes, 
    globalVariables, 
    rootNodeId, 
    totalOptionsCount, 
    disconnectedOptionsCount 
  } = req.body;

  const { mongoId } = req.user; // Get User ID from Token

  if (!projectId) return res.status(400).json({ message: "Project ID required" });

  try {
    console.log("💾 Starting Save Process...");

    // 1. Process Assets: Upload new, get URLs, identify used files
    // We pass 'nodes' by reference, so it gets modified directly
    const { updatedNodes, usedFilePaths } = await processProjectAssets(
      nodes, 
      mongoId, 
      projectId
    );

    // 2. Cleanup: Delete files in GCS that are no longer in 'usedFilePaths'
    await cleanupOrphanedFiles(mongoId, projectId, usedFilePaths);

    // 3. Save to MongoDB (Now with lightweight URLs)
    const savedState = await CanvasState.findOneAndUpdate(
      { projectId },
      { 
        projectId, 
        nodes: updatedNodes, // Save the nodes with GCS URLs
        globalVariables,
        rootNodeId,               
        totalOptionsCount,        
        disconnectedOptionsCount, 
        lastSaved: new Date()
      },
      { new: true, upsert: true }
    );

    console.log("✅ Project saved successfully with GCS Sync.");

    // Return the updated nodes so frontend can update its state 
    // (swapping Base64 for URLs locally)
    res.json({ 
        success: true, 
        message: "Project saved successfully", 
        savedAt: savedState.lastSaved,
        updatedNodes: savedState.nodes // Frontend needs this!
    });

  } catch (err) {
    console.error("Save error:", err);
    res.status(500).json({ message: "Failed to save project" });
  }
});

/* ===== LOAD CANVAS STATE ===== */
app.get("/canvas/load/:projectId", authMiddleware, async (req, res) => {
  const { projectId } = req.params;

  try {
    const state = await CanvasState.findOne({ projectId });

    if (!state) {
      // Return empty structure if new project
      return res.json({ nodes: [], globalVariables: [] }); 
    }

    res.json(state);
  } catch (err) {
    console.error("Load error:", err);
    res.status(500).json({ message: "Failed to load project" });
  }
});


app.get("/projects/details/:projectId", authMiddleware, async (req, res) => {
  const { mongoId } = req.user;
  const { projectId } = req.params;

  console.log(`🔍 Fetching details for Project: ${projectId} | User: ${mongoId}`);

  try {
    // 1. Find the User's Project Bucket
    const bucket = await Project.findOne({ userId: mongoId });
    
    if (!bucket) {
      console.log("❌ Bucket not found for this user.");
      return res.status(404).json({ message: "User project bucket not found" });
    }

    // 2. Find the specific Project Sub-document using Mongoose's .id() method
    const project = bucket.projects.id(projectId);

    if (!project) {
      console.log(`❌ Project ID ${projectId} does not exist in user's bucket.`);
      // List available IDs to debug
      const availableIds = bucket.projects.map(p => p._id.toString());
      console.log("ℹ️ Available Projects:", availableIds);
      return res.status(404).json({ message: "Project not found" });
    }

    console.log("✅ Project found:", project.name);
    res.json(project);

  } catch (err) {
    console.error("🔥 Error fetching details:", err);
    res.status(500).json({ message: "Server error fetching details" });
  }
});

app.get("/user/me", authMiddleware, async (req, res) => {
  try {
    // ✅ ADD 'age' to the select string
    const user = await User.findById(req.user.mongoId).select("email username country age");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("User fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ... existing imports ... */
// Add this route near your other user routes (e.g., before app.listen)

/* ===== USER SEARCH ===== */
app.get("/search/unified", authMiddleware, async (req, res) => {
  const { q } = req.query;

  if (!q || q.length < 2) return res.json([]);

  try {
    const regex = new RegExp(q, "i");

    // 1. Search Published Projects (Limit 5)
    // We prioritize these by fetching them first and putting them at the top
    const projects = await Publish.find({ name: regex })
      .select("name _id authorName thumbnail")
      .limit(5)
      .lean();

    // 2. Search Users (Limit 5)
    const users = await User.find({ username: regex })
      .select("username userid")
      .limit(5)
      .lean();

    // 3. Format Results
    // Add a 'type' field to help the frontend distinguish them
    const formattedProjects = projects.map(p => ({
        type: 'project',
        id: p._id,
        title: p.name,
        subtitle: `by ${p.authorName}`,
        image: p.thumbnail
    }));

    const formattedUsers = users.map(u => ({
        type: 'user',
        id: u.userid, // Custom UserID for routing
        title: `u/${u.username}`, // Add u/ prefix here or on frontend
        subtitle: 'Weaver'
    }));

    // Combine: Projects first, then Users
    res.json([...formattedProjects, ...formattedUsers]);

  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Search failed" });
  }
});

/* ===== UNIFIED SEARCH SUGGESTIONS ===== */
app.get("/search/suggestions", authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  try {
    const regex = new RegExp(q, "i");

    // 1. Search Published Projects (Priority)
    // ✅ CHANGED: Added 'description.blocks.content' to the $or array
    const publishes = await Publish.find({
        $or: [
            { name: { $regex: regex } },                  // Match Name
            { customCategories: { $regex: regex } },      // Match Custom Tags
            { 'description.blocks.content': { $regex: regex } } // Match Text inside Description Blocks
        ]
      })
      .select("name _id projectId authorName thumbnail")
      .limit(8); 

    // 2. Search Users
    const users = await User.find({ username: { $regex: regex } })
      .select("username userid _id")
      .limit(5);

    // 3. Format & Combine (Projects First)
    const formattedPublishes = publishes.map(p => ({
      type: 'publish',
      id: p._id, 
      mainText: p.name,
      subText: `by ${p.authorName}`,
      image: p.thumbnail
    }));

    const formattedUsers = users.map(u => ({
      type: 'user',
      id: u.userid, 
      mainText: u.username,
      subText: null
    }));

    // Combine
    const results = [...formattedPublishes, ...formattedUsers].slice(0, 12);

    res.json(results);
  } catch (err) {
    console.error("Search Error:", err);
    res.status(500).json({ message: "Search failed" });
  }
});

/* ===== GET PUBLIC USER PROFILE (By Custom UserID) ===== */
app.get("/users/:userid", async (req, res) => {
  const { userid } = req.params;
  try {
    const targetUser = await User.findOne({ userid }).select("-password");
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    // 1. Fetch the user's published projects
    const publishedCount = await Publish.countDocuments({ authorId: targetUser._id });
    const userProjects = await Publish.find({ authorId: targetUser._id }).sort({ publishedAt: -1 });

    // 2. Check if the person viewing is following this user
    let isFollowing = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        isFollowing = targetUser.followers.includes(decoded.mongoId);
      } catch (e) { /* ignore invalid token */ }
    }

    // ✅ FIX: Restore the { user, projects, isFollowing } wrapper structure!
    res.json({
      user: {
        _id: targetUser._id,
        username: targetUser.username,
        userid: targetUser.userid,
        description: targetUser.description,
        profilePic: targetUser.profilePic,
        active_pfp_type: targetUser.active_pfp_type || 'custom',
        active_earned_ref: targetUser.active_earned_ref || null,
        badges: targetUser.badges || [], // 🚀 Badges are safely included here
        verified: targetUser.verified,
        stats: {
          followers: targetUser.followersCount || 0,
          following: targetUser.followingCount || 0,
          rating: targetUser.rating || 5.0,
          weaves: publishedCount
        }
      },
      projects: userProjects,
      isFollowing: isFollowing
    });
  } catch (err) {
    console.error("Fetch user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/publish", authMiddleware, async (req, res) => {
  const { 
    id, name, titleFont, description, language, categories, 
    customCategories, warnings, isThumbnailNSFW, monetization, 
    updateCanvas
  } = req.body;

 const price = monetization?.price || 0;
  
  let { thumbnail } = req.body; 
  const { mongoId } = req.user;

  try {
    // 🚫 REMOVE THIS BLOCK - PAID PROJECTS ARE NOW ALLOWED
    // if (monetization && monetization.isPaid) {
    //   return res.status(400).json({ message: "This route currently only supports Free projects." });
    // }

    const author = await User.findById(mongoId).select("username followers"); 
    if (!author) return res.status(404).json({ message: "Author not found" });

    // =========================================================
    // 📸 THUMBNAIL UPLOAD LOGIC
    // =========================================================
    if (thumbnail && thumbnail.startsWith("data:")) {
      const thumbnailFolder = `users/${mongoId}/projects/${id}/thumbnail`;
      await deleteFolderContent(thumbnailFolder);
      const uploadResult = await uploadToGCS(thumbnail, thumbnailFolder, "cover");
      if (uploadResult) {
          thumbnail = uploadResult.url;
      }
    }

    // 1. Check if it's already published
    const existingPublish = await Publish.findOne({ projectId: id });

    // 2. Prepare Base Metadata
    const publishData = {
      projectId: id,
      authorId: mongoId,
      authorName: author.username,
      name, titleFont, description, language, categories, customCategories, warnings, 
      isThumbnailNSFW, 
      monetization: {
        isPaid: monetization?.isPaid || false,
        price: monetization?.price || 0,
        priceCurrency: monetization?.priceCurrency || "USD", // ← ADD THIS
        hasDemo: monetization?.hasDemo || false,
        demoNodeLimit: monetization?.demoNodeLimit || 10,
      },
      thumbnail,
      publishedAt: new Date()
    };

    // 3. Always grab canvas for calculation
    const liveCanvasState = await CanvasState.findOne({ projectId: id }).lean();
    if (!liveCanvasState) {
      return res.status(400).json({ message: "No content found to publish." });
    }

    // 4. Calculate max demo nodes (for paid projects with demo)
    let maxDemoLimit = 0;
    if (publishData.monetization.isPaid && publishData.monetization.hasDemo) {
      maxDemoLimit = calculateMaxDemoNodes(liveCanvasState);
      publishData.monetization.maxDemoLimit = maxDemoLimit;
      
      // Validate the requested limit
      const requestedLimit = publishData.monetization.demoNodeLimit;
      if (requestedLimit > maxDemoLimit) {
        return res.status(400).json({ 
          message: `Demo limit cannot exceed ${maxDemoLimit} nodes`,
          maxAllowed: maxDemoLimit
        });
      }
    }

    // 5. Conditionally include canvasState
    if (!existingPublish || updateCanvas) {
      delete liveCanvasState._id;
      delete liveCanvasState.__v;
      publishData.canvasState = liveCanvasState; 
    }

    /* 🎁 6. CALCULATE GIFT COUNTS USING THE HELPER 🎁 */
    const stateToScan = publishData.canvasState || (existingPublish ? existingPublish.canvasState : null);
    publishData.giftCounts = calculateGiftCounts(stateToScan);

    // 7. Save to Database using $set
    const result = await Publish.findOneAndUpdate(
      { projectId: id }, 
      { $set: publishData },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    /* 🔔 NOTIFY FOLLOWERS (Only if it's a first-time publish) */
    if (!existingPublish && author.followers && author.followers.length > 0) {
      const notifications = author.followers.map(followerId => ({
        recipient: followerId,
        sender: mongoId,
        type: 'publish',
        message: `${author.username} published a new weave: "${name}"`,
        link: `/post/${result._id}`
      }));
      
      await Notification.insertMany(notifications);
    }

    // 8. SYNC BACK TO PROJECT BUCKET
    if (thumbnail && thumbnail.startsWith("http")) {
       const projectBucket = await Project.findOne({ userId: mongoId });
       if (projectBucket) {
         const subProject = projectBucket.projects.id(id);
         if (subProject) {
           subProject.thumbnail = thumbnail;
           await projectBucket.save();
         }
       }
    }

    res.json({ 
      success: true, 
      message: updateCanvas ? "Project and Content updated!" : "Metadata updated successfully!",
      publishedAt: result.publishedAt,
      thumbnail: thumbnail,
      maxDemoLimit // Send back for frontend validation
    });

  } catch (err) {
    console.error("Publish Error:", err);
    res.status(500).json({ message: "Failed to publish/update project" });
  }
});

app.get("/publish/:projectId", authMiddleware, async (req, res) => {
  const { projectId } = req.params;
  try {
    const publishedProject = await Publish.findOne({ projectId });
    if (!publishedProject) return res.status(404).json({ message: "Project not published yet" });
    res.json(publishedProject);
  } catch (err) {
    res.status(500).json({ message: "Error fetching published data" });
  }
});

/* ===== GET SINGLE POST BY ID (For Post.vue) ===== */
app.get("/posts/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { mongoId } = req.user; 

  try {
    const post = await Publish.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    // --- ANALYTICS LOGIC ---
    let incUpdate = {};
    let arrayUpdate = {};

    const isAuthor = post.authorId.toString() === mongoId;

    if (!isAuthor) {
      incUpdate.visits = 1; 
      const hasViewed = post.viewedBy && post.viewedBy.includes(mongoId);
      if (!hasViewed) {
        incUpdate.views = 1; 
        arrayUpdate.viewedBy = mongoId; 
      }
    }

    if (Object.keys(incUpdate).length > 0 || arrayUpdate.viewedBy) {
      const updateQuery = { $inc: incUpdate };
      if (arrayUpdate.viewedBy) updateQuery.$push = { viewedBy: arrayUpdate.viewedBy };
      await Publish.findByIdAndUpdate(id, updateQuery);
      
      if (incUpdate.visits) post.visits = (post.visits || 0) + 1;
      if (incUpdate.views) post.views = (post.views || 0) + 1;
    }

    // --- CONSOLE CHECK FIX ---
    let inConsole = false;
    const userConsole = await ConsoleDB.findOne({ userId: mongoId });
    if (userConsole && userConsole.savedPosts && userConsole.savedPosts.some(savedId => savedId.toString() === id)) {
        inConsole = true;
    }

    // ✅ THE FIX: Fetch the custom 'userid' to send to the frontend
    const author = await User.findById(post.authorId).select("userid");
    const authorUserId = author ? author.userid : post.authorId;

    // 👇 NEW: Check if user liked this post
    const hasLiked = post.likedBy.includes(mongoId);

    // Convert the mongoose document to a plain object and inject the new ID
    const postResponse = {
        ...post.toObject(),
        authorUserId 
    };

    res.json({
        post: postResponse, // Send the modified object
        stats: {
            views: post.views,
            visits: post.visits,
            plays: post.plays,
            likes: post.likes // 👈 ADDED likes count
        },
        inConsole,
        liked: hasLiked // 👈 ADDED liked status
    });

  } catch (err) {
    console.error("Error fetching post:", err);
    res.status(500).json({ message: "Server error fetching post" });
  }
});
app.post("/posts/:id/play", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { mongoId } = req.user;

  try {
    const post = await Publish.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const isAuthor = post.authorId.toString() === mongoId;
    // Do not count author plays
    if (isAuthor) {
      return res.json({ success: false, message: "Author play not counted" });
    }

    // Check if user already played
    const hasPlayed = post.playedBy && post.playedBy.includes(mongoId);

    // 🚀 NEW LOGIC: For paid games, only count if purchased
    if (post.monetization?.isPaid) {
      // Check if user purchased this game
      const purchase = await Purchase.findOne({
        userId: mongoId,
        gameId: id,
        status: 'completed'
      });
      
      // If paid game and not purchased, DO NOT count play
      if (!purchase) {
        return res.json({ 
          success: true, 
          newPlay: false, 
          message: "Play not counted - purchase required" 
        });
      }
    }

    // If not already played, increment play count
    if (!hasPlayed) {
      await Publish.findByIdAndUpdate(id, {
        $inc: { plays: 1 },
        $push: { playedBy: mongoId }
      });
      return res.json({ success: true, newPlay: true });
    }

    res.json({ success: true, newPlay: false });
  } catch (err) {
    console.error("Play tracking error:", err);
    res.status(500).json({ message: "Error tracking play" });
  }
});

app.delete("/console/remove/:postId", authMiddleware, async (req, res) => {
  try {
    const { mongoId } = req.user;
    const { postId } = req.params;

    let userConsole = await ConsoleDB.findOne({ userId: mongoId });
    if (userConsole) {
      // Filter out the game ID
      userConsole.savedPosts = userConsole.savedPosts.filter(id => id.toString() !== postId);
      await userConsole.save();
    }

    res.json({ success: true, message: "Removed from Console" });
  } catch (err) {
    console.error("Console Remove Error:", err);
    res.status(500).json({ message: "Failed to remove from console" });
  }
});

/* 1. DYNAMIC REQUIREMENTS ROUTE */
app.get("/payouts/requirements", authMiddleware, async (req, res) => {
    const { currency } = req.query;
    
    if (!currency) return res.status(400).json({ message: "Currency required" });

    try {
        // We assume YOU (the platform) hold funds in a standard currency like USD or GBP.
        // Wise needs to know "Source" (You) and "Target" (User).
        const sourceCurrency = "INR"; 

        const response = await axios.get(`${WISE_API_URL}/v1/account-requirements`, {
            params: {
                source: sourceCurrency,
                target: currency,
                sourceAmount: 100 // Arbitrary amount to trigger validation rules
            },
            headers: { Authorization: `Bearer ${WISE_API_KEY}` }
        });

        // Wise returns an array of "types" (e.g., for USD: 'aba' (local) and 'swift' (international)).
        // We send this full list to the frontend.
        res.json(response.data);

    } catch (err) {
        console.error("Wise Req Error:", err.response?.data || err.message);
        res.status(500).json({ message: "Failed to fetch bank requirements" });
    }
});

/* 2. CREATE RECIPIENT ROUTE (Generic) */
app.post("/payouts/wise/create-recipient", authMiddleware, async (req, res) => {
    const { currency, accountHolderName, type, details } = req.body;

    try {
        const profileId = await getWiseProfileId();
        
        const payload = {
            currency,
            type, 
            profile: profileId,
            accountHolderName,
            legalType: "PRIVATE", 
            details: details 
        };

        const wiseRes = await axios.post(`${WISE_API_URL}/v1/accounts`, payload, {
            headers: { Authorization: `Bearer ${WISE_API_KEY}` }
        });

        console.log(`✅ Wise Recipient Created: ${wiseRes.data.id}`);
        res.json({ success: true, recipientId: wiseRes.data.id });
        if (wiseRes.data.id) {
          await PayoutRecipient.findOneAndUpdate(
            { userId: req.user.mongoId, currency },
            {
              userId: req.user.mongoId,
              currency,
              accountHolderName,
              wiseRecipientId: wiseRes.data.id,
              method: 'wise',
              updatedAt: new Date()
            },
            { upsert: true }
          );
        }
    } catch (err) {
        console.error("Wise Create Error:", err.response?.data || err.message);
        const msg = err.response?.data?.errors?.map(e => e.message).join(", ") || "Invalid bank details";
        res.status(400).json({ message: msg });
    }
});

app.post("/payouts/razorpay/create-recipient", authMiddleware, async (req, res) => {
  const { name, email, phone, accountNumber, ifsc, upiId } = req.body;

  try {
    // 1. Encrypt Sensitive Data
    const encAccount = encrypt(accountNumber);
    const encIfsc = encrypt(ifsc); // Optional, but good practice
    const encUpi = encrypt(upiId);

    // 2. Check/Update Logic (We search by userId now, not accountNumber since it's encrypted differently every time)
    let recipient = await PayoutRecipient.findOne({ 
      userId: req.user.mongoId,
      currency: 'INR'
    });

    if (recipient) {
      recipient.accountHolderName = name;
      recipient.phone = phone;
      recipient.accountNumber = encAccount;
      recipient.ifsc = encIfsc;
      recipient.upiId = encUpi;
      recipient.updatedAt = new Date();
      await recipient.save();
    } else {
      recipient = new PayoutRecipient({
        userId: req.user.mongoId,
        currency: 'INR',
        accountHolderName: name,
        email,
        phone,
        accountNumber: encAccount,
        ifsc: encIfsc,
        upiId: encUpi,
        method: 'manual_inr'
      });
      await recipient.save();
    }

    console.log(`✅ Secured Manual Payout Details: ${recipient._id}`);
    
    res.json({ success: true, recipientId: recipient._id.toString() });

  } catch (err) {
    console.error("Manual Save Error:", err);
    res.status(500).json({ message: "Failed to save details locally." });
  }
});

app.get("/console", authMiddleware, async (req, res) => {
  try {
    const { mongoId } = req.user;
    
    const userConsole = await ConsoleDB.findOne({ userId: mongoId })
      .populate({
          path: "savedPosts",
          select: "-canvasState" // ⚡ EXCLUDE heavy canvas data for the library view
      }); 
      
    if (!userConsole || !userConsole.savedPosts) {
        return res.json([]);
    }
    
    // Filter out null values in case a published post was deleted by its author
    const validPosts = userConsole.savedPosts.filter(post => post !== null);
    
    res.json(validPosts);
  } catch (err) {
    console.error("Console Fetch Error:", err);
    res.status(500).json({ message: "Failed to fetch console" });
  }
});

app.post("/payments/create-order", authMiddleware, async (req, res) => {
  const { gameId } = req.body;
  const { mongoId } = req.user;

  try {
    // 1. Get game details
    const game = await Publish.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }
    
    if (!game.monetization?.isPaid) {
      return res.status(400).json({ message: "Game is free" });
    }

    // 2. Check if already purchased
    const existingPurchase = await Purchase.findOne({
      userId: mongoId,
      gameId: gameId,
      status: 'completed'
    });

    if (existingPurchase) {
      return res.status(400).json({ 
        message: "You already own this game",
        alreadyOwned: true 
      });
    }

    // 3. Calculate amount (convert to smallest currency unit - paise for INR)
    const amount = Math.round(game.monetization.price * 100);

    // 4. Generate a short, unique receipt (max 40 chars)
    const shortGameId = gameId.toString().slice(-6);
    const timestamp = Date.now().toString().slice(-6);
    const receipt = `rcpt_${shortGameId}_${timestamp}`; // e.g., "rcpt_32d3_2416"

    // 5. Create Razorpay order
    const options = {
      amount: amount,
      currency: game.monetization.priceCurrency || "INR",
      receipt: receipt,
      notes: {
        userId: mongoId.toString(),
        gameId: gameId.toString(),
        gameName: game.name.substring(0, 30)
      }
    };

    console.log("Creating Razorpay order:", options);
    const order = await razorpay.orders.create(options);
    console.log("Order created:", order.id);

    // 6. Create pending purchase record
    await Purchase.create({
      userId: mongoId,
      gameId: gameId,
      razorpayOrderId: order.id,
      amount: game.monetization.price,
      currency: game.monetization.priceCurrency || "INR",
      status: 'pending'
    });

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID
      },
      gameDetails: {
        name: game.name,
        thumbnail: game.thumbnail,
        price: game.monetization.price
      }
    });

  } catch (err) {
    console.error("Order Creation Error:", err);
    
    // Handle specific Razorpay validation errors
    if (err.statusCode === 400) {
      return res.status(400).json({ 
        message: err.error?.description || "Invalid payment request",
        details: err.error
      });
    }
    
    res.status(500).json({ 
      message: "Failed to create payment order",
      error: err.message 
    });
  }
});

app.post("/payments/verify", authMiddleware, async (req, res) => {
  const { 
    razorpay_order_id, 
    razorpay_payment_id, 
    razorpay_signature,
    gameId 
  } = req.body;
  
  const { mongoId } = req.user;

  try {
    console.log("Verifying payment:", {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      gameId
    });

    // 1. Verify signature using crypto
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      console.error("Payment signature verification failed");
      return res.status(400).json({ 
        success: false, 
        message: "Payment verification failed" 
      });
    }

    // 2. Update purchase record
    const purchase = await Purchase.findOneAndUpdate(
      { 
        razorpayOrderId: razorpay_order_id,
        userId: mongoId,
        gameId: gameId 
      },
      {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'completed',
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!purchase) {
      console.error("Purchase record not found for order:", razorpay_order_id);
      return res.status(404).json({ message: "Purchase record not found" });
    }

    // 3. Increment game's purchase count (optional analytics)
    await Publish.findByIdAndUpdate(gameId, {
      $inc: { purchases: 1 }
    });

    console.log("Payment verified successfully for user:", mongoId);

    res.json({
      success: true,
      message: "Payment verified successfully",
      purchase: {
        gameId: purchase.gameId,
        amount: purchase.amount,
        purchasedAt: purchase.purchasedAt
      }
    });

  } catch (err) {
    console.error("Payment Verification Error:", err);
    res.status(500).json({ 
      message: "Failed to verify payment",
      error: err.message 
    });
  }
});

app.get("/payments/check/:gameId", authMiddleware, async (req, res) => {
  const { gameId } = req.params;
  const { mongoId } = req.user;

  try {
    const purchase = await Purchase.findOne({
      userId: mongoId,
      gameId: gameId,
      status: 'completed'
    });

    res.json({
      owned: !!purchase,
      purchase: purchase ? {
        purchasedAt: purchase.purchasedAt,
        amount: purchase.amount
      } : null
    });

  } catch (err) {
    console.error("Purchase Check Error:", err);
    res.status(500).json({ message: "Failed to check purchase status" });
  }
});

app.get("/payments/my-purchases", authMiddleware, async (req, res) => {
  const { mongoId } = req.user;

  try {
    const purchases = await Purchase.find({ 
      userId: mongoId, 
      status: 'completed' 
    }).populate('gameId', 'name thumbnail authorName monetization');

    // 🚀 FIX: Filter out purchases where the game has been deleted by the author
    const validPurchases = purchases.filter(p => p.gameId !== null);

    res.json(validPurchases.map(p => ({
      gameId: p.gameId._id,
      name: p.gameId.name,
      thumbnail: p.gameId.thumbnail,
      authorName: p.gameId.authorName,
      purchasedAt: p.purchasedAt,
      amount: p.amount,
      currency: p.currency
    })));

  } catch (err) {
    console.error("Fetch Purchases Error:", err);
    res.status(500).json({ message: "Failed to fetch purchases" });
  }
});

app.post("/posts/:id/like", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { mongoId } = req.user;

  try {
    const post = await Publish.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const hasLiked = post.likedBy.includes(mongoId);

    if (hasLiked) {
      // Unlike: Remove from array and decrement count
      await Publish.findByIdAndUpdate(id, {
        $pull: { likedBy: mongoId },
        $inc: { likes: -1 }
      });
      return res.json({ liked: false, likes: post.likes - 1 });
    } else {
      // Like: Add to array and increment count
      await Publish.findByIdAndUpdate(id, {
        $push: { likedBy: mongoId },
        $inc: { likes: 1 }
      });
      
      // 🔔 Optional: Send notification to author
      if (post.authorId.toString() !== mongoId) {
        await Notification.create({
          recipient: post.authorId,
          sender: mongoId,
          type: 'like',
          message: `${req.user.username || 'Someone'} liked your weave: "${post.name}"`,
          link: `/post/${id}`
        });
      }
      
      return res.json({ liked: true, likes: post.likes + 1 });
    }
  } catch (err) {
    console.error("Like error:", err);
    res.status(500).json({ message: "Failed to process like" });
  }
});

/* ===== CHECK IF USER LIKED POST ===== */
app.get("/posts/:id/like-status", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { mongoId } = req.user;

  try {
    const post = await Publish.findById(id).select("likedBy likes");
    if (!post) return res.status(404).json({ message: "Post not found" });

    const liked = post.likedBy.includes(mongoId);
    res.json({ liked, likes: post.likes });
  } catch (err) {
    console.error("Like status error:", err);
    res.status(500).json({ message: "Failed to fetch like status" });
  }
});

app.post("/user/pfp/earned", authMiddleware, async (req, res) => {
  // 👇 Ensure giftFont is destructured from req.body
  const { publishId, giftName, base64, giftFont } = req.body; 
  try {
    const user = await User.findById(req.user.mongoId);
    
    if (!user.pfp_inventory) user.pfp_inventory = { custom: [], earned: [] };
    if (!user.pfp_inventory.earned) user.pfp_inventory.earned = [];
    
    const alreadyOwned = user.pfp_inventory.earned.find(p => 
      p.publishId && p.publishId.toString() === publishId && p.giftName === giftName
    );
    
    if (!alreadyOwned) {
      user.pfp_inventory.earned.push({ publishId, giftName, base64, giftFont }); // 👈 Save it here
    }

    user.active_pfp_type = 'earned';
    user.active_earned_ref = { publishId, giftName, giftFont }; // 👈 And here
    
    user.markModified('pfp_inventory');
    user.markModified('active_earned_ref');
    
    await user.save();
    res.json({ success: true, message: "Earned PFP added to inventory and equipped!" });
  } catch (err) {
    console.error("Earned PFP Error:", err);
    res.status(500).json({ message: "Failed to equip earned PFP" });
  }
});

/* ===== BADGE INVENTORY: ADD TO ACHIEVEMENTS ===== */
app.post("/user/badge/earned", authMiddleware, async (req, res) => {
  const { publishId, giftName, base64, giftFont } = req.body;
  try {
    const user = await User.findById(req.user.mongoId);
    
    // 🚀 FIX: Safely initialize without wiping
    if (!user.badges) user.badges = [];
    
    // Prevent adding duplicates
    const alreadyOwned = user.badges.find(b => 
      b.publishId && b.publishId.toString() === publishId && b.giftName === giftName
    );
    
    if (!alreadyOwned) {
      user.badges.push({ publishId, giftName, base64, giftFont });
      
      // 🚀 FIX: Explicitly tell Mongoose the array was modified
      user.markModified('badges');
      
      await user.save();
    }

    res.json({ success: true, message: "Badge added to your profile showcase!" });
  } catch (err) {
    console.error("Badge Error:", err);
    res.status(500).json({ message: "Failed to add badge" });
  }
});

app.get("/badges/source/:publishId", async (req, res) => {
  try {
    // 🚀 FIX: Added titleFont to the select projection
    const post = await Publish.findById(req.params.publishId).select("name authorId authorName titleFont");
    if (!post) return res.status(404).json({ message: "Source weave not found" });

    // Fetch the author's custom @userid for frontend routing
    const author = await User.findById(post.authorId).select("userid");

    res.json({
      gameName: post.name,
      gameFont: post.titleFont, // 🚀 FIX: Sending the font down to the client
      authorName: post.authorName,
      authorUserId: author ? author.userid : post.authorId
    });
  } catch (err) {
    console.error("Badge Source Error:", err);
    res.status(500).json({ message: "Server error fetching badge source" });
  }
});

/* ===== GLOBAL SEARCH ENGINE ===== */
app.get("/search/global", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === "") {
      return res.json({ games: [], users: [] });
    }

    const searchRegex = new RegExp(q, 'i');
    let includedPrefs = [];
    let excludedPrefs = [];

    // 1. Identify User Preferences (If logged in)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const pref = await UserPreference.findOne({ userId: decoded.mongoId });
        if (pref) {
          includedPrefs = pref.includedCategories || [];
          excludedPrefs = pref.excludedCategories || [];
        }
      } catch (e) {
        // Token invalid, proceed as guest
      }
    }

    // 2. Base Query for Games
    let gameQuery = {
      $or: [
        { name: searchRegex },
        { customCategories: searchRegex },
        { "description.blocks.content": searchRegex }
      ]
    };

    // The Gatekeeper: Strictly avoid excluded categories & warnings
    if (excludedPrefs.length > 0) {
      gameQuery.$and = [
        { categories: { $nin: excludedPrefs } },
        { customCategories: { $nin: excludedPrefs } },
        { warnings: { $nin: excludedPrefs } }
      ];
    }

    // Fetch potential matches
    const weaves = await Publish.find(gameQuery).lean();

    // 3. The Resonance Engine
    const scoredWeaves = weaves.map(weave => {
      const likes = weave.likes || 0;
      const plays = weave.plays || 0;
      let score = (likes * 10) + (plays * 5); // Base Engagement

      // Importance Multiplier (Included Preferences Boost)
      if (includedPrefs.length > 0) {
        let matchCount = 0;
        if (weave.categories) matchCount += weave.categories.filter(c => includedPrefs.includes(c)).length;
        if (weave.customCategories) matchCount += weave.customCategories.filter(c => includedPrefs.includes(c)).length;
        if (matchCount > 0) {
          score *= (1 + (0.5 * matchCount)); // 50% boost per matching included tag
        }
      }

      // Relevancy Multiplier (Direct title matches are worth more than description matches)
      if (weave.name && weave.name.toLowerCase().includes(q.toLowerCase())) {
        score *= 1.5; 
      }

      return { ...weave, searchScore: score };
    });

    // Sort by final score and slice the top 20 best results
    scoredWeaves.sort((a, b) => b.searchScore - a.searchScore);
    const topGames = scoredWeaves.slice(0, 20);

    // 4. Search Users (Unchanged, sorted by popularity)
    const users = await User.find({
      $or: [
        { username: searchRegex },
        { userid: searchRegex }
      ]
    })
    .select("username userid profilePic verified followersCount")
    .sort({ followersCount: -1 })
    .limit(10)
    .lean();

    res.json({ games: topGames, users });

  } catch (err) {
    console.error("Global Search Error:", err);
    res.status(500).json({ message: "Failed to execute search" });
  }
});

/* ===== CONSOLE: SAVE GAME PROGRESS ===== */
app.post("/console/progress/:gameId", authMiddleware, async (req, res) => {
  try {
    const { mongoId } = req.user;
    const { gameId } = req.params;
    const { currentNodeIndex, currentSceneIndex, variables } = req.body;

    let userConsole = await ConsoleDB.findOne({ userId: mongoId });
    if (!userConsole) {
      userConsole = new ConsoleDB({ userId: mongoId, savedPosts: [], playStates: [] });
    }

    // Check if a save state already exists for this game
    const stateIndex = userConsole.playStates.findIndex(p => p.gameId.toString() === gameId);

    if (stateIndex !== -1) {
      // Overwrite existing save
      userConsole.playStates[stateIndex].currentNodeIndex = currentNodeIndex;
      userConsole.playStates[stateIndex].currentSceneIndex = currentSceneIndex;
      userConsole.playStates[stateIndex].variables = variables;
      userConsole.playStates[stateIndex].lastPlayed = new Date();
    } else {
      // Create new save
      userConsole.playStates.push({
        gameId,
        currentNodeIndex,
        currentSceneIndex,
        variables,
        lastPlayed: new Date()
      });
    }

    await userConsole.save();
    res.json({ success: true, message: "Progress saved" });

  } catch (err) {
    console.error("Save Progress Error:", err);
    res.status(500).json({ message: "Failed to save progress" });
  }
});

/* ===== CONSOLE: LOAD GAME PROGRESS ===== */
app.get("/console/progress/:gameId", authMiddleware, async (req, res) => {
  try {
    const { mongoId } = req.user;
    const { gameId } = req.params;

    const userConsole = await ConsoleDB.findOne({ userId: mongoId });
    if (!userConsole) return res.json(null);

    const playState = userConsole.playStates.find(p => p.gameId.toString() === gameId);
    
    // Returns null if no save file exists (meaning it's a new game)
    res.json(playState || null); 

  } catch (err) {
    console.error("Load Progress Error:", err);
    res.status(500).json({ message: "Failed to load progress" });
  }
});

app.get("/posts/:id/comments", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { mongoId } = req.user;

  try {
    const comments = await Comment.find({ postId: id })
      .populate("authorId", "username userid profilePic")
      .sort({ createdAt: -1 }); // Newest first

    // Map to attach like counts and boolean indicating if current user liked it
    const formattedComments = comments.map(c => {
      const isLiked = c.likes.some(likeId => likeId.toString() === mongoId);
      return {
        _id: c._id,
        content: c.content,
        author: c.authorId, // Contains username, userid, profilePic
        parentId: c.parentId,
        createdAt: c.createdAt,
        likeCount: c.likes.length,
        isLiked: isLiked
      };
    });

    res.json(formattedComments);
  } catch (err) {
    console.error("Fetch comments error:", err);
    res.status(500).json({ message: "Failed to fetch comments" });
  }
});

/* ===== POST A COMMENT OR REPLY ===== */
app.post("/posts/:id/comments", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { mongoId } = req.user;
  const { content, parentId } = req.body;

  if (!content || content.trim() === "") {
    return res.status(400).json({ message: "Comment cannot be empty" });
  }

  try {
    const newComment = new Comment({
      postId: id,
      authorId: mongoId,
      content,
      parentId: parentId || null
    });

    await newComment.save();

    // Populate author so frontend can display it immediately
    const populatedComment = await Comment.findById(newComment._id).populate("authorId", "username userid profilePic");

    res.json({
      success: true,
      comment: {
        _id: populatedComment._id,
        content: populatedComment.content,
        author: populatedComment.authorId,
        parentId: populatedComment.parentId,
        createdAt: populatedComment.createdAt,
        likeCount: 0,
        isLiked: false
      }
    });
  } catch (err) {
    console.error("Post comment error:", err);
    res.status(500).json({ message: "Failed to post comment" });
  }
});

/* ===== TOGGLE COMMENT LIKE ===== */
app.post("/comments/:commentId/like", authMiddleware, async (req, res) => {
  const { commentId } = req.params;
  const { mongoId } = req.user;

  try {
    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const hasLiked = comment.likes.includes(mongoId);

    if (hasLiked) {
      // Unlike
      await Comment.findByIdAndUpdate(commentId, { $pull: { likes: mongoId } });
      res.json({ isLiked: false, likeCount: comment.likes.length - 1 });
    } else {
      // Like
      await Comment.findByIdAndUpdate(commentId, { $push: { likes: mongoId } });
      res.json({ isLiked: true, likeCount: comment.likes.length + 1 });
    }
  } catch (err) {
    console.error("Like comment error:", err);
    res.status(500).json({ message: "Failed to like comment" });
  }
});

app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("🟢 MongoDB connected"))
  .catch(err => console.error("❌ Mongo error:", err))

app.listen(PORT, () =>
  
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
)