<script setup>
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const token = sessionStorage.getItem('token')
const isPlaying = ref(false)
const currentNode = ref(null)
const currentSceneIndex = ref(0)

const myGames = ref([])
const loading = ref(true)

// Search & Carousel State
const searchQuery = ref('')
const currentIndex = ref(0)

// ================= COMPONENT RENDERING & ANIMATION ENGINE =================

const renderedComponentIds = ref([])
const currentCompIndex = ref(0)
const isBackgroundFading = ref(false)
const isSceneExiting = ref(false)

const currentlyAnimatingIds = ref([])
const skippedAnimationIds = ref([])
const animationTimers = ref({})
const autoRenderTimer = ref(null)

// ================= INTERACTIVE COMPONENT STATES =================
const inputValues = ref({})
const inputHoverState = ref({})
const inputFocusState = ref({})
const btnHoverState = ref({})
const btnActiveState = ref({})

const activeOptionTimers = ref({})
const optionTimerProgress = ref({})

// 🚀 NEW: JS-Driven Time Limit Tracking States

const optionTimerIntervals = ref({}) // Tracks the visual shrinking bar

// 🚀 NEW: Mathematically syncs the visual bar and the background auto-selector


const startOptionTimer = (comp) => {
    // Prevent starting if already running or if the user already clicked
    if (activeOptionTimers.value[comp.id] || comp.isSubmitted) return;

    // Initialize progress to 100%
    optionTimerProgress.value[comp.id] = 100;

    const tickRate = 50; // Update visual bar every 50ms for smooth animation
    const totalTime = Number(comp.timeLimitDuration) * 1000; // Convert seconds to MS safely
    let timeElapsed = 0;

    // --- 1. THE VISUAL PROGRESS BAR ---
    optionTimerIntervals.value[comp.id] = setInterval(() => {
        if (comp.isSubmitted) {
            clearInterval(optionTimerIntervals.value[comp.id]);
            return;
        }
        
        timeElapsed += tickRate;
        let percentage = Math.max(0, 100 - ((timeElapsed / totalTime) * 100));
        optionTimerProgress.value[comp.id] = percentage;

        if (timeElapsed >= totalTime) {
            clearInterval(optionTimerIntervals.value[comp.id]);
        }
    }, tickRate);

    // --- 2. THE AUTO-SELECTION TRIGGER ---
    activeOptionTimers.value[comp.id] = setTimeout(() => {
        if (comp.isSubmitted) return; // Failsafe
        
        let chosenOpt = null;
        if (comp.timeoutAction === 'random') {
            // Pick a random option from the list
            const randomIndex = Math.floor(Math.random() * comp.optionsList.length);
            chosenOpt = comp.optionsList[randomIndex];
        } else {
            // Pick the specific targeted option
            chosenOpt = comp.optionsList.find(o => String(o.id) === String(comp.timeoutTargetId));
            // Failsafe: if the target ID is broken or deleted, default to the first option
            if (!chosenOpt && comp.optionsList.length > 0) {
                chosenOpt = comp.optionsList[0]; 
            }
        }

        if (chosenOpt) {
            selectOption(comp, chosenOpt); // Auto-click it!
        }
    }, totalTime);
}

const navigateToNode = (targetNodeId) => {
    let currentId = targetNodeId;

    while (currentId !== null && currentId !== undefined) {
        const nextNode = activeEngineData.value?.canvasState?.nodes?.find(n => String(n.index) === String(currentId));
        
        if (!nextNode) {
            console.warn("Dead end reached or node missing:", currentId);
            isPlaying.value = false; // Dead end reached
            return;
        }

        // 🚀 FIX: Define the active instance HERE so it's ready for both the tracker and the logic nodes
        const inst = gameInstances.value.find(i => i.id === activeInstanceId.value);

        if (inst) {
            if (!inst.visitedNodes) inst.visitedNodes = [];
            // Prevent pushing duplicate sequential nodes
            if (inst.visitedNodes[inst.visitedNodes.length - 1] !== nextNode.index) {
                inst.visitedNodes.push(nextNode.index);
                Console_Status.value = { ...Console_Status.value }; // Save to Session Storage
            }
        }

        // Found a visual node! Render it.
        if (nextNode.node_type === 'General') {
            currentNode.value = nextNode;
            currentSceneIndex.value = 0;
            startScene();
            return;
        }

        // --- BACKGROUND LOGIC PROCESSING ---
        // Safely find variables. If no active instance exists, fallback to global default variables.
        const activeVars = (inst && inst.variables) ? inst.variables : (activeEngineData.value?.canvasState?.globalVariables || []);

        if (nextNode.node_type === 'Set Variables') {
            const targetVar = activeVars.find(v => String(v.id) === String(nextNode.varId));
            
            if (targetVar) {
                let modifyVal = nextNode.varValue;
                
                if (targetVar.type === 'integer') {
                    let currentVal = parseInt(targetVar.value) || 0;
                    modifyVal = parseInt(modifyVal) || 0;
                    
                    if (nextNode.varOperator === '+') targetVar.value = currentVal + modifyVal;
                    else if (nextNode.varOperator === '-') targetVar.value = currentVal - modifyVal;
                    else if (nextNode.varOperator === '*') targetVar.value = currentVal * modifyVal;
                    else if (nextNode.varOperator === '/') targetVar.value = currentVal / modifyVal;
                    else targetVar.value = modifyVal;
                } else {
                    if (nextNode.varOperator === '+') {
                        targetVar.value = String(nextNode.stringPrefix || '') + String(modifyVal || '') + String(nextNode.stringSuffix || '');
                    } else {
                        targetVar.value = String(modifyVal || '');
                    }
                }
            }
            currentId = nextNode.Next;
        } 
        else if (nextNode.node_type === 'If-Else') {
            let conditionMet = false;
            const targetVar = activeVars.find(v => String(v.id) === String(nextNode.varId));
            
            if (targetVar) {
                let actualVal = targetVar.value;
                let compVal = nextNode.compareValue;
                
                if (targetVar.type === 'integer') {
                    actualVal = parseInt(actualVal) || 0;
                    compVal = parseInt(compVal) || 0;
                }
                
                if (nextNode.operator === '==') conditionMet = (actualVal == compVal);
                else if (nextNode.operator === '!=') conditionMet = (actualVal != compVal);
                else if (nextNode.operator === '>') conditionMet = (actualVal > compVal);
                else if (nextNode.operator === '<') conditionMet = (actualVal < compVal);
                else if (nextNode.operator === '>=') conditionMet = (actualVal >= compVal);
                else if (nextNode.operator === '<=') conditionMet = (actualVal <= compVal);
            }
            
            currentId = conditionMet ? nextNode.NextTrue : nextNode.NextFalse;
        }
        else if (nextNode.node_type === 'Gift') {
            // Unlocks permanent account achievements seamlessly
            if (activePostId.value) {
                if (!Console_Status.value.games[activePostId.value]) {
                    Console_Status.value.games[activePostId.value] = { instances: [], achievements: { pfp: [], badges: [] } };
                }
                const ach = Console_Status.value.games[activePostId.value].achievements;
                const giftObj = { name: nextNode.giftName, pixels: nextNode.pixelData, font: nextNode.giftFont };
                
                if (nextNode.giftMode === 'pfp' && !ach.pfp.some(p => p.name === nextNode.giftName)) ach.pfp.push(giftObj);
                else if (nextNode.giftMode === 'badge' && !ach.badges.some(b => b.name === nextNode.giftName)) ach.badges.push(giftObj);
                
                Console_Status.value = { ...Console_Status.value }; // Save to local storage
            }
            currentId = nextNode.Next;
        }
        else {
            currentId = nextNode.Next; // Fallback
        }
    }
    
    // If the loop exits, it means we reached the absolute end of the tree.
    isPlaying.value = false; 
}

// Submits the input and saves it to the current instance's variables
const submitInput = (comp) => {
    if (comp.isSubmitted) return;
    
    const val = inputValues.value[comp.id];
    if (val === undefined || val === '') return; // Don't submit empty values

    // Find the current active instance
    const inst = gameInstances.value.find(i => i.id === activeInstanceId.value);
    
    if (inst && inst.variables) {
        // Find the specific variable we need to update
        const targetVar = inst.variables.find(v => v.id == comp.targetVariableId);
        if (targetVar) {
            // Respect the variable type (integer vs string)
            targetVar.value = targetVar.type === 'integer' ? (parseInt(val) || 0) : val;
        }
    }

    comp.isSubmitted = true; // Lock the input
    
    // Save to session storage
    Console_Status.value = { ...Console_Status.value }; 

    // Automatically trigger the next component animation
    advanceScene(); 
}

const selectOption = (comp, opt) => {
    if (isBackgroundFading.value || isSceneExiting.value || comp.isSubmitted) return;

    comp.isSubmitted = true; 
    
    // 🚀 NEW: Clean up and stop the JS timers if the user successfully clicked in time
    if (activeOptionTimers.value[comp.id]) {
        clearTimeout(activeOptionTimers.value[comp.id]);
        delete activeOptionTimers.value[comp.id];
    }
    if (optionTimerIntervals.value[comp.id]) {
        clearInterval(optionTimerIntervals.value[comp.id]);
        delete optionTimerIntervals.value[comp.id];
    }

    isSceneExiting.value = true; // Trigger fade out

    setTimeout(() => {
        isSceneExiting.value = false;

        const nodeOptions = currentNode.value?.options || [];
        const nodeOptionConfig = nodeOptions.find(o => String(o.id) === String(opt.id));
        const nextId = nodeOptionConfig ? nodeOptionConfig.next : null;
        
        navigateToNode(nextId);
    }, 1000); 
}
// ================= AUDIO ENGINE =================
const currentAudio = ref(null)

const handleNodeAudio = (audioData) => {
    // 1. Always stop any currently playing music from the previous node
    if (currentAudio.value) {
        currentAudio.value.pause()
        currentAudio.value.currentTime = 0
        currentAudio.value = null
    }

    // 2. Play the new node's audio, if it exists
    if (audioData && audioData.url) {
        const audio = new Audio(audioData.url)
        
        // Apply properties from the database
        audio.volume = audioData.volume !== undefined ? audioData.volume : 1.0
        audio.loop = audioData.loop !== undefined ? audioData.loop : true
        
        // Browsers require a user interaction before playing audio. 
        // Since they clicked to start the game or click to advance nodes, it will play safely.
        audio.play().catch(e => console.warn("Background audio blocked by browser:", e))
        
        currentAudio.value = audio
    }
}

// 3. Automatically manage audio whenever the node changes!
watch(currentNode, (newNode, oldNode) => {
    // If the game is closed, newNode becomes null -> Stop music
    if (!newNode) {
        handleNodeAudio(null); 
        return;
    }
    
    // Only switch music if we actually moved to a DIFFERENT node
    if (!oldNode || newNode.index !== oldNode.index) {
        handleNodeAudio(newNode.audio);
    }
})

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
    isSceneExiting.value = false 
    
    for (let key in animationTimers.value) {
        clearTimeout(animationTimers.value[key])
    }
    
    // 🚀 NEW: Clear all lingering option timers from the previous scene to prevent leaks
    for (let key in activeOptionTimers.value) {
        clearTimeout(activeOptionTimers.value[key]);
    }
    for (let key in optionTimerIntervals.value) {
        clearInterval(optionTimerIntervals.value[key]);
    }
    activeOptionTimers.value = {};
    optionTimerIntervals.value = {};
    optionTimerProgress.value = {};

    if (autoRenderTimer.value) {
        clearTimeout(autoRenderTimer.value)
        autoRenderTimer.value = null
    }

    if (currentNode.value?.scenes?.[currentSceneIndex.value]?.components) {
        currentNode.value.scenes[currentSceneIndex.value].components.forEach(c => {
            if (c.type === 'input') {
                c.isSubmitted = false;
                inputValues.value[c.id] = ''; 
            }
            if (c.type === 'options') {
                c.isSubmitted = false; 
            }
        });
    }
    
    currentCompIndex.value = 0
    isBackgroundFading.value = true 
    
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
    const waitTime = (!comp.animationType || comp.animationType === 'none') ? 0 : (comp.animationDuration || 1) * 1000;

    // 🚀 NEW: Start the timer immediately as soon as the component begins rendering on screen
    if (comp.type === 'options' && comp.hasTimeLimit && !comp.isSubmitted) {
        startOptionTimer(comp);
    }

    if (waitTime > 0) {
        currentlyAnimatingIds.value.push(comp.id);
        animationTimers.value[comp.id] = setTimeout(() => {
            currentlyAnimatingIds.value = currentlyAnimatingIds.value.filter(id => id !== comp.id);
        }, waitTime);
    }
}

const advanceScene = () => {
    if (isBackgroundFading.value || isSceneExiting.value) return; 

    if (!currentNode.value || !currentNode.value.scenes) return;
    const scene = currentNode.value.scenes[currentSceneIndex.value];
    if (!scene || !scene.components) return;
    const comps = scene.components;

    const visibleBlocker = comps.slice(0, currentCompIndex.value).find(c => 
        (c.type === 'input' && !c.isSubmitted) || 
        (c.type === 'options' && !c.isSubmitted)
    );
    if (visibleBlocker) {
        return; 
    }

    if (currentlyAnimatingIds.value.length > 0) {
        currentlyAnimatingIds.value.forEach(id => {
            if (!skippedAnimationIds.value.includes(id)) {
                skippedAnimationIds.value.push(id);
            }
            if (animationTimers.value[id]) clearTimeout(animationTimers.value[id]);
        });
        currentlyAnimatingIds.value = [];
        
        if (autoRenderTimer.value) {
            clearTimeout(autoRenderTimer.value);
            autoRenderTimer.value = null;
            advanceScene(); 
        }
        return; 
    }

    if (currentCompIndex.value >= comps.length) {
        if (comps.some(c => (c.type === 'options' && !c.isSubmitted) || (c.type === 'input' && !c.isSubmitted))) return;
        
        isSceneExiting.value = true;
        
        setTimeout(() => {
            isSceneExiting.value = false;
            if (currentSceneIndex.value < currentNode.value.scenes.length - 1) {
                currentSceneIndex.value++;
                startScene();
                return;
            }
            navigateToNode(currentNode.value.Next);
            return; 
        }, 1000); 
        return; 
    }

    let nextComp = comps[currentCompIndex.value];
    if (!renderedComponentIds.value.includes(nextComp.id)) {
        renderedComponentIds.value.push(nextComp.id);
    }
    currentCompIndex.value++;
    triggerAnimationWait(nextComp);

    if (currentCompIndex.value < comps.length) {
        const subsequentComp = comps[currentCompIndex.value];
        if (subsequentComp.autoRender) {
            const waitTime = (!nextComp.animationType || nextComp.animationType === 'none') 
                ? 0 
                : (nextComp.animationDuration || 1) * 1000;
                
            autoRenderTimer.value = setTimeout(() => {
                autoRenderTimer.value = null;
                advanceScene(); 
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
    // Look at the CURRENT active instance for its variables
    const inst = gameInstances.value.find(i => i.id === activeInstanceId.value);
    if (inst && inst.variables) return inst.variables;
    
    // Fallback if none exist
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

const openGameModal = (gameId) => {
    isPopupOpen.value = true
    activeDataTab.value = 'pfp' // Reset tab on open
    activePostId.value = gameId
    
    // 🚀 START BACKGROUND PRELOADING IMMEDIATELY
    backgroundPreloadPromise = (async () => {
        try {
            // Fetch the base game data using native fetch
            const res = await fetch(`http://localhost:5000/posts/${gameId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            const gameDoc = data.post || data
            
            if (gameDoc && gameDoc.canvasState && gameDoc.canvasState.nodes) {
                const rootNodeId = gameDoc.canvasState.rootNodeId
                const rootNode = gameDoc.canvasState.nodes.find(n => n.index === rootNodeId)
                
                // Extract and cache the assets!
                const urlsToCache = extractNodeAssets(rootNode)
                await preloadUrls(urlsToCache)
            }
        } catch (e) {
            console.warn("Background preload skipped or failed:", e)
        }
    })()

    if (!Console_Status.value.games[gameId]) {
        Console_Status.value.games[gameId] = { instances: [], achievements: { pfp: [], badges: [] } }
    }

    gameInstances.value = Console_Status.value.games[gameId].instances || []
    isWorkspaceGameLoaded.value = gameInstances.value.length > 0
    isEngineRunning.value = false
    activeInstanceId.value = null
    activeEngineData.value = null

    trackAction("OPENED_GAME_MODAL", { gameId: gameId })

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
    
    // --- RESET UI STATES ---
    isInsertingCD.value = false
    insertingGameId.value = null
    currentNode.value = null 

    if (currentAudio.value) {
        currentAudio.value.pause()
        currentAudio.value.currentTime = 0
        currentAudio.value = null
    }

    if (autoRenderTimer.value) {
        clearTimeout(autoRenderTimer.value)
        autoRenderTimer.value = null
    }

    trackAction("CLOSED_GAME_MODAL")
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
        
        const nodeWidth = 220;
        const nodeHeight = 70;
        
        // 🚀 NEW: Apply the scale to the offset calculation
        viewportOffset.value = {
            x: (rect.width / 2) - ((rootNode.x + (nodeWidth / 2)) * viewportScale.value),
            y: (rect.height / 2) - ((rootNode.y + (nodeHeight / 2)) * viewportScale.value)
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
    
    // Redraw the map instantly when switching instances
    nextTick(() => {
        drawViewport() 
    })
    
    const game = filteredGames.value.find(g => g._id === activePostId.value)
    if (game) {
        loadGamePreview(game) 
    }
}
watch(isPlaying, (newVal) => {
    if (!newVal) {
        nextTick(() => {
            drawViewport();
        });
    }
});
const addGameInstance = async () => {
    const newId = Date.now()
    
    // Clone default variables for this specific instance
    let initialVars = [];
    const game = filteredGames.value.find(g => g._id === activePostId.value);
    if (game?.canvasState?.globalVariables) {
        initialVars = JSON.parse(JSON.stringify(game.canvasState.globalVariables));
    }

    gameInstances.value.push({
        id: newId,
        name: `Instance ${gameInstances.value.length + 1}`,
        variables: initialVars,
        visitedNodes: [] // 🚀 NEW: Track discovered nodes independently
    })
    
    isWorkspaceGameLoaded.value = true
    trackAction("ADDED_INSTANCE", { gameId: activePostId.value, totalInstances: gameInstances.value.length })

    selectInstance(newId)

    await nextTick()
    if (instanceInputRefs.value[newId]) {
        instanceInputRefs.value[newId].focus()
    }
}

const drawPreview = () => {
    if (!previewCanvas.value || !activeEngineData.value) return
    const ctx = previewCanvas.value.getContext('2d')
    const nodes = activeEngineData.value.canvasState.nodes
    
    if (!nodes || nodes.length === 0) return;

    // 1. Calculate Bounds based on ALL nodes (so map doesn't scale/jump violently as you discover things)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    nodes.forEach(n => {
        if (n.x < minX) minX = n.x
        if (n.x > maxX) maxX = n.x
        if (n.y < minY) minY = n.y
        if (n.y > maxY) maxY = n.y
    })

    const padding = 50
    const canvasWidth = previewCanvas.value.width
    const canvasHeight = previewCanvas.value.height

    const contentWidth = maxX - minX || 1
    const contentHeight = maxY - minY || 1

    const scaleX = (canvasWidth - padding * 2) / contentWidth
    const scaleY = (canvasHeight - padding * 2) / contentHeight
    const scale = Math.min(scaleX, scaleY, 1)

    const offsetX = (canvasWidth - contentWidth * scale) / 2 - minX * scale
    const offsetY = (canvasHeight - contentHeight * scale) / 2 - minY * scale

    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    // 🚀 2. Identify Discovered Nodes
    const activeInst = gameInstances.value.find(i => i.id === activeInstanceId.value);
    let visitedSequence = activeInst?.visitedNodes || [];
    
    // If empty (brand new instance), just reveal the root node
    if (visitedSequence.length === 0) {
        const rootId = activeEngineData.value.canvasState.rootNodeId;
        if (rootId !== undefined && rootId !== null) {
            visitedSequence = [rootId];
        }
    }

    const visitedSet = new Set(visitedSequence);

    // 🚀 3. Draw Discovered Connections (Lines)
    ctx.strokeStyle = '#4ade80' // Neon green indicating traversal path
    ctx.lineWidth = 3
    
    for (let i = 0; i < visitedSequence.length - 1; i++) {
        const fromNode = nodes.find(n => n.index === visitedSequence[i])
        const toNode = nodes.find(n => n.index === visitedSequence[i+1])
        
        if (fromNode && toNode) {
            ctx.beginPath()
            ctx.moveTo(fromNode.x * scale + offsetX, fromNode.y * scale + offsetY)
            ctx.lineTo(toNode.x * scale + offsetX, toNode.y * scale + offsetY)
            ctx.stroke()
        }
    }

    // 🚀 4. Draw Discovered Nodes
    visitedSet.forEach(nodeId => {
        const node = nodes.find(n => n.index === nodeId)
        if (!node) return;

        // Highlight the "Current Location" (the last node in their history)
        const isCurrentLocation = (nodeId === visitedSequence[visitedSequence.length - 1]);
        
        ctx.fillStyle = isCurrentLocation ? '#facc15' : '#3b82f6' // Yellow if current, Blue if visited past
        ctx.beginPath()
        ctx.arc(node.x * scale + offsetX, node.y * scale + offsetY, 12, 0, 2 * Math.PI)
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.stroke()

        // Draw Node Name
        ctx.fillStyle = '#ffffff'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(node.Node_name || `Node ${node.index}`, node.x * scale + offsetX, node.y * scale + offsetY + 25)
    })
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
const viewportScale = ref(1)
const dragDistance = ref(0)

const handleCanvasZoom = (e) => {
    if (!isEngineRunning.value || !viewportCanvasRef.value) return;

    // Zoom in (up scroll) or zoom out (down scroll) by 10%
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    let newScale = viewportScale.value * zoomFactor;
    
    // Limit zoom between 10% and 300%
    newScale = Math.min(Math.max(0.1, newScale), 3); 

    const rect = viewportCanvasRef.value.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const oldScale = viewportScale.value;
    
    // Adjust offset to keep the map centered exactly on the cursor
    viewportOffset.value.x = mouseX - newScale * ((mouseX - viewportOffset.value.x) / oldScale);
    viewportOffset.value.y = mouseY - newScale * ((mouseY - viewportOffset.value.y) / oldScale);
    
    viewportScale.value = newScale;
    drawViewport();
}

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
    isEngineLoading.value = true; 

    try {
        // 1. Wait for the background preloader to finish its job!
        await backgroundPreloadPromise;

        // 2. Ensure we have the engine data loaded just in case
        if (!activeEngineData.value || activeEngineData.value._id !== game._id) {
            await loadGamePreview(game);
        }
        
        // Extract Canvas State
        const state = activeEngineData.value.canvasState;
        
        // 🚀 FIX: RESUME FROM LAST SAVED NODE INSTEAD OF ROOT NODE
        const inst = gameInstances.value.find(i => i.id === activeInstanceId.value);
        let targetNodeId = state?.rootNodeId;

        // If this instance already has history, RESUME from the last visited node!
        if (inst && inst.visitedNodes && inst.visitedNodes.length > 0) {
            targetNodeId = inst.visitedNodes[inst.visitedNodes.length - 1];
        }
        
        const startNode = state?.nodes?.find(n => n.index === targetNodeId);
        
        if (startNode) {
            currentNode.value = startNode;
            
            if (inst) {
                if (!inst.visitedNodes) inst.visitedNodes = []; // Backwards compatibility
                if (inst.visitedNodes[inst.visitedNodes.length - 1] !== startNode.index) {
                    inst.visitedNodes.push(startNode.index);
                    Console_Status.value = { ...Console_Status.value }; // Save to Session Storage
                }
            }
            
            // 3. Preload the specific node we are about to see
            const activeNodeUrls = extractNodeAssets(currentNode.value);
            await preloadUrls(activeNodeUrls);

            currentSceneIndex.value = 0; // Start at the first scene
            isPlaying.value = true; // Launch the player overlay
            isEngineRunning.value = true;
            if (inst && !inst.variables) {
                inst.variables = JSON.parse(JSON.stringify(activeEngineData.value.canvasState.globalVariables || []));
            }
            startScene();
        } else {
            alert("Error: No entry point found in this game.");
        }
    } catch (error) {
        console.error("Failed to start game:", error);
    } finally {
        // 4. Hide the loading screen, revealing the perfectly loaded scene
        isEngineLoading.value = false; 
    }
}

const startPan = (e) => {
    isPanning.value = true
    dragDistance.value = 0 // Reset distance tracker on click down
    panStart.value = { x: e.clientX - viewportOffset.value.x, y: e.clientY - viewportOffset.value.y }
}

const panMove = (e) => {
    if (!isPanning.value) return;
    
    // Accumulate drag to distinguish between a click and a pan
    dragDistance.value += Math.abs(e.movementX) + Math.abs(e.movementY); 
    
    // Update the global offset
    viewportOffset.value = {
        x: e.clientX - panStart.value.x,
        y: e.clientY - panStart.value.y
    };
    
    // 🚀 NEW: Redraw the canvas to actually show the movement!
    drawViewport(); 
}

const stopPan = () => {
    isPanning.value = false
}

// ================= MAP SELECTION HIT DETECTION =================
const handleCanvasClick = (e) => {
    // Prevent clicking if the user was just dragging/panning the map
    if (!isEngineRunning.value || !viewportCanvasRef.value || !activeEngineData.value || dragDistance.value > 10) return;

    const canvas = viewportCanvasRef.value;
    const rect = canvas.getBoundingClientRect();
    
    // 1. Get Mouse position relative to the screen
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 2. Convert Screen Coordinates to World Coordinates (Reverse Pan & Zoom)
    const worldX = (mouseX - viewportOffset.value.x) / viewportScale.value;
    const worldY = (mouseY - viewportOffset.value.y) / viewportScale.value;

    const activeInst = gameInstances.value.find(i => i.id === activeInstanceId.value);
    if (!activeInst || !activeInst.visitedNodes || activeInst.visitedNodes.length === 0) return;

    const nodes = activeEngineData.value.canvasState?.nodes || [];
    const nw = 220;
    const nh = 70;

    let clickedNodeId = null;

    // Only allow clicking on VISIBLE nodes they have ALREADY visited
    const visibleVisitedNodes = activeInst.visitedNodes.filter(nodeId => {
        const n = nodes.find(node => node.index === nodeId);
        return n && n.node_type !== 'Set Variables' && n.node_type !== 'Gift';
    });

    // 3. Search backwards through history to see if the mouse touches any node
    for (let i = visibleVisitedNodes.length - 1; i >= 0; i--) {
        const nodeId = visibleVisitedNodes[i];
        const node = nodes.find(n => n.index === nodeId);
        if (!node) continue;

        let isMatch = false;

        if (node.node_type === 'If-Else') {
            // Check Diamond Bounding Box
            const cx = node.x + nw / 2;
            const cy = node.y + nh / 2;
            const radius = 30; 
            if (worldX >= cx - radius && worldX <= cx + radius && worldY >= cy - radius && worldY <= cy + radius) {
                isMatch = true;
            }
        } else {
            // Check Rectangle Bounding Box
            if (worldX >= node.x && worldX <= node.x + nw && worldY >= node.y && worldY <= node.y + nh) {
                isMatch = true;
            }
        }

        if (isMatch) {
            clickedNodeId = nodeId;
            break;
        }
    }

    // 4. If a node was clicked, move the player there WITHOUT deleting history!
    if (clickedNodeId !== null) {
        // Only update if they aren't already standing on this exact node
        if (activeInst.visitedNodes[activeInst.visitedNodes.length - 1] !== clickedNodeId) {
            // Push the clicked node to the front of the timeline so it becomes the new "Current Location"
            activeInst.visitedNodes.push(clickedNodeId);
            Console_Status.value = { ...Console_Status.value }; // Save the jump to LocalStorage
            drawViewport(); // Redraw the map instantly to move the "📍 CURRENT" marker
        }
    }
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
    
    // Apply panning offset, THEN apply the zoom scale
    ctx.translate(viewportOffset.value.x, viewportOffset.value.y);
    ctx.scale(viewportScale.value, viewportScale.value); 

    // --- 1. DRAW BACKGROUND GRID ---
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1 / viewportScale.value; 
    const gridSize = 40;
    
    const offsetX = viewportOffset.value.x;
    const offsetY = viewportOffset.value.y;
    const scale = viewportScale.value;
    
    const startX = -offsetX / scale - gridSize;
    const endX = (canvas.width - offsetX) / scale + (gridSize * 2);
    const startY = -offsetY / scale - gridSize;
    const endY = (canvas.height - offsetY) / scale + (gridSize * 2);

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

    // --- 2. IDENTIFY DISCOVERED NODES ---
    const nodes = activeEngineData.value.canvasState?.nodes || [];
    const activeInst = gameInstances.value.find(i => i.id === activeInstanceId.value);
    let rawVisitedSequence = activeInst?.visitedNodes || [];
    
    // If empty (brand new instance), just reveal the root node
    if (rawVisitedSequence.length === 0) {
        const rootId = activeEngineData.value.canvasState?.rootNodeId;
        if (rootId !== undefined && rootId !== null) {
            rawVisitedSequence = [rootId];
        }
    }

    // Filter out hidden backend nodes ('Set Variables' & 'Gift') from the visual map
    const visibleVisitedNodes = new Set(rawVisitedSequence.filter(nodeId => {
        const n = nodes.find(node => node.index === nodeId);
        return n && n.node_type !== 'Set Variables' && n.node_type !== 'Gift';
    }));

    const nw = 220; 
    const nh = 70;  

    // Helper: Find actual structural connections, passing THROUGH hidden logic nodes
    const getStructuralTargets = (node) => {
        const targets = [];
        
        const addTarget = (id) => {
            if (id === null || id === undefined || id === "") return;
            
            let currId = Number(id);
            let safety = 0; // Prevent infinite loops
            
            while (currId !== null && currId !== undefined && safety < 100) {
                const n = nodes.find(x => x.index === currId);
                if (!n) break;
                
                // If we found a visible node, it's our structural target!
                if (n.node_type !== 'Set Variables' && n.node_type !== 'Gift') {
                    targets.push(currId);
                    break;
                }
                
                // If it's a hidden node, pass right through it to find the real target
                currId = n.Next;
                safety++;
            }
        };

        // Scan all possible outputs of the current node
        addTarget(node.Next);
        addTarget(node.NextTrue);
        addTarget(node.NextFalse);
        if (node.options && Array.isArray(node.options)) {
            node.options.forEach(opt => addTarget(opt.next));
        }
        
        return targets;
    };

    // --- 3. DRAW CONNECTING LINES (STRUCTURAL FLOW) ---
    ctx.strokeStyle = '#4ade80'; // Neon green path
    ctx.lineWidth = 3;
    const drawnLines = new Set(); // Prevent double drawing

    visibleVisitedNodes.forEach(fromNodeId => {
        const fromNode = nodes.find(n => n.index === fromNodeId);
        if (!fromNode) return;
        
        const targets = getStructuralTargets(fromNode);
        
        targets.forEach(toNodeId => {
            // ONLY draw the structural line if the target has actually been discovered
            if (!visibleVisitedNodes.has(toNodeId)) return;
            
            const lineKey = `${fromNodeId}->${toNodeId}`;
            if (drawnLines.has(lineKey)) return;
            drawnLines.add(lineKey);

            const toNode = nodes.find(n => n.index === toNodeId);
            if (!toNode) return;

            const startX = fromNode.node_type === 'If-Else' ? fromNode.x + nw/2 + 30 : fromNode.x + nw;
            const startY = fromNode.y + nh / 2;
            
            const endX = toNode.node_type === 'If-Else' ? toNode.x + nw/2 - 30 : toNode.x;
            const endY = toNode.y + nh / 2;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            
            const cpOffset = Math.max(50, Math.abs(endX - startX) / 2);
            ctx.bezierCurveTo(
                startX + cpOffset, startY, 
                endX - cpOffset, endY, 
                endX, endY
            );
            ctx.stroke();

            // Arrow head / target dot
            ctx.fillStyle = '#4ade80';
            ctx.beginPath();
            ctx.arc(endX, endY, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    });

    // --- 4. DRAW THE NODE BOXES ---
    visibleVisitedNodes.forEach(nodeId => {
        const node = nodes.find(n => n.index === nodeId);
        if (!node) return;

        // Trace backward to find the absolute latest VISIBLE node the player is standing on
        let lastVisibleId = null;
        for (let i = rawVisitedSequence.length - 1; i >= 0; i--) {
            if (visibleVisitedNodes.has(rawVisitedSequence[i])) {
                lastVisibleId = rawVisitedSequence[i];
                break;
            }
        }
        const isCurrentLocation = (nodeId === lastVisibleId);
        
        const cx = node.x + nw/2;
        const cy = node.y + nh/2;

        if (node.node_type === 'If-Else') {
            // 🛑 RENDER LOGIC DECISION NODE (Red Diamond)
            ctx.fillStyle = isCurrentLocation ? '#facc15' : '#ef4444'; 
            ctx.strokeStyle = isCurrentLocation ? '#fef08a' : '#fca5a5'; 
            ctx.lineWidth = isCurrentLocation ? 3 : 2;
            
            const radius = 30;
            ctx.beginPath();
            ctx.moveTo(cx, cy - radius);
            ctx.lineTo(cx + radius, cy);
            ctx.lineTo(cx, cy + radius);
            ctx.lineTo(cx - radius, cy);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', cx, cy);

        } else {
            // 🟩 RENDER STANDARD NODE (Rectangle)
            ctx.fillStyle = isCurrentLocation ? 'rgba(59, 130, 246, 0.9)' : 'rgba(15, 23, 42, 0.9)'; 
            ctx.strokeStyle = isCurrentLocation ? '#60a5fa' : '#3b82f6'; 
            ctx.lineWidth = isCurrentLocation ? 3 : 2;
            
            ctx.beginPath();
            ctx.roundRect(node.x, node.y, nw, nh, 8);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = '600 14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.Node_name || `Node ${node.index}`, cx, cy);
        }
        
        // Root Node Label
        if (node.index === activeEngineData.value.canvasState?.rootNodeId) {
            ctx.fillStyle = '#10b981'; 
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('ENTRY POINT', cx, node.y - 10);
        }

        // Active Player Location Label
        if (isCurrentLocation) {
            ctx.fillStyle = '#facc15'; 
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('📍 CURRENT', cx, node.y + nh + 15);
        }
    });

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
// ================= ASSET PRELOADER ENGINE =================
const isEngineLoading = ref(false)
let backgroundPreloadPromise = Promise.resolve()

// Extracts all image, video, and audio URLs from a specific node
const extractNodeAssets = (node) => {
    if (!node) return []
    const urls = new Set()
    
    // Grab background audio
    if (node.audio?.url) urls.add(node.audio.url)
    
    // Grab scene components
    if (node.scenes) {
        node.scenes.forEach(scene => {
            if (scene.components) {
                scene.components.forEach(comp => {
                    if ((comp.type === 'image' || comp.type === 'video') && comp.url) {
                        urls.add(comp.url)
                    }
                })
            }
        })
    }
    return Array.from(urls)
}

// Forces the browser to download and cache the assets
const preloadUrls = (urls) => {
    const uniqueUrls = [...new Set(urls)].filter(url => url) // Clean array
    
    const promises = uniqueUrls.map(url => {
        return new Promise((resolve) => {
            const ext = url.split('.').pop().toLowerCase()
            const isVideo = ['mp4', 'webm', 'ogg'].includes(ext)
            const isAudio = ['mp3', 'wav', 'mpeg'].includes(ext)
            
            if (isVideo || isAudio) {
                const media = isVideo ? document.createElement('video') : new Audio()
                media.preload = 'auto'
                media.oncanplaythrough = resolve // Resolves when enough data is buffered
                media.onerror = resolve
                media.src = url
                media.load()
                setTimeout(resolve, 5000) // Fallback: Don't hang longer than 5 seconds
            } else {
                const img = new Image()
                img.onload = resolve
                img.onerror = resolve
                img.src = url
                setTimeout(resolve, 5000) // Fallback timeout
            }
        })
    })
    return Promise.all(promises)
}
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
                        :key="`node-${currentNode?.index}-scene-${currentSceneIndex}`"
                        :style="{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            width: playerDimensions.width + 'px',
                            height: playerDimensions.height + 'px',
                            transform: `translate(-50%, -50%) scale(${playerScale})`,
                            backgroundColor: currentSceneBg,
                            cursor: isBackgroundFading || isSceneExiting ? 'wait' : 'pointer',
                            overflow: 'hidden',
                            /* If isSceneExiting is true, play fade out. 
                            Otherwise, play fade in. 
                            */
                            animation: isSceneExiting ? 'sceneBgFadeOut 1s forwards' : 'sceneBgFadeIn 1s ease-in-out forwards'
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
                                            display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: '10px', padding: '10px', overflowY: 'auto',
                                            position: 'relative' /* Required for the timer bar to stick to the top */
                                        }">
                                            
                                            <div v-if="comp.hasTimeLimit && optionTimerProgress[comp.id] !== undefined" :style="{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                height: '5px',
                                                borderRadius: (comp.borderRadius || 8) + 'px ' + (comp.borderRadius || 8) + 'px 0 0',
                                                width: comp.isSubmitted ? '0%' : optionTimerProgress[comp.id] + '%',
                                                /* Dynamically switch from green to yellow to red */
                                                backgroundColor: optionTimerProgress[comp.id] > 50 ? '#4ade80' : optionTimerProgress[comp.id] > 20 ? '#facc15' : '#ef4444',
                                                transition: 'width 50ms linear, background-color 0.3s'
                                            }"></div>

                                            <button v-for="opt in comp.optionsList" :key="opt.id"
                                                @click="selectOption(comp, opt)" 
                                                :disabled="comp.isSubmitted"
                                                :style="{
                                                    backgroundColor: comp.styles?.normal?.backgroundColor || '#374151',
                                                    color: comp.styles?.normal?.color || '#ffffff',
                                                    border: `${comp.styles?.normal?.borderWidth || 1}px solid ${comp.styles?.normal?.borderColor || '#9ca3af'}`,
                                                    borderRadius: (comp.styles?.normal?.borderRadius || 4) + 'px',
                                                    fontSize: (comp.styles?.normal?.fontSize || 16) + 'px',
                                                    fontFamily: comp.styles?.normal?.fontFamily || 'sans-serif',
                                                    padding: '8px 12px', width: 'fit-content', height: 'fit-content', 
                                                    cursor: comp.isSubmitted ? 'default' : 'pointer', transition: '0.2s',
                                                    opacity: comp.isSubmitted ? 0.6 : 1,
                                                    zIndex: 2 /* Keep button above timer bar */
                                                }"
                                                @mouseover="!comp.isSubmitted && ($event.target.style.backgroundColor = comp.styles?.hovered?.backgroundColor || '#4b5563'); !comp.isSubmitted && ($event.target.style.borderColor = comp.styles?.hovered?.borderColor || '#00ff88');"
                                                @mouseleave="!comp.isSubmitted && ($event.target.style.backgroundColor = comp.styles?.normal?.backgroundColor || '#374151'); !comp.isSubmitted && ($event.target.style.borderColor = comp.styles?.normal?.borderColor || '#9ca3af');"
                                            >
                                                {{ opt.text }}
                                            </button>
                                        </div>

                                        <div v-else-if="comp.type === 'input'" @click.stop :style="{ width: '100%', height: '100%', display: 'flex', gap: '5px' }">    
                                            <input 
                                                type="text" 
                                                v-model="inputValues[comp.id]"
                                                :placeholder="comp.placeholderText" 
                                                :disabled="comp.isSubmitted"
                                                @focus="inputFocusState[comp.id] = true"
                                                @blur="inputFocusState[comp.id] = false"
                                                @mouseenter="inputHoverState[comp.id] = true"
                                                @mouseleave="inputHoverState[comp.id] = false"
                                                @keyup.enter="submitInput(comp)"
                                                :style="{
                                                    flex: 1, 
                                                    padding: '8px 12px', 
                                                    backgroundColor: comp.backgroundColor, 
                                                    color: '#000',
                                                    /* Fallback to blue if focused, lighter blue if hovered, else default border */
                                                    border: `${comp.borderWidth}px solid ${inputFocusState[comp.id] ? '#3b82f6' : (inputHoverState[comp.id] ? '#60a5fa' : comp.borderColor)}`, 
                                                    borderRadius: comp.borderRadius + 'px',
                                                    fontSize: comp.fontSize + 'px', 
                                                    fontFamily: comp.fontFamily,
                                                    outline: 'none',
                                                    transition: 'all 0.2s',
                                                    boxShadow: inputFocusState[comp.id] ? '0 0 0 3px rgba(59, 130, 246, 0.3)' : 'none',
                                                    opacity: comp.isSubmitted ? 0.7 : 1
                                                }" 
                                            />
                                            
                                            <button 
                                                @click="submitInput(comp)"
                                                :disabled="comp.isSubmitted"
                                                @mouseenter="btnHoverState[comp.id] = true"
                                                @mouseleave="btnHoverState[comp.id] = false"
                                                @mousedown="btnActiveState[comp.id] = true"
                                                @mouseup="btnActiveState[comp.id] = false"
                                                :style="{
                                                    /* Dynamic button colors based on mouse state! */
                                                    backgroundColor: comp.isSubmitted ? '#10b981' : (btnActiveState[comp.id] ? comp.buttonClickColor : (btnHoverState[comp.id] ? comp.buttonHoverColor : comp.buttonNormalColor)), 
                                                    color: comp.buttonTextColor,
                                                    padding: '8px 20px', 
                                                    border: 'none', 
                                                    borderRadius: '4px', 
                                                    cursor: comp.isSubmitted ? 'default' : 'pointer',
                                                    fontWeight: 'bold',
                                                    transition: 'all 0.1s',
                                                    transform: btnActiveState[comp.id] && !comp.isSubmitted ? 'scale(0.95)' : 'scale(1)'
                                                }">
                                                {{ comp.isSubmitted ? (comp.buttonSubmittedText || 'Sent') : comp.buttonText }}
                                            </button>
                                        </div>

                                        <div v-else-if="comp.type === 'variable'" :style="{
                                            color: comp.color, fontSize: comp.fontSize + 'px', fontFamily: comp.fontFamily,
                                            fontWeight: comp.fontWeight, fontStyle: comp.fontStyle,
                                            textDecoration: `${comp.textDecoration} ${comp.textDecorationColor}`,
                                            backgroundColor: comp.backgroundColor, border: `${comp.borderWidth}px solid ${comp.borderColor}`,
                                            borderRadius: comp.borderRadius + 'px', width: '100%', height: '100%', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            whiteSpace: 'nowrap'
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
                                    @mousedown="startPan" @mousemove="panMove" @mouseup="stopPan" @mouseleave="stopPan"
                                    @wheel.prevent="handleCanvasZoom"
                                    @click="handleCanvasClick">
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
  <div v-if="isEngineLoading" class="loading-overlay">
    <div class="spinner"></div>
    <h2 class="loading-text">Loading Assets...</h2>
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

/* --- NEW FADE OUT KEYFRAME --- */
@keyframes sceneBgFadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
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

.loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: #0f172a;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 100000; /* Extremely high to cover everything */
}

.spinner {
    width: 60px;
    height: 60px;
    border: 6px solid #1e293b;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
}

.loading-text {
    color: #f8fafc;
    font-family: 'Inter', sans-serif;
    font-weight: 500;
    letter-spacing: 1px;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@keyframes timerBar {
    0% { width: 100%; background-color: #4ade80; } /* Neon Green */
    50% { background-color: #facc15; } /* Warning Yellow */
    100% { width: 0%; background-color: #ef4444; } /* Critical Red */
}
</style>