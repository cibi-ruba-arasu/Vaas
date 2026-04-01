<script setup>
const emit = defineEmits(['close'])
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>LoomArt Terms & Privacy Policy</h2>
        <button class="close-btn" @click="emit('close')">×</button>
      </div>
      
      <div class="modal-body">
        <p class="intro">By registering and weaving realities on LoomArt, you agree to the following terms designed to protect both creators and the platform.</p>

        <h3>1. Copyright & Intellectual Property</h3>
        <ul>
          <li><strong>100% Creator Ownership:</strong> You retain full copyright ownership of the original text, games, and 64x64 pixel art artifacts you create.</li>
          <li><strong>Platform Exclusivity:</strong> Experiences built within The Weaver are exclusive to the LoomArt ecosystem. Currently, games cannot be exported to external engines or formats; they live entirely within The Loom.</li>
          <li><strong>Promotional License:</strong> By publishing your work to The Loom, you grant us a royalty-free license to host, display, and promote your creations (including using screenshots, titles, or artwork) on our social media channels and marketing materials to help grow your audience.</li>
        </ul>

        <h3>2. Monetization & Revenue</h3>
        <ul>
          <li><strong>The Launch Threshold (First $500):</strong> LoomArt takes a <strong>0% platform fee</strong> on your first $500 USD in gross lifetime revenue. You keep 100% of your earnings, minus mandatory third-party payment processing fees and applicable international transaction taxes deducted by our global payment gateways.</li>
          <li><strong>Standard Ecosystem Fee:</strong> Once your gross lifetime revenue exceeds $500 USD, LoomArt applies a flat <strong>15% platform fee</strong> on all subsequent sales to maintain server hosting and ecosystem development. You retain the remaining 85% (minus standard third-party processing fees).</li>
          <li><strong>Payout Schedule:</strong> To maximize your profits and minimize the impact of cross-border transfer fees and international bank routing charges, creator balances are pooled and disbursed on a monthly basis. Payouts are automatically initiated at the end of each calendar month. Creators must provide valid banking details to receive these payouts.</li>
        </ul>

        <h3>3. Content Guidelines & Moderation</h3>
        <ul>
          <li><strong>Creative Freedom & NSFW:</strong> We believe in artistic expression. Mature themes, NSFW content, violence, and gore are permitted, <strong>provided they are strictly and accurately tagged</strong> using our Content Warnings system before publishing.</li>
          <li><strong>Strictly Prohibited:</strong> Any illegal content, including but not limited to child exploitation material (CSAM), non-consensual imagery, or active promotion of real-world harm, is strictly banned and will result in immediate termination.</li>
          <li><strong>Moderation Rights:</strong> Our administration team reserves the right to review and remove any content from our database at our sole discretion if we determine it violates these core safety guidelines or misuses the platform.</li>
        </ul>

        <h3>4. Privacy Policy & Data Collection</h3>
        <ul>
          <li><strong>What We Collect:</strong> We collect your email address and username to manage your account. For creators earning revenue, your payment details are collected and stored securely.</li>
          <li><strong>Third-Party Infrastructure:</strong> We utilize Vercel (Frontend hosting), Railway (Backend hosting), and industry-standard global payment processors for secure inbound payments and outbound creator payouts. Your data interacts with these services strictly to facilitate platform functionality.</li>
          <li><strong>Cookies & Security:</strong> We use JSON Web Tokens (JWT) for secure authentication, stored in your session storage. A unique signature is utilized in cookies strictly for keeping your session active and secure, not for invasive third-party tracking.</li>
        </ul>

        <h3>5. Age Requirements</h3>
        <ul>
          <li>By creating an account, you confirm that you are at least 18 years of age, or possess legal parental/guardian consent to use the platform, view potentially mature content, and participate in monetization features.</li>
        </ul>
      </div>
      
      <div class="modal-footer">
        <button class="accept-btn" @click="emit('close')">I Understand</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Your existing CSS remains exactly the same */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: #0f172a;
  border: 1px solid rgba(59, 131, 246, 0.3);
  border-radius: 16px;
  width: 100%;
  max-width: 600px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  color: #e2e8f0;
  font-family: 'Inter', sans-serif;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #93c5fd;
}

.close-btn {
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 1.5rem;
  cursor: pointer;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #f87171;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  line-height: 1.6;
}

.modal-body h3 {
  color: #60a5fa;
  font-size: 1.1rem;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px dashed rgba(59, 131, 246, 0.2);
  padding-bottom: 4px;
}

.modal-body ul {
  padding-left: 1.2rem;
  margin: 0;
}

.modal-body li {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #cbd5e1;
}

.modal-body strong {
  color: #e0e7ff;
}

.intro {
  font-style: italic;
  color: #94a3b8;
  margin-top: 0;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: flex-end;
}

.accept-btn {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.accept-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.modal-body::-webkit-scrollbar {
  width: 8px;
}
.modal-body::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}
.modal-body::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
}
.modal-body::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>