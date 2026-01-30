<script setup>
import { ref, computed, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"

const route = useRoute()
const router = useRouter()
const projectId = route.params.projectId
const token = localStorage.getItem("token")

/* ================= STATE ================= */
const loading = ref(true)
const projectName = ref("")

// --- Creative Description State ---
const bgAngle = ref(135)
const bgColors = ref(['#1e1e2e', '#3b0764']) 
const descriptionBlocks = ref([]) 
const activeBlockIndex = ref(null)

// --- Classification State ---
const selectedCategory = ref(null)

// --- NEW: Custom Tags State ---
const newTagInput = ref("")
const customTags = ref([])

const selectedWarnings = ref([])
const honestyConfirmed = ref(false)

const categories = [
    // --- CORE GENRES ---
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
]

const warnings = [
    "None (Clean Content)", 
    "Sexual Content", "Graphic Violence", "Drug Use", "Self-Harm", 
    "Strong Language", "Flashing Lights", "Gambling", "Horror Elements"
]

/* ================= COMPUTED ================= */
const containerBackground = computed(() => {
    if (bgColors.value.length === 1) return bgColors.value[0];
    return `linear-gradient(${bgAngle.value}deg, ${bgColors.value.join(', ')})`
})

const activeBlock = computed(() => {
    if (activeBlockIndex.value === null) return null
    return descriptionBlocks.value[activeBlockIndex.value]
})

const isFormValid = computed(() => {
    return (
        projectName.value.trim().length > 0 &&
        descriptionBlocks.value.length > 0 &&
        selectedCategory.value !== null &&
        honestyConfirmed.value === true
    )
})

/* ================= METHODS ================= */
const fetchProjectData = async () => {
    try {
        const res = await fetch(`http://localhost:5000/projects/${projectId}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
            const data = await res.json()
            projectName.value = data.name
        }
    } catch (err) {
        console.error("Failed to load project info", err)
    } finally {
        loading.value = false
    }
}

const addBgColor = () => bgColors.value.push('#000000')
const removeBgColor = (index) => {
    if (bgColors.value.length > 1) bgColors.value.splice(index, 1)
}

const addTextBlock = () => {
    descriptionBlocks.value.push({
        text: "New Description Text",
        color: "#ffffff",
        backgroundColor: "rgba(0,0,0,0.5)",
        fontFamily: "sans-serif",
        fontSize: 16,
        fontWeight: "normal",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "center",
        padding: 10,
        borderRadius: 4,
        borderWidth: 0,
        borderColor: "transparent"
    })
    activeBlockIndex.value = descriptionBlocks.value.length - 1
}

const deleteActiveBlock = () => {
    if (activeBlockIndex.value !== null) {
        descriptionBlocks.value.splice(activeBlockIndex.value, 1)
        activeBlockIndex.value = null
    }
}

const selectBlock = (index) => {
    activeBlockIndex.value = index
}

const selectCategory = (cat) => {
    selectedCategory.value = cat
}

// --- NEW: Custom Tag Methods ---
const addCustomTag = () => {
    const val = newTagInput.value.trim()
    if (!val) return
    
    // Prevent duplicates
    if (!customTags.value.includes(val)) {
        customTags.value.push(val)
    }
    
    newTagInput.value = "" // Clear input
}

const removeCustomTag = (index) => {
    customTags.value.splice(index, 1)
}

const toggleWarning = (warn) => {
    if (warn === "None (Clean Content)") {
        selectedWarnings.value = ["None (Clean Content)"]
        return
    }

    if (selectedWarnings.value.includes("None (Clean Content)")) {
        selectedWarnings.value = [] 
    }

    if (selectedWarnings.value.includes(warn)) {
        selectedWarnings.value = selectedWarnings.value.filter(w => w !== warn)
    } else {
        selectedWarnings.value.push(warn)
    }
}

const handlePublish = () => {
    if (!isFormValid.value) return
    
    const publishPayload = {
        projectId,
        name: projectName.value,
        descriptionData: {
            background: containerBackground.value,
            blocks: descriptionBlocks.value
        },
        category: selectedCategory.value,
        tags: customTags.value, // <--- Added Tags to Payload
        warnings: selectedWarnings.value
    }

    console.log("🚀 Publishing Project...", publishPayload)
    alert("Project Publish logic triggered! (Check Console)")
}

const goBack = () => {
    router.back()
}

onMounted(() => {
    fetchProjectData()
})
</script>

<template>
  <div class="publish-page">
    
    <header class="pub-header">
        <button class="back-btn" @click="goBack">← Back</button>
        <h1>Publish Project</h1>
        <div style="width: 60px;"></div>
    </header>

    <div v-if="loading" class="loading">Loading Project Details...</div>

    <div v-else class="content-container">
        
        <section class="form-section">
            <label>Project Name</label>
            <input v-model="projectName" class="main-input" placeholder="Enter project name..." />
        </section>

        <section class="form-section">
            <label>Creative Description</label>
            <p class="sub-label">Design your project's cover description.</p>

            <div class="creative-editor">
                <div class="editor-toolbar">
                    <div class="toolbar-group">
                        <span class="tb-label">Background</span>
                        <div class="bg-controls">
                            <div v-for="(col, idx) in bgColors" :key="idx" class="color-wrapper">
                                <input type="color" v-model="bgColors[idx]" />
                                <button v-if="bgColors.length > 1" @click="removeBgColor(idx)" class="tiny-btn">×</button>
                            </div>
                            <button @click="addBgColor" class="add-color-btn">+</button>
                        </div>
                        <div class="angle-control">
                            <span>{{ bgAngle }}°</span>
                            <input type="range" v-model="bgAngle" min="0" max="360" />
                        </div>
                    </div>

                    <div class="toolbar-group block-settings" :class="{ disabled: activeBlockIndex === null }">
                        <span class="tb-label">Selected Text Style</span>
                        <div v-if="activeBlock" class="style-row">
                            <input v-model="activeBlock.text" class="text-content-input" placeholder="Edit text..." />
                            <div class="style-actions">
                                <input type="color" v-model="activeBlock.color" title="Text Color" />
                                <input type="color" v-model="activeBlock.backgroundColor" title="Background Color" />
                                <input type="number" v-model="activeBlock.fontSize" style="width:50px" title="Size" />
                                <button @click="activeBlock.fontWeight = activeBlock.fontWeight === 'bold' ? 'normal' : 'bold'" :class="{active: activeBlock.fontWeight === 'bold'}">B</button>
                                <button @click="activeBlock.fontStyle = activeBlock.fontStyle === 'italic' ? 'normal' : 'italic'" :class="{active: activeBlock.fontStyle === 'italic'}">I</button>
                                <button class="delete-block-btn" @click="deleteActiveBlock" title="Delete Block">🗑️</button>
                            </div>
                        </div>
                        <div v-else class="no-selection">Select a text block to edit style</div>
                    </div>

                    <div class="toolbar-actions">
                        <button class="add-text-btn" @click="addTextBlock">+ Add Text Block</button>
                    </div>
                </div>

                <div class="description-canvas" :style="{ background: containerBackground }" @click.self="activeBlockIndex = null">
                    <div 
                        v-for="(block, index) in descriptionBlocks" 
                        :key="index"
                        class="desc-text-block"
                        :class="{ active: activeBlockIndex === index }"
                        @click.stop="selectBlock(index)"
                        :style="{
                            color: block.color,
                            backgroundColor: block.backgroundColor,
                            fontFamily: block.fontFamily,
                            fontSize: block.fontSize + 'px',
                            fontWeight: block.fontWeight,
                            fontStyle: block.fontStyle,
                            textDecoration: block.textDecoration,
                            textAlign: block.textAlign,
                            padding: block.padding + 'px',
                            borderRadius: block.borderRadius + 'px',
                            border: `${block.borderWidth}px solid ${block.borderColor}`
                        }"
                    >
                        {{ block.text }}
                    </div>
                    <div v-if="descriptionBlocks.length === 0" class="canvas-placeholder">
                        Click "Add Text Block" to start writing
                    </div>
                </div>
            </div>
        </section>

        <section class="form-section">
            <label>Category <span class="req">*</span></label>
            <div class="chips-grid">
                <button 
                    v-for="cat in categories" 
                    :key="cat" 
                    class="chip"
                    :class="{ selected: selectedCategory === cat }"
                    @click="selectCategory(cat)"
                >
                    {{ cat }}
                </button>
            </div>
        </section>

        <section class="form-section">
            <label>Custom Tags</label>
            <p class="sub-label">Add specific keywords to help users find your project.</p>
            
            <div class="tag-input-group">
                <input 
                    v-model="newTagInput" 
                    class="main-input tag-input" 
                    placeholder="Type a tag and press Enter..." 
                    @keydown.enter.prevent="addCustomTag"
                />
                <button class="add-tag-btn" @click="addCustomTag">Add</button>
            </div>

            <div class="chips-grid" v-if="customTags.length > 0">
                <div 
                    v-for="(tag, index) in customTags" 
                    :key="tag" 
                    class="chip custom-tag"
                >
                    {{ tag }}
                    <button class="remove-tag-x" @click="removeCustomTag(index)">×</button>
                </div>
            </div>
        </section>

        <section class="form-section">
            <label>Content Warnings</label>
            <div class="warning-box">
                <div class="warning-header">
                    <span class="icon">⚠️</span>
                    <p><strong>Honesty Policy:</strong> Please accurately tag your content. Mislabeling severe content may result in project removal.</p>
                </div>
                <div class="chips-grid">
                    <button 
                        v-for="warn in warnings" 
                        :key="warn" 
                        class="chip warning"
                        :class="{ 
                            'selected': selectedWarnings.includes(warn),
                            'clean-tag': warn === 'None (Clean Content)' 
                        }"
                        @click="toggleWarning(warn)"
                    >
                        {{ warn }}
                    </button>
                </div>
                
                <div class="honesty-check">
                    <label>
                        <input type="checkbox" v-model="honestyConfirmed">
                        I confirm that these tags accurately represent my project.
                    </label>
                </div>
            </div>
        </section>

        <div class="publish-action-area">
            <button 
                class="main-publish-btn" 
                :disabled="!isFormValid"
                @click="handlePublish"
            >
                {{ isFormValid ? '🚀 Publish Project' : 'Complete all fields to Publish' }}
            </button>
        </div>

    </div>
  </div>
</template>

<style scoped>
/* Keeping all existing styles... */
.publish-page {
    min-height: 100vh;
    background: #020617;
    color: #e2e8f0;
    font-family: 'Inter', sans-serif;
}
.pub-header {
    height: 64px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(10px);
    position: sticky;
    top: 0;
    z-index: 50;
}
.pub-header h1 {
    font-size: 1.2rem;
    font-weight: 700;
    background: linear-gradient(90deg, #00ff88, #3b82f6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 0;
}
.back-btn {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.2);
    color: #94a3b8;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
}
.back-btn:hover {
    color: #fff;
    border-color: #fff;
}
.content-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 20px;
    padding-bottom: 100px;
}
.loading {
    text-align: center;
    padding: 50px;
    color: #94a3b8;
    font-style: italic;
}
.form-section {
    margin-bottom: 40px;
    background: rgba(30, 41, 59, 0.5);
    padding: 24px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.05);
}
.form-section label {
    display: block;
    font-size: 1.1rem;
    font-weight: 600;
    color: #fff;
    margin-bottom: 8px;
}
.sub-label {
    font-size: 0.85rem;
    color: #94a3b8;
    margin-top: -4px;
    margin-bottom: 16px;
}
.req { color: #f87171; }
.main-input {
    width: 100%;
    background: #0f172a;
    border: 1px solid rgba(255,255,255,0.1);
    padding: 12px 16px;
    font-size: 1rem;
    color: #fff;
    border-radius: 8px;
    box-sizing: border-box;
}
.main-input:focus {
    outline: none;
    border-color: #3b82f6;
}
.creative-editor {
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    overflow: hidden;
}
.editor-toolbar {
    background: #1e293b;
    padding: 12px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-start;
}
.toolbar-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-right: 1px solid rgba(255,255,255,0.1);
    padding-right: 16px;
}
.toolbar-group:last-child { border-right: none; }
.tb-label {
    font-size: 0.7rem;
    color: #64748b;
    text-transform: uppercase;
    font-weight: 700;
}
.bg-controls {
    display: flex;
    gap: 6px;
}
.color-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
}
.color-wrapper input[type="color"] {
    width: 24px;
    height: 24px;
    border: none;
    padding: 0;
    background: transparent;
    cursor: pointer;
}
.tiny-btn {
    font-size: 10px;
    background: none;
    border: none;
    color: #f87171;
    cursor: pointer;
}
.add-color-btn {
    background: rgba(255,255,255,0.1);
    border: none;
    color: #fff;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    cursor: pointer;
}
.angle-control {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: #94a3b8;
}
.block-settings {
    flex: 1;
}
.block-settings.disabled {
    opacity: 0.3;
    pointer-events: none;
}
.style-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.text-content-input {
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.1);
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    width: 100%;
    box-sizing: border-box;
}
.style-actions {
    display: flex;
    gap: 6px;
    align-items: center;
}
.style-actions button {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: #ccc;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    font-family: serif;
    font-weight: bold;
}
.style-actions button.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
}
.style-actions input[type="color"] {
    width: 24px;
    height: 24px;
    border: none;
    padding: 0;
    background: transparent;
}
.delete-block-btn {
    margin-left: auto;
    color: #f87171 !important;
}
.no-selection {
    font-size: 0.8rem;
    color: #64748b;
    font-style: italic;
    padding: 10px 0;
}
.toolbar-actions {
    display: flex;
    align-items: center;
}
.add-text-btn {
    background: #00ff88;
    color: #000;
    border: none;
    padding: 8px 12px;
    border-radius: 6px;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
}
.add-text-btn:hover { background: #00cc6a; }
.description-canvas {
    min-height: 250px;
    padding: 20px;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
}
.canvas-placeholder {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: rgba(255,255,255,0.3);
    pointer-events: none;
}
.desc-text-block {
    cursor: pointer;
    transition: transform 0.1s;
    user-select: none;
    max-width: 100%;
}
.desc-text-block:hover {
    outline: 1px dashed rgba(255,255,255,0.3);
}
.desc-text-block.active {
    outline: 2px solid #3b82f6;
    transform: scale(1.02);
}
.chips-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
}
.chip {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: #94a3b8;
    padding: 8px 12px; /* Adjusted padding */
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}
.chip:hover {
    background: rgba(255,255,255,0.1);
    color: #e2e8f0;
}
.chip.selected {
    background: rgba(59, 130, 246, 0.2);
    border-color: #3b82f6;
    color: #60a5fa;
    font-weight: 600;
}

/* === NEW: CUSTOM TAGS STYLING === */
.tag-input-group {
    display: flex;
    gap: 10px;
    margin-bottom: 16px;
}
.tag-input {
    flex: 1;
}
.add-tag-btn {
    background: #f97316;
    color: white;
    border: none;
    padding: 0 20px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}
.add-tag-btn:hover {
    background: #ea580c;
}

/* The Orange Custom Tag Box */
.chip.custom-tag {
    background: rgba(249, 115, 22, 0.15);
    border-color: #f97316;
    color: #fdba74;
    cursor: default;
    justify-content: space-between; /* Space text and X */
    padding-right: 8px;
    gap: 8px;
}
.remove-tag-x {
    background: none;
    border: none;
    color: #fdba74;
    cursor: pointer;
    font-size: 1.1rem;
    line-height: 1;
    padding: 2px;
    display: flex;
    align-items: center;
    opacity: 0.7;
    transition: opacity 0.2s;
}
.remove-tag-x:hover {
    opacity: 1;
    color: #fff;
}

/* === WARNINGS === */
.chip.clean-tag {
    grid-column: span 2; 
    border-color: #00ff88;
    color: #00ff88;
}
.chip.clean-tag.selected {
    background: rgba(0, 255, 136, 0.2);
    color: #fff;
    font-weight: bold;
}
.chip.warning.selected {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
    color: #fca5a5;
}
.warning-box {
    background: rgba(0,0,0,0.3);
    padding: 16px;
    border-radius: 8px;
    border: 1px solid rgba(239, 68, 68, 0.2);
}
.warning-header {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    color: #fca5a5;
    font-size: 0.9rem;
}
.honesty-check {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.1);
}
.honesty-check label {
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
}
.honesty-check input {
    width: 18px;
    height: 18px;
    accent-color: #ef4444;
}
.publish-action-area {
    margin-top: 40px;
    text-align: center;
}
.main-publish-btn {
    background: linear-gradient(90deg, #00ff88, #3b82f6);
    color: #000;
    border: none;
    padding: 16px 48px;
    border-radius: 50px;
    font-size: 1.2rem;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(0, 255, 136, 0.3);
    transition: all 0.3s;
    text-transform: uppercase;
    letter-spacing: 1px;
}
.main-publish-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(0, 255, 136, 0.5);
}
.main-publish-btn:disabled {
    background: #334155;
    color: #94a3b8;
    cursor: not-allowed;
    box-shadow: none;
}
</style>