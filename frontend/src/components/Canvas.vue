<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch, computed } from "vue"
import { useRoute } from "vue-router"

/* ================= ROUTE ================= */
const route = useRoute()
const projectId = route.params.projectId
const token = localStorage.getItem("token")

const cursorStyle = ref('default') // Needed for the template :style="{ cursor: cursorStyle }"

/* ================= UI ================= */
const menuOpen = ref(false)
const toggleMenu = () => (menuOpen.value = !menuOpen.value)

/* ================= GLOBAL VARIABLES STATE ================= */
const globalVariables = ref([])
const isAddingVariable = ref(false)
const newVarName = ref("")
const newVarValue = ref("")
const newVarType = ref("string") 

const projectName = ref("Loading...")
const projectOwner = ref("")

const autoSaveDuration = 300; // 5 minutes
const autoSaveTimer = ref(autoSaveDuration);
const hasUnsavedChanges = ref(false);
let autoSaveInterval = null;


/* ================= SAVE & LOADING STATE ================= */
const isSaving = ref(false) // <--- NEW STATE
const currentTip = ref("")  // <--- NEW STATE

const tips = [
    "⚠️ Important: For the best experience, please create and edit your project on a single device to avoid sync conflicts.",
    "💡 Pro Tip: Use the 'Preview' mode often to test your logic flows before publishing.",
    "🎨 You can customize individual component animations in the editor panel.",
    "🔌 Check your disconnected options in Project Settings before finishing!",
    "💾 Weaving your digital tapestry..."
]

const notification = ref({
    show: false,
    message: "",
    type: "success" // 'success' or 'error'
});

const formattedAutoSaveTime = computed(() => {
    const m = Math.floor(autoSaveTimer.value / 60).toString().padStart(2, '0');
    const s = (autoSaveTimer.value % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
});



const Canvas_Status = ref([]) 



// Watch for changes to activate timer
watch(Canvas_Status, () => {
    if (!hasUnsavedChanges.value) {
        hasUnsavedChanges.value = true;
    }
}, { deep: true });

// Notification Helper
const triggerNotification = (msg, type = 'success') => {
    notification.value = { show: true, message: msg, type };
    setTimeout(() => {
        notification.value.show = false;
    }, 3000);
}

/* ================= MEDIA LOADING TRACKER ================= */
const mediaRegistry = ref(new Map()); // Stores file status: { id, name, type, status: 'loading'|'loaded'|'error' }
const showMediaStatus = ref(false);

const isMediaLoading = computed(() => {
    for (const item of mediaRegistry.value.values()) {
        if (item.status === 'loading') return true;
    }
    return false;
});

const mediaLoadingCount = computed(() => {
    let loaded = 0, total = 0;
    mediaRegistry.value.forEach(item => {
        total++;
        if (item.status === 'loaded') loaded++;
    });
    return { loaded, total };
});

const registerMedia = (id, name, type) => {
    mediaRegistry.value.set(id, { id, name, type, status: 'loading' });
    return (status) => {
        const item = mediaRegistry.value.get(id);
        if (item) {
            item.status = status;
            // Force reactivity update for Map
            mediaRegistry.value = new Map(mediaRegistry.value); 
        }
    };
};

const fetchProjectDetails = async () => {
  try {
    const res = await fetch(`http://localhost:5000/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (res.ok) {
      const data = await res.json()
      projectName.value = data.name
      projectOwner.value = data.authorName
      // If you are loading nodes from the DB, you might handle that here too, 
      // but strictly for the header, this is what we need.
    }
  } catch (err) {
    console.error("Failed to fetch project details:", err)
    projectName.value = "Untitled Project"
  }
}

watch(globalVariables, (newVars) => {
    Canvas_Status.value.globalVariables = newVars
}, { deep: true })

const toggleAddVariable = () => {
  isAddingVariable.value = !isAddingVariable.value
  newVarName.value = ""
  newVarValue.value = ""
  newVarType.value = "string"
}

const projectOptionsStats = computed(() => {
  let total = 0;
  let disconnected = 0;
  
if (!Canvas_Status.value) return { total: 0, disconnected: 0 };

  Canvas_Status.value.forEach(node => {
    // Check if node has options
    if (node.options && node.options.length > 0) {
      total += node.options.length;
      // Count how many don't have a 'next' connection
      const loose = node.options.filter(opt => !opt.next).length;
      disconnected += loose;
    }
  });

  return { total, disconnected };
});

const saveProjectData = async (isAutoSave = false) => {
  // Prevent multiple clicks
  if (isSaving.value && !isAutoSave) return;

  try {
    // 1. ACTIVATE LOADING SCREEN (Only for manual saves)
    if (!isAutoSave) {
        isSaving.value = true;
        // Pick a random tip
        currentTip.value = tips[Math.floor(Math.random() * tips.length)];
    } else {
        document.body.style.cursor = 'wait'; // Minimal feedback for autosave
    }

    const payload = {
      projectId: projectId, 
      nodes: Canvas_Status.value, 
      globalVariables: globalVariables.value,
      rootNodeId: rootNodeId.value,
      totalOptionsCount: projectOptionsStats.value.total,
      disconnectedOptionsCount: projectOptionsStats.value.disconnected
    };

    const res = await fetch("http://localhost:5000/canvas/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
        hasUnsavedChanges.value = false;
        autoSaveTimer.value = autoSaveDuration;
        
        triggerNotification(
          isAutoSave ? "Auto-saved successfully! 💾" : "Project saved successfully! 💾", 
          "success"
        );

        Canvas_Status.value = data.updatedNodes;
        nodes.value = data.updatedNodes.map(n => ({
            id: n.index,
            x: n.x,
            y: n.y
        }));
          
        // Refresh scene if open
        if (selectedScene.value) {
            const currentSceneNode = Canvas_Status.value.find(n => 
                n.scenes.some(s => s.id === selectedScene.value.id)
            );
            if (currentSceneNode) {
                const updatedScene = currentSceneNode.scenes.find(s => s.id === selectedScene.value.id);
                if (updatedScene) {
                    sceneComponents.value = updatedScene.components;
                    nextTick(() => {
                        updateSceneContentDisplay();
                        drawComponents();
                    });
                }
            }
        }
    } else {
        triggerNotification("Save Failed: " + data.message, "error");
    }
  } catch (err) {
    console.error(err);
    triggerNotification("Error connecting to server", "error");
  } finally {
    // 2. DISABLE LOADING SCREEN (Delay slightly for smooth UX)
    if (!isAutoSave) {
        setTimeout(() => {
            isSaving.value = false;
        }, 800); // 0.8s minimum view time for the cool animation
    } else {
        document.body.style.cursor = 'default';
    }
  }
};

const loadProjectData = async () => {
  try {
    // Clear previous registry on reload
    mediaRegistry.value.clear(); 
    
    const res = await fetch(`http://localhost:5000/canvas/load/${projectId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();

      if (data.globalVariables) {
        globalVariables.value = data.globalVariables;
      }

      if (data.nodes && data.nodes.length > 0) {
        Canvas_Status.value = data.nodes;

        nodes.value = data.nodes.map(n => ({
            id: n.index,
            x: n.x,
            y: n.y
        }));
        
        if (data.rootNodeId !== undefined && data.rootNodeId !== null) {
          rootNodeId.value = data.rootNodeId;
        }

        // --- REHYDRATION WITH LOADING TRACKING ---
        Canvas_Status.value.forEach(node => {
            // 1. Register Node Audio
            if (node.audio && node.audio.url) {
                const audioId = `audio-${node.index}`;
                const markComplete = registerMedia(audioId, node.audio.name || 'Background Audio', 'audio');
                
                // Preload check
                const tempAudio = new Audio();
                tempAudio.oncanplaythrough = () => markComplete('loaded');
                tempAudio.onerror = () => markComplete('error');
                tempAudio.src = node.audio.url;
            }

            if(node.scenes) {
                node.scenes.forEach(scene => {
                    if(scene.components) {
                        scene.components.forEach(comp => {
                            // 2. Register Images
                            if(comp.type === 'image' && comp.url) {
                                const markComplete = registerMedia(comp.id, comp.name || 'Image', 'image');
                                
                                const img = new Image();
                                img.crossOrigin = "Anonymous";
                                
                                img.onload = () => {
                                    markComplete('loaded');
                                    draw(); 
                                    if(selectedScene.value) drawComponents(); 
                                };
                                
                                img.onerror = (e) => {
                                    console.error("Failed to load image:", comp.url);
                                    markComplete('error');
                                };

                                img.src = comp.url;
                                comp.imgObject = img;
                            } 
                            // 3. Register Videos
                            else if (comp.type === 'video' && comp.url) {
                                const markComplete = registerMedia(comp.id, comp.name || 'Video', 'video');

                                const vid = document.createElement('video');
                                vid.crossOrigin = "Anonymous"; 
                                vid.preload = "metadata"; // Load enough to know it works
                                
                                vid.onloadeddata = () => {
                                    markComplete('loaded');
                                };
                                vid.onerror = () => {
                                    markComplete('error');
                                };

                                vid.src = comp.url;
                                vid.loop = comp.isLoop !== false;
                                vid.muted = comp.isMuted === true;
                                comp.videoElement = vid;
                            }
                        });
                    }
                });
            }
        });

        // Final cleanup
        nextTick(() => {
            hasUnsavedChanges.value = false;
            draw(); 
        });
      }
    }
  } catch (err) {
    console.error("Failed to load project:", err);
  }
};

/* ================= IF-ELSE EDITOR STATE ================= */
const ifElseVarId = ref("")
const ifElseOperator = ref("==")
const ifElseValueType = ref("constant") 
const ifElseValue = ref("")
const ifElseOperators = ['==', '!=', '>', '<', '>=', '<='] // Defined here to prevent crash

const addGlobalVariable = () => {
  const name = newVarName.value.trim()
  const type = newVarType.value
  let value = newVarValue.value

  if (!name) {
    alert("Variable name is required")
    return
  }
  if (globalVariables.value.some(v => v.name === name)) {
    alert("Variable name already exists")
    return
  }

  // Strict check for initialization
  if (value === "" || value === null || value === undefined) {
      alert(`Please provide an initial value for the ${type}.`)
      return
  }

  if (type === 'integer') {
      if (isNaN(value)) {
          alert("Value must be a valid number.")
          return
      }
      value = Number(value)
  } else {
      value = String(value) 
  }

  globalVariables.value.push({
    id: Date.now(),
    name: name,
    type: type,
    value: value,        
    defaultValue: value  
  })

  isAddingVariable.value = false
  newVarName.value = ""
  newVarValue.value = ""
  newVarType.value = "string"
}

const deleteGlobalVariable = (id) => {
  if (confirm("Delete this variable?")) {
    globalVariables.value = globalVariables.value.filter(v => v.id !== id)
  }
}

/* ================= SET VARIABLE EDITOR STATE (MOVED UP) ================= */
// These must be defined BEFORE the computed properties below use them
const setVarId = ref("")
const setVarOperator = ref("=")
const setVarValueType = ref("constant") 
const setVarValue = ref("")
const setVarStringPrefix = ref("") 
const setVarStringSuffix = ref("")

// --- Computed & Watchers relying on setVarId ---
const availableOperators = computed(() => {
    const v = globalVariables.value.find(g => g.id === setVarId.value);
    if (v && v.type === 'string') {
        return ['=', '+']; 
    }
    return ['=', '+', '-', '*', '/']; 
});

watch(setVarId, (newId) => {
    const v = globalVariables.value.find(g => g.id === newId);
    if (v && v.type === 'string' && setVarOperator.value !== '=' && setVarOperator.value !== '+') {
        setVarOperator.value = '=';
    }
});

// --- Project Settings State ---
const showProjectSettings = ref(false)
const rootNodeId = ref(null)

/* ================= LOGIC ENGINE ================= */
const processLogicNode = (nodeStatus) => {
   // 1. SET VARIABLE LOGIC
   if (nodeStatus.node_type === 'Set Variables') {
       // FIX: Use loose equality (==)
       const targetVar = globalVariables.value.find(v => v.id == nodeStatus.varId);
       
       if (targetVar) {
           if (targetVar.type === 'integer') {
               let operand = nodeStatus.varValue;
               if (nodeStatus.varValueType === 'variable') {
                   // FIX: Use loose equality (==)
                   const sourceVar = globalVariables.value.find(v => v.id == nodeStatus.varValue);
                   operand = sourceVar ? sourceVar.value : 0;
               }
               operand = Number(operand);
               let current = Number(targetVar.value);
               if (isNaN(current)) current = 0;
               
               if (!isNaN(operand)) {
                   switch(nodeStatus.varOperator) {
                       case '=': targetVar.value = operand; break;
                       case '+': targetVar.value = current + operand; break;
                       case '-': targetVar.value = current - operand; break;
                       case '*': targetVar.value = current * operand; break;
                       case '/': targetVar.value = current / operand; break;
                   }
               }
           } else if (targetVar.type === 'string') {
               if (nodeStatus.varOperator === '=') {
                   let newVal = nodeStatus.varValue;
                   if (nodeStatus.varValueType === 'variable') {
                        // FIX: Use loose equality (==)
                        const sourceVar = globalVariables.value.find(v => v.id == nodeStatus.varValue);
                        newVal = sourceVar ? sourceVar.value : "";
                   }
                   targetVar.value = String(newVal);
               } else if (nodeStatus.varOperator === '+') {
                   const prefix = nodeStatus.stringPrefix || "";
                   const suffix = nodeStatus.stringSuffix || "";
                   const currentVal = String(targetVar.value || "");
                   targetVar.value = prefix + currentVal + suffix;
               }
           }
           console.log(`[Logic Executed] Variable '${targetVar.name}' is now:`, targetVar.value);
       }
       return nodeStatus.Next; 
   } 
   
   // 2. IF-ELSE LOGIC
   else if (nodeStatus.node_type === 'If-Else') {
       // FIX: Use loose equality (==)
       const variable = globalVariables.value.find(v => v.id == nodeStatus.varId);
       if (!variable) return nodeStatus.NextFalse; 

       let leftVal = variable.value;
       let rightVal = nodeStatus.compareValue;

       if (nodeStatus.compareValueType === 'variable') {
           // FIX: Use loose equality (==)
           const rightVar = globalVariables.value.find(v => v.id == nodeStatus.compareValue);
           rightVal = rightVar ? rightVar.value : 0;
       }
       // ... [Rest of function matches existing] ...
       if (variable.type === 'integer') {
           leftVal = Number(leftVal);
           rightVal = Number(rightVal);
       } else {
           leftVal = String(leftVal);
           rightVal = String(rightVal);
       }

       let result = false;
       switch (nodeStatus.operator) {
           case '==': result = (leftVal == rightVal); break;
           case '!=': result = (leftVal != rightVal); break;
           case '>':  result = (leftVal > rightVal); break;
           case '<':  result = (leftVal < rightVal); break;
           case '>=': result = (leftVal >= rightVal); break;
           case '<=': result = (leftVal <= rightVal); break;
       }
       console.log(`[If-Else] Result: ${result}`);
       return result ? nodeStatus.NextTrue : nodeStatus.NextFalse;
   }
   
   return null; 
}

const toggleProjectSettings = () => {
    showProjectSettings.value = !showProjectSettings.value
}

const availableRootNodes = computed(() => {
  return Canvas_Status.value.filter(n => n.node_type === 'General')
})

const playProjectFromRoot = () => {
  if (rootNodeId.value === null || rootNodeId.value === "") {
    alert("Please set a Root Node (Starting Point) in the Project Settings first.")
    showProjectSettings.value = true 
    return
  }
  
  const targetId = Number(rootNodeId.value)
  const status = Canvas_Status.value.find(s => s.index === targetId)
  if (!status) {
      alert("The selected Root Node no longer exists.")
      rootNodeId.value = null
      return
  }

  loadNodeForPreview(targetId)
}

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
const editingNodeName = ref("") 
const showContextMenu = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const contextMenuTargetNode = ref(null)

let draggingNode = null
let dragOffset = { x: 0, y: 0 }
let menuDragging = false
let draggedType = "General" 

const NODE_W = 180
const NODE_H = 110 
const HEADER_H = 28
const NODE_RADIUS = 12
const ARROW_OFFSET = 14
const ARROW_HIT_R = 10
const OPTION_ROW_H = 30 

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
const componentStartTime = ref(0) 

// --- NEW: EXIT ANIMATION STATE ---
const isSceneExiting = ref(false)
const sceneExitStartTime = ref(0)
const pendingNavigationTargetId = ref(null)

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

let dragSourceIndex = null
let isHandleActive = false

const activeComponent = ref(null)
const textSelection = ref({ start: 0, end: 0, text: '' })
const activeStyleState = ref('normal') 

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

  // Optional: Check type
  if (!file.type.startsWith('audio/')) {
      alert("Please select a valid audio file.")
      return
  }

  // USE FILE READER TO CONVERT TO BASE64
  const reader = new FileReader()

  reader.onload = (e) => {
      const audioUrl = e.target.result // This is now a "data:audio/..." string

      sequenceAudio.value = {
        name: file.name,
        url: audioUrl, // Success! The backend will now recognize this.
        volume: 1.0, 
        loop: true   
      }

      updateNodeAudioInStatus()
  }

  reader.readAsDataURL(file) // Triggers the conversion
  event.target.value = ''
}

const removeAudio = (e) => {
  if (e) e.stopPropagation() 
  sequenceAudio.value = null
  updateNodeAudioInStatus()
}

const onContextMenu = (e) => {
  const w = screenToWorld(e.clientX, e.clientY)
  const hitNode = getNodeAt(w.x, w.y)

  if (hitNode) {
    contextMenuTargetNode.value = hitNode
    contextMenuPos.value = { x: e.clientX, y: e.clientY }
    showContextMenu.value = true
  } else {
    showContextMenu.value = false
  }
}

const deleteTargetNode = () => {
    if (!contextMenuTargetNode.value) return;
    const id = contextMenuTargetNode.value.id;

    if (!confirm("Are you sure you want to delete this node?")) {
        showContextMenu.value = false;
        return;
    }

    Canvas_Status.value.forEach(node => {
        if (node.Next === id) node.Next = null;
        if (node.NextTrue === id) node.NextTrue = null;
        if (node.NextFalse === id) node.NextFalse = null;
        if (node.options) {
            node.options.forEach(opt => {
                if (opt.next === id) opt.next = null;
            });
        }
    });

    nodes.value = nodes.value.filter(n => n.id !== id);
    Canvas_Status.value = Canvas_Status.value.filter(n => n.index !== id);

    showContextMenu.value = false;
    contextMenuTargetNode.value = null;
    selectedNodeId.value = null; 
    draw();
}

const removeTargetLinks = () => {
    if (!contextMenuTargetNode.value) return;
    const id = contextMenuTargetNode.value.id;

    const status = Canvas_Status.value.find(n => n.index === id);
    if (status) {
        status.Next = null;
        status.NextTrue = null;
        status.NextFalse = null;
        if (status.options) {
            status.options.forEach(opt => opt.next = null);
        }
    }

    Canvas_Status.value.forEach(node => {
        if (node.Next === id) node.Next = null;
        if (node.NextTrue === id) node.NextTrue = null;
        if (node.NextFalse === id) node.NextFalse = null;
        if (node.options) {
            node.options.forEach(opt => {
                if (opt.next === id) opt.next = null;
            });
        }
    });
    
    showContextMenu.value = false;
    draw();
}

const updateAudioProperties = () => {
    updateNodeAudioInStatus()
}

const calculateOptionsLayout = (comp, ctx) => {
    const style = comp.styles?.normal || {};
    const fontSize = style.fontSize || 16;
    const fontFamily = style.fontFamily || 'sans-serif';
    ctx.font = `${fontSize}px ${fontFamily}`;

    const paddingX = 12; 
    const paddingY = 8;  
    const gap = 10;      
    const boxPadding = 10; 
    
    let currentX = -comp.width / 2 + boxPadding;
    let currentY = -comp.height / 2 + boxPadding;
    
    const buttons = [];
    let maxButtonWidth = 0;
    let rowHeight = 0;

    comp.optionsList.forEach(opt => {
        const textMetrics = ctx.measureText(opt.text);
        const btnW = textMetrics.width + (paddingX * 2);
        const btnH = fontSize + (paddingY * 2);
        
        if (btnW > maxButtonWidth) maxButtonWidth = btnW;
        if (btnH > rowHeight) rowHeight = btnH;

        const rightEdge = comp.width / 2 - boxPadding;
        
        if (currentX + btnW > rightEdge && currentX !== (-comp.width / 2 + boxPadding)) {
            currentX = -comp.width / 2 + boxPadding;
            currentY += rowHeight + gap;
        }

        buttons.push({
            id: opt.id,
            text: opt.text,
            x: currentX, 
            y: currentY,
            w: btnW,
            h: btnH
        });

        currentX += btnW + gap;
    });

    const totalContentHeight = (currentY + rowHeight + boxPadding) - (-comp.height / 2);

    return { buttons, totalContentHeight, maxButtonWidth };
}

const getOptionAtPosition = (comp, localX, localY, ctx) => {
    const layout = calculateOptionsLayout(comp, ctx);
    const scrollY = comp.scrollY || 0;
    
    for (let i = 0; i < layout.buttons.length; i++) {
        const btn = layout.buttons[i];
        const drawY = btn.y - scrollY;
        
        if (localX >= btn.x && localX <= btn.x + btn.w &&
            localY >= drawY && localY <= drawY + btn.h) {
            return { index: i, id: btn.id };
        }
    }
    return null;
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
            NextTrue: null,
            NextFalse: null,
            scenes: [],
            audio: sequenceAudio.value,
            options: [],
            Node_name: `Node ${popupNode.value.id}` 
        })
    }
}

const updateNodeOptionsInStatus = () => {
    if (!popupNode.value) return
    const status = Canvas_Status.value.find(s => s.index === popupNode.value.id)
    if (!status) return

    const scenes = nodeScenes.value || []
    if (scenes.length === 0) {
        status.options = []
        // Reset timeout properties if no scenes
        status.hasTimeLimit = false
        status.timeLimitDuration = 5
        status.timeoutAction = 'random'
        status.timeoutTargetId = null
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

        // --- NEW: SAVE TIMEOUT PROPERTIES TO CANVAS STATUS ---
        status.hasTimeLimit = optionsComp.hasTimeLimit || false
        status.timeLimitDuration = optionsComp.timeLimitDuration || 5
        status.timeoutAction = optionsComp.timeoutAction || 'random'
        status.timeoutTargetId = optionsComp.timeoutTargetId || null
        // -----------------------------------------------------

    } else {
        status.options = []
        status.hasTimeLimit = false
    }
    
    draw() 
}

/* ================= SCENES MANAGEMENT ================= */
const nodeScenes = ref([]) 
const hoveredSceneId = ref(null) 
const selectedScene = ref(null) 
const viewMode = ref('scenes') 


/* ================= CONSTANT UPDATE WATCHERS ================= */
watch(sequenceAudio, () => {
    updateNodeAudioInStatus()
}, { deep: true })

watch(sceneComponents, (newVal) => {
    if (selectedScene.value) {
        const idx = nodeScenes.value.findIndex(s => s.id === selectedScene.value.id)
        if (idx !== -1) {
            nodeScenes.value[idx].components = [...newVal]
        }
    }
}, { deep: true })

watch(nodeScenes, () => {
    updateNodeScenesInStatus()
    updateNodeOptionsInStatus() 
}, { deep: true })

/* ================= ADD DROPDOWN ================= */
const showAddDropdown = ref(false)
const addDropdownOptions = [
  { id: 'image', label: 'Image', colorClass: 'hover-green' },
  { id: 'text', label: 'Text', colorClass: 'hover-blue' },
  { id: 'video', label: 'Video', colorClass: 'hover-yellow' },
  { id: 'input', label: 'Input Box', colorClass: 'hover-purple' },
  { id: 'variable', label: 'Variable', colorClass: 'hover-orange' }, // NEW VARIABLE OPTION
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
  } else if (option.id === 'input') {
    addInputComponent() 
  } else if (option.id === 'variable') {
    addVariableComponent() // NEW HANDLER
  }
  showAddDropdown.value = false
}

const closeAddDropdown = () => {
  showAddDropdown.value = false
}

/* ================= VARIABLE DISPLAY HANDLING ================= */
const addVariableComponent = () => {
    const newVar = {
        id: Date.now(),
        type: 'variable',
        name: 'New Variable Display',
        x: 0,
        y: 0,
        width: 150,
        height: 40,
        rotation: 0,
        
        variableId: '', // ID of the global variable to display
        
        // Styles similar to text
        fontSize: 24,
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
        fontStyle: 'normal',
        textDecoration: 'none',
        textDecorationColor: '#ffffff',
        textDecorationStyle: 'solid',
        color: '#ffffff',
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 0,
        
        renderWhileClicked: true,
        autoRender: false,
        animationType: 'fade', 
        animationDuration: 1.0 
    }
    
    // Insert before options if exists
    const optionsIndex = sceneComponents.value.findIndex(c => c.type === 'options');
    if (optionsIndex !== -1) {
        sceneComponents.value.splice(optionsIndex, 0, newVar);
    } else {
        sceneComponents.value.push(newVar);
    }
    
    updateSceneContentDisplay()
    drawComponents()
}

/* ================= INPUT BOX HANDLING ================= */
const addInputComponent = () => {
    const newInput = {
        id: Date.now(),
        type: 'input',
        name: 'Input Box',
        x: 0,
        y: 0,
        width: 300,
        height: 50,
        rotation: 0,
        
        backgroundColor: '#ffffff',
        borderColor: '#9ca3af',
        borderRadius: 4,
        borderWidth: 1,
        textColor: '#000000',
        
        fontFamily: 'sans-serif',
        fontSize: 16,
        fontWeight: 'normal',
        fontStyle: 'normal',
        placeholderText: 'Type your answer...',
        
        focusBackgroundColor: '#ffffff',
        focusBorderColor: '#00ff88',
        
        buttonText: 'Submit',
        buttonSubmittedText: 'Sent',
        buttonNormalColor: '#3b82f6',
        buttonHoverColor: '#2563eb',
        buttonClickColor: '#1d4ed8',
        buttonTextColor: '#ffffff',
        
        targetVariableId: '', 
        currentValue: '', 
        isSubmitted: false, 
        
        renderWhileClicked: true,
        autoRender: false,
        animationType: 'fade',
        animationDuration: 1.0
    }
    
    const optionsIndex = sceneComponents.value.findIndex(c => c.type === 'options');
    if (optionsIndex !== -1) {
        sceneComponents.value.splice(optionsIndex, 0, newInput);
    } else {
        sceneComponents.value.push(newInput);
    }
    
    updateSceneContentDisplay()
    drawComponents()
}

const handleInputSubmit = (comp) => {
    if (comp.isSubmitted) return;
    
    // FIX: Use loose equality (==) to match String IDs from DB with Number IDs in state
    const targetVar = globalVariables.value.find(v => v.id == comp.targetVariableId);
    let val = comp.currentValue;

    // Type Check
    if (targetVar) {
        if (targetVar.type === 'integer') {
            if (val === '' || val === null || val === undefined || isNaN(Number(val))) {
                alert("Please enter a valid number.");
                return;
            }
            val = Number(val);
        }
        // Assign to Global State
        targetVar.value = val;
        
        console.log(`Variable '${targetVar.name}' assigned value:`, val);
    } else {
        console.log("Input submitted but no variable assigned. Value:", val);
    }

    // Update Component State
    comp.isSubmitted = true;
    
    // Advance Sequence
    advancePreview();
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
        
        boxColor: '#1f2937',      
        boxOpacity: 0.8,          
        borderColor: '#f87171',   
        borderWidth: 0,           
        borderRadius: 8,          
        
        hasTimeLimit: false,
        timeLimitDuration: 5.0,
        timeoutAction: 'random',
        timeoutTargetId: null,

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
        _timerTriggered: false,
        renderWhileClicked: true,
        autoRender: false,
        scrollY: 0, 
        animationType: 'fade', 
        animationDuration: 1.0,
        // --- NEW EXIT DEFAULTS ---
        exitAnimationType: 'fade',
        exitAnimationDuration: 0.5 
    }
    sceneComponents.value.push(newOption)
    updateSceneContentDisplay()
    drawComponents()
}

const addOptionToComponent = () => {
    if(!activeComponent.value || activeComponent.value.type !== 'options') return;
    const newId = activeComponent.value.optionsList.length > 0 
        ? Math.max(...activeComponent.value.optionsList.map(o => o.id)) + 1 
        : 1;
    activeComponent.value.optionsList.push({ id: newId, text: `Option ${newId}` });
    drawComponents();
}

const removeOptionFromComponent = (index) => {
    if(!activeComponent.value || activeComponent.value.type !== 'options') return;
    if (activeComponent.value.optionsList.length <= 2) {
        alert("An Options component must have at least two options.");
        return;
    }
    activeComponent.value.optionsList.splice(index, 1);
    drawComponents();
}

// --- PASTE THE NEW FUNCTION HERE ---
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
    animationType: 'fade', 
    animationDuration: 1.0,
    // --- NEW EXIT DEFAULTS ---
    exitAnimationType: 'fade', 
    exitAnimationDuration: 0.5 
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
    if (!activeComponent.value || (activeComponent.value.type !== 'text' && activeComponent.value.type !== 'input' && activeComponent.value.type !== 'variable')) return
    
    // Logic for Input and Variable components (they just use simple properties)
    if (activeComponent.value.type === 'input' || activeComponent.value.type === 'variable') {
        if (styleType === 'bold') {
            activeComponent.value.fontWeight = activeComponent.value.fontWeight === 'bold' ? 'normal' : 'bold'
        } else if (styleType === 'italic') {
            activeComponent.value.fontStyle = activeComponent.value.fontStyle === 'italic' ? 'normal' : 'italic'
        }
        // Variable also supports underline/strikethrough via simple property
        if (activeComponent.value.type === 'variable') {
            if (styleType === 'underline') {
                activeComponent.value.textDecoration = activeComponent.value.textDecoration === 'underline' ? 'none' : 'underline';
            } else if (styleType === 'strikethrough') {
                activeComponent.value.textDecoration = activeComponent.value.textDecoration === 'line-through' ? 'none' : 'line-through';
            }
        }
        return;
    }

    // Default Text Logic
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

const updateSceneContentDisplay = () => {
  nextTick(() => {
    const contentBody = document.querySelector('.scene-content-body')
    if (contentBody) {
        contentBody.innerHTML = ''
        
        if (sceneComponents.value.length > 0) {
            sceneComponents.value.forEach((comp, index) => {
                const imageContainer = document.createElement('div')
                imageContainer.className = 'image-container'
                imageContainer.dataset.index = index
                
                // Add Double Click Listener explicitly
                imageContainer.addEventListener('dblclick', (e) => {
                    e.stopPropagation(); // Prevent bubbling issues
                    openComponentEditor(comp);
                })
                
                imageContainer.addEventListener('click', () => {
                    document.querySelectorAll('.image-container').forEach(container => {
                        container.classList.remove('selected')
                    })
                    imageContainer.classList.add('selected')
                })

                if (comp.type !== 'options') {
                    imageContainer.draggable = true 
                }
                
                const indicator = document.createElement('div')
                indicator.className = 'type-indicator'
                if (comp.type === 'image') indicator.classList.add('bg-green')
                else if (comp.type === 'text') indicator.classList.add('bg-blue')
                else if (comp.type === 'video') indicator.classList.add('bg-yellow')
                else if (comp.type === 'options') indicator.classList.add('bg-red') 
                
                // Drag Handle (Only for non-options)
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
                    e.stopPropagation() // Vital: Stop click from triggering selection
                    confirmRemoveComponent(index)
                })
                
                imageContainer.appendChild(indicator)
                imageContainer.appendChild(imgIconDiv) 
                imageContainer.appendChild(imageName)  
                imageContainer.appendChild(removeBtn)  

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
                            // Reorder Components
                            const item = sceneComponents.value.splice(dragSourceIndex, 1)[0]
                            sceneComponents.value.splice(index, 0, item)
                            
                            // Enforce Options at end logic
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
  const mouseX = event.clientX; const mouseY = event.clientY
  
  if (mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom) {
    const coords = screenToGraphCoords(mouseX, mouseY)
    let clickedComp = null
    for (let i = sceneComponents.value.length - 1; i >= 0; i--) {
      const comp = sceneComponents.value[i]
      if(coords.x >= comp.x - comp.width/2 && coords.x <= comp.x + comp.width/2 &&
         coords.y <= comp.y + comp.height/2 && coords.y >= comp.y - comp.height/2) {
          
        clickedComp = comp
        
        if (comp.type === 'options' && comp.optionsList) {
             const dx = coords.x - comp.x;
             const dy = coords.y - comp.y;
             const rad = -(comp.rotation || 0) * Math.PI / 180;
             const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
             const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
             
             const hit = getOptionAtPosition(comp, localX, -localY, imagesCtx);
             if (hit) {
                comp._clickedOptionIndex = hit.index;
                drawComponents();
                setTimeout(() => { comp._clickedOptionIndex = -1; drawComponents(); }, 150);
             }
        }

        isDraggingComponent.value = true; draggingComponentIndex.value = i
        dragComponentOffset.value = { x: coords.x - comp.x, y: coords.y - comp.y }
        if (viewMode.value === 'componentEditor') {
            activeComponent.value = clickedComp; textSelection.value = { start: 0, end: 0, text: '' }
            if (activeComponent.value.type === 'options') activeStyleState.value = 'normal';
        }
        drawComponents()
        return
      }
    }
  }
}

const onGraphMouseMove = (event) => {
  if (!imagesCanvasRef.value) return
  const rect = imagesCanvasRef.value.getBoundingClientRect()
  const mouseX = event.clientX; const mouseY = event.clientY
  
  if (mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom) {
    const coords = screenToGraphCoords(mouseX, mouseY)
    let needsRedraw = false;
    
    sceneComponents.value.forEach(comp => {
        if (comp.type === 'options') {
             const dx = coords.x - comp.x;
             const dy = coords.y - comp.y;
             const rad = -(comp.rotation || 0) * Math.PI / 180;
             const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
             const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
             
             const hit = getOptionAtPosition(comp, localX, -localY, imagesCtx);
             
             if (hit) {
                 if (comp._hoveredOptionIndex !== hit.index) {
                     comp._hoveredOptionIndex = hit.index;
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
    console.log("Attempting to open editor for:", comp.type, comp.id);
    
    // Safety check for Options component to prevent template render crash
    if (comp.type === 'options') {
        if (!comp.styles) {
             console.warn("Options component detected with missing styles. repairing...");
             const defaultBtnStyle = {
                backgroundColor: '#374151',
                color: '#ffffff',
                borderColor: '#9ca3af',
                borderWidth: 1,
                borderRadius: 4,
                fontSize: 16,
                fontFamily: 'sans-serif'
            };
            comp.styles = {
                normal: { ...defaultBtnStyle },
                hovered: { ...defaultBtnStyle, backgroundColor: '#4b5563', borderColor: '#00ff88' },
                clicked: { ...defaultBtnStyle, backgroundColor: '#1f2937', borderColor: '#00ff88', borderWidth: 2 }
            };
        }
        activeStyleState.value = 'normal';
    }

    activeComponent.value = comp
    viewMode.value = 'componentEditor'
    textSelection.value = { start: 0, end: 0, text: '' } 
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
        
        if (activeComponent.value.type === 'options' && imagesCtx) {
            const layout = calculateOptionsLayout(activeComponent.value, imagesCtx);
            const minW = layout.maxButtonWidth + 20; 
            if (activeComponent.value.width < minW) {
                activeComponent.value.width = minW;
            }
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
  
  // 1. Reset Editor State Defaults
  setVarId.value = ""
  setVarOperator.value = "="
  setVarValueType.value = "constant"
  setVarValue.value = ""
  setVarStringPrefix.value = ""
  setVarStringSuffix.value = ""

  ifElseVarId.value = ""
  ifElseOperator.value = "=="
  ifElseValueType.value = "constant"
  ifElseValue.value = ""
  
  // 2. Reset Scene State
  selectedScene.value = null
  sceneComponents.value = [] 
  sceneSettings.value.backgroundColor = '#000000' 
  activeComponent.value = null 
  
  const nodeStatus = Canvas_Status.value.find(s => s.index === node.id)

  if (nodeStatus) {
    // Ensure Name exists
    if (!nodeStatus.Node_name) {
      nodeStatus.Node_name = `Node ${node.id}`
    }
    editingNodeName.value = nodeStatus.Node_name

    // --- LOGIC: SET VARIABLES ---
    if (nodeStatus.node_type === 'Set Variables') {
         viewMode.value = 'setVariables'
         setVarId.value = nodeStatus.varId || ""
         setVarOperator.value = nodeStatus.varOperator || "="
         setVarValueType.value = nodeStatus.varValueType || "constant"
         setVarValue.value = nodeStatus.varValue || ""
         setVarStringPrefix.value = nodeStatus.stringPrefix || ""
         setVarStringSuffix.value = nodeStatus.stringSuffix || ""
    } 
    // --- LOGIC: IF-ELSE (FIXED) ---
    else if (nodeStatus.node_type === 'If-Else') {
         viewMode.value = 'ifElse'
         ifElseVarId.value = nodeStatus.varId || ""
         ifElseOperator.value = nodeStatus.operator || "=="
         ifElseValueType.value = nodeStatus.compareValueType || "constant"
         ifElseValue.value = nodeStatus.compareValue || ""
    } 
    // --- GENERAL SCENES ---
    else {
         viewMode.value = 'scenes'
         if (nodeStatus.scenes) {
            nodeScenes.value = nodeStatus.scenes.map(s => ({
                ...s,
                components: s.components ? [...s.components] : [] 
            }))
            
            nodeScenes.value.forEach((scene, index) => {
                if (!scene.name) scene.name = `Scene ${scene.id}`
                if (!scene.backgroundColor) scene.backgroundColor = '#000000'
            })
         } else {
            nodeScenes.value = []
         }
    }

    // Load Audio
    if (nodeStatus.audio) {
        sequenceAudio.value = { ...nodeStatus.audio }
    } else {
        sequenceAudio.value = null
    }

  } else {
    // New/Empty Node
    editingNodeName.value = `Node ${node.id}`
    nodeScenes.value = []
    sequenceAudio.value = null
    viewMode.value = 'scenes'
  }
  
  showPopup.value = true
  nextTick(() => {
    popupAnimation.value = true
    if (viewMode.value === 'scenes' || viewMode.value === 'sceneDetails') {
        setTimeout(initializeGraphCanvas, 50)
    }
  })
}

// Animation Loop
const startRenderLoop = () => {
  if (animationFrameId) return; 

  const loop = () => {
    if (!showPopup.value && !isPreviewMode.value) {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId)
            animationFrameId = null
        }
        return
    }

    if (showPopup.value) {
        drawComponents()
    }
    if (isPreviewMode.value) {
        drawPreview()
        checkAudioDucking()
        checkOptionsTimeout() // <--- ADD THIS LINE
    }
    animationFrameId = requestAnimationFrame(loop)
  }
  loop()
}

const closePopup = () => {
  if (selectedScene.value) {
    updateSceneDetails()
  }
  
  if (popupNode.value) {
      const status = Canvas_Status.value.find(s => s.index === popupNode.value.id)
      if (status && status.node_type === 'Set Variables') {
          status.varId = setVarId.value
          status.varOperator = setVarOperator.value
          status.varValueType = setVarValueType.value
          status.varValue = setVarValue.value
      }
  }
  if (popupNode.value) {
      const status = Canvas_Status.value.find(s => s.index === popupNode.value.id)
      if (status && status.node_type === 'Set Variables') {
          status.varId = setVarId.value
          status.varOperator = setVarOperator.value
          status.varValueType = setVarValueType.value
          status.varValue = setVarValue.value
          // Save new fields
          status.stringPrefix = setVarStringPrefix.value
          status.stringSuffix = setVarStringSuffix.value
      }
    }
    if (popupNode.value) {
      const status = Canvas_Status.value.find(s => s.index === popupNode.value.id)
      
      if (status && status.node_type === 'Set Variables') {
          // ... (existing Set Var save logic)
      } 
      else if (status && status.node_type === 'If-Else') {
          status.varId = ifElseVarId.value
          status.operator = ifElseOperator.value
          status.compareValueType = ifElseValueType.value
          status.compareValue = ifElseValue.value
      }
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
    // --- IMAGE COMPONENT ---
    if (comp.type === 'image') {
        // Check if image exists AND is loaded
        if (comp.imgObject && comp.imgObject.complete && comp.imgObject.naturalWidth > 0) {
            ctx.drawImage(comp.imgObject, screenPos.x - (comp.width / 2), screenPos.y - (comp.height / 2), comp.width, comp.height)
        } 
        else if (!comp.imgObject) {
            // FALLBACK: If imgObject is missing, create it WITH CORS
            const img = new Image(); 
            img.crossOrigin = "Anonymous"; // <--- ADD THIS
            img.src = comp.url; 
            img.onload = () => { if(selectedScene.value) drawComponents(); } // Force redraw
            comp.imgObject = img;
        }
    }
    // --- VIDEO COMPONENT ---
    else if (comp.type === 'video') {
         if (comp.videoElement) {
             ctx.drawImage(comp.videoElement, screenPos.x - (comp.width / 2), screenPos.y - (comp.height / 2), comp.width, comp.height)
         }
    } 
    // --- TEXT COMPONENT (UPDATED FOR WRAPPING) ---
    else if (comp.type === 'text') {
        ctx.translate(screenPos.x, screenPos.y) 
        
        // 1. Draw Background
        if (comp.backgroundColor && comp.backgroundColor !== 'transparent') {
            ctx.fillStyle = comp.backgroundColor
            if (comp.borderRadius > 0) { drawRoundedRectPaths(ctx, -(comp.width/2), -(comp.height/2), comp.width, comp.height, comp.borderRadius); ctx.fill() } 
            else { ctx.fillRect(-(comp.width/2), -(comp.height/2), comp.width, comp.height) }
        }
        
        // 2. Draw Border
        if (comp.borderWidth > 0 && comp.borderColor !== 'transparent') {
            ctx.strokeStyle = comp.borderColor; ctx.lineWidth = comp.borderWidth
            if (comp.borderRadius > 0) { drawRoundedRectPaths(ctx, -(comp.width/2), -(comp.height/2), comp.width, comp.height, comp.borderRadius); ctx.stroke() } 
            else { ctx.strokeRect(-(comp.width/2), -(comp.height/2), comp.width, comp.height) }
        }

        // 3. Setup Font
        const fontWeight = comp.fontWeight || 'normal'; 
        const fontStyle = comp.fontStyle || 'normal'; 
        const fontFamily = comp.fontFamily || 'sans-serif';
        const fontSize = comp.fontSize || 24;
        
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`; 
        ctx.fillStyle = comp.color; 
        ctx.textAlign = 'center'; 
        ctx.textBaseline = 'middle';

        // 4. Handle Content & Animation
        let contentToDraw = comp.content || "";
        if (animationOverride && animationOverride.type === 'typewriter') {
            const progress = animationOverride.progress; 
            const length = Math.floor(comp.content.length * progress); 
            contentToDraw = comp.content.substring(0, length);
        }

        // 5. Text Wrapping Logic
        const maxWidth = Math.max(10, comp.width - 20); // 10px padding on sides
        const lineHeight = fontSize * 1.2;
        const paragraphs = contentToDraw.split('\n');
        let lines = [];
        
        paragraphs.forEach(paragraph => {
             const words = paragraph.split(' ');
             let currentLine = words[0] || '';
             
             for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx.measureText(currentLine + " " + word).width;
                if (width < maxWidth) {
                    currentLine += " " + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
             }
             lines.push(currentLine);
        });

        // 6. Draw Lines Centered Vertically
        const totalTextHeight = lines.length * lineHeight;
        let currentY = -(totalTextHeight / 2) + (lineHeight / 2);

        lines.forEach(line => {
            ctx.fillText(line, 0, currentY);

            // Handle Text Decoration (Underline/Strikethrough) per line
            if (comp.textDecoration === 'underline' || comp.textDecoration === 'line-through') {
                 const metrics = ctx.measureText(line); 
                 const lineWidth = metrics.width;
                 
                 ctx.beginPath(); 
                 ctx.strokeStyle = comp.textDecorationColor || comp.color; 
                 ctx.lineWidth = fontSize / 15;
                 
                 let decorY = currentY;
                 if (comp.textDecoration === 'underline') {
                     decorY += fontSize * 0.4; 
                 } 
                 
                 ctx.moveTo(-lineWidth/2, decorY); 
                 ctx.lineTo(lineWidth/2, decorY); 
                 ctx.stroke();
            }
            
            currentY += lineHeight;
        });

        ctx.translate(-screenPos.x, -screenPos.y)
    } 
    // --- VARIABLE COMPONENT ---
    else if (comp.type === 'variable') {
        ctx.translate(screenPos.x, screenPos.y) 
        if (comp.backgroundColor && comp.backgroundColor !== 'transparent') {
            ctx.fillStyle = comp.backgroundColor
            if (comp.borderRadius > 0) { drawRoundedRectPaths(ctx, -(comp.width/2), -(comp.height/2), comp.width, comp.height, comp.borderRadius); ctx.fill() } 
            else { ctx.fillRect(-(comp.width/2), -(comp.height/2), comp.width, comp.height) }
        }
        if (comp.borderWidth > 0 && comp.borderColor !== 'transparent') {
            ctx.strokeStyle = comp.borderColor; ctx.lineWidth = comp.borderWidth
            if (comp.borderRadius > 0) { drawRoundedRectPaths(ctx, -(comp.width/2), -(comp.height/2), comp.width, comp.height, comp.borderRadius); ctx.stroke() } 
            else { ctx.strokeRect(-(comp.width/2), -(comp.height/2), comp.width, comp.height) }
        }
        const fontWeight = comp.fontWeight || 'normal'; const fontStyle = comp.fontStyle || 'normal'; const fontFamily = comp.fontFamily || 'sans-serif'
        ctx.font = `${fontStyle} ${fontWeight} ${comp.fontSize}px ${fontFamily}`; ctx.fillStyle = comp.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        
        // FIX: Use loose equality (==) here
        const targetVar = globalVariables.value.find(v => v.id == comp.variableId);
        
        let contentToDraw = targetVar ? String(targetVar.value) : (isPreviewMode.value ? "" : "{Variable}");
        if (animationOverride && animationOverride.type === 'typewriter') {
            const progress = animationOverride.progress; const length = Math.floor(contentToDraw.length * progress); contentToDraw = contentToDraw.substring(0, length)
        }
        ctx.fillText(contentToDraw, 0, 0)
        if (comp.textDecoration === 'underline' || comp.textDecoration === 'line-through') {
             const metrics = ctx.measureText(contentToDraw); const width = metrics.width
             ctx.beginPath(); ctx.strokeStyle = comp.textDecorationColor || comp.color; ctx.lineWidth = comp.fontSize / 15
             const yOffset = comp.textDecoration === 'underline' ? comp.fontSize/2 : 0; ctx.moveTo(-width/2, yOffset); ctx.lineTo(width/2, yOffset); ctx.stroke()
        }
        ctx.translate(-screenPos.x, -screenPos.y)
    }
    // --- INPUT COMPONENT ---
    else if (comp.type === 'input') {
        ctx.translate(screenPos.x, screenPos.y)
        if (comp.backgroundColor && comp.backgroundColor !== 'transparent') {
            ctx.fillStyle = comp.backgroundColor
            drawRoundedRectPaths(ctx, -(comp.width/2), -(comp.height/2), comp.width, comp.height, comp.borderRadius);
            ctx.fill();
        }
        if (comp.borderWidth > 0 && comp.borderColor !== 'transparent') {
            ctx.strokeStyle = comp.borderColor;
            ctx.lineWidth = comp.borderWidth;
            ctx.setLineDash([]);
            drawRoundedRectPaths(ctx, -(comp.width/2), -(comp.height/2), comp.width, comp.height, comp.borderRadius);
            ctx.stroke();
        }
        ctx.font = `${comp.fontStyle} ${comp.fontWeight} ${comp.fontSize}px ${comp.fontFamily}`;
        ctx.fillStyle = '#ccc';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(comp.placeholderText || "Type here...", -(comp.width/2) + 10, 0);
        ctx.font = `bold 14px sans-serif`;
        const btnTextWidth = ctx.measureText(comp.buttonText).width;
        const btnWidth = Math.max(60, btnTextWidth + 30); 
        const btnX = (comp.width/2) - btnWidth;
        const btnY = -(comp.height/2);
        ctx.fillStyle = comp.buttonNormalColor;
        ctx.fillRect(btnX, btnY, btnWidth, comp.height);
        ctx.fillStyle = comp.buttonTextColor;
        ctx.textAlign = 'center';
        ctx.fillText(comp.buttonText, btnX + btnWidth/2, 0);
        ctx.translate(-screenPos.x, -screenPos.y)
    }
    // --- OPTIONS COMPONENT ---
    else if (comp.type === 'options') {
        ctx.translate(screenPos.x, screenPos.y) 
        
        // Setup Exit Animation Variables
        const isExiting = animationOverride?.isExiting || false;
        const exitProgress = animationOverride?.exitProgress || 0;
        
        // Box Opacity
        const boxBaseOpacity = (comp.boxOpacity !== undefined) ? comp.boxOpacity : 0.8;
        const currentBoxOpacity = isExiting ? (boxBaseOpacity * (1 - exitProgress)) : boxBaseOpacity;

        const layout = calculateOptionsLayout(comp, ctx);
        const radius = comp.borderRadius !== undefined ? comp.borderRadius : 8;
        
        // Background
        if (comp.boxColor && currentBoxOpacity > 0) {
            ctx.fillStyle = hexToRgba(comp.boxColor, currentBoxOpacity);
            drawRoundedRectPaths(ctx, -(comp.width/2), -(comp.height/2), comp.width, comp.height, radius);
            ctx.fill();
        }
        
        // Border
        if (comp.borderWidth > 0 && comp.borderColor) {
            ctx.globalAlpha = isExiting ? (1 - exitProgress) : 1; 
            ctx.strokeStyle = comp.borderColor;
            ctx.lineWidth = comp.borderWidth;
            ctx.setLineDash([]); 
            drawRoundedRectPaths(ctx, -(comp.width/2), -(comp.height/2), comp.width, comp.height, radius);
            ctx.stroke();
            ctx.globalAlpha = 1; 
        } else if (!isPreviewMode.value) {
            if (!comp.boxOpacity || comp.boxOpacity === 0) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                drawRoundedRectPaths(ctx, -(comp.width/2), -(comp.height/2), comp.width, comp.height, radius);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // Time Limit Bar
        if (comp.hasTimeLimit && !isExiting) {
            let progress = 1.0;
            if (isPreviewMode.value) {
                const now = Date.now();
                const elapsed = (now - componentStartTime.value) / 1000; 
                const duration = comp.timeLimitDuration || 5;
                progress = 1.0 - (elapsed / duration);
                if (progress < 0) progress = 0;
            }
            if (progress > 0) {
                const barHeight = 6;
                const totalW = comp.width;
                const currentW = totalW * progress;
                const barX = -(comp.width / 2);
                const barY = -(comp.height / 2) - barHeight - 4; 
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fillRect(barX, barY, totalW, barHeight);
                if (progress > 0.5) ctx.fillStyle = '#00ff88'; 
                else if (progress > 0.2) ctx.fillStyle = '#eab308'; 
                else ctx.fillStyle = '#ef4444'; 
                ctx.fillRect(barX, barY, currentW, barHeight);
            }
        }

        ctx.save();
        drawRoundedRectPaths(ctx, -(comp.width/2), -(comp.height/2), comp.width, comp.height, radius);
        ctx.clip();

        if (layout.buttons.length > 0) {
            layout.buttons.forEach((btn, index) => {
                const drawY = btn.y - (comp.scrollY || 0);
                let style = comp.styles.normal;
                const isSelected = (comp._clickedOptionIndex === index);

                if (isSelected) style = comp.styles.clicked;
                else if (comp._hoveredOptionIndex === index && !isExiting) style = comp.styles.hovered;
                
                let buttonAlpha = 1.0;
                
                if (isExiting) {
                    if (isSelected) {
                         let delayedProgress = (exitProgress - 0.3) / 0.7;
                         if (delayedProgress < 0) delayedProgress = 0;
                         buttonAlpha = 1.0 - delayedProgress;
                    } else {
                        buttonAlpha = 1.0 - (exitProgress * 1.5);
                    }
                    if (buttonAlpha < 0) buttonAlpha = 0;
                }
                
                ctx.globalAlpha = buttonAlpha;

                if (style.backgroundColor && style.backgroundColor !== 'transparent') {
                    ctx.fillStyle = style.backgroundColor;
                    drawRoundedRectPaths(ctx, btn.x, drawY, btn.w, btn.h, style.borderRadius);
                    ctx.fill();
                }
                
                if (style.borderWidth > 0 && style.borderColor && style.borderColor !== 'transparent') {
                    ctx.strokeStyle = style.borderColor;
                    ctx.lineWidth = style.borderWidth;
                    drawRoundedRectPaths(ctx, btn.x, drawY, btn.w, btn.h, style.borderRadius);
                    ctx.stroke();
                }
                
                ctx.fillStyle = style.color;
                ctx.font = `${style.fontSize}px ${style.fontFamily || 'sans-serif'}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(btn.text, btn.x + (btn.w/2), drawY + (btn.h/2));
                
                ctx.globalAlpha = 1.0; 
            });
        }
        
        if (layout.totalContentHeight > comp.height && !isExiting) {
            const scrollBarW = 4;
            const scrollRatio = comp.height / layout.totalContentHeight;
            const thumbH = Math.max(20, comp.height * scrollRatio);
            const thumbY = -comp.height/2 + ((comp.scrollY || 0) / layout.totalContentHeight) * comp.height;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(comp.width/2 - 6, thumbY, scrollBarW, thumbH);
        }

        ctx.restore(); 
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

const checkOptionsTimeout = () => {
    if (!isPreviewMode.value || !nodeScenes.value) return;

    const scene = nodeScenes.value[currentPreviewSceneIndex.value];
    if (!scene || !scene.components) return;

    // Check if current component is Options
    if (currentPreviewComponentIndex.value >= 0 && currentPreviewComponentIndex.value < scene.components.length) {
        const comp = scene.components[currentPreviewComponentIndex.value];
        
        if (comp.type === 'options' && comp.hasTimeLimit) {

            // FIX: Check runtime flag instead of modifying permanent setting
            if (comp._timerTriggered) return;

            const now = Date.now();
            const elapsed = (now - componentStartTime.value) / 1000;
            const duration = comp.timeLimitDuration || 5;

            // Trigger Timeout
            if (elapsed >= duration) {
                console.log("Time limit reached for options!");
                
                // FIX: Set runtime flag to prevent loop
                comp._timerTriggered = true; 
                
                let targetOptionId = null;

                if (comp.timeoutAction === 'random') {
                    if (comp.optionsList.length > 0) {
                        const randomIndex = Math.floor(Math.random() * comp.optionsList.length);
                        targetOptionId = comp.optionsList[randomIndex].id;
                    }
                } else if (comp.timeoutAction === 'manual') {
                    if (comp.timeoutTargetId) {
                        targetOptionId = comp.timeoutTargetId;
                    } else {
                        // Fallback if manual ID is invalid/deleted: pick first
                        if (comp.optionsList.length > 0) targetOptionId = comp.optionsList[0].id;
                    }
                }

                if (targetOptionId) {
                    handleOptionNavigation(comp.id, targetOptionId);
                } else {
                    exitPreview(); // Fail safe
                }
            }
        }
    }
}

const drawFocusRing = (ctx, comp, index, screenPos) => {
      const isActive = (activeComponent.value && activeComponent.value.id === comp.id)
      const isDragging = (isDraggingComponent.value && draggingComponentIndex.value === index)

      if ((isActive || isDragging) && !isPreviewMode.value) {
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
  // Watcher updates Status
  selectScene(newScene)
}

const deleteScene = (sceneId) => {
  if (selectedScene.value && selectedScene.value.id === sceneId) {
    viewMode.value = 'scenes'
    selectedScene.value = null
  }
  
  nodeScenes.value = nodeScenes.value.filter(scene => scene.id !== sceneId)
  
  // Re-index scenes for clean display
  nodeScenes.value.forEach((scene, index) => {
    scene.id = index + 1
    if (!scene.name || scene.name.startsWith('Scene ')) {
      scene.name = `Scene ${index + 1}`
    }
  })
  
  // Watcher updates Status
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
  
  // Load components for this scene into editing ref
  // Important: We need deep copy here to allow editing without affecting source until updated
  // But wait! We added a watcher on sceneComponents. 
  // If we just copy here, the watcher will trigger and save back to nodeScenes immediately.
  sceneComponents.value = scene.components ? [...scene.components] : [] 
  
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
  // Data is already synced via watchers, just change view
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
    // Data is synced via watchers
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
    // Update local scene metadata
    nodeScenes.value[index] = { 
      ...nodeScenes.value[index], // preserve components
      name: selectedScene.value.name,
      backgroundColor: sceneSettings.value.backgroundColor
    }
    // Watcher triggers updateNodeScenesInStatus
  }
}

const updateNodeScenesInStatus = () => {
  if (!popupNode.value) return
  const nodeStatusIndex = Canvas_Status.value.findIndex(s => s.index === popupNode.value.id)
  if (nodeStatusIndex !== -1) {
    // Store deep copy of scenes into master status
    Canvas_Status.value[nodeStatusIndex].scenes = nodeScenes.value.map(scene => ({
      id: scene.id,
      name: scene.name,
      backgroundColor: scene.backgroundColor || '#000000',
      components: scene.components || [] 
    }))
    Canvas_Status.value[nodeStatusIndex].audio = sequenceAudio.value
  } else {
    // Create new if doesn't exist (though it should by now)
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
  
  if (status && status.node_type === 'If-Else') {
      const trueX = n.x + NODE_W / 2 - ARROW_OFFSET
      const trueY = n.y - 10
      const falseX = n.x + NODE_W / 2 - ARROW_OFFSET
      const falseY = n.y + 20
      
      if (Math.hypot(wx - trueX, wy - trueY) < ARROW_HIT_R) {
          return { node: n, side: "right-true", x: trueX, y: trueY }
      }
      if (Math.hypot(wx - falseX, wy - falseY) < ARROW_HIT_R) {
          return { node: n, side: "right-false", x: falseX, y: falseY }
      }
      
      // Still need left input
      const leftAy = n.y - NODE_H / 2 + HEADER_H / 2
      const leftAx = n.x - NODE_W / 2 + ARROW_OFFSET
      if (Math.hypot(wx - leftAx, wy - leftAy) < ARROW_HIT_R) return { node: n, side: "left", x: leftAx, y: leftAy }
      
      return null
  }

  // --- GENERAL NODE LOGIC ---
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

  } else if (status && status.node_type === 'Set Variables') {
      const rightAy = n.y - NODE_H / 2 + HEADER_H / 2
      const rightAx = n.x + NODE_W / 2 - ARROW_OFFSET
      if (Math.hypot(wx - rightAx, wy - rightAy) < ARROW_HIT_R) 
          return { node: n, side: "right", x: rightAx, y: rightAy }
          
      const leftAy = n.y - NODE_H / 2 + HEADER_H / 2
      const leftAx = n.x - NODE_W / 2 + ARROW_OFFSET
      if (Math.hypot(wx - leftAx, wy - leftAy) < ARROW_HIT_R) 
          return { node: n, side: "left", x: leftAx, y: leftAy }
  } else {
      const leftAy = n.y - NODE_H / 2 + HEADER_H / 2
      const leftAx = n.x - NODE_W / 2 + ARROW_OFFSET
      if (Math.hypot(wx - leftAx, wy - leftAy) < ARROW_HIT_R) 
          return { node: n, side: "left", x: leftAx, y: leftAy }
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
    
    const nodeType = status ? status.node_type : "General"
    if (nodeType === 'If-Else') {
         grad.addColorStop(0, "#eab308") 
         grad.addColorStop(1, "#000")
    } else if (nodeType === 'Set Variables') {
         grad.addColorStop(0, "#8b5cf6") 
         grad.addColorStop(1, "#000")
    } else {
         grad.addColorStop(0, "#ff2a2a") 
         grad.addColorStop(1, "#000")
    }
    
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
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("▷", leftAx, leftAy)
    
    if (nodeType === 'If-Else') {
         ctx.fillStyle = "#00ff88"
         ctx.font = "14px sans-serif"
         ctx.textAlign = "right"
         ctx.fillText("T", x + NODE_W / 2 - 25, y - 10)
         ctx.fillText("▷", x + NODE_W / 2 - ARROW_OFFSET, y - 10)

         ctx.fillStyle = "#ff2a2a"
         ctx.textAlign = "right"
         ctx.fillText("F", x + NODE_W / 2 - 25, y + 20)
         ctx.fillText("▷", x + NODE_W / 2 - ARROW_OFFSET, y + 20)
         
    } else if (nodeType === 'Set Variables') {
         const rightAy = y - currentH / 2 + HEADER_H / 2
         const rightAx = x + NODE_W / 2 - ARROW_OFFSET
         ctx.fillStyle = "#fff"
         ctx.font = "16px sans-serif"
         ctx.textAlign = "center"
         ctx.fillText("▷", rightAx, rightAy)
         
    } else if (hasOptions) {
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
    
    if (n.node_type === 'If-Else') {
        const fromNode = nodes.value.find(nd => nd.id === n.index)
        if (!fromNode) continue

        if (n.NextTrue != null) { 
            const toNode = nodes.value.find(nd => nd.id === n.NextTrue)
            if (toNode) {
                 const fromX = fromNode.x + NODE_W / 2 - ARROW_OFFSET
                 const fromY = fromNode.y - 10 
                 
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

        if (n.NextFalse != null) { 
            const toNode = nodes.value.find(nd => nd.id === n.NextFalse)
            if (toNode) {
                 const fromX = fromNode.x + NODE_W / 2 - ARROW_OFFSET
                 const fromY = fromNode.y + 20 
                 
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
        continue; 
    }
      
    if (n.options && n.options.length > 0) {
        const fromNode = nodes.value.find(nd => nd.id === n.index)
        if (fromNode) {
            const h = Math.max(NODE_H, HEADER_H + (n.options.length * OPTION_ROW_H) + 10);
            const startY = fromNode.y - h / 2 + HEADER_H + 20;

            n.options.forEach((opt, idx) => {
                if (opt.next != null) { 
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
        const fromY = fromNode.y - NODE_H / 2 + HEADER_H / 2 
        
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
  if (showContextMenu.value) {
      showContextMenu.value = false
      return 
  }

  const w = screenToWorld(e.clientX, e.clientY)
  hoveredArrow = null

  for (const n of nodes.value) {
    const hit = arrowHit(n, w.x, w.y)
    if (hit && (hit.side === "right" || hit.side === "right-true" || hit.side === "right-false")) {
      outputDragging = { 
          node: n, 
          fromX: hit.x, 
          fromY: hit.y,
          optionIndex: hit.optionIndex, 
          optionId: hit.optionId,
          type: hit.side 
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
          if (outputDragging.type === 'right-true') {
              cs.NextTrue = targetNode.id
          } else if (outputDragging.type === 'right-false') {
              cs.NextFalse = targetNode.id
          } else if (outputDragging.optionIndex !== undefined && cs.options) {
               const isDuplicate = cs.options.some((opt, idx) => 
                   idx !== outputDragging.optionIndex && opt.next === targetNode.id
               )

               if (isDuplicate) {
                   alert("Another option from this node is already connected to that target node.")
               } else {
                   if (cs.options[outputDragging.optionIndex]) {
                       cs.options[outputDragging.optionIndex].next = targetNode.id
                   }
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
    // --- FIX START: Calculate ID based on Max ID instead of Length ---
    const maxId = nodes.value.length > 0 ? Math.max(...nodes.value.map(n => n.id)) : -1
    const id = maxId + 1
    // --- FIX END ---

    const x = mouseWorld.x
    const y = mouseWorld.y
    nodes.value.push({ id, x, y })
    Canvas_Status.value.push({ 
      index: id, 
      x, 
      y, 
      node_type: draggedType, 
      Next: null,
      NextTrue: null, 
      NextFalse: null, 
      scenes: [],
      audio: null,
      options: [],
      Node_name: `${draggedType} Node ${id}` 
    })
    selectedNodeId.value = id
    menuDragging = false
    draggedType = "General" 
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
fetchProjectDetails()
loadProjectData();
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

  autoSaveInterval = setInterval(() => {
        if (hasUnsavedChanges.value) {
            if (autoSaveTimer.value > 0) {
                autoSaveTimer.value--;
            } else {
                // Timer reached 0, Trigger Auto-Save
                saveProjectData(true);
            }
        }
    }, 1000);
})

onBeforeUnmount(() => {
  window.removeEventListener("resize", resize)
  window.removeEventListener("mousemove", onMouseMove)
  window.removeEventListener("mouseup", onMouseUp)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  window.removeEventListener('resize', resize);
  window.removeEventListener('keydown', handleKeyDown);
  if (autoSaveInterval) clearInterval(autoSaveInterval);
  if (statusLogInterval) clearInterval(statusLogInterval);
})


watch(showPopup, (newVal) => {
  if (newVal) {
    nextTick(() => {
      setTimeout(initializeGraphCanvas, 100)
    })
  }
})

const resetComponentsRuntimeState = (scenes) => {
    scenes.forEach(scene => {
        if (scene.components) {
            scene.components.forEach(comp => {
                // Reset Input Component
                if (comp.type === 'input') {
                    comp.currentValue = '';
                    comp.isSubmitted = false;
                }
                // Reset Options Component
                if (comp.type === 'options') {
                    comp._hoveredOptionIndex = -1;
                    comp._clickedOptionIndex = -1;
                    comp._timerTriggered = false;
                }
                // Reset Video Component
                if (comp.type === 'video' && comp.videoElement) {
                    comp.videoElement.currentTime = 0;
                    comp._hasPlayedFull = false; // <--- NEW: Reset played status
                }
            })
        }
    })
}

/* ================= PREVIEW LOGIC ================= */
const startPreview = () => {
    if (nodeScenes.value.length === 0) {
        alert("No scenes to preview!")
        return
    }

    stopAllVideos();

    // --- FIX: Reset Component Runtime State (Inputs, etc.) ---
    resetComponentsRuntimeState(nodeScenes.value);

    isPreviewMode.value = true
    currentPreviewSceneIndex.value = 0
    currentPreviewComponentIndex.value = -1 
    
    // Reset timer logic
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
        
        const firstScene = nodeScenes.value[0]
        if (firstScene && firstScene.components && firstScene.components.length > 0) {
            if (firstScene.components[0].autoRender) {
                advancePreview()
            }
        }
    })
}

const initializePreviewCanvas = () => {
    if (!previewCanvasRef.value) return
    previewCtx = previewCanvasRef.value.getContext('2d')
    resizePreviewCanvas()
    drawPreview()
    // FIX 3: Ensure loop is running (safe due to the check in startRenderLoop)
    startRenderLoop() 
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
    // 1. If we are currently in an exit animation, do nothing until it finishes
    if (isSceneExiting.value) return;

    const currentScene = nodeScenes.value[currentPreviewSceneIndex.value]
    const components = currentScene.components || []
    
    // Block advance if Options or UN-SUBMITTED INPUT component is visible
    if (currentPreviewComponentIndex.value >= 0 && currentPreviewComponentIndex.value < components.length) {
         const currentComp = components[currentPreviewComponentIndex.value];
         if (currentComp.type === 'options') return; 
         if (currentComp.type === 'input' && !currentComp.isSubmitted) return;
    }

    // Animation Skip Check (Entrance Animation)
    if (currentPreviewComponentIndex.value >= 0 && currentPreviewComponentIndex.value < components.length) {
        const currentComp = components[currentPreviewComponentIndex.value]
        const now = Date.now()
        const duration = (currentComp.animationDuration || 1) * 1000
        const elapsed = now - componentStartTime.value
        
        if (elapsed < duration && currentComp.animationType !== 'none') {
            componentStartTime.value = now - duration - 100 
            return
        }
    }

    if (currentPreviewComponentIndex.value < components.length - 1) {
        // --- NEXT COMPONENT IN SAME SCENE ---
        currentPreviewComponentIndex.value++
        componentStartTime.value = Date.now()
        
        const comp = components[currentPreviewComponentIndex.value]
        
        if (comp.type === 'video' && comp.videoElement) {
             comp.videoElement.currentTime = 0;
             comp._hasPlayedFull = false; 
             
             // Reset listeners
             comp.videoElement.onended = null;
             comp.videoElement.ontimeupdate = null;
             
             // Flag to ensure auto-advance only triggers once per playback session
             let autoAdvanceTriggered = false;

             if (comp.isLoop) {
                 // --- LOOPING VIDEO LOGIC ---
                 // Detect loop by checking if time resets
                 let lastTime = 0;
                 comp.videoElement.ontimeupdate = () => {
                     const t = comp.videoElement.currentTime;
                     if (t < lastTime) { 
                         // Loop Detected (Video finished playing once)
                         comp._hasPlayedFull = true;
                         
                         // Requirement: "render it automatically once the video finishes playing once"
                         if (!autoAdvanceTriggered) {
                             autoAdvanceTriggered = true;
                             advancePreview();
                         }
                     }
                     lastTime = t;
                 };
             } else {
                 // --- NON-LOOPING VIDEO LOGIC ---
                 comp.videoElement.onended = () => { 
                     comp._hasPlayedFull = true; 
                     
                     // 1. If it's the LAST component -> Exit Scene Automatically
                     const isLastComp = currentPreviewComponentIndex.value >= components.length - 1;
                     
                     // 2. If it's NOT last -> Check if next component is Auto Render
                     const nextComp = !isLastComp ? components[currentPreviewComponentIndex.value + 1] : null;

                     if (isLastComp) {
                         advancePreview(); // Triggers End of Scene logic
                     } else if (nextComp && nextComp.autoRender) {
                         advancePreview(); // Triggers Next Component
                     }
                     // If neither (Middle component, manual render), we wait for user click.
                     // The click is enabled now because _hasPlayedFull is true.
                 };
             }

             comp.videoElement.play().catch(e => console.error("Auto-play prevented", e));
        } 
        else {
             // Standard Non-Video Component Logic
             const subsequentComp = components[currentPreviewComponentIndex.value + 1];
             if (subsequentComp && subsequentComp.autoRender) {
                 const animDuration = (comp.animationDuration || 1) * 1000
                 setTimeout(() => { advancePreview(); }, animDuration + 50); 
             }
        }

    } else {
        // --- END OF SCENE ---
        if (currentPreviewSceneIndex.value < nodeScenes.value.length - 1) {
            
            // CASE 1: SCENE TRANSITION ANIMATION
            // Determine max exit duration to wait
            let maxExitDuration = 0;
            components.forEach(c => {
                if (c.exitAnimationDuration && c.exitAnimationDuration > maxExitDuration) {
                    maxExitDuration = c.exitAnimationDuration;
                }
            });
            if (maxExitDuration === 0) maxExitDuration = 0.5; // default safety

            // Trigger Exit State
            isSceneExiting.value = true;
            sceneExitStartTime.value = Date.now();

            // Wait for exit, then swap scenes
            setTimeout(() => {
                stopVideosInScene(currentScene);
                currentPreviewSceneIndex.value++
                currentPreviewComponentIndex.value = -1 
                
                // Reset Exit State
                isSceneExiting.value = false;
                sceneExitStartTime.value = 0;
                
                const nextScene = nodeScenes.value[currentPreviewSceneIndex.value]
                if (nextScene.components && nextScene.components.length > 0) {
                     if (nextScene.components[0].autoRender) {
                         setTimeout(() => advancePreview(), 50)
                     }
                }
            }, maxExitDuration * 1000);

        } else {
            // End of sequence
            const lastComp = components[components.length-1];
            if (lastComp && (lastComp.type === 'options' || (lastComp.type === 'input' && !lastComp.isSubmitted))) {
                 // Do nothing, wait for user action
            } else {
                 exitPreview()
            }
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
            let entranceProgress = 1
            let exitProgress = 0
            
            // 1. Entrance Logic
            if (i === currentPreviewComponentIndex.value && !isSceneExiting.value) {
                const duration = (comp.animationDuration || 1) * 1000
                if (duration > 0) {
                    entranceProgress = (now - componentStartTime.value) / duration
                    if (entranceProgress > 1) entranceProgress = 1
                    if (entranceProgress < 0) entranceProgress = 0
                }
            }

            // 2. Exit Logic (Case 1 & Case 2)
            if (isSceneExiting.value) {
                const exitDur = (comp.exitAnimationDuration || 0.5) * 1000;
                exitProgress = (now - sceneExitStartTime.value) / exitDur;
                if (exitProgress > 1) exitProgress = 1;
                if (exitProgress < 0) exitProgress = 0;
            }

            const animType = comp.animationType || 'none'
            
            ctx.save()

            // APPLY ENTRANCE
            if (!isSceneExiting.value) {
                if (animType === 'fade') {
                    ctx.globalAlpha = entranceProgress
                } else if (animType === 'scale') {
                    ctx.translate(screenPos.x, screenPos.y)
                    ctx.scale(entranceProgress, entranceProgress)
                    ctx.translate(-screenPos.x, -screenPos.y)
                } else if (animType === 'slide') {
                    const offset = 200 * (1 - entranceProgress)
                    ctx.translate(-offset, 0)
                    ctx.globalAlpha = Math.max(0, entranceProgress) 
                }
            } 
            // APPLY EXIT (Standard Components)
            else if (comp.type !== 'options') {
                 // Standard Exit: Fade out based on progress
                 // You can expand this with 'exitAnimationType' later
                 ctx.globalAlpha = 1 - exitProgress;
            }

            ctx.translate(screenPos.x, screenPos.y)
            ctx.rotate((comp.rotation || 0) * Math.PI / 180)
            ctx.translate(-screenPos.x, -screenPos.y)
            
            // Pass animation states to renderComponent
            const animationOverride = {
                type: animType,
                progress: entranceProgress,
                // New Exit Props
                isExiting: isSceneExiting.value,
                exitProgress: exitProgress
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
    
    // Reset Global Variables to Default
    globalVariables.value.forEach(v => {
        v.value = v.defaultValue
    })
    
    // --- NEW: Reset Exit State ---
    isSceneExiting.value = false
    sceneExitStartTime.value = 0
    pendingNavigationTargetId.value = null
    // ----------------------------

    isPreviewMode.value = false
    // isSceneExiting.value = false; // Removed duplicate
}

const getInputType = (comp) => {
    if (comp.type !== 'input') return 'text';
    // FIX: Use loose equality
    const targetVar = globalVariables.value.find(v => v.id == comp.targetVariableId);
    if (targetVar && targetVar.type === 'integer') {
        return 'number';
    }
    return 'text';
}

// --- PREVIEW MOUSE EVENT HANDLERS FOR CLICKABLE OPTIONS ---

const getPreviewLogicalCoords = (e) => {
    if (!previewCanvasRef.value) return { x: 0, y: 0 };
    const rect = previewCanvasRef.value.getBoundingClientRect();
    const scale = previewScale.value;
    const canvasX = (e.clientX - rect.left) / scale;
    const canvasY = (e.clientY - rect.top) / scale;
    
    const logicalW = previewCanvasRef.value.width / scale;
    const logicalH = previewCanvasRef.value.height / scale;
    const centerX = logicalW / 2;
    const centerY = logicalH / 2;
    
    const graphX = (canvasX - centerX) / 2;
    const graphY = (centerY - canvasY) / 2;

    return { x: graphX, y: graphY };
}

// NEW HELPER: Get style for DOM overlay elements in Preview
const getPreviewComponentStyle = (comp) => {
    if (!previewCanvasRef.value) return {};
    
    const scale = previewScale.value;
    const centerX = (previewCanvasRef.value.width / scale) / 2;
    const centerY = (previewCanvasRef.value.height / scale) / 2;
    const pixelsPerUnit = 2;
    
    const screenX = centerX + (comp.x * pixelsPerUnit);
    const screenY = centerY - (comp.y * pixelsPerUnit);
    
    const rect = previewCanvasRef.value.getBoundingClientRect();
    
    // Real screen pixels = (logical pixels * scale) + canvas offset
    const realX = (screenX * scale) + rect.left;
    const realY = (screenY * scale) + rect.top;
    const realW = comp.width * scale;
    const realH = comp.height * scale;
    
    return {
        position: 'absolute',
        left: `${realX - (realW/2)}px`, // Centered anchor
        top: `${realY - (realH/2)}px`,  // Centered anchor
        width: `${realW}px`,
        height: `${realH}px`,
        transform: `rotate(${comp.rotation}deg)`,
        zIndex: 100 // Above canvas
    };
}

const onPreviewMouseMove = (e) => {
    if (!isPreviewMode.value || !nodeScenes.value) return;
    const scene = nodeScenes.value[currentPreviewSceneIndex.value];
    if (!scene || !scene.components) return;
    if (currentPreviewComponentIndex.value < 0) return;
    const activeComp = scene.components[currentPreviewComponentIndex.value];
    
    if (activeComp && activeComp.type === 'options') {
        const coords = getPreviewLogicalCoords(e);
        let needsRedraw = false;
        
        const dx = coords.x - activeComp.x;
        const dy = coords.y - activeComp.y;
        
        const rad = -(activeComp.rotation || 0) * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
        
        const hit = getOptionAtPosition(activeComp, localX, -localY, previewCtx);
             
         if (hit) {
             if (activeComp._hoveredOptionIndex !== hit.index) {
                 activeComp._hoveredOptionIndex = hit.index;
                 needsRedraw = true;
             }
         } else {
             if (activeComp._hoveredOptionIndex !== -1) {
                 activeComp._hoveredOptionIndex = -1;
                 needsRedraw = true;
             }
         }
        if (needsRedraw) drawPreview();
    }
}

// --- FIX: Prevent default canvas logic from firing on Inputs/Buttons ---
const onPreviewMouseDown = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

    if (!isPreviewMode.value || !nodeScenes.value) return;
    const scene = nodeScenes.value[currentPreviewSceneIndex.value];
    if (!scene || !scene.components) return;
    if (currentPreviewComponentIndex.value < 0) return;
    const activeComp = scene.components[currentPreviewComponentIndex.value];
    
    if (activeComp && activeComp.type === 'options' && activeComp._hoveredOptionIndex !== -1) {
        activeComp._clickedOptionIndex = activeComp._hoveredOptionIndex;
        drawPreview();
    }
}

// --- FIX: Prevent default canvas logic from firing on Inputs/Buttons ---
const onPreviewMouseUp = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

    if (!isPreviewMode.value || !nodeScenes.value) return;

    const scene = nodeScenes.value[currentPreviewSceneIndex.value];
    if (!scene || !scene.components) return;
    
    if (currentPreviewComponentIndex.value >= 0) {
        const activeComp = scene.components[currentPreviewComponentIndex.value];

        // --- NEW CHECK: Block click if video hasn't played fully ---
        if (activeComp && activeComp.type === 'video' && !activeComp._hasPlayedFull) {
            return; 
        }
        // -----------------------------------------------------------

        if (activeComp && activeComp.type === 'options') {
            const clickedIdx = activeComp._clickedOptionIndex;
            activeComp._clickedOptionIndex = -1;
            drawPreview();
            
            if (clickedIdx !== -1 && clickedIdx === activeComp._hoveredOptionIndex) {
                const option = activeComp.optionsList[clickedIdx];
                handleOptionNavigation(activeComp.id, option.id);
                return;
            }
        }
    }
    
    advancePreview();
}

const handleOptionNavigation = (compId, optionId) => {
    if (!popupNode.value) {
        exitPreview();
        return;
    }

    // 1. Check if we are already exiting to prevent double clicks
    if (isSceneExiting.value) return;

    const currentStatus = Canvas_Status.value.find(s => s.index === popupNode.value.id);
    if (!currentStatus || !currentStatus.options) {
        exitPreview();
        return;
    }

    const optStatus = currentStatus.options.find(o => o.id === optionId);
    
    // 2. Identify Target Node
    const nextNodeId = (optStatus && optStatus.next != null) ? optStatus.next : null;
    
    if (!nextNodeId) {
        exitPreview(); // End if no link
        return;
    }

    // CASE 2: OPTIONS EXIT ANIMATION
    // Determine wait time (Exit duration + a little buffer for the "Slower" effect)
    const scene = nodeScenes.value[currentPreviewSceneIndex.value];
    const components = scene.components || [];
    let maxExitDuration = 0;
    
    components.forEach(c => {
        // Find options component to ensure we include its duration
        const duration = c.exitAnimationDuration || 0.5;
        if (duration > maxExitDuration) maxExitDuration = duration;
    });

    // Store where we are going
    pendingNavigationTargetId.value = nextNodeId;
    
    // Trigger Exit State
    isSceneExiting.value = true;
    sceneExitStartTime.value = Date.now();

    // 3. Wait, then Load Node
    setTimeout(() => {
        isSceneExiting.value = false;
        sceneExitStartTime.value = 0;
        const target = pendingNavigationTargetId.value;
        pendingNavigationTargetId.value = null;
        
        loadNodeForPreview(target);
    }, maxExitDuration * 1000);
}

const loadNodeForPreview = (targetNodeId) => {
    let currentId = targetNodeId;
    let currentStatus = Canvas_Status.value.find(s => s.index === currentId);
    let safetyCounter = 0;

    // --- SEAMLESS LOGIC LOOP ---
    // Keep processing and jumping until we hit a visual node (General) or stop
    while (currentStatus && (currentStatus.node_type === 'Set Variables' || currentStatus.node_type === 'If-Else')) {
        
        if (safetyCounter > 100) {
            alert("Error: Infinite loop detected in logic nodes.");
            exitPreview();
            return;
        }

        // Execute logic immediately and get the next ID
        const nextId = processLogicNode(currentStatus);

        if (nextId === null || nextId === undefined) {
            // Flow ends here (e.g. end of a branch)
            exitPreview();
            return;
        }

        // Jump to next node
        currentId = nextId;
        currentStatus = Canvas_Status.value.find(s => s.index === currentId);
        safetyCounter++;
    }

    // If we are here, 'currentStatus' is a General Node (Visual)
    if (!currentStatus) {
        alert("Error: Target node data not found.");
        exitPreview();
        return;
    }

    // --- SETUP VISUAL PREVIEW ---
    isPreviewMode.value = true;

    stopAllVideos();
    if (previewAudioElement.value) {
        previewAudioElement.value.pause();
        previewAudioElement.value = null;
    }

    const realNode = nodes.value.find(n => n.id === currentId);
    popupNode.value = realNode || { id: currentId, x: 0, y: 0 }; 

    if (currentStatus.scenes) {
      nodeScenes.value = currentStatus.scenes.map(s => ({
          ...s,
          components: s.components ? [...s.components] : [] 
      }))
      // Reset inputs for the new scene
      resetComponentsRuntimeState(nodeScenes.value);
    } else {
      nodeScenes.value = [];
    }

    sequenceAudio.value = currentStatus.audio || null;
    if (sequenceAudio.value && sequenceAudio.value.url) {
        previewAudioElement.value = new Audio(sequenceAudio.value.url);
        previewAudioElement.value.volume = sequenceAudio.value.volume || 1.0;
        previewAudioElement.value.loop = (sequenceAudio.value.loop !== false);
        previewAudioElement.value.play().catch(e => console.log("Autoplay prevented:", e));
    }

    currentPreviewSceneIndex.value = 0;
    currentPreviewComponentIndex.value = -1;
    componentStartTime.value = 0;
    
    nextTick(() => {
        if (!previewCanvasRef.value) return;
        previewCtx = previewCanvasRef.value.getContext('2d');
        resizePreviewCanvas();
        drawPreview();
        startRenderLoop(); // Kickstart animation

        const firstScene = nodeScenes.value[0]
        if (firstScene && firstScene.components && firstScene.components.length > 0) {
            if (firstScene.components[0].autoRender) {
                setTimeout(() => advancePreview(), 50)
            }
        }
    });
}

const hexToRgba = (hex, alpha) => {
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length === 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
    }
    return hex;
}

window.addEventListener('resize', () => {
    if (isPreviewMode.value) {
        resizePreviewCanvas()
        drawPreview()
    }
})

const onPreviewWheel = (e) => {
    if (!isPreviewMode.value || !nodeScenes.value) return;
    const scene = nodeScenes.value[currentPreviewSceneIndex.value];
    if (!scene || !scene.components) return;
    
    const optComp = scene.components.find(c => c.type === 'options');
    if (!optComp) return;

    const coords = getPreviewLogicalCoords(e);
    const dx = coords.x - optComp.x;
    const dy = coords.y - optComp.y;
    
    if (Math.abs(dx) <= optComp.width/2 && Math.abs(dy) <= optComp.height/2) {
        if(!previewCtx) return;
        const layout = calculateOptionsLayout(optComp, previewCtx);
        
        if (layout.totalContentHeight > optComp.height) {
            e.preventDefault(); 
            const maxScroll = layout.totalContentHeight - optComp.height + 20; 
            
            if (!optComp.scrollY) optComp.scrollY = 0;
            optComp.scrollY += e.deltaY;
            
            if (optComp.scrollY < 0) optComp.scrollY = 0;
            if (optComp.scrollY > maxScroll) optComp.scrollY = maxScroll;
            
            drawPreview();
        }
    }
}

</script>

<template>
  <div class="wrapper">
    <transition name="fade">
        <div v-if="isSaving" class="saving-overlay">
            <div class="loom-container">
                <div class="loom-ring outer"></div>
                <div class="loom-ring middle"></div>
                <div class="loom-ring inner"></div>
                <div class="loom-core"></div>
                <div class="loom-particles">
                    <span></span><span></span><span></span><span></span>
                </div>
            </div>
            
            <div class="saving-text-wrapper">
                <div class="saving-title">SAVING PROJECT</div>
                <div class="saving-tip">{{ currentTip }}</div>
            </div>
        </div>
    </transition>
    <canvas 
      ref="canvasRef" 
      class="canvas" 
      @mousedown="onMouseDown" 
      @wheel="onWheel"
      @contextmenu.prevent="onContextMenu" 
    />
    
    <div 
      v-if="showContextMenu" 
      class="context-menu" 
      :style="{ top: contextMenuPos.y + 'px', left: contextMenuPos.x + 'px' }"
    >
      <div class="context-menu-item" @click="deleteTargetNode">
        🗑️ Delete Node
      </div>
      <div class="context-menu-item" @click="removeTargetLinks">
        🔗 Remove all links
      </div>
    </div>

    <header class="header">
      <button class="hamburger" @click="toggleMenu">☰</button>
      <div class="canvas-container" :style="{ cursor: cursorStyle }">
    
        <div class="notification-popup" :class="[notification.type, { 'show': notification.show }]">
            {{ notification.message }}
        </div>
      
      <div class="center">
        <div class="project-header-info">
            <div class="title">{{ projectName }}</div>
            <div class="subtitle">
                <span class="by-text">by </span> 
                <span class="author-name">{{ projectOwner }}</span>
            </div>
        </div>
      </div>

      <div class="header-actions">
            <div class="media-status-wrapper">
                <button 
                    class="media-status-btn" 
                    :class="{ 'loading': isMediaLoading, 'active': showMediaStatus }"
                    @click="showMediaStatus = !showMediaStatus"
                    :title="isMediaLoading ? 'Files Loading...' : 'All Files Loaded'"
                >
                    <span v-if="isMediaLoading" class="loader-icon">↻</span>
                    <span v-else>☁️</span>
                    
                    <span v-if="isMediaLoading" class="count-badge">
                        {{ mediaLoadingCount.loaded }}/{{ mediaLoadingCount.total }}
                    </span>
                </button>

                <div v-if="showMediaStatus" class="media-status-dropdown">
                    <div class="media-header">
                        <span>Media Files</span>
                        <button @click="showMediaStatus = false">✕</button>
                    </div>
                    <div class="media-list">
                        <div v-for="item in mediaRegistry.values()" :key="item.id" class="media-item">
                            <span class="media-icon">
                                {{ item.type === 'image' ? '🖼️' : item.type === 'video' ? '🎬' : '🎵' }}
                            </span>
                            <span class="media-name">{{ item.name }}</span>
                            <span class="media-state" :class="item.status">
                                {{ item.status === 'loading' ? '...' : item.status === 'loaded' ? '✓' : '⚠️' }}
                            </span>
                        </div>
                        <div v-if="mediaRegistry.size === 0" class="empty-media">
                            No media files in project.
                        </div>
                    </div>
                </div>
            </div>
            <div class="autosave-timer" :class="{ 'active': hasUnsavedChanges }">
                <span v-if="hasUnsavedChanges" class="pulse-dot">●</span>
                {{ formattedAutoSaveTime }}
            </div>

            <button 
                class="save-btn" 
                :class="{ 'disabled': isSaving }"
                @click="saveProjectData(false)" 
                :disabled="isSaving"
                title="Save Project"
            >
                <span v-if="isSaving">⏳ Saving...</span>
                <span v-else>💾 Save</span>
            </button>

            <button class="play-project-btn" @click="playProjectFromRoot" title="Play Project from Start">
                ▶
            </button>

            <button class="settings-btn" @click="toggleProjectSettings" title="Project Settings">
                ⚙️
            </button>

            <button class="fullscreen-btn" @click="toggleFullscreen" title="Toggle Fullscreen">
                <span v-if="!isFullscreen">⤢</span>
                <span v-else>⤡</span>
            </button>
        </div>
    </div>
    </header>

    <aside class="side-menu" :class="{ open: menuOpen }">
      
      <div class="menu-section">
        <h3 class="menu-section-title">Nodes</h3>
        
        <div class="menu-node" @mousedown.prevent="menuDragging = true; draggedType = 'General'">
          <div class="menu-node-header">
            <span>▷</span>
            <span class="menu-node-title">General Node</span>
            <span>▷</span>
          </div>
        </div>

        <div class="menu-node" @mousedown.prevent="menuDragging = true; draggedType = 'If-Else'">
          <div class="menu-node-header" style="background: linear-gradient(to right, #eab308, #000);">
            <span>?</span>
            <span class="menu-node-title">If-Else Node</span>
            <span>?</span>
          </div>
        </div>

        <div class="menu-node" @mousedown.prevent="menuDragging = true; draggedType = 'Set Variables'">
          <div class="menu-node-header" style="background: linear-gradient(to right, #8b5cf6, #000);">
            <span>▷</span>
            <span class="menu-node-title">Set Variables</span>
            <span>▷</span>
          </div>
        </div>

      </div>

      <div class="menu-divider"></div>

      <div class="menu-section">
        <div class="menu-header-row">
            <h3 class="menu-section-title">Global Variables</h3>
            <button class="add-var-btn-small" @click="toggleAddVariable" title="Add Variable">+</button>
        </div>
        
        <transition name="fade">
            <div v-if="isAddingVariable" class="add-var-form">
                <div class="var-type-selector">
                    <label :class="{ active: newVarType === 'string' }">
                        <input type="radio" value="string" v-model="newVarType"> String
                    </label>
                    <label :class="{ active: newVarType === 'integer' }">
                        <input type="radio" value="integer" v-model="newVarType"> Integer
                    </label>
                </div>

                <input v-model="newVarName" placeholder="Variable Name" class="var-input" />
                
                <input 
                    v-if="newVarType === 'integer'"
                    type="number" 
                    v-model="newVarValue" 
                    placeholder="Value (Required)" 
                    class="var-input" 
                />
                <input 
                    v-else
                    type="text" 
                    v-model="newVarValue" 
                    placeholder="Value (Optional)" 
                    class="var-input" 
                />

                <div class="var-form-actions">
                    <button class="save-var-btn" @click="addGlobalVariable">Save</button>
                    <button class="cancel-var-btn" @click="toggleAddVariable">Cancel</button>
                </div>
            </div>
        </transition>

        <div class="variable-list">
            <div v-for="v in globalVariables" :key="v.id" class="variable-item">
                <div class="var-info">
                    <span class="var-name">
                        {{ v.name }} 
                        <span class="var-type-tag">{{ v.type === 'integer' ? '#' : 'Aa' }}</span>
                    </span>
                    <span class="var-value-display">{{ v.value }}</span>
                </div>
                <button class="delete-var-btn" @click="deleteGlobalVariable(v.id)">×</button>
            </div>
            <div v-if="globalVariables.length === 0 && !isAddingVariable" class="no-vars">
                No variables added.
            </div>
        </div>
      </div>

    </aside>

    <transition name="fade">
      <div v-if="showProjectSettings" class="settings-overlay" @click.self="toggleProjectSettings">
        <div class="settings-modal">
          <div class="settings-header">
            <h3>Project Settings</h3>
            <button class="close-settings-btn" @click="toggleProjectSettings">✕</button>
          </div>
          <div class="settings-content">
            
            <div class="setting-item">
                <label class="setting-label">Root Node (Start Point):</label>
                <div class="setting-desc">Select which node the project starts from when clicking Play. (Only General Nodes allowed)</div>
                <select v-model="rootNodeId" class="setting-select">
                    <option :value="null" disabled>-- Select a Starting Node --</option>
                    <option v-for="node in availableRootNodes" :key="node.index" :value="node.index">
                        {{ node.Node_name || `Node ${node.index}` }} (ID: {{ node.index }})
                    </option>
                </select>
            </div>
            <div class="setting-item" style="margin-top: 24px;">
                <label class="setting-label">Project Statistics</label>
                
                <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #cbd5e1;">Total Options:</span>
                        <span style="color: #fff; font-weight: bold; font-family: monospace;">{{ projectOptionsStats.total }}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #cbd5e1;">Disconnected Options:</span>
                        <span 
                            style="font-weight: bold; font-family: monospace;"
                            :style="{ color: projectOptionsStats.disconnected > 0 ? '#ef4444' : '#00ff88' }"
                        >
                            {{ projectOptionsStats.disconnected }}
                        </span>
                    </div>
                </div>

                <div v-if="projectOptionsStats.disconnected > 0" style="margin-top: 12px; display: flex; gap: 10px; background: rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.3);">
                    <div style="font-size: 1.2rem;">⚠️</div>
                    <div style="font-size: 0.85rem; color: #fca5a5; line-height: 1.4;">
                        <strong>Heads up!</strong> You cannot post/publish this project while there are 
                        <u>{{ projectOptionsStats.disconnected }} disconnected options</u>. 
                        <br>Please ensure every option leads to a node! 🧐
                    </div>
                </div>
                
                <div v-else-if="projectOptionsStats.total > 0" style="margin-top: 12px; text-align: center; font-size: 0.85rem; color: #00ff88; font-style: italic;">
                    All systems go! Everything is connected. 🚀
                </div>
            </div>
            <div class="setting-item" style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px;">
                 <p style="color: #6b7280; font-size: 0.9rem; font-style: italic;">
                    Global variables defined in the side menu will be initialized when the project starts.
                 </p>
            </div>

          </div>
        </div>
      </div>
    </transition>

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
            
            <div v-if="viewMode !== 'setVariables' && viewMode !== 'ifElse'" class="audio-status-display">
                <span class="audio-label">Sequence Audio:</span>
                <span class="audio-value">{{ sequenceAudio?.name || 'Not selected yet' }}</span>
            </div>

            <button v-if="viewMode !== 'setVariables' && viewMode !== 'ifElse'" class="preview-btn" @click="startPreview">
                ▶ Preview Scene
             </button>
          </div>

          <div class="popup-body">
            
            <template v-if="viewMode === 'scenes' || viewMode === 'sceneDetails' || viewMode === 'componentEditor'">
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
                        
                        <div v-else-if="activeComponent.type === 'input'" 
                             :style="{ width: '300px', height: '60px', border: '1px dashed #a855f7', backgroundColor: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems:'center', justifyContent: 'center', color: '#a855f7', flexDirection: 'column' }">
                             <span>Input Box</span>
                             <span style="font-size: 0.7rem; opacity: 0.8;">(Preview in Play Mode)</span>
                        </div>
                        
                        <div v-else-if="activeComponent.type === 'variable'" 
                             style="color:white; font-size: 20px; text-align: center; border: 1px dashed #f97316; padding: 10px;">
                             { Variable }
                        </div>

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
                        
                        <div v-if="activeComponent.type === 'variable'">
                            <div class="separator"></div>
                            
                            <div class="detail-section">
                                <label class="detail-label" style="color: #f97316;">Variable Source</label>
                                <select v-model="activeComponent.variableId" class="detail-input">
                                    <option value="" disabled>Select Variable to Display</option>
                                    <option v-for="v in globalVariables" :key="v.id" :value="v.id">
                                        {{ v.name }} ({{ v.type }})
                                    </option>
                                </select>
                            </div>
                            
                            <div class="detail-section">
                                <label class="detail-label">Font Family:</label>
                                <select v-model="activeComponent.fontFamily" class="detail-input" @change="drawComponents">
                                    <option value="sans-serif">Sans Serif</option>
                                    <option value="serif">Serif</option>
                                    <option value="monospace">Monospace</option>
                                    <option value="cursive">Cursive</option>
                                    <option value="fantasy">Fantasy</option>
                                </select>
                            </div>
                            <div class="detail-section">
                                <label class="detail-label">Font Size:</label>
                                <input type="number" v-model.number="activeComponent.fontSize" class="detail-input" @input="drawComponents" />
                            </div>
                            <div class="detail-section">
                                <label class="detail-label">Text Color:</label>
                                <div class="color-picker-container">
                                    <input type="color" v-model="activeComponent.color" class="color-input" @input="drawComponents" />
                                    <div class="color-preview" :style="{ backgroundColor: activeComponent.color }"></div>
                                </div>
                            </div>
                            <div class="detail-section">
                                <div class="formatting-controls">
                                    <button class="format-btn" @click="activeComponent.fontWeight = activeComponent.fontWeight === 'bold' ? 'normal' : 'bold'; drawComponents()" :class="{ active: activeComponent.fontWeight === 'bold' }" title="Bold">B</button>
                                    <button class="format-btn" @click="activeComponent.fontStyle = activeComponent.fontStyle === 'italic' ? 'normal' : 'italic'; drawComponents()" :class="{ active: activeComponent.fontStyle === 'italic' }" title="Italic">I</button>
                                    <button class="format-btn" @click="activeComponent.textDecoration = activeComponent.textDecoration === 'underline' ? 'none' : 'underline'; drawComponents()" :class="{ active: activeComponent.textDecoration === 'underline' }" title="Underline">U</button>
                                    <button class="format-btn" @click="activeComponent.textDecoration = activeComponent.textDecoration === 'line-through' ? 'none' : 'line-through'; drawComponents()" :class="{ active: activeComponent.textDecoration === 'line-through' }" title="Strikethrough">S</button>
                                </div>
                            </div>
                             <div class="detail-section">
                                <label class="detail-label">Background Color:</label>
                                <div class="color-picker-container">
                                    <input type="color" v-model="activeComponent.backgroundColor" class="color-input" @input="drawComponents" />
                                    <div class="color-preview" :style="{ backgroundColor: activeComponent.backgroundColor }"></div>
                                </div>
                            </div>
                            <div class="detail-section">
                                <label class="detail-label">Border Color:</label>
                                <div class="color-picker-container">
                                    <input type="color" v-model="activeComponent.borderColor" class="color-input" @input="drawComponents" />
                                    <div class="color-preview" :style="{ backgroundColor: activeComponent.borderColor }"></div>
                                </div>
                            </div>
                            <div class="detail-section">
                                <label class="detail-label">Border Width:</label>
                                <input type="number" v-model.number="activeComponent.borderWidth" class="detail-input" @input="drawComponents" />
                            </div>
                             <div class="detail-section">
                                <label class="detail-label">Border Radius:</label>
                                <input type="number" v-model.number="activeComponent.borderRadius" class="detail-input" @input="drawComponents" />
                            </div>
                        </div>

                        <div v-if="activeComponent.type === 'input'">
                            <div class="separator"></div>
                            
                            <div class="detail-section">
                                <label class="detail-label" style="color: #a855f7;">Variable Assignment</label>
                                <select v-model="activeComponent.targetVariableId" class="detail-input">
                                    <option value="" disabled>Select Target Variable</option>
                                    <option v-for="v in globalVariables" :key="v.id" :value="v.id">
                                        {{ v.name }} ({{ v.type }})
                                    </option>
                                </select>
                                <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 4px;">
                                    User input will be validated against variable type.
                                </div>
                            </div>

                            <div class="detail-section">
                                <label class="detail-label" style="color: #a855f7;">Text Settings</label>
                                <div class="detail-section">
                                    <label class="detail-label">Placeholder:</label>
                                    <input v-model="activeComponent.placeholderText" class="detail-input" @input="drawComponents" placeholder="e.g. Type here..." />
                                </div>
                                <div class="detail-section">
                                    <label class="detail-label">Font Family:</label>
                                    <select v-model="activeComponent.fontFamily" class="detail-input" @change="drawComponents">
                                        <option value="sans-serif">Sans Serif</option>
                                        <option value="serif">Serif</option>
                                        <option value="monospace">Monospace</option>
                                    </select>
                                </div>
                                <div class="detail-section">
                                    <label class="detail-label">Font Size:</label>
                                    <input type="number" v-model.number="activeComponent.fontSize" class="detail-input" @input="drawComponents" />
                                </div>
                                <div class="formatting-controls">
                                    <button class="format-btn" @click="activeComponent.fontWeight = activeComponent.fontWeight === 'bold' ? 'normal' : 'bold'; drawComponents()" :class="{ active: activeComponent.fontWeight === 'bold' }" title="Bold">B</button>
                                    <button class="format-btn" @click="activeComponent.fontStyle = activeComponent.fontStyle === 'italic' ? 'normal' : 'italic'; drawComponents()" :class="{ active: activeComponent.fontStyle === 'italic' }" title="Italic">I</button>
                                </div>
                            </div>

                            <div class="detail-section">
                                <label class="detail-label" style="color: #a855f7;">Input Styles</label>
                                
                                <div class="detail-section">
                                    <label class="detail-label">Background:</label>
                                    <div class="color-picker-container">
                                        <input type="color" v-model="activeComponent.backgroundColor" class="color-input" @input="drawComponents" />
                                        <div class="color-preview" :style="{ backgroundColor: activeComponent.backgroundColor }"></div>
                                    </div>
                                </div>
                                
                                <div class="detail-section">
                                    <label class="detail-label">Text Color:</label>
                                    <div class="color-picker-container">
                                        <input type="color" v-model="activeComponent.textColor" class="color-input" @input="drawComponents" />
                                        <div class="color-preview" :style="{ backgroundColor: activeComponent.textColor }"></div>
                                    </div>
                                </div>

                                <div class="detail-section">
                                    <label class="detail-label">Border:</label>
                                    <div class="color-picker-container">
                                        <input type="color" v-model="activeComponent.borderColor" class="color-input" @input="drawComponents" />
                                        <div class="color-preview" :style="{ backgroundColor: activeComponent.borderColor }"></div>
                                    </div>
                                </div>
                                <div class="detail-section">
                                    <label class="detail-label">Border Radius:</label>
                                    <input type="number" v-model.number="activeComponent.borderRadius" class="detail-input" @input="drawComponents" />
                                </div>
                            </div>

                            <div class="detail-section">
                                <label class="detail-label" style="color: #a855f7;">Focus State Styles</label>
                                <div class="detail-section">
                                    <label class="detail-label">Focus Background:</label>
                                    <div class="color-picker-container">
                                        <input type="color" v-model="activeComponent.focusBackgroundColor" class="color-input" />
                                        <div class="color-preview" :style="{ backgroundColor: activeComponent.focusBackgroundColor }"></div>
                                    </div>
                                </div>
                                <div class="detail-section">
                                    <label class="detail-label">Focus Border:</label>
                                    <div class="color-picker-container">
                                        <input type="color" v-model="activeComponent.focusBorderColor" class="color-input" />
                                        <div class="color-preview" :style="{ backgroundColor: activeComponent.focusBorderColor }"></div>
                                    </div>
                                </div>
                            </div>

                            <div class="detail-section">
                                <label class="detail-label" style="color: #a855f7;">Button Settings</label>
                                <div class="detail-section">
                                    <label class="detail-label">Button Text:</label>
                                    <input v-model="activeComponent.buttonText" class="detail-input" @input="drawComponents" />
                                </div>
                                <div class="detail-section">
                                    <label class="detail-label">Submitted Text:</label>
                                    <input v-model="activeComponent.buttonSubmittedText" class="detail-input" />
                                </div>
                                
                                <div class="detail-section">
                                    <label class="detail-label">Normal Color:</label>
                                    <div class="color-picker-container">
                                        <input type="color" v-model="activeComponent.buttonNormalColor" class="color-input" @input="drawComponents" />
                                        <div class="color-preview" :style="{ backgroundColor: activeComponent.buttonNormalColor }"></div>
                                    </div>
                                </div>
                                <div class="detail-section">
                                    <label class="detail-label">Hover Color:</label>
                                    <div class="color-picker-container">
                                        <input type="color" v-model="activeComponent.buttonHoverColor" class="color-input" />
                                        <div class="color-preview" :style="{ backgroundColor: activeComponent.buttonHoverColor }"></div>
                                    </div>
                                </div>
                                <div class="detail-section">
                                    <label class="detail-label">Click Color:</label>
                                    <div class="color-picker-container">
                                        <input type="color" v-model="activeComponent.buttonClickColor" class="color-input" />
                                        <div class="color-preview" :style="{ backgroundColor: activeComponent.buttonClickColor }"></div>
                                    </div>
                                </div>
                                <div class="detail-section">
                                    <label class="detail-label">Text Color:</label>
                                    <div class="color-picker-container">
                                        <input type="color" v-model="activeComponent.buttonTextColor" class="color-input" @input="drawComponents" />
                                        <div class="color-preview" :style="{ backgroundColor: activeComponent.buttonTextColor }"></div>
                                    </div>
                                </div>
                            </div>
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
                                <label class="detail-label">Exit Animation:</label>
                                <select v-model="activeComponent.exitAnimationType" class="detail-input">
                                    <option value="fade">Fade Out</option>
                                    <option value="none">None</option>
                                </select>
                            </div>

                            <div class="detail-section" v-if="activeComponent.exitAnimationType && activeComponent.exitAnimationType !== 'none'">
                            <label class="detail-label">Exit Duration (sec):</label>
                            <div class="input-row">
                                <input 
                                type="range" 
                                v-model.number="activeComponent.exitAnimationDuration" 
                                min="0.1" max="5" step="0.1"
                                class="range-input" 
                                />
                                <input 
                                type="number" 
                                v-model.number="activeComponent.exitAnimationDuration" 
                                class="number-input" 
                                min="0.1" max="5" step="0.1"
                                />
                            </div>
                            <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 4px; font-style: italic;">
                                Plays when scene ends or option selected.
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
                        
                        <div class="detail-section" style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px; margin-bottom: 16px;">
                            <label class="detail-label" style="color:#00ff88; margin-bottom: 12px;">Container Styles</label>
                            
                            <div class="detail-section">
                            <label class="detail-label">Box Color & Opacity:</label>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <input type="color" v-model="activeComponent.boxColor" class="color-input" @input="drawComponents" />
                                <div class="input-row" style="flex: 1;">
                                <input type="range" v-model.number="activeComponent.boxOpacity" min="0" max="1" step="0.05" class="range-input" @input="drawComponents" />
                                <span class="audio-val-text">{{ Math.round((activeComponent.boxOpacity || 0) * 100) }}%</span>
                                </div>
                            </div>
                            </div>
                            
                            <div class="detail-section">
                            <label class="detail-label">Border Color:</label>
                            <div class="color-picker-container">
                                <input type="color" v-model="activeComponent.borderColor" class="color-input" @input="drawComponents" />
                                <div class="color-preview" :style="{ backgroundColor: activeComponent.borderColor }"></div>
                            </div>
                            </div>

                            <div class="detail-section">
                            <label class="detail-label">Border Width:</label>
                            <input type="number" v-model.number="activeComponent.borderWidth" class="detail-input" @input="drawComponents" />
                            </div>

                            <div class="detail-section">
                            <label class="detail-label">Border Radius:</label>
                            <input type="number" v-model.number="activeComponent.borderRadius" class="detail-input" @input="drawComponents" />
                            </div>
                        </div>

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
                        <div class="detail-section" v-if="activeComponent.type === 'options'" style="background: rgba(234, 179, 8, 0.1); padding: 10px; border-radius: 6px; border: 1px solid rgba(234, 179, 8, 0.3); margin-bottom: 16px;">
    <div class="checkbox-row">
        <label class="detail-label"  style="color: #eab308; margin-bottom:0; flex:1;">⏱ Enable Time Limit</label>
        <input type="checkbox" v-model="activeComponent.hasTimeLimit" @change="drawComponents" />
    </div>

    <div v-if="activeComponent.hasTimeLimit" style="margin-top: 12px;">
        <div class="detail-section">
            <label class="detail-label">Duration (Seconds):</label>
            <div class="input-row">
                <input type="range" v-model.number="activeComponent.timeLimitDuration" min="1" max="10" step="0.5" class="range-input" />
                <span class="audio-val-text">{{ activeComponent.timeLimitDuration }}s</span>
            </div>
        </div>

        <div class="detail-section">
            <label class="detail-label">On Timeout:</label>
            <div class="toggle-buttons" style="width: 100%; margin-bottom: 8px;">
                <button 
                    :class="{ active: activeComponent.timeoutAction === 'random' }" 
                    @click="activeComponent.timeoutAction = 'random'"
                    style="flex: 1;"
                >
                    🎲 Random
                </button>
                <button 
                    :class="{ active: activeComponent.timeoutAction === 'manual' }" 
                    @click="activeComponent.timeoutAction = 'manual'"
                    style="flex: 1;"
                >
                    🎯 Specific
                </button>
            </div>
            
            <div v-if="activeComponent.timeoutAction === 'manual'">
                 <select v-model="activeComponent.timeoutTargetId" class="detail-input">
                    <option :value="null" disabled>Select Option to Choose</option>
                    <option v-for="opt in activeComponent.optionsList" :key="opt.id" :value="opt.id">
                        {{ opt.text }}
                    </option>
                 </select>
            </div>
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
            </template>

            <template v-else-if="viewMode === 'setVariables'">
                <div class="set-variable-view">
                    <div class="logic-editor-container">
                        <div class="logic-header">
                            <h3>Set Variable Logic</h3>
                            <p>Configure how this node modifies global variables.</p>
                        </div>

                        <div class="variable-logic-row">
                            
                            <div class="logic-group">
                                <label>Target Variable</label>
                                <select v-model="setVarId" class="logic-select">
                                    <option value="" disabled>Select Variable</option>
                                    <option v-for="v in globalVariables" :key="v.id" :value="v.id">
                                        {{ v.name }}
                                    </option>
                                </select>
                            </div>

                            <div class="logic-group small">
                                <label>Operator</label>
                                <select v-model="setVarOperator" class="logic-select operator">
                                    <option v-for="op in availableOperators" :key="op" :value="op">{{ op }}</option>
                                </select>
                            </div>

                            <div class="logic-group large">
                                <template v-if="setVarOperator === '+' && globalVariables.find(v => v.id === setVarId)?.type === 'string'">
                                    <div class="string-concat-ui">
                                        <div class="concat-row">
                                            <label>Before string (Prefix)</label>
                                            <input v-model="setVarStringPrefix" class="logic-input" placeholder="e.g. Hello " />
                                        </div>
                                        
                                        <div class="var-badge-display">
                                            &lt; {{ globalVariables.find(v => v.id === setVarId)?.name }} &gt;
                                        </div>
                                        
                                        <div class="concat-row">
                                            <label>After string (Suffix)</label>
                                            <input v-model="setVarStringSuffix" class="logic-input" placeholder="e.g.  Wadup" />
                                        </div>
                                    </div>
                                </template>
                                
                                <template v-else>
                                    <div class="value-type-toggle">
                                        <label>Value Source:</label>
                                        <div class="toggle-buttons">
                                            <button 
                                                :class="{ active: setVarValueType === 'constant' }" 
                                                @click="setVarValueType = 'constant'"
                                            >Value</button>
                                            <button 
                                                :class="{ active: setVarValueType === 'variable' }" 
                                                @click="setVarValueType = 'variable'"
                                            >Variable</button>
                                        </div>
                                    </div>
                                    
                                    <div v-if="setVarValueType === 'constant'">
                                        <input 
                                            :type="globalVariables.find(v => v.id === setVarId)?.type === 'integer' ? 'number' : 'text'"
                                            v-model="setVarValue" 
                                            class="logic-input" 
                                            placeholder="Enter value..."
                                        />
                                    </div>
                                    <div v-else>
                                        <select v-model="setVarValue" class="logic-select">
                                            <option value="" disabled>Select Source Variable</option>
                                            <option v-for="v in globalVariables" :key="v.id" :value="v.id">
                                                {{ v.name }}
                                            </option>
                                        </select>
                                    </div>
                                </template>
                            </div>

                        </div>

                        <div class="preview-equation">
                            <span class="eq-part target">{{ globalVariables.find(v => v.id === setVarId)?.name || '?' }}</span>
                            <span class="eq-part op">=</span>
                            
                            <template v-if="setVarOperator === '+' && globalVariables.find(v => v.id === setVarId)?.type === 'string'">
                                <span class="eq-part value" v-if="setVarStringPrefix">"{{ setVarStringPrefix }}" + </span>
                                <span class="eq-part target">{{ globalVariables.find(v => v.id === setVarId)?.name }}</span>
                                <span class="eq-part value" v-if="setVarStringSuffix"> + "{{ setVarStringSuffix }}"</span>
                            </template>
                            
                            <template v-else>
                                <span class="eq-part target" v-if="setVarOperator !== '='">{{ globalVariables.find(v => v.id === setVarId)?.name }} {{ setVarOperator }}</span>
                                <span class="eq-part value">
                                    <template v-if="setVarValueType === 'constant'">{{ setVarValue || '...' }}</template>
                                    <template v-else>{{ globalVariables.find(v => v.id === setVarValue)?.name || '?' }}</template>
                                </span>
                            </template>
                        </div>

                    </div>
                </div>
            </template>

            <template v-else-if="viewMode === 'ifElse'">
                <div class="set-variable-view">
                     <div class="logic-editor-container">
                        <div class="logic-header">
                            <h3 style="color: #eab308;">If-Else Condition</h3>
                            <p>Route the flow based on a variable's value.</p>
                        </div>

                        <div class="variable-logic-row">
                            <div class="logic-group">
                                <label>Variable</label>
                                <select v-model="ifElseVarId" class="logic-select">
                                    <option value="" disabled>Select Variable</option>
                                    <option v-for="v in globalVariables" :key="v.id" :value="v.id">
                                        {{ v.name }} ({{ v.type }})
                                    </option>
                                </select>
                            </div>

                            <div class="logic-group small">
                                <label>Operator</label>
                                <select v-model="ifElseOperator" class="logic-select operator" style="border-color: #eab308; color: #eab308; background: rgba(234, 179, 8, 0.1);">
                                    <option v-for="op in ifElseOperators" :key="op" :value="op">{{ op }}</option>
                                </select>
                            </div>

                            <div class="logic-group large">
                                <div class="value-type-toggle">
                                    <label>Compare To:</label>
                                    <div class="toggle-buttons">
                                        <button 
                                            :class="{ active: ifElseValueType === 'constant' }" 
                                            @click="ifElseValueType = 'constant'"
                                        >Value</button>
                                        <button 
                                            :class="{ active: ifElseValueType === 'variable' }" 
                                            @click="ifElseValueType = 'variable'"
                                        >Variable</button>
                                    </div>
                                </div>
                                
                                <div v-if="ifElseValueType === 'constant'">
                                    <input 
                                        :type="globalVariables.find(v => v.id === ifElseVarId)?.type === 'integer' ? 'number' : 'text'"
                                        v-model="ifElseValue" 
                                        class="logic-input" 
                                        placeholder="Value..."
                                    />
                                </div>
                                <div v-else>
                                    <select v-model="ifElseValue" class="logic-select">
                                        <option value="" disabled>Select Variable</option>
                                        <option v-for="v in globalVariables" :key="v.id" :value="v.id">
                                            {{ v.name }}
                                        </option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="preview-equation" style="border-color: #eab308;">
                            <span class="eq-part target">{{ globalVariables.find(v => v.id === ifElseVarId)?.name || '?' }}</span>
                            <span class="eq-part op" style="color: #eab308;">{{ ifElseOperator }}</span>
                            <span class="eq-part value" style="background: rgba(234, 179, 8, 0.1); color: #eab308;">
                                <template v-if="ifElseValueType === 'constant'">{{ ifElseValue || '?' }}</template>
                                <template v-else>{{ globalVariables.find(v => v.id === ifElseValue)?.name || '?' }}</template>
                            </span>
                        </div>
                        
                        <div style="display:flex; justify-content:space-between; margin-top: 20px; padding: 0 40px;">
                            <div style="text-align:center; color: #00ff88;">
                                <div>True</div>
                                <div style="font-size:20px;">↓</div>
                            </div>
                            <div style="text-align:center; color: #ff2a2a;">
                                <div>False</div>
                                <div style="font-size:20px;">↓</div>
                            </div>
                        </div>

                     </div>
                </div>
            </template>

          </div>
          <button class="popup-return-btn" @click="closePopup">Return to Canvas</button>
          
          <div v-if="showAddDropdown" class="dropdown-overlay" @click="closeAddDropdown"></div>
        </div>
      </div>
    </transition>

    <transition name="fade">
        <div v-if="isPreviewMode" 
             class="preview-overlay"
             @mousemove="onPreviewMouseMove"
             @mousedown="onPreviewMouseDown"
             @mouseup="onPreviewMouseUp"
             @wheel="onPreviewWheel">
             
             <canvas ref="previewCanvasRef" class="preview-canvas"></canvas>
             
             <div class="preview-dom-layer">
                <template v-if="nodeScenes[currentPreviewSceneIndex]">
                    <div 
                        v-for="(comp, index) in nodeScenes[currentPreviewSceneIndex].components"
                        :key="comp.id"
                        class="preview-component-wrapper"
                        :style="getPreviewComponentStyle(comp)" 
                    >
                        <div 
                            v-if="comp.type === 'input' && index <= currentPreviewComponentIndex" 
                            class="preview-input-group" 
                            :style="{ 
                                '--focus-bg': comp.focusBackgroundColor, 
                                '--focus-border': comp.focusBorderColor 
                            }"
                        >
                            <input 
                                :type="getInputType(comp)"
                                v-model="comp.currentValue"
                                :disabled="comp.isSubmitted"
                                :placeholder="comp.isSubmitted ? '' : (comp.placeholderText || 'Type here...')"
                                class="preview-real-input"
                                :style="{ 
                                    backgroundColor: comp.backgroundColor, 
                                    borderColor: comp.borderColor, 
                                    
                                    /* --- DYNAMIC SCALING FIXES --- */
                                    borderRadius: (comp.borderRadius * previewScale) + 'px',
                                    borderWidth: (comp.borderWidth * previewScale) + 'px',
                                    fontSize: (comp.fontSize * previewScale) + 'px',
                                    paddingLeft: (10 * previewScale) + 'px',
                                    paddingRight: (10 * previewScale) + 'px',
                                    /* ----------------------------- */

                                    color: comp.textColor,
                                    fontFamily: comp.fontFamily,
                                    fontWeight: comp.fontWeight,
                                    fontStyle: comp.fontStyle
                                }"
                                @mousedown.stop
                                @mouseup.stop
                            />
                            <button 
                                class="preview-input-btn"
                                :disabled="comp.isSubmitted"
                                :style="{
                                    backgroundColor: comp.isSubmitted ? '#10b981' : comp.buttonNormalColor,
                                    color: comp.buttonTextColor,
                                    
                                    /* --- DYNAMIC SCALING FIXES --- */
                                    fontSize: (14 * previewScale) + 'px', /* Base btn font is usually 14 */
                                    paddingLeft: (20 * previewScale) + 'px',
                                    paddingRight: (20 * previewScale) + 'px',
                                    borderTopRightRadius: (comp.borderRadius * previewScale) + 'px',
                                    borderBottomRightRadius: (comp.borderRadius * previewScale) + 'px'
                                    /* ----------------------------- */
                                }"
                                @click.stop="handleInputSubmit(comp)"
                                @mousedown.stop="(e) => !comp.isSubmitted && (e.target.style.backgroundColor = comp.buttonClickColor)"
                                @mouseup.stop="(e) => !comp.isSubmitted && (e.target.style.backgroundColor = comp.buttonHoverColor)"
                                @mouseover="(e) => !comp.isSubmitted && (e.target.style.backgroundColor = comp.buttonHoverColor)"
                                @mouseleave="(e) => !comp.isSubmitted && (e.target.style.backgroundColor = comp.buttonNormalColor)"
                            >
                                {{ comp.isSubmitted ? comp.buttonSubmittedText : comp.buttonText }}
                            </button>
                        </div>
                    </div>
                </template>
             </div>

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

  /* Context Menu Styles */
  .context-menu {
    position: fixed;
    z-index: 1000;
    background: #1f2937;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 4px;
    min-width: 160px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
  }

  .context-menu-item {
    padding: 8px 12px;
    color: #e2e8f0;
    font-size: 0.9rem;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .context-menu-item:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

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
    cursor: pointer;
  }




 

  .center { text-align: center }

  .side-menu {
    position: absolute;
    top: 64px;
    left: 0;
    width: 280px; /* Slightly wider for variables */
    height: calc(100% - 64px);
    backdrop-filter: blur(12px);
    background: rgba(0,0,0,.85); /* Darker background for better contrast */
    transform: translateX(-100%);
    transition: .35s;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    border-right: 1px solid rgba(255,255,255,0.1);
  }

  .side-menu.open { transform: translateX(0) }

  /* SIDE MENU SECTIONS */
  .menu-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
  }

  .menu-section-title {
      color: #9ca3af;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
      margin: 0;
  }

  .menu-divider {
      height: 1px;
      background: rgba(255,255,255,0.1);
      margin: 8px 0;
  }

  /* Nodes Styles */
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

  /* VARIABLE SECTION STYLES */
  .menu-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
  }

  .add-var-btn-small {
      background: rgba(0, 255, 136, 0.1);
      color: #00ff88;
      border: 1px solid rgba(0, 255, 136, 0.3);
      width: 24px;
      height: 24px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.2s;
  }

  .add-var-btn-small:hover {
      background: #00ff88;
      color: #000;
  }

  .add-var-form {
      background: rgba(255,255,255,0.05);
      padding: 10px;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      border: 1px solid rgba(255,255,255,0.1);
  }

  /* Variable Type Selector (Radio Buttons) */
  .var-type-selector {
      display: flex;
      gap: 8px;
      margin-bottom: 4px;
  }

  .var-type-selector label {
      flex: 1;
      text-align: center;
      background: rgba(0,0,0,0.3);
      padding: 6px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.75rem;
      color: #9ca3af;
      border: 1px solid transparent;
      transition: all 0.2s;
  }

  .var-type-selector label:hover {
      background: rgba(255,255,255,0.05);
  }

  .var-type-selector label.active {
      background: rgba(0, 255, 136, 0.1);
      color: #00ff88;
      border-color: rgba(0, 255, 136, 0.3);
      font-weight: 600;
  }

  .var-type-selector input {
      display: none; /* Hide default radio */
  }

  .var-input {
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.1);
      padding: 6px 8px;
      border-radius: 4px;
      color: #fff;
      font-size: 0.85rem;
      outline: none;
  }

  .var-input:focus {
      border-color: #00ff88;
  }

  .var-form-actions {
      display: flex;
      gap: 8px;
  }

  .save-var-btn, .cancel-var-btn {
      flex: 1;
      padding: 4px;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 600;
  }

  .save-var-btn {
      background: #00ff88;
      color: #000;
  }

  .cancel-var-btn {
      background: rgba(255,255,255,0.1);
      color: #fff;
  }

  .variable-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 300px;
      overflow-y: auto;
  }

  .variable-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255,255,255,0.03);
      padding: 8px;
      border-radius: 4px;
      border: 1px solid transparent;
      transition: all 0.2s;
  }

  .variable-item:hover {
      background: rgba(255,255,255,0.08);
      border-color: rgba(255,255,255,0.1);
  }

  .var-info {
      display: flex;
      flex-direction: column;
      overflow: hidden;
  }

  .var-name {
      color: #e2e8f0;
      font-size: 0.9rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
  }

  /* Variable Type Tag (Icon) */
  .var-type-tag {
      font-size: 0.65rem;
      padding: 1px 4px;
      border-radius: 3px;
      background: rgba(255,255,255,0.1);
      color: #9ca3af;
      font-family: monospace;
  }

  .var-value-display {
      color: #9ca3af;
      font-size: 0.8rem;
      font-family: monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
  }

  .delete-var-btn {
      background: transparent;
      border: none;
      color: #6b7280;
      cursor: pointer;
      font-size: 1.2rem;
      padding: 0 4px;
      line-height: 1;
  }

  .delete-var-btn:hover {
      color: #f87171;
  }

  .no-vars {
      color: #6b7280;
      font-style: italic;
      font-size: 0.85rem;
      text-align: center;
      padding: 10px;
  }

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
  .hover-purple:hover { background-color: rgba(168, 85, 247, 0.2); } /* Purple for input */
  .hover-orange:hover { background-color: rgba(249, 115, 22, 0.2); } /* Orange for variables */


  /* Scene Content Body Styles */
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
     IMAGE CONTAINER STYLES (Single Line Layout)
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
  :deep(.bg-purple) { background-color: #a855f7; } /* Purple for input */
  :deep(.bg-orange) { background-color: #f97316; } /* Orange for variables */

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

  /* ==========================================================================
     NEW: PREVIEW DOM OVERLAY STYLES
     ========================================================================== */
  .preview-dom-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none; /* Let background clicks pass through */
      z-index: 100;
  }

  .preview-component-wrapper {
      pointer-events: auto; /* Re-enable clicks for input elements */
      display: flex;
      align-items: center;
      justify-content: center;
  }

  .preview-input-group {
      display: flex;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      pointer-events: auto; /* Ensure inputs are clickable */
  }

  .preview-real-input {
      flex: 1;
      height: 100%;
      outline: none;
      padding: 0 10px;
      border-top-right-radius: 0 !important;
      border-bottom-right-radius: 0 !important;
      transition: all 0.2s;
      box-sizing: border-box;
      cursor: text !important; /* Force I-beam cursor */
  }

  .preview-real-input:focus {
      background-color: var(--focus-bg) !important;
      border-color: var(--focus-border) !important;
  }

  .preview-input-btn {
      height: 100%;
      padding: 0 20px;
      border: none;
      cursor: pointer !important; /* Force pointer cursor */
      font-weight: bold;
      border-top-right-radius: 4px;
      border-bottom-right-radius: 4px;
      transition: background-color 0.2s;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
      min-width: fit-content;
  }
  
  .preview-input-btn:disabled {
      cursor: default !important;
      opacity: 0.9;
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

  /* Settings Overlay & Modal Styles */
  .settings-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.8);
    z-index: 200; /* Higher than header and other overlays */
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .settings-modal {
    background: #1f2937;
    width: 500px;
    max-width: 90%;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .settings-header {
    background: #111827;
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }

  .settings-header h3 {
    margin: 0;
    color: #e2e8f0;
    font-size: 1.1rem;
  }

  .close-settings-btn {
    background: transparent;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    font-size: 1.2rem;
    transition: color 0.2s;
  }

  .close-settings-btn:hover {
    color: #fff;
  }

  .settings-content {
    padding: 20px;
    min-height: 200px;
  }

  /* Settings Input Styles */
  .setting-item {
      margin-bottom: 20px;
  }

  .setting-label {
      display: block;
      color: #e2e8f0;
      font-weight: 600;
      margin-bottom: 6px;
  }

  .setting-desc {
      color: #9ca3af;
      font-size: 0.85rem;
      margin-bottom: 10px;
  }

  .setting-select {
      width: 100%;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 10px;
      color: #fff;
      font-size: 0.95rem;
      outline: none;
      cursor: pointer;
  }

  .setting-select:focus {
      border-color: #00ff88;
  }
  
  .setting-select option {
      background-color: #1f2937;
      color: #fff;
  }

  /* ==========================================================================
     NEW: SET VARIABLES EDITOR STYLES
     ========================================================================== */
  .set-variable-view {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.3);
  }

  .logic-editor-container {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 30px;
      width: 600px;
      max-width: 90%;
      display: flex;
      flex-direction: column;
      gap: 24px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  }

  .logic-header {
      text-align: center;
      margin-bottom: 10px;
  }

  .logic-header h3 {
      color: #8b5cf6; /* Matching purple node color */
      font-size: 1.5rem;
      margin: 0 0 8px 0;
  }

  .logic-header p {
      color: #9ca3af;
      margin: 0;
      font-size: 0.9rem;
  }

  .variable-logic-row {
      display: flex;
      align-items: flex-end;
      gap: 16px;
      justify-content: center;
      background: rgba(0,0,0,0.2);
      padding: 20px;
      border-radius: 8px;
  }

  .logic-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
  }

  .logic-group.small {
      flex: 0 0 60px; /* Fixed width for operator */
  }

  .logic-group.large {
      flex: 1.2;
  }

  .logic-group label {
      color: #e2e8f0;
      font-size: 0.85rem;
      font-weight: 500;
  }

  .logic-select, .logic-input {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      padding: 10px;
      color: #fff;
      font-size: 1rem;
      outline: none;
      width: 100%;
      box-sizing: border-box;
      transition: border-color 0.2s;
  }
  
  .logic-select option {
      background-color: #1f2937;
  }

  .logic-select:focus, .logic-input:focus {
      border-color: #8b5cf6;
  }

  .logic-select.operator {
      text-align: center;
      font-weight: bold;
      color: #8b5cf6;
      font-size: 1.2rem;
      background: rgba(139, 92, 246, 0.1);
      border-color: rgba(139, 92, 246, 0.3);
  }

  /* Toggle Buttons for Value Source */
  .value-type-toggle {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
  }

  .toggle-buttons {
      display: flex;
      background: rgba(0,0,0,0.3);
      border-radius: 4px;
      padding: 2px;
  }

  .toggle-buttons button {
      background: transparent;
      border: none;
      color: #6b7280;
      padding: 2px 8px;
      font-size: 0.75rem;
      cursor: pointer;
      border-radius: 3px;
      transition: all 0.2s;
  }

  .toggle-buttons button.active {
      background: #8b5cf6;
      color: #fff;
  }

  /* Equation Preview */
  .preview-equation {
      text-align: center;
      font-family: monospace;
      font-size: 1.1rem;
      color: #9ca3af;
      padding-top: 10px;
      border-top: 1px solid rgba(255,255,255,0.1);
  }

  .eq-part {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      margin: 0 4px;
  }

  .eq-part.target {
      color: #e2e8f0;
      background: rgba(255,255,255,0.05);
  }

  .eq-part.op {
      color: #8b5cf6;
      font-weight: bold;
  }

  .eq-part.value {
      color: #00ff88;
      background: rgba(0,255,136,0.1);
  }
  /* NEW: String Concatenation UI Styles */
.string-concat-ui {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(0,0,0,0.2);
    padding: 10px;
    border-radius: 6px;
}

.concat-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.concat-row label {
    font-size: 0.75rem;
    color: #9ca3af;
}

.var-badge-display {
    background: rgba(139, 92, 246, 0.15);
    border: 1px dashed rgba(139, 92, 246, 0.5);
    color: #a78bfa;
    padding: 6px;
    text-align: center;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9rem;
    font-weight: bold;
}

.center { 
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 1.2;
}

.title { 
  font-size: 1.4rem; 
  color: #00ff88; /* Keep the green accent for the project name */
  font-weight: 700;
  text-shadow: 0 0 10px rgba(0, 255, 136, 0.2);
  letter-spacing: 0.5px;
}

.subtitle {
  font-size: 0.85rem;
  color: #94a3b8; /* Muted gray for the 'by' text */
  margin-top: 2px;
  font-weight: 400;
}

.author-name {
  color: #e2e8f0; /* Lighter/White for the username */
  font-weight: 600;
}


.notification-popup {
    position: fixed;
    top: -60px; /* Hidden above screen */
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    border-radius: 0 0 12px 12px; /* Rounded bottom corners */
    color: white;
    font-weight: 600;
    font-size: 0.95rem;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    transition: top 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Bouncy effect */
    pointer-events: none;
}

.notification-popup.show {
    top: 0; /* Slide down */
}

.notification-popup.success {
    background: #10b981; /* Green */
    border: 1px solid #059669;
}

.notification-popup.error {
    background: #ef4444; /* Red */
    border: 1px solid #b91c1c;
}

/* --- AUTOSAVE TIMER --- */
.autosave-timer {
    font-family: 'Courier New', monospace;
    font-size: 1rem;
    color: #64748b;
    background: rgba(15, 23, 42, 0.6);
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
}

.autosave-timer.active {
    color: #cbd5e1;
    border-color: rgba(255, 255, 255, 0.3);
    background: rgba(15, 23, 42, 0.9);
}

.pulse-dot {
    color: #eab308; /* Yellow dot implies pending changes */
    font-size: 0.8rem;
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.4; }
    100% { opacity: 1; }
}


.header-actions {
    position: absolute;
    right: 20px;
    top: 50%; /* Push top edge to center */
    transform: translateY(-50%); /* Pull back up by half height to center perfectly */
    display: flex;
    align-items: center;
    gap: 15px; /* Space between buttons */
    z-index: 20;
}
.save-btn,
.play-project-btn,
.settings-btn,
.fullscreen-btn {
    position: relative !important; /* Force flexbox behavior */
    right: auto !important;        /* Reset any absolute positioning */
    top: auto !important;
    transform: none !important;    /* Reset any transforms */
    margin: 0 !important;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 1;
}
.save-btn:hover {
    background: rgba(59, 130, 246, 0.4);
    color: #fff;
}

/* Play Button */
.play-project-btn {
    font-size: 20px;
    background: none;
    border: none;
    color: #00ff88;
    width: 36px;
    height: 36px;
}
.play-project-btn:hover {
    transform: scale(1.2) !important; /* Re-apply hover scale */
    text-shadow: 0 0 8px rgba(0, 255, 136, 0.5);
}

/* Settings & Fullscreen Buttons */
.settings-btn,
.fullscreen-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #cbd5e1;
    width: 36px;
    height: 36px;
    border-radius: 6px;
    font-size: 1.1rem;
}
.settings-btn:hover,
.fullscreen-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.4);
}
.settings-btn:hover {
    transform: rotate(30deg) !important;
}
.save-btn {
    font-size: 16px;
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.5);
    color: #60a5fa;
    padding: 6px 12px;
    border-radius: 6px;
    gap: 6px;
}
.media-status-wrapper {
    position: relative;
    z-index: 50;
}

.media-status-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #cbd5e1;
    height: 36px;
    padding: 0 10px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s ease;
}

.media-status-btn:hover, .media-status-btn.active {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.4);
}

.media-status-btn.loading {
    border-color: #eab308;
    color: #eab308;
    background: rgba(234, 179, 8, 0.1);
}

.loader-icon {
    display: inline-block;
    animation: spin 1s linear infinite;
    font-weight: bold;
}

.count-badge {
    font-size: 0.75rem;
    font-family: monospace;
    background: rgba(0,0,0,0.3);
    padding: 2px 6px;
    border-radius: 4px;
}

/* --- DROPDOWN --- */
.media-status-dropdown {
    position: absolute;
    top: 45px;
    right: 0;
    width: 250px;
    background: #1f2937;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.media-header {
    background: rgba(0,0,0,0.2);
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    font-size: 0.85rem;
    color: #e2e8f0;
}

.media-header button {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
}

.media-list {
    max-height: 300px;
    overflow-y: auto;
    padding: 4px;
}

.media-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 0.85rem;
    color: #cbd5e1;
}

.media-item:hover {
    background: rgba(255,255,255,0.05);
}

.media-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.media-state {
    font-weight: bold;
}
.media-state.loading { color: #eab308; }
.media-state.loaded { color: #00ff88; }
.media-state.error { color: #ef4444; }

.empty-media {
    padding: 12px;
    text-align: center;
    color: #6b7280;
    font-style: italic;
    font-size: 0.8rem;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
.saving-overlay {
    position: fixed;
    inset: 0;
    background: rgba(10, 10, 15, 0.95); /* Deep dark background */
    backdrop-filter: blur(10px);
    z-index: 99999; /* Highest priority */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #fff;
}

/* Text Styling */
.saving-text-wrapper {
    margin-top: 40px;
    text-align: center;
    max-width: 600px;
    padding: 0 20px;
    animation: fadeUp 0.5s ease-out;
}

.saving-title {
    font-family: 'Courier New', monospace;
    font-size: 1.5rem;
    font-weight: bold;
    color: #00ff88;
    letter-spacing: 4px;
    margin-bottom: 16px;
    text-shadow: 0 0 15px rgba(0, 255, 136, 0.5);
    animation: pulseText 1.5s infinite;
}

.saving-tip {
    font-size: 1rem;
    color: #9ca3af;
    font-style: italic;
    line-height: 1.5;
    background: rgba(255, 255, 255, 0.05);
    padding: 12px 20px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

/* === LOOM ANIMATION === */
.loom-container {
    position: relative;
    width: 120px;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.loom-ring {
    position: absolute;
    border-radius: 50%;
    border: 2px solid transparent;
}

/* Outer Ring */
.outer {
    width: 100%;
    height: 100%;
    border-top-color: #00ff88;
    border-bottom-color: #00ff88;
    animation: spin 2s linear infinite;
    box-shadow: 0 0 20px rgba(0, 255, 136, 0.1);
}

/* Middle Ring */
.middle {
    width: 70%;
    height: 70%;
    border-left-color: #3b82f6;
    border-right-color: #3b82f6;
    animation: spinReverse 1.5s linear infinite;
    opacity: 0.8;
}

/* Inner Ring */
.inner {
    width: 40%;
    height: 40%;
    border-top-color: #eab308;
    border-right-color: #eab308;
    animation: spin 1s linear infinite;
}

/* Core */
.loom-core {
    width: 15%;
    height: 15%;
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 0 15px #fff, 0 0 30px #00ff88;
    animation: breathe 1s ease-in-out infinite alternate;
}

/* Particles/Data Bits */
.loom-particles span {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 4px;
    height: 4px;
    background: #fff;
    border-radius: 50%;
    opacity: 0;
}

.loom-particles span:nth-child(1) { animation: shoot 1.5s infinite 0s; transform: rotate(0deg); }
.loom-particles span:nth-child(2) { animation: shoot 1.5s infinite 0.4s; transform: rotate(90deg); }
.loom-particles span:nth-child(3) { animation: shoot 1.5s infinite 0.8s; transform: rotate(180deg); }
.loom-particles span:nth-child(4) { animation: shoot 1.5s infinite 1.2s; transform: rotate(270deg); }

/* Keyframes */
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

@keyframes spinReverse {
    0% { transform: rotate(360deg); }
    100% { transform: rotate(0deg); }
}

@keyframes breathe {
    0% { transform: scale(0.8); opacity: 0.5; }
    100% { transform: scale(1.2); opacity: 1; }
}

@keyframes pulseText {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
}

@keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes shoot {
    0% { transform: rotate(var(--r)) translateX(0); opacity: 1; }
    100% { transform: rotate(var(--r)) translateX(60px); opacity: 0; }
}

/* Save Button Disabled State */
.save-btn.disabled {
    opacity: 0.6;
    cursor: not-allowed !important;
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.2);
    color: #94a3b8;
}
</style>