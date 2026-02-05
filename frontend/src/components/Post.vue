<script setup>
import { ref, onMounted, computed } from "vue"
import { useRoute, useRouter } from "vue-router"

const route = useRoute()
const router = useRouter()
const postId = route.params.id
// Decode token simply to get ID for UI logic (Verification happens on backend)
const token = sessionStorage.getItem("token")
let currentUserId = null

if (token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    currentUserId = payload.mongoId
  } catch (e) { console.error("Token decode failed") }
}

const post = ref(null)
const loading = ref(true)
const error = ref(null)
const showLightbox = ref(false)

/* --- HELPER: Gradient Generator --- */
const getGradient = (colors, angle) => {
  if (!colors || colors.length === 0) return 'transparent';
  if (colors.length === 1) return colors[0];
  return `linear-gradient(${angle}deg, ${colors.join(', ')})`;
};

const formatDate = (date) => {
  if (!date) return 'Unknown Date';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}

const isAuthor = computed(() => {
  return post.value && currentUserId === post.value.authorId
})

/* --- COMPUTED: Description Box Container Style --- */
const descContainerStyle = computed(() => {
  if (!post.value) return {};
  
  // Check if we have the 'container' object (New Format from Editor)
  // Your DB example shows 'description' is an Array, so we might need to handle that.
  // If the DB object is just an Array, it implies no container style was saved, 
  // or the schema flattened it. 
  
  // However, if your previous "Publish.js" update worked, future posts will have 
  // { container: {...}, blocks: [...] }. 
  
  // For the specific example you gave: 
  // "description": [ {id:1, ...}, {id:2, ...} ] -> This is an Array.
  // This means the container style is missing from this specific document.
  
  // Logic: If description is an Object with 'container', use it. Else default.
  if (post.value.description && !Array.isArray(post.value.description) && post.value.description.container) {
      const c = post.value.description.container;
      return {
          background: getGradient(c.colors, c.angle),
          padding: '40px',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.1)'
      };
  }

  // Default Glassmorphism if no custom container style found
  return {
    background: 'rgba(15, 23, 42, 0.3)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '16px',
    padding: '40px'
  };
});

/* --- COMPUTED: Get Blocks Array --- */
const descriptionBlocks = computed(() => {
    if (!post.value) return [];
    if (Array.isArray(post.value.description)) return post.value.description;
    if (post.value.description && post.value.description.blocks) return post.value.description.blocks;
    return [];
});

const fetchPost = async () => {
  try {
    const res = await fetch(`http://localhost:5000/posts/${postId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (res.ok) {
      const data = await res.json()
      // Handle both nested { post: ... } and flat response
      post.value = data.post || data 
      
      // Merge separate stats object if present
      if (data.stats) {
          post.value.views = data.stats.views
          post.value.visits = data.stats.visits
          post.value.plays = data.stats.plays
      }
    } else {
      error.value = "The scroll you seek has crumbled to dust."
    }
  } catch (e) {
    console.error(e)
    error.value = "Connection to the Archive severed."
  } finally {
    loading.value = false
  }
}

const handlePlay = async () => {
  if (isAuthor.value) {
    alert("Creators cannot play their own published instance for stats. Use Preview in Create mode.")
    return
  }

  try {
    await fetch(`http://localhost:5000/posts/${postId}/play`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    })
    if(post.value.plays !== undefined) post.value.plays++
  } catch (e) { console.error("Play tracking failed") }

  if (post.value.monetization.isPaid) {
    alert("Payment Gateway initializing...")
  } else {
    alert("Entering the Loom... (Game Engine Loading)")
  }
}

onMounted(() => {
  fetchPost()
})
</script>

<template>
  <div class="post-page">
    
    <Transition name="fade">
      <div v-if="showLightbox && post" class="lightbox" @click="showLightbox = false">
        <img :src="post.thumbnail" class="lightbox-img" />
        <p class="lightbox-hint">Click anywhere to close</p>
      </div>
    </Transition>

    <div v-if="loading" class="center-msg">
      <div class="spinner"></div>
      <p>Unrolling the scroll...</p>
    </div>
    
    <div v-else-if="error" class="center-msg error">
      <h2>⚠️</h2>
      <p>{{ error }}</p>
      <button @click="router.back()" class="back-btn">Return</button>
    </div>

    <div v-else-if="post" class="post-container">
      
      <div class="hero-section">
        <div class="backdrop" :style="{ backgroundImage: `url(${post.thumbnail})` }"></div>
        
        <div class="hero-content">
          <button @click="router.back()" class="nav-back">← Back</button>
          
          <div class="thumb-wrapper" @click="showLightbox = true">
            <img :src="post.thumbnail || '/placeholder.jpg'" alt="Cover" class="hero-thumb" />
            <div class="zoom-hint">🔍</div>
          </div>
          
          <div class="hero-meta">
            <h1 class="post-title" :style="{ fontFamily: post.titleFont || 'Cinzel' }">{{ post.name }}</h1>
            
            <div class="author-row">
              <span class="by">woven by</span>
              <span class="author-name" @click="router.push(`/user/${post.authorId}`)">{{ post.authorName }}</span>
              <span class="date">• {{ formatDate(post.publishedAt) }}</span>
            </div>
            
            <div class="stats-row">
              <div class="stat-badge" title="Unique Players">
                <span class="icon">🎮</span>
                <span class="count">{{ post.plays || 0 }}</span>
                <span class="label">Plays</span>
              </div>
              <div class="stat-badge" title="Unique Viewers">
                <span class="icon">👁️</span>
                <span class="count">{{ post.views || 0 }}</span>
                <span class="label">Views</span>
              </div>
              <div class="stat-badge" title="Total Page Loads">
                <span class="icon">🔄</span>
                <span class="count">{{ post.visits || 0 }}</span>
                <span class="label">Visits</span>
              </div>
              <div class="stat-badge" title="Likes">
                <span class="icon">❤️</span>
                <span class="count">{{ post.likes || 0 }}</span>
                <span class="label">Likes</span>
              </div>
              <span class="lang-badge">{{ post.language ? post.language.toUpperCase() : 'EN' }}</span>
            </div>

            <div class="tags-inline">
              <span v-for="cat in post.categories" :key="cat" class="chip category">{{ cat }}</span>
              <span v-for="cat in post.customCategories" :key="cat" class="chip custom">{{ cat }}</span>
              <span v-for="warn in post.warnings" :key="warn" class="chip warning">⚠️ {{ warn }}</span>
            </div>

          </div>
        </div>
      </div>

      <div class="action-bar">
        <div class="price-info">
          <h3 :class="{ 'free': !post.monetization.isPaid, 'premium': post.monetization.isPaid }">
            {{ post.monetization.isPaid ? 'Premium Experience' : 'Free to Play' }}
          </h3>
          <span v-if="post.monetization.isPaid && post.monetization.hasDemo" class="demo-tag">
            Free Demo Available
          </span>
        </div>

        <button v-if="isAuthor" class="action-btn update" @click="router.push(`/update/${post.projectId}`)">
          <span class="icon">✎</span>
          <span class="text">Update Project</span>
        </button>

        <button v-else class="action-btn play" @click="handlePlay">
          <span class="icon">▶</span>
          <span class="text">{{ post.monetization.isPaid ? 'Purchase Access' : 'Enter World' }}</span>
        </button>
      </div>

      <div class="description-box">
        <div class="desc-content" :style="descContainerStyle">
          
          <div v-if="descriptionBlocks.length > 0">
            <div 
              v-for="block in descriptionBlocks" 
              :key="block.id" 
              class="desc-block"
              :style="{
                textAlign: block.align,
                
                /* BLOCK BACKGROUND GRADIENT */
                background: block.bgColors ? getGradient(block.bgColors, block.bgAngle) : 'transparent',
                
                fontFamily: block.fontFamily,
                fontSize: block.fontSize + 'px',
                fontWeight: block.isBold ? 'bold' : 'normal',
                fontStyle: block.isItalic ? 'italic' : 'normal',
                padding: '5px',
                borderRadius: '4px'
              }"
            >
              <img v-if="block.type === 'gif' || block.type === 'image'" :src="block.content" class="block-img" />
              
              <span 
                v-else
                :style="{
                    /* TEXT COLOR GRADIENT LOGIC */
                    color: block.textColors && block.textColors.length === 1 ? block.textColors[0] : 'transparent',
                    backgroundImage: block.textColors && block.textColors.length > 1 ? getGradient(block.textColors, block.textAngle) : 'none',
                    webkitBackgroundClip: block.textColors && block.textColors.length > 1 ? 'text' : 'unset',
                    backgroundClip: block.textColors && block.textColors.length > 1 ? 'text' : 'unset',
                    
                    /* Ensure text fill is transparent ONLY if gradient exists */
                    webkitTextFillColor: block.textColors && block.textColors.length > 1 ? 'transparent' : 'unset'
                }"
              >{{ block.content }}</span>
            </div>
          </div>
          
          <p v-else-if="typeof post.description === 'string'" class="simple-desc">
            {{ post.description }}
          </p>
          
          <p v-else class="simple-desc">No description provided.</p>
        </div>
      </div>

      <div class="comments-section">
        <h3>Echoes from the Void (Comments)</h3>
        <div class="comment-input-area">
          <textarea placeholder="Leave a whisper..."></textarea>
          <button disabled>Post</button>
        </div>
        <div class="empty-comments">
          <p>No echoes yet. Be the first to speak.</p>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;600&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');

* { box-sizing: border-box; }

.post-page { min-height: 100vh; background-color: #020617; color: #f0f0f0; font-family: 'Inter', sans-serif; overflow-x: hidden; }

/* LOADING */
.center-msg { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #64748b; gap: 1rem; }
.spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* LIGHTBOX */
.lightbox { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.95); display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: zoom-out; }
.lightbox-img { max-width: 95%; max-height: 90vh; border-radius: 4px; box-shadow: 0 0 50px rgba(0,0,0,0.5); }
.lightbox-hint { color: #64748b; margin-top: 10px; font-size: 0.8rem; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* HERO */
.hero-section { position: relative; min-height: 500px; display: flex; align-items: flex-end; padding: 3rem 5%; overflow: hidden; }
.backdrop { position: absolute; inset: 0; background-size: cover; background-position: center; filter: blur(30px) brightness(0.3); transform: scale(1.1); z-index: 0; }
.backdrop::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(2,6,23,0.1), #020617); }

.hero-content { position: relative; z-index: 2; width: 100%; max-width: 1400px; margin: 0 auto; display: flex; gap: 3rem; align-items: flex-end; }

.thumb-wrapper { 
  width: 260px; height: 380px; flex-shrink: 0; position: relative; 
  border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); 
  background: rgba(0,0,0,0.3); box-shadow: 0 20px 50px rgba(0,0,0,0.5); 
  cursor: zoom-in; transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.thumb-wrapper:hover { transform: scale(1.03) translateY(-5px); box-shadow: 0 25px 60px rgba(0,0,0,0.6); z-index: 5; }
.hero-thumb { width: 100%; height: 100%; object-fit: contain; background: black; }
.zoom-hint { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; opacity: 0; transition: 0.2s; }
.thumb-wrapper:hover .zoom-hint { opacity: 1; }

.hero-meta { flex: 1; padding-bottom: 10px; }
.nav-back { position: absolute; top: -3rem; left: 0; background: rgba(255,255,255,0.05); border: none; color: #cbd5e1; padding: 8px 16px; border-radius: 20px; cursor: pointer; backdrop-filter: blur(5px); transition: 0.2s; }
.nav-back:hover { background: rgba(255,255,255,0.15); color: white; }

.post-title { font-size: clamp(2.5rem, 5vw, 4.5rem); margin: 0 0 10px 0; line-height: 1.1; text-shadow: 0 2px 10px rgba(0,0,0,0.5); color: white; }
.author-row { font-size: 1.1rem; color: #94a3b8; display: flex; align-items: center; gap: 8px; margin-bottom: 1.5rem; }
.author-name { color: #e2e8f0; font-weight: 700; cursor: pointer; transition: 0.2s; border-bottom: 1px solid transparent; }
.author-name:hover { color: #3b82f6; border-color: #3b82f6; }

/* STATS ROW */
.stats-row { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 1.5rem; align-items: center; }
.stat-badge { display: flex; flex-direction: column; align-items: center; background: rgba(255,255,255,0.03); padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); min-width: 80px; }
.stat-badge .icon { font-size: 1.2rem; margin-bottom: 2px; }
.stat-badge .count { font-weight: 800; font-size: 1.1rem; color: white; }
.stat-badge .label { font-size: 0.65rem; text-transform: uppercase; color: #64748b; letter-spacing: 1px; }
.lang-badge { background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 4px; font-weight: 700; color: #fff; font-size: 0.8rem; align-self: center; }

/* TAGS INLINE */
.tags-inline { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; border: 1px solid transparent; font-weight: 500; }
.category { background: rgba(59, 130, 246, 0.15); color: #93c5fd; border-color: rgba(59, 130, 246, 0.3); }
.custom { background: rgba(168, 85, 247, 0.15); color: #d8b4fe; border-color: rgba(168, 85, 247, 0.3); }
.warning { background: rgba(239, 68, 68, 0.15); color: #fca5a5; border-color: rgba(239, 68, 68, 0.3); }

/* ACTION BAR */
.action-bar { background: rgba(15, 23, 42, 0.8); border-bottom: 1px solid rgba(255,255,255,0.05); padding: 1.5rem 5%; display: flex; justify-content: space-between; align-items: center; backdrop-filter: blur(20px); position: sticky; top: 0; z-index: 50; }
.price-info h3 { margin: 0; font-size: 1.3rem; font-weight: 600; }
.free { color: #86efac; text-shadow: 0 0 10px rgba(34, 197, 94, 0.3); }
.premium { color: #3b82f6; text-shadow: 0 0 10px rgba(59, 130, 246, 0.3); }
.demo-tag { font-size: 0.8rem; color: #94a3b8; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 4px; margin-left: 10px; border: 1px solid rgba(255,255,255,0.1); }

.action-btn { border: none; color: white; padding: 12px 35px; border-radius: 30px; font-weight: 700; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: transform 0.2s, box-shadow 0.2s; }
.action-btn:hover { transform: translateY(-2px); }
.play { background: linear-gradient(135deg, #3b82f6, #8b5cf6); box-shadow: 0 0 20px rgba(59, 130, 246, 0.4); }
.play:hover { box-shadow: 0 5px 30px rgba(59, 130, 246, 0.6); }
.update { background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 0 20px rgba(16, 185, 129, 0.4); }
.update:hover { box-shadow: 0 5px 30px rgba(16, 185, 129, 0.6); }

/* CONTENT */
.description-box { max-width: 1000px; margin: 0 auto 3rem; padding: 0 20px; }
.desc-content { min-height: 200px; margin-top: 3rem; }
.desc-block { margin-bottom: 10px; width: 100%; word-wrap: break-word; line-height: 1.6; }
.block-img { max-width: 100%; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
.simple-desc { color: #cbd5e1; line-height: 1.6; white-space: pre-wrap; font-size: 1.1rem; }

/* COMMENTS */
.comments-section { max-width: 800px; margin: 0 auto 5rem; padding: 0 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 3rem; }
.comments-section h3 { color: #94a3b8; font-weight: 300; letter-spacing: 1px; margin-bottom: 1.5rem; }
.comment-input-area { display: flex; flex-direction: column; gap: 10px; margin-bottom: 2rem; }
.comment-input-area textarea { width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 15px; color: white; min-height: 100px; resize: vertical; font-family: inherit; }
.comment-input-area button { align-self: flex-end; padding: 8px 24px; border-radius: 20px; background: #334155; color: #94a3b8; border: none; cursor: not-allowed; }
.empty-comments { text-align: center; padding: 2rem; color: #475569; font-style: italic; border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px; }

/* RESPONSIVE */
@media (max-width: 900px) {
  .hero-content { flex-direction: column; align-items: center; text-align: center; gap: 1.5rem; }
  .thumb-wrapper { width: 220px; height: 320px; }
  .nav-back { top: -4rem; left: 50%; transform: translateX(-50%); width: max-content; }
  .stats-row { justify-content: center; }
  .tags-inline { justify-content: center; }
  .action-bar { flex-direction: column; gap: 1rem; text-align: center; padding: 1rem; }
  .price-info { width: 100%; display: flex; flex-direction: column; align-items: center; }
  .action-btn { width: 100%; justify-content: center; }
}
</style>