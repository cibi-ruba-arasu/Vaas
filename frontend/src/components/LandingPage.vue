<script setup>
import { useRouter } from 'vue-router'
import { onMounted, onUnmounted, ref } from 'vue'

const router = useRouter()

// Reveal logic for scrolling
const observer = ref(null)

// Parallax & Scroll States
const navOpacity = ref(1)
const mouseX = ref(50)
const mouseY = ref(50)

const handleScroll = () => {
  // Fade out the navbar completely by the time they scroll 400px down
  const scrollY = window.scrollY
  navOpacity.value = Math.max(0, 1 - scrollY / 400)
}

const handleMouseMove = (e) => {
  // Calculate mouse position as a percentage for the Entity to track
  mouseX.value = (e.clientX / window.innerWidth) * 100
  mouseY.value = (e.clientY / window.innerHeight) * 100
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
  window.addEventListener('mousemove', handleMouseMove)

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

  document.querySelectorAll('.dormant-element').forEach((el) => {
    observer.value.observe(el)
  })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('mousemove', handleMouseMove)
})
</script>

<template>
  <head>
    <title>LoomArt | The Weaver</title>
  </head>

  <div class="void-wrapper">
    
    <div class="entity-container">
      <div class="entity-aura primary-aura"></div>
      <div class="entity-aura secondary-aura"></div>
      <div class="entity-core" 
           :style="{ transform: `translate(${(mouseX - 50) * 0.5}px, ${(mouseY - 50) * 0.5}px)` }">
      </div>
      <div class="noise-texture"></div>
    </div>

    <nav class="navbar" 
         :style="{ opacity: navOpacity, pointerEvents: navOpacity < 0.1 ? 'none' : 'auto', transform: `translateY(${(1 - navOpacity) * -20}px)` }">
      <div class="branding">
        <h1 class="logo-title">Loom<span class="logo-art">Art</span></h1>
      </div>
      <div class="nav-actions">
        <button class="nav-btn text-btn" @click="router.push('/login')">Log In</button>
        <button class="nav-btn pulse-btn" @click="router.push('/register')">Enter</button>
      </div>
    </nav>

    <section class="hero-section">
      <div class="hero-content dormant-element">
        <h2 class="mystic-whisper">You are here for the choices you've made.</h2>
        <h1 class="main-title">Weave Your <br><span class="fluid-text">Reality</span></h1>
        <p class="hero-subtitle">
          The universe's easiest no-code engine for interactive fiction. <br/>
          No scripts. No boundaries. Just pure imagination manifesting.
        </p>
        <div class="hero-buttons">
          <button class="organic-btn primary" @click="router.push('/register')">Register</button>
          <button class="organic-btn secondary" @click="router.push('/login')">Login</button>
        </div>
      </div>
    </section>

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

    <section class="cta-section dormant-element">
      <div class="cta-core">
        <h2>The gates are open.</h2>
        <p>Will you step through?</p>
        <button class="organic-btn primary massive" @click="router.push('/register')">Register</button>
      </div>
    </section>

    <footer class="abyss-footer">
      <span class="logo-title small">Loom<span class="logo-art">Art</span></span>
      <span class="whisper-text">The choices are yours.</span>
    </footer>
  </div>
</template>

<style scoped>
/* ==============================================================
   THE VOID (Core Setup)
============================================================== */
.void-wrapper {
  background-color: #030305;
  color: #e2e8f0;
  font-family: 'Inter', system-ui, sans-serif;
  overflow-x: hidden;
  position: relative;
  min-height: 100vh;
}

/* ==============================================================
   THE ENTITY (Living Background)
============================================================== */
.entity-container {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: #020204;
  pointer-events: none;
}

.entity-aura {
  position: absolute;
  filter: blur(120px);
  opacity: 0.45;
  border-radius: 50%;
  animation: organic-drift 25s infinite alternate cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, border-radius;
}

.primary-aura {
  width: 70vw;
  height: 70vw;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.6) 0%, transparent 70%);
  top: -10%;
  left: -10%;
  animation-delay: 0s;
}

.secondary-aura {
  width: 60vw;
  height: 60vw;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%);
  bottom: -10%;
  right: -10%;
  animation-duration: 35s;
}

.entity-core {
  position: absolute;
  top: 40%;
  left: 45%;
  width: 40vw;
  height: 40vw;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, rgba(20, 184, 166, 0.1) 40%, transparent 70%);
  filter: blur(90px);
  border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
  animation: entity-breathe 12s infinite alternate ease-in-out;
  transition: transform 0.8s cubic-bezier(0.1, 0.8, 0.2, 1); /* Smooth mouse tracking */
}

.noise-texture {
  position: absolute;
  inset: 0;
  background: url('data:image/svg+xml;utf8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E');
  opacity: 0.04;
  mix-blend-mode: overlay;
}

/* Organic Animations */
@keyframes organic-drift {
  0% { transform: translate(0, 0) scale(1) rotate(0deg); }
  50% { transform: translate(8%, 12%) scale(1.1) rotate(15deg); }
  100% { transform: translate(-5%, 8%) scale(0.9) rotate(-5deg); }
}

@keyframes entity-breathe {
  0% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; opacity: 0.5; transform: scale(0.95); }
  100% { border-radius: 50% 50% 30% 70% / 50% 70% 30% 50%; opacity: 0.8; transform: scale(1.05); }
}

/* ==============================================================
   NAVIGATION (With Fade Logic)
============================================================== */
.navbar {
  position: fixed;
  top: 0;
  width: 100%;
  padding: 1.5rem 5%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;
  box-sizing: border-box; /* 🚀 FIX: Keeps the padding inside the 100% width */
  transition: opacity 0.1s linear, transform 0.1s linear;
}

/* Typography fix from previous prompt */
.logo-title {
  font-family: 'Inter', sans-serif;
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: 0.05rem;
  margin: 0;
  color: #fff;
  text-shadow: 0 0 15px rgba(255, 255, 255, 0.4), 0 0 30px rgba(59, 130, 246, 0.5);
}

.logo-art {
  font-weight: 300;
  color: #3b82f6; /* Blue tint */
  margin-left: 2px;
}

.nav-actions {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.nav-btn {
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  border-radius: 12px;
  font-family: 'Inter', sans-serif;
}

.text-btn {
  background: transparent;
  color: #94a3b8;
  border: none;
}

.text-btn:hover {
  color: #fff;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

.pulse-btn {
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
  border: 1px solid rgba(59, 130, 246, 0.3);
  padding: 0.6rem 1.5rem;
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
}

.pulse-btn::before {
  content: '';
  position: absolute;
  top: 50%; left: 50%; width: 100%; height: 100%;
  background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 60%);
  transform: translate(-50%, -50%) scale(0);
  transition: transform 0.4s ease;
}

.pulse-btn:hover {
  background: rgba(59, 130, 246, 0.25);
  border-color: rgba(59, 130, 246, 0.6);
  color: #fff;
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
}
.pulse-btn:hover::before { transform: translate(-50%, -50%) scale(2); }

/* ==============================================================
   HERO SECTION
============================================================== */
.hero-section {
  position: relative;
  z-index: 10;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 20px;
}

.mystic-whisper {
  color: #14b8a6; /* Teal */
  font-size: 1rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  margin-bottom: 1.5rem;
  font-weight: 300;
  opacity: 0.8;
}

.main-title {
  font-size: clamp(3.5rem, 9vw, 6.5rem);
  line-height: 1.05;
  margin: 0 0 1.5rem 0;
  font-weight: 800;
  letter-spacing: -2px;
}

.fluid-text {
  background: linear-gradient(to right, #3b82f6, #10b981, #a855f7);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: liquid-gradient 6s linear infinite;
  text-shadow: 0 0 50px rgba(168, 85, 247, 0.2);
}

@keyframes liquid-gradient {
  0% { background-position: 0% center; }
  100% { background-position: 200% center; }
}

.hero-subtitle {
  font-size: clamp(1.1rem, 2vw, 1.4rem);
  color: #94a3b8;
  line-height: 1.6;
  margin-bottom: 3rem;
  max-width: 700px;
  margin-inline: auto;
}

/* Organic Buttons */
.hero-buttons {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  flex-wrap: wrap;
}

.organic-btn {
  padding: 1rem 2.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  border-radius: 30px; /* Pill shape */
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  font-family: 'Inter', sans-serif;
  border: none;
}



.organic-btn.primary {
  background: rgba(255, 255, 255, 0.9);
  color: #030305;
  box-shadow: 0 0 30px rgba(255, 255, 255, 0.2);
}

.organic-btn.primary:hover {
  background: #fff;
  transform: translateY(-5px) scale(1.02);
  box-shadow: 0 10px 40px rgba(255, 255, 255, 0.4);
}

.organic-btn.secondary {
  background: rgba(255, 255, 255, 0.05);
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.organic-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-5px);
}

/* ==============================================================
   FEATURE SECTIONS
============================================================== */
.feature-section {
  position: relative;
  z-index: 10;
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

.feature-text {
  flex: 1;
}

.glowing-tag {
  display: inline-block;
  color: #3b82f6;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 1.5rem;
  position: relative;
}

.glowing-tag::before {
  content: '';
  position: absolute;
  left: -20px; top: 50%;
  transform: translateY(-50%);
  width: 10px; height: 1px;
  background: #3b82f6;
  box-shadow: 0 0 10px #3b82f6;
}

.feature-text h3 {
  font-size: clamp(2.2rem, 4vw, 3.5rem);
  color: #f8fafc;
  margin: 0 0 1.5rem 0;
  line-height: 1.1;
  letter-spacing: -1px;
}

.feature-text p {
  font-size: 1.15rem;
  color: #94a3b8;
  line-height: 1.8;
}

.feature-visual {
  flex: 1;
  width: 100%;
  position: relative;
}

/* The Glass "Membrane" holding the image */
.living-glass {
  background: rgba(15, 15, 20, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 1rem;
  backdrop-filter: blur(20px);
  border-radius: 20px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8);
  position: relative;
  transition: transform 0.5s ease;
}

.living-glass::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent 50%, rgba(59, 130, 246, 0.1));
  z-index: -1;
}

.living-glass:hover {
  transform: translateY(-10px) rotate(1deg);
}

.vision-img {
  width: 100%;
  height: auto;
  border-radius: 12px;
  display: block;
}

/* Fallback Mockups */
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
   CTA & FOOTER
============================================================== */
.cta-section {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: center;
  padding: 10rem 20px;
}

.cta-core {
  text-align: center;
  background: radial-gradient(circle, rgba(15, 23, 42, 0.8) 0%, transparent 100%);
  padding: 4rem;
  border-radius: 50%;
}

.cta-core h2 {
  font-size: clamp(2.5rem, 5vw, 4rem);
  color: #fff;
  margin: 0 0 1rem 0;
  letter-spacing: -1px;
}

.cta-core p {
  color: #94a3b8;
  font-size: 1.2rem;
  margin-bottom: 3rem;
}

.organic-btn.massive {
  font-size: 1.3rem;
  padding: 1.2rem 4rem;
}

.abyss-footer {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2rem 5%;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: #020204;
}

.logo-title.small { font-size: 1.2rem; }
.whisper-text { color: #475569; font-size: 0.85rem; }

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
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0px);
}

.delay-1 { transition-delay: 0.2s; }

/* ==============================================================
   RESPONSIVE DESIGN & MOBILE FIXES
============================================================== */
@media (max-width: 968px) {
  .feature-section {
    flex-direction: column !important; /* Stack vertically */
    padding: 6rem 5%;
    gap: 4rem;
    text-align: center;
  }
  
  /* 🚀 MOBILE FIX: Force Text to always be above Image */
  .feature-text {
    order: 1;
  }
  .feature-visual {
    order: 2;
  }

  .glowing-tag::before {
    display: none; /* Remove left line on center text */
  }
  
  .entity-core {
    width: 80vw;
    height: 80vw;
    left: 10%;
  }
}

@media (max-width: 600px) {
  .navbar { padding: 1rem 5%; }
  .logo-title { font-size: 1.4rem; }
  .nav-actions { gap: 0.8rem; }
  .text-btn { display: none; } /* Hide plain text login to save space */
  .pulse-btn { padding: 0.5rem 1rem; font-size: 0.85rem; }

  .hero-buttons { flex-direction: column; gap: 15px; }
  .organic-btn { width: 100%; }

  .abyss-footer { flex-direction: column; gap: 1rem; text-align: center; }

  .organic-btn.massive {
    padding: 1rem 2rem;
    font-size: 1.1rem;
    width: 100%;
    box-sizing: border-box;
  }

  .abyss-footer { flex-direction: column; gap: 1rem; text-align: center; }
}
</style>