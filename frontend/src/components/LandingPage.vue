<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// Routing & Transition States
const isTransitioning = ref(false)
const activePath = ref('')

// Scroll Reveal Observer
const observer = ref(null)

// Reactive references for the generated star fields
const starsSmall = ref('')
const starsMedium = ref('')
const starsLarge = ref('')

// Mouse tracking coordinates
const mouseX = ref(0)
const mouseY = ref(0)

// Custom Scrollbar States
const showScrollbar = ref(false)
const scrollProgress = ref(0)

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

// Tracks the user's scroll depth to move the custom scrollbar dot
const handleScroll = () => {
  const winScroll = window.scrollY
  const height = document.documentElement.scrollHeight - window.innerHeight
  if (height > 0) {
    scrollProgress.value = (winScroll / height) * 100
  }
}

// Triggers the synchronized fade-out animation before routing
const handleNavigate = (path) => {
  activePath.value = path
  isTransitioning.value = true
  
  setTimeout(() => {
    router.push(path)
  }, 800)
}

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('scroll', handleScroll)
  
  starsSmall.value = generateStars(400, 0)   
  starsMedium.value = generateStars(150, 1)  
  starsLarge.value = generateStars(50, 2)    

  // Reveal the custom scrollbar exactly after the Hero text finishes its intro animation
  setTimeout(() => {
    showScrollbar.value = true
  }, 4500)

  // Intersection Observer for scroll-reveal animations
  observer.value = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('manifest')
      }
    })
  }, {
    threshold: 0.15,
    rootMargin: "0px 0px -50px 0px"
  })

  // Observe all feature elements
  document.querySelectorAll('.dormant-element').forEach((el) => {
    observer.value.observe(el)
  })
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('scroll', handleScroll)
  if (observer.value) {
    observer.value.disconnect()
  }
})
</script>

<template>
  <div class="landing-wrapper" :style="{ '--mouse-x': mouseX + 'px', '--mouse-y': mouseY + 'px' }">
    
    <div class="custom-scrollbar" :class="{ 'is-visible': showScrollbar, 'fade-out-fast': isTransitioning }">
      <div class="scroll-track"></div>
      <div class="scroll-thumb" :style="{ top: `${scrollProgress}%` }"></div>
    </div>

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

    <div class="hero-container">

      <div class="halo-glow" :class="{ 'fade-out-fast': isTransitioning }"></div>

      <div class="top-text" :class="{ 'fade-out-fast': isTransitioning }">
        <span class="fade concept one-tool" style="--delay: 0.5s;">One Tool</span>
        <span class="fade dot" style="--delay: 1.5s;">•</span>
        <span class="fade concept zero-code" style="--delay: 1.5s;">Zero Code</span>
        <span class="fade dot" style="--delay: 2.5s;">•</span>
        <span class="fade concept" style="--delay: 2.5s;">
          <span class="infinite-paths">Infinite Paths</span>
        </span>
      </div>

      <div class="circles-wrapper">
        <div v-for="i in 21" :key="i" class="circle" 
             :class="{ 'ripple-out': isTransitioning }"
             :style="{ 
               '--i': i - 1,
               'animation-delay': isTransitioning ? `${(i - 1) * 0.05}s, ${(i - 1) * 0.08}s` : `${(i - 1) * 0.08}s`
             }">
        </div>
      </div>

      <div class="bottom-section">
        <div class="pitch-text fade" style="--delay: 3.0s;" :class="{ 'fade-out-fast': isTransitioning }">
          <p>
            Loom-art.space is a no-code platform where you use <span class="highlight">The Weaver</span> to weave through the fabric of space-time, build interactive fiction, and share it on <span class="highlight">The Loom</span>—so go ahead, loom over your choices and have fun.
          </p>
        </div>

        <div class="actions">
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
    <div class="features-wrapper">
      
      <section class="feature-section right-flow">
        <div class="feature-text dormant-element">
          <div class="glowing-tag">The Weaver</div>
          <h3>Manifest Without Syntax.</h3>
          <p>
            Your creativity shouldn't be trapped behind walls of code. Our organic node engine lets you drag, connect, and branch realities with a flick of the wrist. Logic flows like water.
          </p>
        </div>
        <div class="feature-visual dormant-element delay-1">
          <div class="living-glass">
            <img src="../assets/images/weaver-engine.png" alt="The Weaver Engine" class="vision-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div class="fallback-vision node-vision">
              <div class="f-node n-root">Genesis</div>
              <div class="f-path p1"></div>
              <div class="f-node n-branch1">Path A</div>
              <div class="f-path p2"></div>
              <div class="f-node n-branch2">Path B</div>
            </div>
          </div>
        </div>
      </section>

      <section class="feature-section left-flow">
        <div class="feature-visual dormant-element">
          <div class="living-glass">
            <img src="../assets/images/pixel-editor.png" alt="Pixel Artifacts" class="vision-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div class="fallback-vision pixel-vision">
              <div class="grid-matrix"></div>
            </div>
          </div>
        </div>
        <div class="feature-text dormant-element delay-1">
          <div class="glowing-tag">Digital Artifacts</div>
          <h3>Reward the Seekers.</h3>
          <p>
            Forge custom 64x64 pixel art relics right in the browser. When players navigate your mental labyrinths and discover secrets, reward them with badges and visual trophies that bind to their soul (profile).
          </p>
        </div>
      </section>

      <section class="feature-section right-flow">
        <div class="feature-text dormant-element">
          <div class="glowing-tag">The Loom</div>
          <h3>A Tapestry of Minds.</h3>
          <p>
            Not just an engine, but an ecosystem. Publish your creations into a flowing social feed where dreamers consume interactive stories instead of mindless videos. Grow a cult following, and monetize your deepest realms.
          </p>
        </div>
        <div class="feature-visual dormant-element delay-1">
          <div class="living-glass">
            <img src="../assets/images/the-loom.png" alt="The Loom Network" class="vision-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div class="fallback-vision social-vision">
              <div class="f-post p-top"></div>
              <div class="f-post p-bottom"></div>
            </div>
          </div>
        </div>
      </section>

      <section class="final-cta-section dormant-element">
        <h2 class="cta-title">Ready to weave your reality?</h2>
        
        <div class="actions bottom-actions">
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
      </section>

    </div>
    </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700;800&family=JetBrains+Mono:wght@700&display=swap');

/* ==============================================================
   Hiding Default Browser Scrollbars Completely (Nuclear Option)
============================================================== */
:global(*) {
  scrollbar-width: none !important; /* Firefox */
  -ms-overflow-style: none !important; /* IE and Edge */
}

:global(*::-webkit-scrollbar) {
  display: none !important; /* Chrome, Safari, Edge, Opera */
  width: 0 !important;
  height: 0 !important;
}

/* Master Wrapper allows scrolling */
.landing-wrapper {
  background-color: #030305;
  color: #e2e8f0;
  font-family: 'Inter', sans-serif;
  overflow-x: hidden;
  min-height: 100vh;
}

/* ==============================================================
   CUSTOM SCROLLBAR ("The Glowing Thread")
============================================================== */
.custom-scrollbar {
  position: fixed;
  top: 15vh;
  right: 20px;
  height: 70vh;
  width: 4px; /* Increased from 2px */
  z-index: 999;
  opacity: 0;
  transition: opacity 2s ease-in-out; 
  pointer-events: none; 
}

.custom-scrollbar.is-visible {
  opacity: 1;
}

.scroll-track {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.15); /* Made the track slightly brighter */
  border-radius: 4px;
}

.scroll-thumb {
  position: absolute;
  left: -4px; /* Centers the 12px thumb on the 4px track */
  width: 12px; /* Doubled from 6px */
  height: 40px; /* Increased from 25px */
  background: #00d2ff;
  border-radius: 8px;
  box-shadow: 0 0 15px #00d2ff, 0 0 30px rgba(0, 210, 255, 0.8); /* Stronger glow */
  transform: translateY(-50%); 
}


/* Hero Container constraints the circles, and halo 
  to exactly the first screen of the page 
*/
.hero-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vh;
  perspective: 1000px;
  position: relative;
  overflow: hidden; 
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

.ripple-out {
  animation: fadeCircleOut 0.5s forwards ease-in-out, animate 3s ease-in-out infinite !important;
}

@keyframes fadeCircleOut {
  0% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.8); }
}

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

/* --- HALO GLOW EFFECT --- */
.halo-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  --halo-y-offset: -50%;
  transform: translate(-50%, var(--halo-y-offset));
  width: 60vmin;
  height: 60vmin;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(0, 210, 255, 0.05) 40%, transparent 70%);
  filter: blur(40px);
  z-index: 1; 
  animation: pulse-glow 6s ease-in-out infinite alternate;
  transition: opacity 0.5s ease;
}

@keyframes pulse-glow {
  0% { transform: translate(-50%, var(--halo-y-offset)) scale(0.9); opacity: 0.6; }
  100% { transform: translate(-50%, var(--halo-y-offset)) scale(1.1); opacity: 1; }
}

/* --- TEXT OVERLAYS (HERO) --- */
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

.one-tool { font-weight: 800; color: #fff; text-shadow: 0 0 15px rgba(255, 255, 255, 0.4); }
.zero-code { font-family: 'JetBrains Mono', monospace; font-weight: 700; color: transparent; -webkit-text-stroke: 1.5px #94a3b8; }

.infinite-paths {
  display: inline-block;
  font-weight: 700;
  font-style: italic;
  letter-spacing: 6px; 
  background: linear-gradient(120deg, #475569 35%, #ffffff 45%, #00d2ff 50%, #ffffff 55%, #475569 65%);
  background-size: 300% 100%;
  -webkit-background-clip: text;
  color: transparent; 
  animation: shine 3s ease-in-out infinite; 
}

@keyframes shine {
  0% { background-position: 150% 0; }
  100% { background-position: -50% 0; }
}

/* --- BOTTOM SECTION (HERO) --- */
.bottom-section {
  position: absolute;
  bottom: clamp(20px, 8%, 100px);
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

.pitch-text p { margin: 0; }
.highlight { color: #00d2ff; font-weight: 600; text-shadow: 0 0 8px rgba(0, 210, 255, 0.3); }

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
  background: transparent; border: 1px solid #334155; color: #cbd5e1;
  padding: 0.6rem 1.5rem; font-family: 'Inter', sans-serif; font-size: 0.85rem;
  font-weight: 500; letter-spacing: 1px; text-transform: uppercase;
  border-radius: 4px; cursor: pointer; transition: all 0.3s ease;
  backdrop-filter: blur(5px); text-align: center;
}

.btn:hover:not(:disabled) {
  border-color: #00d2ff; color: #fff; background: rgba(0, 210, 255, 0.08);
  box-shadow: 0 0 15px rgba(0, 210, 255, 0.3); transform: translateY(-2px);
}

.btn:disabled { opacity: 0.4; cursor: not-allowed; border-color: #1e293b; }

.welcome {
  color: #94a3b8; font-size: clamp(0.9rem, 2vw, 1.2rem); font-weight: 300;
  letter-spacing: 1px; margin: 0; opacity: 0; animation: fadeUp 1s ease forwards 3.8s; 
  text-shadow: 0 5px 15px rgba(0, 0, 0, 0.9); text-align: center; transition: opacity 0.5s ease;
}

.loom { font-weight: 700; color: #fff; margin-left: 8px; }
.art { font-weight: 300; color: #00d2ff; text-shadow: 0 0 10px rgba(0, 210, 255, 0.4); }

/* --- CIRCLE ANIMATION --- */
.circles-wrapper {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  transform-style: preserve-3d;
  z-index: 5; 
  --circle-y-offset: 0px;
  --circle-scale: 1;
  transform: translateY(var(--circle-y-offset)) scale(var(--circle-scale));
}

.circle {
  position: absolute; background: transparent; width: calc(var(--i) * 4vmin); 
  aspect-ratio: 1; border-radius: 50%; border: 3px solid #3b82f6; 
  transform-style: preserve-3d; transform: rotateX(70deg) translateZ(50px);
  animation: animate 3s ease-in-out calc(var(--i) * 0.08s) infinite;
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.5), inset 0 0 15px rgba(0, 0, 0, 0.5);
}

@keyframes animate {
  0%, 100% { transform: rotateX(70deg) translateZ(50px) translateY(0); filter: hue-rotate(0); }
  50% { transform: rotateX(70deg) translateZ(50px) translateY(-50vmin); filter: hue-rotate(90deg); }
}

/* ==============================================================
   FEATURE SECTIONS (Scrollable content)
============================================================== */
.features-wrapper {
  background: transparent; 
  position: relative;
  z-index: 10;
}

.feature-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10rem 8%;
  gap: 5rem;
  max-width: 1500px;
  margin: 0 auto;
}

/* Desktop alignment */
.left-flow { flex-direction: row; }
.right-flow { flex-direction: row; }

.feature-text { flex: 1; }

.glowing-tag {
  display: inline-block; color: #00d2ff; font-size: 0.85rem; font-weight: 700;
  letter-spacing: 2px; text-transform: uppercase; margin-bottom: 1.5rem; position: relative;
}

.glowing-tag::before {
  content: ''; position: absolute; left: -20px; top: 50%; transform: translateY(-50%);
  width: 10px; height: 1px; background: #00d2ff; box-shadow: 0 0 10px #00d2ff;
}

.feature-text h3 {
  font-size: clamp(2.2rem, 4vw, 3.5rem); color: #f8fafc; margin: 0 0 1.5rem 0;
  line-height: 1.1; letter-spacing: -1px;
}

.feature-text p {
  font-size: 1.15rem; color: #94a3b8; line-height: 1.8;
}

.feature-visual {
  flex: 1; width: 100%; position: relative;
}

/* The Glass "Membrane" holding the image */
.living-glass {
  background: rgba(15, 15, 20, 0.4); border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 1rem; backdrop-filter: blur(20px); border-radius: 20px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8); position: relative; transition: transform 0.5s ease;
}

.living-glass::after {
  content: ''; position: absolute; inset: -1px; border-radius: 20px;
  background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent 50%, rgba(0, 210, 255, 0.1));
  z-index: -1;
}

.living-glass:hover { transform: translateY(-10px) rotate(1deg); }

.vision-img {
  width: 100%; height: auto; border-radius: 12px; display: block;
}

/* Fallback Mockups (If images fail to load) */
.fallback-vision {
  height: 350px; width: 100%; background: #0a0a0f; border-radius: 12px;
  display: none; align-items: center; justify-content: center; position: relative; overflow: hidden;
}
.f-node { background: #1e293b; padding: 12px 20px; border-radius: 30px; border: 1px solid #3b82f6; position: absolute; font-size: 0.85rem; color: #fff; box-shadow: 0 0 15px rgba(59,130,246,0.2); }
.n-root { top: 20%; left: 20%; }
.n-branch1 { top: 60%; left: 60%; border-color: #10b981; box-shadow: 0 0 15px rgba(16,185,129,0.2); }
.n-branch2 { top: 20%; left: 70%; border-color: #a855f7; box-shadow: 0 0 15px rgba(168,85,247,0.2); }
.f-path { position: absolute; background: rgba(255,255,255,0.1); height: 2px; }
.p1 { width: 150px; top: 30%; left: 35%; transform: rotate(30deg); }
.p2 { width: 100px; top: 40%; left: 65%; transform: rotate(-90deg); }

.grid-matrix { width: 180px; height: 180px; background-image: linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px); background-size: 20px 20px; border: 1px solid rgba(255,255,255,0.1); }
.f-post { width: 75%; height: 80px; background: rgba(255,255,255,0.03); border-radius: 16px; position: absolute; }
.p-top { top: 20%; left: 12.5%; }
.p-bottom { top: 60%; left: 12.5%; opacity: 0.5; }

/* ==============================================================
   FINAL CTA SECTION
============================================================== */
.final-cta-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6rem 20px 10rem 20px;
  text-align: center;
  position: relative;
  z-index: 10;
}

.cta-title {
  font-size: clamp(2rem, 4vw, 3.5rem);
  color: #fff;
  margin-bottom: 3rem;
  font-weight: 700;
  letter-spacing: -1px;
}

.bottom-actions {
  opacity: 1; 
  animation: none; 
}

/* ==============================================================
   REVEAL ANIMATIONS (Intersection Observer)
============================================================== */
.dormant-element {
  opacity: 0;
  transform: translateY(60px) scale(0.98);
  filter: blur(10px);
  transition: opacity 1s cubic-bezier(0.2, 0.8, 0.2, 1), 
              transform 1s cubic-bezier(0.2, 0.8, 0.2, 1),
              filter 1s ease-out;
}

.dormant-element.manifest {
  opacity: 1; transform: translateY(0) scale(1); filter: blur(0px);
}

.delay-1 { transition-delay: 0.2s; }

/* ==============================================================
   RESPONSIVE DESIGN FOR MOBILES
============================================================== */
@media (max-width: 968px) {
  .feature-section {
    flex-direction: column !important;
    padding: 6rem 5%;
    gap: 4rem;
    text-align: center;
  }
  
  /* Force Text to always be above Image on mobile */
  .feature-text { order: 1; }
  .feature-visual { order: 2; }
  .glowing-tag::before { display: none; }
}

@media (max-width: 768px) {
  .custom-scrollbar { right: 10px; } /* Move scrollbar closer to edge on tablets */
  .circles-wrapper { --circle-y-offset: -10vh; --circle-scale: 0.85; }
  .halo-glow { --halo-y-offset: -60%; }
  .top-text { top: 6%; }
  .bottom-section { gap: 1rem; }
  .pitch-text { font-size: 0.85rem; padding: 0 10px; }
  .final-cta-section { padding: 4rem 20px 8rem 20px; }
}

@media (max-width: 600px) {
  .custom-scrollbar { right: 8px; width: 3px; } /* Slightly thicker track for mobile */
  .scroll-thumb { width: 8px; height: 30px; left: -2.5px; } /* Much larger touch-indicator */
  
  /* Keep your other existing mobile styles below... */
  .circles-wrapper { --circle-y-offset: -12vh; --circle-scale: 0.65; }
  .halo-glow { --halo-y-offset: -62%; }
  .actions { flex-direction: column; align-items: stretch; width: 80%; max-width: 300px; gap: 0.8rem; }
  .btn { width: 100%; padding: 0.8rem 1.5rem; }
}
</style>