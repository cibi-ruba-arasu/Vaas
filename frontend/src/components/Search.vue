<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { API_URL } from '../config.js';
const route = useRoute();
const router = useRouter();

const searchQuery = ref(route.query.q || "");
const isLoading = ref(true);
const searchResults = ref({ games: [], users: [] });
const token = sessionStorage.getItem("token");

// --- AURA & STAR BACKGROUND LOGIC ---
const auraColor = ref("#0077ff");
const starsSmall = ref('');
const starsMedium = ref('');
const starsLarge = ref('');
const mouseX = ref(0);
const mouseY = ref(0);

const generateStars = (count, blur) => {
  let shadows = [];
  for (let i = 0; i < count; i++) {
    const x = (Math.random() * 110 - 5).toFixed(2);
    const y = (Math.random() * 210 - 5).toFixed(2);
    // 80% Aura Color, 20% White
    const color = Math.random() > 0.2 ? auraColor.value : '#FFF';
    shadows.push(`${x}vw ${y}vh ${blur}px ${color}`);
  }
  return shadows.join(', ');
};

const updateStarFields = () => {
  starsSmall.value = generateStars(400, 0);
  starsMedium.value = generateStars(150, 1);
  starsLarge.value = generateStars(50, 2);
};

const handleMouseMove = (e) => {
  mouseX.value = (e.clientX - window.innerWidth / 2) * -0.01;
  mouseY.value = (e.clientY - window.innerHeight / 2) * -0.01;
};

// Update stars dynamically if aura color changes
watch(auraColor, () => {
  updateStarFields();
});

// Sync NSFW preference with Homepage
const showNSFW = ref(localStorage.getItem("showNSFW") === "true");

watch(showNSFW, (newVal) => {
  localStorage.setItem("showNSFW", newVal);
});

// Dynamic Font Loader for Game Titles
const loadGoogleFont = (fontFamily) => {
  if (!fontFamily || fontFamily === 'sans-serif' || fontFamily === 'Inter') return;
  const fontId = `font-${fontFamily.replace(/\s+/g, '-')}`;
  if (!document.getElementById(fontId)) {
    const link = document.createElement('link');
    link.id = fontId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}&display=swap`;
    document.head.appendChild(link);
  }
};

const executeSearch = async () => {
  if (!searchQuery.value) return;
  isLoading.value = true;
  
  try {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_URL}/search/global?q=${encodeURIComponent(searchQuery.value)}`, { headers });
    if (res.ok) {
      const data = await res.json();
      searchResults.value = data;
      
      // Load fonts for the games we just found
      data.games.forEach(g => loadGoogleFont(g.titleFont));
    }
  } catch (err) {
    console.error("Search failed:", err);
  } finally {
    isLoading.value = false;
  }
};

// Re-trigger search if user modifies query while on the page
watch(() => route.query.q, (newQ) => {
  searchQuery.value = newQ;
  executeSearch();
});

onMounted(async () => {
  // Init star background and tracking
  window.addEventListener('mousemove', handleMouseMove);
  updateStarFields();

  // Fetch user's Aura Color
  if (token) {
    try {
      const res = await fetch(`${API_URL}/user/theme`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.themeColor) auraColor.value = data.themeColor;
      }
    } catch (e) {
      console.error("Failed to load user theme", e);
    }
  }

  executeSearch();
});

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove);
});
</script>

<template>
  <div class="search-page-container" :style="{ '--aura': auraColor, '--mouse-x': mouseX + 'px', '--mouse-y': mouseY + 'px' }">
    
    <div class="sky-container">
      <div class="parallax-wrap p-1">
        <div class="star-layer layer-1" :style="{ boxShadow: starsSmall }"></div>
      </div>
      <div class="parallax-wrap p-2">
        <div class="star-layer layer-2" :style="{ boxShadow: starsMedium }"></div>
      </div>
      <div class="parallax-wrap p-3">
        <div class="star-layer layer-3" :style="{ boxShadow: starsLarge }"></div>
      </div>
    </div>

    <div class="content-layer">
      <div class="search-header">
        <div class="header-top-row">
          <button class="back-btn" @click="router.push('/home')">
            &larr; Back to Void
          </button>
          <div class="nsfw-toggle-wrapper" title="Toggle NSFW Thumbnails">
            <span class="nsfw-label">NSFW</span>
            <label class="switch">
              <input type="checkbox" v-model="showNSFW">
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <h1 class="search-title">
          Results for <span class="highlight">"{{ searchQuery }}"</span>
        </h1>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Consulting the Oracle...</p>
      </div>

      <div v-else class="results-wrapper">
        <div v-if="searchResults.users.length === 0 && searchResults.games.length === 0" class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="M21 21l-4.35-4.35" stroke-linecap="round"></path>
          </svg>
          <h2>No fragments found</h2>
          <p>Try adjusting your search terms or expanding your preferences.</p>
        </div>

        <section v-if="searchResults.users.length > 0" class="result-section">
          <h2 class="section-heading">Creators</h2>
          <div class="user-grid">
            <div 
              v-for="user in searchResults.users" 
              :key="user._id" 
              class="user-card glass-panel"
              @click="router.push(`/user/${user.userid}`)"
            >
              <div class="user-avatar">
                <img :src="user.profilePic || '/default-avatar.png'" alt="Profile">
              </div>
              <div class="user-info">
                <div class="user-name-row">
                  <h3>{{ user.username }}</h3>
                  <span v-if="user.verified === 'verified'" title="Verified Creator" class="verified-badge">✓</span>
                </div>
                <p class="user-handle">@{{ user.userid }}</p>
                <span class="follower-count">{{ user.followersCount || 0 }} Followers</span>
              </div>
            </div>
          </div>
        </section>

        <section v-if="searchResults.games.length > 0" class="result-section">
          <h2 class="section-heading">Weaves</h2>
          <div class="feed-grid">
            <div 
              v-for="weave in searchResults.games" 
              :key="weave._id" 
              class="weave-card glass-panel"
              @click="router.push(`/post/${weave._id}`)"
            >
              <div class="weave-thumb" :style="{ backgroundImage: `url(${weave.thumbnail || '/placeholder.jpg'})` }">
                 
                 <div v-if="!showNSFW && weave.isThumbnailNSFW" class="nsfw-overlay">
                    <span class="nsfw-text">NSFW</span>
                 </div>

                 <div v-if="weave.monetization?.isPaid" class="premium-badge">Premium</div>
              </div>
              
              <div class="weave-info">
                 <h3 class="weave-title" :style="{ fontFamily: weave.titleFont || 'Cinzel' }">{{ weave.name }}</h3>
                 <span class="weave-author">by @{{ weave.authorName }}</span>
                 
                 <div class="weave-stats">
                    <span title="Likes">❤️ {{ weave.likes || 0 }}</span>
                    <span title="Plays">▶️ {{ weave.plays || 0 }}</span>
                 </div>
                 
                 <div class="weave-tags">
                   <span v-for="cat in weave.categories.slice(0, 3)" :key="cat" class="mini-tag">{{ cat }}</span>
                   <span v-for="cat in weave.customCategories.slice(0, 1)" :key="cat" class="mini-tag custom">{{ cat }}</span>
                 </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-page-container {
  min-height: 100vh;
  background: #020617;
  color: white;
  padding: 40px 5% 5rem;
  font-family: 'Inter', sans-serif;
  position: relative;
  overflow-x: hidden;
}

/* --- NIGHT SKY EFFECT --- */
.sky-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0; /* Background layer */
  overflow: hidden;
  pointer-events: none; 
}

.parallax-wrap {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transition: transform 0.1s ease-out; 
}

.p-1 { transform: translate(calc(var(--mouse-x) * 0.5), calc(var(--mouse-y) * 0.5)); }
.p-2 { transform: translate(calc(var(--mouse-x) * 1.5), calc(var(--mouse-y) * 1.5)); }
.p-3 { transform: translate(calc(var(--mouse-x) * 3.0), calc(var(--mouse-y) * 3.0)); }

.star-layer {
  position: absolute;
  top: 0;
  left: 0;
  background: transparent;
  border-radius: 50%; 
}

.star-layer::after {
  content: "";
  position: absolute;
  top: 200vh;
  left: 0;
  width: inherit;
  height: inherit;
  background: transparent;
  border-radius: inherit;
  box-shadow: inherit; 
}

.layer-1 { width: 1.5px; height: 1.5px; animation: drift 150s linear infinite; }
.layer-2 { width: 2.5px; height: 2.5px; animation: drift 100s linear infinite, twinkle 6s ease-in-out infinite alternate; }
.layer-3 { width: 3.5px; height: 3.5px; animation: drift 50s linear infinite, twinkle 4s ease-in-out infinite alternate; }

@keyframes drift {
  from { transform: translateY(0); }
  to { transform: translateY(-200vh); }
}

@keyframes twinkle {
  0% { opacity: 0.2; }
  100% { opacity: 1; }
}

/* --- MAIN CONTENT LAYER --- */
.content-layer {
  position: relative;
  z-index: 10; /* Above the stars */
}

.search-header {
  margin-bottom: 3rem;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  padding-bottom: 2rem;
}

.header-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.back-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: #94a3b8;
  font-size: 0.95rem;
  padding: 8px 16px;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  transition: all 0.2s;
  backdrop-filter: blur(10px);
}

.back-btn:hover {
  background: rgba(255,255,255,0.1);
  color: #fff;
  border-color: var(--aura, #3b82f6);
  transform: translateX(-5px);
  box-shadow: 0 0 15px rgba(0,0,0,0.5);
}

.search-title {
  font-family: 'Cinzel', serif;
  font-size: 2.5rem;
  font-weight: 400;
  margin: 0;
  text-align: center;
  text-shadow: 0 4px 20px rgba(0,0,0,0.5);
}

.highlight {
  color: var(--aura, #3b82f6);
  font-style: italic;
  text-shadow: 0 0 15px var(--aura, #3b82f6);
}

.section-heading {
  font-family: 'Cinzel', serif;
  font-size: 1.8rem;
  color: #94a3b8;
  margin-bottom: 1.5rem;
  border-left: 4px solid var(--aura, #3b82f6);
  padding-left: 15px;
}

.result-section {
  margin-bottom: 4rem;
}

/* --- LOADING & EMPTY STATES --- */
.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-top: 5rem;
  color: #64748b;
  background: rgba(15, 23, 42, 0.4);
  padding: 40px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.05);
}

.spinner {
  width: 50px; height: 50px;
  border: 4px solid rgba(255,255,255,0.1);
  border-top-color: var(--aura, #3b82f6);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.empty-state svg { width: 80px; height: 80px; opacity: 0.5; color: var(--aura, #3b82f6); }
@keyframes spin { to { transform: rotate(360deg); } }

/* --- USER GRID --- */
.user-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s;
  backdrop-filter: blur(10px);
}

.user-card:hover {
  transform: translateY(-5px);
  border-color: var(--aura, rgba(59, 130, 246, 0.5));
  box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 0 15px rgba(255,255,255,0.02);
}

.user-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid rgba(255,255,255,0.1);
  flex-shrink: 0;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-info { display: flex; flex-direction: column; gap: 4px; }
.user-name-row { display: flex; align-items: center; gap: 5px; }
.user-name-row h3 { margin: 0; font-size: 1.1rem; color: #f1f5f9; }
.verified-badge { color: var(--aura, #3b82f6); font-size: 0.9rem; font-weight: bold; }
.user-handle { margin: 0; font-size: 0.85rem; color: #64748b; }
.follower-count { font-size: 0.75rem; color: #fff; font-weight: 600; background: var(--aura, rgba(59, 130, 246, 0.5)); padding: 2px 8px; border-radius: 4px; width: fit-content; opacity: 0.8;}


/* --- GAME GRID --- */
.feed-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 25px;
}

.weave-card {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  position: relative;
  z-index: 1;
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s, z-index 0s;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
}

.weave-card:hover {
  z-index: 20;
  transform: translateY(-8px) scale(1.12);
  border-color: var(--aura, #3b82f6);
  box-shadow: 0 25px 50px rgba(0,0,0,0.8), 0 0 20px rgba(255,255,255,0.05);
}

.weave-thumb {
  height: 180px;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  transition: background-size 0.3s ease, background-color 0.3s ease;
}

.weave-card:hover .weave-thumb {
  background-size: contain;
  background-color: #050508;
}

.premium-badge {
  position: absolute;
  top: 10px; right: 10px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white; font-size: 0.7rem; font-weight: 700;
  padding: 3px 8px; border-radius: 6px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.5);
  font-family: 'Inter', sans-serif;
  z-index: 3;
}

.weave-info { padding: 16px; display: flex; flex-direction: column; gap: 8px; }

.weave-title {
  margin: 0; font-size: 1.3rem; color: #f1f5f9;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.weave-author { font-size: 0.85rem; color: #94a3b8; font-family: 'Inter', sans-serif; }

.weave-stats {
  display: flex; gap: 12px; margin-top: 5px;
  font-size: 0.8rem; color: #cbd5e1; font-family: 'Inter', sans-serif;
}

.weave-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.mini-tag { 
  font-size: 0.7rem; background: rgba(255,255,255,0.05); 
  padding: 2px 8px; border-radius: 4px; color: #94a3b8; border: 1px solid rgba(255,255,255,0.1);
}
.mini-tag.custom {
  color: var(--aura, #3b82f6); border-color: var(--aura, rgba(59, 130, 246, 0.3)); background: rgba(255,255,255,0.05);
}

/* --- NSFW BLUR & TOGGLE STYLES --- */
.nsfw-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  z-index: 2;
}

.nsfw-text {
  color: #f87171;
  font-family: 'Inter', sans-serif;
  font-weight: 800;
  letter-spacing: 3px;
  background: rgba(0,0,0,0.5);
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid rgba(248, 113, 113, 0.3);
}

.nsfw-toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.05);
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(10px);
}

.nsfw-label {
  font-size: 0.75rem;
  color: #94a3b8;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  letter-spacing: 1px;
}

.switch { position: relative; display: inline-block; width: 36px; height: 20px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; inset: 0; background-color: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); transition: .4s; border-radius: 20px; }
.slider:before { position: absolute; content: ""; height: 12px; width: 12px; left: 3px; bottom: 3px; background-color: #94a3b8; transition: .4s; border-radius: 50%; }

input:checked + .slider { background-color: rgba(239, 68, 68, 0.2); border-color: #ef4444; }
input:checked + .slider:before { transform: translateX(16px); background-color: #ef4444; box-shadow: 0 0 8px rgba(239, 68, 68, 0.8); }
</style>