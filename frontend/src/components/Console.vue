<script setup>
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const token = sessionStorage.getItem('token')

const myGames = ref([])
const loading = ref(true)

// Search & Carousel State
const searchQuery = ref('')
const currentIndex = ref(0)

// ================= COMPONENT RENDERING & ANIMATION ENGINE =================

const renderedComponentIds = ref([])
const currentCompIndex = ref(0)
const isBackgroundFading = ref(false)

const currentlyAnimatingIds = ref([])
const skippedAnimationIds = ref([])
const animationTimers = ref({})
const autoRenderTimer = ref(null)

/* ================= 📊 CONSOLE STATUS TRACKER (LOCAL STORAGE) ================= */
const savedStatus = sessionStorage.getItem('console_status_data')
const Console_Status = ref(savedStatus ? JSON.parse(savedStatus) : {
    actionHistory: [], 
    games: {} 
})

const startScene = () => {
    renderedComponentIds.value = []
    skippedAnimationIds.value = []
    currentlyAnimatingIds.value = []
    
    // Clear any lingering animation timers from the previous scene
    for (let key in animationTimers.value) {
        clearTimeout(animationTimers.value[key])
    }
    if (autoRenderTimer.value) {
        clearTimeout(autoRenderTimer.value)
        autoRenderTimer.value = null
    }
    
    currentCompIndex.value = 0
    isBackgroundFading.value = true // Block input
    
    // Wait for the background fade-in (1000ms)
    setTimeout(() => {
        isBackgroundFading.value = false
        checkInitialComponent()
    }, 1000)
}

const checkInitialComponent = () => {
    if (!currentNode.value || !currentNode.value.scenes) return;
    const scene = currentNode.value.scenes[currentSceneIndex.value];
    
    // Safeguard against empty scenes
    if (!scene || !scene.components || scene.components.length === 0) return;
    
    if (scene.components[0].autoRender) {
        advanceScene();
    }
}

const triggerAnimationWait = (comp) => {
    if (!comp.animationType || comp.animationType === 'none') return;
    
    currentlyAnimatingIds.value.push(comp.id);
    const durationMs = (comp.animationDuration || 1) * 1000;
    
    animationTimers.value[comp.id] = setTimeout(() => {
        currentlyAnimatingIds.value = currentlyAnimatingIds.value.filter(id => id !== comp.id);
    }, durationMs);
}
const advanceScene = () => {
    // 🛡️ Prevent clicks while the background is still fading in
    if (isBackgroundFading.value) return; 

    // 🛑 SKIP LOGIC: If an animation is playing, fast-forward it and STOP.
    if (currentlyAnimatingIds.value.length > 0) {
        currentlyAnimatingIds.value.forEach(id => {
            if (!skippedAnimationIds.value.includes(id)) {
                skippedAnimationIds.value.push(id);
            }
            if (animationTimers.value[id]) clearTimeout(animationTimers.value[id]);
        });
        currentlyAnimatingIds.value = [];
        
        // ⚡ FAST-FORWARD AUTO-RENDER: If we skip, immediately spawn the next auto-rendered item
        if (autoRenderTimer.value) {
            clearTimeout(autoRenderTimer.value);
            autoRenderTimer.value = null;
            advanceScene(); 
        }
        return; 
    }

    if (!currentNode.value || !currentNode.value.scenes) return;
    
    const scene = currentNode.value.scenes[currentSceneIndex.value];
    if (!scene || !scene.components) return;
    const comps = scene.components;
    
    // 🛑 SCENE TRANSITION LOGIC
    if (currentCompIndex.value >= comps.length) {
        // Prevent advancing if an input or option is waiting for interaction
        if (comps.some(c => c.type === 'options' || (c.type === 'input' && !c.isSubmitted))) return;
        
        // Go to next Scene
        if (currentSceneIndex.value < currentNode.value.scenes.length - 1) {
            currentSceneIndex.value++;
            startScene();
            return;
        }
        
        // Go to next Node
        let nextId = currentNode.value.Next;
        if (nextId !== null && nextId !== undefined) {
            const nextNode = activeEngineData.value.canvasState.nodes.find(n => n.index === nextId);
            if (nextNode) {
                currentNode.value = nextNode;
                currentSceneIndex.value = 0;
                startScene();
            } else {
                isPlaying.value = false;
            }
        } else {
            isPlaying.value = false; // End of game
        }
        return; 
    }

    // Reveal next component
    let nextComp = comps[currentCompIndex.value];
    if (!renderedComponentIds.value.includes(nextComp.id)) {
        renderedComponentIds.value.push(nextComp.id);
    }
    currentCompIndex.value++;
    triggerAnimationWait(nextComp);

    // ⏱️ CHECK FOR AUTO-RENDER SEQUENCING
    // Wait for the CURRENT component's animation to finish before spawning the next one
    if (currentCompIndex.value < comps.length) {
        const subsequentComp = comps[currentCompIndex.value];
        if (subsequentComp.autoRender) {
            const waitTime = (!nextComp.animationType || nextComp.animationType === 'none') 
                ? 0 
                : (nextComp.animationDuration || 1) * 1000;
                
            autoRenderTimer.value = setTimeout(() => {
                autoRenderTimer.value = null;
                advanceScene(); // Automatically trigger the next item
            }, waitTime);
        }
    }
}

const getAnimationCss = (comp) => {
    // ⚡ If user clicked to skip, strip the animation so it snaps to fully visible
    if (skippedAnimationIds.value.includes(comp.id)) return 'none';

    if (!comp.animationType || comp.animationType === 'none') return 'none';
    const duration = comp.animationDuration || 1;
    
    switch(comp.animationType) {
        case 'fade': return `fadeIn ${duration}s ease-in-out forwards`;
        case 'slide': return `slideIn ${duration}s ease-out forwards`;
        case 'typewriter': return `typewriter ${duration}s steps(40, end) forwards`;
        case 'zoom': return `zoomIn ${duration}s ease-out forwards`;
        default: return `fadeIn ${duration}s forwards`;
    }
}

watch(Console_Status, (newVal) => {
    sessionStorage.setItem('console_status_data', JSON.stringify(newVal))
}, { deep: true })

const trackAction = (actionName, details = {}) => {
    Console_Status.value.actionHistory.push({
        time: new Date().toLocaleTimeString(),
        action: actionName,
        ...details
    })
}

const activeGlobalVariables = computed(() => {
    return activeEngineData.value?.canvasState?.globalVariables || [];
})

/* ================= DATA FETCHING ================= */
const fetchConsole = async () => {
  try {
    const res = await fetch('http://localhost:5000/console', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      myGames.value = await res.json()
      trackAction("FETCHED_LIBRARY", { totalGames: myGames.value.length })
    }
  } catch (err) {
    console.error("Failed to load console:", err)
  } finally {
    loading.value = false
  }
}

const filteredGames = computed(() => {
  if (!searchQuery.value) return myGames.value
  const q = searchQuery.value.toLowerCase()
  return myGames.value.filter(g => 
    g.name.toLowerCase().includes(q) || 
    g.authorName.toLowerCase().includes(q)
  )
})

watch(filteredGames, (newVal) => {
    if (currentIndex.value >= newVal.length) {
        currentIndex.value = 0
    }
})

/* ================= CAROUSEL LOGIC ================= */
const next = () => {
  if (filteredGames.value.length === 0) return
  currentIndex.value = (currentIndex.value + 1) % filteredGames.value.length
}

const prev = () => {
  if (filteredGames.value.length === 0) return
  currentIndex.value = (currentIndex.value - 1 + filteredGames.value.length) % filteredGames.value.length
}

const getCardStyle = (index) => {
  const total = filteredGames.value.length;
  if (total === 0) return {};

  let diff = index - currentIndex.value;

  if (total > 2) {
    if (diff > Math.floor(total / 2)) diff -= total;
    else if (diff < -Math.floor(total / 2)) diff += total;
  }

  const absDiff = Math.abs(diff);
  const scale = Math.max(0.4, 1.1 - absDiff * 0.25);
  const translateX = diff * 180; 
  const zIndex = 100 - absDiff;
  const opacity = absDiff > 2 ? 0 : 1 - (absDiff * 0.15);

  return {
    transform: `translate(calc(-50% + ${translateX}px), -50%) scale(${scale})`,
    zIndex,
    opacity,
    visibility: opacity === 0 ? 'hidden' : 'visible'
  };
}

/* ================= INTERACTIONS ================= */
const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight') next()
    if (e.key === 'ArrowLeft') prev()
}

const handleWheel = (e) => {
    if (e.deltaY > 0 || e.deltaX > 0) next()
    else if (e.deltaY < 0 || e.deltaX < 0) prev()
}

const removeGame = async (id) => {
    myGames.value = myGames.value.filter(g => g._id !== id)
    trackAction("EJECTED_GAME", { gameId: id })
    try {
        await fetch(`http://localhost:5000/console/remove/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        })
    } catch(err) {
        console.error("Failed to remove", err)
    }
}

/* ================= GAME POPUP MODAL LOGIC & ANIMATION ================= */
const isPopupOpen = ref(false)
const activePostId = ref(null)
const activeDataTab = ref('pfp') // Controls the Game Data Tab Switcher

const gameInstances = ref([])
const isWorkspaceGameLoaded = ref(false)

const isInsertingCD = ref(false)
const insertingGameId = ref(null)

const activeInstanceId = ref(null)
const instanceInputRefs = ref({})

const activeInstanceName = computed(() => {
    const inst = gameInstances.value.find(i => i.id === activeInstanceId.value)
    return inst ? inst.name : 'Unknown Instance'
})

/* ================= GAME PLAYER STATE ================= */
const isPlaying = ref(false)
const currentNode = ref(null)
const currentSceneIndex = ref(0)

const windowSize = ref({ width: window.innerWidth, height: window.innerHeight })
const updateWindowSize = () => {
    windowSize.value = { width: window.innerWidth, height: window.innerHeight }
}

// Note: Vue allows multiple onMounted hooks, so this safely adds to your existing ones
onMounted(() => window.addEventListener('resize', updateWindowSize))
onUnmounted(() => window.removeEventListener('resize', updateWindowSize))

// 2. Compute the exact blueprint dimensions of the current node
const playerDimensions = computed(() => {
    if (!currentNode.value) return { width: 800, height: 600 } // Fallback
    return {
        width: currentNode.value.referenceWidth || 800,
        height: currentNode.value.referenceHeight || 600
    }
})

// 3. Calculate the perfect aspect-ratio fit (letterboxing)
const playerScale = computed(() => {
    const dims = playerDimensions.value
    const availableWidth = windowSize.value.width
    const availableHeight = windowSize.value.height

    const scaleX = availableWidth / dims.width
    const scaleY = availableHeight / dims.height

    // Return the smaller scale to ensure the whole scene fits inside the screen
    return Math.min(scaleX, scaleY)
})

// 4. Dynamically extract the background color for the active scene
const currentSceneBg = computed(() => {
    if (!currentNode.value || !currentNode.value.scenes || !currentNode.value.scenes[currentSceneIndex.value]) {
        return '#000000' // Default fallback
    }
    return currentNode.value.scenes[currentSceneIndex.value].backgroundColor || '#000000'
})

watch(gameInstances, (newInstances) => {
    if (activePostId.value && Console_Status.value.games[activePostId.value]) {
        Console_Status.value.games[activePostId.value].instances = newInstances;
    }
}, { deep: true })

const handleFullscreenChange = () => {
    if (!document.fullscreenElement && isPopupOpen.value) {
        closeGameModal(false) 
    }
}

watch(() => route.hash, (newHash) => {
    if (newHash !== '#playing' && isPopupOpen.value) {
        closeGameModal(true)
    }
})

const handlePlayClick = async (id) => {
    isInsertingCD.value = true
    insertingGameId.value = id
    trackAction("CD_INSERTION_STARTED", { gameId: id })

    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen()
        }
    } catch (err) {
        console.warn("Fullscreen request blocked/failed:", err)
    }

    lockLandscape()

    setTimeout(() => {
        openGameModal(id)
        isInsertingCD.value = false
        insertingGameId.value = null
    }, 2000)
}

const openGameModal = (id) => {
    activePostId.value = id
    isPopupOpen.value = true
    activeDataTab.value = 'pfp' // Reset tab on open
    
    if (!Console_Status.value.games[id]) {
        Console_Status.value.games[id] = { instances: [], achievements: { pfp: [], badges: [] } }
    }

    gameInstances.value = Console_Status.value.games[id].instances || []
    isWorkspaceGameLoaded.value = gameInstances.value.length > 0
    isEngineRunning.value = false
    activeInstanceId.value = null
    activeEngineData.value = null

    trackAction("OPENED_GAME_MODAL", { gameId: id })

    if (route.hash !== '#playing') {
        router.push({ hash: '#playing' })
    }
}

const closeGameModal = async (fromBackButton = false) => {
    isPopupOpen.value = false
    activePostId.value = null
    gameInstances.value = []
    isWorkspaceGameLoaded.value = false
    isEngineRunning.value = false
    activeInstanceId.value = null
    activeEngineData.value = null
    trackAction("CLOSED_GAME_MODAL")
    
    // --- CLEAR ANY PENDING RENDERS ---
    if (autoRenderTimer.value) {
        clearTimeout(autoRenderTimer.value)
        autoRenderTimer.value = null
    }
    // ---------------------------------
    
    unlockOrientation()

    if (document.fullscreenElement) {
        try { await document.exitFullscreen() } catch(e){}
    }

    if (!fromBackButton && route.hash === '#playing') {
        router.back()
    }
}

const centerOnRootNode = () => {
    if (!activeEngineData.value || !viewportCanvasRef.value) return;
    
    const state = activeEngineData.value.canvasState;
    const rootId = state?.rootNodeId;
    const rootNode = state?.nodes?.find(n => n.index === rootId);
    
    if (rootNode) {
        const canvas = viewportCanvasRef.value;
        const rect = canvas.parentElement.getBoundingClientRect();
        
        // The dimensions of your node blueprint (used in drawViewport)
        const nodeWidth = 220;
        const nodeHeight = 70;
        
        // Calculate the offset required to place the node in the exact center of the view
        viewportOffset.value = {
            x: (rect.width / 2) - (rootNode.x + (nodeWidth / 2)),
            y: (rect.height / 2) - (rootNode.y + (nodeHeight / 2))
        };
    }
}

const loadGamePreview = async (game) => {
    // If data is already loaded for this game, just focus and draw
    if (activeEngineData.value && activeEngineData.value._id === game._id) {
        isEngineRunning.value = true;
        await nextTick(); // Wait for canvas HTML to mount
        centerOnRootNode(); // <--- NEW: Auto Focus
        drawViewport();
        return;
    }

    try {
        const res = await fetch(`http://localhost:5000/posts/${game._id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
            const data = await res.json();
            activeEngineData.value = data.post || data; 
            
            isEngineRunning.value = true;
            trackAction("ENGINE_RUNNING");
            
            // Wait for Vue to render the <canvas> element
            await nextTick();
            centerOnRootNode(); // <--- NEW: Auto Focus
            drawViewport();
        } else {
            alert("Failed to fetch game data from the archive.");
        }
    } catch (e) {
        console.error("Engine Boot Failed:", e);
    }
}

const selectInstance = (id) => {
    activeInstanceId.value = id
    const game = filteredGames.value.find(g => g._id === activePostId.value)
    if (game) {
        loadGamePreview(game) // Action 1: Only load the workspace and preview
    }
}

const addGameInstance = async () => {
    const newId = Date.now()
    gameInstances.value.push({
        id: newId,
        name: `Instance ${gameInstances.value.length + 1}`
    })
    isWorkspaceGameLoaded.value = true
    trackAction("ADDED_INSTANCE", { gameId: activePostId.value, totalInstances: gameInstances.value.length })

    selectInstance(newId)

    await nextTick()
    if (instanceInputRefs.value[newId]) {
        instanceInputRefs.value[newId].focus()
    }
}

const removeGameInstance = (id) => {
    gameInstances.value = gameInstances.value.filter(inst => inst.id !== id)
    
    if (activeInstanceId.value === id) {
        activeInstanceId.value = null
        isEngineRunning.value = false
    }

    if (gameInstances.value.length === 0) {
        isWorkspaceGameLoaded.value = false
        isEngineRunning.value = false
    }
    trackAction("REMOVED_INSTANCE", { gameId: activePostId.value, totalInstances: gameInstances.value.length })
}

/* ================= GAME ENGINE & VIEWPORT LOGIC ================= */
const isEngineRunning = ref(false)
const viewportCanvasRef = ref(null)
const activeEngineData = ref(null)

const viewportOffset = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })

/* ================= 🏆 ACHIEVEMENTS DATA LOGIC ================= */
const activeGameGiftCounts = computed(() => {
    const gameId = activePostId.value;
    if (!gameId) return { pfp: 0, badges: 0 };
    
    // 1. ENGINE MEMORY (Highest Priority - Live Scan)
    if (activeEngineData.value && activeEngineData.value._id === gameId) {
        let pfp = 0;
        let badges = 0;
        const state = activeEngineData.value.canvasState;
        const nodes = state?.nodes || [];

        const connected = new Set();
        const addConnection = (val) => {
            if (val !== null && val !== undefined && val !== "") connected.add(Number(val));
        };

        if (state?.rootNodeId !== undefined && state?.rootNodeId !== null) {
            connected.add(Number(state.rootNodeId));
        }

        // Pass 1: Map all connections
        nodes.forEach(n => {
            addConnection(n.Next);
            addConnection(n.NextTrue);
            addConnection(n.NextFalse);
            if (n.options && Array.isArray(n.options)) {
                n.options.forEach(o => addConnection(o.next));
            }
        });

        // Pass 2: Count valid, connected gifts
        nodes.forEach(node => {
            const typeStr = String(node.node_type || node.Node_type || node.type || node.name || node.Node_name || "");
            
            if (typeStr.toLowerCase() === 'gift' && connected.has(Number(node.index))) {
                const mode = String(node.giftMode || (node.data && node.data.giftMode) || (node.Node_data && node.Node_data.giftMode) || 'pfp').toLowerCase();
                if (mode === 'badge') badges++;
                else pfp++;
            }
        });
        return { pfp, badges };
    }

    // 2. BACKEND DATA (Quick load for Console UI before Engine Boot)
    const game = filteredGames.value.find(g => g._id === gameId);
    
    // If DB has valid scanned numbers (!== -1), trust them instantly
    if (game && game.giftCounts && game.giftCounts.pfp !== -1 && game.giftCounts.pfp !== undefined) {
        return game.giftCounts;
    }

    // 3. LEGACY FALLBACK (Before engine boots)
    return { pfp: '?', badges: '?' };
});



const unlockedPfps = computed(() => {
    if (!activePostId.value || !Console_Status.value.games[activePostId.value]) return 0;
    return Console_Status.value.games[activePostId.value].achievements?.pfp?.length || 0;
});

const unlockedBadges = computed(() => {
    if (!activePostId.value || !Console_Status.value.games[activePostId.value]) return 0;
    return Console_Status.value.games[activePostId.value].achievements?.badges?.length || 0;
});
/* ============================================================== */

const startGame = async (game) => {
    // Prevent unpurchased paid games
    if (game.monetization?.isPaid && !game.monetization?.hasDemo) {
        alert("🔒 Purchase Required: This game is paid and has no demo.");
        trackAction("START_DENIED_PAID", { gameId: game._id })
        return;
    }

    trackAction("GAME_STARTED", { gameId: game._id, instanceId: activeInstanceId.value })

    // Ensure we have the data loaded just in case
    if (!activeEngineData.value || activeEngineData.value._id !== game._id) {
        await loadGamePreview(game);
    }
    
    // Extract Canvas State
    const state = activeEngineData.value.canvasState;
    
    // Find the Root Node
    const rootId = state?.rootNodeId;
    const rootNode = state?.nodes?.find(n => n.index === rootId);
    
    if (rootNode) {
        currentNode.value = rootNode;
        currentSceneIndex.value = 0; // Start at the first scene
        isPlaying.value = true; // Launch the player overlay
        startScene();
    } else {
        alert("Error: No entry point found in this game.");
    }
}

const startPan = (e) => {
    isPanning.value = true;
    panStart.value = { x: e.clientX - viewportOffset.value.x, y: e.clientY - viewportOffset.value.y };
}

const panMove = (e) => {
    if (!isPanning.value) return;
    viewportOffset.value.x = e.clientX - panStart.value.x;
    viewportOffset.value.y = e.clientY - panStart.value.y;
    drawViewport(); 
}

const stopPan = () => {
    if (isPanning.value) trackAction("PANNED_VIEWPORT", { x: viewportOffset.value.x, y: viewportOffset.value.y })
    isPanning.value = false;
}

const drawViewport = () => {
    if (!viewportCanvasRef.value || !isEngineRunning.value || !activeEngineData.value) return;
    
    const canvas = viewportCanvasRef.value;
    const ctx = canvas.getContext('2d');
    
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(viewportOffset.value.x, viewportOffset.value.y);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    
    const offsetX = viewportOffset.value.x;
    const offsetY = viewportOffset.value.y;
    const startX = -offsetX - gridSize;
    const endX = startX + canvas.width + (gridSize * 2);
    const startY = -offsetY - gridSize;
    const endY = startY + canvas.height + (gridSize * 2);

    const gridStartX = Math.floor(startX / gridSize) * gridSize;
    const gridStartY = Math.floor(startY / gridSize) * gridSize;

    ctx.beginPath();
    for(let x = gridStartX; x < endX; x += gridSize) {
        ctx.moveTo(x, startY); ctx.lineTo(x, endY);
    }
    for(let y = gridStartY; y < endY; y += gridSize) {
        ctx.moveTo(startX, y); ctx.lineTo(endX, y);
    }
    ctx.stroke();

    const rootId = activeEngineData.value.canvasState?.rootNodeId;
    const rootNode = activeEngineData.value.canvasState?.nodes?.find(n => n.index === rootId);

    if (rootNode) {
        const nw = 220; const nh = 70;  
        
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; 
        ctx.strokeStyle = '#3b82f6'; 
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.roundRect(rootNode.x, rootNode.y, nw, nh, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '600 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rootNode.Node_name || 'Root Node', rootNode.x + nw/2, rootNode.y + nh/2);
        
        ctx.fillStyle = '#10b981'; 
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('ENTRY POINT', rootNode.x + nw/2, rootNode.y - 10);
    }

    ctx.restore();
}

const lockLandscape = async () => {
    if (screen.orientation && screen.orientation.lock) {
        try { await screen.orientation.lock('landscape') } catch (err) {}
    }
}

const unlockOrientation = () => {
    if (screen.orientation && screen.orientation.unlock) {
        try { screen.orientation.unlock() } catch (err) {}
    }
}

onMounted(() => {
  fetchConsole()
  window.addEventListener('keydown', handleKeyDown)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
})
</script>

<template>
  <div class="console-page">
    
    <nav class="console-header" :class="{ 'is-inserting-mode': isInsertingCD }">
      <button @click="router.back()" class="back-btn">← Eject</button>
      
      <div class="search-wrapper">
         <span class="search-icon">🔍</span>
         <input type="text" v-model="searchQuery" placeholder="Search your library..." class="console-search"/>
      </div>

      <h1 class="console-title">🎮 Console</h1>
    </nav>

    <div v-if="loading" class="center-msg"><div class="spinner"></div><p>Loading Library...</p></div>

    <div v-else-if="filteredGames.length === 0" class="empty-state">
      <h2>{{ searchQuery ? 'No games match your search.' : 'Your console is empty.' }}</h2>
      <button v-if="!searchQuery" @click="router.push('/home')" class="explore-btn">Go to Store</button>
    </div>

    <div v-else class="carousel-stage" :class="{ 'is-inserting-mode': isInsertingCD }" @wheel.prevent="handleWheel">
        <button class="nav-arrow left" :class="{ 'is-inserting-mode': isInsertingCD }" @click="prev">❮</button>

        <div class="cd-track">
            
            <div class="cd-mask" :class="{ 'is-inserting-mode': isInsertingCD }">
                <div 
                    v-for="(game, index) in filteredGames" 
                    :key="game._id" 
                    class="cd-item"
                    :class="{ 
                        'active-cd': index === currentIndex,
                        'inserting': isInsertingCD && game._id === insertingGameId 
                    }"
                    :style="getCardStyle(index)"
                    @click="currentIndex = index"
                >
                    <div class="cd-disc">
                        <div class="cd-art" :style="{ backgroundImage: `url(${game.thumbnail || '/placeholder.jpg'})` }"></div>
                        <div class="cd-shine"></div>
                        <div class="cd-hole"><div class="cd-inner-ring"></div></div>
                    </div>
                </div>
            </div>

            <div class="cd-slot" :class="{ 'active': isInsertingCD }">
                <div class="slot-light"></div>
            </div>

        </div>

        <button class="nav-arrow right" :class="{ 'is-inserting-mode': isInsertingCD }" @click="next">❯</button>
    </div>

    <div v-if="filteredGames.length > 0 && !loading" class="active-game-info" :class="{ 'is-inserting-mode': isInsertingCD }">
        <h2 class="game-name">{{ filteredGames[currentIndex]?.name }}</h2>
        <p class="game-author">by {{ filteredGames[currentIndex]?.authorName }}</p>
        
        <div class="action-buttons">
            <button class="play-btn" :disabled="isInsertingCD" @click="handlePlayClick(filteredGames[currentIndex]._id)">
                {{ isInsertingCD ? 'Loading...' : '▶ Play Game' }}
            </button>
            <button class="remove-btn" :disabled="isInsertingCD" @click="removeGame(filteredGames[currentIndex]._id)">
                ⏏ Remove
            </button>
        </div>
    </div>

    <transition name="fade">
        <div v-if="isPopupOpen" class="game-modal-overlay">
            <div class="game-modal-content">
                <div v-if="isPlaying" class="fullscreen-player">
                    <button class="exit-player-btn" @click="isPlaying = false">
                        ⏸️ Pause / Exit
                    </button>

                    <div class="player-container" @click="advanceScene"
                        :key="`scene-${currentSceneIndex}`"
                        :style="{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            width: playerDimensions.width + 'px',
                            height: playerDimensions.height + 'px',
                            transform: `translate(-50%, -50%) scale(${playerScale})`,
                            backgroundColor: currentSceneBg,
                            cursor: isBackgroundFading ? 'wait' : 'pointer',
                            overflow: 'hidden',
                            animation: 'sceneBgFadeIn 1s ease-in-out forwards'
                        }"
                    >
                        <template v-if="currentNode && currentNode.scenes && currentNode.scenes[currentSceneIndex]">
                            <template v-for="(comp, index) in currentNode.scenes[currentSceneIndex].components" :key="comp.id">
                                
                                <div 
                                    v-if="renderedComponentIds.includes(comp.id)" 
                                    class="component-wrapper"
                                    :style="{
                                        position: 'absolute',
                                        /* MULTIPLY BY 2 AND SUBTRACT Y TO MATCH CANVAS MATH */
                                        left: `calc(50% + ${comp.x * 2}px)`,
                                        top: `calc(50% - ${comp.y * 2}px)`,
                                        width: `${comp.width}px`,
                                        height: `${comp.height}px`,
                                        transform: `translate(-50%, -50%) rotate(${comp.rotation || 0}deg)`,
                                        zIndex: comp.zIndex || index || 10
                                    }">
                                    
                                    <div :style="{ width: '100%', height: '100%', animation: getAnimationCss(comp) }">

                                        <div v-if="comp.type === 'text'" :style="{
                                            color: comp.color, fontSize: comp.fontSize + 'px', fontFamily: comp.fontFamily,
                                            fontWeight: comp.fontWeight, fontStyle: comp.fontStyle,
                                            textDecoration: `${comp.textDecoration} ${comp.textDecorationColor}`,
                                            backgroundColor: comp.backgroundColor, border: `${comp.borderWidth}px solid ${comp.borderColor}`,
                                            borderRadius: comp.borderRadius + 'px', width: '100%', height: '100%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            whiteSpace: 'pre-wrap', textAlign: 'center'
                                        }">
                                            {{ comp.content }}
                                        </div>

                                        <img v-else-if="comp.type === 'image'" :src="comp.url" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;" />

                                        <video v-else-if="comp.type === 'video'" :src="comp.url" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;" autoplay loop :muted="comp.isMuted"></video>

                                        <div v-else-if="comp.type === 'options'" @click.stop :style="{
                                            width: '100%', height: '100%', backgroundColor: comp.boxColor, opacity: comp.boxOpacity,
                                            border: `${comp.borderWidth}px solid ${comp.borderColor}`, borderRadius: comp.borderRadius + 'px',
                                            display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px', overflowY: 'auto'
                                        }">
                                            <button v-for="opt in comp.optionsList" :key="opt.id"
                                                :style="{
                                                    backgroundColor: comp.styles?.normal?.backgroundColor || '#374151',
                                                    color: comp.styles?.normal?.color || '#ffffff',
                                                    border: `${comp.styles?.normal?.borderWidth || 1}px solid ${comp.styles?.normal?.borderColor || '#9ca3af'}`,
                                                    borderRadius: (comp.styles?.normal?.borderRadius || 4) + 'px',
                                                    fontSize: (comp.styles?.normal?.fontSize || 16) + 'px',
                                                    fontFamily: comp.styles?.normal?.fontFamily || 'sans-serif',
                                                    padding: '8px', cursor: 'pointer', transition: '0.2s'
                                                }"
                                                @mouseover="$event.target.style.backgroundColor = comp.styles?.hovered?.backgroundColor || '#4b5563'; $event.target.style.borderColor = comp.styles?.hovered?.borderColor || '#00ff88';"
                                                @mouseleave="$event.target.style.backgroundColor = comp.styles?.normal?.backgroundColor || '#374151'; $event.target.style.borderColor = comp.styles?.normal?.borderColor || '#9ca3af';"
                                            >
                                                {{ opt.text }}
                                            </button>
                                        </div>

                                        <div v-else-if="comp.type === 'input'" @click.stop :style="{ width: '100%', height: '100%', display: 'flex', gap: '5px' }">
                                            <input type="text" :placeholder="comp.placeholderText" :style="{
                                                flex: 1, padding: '8px', backgroundColor: comp.backgroundColor, color: '#000',
                                                border: `${comp.borderWidth}px solid ${comp.borderColor}`, borderRadius: comp.borderRadius + 'px',
                                                fontSize: comp.fontSize + 'px', fontFamily: comp.fontFamily
                                            }" />
                                            <button :style="{
                                                backgroundColor: comp.buttonNormalColor, color: comp.buttonTextColor,
                                                padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer'
                                            }">
                                                {{ comp.buttonText }}
                                            </button>
                                        </div>

                                        <div v-else-if="comp.type === 'variable'" :style="{
                                            color: comp.color, fontSize: comp.fontSize + 'px', fontFamily: comp.fontFamily,
                                            fontWeight: comp.fontWeight, fontStyle: comp.fontStyle,
                                            textDecoration: `${comp.textDecoration} ${comp.textDecorationColor}`,
                                            backgroundColor: comp.backgroundColor, border: `${comp.borderWidth}px solid ${comp.borderColor}`,
                                            borderRadius: comp.borderRadius + 'px', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }">
                                            {{ activeGlobalVariables.find(v => v.id == comp.variableId)?.value ?? 0 }}
                                        </div>

                                    </div>
                                </div>
                            </template>
                        </template>
                    </div>
                    
                </div>
                <div v-show="!isPlaying" style="display: flex; flex-direction: column; width: 100%; height: 100%;">
                    <div class="workspace-header">
                        <button class="close-modal-btn" @click="closeGameModal(false)">✕ Close</button>
                        <div class="workspace-header-title">Console Workspace</div>
                        <button class="start-game-btn" :disabled="!activeInstanceId" @click="startGame(filteredGames.find(g => g._id === activePostId))">
                            ▶ Start
                        </button>       
                    </div>

                    <div class="workspace-grid">
                
                    <div class="workspace-left">
                        
                        <div class="workspace-box top-square">
                            <h3 class="box-title">Game Instances</h3>
                            <div class="instances-container">
                                <div v-if="gameInstances.length === 0" class="empty-instances"><p class="placeholder-desc">No instances running.</p></div>
                                <div v-else class="instance-list">
                                    <div v-for="(inst, idx) in gameInstances" :key="inst.id" 
                                         class="instance-item"
                                         :class="{ 'active': activeInstanceId === inst.id }"
                                         @click="selectInstance(inst.id)">
                                        
                                        <div class="instance-status-dot" :class="{ 'running': activeInstanceId === inst.id }"></div>
                                        
                                        <input 
                                            type="text" 
                                            v-model="inst.name" 
                                            class="rename-input" 
                                            placeholder="Instance Name" 
                                            :ref="el => { if (el) instanceInputRefs[inst.id] = el }"
                                            @click.stop
                                        />
                                        
                                        <button class="remove-inst-btn" @click.stop="removeGameInstance(inst.id)" title="Delete">✕</button>
                                    </div>
                                </div>
                            </div>
                            <button class="load-btn" @click="addGameInstance">+ Add Instance</button>
                        </div>

                        <div class="workspace-box bottom-rect">
                            <h3 class="box-title">Game Data</h3>
                            
                            <div v-if="activePostId" class="game-data-content">
                                
                                <div class="data-tabs">
                                    <button class="data-tab-btn" :class="{ active: activeDataTab === 'pfp' }" @click="activeDataTab = 'pfp'">
                                        🖼️ PFPs
                                    </button>
                                    <button class="data-tab-btn" :class="{ active: activeDataTab === 'badge' }" @click="activeDataTab = 'badge'">
                                        🎖️ Badges
                                    </button>
                                </div>

                                <div v-if="activeDataTab === 'pfp'" class="achievement-section" :class="{ 'is-disabled': activeGameGiftCounts.pfp === 0 }">
                                    <template v-if="activeGameGiftCounts.pfp !== 0">
                                        <div class="ach-header">
                                            <div class="ach-title-wrap">
                                                <span class="ach-title">Profile Pictures</span>
                                            </div>
                                            <span class="ach-count" v-if="activeGameGiftCounts.pfp > 0 || activeGameGiftCounts.pfp === '?'">
                                                <span class="highlight">{{ unlockedPfps }}</span> / {{ activeGameGiftCounts.pfp }}
                                            </span>
                                        </div>
                                        <div class="ach-progress">
                                            <div class="ach-fill" :style="{ width: activeGameGiftCounts.pfp !== '?' ? (unlockedPfps / activeGameGiftCounts.pfp * 100) + '%' : '0%' }"></div>
                                        </div>
                                    </template>
                                    <template v-else>
                                        <div class="ach-empty-disabled">
                                            <span class="icon">🖼️</span>
                                            <span>No PFPs available</span>
                                        </div>
                                    </template>
                                </div>

                                <div v-if="activeDataTab === 'badge'" class="achievement-section" :class="{ 'is-disabled': activeGameGiftCounts.badges === 0 }">
                                    <template v-if="activeGameGiftCounts.badges !== 0">
                                        <div class="ach-header">
                                            <div class="ach-title-wrap">
                                                <span class="ach-title">Badges</span>
                                            </div>
                                            <span class="ach-count" v-if="activeGameGiftCounts.badges > 0 || activeGameGiftCounts.badges === '?'">
                                                <span class="highlight">{{ unlockedBadges }}</span> / {{ activeGameGiftCounts.badges }}
                                            </span>
                                        </div>
                                        <div class="ach-progress">
                                            <div class="ach-fill badge-fill" :style="{ width: activeGameGiftCounts.badges !== '?' ? (unlockedBadges / activeGameGiftCounts.badges * 100) + '%' : '0%' }"></div>
                                        </div>
                                    </template>
                                    <template v-else>
                                        <div class="ach-empty-disabled">
                                            <span class="icon">🎖️</span>
                                            <span>No Badges available</span>
                                        </div>
                                    </template>
                                </div>

                            </div>
                            <p v-else class="placeholder-text">Open a game to view data.</p>
                        </div>
                        
                    </div>

                    <div class="workspace-right">
                        <div class="workspace-box main-viewport" style="padding: 0; position: relative;">
                            
                            <template v-if="!isEngineRunning">
                                <h2 class="placeholder-watermark">
                                    Select or Create an Instance
                                </h2>
                                <p class="placeholder-text">[ Primary Viewport / Engine Render Area ]</p>
                            </template>

                            <template v-else>
                                <div class="viewport-header">
                                    <span class="status-pulse"></span>
                                    <span class="header-instance-name">{{ activeInstanceName }}</span>
                                    <span class="header-game-name">— {{ filteredGames.find(g => g._id === activePostId)?.name }}</span>
                                </div>

                                <canvas 
                                    ref="viewportCanvasRef" 
                                    style="width: 100%; height: 100%; outline: none; display: block;" 
                                    :style="{ cursor: isPanning ? 'grabbing' : 'grab' }" 
                                    @mousedown="startPan" @mousemove="panMove" @mouseup="stopPan" @mouseleave="stopPan">
                                </canvas>
                            </template>

                        </div>
                    </div>
                    </div>
                </div>
            </div>

            <div class="portrait-warning">
                <div class="rotate-icon">📱↻</div>
                <h2>Rotate Device</h2>
                <p>Please turn your device to Landscape mode for the best gaming experience.</p>
                <button class="close-warning-btn" @click="closeGameModal(false)">Cancel</button>
            </div>
        </div>
    </transition>
  </div>
</template>

<style scoped>
.console-page {
  min-height: 100vh;
  background: radial-gradient(circle at center, #0f172a 0%, #020617 100%);
  color: #fff;
  font-family: 'Inter', sans-serif;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ================= HEADER & SEARCH ================= */
.console-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 5%;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  background: rgba(2, 6, 23, 0.6);
  backdrop-filter: blur(10px);
  z-index: 10;
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.console-header.is-inserting-mode {
  opacity: 0 !important;
  transform: translateY(-20px) !important;
  pointer-events: none;
}

.back-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #cbd5e1;
  padding: 8px 20px;
  border-radius: 20px;
  cursor: pointer;
  transition: 0.2s;
  font-weight: 600;
}
.back-btn:hover { background: #ef4444; color: white; border-color: #ef4444; }

.console-title {
  margin: 0;
  font-family: 'Cinzel', serif;
  font-size: 1.8rem;
  color: #3b82f6;
  text-shadow: 0 0 15px rgba(59, 130, 246, 0.4);
}

.search-wrapper {
  position: relative;
  width: 100%;
  max-width: 400px;
}
.search-icon { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); opacity: 0.5; }
.console-search {
  width: 100%;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: white;
  padding: 10px 15px 10px 40px;
  border-radius: 30px;
  outline: none;
  transition: 0.3s;
}
.console-search:focus { border-color: #3b82f6; background: rgba(255,255,255,0.1); box-shadow: 0 0 15px rgba(59,130,246,0.3); }

/* ================= 3D COVERFLOW STAGE ================= */
.carousel-stage {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    width: 100%;
    margin-top: 2rem;
    perspective: 1000px;
}

.carousel-stage.is-inserting-mode .cd-item:not(.inserting) {
    opacity: 0 !important;
    filter: blur(10px);
    transform: translate(-50%, -50%) scale(0.3) !important;
    pointer-events: none;
}

.cd-track {
    position: relative;
    width: 100%;
    height: 350px;
    max-width: 1200px;
}

.cd-mask {
    position: absolute;
    inset: 0; 
}

.cd-mask.is-inserting-mode {
    clip-path: inset(-100vh -100vw 0 -100vw);
}

.nav-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.3);
    font-size: 3rem;
    cursor: pointer;
    z-index: 50;
    transition: all 0.3s ease;
    padding: 20px;
}
.nav-arrow:hover { color: white; text-shadow: 0 0 15px #3b82f6; }
.nav-arrow.left { left: 5%; }
.nav-arrow.right { right: 5%; }
.nav-arrow.is-inserting-mode { opacity: 0 !important; pointer-events: none; }

/* ================= CD ITEMS ================= */
.cd-item {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 260px;
    height: 260px;
    transition: all 0.5s cubic-bezier(0.25, 1, 0.5, 1);
    cursor: pointer;
}

.cd-disc {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #000;
  border: 4px solid #334155; 
  box-shadow: 
    0 20px 40px rgba(0,0,0,0.8),
    inset 0 0 10px rgba(255,255,255,0.2),
    -10px 0 15px rgba(0,0,0,0.5); 
  overflow: hidden;
  position: relative;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.active-cd .cd-disc {
  border-color: #3b82f6;
  box-shadow: 
    0 30px 60px rgba(0,0,0,0.9),
    0 0 40px rgba(59, 130, 246, 0.5),
    inset 0 0 15px rgba(255,255,255,0.4);
}

.cd-art {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  border-radius: 50%;
}

.active-cd .cd-art { animation: spin-cd 5s linear infinite; }
@keyframes spin-cd {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.cd-shine {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(
    from 45deg, 
    rgba(255,0,0,0.1) 0%, 
    rgba(255,255,0,0.1) 16%, 
    rgba(0,255,0,0.1) 33%, 
    rgba(0,255,255,0.1) 50%, 
    rgba(0,0,255,0.1) 66%, 
    rgba(255,0,255,0.1) 83%, 
    rgba(255,0,0,0.1) 100%
  );
  mix-blend-mode: screen;
  pointer-events: none;
  z-index: 2;
}

.cd-hole {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 55px;
  height: 55px;
  background: #020617; 
  border-radius: 50%;
  z-index: 3;
  box-shadow: 
    inset 0 4px 8px rgba(0,0,0,0.9),
    0 0 0 6px rgba(255,255,255,0.1),
    0 2px 15px rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cd-inner-ring {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.05);
}

/* ================= CD INSERTION ANIMATION ================= */
.cd-slot {
    position: absolute;
    bottom: 0px; 
    left: 50%;
    transform: translate(-50%, 50%); 
    width: 280px;
    height: 12px;
    background: #000;
    border: 2px solid #334155;
    border-radius: 10px;
    box-shadow: inset 0 5px 15px rgba(0,0,0,1);
    opacity: 0;
    transition: opacity 0.4s ease, box-shadow 0.4s ease;
    z-index: 160; 
    display: flex;
    align-items: center;
    justify-content: center;
}

.cd-slot.active {
    opacity: 1;
    box-shadow: inset 0 5px 15px rgba(0,0,0,1), 0 0 25px rgba(59, 130, 246, 0.8);
    border-color: #3b82f6;
}

.slot-light {
    width: 70%;
    height: 2px;
    background: #ef4444;
    box-shadow: 0 0 10px #ef4444;
    transition: 0.5s;
    z-index: 165;
}

.cd-slot.active .slot-light {
    background: #10b981;
    box-shadow: 0 0 15px #10b981;
}

.cd-item.inserting {
    animation: insert-cd-anim 2s forwards cubic-bezier(0.4, 0, 0.2, 1) !important;
    z-index: 150 !important; 
}

.cd-item.inserting .cd-art {
    animation: insert-spin 2s forwards cubic-bezier(0.2, 0.8, 0.2, 1) !important;
}

@keyframes insert-cd-anim {
    0% { transform: translate(-50%, -50%) scale(1.1); }
    15% { transform: translate(-50%, calc(-50% - 30px)) scale(1.15); } 
    35% { transform: translate(-50%, calc(-50% + 70px)) scale(0.85); } 
    45% { transform: translate(-50%, calc(-50% + 70px)) scale(0.85); } 
    100% { transform: translate(-50%, calc(-50% + 300px)) scale(0.85); } 
}

@keyframes insert-spin {
    0% { transform: rotate(0deg); }
    35% { transform: rotate(1080deg); } 
    100% { transform: rotate(1080deg); } 
}

/* ================= ACTIVE GAME INFO ================= */
.active-game-info {
    text-align: center;
    margin-bottom: 4rem;
    z-index: 20;
    animation: fade-up 0.5s ease;
    transition: opacity 0.4s ease, transform 0.4s ease;
}

.active-game-info.is-inserting-mode {
    opacity: 0 !important;
    transform: translateY(30px) !important;
    pointer-events: none;
}

@keyframes fade-up {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

.game-name {
    font-size: 2.5rem;
    margin: 0 0 5px 0;
    text-shadow: 0 4px 15px rgba(0,0,0,0.8);
    background: linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.game-author {
    color: #94a3b8;
    font-size: 1.1rem;
    margin: 0 0 20px 0;
    letter-spacing: 1px;
}

.action-buttons {
    display: flex;
    gap: 15px;
    justify-content: center;
}

.play-btn, .remove-btn {
    padding: 12px 30px;
    border-radius: 30px;
    font-weight: 700;
    font-size: 1.1rem;
    cursor: pointer;
    transition: 0.2s;
    border: none;
}

.play-btn {
    background: #3b82f6;
    color: white;
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
}
.play-btn:hover:not(:disabled) { background: #2563eb; transform: scale(1.05); box-shadow: 0 0 30px rgba(59, 130, 246, 0.6); }

.remove-btn {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
}
.remove-btn:hover:not(:disabled) { background: #ef4444; color: white; transform: scale(1.05); box-shadow: 0 0 20px rgba(239, 68, 68, 0.4); }

/* ================= UTILS ================= */
.center-msg { text-align: center; color: #64748b; margin-top: 10rem; display: flex; flex-direction: column; align-items: center; gap: 15px; }
.spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
.empty-state { text-align: center; margin-top: 10rem; color: #94a3b8; }
.explore-btn { margin-top: 1rem; background: #3b82f6; color: white; border: none; padding: 10px 30px; border-radius: 20px; font-weight: 600; cursor: pointer; }


/* ================= FULLSCREEN WORKSPACE MODAL ================= */
.game-modal-overlay {
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(2, 6, 23, 0.95);
    z-index: 100000;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(10px);
}

.game-modal-content {
    width: 100vw;
    height: 100vh;
    background: #0f172a;
    border: none;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* Modal Header */
.workspace-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 25px;
    background: rgba(2, 6, 23, 0.8);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.workspace-header-title {
    color: #94a3b8;
    font-size: 1.2rem;
    font-family: 'Cinzel', serif;
    letter-spacing: 2px;
}

.close-modal-btn {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
    padding: 8px 16px;
    border-radius: 20px;
    cursor: pointer;
    font-weight: bold;
    transition: 0.2s;
}
.close-modal-btn:hover { background: #ef4444; color: white; }

.start-game-btn {
    background: #10b981;
    color: #fff;
    border: none;
    padding: 8px 24px;
    border-radius: 20px;
    font-weight: bold;
    cursor: pointer;
    transition: 0.3s;
    box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
}
.start-game-btn:disabled {
    background: #334155;
    color: #64748b;
    box-shadow: none;
    cursor: not-allowed;
    opacity: 0.7;
}
.start-game-btn:not(:disabled):hover {
    background: #059669;
    transform: scale(1.05);
}

/* Workspace Grid System */
.workspace-grid {
    display: flex;
    flex: 1;
    gap: 20px;
    padding: 20px;
    overflow: hidden;
}

.workspace-left {
    width: 320px;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.workspace-right {
    flex: 1;
    display: flex;
}

.workspace-box {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
}

/* Specific Box Styling */
.top-square {
    height: 250px; 
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
}

.bottom-rect {
    flex: 1; 
    display: flex;
    flex-direction: column;
}

.main-viewport {
    flex: 1; 
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5); 
    border: 1px dashed rgba(59, 130, 246, 0.3);
}

/* ENGINE VIEWPORT HEADER */
.viewport-header {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    background: rgba(15, 23, 42, 0.85);
    border-bottom: 1px solid rgba(59, 130, 246, 0.3);
    padding: 10px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 10;
    backdrop-filter: blur(8px);
}
.header-instance-name {
    color: #fff;
    font-weight: 700;
    font-size: 0.95rem;
    letter-spacing: 0.5px;
}
.header-game-name {
    color: #94a3b8;
    font-size: 0.85rem;
    font-style: italic;
}
.status-pulse {
    width: 8px;
    height: 8px;
    background: #10b981;
    border-radius: 50%;
    box-shadow: 0 0 8px #10b981;
    animation: pulse 2s infinite;
}

/* Box Content Styling */
.box-title {
    position: absolute;
    top: 15px;
    left: 20px;
    margin: 0;
    font-size: 0.85rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.placeholder-text {
    color: #475569;
    font-size: 0.9rem;
    text-align: center;
    margin: auto;
}

.placeholder-desc {
    color: #64748b;
    font-size: 0.85rem;
    text-align: center;
    font-style: italic;
}

.placeholder-watermark {
    font-size: 3rem;
    color: rgba(255, 255, 255, 0.05);
    font-family: 'Cinzel', serif;
    position: absolute;
    pointer-events: none;
    text-align: center;
    width: 100%;
    padding: 0 20px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Game Instances List Styling */
.instances-container {
    flex: 1;
    overflow-y: auto;
    margin-top: 30px; 
    margin-bottom: 15px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 5px;
}

.instances-container::-webkit-scrollbar { width: 4px; }
.instances-container::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; }
.instances-container::-webkit-scrollbar-thumb { background: rgba(59,130,246,0.5); border-radius: 4px; }

.empty-instances {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
}

.instance-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.instance-item {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(0, 0, 0, 0.4);
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    cursor: pointer;
    transition: all 0.2s ease;
}

.instance-item:hover {
    border-color: rgba(59, 130, 246, 0.5);
}

.instance-item.active {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.15);
}

.instance-status-dot {
    width: 8px;
    height: 8px;
    background: #475569;
    border-radius: 50%;
    flex-shrink: 0;
    transition: 0.3s;
}

.instance-status-dot.running {
    background: #10b981;
    box-shadow: 0 0 8px #10b981;
}

.rename-input {
    background: transparent;
    border: none;
    border-bottom: 1px solid transparent;
    color: white;
    flex: 1;
    font-size: 0.9rem;
    outline: none;
    min-width: 0; 
    transition: 0.2s;
    padding: 4px 0;
    cursor: text;
}
.rename-input:focus { border-bottom-color: #3b82f6; }

.remove-inst-btn {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border: none;
    border-radius: 4px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: 0.2s;
    flex-shrink: 0;
    font-size: 0.8rem;
}
.remove-inst-btn:hover { background: #ef4444; color: white; }

.load-btn {
    width: 100%;
    background: rgba(59, 130, 246, 0.1);
    border: 1px dashed #3b82f6;
    color: #3b82f6;
    padding: 10px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
    transition: 0.2s;
    flex-shrink: 0;
}
.load-btn:hover { background: rgba(59, 130, 246, 0.2); }

/* ================= GAME DATA UI (TABS) ================= */
.game-data-content {
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin-top: 30px; 
    flex: 1;
}

.data-tabs {
    display: flex;
    gap: 10px;
    background: rgba(0, 0, 0, 0.4);
    padding: 5px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    flex-shrink: 0;
}

.data-tab-btn {
    flex: 1;
    background: transparent;
    border: none;
    color: #64748b;
    padding: 8px 0;
    font-size: 0.85rem;
    font-weight: bold;
    cursor: pointer;
    border-radius: 6px;
    transition: 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
}

.data-tab-btn.active {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.1);
}

.data-tab-btn:hover:not(.active) {
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.05);
}

.achievement-section {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 15px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
}

.achievement-section.is-disabled {
    border: 1px dashed rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.1);
    align-items: center;
    justify-content: center;
}

.ach-empty-disabled {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #475569;
    font-size: 0.9rem;
    text-align: center;
    gap: 8px;
    font-style: italic;
}

.ach-empty-disabled .icon {
    font-size: 1.5rem;
    opacity: 0.5;
    filter: grayscale(100%);
}

.ach-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.ach-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
}

.ach-icon { font-size: 1.2rem; }
.ach-title { color: #cbd5e1; font-size: 0.9rem; font-weight: 600; }
.ach-count { color: #94a3b8; font-size: 0.85rem; font-weight: bold; }
.ach-count .highlight { color: #fff; font-size: 1rem; }

.ach-progress {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
}

.ach-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
    border-radius: 4px;
    transition: width 0.5s ease-in-out;
}

.ach-fill.badge-fill {
    background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

/* ================= MOBILE PORTRAIT WARNING ================= */
.portrait-warning {
    display: none; 
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    background: #0f172a;
    z-index: 200000;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 30px;
    color: #fff;
}

.rotate-icon {
    font-size: 5rem;
    animation: rotate-phone 2s infinite ease-in-out;
    margin-bottom: 20px;
    color: #3b82f6;
    filter: drop-shadow(0 0 15px rgba(59,130,246,0.5));
}

.portrait-warning h2 { font-family: 'Cinzel', serif; margin-bottom: 10px; }
.portrait-warning p { color: #94a3b8; max-width: 300px; margin-bottom: 30px; line-height: 1.5; }

@keyframes rotate-phone {
    0% { transform: rotate(0deg); }
    50% { transform: rotate(-90deg); }
    100% { transform: rotate(-90deg); }
}

/* ================= RESPONSIVE HANDLING ================= */
@media screen and (max-width: 1000px) and (orientation: landscape),
       screen and (max-height: 600px) and (orientation: landscape) {
    
    .workspace-grid { 
        flex-direction: row !important; 
        padding: 10px; 
        gap: 10px; 
    }
    
    .workspace-left { 
        width: 220px; 
        gap: 10px; 
        flex-direction: column;
        overflow-y: auto; 
        padding-right: 5px; 
    }

    .workspace-left::-webkit-scrollbar { width: 4px; }
    .workspace-left::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; }
    .workspace-left::-webkit-scrollbar-thumb { background: rgba(59,130,246,0.5); border-radius: 4px; }
    
    .bottom-rect { 
        display: flex !important; 
        min-height: 180px; 
        flex: none; 
        padding: 15px 10px;
    }
    
    .top-square { 
        height: auto; 
        min-height: 220px; 
        padding: 15px 10px 10px 10px; 
        flex: none; 
    }
    
    .box-title { position: static; margin-bottom: 10px; font-size: 0.75rem; text-align: center; }
    .instances-container { margin-top: 0; min-height: 120px; }
    .game-data-content { margin-top: 0; }
    
    .workspace-header { padding: 8px 15px; }
    .workspace-header-title { font-size: 1rem; }
    .close-modal-btn { padding: 6px 12px; font-size: 0.8rem; }
    .start-game-btn { padding: 6px 16px; font-size: 0.9rem; }
    
    .placeholder-watermark { font-size: 1.8rem; padding: 0 10px; }
    .viewport-header { padding: 8px 15px; }
}
@media screen and (max-width: 768px) and (orientation: portrait) {
    .portrait-warning { display: flex; }
    .game-modal-content { display: none !important; } 
    .console-header { flex-direction: column; gap: 1rem; }
    .search-wrapper { max-width: 100%; order: 3; margin-top: 1rem; }
    .cd-item { width: 200px; height: 200px; }
    .cd-hole { width: 40px; height: 40px; }
    .nav-arrow { font-size: 2rem; padding: 10px; }
}
.fullscreen-player {
    position: fixed; /* Fixed viewport covering */
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: #111111; /* Outer letterbox color */
    z-index: 99999; /* Sit on top of the modal and blur background */
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.player-container {
    position: relative;
    transform-origin: center center; /* Scale exactly from the middle */
    box-shadow: 0 0 40px rgba(0, 0, 0, 0.8); /* Depth from the letterbox */
    overflow: hidden;
}



.exit-player-btn {
    position: absolute;
    top: 20px;
    left: 20px;
    z-index: 200;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 10px 15px;
    border-radius: 8px;
    cursor: pointer;
    backdrop-filter: blur(5px);
    transition: 0.2s;
}

.exit-player-btn:hover {
    background: rgba(239, 68, 68, 0.8);
    border-color: #ef4444;
}

.component-wrapper {
    /* Ensures text/images can still be clicked if they overlap */
    pointer-events: auto; 
}

/* ================= ENTRANCE ANIMATIONS ================= */

/* ================= MISSING ANIMATIONS ================= */
@keyframes sceneBgFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes fadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
}

@keyframes slideIn {
    0% { opacity: 0; transform: translateY(50px); }
    100% { opacity: 1; transform: translateY(0); }
}

@keyframes zoomIn {
    0% { opacity: 0; transform: scale(0.5); }
    100% { opacity: 1; transform: scale(1); }
}

@keyframes typewriter {
    0% { clip-path: inset(0 100% 0 0); }
    100% { clip-path: inset(0 0 0 0); }
}

</style>
<style>
/* ================= GLOBAL KEYFRAMES (UNSCOPED) ================= */
/* These MUST be unscoped because inline :style bindings bypass Vue's scoped hashes */

@keyframes sceneBgFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideIn {
    from { opacity: 0; transform: translateY(50px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes zoomIn {
    from { opacity: 0; transform: scale(0.5); }
    to { opacity: 1; transform: scale(1); }
}

@keyframes typewriter {
    from { clip-path: inset(0 100% 0 0); }
    to { clip-path: inset(0 0 0 0); }
}
</style>