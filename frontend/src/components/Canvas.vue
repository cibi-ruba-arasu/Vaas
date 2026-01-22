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
const editingNodeName = ref("") 

let draggingNode = null
let dragOffset = { x: 0, y: 0 }
let menuDragging = false

const NODE_W = 180
const NODE_H = 110 // Base Height
const HEADER_H = 28
const NODE_RADIUS = 12
const ARROW_OFFSET = 14
const ARROW_HIT_R = 10
const OPTION_ROW_H = 30 // Height per option row

let hoveredArrow = null
let connectingLine = null 

/* ================= POPUP ================= */
const showPopup = ref(false)
const popupNode = ref(null)
const popupAnimation = ref(false)
let animationFrameId = null 

/* ================= PREVIEW MODE STATE ================= */
const isPreviewMode = ref(false)
const previewCanvasRef = ref(null)
let previewCtx = null
const currentPreviewSceneIndex = ref(0)
const currentPreviewComponentIndex = ref(-1) 
const previewAudioElement = ref(null)
const previewScale = ref(1) 

// ANIMATION STATE
const componentStartTime = ref(0) // Timestamp when the current component started rendering

/* ================= GRAPH SETTINGS ================= */
const graphCanvasRef = ref(null)
let graphCtx
const imagesCanvasRef = ref(null)
let imagesCtx

const GRAPH_MIN_X = -1000
const GRAPH_MAX_X = 1000
const GRAPH_MIN_Y = -600
const GRAPH_MAX_Y = 600
const GRAPH_MAJOR_GRID = 100  
const GRAPH_MINOR_GRID = 20   

/* ================= SCENE COMPONENTS MANAGEMENT ================= */
const sceneComponents = ref([]) 
const imageInputRef = ref(null) 
const videoInputRef = ref(null) 
const isDraggingComponent = ref(false)
const draggingComponentIndex = ref(null)
const dragComponentOffset = ref({ x: 0, y: 0 })

// Drag and Drop List State
let dragSourceIndex = null
let isHandleActive = false

// Active Component State for Component Editor
const activeComponent = ref(null)
// Text Selection State
const textSelection = ref({ start: 0, end: 0, text: '' })
// Options Component Style Editor State
const activeStyleState = ref('normal') 

/* ================= SCENE SETTINGS ================= */
const sceneSettings = ref({
  backgroundColor: '#000000' 
})

/* ================= AUDIO MANAGEMENT ================= */
const sequenceAudio = ref(null)
const audioInputRef = ref(null)

const triggerAudioUpload = () => {
  audioInputRef.value.click()
}

const handleAudioUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return

  sequenceAudio.value = {
    name: file.name,
    url: URL.createObjectURL(file),
    volume: 1.0, 
    loop: true   
  }

  updateNodeAudioInStatus()
  event.target.value = ''
}

const removeAudio = (e) => {
  if (e) e.stopPropagation() 
  sequenceAudio.value = null
  updateNodeAudioInStatus()
}

const updateAudioProperties = () => {
    updateNodeAudioInStatus()
}

const updateNodeAudioInStatus = () => {
    if (!popupNode.value) return
    const nodeStatusIndex = Canvas_Status.value.findIndex(s => s.index === popupNode.value.id)
    
    if (nodeStatusIndex !== -1) {
        Canvas_Status.value[nodeStatusIndex].audio = sequenceAudio.value
    } else {
        Canvas_Status.value.push({ 
            index: popupNode.value.id, 
            x: popupNode.value.x, 
            y: popupNode.value.y, 
            node_type: "General", 
            Next: null, 
            scenes: [],
            audio: sequenceAudio.value,
            options: [],
            Node_name: `Node ${popupNode.value.id}` 
        })
    }
}

/* ================= SYNC OPTIONS TO CANVAS STATUS ================= */
const updateNodeOptionsInStatus = () => {
    if (!popupNode.value) return
    const status = Canvas_Status.value.find(s => s.index === popupNode.value.id)
    if (!status) return

    const scenes = nodeScenes.value || []
    if (scenes.length === 0) {
        status.options = []
        return
    }

    const lastScene = scenes[scenes.length - 1]
    let comps = lastScene.components || []
    
    if (selectedScene.value && selectedScene.value.id === lastScene.id) {
        comps = sceneComponents.value
    }

    const optionsComp = comps.find(c => c.type === 'options')

    if (optionsComp && optionsComp.optionsList) {
        const oldOptions = status.options || []
        status.options = optionsComp.optionsList.map(opt => {
            const existing = oldOptions.find(o => o.id === opt.id)
            return {
                id: opt.id,
                text: opt.text,
                next: existing ? existing.next : null 
            }
        })
    } else {
        status.options = []
    }
    
    draw() 
}

/* ================= SCENES MANAGEMENT ================= */
const nodeScenes = ref([]) 
const hoveredSceneId = ref(null) 
const selectedScene = ref(null) 
const viewMode = ref('scenes') 

/* ================= ADD DROPDOWN ================= */
const showAddDropdown = ref(false)
const addDropdownOptions = [
  { id: 'image', label: 'Image', colorClass: 'hover-green' },
  { id: 'text', label: 'Text', colorClass: 'hover-blue' },
  { id: 'video', label: 'Video', colorClass: 'hover-yellow' },
  { id: 'options', label: 'Options', colorClass: 'hover-red' } 
]

const toggleAddDropdown = () => {
  showAddDropdown.value = !showAddDropdown.value
}

const selectAddOption = (option) => {
  const isLastScene = selectedScene.value && nodeScenes.value.length > 0 && selectedScene.value.id === nodeScenes.value[nodeScenes.value.length - 1].id;

  if (option.id === 'options') {
      if (!isLastScene) {
          alert("The 'Options' component can only be added to the final scene of the sequence.");
          showAddDropdown.value = false;
          return;
      }
      const hasOptions = sceneComponents.value.some(c => c.type === 'options');
      if (hasOptions) {
           alert("This scene already has an Options component.");
           showAddDropdown.value = false;
           return;
      }
      addOptionsComponent();
  } else if (option.id === 'image') {
    imageInputRef.value.click()
  } else if (option.id === 'text') {
    addTextComponent()
  } else if (option.id === 'video') {
    videoInputRef.value.click() 
  }
  showAddDropdown.value = false
}

const closeAddDropdown = () => {
  showAddDropdown.value = false
}

/* ================= OPTIONS HANDLING ================= */
const addOptionsComponent = () => {
    const defaultBtnStyle = {
        backgroundColor: '#374151',
        color: '#ffffff',
        borderColor: '#9ca3af',
        borderWidth: 1,
        borderRadius: 4,
        fontSize: 16,
        fontFamily: 'sans-serif'
    };

    const newOption = {
        id: Date.now(),
        type: 'options',
        name: 'Options Box',
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        rotation: 0,
        optionsList: [
            { id: 1, text: 'Option 1' },
            { id: 2, text: 'Option 2' }
        ],
        styles: {
            normal: { ...defaultBtnStyle },
            hovered: { ...defaultBtnStyle, backgroundColor: '#4b5563', borderColor: '#00ff88' },
            clicked: { ...defaultBtnStyle, backgroundColor: '#1f2937', borderColor: '#00ff88', borderWidth: 2 }
        },
        _hoveredOptionIndex: -1,
        _clickedOptionIndex: -1,
        renderWhileClicked: true,
        autoRender: false,
        // Animation Props
        animationType: 'fade', 
        animationDuration: 1.0 
    }
    sceneComponents.value.push(newOption)
    
    updateNodeOptionsInStatus()
    updateSceneContentDisplay()
    drawComponents()
}

const addOptionToComponent = () => {
    if(!activeComponent.value || activeComponent.value.type !== 'options') return;
    const newId = activeComponent.value.optionsList.length > 0 
        ? Math.max(...activeComponent.value.optionsList.map(o => o.id)) + 1 
        : 1;
    activeComponent.value.optionsList.push({ id: newId, text: `Option ${newId}` });
    updateNodeOptionsInStatus()
    drawComponents();
}

const removeOptionFromComponent = (index) => {
    if(!activeComponent.value || activeComponent.value.type !== 'options') return;
    if (activeComponent.value.optionsList.length <= 2) {
        alert("An Options component must have at least two options.");
        return;
    }
    activeComponent.value.optionsList.splice(index, 1);
    updateNodeOptionsInStatus()
    drawComponents();
}

const getConnectedNodeName = (optionId) => {
    if (!popupNode.value) return "Not connected yet";
    const status = Canvas_Status.value.find(s => s.index === popupNode.value.id);
    if (!status || !status.options) return "Not connected yet";
    
    const optStatus = status.options.find(o => o.id === optionId);
    if (optStatus && optStatus.next) {
        const target = Canvas_Status.value.find(s => s.index === optStatus.next);
        return target ? (target.Node_name || `Node ${target.index}`) : "Unknown Node";
    }
    return "Not connected yet";
}

watch(() => activeComponent.value?.optionsList, (newVal) => {
    if (activeComponent.value && activeComponent.value.type === 'options') {
        updateNodeOptionsInStatus()
        drawComponents() 
    }
}, { deep: true })


/* ================= TEXT HANDLING ================= */
const addTextComponent = () => {
  const newText = {
    id: Date.now(),
    type: 'text',
    name: 'New Text',
    content: 'Hello World',
    x: 0,
    y: 0,
    width: 200, 
    height: 50,
    fontSize: 24,
    fontFamily: 'sans-serif',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    textDecorationColor: '#ffffff',
    textDecorationStyle: 'solid',
    color: '#ffffff',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    rotation: 0,
    url: '',
    renderWhileClicked: true,
    autoRender: false,
    // Animation Props
    animationType: 'fade', 
    animationDuration: 1.0 
  }
   
  const optionsIndex = sceneComponents.value.findIndex(c => c.type === 'options');
  if (optionsIndex !== -1) {
      sceneComponents.value.splice(optionsIndex, 0, newText);
  } else {
      sceneComponents.value.push(newText);
  }

  updateSceneContentDisplay()
  drawComponents()
}

const handleTextSelect = (e) => {
    const input = e.target
    if (input.selectionStart !== input.selectionEnd) {
        textSelection.value = {
            start: input.selectionStart,
            end: input.selectionEnd,
            text: input.value.substring(input.selectionStart, input.selectionEnd)
        }
    } else {
        textSelection.value = { start: 0, end: 0, text: '' }
    }
}

const applyTextStyle = (styleType, value) => {
    if (!activeComponent.value || activeComponent.value.type !== 'text') return
    
    if (styleType === 'bold') {
        activeComponent.value.fontWeight = value
    } else if (styleType === 'italic') {
        activeComponent.value.fontStyle = (activeComponent.value.fontStyle === 'italic' ? 'normal' : 'italic')
    } else if (styleType === 'underline') {
         if (activeComponent.value.textDecoration === 'underline') {
             activeComponent.value.textDecoration = 'none'
         } else {
             activeComponent.value.textDecoration = 'underline'
         }
         if (value && activeComponent.value.textDecoration === 'underline') {
             activeComponent.value.textDecorationColor = value
         }
    } else if (styleType === 'strikethrough') {
         if (activeComponent.value.textDecoration === 'line-through') {
             activeComponent.value.textDecoration = 'none'
         } else {
             activeComponent.value.textDecoration = 'line-through'
         }
         if (value && activeComponent.value.textDecoration === 'line-through') {
             activeComponent.value.textDecorationColor = value
         }
    }
}

/* ================= VIDEO HANDLING FUNCTIONS ================= */
const handleVideoUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return

  if (!file.type.startsWith('video/')) {
    alert('Please select a video file')
    return
  }

  const reader = new FileReader()

  reader.onload = (e) => {
    const videoUrl = e.target.result
    
    const vid = document.createElement('video')
    vid.src = videoUrl
    vid.loop = true 
    vid.muted = false 
    vid.autoplay = true
    vid.playsInline = true
    
    vid.onloadedmetadata = () => {
      const maxSize = 300
      let width = vid.videoWidth
      let height = vid.videoHeight
      const ratio = width / height

      if (width > maxSize || height > maxSize) {
        if (width > height) {
            width = maxSize
            height = maxSize / ratio
        } else {
            height = maxSize
            width = maxSize * ratio
        }
      }

      const newVideo = {
        id: Date.now(),
        type: 'video',
        name: file.name.replace(/\.[^/.]+$/, ""),
        url: videoUrl,
        x: 0,
        y: 0,
        width: width,
        height: height,
        rotation: 0,
        aspectRatio: ratio,
        videoElement: vid, 
        isLoop: true,
        isMuted: false,
        bgMusicVolume: 0.2,
        renderWhileClicked: true,
        autoRender: false,
        // Animation Props
        animationType: 'fade', 
        animationDuration: 1.0 
      }

      vid.play() 
      
      const optionsIndex = sceneComponents.value.findIndex(c => c.type === 'options');
      if (optionsIndex !== -1) {
          sceneComponents.value.splice(optionsIndex, 0, newVideo);
      } else {
          sceneComponents.value.push(newVideo);
      }

      updateSceneContentDisplay()
    }
  }

  reader.readAsDataURL(file)
  event.target.value = ''
}

const updateVideoProperties = () => {
    if (!activeComponent.value || activeComponent.value.type !== 'video') return
    const vid = activeComponent.value.videoElement
    if (vid) {
        vid.loop = activeComponent.value.isLoop
        vid.muted = activeComponent.value.isMuted
    }
}

/* ================= IMAGE HANDLING FUNCTIONS ================= */
const handleImageUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return
   
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file')
    return
  }
   
  const reader = new FileReader()
   
  reader.onload = (e) => {
    const imageUrl = e.target.result
    const img = new Image()
    
    const newImage = {
      id: Date.now(), 
      type: 'image',
      name: file.name.replace(/\.[^/.]+$/, ""), 
      url: imageUrl,
      x: 0, 
      y: 0,
      width: 100, 
      height: 100, 
      rotation: 0,
      originalFile: file, 
      aspectRatio: 1,
      imgObject: img,
      renderWhileClicked: true,
      autoRender: false,
      // Animation Props
      animationType: 'fade', 
      animationDuration: 1.0 
    }
    
    img.onload = () => {
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
      
      const optionsIndex = sceneComponents.value.findIndex(c => c.type === 'options');
      if (optionsIndex !== -1) {
          sceneComponents.value.splice(optionsIndex, 0, newImage);
      } else {
          sceneComponents.value.push(newImage);
      }
      
      updateSceneContentDisplay()
      drawComponents() 
    }
    img.src = imageUrl
  }
   
  reader.readAsDataURL(file)
  event.target.value = ''
}

/* ================= LIST REORDERING & DOM DISPLAY ================= */
const updateSceneContentDisplay = () => {
  nextTick(() => {
    const contentBody = document.querySelector('.scene-content-body')
    if (contentBody) {
        if (sceneComponents.value.length > 0) {
        contentBody.innerHTML = ''
        
        sceneComponents.value.forEach((comp, index) => {
            const imageContainer = document.createElement('div')
            imageContainer.className = 'image-container'
            imageContainer.dataset.index = index
            
            if (comp.type !== 'options') {
                imageContainer.draggable = true 
            }
            
            const indicator = document.createElement('div')
            indicator.className = 'type-indicator'
            if (comp.type === 'image') indicator.classList.add('bg-green')
            else if (comp.type === 'text') indicator.classList.add('bg-blue')
            else if (comp.type === 'video') indicator.classList.add('bg-yellow')
            else if (comp.type === 'options') indicator.classList.add('bg-red') 
            
            if (comp.type !== 'options') {
                const dragHandle = document.createElement('div')
                dragHandle.className = 'image-drag-handle'
                dragHandle.innerHTML = '⋮⋮⋮⋮' 
                dragHandle.title = 'Drag to reorder'
                
                dragHandle.addEventListener('mousedown', () => { isHandleActive = true })
                dragHandle.addEventListener('mouseup', () => { isHandleActive = false })
                
                imageContainer.appendChild(dragHandle) 
            }
            
            const imgIconDiv = document.createElement('div')
            imgIconDiv.className = 'image-list-icon'
            
            if (comp.type === 'image') {
                const imgElement = document.createElement('img')
                imgElement.src = comp.url
                imgElement.alt = comp.name
                imgIconDiv.appendChild(imgElement)
            } else if (comp.type === 'text') {
                imgIconDiv.textContent = 'T'
                imgIconDiv.style.color = '#fff'
                imgIconDiv.style.fontSize = '20px'
                imgIconDiv.style.fontWeight = 'bold'
            } else if (comp.type === 'video') {
                imgIconDiv.textContent = '▶' 
                imgIconDiv.style.color = '#fff'
                imgIconDiv.style.fontSize = '18px'
                imgIconDiv.style.display = 'flex'
                imgIconDiv.style.alignItems = 'center'
                imgIconDiv.style.justifyContent = 'center'
            } else if (comp.type === 'options') {
                imgIconDiv.textContent = '❖' 
                imgIconDiv.style.color = '#fff'
                imgIconDiv.style.fontSize = '18px'
                imgIconDiv.style.display = 'flex'
                imgIconDiv.style.alignItems = 'center'
                imgIconDiv.style.justifyContent = 'center'
            }
            
            const imageName = document.createElement('div')
            imageName.className = 'image-name'
            imageName.title = comp.name 
            imageName.textContent = comp.name
            
            const removeBtn = document.createElement('button')
            removeBtn.className = 'remove-image-btn'
            removeBtn.title = 'Delete'
            removeBtn.innerHTML = '🗑️'
            removeBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            confirmRemoveComponent(index)
            })
            
            imageContainer.appendChild(indicator)
            imageContainer.appendChild(imgIconDiv) 
            imageContainer.appendChild(imageName)  
            imageContainer.appendChild(removeBtn)  
            
            imageContainer.addEventListener('click', () => {
            document.querySelectorAll('.image-container').forEach(container => {
                container.classList.remove('selected')
            })
            imageContainer.classList.add('selected')
            })

            imageContainer.addEventListener('dblclick', () => {
                openComponentEditor(comp)
            })

            /* --- DRAG AND DROP EVENTS --- */
            if (comp.type !== 'options') {
                imageContainer.addEventListener('dragstart', (e) => {
                    if (!isHandleActive) {
                        e.preventDefault()
                        return
                    }
                    dragSourceIndex = index
                    e.dataTransfer.effectAllowed = 'move'
                    imageContainer.classList.add('dragging')
                })

                imageContainer.addEventListener('dragover', (e) => {
                    e.preventDefault() 
                    e.dataTransfer.dropEffect = 'move'
                    imageContainer.classList.add('over')
                    return false
                })

                imageContainer.addEventListener('dragenter', () => {
                    imageContainer.classList.add('over')
                })

                imageContainer.addEventListener('dragleave', () => {
                    imageContainer.classList.remove('over')
                })

                imageContainer.addEventListener('drop', (e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    
                    if (dragSourceIndex !== null && dragSourceIndex !== index) {
                        const item = sceneComponents.value.splice(dragSourceIndex, 1)[0]
                        sceneComponents.value.splice(index, 0, item)
                        
                        const optIdx = sceneComponents.value.findIndex(c => c.type === 'options');
                        if (optIdx !== -1 && optIdx !== sceneComponents.value.length - 1) {
                             const opt = sceneComponents.value.splice(optIdx, 1)[0];
                             sceneComponents.value.push(opt);
                        }
                        
                        updateSceneContentDisplay()
                        drawComponents()
                    }
                    return false
                })

                imageContainer.addEventListener('dragend', () => {
                    isHandleActive = false
                    dragSourceIndex = null
                    document.querySelectorAll('.image-container').forEach(el => {
                        el.classList.remove('over')
                        el.classList.remove('dragging')
                    })
                })
            }
            
            contentBody.appendChild(imageContainer)
        })
        } else {
        contentBody.innerHTML = '<div class="empty-content">No content added yet. Click "+ Add" to add content.</div>'
        }
    }
  })
}

const confirmRemoveComponent = (index) => {
  if (confirm('Are you sure you want to delete this component?')) {
    removeComponent(index)
  }
}

const removeComponent = (index) => {
  if (activeComponent.value && sceneComponents.value[index].id === activeComponent.value.id) {
    closeComponentEditor()
  }
  
  const wasOptions = sceneComponents.value[index].type === 'options'
  sceneComponents.value.splice(index, 1)
  
  if (wasOptions) {
      updateNodeOptionsInStatus()
  }

  updateSceneContentDisplay()
  drawComponents()
}

/* ================= GRAPH INTERACTION ================= */
const onGraphMouseDown = (event) => {
  if (!imagesCanvasRef.value) return
  
  const rect = imagesCanvasRef.value.getBoundingClientRect()
  const mouseX = event.clientX
  const mouseY = event.clientY
  
  if (mouseX >= rect.left && mouseX <= rect.right && 
      mouseY >= rect.top && mouseY <= rect.bottom) {
    
    const coords = screenToGraphCoords(mouseX, mouseY)
    
    let clickedComp = null
    for (let i = sceneComponents.value.length - 1; i >= 0; i--) {
      const comp = sceneComponents.value[i]
      const halfW = comp.width / 2
      const halfH = comp.height / 2
      const left = comp.x - halfW
      const right = comp.x + halfW
      const top = comp.y + halfH 
      const bottom = comp.y - halfH
      
      if (coords.x >= left && coords.x <= right &&
          coords.y <= top && coords.y >= bottom) {
        
        clickedComp = comp
        
        if (comp.type === 'options' && comp.optionsList) {
             const dx = coords.x - comp.x;
             const dy = coords.y - comp.y;
             const rad = -(comp.rotation || 0) * Math.PI / 180;
             const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
             const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
             
             const btnHeight = 40;
             const btnGap = 10;
             const totalHeight = (comp.optionsList.length * btnHeight) + ((comp.optionsList.length - 1) * btnGap);
             const startY = - (totalHeight / 2);
             
             for (let j = 0; j < comp.optionsList.length; j++) {
                const btnY = startY + (j * (btnHeight + btnGap));
                if (localX >= -(comp.width/2 - 20) && localX <= (comp.width/2 - 20) &&
                    localY >= btnY && localY <= btnY + btnHeight) {
                    
                    comp._clickedOptionIndex = j;
                    drawComponents();
                    setTimeout(() => { comp._clickedOptionIndex = -1; drawComponents(); }, 150);
                }
             }
        }

        isDraggingComponent.value = true
        draggingComponentIndex.value = i
        dragComponentOffset.value = {
          x: coords.x - comp.x,
          y: coords.y - comp.y
        }
        
        if (viewMode.value === 'componentEditor') {
            activeComponent.value = clickedComp
            textSelection.value = { start: 0, end: 0, text: '' }
            if (activeComponent.value.type === 'options') {
                activeStyleState.value = 'normal';
            }
        }

        drawComponents()
        
        setTimeout(() => {
          const containers = document.querySelectorAll('.image-container')
          containers.forEach((container, idx) => {
            container.classList.remove('selected')
            if (idx === draggingComponentIndex.value) {
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
  
  if (mouseX >= rect.left && mouseX <= rect.right && 
      mouseY >= rect.top && mouseY <= rect.bottom) {
    
    const coords = screenToGraphCoords(mouseX, mouseY)
    let needsRedraw = false;
    
    sceneComponents.value.forEach(comp => {
        if (comp.type === 'options') {
             const dx = coords.x - comp.x;
             const dy = coords.y - comp.y;
             const rad = -(comp.rotation || 0) * Math.PI / 180;
             const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
             const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
             
             if (Math.abs(localX) <= comp.width/2 && Math.abs(localY) <= comp.height/2) {
                 const btnHeight = 40;
                 const btnGap = 10;
                 const totalHeight = (comp.optionsList.length * btnHeight) + ((comp.optionsList.length - 1) * btnGap);
                 const startY = - (totalHeight / 2);
                 let foundHover = -1;
                 
                 for (let j = 0; j < comp.optionsList.length; j++) {
                    const btnY = startY + (j * (btnHeight + btnGap));
                    if (localX >= -(comp.width/2 - 20) && localX <= (comp.width/2 - 20) &&
                        localY >= btnY && localY <= btnY + btnHeight) {
                        foundHover = j;
                        break;
                    }
                 }
                 
                 if (comp._hoveredOptionIndex !== foundHover) {
                     comp._hoveredOptionIndex = foundHover;
                     needsRedraw = true;
                 }
             } else {
                 if (comp._hoveredOptionIndex !== -1) {
                     comp._hoveredOptionIndex = -1;
                     needsRedraw = true;
                 }
             }
        }
    });

    if (needsRedraw) drawComponents();

    if (isDraggingComponent.value && draggingComponentIndex.value !== null) {
      const comp = sceneComponents.value[draggingComponentIndex.value]
      comp.x = coords.x - dragComponentOffset.value.x
      comp.y = coords.y - dragComponentOffset.value.y
      
      drawComponents()
    }
  }
}

const onGraphMouseUp = () => {
  if (isDraggingComponent.value) {
    isDraggingComponent.value = false
    draggingComponentIndex.value = null
    drawComponents()
  }
}

/* ================= COMPONENT EDITOR LOGIC ================= */
const openComponentEditor = (comp) => {
    activeComponent.value = comp
    viewMode.value = 'componentEditor'
    textSelection.value = { start: 0, end: 0, text: '' } 
    if (comp.type === 'options') {
        activeStyleState.value = 'normal';
    }
    drawComponents() 
}

const closeComponentEditor = () => {
    activeComponent.value = null
    viewMode.value = 'sceneDetails'
    drawComponents() 
    
    nextTick(() => {
        updateSceneContentDisplay() 
    })
}

// TOGGLE RENDER MODE
const updateRenderMode = (mode) => {
    if (!activeComponent.value) return;
    
    if (mode === 'auto') {
        if (activeComponent.value.autoRender) {
             activeComponent.value.autoRender = false;
             activeComponent.value.renderWhileClicked = true;
        } else {
             activeComponent.value.autoRender = true;
             activeComponent.value.renderWhileClicked = false;
        }
    } else {
        if (activeComponent.value.renderWhileClicked) {
            activeComponent.value.renderWhileClicked = false;
            activeComponent.value.autoRender = true;
        } else {
            activeComponent.value.renderWhileClicked = true;
            activeComponent.value.autoRender = false;
        }
    }
}

const updateActiveComponentPosition = () => {
    if (activeComponent.value) {
        drawComponents()
    }
}

const updateActiveComponentSize = () => {
    if (activeComponent.value) {
        if (activeComponent.value.type === 'image' || activeComponent.value.type === 'video') {
             const ratio = activeComponent.value.aspectRatio || 1
             activeComponent.value.height = activeComponent.value.width / ratio
        }
        drawComponents()
    }
}

const changeLayer = (action) => {
    if (!activeComponent.value) return
    
    const idx = sceneComponents.value.findIndex(c => c.id === activeComponent.value.id)
    if (idx === -1) return

    const arr = sceneComponents.value
    const hasOptions = arr.some(c => c.type === 'options');
    const isOptions = activeComponent.value.type === 'options';

    if (isOptions) {
        return;
    }
    
    const lastIndex = arr.length - 1;
    const maxIndex = hasOptions ? lastIndex - 1 : lastIndex; 

    if (action === 'up') {
        if (idx < maxIndex) {
            const temp = arr[idx]
            arr[idx] = arr[idx + 1]
            arr[idx + 1] = temp
        }
    } else if (action === 'down') {
        if (idx > 0) {
            const temp = arr[idx]
            arr[idx] = arr[idx - 1]
            arr[idx - 1] = temp
        }
    } else if (action === 'top') {
        const [item] = arr.splice(idx, 1)
        if (hasOptions) {
             const insertPos = arr.findIndex(c => c.type === 'options');
             arr.splice(insertPos, 0, item);
        } else {
             arr.push(item);
        }
    } else if (action === 'bottom') {
        const [item] = arr.splice(idx, 1)
        arr.unshift(item)
    }
    
    drawComponents()
    updateSceneContentDisplay() 
}

/* ================= NODE & POPUP RENAME LOGIC ================= */
const updateNodeName = () => {
  if (!popupNode.value) return
  
  const status = Canvas_Status.value.find(s => s.index === popupNode.value.id)
  
  if (status) {
    status.Node_name = editingNodeName.value
    draw()
  }
}

const openPopup = node => {
  popupNode.value = node
  viewMode.value = 'scenes'
  selectedScene.value = null
  sceneComponents.value = [] 
  sceneSettings.value.backgroundColor = '#000000' 
  activeComponent.value = null 
  
  const nodeStatus = Canvas_Status.value.find(s => s.index === node.id)
  if (nodeStatus) {
    if (!nodeStatus.Node_name) {
      nodeStatus.Node_name = `Node ${node.id}`
    }
    editingNodeName.value = nodeStatus.Node_name

    // Load Scenes
    if (nodeStatus.scenes) {
      nodeScenes.value = [...nodeStatus.scenes]
      nodeScenes.value.forEach((scene, index) => {
        if (!scene.name) scene.name = `Scene ${scene.id}`
        if (!scene.backgroundColor) scene.backgroundColor = '#000000'
      })
    } else {
      nodeScenes.value = []
    }

    // Load Audio
    if (nodeStatus.audio) {
        sequenceAudio.value = nodeStatus.audio
    } else {
        sequenceAudio.value = null
    }

  } else {
    editingNodeName.value = `Node ${node.id}`
    nodeScenes.value = []
    sequenceAudio.value = null
  }
  
  showPopup.value = true
  nextTick(() => {
    popupAnimation.value = true
    setTimeout(initializeGraphCanvas, 50)
  })
}

// Animation Loop
const startRenderLoop = () => {
  const loop = () => {
    if (showPopup.value) {
        drawComponents()
    }
    if (isPreviewMode.value) {
        drawPreview()
        checkAudioDucking() 
    }
    animationFrameId = requestAnimationFrame(loop)
  }
  loop()
}

const closePopup = () => {
  if (selectedScene.value) {
    updateSceneDetails()
  }
  
  stopEditorVideos()
  updateNodeOptionsInStatus()

  popupAnimation.value = false
  isDraggingComponent.value = false
  draggingComponentIndex.value = null
  activeComponent.value = null
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  
  setTimeout(() => {
    showPopup.value = false
    popupNode.value = null
    nodeScenes.value = []
    hoveredSceneId.value = null
    selectedScene.value = null
    sceneComponents.value = []
    viewMode.value = 'scenes'
    editingNodeName.value = "" 
    sequenceAudio.value = null 
  }, 300) 
}

/* ================= BACKGROUND COLOR FUNCTIONS ================= */
const updateBackgroundColor = () => {
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
  
  if (selectedScene.value) {
    drawGraph()
    startRenderLoop() 
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

    if (popupNode.value) {
        const status = Canvas_Status.value.find(s => s.index === popupNode.value.id)
        if (status) {
            status.referenceWidth = rect.width
            status.referenceHeight = rect.height
        }
    }
    
    if (selectedScene.value) {
      drawGraph()
      drawComponents()
    }
  }
}

const screenToGraphCoords = (screenX, screenY) => {
  if (!graphCanvasRef.value) return { x: 0, y: 0 }
  
  const canvas = graphCanvasRef.value
  const rect = canvas.getBoundingClientRect()
  
  const canvasX = screenX - rect.left
  const canvasY = screenY - rect.top
  
  const centerX = canvas.width / 2
  const centerY = canvas.height / 2
  
  const pixelsPerUnit = 2
  const graphX = (canvasX - centerX) / pixelsPerUnit
  const graphY = (centerY - canvasY) / pixelsPerUnit  
  
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
  const screenY = centerY - (graphY * pixelsPerUnit) 
  
  return { x: screenX, y: screenY }
}

const drawGraph = () => {
  if (!graphCtx || !graphCanvasRef.value || !selectedScene.value) return
  
  const canvas = graphCanvasRef.value
  const ctx = graphCtx
  
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  const centerX = canvas.width / 2
  const centerY = canvas.height / 2
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.lineWidth = 1
  drawGridLines(ctx, canvas, centerX, centerY, GRAPH_MINOR_GRID, 10) 
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 1.5
  drawGridLines(ctx, canvas, centerX, centerY, GRAPH_MAJOR_GRID, 10) 
  
  ctx.strokeStyle = '#00ff88'
  ctx.lineWidth = 2
  
  ctx.beginPath()
  ctx.moveTo(centerX, 0)
  ctx.lineTo(centerX, canvas.height)
  ctx.stroke()
  
  ctx.beginPath()
  ctx.moveTo(0, centerY)
  ctx.lineTo(canvas.width, centerY)
  ctx.stroke()
  
  ctx.fillStyle = '#00ff88'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  for (let x = -GRAPH_MAX_X; x <= GRAPH_MAX_X; x += GRAPH_MAJOR_GRID) {
    if (x === 0) continue 
    const screenX = centerX + (x * 2) 
    if (screenX >= 20 && screenX <= canvas.width - 20) {
      ctx.fillText(x.toString(), screenX, centerY + 15)
      ctx.beginPath()
      ctx.moveTo(screenX, centerY - 5)
      ctx.lineTo(screenX, centerY + 5)
      ctx.stroke()
    }
  }
  
  for (let y = -GRAPH_MAX_Y; y <= GRAPH_MAX_Y; y += GRAPH_MAJOR_GRID) {
    if (y === 0) continue 
    const screenY = centerY - (y * 2) 
    if (screenY >= 20 && screenY <= canvas.height - 20) {
      ctx.fillText(y.toString(), centerX - 15, screenY)
      ctx.beginPath()
      ctx.moveTo(centerX - 5, screenY)
      ctx.lineTo(centerX + 5, screenY)
      ctx.stroke()
    }
  }
  
  ctx.fillText('0', centerX - 12, centerY + 12)
  
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
  
  ctx.fillStyle = 'rgba(255, 0, 0, 0.7)'
  ctx.font = '10px sans-serif'
  
  const minXScreen = centerX + (GRAPH_MIN_X * 2)
  const maxYScreen = centerY - (GRAPH_MAX_Y * 2)
  ctx.fillText(`(${GRAPH_MIN_X}, ${GRAPH_MAX_Y})`, minXScreen + 40, maxYScreen + 15)
  
  const maxXScreen = centerX + (GRAPH_MAX_X * 2)
  const minYScreen = centerY - (GRAPH_MIN_Y * 2)
  ctx.fillText(`(${GRAPH_MAX_X}, ${GRAPH_MIN_Y})`, maxXScreen - 40, minYScreen - 10)
}

const drawGridLines = (ctx, canvas, centerX, centerY, gridSize, pixelsPerUnit) => {
  const unitSize = gridSize * pixelsPerUnit
  
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

const drawComponents = () => {
  if (!imagesCtx || !imagesCanvasRef.value || !selectedScene.value) return
  
  const ctx = imagesCtx
  const canvas = imagesCanvasRef.value
  
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  if (sceneComponents.value.length === 0) return
  
  sceneComponents.value.forEach((comp, index) => {
    const screenPos = graphToScreenCoords(comp.x, comp.y)
    
    ctx.save()
    ctx.translate(screenPos.x, screenPos.y)
    ctx.rotate( (comp.rotation || 0) * Math.PI / 180)
    ctx.translate(-screenPos.x, -screenPos.y)

    renderComponent(ctx, comp, screenPos) 

    ctx.restore() 
    drawFocusRing(ctx, comp, index, screenPos)
  })
}

// Updated renderComponent to handle Animation Overrides (like Typewriter text truncation)
const renderComponent = (ctx, comp, screenPos, animationOverride = null) => {
    if (comp.type === 'image') {
        if (comp.imgObject) {
            ctx.drawImage(
                comp.imgObject,
                screenPos.x - (comp.width / 2),
                screenPos.y - (comp.height / 2),
                comp.width,
                comp.height
            )
        } else {
            const img = new Image()
            img.src = comp.url
            comp.imgObject = img
        }
    } else if (comp.type === 'video') {
         if (comp.videoElement) {
             ctx.drawImage(
                comp.videoElement,
                screenPos.x - (comp.width / 2),
                screenPos.y - (comp.height / 2),
                comp.width,
                comp.height
             )
         }
    } else if (comp.type === 'text') {
        ctx.translate(screenPos.x, screenPos.y) 
        
        if (comp.backgroundColor && comp.backgroundColor !== 'transparent') {
            ctx.fillStyle = comp.backgroundColor
            if (comp.borderRadius > 0) {
               drawRoundedRectPaths(ctx, -(comp.width/2), -(comp.height/2), comp.width, comp.height, comp.borderRadius)
               ctx.fill()
            } else {
               ctx.fillRect(-(comp.width/2), -(comp.height/2), comp.width, comp.height)
            }
        }
        
        if (comp.borderWidth > 0 && comp.borderColor !== 'transparent') {
            ctx.strokeStyle = comp.borderColor
            ctx.lineWidth = comp.borderWidth
            if (comp.borderRadius > 0) {
               drawRoundedRectPaths(ctx, -(comp.width/2), -(comp.height/2), comp.width, comp.height, comp.borderRadius)
               ctx.stroke()
            } else {
               ctx.strokeRect(-(comp.width/2), -(comp.height/2), comp.width, comp.height)
            }
        }
        
        const fontWeight = comp.fontWeight || 'normal'
        const fontStyle = comp.fontStyle || 'normal'
        const fontFamily = comp.fontFamily || 'sans-serif'
        ctx.font = `${fontStyle} ${fontWeight} ${comp.fontSize}px ${fontFamily}`
        ctx.fillStyle = comp.color
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        
        // --- ANIMATION TYPEWRITER LOGIC ---
        let contentToDraw = comp.content
        if (animationOverride && animationOverride.type === 'typewriter') {
            const progress = animationOverride.progress // 0 to 1
            const length = Math.floor(comp.content.length * progress)
            contentToDraw = comp.content.substring(0, length)
        }
        
        ctx.fillText(contentToDraw, 0, 0)
        
        // Decorations (Underline/Strikethrough)
        // Note: Just drawing for full width to simplify, or could scale width by text measure
        if (comp.textDecoration === 'underline' || comp.textDecoration === 'line-through') {
             const metrics = ctx.measureText(contentToDraw)
             const width = metrics.width
             ctx.beginPath()
             ctx.strokeStyle = comp.textDecorationColor || comp.color
             ctx.lineWidth = comp.fontSize / 15
             
             const yOffset = comp.textDecoration === 'underline' ? comp.fontSize/2 : 0
             ctx.moveTo(-width/2, yOffset)
             ctx.lineTo(width/2, yOffset)
             ctx.stroke()
        }
        
        ctx.translate(-screenPos.x, -screenPos.y)
    } else if (comp.type === 'options') {
        ctx.translate(screenPos.x, screenPos.y) 
        
        ctx.fillStyle = 'rgba(31, 41, 55, 0.3)'; 
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#f87171'; 
        ctx.lineWidth = 1;
        drawRoundedRectPaths(ctx, -(comp.width/2), -(comp.height/2), comp.width, comp.height, 8);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]); 
        
        if (comp.optionsList && comp.optionsList.length > 0) {
            const btnHeight = 40;
            const btnGap = 10;
            const totalContentHeight = (comp.optionsList.length * btnHeight) + ((comp.optionsList.length - 1) * btnGap);
            const startY = - (totalContentHeight / 2);
            
            const btnWidth = comp.width - 40;
            
            comp.optionsList.forEach((option, index) => {
                const yPos = startY + (index * (btnHeight + btnGap));
                
                let style = comp.styles.normal;
                if (comp._clickedOptionIndex === index) {
                    style = comp.styles.clicked;
                } else if (comp._hoveredOptionIndex === index) {
                    style = comp.styles.hovered;
                }
                
                if (style.backgroundColor && style.backgroundColor !== 'transparent') {
                    ctx.fillStyle = style.backgroundColor;
                    drawRoundedRectPaths(ctx, -(btnWidth/2), yPos, btnWidth, btnHeight, style.borderRadius);
                    ctx.fill();
                }
                
                if (style.borderWidth > 0 && style.borderColor && style.borderColor !== 'transparent') {
                    ctx.strokeStyle = style.borderColor;
                    ctx.lineWidth = style.borderWidth;
                    drawRoundedRectPaths(ctx, -(btnWidth/2), yPos, btnWidth, btnHeight, style.borderRadius);
                    ctx.stroke();
                }
                
                ctx.fillStyle = style.color;
                ctx.font = `${style.fontSize}px ${style.fontFamily || 'sans-serif'}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(option.text, 0, yPos + (btnHeight/2));
            });
        }
        
        ctx.translate(-screenPos.x, -screenPos.y)
    }
}

const drawRoundedRectPaths = (ctx, x, y, w, h, r) => {
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

const drawFocusRing = (ctx, comp, index, screenPos) => {
      const isActive = (activeComponent.value && activeComponent.value.id === comp.id)
      const isDragging = (isDraggingComponent.value && draggingComponentIndex.value === index)

      if (isActive || isDragging) {
        ctx.save()
        ctx.translate(screenPos.x, screenPos.y)
        ctx.rotate( (comp.rotation || 0) * Math.PI / 180)
        
        ctx.strokeStyle = '#00ff88'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 3])
        ctx.strokeRect(
          -(comp.width / 2) - 4,
          -(comp.height / 2) - 4,
          comp.width + 8,
          comp.height + 8
        )
        ctx.restore()
      }
}

/* ================= SCENE FUNCTIONS ================= */
const addScene = () => {
  if (!popupNode.value) return
  
  if (nodeScenes.value.length > 0) {
      const lastScene = nodeScenes.value[nodeScenes.value.length - 1];
      if (lastScene.components && lastScene.components.some(c => c.type === 'options')) {
          alert("Cannot add more scenes. The final scene contains an Options component.");
          return;
      }
  }
  
  const newSceneId = nodeScenes.value.length + 1
  const newScene = {
    id: newSceneId,
    name: `Scene ${newSceneId}`,
    backgroundColor: '#000000' 
  }
  
  nodeScenes.value.push(newScene)
  updateNodeScenesInStatus()
  selectScene(newScene)
}

const deleteScene = (sceneId) => {
  if (selectedScene.value && selectedScene.value.id === sceneId) {
    viewMode.value = 'scenes'
    selectedScene.value = null
  }
  
  nodeScenes.value = nodeScenes.value.filter(scene => scene.id !== sceneId)
  
  nodeScenes.value.forEach((scene, index) => {
    scene.id = index + 1
    if (!scene.name || scene.name.startsWith('Scene ')) {
      scene.name = `Scene ${index + 1}`
    }
  })
  
  updateNodeScenesInStatus()
}

const stopEditorVideos = () => {
    sceneComponents.value.forEach(comp => {
        if (comp.type === 'video' && comp.videoElement) {
            comp.videoElement.pause();
        }
    })
}

const selectScene = (scene) => {
  selectedScene.value = { ...scene }
  viewMode.value = 'sceneDetails'
  sceneComponents.value = [] 
  
  sceneSettings.value.backgroundColor = selectedScene.value.backgroundColor || '#000000'
  
  updateSceneContentDisplay()
  updateBackgroundColor()
  if (imagesCtx && imagesCanvasRef.value) {
    imagesCtx.clearRect(0, 0, imagesCanvasRef.value.width, imagesCanvasRef.value.height)
  }
  drawGraph()
  startRenderLoop() 
}

const saveSceneAndGoBack = () => {
  if (!selectedScene.value) return
  stopEditorVideos();
  updateNodeOptionsInStatus()
  updateSceneDetails()
  const sceneIndex = nodeScenes.value.findIndex(scene => scene.id === selectedScene.value.id)
  if (sceneIndex !== -1) {
    nodeScenes.value[sceneIndex].components = [...sceneComponents.value]
  }
  viewMode.value = 'scenes'
  selectedScene.value = null
  sceneComponents.value = []
  
  if (imagesCtx && imagesCanvasRef.value) {
    imagesCtx.clearRect(0, 0, imagesCanvasRef.value.width, imagesCanvasRef.value.height)
  }
}

const goBackToScenes = () => {
  if (selectedScene.value) {
    stopEditorVideos();
    updateNodeOptionsInStatus()
    updateSceneDetails()
    const sceneIndex = nodeScenes.value.findIndex(scene => scene.id === selectedScene.value.id)
    if (sceneIndex !== -1) {
      nodeScenes.value[sceneIndex].components = [...sceneComponents.value]
    }
  }
  viewMode.value = 'scenes'
  selectedScene.value = null
  sceneComponents.value = []
  if (imagesCtx && imagesCanvasRef.value) {
    imagesCtx.clearRect(0, 0, imagesCanvasRef.value.width, imagesCanvasRef.value.height)
  }
}

const updateSceneDetails = () => {
  if (!selectedScene.value) return
  const index = nodeScenes.value.findIndex(scene => scene.id === selectedScene.value.id)
  if (index !== -1) {
    nodeScenes.value[index] = { 
      ...selectedScene.value,
      backgroundColor: sceneSettings.value.backgroundColor
    }
    updateNodeScenesInStatus()
  }
}

const updateNodeScenesInStatus = () => {
  if (!popupNode.value) return
  const nodeStatusIndex = Canvas_Status.value.findIndex(s => s.index === popupNode.value.id)
  if (nodeStatusIndex !== -1) {
    Canvas_Status.value[nodeStatusIndex].scenes = nodeScenes.value.map(scene => ({
      id: scene.id,
      name: scene.name,
      backgroundColor: scene.backgroundColor || '#000000',
      components: scene.components || [] 
    }))
    Canvas_Status.value[nodeStatusIndex].audio = sequenceAudio.value
  } else {
    Canvas_Status.value.push({ 
      index: popupNode.value.id, 
      x: popupNode.value.x, 
      y: popupNode.value.y, 
      node_type: "General", 
      Next: null,
      scenes: nodeScenes.value.map(scene => ({
        id: scene.id,
        name: scene.name,
        backgroundColor: scene.backgroundColor || '#000000',
        components: scene.components || [] 
      })),
      audio: sequenceAudio.value,
      options: [],
      Node_name: `Node ${popupNode.value.id}` 
    })
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
  const status = Canvas_Status.value.find(s => s.index === n.id);
  const hasOptions = status && status.options && status.options.length > 0;

  if (hasOptions) {
      const options = status.options;
      const totalH = Math.max(NODE_H, HEADER_H + (options.length * OPTION_ROW_H) + 10);
      const startY = n.y - totalH / 2 + HEADER_H + 20;

      for (let i = 0; i < options.length; i++) {
          const optY = startY + (i * OPTION_ROW_H);
          const optX = n.x + NODE_W / 2 - ARROW_OFFSET; 
          
          if (Math.hypot(wx - optX, wy - optY) < ARROW_HIT_R) {
              return { 
                  node: n, 
                  side: "right", 
                  x: optX, 
                  y: optY,
                  optionIndex: i,
                  optionId: options[i].id
              }
          }
      }
      
      const leftAy = n.y - totalH / 2 + HEADER_H / 2
      const leftAx = n.x - NODE_W / 2 + ARROW_OFFSET
      if (Math.hypot(wx - leftAx, wy - leftAy) < ARROW_HIT_R) 
          return { node: n, side: "left", x: leftAx, y: leftAy }

  } else {
      const leftAy = n.y - NODE_H / 2 + HEADER_H / 2
      const leftAx = n.x - NODE_W / 2 + ARROW_OFFSET
      if (Math.hypot(wx - leftAx, wy - leftAy) < ARROW_HIT_R) return { node: n, side: "left", x: leftAx, y: leftAy }
  }
  
  return null
}

const getNodeAt = (wx, wy) =>
  nodes.value.find(
    n => {
       const status = Canvas_Status.value.find(s => s.index === n.id);
       const h = (status && status.options && status.options.length > 0) 
           ? Math.max(NODE_H, HEADER_H + (status.options.length * OPTION_ROW_H) + 10) 
           : NODE_H;
       
       return wx >= n.x - NODE_W / 2 &&
              wx <= n.x + NODE_W / 2 &&
              wy >= n.y - h / 2 &&
              wy <= n.y + h / 2
    }
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

const drawNodes = () => {
  for (const n of nodes.value) {
    const x = n.x
    const y = n.y
    const status = Canvas_Status.value.find(s => s.index === n.id)
    
    const hasOptions = status && status.options && status.options.length > 0;
    const currentH = hasOptions 
        ? Math.max(NODE_H, HEADER_H + (status.options.length * OPTION_ROW_H) + 10) 
        : NODE_H;

    if (n.id === selectedNodeId.value) {
      ctx.strokeStyle = "#fff"
      ctx.lineWidth = 3 / scale
      drawRoundedRect(x - NODE_W / 2 - 4, y - currentH / 2 - 4, NODE_W + 8, currentH + 8, NODE_RADIUS + 2)
      ctx.stroke()
    }

    ctx.fillStyle = "#5f6f82"
    drawRoundedRect(x - NODE_W / 2, y - currentH / 2, NODE_W, currentH, NODE_RADIUS)
    ctx.fill()

    const grad = ctx.createLinearGradient(x - NODE_W / 2, y - currentH / 2, x + NODE_W / 2, y - currentH / 2)
    grad.addColorStop(0, "#ff2a2a")
    grad.addColorStop(1, "#000")
    ctx.fillStyle = grad
    drawRoundedRect(x - NODE_W / 2, y - currentH / 2, NODE_W, HEADER_H, NODE_RADIUS)
    ctx.fill()

    ctx.strokeStyle = "#cbd5e1"
    ctx.lineWidth = 2
    drawRoundedRect(x - NODE_W / 2, y - currentH / 2, NODE_W, currentH, NODE_RADIUS)
    ctx.stroke()

    ctx.fillStyle = "#fff"
    ctx.font = "13px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    
    let label = status ? (status.Node_name || `Node ${n.id}`) : "General Node"
    const maxWidth = NODE_W - 30 
    
    if (ctx.measureText(label).width > maxWidth) {
      while (ctx.measureText(label + "...").width > maxWidth && label.length > 0) {
        label = label.slice(0, -1)
      }
      label += "..."
    }
    
    ctx.fillText(label, x, y - currentH / 2 + HEADER_H / 2)

    const leftAy = y - currentH / 2 + HEADER_H / 2
    const leftAx = x - NODE_W / 2 + ARROW_OFFSET
    
    ctx.fillStyle = "#fff"
    ctx.font = "16px sans-serif"
    ctx.fillText("▷", leftAx, leftAy)

    if (hasOptions) {
        const startY = y - currentH / 2 + HEADER_H + 20;
        
        status.options.forEach((opt, idx) => {
             const optY = startY + (idx * OPTION_ROW_H);
             const optX = x + NODE_W / 2 - ARROW_OFFSET;

             if (hoveredArrow?.node === n && hoveredArrow.optionIndex === idx) {
                 ctx.beginPath()
                 ctx.arc(optX, optY, 9, 0, Math.PI * 2)
                 ctx.strokeStyle = "#fff"
                 ctx.lineWidth = 2 / scale
                 ctx.stroke()
             }
             
             ctx.font = "16px sans-serif" 
             ctx.fillStyle = "#fff"
             ctx.textAlign = "center"
             ctx.fillText("▷", optX, optY)
             
             ctx.textAlign = "right"
             ctx.font = "11px sans-serif"
             ctx.fillStyle = "#e2e8f0"
             
             let optLabel = opt.text || `Option ${idx+1}`
             if (ctx.measureText(optLabel).width > NODE_W - 50) {
                  optLabel = optLabel.substring(0, 15) + "..."
             }
             ctx.fillText(optLabel, optX - 15, optY)
        });
    } 
  }
}

const drawConnections = () => {
  ctx.strokeStyle = "#fff"
  ctx.lineWidth = 4 / scale
  for (const n of Canvas_Status.value) {
      
    if (n.options && n.options.length > 0) {
        const fromNode = nodes.value.find(nd => nd.id === n.index)
        if (fromNode) {
            const h = Math.max(NODE_H, HEADER_H + (n.options.length * OPTION_ROW_H) + 10);
            const startY = fromNode.y - h / 2 + HEADER_H + 20;

            n.options.forEach((opt, idx) => {
                if (opt.next) {
                    const toNode = nodes.value.find(nd => nd.id === opt.next)
                    if (toNode) {
                        const fromX = fromNode.x + NODE_W / 2 - ARROW_OFFSET
                        const fromY = startY + (idx * OPTION_ROW_H)
                        
                        const targetStatus = Canvas_Status.value.find(s => s.index === toNode.id)
                        const targetH = (targetStatus && targetStatus.options && targetStatus.options.length > 0) 
                             ? Math.max(NODE_H, HEADER_H + (targetStatus.options.length * OPTION_ROW_H) + 10) 
                             : NODE_H;
                        
                        const toX = toNode.x - NODE_W / 2 + ARROW_OFFSET
                        const toY = toNode.y - targetH / 2 + HEADER_H / 2
                        
                        ctx.beginPath()
                        ctx.moveTo(fromX, fromY)
                        ctx.lineTo(toX, toY)
                        ctx.stroke()
                    }
                }
            })
        }
    } 
    else if (n.Next != null) {
      const fromNode = nodes.value.find(nd => nd.id === n.index)
      const toNode = nodes.value.find(nd => nd.id === n.Next)
      if (fromNode && toNode) {
        const fromX = fromNode.x + NODE_W / 2 - ARROW_OFFSET
        const fromY = fromNode.y + HEADER_H / 2
        
        const targetStatus = Canvas_Status.value.find(s => s.index === toNode.id)
        const targetH = (targetStatus && targetStatus.options && targetStatus.options.length > 0) 
                ? Math.max(NODE_H, HEADER_H + (targetStatus.options.length * OPTION_ROW_H) + 10) 
                : NODE_H;

        const toX = toNode.x - NODE_W / 2 + ARROW_OFFSET
        const toY = toNode.y - targetH / 2 + HEADER_H / 2

        ctx.beginPath()
        ctx.moveTo(fromX, fromY)
        ctx.lineTo(toX, toY)
        ctx.stroke()
      }
    }
  }
}

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
      outputDragging = { 
          node: n, 
          fromX: hit.x, 
          fromY: hit.y,
          optionIndex: hit.optionIndex, 
          optionId: hit.optionId 
      }
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
      if (cs) {
          if (outputDragging.optionIndex !== undefined && cs.options) {
               if (cs.options[outputDragging.optionIndex]) {
                   cs.options[outputDragging.optionIndex].next = targetNode.id
               }
          } else {
               cs.Next = targetNode.id
          }
      }
    }
    connectingLine = null
    outputDragging = null
  }

  if (menuDragging) {
    const id = nodes.value.length
    const x = mouseWorld.x
    const y = mouseWorld.y
    nodes.value.push({ id, x, y })
    Canvas_Status.value.push({ 
      index: id, 
      x, 
      y, 
      node_type: "General", 
      Next: null, 
      scenes: [],
      audio: null,
      options: [],
      Node_name: `Node ${id}` 
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

let statusLogInterval = null;

onMounted(() => {
  ctx = canvasRef.value.getContext("2d")
  resize()
  window.addEventListener("resize", resize)
  window.addEventListener("mousemove", onMouseMove)
  window.addEventListener("mouseup", onMouseUp)
  document.addEventListener('fullscreenchange', handleFullscreenChange)

  statusLogInterval = setInterval(() => {
      Canvas_Status.value.forEach(nodeStatus => {
          let log = `Node ${nodeStatus.Node_name || nodeStatus.index} has got ${nodeStatus.scenes ? nodeStatus.scenes.length : 0} no of scenes...`;

          if (nodeStatus.scenes) {
             const sceneWithOpt = nodeStatus.scenes.find(s => s.components && s.components.some(c => c.type === 'options'));
             if (sceneWithOpt) {
                 if (nodeStatus.options && nodeStatus.options.length > 0) {
                     log += ` in scene ${sceneWithOpt.name} there is a option component...with ${nodeStatus.options.length} options...`;
                     nodeStatus.options.forEach(opt => {
                         let connectedNodeName = "Not connected yet";
                         if (opt.next) {
                             const target = Canvas_Status.value.find(s => s.index === opt.next);
                             if (target) connectedNodeName = target.Node_name || `Node ${target.index}`;
                         }
                         log += ` option '${opt.text}' is connected to ${connectedNodeName},`;
                     });
                 }
             }
          }
          console.log(log);
      });
  }, 20000);
})

onBeforeUnmount(() => {
  window.removeEventListener("resize", resize)
  window.removeEventListener("mousemove", onMouseMove)
  window.removeEventListener("mouseup", onMouseUp)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  
  if (statusLogInterval) clearInterval(statusLogInterval);
})

watch(showPopup, (newVal) => {
  if (newVal) {
    nextTick(() => {
      setTimeout(initializeGraphCanvas, 100)
    })
  }
})

/* ================= PREVIEW LOGIC ================= */
const startPreview = () => {
    if (nodeScenes.value.length === 0) {
        alert("No scenes to preview!")
        return
    }

    stopAllVideos();

    isPreviewMode.value = true
    currentPreviewSceneIndex.value = 0
    currentPreviewComponentIndex.value = -1 
    
    // Reset timer logic for first component interaction if needed
    componentStartTime.value = 0; 
    
    if (sequenceAudio.value && sequenceAudio.value.url) {
        previewAudioElement.value = new Audio(sequenceAudio.value.url)
        previewAudioElement.value.volume = sequenceAudio.value.volume || 1.0 
        previewAudioElement.value.loop = (sequenceAudio.value.loop !== false) 
        previewAudioElement.value.play().catch(e => console.log("Autoplay prevented:", e))
    }

    const previewContainer = document.querySelector('.preview-overlay')
    if (previewContainer && previewContainer.requestFullscreen) {
        previewContainer.requestFullscreen()
    }
    
    nextTick(() => {
        initializePreviewCanvas()
    })
}

const initializePreviewCanvas = () => {
    if (!previewCanvasRef.value) return
    previewCtx = previewCanvasRef.value.getContext('2d')
    resizePreviewCanvas()
    drawPreview()
}

const resizePreviewCanvas = () => {
    if (previewCanvasRef.value) {
        let refW = 0, refH = 0;
        if (popupNode.value) {
             const status = Canvas_Status.value.find(s => s.index === popupNode.value.id)
             if (status && status.referenceWidth && status.referenceHeight) {
                 refW = status.referenceWidth;
                 refH = status.referenceHeight;
             }
        }
        if (!refW || !refH) {
             refW = window.innerWidth * 0.75;
             refH = window.innerHeight - 48;
        }

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        const scaleW = screenWidth / refW;
        const scaleH = screenHeight / refH;
        const k = Math.min(scaleW, scaleH);
        
        previewScale.value = k; 

        const canvasWidth = refW * k;
        const canvasHeight = refH * k;

        previewCanvasRef.value.width = canvasWidth;
        previewCanvasRef.value.height = canvasHeight;
        
        previewCanvasRef.value.style.width = `${canvasWidth}px`;
        previewCanvasRef.value.style.height = `${canvasHeight}px`;
    }
}

const stopVideosInScene = (scene) => {
    if (!scene || !scene.components) return;
    scene.components.forEach(comp => {
        if (comp.type === 'video' && comp.videoElement) {
            comp.videoElement.pause();
            comp.videoElement.currentTime = 0; 
            comp.videoElement.onended = null;
        }
    })
}

const stopAllVideos = () => {
    nodeScenes.value.forEach(scene => stopVideosInScene(scene));
}

const advancePreview = () => {
    const currentScene = nodeScenes.value[currentPreviewSceneIndex.value]
    const components = currentScene.components || []

    // --- CLICK TO SKIP ANIMATION CHECK ---
    // If there is an active component (index >= 0) and it is animating
    if (currentPreviewComponentIndex.value >= 0 && currentPreviewComponentIndex.value < components.length) {
        const currentComp = components[currentPreviewComponentIndex.value]
        
        // Calculate current progress
        const now = Date.now()
        const duration = (currentComp.animationDuration || 1) * 1000
        const elapsed = now - componentStartTime.value
        
        // If animation is still running (and duration > 0)
        if (elapsed < duration && currentComp.animationType !== 'none') {
            // Force animation end: set start time to the past
            componentStartTime.value = now - duration - 100 
            // Do NOT advance index
            return
        }
    }

    if (currentPreviewComponentIndex.value < components.length - 1) {
        
        currentPreviewComponentIndex.value++
        
        // Set Start Time for Animation
        componentStartTime.value = Date.now()
        
        const comp = components[currentPreviewComponentIndex.value]
        
        if (comp.type === 'video' && comp.videoElement) {
             comp.videoElement.currentTime = 0;
             comp.videoElement.play().catch(e => console.error("Auto-play prevented", e));
             
             const subsequentComp = components[currentPreviewComponentIndex.value + 1];
             if (subsequentComp && subsequentComp.autoRender) {
                 comp.videoElement.onended = () => {
                     advancePreview(); 
                 };
             } else {
                 comp.videoElement.onended = null;
             }
        } 
        else {
             const subsequentComp = components[currentPreviewComponentIndex.value + 1];
             if (subsequentComp && subsequentComp.autoRender) {
                 // For static items, wait for animation to finish then advance
                 const animDuration = (comp.animationDuration || 1) * 1000
                 setTimeout(() => {
                     advancePreview();
                 }, animDuration + 50); 
             }
        }

    } else {
        if (currentPreviewSceneIndex.value < nodeScenes.value.length - 1) {
            stopVideosInScene(currentScene);
            currentPreviewSceneIndex.value++
            currentPreviewComponentIndex.value = -1 
        } else {
            exitPreview()
            return
        }
    }
    drawPreview()
    checkAudioDucking() 
}

const checkAudioDucking = () => {
    if (!previewAudioElement.value || !sequenceAudio.value) return;

    const baseVolume = sequenceAudio.value.volume || 1.0;
    let targetVolume = baseVolume;

    const scene = nodeScenes.value[currentPreviewSceneIndex.value];
    if (!scene) return;
    const components = scene.components || []
    const comp = components[currentPreviewComponentIndex.value]

    if (comp && comp.type === 'video') {
        const vidEl = comp.videoElement;
        const isLooping = comp.isLoop; 
        const hasEnded = vidEl ? vidEl.ended : false;
        const duckVolume = comp.bgMusicVolume !== undefined ? comp.bgMusicVolume : 0.2;

        if (isLooping) {
            targetVolume = baseVolume * duckVolume; 
        } else {
            if (!hasEnded) {
                targetVolume = baseVolume * duckVolume;
            } else {
                targetVolume = baseVolume;
            }
        }
    } 

    const currentVol = previewAudioElement.value.volume;
    const step = 0.02; 

    if (Math.abs(currentVol - targetVolume) > 0.01) {
        if (currentVol < targetVolume) {
            previewAudioElement.value.volume = Math.min(targetVolume, currentVol + step);
        } else {
            previewAudioElement.value.volume = Math.max(targetVolume, currentVol - step);
        }
    }
}

const drawPreview = () => {
    if (!previewCtx || !previewCanvasRef.value) return
    
    const canvas = previewCanvasRef.value
    const ctx = previewCtx
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    const scale = previewScale.value;
    ctx.save();
    ctx.scale(scale, scale);
    
    const logicalWidth = canvas.width / scale;
    const logicalHeight = canvas.height / scale;

    const scene = nodeScenes.value[currentPreviewSceneIndex.value]
    if (scene) {
        ctx.fillStyle = scene.backgroundColor || '#000000'
        ctx.fillRect(0, 0, logicalWidth, logicalHeight)
        
        const components = scene.components || []
        const centerX = logicalWidth / 2
        const centerY = logicalHeight / 2
        
        const now = Date.now()

        for (let i = 0; i <= currentPreviewComponentIndex.value; i++) {
            const comp = components[i]
            if (!comp) continue;

            const pixelsPerUnit = 2
            const screenX = centerX + (comp.x * pixelsPerUnit)
            const screenY = centerY - (comp.y * pixelsPerUnit)
            const screenPos = { x: screenX, y: screenY }

            // --- ANIMATION CALCULATION ---
            let progress = 1
            
            // Only the *current* component animates. Previous ones are fully shown (progress = 1)
            if (i === currentPreviewComponentIndex.value) {
                const duration = (comp.animationDuration || 1) * 1000
                if (duration > 0) {
                    progress = (now - componentStartTime.value) / duration
                    if (progress > 1) progress = 1
                    if (progress < 0) progress = 0
                }
            }

            const animType = comp.animationType || 'none'
            
            ctx.save()

            // Apply Animations via Context Transformations
            if (animType === 'fade') {
                ctx.globalAlpha = progress
            } else if (animType === 'scale') {
                // Zoom In
                ctx.translate(screenPos.x, screenPos.y)
                ctx.scale(progress, progress)
                ctx.translate(-screenPos.x, -screenPos.y)
            } else if (animType === 'slide') {
                // Slide from Left
                const offset = 200 * (1 - progress)
                ctx.translate(-offset, 0)
                // Fade in slightly during slide
                ctx.globalAlpha = Math.max(0, progress) 
            }
            
            ctx.translate(screenPos.x, screenPos.y)
            ctx.rotate((comp.rotation || 0) * Math.PI / 180)
            ctx.translate(-screenPos.x, -screenPos.y)
            
            // Pass progress specifically for Typewriter effect inside renderComponent
            const animationOverride = {
                type: animType,
                progress: progress
            }
            
            renderComponent(ctx, comp, screenPos, animationOverride)
            
            ctx.restore()
        }
    }
    
    ctx.restore(); 
}

const exitPreview = () => {
    if (document.fullscreenElement) {
        document.exitFullscreen()
    }
    if (previewAudioElement.value) {
        previewAudioElement.value.pause()
        previewAudioElement.value = null
    }
    stopAllVideos();
    isPreviewMode.value = false
}

window.addEventListener('resize', () => {
    if (isPreviewMode.value) {
        resizePreviewCanvas()
        drawPreview()
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
            
            <div class="audio-status-display">
                <span class="audio-label">Sequence Audio:</span>
                <span class="audio-value">{{ sequenceAudio?.name || 'Not selected yet' }}</span>
            </div>

            <button class="preview-btn" @click="startPreview">
                ▶ Preview
             </button>
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
              
              <input 
                type="file"
                ref="videoInputRef"
                accept="video/*"
                style="display: none"
                @change="handleVideoUpload"
              />
              
               <input
                type="file"
                ref="audioInputRef"
                accept="audio/*"
                style="display: none"
                @change="handleAudioUpload"
               />
            </div>
            
            <div class="scene-panel">
              <div v-if="viewMode === 'scenes'" class="scene-list-view">
                
                <div class="scenes-box">
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

                <div class="audio-box">
                    <div class="scene-panel-header">
                        <span class="scene-panel-title">Sequence Background Audio</span>
                    </div>
                    <div class="audio-content">
                        <div v-if="!sequenceAudio" class="audio-upload-placeholder" @click="triggerAudioUpload">
                             <span>🎵 Click to add audio</span>
                        </div>
                        <div v-else>
                             <div class="audio-file-display">
                                 <div class="audio-icon">🔊</div>
                                 <div class="audio-info">
                                     <div class="audio-filename">{{ sequenceAudio.name }}</div>
                                 </div>
                                 <button class="remove-audio-btn" @click="removeAudio">✕</button>
                             </div>

                             <div class="audio-controls">
                                <div class="audio-control-row">
                                    <span class="audio-control-label">Volume:</span>
                                    <input 
                                        type="range" 
                                        v-model.number="sequenceAudio.volume" 
                                        min="0" max="1" step="0.05" 
                                        class="range-input audio-range"
                                        @change="updateAudioProperties"
                                    />
                                    <span class="audio-val-text">{{ Math.round((sequenceAudio.volume || 1) * 100) }}%</span>
                                </div>
                                <div class="audio-control-row">
                                    <label class="audio-checkbox-label">
                                        <input 
                                            type="checkbox" 
                                            v-model="sequenceAudio.loop"
                                            @change="updateAudioProperties"
                                        />
                                        Loop Audio
                                    </label>
                                </div>
                             </div>
                        </div>
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
                          :class="option.colorClass"
                          @click="selectAddOption(option)"
                        >
                          {{ option.label }}
                        </div>
                      </div>
                    </div>
                    <div class="scene-content-body">
                      <div v-if="sceneComponents.length === 0" class="empty-content">
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
                        <img v-if="activeComponent.type === 'image'" :src="activeComponent.url" alt="Preview" />
                        <div v-else-if="activeComponent.type === 'text'" style="color:white; font-size: 24px; text-align: center;">T</div>
                         <video 
                            v-else-if="activeComponent.type === 'video'" 
                            :src="activeComponent.url" 
                            style="max-width: 100%; max-height: 100%;"
                            controls
                          ></video>
                        <div v-else-if="activeComponent.type === 'options'" 
                             :style="{ width: '100px', height: '50px', border: '2px dashed #f87171', backgroundColor: 'rgba(31,41,55,0.5)', display: 'flex', alignItems:'center', justifyContent: 'center', color: '#f87171' }">
                             Opt
                        </div>
                        <div v-else style="color:white">?</div>
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
                        <label class="detail-label">Entrance Animation:</label>
                        <select v-model="activeComponent.animationType" class="detail-input">
                            <option value="none">None</option>
                            <option value="fade">Fade In</option>
                            <option value="scale">Zoom In</option>
                            <option value="slide">Slide In (Left)</option>
                            <option v-if="activeComponent.type === 'text'" value="typewriter">Typewriter</option>
                        </select>
                    </div>

                    <div class="detail-section" v-if="activeComponent.animationType && activeComponent.animationType !== 'none'">
                        <label class="detail-label">Animation Duration (sec):</label>
                        <div class="input-row">
                            <input 
                                type="range" 
                                v-model.number="activeComponent.animationDuration" 
                                min="0.1" max="10" step="0.1"
                                class="range-input" 
                            />
                            <input 
                                type="number" 
                                v-model.number="activeComponent.animationDuration" 
                                class="number-input" 
                                min="0.1" max="10" step="0.1"
                            />
                        </div>
                    </div>
                    <div class="separator"></div>
                    <div class="detail-section">
                         <div class="checkbox-row" style="margin-bottom: 8px;">
                            <label class="detail-label" style="margin-bottom:0; flex: 1;">Render on click:</label>
                            <input type="checkbox" :checked="activeComponent.renderWhileClicked" @change="updateRenderMode('click')" />
                         </div>
                         <div style="font-size: 0.75rem; color: #9ca3af; margin-bottom: 8px; margin-left: 20px;">
                            User must click to show this component.
                         </div>

                         <div class="checkbox-row">
                            <label class="detail-label" style="margin-bottom:0; flex: 1;">Automatic rendering:</label>
                            <input type="checkbox" :checked="activeComponent.autoRender" @change="updateRenderMode('auto')" />
                         </div>
                         <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 4px; margin-left: 20px;">
                            Renders immediately after the previous component finishes.
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
                    
                    <div class="separator"></div>

                    <div v-if="activeComponent.type === 'options'" class="options-editor-panel">
                        <div class="detail-section">
                            <div class="scene-panel-header" style="margin-bottom: 12px; border-bottom: 0; padding: 0;">
                                <span class="detail-label" style="font-size: 1rem;">Options List</span>
                                <button class="add-content-btn" @click="addOptionToComponent" style="padding: 4px 8px;">+ Add Option</button>
                            </div>
                            
                            <div class="options-list-container">
                                <div v-for="(opt, index) in activeComponent.optionsList" :key="opt.id" class="option-list-item-wrapper">
                                    <div class="option-list-item">
                                        <input v-model="opt.text" class="detail-input" @input="drawComponents" />
                                        <button class="remove-image-btn" @click="removeOptionFromComponent(index)">🗑️</button>
                                    </div>
                                    <div style="font-size: 0.75rem; color: #00ff88; margin-top: 4px; padding-left: 4px; font-style: italic;">
                                        Connected to: {{ getConnectedNodeName(opt.id) }}
                                    </div>
                                </div>
                                <div v-if="activeComponent.optionsList.length === 0" style="text-align:center; color: #6b7280; font-style:italic; padding: 10px;">
                                    No options.
                                </div>
                            </div>
                        </div>

                        <div class="detail-section">
                            <label class="detail-label">Button Styles:</label>
                            
                            <div class="style-tabs">
                                <button 
                                    class="style-tab-btn" 
                                    :class="{ active: activeStyleState === 'normal' }" 
                                    @click="activeStyleState = 'normal'"
                                >
                                    Normal
                                </button>
                                <button 
                                    class="style-tab-btn" 
                                    :class="{ active: activeStyleState === 'hovered' }" 
                                    @click="activeStyleState = 'hovered'"
                                >
                                    Hovered
                                </button>
                                <button 
                                    class="style-tab-btn" 
                                    :class="{ active: activeStyleState === 'clicked' }" 
                                    @click="activeStyleState = 'clicked'"
                                >
                                    Clicked
                                </button>
                            </div>

                            <div class="style-editor-box">
                                <div class="detail-section">
                                    <label class="detail-label">Background Color:</label>
                                     <div class="color-picker-container">
                                        <input type="color" v-model="activeComponent.styles[activeStyleState].backgroundColor" class="color-input" @input="drawComponents" />
                                        <div class="color-preview" :style="{ backgroundColor: activeComponent.styles[activeStyleState].backgroundColor }"></div>
                                     </div>
                                </div>
                                
                                <div class="detail-section">
                                    <label class="detail-label">Text Color:</label>
                                     <div class="color-picker-container">
                                        <input type="color" v-model="activeComponent.styles[activeStyleState].color" class="color-input" @input="drawComponents" />
                                        <div class="color-preview" :style="{ backgroundColor: activeComponent.styles[activeStyleState].color }"></div>
                                     </div>
                                </div>
                                
                                <div class="detail-section">
                                    <label class="detail-label">Border Color:</label>
                                     <div class="color-picker-container">
                                        <input type="color" v-model="activeComponent.styles[activeStyleState].borderColor" class="color-input" @input="drawComponents" />
                                        <div class="color-preview" :style="{ backgroundColor: activeComponent.styles[activeStyleState].borderColor }"></div>
                                     </div>
                                </div>

                                <div class="detail-section">
                                    <label class="detail-label">Border Width:</label>
                                    <input type="number" v-model.number="activeComponent.styles[activeStyleState].borderWidth" class="detail-input" @input="drawComponents" />
                                </div>

                                <div class="detail-section">
                                    <label class="detail-label">Border Radius:</label>
                                    <input type="number" v-model.number="activeComponent.styles[activeStyleState].borderRadius" class="detail-input" @input="drawComponents" />
                                </div>
                                
                                <div class="detail-section">
                                    <label class="detail-label">Font Size:</label>
                                    <input type="number" v-model.number="activeComponent.styles[activeStyleState].fontSize" class="detail-input" @input="drawComponents" />
                                </div>
                            </div>
                        </div>
                    </div>


                    <div class="separator"></div>

                    <div class="detail-section">
                        <label class="detail-label">Position X:</label>
                        <div class="input-row">
                            <input type="range" v-model.number="activeComponent.x" :min="GRAPH_MIN_X" :max="GRAPH_MAX_X" class="range-input" @input="updateActiveComponentPosition" />
                            <input type="number" v-model.number="activeComponent.x" class="number-input" @input="updateActiveComponentPosition" />
                        </div>
                    </div>
                    <div class="detail-section">
                        <label class="detail-label">Position Y:</label>
                        <div class="input-row">
                            <input type="range" v-model.number="activeComponent.y" :min="GRAPH_MIN_Y" :max="GRAPH_MAX_Y" class="range-input" @input="updateActiveComponentPosition" />
                            <input type="number" v-model.number="activeComponent.y" class="number-input" @input="updateActiveComponentPosition" />
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <label class="detail-label">Width (px):</label>
                        <div class="input-row">
                            <input type="range" v-model.number="activeComponent.width" min="10" max="800" class="range-input" @input="updateActiveComponentSize" />
                            <input type="number" v-model.number="activeComponent.width" class="number-input" @input="updateActiveComponentSize" />
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <label class="detail-label">Height (px):</label>
                        <div class="input-row">
                            <input type="range" v-model.number="activeComponent.height" min="10" max="600" class="range-input" @input="updateActiveComponentSize" />
                            <input type="number" v-model.number="activeComponent.height" class="number-input" @input="updateActiveComponentSize" />
                        </div>
                    </div>

                    <div v-if="activeComponent.type !== 'options'">
                        <div class="detail-section">
                            <label class="detail-label">Rotation (deg):</label>
                            <div class="input-row">
                                <input type="range" v-model.number="activeComponent.rotation" min="0" max="360" class="range-input" @input="updateActiveComponentPosition" />
                                <input type="number" v-model.number="activeComponent.rotation" class="number-input" @input="updateActiveComponentPosition" />
                            </div>
                        </div>
                    </div>

                    <div v-if="activeComponent.type === 'video'">
                        <div class="detail-section">
                             <div class="checkbox-row">
                                <label class="detail-label" style="margin-bottom:0;">Loop:</label>
                                <input type="checkbox" v-model="activeComponent.isLoop" @change="updateVideoProperties" />
                             </div>
                        </div>
                         <div class="detail-section">
                             <div class="checkbox-row">
                                <label class="detail-label" style="margin-bottom:0;">Mute:</label>
                                <input type="checkbox" v-model="activeComponent.isMuted" @change="updateVideoProperties" />
                             </div>
                        </div>
                        
                        <div class="detail-section">
                            <label class="detail-label">Background Music Volume:</label>
                            <div class="input-row">
                                <input 
                                    type="range" 
                                    v-model.number="activeComponent.bgMusicVolume" 
                                    min="0" max="1" step="0.05"
                                    class="range-input"
                                />
                                <span style="color: #00ff88; font-family: monospace; width: 40px; text-align:right;">
                                    {{ Math.round((activeComponent.bgMusicVolume || 0.2) * 100) }}%
                                </span>
                            </div>
                            <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 4px; font-style: italic;">
                                Music volume when this video plays.
                            </div>
                        </div>
                    </div>

                    <div v-if="activeComponent.type === 'text'">
                        <div class="detail-section">
                            <label class="detail-label">Content:</label>
                            <input 
                                v-model="activeComponent.content" 
                                class="detail-input" 
                                @input="updateActiveComponentPosition" 
                                @select="handleTextSelect"
                            />
                            
                            <div v-if="textSelection.text.length > 0" class="formatting-controls">
                                <button class="format-btn" @click="applyTextStyle('bold', activeComponent.fontWeight === 'bold' ? 'normal' : 'bold')" :class="{ active: activeComponent.fontWeight === 'bold' }" title="Bold">B</button>
                                <button class="format-btn" @click="applyTextStyle('italic')" :class="{ active: activeComponent.fontStyle === 'italic' }" title="Italic">I</button>
                                <button class="format-btn" @click="applyTextStyle('underline')" :class="{ active: activeComponent.textDecoration === 'underline' }" title="Underline">U</button>
                                <button class="format-btn" @click="applyTextStyle('strikethrough')" :class="{ active: activeComponent.textDecoration === 'line-through' }" title="Strikethrough">S</button>
                                <input type="color" v-model="activeComponent.textDecorationColor" class="mini-color-input" title="Line Color" />
                            </div>
                        </div>

                        <div class="detail-section">
                            <label class="detail-label">Font Family:</label>
                            <select v-model="activeComponent.fontFamily" class="detail-input" @change="updateActiveComponentPosition">
                                <option value="sans-serif">Sans Serif</option>
                                <option value="serif">Serif</option>
                                <option value="monospace">Monospace</option>
                                <option value="cursive">Cursive</option>
                                <option value="fantasy">Fantasy</option>
                            </select>
                        </div>
                        <div class="detail-section">
                            <label class="detail-label">Font Size:</label>
                            <input type="number" v-model.number="activeComponent.fontSize" class="detail-input" @input="updateActiveComponentPosition" />
                        </div>
                        <div class="detail-section">
                            <label class="detail-label">Text Color:</label>
                             <div class="color-picker-container">
                                <input type="color" v-model="activeComponent.color" class="color-input" @input="updateActiveComponentPosition" />
                                <div class="color-preview" :style="{ backgroundColor: activeComponent.color }"></div>
                             </div>
                        </div>
                        <div class="detail-section">
                            <label class="detail-label">Background Color:</label>
                             <div class="color-picker-container">
                                <input type="color" v-model="activeComponent.backgroundColor" class="color-input" @input="updateActiveComponentPosition" />
                                <div class="color-preview" :style="{ backgroundColor: activeComponent.backgroundColor }"></div>
                             </div>
                        </div>
                        <div class="detail-section">
                            <label class="detail-label">Border Color:</label>
                             <div class="color-picker-container">
                                <input type="color" v-model="activeComponent.borderColor" class="color-input" @input="updateActiveComponentPosition" />
                                <div class="color-preview" :style="{ backgroundColor: activeComponent.borderColor }"></div>
                             </div>
                        </div>
                         <div class="detail-section">
                            <label class="detail-label">Border Width:</label>
                            <input type="number" v-model.number="activeComponent.borderWidth" class="detail-input" @input="updateActiveComponentPosition" />
                        </div>
                         <div class="detail-section">
                            <label class="detail-label">Round Corners:</label>
                            <input type="range" v-model.number="activeComponent.borderRadius" min="0" max="50" class="range-input" @input="updateActiveComponentPosition" />
                        </div>
                    </div>

                </div>
              </div>

            </div>
          </div>
          <button class="popup-return-btn" @click="closePopup">Return to Canvas</button>
          
          <div v-if="showAddDropdown" class="dropdown-overlay" @click="closeAddDropdown"></div>
        </div>
      </div>
    </transition>

    <transition name="fade">
        <div v-if="isPreviewMode" class="preview-overlay" @click="advancePreview">
             <canvas ref="previewCanvasRef" class="preview-canvas"></canvas>
             <button class="preview-close-btn" @click.stop="exitPreview">Stop Preview ✕</button>
             <div class="preview-hint">Click to advance sequence</div>
        </div>
    </transition>

  </div>
</template>

<style scoped>
  .wrapper { 
    width: 100vw; 
    height: 100vh;
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

  /* Audio Status Display in Header */
  .audio-status-display {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 20px;
    flex: 1; /* allow it to grow */
  }

  .audio-label {
      color: #9ca3af;
      font-size: 14px;
      font-weight: 500;
  }

  .audio-value {
      color: #00ff88;
      font-size: 14px;
      font-weight: 600;
  }

  /* Preview Button */
  .preview-btn {
      background: #8b5cf6; /* Violet */
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      color: #fff;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: 20px;
      transition: background 0.2s;
  }

  .preview-btn:hover {
      background: #7c3aed;
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
    z-index: 1; /* BOTTOM layer - Graph grid, hidden by overlay */
    pointer-events: none; /* Let events fall through to background if necessary, though parent handles events */
  }

  /* Background Color Overlay - Middle layer */
  .background-color-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 2; /* MIDDLE layer - Covers the grid */
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
    z-index: 10; /* TOP layer - Images/Videos/Text */
  }

  /* Welcome Message Styles */
  .welcome-message {
    text-align: center;
    padding: 40px;
    max-width: 500px;
    z-index: 20; /* Ensure welcome message is above canvas stack */
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

  /* Scene List View Styles - Updated for 2 boxes */
  .scene-list-view {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 16px;
  }

  .scenes-box {
      flex: 1; /* Take up remaining space */
      display: flex;
      flex-direction: column;
      min-height: 200px; /* Ensure scenes always have space */
      overflow: hidden; /* Contain inner scroll */
  }
   
  .audio-box {
      flex-shrink: 0;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.05);
  }

  .scene-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0; /* Prevent header from shrinking */
    position: relative;
    padding-top: 4px;
  }

  .audio-box .scene-panel-header {
      padding: 12px;
      margin-bottom: 0;
      background: rgba(255, 255, 255, 0.03);
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

  /* Audio Box Content */
  .audio-content {
      padding: 16px;
  }

  .audio-upload-placeholder {
      border: 2px dashed rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      padding: 16px;
      text-align: center;
      color: #9ca3af;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.9rem;
  }

  .audio-upload-placeholder:hover {
      border-color: #00ff88;
      color: #00ff88;
      background: rgba(0, 255, 136, 0.05);
  }

  .audio-file-display {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(255, 255, 255, 0.08);
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 12px;
  }

  .audio-icon {
      font-size: 1.2rem;
  }

  .audio-info {
      flex: 1;
      overflow: hidden;
  }

  .audio-filename {
      color: #e2e8f0;
      font-size: 0.9rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
  }

  .remove-audio-btn {
      background: transparent;
      border: none;
      color: #f87171;
      cursor: pointer;
      font-size: 1rem;
      padding: 4px;
      line-height: 1;
  }
   
  .remove-audio-btn:hover {
      background: rgba(248, 113, 113, 0.2);
      border-radius: 4px;
  }

  /* NEW AUDIO CONTROLS STYLES */
  .audio-controls {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 4px 0;
  }

  .audio-control-row {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #e2e8f0;
      font-size: 0.9rem;
  }

  .audio-control-label {
      min-width: 50px;
      font-weight: 500;
      color: #9ca3af;
  }

  .audio-range {
      flex: 1;
  }

  .audio-val-text {
      font-family: monospace;
      font-size: 0.85rem;
      color: #00ff88;
      width: 40px;
      text-align: right;
  }

  .audio-checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
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
   
  /* Checkbox Row */
  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 10px;
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
   
  /* Formatting Controls */
  .formatting-controls {
    display: flex;
    gap: 6px;
    margin-top: 8px;
    align-items: center;
  }
   
  .format-btn {
    width: 30px;
    height: 30px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: #ccc;
    cursor: pointer;
    border-radius: 4px;
    font-weight: bold;
    font-size: 14px;
  }
   
  .format-btn:hover {
    background: rgba(255,255,255,0.1);
  }
   
  .format-btn.active {
    background: #00ff88;
    color: #000;
    border-color: #00ff88;
  }
   
  .mini-color-input {
      width: 30px;
      height: 30px;
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 0;
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

  /* DROPDOWN HOVER COLORS */
  .hover-green:hover { background-color: rgba(0, 255, 136, 0.2); }
  .hover-blue:hover { background-color: rgba(59, 130, 246, 0.2); }
  .hover-yellow:hover { background-color: rgba(234, 179, 8, 0.2); }
  .hover-red:hover { background-color: rgba(248, 113, 113, 0.2); } /* Red for options */


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
    position: relative; /* For strip positioning */
    overflow: hidden; /* For strip containment */
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

  /* Dragging Visuals */
  :deep(.image-container.over) {
    border: 2px dashed #00ff88;
    background: rgba(0, 255, 136, 0.1);
  }

  :deep(.image-container.dragging) {
    opacity: 0.5;
    border: 2px dashed #3b82f6;
  }

  /* TYPE INDICATOR STRIP */
  :deep(.type-indicator) {
    width: 4px;
    height: 100%;
    position: absolute;
    left: 0;
    top: 0;
  }
   
  :deep(.bg-green) { background-color: #00ff88; }
  :deep(.bg-blue) { background-color: #3b82f6; }
  :deep(.bg-yellow) { background-color: #eab308; }
  :deep(.bg-red) { background-color: #f87171; } /* Red for options */

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
    margin-left: 6px; /* Space for indicator strip */
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
  .popup-return-btn {
    position: absolute;
    bottom: 24px;
    right: 24px;
    background: #374151; /* Dark gray */
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 12px 24px;
    border-radius: 8px;
    color: #e2e8f0;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    z-index: 20; /* Ensure it's above everything */
  }

  .popup-return-btn:hover {
    background: #4b5563; /* Lighter gray */
    color: #fff;
    border-color: rgba(255, 255, 255, 0.3);
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

  /* PREVIEW MODE STYLES */
  .preview-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: #000;
      z-index: 9999;
      cursor: pointer; /* Indicate clickable */
      display: flex;
      align-items: center;
      justify-content: center;
  }

  .preview-canvas {
      width: 100%;
      height: 100%;
      display: block;
  }

  .preview-close-btn {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 68, 68, 0.8);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: bold;
      cursor: pointer;
      z-index: 10000;
      transition: background 0.2s;
  }

  .preview-close-btn:hover {
      background: #ff0000;
  }
   
  .preview-hint {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(255,255,255,0.5);
      font-size: 0.9rem;
      pointer-events: none;
      background: rgba(0,0,0,0.5);
      padding: 6px 12px;
      border-radius: 20px;
  }

  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.5s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
  
  /* Separator */
  .separator {
      height: 1px;
      background: rgba(255,255,255,0.1);
      margin: 16px 0;
  }
  
  /* OPTIONS EDITOR STYLES */
  .options-editor-panel {
      background: rgba(0,0,0,0.2);
      padding: 12px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.05);
  }
  
  .options-list-container {
      max-height: 150px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 16px;
  }
  
  .option-list-item-wrapper {
      padding: 4px;
      background: rgba(255,255,255,0.02);
      border-radius: 4px;
  }

  .option-list-item {
      display: flex;
      gap: 8px;
  }
  
  .style-tabs {
      display: flex;
      background: rgba(255,255,255,0.05);
      border-radius: 6px;
      padding: 4px;
      margin-bottom: 12px;
  }
  
  .style-tab-btn {
      flex: 1;
      background: transparent;
      border: none;
      color: #9ca3af;
      padding: 6px;
      cursor: pointer;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 500;
      transition: all 0.2s;
  }
  
  .style-tab-btn.active {
      background: #374151;
      color: #fff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.2);
  }
  
  .style-editor-box {
      border: 1px solid rgba(255,255,255,0.05);
      padding: 12px;
      border-radius: 6px;
  }
</style>