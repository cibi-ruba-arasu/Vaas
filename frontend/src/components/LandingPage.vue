<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <head>
    <title>Welcome | Loomart</title>
  </head>
  <div class="landing-page">
    
    <div class="ambient-glow"></div>

    <div class="hero-container">
      <h1 class="title">Loomart</h1>
      <p class="subtitle">Weave your imagination into reality.</p>
      
      <div class="action-buttons">
        <button class="btn login-btn" @click="router.push('/login')">
          Enter the Gates (Login)
        </button>
        <button class="btn register-btn" @click="router.push('/register')">
          Become a Creator (Register)
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.landing-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #020b2d 0%, #000000 100%);
  color: #e5e7eb;
  font-family: system-ui, -apple-system, BlinkMacSystemFont;
  position: relative;
  overflow: hidden;
}

.ambient-glow {
  position: absolute;
  width: 60vw;
  height: 60vw;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 60%);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 1;
}

.hero-container {
  z-index: 10;
  text-align: center;
  background: rgba(2, 6, 23, 0.6);
  padding: 4rem;
  border-radius: 24px;
  border: 1px solid rgba(59, 130, 246, 0.3);
  box-shadow: 
    0 25px 50px rgba(0, 0, 0, 0.8),
    0 0 40px rgba(59, 130, 246, 0.15);
  backdrop-filter: blur(10px);
  max-width: 600px;
  width: 90%;
  animation: floatUp 0.8s ease-out forwards;
}

.title {
  font-size: 4rem;
  margin: 0;
  font-family: 'Times New Roman', Times, serif;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #3b82f6;
  text-shadow: 0 0 25px rgba(59, 130, 246, 0.5);
}

.subtitle {
  font-size: 1.2rem;
  color: #93c5fd;
  margin-top: 1rem;
  margin-bottom: 3rem;
  letter-spacing: 0.05em;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.btn {
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  letter-spacing: 0.05em;
}

.login-btn {
  background: linear-gradient(to bottom right, #1d4ed8, #3b82f6);
  color: white;
  border: none;
  box-shadow: 0 10px 20px rgba(59, 130, 246, 0.3);
}

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 25px rgba(59, 130, 246, 0.5);
}

.register-btn {
  background: transparent;
  color: #93c5fd;
  border: 2px solid #3b82f6;
}

.register-btn:hover {
  background: rgba(59, 130, 246, 0.1);
  transform: translateY(-2px);
  color: white;
}

@keyframes floatUp {
  0% { opacity: 0; transform: translateY(30px); }
  100% { opacity: 1; transform: translateY(0); }
}

@media (max-width: 600px) {
  .hero-container {
    padding: 2.5rem 1.5rem;
  }
  .title { font-size: 2.5rem; }
  .subtitle { font-size: 1rem; }
}
</style>