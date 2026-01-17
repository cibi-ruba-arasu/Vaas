<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from "vue"
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
let connectingLine = null // { fromNode, fromX, fromY, toX, toY }

/* ================= POPUP ================= */
const showPopup = ref(false)
const popupNode = ref(null)
const popupAnimation = ref(false)

/* ================= GRAPH SETTINGS ================= */
const graphCanvasRef = ref(null)
let graphCtx
const graphMousePos = ref({ x: 0, y: 0 })
const showGraphCoords = ref(false)
const graphCoords = ref({ x: 0, y: 0 })
const graphCoordsPopupPos = ref({ x: 0, y: 0 })

// Graph settings
const GRAPH_MIN_X = -1000
const GRAPH_MAX_X = 1000
const GRAPH_MIN_Y = -600
const GRAPH_MAX_Y = 600
const GRAPH_MAJOR_GRID = 100  // Major grid lines every 100 units
const GRAPH_MINOR_GRID = 20   // Minor grid lines every 20 units

/* ================= SCENES MANAGEMENT ================= */
const nodeScenes = ref([]) // Scenes for the currently opened node
const hoveredSceneId = ref(null) // Track which scene is hovered
const selectedScene = ref(null) // Track which scene is selected for editing
const viewMode = ref('scenes') // 'scenes' or 'sceneDetails'

/* ================= ADD DROPDOWN ================= */
const showAddDropdown = ref(false)
const addDropdownOptions = [
  { id: 'image', label: 'Image' },
  { id: 'audio', label: 'Audio' },
  { id: 'text', label: 'Text' },
  { id: 'video', label: 'Video' }
]

const toggleAddDropdown = () => {
  showAddDropdown.value = !showAddDropdown.value
}

const selectAddOption = (option) => {
  console.log(`Selected: ${option.label}`)
  // Here you can add logic to handle the selected option
  // For example, add a new node of the selected type
  showAddDropdown.value = false
}

const closeAddDropdown = () => {
  showAddDropdown.value = false
}

const openPopup = node => {
  popupNode.value = node
  viewMode.value = 'scenes'
  selectedScene.value = null
  
  // Load scenes for this node from Canvas_Status
  const nodeStatus = Canvas_Status.value.find(s => s.index === node.id)
  if (nodeStatus) {
    // If node already has scenes, use them
    if (nodeStatus.scenes) {
      nodeScenes.value = [...nodeStatus.scenes]
    } else {
      // Initialize with empty scenes array
      nodeScenes.value = []
    }
  } else {
    nodeScenes.value = []
  }
  
  showPopup.value = true
  nextTick(() => {
    popupAnimation.value = true
    // Initialize graph canvas after popup is shown
    setTimeout(initializeGraphCanvas, 50)
  })
}

const closePopup = () => {
  popupAnimation.value = false
  showGraphCoords.value = false
  setTimeout(() => {
    showPopup.value = false
    popupNode.value = null
    nodeScenes.value = []
    hoveredSceneId.value = null
    selectedScene.value = null
    viewMode.value = 'scenes'
  }, 300) // duration of animation
}

/* ================= GRAPH FUNCTIONS ================= */
const initializeGraphCanvas = () => {
  if (!graphCanvasRef.value) return
  
  graphCtx = graphCanvasRef.value.getContext('2d')
  resizeGraphCanvas()
  drawGraph()
}

const resizeGraphCanvas = () => {
  if (!graphCanvasRef.value) return
  
  const container = document.querySelector('.popup-content')
  if (container) {
    const rect = container.getBoundingClientRect()
    graphCanvasRef.value.width = rect.width
    graphCanvasRef.value.height = rect.height
    drawGraph()
  }
}

const screenToGraphCoords = (screenX, screenY) => {
  if (!graphCanvasRef.value) return { x: 0, y: 0 }
  
  const canvas = graphCanvasRef.value
  const rect = canvas.getBoundingClientRect()
  
  // Convert screen coordinates to canvas coordinates
  const canvasX = screenX - rect.left
  const canvasY = screenY - rect.top
  
  // Convert canvas coordinates to graph coordinates
  // Origin is at canvas center
  const centerX = canvas.width / 2
  const centerY = canvas.height / 2
  
  // Calculate graph coordinates
  // Each unit in graph corresponds to 2 pixels for better visibility
  const pixelsPerUnit = 2
  const graphX = (canvasX - centerX) / pixelsPerUnit
  const graphY = (centerY - canvasY) / pixelsPerUnit  // Invert Y axis (graph Y increases upward)
  
  return {
    x: Math.round(graphX),
    y: Math.round(graphY)
  }
}

const drawGraph = () => {
  if (!graphCtx || !graphCanvasRef.value) return
  
  const canvas = graphCanvasRef.value
  const ctx = graphCtx
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // Get center coordinates
  const centerX = canvas.width / 2
  const centerY = canvas.height / 2
  
  // Draw background
  ctx.fillStyle = 'rgba(30, 41, 59, 0.8)' // Dark blue-gray background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  // Draw minor grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.lineWidth = 1
  drawGridLines(ctx, canvas, centerX, centerY, GRAPH_MINOR_GRID, 10) // 10 pixels per minor unit
  
  // Draw major grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 1.5
  drawGridLines(ctx, canvas, centerX, centerY, GRAPH_MAJOR_GRID, 10) // 10 pixels per minor unit
  
  // Draw X and Y axes
  ctx.strokeStyle = '#00ff88'
  ctx.lineWidth = 2
  
  // Y axis
  ctx.beginPath()
  ctx.moveTo(centerX, 0)
  ctx.lineTo(centerX, canvas.height)
  ctx.stroke()
  
  // X axis
  ctx.beginPath()
  ctx.moveTo(0, centerY)
  ctx.lineTo(canvas.width, centerY)
  ctx.stroke()
  
  // Draw axis labels
  ctx.fillStyle = '#00ff88'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  // X axis labels
  for (let x = -GRAPH_MAX_X; x <= GRAPH_MAX_X; x += GRAPH_MAJOR_GRID) {
    if (x === 0) continue // Skip 0 to avoid overlapping with Y axis
    const screenX = centerX + (x * 2) // 2 pixels per unit
    if (screenX >= 20 && screenX <= canvas.width - 20) {
      ctx.fillText(x.toString(), screenX, centerY + 15)
      // Draw tick mark
      ctx.beginPath()
      ctx.moveTo(screenX, centerY - 5)
      ctx.lineTo(screenX, centerY + 5)
      ctx.stroke()
    }
  }
  
  // Y axis labels
  for (let y = -GRAPH_MAX_Y; y <= GRAPH_MAX_Y; y += GRAPH_MAJOR_GRID) {
    if (y === 0) continue // Skip 0 to avoid overlapping with X axis
    const screenY = centerY - (y * 2) // Invert Y and 2 pixels per unit
    if (screenY >= 20 && screenY <= canvas.height - 20) {
      ctx.fillText(y.toString(), centerX - 15, screenY)
      // Draw tick mark
      ctx.beginPath()
      ctx.moveTo(centerX - 5, screenY)
      ctx.lineTo(centerX + 5, screenY)
      ctx.stroke()
    }
  }
  
  // Draw origin label (0,0)
  ctx.fillText('0', centerX - 12, centerY + 12)
  
  // Draw graph boundaries
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)'
  ctx.lineWidth = 1
  ctx.setLineDash([5, 5])
  ctx.strokeRect(
    centerX + (GRAPH_MIN_X * 2),
    centerY - (GRAPH_MAX_Y * 2),
    (GRAPH_MAX_X - GRAPH_MIN_X) * 2,
    (GRAPH_MAX_Y - GRAPH_MIN_Y) * 2
  )
  ctx.setLineDash([])
  
  // Draw boundary labels
  ctx.fillStyle = 'rgba(255, 0, 0, 0.7)'
  ctx.font = '10px sans-serif'
  
  // Top-left corner (min X, max Y)
  const minXScreen = centerX + (GRAPH_MIN_X * 2)
  const maxYScreen = centerY - (GRAPH_MAX_Y * 2)
  ctx.fillText(`(${GRAPH_MIN_X}, ${GRAPH_MAX_Y})`, minXScreen + 40, maxYScreen + 15)
  
  // Bottom-right corner (max X, min Y)
  const maxXScreen = centerX + (GRAPH_MAX_X * 2)
  const minYScreen = centerY - (GRAPH_MIN_Y * 2)
  ctx.fillText(`(${GRAPH_MAX_X}, ${GRAPH_MIN_Y})`, maxXScreen - 40, minYScreen - 10)
}

const drawGridLines = (ctx, canvas, centerX, centerY, gridSize, pixelsPerUnit) => {
  const unitSize = gridSize * pixelsPerUnit
  
  // Vertical grid lines
  for (let x = centerX; x < canvas.width; x += unitSize) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, canvas.height)
    ctx.stroke()
  }
  for (let x = centerX; x > 0; x -= unitSize) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, canvas.height)
    ctx.stroke()
  }
  
  // Horizontal grid lines
  for (let y = centerY; y < canvas.height; y += unitSize) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(canvas.width, y)
    ctx.stroke()
  }
  for (let y = centerY; y > 0; y -= unitSize) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(canvas.width, y)
    ctx.stroke()
  }
}

const onGraphMouseMove = (event) => {
  if (!graphCanvasRef.value) return
  
  const rect = graphCanvasRef.value.getBoundingClientRect()
  const mouseX = event.clientX
  const mouseY = event.clientY
  
  // Check if mouse is inside graph canvas
  if (mouseX >= rect.left && mouseX <= rect.right && 
      mouseY >= rect.top && mouseY <= rect.bottom) {
    
    // Calculate graph coordinates
    const coords = screenToGraphCoords(mouseX, mouseY)
    graphCoords.value = coords
    
    // Update popup position (offset from cursor)
    graphCoordsPopupPos.value = {
      x: mouseX + 15,
      y: mouseY - 30
    }
    
    showGraphCoords.value = true
  } else {
    showGraphCoords.value = false
  }
}

const onGraphMouseLeave = () => {
  showGraphCoords.value = false
}

/* ================= SCENE FUNCTIONS ================= */
const addScene = () => {
  if (!popupNode.value) return
  
  const newSceneId = nodeScenes.value.length + 1
  const newScene = {
    id: newSceneId,
    name: `Scene ${newSceneId}`
  }
  
  nodeScenes.value.push(newScene)
  
  // Update Canvas_Status with the new scenes
  updateNodeScenesInStatus()
}

const deleteScene = (sceneId) => {
  // If we're deleting the currently selected scene, go back to scenes view
  if (selectedScene.value && selectedScene.value.id === sceneId) {
    viewMode.value = 'scenes'
    selectedScene.value = null
  }
  
  // Remove the scene from nodeScenes
  nodeScenes.value = nodeScenes.value.filter(scene => scene.id !== sceneId)
  
  // Renumber remaining scenes
  nodeScenes.value.forEach((scene, index) => {
    scene.id = index + 1
    scene.name = `Scene ${index + 1}`
  })
  
  // Update Canvas_Status
  updateNodeScenesInStatus()
}

const selectScene = (scene) => {
  selectedScene.value = { ...scene }
  viewMode.value = 'sceneDetails'
}

const goBackToScenes = () => {
  viewMode.value = 'scenes'
  selectedScene.value = null
}

const updateSceneDetails = () => {
  if (!selectedScene.value) return
  
  // Update the scene in nodeScenes
  const index = nodeScenes.value.findIndex(scene => scene.id === selectedScene.value.id)
  if (index !== -1) {
    nodeScenes.value[index] = { ...selectedScene.value }
    updateNodeScenesInStatus()
  }
}

const updateNodeScenesInStatus = () => {
  if (!popupNode.value) return
  
  // Find the node in Canvas_Status
  const nodeStatusIndex = Canvas_Status.value.findIndex(s => s.index === popupNode.value.id)
  
  if (nodeStatusIndex !== -1) {
    // Update existing node
    Canvas_Status.value[nodeStatusIndex].scenes = [...nodeScenes.value]
  } else {
    // This shouldn't happen normally, but just in case
    console.warn("Node not found in Canvas_Status")
  }
}

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

const arrowHit = (n, wx, wy) => {
  const ay = n.y - NODE_H / 2 + HEADER_H / 2
  const leftAx = n.x - NODE_W / 2 + ARROW_OFFSET
  const rightAx = n.x + NODE_W / 2 - ARROW_OFFSET

  if (Math.hypot(wx - leftAx, wy - ay) < ARROW_HIT_R) return { node: n, side: "left", x: leftAx, y: ay }
  if (Math.hypot(wx - rightAx, wy - ay) < ARROW_HIT_R) return { node: n, side: "right", x: rightAx, y: ay }
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
  drawConnections()
  drawNodes()
  drawConnectingLine()
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

    if (n.id === selectedNodeId.value) {
      ctx.strokeStyle = "#fff"
      ctx.lineWidth = 3 / scale
      drawRoundedRect(x - NODE_W / 2 - 4, y - NODE_H / 2 - 4, NODE_W + 8, NODE_H + 8, NODE_RADIUS + 2)
      ctx.stroke()
    }

    ctx.fillStyle = "#5f6f82"
    drawRoundedRect(x - NODE_W / 2, y - NODE_H / 2, NODE_W, NODE_H, NODE_RADIUS)
    ctx.fill()

    const grad = ctx.createLinearGradient(x - NODE_W / 2, y - NODE_H / 2, x + NODE_W / 2, y - NODE_H / 2)
    grad.addColorStop(0, "#ff2a2a")
    grad.addColorStop(1, "#000")
    ctx.fillStyle = grad
    drawRoundedRect(x - NODE_W / 2, y - NODE_H / 2, NODE_W, HEADER_H, NODE_RADIUS)
    ctx.fill()

    ctx.strokeStyle = "#cbd5e1"
    ctx.lineWidth = 2
    drawRoundedRect(x - NODE_W / 2, y - NODE_H / 2, NODE_W, NODE_H, NODE_RADIUS)
    ctx.stroke()

    ctx.fillStyle = "#fff"
    ctx.font = "13px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("General Node", x, y - NODE_H / 2 + HEADER_H / 2)

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

    ctx.fillStyle = "#fff"
    ctx.font = "16px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("▷", leftAx, ay)
    ctx.fillText("▷", rightAx, ay)
  }
}

/* ================= DRAW CONNECTIONS ================= */
const drawConnections = () => {
  ctx.strokeStyle = "#fff"
  ctx.lineWidth = 4 / scale
  for (const n of Canvas_Status.value) {
    if (n.Next != null) {
      const fromNode = nodes.value.find(nd => nd.id === n.index)
      const toNode = nodes.value.find(nd => nd.id === n.Next)
      if (!fromNode || !toNode) continue
      const fromX = fromNode.x + NODE_W / 2 - ARROW_OFFSET
      const fromY = fromNode.y - NODE_H / 2 + HEADER_H / 2
      const toX = toNode.x - NODE_W / 2 + ARROW_OFFSET
      const toY = toNode.y - NODE_H / 2 + HEADER_H / 2
      ctx.beginPath()
      ctx.moveTo(fromX, fromY)
      ctx.lineTo(toX, toY)
      ctx.stroke()
    }
  }
}

/* ================= DRAW TEMP LINE ================= */
const drawConnectingLine = () => {
  if (!connectingLine) return
  ctx.strokeStyle = "#fff"
  ctx.lineWidth = 4 / scale
  ctx.beginPath()
  ctx.moveTo(connectingLine.fromX, connectingLine.fromY)
  ctx.lineTo(connectingLine.toX, connectingLine.toY)
  ctx.stroke()
}

/* ================= MOUSE EVENTS ================= */
let outputDragging = null
let lastClickTime = 0

const onMouseDown = e => {
  const w = screenToWorld(e.clientX, e.clientY)
  hoveredArrow = null

  for (const n of nodes.value) {
    const hit = arrowHit(n, w.x, w.y)
    if (hit?.side === "right") {
      outputDragging = { node: n, fromX: hit.x, fromY: hit.y }
      connectingLine = { fromNode: n, fromX: hit.x, fromY: hit.y, toX: hit.x, toY: hit.y }
      return
    }
  }

  const hitNode = getNodeAt(w.x, w.y)
  const now = Date.now()
  if (hitNode && now - lastClickTime < 300) {
    openPopup(hitNode)
    lastClickTime = 0
    return
  }
  lastClickTime = now

  if (hitNode) {
    draggingNode = hitNode
    dragOffset.x = w.x - hitNode.x
    dragOffset.y = w.y - hitNode.y
    selectedNodeId.value = hitNode.id
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

  if (outputDragging) {
    connectingLine.toX = mouseWorld.x
    connectingLine.toY = mouseWorld.y
  }

  draw()
  lastX = e.clientX
  lastY = e.clientY
}

const onMouseUp = e => {
  isPanning = false
  draggingNode = null

  if (outputDragging) {
    const w = screenToWorld(e.clientX, e.clientY)
    const targetNode = nodes.value.find(nd => {
      const hit = arrowHit(nd, w.x, w.y)
      return hit?.side === "left" && nd.id !== outputDragging.node.id
    })
    if (targetNode) {
      const cs = Canvas_Status.value.find(s => s.index === outputDragging.node.id)
      if (cs) cs.Next = targetNode.id
    }
    connectingLine = null
    outputDragging = null
  }

  if (menuDragging) {
    const id = nodes.value.length
    const x = mouseWorld.x
    const y = mouseWorld.y
    nodes.value.push({ id, x, y })
    // Initialize with empty scenes array
    Canvas_Status.value.push({ 
      index: id, 
      x, 
      y, 
      node_type: "General", 
      Next: null,
      scenes: [] 
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

// Watch for popup show to initialize graph
watch(showPopup, (newVal) => {
  if (newVal) {
    nextTick(() => {
      setTimeout(initializeGraphCanvas, 100)
    })
  }
})

</script>

<template>
  <div class="wrapper">
    <canvas ref="canvasRef" class="canvas" @mousedown="onMouseDown" @wheel="onWheel" />

    <header class="header">
      <button class="hamburger" @click="toggleMenu">☰</button>
      <div class="center">
        <div class="title">Weaver Project</div>
      </div>
    </header>

    <aside class="side-menu" :class="{ open: menuOpen }">
      <div class="menu-node" @mousedown.prevent="menuDragging = true">
        <div class="menu-node-header">
          <span>▷</span>
          <span class="menu-node-title">General Node</span>
          <span>▷</span>
        </div>
      </div>
    </aside>

    <!-- NODE POPUP - Now covers entire screen -->
    <transition name="popup">
      <div v-if="showPopup" class="popup-overlay">
        <div class="popup" :class="{ active: popupAnimation }">
          <div class="popup-header">
            <!-- Header is now empty since + Add button was removed -->
          </div>
          <div class="popup-body">
            <!-- Main content area (75%) - Now with graph -->
            <div class="popup-content" @mousemove="onGraphMouseMove" @mouseleave="onGraphMouseLeave">
              <canvas 
                ref="graphCanvasRef" 
                class="graph-canvas"
              ></canvas>
              
              <!-- Graph Coordinates Popup -->
              <div 
                v-if="showGraphCoords" 
                class="graph-coords-popup"
                :style="{
                  left: graphCoordsPopupPos.x + 'px',
                  top: graphCoordsPopupPos.y + 'px'
                }"
              >
                <div class="coords-text">
                  ({{ graphCoords.x }}, {{ graphCoords.y }})
                </div>
              </div>
            </div>
            
            <!-- Scene panel (25%) - Fixed height with scroll -->
            <div class="scene-panel">
              <!-- Scenes List View -->
              <div v-if="viewMode === 'scenes'" class="scene-list-view">
                <div class="scene-panel-header">
                  <span class="scene-panel-title">Scenes</span>
                  <button class="add-scene-btn" @click="addScene">
                    Add Scene
                  </button>
                </div>
                <div class="scene-list">
                  <div 
                    v-for="scene in nodeScenes" 
                    :key="scene.id"
                    class="scene-item"
                    @mouseenter="hoveredSceneId = scene.id"
                    @mouseleave="hoveredSceneId = null"
                    @dblclick="selectScene(scene)"
                  >
                    <span class="scene-name">{{ scene.name }}</span>
                    <button 
                      v-show="hoveredSceneId === scene.id"
                      class="scene-delete-btn"
                      @click="deleteScene(scene.id)"
                      title="Delete scene"
                    >
                      🗑️
                    </button>
                  </div>
                  <div v-if="nodeScenes.length === 0" class="no-scenes">
                    No scenes added yet
                  </div>
                </div>
              </div>
              
              <!-- Scene Details View -->
              <div v-else-if="viewMode === 'sceneDetails' && selectedScene" class="scene-details-view">
                <div class="scene-panel-header">
                  <button class="back-btn" @click="goBackToScenes" title="Back to scenes">
                    ←
                  </button>
                  <span class="scene-panel-title">Scene Details: {{ selectedScene.name }}</span>
                </div>
                
                <div class="scene-details-content">
                  <div class="detail-section">
                    <label class="detail-label">Scene Name:</label>
                    <input 
                      v-model="selectedScene.name" 
                      class="detail-input"
                      @change="updateSceneDetails"
                      placeholder="Enter scene name"
                    />
                  </div>
                  
                  <!-- Scene Content Box -->
                  <div class="scene-content-box">
                    <div class="scene-content-header">
                      <span class="scene-content-title">Scene Content</span>
                      <button class="add-content-btn" @click="toggleAddDropdown">
                        + Add
                      </button>
                      
                      <!-- Add Content Dropdown -->
                      <div v-if="showAddDropdown" class="add-dropdown">
                        <div 
                          v-for="option in addDropdownOptions" 
                          :key="option.id"
                          class="dropdown-item"
                          @click="selectAddOption(option)"
                        >
                          {{ option.label }}
                        </div>
                      </div>
                    </div>
                    <div class="scene-content-body">
                      <!-- Content will go here when items are added -->
                      <div class="empty-content">
                        No content added yet. Click "+ Add" to add content.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- Cancel button moved to bottom right corner -->
          <button class="popup-cancel" @click="closePopup">Cancel</button>
          
          <!-- Close dropdown when clicking outside -->
          <div v-if="showAddDropdown" class="dropdown-overlay" @click="closeAddDropdown"></div>
        </div>
      </div>
    </transition>
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

.title { font-size: 1.3rem; color: #00ff88 }

/* ========== FULL SCREEN POPUP STYLES ========== */
.popup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.95);
  z-index: 100;
}

.popup {
  width: 100%;
  height: 100%;
  background: #1f2937;
  opacity: 0;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
}

.popup.active {
  opacity: 1;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
}

.popup-body {
  flex: 1;
  padding: 24px;
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

/* Graph Canvas Styles */
.popup-content {
  width: 75%;
  height: calc(100% - 48px);
  background: rgba(255,255,255,0.05);
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}

.graph-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

/* Graph Coordinates Popup */
.graph-coords-popup {
  position: fixed;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #00ff88;
  border-radius: 6px;
  padding: 8px 12px;
  color: #00ff88;
  font-family: monospace;
  font-size: 14px;
  font-weight: bold;
  pointer-events: none;
  z-index: 102;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  min-width: 80px;
  text-align: center;
}

.coords-text {
  white-space: nowrap;
}

/* Scene Panel Styles - FIXED HEIGHT with scroll */
.scene-panel {
  width: 25%;
  /* Use vh (viewport height) to ensure it stays relative to the screen size */
  height: calc(80vh - 48px); 
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 16px;
  
  display: flex;
  flex-direction: column;
  
  /* CRITICAL: This prevents the panel from growing and enables the scrollbar */
  overflow-y: auto; 
  box-sizing: border-box; /* Ensures padding doesn't add to the height */
}

/* Optional: Style the scrollbar to match the dark theme */
.scene-panel::-webkit-scrollbar {
  width: 6px;
}

.scene-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
}

/* Scene List View Styles */
.scene-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0; /* Prevent header from shrinking */
  position: relative;
}

.scene-panel-title {
  color: #e2e8f0;
  font-size: 1rem;
  font-weight: 600;
}

.add-scene-btn {
  background: #00ff88;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  color: #000;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.add-scene-btn:hover {
  background: #00dd77;
}

.scene-list {
  flex: 1;
  overflow-y: auto; /* Make the list scrollable */
  min-height: 0; /* Important for flex child to respect overflow */
}

.scene-item {
  padding: 10px 12px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
  cursor: default;
  flex-shrink: 0; /* Prevent scene items from shrinking */
}

.scene-item:hover {
  background: rgba(255, 255, 255, 0.12);
}

.scene-name {
  color: #e2e8f0;
  font-size: 0.9rem;
  font-weight: 500;
}

.scene-delete-btn {
  background: transparent;
  border: none;
  color: #f87171;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.scene-delete-btn:hover {
  background: rgba(248, 113, 113, 0.2);
}

.no-scenes {
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.9rem;
  text-align: center;
  padding: 20px;
  font-style: italic;
  flex-shrink: 0; /* Prevent the "no scenes" message from shrinking */
}

/* Scene Details View Styles */
.back-btn {
  background: transparent;
  border: none;
  color: #e2e8f0;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  margin-right: 8px;
  transition: background-color 0.2s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.scene-details-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.detail-section {
  margin-bottom: 16px;
}

.detail-label {
  display: block;
  color: #e2e8f0;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 6px;
}

.detail-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 8px 12px;
  color: #e2e8f0;
  font-size: 0.9rem;
  box-sizing: border-box;
}

.detail-input:focus {
  outline: none;
  border-color: #00ff88;
}

/* Scene Content Box Styles */
.scene-content-box {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  overflow: hidden;
  margin-top: 16px;
}

.scene-content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
}

.scene-content-title {
  color: #e2e8f0;
  font-size: 0.9rem;
  font-weight: 600;
}

.add-content-btn {
  background: #3b82f6;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  color: #fff;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.add-content-btn:hover {
  background: #2563eb;
}

.add-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  background: #374151;
  border-radius: 6px;
  padding: 8px 0;
  margin-top: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 101;
  min-width: 120px;
}

.dropdown-item {
  padding: 8px 16px;
  color: #e2e8f0;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.scene-content-body {
  padding: 16px;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-content {
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.85rem;
  font-style: italic;
  text-align: center;
}

/* Cancel button - Now at bottom right corner */
.popup-cancel {
  position: absolute;
  bottom: 24px;
  right: 24px;
  background: #ff4444;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  z-index: 10;
}

.popup-cancel:hover {
  background: #ff0000;
}

/* Popup transition */
.popup-enter-active,
.popup-leave-active {
  transition: all 0.3s ease;
}

.popup-enter-from,
.popup-leave-to {
  opacity: 0;
}

.popup-enter-to,
.popup-leave-from {
  opacity: 1;
}
</style>