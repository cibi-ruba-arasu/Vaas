<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue"
import { useRoute, useRouter } from "vue-router"

/* ================= ROUTE + AUTH ================= */
const route = useRoute()
const router = useRouter()
const projectId = route.params.projectId
const token = localStorage.getItem("token")

/* ================= GRAPH (UNCHANGED) ================= */
const canvasRef = ref(null)
let ctx

let camX = 0
let camY = 0
let scale = 1

let isDragging = false
let lastX = 0
let lastY = 0

let mouseWorld = { x: 0, y: 0 }
let coordTimer

const draw = () => {
  const canvas = canvasRef.value
  const w = canvas.width
  const h = canvas.height

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.scale(scale, scale)
  ctx.translate(-camX, -camY)

  drawGrid(w, h)
  drawAxes(w, h)

  ctx.restore()
}

const drawGrid = (w, h) => {
  const minor = 50
  const major = 250

  const left = camX - w / 2 / scale
  const right = camX + w / 2 / scale
  const top = camY - h / 2 / scale
  const bottom = camY + h / 2 / scale

  ctx.strokeStyle = "#003b22"
  ctx.lineWidth = 1 / scale

  for (let x = Math.floor(left / minor) * minor; x < right; x += minor) {
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
    ctx.stroke()
  }

  for (let y = Math.floor(top / minor) * minor; y < bottom; y += minor) {
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()
  }

  ctx.strokeStyle = "#00aa55"
  ctx.lineWidth = 1.5 / scale

  for (let x = Math.floor(left / major) * major; x < right; x += major) {
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
    ctx.stroke()
  }

  for (let y = Math.floor(top / major) * major; y < bottom; y += major) {
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()
  }
}

const drawAxes = (w, h) => {
  const left = camX - w / 2 / scale
  const right = camX + w / 2 / scale
  const top = camY - h / 2 / scale
  const bottom = camY + h / 2 / scale

  ctx.strokeStyle = "#00ff88"
  ctx.lineWidth = 2.5 / scale

  ctx.beginPath()
  ctx.moveTo(0, top)
  ctx.lineTo(0, bottom)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(left, 0)
  ctx.lineTo(right, 0)
  ctx.stroke()
}

const onMouseDown = e => {
  isDragging = true
  lastX = e.clientX
  lastY = e.clientY
}

const onMouseMove = e => {
  const dx = e.clientX - lastX
  const dy = e.clientY - lastY

  if (isDragging) {
    camX -= dx / scale
    camY -= dy / scale
    draw()
  }

  lastX = e.clientX
  lastY = e.clientY

  const rect = canvasRef.value.getBoundingClientRect()
  mouseWorld.x = (e.clientX - rect.left - rect.width / 2) / scale + camX
  mouseWorld.y = (e.clientY - rect.top - rect.height / 2) / scale + camY
}

const onMouseUp = () => (isDragging = false)

const onWheel = e => {
  e.preventDefault()

  const zoom = e.deltaY < 0 ? 1.1 : 0.9
  const rect = canvasRef.value.getBoundingClientRect()

  const mx = (e.clientX - rect.left - rect.width / 2) / scale + camX
  const my = (e.clientY - rect.top - rect.height / 2) / scale + camY

  scale = Math.min(Math.max(scale * zoom, 0.2), 6)

  camX = mx - (e.clientX - rect.left - rect.width / 2) / scale
  camY = my - (e.clientY - rect.top - rect.height / 2) / scale

  draw()
}

const resize = () => {
  const canvas = canvasRef.value
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  draw()
}

const logCoords = () => {
  console.log(
    `Cursor → X: ${mouseWorld.x.toFixed(2)}, Y: ${mouseWorld.y.toFixed(2)}`
  )
}

/* ================= UI STATE ================= */
const menuOpen = ref(false)
const projectName = ref("Loading...")

const toggleMenu = () => {
  menuOpen.value = !menuOpen.value
}

/* ================= FETCH PROJECT ================= */
const fetchProject = async () => {
  if (!token) return router.replace("/login")

  const res = await fetch(
    `http://localhost:5000/projects/${projectId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  )

  if (!res.ok) {
    return router.replace("/create")
  }

  const project = await res.json()
  projectName.value = project.name
}

/* ================= LIFECYCLE ================= */
onMounted(async () => {
  ctx = canvasRef.value.getContext("2d")
  resize()

  await fetchProject()

  coordTimer = setInterval(logCoords, 1000)

  window.addEventListener("resize", resize)
  window.addEventListener("mousemove", onMouseMove)
  window.addEventListener("mouseup", onMouseUp)
})

onBeforeUnmount(() => {
  clearInterval(coordTimer)
  window.removeEventListener("resize", resize)
  window.removeEventListener("mousemove", onMouseMove)
  window.removeEventListener("mouseup", onMouseUp)
})
</script>

<template>
  <div class="wrapper">
    <!-- GRAPH -->
    <canvas
      ref="canvasRef"
      class="canvas"
      @mousedown="onMouseDown"
      @wheel="onWheel"
    />

    <!-- HEADER -->
    <header class="header">
      <button class="hamburger" @click="toggleMenu">☰</button>

      <div class="title">
        Weaver Project : {{ projectName }}
      </div>
    </header>

    <!-- SIDE MENU -->
    <aside class="side-menu" :class="{ open: menuOpen }">
      <h3>Menu</h3>
      <ul>
        <li>Settings</li>
        <li>Export</li>
        <li>Help</li>
      </ul>
    </aside>
  </div>
</template>

<style scoped>
.wrapper {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.canvas {
  position: absolute;
  inset: 0;
  background: black;
  cursor: grab;
}
.canvas:active {
  cursor: grabbing;
}

.header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 255, 136, 0.2);
  z-index: 10;
}

.hamburger {
  position: absolute;
  left: 16px;
  background: none;
  border: none;
  color: #00ff88;
  font-size: 22px;
  cursor: pointer;
}

.title {
  color: #e5e7eb;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.side-menu {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 260px;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(12px);
  border-right: 1px solid rgba(0, 255, 136, 0.2);
  transform: translateX(-100%);
  transition: transform 0.35s ease;
  padding: 70px 20px;
  z-index: 9;
}

.side-menu.open {
  transform: translateX(0);
}

.side-menu h3 {
  color: #00ff88;
  margin-bottom: 1rem;
}

.side-menu ul {
  list-style: none;
  padding: 0;
}

.side-menu li {
  padding: 0.6rem 0;
  color: #cbd5f5;
  cursor: pointer;
}

.side-menu li:hover {
  color: #00ff88;
}
</style>
