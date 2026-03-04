<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from "vue"
import { useRouter } from "vue-router"

const router = useRouter()
const auraColor = ref("#0077ff") 
const token = sessionStorage.getItem("token")
const userAge = ref(0) // Default to 0 (Restricted) until loaded

// UI States
const showSettings = ref(false)
const showCustomize = ref(false)
const showSidebar = ref(false)

// Search States
const searchQuery = ref("")
const searchResults = ref([])
const isSearching = ref(false)

const settingsView = ref('main'); // Can be 'main', 'aura', 'include', 'exclude'
const includedCategories = ref([]);
const excludedCategories = ref([]);

// Get a flat list of all category names for the UI loops
const allCategoryNames = computed(() => ALL_CATEGORIES.map(c => c.name));

// Reset view when closing settings
watch(showSettings, (newVal) => {
  if (!newVal) settingsView.value = 'main';
});

// Logic: Toggle Include (Mutual Exclusivity)
const toggleInclude = (name) => {
  if (includedCategories.value.includes(name)) {
    includedCategories.value = includedCategories.value.filter(n => n !== name);
  } else {
    includedCategories.value.push(name);
    // Remove from excluded if it exists there
    excludedCategories.value = excludedCategories.value.filter(n => n !== name);
  }
};

// Logic: Toggle Exclude (Mutual Exclusivity)
const toggleExclude = (name) => {
  if (excludedCategories.value.includes(name)) {
    excludedCategories.value = excludedCategories.value.filter(n => n !== name);
  } else {
    excludedCategories.value.push(name);
    // Remove from included if it exists there
    includedCategories.value = includedCategories.value.filter(n => n !== name);
  }
};

const savePreferences = async () => {
  await fetch("http://localhost:5000/user/theme", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ 
      color: auraColor.value,
      includedCategories: includedCategories.value,
      excludedCategories: excludedCategories.value
    })
  });
  showSettings.value = false;
  settingsView.value = 'main';
};

// Update onMounted to fetch the new arrays
onMounted(async () => {
  const res = await fetch("http://localhost:5000/user/theme", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.ok) {
    const data = await res.json();
    auraColor.value = data.themeColor || "#0077ff";
    includedCategories.value = data.includedCategories || [];
    excludedCategories.value = data.excludedCategories || [];
  }
  
  fetchUserAge();
  fetchNotifications();
  notificationInterval = setInterval(fetchNotifications, 30000);
  
  let i = 0;
  messageInterval = setInterval(() => {
    i = (i + 1) % messages.length;
    currentMessage.value = messages[i];
  }, 6000);
});

// --- ICONS & CATEGORY DATA ---
const ICONS = {
  SWORD: "M14.5 17.5L3 6V3h3l11.5 11.5-3 3zM13 13l2.5-2.5M16 16l2.5-2.5M19 19l2.5-2.5",
  MAP: "M20.5 3l-6 3-6-3-5.5 3v15l5.5-3 6 3 6-3V3zM9 17.25l-3 1.5V6.75l3-1.5v12zm6 0l-3 1.5V6.75l3-1.5v12z",
  SHIELD: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  BRAIN: "M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7zM9 21v-1h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z",
  GEAR: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84a.484.484 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.488.488 0 0 0-.59.22L2.74 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32a.488.488 0 0 0 .59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.58 1.62-.94l2.39.96a.488.488 0 0 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
  GHOST: "M9 22v-3h6v3h-6zm3-18c3.87 0 7 3.13 7 7v7h-2v-2h-2v2h-2v-2h-2v2H9v-2H7v2H5v-7c0-3.87 3.13-7 7-7z",
  HEART: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
  MASK: "M2 6c0-1.5 1.5-3 4-3h12c2.5 0 4 1.5 4 3v8c0 3-3 6-10 6S2 17 2 14V6zm5 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  STAR: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  ROCKET: "M12 2.5s-4 6-4 12c0 3.5 2.5 5.5 4 5.5s4-2 4-5.5c0-6-4-12-4-12zM12 22s-2 2-5 0c0 0 1.5-3 2-5h6c.5 2 2 5 2 5s-3 2-5 0z",
  LEAF: "M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z",
  SMILE: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z",
  TRAGEDY: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-12.5c1.38 0 2.5 1.12 2.5 2.5S13.38 12.5 12 12.5 9.5 11.38 9.5 10 10.62 7.5 12 7.5zm0 9c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z",
  SKULL: "M12 2c4.42 0 8 3.58 8 8 0 2.88-1.55 5.39-3.87 6.77L16 19h-1v3h-6v-3H8l-.13-2.23A7.994 7.994 0 0 1 4 10c0-4.42 3.58-8 8-8z",
  BALL: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z",
  NOTE: "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z",
  BOOK: "M4 6v13h16V6c0-2.21-1.79-4-4-4H8c-2.21 0-4 1.79-4 4zm16 11H4v-1h16v1z",
  PUZZLE: "M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z",
  ZZZ: "M19 13h-8v-2h8v2zm-2-6H9v2h8V7zm-4 12H9v-2h4v2z",
  WARNING: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
  EYE: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
  CLOCK: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z",
  CLOUD: "M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"
};

// 1. Master Category List (Sorted by group logic)
const ALL_CATEGORIES = [
  // --- GENRES ---
  { name: "Action", path: ICONS.SWORD, color: "#ef4444", group: "Genres" },
  { name: "Adventure", path: ICONS.MAP, color: "#f97316", group: "Genres" },
  { name: "RPG", path: ICONS.SHIELD, color: "#eab308", group: "Genres" },
  { name: "Strategy", path: ICONS.BRAIN, color: "#84cc16", group: "Genres" },
  { name: "Simulation", path: ICONS.GEAR, color: "#10b981", group: "Genres" },
  { name: "Horror", path: ICONS.GHOST, color: "#7f1d1d", group: "Genres" },
  { name: "Romance", path: ICONS.HEART, color: "#ec4899", group: "Genres" },
  { name: "Mystery", path: ICONS.MASK, color: "#6366f1", group: "Genres" },
  { name: "Fantasy", path: ICONS.STAR, color: "#a855f7", group: "Genres" },
  { name: "Sci-Fi", path: ICONS.ROCKET, color: "#06b6d4", group: "Genres" },
  { name: "Slice of Life", path: ICONS.LEAF, color: "#f472b6", group: "Genres" },
  { name: "Comedy", path: ICONS.SMILE, color: "#fbbf24", group: "Genres" },
  { name: "Drama", path: ICONS.TRAGEDY, color: "#9f1239", group: "Genres" },
  { name: "Thriller", path: ICONS.SKULL, color: "#be123c", group: "Genres" },
  { name: "Sports", path: ICONS.BALL, color: "#22c55e", group: "Genres" },
  { name: "Music", path: ICONS.NOTE, color: "#3b82f6", group: "Genres" },
  { name: "Educational", path: ICONS.BOOK, color: "#64748b", group: "Genres" },
  { name: "Puzzle", path: ICONS.PUZZLE, color: "#a855f7", group: "Genres" },
  { name: "Idle", path: ICONS.ZZZ, color: "#94a3b8", group: "Genres" },

  // --- SETTINGS (Sub-Genres) ---
  { name: "Cyberpunk", path: "M2 9h20v6H2z", color: "#0ea5e9", group: "Settings" },
  { name: "Steampunk", path: ICONS.GEAR, color: "#78350f", group: "Settings" },
  { name: "Dieselpunk", path: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58", color: "#52525b", group: "Settings" },
  { name: "Solarpunk", path: ICONS.LEAF, color: "#bef264", group: "Settings" },
  { name: "Dystopian", path: ICONS.WARNING, color: "#57534e", group: "Settings" },
  { name: "Post-Apocalyptic", path: ICONS.SKULL, color: "#44403c", group: "Settings" },
  { name: "Space Opera", path: ICONS.ROCKET, color: "#4c1d95", group: "Settings" },
  { name: "Mecha", path: "M12 2L2 22h20L12 2zm0 4l6 12H6l6-12z", color: "#64748b", group: "Settings" },
  { name: "Noir", path: ICONS.MASK, color: "#171717", group: "Settings" },
  { name: "Neo-Noir", path: ICONS.MASK, color: "#2563eb", group: "Settings" },
  { name: "Western", path: ICONS.STAR, color: "#92400e", group: "Settings" },
  { name: "Historical", path: ICONS.BOOK, color: "#b45309", group: "Settings" },
  { name: "Alternate History", path: ICONS.CLOCK, color: "#d97706", group: "Settings" },
  { name: "Urban Fantasy", path: "M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10z", color: "#6d28d9", group: "Settings" },
  { name: "Dark Fantasy", path: ICONS.GHOST, color: "#4c0519", group: "Settings" },
  { name: "High Fantasy", path: ICONS.SWORD, color: "#c026d3", group: "Settings" },
  { name: "Isekai", path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z", color: "#d946ef", group: "Settings" },
  { name: "Supernatural", path: ICONS.EYE, color: "#4c0519", group: "Settings" },
  { name: "Paranormal", path: ICONS.GHOST, color: "#831843", group: "Settings" },
  { name: "Magic Realism", path: ICONS.STAR, color: "#db2777", group: "Settings" },
  { name: "Mythology", path: "M4 6v13h16V6c0-2.21-1.79-4-4-4H8c-2.21 0-4 1.79-4 4zm16 11H4v-1h16v1z", color: "#eab308", group: "Settings" },
  { name: "Folklore", path: ICONS.BOOK, color: "#a16207", group: "Settings" },
  { name: "Superhero", path: ICONS.SHIELD, color: "#dc2626", group: "Settings" },
  { name: "Martial Arts", path: "M14.5 17.5L3 6V3h3l11.5 11.5-3 3z", color: "#b91c1c", group: "Settings" },
  { name: "Military", path: ICONS.SHIELD, color: "#3f6212", group: "Settings" },
  { name: "War", path: "M12 2L2 22h20L12 2zm0 4l6 12H6l6-12z", color: "#3f6212", group: "Settings" },
  { name: "Espionage", path: ICONS.EYE, color: "#1e293b", group: "Settings" },

  // --- NARRATIVE ---
  { name: "Visual Novel", path: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z", color: "#db2777", group: "Narrative" },
  { name: "Interactive Fiction", path: ICONS.BOOK, color: "#4b5563", group: "Narrative" },
  { name: "Kinetic Novel", path: "M8 5v14l11-7z", color: "#2563eb", group: "Narrative" },
  { name: "Dating Sim", path: ICONS.HEART, color: "#f43f5e", group: "Narrative" },
  { name: "Otome", path: ICONS.LEAF, color: "#fb7185", group: "Narrative" },
  { name: "Galge", path: ICONS.HEART, color: "#f472b6", group: "Narrative" },
  { name: "Text-Based", path: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H9v-2h6v2zm3-5H9v-2h9v2zm0-5H9V6h9v2z", color: "#334155", group: "Narrative" },
  { name: "Point & Click", path: "M12 2L2 22l5-2 5 2 5-2 5 2z", color: "#6366f1", group: "Narrative" },
  { name: "Choice Matters", path: "M12 2L2 12h20L12 2zm0 20l10-10H2l10 10z", color: "#14b8a6", group: "Narrative" },
  { name: "Multiple Endings", path: "M22 11V3h-7v3H9V3H2v8h7V8h2v10h4v3h7v-8h-7v3h-2V8h2v3z", color: "#14b8a6", group: "Narrative" },
  { name: "Episodic", path: "M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z", color: "#8b5cf6", group: "Narrative" },

  // --- THEMES ---
  { name: "Psychological", path: ICONS.BRAIN, color: "#7c3aed", group: "Themes" },
  { name: "Philosophical", path: ICONS.BOOK, color: "#6d28d9", group: "Themes" },
  { name: "Surreal", path: ICONS.EYE, color: "#a21caf", group: "Themes" },
  { name: "Abstract", path: "M12 2L2 22h20L12 2z", color: "#64748b", group: "Themes" },
  { name: "Cozy", path: ICONS.CLOUD, color: "#d97706", group: "Themes" },
  { name: "Wholesome", path: ICONS.SMILE, color: "#f59e0b", group: "Themes" },
  { name: "Relaxing", path: ICONS.CLOUD, color: "#60a5fa", group: "Themes" },
  { name: "Atmospheric", path: ICONS.CLOUD, color: "#94a3b8", group: "Themes" },
  { name: "Tragedy", path: ICONS.TRAGEDY, color: "#881337", group: "Themes" },
  { name: "Satire", path: ICONS.SMILE, color: "#b45309", group: "Themes" },
  { name: "Parody", path: ICONS.SMILE, color: "#d97706", group: "Themes" },
  { name: "Memes", path: ICONS.SMILE, color: "#16a34a", group: "Themes" },
  { name: "Dark Humor", path: ICONS.SKULL, color: "#374151", group: "Themes" },
  { name: "Coming of Age", path: ICONS.LEAF, color: "#84cc16", group: "Themes" },
  { name: "School Life", path: ICONS.BOOK, color: "#3b82f6", group: "Themes" },
  { name: "Workplace", path: "M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z", color: "#475569", group: "Themes" },
  { name: "Medical", path: "M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z", color: "#ef4444", group: "Themes" },
  { name: "Legal", path: "M2 22h20V2z", color: "#78350f", group: "Themes" },
  { name: "Crime", path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z", color: "#b91c1c", group: "Themes" },
  { name: "Detective", path: ICONS.MASK, color: "#525252", group: "Themes" },
  { name: "Survival", path: ICONS.MAP, color: "#166534", group: "Themes" },
  { name: "Battle Royale", path: ICONS.SWORD, color: "#991b1b", group: "Themes" },
  { name: "Time Travel", path: ICONS.CLOCK, color: "#0d9488", group: "Themes" },

  // --- MATURE ---
  { name: "18+ (NSFW)", path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z", color: "#ef4444", isMature: true, group: "Mature" },
  { name: "Violence", path: ICONS.SWORD, color: "#991b1b", isMature: true, group: "Mature" },
  { name: "Gore", path: ICONS.SKULL, color: "#7f1d1d", isMature: true, group: "Mature" },
  { name: "Body Horror", path: ICONS.GHOST, color: "#450a0a", isMature: true, group: "Mature" },
  { name: "LGBTQ+", path: ICONS.HEART, color: "#eab308", group: "Mature" },
  { name: "BL (Boys' Love)", path: ICONS.HEART, color: "#3b82f6", isMature: true, group: "Mature" },
  { name: "GL (Girls' Love)", path: ICONS.HEART, color: "#ec4899", isMature: true, group: "Mature" },
  { name: "Harem", path: ICONS.HEART, color: "#db2777", isMature: true, group: "Mature" },
  { name: "Vampire", path: ICONS.GHOST, color: "#9f1239", isMature: true, group: "Mature" },
  { name: "Werewolf", path: ICONS.GHOST, color: "#57534e", isMature: true, group: "Mature" },
  { name: "Zombies", path: ICONS.SKULL, color: "#166534", isMature: true, group: "Mature" },
  { name: "Lovecraftian", path: ICONS.EYE, color: "#064e3b", isMature: true, group: "Mature" },
  { name: "Gothic", path: "M12 2L2 22h20L12 2z", color: "#000000", isMature: true, group: "Mature" }
];

const WARNING_OPTIONS = [
  "Sexual Content", "Graphic Violence", "Strong Language", "Substance Abuse", 
  "Self-Harm", "Nudity", "Flashing Lights", "Jump Scares", "Trauma / PTSD",
  "Suicide / Suicidal Ideation", "Sexual Assault / Non-Con", "Domestic Abuse", 
  "Child Abuse", "Animal Cruelty", "Gambling", "Eating Disorders", 
  "Body Dysmorphia", "Gaslighting", "Stalking", "Kidnapping / Abduction", 
  "Hate Speech / Discrimination", "Misogyny / Sexism", "Racism", 
  "Homophobia / Transphobia", "Religious Iconography / Cults",
  "Claustrophobia", "Arachnophobia (Spiders)", "Thalassophobia (Deep Water)", 
  "Trypophobia (Holes)", "Emetic / Vomiting"
];

// 2. Selection Logic
const selectedCategories = ref([]);

const availableCategories = computed(() => {
  return ALL_CATEGORIES.filter(cat => {
    // 1. Hide if already selected
    if (selectedCategories.value.find(c => c.name === cat.name)) return false;
    
    // 2. Hide if user is underage and tag is mature
    if (userAge.value < 18 && cat.isMature) return false;

    // 3. Hide if tab doesn't match (unless 'All')
    if (activeTab.value !== 'All' && cat.group !== activeTab.value) return false;
    
    // 4. Special case: Don't show 'Mature' group in 'All' tab if user is < 18 (Redundant but safe)
    if (activeTab.value === 'All' && cat.group === 'Mature' && userAge.value < 18) return false;

    return true;
  });
});

/* --- FEED ENGINE STATE --- */
const exploreWeaves = ref([]);
const isLoadingFeed = ref(true);

// Pagination State
const currentPage = ref(1);
const totalPages = ref(1);

const loadGoogleFont = (fontFamily) => {
  if (!fontFamily || fontFamily === 'sans-serif' || fontFamily === 'Inter') return;
  const fontId = `font-${fontFamily.replace(/\s+/g, '-')}`;
  if (!document.getElementById(fontId)) {
    const link = document.createElement('link');
    link.id = fontId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}&display=swap`;
    document.head.appendChild(link);
  }
};

const fetchExploreWeaves = async (page = 1) => {
  isLoadingFeed.value = true;
  currentPage.value = page; 
  
  try {
    let url = `http://localhost:5000/publish/explore?page=${page}&limit=12`;
    
    // 🚀 FIX: If tags are selected, join them with commas and send to the backend
    if (selectedCategories.value.length > 0) {
      const catNames = selectedCategories.value.map(c => c.name).join(',');
      url += `&categories=${encodeURIComponent(catNames)}`;
    }
    
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      exploreWeaves.value = data.weaves; 
      totalPages.value = data.totalPages; 
    }
  } catch (err) {
    console.error("Failed to connect to the feed engine", err);
  } finally {
    isLoadingFeed.value = false;
  }
};

// 🚀 FIX: Push the full category object into the array and fetch
const selectCategory = (catName) => {
  const fullCat = ALL_CATEGORIES.find(c => c.name === catName);
  // Ensure it's not already in the list to prevent duplicates
  if (fullCat && !selectedCategories.value.some(c => c.name === catName)) {
    selectedCategories.value.push(fullCat);
    fetchExploreWeaves(1); 
  }
};

// 🚀 FIX: Remove the category from the array and fetch
const deselectCategory = (index) => {
  selectedCategories.value.splice(index, 1);
  fetchExploreWeaves(1);
};

// 🚀 NEW: Page Change Handler
const changePage = (newPage) => {
  if (newPage >= 1 && newPage <= totalPages.value) {
    fetchExploreWeaves(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll user back to top of feed
  }
};

// Auto-load fonts for incoming feed items
watch(exploreWeaves, (newWeaves) => {
  newWeaves.forEach(w => {
    if (w.titleFont) loadGoogleFont(w.titleFont);
  });
});

// Auto-load fonts for incoming feed items
watch(exploreWeaves, (newWeaves) => {
  newWeaves.forEach(w => {
    if (w.titleFont) loadGoogleFont(w.titleFont);
  });
});

// ... Notification Logic ...
const showNotifications = ref(false)
const notifications = ref([])
const unreadCount = ref(0)
let notificationInterval

const categoryTabs = ['All', 'Genres', 'Settings', 'Narrative', 'Themes', 'Mature']
const activeTab = ref('All')

const fetchNotifications = async () => {
  try {
    const res = await fetch("http://localhost:5000/notifications", {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      notifications.value = data.alerts
      unreadCount.value = data.unreadCount
    }
  } catch (e) {}
}

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
  if (showNotifications.value) markRead()
}

const markRead = async () => {
  if (unreadCount.value > 0) {
    unreadCount.value = 0
    await fetch("http://localhost:5000/notifications/read", {
        method: "PUT", headers: { Authorization: `Bearer ${token}` }
    }).catch(e => {})
  }
}

const handleNotificationClick = (alert) => {
  showNotifications.value = false
  if (alert.link) router.push(alert.link)
}

// ... Message Rotation Logic ...
const messages = [
  "Weave your path, traveler.",
  "The third eye sees what the mind ignores. 👁️",
  "Align with the universe; let the smoke clear the way.",
  "A quiet spark ignites a thousand endings.",
  "The herb of the earth reveals the patterns of the loom.",
  "Breathe deep. The Great Weaver is listening.",
  "Expand your consciousness to unlock the hidden gates.",
  "The ✨Weavers✨ are listening.",
  "Realms beyond the veil await your discovery.",
  "Higher vibrations lead to deeper stories. 🍃",
  "Pookie the cosmic cat says hello!",
  "Woof meow?",
  "Look at you... so mystical!",
  "Searching for my magical comb, these weaves don't style themselves!",
  "Blessed be thy feet, that they might walk this path -Darryl, The Midnight Gospel"
]
const currentMessage = ref(messages[0])
let messageInterval

const handleSearch = async () => {
  if (searchQuery.value.length < 2) {
    searchResults.value = []
    return
  }
  isSearching.value = true
  try {
    const res = await fetch(`http://localhost:5000/search/suggestions?q=${searchQuery.value}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      searchResults.value = await res.json()
    }
  } catch (err) {
    console.error("Search failed", err)
  } finally {
    isSearching.value = false
  }
}

const handleResultClick = (item) => {
  if (item.type === 'user') router.push(`/user/${item.id}`)
  else router.push(`/post/${item.id}`)
}

const goToSearchPage = () => {
  if (searchQuery.value.trim().length > 0) {
    router.push({ name: 'Search', query: { q: searchQuery.value } })
    searchResults.value = [] 
  }
}

let timeout
watch(searchQuery, () => {
  clearTimeout(timeout)
  timeout = setTimeout(handleSearch, 300)
})

const showNSFW = ref(localStorage.getItem("showNSFW") === "true");

// Save preference automatically when toggled
watch(showNSFW, (newVal) => {
  localStorage.setItem("showNSFW", newVal);
});

const fetchUserAge = async () => {
  try {
    const res = await fetch("http://localhost:5000/user/me", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const u = await res.json();
      userAge.value = u.age || 0; 
    }
  } catch(e) {}
}

const saveColor = async () => {
  await fetch("http://localhost:5000/user/theme", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ color: auraColor.value })
  })
  showCustomize.value = false
}

onMounted(async () => {
  const res = await fetch("http://localhost:5000/user/theme", {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (res.ok) {
    const data = await res.json()
    auraColor.value = data.themeColor || "#0077ff"
  }
  
  fetchUserAge();
  fetchNotifications()
  notificationInterval = setInterval(fetchNotifications, 30000)
  
  let i = 0
  messageInterval = setInterval(() => {
    i = (i + 1) % messages.length
    currentMessage.value = messages[i]
  }, 6000)

  fetchExploreWeaves()
})

onUnmounted(() => {
  clearInterval(messageInterval)
  clearInterval(notificationInterval)
})
</script>

<template>
  <div class="loom-container" :style="{ '--aura': auraColor }">
    
    <div class="soul-container">
      <div class="outer-orbit">
        <div class="inner-soul"></div>
      </div>
    </div>

    <nav class="header-nav">
      <div class="nav-top-row">
        <div class="nav-left">
          <button class="menu-toggle" @click="showSidebar = !showSidebar" style="display: none;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
              <path d="M3 12h18M3 6h18M3 18h18" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="branding">
          <h1 class="loom-title">LoomArt</h1>
          <Transition name="fade-slide" mode="out-in">
            <p :key="currentMessage" class="loom-status">{{ currentMessage }}</p>
          </Transition>
        </div>
        
        <div class="desktop-spacer"></div>
      </div>

      <div class="nav-actions">
        <button class="aura-btn" @click="router.push('/console')" title="My Console">
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
             <rect x="2" y="6" width="20" height="12" rx="2"></rect>
             <line x1="6" y1="12" x2="10" y2="12"></line>
             <line x1="8" y1="10" x2="8" y2="14"></line>
             <line x1="15" y1="13" x2="15.01" y2="13"></line>
             <line x1="18" y1="11" x2="18.01" y2="11"></line>
          </svg>
        </button>
        <button class="aura-btn" title="Whispers">
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.5">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>

        <div class="notification-wrapper">
          <button 
            class="aura-btn bell-btn" 
            :class="{ 'oscillating': unreadCount > 0 }"
            @click="toggleNotifications" 
            title="Omens"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            
            <span v-if="unreadCount > 0" class="red-dot"></span>
          </button>

          <Transition name="fade-slide">
            <div v-if="showNotifications" class="notifications-dropdown glass-panel">
              <div class="notif-header">
                <h3>Omens</h3>
                <span v-if="notifications.length > 0" class="clear-all" @click="markRead">Mark all read</span>
              </div>

              <div v-if="notifications.length === 0" class="empty-notif">
                <p>The winds are silent.</p>
              </div>

              <ul v-else class="notif-list">
                <li 
                  v-for="alert in notifications" 
                  :key="alert._id" 
                  class="notif-item" 
                  :class="{ 'unread': !alert.isRead }"
                  @click="handleNotificationClick(alert)"
                >
                  <div class="notif-avatar">
                    <img v-if="alert.sender.profilePic" :src="alert.sender.profilePic" />
                    <span v-else>{{ alert.sender.username.charAt(0) }}</span>
                  </div>
                  <div class="notif-content">
                    <p>{{ alert.message }}</p>
                    <span class="notif-time">{{ new Date(alert.createdAt).toLocaleDateString() }}</span>
                  </div>
                  <div v-if="!alert.isRead" class="unread-indicator"></div>
                </li>
              </ul>
            </div>
          </Transition>
        </div>

        <button class="aura-btn" @click="router.push('/profile')" title="Your Essence">
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>
        <div class="nsfw-toggle-wrapper" title="Toggle NSFW Thumbnails">
            <span class="nsfw-label">NSFW</span>
            <label class="switch">
              <input type="checkbox" v-model="showNSFW">
              <span class="slider"></span>
            </label>
          </div>
        <div class="settings-wrapper">
          <button class="aura-btn" @click="showSettings = !showSettings">
            <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          
          <Transition name="fade">
            <div v-if="showSettings" class="dropdown advanced-dropdown">
              
              <div v-if="settingsView === 'main'" class="settings-menu">
                  <h4 class="menu-title">Control</h4>
                  <button @click="settingsView = 'aura'">✧ Adjust Aura</button>
                  <button @click="settingsView = 'include'">✓ Include Categories</button>
                  <button @click="settingsView = 'exclude'">✕ Exclude Categories</button>
              </div>

              <div v-else-if="settingsView === 'aura'" class="color-picker">
                <h4 class="menu-title">Aura Color</h4>
                <input type="color" v-model="auraColor" class="aura-input" />
                <div class="settings-actions">
                    <button class="small-link" @click="settingsView = 'main'">Back</button>
                    <button class="primary-btn" @click="savePreferences">Bind</button>
                </div>
              </div>

              <div v-else-if="settingsView === 'include'" class="category-picker">
                <h4 class="menu-title">Include List</h4>
                <p class="settings-hint">Prioritize these in your feed.</p>
                <div class="cat-list">
                    <button
                        v-for="name in allCategoryNames"
                        :key="'inc-'+name"
                        class="cat-toggle-btn"
                        :class="{ 'included-active': includedCategories.includes(name) }"
                        @click="toggleInclude(name)"
                    >
                        {{ name }}
                    </button>
                </div>
                <div class="settings-actions">
                    <button class="small-link" @click="settingsView = 'main'">Back</button>
                    <button class="primary-btn" @click="savePreferences">Bind</button>
                </div>
              </div>

              <div v-else-if="settingsView === 'exclude'" class="category-picker">
                
                <div class="scrollable-picker">
                  <h4 class="menu-title">Exclude Categories</h4>
                  <p class="settings-hint">Hide these from your feed.</p>
                  <div class="cat-list-inline">
                      <button
                          v-for="name in allCategoryNames"
                          :key="'exc-'+name"
                          class="cat-toggle-btn"
                          :class="{ 'excluded-active': excludedCategories.includes(name) }"
                          @click="toggleExclude(name)"
                      >
                          {{ name }}
                      </button>
                  </div>

                  <h4 class="menu-title mt-15">Content Warnings</h4>
                  <p class="settings-hint">Hide weaves containing these triggers.</p>
                  <div class="cat-list-inline">
                      <button
                          v-for="warn in WARNING_OPTIONS"
                          :key="'exc-warn-'+warn"
                          class="cat-toggle-btn"
                          :class="{ 'excluded-active': excludedCategories.includes(warn) }"
                          @click="toggleExclude(warn)"
                      >
                          ⚠️ {{ warn }}
                      </button>
                  </div>
                </div>

                <div class="settings-actions">
                    <button class="small-link" @click="settingsView = 'main'">Back</button>
                    <button class="primary-btn" @click="savePreferences">Bind</button>
                </div>
              </div>

            </div>
          </Transition>
        </div>

        <button class="create-btn" @click="router.push('/create')" title="Weave New Thread">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

      </div>
    </nav>
    <div class="search-band">
      <div class="search-container">
        
        <div class="input-wrapper">
          <span class="search-icon">🔍</span>
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="Seek the unknown..." 
            class="mystic-input"
            @keyup.enter="goToSearchPage" 
          />
          <button class="go-btn" @click="goToSearchPage" v-if="searchQuery.length > 0">→</button>
        </div>

        <Transition name="fade">
          <div v-if="searchResults.length > 0 || isSearching" class="search-results">
            
            <div v-if="isSearching" class="search-loading">
              <span class="tiny-spinner"></span> Searching the threads...
            </div>
            
            <div 
              v-else 
              v-for="item in searchResults" 
              :key="item.id" 
              class="search-item"
              :class="item.type"
              @click="handleResultClick(item)"
            >
              
              <div v-if="item.type === 'publish'" class="content-row">
                 <div class="mini-thumb" :style="{ backgroundImage: item.image ? `url(${item.image})` : 'none', backgroundColor: '#111' }"></div>
                 <div class="text-col">
                   <span class="main-text">{{ item.mainText }}</span>
                   <span class="sub-text">{{ item.subText }}</span>
                 </div>
              </div>

              <div v-else class="content-row user-row">
                 <span class="user-prefix">u/</span>
                 <span class="main-text user-text">{{ item.mainText }}</span>
              </div>

            </div>

          </div>
        </Transition>
      </div>
    </div>
    <div class="category-band">
      
      <TransitionGroup name="list" tag="div" class="selected-tags" v-if="selectedCategories.length > 0">
        <button 
          v-for="(cat, index) in selectedCategories" 
          :key="cat.name" 
          class="cat-chip active"
          :style="{ 
            '--cat-color': cat.color, 
            borderColor: cat.color 
          }"
          @click="deselectCategory(index)"
        >
          <svg class="cat-icon" viewBox="0 0 24 24" fill="currentColor">
            <path :d="cat.path" />
          </svg>
          
          {{ cat.name }}
          <span class="close-x">×</span>
        </button>
      </TransitionGroup>

      <div class="available-tags-wrapper">
        <div class="available-tags">
          <button 
            v-for="cat in availableCategories" 
            :key="cat.name" 
            class="cat-chip"
            :style="{ '--cat-color': cat.color }"
            @click="selectCategory(cat.name)"
          >
            <svg class="cat-icon" viewBox="0 0 24 24" fill="currentColor">
              <path :d="cat.path" />
            </svg>
            {{ cat.name }}
          </button>
        </div>
        <div class="scroll-fade"></div>
      </div>

    </div>
    <Transition name="slide-in">
      <aside v-if="showSidebar" class="sidebar">
        <div class="sidebar-header">
           <button class="close-sidebar" @click="showSidebar = false">✕</button>
        </div>
        <div class="sidebar-content">
          <h3>The Loom</h3>
          <ul>
            <li @click="router.push('/recent')">Recent</li>
            <li @click="router.push('/trending')">Trending</li>
            <li @click="router.push('/explore')">Explore</li>
            <li @click="router.push('/popular')">Popular</li>
            <li @click="router.push('/verified')">Verified weavers</li>
            <li class="logout" @click="router.push('/login')">Disconnect</li>
          </ul>
        </div>
      </aside>
    </Transition>
    <Transition name="fade">
      <div v-if="showSidebar" class="sidebar-overlay" @click="showSidebar = false"></div>
    </Transition>

    <main class="loom-void">
      <div v-if="isLoadingFeed" class="feed-loading">
        <div class="spinner large"></div>
        <p>Consulting the Loom Gods for you...</p>
      </div>
      
      <div v-else-if="exploreWeaves.length === 0" class="empty-feed">
        <p>The void is silent. Try adjusting your filters or selecting a different category.</p>
      </div>

      <div v-else class="feed-grid">
        <div 
          v-for="weave in exploreWeaves" 
          :key="weave._id" 
          class="weave-card glass-panel"
          @click="router.push(`/post/${weave._id}`)"
        >
          <div class="weave-thumb" :style="{ backgroundImage: `url(${weave.thumbnail || '/placeholder.jpg'})` }">
             
             <div v-if="!showNSFW && weave.isThumbnailNSFW" class="nsfw-overlay">
                <span class="nsfw-text">NSFW</span>
             </div>

             <div v-if="weave.monetization?.isPaid" class="premium-badge">Premium</div>
          </div>
          
          <div class="weave-info">
             <h3 class="weave-title" :style="{ fontFamily: weave.titleFont || 'Cinzel' }">{{ weave.name }}</h3>
             <span class="weave-author">by @{{ weave.authorName }}</span>
             
             <div class="weave-stats">
                <span title="Likes">❤️ {{ weave.likes || 0 }}</span>
                <span title="Plays">▶️ {{ weave.plays || 0 }}</span>
                <span title="Visits">👁️ {{ weave.visits || 0 }}</span>
             </div>
             
             <div class="weave-tags">
               <span v-for="cat in weave.categories.slice(0, 3)" :key="cat" class="mini-tag">{{ cat }}</span>
             </div>
          </div>
        </div>
      </div>

      <div v-if="!isLoadingFeed && totalPages > 1" class="pagination-controls">
        <button 
          @click="changePage(currentPage - 1)" 
          :disabled="currentPage === 1"
          class="page-btn"
        >
          &larr; Previous
        </button>
        
        <span class="page-indicator">Page {{ currentPage }} of {{ totalPages }}</span>
        
        <button 
          @click="changePage(currentPage + 1)" 
          :disabled="currentPage === totalPages"
          class="page-btn"
        >
          Next &rarr;
        </button>
      </div>
      
    </main>
  </div>
</template>

<style scoped>
.loom-container {
  min-height: 100vh;
  background-color: #050508;
  color: #f0f0f0;
  font-family: 'Cinzel', serif;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  z-index: 1; 
}

/* --- THE LIVING CORE (Background) --- */
.soul-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  height: 600px;
  pointer-events: none;
  z-index: 0; 
  display: flex;
  align-items: center;
  justify-content: center;
}

.outer-orbit {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.03);
  background: radial-gradient(circle, rgba(255,255,255,0.01) 0%, transparent 60%);
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform, opacity; 
  animation: breathe 8s ease-in-out infinite; 
}

.inner-soul {
  width: 300px;
  height: 300px;
  background: var(--aura);
  opacity: 0.2;
  border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
  filter: blur(60px);
  will-change: transform, translate, border-radius; 
  animation: 
    breathe 8s ease-in-out infinite,
    wander 20s linear infinite alternate,
    morph 10s ease-in-out infinite alternate;
}

/* --- RESPONSIVE HEADER --- */
.header-nav {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 3%;
  z-index: 10;
  position: relative;
  background: rgba(5, 5, 8, 0.2);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  /* The First Line: Below the Main Title Header */
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-wrap: wrap;
}

.header-nav::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 5%; right: 5%;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
}

.nav-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: auto;
  flex-grow: 1;
}

.nav-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  align-items: center;
}

.menu-toggle {
  background: transparent; border: none; cursor: pointer; padding: 0.5rem;
}
.menu-toggle svg { width: 32px; height: 32px; filter: drop-shadow(0 0 5px rgba(255,255,255,0.5)); }

.branding {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  pointer-events: none;
}

.loom-title {
  font-size: clamp(1.8rem, 4vw, 2.5rem);
  font-weight: 500;
  letter-spacing: 0.3rem;
  margin: 0;
  color: #fff;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.5), 0 0 50px var(--aura);
}

.loom-status {
  font-family: 'Didot', serif;
  font-style: italic;
  font-size: clamp(0.8rem, 2vw, 1rem);
  color: #ccc;
  margin-top: 0.2rem;
  min-height: 1.4em;
}

.aura-btn {
  background: transparent; border: none; cursor: pointer; padding: 8px; border-radius: 50%; transition: background 0.3s;
}
.aura-btn svg { width: 24px; height: 24px; filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.6)); }
.aura-btn:hover { background: rgba(255,255,255,0.1); }

.create-btn {
  background-color: var(--aura);
  border: none;
  border-radius: 50%;
  width: 45px;
  height: 45px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 0 15px var(--aura);
  margin-left: 0.5rem;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.create-btn svg { width: 24px; height: 24px; filter: drop-shadow(0 0 2px rgba(0,0,0,0.5)); }
.create-btn:hover { transform: scale(1.15) rotate(90deg); box-shadow: 0 0 30px var(--aura), inset 0 0 10px rgba(255,255,255,0.5); }
.desktop-spacer { width: 40px; }

/* --- SEARCH BAND --- */
.search-band {
  width: 100%;
  position: relative;
  z-index: 9;
  background: rgba(5, 5, 8, 0.15);
  backdrop-filter: blur(15px);
  display: flex;
  justify-content: center;
  padding: 1rem 0;
}

/* The Second Line: Below the Search Bar */
.search-band::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 10%; right: 10%; /* Slightly shorter than the main header line */
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%);
}

.search-container {
  position: relative;
  width: 100%;
  max-width: 500px;
  margin: 0 1rem;
}

.input-wrapper {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50px;
  padding: 0.4rem 1rem; /* Compact padding */
  transition: all 0.3s ease;
  position: relative;
}

.go-btn {
  background: rgba(255,255,255,0.1);
  border: none;
  color: white;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 10px;
  transition: 0.2s;
}
.go-btn:hover { background: var(--aura); }

.input-wrapper:focus-within {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--aura);
  box-shadow: 0 0 15px rgba(0,0,0,0.5);
}

.search-icon {
  margin-right: 0.5rem;
  opacity: 0.6;
}

.mystic-input {
  background: transparent;
  border: none;
  color: #fff;
  font-family: 'Cinzel', serif;
  font-size: 1rem;
  width: 100%;
  outline: none;
}
.mystic-input::placeholder {
  color: rgba(255,255,255,0.4);
  font-style: italic;
}

/* --- Search Results Dropdown --- */
.search-results {
  position: absolute;
  top: 115%; /* Slight gap from input */
  left: 0;
  width: 100%;
  background: #0a0a0c; /* Solid dark background for readability */
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 8px 0;
  box-shadow: 0 10px 40px rgba(0,0,0,0.9);
  max-height: 450px; /* Space for ~10 items */
  overflow-y: auto;
}

/* --- LIST ITEMS --- */
.search-item {
  padding: 12px 18px; /* More breathing room */
  cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  transition: all 0.1s;
}
.search-item:last-child { border-bottom: none; }
.search-item:hover { background: rgba(255,255,255,0.08); }

.content-row { display: flex; align-items: center; gap: 14px; }

/* --- PUBLISH STYLES (Aura Highlight) --- */
.search-item.publish {
  border-left: 3px solid var(--aura); /* Subtle Aura Highlight */
  background: linear-gradient(90deg, rgba(255,255,255,0.02), transparent);
}
.search-item.publish:hover {
  background: linear-gradient(90deg, rgba(255,255,255,0.1), transparent);
}

.mini-thumb {
  width: 40px; /* Larger thumb */
  height: 40px;
  border-radius: 6px;
  background-size: cover;
  background-position: center;
  border: 1px solid rgba(255,255,255,0.1);
}

.text-col { display: flex; flex-direction: column; justify-content: center; }
.main-text { font-size: 1rem; color: #eee; font-family: 'Inter', sans-serif; font-weight: 600; line-height: 1.2; }
.sub-text { font-size: 0.75rem; color: #888; font-family: 'Inter', sans-serif; margin-top: 2px; }

/* --- USER STYLES (Minimal & Larger) --- */
.search-item.user {
  padding-left: 24px; /* Slight indent to differentiate from highlighted projects */
}
.user-row { gap: 4px; align-items: baseline; }
.user-prefix { color: #666; font-size: 0.9rem; font-family: 'Inter', sans-serif; font-weight: 700; }
.user-text { color: #ccc; font-weight: 500; font-size: 1.05rem; } /* Slightly larger for users */

.search-loading {
  padding: 15px;
  text-align: center;
  font-size: 0.9rem;
  color: #888;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.tiny-spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.1);
  border-top-color: var(--aura);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* --- SIDEBAR --- */
.sidebar {
  position: fixed; top: 0; left: 0; width: 280px; height: 100vh;
  background: rgba(10, 10, 15, 0.95); backdrop-filter: blur(20px);
  border-right: 1px solid rgba(255,255,255,0.05); z-index: 100;
  padding: 2rem; box-shadow: 10px 0 30px rgba(0,0,0,0.5);
  display: flex; flex-direction: column;
}
.sidebar-header { display: flex; justify-content: flex-end; margin-bottom: 2rem; }
.close-sidebar { background: none; border: none; color: #fff; font-size: 1.5rem; cursor: pointer; }
.sidebar h3 {
  color: var(--aura); text-transform: uppercase; letter-spacing: 0.2rem;
  margin-bottom: 2rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem;
}
.sidebar ul { list-style: none; padding: 0; }
.sidebar li { margin: 1.5rem 0; font-size: 1.2rem; cursor: pointer; color: #ddd; transition: 0.3s; }
.sidebar li:hover { color: var(--aura); transform: translateX(10px); }
.logout { color: #ff4444 !important; margin-top: 3rem; }
.sidebar-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 90; backdrop-filter: blur(4px); }
.dropdown { position: absolute; right: 0; top: 100%; background: #111; padding: 1rem; border: 1px solid #333; z-index: 50; border-radius: 8px; width: 200px; }

/* --- ANIMATIONS --- */
@keyframes breathe { 0%, 100% { transform: scale(1); opacity: 0.15; } 50% { transform: scale(1.3); opacity: 0.4; } }
@keyframes wander { 0% { translate: 0 0; } 100% { translate: 20px -20px; } }
@keyframes morph { 0% { border-radius: 60% 40% 30% 70%; } 100% { border-radius: 30% 60% 70% 40%; } }
.slide-in-enter-active, .slide-in-leave-active { transition: transform 0.4s ease; }
.slide-in-enter-from, .slide-in-leave-to { transform: translateX(-100%); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-slide-enter-active, .fade-slide-leave-active { transition: all 0.6s ease; }
.fade-slide-enter-from { opacity: 0; transform: translateY(5px); }
.fade-slide-leave-to { opacity: 0; transform: translateY(-5px); }

/* --- MEDIA QUERIES --- */
@media (max-width: 1024px) {
  .header-nav { 
    flex-direction: column; 
    padding: 1rem; 
    gap: 0.5rem; 
  }
  
  .nav-top-row { 
    width: 100%; 
    position: relative; 
    justify-content: center; /* Keeps logo dead center */
    min-height: 40px;
  }
  
  .nav-left { 
    position: absolute; 
    left: 0; 
    top: 50%; 
    transform: translateY(-50%); /* Keeps hamburger on the left edge */
  }
  
  .branding { 
    position: relative; 
    left: auto; 
    transform: none; 
    margin-bottom: 0; 
    pointer-events: auto; 
  }
  
  .desktop-spacer { 
    display: none; 
  }
  
  .nav-actions { 
    width: 100%; 
    justify-content: center; 
    flex-wrap: wrap; /* Allows buttons to wrap safely on small phones */
    gap: 1.2rem; 
    padding-top: 1rem; 
    margin-top: 0.5rem;
    border-top: 1px solid rgba(255,255,255,0.05); 
  }
  
  .loom-title { font-size: 2.2rem; }
  .sidebar { width: 100%; }
  .soul-container { width: 90vw; height: 90vw; }
  .inner-soul { width: 60%; height: 60%; }
  
  /* Mobile adjustments for Search Dropdown */
  .search-results { max-height: 60vh; }
  .search-item { padding: 14px 18px; } /* Larger touch targets */
  .mini-thumb { width: 45px; height: 45px; }
  .main-text { font-size: 1.1rem; }
  .user-text { font-size: 1.15rem; }
}

@media (max-width: 400px) {
  .nav-actions { gap: 0.8rem; }
  .aura-btn svg { width: 22px; height: 22px; }
  .create-btn { width: 40px; height: 40px; }
}
.notification-wrapper { position: relative; }

.bell-btn { position: relative; }
.bell-btn.oscillating svg { animation: oscillate 2s ease-in-out infinite; transform-origin: top center; }

.red-dot {
  position: absolute; top: 6px; right: 8px;
  width: 8px; height: 8px;
  background-color: #ef4444;
  border-radius: 50%;
  box-shadow: 0 0 5px #ef4444;
}

/* OSCILLATION ANIMATION */
@keyframes oscillate {
  0% { transform: rotate(0deg); }
  10% { transform: rotate(15deg); }
  20% { transform: rotate(-10deg); }
  30% { transform: rotate(5deg); }
  40% { transform: rotate(-5deg); }
  50% { transform: rotate(0deg); }
  100% { transform: rotate(0deg); } /* Long pause */
}

/* DROPDOWN */
.notifications-dropdown {
  position: absolute; top: 120%; right: -50px;
  width: 320px; max-height: 400px;
  background: rgba(10, 10, 15, 0.95);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0,0,0,0.8);
}

.notif-header {
  padding: 12px 15px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  display: flex; justify-content: space-between; align-items: center;
}
.notif-header h3 { margin: 0; font-size: 0.9rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
.clear-all { font-size: 0.7rem; color: #3b82f6; cursor: pointer; }

.notif-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; }

.notif-item {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 12px 15px;
  border-bottom: 1px solid rgba(255,255,255,0.02);
  cursor: pointer; transition: background 0.2s;
}
.notif-item:hover { background: rgba(255,255,255,0.05); }
.notif-item.unread { background: rgba(59, 130, 246, 0.05); }

.notif-avatar {
  width: 36px; height: 36px; border-radius: 50%; overflow: hidden;
  background: #1e293b; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 1rem; color: #fff; font-family: 'Cinzel';
}
.notif-avatar img { width: 100%; height: 100%; object-fit: cover; }

.notif-content p { margin: 0; font-size: 0.85rem; color: #e2e8f0; line-height: 1.4; font-family: 'Inter', sans-serif; }
.notif-time { font-size: 0.7rem; color: #64748b; margin-top: 4px; display: block; }

.unread-indicator {
  width: 6px; height: 6px; background: #3b82f6; border-radius: 50%; margin-top: 6px;
}

.empty-notif { padding: 2rem; text-align: center; color: #64748b; font-style: italic; font-size: 0.9rem; }

/* Mobile Adjustment */
@media (max-width: 500px) {
  .notifications-dropdown { right: -20px; width: 300px; }
}
.category-band {
  width: 100%;
  max-width: 900px;
  margin: 0.5rem auto 2rem auto;
  padding: 0 1rem;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  z-index: 8;
}

/* 1. Selected Tags (Wrap Layout) */
.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

/* 2. Available Tags (Scroll Layout) */
.available-tags-wrapper {
  position: relative;
  width: 100%;
  overflow: hidden;
  mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
}

.available-tags {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 5px 20px;
  scrollbar-width: none; /* Hide scrollbar Firefox */
  justify-content: flex-start;
}
.available-tags::-webkit-scrollbar { display: none; } /* Hide scrollbar Chrome/Safari */

/* --- CHIP STYLES --- */
.cat-chip {
  background: rgba(20, 20, 25, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ccc;
  padding: 6px 14px;
  border-radius: 20px;
  font-family: 'Inter', sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  flex-shrink: 0;
  backdrop-filter: blur(5px);
}

.cat-icon {
  width: 16px;
  height: 16px;
  opacity: 0.7;
  color: var(--cat-color);
  transition: 0.2s;
}

/* Hover Effect */
.cat-chip:hover {
  border-color: var(--cat-color);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.cat-chip:hover .cat-icon { opacity: 1; filter: drop-shadow(0 0 5px var(--cat-color)); }

/* --- ACTIVE STATE (Selected) --- */
.cat-chip.active {
  background: linear-gradient(135deg, rgba(255,255,255,0.05), transparent);
  border: 1px solid var(--cat-color);
  color: #fff;
  padding-right: 10px;
  box-shadow: 0 0 15px rgba(0,0,0,0.5), inset 0 0 10px rgba(0,0,0,0.2);
}
.cat-chip.active .cat-icon { color: #fff; filter: drop-shadow(0 0 2px #fff); }

.close-x {
  margin-left: 6px;
  font-size: 1.1rem;
  color: var(--cat-color);
  opacity: 0.7;
  line-height: 0;
}
.close-x:hover { opacity: 1; color: #fff; }

/* List Animations */
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.9);
}
.list-leave-active {
  position: absolute; 
}

.advanced-dropdown { 
  width: 280px; 
  padding: 1.2rem; 
  background: rgba(10, 10, 15, 0.95); 
  border: 1px solid rgba(255,255,255,0.1); 
  backdrop-filter: blur(20px);
}

.menu-title { margin: 0 0 10px 0; color: #fff; font-family: 'Cinzel', serif; font-size: 1.1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; }

.settings-menu { display: flex; flex-direction: column; gap: 8px; }
.settings-menu button { 
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); 
  color: #ccc; padding: 10px 12px; border-radius: 6px; cursor: pointer; 
  text-align: left; font-family: 'Inter', sans-serif; font-size: 0.9rem; transition: 0.2s; 
}
.settings-menu button:hover { background: rgba(255,255,255,0.1); color: var(--aura); transform: translateX(3px); }

.category-picker, .color-picker { display: flex; flex-direction: column; gap: 10px; }
.settings-hint { font-size: 0.75rem; color: #888; margin: 0; font-family: 'Inter', sans-serif; }

.cat-list { 
  display: flex; flex-wrap: wrap; gap: 6px; max-height: 220px; 
  overflow-y: auto; padding-right: 5px; margin-top: 5px; 
}
.cat-list::-webkit-scrollbar { width: 4px; }
.cat-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }

.cat-toggle-btn { 
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
  color: #94a3b8; padding: 6px 10px; border-radius: 6px; font-family: 'Inter', sans-serif;
  font-size: 0.75rem; cursor: pointer; transition: 0.2s; flex-grow: 1; text-align: center;
}
.cat-toggle-btn:hover { background: rgba(255,255,255,0.15); }

/* Included active state (Blue/Greenish) */
.cat-toggle-btn.included-active { background: #3b82f6; color: #fff; border-color: #2563eb; }
/* Excluded active state (Reddish) */
.cat-toggle-btn.excluded-active { background: #ef4444; color: #fff; border-color: #dc2626; }

.settings-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); }
.primary-btn { 
  background: var(--aura); color: white; border: none; padding: 6px 16px; 
  border-radius: 6px; cursor: pointer; transition: 0.2s; font-weight: bold; font-family: 'Inter', sans-serif; 
}
.primary-btn:hover { filter: brightness(1.2); box-shadow: 0 0 10px var(--aura); }
.small-link { background: none; border: none; color: #888; cursor: pointer; font-size: 0.85rem; font-family: 'Inter', sans-serif;}
.small-link:hover { color: #fff; }

.aura-input { width: 100%; height: 40px; border: none; background: transparent; cursor: pointer; }

.scrollable-picker {
  max-height: 280px;
  overflow-y: auto;
  padding-right: 5px;
}
.scrollable-picker::-webkit-scrollbar { width: 4px; }
.scrollable-picker::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }

.cat-list-inline { 
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; margin-bottom: 10px;
}

.mt-15 {
  margin-top: 15px;
}

/* Ensure the Include list also uses the inline list style so it doesn't break */
.cat-list { 
  display: flex; flex-wrap: wrap; gap: 6px; max-height: 280px; 
  overflow-y: auto; padding-right: 5px; margin-top: 5px; 
}

/* --- FEED GRID STYLES --- */
.loom-void {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 1rem 2rem 5rem; /* 🚀 FIX: Changed 5% to 2rem to prevent calc overflow */
  z-index: 5;
  position: relative;
  box-sizing: border-box; /* 🚀 FIX: Ensures padding is included in width */
  overflow-x: hidden; /* 🚀 FIX: Stops any lingering elements from breaking the layout */
}

.feed-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 25px;
  width: 100%; /* 🚀 FIX: Forces grid to respect boundaries */
}

.feed-loading, .empty-feed {
  text-align: center;
  margin-top: 100px;
  color: #64748b;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.spinner.large { width: 50px; height: 50px; border-width: 3px; }

.weave-card {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  position: relative; /* 🚀 NEW: Required for z-index to work */
  z-index: 1; /* 🚀 NEW: Base layer */
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s, z-index 0s;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 12px;
}

.weave-card:hover {
  z-index: 20; /* 🚀 FIX: Makes the card float above the rest of the grid */
  transform: translateY(-8px) scale(1.12); /* 🚀 FIX: Expands the card size */
  border-color: var(--aura);
  box-shadow: 0 25px 50px rgba(0,0,0,0.8), 0 0 20px rgba(255,255,255,0.05);
}

.weave-thumb {
  height: 180px; /* 🚀 Tweak: Slightly taller base height */
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  transition: background-size 0.3s ease, background-color 0.3s ease;
}

.weave-card:hover .weave-thumb {
  background-size: contain; /* 🚀 FIX: Shows the ENTIRE picture without cropping */
  background-color: #050508; /* 🚀 FIX: Fills the letterbox space cleanly */
}

.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-top: 50px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.page-btn {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  transition: all 0.2s;
}

.page-btn:not(:disabled):hover {
  background: var(--aura);
  border-color: var(--aura);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.4);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-indicator {
  color: #94a3b8;
  font-family: 'Inter', sans-serif;
  font-size: 0.95rem;
}

/* --- NSFW TOGGLE SLIDER --- */
.nsfw-toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  border-right: 1px solid rgba(255,255,255,0.1);
}

.nsfw-label {
  font-size: 0.75rem;
  color: #94a3b8;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  letter-spacing: 1px;
}

.switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: .4s;
  border-radius: 20px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 12px;
  width: 12px;
  left: 3px;
  bottom: 3px;
  background-color: #94a3b8;
  transition: .4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  border-radius: 50%;
}

input:checked + .slider {
  background-color: rgba(239, 68, 68, 0.2); /* Red tint */
  border-color: #ef4444;
}

input:checked + .slider:before {
  transform: translateX(16px);
  background-color: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.8);
}

/* --- NSFW BLUR OVERLAY --- */
.nsfw-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(16px); /* 🚀 Frosted glass effect */
  -webkit-backdrop-filter: blur(16px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  z-index: 2;
}

.nsfw-text {
  color: #f87171;
  font-family: 'Inter', sans-serif;
  font-weight: 800;
  letter-spacing: 3px;
  background: rgba(0,0,0,0.5);
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid rgba(248, 113, 113, 0.3);
}

/* Ensure the premium badge sits ABOVE the blur overlay */
.premium-badge {
  position: absolute;
  top: 10px; right: 10px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white; font-size: 0.7rem; font-weight: 700;
  padding: 3px 8px; border-radius: 6px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.5);
  font-family: 'Inter', sans-serif;
  z-index: 3; /* Sits above NSFW overlay */
}

.weave-info { padding: 16px; display: flex; flex-direction: column; gap: 8px; }

.weave-title {
  margin: 0; font-size: 1.3rem; color: #f1f5f9;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.weave-author { font-size: 0.85rem; color: #94a3b8; font-family: 'Inter', sans-serif; }

.weave-stats {
  display: flex; gap: 12px; margin-top: 5px;
  font-size: 0.8rem; color: #cbd5e1; font-family: 'Inter', sans-serif;
}

.weave-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.mini-tag { 
  font-size: 0.7rem; background: rgba(255,255,255,0.05); 
  padding: 2px 8px; border-radius: 4px; color: #94a3b8; border: 1px solid rgba(255,255,255,0.1);
  font-family: 'Inter', sans-serif;
}
</style>