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
const hoveredOption = ref(null)
const activeOptionTimers = ref({})
const optionTimerProgress = ref({})

// 🚀 NEW: JS-Driven Time Limit Tracking States

const optionTimerIntervals = ref({}) // Tracks the visual shrinking bar

// 🚀 NEW: Mathematically syncs the visual bar and the background auto-selector

const visitedNodes = ref(new Set()) // Tracks indices of nodes the player has traversed
const achievedGifts = ref([]) // Stores the gift data the player unlocked
const previewGraphZoom = ref(1)

const showGiftReward = ref(false)
const currentGiftReward = ref(null)
const giftRewardType = ref('')
const giftRewardAudio = ref(null)
const giftRewardAnimation = ref('float-up')

const showDemoLimitPopup = ref(false)
const demoLimitMessage = ref('')

const showPurchasePopup = ref(false)
const purchaseMessage = ref('')

const showPurchaseModal = ref(false)
const selectedGameForPurchase = ref(null)
const isProcessingPayment = ref(false)
const paymentError = ref('')
const purchasedGames = ref([])

const likedGames = ref(new Map()) // Map of gameId -> liked status
const likesCountMap = ref(new Map()) // Map of gameId -> likes count
const isLikingGame = ref(new Map()) // Prevent double-liking

// Load user's purchased games on mount
const fetchPurchasedGames = async () => {
  try {
    const res = await fetch('http://localhost:5000/payments/my-purchases', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      purchasedGames.value = await res.json();
    }
  } catch (err) {
    console.error("Failed to fetch purchases:", err);
  }
}

// Check if user owns current game
const hasPurchasedCurrentGame = computed(() => {
  if (!activePostId.value) return false;
  return purchasedGames.value.some(p => p.gameId === activePostId.value);
});

// Open purchase modal
const openPurchaseModal = (game) => {
  selectedGameForPurchase.value = game;
  showPurchaseModal.value = true;
  paymentError.value = '';
}

// Close purchase modal
const closePurchaseModal = () => {
  showPurchaseModal.value = false;
  selectedGameForPurchase.value = null;
  isProcessingPayment.value = false;
  paymentError.value = '';
}

const fetchLikeStatuses = async () => {
  if (!myGames.value.length) return;
  
  try {
    const promises = myGames.value.map(async (game) => {
      const res = await fetch(`http://localhost:5000/posts/${game._id}/like-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        likedGames.value.set(game._id, data.liked);
        likesCountMap.value.set(game._id, data.likes);
      }
    });
    
    await Promise.all(promises);
  } catch (err) {
    console.error("Failed to fetch like statuses:", err);
  }
};

const toggleLikeGame = async (gameId, event) => {
  event.stopPropagation(); // Prevent triggering the game click
  
  if (isLikingGame.value.get(gameId)) return;
  isLikingGame.value.set(gameId, true);
  
  try {
    const res = await fetch(`http://localhost:5000/posts/${gameId}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (res.ok) {
      const data = await res.json();
      likedGames.value.set(gameId, data.liked);
      likesCountMap.value.set(gameId, data.likes);
      
      // Update the game object itself for consistency
      const game = myGames.value.find(g => g._id === gameId);
      if (game) {
        game.likes = data.likes;
      }
    }
  } catch (err) {
    console.error("Like failed:", err);
  } finally {
    isLikingGame.value.set(gameId, false);
  }
};

// Initialize Razorpay payment
const initiatePurchase = async () => {
  if (!selectedGameForPurchase.value || isProcessingPayment.value) return;
  
  isProcessingPayment.value = true;
  paymentError.value = '';

  try {
    // 1. Create order on backend
    const orderRes = await fetch('http://localhost:5000/payments/create-order', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ gameId: selectedGameForPurchase.value._id })
    });

    const orderData = await orderRes.json();
    
    if (!orderRes.ok) {
      if (orderData.alreadyOwned) {
        alert("You already own this game!");
        closePurchaseModal();
        await fetchPurchasedGames();
        return;
      }
      throw new Error(orderData.message || 'Failed to create order');
    }

    console.log("Order created:", orderData);

    // 2. Configure Razorpay options
    const options = {
      key: orderData.order.key,
      amount: orderData.order.amount,
      currency: orderData.order.currency,
      name: selectedGameForPurchase.value.name,
      description: `Purchase ${selectedGameForPurchase.value.name}`,
      image: selectedGameForPurchase.value.thumbnail || 'https://yourdomain.com/logo.png',
      order_id: orderData.order.id,
      handler: async (response) => {
        console.log("Payment successful:", response);
        
        // 3. Verify payment on backend
        const verifyRes = await fetch('http://localhost:5000/payments/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            gameId: selectedGameForPurchase.value._id
          })
        });

        const verifyData = await verifyRes.json();
        
        if (verifyData.success) {
          // 4. Success! Refresh purchases
          await fetchPurchasedGames();
          
          // 🚀 NEW: Track the first play for this paid game
          try {
            await fetch(`http://localhost:5000/posts/${selectedGameForPurchase.value._id}/play`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` }
            });
            console.log("First play tracked for purchased game");
          } catch (playErr) {
            console.warn("Failed to track first play:", playErr);
            // Don't fail the purchase if play tracking fails
          }
          
          alert("🎉 Purchase successful! You now own this game.");
          closePurchaseModal();
        } else {
          throw new Error(verifyData.message || 'Payment verification failed');
        }
      },
      prefill: {
        name: "",
        email: "",
        contact: ""
      },
      theme: {
        color: "#3b82f6"
      },
      modal: {
        ondismiss: () => {
          console.log("Payment modal closed");
          isProcessingPayment.value = false;
        }
      }
    };

    const razorpayInstance = new window.Razorpay(options);
    razorpayInstance.open();

  } catch (err) {
    console.error("Purchase failed:", err);
    paymentError.value = err.message || "Failed to initiate purchase. Please try again.";
    isProcessingPayment.value = false;
  }
};

// Call this on mount
onMounted(() => {
  fetchConsole();
  fetchPurchasedGames(); // Add this
  window.addEventListener('keydown', handleKeyDown);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
});

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

const countVisitedGeneralNodes = (instance) => {
    if (!instance || !instance.visitedNodes || !activeEngineData.value) return 0
    
    const nodes = activeEngineData.value.canvasState?.nodes || []
    let count = 0
    
    // Count only General nodes in the visited history
    instance.visitedNodes.forEach(nodeId => {
        const node = nodes.find(n => n.index === nodeId)
        if (node && String(node.node_type || node.Node_type || node.type || node.name || node.Node_name || "").toLowerCase() === 'general') {
            count++
        }
    })
    
    return count
}

const navigateToNode = (targetNodeId) => {
    let currentId = targetNodeId;

    while (currentId !== null && currentId !== undefined) {
        const nextNode = activeEngineData.value?.canvasState?.nodes?.find(n => String(n.index) === String(currentId));
        
        if (!nextNode) {
            console.warn("Dead end reached or node missing:", currentId);
            isPlaying.value = false;
            return;
        }

        const inst = gameInstances.value.find(i => i.id === activeInstanceId.value);

        if (inst) {
            if (!inst.visitedNodes) inst.visitedNodes = [];
            // Only track visited nodes for history - doesn't affect gameplay
            if (inst.visitedNodes[inst.visitedNodes.length - 1] !== nextNode.index) {
                inst.visitedNodes.push(nextNode.index);
                Console_Status.value = { ...Console_Status.value };
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
                
                // 🚀 FIX 1: Fetch actual value if modifying using another variable
                if (nextNode.varValueType === 'variable') {
                    const sourceVar = activeVars.find(v => String(v.id) === String(nextNode.varValue));
                    modifyVal = sourceVar ? sourceVar.value : (targetVar.type === 'integer' ? 0 : '');
                }
                
                if (targetVar.type === 'integer') {
                    let currentVal = parseInt(targetVar.value) || 0;
                    modifyVal = parseInt(modifyVal) || 0;
                    
                    if (nextNode.varOperator === '+') targetVar.value = currentVal + modifyVal;
                    else if (nextNode.varOperator === '-') targetVar.value = currentVal - modifyVal;
                    else if (nextNode.varOperator === '*') targetVar.value = currentVal * modifyVal;
                    else if (nextNode.varOperator === '/') targetVar.value = currentVal / modifyVal;
                    else targetVar.value = modifyVal;
                } else {
                    let currentVal = targetVar.value || ''; 
                    if (nextNode.varOperator === '+') {
                        targetVar.value = String(nextNode.stringPrefix || '') + String(currentVal) + String(nextNode.stringSuffix || '');
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
                
                // 🚀 FIX 2: Fetch actual value if comparing against another variable
                if (nextNode.compareValueType === 'variable') {
                    const compareVar = activeVars.find(v => String(v.id) === String(nextNode.compareValue));
                    compVal = compareVar ? compareVar.value : (targetVar.type === 'integer' ? 0 : '');
                }
                
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
        }else if (nextNode.node_type === 'Gift') {
            console.log("Gift node encountered:", nextNode.Node_name);
            console.log("Gift node Next value:", nextNode.Next);
            
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
            
            // 🎁 Show gift reward popup instead of navigating immediately
            // But first, make sure we're not already showing a gift
            if (!showGiftReward.value) {
                currentGiftReward.value = nextNode;
                giftRewardType.value = nextNode.giftMode;
                showGiftReward.value = true;
                giftRewardAnimation.value = 'float-up';
                
                // 🎵 Play gift audio if available
                if (nextNode.giftAudio && nextNode.giftAudio.url) {
                    // Stop any previously playing gift audio
                    if (giftRewardAudio.value) {
                        giftRewardAudio.value.pause();
                        giftRewardAudio.value.currentTime = 0;
                    }
                    
                    const audio = new Audio(nextNode.giftAudio.url);
                    audio.volume = nextNode.giftAudio.volume !== undefined ? nextNode.giftAudio.volume : 1.0;
                    audio.loop = false;
                    audio.play().catch(e => console.warn("Gift audio blocked by browser:", e));
                    giftRewardAudio.value = audio;
                }
            }
            
            // Don't continue to next node automatically - wait for user click
            return;
        }
        else {
            currentId = nextNode.Next; // Fallback
        }
    }
    
    isPlaying.value = false; 
}

watch(showGiftReward, (newVal) => {
    console.log("showGiftReward changed to:", newVal);
});

watch(currentNode, (newVal) => {
    console.log("Current node changed to:", newVal?.Node_name);
});

watch(isPlaying, (newVal) => {
    console.log("isPlaying changed to:", newVal);
    if (newVal) {
        console.log("Current node:", currentNode.value?.Node_name);
        console.log("Current scene index:", currentSceneIndex.value);
    }
});

const continueAfterGift = () => {
    if (!currentGiftReward.value) {
        console.log("No gift reward to continue from");
        return;
    }
    
    // Prevent multiple clicks
    if (giftRewardAnimation.value === 'fade-out') {
        console.log("Already fading out, ignoring click");
        return;
    }
    
    console.log("Gift clicked, continuing to next node...");
    console.log("Current gift reward:", currentGiftReward.value);
    console.log("Next node ID:", currentGiftReward.value.Next);
    
    // Start fade out animation
    giftRewardAnimation.value = 'fade-out';
    
    // Stop gift audio if playing
    if (giftRewardAudio.value) {
        giftRewardAudio.value.pause();
        giftRewardAudio.value.currentTime = 0;
        giftRewardAudio.value = null;
    }
    
    // Store the next node ID before clearing
    const nextId = currentGiftReward.value.Next;
    const giftNode = { ...currentGiftReward.value }; // Create a copy
    
    // Hide popup immediately but with fade out animation
    setTimeout(() => {
        console.log("Hiding gift popup");
        showGiftReward.value = false;
        currentGiftReward.value = null;
        
        // Navigate to next node after popup is hidden
        if (nextId !== null && nextId !== undefined && nextId !== "") {
            console.log("Navigating to next node:", nextId);
            
            // Small delay to ensure popup is completely hidden
            setTimeout(() => {
                // Ensure we have the active instance
                if (!activeInstanceId.value) {
                    console.error("No active instance found");
                    return;
                }
                
                // Make sure we have the game data
                if (!activeEngineData.value) {
                    console.error("No active engine data found");
                    return;
                }
                
                // Navigate to the next node
                navigateToNode(nextId);
            }, 100);
        } else {
            console.log("No next node, ending game");
            isPlaying.value = false;
        }
    }, 400); // Slightly shorter than animation to ensure smooth transition
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
    
    if (activeOptionTimers.value[comp.id]) {
        clearTimeout(activeOptionTimers.value[comp.id]);
        delete activeOptionTimers.value[comp.id];
    }
    if (optionTimerIntervals.value[comp.id]) {
        clearInterval(optionTimerIntervals.value[comp.id]);
        delete optionTimerIntervals.value[comp.id];
    }

    isSceneExiting.value = true;

    setTimeout(() => {
        isSceneExiting.value = false;

        const nodeOptions = currentNode.value?.options || [];
        const nodeOptionConfig = nodeOptions.find(o => String(o.id) === String(opt.id));
        const nextId = nodeOptionConfig ? nodeOptionConfig.next : null;
        
        const game = filteredGames.value.find(g => g._id === activePostId.value)
        const inst = gameInstances.value.find(i => i.id === activeInstanceId.value)
        
        // 🚀 FIX: Skip demo limit check if user owns the game
        const isOwned = hasPurchasedCurrentGame.value;
        
        if (!isOwned && game?.monetization?.isPaid && game?.monetization?.hasDemo && inst) {
            const currentCount = countVisitedGeneralNodes(inst)
            const limit = game.monetization.demoNodeLimit
            
            console.log(`Demo node check: ${currentCount}/${limit}, next node: ${nextId}`)
            
            if (currentCount >= limit) {
                console.log(`Demo limit reached: ${currentCount}/${limit}`)
                showDemoLimitPopup.value = true
                demoLimitMessage.value = `Demo Limit Reached\nYou've played ${currentCount} of ${limit} nodes.\nPurchase full version to continue.`
                return
            }
        }
        
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
    showGiftReward.value = false;
    currentGiftReward.value = null;
    if (giftRewardAudio.value) {
        giftRewardAudio.value.pause();
        giftRewardAudio.value.currentTime = 0;
        giftRewardAudio.value = null;
    }
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

/* ================= ACHIEVEMENT POPUP & SHARE LOGIC ================= */
const selectedAchievement = ref(null)
const achievementPopupType = ref('') // 'pfp' or 'badge'
const isShareMenuOpen = ref(false)

const openAchievementPopup = (item, type) => {
    selectedAchievement.value = item
    achievementPopupType.value = type
    isShareMenuOpen.value = false
}

const closeAchievementPopup = () => {
    selectedAchievement.value = null
    achievementPopupType.value = ''
    isShareMenuOpen.value = false
}

const setAsPfp = async () => {
    if (!selectedAchievement.value || !activePostId.value) return;

    try {
        const canvas = document.createElement('canvas');
        canvas.width = 256; 
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const pixels = selectedAchievement.value.pixels;
        const rows = pixels.length;
        const cols = pixels[0].length;
        const scaleX = canvas.width / cols;
        const scaleY = canvas.height / rows;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if (pixels[y][x]) {
                    ctx.fillStyle = pixels[y][x];
                    ctx.fillRect(Math.floor(x * scaleX), Math.floor(y * scaleY), Math.ceil(scaleX), Math.ceil(scaleY));
                }
            }
        }
        const base64Image = canvas.toDataURL('image/png');

        const res = await fetch('http://localhost:5000/user/pfp/earned', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                publishId: activePostId.value,
                giftName: selectedAchievement.value.name,
                giftFont: selectedAchievement.value.giftFont || 'sans-serif', // 🚀 Post the specific Font
                base64: base64Image
            })
        });

        if (res.ok) {
            alert(`Success! "${selectedAchievement.value.name}" has been equipped as your Profile Picture.`);
            closeAchievementPopup();
        } else {
            const data = await res.json();
            alert(`Error: ${data.message}`);
        }
    } catch (err) {
        console.error("Failed to set PFP:", err);
        alert("Failed to equip Profile Picture.");
    }
}

const addToAchievements = async () => {
    if (!selectedAchievement.value || !activePostId.value) return;

    try {
        // 1. Generate the High-Res Base64 Badge Image
        const canvas = document.createElement('canvas');
        canvas.width = 256; 
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        ctx.imageSmoothingEnabled = false;
        
        // 🚀 FIX: Clear the canvas to make it completely transparent instead of painting it black
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const pixels = selectedAchievement.value.pixels;
        const rows = pixels.length;
        const cols = pixels[0].length;
        const scaleX = canvas.width / cols;
        const scaleY = canvas.height / rows;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                // null values will be ignored, leaving the transparent background untouched
                if (pixels[y][x]) {
                    ctx.fillStyle = pixels[y][x];
                    ctx.fillRect(Math.floor(x * scaleX), Math.floor(y * scaleY), Math.ceil(scaleX), Math.ceil(scaleY));
                }
            }
        }
        
        // Exporting as 'image/png' preserves the transparency
        const base64Image = canvas.toDataURL('image/png');

        // 2. Post the Badge to the backend
        const res = await fetch('http://localhost:5000/user/badge/earned', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                publishId: activePostId.value,
                giftName: selectedAchievement.value.name,
                giftFont: selectedAchievement.value.giftFont || 'sans-serif', 
                base64: base64Image
            })
        });

        if (res.ok) {
            alert(`Success! "${selectedAchievement.value.name}" badge added to your profile showcase.`);
            closeAchievementPopup();
        } else {
            const data = await res.json();
            alert(`Error: ${data.message}`);
        }
    } catch (err) {
        console.error("Failed to add badge:", err);
        alert("Failed to add badge.");
    }
}

const shareToSocial = (platform) => {
    const text = encodeURIComponent(`I just unlocked the "${selectedAchievement.value.name}" ${achievementPopupType.value === 'pfp' ? 'Profile Picture' : 'Badge'} on this awesome console!`)
    const url = encodeURIComponent(window.location.href)
    let shareUrl = ''

    switch(platform) {
        case 'whatsapp': 
            shareUrl = `https://api.whatsapp.com/send?text=${text} ${url}`
            break
        case 'facebook': 
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`
            break
        case 'reddit': 
            shareUrl = `https://www.reddit.com/submit?url=${url}&title=${text}`
            break
        case 'twitter': 
            shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`
            break
    }

    if (shareUrl) {
        window.open(shareUrl, '_blank')
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
            
            const game = filteredGames.value.find(g => g._id === activePostId.value)
            const inst = gameInstances.value.find(i => i.id === activeInstanceId.value)
            
            // 🚀 FIX: Skip demo limit check if user owns the game
            const isOwned = hasPurchasedCurrentGame.value;
            
            if (!isOwned && game?.monetization?.isPaid && game?.monetization?.hasDemo && inst) {
                const currentCount = countVisitedGeneralNodes(inst)
                const limit = game.monetization.demoNodeLimit
                
                console.log(`Advance scene node check: ${currentCount}/${limit}, next: ${currentNode.value.Next}`)
                
                if (currentCount >= limit) {
                    console.log(`Demo limit reached at scene end: ${currentCount}/${limit}`)
                    showDemoLimitPopup.value = true
                    demoLimitMessage.value = `Demo Limit Reached\nYou've played ${currentCount} of ${limit} nodes.\nPurchase full version to continue.`
                    return
                }
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

const closeDemoLimitPopup = () => {
    showDemoLimitPopup.value = false
    // Optionally pause the game or exit
    // isPlaying.value = false
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
      
      // 🚀 NEW: Fetch like statuses for all games
      await fetchLikeStatuses();
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
  if (isInsertingCD.value) return; // Prevent double-clicks
  
  isInsertingCD.value = true
  insertingGameId.value = id
  trackAction("CD_INSERTION_STARTED", { gameId: id })

  // Track play for free games
  const game = myGames.value.find(g => g._id === id);
  if (game && !game.monetization?.isPaid) {
    try {
      await fetch(`http://localhost:5000/posts/${id}/play`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.warn("Play tracking failed:", err);
    }
  }

  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
    }
  } catch (err) {
    console.warn("Fullscreen request blocked/failed:", err)
  }

  lockLandscape()

  // Wait for CD insertion animation to complete before opening modal
  setTimeout(() => {
    openGameModal(id)
    // Reset insertion state after modal opens
    setTimeout(() => {
      isInsertingCD.value = false
      insertingGameId.value = null
    }, 300)
  }, 1500) // Match animation duration
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
    showGiftReward.value = false;
    currentGiftReward.value = null;
    if (giftRewardAudio.value) {
        giftRewardAudio.value.pause();
        giftRewardAudio.value.currentTime = 0;
        giftRewardAudio.value = null;
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
        visitedNodes: [], // Actual traversal history
        currentLocation: null // 🚨 NEW: Temporary location when clicking on map
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

const unlockedPfps = computed(() => {
    if (!activePostId.value || !Console_Status.value.games[activePostId.value]) return 0;
    return Console_Status.value.games[activePostId.value].achievements?.pfp?.length || 0;
});

const unlockedBadges = computed(() => {
    if (!activePostId.value || !Console_Status.value.games[activePostId.value]) return 0;
    return Console_Status.value.games[activePostId.value].achievements?.badges?.length || 0;
});

// 🚀 NEW: Get the actual arrays of unlocked items
const unlockedPfpList = computed(() => {
    if (!activePostId.value || !Console_Status.value.games[activePostId.value]) return [];
    return Console_Status.value.games[activePostId.value].achievements?.pfp || [];
});

const unlockedBadgeList = computed(() => {
    if (!activePostId.value || !Console_Status.value.games[activePostId.value]) return [];
    return Console_Status.value.games[activePostId.value].achievements?.badges || [];
});

// 🚀 NEW: Fast canvas renderer for the 2D pixel arrays
const drawMiniPixelArt = (canvas, pixels) => {
    if (!canvas || !pixels || !Array.isArray(pixels) || pixels.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    const rows = pixels.length;
    const cols = pixels[0].length;
    
    // Disable anti-aliasing to keep pixel art sharp
    ctx.imageSmoothingEnabled = false; 

    // Calculate dimensions
    const scaleX = canvas.width / cols;
    const scaleY = canvas.height / rows;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (pixels[y][x]) {
                ctx.fillStyle = pixels[y][x];
                // Math.ceil prevents sub-pixel rendering gaps
                ctx.fillRect(Math.floor(x * scaleX), Math.floor(y * scaleY), Math.ceil(scaleX), Math.ceil(scaleY));
            }
        }
    }
}

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




/* ============================================================== */

const startGame = async (game) => {
    // 🚀 NEW: First check if user owns the game
    if (hasPurchasedCurrentGame.value) {
        console.log("User owns this game - granting full access");
        trackAction("GAME_STARTED_OWNED", { gameId: game._id, instanceId: activeInstanceId.value })
        isEngineLoading.value = true;
        
        try {
            await backgroundPreloadPromise;
            if (!activeEngineData.value || activeEngineData.value._id !== game._id) {
                await loadGamePreview(game);
            }
            
            const state = activeEngineData.value.canvasState;
            const inst = gameInstances.value.find(i => i.id === activeInstanceId.value);
            
            // 🚀 FIX: Determine starting node
            let targetNodeId = null;
            
            if (inst) {
                // PRIORITY 1: Use currentLocation if set (user clicked on map)
                if (inst.currentLocation !== null && inst.currentLocation !== undefined) {
                    targetNodeId = inst.currentLocation;
                    console.log(`Starting from map-selected node: ${targetNodeId}`);
                    
                    // ✅ Important: After using currentLocation, we should add it to visitedNodes
                    // if it's not already there, to maintain history
                    if (!inst.visitedNodes.includes(targetNodeId)) {
                        inst.visitedNodes.push(targetNodeId);
                    }
                    
                    // Clear currentLocation since we're now using it
                    inst.currentLocation = null;
                }
                // PRIORITY 2: Use last visited node if no currentLocation
                else if (inst.visitedNodes && inst.visitedNodes.length > 0) {
                    targetNodeId = inst.visitedNodes[inst.visitedNodes.length - 1];
                    console.log(`Resuming from last visited node: ${targetNodeId}`);
                }
            }
            
            // PRIORITY 3: Fallback to root node if nothing else
            if (!targetNodeId) {
                targetNodeId = state?.rootNodeId;
                console.log(`Starting from root node: ${targetNodeId}`);
            }
            
            const startNode = state?.nodes?.find(n => n.index === targetNodeId);
            
            if (startNode) {
                currentNode.value = startNode;
                
                if (inst) {
                    if (!inst.visitedNodes) inst.visitedNodes = [];
                    
                    // Ensure start node is in visited nodes (it should be by now)
                    if (!inst.visitedNodes.includes(startNode.index)) {
                        inst.visitedNodes.push(startNode.index);
                        Console_Status.value = { ...Console_Status.value };
                    }
                }
                
                const activeNodeUrls = extractNodeAssets(currentNode.value);
                await preloadUrls(activeNodeUrls);

                currentSceneIndex.value = 0;
                isPlaying.value = true;
                isEngineRunning.value = true;
                if (inst && !inst.variables) {
                    inst.variables = JSON.parse(JSON.stringify(activeEngineData.value.canvasState.globalVariables || []));
                }
                startScene();
            }
        } catch (error) {
            console.error("Failed to start game:", error);
            alert("Failed to start game. Please try again.");
        } finally {
            isEngineLoading.value = false;
        }
        return;
    }

    // Original logic for non-owned games - also needs the same fix!
    if (game.monetization?.isPaid) {
        if (!game.monetization?.hasDemo) {
            console.log("Paid game with no demo - showing purchase popup");
            showPurchasePopup.value = true;
            purchaseMessage.value = `🔒 Purchase Required\n\n"${game.name}" is a paid game with no demo.\nPurchase the full version to play.`;
            trackAction("START_DENIED_PAID_NO_DEMO", { gameId: game._id })
            return;
        }
        
        const inst = gameInstances.value.find(i => i.id === activeInstanceId.value);
        if (inst) {
            const currentCount = countVisitedGeneralNodes(inst);
            const limit = game.monetization.demoNodeLimit;
            
            if (currentCount >= limit) {
                console.log(`Demo limit reached: ${currentCount}/${limit}`);
                showDemoLimitPopup.value = true;
                demoLimitMessage.value = `Demo Limit Reached\nYou've played ${currentCount} of ${limit} nodes.\nPurchase full version to continue.`;
                return;
            }
        }
    }

    // Free game or paid game with demo under limit - start normally
    trackAction("GAME_STARTED", { gameId: game._id, instanceId: activeInstanceId.value })
    isEngineLoading.value = true;

    try {
        await backgroundPreloadPromise;

        if (!activeEngineData.value || activeEngineData.value._id !== game._id) {
            await loadGamePreview(game);
        }
        
        const state = activeEngineData.value.canvasState;
        const inst = gameInstances.value.find(i => i.id === activeInstanceId.value);
        
        // 🚀 FIX: Same priority system for non-owned games
        let targetNodeId = null;
        
        if (inst) {
            // PRIORITY 1: Use currentLocation if set
            if (inst.currentLocation !== null && inst.currentLocation !== undefined) {
                targetNodeId = inst.currentLocation;
                console.log(`Starting from map-selected node: ${targetNodeId}`);
                
                if (!inst.visitedNodes.includes(targetNodeId)) {
                    inst.visitedNodes.push(targetNodeId);
                }
                inst.currentLocation = null;
            }
            // PRIORITY 2: Use last visited node
            else if (inst.visitedNodes && inst.visitedNodes.length > 0) {
                targetNodeId = inst.visitedNodes[inst.visitedNodes.length - 1];
                console.log(`Resuming from last visited node: ${targetNodeId}`);
            }
        }
        
        // PRIORITY 3: Fallback to root node
        if (!targetNodeId) {
            targetNodeId = state?.rootNodeId;
            console.log(`Starting from root node: ${targetNodeId}`);
        }
        
        const startNode = state?.nodes?.find(n => n.index === targetNodeId);
        
        if (startNode) {
            currentNode.value = startNode;
            
            if (inst) {
                if (!inst.visitedNodes) inst.visitedNodes = [];
                
                if (!inst.visitedNodes.includes(startNode.index)) {
                    inst.visitedNodes.push(startNode.index);
                    Console_Status.value = { ...Console_Status.value };
                }
            }
            
            const activeNodeUrls = extractNodeAssets(currentNode.value);
            await preloadUrls(activeNodeUrls);

            currentSceneIndex.value = 0;
            isPlaying.value = true;
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
        alert("Failed to start game. Please try again.");
    } finally {
        isEngineLoading.value = false;
    }
}

const closePurchasePopup = () => {
    showPurchasePopup.value = false
}

const isCurrentGamePaid = computed(() => {
    const game = filteredGames.value.find(g => g._id === activePostId.value)
    return game?.monetization?.isPaid || false
})

const isCurrentGamePaidWithDemo = computed(() => {
    const game = filteredGames.value.find(g => g._id === activePostId.value)
    return game?.monetization?.isPaid && game?.monetization?.hasDemo || false
})

const isCurrentGamePaidNoDemo = computed(() => {
    const game = filteredGames.value.find(g => g._id === activePostId.value)
    return game?.monetization?.isPaid && !game?.monetization?.hasDemo || false
})

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
        // 🚀 UPDATE: Allow clicking on Gift nodes too by removing them from the exclusion list
        return n && n.node_type !== 'Set Variables';
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
            // Check Rectangle Bounding Box (Supports both General and Gift nodes)
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

    // --- 2. IDENTIFY DISCOVERED NODES & TRAVERSED EDGES ---
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

    // 🚀 NEW: Create an ordered history of VISIBLE nodes chronologically
    const visibleHistory = rawVisitedSequence.filter(nodeId => {
        const n = nodes.find(node => node.index === nodeId);
        // Allow 'Gift' nodes to be visible on the map alongside General and If-Else
        return n && n.node_type !== 'Set Variables';
    });

    // Create a set of uniquely visited visible nodes for block rendering
    const visibleVisitedNodes = new Set(visibleHistory);

    // 🚀 BUG FIX: Record the EXACT edges the player traversed in gameplay
    const traversedEdges = new Set();
    for (let i = 0; i < visibleHistory.length - 1; i++) {
        traversedEdges.add(`${visibleHistory[i]}->${visibleHistory[i+1]}`);
    }

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
                if (n.node_type !== 'Set Variables') {
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
            // 🚀 BUG FIX: ONLY draw the line if the player ACTUALLY traveled this exact path in history
            const edgeKey = `${fromNodeId}->${toNodeId}`;
            if (!traversedEdges.has(edgeKey)) return;
            
            if (drawnLines.has(edgeKey)) return;
            drawnLines.add(edgeKey);

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

        } else if (node.node_type === 'Gift') {
            // 🎁 RENDER GIFT NODE
            ctx.fillStyle = isCurrentLocation ? '#facc15' : '#8b5cf6'; // Purple for Gift
            ctx.strokeStyle = isCurrentLocation ? '#fef08a' : '#a78bfa'; 
            ctx.lineWidth = isCurrentLocation ? 3 : 2;
            
            ctx.beginPath();
            ctx.roundRect(node.x, node.y, nw, nh, 8);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = isCurrentLocation ? '#000000' : '#ffffff';
            ctx.font = '600 14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.giftName || `Gift`, cx + 10, cy);
            
            // Add a little emoji to distinguish between PFP and Badges
            ctx.font = '16px sans-serif';
            ctx.fillText(node.giftMode === 'badge' ? '🎖️' : '🖼️', cx - 80, cy);

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

watch(currentGiftReward, (newVal) => {
    if (newVal && newVal.pixelData) {
        nextTick(() => {
            const canvas = document.querySelector('.gift-pixel-art');
            if (canvas) {
                drawMiniPixelArt(canvas, newVal.pixelData);
            }
        });
    }
}, { immediate: true });

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
            <!-- 🚀 NEW: Like button integrated into action buttons -->
            <button 
                class="action-btn like-btn" 
                :class="{ 
                    'liked': likedGames.get(filteredGames[currentIndex]?._id),
                    'liking': isLikingGame.get(filteredGames[currentIndex]?._id)
                }"
                @click="toggleLikeGame(filteredGames[currentIndex]._id, $event)"
                :disabled="isLikingGame.get(filteredGames[currentIndex]?._id)"
            >
                <span class="btn-icon" :class="{ 'heart-pop': likedGames.get(filteredGames[currentIndex]?._id) && !isLikingGame.get(filteredGames[currentIndex]?._id) }">
                    {{ likedGames.get(filteredGames[currentIndex]?._id) ? '❤️' : '🤍' }}
                </span>
                <span class="btn-text">{{ likedGames.get(filteredGames[currentIndex]?._id) ? 'Liked' : 'Like' }}</span>
                <span class="btn-count" :class="{ 'count-bounce': isLikingGame.get(filteredGames[currentIndex]?._id) }">{{ likesCountMap.get(filteredGames[currentIndex]?._id) || 0 }}</span>
                
                <!-- Ripple effect when clicking -->
                <span v-if="isLikingGame.get(filteredGames[currentIndex]?._id)" class="like-ripple"></span>
            </button>
            
            <button class="action-btn play-btn" :disabled="isInsertingCD" @click="handlePlayClick(filteredGames[currentIndex]._id)">
                <span class="btn-icon">▶</span>
                <span class="btn-text">{{ isInsertingCD ? 'Loading...' : 'Play Game' }}</span>
            </button>
            
            <button class="action-btn remove-btn" :disabled="isInsertingCD" @click="removeGame(filteredGames[currentIndex]._id)">
                <span class="btn-icon">⏏</span>
                <span class="btn-text">Remove</span>
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

                    <div class="player-container"  
                         @click="!showGiftReward && advanceScene()"
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
                                                @mouseenter="!comp.isSubmitted && (hoveredOption = `${comp.id}-${opt.id}`)"
                                                @mouseleave="hoveredOption = null"
                                                :disabled="comp.isSubmitted"
                                                :style="[
                                                    /* Base styles that never change */
                                                    {
                                                        padding: '8px 12px', 
                                                        width: 'fit-content', 
                                                        height: 'fit-content', 
                                                        cursor: comp.isSubmitted ? 'default' : 'pointer', 
                                                        transition: 'all 0.2s ease',
                                                        zIndex: 2,
                                                        borderStyle: 'solid'
                                                    },
                                                    /* 1. If Clicked (Submitted) - Apply Clicked Styles & Fade Out */
                                                    comp.isSubmitted ? {
                                                        backgroundColor: comp.styles?.clicked?.backgroundColor || '#1f2937',
                                                        color: comp.styles?.clicked?.color || '#ffffff',
                                                        borderColor: comp.styles?.clicked?.borderColor || '#00ff88',
                                                        borderWidth: (comp.styles?.clicked?.borderWidth || 2) + 'px',
                                                        borderRadius: (comp.styles?.clicked?.borderRadius || 4) + 'px',
                                                        fontSize: (comp.styles?.clicked?.fontSize || 16) + 'px',
                                                        fontFamily: comp.styles?.clicked?.fontFamily || 'sans-serif',
                                                        opacity: 0.6
                                                    } : 
                                                    /* 2. If Hovered - Apply Hovered Styles */
                                                    hoveredOption === `${comp.id}-${opt.id}` ? {
                                                        backgroundColor: comp.styles?.hovered?.backgroundColor || '#4b5563',
                                                        color: comp.styles?.hovered?.color || '#ffffff',
                                                        borderColor: comp.styles?.hovered?.borderColor || '#00ff88',
                                                        borderWidth: (comp.styles?.hovered?.borderWidth || 1) + 'px',
                                                        borderRadius: (comp.styles?.hovered?.borderRadius || 4) + 'px',
                                                        fontSize: (comp.styles?.hovered?.fontSize || 16) + 'px',
                                                        fontFamily: comp.styles?.hovered?.fontFamily || 'sans-serif',
                                                        opacity: 1
                                                    } : 
                                                    /* 3. Default State - Apply Normal Styles */
                                                    {
                                                        backgroundColor: comp.styles?.normal?.backgroundColor || '#374151',
                                                        color: comp.styles?.normal?.color || '#ffffff',
                                                        borderColor: comp.styles?.normal?.borderColor || '#9ca3af',
                                                        borderWidth: (comp.styles?.normal?.borderWidth || 1) + 'px',
                                                        borderRadius: (comp.styles?.normal?.borderRadius || 4) + 'px',
                                                        fontSize: (comp.styles?.normal?.fontSize || 16) + 'px',
                                                        fontFamily: comp.styles?.normal?.fontFamily || 'sans-serif',
                                                        opacity: 1
                                                    }
                                                ]"
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
                    <transition name="gift-reward">
                      <div v-if="showGiftReward && currentGiftReward" 
                           class="gift-reward-overlay" 
                           @click.stop="continueAfterGift">
                        <div class="gift-reward-container" :class="giftRewardAnimation" @click.stop>
                          <!-- Halo effect behind the pixel art -->
                          <div class="gift-halo"></div>
                          
                          <!-- Pixel Art Canvas -->
                          <canvas 
                            ref="giftPixelCanvas"
                            width="128" 
                            height="128" 
                            class="gift-pixel-art"
                            :style="{ background: giftRewardType === 'badge' ? 'transparent' : '#000' }"
                            ></canvas>
                          
                          <!-- Gift Title -->
                          <div class="gift-title" :style="{ fontFamily: currentGiftReward.giftFont || 'sans-serif' }">
                            {{ giftRewardType === 'pfp' ? '✨ NEW PFP:' : '🏆 NEW BADGE:' }}
                          </div>
                          
                          <!-- Gift Name -->
                          <div class="gift-name" :style="{ fontFamily: currentGiftReward.giftFont || 'sans-serif' }">
                            {{ currentGiftReward.giftName }}
                          </div>
                          
                          <!-- Click to continue prompt - make entire area clickable -->
                          <div class="gift-continue-prompt">
                            <span class="continue-text">▼ Click anywhere to continue ▼</span>
                            <div class="pulse-dot"></div>
                          </div>
                        </div>
                      </div>
                    </transition>
                </div>
                <div v-show="!isPlaying" style="display: flex; flex-direction: column; width: 100%; height: 100%;">
                    <div class="workspace-header">
                        <button class="close-modal-btn" @click="closeGameModal(false)">✕ Close</button>
                        <div class="workspace-header-title">Console Workspace</div>
                        <div class="workspace-header-actions">
                            <!-- Show owned badge if purchased -->
                            <div v-if="isCurrentGamePaid && hasPurchasedCurrentGame" class="owned-badge">
                                ✅ Owned
                            </div>
                            
                            <!-- Show purchase button if not owned -->
                            <button 
                                v-else-if="isCurrentGamePaid && !hasPurchasedCurrentGame" 
                                class="purchase-btn" 
                                @click="openPurchaseModal(filteredGames.find(g => g._id === activePostId))"
                            >
                                💎 Purchase
                            </button>
                            
                            <!-- Start button - disabled for paid games with no demo unless owned -->
                            <button 
                                class="start-game-btn" 
                                :disabled="!activeInstanceId || (isCurrentGamePaidNoDemo && !hasPurchasedCurrentGame)"
                                :class="{ 'disabled-paid': isCurrentGamePaidNoDemo && !hasPurchasedCurrentGame }"
                                @click="startGame(filteredGames.find(g => g._id === activePostId))"
                                :title="isCurrentGamePaidNoDemo && !hasPurchasedCurrentGame ? 'Purchase required to play' : ''"
                            >
                                ▶ Start
                            </button>
                            </div>      
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
                                        
                                        <div class="ach-gallery" v-if="unlockedPfpList.length > 0">
                                            <div v-for="(item, idx) in unlockedPfpList" :key="idx" class="ach-item interactable" @click="openAchievementPopup(item, 'pfp')">
                                                <canvas :ref="el => drawMiniPixelArt(el, item.pixels)" width="64" height="64" class="ach-canvas"></canvas>
                                                <span class="ach-item-name" :style="{ fontFamily: item.font || 'sans-serif' }" :title="item.name">{{ item.name }}</span>
                                            </div>
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
                                        
                                        <div class="ach-gallery" v-if="unlockedBadgeList.length > 0">
                                            <div v-for="(item, idx) in unlockedBadgeList" :key="idx" class="ach-item interactable" @click="openAchievementPopup(item, 'badge')">
                                                <canvas :ref="el => drawMiniPixelArt(el, item.pixels)" width="64" height="64" class="ach-canvas" style="background: transparent; border: none; box-shadow: none;"></canvas>
                                                <span class="ach-item-name" :style="{ fontFamily: item.font || 'sans-serif' }" :title="item.name">{{ item.name }}</span>
                                            </div>
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
  <transition name="fade">
    <div v-if="selectedAchievement" class="achievement-modal-overlay" @click="closeAchievementPopup">
        <div class="achievement-modal-content" @click.stop>
            <button class="close-ach-btn" @click="closeAchievementPopup">✕</button>
            
            <div class="ach-modal-header">
                <canvas :ref="el => drawMiniPixelArt(el, selectedAchievement?.pixels)" width="128" height="128" class="ach-modal-canvas" :style="{ background: achievementPopupType === 'badge' ? 'transparent' : '#000', border: achievementPopupType === 'badge' ? 'none' : '2px solid #334155', boxShadow: achievementPopupType === 'badge' ? 'none' : 'inset 0 0 10px rgba(255,255,255,0.1), 0 5px 15px rgba(0,0,0,0.5)' }"></canvas>
                <h3 :style="{ fontFamily: selectedAchievement?.font || 'sans-serif' }">{{ selectedAchievement?.name }}</h3>
                
                <span class="ach-modal-type">{{ achievementPopupType === 'pfp' ? 'Profile Picture' : 'Badge' }}</span>
            </div>

            <div class="ach-modal-actions">
                <button v-if="achievementPopupType === 'pfp'" class="primary-action-btn" @click="setAsPfp">
                    👤 Set as PFP
                </button>
                
                <button v-if="achievementPopupType === 'badge'" class="primary-action-btn badge-action" @click="addToAchievements">
                    🎖️ Add to Achievements
                </button>

                <div class="share-wrapper">
                    <button class="secondary-action-btn" @click="isShareMenuOpen = !isShareMenuOpen">
                        🔗 Share...
                    </button>
                    
                    <transition name="slide">
                        <div v-if="isShareMenuOpen" class="social-share-menu">
                            <button class="social-btn whatsapp" @click="shareToSocial('whatsapp')">WhatsApp</button>
                            <button class="social-btn facebook" @click="shareToSocial('facebook')">Facebook</button>
                            <button class="social-btn twitter" @click="shareToSocial('twitter')">X / Twitter</button>
                            <button class="social-btn reddit" @click="shareToSocial('reddit')">Reddit</button>
                        </div>
                    </transition>
                </div>
            </div>
        </div>
    </div>
</transition>
  <div v-if="isEngineLoading" class="loading-overlay">
    <div class="spinner"></div>
    <h2 class="loading-text">Loading Assets...</h2>
  </div>
  <transition name="fade">
    <div v-if="showPurchasePopup" class="demo-limit-overlay" @click="closePurchasePopup">
      <div class="demo-limit-popup" @click.stop>
        <div class="demo-limit-icon">💎</div>
        <div class="demo-limit-title">Purchase Required</div>
        <div class="demo-limit-message">{{ purchaseMessage }}</div>
        <button class="demo-limit-btn purchase-btn" @click="closePurchasePopup">Close</button>
      </div>
    </div>
  </transition>
  <transition name="fade">
    <div v-if="showDemoLimitPopup" class="demo-limit-overlay" @click="closeDemoLimitPopup">
      <div class="demo-limit-popup" @click.stop>
        <div class="demo-limit-icon">⚠️</div>
        <div class="demo-limit-title">Demo Limit Reached</div>
        <div class="demo-limit-message">{{ demoLimitMessage }}</div>
        <button class="demo-limit-btn" @click="closeDemoLimitPopup">Close</button>
      </div>
    </div>
  </transition>
  <transition name="fade">
  <div v-if="showPurchaseModal" class="purchase-modal-overlay" @click="closePurchaseModal">
    <div class="purchase-modal" @click.stop>
      
      <!-- Header -->
      <div class="purchase-modal-header">
        <h2>Complete Purchase</h2>
        <button class="close-modal-btn" @click="closePurchaseModal">✕</button>
      </div>

      <!-- Game Info -->
      <div class="purchase-game-info" v-if="selectedGameForPurchase">
        <div class="purchase-game-thumb" 
             :style="{ backgroundImage: `url(${selectedGameForPurchase.thumbnail || '/placeholder.jpg'})` }">
        </div>
        <div class="purchase-game-details">
          <h3>{{ selectedGameForPurchase.name }}</h3>
          <p class="game-author">by {{ selectedGameForPurchase.authorName }}</p>
          <div class="game-price">
            <span class="price-currency">{{ selectedGameForPurchase.monetization?.priceCurrency === 'INR' ? '₹' : '$' }}</span>
            <span class="price-amount">{{ selectedGameForPurchase.monetization?.price?.toFixed(2) || '0.00' }}</span>
          </div>
        </div>
      </div>

      <!-- Payment Methods Info -->
      <div class="payment-info">
        <div class="payment-methods">
          <span class="payment-badge">💳 Cards</span>
          <span class="payment-badge">📱 UPI</span>
          <span class="payment-badge">🏦 NetBanking</span>
          <span class="payment-badge">🪙 Wallets</span>
        </div>
        <p class="payment-secure">🔒 Secure payment powered by Razorpay</p>
      </div>

      <!-- Error Message -->
      <div v-if="paymentError" class="payment-error">
        ⚠️ {{ paymentError }}
      </div>

      <!-- Action Buttons -->
      <div class="purchase-actions">
        <button class="cancel-btn" @click="closePurchaseModal" :disabled="isProcessingPayment">
          Cancel
        </button>
        <button 
          class="pay-now-btn" 
          @click="initiatePurchase" 
          :disabled="isProcessingPayment"
        >
          <span v-if="!isProcessingPayment">💎 Pay Now</span>
          <span v-else class="processing-spinner">
            <span class="spinner-small"></span>
            Processing...
          </span>
        </button>
      </div>

      <!-- Test Mode Notice -->
      <div class="test-mode-notice">
        <p>🔧 Test Mode - Use these test cards:</p>
        <div class="test-cards">
          <div class="test-card">💳 4111 1111 1111 1111</div>
          <div class="test-card">📅 Any future date | 🔒 Any CVV</div>
          <div class="test-card">🔑 OTP: 1234</div>
        </div>
      </div>
    </div>
  </div>
</transition>
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

.ach-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(65px, 1fr));
    gap: 12px;
    margin-top: 15px;
    max-height: 200px;
    overflow-y: auto;
    padding-right: 5px;
}
.ach-gallery::-webkit-scrollbar { width: 4px; }
.ach-gallery::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; }
.ach-gallery::-webkit-scrollbar-thumb { background: rgba(59,130,246,0.5); border-radius: 4px; }

.ach-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    background: rgba(0, 0, 0, 0.4);
    padding: 8px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: transform 0.2s, border-color 0.2s;
}

.ach-item:hover {
    transform: translateY(-2px) scale(1.05);
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
}

.like-btn {
    position: relative;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    padding: 12px 30px;
    border-radius: 30px;
    font-weight: 700;
    font-size: 1.1rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
}

.like-btn:not(:disabled):hover {
    transform: translateY(-3px);
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(236, 72, 153, 0.5);
    box-shadow: 0 8px 20px rgba(236, 72, 153, 0.3);
}

.like-btn.liked {
    background: rgba(236, 72, 153, 0.15);
    border-color: #ec4899;
    color: #ec4899;
    box-shadow: 0 0 20px rgba(236, 72, 153, 0.4);
}

.like-btn.liked:not(:disabled):hover {
    background: rgba(236, 72, 153, 0.25);
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 8px 25px rgba(236, 72, 153, 0.5);
}

.like-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: scale(0.95);
}

/* Heart icon animation */
.btn-icon {
    display: inline-block;
    font-size: 1.2rem;
    transition: transform 0.2s ease;
}

.heart-pop {
    animation: heartPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes heartPop {
    0% { transform: scale(1); }
    50% { transform: scale(1.4); }
    75% { transform: scale(0.9); }
    100% { transform: scale(1); }
}

/* Count number animation */
.btn-count {
    background: rgba(0, 0, 0, 0.3);
    padding: 4px 8px;
    border-radius: 20px;
    font-size: 0.85rem;
    min-width: 32px;
    text-align: center;
    transition: all 0.2s ease;
}

.liked .btn-count {
    background: rgba(236, 72, 153, 0.3);
    color: #fff;
}

.count-bounce {
    animation: countBounce 0.3s ease;
}

@keyframes countBounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.2); }
}

/* Ripple effect on click */
.like-ripple {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 5px;
    height: 5px;
    background: rgba(236, 72, 153, 0.5);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    animation: rippleEffect 0.6s ease-out;
    pointer-events: none;
}

@keyframes rippleEffect {
    0% {
        width: 0;
        height: 0;
        opacity: 0.5;
    }
    100% {
        width: 300px;
        height: 300px;
        opacity: 0;
    }
}

/* Optional: Add floating hearts when liked */
.like-btn.liked::after {
    content: '❤️';
    position: absolute;
    font-size: 1rem;
    opacity: 0;
    animation: floatHeart 1s ease-out forwards;
    pointer-events: none;
}

@keyframes floatHeart {
    0% {
        opacity: 0.8;
        transform: translateY(0) translateX(-50%);
    }
    50% {
        opacity: 1;
        transform: translateY(-20px) translateX(-50%) rotate(10deg);
    }
    100% {
        opacity: 0;
        transform: translateY(-40px) translateX(-50%) rotate(-10deg);
    }
}

/* Confetti effect for multiple likes (optional) */
@keyframes confettiPop {
    0% {
        opacity: 1;
        transform: translateY(0) rotate(0deg);
    }
    100% {
        opacity: 0;
        transform: translateY(-100px) rotate(720deg);
    }
}

.ach-canvas {
    width: 100%;
    aspect-ratio: 1 / 1;
    image-rendering: pixelated; /* Forces sharp pixels */
    border-radius: 4px;
    background: #000;
    box-shadow: inset 0 0 5px rgba(255,255,255,0.1);
}

.ach-item-name {
    font-size: 0.65rem;
    color: #cbd5e1;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
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
.ach-item.interactable {
    cursor: pointer;
}

.achievement-modal-overlay {
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(2, 6, 23, 0.85);
    backdrop-filter: blur(8px);
    z-index: 200000; /* Higher than game modal */
    display: flex;
    align-items: center;
    justify-content: center;
}

.achievement-modal-content {
    background: #0f172a;
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 16px;
    padding: 30px;
    width: 90%;
    max-width: 350px;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 20px rgba(59,130,246,0.2);
    text-align: center;
}

.close-ach-btn {
    position: absolute;
    top: 15px; right: 15px;
    background: transparent;
    border: none;
    color: #64748b;
    font-size: 1.2rem;
    cursor: pointer;
    transition: 0.2s;
}
.close-ach-btn:hover { color: #ef4444; }

.ach-modal-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
    margin-bottom: 25px;
}

.ach-modal-canvas {
    width: 128px;
    height: 128px;
    image-rendering: pixelated;
    background: #000;
    border-radius: 8px;
    box-shadow: inset 0 0 10px rgba(255,255,255,0.1), 0 5px 15px rgba(0,0,0,0.5);
    border: 2px solid #334155;
}

.ach-modal-header h3 {
    margin: 0;
    font-size: 1.5rem;
    color: #f8fafc;
    text-shadow: 0 2px 5px rgba(0,0,0,0.5);
}

.ach-modal-type {
    font-size: 0.85rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 1px;
    background: rgba(255,255,255,0.05);
    padding: 4px 12px;
    border-radius: 20px;
}

.ach-modal-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
}

.primary-action-btn {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 12px;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    transition: 0.2s;
    font-size: 1rem;
}
.primary-action-btn:hover { background: #2563eb; transform: translateY(-2px); }

.primary-action-btn.badge-action {
    background: #f59e0b;
}
.primary-action-btn.badge-action:hover {
    background: #d97706;
}

.share-wrapper {
    position: relative;
    width: 100%;
}

.secondary-action-btn {
    width: 100%;
    background: transparent;
    color: #cbd5e1;
    border: 1px solid rgba(255,255,255,0.2);
    padding: 10px;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    transition: 0.2s;
}
.secondary-action-btn:hover { background: rgba(255,255,255,0.05); border-color: #94a3b8; }

.social-share-menu {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
    background: rgba(0,0,0,0.3);
    padding: 10px;
    border-radius: 8px;
    border: 1px dashed rgba(255,255,255,0.1);
}

.social-btn {
    padding: 8px;
    border: none;
    border-radius: 6px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: 0.2s opacity;
}
.social-btn:hover { opacity: 0.8; }
.social-btn.whatsapp { background: #25D366; }
.social-btn.facebook { background: #1877F2; }
.social-btn.twitter { background: #000000; border: 1px solid #333; }
.social-btn.reddit { background: #FF4500; }
/* ================= GIFT REWARD POPUP STYLES ================= */
.gift-reward-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1000000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  cursor: pointer;
  animation: overlayFadeIn 0.5s ease-out;
}

.gift-reward-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 60px;
  background: linear-gradient(135deg, #1e293b, #0f172a);
  border: 2px solid rgba(255, 215, 0, 0.3);
  border-radius: 32px;
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.8),
    0 0 30px rgba(255, 215, 0, 0.3),
    inset 0 0 30px rgba(255, 215, 0, 0.1);
  transform-origin: center;
  transition: all 0.3s ease;
}

/* Floating up and down animation */
.gift-reward-container.float-up {
  animation: floatUpDown 2s ease-in-out infinite;
}

/* Fade out animation when continuing */
.gift-reward-container.fade-out {
  animation: fadeOutGift 0.5s forwards !important;
}

/* Halo effect behind pixel art */
.gift-halo {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 180px;
  height: 180px;
  background: radial-gradient(circle, 
    rgba(255, 215, 0, 0.4) 0%,
    rgba(255, 215, 0, 0.2) 30%,
    rgba(255, 215, 0, 0.1) 50%,
    transparent 70%
  );
  border-radius: 50%;
  filter: blur(5px);
  animation: haloPulse 2s ease-in-out infinite;
  z-index: 1;
}

.gift-pixel-art {
  width: 128px;
  height: 128px;
  image-rendering: pixelated;
  background: #000;
  border-radius: 16px;
  box-shadow: 
    0 10px 30px rgba(0, 0, 0, 0.5),
    0 0 0 4px rgba(255, 215, 0, 0.3),
    inset 0 0 10px rgba(255, 215, 0, 0.2);
  margin-bottom: 20px;
  z-index: 2;
  transform: scale(1);
  transition: transform 0.3s ease;
}

.gift-pixel-art:hover {
  transform: scale(1.05);
}

.gift-title {
  font-size: 1.2rem;
  font-weight: bold;
  letter-spacing: 2px;
  text-transform: uppercase;
  background: linear-gradient(135deg, #ffd700, #ffb347);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 8px;
  z-index: 2;
  text-shadow: 0 2px 10px rgba(255, 215, 0, 0.3);
}

.gift-name {
  font-size: 2rem;
  font-weight: bold;
  color: #fff;
  text-align: center;
  margin-bottom: 30px;
  z-index: 2;
  text-shadow: 
    0 2px 10px rgba(255, 215, 0, 0.5),
    0 0 20px rgba(255, 215, 0, 0.3);
  letter-spacing: 1px;
}

.gift-continue-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  z-index: 2;
}

.workspace-header-actions {
    display: flex;
    gap: 10px;
    align-items: center;
}

.purchase-btn {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: white;
    border: none;
    padding: 8px 20px;
    border-radius: 20px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 0 15px rgba(245, 158, 11, 0.4);
    display: flex;
    align-items: center;
    gap: 5px;
}

.purchase-btn:hover {
    transform: scale(1.05);
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    box-shadow: 0 0 20px rgba(245, 158, 11, 0.6);
}

/* Disabled Start Button for Paid No-Demo Games */
.start-game-btn.disabled-paid {
    background: #475569;
    color: #94a3b8;
    box-shadow: none;
    cursor: not-allowed;
    opacity: 0.7;
}

.start-game-btn.disabled-paid:hover {
    transform: none;
    background: #475569;
    box-shadow: none;
}

/* Purchase button in popup */
.demo-limit-btn.purchase-btn {
    background: #f59e0b;
    color: white;
}

.demo-limit-btn.purchase-btn:hover {
    background: #d97706;
}

.continue-text {
  color: #94a3b8;
  font-size: 0.9rem;
  letter-spacing: 2px;
  text-transform: uppercase;
  animation: textPulse 2s ease-in-out infinite;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: #ffd700;
  border-radius: 50%;
  animation: dotPulse 1.5s ease-in-out infinite;
  box-shadow: 0 0 15px #ffd700;
}

/* ================= GIFT REWARD ANIMATIONS ================= */
@keyframes floatUpDown {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-20px) scale(1.02);
  }
}

@keyframes fadeOutGift {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.8);
  }
}

@keyframes overlayFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes haloPulse {
  0%, 100% {
    opacity: 0.5;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.8;
    transform: translate(-50%, -50%) scale(1.2);
  }
}

@keyframes textPulse {
  0%, 100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

@keyframes dotPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.5);
    opacity: 1;
  }
}

/* ================= GIFT REWARD TRANSITIONS ================= */
.gift-reward-enter-active {
  animation: overlayFadeIn 0.5s ease-out;
}

.gift-reward-enter-active .gift-reward-container {
  animation: floatUpDown 2s ease-in-out infinite;
}

.gift-reward-leave-active {
  animation: overlayFadeIn 0.3s reverse;
}

.gift-reward-leave-active .gift-reward-container {
  animation: fadeOutGift 0.3s forwards !important;
}

.purchase-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  z-index: 10000000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: overlayFadeIn 0.3s ease;
}

.purchase-modal {
  background: #0f172a;
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 24px;
  width: 90%;
  max-width: 480px;
  padding: 30px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  animation: modalSlideUp 0.3s ease;
}

.purchase-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
}

.purchase-modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: white;
  font-weight: 700;
}

.purchase-game-info {
  display: flex;
  gap: 20px;
  margin-bottom: 25px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.purchase-game-thumb {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  background-size: cover;
  background-position: center;
  background-color: #1e293b;
  flex-shrink: 0;
}

.purchase-game-details {
  flex: 1;
}

.purchase-game-details h3 {
  margin: 0 0 5px 0;
  font-size: 1.2rem;
  color: white;
}

.game-price {
  margin-top: 10px;
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.price-currency {
  font-size: 1.2rem;
  color: #94a3b8;
  font-weight: 600;
}

.price-amount {
  font-size: 1.8rem;
  font-weight: 700;
  color: #3b82f6;
  line-height: 1;
}

.payment-info {
  margin-bottom: 25px;
  text-align: center;
}

.payment-methods {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-bottom: 10px;
}

.payment-badge {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #93c5fd;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
}

.payment-secure {
  color: #94a3b8;
  font-size: 0.85rem;
  margin: 5px 0 0;
}

.payment-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 0.9rem;
  text-align: center;
}

.purchase-actions {
  display: flex;
  gap: 15px;
}

.cancel-btn {
  flex: 1;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  padding: 14px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover:not(:disabled) {
  border-color: #ef4444;
  color: #ef4444;
}

.pay-now-btn {
  flex: 2;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border: none;
  color: white;
  padding: 14px;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.pay-now-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.5);
}

.pay-now-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.processing-spinner {
  display: flex;
  align-items: center;
  gap: 8px;
}

.spinner-small {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.test-mode-notice {
  margin-top: 25px;
  padding: 15px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
}

.test-mode-notice p {
  margin: 0 0 10px 0;
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
}

.test-cards {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.test-card {
  color: #cbd5e1;
  font-size: 0.8rem;
  padding: 5px 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  font-family: monospace;
}

.owned-badge {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: bold;
  border: 1px solid rgba(34, 197, 94, 0.3);
  display: flex;
  align-items: center;
  gap: 5px;
}

@keyframes modalSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive adjustments */
@media screen and (max-width: 768px) {
  .gift-reward-container {
    padding: 30px 40px;
    max-width: 90%;
  }
  
  .gift-pixel-art {
    width: 96px;
    height: 96px;
  }
  
  .gift-title {
    font-size: 1rem;
  }
  
  .gift-name {
    font-size: 1.5rem;
  }
}

@media screen and (max-height: 600px) {
  .gift-reward-container {
    padding: 20px 30px;
  }
  
  .gift-pixel-art {
    width: 80px;
    height: 80px;
    margin-bottom: 10px;
  }
  
  .gift-name {
    margin-bottom: 15px;
    font-size: 1.2rem;
  }
}

.demo-limit-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  cursor: pointer;
  animation: overlayFadeIn 0.5s ease-out;
}

.demo-limit-popup {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 60px;
  background: #ef4444; /* Pure red as requested */
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 32px;
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.8),
    0 0 30px rgba(239, 68, 68, 0.5),
    inset 0 0 30px rgba(255, 255, 255, 0.2);
  transform-origin: center;
  color: white;
  text-align: center;
  max-width: 500px;
  width: 90%;
}

.demo-limit-icon {
  font-size: 4rem;
  margin-bottom: 20px;
  filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));
}

.demo-limit-title {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 15px;
  text-transform: uppercase;
  letter-spacing: 2px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.demo-limit-message {
  font-size: 1.2rem;
  margin-bottom: 30px;
  line-height: 1.5;
  white-space: pre-line;
  text-shadow: 0 1px 5px rgba(0, 0, 0, 0.3);
}

.demo-limit-btn {
  background: white;
  color: #ef4444;
  border: none;
  padding: 12px 40px;
  border-radius: 30px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.demo-limit-btn:hover {
  transform: scale(1.05);
  background: #fef2f2;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}

/* Responsive adjustments */
@media screen and (max-width: 768px) {
  .demo-limit-popup {
    padding: 30px 40px;
  }
  
  .demo-limit-icon {
    font-size: 3rem;
  }
  
  .demo-limit-title {
    font-size: 1.5rem;
  }
  
  .demo-limit-message {
    font-size: 1rem;
  }
  
  .demo-limit-btn {
    padding: 10px 30px;
    font-size: 1rem;
  }
}

@media screen and (max-height: 600px) {
  .demo-limit-popup {
    padding: 20px 30px;
  }
  
  .demo-limit-icon {
    font-size: 2.5rem;
    margin-bottom: 10px;
  }
  
  .demo-limit-title {
    font-size: 1.2rem;
    margin-bottom: 10px;
  }
  
  .demo-limit-message {
    font-size: 0.9rem;
    margin-bottom: 15px;
  }
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
@keyframes floatUpDown {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-20px) scale(1.02);
  }
}

@keyframes fadeOutGift {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.8);
  }
}

@keyframes overlayFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>