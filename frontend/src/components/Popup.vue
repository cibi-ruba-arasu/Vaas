<script setup>
defineProps({
  show: Boolean,
  title: String,
  description: String,
  iconPath: String
})

const emit = defineEmits(['close'])
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="modal-overlay" @click.self="emit('close')">
      <div class="auth-modal glass-panel">
        <button class="close-modal" @click="emit('close')">✕</button>
        
        <div class="modal-art">
          <div class="mini-soul-glow"></div>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--aura)" stroke-width="1.5">
            <path :d="iconPath" />
            <circle v-if="title === 'Essence Required'" cx="12" cy="7" r="4" />
          </svg>
        </div>

        <h2 class="modal-title">{{ title }}</h2>
        <p class="modal-desc">{{ description }}</p>
        
        <div class="auth-buttons">
          <slot name="actions"></slot>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Copy the modal styles provided in the previous response here */
/* They will now be scoped specifically to this popup file */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.auth-modal {
  width: 100%;
  max-width: 400px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  padding: 40px 30px;
  position: relative;
  text-align: center;
}
.modal-art { position: relative; width: 80px; height: 80px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; }
.mini-soul-glow { position: absolute; width: 100%; height: 100%; background: var(--aura); filter: blur(25px); opacity: 0.3; border-radius: 50%; z-index: 1; }
.modal-title { font-family: 'Cinzel', serif; font-size: 1.8rem; color: #fff; margin-bottom: 12px; }
.modal-desc { font-family: 'Inter', sans-serif; color: #94a3b8; font-size: 0.95rem; line-height: 1.6; margin-bottom: 30px; }
.auth-buttons { display: flex; flex-direction: column; gap: 12px; }
.close-modal { position: absolute; top: 20px; right: 20px; background: none; border: none; color: #64748b; cursor: pointer; }
.auth-btn {
  padding: 14px;
  border-radius: 12px;
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
  width: 100%;
}

.register-main {
  background: var(--aura);
  color: #fff;
  border: none;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.login-link {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.auth-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}
</style>