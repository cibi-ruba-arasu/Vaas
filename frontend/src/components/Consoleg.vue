<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const searchQuery = ref('') // Dummy state to keep the UI looking identical
</script>

<template>
  <div class="console-page">
    
    <nav class="console-header">
      <button @click="router.push('/homeg')" class="back-btn">← Eject</button>
      
      <div class="search-wrapper">
         <span class="search-icon">🔍</span>
         <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="Search your library..." 
            class="console-search" 
            disabled 
        />
      </div>

      <h1 class="console-title">🎮 Console</h1>
    </nav>

    <div class="wip-container">
      
      <div class="loom-core-anim">
        <div class="ring ring-1"></div>
        <div class="ring ring-2"></div>
        <div class="ring ring-3"></div>
        <div class="core-center">👽</div>
      </div>

      <h2 class="wip-title">Greetings, Traveler.</h2>
      
      <p class="wip-text">
        Your console is currently empty, but the threads are moving.<br><br>
        We are actively forging a special free-to-play experience tailored specifically for our anonymous guests. The Loom is weaving your introductory journey... hold tight!
      </p>

      <button @click="router.push('/homeg')" class="explore-btn">
        Return to the Void
      </button>

    </div>

  </div>
</template>

<style scoped>
/* ================= BASE STYLES (From Console.vue) ================= */
.console-page {
  min-height: 100vh;
  background: radial-gradient(circle at center, #0f172a 0%, #020617 100%);
  color: #fff;
  font-family: 'Inter', sans-serif;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.console-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 5%;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  background: rgba(2, 6, 23, 0.6);
  backdrop-filter: blur(10px);
  z-index: 10;
}

.back-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #cbd5e1;
  padding: 8px 20px;
  border-radius: 20px;
  cursor: pointer;
  transition: 0.2s;
  font-weight: 600;
}
.back-btn:hover { background: #ef4444; color: white; border-color: #ef4444; }

.console-title {
  margin: 0;
  font-family: 'Cinzel', serif;
  font-size: 1.8rem;
  color: #3b82f6;
  text-shadow: 0 0 15px rgba(59, 130, 246, 0.4);
}

.search-wrapper {
  position: relative;
  width: 100%;
  max-width: 400px;
}

.search-icon { 
  position: absolute; 
  left: 15px; 
  top: 50%; 
  transform: translateY(-50%); 
  opacity: 0.5; 
}

.console-search {
  width: 100%;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: white;
  padding: 10px 15px 10px 40px;
  border-radius: 30px;
  outline: none;
  transition: 0.3s;
  cursor: not-allowed;
  opacity: 0.7;
}

/* ================= WIP GUEST SECTION ================= */
.wip-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
  z-index: 5;
}

.wip-title {
  font-family: 'Cinzel', serif;
  font-size: 2.5rem;
  margin: 2rem 0 1rem 0;
  color: #f8fafc;
  text-shadow: 0 0 20px rgba(255,255,255,0.3);
}

.wip-text {
  color: #94a3b8;
  font-size: 1.1rem;
  line-height: 1.6;
  max-width: 600px;
  margin-bottom: 2.5rem;
}

.explore-btn {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
  padding: 12px 35px;
  border-radius: 30px;
  font-weight: 700;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 0 5px 20px rgba(59, 130, 246, 0.4);
}

.explore-btn:hover {
  transform: translateY(-5px) scale(1.05);
  box-shadow: 0 10px 30px rgba(59, 130, 246, 0.6);
}

/* ================= 3D LOOM CORE ANIMATION ================= */
.loom-core-anim {
  position: relative;
  width: 150px;
  height: 150px;
  perspective: 800px;
  transform-style: preserve-3d;
}

.core-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2.5rem;
  animation: pulseCore 2s ease-in-out infinite;
  z-index: 10;
  filter: drop-shadow(0 0 15px rgba(59, 130, 246, 0.8));
}

.ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 3px solid transparent;
  transform-style: preserve-3d;
}

.ring-1 {
  border-top-color: #3b82f6;
  border-bottom-color: #3b82f6;
  animation: spinAxis1 4s linear infinite;
  box-shadow: inset 0 0 15px rgba(59, 130, 246, 0.2);
}

.ring-2 {
  border-left-color: #10b981;
  border-right-color: #10b981;
  animation: spinAxis2 5s linear infinite;
  box-shadow: inset 0 0 15px rgba(16, 185, 129, 0.2);
}

.ring-3 {
  border-top-color: #a855f7;
  border-left-color: #a855f7;
  animation: spinAxis3 6s linear infinite;
  box-shadow: inset 0 0 15px rgba(168, 85, 247, 0.2);
}

/* Keyframes for the 3D spinning */
@keyframes spinAxis1 {
  0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
  100% { transform: rotateX(360deg) rotateY(180deg) rotateZ(360deg); }
}

@keyframes spinAxis2 {
  0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
  100% { transform: rotateX(180deg) rotateY(360deg) rotateZ(180deg); }
}

@keyframes spinAxis3 {
  0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
  100% { transform: rotateX(360deg) rotateY(360deg) rotateZ(360deg); }
}

@keyframes pulseCore {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
  50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
}

/* ================= RESPONSIVE ================= */
@media screen and (max-width: 768px) {
  .console-header {
    flex-direction: column;
    gap: 1rem;
  }
  .search-wrapper {
    order: 3;
    max-width: 100%;
  }
  .wip-title {
    font-size: 2rem;
  }
}
</style>