<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import { API_URL } from '../config.js';

const router = useRouter()
const token = sessionStorage.getItem("token")
const projects = ref([])

const showModal = ref(false)
const showDeleteModal = ref(false)
const editingProject = ref(null)
const isProcessing = ref(false)
const showDeviceWarning = ref(false)

const form = ref({
  name: "",
  description: "",
  thumbnail: null
})

const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return alert("File too large (Max 5MB)")
    const reader = new FileReader()
    reader.onload = (event) => form.value.thumbnail = event.target.result
    reader.readAsDataURL(file)
}

const removeThumbnail = () => {
    form.value.thumbnail = null
    const fileInput = document.querySelector('.file-input')
    if(fileInput) fileInput.value = ''
}

const fetchProjects = async () => {
  try {
    const res = await fetch(`${API_URL}/projects`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) projects.value = await res.json()
  } catch (e) {
    console.error("Fetch failed", e)
  }
}

const openProject = project => {
  // Check if primary input is touch (finger) or if it's a small screen mobile/tablet
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 1024;

  if (isTouchDevice && isSmallScreen) {
    // Show the warning instead of routing
    showDeviceWarning.value = true;
    return;
  }
  
  router.push(`/canvas/${project._id}`);
}

// --- ROUTING LOGIC CHANGED HERE ---
const handlePublishClick = (project) => {
    if (!canPublish(project)) return;
    
    if (project.isPublished) {
      // Go to Update Page if published
      router.push(`/update/${project._id}`);
    } else {
      // Go to Publish Page if new
      router.push(`/publish/${project._id}`);
    }
}

const canPublish = (project) => {
    if (!project.stats) return false;
    
    // 🚀 FIX: Now requires hasRootNode to be true in order to activate the Publish button
    return project.stats.hasGeneralNode && 
           project.stats.hasRootNode && 
           project.stats.disconnected === 0;
}

const getPublishError = (project) => {
    if (!project.stats) return "Loading...";
    if (!project.stats.hasGeneralNode) return "Add a scene first";
    
    // 🚀 FIX: Will show this error on the button if the root node isn't set
    if (!project.stats.hasRootNode) return "Set a Starting Node";
    
    if (project.stats.disconnected > 0) return "Fix disconnected nodes";
    return "";
}

const handleSubmit = async () => {
  const url = editingProject.value
    ? `${API_URL}/projects/${editingProject.value._id}`
    : `${API_URL}/projects`
  
  const method = editingProject.value ? "PUT" : "POST"
  isProcessing.value = true 

  try {
    await new Promise(r => setTimeout(r, 1000)); 
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form.value)
    })
    if (!res.ok) {
        const d = await res.json()
        alert(d.message)
    } else {
        closeModal()
        await fetchProjects()
    }
  } catch (e) { console.error(e) } 
  finally { isProcessing.value = false }
}

const deleteProject = async () => {
  isProcessing.value = true
  try {
    await fetch(`${API_URL}/projects/${editingProject.value._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
    closeDeleteModal()
    fetchProjects()
  } catch (e) { console.error(e) }
  finally { isProcessing.value = false }
}

const openCreateModal = () => {
  editingProject.value = null
  form.value = { name: "", description: "", thumbnail: null }
  showModal.value = true
}

const openEditModal = (p) => {
  editingProject.value = p
  form.value = { name: p.name, description: p.description, thumbnail: p.thumbnail || null }
  showModal.value = true
}

const closeModal = () => showModal.value = false
const confirmDelete = (p) => { editingProject.value = p; showDeleteModal.value = true }
const closeDeleteModal = () => { showDeleteModal.value = false; editingProject.value = null }

const activeDropdown = ref(null)
const toggleDropdown = (id) => activeDropdown.value = activeDropdown.value === id ? null : id

onMounted(() => {
  fetchProjects()
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".menu")) activeDropdown.value = null
  })
})
</script>

<template>
  <div class="create-page">
    <header class="header">
      <h1 class="logo">Weaver</h1>
      <div class="header-right" style="display: flex; gap: 12px;">
        <button class="profile-btn doc-btn" @click="router.push('/docs')">Docs</button>
        <button class="profile-btn" @click="router.push('/profile')">Profile</button>
      </div>
    </header>

    <div class="main-content">
      <div class="top-bar"><h2>Your Tapestry</h2></div>

      <div class="projects-grid">
        <div v-for="project in projects" :key="project._id" class="project-card glass-card" @click="openProject(project)">
          <div class="card-thumbnail" :style="{ backgroundImage: project.thumbnail ? `url('${project.thumbnail}')` : 'linear-gradient(to bottom right, #000000, #1e3a8a)' }"></div>

          <div class="card-content">
            <div class="card-header">
                <h3 class="truncate" :title="project.name">{{ project.name }}</h3>
                <div class="menu" @click.stop="toggleDropdown(project._id)">⋮
                    <div v-if="activeDropdown === project._id" class="dropdown">
                        <button @click.stop="openEditModal(project)">Edit Settings</button>
                        <button @click.stop="confirmDelete(project)" class="danger">Delete</button>
                    </div>
                </div>
            </div>
            
            <p class="desc truncate-2">{{ project.description || "No description" }}</p>
            
            <div class="card-footer">
                <span class="date">{{ new Date(project.updatedAt).toLocaleDateString() }}</span>
                <div class="publish-wrapper" @click.stop> 
                    <span v-if="!canPublish(project)" class="status-dot error" :title="getPublishError(project)"></span>
                    
                    <button 
                      v-else 
                      class="publish-btn-large" 
                      :class="{ 'update-mode': project.isPublished }"
                      @click.stop="handlePublishClick(project)" 
                      :title="project.isPublished ? 'Update Published Project' : 'Publish to Feed'"
                    >
                      {{ project.isPublished ? 'Update' : 'Publish' }} 🚀
                    </button>
                </div>
            </div>
          </div>
        </div>

        <div class="project-card create-card" @click="openCreateModal">
            <div class="create-inner"><div class="glow-icon">+</div><span>Weave New Story</span></div>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay">
      <div class="modal glass-modal">
        <h3>{{ editingProject ? "Edit Project" : "New Creation" }}</h3>
        <label>Name</label><input v-model="form.name" placeholder="Name your world..." />
        <label>Description</label><textarea v-model="form.description" placeholder="What is this story about?"></textarea>
        <label>Thumbnail</label>
        <div class="thumb-preview-row">
            <div class="preview-wrapper">
                <div class="preview-box" :style="{ backgroundImage: form.thumbnail ? `url('${form.thumbnail}')` : 'linear-gradient(to bottom right, #000000, #1e3a8a)' }"></div>
                <button v-if="form.thumbnail" class="remove-thumb-btn" @click="removeThumbnail">×</button>
            </div>
            <div class="file-input-wrapper"><input type="file" accept="image/*" @change="handleFileChange" class="file-input" /><span class="file-hint">Max 5MB</span></div>
        </div>
        <div class="modal-actions"><button @click="closeModal" class="cancel">Close</button><button @click="handleSubmit" class="save">Weave</button></div>
      </div>
    </div>

    <div v-if="showDeleteModal" class="modal-overlay">
      <div class="modal small glass-modal">
        <h3>Unravel Project?</h3><p>This cannot be undone.</p>
        <div class="modal-actions"><button @click="closeDeleteModal" class="cancel">Keep</button><button @click="deleteProject" class="danger-btn">Delete</button></div>
      </div>
    </div>
    <div v-if="showDeviceWarning" class="modal-overlay" @click="showDeviceWarning = false">
      <div class="modal small glass-modal" @click.stop>
        <h3>Desktop Required 🖱️</h3>
        <p style="color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin-bottom: 20px;">
          Weaver's requires precise weaving! Please use a PC, laptop, or a device with a mouse to open and edit your projects.
        </p>
        <div class="modal-actions">
          <button @click="showDeviceWarning = false" class="save">I Understand</button>
        </div>
      </div>
    </div>
    <div v-if="isProcessing" class="mystical-overlay">
        <div class="loom-container"><div class="ring ring-1"></div><div class="ring ring-2"></div><div class="ring ring-3"></div><div class="core-light"></div></div>
        <p class="mystical-text">Weaving Reality...</p>
    </div>
  </div>
</template>

<style scoped>
.create-page { min-height: 100vh; background: #020617; color: #e2e8f0; font-family: 'Inter', sans-serif; position: relative; overflow-x: hidden; }

.header { display: flex; justify-content: space-between; padding: 1.2rem 2.5rem; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(255, 255, 255, 0.05); position: sticky; top: 0; z-index: 20; }
.logo { font-size: 1.6rem; font-weight: 800; background: linear-gradient(135deg, #a855f7, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -1px; margin: 0; }
.profile-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; padding: 0.6rem 1.2rem; border-radius: 8px; cursor: pointer; transition: 0.2s; font-size: 0.9rem; }
.profile-btn:hover { background: rgba(255,255,255,0.1); color: white; border-color: rgba(255,255,255,0.2); }

.main-content { max-width: 1200px; margin: 2rem auto; padding: 0 2rem; }
.top-bar { margin-bottom: 2.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1rem; }
.top-bar h2 { font-weight: 300; font-size: 1.8rem; color: #f8fafc; letter-spacing: 1px; }

.projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem; }

.project-card { border-radius: 16px; overflow: hidden; cursor: pointer; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); display: flex; flex-direction: column; position: relative; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
.glass-card:hover { transform: translateY(-8px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2); border-color: rgba(168, 85, 247, 0.3); }

.card-thumbnail { height: 150px; width: 100%; background-size: cover; background-position: center; border-bottom: 1px solid rgba(255,255,255,0.05); position: relative; }
.card-thumbnail::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, rgba(15, 23, 42, 0.9), transparent); }

.card-content { padding: 1.2rem; display: flex; flex-direction: column; flex-grow: 1; }
.card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
.card-header h3 { margin: 0; font-size: 1.15rem; color: #f1f5f9; font-weight: 600; line-height: 1.3; font-family: 'Inter', sans-serif; letter-spacing: -0.5px; }
.truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
.truncate-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 2.8em; line-height: 1.4em; }
.desc { font-size: 0.9rem; color: #94a3b8; margin-bottom: 1.2rem; flex-grow: 1; }
.card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem; margin-top: auto; }
.date { font-size: 0.75rem; color: #64748b; font-family: monospace; }

.create-card { min-height: 300px; background: rgba(255, 255, 255, 0.02); border: 2px dashed rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: center; color: #94a3b8; transition: all 0.3s ease; }
.create-card:hover { background: rgba(255, 255, 255, 0.04); border-color: rgba(59, 130, 246, 0.5); color: #fff; transform: translateY(-4px); }
.create-inner { text-align: center; }
.glow-icon { font-size: 3rem; margin-bottom: 10px; background: linear-gradient(135deg, #3b82f6, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.3)); transition: transform 0.3s; }
.create-card:hover .glow-icon { transform: scale(1.1) rotate(90deg); }

/* UPDATED PUBLISH BUTTON STYLES */
.publish-btn-large {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
  border: none;
  padding: 8px 16px; /* Bigger padding */
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.2);
}

.publish-btn-large:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 15px rgba(59, 130, 246, 0.4);
}

/* Style change for UPDATE mode (Greenish to distinguish) */
.publish-btn-large.update-mode {
  background: linear-gradient(135deg, #10b981, #059669); 
}

.publish-btn-large.update-mode:hover {
  box-shadow: 0 6px 15px rgba(16, 185, 129, 0.4);
}

.status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; background: #ef4444; box-shadow: 0 0 8px rgba(239, 68, 68, 0.5); }

.menu { position: relative; color: #64748b; cursor: pointer; padding: 0 5px; font-size: 1.2rem; transition: color 0.2s; }
.menu:hover { color: #fff; }
.dropdown { position: absolute; right: 0; top: 25px; background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; width: 140px; z-index: 20; box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: hidden; padding: 5px; }
.dropdown button { display: block; width: 100%; padding: 8px 12px; text-align: left; background: none; border: none; color: #cbd5e1; cursor: pointer; font-size: 0.9rem; border-radius: 4px; transition: 0.2s; }
.dropdown button:hover { background: rgba(255,255,255,0.05); color: white; }
.dropdown button.danger:hover { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 50; }
.glass-modal { background: #1e293b; padding: 2.5rem; border-radius: 20px; width: 450px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
.modal h3 { margin: 0 0 1.5rem 0; color: #f8fafc; font-weight: 300; font-size: 1.5rem; letter-spacing: 1px; }
.modal label { display: block; font-size: 0.85rem; color: #94a3b8; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
.modal input, .modal textarea { width: 100%; padding: 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; margin-bottom: 20px; box-sizing: border-box; font-family: inherit; transition: border-color 0.2s; }
.modal input:focus, .modal textarea:focus { outline: none; border-color: #60a5fa; }

/* THUMBNAIL INPUT STYLES */
.thumb-preview-row { display: flex; align-items: center; gap: 20px; margin-bottom: 25px; }
.preview-wrapper { position: relative; width: 70px; height: 70px; flex-shrink: 0; }
.preview-box { width: 100%; height: 100%; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background-size: cover; background-position: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
.remove-thumb-btn { position: absolute; top: -8px; right: -8px; background: #ef4444; color: white; border: none; width: 20px; height: 20px; border-radius: 50%; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.5); transition: transform 0.2s; }
.remove-thumb-btn:hover { transform: scale(1.1); }

.file-input-wrapper { display: flex; flex-direction: column; gap: 5px; }
.file-input { margin-bottom: 0 !important; border: none !important; padding: 0 !important; background: transparent !important; }
.file-hint { font-size: 0.75rem; color: #64748b; }

.modal-actions { display: flex; justify-content: flex-end; gap: 12px; }
.cancel { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; padding: 10px 20px; border-radius: 8px; cursor: pointer; transition: 0.2s; }
.cancel:hover { border-color: rgba(255,255,255,0.3); color: white; }
.save { background: linear-gradient(135deg, #3b82f6, #a855f7); border: none; color: white; padding: 10px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4); transition: transform 0.2s; }
.save:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(59, 130, 246, 0.6); }
.danger-btn { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.5); color: #fca5a5; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
.danger-btn:hover { background: rgba(239, 68, 68, 0.2); color: #fff; }

.mystical-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(2, 6, 23, 0.9); backdrop-filter: blur(12px); display: flex; flex-direction: column; align-items: center; justify-content: center; }
.loom-container { position: relative; width: 120px; height: 120px; display: flex; justify-content: center; align-items: center; }
.ring { position: absolute; border-radius: 50%; border: 2px solid transparent; }
.ring-1 { width: 100%; height: 100%; border-top-color: #a855f7; border-left-color: rgba(168, 85, 247, 0.3); animation: spin-right 2s linear infinite; }
.ring-2 { width: 75%; height: 75%; border-bottom-color: #3b82f6; border-right-color: rgba(59, 130, 246, 0.3); animation: spin-left 3s linear infinite; }
.ring-3 { width: 50%; height: 50%; border-top-color: #06b6d4; border-right-color: rgba(6, 182, 212, 0.3); animation: spin-right 1.5s linear infinite; }
.core-light { width: 10px; height: 10px; background: white; border-radius: 50%; box-shadow: 0 0 20px 10px rgba(255, 255, 255, 0.2); animation: pulse-core 2s ease-in-out infinite; }
.mystical-text { margin-top: 2rem; font-size: 1.2rem; letter-spacing: 4px; text-transform: uppercase; background: linear-gradient(90deg, #a855f7, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 600; animation: text-glow 2s ease-in-out infinite alternate; }
@keyframes spin-right { 100% { transform: rotate(360deg); } }
@keyframes spin-left { 100% { transform: rotate(-360deg); } }
@keyframes pulse-core { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.5); opacity: 0.4; } }
@keyframes text-glow { from { opacity: 0.6; filter: blur(0px); } to { opacity: 1; filter: blur(1px); } }
</style>