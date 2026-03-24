<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { API_URL } from '../config.js';
import Popup from './Popup.vue'; //
const showAuthModal = ref(false);
const route = useRoute()
const router = useRouter()
const token = sessionStorage.getItem("token")
let myUserId = null

if (token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    myUserId = payload.mongoId
  } catch (e) {}
}

const loading = ref(true)
const error = ref(null)
const isFollowing = ref(false) // Local state for button
const isActionLoading = ref(false)

const user = ref({
  username: "Loading...",
  userid: "",
  description: { blocks: [], container: { colors: ['transparent'], angle: 135 } },
  profilePic: null,
  verified: 'normal',
  themeColor: '#3b82f6', // Default until loaded
  stats: { followers: 0, following: 0, rating: 0.0, weaves: 0 },
  badges: []
})

const projects = ref([])

// --- STAR BACKGROUND LOGIC ---
const auraColor = computed(() => user.value.themeColor || '#3b82f6');
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
    // 80% User's Aura Color, 20% White
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

// Update stars when we fetch the user's custom color
watch(auraColor, () => {
  updateStarFields();
});

// 1. Helper function to inject the font
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

// 2. Watcher to load fonts whenever user object updates
watch(() => user.value, (newUser) => {
  if (!newUser) return;
  
  // Load font for equipped Earned PFP
  if (newUser.active_pfp_type === 'earned' && newUser.active_earned_ref?.giftFont) {
    loadGoogleFont(newUser.active_earned_ref.giftFont);
  }
  
  // Load fonts for all Badges
  if (newUser.badges && newUser.badges.length > 0) {
    newUser.badges.forEach(badge => {
      if (badge.giftFont) {
        loadGoogleFont(badge.giftFont);
      }
    });
  }
}, { deep: true, immediate: true });

/* --- HELPER: Gradient Generator --- */
const getGradient = (colors, angle) => {
  if (!colors || colors.length === 0) return 'transparent';
  if (colors.length === 1) return colors[0];
  return `linear-gradient(${angle}deg, ${colors.join(', ')})`;
};

/* --- HELPER: Container Style --- */
const containerStyle = computed(() => {
  const desc = user.value.description;
  if (desc && desc.container) {
    return {
      background: getGradient(desc.container.colors, desc.container.angle),
      padding: '20px',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.1)'
    };
  }
  return {};
});

/* --- API: FETCH USER --- */
const fetchUserProfile = async () => {
  loading.value = true
  error.value = null
  
  try {
    const res = await fetch(`${API_URL}/users/${route.params.userid}`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (res.ok) {
      const data = await res.json()
      user.value = data.user
      projects.value = data.projects
      isFollowing.value = data.isFollowing // ✅ Set initial state
      
      // Handle legacy description format
      if (typeof user.value.description === 'string') {
          user.value.description = { blocks: [{ id: 1, type: 'text', content: user.value.description, align: 'left', textColors: ['#cbd5e1'] }] };
      }
    } else {
      error.value = "Weaver not found."
    }
  } catch (e) {
    error.value = "Connection lost."
  } finally {
    loading.value = false
  }
}

/* --- ACTION: FOLLOW / UNFOLLOW --- */
const toggleFollow = async () => {

  if (!token) {
    showAuthModal.value = true; // Replace router.push
    return;
  }

  if (isActionLoading.value) return;
  isActionLoading.value = true;

  // 1. Optimistic Update (Immediate UI feedback)
  const previousState = isFollowing.value;
  isFollowing.value = !previousState;
  user.value.stats.followers += (isFollowing.value ? 1 : -1);

  try {
    const res = await fetch(`${API_URL}/user/follow/${user.value._id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
    
    if (!data.success) {
      // Revert if failed
      isFollowing.value = previousState;
      user.value.stats.followers = data.followersCount || user.value.stats.followers; // Sync with server if possible
    }
  } catch (e) {
    // Revert on network error
    isFollowing.value = previousState;
    user.value.stats.followers += (isFollowing.value ? 1 : -1);
    console.error("Follow action failed", e);
  } finally {
    isActionLoading.value = false;
  }
}

const isMe = computed(() => user.value._id === myUserId);

const selectedBadge = ref(null);
const badgeSource = ref(null);
const isLoadingBadgeSource = ref(false);

const openBadgeModal = async (badge) => {
  selectedBadge.value = badge;
  badgeSource.value = null; // reset previous data
  isLoadingBadgeSource.value = true;

  try {
    const res = await fetch(`${API_URL}/badges/source/${badge.publishId}`);
    if (res.ok) {
      badgeSource.value = await res.json();
      
      // 🚀 FIX: Load the game's custom font if it exists
      if (badgeSource.value.gameFont) {
        loadGoogleFont(badgeSource.value.gameFont);
      }
    }
  } catch (err) {
    console.error("Failed to unearth badge origins", err);
  } finally {
    isLoadingBadgeSource.value = false;
  }
};

const closeBadgeModal = () => {
  selectedBadge.value = null;
  badgeSource.value = null;
};

/* --- MODAL STATE FOR PFP --- */
const showPfpModal = ref(false);
const pfpSource = ref(null);
const isLoadingPfpSource = ref(false);

const openPfpModal = async () => {
  if (!user.value.profilePic) return; // Don't open if no pic exists

  showPfpModal.value = true;
  pfpSource.value = null;

  // Only fetch data if it's an earned PFP from a game
  if (user.value.active_pfp_type === 'earned' && user.value.active_earned_ref) {
    isLoadingPfpSource.value = true;
    try {
      const res = await fetch(`${API_URL}/badges/source/${user.value.active_earned_ref.publishId}`);
      if (res.ok) {
        pfpSource.value = await res.json();
        if (pfpSource.value.gameFont) {
          loadGoogleFont(pfpSource.value.gameFont);
        }
      }
    } catch (err) {
      console.error("Failed to unearth PFP origins", err);
    } finally {
      isLoadingPfpSource.value = false;
    }
  }
};

const closePfpModal = () => {
  showPfpModal.value = false;
  pfpSource.value = null;
};

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove);
  updateStarFields();
  if (route.params.userid) fetchUserProfile()
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove);
});

// Refetch if route changes (e.g. searching another user)
watch(() => route.params.userid, () => {
    fetchUserProfile();
});

watch(() => user.value, (newVal) => {
   // ✅ FIX: Added a safety check to ensure newVal exists before reading badges
   if (newVal && newVal.badges) newVal.badges.forEach(b => loadGoogleFont(b.giftFont));
}, { deep: true, immediate: true });

watch(() => projects.value, (newVal) => {
   if (newVal && newVal.length > 0) {
      newVal.forEach(pub => loadGoogleFont(pub.titleFont));
   }
}, { deep: true, immediate: true });

</script>

<template>
  <div class="public-profile-page" :style="{ '--aura': auraColor, '--mouse-x': mouseX + 'px', '--mouse-y': mouseY + 'px' }">
    
    <!-- STAR BACKGROUND LAYER -->
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

    <!-- ORB INJECTED WITH AURA -->
    <div class="bg-orb"></div>
    
    <Transition name="fade">
      <div v-if="selectedBadge" class="lightbox" @click.self="closeBadgeModal">
        <div class="badge-modal glass-panel">
          <button class="close-modal-btn" @click="closeBadgeModal">✕</button>
          
          <div class="modal-badge-img-wrapper">
            <img :src="selectedBadge.base64" class="modal-badge-img" />
          </div>

          <h2 
            class="modal-badge-name" 
            :style="{ fontFamily: selectedBadge.giftFont ? `'${selectedBadge.giftFont}', sans-serif` : 'Inter' }"
          >
            {{ selectedBadge.giftName }}
          </h2>

          <div class="modal-badge-origins">
            <div v-if="isLoadingBadgeSource" class="spinner origin-spinner"></div>
            
            <div v-else-if="badgeSource" class="origin-content">
              <span class="origin-label">Discovered in</span>
              <a class="origin-link game-link" @click="router.push(`/post/${selectedBadge.publishId}`)"
                :style="{ fontFamily: badgeSource.gameFont ? `'${badgeSource.gameFont}', sans-serif` : 'inherit' }">
                {{ badgeSource.gameName }}
              </a>
              
              <span class="origin-label">Woven by</span>
              <a class="origin-link artist-link" @click="router.push(`/user/${badgeSource.authorUserId}`); closeBadgeModal()">
                @{{ badgeSource.authorName }}
              </a>
            </div>
            
            <div v-else class="origin-lost">
              <p>The weave this badge belonged to has faded into the void.</p>
            </div>
          </div>
          
        </div>
      </div>
    </Transition>
    <Transition name="fade">
      <div v-if="showPfpModal" class="lightbox" @click.self="closePfpModal">
        <div class="badge-modal glass-panel">
          <button class="close-modal-btn" @click="closePfpModal">✕</button>
          
          <div class="modal-pfp-img-wrapper">
            <img :src="user.profilePic" class="modal-pfp-img" />
          </div>

          <h2 
            v-if="user.active_pfp_type === 'earned' && user.active_earned_ref"
            class="modal-badge-name" 
            :style="{ fontFamily: user.active_earned_ref.giftFont ? `'${user.active_earned_ref.giftFont}', sans-serif` : 'Inter' }"
          >
            {{ user.active_earned_ref.giftName }}
          </h2>
          <h2 v-else class="modal-badge-name" style="font-family: 'Cinzel', sans-serif;">
            Custom Identity
          </h2>

          <div class="modal-badge-origins">
            
            <template v-if="user.active_pfp_type === 'earned'">
              <div v-if="isLoadingPfpSource" class="spinner origin-spinner"></div>
              
              <div v-else-if="pfpSource" class="origin-content">
                <span class="origin-label">Discovered in</span>
                <a class="origin-link game-link" @click="router.push(`/post/${user.active_earned_ref.publishId}`); closePfpModal()"
                  :style="{ fontFamily: pfpSource.gameFont ? `'${pfpSource.gameFont}', sans-serif` : 'inherit' }">
                  {{ pfpSource.gameName }}
                </a>
                
                <span class="origin-label">Woven by</span>
                <a class="origin-link artist-link" @click="router.push(`/user/${pfpSource.authorUserId}`); closePfpModal()">
                  @{{ pfpSource.authorName }}
                </a>
              </div>
              
              <div v-else class="origin-lost">
                <p>The weave this identity belonged to has faded into the void.</p>
              </div>
            </template>

            <template v-else>
               <div class="origin-content">
                  <p style="color: #cbd5e1; font-style: italic; font-size: 0.95rem; margin: 0;">
                    This identity was woven by the Weaver themselves.
                  </p>
               </div>
            </template>

          </div>
          
        </div>
      </div>
    </Transition>
    <div v-if="loading" class="center-msg"><div class="spinner"></div></div>
    
    <div v-else-if="error" class="center-msg">
      <h2>⚠️</h2>
      <p>{{ error }}</p>
      <button class="back-btn" @click="router.push(token ? '/home' : '/homeg')">
        &larr; Back to Void
      </button>
    </div>

    <div v-else class="profile-container">
      
      <div class="profile-header glass-panel">
        <div class="header-content">
          
          <div class="identity-col">
            <div class="pfp-wrapper" @click="openPfpModal">
               <img v-if="user.profilePic" :src="user.profilePic" class="pfp-img" />
               <div v-else class="pfp-placeholder">{{ user.username.charAt(0) }}</div>
            </div>
            
            <div class="names-wrapper">
              <div class="name-row">
                <h1 class="username">{{ user.username }}</h1>
                <span v-if="user.verified === 'verified'" class="badge blue">✔</span>
                <span v-if="user.verified === 'chosen'" class="badge gold">★</span>
              </div>
              
              <div class="location-row" v-if="user.country">
                <span>📍 {{ user.city ? user.city + ', ' : '' }}{{ user.country }}</span>
              </div>
            </div>
          </div>

          <div class="actions-col">
             <div class="stats-row">
                <div class="stat">
                   <span class="val">{{ user.stats.followers }}</span>
                   <span class="lbl">Followers</span>
                </div>
                <div class="stat">
                   <span class="val">{{ user.stats.following }}</span>
                   <span class="lbl">Following</span>
                </div>
                <div class="stat">
                   <span class="val">{{ user.stats.weaves }}</span>
                   <span class="lbl">Weaves</span>
                </div>
             </div>

             <div v-if="!isMe" class="btn-row">
               <button 
                 class="follow-btn" 
                 :class="{ 'following': isFollowing }"
                 @click="toggleFollow"
                 :disabled="isActionLoading"
               >
                 {{ isFollowing ? 'Following' : 'Follow' }}
               </button>
             </div>
          </div>

        </div>
      </div>

      <div class="bio-section glass-panel" v-if="user.description && user.description.blocks">
         <div class="bio-content" :style="containerStyle">
            <div v-for="block in user.description.blocks" :key="block.id" class="bio-block"
              :style="{
                 textAlign: block.align,
                 fontFamily: block.fontFamily,
                 fontSize: block.fontSize + 'px',
                 fontWeight: block.isBold ? 'bold' : 'normal',
                 fontStyle: block.isItalic ? 'italic' : 'normal',
                 color: block.textColors?.[0] || '#cbd5e1',
                 background: getGradient(block.bgColors, block.bgAngle),
                 padding: '4px', borderRadius: '4px'
              }"
            >
              {{ block.content }}
            </div>
         </div>
      </div>
      <div class="badges-section" v-if="user.badges && user.badges.length > 0">
        <h3 class="section-title">Achievements</h3>
        <div class="badge-grid">
          <div 
            v-for="badge in user.badges" 
            :key="badge.giftName" 
            class="badge-card"
            @click="openBadgeModal(badge)"
            style="cursor: pointer;"
          >
            <div class="badge-img-wrapper">
              <img :src="badge.base64" class="badge-img" />
            </div>
            <div class="badge-name" :style="{ fontFamily: badge.giftFont ? `'${badge.giftFont}', sans-serif` : 'Inter' }">
              {{ badge.giftName }}
            </div>
          </div>
        </div>
      </div>
      <div class="projects-section">
        <h3 class="section-title">Published Weaves</h3>
        <div v-if="projects.length > 0" class="projects-grid">
           <div 
             v-for="pub in projects" 
             :key="pub._id" 
             class="project-card"
             @click="router.push(`/post/${pub._id}`)"
           >
              <div class="card-thumb" :style="{ backgroundImage: pub.thumbnail ? `url('${pub.thumbnail}')` : 'linear-gradient(to bottom, #1e293b, #000)' }"></div>
              <div class="card-info">
                 <h3 :style="{ fontFamily: pub.titleFont || 'sans-serif' }">{{ pub.name }}</h3>
                 <div class="preview-tags">
                   <span v-for="cat in pub.categories.slice(0,2)" :key="cat" class="tag">{{ cat }}</span>
                 </div>
                 <div class="card-meta">
                    <span>{{ new Date(pub.publishedAt).toLocaleDateString() }}</span>
                    <span>{{ pub.language.toUpperCase() }}</span>
                 </div>
              </div>
           </div>
        </div>
        <div v-else class="empty-state">
           <p>No stories woven yet.</p>
        </div>
      </div>

    </div>
    <Popup 
      :show="showAuthModal" 
      title="Essence Required"
      description="You are currently drifting as a guest. To follow this Weaver and see their future threads, you must join the Loom."
      iconPath="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
      @close="showAuthModal = false"
    >
      <template #actions>
        <button class="auth-btn login-link" @click="router.push('/login')">Log In</button>
        <button class="auth-btn register-main" @click="router.push('/register')">Register</button>
      </template>
    </Popup>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;600&display=swap');

* { box-sizing: border-box; }

.public-profile-page { min-height: 100vh; background-color: #020617; color: #f0f0f0; font-family: 'Inter', sans-serif; position: relative; padding-bottom: 5rem; overflow-x: hidden; }

/* 🚀 FIX: Orb now uses var(--aura) to match the user's color */
.bg-orb { position: absolute; top: -10%; right: -10%; width: 50vw; height: 50vw; background: radial-gradient(circle, var(--aura) 0%, transparent 70%); opacity: 0.15; filter: blur(80px); pointer-events: none; z-index: 1; }

/* --- NIGHT SKY EFFECT --- */
.sky-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  overflow: hidden;
  pointer-events: none; 
  /* Add the animation here */
  animation: starFadeIn 3s ease-in-out forwards;
}

/* Define the fade-in keyframes */
@keyframes starFadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
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


.center-msg { height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #64748b; gap: 1rem; }
.spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: var(--aura); border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.profile-container { max-width: 1000px; margin: 0 auto; padding: 2rem 5%; display: flex; flex-direction: column; gap: 2rem; position: relative; z-index: 2; }
.glass-panel { background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; overflow: hidden; }

/* HEADER */
.profile-header { padding: 2.5rem; }
.header-content { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 2rem; }

.identity-col { display: flex; align-items: center; gap: 1.5rem; }
.pfp-wrapper { width: 100px; height: 100px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(255,255,255,0.1); background: #0f172a; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
.pfp-img { width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; }
.pfp-placeholder { font-size: 3rem; font-family: 'Cinzel'; color: #64748b; }

.names-wrapper { display: flex; flex-direction: column; }
.name-row { display: flex; align-items: center; gap: 8px; }
.username { margin: 0; font-family: 'Cinzel'; font-size: 2rem; background: linear-gradient(to right, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.badge { font-size: 1rem; }
.badge.blue { color: #3b82f6; }
.badge.gold { color: #fbbf24; }
.userid { color: #64748b; font-size: 0.9rem; }
.location-row { margin-top: 5px; font-size: 0.8rem; color: #94a3b8; }

.actions-col { display: flex; flex-direction: column; align-items: flex-end; gap: 1.5rem; }
.stats-row { display: flex; gap: 20px; }
.stat { display: flex; flex-direction: column; align-items: center; }
.val { font-weight: 700; font-size: 1.1rem; color: white; }
.lbl { font-size: 0.7rem; text-transform: uppercase; color: #64748b; letter-spacing: 1px; }

/* FOLLOW BUTTON */
.follow-btn {
  padding: 8px 24px; border-radius: 20px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none; min-width: 100px;
  background: var(--aura); color: white; box-shadow: 0 4px 15px rgba(0,0,0, 0.3);
}
.follow-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px var(--aura); filter: brightness(1.2); }
.follow-btn.following { background: rgba(255,255,255,0.1); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.2); box-shadow: none; filter: none; }
.follow-btn.following:hover { background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.4); color: #fca5a5; content: "Unfollow"; }

/* BIO */
.bio-content { min-height: 100px; display: flex; flex-direction: column; gap: 5px; }

/* PROJECTS */
.section-title { font-size: 1.2rem; margin-bottom: 1.5rem; color: #94a3b8; font-weight: 300; letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; display: inline-block; }
.projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.5rem; }

.project-card { background: rgba(30, 41, 59, 0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden; transition: 0.3s; cursor: pointer; }
.project-card:hover { transform: translateY(-5px); border-color: var(--aura); box-shadow: 0 10px 20px rgba(0,0,0,0.5); }
.card-thumb { height: 140px; background-size: cover; background-position: center; }
.card-info { padding: 1rem; }
.card-info h3 { margin: 0 0 0.5rem 0; font-size: 1rem; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.preview-tags { display: flex; gap: 5px; margin-bottom: 10px; }
.tag { font-size: 0.7rem; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; color: #94a3b8; }
.card-meta { display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b; }

@media (max-width: 768px) {
  .header-content { flex-direction: column; align-items: center; text-align: center; }
  .identity-col { flex-direction: column; }
  .actions-col { align-items: center; width: 100%; }
}

.badges-section {
  margin-bottom: 1rem;
}

.badge-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.badge-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 15px;
  width: 140px;
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s;
}

.badge-card:hover {
  transform: translateY(-5px) scale(1.05);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(245, 158, 11, 0.2);
  border-color: rgba(245, 158, 11, 0.4);
}

.badge-img-wrapper {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 10px;
  background: transparent;
  box-shadow: 0 4px 10px rgba(0,0,0,0.3); 
}

.badge-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated; 
}

.badge-name {
  color: #fbbf24;
  font-size: 1.1rem;
  text-align: center;
  line-height: 1.2;
  text-shadow: 0 2px 4px rgba(0,0,0,0.8);
}

.remove-badge-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ef4444;
  color: white;
  border: 2px solid #0f172a;
  font-weight: bold;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: transform 0.2s, background 0.2s;
}

.remove-badge-btn:hover {
  transform: scale(1.2);
  background: #dc2626;
}

.lightbox { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.badge-modal {
  position: relative;
  width: 90%;
  max-width: 400px;
  padding: 3rem 2rem 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: rgba(15, 23, 42, 0.85);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  transform: translateY(0);
  animation: modalFloat 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes modalFloat {
  0% { transform: translateY(30px) scale(0.95); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}

.close-modal-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  background: rgba(255,255,255,0.05);
  border: none;
  color: #94a3b8;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  transition: 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.close-modal-btn:hover { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }

.modal-badge-img-wrapper {
  width: 180px;  
  height: 180px; 
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-badge-img { 
  width: 100%; 
  height: 100%; 
  object-fit: contain; 
  image-rendering: pixelated; 
  filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.6)); 
}
.modal-badge-name {
  font-size: 1.8rem;
  color: #fbbf24;
  margin: 0 0 2rem 0;
  text-shadow: 0 2px 10px rgba(245, 158, 11, 0.3);
  line-height: 1.2;
}

.modal-badge-origins {
  width: 100%;
  border-top: 1px solid rgba(255,255,255,0.05);
  padding-top: 1.5rem;
}

.origin-spinner { width: 24px; height: 24px; margin: 0 auto; border-width: 2px; }

.origin-content { display: flex; flex-direction: column; gap: 8px; }
.origin-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-top: 8px; }
.origin-link { 
  font-size: 1.1rem; 
  font-weight: 600; 
  color: #e2e8f0; 
  cursor: pointer; 
  text-decoration: none; 
  transition: all 0.2s ease; 
}
.game-link { color: var(--aura); text-shadow: 0 0 10px rgba(0,0,0, 0.2); }
.game-link:hover { filter: brightness(1.3); text-shadow: 0 0 15px var(--aura); transform: translateY(-1px); }

.artist-link { color: #a855f7; }
.artist-link:hover { color: #c084fc; text-shadow: 0 0 15px rgba(168, 85, 247, 0.4); transform: translateY(-1px); }

.origin-lost { font-style: italic; color: #64748b; font-size: 0.9rem; }

/* --- PFP MODAL STYLES --- */
.pfp-wrapper {
  cursor: pointer;
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s;
}

.pfp-wrapper:hover {
  transform: scale(1.05);
  box-shadow: 0 15px 35px var(--aura);
}

.modal-pfp-img-wrapper {
  width: 160px;
  height: 160px;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-pfp-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%; 
  border: 3px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6);
  image-rendering: pixelated;
}
.auth-btn {
  padding: 14px;
  border-radius: 12px;
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
  width: 100%;
}

.register-main {
  background: var(--aura);
  color: #fff;
  border: none;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.login-link {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.auth-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}
</style>