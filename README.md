# VoxelCraft

VoxelCraft is an original browser-based voxel sandbox game. It uses original code and generated visuals rather than redistributing Minecraft assets.

## Play

The project is designed for GitHub Pages. Open repository **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then open the generated Pages URL.

Three.js is loaded from jsDelivr, so the browser needs network access when loading the game.

## Current features

- First-person voxel world
- Deterministic numeric/text seeds
- Procedural terrain, biomes, trees-ready world data, ores, water and caves-ready underground terrain
- Chunked loading and visible-face culling
- Mining and block placement
- Hotbar and inventory
- World creation and local saving/loading
- Day/night-ready game architecture
- Settings for FOV, sensitivity, render distance, volume, coordinates and view bobbing
- Original VoxelCraft branding
- `/music/` reserved for user-added music

## Controls

- WASD: move
- Shift: sprint
- Space: jump
- Mouse: look
- Left click: mine
- Right click: place
- Mouse wheel / 1-9: hotbar
- E: inventory
- Esc: pause

## Structure

- `index.html` — game entry point and UI
- `css/style.css` — interface styling
- `js/main.js` — game loop, input, player interaction and UI
- `js/world.js` — seed-based world generation and chunk meshes
- `js/blocks.js` — block registry
- `music/` — optional music supplied by the project owner

## Adding blocks

Add a block definition to `js/blocks.js` and add its key to `HOTBAR_BLOCKS` when it should be directly selectable. The world and mesh code consume the registry instead of requiring block-specific rendering code.

## Adding music

Place your own supported audio files in `music/`. Music is optional; an empty music directory must not prevent the game from starting.

## Version

VoxelCraft v0.1.0