<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue"
import { useRouter } from "vue-router"

const router = useRouter()
const auraColor = ref("#0077ff") 
const token = sessionStorage.getItem("token")

const showNotifications = ref(false)
const notifications = ref([])
const unreadCount = ref(0)
let notificationInterval

// UI States
const showSettings = ref(false)
const showCustomize = ref(false)
const showSidebar = ref(false)

// Search States
const searchQuery = ref("")
const searchResults = ref([])
const isSearching = ref(false)

const fetchNotifications = async () => {
  try {
    const res = await fetch("http://localhost:5000/notifications", {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      notifications.value = data.alerts
      unreadCount.value = data.unreadCount
    }
  } catch (e) {
    console.error("Omens silent...", e)
  }
}

// --- ACTION: CLICK BELL ---
const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
  if (showNotifications.value) {
    markRead()
  }
}

// --- ACTION: CLICK ALERT ---
const handleNotificationClick = (alert) => {
  showNotifications.value = false
  if (alert.link) router.push(alert.link)
}

// --- ACTION: MARK READ ---
const markRead = async () => {
  if (unreadCount.value > 0) {
    unreadCount.value = 0 // Instant UI update
    try {
      await fetch("http://localhost:5000/notifications/read", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch (e) {
      console.error("Failed to mark read")
    }
  }
}

// Messages Array
const messages = [
  "Weave your path, traveler.",
  "The third eye sees what the mind ignores. 👁️",
  "Align with the universe; let the smoke clear the way.",
  "A quiet spark ignites a thousand endings.",
  "The herb of the earth reveals the patterns of the loom.",
  "Breathe deep. The Great Weaver is listening.",
  "Expand your consciousness to unlock the hidden gates.",
  "The ✨Weavers✨ are listening.",
  "Realms beyond the veil await your discovery.",
  "Higher vibrations lead to deeper stories. 🍃",
  "Pookie the cosmic cat says hello!",
  "Woof meow?",
  "Look at you... so mystical!",
  "Searching for my magical comb, these weaves don't style themselves!"
]
const currentMessage = ref(messages[0])
let messageInterval

// --- Search Logic ---
const handleSearch = async () => {
  if (searchQuery.value.length < 2) {
    searchResults.value = []
    return
  }

  isSearching.value = true
  try {
    // ✅ Updated Endpoint
    const res = await fetch(`http://localhost:5000/search/suggestions?q=${searchQuery.value}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      searchResults.value = await res.json()
    }
  } catch (err) {
    console.error("Search failed", err)
  } finally {
    isSearching.value = false
  }
}

const handleResultClick = (item) => {
  if (item.type === 'user') {
    router.push(`/user/${item.id}`)
  } else {
    router.push(`/post/${item.id}`)
  }
}

const goToSearchPage = () => {
  if (searchQuery.value.trim().length > 0) {
    router.push({ name: 'Search', query: { q: searchQuery.value } })
    // Clear dropdown
    searchResults.value = [] 
  }
}

// Debounce Search (Simple watcher)
let timeout
watch(searchQuery, () => {
  clearTimeout(timeout)
  timeout = setTimeout(handleSearch, 300)
})

onMounted(async () => {
  // Fetch Theme
  const res = await fetch("http://localhost:5000/user/theme", {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (res.ok) {
    const data = await res.json()
    auraColor.value = data.themeColor || "#0077ff"
  }
  fetchNotifications()
  notificationInterval = setInterval(fetchNotifications, 30000) // Check every 30s
  // Rotate Messages
  let i = 0
  messageInterval = setInterval(() => {
    i = (i + 1) % messages.length
    currentMessage.value = messages[i]
  }, 6000)
})

onUnmounted(() => {
  clearInterval(messageInterval)
  clearInterval(notificationInterval) // Clean up
})

const saveColor = async () => {
  await fetch("http://localhost:5000/user/theme", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ color: auraColor.value })
  })
  showCustomize.value = false
}
</script>

<template>
  <div class="loom-container" :style="{ '--aura': auraColor }">
    
    <div class="soul-container">
      <div class="outer-orbit">
        <div class="inner-soul"></div>
      </div>
    </div>

    <nav class="header-nav">
      <div class="nav-top-row">
        <div class="nav-left">
          <button class="menu-toggle" @click="showSidebar = !showSidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
              <path d="M3 12h18M3 6h18M3 18h18" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="branding">
          <h1 class="loom-title">LoomArt</h1>
          <Transition name="fade-slide" mode="out-in">
            <p :key="currentMessage" class="loom-status">{{ currentMessage }}</p>
          </Transition>
        </div>
        
        <div class="desktop-spacer"></div>
      </div>

      <div class="nav-actions">
        <button class="aura-btn" title="Whispers">
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.5">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>

        <div class="notification-wrapper">
          <button 
            class="aura-btn bell-btn" 
            :class="{ 'oscillating': unreadCount > 0 }"
            @click="toggleNotifications" 
            title="Omens"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            
            <span v-if="unreadCount > 0" class="red-dot"></span>
          </button>

          <Transition name="fade-slide">
            <div v-if="showNotifications" class="notifications-dropdown glass-panel">
              <div class="notif-header">
                <h3>Omens</h3>
                <span v-if="notifications.length > 0" class="clear-all" @click="markRead">Mark all read</span>
              </div>

              <div v-if="notifications.length === 0" class="empty-notif">
                <p>The winds are silent.</p>
              </div>

              <ul v-else class="notif-list">
                <li 
                  v-for="alert in notifications" 
                  :key="alert._id" 
                  class="notif-item" 
                  :class="{ 'unread': !alert.isRead }"
                  @click="handleNotificationClick(alert)"
                >
                  <div class="notif-avatar">
                    <img v-if="alert.sender.profilePic" :src="alert.sender.profilePic" />
                    <span v-else>{{ alert.sender.username.charAt(0) }}</span>
                  </div>
                  <div class="notif-content">
                    <p>{{ alert.message }}</p>
                    <span class="notif-time">{{ new Date(alert.createdAt).toLocaleDateString() }}</span>
                  </div>
                  <div v-if="!alert.isRead" class="unread-indicator"></div>
                </li>
              </ul>
            </div>
          </Transition>
        </div>

        <button class="aura-btn" @click="router.push('/profile')" title="Your Essence">
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>

        <div class="settings-wrapper">
          <button class="aura-btn" @click="showSettings = !showSettings">
            <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          
          <Transition name="fade">
            <div v-if="showSettings" class="dropdown">
              <button v-if="!showCustomize" @click="showCustomize = true">Adjust Aura</button>
              <div v-else class="color-picker">
                <input type="color" v-model="auraColor" />
                <button @click="saveColor">Bind</button>
                <button class="small-link" @click="showCustomize = false">Back</button>
              </div>
            </div>
          </Transition>
        </div>

        <button class="create-btn" @click="router.push('/create')" title="Weave New Thread">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

      </div>
    </nav>
    <div class="search-band">
      <div class="search-container">
        
        <div class="input-wrapper">
          <span class="search-icon">🔍</span>
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="Seek the unknown..." 
            class="mystic-input"
            @keyup.enter="goToSearchPage" 
          />
          <button class="go-btn" @click="goToSearchPage" v-if="searchQuery.length > 0">→</button>
        </div>

        <Transition name="fade">
          <div v-if="searchResults.length > 0 || isSearching" class="search-results">
            
            <div v-if="isSearching" class="search-loading">
              <span class="tiny-spinner"></span> Searching the threads...
            </div>
            
            <div 
              v-else 
              v-for="item in searchResults" 
              :key="item.id" 
              class="search-item"
              :class="item.type"
              @click="handleResultClick(item)"
            >
              
              <div v-if="item.type === 'publish'" class="content-row">
                 <div class="mini-thumb" :style="{ backgroundImage: item.image ? `url(${item.image})` : 'none', backgroundColor: '#111' }"></div>
                 <div class="text-col">
                   <span class="main-text">{{ item.mainText }}</span>
                   <span class="sub-text">{{ item.subText }}</span>
                 </div>
              </div>

              <div v-else class="content-row user-row">
                 <span class="user-prefix">u/</span>
                 <span class="main-text user-text">{{ item.mainText }}</span>
              </div>

            </div>

          </div>
        </Transition>
      </div>
    </div>
    <Transition name="slide-in">
      <aside v-if="showSidebar" class="sidebar">
        <div class="sidebar-header">
           <button class="close-sidebar" @click="showSidebar = false">✕</button>
        </div>
        <div class="sidebar-content">
          <h3>The Loom</h3>
          <ul>
            <li @click="router.push('/recent')">Recent</li>
            <li @click="router.push('/trending')">Trending</li>
            <li @click="router.push('/explore')">Explore</li>
            <li @click="router.push('/popular')">Popular</li>
            <li @click="router.push('/verified')">Verified weavers</li>
            <li class="logout" @click="router.push('/login')">Disconnect</li>
          </ul>
        </div>
      </aside>
    </Transition>
    <Transition name="fade">
      <div v-if="showSidebar" class="sidebar-overlay" @click="showSidebar = false"></div>
    </Transition>

    <main class="loom-void"></main>
  </div>
</template>

<style scoped>
.loom-container {
  min-height: 100vh;
  background-color: #050508;
  color: #f0f0f0;
  font-family: 'Cinzel', serif;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  z-index: 1; 
}

/* --- THE LIVING CORE (Background) --- */
.soul-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  height: 600px;
  pointer-events: none;
  z-index: 0; 
  display: flex;
  align-items: center;
  justify-content: center;
}

.outer-orbit {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.03);
  background: radial-gradient(circle, rgba(255,255,255,0.01) 0%, transparent 60%);
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform, opacity; 
  animation: breathe 8s ease-in-out infinite; 
}

.inner-soul {
  width: 300px;
  height: 300px;
  background: var(--aura);
  opacity: 0.2;
  border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
  filter: blur(60px);
  will-change: transform, translate, border-radius; 
  animation: 
    breathe 8s ease-in-out infinite,
    wander 20s linear infinite alternate,
    morph 10s ease-in-out infinite alternate;
}

/* --- RESPONSIVE HEADER --- */
.header-nav {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 3%;
  z-index: 10;
  position: relative;
  background: rgba(5, 5, 8, 0.2);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  /* The First Line: Below the Main Title Header */
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-wrap: wrap;
}

.header-nav::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 5%; right: 5%;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
}

.nav-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: auto;
  flex-grow: 1;
}

.nav-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  align-items: center;
}

.menu-toggle {
  background: transparent; border: none; cursor: pointer; padding: 0.5rem;
}
.menu-toggle svg { width: 32px; height: 32px; filter: drop-shadow(0 0 5px rgba(255,255,255,0.5)); }

.branding {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  pointer-events: none;
}

.loom-title {
  font-size: clamp(1.8rem, 4vw, 2.5rem);
  font-weight: 500;
  letter-spacing: 0.3rem;
  margin: 0;
  color: #fff;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.5), 0 0 50px var(--aura);
}

.loom-status {
  font-family: 'Didot', serif;
  font-style: italic;
  font-size: clamp(0.8rem, 2vw, 1rem);
  color: #ccc;
  margin-top: 0.2rem;
  min-height: 1.4em;
}

.aura-btn {
  background: transparent; border: none; cursor: pointer; padding: 8px; border-radius: 50%; transition: background 0.3s;
}
.aura-btn svg { width: 24px; height: 24px; filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.6)); }
.aura-btn:hover { background: rgba(255,255,255,0.1); }

.create-btn {
  background-color: var(--aura);
  border: none;
  border-radius: 50%;
  width: 45px;
  height: 45px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 0 15px var(--aura);
  margin-left: 0.5rem;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.create-btn svg { width: 24px; height: 24px; filter: drop-shadow(0 0 2px rgba(0,0,0,0.5)); }
.create-btn:hover { transform: scale(1.15) rotate(90deg); box-shadow: 0 0 30px var(--aura), inset 0 0 10px rgba(255,255,255,0.5); }
.desktop-spacer { width: 40px; }

/* --- SEARCH BAND --- */
.search-band {
  width: 100%;
  position: relative;
  z-index: 9;
  background: rgba(5, 5, 8, 0.15);
  backdrop-filter: blur(15px);
  display: flex;
  justify-content: center;
  padding: 1rem 0;
}

/* The Second Line: Below the Search Bar */
.search-band::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 10%; right: 10%; /* Slightly shorter than the main header line */
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%);
}

.search-container {
  position: relative;
  width: 100%;
  max-width: 500px;
  margin: 0 1rem;
}

.input-wrapper {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50px;
  padding: 0.4rem 1rem; /* Compact padding */
  transition: all 0.3s ease;
  position: relative;
}

.go-btn {
  background: rgba(255,255,255,0.1);
  border: none;
  color: white;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 10px;
  transition: 0.2s;
}
.go-btn:hover { background: var(--aura); }

.input-wrapper:focus-within {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--aura);
  box-shadow: 0 0 15px rgba(0,0,0,0.5);
}

.search-icon {
  margin-right: 0.5rem;
  opacity: 0.6;
}

.mystic-input {
  background: transparent;
  border: none;
  color: #fff;
  font-family: 'Cinzel', serif;
  font-size: 1rem;
  width: 100%;
  outline: none;
}
.mystic-input::placeholder {
  color: rgba(255,255,255,0.4);
  font-style: italic;
}

/* --- Search Results Dropdown --- */
.search-results {
  position: absolute;
  top: 115%; /* Slight gap from input */
  left: 0;
  width: 100%;
  background: #0a0a0c; /* Solid dark background for readability */
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 8px 0;
  box-shadow: 0 10px 40px rgba(0,0,0,0.9);
  max-height: 450px; /* Space for ~10 items */
  overflow-y: auto;
}

/* --- LIST ITEMS --- */
.search-item {
  padding: 12px 18px; /* More breathing room */
  cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  transition: all 0.1s;
}
.search-item:last-child { border-bottom: none; }
.search-item:hover { background: rgba(255,255,255,0.08); }

.content-row { display: flex; align-items: center; gap: 14px; }

/* --- PUBLISH STYLES (Aura Highlight) --- */
.search-item.publish {
  border-left: 3px solid var(--aura); /* Subtle Aura Highlight */
  background: linear-gradient(90deg, rgba(255,255,255,0.02), transparent);
}
.search-item.publish:hover {
  background: linear-gradient(90deg, rgba(255,255,255,0.1), transparent);
}

.mini-thumb {
  width: 40px; /* Larger thumb */
  height: 40px;
  border-radius: 6px;
  background-size: cover;
  background-position: center;
  border: 1px solid rgba(255,255,255,0.1);
}

.text-col { display: flex; flex-direction: column; justify-content: center; }
.main-text { font-size: 1rem; color: #eee; font-family: 'Inter', sans-serif; font-weight: 600; line-height: 1.2; }
.sub-text { font-size: 0.75rem; color: #888; font-family: 'Inter', sans-serif; margin-top: 2px; }

/* --- USER STYLES (Minimal & Larger) --- */
.search-item.user {
  padding-left: 24px; /* Slight indent to differentiate from highlighted projects */
}
.user-row { gap: 4px; align-items: baseline; }
.user-prefix { color: #666; font-size: 0.9rem; font-family: 'Inter', sans-serif; font-weight: 700; }
.user-text { color: #ccc; font-weight: 500; font-size: 1.05rem; } /* Slightly larger for users */

.search-loading {
  padding: 15px;
  text-align: center;
  font-size: 0.9rem;
  color: #888;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.tiny-spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.1);
  border-top-color: var(--aura);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* --- SIDEBAR --- */
.sidebar {
  position: fixed; top: 0; left: 0; width: 280px; height: 100vh;
  background: rgba(10, 10, 15, 0.95); backdrop-filter: blur(20px);
  border-right: 1px solid rgba(255,255,255,0.05); z-index: 100;
  padding: 2rem; box-shadow: 10px 0 30px rgba(0,0,0,0.5);
  display: flex; flex-direction: column;
}
.sidebar-header { display: flex; justify-content: flex-end; margin-bottom: 2rem; }
.close-sidebar { background: none; border: none; color: #fff; font-size: 1.5rem; cursor: pointer; }
.sidebar h3 {
  color: var(--aura); text-transform: uppercase; letter-spacing: 0.2rem;
  margin-bottom: 2rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem;
}
.sidebar ul { list-style: none; padding: 0; }
.sidebar li { margin: 1.5rem 0; font-size: 1.2rem; cursor: pointer; color: #ddd; transition: 0.3s; }
.sidebar li:hover { color: var(--aura); transform: translateX(10px); }
.logout { color: #ff4444 !important; margin-top: 3rem; }
.sidebar-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 90; backdrop-filter: blur(4px); }
.dropdown { position: absolute; right: 0; top: 100%; background: #111; padding: 1rem; border: 1px solid #333; z-index: 50; border-radius: 8px; width: 200px; }

/* --- ANIMATIONS --- */
@keyframes breathe { 0%, 100% { transform: scale(1); opacity: 0.15; } 50% { transform: scale(1.3); opacity: 0.4; } }
@keyframes wander { 0% { translate: 0 0; } 100% { translate: 20px -20px; } }
@keyframes morph { 0% { border-radius: 60% 40% 30% 70%; } 100% { border-radius: 30% 60% 70% 40%; } }
.slide-in-enter-active, .slide-in-leave-active { transition: transform 0.4s ease; }
.slide-in-enter-from, .slide-in-leave-to { transform: translateX(-100%); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-slide-enter-active, .fade-slide-leave-active { transition: all 0.6s ease; }
.fade-slide-enter-from { opacity: 0; transform: translateY(5px); }
.fade-slide-leave-to { opacity: 0; transform: translateY(-5px); }

/* --- MEDIA QUERIES --- */
@media (max-width: 768px) {
  .header-nav { flex-direction: column; padding: 1rem; gap: 1rem; }
  .nav-top-row { width: 100%; position: relative; justify-content: flex-start; }
  .branding { position: relative; left: auto; transform: none; margin-bottom: 0.5rem; pointer-events: auto; }
  .desktop-spacer { display: none; }
  .nav-actions { width: 100%; justify-content: center; gap: 1.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.05); }
  .loom-title { font-size: 2rem; }
  .sidebar { width: 100%; }
  .soul-container { width: 90vw; height: 90vw; }
  .inner-soul { width: 60%; height: 60%; }
  
  /* Mobile adjustments for Search Dropdown */
  .search-results { max-height: 60vh; }
  .search-item { padding: 14px 18px; } /* Larger touch targets */
  .mini-thumb { width: 45px; height: 45px; }
  .main-text { font-size: 1.1rem; }
  .user-text { font-size: 1.15rem; }
}
@media (max-width: 400px) {
  .nav-actions { gap: 0.8rem; }
  .aura-btn svg { width: 22px; height: 22px; }
  .create-btn { width: 40px; height: 40px; }
}
.notification-wrapper { position: relative; }

.bell-btn { position: relative; }
.bell-btn.oscillating svg { animation: oscillate 2s ease-in-out infinite; transform-origin: top center; }

.red-dot {
  position: absolute; top: 6px; right: 8px;
  width: 8px; height: 8px;
  background-color: #ef4444;
  border-radius: 50%;
  box-shadow: 0 0 5px #ef4444;
}

/* OSCILLATION ANIMATION */
@keyframes oscillate {
  0% { transform: rotate(0deg); }
  10% { transform: rotate(15deg); }
  20% { transform: rotate(-10deg); }
  30% { transform: rotate(5deg); }
  40% { transform: rotate(-5deg); }
  50% { transform: rotate(0deg); }
  100% { transform: rotate(0deg); } /* Long pause */
}

/* DROPDOWN */
.notifications-dropdown {
  position: absolute; top: 120%; right: -50px;
  width: 320px; max-height: 400px;
  background: rgba(10, 10, 15, 0.95);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0,0,0,0.8);
}

.notif-header {
  padding: 12px 15px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  display: flex; justify-content: space-between; align-items: center;
}
.notif-header h3 { margin: 0; font-size: 0.9rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
.clear-all { font-size: 0.7rem; color: #3b82f6; cursor: pointer; }

.notif-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; }

.notif-item {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 12px 15px;
  border-bottom: 1px solid rgba(255,255,255,0.02);
  cursor: pointer; transition: background 0.2s;
}
.notif-item:hover { background: rgba(255,255,255,0.05); }
.notif-item.unread { background: rgba(59, 130, 246, 0.05); }

.notif-avatar {
  width: 36px; height: 36px; border-radius: 50%; overflow: hidden;
  background: #1e293b; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 1rem; color: #fff; font-family: 'Cinzel';
}
.notif-avatar img { width: 100%; height: 100%; object-fit: cover; }

.notif-content p { margin: 0; font-size: 0.85rem; color: #e2e8f0; line-height: 1.4; font-family: 'Inter', sans-serif; }
.notif-time { font-size: 0.7rem; color: #64748b; margin-top: 4px; display: block; }

.unread-indicator {
  width: 6px; height: 6px; background: #3b82f6; border-radius: 50%; margin-top: 6px;
}

.empty-notif { padding: 2rem; text-align: center; color: #64748b; font-style: italic; font-size: 0.9rem; }

/* Mobile Adjustment */
@media (max-width: 500px) {
  .notifications-dropdown { right: -20px; width: 300px; }
}
</style>