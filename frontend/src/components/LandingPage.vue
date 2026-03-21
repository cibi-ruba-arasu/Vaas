<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// Routing & Transition States
const isTransitioning = ref(false)
const activePath = ref('')

// Reactive references for the generated star fields
const starsSmall = ref('')
const starsMedium = ref('')
const starsLarge = ref('')

// Mouse tracking coordinates
const mouseX = ref(0)
const mouseY = ref(0)

// Function to generate the CSS box-shadow string for our stars
const generateStars = (count, blur) => {
  let shadows = []
  for (let i = 0; i < count; i++) {
    const x = (Math.random() * 110 - 5).toFixed(2)
    const y = (Math.random() * 210 - 5).toFixed(2)
    shadows.push(`${x}vw ${y}vh ${blur}px #FFF`)
  }
  return shadows.join(', ')
}

const handleMouseMove = (e) => {
  mouseX.value = (e.clientX - window.innerWidth / 2) * -0.01
  mouseY.value = (e.clientY - window.innerHeight / 2) * -0.01
}

// Triggers the synchronized fade-out animation before routing
const handleNavigate = (path) => {
  activePath.value = path
  isTransitioning.value = true
  
  // Faster 800ms timeout since we are only fading text now
  setTimeout(() => {
    router.push(path)
  }, 800)
}

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove)
  
  starsSmall.value = generateStars(400, 0)   
  starsMedium.value = generateStars(150, 1)  
  starsLarge.value = generateStars(50, 2)    
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
})
</script>

<template>
  <div class="container" :style="{ '--mouse-x': mouseX + 'px', '--mouse-y': mouseY + 'px' }">
    
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

    <div class="halo-glow"></div>

    <div class="top-text" :class="{ 'fade-out-fast': isTransitioning }">
      <span class="fade concept one-tool" style="--delay: 0.5s;">One Tool</span>
      <span class="fade dot" style="--delay: 1.5s;">•</span>
      <span class="fade concept zero-code" style="--delay: 1.5s;">Zero Code</span>
      <span class="fade dot" style="--delay: 2.5s;">•</span>
      <span class="fade concept" style="--delay: 2.5s;">
        <span class="infinite-paths">Infinite Paths</span>
      </span>
    </div>

    <!-- Circles remain completely untouched by the transition state -->
    <div class="circles-wrapper">
      <div v-for="i in 21" :key="i" class="circle" :style="{ '--i': i - 1 }"></div>
    </div>

    <div class="bottom-section">
      
      <div class="pitch-text fade" style="--delay: 3.0s;" :class="{ 'fade-out-fast': isTransitioning }">
        <p>
          Loom-art.space is a no-code platform where you use <span class="highlight">The Weaver</span> to weave through the fabric of space-time, build interactive fiction, and share it on <span class="highlight">The Loom</span>—so go ahead, loom over your choices and have fun.
        </p>
      </div>

      <div class="actions">
        <!-- Buttons check if they are the active path. If not, they fade out. -->
        <button 
          class="btn" 
          :class="{ 
            'fade-out-fast': isTransitioning && activePath !== '/register',
            'active-btn': isTransitioning && activePath === '/register'
          }" 
          @click="handleNavigate('/register')"
        >Register</button>
        
        <button 
          class="btn" 
          :class="{ 
            'fade-out-fast': isTransitioning && activePath !== '/login',
            'active-btn': isTransitioning && activePath === '/login'
          }" 
          @click="handleNavigate('/login')"
        >Log in</button>
        
        <button 
          class="btn guest" 
          :class="{ 'fade-out-fast': isTransitioning }" 
          disabled
        >Visit as guest</button>
      </div>

      <p class="welcome" :class="{ 'fade-out-fast': isTransitioning }">
        Welcome to <span class="loom">Loom</span><span class="art">Art</span>
      </p>
    </div>

  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700;800&family=JetBrains+Mono:wght@700&display=swap');

:global(body), :global(html) {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background-color: #030305; 
  overflow: hidden; 
  font-family: 'Inter', sans-serif; 
}

.container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vh;
  perspective: 1000px;
  position: relative;
}

/* --- TRANSITION CLASSES --- */
.fade-out-fast {
  opacity: 0 !important;
  transition: opacity 0.5s ease-in-out !important;
  pointer-events: none;
}

.active-btn {
  border-color: #00d2ff !important;
  color: #fff !important;
  background: rgba(0, 210, 255, 0.15) !important;
  box-shadow: 0 0 30px rgba(0, 210, 255, 0.5) !important;
  transform: scale(1.05) !important;
  transition: all 0.5s ease-out !important;
}

/* --- NIGHT SKY EFFECT --- */
.sky-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
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

.layer-1 {
  width: 1.5px;
  height: 1.5px;
  animation: drift 150s linear infinite; 
}

.layer-2 {
  width: 2.5px;
  height: 2.5px;
  animation: drift 100s linear infinite, twinkle 6s ease-in-out infinite alternate;
}

.layer-3 {
  width: 3.5px;
  height: 3.5px;
  animation: drift 50s linear infinite, twinkle 4s ease-in-out infinite alternate;
}

@keyframes drift {
  from { transform: translateY(0); }
  to { transform: translateY(-200vh); }
}

@keyframes twinkle {
  0% { opacity: 0.2; }
  100% { opacity: 1; }
}

/* --- HALO GLOW EFFECT --- */
.halo-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60vmin;
  height: 60vmin;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(0, 210, 255, 0.05) 40%, transparent 70%);
  filter: blur(40px);
  z-index: 1; 
  animation: pulse-glow 6s ease-in-out infinite alternate;
}

@keyframes pulse-glow {
  0% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.6; }
  100% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
}

/* --- TEXT OVERLAYS --- */
.top-text {
  position: absolute;
  top: 15%;
  width: 100%;
  text-align: center;
  z-index: 10; 
  font-size: clamp(1.2rem, 3vw, 2rem);
  letter-spacing: 2px;
  text-shadow: 0 10px 20px rgba(0, 0, 0, 0.9); 
  transition: opacity 0.5s ease;
}

.fade {
  opacity: 0;
  display: inline-block;
  margin: 0 10px;
  animation: fadeUp 1s ease forwards calc(var(--delay)); 
  vertical-align: middle;
}

.fade.dot {
  color: #00d2ff; 
  font-weight: 300;
  text-shadow: 0 0 10px rgba(0, 210, 255, 0.5);
}

@keyframes fadeUp {
  0% { opacity: 0; transform: translateY(15px); }
  100% { opacity: 1; transform: translateY(0); }
}

.one-tool {
  font-weight: 800;
  color: #fff;
  text-shadow: 0 0 15px rgba(255, 255, 255, 0.4);
}

.zero-code {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-weight: 700;
  color: transparent; 
  -webkit-text-stroke: 1.5px #94a3b8; 
}

.infinite-paths {
  display: inline-block;
  font-weight: 700;
  font-style: italic;
  letter-spacing: 6px; 
  background: linear-gradient(
    120deg, 
    #475569 35%, 
    #ffffff 45%, 
    #00d2ff 50%, 
    #ffffff 55%, 
    #475569 65%
  );
  background-size: 300% 100%;
  -webkit-background-clip: text;
  color: transparent; 
  animation: shine 3s ease-in-out infinite; 
}

@keyframes shine {
  0% { background-position: 150% 0; }
  100% { background-position: -50% 0; }
}

/* --- BOTTOM SECTION --- */
.bottom-section {
  position: absolute;
  bottom: 8%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  z-index: 10;
  padding: 0 20px;
  box-sizing: border-box;
}

.pitch-text {
  max-width: 600px;
  text-align: center;
  color: #94a3b8;
  font-size: 0.95rem;
  line-height: 1.6;
  font-weight: 400;
  margin-bottom: 0.5rem;
  text-shadow: 0 5px 15px rgba(0, 0, 0, 0.9);
}

.pitch-text p {
  margin: 0;
}

.highlight {
  color: #00d2ff;
  font-weight: 600;
  text-shadow: 0 0 8px rgba(0, 210, 255, 0.3);
}

.actions {
  display: flex;
  gap: 1rem;
  opacity: 0;
  animation: fadeUp 1s ease forwards 3.5s; 
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
  max-width: 600px;
}

.btn {
  background: transparent;
  border: 1px solid #334155;
  color: #cbd5e1;
  padding: 0.6rem 1.5rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.85rem;
  font-weight: 500;
  letter-spacing: 1px;
  text-transform: uppercase;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
  text-align: center;
}

.btn:hover:not(:disabled) {
  border-color: #00d2ff;
  color: #fff;
  background: rgba(0, 210, 255, 0.08);
  box-shadow: 0 0 15px rgba(0, 210, 255, 0.3);
  transform: translateY(-2px);
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  border-color: #1e293b;
}

.welcome {
  color: #94a3b8; 
  font-size: clamp(0.9rem, 2vw, 1.2rem);
  font-weight: 300;
  letter-spacing: 1px;
  margin: 0;
  opacity: 0; 
  animation: fadeUp 1s ease forwards 3.8s; 
  text-shadow: 0 5px 15px rgba(0, 0, 0, 0.9);
  text-align: center;
  transition: opacity 0.5s ease;
}

.loom {
  font-weight: 700;
  color: #fff;
  margin-left: 8px;
}

.art {
  font-weight: 300;
  color: #00d2ff; 
  text-shadow: 0 0 10px rgba(0, 210, 255, 0.4);
}

/* --- CIRCLE ANIMATION --- */
.circles-wrapper {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  transform-style: preserve-3d;
  z-index: 5; 
}

.circle {
  position: absolute;
  background: transparent;
  width: calc(var(--i) * 4vmin); 
  aspect-ratio: 1;
  border-radius: 50%;
  border: 3px solid #3b82f6; 
  transform-style: preserve-3d;
  transform: rotateX(70deg) translateZ(50px);
  animation: animate 3s ease-in-out calc(var(--i) * 0.08s) infinite;
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.5), inset 0 0 15px rgba(0, 0, 0, 0.5);
}

@keyframes animate {
  0%, 100% {
    transform: rotateX(70deg) translateZ(50px) translateY(0);
    filter: hue-rotate(0);
  }
  50% {
    transform: rotateX(70deg) translateZ(50px) translateY(-50vmin);
    filter: hue-rotate(90deg);
  }
}

/* --- RESPONSIVE DESIGN FOR MOBILES --- */
@media (max-width: 600px) {
  .pitch-text {
    font-size: 0.85rem;
    padding: 0 10px;
  }

  .actions {
    flex-direction: column;
    align-items: stretch;
    width: 80%;
    max-width: 300px;
    gap: 0.8rem;
  }
  
  .btn {
    width: 100%;
    padding: 0.8rem 1.5rem; 
  }
}
</style>