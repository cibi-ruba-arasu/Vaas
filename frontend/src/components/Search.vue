<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { API_URL } from '../config.js';
const route = useRoute();
const router = useRouter();

const searchQuery = ref(route.query.q || "");
const isLoading = ref(true);
const searchResults = ref({ games: [], users: [] });
const token = sessionStorage.getItem("token");

// --- AURA & STAR BACKGROUND LOGIC ---
const auraColor = ref("#0077ff");
const starsSmall = ref('');
const starsMedium = ref('');
const starsLarge = ref('');
const mouseX = ref(0);
const mouseY = ref(0);

const localSearchQuery = ref(route.query.q || "");
const showCategories = ref(false);
const selectedCategories = ref([]);

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

const toggleCategory = (catName) => {
  const index = selectedCategories.value.indexOf(catName);
  if (index === -1) {
    selectedCategories.value.push(catName);
  } else {
    selectedCategories.value.splice(index, 1);
  }
};

const triggerSearch = () => {
  if (localSearchQuery.value.trim().length > 0) {
    showCategories.value = false;
    router.push({ query: { q: localSearchQuery.value } });
  }
};

const autocompleteResults = ref([]);
const isTyping = ref(false);

const handleAutocomplete = async () => {
  if (localSearchQuery.value.trim().length < 2) {
    autocompleteResults.value = [];
    return;
  }
  isTyping.value = true;
  try {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_URL}/search/suggestions?q=${encodeURIComponent(localSearchQuery.value)}`, {
      headers
    });
    if (res.ok) {
      autocompleteResults.value = await res.json();
    }
  } catch (err) {
    console.error("Autocomplete failed", err);
  } finally {
    isTyping.value = false;
  }
};

let typingTimeout;
watch(localSearchQuery, () => {
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(handleAutocomplete, 300);
});

const handleSuggestionClick = (item) => {
  autocompleteResults.value = []; // clear dropdown
  if (item.type === 'user') router.push(`/user/${item.id}`);
  else router.push(`/post/${item.id}`);
};

const filteredGames = computed(() => {
  if (selectedCategories.value.length === 0) return searchResults.value.games;

  return searchResults.value.games.filter(game => {
    // Check if the game has at least one of the selected categories
    const gameCats = [...(game.categories || []), ...(game.customCategories || [])];
    return selectedCategories.value.some(c => gameCats.includes(c));
  });
});

const generateStars = (count, blur) => {
  let shadows = [];
  for (let i = 0; i < count; i++) {
    const x = (Math.random() * 110 - 5).toFixed(2);
    const y = (Math.random() * 210 - 5).toFixed(2);
    // 80% Aura Color, 20% White
    const color = Math.random() > 0.2 ? auraColor.value : '#FFF';
    shadows.push(`${x}vw ${y}vh ${blur}px ${color}`);
  }
  return shadows.join(', ');
};

const updateStarFields = () => {
  starsSmall.value = generateStars(400, 0);
  starsMedium.value = generateStars(150, 1);
  starsLarge.value = generateStars(50, 2);
};

const handleMouseMove = (e) => {
  mouseX.value = (e.clientX - window.innerWidth / 2) * -0.01;
  mouseY.value = (e.clientY - window.innerHeight / 2) * -0.01;
};

// Update stars dynamically if aura color changes
watch(auraColor, () => {
  updateStarFields();
});

// Sync NSFW preference with Homepage
const showNSFW = ref(localStorage.getItem("showNSFW") === "true");

watch(showNSFW, (newVal) => {
  localStorage.setItem("showNSFW", newVal);
});

// Dynamic Font Loader for Game Titles
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

const executeSearch = async () => {
  if (!searchQuery.value) return;
  isLoading.value = true;
  
  try {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_URL}/search/global?q=${encodeURIComponent(searchQuery.value)}`, { headers });
    if (res.ok) {
      const data = await res.json();
      searchResults.value = data;
      
      // Load fonts for the games we just found
      data.games.forEach(g => loadGoogleFont(g.titleFont));
    }
  } catch (err) {
    console.error("Search failed:", err);
  } finally {
    isLoading.value = false;
  }
};

// Re-trigger search if user modifies query while on the page
watch(() => route.query.q, (newQ) => {
  searchQuery.value = newQ || "";
  localSearchQuery.value = newQ || "";
  executeSearch();
});

onMounted(async () => {
  // Init star background and tracking
  window.addEventListener('mousemove', handleMouseMove);
  updateStarFields();

  // Fetch user's Aura Color
  if (token) {
    try {
      const res = await fetch(`${API_URL}/user/theme`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.themeColor) auraColor.value = data.themeColor;
      }
    } catch (e) {
      console.error("Failed to load user theme", e);
    }
  }

  executeSearch();
});

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove);
});
</script>

<template>
  <div class="search-page-container" :style="{ '--aura': auraColor, '--mouse-x': mouseX + 'px', '--mouse-y': mouseY + 'px' }">
    
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

    <div class="content-layer">
      <div class="search-header">
        <div class="header-top-row">
          <button class="back-btn" @click="router.push(token ? '/home' : '/homeg')">
            &larr; Back to Void
          </button>
          <div class="nsfw-toggle-wrapper" title="Toggle NSFW Thumbnails">
            <span class="nsfw-label">NSFW</span>
            <label class="switch">
              <input type="checkbox" v-model="showNSFW">
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="interactive-search-area">
          <div class="search-bar-row">
            
            <div class="search-input-wrapper">
              <span class="search-icon">🔍</span>
              <input 
                type="text" 
                v-model="localSearchQuery" 
                @keyup.enter="triggerSearch"
                class="mystic-input"
                placeholder="Seek the unknown..."
              />
              <button class="go-btn" @click="triggerSearch" v-if="localSearchQuery.length > 0">→</button>

              <Transition name="fade">
                <div v-if="autocompleteResults.length > 0 || isTyping" class="search-suggestions-dropdown">
                  
                  <div v-if="isTyping" class="search-loading">
                    <span class="tiny-spinner"></span> Searching the threads...
                  </div>
                  
                  <div 
                    v-else 
                    v-for="item in autocompleteResults" 
                    :key="item.id" 
                    class="search-item"
                    :class="item.type"
                    @click="handleSuggestionClick(item)"
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

            <div class="category-dropdown-wrapper" @mouseleave="showCategories = false">
              <button class="cat-dropdown-btn" @click="showCategories = !showCategories" :class="{ 'has-selections': selectedCategories.length > 0 }">
                Categories <span v-if="selectedCategories.length > 0">({{ selectedCategories.length }})</span>
                <span class="chevron" :class="{ open: showCategories }">▼</span>
              </button>

              <Transition name="fade-slide">
                <div v-if="showCategories" class="cat-dropdown-menu glass-panel">
                  <div class="cat-grid">
                    <button 
                      v-for="cat in ALL_CATEGORIES" 
                      :key="cat.name" 
                      class="cat-chip"
                      :class="{ active: selectedCategories.includes(cat.name) }"
                      :style="{ '--cat-color': cat.color }"
                      @click="toggleCategory(cat.name)"
                    >
                      <svg class="cat-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path :d="cat.path" />
                      </svg>
                      {{ cat.name }}
                    </button>
                  </div>
                </div>
              </Transition>
            </div>

          </div>

          <TransitionGroup name="list" tag="div" class="active-filters" v-if="selectedCategories.length > 0">
            <span v-for="cat in selectedCategories" :key="cat" class="active-chip" @click="toggleCategory(cat)">
              {{ cat }} <span class="close-x">×</span>
            </span>
          </TransitionGroup>
        </div>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Consulting the Oracle...</p>
      </div>

      <div v-else class="results-wrapper">
        <div v-if="searchResults.users.length === 0 && filteredGames.length === 0" class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="M21 21l-4.35-4.35" stroke-linecap="round"></path>
          </svg>
          <h2>No fragments found</h2>
          <p>Try adjusting your search terms or expanding your preferences.</p>
        </div>

        <section v-if="searchResults.users.length > 0" class="result-section">
          <h2 class="section-heading">Creators</h2>
          <div class="user-grid">
            <div 
              v-for="user in searchResults.users" 
              :key="user._id" 
              class="user-card glass-panel"
              @click="router.push(`/user/${user.userid}`)"
            >
              <div class="user-avatar">
                <img 
                  v-if="user.profilePic" 
                  :src="user.profilePic" 
                  alt="Profile" 
                  @error="user.profilePic = null"
                >
                <span v-else class="fallback-avatar">
                  {{ user.username.charAt(0).toUpperCase() }}
                </span>
              </div>
              <div class="user-info">
                <div class="user-name-row">
                  <h3>{{ user.username }}</h3>
                  <span v-if="user.verified === 'verified'" title="Verified Creator" class="verified-badge">✓</span>
                </div>
                <p class="user-handle">@{{ user.userid }}</p>
                <span class="follower-count">{{ user.followersCount || 0 }} Followers</span>
              </div>
            </div>
          </div>
        </section>

        <section v-if="filteredGames.length > 0" class="result-section">
          <h2 class="section-heading">Weaves</h2>
          <div class="feed-grid">
            <div 
              v-for="weave in filteredGames" 
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
                 </div>
                 
                 <div class="weave-tags">
                   <span v-for="cat in weave.categories.slice(0, 3)" :key="cat" class="mini-tag">{{ cat }}</span>
                   <span v-for="cat in weave.customCategories.slice(0, 1)" :key="cat" class="mini-tag custom">{{ cat }}</span>
                 </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-page-container {
  min-height: 100vh;
  background: #020617;
  color: white;
  padding: 40px 5% 5rem;
  font-family: 'Inter', sans-serif;
  position: relative;
  overflow-x: hidden;
}

/* --- NIGHT SKY EFFECT --- */
.sky-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0; /* Background layer */
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

/* --- MAIN CONTENT LAYER --- */
.content-layer {
  position: relative;
  z-index: 10; /* Above the stars */
}

.search-header {
  margin-bottom: 3rem;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  padding-bottom: 2rem;
}

.header-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.fallback-avatar {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05); /* Subtle dark glass background */
  color: #f1f5f9;
  font-size: 1.6rem;
  font-family: 'Cinzel', serif; /* Keeps the mystic aesthetic */
  font-weight: 600;
}

.back-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: #94a3b8;
  font-size: 0.95rem;
  padding: 8px 16px;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  transition: all 0.2s;
  backdrop-filter: blur(10px);
}

.back-btn:hover {
  background: rgba(255,255,255,0.1);
  color: #fff;
  border-color: var(--aura, #3b82f6);
  transform: translateX(-5px);
  box-shadow: 0 0 15px rgba(0,0,0,0.5);
}

.search-title {
  font-family: 'Cinzel', serif;
  font-size: 2.5rem;
  font-weight: 400;
  margin: 0;
  text-align: center;
  text-shadow: 0 4px 20px rgba(0,0,0,0.5);
}

.highlight {
  color: var(--aura, #3b82f6);
  font-style: italic;
  text-shadow: 0 0 15px var(--aura, #3b82f6);
}

.section-heading {
  font-family: 'Cinzel', serif;
  font-size: 1.8rem;
  color: #94a3b8;
  margin-bottom: 1.5rem;
  border-left: 4px solid var(--aura, #3b82f6);
  padding-left: 15px;
}

.result-section {
  margin-bottom: 4rem;
}

/* --- LOADING & EMPTY STATES --- */
.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-top: 5rem;
  color: #64748b;
  background: rgba(15, 23, 42, 0.4);
  padding: 40px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.05);
}

.spinner {
  width: 50px; height: 50px;
  border: 4px solid rgba(255,255,255,0.1);
  border-top-color: var(--aura, #3b82f6);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.empty-state svg { width: 80px; height: 80px; opacity: 0.5; color: var(--aura, #3b82f6); }
@keyframes spin { to { transform: rotate(360deg); } }

/* --- USER GRID --- */
.user-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s;
  backdrop-filter: blur(10px);
}

.user-card:hover {
  transform: translateY(-5px);
  border-color: var(--aura, rgba(59, 130, 246, 0.5));
  box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 0 15px rgba(255,255,255,0.02);
}

.user-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid rgba(255,255,255,0.1);
  flex-shrink: 0;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-info { display: flex; flex-direction: column; gap: 4px; }
.user-name-row { display: flex; align-items: center; gap: 5px; }
.user-name-row h3 { margin: 0; font-size: 1.1rem; color: #f1f5f9; }
.verified-badge { color: var(--aura, #3b82f6); font-size: 0.9rem; font-weight: bold; }
.user-handle { margin: 0; font-size: 0.85rem; color: #64748b; }
.follower-count { font-size: 0.75rem; color: #fff; font-weight: 600; background: var(--aura, rgba(59, 130, 246, 0.5)); padding: 2px 8px; border-radius: 4px; width: fit-content; opacity: 0.8;}


/* --- GAME GRID --- */
.feed-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 25px;
}

.weave-card {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  position: relative;
  z-index: 1;
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s, z-index 0s;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
}

.weave-card:hover {
  z-index: 20;
  transform: translateY(-8px) scale(1.12);
  border-color: var(--aura, #3b82f6);
  box-shadow: 0 25px 50px rgba(0,0,0,0.8), 0 0 20px rgba(255,255,255,0.05);
}

.weave-thumb {
  height: 180px;
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
  background-size: contain;
  background-color: #050508;
}

.premium-badge {
  position: absolute;
  top: 10px; right: 10px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white; font-size: 0.7rem; font-weight: 700;
  padding: 3px 8px; border-radius: 6px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.5);
  font-family: 'Inter', sans-serif;
  z-index: 3;
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
}
.mini-tag.custom {
  color: var(--aura, #3b82f6); border-color: var(--aura, rgba(59, 130, 246, 0.3)); background: rgba(255,255,255,0.05);
}

/* --- NSFW BLUR & TOGGLE STYLES --- */
.nsfw-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(16px);
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

.nsfw-toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.05);
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(10px);
}

.nsfw-label {
  font-size: 0.75rem;
  color: #94a3b8;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  letter-spacing: 1px;
}

.switch { position: relative; display: inline-block; width: 36px; height: 20px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; inset: 0; background-color: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); transition: .4s; border-radius: 20px; }
.slider:before { position: absolute; content: ""; height: 12px; width: 12px; left: 3px; bottom: 3px; background-color: #94a3b8; transition: .4s; border-radius: 50%; }

input:checked + .slider { background-color: rgba(239, 68, 68, 0.2); border-color: #ef4444; }
input:checked + .slider:before { transform: translateX(16px); background-color: #ef4444; box-shadow: 0 0 8px rgba(239, 68, 68, 0.8); }
.interactive-search-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  width: 100%;
  position: relative; /* <-- ADD THIS LINE */
  z-index: 100;       /* <-- ADD THIS LINE */
}

.search-bar-row {
  display: flex;
  align-items: center;
  gap: 15px;
  width: 100%;
  max-width: 600px;
  position: relative;
  z-index: 50; /* <-- ADD THIS LINE */
}

.search-input-wrapper {
  flex-grow: 1;
  display: flex;
  align-items: center;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50px;
  padding: 0.6rem 1.2rem;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.search-input-wrapper:focus-within {
  border-color: var(--aura, #3b82f6);
  box-shadow: 0 0 15px rgba(0,0,0,0.5), inset 0 0 10px rgba(59, 130, 246, 0.1);
}

.search-icon {
  margin-right: 0.8rem;
  opacity: 0.6;
}

.mystic-input {
  background: transparent;
  border: none;
  color: #fff;
  font-family: 'Cinzel', serif;
  font-size: 1.1rem;
  width: 100%;
  outline: none;
}

.mystic-input::placeholder {
  color: rgba(255,255,255,0.4);
  font-style: italic;
}

.go-btn {
  background: rgba(255,255,255,0.1);
  border: none;
  color: white;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 10px;
  transition: 0.2s;
}

.go-btn:hover { background: var(--aura, #3b82f6); }

/* --- DROPDOWN STYLES --- */
.category-dropdown-wrapper {
  position: relative;
}

.cat-dropdown-btn {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  padding: 0.8rem 1.2rem;
  border-radius: 50px;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: 0.2s;
  backdrop-filter: blur(10px);
}

.cat-dropdown-btn:hover, .cat-dropdown-btn.has-selections {
  color: #fff;
  border-color: var(--aura, #3b82f6);
  background: rgba(59, 130, 246, 0.1);
}

.chevron {
  font-size: 0.7rem;
  transition: transform 0.3s;
}
.chevron.open { transform: rotate(180deg); }

.cat-dropdown-menu {
  position: absolute;
  top: 120%;
  right: 0;
  width: 320px;
  max-height: 400px;
  overflow-y: auto;
  background: rgba(10, 10, 15, 0.95);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 15px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.8);
  z-index: 50;
}

.cat-dropdown-menu::-webkit-scrollbar { width: 4px; }
.cat-dropdown-menu::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }

.cat-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cat-chip {
  background: rgba(20, 20, 25, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ccc;
  padding: 6px 12px;
  border-radius: 20px;
  font-family: 'Inter', sans-serif;
  font-size: 0.8rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: 0.2s;
}

.cat-icon { width: 14px; height: 14px; opacity: 0.7; color: var(--cat-color); }

.cat-chip:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.cat-chip.active {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid var(--cat-color);
  color: #fff;
  box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
}
.cat-chip.active .cat-icon { opacity: 1; filter: drop-shadow(0 0 2px #fff); }

/* --- ACTIVE FILTERS LIST --- */
.active-filters {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  width: 100%;
}

.active-chip {
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid var(--aura, #3b82f6);
  color: #fff;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: 0.2s;
}

.active-chip:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
}

.close-x { font-weight: bold; }

/* ANIMATIONS */
.fade-slide-enter-active, .fade-slide-leave-active { transition: all 0.3s ease; }
.fade-slide-enter-from, .fade-slide-leave-to { opacity: 0; transform: translateY(-10px); }
.list-move, .list-enter-active, .list-leave-active { transition: all 0.4s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: scale(0.9); }
.list-leave-active { position: absolute; }
/* --- AUTOCOMPLETE DROPDOWN STYLES --- */
.search-suggestions-dropdown {
  position: absolute;
  top: 115%; 
  left: 0;
  width: 100%;
  background: #0a0a0c; 
  border: solid 1px rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 8px 0;
  box-shadow: 0 10px 40px rgba(0,0,0,0.9);
  max-height: 450px; 
  overflow-y: auto;
  z-index: 100;
}

.search-item {
  padding: 12px 18px; 
  cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  transition: all 0.1s;
}
.search-item:last-child { border-bottom: none; }
.search-item:hover { background: rgba(255,255,255,0.08); }

.content-row { display: flex; align-items: center; gap: 14px; }

.search-item.publish {
  border-left: 3px solid var(--aura, #3b82f6); 
  background: linear-gradient(90deg, rgba(255,255,255,0.02), transparent);
}
.search-item.publish:hover {
  background: linear-gradient(90deg, rgba(255,255,255,0.1), transparent);
}

.mini-thumb {
  width: 40px; 
  height: 40px;
  border-radius: 6px;
  background-size: cover;
  background-position: center;
  border: 1px solid rgba(255,255,255,0.1);
}

.text-col { display: flex; flex-direction: column; justify-content: center; }
.main-text { font-size: 1rem; color: #eee; font-family: 'Inter', sans-serif; font-weight: 600; line-height: 1.2; }
.sub-text { font-size: 0.75rem; color: #888; font-family: 'Inter', sans-serif; margin-top: 2px; }

.search-item.user { padding-left: 24px; }
.user-row { gap: 4px; align-items: baseline; }
.user-prefix { color: #666; font-size: 0.9rem; font-family: 'Inter', sans-serif; font-weight: 700; }
.user-text { color: #ccc; font-weight: 500; font-size: 1.05rem; } 

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
  border-top-color: var(--aura, #3b82f6);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
</style>