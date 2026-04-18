<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
document.title = "The Weaver | Documentation";

const isMobileMenuOpen = ref(false);
const toggleMenu = () => { isMobileMenuOpen.value = !isMobileMenuOpen.value; };

// Structured Documentation Data matching your exact outline
const docs = ref([
  {
    id: 'intro-workspace',
    title: '1. Introduction & Workspace Basics',
    subtopics: [
      {
        id: 'what-is-weaver',
        title: '1.1. What is The Weaver?',
        content: [
          'The Weaver is a robust, browser-based visual node engine designed for crafting immersive interactive fiction, visual novels, and branching narrative games. Built around an infinite, drag-and-drop canvas, it empowers creators to build complex, state-driven stories without needing to write a single line of code.',
          'Key Features of the Engine:',
          '• Visual Logic Flow: Build your game using intuitive connected nodes, including Scene nodes for visuals, If-Else nodes for branching paths, and Variable nodes for tracking player choices.',
          '• Rich Media Integration: Seamlessly layer rich text, images, and video components. The engine includes advanced audio management, featuring automatic background music ducking when videos play.',
          '• Dynamic Game State: Track inventory and relationships using global variables (integers and strings), process custom player text inputs, and add urgency with timed dialogue options.',
          '• Built-in Pixel Engine: Reward your players with custom-drawn 64x64 pixel art badges and PFPs using the integrated Gift Node.',
          '• Instant Playback: Test your creations instantly with a seamless, full-screen Preview Mode that handles logic calculations and crossfade transitions in the background.'
        ]
      },
      {
        id: 'interface-overview',
        title: '1.2. The Interface Overview',
        content: [
          'The Weaver\'s top navigation bar provides quick access to essential project controls and information:',
          '• Hamburger Menu (☰): Opens and closes the sidebar where nodes and global variables are managed.',
          '• Tutorial Icon: A quick link to the official video tutorial playlist on YouTube.',
          '• Project Title & Author: Displays the current "Name of the Weave" (project name) and the "Name of the Weaver" (creator).',
          '• Cloud Icon (Media Status): Opens a dropdown to track the background loading status of all images, audio, and video files used in the project.',
          '• Autosave Timer: A live countdown showing when the next automatic save will occur. A pulsing yellow dot appears when there are unsaved changes.',
          '• Save Button (💾): Manually forces the engine to save your current progress to the server.',
          '• Preview Button (▶): Launches the game in full-screen playback mode, starting directly from your designated Root Node.',
          '• Settings Button (⚙️): Opens the project settings modal to configure the starting node and check the logic flow for disconnected options.'
        ],
        media: { type: 'image', src: '/docmedia/1-2-ui-overview.jpg', caption: 'UI Mapping: Highlighting the sidebar, canvas, top header, and settings button.' }
      },
      {
        id: 'navigating-canvas',
        title: '1.3. Navigating the Infinite Canvas',
        content: [
          'The Weaver features an unbounded, infinite workspace designed to handle projects of any size. To help you maintain spatial awareness, the background features dynamic major and minor grid lines that adjust as you navigate.',
          '• Panning (Moving Around): Click and hold anywhere on the empty grid, then drag your mouse to move seamlessly across the workspace.',
          '• Zooming: Use your mouse\'s scroll wheel to zoom in and out. The engine supports a massive scale range (from 0.2x up to 6x) and intelligently centers the zoom directly on your cursor\'s location, making it easy to focus on specific node clusters.'
        ],
        media: { type: 'video', src: '/docmedia/1-3-canvas-navigation.mp4', caption: 'Demonstrating panning and zooming across the grid.' }
      },

      {
        id: 'saving-media',
        title: '1.4. Saving & Media Management',
        content: [
          'Managing project data and heavy media assets is handled seamlessly in the background to keep you focused on creation.',
          '• Autosave & Manual Saving: The Weaver constantly monitors your project for unsaved changes (indicated by a pulsing yellow dot next to the timer). An autosave is triggered automatically every 5 minutes. You can also manually save at any time using the Save button (💾) in the header, which brings up a secure saving screen to prevent accidental edits while syncing.',
          '• The Media Loading Tracker: Because visual novels rely heavily on assets, the engine includes a real-time media registry. The Cloud icon in the top navigation bar acts as a tracker, showing the background download status (Loading, Loaded, or Error) of every image, audio, and video file in your project. This ensures you never preview a scene with missing assets.'
        ],
        media: { type: 'image', src: '/docmedia/1-4-media-tracker.jpg', caption: 'The cloud icon and media loading dropdown.' }
      }
    ]
  },
  {
    id: 'project-settings',
    title: '2. Project Settings & Global Variables',
    subtopics: [
      {
        id: 'configuring-settings',
        title: '2.1. Configuring Project Settings',
        content: [
          'The Project Settings panel is the central hub for configuring your game\'s global behavior and verifying its structural logic.',
          '• Setting the Root Node: Before you can test or play your game, you must define a "Root Node". This tells the engine exactly which General Node serves as the absolute starting point of your story when a player launches the game.',
          '• Project Statistics: Visual novels can quickly become complex webs of choices. The engine tracks your entire node tree and provides a real-time count of all the branching options you have created.',
          '• Validation & Disconnected Options: The engine includes a built-in safety checker. It automatically detects "disconnected options" (choices that lead nowhere). If any options are left unlinked, a critical warning will appear in the settings menu, reminding you to tie up loose ends before finalizing your game.'
        ],
        media: { type: 'image', src: '/docmedia/2-1-project-settings.jpg', caption: 'Project Settings modal and the disconnected options warning.' }
      },
      {
        id: 'global-variables',
        title: '2.2. Global Variables Engine',
        content: [
          'Global Variables act as the memory of your game. They allow your story to track choices, remember custom inputs, and adapt dynamically as the narrative unfolds. Once created, these variables persist and can be accessed from any node in your project.',
          'You can create and manage variables directly from the left sidebar. The engine supports two distinct types:',
          '• Strings (Text): Used to store words or phrases. A classic example is using an Input Box to ask for the player\'s name, saving it to a String variable, and then injecting that custom name into future dialogue.',
          '• Integers (Numbers): Used for tracking measurable stats and math. You can use Integers to keep track of a player\'s Health, accumulated Score, currency, or relationship affection points with other characters.'
        ],
        media: { type: 'video', src: '/docmedia/2-2-creating-variables.mp4', caption: 'Creating a string and an integer variable in the sidebar.' }
      }
    ]
  },
  {
    id: 'node-system',
    title: '3. The Node System',
    subtopics: [
      {
        id: 'understanding-nodes',
        title: '3.1. Understanding Nodes & Connections',
        content: [
          'Nodes are the core building blocks of your narrative. They represent individual scenes, logic checks, variable updates, or rewards. By connecting them, you map out the entire flow of your game.',
          '• Adding Nodes: Open the left sidebar (☰) and click-and-drag any of the four node types (General, If-Else, Set Variables, Gift) directly onto your canvas.',
          '• Connecting Nodes: Every node has a left input arrow (▷) and one or more right output arrows. To link two nodes, click and hold on an output arrow of the first node, drag the connection line, and drop it onto the input arrow of your target node.',
          '• Managing & Deleting (Right-Click): Right-clicking on any node opens a quick-access context menu. From here, you can select "🗑️ Delete Node" to permanently remove it and all its connections, or select "🔗 Remove all links" to instantly sever all incoming and outgoing connection paths while keeping the node intact.'
        ],
        media: { type: 'video', src: '/docmedia/3-1-connecting-nodes.mp4', caption: 'Dragging a node from the menu and connecting it to another node.' }
      },
      {
        id: 'general-nodes',
        title: '3.2. General Nodes',
        content: [
          'General Nodes are the primary storytelling blocks of The Weaver. They hold all the visual, interactive, and auditory elements that your players will actually experience on their screen.',
          '• Scene Sequencing: Inside a single General Node, you can create a list of multiple "Scenes". Think of scenes like pages in a chapter—they play sequentially in the exact order they are created, allowing you to pace your narrative step-by-step before the player moves on to the next node.',
          '• Component Layering: Within each scene, you can add and layer a wide variety of components:',
          '  - Media & Text: Upload Images and Videos, or use Rich Text to write your story.',
          '  - Interactive Elements: Drop in Input Boxes to capture typed answers, or Options boxes to let players make branching choices.',
          '  - Dynamic Displays: Use Variable components to show live data on the screen (like a player\'s custom name or their current health score).',
          '• Node Background Audio: You can assign a specific background music or ambient audio track to the entire General Node. This audio will play and loop seamlessly across all the scenes contained within that node, creating a unified atmosphere for that part of your story.'
        ]
      },
      {
        id: 'ifelse-nodes',
        title: '3.3. If-Else Nodes (Branching Logic)',
        content: [
          'If-Else Nodes act as the critical decision-makers in your narrative, allowing the story to branch dynamically based on the player\'s past choices or accumulated stats.',
          '• Setting up a Comparison: The node compares a selected Global Variable against a target value. This target can be either a fixed "Constant" (e.g., checking if the player\'s score is exactly 10) or another "Variable" (e.g., checking if the player\'s current Health is greater than their Poison level).',
          '• Available Logic Operators: You can evaluate conditions using standard operators: Equal to (==), Not Equal to (!=), Greater Than (>), Less Than (<), Greater or Equal (>=), and Less or Equal (<=).',
          '• True/False Output Routing: Based on the result of the logic check during gameplay, the engine automatically directs the player down one of two paths. The If-Else node features two specific output arrows: a green "T" (True) arrow and a red "F" (False) arrow. Connect these to different nodes to create branching consequences.'
        ],
        media: { type: 'image', src: '/docmedia/3-3-ifelse-panel.jpg', caption: 'The If-Else configuration panel and its T/F output arrows.' }
      },
      {
        id: 'set-variables-nodes',
        title: '3.4. Set Variables Nodes (State Mutation)',
        content: [
          'Set Variables Nodes are the engine behind state mutation. They allow you to update your Global Variables seamlessly in the background as the player progresses through the story, without pausing the gameplay.',
          '• Modifying Integers (Math): You can change numerical stats by selecting a target variable and applying an operator. Available math operators include Set (=), Add (+), Subtract (-), Multiply (*), and Divide (/). You can modify a variable using a fixed constant number or by applying the value of another variable.',
          '• Modifying Strings (Concatenation): String variables can be completely overwritten (=) or added to (+). When adding to a string, the engine provides a powerful concatenation UI: you can add specific text before the current value (Prefix) and after the current value (Suffix). For example, you can combine "Hello " + playerName + "!" into a single stored sentence.'
        ],
        media: { type: 'video', src: '/docmedia/3-4-set-variables.mp4', caption: 'A string variable being concatenated (e.g., "Hello " + name + "!").' }
      },
      {
        id: 'gift-nodes-intro',
        title: '3.5. Gift Nodes (Rewards)',
        content: [
          'Gift Nodes allow you to briefly interrupt the narrative flow to grant the player a special visual reward, which can be saved to their account.',
          '• Reward Types: You can grant two distinct types of items: PFPs (Profile Pictures with solid backgrounds) and Badges (items with transparent backgrounds).',
          '• Built-in Loom Art: Unlike standard image components where you upload a file, rewards in The Weaver are created using our custom "Loom Art" engine. You will draw your PFP or Badge directly onto a 64x64 pixel canvas right inside the editor.',
          '(The exact creation, drawing, and customization process is detailed further in Section 8: The Gift Node Engine)'
        ]
      }
    ]
  },
  {
    id: 'scene-management',
    title: '4. Scene Management (Inside General Nodes)',
    subtopics: [
      {
        id: 'accessing-scene-editor',
        title: '4.1. Accessing the Scene Editor',
        content: [
          'To begin adding content to your story, you need to access the Scene Editor for a specific General Node.',
          '• Opening the Editor: Simply double-click on any General Node directly on the canvas.',
          '• The Editor Interface: This action dims the background and opens a comprehensive popup overlay. As demonstrated in the video below, this dedicated workspace allows you to manage the node\'s name, its sequence of scenes, background audio, and all individual visual components.'
        ],
        media: { type: 'video', src: '/docmedia/4-1-scene-editor.mp4', caption: 'Double-clicking on a General Node to open the popup interface.' }
      },
      {
        id: 'managing-scene-list',
        title: '4.2. Managing the Scene List',
        content: [
          'The Scene List, located on the left side of the Scene Editor, acts as the timeline for your node. Scenes play one after another, allowing you to pace conversations and visual changes without needing to create a messy web of dozens of individual nodes on the main canvas.',
          '• Adding Scenes: Click the "Add Scene" button to append a new scene to the bottom of your list. Important Rule: You cannot add a new scene if your current final scene contains an "Options" component, because Options are strictly used to end a node and branch the story.',
          '• Naming Scenes: By default, scenes are named numerically (Scene 1, Scene 2, etc.). To keep your project organized, double-click a scene to open its details, then use the "Scene Name" input box to give it a descriptive title (e.g., "Entering the Tavern").',
          '• Deleting Scenes: Hover your mouse over any scene in the list to reveal the trash can (🗑️) icon. Deleting a scene will safely and automatically re-index the numbering of your remaining scenes to keep your timeline clean.',
          '• Linear Sub-Routing (The Flow): The engine reads scenes strictly from top to bottom. During gameplay, once a player exhausts all the visual components in the first scene, the engine will automatically crossfade into the next scene. This linear progression continues until the final scene of the node is completed, at which point the engine follows the node\'s output arrow to move to an entirely new node.'
        ]
      },
      {
        id: 'scene-settings',
        title: '4.3. Scene Settings',
        content: [
          'Every scene in your node can have its own distinct background appearance, allowing you to create flashes of color, fade-to-black moments, or subtle tinted overlays.',
          '• Changing Background Color: In the Scene Details view, use the color picker under "Background Set" to select a solid base color for the current scene.',
          '• The Alpha Slider (Opacity): Next to the color picker is the Alpha Slider. By dragging this slider, you can adjust the transparency of the background color (from fully solid to completely invisible).'
        ],
        media: { type: 'image', src: '/docmedia/4-3-scene-colors.jpg', caption: 'The color picker and alpha slider changing the background.' }
      },
      {
        id: 'sequence-audio',
        title: '4.4. Sequence Audio & Ducking',
        content: [
          'The Weaver allows you to set a continuous background audio track that plays seamlessly across all scenes within a General Node, helping you establish a consistent atmosphere.',
          '• Uploading & Properties: Click the "Click to add audio" placeholder in the Audio Box to upload your track. You can adjust the master volume for the node and use the "Loop Audio" checkbox to decide if the track should repeat continuously or just play once (one-shot).',
          '• Audio Ducking (Smart Volume): The engine features an automatic audio mixer. If you have background music playing and a Video Component appears in a scene, the engine will automatically "duck" (lower) the background music volume so your players can hear the video clearly. You can customize this ducking level in the Video Component\'s settings.',
          '• Smooth Transitions: If a video is set to play once (non-looping), the background music will intelligently and smoothly fade back up to its original volume the moment the video ends.'
        ],
        media: { type: 'video', src: '/docmedia/4-4-audio-ducking.mp4', caption: 'Demonstrating audio ducking when a video component appears.' }
      }
    ]
  },
  {
    id: 'visual-media',
    title: '5. Visual & Media Components',
    subtopics: [
      {
        id: 'managing-components',
        title: '5.1. Adding & Managing Components',
        content: [
          'Scenes are built by layering multiple visual and interactive components. The engine provides intuitive tools for adding, arranging, and configuring these elements.',
          '• The "+ Add" Dropdown: Click the "+ Add" button in the Scene Details panel to insert a new component. Available types include Image, Text, Video, Input Box, Variable display, and Options.',
          '• Drag-and-Drop Reordering: In the Scene Content list, you can easily change the order of components by clicking and holding the drag handle (⋮⋮⋮⋮) next to a component and moving it up or down. (Note: The engine automatically enforces that "Options" components remain at the very end of the final scene).',
          '• Layering & Z-Index Logic: The order of components in your list dictates their visual layering on the canvas. Components at the top of the list are drawn first (in the background), while components at the bottom are drawn last (in the foreground). You can manually adjust this using the layer controls inside the Component Editor.',
          '• Quick Context Menu (Right-Click): For faster editing, you can right-click any component directly on the visual canvas or in the component list. This opens a quick-action menu where you can instantly toggle its rendering behavior ("Auto Render" vs "Render on Click"), adjust its z-index layer, or delete it, all without needing to open the full editor.'
        ],
        media: { type: 'video', src: '/docmedia/5-1-reordering-components.mp4', caption: 'Drag-and-drop reordering of components in the sidebar.' }
      },
      {
        id: 'text-components',
        title: '5.2. Text Components',
        content: [
          'Google Fonts integration.',
          'Rich formatting (Bold, Italic, Underline, Strikethrough, Line Colors).',
          'Text wrapping and alignment.'
        ],
        media: { type: 'image', src: '/docmedia/5-2-text-styles.jpg', caption: 'Various text styles applied simultaneously.' }
      },
      {
        id: 'image-components',
        title: '5.3. Image Components',
        content: [
          'Image components allow you to bring your characters and environments to life.',
          '• Uploading: Select "Image" from the "+ Add" menu to upload a file directly from your computer.',
          '• Automatic Aspect-Ratio: When an image is uploaded, The Weaver automatically calculates and perfectly preserves its original aspect ratio. If the image is extremely large, the engine scales it down to a manageable default size for the editor, ensuring it never appears stretched or squashed.'
        ],
        media: { type: 'image', src: '/docmedia/5-3-image-resize.jpg', caption: 'An image component being resized on the canvas.' }
      },
      {
        id: 'video-components',
        title: '5.4. Video Components',
        content: [
          'Video components bring dynamic motion and sound directly into your narrative, with intelligent flow control handled automatically by the engine.',
          '• Loop & Mute Toggles: In the component editor, you can configure a video to repeat continuously or play just once. The Mute toggle allows you to silence the video\'s original audio, which is perfect for using videos purely as animated backgrounds.',
          '• Fine-Tuning Audio Ducking: If your node has background music, the engine automatically lowers it when a video plays. Using the "Background Music Volume" slider in the video\'s settings, you can define exactly how quiet the background track should become (e.g., dropping to 20% volume) so dialogue or sound effects in your video can be heard clearly.',
          '• Playback Rules & Scene Progression: The Weaver intelligently synchronizes scene pacing with your videos. If a video is set to play once (non-looping), the engine automatically pauses the scene timeline. It will wait until the video has completely finished playing before it reveals the next auto-rendered component or transitions to the next scene.'
        ],
        media: { type: 'video', src: '/docmedia/5-4-video-playback.mp4', caption: 'A video component playing inside the editor.' }
      },
      {
        id: 'variable-display',
        title: '5.5. Variable Display Components',
        content: [
          'Variable Display Components allow you to project dynamic data—such as a player\'s custom name, their current health, or accumulated score—directly onto the screen during gameplay.',
          '• Assigning a Variable: After adding a Variable component, look for the "Variable Source" dropdown in the component properties panel. Select which of your pre-defined Global Variables you want to link to this display.',
          '• Editor vs. Playback: While working in the editor, the component may display a placeholder (like "{ Variable }") or the variable\'s default value. When you launch Preview Mode, it will seamlessly inject the live, current value of that variable based on the player\'s progress.',
          '• Styling: Just like standard text, you can fully customize the font, size, color, and animations of the displayed variable.'
        ],
        media: { type: 'image', src: '/docmedia/5-5-variable-display.jpg', caption: 'A Variable Display component setup.' }
      }
    ]
  },
  {
    id: 'interactive-components',
    title: '6. Interactive Components',
    subtopics: [
      {
        id: 'input-boxes',
        title: '6.1. Input Boxes (Player Input)',
        content: [
          'Input Boxes allow players to type custom text or numbers directly into your game, making the narrative highly interactive and personalized.',
          '• Variable Assignment: To capture a player\'s input, you must link the Input component to an existing Global Variable. In the component properties panel, use the "Variable Assignment" dropdown to select your target variable.',
          '• Playtime Capture: During gameplay, the scene will wait for the player to type their answer. The moment they click the Submit button, whatever they typed is instantly saved into the assigned Global Variable and stored in the game\'s memory.',
          '• Automatic Validation: The engine intelligently restricts input based on the variable type you select. For example, if you link the Input Box to an Integer variable (like "Player Age"), the engine will strictly validate the input and only accept numbers.'
        ],
        media: { type: 'video', src: '/docmedia/6-1-input-styling.mp4', caption: 'Typing into an input box and the focus state colors changing.' }
      },
      {
        id: 'options-box',
        title: '6.2. Options Box (Branching Choices)',
        content: [
          'The Options Box is the primary tool for creating branching narratives, allowing players to choose their own path through the story.',
          '• Strict Placement Rules: Because an Options Box dictates where the player goes next, the engine enforces strict structural rules. An Options component must always be the very last component in the final scene of a General Node. Once added, you cannot add more scenes or components after it.',
          '• Adding & Removing Choices: By default, an Options Box starts with two paths. You can add more choices or remove them using the component editor. (Note: To prevent logic errors, a valid Options Box must always contain a minimum of two choices).',
          '• Linking Paths (The Canvas): On the main visual canvas, adding an Options Box changes the node\'s behavior. Instead of a single default output arrow, the node will now generate a dedicated output arrow for every individual choice you created. You can drag lines from these specific choice arrows to connect them to different target nodes, effectively splitting your story.'
        ],
        media: { type: 'video', src: '/docmedia/6-2-options-box.mp4', caption: 'An Options Box with overflow scrolling and hover effects.' }
      },
      {
        id: 'timed-options',
        title: '6.3. Timed Options (The Timeout Mechanic)',
        content: [
          'To inject urgency into your narrative, the Options Box features a built-in timeout mechanic that forces a decision if the player hesitates.',
          '• Enabling the Time Limit & Duration: Toggle the "Enable Time Limit" checkbox in the component settings and use the slider to set the duration in seconds. During gameplay, this renders a shrinking progress bar beneath the choices to visually communicate the remaining time to the player.',
          '• Configuring Timeout Actions: You must dictate exactly what happens if the clock reaches zero before the player clicks an option. There are two fallback behaviors:',
          '  - Random Selection: The engine will automatically and randomly pick one of the available choices and proceed down that path.',
          '  - Specific Forced Choice: You manually assign a specific target option from your list. If the player runs out of time, the engine will act as if they clicked that exact option (this is perfect for forcing a "stay silent" or "you were too slow" narrative branch).'
        ],
        media: { type: 'video', src: '/docmedia/6-3-timed-options.mp4', caption: 'The time limit progress bar shrinking during preview mode.' }
      }
    ]
  },
  {
    id: 'layout-animation',
    title: '7. Component Layout, Behavior & Animation',
    subtopics: [
      {
        id: 'transform-controls',
        title: '7.1. Transform Controls',
        content: [
          'The Layout & Transform controls give you pixel-perfect precision over how every component appears within your scene.',
          '• Precise X/Y Positioning: Move components across the screen using the X (horizontal) and Y (vertical) coordinate sliders. For exact placement, you can manually type the coordinate numbers directly into the input boxes.',
          '• Width & Height Scaling: Adjust the physical size of your components. For Images and Videos, the engine features an automatic aspect-ratio lock: changing the width will automatically calculate and update the height to ensure your media never looks stretched or distorted.',
          '• Rotation: Tilt any component by adjusting its rotation slider (from 0 to 360 degrees), perfect for creating dynamic, angled visual layouts.'
        ]
      },
      {
        id: 'render-modes',
        title: '7.2. Render Modes (Flow Control)',
        content: [
          'Render Modes dictate the pacing of your scene by controlling exactly when each component is revealed to the player.',
          '• Render on Click: This acts as a manual pause point. The engine will halt the scene\'s progression and wait for the player to click anywhere on the screen before revealing this component. This is essential for pacing dialogue, ensuring the player has time to read before the next text box appears.',
          '• Auto Render: When enabled, the component bypasses the click requirement. It will appear automatically the moment the previous component finishes its entrance animation. By chaining multiple Auto Render components together, you can make complex layouts (such as an overarching background image, a character sprite, and a title text) all appear on the screen simultaneously.'
        ],
        media: { type: 'video', src: '/docmedia/7-2-render-modes.mp4', caption: 'In this snippet, components of the "A Robot Junkie?" node are all rendered on click. While the components rendered once the choice is made are all set to render automatically' }
      },
      {
        id: 'component-animations',
        title: '7.3. Component Animations',
        content: [
          'Entrance Animations (Fade In, Zoom/Scale, Slide Left).',
          'The "Typewriter" effect (Exclusive to Text/Variable components).',
          'Exit Animations (Fade Out, None).',
          'Setting Animation Durations.'
        ],
        media: { type: 'video', src: '/docmedia/7-3-animations.mp4', caption: 'Showcasing the typewriter effect and a slide-in animation.' }
      }
    ]
  },
  {
    id: 'gift-engine',
    title: '8. The Gift Node Engine (Pixel Art)',
    subtopics: [
      {
        id: 'reward-type',
        title: '8.1. Choosing a Reward Type',
        content: ['PFP (Solid Background) vs. Badge (Transparent Checkered Background).'],
        media: { type: 'image', src: '/docmedia/8-1-reward-types.jpg', caption: 'The initial PFP/Badge selection screen.' }
      },
      {
        id: 'pixel-editor',
        title: '8.2. The 64x64 Pixel Editor',
        content: ['Drawing tools: Pencil, Eraser, and Flood Fill.'],
        media: { type: 'video', src: '/docmedia/8-2-pixel-editor.mp4', caption: 'Drawing and flood-filling on the pixel canvas.' }
      },
      {
        id: 'reward-settings',
        title: '8.3. Reward Settings',
        content: [
          'Once your pixel art is complete, you can configure exactly how the reward is presented to the player when they earn it.',
          '• Naming & Typography: Give your reward a memorable name (e.g., "Hero\'s Crest" or "Golden Key"). You can select a specific Google Font for this text to ensure the notification matches your game\'s overall aesthetic.',
          '• Reward Audio (10-Second Limit): You can upload a special sound effect or short jingle to play when the reward is granted. To ensure the notification doesn\'t disrupt the pacing of your story, the engine strictly enforces a maximum audio length of 10 seconds for these clips.',
          '• The Slide-Down Notification: You don\'t need to build a custom UI for rewards. During gameplay, when a player hits a Gift Node, the engine automatically pauses the narrative, plays your custom audio, and smoothly slides a notification banner down from the top of the screen showcasing your pixel art.'
        ],
        media: { type: 'image', src: '/docmedia/8-3-gift-notification.jpg', caption: 'The slide-down notification that appears when a player earns a gift.' }
      }
    ]
  },
  {
    id: 'preview-playback',
    title: '9. Preview & Playback Mode',
    subtopics: [
      {
        id: 'launching-engine',
        title: '9.1. Launching the Engine',
        content: [
          'The Weaver offers flexible testing options so you can experience your game exactly as your players will.',
          '• Global Playback (From Root): Clicking the "Preview" button (▶) in the top navigation bar launches the complete game. The engine will automatically find your designated Root Node and start the story from the very beginning.',
          '• Local Node Preview: If you are working deep inside a complex project and only want to test the current node you are editing, you can click the "Preview Node" button inside the Scene Editor. This saves time by instantly testing that specific node without playing through the entire game.',
          '• Fullscreen Immersion: Regardless of how you launch the preview, the engine automatically hides the editor UI and expands into a distraction-free, full-screen playback mode.'
        ],
        media: { type: 'video', src: '/docmedia/9-1-preview-mode.mp4', caption: 'The transition from the editor into full-screen Preview Mode.' }
      },
      {
        id: 'how-preview-works',
        title: '9.2. How Preview Mode Works',
        content: [
          'Preview Mode is not just a visual viewer; it actively runs the full game engine logic in real-time, handling complex routing invisibly.',
          '• Background Logic Execution: As you play, the engine silently processes non-visual nodes (like If-Else logic checks and Set Variables). It calculates the math instantly in the background and automatically skips forward to the next visual General Node, ensuring the player never experiences a "loading" pause or blank screen.',
          '• Smooth Transitions: Moving between scenes or jumping to entirely new nodes triggers an automatic, polished crossfade animation to keep the narrative flowing naturally without jarring cuts.',
          '• Runtime State Resets: Every time you launch a new Preview session, the engine performs a "clean state" reset. It wipes temporary player inputs, resets all global variables back to their default values, and rewinds all video and audio files. This guarantees a fresh, bug-free testing environment every single time you hit play.'
        ]
      }
    ]
  }
]);

const scrollToSection = (id) => {
  const element = document.getElementById(id);
  if (element) {
    const offset = 80; // Account for fixed mobile header
    const bodyRect = document.body.getBoundingClientRect().top;
    const elementRect = element.getBoundingClientRect().top;
    const elementPosition = elementRect - bodyRect;
    const offsetPosition = elementPosition - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
    isMobileMenuOpen.value = false; // Close menu on mobile after click
  }
};
</script>

<template>
  <div class="docs-layout">
    
    <header class="mobile-header">
      <div class="mobile-header-content">
        <h2>Weaver Docs</h2>
        <button class="hamburger-btn" @click="toggleMenu">
          <span class="hamburger-line" :class="{ 'open': isMobileMenuOpen }"></span>
          <span class="hamburger-line" :class="{ 'open': isMobileMenuOpen }"></span>
          <span class="hamburger-line" :class="{ 'open': isMobileMenuOpen }"></span>
        </button>
      </div>
    </header>

    <aside class="sidebar" :class="{ 'sidebar-open': isMobileMenuOpen }">
      <div class="sidebar-top">
        <h2 class="desktop-title">Weaver Docs</h2>
        <p class="desktop-subtitle">Engine Reference Guide</p>
        <button class="return-btn" @click="$router.push('/')">← Back to Editor</button>
      </div>
      
      <nav class="nav-menu">
        <div v-for="section in docs" :key="section.id" class="nav-section">
          <button class="nav-main-topic" @click="scrollToSection(section.id)">
            {{ section.title }}
          </button>
          <div class="nav-subtopics">
            <button 
              v-for="sub in section.subtopics" 
              :key="sub.id" 
              class="nav-sub-topic"
              @click="scrollToSection(sub.id)"
            >
              {{ sub.title }}
            </button>
          </div>
        </div>
      </nav>
    </aside>

    <div 
      class="sidebar-overlay" 
      :class="{ 'overlay-active': isMobileMenuOpen }"
      @click="toggleMenu"
    ></div>

    <main class="main-content">
      <div class="content-wrapper">
        <div class="page-intro">
          <h1>Engine Documentation</h1>
          <p>A complete reference guide for mastering The Weaver interactive fiction engine. Learn how to manage nodes, build logic, and style responsive media components.</p>
        </div>

        <section 
          v-for="section in docs" 
          :key="section.id" 
          :id="section.id"
          class="topic-section"
        >
          <h2 class="topic-title">{{ section.title }}</h2>
          <div class="topic-divider"></div>

          <div 
            v-for="sub in section.subtopics" 
            :key="sub.id"
            :id="sub.id" 
            class="subtopic-block"
          >
            <h3 class="subtopic-title">{{ sub.title }}</h3>
            
            <ul class="subtopic-list" v-if="sub.content.length > 0">
              <li v-for="(item, idx) in sub.content" :key="idx">{{ item }}</li>
            </ul>

            <div class="media-container" v-if="sub.media">
              <div class="media-wrapper">
                <img 
                  v-if="sub.media.type === 'image'" 
                  :src="sub.media.src" 
                  :alt="sub.media.caption"
                  class="doc-media-img"
                  loading="lazy"
                />
                <video 
                  v-if="sub.media.type === 'video'" 
                  :src="sub.media.src" 
                  class="doc-media-vid"
                  autoplay loop muted playsinline
                ></video>
              </div>
              <p class="media-caption">
                <span class="caption-icon">{{ sub.media.type === 'video' ? '🎬' : '📸' }}</span>
                {{ sub.media.caption }}
              </p>
            </div>
          </div>
        </section>

      </div>
    </main>

  </div>
</template>

<style scoped>
/* Base Layout & Reset */
.docs-layout {
  display: flex;
  align-items: flex-start; /* CRITICAL FIX: Ensures sticky behavior works perfectly */
  min-height: 100vh;
  background-color: #0f172a; /* Deep blue/slate dark theme */
  color: #e2e8f0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  /* Removed 'overflow-x: hidden;' because it breaks 'position: sticky;' */
}

/* Scrollbar styling */
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: #0f172a; }
::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #475569; }

/* ================= HEADER (Mobile/Tablet) ================= */
.mobile-header {
  display: none;
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 60px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 50;
}
.mobile-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  padding: 0 20px;
}
.mobile-header h2 {
  margin: 0; font-size: 1.2rem; font-weight: 700;
  background: linear-gradient(135deg, #00ff88, #3b82f6);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.hamburger-btn {
  background: none; border: none; cursor: pointer; display: flex; flex-direction: column; gap: 5px; padding: 5px;
}
.hamburger-line {
  display: block; width: 24px; height: 2px; background: #e2e8f0; transition: all 0.3s ease;
}
.hamburger-line.open:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.hamburger-line.open:nth-child(2) { opacity: 0; }
.hamburger-line.open:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

/* ================= SIDEBAR ================= */
.sidebar {
  width: 300px;
  background: #1e293b;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  flex-shrink: 0;
  z-index: 40;
  transition: transform 0.3s ease;
}
.sidebar-top {
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.desktop-title {
  margin: 0; font-size: 1.5rem; font-weight: 800;
  background: linear-gradient(135deg, #00ff88, #3b82f6);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.desktop-subtitle {
  color: #94a3b8; font-size: 0.85rem; margin: 4px 0 16px 0;
}
.return-btn {
  width: 100%; padding: 10px; border-radius: 6px;
  background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); color: #60a5fa;
  font-weight: 600; cursor: pointer; transition: all 0.2s;
}
.return-btn:hover { background: rgba(59, 130, 246, 0.2); color: #fff; }

.nav-menu {
  flex: 1; overflow-y: auto; padding: 16px 12px;
}
.nav-section { margin-bottom: 12px; }
.nav-main-topic {
  width: 100%; text-align: left; background: transparent; border: none;
  color: #f8fafc; font-size: 0.95rem; font-weight: 600; cursor: pointer; padding: 8px 12px;
  border-radius: 6px; transition: background 0.2s;
}
.nav-main-topic:hover { background: rgba(255, 255, 255, 0.05); color: #00ff88; }

.nav-subtopics {
  display: flex; flex-direction: column; gap: 2px; padding-left: 12px; margin-top: 4px;
  border-left: 1px solid rgba(255, 255, 255, 0.1); margin-left: 16px;
}
.nav-sub-topic {
  width: 100%; text-align: left; background: transparent; border: none;
  color: #94a3b8; font-size: 0.85rem; cursor: pointer; padding: 6px 12px;
  border-radius: 4px; transition: all 0.2s;
}
.nav-sub-topic:hover { color: #fff; background: rgba(255, 255, 255, 0.03); transform: translateX(4px); }

/* Overlay for Mobile */
.sidebar-overlay {
  display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 35;
  opacity: 0; pointer-events: none; transition: opacity 0.3s;
}
.overlay-active { opacity: 1; pointer-events: auto; }


/* ================= MAIN CONTENT ================= */
.main-content {
  flex: 1; display: flex; justify-content: center;
}
.content-wrapper {
  max-width: 900px; width: 100%; padding: 40px 40px 100px 40px;
}

.page-intro { margin-bottom: 50px; }
.page-intro h1 { font-size: 2.5rem; font-weight: 800; color: #f8fafc; margin: 0 0 16px 0; letter-spacing: -1px; }
.page-intro p { font-size: 1.1rem; color: #94a3b8; line-height: 1.6; margin: 0; }

.topic-section { margin-bottom: 60px; scroll-margin-top: 80px; }
.topic-title {
  font-size: 1.8rem; color: #00ff88; font-weight: 700; margin: 0 0 12px 0;
}
.topic-divider {
  height: 1px; width: 100%; background: linear-gradient(90deg, rgba(255,255,255,0.1), transparent); margin-bottom: 30px;
}

.subtopic-block { margin-bottom: 40px; scroll-margin-top: 90px; }
.subtopic-title {
  font-size: 1.25rem; color: #f8fafc; font-weight: 600; margin: 0 0 16px 0;
  display: flex; align-items: center; gap: 8px;
}
.subtopic-title::before {
  content: ''; display: block; width: 6px; height: 16px; background: #3b82f6; border-radius: 2px;
}

.subtopic-list {
  list-style-type: disc; padding-left: 24px; color: #cbd5e1; font-size: 1rem; line-height: 1.7; margin-bottom: 24px;
}
.subtopic-list li { margin-bottom: 8px; }

/* Media Display UI */
.media-container {
  background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px; padding: 16px; margin-top: 20px;
}
.media-wrapper {
  width: 100%; border-radius: 8px; overflow: hidden; background: #000;
  display: flex; justify-content: center; align-items: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}
.doc-media-img, .doc-media-vid {
  width: 100%; max-height: 500px; object-fit: contain; display: block;
}
.media-caption {
  margin: 16px 0 0 0; font-size: 0.9rem; color: #94a3b8; text-align: center; font-style: italic;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.caption-icon { font-style: normal; }


/* ================= MEDIA QUERIES ================= */

/* Tablets & Mobile Navigation Override */
@media (max-width: 1024px) {
  .mobile-header { display: block; }
  
  .sidebar {
    position: fixed; top: 60px; left: 0; bottom: 0; height: calc(100vh - 60px);
    transform: translateX(-100%);
    box-shadow: 4px 0 24px rgba(0,0,0,0.5);
  }
  .sidebar.sidebar-open { transform: translateX(0); }
  
  .desktop-title, .desktop-subtitle { display: none; }
  .sidebar-top { padding: 16px; }
  
  .sidebar-overlay { display: block; }
  
  .main-content { padding-top: 60px; }
}

/* Mobile Screens */
@media (max-width: 640px) {
  .content-wrapper { padding: 30px 20px 80px 20px; }
  
  .page-intro h1 { font-size: 2rem; }
  .topic-title { font-size: 1.5rem; }
  .subtopic-title { font-size: 1.15rem; }
  
  .media-container { padding: 10px; }
  .doc-media-img, .doc-media-vid { max-height: 300px; }
}
</style>