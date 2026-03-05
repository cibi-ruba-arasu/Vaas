<script setup>
import { ref, onMounted, computed, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { API_URL } from '../config.js';
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
  monetization: { isPaid: false, hasDemo: false, demoNodeLimit: 10, payoutCurrency: 'USD' },
  
  // ✅ THE CRITICAL TOGGLE
  updateCanvas: false 
});

// --- UI STATE ---
const showCustomCategoryInput = ref(false);
const newCustomCategory = ref("");
const activeBlockId = ref(null);
const blockRefs = ref({});

// --- DEMO / CANVAS STATE ---
const canvasState = ref(null);
const maxDemoLimit = ref(0);

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

    "Cyberpunk", "Steampunk", "Dieselpunk", "Solarpunk",
    "Dystopian", "Post-Apocalyptic", "Space Opera", "Mecha",
    "Noir", "Neo-Noir", "Western", "Historical", "Alternate History",
    "Urban Fantasy", "Dark Fantasy", "High Fantasy", "Isekai",
    "Supernatural", "Paranormal", "Magic Realism", "Mythology", "Folklore",
    "Superhero", "Martial Arts", "Military", "War", "Espionage",

    "Visual Novel", "Interactive Fiction", "Kinetic Novel", 
    "Dating Sim", "Otome", "Galge", "Text-Based", "Point & Click",
    "Choice Matters", "Multiple Endings", "Episodic",

    "Psychological", "Philosophical", "Surreal", "Abstract",
    "Cozy", "Wholesome", "Relaxing", "Atmospheric", 
    "Tragedy", "Satire", "Parody", "Memes", "Dark Humor",
    "Coming of Age", "School Life", "Workplace", "Medical", "Legal", "Crime",
    "Detective", "Survival", "Battle Royale", "Time Travel",

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

// --- ALGORITHMS ---

// Function to calculate max height through General nodes only
const calculateMaxDemoNodes = (state) => {
  if (!state || !state.nodes || !Array.isArray(state.nodes)) return 0;

  const nodes = state.nodes;
  const rootNodeId = state.rootNodeId;
  
  if (rootNodeId === undefined || rootNodeId === null) return 0;

  const isGeneralNode = (node) => {
    if (!node) return false;
    const typeStr = String(node.node_type || node.Node_type || node.type || node.name || node.Node_name || "").toLowerCase();
    return typeStr === 'general';
  };

  const generalNodes = new Set();
  const adjacencyMap = new Map(); 
  
  nodes.forEach(node => {
    if (isGeneralNode(node)) {
      generalNodes.add(node.index);
      adjacencyMap.set(node.index, new Set());
    }
  });

  if (generalNodes.size === 0) return 0;

  nodes.forEach(node => {
    if (!isGeneralNode(node)) return; 

    const targets = [];
    if (node.Next !== null && node.Next !== undefined) targets.push(node.Next);
    if (node.NextTrue !== null && node.NextTrue !== undefined) targets.push(node.NextTrue);
    if (node.NextFalse !== null && node.NextFalse !== undefined) targets.push(node.NextFalse);
    
    if (node.options && Array.isArray(node.options)) {
      node.options.forEach(opt => {
        if (opt.next !== null && opt.next !== undefined) targets.push(opt.next);
      });
    }

    const currentNodeAdj = adjacencyMap.get(node.index) || new Set();
    targets.forEach(targetIndex => {
      if (generalNodes.has(targetIndex)) currentNodeAdj.add(targetIndex);
    });
    adjacencyMap.set(node.index, currentNodeAdj);
  });

  const memo = new Map(); 

  const dfs = (nodeIndex, visited = new Set()) => {
    if (!generalNodes.has(nodeIndex)) return 0;
    if (memo.has(nodeIndex)) return memo.get(nodeIndex);
    if (visited.has(nodeIndex)) return 0;
    
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
  return Math.max(1, maxHeight - 1);
};


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

// --- FORM VALIDATION ---
const isFormValid = computed(() => {
  if (!form.value.name || form.value.name.trim() === "") return false;
  
  // Demo limit validation
  if (form.value.monetization.isPaid && form.value.monetization.hasDemo) {
    if (form.value.monetization.demoNodeLimit < 1) return false;
    if (maxDemoLimit.value > 0 && form.value.monetization.demoNodeLimit > maxDemoLimit.value) {
      return false;
    }
  }
  
  return true;
});

const handleFileChange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) return alert("File too large (Max 5MB)");
  
  const reader = new FileReader();
  reader.onload = (event) => {
    form.value.thumbnail = event.target.result;
  }
  reader.readAsDataURL(file);
};

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
  const gifRegex = /^https?:\/\/.*\.(gif|webp|png|jpg|jpeg)($|\?)/i;
  block.type = gifRegex.test(block.content) ? 'gif' : 'text';
};

// --- ACTIONS: DATA FETCH ---
const fetchPublishedData = async () => {
  loading.value = true;
  try {
    const res = await fetch(`${API_URL}publish/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      
      form.value.name = data.name;
      form.value.titleFont = data.titleFont || "Cinzel";
      form.value.language = data.language || "en";
      form.value.thumbnail = data.thumbnail;
      form.value.categories = data.categories || [];
      form.value.customCategories = data.customCategories || [];
      form.value.warnings = data.warnings || [];
      form.value.isThumbnailNSFW = data.isThumbnailNSFW || false;
      
      if (data.monetization) form.value.monetization = data.monetization;

      if (data.description) {
        if (data.description.blocks && Array.isArray(data.description.blocks)) {
            form.value.description = data.description;
        } else if (Array.isArray(data.description)) {
            form.value.description = {
                container: { colors: ['#1e293b', '#0f172a'], angle: 135 },
                blocks: data.description
            };
        } else if (typeof data.description === 'string') {
            form.value.description = {
                container: { colors: ['#1e293b', '#0f172a'], angle: 135 },
                blocks: [{ id: 1, type: 'text', content: data.description, fontSize: 16, textColors: ['#cbd5e1'], bgColors: ['transparent'], fontFamily: 'Inter', align: 'left' }]
            };
        }
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

const fetchCanvasState = async () => {
  try {
    const res = await fetch(`${API_URL}canvas/load/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      canvasState.value = await res.json();
      maxDemoLimit.value = calculateMaxDemoNodes(canvasState.value);
      
      // Auto-correct if existing limit violates the calculated max
      if (form.value.monetization.hasDemo && form.value.monetization.demoNodeLimit > maxDemoLimit.value) {
        form.value.monetization.demoNodeLimit = maxDemoLimit.value;
      }
    }
  } catch (e) {
    console.error("Failed to fetch canvas state", e);
  }
};

// --- ACTIONS: UPDATE ---
const handleUpdate = async () => {
  if (!isFormValid.value) return;
  
  isUpdating.value = true;
  
  try {
    const payload = {
      id: projectId,
      ...form.value 
    };

    const res = await fetch("${API_URL}publish", { 
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    
    if (res.ok) {
      alert(form.value.updateCanvas ? "✅ Project & Content Updated!" : "✅ Metadata Updated Successfully!");
      router.push('/profile'); 
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
  if (!token) {
    router.push("/login");
  } else {
    fetchPublishedData().then(() => {
      fetchCanvasState();
    });
  }
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
        <div class="thumbnail-section">
            <label>Cover Image</label>
            <div class="thumbnail-editor" :style="{ backgroundImage: form.thumbnail ? `url(${form.thumbnail})` : 'linear-gradient(to bottom right, #000, #1e3a8a)' }">
                <div class="overlay">
                    <label class="change-btn">
                        <span>Change Cover</span>
                        <input type="file" @change="handleFileChange" accept="image/*" hidden />
                    </label>
                </div>
                <div v-if="form.isThumbnailNSFW" class="nsfw-overlay-badge">NSFW</div>
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

          <div class="meta-card glass-panel" v-if="form.monetization.isPaid">
            <h3>Demo Settings</h3>
            <div class="toggle-header" style="margin-bottom: 0;">
              <span style="font-size: 0.9rem; color: #cbd5e1;">Enable Free Demo?</span>
              <label class="switch">
                <input type="checkbox" v-model="form.monetization.hasDemo">
                <span class="slider round"></span>
              </label>
            </div>
            
            <div v-if="form.monetization.hasDemo" class="demo-limit-row" style="margin-top:15px; display: flex; flex-direction: column; gap: 5px;">
              <label style="font-size:0.8rem; color:#94a3b8; text-transform: uppercase;">Demo Limit (Nodes)</label>
              <div class="number-input-wrap" style="display:flex; align-items:center; gap:10px;">
                <input
                  type="number"
                  v-model="form.monetization.demoNodeLimit"
                  class="mini-input demo-input"
                  min="1"
                  :max="maxDemoLimit"
                />
                <span style="font-size:0.75rem; color:#64748b;">
                  Max allowed: {{ maxDemoLimit }}
                </span>
              </div>
              <div v-if="form.monetization.demoNodeLimit > maxDemoLimit && maxDemoLimit > 0" style="color:#ef4444; font-size:0.75rem; margin-top:5px; background: rgba(239,68,68,0.1); padding: 5px 10px; border-radius: 4px; border-left: 2px solid #ef4444;">
                ⚠️ Limit cannot exceed {{ maxDemoLimit }}
              </div>
            </div>
          </div>

        </div>

        <div class="desc-col">
          
          <div class="desc-box-container">
            <div class="desc-header">
              <span class="header-label">Canvas Background</span>
              <div class="gradient-controls">
                <div v-for="(color, idx) in form.description.container.colors" :key="idx" class="color-wrap">
                  <input type="color" v-model="form.description.container.colors[idx]" />
                  <button v-if="form.description.container.colors.length > 1" @click="removeColor(form.description.container.colors, idx)" class="tiny-del">×</button>
                </div>
                <button class="add-color-btn" @click="addColor(form.description.container.colors)">+</button>
                <div class="angle-slider-wrap">
                  <label>Angle</label>
                  <input type="range" v-model="form.description.container.angle" min="0" max="360" />
                </div>
              </div>
            </div>

            <div class="desc-toolbar" v-if="activeBlock && activeBlock.type !== 'gif'">
              <div class="toolbar-section">
                <label>Text Color</label>
                <div class="gradient-controls small">
                  <div v-for="(c, i) in activeBlock.textColors" :key="'t'+i" class="color-wrap">
                     <input type="color" v-model="activeBlock.textColors[i]" />
                     <button v-if="activeBlock.textColors.length > 1" @click="removeColor(activeBlock.textColors, i)" class="tiny-del">×</button>
                  </div>
                  <button class="add-color-btn" @click="addColor(activeBlock.textColors)">+</button>
                  <input type="range" v-model="activeBlock.textAngle" min="0" max="360" title="Angle" class="mini-slider" />
                </div>
              </div>
              
              <div class="vertical-sep"></div>

              <div class="toolbar-section">
                <label>Font Style</label>
                <select v-model="activeBlock.fontFamily" class="font-select mini">
                   <option v-for="f in FONT_OPTIONS" :key="f" :value="f" :style="{ fontFamily: f }">{{ f }}</option>
                </select>
              </div>

              <div class="vertical-sep"></div>

              <div class="toolbar-section">
                <label>Block Background</label>
                <div class="gradient-controls small">
                  <div v-for="(c, i) in activeBlock.bgColors" :key="'b'+i" class="color-wrap">
                     <input type="color" v-model="activeBlock.bgColors[i]" />
                     <button v-if="activeBlock.bgColors.length > 1" @click="removeColor(activeBlock.bgColors, i)" class="tiny-del">×</button>
                  </div>
                  <button class="add-color-btn" @click="addColor(activeBlock.bgColors)">+</button>
                  <input type="range" v-model="activeBlock.bgAngle" min="0" max="360" title="Angle" class="mini-slider" />
                </div>
              </div>

              <div class="vertical-sep"></div>

              <div class="toolbar-section style-group">
                 <div class="size-control">
                   <label>Size</label>
                   <input type="number" v-model="activeBlock.fontSize" class="size-input" @click.stop />
                 </div>
                <button :class="{ active: activeBlock.isBold }" @click="activeBlock.isBold = !activeBlock.isBold"><b>B</b></button>
                <button :class="{ active: activeBlock.isItalic }" @click="activeBlock.isItalic = !activeBlock.isItalic"><i>I</i></button>
                <div class="align-group">
                  <button :class="{ active: activeBlock.align === 'left' }" @click="activeBlock.align = 'left'">⇠</button>
                  <button :class="{ active: activeBlock.align === 'center' }" @click="activeBlock.align = 'center'">⇿</button>
                  <button :class="{ active: activeBlock.align === 'right' }" @click="activeBlock.align = 'right'">⇢</button>
                </div>
              </div>
            </div>

            <div class="desc-toolbar empty" v-else>
              <span>Select a text block to edit styles</span>
            </div>

            <div class="desc-canvas" :style="containerStyle" @click.self="activeBlockId = null">
              <div 
                v-for="(block, index) in form.description.blocks" 
                :key="block.id" 
                class="desc-block-row"
                :class="{ active: activeBlockId === block.id }"
                @click="activeBlockId = block.id"
                :style="{
                  background: getGradient(block.bgColors, block.bgAngle),
                  borderRadius: '6px' 
                }"
              >
                <button class="row-del-btn" @click.stop="removeBlock(index)">×</button>
                
                <div v-if="block.type === 'gif'" class="gif-wrapper" :style="{ justifyContent: block.align }">
                  <img :src="block.content" />
                  <button class="revert-btn" @click.stop="block.type='text'; block.content=''">Edit Link</button>
                </div>
                
                <textarea 
                  v-else
                  :ref="el => blockRefs[block.id] = el"
                  v-model="block.content"
                  @input="checkContent(block, $event)"
                  @focus="activeBlockId = block.id"
                  placeholder="Type text or paste GIF url..."
                  class="block-input"
                  rows="1" 
                  :style="{
                    fontFamily: block.fontFamily || 'Inter',
                    fontSize: (block.fontSize || 18) + 'px',
                    fontWeight: block.isBold ? 'bold' : 'normal',
                    fontStyle: block.isItalic ? 'italic' : 'normal',
                    textAlign: block.align,
                    backgroundColor: 'transparent',
                    color: block.textColors && block.textColors.length > 1 ? 'transparent' : (block.textColors?.[0] || 'white'),
                    backgroundImage: block.textColors && block.textColors.length > 1 ? getGradient(block.textColors, block.textAngle) : 'none',
                    webkitBackgroundClip: block.textColors && block.textColors.length > 1 ? 'text' : 'unset',
                    backgroundClip: block.textColors && block.textColors.length > 1 ? 'text' : 'unset'
                  }"
                ></textarea>
              </div>
              <button class="add-text-btn" @click="addBlock">+ Add Text / GIF</button>
            </div>
          </div>

          <button class="update-btn" @click="handleUpdate" :disabled="isUpdating || !isFormValid">
            <span v-if="!isFormValid">📝 Fix Validation Errors to Update</span>
            <span v-else-if="isUpdating">Processing Update...</span>
            <span v-else>🚀 Push Update Live</span>
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
.back-btn { background: transparent; border: none; color: #94a3b8; font-weight: 600; cursor: pointer; transition: 0.2s; padding: 8px 16px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); }
.back-btn:hover { color: white; background: rgba(239, 68, 68, 0.2); border-color: #ef4444; transform: translateX(-2px); }

.monetization-badge { position: relative; padding: 6px 16px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; display: flex; align-items: center; gap: 8px; background: #334155; color: #94a3b8; cursor: help; }
.monetization-badge.paid { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
.lock-icon { font-size: 0.9rem; opacity: 0.7; }
.tooltip { visibility: hidden; width: 200px; background-color: #0f172a; color: #fff; text-align: center; border-radius: 6px; padding: 8px; position: absolute; z-index: 1; top: 120%; right: 0; opacity: 0; transition: opacity 0.3s; border: 1px solid rgba(255,255,255,0.1); font-weight: 400; font-size: 0.75rem; }
.monetization-badge:hover .tooltip { visibility: visible; opacity: 1; }

.title-group { display: flex; flex-direction: column; gap: 5px; }
.title-group label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
.title-row { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
.title-input { flex: 1; min-width: 250px; background: transparent; border: none; font-size: 2rem; color: white; outline: none; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 5px; transition: 0.3s; }
.title-input:focus { border-color: #3b82f6; }
.font-select { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; padding: 8px; border-radius: 8px; font-size: 0.9rem; cursor: pointer; outline: none; }

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

.demo-input { width: 80px; }

.nsfw-row { display: flex; align-items: center; gap: 10px; font-size: 0.85rem; color: #fca5a5; margin-top: 5px; }

/* DESCRIPTION EDITOR COL */
.desc-col { display: flex; flex-direction: column; gap: 15px; }

.desc-box-container { border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; overflow: hidden; background: #0f172a; display: flex; flex-direction: column; }
.desc-header { background: #1e293b; padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
.header-label { font-size: 0.75rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px; }

.desc-toolbar { background: #334155; padding: 10px 20px; display: flex; align-items: center; gap: 20px; min-height: 60px; flex-wrap: wrap; border-bottom: 1px solid rgba(255,255,255,0.1); }
.desc-toolbar.empty { justify-content: center; color: #64748b; font-size: 0.85rem; font-style: italic; background: #1e293b; }

.toolbar-section { display: flex; flex-direction: column; gap: 5px; }
.toolbar-section.style-group { flex-direction: row; align-items: center; gap: 8px; margin-left: auto; }
@media (max-width: 600px) { .toolbar-section.style-group { margin-left: 0; margin-top: 10px; } }
.toolbar-section label { font-size: 0.65rem; color: #cbd5e1; font-weight: 600; text-transform: uppercase; }

.vertical-sep { width: 1px; height: 30px; background: rgba(255,255,255,0.1); }
.gradient-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.gradient-controls.small { gap: 6px; }
.color-wrap { position: relative; display: flex; align-items: center; }
.color-wrap input[type="color"] { width: 36px; height: 36px; border: 2px solid rgba(255,255,255,0.2); padding: 0; background: none; cursor: pointer; border-radius: 6px; overflow: hidden; }
.tiny-del { position: absolute; top: -6px; right: -6px; background: #ef4444; border: none; color: white; width: 14px; height: 14px; font-size: 9px; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; z-index: 2; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }

.add-color-btn { width: 36px; height: 36px; background: rgba(255,255,255,0.1); border: 1px dashed rgba(255,255,255,0.3); color: white; border-radius: 6px; cursor: pointer; font-size: 1.2rem; line-height: 1; display: flex; justify-content: center; align-items: center; }
.add-color-btn:hover { background: rgba(255,255,255,0.2); }
.angle-slider-wrap { display: flex; flex-direction: column; margin-left: 10px; width: 80px; }
.angle-slider-wrap label { font-size: 0.6rem; color: #94a3b8; margin-bottom: 2px; }
input[type="range"] { width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; outline: none; cursor: pointer; }
.mini-slider { width: 60px; margin-left: 5px; }

.size-control { display: flex; flex-direction: column; gap: 2px; margin-right: 5px; }
.size-input { width: 50px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 4px; padding: 5px; font-size: 0.9rem; text-align: center; }

.desc-toolbar button { background: rgba(0,0,0,0.2); border: 1px solid transparent; color: #cbd5e1; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: 0.2s; }
.desc-toolbar button:hover { background: rgba(255,255,255,0.1); }
.desc-toolbar button.active { background: #3b82f6; color: white; border-color: #2563eb; }

.align-group { display: flex; gap: 2px; background: rgba(0,0,0,0.2); border-radius: 6px; padding: 2px; }
.align-group button { background: transparent; border: none; }
.align-group button.active { background: #3b82f6; }

.desc-canvas { min-height: 350px; padding: 30px; display: flex; flex-direction: column; gap: 15px; }
.desc-block-row { position: relative; width: 100%; transition: transform 0.2s; border: 1px dashed transparent; }
.desc-block-row:hover { border-color: rgba(255,255,255,0.1); }
.desc-block-row.active { border-color: #3b82f6; box-shadow: 0 0 0 1px rgba(59,130,246,0.3); z-index: 5; }
.desc-block-row:hover .row-del-btn { opacity: 1; }

.block-input { width: 100%; border: none; padding: 10px; outline: none; border-radius: 6px; resize: none; overflow: hidden; caret-color: #ffffff; font-family: inherit; line-height: 1.4; min-height: 40px; }

.gif-wrapper { display: flex; width: 100%; position: relative; padding: 10px 0; }
.gif-wrapper img { max-width: 100%; border-radius: 8px; max-height: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
.revert-btn { position: absolute; top: 20px; right: 20px; background: rgba(0,0,0,0.7); padding: 5px 10px; border-radius: 4px; border: none; color: white; cursor: pointer; font-size: 0.8rem; backdrop-filter: blur(4px); }

.row-del-btn { position: absolute; left: -35px; top: 50%; transform: translateY(-50%); background: #ef4444; border: none; color: white; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; opacity: 0; transition: 0.2s; z-index: 10; display: flex; align-items: center; justify-content: center; padding-bottom: 2px; }

.add-text-btn { margin-top: 15px; width: 100%; padding: 12px; background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.2); color: #94a3b8; border-radius: 8px; cursor: pointer; transition: 0.2s; font-size: 0.9rem; }
.add-text-btn:hover { background: rgba(255,255,255,0.1); color: white; border-color: #3b82f6; }

.update-btn { margin-top: 20px; padding: 16px; background: linear-gradient(135deg, #3b82f6, #a855f7); color: white; border: none; border-radius: 12px; font-weight: 700; font-size: 1.1rem; cursor: pointer; transition: 0.2s; box-shadow: 0 10px 25px rgba(59, 130, 246, 0.4); }
.update-btn:hover { transform: translateY(-2px); box-shadow: 0 15px 30px rgba(59, 130, 246, 0.6); }
.update-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; filter: grayscale(0.8); }

@media (max-width: 900px) {
  .main-grid { grid-template-columns: 1fr; }
  .toggle-card { order: -1; }
  .title-row { flex-direction: column; align-items: stretch; }
  .title-input { width: 100%; }
}
.thumbnail-section { margin-bottom: 15px; }
.thumbnail-editor { width: 100%; height: 200px; border-radius: 12px; background-size: cover; background-position: center; border: 1px solid rgba(255,255,255,0.1); position: relative; overflow: hidden; margin-top: 5px; }
.overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; opacity: 0; transition: 0.3s; }
.thumbnail-editor:hover .overlay { opacity: 1; }
.change-btn { background: white; color: black; padding: 8px 16px; border-radius: 30px; font-weight: 700; cursor: pointer; transition: transform 0.2s; font-size: 0.9rem; }
.change-btn:hover { transform: scale(1.05); }
.nsfw-overlay-badge { position: absolute; bottom: 10px; right: 10px; background: #ef4444; color: white; font-weight: 800; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; box-shadow: 0 2px 5px rgba(0,0,0,0.5); }

@media (max-width: 900px) {
  .thumbnail-editor { height: 160px; }
}
</style>