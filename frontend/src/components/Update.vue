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
const fetchError = ref(null);

const localName = ref("");
const titleFont = ref("Cinzel"); 

/* --- FONTS & LISTS --- */
const FONT_OPTIONS = [
  "Cinzel", "Playfair Display", "Merriweather", "Lora", "Libre Baskerville", "Cormorant Garamond", "EB Garamond",
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Raleway", "Oswald", "Quicksand",
  "Bebas Neue", "Anton", "Abril Fatface", "Righteous", "Orbitron", "Audiowide", "Russo One",
  "Dancing Script", "Pacifico", "Shadows Into Light", "Indie Flower", "Caveat", "Amatic SC", "Sacramento", "Great Vibes",
  "Creepster", "Nosifer", "Butcherman", "Eater", "Metal Mania", "Frijole", "Blackletter", 
  "Bangers", "Comic Neue", "Fredoka One", "Luckiest Guy", "Press Start 2P", "VT323"
];

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

const customCategories = ref([]);
const newCustomCategory = ref("");
const addCustomCategory = () => {
  const val = newCustomCategory.value.trim();
  if (val && !customCategories.value.includes(val)) customCategories.value.push(val);
  newCustomCategory.value = "";
};
const removeCustomCategory = (cat) => {
  customCategories.value = customCategories.value.filter(c => c !== cat);
};

const selectedWarnings = ref([]);
const isSafeContent = ref(false);
const isThumbnailNSFW = ref(false);
const WARNING_OPTIONS = ["Sexual Content", "Graphic Violence", "Strong Language", "Substance Abuse", "Self-Harm", "Nudity", "Flashing Lights", "Jump Scares", "Trauma / PTSD", "Suicide / Suicidal Ideation", "Sexual Assault / Non-Con", "Domestic Abuse", "Child Abuse", "Animal Cruelty", "Gambling", "Eating Disorders", "Body Dysmorphia", "Gaslighting", "Stalking", "Kidnapping / Abduction", "Hate Speech / Discrimination", "Misogyny / Sexism", "Racism", "Homophobia / Transphobia", "Religious Iconography / Cults", "Claustrophobia", "Arachnophobia (Spiders)", "Thalassophobia (Deep Water)", "Trypophobia (Holes)", "Emetic / Vomiting"];

const toggleWarning = (warn) => {
  isSafeContent.value = false;
  if (selectedWarnings.value.includes(warn)) selectedWarnings.value = selectedWarnings.value.filter(w => w !== warn);
  else selectedWarnings.value.push(warn);
};
const setSafeContent = () => {
  isSafeContent.value = !isSafeContent.value;
  if (isSafeContent.value) selectedWarnings.value = [];
};

const isPaid = ref(false);
const hasDemo = ref(false);
const demoNodeLimit = ref(10);

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
const containerStyle = computed(() => ({ background: getGradient(containerColors.value, containerAngle.value) }));

/* --- PUBLISH STATUS TRACKER --- */
const Publish_Status = computed(() => ({
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
    monetization: { isPaid: isPaid.value, hasDemo: hasDemo.value, demoNodeLimit: demoNodeLimit.value }
}));

const isFormValid = computed(() => {
  if (!localName.value || localName.value.trim() === "") return false;
  if (selectedCategories.value.length === 0) return false;
  if (!isSafeContent.value && selectedWarnings.value.length === 0) return false;
  if (blocks.value.length === 0) return false;
  return true;
});

/* --- ACTIONS --- */
const addBlock = async () => {
  const id = Date.now();
  blocks.value.push({
    id, type: 'text', content: "", isBold: false, isItalic: false, fontFamily: 'Inter',
    align: 'center', fontSize: 18, textColors: ['#ffffff'], textAngle: 90, bgColors: ['transparent'], bgAngle: 90
  });
  activeBlockId.value = id;
  await nextTick();
  if (blockRefs.value[id]) { blockRefs.value[id].focus(); autoResize(blockRefs.value[id]); }
};
const removeBlock = (index) => { blocks.value.splice(index, 1); activeBlockId.value = null; };
const checkContent = (block, event) => {
  if (event && event.target) autoResize(event.target);
  const gifRegex = /\.(gif|webp|png|jpg|jpeg)($|\?)/i;
  block.type = gifRegex.test(block.content) ? 'gif' : 'text';
};
const autoResize = (el) => { if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
watch(blocks, async () => { await nextTick(); for (const id in blockRefs.value) autoResize(blockRefs.value[id]); }, { deep: true });
const addColor = (array) => { array.push('#3b82f6'); };
const removeColor = (array, index) => { if (array.length > 1) array.splice(index, 1); };

/* --- API CALLS --- */
// ✅ FETCH PUBLISHED DETAILS INSTEAD OF DRAFT
const fetchPublishedDetails = async () => {
  try {
    const res = await fetch(`http://localhost:5000/publish/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      project.value = await res.json();
      localName.value = project.value.name;
      
      if (project.value.titleFont) titleFont.value = project.value.titleFont;
      if (project.value.categories) selectedCategories.value = project.value.categories;
      if (project.value.customCategories) customCategories.value = project.value.customCategories;
      if (project.value.warnings) selectedWarnings.value = project.value.warnings;
      if (selectedWarnings.value.length === 0 && (!project.value.warnings || project.value.warnings.length === 0)) isSafeContent.value = true;
      if (project.value.language) selectedLanguage.value = project.value.language;
      if (project.value.isThumbnailNSFW) isThumbnailNSFW.value = project.value.isThumbnailNSFW;

      if (project.value.monetization) {
        isPaid.value = project.value.monetization.isPaid || false;
        hasDemo.value = project.value.monetization.hasDemo || false;
        demoNodeLimit.value = project.value.monetization.demoNodeLimit || 10;
      }

      // Load Description Blocks
      if (Array.isArray(project.value.description)) {
          blocks.value = project.value.description;
      } else {
          // Fallback if structure changed
          blocks.value = [{ 
             id: 1, type: 'text', content: "", fontSize: 18,
             fontFamily: 'Inter', textColors: ['#ffffff'], bgColors: ['transparent'], align: 'left' 
           }];
      }
      nextTick(() => { for (const id in blockRefs.value) autoResize(blockRefs.value[id]); });
    } else {
      fetchError.value = "Could not load previous publication data.";
    }
  } catch (e) { 
    console.error(e); 
    fetchError.value = "Network error while loading publication.";
  } finally { loading.value = false; }
};

const publishUpdate = async () => {
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
      body: JSON.stringify(Publish_Status.value) // Send Updated Metadata
    });

    const data = await res.json();
    if (res.ok) {
      alert("✅ Update Published Successfully!");
      router.push('/create');
    } else {
      alert("Update Failed: " + data.message);
    }
  } catch (e) {
    console.error("Publish error", e);
    alert("Network error occurred.");
  } finally {
    isPublishing.value = false;
  }
};

const handleFileChange = (e) => {
    // Only updates local state for upload logic - same as Publish.vue
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { project.value.thumbnail = event.target.result; };
    reader.readAsDataURL(file);
};

onMounted(() => {
  if (!projectId) return router.push("/create");
  fetchPublishedDetails();
});

const activeBlock = computed(() => blocks.value.find(b => b.id === activeBlockId.value));
</script>

<template>
  <div class="publish-page" v-if="!loading && project">
    <div class="publish-container">
      
      <div class="left-panel">
        <div class="thumbnail-editor" :style="{ backgroundImage: project.thumbnail ? `url(${project.thumbnail})` : 'linear-gradient(to bottom right, #000, #1e3a8a)' }">
          <div class="overlay" v-if="!isUploading">
             <label class="change-btn"><span>Update Cover</span><input type="file" @change="handleFileChange" hidden /></label>
          </div>
          <div v-if="isThumbnailNSFW" class="nsfw-overlay-badge">NSFW</div>
        </div>
        
        <button class="publish-btn update-btn" @click="publishUpdate" :disabled="isPublishing || !isFormValid">
          <span v-if="!isPublishing">{{ isFormValid ? '🔄 Update Release' : '📝 Complete Details' }}</span>
          <span v-else>✨ Updating...</span>
        </button>

        <div class="dashboard-box">
          <h4 class="dash-title">Publication Summary (Live)</h4>
          <div class="dash-meta-row">
            <span class="meta-label">Language:</span>
            <span class="meta-val">{{ SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name || selectedLanguage }}</span>
          </div>
          <div class="dash-meta-row">
            <span class="meta-label">Model:</span>
            <span class="meta-val" :class="{ 'paid-text': isPaid, 'free-text': !isPaid }">{{ isPaid ? 'Premium' : 'Free' }}</span>
          </div>
          <div v-if="selectedCategories.length > 0">
            <span class="dash-subtitle">Categories</span>
            <div class="dash-tags"><span v-for="cat in selectedCategories" :key="cat" class="mini-tag blue">{{ cat }}</span></div>
          </div>
        </div>
      </div>

      <div class="right-panel">
        <div class="header-section">
          <label class="input-label">PROJECT TITLE (UPDATE)</label>
          <div class="title-row">
             <input v-model="localName" class="title-input" :style="{ fontFamily: titleFont }" />
             <div class="font-select-wrap">
               <select v-model="titleFont" class="font-select"><option v-for="f in FONT_OPTIONS" :key="f" :value="f" :style="{ fontFamily: f }">{{ f }}</option></select>
             </div>
          </div>
        </div>

        <div class="section-container">
          <label class="input-label">DESCRIPTION / STORY BOARD</label>
          <div class="desc-box-container">
             <div class="desc-canvas" :style="containerStyle">
              <div v-for="(block, index) in blocks" :key="block.id" class="desc-block-row" @click="activeBlockId = block.id" :style="{ background: getGradient(block.bgColors, block.bgAngle), borderRadius: '6px' }">
                <button class="row-del-btn" @click.stop="removeBlock(index)">×</button>
                <div v-if="block.type === 'gif'" class="gif-wrapper" :style="{ justifyContent: block.align }"><img :src="block.content" /><button class="revert-btn" @click="block.type='text'; block.content=''">Edit Link</button></div>
                <textarea v-else :ref="el => blockRefs[block.id] = el" v-model="block.content" @input="checkContent(block, $event)" @focus="activeBlockId = block.id" class="block-input" rows="1" 
                  :style="{ fontFamily: block.fontFamily || 'Inter', fontSize: (block.fontSize || 18) + 'px', fontWeight: block.isBold ? 'bold' : 'normal', fontStyle: block.isItalic ? 'italic' : 'normal', textAlign: block.align, color: block.textColors.length > 1 ? 'transparent' : block.textColors[0], backgroundImage: block.textColors.length > 1 ? getGradient(block.textColors, block.textAngle) : 'none', webkitBackgroundClip: block.textColors.length > 1 ? 'text' : 'unset' }"></textarea>
              </div>
              <button class="add-text-btn" @click="addBlock">+ Add Text / GIF</button>
            </div>
          </div>
        </div>

        <div class="section-container">
          <label class="input-label">PROJECT TAGS</label>
          <div class="categories-wrapper">
            <div v-for="(group, index) in CATEGORY_GROUPS" :key="index" class="category-group">
              <h4 class="group-title">{{ group.label }}</h4>
              <div class="tags-grid">
                <button v-for="tag in group.items" :key="tag" class="tag-chip" :class="{ selected: selectedCategories.includes(tag) }" @click="toggleCategory(tag)">{{ tag }}</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* Reuse styles from Publish.vue */
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;700&display=swap');
/* ... (Copy all styles from Publish.vue) ... */
.publish-page { min-height: 100vh; background: #020617; color: white; padding: 2rem; display: flex; justify-content: center; font-family: 'Inter', sans-serif; }
.publish-container { display: flex; gap: 3rem; max-width: 1200px; width: 100%; align-items: flex-start; }
.left-panel { flex: 0.8; position: sticky; top: 2rem; display: flex; flex-direction: column; gap: 1.5rem; }
.right-panel { flex: 1; display: flex; flex-direction: column; gap: 2.5rem; width: 100%; }
.thumbnail-editor { width: 100%; aspect-ratio: 16/9; border-radius: 20px; background-size: cover; background-position: center; border: 1px solid rgba(255,255,255,0.1); position: relative; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
.publish-btn { width: 100%; background: linear-gradient(135deg, #10b981, #059669); border: none; color: white; padding: 16px; border-radius: 12px; font-weight: 700; font-size: 1.1rem; cursor: pointer; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4); transition: all 0.2s; }
.publish-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(16, 185, 129, 0.6); }
.dashboard-box { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 15px; }
.dash-title { margin: 0; color: #cbd5e1; font-size: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; }
.dash-meta-row { display: flex; justify-content: space-between; font-size: 0.85rem; color: #cbd5e1; }
.input-label { display: block; font-size: 0.8rem; font-weight: 700; color: #94a3b8; letter-spacing: 1px; margin-bottom: 0.8rem; text-transform: uppercase; }
.title-input { width: 100%; background: transparent; border: none; border-bottom: 2px solid #334155; color: white; font-size: 2.5rem; font-weight: 800; padding: 5px 0; outline: none; }
.section-container { display: flex; flex-direction: column; }
.categories-wrapper { display: flex; flex-direction: column; gap: 20px; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.05); padding: 25px; border-radius: 12px; }
.tag-chip { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-size: 0.85rem; }
.tag-chip.selected { background: linear-gradient(135deg, #3b82f6, #a855f7); border-color: transparent; color: white; font-weight: 600; }
.desc-block-row { margin-bottom: 10px; }
.block-input { width: 100%; background: transparent; border: 1px dashed rgba(255,255,255,0.1); color: white; padding: 10px; border-radius: 6px; }
.add-text-btn { width: 100%; padding: 10px; background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.3); color: #94a3b8; cursor: pointer; margin-top: 10px; border-radius: 6px; }
</style>