<template>
  <div class="share-overlay" @click.self="$emit('close')">
    <div class="share-modal">
      <button class="close-btn" @click="$emit('close')">✕</button>
      
      <h3>Share Your Achievement!</h3>

      <div ref="shareCard" class="share-card mystical-theme">
        
        <div class="glow-bg"></div>
        <div class="stars-bg"></div>
        
        <div class="card-header">✦ Earned at LoomArt ✦</div>
        
        <div class="badge-container">
          <img :src="imageSrc" alt="Badge or PFP" class="badge-img" crossorigin="anonymous" />
        </div>
        
        <h2 class="achievement-title" :style="{ fontFamily: font || 'sans-serif' }">
          {{ title }}
        </h2>
        
        <div class="game-info">
          <span class="game-name">{{ gameName }}</span>
          <span class="author-name">by {{ authorName }}</span>
        </div>
      </div>

      <div class="actions">
        <button @click="generateAndShare" :disabled="isGenerating" class="share-btn">
          <span v-if="isGenerating">✨ Conjuring Image...</span>
          <span v-else>📸 Share Image</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import html2canvas from 'html2canvas'

const props = defineProps({
  imageSrc: String,
  title: String,
  font: String,
  gameName: String,
  authorName: String
})

const emit = defineEmits(['close'])

const shareCard = ref(null)
const isGenerating = ref(false)

const generateAndShare = async () => {
  if (!shareCard.value) return
  isGenerating.value = true

  try {
    const canvas = await html2canvas(shareCard.value, {
      scale: 3, // Very high resolution for crisp mystical details
      useCORS: true,
      backgroundColor: '#020617' // Deep dark mystical background matching the card edges
    })

    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'loomart-achievement.png', { type: 'image/png' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: props.title,
            text: `I just earned "${props.title}" in ${props.gameName} on LoomArt!`,
            files: [file]
          })
        } catch (error) {
          console.log('Sharing canceled or failed', error)
        }
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'loomart-achievement.png'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        alert('Mystical image downloaded! You can now share it anywhere.')
      }
      isGenerating.value = false
    }, 'image/png')

  } catch (error) {
    console.error('Error generating image:', error)
    isGenerating.value = false
  }
}
</script>

<style scoped>
/* Basic Modal Styles */
.share-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
}

.share-modal {
  background: #0f172a;
  border: 1px solid rgba(139, 92, 246, 0.3);
  padding: 30px;
  border-radius: 20px;
  text-align: center;
  position: relative;
  color: white;
  box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(139, 92, 246, 0.1);
  max-width: 90%;
}

.share-modal h3 {
  margin-top: 0;
  margin-bottom: 25px;
  font-size: 1.5rem;
  color: #f8fafc;
  font-family: 'Cinzel', serif; /* Optional: ties into your console's font */
}

/* ================= THE MYSTICAL CARD ================= */
.share-card {
  position: relative;
  background: radial-gradient(circle at 50% 10%, #2e1065 0%, #0f172a 60%, #020617 100%);
  border: 2px solid #8b5cf6;
  padding: 40px 30px;
  border-radius: 20px;
  margin: 0 auto 25px auto;
  width: 320px;
  overflow: hidden;
  box-shadow: 
    0 10px 30px rgba(0,0,0,0.8),
    inset 0 0 40px rgba(139, 92, 246, 0.3),
    0 0 20px rgba(139, 92, 246, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

/* Magical Background Elements */
.glow-bg {
  position: absolute;
  top: 0; left: 50%;
  transform: translateX(-50%);
  width: 250px; height: 250px;
  background: radial-gradient(circle, rgba(167, 139, 250, 0.3) 0%, transparent 70%);
  filter: blur(20px);
  pointer-events: none;
}

/* Fake CSS stars so html2canvas renders them */
.stars-bg {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image: 
    radial-gradient(1px 1px at 20px 30px, #ffffff, rgba(0,0,0,0)),
    radial-gradient(1px 1px at 40px 70px, #ffffff, rgba(0,0,0,0)),
    radial-gradient(1.5px 1.5px at 90px 40px, #e2e8f0, rgba(0,0,0,0)),
    radial-gradient(2px 2px at 160px 120px, #c4b5fd, rgba(0,0,0,0)),
    radial-gradient(1px 1px at 240px 50px, #ffffff, rgba(0,0,0,0)),
    radial-gradient(1.5px 1.5px at 280px 140px, #e2e8f0, rgba(0,0,0,0));
  opacity: 0.5;
  pointer-events: none;
}

/* Card Content */
.card-header {
  color: #c4b5fd;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 4px;
  font-weight: 700;
  text-shadow: 0 0 10px rgba(167, 139, 250, 0.8);
  z-index: 1;
}

.badge-container {
  position: relative;
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  margin: 15px 0;
}

/* Circular glow specifically behind the pixel art */
.badge-container::before {
  content: '';
  position: absolute;
  width: 110%; height: 110%;
  background: #c4b5fd;
  border-radius: 50%;
  filter: blur(25px);
  opacity: 0.25;
}

.badge-img {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  image-rendering: pixelated;
  box-shadow: 
    0 0 0 3px rgba(196, 181, 253, 0.5),
    0 0 0 6px rgba(139, 92, 246, 0.2),
    0 15px 30px rgba(0,0,0,0.8);
  position: relative;
  z-index: 2;
  /* 🚀 FIX: Set this to transparent so badges keep their transparent background */
  background: transparent; 
}

.achievement-title {
  margin: 0;
  font-size: 2.2rem;
  color: #ffffff;
  text-shadow: 
    0 0 10px #8b5cf6, 
    0 0 20px #c4b5fd,
    0 4px 10px rgba(0,0,0,0.8);
  z-index: 1;
  text-align: center;
  line-height: 1.1;
  letter-spacing: 1px;
}

.game-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 1;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid rgba(139, 92, 246, 0.3);
  width: 85%;
}

.game-name {
  font-size: 1.15rem;
  font-weight: 800;
  color: #f8fafc;
  text-shadow: 0 2px 5px rgba(0,0,0,0.8);
  text-align: center;
}

.author-name {
  font-size: 0.9rem;
  color: #a78bfa;
  font-style: italic;
}

/* Buttons */
.share-btn {
  background: linear-gradient(135deg, #8b5cf6, #6d28d9);
  color: white;
  padding: 14px 28px;
  border: none;
  border-radius: 30px;
  cursor: pointer;
  font-weight: bold;
  font-size: 1.1rem;
  transition: all 0.3s ease;
  box-shadow: 0 5px 15px rgba(109, 40, 217, 0.4);
  border: 1px solid rgba(196, 181, 253, 0.3);
}

.share-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(109, 40, 217, 0.6);
  background: linear-gradient(135deg, #9333ea, #7e22ce);
}

.share-btn:disabled {
  opacity: 0.7;
  cursor: wait;
  background: #4c1d95;
}

.close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  background: rgba(255,255,255,0.05);
  color: #94a3b8;
  border: 1px solid rgba(255,255,255,0.1);
  width: 32px; height: 32px;
  border-radius: 50%;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.2s;
}

.close-btn:hover { 
  background: rgba(239, 68, 68, 0.2); 
  color: #ef4444; 
  border-color: #ef4444; 
}
</style>