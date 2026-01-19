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

// Fullscreen Logic
const isFullscreen = ref(false)

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable fullscreen: ${err.message}`)
    })
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen()
    }
  }
}

const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

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
// Holds the name currently being edited in the popup
const editingNodeName = ref("") 

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
// Separate canvas for images
const imagesCanvasRef = ref(null)
let imagesCtx

// Graph settings
const GRAPH_MIN_X = -1000
const GRAPH_MAX_X = 1000
const GRAPH_MIN_Y = -600
const GRAPH_MAX_Y = 600
const GRAPH_MAJOR_GRID = 100  // Major grid lines every 100 units
const GRAPH_MINOR_GRID = 20   // Minor grid lines every 20 units

/* ================= IMAGE MANAGEMENT ================= */
const sceneImages = ref([]) // Images for the current scene
const imageInputRef = ref(null) // Reference to file input
const isDraggingImage = ref(false)
const draggingImageIndex = ref(null)
const dragImageOffset = ref({ x: 0, y: 0 })

// NEW: Active Component State for Component Editor
const activeComponent = ref(null)

/* ================= SCENE SETTINGS ================= */
const sceneSettings = ref({
  backgroundColor: '#000000' // Default black (opaque)
})

/* ================= SCENES MANAGEMENT ================= */
const nodeScenes = ref([]) // Scenes for the currently opened node
const hoveredSceneId = ref(null) // Track which scene is hovered
const selectedScene = ref(null) // Track which scene is selected for editing
const viewMode = ref('scenes') // 'scenes', 'sceneDetails', or 'componentEditor'

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
  
  if (option.id === 'image') {
    // Trigger image file input
    imageInputRef.value.click()
  } else {
    // For other options, just log for now
    console.log(`Handling ${option.label} option`)
  }
  
  showAddDropdown.value = false
}

const closeAddDropdown = () => {
  showAddDropdown.value = false
}

/* ================= IMAGE HANDLING FUNCTIONS ================= */
const handleImageUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  // Check if file is an image
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file')
    return
  }
  
  // Create a unique filename
  const timestamp = Date.now()
  const fileName = `scene_${selectedScene.value.id}_image_${timestamp}_${file.name}`
  
  // Create a FileReader to read the image
  const reader = new FileReader()
  
  reader.onload = (e) => {
    const imageUrl = e.target.result
    
    // Create image object - position at origin (0,0)
    const newImage = {
      id: Date.now(), // Unique ID for the image
      name: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension for display name
      url: imageUrl,
      x: 0, // Position at origin
      y: 0,
      width: 100, // Default width
      height: 100, // Default height (will be adjusted based on aspect ratio)
      originalFile: file, // Keep reference to original file
      // New properties for display
      displayX: 0, // For scene panel display
      displayY: 0,
      displayWidth: 120, // Fixed width for panel display
      displayHeight: 90, // Fixed height for panel display
      aspectRatio: 1 // Will be updated on load
    }
    
    // Load the image to get its dimensions
    const img = new Image()
    img.onload = () => {
      // Adjust size while maintaining aspect ratio
      const maxSize = 200
      let width = img.width
      let height = img.height
      const ratio = width / height
      
      newImage.aspectRatio = ratio

      if (width > maxSize || height > maxSize) {
        if (width > height) {
            width = maxSize
            height = maxSize / ratio
        } else {
            height = maxSize
            width = maxSize * ratio
        }
      }
      
      newImage.width = width
      newImage.height = height
      newImage.naturalWidth = img.width
      newImage.naturalHeight = img.height
      
      // Add to scene images
      sceneImages.value.push(newImage)
      
      // Update scene content display
      updateSceneContentDisplay()
      
      // Redraw images on the images canvas
      drawImages()
      
      console.log(`Image uploaded: ${file.name}, Size: ${width}x${height}, Position: (${newImage.x}, ${newImage.y})`)
    }
    img.src = imageUrl
  }
  
  reader.readAsDataURL(file)
  
  // Reset file input
  event.target.value = ''
}

// MODIFIED: This function now renders a single-line layout
const updateSceneContentDisplay = () => {
  const contentBody = document.querySelector('.scene-content-body')
  if (contentBody) {
    if (sceneImages.value.length > 0) {
      contentBody.innerHTML = ''
      
      sceneImages.value.forEach((image, index) => {
        // Main Container (The Row)
        const imageContainer = document.createElement('div')
        imageContainer.className = 'image-container'
        imageContainer.dataset.index = index
        
        // 1. Drag Handle Icon (Leftmost)
        const dragHandle = document.createElement('div')
        dragHandle.className = 'image-drag-handle'
        dragHandle.innerHTML = '⋮⋮' 
        dragHandle.title = 'Drag to reorder'
        
        // 2. Image Icon/Thumbnail
        const imgIconDiv = document.createElement('div')
        imgIconDiv.className = 'image-list-icon'
        const imgElement = document.createElement('img')
        imgElement.src = image.url
        imgElement.alt = image.name
        imgIconDiv.appendChild(imgElement)
        
        // 3. Image Name (Middle - Flexible width)
        const imageName = document.createElement('div')
        imageName.className = 'image-name'
        imageName.title = image.name // Tooltip shows full name
        imageName.textContent = image.name
        
        // 4. Delete Button (Rightmost)
        const removeBtn = document.createElement('button')
        removeBtn.className = 'remove-image-btn'
        removeBtn.title = 'Delete image'
        removeBtn.innerHTML = '🗑️'
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          confirmRemoveImage(index)
        })
        
        // Assemble Row: Handle -> Icon -> Name -> Delete
        imageContainer.appendChild(imgIconDiv) // Icon
        imageContainer.appendChild(imageName)  // Name
        imageContainer.appendChild(removeBtn)  // Delete
        imageContainer.appendChild(dragHandle) // Drag Handle (Placed at end as per "icon... name... trash... dots")
        
        // Click to select logic
        imageContainer.addEventListener('click', () => {
          document.querySelectorAll('.image-container').forEach(container => {
            container.classList.remove('selected')
          })
          imageContainer.classList.add('selected')
        })

        // NEW: Double Click to open Component Editor
        imageContainer.addEventListener('dblclick', () => {
            openComponentEditor(image)
        })
        
        contentBody.appendChild(imageContainer)
      })
    } else {
      contentBody.innerHTML = '<div class="empty-content">No content added yet. Click "+ Add" to add content.</div>'
    }
  }
}

const confirmRemoveImage = (index) => {
  if (confirm('Are you sure you want to delete this image?')) {
    removeImage(index)
  }
}

const removeImage = (index) => {
  // If we are deleting the currently active component, go back
  if (activeComponent.value && sceneImages.value[index].id === activeComponent.value.id) {
    closeComponentEditor()
  }
  sceneImages.value.splice(index, 1)
  updateSceneContentDisplay()
  drawImages()
}

const onGraphMouseDown = (event) => {
  if (!imagesCanvasRef.value) return
  
  const rect = imagesCanvasRef.value.getBoundingClientRect()
  const mouseX = event.clientX
  const mouseY = event.clientY
  
  // Check if mouse is inside images canvas
  if (mouseX >= rect.left && mouseX <= rect.right && 
      mouseY >= rect.top && mouseY <= rect.bottom) {
    
    // Convert to graph coordinates
    const coords = screenToGraphCoords(mouseX, mouseY)
    
    // Check if clicking on an image
    // Iterate backwards to select top-most image first
    let clickedImage = null
    for (let i = sceneImages.value.length - 1; i >= 0; i--) {
      const image = sceneImages.value[i]
      const imageLeft = image.x - (image.width / 2)
      const imageRight = image.x + (image.width / 2)
      const imageTop = image.y + (image.height / 2) // Note: Y is inverted
      const imageBottom = image.y - (image.height / 2)
      
      if (coords.x >= imageLeft && coords.x <= imageRight &&
          coords.y <= imageTop && coords.y >= imageBottom) {
        
        clickedImage = image
        
        isDraggingImage.value = true
        draggingImageIndex.value = i
        dragImageOffset.value = {
          x: coords.x - image.x,
          y: coords.y - image.y
        }
        
        // Bring image to front (move to end of array)
        // NOTE: In standard behavior, clicking brings to front. 
        // With explicit layering controls, we might strictly want to keep order unless explicitly moved.
        // However, dragging logic often benefits from being "on top". 
        // For this specific request "position on top/bottom", we will NOT automatically reorder array on click
        // so that the manual Z-index controls dictate the order.
        
        // We just select it index-wise
        draggingImageIndex.value = i;
        
        // Update Active Component if in editor mode
        if (viewMode.value === 'componentEditor') {
            activeComponent.value = clickedImage
        }

        drawImages()
        
        // Update the selected state in the panel
        setTimeout(() => {
          const containers = document.querySelectorAll('.image-container')
          containers.forEach((container, idx) => {
            container.classList.remove('selected')
            if (idx === draggingImageIndex.value) {
              container.classList.add('selected')
            }
          })
        }, 10)
        
        return
      }
    }
  }
}

const onGraphMouseMove = (event) => {
  if (!imagesCanvasRef.value) return
  
  const rect = imagesCanvasRef.value.getBoundingClientRect()
  const mouseX = event.clientX
  const mouseY = event.clientY
  
  // Check if mouse is inside images canvas
  if (mouseX >= rect.left && mouseX <= rect.right && 
      mouseY >= rect.top && mouseY <= rect.bottom) {
    
    // Handle image dragging
    if (isDraggingImage.value && draggingImageIndex.value !== null) {
      const coords = screenToGraphCoords(mouseX, mouseY)
      const image = sceneImages.value[draggingImageIndex.value]
      image.x = coords.x - dragImageOffset.value.x
      image.y = coords.y - dragImageOffset.value.y
      
      drawImages()
    }
  }
}

const onGraphMouseUp = () => {
  if (isDraggingImage.value) {
    isDraggingImage.value = false
    draggingImageIndex.value = null
    drawImages()
  }
}

/* ================= COMPONENT EDITOR LOGIC ================= */
const openComponentEditor = (image) => {
    activeComponent.value = image
    viewMode.value = 'componentEditor'
    drawImages() // Trigger redraw to show focus ring
}

const closeComponentEditor = () => {
    activeComponent.value = null
    viewMode.value = 'sceneDetails'
    drawImages() // Remove focus ring
    updateSceneContentDisplay() // Refresh list just in case
}

const updateActiveComponentPosition = () => {
    if (activeComponent.value) {
        // Force redraw when sliders/inputs change
        drawImages()
    }
}

const updateActiveComponentSize = () => {
    if (activeComponent.value) {
        // Maintain aspect ratio
        const ratio = activeComponent.value.aspectRatio || (activeComponent.value.naturalWidth / activeComponent.value.naturalHeight) || 1
        activeComponent.value.height = activeComponent.value.width / ratio
        drawImages()
    }
}

// Z-INDEX / LAYERING LOGIC
const changeLayer = (action) => {
    if (!activeComponent.value) return
    
    // Find current index of the active component
    const idx = sceneImages.value.findIndex(img => img.id === activeComponent.value.id)
    if (idx === -1) return

    const arr = sceneImages.value
    
    if (action === 'up') {
        // Swap with next element (move towards end of array = draw later = on top)
        if (idx < arr.length - 1) {
            const temp = arr[idx]
            arr[idx] = arr[idx + 1]
            arr[idx + 1] = temp
        }
    } else if (action === 'down') {
        // Swap with prev element (move towards start of array = draw earlier = behind)
        if (idx > 0) {
            const temp = arr[idx]
            arr[idx] = arr[idx - 1]
            arr[idx - 1] = temp
        }
    } else if (action === 'top') {
        // Move to end
        const [item] = arr.splice(idx, 1)
        arr.push(item)
    } else if (action === 'bottom') {
        // Move to start
        const [item] = arr.splice(idx, 1)
        arr.unshift(item)
    }
    
    drawImages()
    updateSceneContentDisplay() // List order reflects z-index
}

/* ================= NODE & POPUP RENAME LOGIC ================= */
const updateNodeName = () => {
  if (!popupNode.value) return
  
  // Find the node in Canvas_Status
  const status = Canvas_Status.value.find(s => s.index === popupNode.value.id)
  
  if (status) {
    status.Node_name = editingNodeName.value
    // Redraw the main canvas to reflect the name change immediately
    draw()
  }
}

const openPopup = node => {
  popupNode.value = node
  viewMode.value = 'scenes'
  selectedScene.value = null
  sceneImages.value = [] // Clear images when opening new node
  sceneSettings.value.backgroundColor = '#000000' // Reset to black
  activeComponent.value = null // Reset active component
  
  // Load Node Data from Canvas_Status
  const nodeStatus = Canvas_Status.value.find(s => s.index === node.id)
  if (nodeStatus) {
    // 1. Set the Name for editing
    if (!nodeStatus.Node_name) {
      nodeStatus.Node_name = `Node ${node.id}`
    }
    editingNodeName.value = nodeStatus.Node_name

    // 2. Load Scenes
    if (nodeStatus.scenes) {
      nodeScenes.value = [...nodeStatus.scenes]
      nodeScenes.value.forEach((scene, index) => {
        if (!scene.name) scene.name = `Scene ${scene.id}`
        if (!scene.backgroundColor) scene.backgroundColor = '#000000'
      })
    } else {
      nodeScenes.value = []
    }
  } else {
    // Safety fallback
    editingNodeName.value = `Node ${node.id}`
    nodeScenes.value = []
  }
  
  showPopup.value = true
  nextTick(() => {
    popupAnimation.value = true
    setTimeout(initializeGraphCanvas, 50)
  })
}

const closePopup = () => {
  // Save current scene details before closing
  if (selectedScene.value) {
    updateSceneDetails()
  }
  
  popupAnimation.value = false
  isDraggingImage.value = false
  draggingImageIndex.value = null
  activeComponent.value = null
  
  setTimeout(() => {
    showPopup.value = false
    popupNode.value = null
    nodeScenes.value = []
    hoveredSceneId.value = null
    selectedScene.value = null
    sceneImages.value = []
    viewMode.value = 'scenes'
    editingNodeName.value = "" // Reset name buffer
  }, 300) // duration of animation
}

/* ================= BACKGROUND COLOR FUNCTIONS ================= */
const updateBackgroundColor = () => {
  // Update the background color overlay
  const overlay = document.querySelector('.background-color-overlay')
  if (overlay) {
    overlay.style.backgroundColor = sceneSettings.value.backgroundColor
  }
}

/* ================= GRAPH FUNCTIONS ================= */
const initializeGraphCanvas = () => {
  if (!graphCanvasRef.value || !imagesCanvasRef.value) return
  
  graphCtx = graphCanvasRef.value.getContext('2d')
  imagesCtx = imagesCanvasRef.value.getContext('2d')
  resizeGraphCanvas()
  // Only draw graph if a scene is selected
  if (selectedScene.value) {
    drawGraph()
  }
}

const resizeGraphCanvas = () => {
  if (!graphCanvasRef.value || !imagesCanvasRef.value) return
  
  const container = document.querySelector('.popup-content')
  if (container) {
    const rect = container.getBoundingClientRect()
    graphCanvasRef.value.width = rect.width
    graphCanvasRef.value.height = rect.height
    imagesCanvasRef.value.width = rect.width
    imagesCanvasRef.value.height = rect.height
    // Only draw if a scene is selected
    if (selectedScene.value) {
      drawGraph()
      drawImages()
    }
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

const graphToScreenCoords = (graphX, graphY) => {
  if (!graphCanvasRef.value) return { x: 0, y: 0 }
  
  const canvas = graphCanvasRef.value
  const centerX = canvas.width / 2
  const centerY = canvas.height / 2
  
  const pixelsPerUnit = 2
  const screenX = centerX + (graphX * pixelsPerUnit)
  const screenY = centerY - (graphY * pixelsPerUnit) // Invert Y axis
  
  return { x: screenX, y: screenY }
}

const drawGraph = () => {
  if (!graphCtx || !graphCanvasRef.value || !selectedScene.value) return
  
  const canvas = graphCanvasRef.value
  const ctx = graphCtx
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // Get center coordinates
  const centerX = canvas.width / 2
  const centerY = canvas.height / 2
  
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

const drawImages = () => {
  if (!imagesCtx || !imagesCanvasRef.value || !selectedScene.value) return
  
  const ctx = imagesCtx
  const canvas = imagesCanvasRef.value
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  if (sceneImages.value.length === 0) return
  
  sceneImages.value.forEach((image, index) => {
    // Convert graph coordinates to screen coordinates
    const screenPos = graphToScreenCoords(image.x, image.y)
    
    // Create image element
    const img = new Image()
    img.onload = () => {
      // Draw image
      ctx.drawImage(
        img,
        screenPos.x - (image.width / 2),
        screenPos.y - (image.height / 2),
        image.width,
        image.height
      )
      
      // Draw selection/focus border
      // Condition: Image is being dragged OR Image is the active focused component
      const isActive = (activeComponent.value && activeComponent.value.id === image.id)
      const isDragging = (isDraggingImage.value && draggingImageIndex.value === index)

      if (isActive || isDragging) {
        ctx.strokeStyle = '#00ff88'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 3])
        ctx.strokeRect(
          screenPos.x - (image.width / 2) - 2,
          screenPos.y - (image.height / 2) - 2,
          image.width + 4,
          image.height + 4
        )
        ctx.setLineDash([])
      }
    }
    img.src = image.url
  })
}

/* ================= SCENE FUNCTIONS ================= */
const addScene = () => {
  if (!popupNode.value) return
  
  const newSceneId = nodeScenes.value.length + 1
  const newScene = {
    id: newSceneId,
    name: `Scene ${newSceneId}`,
    backgroundColor: '#000000' // Default black background
  }
  
  nodeScenes.value.push(newScene)
  
  // Update Canvas_Status with the new scene
  updateNodeScenesInStatus()
  
  // Automatically select the newly created scene
  selectScene(newScene)
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
    // Keep existing name or use default
    if (!scene.name || scene.name.startsWith('Scene ')) {
      scene.name = `Scene ${index + 1}`
    }
  })
  
  // Update Canvas_Status
  updateNodeScenesInStatus()
}

const selectScene = (scene) => {
  selectedScene.value = { ...scene }
  viewMode.value = 'sceneDetails'
  sceneImages.value = [] // Clear images when selecting a new scene
  
  // Set scene settings from the selected scene
  sceneSettings.value.backgroundColor = selectedScene.value.backgroundColor || '#000000'
  
  updateSceneContentDisplay()
  updateBackgroundColor()
  // Clear images canvas
  if (imagesCtx && imagesCanvasRef.value) {
    imagesCtx.clearRect(0, 0, imagesCanvasRef.value.width, imagesCanvasRef.value.height)
  }
  // Draw graph when scene is selected
  drawGraph()
}

const saveSceneAndGoBack = () => {
  if (!selectedScene.value) return
  
  // Update scene details before saving
  updateSceneDetails()
  
  // Save the images for this scene (you might want to add this to your updateSceneDetails function)
  const sceneIndex = nodeScenes.value.findIndex(scene => scene.id === selectedScene.value.id)
  if (sceneIndex !== -1) {
    // Store the images in the scene object
    nodeScenes.value[sceneIndex].images = [...sceneImages.value]
  }
  
  // Go back to scenes list
  viewMode.value = 'scenes'
  selectedScene.value = null
  sceneImages.value = []
  
  // Clear images canvas
  if (imagesCtx && imagesCanvasRef.value) {
    imagesCtx.clearRect(0, 0, imagesCanvasRef.value.width, imagesCanvasRef.value.height)
  }
}

const goBackToScenes = () => {
  // Save current scene details before going back
  if (selectedScene.value) {
    updateSceneDetails()
    
    // Also save images if you want to persist them
    const sceneIndex = nodeScenes.value.findIndex(scene => scene.id === selectedScene.value.id)
    if (sceneIndex !== -1) {
      nodeScenes.value[sceneIndex].images = [...sceneImages.value]
    }
  }
  
  viewMode.value = 'scenes'
  selectedScene.value = null
  sceneImages.value = []
  // Clear images canvas
  if (imagesCtx && imagesCanvasRef.value) {
    imagesCtx.clearRect(0, 0, imagesCanvasRef.value.width, imagesCanvasRef.value.height)
  }
}

const updateSceneDetails = () => {
  if (!selectedScene.value) return
  
  // Update the scene in nodeScenes
  const index = nodeScenes.value.findIndex(scene => scene.id === selectedScene.value.id)
  if (index !== -1) {
    // Update the scene with current values
    nodeScenes.value[index] = { 
      ...selectedScene.value,
      // Ensure background color is stored
      backgroundColor: sceneSettings.value.backgroundColor
    }
    updateNodeScenesInStatus()
  }
}

const updateNodeScenesInStatus = () => {
  if (!popupNode.value) return
  
  // Find the node in Canvas_Status
  const nodeStatusIndex = Canvas_Status.value.findIndex(s => s.index === popupNode.value.id)
  
  if (nodeStatusIndex !== -1) {
    // Update existing node with scene details
    Canvas_Status.value[nodeStatusIndex].scenes = nodeScenes.value.map(scene => ({
      id: scene.id,
      name: scene.name,
      backgroundColor: scene.backgroundColor || '#000000' // Default black
    }))
  } else {
    // Create new node entry with scenes
    Canvas_Status.value.push({ 
      index: popupNode.value.id, 
      x: popupNode.value.x, 
      y: popupNode.value.y, 
      node_type: "General", 
      Next: null,
      scenes: nodeScenes.value.map(scene => ({
        id: scene.id,
        name: scene.name,
        backgroundColor: scene.backgroundColor || '#000000' // Default black
      })),
      Node_name: `Node ${popupNode.value.id}` // Ensure name exists
    })
  }
  
  // Log the updated Canvas_Status for debugging
  console.log('Canvas_Status updated:', JSON.stringify(Canvas_Status.value, null, 2))
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
  // Input Arrow (Left) stays in the Header (centered vertically in header)
  const leftAy = n.y - NODE_H / 2 + HEADER_H / 2
  const leftAx = n.x - NODE_W / 2 + ARROW_OFFSET

  // Output Arrow (Right) moves to the Node Body (centered vertically in body)
  const rightAy = n.y + HEADER_H / 2
  const rightAx = n.x + NODE_W / 2 - ARROW_OFFSET

  if (Math.hypot(wx - leftAx, wy - leftAy) < ARROW_HIT_R) return { node: n, side: "left", x: leftAx, y: leftAy }
  if (Math.hypot(wx - rightAx, wy - rightAy) < ARROW_HIT_R) return { node: n, side: "right", x: rightAx, y: rightAy }
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

    // --- DRAW NODE NAME ---
    ctx.fillStyle = "#fff"
    ctx.font = "13px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    
    // Find the node status to get the name
    const status = Canvas_Status.value.find(s => s.index === n.id)
    // Use stored name or default
    let label = status ? (status.Node_name || `Node ${n.id}`) : "General Node"
    
    // TRUNCATION LOGIC
    // NODE_W is 180. We leave some padding (e.g. 30px total for left/right arrows)
    const maxWidth = NODE_W - 30 
    
    // Check if text exceeds max width
    if (ctx.measureText(label).width > maxWidth) {
      // Loop to shorten string until it fits with "..."
      while (ctx.measureText(label + "...").width > maxWidth && label.length > 0) {
        label = label.slice(0, -1)
      }
      label += "..."
    }
    
    ctx.fillText(label, x, y - NODE_H / 2 + HEADER_H / 2)

    // Left Arrow - In Header
    const leftAy = y - NODE_H / 2 + HEADER_H / 2
    const leftAx = x - NODE_W / 2 + ARROW_OFFSET

    // Right Arrow - In Body (Below Header)
    // Centered in the remaining space: (Node Height - Header Height)
    const rightAy = y + HEADER_H / 2
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
    ctx.fillText("▷", leftAx, leftAy)
    ctx.fillText("▷", rightAx, rightAy)
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
      
      // Start from RIGHT arrow (Body) of FromNode
      const fromX = fromNode.x + NODE_W / 2 - ARROW_OFFSET
      const fromY = fromNode.y + HEADER_H / 2

      // End at LEFT arrow (Header) of ToNode
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
    // Initialize with empty scenes array and default Name
    Canvas_Status.value.push({ 
      index: id, 
      x, 
      y, 
      node_type: "General", 
      Next: null, 
      scenes: [],
      Node_name: `Node ${id}` // <--- ADDED DEFAULT NAME
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
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

onBeforeUnmount(() => {
  window.removeEventListener("resize", resize)
  window.removeEventListener("mousemove", onMouseMove)
  window.removeEventListener("mouseup", onMouseUp)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
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
      <button class="fullscreen-btn" @click="toggleFullscreen" title="Toggle Fullscreen">
        <span v-if="!isFullscreen">⤢</span>
        <span v-else>⤡</span>
      </button>
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

    <transition name="popup">
      <div v-if="showPopup" class="popup-overlay">
        <div class="popup" :class="{ active: popupAnimation }">
          
          <div class="popup-header">
            <div class="node-rename-container">
              <span class="node-rename-label">Node:</span>
              <input 
                v-model="editingNodeName" 
                @input="updateNodeName"
                class="node-rename-input" 
                type="text" 
                placeholder="Rename Node"
              />
            </div>
            </div>

          <div class="popup-body">
            <div 
              class="popup-content" 
              @mousemove="onGraphMouseMove"
              @mousedown="onGraphMouseDown"
              @mouseup="onGraphMouseUp"
            >
              <canvas 
                ref="graphCanvasRef" 
                class="graph-canvas"
                :style="{ display: selectedScene ? 'block' : 'none' }"
              ></canvas>
              
              <div 
                class="background-color-overlay"
                :style="{ 
                  backgroundColor: sceneSettings.backgroundColor,
                  display: selectedScene ? 'block' : 'none'
                }"
              ></div>
              
              <canvas 
                ref="imagesCanvasRef" 
                class="images-canvas"
                :style="{ display: selectedScene ? 'block' : 'none' }"
              ></canvas>
              
              <div v-if="!selectedScene" class="welcome-message">
                <div class="welcome-icon">🎬</div>
                <h2 class="welcome-title">Welcome to Scene Editor</h2>
                <p class="welcome-text">
                  To start editing, either:<br>
                  1. Click on an existing scene from the list<br>
                  2. Or click "Add Scene" to create a new one
                </p>
                <div class="welcome-hint">
                  Double-click on a scene in the list to open it
                </div>
              </div>
              
              <input
                type="file"
                ref="imageInputRef"
                accept="image/*"
                style="display: none"
                @change="handleImageUpload"
              />
            </div>
            
            <div class="scene-panel">
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
                  
                  <div class="detail-section">
                    <label class="detail-label">Background Set:</label>
                    <div class="color-picker-container">
                      <input 
                        type="color" 
                        v-model="sceneSettings.backgroundColor"
                        @change="updateBackgroundColor"
                        class="color-input"
                      />
                      <div class="color-preview" :style="{ backgroundColor: sceneSettings.backgroundColor }"></div>
                      <span class="color-value">{{ sceneSettings.backgroundColor }}</span>
                    </div>
                  </div>
                  
                  <div class="scene-content-box">
                    <div class="scene-content-header">
                      <span class="scene-content-title">Scene Content</span>
                      <button class="add-content-btn" @click="toggleAddDropdown">
                        + Add
                      </button>
                      
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
                      <div v-if="sceneImages.length === 0" class="empty-content">
                        No content added yet. Click "+ Add" to add content.
                      </div>
                    </div>
                  </div>
                  
                  <div class="save-button-container">
                    <button class="save-scene-btn" @click="saveSceneAndGoBack">
                      Save & Back to Scenes
                    </button>
                  </div>
                </div>
              </div>

              <div v-else-if="viewMode === 'componentEditor' && activeComponent" class="component-editor-view">
                <div class="scene-panel-header">
                  <button class="back-btn" @click="closeComponentEditor" title="Back to Scene Details">
                    ←
                  </button>
                  <span class="scene-panel-title">Component Editor</span>
                </div>

                <div class="scene-details-content">
                    <div class="component-preview">
                        <img :src="activeComponent.url" alt="Preview" />
                    </div>

                    <div class="detail-section">
                        <label class="detail-label">Name:</label>
                        <input 
                            v-model="activeComponent.name" 
                            class="detail-input"
                            @change="updateSceneContentDisplay"
                        />
                    </div>

                    <div class="detail-section">
                        <label class="detail-label">Position X:</label>
                        <div class="input-row">
                            <input 
                                type="range"
                                v-model.number="activeComponent.x"
                                :min="GRAPH_MIN_X"
                                :max="GRAPH_MAX_X"
                                class="range-input"
                                @input="updateActiveComponentPosition"
                            />
                            <input 
                                type="number"
                                v-model.number="activeComponent.x"
                                class="number-input"
                                @input="updateActiveComponentPosition"
                            />
                        </div>
                    </div>

                    <div class="detail-section">
                        <label class="detail-label">Position Y:</label>
                        <div class="input-row">
                            <input 
                                type="range"
                                v-model.number="activeComponent.y"
                                :min="GRAPH_MIN_Y"
                                :max="GRAPH_MAX_Y"
                                class="range-input"
                                @input="updateActiveComponentPosition"
                            />
                            <input 
                                type="number"
                                v-model.number="activeComponent.y"
                                class="number-input"
                                @input="updateActiveComponentPosition"
                            />
                        </div>
                    </div>

                    <div class="detail-section">
                        <label class="detail-label">Width (px):</label>
                        <div class="input-row">
                            <input 
                                type="range"
                                v-model.number="activeComponent.width"
                                min="10"
                                max="800"
                                class="range-input"
                                @input="updateActiveComponentSize"
                            />
                            <input 
                                type="number"
                                v-model.number="activeComponent.width"
                                class="number-input"
                                @input="updateActiveComponentSize"
                            />
                        </div>
                    </div>

                    <div class="detail-section">
                        <label class="detail-label">Layering:</label>
                        <div class="layering-controls">
                            <button class="layer-btn" @click="changeLayer('top')" title="Bring to Front">⇈</button>
                            <button class="layer-btn" @click="changeLayer('up')" title="Bring Forward">↑</button>
                            <button class="layer-btn" @click="changeLayer('down')" title="Send Backward">↓</button>
                            <button class="layer-btn" @click="changeLayer('bottom')" title="Send to Back">⇊</button>
                        </div>
                    </div>

                </div>
              </div>

            </div>
          </div>
          <button class="popup-cancel" @click="closePopup">Cancel</button>
          
          <div v-if="showAddDropdown" class="dropdown-overlay" @click="closeAddDropdown"></div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
  .wrapper { 
    width: 100vw; 
    height: 100vh;
    /* Added overflow hidden to prevent body scrolling when popup content overscrolls */
    overflow: hidden;
    position: relative;
    background-color: #000;
  }
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

  /* Fullscreen button styles */
  .fullscreen-btn {
    position: absolute;
    right: 16px;
    font-size: 22px;
    background: none;
    border: none;
    color: #00ff88;
    cursor: pointer;
    z-index: 11;
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

  /* Node Rename Styles (Header Input) */
  .node-rename-container {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .node-rename-label {
    color: #9ca3af;
    font-size: 14px;
    font-weight: 500;
  }

  .node-rename-input {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #00ff88;
    font-size: 16px;
    font-weight: 600;
    padding: 6px 12px;
    outline: none;
    transition: all 0.2s;
    width: 250px;
  }

  .node-rename-input:focus {
    border-color: #00ff88;
    box-shadow: 0 0 0 2px rgba(0, 255, 136, 0.2);
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
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .graph-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    cursor: crosshair;
    z-index: 1; /* Graph is at the bottom layer */
  }

  /* Background Color Overlay - Middle layer */
  .background-color-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 2; /* Middle layer between graph and images */
    pointer-events: none; /* Allows clicking through to the graph/images */
    mix-blend-mode: normal;
  }

  /* Images Canvas - Top layer */
  .images-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    cursor: move;
    z-index: 3; /* Images are on the top layer */
  }

  /* Welcome Message Styles */
  .welcome-message {
    text-align: center;
    padding: 40px;
    max-width: 500px;
    z-index: 4;
  }

  .welcome-icon {
    font-size: 64px;
    margin-bottom: 24px;
    animation: bounce 2s infinite;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  .welcome-title {
    color: #e2e8f0;
    font-size: 1.8rem;
    font-weight: 700;
    margin-bottom: 16px;
    background: linear-gradient(90deg, #00ff88, #3b82f6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .welcome-text {
    color: #cbd5e1;
    font-size: 1.1rem;
    line-height : 1.6;
    margin-bottom: 24px;
  }

  .welcome-hint {
    color: #00ff88;
    font-size: 0.9rem;
    font-style: italic;
    padding: 12px 20px;
    background: rgba(0, 255, 136, 0.1);
    border-radius: 8px;
    border: 1px solid rgba(0, 255, 136, 0.3);
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

  /* Range Slider Styles */
  .range-input {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    outline: none;
  }

  .range-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    background: #00ff88;
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.1s;
  }

  .range-input::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }

  /* Number Input Styles */
  .number-input {
    width: 60px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 4px 8px;
    color: #e2e8f0;
    font-size: 0.85rem;
    text-align: center;
  }

  .number-input:focus {
    outline: none;
    border-color: #00ff88;
  }

  /* Input Row for Slider + Number */
  .input-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* Layering Controls */
  .layering-controls {
    display: flex;
    gap: 8px;
    justify-content: space-between;
  }

  .layer-btn {
    flex: 1;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 8px 0;
    color: #e2e8f0;
    cursor: pointer;
    font-size: 1.1rem;
    transition: all 0.2s;
  }

  .layer-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: #00ff88;
    color: #00ff88;
  }

  /* Component Preview */
  .component-preview {
    width: 100%;
    height: 150px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .component-preview img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  /* Color Picker Styles */
  .color-picker-container {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .color-input {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    background: transparent;
  }

  .color-input::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .color-input::-webkit-color-swatch {
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
  }

  .color-preview {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    border: 2px solid rgba(255, 255, 255, 0.3);
  }

  .color-value {
    color: #e2e8f0;
    font-size: 0.85rem;
    font-family: monospace;
    background: rgba(255, 255, 255, 0.08);
    padding: 8px 12px;
    border-radius: 6px;
    flex: 1;
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

  /* Scene Content Body Styles - UPDATED FOR SEPARATE IMAGE CONTAINERS */
  .scene-content-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px; /* Reduced gap for compact list */
    min-height: 200px;
    max-height: 400px;
    overflow-y: auto;
  }

  .empty-content {
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.85rem;
    font-style: italic;
    text-align: center;
    padding: 40px 0;
  }

  /* ==========================================================================
     UPDATED IMAGE CONTAINER STYLES (Single Line Layout)
     ========================================================================== */
  
  :deep(.image-container) {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 8px 12px;
    transition: all 0.2s ease;
    
    /* Flex Row Layout */
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    
    flex-shrink: 0;
    height: 50px; /* Fixed height for consistency */
  }

  :deep(.image-container:hover) {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
  }

  :deep(.image-container.selected) {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.3);
  }

  /* Drag Handle (New) */
  :deep(.image-drag-handle) {
    color: rgba(255, 255, 255, 0.3);
    cursor: grab;
    font-size: 14px;
    user-select: none;
    order: 4; /* Pushed to the end visually as requested */
    margin-left: 4px;
  }
  
  :deep(.image-drag-handle:hover) {
    color: rgba(255, 255, 255, 0.8);
  }

  /* Image Icon / Thumbnail (Updated) */
  :deep(.image-list-icon) {
    width: 36px;
    height: 36px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    order: 1; /* First */
  }

  :deep(.image-list-icon img) {
    width: 100%;
    height: 100%;
    object-fit: cover; /* Fill the square */
  }

  /* Image Name (Updated logic for truncation) */
  :deep(.image-name) {
    color: #e2e8f0;
    font-size: 0.9rem;
    font-weight: 500;
    
    /* Flex properties to take available space */
    flex: 1; 
    order: 2; /* Second */
    
    /* Truncation logic */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0; /* Critical for flex child truncation */
  }

  /* Remove Button (Updated) */
  :deep(.remove-image-btn) {
    background: transparent;
    border: none;
    color: #f87171;
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
    font-size: 1rem;
    transition: background-color 0.2s;
    line-height: 1;
    flex-shrink: 0;
    order: 3; /* Third */
  }

  :deep(.remove-image-btn:hover) {
    background: rgba(248, 113, 113, 0.2);
  }

  /* Save Button Container */
  .save-button-container {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    text-align: center;
  }

  .save-scene-btn {
    background: #00ff88;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    color: #000;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background-color 0.2s;
    width: 100%;
  }

  .save-scene-btn:hover {
    background: #00dd77;
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

  /* Dropdown overlay */
  .dropdown-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 99;
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