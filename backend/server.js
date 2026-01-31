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
import Post from "./schema/Post.js"; // Import the new Schema

dotenv.config()

const app = express()
const PORT = 5000

app.use(cors())
app.use(express.json({ limit: '200mb' })); 
app.use(express.urlencoded({ limit: '200mb', extended: true }));

const TARGET_LANGUAGES = [
    'en', 'es', 'fr', 'de', 'zh-cn', 'ja', 'ko', 'ru', 'pt', 'hi'
];

const limit = pLimit(5); 

/* ===== GOOGLE CLOUD STORAGE SETUP ===== */
const storage = new Storage({
  keyFilename: "gcs-key.json", // Ensure this file is in your backend root
  projectId: "weaver-storage-bucket-1", // REPLACE THIS
});
const bucketName = "loomart-media-storage"; // REPLACE THIS (e.g. loomart-media-storage)
const bucket = storage.bucket(bucketName);

const deleteFolderContent = async (prefix) => {
  try {
    // Get all files starting with this prefix (folder path)
    const [files] = await bucket.getFiles({ prefix });
    
    if (files.length > 0) {
      console.log(`🗑️ Deleting ${files.length} old files in: ${prefix}`);
      await Promise.all(files.map(file => file.delete()));
    }
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
    console.log(`[GCS] Uploading: ${fullFileName} (${contentType})`);
    await file.save(buffer, {
      metadata: { contentType },
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

/* ===== HELPER: RECURSIVE MEDIA PROCESSOR ===== */
const processProjectAssets = async (nodes, userId, projectId) => {
  const usedFilePaths = new Set();
  const projectFolder = `users/${userId}/projects/${projectId}`;

  // Helper to process a single component/asset
  const processAsset = async (dataUrl, namePrefix) => {
    if (!dataUrl || !dataUrl.startsWith("data:")) return null;
    
    const result = await uploadToGCS(dataUrl, projectFolder, namePrefix);
    if (result) {
      usedFilePaths.add(result.path);
      return result.url;
    }
    return null; // Keep original if upload fails
  };

  // Helper to track existing GCS URLs
  const trackExistingUrl = (url) => {
    if (url && url.includes(bucketName)) {
      const urlParts = url.split(`${bucketName}/`);
      if (urlParts[1]) usedFilePaths.add(urlParts[1]);
    }
  };

  // 1. Iterate Nodes
  for (const node of nodes) {
    
    // --- A. Process Node Audio ---
    if (node.audio && node.audio.url) {
      if (node.audio.url.startsWith("data:")) {
        console.log(`[Audio] Found new audio for Node ${node.index}`);
        const newUrl = await processAsset(node.audio.url, "audio");
        if (newUrl) node.audio.url = newUrl; // Only update on success
      } else {
        trackExistingUrl(node.audio.url);
      }
    }

    // --- B. Process Scenes & Components ---
    if (node.scenes) {
      for (const scene of node.scenes) {
        if (scene.components) {
          for (const comp of scene.components) {
            
            if (comp.type === "image" || comp.type === "video") {
              if (comp.url && comp.url.startsWith("data:")) {
                const safeName = comp.name ? comp.name.replace(/[^a-z0-9]/gi, '_') : 'asset';
                const newUrl = await processAsset(comp.url, safeName);
                if (newUrl) comp.url = newUrl;
              } else {
                trackExistingUrl(comp.url);
              }
            }
            
          }
        }
      }
    }
  }

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
    return res.json({ themeColor: "#808080" }) // default grey
  }

  res.json({ themeColor: pref.themeColor })
})

app.post("/user/theme", authMiddleware, async (req, res) => {
  const { mongoId } = req.user
  const { color } = req.body

  let pref = await UserPreference.findOne({ userId: mongoId })

  if (!pref) {
    pref = new UserPreference({
      userId: mongoId,
      themeColor: color
    })
  } else {
    pref.themeColor = color
  }

  await pref.save()
  res.json({ success: true })
})

app.get("/user/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.mongoId).select(
      "username dob country state city"
    )

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({
      username: user.username,
      dob: user.dob,
      country: user.country,
      state: user.state,
      city: user.city
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server error" })
  }
})

app.get("/projects", authMiddleware, async (req, res) => {
  const { mongoId } = req.user

  const bucket = await Project.findOne({ userId: mongoId })

  if (!bucket) return res.json([])

  // Convert Mongoose Docs to plain JS objects
  const projectsRaw = bucket.projects.toObject();

  // Fetch stats for each project from the CanvasState collection
  const projectsWithStats = await Promise.all(projectsRaw.map(async (p) => {
      const state = await CanvasState.findOne({ projectId: p._id });
      
      let stats = {
          disconnected: 0,
          hasGeneralNode: false,
          totalNodes: 0
      };

      if (state) {
          stats.disconnected = state.disconnectedOptionsCount || 0;
          // Check if at least one node is of type 'General' (Visual Scene)
          stats.hasGeneralNode = state.nodes ? state.nodes.some(n => n.node_type === 'General') : false;
      }

      return {
          ...p,
          stats // Attach stats to the project object
      };
  }));

  // Sort: oldest → newest
  const sorted = projectsWithStats.sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  )

  res.json(sorted)
})

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
  const { name, description, thumbnail } = req.body

  const bucket = await Project.findOne({ userId: mongoId })
  if (!bucket) return res.status(404).json({ message: "Bucket not found" })

  const project = bucket.projects.id(req.params.id)
  if (!project) return res.status(404).json({ message: "Project not found" })

  // Path: users -> specific user -> projects -> specific project -> thumbnail folder
  const thumbnailFolder = `users/${mongoId}/projects/${project._id}/thumbnail`;
  
  let skippedUpload = false; 

  // --- LOGIC START ---

  // 1. User selected "Aura" (Gradient CSS String)
  if (thumbnail && thumbnail.startsWith("linear-gradient")) {
      console.log("🎨 Saving gradient aura...");
      await deleteFolderContent(thumbnailFolder); // Remove old images
      project.thumbnail = thumbnail;
  }
  
  // 2. User selected "Sigil" (Image Base64)
  else if (thumbnail && thumbnail.startsWith("data:")) {
      
      const splitIndex = thumbnail.indexOf(';base64,');
      if (splitIndex !== -1) {
          const rawBase64 = thumbnail.substring(splitIndex + 8);
          const buffer = Buffer.from(rawBase64, "base64");
          
          // A. Calculate Hash
          const hash = crypto.createHash("md5").update(buffer).digest("hex");
          const contentType = thumbnail.substring(5, splitIndex);
          const ext = getExtension(contentType);
          
          // B. Construct Expected Filename
          const expectedFileName = `cover_${hash}.${ext}`;
          const fullPath = `${thumbnailFolder}/${expectedFileName}`;

          // C. Check if this EXACT file exists in Cloud Storage
          const file = storage.bucket(bucketName).file(fullPath);
          const [exists] = await file.exists();

          if (exists) {
              // D. DUPLICATE FOUND - Do NOT delete old files, Do NOT upload
              console.log(`[GCS] Same image detected. Skipping upload.`);
              skippedUpload = true; 
              
              // Ensure DB has the correct URL
              project.thumbnail = `https://storage.googleapis.com/${bucketName}/${fullPath}`;
          } else {
              // E. NEW IMAGE - Safe to delete old folder content and upload new
              console.log("📸 New Sigil detected. Replacing old...");
              await deleteFolderContent(thumbnailFolder); 
              
              const uploadResult = await uploadToGCS(thumbnail, thumbnailFolder, "cover");
              if (uploadResult) project.thumbnail = uploadResult.url;
          }
      }
  }
  // 3. Keep Existing (If user didn't change anything, thumbnail is just a URL string)
  else if (thumbnail && thumbnail.startsWith("http")) {
      project.thumbnail = thumbnail;
  }
  // 4. Removed completely
  else if (thumbnail === null) {
      await deleteFolderContent(thumbnailFolder);
      project.thumbnail = undefined;
  }

  // Update Metadata
  project.name = name
  project.description = description
  project.updatedAt = new Date()

  await bucket.save()
  
  // Return the flag so Frontend can show the warning
  res.json({ project, skippedUpload })
})

app.delete("/projects/:id", authMiddleware, async (req, res) => {
  const { mongoId } = req.user

  const bucket = await Project.findOne({ userId: mongoId })

  if (!bucket) {
    return res.status(404).json({ message: "Project not found" })
  }

  const project = bucket.projects.id(req.params.id)

  if (!project) {
    return res.status(404).json({ message: "Project not found" })
  }

  project.deleteOne()
  await bucket.save()

  res.json({ success: true })
})

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

  try {
    const bucket = await Project.findOne({ userId: mongoId });
    if (!bucket) return res.status(404).json({ message: "User projects not found" });

    const project = bucket.projects.id(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    res.json(project);
  } catch (err) {
    res.status(500).json({ message: "Error fetching project details" });
  }
});

app.get("/user/me", authMiddleware, async (req, res) => {
  try {
    // req.user.mongoId is populated by your authMiddleware
    const user = await User.findById(req.user.mongoId).select("email username country");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("User fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("🟢 MongoDB connected"))
  .catch(err => console.error("❌ Mongo error:", err))

app.listen(PORT, () =>
  
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
)
