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

const fetchProjects = async () => {
  const res = await fetch("http://localhost:5000/projects", {
    headers: { Authorization: `Bearer ${token}` }
  })
  projects.value = await res.json()
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
    <div class="grid">
      <!-- PROJECT CARD -->
      <div
        v-for="project in projects"
        :key="project._id"
        class="project-card"
        @click="openProject(project)"
      >
        <div class="card-header">
          <h3>{{ project.name }}</h3>

          <!-- 3 DOT MENU -->
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

        <p>{{ project.description }}</p>
            <small class="created">
            Created on {{ formatDate(project.createdAt) }}
            </small>
      </div>

      <!-- PLUS -->
      <div class="plus-box" @click="showModal = true">
        <span>+</span>
        <small>Create Project</small>
      </div>
    </div>

    <!-- CREATE / EDIT MODAL -->
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

    <!-- DELETE CONFIRM -->
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

/* GRID */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.4rem;
}

/* PROJECT CARD */
.project-card {
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid #1e3a8a;
  border-radius: 14px;
  padding: 1.2rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.project-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 30px rgba(59, 130, 246, 0.15);
}

.project-card h3 {
  margin-bottom: 0.4rem;
  font-size: 1rem;
}

.project-card p {
  font-size: 0.85rem;
  color: #cbd5f5;
}

/* PLUS BOX */
.plus-box {
  border: 2px dashed #3b82f6;
  border-radius: 14px;
  min-height: 140px;
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
}

.plus-box small {
  margin-top: 0.3rem;
  opacity: 0.8;
}

.plus-box:hover {
  background: rgba(59, 130, 246, 0.1);
  transform: scale(1.02);
}

/* MODAL BACKDROP */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.75);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 50;
}

/* MODAL */
.modal {
  background: #020617;
  border: 1px solid #1e3a8a;
  border-radius: 16px;
  padding: 1.8rem;
  width: 100%;
  max-width: 420px;
}

.modal h2 {
  text-align: center;
  margin-bottom: 1.2rem;
}

.modal input,
.modal textarea {
  width: 100%;
  background: #020617;
  border: 1px solid #1e3a8a;
  border-radius: 8px;
  padding: 0.6rem;
  color: #e5e7eb;
  margin-bottom: 0.8rem;
}

.modal textarea {
  resize: none;
  min-height: 90px;
}

/* ACTIONS */
.actions {
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
}

.cancel {
  background: transparent;
  border: 1px solid #64748b;
  color: #cbd5f5;
}

.save {
  background: #3b82f6;
  border: none;
  color: white;
}

.cancel,
.save {
  padding: 0.55rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.save:hover {
  background: #2563eb;
}

.cancel:hover {
  background: rgba(100, 116, 139, 0.15);
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
}

.menu:hover .dropdown {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.dropdown {
  position: absolute;
  right: 0;
  top: 20px;
  background: #020617;
  border: 1px solid #1e3a8a;
  border-radius: 8px;
  padding: 0.4rem;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-5px);
  transition: all 0.2s ease;
  z-index: 10;
}

.dropdown button {
  background: none;
  border: none;
  color: #e5e7eb;
  padding: 0.4rem 0.8rem;
  text-align: left;
  width: 100%;
  cursor: pointer;
}

.dropdown button:hover {
  background: rgba(59, 130, 246, 0.15);
}

.dropdown .danger {
  color: #ef4444;
}

.danger {
  background: #dc2626;
  color: white;
  border: none;
  padding: 0.55rem 1rem;
  border-radius: 8px;
}

.danger:hover {
  background: #b91c1c;
}

.created {
  display: block;
  margin-top: 0.6rem;
  font-size: 0.7rem;
  color: #94a3b8;
  opacity: 0.85;
}

.project-card {
  cursor: pointer;
}

.project-card:hover h3 {
  color: #93c5fd;
}
</style>