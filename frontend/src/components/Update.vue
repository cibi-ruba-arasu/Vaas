<script setup>
import { ref, onMounted, computed, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const projectId = route.params.id; // This is the Project ID
const token = sessionStorage.getItem("token");

const loading = ref(true);
const isUpdating = ref(false);
const fetchError = ref(null);

// --- FORM STATE ---
const form = ref({
  name: "",
  titleFont: "Cinzel",
  // ✅ RICH EDITOR STRUCTURE
  description: { 
    blocks: [], 
    container: { colors: ['#1e293b', '#0f172a'], angle: 135 } 
  },
  thumbnail: null,
  language: "en",
  categories: [],
  customCategories: [],
  warnings: [],
  isThumbnailNSFW: false,
  // ✅ MONETIZATION (Locked View)
  monetization: { isPaid: false, hasDemo: false, demoNodeLimit: 10, payoutCurrency: 'USD' },
  
  // ✅ THE CRITICAL TOGGLE
  updateCanvas: false 
});

// --- UI STATE ---
const showCustomCategoryInput = ref(false);
const newCustomCategory = ref("");
const activeBlockId = ref(null);
const blockRefs = ref({});

// --- CONSTANTS ---
const FONT_OPTIONS = [
  "Cinzel", "Playfair Display", "Inter", "Roboto", "Lato", "Montserrat", "Poppins", 
  "Oswald", "Bebas Neue", "Anton", "Dancing Script", "Pacifico", "Creepster", 
  "Nosifer", "Bangers", "Press Start 2P", "VT323"
];

const GENRES = [
  "Action", "Adventure", "RPG", "Strategy", "Simulation", 
    "Horror", "Romance", "Mystery", "Fantasy", "Sci-Fi", 
    "Slice of Life", "Comedy", "Drama", "Thriller", "Sports", 
    "Music", "Educational", "Puzzle", "Idle",

    // --- SUB-GENRES & SETTINGS ---
    "Cyberpunk", "Steampunk", "Dieselpunk", "Solarpunk",
    "Dystopian", "Post-Apocalyptic", "Space Opera", "Mecha",
    "Noir", "Neo-Noir", "Western", "Historical", "Alternate History",
    "Urban Fantasy", "Dark Fantasy", "High Fantasy", "Isekai",
    "Supernatural", "Paranormal", "Magic Realism", "Mythology", "Folklore",
    "Superhero", "Martial Arts", "Military", "War", "Espionage",

    // --- NARRATIVE STYLES ---
    "Visual Novel", "Interactive Fiction", "Kinetic Novel", 
    "Dating Sim", "Otome", "Galge", "Text-Based", "Point & Click",
    "Choice Matters", "Multiple Endings", "Episodic",

    // --- THEMES & MOODS ---
    "Psychological", "Philosophical", "Surreal", "Abstract",
    "Cozy", "Wholesome", "Relaxing", "Atmospheric", 
    "Tragedy", "Satire", "Parody", "Memes", "Dark Humor",
    "Coming of Age", "School Life", "Workplace", "Medical", "Legal", "Crime",
    "Detective", "Survival", "Battle Royale", "Time Travel",

    // --- MATURE & SPECIFIC ---
    "18+ (NSFW)", "Violence", "Gore", "Body Horror", 
    "LGBTQ+", "BL (Boys' Love)", "GL (Girls' Love)", "Harem",
    "Vampire", "Werewolf", "Zombies", "Lovecraftian", "Gothic"
];

const WARNING_OPTIONS = [
  "Sexual Content", "Graphic Violence", "Strong Language", "Substance Abuse", 
  "Self-Harm", "Nudity", "Flashing Lights", "Jump Scares", "Trauma / PTSD",
  "Suicide / Suicidal Ideation", "Sexual Assault / Non-Con", "Domestic Abuse", 
  "Child Abuse", "Animal Cruelty", "Gambling", "Eating Disorders", 
  "Body Dysmorphia", "Gaslighting", "Stalking", "Kidnapping / Abduction", 
  "Hate Speech / Discrimination", "Misogyny / Sexism", "Racism", 
  "Homophobia / Transphobia", "Religious Iconography / Cults",
  "Claustrophobia", "Arachnophobia (Spiders)", "Thalassophobia (Deep Water)", 
  "Trypophobia (Holes)", "Emetic / Vomiting", "Others"
];

// --- HELPERS ---
const getGradient = (colors, angle) => {
  if (!colors || colors.length === 0) return 'transparent';
  if (colors.length === 1) return colors[0];
  return `linear-gradient(${angle}deg, ${colors.join(', ')})`;
};

const containerStyle = computed(() => ({
  background: getGradient(form.value.description.container.colors, form.value.description.container.angle),
  padding: '30px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.1)',
  minHeight: '200px'
}));

const activeBlock = computed(() => 
  form.value.description.blocks.find(b => b.id === activeBlockId.value)
);

// --- ACTIONS: DESCRIPTION EDITOR ---
const addBlock = async () => {
  const id = Date.now();
  form.value.description.blocks.push({
    id, type: 'text', content: "", 
    isBold: false, isItalic: false, fontFamily: 'Inter', align: 'left', fontSize: 16, 
    textColors: ['#ffffff'], textAngle: 90, bgColors: ['transparent'], bgAngle: 90
  });
  activeBlockId.value = id;
  await nextTick();
  // Auto-focus new block
  if (blockRefs.value[id]) blockRefs.value[id].focus();
};

const removeBlock = (index) => {
  form.value.description.blocks.splice(index, 1);
  activeBlockId.value = null;
};

const addColor = (array) => { array.push('#3b82f6'); };
const removeColor = (array, index) => { if (array.length > 1) array.splice(index, 1); };

const autoResize = (el) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};

const checkContent = (block, event) => {
  if (event && event.target) autoResize(event.target);
  // Simple GIF detection
  const gifRegex = /^https?:\/\/.*\.(gif|webp|png|jpg|jpeg)($|\?)/i;
  block.type = gifRegex.test(block.content) ? 'gif' : 'text';
};

// --- ACTIONS: DATA FETCH (The "Before" State) ---
const fetchPublishedData = async () => {
  loading.value = true;
  try {
    // We fetch from the PUBLISH collection to see what is currently live
    // Note: Assuming /publish/project/:id fetches by projectId, otherwise use publishId logic
    const res = await fetch(`http://localhost:5000/publish/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      
      // Populate Form with LIVE data
      form.value.name = data.name;
      form.value.titleFont = data.titleFont || "Cinzel";
      form.value.language = data.language || "en";
      form.value.thumbnail = data.thumbnail;
      form.value.categories = data.categories || [];
      form.value.customCategories = data.customCategories || [];
      form.value.warnings = data.warnings || [];
      form.value.isThumbnailNSFW = data.isThumbnailNSFW || false;
      
      // Monetization (Locked - Reading Only)
      if (data.monetization) {
        form.value.monetization = data.monetization;
      }

      // Description Hydration (Handle Legacy String vs New Object)
      if (data.description && data.description.blocks) {
        form.value.description = data.description;
      } else {
        // Convert old string description to Block format
        form.value.description = {
          container: { colors: ['#1e293b', '#0f172a'], angle: 135 },
          blocks: typeof data.description === 'string' 
            ? [{ id: 1, type: 'text', content: data.description, fontSize: 16, textColors: ['#cbd5e1'], bgColors: ['transparent'], fontFamily: 'Inter', align: 'left' }]
            : []
        };
      }
    } else {
      fetchError.value = "This project hasn't been published yet. Please use the Publish page first.";
    }
  } catch (e) {
    fetchError.value = "Connection error loading published data.";
  } finally {
    loading.value = false;
  }
};

// --- ACTIONS: UPDATE ---
const handleUpdate = async () => {
  if (!form.value.name) return alert("Title is required");
  
  isUpdating.value = true;
  
  try {
    const payload = {
      id: projectId, // Identify the project
      ...form.value  // Send all form data including 'updateCanvas'
    };

    // We reuse the POST /publish endpoint which handles upserts (updating existing)
    const res = await fetch("http://localhost:5000/publish", { 
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    
    if (res.ok) {
      alert("✅ Update Successful!");
      router.push(`/post/${data.publishedAt ? projectId : ''}`); 
    } else {
      alert(data.message || "Update failed");
    }
  } catch (e) {
    alert("Server error during update");
  } finally {
    isUpdating.value = false;
  }
};

// --- TAG MANAGEMENT ---
const toggleSelection = (list, item) => {
  if (list.includes(item)) {
    const idx = list.indexOf(item);
    list.splice(idx, 1);
  } else {
    list.push(item);
  }
};

const addCustomCategory = () => {
  const val = newCustomCategory.value.trim();
  if (val && !form.value.customCategories.includes(val)) {
    form.value.customCategories.push(val);
  }
  newCustomCategory.value = "";
  showCustomCategoryInput.value = false;
};

onMounted(() => {
  if (!token) router.push("/login");
  else fetchPublishedData();
});
</script>

<template>
  <div class="update-page">
    <div class="bg-orb"></div>

    <div v-if="loading" class="center-msg"><div class="spinner"></div></div>
    <div v-else-if="fetchError" class="center-msg error">
      <h2>⚠️</h2>
      <p>{{ fetchError }}</p>
      <button @click="router.back()" class="btn outline-btn">Go Back</button>
    </div>

    <div v-else class="content-wrapper">
      
      <header class="page-header glass-panel">
        <div class="header-top">
          <button @click="router.back()" class="back-btn">← Cancel Update</button>
          
          <div class="monetization-badge" :class="{ paid: form.monetization.isPaid }">
            {{ form.monetization.isPaid ? 'PAID PRODUCT' : 'FREE PRODUCT' }}
            <span class="lock-icon">🔒</span>
            <span class="tooltip">Monetization status cannot be changed after release.</span>
          </div>
        </div>
        
        <div class="title-group">
          <label>Project Title</label>
          <div class="title-row">
            <input 
              v-model="form.name" 
              class="title-input" 
              :style="{ fontFamily: form.titleFont }" 
              placeholder="Enter Title..."
            />
            <select v-model="form.titleFont" class="font-select">
              <option v-for="font in FONT_OPTIONS" :key="font" :value="font" :style="{ fontFamily: font }">{{ font }}</option>
            </select>
          </div>
        </div>
      </header>

      <div class="main-grid">
        
        <div class="meta-col">
          
          <div class="toggle-card glass-panel highlight">
            <div class="toggle-header">
              <h3>Game Content Update</h3>
              <label class="switch">
                <input type="checkbox" v-model="form.updateCanvas">
                <span class="slider round"></span>
              </label>
            </div>
            
            <div class="toggle-info">
              <p v-if="form.updateCanvas" class="toggle-desc warning">
                ⚠️ <b>ENABLED: Overwrite Mode</b><br>
                The public version will be replaced by the current state of your Canvas Editor. Players will see new scenes immediately.
              </p>
              <p v-else class="toggle-desc safe">
                🛡️ <b>DISABLED: Metadata Only</b><br>
                Only the description, title, tags, and thumbnail will be updated. The game content (nodes/scenes) remains unchanged.
              </p>
            </div>
          </div>

          <div class="meta-card glass-panel">
            <h3>Genres</h3>
            <div class="tags-cloud">
              <button 
                v-for="g in GENRES" :key="g" 
                class="tag-btn" 
                :class="{ active: form.categories.includes(g) }"
                @click="toggleSelection(form.categories, g)"
              >{{ g }}</button>
            </div>
          </div>

          <div class="meta-card glass-panel">
            <h3>Custom Tags</h3>
            <div class="tags-cloud">
              <span v-for="(tag, idx) in form.customCategories" :key="tag" class="custom-tag">
                #{{ tag }} <button @click="form.customCategories.splice(idx, 1)">×</button>
              </span>
              <button v-if="!showCustomCategoryInput" @click="showCustomCategoryInput = true" class="add-tag-btn">+ Add</button>
              <input 
                v-else 
                v-model="newCustomCategory" 
                @keyup.enter="addCustomCategory"
                @blur="addCustomCategory"
                class="mini-input"
                placeholder="Type & Enter"
                autoFocus
              />
            </div>
          </div>

          <div class="meta-card glass-panel">
            <h3>Content Warnings</h3>
            <div class="tags-cloud">
              <button 
                v-for="w in WARNING_OPTIONS" :key="w" 
                class="tag-btn warning" 
                :class="{ active: form.warnings.includes(w) }"
                @click="toggleSelection(form.warnings, w)"
              >{{ w }}</button>
            </div>
            <div class="nsfw-row">
              <input type="checkbox" id="nsfw" v-model="form.isThumbnailNSFW" />
              <label for="nsfw">Thumbnail contains NSFW content?</label>
            </div>
          </div>

        </div>

        <div class="desc-col">
          
          <div class="editor-toolbar glass-panel">
            <span>Background Style:</span>
            <div class="color-group">
              <div v-for="(c, i) in form.description.container.colors" :key="i" class="mini-color">
                <input type="color" v-model="form.description.container.colors[i]" />
                <span v-if="form.description.container.colors.length > 1" @click="removeColor(form.description.container.colors, i)" class="del">×</span>
              </div>
              <button @click="addColor(form.description.container.colors)">+</button>
            </div>
            <input type="range" v-model="form.description.container.angle" min="0" max="360" class="angle-slider" title="Gradient Angle"/>
          </div>

          <div v-if="activeBlock && activeBlock.type !== 'gif'" class="block-tools glass-panel">
             <div class="tool-row">
               <select v-model="activeBlock.fontFamily" class="mini-select font">
                 <option v-for="f in FONT_OPTIONS" :key="f" :value="f">{{ f }}</option>
               </select>
               <input type="number" v-model="activeBlock.fontSize" class="mini-input size" placeholder="Size" />
             </div>
             
             <div class="tool-row">
               <div class="color-group">
                 <span class="lbl">Text:</span>
                 <div v-for="(c, i) in activeBlock.textColors" :key="'t'+i" class="mini-color">
                   <input type="color" v-model="activeBlock.textColors[i]" />
                   <span v-if="activeBlock.textColors.length > 1" @click="removeColor(activeBlock.textColors, i)" class="del">×</span>
                 </div>
                 <button @click="addColor(activeBlock.textColors)">+</button>
               </div>
             </div>

             <div class="tool-row">
               <button :class="{active: activeBlock.isBold}" @click="activeBlock.isBold = !activeBlock.isBold"><b>B</b></button>
               <button :class="{active: activeBlock.isItalic}" @click="activeBlock.isItalic = !activeBlock.isItalic"><i>I</i></button>
               <div class="sep"></div>
               <button :class="{active: activeBlock.align === 'left'}" @click="activeBlock.align = 'left'">⇠</button>
               <button :class="{active: activeBlock.align === 'center'}" @click="activeBlock.align = 'center'">⇿</button>
               <button :class="{active: activeBlock.align === 'right'}" @click="activeBlock.align = 'right'">⇢</button>
             </div>
          </div>

          <div class="desc-canvas" :style="containerStyle" @click.self="activeBlockId = null">
            <div 
              v-for="(block, index) in form.description.blocks" 
              :key="block.id" 
              class="desc-block"
              :class="{ active: activeBlockId === block.id }"
              @click="activeBlockId = block.id"
              :style="{
                textAlign: block.align,
                background: getGradient(block.bgColors, block.bgAngle),
                padding: '10px', borderRadius: '4px'
              }"
            >
              <div class="block-actions">
                <button @click.stop="removeBlock(index)" class="delete-btn">×</button>
              </div>
              
              <div v-if="block.type === 'gif'" class="gif-wrapper">
                 <img :src="block.content" />
                 <button class="edit-link-btn" @click.stop="block.type='text'">Edit Link</button>
              </div>

              <textarea 
                v-else
                :ref="el => blockRefs[block.id] = el"
                v-model="block.content"
                @input="checkContent(block, $event)"
                class="block-input"
                rows="1"
                placeholder="Type here..."
                :style="{
                  fontFamily: block.fontFamily,
                  fontSize: block.fontSize + 'px',
                  fontWeight: block.isBold ? 'bold' : 'normal',
                  fontStyle: block.isItalic ? 'italic' : 'normal',
                  color: block.textColors.length > 1 ? 'transparent' : block.textColors[0],
                  backgroundImage: block.textColors.length > 1 ? getGradient(block.textColors, block.textAngle) : 'none',
                  webkitBackgroundClip: block.textColors.length > 1 ? 'text' : 'unset',
                  backgroundClip: block.textColors.length > 1 ? 'text' : 'unset'
                }"
              ></textarea>
            </div>

            <button class="add-block-btn" @click="addBlock">+ Add Content Block</button>
          </div>

          <button class="update-btn" @click="handleUpdate" :disabled="isUpdating">
            {{ isUpdating ? 'Processing Update...' : '🚀 Push Update Live' }}
          </button>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;600&display=swap');

* { box-sizing: border-box; }

.update-page { min-height: 100vh; background-color: #020617; color: #f0f0f0; font-family: 'Inter', sans-serif; padding-bottom: 50px; position: relative; }
.bg-orb { position: absolute; width: 60vw; height: 60vw; background: radial-gradient(circle, #3b82f6 0%, transparent 70%); opacity: 0.1; top: -10%; left: -10%; pointer-events: none; filter: blur(80px); }

.center-msg { height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; color: #94a3b8; gap: 10px; }
.spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.content-wrapper { max-width: 1200px; margin: 0 auto; padding: 2rem; position: relative; z-index: 2; }
.glass-panel { background: rgba(30, 41, 59, 0.5); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; }

/* HEADER */
.page-header { padding: 20px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 15px; }
.header-top { display: flex; justify-content: space-between; align-items: center; }
.back-btn { background: transparent; border: none; color: #94a3b8; cursor: pointer; transition: 0.2s; }
.back-btn:hover { color: white; transform: translateX(-5px); }

.monetization-badge { position: relative; padding: 6px 16px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; display: flex; align-items: center; gap: 8px; background: #334155; color: #94a3b8; cursor: help; }
.monetization-badge.paid { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
.lock-icon { font-size: 0.9rem; opacity: 0.7; }
.tooltip { visibility: hidden; width: 200px; background-color: #0f172a; color: #fff; text-align: center; border-radius: 6px; padding: 8px; position: absolute; z-index: 1; top: 120%; right: 0; opacity: 0; transition: opacity 0.3s; border: 1px solid rgba(255,255,255,0.1); font-weight: 400; font-size: 0.75rem; }
.monetization-badge:hover .tooltip { visibility: visible; opacity: 1; }

.title-group { display: flex; flex-direction: column; gap: 5px; }
.title-group label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
.title-row { display: flex; gap: 10px; align-items: flex-end; }
.title-input { flex: 1; background: transparent; border: none; font-size: 2rem; color: white; outline: none; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 5px; transition: 0.3s; }
.title-input:focus { border-color: #3b82f6; }
.font-select { align-self: flex-end; background: #1e293b; color: #cbd5e1; border: 1px solid #334155; padding: 8px; border-radius: 8px; font-size: 0.9rem; cursor: pointer; outline: none; }

/* GRID LAYOUT */
.main-grid { display: grid; grid-template-columns: 350px 1fr; gap: 25px; }

/* TOGGLE CARD */
.toggle-card { padding: 25px; border-left: 4px solid #64748b; transition: 0.3s; }
.toggle-card.highlight:has(input:checked) { border-color: #f59e0b; background: rgba(245, 158, 11, 0.05); }

.toggle-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.toggle-header h3 { margin: 0; font-size: 1.1rem; color: #e2e8f0; }

.toggle-desc { font-size: 0.9rem; line-height: 1.5; margin: 0; }
.toggle-desc.warning { color: #fbbf24; }
.toggle-desc.safe { color: #94a3b8; }

/* SWITCH */
.switch { position: relative; display: inline-block; width: 46px; height: 24px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #334155; transition: .4s; border-radius: 24px; }
.slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
input:checked + .slider { background-color: #f59e0b; }
input:checked + .slider:before { transform: translateX(22px); }

/* META CARDS */
.meta-card { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
.meta-card h3 { margin: 0; font-size: 0.9rem; color: #94a3b8; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 5px; }

.tags-cloud { display: flex; flex-wrap: wrap; gap: 8px; }
.tag-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: 0.2s; font-size: 0.8rem; }
.tag-btn:hover { border-color: #3b82f6; color: white; }
.tag-btn.active { background: #3b82f6; color: white; border-color: #3b82f6; }
.tag-btn.warning.active { background: #ef4444; border-color: #ef4444; }

.custom-tag { background: rgba(168, 85, 247, 0.15); color: #d8b4fe; border: 1px solid rgba(168, 85, 247, 0.3); padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; display: flex; align-items: center; gap: 6px; }
.custom-tag button { background: none; border: none; color: #d8b4fe; cursor: pointer; font-weight: bold; font-size: 1rem; line-height: 1; opacity: 0.7; }
.custom-tag button:hover { opacity: 1; color: white; }
.add-tag-btn { background: none; border: 1px dashed #64748b; color: #64748b; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: 0.2s; }
.add-tag-btn:hover { border-color: #3b82f6; color: #3b82f6; }
.mini-input { background: #0f172a; border: 1px solid #3b82f6; color: white; padding: 6px 10px; border-radius: 6px; width: 100px; font-size: 0.8rem; outline: none; }

.nsfw-row { display: flex; align-items: center; gap: 10px; font-size: 0.85rem; color: #fca5a5; margin-top: 5px; }

/* DESCRIPTION EDITOR COL */
.desc-col { display: flex; flex-direction: column; gap: 15px; }

.editor-toolbar { padding: 12px 20px; display: flex; align-items: center; gap: 15px; font-size: 0.9rem; color: #94a3b8; flex-wrap: wrap; }
.color-group { display: flex; align-items: center; gap: 6px; }
.mini-color { position: relative; width: 28px; height: 28px; }
.mini-color input { width: 100%; height: 100%; border: none; padding: 0; background: none; cursor: pointer; border-radius: 50%; overflow: hidden; border: 2px solid rgba(255,255,255,0.2); }
.del { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; border-radius: 50%; width: 14px; height: 14px; font-size: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.5); }
.angle-slider { width: 100px; }

.block-tools { padding: 10px 20px; display: flex; gap: 15px; align-items: center; flex-wrap: wrap; border-left: 3px solid #3b82f6; }
.tool-row { display: flex; align-items: center; gap: 10px; }
.mini-select.font { width: 120px; padding: 5px; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 4px; }
.mini-input.size { width: 60px; padding: 5px; text-align: center; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 4px; }
.lbl { font-size: 0.8rem; font-weight: 700; color: #cbd5e1; }
.sep { width: 1px; height: 20px; background: rgba(255,255,255,0.1); margin: 0 5px; }

.format-btns button { width: 30px; height: 30px; background: #1e293b; border: 1px solid #334155; color: #cbd5e1; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
.format-btns button:hover { background: rgba(59,130,246,0.2); }
.format-btns button.active { background: #3b82f6; color: white; border-color: #3b82f6; }

.desc-canvas { min-height: 400px; padding: 30px; display: flex; flex-direction: column; gap: 15px; }
.desc-block { position: relative; transition: 0.2s; border: 1px dashed transparent; }
.desc-block:hover { border-color: rgba(255,255,255,0.1); }
.desc-block.active { border-color: #3b82f6; box-shadow: 0 0 0 1px rgba(59,130,246,0.3); z-index: 5; }

.block-actions { position: absolute; top: -10px; right: -10px; display: none; z-index: 10; }
.desc-block:hover .block-actions { display: block; }
.delete-btn { background: #ef4444; color: white; border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; }

.block-input { width: 100%; background: transparent; border: none; resize: none; overflow: hidden; outline: none; padding: 5px; margin: 0; display: block; min-height: 1.5em; }

.gif-wrapper { width: 100%; display: flex; justify-content: center; position: relative; }
.gif-wrapper img { max-width: 100%; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
.edit-link-btn { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; backdrop-filter: blur(4px); }

.add-block-btn { width: 100%; padding: 15px; border: 1px dashed #334155; background: rgba(0,0,0,0.1); color: #64748b; border-radius: 8px; cursor: pointer; transition: 0.2s; font-weight: 600; margin-top: 20px; }
.add-block-btn:hover { border-color: #3b82f6; color: #3b82f6; background: rgba(59, 130, 246, 0.05); }

.update-btn { margin-top: 20px; padding: 16px; background: linear-gradient(135deg, #3b82f6, #a855f7); color: white; border: none; border-radius: 12px; font-weight: 700; font-size: 1.1rem; cursor: pointer; transition: 0.2s; box-shadow: 0 10px 25px rgba(59, 130, 246, 0.4); }
.update-btn:hover { transform: translateY(-2px); box-shadow: 0 15px 30px rgba(59, 130, 246, 0.6); }
.update-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; filter: grayscale(0.8); }

@media (max-width: 900px) {
  .main-grid { grid-template-columns: 1fr; }
  .toggle-card { order: -1; } /* Keep toggle at top on mobile */
}
</style>