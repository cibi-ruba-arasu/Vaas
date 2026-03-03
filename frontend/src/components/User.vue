<script setup>
import { ref, onMounted, computed, watch } from "vue"
import { useRoute, useRouter } from "vue-router"

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
  stats: { followers: 0, following: 0, rating: 0.0, weaves: 0 },
  badges: []
})

const projects = ref([])

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
    const res = await fetch(`http://localhost:5000/users/${route.params.userid}`, {
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
  if (isActionLoading.value) return;
  isActionLoading.value = true;

  // 1. Optimistic Update (Immediate UI feedback)
  const previousState = isFollowing.value;
  isFollowing.value = !previousState;
  user.value.stats.followers += (isFollowing.value ? 1 : -1);

  try {
    const res = await fetch(`http://localhost:5000/user/follow/${user.value._id}`, {
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

onMounted(() => {
  if (route.params.userid) fetchUserProfile()
})

// Refetch if route changes (e.g. searching another user)
watch(() => route.params.userid, () => {
    fetchUserProfile();
});

watch(() => user.value, (newVal) => {
   if (newVal.badges) newVal.badges.forEach(b => loadGoogleFont(b.giftFont));
}, { deep: true, immediate: true });
</script>

<template>
  <div class="public-profile-page">
    <div class="bg-orb"></div>

    <div v-if="loading" class="center-msg"><div class="spinner"></div></div>
    
    <div v-else-if="error" class="center-msg">
      <h2>⚠️</h2>
      <p>{{ error }}</p>
      <button @click="router.push('/home')" class="back-btn">Return Home</button>
    </div>

    <div v-else class="profile-container">
      
      <div class="profile-header glass-panel">
        <div class="header-content">
          
          <div class="identity-col">
            <div class="pfp-wrapper">
               <img v-if="user.profilePic" :src="user.profilePic" class="pfp-img" />
               <div v-else class="pfp-placeholder">{{ user.username.charAt(0) }}</div>
            </div>
            
            <div class="names-wrapper">
              <div class="name-row">
                <h1 class="username">{{ user.username }}</h1>
                <span v-if="user.verified === 'verified'" class="badge blue">✔</span>
                <span v-if="user.verified === 'chosen'" class="badge gold">★</span>
              </div>
              <span class="userid">@{{ user.userid }}</span>
              
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
          <div v-for="(badge, index) in user.badges" :key="index" class="badge-card">
            <div class="badge-img-wrapper">
              <img :src="badge.base64" alt="Badge" class="badge-img" />
            </div>
            <span class="badge-name" :style="{ fontFamily: badge.giftFont || 'sans-serif' }">
              {{ badge.giftName }}
            </span>
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
                 <h3>{{ pub.name }}</h3>
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
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;600&display=swap');

* { box-sizing: border-box; }

.public-profile-page { min-height: 100vh; background-color: #020617; color: #f0f0f0; font-family: 'Inter', sans-serif; position: relative; padding-bottom: 5rem; }
.bg-orb { position: absolute; top: -10%; right: -10%; width: 50vw; height: 50vw; background: radial-gradient(circle, #3b82f6 0%, transparent 70%); opacity: 0.15; filter: blur(80px); pointer-events: none; }

.center-msg { height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #64748b; gap: 1rem; }
.spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
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
  background: #3b82f6; color: white; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
}
.follow-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5); }
.follow-btn.following { background: rgba(255,255,255,0.1); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.2); box-shadow: none; }
.follow-btn.following:hover { background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.4); color: #fca5a5; content: "Unfollow"; }

/* BIO */
.bio-content { min-height: 100px; display: flex; flex-direction: column; gap: 5px; }

/* PROJECTS */
.section-title { font-size: 1.2rem; margin-bottom: 1.5rem; color: #94a3b8; font-weight: 300; letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; display: inline-block; }
.projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.5rem; }

.project-card { background: rgba(30, 41, 59, 0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden; transition: 0.3s; cursor: pointer; }
.project-card:hover { transform: translateY(-5px); border-color: rgba(59, 130, 246, 0.3); }
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
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
  background: #000;
}

.badge-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated; /* Keeps 8-bit art sharp */
}

.badge-name {
  color: #fbbf24;
  font-size: 1.1rem;
  text-align: center;
  line-height: 1.2;
  text-shadow: 0 2px 4px rgba(0,0,0,0.8);
}

/* Remove Button for Edit Mode (Only applies in UserProfile.vue) */
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
</style>