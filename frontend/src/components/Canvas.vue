<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue"
import { useRoute } from "vue-router"

/* ================= ROUTE ================= */
const route = useRoute()
const projectId = route.params.projectId
const token = localStorage.getItem("token")

/* ================= UI ================= */
const menuOpen = ref(false)
const toggleMenu = () => (menuOpen.value = !menuOpen.value)

/* ================= CANVAS ================= */
const canvasRef = ref(null)
let ctx

let camX = 0
let camY = 0
let scale = 1

let isPanning = false
let lastX = 0
let lastY = 0

let mouseWorld = { x: 0, y: 0 }

/* ================= NODES ================= */
const nodes = ref([])
let draggingNode = null
let dragOffset = { x: 0, y: 0 }
let menuDragging = false

const NODE_W = 160
const NODE_H = 80
const HEADER_H = 26

/* ================= UTILS ================= */
const screenToWorld = (sx, sy) => {
  const r = canvasRef.value.getBoundingClientRect()
  return {
    x: (sx - r.width / 2) / scale + camX,
    y: (sy - r.height / 2) / scale + camY
  }
}

/* ================= DRAW ================= */
const draw = () => {
  const c = canvasRef.value
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, c.width, c.height)

  ctx.save()
  ctx.translate(c.width / 2, c.height / 2)
  ctx.scale(scale, scale)
  ctx.translate(-camX, -camY)

  drawGrid(c.width, c.height)
  drawAxes(c.width, c.height)
  drawNodes()

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

/* ✅ ORIGIN-LOCKED AXES */
const drawAxes = (w, h) => {
  const left = camX - w / 2 / scale
  const right = camX + w / 2 / scale
  const top = camY - h / 2 / scale
  const bottom = camY + h / 2 / scale

  ctx.strokeStyle = "#00ff88"
  ctx.lineWidth = 3 / scale

  ctx.beginPath()
  ctx.moveTo(0, top)
  ctx.lineTo(0, bottom)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(left, 0)
  ctx.lineTo(right, 0)
  ctx.stroke()
}

/* ================= DRAW NODES ================= */
const drawNodes = () => {
  for (const n of nodes.value) {
    const x = n.x
    const y = n.y

    // Body
    ctx.fillStyle = "#5f6f82"
    ctx.fillRect(x - NODE_W / 2, y - NODE_H / 2, NODE_W, NODE_H)

    // Header
    ctx.fillStyle = "#3f4b5a"
    ctx.fillRect(
      x - NODE_W / 2,
      y - NODE_H / 2,
      NODE_W,
      HEADER_H
    )

    // Border
    ctx.strokeStyle = "#cbd5e1"
    ctx.lineWidth = 2
    ctx.strokeRect(x - NODE_W / 2, y - NODE_H / 2, NODE_W, NODE_H)

    // Title
    ctx.fillStyle = "#e5e7eb"
    ctx.font = "13px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(
      "General Node",
      x,
      y - NODE_H / 2 + HEADER_H / 2
    )

    // Arrowheads (▷)
    ctx.font = "14px sans-serif"
    ctx.fillText(
      "▷",
      x - NODE_W / 2 + 12,
      y - NODE_H / 2 + HEADER_H / 2
    )
    ctx.fillText(
      "▷",
      x + NODE_W / 2 - 12,
      y - NODE_H / 2 + HEADER_H / 2
    )
  }
}

/* ================= HIT TEST ================= */
const getNodeAt = (wx, wy) =>
  nodes.value.find(
    n =>
      wx >= n.x - NODE_W / 2 &&
      wx <= n.x + NODE_W / 2 &&
      wy >= n.y - NODE_H / 2 &&
      wy <= n.y + NODE_H / 2
  )

/* ================= MOUSE ================= */
const onMouseDown = e => {
  const w = screenToWorld(e.clientX, e.clientY)
  const hit = getNodeAt(w.x, w.y)

  if (hit) {
    draggingNode = hit
    dragOffset.x = w.x - hit.x
    dragOffset.y = w.y - hit.y
    return
  }

  isPanning = true
  lastX = e.clientX
  lastY = e.clientY
}

const onMouseMove = e => {
  mouseWorld = screenToWorld(e.clientX, e.clientY)

  if (draggingNode) {
    draggingNode.x = mouseWorld.x - dragOffset.x
    draggingNode.y = mouseWorld.y - dragOffset.y
    draw()
    return
  }

  if (isPanning) {
    camX -= (e.clientX - lastX) / scale
    camY -= (e.clientY - lastY) / scale
    draw()
  }

  lastX = e.clientX
  lastY = e.clientY
}

const onMouseUp = () => {
  isPanning = false
  draggingNode = null

  if (menuDragging) {
    nodes.value.push({
      id: nodes.value.length,
      type: "general",
      x: mouseWorld.x,
      y: mouseWorld.y
    })
    menuDragging = false
    draw()
  }
}

/* ================= ZOOM ================= */
const onWheel = e => {
  e.preventDefault()
  const zoom = e.deltaY < 0 ? 1.1 : 0.9

  const r = canvasRef.value.getBoundingClientRect()
  const mx = (e.clientX - r.left - r.width / 2) / scale + camX
  const my = (e.clientY - r.top - r.height / 2) / scale + camY

  scale = Math.min(Math.max(scale * zoom, 0.2), 6)
  camX = mx - (e.clientX - r.left - r.width / 2) / scale
  camY = my - (e.clientY - r.top - r.height / 2) / scale

  draw()
}

/* ================= SAVE ================= */
const saveProject = async () => {
  await fetch("http://localhost:5000/projects/save-graph", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      projectId,
      nodes: nodes.value
    })
  })
}

/* ================= RESIZE ================= */
const resize = () => {
  canvasRef.value.width = window.innerWidth
  canvasRef.value.height = window.innerHeight
  draw()
}

/* ================= LIFECYCLE ================= */
onMounted(() => {
  ctx = canvasRef.value.getContext("2d")
  resize()

  window.addEventListener("resize", resize)
  window.addEventListener("mousemove", onMouseMove)
  window.addEventListener("mouseup", onMouseUp)
})

onBeforeUnmount(() => {
  window.removeEventListener("resize", resize)
  window.removeEventListener("mousemove", onMouseMove)
  window.removeEventListener("mouseup", onMouseUp)
})
</script>

<template>
  <div class="wrapper">
    <canvas
      ref="canvasRef"
      class="canvas"
      @mousedown="onMouseDown"
      @wheel="onWheel"
    />

    <header class="header">
      <button class="hamburger" @click="toggleMenu">☰</button>
      <div class="center">
        <div class="title">Weaver Project</div>
        <button class="save" @click="saveProject">Save</button>
      </div>
    </header>

    <aside class="side-menu" :class="{ open: menuOpen }">
      <div class="menu-node" @mousedown.prevent="menuDragging = true">
        <div class="menu-node-header">
          <span>▷</span>
          <span class="menu-node-title">General Node</span>
          <span>▷</span>
        </div>
        <div class="menu-node-body"></div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.wrapper { width: 100vw; height: 100vh }
.canvas { position: absolute; inset: 0 }

.header {
  position: absolute;
  top: 0;
  height: 64px;
  width: 100%;
  backdrop-filter: blur(10px);
  background: rgba(0,0,0,.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.hamburger {
  position: absolute;
  left: 16px;
  font-size: 22px;
  background: none;
  border: none;
  color: #00ff88;
}

.center { text-align: center }

.save {
  margin-top: 4px;
  background: #00ff88;
  border: none;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
}

.side-menu {
  position: absolute;
  top: 64px;
  left: 0;
  width: 260px;
  height: calc(100% - 64px);
  backdrop-filter: blur(12px);
  background: rgba(0,0,0,.35);
  transform: translateX(-100%);
  transition: .35s;
  padding: 16px;
}

.side-menu.open { transform: translateX(0) }

/* ===== MENU NODE ===== */
.menu-node {
  background: #5f6f82;
  border-radius: 8px;
  cursor: grab;
  overflow: hidden;
}

.menu-node-header {
  background: #3f4b5a;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  color: #e5e7eb;
  font-size: 14px;
}

.menu-node-body {
  height: 40px;
}

.menu-node-title {
  font-weight: 600;
}

.title {
  font-size: 1.3rem;
  color: #00ff88;
}
</style>
