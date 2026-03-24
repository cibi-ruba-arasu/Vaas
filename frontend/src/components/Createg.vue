<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from "vue"
import { useRouter } from "vue-router"

const router = useRouter()
const auraColor = ref("#0077ff") // Default LoomArt blue

// --- STAR BACKGROUND LOGIC (Consistent with your Guest Pages) ---
const starsSmall = ref('')
const starsMedium = ref('')
const starsLarge = ref('')
const mouseX = ref(0)
const mouseY = ref(0)

const generateStars = (count, blur) => {
  let shadows = []
  for (let i = 0; i < count; i++) {
    const x = (Math.random() * 110 - 5).toFixed(2)
    const y = (Math.random() * 210 - 5).toFixed(2)
    const color = Math.random() > 0.2 ? auraColor.value : '#FFF'
    shadows.push(`${x}vw ${y}vh ${blur}px ${color}`)
  }
  return shadows.join(', ')
}

const updateStarFields = () => {
  starsSmall.value = generateStars(400, 0)
  starsMedium.value = generateStars(150, 1)
  starsLarge.value = generateStars(50, 2)
}

const handleMouseMove = (e) => {
  mouseX.value = (e.clientX - window.innerWidth / 2) * -0.01
  mouseY.value = (e.clientY - window.innerHeight / 2) * -0.01
}

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove)
  updateStarFields()
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
})
</script>

<template>
  <div class="loom-container" :style="{ '--aura': auraColor, '--mouse-x': mouseX + 'px', '--mouse-y': mouseY + 'px' }">
    
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

    <main class="workshop-void">
      <div class="dev-card glass-panel">
        
        <div class="loom-loader">
          <div class="ring outer"></div>
          <div class="ring middle"></div>
          <div class="ring inner"></div>
          <div class="core-spark"></div>
        </div>

        <div class="text-content">
          <h1 class="title">The Weaver's <span class="highlight">Workshop</span></h1>
          <div class="status-badge">Under Construction</div>
          
          <p class="description">
            The <strong>Weaver</strong> is currently being forged in the cosmic fires. 
            Soon, you'll be able to create branching paths and mystical narratives in this limited guest workshop.
          </p>

          <div class="info-grid">
            <div class="info-item">
              <span class="icon">✨</span>
              <p>Easy-to-use visual editor</p>
            </div>
            <div class="info-item">
              <span class="icon">🆓</span>
              <p>100% Free & Open Source</p>
            </div>
          </div>

          <p class="cta-text">Ready to weave your own interactive fiction?</p>
          
          <div class="action-buttons">
            <button class="btn primary" @click="router.push('/register')">Join the Loom</button>
            <button class="btn secondary" @click="router.push('/homeg')">Keep Exploring</button>
          </div>
        </div>

      </div>
    </main>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@300;400;600&display=swap');

.loom-container {
  min-height: 100vh;
  background-color: #050508;
  color: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

/* --- STAR BACKGROUND (Matched to your app) --- */
.sky-container {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
.parallax-wrap {
  position: absolute;
  inset: 0;
  transition: transform 0.1s ease-out;
}
.p-1 { transform: translate(calc(var(--mouse-x) * 0.5), calc(var(--mouse-y) * 0.5)); }
.p-2 { transform: translate(calc(var(--mouse-x) * 1.5), calc(var(--mouse-y) * 1.5)); }
.p-3 { transform: translate(calc(var(--mouse-x) * 3.0), calc(var(--mouse-y) * 3.0)); }

.star-layer { position: absolute; inset: 0; background: transparent; border-radius: 50%; }
.layer-1 { width: 1.5px; height: 1.5px; animation: drift 150s linear infinite; }
.layer-2 { width: 2.5px; height: 2.5px; animation: drift 100s linear infinite, twinkle 6s ease-in-out infinite alternate; }
.layer-3 { width: 3.5px; height: 3.5px; animation: drift 50s linear infinite, twinkle 4s ease-in-out infinite alternate; }

@keyframes drift { from { transform: translateY(0); } to { transform: translateY(-200vh); } }
@keyframes twinkle { 0% { opacity: 0.2; } 100% { opacity: 1; } }

/* --- MAIN CARD --- */
.workshop-void {
  position: relative;
  z-index: 10;
  padding: 20px;
  width: 100%;
  max-width: 900px;
}

.glass-panel {
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 32px;
  padding: clamp(2rem, 5vw, 4rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 
              0 0 30px rgba(var(--aura), 0.1);
}

/* --- LOOM ANIMATION --- */
.loom-loader {
  position: relative;
  width: 180px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring {
  position: absolute;
  border: 2px solid transparent;
  border-radius: 50%;
  border-top-color: var(--aura);
  border-bottom-color: var(--aura);
}

.outer {
  width: 100%; height: 100%;
  animation: rotate 4s linear infinite;
  opacity: 0.3;
}

.middle {
  width: 70%; height: 70%;
  border-left-color: #fff;
  border-right-color: #fff;
  animation: rotate-reverse 3s linear infinite;
  opacity: 0.6;
}

.inner {
  width: 40%; height: 40%;
  animation: rotate 2s linear infinite;
}

.core-spark {
  width: 15px; height: 15px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 0 20px 5px var(--aura), 0 0 40px 10px white;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes rotate-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
@keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.5); opacity: 1; } }

/* --- TEXT STYLES --- */
.text-content {
  text-align: center;
  max-width: 600px;
}

.title {
  font-family: 'Cinzel', serif;
  font-size: clamp(1.8rem, 5vw, 3rem);
  margin-bottom: 0.5rem;
  letter-spacing: 2px;
}

.highlight { color: var(--aura); text-shadow: 0 0 20px var(--aura); }

.status-badge {
  display: inline-block;
  background: rgba(var(--aura), 0.1);
  border: 1px solid var(--aura);
  padding: 4px 16px;
  border-radius: 50px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--aura);
  margin-bottom: 2rem;
}

.description {
  font-family: 'Inter', sans-serif;
  font-weight: 300;
  line-height: 1.6;
  color: #cbd5e1;
  margin-bottom: 2rem;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 2.5rem;
}

.info-item {
  background: rgba(255, 255, 255, 0.03);
  padding: 15px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.info-item .icon { font-size: 1.5rem; display: block; margin-bottom: 8px; }
.info-item p { font-size: 0.85rem; color: #94a3b8; margin: 0; }

.cta-text { font-weight: 600; margin-bottom: 1.5rem; color: #fff; }

.action-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  padding: 14px 32px;
  border-radius: 50px;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 1rem;
}

.primary {
  background: var(--aura);
  color: white;
  border: none;
  box-shadow: 0 10px 20px rgba(var(--aura), 0.3);
}

.primary:hover {
  transform: translateY(-3px);
  box-shadow: 0 15px 30px rgba(var(--aura), 0.5);
  filter: brightness(1.2);
}

.secondary {
  background: rgba(255, 255, 255, 0.05);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

/* --- RESPONSIVE ADJUSTMENTS --- */
@media (max-width: 600px) {
  .info-grid { grid-template-columns: 1fr; }
  .action-buttons { flex-direction: column; width: 100%; }
  .btn { width: 100%; }
  .glass-panel { padding: 2rem 1.5rem; }
}

/* Tablet Landscape */
@media (min-width: 601px) and (max-width: 1024px) and (orientation: landscape) {
  .glass-panel {
    flex-direction: row;
    text-align: left;
  }
  .text-content { text-align: left; }
  .action-buttons { justify-content: flex-start; }
}
</style>