<script setup>
import { ref, onMounted, computed, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const projectId = route.params.id;
const token = sessionStorage.getItem("token");

const project = ref(null);
const loading = ref(true);
const isUploading = ref(false);
const isPublishing = ref(false);
const fetchError = ref(null); // Added for error state

const localName = ref("");
const titleFont = ref("Cinzel"); 

/* --- UNHEALTHY AMOUNT OF FONTS --- */
const FONT_OPTIONS = [
  "Cinzel", "Playfair Display", "Merriweather", "Lora", "Libre Baskerville", "Cormorant Garamond", "EB Garamond",
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Raleway", "Oswald", "Quicksand",
  "Bebas Neue", "Anton", "Abril Fatface", "Righteous", "Orbitron", "Audiowide", "Russo One",
  "Dancing Script", "Pacifico", "Shadows Into Light", "Indie Flower", "Caveat", "Amatic SC", "Sacramento", "Great Vibes",
  "Creepster", "Nosifer", "Butcherman", "Eater", "Metal Mania", "Frijole", "Blackletter", 
  "Bangers", "Comic Neue", "Fredoka One", "Luckiest Guy", "Press Start 2P", "VT323"
];

/* --- LANGUAGE DATA --- */
const selectedLanguage = ref("en");
const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" }, { code: "es", name: "Spanish" }, { code: "fr", name: "French" },
  { code: "de", name: "German" }, { code: "zh", name: "Chinese (Simplified)" }, { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" }, { code: "ru", name: "Russian" }, { code: "pt", name: "Portuguese" },
  { code: "hi", name: "Hindi" }, { code: "ar", name: "Arabic" }, { code: "bn", name: "Bengali" },
  { code: "it", name: "Italian" }, { code: "nl", name: "Dutch" }, { code: "tr", name: "Turkish" },
  { code: "pl", name: "Polish" }, { code: "vi", name: "Vietnamese" }, { code: "th", name: "Thai" },
  { code: "id", name: "Indonesian" }, { code: "sv", name: "Swedish" }, { code: "fil", name: "Filipino" },
  { code: "ms", name: "Malay" }, { code: "uk", name: "Ukrainian" }, { code: "el", name: "Greek" },
  { code: "he", name: "Hebrew" }
];

/* --- CATEGORY DATA --- */
const selectedCategories = ref([]);
const CATEGORY_GROUPS = [
  { label: "Core Genres", items: ["Action", "Adventure", "RPG", "Strategy", "Simulation", "Horror", "Romance", "Mystery", "Fantasy", "Sci-Fi", "Slice of Life", "Comedy", "Drama", "Thriller", "Sports", "Music", "Educational", "Puzzle", "Idle"] },
  { label: "Sub-Genres & Settings", items: ["Cyberpunk", "Steampunk", "Dieselpunk", "Solarpunk", "Dystopian", "Post-Apocalyptic", "Space Opera", "Mecha", "Noir", "Neo-Noir", "Western", "Historical", "Alternate History", "Urban Fantasy", "Dark Fantasy", "High Fantasy", "Isekai", "Supernatural", "Paranormal", "Magic Realism", "Mythology", "Folklore", "Superhero", "Martial Arts", "Military", "War", "Espionage"] },
  { label: "Narrative Styles", items: ["Visual Novel", "Interactive Fiction", "Kinetic Novel", "Dating Sim", "Otome", "Galge", "Text-Based", "Point & Click", "Choice Matters", "Multiple Endings", "Episodic"] },
  { label: "Themes & Moods", items: ["Psychological", "Philosophical", "Surreal", "Abstract", "Cozy", "Wholesome", "Relaxing", "Atmospheric", "Tragedy", "Satire", "Parody", "Memes", "Dark Humor", "Coming of Age", "School Life", "Workplace", "Medical", "Legal", "Crime", "Detective", "Survival", "Battle Royale", "Time Travel"] },
  { label: "Mature & Specific", items: ["18+ (NSFW)", "Violence", "Gore", "Body Horror", "LGBTQ+", "BL (Boys' Love)", "GL (Girls' Love)", "Harem", "Vampire", "Werewolf", "Zombies", "Lovecraftian", "Gothic"] }
];

const toggleCategory = (cat) => {
  if (selectedCategories.value.includes(cat)) {
    selectedCategories.value = selectedCategories.value.filter(c => c !== cat);
  } else {
    selectedCategories.value.push(cat);
  }
};

/* --- CUSTOM CATEGORIES --- */
const customCategories = ref([]);
const newCustomCategory = ref("");

const addCustomCategory = () => {
  const val = newCustomCategory.value.trim();
  if (val && !customCategories.value.includes(val)) {
    customCategories.value.push(val);
  }
  newCustomCategory.value = "";
};

const removeCustomCategory = (cat) => {
  customCategories.value = customCategories.value.filter(c => c !== cat);
};

/* --- WARNINGS --- */
const selectedWarnings = ref([]);
const isSafeContent = ref(false);
const isThumbnailNSFW = ref(false);

const WARNING_OPTIONS = [
  "Sexual Content", "Graphic Violence", "Strong Language", "Substance Abuse", 
  "Self-Harm", "Nudity", "Flashing Lights", "Jump Scares", "Trauma / PTSD",
  "Suicide / Suicidal Ideation", "Sexual Assault / Non-Con", "Domestic Abuse", 
  "Child Abuse", "Animal Cruelty", "Gambling", "Eating Disorders", 
  "Body Dysmorphia", "Gaslighting", "Stalking", "Kidnapping / Abduction", 
  "Hate Speech / Discrimination", "Misogyny / Sexism", "Racism", 
  "Homophobia / Transphobia", "Religious Iconography / Cults",
  "Claustrophobia", "Arachnophobia (Spiders)", "Thalassophobia (Deep Water)", 
  "Trypophobia (Holes)", "Emetic / Vomiting"
];

const toggleWarning = (warn) => {
  isSafeContent.value = false;
  if (selectedWarnings.value.includes(warn)) {
    selectedWarnings.value = selectedWarnings.value.filter(w => w !== warn);
  } else {
    selectedWarnings.value.push(warn);
  }
};

const setSafeContent = () => {
  isSafeContent.value = !isSafeContent.value;
  if (isSafeContent.value) {
    selectedWarnings.value = [];
  }
};

/* --- MONETIZATION STATE --- */
const isPaid = ref(false);
const hasDemo = ref(false);
const demoNodeLimit = ref(10);

/* --- ADVANCED DESCRIPTION STATE --- */
const containerColors = ref(["#1e293b", "#0f172a"]);
const containerAngle = ref(135);
const blocks = ref([]);
const activeBlockId = ref(null); 
const blockRefs = ref({}); 

const getGradient = (colors, angle) => {
  if (!colors || colors.length === 0) return 'transparent';
  if (colors.length === 1) return colors[0];
  return `linear-gradient(${angle}deg, ${colors.join(', ')})`;
};

const containerStyle = computed(() => ({
  background: getGradient(containerColors.value, containerAngle.value)
}));

/* --- PUBLISH STATUS TRACKER --- */
const Publish_Status = computed(() => {
  return {
    id: projectId,
    thumbnail: project.value?.thumbnail || null,
    name: localName.value,
    titleFont: titleFont.value,
    description: blocks.value,
    language: selectedLanguage.value,
    categories: selectedCategories.value,
    customCategories: customCategories.value,
    warnings: selectedWarnings.value,
    isThumbnailNSFW: isThumbnailNSFW.value,
    monetization: {
      isPaid: isPaid.value,
      hasDemo: hasDemo.value,
      demoNodeLimit: demoNodeLimit.value
    }
  }
});

watch(Publish_Status, (newStatus) => {
  console.log("Publish_Status Update:", newStatus);
}, { deep: true });

/* --- FORM VALIDATION --- */
const isFormValid = computed(() => {
  if (!localName.value || localName.value.trim() === "") return false;
  if (selectedCategories.value.length === 0) return false;
  if (!isSafeContent.value && selectedWarnings.value.length === 0) return false;
  if (blocks.value.length === 0) return false;
  return true;
});

/* --- BLOCK ACTIONS --- */
const addBlock = async () => {
  const id = Date.now();
  blocks.value.push({
    id,
    type: 'text',
    content: "",
    isBold: false,
    isItalic: false,
    fontFamily: 'Inter',
    align: 'center',
    fontSize: 18, 
    textColors: ['#ffffff'],
    textAngle: 90,
    bgColors: ['transparent'],
    bgAngle: 90
  });
  
  activeBlockId.value = id;
  await nextTick();
  if (blockRefs.value[id]) {
    blockRefs.value[id].focus();
    autoResize(blockRefs.value[id]);
  }
};

const removeBlock = (index) => {
  blocks.value.splice(index, 1);
  activeBlockId.value = null;
};

const checkContent = (block, event) => {
  if (event && event.target) autoResize(event.target);
  const gifRegex = /\.(gif|webp|png|jpg|jpeg)($|\?)/i;
  block.type = gifRegex.test(block.content) ? 'gif' : 'text';
};

const autoResize = (el) => {
  if (!el) return;
  el.style.height = 'auto'; 
  el.style.height = el.scrollHeight + 'px'; 
};

watch(blocks, async () => {
  await nextTick();
  for (const id in blockRefs.value) {
    autoResize(blockRefs.value[id]);
  }
}, { deep: true });

/* --- COLOR HELPERS --- */
const addColor = (array) => { array.push('#3b82f6'); };
const removeColor = (array, index) => { if (array.length > 1) array.splice(index, 1); };

/* --- API CALLS --- */
const fetchProjectDetails = async () => {
  try {
    const res = await fetch(`http://localhost:5000/projects/details/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      project.value = await res.json();
      localName.value = project.value.name;
      
      if (project.value.titleFont) titleFont.value = project.value.titleFont;
      if (project.value.categories) selectedCategories.value = project.value.categories;
      if (project.value.customCategories) customCategories.value = project.value.customCategories;
      if (project.value.warnings) selectedWarnings.value = project.value.warnings;
      if (selectedWarnings.value.length === 0 && project.value.isSafeContent) isSafeContent.value = true;
      if (project.value.language) selectedLanguage.value = project.value.language;
      if (project.value.isThumbnailNSFW) isThumbnailNSFW.value = project.value.isThumbnailNSFW;

      if (project.value.monetization) {
        isPaid.value = project.value.monetization.isPaid || false;
        hasDemo.value = project.value.monetization.hasDemo || false;
        demoNodeLimit.value = project.value.monetization.demoNodeLimit || 10;
      }

      try {
        const parsed = JSON.parse(project.value.description);
        if (Array.isArray(parsed)) blocks.value = parsed;
        else throw new Error();
      } catch (e) {
        if (project.value.description) {
           blocks.value = [{ 
             id: 1, type: 'text', content: project.value.description, fontSize: 18,
             fontFamily: 'Inter', textColors: ['#ffffff'], bgColors: ['transparent'], align: 'left' 
           }];
        }
      }
      nextTick(() => { for (const id in blockRefs.value) autoResize(blockRefs.value[id]); });
    } else {
      fetchError.value = "Failed to load project data. You may need to log in again.";
    }
  } catch (e) { 
    console.error(e); 
    fetchError.value = "Network error while loading project.";
  } finally { loading.value = false; }
};

const handleFileChange = async (e) => {
  const file = e.target.files[0];
  if (!file || file.size > 5 * 1024 * 1024) return;
  const reader = new FileReader();
  reader.onload = async (v) => await updateThumbnail(v.target.result);
  reader.readAsDataURL(file);
};

const updateThumbnail = async (base64) => {
  isUploading.value = true;
  await saveProject(base64);
  isUploading.value = false;
};

const publishProject = async () => {
  await saveProject(null);

  if (isPaid.value) {
    alert("Paid publishing is coming soon! Only Free projects can be published right now.");
    return;
  }

  isPublishing.value = true;
  try {
    const res = await fetch("http://localhost:5000/publish", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify(Publish_Status.value)
    });

    const data = await res.json();
    
    if (res.ok) {
      alert("🎉 Successfully Published to the Feed!");
      router.push('/create');
    } else {
      alert("Publishing Failed: " + data.message);
    }
  } catch (e) {
    console.error("Publish error", e);
    alert("Network error occurred.");
  } finally {
    isPublishing.value = false;
  }
};

const saveProject = async (newThumbnail = null) => {
  try {
    const payload = {
      name: localName.value,
      titleFont: titleFont.value,
      description: JSON.stringify(blocks.value), 
      categories: selectedCategories.value,
      customCategories: customCategories.value,
      warnings: selectedWarnings.value,
      isSafeContent: isSafeContent.value,
      language: selectedLanguage.value, 
      isThumbnailNSFW: isThumbnailNSFW.value,
      monetization: { 
        isPaid: isPaid.value,
        hasDemo: hasDemo.value,
        demoNodeLimit: demoNodeLimit.value
      },
      thumbnail: newThumbnail || project.value.thumbnail,
      titleFont: titleFont.value // Added to ensure font is saved
    };
    const res = await fetch(`http://localhost:5000/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      project.value = data.project;
    }
  } catch(e) { console.error(e); }
};

onMounted(() => {
  if (!projectId) return router.push("/create");
  fetchProjectDetails();
});

const activeBlock = computed(() => {
  return blocks.value.find(b => b.id === activeBlockId.value);
});
</script>

<template>
  <div class="publish-page">
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Summoning Project Details...</p>
    </div>

    <div v-else-if="fetchError" class="error-state">
      <h3>⚠️ Error Loading Project</h3>
      <p>{{ fetchError }}</p>
      <button @click="router.push('/create')" class="back-btn">Return to Tapestry</button>
    </div>

    <div class="publish-container" v-else-if="project">
      
      <div class="left-panel">
        <div class="thumbnail-editor" :style="{ backgroundImage: project.thumbnail ? `url(${project.thumbnail})` : 'linear-gradient(to bottom right, #000, #1e3a8a)' }">
          <div class="overlay" v-if="!isUploading">
             <label class="change-btn"><span>Change Cover</span><input type="file" @change="handleFileChange" hidden /></label>
          </div>
          <div class="overlay loading" v-else><div class="spinner"></div></div>
          
          <div v-if="isThumbnailNSFW" class="nsfw-overlay-badge">NSFW</div>
        </div>
        
        <button class="publish-btn" @click="publishProject" :disabled="isPublishing || !isFormValid">
          <span v-if="!isPublishing">{{ isFormValid ? '🚀 Publish to Feed' : '📝 Complete Details to Publish' }}</span>
          <span v-else>✨ Weaving...</span>
        </button>

        <div class="dashboard-box">
          <h4 class="dash-title">Publication Summary</h4>
          
          <div class="dash-meta-row">
            <span class="meta-label">Language:</span>
            <span class="meta-val">{{ SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name || selectedLanguage }}</span>
          </div>

          <div class="dash-meta-row">
            <span class="meta-label">Model:</span>
            <span class="meta-val" :class="{ 'paid-text': isPaid, 'free-text': !isPaid }">
              {{ isPaid ? 'Premium / Paid' : 'Free to Play' }}
            </span>
          </div>
          <div v-if="isPaid && hasDemo" class="dash-meta-row">
            <span class="meta-label">Demo:</span>
            <span class="meta-val">Enabled ({{ demoNodeLimit }} Nodes)</span>
          </div>

          <div v-if="selectedCategories.length > 0">
            <span class="dash-subtitle">Categories</span>
            <div class="dash-tags">
              <span v-for="cat in selectedCategories" :key="cat" class="mini-tag blue">{{ cat }}</span>
            </div>
          </div>

          <div v-if="customCategories.length > 0">
            <span class="dash-subtitle">Custom Tags</span>
            <div class="dash-tags">
              <span v-for="cat in customCategories" :key="cat" class="mini-tag orange">{{ cat }}</span>
            </div>
          </div>

          <div v-if="selectedWarnings.length > 0 || isThumbnailNSFW">
            <span class="dash-subtitle">Content Warnings</span>
            <div class="dash-tags">
              <span v-if="isThumbnailNSFW" class="mini-tag red">NSFW Cover</span>
              <span v-for="warn in selectedWarnings" :key="warn" class="mini-tag red">{{ warn }}</span>
            </div>
          </div>

          <div v-if="isSafeContent && !isThumbnailNSFW" class="safe-badge">
            ✅ Safe / All Ages
          </div>

          <div v-if="selectedCategories.length === 0 && customCategories.length === 0 && selectedWarnings.length === 0 && !isSafeContent" class="empty-dash">
            No tags selected yet.
          </div>
        </div>
      </div>

      <div class="right-panel">
        
        <div class="header-section">
          <label class="input-label">PROJECT TITLE & FONT</label>
          <div class="title-row">
             <input 
               v-model="localName" 
               class="title-input" 
               placeholder="Name your world..." 
               :style="{ fontFamily: titleFont }" 
             />
             <div class="font-select-wrap">
               <select v-model="titleFont" class="font-select">
                 <option v-for="f in FONT_OPTIONS" :key="f" :value="f" :style="{ fontFamily: f }">{{ f }}</option>
               </select>
             </div>
          </div>
        </div>

        <div class="section-container">
          <label class="input-label">DESCRIPTION / STORY BOARD</label>
          <div class="desc-box-container">
            <div class="desc-header">
              <span class="header-label">Canvas Background</span>
              <div class="gradient-controls">
                <div v-for="(color, idx) in containerColors" :key="idx" class="color-wrap">
                  <input type="color" v-model="containerColors[idx]" />
                  <button v-if="containerColors.length > 1" @click="removeColor(containerColors, idx)" class="tiny-del">×</button>
                </div>
                <button class="add-color-btn" @click="addColor(containerColors)">+</button>
                <div class="angle-slider-wrap">
                  <label>Angle</label>
                  <input type="range" v-model="containerAngle" min="0" max="360" />
                </div>
              </div>
            </div>

            <div class="desc-toolbar" v-if="activeBlock && activeBlock.type === 'text'">
              <div class="toolbar-section">
                <label>Text Color</label>
                <div class="gradient-controls small">
                  <div v-for="(c, i) in activeBlock.textColors" :key="i" class="color-wrap">
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
                  <div v-for="(c, i) in activeBlock.bgColors" :key="i" class="color-wrap">
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

            <div class="desc-canvas" :style="containerStyle">
              <div 
                v-for="(block, index) in blocks" 
                :key="block.id" 
                class="desc-block-row"
                @click="activeBlockId = block.id"
                :style="{
                  background: getGradient(block.bgColors, block.bgAngle),
                  borderRadius: '6px' 
                }"
              >
              <button class="row-del-btn" @click.stop="removeBlock(index)">×</button>
                <div v-if="block.type === 'gif'" class="gif-wrapper" :style="{ justifyContent: block.align }">
                  <img :src="block.content" />
                  <button class="revert-btn" @click="block.type='text'; block.content=''">Edit Link</button>
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
                    color: block.textColors.length > 1 ? 'transparent' : block.textColors[0],
                    backgroundImage: block.textColors.length > 1 ? getGradient(block.textColors, block.textAngle) : 'none',
                    webkitBackgroundClip: block.textColors.length > 1 ? 'text' : 'unset',
                    backgroundClip: block.textColors.length > 1 ? 'text' : 'unset'
                  }"
                ></textarea>
              </div>
              <button class="add-text-btn" @click="addBlock">+ Add Text / GIF</button>
            </div>
          </div>
        </div>

        <div class="section-container">
          <label class="input-label">PROJECT LANGUAGE</label>
          <div class="lang-select-wrapper">
             <select v-model="selectedLanguage" class="lang-select">
                <option v-for="lang in SUPPORTED_LANGUAGES" :key="lang.code" :value="lang.code">
                  {{ lang.name }}
                </option>
             </select>
          </div>
        </div>

        <div class="section-container">
          <label class="input-label">PROJECT TAGS & CATEGORIES</label>
          <div class="categories-wrapper">
            <div v-for="(group, index) in CATEGORY_GROUPS" :key="index" class="category-group">
              <h4 class="group-title">{{ group.label }}</h4>
              <div class="tags-grid">
                <button 
                  v-for="tag in group.items" 
                  :key="tag"
                  class="tag-chip"
                  :class="{ selected: selectedCategories.includes(tag) }"
                  @click="toggleCategory(tag)"
                >
                  {{ tag }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="section-container">
          <label class="input-label">CUSTOM TAGS</label>
          <div class="custom-cat-wrapper">
            <div class="input-row">
              <input 
                v-model="newCustomCategory" 
                @keyup.enter="addCustomCategory" 
                class="custom-input" 
                placeholder="Type a tag and press Enter..." 
              />
              <button @click="addCustomCategory" class="add-custom-btn">+</button>
            </div>
            
            <div class="tags-grid mt-10">
              <div v-for="cat in customCategories" :key="cat" class="custom-tag-chip">
                {{ cat }}
                <button @click="removeCustomCategory(cat)" class="del-custom">×</button>
              </div>
            </div>
          </div>
        </div>

        <div class="section-container">
          <label class="input-label" style="color: #fca5a5;">CONTENT WARNINGS & SAFETY</label>
          <div class="categories-wrapper warning-wrapper">
            
            <button 
              class="tag-chip safe-mode" 
              :class="{ selected: isSafeContent }"
              @click="setSafeContent"
            >
              🛡️ No Warnings / Safe Material
            </button>

            <div class="tags-grid">
              <button 
                v-for="warn in WARNING_OPTIONS" 
                :key="warn"
                class="tag-chip warning-chip"
                :class="{ selected: selectedWarnings.includes(warn) }"
                @click="toggleWarning(warn)"
              >
                ⚠️ {{ warn }}
              </button>
            </div>
          </div>
        </div>

        <div class="section-container">
           <div class="nsfw-toggle-row">
              <div class="nsfw-info">
                 <span class="nsfw-label">Thumbnail Content</span>
                 <p class="nsfw-desc">Does your cover image contain sensitive or NSFW content?</p>
              </div>
              <label class="toggle-switch">
                 <input type="checkbox" v-model="isThumbnailNSFW" />
                 <span class="slider"></span>
              </label>
           </div>
        </div>

        <div class="section-container">
          <label class="input-label">MONETIZATION</label>
          <div class="categories-wrapper" style="border-color: rgba(59, 130, 246, 0.3);">
            
            <div class="monetization-row">
              <button 
                class="tag-chip" 
                :class="{ selected: !isPaid }" 
                @click="isPaid = false"
              >
                🎁 Free to Play
              </button>
              <button 
                class="tag-chip" 
                :class="{ selected: isPaid }" 
                @click="isPaid = true"
              >
                💎 Paid / Premium
              </button>
            </div>

            <div v-if="isPaid" class="demo-config-section">
              <div class="nsfw-toggle-row no-border">
                <div class="nsfw-info">
                   <span class="nsfw-label">Enable Free Demo?</span>
                   <p class="nsfw-desc">Allow users to play a limited portion of the project.</p>
                </div>
                <label class="toggle-switch">
                   <input type="checkbox" v-model="hasDemo" />
                   <span class="slider"></span>
                </label>
              </div>

              <div v-if="hasDemo" class="demo-limit-row">
                <label class="input-label mb-0">Demo Limit (Nodes)</label>
                <div class="number-input-wrap">
                  <input type="number" v-model="demoNodeLimit" class="demo-num-input" min="1" />
                  <span class="limit-desc">Users can play up to {{ demoNodeLimit }} nodes.</span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* GOOGLE FONTS IMPORT - THE UNHEALTHY LIST */
@import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Amatic+SC&family=Anton&family=Audiowide&family=Bangers&family=Bebas+Neue&family=Blackletter&family=Butcherman&family=Caveat&family=Cinzel:wght@400;700&family=Comic+Neue:wght@400;700&family=Cormorant+Garamond:wght@400;700&family=Creepster&family=Dancing+Script:wght@400;700&family=EB+Garamond&family=Eater&family=Fredoka+One&family=Frijole&family=Great+Vibes&family=Indie+Flower&family=Inter:wght@400;700&family=Lato:wght@400;700&family=Libre+Baskerville&family=Lora&family=Luckiest+Guy&family=Merriweather&family=Metal+Mania&family=Montserrat:wght@400;700&family=Nosifer&family=Open+Sans:wght@400;700&family=Orbitron&family=Oswald&family=Pacifico&family=Playfair+Display:wght@400;700&family=Poppins:wght@400;700&family=Press+Start+2P&family=Quicksand:wght@400;700&family=Raleway:wght@400;700&family=Righteous&family=Roboto:wght@400;700&family=Ruslan+Display&family=Russo+One&family=Sacramento&family=Shadows+Into+Light&family=VT323&display=swap');

/* MAIN LAYOUT */
.publish-page { min-height: 100vh; background: #020617; color: white; padding: 2rem; display: flex; justify-content: center; font-family: 'Inter', sans-serif; }
.publish-container { display: flex; gap: 3rem; max-width: 1200px; width: 100%; align-items: flex-start; }

.loading-state, .error-state { text-align: center; margin-top: 100px; color: #94a3b8; }
.back-btn { margin-top: 20px; padding: 10px 20px; background: #3b82f6; border: none; color: white; border-radius: 8px; cursor: pointer; }

.left-panel { flex: 0.8; position: sticky; top: 2rem; display: flex; flex-direction: column; gap: 1.5rem; }
.thumbnail-editor { width: 100%; aspect-ratio: 16/9; border-radius: 20px; background-size: cover; background-position: center; border: 1px solid rgba(255,255,255,0.1); position: relative; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
.overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; opacity: 0; transition: 0.3s; }
.thumbnail-editor:hover .overlay { opacity: 1; }
.change-btn { background: white; color: black; padding: 10px 20px; border-radius: 30px; font-weight: 700; cursor: pointer; transition: transform 0.2s; }
.change-btn:hover { transform: scale(1.05); }

/* NSFW Badge on Thumbnail */
.nsfw-overlay-badge { position: absolute; bottom: 10px; right: 10px; background: #ef4444; color: white; font-weight: 800; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; box-shadow: 0 2px 10px rgba(0,0,0,0.5); }

.right-panel { flex: 1; display: flex; flex-direction: column; gap: 2.5rem; width: 100%; }

/* LABELS & HEADER */
.input-label { display: block; font-size: 0.8rem; font-weight: 700; color: #94a3b8; letter-spacing: 1px; margin-bottom: 0.8rem; text-transform: uppercase; }
.header-section { display: flex; flex-direction: column; }

/* TITLE & FONT ROW */
.title-row { display: flex; gap: 15px; align-items: flex-end; }
.title-input { flex: 1; background: transparent; border: none; border-bottom: 2px solid #334155; color: white; font-size: 2.5rem; font-weight: 800; padding: 5px 0; transition: border-color 0.3s; width: 100%; }
.title-input:focus { border-color: #3b82f6; outline: none; }

.font-select-wrap { width: 140px; }
.font-select { width: 100%; background: #0f172a; border: 1px solid #334155; color: white; padding: 8px; border-radius: 8px; outline: none; cursor: pointer; font-size: 0.9rem; }
.font-select.mini { width: 120px; padding: 5px; font-size: 0.8rem; }
.font-select option { background: #1e293b; color: white; padding: 5px; }

.publish-btn { 
  width: 100%; background: linear-gradient(135deg, #3b82f6, #a855f7); border: none; color: white; padding: 16px; border-radius: 12px; font-weight: 700; font-size: 1.1rem; cursor: pointer; box-shadow: 0 10px 25px rgba(59, 130, 246, 0.4); transition: all 0.2s; display: flex; justify-content: center; align-items: center; gap: 10px;
}
.publish-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(59, 130, 246, 0.6); }
.publish-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; filter: grayscale(0.8); }

/* DASHBOARD SUMMARY */
.dashboard-box { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 15px; }
.dash-title { margin: 0 0 5px 0; color: #cbd5e1; font-size: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; }
.dash-subtitle { font-size: 0.75rem; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 5px; }
.dash-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.dash-meta-row { display: flex; justify-content: space-between; font-size: 0.85rem; color: #cbd5e1; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; }
.meta-label { color: #94a3b8; }
.meta-val { font-weight: 600; color: #fff; }
.paid-text { color: #3b82f6; } /* Blue for Paid */
.free-text { color: #86efac; } /* Green for Free */

.mini-tag { font-size: 0.75rem; padding: 4px 10px; border-radius: 12px; font-weight: 600; }
.mini-tag.blue { background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.3); }
.mini-tag.orange { background: rgba(249, 115, 22, 0.2); color: #fdba74; border: 1px solid rgba(249, 115, 22, 0.3); }
.mini-tag.red { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); }
.safe-badge { color: #86efac; font-weight: 600; font-size: 0.9rem; text-align: center; border: 1px dashed #22c55e; padding: 8px; border-radius: 8px; background: rgba(34, 197, 94, 0.1); }
.empty-dash { color: #475569; font-style: italic; text-align: center; font-size: 0.9rem; }

/* LANGUAGE SELECT */
.lang-select-wrapper { background: #0f172a; padding: 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); }
.lang-select { width: 100%; background: transparent; border: none; color: white; font-size: 1rem; outline: none; padding: 5px; cursor: pointer; }
.lang-select option { background: #1e293b; color: white; }

/* DESCRIPTION EDITOR */
.section-container { display: flex; flex-direction: column; }
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
.desc-block-row { position: relative; width: 100%; transition: transform 0.2s; }
.desc-block-row:hover .row-del-btn { opacity: 1; }
.block-input { width: 100%; border: 1px dashed transparent; padding: 10px; outline: none; border-radius: 6px; transition: border-color 0.2s; resize: none; overflow: hidden; caret-color: #ffffff; font-family: inherit; line-height: 1.4; min-height: 40px; }
.block-input:focus { border-color: rgba(255,255,255,0.3); box-shadow: 0 0 15px rgba(0,0,0,0.1); }
.gif-wrapper { display: flex; width: 100%; position: relative; padding: 10px 0; }
.gif-wrapper img { max-width: 100%; border-radius: 8px; max-height: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
.revert-btn { position: absolute; top: 20px; right: 20px; background: rgba(0,0,0,0.7); padding: 5px 10px; border-radius: 4px; border: none; color: white; cursor: pointer; font-size: 0.8rem; backdrop-filter: blur(4px); }
.row-del-btn { position: absolute; left: -35px; top: 50%; transform: translateY(-50%); background: #ef4444; border: none; color: white; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; opacity: 0; transition: 0.2s; z-index: 10; display: flex; align-items: center; justify-content: center; padding-bottom: 2px; }
.add-text-btn { margin-top: 15px; width: 100%; padding: 12px; background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.2); color: #94a3b8; border-radius: 8px; cursor: pointer; transition: 0.2s; font-size: 0.9rem; }
.add-text-btn:hover { background: rgba(255,255,255,0.1); color: white; border-color: #3b82f6; }

/* CATEGORY STYLES */
.categories-wrapper { display: flex; flex-direction: column; gap: 20px; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.05); padding: 25px; border-radius: 12px; }
.category-group { display: flex; flex-direction: column; gap: 10px; }
.group-title { margin: 0; color: #cbd5e1; font-size: 0.9rem; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; }
.tags-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.mt-10 { margin-top: 10px; }
.tag-chip { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-size: 0.85rem; transition: all 0.2s; }
.tag-chip:hover { border-color: #a855f7; color: white; background: rgba(168, 85, 247, 0.1); }
.tag-chip.selected { background: linear-gradient(135deg, #3b82f6, #a855f7); border-color: transparent; color: white; font-weight: 600; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3); }

/* CUSTOM TAGS */
.custom-cat-wrapper { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; }
.input-row { display: flex; gap: 10px; }
.custom-input { flex: 1; background: #0f172a; border: 1px solid #334155; padding: 10px; border-radius: 8px; color: white; outline: none; }
.add-custom-btn { width: 40px; background: #334155; border: none; color: white; border-radius: 8px; cursor: pointer; font-size: 1.2rem; }
.add-custom-btn:hover { background: #3b82f6; }
.custom-tag-chip { background: rgba(249, 115, 22, 0.15); color: #fdba74; border: 1px solid rgba(249, 115, 22, 0.3); padding: 6px 14px; border-radius: 20px; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; }
.del-custom { background: transparent; border: none; color: #fdba74; cursor: pointer; font-size: 1.1rem; line-height: 1; padding: 0; }
.del-custom:hover { color: white; }

/* WARNINGS */
.warning-wrapper { border-color: rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05); }
.warning-chip:hover { border-color: #ef4444; background: rgba(239, 68, 68, 0.1); color: #fca5a5; }
.warning-chip.selected { background: linear-gradient(135deg, #ef4444, #b91c1c); border-color: transparent; color: white; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3); }
.safe-mode { border-color: #22c55e; color: #86efac; }
.safe-mode:hover { background: rgba(34, 197, 94, 0.1); color: white; }
.safe-mode.selected { background: #22c55e; color: black; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4); }

/* NSFW TOGGLE ROW (Shared Style for Monetization too) */
.nsfw-toggle-row { display: flex; justify-content: space-between; align-items: center; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); padding: 20px; border-radius: 12px; }
.nsfw-toggle-row.no-border { border: none; background: transparent; padding: 0; margin-bottom: 20px; } /* For demo toggle */
.nsfw-label { font-weight: 700; color: #fca5a5; font-size: 1rem; }
.nsfw-desc { margin: 5px 0 0 0; color: #94a3b8; font-size: 0.85rem; }

/* MONETIZATION STYLES */
.monetization-row { display: flex; gap: 10px; margin-bottom: 20px; }
.demo-config-section { background: rgba(0, 0, 0, 0.2); padding: 20px; border-radius: 12px; border: 1px dashed rgba(255, 255, 255, 0.1); }
.demo-limit-row { display: flex; flex-direction: column; gap: 8px; }
.number-input-wrap { display: flex; align-items: center; gap: 15px; }
.demo-num-input { width: 80px; padding: 8px; border-radius: 8px; background: #0f172a; border: 1px solid #334155; color: white; outline: none; }
.limit-desc { font-size: 0.85rem; color: #64748b; }
.mb-0 { margin-bottom: 0; }

/* TOGGLE SWITCH */
.toggle-switch { position: relative; display: inline-block; width: 50px; height: 26px; }
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; inset: 0; background-color: #334155; transition: .4s; border-radius: 34px; }
.slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
input:checked + .slider { background-color: #ef4444; }
input:checked + .slider:before { transform: translateX(24px); }

.spinner { width: 30px; height: 30px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
  .publish-container { flex-direction: column; }
  .left-panel { position: static; width: 100%; }
}
</style>