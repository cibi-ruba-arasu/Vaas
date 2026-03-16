<script setup>
import { ref, onMounted, nextTick, computed, watch } from "vue"
import { useRouter } from "vue-router"
import { API_URL } from '../config.js';

const router = useRouter()
const token = sessionStorage.getItem("token")

const loading = ref(true)
const isEditing = ref(false)
const isSaving = ref(false)

const showNetworkModal = ref(false)
const networkType = ref('followers') // 'followers' or 'following'
const networkList = ref({ followers: [], following: [] })
const isNetworkLoading = ref(false)

const publishedProjects = ref([])

const fetchNetwork = async () => {
  if (isNetworkLoading.value) return
  isNetworkLoading.value = true
  try {
    const res = await fetch(`${API_URL}/user/network`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      networkList.value = await res.json()
      
      // 🚀 FIX: Sync the profile counts with the fresh network list
      if (!user.value.stats) user.value.stats = {};
      user.value.stats.followers = networkList.value.followers.length;
      user.value.stats.following = networkList.value.following.length;
    }
  } catch (e) {
    console.error("Network fetch failed", e)
  } finally {
    isNetworkLoading.value = false
  }
}

const openNetwork = (type) => {
  networkType.value = type
  showNetworkModal.value = true
  fetchNetwork() // Refresh data when opening
}

const goToUser = (userid) => {
  showNetworkModal.value = false
  router.push(`/user/${userid}`)
}

const showPfpInventory = ref(false)
const inventoryTab = ref('custom') // 'custom' or 'earned'

const user = ref({
  username: "Weaver",
  description: { blocks: [], container: { colors: ['transparent'], angle: 135 } },
  profilePic: null,
  verified: 'normal',
  pfp_status: { matrix: [], background: { colors: ['#ffffff'], angle: 90 } }, 
  
  // Initialize safe arrays
  pfp_inventory: { custom: [], earned: [] },
  active_pfp_type: 'custom',
  active_earned_ref: null,
  badges: [], 
  
  stats: { followers: 0, following: 0, rating: 0.0, weaves: 0 }
})

// 🚀 NEW: Dynamic Google Font Loader
// 1. Helper function to inject the font
const loadGoogleFont = (fontFamily) => {
  if (!fontFamily || fontFamily === 'sans-serif' || fontFamily === 'Inter') return;
  const fontId = `font-${fontFamily.replace(/\s+/g, '-')}`;
  if (!document.getElementById(fontId)) {
    const link = document.createElement('link');
    link.id = fontId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}&display=swap`;
    document.head.appendChild(link);
  }
};

// 2. Watcher to load fonts whenever user object updates
watch(() => user.value, (newUser) => {
  if (!newUser) return;
  
  // 1. Load font for equipped Earned PFP
  if (newUser.active_pfp_type === 'earned' && newUser.active_earned_ref?.giftFont) {
    loadGoogleFont(newUser.active_earned_ref.giftFont);
  }
  
  // 2. Load fonts for ALL Earned PFPs in the inventory
  if (newUser.pfp_inventory?.earned) {
    newUser.pfp_inventory.earned.forEach(p => {
      if (p.giftFont) loadGoogleFont(p.giftFont);
    });
  }
  
  // 3. Load fonts for all Badges
  if (newUser.badges && newUser.badges.length > 0) {
    newUser.badges.forEach(badge => {
      if (badge.giftFont) loadGoogleFont(badge.giftFont);
    });
  }
}, { deep: true, immediate: true });



// 🚀 NEW: Remove Badge Function
const removeBadge = async (index) => {
    if (!confirm("Remove this badge from your profile display?")) return;
    user.value.badges.splice(index, 1);
    await saveProfile();
}



/* --- CARD HELPER FUNCTIONS --- */
const getPreviewTags = (pub) => {
  const combined = [...(pub.categories || []), ...(pub.customCategories || [])];
  return combined.slice(0, 3);
}

const getTotalTagCount = (pub) => {
  return (pub.categories?.length || 0) + (pub.customCategories?.length || 0) + (pub.warnings?.length || 0);
}

/* --- PFP EDITOR STATE --- */
const showPfpEditor = ref(false)

const pfpCanvasRef = ref(null)

// ✅ 64x64 Grid (4096 Pixels total)
const MATRIX_SIZE = 64 

const isPainting = ref(false)
const currentPaintColor = ref('#000000') 
const editorState = ref({
  matrix: [], // This will always hold the full 4096 "Dense" array for the editor to use
  bgColors: ['#ffffff'],
  bgAngle: 90
})

/* --- COMPRESSION LOGIC (Sparse Matrix) --- */

// 1. Pack: Turn full grid (4096 items) -> List of colored pixels only
const packMatrix = (denseArray) => {
    const sparse = [];
    denseArray.forEach((color, index) => {
        if (color) { 
            sparse.push({ i: index, c: color });
        }
    });
    return sparse;
}

// 2. Unpack: Turn List of pixels -> Full grid (4096 items)
const unpackMatrix = (sparseArray, size) => {
    const dense = new Array(size).fill(null); // Start clean
    
    if (!Array.isArray(sparseArray)) return dense;

    sparseArray.forEach(pixel => {
        // Ensure pixel is valid object { i: index, c: color }
        if (pixel && pixel.i !== undefined && pixel.c) {
             if (pixel.i < size) dense[pixel.i] = pixel.c;
        }
    });
    
    return dense;
}

/* --- PFP LOGIC --- */
const initMatrix = () => {
  const size = MATRIX_SIZE * MATRIX_SIZE;
  const savedStatus = user.value.pfp_status;

  // 1. Load Background
  editorState.value.bgColors = savedStatus?.background?.colors?.length 
      ? [...savedStatus.background.colors] 
      : ['#ffffff'];
  editorState.value.bgAngle = savedStatus?.background?.angle || 90;

  // 2. Load Matrix (The Fix)
  // We check if there is data in the matrix array
  if (savedStatus && Array.isArray(savedStatus.matrix) && savedStatus.matrix.length > 0) {
      // Decompress the DB data back into the Editor Grid
      editorState.value.matrix = unpackMatrix(savedStatus.matrix, size);
  } else {
      // No data? Start with a blank canvas
      editorState.value.matrix = new Array(size).fill(null); 
  }
}

// Watch for modal opening to trigger render
watch(showPfpEditor, (newVal) => {
    if (newVal) {
        initMatrix(); // Load data
        nextTick(() => {
            drawCanvas(); // Paint data to canvas
        });
    }
});

const openPfpInventory = () => {
  if (!isEditing.value) return; 
  showPfpInventory.value = true;
}

const openPixelStudio = () => {
  showPfpInventory.value = false; // Close collection
  showPfpEditor.value = true;     // Open pixel studio
}

// Watch for modal opening to trigger render
watch(showPfpEditor, (newVal) => {
    if (newVal) {
        initMatrix(); // Load data
        nextTick(() => {
            drawCanvas(); // Paint data to canvas
        });
    }
});

const drawCanvas = () => {
  const canvas = pfpCanvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  // Clear
  ctx.clearRect(0, 0, MATRIX_SIZE, MATRIX_SIZE);

  // Paint pixels from the loaded editorState
  const pixels = editorState.value.matrix;
  for (let i = 0; i < pixels.length; i++) {
    if (pixels[i]) { 
      const x = i % MATRIX_SIZE;
      const y = Math.floor(i / MATRIX_SIZE);
      ctx.fillStyle = pixels[i];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

const handleCanvasAction = (e) => {
  if (!isPainting.value && e.type !== 'mousedown') return;
  const canvas = pfpCanvasRef.value;
  const rect = canvas.getBoundingClientRect();
  
  // Calculate scale (Visual Size / Logical 64px Size)
  const scaleX = MATRIX_SIZE / rect.width;
  const scaleY = MATRIX_SIZE / rect.height;

  const x = Math.floor((e.clientX - rect.left) * scaleX);
  const y = Math.floor((e.clientY - rect.top) * scaleY);

  if (x >= 0 && x < MATRIX_SIZE && y >= 0 && y < MATRIX_SIZE) {
    const index = y * MATRIX_SIZE + x;
    editorState.value.matrix[index] = currentPaintColor.value; // Update State
    
    // Update Canvas Visual immediately
    const ctx = canvas.getContext('2d');
    if (currentPaintColor.value) {
        ctx.fillStyle = currentPaintColor.value;
        ctx.fillRect(x, y, 1, 1);
    } else {
        ctx.clearRect(x, y, 1, 1); // Eraser
    }
  }
}

const startPainting = (e) => { isPainting.value = true; handleCanvasAction(e); }
const stopPainting = () => { isPainting.value = false; }

const applyPfpChanges = () => {
  // 1. Create High-Res Output (256x256) for the website display
  const tempCanvas = document.createElement('canvas');
  const OUTPUT_SIZE = 256;
  tempCanvas.width = OUTPUT_SIZE; 
  tempCanvas.height = OUTPUT_SIZE;
  const ctx = tempCanvas.getContext('2d');
  
  ctx.imageSmoothingEnabled = false; // Keep pixel art sharp

  // Draw Background
  const grad = ctx.createLinearGradient(0, 0, OUTPUT_SIZE, OUTPUT_SIZE); 
  editorState.value.bgColors.forEach((col, i) => {
    grad.addColorStop(i / (editorState.value.bgColors.length - 1 || 1), col);
  });
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  // Draw Pixels Scaled Up
  const scale = OUTPUT_SIZE / MATRIX_SIZE; 
  const pixels = editorState.value.matrix;
  for (let i = 0; i < pixels.length; i++) {
    if (pixels[i]) {
      const x = (i % MATRIX_SIZE) * scale;
      const y = Math.floor(i / MATRIX_SIZE) * scale;
      ctx.fillStyle = pixels[i];
      ctx.fillRect(x, y, scale, scale);
    }
  }


  const base64Image = tempCanvas.toDataURL('image/png'); 
  
  // 🚀 FIX: Convert the massive array into a single lightweight string
  const compressedMatrix = JSON.stringify(packMatrix(editorState.value.matrix));

  // 3. Create new Custom PFP Object
  const newCustomPfp = {
    id: Date.now().toString(),
    matrix: compressedMatrix, // Now a string!
    background: {
      colors: [...editorState.value.bgColors],
      angle: editorState.value.bgAngle
    },
    base64: base64Image
  };
  

  // 4. Ensure inventory arrays exist, then push
  if (!user.value.pfp_inventory) user.value.pfp_inventory = { custom: [], earned: [] };
  if (!user.value.pfp_inventory.custom) user.value.pfp_inventory.custom = [];
  
  user.value.pfp_inventory.custom.push(newCustomPfp);

  // 5. Set it as active immediately
  user.value.active_pfp_type = 'custom';
  user.value.active_earned_ref = null;
  user.value.profilePic = base64Image;
  
  // Legacy support fallback
  user.value.pfp_status = { 
    matrix: compressedMatrix,
    background: newCustomPfp.background
  };
  
  showPfpEditor.value = false;
  saveProfile(); // Auto-save to DB when a new one is created
}

const equipPfp = async (type, item) => {
    user.value.active_pfp_type = type;
    user.value.profilePic = item.base64;


    if (type === 'custom') {
        user.value.active_earned_ref = null;
        
        // 🚀 FIX: Safety check to parse the string back into an array if it was stringified
        let parsedMatrix = [];
        try {
            parsedMatrix = typeof item.matrix === 'string' ? JSON.parse(item.matrix) : item.matrix;
        } catch (e) {
            parsedMatrix = [];
        }

        user.value.pfp_status = { matrix: parsedMatrix, background: item.background };
    } else if (type === 'earned') {
        user.value.active_earned_ref = { publishId: item.publishId, giftName: item.giftName };
    }
    
    showPfpInventory.value = false;
    await saveProfile();
}

// 🚀 NEW: Delete a custom design
const deleteCustomPfp = async (id, event) => {
    event.stopPropagation();
    if(!confirm("Are you sure you want to delete this design?")) return;
    
    user.value.pfp_inventory.custom = user.value.pfp_inventory.custom.filter(p => p.id !== id);
    
    // If they deleted what they were wearing, clear it
    if (user.value.active_pfp_type === 'custom' && user.value.pfp_inventory.custom.length === 0) {
        user.value.profilePic = null;
    }
    
    await saveProfile();
}

const addPfpBgColor = () => editorState.value.bgColors.push('#ffffff');
const removePfpBgColor = (index) => { if (editorState.value.bgColors.length > 1) editorState.value.bgColors.splice(index, 1); };
const clearMatrix = () => { 
  editorState.value.matrix = new Array(MATRIX_SIZE * MATRIX_SIZE).fill(null); 
  drawCanvas(); 
};


/* --- DESCRIPTION EDITOR STATE (Legacy) --- */
const containerColors = ref(['#1e293b', '#0f172a'])
const containerAngle = ref(135)
const blocks = ref([]) 
const activeBlockId = ref(null)
const blockRefs = ref({})

const FONT_OPTIONS = [
  "Inter", "Cinzel", "Playfair Display", "Merriweather", "Lora", 
  "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Raleway", 
  "Bebas Neue", "Anton", "Dancing Script", "Pacifico", "Shadows Into Light", 
  "Creepster", "Nosifer", "Bangers", "Comic Neue", "Press Start 2P"
];

const addBlock = async () => {
  const id = Date.now();
  blocks.value.push({
    id, type: 'text', content: "", isBold: false, isItalic: false, fontFamily: 'Inter',
    align: 'left', fontSize: 16, 
    textColors: ['#cbd5e1'], textAngle: 90, 
    bgColors: ['transparent'], bgAngle: 90
  });
  activeBlockId.value = id;
  await nextTick();
  if (blockRefs.value[id]) { blockRefs.value[id].focus(); autoResize(blockRefs.value[id]); }
};

const removeBlock = (index) => {
  blocks.value.splice(index, 1);
  activeBlockId.value = null;
};

const autoResize = (el) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};

const getGradient = (colors, angle) => {
  if (!colors || colors.length === 0) return 'transparent';
  if (colors.length === 1) return colors[0];
  return `linear-gradient(${angle}deg, ${colors.join(', ')})`;
};

const containerStyle = computed(() => ({
  background: getGradient(containerColors.value, containerAngle.value),
  padding: '20px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.1)'
}));

watch(blocks, async () => {
  await nextTick();
  for (const id in blockRefs.value) autoResize(blockRefs.value[id]);
}, { deep: true });

const activeBlock = computed(() => blocks.value.find(b => b.id === activeBlockId.value));

/* --- API CALLS --- */
const fetchData = async () => {
  if (!token) return router.push("/login")
  
  try {
    const profileRes = await fetch(`${API_URL}/user/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (profileRes.ok) {
      const data = await profileRes.json()
      // 🚀 FIX: Build a guaranteed stats object based on the most accurate data (the arrays)
      data.stats = {
        followers: Array.isArray(data.followers) ? data.followers.length : (data.followersCount || data.stats?.followers || 0),
        following: Array.isArray(data.following) ? data.following.length : (data.followingCount || data.stats?.following || 0),
        rating: data.rating || data.stats?.rating || 0.0,
        weaves: data.weavesCount || data.stats?.weaves || 0
      }
      user.value = data
      
      // Ensure structures exist for legacy accounts
      if (!user.value.pfp_status || typeof user.value.pfp_status !== 'object') {
          user.value.pfp_status = { matrix: [], background: { colors: ['#ffffff'], angle: 90 } };
      }
      if (!user.value.pfp_inventory) {
          user.value.pfp_inventory = { custom: [], earned: [] };
      }
      if (!user.value.active_pfp_type) {
          user.value.active_pfp_type = 'custom';
      }

      // Legacy Description Handler
      if (data.description && typeof data.description === 'object' && !Array.isArray(data.description) && data.description.blocks) {
        blocks.value = data.description.blocks || [];
        containerColors.value = data.description.container?.colors || ['#1e293b', '#0f172a'];
        containerAngle.value = data.description.container?.angle || 135;
      } else if (Array.isArray(data.description)) {
        blocks.value = data.description;
      } else if (typeof data.description === 'string') {
        blocks.value = [{
          id: Date.now(), type: 'text', content: data.description, 
          fontFamily: 'Inter', align: 'left', fontSize: 16, 
          textColors: ['#cbd5e1'], bgColors: ['transparent']
        }];
      }
    } else {
      sessionStorage.removeItem("token")
      router.push("/login")
      return
    }

    const pubRes = await fetch(`${API_URL}/user/publishes`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (pubRes.ok) publishedProjects.value = await pubRes.json()

  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const saveProfile = async () => {
  isSaving.value = true
  try {
    // 🚀 NEW: Payload includes the inventory state
    const payload = {
      username: user.value.username,
      profilePic: user.value.profilePic, 
      pfp_status: user.value.pfp_status, 
      pfp_inventory: user.value.pfp_inventory,
      active_pfp_type: user.value.active_pfp_type,
      active_earned_ref: user.value.active_earned_ref,
      badges: user.value.badges, // 🚀 Save badge array
      description: {
        container: { colors: containerColors.value, angle: containerAngle.value },
        blocks: blocks.value
      }
    }

    const res = await fetch(`${API_URL}/user/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })

    if (res.ok) {
      const updated = await res.json();
      isEditing.value = false
    } else {
      const d = await res.json()
      alert(d.message || "Failed to update")
    }
  } catch (e) {
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

const toggleEdit = () => {
  if (isEditing.value) {
    fetchData(); 
  }
  isEditing.value = !isEditing.value
}

const logout = () => {
  sessionStorage.clear()
  router.push("/login")
}

onMounted(() => {
  fetchData()
})

const addColor = (array) => { array.push('#3b82f6'); };
const removeColor = (array, index) => { if (array.length > 1) array.splice(index, 1); };
</script>

<template>
  <div class="profile-page">
    <div class="bg-orb orb-1"></div>
    <div class="bg-orb orb-2"></div>
    <div v-if="showPfpEditor" class="modal-overlay" @click.self="showPfpEditor = false">
      <div class="pfp-editor-modal glass-panel">
        <div class="modal-header">
          <h3>Pixel Studio (64x64)</h3>
          <button @click="showPfpEditor = false" class="close-btn">×</button>
        </div>

        <div class="editor-body">
          <div class="visual-section">
            <div class="matrix-container"
                 @mousedown="startPainting"
                 @mousemove="handleCanvasAction"
                 @mouseup="stopPainting"
                 @mouseleave="stopPainting"
                 :style="{ background: getGradient(editorState.bgColors, editorState.bgAngle) }">
              <canvas ref="pfpCanvasRef" width="64" height="64" class="pixel-canvas"></canvas>
            </div>
            <span class="hint">Click and drag to draw your custom design</span>
          </div>
          
          <div class="settings-section">
            <div class="setting-group">
              <label>Brush Color</label>
              <div class="color-picker-row">
                <div class="color-preview" :style="{ backgroundColor: currentPaintColor || 'transparent' }"></div>
                <input type="color" v-model="currentPaintColor" class="main-color-input" v-if="currentPaintColor !== null" />
                <button class="eraser-btn" :class="{ active: currentPaintColor === null }" @click="currentPaintColor = null">
                  Eraser
                </button>
              </div>
            </div>

            <hr class="divider" />

            <div class="setting-group">
              <label>Background Gradient</label>
              <div class="gradient-controls">
                <div v-for="(color, idx) in editorState.bgColors" :key="idx" class="color-wrap">
                  <input type="color" v-model="editorState.bgColors[idx]" />
                  <button v-if="editorState.bgColors.length > 1" @click="removePfpBgColor(idx)" class="tiny-del">×</button>
                </div>
                <button class="add-color-btn" @click="addPfpBgColor">+</button>
              </div>
              <div class="angle-wrap">
                <span>Angle</span>
                <input type="range" v-model="editorState.bgAngle" min="0" max="360" class="full-range" />
              </div>
            </div>

            <div class="modal-actions">
              <button class="btn outline-btn" @click="clearMatrix">Clear Canvas</button>
              <button class="btn save-btn" @click="applyPfpChanges">Save Design</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="showPfpInventory" class="modal-overlay" @click.self="showPfpInventory = false">
      <div class="inventory-modal glass-panel">
        <div class="modal-header">
          <h3>Profile Picture Collection</h3>
          <button @click="showPfpInventory = false" class="close-btn">×</button>
        </div>

        <div class="inventory-body">
          <div class="inventory-tabs">
            <button :class="{ active: inventoryTab === 'custom' }" @click="inventoryTab = 'custom'">My Designs</button>
            <button :class="{ active: inventoryTab === 'earned' }" @click="inventoryTab = 'earned'">Unlocked Rewards</button>
          </div>

          <div v-if="inventoryTab === 'custom'" class="inventory-content">
            <div class="pfp-grid">
              
              <div class="pfp-card create-new" @click="openPixelStudio">
                <span class="plus-icon">+</span>
                <span>Create New</span>
              </div>

              <div v-for="item in user.pfp_inventory?.custom" :key="item.id" class="pfp-card">
                <div class="pfp-preview" :style="{ backgroundImage: `url(${item.base64})` }"></div>
                <div class="pfp-actions">
                  <button class="equip-btn" @click="equipPfp('custom', item)">Equip</button>
                  <button class="delete-btn" @click="deleteCustomPfp(item.id, $event)" title="Delete Design">🗑️</button>
                </div>
                
                <div v-if="user.active_pfp_type === 'custom' && user.profilePic === item.base64" class="active-badge">
                  ✓ Equipped
                </div>
              </div>

            </div>
          </div>

          <div v-if="inventoryTab === 'earned'" class="inventory-content">
            <div v-if="!user.pfp_inventory?.earned?.length" class="empty-inventory">
              <p>You haven't unlocked any profile pictures yet.<br/>Play games and collect gifts to expand your collection!</p>
            </div>
            
            <div v-else class="pfp-grid">
              <div v-for="(item, idx) in user.pfp_inventory.earned" :key="idx" class="pfp-card earned-card">
                <div class="pfp-preview" :style="{ backgroundImage: `url(${item.base64})` }"></div>
                <div class="earned-info">
                  <span class="gift-name" :style="{ fontFamily: item.giftFont ? `'${item.giftFont}', sans-serif` : 'Inter' }">
                    {{ item.giftName }}
                  </span>
                </div>
                <div class="pfp-actions">
                  <button class="equip-btn earned-equip" @click="equipPfp('earned', item)">Equip</button>
                </div>
                
                <div v-if="user.active_pfp_type === 'earned' && user.active_earned_ref?.giftName === item.giftName && user.active_earned_ref?.publishId === item.publishId" class="active-badge earned-badge">
                  ✓ Equipped
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
    <div v-if="showNetworkModal" class="modal-overlay" @click.self="showNetworkModal = false">
      <div class="network-modal glass-panel">
        <div class="modal-header">
          <h3>{{ networkType === 'followers' ? 'Followers' : 'Following' }}</h3>
          <button @click="showNetworkModal = false" class="close-btn">×</button>
        </div>

        <div class="network-body">
          <div v-if="isNetworkLoading" class="center-msg">
             <div class="spinner"></div>
          </div>

          <div v-else-if="networkList[networkType].length === 0" class="empty-list">
             <p>No souls found in this realm.</p>
          </div>

          <ul v-else class="user-list">
            <li v-for="u in networkList[networkType]" :key="u._id" class="user-row" @click="goToUser(u.userid)">
               <div class="mini-pfp">
                  <img v-if="u.profilePic" :src="u.profilePic" />
                  <span v-else>{{ u.username.charAt(0) }}</span>
               </div>
               <span class="list-username">{{ u.username }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <div class="content-wrapper" v-if="!loading">
      
      <header class="profile-header glass-panel">
        <div class="header-inner">
          
          <div class="identity-block">
            <div class="top-row">
              <div class="pfp-wrapper">
                <div 
                  class="pfp-circle" 
                  :class="{ editable: isEditing }"
                  @click="openPfpInventory" >
                   <span v-if="!user.profilePic" class="initial">{{ user.username.charAt(0) }}</span>
                   
                   <img v-else :src="user.profilePic" class="pfp-img" />
                   
                   <div v-if="isEditing" class="pfp-overlay">
                     <span class="edit-icon">🖼️</span> <span>Collection</span>
                   </div>
                </div>
              </div>

              <div class="name-col">
                <div class="username-row">
                  <h1 class="username">{{ user.username }}</h1>
                  <div class="verified-badge" :class="user.verified" :title="user.verified + ' status'">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                </div>
                <div class="stats-row">
                  <div class="stat clickable" @click="openNetwork('followers')">
                      <span class="val">{{ user.stats.followers }}</span> 
                      <span class="lbl">Followers</span>
                  </div>
                  <div class="stat clickable" @click="openNetwork('following')">
                      <span class="val">{{ user.stats.following }}</span> 
                      <span class="lbl">Following</span>
                  </div>
                  <div class="stat"><span class="val">{{ user.stats.weaves }}</span> <span class="lbl">Publishes</span></div>
                </div>
              </div>
            </div>

            <div class="bio-section">
              
              <div v-if="isEditing" class="global-toolbar">
                <span class="label">Box Style:</span>
                <div class="gradient-controls">
                  <div v-for="(color, idx) in containerColors" :key="idx" class="color-wrap">
                    <input type="color" v-model="containerColors[idx]" />
                    <button v-if="containerColors.length > 1" @click="removeColor(containerColors, idx)" class="tiny-del">×</button>
                  </div>
                  <button class="add-color-btn" @click="addColor(containerColors)">+</button>
                  <div class="angle-wrap">
                    <span>∠</span>
                    <input type="range" v-model="containerAngle" min="0" max="360" class="mini-range" />
                  </div>
                </div>
              </div>

              <div v-if="isEditing && activeBlock" class="block-toolbar">
                 <div class="tool-group">
                    <select v-model="activeBlock.fontFamily" class="mini-select">
                      <option v-for="f in FONT_OPTIONS" :key="f" :value="f">{{ f }}</option>
                    </select>
                 </div>
                 <div class="tool-group"><input type="number" v-model="activeBlock.fontSize" class="mini-input" placeholder="Size" /></div>
                 
                 <div class="tool-group gradient-group">
                    <label>Text</label>
                    <div class="mini-grad-row">
                      <div v-for="(c, i) in activeBlock.textColors" :key="'t'+i" class="mini-color">
                         <input type="color" v-model="activeBlock.textColors[i]" />
                         <span v-if="activeBlock.textColors.length > 1" @click="removeColor(activeBlock.textColors, i)" class="x-tiny">×</span>
                      </div>
                      <button class="plus-tiny" @click="addColor(activeBlock.textColors)">+</button>
                      <input type="range" v-model="activeBlock.textAngle" min="0" max="360" class="tiny-range" title="Angle" />
                    </div>
                 </div>

                 <div class="tool-group gradient-group">
                    <label>BG</label>
                    <div class="mini-grad-row">
                      <div v-for="(c, i) in activeBlock.bgColors" :key="'b'+i" class="mini-color">
                         <input type="color" v-model="activeBlock.bgColors[i]" />
                         <span v-if="activeBlock.bgColors.length > 1" @click="removeColor(activeBlock.bgColors, i)" class="x-tiny">×</span>
                      </div>
                      <button class="plus-tiny" @click="addColor(activeBlock.bgColors)">+</button>
                      <input type="range" v-model="activeBlock.bgAngle" min="0" max="360" class="tiny-range" title="Angle" />
                    </div>
                 </div>

                 <div class="tool-group row">
                    <button :class="{active: activeBlock.isBold}" @click="activeBlock.isBold = !activeBlock.isBold"><b>B</b></button>
                    <button :class="{active: activeBlock.isItalic}" @click="activeBlock.isItalic = !activeBlock.isItalic"><i>I</i></button>
                 </div>
                 <div class="tool-group row">
                    <button @click="activeBlock.align = 'left'">⇠</button>
                    <button @click="activeBlock.align = 'center'">⇿</button>
                    <button @click="activeBlock.align = 'right'">⇢</button>
                 </div>
              </div>

              <div class="bio-canvas" :style="containerStyle">
                <div 
                  v-for="(block, index) in blocks" 
                  :key="block.id" 
                  class="bio-block"
                  :class="{ 'editable': isEditing, 'active': activeBlockId === block.id }"
                  @click="isEditing ? activeBlockId = block.id : null"
                  :style="{
                    textAlign: block.align,
                    background: getGradient(block.bgColors, block.bgAngle),
                    borderRadius: '6px',
                    padding: isEditing ? '8px' : '4px'
                  }"
                >
                  <div v-if="isEditing" class="edit-wrapper">
                    <button class="del-btn" @click.stop="removeBlock(index)">×</button>
                    <textarea 
                      :ref="el => blockRefs[block.id] = el"
                      v-model="block.content"
                      class="block-input"
                      rows="1"
                      placeholder="Type text..."
                      @input="autoResize($event.target)"
                      :style="{
                        fontFamily: block.fontFamily,
                        fontSize: block.fontSize + 'px',
                        fontWeight: block.isBold ? 'bold' : 'normal',
                        fontStyle: block.isItalic ? 'italic' : 'normal',
                        textAlign: block.align, 
                        color: block.textColors.length > 1 ? 'transparent' : block.textColors[0],
                        backgroundImage: block.textColors.length > 1 ? getGradient(block.textColors, block.textAngle) : 'none',
                        webkitBackgroundClip: block.textColors.length > 1 ? 'text' : 'unset',
                        backgroundClip: block.textColors.length > 1 ? 'text' : 'unset'
                      }"
                    ></textarea>
                  </div>

                  <div v-else 
                    class="view-text"
                    :style="{
                        fontFamily: block.fontFamily,
                        fontSize: block.fontSize + 'px',
                        fontWeight: block.isBold ? 'bold' : 'normal',
                        fontStyle: block.isItalic ? 'italic' : 'normal',
                        textAlign: block.align,
                        color: block.textColors.length > 1 ? 'transparent' : block.textColors[0],
                        backgroundImage: block.textColors.length > 1 ? getGradient(block.textColors, block.textAngle) : 'none',
                        webkitBackgroundClip: block.textColors.length > 1 ? 'text' : 'unset',
                        backgroundClip: block.textColors.length > 1 ? 'text' : 'unset'
                    }"
                  >{{ block.content }}</div>
                </div>

                <button v-if="isEditing" class="add-block-btn" @click="addBlock">+ Add Text Block</button>
                <div v-if="!isEditing && blocks.length === 0" class="empty-bio">No description yet.</div>
              </div>
            </div>

            <div class="action-buttons">
                <button v-if="!isEditing" @click="toggleEdit" class="btn primary-btn">Edit Profile</button>
                <div v-else class="edit-actions">
                    <button @click="toggleEdit" class="btn cancel-btn">Cancel</button>
                    <button @click="saveProfile" class="btn save-btn" :disabled="isSaving">{{ isSaving ? '...' : 'Save Changes' }}</button>
                </div>
                <button v-if="!isEditing" class="btn outline-btn" @click="router.push('/home')">Home</button>
                <button v-if="!isEditing" class="btn danger-btn" @click="logout">Logout</button>
            </div>
          </div>

        </div>

        <button class="big-create-btn" @click="router.push('/create')" title="Create New Project">
            <span class="plus-icon">+</span>
        </button>
      </header>
      <div class="badges-section" v-if="user.badges && user.badges.length > 0">
        <h3 class="section-title">Achievements</h3>
        <div class="badge-grid">
          <div v-for="badge in user.badges" :key="badge.giftName" class="badge-card">
            <button 
              v-if="isEditing" 
              @click="removeBadge(index)" 
              class="remove-badge-btn"
              title="Remove from Showcase"
            >×</button>
            <div class="badge-img-wrapper">
              <img :src="badge.base64" class="badge-img" />
            </div>
            <div class="badge-name" :style="{ fontFamily: badge.giftFont ? `'${badge.giftFont}', sans-serif` : 'Inter' }">
              {{ badge.giftName }}
            </div>
          </div>
        </div>
      </div>
      <section class="publishes-section">
        <h2 class="section-title">Published Weaves</h2>
        <div v-if="publishedProjects.length > 0" class="projects-grid">
            <div 
              v-for="pub in publishedProjects" 
              :key="pub._id" 
              class="project-card"
              @click="router.push(`/post/${pub._id}`)"
            >
              <div class="card-thumb" :style="{ backgroundImage: pub.thumbnail ? `url('${pub.thumbnail}')` : 'linear-gradient(to bottom right, #1e293b, #0f172a)' }">
                
                <div class="tags-overlay">
                  <div class="overlay-content">
                    <p class="overlay-title">Tags & Warnings</p>
                    <div class="tags-container">
                      <span v-for="warn in pub.warnings" :key="warn" class="mini-chip warning">⚠️ {{ warn }}</span>
                      <span v-for="cat in pub.categories" :key="cat" class="mini-chip category">{{ cat }}</span>
                      <span v-for="cust in pub.customCategories" :key="cust" class="mini-chip custom">{{ cust }}</span>
                    </div>
                  </div>
                </div>

              </div>

              <div class="card-info">
                <h3 :style="{ fontFamily: pub.titleFont || 'sans-serif' }">{{ pub.name }}</h3>
                
                <div class="preview-tags">
                  <span v-if="pub.warnings.length" class="dot warning"></span>
                  <span v-for="tag in getPreviewTags(pub)" :key="tag" class="text-tag">
                    #{{ tag }}
                  </span>
                  <span v-if="getTotalTagCount(pub) > 3" class="more-tag">+{{ getTotalTagCount(pub) - 3 }}</span>
                </div>

                <div class="card-meta">
                  <span>{{ new Date(pub.publishedAt).toLocaleDateString() }}</span>
                  <span class="lang-tag">{{ pub.language.toUpperCase() }}</span>
                </div>
              </div>
            </div>
        </div>
        <div v-else class="empty-state"><p>No stories woven yet.</p></div>
      </section>

    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;600&display=swap');

* { box-sizing: border-box; }

.profile-page { min-height: 100vh; background-color: #020617; color: #f0f0f0; font-family: 'Inter', sans-serif; overflow-x: hidden; position: relative; }
.bg-orb { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.3; z-index: 0; pointer-events: none; }
.orb-1 { width: 40vw; height: 40vw; background: #3b82f6; top: -10%; left: -10%; animation: float 10s infinite alternate; }
.orb-2 { width: 30vw; height: 30vw; background: #a855f7; top: 20%; right: -5%; animation: float 12s infinite alternate-reverse; }
.content-wrapper { position: relative; z-index: 1; width: 100%; display: flex; flex-direction: column; }

/* ================= PFP EDITOR MODAL STYLES ================= */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 20px; }
.pfp-editor-modal { width: 100%; max-width: 800px; height: 80vh; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
.network-modal { 
  width: 100%; max-width: 400px; height: 60vh; 
  background: #0f172a; border: 1px solid rgba(255,255,255,0.1); 
  border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; 
}

.network-body { flex: 1; overflow-y: auto; padding: 10px; }

.user-list { list-style: none; padding: 0; margin: 0; }
.user-row { 
  display: flex; align-items: center; gap: 15px; 
  padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); 
  cursor: pointer; transition: background 0.2s; 
}
.mini-pfp { 
  width: 40px; height: 40px; border-radius: 50%; overflow: hidden; 
  background: #1e293b; display: flex; align-items: center; justify-content: center; 
  border: 1px solid rgba(255,255,255,0.1); font-family: 'Cinzel'; color: #fff;
}
.mini-pfp img { width: 100%; height: 100%; object-fit: cover; }

.list-username { font-size: 1rem; color: #e2e8f0; font-family: 'Inter', sans-serif; }
.empty-list { text-align: center; color: #64748b; padding: 2rem; font-style: italic; }

/* Update Stat Cursor */
.stat.clickable { cursor: pointer; transition: transform 0.2s; }
.stat.clickable:hover .val { color: #3b82f6; }
.stat.clickable:hover { transform: translateY(-2px); }
.user-row:hover { background: rgba(255,255,255,0.05); }
.modal-header { padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; background: #1e293b; }
.modal-header h3 { margin: 0; font-family: 'Cinzel', serif; color: #e2e8f0; }
.close-btn { background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer; transition: 0.2s; }
.close-btn:hover { color: #fff; }

.editor-body { flex: 1; display: flex; overflow: hidden; }

/* Visual Section (Left) */
.visual-section { flex: 1; background: #020617; display: flex; flex-direction: column; align-items: center; justify-content: center; border-right: 1px solid rgba(255,255,255,0.1); position: relative; }

/* The Grid Container */
.matrix-container { 
  width: 384px; /* Display Size (64px * 6) */
  height: 384px; 
  border: 1px solid #334155; 
  position: relative; 
  cursor: crosshair; 
  box-shadow: 0 0 30px rgba(0,0,0,0.5); 
  background-size: cover;
}

/* The Canvas - CRITICAL for Sharpness */
.pixel-canvas { 
  width: 100%; 
  height: 100%; 
  image-rendering: pixelated;       /* Chrome/Edge/Safari */
  image-rendering: crisp-edges;     /* Firefox */
} 

.hint { margin-top: 15px; color: #64748b; font-size: 0.8rem; font-style: italic; }

/* Settings Section (Right) */
.settings-section { width: 300px; padding: 20px; background: #0f172a; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }

.setting-group { display: flex; flex-direction: column; gap: 10px; }
.setting-group label { color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }

.color-picker-row { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px; }
.color-preview { width: 30px; height: 30px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); }
.main-color-input { flex: 1; height: 30px; border: none; padding: 0; background: none; cursor: pointer; }

.eraser-btn { padding: 6px 12px; font-size: 0.8rem; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; border-radius: 4px; cursor: pointer; transition: 0.2s; }
.eraser-btn:hover { background: rgba(255,255,255,0.1); color: white; }
.eraser-btn.active { background: #3b82f6; border-color: #3b82f6; color: white; }

.divider { border: 0; border-top: 1px solid rgba(255,255,255,0.1); width: 100%; margin: 0; }

.gradient-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.color-wrap { position: relative; }
.color-wrap input { width: 30px; height: 30px; border: 1px solid rgba(255,255,255,0.2); padding: 0; background: none; cursor: pointer; border-radius: 4px; }
.tiny-del { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; border: none; width: 14px; height: 14px; font-size: 10px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }

.add-color-btn { width: 30px; height: 30px; background: rgba(255,255,255,0.1); border: 1px dashed rgba(255,255,255,0.3); color: white; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: 0.2s; }
.add-color-btn:hover { border-color: #3b82f6; color: #3b82f6; }

.full-range { width: 100%; cursor: pointer; }
.angle-wrap { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #94a3b8; }

.modal-actions { margin-top: auto; display: flex; gap: 10px; padding-top: 20px; }
.modal-actions button { flex: 1; }

/* ================= MAIN PROFILE STYLES ================= */
.profile-header { width: 100%; min-height: 45vh; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(25px); border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding: 3rem 5%; position: relative; display: flex; align-items: center; }
.header-inner { width: 100%; max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; gap: 2rem; }
.identity-block { width: 100%; display: flex; flex-direction: column; gap: 1.5rem; }

.top-row { display: flex; align-items: center; gap: 2rem; }
.pfp-wrapper { position: relative; }
.pfp-circle { width: 120px; height: 120px; border-radius: 50%; background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05)); border: 2px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); cursor: default; position: relative; }
.pfp-circle.editable { cursor: pointer; border-color: #3b82f6; transition: border-color 0.3s; }
.pfp-circle.editable:hover { border-color: #60a5fa; }
/* PFP Image rendering fix for pixel art */
.pfp-img { width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; image-rendering: crisp-edges; }
.pfp-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.9rem; opacity: 0; transition: 0.2s; color: white; gap: 5px; backdrop-filter: blur(2px); }
.pfp-circle.editable:hover .pfp-overlay { opacity: 1; }
.edit-icon { font-size: 1.5rem; }
.initial { font-size: 3.5rem; font-family: 'Cinzel', serif; color: white; }

.name-col { display: flex; flex-direction: column; gap: 0.5rem; }
.username-row { display: flex; align-items: center; gap: 1rem; }
.username { font-family: 'Cinzel', serif; font-size: clamp(2rem, 4vw, 3.5rem); margin: 0; background: linear-gradient(to right, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.verified-badge { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #334155; display: flex; align-items: center; justify-content: center; color: #334155; transition: all 0.3s ease; }
.verified-badge.normal { border-color: #334155; color: rgba(255, 255, 255, 0.1); background: transparent; }
.verified-badge.chosen { border-color: #facc15; color: #facc15; background: rgba(250, 204, 21, 0.1); box-shadow: 0 0 10px rgba(250, 204, 21, 0.3); }
.verified-badge.verified { border-color: #3b82f6; background: #3b82f6; color: rgba(255, 255, 255, 0.9); box-shadow: 0 0 15px rgba(59, 130, 246, 0.6); }
.verified-badge.paid { border-color: #22c55e; color: #22c55e; background: rgba(34, 197, 94, 0.1); box-shadow: 0 0 10px rgba(34, 197, 94, 0.3); }
.verified-badge svg { width: 16px; height: 16px; }

.stats-row { display: flex; align-items: center; gap: 15px; flex-wrap: wrap; }
.stat { display: flex; align-items: baseline; gap: 6px; }
.val { font-weight: 700; font-size: 1rem; color: #fff; }
.lbl { text-transform: uppercase; font-size: 0.75rem; color: #94a3b8; letter-spacing: 1px; }
.sep { color: #334155; }

/* Bio Editor Styles */
.bio-section { width: 100%; margin-top: 1rem; }
.global-toolbar { background: rgba(0,0,0,0.4); padding: 10px; border-radius: 8px 8px 0 0; border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 15px; }
.block-toolbar { background: #1e293b; padding: 10px; border: 1px solid rgba(255,255,255,0.1); border-top: none; display: flex; flex-wrap: wrap; gap: 15px; align-items: center; }
.tool-group { display: flex; flex-direction: column; gap: 2px; }
.tool-group.row { flex-direction: row; gap: 5px; margin-top: auto; }
.tool-group label { font-size: 0.6rem; color: #94a3b8; text-transform: uppercase; }
.mini-range, .tiny-range { width: 60px; height: 4px; border-radius: 2px; }
.mini-select, .mini-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 4px; border-radius: 4px; font-size: 0.8rem; }
.mini-input { width: 50px; }
.gradient-group { border-right: 1px solid rgba(255,255,255,0.1); padding-right: 10px; }
.mini-grad-row { display: flex; align-items: center; gap: 5px; }
.block-toolbar button { background: rgba(255,255,255,0.05); border: 1px solid transparent; color: #ccc; width: 28px; height: 28px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.block-toolbar button.active { background: #3b82f6; color: white; }

.bio-canvas { width: 100%; max-width: 100%; overflow-wrap: break-word; }
.bio-block { position: relative; transition: all 0.2s; word-wrap: break-word; }
.bio-block.editable { border: 1px dashed transparent; }
.bio-block.active { border-color: rgba(59,130,246,0.5); box-shadow: 0 0 0 1px rgba(59,130,246,0.2); }
.edit-wrapper { position: relative; width: 100%; }
.block-input { width: 100%; background: transparent; border: none; resize: none; overflow: hidden; outline: none; padding: 0; margin: 0; display: block; }
.view-text { white-space: pre-wrap; line-height: 1.5; }
.del-btn { position: absolute; left: -25px; top: 0; background: #ef4444; color: white; border: none; width: 20px; height: 20px; border-radius: 50%; font-size: 12px; cursor: pointer; display: none; align-items: center; justify-content: center; }
.bio-block:hover .del-btn { display: flex; }
.add-block-btn { width: 100%; padding: 8px; border: 1px dashed #334155; background: rgba(0,0,0,0.2); color: #64748b; border-radius: 6px; cursor: pointer; font-size: 0.8rem; margin-top: 10px; }
.add-block-btn:hover { border-color: #3b82f6; color: #3b82f6; }
.empty-bio { color: #64748b; font-style: italic; padding: 20px; text-align: center; }

.action-buttons { display: flex; gap: 10px; margin-top: 1.5rem; flex-wrap: wrap; }
.btn { padding: 10px 24px; border-radius: 30px; border: none; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; }
.primary-btn { background: #3b82f6; color: white; }
.save-btn { background: #10b981; color: white; }
.outline-btn { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #e2e8f0; }
.danger-btn { background: rgba(239, 68, 68, 0.1); color: #fca5a5; }
.edit-actions { display: flex; gap: 10px; }

.big-create-btn { position: absolute; bottom: -30px; right: 10%; width: 70px; height: 70px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #a855f7); border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 25px rgba(59, 130, 246, 0.5); cursor: pointer; transition: transform 0.3s; z-index: 10; }
.big-create-btn:hover { transform: scale(1.1) rotate(90deg); box-shadow: 0 15px 35px rgba(59, 130, 246, 0.7); }
.plus-icon { font-size: 2.5rem; color: white; line-height: 1; margin-top: -4px; }

/* PROJECT CARDS & OVERLAYS */
.publishes-section { padding: 4rem 5%; width: 100%; max-width: 1400px; margin: 0 auto; }
.section-title { font-size: 1.5rem; margin-bottom: 2rem; color: #e2e8f0; font-weight: 300; letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; display: inline-block; }
.projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem; padding-bottom: 4rem; }

.project-card { 
  background: rgba(30, 41, 59, 0.4); 
  border: 1px solid rgba(255, 255, 255, 0.05); 
  border-radius: 12px; 
  overflow: hidden; 
  transition: transform 0.3s, border-color 0.3s; 
  cursor: pointer; 
  position: relative;
  display: flex;
  flex-direction: column;
  height: 320px; 
}
.project-card:hover { transform: translateY(-5px); border-color: rgba(59, 130, 246, 0.4); box-shadow: 0 10px 30px rgba(0,0,0,0.3); }

.card-thumb { height: 180px; width: 100%; background-size: cover; background-position: center; border-bottom: 1px solid rgba(255,255,255,0.05); position: relative; overflow: hidden; }

/* Overlay */
.tags-overlay { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; opacity: 0; transform: translateY(10px); transition: all 0.3s ease; padding: 15px; }
.project-card:hover .tags-overlay { opacity: 1; transform: translateY(0); }
.overlay-content { width: 100%; max-height: 100%; overflow-y: auto; text-align: center; }
.overlay-title { font-size: 0.8rem; text-transform: uppercase; color: #94a3b8; margin-bottom: 10px; letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; display: inline-block; }
.tags-container { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.mini-chip { font-size: 0.75rem; padding: 4px 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); }
.mini-chip.category { background: rgba(59, 130, 246, 0.15); color: #93c5fd; border-color: rgba(59, 130, 246, 0.3); }
.mini-chip.custom { background: rgba(168, 85, 247, 0.15); color: #d8b4fe; border-color: rgba(168, 85, 247, 0.3); }
.mini-chip.warning { background: rgba(239, 68, 68, 0.15); color: #fca5a5; border-color: rgba(239, 68, 68, 0.3); font-weight: 700; }

.card-info { padding: 1.2rem; flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
.card-info h3 { margin: 0 0 0.5rem 0; font-size: 1.1rem; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.preview-tags { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; font-size: 0.8rem; color: #94a3b8; overflow: hidden; white-space: nowrap; }
.text-tag { opacity: 0.8; }
.more-tag { font-size: 0.7rem; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; }
.dot.warning { width: 8px; height: 8px; background: #ef4444; border-radius: 50%; display: inline-block; box-shadow: 0 0 5px rgba(239, 68, 68, 0.5); }
.card-meta { display: flex; justify-content: space-between; font-size: 0.8rem; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; margin-top: auto; }
.lang-tag { font-weight: 700; color: #cbd5e1; }
.empty-state { text-align: center; color: #64748b; font-style: italic; padding: 3rem; border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px; }

@media (max-width: 900px) {
  .header-inner { flex-direction: column; align-items: center; }
  .top-row { flex-direction: column; text-align: center; }
  .pfp-circle { width: 140px; height: 140px; }
  .name-col { align-items: center; }
  .stats-row { justify-content: center; }
  
  /* 🚀 FIX: Give action buttons breathing room */
  .action-buttons { justify-content: center; padding-bottom: 1rem; }
  
  /* 🚀 FIX: Add bottom margin to push the rest of the page down */
  .profile-header { padding-bottom: 2.5rem; min-height: auto; margin-bottom: 3rem; }
  
  /* 🚀 FIX: Lock the button to the bottom-center of the header */
  .big-create-btn { 
    position: absolute; 
    bottom: -35px; 
    right: 0; 
    left: 0; 
    margin: 0 auto; 
  }
  
  /* Mobile Adjust for Editor */
  .pfp-editor-modal { height: 100vh; border-radius: 0; }
  .editor-body { flex-direction: column; overflow-y: auto; }
  .visual-section { height: 50vh; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.1); }
  .matrix-container { width: 280px; height: 280px; }
  .settings-section { width: 100%; height: auto; }
}
.inventory-modal {
  width: 100%;
  max-width: 850px;
  height: 75vh;
  background: #0f172a;
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 60px rgba(0,0,0,0.8), inset 0 0 20px rgba(59, 130, 246, 0.1);
}

.inventory-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.inventory-tabs {
  display: flex;
  background: rgba(0,0,0,0.4);
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.inventory-tabs button {
  flex: 1;
  padding: 18px;
  background: transparent;
  border: none;
  color: #64748b;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  border-bottom: 3px solid transparent;
  letter-spacing: 1px;
}

.inventory-tabs button:hover:not(.active) {
  color: #cbd5e1;
  background: rgba(255,255,255,0.02);
}

.inventory-tabs button.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.inventory-content {
  flex: 1;
  padding: 25px;
  overflow-y: auto;
}
.inventory-content::-webkit-scrollbar { width: 6px; }
.inventory-content::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
.inventory-content::-webkit-scrollbar-thumb { background: rgba(59,130,246,0.3); border-radius: 4px; }

.pfp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 25px;
}

.pfp-card {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color 0.2s, box-shadow 0.2s;
}

.pfp-card:hover {
  transform: translateY(-8px);
  border-color: #3b82f6;
  box-shadow: 0 12px 25px rgba(0,0,0,0.5), 0 0 15px rgba(59, 130, 246, 0.2);
}

.pfp-preview {
  width: 100%;
  aspect-ratio: 1/1;
  background-size: cover;
  background-position: center;
  image-rendering: pixelated;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.pfp-actions {
  display: flex;
  padding: 12px;
  gap: 8px;
  background: rgba(0,0,0,0.5);
  margin-top: auto;
}

.equip-btn {
  flex: 1;
  background: #3b82f6;
  color: white;
  border: none;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.9rem;
  transition: background 0.2s;
}
.equip-btn:hover { background: #2563eb; }

.delete-btn {
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.delete-btn:hover { background: #ef4444; color: white; }

.create-new {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed rgba(59, 130, 246, 0.4);
  background: rgba(59, 130, 246, 0.05);
  cursor: pointer;
  min-height: 220px;
  color: #3b82f6;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.create-new:hover { 
  background: rgba(59, 130, 246, 0.15); 
  border-color: #60a5fa; 
  transform: scale(1.02);
}
.create-new .plus-icon { 
  font-size: 3.5rem; 
  margin-bottom: 10px; 
  font-weight: 300; 
  line-height: 1;
}

.active-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(16, 185, 129, 0.9);
  color: #fff;
  font-size: 0.75rem;
  font-weight: bold;
  padding: 4px 10px;
  border-radius: 20px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
}

/* Specific styling for Earned Rewards Tab */
.earned-card {
  border-color: rgba(245, 158, 11, 0.3);
}
.earned-card:hover {
  border-color: #f59e0b;
  box-shadow: 0 12px 25px rgba(0,0,0,0.5), 0 0 15px rgba(245, 158, 11, 0.2);
}

.earned-info {
  padding: 10px;
  text-align: center;
  background: rgba(0,0,0,0.3);
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.gift-name {
  font-size: 0.85rem;
  color: #fbbf24;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.earned-equip { background: #f59e0b; }
.earned-equip:hover { background: #d97706; }
.earned-badge { background: rgba(245, 158, 11, 0.9); }

.empty-inventory {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #64748b;
  font-style: italic;
  text-align: center;
  padding: 3rem;
  line-height: 1.6;
  font-size: 1.1rem;
}
.badges-section {
  margin-bottom: 1rem;
}

.badge-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.badge-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 15px;
  width: 140px;
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s;
}

.badge-card:hover {
  transform: translateY(-5px) scale(1.05);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(245, 158, 11, 0.2);
  border-color: rgba(245, 158, 11, 0.4);
}

.badge-img-wrapper {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 10px;
  /* 🚀 FIX: Removed the solid black background, making it transparent */
  background: transparent;
  /* Optional: You can remove the box-shadow entirely if you want the badge to truly float, 
     or keep it to add a glow effect to the bounding box */
  box-shadow: 0 4px 10px rgba(0,0,0,0.3); 
}

.badge-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated; /* Keeps 8-bit art sharp */
}

.badge-name {
  color: #fbbf24;
  font-size: 1.1rem;
  text-align: center;
  line-height: 1.2;
  text-shadow: 0 2px 4px rgba(0,0,0,0.8);
}

/* Remove Button for Edit Mode (Only applies in UserProfile.vue) */
.remove-badge-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ef4444;
  color: white;
  border: 2px solid #0f172a;
  font-weight: bold;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: transform 0.2s, background 0.2s;
}

.remove-badge-btn:hover {
  transform: scale(1.2);
  background: #dc2626;
}
</style>