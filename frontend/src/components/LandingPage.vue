<script setup>
import { useRouter } from 'vue-router'
import { onMounted, ref } from 'vue'

const router = useRouter()

// Smooth scroll reveal logic
const observer = ref(null)

onMounted(() => {
  observer.value = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('show')
      }
    })
  }, {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
  })

  document.querySelectorAll('.hidden-element').forEach((el) => {
    observer.value.observe(el)
  })
})
</script>

<template>
  <head>
    <title>LoomArt | Weave Your Reality</title>
  </head>

  <div class="landing-wrapper">
    <div class="ambient-background">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
      <div class="noise-overlay"></div>
    </div>

    <nav class="navbar">
      <div class="logo">LoomArt</div>
      <div class="nav-actions">
        <button class="nav-btn text-btn" @click="router.push('/login')">Log In</button>
        <button class="nav-btn glow-btn" @click="router.push('/register')">Register</button>
      </div>
    </nav>

    <section class="hero-section">
      <div class="hero-content hidden-element">
        <h2 class="pre-title">You are here for the choices you've made.</h2>
        <h1 class="main-title">Weave Your <br><span class="gradient-text">Reality</span></h1>
        <p class="hero-subtitle">
          The ultimate no-code engine for interactive fiction. <br/>
          LoomArt only requires imagination.
        </p>
        <div class="hero-buttons">
          <button class="primary-btn" @click="router.push('/register')">Register</button>
          <button class="secondary-btn" @click="router.push('/login')">Login</button>
        </div>
      </div>
    </section>

    <section class="feature-section right-align">
      <div class="feature-text hidden-element">
        <div class="feature-tag">The Weaver</div>
        <h3>No Code. Just Flow.</h3>
        <p>
          Artists and writers shouldn't be held back by syntax. Our visual node-based engine lets you drag, drop, and connect your narrative branches effortlessly. Build complex If-Else logic, set variables, and manage scenes without writing a single line of code.
        </p>
      </div>
      <div class="feature-visual hidden-element delay-1">
        <div class="glass-container">
          <img src="../assets/images/weaver-engine.png" alt="Weaver Engine" class="app-screenshot" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
          <div class="fallback-visual node-mockup">
            <div class="mock-node n1">Root Scene</div>
            <div class="mock-line l1"></div>
            <div class="mock-node n2">Branch A</div>
            <div class="mock-line l2"></div>
            <div class="mock-node n3">Branch B</div>
          </div>
        </div>
      </div>
    </section>

    <section class="feature-section left-align">
      <div class="feature-visual hidden-element">
        <div class="glass-container">
          <img src="../assets/images/pixel-editor.png" alt="Pixel Editor" class="app-screenshot" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
          <div class="fallback-visual pixel-mockup">
            <div class="pixel-grid"></div>
          </div>
        </div>
      </div>
      <div class="feature-text hidden-element delay-1">
        <div class="feature-tag">Reward the Journey</div>
        <h3>Hand-Crafted Artifacts.</h3>
        <p>
          Don't just give players a text popup. Reward them with custom 64x64 pixel art Profile Pictures and Badges that they can equip. Draw them directly in the browser with our built-in retro pixel canvas and attach custom sound effects to their discovery.
        </p>
      </div>
    </section>

    <section class="feature-section right-align">
      <div class="feature-text hidden-element">
        <div class="feature-tag">The Loom</div>
        <h3>A New Kind of Social Network.</h3>
        <p>
          Stop scrolling through photos and videos. Scroll through worlds. The Loom is a social feed where creators publish their interactive fiction. Play games, leave comments, follow your favorite Weavers, and even monetize your premium stories as a side-hustle.
        </p>
      </div>
      <div class="feature-visual hidden-element delay-1">
        <div class="glass-container">
          <img src="../assets/images/the-loom.png" alt="The Loom" class="app-screenshot" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
          <div class="fallback-visual social-mockup">
            <div class="mock-post"></div>
            <div class="mock-post"></div>
          </div>
        </div>
      </div>
    </section>

    <section class="cta-section hidden-element">
      <h2>Ready to Make a Choice?</h2>
      <p>Join the community of dreamers, explorers, and weavers.</p>
      <button class="primary-btn large-btn" @click="router.push('/register')">Register</button>
    </section>

    <footer class="footer">
      <div class="footer-content">
        <span class="logo-small">LoomArt</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ==============================================================
   CORE STYLES & TYPOGRAPHY
============================================================== */
.landing-wrapper {
  background-color: #020617; /* Deep slate background */
  color: #e2e8f0;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  overflow-x: hidden;
  position: relative;
  min-height: 100vh;
}

/* ==============================================================
   HYPNOTIC BACKGROUND (The Stoner Vibe)
============================================================== */
.ambient-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  overflow: hidden;
  background: #020617;
}

.blob {
  position: absolute;
  filter: blur(90px);
  opacity: 0.5;
  animation: float 20s infinite alternate cubic-bezier(0.45, 0.05, 0.55, 0.95);
  border-radius: 50%;
}

.blob-1 {
  width: 60vw;
  height: 60vw;
  background: rgba(59, 130, 246, 0.4); /* Blue */
  top: -10%;
  left: -10%;
  animation-delay: 0s;
}

.blob-2 {
  width: 50vw;
  height: 50vw;
  background: rgba(168, 85, 247, 0.3); /* Purple */
  bottom: -20%;
  right: -10%;
  animation-delay: -5s;
}

.blob-3 {
  width: 40vw;
  height: 40vw;
  background: rgba(16, 185, 129, 0.2); /* Emerald */
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation-delay: -10s;
}

.noise-overlay {
  position: absolute;
  inset: 0;
  background: url('data:image/svg+xml;utf8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E');
  opacity: 0.03; /* Subtle grain for texture */
  mix-blend-mode: overlay;
  pointer-events: none;
}

@keyframes float {
  0% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(5%, 10%) scale(1.1); }
  66% { transform: translate(-10%, 5%) scale(0.9); }
  100% { transform: translate(0, -10%) scale(1); }
}

/* ==============================================================
   NAVIGATION
============================================================== */
.navbar {
  position: fixed;
  top: 0;
  width: 100%;
  padding: 1.5rem 5%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 50;
  background: rgba(2, 6, 23, 0.4);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  box-sizing: border-box;
}

.logo {
  font-family: 'Times New Roman', Times, serif;
  font-size: 1.8rem;
  font-weight: bold;
  letter-spacing: 2px;
  background: linear-gradient(135deg, #a855f7, #3b82f6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
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
  transition: all 0.3s ease;
  border-radius: 8px;
}

.text-btn {
  background: transparent;
  color: #cbd5e1;
  border: none;
}

.text-btn:hover {
  color: #fff;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

.glow-btn {
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.4);
  padding: 0.6rem 1.2rem;
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.2);
}

.glow-btn:hover {
  background: rgba(59, 130, 246, 0.2);
  color: #fff;
  box-shadow: 0 0 25px rgba(59, 130, 246, 0.4);
  transform: translateY(-2px);
}

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

.hero-content {
  max-width: 800px;
}

.pre-title {
  color: #60a5fa;
  font-size: 1.1rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 1rem;
  font-weight: 400;
}

.main-title {
  font-size: clamp(3rem, 8vw, 5.5rem);
  line-height: 1.1;
  margin: 0 0 1.5rem 0;
  font-weight: 800;
  letter-spacing: -1px;
}

.gradient-text {
  background: linear-gradient(135deg, #a855f7 0%, #3b82f6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 40px rgba(168, 85, 247, 0.3);
}

.hero-subtitle {
  font-size: clamp(1.1rem, 2vw, 1.4rem);
  color: #94a3b8;
  line-height: 1.6;
  margin-bottom: 3rem;
}

.hero-buttons {
  display: flex;
  gap: 20px;
  justify-content: center;
  flex-wrap: wrap;
}

.primary-btn, .secondary-btn {
  padding: 1rem 2.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.primary-btn {
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: white;
  border: none;
  box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);
}

.primary-btn:hover {
  transform: translateY(-4px);
  box-shadow: 0 15px 35px rgba(59, 130, 246, 0.5);
}

.secondary-btn {
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(10px);
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.secondary-btn:hover {
  background: rgba(30, 41, 59, 0.8);
  border-color: #60a5fa;
  transform: translateY(-4px);
}

/* ==============================================================
   FEATURE SECTIONS (Z-Pattern)
============================================================== */
.feature-section {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rem 10%;
  gap: 4rem;
  max-width: 1400px;
  margin: 0 auto;
}

.feature-section.left-align {
  flex-direction: row;
}

.feature-section.right-align {
  flex-direction: row;
}

.feature-text {
  flex: 1;
}

.feature-tag {
  display: inline-block;
  background: rgba(168, 85, 247, 0.1);
  color: #c084fc;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 1.5rem;
  border: 1px solid rgba(168, 85, 247, 0.3);
}

.feature-text h3 {
  font-size: clamp(2rem, 4vw, 3rem);
  color: #f8fafc;
  margin: 0 0 1.5rem 0;
  line-height: 1.2;
}

.feature-text p {
  font-size: 1.15rem;
  color: #94a3b8;
  line-height: 1.7;
}

.feature-visual {
  flex: 1;
  width: 100%;
}

.glass-container {
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 24px;
  padding: 1rem;
  backdrop-filter: blur(20px);
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6);
  position: relative;
  overflow: hidden;
}

.glass-container::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 100%);
  pointer-events: none;
}

.app-screenshot {
  width: 100%;
  height: auto;
  border-radius: 16px;
  display: block;
}

/* Fallback Mockups (shown only if images are missing) */
.fallback-visual {
  height: 350px;
  width: 100%;
  background: rgba(2, 6, 23, 0.8);
  border-radius: 16px;
  display: none; /* Hidden by default, triggered by image onerror */
  align-items: center;
  justify-content: center;
  position: relative;
}

.mock-node { background: #1e293b; padding: 15px 25px; border-radius: 8px; border: 1px solid #3b82f6; position: absolute; font-size: 0.9rem; }
.n1 { top: 20%; left: 20%; }
.n2 { top: 60%; left: 60%; border-color: #a855f7;}
.n3 { top: 20%; left: 70%; border-color: #10b981;}
.mock-line { position: absolute; background: rgba(255,255,255,0.2); height: 2px; }
.l1 { width: 150px; top: 30%; left: 35%; transform: rotate(30deg); }
.l2 { width: 100px; top: 40%; left: 65%; transform: rotate(-90deg); }

.pixel-grid { width: 200px; height: 200px; background-image: linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px; border: 2px solid rgba(255,255,255,0.1); border-radius: 8px; }

.mock-post { width: 80%; height: 100px; background: #1e293b; border-radius: 12px; margin: 15px; opacity: 0.7;}


/* ==============================================================
   CTA & FOOTER
============================================================== */
.cta-section {
  position: relative;
  z-index: 10;
  text-align: center;
  padding: 8rem 20px;
  background: linear-gradient(to top, rgba(2, 6, 23, 1), transparent);
}

.cta-section h2 {
  font-size: clamp(2.5rem, 5vw, 4rem);
  color: #fff;
  margin: 0 0 1rem 0;
}

.cta-section p {
  color: #94a3b8;
  font-size: 1.2rem;
  margin-bottom: 3rem;
}

.large-btn {
  padding: 1.2rem 3.5rem;
  font-size: 1.3rem;
}

.footer {
  position: relative;
  z-index: 10;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding: 2rem 5%;
  background: #020617;
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1400px;
  margin: 0 auto;
}

.logo-small {
  font-family: 'Times New Roman', Times, serif;
  color: #3b82f6;
  font-weight: bold;
  letter-spacing: 1px;
}

.copyright {
  color: #475569;
  font-size: 0.9rem;
}

/* ==============================================================
   SCROLL ANIMATIONS (Intersection Observer Classes)
============================================================== */
.hidden-element {
  opacity: 0;
  transform: translateY(40px);
  transition: opacity 0.8s ease-out, transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.hidden-element.show {
  opacity: 1;
  transform: translateY(0);
}

.delay-1 {
  transition-delay: 0.2s;
}

/* ==============================================================
   RESPONSIVE DESIGN (Phones & Tablets)
============================================================== */
@media (max-width: 968px) {
  .feature-section {
    flex-direction: column !important; /* Forces stacking on smaller screens */
    padding: 5rem 5%;
    gap: 3rem;
    text-align: center;
  }
  
  .feature-tag {
    margin: 0 auto 1.5rem auto;
  }
}

@media (max-width: 600px) {
  .navbar {
    padding: 1rem 5%;
  }
  
  .logo {
    font-size: 1.4rem;
  }
  
  .nav-actions {
    gap: 0.8rem;
  }
  
  .glow-btn {
    padding: 0.5rem 0.8rem;
    font-size: 0.85rem;
  }

  .text-btn {
    display: none; /* Hide standard login text on very small screens to save space */
  }

  .hero-buttons {
    flex-direction: column;
    gap: 15px;
  }

  .primary-btn, .secondary-btn {
    width: 100%;
  }

  .footer-content {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
}
</style>