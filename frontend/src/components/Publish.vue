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

const localName = ref("");

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

/* --- BLOCK ACTIONS --- */
const addBlock = async () => {
  const id = Date.now();
  blocks.value.push({
    id,
    type: 'text',
    content: "",
    isBold: false,
    isItalic: false,
    align: 'center',
    fontSize: 18, 
    textColors: ['#ffffff'],
    textAngle: 90,
    bgColors: ['transparent'],
    bgAngle: 90
  });
  
  activeBlockId.value = id;
  await nextTick();
  // Focus and resize immediately
  if (blockRefs.value[id]) {
    blockRefs.value[id].focus();
    autoResize(blockRefs.value[id]);
  }
};

const removeBlock = (index) => {
  blocks.value.splice(index, 1);
  activeBlockId.value = null;
  // Clean up ref
  // Note: Vue handles ref removal automatically in templates usually, 
  // but good to keep state clean if needed.
};

const checkContent = (block, event) => {
  // We don't need to call autoResize here manually anymore 
  // because the watcher below will catch the content change.
  // But keeping it for immediate responsiveness during typing is fine.
  if (event && event.target) autoResize(event.target);

  const gifRegex = /\.(gif|webp|png|jpg|jpeg)($|\?)/i;
  if (gifRegex.test(block.content)) {
    block.type = 'gif';
  } else {
    block.type = 'text';
  }
};

// --- FIX: AUTO-RESIZE LOGIC ---
const autoResize = (el) => {
  if (!el) return;
  el.style.height = 'auto'; // Shrink to fit content (resets height)
  el.style.height = el.scrollHeight + 'px'; // Expand to new content height
};

// --- NEW: WATCH FOR STYLE CHANGES ---
// This ensures that if Font Size, Bold, or Italic changes, the box resizes immediately
watch(blocks, async () => {
  await nextTick(); // Wait for the DOM to update with new font size
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
      try {
        const parsed = JSON.parse(project.value.description);
        if (Array.isArray(parsed)) blocks.value = parsed;
        else throw new Error();
      } catch (e) {
        if (project.value.description) {
           blocks.value = [{ 
             id: 1, type: 'text', content: project.value.description, fontSize: 18,
             textColors: ['#ffffff'], bgColors: ['transparent'], align: 'left' 
           }];
        }
      }
      // Initial resize on load
      nextTick(() => {
        for (const id in blockRefs.value) {
          autoResize(blockRefs.value[id]);
        }
      });
    }
  } catch (e) { console.error(e); } finally { loading.value = false; }
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
  console.log("Publishing...");
  await saveProject(null);
};

const saveProject = async (newThumbnail = null) => {
  try {
    const payload = {
      name: localName.value,
      description: JSON.stringify(blocks.value), 
      thumbnail: newThumbnail || project.value.thumbnail
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
  <div class="publish-page" v-if="!loading && project">
    <div class="publish-container">
      
      <div class="left-panel">
        <div class="thumbnail-editor" :style="{ backgroundImage: project.thumbnail ? `url(${project.thumbnail})` : 'linear-gradient(to bottom right, #000, #1e3a8a)' }">
          <div class="overlay" v-if="!isUploading">
             <label class="change-btn"><span>Change Cover</span><input type="file" @change="handleFileChange" hidden /></label>
          </div>
          <div class="overlay loading" v-else><div class="spinner"></div></div>
        </div>
        <button class="publish-btn" @click="publishProject">🚀 Publish to Feed</button>
      </div>

      <div class="right-panel">
        <div class="header-row">
          <input v-model="localName" class="title-input" placeholder="Name your world..." />
        </div>

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
                /* FIX: Apply Block Background here on the parent */
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
                  fontSize: (block.fontSize || 18) + 'px',
                  fontWeight: block.isBold ? 'bold' : 'normal',
                  fontStyle: block.isItalic ? 'italic' : 'normal',
                  textAlign: block.align,
                  
                  /* FIX: Ensure textarea background is transparent so parent shows through */
                  backgroundColor: 'transparent',
                  
                  /* Text Gradient Logic */
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
    </div>
  </div>
</template>

<style scoped>
/* MAIN LAYOUT */
.publish-page { min-height: 100vh; background: #020617; color: white; padding: 2rem; display: flex; justify-content: center; font-family: 'Inter', sans-serif; }
.publish-container { display: flex; gap: 3rem; max-width: 1200px; width: 100%; align-items: flex-start; }

.left-panel { flex: 0.8; position: sticky; top: 2rem; display: flex; flex-direction: column; gap: 1.5rem; }
.thumbnail-editor { width: 100%; aspect-ratio: 16/9; border-radius: 20px; background-size: cover; background-position: center; border: 1px solid rgba(255,255,255,0.1); position: relative; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
.overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; opacity: 0; transition: 0.3s; }
.thumbnail-editor:hover .overlay { opacity: 1; }
.change-btn { background: white; color: black; padding: 10px 20px; border-radius: 30px; font-weight: 700; cursor: pointer; transition: transform 0.2s; }
.change-btn:hover { transform: scale(1.05); }

.right-panel { flex: 1; display: flex; flex-direction: column; gap: 1.5rem; width: 100%; }

.header-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.title-input { background: transparent; border: none; border-bottom: 2px solid #334155; color: white; font-size: 2.2rem; font-weight: 800; width: 100%; padding: 5px; transition: border-color 0.3s; }
.title-input:focus { border-color: #3b82f6; outline: none; }

.publish-btn { 
  width: 100%; background: linear-gradient(135deg, #3b82f6, #a855f7); border: none; color: white; padding: 16px; border-radius: 12px; font-weight: 700; font-size: 1.1rem; cursor: pointer; box-shadow: 0 10px 25px rgba(59, 130, 246, 0.4); transition: all 0.2s; display: flex; justify-content: center; align-items: center; gap: 10px;
}
.publish-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(59, 130, 246, 0.6); }

/* --- DESCRIPTION BOX --- */
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

/* COLORS */
.gradient-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.gradient-controls.small { gap: 6px; }
.color-wrap { position: relative; display: flex; align-items: center; }
.color-wrap input[type="color"] { width: 36px; height: 36px; border: 2px solid rgba(255,255,255,0.2); padding: 0; background: none; cursor: pointer; border-radius: 6px; overflow: hidden; }
.tiny-del { position: absolute; top: -6px; right: -6px; background: #ef4444; border: none; color: white; width: 14px; height: 14px; font-size: 9px; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; z-index: 2; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
.add-color-btn { width: 36px; height: 36px; background: rgba(255,255,255,0.1); border: 1px dashed rgba(255,255,255,0.3); color: white; border-radius: 6px; cursor: pointer; font-size: 1.2rem; line-height: 1; display: flex; justify-content: center; align-items: center; }
.add-color-btn:hover { background: rgba(255,255,255,0.2); }

/* INPUTS */
.angle-slider-wrap { display: flex; flex-direction: column; margin-left: 10px; width: 80px; }
.angle-slider-wrap label { font-size: 0.6rem; color: #94a3b8; margin-bottom: 2px; }
input[type="range"] { width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; outline: none; cursor: pointer; }
.mini-slider { width: 60px; margin-left: 5px; }

/* FONT SIZE */
.size-control { display: flex; flex-direction: column; gap: 2px; margin-right: 5px; }
.size-input { width: 50px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 4px; padding: 5px; font-size: 0.9rem; text-align: center; }

/* BUTTONS */
.desc-toolbar button { background: rgba(0,0,0,0.2); border: 1px solid transparent; color: #cbd5e1; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: 0.2s; }
.desc-toolbar button:hover { background: rgba(255,255,255,0.1); }
.desc-toolbar button.active { background: #3b82f6; color: white; border-color: #2563eb; }
.align-group { display: flex; gap: 2px; background: rgba(0,0,0,0.2); border-radius: 6px; padding: 2px; }
.align-group button { background: transparent; border: none; }
.align-group button.active { background: #3b82f6; }

/* CANVAS */
.desc-canvas { min-height: 350px; padding: 30px; display: flex; flex-direction: column; gap: 15px; }
.desc-block-row { position: relative; width: 100%; transition: transform 0.2s; }
.desc-block-row:hover .row-del-btn { opacity: 1; }

.block-input {
  width: 100%;
  border: 1px dashed transparent;
  padding: 10px;
  outline: none;
  border-radius: 6px;
  transition: border-color 0.2s;
  resize: none; 
  overflow: hidden; 
  caret-color: #ffffff; /* FORCE CARET TO BE VISIBLE */
  font-family: inherit;
  line-height: 1.4;
  /* Ensure min-height matches initial font size roughly */
  min-height: 40px; 
}
.block-input:focus { border-color: rgba(255,255,255,0.3); box-shadow: 0 0 15px rgba(0,0,0,0.1); }

.gif-wrapper { display: flex; width: 100%; position: relative; padding: 10px 0; }
.gif-wrapper img { max-width: 100%; border-radius: 8px; max-height: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
.revert-btn { position: absolute; top: 20px; right: 20px; background: rgba(0,0,0,0.7); padding: 5px 10px; border-radius: 4px; border: none; color: white; cursor: pointer; font-size: 0.8rem; backdrop-filter: blur(4px); }

.row-del-btn { position: absolute; left: -35px; top: 50%; transform: translateY(-50%); background: #ef4444; border: none; color: white; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; opacity: 0; transition: 0.2s; z-index: 10; display: flex; align-items: center; justify-content: center; padding-bottom: 2px; }

.add-text-btn { margin-top: 15px; width: 100%; padding: 12px; background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.2); color: #94a3b8; border-radius: 8px; cursor: pointer; transition: 0.2s; font-size: 0.9rem; }
.add-text-btn:hover { background: rgba(255,255,255,0.1); color: white; border-color: #3b82f6; }

.spinner { width: 30px; height: 30px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
  .publish-container { flex-direction: column; }
  .left-panel { position: static; width: 100%; }
}
</style>