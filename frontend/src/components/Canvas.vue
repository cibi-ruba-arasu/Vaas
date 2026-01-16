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
const selectedNodeId = ref(null)

/**
 * Canvas_Status
 * Stores canonical data for every node on canvas
 * {
 *   index: Number,
 *   x: Number,
 *   y: Number,
 *   node_type: "General"
 * }
 */
const Canvas_Status = ref([])

let draggingNode = null
let dragOffset = { x: 0, y: 0 }
let menuDragging = false

const NODE_W = 180
const NODE_H = 110
const HEADER_H = 28
const NODE_RADIUS = 12
const ARROW_OFFSET = 14
const ARROW_HIT_R = 10

let hoveredArrow = null

/* ================= UTILS ================= */
const screenToWorld = (sx, sy) => {
  const r = canvasRef.value.getBoundingClientRect()
  return {
    x: (sx - r.width / 2) / scale + camX,
    y: (sy - r.height / 2) / scale + camY
  }
}

const drawRoundedRect = (x, y, w, h, r) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/* ================= HIT TEST ================= */
const arrowHit = (n, wx, wy) => {
  const ay = n.y - NODE_H / 2 + HEADER_H / 2
  const leftAx = n.x - NODE_W / 2 + ARROW_OFFSET
  const rightAx = n.x + NODE_W / 2 - ARROW_OFFSET

  if (Math.hypot(wx - leftAx, wy - ay) < ARROW_HIT_R)
    return { node: n, side: "left", x: leftAx, y: ay }

  if (Math.hypot(wx - rightAx, wy - ay) < ARROW_HIT_R)
    return { node: n, side: "right", x: rightAx, y: ay }

  return null
}

const getNodeAt = (wx, wy) =>
  nodes.value.find(
    n =>
      wx >= n.x - NODE_W / 2 &&
      wx <= n.x + NODE_W / 2 &&
      wy >= n.y - NODE_H / 2 &&
      wy <= n.y + NODE_H / 2
  )

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

/* ================= GRID ================= */
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

/* ================= AXES ================= */
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

/* ================= NODES ================= */
const drawNodes = () => {
  for (const n of nodes.value) {
    const x = n.x
    const y = n.y

    /* === HIGHLIGHT === */
    if (n.id === selectedNodeId.value) {
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 3 / scale
      drawRoundedRect(
        x - NODE_W / 2 - 4,
        y - NODE_H / 2 - 4,
        NODE_W + 8,
        NODE_H + 8,
        NODE_RADIUS + 2
      )
      ctx.stroke()
    }

    // Body
    ctx.fillStyle = "#5f6f82"
    drawRoundedRect(x - NODE_W / 2, y - NODE_H / 2, NODE_W, NODE_H, NODE_RADIUS)
    ctx.fill()

    // Header
    const grad = ctx.createLinearGradient(
      x - NODE_W / 2,
      y - NODE_H / 2,
      x + NODE_W / 2,
      y - NODE_H / 2
    )
    grad.addColorStop(0, "#ff2a2a")
    grad.addColorStop(1, "#000")

    ctx.fillStyle = grad
    drawRoundedRect(x - NODE_W / 2, y - NODE_H / 2, NODE_W, HEADER_H, NODE_RADIUS)
    ctx.fill()

    // Border
    ctx.strokeStyle = "#cbd5e1"
    ctx.lineWidth = 2
    drawRoundedRect(x - NODE_W / 2, y - NODE_H / 2, NODE_W, NODE_H, NODE_RADIUS)
    ctx.stroke()

    // Title
    ctx.fillStyle = "#fff"
    ctx.font = "13px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("General Node", x, y - NODE_H / 2 + HEADER_H / 2)

    /* === ARROWHEADS === */
    const ay = y - NODE_H / 2 + HEADER_H / 2
    const leftAx = x - NODE_W / 2 + ARROW_OFFSET
    const rightAx = x + NODE_W / 2 - ARROW_OFFSET

    if (hoveredArrow?.node === n) {
      ctx.beginPath()
      ctx.arc(hoveredArrow.x, hoveredArrow.y, 9, 0, Math.PI * 2)
      ctx.strokeStyle = "#fff"
      ctx.lineWidth = 2 / scale
      ctx.stroke()
    }

    ctx.fillStyle = "#ffffff"
    ctx.font = "16px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("▷", leftAx, ay)
    ctx.fillText("▷", rightAx, ay)
  }
}

/* ================= MOUSE ================= */
const onMouseDown = e => {
  const w = screenToWorld(e.clientX, e.clientY)

  hoveredArrow = null
  for (const n of nodes.value) {
    const hit = arrowHit(n, w.x, w.y)
    if (hit) return
  }

  const hitNode = getNodeAt(w.x, w.y)
  if (hitNode) {
    selectedNodeId.value = hitNode.id
    draggingNode = hitNode
    dragOffset.x = w.x - hitNode.x
    dragOffset.y = w.y - hitNode.y
    draw()
    return
  }

  selectedNodeId.value = null
  isPanning = true
  lastX = e.clientX
  lastY = e.clientY
  draw()
}

const onMouseMove = e => {
  mouseWorld = screenToWorld(e.clientX, e.clientY)

  hoveredArrow = null
  for (const n of nodes.value) {
    const hit = arrowHit(n, mouseWorld.x, mouseWorld.y)
    if (hit) {
      hoveredArrow = hit
      break
    }
  }

  if (draggingNode) {
    draggingNode.x = mouseWorld.x - dragOffset.x
    draggingNode.y = mouseWorld.y - dragOffset.y

    const status = Canvas_Status.value.find(s => s.index === draggingNode.id)
    if (status) {
      status.x = draggingNode.x
      status.y = draggingNode.y
    }
  } else if (isPanning) {
    camX -= (e.clientX - lastX) / scale
    camY -= (e.clientY - lastY) / scale
  }

  draw()
  lastX = e.clientX
  lastY = e.clientY
}

const onMouseUp = () => {
  isPanning = false
  draggingNode = null

  if (menuDragging) {
    const id = nodes.value.length
    const x = mouseWorld.x
    const y = mouseWorld.y

    nodes.value.push({ id, x, y })
    Canvas_Status.value.push({
      index: id,
      x,
      y,
      node_type: "General"
    })

    selectedNodeId.value = id
    menuDragging = false
  }

  draw()
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
      Canvas_Status: Canvas_Status.value
    })
  })
}

/* ================= RESIZE ================= */
const resize = () => {
  canvasRef.value.width = window.innerWidth
  canvasRef.value.height = window.innerHeight
  draw()
}

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
    <canvas ref="canvasRef" class="canvas" @mousedown="onMouseDown" @wheel="onWheel" />

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
          <span>▶</span>
          <span class="menu-node-title">General Node</span>
          <span>▶</span>
        </div>
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

.menu-node {
  background: #5f6f82;
  border-radius: 12px;
  overflow: hidden;
  cursor: grab;
}

.menu-node-header {
  height: 28px;
  background: linear-gradient(to right, #ff2a2a, #000);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  color: #fff;
  font-size: 14px;
}

.menu-node-title { font-weight: 600 }

.title {
  font-size: 1.3rem;
  color: #00ff88;
}
</style>
