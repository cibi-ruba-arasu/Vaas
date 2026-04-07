<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

const showAgeGate = ref(false);
const ageGateRejected = ref(false);
const rejectionMessage = ref("");

// Check session storage the moment this component loads on ANY page
onMounted(() => {
  const hasPassedAgeGate = sessionStorage.getItem('guestAgeVerified');
  if (!hasPassedAgeGate) {
    showAgeGate.value = true;
    // Optional: lock body scroll while modal is open
    document.body.style.overflow = 'hidden'; 
  }
});

const handleAgeConfirm = () => {
  sessionStorage.setItem('guestAgeVerified', 'true');
  showAgeGate.value = false;
  document.body.style.overflow = ''; // Restore scrolling
};

const handleAgeReject = () => {
  ageGateRejected.value = true;
  rejectionMessage.value = "The Loom requires the maturity of time. Your thread is not yet ready to weave these realms. Return when the seasons have turned.";
  
  // Kick them back to the safe landing page after reading the message
  setTimeout(() => {
    document.body.style.overflow = '';
    router.push('/');
  }, 4500);
};
</script>

<template>
  <Transition name="fade">
    <div v-if="showAgeGate" class="modal-overlay">
      <div class="auth-modal glass-panel age-gate-modal">
        
        <div class="modal-art">
          <div class="mini-soul-glow"></div>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--aura, #3b82f6)" stroke-width="1.5">
            <path d="M12 2v20" />
            <path d="M5 2h14" />
            <path d="M5 22h14" />
            <path d="M5 2l7 7 7-7" />
            <path d="M5 22l7-7 7 7" />
          </svg>
        </div>

        <div v-if="!ageGateRejected">
          <h2 class="modal-title">The Toll of Time</h2>
          <p class="modal-desc">Beyond this threshold lie realms woven with mature visions and unguarded truths. Do you swear by the Loom that you have seen at least 18 cycles of the sun?</p>
          
          <div class="auth-buttons">
            <button class="auth-btn register-main" @click="handleAgeConfirm">I am 18 or older</button>
            <button class="auth-btn login-link" @click="handleAgeReject">I have not yet reached 18</button>
          </div>
        </div>

        <div v-else class="rejection-state">
           <h2 class="modal-title" style="color: #fca5a5;">The Gates Remain Closed</h2>
           <p class="modal-desc" style="font-style: italic;">{{ rejectionMessage }}</p>
           <div class="tiny-spinner" style="margin: 20px auto 0; border-top-color: #fca5a5;"></div>
        </div>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.95); /* Deep dark background to hide content */
  backdrop-filter: blur(15px);
  z-index: 9999; /* Extremely high z-index to cover everything */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.auth-modal {
  width: 100%;
  max-width: 450px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  padding: 40px 30px;
  position: relative;
  text-align: center;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(59, 130, 246, 0.2);
  animation: modal-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes modal-pop {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.modal-art {
  position: relative;
  width: 80px;
  height: 80px;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-art svg {
  width: 50px;
  height: 50px;
  z-index: 2;
  filter: drop-shadow(0 0 10px var(--aura, #3b82f6));
}

.mini-soul-glow {
  position: absolute;
  width: 100%;
  height: 100%;
  background: var(--aura, #3b82f6);
  filter: blur(25px);
  opacity: 0.3;
  border-radius: 50%;
  z-index: 1;
}

.modal-title {
  font-family: 'Cinzel', serif;
  font-size: 1.8rem;
  color: #fff;
  margin-bottom: 12px;
}

.modal-desc {
  font-family: 'Inter', sans-serif;
  color: #94a3b8;
  font-size: 0.95rem;
  line-height: 1.6;
  margin-bottom: 30px;
}

.auth-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-btn {
  padding: 14px;
  border-radius: 12px;
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
}

.register-main {
  background: var(--aura, #3b82f6);
  color: #fff;
  border: none;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
}

.register-main:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.login-link {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.login-link:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.rejection-state {
  animation: fade-in-slow 1s ease forwards;
}

.tiny-spinner {
  width: 20px; 
  height: 20px;
  border: 2px solid rgba(255,255,255,0.1);
  border-top-color: #fca5a5;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fade-in-slow {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>