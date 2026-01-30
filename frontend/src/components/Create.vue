<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"

const router = useRouter()
const token = localStorage.getItem("token")
const projects = ref([])

const showModal = ref(false)
const showDeleteModal = ref(false)
const editingProject = ref(null)

const form = ref({
  name: "",
  description: ""
})

const openProject = project => {
  router.push(`/canvas/${project._id}`)
}

const handlePublishClick = (project) => {
    if (!canPublish(project)) return;
    router.push(`/publish/${project._id}`); // Navigate to new page
}

const fetchProjects = async () => {
  try {
    const res = await fetch("http://localhost:5000/projects", {
      headers: { Authorization: `Bearer ${token}` }
    })
    projects.value = await res.json()
  } catch (e) {
    console.error("Failed to fetch projects", e)
  }
}

/* VALIDATION LOGIC */
const canPublish = (project) => {
    // If stats haven't loaded yet, default to false
    if (!project.stats) return false;
    // Must have at least 1 scene (General Node) AND 0 disconnected options
    return project.stats.hasGeneralNode && project.stats.disconnected === 0;
}

const getPublishError = (project) => {
    if (!project.stats) return "Loading stats...";
    if (!project.stats.hasGeneralNode) return "Project is empty. Add a scene!";
    if (project.stats.disconnected > 0) return `${project.stats.disconnected} disconnected options found.`;
    return "";
}

/* CREATE or UPDATE */
const saveProject = async () => {
  if (!form.value.name.trim()) {
    return alert("Project name required")
  }

  const url = editingProject.value
    ? `http://localhost:5000/projects/${editingProject.value._id}`
    : "http://localhost:5000/projects"

  const method = editingProject.value ? "PUT" : "POST"

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(form.value)
  })

  const data = await res.json()
  if (!res.ok) return alert(data.message)

  closeModal()
  fetchProjects()
}

/* OPEN EDIT */
const editProject = project => {
  editingProject.value = project
  form.value = {
    name: project.name,
    description: project.description
  }
  showModal.value = true
}

/* DELETE */
const confirmDelete = project => {
  editingProject.value = project
  showDeleteModal.value = true
}

const deleteProject = async () => {
  await fetch(
    `http://localhost:5000/projects/${editingProject.value._id}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }
  )

  showDeleteModal.value = false
  editingProject.value = null
  fetchProjects()
}

const closeModal = () => {
  showModal.value = false
  editingProject.value = null
  form.value = { name: "", description: "" }
}

onMounted(fetchProjects)

const formatDate = date => {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })
}
</script>

<template>
  <div class="page">
    
    <header class="dashboard-header">
      <div class="header-content">
        <h1>Weaver Studio</h1>
        <p class="tagline">Spin your threads of imagination into living worlds.</p>
      </div>
    </header>

    <div class="grid">
      <div
        v-for="project in projects"
        :key="project._id"
        class="project-card"
        @click="openProject(project)"
      >
        <div class="card-header">
          <h3>{{ project.name }}</h3>

          <div class="menu" @click.stop>
            ⋮
            <div class="dropdown">
              <button @click="editProject(project)">Edit</button>
              <button class="danger" @click="confirmDelete(project)">
                Delete
              </button>
            </div>
          </div>
        </div>

        <div class="publish-wrapper" @click.stop>
            <button 
                  class="publish-btn" 
                  :class="{ disabled: !canPublish(project) }"
                  @click="handlePublishClick(project)" 
              >
                  {{ canPublish(project) ? '🚀 Publish' : '⚠️ Not Ready' }}
              </button>
            
            <div v-if="!canPublish(project)" class="publish-tooltip">
                {{ getPublishError(project) }}
            </div>
        </div>

        <p>{{ project.description }}</p>
        <small class="created">
          Created on {{ formatDate(project.createdAt) }}
        </small>
      </div>

      <div class="plus-box" @click="showModal = true">
        <span>+</span>
        <small>Create Project</small>
      </div>
    </div>

    <transition name="fade">
      <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
        <div class="modal scale">
          <h2>
            {{ editingProject ? "Edit Project" : "New Project" }}
          </h2>

          <input v-model="form.name" placeholder="Project name" />
          <textarea v-model="form.description" placeholder="Description" />

          <div class="actions">
            <button class="cancel" @click="closeModal">Cancel</button>
            <button class="save" @click="saveProject">Save</button>
          </div>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div v-if="showDeleteModal" class="modal-backdrop">
        <div class="modal scale">
          <h3>Delete this project?</h3>
          <p>This action cannot be undone.</p>

          <div class="actions">
            <button class="cancel" @click="showDeleteModal = false">
              Cancel
            </button>
            <button class="danger" @click="deleteProject">
              Delete
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #020617;
  padding: 3rem;
  color: #e5e7eb;
}

/* DASHBOARD HEADER */
.dashboard-header {
  margin-bottom: 3rem;
  border-bottom: 1px solid rgba(30, 58, 138, 0.5);
  padding-bottom: 1.5rem;
}

.dashboard-header h1 {
  font-size: 2.5rem;
  font-weight: 800;
  background: linear-gradient(90deg, #00ff88, #3b82f6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.5rem;
  letter-spacing: -1px;
}

.tagline {
  font-size: 1.1rem;
  color: #94a3b8;
  font-style: italic;
  font-family: 'Courier New', monospace;
}

/* GRID */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); /* Slightly wider cards */
  gap: 1.8rem;
}

/* PROJECT CARD */
.project-card {
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid #1e3a8a;
  border-radius: 14px;
  padding: 1.2rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  flex-direction: column;
}

.project-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 30px rgba(59, 130, 246, 0.15);
}

.project-card h3 {
  margin-bottom: 0.4rem;
  font-size: 1.1rem;
  color: #fff;
}

.project-card p {
  font-size: 0.85rem;
  color: #cbd5f5;
  margin-bottom: auto; /* Pushes date to bottom if description is short */
  line-height: 1.4;
}

/* PUBLISH BUTTON & TOOLTIP */
.publish-wrapper {
    position: relative; /* Anchor for tooltip */
    margin: 1rem 0;
    width: 100%;
}

.publish-btn {
    background: linear-gradient(90deg, #00ff88, #059669);
    color: #000;
    border: none;
    padding: 0.5rem 0.8rem;
    border-radius: 6px;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
    width: 100%;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 0 2px 10px rgba(0, 255, 136, 0.2);
}

.publish-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(0, 255, 136, 0.3);
    filter: brightness(1.1);
}

/* DISABLED STATE */
.publish-btn.disabled {
    background: rgba(255, 255, 255, 0.05);
    color: #64748b;
    cursor: not-allowed;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transform: none;
    box-shadow: none;
}

.publish-btn.disabled:hover {
    background: rgba(255, 255, 255, 0.08);
}

/* TOOLTIP STYLES */
.publish-tooltip {
    position: absolute;
    top: calc(100% + 8px); /* Below the button */
    left: 50%;
    transform: translateX(-50%);
    background: #0f172a;
    border: 1px solid #ef4444; /* Red border for warning */
    color: #fca5a5;
    padding: 0.5rem 0.8rem;
    border-radius: 6px;
    font-size: 0.75rem;
    white-space: nowrap;
    z-index: 20;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.2s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
}

.publish-tooltip::before {
    content: "";
    position: absolute;
    top: -5px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 8px;
    height: 8px;
    background: #0f172a;
    border-left: 1px solid #ef4444;
    border-top: 1px solid #ef4444;
}

/* Show Tooltip on Hover of Wrapper */
.publish-wrapper:hover .publish-tooltip {
    opacity: 1;
    pointer-events: auto;
}

/* PLUS BOX */
.plus-box {
  border: 2px dashed #3b82f6;
  border-radius: 14px;
  min-height: 200px; /* Match approximate card height */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.25s ease;
}

.plus-box span {
  font-size: 3rem;
  line-height: 1;
  color: #3b82f6;
}

.plus-box small {
  margin-top: 0.5rem;
  opacity: 0.8;
  color: #93c5fd;
  font-weight: 600;
}

.plus-box:hover {
  background: rgba(59, 130, 246, 0.1);
  transform: scale(1.02);
  border-color: #60a5fa;
}

/* MODAL BACKDROP */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.85);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 50;
}

/* MODAL */
.modal {
  background: #0f172a;
  border: 1px solid #1e3a8a;
  border-radius: 16px;
  padding: 2rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
}

.modal h2 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #fff;
}

.modal input,
.modal textarea {
  width: 100%;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 0.8rem;
  color: #e5e7eb;
  margin-bottom: 1rem;
  font-family: inherit;
  box-sizing: border-box;
}

.modal input:focus,
.modal textarea:focus {
    outline: none;
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.05);
}

.modal textarea {
  resize: none;
  min-height: 100px;
}

/* ACTIONS */
.actions {
  display: flex;
  gap: 0.8rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.cancel {
  background: transparent;
  border: 1px solid #475569;
  color: #94a3b8;
}

.save {
  background: #3b82f6;
  border: none;
  color: white;
}

.cancel,
.save {
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;
}

.save:hover {
  background: #2563eb;
}

.cancel:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  border-color: #94a3b8;
}

/* ANIMATIONS */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.scale-enter-from {
  transform: scale(0.9);
  opacity: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.menu {
  position: relative;
  cursor: pointer;
  font-size: 1.2rem;
  color: #64748b;
  padding: 0 0.5rem;
}

.menu:hover {
    color: #fff;
}

.menu:hover .dropdown {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.dropdown {
  position: absolute;
  right: 0;
  top: 25px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 0.4rem;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-5px);
  transition: all 0.2s ease;
  z-index: 10;
  min-width: 100px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.dropdown button {
  background: none;
  border: none;
  color: #cbd5e1;
  padding: 0.5rem 0.8rem;
  text-align: left;
  width: 100%;
  cursor: pointer;
  border-radius: 4px;
  font-size: 0.85rem;
}

.dropdown button:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.dropdown .danger {
  color: #f87171;
}

.dropdown .danger:hover {
    background: rgba(239, 68, 68, 0.1);
}

.danger {
  background: #dc2626;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.danger:hover {
  background: #b91c1c;
}

.created {
  display: block;
  margin-top: 1rem;
  font-size: 0.7rem;
  color: #64748b;
  border-top: 1px solid rgba(255,255,255,0.05);
  padding-top: 0.8rem;
}

.project-card {
  cursor: pointer;
}

.project-card:hover h3 {
  color: #60a5fa;
}
</style>