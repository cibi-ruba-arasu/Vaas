<script setup>
import { ref } from 'vue'

// Contains the first half of the extracted documentation data.
// The rest (Components, Logic Engine, Settings, and Preview Mode) will be provided next.
const docSections = ref([
  {
    id: 'graph-engine',
    category: 'Canvas & Graph Engine',
    features: [
      { 
        name: 'Infinite Workspace', 
        description: 'An unbounded coordinate system allowing free panning via mouse click-and-drag. It includes dynamic rendering of major and minor grid lines based on the current scale.' 
      },
      { 
        name: 'Dynamic Zooming', 
        description: 'Scroll wheel integration allows zooming from 0.2x up to 6x scale. The zoom calculates relative to the mouse cursor position for intuitive navigation.' 
      },
      { 
        name: 'Node Manipulation', 
        description: 'Nodes can be freely dragged across the workspace. Active connection lines automatically recalculate and redraw between node anchors in real-time.' 
      },
      { 
        name: 'Context Menu', 
        description: 'Right-clicking on a node opens a contextual menu allowing you to immediately delete the node or sever all of its incoming/outgoing connection links.' 
      }
    ]
  },
  {
    id: 'node-types',
    category: 'Node Architecture',
    features: [
      { 
        name: 'General Node', 
        description: 'The primary container for narrative flow. General nodes hold multiple chronological scenes, component layouts, background audio, and branching interactive options.' 
      },
      { 
        name: 'If-Else Logic Node', 
        description: 'Forks the story path based on global variables. Evaluates conditions using operators (==, !=, >, <, >=, <=) against constants or other variables, routing to True or False output arrows.' 
      },
      { 
        name: 'Set Variables Node', 
        description: 'Mutates global state without interrupting the player. Supports mathematical operations (+, -, *, /) for integers and intelligent string concatenation (Prefix + Variable + Suffix).' 
      },
      { 
        name: 'Gift Node', 
        description: 'A specialized node that rewards the player with a digital asset. Interrupts the standard logic flow to display a custom notification and pixel art overlay before continuing the story.' 
      }
    ]
  },
  {
    id: 'pixel-art-editor',
    category: 'Pixel Art Editor (Gift Node)',
    features: [
      { 
        name: '64x64 Drawing Canvas', 
        description: 'A built-in pixel art creator specific to the Gift node, utilizing a strict 64x64 grid to ensure retro aesthetic consistency.' 
      },
      { 
        name: 'Drawing Tools', 
        description: 'Includes a Pencil tool for drawing, an Eraser for removal, and a recursive Flood Fill (Bucket) tool for rapidly coloring enclosed areas.' 
      },
      { 
        name: 'Reward Types', 
        description: 'Supports "PFP" mode (renders with a solid white background) and "Badge" mode (renders with a transparent background over a checkerboard preview).' 
      },
      { 
        name: 'Reward Audio', 
        description: 'Upload a custom sound effect that plays exactly when the reward is unlocked. Includes automatic duration validation preventing uploads longer than 10 seconds.' 
      }
    ]
  },
  {
    id: 'scene-management',
    category: 'Scene Management',
    features: [
      { 
        name: 'Linear Sub-routing', 
        description: 'Allows grouping multiple chronological screens inside a single General node. Scenes play sequentially before advancing to the next node.' 
      },
      { 
        name: 'Drag-and-Drop Reordering', 
        description: 'Easily reorganize the rendering order of components within a scene using the visual drag handle.' 
      },
      { 
        name: 'Scene Backgrounds', 
        description: 'Assign distinct hex background colors to individual scenes to set the mood.' 
      },
      { 
        name: 'Sequence Audio & Ducking', 
        description: 'Attach looping or one-shot audio files to the entire node sequence. Includes a "ducking" feature that automatically lowers background music volume when a video component plays.' 
      }
    ]
  },
  {
    id: 'visual-components',
    category: 'Visual & Media Components',
    features: [
      { 
        name: 'Text Component', 
        description: 'Supports rich text rendering with custom Google Fonts (over 30 standard fonts available). Features dynamic line-wrapping, text alignment, and inline styling options including Bold, Italic, Underline (with custom color), and Strikethrough.' 
      },
      { 
        name: 'Image Component', 
        description: 'Handles local file uploads using FileReader, automatically downscaling large images while maintaining aspect ratio to ensure canvas performance. Includes CORS support for cross-origin preview rendering.' 
      },
      { 
        name: 'Video Component', 
        description: 'Renders HTML5 video directly onto the canvas. Includes specific toggles for Looping and Muting. Videos act as visual barriers in Preview mode, pausing the scene progression until the video finishes playing (unless set to loop).' 
      },
      { 
        name: 'Variable Display Component', 
        description: 'A dynamic text element that reads directly from the Global Variable state. It will display the live value of the connected variable during Preview mode, supporting all standard text formatting options.' 
      },
      { 
        name: 'Component Layering', 
        description: 'Visual z-index management allowing users to manually push components to the Top, Bottom, Up, or Down within the scene stack.' 
      }
    ]
  },
  {
    id: 'interactive-components',
    category: 'Interactive Components',
    features: [
      { 
        name: 'Input Box', 
        description: 'Collects user data during gameplay. Validates input based on the assigned target variable (ensuring strings or integers). Features deep customization for normal vs. focus states (Focus Background/Border) and dedicated Button styling for Normal, Hover, and Click states.' 
      },
      { 
        name: 'Options Box', 
        description: 'The core branching mechanic. Must be placed as the final component of the final scene in a node. Features an auto-calculating layout that wraps buttons horizontally before moving to a new row. If the buttons exceed the container height, a custom scrollbar is automatically rendered.' 
      },
      { 
        name: 'Option Styling Engine', 
        description: 'Allows independent styling configurations for Normal, Hovered, and Clicked button states, updating instantly within the canvas based on mouse proximity logic.' 
      },
      { 
        name: 'Timed Options (Timeout)', 
        description: 'A countdown mechanic for decision making. Renders a shrinking visual progress bar. When time expires, it can auto-route the player by picking a "Random" option or forcing a "Specific" targeted option.' 
      }
    ]
  },
  {
    id: 'animations',
    category: 'Animations & Progression',
    features: [
      { 
        name: 'Entrance Animations', 
        description: 'Components can enter the scene using specific animations with custom durations: Fade In, Zoom In (Scale), Slide In (Left), and a custom Typewriter effect specifically for Text/Variable components.' 
      },
      { 
        name: 'Exit Animations', 
        description: 'Components can fade out gracefully when transitioning to a new scene or a new node. Custom exit durations ensure smooth storytelling.' 
      },
      { 
        name: 'Render Modes', 
        description: 'Components can be set to "Auto Render" (appearing instantly or after the previous animation finishes) or "Render on Click" (waiting for the user to click the canvas before revealing themselves).' 
      }
    ]
  },
  {
    id: 'variables-settings',
    category: 'Variables & Settings',
    features: [
      { 
        name: 'Global State Manager', 
        description: 'A sidebar tool to declare String or Integer variables. These act as the memory of the game, persisting across nodes and heavily dictating the flow of If-Else logic.' 
      },
      { 
        name: 'Project Settings & Validation', 
        description: 'Defines the starting "Root Node" of the project. Includes a live statistics tracker that counts total options and warns the user if there are disconnected options preventing a valid sequence flow.' 
      }
    ]
  },
  {
    id: 'preview-engine',
    category: 'Live Preview Engine',
    features: [
      { 
        name: 'Real-Time Playback', 
        description: 'Compiles the current logic tree and scene setup into a playable fullscreen experience, perfectly mimicking the final published project environment.' 
      },
      { 
        name: 'Audio Ducking', 
        description: 'An advanced audio mixing feature that automatically detects when a Video component starts playing and smoothly lowers the Sequence Background Audio volume to a predefined "Background Music Volume" level to prevent audio clashing.' 
      },
      { 
        name: 'Seamless Transitions', 
        description: 'The engine silently pre-calculates mathematical/variable logic nodes in the background, jumping from node to node until it finds a visual element, ensuring the player never sees a "loading" screen between complex background logic paths.' 
      }
    ]
  }
])

const scrollToSection = (id) => {
  const element = document.getElementById(id)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<template>
  <div class="docs-wrapper">
    <aside class="docs-sidebar">
      <div class="sidebar-header">
        <h2>LoomArt Docs</h2>
        <p>Tapestry Reference Guide</p>
      </div>
      <nav class="sidebar-nav">
        <button 
          v-for="section in docSections" 
          :key="section.id" 
          @click="scrollToSection(section.id)"
          class="nav-link"
        >
          {{ section.category }}
        </button>
      </nav>
      <div class="sidebar-footer">
        <button class="return-btn" @click="$router.push('/create')">← Back to Editor</button>
      </div>
    </aside>

    <main class="docs-content">
      <div class="content-header">
        <h1>Engine Documentation</h1>
        <p>A comprehensive breakdown of the tools and features powering your interactive canvas.</p>
      </div>

      <div class="sections-container">
        <section 
          v-for="section in docSections" 
          :key="section.id" 
          :id="section.id"
          class="doc-section"
        >
          <h2 class="section-title">{{ section.category }}</h2>
          <div class="features-grid">
            <div 
              v-for="(feature, index) in section.features" 
              :key="index" 
              class="feature-card"
            >
              <h3 class="feature-name">{{ feature.name }}</h3>
              <p class="feature-desc">{{ feature.description }}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Base Wrapper */
.docs-wrapper {
  display: flex;
  min-height: 100vh;
  background-color: #020617; /* Deep slate background */
  color: #e2e8f0;
  font-family: 'Inter', sans-serif;
}

/* Sidebar Styling */
.docs-sidebar {
  width: 280px;
  background: rgba(15, 23, 42, 0.95);
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 2rem 1.5rem;
  box-sizing: border-box;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 1.5rem;
  background: linear-gradient(135deg, #a855f7, #3b82f6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: 800;
}

.sidebar-header p {
  color: #64748b;
  font-size: 0.85rem;
  margin-top: 4px;
  margin-bottom: 2rem;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-grow: 1;
}

.nav-link {
  background: transparent;
  border: none;
  color: #94a3b8;
  text-align: left;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.2s ease;
  font-family: inherit;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #00ff88;
  transform: translateX(4px);
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.return-btn {
  width: 100%;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #60a5fa;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.return-btn:hover {
  background: rgba(59, 130, 246, 0.2);
  color: #fff;
}

/* Main Content Styling */
.docs-content {
  flex: 1;
  padding: 3rem 4rem;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.content-header {
  margin-bottom: 4rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 2rem;
}

.content-header h1 {
  font-size: 2.5rem;
  color: #f8fafc;
  margin: 0 0 10px 0;
  font-weight: 300;
  letter-spacing: -1px;
}

.content-header p {
  color: #94a3b8;
  font-size: 1.1rem;
  margin: 0;
}

/* Section Styling */
.doc-section {
  margin-bottom: 5rem;
  scroll-margin-top: 2rem; /* Prevents sticky headers from covering the title if added later */
}

.section-title {
  font-size: 1.5rem;
  color: #f8fafc;
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 12px;
}

.section-title::before {
  content: '';
  display: block;
  width: 12px;
  height: 12px;
  background: #3b82f6;
  border-radius: 3px;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
}

/* Feature Grid */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.feature-card {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 1.5rem;
  border-radius: 12px;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
  border-color: rgba(168, 85, 247, 0.4);
  background: rgba(30, 41, 59, 0.6);
}

.feature-name {
  color: #00ff88;
  font-size: 1.1rem;
  margin: 0 0 10px 0;
  font-weight: 600;
}

.feature-desc {
  color: #cbd5e1;
  font-size: 0.9rem;
  line-height: 1.6;
  margin: 0;
}

/* Custom Scrollbar for the main content area */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: #020617;
}
::-webkit-scrollbar-thumb {
  background: #1e293b;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #334155;
}
</style>